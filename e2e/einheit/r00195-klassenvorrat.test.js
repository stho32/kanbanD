// R00195 (ADR-0031): Klassenvorrat eines Boards und Zählregel der Hinweiszeile (node --test)
const test = require('node:test');
const assert = require('node:assert');
const vorrat = require('../../web/klassenvorrat.js');

// Ausgangslage der Anforderung
const VORGABE = { klassen: [{ schluessel: 'sicherheit', bezeichnung: 'Sicherheit', farbe: 'red' }, { schluessel: 'eol', bezeichnung: 'EOL', farbe: 'amber' }] };
const EIGENER_SATZ = [{ schluessel: 'phase1', bezeichnung: 'Phase 1', farbe: 'green' }, { schluessel: 'eol', bezeichnung: 'Altlast', farbe: '#885500' }];
const spalten = (...nummern) => [{ name: 'Zu erledigen', aufgaben: nummern }, { name: 'Erledigt', aufgaben: [] }];
const WARTUNG = { slug: 'wartung', titel: 'Wartung', klassen: null, spalten: spalten(1) };
const UMZUG = { slug: 'umzug', titel: 'Umzug', klassen: null, spalten: spalten(2, 3, 4) };
const UMZUG_EIGEN = { ...UMZUG, klassen: EIGENER_SATZ };
const schluessel = klassen => klassen.map(k => k.schluessel);

test('AK 5: ohne eigenen Satz gilt die Vorgabe des Ordners, mit eigenem nur dieser — in seiner Reihenfolge', () => {
  assert.deepStrictEqual(vorrat.klassenvorrat(UMZUG, VORGABE), VORGABE.klassen);
  assert.deepStrictEqual(vorrat.klassenvorrat(UMZUG_EIGEN, VORGABE), EIGENER_SATZ);
  assert.deepStrictEqual(schluessel(vorrat.klassenvorrat(UMZUG_EIGEN, VORGABE)), ['phase1', 'eol'], 'nicht gemischt: kein sicherheit');
  assert.strictEqual(vorrat.klassenvorrat(UMZUG_EIGEN, VORGABE).find(k => k.schluessel === 'eol').bezeichnung, 'Altlast');
});

test('AK 2: ein leerer eigener Satz bleibt leer; ein Board aus einer älteren Antwort ohne `klassen` nimmt die Vorgabe', () => {
  assert.deepStrictEqual(vorrat.klassenvorrat({ ...UMZUG, klassen: [] }, VORGABE), []);
  const alt = { slug: 'umzug', spalten: [] };
  assert.deepStrictEqual(vorrat.klassenvorrat(alt, VORGABE), VORGABE.klassen);
});

test('ohne Board und bei defekter kanbanD.md: die Vorgabe bzw. keine Klasse, nie ein Fehler', () => {
  assert.deepStrictEqual(vorrat.klassenvorrat(null, VORGABE), VORGABE.klassen);
  assert.deepStrictEqual(vorrat.klassenvorrat(UMZUG, null), []);
  assert.deepStrictEqual(vorrat.klassenvorrat(UMZUG_EIGEN, null), EIGENER_SATZ, 'der eigene Satz hängt nicht an kanbanD.md');
  assert.deepStrictEqual(vorrat.vorgabeDesOrdners(undefined), []);
});

test('AK 7: außerhalb eines Boards gilt der Vorrat des ersten Boards der Boardliste, auf dem die Aufgabe liegt', () => {
  const wartungMit3 = { ...WARTUNG, spalten: spalten(1, 3) };
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(3, [WARTUNG, UMZUG_EIGEN], VORGABE), EIGENER_SATZ, '#3 liegt nur auf Umzug: „Altlast“');
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(3, [wartungMit3, UMZUG_EIGEN], VORGABE), VORGABE.klassen, 'Wartung steht in der Liste vor Umzug: „EOL“');
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(3, [UMZUG_EIGEN, wartungMit3], VORGABE), EIGENER_SATZ, 'die Reihenfolge der Liste entscheidet, nicht der Name');
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(1, [WARTUNG, UMZUG_EIGEN], VORGABE), VORGABE.klassen);
});

test('AK 7: auf keinem Board gilt die Vorgabe; ein archiviertes Board zählt nicht; eine Aufgabe in einer hinteren Spalte liegt auf dem Board', () => {
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(9, [WARTUNG, UMZUG_EIGEN], VORGABE), VORGABE.klassen);
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(null, [UMZUG_EIGEN], VORGABE), VORGABE.klassen, 'neue Aufgabe ohne Board');
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(3, [{ ...UMZUG_EIGEN, archiviert: '2026-11-01' }], VORGABE), VORGABE.klassen);
  const hinten = { ...UMZUG_EIGEN, spalten: [{ name: 'Zu erledigen', aufgaben: [] }, { name: 'Erledigt', aufgaben: [3] }] };
  assert.deepStrictEqual(vorrat.klassenvorratDerAufgabe(3, [hinten], VORGABE), EIGENER_SATZ);
  assert.strictEqual(vorrat.erstesBoardJeAufgabe([WARTUNG, UMZUG_EIGEN]).get(2).slug, 'umzug');
});
