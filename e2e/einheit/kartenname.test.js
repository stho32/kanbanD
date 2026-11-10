// Unit-Tests des zugänglichen Namens einer Karte (node --test), R00113 FA 7–8 / ADR-0018 Regel 3
const test = require('node:test');
const assert = require('node:assert');
const { kartenName, kartenNameDefekt, kartenNameFehlt } = require('../../web/kartenname.js');

const KLASSEN = [{ schluessel: 'bug', bezeichnung: 'Fehler', farbe: 'red' }, { schluessel: 'feature', bezeichnung: 'Funktion', farbe: 'green' }];

test('Nummer und Titel, dahinter die Bezeichnung der Klasse', () => {
  assert.strictEqual(kartenName({ nummer: 1, titel: 'eins', klasse: 'bug' }, KLASSEN, false), '#1 eins, Fehler');
  assert.strictEqual(kartenName({ nummer: 2, titel: 'zwei', klasse: 'feature' }, KLASSEN, false), '#2 zwei, Funktion');
});

test('ohne Klasse nur Nummer und Titel', () => {
  assert.strictEqual(kartenName({ nummer: 3, titel: 'drei', klasse: null }, KLASSEN, false), '#3 drei');
});

test('ein unbekannter Klassenschlüssel ergibt keinen Zusatz und nie den Schlüssel', () => {
  assert.strictEqual(kartenName({ nummer: 5, titel: 'fünf', klasse: 'chore' }, KLASSEN, false), '#5 fünf');
});

test('bei Auswahl endet der Name mit „, ausgewählt“, auch ohne Klasse', () => {
  assert.strictEqual(kartenName({ nummer: 1, titel: 'eins', klasse: 'bug' }, KLASSEN, true), '#1 eins, Fehler, ausgewählt');
  assert.strictEqual(kartenName({ nummer: 3, titel: 'drei' }, KLASSEN, true), '#3 drei, ausgewählt');
});

test('Sonderzeichen bleiben Klartext — maskiert wird erst beim Einsetzen ins Attribut', () => {
  assert.strictEqual(kartenName({ nummer: 3, titel: 'Ölwechsel & <Prüfung>' }, KLASSEN, false), '#3 Ölwechsel & <Prüfung>');
});

test('ein Datum im Titel bleibt, wie es ist; der Name fügt keines hinzu', () => {
  const aufgabe = { nummer: 7, titel: 'Abgabe 28.10.', klasse: 'bug', faellig: '2026-10-28' };
  assert.strictEqual(kartenName(aufgabe, KLASSEN, false), '#7 Abgabe 28.10., Fehler');
});

test('ohne Klassenliste (kanbanD.md defekt) entfällt der Zusatz', () => {
  assert.strictEqual(kartenName({ nummer: 1, titel: 'eins', klasse: 'bug' }, undefined, false), '#1 eins');
});

test('defekte Datei und fehlende Aufgabe', () => {
  assert.strictEqual(kartenNameDefekt(4), '#4 Datei defekt, nur lesbar');
  assert.strictEqual(kartenNameFehlt(9), '#9 Aufgabe fehlt');
});

// R00114 FA 9 (ADR-0019 Regel 2, X00005): der Zusatz des vergessenen Timers steht vor „ausgewählt“, fehlende Teile fallen samt Komma weg
test('Zusatz „Timer läuft seit 6 Tagen“ zwischen Klasse und Auswahl', () => {
  assert.strictEqual(kartenName({ nummer: 1, titel: 'eins', klasse: 'bug' }, KLASSEN, false, 'Timer läuft seit 6 Tagen'), '#1 eins, Fehler, Timer läuft seit 6 Tagen');
  assert.strictEqual(kartenName({ nummer: 1, titel: 'eins', klasse: 'bug' }, KLASSEN, true, 'Timer läuft seit 6 Tagen'), '#1 eins, Fehler, Timer läuft seit 6 Tagen, ausgewählt');
  assert.strictEqual(kartenName({ nummer: 3, titel: 'drei' }, KLASSEN, false, 'Timer läuft seit 1 Tag'), '#3 drei, Timer läuft seit 1 Tag');
  assert.strictEqual(kartenName({ nummer: 3, titel: 'drei' }, KLASSEN, true, ''), '#3 drei, ausgewählt');
});
