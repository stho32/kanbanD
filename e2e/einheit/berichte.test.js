// Unit-Tests der Berichte (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { FILTER_LEER, zeitraumGrenzen, aufgabePasst, zeitenGefiltert, filterAnzahl, filterAus } = require('../../web/berichte.js');

const jetzt = new Date(2026, 9, 21, 12, 0).getTime(); // Mittwoch, 21.10.2026
const d = (j, m, t) => new Date(j, m - 1, t).getTime();
const f = x => ({ ...FILTER_LEER, ...x });

test('Zeitraum-Vorgaben', () => {
  const g = z => { const r = zeitraumGrenzen(f({ zeitraum: z }), jetzt); return [r.von, r.bis]; };
  assert.deepStrictEqual(g('heute'), [d(2026, 10, 21), d(2026, 10, 22)]);
  assert.deepStrictEqual(g('gestern'), [d(2026, 10, 20), d(2026, 10, 21)]);
  assert.deepStrictEqual(g('woche'), [d(2026, 10, 19), d(2026, 10, 26)]);
  assert.deepStrictEqual(g('vorwoche'), [d(2026, 10, 12), d(2026, 10, 19)]);
  assert.deepStrictEqual(g('monat'), [d(2026, 10, 1), d(2026, 11, 1)]);
  assert.deepStrictEqual(g('vormonat'), [d(2026, 9, 1), d(2026, 10, 1)]);
  assert.deepStrictEqual(g('30'), [d(2026, 9, 22), d(2026, 10, 22)]);
  assert.deepStrictEqual(g('90'), [d(2026, 7, 24), d(2026, 10, 22)]);
  assert.deepStrictEqual(g('jahr'), [d(2026, 1, 1), d(2027, 1, 1)]);
  assert.deepStrictEqual(g('alles'), [0, Infinity]);
  const e = zeitraumGrenzen(f({ zeitraum: 'eigen', von: '2026-10-05', bis: '2026-10-06' }), jetzt);
  assert.deepStrictEqual([e.von, e.bis], [d(2026, 10, 5), d(2026, 10, 7)], 'bis schließt den Tag ein');
  const so = zeitraumGrenzen(f({ zeitraum: 'woche' }), new Date(2026, 9, 25, 20).getTime());
  assert.strictEqual(so.von, d(2026, 10, 19), 'Sonntag gehört zur Woche ab Montag');
});

test('Aufgabe passt zu Farbe, Person, Label', () => {
  const a = { klasse: 'bug', zustaendige: ['mi'], labels: ['ui'] }, b = { klasse: null, zustaendige: [], labels: [] };
  assert.ok(aufgabePasst(f({}), a) && aufgabePasst(f({}), b) && aufgabePasst(f({}), undefined));
  assert.ok(!aufgabePasst(f({ ohneFarben: ['bug'] }), a));
  assert.ok(!aufgabePasst(f({ ohneFarben: [''] }), b) && !aufgabePasst(f({ ohneFarben: [''] }), undefined));
  assert.ok(aufgabePasst(f({ personen: ['mi', 'st'] }), a) && !aufgabePasst(f({ personen: ['st'] }), a) && !aufgabePasst(f({ personen: ['st'] }), undefined));
  assert.ok(aufgabePasst(f({ labels: ['ui'] }), a) && !aufgabePasst(f({ labels: ['daten'] }), a));
});

test('Zeiten nach Person, Anzahl, Lesen', () => {
  const a = [{ klasse: 'bug', zustaendige: [], labels: [], zeiten: [{ wer: 'st' }, { wer: 'mi' }] }, { klasse: 'ux', zustaendige: [], labels: [], zeiten: [{ wer: 'mi' }] }];
  const r = zeitenGefiltert(a, f({ ohneFarben: ['ux'], personen: ['mi'] }));
  assert.deepStrictEqual(r.map(x => x.zeiten.map(z => z.wer)), [['mi']]);
  assert.strictEqual(a[0].zeiten.length, 2, 'Original unverändert');
  assert.strictEqual(filterAnzahl(f({ zeitraum: 'woche', ohneFarben: ['a', 'b'], labels: ['x'] })), 4);
  assert.deepStrictEqual(filterAus('{"zeitraum":"gibts","personen":"mi","labels":["x"],"fremd":1}'), f({ labels: ['x'] }));
  assert.deepStrictEqual(filterAus('kaputt'), FILTER_LEER);
});
