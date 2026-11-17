// R00188 (Karten #68, #55): Fehlerzeile beim Einrichten, „gespeichert“ nur nach Erfolg, Cursor im Zahlenfeld, kleine Beschriftungen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, bereit, ausMehr, breiteSetzen } = require('./hilfen');

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
