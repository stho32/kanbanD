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

const { kartenPruefungen, pruefWbsAnwendungen } = require('../../web/wbs.js');
const sp = (name, aufgaben, phase, pruefungen) => ({ name, aufgaben, phase: phase || null, pruefungen: pruefungen || [] });
const G = ['wbs-effects-green'];
const wbsMit = status => ({ knoten: [{ id: 'I0048', gerechnet: status }, { id: 'I0012', gerechnet: 'gruen' }] });
const a7 = { nummer: 7, wirkungen: [{ application: 'kd', action: 'create', node: 'I0048' }, { application: 'kd', action: 'remove', node: 'I0049' }] };

test('Ausrufezeichen rechts einer Spalte mit nicht erfüllter Prüfung, gerechnet nach Spaltenindex', () => {
  const b = { spalten: [sp('Entwicklung', [], null, G), sp('Entwicklertest', [7]), sp('Erledigt', [])], phasen: null };
  assert.deepStrictEqual(kartenPruefungen(b, a7, { kd: wbsMit('rot') }), [{ pruefung: 'wbs-effects-green', text: 'Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.', knoten: ['kd:I0048'], details: ['kd:I0048 rot'] }]);
  assert.deepStrictEqual(kartenPruefungen(b, a7, { kd: wbsMit('gruen') }), [], 'grün: verschwindet');
  assert.deepStrictEqual(kartenPruefungen({ ...b, spalten: [sp('Entwicklung', [7], null, G), sp('Erledigt', [])] }, a7, { kd: wbsMit('rot') }), [], 'in der Spalte mit Prüfung selbst nicht');
  assert.deepStrictEqual(kartenPruefungen(b, { nummer: 7, wirkungen: [] }, {}), [], 'ohne Wirkungen erfüllt');
  assert.deepStrictEqual(kartenPruefungen(b, { nummer: 9, wirkungen: a7.wirkungen }, {}), [], 'nicht auf dem Board');
});

test('mit Phasen zählt der Rang der Phase; fehlende Knoten und unerreichbare WBS mit eigenem Text; unbekannte Prüfung prüft nichts', () => {
  const folge = [{ name: 'Entwicklung' }, { name: 'Entwicklertest' }, { name: 'Abnahme' }];
  const b = { spalten: [sp('Backlog', [8]), sp('Entwicklung', [], 'Entwicklung', [...G, 'xyz']), sp('Abnahme Stefan', [], 'Abnahme', G), sp('Abnahme Mia', [7], 'Abnahme'), sp('Erledigt', [])], phasen: { folge } };
  const a8 = { nummer: 8, wirkungen: a7.wirkungen };
  assert.deepStrictEqual(kartenPruefungen(b, a7, { kd: wbsMit('rot') })[0].knoten, ['kd:I0048'], 'Abnahme Mia ist rechts von Entwicklung, gleich weit wie Abnahme Stefan');
  assert.deepStrictEqual(kartenPruefungen(b, a8, { kd: wbsMit('rot') }), [], 'Backlog ist in keiner Phase');
  assert.deepStrictEqual(kartenPruefungen(b, a7, { kd: { knoten: [] } })[0].details, ['kd:I0048 Knoten fehlt']);
  assert.deepStrictEqual(kartenPruefungen(b, a7, { kd: null })[0].details, ['kd:I0048 WBS nicht erreichbar']);
  assert.deepStrictEqual(kartenPruefungen(b, a7, {})[0].details, ['kd:I0048 WBS nicht erreichbar'], 'nicht geladen');
});

test('geladen werden nur die Anwendungen, auf die Karten des Boards mit create oder rework wirken — nur wenn eine Spalte prüft', () => {
  const b = { spalten: [sp('Entwicklung', [7, 8], null, G), sp('Erledigt', [9])] };
  const aufgaben = [a7, { nummer: 8, wirkungen: [{ application: 'kc', action: 'rework', node: 'I0001' }, { application: 'kx', action: 'remove', node: 'I0002' }] }, { nummer: 9, wirkungen: [{ application: 'kd', action: 'create', node: 'I0003' }] }, { nummer: 10, wirkungen: [{ application: 'ky', action: 'create', node: 'I0004' }] }];
  assert.deepStrictEqual(pruefWbsAnwendungen(b, aufgaben), ['kd', 'kc']);
  assert.deepStrictEqual(pruefWbsAnwendungen({ spalten: [sp('A', [7])] }, aufgaben), [], 'ohne Prüfung nichts laden');
  assert.deepStrictEqual(pruefWbsAnwendungen(null, aufgaben), []);
});
