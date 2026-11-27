// Tabellen im Markdown (R00176, Karte #184, ADR-0030 Punkte 1–3; node --test).
// Kopfzeile + Trennzeile nach GFM + Zeilen werden eine Tabelle in ihrer Hülle; alles andere bleibt, was es war.
// Die Erwartungen stehen von Hand hier — sie kommen aus R00176 und GFM, nicht aus der Ausgabe des Renderers.
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml } = require('../../web/markdown.js');
const { pruefeStruktur, linkAdressen, ERLAUBTE_PROTOKOLLE } = require('./hilfen/markdown-struktur.js');
const { messung, SPRUNG } = require('./hilfen/lastprobe.js');

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
  // seit R00178 (AK 4) ist die Zeile aus Minuszeichen eine Trennlinie — eine Tabelle wird sie weiterhin nie
  erwarte('Titel\n---', '<p>Titel</p><hr>');
  erwarte('a | b\n---', '<p>a | b</p><hr>');
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
  erwarte('| a | b |\n|---|---|\n| [L](https://x.de/a|b) | z |', tabelle('<th>a</th><th>b</th>', `<td>[L](${link('https://x.de/a', 'https://x.de/a')}</td><td>b)</td>`));
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
  /** Wie der Browser die Adresse liest. Eine Adresse, die er gar nicht lesen kann (`http://[`), führt nirgends hin — das gibt es nur bei http und https. */
  const protokoll = adresse => {
    if (!URL.canParse(adresse, 'http://localhost/')) return /^(https?:)\/\//i.exec(adresse)[1].toLowerCase();
    return new URL(adresse, 'http://localhost/').protocol;
  };
  const LAEUFE = 6000;
  let mitTabelle = 0, mitLinkInTabelle = 0;
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const laenge = 4 + Math.floor(zufall() * 28);
    const eingabe = Array.from({ length: laenge }, () => BAUSTEINE[Math.floor(zufall() * BAUSTEINE.length)]).join('');
    const html = markdownHtml(eingabe);
    pruefeStruktur(html, eingabe);
    for (const adresse of linkAdressen(html)) assert.ok(ERLAUBTE_PROTOKOLLE.includes(protokoll(adresse)), `GEFÄHRLICH: ${JSON.stringify(adresse)} aus ${JSON.stringify(eingabe)}`);
    if (html.includes('<table>')) mitTabelle++;
    if ((html.match(/<table>[^]*?<\/table>/g) || []).some(tabelle => tabelle.includes('<a '))) mitLinkInTabelle++;
  }
  // Ein Zufallslauf ohne Treffer beweist nichts: genug Ausgaben müssen wirklich eine Tabelle sein.
  assert.ok(mitTabelle >= 600, `nur ${mitTabelle} von ${LAEUFE} Eingaben ergaben eine Tabelle`);
  assert.ok(mitLinkInTabelle >= 50, `nur ${mitLinkInTabelle} Tabellen mit Link`);
  console.log(`Zufallslauf: ${LAEUFE} Eingaben, ${mitTabelle} mit Tabelle, ${mitLinkInTabelle} mit Link in einer Tabelle`);
});

// Nacharbeit nach dem Security-Review (Karte #184): kurze Zeilen werden auf die Spaltenzahl des Kopfs aufgefüllt, die Ausgabe
// wüchse also mit Spalten × Zeilen. Über der Grenze bleibt der ganze Block Text wie ohne Tabellen (ADR-0030 Punkt 9).
const MAX_SPALTEN = 50, MAX_ZELLEN = 5000;
const gitter = (spalten, zeilen) => `${'a|'.repeat(spalten)}\n${'-|'.repeat(spalten)}\n${'x\n'.repeat(zeilen)}`;

test('Größe: 2000 Spalten × 2000 Zeilen bleiben Text — kleine Ausgabe, alles sichtbar', () => {
  const eingabe = gitter(2000, 2000);
  const html = markdownHtml(eingabe);
  console.log(`Größe: ${eingabe.length} Zeichen Eingabe → ${html.length} Zeichen Ausgabe`);
  assert.ok(html.length < 4 * eingabe.length, `Ausgabe ${html.length} Zeichen aus ${eingabe.length}`);
  assert.ok(!html.includes('<table'));
  assert.strictEqual(html, `<p>${eingabe.trimEnd().split('\n').join('<br>')}</p>`);
  pruefeStruktur(html);
});

test('Größe Lastprobe: 2000 Spalten × 2000 Zeilen in unter 200 ms gerechnet', SPRUNG, () => {
  const eingabe = gitter(2000, 2000);
  const beginn = process.hrtime.bigint();
  const html = markdownHtml(eingabe);
  const dauerMs = Number(process.hrtime.bigint() - beginn) / 1e6;
  if (!messung('Größe Lastprobe 2000 × 2000', `${eingabe.length} Zeichen → ${html.length} Zeichen in ${dauerMs.toFixed(1)} ms (Grenze 200 ms)`)) return;
  assert.ok(dauerMs < 200, `${dauerMs.toFixed(0)} ms`);
  assert.ok(!html.includes('<table'));
  assert.strictEqual(html, `<p>${eingabe.trimEnd().split('\n').join('<br>')}</p>`);
});

test('Größe: genau an der Grenze entsteht noch eine Tabelle, eine Spalte oder eine Zeile darüber nicht mehr', () => {
  const zeilenAnDerGrenze = MAX_ZELLEN / MAX_SPALTEN - 1; // der Kopf zählt mit
  const zellen = html => (html.match(/<t[hd]>/g) || []).length;
  const anDerGrenze = markdownHtml(gitter(MAX_SPALTEN, zeilenAnDerGrenze));
  assert.strictEqual(zellen(anDerGrenze), MAX_ZELLEN);
  pruefeStruktur(anDerGrenze);
  for (const [name, eingabe] of [['eine Spalte mehr', gitter(MAX_SPALTEN + 1, 1)], ['eine Zeile mehr', gitter(MAX_SPALTEN, zeilenAnDerGrenze + 1)], ['eine Zeile mehr bei einer Spalte', gitter(1, MAX_ZELLEN)]]) {
    assert.strictEqual(markdownHtml(eingabe), `<p>${eingabe.trimEnd().split('\n').join('<br>')}</p>`, name);
  }
  assert.strictEqual(zellen(markdownHtml(gitter(1, MAX_ZELLEN - 1))), MAX_ZELLEN);
  // Über der Grenze wird auch kein Stück des Blocks eine Tabelle: eine Trennzeile mitten in den Zeilen bleibt Text.
  const mitTrennzeile = `${gitter(MAX_SPALTEN, zeilenAnDerGrenze)}-|\ny|`;
  assert.ok(!markdownHtml(mitTrennzeile).includes('<table'));
  // Der Block endet an der Leerzeile: die Tabelle danach wird wieder eine.
  assert.ok(markdownHtml(`${gitter(MAX_SPALTEN + 1, 1)}\n| a |\n|---|`).endsWith(tabelle('<th>a</th>')));
});

/** Die drei Eingaben des 50-000-Striche-Falls: Kopf ohne Rumpf, Kopf mit Trennzeile, 300 Reihen zu 300 Spalten. */
const kopfEingaben = [
  ['Kopf ohne Rumpf', `${'a|'.repeat(50000)}\n${'-|'.repeat(50000)}`],
  ['Kopf mit Trennzeile', `${'a|'.repeat(50000)}\n-|-|`],
  ['300 × 300', Array.from({ length: 300 }, () => 'a|'.repeat(300)).join('\n')],
];

test('Größe: ein Kopf mit 50 000 Strichen bleibt Text — klein und ohne Tabelle, mit und ohne Trennzeile', () => {
  for (const [name, eingabe] of kopfEingaben) {
    const html = markdownHtml(eingabe);
    assert.ok(!html.includes('<table') && html.length < 2 * eingabe.length, name);
  }
});

test('Größe Lastprobe: ein Kopf mit 50 000 Strichen in unter 200 ms gerechnet', SPRUNG, () => {
  for (const [name, eingabe] of kopfEingaben) {
    const beginn = process.hrtime.bigint();
    const html = markdownHtml(eingabe);
    const dauerMs = Number(process.hrtime.bigint() - beginn) / 1e6;
    if (!messung(`Größe Lastprobe ${name}`, `${dauerMs.toFixed(0)} ms (Grenze 200 ms)`)) return;
    assert.ok(dauerMs < 200, `${name}: ${dauerMs.toFixed(0)} ms`);
    assert.ok(!html.includes('<table') && html.length < 2 * eingabe.length, name);
  }
});

test('Größe: die Grenze der Zellen gilt für alle Tabellen eines Textes zusammen — viele Tabellen an der Grenze blähen nichts auf', () => {
  const halb = gitter(MAX_SPALTEN, MAX_ZELLEN / MAX_SPALTEN / 2 - 1);
  const zwei = markdownHtml(`${halb}\n${halb}`);
  assert.strictEqual((zwei.match(/<table>/g) || []).length, 2);
  assert.strictEqual((zwei.match(/<t[hd]>/g) || []).length, MAX_ZELLEN);
  const drei = markdownHtml(`${halb}\n${halb}\n| a |\n|---|\n| 1 |\n\nEnde`);
  assert.strictEqual((drei.match(/<table>/g) || []).length, 2);
  assert.ok(drei.endsWith('<p>| a |<br>|---|<br>| 1 |</p><p>Ende</p>'));
  pruefeStruktur(drei);
  // Der schlimmste Fall: 250 Tabellen an der Grenze aus 100 000 Zeichen.
  const eingabe = Array.from({ length: 250 }, () => gitter(MAX_SPALTEN, MAX_ZELLEN / MAX_SPALTEN - 1)).join('\n');
  const beginn = process.hrtime.bigint();
  const html = markdownHtml(eingabe);
  const dauerMs = Number(process.hrtime.bigint() - beginn) / 1e6;
  console.log(`Größe: 250 Tabellen an der Grenze, ${eingabe.length} Zeichen Eingabe → ${html.length} Zeichen Ausgabe in ${dauerMs.toFixed(1)} ms`);
  assert.strictEqual((html.match(/<table>/g) || []).length, 1);
  // Größe statt Zeit: der Rest ist Text, und Text wächst nur um seine `<br>` (aus `x` + Umbruch werden fünf Zeichen).
  assert.ok(html.length < 3 * eingabe.length, `${html.length} Zeichen aus ${eingabe.length}`);
  pruefeStruktur(html);
});
