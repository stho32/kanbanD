// Unit-Tests der Plausibilitätsprüfungen in der Oberfläche (R00059, node --test)
const test = require('node:test');
const assert = require('node:assert');
const { warnungsKnoten } = require('../../web/wbs.js');

test('Warnung nennt jeden nicht grünen Knoten mit Ziel in der WBS-Sicht', () => {
  const w = { pruefung: 'wbs-effects-green', text: 'Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.', knoten: ['kd:I0048', 'kd:I0099'], details: ['kd:I0048 rot', 'kd:I0099 Knoten fehlt'] };
  assert.deepStrictEqual(warnungsKnoten(w), [
    { text: 'kd:I0048', ziel: '#/wbs/kd/I0048', titel: 'kd:I0048 rot — in der WBS-Sicht zeigen' },
    { text: 'kd:I0099', ziel: '#/wbs/kd/I0099', titel: 'kd:I0099 Knoten fehlt — in der WBS-Sicht zeigen' },
  ]);
  assert.deepStrictEqual(warnungsKnoten({ knoten: ['I0007'] }), [{ text: 'I0007', ziel: '#/wbs//I0007', titel: 'I0007 — in der WBS-Sicht zeigen' }], 'ohne Kürzel die Standardanwendung');
});
