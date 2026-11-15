// R00152 Eine Bestandsregel für Burndown, Kumulativen Fluss und „Wie lange noch“ (ADR-0027) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const SPALTEN = ['Eingang', 'In Arbeit', 'Fertig'], ERLEDIGT = ['Fertig'];
const am = (t, uhr = '09:00') => `2026-11-${String(t).padStart(2, '0')} ${uhr}`;
const z = (t, spalte) => ({ zeitpunkt: am(t), spalte });
const ms = (t, h = 12, min = 0) => new Date(2026, 10, t, h, min).getTime();
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = x => ({ klasse: null, zustaendige: ['st'], labels: [], ...x });

/** Grundbestand A (R00152): 02.11. #1–#7 in „Eingang“; 03.11. #2, #4, #6 nach „Fertig“; 06.11. #3 archiviert (in „Eingang“),
    #4 archiviert (in „Fertig“), #5 und #6 endgültig gelöscht (keine Datei mehr), #7 vom Board genommen. */
const bewegungenA = ({ ruecklauf2 = false, ohne3 = false } = {}) => ({ spalten: SPALTEN, aufgaben: [
  { nummer: 1, wechsel: [z(2, 'Eingang')] },
  { nummer: 2, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), ...(ruecklauf2 ? [z(8, 'In Arbeit')] : [])] },
  { nummer: 3, wechsel: [z(2, 'Eingang')], ...(ohne3 ? { reporting: { burndown: false } } : {}) },
  { nummer: 4, wechsel: [z(2, 'Eingang'), z(3, 'Fertig')] },
  { nummer: 5, wechsel: [z(2, 'Eingang'), z(6, null)] },
  { nummer: 6, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), z(6, null)] },
  { nummer: 7, wechsel: [z(2, 'Eingang'), z(6, null)] },
] });
/** Aufgabenliste des Clients zu Grundbestand A; `archivtag3: null` heißt: #3 ist zurückgeholt. */
const aufgabenA = (archivtag3 = '2026-11-06') => nr => {
  if (nr === 5 || nr === 6) return undefined;
  if (nr === 3) return mitDatei(archivtag3 ? { archiviert: archivtag3 } : {});
  return mitDatei(nr === 4 ? { archiviert: '2026-11-06' } : {});
};
const wechselA = nr => bewegungenA().aufgaben[nr - 1].wechsel;
const archivtagA = nr => (aufgabenA()(nr) || {}).archiviert;
const bestandA = (nr, t) => B.bestandAm(wechselA(nr), archivtagA(nr), t, ERLEDIGT);

/* ── B0704 Bestandsfunktion ── */
test('R00152 B0704: Bestand je Aufgabe im Grundbestand A am 10.11. — da/offen, da/erledigt, entfernt, nicht da', () => {
  const heute = ms(10);
  assert.deepStrictEqual(bestandA(1, heute), { art: 'da', spalte: 'Eingang', erledigt: false }, '#1 da, offen');
  assert.deepStrictEqual(bestandA(2, heute), { art: 'da', spalte: 'Fertig', erledigt: true }, '#2 da, erledigt');
  assert.deepStrictEqual(bestandA(3, heute), { art: 'entfernt', spalte: 'Eingang', erledigt: false }, '#3 archiviert außerhalb der Abschlussspalte: entfernt');
  assert.deepStrictEqual(bestandA(4, heute), { art: 'da', spalte: 'Fertig', erledigt: true }, '#4 archiviert in der Abschlussspalte bleibt erledigt (AK 6)');
  assert.deepStrictEqual(bestandA(5, heute), { art: 'nichtDa', spalte: null, erledigt: false }, '#5 endgültig gelöscht (ohne Datei, kein Archivtag)');
  assert.deepStrictEqual(bestandA(6, heute), { art: 'nichtDa', spalte: null, erledigt: false }, '#6 erledigt und endgültig gelöscht');
  assert.deepStrictEqual(bestandA(7, heute), { art: 'nichtDa', spalte: null, erledigt: false }, '#7 vom Board genommen');
});

test('R00152 B0704 (AK 5): der Archivtag gilt ab 0 Uhr — am Vortag 23:59 da, am Archivtag 00:00 entfernt', () => {
  assert.strictEqual(bestandA(3, ms(5, 23, 59)).art, 'da');
  assert.strictEqual(bestandA(3, ms(6, 0, 0) - 1).art, 'da', 'letzte Millisekunde des Vortags');
  assert.strictEqual(bestandA(3, ms(6, 0, 0)).art, 'entfernt');
  assert.strictEqual(bestandA(3, ms(6, 12, 0)).art, 'entfernt', 'Stand 06.11., 12:00 Uhr');
});

test('R00152 B0704: nicht da — vor dem ersten Wechsel, ohne Wechsel und nach dem Abnehmen, auch mit Archivtag', () => {
  const nichtDa = { art: 'nichtDa', spalte: null, erledigt: false };
  assert.deepStrictEqual(bestandA(1, ms(1)), nichtDa, 'vor dem 02.11. noch nicht auf dem Board');
  assert.deepStrictEqual(B.bestandAm([], '2026-11-06', ms(10), ERLEDIGT), nichtDa, 'nie auf dem Board');
  assert.deepStrictEqual(B.bestandAm([z(2, 'Eingang'), z(6, null)], '2026-11-04', ms(10), ERLEDIGT), nichtDa, 'archiviert und danach vom Board genommen: nicht da, nicht entfernt');
  assert.strictEqual(bestandA(5, ms(5)).art, 'da', '#5 zählt bis zum Vortag des Löschens (AK 11)');
});

test('R00152 B0704 (AK 18): „erledigt“ kommt aus dem Parameter erledigtSpalten, nicht aus der Lage der Spalte', () => {
  const inArbeit = [z(2, 'Eingang'), z(3, 'In Arbeit')];
  assert.deepStrictEqual(B.bestandAm(inArbeit, '2026-11-06', ms(10), ['In Arbeit', 'Fertig']), { art: 'da', spalte: 'In Arbeit', erledigt: true }, 'archiviert in einer Erledigt-Spalte bleibt erledigt');
  assert.deepStrictEqual(B.bestandAm(inArbeit, '2026-11-06', ms(10), ['Fertig']), { art: 'entfernt', spalte: 'In Arbeit', erledigt: false });
  assert.deepStrictEqual(B.bestandAm(wechselA(2), undefined, ms(10), ['Eingang']), { art: 'da', spalte: 'Fertig', erledigt: false }, 'die letzte Spalte ist nur erledigt, wenn sie genannt ist');
  assert.deepStrictEqual(B.bestandAm(wechselA(4), '2026-11-06', ms(10), []), { art: 'entfernt', spalte: 'Fertig', erledigt: false }, 'ohne Erledigt-Spalte ist jede archivierte Aufgabe entfernt');
});

test('R00152 B0704: die Erledigt-Spalten eines Boards sind heute die letzte Spalte', () => {
  assert.deepStrictEqual(B.erledigtSpalten({ spalten: SPALTEN }), ['Fertig']);
  assert.deepStrictEqual(B.erledigtSpalten({ spalten: [] }), []);
});

/* ── B0705 Burndown liest den Bestand ── */
const kurz = tage => tage.map(x => `${x.offen}/${x.umfang}`);
/** Erwartete Reihe über die neun Tage 02.–10.11.: der 02.11., dreimal 03.–05.11., fünfmal 06.–10.11. */
const neunTage = (erster, mitte, ende) => [erster, mitte, mitte, mitte, ende, ende, ende, ende, ende];
const burndownA = (optionen = {}, f = {}, heute = ms(10), archivtag3) => B.burndown(bewegungenA(optionen), filter(f), aufgabenA(archivtag3), heute);

test('R00152 B0705 (AK 1): Burndown im Grundbestand A — 7/7, dreimal 4/7, fünfmal 1/3; die verworfene #3 zählt ab dem Archivtag nicht mehr', () => {
  const tage = burndownA();
  assert.deepStrictEqual(tage.map(x => x.datum), ['02', '03', '04', '05', '06', '07', '08', '09', '10'].map(t => `2026-11-${t}`));
  assert.deepStrictEqual(kurz(tage), neunTage('7/7', '4/7', '1/3'));
});

test('R00152 B0705 (AK 5): Stand 06.11., 12:00 Uhr — der Vortag zählt #3 noch (4/7), der Archivtag nicht mehr (1/3)', () => {
  assert.deepStrictEqual(kurz(burndownA({}, {}, ms(6, 12, 0))), ['7/7', '4/7', '4/7', '4/7', '1/3']);
});

test('R00152 B0705 (AK 16): ausgeschlossene Spalte „Eingang“ — 0/0, 0/3 und ab dem 06.11. 0/2, wie vor dem Fix', () => {
  assert.deepStrictEqual(kurz(burndownA({}, { ohneSpalten: ['Eingang'] })), neunTage('0/0', '0/3', '0/2'));
});

test('R00152 B0705: die verworfene Aufgabe fällt auch aus einem Burndown mit Zeitraum und „Rechnen ab“', () => {
  const zeitraum = B.burndown(bewegungenA(), filter({ zeitraum: 'eigen', von: '2026-11-05', bis: '2026-11-07' }), aufgabenA(), ms(10));
  assert.deepStrictEqual(kurz(zeitraum), ['4/7', '1/3', '1/3']);
  const ab = B.burndown(bewegungenA(), filter({}), aufgabenA(), ms(10), '2026-11-05');
  assert.deepStrictEqual(kurz(ab), ['4/7', '1/3', '1/3', '1/3', '1/3', '1/3']);
});

/* ── B0706 Kumulativer Fluss liest den Bestand ── */
const baender = tage => tage.map(x => SPALTEN.map(s => x.jeSpalte[s]).join('·'));
const offenGesamt = tage => tage.map(x => `${x.offen}/${x.gesamt}`);
const flussA = (optionen = {}, f = {}, heute = ms(10), archivtag3) => B.fluss(bewegungenA(optionen), filter(f), aufgabenA(archivtag3), heute).tage;

test('R00152 B0706 (AK 2): Fluss im Grundbestand A — Bänder 7·0·0, 4·0·3 und ab dem Archivtag 1·0·2; offen und gesamt wie der Burndown', () => {
  const tage = flussA();
  assert.deepStrictEqual(baender(tage), neunTage('7·0·0', '4·0·3', '1·0·2'));
  assert.deepStrictEqual(offenGesamt(tage), neunTage('7/7', '4/7', '1/3'));
});

test('R00152 B0706 (AK 2): „angekommen“ und „fertig“ sinken nicht — an jedem Tag 7, fertig 0 am 02.11. und 3 ab dem 03.11.', () => {
  const tage = flussA();
  assert.deepStrictEqual(tage.map(x => x.angekommen), Array(9).fill(7));
  assert.deepStrictEqual(tage.map(x => x.fertig), [0, 3, 3, 3, 3, 3, 3, 3, 3]);
});

test('R00152 B0706 (AK 6): die in der Abschlussspalte archivierte #4 bleibt im Band „Fertig“ — ohne sie stünde dort nur #2', () => {
  assert.strictEqual(flussA()[8].jeSpalte.Fertig, 2, '#2 und #4');
  const ohne4 = B.fluss({ spalten: SPALTEN, aufgaben: bewegungenA().aufgaben.filter(a => a.nummer !== 4) }, filter({}), aufgabenA(), ms(10)).tage;
  assert.strictEqual(ohne4[8].jeSpalte.Fertig, 1);
});

test('R00152 B0706 (AK 5): Fluss am Stand 06.11., 12:00 Uhr — Vortag 4·0·3, Archivtag 1·0·2', () => {
  assert.deepStrictEqual(baender(flussA({}, {}, ms(6, 12, 0))), ['7·0·0', '4·0·3', '4·0·3', '4·0·3', '1·0·2']);
});
