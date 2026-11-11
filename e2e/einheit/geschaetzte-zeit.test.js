// Unit-Tests der geschätzten Zeit (R00129, node --test): gespeicherte Minuten werden erst beim Zeichnen zu h:mm.
// Die Anzeige rechnet über den vorhandenen Helfer hm (web/zeiten.js), damit es keine zweite Zeitform gibt.
const test = require('node:test');
const assert = require('node:assert');
const { hm } = require('../../web/zeiten.js');

test('Geschätzte Minuten als h:mm: hm(minuten * 60000) — dieselbe Form wie die gebuchte Zeit', () => {
  assert.strictEqual(hm(150 * 6e4), '2:30');
  assert.strictEqual(hm(5 * 6e4), '0:05', 'fünf Minuten, nicht fünf Stunden');
  assert.strictEqual(hm(1 * 6e4), '0:01');
  assert.strictEqual(hm(100000 * 6e4), '1666:40', 'Grenzwert oben, rund 69 Tage');
  assert.strictEqual(hm(0), '0:00');
});
