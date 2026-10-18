// Unit-Tests der WBS-Sicht (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { gebundeneAnwendungen } = require('../../web/wbs.js');

const kd = { kuerzel: 'kd', name: 'kanbanD' }, kc = { kuerzel: 'kc', name: 'Kasse' };

test('Board bindet die genannten registrierten Anwendungen, ohne Nennung die einzige', () => {
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: ['kc', 'kd'] }, [kd, kc]), [kc, kd], 'Reihenfolge des Boards');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: ['kd', 'xx'] }, [kd, kc]), [kd], 'nicht registriert fällt weg');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: [] }, [kd]), [kd], 'genau eine registrierte gilt als gebunden');
  assert.deepStrictEqual(gebundeneAnwendungen({}, [kd]), [kd], 'auch ohne Schlüssel');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: [] }, [kd, kc]), [], 'bei mehreren ein reines Kanban');
  assert.deepStrictEqual(gebundeneAnwendungen(null, []), []);
});
