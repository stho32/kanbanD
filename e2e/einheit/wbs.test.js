// Unit-Tests der WBS-Sicht (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { prozente, standText, gebundeneAnwendungen, tiefen, mitKindern, anzeigename, anforderungsIds, zugeklappt, ausgeblendet, statusSetzbar, kindEbenen } = require('../../web/wbs.js');

const kd = { kuerzel: 'kd', name: 'kanbanD' }, kc = { kuerzel: 'kc', name: 'Kasse' };

test('Board bindet die genannten registrierten Anwendungen, ohne Nennung die einzige', () => {
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: ['kc', 'kd'] }, [kd, kc]), [kc, kd], 'Reihenfolge des Boards');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: ['kd', 'xx'] }, [kd, kc]), [kd], 'nicht registriert fällt weg');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: [] }, [kd]), [kd], 'genau eine registrierte gilt als gebunden');
  assert.deepStrictEqual(gebundeneAnwendungen({}, [kd]), [kd], 'auch ohne Schlüssel');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: [] }, [kd, kc]), [], 'bei mehreren ein reines Kanban');
  assert.deepStrictEqual(gebundeneAnwendungen(null, []), []);
});

const k = (id, eltern, status = 'rot', rest = {}) => ({ id, eltern, status, name: 'N' + id, ausbaustufe: '', ...rest });

test('Tiefe A → D → I → B: drei Einrückungsstufen', () => {
  const baum = [k('A0001', ''), k('D0001', 'A0001'), k('I0001', 'D0001'), k('B0001', 'I0001'), k('D0002', 'A0001')];
  assert.deepStrictEqual(tiefen(baum), { A0001: 0, D0001: 1, I0001: 2, B0001: 3, D0002: 1 });
  assert.deepStrictEqual(tiefen([k('I0001', 'I0002'), k('I0002', 'I0001')]), { I0001: 1, I0002: 1 }, 'Zyklus bricht ab');
});

test('Knoten mit Kindern, auf Wunsch nur zählende', () => {
  const baum = [k('I0001', ''), k('F0001', 'I0001', 'option'), k('I0002', ''), k('B0001', 'I0002', 'bestehend')];
  assert.deepStrictEqual([...mitKindern(baum, false)].sort(), ['I0001', 'I0002']);
  assert.deepStrictEqual([...mitKindern(baum, true)], ['I0002'], 'option zählt nicht, bestehend schon');
});

test('Ausbaustufe als Namenspräfix, Anforderungen aus der Zelle', () => {
  assert.strictEqual(anzeigename(k('F0003', 'I0002', 'ausbau', { name: 'Blockziffern', ausbaustufe: '2' })), '2 · Blockziffern');
  assert.strictEqual(anzeigename(k('F0001', 'I0002', 'gruen', { name: 'Text' })), 'Text');
  assert.deepStrictEqual(anforderungsIds('R00053, R00054'), ['R00053', 'R00054']);
  assert.deepStrictEqual(anforderungsIds(''), []);
  assert.deepStrictEqual(anforderungsIds('R0005 R000540'), []);
});

test('Klappen: ohne Wahl nur der aktive Ast offen; zu blendet die Nachfahren aus, nicht sich selbst', () => {
  const baum = [k('A0001', '', 'gelb', { ebene: 'Application' }), k('D0001', 'A0001', 'gelb', { ebene: 'Dialog' }), k('I0001', 'D0001', 'gelb', { ebene: 'Interaction' }), k('B0001', 'I0001', 'gelb', { ebene: 'Bubble' }), k('D0002', 'A0001', 'rot', { ebene: 'Dialog' }), k('I0002', 'D0002', 'rot', { ebene: 'Interaction' })];
  const pfad = ['A0001', 'D0001', 'I0001', 'B0001'];
  assert.deepStrictEqual([...zugeklappt(baum, {}, pfad)], ['D0002'], 'I0002 hat keine Kinder, A0001 ist nicht klappbar');
  assert.deepStrictEqual([...ausgeblendet(baum, zugeklappt(baum, {}, pfad))], ['I0002']);
  const zu = zugeklappt(baum, { D0001: false, D0002: true }, pfad);
  assert.deepStrictEqual([...zu], ['D0001']);
  assert.deepStrictEqual([...ausgeblendet(baum, zu)], ['I0001', 'B0001'], 'D0001 selbst bleibt sichtbar');
});

test('Stand in Prozent: 2 grün, 1 gelb, 1 rot von 4 Slices', () => {
  assert.strictEqual(standText({ gruen: 2, gelb: 1, rot: 1, slices: 4 }), '50 % funktional · 25 % in Bearbeitung · 25 % offen');
  assert.deepStrictEqual(prozente({ gruen: 1, gelb: 1, rot: 1, slices: 3 }), { gruen: 34, gelb: 33, rot: 33 }, 'zusammen 100');
  assert.deepStrictEqual(prozente({ gruen: 0, gelb: 0, rot: 0, slices: 0 }), { gruen: 0, gelb: 0, rot: 0 });
  assert.deepStrictEqual(prozente({ gruen: 1, gelb: 0, rot: 6, slices: 7 }), { gruen: 14, gelb: 0, rot: 86 });
});

test('Status setzbar nur an Blättern mit rot, gelb oder gruen', () => {
  const baum = [k('I0001', ''), k('B0001', 'I0001', 'gruen'), k('I0002', ''), k('F0001', 'I0002', 'option'), k('B0002', 'I0001', 'verworfen'), k('B0003', 'I0001', 'bestehend')];
  const kinder = mitKindern(baum, true);
  assert.deepStrictEqual(baum.filter(x => statusSetzbar(x, kinder)).map(x => x.id), ['B0001', 'I0002'], 'I0001 gerechnet, I0002 hat nur eine Option als Kind');
});

test('Kind-Ebenen: Feature überspringbar, unter Bubbles und Verworfenem nichts', () => {
  assert.deepStrictEqual(kindEbenen({ ebene: 'Application', status: 'gelb' }), ['Dialog']);
  assert.deepStrictEqual(kindEbenen({ ebene: 'Interaction', status: 'rot' }), ['Feature', 'Bubble']);
  assert.deepStrictEqual(kindEbenen({ ebene: 'Feature', status: 'option' }), ['Bubble'], 'unter einer Option darf weitergeplant werden');
  assert.deepStrictEqual(kindEbenen({ ebene: 'Bubble', status: 'rot' }), []);
  assert.deepStrictEqual(kindEbenen({ ebene: 'Dialog', status: 'verworfen' }), []);
});
