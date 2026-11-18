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
