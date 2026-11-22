// R00242 Laufansicht — Pfade als Links und kurze Pfad-Marken (Karte #264, I0232, Scheibe C2 „Pfade“) — AK 2–5, 7, 8 und US-1..US-5 im
// echten Programm. Ausgangslage: Board `fabrik` aus laufansicht-hilfen.js; an #1 liegt T14 (dazu T14l mit den langen Pfaden aus AK 8),
// an #2 T14o, alle über die API abgelegt. Testfälle in Fachwörtern, darunter die Testsprache (Abschnitt „Sprache“), die als einzige
// Selektoren kennt. VS Code wird nie geöffnet: geprüft wird das Ziel des Links.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastVerstoesse, kontrastFarben } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const t14 = require('./laufansicht-t14');

const T14L_KENNUNG = 'planer@2026-11-22T12:00+01:00';
const text = eintraege => eintraege.map(lv.zeile).join('');

async function ablegen(k) {
  await lv.hochladen(k.adresse, 1, t14.T14_KENNUNG, 'Detailplanung', lv.gz(text(t14.T14)));
  await lv.hochladen(k.adresse, 1, T14L_KENNUNG, 'Detailplanung', lv.gz(text([...t14.T14, ...t14.LANG])));
  await lv.hochladen(k.adresse, 2, t14.T14O_KENNUNG, 'Detailplanung', lv.gz(text(t14.T14O)));
}

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const INSEL = '#lv-insel';
const STATUS = '#lv-status';
const adresse = (nr, kennung) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;
const BLOECKE = ['.lv-auf', '.lv-kv', '.lv-erg', '.lv-cc', '.lv-text', '.lv-text p', 'pre', '.lv-pfad', '.lv-mk'];

/** Im Browser: der sichtbare Text eines Elements — eine Marke zeigt ihr `data-marke`, ihr verborgener Anfang zählt nicht. */
function sichtbarerText(el) {
  let aus = '';
  const gehen = knoten => {
    if (knoten.nodeType === Node.TEXT_NODE) { aus += knoten.data; return; }
    if (knoten.nodeType !== Node.ELEMENT_NODE) return;
    if (knoten.classList.contains('lv-mk')) { aus += knoten.dataset.marke; return; }
    if (knoten.classList.contains('lv-anf') || knoten.classList.contains('vh')) return;
    knoten.childNodes.forEach(gehen);
  };
  gehen(el);
  return aus;
}

const sprache = (page, k) => ({
  async oeffnen(kennung = t14.T14_KENNUNG, nr = 1) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(k.adresse + adresse(nr, kennung));
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
  },
  async aufklappen(nr) {
    await page.locator(`#lv-s${nr} > details > summary`).click();
    await expect(page.locator(`#lv-s${nr} > details`)).toHaveAttribute('open', '');
  },
  async alleAufklappen() {
    await page.locator(`${INSEL} details`).evaluateAll(ds => ds.forEach(d => { d.open = true; }));
  },
  zeile: nr => page.locator(`#lv-s${nr}`),
  aufruf: nr => page.locator(`#lv-s${nr} .lv-auf`),
  ergebnis: nr => page.locator(`#lv-s${nr} .lv-erg`),
  zusammenfassung: nr => page.locator(`#lv-s${nr} > details > summary`),
  befehlKurz: nr => page.locator(`#lv-s${nr} > details > summary .bf`),
  text: nr => page.locator(`#lv-s${nr} .lv-text`),
  links: ort => ort.locator('a'),
  pfadLink: nr => page.locator(`#lv-s${nr} .lv-auf a.lv-pfad`),
  ziele: ort => ort.locator('a').evaluateAll(as => as.map(a => a.getAttribute('href'))),
  sichtbar: ort => ort.evaluate(sichtbarerText),
  marken: ort => ort.locator('.lv-mk'),
  async markierenUndKopieren(ort) {
    return ort.evaluate(el => {
      const bereich = document.createRange();
      bereich.selectNodeContents(el);
      getSelection().removeAllRanges();
      getSelection().addRange(bereich);
      return getSelection().toString();
    });
  },
  async einfuegenInFeld() {
    await page.evaluate(() => {
      const feld = document.createElement('textarea');
      feld.id = 'probe-feld';
      document.body.appendChild(feld);
    });
    await page.locator('#probe-feld').focus();
    await page.keyboard.press('Control+V');
    return page.locator('#probe-feld').inputValue();
  },
  vorStil: ort => ort.evaluate(el => {
    const s = getComputedStyle(el, '::before');
    return { content: s.content, farbe: s.color, grund: s.backgroundColor, linie: s.textDecorationLine };
  }),
  /** `ariaSnapshot()` eines Links: Playwright 1.65 hängt an die Zeile mit dem Namen das Kind `/url:` und bei `<code>` im Link `code:`. */
  async linkImBaum(link) {
    const [name, url, ...rest] = (await link.ariaSnapshot()).split('\n');
    const baum = { name: name.replace(/:$/, ''), url: url.replace(/^\s+- \/url: /, '') };
    if (rest.length) baum.code = rest.map(z => z.replace(/^\s+- code: /, ''));
    return baum;
  },
  anfangBreite: ort => ort.locator('.lv-mk > .vh, .lv-anf > .vh').first().evaluate(el => el.getBoundingClientRect().width),
});

test.describe('R00242 Laufansicht: Pfade als Links und kurze Pfad-Marken', () => {
  let k, s;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  test('AK 2 · US-1: Auftrag Nr 1 zeigt „Projekt: ‹demo›“; Befehl und Zusammenfassung von Nr 8 mit Marken ohne Link, title voller Pfad', async () => {
    await s.oeffnen();
    await s.aufklappen(1);
    const auftrag = await s.sichtbar(s.text(1));
    expect(auftrag.split('\n')[0].startsWith('Projekt: ‹demo›  ·  Factory: /w/fab')).toBe(true);
    expect(auftrag).toContain('Arbeitsort: Worktree ‹Worktree #7›, Zweig karte/7.');
    expect(auftrag).toContain('Ablage: ‹Ablage›/ (nur dieser Ordner)');
    await s.aufklappen(8);
    expect(await s.sichtbar(s.aufruf(8).locator('pre'))).toBe('cat ‹demo›/README.md &&\n ls ‹Worktree #7›/web');
    await expect(s.links(s.aufruf(8))).toHaveCount(0);
    const readme = s.aufruf(8).locator('[title="/w/demo/README.md"]');
    await expect(readme).toHaveCount(1);
    expect(await s.sichtbar(s.befehlKurz(8))).toBe('cat ‹demo›/README.md && ls ‹Worktree #7›/web');
    await expect(s.links(s.zusammenfassung(8))).toHaveCount(0);
  });

  test('AK 2 · US-2: Read Nr 2 — Marke mit vollem Pfad in title, Name, textContent, Auswahl und echter Kopie', async ({ page }) => {
    await s.oeffnen();
    await s.aufklappen(2);
    const link = s.pfadLink(2);
    expect(await s.sichtbar(link)).toBe('‹Worktree #7›/web/a.js');
    await expect(link).toHaveAttribute('title', '/w/wt/demo/karte-7/web/a.js:10');
    await expect(link).toHaveAccessibleName('/w/wt/demo/karte-7/web/a.js:10');
    expect(await link.textContent()).toBe('/w/wt/demo/karte-7/web/a.js');
    expect(await s.markierenUndKopieren(link)).toBe('/w/wt/demo/karte-7/web/a.js');
    await page.keyboard.press('Control+C');
    expect(await s.einfuegenInFeld()).toBe('/w/wt/demo/karte-7/web/a.js');
  });

  test('AK 2: Write Nr 6 und web/a.js in Nr 16 — ariaSnapshot genau der volle Pfad, innerText ohne Umbruch, Anfang 0 px', async () => {
    await s.oeffnen();
    await s.aufklappen(6);
    const write = s.pfadLink(6);
    await expect(write).toHaveAttribute('title', '/w/fab/ablage/plan-7/notiz.md');
    expect(await s.linkImBaum(write)).toEqual({ name: '- link "/w/fab/ablage/plan-7/notiz.md"', url: 'vscode://file/w/fab/ablage/plan-7/notiz.md' });
    expect(await write.evaluate(el => el.innerText)).toBe('/w/fab/ablage/plan-7/notiz.md');
    expect(await s.anfangBreite(write)).toBe(0);
    const code = s.links(s.zeile(16)).first();
    expect(await s.linkImBaum(code)).toEqual({ name: '- link "/w/wt/demo/karte-7/web/a.js"', url: 'vscode://file/w/wt/demo/karte-7/web/a.js', code: ['/w/wt/demo/karte-7/web/a.js'] });
    expect(await code.evaluate(el => el.innerText)).toBe('/w/wt/demo/karte-7/web/a.js');
  });

  test('AK 2: Ergebnisse Nr 3, Nr 7 und Nr 11 zeigen ihre Pfade voll, ohne Marke und ohne Link', async () => {
    await s.oeffnen();
    for (const nr of [2, 6, 10]) await s.aufklappen(nr);
    for (const [nr, pfad] of [[2, '/w/demo/z.txt'], [6, '/w/fab/ablage/plan-7/notiz.md'], [10, '/w/demo/src/m.rs']]) {
      await expect(s.ergebnis(nr)).toContainText(pfad);
      await expect(s.marken(s.ergebnis(nr))).toHaveCount(0);
      await expect(s.links(s.ergebnis(nr))).toHaveCount(0);
    }
  });

  test('AK 3 · US-4: Nr 16 trägt genau vier Links, cat web/a.js bleibt Code, ../x/y.js und U+202E ohne Link; Nr 1 fünf Links', async ({ page }) => {
    await s.oeffnen();
    const nachricht = s.text(16);
    expect(await s.ziele(nachricht)).toEqual(['vscode://file/w/wt/demo/karte-7/web/a.js', 'vscode://file/w/demo/src/b.rs:42', 'vscode://file/w/demo/a%26b.js', 'vscode://file/w/demox/c.rs']);
    expect(await s.links(nachricht).evaluateAll(as => as.map(a => a.title))).toEqual(['/w/wt/demo/karte-7/web/a.js', '/w/demo/src/b.rs:42', '/w/demo/a&b.js', '/w/demox/c.rs']);
    await expect(s.links(nachricht).first().locator('code')).toHaveText('/w/wt/demo/karte-7/web/a.js');
    await expect(nachricht.locator('code', { hasText: 'cat web/a.js' })).toHaveCount(1);
    const sichtbar = await s.sichtbar(nachricht);
    expect(sichtbar).toContain('‹demo›/src/b.rs:42');
    expect(sichtbar).toContain('nicht ../x/y.js');
    expect(sichtbar).toContain('/w/demo/⟨U+202E⟩d.rs');
    expect(await s.markierenUndKopieren(s.links(nachricht).nth(1))).toBe('/w/demo/src/b.rs:42');
    await page.keyboard.press('Control+C');
    expect(await s.einfuegenInFeld()).toBe('/w/demo/src/b.rs:42');
    await s.aufklappen(1);
    expect(await s.ziele(s.text(1))).toEqual(['vscode://file/w/demo', 'vscode://file/w/fab', 'vscode://file/w/wt/demo/karte-7', 'vscode://file/w/fab/ablage/plan-7', 'vscode://file/w/fab/ablage/plan-7/auftrag.md']);
  });

  test('AK 4 · US-2: genau das Pfadfeld von Nr 2, 4, 6, 12 ist ein Link mit Zeile aus offset bzw. cat -n; Nr 8, 10, 14 ohne', async () => {
    await s.oeffnen();
    for (const nr of [2, 4, 6, 8, 10, 12, 14]) await s.aufklappen(nr);
    const erwartet = {
      2: ['vscode://file/w/wt/demo/karte-7/web/a.js:10', '/w/wt/demo/karte-7/web/a.js:10'],
      4: ['vscode://file/w/wt/demo/karte-7/web/a%20b%3Fc%23d%25e%3A12.js:42', `${t14.EDIT_PFAD}:42`],
      6: ['vscode://file/w/fab/ablage/plan-7/notiz.md', '/w/fab/ablage/plan-7/notiz.md'],
      12: ['vscode://file/w/demo/n.ipynb', '/w/demo/n.ipynb'],
    };
    for (const [nr, [href, name]] of Object.entries(erwartet)) {
      expect(await s.ziele(s.aufruf(nr)), `Nr ${nr}`).toEqual([href]);
      await expect(s.pfadLink(nr)).toHaveAttribute('title', name);
      await expect(s.pfadLink(nr)).toHaveAccessibleName(name);
    }
    for (const nr of [8, 10, 14]) await expect(s.links(s.aufruf(nr)), `Nr ${nr}`).toHaveCount(0);
    expect(await s.sichtbar(s.aufruf(10))).toContain('‹demo›/src');
  });

  test('AK 5 · US-3: Nr 9 — Marke wörtlich, ‹Ablage›/tool-results/b1.txt als Link, Vorschau ohne Link und ohne Marke', async () => {
    await s.oeffnen();
    await s.aufklappen(8);
    const marke = s.ergebnis(8).locator('p.lv-cc');
    expect(await s.sichtbar(marke)).toBe('Von Claude Code gekürzt (12,0 KB): Der Agent sah nur diese Vorschau. Vollständig: ‹Ablage›/tool-results/b1.txt');
    expect(await s.ziele(marke)).toEqual(['vscode://file/w/fab/ablage/plan-7/tool-results/b1.txt']);
    const vorschau = s.ergebnis(8).locator('pre');
    await expect(vorschau).toContainText('ok /w/demo/y.txt');
    await expect(s.links(vorschau)).toHaveCount(0);
    await expect(s.marken(vorschau)).toHaveCount(0);
    await expect(s.zusammenfassung(8)).toContainText('Von Claude Code gekürzt');
    await expect(s.links(s.zusammenfassung(8))).toHaveCount(0);
  });

  test('AK 7 · US-5: T14o ohne Kopf — keine Marke, /w/demo/a.js in Nachricht und Pfadfeld voll als Link, web/a.js bleibt Code', async ({ page }) => {
    await s.oeffnen(t14.T14O_KENNUNG, 2);
    await s.alleAufklappen();
    await expect(s.marken(page.locator(INSEL))).toHaveCount(0);
    expect(await s.ziele(s.text(1))).toEqual(['vscode://file/w/demo/a.js']);
    expect(await s.ziele(s.aufruf(2))).toEqual(['vscode://file/w/demo/a.js']);
    await expect(s.pfadLink(2)).toHaveText('/w/demo/a.js');
    await expect(s.text(1).locator('code')).toHaveText('web/a.js');
  });

  test('AK 8: 320–1280 px hell und dunkel ohne Querscrollen, Kontrast, Unterstreichung, Fokusring; Tab und Enter folgen dem href', async ({ page }) => {
    await s.oeffnen(T14L_KENNUNG);
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
            .filter(([, el]) => el.scrollWidth > el.clientWidth + 0.5)
            .map(([ort, el]) => `${ort} ${el.scrollWidth}>${el.clientWidth}`);
        }, BLOECKE);
        expect(ueberlauf, fall).toEqual([]);
        expect(await kontrastVerstoesse(page, ['#lv-insel .lv-pfad']), fall).toEqual([]);
        const marken = await page.locator(`${INSEL} .lv-mk`).evaluateAll(ms => ms.map(m => { const st = getComputedStyle(m, '::before'); return [st.color, st.backgroundColor]; }));
        expect(marken.length).toBeGreaterThan(5);
        for (const [farbe, grund] of marken) expect(await kontrastFarben(page, farbe, grund), `${fall} Marke`).toBeGreaterThanOrEqual(4.5);
      }
    }
    const linien = await page.locator(`${INSEL} a.lv-pfad`).evaluateAll(as => as.map(a => [getComputedStyle(a).textDecorationLine, ...[...a.querySelectorAll('.lv-mk')].map(m => getComputedStyle(m, '::before').textDecorationLine)]));
    expect(linien.length).toBeGreaterThanOrEqual(14);
    for (const l of linien) for (const wert of l) expect(wert).toContain('underline');
    const ohneLink = await page.locator(`${INSEL} .lv-auf pre .lv-mk, ${INSEL} summary .lv-mk, ${INSEL} .lv-erg pre`).evaluateAll(es => es.map(e => getComputedStyle(e).textDecorationLine));
    for (const wert of ohneLink) expect(wert).toBe('none');
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      const link = s.pfadLink(2);
      await link.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ring = await link.evaluate(el => { const st = getComputedStyle(el); return { fokus: el.matches(':focus-visible'), stil: st.outlineStyle, breite: parseFloat(st.outlineWidth), farbe: st.outlineColor }; });
      expect(ring.fokus).toBe(true);
      expect(ring.stil).toBe('solid');
      expect(ring.breite).toBeGreaterThanOrEqual(2);
      const grund = await link.evaluate(el => {
        for (let e = el.parentElement; e; e = e.parentElement) { const f = getComputedStyle(e).backgroundColor; if (!/rgba\(.*, 0\)$|transparent/.test(f)) return f; }
        return getComputedStyle(document.documentElement).backgroundColor;
      });
      expect(await kontrastFarben(page, ring.farbe, grund), name).toBeGreaterThanOrEqual(3);
    }
    await page.evaluate(() => document.addEventListener('click', ereignis => { window.__ziel = ereignis.target.closest('a').href; ereignis.preventDefault(); }, true));
    await s.pfadLink(2).focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.__ziel)).toBe('vscode://file/w/wt/demo/karte-7/web/a.js:10');
    await expect(page.locator('.lv-tipp')).toHaveCount(0);
  });
});

test.describe('R00242 Laufansicht: Pfade bei grobem Zeiger', () => {
  test.use({ viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true });
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  test('AK 8: der Link des Pfadfelds im Aufruf misst mindestens --kd-ziel (48 px), ohne Querscrollen bei 320 px', async ({ page }) => {
    await s.oeffnen();
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await s.alleAufklappen();
    const hoehen = await page.locator(`${INSEL} .lv-auf a.lv-pfad`).evaluateAll(as => as.map(a => a.getBoundingClientRect().height));
    expect(hoehen.length).toBe(4);
    for (const h of hoehen) expect(h).toBeGreaterThanOrEqual(48);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
