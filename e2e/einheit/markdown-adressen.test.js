// Feindliche Adressen im Markdown (Karte #187, ADR-0030 Punkt 4; node --test).
// Ein Link entsteht nur für http, https, mailto, vscode oder eine relative Adresse — und nie, wenn die Adresse ein
// Zeichen ≤ U+0020 oder U+007F enthält. Geprüft wird, wie der Browser die Adresse liest (`new URL`), nicht ihr Aussehen.
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml } = require('../../web/markdown.js');

const ERLAUBTE_PROTOKOLLE = ['http:', 'https:', 'mailto:', 'vscode:'];
const KOEDER = 'Köder';
const SKRIPT = 'javascript:document.title=%27x%27';

/** Jede Form, in der eine Adresse im Text stehen kann; `<adresse>` kennt der Renderer nicht, sie bleibt als Schutz dabei. */
const FORMEN = {
  'Link': adresse => `[${KOEDER}](${adresse})`,
  'Link in Liste': adresse => `- [${KOEDER}](${adresse})`,
  'Link in Überschrift': adresse => `# [${KOEDER}](${adresse})`,
  'Link im Zitat': adresse => `> [${KOEDER}](${adresse})`,
  'nackte Adresse': adresse => `${KOEDER} ${adresse}`,
  'nackte Adresse in Klammern': adresse => `${KOEDER} (${adresse})`,
  'spitze Klammern': adresse => `${KOEDER} <${adresse}>`,
};

const zeichen = nummer => String.fromCharCode(nummer);
const kennung = nummer => 'U+' + nummer.toString(16).toUpperCase().padStart(4, '0');
const bereich = (von, bis) => Array.from({ length: bis - von + 1 }, (leer, i) => von + i);

const STEUERZEICHEN = [...bereich(0x00, 0x08), ...bereich(0x0E, 0x1F), 0x7F];
/** Tab, Zeilenumbruch, U+000B, U+000C, Wagenrücklauf, Leerzeichen: für den Renderer endet hier eine Adresse. */
const LEERRAUM = [...bereich(0x09, 0x0D), 0x20];

/** Adressen, aus denen nie ein Link wird: [Name, Adresse]. */
const NIE_EIN_LINK = [
  ...[...STEUERZEICHEN, ...LEERRAUM].flatMap(nummer => [
    [`${kennung(nummer)} vor dem Schema`, zeichen(nummer) + SKRIPT],
    [`${kennung(nummer)} im Schema`, 'java' + zeichen(nummer) + 'script:document.title=%27x%27'],
    [`${kennung(nummer)} vor dem Doppelpunkt`, 'javascript' + zeichen(nummer) + ':document.title=%27x%27'],
    [`${kennung(nummer)} am Ende`, SKRIPT + zeichen(nummer)],
    [`${kennung(nummer)} in einer relativen Adresse`, 'ordner/da' + zeichen(nummer) + 'tei.md'],
  ]),
  ...STEUERZEICHEN.flatMap(nummer => [
    [`${kennung(nummer)} in einer https-Adresse`, 'https://example.org/a' + zeichen(nummer) + 'b'],
    [`${kennung(nummer)} vor https`, zeichen(nummer) + 'https://example.org/'],
  ]),
  ['mehrere Steuerzeichen vor dem Schema', '\u0001\u0002\u001f' + SKRIPT],
  ['tausend Steuerzeichen vor dem Schema', '\u0001'.repeat(1000) + SKRIPT],
  ['Steuerzeichen zwischen jedem Buchstaben', 'javascript'.split('').join('\u0001') + ':document.title=%27x%27'],
  ['javascript klein', SKRIPT],
  ['javascript gemischt geschrieben', 'JaVaScRiPt:document.title=%27x%27'],
  ['javascript groß geschrieben', 'JAVASCRIPT:document.title=%27x%27'],
  ['javascript mit Schrägstrichen', 'javascript://example.org/%0Adocument.title=%27x%27'],
  ['javascript sehr lang', 'javascript:' + 'a'.repeat(100000)],
  ['data mit HTML', 'data:text/html,<script>document.title=1</script>'],
  ['data base64', 'data:text/html;base64,PHNjcmlwdD5kb2N1bWVudC50aXRsZT0xPC9zY3JpcHQ+'],
  ['data groß geschrieben', 'DATA:text/html,x'],
  ['vbscript', 'vbscript:msgbox(1)'],
  ['blob', 'blob:http://localhost/0d0c0b0a-0000-4000-8000-000000000000'],
  ['file', 'file:///etc/passwd'],
  ['about', 'about:blank'],
  ['view-source', 'view-source:http://localhost/'],
  ['ws', 'ws://example.org/'],
  ['ftp', 'ftp://example.org/datei'],
  ['tel', 'tel:+49301234567'],
  ['unbekanntes Schema', 'x-eigenes+schema.1:wert'],
];

/** Adressen, die ein Link sein dürfen — aber nur einer, den der Browser als http, https, mailto oder vscode liest: [Name, Adresse]. */
const HOECHSTENS_HARMLOS = [
  // Leerraum beendet eine Adresse: der Teil davor oder dahinter darf als eigene, saubere https-Adresse ein Link sein
  ...LEERRAUM.flatMap(nummer => [
    [`${kennung(nummer)} in einer https-Adresse`, 'https://example.org/a' + zeichen(nummer) + 'b'],
    [`${kennung(nummer)} vor https`, zeichen(nummer) + 'https://example.org/'],
  ]),
  ['Entität dezimal im Schema', '&#106;avascript:document.title=1'],
  ['Entität hexadezimal im Schema', '&#x6A;avascript:document.title=1'],
  ['Entität ohne Strichpunkt', '&#106avascript:document.title=1'],
  ['Entität für den Doppelpunkt', 'javascript&colon;document.title=1'],
  ['Entität dezimal für den Doppelpunkt', 'javascript&#58;document.title=1'],
  ['Entität Tab vor dem Schema', '&Tab;javascript:document.title=1'],
  ['Entität Zeilenumbruch im Schema', 'java&NewLine;script:document.title=1'],
  ['Entität U+0001 vor dem Schema', '&#1;javascript:document.title=1'],
  ['URL-kodierter Buchstabe im Schema', '%6Aavascript:document.title=1'],
  ['URL-kodierter Doppelpunkt', 'javascript%3Adocument.title=1'],
  ['URL-kodiertes Steuerzeichen vor dem Schema', '%01javascript:document.title=1'],
  ['URL-kodierter Tab im Schema', 'java%09script:document.title=1'],
  ['Hervorhebung im Schema', 'java*script*:document.title=1'],
  ['Unterstriche im Schema', 'java__script__:document.title=1'],
  ['Code im Schema', 'java`script`:document.title=1'],
  ['geschütztes Leerzeichen vor dem Schema', ' ' + SKRIPT],
  ['Zeilentrenner U+2028 vor dem Schema', ' ' + SKRIPT],
  ['BOM vor dem Schema', '﻿' + SKRIPT],
  ['U+0085 vor dem Schema', '\u0085' + SKRIPT],
  ['weiches Trennzeichen im Schema', 'java­script:document.title=1'],
  ['Leerzeichen ohne Breite im Schema', 'java​script:document.title=1'],
  ['breiter Doppelpunkt', 'javascript：document.title=1'],
  ['Ziffer vor dem Schema', '1javascript:document.title=1'],
  ['Doppelpunkt vor dem Schema', ':javascript:document.title=1'],
  ['Schrägstrich vor dem Schema', '/javascript:document.title=1'],
  ['Anker vor dem Schema', '#javascript:document.title=1'],
  ['Abfrage vor dem Schema', '?javascript:document.title=1'],
  ['fremder Rechner ohne Schema', '//evil.example/x'],
  ['fremder Rechner mit Rückstrichen', '\\\\evil.example\\x'],
  ['fremder Rechner gemischt', '/\\evil.example/x'],
  ['https ohne Schrägstriche', 'https:evil.example'],
  ['http mit Rückstrichen', 'http:\\\\evil.example'],
  ['https mit Zugangsdaten', 'https://localhost@evil.example/'],
  ['https sehr lang', 'https://example.org/' + 'a'.repeat(100000)],
  ['relativ sehr lang', 'a/'.repeat(50000)],
  ['Anführungszeichen in der Adresse', 'x"onmouseover="document.title=1'],
  ['Marke in der Adresse', 'x"><script>document.title=1</script>'],
  ['einfache Anführung in der Adresse', "x'onmouseover='document.title=1"],
];

/** Liest den Wert eines Attributs, wie es der Browser täte: Entitäten werden aufgelöst. */
function attributwert(roh) {
  const BENANNT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', Tab: '\t', NewLine: '\n' };
  return roh.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi, (alles, hex, dezimal, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dezimal) return String.fromCodePoint(parseInt(dezimal, 10));
    if (name in BENANNT) return BENANNT[name];
    return alles;
  });
}

/** Die Adressen aller Links der Ausgabe; jede Link-Marke trägt genau `href`, `target` und `rel`. */
function linkAdressen(html) {
  const marken = html.match(/<a\b(?:[^>"]|"[^"]*")*>/g) || [];
  return marken.map(marke => {
    const m = /^<a href="([^"]*)" target="_blank" rel="noopener">$/.exec(marke);
    assert.ok(m, `Link-Marke mit fremdem Aufbau: ${JSON.stringify(marke.slice(0, 120))}`);
    return attributwert(m[1]);
  });
}

const kurz = text => JSON.stringify(text.length > 80 ? text.slice(0, 80) + '…' : text);

function pruefeHarmlos(html, eingabe) {
  for (const adresse of linkAdressen(html)) {
    const protokoll = new URL(adresse, 'http://localhost/').protocol;
    assert.ok(ERLAUBTE_PROTOKOLLE.includes(protokoll), `GEFÄHRLICH: der Browser liest ${protokoll} in ${kurz(adresse)} aus ${kurz(eingabe)}`);
    assert.ok(!/[\u0000- \u007f]/.test(adresse), `ADR-0030: Zeichen ≤ U+0020 oder U+007F in ${kurz(adresse)} aus ${kurz(eingabe)}`);
  }
  assert.ok(html.includes(KOEDER), `der Text ist verschwunden: ${kurz(eingabe)}`);
}

for (const [name, adresse] of NIE_EIN_LINK) {
  test(`kein Link: ${name}`, () => {
    for (const [form, schreibe] of Object.entries(FORMEN)) {
      const eingabe = schreibe(adresse);
      const html = markdownHtml(eingabe);
      pruefeHarmlos(html, eingabe);
      assert.ok(!html.includes('<a'), `ADR-0030: ${form} ergibt einen Link: ${kurz(html)}`);
    }
  });
}

for (const [name, adresse] of HOECHSTENS_HARMLOS) {
  test(`höchstens ein harmloser Link: ${name}`, () => {
    for (const schreibe of Object.values(FORMEN)) {
      const eingabe = schreibe(adresse);
      pruefeHarmlos(markdownHtml(eingabe), eingabe);
    }
  });
}

test('der Text eines abgewiesenen Links bleibt sichtbar und maskiert', () => {
  assert.strictEqual(markdownHtml('[a<b](\u0001javascript:x)'), '<p>a&lt;b</p>');
  assert.strictEqual(markdownHtml('vor [**fett**](java\u007fscript:x) nach'), '<p>vor <strong>fett</strong> nach</p>');
  assert.strictEqual(markdownHtml('siehe https://example.org/a\u0001b dort'), '<p>siehe https://example.org/a\u0001b dort</p>');
});

test('die Positivliste bleibt offen: http, https, mailto, vscode und relativ', () => {
  const ERLAUBT = ['http://example.org/', 'HTTPS://example.org/a?b=1#c', 'mailto:jemand@example.org', 'vscode://file/x.rs:1', '/api/zustand', 'ordner/datei.md', '../x.md', '#anker', '?a=1', '//example.org/x'];
  for (const adresse of ERLAUBT) assert.deepStrictEqual(linkAdressen(markdownHtml(`[${KOEDER}](${adresse})`)), [adresse]);
  assert.deepStrictEqual(linkAdressen(markdownHtml('siehe https://example.org/x?a=1&b=2')), ['https://example.org/x?a=1&b=2']);
});

test('die Prüfung selbst erkennt eine gefährliche Adresse', () => {
  const gefaehrlich = '<p><a href="\u0001javascript:x" target="_blank" rel="noopener">Köder</a></p>';
  assert.throws(() => pruefeHarmlos(gefaehrlich, ''), /GEFÄHRLICH/);
  assert.throws(() => pruefeHarmlos(gefaehrlich.replace('\u0001', '&#1;'), ''), /GEFÄHRLICH/);
  assert.throws(() => pruefeHarmlos(gefaehrlich.replace('\u0001javascript:x', 'java&Tab;script&colon;x'), ''), /GEFÄHRLICH/);
  assert.throws(() => pruefeHarmlos(gefaehrlich.replace(' target', ' onclick="x" target'), ''), /fremdem Aufbau/);
});
