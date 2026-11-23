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
  async oeffnen(kennung = t16.T16_KENNUNG, nr = 1) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(k.adresse + adresse(nr, kennung));
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
  /** Die übersetzten Spannen im Ergebnis als `[Klasse, Text]`. */
  spannen: nr => page.locator(`#lv-s${nr} .lv-erg span[class^="sgr"]`).evaluateAll(sp => sp.map(el => [el.className, el.textContent])),
  spannenOrte: nr => page.locator(`#lv-s${nr} .lv-erg span[class^="sgr"]`),
  spannenZahl: nr => page.locator(`#lv-s${nr} .lv-erg span[class^="sgr"]`).count(),
  /** Farbe und Wirkung je Spanne: nur Schriftfarbe und Gewicht dürfen sich ändern. */
  spannenWirkung: nr => page.locator(`#lv-s${nr} .lv-erg span[class^="sgr"]`).evaluateAll(sp => sp.map(el => {
    const st = getComputedStyle(el);
    return { klasse: el.className, farbe: st.color, gewicht: st.fontWeight, flaeche: st.backgroundColor, deckkraft: st.opacity, display: st.display };
  })),
  stilAttribute: nr => page.locator(`#lv-s${nr} .lv-erg [style]`).count(),
  marken: ort => ort.locator('.mk-z').count(),
  ergebnis: nr => page.locator(`#lv-s${nr} .lv-erg`),
  aufruf: nr => page.locator(`#lv-s${nr} .lv-auf`),
  ergebnisText: nr => page.locator(`#lv-s${nr} .lv-erg`).evaluate(el => [...el.querySelectorAll(':scope > pre, :scope > .lv-mehr > pre')].map(p => p.textContent).join('\n')),
  kurzform: nr => page.locator(`#lv-s${nr} > details > summary > .eg`),
  nachricht: nr => page.locator(`#lv-s${nr} .lv-text`),
  restZusammenfassung: nr => page.locator(`#lv-s${nr} .lv-erg .mk-rest`),
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

  /** Text des Ergebnisses, wie er stehen soll: ohne die erlaubten Folgen, jedes andere `ESC` als Text der Marke. */
  const gelesen = text => text.replace(/\u001b\[(?:22|0|2|31|32)?m/g, '').replace(/\u001b/g, '␛ U+001B');

  test('AK 1 · US-1, US-2: Call log gedämpft ohne Kästchen, ESC(B bleibt Marke; rustfmt rot und grün, 0 Marken', async () => {
    await s.oeffnen();
    for (const nr of [2, 4]) await s.aufklappen(nr);
    expect(await s.spannen(2)).toEqual([['sgr2', "  - waiting for getByRole('button', { name: 'Speichern' })"], ['sgr2', '  - locator resolved to <button>']]);
    expect(await s.marken(s.ergebnis(2))).toBe(1);
    expect(await s.ergebnisText(2)).toBe(gelesen(t16.ERGEBNIS_3));
    expect(await s.spannen(4)).toEqual([['sgr31', '-    let x=1;'], ['sgr32', '+    let x = 1;']]);
    expect(await s.marken(s.ergebnis(4))).toBe(0);
    expect(await s.ergebnisText(4)).toBe(gelesen(t16.ERGEBNIS_5));
    const farben = Object.fromEntries((await s.spannenWirkung(4)).map(w => [w.klasse, w.farbe]));
    expect(farben).toEqual({ sgr31: await s.token('--kd-status-error-ink'), sgr32: await s.token('--kd-status-ok-ink') });
    expect((await s.spannenWirkung(2)).map(w => w.farbe)).toEqual(Array(2).fill(await s.token('--kd-muted')));
  });

  test('AK 2 · US-2: Zustand je Ergebnis, nur feste Wirkung — kein style, keine Fläche, Deckkraft oder display; Nr 12 in Grundschrift', async () => {
    await s.oeffnen();
    for (const nr of [4, 11, 18]) await s.aufklappen(nr);
    expect(await s.spannenZahl(11)).toBe(0);
    expect(await s.ergebnisfarbe(11)).toBe(await s.token('--kd-text'));
    const fett = await s.spannenWirkung(18);
    expect(fett.map(w => w.klasse)).toEqual(['sgr2', 'sgr31', 'sgr32', 'sgr33', 'sgr1', 'sgr1 sgr31']);
    expect(fett.map(w => w.farbe)).toEqual([await s.token('--kd-muted'), await s.token('--kd-status-error-ink'), await s.token('--kd-status-ok-ink'),
      await s.token('--kd-status-warn-ink'), await s.token('--kd-text'), await s.token('--kd-status-error-ink')]);
    expect(fett.map(w => Number(w.gewicht) >= 600)).toEqual([false, false, false, false, true, true]);
    for (const nr of [4, 18]) {
      expect(await s.stilAttribute(nr)).toBe(0);
      for (const w of await s.spannenWirkung(nr)) expect([w.flaeche, w.deckkraft, w.display], w.klasse).toEqual(['rgba(0, 0, 0, 0)', '1', 'inline']);
    }
  });

  test('AK 3 · US-3: verbotene Folgen bleiben Marke mit lesbarem Text; Aufruf, Nachricht und Kurzform übersetzen nie', async () => {
    await s.oeffnen();
    for (const nr of [13, 16]) await s.aufklappen(nr);
    expect(await s.spannenZahl(13)).toBe(0);
    expect(await s.marken(s.ergebnis(13))).toBe(4);
    expect(await s.ergebnisText(13)).toBe(gelesen(t16.ERGEBNIS_14));
    expect(await s.ergebnisfarbe(13)).toBe(await s.token('--kd-text'));
    for (const wort of ['geheim', 'umgekehrt', 'schwarz', 'rot']) await expect(s.ergebnis(13).getByText(wort)).toBeVisible();
    expect(await s.marken(s.aufruf(13))).toBe(2);
    await expect(s.nachricht(15)).toHaveText('␛ U+001B[31mfertig␛ U+001B[0m');
    await expect(s.kurzform(16)).toContainText('␛ U+001B[32mgruen␛ U+001B[0m fertig');
    expect(await s.spannen(16)).toEqual([['sgr32', 'gruen']]);
  });

  test('AK 4 · US-6: Flut — 1.200 gedämpft ohne Marke, 1.200 verbotene im Budget, 3.000 rote ohne Übersetzung, 3 MiB ohne Spanne, bedienbar', async ({ page }) => {
    await lv.hochladen(k.adresse, 2, t16.T16_FLUT_KENNUNG, 'Entwicklung', lv.gz(t16.T16_FLUT.map(lv.zeile).join('')));
    await s.oeffnen(t16.T16_FLUT_KENNUNG, 2);
    for (const nr of [1, 3, 5, 7]) await s.aufklappen(nr);
    expect(await s.spannenZahl(1)).toBe(1200);
    expect(await s.marken(s.ergebnis(1))).toBe(0);
    await expect(s.restZusammenfassung(1)).toHaveCount(0);
    expect(await s.marken(s.ergebnis(3))).toBe(1000);
    await expect(s.restZusammenfassung(3)).toHaveText('… und 200 weitere Steuerzeichen');
    expect(await s.spannenZahl(5)).toBeLessThanOrEqual(2000);
    expect(await s.marken(s.ergebnis(5))).toBe(1000);
    await expect(s.restZusammenfassung(5)).toHaveText('… und 5.000 weitere Steuerzeichen');
    expect(await s.spannenZahl(7)).toBe(0);
    expect(await s.marken(s.ergebnis(7))).toBe(0);
    await page.locator('#lv-s1 > details > summary').click();
    await expect(page.locator('#lv-s1 > details')).not.toHaveAttribute('open', '');
  });

  test('AK 6 · US-5: jede Spanne mit mindestens 4,5 : 1 in hell und dunkel, gedämpft mindestens 5,9 bzw. 7,8', async ({ page }) => {
    await s.oeffnen();
    for (const nr of [2, 4, 18]) await s.aufklappen(nr);
    for (const [name, gedaempftMindestens] of [['light', 5.9], ['dark', 7.8]]) {
      await thema(page, name);
      for (const nr of [2, 4, 18]) {
        for (const spanne of await s.spannenOrte(nr).all()) {
          const klasse = await spanne.getAttribute('class');
          let mindestens = 4.5;
          if (klasse === 'sgr2') mindestens = gedaempftMindestens;
          expect(await kontrastAm(spanne), `${name} Nr ${nr} ${klasse}`).toBeGreaterThanOrEqual(mindestens);
        }
      }
    }
  });

  test('AK 8: Spannen aus der Übersetzung behalten im Fehlschritt ihre eigene Farbe', async () => {
    await s.oeffnen();
    for (const nr of [2, 4]) await s.aufklappen(nr);
    expect((await s.spannenWirkung(2)).map(w => w.farbe)).toEqual(Array(2).fill(await s.token('--kd-muted')));
    expect((await s.spannenWirkung(4)).find(w => w.klasse === 'sgr32').farbe).toBe(await s.token('--kd-status-ok-ink'));
  });

  test('AK 9: Fehlerzustand ohne Farbe — Dreieck und „Fehler:“ in der Zeile, Satz, + und −, Text der Spannen vollständig', async ({ page }) => {
    await page.emulateMedia({ forcedColors: 'active' });
    await s.oeffnen();
    for (const nr of [2, 4, 6]) await s.aufklappen(nr);
    for (const nr of [4, 6]) {
      await expect(s.kurzform(nr).locator('svg path[d="M12 3l10 18H2z"]')).toHaveCount(1);
      expect(await s.kurzform(nr).evaluate(eg => eg.querySelector('.vh').textContent)).toBe('Fehler: ');
      expect(await s.kurzform(nr).evaluate(eg => eg.textContent.startsWith('Fehler: '))).toBe(true);
    }
    await expect(s.satzNichtAngewendet(6)).toBeVisible();
    expect((await s.diffZeilen(6)).map(z => z.m)).toEqual(['−', '+']);
    expect(await s.ergebnisText(2)).toBe(gelesen(t16.ERGEBNIS_3));
    expect(await s.ergebnisText(4)).toBe(gelesen(t16.ERGEBNIS_5));
  });
});
