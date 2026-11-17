// R00194 Burndown nennt, wie viel vom Zugang selbsterzeugt ist (Karte #197) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const SPALTEN = ['Eingang', 'In Arbeit', 'Fertig'];
const z = (t, spalte, uhr = '09:00') => ({ zeitpunkt: `2026-11-${String(t).padStart(2, '0')} ${uhr}`, spalte });
const mittags = t => new Date(2026, 10, t, 12, 0).getTime();
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = x => ({ klasse: null, zustaendige: ['st'], labels: [], ...x });

/** Rechenbeispiel aus R00164 (wie in R00192): #1 zieht am 04.11. aus „Fertig“ zurück; #2 am 04.11. archiviert, #5 am 05.11. */
const beispiel = () => ({ spalten: SPALTEN, aufgaben: [
  { nummer: 1, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), z(4, 'In Arbeit'), z(5, 'Fertig')] },
  { nummer: 2, wechsel: [z(2, 'In Arbeit')] },
  { nummer: 3, wechsel: [z(2, 'Eingang'), z(5, 'Fertig')] },
  { nummer: 4, wechsel: [z(3, 'Eingang')] },
  { nummer: 5, wechsel: [z(3, 'Eingang'), z(3, 'Fertig', '15:00')] },
] });
const ARCHIVTAGE = { 2: '2026-11-04', 5: '2026-11-05' };
/** Die Aufgaben mit ihren heutigen Labels: #3 und #4 tragen `befund` (R00194 Ausgangslage), dazu je Nummer weitere. */
const aufgabenMit = (labels = { 3: ['befund'], 4: ['befund'] }) => nr => mitDatei({ labels: labels[nr] || [], ...(ARCHIVTAGE[nr] ? { archiviert: ARCHIVTAGE[nr] } : {}) });

const spalte = (tage, groesse) => tage.map(x => x[groesse]);
const summe = (tage, groesse) => spalte(tage, groesse).reduce((a, b) => a + b, 0);
const neu = x => x.hinzugekommen - x.selbsterzeugt - x.zurueckgekommen;
/** AK 2: jedes „+“ ist genau eines von neu, selbsterzeugt, zurückgekommen — keines negativ, die Summe der drei ist „+“. */
function erwarteZerlegung(tage) {
  for (const x of tage) {
    assert.ok(x.selbsterzeugt >= 0 && x.zurueckgekommen >= 0 && neu(x) >= 0, `${x.datum}: ${JSON.stringify(x)}`);
    assert.strictEqual(neu(x) + x.selbsterzeugt + x.zurueckgekommen, x.hinzugekommen, `Summe am ${x.datum}`);
  }
}
const tageMit = (selbstlabels, { f = {}, liste = aufgabenMit(), zielblock = null } = {}) =>
  B.burndown(beispiel(), filter(f), liste, mittags(5), null, zielblock, selbstlabels);

/* ── B0953 Selbsterzeugt je Tag aus der Ereignisfunktion ── */
test('R00194 B0953 (AK 3): Rechenbeispiel mit `befund` — davon selbsterzeugt 1·1·0·0; Summe + 6: selbsterzeugt 2, zurückgekommen 1, Neues 3', () => {
  const tage = tageMit(['befund']);
  assert.deepStrictEqual(spalte(tage, 'datum'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepStrictEqual(spalte(tage, 'hinzugekommen'), [3, 2, 1, 0]);
  assert.deepStrictEqual(spalte(tage, 'selbsterzeugt'), [1, 1, 0, 0]);
  assert.deepStrictEqual(spalte(tage, 'zurueckgekommen'), [0, 0, 1, 0]);
  assert.deepStrictEqual([summe(tage, 'hinzugekommen'), summe(tage, 'selbsterzeugt'), summe(tage, 'zurueckgekommen'), tage.map(neu).reduce((a, b) => a + b, 0)], [6, 2, 1, 3]);
  erwarteZerlegung(tage);
});

test('R00194 B0953 (AK 2): ein Rückläufer ist nie selbsterzeugt — auch wenn er ein gewähltes Label trägt', () => {
  const tage = tageMit(['befund'], { liste: aufgabenMit({ 1: ['befund'], 3: ['befund'], 4: ['befund'] }) });
  assert.deepStrictEqual(spalte(tage, 'selbsterzeugt'), [2, 1, 0, 0], '#1 am 02.11. neu angelegt zählt, am 04.11. als Rückläufer nicht');
  assert.deepStrictEqual(spalte(tage, 'zurueckgekommen'), [0, 0, 1, 0]);
  erwarteZerlegung(tage);
});

test('R00194 B0953 (AK 2): mehrere gewählte Labels — eines genügt; jede Aufgabe zählt je „+“ einmal', () => {
  const tage = tageMit(['befund', 'härtung'], { liste: aufgabenMit({ 2: ['härtung'], 3: ['befund', 'härtung'], 4: ['befund'] }) });
  assert.deepStrictEqual(spalte(tage, 'selbsterzeugt'), [2, 1, 0, 0]);
  erwarteZerlegung(tage);
});

test('R00194 B0953 (AK 3): Berichtsfilter Label und Zeitraum wirken auf die Zahl wie auf „+“', () => {
  const nurBefund = tageMit(['befund'], { f: { labels: ['befund'] } });
  assert.deepStrictEqual(nurBefund.map(x => [x.hinzugekommen, x.selbsterzeugt]), [[1, 1], [1, 1], [0, 0], [0, 0]]);
  const zeitraum = tageMit(['befund'], { f: { zeitraum: 'eigen', von: '2026-11-03', bis: '2026-11-04' } });
  assert.deepStrictEqual(zeitraum.map(x => [x.datum, x.hinzugekommen, x.selbsterzeugt, x.zurueckgekommen]), [['2026-11-03', 2, 1, 0], ['2026-11-04', 1, 0, 1]]);
  erwarteZerlegung(nurBefund);
  erwarteZerlegung(zeitraum);
});

test('R00194 B0953 (AK 6): ohne Wahl ist selbsterzeugt an jedem Tag 0, alle übrigen Zahlen bleiben wie vorher', () => {
  const vorher = B.burndown(beispiel(), filter({}), aufgabenMit(), mittags(5));
  const ohne = tageMit([]);
  assert.deepStrictEqual(spalte(ohne, 'selbsterzeugt'), [0, 0, 0, 0]);
  assert.deepStrictEqual(spalte(vorher, 'selbsterzeugt'), [0, 0, 0, 0], 'der Aufruf ohne Labels gibt 0');
  const ohneTeilmengen = tage => tage.map(({ selbsterzeugt, ...rest }) => rest);
  assert.deepStrictEqual(ohneTeilmengen(tageMit(['befund'])), ohneTeilmengen(vorher), 'die Wahl ändert keine andere Zahl');
});

test('R00194 B0953 (AK 5): ein Label, das keine Aufgabe trägt, ergibt 0 ohne Fehler; eine Aufgabe ohne Datei ist nie selbsterzeugt', () => {
  assert.deepStrictEqual(spalte(tageMit(['gibt-es-nicht']), 'selbsterzeugt'), [0, 0, 0, 0]);
  const ohneDatei = tageMit(['befund'], { liste: nr => nr === 3 ? undefined : aufgabenMit()(nr) });
  assert.deepStrictEqual(spalte(ohneDatei, 'selbsterzeugt'), [0, 1, 0, 0]);
  erwarteZerlegung(ohneDatei);
});
