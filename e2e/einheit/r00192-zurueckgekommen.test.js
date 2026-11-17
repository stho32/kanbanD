// R00192 Burndown nennt Rückläufer als Teil von „+ hinzugekommen“ (Karte #195) — node --test
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
const beispiel = () => ({ spalten: SPALTEN, aufgaben: [
  { nummer: 1, wechsel: [z(2, 'Eingang'), z(3, 'Fertig'), z(4, 'In Arbeit'), z(5, 'Fertig')] },
  { nummer: 2, wechsel: [z(2, 'In Arbeit')] },
  { nummer: 3, wechsel: [z(2, 'Eingang'), z(5, 'Fertig')] },
  { nummer: 4, wechsel: [z(3, 'Eingang')] },
  { nummer: 5, wechsel: [z(3, 'Eingang'), z(3, 'Fertig', '15:00')] },
] });
const ARCHIVTAGE = { 2: '2026-11-04', 5: '2026-11-05' };
const aufgabenBeispiel = nr => mitDatei(ARCHIVTAGE[nr] ? { archiviert: ARCHIVTAGE[nr] } : {});

const spalte = (tage, groesse) => tage.map(x => x[groesse]);
const summe = (tage, groesse) => spalte(tage, groesse).reduce((a, b) => a + b, 0);
/** AK 5: „davon zurückgekommen“ ist an jedem Tag höchstens „+“. */
function erwarteTeilmenge(tage) {
  for (const x of tage) assert.ok(x.zurueckgekommen <= x.hinzugekommen, `${x.datum}: ${x.zurueckgekommen} ≤ ${x.hinzugekommen}`);
}
/** Ein Board mit diesen Aufgaben (je Aufgabe ihre Wechsel), ohne Archiv. */
const board = (...wechselJeAufgabe) => ({ spalten: SPALTEN, aufgaben: wechselJeAufgabe.map((wechsel, i) => ({ nummer: i + 1, wechsel })) });
const tageVon = (bew, bis, f = {}, liste = () => mitDatei({})) => B.burndown(bew, filter(f), liste, mittags(bis));

/* ── B0939 Rückläufer je Tag aus der Ereignisfunktion ── */
test('R00192 B0939 (AK 2): Rechenbeispiel — „+“ 3·2·1·0, davon zurückgekommen 0·0·1·0; Summen + 6, davon zurückgekommen 1', () => {
  const tage = B.burndown(beispiel(), filter({}), aufgabenBeispiel, mittags(5));
  assert.deepStrictEqual(spalte(tage, 'datum'), ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']);
  assert.deepStrictEqual(spalte(tage, 'hinzugekommen'), [3, 2, 1, 0]);
  assert.deepStrictEqual(spalte(tage, 'zurueckgekommen'), [0, 0, 1, 0]);
  assert.deepStrictEqual([summe(tage, 'hinzugekommen'), summe(tage, 'zurueckgekommen')], [6, 1]);
  erwarteTeilmenge(tage);
});

test('R00192 B0939 (AK 5): Bilanz, „offen“, „Umfang“ und die drei Posten des Rechenbeispiels bleiben wie in R00164', () => {
  const tage = B.burndown(beispiel(), filter({}), aufgabenBeispiel, mittags(5));
  assert.deepStrictEqual(tage.map(x => [x.offen, x.umfang, x.hinzugekommen, x.erledigt, x.entfernt]),
    [[3, 3, 3, 0, 0], [3, 5, 2, 2, 0], [3, 4, 1, 0, 1], [1, 4, 0, 2, 0]]);
});

test('R00192 B0939 (AK 1): Rückläufer ist nur, wer unmittelbar davor erledigt im Bestand war — aus „Fertig“ nach „In Arbeit“ und nach „Eingang“', () => {
  const tage = tageVon(board(
    [z(2, 'Eingang'), z(3, 'Fertig'), z(4, 'In Arbeit')],
    [z(2, 'Eingang'), z(3, 'Fertig'), z(4, 'Eingang')],
  ), 4);
  assert.deepStrictEqual(tage.map(x => [x.hinzugekommen, x.zurueckgekommen]), [[2, 0], [0, 0], [2, 2]]);
});

test('R00192 B0939 (AK 1): kein Rückläufer — neu angelegt, vom Board genommen und zurück, aus der ausgeschlossenen Spalte eingetreten', () => {
  const neu = tageVon(board([z(2, 'Eingang')], [z(3, 'In Arbeit')]), 3);
  assert.deepStrictEqual(neu.map(x => [x.hinzugekommen, x.zurueckgekommen]), [[1, 0], [1, 0]], 'neu angelegt');
  const vomBoard = tageVon(board([z(2, 'Eingang'), z(3, 'Fertig'), z(4, null), z(5, 'In Arbeit')]), 5);
  assert.deepStrictEqual(vomBoard.map(x => [x.hinzugekommen, x.zurueckgekommen]), [[1, 0], [0, 0], [0, 0], [1, 0]], 'erledigt vom Board genommen und zurück');
  const eingetreten = tageVon(board([z(2, 'Eingang'), z(3, 'In Arbeit')]), 3, { ohneSpalten: ['Eingang'] });
  assert.deepStrictEqual(eingetreten.map(x => [x.hinzugekommen, x.zurueckgekommen]), [[0, 0], [1, 0]], 'in eine gezählte Spalte eingetreten');
});

test('R00192 B0939 (AK 1): aus dem Archiv — eine in „Fertig“ archivierte Aufgabe, die danach nach links zieht, ist verworfen statt offen: kein „+“, kein Rückläufer', () => {
  // Das Archiv kennt nur einen Archivtag: eine zurückgeholte Aufgabe trägt keinen mehr und wird gelesen, als wäre sie nie archiviert
  // gewesen — es bleibt kein Übergang, der zählen könnte. Darstellbar ist der Zug nach links nach dem Archivtag.
  const bew = board([z(2, 'Eingang'), z(3, 'Fertig'), z(5, 'In Arbeit')]);
  const tage = tageVon(bew, 5, {}, () => mitDatei({ archiviert: '2026-11-04' }));
  assert.deepStrictEqual(tage.map(x => [x.hinzugekommen, x.zurueckgekommen, x.entfernt]), [[1, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]);
});

test('R00192 B0939 (AK 1): erledigt in einer ausgeschlossenen Spalte war nicht im Bestand — der Zug nach links ist „+“, kein Rückläufer', () => {
  const tage = tageVon(board([z(2, 'Eingang'), z(3, 'Fertig'), z(4, 'In Arbeit')]), 4, { ohneSpalten: ['Fertig'] });
  assert.deepStrictEqual(tage.map(x => [x.hinzugekommen, x.zurueckgekommen]), [[1, 0], [0, 0], [1, 0]]);
});

test('R00192 B0939 (AK 5): zweimal am selben Tag zurück zählt zweimal, wie „+“; R00164 „alle Übergänge“ hat genau den einen Rückläufer #7', () => {
  const zweimal = tageVon(board([z(2, 'Eingang'), z(3, 'Fertig', '09:00'), z(3, 'In Arbeit', '10:00'), z(3, 'Fertig', '11:00'), z(3, 'Eingang', '12:00')]), 3);
  assert.deepStrictEqual(zweimal.map(x => [x.hinzugekommen, x.zurueckgekommen, x.erledigt]), [[1, 0, 0], [2, 2, 2]]);
  const alle = board(
    [z(2, 'Eingang')], [z(2, 'Eingang'), z(3, null)], [z(2, 'Eingang'), z(4, null)], [z(2, 'Eingang')],
    [z(2, 'Eingang'), z(3, 'Fertig')], [z(2, 'Eingang'), z(3, 'Fertig'), z(6, null)], [z(2, 'Eingang'), z(3, 'Fertig'), z(6, 'In Arbeit')],
    [z(4, 'Fertig')], [z(3, null), z(4, 'Eingang')],
  );
  const archivtage = { 4: '2026-11-05', 5: '2026-11-05' };
  const tage = B.burndown(alle, filter({}), nr => nr === 3 ? undefined : mitDatei(archivtage[nr] ? { archiviert: archivtage[nr] } : {}), mittags(6));
  assert.deepStrictEqual(spalte(tage, 'hinzugekommen'), [7, 0, 1, 0, 1]);
  assert.deepStrictEqual(spalte(tage, 'zurueckgekommen'), [0, 0, 0, 0, 1]);
  erwarteTeilmenge(tage);
});

test('R00192 B0939 (AK 5): ein Tag ohne Ereignis trägt auch „davon zurückgekommen“ 0', () => {
  const tage = tageVon(board([z(2, 'Eingang')]), 3);
  assert.deepStrictEqual(tage.map(x => x.zurueckgekommen), [0, 0]);
});

/* ── B0940 Zielblock, Filter und `reporting.burndown` wirken auf die Teilmenge ── */
/** AK 6: das Rechenbeispiel, nur zieht #2 am 04.11. von „In Arbeit“ nach „Eingang“, statt dort archiviert zu werden. */
const beispielZweiZurueck = ({ ohne1 = false } = {}) => {
  const bew = beispiel();
  bew.aufgaben[1] = { nummer: 2, wechsel: [z(2, 'In Arbeit'), z(4, 'Eingang')] };
  if (ohne1) bew.aufgaben[0] = { ...bew.aufgaben[0], reporting: { burndown: false } };
  return bew;
};
const ohneArchiv2 = nr => nr === 2 ? mitDatei({}) : aufgabenBeispiel(nr);
const zurueckJeTag = (bew, f = {}, zielblock = null, liste = ohneArchiv2) =>
  spalte(B.burndown(bew, filter(f), liste, mittags(5), null, zielblock), 'zurueckgekommen');

test('R00192 B0940 (AK 6): Zielblock „In Arbeit“ — #2 zieht am 04.11. aus dem Block nach „Eingang“ und ist Rückläufer; ohne Wahl nicht', () => {
  assert.deepStrictEqual(zurueckJeTag(beispielZweiZurueck({ ohne1: true }), {}, 'In Arbeit'), [0, 0, 1, 0]);
  assert.deepStrictEqual(zurueckJeTag(beispielZweiZurueck({ ohne1: true }), {}, null), [0, 0, 0, 0]);
  const mitBlock = B.burndown(beispielZweiZurueck(), filter({}), ohneArchiv2, mittags(5), null, 'In Arbeit');
  assert.deepStrictEqual(mitBlock.map(x => [x.hinzugekommen, x.zurueckgekommen, x.erledigt]), [[2, 0, 0], [2, 0, 2], [1, 1, 0], [0, 0, 1]],
    'mit Block zählt #2 statt #1: der Zug von „Fertig“ nach „In Arbeit“ bleibt im Block');
  erwarteTeilmenge(mitBlock);
});

test('R00192 B0940 (AK 5): „Eingang“ ausgeschlossen — mit Zielblock zieht #2 aus dem Bestand (kein „+“), ohne Wahl ist #1 der Rückläufer am 04.11.', () => {
  assert.deepStrictEqual(zurueckJeTag(beispielZweiZurueck({ ohne1: true }), { ohneSpalten: ['Eingang'] }, 'In Arbeit'), [0, 0, 0, 0]);
  const tage = B.burndown(beispiel(), filter({ ohneSpalten: ['Eingang'] }), aufgabenBeispiel, mittags(5));
  assert.deepStrictEqual(tage.map(x => [x.hinzugekommen, x.zurueckgekommen]), [[1, 0], [0, 0], [1, 1], [0, 0]]);
});

test('R00192 B0940 (AK 5): Personenfilter und reporting.burndown wählen für „davon zurückgekommen“ dieselben Aufgaben wie für „+“', () => {
  const liste = nr => ({ ...aufgabenBeispiel(nr), zustaendige: nr === 1 ? ['st'] : ['ki'] });
  const zahlen = f => B.burndown(beispiel(), filter(f), liste, mittags(5)).map(x => [x.hinzugekommen, x.zurueckgekommen]);
  assert.deepStrictEqual(zahlen({ personen: ['st'] }), [[1, 0], [0, 0], [1, 1], [0, 0]]);
  assert.deepStrictEqual(zahlen({ personen: ['ki'] }), [[2, 0], [2, 0], [0, 0], [0, 0]]);
  const ohne1 = { ...beispiel(), aufgaben: beispiel().aufgaben.map(a => a.nummer === 1 ? { ...a, reporting: { burndown: false } } : a) };
  assert.deepStrictEqual(spalte(B.burndown(ohne1, filter({}), aufgabenBeispiel, mittags(5)), 'zurueckgekommen'), [0, 0, 0, 0]);
});

test('R00192 B0940 (AK 5): Zeitraum 04.–05.11. und „Rechnen ab“ 04.11. — davon zurückgekommen 1 · 0', () => {
  const zeitraum = B.burndown(beispiel(), filter({ zeitraum: 'eigen', von: '2026-11-04', bis: '2026-11-05' }), aufgabenBeispiel, mittags(5));
  assert.deepStrictEqual(spalte(zeitraum, 'zurueckgekommen'), [1, 0]);
  const rechnenAb = B.burndown(beispiel(), filter({}), aufgabenBeispiel, mittags(5), '2026-11-04');
  assert.deepStrictEqual(spalte(rechnenAb, 'zurueckgekommen'), [1, 0]);
});
