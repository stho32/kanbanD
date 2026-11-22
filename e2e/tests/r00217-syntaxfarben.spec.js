// R00217 Syntaxfarben in der Review-Seite (Karte #216, I0207, Scheibe B4, ADR-0040) — AK 1–10 im echten Programm gegen echtes Git.
// Ausgangslage: farben-hilfen.js (R mit K1 an #2, K2 an #3, K3 an #4). Über Farbe wird erst geurteilt, wenn der Diffbereich
// `data-farbe="ja"` oder `"nein"` trägt — ereignisgenau, nie nach Zeit (ADR-0026). Konsole im Testkörper urteilen, dann abbauen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, kontrastAm } = require('./hilfen');
const fs = require('fs');
const path = require('path');
const { farbenRepository, farbenVorbereiten, kommentarAnlegen } = require('./farben-hilfen');

/* ── Treiber ── */
const reviewAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

const regexText = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Der Abschnitt einer Datei der Insel, gefunden über den ganzen Pfad. */
const datei = (page, pfad) => page.locator('#rv-insel .df').filter({ has: page.locator('.df-k .p', { hasText: new RegExp(`^${regexText(pfad)}$`) }) });
/** Der Diffbereich einer Datei. */
const bereich = (page, pfad) => datei(page, pfad).locator('.df-sc');

/** Wartet im Browser, bis die Farbe des Diffbereichs entschieden ist (`ja` oder `nein`), und liefert sie. Gewartet wird mit
    `waitForFunction` in der Seite, nicht mit dem Polling von `expect`: solange Playwright von außen pollt, startet ein neuer
    Worker in Chromium spürbar später (geprobt: über 1,5 s statt 0,1 s), und eine gutartige Datei liefe in die Frist. */
async function farbeAbwarten(page, pfad, timeout = 10000) {
  const el = await bereich(page, pfad).elementHandle();
  // ein abgehängter Bereich (ersetzt beim Warten) beendet das Warten und lässt den Test laut scheitern (Code-Review #216 Sollte 3)
  await page.waitForFunction(e => !e.isConnected || e.dataset.farbe === 'ja' || e.dataset.farbe === 'nein', el, { timeout });
  if (!(await el.evaluate(e => e.isConnected))) throw new Error(`${pfad}: der Diffbereich wurde beim Warten auf die Farbe ersetzt`);
  return el.evaluate(e => e.dataset.farbe);
}

/** Klappt die Datei auf, wenn sie zu ist, und wartet, bis die Farbe entschieden ist. */
async function aufklappenUndWarten(page, pfad) {
  const kopf = datei(page, pfad).locator('.df-k');
  if (await kopf.getAttribute('aria-expanded') !== 'true') await kopf.click();
  return farbeAbwarten(page, pfad);
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
    expect(await farbeAbwarten(page, 'zeichen.js')).toBe('ja');
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
    expect(await farbeAbwarten(page, 'src/main.rs')).toBe('ja');
    await expect(b.locator('.tk-keyword', { hasText: 'fn' })).toHaveCount(1);
    expect(await page.evaluate(() => document.getSelection().toString())).toBe('fn main');
  });

  test('UX S1: erst feindlich.md, dann gut.rs aufgeklappt — gut.rs steht sofort mit Text da und wird gefärbt, sobald feindlich.md nach der Frist endet', async ({ page }) => {
    await page.goto(reviewAdresse(k, 3));
    await alleZu(page);
    await aufklappen(page, 'feindlich.md');
    await expect(bereich(page, 'feindlich.md')).toHaveAttribute('data-farbe', 'laeuft');
    await datei(page, 'gut.rs').locator('.df-k').click();
    await expect(bereich(page, 'gut.rs').locator('td.c')).toHaveText(['hinzugefügt: fn gut() {}']);
    // feindlich.md läuft schon (Zuklappen hat die alten Aufträge beendet), gut.rs wartet dessen Frist ab; das Vorziehen der
    // zuletzt geöffneten Datei vor wartende belegt der Unit-Test der Schlange
    expect(await farbeAbwarten(page, 'gut.rs')).toBe('ja');
    expect(await bereich(page, 'feindlich.md').getAttribute('data-farbe'), 'feindlich.md war vor gut.rs fertig').toBe('nein');
    await expect(bereich(page, 'gut.rs').locator('.tk-keyword', { hasText: 'fn' })).toHaveCount(1);
  });

  test('UX K3: zuklappen und wieder aufklappen färbt erneut', async ({ page }) => {
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'src/main.rs')).toBe('ja');
    await datei(page, 'src/main.rs').locator('.df-k').click();
    await expect(datei(page, 'src/main.rs').locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    expect(await aufklappenUndWarten(page, 'src/main.rs')).toBe('ja');
    expect(rolle(await rollenJeZeile(page, 'src/main.rs'), 4, 'fn')).toEqual(['tk-keyword']);
  });

  /* ── AK 9 Farben und Kontrast (B1110) ── */

  const ROLLEN = ['tk-keyword', 'tk-string', 'tk-comment', 'tk-number', 'tk-function', 'tk-type', 'tk-macro'];
  /** Die vier Themenlagen: System und gewähltes Thema. */
  const LAGEN = [['hell', 'light', null], ['System dunkel', 'dark', null], ['erzwungen dunkel', 'light', 'dark'], ['erzwungen hell bei System dunkel', 'dark', 'light']];

  test('AK 9: hell und dunkel verschieden, jede Rolle ≥ 4,5:1 auf Kontext, hinzugefügt und entfernt in vier Themenlagen (84 Messungen), nur der Kommentar kursiv', async ({ page }, info) => {
    await page.goto(reviewAdresse(k, 2));
    // gemessen wird erst an der gefärbten Datei (UX S4), an der Codezelle td.c je Zeilenart (UX-Vorprüfung Runde 1)
    expect(await aufklappenUndWarten(page, 'src/seiten.rs')).toBe('ja');
    expect(await aufklappenUndWarten(page, 'src/main.rs')).toBe('ja');
    // je Zeilenart und Rolle ein Messstück in der Codezelle von src/seiten.rs (Kontext, entfernt, hinzugefügt)
    await bereich(page, 'src/seiten.rs').evaluate((b, rollen) => {
      for (const art of ['ctx', 'add', 'del']) {
        const zelle = b.querySelector(`tr.${art} td.c`);
        for (const r of rollen) zelle.insertAdjacentHTML('beforeend', `<span class="${r}" data-mess="${art}">Xg</span>`);
      }
    }, ROLLEN);
    const keyword = page.locator('#rv-insel .df-sc .tk-keyword').first();
    const messungen = [], farben = {};
    for (const [lage, system, gewaehlt] of LAGEN) {
      await page.emulateMedia({ colorScheme: system });
      await page.evaluate(t => { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }, gewaehlt);
      farben[lage] = await keyword.evaluate(e => getComputedStyle(e).color);
      for (const art of ['ctx', 'add', 'del']) {
        for (const r of ROLLEN) {
          const stueck = bereich(page, 'src/seiten.rs').locator(`[data-mess="${art}"].${r}`);
          const wert = await kontrastAm(stueck);
          const kursiv = await stueck.evaluate(e => getComputedStyle(e).fontStyle);
          messungen.push({ lage, art, rolle: r, wert: Math.round(wert * 100) / 100, kursiv });
        }
      }
    }
    await info.attach('kontrast-84.json', { body: JSON.stringify(messungen, null, 1), contentType: 'application/json' });
    if (process.env.KD_KONTRAST_AUS) fs.writeFileSync(process.env.KD_KONTRAST_AUS, JSON.stringify({ farben, messungen }, null, 1));
    expect(messungen).toHaveLength(84);
    expect(messungen.filter(m => !(m.wert >= 4.5)), 'alle ≥ 4,5:1').toEqual([]);
    expect(messungen.filter(m => (m.kursiv === 'italic') !== (m.rolle === 'tk-comment')), 'nur der Kommentar kursiv').toEqual([]);
    expect(farben['hell']).not.toBe(farben['System dunkel']);
    expect(farben['erzwungen dunkel']).toBe(farben['System dunkel']);
    expect(farben['erzwungen hell bei System dunkel']).toBe(farben['hell']);
  });

  test('AK 9: --kd-tk-* stehen in allen drei Themen-Blöcken von kd-tokens.css, kd-app.css färbt tk-… nur über Tokens', async () => {
    const web = path.resolve(__dirname, '../../web');
    const tokens = fs.readFileSync(path.join(web, 'kd-tokens.css'), 'utf8');
    const bloecke = [
      tokens.slice(tokens.indexOf(':root{'), tokens.indexOf('@media (prefers-color-scheme:dark)')),
      tokens.slice(tokens.indexOf('@media (prefers-color-scheme:dark)'), tokens.indexOf(':root[data-theme="dark"]')),
      tokens.slice(tokens.indexOf(':root[data-theme="dark"]'), tokens.indexOf('@media (pointer:coarse)')),
    ];
    for (const [i, block] of bloecke.entries()) {
      for (const r of ['keyword', 'string', 'comment', 'number', 'function', 'type', 'macro']) expect(block, `Block ${i + 1}: --kd-tk-${r}`).toMatch(new RegExp(`--kd-tk-${r}:oklch\\(`));
    }
    const app = fs.readFileSync(path.join(web, 'kd-app.css'), 'utf8');
    const regeln = app.split('}').filter(r => /\.tk-/.test(r));
    expect(regeln.length).toBeGreaterThan(0);
    expect(regeln.filter(r => /color:(?!var\(--kd-tk-)/.test(r)), 'keine Farbe als Literal').toEqual([]);
  });

  /* ── AK 1 Messziel, AK 5 Grenze und Frist, AK 6 Fehlerpfad, AK 7 unverändert (B1111) ── */

  /** Long Tasks der Seite ab dem Laden (PerformanceObserver `longtask`), mit Startzeit. */
  async function langeAufgabenBeobachten(page) {
    await page.addInitScript(() => {
      window.kdLang = [];
      // Zeitpunkt, an dem ein Diffbereich mit `data-farbe="laeuft"` eingesetzt ist (alle Zeilen stehen ungefärbt, PO Z. 489)
      window.kdLaeuft = {};
      new MutationObserver(eintraege => eintraege.forEach(e => e.addedNodes.forEach(k => {
        if (k.nodeType !== 1) return;
        for (const b of [k, ...k.querySelectorAll('.df-sc')]) if (b.matches('.df-sc[data-farbe="laeuft"]') && !(b.getAttribute('aria-label') in window.kdLaeuft)) window.kdLaeuft[b.getAttribute('aria-label')] = performance.now();
      }))).observe(document, { childList: true, subtree: true });
      new PerformanceObserver(l => l.getEntries().forEach(e => window.kdLang.push({ start: e.startTime, dauer: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
    });
  }
  const jetzt = page => page.evaluate(() => performance.now());
  const langeSeit = async (page, t0, name = '') => {
    const alle = await page.evaluate(t => window.kdLang.filter(e => e.start >= t), t0);
    // Lastbeobachtung für den Bericht (kein Kriterium): alle Long Tasks ab dem Auslöser, mit KD_MESS_AUS in eine Datei
    if (process.env.KD_MESS_AUS) fs.appendFileSync(process.env.KD_MESS_AUS, JSON.stringify({ name, dauern: alle.map(e => e.dauer) }) + '\n');
    return alle.filter(e => e.dauer > 150);
  };

  /** Alle Dateien zu, dann warten, bis kein Diffbereich mehr steht. */
  async function alleZu(page) {
    await page.getByRole('button', { name: 'Alle einklappen' }).click();
    await expect(page.locator('#rv-insel .df-sc')).toHaveCount(0);
  }

  /** Klappt eine Datei auf. feindlich.md ist seit R00235 Doku: sie steht in der eingeklappten Gruppe „Doku und Planung“, und das
      Öffnen der Gruppe zeigt ihre Dateien offen (FA 4, Bild 7 e) — für sie ist der Gruppenkopf der Klick, der sie aufklappt. */
  async function aufklappen(page, pfad) {
    if (pfad.endsWith('.md')) await page.locator('section.rv-gr').filter({ hasText: pfad }).locator('.rv-gk').click();
    else await datei(page, pfad).locator('.df-k').click();
    await expect(datei(page, pfad).locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
  }

  test('AK 1: feindlich.md, feindlich.html, feindlich.js — Text sofort, Ende ohne Farbe, kein Long Task über 150 ms; danach gut.rs gefärbt', async ({ page }) => {
    test.setTimeout(60000);
    const b = beobachten(page);
    await langeAufgabenBeobachten(page);
    await page.goto(reviewAdresse(k, 3));
    await expect(page.locator('#rv-insel .df')).toHaveCount(4);
    await alleZu(page);
    for (const [pfad, zeilen] of [['feindlich.md', 64], ['feindlich.html', 64], ['feindlich.js', 261]]) {
      const t0 = await jetzt(page);
      await aufklappen(page, pfad);
      await expect(bereich(page, pfad)).toHaveAttribute('data-farbe', 'laeuft');
      // solange gefärbt wird, steht der Text schon ganz da
      const texte = await bereich(page, pfad).evaluate(el => Array.from(el.querySelectorAll('tr:not(.hk) td.c'), c => c.textContent));
      expect(texte.length, pfad).toBe(zeilen);
      expect(texte.every(t => t.length === 'hinzugefügt: '.length + 999), pfad).toBe(true);
      expect(await farbeAbwarten(page, pfad), pfad).toBe('nein');
      expect(await bereich(page, pfad).locator('[class^="tk-"]').count(), pfad).toBe(0);
      expect(await langeSeit(page, t0, pfad), `${pfad}: Long Tasks über 150 ms`).toEqual([]);
    }
    expect(await aufklappenUndWarten(page, 'gut.rs')).toBe('ja');
    await expect(bereich(page, 'gut.rs').locator('.tk-keyword', { hasText: 'fn' })).toHaveCount(1);
    expect(b.konsole, 'keine Konsolenmeldung').toEqual([]);
    expect(b.fehler).toEqual([]);
  });

  test('AK 1: lang.rs (10.000 Zeilen über „Änderungen anzeigen“) endet gefärbt, `let` in Zeile 1 und 10.000, kein Long Task über 150 ms', async ({ page }) => {
    test.setTimeout(60000);
    await langeAufgabenBeobachten(page);
    await page.goto(reviewAdresse(k, 4));
    const anzeigen = datei(page, 'lang.rs').getByRole('button', { name: 'Änderungen anzeigen' });
    await expect(anzeigen).toBeVisible();
    const t0 = await jetzt(page);
    await anzeigen.click();
    expect(await farbeAbwarten(page, 'lang.rs', 15000)).toBe('ja');
    const tLaeuft = await page.evaluate(() => window.kdLaeuft['Änderungen in lang.rs']);
    expect(tLaeuft).toBeGreaterThan(t0);
    // Long Tasks vor „laeuft“ gehören zum ungefärbten Zeichnen (R00207): gemessen, ohne Grenze (PO Z. 489)
    await langeSeit(page, t0, 'lang.rs ungefärbt, ab Klick');
    const ersteUndLetzte = await bereich(page, 'lang.rs').evaluate(el => {
      const zeilen = Array.from(el.querySelectorAll('tr:not(.hk)'));
      const kw = tr => Array.from(tr.querySelectorAll('.tk-keyword'), e => e.textContent);
      return [zeilen.length, kw(zeilen[0]), kw(zeilen[zeilen.length - 1]), el.querySelectorAll('.dz-b').length];
    });
    // 10.000 Zeilen und der Hunk-Kopf sind 10.001 Patch-Zeilen, also 21 Blöcke zu höchstens 500
    expect(ersteUndLetzte).toEqual([10000, ['let'], ['let'], 21]);
    expect(await langeSeit(page, tLaeuft, 'lang.rs ab laeuft'), 'Long Tasks über 150 ms ab data-farbe="laeuft"').toEqual([]);
  });

  /** Eine Rust-Datei mit genau `laenge` Zeichen Patch, Zeilen höchstens 1.000 Zeichen, jede beginnt mit `fn`. */
  function rustPatch(laenge) {
    const kopf = '@@ -0,0 +1,300 @@';
    const teile = [kopf];
    let n = kopf.length;
    while (n < laenge) {
      const rest = laenge - n - 1;
      const z = ('+fn g() {} //' + 'a'.repeat(1000)).slice(0, Math.min(1000, rest));
      teile.push(z);
      n += 1 + z.length;
    }
    const p = teile.join('\n');
    if (p.length !== laenge) throw new Error(`Länge ${p.length}`);
    return p;
  }

  test('AK 5: Grenze — 262.144 Zeichen gefärbt, 262.145 in keiner Zeile (feste Antwort); grenze.rs gefärbt, drueber.rs nicht; ohne Hinweis', async ({ page }) => {
    const b = beobachten(page);
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'grenze.rs')).toBe('ja');
    await expect(bereich(page, 'grenze.rs').locator('.tk-keyword', { hasText: 'fn' })).toHaveCount(1);
    expect(await aufklappenUndWarten(page, 'drueber.rs')).toBe('nein');
    expect(await bereich(page, 'drueber.rs').locator('[class^="tk-"]').count()).toBe(0);
    await expect(datei(page, 'drueber.rs').locator('.df-inhalt')).not.toContainText(/Farbe|Hervorhebung|zu groß/);
    // feste Antwort: grenze.rs mit genau 262.144 Zeichen Patch, drueber.rs mit 262.145
    const ersetzen = x => {
      if (Array.isArray(x)) return x.forEach(ersetzen);
      if (!x || typeof x !== 'object') return;
      if (typeof x.patch === 'string' && x.neu === 'grenze.rs') x.patch = rustPatch(262144);
      if (typeof x.patch === 'string' && x.neu === 'drueber.rs') x.patch = rustPatch(262145);
      Object.values(x).forEach(ersetzen);
    };
    await page.route(u => u.pathname === '/api/aufgaben/2/diff', async route => {
      const echt = await route.fetch();
      const json = await echt.json();
      ersetzen(json);
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });
    await page.reload();
    await alleZu(page);
    expect(await aufklappenUndWarten(page, 'grenze.rs'), '262.144').toBe('ja');
    expect(await bereich(page, 'grenze.rs').locator('tr:not(.hk)').count()).toBeGreaterThan(250);
    expect(await bereich(page, 'grenze.rs').locator('tr:last-child .tk-keyword').first().textContent()).toBe('fn');
    expect(await aufklappenUndWarten(page, 'drueber.rs'), '262.145').toBe('nein');
    expect(await bereich(page, 'drueber.rs').locator('[class^="tk-"]').count()).toBe(0);
    expect(b.konsole).toEqual([]);
  });

  test('AK 5: Frist — feindlich.md bleibt nach 1.000 ms ohne Farbe, in keiner Zeile eine Rolle, ohne Konsoleneintrag und ohne Hinweis', async ({ page }) => {
    const b = beobachten(page);
    await page.goto(reviewAdresse(k, 3));
    await alleZu(page);
    await aufklappen(page, 'feindlich.md');
    expect(await farbeAbwarten(page, 'feindlich.md')).toBe('nein');
    expect(await bereich(page, 'feindlich.md').locator('[class^="tk-"]').count()).toBe(0);
    await expect(datei(page, 'feindlich.md').locator('.df-inhalt')).not.toContainText(/Farbe|Hervorhebung/);
    expect(b.konsole).toEqual([]);
    expect(b.fehler).toEqual([]);
  });

  test('ADR-0040 N1: bleibt die Antwort auf prism.js aus, wird der Worker nie bereit — nach der Frist ohne Farbe, danach färbt ein neuer Worker', async ({ page }) => {
    const b = beobachten(page);
    let haengt = true;
    await page.route(u => u.pathname === '/web/vendor/prism.js', async route => {
      if (haengt) return; // nie beantwortet: importScripts blockiert, der Worker meldet nie „bereit“
      await route.continue();
    });
    await page.goto(reviewAdresse(k, 2));
    await alleZu(page);
    const t0 = await jetzt(page);
    await datei(page, 'src/main.rs').locator('.df-k').click();
    expect(await farbeAbwarten(page, 'src/main.rs')).toBe('nein');
    expect(await jetzt(page) - t0, 'erst nach der Frist von 1.000 ms').toBeGreaterThanOrEqual(1000);
    expect(await bereich(page, 'src/main.rs').locator('[class^="tk-"]').count()).toBe(0);
    haengt = false;
    expect(await aufklappenUndWarten(page, 'src/seiten.rs'), 'ein neuer Worker färbt').toBe('ja');
    expect(b.konsole).toEqual([]);
    expect(b.fehler).toEqual([]);
  });

  test('Sichtzustand: der Querscrollstand eines Codebereichs übersteht das Neuzeichnen (Codeblöcke beim Sichern übersprungen)', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 700 });
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'grenze.rs')).toBe('ja');
    const b = bereich(page, 'grenze.rs');
    await b.evaluate(el => { el.dataset.m = '1'; el.scrollLeft = 300; document.scrollingElement.scrollTop = 200; });
    const vorher = await b.evaluate(el => [el.scrollLeft, document.scrollingElement.scrollTop]);
    expect(vorher[0]).toBe(300);
    // Neuzeichnen wie nach jedem Live-Ereignis: `render()` sichert und setzt die Scrollstände (sichtzustand.js `rollstaende`)
    await page.evaluate(() => render());
    expect(await b.evaluate(el => [el.dataset.m, el.scrollLeft, document.scrollingElement.scrollTop])).toEqual(['1', ...vorher]);
  });

  test('AK 6: ohne Farbe und still — prism.js 404, faerben.js 404, kein Worker, tokenize wirft', async ({ page }) => {
    const b = beobachten(page);
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'src/main.rs')).toBe('ja');
    const textMitFarbe = await bereich(page, 'src/main.rs').evaluate(el => Array.from(el.querySelectorAll('tr'), tr => tr.textContent));
    const faelle = [
      ['(a) prism.js 404', u => u.pathname === '/web/vendor/prism.js', route => route.fulfill({ status: 404, body: '' })],
      ['(b) faerben.js 404', u => u.pathname === '/web/faerben.js', route => route.fulfill({ status: 404, body: '' })],
      ['(d) tokenize wirft', u => u.pathname === '/web/vendor/prism.js', async route => { const echt = await route.fetch(); await route.fulfill({ response: echt, body: (await echt.text()) + '\nPrism.tokenize=function(){throw new Error("kaputt")};' }); }],
      ['(c) ohne Worker', null, null],
    ];
    let vorige = null;
    for (const [name, muster, antwort] of faelle) {
      // nur die eigene Route des vorigen Falls entfernen — eine Mutante (mutanteEinsetzen) bleibt eingesetzt
      if (vorige) await page.unroute(vorige[0], vorige[1]);
      vorige = muster ? [muster, antwort] : null;
      if (muster) await page.route(muster, antwort);
      else await page.addInitScript(() => { delete window.Worker; });
      b.konsole.length = 0;
      await page.reload();
      expect(await aufklappenUndWarten(page, 'src/main.rs'), name).toBe('nein');
      expect(await bereich(page, 'src/main.rs').locator('[class^="tk-"]').count(), name).toBe(0);
      expect(await bereich(page, 'src/main.rs').evaluate(el => Array.from(el.querySelectorAll('tr'), tr => tr.textContent)), name).toEqual(textMitFarbe);
      expect(b.konsole.filter(e => !/404|Failed to load resource/.test(e)), `${name}: nur die Ladefehlermeldung`).toEqual([]);
      if (name.startsWith('(c)')) expect(await page.evaluate(() => typeof window.Worker)).toBe('undefined');
    }
    expect(b.fehler, 'kein pageerror').toEqual([]);
  });

  test('AK 7: zeichen.js mit und ohne Farbe — Text, Marken (Zahl und Farbe), Zeilennummern, Blöcke und Blockbreite gleich, PWN nie gesetzt, nur erlaubte Klassen', async ({ page }) => {
    const erfassen = () => bereich(page, 'zeichen.js').evaluate(el => ({
      zeilen: Array.from(el.querySelectorAll('tr'), tr => ({ text: (tr.querySelector('td.c') || tr.firstElementChild).textContent, n: Array.from(tr.querySelectorAll('td.n'), n => n.textContent) })),
      marken: { bidi: el.querySelectorAll('.mk-bidi').length, steuer: el.querySelectorAll('.mk-st').length, texte: Array.from(el.querySelectorAll('.mk-z'), m => m.textContent) },
      markenFarbe: Array.from(el.querySelectorAll('.mk-z'), m => [getComputedStyle(m).color, getComputedStyle(m).backgroundColor]),
      bloecke: Array.from(el.querySelectorAll('.dz-b'), d => d.getAttribute('style')),
      klassen: [...new Set(Array.from(el.querySelectorAll('td.c *'), e => e.getAttribute('class') || ''))].sort(),
      pwn: typeof window.PWN,
      img: el.querySelectorAll('img').length,
    }));
    await page.goto(reviewAdresse(k, 2));
    expect(await aufklappenUndWarten(page, 'zeichen.js')).toBe('ja');
    const mit = await erfassen();
    await page.route(u => u.pathname === '/web/vendor/prism.js', route => route.fulfill({ status: 404, body: '' }));
    await page.reload();
    expect(await aufklappenUndWarten(page, 'zeichen.js')).toBe('nein');
    const ohne = await erfassen();
    expect(mit.marken).toEqual({ bidi: 1, steuer: 2, texte: ['⟨U+202E⟩', '␍', 'U+2028'] });
    expect({ ...mit, klassen: null }).toEqual({ ...ohne, klassen: null });
    expect(mit.pwn).toBe('undefined');
    expect(mit.img).toBe(0);
    expect(mit.zeilen.some(z => z.text.includes('<img src=x onerror=window.PWN=1>'))).toBe(true);
    const erlaubt = /^(tk-(keyword|string|comment|number|function|type|macro)|vh|mk-z mk-bidi|mk-z mk-st|i|)$/;
    expect(mit.klassen.filter(k => !erlaubt.test(k)), 'nur tk-… und Marken').toEqual([]);
    expect(mit.klassen.some(k => k.startsWith('tk-'))).toBe(true);
    expect(mit.klassen.some(k => /token/.test(k))).toBe(false);
  });
});
