// Unit-Tests der Prüfung „nur die neueste Antwort wird übernommen“ (node --test), R00110 / ADR-0014 Regeln 2–4
const test = require('node:test');
const assert = require('node:assert');
const { uebernehmen } = require('../../web/uebernahme.js');

test('eine ältere Antwort als die zuletzt übernommene wird verworfen', () => {
  assert.strictEqual(uebernehmen({ start: 3, zuletzt: 5, marke: 0, schlangeOffen: 0 }), false);
});

test('eine neuere Antwort bei leerer Schlange wird übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 6, zuletzt: 5, marke: 0, schlangeOffen: 0 }), true);
});

test('solange die Warteschlange offen ist, wird nichts übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 6, zuletzt: 5, marke: 0, schlangeOffen: 1 }), false);
});

test('eine Antwort, die vor der Marke der Warteschlange gestartet ist, wird verworfen', () => {
  assert.strictEqual(uebernehmen({ start: 4, zuletzt: 2, marke: 4, schlangeOffen: 0 }), false, 'gleich der Marke');
  assert.strictEqual(uebernehmen({ start: 3, zuletzt: 2, marke: 4, schlangeOffen: 0 }), false, 'vor der Marke');
});

test('eine Antwort nach der Marke wird übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 5, zuletzt: 2, marke: 4, schlangeOffen: 0 }), true);
});

test('dieselbe Nummer wird nicht zweimal übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 5, zuletzt: 5, marke: 0, schlangeOffen: 0 }), false);
});
