// Geschachtelte Listen, Trennlinie, `_kursiv_`, `__fett__`, `~~durchgestrichen~~` und `####` (R00178, Karte #186; node --test).
// Die Erwartungen stehen von Hand hier — sie kommen aus R00178 und ADR-0030 (Punkte 5, 6 und 9), nicht aus der Ausgabe des Renderers.
// Kommentare laufen durch denselben `markdownHtml` wie die Beschreibung: was hier gilt, gilt für beide.
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml, markdownInline, markdownOhneMarken } = require('../../web/markdown.js');
const { pruefeStruktur, pruefeInlineStruktur, linkAdressen, ERLAUBTE_PROTOKOLLE } = require('./hilfen/markdown-struktur.js');

/** Karte #186: rote Spezifikation vor dem Bau — die Markierung fällt mit der genannten Bubble. */
const rot = bubble => ({ todo: `erwartet rot bis ${bubble}` });
const link = (adresse, text) => `<a href="${adresse}" target="_blank" rel="noopener">${text}</a>`;

/** Rendert als Beschreibung oder Kommentar, prüft die Struktur der Ausgabe und vergleicht sie. */
function erwarte(eingabe, ausgabe) {
  const html = markdownHtml(eingabe);
  assert.strictEqual(html, ausgabe, JSON.stringify(eingabe));
  pruefeStruktur(html, eingabe);
}

/** Rendert als eine Zeile (Teilaufgabe), prüft die Struktur der Ausgabe und vergleicht sie. */
function erwarteZeile(eingabe, ausgabe) {
  const html = markdownInline(eingabe);
  assert.strictEqual(html, ausgabe, JSON.stringify(eingabe));
  pruefeInlineStruktur(html, eingabe);
}

test('AK 1 Abnahme-Probe der Karte #186: drei Ebenen, Linie, „schräg“ kursiv, „weg“ durchgestrichen, cost_from_column unverändert', rot('B0875'), () => {
  erwarte('- a\n  1. b\n    - c\n\n---\n\n_schräg_ und ~~weg~~ und cost_from_column',
    '<ul><li>a<ol><li>b<ul><li>c</li></ul></li></ol></li></ul><hr><p><em>schräg</em> und <del>weg</del> und cost_from_column</p>');
  erwarte('siehe https://example.org und **wichtig**', `<p>siehe ${link('https://example.org', 'https://example.org')} und <strong>wichtig</strong></p>`);
});

test('AK 2: _kursiv_, __fett__ und ~~durchgestrichen~~ in Beschreibung, Zeile und Tabellenzelle', rot('B0873'), () => {
  erwarteZeile('_schräg_', '<em>schräg</em>');
  erwarteZeile('__fett__', '<strong>fett</strong>');
  erwarteZeile('~~weg~~', '<del>weg</del>');
  erwarteZeile('erst _zwei Wörter_, dann __noch zwei__ und ~~ganz weg~~.', 'erst <em>zwei Wörter</em>, dann <strong>noch zwei</strong> und <del>ganz weg</del>.');
  erwarteZeile('(_in Klammern_) „__in Zeichen__“ "~~weg~~" <_spitz_>', '(<em>in Klammern</em>) „<strong>in Zeichen</strong>“ &quot;<del>weg</del>&quot; &lt;<em>spitz</em>&gt;');
  erwarte('# _T_ und ~~alt~~', '<h3><em>T</em> und <del>alt</del></h3>');
  erwarte('- _a_\n- ~~b~~', '<ul><li><em>a</em></li><li><del>b</del></li></ul>');
  erwarte('| a | b |\n|---|---|\n| _x_ | ~~y~~ |',
    '<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td><em>x</em></td><td><del>y</del></td></tr></tbody></table></div>');
  assert.strictEqual(markdownOhneMarken('_schräg_ und ~~weg~~ und __fett__'), 'schräg und weg und fett');
});

test('AK 2: nur an Wortgrenzen — Bezeichner, Dateinamen und Zahlen mit Unterstrich oder Tilde bleiben unverändert', () => {
  const BLEIBT = ['cost_from_column', '__init__.py', 'snake_case_wort', 'a_b_ c_d_', '_privat', 'ende_', '__dunder', '2_3_4', 'wort_mit_ende_ und _anfang_mit_wort',
    'obj.__dict__', 'self.__init__()', '__init__()', 'pfad/_teil_/datei', 'a~~b~~c', '~~x~~y', 'x~~y~~', '~ungefähr~', '~~ leer ~~', '_ leer _', '__ leer __', '~~~~', '____', '__', '_', '~~',
    'größe_in_µm', 'über_schrift_ä', '_a_b', 'a_b_', '~/ordner und ~/zwei', '2~~3~~4'];
  for (const text of BLEIBT) {
    erwarteZeile(text, text);
    erwarte(text, `<p>${text}</p>`);
  }
});

test('AK 2 und Sicherheit (b): Adressen, Code und Platzhalter bleiben unangetastet — keine Stufe formatiert in eine fertige Marke', rot('B0873'), () => {
  for (const adresse of ['https://x.org/a_b_c', 'https://x.org/a_b_c_d', 'https://x.org/_a_/__b__/~~c~~', 'https://x.org/~nutzer/~~x~~']) {
    erwarteZeile(adresse, link(adresse, adresse));
    erwarteZeile(`_vor_ ${adresse} ~~nach~~`, `<em>vor</em> ${link(adresse, adresse)} <del>nach</del>`);
    assert.deepStrictEqual(linkAdressen(markdownHtml(`[_Text_](${adresse})`)), [adresse]);
  }
  erwarteZeile('__init__.py liegt unter https://x.org/a_b_c', `__init__.py liegt unter ${link('https://x.org/a_b_c', 'https://x.org/a_b_c')}`);
  erwarteZeile('[a_b_](http://x/_y_)', link('http://x/_y_', 'a_b_'));
  erwarteZeile('[_schräg_ und ~~weg~~](http://x/_y_?a=~~b~~)', link('http://x/_y_?a=~~b~~', '<em>schräg</em> und <del>weg</del>'));
  erwarteZeile('`_x_`', '<code>_x_</code>');
  erwarteZeile('`__x__` und `~~x~~` und _y_', '<code>__x__</code> und <code>~~x~~</code> und <em>y</em>');
  erwarteZeile('_a `_b_` c_', '<em>a <code>_b_</code> c</em>');
  // ein gefälschter Platzhalter zwischen den Zeichen ergibt nichts: U+0000 wird vorher entfernt
  erwarteZeile('_\u00000\u0000_ `c`', '<em>0</em> <code>c</code>');
  erwarteZeile('~~\u00001\u0000~~ [L](x.md) `c`', `<del>1</del> ${link('x.md', 'L')} <code>c</code>`);
});

test('AK 2: Formen ineinander und über Kreuz — jede Marke schließt, was sie geöffnet hat', rot('B0873'), () => {
  erwarteZeile('_a **b** c_', '<em>a <strong>b</strong> c</em>');
  erwarteZeile('**a _b_ c**', '<strong>a <em>b</em> c</strong>');
  erwarteZeile('~~a _b_ **c**~~', '<del>a <em>b</em> <strong>c</strong></del>');
  erwarteZeile('__a ~~b~~__', '<strong>a <del>b</del></strong>');
  erwarteZeile('*a _b* c_', '*a <em>b* c</em>');
  erwarteZeile('_a *b_ c*', '<em>a *b</em> c*');
  erwarteZeile('~~a _b~~ c_', '<del>a _b</del> c_');
  erwarteZeile('_a_ _b_ __c__ __d__', '<em>a</em> <em>b</em> <strong>c</strong> <strong>d</strong>');
});

test('AK 3: geschachtelte Listen — drei Ebenen, Punkte und Nummern gemischt', rot('B0875'), () => {
  erwarte('- a\n  1. b\n    - c', '<ul><li>a<ol><li>b<ul><li>c</li></ul></li></ol></li></ul>');
  erwarte('- a\n  - b\n    - c\n  - d\n- e', '<ul><li>a<ul><li>b<ul><li>c</li></ul></li><li>d</li></ul></li><li>e</li></ul>');
  erwarte('1. a\n   - b\n   - c\n2. d', '<ol><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ol>');
  erwarte('- a\n\t- b\n\t\t- c', '<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>');
  erwarte('- a\n    - tief\n- b\n  - flacher', '<ul><li>a<ul><li>tief</li></ul></li><li>b<ul><li>flacher</li></ul></li></ul>');
  erwarte('- a\n    - b\n  - c', '<ul><li>a<ul><li>b</li></ul><ul><li>c</li></ul></li></ul>');
  erwarte('- a\n  - b\n  1. c\n  - d', '<ul><li>a<ul><li>b</li></ul><ol><li>c</li></ol><ul><li>d</li></ul></li></ul>');
  erwarte('- **a**\n  - [L](x.md) und `c`', `<ul><li><strong>a</strong><ul><li>${link('x.md', 'L')} und <code>c</code></li></ul></li></ul>`);
});

test('AK 3 und AK 7: flache Listen bleiben, wie sie waren — ein Zeichen Einrückung schachtelt nicht', rot('B0875'), () => {
  erwarte('- a\n- b', '<ul><li>a</li><li>b</li></ul>');
  erwarte('- a\n - b\n- c', '<ul><li>a</li><li>b</li><li>c</li></ul>');
  erwarte('  - a\n  - b', '<ul><li>a</li><li>b</li></ul>');
  erwarte('- a\n1. b\n- c', '<ul><li>a</li></ul><ol><li>b</li></ol><ul><li>c</li></ul>');
  erwarte('- a\n\n  - b', '<ul><li>a</li></ul><ul><li>b</li></ul>');
  erwarte('- a\n  Text darunter', '<ul><li>a</li></ul><p>  Text darunter</p>');
  erwarte('Text\n  - a\n    - b\nText', '<p>Text</p><ul><li>a<ul><li>b</li></ul></li></ul><p>Text</p>');
});

test('AK 3: Nachbarn — Überschrift, Zitat, Tabelle, Linie und Codezaun beenden alle offenen Ebenen', rot('B0875'), () => {
  for (const [block, html] of [['# T', '<h3>T</h3>'], ['> z', '<blockquote>z</blockquote>'], ['---', '<hr>'], ['```\nc\n```', '<pre><code>c</code></pre>'],
    ['| k |\n|---|', '<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table><thead><tr><th>k</th></tr></thead></table></div>']]) {
    erwarte(`- a\n  - b\n    - c\n${block}\n- d`, `<ul><li>a<ul><li>b<ul><li>c</li></ul></li></ul></li></ul>${html}<ul><li>d</li></ul>`);
  }
});

test('Schaden (c): die Tiefe ist begrenzt — über acht Ebenen bleibt die Einrückung flach', rot('B0875'), () => {
  const zeilen = Array.from({ length: 12 }, (leer, ebene) => `${'  '.repeat(ebene)}- e${ebene}`);
  const html = markdownHtml(zeilen.join('\n'));
  pruefeStruktur(html);
  assert.strictEqual((html.match(/<ul>/g) || []).length, 8);
  assert.ok(html.includes('<li>e7</li><li>e8</li><li>e9</li><li>e10</li><li>e11</li>'), html);
  erwarte(`${zeilen.join('\n')}\n- oben`, `${html.slice(0, -'</ul>'.length)}<li>oben</li></ul>`);
});

test('AK 4 Trennlinie: --- auf eigener Zeile wird eine Linie, auch direkt unter Text — nie Überschrift, nie Tabelle', rot('B0874'), () => {
  erwarte('---', '<hr>');
  erwarte('oben\n\n---\n\nunten', '<p>oben</p><hr><p>unten</p>');
  erwarte('oben\n---\nunten', '<p>oben</p><hr><p>unten</p>');
  erwarte('-----   ', '<hr>');
  erwarte('   ---', '<hr>');
  erwarte('# T\n---\n> z\n---', '<h3>T</h3><hr><blockquote>z</blockquote><hr>');
  assert.ok(!/<h\d/.test(markdownHtml('Titel\n---')), 'keine Überschrift aus der Zeile darüber');
  // nur, was R00178 nennt: andere Zeichen, zu wenige Striche und Text auf der Zeile bleiben Text
  for (const text of ['--', '***', '___', '- - -', '--- x', 'x ---', '-- -', '—']) assert.ok(!markdownHtml(`a\n\n${text}\n\nb`).includes('<hr>'), text);
  erwarte('```\n---\n```', '<pre><code>---</code></pre>');
  erwarteZeile('---', '---');
});

test('AK 4 Trennlinie und Tabelle: die Tabelle hat Vorrang nur mit gültiger Kopfzeile und gleicher Spaltenzahl in einer Trennzeile mit Strich', rot('B0874'), () => {
  const TABELLE = '<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table>';
  // gültig: Kopf mit Strich, Trennzeile mit Strich und gleicher Spaltenzahl
  assert.ok(markdownHtml('| a |\n|---|').startsWith(TABELLE));
  assert.ok(markdownHtml('a | b\n--- | ---\n1 | 2').startsWith(TABELLE));
  // eine Zeile nur aus Minuszeichen trägt keinen Strich: sie ist nie Trennzeile, immer Linie
  erwarte('| a |\n---', '<p>| a |</p><hr>');
  erwarte('a | b\n---\n1 | 2', '<p>a | b</p><hr><p>1 | 2</p>');
  erwarte('a\n---\n| b |', '<p>a</p><hr><p>| b |</p>');
  // die Linie beendet eine Tabelle, sie wird keine Zeile der Tabelle
  erwarte('| a |\n|---|\n| 1 |\n---\nText', `${TABELLE}<thead><tr><th>a</th></tr></thead><tbody><tr><td>1</td></tr></tbody></table></div><hr><p>Text</p>`);
});

test('AK 4 Überschrift: #### wird eine Stufe kleiner als ### — im Aufgabenfenster h6; fünf Rauten bleiben Text', rot('B0874'), () => {
  erwarte('#### T', '<h6>T</h6>');
  erwarte('### T\n#### U', '<h5>T</h5><h6>U</h6>');
  assert.strictEqual(markdownHtml('#### T', 0), '<h4>T</h4>');
  erwarte('##### T', '<p>##### T</p>');
  erwarte('####T', '<p>####T</p>');
  erwarte('#### _a_ ~~b~~', '<h6><em>a</em> <del>b</del></h6>');
});

test('AK 5: ein mehrzeiliger Kommentar behält seine Zeilenumbrüche; Liste, Link, Code und Tabelle wie in der Beschreibung', () => {
  erwarte('Stand:\n- erledigt\n- offen', '<p>Stand:</p><ul><li>erledigt</li><li>offen</li></ul>');
  erwarte('Zeile eins\nZeile zwei\n\nZeile vier', '<p>Zeile eins<br>Zeile zwei</p><p>Zeile vier</p>');
  erwarte('siehe `x_y` in [Doku](a_b.md)', `<p>siehe <code>x_y</code> in ${link('a_b.md', 'Doku')}</p>`);
});

test('AK 6: fremder Text bleibt Text — auch in den neuen Formen', rot('B0875'), () => {
  erwarte('_<script>alert(1)</script>_', '<p><em>&lt;script&gt;alert(1)&lt;/script&gt;</em></p>');
  erwarte('~~<img src=x onerror=alert(1)>~~', '<p><del>&lt;img src=x onerror=alert(1)&gt;</del></p>');
  erwarte('__" onfocus="x__', '<p><strong>&quot; onfocus=&quot;x</strong></p>');
  erwarte('- a\n  - <script>alert(1)</script>\n    - [x](javascript:alert(1))', '<ul><li>a<ul><li>&lt;script&gt;alert(1)&lt;/script&gt;<ul><li>x</li></ul></li></ul></li></ul>');
  erwarte('--- <hr onclick=x>', '<p>--- &lt;hr onclick=x&gt;</p>');
  erwarte('<hr>\n<del>x</del>\n<ul><li>y</li></ul>', '<p>&lt;hr&gt;<br>&lt;del&gt;x&lt;/del&gt;<br>&lt;ul&gt;&lt;li&gt;y&lt;/li&gt;&lt;/ul&gt;</p>');
  erwarte('#### <b onmouseover=x>T</b>', '<h6>&lt;b onmouseover=x&gt;T&lt;/b&gt;</h6>');
  erwarte('[_x_](\u0001javascript:alert%281%29) und _[y](javascript:alert(1))_', '<p><em>x</em> und <em>y</em></p>');
  erwarte('_[Köder]((http://a/autofocus/onfocus=alert(1)/)_', markdownHtml('*[Köder]((http://a/autofocus/onfocus=alert(1)/)*'));
});

test('die Strukturprüfung erkennt Listen, Linie und Durchstreichen außerhalb ihrer festen Grammatik', () => {
  assert.doesNotThrow(() => pruefeStruktur('<ul><li>a<ol><li><del>b</del></li></ol></li></ul><hr><h6>T</h6><p><em>x</em></p>'));
  const FALSCH = {
    'Listenpunkt ohne Liste': '<li>a</li>',
    'Listenpunkt im Absatz': '<p><li>a</li></p>',
    'Liste direkt in einer Liste': '<ul><ul><li>a</li></ul></ul>',
    'Liste im Absatz': '<p><ul><li>a</li></ul></p>',
    'Liste im Zitat': '<blockquote><ul><li>a</li></ul></blockquote>',
    'Liste nicht geschlossen': '<ul><li>a</li>',
    'Listenpunkt nicht geschlossen': '<ul><li>a</ul>',
    'falsche Liste geschlossen': '<ul><li>a</li></ol>',
    'Linie mit Attribut': '<hr class="x">',
    'Linie mit Ereignis': '<hr onclick="x">',
    'Linie im Absatz': '<p>a<hr>b</p>',
    'Linie im Listenpunkt': '<ul><li><hr></li></ul>',
    'Durchstreichen mit Attribut': '<p><del cite="x">a</del></p>',
    'Marken über Kreuz': '<p><em>a<strong>b</em>c</strong></p>',
    'Durchstreichen über Kreuz': '<p><del>a<em>b</del>c</em></p>',
    'Durchstreichen nicht geschlossen': '<p><del>a</p>',
  };
  for (const [name, html] of Object.entries(FALSCH)) assert.throws(() => pruefeStruktur(html), /STRUKTUR/, name);
  assert.throws(() => pruefeInlineStruktur('a<hr>b'), /STRUKTUR/);
  assert.doesNotThrow(() => pruefeInlineStruktur('<del>a <em>b</em></del>'));
});

test('Zufallslauf: 8000 Texte aus Einrückung, Listen, Linien, Unterstrichen, Tilden und Adressen — jede Ausgabe hält die feste Grammatik', rot('B0875'), () => {
  const BAUSTEINE = ['_', '_', '__', '__', '~~', '~~', '~', '*', '**', '`', '[', ']', '(', ')', '](', '<', '>', '"', ' ', ' ', ' ', '\n', '\n', '\n', '\n  ', '\n    ', '\n      ', '\n\t', '\n\n',
    '- ', '- ', '- ', '1. ', '1. ', '* ', '\n---\n', '\n---\n', '---', '#### ', '# ', '> ', '```\n', '|', '\n|---|\n', 'http://', 'https://a.de/a_b_c', ' https://a.de/_x_', 'javascript:',
    'a', 'bc', 'Wort', 'x_y', 'x.md', '\u0000', '0', '\u0001', '<script>'];
  let zustand = 186;
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
  const LAEUFE = 8000;
  let mitSchachtelung = 0, mitDreiEbenen = 0, mitLinie = 0, mitDurchgestrichen = 0, mitUnterstrich = 0, mitLinkInListe = 0;
  for (let lauf = 0; lauf < LAEUFE; lauf++) {
    const laenge = 4 + Math.floor(zufall() * 36);
    const eingabe = Array.from({ length: laenge }, () => BAUSTEINE[Math.floor(zufall() * BAUSTEINE.length)]).join('');
    const html = markdownHtml(eingabe);
    pruefeStruktur(html, eingabe);
    for (const adresse of linkAdressen(html)) assert.ok(ERLAUBTE_PROTOKOLLE.includes(protokoll(adresse)), `GEFÄHRLICH: ${JSON.stringify(adresse)} aus ${JSON.stringify(eingabe)}`);
    for (const zeile of eingabe.split('\n')) pruefeInlineStruktur(markdownInline(zeile), zeile);
    if (/<li>[^]*?<(?:ul|ol)>/.test(html) && /<\/(?:ul|ol)><\/li>/.test(html)) mitSchachtelung++;
    if (/<(?:ul|ol)><li>(?:(?!<\/li>)[^])*<(?:ul|ol)><li>(?:(?!<\/li>)[^])*<(?:ul|ol)>/.test(html)) mitDreiEbenen++;
    if (html.includes('<hr>')) mitLinie++;
    if (html.includes('<del>')) mitDurchgestrichen++;
    if (/<(?:em|strong)>/.test(html) && !eingabe.includes('*')) mitUnterstrich++;
    if (/<li>(?:(?!<\/li>)[^])*<a /.test(html)) mitLinkInListe++;
  }
  // Ein Zufallslauf ohne Treffer beweist nichts: genug Ausgaben müssen die neuen Formen wirklich tragen.
  console.log(`Zufallslauf Elemente: ${LAEUFE} Eingaben, ${mitSchachtelung} mit geschachtelter Liste (${mitDreiEbenen} mit drei Ebenen), ${mitLinie} mit Linie, ${mitDurchgestrichen} mit Durchgestrichenem, ${mitUnterstrich} mit Hervorhebung aus Unterstrichen, ${mitLinkInListe} mit Link in einer Liste`);
  assert.ok(mitSchachtelung >= 400, `nur ${mitSchachtelung} von ${LAEUFE} Eingaben mit geschachtelter Liste`);
  assert.ok(mitDreiEbenen >= 20, `nur ${mitDreiEbenen} mit drei Ebenen`);
  assert.ok(mitLinie >= 800, `nur ${mitLinie} mit Linie`);
  assert.ok(mitDurchgestrichen >= 100, `nur ${mitDurchgestrichen} mit Durchgestrichenem`);
  assert.ok(mitUnterstrich >= 100, `nur ${mitUnterstrich} mit Hervorhebung aus Unterstrichen`);
  assert.ok(mitLinkInListe >= 100, `nur ${mitLinkInListe} mit Link in einer Liste`);
});

/** Rendert, misst und prüft: höchstens `faktor` × Eingabe, unter 200 ms (ADR-0030 Punkt 9). */
function miss(name, eingabe, faktor = 3) {
  const beginn = process.hrtime.bigint();
  const html = markdownHtml(eingabe);
  const dauerMs = Number(process.hrtime.bigint() - beginn) / 1e6;
  console.log(`Größe ${name}: ${eingabe.length} Zeichen Eingabe → ${html.length} Zeichen Ausgabe in ${dauerMs.toFixed(1)} ms`);
  assert.ok(html.length <= faktor * eingabe.length, `${name}: Ausgabe ${html.length} Zeichen aus ${eingabe.length}`);
  assert.ok(dauerMs < 200, `${name}: ${dauerMs.toFixed(0)} ms`);
  return html;
}

test('Größe und Zeit (c): 5000 Zeilen mit je steigender Einrückung — höchstens acht Ebenen, Ausgabe in der Größenordnung der Eingabe', rot('B0875'), () => {
  const html = miss('steigende Einrückung', Array.from({ length: 5000 }, (leer, zeile) => `${' '.repeat(zeile)}- p`).join('\n'));
  assert.strictEqual((html.match(/<ul>/g) || []).length, 8);
  assert.strictEqual((html.match(/<li>/g) || []).length, 5000);
  pruefeStruktur(html);
  const saege = miss('Sägezahn', Array.from({ length: 20000 }, (leer, zeile) => `${'  '.repeat(zeile % 10)}- p`).join('\n'));
  assert.strictEqual((saege.match(/<li>/g) || []).length, 20000);
  pruefeStruktur(saege);
});

test('Größe und Zeit (c): 50 000 Unterstriche, Tilden oder Minuszeichen in einer Zeile bleiben, was sie sind, ohne Rücklauf', rot('B0874'), () => {
  for (const zeichen of ['_', '~', '-']) {
    const zeile = zeichen.repeat(50000);
    const html = miss(`50 000 „${zeichen}“`, zeile);
    if (zeichen === '-') assert.strictEqual(html, '<hr>');
    else assert.strictEqual(html, `<p>${zeile}</p>`);
  }
  // viele öffnende Zeichen ohne Ende, viele Paare, Zeichen und Leerraum im Wechsel
  for (const [name, zeile, faktor] of [['offene Unterstriche', '_a '.repeat(50000), 3], ['offene Tilden', '~~a '.repeat(50000), 3], ['Paare aus Unterstrichen', '_a_ '.repeat(50000), 3],
    ['Paare aus Tilden', '~~a~~ '.repeat(50000), 3], ['Unterstrich und Leerzeichen', '_ '.repeat(50000), 3], ['fett ohne Ende', '__a'.repeat(50000), 3], ['Minus und Leerzeichen', '- '.repeat(50000), 3]]) {
    pruefeStruktur(miss(name, zeile, faktor));
  }
});

test('Größe und Zeit (c): ein Kommentar mit 1 MB — Listen, Linien und Hervorhebung gemischt', rot('B0875'), () => {
  const BLOCK = 'Stand nach dem Lauf, mit _betonten_ Worten und ~~verworfenen~~ Teilen sowie cost_from_column:\n- erster Punkt mit https://example.org/a_b_c\n  1. darunter __fett__\n    - und noch tiefer mit `code_hier`\n\n---\n\n';
  const eingabe = BLOCK.repeat(Math.ceil(1024 * 1024 / BLOCK.length));
  assert.ok(eingabe.length >= 1024 * 1024);
  const html = miss('1 MB', eingabe);
  assert.strictEqual((html.match(/<hr>/g) || []).length, eingabe.length / BLOCK.length);
});
