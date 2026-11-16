// Tabellen im Markdown (R00176, Karte #184, ADR-0030 Punkte 1–3; node --test).
// Kopfzeile + Trennzeile nach GFM + Zeilen werden eine Tabelle in ihrer Hülle; alles andere bleibt, was es war.
// Die Erwartungen stehen von Hand hier — sie kommen aus R00176 und GFM, nicht aus der Ausgabe des Renderers.
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml } = require('../../web/markdown.js');
const { pruefeStruktur, linkAdressen, ERLAUBTE_PROTOKOLLE } = require('./hilfen/markdown-struktur.js');

const AUF = '<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table>';
const ZU = '</table></div>';
/** Eine Tabelle aus fertigen Zellen: `tabelle('<th>a</th>', '<td>1</td>')`. */
const tabelle = (kopf, ...zeilen) => `${AUF}<thead><tr>${kopf}</tr></thead>${zeilen.length ? `<tbody>${zeilen.map(z => `<tr>${z}</tr>`).join('')}</tbody>` : ''}${ZU}`;
const link = (adresse, text) => `<a href="${adresse}" target="_blank" rel="noopener">${text}</a>`;

/** Rendert, prüft die Struktur der Ausgabe und vergleicht sie. */
function erwarte(eingabe, ausgabe) {
  const html = markdownHtml(eingabe);
  assert.strictEqual(html, ausgabe);
  pruefeStruktur(html, eingabe);
}

test('AK 1 Abnahme-Probe der Karte #184: zwei Spalten, „Wert“ rechts, „a“ fett, das Skript als Text', () => {
  erwarte('| Spalte | Wert |\n|:---|---:|\n| **a** | 1 |\n| <script>alert(1)</script> | 2 |', tabelle(
    '<th class="ta-l">Spalte</th><th class="ta-r">Wert</th>',
    '<td class="ta-l"><strong>a</strong></td><td class="ta-r">1</td>',
    '<td class="ta-l">&lt;script&gt;alert(1)&lt;/script&gt;</td><td class="ta-r">2</td>'));
});

test('AK 2 Ausrichtung: links, mittig, rechts als feste Klasse, ohne Angabe keine — nie style oder align', () => {
  const html = markdownHtml('| a | b | c | d |\n|:--|:-:|--:|---|\n| 1 | 2 | 3 | 4 |');
  assert.strictEqual(html, tabelle(
    '<th class="ta-l">a</th><th class="ta-c">b</th><th class="ta-r">c</th><th>d</th>',
    '<td class="ta-l">1</td><td class="ta-c">2</td><td class="ta-r">3</td><td>4</td>'));
  assert.ok(!/style|align/.test(html));
  erwarte('a|b\n:-|-:\n1|2', tabelle('<th class="ta-l">a</th><th class="ta-r">b</th>', '<td class="ta-l">1</td><td class="ta-r">2</td>'));
  erwarte('| a |\n| :----------: |', tabelle('<th class="ta-c">a</th>'));
});

test('AK 3 Zellen: fett, kursiv, Code und Links wie im Absatz; ein maskierter Strich bleibt ein Strich', () => {
  erwarte('| **f** und *k* | `c` |\n|---|---|\n| [L](https://x.de/a?b=1&c=2) | siehe https://x.de |\n| a \\| b | `x \\| y` |', tabelle(
    '<th><strong>f</strong> und <em>k</em></th><th><code>c</code></th>',
    `<td>${link('https://x.de/a?b=1&amp;c=2', 'L')}</td><td>siehe ${link('https://x.de', 'https://x.de')}</td>`,
    '<td>a | b</td><td><code>x | y</code></td>'));
});

test('AK 3 Zellen: zu wenige werden leer aufgefüllt, überzählige fallen weg', () => {
  erwarte('| x | y | z |\n|---|---|---|\n| a | b |\n| a | b | c | d |\n|\n| nur |', tabelle(
    '<th>x</th><th>y</th><th>z</th>',
    '<td>a</td><td>b</td><td></td>',
    '<td>a</td><td>b</td><td>c</td>',
    '<td></td><td></td><td></td>',
    '<td>nur</td><td></td><td></td>'));
});

test('AK 4 ohne gültige Trennzeile bleibt es Text wie heute', () => {
  erwarte('| a | b |\n| c | d |', '<p>| a | b |<br>| c | d |</p>');
  erwarte('| a | b |\n|---|\n| c | d |', '<p>| a | b |<br>|---|<br>| c | d |</p>');
  erwarte('| a | b |\n|---|---|---|\n| c | d |', '<p>| a | b |<br>|---|---|---|<br>| c | d |</p>');
  erwarte('| a | b |\n|---| |\n| c | d |', '<p>| a | b |<br>|---| |<br>| c | d |</p>');
  erwarte('| a | b |\n|-x-|---|', '<p>| a | b |<br>|-x-|---|</p>');
  erwarte('| a | b |\n|:|:|', '<p>| a | b |<br>|:|:|</p>');
  erwarte('| a | b |\n\n|---|---|', '<p>| a | b |</p><p>|---|---|</p>');
  erwarte('|---|---|\n| a | b |', '<p>|---|---|<br>| a | b |</p>');
  erwarte('| a | b |', '<p>| a | b |</p>');
  erwarte('Ergebnis: bestanden | befund | blockiert', '<p>Ergebnis: bestanden | befund | blockiert</p>');
});

test('AK 4 Kopfzeile und Trennzeile brauchen je einen Strich: eine Linie aus Minuszeichen unter Text ist keine Tabelle', () => {
  erwarte('Titel\n---', '<p>Titel<br>---</p>');
  erwarte('a | b\n---', '<p>a | b<br>---</p>');
  erwarte('Titel\n|---|', '<p>Titel<br>|---|</p>');
});

test('AK 5 Nachbarn: unter einer Textzeile endet der Absatz, unter einem Listenpunkt die Liste', () => {
  const t = tabelle('<th>a</th><th>b</th>', '<td>1</td><td>2</td>');
  erwarte('Messwerte:\n| a | b |\n|---|---|\n| 1 | 2 |', `<p>Messwerte:</p>${t}`);
  erwarte('eins\nzwei\n| a | b |\n|---|---|\n| 1 | 2 |', `<p>eins<br>zwei</p>${t}`);
  erwarte('- Punkt\n| a | b |\n|---|---|\n| 1 | 2 |', `<ul><li>Punkt</li></ul>${t}`);
  erwarte('1. Punkt\n| a | b |\n|---|---|\n| 1 | 2 |\n\n2. weiter', `<ol><li>Punkt</li></ol>${t}<ol><li>weiter</li></ol>`);
});

test('Ende der Tabelle: Leerzeile oder ein anderer Block; eine Zeile ohne Strich ist nach GFM noch eine Zeile', () => {
  const kopf = '<th>a</th><th>b</th>';
  erwarte('| a | b |\n|---|---|\n| 1 | 2 |\n\nDanach.', `${tabelle(kopf, '<td>1</td><td>2</td>')}<p>Danach.</p>`);
  erwarte('| a | b |\n|---|---|\n| 1 | 2 |\nohne Strich', tabelle(kopf, '<td>1</td><td>2</td>', '<td>ohne Strich</td><td></td>'));
  erwarte('| a | b |\n|---|---|\n# Titel', `${tabelle(kopf)}<h3>Titel</h3>`);
  erwarte('| a | b |\n|---|---|\n| 1 | 2 |\n> Zitat', `${tabelle(kopf, '<td>1</td><td>2</td>')}<blockquote>Zitat</blockquote>`);
  erwarte('| a | b |\n|---|---|\n- Punkt', `${tabelle(kopf)}<ul><li>Punkt</li></ul>`);
  erwarte('| a | b |\n|---|---|\n```\n| c |\n```', `${tabelle(kopf)}<pre><code>| c |</code></pre>`);
  erwarte('| a | b |\r\n|---|---|\r\n| 1 | 2 |\r\n', tabelle(kopf, '<td>1</td><td>2</td>'));
  erwarte('| a | b |\n|---|---|\n| 1 | 2 |\n\n| c |\n|---|', `${tabelle(kopf, '<td>1</td><td>2</td>')}${tabelle('<th>c</th>')}`);
});

test('eine Tabelle im Codeblock bleibt Code', () => {
  erwarte('```\n| a | b |\n|---|---|\n```', '<pre><code>| a | b |\n|---|---|</code></pre>');
});

test('Strich in Code und Adresse (GFM): er trennt die Zelle, außer er ist maskiert', () => {
  erwarte('| a | b |\n|---|---|\n| `x | y` | z |', tabelle('<th>a</th><th>b</th>', '<td>`x</td><td>y`</td>'));
  erwarte('| a | b |\n|---|---|\n| `x \\| y` | z |', tabelle('<th>a</th><th>b</th>', '<td><code>x | y</code></td><td>z</td>'));
  erwarte('| a | b |\n|---|---|\n| [L](https://x.de/a|b) | z |', tabelle('<th>a</th><th>b</th>', '<td>[L](https://x.de/a</td><td>b)</td>'));
  erwarte('| a | b |\n|---|---|\n| [L](https://x.de/a\\|b) | z |', tabelle('<th>a</th><th>b</th>', `<td>${link('https://x.de/a|b', 'L')}</td><td>z</td>`));
  erwarte('| `a | b` |\n|---|---|', tabelle('<th>`a</th><th>b`</th>'));
});

test('Sicherheit (a): die Trennzeile trägt nur Minus und Doppelpunkt — sonst ist sie keine, und der Text bleibt Text', () => {
  const FEINDLICH = ['|:---" onclick="alert(1)|---|', '|---|--- class=x|', '|:---:" style="color:red|---|', '|<b>---</b>|---|', '|---|---:ta-r|', '|:-\u0000-|---|', '| ta-r | ta-c |', '|\\|---|---|'];
  for (const trennzeile of FEINDLICH) {
    const eingabe = `| a | b |\n${trennzeile}\n| 1 | 2 |`;
    const html = markdownHtml(eingabe);
    pruefeStruktur(html, eingabe);
    assert.ok(!html.includes('<table'), `keine Tabelle aus ${JSON.stringify(trennzeile)}: ${html}`);
    assert.ok(!/onclick="|style="|class="/.test(html), html);
  }
});

test('Sicherheit (a): fremder Text in Kopf und Zellen erzeugt weder Element noch Attribut', () => {
  erwarte('| <img src=x onerror=alert(1)> | " onclick="x |\n|---|---|\n| </td></tr></table><script>x</script> | <th class="y"> |', tabelle(
    '<th>&lt;img src=x onerror=alert(1)&gt;</th><th>&quot; onclick=&quot;x</th>',
    '<td>&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;&lt;script&gt;x&lt;/script&gt;</td><td>&lt;th class=&quot;y&quot;&gt;</td>'));
  erwarte('| a |\n|---|\n| [x](javascript:alert(1)) |\n| [a"b](x" onmouseover="y) |\n| <!-- x --> &lt; |', tabelle('<th>a</th>',
    '<td>x)</td>', '<td>[a&quot;b](x&quot; onmouseover=&quot;y)</td>', '<td>&lt;!-- x --&gt; &amp;lt;</td>'));
  erwarte('| tabindex="5" role="button" aria-label="Böse" |\n|---|', tabelle('<th>tabindex=&quot;5&quot; role=&quot;button&quot; aria-label=&quot;Böse&quot;</th>'));
});

test('Sicherheit (b): Platzhalter gelten je Zelle — keine Zelle setzt die Marke einer anderen ein', () => {
  erwarte('| `eins` | `zwei` |\n|---|---|\n| `drei` | [L](x.md) `vier` |', tabelle(
    '<th><code>eins</code></th><th><code>zwei</code></th>',
    `<td><code>drei</code></td><td>${link('x.md', 'L')} <code>vier</code></td>`));
  erwarte('| `c` | \u00000\u0000 und \u00001\u0000 |\n|---|---|\n| \u00000\u0000 | [L](x.md) |', tabelle(
    '<th><code>c</code></th><th>0 und 1</th>', `<td>0</td><td>${link('x.md', 'L')}</td>`));
  erwarte('| [L](http://a/ | onmouseover=1/) |\n|---|---|\n| (http://a/x | y) |', tabelle(
    `<th>[L](${link('http://a/', 'http://a/')}</th><th>onmouseover=1/)</th>`,
    `<td>(${link('http://a/x', 'http://a/x')}</td><td>y)</td>`));
  erwarte('| **a | b** |\n|---|---|\n| *c | d* |', tabelle('<th>**a</th><th>b**</th>', '<td>*c</td><td>d*</td>'));
});

test('AK 8 fester Vergleich: genau drei Paare sind jetzt gewollt eine Tabelle', () => {
  erwarte('| Spalte | Wert |\n|:---|---:|\n| **a** | 1 |\n| `b` | 2 |', tabelle(
    '<th class="ta-l">Spalte</th><th class="ta-r">Wert</th>',
    '<td class="ta-l"><strong>a</strong></td><td class="ta-r">1</td>',
    '<td class="ta-l"><code>b</code></td><td class="ta-r">2</td>'));
  erwarte('Messwerte:\n\n| Lauf | Dauer | Ergebnis |\n|---|---:|:---:|\n| 1 | 12 s | grün |\n| 2 | 14 s | **rot** |\n\nQuelle: eigener Lauf.', `<p>Messwerte:</p>${tabelle(
    '<th>Lauf</th><th class="ta-r">Dauer</th><th class="ta-c">Ergebnis</th>',
    '<td>1</td><td class="ta-r">12 s</td><td class="ta-c">grün</td>',
    '<td>2</td><td class="ta-r">14 s</td><td class="ta-c"><strong>rot</strong></td>')}<p>Quelle: eigener Lauf.</p>`);
  erwarte('Name | Wert\n--- | ---\na | 1', tabelle('<th>Name</th><th>Wert</th>', '<td>a</td><td>1</td>'));
});

test('die Strukturprüfung erkennt eine Tabelle außerhalb ihrer festen Form', () => {
  const kopf = '<thead><tr><th>a</th><th class="ta-r">b</th></tr></thead>';
  assert.doesNotThrow(() => pruefeStruktur(`${AUF}${kopf}<tbody><tr><td><em>1</em></td><td class="ta-r">2</td></tr></tbody>${ZU}`));
  const FALSCH = {
    'Tabelle ohne Hülle': `<table>${kopf}</table>`,
    'Hülle mit anderem tabindex': `${AUF.replace('"0"', '"1"')}${kopf}${ZU}`,
    'Hülle mit Attribut aus dem Text': `${AUF.replace('<div ', '<div onfocus="x" ')}${kopf}${ZU}`,
    'Zelle mit fremder Klasse': `${AUF}${kopf.replace('ta-r', 'ta-x')}${ZU}`,
    'Zelle mit style': `${AUF}${kopf.replace('<th>', '<th style="x">')}${ZU}`,
    'Zeile mit weniger Zellen als der Kopf': `${AUF}${kopf}<tbody><tr><td>1</td></tr></tbody>${ZU}`,
    'Spalte mit anderer Klasse als im Kopf': `${AUF}${kopf}<tbody><tr><td class="ta-r">1</td><td>2</td></tr></tbody>${ZU}`,
    'Zelle außerhalb einer Tabelle': '<p><td>x</td></p>',
    'Tabelle in einer Zelle': `${AUF}<thead><tr><th>${AUF}${kopf}${ZU}</th></tr></thead>${ZU}`,
    'Hülle nicht geschlossen': `${AUF}${kopf}</table>`,
  };
  for (const [name, html] of Object.entries(FALSCH)) assert.throws(() => pruefeStruktur(html), /STRUKTUR/, name);
});

test('Zufallslauf: 6000 Eingaben aus Strichen, Marken und Adressen — jede Ausgabe hält die feste Struktur', () => {
  const BAUSTEINE = ['|', '|', '|', '-', '--', ':', '\\', '\\|', '*', '**', '_', '`', '[', ']', '(', ')', '<', '>', '"', "'", ' ', ' ', '\n', '\n',
    'http://', 'https://a.de/', 'javascript:', 'a', 'bc', 'Wort', 'x.md', '\u0000', '0', '\n|---|---|\n', '\n|:-|-:|\n', '\n---|:-:\n', '|--', '# ', '- ', '> ', '```\n'];
  let zustand = 184;
  /** mulberry32 — fester Startwert, damit jeder Lauf dieselben Eingaben prüft. */
  const zufall = () => {
    zustand = (zustand + 0x6D2B79F5) | 0;
    let t = Math.imul(zustand ^ (zustand >>> 15), 1 | zustand);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const LAEUFE = 6000;
  let mitTabelle = 0, mitLinkInTabelle = 0;
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const laenge = 4 + Math.floor(zufall() * 28);
    const eingabe = Array.from({ length: laenge }, () => BAUSTEINE[Math.floor(zufall() * BAUSTEINE.length)]).join('');
    const html = markdownHtml(eingabe);
    pruefeStruktur(html, eingabe);
    for (const adresse of linkAdressen(html)) {
      assert.ok(ERLAUBTE_PROTOKOLLE.includes(new URL(adresse, 'http://localhost/').protocol), `GEFÄHRLICH: ${JSON.stringify(adresse)} aus ${JSON.stringify(eingabe)}`);
    }
    if (html.includes('<table>')) mitTabelle++;
    if (/<t[hd][^>]*>[^]*?<a /.test(html)) mitLinkInTabelle++;
  }
  // Ein Zufallslauf ohne Treffer beweist nichts: genug Ausgaben müssen wirklich eine Tabelle sein.
  assert.ok(mitTabelle >= 600, `nur ${mitTabelle} von ${LAEUFE} Eingaben ergaben eine Tabelle`);
  assert.ok(mitLinkInTabelle >= 50, `nur ${mitLinkInTabelle} Tabellen mit Link`);
  console.log(`Zufallslauf: ${LAEUFE} Eingaben, ${mitTabelle} mit Tabelle, ${mitLinkInTabelle} mit Link in einer Tabelle`);
});
