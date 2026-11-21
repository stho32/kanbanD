// R00217 Syntaxfarben in der Review-Seite (Karte #216, I0207, Scheibe B4, ADR-0040) — AK 1–10 im echten Programm gegen echtes Git.
// Ausgangslage: farben-hilfen.js (R mit K1 an #2, K2 an #3, K3 an #4). Über Farbe wird erst geurteilt, wenn der Diffbereich
// `data-farbe="ja"` oder `"nein"` trägt — ereignisgenau, nie nach Zeit (ADR-0026). Konsole im Testkörper urteilen, dann abbauen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen } = require('./hilfen');
const { farbenRepository, farbenVorbereiten, kommentarAnlegen } = require('./farben-hilfen');

/* ── Treiber ── */
const reviewAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

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
});
