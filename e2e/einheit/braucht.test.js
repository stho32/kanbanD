// Unit-Tests der Deutung des Labels `braucht:<n>` im Browser (R00259 AK 11, ADR-0035 N1.4): dieselbe Regel wie der Server
// (`src/modell/braucht.rs`). Reine Funktionen, kein DOM, kein Netz.
const test = require('node:test');
const assert = require('node:assert');
const { nummerAusLabel, brauchtNummern, uebrigeLabels, labelsDerNummer, wartetZusatz } = require('../../web/braucht.js');

// R00214 AK 3 wörtlich: acht Labels, drei gedeutete Nummern (Dubletten einmal, auch in anderer Schreibweise).
const AK3 = ['BRAUCHT:3', 'braucht:1', 'Braucht:1', 'braucht:abc', 'braucht:kd#12', 'braucht:012', 'braucht:0', 'braucht:999'];

test('R00259 AK 11: die Nummern in Label-Reihenfolge, dieselbe Nummer einmal', () => {
  assert.deepStrictEqual(brauchtNummern(AK3), [3, 1, 999]);
});

test('R00259 AK 11: die übrigen Labels bleiben Labels (jede Deutung fällt weg)', () => {
  // Die Anforderung sagt „die übrigen fünf"; nach der Regel (ADR-0035 N1.4/N1.5) sind vier der acht Labels keine
  // Abhängigkeit — die drei Nummern 3, 1, 999 kommen aus vier Labels (braucht:1 doppelt), vier bleiben (siehe Bericht).
  assert.deepStrictEqual(uebrigeLabels(AK3), ['braucht:abc', 'braucht:kd#12', 'braucht:012', 'braucht:0']);
});

test('R00259 AK 11: die Formen aus R00214 AK 7 sind keine Abhängigkeit', () => {
  for (const label of ['braucht:x', 'braucht:012', 'braucht:0', 'braucht: 1', 'BRAUCHT:kd#12', 'braucht', 'brauchtnix', '']) {
    assert.strictEqual(nummerAusLabel(label), null, label);
    assert.deepStrictEqual(brauchtNummern([label]), []);
    assert.deepStrictEqual(uebrigeLabels([label]), [label]);
  }
});

test('R00259 AK 11: Dubletten in anderer Schreibweise erscheinen einmal, in Reihenfolge des ersten Vorkommens', () => {
  assert.deepStrictEqual(brauchtNummern(['braucht:7', 'BRAUCHT:7', 'braucht:3']), [7, 3]);
  assert.deepStrictEqual(brauchtNummern(['bRaUcHt:42']), [42]);
  assert.deepStrictEqual(brauchtNummern([]), []);
  assert.deepStrictEqual(brauchtNummern(undefined), []);
});

test('R00259 AK 9: labelsDerNummer findet jede Schreibweise einer Nummer', () => {
  assert.deepStrictEqual(labelsDerNummer(['braucht:1', 'BRAUCHT:1', 'braucht:12', 'ui'], 1), ['braucht:1', 'BRAUCHT:1']);
  assert.deepStrictEqual(labelsDerNummer(['braucht:1'], 2), []);
});

test('R00259 AK 1/3/4: der Zusatz im Namen nennt jede offene Abhängigkeit, „fehlt" bei fehlender Datei', () => {
  assert.strictEqual(wartetZusatz([{ nummer: 1, titel: 'Gerüst', erledigt: false }]), 'wartet auf #1');
  assert.strictEqual(wartetZusatz([{ nummer: 999, titel: null, erledigt: false }]), 'wartet auf #999, fehlt');
  assert.strictEqual(wartetZusatz([{ nummer: 1, titel: 'A', erledigt: false }, { nummer: 2, titel: 'B', erledigt: false }]), 'wartet auf #1, #2');
  assert.strictEqual(wartetZusatz([{ nummer: 1, titel: 'A', erledigt: false }, { nummer: 999, titel: null, erledigt: false }]), 'wartet auf #1, #999, fehlt');
});

test('R00259 AK 2/4: erledigte Abhängigkeiten erscheinen nicht; ohne offene Abhängigkeit nichts', () => {
  assert.strictEqual(wartetZusatz([{ nummer: 1, titel: 'A', erledigt: true }]), '');
  assert.strictEqual(wartetZusatz([{ nummer: 1, titel: 'A', erledigt: true }, { nummer: 2, titel: 'B', erledigt: false }]), 'wartet auf #2');
  assert.strictEqual(wartetZusatz([]), '');
  assert.strictEqual(wartetZusatz(undefined), '');
});
