// R00217 B1132 (ADR-0040 Punkt 5, ADR-0037 Punkt 6): Farbe als Auflage — die Codezelle aus `sichtbarTeile` an den Token-Versätzen
// geteilt, Marken mit Vorrang und ohne Farbe; sofort ungefärbt mit `data-farbe`, dann blockweise ein Block zu 500 Zeilen je Aufgabe.
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');
const { auflegen } = require('../../web/farbschlange.js');
const { hunkTokens, prism } = require('../../web/faerben.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** Die Auflage ohne ihre Farbstücke: jedes `tk-…`-Element enthält nur Text, nie eine Marke. */
const ohneFarbe = html => html.replace(/<span class="tk-[a-z]+">([^<]*)<\/span>/g, '$1');
const klassen = html => [...html.matchAll(/class="([^"]*)"/g)].map(m => m[1]);
const plus = text => ({ art: 'plus', alt: null, neu: 1, text });

test('zelleHtml: ohne Stücke genau der Inhalt der Codezelle von heute (Lesetext + sichtbar gemacht)', () => {
  const z = plus('fn main() {}');
  assert.strictEqual(d.zelleHtml(z, esc), `<span class="vh">hinzugefügt: </span>${d.sichtbarHtml(z.text, esc)}`);
  assert.ok(d.codeHtml('@@ -0,0 +1 @@\n+fn main() {}\n', 'a.txt', esc).includes(`<td class="c">${d.zelleHtml(z, esc)}</td>`));
});

test('zelleHtml: Stücke werden zu tk-Spans an ihren Versätzen, der Rest bleibt Text', () => {
  const html = d.zelleHtml(plus('fn main() {}'), esc, [[0, 2, 0], [3, 7, 4]]);
  assert.strictEqual(html, '<span class="vh">hinzugefügt: </span><span class="tk-keyword">fn</span> <span class="tk-function">main</span>() {}');
});

test('zelleHtml: Invariante — ohne die tk-Spans bleibt genau die ungefärbte Zelle; Marken ohne Farbe und mit Vorrang (Bidi, \\r, U+2028, Tab, HTML)', () => {
  const faelle = ['let s = "‮abc";', 'let r = 1;\r', 'let u = 1; let v = 2;', '\tlet t = 3;', '<img src=x onerror=window.PWN=1>', 'a\u0000b\u007Fc​d'];
  for (const text of faelle) {
    const z = plus(text);
    const st = hunkTokens(d.patchZeilen(`@@ -0,0 +1 @@\n+${text}\n`), prism.languages.javascript);
    const stuecke = [];
    for (let k = 0; k < st.length; k += 4) stuecke.push([st[k + 1], st[k + 2], st[k + 3]]);
    // ein Stück über die ganze Zeile prüft den Vorrang der Marken, auch wenn die Grammatik sie nicht trifft
    for (const s of [stuecke, [[0, text.length, 1]]]) {
      const html = d.zelleHtml(z, esc, s);
      assert.strictEqual(ohneFarbe(html), d.zelleHtml(z, esc), JSON.stringify(text));
      assert.ok(klassen(html).every(k => /^(tk-(keyword|string|comment|number|function|type|macro)|vh|mk-z mk-bidi|mk-z mk-st|i)$/.test(k)), klassen(html).join(','));
      assert.ok(!/<img/.test(html), 'fremdes HTML nur maskiert');
    }
  }
  const bidi = d.zelleHtml(plus('let s = "‮abc";'), esc, [[8, 14, 1]]);
  assert.ok(bidi.includes('<span class="tk-string">&quot;</span><span class="mk-z mk-bidi"'), 'der String endet vor der Marke');
  assert.ok(bidi.includes('</span><span class="tk-string">abc&quot;</span>'), 'und geht nach ihr weiter');
});

test('codeHtml: data-farbe „laeuft“ mit Auftrag nur bei bekannter Sprache innerhalb der Grenzen, sonst „nein“ ohne Auftrag', () => {
  const nr = html => (/data-farbe-nr="(\d+)"/.exec(html) || [])[1];
  const rs = d.codeHtml('@@ -0,0 +1 @@\n+fn main() {}\n', 'src/main.rs', esc);
  assert.match(rs, /<div class="df-sc" tabindex="0" role="region" aria-label="[^"]*" data-farbe="laeuft" data-farbe-nr="\d+">/);
  const auftrag = d.farbAuftragHolen(Number(nr(rs)));
  assert.strictEqual(auftrag.sprache, 'rust');
  assert.deepStrictEqual(auftrag.zeilen, d.patchZeilen('@@ -0,0 +1 @@\n+fn main() {}\n'));
  assert.strictEqual(d.farbAuftragHolen(Number(nr(rs))), null, 'ein Auftrag wird genau einmal geholt');
  for (const [patch, pfad] of [['@@ -0,0 +1 @@\n+fn x() {}\n', 'Makefile'], ['@@ -0,0 +1 @@\n+fn x() {}\n', 'Typ.TS'], [`@@ -0,0 +1 @@\n+${'a'.repeat(1000)}\n`, 'drueber.rs']]) {
    const html = d.codeHtml(patch, pfad, esc);
    assert.ok(html.includes('data-farbe="nein"') && !html.includes('data-farbe-nr'), pfad);
  }
  assert.ok(!/aria-live|aria-busy/.test(rs), 'kein aria-live, kein aria-busy (UX S3)');
});

test('codeHtml: liegengebliebene Aufträge sind begrenzt — der älteste fällt, wenn mehr als 500 warten', () => {
  const erste = Number(/data-farbe-nr="(\d+)"/.exec(d.codeHtml('@@ -0,0 +1 @@\n+a\n', 'a.rs', esc))[1]);
  for (let i = 0; i < 500; i++) d.codeHtml('@@ -0,0 +1 @@\n+a\n', 'a.rs', esc);
  assert.strictEqual(d.farbAuftragHolen(erste), null);
});

/* ── Auflage blockweise ── */

function fakeZellen(n) {
  return Array.from({ length: n }, () => ({ gesetzt: 0, _html: 'alt', set innerHTML(v) { this._html = v; this.gesetzt++; }, get innerHTML() { return this._html; } }));
}

test('auflegen: 10.000 Zeilen in 20 Aufgaben zu je höchstens 500 Zeilen, „fertig“ erst nach der letzten', () => {
  const zeilen = Array.from({ length: 10000 }, () => plus('let a = 1;'));
  const zellen = fakeZellen(10000);
  const st = [];
  for (let i = 0; i < 10000; i++) st.push(i, 0, 3, 0);
  const aufgaben = [];
  let fertig = 0;
  auflegen({ zellen, zeilen, stuecke: Int32Array.from(st), esc, planen: f => aufgaben.push(f), aktuell: () => true, fertig: () => fertig++ });
  assert.strictEqual(aufgaben.length, 1, 'die erste Aufgabe ist geplant, noch nichts gezeichnet');
  assert.strictEqual(zellen.filter(z => z.gesetzt).length, 0);
  const jeAufgabe = [];
  while (aufgaben.length) {
    const vorher = zellen.filter(z => z.gesetzt).length;
    aufgaben.shift()();
    jeAufgabe.push(zellen.filter(z => z.gesetzt).length - vorher);
  }
  assert.strictEqual(jeAufgabe.length, 20);
  assert.ok(jeAufgabe.every(n => n <= 500), jeAufgabe.join(','));
  assert.strictEqual(fertig, 1);
  assert.strictEqual(zellen[9999].innerHTML, '<span class="vh">hinzugefügt: </span><span class="tk-keyword">let</span> a = 1;');
});

test('auflegen: Zeilen ohne Stück bleiben unberührt; ist die Datei nicht mehr gezeigt, endet die Auflage ohne „fertig“', () => {
  const zeilen = Array.from({ length: 1200 }, () => plus('x'));
  const zellen = fakeZellen(1200);
  const aufgaben = [];
  let gezeigt = true, fertig = 0;
  auflegen({ zellen, zeilen, stuecke: Int32Array.of(0, 0, 1, 2, 700, 0, 1, 2), esc, planen: f => aufgaben.push(f), aktuell: () => gezeigt, fertig: () => fertig++ });
  aufgaben.shift()();
  assert.deepStrictEqual(zellen.map((z, i) => z.gesetzt ? i : -1).filter(i => i >= 0), [0]);
  gezeigt = false;
  aufgaben.shift()();
  assert.strictEqual(zellen[700].gesetzt, 0);
  assert.strictEqual(aufgaben.length, 0);
  assert.strictEqual(fertig, 0);
});
