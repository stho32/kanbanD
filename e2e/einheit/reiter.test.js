// Unit-Tests der Ansichten des Aufgabenfensters (R00127/B0580, R00145): welche Ansichten eine Aufgabe trägt und in
// welcher Reihenfolge. Reine Funktionen aus web/reiter.js, im Browser und in Node nutzbar.
const test = require('node:test');
const assert = require('node:assert');
const { REITER, reiterDerAufgabe, reiterSchluessel } = require('../../web/reiter.js');

test('REITER: Schlüssel und Beschriftungen in Anzeigereihenfolge (R00145, R00219) — „Anhänge“ ist keine Ansicht mehr', () => {
  assert.deepStrictEqual(REITER, [
    ['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['details', 'Details'],
    ['datei', 'Datei'], ['kosten', 'Kosten'], ['commits', 'Commits'], ['laeufe', 'Läufe'], ['verlauf', 'Verlauf'],
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

test('reiterDerAufgabe (R00205 FA 1): „Commits“ steht nur mit mindestens einem Verweis, ohne Kosten zwischen „Datei“ und „Verlauf“', () => {
  assert.deepStrictEqual(reiterSchluessel({ commits: ['kd:a41e0c5'] }), ['inhalt', 'zeiten', 'details', 'datei', 'commits', 'verlauf']);
  for (const leer of [{}, { commits: [] }, { commits: null }]) {
    assert.strictEqual(reiterSchluessel(leer).includes('commits'), false, JSON.stringify(leer));
  }
});

test('reiterDerAufgabe (R00205 FA 1): mit Kosten steht „Commits“ zwischen „Kosten“ und „Verlauf“', () => {
  const schluessel = reiterSchluessel({ cost: { currency: 'USD', amount: 1.63 }, commits: ['kd:a41e0c5', 'kd:b'] });
  assert.deepStrictEqual(schluessel, ['inhalt', 'zeiten', 'details', 'datei', 'kosten', 'commits', 'verlauf']);
  assert.deepStrictEqual(reiterDerAufgabe({ commits: ['x'] }).find(([k]) => k === 'commits'), ['commits', 'Commits']);
});

test('rueckfallAnsicht (R00205 FA 1): fällt der letzte Verweis weg, gilt „Inhalt“ — dieselbe Regel wie für jede entfallende Ansicht', () => {
  const { rueckfallAnsicht } = require('../../web/reiter.js');
  assert.strictEqual(rueckfallAnsicht(reiterSchluessel({ commits: ['kd:a'] }), 'commits'), 'commits');
  assert.strictEqual(rueckfallAnsicht(reiterSchluessel({ commits: [] }), 'commits'), 'inhalt');
});

const TRANSKRIPT = { kennung: 'planer@2026-11-20T09:00+01:00', at: '2026-11-20 09:00+01:00', role: 'planer', column: 'Detailplanung', bytes: 2048 };
const KOSTENEINTRAG = { at: '2026-11-20 09:00+01:00', role: 'planer', column: 'Detailplanung', amount: 0.42, currency: 'USD', kennung: 'planer@2026-11-20T09:00+01:00' };

test('reiterDerAufgabe (R00219 FA 1): „Läufe“ steht nur mit mindestens einem Transkript, hinter „Commits“, vor „Verlauf“', () => {
  assert.deepStrictEqual(reiterSchluessel({ transkripte: [TRANSKRIPT] }), ['inhalt', 'zeiten', 'details', 'datei', 'laeufe', 'verlauf']);
  assert.deepStrictEqual(reiterSchluessel({ kosteneintraege: [KOSTENEINTRAG], transkripte: [TRANSKRIPT] }), ['inhalt', 'zeiten', 'details', 'datei', 'kosten', 'laeufe', 'verlauf']);
  assert.deepStrictEqual(reiterSchluessel({ kosteneintraege: [KOSTENEINTRAG], commits: ['kd:a'], transkripte: [TRANSKRIPT] }), ['inhalt', 'zeiten', 'details', 'datei', 'kosten', 'commits', 'laeufe', 'verlauf']);
  assert.deepStrictEqual(reiterDerAufgabe({ transkripte: [TRANSKRIPT] }).find(([k]) => k === 'laeufe'), ['laeufe', 'Läufe']);
});

test('reiterDerAufgabe (R00219 FA 1, ADR-0039 Punkt 5): nur Kosteneinträge ergeben kein „Läufe“; leer, null oder fehlend auch nicht', () => {
  assert.strictEqual(reiterSchluessel({ kosteneintraege: [KOSTENEINTRAG] }).includes('laeufe'), false, 'nur Kosten');
  for (const leer of [{}, { transkripte: [] }, { transkripte: null }]) {
    assert.strictEqual(reiterSchluessel(leer).includes('laeufe'), false, JSON.stringify(leer));
  }
});

test('rueckfallAnsicht (R00219 FA 1): fällt das letzte Transkript weg, gilt „Inhalt“', () => {
  const { rueckfallAnsicht } = require('../../web/reiter.js');
  assert.strictEqual(rueckfallAnsicht(reiterSchluessel({ transkripte: [TRANSKRIPT] }), 'laeufe'), 'laeufe');
  assert.strictEqual(rueckfallAnsicht(reiterSchluessel({ transkripte: [] }), 'laeufe'), 'inhalt');
});
