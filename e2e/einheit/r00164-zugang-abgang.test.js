// R00164 Burndown zeigt Zugang und Abgang je Tag (ADR-0027 N1, Karte #154) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const SPALTEN = ['Eingang', 'In Arbeit', 'Fertig'];
const z = (t, spalte, uhr = '09:00') => ({ zeitpunkt: `2026-11-${String(t).padStart(2, '0')} ${uhr}`, spalte });
const mittags = t => new Date(2026, 10, t, 12, 0).getTime();
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = x => ({ klasse: null, zustaendige: ['st'], labels: [], ...x });

/** Rechenbeispiel aus R00164: 02.11. #1 und #3 in „Eingang“, #2 in „In Arbeit“; 03.11. #4 angelegt, #5 angelegt und am selben
    Tag nach „Fertig“, #1 nach „Fertig“; 04.11. #2 in „In Arbeit“ archiviert, #1 zurück nach „In Arbeit“; 05.11. #1 und #3 nach
    „Fertig“, #5 in „Fertig“ archiviert. */
const beispiel = ({ ohne5 = false } = {}) => ({ spalten: SPALTEN, aufgaben: [
  { nummer: 1, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), z(4, 'In Arbeit'), z(5, 'Fertig')] },
  { nummer: 2, wechsel: [z(2, 'In Arbeit')] },
  { nummer: 3, wechsel: [z(2, 'Eingang'), z(5, 'Fertig')] },
  { nummer: 4, wechsel: [z(3, 'Eingang')] },
  { nummer: 5, wechsel: [z(3, 'Eingang'), z(3, 'Fertig', '15:00')], ...(ohne5 ? { reporting: { burndown: false } } : {}) },
] });
const ARCHIVTAGE = { 2: '2026-11-04', 5: '2026-11-05' };
const aufgabenBeispiel = nr => mitDatei(ARCHIVTAGE[nr] ? { archiviert: ARCHIVTAGE[nr] } : {});

const spalte = (tage, groesse) => tage.map(x => x[groesse]);
const summe = (tage, groesse) => spalte(tage, groesse).reduce((a, b) => a + b, 0);
/** AK 1: an jedem Tag ab dem zweiten gilt offen = offen(Vortag) + hinzugekommen − erledigt − entfernt. */
function erwarteBilanz(tage) {
  for (let i = 1; i < tage.length; i++) {
    const heute = tage[i], vortag = tage[i - 1];
    assert.strictEqual(heute.offen, vortag.offen + heute.hinzugekommen - heute.erledigt - heute.entfernt, `Bilanz am ${heute.datum}`);
  }
}

/* ── B0784 Ereignisse je Tag aus der Bestandsfunktion ── */
test('R00164 B0784 (AK 1–4): Rechenbeispiel 02.11.–05.11. — + 3·2·1·0, − erledigt 0·2·0·2, − entfernt 0·0·1·0 bei offen 3·3·3·1, Bilanz an jedem Tag', () => {
  const tage = B.burndown(beispiel(), filter({}), aufgabenBeispiel, mittags(5));
  assert.deepStrictEqual(spalte(tage, 'datum'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepStrictEqual(spalte(tage, 'hinzugekommen'), [3, 2, 1, 0]);
  assert.deepStrictEqual(spalte(tage, 'erledigt'), [0, 2, 0, 2]);
  assert.deepStrictEqual(spalte(tage, 'entfernt'), [0, 0, 1, 0]);
  assert.deepStrictEqual(spalte(tage, 'offen'), [3, 3, 3, 1]);
  assert.deepStrictEqual(spalte(tage, 'umfang'), [3, 5, 4, 4]);
  assert.deepStrictEqual([summe(tage, 'hinzugekommen'), summe(tage, 'erledigt'), summe(tage, 'entfernt')], [6, 4, 1]);
  erwarteBilanz(tage);
});

test('R00164 B0784 (AK 2): in derselben Minute angelegt und erledigt zählt in „+“ und in „− erledigt“', () => {
  const bew = { spalten: SPALTEN, aufgaben: [{ nummer: 1, wechsel: [z(2, 'Eingang')] }, { nummer: 2, wechsel: [z(3, 'Eingang'), z(3, 'Fertig')] }] };
  const tage = B.burndown(bew, filter({}), () => mitDatei({}), mittags(3));
  assert.deepStrictEqual(tage.map(x => [x.offen, x.hinzugekommen, x.erledigt, x.entfernt]), [[1, 1, 0, 0], [1, 1, 1, 0]]);
});

test('R00164 B0784 (AK 3, AK 4; ADR-0027 N1 Punkt 2): alle Übergänge — Bilanz an jedem Tag', () => {
  const bew = { spalten: SPALTEN, aufgaben: [
    { nummer: 1, wechsel: [z(2, 'Eingang')] },                                      // bleibt offen
    { nummer: 2, wechsel: [z(2, 'Eingang'), z(3, null)] },                          // offen vom Board genommen
    { nummer: 3, wechsel: [z(2, 'Eingang'), z(4, null)] },                          // offen gelöscht (keine Datei)
    { nummer: 4, wechsel: [z(2, 'Eingang')] },                                      // offen archiviert am 05.11.
    { nummer: 5, wechsel: [z(2, 'Eingang'), z(3, 'Fertig')] },                      // erledigt, am 05.11. archiviert
    { nummer: 6, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), z(6, null)] },          // erledigt vom Board genommen
    { nummer: 7, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), z(6, 'In Arbeit')] },   // Rückläufer
    { nummer: 8, wechsel: [z(4, 'Fertig')] },                                       // direkt in der Abschlussspalte angelegt
    { nummer: 9, wechsel: [z(3, null), z(4, 'Eingang')] },                          // kommt aufs Board zurück
  ] };
  const archivtage = { 4: '2026-11-05', 5: '2026-11-05' };
  const liste = nr => nr === 3 ? undefined : mitDatei(archivtage[nr] ? { archiviert: archivtage[nr] } : {});
  const tage = B.burndown(bew, filter({}), liste, mittags(6));
  assert.deepStrictEqual(tage.map(x => [x.datum.slice(8), x.hinzugekommen, x.erledigt, x.entfernt, x.offen]), [
    ['02', 7, 0, 0, 7],
    ['03', 0, 3, 1, 3],   // #5, #6, #7 erledigt; #2 vom Board
    ['04', 1, 0, 1, 3],   // #9 neu; #3 gelöscht; #8 direkt fertig: kein Ereignis
    ['05', 0, 0, 1, 2],   // #4 offen archiviert; #5 erledigt archiviert: kein Ereignis
    ['06', 1, 0, 0, 3],   // #7 zurück; #6 erledigt vom Board: kein Ereignis
  ]);
  erwarteBilanz(tage);
});

test('R00164 B0784 (US-4): ein Tag ohne Ereignis trägt dreimal 0', () => {
  const bew = { spalten: SPALTEN, aufgaben: [{ nummer: 1, wechsel: [z(2, 'Eingang')] }] };
  const tage = B.burndown(bew, filter({}), () => mitDatei({}), mittags(3));
  assert.deepStrictEqual([tage[1].hinzugekommen, tage[1].erledigt, tage[1].entfernt], [0, 0, 0]);
});

module.exports = { beispiel, aufgabenBeispiel, filter, mittags, spalte, summe, erwarteBilanz };
