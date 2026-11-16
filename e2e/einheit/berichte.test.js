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

const { burndown, spalteAm, eintrittAm, alterText } = require('../../web/berichte.js');

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

// R00126: Eintritt in die heutige Spalte — Schwester von spalteAm, liefert statt des Namens den Zeitpunkt (ADR-0019 N5)
test('R00126 Eintritt: der letzte Wechsel in die heutige Spalte, nicht der erste', () => {
  const w = [{ zeitpunkt: '2026-10-02 09:00', spalte: 'x' }, { zeitpunkt: '2026-10-03 09:00', spalte: 'y' }, { zeitpunkt: '2026-10-04 09:00', spalte: 'x' }];
  assert.strictEqual(eintrittAm(w, new Date(2026, 9, 11).getTime()), '2026-10-04 09:00', 'der letzte Eintritt, nicht der erste (02.10.)');
  const b = BEW.aufgaben[1].wechsel;
  assert.strictEqual(eintrittAm(b, new Date(2026, 9, 21, 12, 0).getTime()), '2026-10-21 11:00');
});

test('R00126 Eintritt: ein Wechsel in der Zukunft zählt nicht', () => {
  const w = [{ zeitpunkt: '2026-10-18 09:00', spalte: 'A' }, { zeitpunkt: '2026-10-20 10:00', spalte: 'B' }];
  assert.strictEqual(eintrittAm(w, new Date(2026, 9, 19).getTime()), '2026-10-18 09:00');
  assert.strictEqual(eintrittAm(w, new Date(2026, 9, 17).getTime()), null, 'vor dem ersten Wechsel kein Eintritt');
});

test('R00126 Eintritt: ohne Wechsel oder vom Board genommen kein Eintritt (null)', () => {
  assert.strictEqual(eintrittAm([], jetzt), null);
  assert.strictEqual(spalteAm(BEW.aufgaben[2].wechsel, jetzt), null);
  assert.strictEqual(eintrittAm(BEW.aufgaben[2].wechsel, jetzt), null, 'der letzte Wechsel nimmt die Aufgabe vom Board');
});

test('R00126 Alter: Kurzform und Vollform aus einer Dauer (seitText)', () => {
  const sechs = [{ zeitpunkt: '2026-10-05 09:00', spalte: 'In Arbeit' }];
  assert.deepStrictEqual(alterText(sechs, 'In Arbeit', new Date(2026, 9, 11, 9, 0).getTime()), { kurz: 'seit 6 Tagen', voll: 'seit 6 Tagen in In Arbeit' });
  const heute = [{ zeitpunkt: '2026-10-11 04:00', spalte: 'In Arbeit' }];
  assert.strictEqual(alterText(heute, 'In Arbeit', new Date(2026, 9, 11, 9, 0).getTime()).kurz, 'seit 5 Stunden');
  assert.strictEqual(alterText(heute, 'In Arbeit', new Date(2026, 9, 11, 4, 0).getTime()).kurz, 'seit 0 Stunden');
});

test('R00126 Alter: ohne Eintritt kein Wert (null)', () => {
  assert.strictEqual(alterText([], 'Eingang', jetzt), null);
  assert.strictEqual(alterText(BEW.aufgaben[2].wechsel, 'A', jetzt), null);
  assert.strictEqual(alterText([{ zeitpunkt: '2026-10-18 09:00', spalte: 'A' }], null, jetzt), null, 'ohne heutige Spalte kein Wert');
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
  assert.deepStrictEqual(z.reihe7, [0, 1, 0, 1, 1, 0, 0, 1, 0, 0], 'seit R00083 ab der ersten Aufgabe 12.10. bis heute 21.10., Nulltage eingeschlossen');
  assert.deepStrictEqual(z.reihe5, [0, 1, 0, 1, 1, 1, 0, 0], 'Sa und So fallen weg');
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
  const kurz = prognose(bew, f({ messbasisTage: 3 }), zu7, jetzt);
  assert.deepStrictEqual([kurz.phasen[1].laeufe, kurz.phasen[1].zeilen, kurz.phasen[1].reihe7], [1, null, [1, 0, 0]], 'letzte drei Tage 19.–21.10.: unter drei Läufen ungemessen');
  assert.strictEqual(kurz.tage.length, 10, 'der Verlauf zeigt trotzdem alles ab der ersten Aufgabe');
});

function werktag5(ms) { const w = new Date(ms).getDay(); return w !== 0 && w !== 6; }

test('Prognose: Spalte rechts nie früher als die links davon', () => {
  const w = (n, ...st) => ({ nummer: n, wechsel: st.map(([z, s]) => ({ zeitpunkt: z, spalte: s })) });
  // B früh dreimal erreicht, danach nichts mehr; Z erreicht die drei in den letzten Tagen — gleicher Durchsatz in der
  // Messbasis (R00083), aber anders verteilt: ab P70 läge Z vor B
  const bew = { spalten: ['A', 'B', 'Z'], aufgaben: [
    w(1, ['2026-09-22 09:00', 'B'], ['2026-10-19 09:00', 'Z']),
    w(2, ['2026-09-22 09:00', 'B'], ['2026-10-20 09:00', 'Z']),
    w(3, ['2026-09-22 09:00', 'B'], ['2026-10-21 09:00', 'Z']),
    w(4, ['2026-09-22 09:00', 'A']), w(5, ['2026-09-22 09:00', 'A']), w(6, ['2026-09-22 09:00', 'A']),
  ] };
  const p = prognose(bew, f({}), () => undefined, jetzt);
  const [b, z] = p.phasen;
  assert.ok(b.zeilen[1].datum7 > z.zeilen[1].datum7, 'B bei P70 später');
  assert.ok(z.zeilen.every((x, k) => x.untergrenze7 === Math.max(b.zeilen[k].datum7, b.zeilen[k].untergrenze7 || 0) || x.datum7 >= b.zeilen[k].datum7));
  assert.strictEqual(z.zeilen[1].untergrenze7, b.zeilen[1].datum7);
  assert.strictEqual(z.zeilen[0].untergrenze7, undefined, 'bei P50 ist Z ohnehin später');
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
  assert.strictEqual(zeitraum.phasen[1].laeufe, 2, 'seit R00083 wirkt der Kalenderzeitraum nicht auf die Prognose');
  const kurz = prognose(bew, f({ messbasisTage: 2 }), ohne, jetzt);
  assert.deepStrictEqual([kurz.phasen[1].laeufe, kurz.phasen[1].zeilen], [0, null], 'letzte zwei Tage 20. und 21.10.: kein Lauf');
  const lang = prognose(bew, f({ messbasisTage: 365 }), ohne, jetzt);
  assert.strictEqual(lang.phasen[1].reihe7.length, 10, 'nie vor der ersten Aufgabe (12.10.)');
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

test('Fever Chart: Auflösung dünnt vom letzten Punkt rückwärts aus (R00080)', () => {
  const { fieberAusduennen } = require('../../web/berichte.js');
  const p = d => ({ datum: d });
  const tage = ['2026-09-01', '2026-09-02', '2026-09-08', '2026-09-09', '2026-09-15', '2026-09-16', '2026-09-23'].map(p);
  assert.deepStrictEqual(fieberAusduennen(tage, 1), tage, 'Tag lässt alles');
  assert.deepStrictEqual(fieberAusduennen(tage, 7).map(x => x.datum), ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23']);
  assert.deepStrictEqual(fieberAusduennen(tage.slice(0, -1).concat(p('2026-09-24')), 7).map(x => x.datum), ['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-24'], 'Stichtag 17.09. ohne Punkt: der davor');
  assert.deepStrictEqual(fieberAusduennen(tage, 30).map(x => x.datum), ['2026-09-23'], 'ein Monat zurück liegt vor dem ersten Punkt');
  assert.deepStrictEqual(fieberAusduennen([], 7), []);
});

test('Rechnen ab (R00081): Burndown und Durchlaufzeit beginnen am Projektstart, ein Zeitraum überstimmt', () => {
  const kurz = t => t.map(x => [x.datum.slice(8), x.offen, x.umfang]);
  assert.deepStrictEqual(kurz(burndown(BEW, f({}), zu, jetzt, '2026-10-20')), [['20', 1, 2], ['21', 0, 2]]);
  assert.deepStrictEqual(kurz(burndown(BEW, f({ zeitraum: 'eigen', von: '2026-10-19', bis: '2026-10-19' }), zu, jetzt, '2026-10-20')), [['19', 2, 3]]);
  assert.deepStrictEqual(durchlaufzeiten(BEW, f({}), zu, jetzt, 'A', 'Z', '2026-10-20').liste.map(x => x.nummer), [2], '#1 kam am 19.10. an — vor dem Start');
  assert.deepStrictEqual(durchlaufzeiten(BEW, f({ zeitraum: '30' }), zu, jetzt, 'A', 'Z', '2026-10-20').liste.map(x => x.nummer), [2, 1]);
});

test('Fever Chart: Abstand zum Planende je Punkt (R00082)', () => {
  const am = n => new Date(2026, 0, 1 + n).toLocaleDateString('sv-SE');
  const tage = [{ datum: am(14), erledigt: 1, umfang: 4, ende7: Array(4).fill(am(44)), ende5: Array(4).fill(null) }];
  const e = { start: am(0), ziel: am(60), puffer: 20, woche: 7, perzentil: 95, gelb: [10, 70], rot: [30, 100] };
  assert.strictEqual(fieberPunkte(tage, e)[0].abstand, 4, 'Planende Tag 40, Ende Tag 44');
  assert.deepStrictEqual([fieberPunkte(tage, { ...e, puffer: 10 })[0].abstand, fieberPunkte(tage, { ...e, puffer: 10 })[0].b], [-6, -60], 'Planende Tag 50: sechs Tage davor');
});

test('Prognose wird gemerkt, solange Bewegungen, Aufgaben, Filter, Optionen und Tag gleich sind', () => {
  const bew = fieberBew();
  const a = prognose(bew, f({}), ohne, jetzt), b = prognose(bew, f({}), ohne, jetzt + 3600e3);
  assert.strictEqual(a, b, 'gleicher Tag: dasselbe Ergebnis, nicht neu gerechnet');
  assert.notStrictEqual(prognose(bew, f({ messbasisTage: 30 }), ohne, jetzt), a, 'anderer Filter');
  assert.notStrictEqual(prognose(bew, f({}), ohne, jetzt + 864e5), a, 'anderer Tag');
  assert.strictEqual(prognose(fieberBew(), f({}), ohne, jetzt), a, 'neu geladen, gleicher Inhalt: gemerkt');
  const mehr = fieberBew(); mehr.aufgaben.push({ nummer: 9, wechsel: [{ zeitpunkt: '2026-10-20 09:00', spalte: 'A' }] });
  assert.notStrictEqual(prognose(mehr, f({}), ohne, jetzt), a, 'neue Bewegungen');
  assert.notStrictEqual(prognose(bew, f({}), n => n === 6 ? { klasse: 'doku', zustaendige: [], labels: [] } : undefined, jetzt), a, 'andere Klasse an einer Aufgabe');
  assert.notStrictEqual(prognose(bew, f({}), ohne, jetzt, undefined, { block: 'B' }), a, 'andere Optionen');
});

test('Diagramm von „Wie lange noch“: die drei rechten Blöcke mit Prognose, ungemessene rechts davon genannt', () => {
  const { diagrammBloecke } = require('../../web/berichte.js');
  const b = (schluessel, gemessen, offen = 5) => ({ schluessel, zeilen: gemessen ? [] : null, offen });
  const joinpuya = [b('Entwicklung', true), b('Code-Review', true), b('Entwicklertest', true), b('Security-Review', false), b('Abnahme', false), b('Produktiv', false)];
  const r = diagrammBloecke(joinpuya);
  assert.deepStrictEqual(r.gezeigt.map(x => x.schluessel), ['Entwicklung', 'Code-Review', 'Entwicklertest']);
  assert.deepStrictEqual(r.ohnePrognose.map(x => x.schluessel), ['Security-Review', 'Abnahme', 'Produktiv']);
  const alle = [b('A', true), b('B', true), b('C', true), b('D', true)];
  assert.deepStrictEqual([diagrammBloecke(alle).gezeigt.map(x => x.schluessel), diagrammBloecke(alle).ohnePrognose], [['B', 'C', 'D'], []], 'alle gemessen: die drei rechten wie bisher');
  const keine = [b('A', false), b('B', false), b('C', false), b('D', false, 0)];
  assert.deepStrictEqual([diagrammBloecke(keine).gezeigt.map(x => x.schluessel), diagrammBloecke(keine).ohnePrognose], [['B', 'C', 'D'], []], 'ohne jede Prognose die drei rechten');
  assert.deepStrictEqual(diagrammBloecke([b('A', true), b('B', false, 0)]).ohnePrognose, [], 'nichts offen ist keine fehlende Prognose');
});

test('Zurücksetzen je Leiste (R00105 US-19, PO Z. 106/116): Klassen, Spalten, Zuständige, Labels; Zeitraum nur, wo die Leiste ihn zeigt; Messbasis und Rechnen ab nie', () => {
  const { filterZuruecksetzen, BERICHTSLEISTEN } = require('../../web/berichte.js');
  const gesetzt = { zeitraum: 'eigen', von: '2026-10-01', bis: '2026-10-31', ohneFarben: ['bug'], ohneSpalten: ['Fertig'], personen: ['st'], labels: ['repo:x'], messbasisTage: 30 };
  const ohneGruppen = { ...gesetzt, ohneFarben: [], ohneSpalten: [], personen: [], labels: [] };
  const ohneZeitraum = { ...ohneGruppen, zeitraum: 'alles', von: '', bis: '' };
  const erwartet = {
    stundenzettel: ohneGruppen,
    zeiten: ohneZeitraum,
    burndown: ohneZeitraum,
    fluss: ohneGruppen,
    durchsatz: ohneGruppen,
    durchlaufzeit: ohneZeitraum,
    wieLangeNoch: ohneGruppen,
    fieber: ohneGruppen,
    kosten: ohneGruppen,
    bestand: ohneGruppen,
  };
  assert.deepStrictEqual(Object.keys(BERICHTSLEISTEN).sort(), Object.keys(erwartet).sort(), 'jede Leiste genau einmal');
  for (const [leiste, nachher] of Object.entries(erwartet)) {
    assert.deepStrictEqual(filterZuruecksetzen(gesetzt, BERICHTSLEISTEN[leiste]), nachher, leiste);
  }
  assert.strictEqual(filterZuruecksetzen(gesetzt, BERICHTSLEISTEN.wieLangeNoch).messbasisTage, 30, 'Messbasis bleibt, auch wo die Leiste sie zeigt');
  assert.deepStrictEqual(gesetzt.ohneSpalten, ['Fertig'], 'der gespeicherte Filter bleibt unverändert');
});

test('Hinweis an „Zurücksetzen“ je Leiste (R00105 US-25, PO Z. 118): nennt nur, was die Leiste zeigt', () => {
  const { zuruecksetzenHinweis, BERICHTSLEISTEN } = require('../../web/berichte.js');
  const nur = 'die gezählten Filter aufheben';
  const erwartet = {
    stundenzettel: nur,
    zeiten: nur,
    kosten: nur,
    bestand: nur,
    burndown: `${nur} — „Rechnen ab“ bleibt`,
    fluss: `${nur} — Zeitraum und „Rechnen ab“ bleiben`,
    durchsatz: `${nur} — Zeitraum und „Rechnen ab“ bleiben`,
    durchlaufzeit: `${nur} — „Rechnen ab“ bleibt`,
    wieLangeNoch: `${nur} — Messbasis und „Rechnen ab“ bleiben`,
    fieber: `${nur} — Messbasis und „Rechnen ab“ bleiben`,
  };
  assert.deepStrictEqual(Object.keys(BERICHTSLEISTEN).sort(), Object.keys(erwartet).sort(), 'jede Leiste genau einmal');
  for (const [leiste, hinweis] of Object.entries(erwartet)) assert.strictEqual(zuruecksetzenHinweis(BERICHTSLEISTEN[leiste]), hinweis, leiste);
  assert.doesNotMatch(zuruecksetzenHinweis(BERICHTSLEISTEN.kosten), /Messbasis|Rechnen ab/, 'Gegenbeispiel Kosten');
});

/* ── Kumulativer Fluss (R00121) ── */
const { fluss, flussRand, flussName } = require('../../web/berichte.js');

/** Grundbestand der AK (R00121): drei Spalten, vier Aufgaben, #2 verlässt am 05.11. das Board. */
const FLUSS = {
  spalten: ['Eingang', 'In Arbeit', 'Fertig'],
  jetzt: '2026-11-05 20:00',
  aufgaben: [
    { nummer: 1, wechsel: [{ zeitpunkt: '2026-11-01 09:00', spalte: 'Eingang' }, { zeitpunkt: '2026-11-02 09:00', spalte: 'In Arbeit' }, { zeitpunkt: '2026-11-03 09:00', spalte: 'Fertig' }] },
    { nummer: 2, wechsel: [{ zeitpunkt: '2026-11-02 09:00', spalte: 'Eingang' }, { zeitpunkt: '2026-11-03 09:00', spalte: 'In Arbeit' }, { zeitpunkt: '2026-11-04 09:00', spalte: 'Fertig' }, { zeitpunkt: '2026-11-05 09:00', spalte: null }] },
    { nummer: 3, wechsel: [{ zeitpunkt: '2026-11-03 09:00', spalte: 'Eingang' }, { zeitpunkt: '2026-11-04 09:00', spalte: 'In Arbeit' }, { zeitpunkt: '2026-11-05 09:00', spalte: 'Fertig' }] },
    { nummer: 4, wechsel: [{ zeitpunkt: '2026-11-04 09:00', spalte: 'Eingang' }, { zeitpunkt: '2026-11-05 09:00', spalte: 'In Arbeit' }] },
  ],
};
const flussJetzt = new Date(2026, 10, 5, 20, 0).getTime();
const ohneFilterung = () => ({});

test('Fluss je Tag und Spalte: Bänder, gesamt, offen (R00121 B0554)', () => {
  const d = fluss(FLUSS, f({}), ohneFilterung, flussJetzt);
  assert.deepStrictEqual(d.spalten, ['Eingang', 'In Arbeit', 'Fertig']);
  assert.deepStrictEqual(d.tage.map(x => [x.datum.slice(8), x.jeSpalte.Eingang, x.jeSpalte['In Arbeit'], x.jeSpalte.Fertig, x.gesamt, x.offen]), [
    ['01', 1, 0, 0, 1, 1], ['02', 1, 1, 0, 2, 2], ['03', 1, 1, 1, 3, 2], ['04', 1, 1, 2, 4, 2], ['05', 0, 1, 2, 3, 1],
  ], 'Tagesstände; am 05.11. fällt gesamt auf 3, weil #2 das Board verließ');
  assert.deepStrictEqual(fluss({ spalten: [], aufgaben: [] }, f({}), ohneFilterung, flussJetzt), { spalten: [], tage: [] }, 'kein Stand');
});

test('Fluss: kumulierte Ränder „angekommen“ und „fertig“ (R00121 B0555)', () => {
  const d = fluss(FLUSS, f({}), ohneFilterung, flussJetzt);
  assert.deepStrictEqual(d.tage.map(x => [x.datum.slice(8), x.angekommen, x.fertig]), [
    ['01', 1, 0], ['02', 2, 0], ['03', 3, 1], ['04', 4, 2], ['05', 4, 3],
  ], 'angekommen steigt monoton; fertig zählt auch #2, das am 05.11. das Board verließ');
  assert.strictEqual(d.tage[4].gesamt, 3, 'das Verlassen senkt nur den Stapel (gesamt), nicht „angekommen“/„fertig“');
});

test('Fluss: Ränder, Tooltip und Name (R00121 B0558)', () => {
  const d = fluss(FLUSS, f({}), ohneFilterung, flussJetzt);
  assert.deepStrictEqual(flussRand(d.tage, 'angekommen'), [1, 2, 3, 4, 4]);
  assert.deepStrictEqual(flussRand(d.tage, 'Fertig'), [0, 0, 1, 2, 2], 'ein Band wird über seinen Spaltennamen gelesen');
  assert.strictEqual(flussName(d.tage[3].datum, d.tage[3], d.spalten), '04.11.2026 · Eingang 1 · In Arbeit 1 · Fertig 2 · offen 2 · gesamt 4 · angekommen 4 · fertig 2');
});

const ZU_FLUSS = {
  1: { klasse: 'bug', zustaendige: ['st'], labels: ['ui'] },
  2: { klasse: 'ux', zustaendige: ['mi'], labels: [] },
  3: { klasse: 'bug', zustaendige: [], labels: ['daten'] },
  4: { klasse: 'ux', zustaendige: ['st'], labels: [] },
};
const zuFluss = nr => ZU_FLUSS[nr];

test('Fluss: ausgeschlossene Spalten, Zeitraum, Klassen und „Rechnen ab“ (R00121 B0560)', () => {
  const lauf = x => fluss(FLUSS, f(x), ohneFilterung, flussJetzt);
  const band = d => d.tage[2].jeSpalte; // 03.11.
  const ohneArbeit = lauf({ ohneSpalten: ['In Arbeit'] });
  assert.deepStrictEqual([band(ohneArbeit).Eingang, band(ohneArbeit)['In Arbeit'], band(ohneArbeit).Fertig, ohneArbeit.tage[2].gesamt], [1, 0, 1, 2], '03.11. ohne „In Arbeit“: Eingang 1 · Fertig 1 (gesamt 2)');
  assert.strictEqual(lauf({ ohneSpalten: ['In Arbeit'] }).tage[4].gesamt, 2, '05.11. ebenfalls 2');
  const zwei = lauf({ zeitraum: 'eigen', von: '2026-11-03', bis: '2026-11-04' });
  assert.deepStrictEqual(zwei.tage.map(x => x.datum.slice(8)), ['03', '04'], 'genau zwei Stützpunkte');
  assert.deepStrictEqual(zwei.tage.map(x => x.angekommen), [3, 4], 'die vor dem Zeitraum angekommenen #1/#2 zählen in „angekommen“ mit');
  assert.deepStrictEqual(fluss(FLUSS, f({}), ohneFilterung, flussJetzt, '2026-11-03').tage.map(x => x.datum.slice(8)), ['03', '04', '05'], '„Rechnen ab“ schneidet den Anfang ab');
  assert.deepStrictEqual(lauf({ messbasisTage: 90 }).tage, lauf({ messbasisTage: 30 }).tage, 'die Messbasis wirkt nicht');
  assert.strictEqual(fluss(FLUSS, f({ ohneFarben: ['ux'] }), zuFluss, flussJetzt).tage[2].gesamt, 2, 'ausgeschlossene Klasse „ux“ nimmt #2 und #4 heraus');
  assert.strictEqual(fluss(FLUSS, f({ personen: ['st'] }), zuFluss, flussJetzt).tage[2].gesamt, 1, 'nur Aufgaben der Person zählen');
});

test('Fluss: reporting.burndown false nimmt die Aufgabe aus dem Bericht (R00121 B0560)', () => {
  const ohne3 = { ...FLUSS, aufgaben: FLUSS.aufgaben.map(a => a.nummer === 3 ? { ...a, reporting: { burndown: false } } : a) };
  const d = fluss(ohne3, f({}), ohneFilterung, flussJetzt);
  assert.deepStrictEqual([d.tage[2].jeSpalte.Eingang, d.tage[2].jeSpalte['In Arbeit'], d.tage[2].jeSpalte.Fertig, d.tage[2].gesamt], [0, 1, 1, 2], '03.11. ohne #3: Eingang 0 · In Arbeit 1 · Fertig 1 (gesamt 2)');
  assert.strictEqual(d.tage[2].angekommen, 2, 'auch „angekommen“ nimmt #3 heraus');
});

test('Fluss: die y-Achse reicht bis zum höchsten Wert der Bänder und Ränder (R00121 B0557)', () => {
  const { flussMax } = require('../../web/berichte.js');
  const tage = [
    { gesamt: 1, angekommen: 1, fertig: 0 },
    { gesamt: 0, angekommen: 1, fertig: 0 },
    { gesamt: 3, angekommen: 4, fertig: 2 },
  ];
  assert.strictEqual(flussMax(tage), 4, '„angekommen“ 4 schlägt den höchsten Stapel 3');
  assert.strictEqual(flussMax([{ gesamt: 0, angekommen: 0, fertig: 0 }]), 1, 'nie unter 1, damit die Achse nicht bei 0 steht');
});

/* ── Durchsatz je Zeitraum (R00122) ── */
const { durchsatz, durchsatzZiel, durchsatzName, durchsatzTip, durchsatzMarke, durchsatzMarken } = require('../../web/berichte.js');

/** Grundbestand der AK (R00122): Board „fabrik“ (Eingang/In Arbeit/Fertig), Bewegungen 02.–11.11.2026. */
const DURCH = {
  spalten: ['Eingang', 'In Arbeit', 'Fertig'],
  aufgaben: [
    { nummer: 1, wechsel: [['2026-11-02 09:00', 'Eingang'], ['2026-11-03 09:00', 'In Arbeit'], ['2026-11-04 09:00', 'Fertig']] },
    { nummer: 2, wechsel: [['2026-11-03 09:00', 'Eingang'], ['2026-11-05 09:00', 'Fertig'], ['2026-11-10 09:00', null]] },
    { nummer: 3, wechsel: [['2026-11-04 09:00', 'Eingang'], ['2026-11-06 09:00', 'In Arbeit'], ['2026-11-09 09:00', 'Fertig']] },
    { nummer: 4, wechsel: [['2026-11-09 09:00', 'Eingang'], ['2026-11-11 09:00', 'Fertig']] },
  ].map(a => ({ ...a, wechsel: a.wechsel.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte })) })),
};
const DURCH_JETZT = new Date(2026, 10, 11, 20, 0).getTime(); // 11.11.2026, 20 Uhr
const zuDurch = () => ({ klasse: '', zustaendige: [], labels: [] });
const AK_FILTER = f({ zeitraum: 'eigen', von: '2026-11-02', bis: '2026-11-11' });
const durch = (einheit, filter = AK_FILTER) => durchsatz(DURCH, filter, zuDurch, DURCH_JETZT, null, einheit);

test('Durchsatz je Periode: Woche, Tag, Monat und Rate wie das Rechenbeispiel (R00122 B0562)', () => {
  const woche = durch('woche');
  assert.deepStrictEqual(woche.perioden.map(p => p.anzahl), [2, 2], 'KW45 2 · KW46 2');
  assert.deepStrictEqual([woche.gesamt, woche.durchschnitt, woche.einheit], [4, 2, 'woche'], 'Gesamt 4, Ø 2,0 je Woche, zwei Perioden');
  assert.deepStrictEqual(woche.perioden.map(p => durchsatzName(p, 'woche')), ['KW45 02.–08.11.2026', 'KW46 09.–15.11.2026']);
  const tag = durch('tag');
  assert.strictEqual(tag.perioden.length, 10, 'zehn Tage 02.–11.11.');
  assert.deepStrictEqual(tag.perioden.map(p => p.anzahl), [0, 0, 1, 1, 0, 0, 0, 1, 0, 1], '04./05./09./11.11. je 1, sonst 0');
  assert.strictEqual(tag.durchschnitt, 0.4, 'Ø 0,4 je Tag');
  const monat = durch('monat');
  assert.deepStrictEqual([monat.perioden.map(p => p.anzahl), monat.perioden.length, monat.durchschnitt], [[4], 1, 4], 'November 2026: 4, Ø 4,0, eine Periode');
  assert.strictEqual(durchsatzName(monat.perioden[0], 'monat'), 'November 2026');
});

test('Durchsatz: das erste Erreichen des Ziels zählt (R00122 B0562)', () => {
  assert.deepStrictEqual(durch('woche').perioden.map(p => p.anzahl), [2, 2], '#3 zählt am 09.11. (Fertig), nicht am 06.11. (In Arbeit)');
});

test('Durchsatz-Ziel: Abschlussspalte, bei gebundenem Board die letzte Phase (R00122 B0562)', () => {
  const ohne = durchsatzZiel(DURCH, null);
  assert.deepStrictEqual([ohne.art, ohne.name, ohne.i], ['spalte', 'Fertig', 2]);
  const phasen = { anwendung: 'kd', folge: [{ nr: 1, name: 'Entwicklung' }, { nr: 2, name: 'Auslieferung' }], spaltenphasen: { Eingang: 'Entwicklung', 'In Arbeit': 'Entwicklung', Fertig: 'Auslieferung' } };
  const mitPhasen = { ...DURCH, phasen };
  assert.deepStrictEqual([durchsatzZiel(mitPhasen, phasen).art, durchsatzZiel(mitPhasen, phasen).name], ['phase', 'Auslieferung']);
  assert.deepStrictEqual(durchsatz(mitPhasen, AK_FILTER, zuDurch, DURCH_JETZT, null, 'woche').perioden.map(p => p.anzahl), [2, 2], 'dieselbe Bedeutung je letzter Phase');
});

test('Durchsatz je letzter Phase: „durchlaufen“ heißt über die letzte Phase hinaus (R00122 B0562)', () => {
  const phasen = { anwendung: 'kd', folge: [{ nr: 1, name: 'P1' }, { nr: 2, name: 'P2' }], spaltenphasen: { Bau: 'P1', Test: 'P2' } };
  const bew = { spalten: ['Bau', 'Test', 'Erledigt'], phasen, aufgaben: [
    { nummer: 1, wechsel: [{ zeitpunkt: '2026-11-02 09:00', spalte: 'Bau' }, { zeitpunkt: '2026-11-03 09:00', spalte: 'Test' }, { zeitpunkt: '2026-11-05 09:00', spalte: 'Erledigt' }] },
    { nummer: 2, wechsel: [{ zeitpunkt: '2026-11-02 09:00', spalte: 'Bau' }, { zeitpunkt: '2026-11-03 09:00', spalte: 'Test' }] },
  ] };
  const d = durchsatz(bew, AK_FILTER, zuDurch, DURCH_JETZT, null, 'tag');
  assert.deepStrictEqual([d.gesamt, d.perioden[3].anzahl], [1, 1], '#1 zählt beim Verlassen der letzten Phase (05.11.); #2 bleibt in ihr und zählt nicht');
});

test('Durchsatz: Zeitraum, Ausschlüsse und Messbasis (R00122 B0569)', () => {
  const lauf = (x, bew = DURCH) => durchsatz(bew, f(x), zuDurch, DURCH_JETZT, null, 'woche').perioden.map(p => p.anzahl);
  assert.deepStrictEqual(lauf({}), [2, 2], 'ohne Zeitraum bis heute');
  assert.deepStrictEqual(lauf({ zeitraum: 'eigen', von: '2026-11-05', bis: '2026-11-11' }), [1, 2], 'Zeitraum 05.–11.11.: KW45 nur #2 (05.11.), KW46 #3/#4');
  assert.deepStrictEqual(lauf({ ohneSpalten: ['Eingang'] }), [2, 2], 'eine ausgeschlossene Spalte links vom Ziel ändert die Ankünfte nicht');
  assert.deepStrictEqual(lauf({ ohneSpalten: ['Fertig'] }), [], 'ausgeschlossene Zielspalte: keine Perioden (Hinweis statt Balken)');
  assert.strictEqual(durchsatz(DURCH, f({ ohneSpalten: ['Fertig'] }), zuDurch, DURCH_JETZT, null, 'woche').zielAusgeschlossen, true);
  assert.deepStrictEqual(lauf({ messbasisTage: 1 }), lauf({ messbasisTage: 90 }), 'die Messbasis wirkt nicht');
  assert.deepStrictEqual(durchsatz(DURCH, f({}), zuDurch, DURCH_JETZT, '2026-11-05', 'woche').perioden.map(p => p.anzahl), [1, 2], '„Rechnen ab“ schneidet den Anfang ab');
});

test('Durchsatz: Klasse, Zuständige und Labels schränken die gezählten Aufgaben ein (R00122 B0569)', () => {
  const ZU = { 1: { klasse: 'bug', zustaendige: ['st'], labels: ['ui'] }, 2: { klasse: 'ux', zustaendige: ['mi'], labels: [] }, 3: { klasse: 'bug', zustaendige: [], labels: ['daten'] }, 4: { klasse: 'ux', zustaendige: ['st'], labels: [] } };
  const zu = nr => ZU[nr];
  const lauf = x => durchsatz(DURCH, f(x), zu, DURCH_JETZT, null, 'woche').perioden.map(p => p.anzahl);
  assert.deepStrictEqual(lauf({ ohneFarben: ['ux'] }), [1, 1], 'ohne Klasse „ux“ bleiben #1 (04.11.) und #3 (09.11.)');
  assert.deepStrictEqual(lauf({ personen: ['st'] }), [1, 1], 'zuständig st: #1 und #4');
  assert.deepStrictEqual(lauf({ labels: ['ui'] }), [1, 0], 'Label ui: nur #1');
});

test('Durchsatz: reporting.forecast false nimmt die Aufgabe aus (R00122 B0563)', () => {
  const ohne3 = { ...DURCH, aufgaben: DURCH.aufgaben.map(a => a.nummer === 3 ? { ...a, reporting: { forecast: false } } : a) };
  const d = durchsatz(ohne3, AK_FILTER, zuDurch, DURCH_JETZT, null, 'woche');
  assert.deepStrictEqual(d.perioden.map(p => p.anzahl), [2, 1], 'KW45 2 · KW46 1 (#4)');
  assert.deepStrictEqual([d.gesamt, d.ausgenommen], [3, 1], 'Gesamt 3, ausgenommen 1');
});

test('Durchsatz: leerer Zeitraum und Board ohne Bewegung ergeben keine Perioden (R00122 B0562)', () => {
  assert.deepStrictEqual(durchsatz(DURCH, f({ zeitraum: 'eigen', von: '2026-01-01', bis: '2026-01-31' }), zuDurch, DURCH_JETZT, null, 'tag').perioden, [], 'Zeitraum vor der ersten Bewegung');
  assert.deepStrictEqual(durchsatz({ spalten: ['A', 'B'], aufgaben: [] }, AK_FILTER, zuDurch, DURCH_JETZT, null, 'woche').perioden, [], 'kein Stand');
});

test('Durchsatz: Tooltiptext und Achsenmarke je Auflösung (R00122 M1)', () => {
  const woche = durch('woche'), tag = durch('tag'), monat = durch('monat');
  assert.strictEqual(durchsatzTip(woche.perioden[1], 'woche'), 'Woche 09.–15.11.2026');
  assert.deepStrictEqual(durchsatzMarke(woche.perioden[0], 'woche'), { oben: 'KW45', unten: '2026' }, 'zwei unterscheidbare Wochenmarken, nicht zwei gleiche Tagesdaten');
  assert.strictEqual(durchsatzTip(tag.perioden[2], 'tag'), '04.11.2026');
  assert.deepStrictEqual(durchsatzMarke(tag.perioden[2], 'tag'), { oben: '04.11.', unten: '2026' });
  assert.deepStrictEqual(durchsatzMarke(monat.perioden[0], 'monat'), { oben: 'November 2026', unten: '' });
});

test('Durchsatz: die x-Achse trägt garantiert höchstens acht Marken, die letzte immer (R00122 M8/S2)', () => {
  assert.deepStrictEqual(durchsatzMarken(0), []);
  assert.deepStrictEqual(durchsatzMarken(1), [0]);
  assert.deepStrictEqual(durchsatzMarken(2), [0, 1], 'zwei Wochen: zwei unterscheidbare Marken');
  assert.deepStrictEqual(durchsatzMarken(3), [0, 1, 2], 'eine leere Periode ist an ihrer Marke erkennbar');
  assert.deepStrictEqual(durchsatzMarken(10), [0, 2, 4, 6, 8, 9], 'zehn Tage: sechs Marken, die letzte dabei');
  assert.deepStrictEqual(durchsatzMarken(16), [0, 3, 6, 9, 12, 15]);
  assert.deepStrictEqual(durchsatzMarken(90), [0, 13, 26, 39, 52, 65, 78, 89], 'rund 90 Perioden: genau acht Marken');
  for (let n = 1; n <= 200; n++) {
    const marken = durchsatzMarken(n);
    assert.ok(marken.length <= 8, `${n} Perioden → ${marken.length} Marken`);
    assert.strictEqual(marken[marken.length - 1], n - 1, `die letzte Periode ist bei ${n} dabei`);
  }
});

// Karte #173: x-Marken von Burndown und Kumulativem Fluss (R00121, „schmales Layout: höchstens acht x-Marken“)
const { xMarken } = require('../../web/berichte.js');

test('x-Marken der Tagesdiagramme: für 1 bis 400 Tage nie mehr als acht, erster und letzter Tag beschriftet', () => {
  assert.deepStrictEqual(xMarken(0), []);
  assert.deepStrictEqual(xMarken(1), [0]);
  assert.deepStrictEqual(xMarken(2), [0, 1]);
  assert.deepStrictEqual(xMarken(3), [0, 1, 2]);
  assert.deepStrictEqual(xMarken(8), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepStrictEqual(xMarken(15), [0, 2, 4, 6, 8, 10, 12, 14], 'unverändert, wo es schon acht waren');
  const zuViele = [];
  for (let tage = 1; tage <= 400; tage++) {
    const marken = xMarken(tage);
    if (marken.length > 8) zuViele.push(`${tage}→${marken.length}`);
    assert.strictEqual(marken[0], 0, `${tage} Tage: erster Tag beschriftet`);
    assert.strictEqual(marken[marken.length - 1], tage - 1, `${tage} Tage: letzter Tag beschriftet`);
    assert.deepStrictEqual(marken, [...new Set(marken)].sort((a, b) => a - b), `${tage} Tage: aufsteigend, keine doppelte Marke`);
  }
  assert.deepStrictEqual(zuViele, [], 'Tage→Marken über acht');
});
