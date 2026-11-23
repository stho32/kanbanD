// R00247 B1297: die Wortmarke im Zeichnen einer Datei — Paarung vorab über die ganze Zeilenliste (ein Lauf über die Blockgrenze von 500
// Zeilen wird wie ohne Grenze gepaart), Blöcke tragen die Marke, der Farbauftrag trägt sie mit, und die Auflage ersetzt die Zelle mit
// derselben Marke.
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');
const { auflegen } = require('../../web/farbschlange.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const marken = html => [...html.matchAll(/<mark class="wm">(.*?)<\/mark>/g)].map(m => m[1]);
const nrAus = html => Number(/data-farbe-nr="(\d+)"/.exec(html)[1]);

/** K-Block: Kopf (0), 248 × (Kontext, hinzugefügt), Kontext (497), gelöscht 498–500, hinzugefügt 501–503. */
function blockPatch() {
  const z = ['@@ -1,253 +1,501 @@'];
  for (let i = 1; i <= 249; i++) { z.push(` c${i}`); if (i < 249) z.push(`+n${i}`); }
  z.push('-d1 = 1;', '-d2 = 1;', '-d3 = 1;', '+d1 = 2;', '+d2 = 2;', '+d3 = 2;', ' z');
  return z.join('\n') + '\n';
}

test('AK 1: codeHtml zeichnet die Marke im ersten Zeichnen, ohne Farbe (unbekannte Endung)', () => {
  const html = d.codeHtml('@@ -1 +1 @@\n-let a = 1;\n+let a = 2;\n', 'w.xyz', esc);
  assert.match(html, /data-farbe="nein"/);
  assert.deepStrictEqual(marken(html), ['1', '2']);
});

test('AK 6: ein Lauf über die Blockgrenze wird gepaart — zwei Marken im ersten Block, vier im zweiten', () => {
  const patch = blockPatch();
  const zeilen = d.patchZeilen(patch);
  assert.deepStrictEqual([zeilen[499].text, zeilen[500].text], ['d2 = 1;', 'd3 = 1;']);
  const html = d.codeHtml(patch, 'src/g.rs', esc);
  const bloecke = html.split('<div class="dz-b"').slice(1);
  assert.strictEqual(bloecke.length, 2);
  assert.deepStrictEqual(bloecke.map(marken), [['1', '1'], ['1', '2', '2', '2']]);
});

test('AK 5: der Farbauftrag trägt die Marken, und die Auflage ersetzt die Zelle mit derselben Marke außen um die Farbe', () => {
  const html = d.codeHtml('@@ -1 +1 @@\n-let s = "alt";\n+let s = "neu";\n', 'src/w.rs', esc);
  const auftrag = d.farbAuftragHolen(nrAus(html));
  assert.deepStrictEqual(auftrag.zeilen.map(z => z.wm || null), [null, [9, 12], [9, 12]]);
  const zellen = auftrag.zeilen.map(() => ({ innerHTML: '' }));
  const jeZeile = zellen.map(z => [z]);
  let fertig = false;
  auflegen({ zellen: jeZeile, zeilen: auftrag.zeilen, stuecke: Int32Array.from([1, 8, 13, 1, 2, 8, 13, 1]), esc, planen: f => f(), aktuell: () => true, fertig: () => { fertig = true; } });
  assert.ok(fertig);
  assert.strictEqual(zellen[1].innerHTML, '<span class="vh">entfernt: </span>let s = <span class="tk-string">&quot;</span><mark class="wm"><span class="tk-string">alt</span></mark><span class="tk-string">&quot;</span>;');
  assert.deepStrictEqual(marken(zellen[2].innerHTML), ['<span class="tk-string">neu</span>']);
});

test('AK 10: ohne Paar (nur hinzugefügt, nur gelöscht, Kontext) zeichnet codeHtml keine Marke', () => {
  const html = d.codeHtml('@@ -1,2 +1,2 @@\n a\n-x = 1;\n mitte\n+x = 2;\n', 'src/a.rs', esc);
  assert.deepStrictEqual(marken(html), []);
  assert.ok(!html.includes('<mark'));
});
