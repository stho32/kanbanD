// Unit-Tests des Prüfhelfers für die Kopfzeile (R00101, B0263)
const test = require('node:test');
const assert = require('node:assert');
const { kopfKonflikte } = require('../tests/kopfzeile-hilfen.js');

const FENSTER = { breite: 1280, hoehe: 720 };
const KOPF = { x: 0, y: 0, breite: 1280, hoehe: 40, zeilen: [] };
const element = (name, x, breite, o = {}) => ({ name, x, y: o.y || 7, breite, hoehe: o.hoehe || 26, getroffen: o.getroffen !== false });

test('Befund bei 1280 px: „Neue Aufgabe“ 1065–1172 und „3 laufen“ 1043–1124 überlappen auf 59 px Breite', () => {
  const konflikte = kopfKonflikte([element('+ Neue Aufgabe', 1065, 107), element('3 laufen', 1043, 81)], FENSTER, KOPF);
  assert.deepStrictEqual(konflikte, [{ art: 'überlappt', a: '+ Neue Aufgabe', b: '3 laufen', flaeche: 59 * 26 }]);
});

test('berührende Kanten sind keine Überlappung', () => {
  assert.deepStrictEqual(kopfKonflikte([element('a', 0, 100), element('b', 100, 50)], FENSTER, KOPF), []);
});

test('Element, das über das Fenster oder die Kopfzeile hinausragt, ist abgeschnitten', () => {
  const konflikte = kopfKonflikte([element('rechts', 1250, 60), element('unten', 10, 20, { y: 30, hoehe: 20 })], FENSTER, KOPF);
  assert.deepStrictEqual(konflikte, [{ art: 'abgeschnitten', name: 'rechts' }, { art: 'abgeschnitten', name: 'unten' }]);
});

test('Element, das elementFromPoint im Mittelpunkt nicht trifft, ist verdeckt', () => {
  assert.deepStrictEqual(kopfKonflikte([element('unten drunter', 10, 20, { getroffen: false })], FENSTER, KOPF), [{ art: 'verdeckt', name: 'unten drunter' }]);
});

test('Zeile mit waagerechtem Überlauf ist ein Konflikt', () => {
  const zeile = { name: 'Zeile 1', scrollBreite: 1300, clientBreite: 1280 };
  assert.deepStrictEqual(kopfKonflikte([], FENSTER, { ...KOPF, zeilen: [zeile] }), [{ art: 'Überlauf', name: 'Zeile 1', um: 20 }]);
});
