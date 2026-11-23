// R00244 Laufansicht — Farbcodes und Fehlerzustand im Satz lesbar (Karte #267, I0234, ADR-0041 N6) — AK 1–9 im echten Programm.
// Ausgangslage: Board `fabrik` aus laufansicht-hilfen.js; an #1 liegt T16, über die API abgelegt. Testfälle in Fachwörtern, darunter die
// Testsprache (Abschnitt „Sprache“), die als einzige Selektoren kennt.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, thema } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const t16 = require('./laufansicht-t16');

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const INSEL = '#lv-insel';
const STATUS = '#lv-status';
const adresse = (nr, kennung) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;
const ZEILENFELDER = ['.nm', '.bf', '.ab', '.eg', '.du'];

const sprache = (page, k) => ({
  async oeffnen() {
    await page.goto(k.adresse + adresse(1, t16.T16_KENNUNG));
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
  },
  async aufklappen(nr) {
    await page.locator(`#lv-s${nr} > details > summary`).click();
    await expect(page.locator(`#lv-s${nr} > details`)).toHaveAttribute('open', '');
  },
  /** Aufgelöster Wert eines Tokens als Farbe, gemessen an einem Probeelement in der Insel. */
  token: name => page.locator(INSEL).evaluate((el, n) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${n})`;
    el.appendChild(probe);
    const farbe = getComputedStyle(probe).color;
    probe.remove();
    return farbe;
  }, name),
  /** Farbe je vorhandenem Feld der Zeile, als `{feld: farbe}`. */
  zeilenfarben: nr => page.locator(`#lv-s${nr} > details > summary`).evaluate((s, felder) => Object.fromEntries(felder
    .map(f => [f, s.querySelector(`:scope > ${f}`)]).filter(([, el]) => el !== null).map(([f, el]) => [f, getComputedStyle(el).color])), ZEILENFELDER),
  /** Farbe des Ergebnistexts ohne Spanne (die `pre` des Ergebnisses). */
  ergebnisfarbe: nr => page.locator(`#lv-s${nr} .lv-erg > pre`).first().evaluate(el => getComputedStyle(el).color),
  aufrufWertfarbe: nr => page.locator(`#lv-s${nr} .lv-auf dd`).first().evaluate(el => getComputedStyle(el).color),
  shellfarbe: nr => page.locator(`#lv-s${nr} .lv-auf pre.lv-sh`).evaluate(el => getComputedStyle(el).color),
  /** Alle Farben im Schritt (Zeile und aufgeklappter Teil), je Element einmal; mit `ohneDiff` ohne die Zeilen des Diffs. */
  alleFarben: (nr, ohneDiff = false) => page.locator(`#lv-s${nr}`).evaluate((li, ohne) => [li, ...li.querySelectorAll('*')]
    .filter(el => !ohne || !el.closest('.lv-dif')).map(el => getComputedStyle(el).color), ohneDiff),
  schriftgroessen: nr => page.locator(`#lv-s${nr}`).evaluate(li => ['.lv-auf', '.lv-auf dd', '.lv-dif', '.lv-erg', '.lv-erg > pre']
    .map(s => [s, getComputedStyle(li.querySelector(s)).fontSize])),
});

test.describe('R00244 Laufansicht: Farbcodes und Fehlerzustand', () => {
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await lv.hochladen(k.adresse, 1, t16.T16_KENNUNG, 'Entwicklung', lv.gz(t16.T16.map(lv.zeile).join('')));
  });
  test.afterEach(() => k.stoppen());

  test('AK 8: Fehlerfarbe nur an Zeile und Ergebnis — Aufruf in Textfarbe, nichts in --kd-warn, Schriftgröße wie ohne Fehler', async () => {
    await s.oeffnen();
    for (const nr of [6, 4, 11]) await s.aufklappen(nr);
    const fehler = await s.token('--kd-status-error-ink'), text = await s.token('--kd-text'), warn = await s.token('--kd-warn');
    expect(fehler).not.toBe(text);
    for (const nr of [6, 4]) {
      const felder = await s.zeilenfarben(nr);
      expect(Object.keys(felder).length, `Felder der Zeile ${nr}`).toBeGreaterThanOrEqual(4);
      for (const [feld, farbe] of Object.entries(felder)) expect(farbe, `Zeile ${nr} ${feld}`).toBe(fehler);
      expect(await s.ergebnisfarbe(nr), `Ergebnis ${nr}`).toBe(fehler);
      expect(await s.alleFarben(nr), `kein --kd-warn in ${nr}`).not.toContain(warn);
    }
    expect(await s.aufrufWertfarbe(6), 'file_path im Aufruf').toBe(text);
    expect(await s.shellfarbe(4), 'Bash-Aufruf').toBe(text);
    expect(await s.alleFarben(11, true), 'ohne Fehler nichts rot außer dem „−“ des Diffs').not.toContain(fehler);
    expect(await s.schriftgroessen(6)).toEqual(await s.schriftgroessen(11));
  });
});
