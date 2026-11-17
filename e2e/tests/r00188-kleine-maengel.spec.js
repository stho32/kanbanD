// R00188 (Karten #68, #55): Fehlerzeile beim Einrichten, „gespeichert“ nur nach Erfolg, Cursor im Zahlenfeld, kleine Beschriftungen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, ausMehr, breiteSetzen, commitSteht } = require('./hilfen');

const GRUNDBESTAND = () => ({
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nassignees: [st]\n---\n',
});

let k;
test.afterEach(() => k?.stoppen());

/** Startet den Grundbestand (oder `dateien`) als Stefan und wartet auf das gezeichnete Board. */
async function starten(page, dateien = GRUNDBESTAND(), breite = 1280) {
  k = await kanbanStarten(einrichten(dateien));
  await page.setViewportSize({ width: breite, height: 900 });
  await alsPerson(page, 'st');
  await page.goto(k.adresse);
  await bereit(page, '.bahn');
}

/** Eine Meldung von genau 120 Zeichen mit der Handlungsanweisung am Ende. */
const MELDUNG_120 = (() => {
  const ende = ' Bitte „Verwerfen“ wählen und neu einrichten.';
  const text = 'Die Board-Datei wurde inzwischen von einem anderen Teilnehmer geändert, die Spalten passen nicht mehr zusammen.' + ende;
  return text.length >= 120 ? text.slice(0, 120 - ende.length) + ende : text.padEnd(120 - ende.length, '.') + ende;
})();

test.describe('68-1 Fehlermeldung beim Einrichten ganz lesbar', () => {
  for (const breite of [1280, 320]) {
    test(`${breite} px: 120 Zeichen stehen vollständig in der Modusleiste, umbrochen ohne „…“; Verwerfen und Fertig bleiben bedienbar`, async ({ page }) => {
      expect(MELDUNG_120.length).toBe(120);
      await starten(page, GRUNDBESTAND(), breite);
      await page.route('**/api/boards/entwicklung/spalten', route => route.request().method() === 'PUT'
        ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ fehler: MELDUNG_120 }) })
        : route.continue());
      await ausMehr(page, 'Spalten einrichten');
      await page.getByRole('button', { name: 'Fertig' }).click();
      const fehler = page.locator('header .fehl-kopf');
      await expect(fehler).toHaveText(MELDUNG_120);
      await breiteSetzen(page, breite);
      const mass = await fehler.evaluate(e => {
        const r = e.getBoundingClientRect(), stil = getComputedStyle(e);
        return { abgeschnitten: e.scrollWidth > e.clientWidth || e.scrollHeight > e.clientHeight, links: r.left, rechts: r.right,
          zeilen: Math.round(r.height / parseFloat(stil.lineHeight || '16')), fenster: innerWidth, ueberlauf: stil.textOverflow };
      });
      expect(mass.abgeschnitten, 'die Meldung ist nicht gekürzt').toBe(false);
      expect(mass.ueberlauf, 'kein „…“').not.toBe('ellipsis');
      expect(mass.links).toBeGreaterThanOrEqual(0);
      expect(mass.rechts).toBeLessThanOrEqual(mass.fenster);
      for (const name of ['Verwerfen', 'Fertig']) {
        const knopf = page.locator('header').getByRole('button', { name, exact: true });
        await expect(knopf, name).toBeVisible();
        await expect(knopf, name).toBeInViewport({ ratio: 1 });
        await expect(knopf, name).toBeEnabled();
      }
      // Querscrollen der ganzen Seite in „Spalten einrichten“ bei 320 px ist R00187 AK 1 (I0177); hier zählt die Modusleiste
      expect(await page.locator('header.modus').evaluate(e => e.scrollWidth), 'die Modusleiste ragt nicht über das Fenster').toBeLessThanOrEqual(breite);
      await page.locator('header').getByRole('button', { name: 'Verwerfen', exact: true }).click();
      await expect(page.locator('header.modus')).toHaveCount(0);
    });
  }
});

/**
 * 55-1 „gespeichert“ nur, wenn gespeichert wurde: nach einer abgelehnten Eingabe steht im Fuß die Meldung und kein „gespeichert …“;
 * nach der nächsten angenommenen Änderung desselben Felds wieder „gespeichert“ mit deren Uhrzeit. Die Uhr läuft über `page.clock`.
 */
test.describe('55-1 „gespeichert“ nur nach einem Erfolg', () => {
  const r155 = require('./r00155-hilfen');
  const { reiter } = require('./hilfen');
  const UM = zeit => new Date(`2026-11-17T${zeit}+01:00`);
  const VARIANTEN = [
    { feld: 'Titel', ansicht: 'Inhalt', meldung: r155.MELDUNG_TITEL,
      // nach einer Ablehnung steht der Titel noch im Bearbeiten (R00155 96-1), sonst erst über den Stift
      eingeben: async (page, wert) => {
        const titel = page.locator('#fenster [data-af="titel"]');
        if (!await titel.count()) await page.locator('#fenster [data-act="titel-bearbeiten"]').click();
        await titel.fill(wert);
        await titel.press('Enter');
      },
      gut: ['Abnahme geprüft', 'Abnahme erneut geprüft'], schlecht: '' },
    { feld: 'Dauer', ansicht: 'Zeiten', meldung: r155.MELDUNG_DAUER,
      eingeben: async (page, wert) => { const zeit = page.locator('#fenster').getByLabel('Zeit nachtragen'); await zeit.fill(wert); await zeit.press('Enter'); },
      gut: ['0:45', '0:30'], schlecht: 'abc' },
    { feld: 'Herkunft', ansicht: 'Details', meldung: r155.MELDUNG_X1,
      eingeben: async (page, wert) => { const herkunft = page.locator('#fenster').getByLabel('Neue Herkunft'); await herkunft.fill(wert); await herkunft.press('Enter'); },
      gut: ['I0001', 'I0002'], schlecht: 'X1' },
  ];
  for (const v of VARIANTEN) {
    test(`${v.feld}: angenommen 10:00:05, dann abgelehnt → Meldung ohne „gespeichert“, kein Commit; angenommen 10:01:30 → „gespeichert 10:01:30“ ohne Meldung`, async ({ page }) => {
      k = await r155.starten(page);
      await page.clock.setFixedTime(UM('10:00:05'));
      await r155.fensterOeffnen(page, 1);
      await reiter(page, v.ansicht);
      const gs = page.locator('#fenster .mod-fuss .gs'), meldung = page.locator('#fenster .mod-fuss [role=alert]');
      const commits = +k.git('rev-list', '--count', 'HEAD') + 1;
      await v.eingeben(page, v.gut[0]);
      await expect(gs).toHaveText('gespeichert 10:00:05');
      await commitSteht(k, commits);

      await v.eingeben(page, v.schlecht);
      await expect(meldung).toContainText(v.meldung);
      await expect(gs).not.toContainText('gespeichert');
      expect(+k.git('rev-list', '--count', 'HEAD'), 'kein Commit').toBe(commits);

      await page.clock.setFixedTime(UM('10:01:30'));
      await v.eingeben(page, v.gut[1]);
      await expect(gs).toHaveText('gespeichert 10:01:30');
      await expect(meldung).toHaveCount(0);
    });
  }
});

