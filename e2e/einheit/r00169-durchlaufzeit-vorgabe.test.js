// R00169 F0135: die Durchlaufzeit öffnet mit „bis“ Zielspalte und merkt eine Abweichung am Gerät (ADR-0027 N5 Punkte 3, 4) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const filter = x => ({ ...B.FILTER_LEER, ...x });
const beispiel = () => ({ spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [] });
/** Die Vorgabe eines Boards mit dieser gespeicherten Zielspalte unter dem Filter, verdrahtet wie in web/ansicht.js. */
const vorgabe = (bew, zielspalte, f = filter({})) => B.durchlaufVorgabe(bew, B.zielblock(bew, f, zielspalte).gewaehlt);

/* ── B0827 Vorgabe „bis“ ist die erste Spalte des Zielblocks ── */
test('R00169 B0827 (AK 5): mit Zielspalte B ist die Vorgabe von „A“ bis „B“, mit Zielspalte C bis „C“', () => {
  assert.deepStrictEqual(vorgabe(beispiel(), 'B'), { von: 'A', bis: 'B' });
  assert.deepStrictEqual(vorgabe(beispiel(), 'C'), { von: 'A', bis: 'C' });
});

test('R00169 B0827 (AK 5): ohne Zielspalte, mit der Abschlussspalte als Wahl und mit einer Wahl, die es nicht gibt, bleibt die Vorgabe von der ersten bis zur letzten Spalte', () => {
  for (const zielspalte of [null, undefined, '', 'Erledigt', 'Abnahme']) assert.deepStrictEqual(vorgabe(beispiel(), zielspalte), { von: 'A', bis: 'Erledigt' }, `Zielspalte ${zielspalte}`);
});

test('R00169 B0827 (AK 8): ist die Abschlussspalte im Berichtsfilter ausgeschlossen und nichts gewählt, ist „bis“ der letzte sichtbare Block „C“', () => {
  assert.deepStrictEqual(vorgabe(beispiel(), null, filter({ ohneSpalten: ['Erledigt'] })), { von: 'A', bis: 'C' });
});

/* ── B0828 Abweichende Wahl von/bis am Gerät je Board merken ── */
const wahl = (zielspalte, gemerkt) => B.durchlaufWahl(beispiel(), B.zielblock(beispiel(), filter({}), zielspalte).gewaehlt, gemerkt);
const VORGABE_B = { von: 'A', bis: 'B' };

test('R00169 B0828 (AK 6): ohne Gemerktes gilt die Vorgabe — nichts weicht ab', () => {
  for (const gemerkt of [null, undefined, {}]) {
    assert.deepStrictEqual(wahl('B', gemerkt), { von: 'A', bis: 'B', vorgabe: VORGABE_B, vonWeichtAb: false, bisWeichtAb: false, weichtAb: false });
  }
});

test('R00169 B0828 (AK 6): ein gemerktes „bis C“ gilt statt der Vorgabe „bis B“ und weicht ab; „von“ bleibt die Vorgabe', () => {
  assert.deepStrictEqual(wahl('B', { bis: 'C' }), { von: 'A', bis: 'C', vorgabe: VORGABE_B, vonWeichtAb: false, bisWeichtAb: true, weichtAb: true });
  assert.deepStrictEqual(wahl('B', { von: 'B', bis: 'C' }), { von: 'B', bis: 'C', vorgabe: VORGABE_B, vonWeichtAb: true, bisWeichtAb: true, weichtAb: true });
  assert.deepStrictEqual(wahl('B', { von: 'B' }), { von: 'B', bis: 'B', vorgabe: VORGABE_B, vonWeichtAb: true, bisWeichtAb: false, weichtAb: true });
});

test('R00169 B0828: Gemerktes, das der Vorgabe gleicht oder keine Spalte des Boards mehr nennt, weicht nicht ab — der Bericht folgt dem Board', () => {
  assert.strictEqual(wahl('C', { bis: 'C' }).weichtAb, false, 'das Board hat inzwischen dieselbe Zielspalte');
  assert.deepStrictEqual(wahl('B', { von: 'Gibt es nicht', bis: 'Auch nicht' }), { von: 'A', bis: 'B', vorgabe: VORGABE_B, vonWeichtAb: false, bisWeichtAb: false, weichtAb: false });
  assert.deepStrictEqual(wahl('B', { von: 7, bis: null }), { von: 'A', bis: 'B', vorgabe: VORGABE_B, vonWeichtAb: false, bisWeichtAb: false, weichtAb: false });
});

test('R00169 B0828 (AK 6): gemerkt wird nur, was von der Vorgabe abweicht — gleicht die Wahl der Vorgabe, ist nichts zu merken', () => {
  assert.deepStrictEqual(B.durchlaufMerken(VORGABE_B, 'A', 'C'), { bis: 'C' });
  assert.deepStrictEqual(B.durchlaufMerken(VORGABE_B, 'B', 'B'), { von: 'B' });
  assert.deepStrictEqual(B.durchlaufMerken(VORGABE_B, 'B', 'C'), { von: 'B', bis: 'C' });
  assert.deepStrictEqual(B.durchlaufMerken(VORGABE_B, 'A', 'B'), {});
});
