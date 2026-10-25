// Unit-Tests des Verbindungswächters (node --test), R00085
const test = require('node:test');
const assert = require('node:assert');
const { entscheide, rueckzug, OFFEN, GESCHLOSSEN, VERBINDET } = require('../../web/verbindung.js');

const jetzt = 1_000_000, s = 1000;

test('Stille über 40 s oder geschlossene Verbindung → neu verbinden', () => {
  assert.strictEqual(entscheide({ zuletzt: jetzt - 41 * s, jetzt, zustand: OFFEN }), 'neu');
  assert.strictEqual(entscheide({ zuletzt: jetzt - 39 * s, jetzt, zustand: OFFEN }), 'nichts');
  assert.strictEqual(entscheide({ zuletzt: jetzt - 1 * s, jetzt, zustand: GESCHLOSSEN }), 'neu');
  assert.strictEqual(entscheide({ zuletzt: jetzt - 1 * s, jetzt, zustand: VERBINDET }), 'nichts', 'der Aufbau läuft noch');
  assert.strictEqual(entscheide({ zuletzt: jetzt - 41 * s, jetzt, zustand: VERBINDET }), 'neu', 'hängt im Aufbau');
});

test('sichtbar oder online: alles außer einer offenen, frischen Verbindung → neu', () => {
  assert.strictEqual(entscheide({ zuletzt: jetzt - 1 * s, jetzt, zustand: VERBINDET, sofort: true }), 'neu');
  assert.strictEqual(entscheide({ zuletzt: jetzt - 1 * s, jetzt, zustand: OFFEN, sofort: true }), 'nichts');
  assert.strictEqual(entscheide({ zuletzt: jetzt - 41 * s, jetzt, zustand: OFFEN, sofort: true }), 'neu');
});

test('Rückzug 1, 2, 5, dann 10 s', () => {
  assert.deepStrictEqual([0, 1, 2, 3, 4, 9].map(rueckzug), [1, 2, 5, 10, 10, 10].map(x => x * s));
});
