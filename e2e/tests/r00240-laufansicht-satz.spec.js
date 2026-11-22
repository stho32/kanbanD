// R00240 Laufansicht — Einträge lesbar gesetzt: Aufruf abgesetzt, Ergebnis gekürzt, Marken (Karte #261, I0230, Scheibe C1 „Satz“) —
// AK 1–10 im echten Programm. Ausgangslage: Board `fabrik` aus laufansicht-hilfen.js; an #1 liegen T13 und T13b (T13 mit dem breiten
// Aufruf aus AK 10), an #2 T13f, alle über die API abgelegt. Testfälle in Fachwörtern, darunter die Testsprache (Abschnitt „Sprache“),
// die als einzige Selektoren kennt. Lage nur über getBoundingClientRect (Lehre #232).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, ansagenZaehlen, breiteSetzen, thema, kontrastVerstoesse, kontrastAm } = require('./hilfen');
const { perTabErreicht } = require('./ziele-hilfen');
const lv = require('./laufansicht-hilfen');
const t13 = require('./laufansicht-t13');

const T13B_KENNUNG = 'entwickler@2026-11-21T11:00+01:00';
const text = eintraege => eintraege.map(lv.zeile).join('');

async function ablegen(k) {
  await lv.hochladen(k.adresse, 1, t13.T13_KENNUNG, 'Entwicklung', lv.gz(text(t13.T13)));
  await lv.hochladen(k.adresse, 1, T13B_KENNUNG, 'Entwicklung', lv.gz(text([...t13.T13, ...t13.BREIT])));
  await lv.hochladen(k.adresse, 2, t13.T13F_KENNUNG, 'Entwicklung', lv.gz(text(t13.T13F)));
}

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const INSEL = '#lv-insel';
const STATUS = '#lv-status';
const ZEIGEN = '#lauf fieldset.lv-filt';
const LESETEXT_ELL = 'Von kanbanD gekürzt, vollständig im aufgeklappten Schritt';
const BLOECKE = ['.lv-auf', '.lv-kv', '.lv-dif', '.lv-tz', '.lv-cc', '.lv-mehr', '.lv-ein', '.lv-ell', '.lv-erg', 'pre'];
const ART = { Systemhinweise: 'h', 'nur Fehler': 'f' };
const adresse = (nr, kennung) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;

const sprache = (page, k) => ({
  async oeffnen(kennung = t13.T13_KENNUNG, nr = 1) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(k.adresse + adresse(nr, kennung));
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
  },
  zeile: nr => page.locator(`#lv-s${nr}`),
  zusammenfassung: nr => page.locator(`#lv-s${nr} > details > summary`),
  async aufklappen(nr) {
    await page.locator(`#lv-s${nr} > details > summary`).click();
    await expect(page.locator(`#lv-s${nr} > details`)).toHaveAttribute('open', '');
  },
  async alleAufklappen() {
    await page.locator(`${INSEL} details.lv-s, ${INSEL} details.lv-ein, ${INSEL} details.lv-mehr`).evaluateAll(ds => ds.forEach(d => { d.open = true; }));
  },
  aufruf: nr => page.locator(`#lv-s${nr} .lv-auf`),
  ergebnis: nr => page.locator(`#lv-s${nr} .lv-erg`),
  shellBlock: nr => page.locator(`#lv-s${nr} .lv-auf pre.lv-sh`).first(),
  /** Die Felder „Schlüssel: Wert“ des Aufrufs als Texte „<dt> <dd>“. */
  felder: nr => page.locator(`#lv-s${nr} .lv-auf > dl.lv-kv`).evaluateAll(dls => dls.flatMap(dl => [...dl.querySelectorAll(':scope > dt')].map(dt => `${dt.textContent} ${dt.nextElementSibling.textContent}`))),
  /** Offene Zeilen eines Blocks (ohne den eingeklappten Rest). */
  offeneZeilen: ort => ort.evaluate(el => {
    const offen = [...el.children].filter(c => !c.matches('details.lv-mehr, span.k, p'));
    return offen.map(c => (c.matches('.lv-dif') ? [...c.children].map(z => z.querySelector('.m').textContent.trim() + ' ' + z.querySelector('.c').textContent) : c.textContent.split('\n'))).flat();
  }),
  mehr: ort => ort.locator(':scope > details.lv-mehr > summary'),
  diffZeilen: nr => page.locator(`#lv-s${nr} .lv-dif > div`).evaluateAll(zs => zs.map(z => ({ art: z.className, m: z.querySelector('.m').textContent, lesetext: (z.querySelector('.vh') || { textContent: '' }).textContent, c: z.querySelector('.c').textContent }))),
  testzeile: nr => page.locator(`#lv-s${nr} .lv-erg > p.lv-tz`),
  marke: nr => page.locator(`#lv-s${nr} .lv-erg > p.lv-cc`),
  eingebettet: nr => page.locator(`#lv-s${nr} details.lv-ein`),
  kaestchen: name => page.locator(`${ZEIGEN} input[data-filter="${ART[name]}"]`),
  async markieren() { await page.locator(INSEL).evaluate(el => { el.__probe = 1; }); },
  markeSteht: () => page.locator(INSEL).evaluate(el => el.__probe === 1),
  sichtbar: ort => ort.evaluate(el => el.getBoundingClientRect().height > 0),
  fehlerImKopf: () => page.locator('#lauf .lv-kz > div:has(dt:text-is("Fehler erkannt")) dd'),
  laengste: () => page.locator('#lauf .lv-top li > button').evaluateAll(bs => bs.map(b => ({
    titel: (b.querySelector('.wt') || b.querySelector('.was')).textContent, befehl: (b.querySelector('.bf2') || { textContent: null }).textContent, dauer: b.querySelector('.d').textContent }))),
  /** Aufgelöster Wert eines Tokens als Farbe, gemessen an einem Probeelement in der Insel. */
  token: name => page.locator(INSEL).evaluate((el, n) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${n})`;
    el.appendChild(probe);
    const farbe = getComputedStyle(probe).color;
    probe.remove();
    return farbe;
  }, name),
  farbe: ort => ort.evaluate(el => getComputedStyle(el).color),
  /** Zustand „expanded“ des Knotens mit diesem Namen im Barrierefreiheitsbaum von Chromium: `ariaSnapshot()` von Playwright zeigt den
      Zustand eines nativen `summary` nicht, der Baum des Browsers schon (der Bildschirmleser liest ihn dort). */
  async aufgeklappt(name) {
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    await cdp.detach();
    const knoten = nodes.filter(n => n.name && n.name.value === name && (n.properties || []).some(p => p.name === 'expanded'));
    expect(knoten.length, `ein Knoten „${name}“ mit Zustand expanded`).toBe(1);
    return knoten[0].properties.find(p => p.name === 'expanded').value.value;
  },
  flaeche: ort => ort.evaluate(el => getComputedStyle(el).backgroundColor),
});

test.describe('R00240 Laufansicht: Satz der Einträge', () => {
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  test('AK 1 · US-1: Nr 2 — Block „Aufruf“ mit Fläche und Kante über „Ergebnis“, Shell-Block in drei Zeilen, timeout, ohne Absicht', async ({ page }) => {
    await s.oeffnen();
    await s.aufklappen(2);
    const aufruf = s.aufruf(2), ergebnis = s.ergebnis(2);
    const lage = await page.evaluate(() => {
      const a = document.querySelector('#lv-s2 .lv-auf'), e = document.querySelector('#lv-s2 .lv-erg');
      return { darueber: a.getBoundingClientRect().bottom <= e.getBoundingClientRect().top + 0.5, gleicheZeile: a.closest('li') === e.closest('li') };
    });
    expect(lage).toEqual({ darueber: true, gleicheZeile: true });
    expect(await s.flaeche(aufruf)).toBe(await s.token('--kd-sunken'));
    await expect(aufruf.locator(':scope > :first-child')).toHaveText('Aufruf');
    const shell = s.shellBlock(2);
    expect((await shell.textContent()).split('\n')).toEqual(['cd /w/demo &&', ' npm test;', ' echo "a && b" | grep \'x;y\' # Ende; z']);
    expect((await shell.textContent()).replace(/\n/g, '')).toBe(t13.BEFEHL_2);
    expect(await shell.evaluate(el => getComputedStyle(el).fontFamily)).toMatch(/mono/i);
    expect(await s.felder(2)).toEqual(['timeout: 120000']);
    await expect(aufruf).not.toContainText('Tests fahren');
    await expect(ergebnis.locator(':scope > :first-child')).toHaveText('Ergebnis');
    for (const dunkel of [false, true]) {
      await page.emulateMedia({ forcedColors: 'active', colorScheme: dunkel ? 'dark' : 'light' });
      await thema(page, dunkel ? 'dark' : 'light');
      await page.emulateMedia({ forcedColors: 'active' });
      const rand = await aufruf.evaluate(el => ({ links: getComputedStyle(el).borderLeftWidth, oben: getComputedStyle(el).borderTopWidth, stil: getComputedStyle(el).borderLeftStyle }));
      expect(rand).toEqual({ links: '3px', oben: '1px', stil: 'solid' });
      expect(await ergebnis.evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('0px');
    }
  });

  test('AK 2 · US-2: Kürzung „weitere n Zeilen“ bei Nr 15, Nr 3 und Nr 8 — Rest im DOM, Knopf bleibt, Insel bleibt, Tastatur', async ({ page }) => {
    await s.oeffnen();
    await s.markieren();
    expect(await page.locator(INSEL).evaluate(el => el.textContent.includes('Zeile 23'))).toBe(true);
    await s.aufklappen(15);
    const befehl = page.locator('#lv-s15 .lv-auf');
    expect(await s.offeneZeilen(befehl)).toEqual(['cat <<EOF > c.txt', ...Array.from({ length: 19 }, (_, i) => `l${i + 1}`)]);
    await expect(s.mehr(befehl)).toHaveText('1 weitere Zeile des Aufrufs');
    await expect(s.mehr(befehl)).toHaveAccessibleName('1 weitere Zeile des Aufrufs');
    await s.aufklappen(2);
    const erg = s.ergebnis(2);
    const offen = await s.offeneZeilen(erg);
    expect(offen.length).toBe(20);
    expect(offen.at(-1)).toBe('Zeile 20');
    await expect(s.mehr(erg)).toHaveAccessibleName('weitere 5 Zeilen des Ergebnisses');
    await s.aufklappen(8);
    const diff = page.locator('#lv-s8 .lv-auf');
    const diffOffen = await s.offeneZeilen(diff);
    expect(diffOffen.filter(z => z.startsWith('+')).length).toBe(20);
    expect(diffOffen.at(-1)).toBe('+ b20');
    await expect(s.mehr(diff)).toHaveAccessibleName('weitere 5 Zeilen der Änderung');
    for (const ort of [befehl, erg, diff]) expect(await ort.textContent()).not.toContain('…');
    const knopf = s.mehr(erg);
    await knopf.click();
    await expect(erg.locator(':scope > details.lv-mehr')).toHaveAttribute('open', '');
    await expect(erg).toContainText('Zeile 21');
    await expect(erg).toContainText('Ende');
    await expect(knopf).toBeVisible();
    await knopf.click();
    expect(await s.markeSteht()).toBe(true);
    // Tastatur: per Tab auf den Knopf, Enter klappt auf, Leertaste zu; Fokus, Status und Rollstand bleiben
    await page.locator('#lv-s2 > details > summary').focus();
    expect(await perTabErreicht(page, knopf)).toBeGreaterThan(0);
    const status = await page.locator(STATUS).textContent();
    const rollstand = await page.evaluate(() => scrollY);
    await page.keyboard.press('Enter');
    await expect(erg.locator(':scope > details.lv-mehr')).toHaveAttribute('open', '');
    expect(await knopf.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await s.aufgeklappt('weitere 5 Zeilen des Ergebnisses')).toBe(true);
    await page.keyboard.press(' ');
    await expect(erg.locator(':scope > details.lv-mehr')).not.toHaveAttribute('open', '');
    expect(await knopf.evaluate(el => el === document.activeElement)).toBe(true);
    expect(await s.aufgeklappt('weitere 5 Zeilen des Ergebnisses')).toBe(false);
    expect(await page.locator(STATUS).textContent()).toBe(status);
    expect(Math.abs((await page.evaluate(() => scrollY)) - rollstand)).toBeLessThanOrEqual(1);
    expect(await s.markeSteht()).toBe(true);
  });

  test('AK 3 · US-1: „Schlüssel: Wert“ bei Nr 10 und Nr 13, JSON von Nr 14 mit den Rollenfarben, Flächen aus den Tokens, hell und dunkel', async ({ page }) => {
    await s.oeffnen();
    await s.aufklappen(10);
    expect(await s.felder(10)).toEqual(['file_path: /w/demo/a.md', 'offset: 10', 'limit: 2']);
    // R00242 FA 4: das Pfadfeld von Read ist ab C2 ein Link nach VS Code an `offset`, sonst trägt die Zeile keinen
    await expect(s.zeile(10).locator('a')).toHaveCount(1);
    await expect(s.zeile(10).locator('a')).toHaveAttribute('href', 'vscode://file/w/demo/a.md:10');
    await s.aufklappen(13);
    expect(await s.felder(13)).toEqual(['query: stand']);
    const json = page.locator('#lv-s13 .lv-erg pre.lv-json');
    expect((await json.textContent()).split('\n')).toEqual(['{', '  "ok": true,', '  "n": 3,', '  "liste": [', '    1,', '    null', '  ],', '  "text": "a"', '}']);
    const rolle = t => json.locator(`span:text-is('${t}')`).first();
    expect(await rolle('"ok"').getAttribute('class')).toBe('tk-function');
    expect(await rolle('true').getAttribute('class')).toBe('tk-keyword');
    expect(await rolle('null').getAttribute('class')).toBe('tk-keyword');
    expect(await rolle('3').getAttribute('class')).toBe('tk-number');
    expect(await rolle('"a"').getAttribute('class')).toBe('tk-string');
    await s.aufklappen(2);
    await s.aufklappen(6);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      expect(await s.farbe(rolle('"ok"')), name).toBe(await s.token('--kd-tk-function'));
      expect(await s.farbe(rolle('true')), name).toBe(await s.token('--kd-tk-keyword'));
      expect(await s.farbe(rolle('3')), name).toBe(await s.token('--kd-tk-number'));
      expect(await s.farbe(rolle('"a"')), name).toBe(await s.token('--kd-tk-string'));
      expect(await s.flaeche(s.testzeile(2)), name).toBe(await s.token('--kd-status-error-bg'));
      expect(await s.flaeche(page.locator('#lv-s6 .lv-dif > .add')), name).toBe(await s.token('--kd-status-ok-bg'));
      expect(await s.flaeche(page.locator('#lv-s6 .lv-dif > .del')), name).toBe(await s.token('--kd-status-error-bg'));
    }
    const regeln = await page.evaluate(() => [...document.styleSheets].flatMap(b => [...b.cssRules]).map(r => r.cssText).filter(t => /\.lv-/.test(t)));
    // die alten Namen der Zeichnung, zusammengesetzt: R00222 AK 11 verlangt, dass kein Name im Repository mit dem alten Präfix beginnt
    const veraltet = new RegExp(`${['--kd', 'wbs-'].join('-')}|var\\(--tk-`);
    expect(regeln.filter(t => veraltet.test(t))).toEqual([]);
  });

  test('AK 4 · US-1: Edit Nr 6 als Diff mit Kontext, − und + mit Lesetext; Write Nr 8 nur „+“', async ({ page }) => {
    await s.oeffnen();
    await s.aufklappen(6);
    expect(await s.diffZeilen(6)).toEqual([
      { art: 'ctx', m: ' ', lesetext: '', c: 'x' },
      { art: 'del', m: '−', lesetext: 'entfernt: ', c: 'alt' },
      { art: 'add', m: '+', lesetext: 'hinzugefügt: ', c: 'neu' },
      { art: 'ctx', m: ' ', lesetext: '', c: 'y' },
    ]);
    expect(await page.locator('#lv-s6 .lv-dif').ariaSnapshot()).toMatch(/entfernt: alt[\s\S]*hinzugefügt: neu/);
    await s.aufklappen(8);
    const arten = (await s.diffZeilen(8)).map(z => z.m);
    expect(arten.length).toBe(25);
    expect(new Set(arten)).toEqual(new Set(['+']));
  });

  test('AK 5 · US-3: Testzeile von Nr 3 im Fehler-Ton über dem Ergebnis, Lesetext, Symbol aria-hidden, an ihrer Stelle unverändert', async ({ page }) => {
    await s.oeffnen();
    await s.aufklappen(2);
    const tz = s.testzeile(2);
    await expect(tz).toContainText('1 failed, 3 passed');
    expect(await tz.ariaSnapshot()).toContain('Tests fehlgeschlagen: 1 failed, 3 passed');
    await expect(tz.locator('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(await tz.evaluate(el => getComputedStyle(el).borderLeftWidth)).toBe('3px');
    expect(await s.farbe(tz.locator('span:not(.vh)'))).toBe(await s.token('--kd-status-error-ink'));
    const lage = await page.evaluate(() => {
      const t = document.querySelector('#lv-s2 .lv-tz'), pre = document.querySelector('#lv-s2 .lv-erg > pre');
      return t.getBoundingClientRect().bottom <= pre.getBoundingClientRect().top + 0.5;
    });
    expect(lage).toBe(true);
    await s.mehr(s.ergebnis(2)).click();
    const alle = (await page.locator('#lv-s2 .lv-erg > pre, #lv-s2 .lv-erg > details.lv-mehr > pre').allTextContents()).join('\n').split('\n');
    expect(alle[23]).toBe('1 failed, 3 passed');
  });

  test('AK 6 · US-3: Nr 5 — Kurzform in der Zusammenfassung, Marke wörtlich mit Pfad als Text, Fehlerform, Kopf „Fehler erkannt“ 1, Kontrast', async ({ page }) => {
    await s.oeffnen();
    const kurz = s.zusammenfassung(4);
    await expect(kurz).toContainText('Von Claude Code gekürzt');
    await expect(kurz).not.toContainText('69,9 KB');
    await expect(s.zeile(4)).not.toContainText('<persisted-output>');
    expect(await kurz.ariaSnapshot()).toContain('Von Claude Code gekürzt');
    await expect(kurz.locator('.lv-cck svg')).toHaveAttribute('aria-hidden', 'true');
    await expect(s.zeile(4)).toHaveAttribute('data-fehler', '');
    await expect(s.fehlerImKopf()).toHaveText('1');
    await s.aufklappen(4);
    await expect(s.marke(4)).toHaveText('Von Claude Code gekürzt (69,9 KB): Der Agent sah nur diese Vorschau. Vollständig: /tmp/demo/tool-results/b1.txt');
    // R00242 FA 5 (PO Z. 594): der Pfad der Marke ist ab C2 ein Link ohne Zeile
    await expect(s.marke(4).locator('a')).toHaveCount(1);
    await expect(s.marke(4).locator('a')).toHaveAttribute('href', 'vscode://file/tmp/demo/tool-results/b1.txt');
    expect((await page.locator('#lv-s4 .lv-erg > pre').textContent()).split('\n')).toEqual(['Exit code 1', 'fehlt: gross.log', '...']);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      expect(await kontrastAm(s.marke(4).locator(':scope > span')), name).toBeGreaterThanOrEqual(4.5);
      expect(await kontrastAm(kurz.locator('.lv-cck')), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('AK 7 · US-4: eingebettete Systemhinweise in Nr 7, Nr 11, Nr 12 folgen dem Filter „Systemhinweise“; die Insel bleibt', async ({ page }) => {
    await s.oeffnen();
    await s.markieren();
    await s.aufklappen(6);
    await s.aufklappen(10);
    // Vorgabe: „Systemhinweise“ aus
    for (const nr of [6, 10, 12]) expect(await s.sichtbar(s.eingebettet(nr).first()), `Nr ${nr}`).toBe(false);
    await expect(s.ergebnis(6)).toContainText('Datei geändert.');
    await expect(s.ergebnis(6)).toContainText('weiter');
    await expect(s.zeile(12)).toContainText('Bitte weiter.');
    expect(await s.sichtbar(s.zeile(10))).toBe(true);
    await expect(s.zusammenfassung(10).locator('.lv-syseg')).toHaveText('Systemhinweis');
    await expect(page.locator('#lv-s10 .lv-erg .lv-nurh')).toBeVisible();
    await expect(page.locator('#lv-s10 .lv-erg .lv-nurh')).toHaveText('Nur Systemhinweis, ausgeblendet (Filter „Systemhinweise“).');
    await s.kaestchen('Systemhinweise').click();
    await expect(s.kaestchen('Systemhinweise')).toBeChecked();
    await expect(s.eingebettet(6)).toBeVisible();
    await expect(page.locator('#lv-s10 .lv-erg .lv-nurh')).toBeHidden();
    await expect(s.eingebettet(10)).toBeVisible();
    const lage = await page.evaluate(() => {
      const erg = document.querySelector('#lv-s6 .lv-erg'), [vor, nach] = erg.querySelectorAll(':scope > pre'), h = erg.querySelector('.lv-ein');
      return { vor: vor.textContent, nach: nach.textContent, dazwischen: vor.getBoundingClientRect().bottom <= h.getBoundingClientRect().top + 0.5 && h.getBoundingClientRect().bottom <= nach.getBoundingClientRect().top + 0.5 };
    });
    expect(lage).toEqual({ vor: 'Datei geändert.', nach: 'weiter', dazwischen: true });
    await expect(s.eingebettet(6).locator('summary')).toContainText('Systemhinweis');
    await s.eingebettet(6).locator('summary').click();
    await expect(s.eingebettet(6)).toContainText('Nicht vergessen.');
    await expect(s.eingebettet(12)).toBeVisible();
    await s.eingebettet(12).locator('summary').click();
    await expect(s.eingebettet(12)).toContainText('Todo-Liste leer.');
    expect(await s.markeSteht()).toBe(true);
  });

  test('AK 7 · US-4: „nur Fehler“ an T13f — der eingebettete Hinweis folgt dem behaltenen Stand von „Systemhinweise“', async ({ page }) => {
    await s.oeffnen(t13.T13F_KENNUNG, 2);
    await s.aufklappen(1);
    await s.kaestchen('Systemhinweise').click();
    await s.kaestchen('nur Fehler').click();
    await expect(s.kaestchen('nur Fehler')).toBeChecked();
    await expect(s.eingebettet(1)).toBeVisible();
    await s.kaestchen('nur Fehler').click();
    await s.kaestchen('Systemhinweise').click();
    await s.kaestchen('nur Fehler').click();
    await expect(s.kaestchen('Systemhinweise')).not.toBeChecked();
    await expect(s.zeile(1)).toBeVisible();
    await expect(s.eingebettet(1)).toBeHidden();
    await expect(s.ergebnis(1)).toContainText('Exit code 1');
  });

  test('AK 8 · US-5: Nr 4 endet auf das gedämpfte „…“ von kanbanD; „Längste Schritte“ mit Absicht und Befehl', async ({ page }) => {
    await s.oeffnen();
    const ell = s.zusammenfassung(4).locator('.bf .lv-ell');
    await expect(ell).toHaveAttribute('title', LESETEXT_ELL);
    expect(await ell.textContent()).toBe(`…${LESETEXT_ELL}`);
    expect(await s.zusammenfassung(4).locator('.bf').evaluate(el => el.firstChild.textContent)).toBe('echo ' + 'a'.repeat(195));
    expect(await s.zusammenfassung(4).ariaSnapshot()).toContain(LESETEXT_ELL);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      expect(await s.farbe(ell), name).toBe(await s.token('--kd-muted'));
      expect(await kontrastAm(ell), name).toBeGreaterThanOrEqual(4.5);
    }
    expect(await s.laengste()).toEqual([
      { titel: 'Tests fahren', befehl: `Bash ${t13.BEFEHL_2}`, dauer: '40 s' },
      { titel: 'Protokoll lesen', befehl: `Bash echo ${'a'.repeat(195)}…${LESETEXT_ELL}`, dauer: '30 s' },
      { titel: 'Write /w/demo/b.txt', befehl: null, dauer: '20 s' },
    ]);
    expect(await s.farbe(page.locator('#lauf .lv-top .bf2').first())).toBe(await s.token('--kd-muted'));
  });

  test('AK 10 · US-1: bei 320, 641, 980, 1280 px, hell und dunkel kein Querscrollen, Kontrast, Ziele und Fokusring', async ({ page }) => {
    await s.oeffnen(T13B_KENNUNG);
    await s.kaestchen('Systemhinweise').click();
    await s.alleAufklappen();
    for (const breite of [320, 641, 980, 1280]) {
      await breiteSetzen(page, breite);
      for (const name of ['light', 'dark']) {
        await thema(page, name);
        const fall = `${breite} px ${name}`;
        const ueberlauf = await page.evaluate(bloecke => {
          const orte = [['Seite', document.documentElement], ['#lauf', document.getElementById('lauf')],
            ...bloecke.flatMap(b => [...document.querySelectorAll(`#lv-insel ${b}`)].map(el => [b, el]))];
          return orte.filter(([, el]) => el && el.getBoundingClientRect().height > 0)
            .filter(([, el]) => el.scrollWidth > el.clientWidth + 0.5 || ['hidden', 'scroll'].includes(getComputedStyle(el).overflowX))
            .map(([ort, el]) => `${ort} ${el.scrollWidth}>${el.clientWidth} ${getComputedStyle(el).overflowX}`);
        }, BLOECKE);
        expect(ueberlauf, fall).toEqual([]);
        expect(await kontrastVerstoesse(page, BLOECKE.map(b => `#lv-insel ${b}`)), fall).toEqual([]);
      }
    }
    const hoehe = await s.mehr(s.ergebnis(2)).evaluate(el => el.getBoundingClientRect().height);
    expect(hoehe).toBeGreaterThanOrEqual(24);
    for (const summary of [s.mehr(s.ergebnis(2)), s.eingebettet(6).locator('summary')]) {
      await summary.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ring = await summary.evaluate(el => ({ stil: getComputedStyle(el).outlineStyle, breite: parseFloat(getComputedStyle(el).outlineWidth), fokus: el.matches(':focus-visible') }));
      expect(ring.fokus).toBe(true);
      expect(ring.stil).not.toBe('none');
      expect(ring.breite).toBeGreaterThanOrEqual(2);
    }
    expect(await s.aufruf(2).ariaSnapshot()).toMatch(/^- text: "?Aufruf cd \/w\/demo/);
  });

  test('AK 10 · Ansage: „Systemhinweise“ an und ab — genau eine Ansage, mit der Zahl der eingebetteten Hinweise', async ({ page }) => {
    const ansagen = await ansagenZaehlen(page);
    await s.oeffnen();
    await ansagen.beginnen();
    await s.kaestchen('Systemhinweise').click();
    await expect(page.locator(STATUS)).toHaveText(/, 3 eingebettete Systemhinweise sichtbar\.$/);
    const an = (await ansagen.eintraege()).map(a => a.text);
    expect(an.length).toBe(1);
    expect(an[0]).toMatch(/^\d+ von \d+ Einträgen sichtbar, 3 eingebettete Systemhinweise sichtbar\.$/);
    await ansagen.beginnen();
    await s.kaestchen('Systemhinweise').click();
    await expect(page.locator(STATUS)).toHaveText(/, 3 eingebettete Systemhinweise ausgeblendet\.$/);
    expect((await ansagen.eintraege()).length).toBe(1);
  });
});

/* Nacharbeit 1, Muss 1 (Security-Review #261): tief verschachteltes JSON — Abnahme-Probe wörtlich. Je Variante ein eigener Lauf an #1. */
const TIEF = [
  ['Aufruf', 1500], ['Aufruf', 5000], ['Aufruf', 30000], ['Ergebnis', 1500], ['Ergebnis', 5000], ['Ergebnis', 12000], ['Kontrolle', 20],
];
const tiefeListe = n => '['.repeat(n) + ']'.repeat(n);
const tiefesObjekt = n => '{"a":'.repeat(n) + '1' + '}'.repeat(n);
const tiefKennung = i => `entwickler@2026-11-21T1${i}:30+01:00`;

function tieferLauf(variante, n) {
  let aufruf = tiefeListe(n), ergebnis = tiefesObjekt(n);
  if (variante === 'Aufruf') ergebnis = 'ok';
  if (variante === 'Ergebnis') aufruf = '{"command":"pwd"}';
  return [
    { zeit: '2026-11-21T09:00:00+01:00', art: 'nachricht', wer: 'mensch', text: 'Auftrag' },
    { zeit: '2026-11-21T09:00:01+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: aufruf },
    { zeit: '2026-11-21T09:00:02+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' },
    { zeit: '2026-11-21T09:00:03+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"ls"}' },
    { zeit: '2026-11-21T09:00:04+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', text: ergebnis },
    { zeit: '2026-11-21T09:00:05+01:00', art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' },
  ];
}

test.describe('R00240 Laufansicht: tief verschachteltes JSON (Nacharbeit 1, Muss 1)', () => {
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    for (const [i, [variante, n]] of TIEF.entries()) await lv.hochladen(k.adresse, 1, tiefKennung(i), 'Entwicklung', lv.gz(text(tieferLauf(variante, n))));
  });
  test.afterEach(() => k.stoppen());

  test('Aufruf [×N]×N und Ergebnis {"a":×N 1}×N: alle Einträge und „Ende des Transkripts“, der tiefe Wert als pre, je Eintrag unter 1 MB', async ({ page }) => {
    for (const [i, [variante, n]] of TIEF.entries()) {
      await s.oeffnen(tiefKennung(i));
      const eintraege = page.locator(`${INSEL} li`);
      await expect(eintraege, `${variante} ${n}`).toHaveCount(5);
      await expect(eintraege.last()).toHaveText('Ende des Transkripts');
      await s.alleAufklappen();
      const groessen = await eintraege.evaluateAll(lis => lis.map(li => li.outerHTML.length));
      expect(Math.max(...groessen), `${variante} ${n}: größter Eintrag`).toBeLessThan(1000000);
      let aufrufForm = 'pre.lv-json', ergebnisForm = 'pre.lv-json';
      if (variante !== 'Kontrolle') { aufrufForm = 'pre:not(.lv-json)'; ergebnisForm = 'pre:not(.lv-json)'; }
      if (variante === 'Aufruf') await expect(s.aufruf(2).locator(`:scope > ${aufrufForm}`), `${variante} ${n}`).toHaveCount(1);
      if (variante === 'Ergebnis') await expect(s.ergebnis(4).locator(`:scope > ${ergebnisForm}`), `${variante} ${n}`).toHaveCount(1);
      if (variante === 'Kontrolle') {
        await expect(s.aufruf(2).locator(`:scope > ${aufrufForm}`)).toHaveCount(1);
        await expect(s.ergebnis(4).locator(`:scope > ${ergebnisForm}`)).toHaveCount(1);
      }
    }
  });
});

test.describe('R00240 Laufansicht: Satz bei grobem Zeiger', () => {
  test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  test('AK 10: der Knopf „weitere n Zeilen“ misst bei grobem Zeiger mindestens 48 px', async ({ page }) => {
    await s.oeffnen();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await s.alleAufklappen();
    const hoehen = await page.locator(`${INSEL} details.lv-mehr > summary`).evaluateAll(ks => ks.map(el => el.getBoundingClientRect().height));
    expect(hoehen.length).toBeGreaterThan(0);
    for (const h of hoehen) expect(h).toBeGreaterThanOrEqual(48);
  });
});
