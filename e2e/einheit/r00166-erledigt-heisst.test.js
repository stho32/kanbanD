// R00166 „Erledigt heißt“ je Board — gilt für Burndown, Durchsatz und Fever Chart (ADR-0027 N2, Karte #156) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const z = (t, spalte) => ({ zeitpunkt: `2026-11-0${t} 09:00`, spalte });
const um9 = t => new Date(2026, 10, t, 9, 0).getTime();
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = () => ({ klasse: null, zustaendige: ['st'], labels: [] });
const JETZT = new Date(2026, 10, 4, 12, 0).getTime();

/** Rechenbeispiel aus R00166: Spalten A · B · C · Erledigt; 02.11. #1 bis #3 in A; 03.11. #1 und #2 nach B, #3 nach Erledigt;
    04.11. #1 weiter nach C, #2 zurück nach A. */
const beispiel = () => ({ spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [
  { nummer: 1, wechsel: [z(2, 'A'), z(3, 'B'), z(4, 'C')] },
  { nummer: 2, wechsel: [z(2, 'A'), z(3, 'B'), z(4, 'A')] },
  { nummer: 3, wechsel: [z(2, 'A'), z(3, 'Erledigt')] },
] });

const jeTag = tage => tage.map(x => [x.hinzugekommen, x.erledigt, x.offen]);
const burndown = zielblock => jeTag(B.burndown(beispiel(), filter({}), mitDatei, JETZT, null, zielblock));
const durchsatz = zielblock => B.durchsatz(beispiel(), filter({}), mitDatei, JETZT, null, 'tag', zielblock).perioden.map(p => p.anzahl);
/** Die Berichte, die der Zielspalte bis Karte #159 nicht folgen — in der Form, in der sie am Stand vor der Karte festgehalten sind. */
function fremdeBerichte() {
  const bew = beispiel(), f = filter({}), p = B.prognose(bew, f, mitDatei, JETZT, null);
  return {
    fluss: B.fluss(bew, f, mitDatei, JETZT).tage.map(x => [x.jeSpalte, x.offen, x.gesamt, x.angekommen, x.fertig]),
    durchlaufzeit: B.durchlaufzeiten(bew, f, mitDatei, JETZT, 'A', 'Erledigt'),
    prognose: [p.umfang, p.phasen.map(x => [x.schluessel, x.nenner, x.erreicht, x.offen, x.laeufe])],
    fieberOhneWahl: B.fieberTag(bew, f, mitDatei, '2026-11-04', null, '2026-11-02'),
    fieberMitB: B.fieberTag(bew, f, mitDatei, '2026-11-04', null, '2026-11-02', 'B'),
    ausgenommen: B.ausgenommen(bew, 'burndown', f, mitDatei, JETZT),
  };
}
/** Stand vor der Karte (main, 80c0735), mit `fremdeBerichte` am unveränderten Code gerechnet und hier festgehalten. */
const KEINE_AUSSAGE = [null, null, null, null];
const VOR_DER_KARTE = {
  fluss: [
    [{ A: 3, B: 0, C: 0, Erledigt: 0 }, 3, 3, 3, 0],
    [{ A: 0, B: 2, C: 0, Erledigt: 1 }, 2, 3, 3, 1],
    [{ A: 1, B: 0, C: 1, Erledigt: 1 }, 2, 3, 3, 1],
  ],
  durchlaufzeit: { liste: [{ nummer: 3, eintritt: um9(2), ankunft: um9(3), tage: 1 }], anzahl: 1, gueltig: true, mittel: 1, median: 1, p85: 1 },
  prognose: [3, [['B', 3, 2, 1, 3], ['C', 3, 2, 1, 2], ['Erledigt', 3, 1, 2, 1]]],
  fieberOhneWahl: { datum: '2026-11-04', erledigt: 1, umfang: 3, ende7: KEINE_AUSSAGE, ende5: KEINE_AUSSAGE },
  fieberMitB: { datum: '2026-11-04', erledigt: 2, umfang: 3, ende7: ['2026-11-06', '2026-11-07', '2026-11-09', '2026-11-12'], ende5: ['2026-11-06', '2026-11-09', '2026-11-11', '2026-11-16'] },
  ausgenommen: 0,
};
const OHNE_WAHL = { burndown: [[3, 0, 3], [0, 1, 2], [0, 0, 2]], durchsatz: [0, 1, 0] };
const MIT_B = { burndown: [[3, 0, 3], [0, 3, 0], [1, 0, 1]], durchsatz: [0, 3, 0] };

/* ── B0803 Test an der Trennstelle (ADR-0027 N2 Punkt 8) ── */
test('R00166 B0803 (AK 7): ohne Wahl rechnen alle Berichte wie vor der Karte — + · − erledigt · offen 3·0·3, 0·1·2, 0·0·2 und Durchsatz 0·1·0', () => {
  assert.deepStrictEqual(burndown(undefined), OHNE_WAHL.burndown);
  assert.deepStrictEqual(durchsatz(undefined), OHNE_WAHL.durchsatz);
  assert.deepStrictEqual(fremdeBerichte(), VOR_DER_KARTE);
});

test('R00166 B0803 (AK 1–3, AK 8): mit Zielspalte B ändern sich nur Burndown (3·0·3, 0·3·0, 1·0·1) und Durchsatz (0·3·0)', { todo: 'erwartet rot bis B0806: Burndown und Durchsatz folgen der Wahl noch nicht' }, () => {
  assert.deepStrictEqual(burndown('B'), MIT_B.burndown);
  assert.deepStrictEqual(durchsatz('B'), MIT_B.durchsatz);
  assert.deepStrictEqual(fremdeBerichte(), VOR_DER_KARTE, 'Kumulativer Fluss, Durchlaufzeit, „Wie lange noch“ und Fever Chart rechnen nach einem Lauf mit Wahl wie vorher');
  assert.deepStrictEqual(burndown(undefined), OHNE_WAHL.burndown, 'die Wahl eines Aufrufs bleibt nicht hängen');
  assert.deepStrictEqual(durchsatz(undefined), OHNE_WAHL.durchsatz);
});

/* ── B0804 Zielblock des Boards an einer Stelle auflösen (ADR-0027 N2 Punkt 2) ── */
const PHASEN = { anwendung: 'kd', folge: [{ nr: 1, name: 'Entwicklung' }, { nr: 2, name: 'Entwicklertest' }, { nr: 3, name: 'Abnahme' }], spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
const mitPhasen = () => ({ spalten: ['Eingang', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'], phasen: PHASEN, aufgaben: [] });
const kern = zb => ({ gewaehlt: zb.gewaehlt, zaehlt: zb.zaehlt.schluessel, verschwunden: zb.verschwunden, standard: zb.standard });

test('R00166 B0804 (AK 6): die gespeicherte Zielspalte B ist der Block, der zählt — die Blöcke sind die des Fever Charts', () => {
  const zb = B.zielblock(beispiel(), filter({}), 'B');
  assert.deepStrictEqual(kern(zb), { gewaehlt: 'B', zaehlt: 'B', verschwunden: null, standard: 'Erledigt' });
  assert.deepStrictEqual(zb.bloecke, B.fieberBloecke(beispiel(), filter({}), undefined));
  assert.deepStrictEqual(zb.bloecke.map(x => x.titel), ['Spalte „B“', 'Spalte „C“', 'Spalte „Erledigt“']);
});

test('R00166 B0804 (AK 7): ohne Wahl und mit der Abschlussspalte als Wahl ist nichts gewählt, es zählt der letzte Block', () => {
  for (const zielspalte of [null, undefined, '', 'Erledigt']) {
    assert.deepStrictEqual(kern(B.zielblock(beispiel(), filter({}), zielspalte)), { gewaehlt: null, zaehlt: 'Erledigt', verschwunden: null, standard: 'Erledigt' }, `Zielspalte ${zielspalte}`);
  }
});

test('R00166 B0804 (AK 9): eine Spalte, die es nicht gibt oder die der Berichtsfilter ausschließt, ist verschwunden — es zählt der letzte Block', () => {
  assert.deepStrictEqual(kern(B.zielblock(beispiel(), filter({}), 'Abnahme')), { gewaehlt: null, zaehlt: 'Erledigt', verschwunden: 'Abnahme', standard: 'Erledigt' });
  assert.deepStrictEqual(kern(B.zielblock(beispiel(), filter({ ohneSpalten: ['B'] }), 'B')), { gewaehlt: null, zaehlt: 'Erledigt', verschwunden: 'B', standard: 'Erledigt' });
});

test('R00166 B0804 (AK 4): auf einem Board mit Phasen sind die Blöcke die Phasen, Standard ist die letzte Phase', () => {
  const zb = B.zielblock(mitPhasen(), filter({}), 'Entwicklertest');
  assert.deepStrictEqual(kern(zb), { gewaehlt: 'Entwicklertest', zaehlt: 'Entwicklertest', verschwunden: null, standard: 'Abnahme' });
  assert.deepStrictEqual(zb.bloecke.map(x => x.titel), ['Entwicklung durchlaufen', 'Entwicklertest durchlaufen', 'Abnahme durchlaufen']);
  assert.strictEqual(B.zielblock(mitPhasen(), filter({}), 'Abnahme').gewaehlt, null);
});
