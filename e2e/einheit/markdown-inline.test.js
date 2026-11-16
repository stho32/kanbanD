// Markdown in einer Zeile (R00177, Karte #185; ADR-0030 Punkt 7; node --test).
// `markdownInline` formatiert den Text einer Teilaufgabe: Link, nackte Adresse, Code, fett, kursiv — nie ein Block.
// Fremder Text bleibt Text; die Adresse eines Links wird nie formatiert.
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml, markdownInline, markdownOhneMarken } = require('../../web/markdown.js');
const paare = require('./markdown-vorher.json');
const { pruefeInlineStruktur, linkAdressen, ERLAUBTE_PROTOKOLLE } = require('./hilfen/markdown-struktur.js');

const link = (adresse, text) => `<a href="${adresse}" target="_blank" rel="noopener">${text}</a>`;

/** Was in ein Attribut gesetzt wird, trägt nie ein Zeichen, das eine Marke öffnet oder das Attribut schließt. */
function pruefeOhneMarken(eingabe) {
  const name = markdownOhneMarken(eingabe);
  assert.ok(!/[<>"]/.test(name), `ATTRIBUT: ${JSON.stringify(name.slice(0, 160))} aus ${JSON.stringify(eingabe.slice(0, 160))}`);
}

test('AK 1 Abnahme-Probe der Karte: die Adresse ist ein Link in neuem Fenster, „wichtig“ fett', () => {
  assert.strictEqual(markdownInline('siehe https://example.org und **wichtig**'), `siehe ${link('https://example.org', 'https://example.org')} und <strong>wichtig</strong>`);
});

test('AK 2: kursiv, Code und Link mit Text werden formatiert', () => {
  assert.strictEqual(markdownInline('*schräg*'), '<em>schräg</em>');
  assert.strictEqual(markdownInline('`code`'), '<code>code</code>');
  assert.strictEqual(markdownInline('[Doku](https://example.org)'), link('https://example.org', 'Doku'));
  assert.strictEqual(markdownInline('erst `a*b*` dann **fett** und *schräg*'), 'erst <code>a*b*</code> dann <strong>fett</strong> und <em>schräg</em>');
  assert.strictEqual(markdownInline(''), '');
});

test('AK 2: Blöcke gibt es in einer Zeile nicht — Überschrift, Liste, Zitat, Tabelle und Codezaun bleiben Text', () => {
  const BLEIBT = ['# x', '## x', '- x', '* x', '+ x', '1. x', '| a | b |', '|---|---|', '```', '```js'];
  for (const zeile of BLEIBT) assert.strictEqual(markdownInline(zeile), zeile);
  assert.strictEqual(markdownInline('> x'), '&gt; x');
  assert.strictEqual(markdownInline('| a | b |\n|---|---|\n| 1 | 2 |'), '| a | b |\n|---|---|\n| 1 | 2 |');
  assert.strictEqual(markdownInline('# **fett** im Titel'), '# <strong>fett</strong> im Titel');
});

test('AK 7: fremder Text bleibt Text', () => {
  assert.strictEqual(markdownInline('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.strictEqual(markdownInline('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.strictEqual(markdownInline('[x](javascript:document.title=1)'), 'x');
  assert.strictEqual(markdownInline('[x](\u0001javascript:alert%281%29)'), 'x');
  assert.strictEqual(markdownInline('[a"b](x" onmouseover="y)'), '[a&quot;b](x&quot; onmouseover=&quot;y)');
  assert.strictEqual(markdownInline('a \u00000\u0000 `c`'), 'a 0 <code>c</code>');
  assert.strictEqual(markdownInline('![Bild](https://example.org/b.png)'), `!${link('https://example.org/b.png', 'Bild')}`);
});

test('AK 8: die Adresse eines Links wird nie formatiert — über beide Einstiege', () => {
  const MIT_STERNEN = 'https://example.org/a*b*c';
  assert.strictEqual(markdownInline(MIT_STERNEN), link(MIT_STERNEN, MIT_STERNEN));
  assert.strictEqual(markdownInline(`[a](${MIT_STERNEN}) und *schräg*`), `${link(MIT_STERNEN, 'a')} und <em>schräg</em>`);
  assert.strictEqual(markdownHtml(MIT_STERNEN), `<p>${link(MIT_STERNEN, MIT_STERNEN)}</p>`);
  assert.deepStrictEqual(linkAdressen(markdownInline('siehe https://example.org/x?a=1&b=2')), ['https://example.org/x?a=1&b=2']);
});

test('zwei Einstiege, ein Kern: eine Zeile ohne Block ergibt in der Beschreibung denselben Inhalt im Absatz', () => {
  const ZEILEN = ['siehe https://example.org und **wichtig**', '*a [b](x*y) c*', '[**fett** und `code`](x.md)', 'a < b & "c"', '`**kein fett**`'];
  for (const zeile of ZEILEN) assert.strictEqual(markdownHtml(zeile), `<p>${markdownInline(zeile)}</p>`);
});

test('Schaden (b): der Text ohne Markdown-Zeichen für zugängliche Namen bleibt maskiert', () => {
  assert.strictEqual(markdownOhneMarken('[Doku](https://example.org/doku) *lesen*, dann `--probe` setzen'), 'Doku lesen, dann --probe setzen');
  assert.strictEqual(markdownOhneMarken('siehe https://example.org und **wichtig**'), 'siehe https://example.org und wichtig');
  assert.strictEqual(markdownOhneMarken('a "b" <c> & d'), 'a &quot;b&quot; &lt;c&gt; &amp; d');
  assert.strictEqual(markdownOhneMarken('x" onfocus="y" [L](https://example.org/?a="1"&b=<2>) <b>k</b>'), 'x&quot; onfocus=&quot;y&quot; L &lt;b&gt;k&lt;/b&gt;');
  assert.strictEqual(markdownOhneMarken('# x und [x](javascript:document.title=1)'), '# x und x');
});

test('fester Vergleich als Zeile: jede Eingabe des Bestands hält die Struktur einer Zeile, ganz und Zeile für Zeile', () => {
  let mitMarke = 0;
  for (const paar of paare) {
    for (const eingabe of [paar.eingabe, ...paar.eingabe.split('\n')]) {
      const html = markdownInline(eingabe);
      pruefeInlineStruktur(html, eingabe);
      pruefeOhneMarken(eingabe);
      if (html.includes('<')) mitMarke++;
    }
  }
  assert.ok(mitMarke >= 100, `nur ${mitMarke} Eingaben mit einer Marke`);
});

test('die Prüfung selbst erkennt einen Block in einer Zeile', () => {
  for (const block of ['<p>a</p>', '<h3>a</h3>', '<ul><li>a</li></ul>', '<blockquote>a</blockquote>', '<pre><code>a</code></pre>', 'a<br>b',
    '<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table><thead><tr><th>a</th></tr></thead></table></div>']) {
    assert.throws(() => pruefeInlineStruktur(block), /STRUKTUR: Block-Marke/, block);
  }
  assert.throws(() => pruefeInlineStruktur('<a href="x" onclick="y" target="_blank" rel="noopener">k</a>'), /STRUKTUR/);
  assert.doesNotThrow(() => pruefeInlineStruktur(`a &lt;b&gt; ${link('x?a=1&amp;b=2', '<strong>k</strong>')} <em>e</em> <code>c</code>`));
});

test('Zufallslauf: 6000 Zeilen aus Marken, Adressen und Blockanfängen — jede Ausgabe hält die Struktur einer Zeile', () => {
  const BAUSTEINE = ['*', '*', '**', '**', '_', '`', '`', '[', ']', '(', ')', '](', '<', '>', '"', "'", ' ', ' ', ' ', '\n', '|', '\\',
    'http://', 'https://a.de/', ' https://a.de/x', 'javascript:', 'a', 'bc', 'Wort', 'x.md', '\u0000', '0', '\u0001', '&#58;', '# ', '- ', '> ', '1. ', '```', '|---|---|', '<script>'];
  let zustand = 185;
  /** mulberry32 — fester Startwert, damit jeder Lauf dieselben Eingaben prüft. */
  const zufall = () => {
    zustand = (zustand + 0x6D2B79F5) | 0;
    let t = Math.imul(zustand ^ (zustand >>> 15), 1 | zustand);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  /** Wie der Browser die Adresse liest; eine Adresse, die er gar nicht lesen kann (`http://[`), führt nirgends hin. */
  const protokoll = adresse => {
    if (!URL.canParse(adresse, 'http://localhost/')) return /^(https?:)\/\//i.exec(adresse)[1].toLowerCase();
    return new URL(adresse, 'http://localhost/').protocol;
  };
  const LAEUFE = 6000;
  let mitLink = 0, mitHervorhebung = 0, mitCode = 0;
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const laenge = 4 + Math.floor(zufall() * 28);
    const eingabe = Array.from({ length: laenge }, () => BAUSTEINE[Math.floor(zufall() * BAUSTEINE.length)]).join('');
    const html = markdownInline(eingabe);
    pruefeInlineStruktur(html, eingabe);
    for (const adresse of linkAdressen(html)) assert.ok(ERLAUBTE_PROTOKOLLE.includes(protokoll(adresse)), `GEFÄHRLICH: ${JSON.stringify(adresse)} aus ${JSON.stringify(eingabe)}`);
    pruefeOhneMarken(eingabe);
    if (html.includes('<a ')) mitLink++;
    if (/<(?:strong|em)>/.test(html)) mitHervorhebung++;
    if (html.includes('<code>')) mitCode++;
  }
  // Ein Zufallslauf ohne Treffer beweist nichts: genug Ausgaben müssen wirklich Marken tragen.
  console.log(`Zufallslauf Zeile: ${LAEUFE} Eingaben, ${mitLink} mit Link, ${mitHervorhebung} mit Hervorhebung, ${mitCode} mit Code`);
  assert.ok(mitLink >= 1500, `nur ${mitLink} von ${LAEUFE} Eingaben mit Link`);
  assert.ok(mitHervorhebung >= 600, `nur ${mitHervorhebung} mit Hervorhebung`);
  assert.ok(mitCode >= 600, `nur ${mitCode} mit Code`);
});
