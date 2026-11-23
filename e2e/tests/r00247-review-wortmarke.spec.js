// R00247 Review-Seite — wortgenaue Hervorhebung in geänderten Zeilen (Karte #258, I0237, Scheibe S5 von ADR-0042, W1): AK 1–9 und
// US-1..US-5 im echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`wortmarkeRepository`: K-Wort in src/w.rs, K-Rand in
// src/r.rs, je Syntaxfarbe ein Fall in src/farben.rs, (f) und (a) in w.xyz ohne Farbe, (a) breit in src/breit.rs, K-Block, Last, K-Zwei).
// Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Adressen, Messungen nur hier) → Programm.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastAm, kontrastFarben, farbPixel } = require('./hilfen');
const { wortmarkeRepository, wortmarkeVorbereiten, WM_FAELLE, WM_BREIT } = require('./review-hilfen');

const LESETEXT = { del: 'entfernt: ', add: 'hinzugefügt: ' };
/** Der sichtbare Text einer Zeile: Bidi-Zeichen als `⟨U+202E⟩` (ADR-0033 Punkt 8). */
const sichtbar = text => text.replace(/‮/g, '⟨U+202E⟩');
const [ALT, NEU] = [0, 1];
const fall = (gruppe, name, seite = NEU, i = 0) => WM_FAELLE[gruppe][name][seite][i];

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/** Hält fest, welche Marken ein Diffbereich trägt, sobald er mit `data-farbe="laeuft"` eingesetzt ist — also bevor die Farbe aufliegt. */
function markenVorDerFarbe() {
  window.kdVorFarbe = {};
  new MutationObserver(eintraege => eintraege.forEach(e => e.addedNodes.forEach(k => {
    if (k.nodeType !== 1) return;
    for (const b of [k, ...k.querySelectorAll('.df-sc')]) {
      if (!b.matches('.df-sc[data-farbe="laeuft"]')) continue;
      window.kdVorFarbe[b.getAttribute('aria-label')] = Array.from(b.querySelectorAll('mark.wm'), m => m.textContent);
    }
  }))).observe(document, { childList: true, subtree: true });
}

/** Long Tasks ab dem Laden (PerformanceObserver `longtask`, ereignisgenau). */
function langeAufgabenSammeln() {
  window.kdLang = [];
  new PerformanceObserver(l => l.getEntries().forEach(e => window.kdLang.push({ start: e.startTime, dauer: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
}

function seite(page) {
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const bereich = pfad => datei(pfad).locator('.df-sc');
  /** Die Zeile `art` (del/add) mit dem Zeilentext `text`. */
  const zeile = (pfad, art, text) => bereich(pfad).locator(`tr.${art}`).filter({ has: page.locator('td.c', { hasText: exakt(LESETEXT[art] + sichtbar(text)) }) });
  /** Je Zeile einer Datei: Art, Text ohne Lesetext, Marken und der Text vor und nach der ersten Marke. */
  const zeilen = pfad => bereich(pfad).evaluate(b => Array.from(b.querySelectorAll('tr.del, tr.add'), tr => {
    const zelle = tr.querySelector('td.c');
    const lesen = zelle.querySelector('.vh');
    const text = zelle.textContent.slice(lesen ? lesen.textContent.length : 0);
    const marken = Array.from(zelle.querySelectorAll('mark.wm'), m => m.textContent);
    const marke = zelle.querySelector('mark.wm');
    let vor = null, nach = null;
    if (marke) {
      const r = document.createRange();
      r.setStart(zelle, 0); r.setEndBefore(marke);
      vor = r.toString().slice(lesen ? lesen.textContent.length : 0);
      r.setStartAfter(marke); r.setEnd(zelle, zelle.childNodes.length);
      nach = r.toString();
    }
    return { art: tr.className, text, marken, vor, nach };
  }));
  return {
    datei, bereich, zeile, zeilen,
    marke: (pfad, art, text) => zeile(pfad, art, text).locator('mark.wm'),
    /** Die Marken einer Zeile als Texte. */
    marken: async (pfad, art, text) => zeile(pfad, art, text).locator('mark.wm').allTextContents(),
    /** Wartet, bis die Farbe des Diffbereichs entschieden ist (`ja` oder `nein`), in der Seite statt per Polling von außen. */
    farbeAbwarten: async (pfad, timeout = 15000) => {
      const el = await bereich(pfad).elementHandle();
      await page.waitForFunction(e => !e.isConnected || e.dataset.farbe === 'ja' || e.dataset.farbe === 'nein', el, { timeout });
      return el.evaluate(e => e.dataset.farbe);
    },
    vorFarbe: pfad => page.evaluate(n => window.kdVorFarbe[n] || null, `Änderungen in ${pfad}`),
    dokuOeffnen: async () => {
      const kopf = page.locator('#rv-insel button[id^="rv-gk"][id$="-doku"]');
      await kopf.click();
      await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    },
    anzeigen: pfad => datei(pfad).getByRole('button', { name: 'Änderungen anzeigen' }),
    langeSeit: async (t0, name) => {
      const alle = await page.evaluate(t => window.kdLang.filter(e => e.start >= t), t0);
      if (process.env.KD_MESS_AUS) fs.appendFileSync(process.env.KD_MESS_AUS, JSON.stringify({ name, dauern: alle.map(e => e.dauer) }) + '\n');
      return alle.filter(e => e.dauer > 150);
    },
    jetzt: () => page.evaluate(() => performance.now()),
  };
}

async function commitOeffnen(page, k, nr, commit) {
  await page.goto(commitAdresse(k, nr, commit));
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

/** Farbe der Kante einer Marke aus dem berechneten Stil: Schatten (normal) oder Unterstreichung bzw. Rand (erzwungene Farben). */
const kantenStil = marke => marke.evaluate(m => {
  const s = getComputedStyle(m);
  const schatten = s.boxShadow;
  const farbe = schatten === 'none' ? null : schatten.match(/^((?:rgba?|oklch|oklab|lab|lch|color|hsla?)\([^)]*\)|#[0-9a-f]+|\w+)/i)[1];
  return {
    schatten, farbe, display: s.display, randLinks: s.borderLeftWidth, randRechts: s.borderRightWidth, paddingLinks: s.paddingLeft, paddingRechts: s.paddingRight,
    linie: s.textDecorationLine, dicke: s.textDecorationThickness, randUnten: s.borderBottomWidth, randUntenStil: s.borderBottomStyle,
    zeilengrund: getComputedStyle(m.closest('td.c')).backgroundColor,
  };
});

/** Je Rechteck der Marke: hat die unterste 2-px-Reihe über die ganze Breite die Kantenfarbe (±2 je Kanal)? Bildschirmfoto im Browser
    dekodiert; geprüft wird jedes Pixel der beiden Reihen. */
async function kanteDurchgehend(page, marke, farbe) {
  const soll = await farbPixel(page, farbe);
  const rechtecke = await marke.evaluate(m => Array.from(m.getClientRects(), r => ({ x: r.left, y: r.top, w: r.width, h: r.height })));
  const ergebnisse = [];
  for (const r of rechtecke) {
    const links = Math.ceil(r.x), rechts = Math.floor(r.x + r.w), unten = Math.floor(r.y + r.h);
    const clip = { x: links, y: unten - 2, width: rechts - links, height: 2 };
    const bild = (await page.screenshot({ clip, animations: 'disabled' })).toString('base64');
    ergebnisse.push(await page.evaluate(async ([daten, sollPixel]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${daten}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const abweichend = [];
      for (let p = 0; p < d.length; p += 4) {
        if ([0, 1, 2].some(i => Math.abs(d[p + i] - sollPixel[i]) > 2)) abweichend.push([(p / 4) % c.width, Math.floor(p / 4 / c.width), d[p], d[p + 1], d[p + 2]]);
      }
      return { breite: c.width, abweichend: abweichend.slice(0, 5), anzahl: abweichend.length };
    }, [bild, soll]));
  }
  return ergebnisse;
}

/** Nimmt jede Marke aus der Zeile (ihr Inhalt bleibt an Ort und Stelle) — die Zeile „ohne Marke“ zum Vergleich. */
const markenAusbauen = zeile => zeile.evaluate(tr => tr.querySelectorAll('mark.wm').forEach(m => m.replaceWith(...m.childNodes)));

test.describe('R00247 Review-Seite — Wortmarke', () => {
  test.fail(true, 'erwartet rot, bis B1296–B1299 die Wortmarke bauen');
  let k;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(wortmarkeVorbereiten(wortmarkeRepository()));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1–3 Marke, Wortgrenze, keine Marke (US-1, US-2) ── */

  test('AK 1: (a) und (c) — gelöscht genau eine Marke „1“, hinzugefügt genau eine „2“, der Rest steht außerhalb', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    await s.farbeAbwarten('src/w.rs');
    const zeilen = await s.zeilen('src/w.rs');
    const zu = (art, text) => zeilen.find(z => z.art === art && z.text === text);
    expect(zu('del', 'let a = 1;')).toEqual({ art: 'del', text: 'let a = 1;', marken: ['1'], vor: 'let a = ', nach: ';' });
    expect(zu('add', 'let a = 2;')).toEqual({ art: 'add', text: 'let a = 2;', marken: ['2'], vor: 'let a = ', nach: ';' });
    expect(zu('del', 'a = 1')).toEqual({ art: 'del', text: 'a = 1', marken: ['1'], vor: 'a = ', nach: '' });
    expect(zu('add', 'a = 2')).toEqual({ art: 'add', text: 'a = 2', marken: ['2'], vor: 'a = ', nach: '' });
  });

  test('AK 2: (b) — gelöscht ist das ganze Wort „alt_name“, hinzugefügt „alt_namen“ markiert', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    await s.farbeAbwarten('src/w.rs');
    expect(await s.marken('src/w.rs', 'del', 'fn alt_name(x) {}')).toEqual(['alt_name']);
    expect(await s.marken('src/w.rs', 'add', 'fn alt_namen(x) {}')).toEqual(['alt_namen']);
  });

  test('AK 3: (d), (g), (h), (i) ohne Marke; (e) ein Bereich je Zeile; (p) nur die hinzugefügte Zeile; (n) mit, (o) ohne Marke', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    await s.farbeAbwarten('src/w.rs');
    const ohne = [['del', 'a=1;'], ['add', 'a=2;'], ['del', 'p = 10;'], ['del', 'q = 20;'], ['add', 'p = 11;'], ['add', 'q = 21;'], ['add', 'r = 31;'], ['add', 'neu_nur = 1;'], ['del', 'x = 1;'], ['add', 'x = 2;']];
    for (const [art, text] of ohne) {
      await expect(s.zeile('src/w.rs', art, text), `${art} ${text} steht`).toHaveCount(1);
      expect(await s.marken('src/w.rs', art, text), `${art} ${text}`).toEqual([]);
    }
    expect(await s.marken('src/w.rs', 'del', 'a = 1; b = 2;')).toEqual(['1; b = 2']);
    expect(await s.marken('src/w.rs', 'add', 'a = 9; b = 8;')).toEqual(['9; b = 8']);
    expect(await s.marken('src/w.rs', 'add', 'foo(1, 3, 2)')).toEqual(['3, ']);
    await expect(s.zeile('src/w.rs', 'del', 'foo(1, 2)').locator('mark')).toHaveCount(0);

    await s.farbeAbwarten('src/r.rs');
    // (n) genau 1.000 Zeichen: Marke nach FA 2 — das Wort `aaa…1` bzw. `aaa…2` (Präfix `//` bleibt außen)
    const n = [fall('rand', 'n', ALT), fall('rand', 'n', NEU)];
    expect(n[0].length).toBe(1000);
    expect(await s.marken('src/r.rs', 'del', n[0])).toEqual([n[0].slice(2)]);
    expect(await s.marken('src/r.rs', 'add', n[1])).toEqual([n[1].slice(2)]);
    // (o) 1.001 Zeichen: keine Marke, die Zeile steht unverändert
    const o = [fall('rand', 'o', ALT), fall('rand', 'o', NEU)];
    expect(o[0].length).toBe(1001);
    await expect(s.zeile('src/r.rs', 'del', o[0])).toHaveCount(1);
    await expect(s.zeile('src/r.rs', 'add', o[1])).toHaveCount(1);
    expect(await s.marken('src/r.rs', 'del', o[0])).toEqual([]);
    expect(await s.marken('src/r.rs', 'add', o[1])).toEqual([]);
  });

  /* ── AK 4, AK 5 Text, Farbe, fremder Text (US-3) ── */

  test('AK 4: (j), (k), (l), (m) — Text gleich dem ohne Marke, Emoji ganz, Bidi sichtbar innen bzw. außen, fremdes HTML bleibt Text', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    await s.farbeAbwarten('src/r.rs');
    for (const name of ['j', 'k', 'l', 'm']) {
      for (const [art, seiteNr] of [['del', ALT], ['add', NEU]]) {
        const text = fall('rand', name, seiteNr);
        const zeile = s.zeile('src/r.rs', art, text);
        await expect(zeile, `(${name}) ${art}`).toHaveCount(1);
        await expect(zeile.locator('mark.wm'), `(${name}) ${art} trägt eine Marke`).toHaveCount(1);
        const mit = await zeile.locator('td.c').textContent();
        await markenAusbauen(zeile);
        expect(await zeile.locator('td.c').textContent(), `(${name}) ${art}: Text wie ohne Marke`).toBe(mit);
        expect(mit).toBe(LESETEXT[art] + sichtbar(text));
      }
    }
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    await s.farbeAbwarten('src/r.rs');
    expect(await s.marken('src/r.rs', 'del', fall('rand', 'j', ALT))).toEqual(['😀']);
    expect(await s.marken('src/r.rs', 'add', fall('rand', 'j', NEU))).toEqual(['😁']);
    expect(await s.bereich('src/r.rs').textContent()).not.toContain('�');
    // (k): das sichtbar gemachte Zeichen liegt in der Marke `[5, 8)`, (l): außerhalb, Marke nur „b“ bzw. „c“
    expect(await s.marken('src/r.rs', 'del', fall('rand', 'k', ALT))).toEqual(['1⟨U+202E⟩2']);
    await expect(s.marke('src/r.rs', 'del', fall('rand', 'k', ALT)).locator('.mk-z.mk-bidi')).toHaveCount(1);
    await expect(s.marke('src/r.rs', 'add', fall('rand', 'k', NEU)).locator('.mk-z.mk-bidi')).toHaveCount(1);
    expect(await s.marken('src/r.rs', 'del', fall('rand', 'l', ALT))).toEqual(['b']);
    expect(await s.marken('src/r.rs', 'add', fall('rand', 'l', NEU))).toEqual(['c']);
    for (const [art, seiteNr] of [['del', ALT], ['add', NEU]]) {
      const zeile = s.zeile('src/r.rs', art, fall('rand', 'l', seiteNr));
      await expect(zeile.locator('.mk-z.mk-bidi'), `(l) ${art}: sichtbar`).toHaveCount(1);
      await expect(zeile.locator('mark.wm .mk-z'), `(l) ${art}: außerhalb der Marke`).toHaveCount(0);
    }
    expect(await s.bereich('src/r.rs').evaluate(b => b.innerHTML.includes('‮') || b.textContent.includes('‮'))).toBe(false);
    // (m): „x“ bzw. „y“ als Text, kein img, nichts ausgeführt
    expect(await s.marken('src/r.rs', 'del', fall('rand', 'm', ALT))).toEqual(['x']);
    expect(await s.marken('src/r.rs', 'add', fall('rand', 'm', NEU))).toEqual(['y']);
    await expect(page.locator('#rv-insel img')).toHaveCount(0);
    expect(await page.evaluate(() => window.pwn)).toBeUndefined();
    // (k): die Kante läuft unter dem sichtbar gemachten Zeichen durch
    for (const [art, seiteNr] of [['del', ALT], ['add', NEU]]) {
      const marke = s.marke('src/r.rs', art, fall('rand', 'k', seiteNr));
      const { farbe } = await kantenStil(marke);
      const je = await kanteDurchgehend(page, marke, farbe);
      expect(je.length).toBe(1);
      expect(je[0].anzahl, `(k) ${art}: Kante unter ⟨U+202E⟩ nicht unterbrochen: ${JSON.stringify(je[0].abweichend)}`).toBe(0);
    }
  });

  test('AK 5: (f) — die Marke steht außen um die Farbstücke, jedes Zeichen behält seine Farbe; vor der Farbe schon da; w.xyz ohne Farbe mit Marke', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(markenVorDerFarbe);
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    expect(await s.farbeAbwarten('src/w.rs')).toBe('ja');
    expect(await s.vorFarbe('src/w.rs'), 'Marken, bevor die Farbe aufliegt').toEqual(expect.arrayContaining(['alt', 'neu', '1', '2']));
    for (const [art, text, wort] of [['del', fall('wort', 'f', ALT), 'alt'], ['add', fall('wort', 'f', NEU), 'neu']]) {
      const zeile = s.zeile('src/w.rs', art, text);
      const marke = zeile.locator('mark.wm');
      await expect(marke).toHaveText(wort);
      const lage = await marke.evaluate(m => ({
        innenInFarbe: m.closest('[class^="tk-"]') !== null,
        stuecke: Array.from(m.children, c => [c.className, c.textContent]),
        farbeInnen: Array.from(m.querySelectorAll('[class^="tk-"]'), c => getComputedStyle(c).color),
        farbeAnfuehrung: getComputedStyle(m.previousElementSibling).color,
        anfuehrung: [m.previousElementSibling.className, m.previousElementSibling.textContent, m.nextElementSibling.className, m.nextElementSibling.textContent],
      }));
      expect(lage.innenInFarbe, `${art}: die Marke liegt nicht in einem Farbstück`).toBe(false);
      expect(lage.stuecke).toEqual([['tk-string', wort]]);
      expect(lage.anfuehrung[0]).toBe('tk-string');
      expect(lage.anfuehrung[1].endsWith('"')).toBe(true);
      expect(lage.anfuehrung[2]).toBe('tk-string');
      expect(lage.anfuehrung[3].startsWith('"')).toBe(true);
      expect(lage.farbeInnen).toEqual([lage.farbeAnfuehrung]);
    }
    expect(await s.farbeAbwarten('w.xyz')).toBe('nein');
    expect(await s.marken('w.xyz', 'del', fall('wort', 'f', ALT))).toEqual(['alt']);
    expect(await s.marken('w.xyz', 'add', fall('wort', 'f', NEU))).toEqual(['neu']);
  });

  /* ── AK 6 Alle Änderungen, Blockgrenze (US-4) ── */

  test('AK 6: K-Zwei — „Alle Änderungen“ trägt (a) in kd und in wb je eine Marke „1“ / „2“', async ({ page }) => {
    const s = seite(page);
    await page.goto(alleAdresse(k, 9));
    await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
    await s.farbeAbwarten('src/w.rs');
    expect(await s.marken('src/w.rs', 'del', 'let a = 1;')).toEqual(['1']);
    expect(await s.marken('src/w.rs', 'add', 'let a = 2;')).toEqual(['2']);
    await s.dokuOeffnen();
    await s.farbeAbwarten('docs/n.md');
    expect(await s.marken('docs/n.md', 'del', 'let a = 1;')).toEqual(['1']);
    expect(await s.marken('docs/n.md', 'add', 'let a = 2;')).toEqual(['2']);
  });

  test('AK 6: K-Block — der Lauf über die Blockgrenze (Index 500) trägt sechs Marken, Zeile i gegen Zeile i', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 10, wortmarkeRepository().w2);
    await s.farbeAbwarten('src/g.rs');
    // die Grenze liegt zwischen der zweiten und dritten gelöschten Zeile
    const lage = await s.bereich('src/g.rs').evaluate(b => Array.from(b.querySelectorAll('.dz-b'), (block, i) => Array.from(block.querySelectorAll('tr.del td.c'), c => [i, c.textContent])).flat());
    expect(lage).toEqual([[0, 'entfernt: d1 = 1;'], [0, 'entfernt: d2 = 1;'], [1, 'entfernt: d3 = 1;']]);
    for (const i of [1, 2, 3]) {
      expect(await s.marken('src/g.rs', 'del', `d${i} = 1;`), `d${i} gelöscht`).toEqual(['1']);
      expect(await s.marken('src/g.rs', 'add', `d${i} = 2;`), `d${i} hinzugefügt`).toEqual(['2']);
    }
    await expect(s.bereich('src/g.rs').locator('mark.wm')).toHaveCount(6);
  });

  /* ── AK 7 Kontrast und Form, AK 8 Breite, Höhe, Umbruch (US-4) ── */

  for (const [lage, einstellen] of [
    ['hell', page => thema(page, 'light')],
    ['dunkel (data-theme)', page => thema(page, 'dark')],
    ['dunkel (System)', page => page.emulateMedia({ colorScheme: 'dark' })],
  ]) {
    test(`AK 7: ${lage} — Text in der Marke ≥ 4,5:1, je Syntaxfarbe ≥ 4,5:1, Unterkante 2 px ≥ 3:1 gegen den Zeilengrund`, async ({ page }) => {
      const s = seite(page);
      await einstellen(page);
      await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
      if (lage === 'dunkel (System)') expect(await page.evaluate(() => document.documentElement.dataset.theme || null)).toBeNull();
      await s.farbeAbwarten('src/w.rs');
      await s.farbeAbwarten('src/farben.rs');
      const messwerte = [];
      for (const [art, text] of [['del', 'let a = 1;'], ['add', 'let a = 2;']]) {
        const marke = s.marke('src/w.rs', art, text);
        // (1) Text: die Ziffer liegt im Farbstück `tk-number` in der Marke; gemessen wird der Text der Marke
        messwerte.push({ was: `${art} Text`, wert: await kontrastAm(marke.locator('span').first()) });
        // (2) Kante gegen den Zeilengrund
        const st = await kantenStil(marke);
        expect(st.schatten, `${art}: Unterkante 2 px als Schatten`).toMatch(/0px -2px 0px 0px inset|inset 0px -2px 0px/);
        messwerte.push({ was: `${art} Kante/Zeilengrund`, wert: await kontrastFarben(page, st.farbe, st.zeilengrund), kante: true });
      }
      for (const [rolle, [alt, neu]] of Object.entries(WM_FAELLE.farben)) {
        for (const [art, text] of [['del', alt[0]], ['add', neu[0]]]) {
          const stueck = s.marke('src/farben.rs', art, text).locator(`.tk-${rolle}`);
          await expect(stueck, `${rolle} ${art} in der Marke`).toHaveCount(1);
          messwerte.push({ was: `${art} tk-${rolle}`, wert: await kontrastAm(stueck) });
        }
      }
      if (process.env.KD_MESS_AUS) fs.appendFileSync(process.env.KD_MESS_AUS, JSON.stringify({ lage, messwerte }) + '\n');
      expect(messwerte.length).toBe(2 * 2 + 14);
      expect(messwerte.filter(m => !m.kante && m.wert < 4.5), 'Text unter 4,5:1').toEqual([]);
      expect(messwerte.filter(m => m.kante && m.wert < 3), 'Kante unter 3:1').toEqual([]);
    });
  }

  for (const schema of ['light', 'dark']) {
    test(`AK 7: erzwungene Farben (${schema}) — jede Marke trägt eine Linie von 2 px, ohne Schatten, Zeile gleich hoch, Text ≥ 4,5:1, − / + und Lesetext bleiben`, async ({ page }) => {
      const s = seite(page);
      await page.emulateMedia({ forcedColors: 'active', colorScheme: schema });
      await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
      await s.farbeAbwarten('src/w.rs');
      const marken = s.bereich('src/w.rs').locator('mark.wm');
      expect(await marken.count()).toBeGreaterThan(5);
      const hoeheOhne = await s.zeile('src/w.rs', 'del', 'a=1;').evaluate(tr => tr.offsetHeight);
      for (let i = 0; i < await marken.count(); i++) {
        const st = await kantenStil(marken.nth(i));
        const linie = (st.linie.includes('underline') && st.dicke === '2px') || (st.randUnten === '2px' && st.randUntenStil === 'solid');
        expect(linie, `Marke ${i}: ${JSON.stringify(st)}`).toBe(true);
        expect(st.schatten).toBe('none');
        expect(await marken.nth(i).evaluate(m => m.closest('tr').offsetHeight)).toBe(hoeheOhne);
        expect(await kontrastAm(marken.nth(i)), `Marke ${i}: Text gegen den Grund`).toBeGreaterThanOrEqual(4.5);
      }
      for (const [art, text, zeichen] of [['del', 'let a = 1;', '−'], ['add', 'let a = 2;', '+']]) {
        const zeile = s.zeile('src/w.rs', art, text);
        await expect(zeile.locator('td.m')).toHaveText(zeichen);
        await expect(zeile.locator('td.c .vh')).toHaveText(LESETEXT[art]);
      }
    });
  }

  for (const thm of ['light', 'dark']) {
    test(`AK 8: ${thm} — 320, 414, 980, 1280 px ohne Querscrollen, Zeile mit Marke so breit und hoch wie ohne, inline, Kopieren gleich`, async ({ page, context }) => {
      const s = seite(page);
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);
      await thema(page, thm);
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite, 800);
        await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
        await s.farbeAbwarten('src/w.rs');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${breite} px`).toBe(true);
        for (const [art, text] of [['del', 'let a = 1;'], ['add', 'let a = 2;']]) {
          const zeile = s.zeile('src/w.rs', art, text);
          const marke = zeile.locator('mark.wm');
          await expect(marke).toHaveCount(1);
          expect((await kantenStil(marke)).display).toBe('inline');
          const masse = () => zeile.evaluate(tr => [tr.offsetWidth, tr.offsetHeight]);
          const kopieren = async () => {
            await zeile.locator('td.c').evaluate(c => { const r = document.createRange(); r.selectNodeContents(c); const a = getSelection(); a.removeAllRanges(); a.addRange(r); });
            await page.keyboard.press('Control+C');
            return page.evaluate(() => navigator.clipboard.readText());
          };
          const mit = [await masse(), await kopieren()];
          await markenAusbauen(zeile);
          const ohne = [await masse(), await kopieren()];
          expect(mit, `${breite} px ${art}`).toEqual(ohne);
          expect(mit[1]).toBe(LESETEXT[art] + text);
        }
      }
    });
  }

  test('AK 8: Umbruch (Stil im Test gesetzt) bei 320 px — die Marke bricht mit, Kante auf jedem Fragment, keine Seitenränder', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 320, 800);
    await commitOeffnen(page, k, 9, wortmarkeRepository().w1);
    await s.farbeAbwarten('src/breit.rs');
    await page.addStyleTag({ content: '.dz .c{white-space:pre-wrap;overflow-wrap:anywhere}' });
    const text = WM_BREIT('2');
    expect(text.length).toBe(120);
    const zeile = s.zeile('src/breit.rs', 'add', text);
    const marke = zeile.locator('mark.wm');
    await expect(marke).toHaveText(text.slice(60, 110));
    expect(await zeile.evaluate(tr => tr.offsetHeight)).toBeGreaterThanOrEqual(36);
    expect(await marke.evaluate(m => m.getClientRects().length)).toBeGreaterThanOrEqual(2);
    const st = await kantenStil(marke);
    expect([st.randLinks, st.randRechts, st.paddingLinks, st.paddingRechts]).toEqual(['0px', '0px', '0px', '0px']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const je = await kanteDurchgehend(page, marke, st.farbe);
    expect(je.every(r => r.anzahl === 0), JSON.stringify(je)).toBe(true);
  });

  /* ── AK 9 Last (US-5) ── */

  for (const [nr, pfad, commit, farbe] of [[11, 'src/last.rs', 'wl', 'nein'], [12, 'src/kurz.rs', 'wlf', 'ja']]) {
    test(`AK 9: ${pfad} — 5.000 gelöschte gegen 5.000 hinzugefügte Zeilen, Zeichnen mit Marke${farbe === 'ja' ? ' und Farbe' : ''} ohne Long Task über 150 ms`, async ({ page }) => {
      test.setTimeout(90000);
      const s = seite(page);
      await page.addInitScript(langeAufgabenSammeln);
      await commitOeffnen(page, k, nr, wortmarkeRepository()[commit]);
      const anzeigen = s.anzeigen(pfad);
      await expect(anzeigen).toBeVisible();
      const t0 = await s.jetzt();
      await anzeigen.click();
      expect(await s.farbeAbwarten(pfad, 30000)).toBe(farbe);
      await expect(s.bereich(pfad).locator('mark.wm')).toHaveCount(10000);
      expect(await s.langeSeit(t0, pfad), 'Long Tasks über 150 ms').toEqual([]);
    });
  }
});
