// Fester Vergleich „vorher = nachher“ des Markdowns (ADR-0030, Durchsetzung b; node --test).
// markdown-vorher.json hält Paare Eingabe → Ausgabe des Renderers vom Stand vor Karte #187. Wer den Renderer ändert,
// ändert ein Paar nur für eine gewollte Abweichung und nennt sie im Commit — nie, um den Vergleich grün zu bekommen.
const test = require('node:test');
const assert = require('node:assert');
const { markdownHtml } = require('../../web/markdown.js');
const paare = require('./markdown-vorher.json');
const { pruefeStruktur } = require('./hilfen/markdown-struktur.js');

test('fester Vergleich: der Bestand ist vollständig geladen', () => {
  assert.ok(paare.length >= 106, `nur ${paare.length} Paare`);
  assert.strictEqual(new Set(paare.map(p => p.name)).size, paare.length, 'jeder Name einmal');
});

for (const paar of paare) {
  test(`fester Vergleich: ${paar.name}`, () => {
    assert.strictEqual(markdownHtml(paar.eingabe, paar.stufe), paar.ausgabe);
    pruefeStruktur(paar.ausgabe, paar.eingabe);
  });
}
