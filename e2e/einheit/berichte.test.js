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

const { terminChance, anteilBis, werktageBis } = require('../../web/berichte.js');

test('Termine: Anteil der Ziehungen, Werktage, Chance je Spalte', () => {
  assert.strictEqual(anteilBis([1, 2, 2, 3, 5], 2), 0.6);
  assert.strictEqual(anteilBis([1, 2, 2, 3, 5], 0), 0);
  assert.strictEqual(anteilBis([1, 2, 2, 3, 5], 9), 1);
  assert.strictEqual(werktageBis(d(2026, 10, 16), d(2026, 10, 19)), 1, 'Fr → Mo: ein Werktag');
  assert.strictEqual(werktageBis(d(2026, 10, 21), d(2026, 10, 21)), 0);
  const ph = { offen: 2, erg7: [1, 2, 3, 4], erg5: [1, 1, 2, 2] };
  assert.deepStrictEqual(terminChance(ph, '2026-10-23', jetzt), { art: 'chance', p7: 0.5, p5: 1 }, 'Mi → Fr: 2 Kalendertage, 2 Werktage');
  assert.deepStrictEqual(terminChance(ph, '2026-10-20', jetzt), { art: 'vorbei' });
  assert.deepStrictEqual(terminChance({ ...ph, offen: 0 }, '2026-12-01', jetzt), { art: 'erreicht' });
  assert.deepStrictEqual(terminChance({ offen: 2 }, '2026-12-01', jetzt), { art: 'ungemessen' });
  assert.deepStrictEqual(terminChance(ph, '2026-10-21', jetzt), { art: 'chance', p7: 0, p5: 0 }, 'heute: noch nichts gezogen');
});

/* ── R00058 Phasen als Spalten ── */
const { phasenStufen, ersterDurchlauf } = require('../../web/berichte.js');

const STANDARD = [{ nr: 1, name: 'Entwicklung', eingebettet: '', gleich: '' }, { nr: 2, name: 'Entwicklertest', eingebettet: '', gleich: '' }, { nr: 3, name: 'Abnahme', eingebettet: '', gleich: '' }];
const PHASEN = { anwendung: 'kd', folge: STANDARD, spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', 'Abnahme Stefan': 'Abnahme', 'Abnahme Mia': 'Abnahme' } };
const PSPALTEN = ['Backlog', 'Entwicklung', 'Entwicklertest', 'Abnahme Stefan', 'Abnahme Mia', 'Erledigt'];
const zug = (n, ...st) => ({ nummer: n, labels: [], uebersprungen: [], wechsel: st.map(([z, s]) => ({ zeitpunkt: z, spalte: s })) });
const tagIso = ms => { const x = new Date(ms); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.`; };

test('Durchlaufen nach Phasen: spätere Phase oder Abschlussspalte, zwei Queues derselben Phase gleich weit', () => {
  const [e, t, a] = phasenStufen(PHASEN, PSPALTEN);
  const eins = zug(1, ['2026-10-01 09:00', 'Entwicklung'], ['2026-10-03 09:00', 'Abnahme Stefan']);
  const zwei = zug(2, ['2026-10-01 09:00', 'Entwicklung'], ['2026-10-04 09:00', 'Abnahme Mia'], ['2026-10-05 09:00', 'Entwicklertest']);
  assert.deepStrictEqual([eins, zwei].map(x => tagIso(ersterDurchlauf(x, t))), ['03.10.', '04.10.'], 'Entwicklertest durchlaufen beim Sprung in die Abnahme');
  assert.deepStrictEqual([e, t, a].map(s => s.phase), ['Entwicklung', 'Entwicklertest', 'Abnahme']);
  assert.ok(!t.durch(zwei, 'Entwicklertest'), '#2 ist ab 05.10. in Entwicklertest wieder offen');
  assert.ok(!a.durch(zwei, 'Abnahme Mia') && !a.durch(zwei, 'Abnahme Stefan'), '„Abnahme Mia“ rechts von „Abnahme Stefan“ zählt nicht als weiter');
  assert.ok(a.durch(zwei, 'Erledigt') && e.durch(zwei, 'Entwicklertest'));
  assert.ok(!e.durch(zwei, 'Backlog') && !e.durch(zwei, null), 'ungebunden und vom Board genommen ist in keiner Phase');
  assert.strictEqual(ersterDurchlauf(zug(3, ['2026-10-01 09:00', 'Backlog']), e), null);
});

test('Durchlaufen nach Phasen: entfällt, eingebettet in im-pair, gleich wie', () => {
  const [, t, a] = phasenStufen(PHASEN, PSPALTEN);
  const drei = { ...zug(3, ['2026-10-01 09:00', 'Entwicklung'], ['2026-10-02 09:00', 'Abnahme Stefan']), uebersprungen: ['Entwicklertest'] };
  assert.ok(t.entfaellt(drei) && !a.entfaellt(drei));
  const folge = [STANDARD[0], { ...STANDARD[1], eingebettet: 'im-pair' }, { ...STANDARD[2], gleich: 'Entwicklertest' }];
  const [e2, t2, a2] = phasenStufen({ ...PHASEN, folge, spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest' } }, ['Entwicklung', 'Entwicklertest', 'Erledigt']);
  const pair = { ...zug(4, ['2026-10-01 09:00', 'Entwicklung'], ['2026-10-02 09:00', 'Entwicklertest']), labels: ['im-pair'] };
  assert.strictEqual(tagIso(ersterDurchlauf(pair, t2)), '02.10.', 'im-pair: mit der Vorphase durchlaufen');
  assert.strictEqual(tagIso(ersterDurchlauf(pair, a2)), '02.10.', 'gleich wie Entwicklertest');
  const ohne = zug(5, ['2026-10-01 09:00', 'Entwicklung'], ['2026-10-02 09:00', 'Entwicklertest'], ['2026-10-06 09:00', 'Erledigt']);
  assert.deepStrictEqual([e2, t2, a2].map(s => tagIso(ersterDurchlauf(ohne, s))), ['02.10.', '06.10.', '06.10.']);
});

test('Prognose je Phase: dieselben Perzentile wie je Spalte, wenn jede Phase eine Spalte hat', () => {
  const sp = ['Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'];
  const phasen = { anwendung: 'kd', folge: STANDARD, spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
  const aufgaben = [];
  for (let n = 1; n <= 8; n++) {
    const st = [[`2026-10-0${1 + (n % 3)} 09:00`, 'Entwicklung']];
    if (n <= 6) st.push([`2026-10-${String(5 + n).padStart(2, '0')} 09:00`, 'Entwicklertest']);
    if (n <= 5) st.push([`2026-10-${String(8 + n).padStart(2, '0')} 10:00`, 'Abnahme']);
    if (n <= 4) st.push([`2026-10-${String(12 + n).padStart(2, '0')} 11:00`, 'Erledigt']);
    aufgaben.push(zug(n, ...st));
  }
  const bew = { spalten: sp, aufgaben };
  const je = prognose(bew, f({}), () => undefined, jetzt), nach = prognose(bew, f({}), () => undefined, jetzt, phasen);
  assert.deepStrictEqual(nach.phasen.map(x => x.phase), ['Entwicklung', 'Entwicklertest', 'Abnahme']);
  assert.deepStrictEqual(nach.phasen.map(x => x.titel), ['Entwicklung durchlaufen', 'Entwicklertest durchlaufen', 'Abnahme durchlaufen']);
  assert.deepStrictEqual(je.phasen.map(x => x.titel), ['Spalte „Entwicklertest“', 'Spalte „Abnahme“', 'Spalte „Erledigt“']);
  const kern = p => p.phasen.map(x => [x.erreicht, x.offen, x.nenner, x.laeufe, x.reihe7, x.zeilen]);
  assert.deepStrictEqual(kern(nach), kern(je));
  assert.ok(nach.phasen.every(x => x.zeilen), 'alle drei gemessen');
  assert.deepStrictEqual(nach.tage.map(x => x.offen.Abnahme), je.tage.map(x => x.offen.Erledigt));
});

test('Prognose je Phase: entfällt nimmt aus Nenner und Durchsatz, ohne Markierung zählt der Sprung', () => {
  const sp = ['Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'];
  const phasen = { anwendung: 'kd', folge: STANDARD, spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
  const drei = { ...zug(3, ['2026-10-12 09:00', 'Entwicklung'], ['2026-10-14 09:00', 'Abnahme']), uebersprungen: ['Entwicklertest'] };
  const vier = zug(4, ['2026-10-12 09:00', 'Entwicklung'], ['2026-10-15 09:00', 'Abnahme']);
  const fuenf = zug(5, ['2026-10-12 09:00', 'Entwicklung']);
  const p = prognose({ spalten: sp, aufgaben: [drei, vier, fuenf] }, f({}), () => undefined, jetzt, phasen);
  const t = p.phasen[1];
  assert.deepStrictEqual([t.nenner, t.erreicht, t.offen, t.laeufe], [2, 1, 1, 1], '#3 fehlt im Entwicklertest, #4 hat ihn am Tag des Sprungs durchlaufen');
  assert.deepStrictEqual([p.phasen[0].nenner, p.phasen[0].erreicht], [3, 2]);
  assert.strictEqual(p.umfang, 3);
  assert.deepStrictEqual(p.tage.map(x => x.offen.Entwicklertest).slice(-2), [1, 1]);
});

test('Durchlaufen nach Phasen: freie Spalte zwischen Phasen ist in keiner Phase, das erste Durchlaufen bleibt', () => {
  const [e] = phasenStufen({ anwendung: 'kd', folge: STANDARD, spaltenphasen: { Bau: 'Entwicklung', Test: 'Entwicklertest' } }, ['Bau', 'Blockiert', 'Test', 'Erledigt']);
  const x = zug(1, ['2026-10-01 09:00', 'Bau'], ['2026-10-02 09:00', 'Test'], ['2026-10-03 09:00', 'Blockiert']);
  assert.ok(!e.durch(x, 'Blockiert'), 'heute offen');
  assert.strictEqual(tagIso(ersterDurchlauf(x, e)), '02.10.', 'im Durchsatz zählt der Zug nach „Test“');
});

/* ── Zählen in Berichten je Aufgabe (R00060) ── */
const { zaehltImBericht, ausgenommen } = require('../../web/berichte.js');
const mitZaehlung = (nr, reporting) => ({ ...BEW, aufgaben: BEW.aufgaben.map(a => a.nummer === nr ? { ...a, reporting } : a) });

test('Zählen: Standard zählt, false nimmt aus, true und fehlender Schlüssel zählen', () => {
  assert.strictEqual(zaehltImBericht({}, 'burndown'), true);
  assert.strictEqual(zaehltImBericht({ reporting: {} }, 'forecast'), true);
  assert.strictEqual(zaehltImBericht({ reporting: { forecast: false } }, 'forecast'), false);
  assert.strictEqual(zaehltImBericht({ reporting: { forecast: false } }, 'burndown'), true, 'je Bericht ein eigener Schlüssel');
  assert.strictEqual(zaehltImBericht({ reporting: { burndown: true } }, 'burndown'), true);
});

test('Burndown ohne Aufgaben mit reporting.burndown false; der Filter wirkt zusätzlich; „ausgenommen“ zählt sie', () => {
  const kurz = t => t.map(x => [x.datum.slice(8), x.offen, x.umfang]);
  const bew = mitZaehlung(2, { burndown: false });
  assert.deepStrictEqual(kurz(burndown(bew, f({}), zu, jetzt)), [['18', 1, 1], ['19', 1, 2], ['20', 0, 1], ['21', 0, 1]]);
  assert.deepStrictEqual(kurz(burndown(mitZaehlung(2, { forecast: false }), f({}), zu, jetzt)), [['18', 2, 2], ['19', 2, 3], ['20', 1, 2], ['21', 0, 2]], 'forecast betrifft den Burndown nicht');
  assert.deepStrictEqual(kurz(burndown(bew, f({ ohneFarben: ['bug'] }), zu, jetzt)), [['18', 0, 0], ['19', 0, 0], ['20', 0, 0], ['21', 0, 0]], 'Filter zusätzlich');
  assert.strictEqual(ausgenommen(bew, 'burndown', f({}), zu, jetzt), 1);
  assert.strictEqual(ausgenommen(bew, 'burndown', f({ ohneFarben: ['ux'] }), zu, jetzt), 0, 'vom Filter schon ausgeschlossen');
  assert.strictEqual(ausgenommen(mitZaehlung(3, { burndown: false }), 'burndown', f({}), zu, jetzt), 0, 'nicht mehr auf dem Board');
});

test('Wie lange noch ohne Aufgaben mit reporting.forecast false — Umfang, Nenner, Durchsatz, je Spalte und je Phase', () => {
  const sp = ['Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'];
  const phasen = { anwendung: 'kd', folge: STANDARD, spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
  const eins = zug(1, ['2026-10-12 09:00', 'Entwicklung']);
  const zwei = { ...zug(2, ['2026-10-12 09:00', 'Entwicklung']), reporting: { forecast: false } };
  const bew = { spalten: sp, aufgaben: [eins, zwei] };
  for (const ph of [undefined, phasen]) {
    const p = prognose(bew, f({}), () => undefined, jetzt, ph);
    assert.strictEqual(p.umfang, 1, 'nur #1');
    assert.strictEqual(p.ausgenommen, 1);
    assert.deepStrictEqual(p.phasen.map(x => x.nenner), [1, 1, 1]);
    assert.deepStrictEqual(p.gezaehlt, [1]);
    assert.ok(p.tage.every(x => x.umfang === 1));
  }
  const weg = { ...zug(3, ['2026-10-12 09:00', 'Entwicklung'], ['2026-10-13 09:00', 'Entwicklertest']), reporting: { forecast: false } };
  const p = prognose({ spalten: sp, aufgaben: [eins, weg] }, f({}), () => undefined, jetzt, phasen);
  assert.strictEqual(p.phasen[0].laeufe, 0, 'auch nicht im Durchsatz');
  const zuX = n => ({ klasse: n === 2 ? 'doku' : null, zustaendige: [], labels: [] });
  assert.strictEqual(prognose(bew, f({ ohneFarben: ['doku'] }), zuX, jetzt).ausgenommen, 0, 'der Filter wirkt zusätzlich; schon ausgeschlossen zählt nicht doppelt');
  assert.strictEqual(prognose({ spalten: sp, aufgaben: [eins, { ...zwei, reporting: { burndown: false } }] }, f({}), () => undefined, jetzt).umfang, 2, 'burndown betrifft Wie lange noch nicht');
});

test('Wie lange noch: eine ausgenommene archivierte Aufgabe zählt weder als verworfen noch als ausgenommen doppelt', () => {
  const sp = ['A', 'Z'];
  const x = { ...zug(1, ['2026-10-12 09:00', 'A']), reporting: { forecast: false } };
  const p = prognose({ spalten: sp, aufgaben: [x, zug(2, ['2026-10-12 09:00', 'A'])] }, f({}), n => n === 1 ? { archiviert: '2026-10-13', zustaendige: [], labels: [] } : undefined, jetzt);
  assert.deepStrictEqual([p.umfang, p.verworfen, p.ausgenommen], [1, 0, 0]);
});

test('Zeigerposition → Tag (R00073)', () => {
  const { tagAnPosition, vollDatum } = require('../../web/berichte.js');
  const achse = { l: 40, breite: 100, t0: d(2026, 10, 1), t1: d(2026, 10, 11) }; // 10 px je Tag
  assert.strictEqual(tagAnPosition(40, achse), d(2026, 10, 1), 'linker Rand ist der erste Tag');
  assert.strictEqual(tagAnPosition(140, achse), d(2026, 10, 11), 'rechter Rand ist der letzte Tag');
  assert.strictEqual(tagAnPosition(64, achse), d(2026, 10, 3), '2,4 Tage rundet auf den 3.');
  assert.strictEqual(tagAnPosition(66, achse), d(2026, 10, 4), '2,6 Tage rundet auf den 4.');
  assert.strictEqual(tagAnPosition(39, achse), null, 'links der Fläche kein Tag');
  assert.strictEqual(tagAnPosition(141, achse), null, 'rechts der Fläche kein Tag');
  assert.strictEqual(tagAnPosition(90, { ...achse, t1: achse.t0 }), d(2026, 10, 1), 'ein einziger Tag gilt auf der ganzen Fläche');
  const jw = { l: 0, breite: 10, t0: d(2026, 12, 27), t1: d(2027, 1, 6) };
  assert.strictEqual(tagAnPosition(6, jw), d(2027, 1, 2), 'über den Jahreswechsel');
  const stetig = { l: 0, breite: 84, t0: new Date(2026, 9, 2, 9).getTime(), t1: new Date(2026, 9, 5, 21).getTime(), stetig: true }; // 1 px je Stunde
  assert.strictEqual(tagAnPosition(33, stetig), d(2026, 10, 3), 'stetig: 03.10. 18:00 bleibt der 3.');
  assert.strictEqual(tagAnPosition(33, { ...stetig, stetig: false }), d(2026, 10, 4), 'Tagesachse rundet auf den 4.');
  assert.strictEqual(vollDatum(d(2027, 1, 2)), '02.01.2027');
});

/* ── Projekt-Fever-Chart (R00078) ── */
const { ersterTag, fieberSchluessel, fieberTag, fehlendeTage, dauerIn, pufferVorschlag, fieberZone, fieberPlan, fieberPunkte, PERZENTILE: PZ } = require('../../web/berichte.js');
const fieberBew = () => {
  const w = (n, ...st) => ({ nummer: n, wechsel: st.map(([z, s]) => ({ zeitpunkt: z, spalte: s })) });
  return { spalten: ['A', 'B', 'Z'], aufgaben: [
    w(1, ['2026-10-12 09:00', 'A'], ['2026-10-13 09:00', 'Z']),
    w(2, ['2026-10-12 09:00', 'A'], ['2026-10-14 09:00', 'B'], ['2026-10-15 09:00', 'Z']),
    w(3, ['2026-10-12 09:00', 'A'], ['2026-10-16 09:00', 'Z']),
    w(4, ['2026-10-12 09:00', 'A'], ['2026-10-19 09:00', 'Z']),
    w(5, ['2026-10-12 09:00', 'A'], ['2026-10-20 09:00', 'B']),
    w(6, ['2026-10-12 09:00', 'A']),
    w(7, ['2026-10-12 09:00', 'A'], ['2026-10-13 09:00', null]),
  ] };
};
const ohne = () => undefined;

test('Fever Chart: Projektstart ist Messbasis und Beginn des Verlaufs in der Prognose', () => {
  const bew = fieberBew();
  assert.strictEqual(ersterTag(bew), '2026-10-12');
  const mit = prognose(bew, f({}), ohne, jetzt, undefined, { start: '2026-10-16' });
  assert.deepStrictEqual([mit.phasen[1].laeufe, mit.phasen[1].zeilen], [2, null], 'nur #3 und #4 ab dem 16.10. — unter drei Läufen');
  assert.strictEqual(mit.tage[0].t, d(2026, 10, 16));
  assert.strictEqual(mit.tage.length, 6);
  const zeitraum = prognose(bew, f({ zeitraum: 'eigen', von: '2026-10-12', bis: '2026-10-21' }), ohne, jetzt, undefined, { start: '2026-10-16' });
  assert.strictEqual(zeitraum.phasen[1].laeufe, 4, 'ein gewählter Zeitraum überstimmt den Start');
  const letzter = prognose(bew, f({}), ohne, jetzt, undefined, { nurLetzter: true });
  assert.deepStrictEqual([letzter.phasen.length, letzter.phasen[0].spalte, letzter.tage], [1, 'Z', []]);
});

test('Fever Chart: ein Tag aus der Sicht seines Tagesendes', () => {
  const bew = fieberBew(), voll = prognose(bew, f({}), ohne, jetzt).phasen[1];
  const heute = fieberTag(bew, f({}), ohne, '2026-10-21', undefined, null);
  const iso = ms => fieberTag.length && new Date(ms).toLocaleDateString('sv-SE');
  assert.deepStrictEqual(heute, { datum: '2026-10-21', erledigt: 4, umfang: 6, ende7: voll.zeilen.map(z => iso(z.datum7)), ende5: voll.zeilen.map(z => iso(z.datum5)) });
  assert.deepStrictEqual(fieberTag(bew, f({}), ohne, '2026-10-14', undefined, null), { datum: '2026-10-14', erledigt: 1, umfang: 6, ende7: [null, null, null, null], ende5: [null, null, null, null] }, 'ein Lauf: keine Aussage');
  assert.deepStrictEqual(fieberTag(bew, f({}), ohne, '2026-10-11', undefined, null), { datum: '2026-10-11', erledigt: 0, umfang: 0, ende7: [null, null, null, null], ende5: [null, null, null, null] }, 'vor der ersten Aufgabe ein leerer Tag');
  const fertig = { spalten: ['A', 'Z'], aufgaben: [{ nummer: 1, wechsel: [{ zeitpunkt: '2026-10-12 09:00', spalte: 'Z' }] }] };
  assert.deepStrictEqual(fieberTag(fertig, f({}), ohne, '2026-10-13', undefined, null).ende7, Array(4).fill('2026-10-13'), 'nichts offen: Ende ist der Tag');
  assert.deepStrictEqual(fehlendeTage('2026-10-18', ['2026-10-19'], jetzt), ['2026-10-18', '2026-10-20'], 'bis gestern, ohne Vorhandenes');
});

test('Fever Chart: Schlüssel aus Start und Filter', () => {
  assert.strictEqual(fieberSchluessel('2026-10-01', f({ labels: ['b', 'a'] })), fieberSchluessel('2026-10-01', f({ labels: ['a', 'b'] })));
  assert.notStrictEqual(fieberSchluessel('2026-10-01', f({})), fieberSchluessel('2026-10-02', f({})));
  assert.strictEqual(fieberSchluessel('2026-10-01', f({ von: '2026-01-01' })), fieberSchluessel('2026-10-01', f({})), 'von/bis zählen nur im eigenen Zeitraum');
});

test('Fever Chart: Dauer, Plan, Puffervorschlag, Zone', () => {
  assert.strictEqual(dauerIn(7, '2026-01-01', '2026-03-02'), 60);
  assert.strictEqual(dauerIn(5, '2026-10-05', '2026-10-30'), 19, 'Arbeitstage nach Mo 05.10. bis Fr 30.10.');
  assert.strictEqual(dauerIn(5, '2026-10-09', '2026-10-05'), -4);
  assert.deepStrictEqual(fieberPlan({ start: '2026-10-05', ziel: '2026-10-30', puffer: 6, woche: 5 }), { gesamt: 19, arbeit: 13, puffer: 6, planende: '2026-10-22' });
  assert.match(fieberPlan({ start: '2026-10-05', ziel: '2026-10-30', puffer: 19, woche: 5 }).fehler, /nicht kürzer/);
  assert.match(fieberPlan({ start: '2026-10-30', ziel: '2026-10-05', puffer: 1, woche: 7 }).fehler, /nicht nach dem Projektstart/);
  assert.strictEqual(fieberPlan({ start: '2026-10-05', ziel: null, puffer: 6, woche: 5 }), null);
  assert.deepStrictEqual([pufferVorschlag(60), pufferVorschlag(10), pufferVorschlag(1)], [20, 3, 1]);
  const G = [10, 70], R = [30, 100];
  assert.deepStrictEqual([fieberZone(0, 9.9, G, R), fieberZone(0, 10, G, R), fieberZone(0, 30, G, R), fieberZone(50, 39.9, G, R), fieberZone(50, 40, G, R), fieberZone(50, 65, G, R), fieberZone(100, 100, G, R), fieberZone(100, 100.1, G, R), fieberZone(0, -20, G, R)],
    ['gruen', 'gelb', 'rot', 'gruen', 'gelb', 'rot', 'rot', 'schwarz', 'gruen'], 'genau auf der Grenze gilt die höhere Zone');
  assert.strictEqual(fieberZone(50, 25, [33, 33], [66, 66]), 'gruen', 'andere Grenzen, andere Zone');
});

test('Fever Chart: Beispiel der CCPM-Beschreibung (Kette 40, Puffer 20) als Bahn', () => {
  const start = '2026-01-01', am = n => new Date(2026, 0, 1 + n).toLocaleDateString('sv-SE');
  const tag = (n, erledigt, umfang, ende) => ({ datum: am(n), erledigt, umfang, ende7: Array(4).fill(am(ende)), ende5: Array(4).fill(null) });
  const tage = [tag(14, 1, 4, 44), tag(20, 1, 4, 50), tag(26, 5, 9, 46), tag(41, 14, 15, 44)];
  const e = { start, ziel: am(60), puffer: 20, woche: 7, perzentil: 95, gelb: [10, 70], rot: [30, 100] };
  const r = fieberPunkte(tage, e).map(x => [Math.round(x.p * 10) / 10, Math.round(x.b * 10) / 10, x.zone]);
  assert.deepStrictEqual(r, [[25, 20, 'gruen'], [25, 50, 'rot'], [55.6, 30, 'gruen'], [93.3, 20, 'gruen']]);
  assert.strictEqual(fieberPunkte(tage, { ...e, puffer: 10 })[0].b, -60, 'kleinerer Puffer: Arbeitsbereich 50, Ende 44 — derselbe Cache, anderer Verbrauch');
  assert.strictEqual(fieberPunkte(tage, { ...e, perzentil: 50 })[0].b, 20);
  assert.deepStrictEqual(PZ, [50, 70, 85, 95]);
});

test('Fever Chart: Bahn ohne Wochenende, ohne Aussage, endet bei 100 %', () => {
  const t = (datum, erledigt, umfang, ende) => ({ datum, erledigt, umfang, ende7: Array(4).fill(ende), ende5: Array(4).fill(ende) });
  const tage = [t('2026-10-09', 1, 4, null), t('2026-10-12', 2, 4, '2026-10-20'), t('2026-10-10', 2, 4, '2026-10-20'), t('2026-10-13', 4, 4, '2026-10-13'), t('2026-10-14', 4, 4, '2026-10-14'), t('2026-10-15', 4, 5, '2026-10-22')];
  const e = { start: '2026-10-05', ziel: '2026-10-30', puffer: 6, woche: 5, perzentil: 95, gelb: [10, 70], rot: [30, 100] };
  assert.deepStrictEqual(fieberPunkte(tage, e).map(x => x.datum), ['2026-10-12', '2026-10-13', '2026-10-15'], 'ohne Aussage, Samstag und zweiten 100-%-Tag; neue Aufgabe setzt fort');
  assert.deepStrictEqual(fieberPunkte(tage, { ...e, woche: 7 }).map(x => x.datum), ['2026-10-10', '2026-10-12', '2026-10-13', '2026-10-15']);
  assert.deepStrictEqual(fieberPunkte(tage, { ...e, puffer: null }), []);
});

test('Fever Chart: Zielspalte — Prognose eines benannten Blocks, Tag und Schlüssel (R00079)', () => {
  const { fieberBloecke } = require('../../web/berichte.js');
  const bew = fieberBew();
  assert.deepStrictEqual(fieberBloecke(bew, f({}), undefined).map(x => x.schluessel), ['B', 'Z']);
  assert.deepStrictEqual(fieberBloecke(bew, f({ ohneSpalten: ['B'] }), undefined).map(x => x.schluessel), ['Z']);
  const b = prognose(bew, f({}), ohne, jetzt, undefined, { block: 'B' });
  assert.deepStrictEqual(b.phasen.map(x => [x.spalte, x.erreicht, x.nenner]), [['B', 5, 6]]);
  assert.deepStrictEqual(prognose(bew, f({}), ohne, jetzt, undefined, { block: 'weg' }).phasen.map(x => x.spalte), ['Z'], 'unbekannt: der letzte');
  const tagB = fieberTag(bew, f({}), ohne, '2026-10-21', undefined, null, 'B');
  assert.deepStrictEqual([tagB.erledigt, tagB.umfang], [5, 6]);
  assert.ok(tagB.ende7.every(Boolean), 'B ist gemessen');
  assert.strictEqual(fieberSchluessel('2026-10-01', f({})), fieberSchluessel('2026-10-01', f({}), null), 'ohne Zielspalte der Schlüssel aus R00078');
  assert.notStrictEqual(fieberSchluessel('2026-10-01', f({}), 'B'), fieberSchluessel('2026-10-01', f({})));
});
