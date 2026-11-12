// Unit-Tests der Reiterleiste des Aufgabenfensters (R00127/B0580, node --test): welche Reiter eine Aufgabe
// trägt und in welcher Reihenfolge. Reine Funktionen aus web/reiter.js, im Browser und in Node nutzbar.
const test = require('node:test');
const assert = require('node:assert');
const { REITER, reiterDerAufgabe, reiterSchluessel } = require('../../web/reiter.js');

test('REITER: Schlüssel und Beschriftungen in Anzeigereihenfolge (R00127)', () => {
  assert.deepStrictEqual(REITER, [
    ['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['anhaenge', 'Anhänge'], ['details', 'Details'],
    ['datei', 'Datei'], ['kosten', 'Kosten'], ['verlauf', 'Verlauf'],
  ]);
});

test('reiterDerAufgabe: ohne Preisetikett fehlt „Kosten“, alles andere bleibt', () => {
  assert.deepStrictEqual(reiterDerAufgabe({}), [
    ['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['anhaenge', 'Anhänge'], ['details', 'Details'],
    ['datei', 'Datei'], ['verlauf', 'Verlauf'],
  ]);
  assert.deepStrictEqual(reiterSchluessel({}), ['inhalt', 'zeiten', 'anhaenge', 'details', 'datei', 'verlauf']);
});

test('reiterDerAufgabe: mit Preisetikett steht „Kosten“ direkt hinter „Datei“, „Verlauf“ bleibt letzter', () => {
  const k = { cost: { currency: 'USD', amount: 1.63 } };
  const schluessel = reiterSchluessel(k);
  assert.deepStrictEqual(schluessel, ['inhalt', 'zeiten', 'anhaenge', 'details', 'datei', 'kosten', 'verlauf']);
  assert.strictEqual(schluessel[schluessel.indexOf('datei') + 1], 'kosten', '„Kosten“ unmittelbar nach „Datei“');
  assert.strictEqual(schluessel.at(-1), 'verlauf', '„Verlauf“ bleibt letzter');
});

test('reiterDerAufgabe Gegenprobe: ein nicht gesetztes Etikett (null) zählt wie keines, kein Reiter doppelt', () => {
  assert.strictEqual(reiterDerAufgabe({ cost: null }).some(([k]) => k === 'kosten'), false);
  const schluessel = reiterSchluessel({ cost: { currency: 'EUR', amount: 1 } });
  assert.strictEqual(new Set(schluessel).size, schluessel.length, 'jeder Schlüssel höchstens einmal');
});
