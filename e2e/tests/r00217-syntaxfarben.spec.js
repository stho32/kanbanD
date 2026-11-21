// R00217 Syntaxfarben in der Review-Seite (Karte #216, I0207, Scheibe B4, ADR-0040) — AK 1–10 im echten Programm gegen echtes Git.
// Ausgangslage: farben-hilfen.js (R mit K1 an #2, K2 an #3, K3 an #4). Über Farbe wird erst geurteilt, wenn der Diffbereich
// `data-farbe="ja"` oder `"nein"` trägt — ereignisgenau, nie nach Zeit (ADR-0026). Konsole im Testkörper urteilen, dann abbauen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen } = require('./hilfen');
const { farbenRepository, farbenVorbereiten, kommentarAnlegen } = require('./farben-hilfen');

/* ── Treiber ── */
const reviewAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

const regexText = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Der Abschnitt einer Datei der Insel, gefunden über den ganzen Pfad. */
const datei = (page, pfad) => page.locator('#rv-insel .df').filter({ has: page.locator('.df-k .p', { hasText: new RegExp(`^${regexText(pfad)}$`) }) });
/** Der Diffbereich einer Datei. */
const bereich = (page, pfad) => datei(page, pfad).locator('.df-sc');

/** Klappt die Datei auf, wenn sie zu ist, und wartet, bis die Farbe entschieden ist (`ja` oder `nein`). */
async function aufklappenUndWarten(page, pfad) {
  const kopf = datei(page, pfad).locator('.df-k');
  if (await kopf.getAttribute('aria-expanded') !== 'true') await kopf.click();
  await expect(bereich(page, pfad)).toHaveAttribute('data-farbe', /^(ja|nein)$/);
  return bereich(page, pfad).getAttribute('data-farbe');
}

/** Je Zeile des Diffbereichs die Stücke mit Rolle: [[Text, Klasse], …]. */
const rollenJeZeile = (page, pfad) => bereich(page, pfad).evaluate(b => Array.from(b.querySelectorAll('tr'), tr => Array.from(tr.querySelectorAll('[class^="tk-"]'), e => [e.textContent, e.className])));
const rolle = (zeilen, i, text) => zeilen[i].filter(([t]) => t === text).map(([, k]) => k);

/** Sammelt Konsoleneinträge, Seitenfehler und angefragte Adressen der Seite. */
function beobachten(page) {
  const b = { konsole: [], fehler: [], anfragen: [] };
  page.on('console', m => b.konsole.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', e => b.fehler.push(String(e)));
  page.on('request', r => b.anfragen.push(r.url()));
  return b;
}

test.describe('R00217 Syntaxfarben in der Review-Seite', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    k = await kanbanStarten(farbenVorbereiten(farbenRepository()));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 8 Einbettung ── */

  test('AK 8: die Seite kennt kein Prism, index.html hat kein Inline-Skript und lädt prism.js nicht, keine Anfrage an fremde Hosts', async ({ page }) => {
    const b = beobachten(page);
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-insel .df')).toHaveCount(12);
    expect(await page.evaluate(() => typeof window.Prism)).toBe('undefined');
    const index = await (await page.request.get(k.adresse)).text();
    const skripte = [...index.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    expect(skripte.length).toBeGreaterThan(10);
    expect(skripte.filter(s => !/\bsrc=/.test(s[1]) || s[2].trim() !== ''), 'kein Inline-Skript').toEqual([]);
    expect(skripte.filter(s => /prism/i.test(s[1])), 'kein <script> mit prism.js').toEqual([]);
    const herkunft = new URL(k.adresse).origin;
    expect(b.anfragen.filter(u => !u.startsWith(herkunft) && !u.startsWith('data:') && !u.startsWith('blob:')), 'nur der eigene Host').toEqual([]);
    expect(b.fehler).toEqual([]);
  });

  test('AK 8: der Codeblock ```rust im Kommentar an #2 bleibt im Aufgabenfenster ohne token- und tk-Klasse', async ({ page }) => {
    await kommentarAnlegen(page.request, k);
    await page.goto(`${k.adresse}#/aufgaben/aufgabe/2`);
    const code = page.locator('#fenster pre code', { hasText: 'fn m() {}' });
    await expect(code).toHaveCount(1);
    expect(await page.locator('#fenster [class*="token"], #fenster [class*="tk-"]').count()).toBe(0);
    expect(await code.evaluate(e => e.innerHTML)).toBe('fn m() {}');
  });

  /* ── AK 10 Worker ── */

  test('AK 10: der Worker beantwortet JSON-Text nicht mit HTML, die erste Antwort ist das Int32Array zum Auftrag', async ({ page }) => {
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-insel .df')).toHaveCount(12);
    const antworten = await page.evaluate(() => new Promise(fertig => {
      const w = new Worker('/web/faerben.js');
      const erhalten = [];
      w.onmessage = e => {
        const d = e.data;
        erhalten.push(d instanceof Int32Array ? { art: 'Int32Array', werte: Array.from(d) } : { art: typeof d, text: typeof d === 'string' ? d : JSON.stringify(d) });
        if (d instanceof Int32Array) { w.terminate(); fertig(erhalten); }
      };
      w.onerror = () => fertig([{ art: 'onerror' }]);
      w.postMessage(JSON.stringify({ language: 'rust', code: 'fn x(){}' }));
      w.postMessage({ sprache: 'rust', zeilen: patchZeilen('@@ -0,0 +1 @@\n+fn main() {}\n') });
    }));
    expect(antworten[0].art, `erste Antwort: ${JSON.stringify(antworten[0])}`).toBe('Int32Array');
    expect(antworten.some(a => /<span|token/.test(a.text || '')), 'keine HTML-Antwort').toBe(false);
    const werte = antworten[0].werte;
    expect(werte.length % 4).toBe(0);
    expect(werte.length).toBeGreaterThan(0);
    expect(werte.filter((_, i) => i % 4 === 3).every(r => r >= 0 && r <= 6)).toBe(true);
    // `fn` steht in Zeile 1 an 0–2 mit Rolle 0 (Schlüsselwort)
    expect(werte.slice(0, 4)).toEqual([1, 0, 2, 0]);
  });

  /* ── AK 2–4 Farbe (B1132: Auflage blockweise) ── */

  test('AK 2: `fn` ist Schlüsselwort, alle drei Kommentarzeilen ganz Kommentar, Hunk-Kopf ohne Rolle — in „Alle Änderungen“ und „Ein Commit“', async ({ page }) => {
    const b = beobachten(page);
    await page.goto(reviewAdresse(k, 2));
    for (const ansicht of ['Alle Änderungen', 'Ein Commit']) {
      if (ansicht === 'Ein Commit') {
        await page.locator('#rv-u-commit').click();
        await expect(page.locator('#rv-u-commit')).toHaveAttribute('aria-current', 'page');
      }
      expect(await aufklappenUndWarten(page, 'src/main.rs'), ansicht).toBe('ja');
      const z = await rollenJeZeile(page, 'src/main.rs');
      expect(z[0], `${ansicht}: Hunk-Kopf`).toEqual([]);
      expect(z[1], ansicht).toEqual([['/* Kopf', 'tk-comment']]);
      expect(z[2], `${ansicht}: die mittlere Zeile ganz`).toEqual([['   zweite Zeile', 'tk-comment']]);
      expect(z[3], ansicht).toEqual([['*/', 'tk-comment']]);
      expect(rolle(z, 4, 'fn'), ansicht).toEqual(['tk-keyword']);
    }
    expect(b.fehler).toEqual([]);
  });

  test('AK 3: entfernt aus der alten Seite, Kontext aus der neuen; Hunk 2 beginnt neu (src/seiten.rs, src/hunks.rs)', async ({ page }) => {
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'src/seiten.rs')).toBe('ja');
    const s = await rollenJeZeile(page, 'src/seiten.rs');
    // Zeilen: 0 Kopf, 1 `let a`, 2 `-/* weg`, 3 `+let b`, 4 Kontext `*/ let c = 3;`
    expect(rolle(s, 2, '/* weg')).toEqual(['tk-comment']);
    expect(s[4].filter(([, kl]) => kl === 'tk-comment')).toEqual([]);
    expect(rolle(s, 4, 'let')).toEqual(['tk-keyword']);
    expect(await aufklappenUndWarten(page, 'src/hunks.rs')).toBe('ja');
    const h = await rollenJeZeile(page, 'src/hunks.rs');
    const zeileFn = await bereich(page, 'src/hunks.rs').evaluate(b => Array.from(b.querySelectorAll('tr'), tr => tr.textContent).findIndex(t => t.includes('fn b() {}')));
    expect(await bereich(page, 'src/hunks.rs').locator('tr.hk').count(), 'zwei Hunks').toBe(2);
    expect(rolle(h, zeileFn, 'fn')).toEqual(['tk-keyword']);
  });

  test('AK 4: Makefile, notiz.unbekannt und Typ.TS ohne Rolle und ohne Konsoleneintrag; SRC/GROSS.RS, umbenannt.rs und das gelöschte alt.py gefärbt', async ({ page }) => {
    const b = beobachten(page);
    await page.goto(reviewAdresse(k, 2));
    for (const pfad of ['Makefile', 'notiz.unbekannt', 'Typ.TS']) {
      expect(await aufklappenUndWarten(page, pfad), pfad).toBe('nein');
      expect((await rollenJeZeile(page, pfad)).flat(), pfad).toEqual([]);
      await expect(datei(page, pfad).locator('.df-inhalt'), 'kein Hinweis an der Datei').not.toContainText('Farbe');
    }
    for (const [pfad, zeile, wort] of [['SRC/GROSS.RS', 2, 'fn'], ['umbenannt.rs', 6, 'fn'], ['alt.py', 1, 'def']]) {
      expect(await aufklappenUndWarten(page, pfad), pfad).toBe('ja');
      const z = await rollenJeZeile(page, pfad);
      const i = await bereich(page, pfad).evaluate((b, w) => Array.from(b.querySelectorAll('tr'), tr => tr.textContent).findIndex(t => t.includes(w)), wort === 'def' ? 'def f' : wort === 'fn' && pfad === 'umbenannt.rs' ? 'fn z' : 'fn y');
      expect(i, pfad).toBeGreaterThan(0);
      expect(rolle(z, i, wort), pfad).toEqual(['tk-keyword']);
    }
    // umbenannt.rs, beide Seiten: der Kontext `// u4` ist als Rust Kommentar, in der entfernten Zeile `fn alt() {}` ist `fn` Schlüsselwort
    const u = await rollenJeZeile(page, 'umbenannt.rs');
    const texte = await bereich(page, 'umbenannt.rs').evaluate(b => Array.from(b.querySelectorAll('tr'), tr => tr.className + ' ' + tr.querySelector('td:last-child').textContent));
    const u4 = texte.findIndex(t => t.startsWith('ctx') && t.includes('// u4')), x = texte.findIndex(t => t.startsWith('del'));
    expect(rolle(u, u4, '// u4')).toEqual(['tk-comment']);
    expect([x > 0, rolle(u, x, 'fn')]).toEqual([true, ['tk-keyword']]);
    expect(b.konsole.filter(e => /^(error|warning)/.test(e)), 'keine Konsolenmeldung').toEqual([]);
    expect(b.fehler).toEqual([]);
  });

  /* ── UX-Vorprüfung #216: S3 Knoten, Fokus, Scroll; S2 Auswahl; K3 neu aufgeklappt ── */

  test('UX S3: die Auflage ersetzt nur den Inhalt von td.c — Knoten, Fokus und Scrollposition bleiben, kein aria-live/aria-busy', async ({ page }) => {
    let frei;
    const tor = new Promise(r => { frei = r; });
    await page.route(u => u.pathname === '/web/faerben.js', async route => { await tor; await route.continue(); });
    await page.setViewportSize({ width: 600, height: 700 });
    await page.goto(reviewAdresse(k, 2));
    const b = bereich(page, 'zeichen.js');
    await expect(b).toHaveAttribute('data-farbe', 'laeuft');
    await b.evaluate(el => {
      el.dataset.m = '1';
      el.querySelector('.dz-b').dataset.m = '1';
      el.querySelector('tr.add').dataset.m = '1';
      el.querySelector('tr.add td.n').dataset.m = '1';
      el.querySelector('tr.add td.c').dataset.m = '1';
      el.focus();
      el.style.maxWidth = '200px';
      el.scrollLeft = 40;
    });
    const vorher = await b.evaluate(el => ({ links: el.scrollLeft, oben: document.scrollingElement.scrollTop }));
    expect(vorher.links).toBeGreaterThan(0);
    frei();
    await expect(b).toHaveAttribute('data-farbe', 'ja');
    const nachher = await b.evaluate(el => ({
      merker: el.querySelectorAll('[data-m]').length + (el.dataset.m ? 1 : 0),
      fokus: document.activeElement === el, links: el.scrollLeft, oben: document.scrollingElement.scrollTop,
      live: el.querySelectorAll('[aria-live],[aria-busy]').length + (el.closest('[aria-live],[aria-busy]') ? 1 : 0),
      farbig: el.querySelector('tr.add td.c[data-m] [class^="tk-"]') !== null,
    }));
    expect(nachher).toEqual({ merker: 5, fokus: true, links: vorher.links, oben: vorher.oben, live: 0, farbig: true });
  });

  test('UX S2: eine Textauswahl in der Zeile bleibt beim Auflegen der Farbe erhalten', async ({ page }) => {
    let frei;
    const tor = new Promise(r => { frei = r; });
    await page.route(u => u.pathname === '/web/faerben.js', async route => { await tor; await route.continue(); });
    await page.goto(reviewAdresse(k, 2));
    const b = bereich(page, 'src/main.rs');
    await expect(b).toHaveAttribute('data-farbe', 'laeuft');
    const ausgewaehlt = await b.evaluate(el => {
      const zelle = Array.from(el.querySelectorAll('td.c')).find(c => c.textContent.includes('fn main'));
      const text = Array.from(zelle.childNodes).find(n => n.nodeType === 3 && n.data.includes('fn main'));
      const anfang = text.data.indexOf('fn main');
      document.getSelection().setBaseAndExtent(text, anfang, text, anfang + 'fn main'.length);
      return document.getSelection().toString();
    });
    expect(ausgewaehlt).toBe('fn main');
    frei();
    await expect(b).toHaveAttribute('data-farbe', 'ja');
    await expect(b.locator('.tk-keyword', { hasText: 'fn' })).toHaveCount(1);
    expect(await page.evaluate(() => document.getSelection().toString())).toBe('fn main');
  });

  test('UX K3: zuklappen und wieder aufklappen färbt erneut', async ({ page }) => {
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'src/main.rs')).toBe('ja');
    await datei(page, 'src/main.rs').locator('.df-k').click();
    await expect(datei(page, 'src/main.rs').locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    expect(await aufklappenUndWarten(page, 'src/main.rs')).toBe('ja');
    expect(rolle(await rollenJeZeile(page, 'src/main.rs'), 4, 'fn')).toEqual(['tk-keyword']);
  });
});
