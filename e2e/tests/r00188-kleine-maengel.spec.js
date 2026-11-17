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

/**
 * 55-2 Cursor im Zahlenfeld bleibt (Probe der Karte #55): „Messbasis“ 90, Fokus im Feld, Cursor am Ende; ein zweiter Teilnehmer
 * ändert einen Titel (Live-Ereignis, die Seite zeichnet neu); „1“ → 901 (heute 190). Mit dem Cursor am Anfang → 190.
 */
test.describe('55-2 Cursor im Zahlenfeld bleibt', () => {
  const { filterOeffnen } = require('./hilfen');
  for (const [lage, taste, erwartet] of [['am Ende', 'End', '901'], ['am Anfang', 'Home', '190']]) {
    test(`Messbasis 90, Cursor ${lage}, fremder Titel kommt live an, „1“ getippt → ${erwartet}`, async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/berichte/prognose');
      await filterOeffnen(page);
      const feld = page.getByLabel('Messbasis in Tagen');
      await expect(feld).toHaveValue('90');
      await feld.focus();
      await page.keyboard.press(taste);
      const renders = await page.evaluate(() => window.kdTest.renders());
      const antwort = await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'eins, von Claude geändert' } });
      expect(antwort.ok()).toBe(true);
      // das Live-Ereignis ist angekommen und gezeichnet (ADR-0026 Regel 4): neuer Titel im Stand, Stand gezeichnet, neu gezeichnet seit dem Fokus
      await page.waitForFunction(n => window.kdTest.titel(1) === 'eins, von Claude geändert' && window.kdTest.gezeichnet() && window.kdTest.renders() > n, renders);
      await expect(feld).toBeFocused();
      await page.keyboard.type('1');
      await expect(feld).toHaveValue(erwartet);
    });
  }
});

/** 55-3 Kleine Beschriftungen stimmen: (a) Ich-Menü, (b) „☑ Signale oben“, (c) unbekannter Eigentümer, (d) gesperrtes Tauschen, (e) Randbeschriftungen im kumulativen Fluss. */
test.describe('55-3 Kleine Beschriftungen', () => {
  const { execFileSync } = require('child_process');
  const fs = require('fs');
  const { mehrOeffnen } = require('./hilfen');
  /** Überdecken sich zwei Rechtecke? */
  const ueberdeckt = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  test('(a) die Überschrift des Ich-Menüs lautet „ICH BIN …“ ohne „people:“', async ({ page }) => {
    await starten(page);
    await page.locator('#t-ich').click();
    await expect(page.locator('#ich-titel')).toHaveText('ICH BIN …');
  });

  test('(b) „☑ Signale oben“: zwischen Haken und Wort steht sichtbarer Abstand (mindestens 4 px)', async ({ page }) => {
    await starten(page);
    await mehrOeffnen(page);
    await page.locator('#signale-oben').click();
    if (!await page.locator('#signale-oben').count()) await mehrOeffnen(page);
    const eintrag = page.locator('#signale-oben');
    await expect(eintrag).toHaveAttribute('aria-checked', 'true');
    const abstand = await eintrag.evaluate(e => {
      const haken = e.querySelector('.kz-auswahl-haken').getBoundingClientRect();
      const wort = [...e.childNodes].find(n => n.nodeType === 3 && n.textContent.includes('Signale oben'));
      const r = document.createRange(); r.selectNodeContents(wort);
      return r.getBoundingClientRect().left - haken.right;
    });
    expect(abstand).toBeGreaterThanOrEqual(4);
  });

  test('(c) unbekannter Eigentümer „chef“: die Auswahl zeigt „„chef“ (unbekannt)“ ganz oder nennt ihn als Hilfstext', async ({ page }) => {
    await starten(page, { ...GRUNDBESTAND(), 'boards/entwicklung.md': '---\ncolumn-owner:\n  In Arbeit: chef\n---\n\n' + GRUNDBESTAND()['boards/entwicklung.md'] });
    await ausMehr(page, 'Spalten einrichten');
    const wahl = page.getByLabel('Eigentümer In Arbeit');
    await expect(wahl).toHaveValue('roh');
    const voll = '„chef“ (unbekannt)';
    const passt = await wahl.evaluate(e => {
      const stil = getComputedStyle(e), c = document.createElement('canvas').getContext('2d');
      c.font = `${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
      // Platz für den Text: Inhaltsbreite ohne den Pfeil der Auswahl (rund 20 px)
      return c.measureText(e.options[e.selectedIndex].text).width <= e.clientWidth - parseFloat(stil.paddingLeft) - parseFloat(stil.paddingRight) - 20;
    });
    if (!passt) await expect(wahl, 'gekürzt — dann als Hilfstext').toHaveAttribute('title', voll);
  });

  test('(d) der gesperrte Knopf „⇄ Achsen tauschen“ nennt seinen Grund als Hilfstext', async ({ page }) => {
    await starten(page, { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## Erledigt\n',
      'aufgaben/0001-a.md': '---\nid: 1\ntitle: A1\nlabels: ["repo:shop"]\n---\n', 'aufgaben/0002-b.md': '---\nid: 2\ntitle: A2\nlabels: ["repo:lager"]\n---\n' });
    await page.goto(k.adresse + '#/berichte/bestand');
    const knopf = page.getByRole('button', { name: '⇄ Achsen tauschen' });
    await expect(knopf).toBeDisabled();
    await expect(knopf).toHaveAttribute('title', /Präfix/);
  });

  test('(e) kumulativer Fluss mit angekommen = fertig = 7: „angekommen 7“ und „fertig 7“ überdecken sich nicht', async ({ page }) => {
    const nummern = [1, 2, 3, 4, 5, 6, 7];
    k = await kanbanStarten(ordner => {
      const kopf = '---\nreport-filter: {period: eigen, from: 2026-11-01, to: 2026-11-03}\n---\n# Entwicklung\n\n## Zu erledigen\n\n';
      einrichten({ ...Object.fromEntries(nummern.map(n => [`aufgaben/000${n}-a.md`, `---\nid: ${n}\ntitle: A${n}\n---\n`])), 'boards/entwicklung.md': `${kopf}\n## Erledigt\n` })(ordner);
      const stand = (datum, inhalt) => { fs.writeFileSync(ordner + '/boards/entwicklung.md', inhalt); execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } }); };
      stand('2026-11-01T09:00:00', `${kopf}${nummern.map(n => `- #${n}\n`).join('')}\n## Erledigt\n`);
      stand('2026-11-02T09:00:00', `${kopf}\n## Erledigt\n\n${nummern.map(n => `- #${n}\n`).join('')}`);
    });
    await page.setViewportSize({ width: 1280, height: 900 });
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/fluss');
    const svg = page.getByRole('img', { name: 'Kumulativer Fluss: Bestand je Spalte je Tag' });
    await expect(svg.locator('text.randtext.a')).toHaveText('angekommen 7');
    await expect(svg.locator('text.randtext.f')).toHaveText('fertig 7');
    const [a, f] = await Promise.all([svg.locator('text.randtext.a').boundingBox(), svg.locator('text.randtext.f').boundingBox()]);
    expect(ueberdeckt(a, f), `angekommen ${JSON.stringify(a)} / fertig ${JSON.stringify(f)}`).toBe(false);
  });
});
