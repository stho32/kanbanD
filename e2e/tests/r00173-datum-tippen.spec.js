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
});
