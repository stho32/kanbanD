// Unit-Tests der Mehrfachauswahl (R00065, node --test)
const test = require('node:test');
const assert = require('node:assert');
const { lesereihenfolge, reihe, umschalten, mehrfachZiele, spaltenNach, zuweisenStart, zuweisenWeiter, zustaendigeNach } = require('../../web/auswahl.js');

const spalten = [{ name: 'A', karten: [1, 2, 3] }, { name: 'B', karten: [4] }, { name: 'C', karten: [5, 6] }];

test('Lesereihenfolge: Spalte für Spalte, darin von oben nach unten', () => {
  assert.deepStrictEqual(lesereihenfolge(spalten), [1, 2, 3, 4, 5, 6]);
});

test('Reihe vom Anker bis zur Karte, in beide Richtungen, über Spalten hinweg', () => {
  assert.deepStrictEqual(reihe(spalten, 2, 5), [2, 3, 4, 5]);
  assert.deepStrictEqual(reihe(spalten, 5, 2), [2, 3, 4, 5]);
  assert.deepStrictEqual(reihe(spalten, 3, 3), [3]);
  assert.deepStrictEqual(reihe(spalten, 99, 4), [4], 'unsichtbarer Anker: nur die Karte');
});

test('Umschalten nimmt auf und heraus', () => {
  assert.deepStrictEqual(umschalten([1, 3], 2), [1, 3, 2]);
  assert.deepStrictEqual(umschalten([1, 3], 3), [1]);
});

test('Ziele eines Mehrfachzugs in Lesereihenfolge und der Weg zurück', () => {
  const { ziele, zurueck } = mehrfachZiele(spalten, [5, 2], 'B', 1);
  assert.deepStrictEqual(ziele, [{ nummer: 2, spalte: 'B', index: 1 }, { nummer: 5, spalte: 'B', index: 2 }]);
  assert.deepStrictEqual(zurueck, [{ nummer: 5, spalte: 'C', index: 0 }, { nummer: 2, spalte: 'A', index: 1 }]);
  const nach = spaltenNach(spalten, ziele);
  assert.deepStrictEqual(nach.map(s => s.karten), [[1, 3], [4, 2, 5], [6]]);
  assert.deepStrictEqual(spaltenNach(nach, zurueck).map(s => s.karten), spalten.map(s => s.karten), 'zurück stellt den alten Stand her');
  assert.deepStrictEqual(spalten[0].karten, [1, 2, 3], 'Eingabe bleibt unverändert');
});

const personen = [{ kuerzel: 'st', aktiv: true }, { kuerzel: 'mi', aktiv: true }, { kuerzel: 'cl', aktiv: true }, { kuerzel: 'ab', aktiv: false }];

test('Dialog für mehrere: an auf allen, gemischt auf einigen, aus auf keiner', () => {
  const wahl = zuweisenStart([{ zustaendige: ['mi', 'st'] }, { zustaendige: ['st'] }], personen);
  assert.deepStrictEqual(wahl, { st: 'an', mi: 'gemischt', cl: 'aus' });
  assert.deepStrictEqual(Object.keys(zuweisenStart([{ zustaendige: ['ab'] }], personen)), ['st', 'mi', 'cl', 'ab'], 'stillgelegt nur, wenn zuständig');
  assert.deepStrictEqual(['gemischt', 'an', 'aus'].map(zuweisenWeiter), ['an', 'aus', 'an']);
});

test('Zuständige nach dem Dialog: gemischt bleibt je Karte, an kommt dazu, aus fällt weg', () => {
  const wahl = { st: 'aus', mi: 'gemischt', cl: 'an' };
  assert.deepStrictEqual(zustaendigeNach(['mi', 'st'], wahl, personen), ['mi', 'cl']);
  assert.deepStrictEqual(zustaendigeNach(['st'], wahl, personen), ['cl']);
  assert.deepStrictEqual(zustaendigeNach(['cl', 'mi'], wahl, personen), ['cl', 'mi'], 'Reihenfolge der bisherigen bleibt');
});
