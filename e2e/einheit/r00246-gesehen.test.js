// R00246 B1288, B1289: „Gesehen“ je Karte im Browser-Speicher (FA 7, 9, 10; ADR-0042 N1.4, N4) und die Schlüssel der Dateien mit
// Fingerabdruck ohne `patch` (FA 7, 8; ADR-0042 N3) — reine Rechnung, der Speicher ist eine Node-Attrappe mit der Schnittstelle von
// `localStorage` (getItem, setItem, removeItem, key, length).
const test = require('node:test');
const assert = require('node:assert');
const { gesehenLesen, gesehenSchreiben, gesehenSchluessel, commitDateiSchluessel, alleDateiSchluessel, fingerabdruck, GESEHEN_HOECHSTENS } = require('../../web/review-uebersicht.js');

/** Speicher wie `localStorage`: Schlüssel in Einfügereihenfolge, Werte als Text. */
function speicherAttrappe(anfang = {}) {
  const werte = new Map(Object.entries(anfang));
  return {
    werte,
    get length() { return werte.size; },
    key: i => [...werte.keys()][i] ?? null,
    getItem: s => (werte.has(s) ? werte.get(s) : null),
    setItem: (s, w) => { werte.set(s, String(w)); },
    removeItem: s => { werte.delete(s); },
  };
}

/** Ein Speicher, der bei jedem Zugriff wirft (gesperrt, Kontingent voll). */
function werfenderSpeicher() {
  const wirf = () => { throw new Error('SecurityError'); };
  return { get length() { return wirf(); }, key: wirf, getItem: wirf, setItem: wirf, removeItem: wirf };
}

const wert = (zeit, gesehen) => JSON.stringify({ zeit, gesehen });
const gelesen = (speicher, schluessel) => JSON.parse(speicher.getItem(schluessel));

/* ── B1288 Speicher ── */

test('Schlüssel der Karte: kanbanD.gesehen.<slug>.<nr>', () => {
  assert.strictEqual(gesehenSchluessel('entwicklung', 3), 'kanbanD.gesehen.entwicklung.3');
  assert.notStrictEqual(gesehenSchluessel('entwicklung', 3), gesehenSchluessel('entwicklung', 4));
  assert.notStrictEqual(gesehenSchluessel('entwicklung', 3), gesehenSchluessel('anderes', 3));
});

test('Lesen: leer ohne Wert, die Liste aus {zeit, gesehen}, kein Fehler', () => {
  const speicher = speicherAttrappe({ 'kanbanD.gesehen.b.1': wert(5, ['x', 'y']) });
  assert.deepStrictEqual(gesehenLesen(speicher, 'b', 2), { gesehen: [], fehler: false });
  assert.deepStrictEqual(gesehenLesen(speicher, 'b', 1), { gesehen: ['x', 'y'], fehler: false });
});

test('Lesen: ein unlesbarer Wert gilt als leer und ist kein Fehler des Speichers (FA 9)', () => {
  for (const kaputt of ['{kaputt', '42', '"text"', 'null', '{"zeit":1,"gesehen":"x"}', '[]']) {
    const speicher = speicherAttrappe({ 'kanbanD.gesehen.b.1': kaputt });
    assert.deepStrictEqual(gesehenLesen(speicher, 'b', 1), { gesehen: [], fehler: false }, kaputt);
  }
});

test('Setzen schreibt {zeit, gesehen} unter dem Schlüssel der Karte; Entfernen nimmt genau den einen Eintrag heraus', () => {
  const speicher = speicherAttrappe();
  assert.deepStrictEqual(gesehenSchreiben(speicher, 'b', 1, [['a', true]], 100), { gesehen: ['a'], fehler: false });
  gesehenSchreiben(speicher, 'b', 1, [['c', true]], 200);
  assert.deepStrictEqual(gelesen(speicher, 'kanbanD.gesehen.b.1'), { zeit: 200, gesehen: ['a', 'c'] });
  assert.deepStrictEqual(gesehenSchreiben(speicher, 'b', 1, [['a', false]], 300), { gesehen: ['c'], fehler: false });
  assert.deepStrictEqual(gelesen(speicher, 'kanbanD.gesehen.b.1'), { zeit: 300, gesehen: ['c'] });
  gesehenSchreiben(speicher, 'b', 1, [['c', true]], 400);
  assert.deepStrictEqual(gelesen(speicher, 'kanbanD.gesehen.b.1').gesehen, ['c'], 'ein zweites Setzen doppelt nichts');
});

test('Zwei Schreiber nacheinander: jeder liest frisch, der Haken des anderen bleibt (FA 10, m9)', () => {
  const speicher = speicherAttrappe();
  const tabA = gesehenLesen(speicher, 'b', 1), tabB = gesehenLesen(speicher, 'b', 1);
  assert.deepStrictEqual([tabA.gesehen, tabB.gesehen], [[], []]);
  gesehenSchreiben(speicher, 'b', 1, [['css', true]], 100);
  const nachB = gesehenSchreiben(speicher, 'b', 1, [['kontrast', true]], 200);
  assert.deepStrictEqual(nachB.gesehen, ['css', 'kontrast']);
  assert.deepStrictEqual(gesehenLesen(speicher, 'b', 1).gesehen, ['css', 'kontrast']);
});

test('Mehrere Änderungen in einem Zug (unsichere Haken vom Fehlschlag nachgeholt): in der Reihenfolge angewandt', () => {
  const speicher = speicherAttrappe({ 'kanbanD.gesehen.b.1': wert(1, ['x']) });
  const ergebnis = gesehenSchreiben(speicher, 'b', 1, [['a', true], ['x', false], ['b', true], ['a', false]], 9);
  assert.deepStrictEqual(ergebnis, { gesehen: ['b'], fehler: false });
});

test('Ein unlesbarer Wert wird beim nächsten Setzen überschrieben (FA 9, AK 6)', () => {
  const speicher = speicherAttrappe({ 'kanbanD.gesehen.b.1': '{kaputt' });
  gesehenSchreiben(speicher, 'b', 1, [['a', true]], 50);
  assert.deepStrictEqual(gelesen(speicher, 'kanbanD.gesehen.b.1'), { zeit: 50, gesehen: ['a'] });
});

test('Obergrenze: #1–#200 mit aufsteigender zeit, dann ein Haken bei #1 und einer bei #201 → 200 Schlüssel, #2 fehlt (FA 9, AK 6, m6)', () => {
  const anfang = { 'kanbanD.spalten-zu.b': '["Erledigt"]', 'anderes': 'x' };
  for (let nr = 1; nr <= 200; nr++) anfang[`kanbanD.gesehen.b.${nr}`] = wert(1000 + nr, [`k${nr}`]);
  const speicher = speicherAttrappe(anfang);
  gesehenSchreiben(speicher, 'b', 1, [['neu', true]], 5000);
  assert.strictEqual(gesehenZahl(speicher), 200, 'nach dem Haken bei #1 sind es weiter 200');
  gesehenSchreiben(speicher, 'b', 201, [['neu', true]], 5001);
  assert.strictEqual(GESEHEN_HOECHSTENS, 200);
  assert.strictEqual(gesehenZahl(speicher), 200);
  assert.strictEqual(speicher.getItem('kanbanD.gesehen.b.2'), null, '#2 hat die kleinste zeit');
  assert.notStrictEqual(speicher.getItem('kanbanD.gesehen.b.1'), null);
  assert.notStrictEqual(speicher.getItem('kanbanD.gesehen.b.201'), null);
  assert.notStrictEqual(speicher.getItem('kanbanD.gesehen.b.3'), null, 'nur einer fällt');
  assert.strictEqual(speicher.getItem('kanbanD.spalten-zu.b'), '["Erledigt"]', 'fremde Schlüssel bleiben');
  assert.strictEqual(speicher.getItem('anderes'), 'x');
});

test('Obergrenze zählt Boards zusammen: 200 auf zwei Boards, das 201. fällt am ältesten weg, egal auf welchem Board', () => {
  const anfang = {};
  for (let nr = 1; nr <= 100; nr++) anfang[`kanbanD.gesehen.a.${nr}`] = wert(2000 + nr, ['x']);
  for (let nr = 1; nr <= 100; nr++) anfang[`kanbanD.gesehen.b.${nr}`] = wert(1000 + nr, ['x']);
  const speicher = speicherAttrappe(anfang);
  gesehenSchreiben(speicher, 'a', 999, [['x', true]], 9999);
  assert.strictEqual(gesehenZahl(speicher), 200);
  assert.strictEqual(speicher.getItem('kanbanD.gesehen.b.1'), null);
});

test('Beim Aufräumen zählt ein unlesbarer Wert als der älteste (FA 9, AK 6)', () => {
  const anfang = {};
  for (let nr = 1; nr <= 200; nr++) anfang[`kanbanD.gesehen.b.${nr}`] = wert(1000 + nr, ['x']);
  anfang['kanbanD.gesehen.b.150'] = '{kaputt';
  const speicher = speicherAttrappe(anfang);
  gesehenSchreiben(speicher, 'b', 201, [['x', true]], 5000);
  assert.strictEqual(gesehenZahl(speicher), 200);
  assert.strictEqual(speicher.getItem('kanbanD.gesehen.b.150'), null);
  assert.notStrictEqual(speicher.getItem('kanbanD.gesehen.b.1'), null);
});

test('Nacharbeit S1: Einträge mit Zeit in der Zukunft verdrängen die eben geschriebene Karte nicht (200 Karten mit zeit 1e15, Schreiben bei #999)', () => {
  const anfang = {};
  for (let nr = 1; nr <= 200; nr++) anfang[`kanbanD.gesehen.b.${nr}`] = wert(1e15, ['x']);
  const speicher = speicherAttrappe(anfang);
  gesehenSchreiben(speicher, 'b', 999, [['x', true]], 5000);
  assert.deepStrictEqual(gelesen(speicher, 'kanbanD.gesehen.b.999').gesehen, ['x'], 'die gerade geschriebene Karte bleibt');
  assert.strictEqual(gesehenZahl(speicher), 200);
});

test('Werfender oder fehlender Speicher: kein Wurf, fehler wahr, die Änderung gilt im Ergebnis (FA 10, m12)', () => {
  for (const speicher of [werfenderSpeicher(), null, undefined]) {
    assert.deepStrictEqual(gesehenLesen(speicher, 'b', 1), { gesehen: [], fehler: true });
    assert.deepStrictEqual(gesehenSchreiben(speicher, 'b', 1, [['a', true], ['b', true], ['a', false]], 1), { gesehen: ['b'], fehler: true });
  }
});

test('Speicher wirft nur beim Schreiben (Kontingent voll): Lesen gelingt, Schreiben meldet fehler, die gelesenen Haken bleiben im Ergebnis', () => {
  const speicher = speicherAttrappe({ 'kanbanD.gesehen.b.1': wert(1, ['x']) });
  speicher.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.deepStrictEqual(gesehenSchreiben(speicher, 'b', 1, [['a', true]], 2), { gesehen: ['x', 'a'], fehler: true });
});

function gesehenZahl(speicher) {
  return [...speicher.werte.keys()].filter(s => s.startsWith('kanbanD.gesehen.')).length;
}

/* ── B1289 Schlüssel und Fingerabdruck ── */

const HASH = 'a'.repeat(40);
const datei = (zusatz = {}) => ({ alt: 'src/a.rs', neu: 'src/a.rs', status: 'M', plus: 2, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1,2 @@\n-x\n+y\n+z\n', ...zusatz });
const schritt = (c, zusatz = {}) => ({ commit: `kd:${c.repeat(40)}`, ...datei(zusatz) });
const folge = schritte => ({ pfad: 'src/f.rs', plus: 4, minus: 2, binaer: false, schritte });

test('Ein Commit: <voller Hash> U+0000 <Pfad>, bei gelöschten der alte Pfad, bei umbenannten der neue (FA 7)', () => {
  assert.strictEqual(commitDateiSchluessel(HASH, datei()), `${HASH}\u0000src/a.rs`);
  assert.strictEqual(commitDateiSchluessel(HASH, datei({ status: 'D', neu: null, alt: 'weg.rs' })), `${HASH}\u0000weg.rs`);
  assert.strictEqual(commitDateiSchluessel(HASH, datei({ status: 'R', alt: 'alt.rs', neu: 'neu.rs' })), `${HASH}\u0000neu.rs`);
  assert.notStrictEqual(commitDateiSchluessel(HASH, datei()), commitDateiSchluessel('b'.repeat(40), datei()), 'anderer Commit, andere Datei (FA 8)');
});

test('Pfade mit Bidi- und Steuerzeichen stehen roh im Schlüssel, unverändert', () => {
  const pfad = 'bidi-‮datei\u001B.dat';
  assert.strictEqual(commitDateiSchluessel(HASH, datei({ alt: pfad, neu: pfad })), `${HASH}\u0000${pfad}`);
  assert.strictEqual(alleDateiSchluessel('kd', datei({ alt: pfad, neu: pfad })).split('\u0000')[2], pfad);
});

test('Alle Änderungen: alle U+0000 <Anwendung> U+0000 <Pfad> U+0000 <Fingerabdruck>; die Standardanwendung ist leer', () => {
  const d = datei();
  assert.strictEqual(alleDateiSchluessel('kd', d), `alle\u0000kd\u0000src/a.rs\u0000${fingerabdruck(d)}`);
  assert.strictEqual(alleDateiSchluessel('', d), `alle\u0000\u0000src/a.rs\u0000${fingerabdruck(d)}`);
  assert.notStrictEqual(alleDateiSchluessel('kd', d), alleDateiSchluessel('wb', d), 'gleichnamige Datei einer anderen Anwendung');
  assert.strictEqual(alleDateiSchluessel('kd', folge([schritt('a')])).split('\u0000')[2], 'src/f.rs');
});

test('Fingerabdruck: FNV-1a 32 Bit, acht Stellen hexadezimal; gleiche Felder gleicher Wert', () => {
  assert.match(fingerabdruck(datei()), /^[0-9a-f]{8}$/);
  assert.strictEqual(fingerabdruck(datei()), fingerabdruck(datei()));
});

test('Fingerabdruck einer Datei: plus 2 → 3 und jedes andere Feld der Liste ergibt einen anderen (FA 8, AK 5, m8)', () => {
  const grund = fingerabdruck(datei());
  const varianten = { plus: 3, minus: 2, status: 'A', alt: 'src/b.rs', neu: 'src/c.rs', binaer: true };
  for (const [feld, anders] of Object.entries(varianten)) assert.notStrictEqual(fingerabdruck(datei({ [feld]: anders })), grund, feld);
});

test('Fingerabdruck nie über patch: mit, ohne und anderem patch, mit und ohne nachladen/gross derselbe (ADR-0042 N3, AK 5, m7)', () => {
  const grund = fingerabdruck(datei());
  const ohne = datei();
  delete ohne.patch;
  for (const d of [ohne, datei({ patch: null }), datei({ patch: '@@ anders @@\n+q\n' }), datei({ patch: null, nachladen: true }), datei({ patch: null, gross: true })]) {
    assert.strictEqual(fingerabdruck(d), grund);
  }
});

test('Fingerabdruck einer Folge: plus, minus, binaer und die Verweise der Schritte; ein dritter Schritt ergibt einen anderen, patch nie', () => {
  const zwei = folge([schritt('a'), schritt('b')]);
  const grund = fingerabdruck(zwei);
  assert.notStrictEqual(fingerabdruck(folge([schritt('a'), schritt('b'), schritt('c')])), grund);
  assert.notStrictEqual(fingerabdruck(folge([schritt('a'), schritt('c')])), grund, 'anderer Verweis eines Schritts');
  assert.notStrictEqual(fingerabdruck({ ...zwei, plus: 5 }), grund);
  assert.notStrictEqual(fingerabdruck({ ...zwei, minus: 3 }), grund);
  assert.notStrictEqual(fingerabdruck({ ...zwei, binaer: true }), grund);
  assert.strictEqual(fingerabdruck(folge([schritt('a', { patch: null, nachladen: true }), schritt('b', { patch: 'x' })])), grund);
});

/* ── B1291 Plan beim Laden mit gesehenen Dateien (FA 5, AK 3, m4) ── */

const { aufklappPlanSeite, BUDGET_ZEILEN } = require('../../web/diff.js');
const patchMit = n => '@@ -0,0 +1 @@\n' + '+x\n'.repeat(n - 1);
const mitZeilen = (pfad, n, zusatz = {}) => datei({ alt: pfad, neu: pfad, plus: n - 1, minus: 0, patch: patchMit(n), ...zusatz });
const voll = () => ({ rest: BUDGET_ZEILEN, gesperrt: false, erste: true });

test('Plan K-Budget: ohne Haken b, e, f, c offen (10.000), g zu; mit b und e gesehen f, c und g offen (7.501), b und e zu', () => {
  const dateien = [mitZeilen('src/b.rs', 2500), mitZeilen('src/d.rs', 601, { status: 'A' }), mitZeilen('src/e.rs', 2500), mitZeilen('src/f.rs', 2500), mitZeilen('tests/c.rs', 2500), mitZeilen('tests/g.rs', 2501), mitZeilen('Dokumentation/a.md', 2500)];
  const ohne = aufklappPlanSeite(dateien, [], voll());
  assert.deepStrictEqual(ohne.offen, [true, false, true, true, true, false, false]);
  const gesehen = [true, false, true, false, false, false, false];
  const mit = aufklappPlanSeite(dateien, [], voll(), gesehen);
  assert.deepStrictEqual(mit.offen, [false, false, false, true, true, true, false]);
  assert.deepStrictEqual(mit.budgetZu, [false, false, false, false, false, false, false], 'gesehene sind nicht wegen des Budgets zu');
  assert.strictEqual(mit.stand.rest, BUDGET_ZEILEN - 7501);
});

test('Plan: zwei Dateien zu je 12.000 Zeilen, die erste gesehen — die zweite öffnet als erste, die öffnen darf (AK 3)', () => {
  const dateien = [mitZeilen('src/x.rs', 12000), mitZeilen('src/y.rs', 12000)];
  assert.deepStrictEqual(aufklappPlanSeite(dateien, [], voll()).offen, [true, false]);
  const mit = aufklappPlanSeite(dateien, [], voll(), [true, false]);
  assert.deepStrictEqual(mit.offen, [false, true]);
  assert.strictEqual(mit.stand.erste, false);
});

test('Plan seitenweit: eine gesehene Datei unterbricht die Folge über Abschnitte nicht und trägt „erste“ weiter', () => {
  const kd = aufklappPlanSeite([mitZeilen('src/x.rs', 12000)], [], voll(), [true]);
  assert.deepStrictEqual(kd.stand, voll());
  assert.deepStrictEqual(aufklappPlanSeite([mitZeilen('src/y.rs', 12000)], [], kd.stand).offen, [true]);
});
