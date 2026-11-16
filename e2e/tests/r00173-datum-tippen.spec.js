// E2E R00173 (I0163, F0141): ein Datum Taste für Taste in ein Datumsfeld tippen, das ohne Knopf speichert — „Zeitraum von“
// und „Zeitraum bis“ der Berichte, „Rechnen ab“ im Fever Chart, Fälligkeit im Aufgabenfenster. Getippt wird mit
// `keyboard.type`, nie mit `fill()`: nur so entsteht das Jahr Ziffer für Ziffer (0002, 0020, 0202, 2026).
// Die Abstände der Tasten sind Eingabe, keine Wartezeit; gewartet wird auf Feld, Datei und Commits (ADR-0026).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen } = require('./hilfen');

const HEUTE = '2026-11-16T12:00:00+01:00';
const BOARD = 'boards/entwicklung.md';
const AUFGABE = 'aufgaben/0001-eins.md';
const DATEIEN = {
  [BOARD]: '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  [AUFGABE]: '---\nid: 1\ntitle: eins\ncost-entries:\n  - {at: 2026-11-12 09:00+01:00, role: entwickler, column: In Arbeit, amount: 1.00, currency: USD}\n---\n',
};
const ABSTAENDE_MS = [0, 120, 900];
const JAHR_UNTER_1000 = /\b0\d{3}-\d\d-\d\d/;

/* ── Treiber: je Feld, wo es steht, wie es geöffnet wird und welche Zeile welcher Datei es speichert ── */
/** Die Ansicht eines Berichts ist nach dem Speichern wieder ruhig: der nachgeladene Stand ist gezeichnet. */
async function berichtRuhig(page) {
  await bereit(page);
  await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
}
const imBericht = (ansicht, name) => ({
  adresse: '#/berichte/' + ansicht,
  oeffnen: page => filterOeffnen(page),
  feld: page => page.getByRole('group', { name: 'Berichtsfilter' }).getByLabel(name, { exact: true }),
  ruhig: berichtRuhig,
});
const FELDER = {
  'Burndown · Zeitraum von': { ...imBericht('verlauf', 'Zeitraum von'), datei: BOARD, schluessel: 'from' },
  'Burndown · Zeitraum bis': { ...imBericht('verlauf', 'Zeitraum bis'), datei: BOARD, schluessel: 'to' },
  'Durchsatz · Zeitraum von': { ...imBericht('durchsatz', 'Zeitraum von'), datei: BOARD, schluessel: 'from' },
  'Durchsatz · Zeitraum bis': { ...imBericht('durchsatz', 'Zeitraum bis'), datei: BOARD, schluessel: 'to' },
  'Kosten · Zeitraum von': {
    adresse: '#/berichte/kosten',
    oeffnen: page => bereit(page, '#kosten'),
    feld: page => page.getByRole('group', { name: 'Zeitraum und Spaltenabschnitt' }).getByLabel('Zeitraum von', { exact: true }),
    datei: BOARD, schluessel: 'from', ruhig: berichtRuhig,
  },
  'Fever Chart · Rechnen ab': { ...imBericht('fieber', 'Rechnen ab'), datei: BOARD, schluessel: 'start' },
  'Aufgabenfenster · Fälligkeit': {
    adresse: '',
    oeffnen: async page => { await bereit(page, '.ka[data-id="1"]'); await page.locator('.ka[data-id="1"]').click(); },
    feld: page => page.getByRole('dialog').getByLabel('Fälligkeit', { exact: true }),
    datei: AUFGABE, schluessel: 'due',
    ruhig: page => expect(page.locator('.mod-fuss .gs')).toContainText('gespeichert'),
  },
};

test.describe('R00173 F0141: Datum tippen, ohne dass ein unfertiges Jahr gespeichert wird', () => {
  let k;
  test.afterEach(() => k.stoppen());

  /** Startet kanbanD mit dem Grundbestand (`kopf` ist der YAML-Kopf der Board-Datei) und öffnet die Stelle des Felds. */
  async function feldOeffnen(page, ort, kopf = '') {
    k = await kanbanStarten(einrichten({ ...DATEIEN, [BOARD]: kopf + DATEIEN[BOARD] }));
    await page.clock.setFixedTime(new Date(HEUTE));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + ort.adresse);
    await ort.oeffnen(page);
    await expect(ort.feld(page)).toBeVisible();
    return ort.feld(page);
  }
  /** Zahl der Commits, die die Zeile des Felds geändert haben. */
  const speicherungen = ort => k.git('log', '--format=%h', '-G', `\\b${ort.schluessel}:`, '--', ort.datei).split('\n').filter(Boolean).length;
  const gespeichert = (ort, tag) => new RegExp(`\\b${ort.schluessel}: ${tag}\\b`);
  async function tippen(page, feld, ziffern, abstand = 0) {
    await feld.focus();
    await page.keyboard.type(ziffern, { delay: abstand });
  }

  for (const [name, ort] of Object.entries(FELDER)) {
    for (const abstand of ABSTAENDE_MS) {
      test(`AK 1, AK 2, AK 9: „12112026“ getippt (Abstand ${abstand} ms) in ${name} → Feld 12.11.2026, Datei „${ort.schluessel}: 2026-11-12“, genau ein Speichern, kein Jahr unter 1000 im Verlauf`, async ({ page }) => {
        const feld = await feldOeffnen(page, ort);
        const vorher = speicherungen(ort);

        await tippen(page, feld, '12112026', abstand);

        await expect.poll(() => k.lies(ort.datei)).toMatch(gespeichert(ort, '2026-11-12'));
        await ort.ruhig(page);
        await expect(feld).toHaveValue('2026-11-12');
        expect(k.git('log', '-p')).not.toMatch(JAHR_UNTER_1000);
        expect(speicherungen(ort) - vorher).toBe(1);
      });
    }
  }

  /* ── Schaden a: ein richtig getipptes Datum wird gespeichert, auch über einem gespeicherten — genau einmal ── */
  const VON = FELDER['Durchsatz · Zeitraum von'];
  const mitVon = tag => `---\nreport-filter: {period: eigen, from: ${tag}}\n---\n`;

  for (const abstand of ABSTAENDE_MS) {
    test(`Schaden a: „12112026“ über das gespeicherte 05.10.2026 getippt (Abstand ${abstand} ms) → „from: 2026-11-12“, genau ein Speichern — kein Zwischenstand aus Tag oder Monat`, async ({ page }) => {
      const feld = await feldOeffnen(page, VON, mitVon('2026-10-05'));
      await expect(feld).toHaveValue('2026-10-05');
      const vorher = speicherungen(VON);

      await tippen(page, feld, '12112026', abstand);

      await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(VON, '2026-11-12'));
      await VON.ruhig(page);
      await expect(feld).toHaveValue('2026-11-12');
      expect(k.git('log', '-p')).not.toMatch(JAHR_UNTER_1000);
      expect(speicherungen(VON) - vorher).toBe(1);
    });
  }

  test('AK 5 (Schaden c): ein gespeichertes „from: 0002-11-12“ steht im Feld und wird durch „12112026“ überschrieben — genau ein Speichern', async ({ page }) => {
    const feld = await feldOeffnen(page, VON, mitVon('0002-11-12'));
    await expect(feld).toHaveValue('0002-11-12');
    const vorher = speicherungen(VON);

    await tippen(page, feld, '12112026', 120);

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(VON, '2026-11-12'));
    await VON.ruhig(page);
    await expect(feld).toHaveValue('2026-11-12');
    expect(speicherungen(VON) - vorher).toBe(1);
  });

  /* ── AK 3, US-2: unfertig verlassen ── */
  /** Verlässt das Feld. Tab allein täte es nicht: aus dem Jahr führt es auf den Kalenderknopf im selben Feld. */
  const verlassen = feld => feld.blur();
  for (const name of ['Durchsatz · Zeitraum von', 'Durchsatz · Zeitraum bis', 'Kosten · Zeitraum von', 'Fever Chart · Rechnen ab', 'Aufgabenfenster · Fälligkeit']) {
    const ort = FELDER[name];
    test(`AK 3: „12112“ getippt und ${name} verlassen → nichts gespeichert, das Feld ist wieder leer`, async ({ page }) => {
      const feld = await feldOeffnen(page, ort);
      const vorher = speicherungen(ort);

      await tippen(page, feld, '12112', 120);
      await expect(feld).toHaveValue('0002-11-12');
      await verlassen(feld);

      await expect(feld).toHaveValue('');
      await expect(feld).not.toBeFocused();
      expect(speicherungen(ort)).toBe(vorher);
      expect(k.git('log', '-p')).not.toMatch(JAHR_UNTER_1000);
    });
  }

  test('US-2: „Zeitraum von“ zeigt das gespeicherte 01.11.2026, „12112“ getippt und verlassen → das Feld zeigt wieder 01.11.2026, die Datei trägt weiter „from: 2026-11-01“, kein Commit', async ({ page }) => {
    const feld = await feldOeffnen(page, VON, mitVon('2026-11-01'));
    const kopfVorher = k.git('rev-parse', 'HEAD');

    await tippen(page, feld, '12112', 120);
    await expect(feld).toHaveValue('0002-11-12');
    await verlassen(feld);

    await expect(feld).toHaveValue('2026-11-01');
    await expect(feld).not.toBeFocused();
    expect(k.lies(BOARD)).toMatch(gespeichert(VON, '2026-11-01'));
    expect(k.git('rev-parse', 'HEAD')).toBe(kopfVorher);
  });

  for (const [verlassenMit, wie] of [[(page, feld) => verlassen(feld), 'das Feld verlassen'], [page => page.keyboard.press('Enter'), 'Enter gedrückt']]) {
    test(`Schaden a: nur der Tag „12“ über das gespeicherte 01.11.2026 getippt → noch nichts gespeichert; ${wie} → „from: 2026-11-12“, genau ein Speichern`, async ({ page }) => {
      const feld = await feldOeffnen(page, VON, mitVon('2026-11-01'));
      const vorher = speicherungen(VON);
      const gezeichnetVorher = await page.evaluate(() => window.kdTest.renders());

      await tippen(page, feld, '12', 120);
      await expect(feld).toHaveValue('2026-11-12');
      // gehalten heißt: weder gespeichert noch gezeichnet — die Eingabe steht im selben Feld, der Monat ist als Nächstes dran
      expect(await page.evaluate(() => window.kdTest.renders())).toBe(gezeichnetVorher);
      expect(speicherungen(VON)).toBe(vorher);
      await verlassenMit(page, feld);

      await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(VON, '2026-11-12'));
      await VON.ruhig(page);
      await expect(feld).toHaveValue('2026-11-12');
      expect(speicherungen(VON) - vorher).toBe(1);
    });
  }

  /* ── AK 4 (Schaden b): was nicht aus einer Ziffer kommt, speichert sofort wie vor der Karte ── */
  test('AK 4: Pfeil nach oben im Tag des gespeicherten 01.11.2026 → sofort „from: 2026-11-02“, ohne das Feld zu verlassen', async ({ page }) => {
    const feld = await feldOeffnen(page, VON, mitVon('2026-11-01'));
    const vorher = speicherungen(VON);

    await feld.focus();
    await page.keyboard.press('ArrowUp');

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(VON, '2026-11-02'));
    await VON.ruhig(page);
    await expect(feld).toHaveValue('2026-11-02');
    expect(speicherungen(VON) - vorher).toBe(1);
  });

  test('AK 4: die Rücktaste im Tag des gespeicherten 01.11.2026 leert das Datum → sofort ohne „from“ gespeichert', async ({ page }) => {
    const feld = await feldOeffnen(page, VON, mitVon('2026-11-01'));
    const vorher = speicherungen(VON);

    await feld.focus();
    await page.keyboard.press('Backspace');

    await expect.poll(() => k.lies(BOARD)).toMatch(/report-filter: \{period: eigen\}/);
    await VON.ruhig(page);
    await expect(feld).toHaveValue('');
    expect(speicherungen(VON) - vorher).toBe(1);
  });

  test('AK 4: fill() setzt das Datum in einem Zug → sofort „from: 2026-11-12“, genau ein Speichern', async ({ page }) => {
    const feld = await feldOeffnen(page, VON);
    const vorher = speicherungen(VON);

    await feld.fill('2026-11-12');

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichert(VON, '2026-11-12'));
    await VON.ruhig(page);
    await expect(feld).toHaveValue('2026-11-12');
    expect(speicherungen(VON) - vorher).toBe(1);
  });
});
