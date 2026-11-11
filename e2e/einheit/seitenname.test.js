// Unit-Tests des Seitennamens und der Seitenüberschrift (node --test), R00113 US-1 / ADR-0018 Regel 2
const test = require('node:test');
const assert = require('node:assert');
const { seitenNameVon, seitenUeberschrift, BERICHTSNAMEN } = require('../../web/seitenname.js');

test('Seitenname je Ansicht wie der Seitenknopf', () => {
  assert.strictEqual(seitenNameVon('board'), 'Board');
  assert.strictEqual(seitenNameVon('aufgaben'), 'Aufgaben');
  assert.strictEqual(seitenNameVon('personen'), 'Personen');
  assert.strictEqual(seitenNameVon('berichte/verlauf'), 'Berichte');
  assert.strictEqual(seitenNameVon('wbs'), 'WBS');
  assert.strictEqual(seitenNameVon('einrichten'), 'Einrichten');
});

test('Board mit Boardtitel, ohne Board nur der Seitenname', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'board', boardTitel: 'Entwicklung' }), 'Board · Entwicklung');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'board' }), 'Board');
});

test('Bericht mit dem Namen aus dem Menü Berichte', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/verlauf' }), 'Berichte · Burndown');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/kreuz' }), 'Berichte · Zeiten nach Aufgabe und Person');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/fluss' }), 'Berichte · Kumulativer Fluss');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/unbekannt' }), 'Berichte');
  assert.strictEqual(Object.keys(BERICHTSNAMEN).length, 9);
});

test('WBS mit dem Namen der Anwendung', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'wbs', anwendung: 'kanbanD' }), 'WBS · kanbanD');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'wbs' }), 'WBS');
});

test('erster Start heißt Einrichten, gleich welche Ansicht', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'board', ersterStart: true }), 'Einrichten');
});

test('übrige Seiten tragen nur ihren Namen', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'aufgaben', boardTitel: 'Entwicklung' }), 'Aufgaben');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'personen' }), 'Personen');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'einrichten' }), 'Einrichten');
});
