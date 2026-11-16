// R00167 Durchsatz: Von-Spalte wählbar, Zugang je Periode als zweiter Balken (ADR-0027 N3, Karte #157) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const z = (t, spalte) => ({ zeitpunkt: `2026-11-0${t} 09:00`, spalte });
const um9 = t => new Date(2026, 10, t, 9, 0).getTime();
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = () => ({ klasse: null, zustaendige: ['st'], labels: [] });
const JETZT = new Date(2026, 10, 4, 12, 0).getTime();

/** Rechenbeispiel aus R00167: Backlog · Arbeit · Erledigt; 02.11. #1 bis #3 im Backlog; 03.11. #1 und #2 nach Arbeit;
    04.11. #1 nach Erledigt, #2 zurück in den Backlog und wieder nach Arbeit. */
const beispiel = () => ({ spalten: ['Backlog', 'Arbeit', 'Erledigt'], aufgaben: [
  { nummer: 1, wechsel: [z(2, 'Backlog'), z(3, 'Arbeit'), z(4, 'Erledigt')] },
  { nummer: 2, wechsel: [z(2, 'Backlog'), z(3, 'Arbeit'), { zeitpunkt: '2026-11-04 08:00', spalte: 'Backlog' }, z(4, 'Arbeit')] },
  { nummer: 3, wechsel: [z(2, 'Backlog')] },
] });
const PHASEN = { anwendung: 'kd', folge: [{ nr: 1, name: 'Entwicklung' }, { nr: 2, name: 'Entwicklertest' }, { nr: 3, name: 'Abnahme' }], spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
const mitPhasen = () => ({ spalten: ['Eingang', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'], phasen: PHASEN, aufgaben: [] });

/* ── B0816 Test an der Trennstelle (ADR-0027 N3 Punkt 6) ── */
/** Alle Berichte eines Boards, verdrahtet wie in web/ansicht.js: Zielblock und Von-Block aus `board.fieber`, die Von-Wahl geht
    allein an `durchsatz()`. `zugang` sind die Felder, die es vor der Karte nicht gab; alles andere ist `bestand`. */
function berichteDesBoards(board, bew = beispiel()) {
  const f = filter({}), ziel = B.zielblock(bew, f, board.fieber.zielspalte), zielSchluessel = ziel.block && ziel.block.schluessel;
  const von = B.vonblock(bew, f, board.fieber.vonspalte, ziel.zaehlt.schluessel);
  const d = B.durchsatz(bew, f, mitDatei, JETZT, null, 'tag', ziel.gewaehlt, von.gewaehlt);
  const p = B.prognose(bew, f, mitDatei, JETZT, null);
  return {
    zugang: { jePeriode: d.perioden.map(x => x.zugang), gesamt: d.zugangGesamt, durchschnitt: d.zugangDurchschnitt },
    bestand: {
      abgang: { jePeriode: d.perioden.map(x => x.anzahl), gesamt: d.gesamt, durchschnitt: d.durchschnitt, ausgenommen: d.ausgenommen, ziel: d.ziel.name },
      burndown: B.burndown(bew, f, mitDatei, JETZT, null, ziel.gewaehlt).map(x => [x.hinzugekommen, x.erledigt, x.entfernt, x.offen, x.umfang]),
      fluss: B.fluss(bew, f, mitDatei, JETZT).tage.map(x => [x.jeSpalte, x.offen, x.gesamt, x.angekommen, x.fertig]),
      durchlaufzeit: B.durchlaufzeiten(bew, f, mitDatei, JETZT, 'Backlog', 'Erledigt'),
      prognose: [p.umfang, p.phasen.map(x => [x.schluessel, x.nenner, x.erreicht, x.offen, x.laeufe])],
      fieberTag: B.fieberTag(bew, f, mitDatei, '2026-11-04', null, '2026-11-02', zielSchluessel),
      fieberSchluessel: B.fieberSchluessel('2026-11-02', f, zielSchluessel),
      ausgenommen: B.ausgenommen(bew, 'burndown', f, mitDatei, JETZT),
      zielblock: { gewaehlt: ziel.gewaehlt, zaehlt: ziel.zaehlt.schluessel, verschwunden: ziel.verschwunden, standard: ziel.standard },
    },
  };
}
/** Stand vor der Karte (main `1f9f9c4`), mit denselben Aufrufen am unveränderten web/berichte.js gerechnet und hier festgehalten. */
const KEINE_AUSSAGE = [null, null, null, null];
const VOR_DER_KARTE = {
  abgang: { jePeriode: [0, 0, 1], gesamt: 1, durchschnitt: 1 / 3, ausgenommen: 0, ziel: 'Erledigt' },
  burndown: [[3, 0, 0, 3, 3], [0, 0, 0, 3, 3], [0, 1, 0, 2, 3]],
  fluss: [
    [{ Backlog: 3, Arbeit: 0, Erledigt: 0 }, 3, 3, 3, 0],
    [{ Backlog: 1, Arbeit: 2, Erledigt: 0 }, 3, 3, 3, 0],
    [{ Backlog: 1, Arbeit: 1, Erledigt: 1 }, 2, 3, 3, 1],
  ],
  durchlaufzeit: { liste: [{ nummer: 1, eintritt: um9(2), ankunft: um9(4), tage: 2 }], anzahl: 1, gueltig: true, mittel: 2, median: 2, p85: 2 },
  prognose: [3, [['Arbeit', 3, 2, 1, 2], ['Erledigt', 3, 1, 2, 1]]],
  fieberTag: { datum: '2026-11-04', erledigt: 1, umfang: 3, ende7: KEINE_AUSSAGE, ende5: KEINE_AUSSAGE },
  fieberSchluessel: '{"v":2,"start":"2026-11-02","filter":{"ohneFarben":[],"ohneSpalten":[],"personen":[],"labels":[],"messbasisTage":90}}',
  ausgenommen: 0,
  zielblock: { gewaehlt: null, zaehlt: 'Erledigt', verschwunden: null, standard: 'Erledigt' },
};
const board = fieber => ({ fieber: { zielspalte: null, vonspalte: null, ...fieber } });

test('R00167 B0816 (AK 3b): ohne Von-Wahl rechnen Abgang, Burndown, Kumulativer Fluss, Durchlaufzeit, Prognose und Fever Chart samt Cache-Schlüssel wie vor der Karte', () => {
  assert.deepStrictEqual(berichteDesBoards(board({})).bestand, VOR_DER_KARTE);
  assert.deepStrictEqual(berichteDesBoards({ fieber: { zielspalte: null } }).bestand, VOR_DER_KARTE, 'ein Board-Objekt ohne das Feld (älterer Stand)');
});

test('R00167 B0816 (AK 3b): mit Von-Wahl „Arbeit“ ändert sich allein der Zugang des Durchsatzes (3·0·0 → 0·2·0) — der Abgang bleibt Zahl für Zahl, alles andere ist wie vor der Karte', { todo: 'rot bis B0817: der Durchsatz kennt noch keinen Zugang' }, () => {
  const ohne = berichteDesBoards(board({})), mit = berichteDesBoards(board({ vonspalte: 'Arbeit' }));
  assert.deepStrictEqual(mit.bestand, VOR_DER_KARTE);
  assert.deepStrictEqual(ohne.zugang, { jePeriode: [3, 0, 0], gesamt: 3, durchschnitt: 1 });
  assert.deepStrictEqual(mit.zugang, { jePeriode: [0, 2, 0], gesamt: 2, durchschnitt: 2 / 3 });
  assert.deepStrictEqual(berichteDesBoards(board({})), ohne, 'die Wahl eines Aufrufs bleibt nicht hängen');
});

test('R00167 B0816 (ADR-0027 N3 Punkt 4): zielblock(), durchsatzZiel() ohne Parameter und fieberSchluessel kennen die Von-Wahl nicht — eine verschwundene oder ungültige Wahl ändert sie ebenso wenig', () => {
  for (const vonspalte of ['Arbeit', 'Erledigt', 'Abnahme']) {
    assert.deepStrictEqual(berichteDesBoards(board({ vonspalte })).bestand, VOR_DER_KARTE, `Von-Spalte ${vonspalte}`);
  }
  assert.deepStrictEqual(B.durchsatzZiel(beispiel(), undefined), { art: 'spalte', name: 'Erledigt', i: 2, stufe: null });
});

/* ── B0814 Von-Block des Boards an einer Stelle auflösen (ADR-0027 N3 Punkt 4) ── */
const kern = v => ({ gewaehlt: v.gewaehlt, name: v.name, ab: v.ab, verschwunden: v.verschwunden, gueltig: v.gueltig });
const vonblock = (vonspalte, zielSchluessel = 'Erledigt', f = {}) => B.vonblock(beispiel(), filter(f), vonspalte, zielSchluessel);

test('R00167 B0814: ohne Wahl zählt die erste Spalte — sie steht mit leerem Wert vor den Blöcken von „Erledigt heißt“', () => {
  for (const vonspalte of [null, undefined, '']) {
    assert.deepStrictEqual(kern(vonblock(vonspalte)), { gewaehlt: null, name: 'Backlog', ab: 0, verschwunden: null, gueltig: true }, `Von-Spalte ${vonspalte}`);
  }
  assert.deepStrictEqual(vonblock(null).eintraege, [{ wert: '', titel: 'Spalte „Backlog“' }, { wert: 'Arbeit', titel: 'Spalte „Arbeit“' }, { wert: 'Erledigt', titel: 'Spalte „Erledigt“' }]);
  assert.deepStrictEqual(vonblock(null).eintraege.slice(1).map(e => e.wert), B.fieberBloecke(beispiel(), filter({}), undefined).map(b => b.schluessel));
});

test('R00167 B0814 (AK 2): die gespeicherte Von-Spalte „Arbeit“ ist gewählt, gezählt wird ab ihrem Index, die Texte nennen sie', () => {
  const v = vonblock('Arbeit');
  assert.deepStrictEqual(kern(v), { gewaehlt: 'Arbeit', name: 'Arbeit', ab: 1, verschwunden: null, gueltig: true });
  assert.deepStrictEqual(v.worte, { ab: 'ab „Arbeit“', genannt: '„Arbeit“' });
});

test('R00167 B0814: die erste Spalte als gespeicherte Wahl ist die Vorgabe — nichts gewählt, nichts verschwunden, kein Zusatz', () => {
  const v = vonblock('Backlog');
  assert.deepStrictEqual(kern(v), { gewaehlt: null, name: 'Backlog', ab: 0, verschwunden: null, gueltig: true });
  assert.deepStrictEqual(v.worte, { ab: '', genannt: '„Backlog“' });
});

test('R00167 B0814 (AK 6): eine Von-Spalte, die es nicht gibt oder die der Berichtsfilter ausschließt, ist verschwunden — es zählt die erste Spalte samt Name', () => {
  assert.deepStrictEqual(kern(vonblock('Abnahme')), { gewaehlt: null, name: 'Backlog', ab: 0, verschwunden: 'Abnahme', gueltig: true });
  assert.deepStrictEqual(kern(vonblock('Arbeit', 'Erledigt', { ohneSpalten: ['Arbeit'] })), { gewaehlt: null, name: 'Backlog', ab: 0, verschwunden: 'Arbeit', gueltig: true });
  assert.deepStrictEqual(vonblock('Abnahme').worte, { ab: '', genannt: '„Backlog“' }, 'beschriftet wie ohne Wahl');
});

test('R00167 B0814: schließt der Berichtsfilter die erste Spalte aus, ist die Vorgabe die erste Spalte unter dem Filter', () => {
  const v = vonblock(null, 'Erledigt', { ohneSpalten: ['Backlog'] });
  assert.deepStrictEqual(kern(v), { gewaehlt: null, name: 'Arbeit', ab: 1, verschwunden: null, gueltig: true });
  assert.deepStrictEqual(v.eintraege, [{ wert: '', titel: 'Spalte „Arbeit“' }, { wert: 'Erledigt', titel: 'Spalte „Erledigt“' }]);
});

test('R00167 B0814 (AK 5): eine Von-Spalte, die nicht links vom Zielblock liegt, ist ungültig — gleich oder rechts davon; die Wahl bleibt stehen', () => {
  assert.deepStrictEqual(kern(vonblock('Erledigt', 'Erledigt')), { gewaehlt: 'Erledigt', name: 'Erledigt', ab: 2, verschwunden: null, gueltig: false });
  assert.strictEqual(vonblock('Arbeit', 'Arbeit').gueltig, false, 'dieselbe Spalte');
  assert.strictEqual(vonblock('Erledigt', 'Arbeit').gueltig, false, 'rechts vom Ziel');
  assert.strictEqual(vonblock('Arbeit', 'Erledigt').gueltig, true);
  assert.strictEqual(vonblock(null, 'Arbeit').gueltig, true, 'die erste Spalte liegt links von jedem Zielblock');
  assert.strictEqual(vonblock('Abnahme', 'Arbeit').gueltig, true, 'eine verschwundene Wahl rechnet ab der ersten Spalte');
});

test('R00167 B0814: auf einem Board mit Phasen ist die Vorgabe die erste Spalte des Boards, die Blöcke heißen „Phase „…““, gezählt wird ab der ersten Spalte der Phase', () => {
  const von = (vonspalte, ziel = 'Abnahme') => B.vonblock(mitPhasen(), filter({}), vonspalte, ziel);
  assert.deepStrictEqual(von(null).eintraege.map(e => [e.wert, e.titel]), [['', 'Spalte „Eingang“'], ['Entwicklung', 'Phase „Entwicklung“'], ['Entwicklertest', 'Phase „Entwicklertest“'], ['Abnahme', 'Phase „Abnahme“']]);
  assert.deepStrictEqual(kern(von(null)), { gewaehlt: null, name: 'Eingang', ab: 0, verschwunden: null, gueltig: true });
  const v = von('Entwicklertest');
  assert.deepStrictEqual(kern(v), { gewaehlt: 'Entwicklertest', name: 'Entwicklertest', ab: 2, verschwunden: null, gueltig: true });
  assert.deepStrictEqual(v.worte, { ab: 'ab „Entwicklertest“', genannt: 'die Phase „Entwicklertest“' });
  assert.strictEqual(von('Abnahme', 'Abnahme').gueltig, true, 'dieselbe Phase ist eine Strecke: von ihrer ersten Spalte bis „durchlaufen“');
  assert.strictEqual(von('Abnahme', 'Entwicklung').gueltig, false, 'eine Phase rechts vom Ziel');
  assert.strictEqual(von('Erledigt').verschwunden, 'Erledigt', 'eine Spalte ist auf einem Board mit Phasen kein Block');
});

test('R00167 B0814: eine Phase ohne eigene Spalte ist kein Eintrag von „Zugang ab“ — es gibt keine erste Spalte, die erreicht werden könnte', () => {
  const ohneSpalte = { ...mitPhasen(), phasen: { ...PHASEN, spaltenphasen: { Entwicklung: 'Entwicklung', Abnahme: 'Abnahme' } } };
  const v = B.vonblock(ohneSpalte, filter({}), 'Entwicklertest', 'Abnahme');
  assert.deepStrictEqual(v.eintraege.map(e => e.wert), ['', 'Entwicklung', 'Abnahme']);
  assert.deepStrictEqual(kern(v), { gewaehlt: null, name: 'Eingang', ab: 0, verschwunden: 'Entwicklertest', gueltig: true });
});
