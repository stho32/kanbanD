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

// ── Zählregel der Hinweiszeile (R00195 AK 9, 10) ──
const AUFGABEN = [
  { nummer: 1, klasse: 'sicherheit' }, { nummer: 2, klasse: 'sicherheit' }, { nummer: 3, klasse: 'eol' }, { nummer: 4, klasse: null },
];

test('AK 9, Editor des Boards: gezählt werden nicht archivierte Aufgaben dieses Boards mit dem Schlüssel', () => {
  assert.deepStrictEqual(vorrat.kartenJeKlasseAufBoard(UMZUG, AUFGABEN), { sicherheit: 1, eol: 1 });
  assert.deepStrictEqual(vorrat.kartenJeKlasseAufBoard(WARTUNG, AUFGABEN), { sicherheit: 1 });
  const archiviert = AUFGABEN.map(a => a.nummer === 2 ? { ...a, archiviert: '2026-11-01' } : a);
  assert.deepStrictEqual(vorrat.kartenJeKlasseAufBoard(UMZUG, archiviert), { eol: 1 }, 'eine archivierte Karte zählt nicht');
  assert.deepStrictEqual(vorrat.kartenJeKlasseAufBoard({ ...UMZUG, spalten: spalten(2, 99) }, AUFGABEN), { sicherheit: 1 }, 'eine Nummer ohne Aufgabe zählt nicht');
});

test('AK 9, Editor des Ordners: gezählt wird auf Boards ohne eigene Klassen und auf keinem Board', () => {
  assert.deepStrictEqual(vorrat.kartenJeKlasseInDerVorgabe([WARTUNG, UMZUG], AUFGABEN), { sicherheit: 2, eol: 1 }, 'Ausgangslage: eol streichen → 1 Karte (#3)');
  assert.deepStrictEqual(vorrat.kartenJeKlasseInDerVorgabe([WARTUNG, UMZUG_EIGEN], AUFGABEN), { sicherheit: 1 }, 'Umzug hat einen eigenen Satz: #2 und #3 zählen nicht mit');
  const ohneBoard = [...AUFGABEN, { nummer: 5, klasse: 'eol' }];
  assert.deepStrictEqual(vorrat.kartenJeKlasseInDerVorgabe([WARTUNG, UMZUG_EIGEN], ohneBoard), { sicherheit: 1, eol: 1 }, 'auf keinem Board: die Vorgabe gilt');
  const auchAufWartung = { ...WARTUNG, spalten: spalten(1, 3) };
  assert.deepStrictEqual(vorrat.kartenJeKlasseInDerVorgabe([auchAufWartung, UMZUG_EIGEN], AUFGABEN), { sicherheit: 1, eol: 1 }, 'mindestens ein Board ohne eigene Klassen genügt');
  const archivBoard = { ...UMZUG_EIGEN, archiviert: '2026-11-01' };
  assert.deepStrictEqual(vorrat.kartenJeKlasseInDerVorgabe([WARTUNG, archivBoard], AUFGABEN), { sicherheit: 2, eol: 1 }, 'ein archiviertes Board ist kein Board der Aufgabe');
  const archiviert = AUFGABEN.map(a => a.nummer === 1 ? { ...a, archiviert: '2026-11-01' } : a);
  assert.deepStrictEqual(vorrat.kartenJeKlasseInDerVorgabe([WARTUNG, UMZUG], archiviert), { sicherheit: 1, eol: 1 });
});

test('AK 9: die Hinweiszeile nennt die Zahl in Worten der Zeichnung; ohne Karte steht keine Zeile', () => {
  assert.strictEqual(vorrat.hinweisGestrichen(0), '');
  assert.strictEqual(vorrat.hinweisGestrichen(undefined), '');
  assert.strictEqual(vorrat.hinweisGestrichen(1), '1 Karte zeigt die Klasse danach als Text ohne Farbe.');
  assert.strictEqual(vorrat.hinweisGestrichen(2), '2 Karten zeigen die Klasse danach als Text ohne Farbe.');
  assert.strictEqual(vorrat.hinweisGestrichen(17), '17 Karten zeigen die Klasse danach als Text ohne Farbe.');
});
