// Unit-Tests der Ansichten des Aufgabenfensters (R00127/B0580, R00145): welche Ansichten eine Aufgabe trägt und in
// welcher Reihenfolge. Reine Funktionen aus web/reiter.js, im Browser und in Node nutzbar.
const test = require('node:test');
const assert = require('node:assert');
const { REITER, reiterDerAufgabe, reiterSchluessel } = require('../../web/reiter.js');

test('REITER: Schlüssel und Beschriftungen in Anzeigereihenfolge (R00145) — „Anhänge“ ist keine Ansicht mehr', () => {
  assert.deepStrictEqual(REITER, [
    ['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['details', 'Details'],
    ['datei', 'Datei'], ['kosten', 'Kosten'], ['verlauf', 'Verlauf'],
  ]);
  assert.strictEqual(REITER.some(([k]) => k === 'anhaenge'), false, 'kein Eintrag „Anhänge“');
});

test('reiterDerAufgabe: ohne Preisetikett fehlt „Kosten“, alles andere bleibt', () => {
  assert.deepStrictEqual(reiterDerAufgabe({}), [
    ['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['details', 'Details'],
    ['datei', 'Datei'], ['verlauf', 'Verlauf'],
  ]);
  assert.deepStrictEqual(reiterSchluessel({}), ['inhalt', 'zeiten', 'details', 'datei', 'verlauf']);
});

test('reiterDerAufgabe: mit Preisetikett steht „Kosten“ direkt hinter „Datei“, „Verlauf“ bleibt letzter', () => {
  const k = { cost: { currency: 'USD', amount: 1.63 } };
  const schluessel = reiterSchluessel(k);
  assert.deepStrictEqual(schluessel, ['inhalt', 'zeiten', 'details', 'datei', 'kosten', 'verlauf']);
  assert.strictEqual(schluessel.indexOf('kosten'), schluessel.indexOf('datei') + 1, '„Kosten“ direkt hinter „Datei“');
  assert.strictEqual(schluessel.at(-1), 'verlauf', '„Verlauf“ ist letzter');
});

test('reiterDerAufgabe (R00165 AK 10): „Kosten“ steht auch ohne Preisetikett, sobald die Aufgabe einen Kosteneintrag trägt', () => {
  const eintrag = { at: '2026-11-13 10:34+01:00', role: 'entwickler', column: 'Entwicklung', amount: 3.46, currency: 'USD' };
  assert.deepStrictEqual(reiterSchluessel({ cost: null, kosteneintraege: [eintrag] }), ['inhalt', 'zeiten', 'details', 'datei', 'kosten', 'verlauf']);
  assert.strictEqual(reiterSchluessel({ cost: null, kosteneintraege: [] }).includes('kosten'), false, 'weder Etikett noch Einträge');
  assert.strictEqual(reiterSchluessel({ cost: { currency: 'USD', amount: 1 }, kosteneintraege: [] }).includes('kosten'), true, 'Etikett allein genügt weiter');
});

test('reiterDerAufgabe Gegenprobe: ein nicht gesetztes Etikett (null) zählt wie keines, kein Schlüssel doppelt', () => {
  assert.strictEqual(reiterDerAufgabe({ cost: null }).some(([k]) => k === 'kosten'), false);
  const schluessel = reiterSchluessel({ cost: { currency: 'EUR', amount: 1 } });
  assert.strictEqual(new Set(schluessel).size, schluessel.length, 'kein Schlüssel doppelt');
});

test('Rückfall-Grundlage (R00145 FA 2): ein gemerkter Stand „anhaenge“ ist kein Schlüssel dieser Liste', () => {
  assert.strictEqual(reiterSchluessel({}).includes('anhaenge'), false);
  assert.strictEqual(reiterSchluessel({}).includes('inhalt'), true);
});

test('rueckfallAnsicht: die eine Rückfallregel (R00145 FA 2) — vorhandener Schlüssel bleibt, fehlender fällt auf „Inhalt“', () => {
  const { rueckfallAnsicht } = require('../../web/reiter.js');
  const ohneKosten = reiterSchluessel({});
  assert.strictEqual(rueckfallAnsicht(ohneKosten, 'details'), 'details', 'vorhandene Ansicht bleibt');
  assert.strictEqual(rueckfallAnsicht(ohneKosten, 'kosten'), 'inhalt', 'fehlendes Etikett fällt auf Inhalt');
  assert.strictEqual(rueckfallAnsicht(ohneKosten, 'anhaenge'), 'inhalt', 'entfallene Ansicht fällt auf Inhalt');
  assert.strictEqual(rueckfallAnsicht(ohneKosten, 'unbekannt'), 'inhalt', 'unbekannter Schlüssel fällt auf Inhalt');
});
