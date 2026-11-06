// Unit-Tests der Tastaturziele (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { nachbar, verschiebeziel, naechsterReiter } = require('../../web/tastatur.js');

const sp = [{ name: 'A', karten: [1, 2, 3] }, { name: 'B', karten: [] }, { name: 'C', karten: [4] }];

test('Nachbarn über leere Spalten und Ränder', () => {
  assert.strictEqual(nachbar(sp, 2, 'rechts'), 4);
  assert.strictEqual(nachbar(sp, 4, 'links'), 1, 'gleiche Position (0) in A');
  assert.strictEqual(nachbar([{ name: 'A', karten: [1] }, { name: 'B', karten: [2, 3, 4] }], 4, 'links'), 1, 'Position 2 gibt es in A nicht, also die letzte');
  assert.strictEqual(nachbar(sp, 1, 'runter'), 2);
  assert.strictEqual(nachbar(sp, 3, 'runter'), null);
  assert.strictEqual(nachbar(sp, 1, 'hoch'), null);
  assert.strictEqual(nachbar(sp, 4, 'rechts'), null);
  assert.strictEqual(nachbar(sp, 2, 'hoch'), 1);
  assert.strictEqual(nachbar(sp, null, 'rechts'), 1, 'ohne Fokus die erste sichtbare');
  assert.strictEqual(nachbar([{ name: 'A', karten: [] }], null, 'runter'), null);
});

test('Verschiebeziele', () => {
  assert.deepStrictEqual(verschiebeziel(sp, 2, 'rechts'), { spalte: 'B', index: 0 });
  assert.deepStrictEqual(verschiebeziel(sp, 3, 'rechts'), { spalte: 'B', index: 0 });
  assert.deepStrictEqual(verschiebeziel(sp, 2, 'hoch'), { spalte: 'A', index: 0 });
  assert.deepStrictEqual(verschiebeziel(sp, 2, 'runter'), { spalte: 'A', index: 2 });
  assert.deepStrictEqual(verschiebeziel(sp, 4, 'links'), { spalte: 'B', index: 0 });
  assert.strictEqual(verschiebeziel(sp, 1, 'links'), null);
  assert.strictEqual(verschiebeziel(sp, 4, 'rechts'), null);
  assert.strictEqual(verschiebeziel(sp, 3, 'runter'), null);
  assert.strictEqual(verschiebeziel(sp, 9, 'links'), null);
});

const { gFolge } = require('../../web/tastatur.js');

test('g-Folgen', () => {
  assert.deepStrictEqual(gFolge(null, 'g'), { ziel: null, warte: true });
  assert.deepStrictEqual(gFolge('g', 'a'), { ziel: '#/aufgaben', warte: false });
  assert.deepStrictEqual(gFolge('g', 'v'), { ziel: '#/berichte/verlauf', warte: false });
  assert.deepStrictEqual(gFolge('g', 'd'), { ziel: '#/berichte/durchlauf', warte: false });
  assert.deepStrictEqual(gFolge('g', 'w'), { ziel: '#/berichte/prognose', warte: false });
  assert.deepStrictEqual(gFolge('g', 'k'), { ziel: '#/wbs/', warte: false });
  assert.deepStrictEqual(gFolge('g', 'x'), { ziel: null, warte: false });
  assert.deepStrictEqual(gFolge(null, 'a'), { ziel: null, warte: false });
  assert.deepStrictEqual(gFolge('g', 'g'), { ziel: null, warte: false });
});

/* ── Reiterleiste des Aufgabenfensters (R00105 B0375, APG Tabs mit automatischer Aktivierung) ── */
const ZWEI = ['inhalt', 'datei'], DREI = ['inhalt', 'datei', 'kosten'];

test('Reiter: Pfeile mit Umlauf, Pos1 und Ende — zwei Reiter', () => {
  assert.strictEqual(naechsterReiter(ZWEI, 'inhalt', 'ArrowRight'), 'datei');
  assert.strictEqual(naechsterReiter(ZWEI, 'datei', 'ArrowRight'), 'inhalt', 'Umlauf am rechten Rand');
  assert.strictEqual(naechsterReiter(ZWEI, 'inhalt', 'ArrowLeft'), 'datei', 'Umlauf am linken Rand');
  assert.strictEqual(naechsterReiter(ZWEI, 'datei', 'ArrowLeft'), 'inhalt');
  assert.strictEqual(naechsterReiter(ZWEI, 'datei', 'Home'), 'inhalt');
  assert.strictEqual(naechsterReiter(ZWEI, 'inhalt', 'End'), 'datei');
});

test('Reiter: drei Reiter — Probe PO Z. 88: → zweimal → „Kosten“, noch einmal → „Inhalt“', () => {
  const zweimal = naechsterReiter(DREI, naechsterReiter(DREI, 'inhalt', 'ArrowRight'), 'ArrowRight');
  assert.strictEqual(zweimal, 'kosten');
  assert.strictEqual(naechsterReiter(DREI, zweimal, 'ArrowRight'), 'inhalt');
  assert.strictEqual(naechsterReiter(DREI, 'inhalt', 'ArrowLeft'), 'kosten');
  assert.strictEqual(naechsterReiter(DREI, 'kosten', 'ArrowLeft'), 'datei');
  assert.strictEqual(naechsterReiter(DREI, 'datei', 'End'), 'kosten');
  assert.strictEqual(naechsterReiter(DREI, 'kosten', 'Home'), 'inhalt');
});

test('Reiter: Enter und Leertaste zeigen den fokussierten Reiter, andere Tasten gehören nicht der Leiste', () => {
  assert.strictEqual(naechsterReiter(DREI, 'datei', 'Enter'), 'datei');
  assert.strictEqual(naechsterReiter(DREI, 'kosten', ' '), 'kosten');
  for (const taste of ['ArrowUp', 'ArrowDown', 'd', 'Tab', 'Escape']) assert.strictEqual(naechsterReiter(DREI, 'inhalt', taste), null, taste);
  assert.strictEqual(naechsterReiter(DREI, 'unbekannt', 'ArrowRight'), null, 'Fehlfall: Reiter nicht in der Liste');
});
