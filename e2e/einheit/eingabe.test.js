// Unit-Tests der Eingabe-Auswertung (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { zeilenAusText } = require('../../web/eingabe.js');

test('Zeilen ohne Listenzeichen und Leerzeilen', () => {
  assert.deepStrictEqual(zeilenAusText('- a\n\n* b\n1. c\n- [ ] d\n  e  \r\n2) f\n+ g\n- [x] h'), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepStrictEqual(zeilenAusText('-nicht entfernt\n#12 bleibt'), ['-nicht entfernt', '#12 bleibt']);
  assert.deepStrictEqual(zeilenAusText(''), []);
  assert.deepStrictEqual(zeilenAusText(undefined), []);
});
