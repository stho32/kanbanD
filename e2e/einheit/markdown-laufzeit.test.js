// Rechenzeit des Markdowns (R00178 AK 8, Karte #186 Befund M1, ADR-0030 Punkt 9; node --test).
// Die Klasse heißt „öffnendes Zeichen ohne Gegenstück“: ein Muster, das von jedem öffnenden Zeichen bis zum Zeilenende sucht,
// rechnet quadratisch mit der Zeilenlänge — eine Zeile aus 200 000 `[` fror das Öffnen der Aufgabe für 51 s ein.
// Geprüft wird je Fall die Rechenzeit (unter 200 ms) und das Wachstum (zehnfache Länge: linear statt quadratisch).
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml, markdownInline } = require('../../web/markdown.js');
const { pruefeStruktur, linkAdressen } = require('./hilfen/markdown-struktur.js');

/** Wachstum: die große Eingabe einmal gegen die zehnmal kleinere zehnmal hintereinander — gleich viele Zeichen, gleich viel
 *  Speicher. Linear ergibt etwa 1, quadratisch etwa 10; die Grenze liegt dazwischen. */
const LAENGE = 200000, GRENZE_MS = 200, WACHSTUM = 4;
const bis = (stueck, laenge) => stueck.repeat(Math.ceil(laenge / stueck.length));

/** Rechenzeit des eigenen Prozesses in ms (nicht die Wanduhr): die Suite läuft neben anderen Prozessen, und gefragt ist
 *  die Arbeit des Renderers, nicht die Last des Rechners. */
const rechenzeitMs = () => { const { user, system } = process.cpuUsage(); return (user + system) / 1000; };

/** Der schnellste von mehreren Läufen, je `mal` Aufrufe hintereinander. Ein Lauf weit über der Grenze wird nicht
 *  wiederholt — sonst dauerte die rote Probe Minuten. */
function schnellster(rendern, eingabe, mal = 1) {
  let dauerMs = Infinity, html = '';
  for (let lauf = 0; lauf < 7 && (lauf === 0 || dauerMs < 5 * GRENZE_MS); lauf++) {
    const beginn = rechenzeitMs();
    for (let aufruf = 0; aufruf < mal; aufruf++) html = rendern(eingabe);
    dauerMs = Math.min(dauerMs, rechenzeitMs() - beginn);
  }
  return { dauerMs, html };
}

/** Lange Zeilen ohne schließendes Gegenstück: [Name, Baustein, Vorspann]. Jeder Ausdruck des Renderers hat hier seinen Fall. */
const FAELLE = [
  // Befund M1: Linktext ohne `]`, Adresse ohne `)`
  ['Link: nur [', '['],
  ['Link: [a', '[a'],
  ['Link: [x](a', '[x](a'],
  ['Link: nur [ im Listenpunkt', '[', '- '],
  ['Link: [x](a und am Ende Leerraum', '[x](a', '', ' b'],
  ['Link: ]( ohne Anfang', ']('],
  ['Link: [] leer', '[]'],
  ['Link: [x] ohne Adresse', '[x]'],
  // Inline-Code, Sterne, Formen an Wortgrenzen
  ['Code: nur `', '`'],
  ['Code: `a ohne Ende', 'a', '`'],
  ['Sterne: nur *', '*'],
  ['Sterne: **a', '**a'],
  ['Sterne: *a', '*a '],
  ['Sterne: ein * vor langem Text', 'a ', '*a'],
  ['Unterstrich: _a', '_a '],
  ['Unterstrich: __a', '__a '],
  ['Unterstrich: ein _ vor langem Leerraum', ' ', '_a', '_'],
  ['Tilden: ~~a', '~~a '],
  ['Tilden: nur ~', '~'],
  // nackte Adresse
  ['Adresse: http:// und kein Leerraum', 'a', 'http://'],
  ['Adresse: (http://a wiederholt', '(http://a'],
  ['Adresse: nur (', '('],
  ['maskiert: nur <', '<'],
  ['maskiert: nur &', '&'],
  // Blöcke: Tabelle, Überschrift, Zitat, Liste, Linie, Zaun
  ['Tabelle: nur |', '|'],
  ['Tabelle: zwei Zeilen nur |', '|', '', `\n${'|'.repeat(LAENGE)}`],
  ['Tabelle: Kopf aus a| über einer Trennzeile', 'a|', '', '\n-|-|'],
  ['Überschrift: nur #', '#'],
  ['Überschrift: # und Leerraum', ' ', '#'],
  ['Zitat: nur >', '>'],
  ['Liste: nur Leerraum vor einem Wort', ' ', '', 'x'],
  ['Liste: nur Ziffern', '1'],
  ['Liste: - und Leerraum', ' ', '-'],
  ['Linie: nur - und am Ende ein Wort', '-', '', 'x'],
  ['Linie: --- und Leerraum und ein Wort', ' ', '---', 'x'],
  ['Zaun: ``` ohne Ende und eine lange Zeile', 'a', '```\n'],
];

for (const [einstieg, rendern] of [['markdownHtml', markdownHtml], ['markdownInline', markdownInline]]) {
  for (const [name, baustein, vorspann = '', nachspann = ''] of FAELLE) {
    test(`Rechenzeit ${einstieg} — ${name}: ${LAENGE} Zeichen unter ${GRENZE_MS} ms, linear in der Länge`, () => {
      const eingabe = laenge => vorspann + bis(baustein, laenge) + nachspann.slice(0, laenge + 10);
      const gross = schnellster(rendern, eingabe(LAENGE));
      const zehnKleine = schnellster(rendern, eingabe(LAENGE / 10), 10);
      // unter einer Millisekunde misst die Uhr Rauschen: das Wachstum zählt gegen mindestens 1 ms
      const faktor = gross.dauerMs / Math.max(zehnKleine.dauerMs, 1);
      console.log(`Rechenzeit ${einstieg} ${name}: zehnmal ${LAENGE / 10} Zeichen ${zehnKleine.dauerMs.toFixed(1)} ms, einmal ${LAENGE} Zeichen ${gross.dauerMs.toFixed(1)} ms (×${faktor.toFixed(1)})`);
      assert.ok(gross.dauerMs < GRENZE_MS, `${gross.dauerMs.toFixed(0)} ms für ${LAENGE} Zeichen`);
      assert.ok(faktor <= WACHSTUM, `dieselbe Zeichenzahl in einer Zeile kostet das ${faktor.toFixed(1)}-Fache von zehn kurzen Zeilen (${zehnKleine.dauerMs.toFixed(1)} ms → ${gross.dauerMs.toFixed(1)} ms)`);
      assert.ok(gross.html.length <= 8 * eingabe(LAENGE).length, `Ausgabe ${gross.html.length} Zeichen`);
    });
  }
}

const link = (adresse, text) => `<a href="${adresse}" target="_blank" rel="noopener">${text}</a>`;

test('Kontrollpaar zu M1: Links entstehen wie zuvor — der Text beginnt an der ersten öffnenden Klammer vor der schließenden', () => {
  const PAARE = [
    ['[k](http://a/)', link('http://a/', 'k')],
    ['[a [b](http://x/)', link('http://x/', 'a [b')],
    ['[k](http://[::1]/)', link('http://[::1]/', 'k')],
    ['[a] [b](x.md)', `[a] ${link('x.md', 'b')}`],
    ['[a](b c) [d](e)', `[a](b c) ${link('e', 'd')}`],
    ['[a]( [b](c)', `[a]( ${link('c', 'b')}`],
    ['[a]() [b](c)', `[a]() ${link('c', 'b')}`],
    ['[] [](x) [b](c)', `[] [](x) ${link('c', 'b')}`],
    ['[[a]](b) [c](d)', `[[a]](b) ${link('d', 'c')}`],
    ['[a](b)[c](d)', `${link('b', 'a')}${link('d', 'c')}`],
    ['[a](b(c)d)', `${link('b(c', 'a')}d)`],
    ['x [a\tb](c) y', `x ${link('c', 'a\tb')} y`],
    ['[a](b c) [d](e ) [f](g)', `[a](b c) [d](e ) ${link('g', 'f')}`],
    ['[**fett** und `c`](x.md)', link('x.md', '<strong>fett</strong> und <code>c</code>')],
    ['[x](javascript:alert%281%29) [y](z)', `x ${link('z', 'y')}`],
    ['](a) [b](c', '](a) [b](c'],
  ];
  for (const [eingabe, ausgabe] of PAARE) {
    assert.strictEqual(markdownInline(eingabe), ausgabe, JSON.stringify(eingabe));
    assert.strictEqual(markdownHtml(eingabe), `<p>${ausgabe}</p>`, JSON.stringify(eingabe));
    pruefeStruktur(markdownHtml(eingabe), eingabe);
  }
  assert.deepStrictEqual(linkAdressen(markdownInline(`${'['.repeat(5000)}k](http://a/) ${'[x](a'.repeat(5000)} [m](http://b/)`)), ['http://a/', 'http://b/']);
});
