// R00169 F0135: die Durchlaufzeit öffnet mit „bis“ Zielspalte und merkt eine Abweichung am Gerät (ADR-0027 N5 Punkte 3, 4) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const filter = x => ({ ...B.FILTER_LEER, ...x });
const beispiel = () => ({ spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [] });
const PHASEN = { anwendung: 'kd', folge: [{ nr: 1, name: 'Entwicklung' }, { nr: 2, name: 'Entwicklertest' }, { nr: 3, name: 'Abnahme' }], spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
const mitPhasen = (phasen = PHASEN) => ({ spalten: ['Eingang', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'], phasen, aufgaben: [] });
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

test('R00169 B0827 (ADR-0027 N5 Punkt 4): mit Phasen ist „bis“ die erste Spalte, die die gewählte Stufe ohne Labels als durchlaufen meldet — die Spalte der nächsten Phase; „eingebettet in“ ändert daran nichts', () => {
  const eingebettet = { ...PHASEN, folge: [PHASEN.folge[0], { nr: 2, name: 'Entwicklertest', eingebettet: 'klein' }, PHASEN.folge[2]] };
  assert.deepStrictEqual(vorgabe(mitPhasen(), 'Entwicklung'), { von: 'Eingang', bis: 'Entwicklertest' });
  assert.deepStrictEqual(vorgabe(mitPhasen(), 'Entwicklertest'), { von: 'Eingang', bis: 'Abnahme' });
  assert.deepStrictEqual(vorgabe(mitPhasen(eingebettet), 'Entwicklertest'), { von: 'Eingang', bis: 'Abnahme' });
  assert.deepStrictEqual(vorgabe(mitPhasen(), null), { von: 'Eingang', bis: 'Erledigt' }, 'ohne Wahl die letzte Spalte');
  assert.deepStrictEqual(vorgabe(mitPhasen(), 'Abnahme'), { von: 'Eingang', bis: 'Erledigt' }, 'die letzte Phase ist der Standard');
});

test('R00169 B0827 (AK 8): ist die Abschlussspalte im Berichtsfilter ausgeschlossen und nichts gewählt, ist „bis“ der letzte sichtbare Block „C“', () => {
  assert.deepStrictEqual(vorgabe(beispiel(), null, filter({ ohneSpalten: ['Erledigt'] })), { von: 'A', bis: 'C' });
});
