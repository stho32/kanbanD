// R00244 Laufansicht — Farbcodes und Fehlerzustand im Satz lesbar (Karte #267, I0234, ADR-0041 N6) — AK 1–9 im echten Programm.
// Ausgangslage: Board `fabrik` aus laufansicht-hilfen.js; an #1 liegt T16, über die API abgelegt. Testfälle in Fachwörtern, darunter die
// Testsprache (Abschnitt „Sprache“), die als einzige Selektoren kennt.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, thema, kontrastAm } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const t16 = require('./laufansicht-t16');

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const INSEL = '#lv-insel';
const STATUS = '#lv-status';
const adresse = (nr, kennung) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;
const ZEILENFELDER = ['.nm', '.bf', '.ab', '.eg', '.du'];
const SATZ_NICHT_ANGEWENDET = 'Nicht angewendet — der Schritt ist fehlgeschlagen.';
const KEIN_ERGEBNIS = 'Kein Ergebnis im Transkript.';

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
  /** Aufgelöster Wert eines Tokens als Hintergrund. */
  flaecheToken: name => page.locator(INSEL).evaluate((el, n) => {
    const probe = document.createElement('i');
    probe.style.backgroundColor = `var(${n})`;
    el.appendChild(probe);
    const farbe = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return farbe;
  }, name),
  farbe: ort => ort.evaluate(el => getComputedStyle(el).color),
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
  satzNichtAngewendet: nr => page.locator(`#lv-s${nr} .lv-auf p.lv-na`),
  keinErgebnis: nr => page.locator(`#lv-s${nr} .lv-s-ganz > p.lv-gedaempft`),
  /** Lage, Attribute und Klasse des Satzes zum Diff im Aufruf. */
  satzVorDemDiff: nr => page.locator(`#lv-s${nr} .lv-auf`).evaluate(a => {
    const p = a.querySelector('p.lv-na'), d = a.querySelector('.lv-dif');
    return { davor: Boolean(p.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING), ariaHidden: p.hasAttribute('aria-hidden'), role: p.hasAttribute('role'), klasse: d.className };
  }),
  diffKlasse: nr => page.locator(`#lv-s${nr} .lv-dif`).first().evaluate(d => d.className),
  /** Je Zeile des Diffs: Art, Zeichen, Lesetext, Fläche und Farbe des Texts. */
  diffZeilen: nr => page.locator(`#lv-s${nr} .lv-dif > div`).evaluateAll(zs => zs.map(z => ({ art: z.className, m: z.querySelector('.m').textContent,
    lesetext: (z.querySelector('.vh') || { textContent: '' }).textContent, flaeche: getComputedStyle(z).backgroundColor, farbe: getComputedStyle(z.querySelector('.c')).color }))),
  diffTeile: nr => page.locator(`#lv-s${nr} .lv-dif > div > .c, #lv-s${nr} .lv-dif > div > .m`),
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
    expect(await s.farbe(s.satzNichtAngewendet(6)), 'Satz „Nicht angewendet“').toBe(text);
    for (const z of await s.diffZeilen(6)) expect(z.farbe, `Diff ${z.art}`).toBe(await s.token('--kd-muted'));
    expect(await s.alleFarben(11, true), 'ohne Fehler nichts rot außer dem „−“ des Diffs').not.toContain(fehler);
    expect(await s.schriftgroessen(6)).toEqual(await s.schriftgroessen(11));
  });

  test('AK 7 · US-4: Edit und Write „nicht angewendet“ — Satz über gedämpftem Diff ohne Fläche, Lesetext „vorgesehen …“, Kontrast', async ({ page }) => {
    await s.oeffnen();
    for (const nr of [6, 8, 10, 11]) await s.aufklappen(nr);
    const gedaempft = await s.token('--kd-muted'), ohneFlaeche = 'rgba(0, 0, 0, 0)';
    for (const nr of [6, 8]) {
      await expect(s.satzNichtAngewendet(nr)).toHaveText(SATZ_NICHT_ANGEWENDET);
      await expect(s.satzNichtAngewendet(nr)).toBeVisible();
      expect(await s.satzVorDemDiff(nr)).toEqual({ davor: true, ariaHidden: false, role: false, klasse: 'lv-dif nicht-angewendet' });
    }
    expect(await s.diffZeilen(6)).toEqual([
      { art: 'del', m: '−', lesetext: 'vorgesehen zu entfernen: ', flaeche: ohneFlaeche, farbe: gedaempft },
      { art: 'add', m: '+', lesetext: 'vorgesehen hinzuzufügen: ', flaeche: ohneFlaeche, farbe: gedaempft },
    ]);
    expect(await s.diffZeilen(8)).toEqual([{ art: 'add', m: '+', lesetext: 'vorgesehen hinzuzufügen: ', flaeche: ohneFlaeche, farbe: gedaempft }]);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      for (const nr of [6, 8]) {
        for (const teil of await s.diffTeile(nr).all()) expect(await kontrastAm(teil), `${name} Nr ${nr}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    await expect(s.satzNichtAngewendet(10)).toHaveCount(0);
    await expect(s.keinErgebnis(10)).toHaveText(KEIN_ERGEBNIS);
    expect(await s.diffKlasse(10)).toBe('lv-dif');
    await expect(s.satzNichtAngewendet(11)).toHaveCount(0);
    const erfolg = await s.diffZeilen(11);
    expect(erfolg.map(z => [z.art, z.lesetext, z.flaeche])).toEqual([
      ['del', 'entfernt: ', await s.flaecheToken('--kd-status-error-bg')], ['add', 'hinzugefügt: ', await s.flaecheToken('--kd-status-ok-bg')]]);
  });
});
