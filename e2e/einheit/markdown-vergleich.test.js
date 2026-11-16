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

/** Karte #186 (R00178 AK 7): diese zehn Paare weichen gewollt ab; je Bubble fällt hier ein Block, am Ende steht keiner mehr. */
const ERWARTET_ROT = {
  'PO: kursiv _ / fett __': 'B0873', 'PO: durchgestrichen': 'B0873', 'Bestand: Unterstriche und Tilden': 'B0873',
  'PO: Überschrift ####': 'B0874', 'PO: Trennlinie': 'B0874', 'Bestand: Trennlinien': 'B0874', 'Bestand: Überschriften vier bis sechs': 'B0874',
  'PO: Liste geschachtelt': 'B0875', 'Bestand: eingerückte Unterpunkte': 'B0875', 'Bestand: langes gemischtes Beispiel': 'B0875',
};
const rot = name => (name in ERWARTET_ROT ? { todo: `erwartet rot bis ${ERWARTET_ROT[name]}` } : {});

for (const paar of paare) {
  test(`fester Vergleich: ${paar.name}`, rot(paar.name), () => {
    assert.strictEqual(markdownHtml(paar.eingabe, paar.stufe), paar.ausgabe);
    pruefeStruktur(paar.ausgabe, paar.eingabe);
  });
}
