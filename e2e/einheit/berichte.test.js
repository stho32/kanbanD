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

const { burndown, spalteAm } = require('../../web/berichte.js');

const BEW = {
  spalten: ['A', 'B', 'Z'], jetzt: '2026-10-21 12:00',
  aufgaben: [
    { nummer: 1, wechsel: [{ zeitpunkt: '2026-10-18 09:00', spalte: 'A' }, { zeitpunkt: '2026-10-19 10:00', spalte: 'Z' }] },
    { nummer: 2, wechsel: [{ zeitpunkt: '2026-10-18 09:00', spalte: 'A' }, { zeitpunkt: '2026-10-20 10:00', spalte: 'B' }, { zeitpunkt: '2026-10-21 11:00', spalte: 'Z' }] },
    { nummer: 3, wechsel: [{ zeitpunkt: '2026-10-19 09:00', spalte: 'A' }, { zeitpunkt: '2026-10-20 09:00', spalte: null }] },
  ],
};
const ZU = { 1: { klasse: 'bug', zustaendige: [], labels: [] }, 2: { klasse: 'ux', zustaendige: [], labels: [] }, 3: { klasse: 'bug', zustaendige: [], labels: [] } };
const zu = nr => ZU[nr];

test('Spalte zu einem Zeitpunkt', () => {
  const w = BEW.aufgaben[1].wechsel;
  assert.strictEqual(spalteAm(w, new Date(2026, 9, 17).getTime()), null);
  assert.strictEqual(spalteAm(w, new Date(2026, 9, 20, 10, 0).getTime()), 'B');
  assert.strictEqual(spalteAm(BEW.aufgaben[2].wechsel, jetzt), null);
});

test('Burndown je Tag, Zeitraum, Ausschlüsse', () => {
  const kurz = t => t.map(x => [x.datum.slice(8), x.offen, x.umfang]);
  assert.deepStrictEqual(kurz(burndown(BEW, f({}), zu, jetzt)), [['18', 2, 2], ['19', 2, 3], ['20', 1, 2], ['21', 0, 2]]);
  assert.deepStrictEqual(kurz(burndown(BEW, f({ zeitraum: 'eigen', von: '2026-10-19', bis: '2026-10-20' }), zu, jetzt)), [['19', 2, 3], ['20', 1, 2]]);
  assert.deepStrictEqual(kurz(burndown(BEW, f({ ohneSpalten: ['A'] }), zu, jetzt)), [['18', 0, 0], ['19', 0, 1], ['20', 1, 2], ['21', 0, 2]]);
  assert.deepStrictEqual(kurz(burndown(BEW, f({ ohneFarben: ['ux'] }), zu, jetzt)), [['18', 1, 1], ['19', 1, 2], ['20', 0, 1], ['21', 0, 1]]);
  assert.deepStrictEqual(burndown({ spalten: [], aufgaben: [] }, f({}), zu, jetzt), []);
});

const { durchlaufzeiten, perzentil } = require('../../web/berichte.js');

test('Durchlaufzeit: Lead und Cycle Time, Zeitraum, Kennzahlen', () => {
  const lead = durchlaufzeiten(BEW, f({}), zu, jetzt, 'A', 'Z');
  assert.deepStrictEqual(lead.liste.map(x => [x.nummer, x.tage]), [[2, 3.1], [1, 1]]);
  assert.deepStrictEqual([lead.anzahl, lead.mittel, lead.median, lead.p85], [2, 2.1, 2.1, 3.1]);
  const cycle = durchlaufzeiten(BEW, f({}), zu, jetzt, 'B', 'Z');
  assert.deepStrictEqual(cycle.liste.map(x => [x.nummer, x.tage]), [[2, 1], [1, 0]], '#1 erreicht B mit dem Sprung nach Z');
  assert.deepStrictEqual(durchlaufzeiten(BEW, f({ zeitraum: 'eigen', von: '2026-10-21', bis: '2026-10-21' }), zu, jetzt, 'A', 'Z').liste.map(x => x.nummer), [2]);
  assert.deepStrictEqual(durchlaufzeiten(BEW, f({ ohneFarben: ['ux'] }), zu, jetzt, 'A', 'Z').liste.map(x => x.nummer), [1]);
  assert.strictEqual(durchlaufzeiten(BEW, f({}), zu, jetzt, 'Z', 'A').gueltig, false);
  const rueck = { spalten: ['A', 'Z'], aufgaben: [{ nummer: 9, wechsel: [{ zeitpunkt: '2026-10-01 00:00', spalte: 'A' }, { zeitpunkt: '2026-10-02 00:00', spalte: 'Z' }, { zeitpunkt: '2026-10-03 00:00', spalte: 'A' }, { zeitpunkt: '2026-10-05 00:00', spalte: 'Z' }] }] };
  assert.strictEqual(durchlaufzeiten(rueck, f({}), () => undefined, jetzt, 'A', 'Z').liste[0].tage, 1, 'erstes Erreichen zählt');
  assert.deepStrictEqual([perzentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85), perzentil([], 85)], [9, null]);
});

const { prognose, simuliere, tagesreihen, werktagDatum } = require('../../web/berichte.js');

test('Simulation: reproduzierbar, monoton, ohne Durchsatz keine', () => {
  const a = simuliere([1, 0, 2, 0, 1], 6), b = simuliere([1, 0, 2, 0, 1], 6);
  assert.deepStrictEqual(a, b);
  assert.ok(a[50] <= a[70] && a[70] <= a[85] && a[85] <= a[95]);
  assert.ok(a[50] >= 3 && a[95] <= 30, JSON.stringify(a));
  assert.deepStrictEqual(simuliere([2], 4), { 50: 2, 70: 2, 85: 2, 95: 2 });
  assert.strictEqual(simuliere([0, 0], 3), null);
});

test('Tagesreihen und Werktage', () => {
  const fr = d(2026, 10, 16), so = d(2026, 10, 18), mo = d(2026, 10, 19);
  assert.deepStrictEqual(tagesreihen([fr + 1, so + 5, so + 6, mo + 2], fr, d(2026, 10, 20)), { reihe7: [1, 0, 2, 1], reihe5: [1, 3] });
  assert.strictEqual(werktagDatum(fr, 1), mo);
  assert.strictEqual(werktagDatum(fr, 0), fr);
  assert.strictEqual(werktagDatum(mo, 5), d(2026, 10, 26));
});

test('Prognose je Spalte, Untergrenze, Ausschlüsse', () => {
  // A → B → Z; fünf erledigt an verschiedenen Tagen, zwei offen (eine in B)
  const w = (n, ...st) => ({ nummer: n, wechsel: st.map(([z, s]) => ({ zeitpunkt: z, spalte: s })) });
  const bew = { spalten: ['A', 'B', 'Z'], aufgaben: [
    w(1, ['2026-10-12 09:00', 'A'], ['2026-10-13 09:00', 'Z']),
    w(2, ['2026-10-12 09:00', 'A'], ['2026-10-14 09:00', 'B'], ['2026-10-15 09:00', 'Z']),
    w(3, ['2026-10-12 09:00', 'A'], ['2026-10-16 09:00', 'Z']),
    w(4, ['2026-10-12 09:00', 'A'], ['2026-10-19 09:00', 'Z']),
    w(5, ['2026-10-12 09:00', 'A'], ['2026-10-20 09:00', 'B']),
    w(6, ['2026-10-12 09:00', 'A']),
    w(7, ['2026-10-12 09:00', 'A'], ['2026-10-13 09:00', null]),
  ] };
  const zu7 = n => ({ klasse: n === 6 ? 'doku' : null, zustaendige: [], labels: [] });
  const p = prognose(bew, f({}), zu7, jetzt);
  assert.strictEqual(p.umfang, 6, '#7 ist vom Board genommen');
  assert.deepStrictEqual(p.phasen.map(x => [x.spalte, x.erreicht, x.offen, x.laeufe]), [['B', 5, 1, 5], ['Z', 4, 2, 4]]);
  const z = p.phasen[1];
  assert.deepStrictEqual(z.reihe7, [1, 0, 1, 1, 0, 0, 1, 0, 0], 'vom ersten Lauf 13.10. bis heute 21.10., Nulltage eingeschlossen');
  assert.deepStrictEqual(z.reihe5, [1, 0, 1, 1, 1, 0, 0], 'Sa und So fallen weg');
  assert.deepStrictEqual(z.zeilen.map(x => x.p), [50, 70, 85, 95]);
  assert.ok(z.zeilen.every(x => x.datum7 >= d(2026, 10, 22) && werktag5(x.datum5)));
  assert.ok(p.phasen[0].zeilen, 'B gemessen');
  assert.ok(z.zeilen.every(x => !x.untergrenze7 || x.untergrenze7 > x.datum7));
  assert.deepStrictEqual(p.tage.map(x => x.offen.Z), [7, 5, 5, 4, 3, 3, 3, 2, 2, 2]);
  assert.deepStrictEqual(p.tage.map(x => x.umfang), [7, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
  const ohneB = prognose(bew, f({ ohneSpalten: ['B'] }), zu7, jetzt);
  assert.deepStrictEqual(ohneB.phasen.map(x => [x.spalte, x.erreicht, x.offen]), [['Z', 4, 1]], '#5 liegt in B und zählt nicht');
  const ohneDoku = prognose(bew, f({ ohneFarben: ['doku'] }), zu7, jetzt);
  assert.deepStrictEqual(ohneDoku.phasen.map(x => x.offen), [0, 1]);
  assert.strictEqual(ohneDoku.phasen[0].zeilen, null, 'nichts offen → keine Perzentile');
  const kurz = prognose(bew, f({ zeitraum: 'eigen', von: '2026-10-19', bis: '2026-10-21' }), zu7, jetzt);
  assert.deepStrictEqual([kurz.phasen[1].laeufe, kurz.phasen[1].zeilen], [1, null], 'unter drei Läufen ungemessen');
  assert.strictEqual(kurz.tage.length, 3);
});

function werktag5(ms) { const w = new Date(ms).getDay(); return w !== 0 && w !== 6; }

test('Prognose: Spalte rechts nie früher als die links davon', () => {
  const w = (n, ...st) => ({ nummer: n, wechsel: st.map(([z, s]) => ({ zeitpunkt: z, spalte: s })) });
  // B früh dreimal erreicht, danach nichts mehr; Z erreicht die drei in den letzten Tagen schnell
  const bew = { spalten: ['A', 'B', 'Z'], aufgaben: [
    w(1, ['2026-09-22 09:00', 'B'], ['2026-10-19 09:00', 'Z']),
    w(2, ['2026-09-22 09:00', 'B'], ['2026-10-20 09:00', 'Z']),
    w(3, ['2026-09-22 09:00', 'B'], ['2026-10-21 09:00', 'Z']),
    w(4, ['2026-09-22 09:00', 'A']), w(5, ['2026-09-22 09:00', 'A']), w(6, ['2026-09-22 09:00', 'A']),
  ] };
  const p = prognose(bew, f({}), () => undefined, jetzt);
  const [b, z] = p.phasen;
  assert.ok(b.zeilen[0].datum7 > z.zeilen[0].datum7, 'Durchsatz von B langsamer');
  assert.ok(z.zeilen.every((x, k) => x.untergrenze7 === Math.max(b.zeilen[k].datum7, b.zeilen[k].untergrenze7 || 0) || x.datum7 >= b.zeilen[k].datum7));
  assert.strictEqual(z.zeilen[0].untergrenze7, b.zeilen[0].datum7);
  assert.strictEqual(z.zeilen[0].untergrenze5, b.zeilen[0].datum5);
});

test('Prognose: archiviert außerhalb der Abschlussspalte ist verworfen', () => {
  const bew = { spalten: ['A', 'Z'], aufgaben: [
    { nummer: 1, wechsel: [{ zeitpunkt: '2026-10-19 09:00', spalte: 'A' }] },
    { nummer: 2, wechsel: [{ zeitpunkt: '2026-10-19 09:00', spalte: 'A' }, { zeitpunkt: '2026-10-20 09:00', spalte: 'Z' }] },
    { nummer: 3, wechsel: [{ zeitpunkt: '2026-10-19 09:00', spalte: 'A' }] },
  ] };
  const zu = n => ({ 1: { archiviert: '2026-10-20' }, 2: { archiviert: '2026-10-21' }, 3: {} })[n];
  const voll = n => ({ klasse: null, zustaendige: [], labels: [], ...zu(n) });
  const p = prognose(bew, f({}), voll, jetzt);
  assert.deepStrictEqual([p.umfang, p.phasen[0].erreicht, p.phasen[0].offen, p.verworfen], [2, 1, 1, 1]);
  assert.deepStrictEqual(p.tage.map(x => x.umfang), [3, 2, 2]);
});
