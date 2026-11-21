// Unit-Tests der Tastaturziele (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { nachbar, verschiebeziel, radioSchritt, tasteLoestAus } = require('../../web/tastatur.js');

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
  assert.deepStrictEqual(gFolge('g', 'u'), { ziel: '#/berichte/durchsatz', warte: false });
  assert.deepStrictEqual(gFolge('g', 'w'), { ziel: '#/berichte/prognose', warte: false });
  assert.deepStrictEqual(gFolge('g', 'k'), { ziel: null, warte: false }, 'R00222: g k führt nirgends hin');
  assert.deepStrictEqual(gFolge('g', 'x'), { ziel: null, warte: false });
  assert.deepStrictEqual(gFolge(null, 'a'), { ziel: null, warte: false });
  assert.deepStrictEqual(gFolge('g', 'g'), { ziel: null, warte: false });
});

test('radioSchritt(3, 0, ArrowLeft) → 2: Pfeile mit Umlauf, andere Tasten gehören nicht der Gruppe (R00106)', () => {
  assert.strictEqual(radioSchritt(3, 0, 'ArrowLeft'), 2);
  assert.strictEqual(radioSchritt(3, 0, 'ArrowUp'), 2);
  assert.strictEqual(radioSchritt(3, 2, 'ArrowRight'), 0);
  assert.strictEqual(radioSchritt(3, 2, 'ArrowDown'), 0);
  assert.strictEqual(radioSchritt(3, 1, 'ArrowRight'), 2);
  assert.strictEqual(radioSchritt(3, 1, 'ArrowLeft'), 0);
  assert.strictEqual(radioSchritt(3, -1, 'ArrowRight'), 0, 'ohne Wahl: vorwärts zum ersten');
  assert.strictEqual(radioSchritt(3, 1, 'Tab'), null);
  assert.strictEqual(radioSchritt(3, 1, 'Enter'), null);
  assert.strictEqual(radioSchritt(3, 1, 'a'), null);
});

const OHNE_ZUSATZ = { strg: false, alt: false, meta: false };
const druck = (taste, zusatz = {}) => ({ taste, ...OHNE_ZUSATZ, ...zusatz });
const farbfeld = { tag: 'SPAN', rolle: 'button', aktion: 'k-pal' };
const kaestchen = { tag: 'I', rolle: 'checkbox', aktion: 'teil' };
const berichtszeile = { tag: 'TR', rolle: null, aktion: 'oeffnen' };

test('tasteLoestAus: Rolle button und Zeile mit Aktion lösen auf Enter und Leertaste aus (R00180)', () => {
  for (const element of [farbfeld, berichtszeile]) {
    assert.strictEqual(tasteLoestAus(element, druck('Enter')), true);
    assert.strictEqual(tasteLoestAus(element, druck(' ')), true);
    assert.strictEqual(tasteLoestAus(element, druck('a')), false);
    assert.strictEqual(tasteLoestAus(element, druck('Tab')), false);
  }
});

test('tasteLoestAus: ein Kästchen löst nur auf die Leertaste aus, nicht auf Enter (R00180)', () => {
  assert.strictEqual(tasteLoestAus(kaestchen, druck(' ')), true);
  assert.strictEqual(tasteLoestAus(kaestchen, druck('Enter')), false);
});

test('tasteLoestAus: mit Strg, Alt oder Meta löst nichts aus (R00180)', () => {
  for (const zusatz of ['strg', 'alt', 'meta']) {
    for (const element of [farbfeld, kaestchen, berichtszeile]) {
      assert.strictEqual(tasteLoestAus(element, druck(' ', { [zusatz]: true })), false, `Leertaste mit ${zusatz}`);
      assert.strictEqual(tasteLoestAus(element, druck('Enter', { [zusatz]: true })), false, `Enter mit ${zusatz}`);
    }
  }
});

test('tasteLoestAus: Eingabefelder schreiben weiter, native Knöpfe und Links lösen selbst aus (R00180)', () => {
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A', 'SUMMARY']) {
    assert.strictEqual(tasteLoestAus({ tag, rolle: 'button', aktion: 'x' }, druck(' ')), false, `${tag} mit Leertaste`);
    assert.strictEqual(tasteLoestAus({ tag, rolle: 'checkbox', aktion: 'x' }, druck(' ')), false, `${tag} als Kästchen`);
    assert.strictEqual(tasteLoestAus({ tag, rolle: null, aktion: 'x' }, druck('Enter')), false, `${tag} mit Enter`);
  }
});

test('tasteLoestAus: ohne Rolle und ohne Aktion löst nichts aus — auch keine Zeile ohne data-act (R00180)', () => {
  assert.strictEqual(tasteLoestAus({ tag: 'TR', rolle: null, aktion: undefined }, druck('Enter')), false);
  assert.strictEqual(tasteLoestAus({ tag: 'DIV', rolle: null, aktion: 'oeffnen' }, druck(' ')), false);
  assert.strictEqual(tasteLoestAus({ tag: 'SPAN', rolle: 'radio', aktion: 'sp' }, druck(' ')), false, 'Radios führt radioSchritt');
});
