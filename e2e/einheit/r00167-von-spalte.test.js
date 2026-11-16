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

test('R00167 B0816 (AK 3b): mit Von-Wahl „Arbeit“ ändert sich allein der Zugang des Durchsatzes (3·0·0 → 0·2·0) — der Abgang bleibt Zahl für Zahl, alles andere ist wie vor der Karte', () => {
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

/* ── B0817 durchsatz() rechnet den Zugang je Periode (ADR-0027 N3 Punkt 5) ── */
const zahlen = d => ({ zugang: d.perioden.map(p => p.zugang), abgang: d.perioden.map(p => p.anzahl), summen: [d.zugangGesamt, d.gesamt] });
const durchsatz = (von, bew = beispiel(), f = {}, start = null) => B.durchsatz(bew, filter(f), mitDatei, JETZT, start, 'tag', null, von);

test('R00167 B0817 (AK 1, Abnahme der Karte #157): von = Arbeit ergibt Zugang 0·2·0 (Summe 2) und Abgang 0·0·1 (Summe 1); von = Backlog Zugang 3·0·0 — Ø je Tag 2 : 3, 3 : 3 und 1 : 3', () => {
  const arbeit = durchsatz('Arbeit'), backlog = durchsatz(null);
  assert.deepStrictEqual(zahlen(arbeit), { zugang: [0, 2, 0], abgang: [0, 0, 1], summen: [2, 1] });
  assert.deepStrictEqual(zahlen(backlog), { zugang: [3, 0, 0], abgang: [0, 0, 1], summen: [3, 1] });
  assert.deepStrictEqual([arbeit.zugangDurchschnitt, arbeit.durchschnitt], [2 / 3, 1 / 3]);
  assert.deepStrictEqual([backlog.zugangDurchschnitt, backlog.durchschnitt], [1, 1 / 3]);
  assert.deepStrictEqual(zahlen(durchsatz('Backlog')), zahlen(backlog), 'die erste Spalte als Wahl ist die Vorgabe');
  assert.deepStrictEqual(zahlen(B.durchsatz(beispiel(), filter({}), mitDatei, JETZT, null, 'tag')), zahlen(backlog), 'ohne den Parameter gilt die Vorgabe');
});

test('R00167 B0817 (AK 4): ein Rückläufer zählt einmal — #2 geht am 04.11. zurück in den Backlog und wieder nach Arbeit, der Zugang am 04.11. bleibt 0', () => {
  const nurRuecklaeufer = { spalten: ['Backlog', 'Arbeit', 'Erledigt'], aufgaben: [beispiel().aufgaben[1]] };
  assert.deepStrictEqual(zahlen(durchsatz('Arbeit', nurRuecklaeufer)), { zugang: [0, 1, 0], abgang: [0, 0, 0], summen: [1, 0] });
  assert.deepStrictEqual(zahlen(durchsatz(null, nurRuecklaeufer)).zugang, [1, 0, 0], 'auch der Rückzug in die erste Spalte zählt nicht erneut');
});

test('R00167 B0817 (AK 7): `reporting.forecast: false` an #1 nimmt sie aus beiden Balken — von = Arbeit Zugang 0·1·0, Abgang 0·0·0; „Ausgenommen“ bleibt die Zahl des Abgangs', () => {
  const bew = beispiel();
  bew.aufgaben[0].reporting = { forecast: false };
  const d = durchsatz('Arbeit', bew);
  assert.deepStrictEqual(zahlen(d), { zugang: [0, 1, 0], abgang: [0, 0, 0], summen: [1, 0] });
  assert.strictEqual(d.ausgenommen, 1);
  bew.aufgaben[0].reporting = undefined;
  bew.aufgaben[1].reporting = { forecast: false };
  assert.strictEqual(durchsatz('Arbeit', bew).ausgenommen, 0, 'eine ausgenommene Aufgabe, die das Ziel nicht erreicht hat, zählt wie vor der Karte nicht in „Ausgenommen“');
});

test('R00167 B0817 (AK 7): Berichtsfilter, Zeitraum und „Rechnen ab“ wirken auf Zugang und Abgang gleich', () => {
  const nurAnna = nummer => ({ klasse: null, zustaendige: [nummer === 2 ? 'an' : 'st'], labels: [] });
  const gefiltert = B.durchsatz(beispiel(), filter({ personen: ['an'] }), nurAnna, JETZT, null, 'tag', null, 'Arbeit');
  assert.deepStrictEqual(zahlen(gefiltert), { zugang: [0, 1, 0], abgang: [0, 0, 0], summen: [1, 0] }, 'Personenfilter: nur #2');
  assert.deepStrictEqual(zahlen(durchsatz('Arbeit', beispiel(), {}, '2026-11-04')), { zugang: [0], abgang: [1], summen: [0, 1] }, 'Rechnen ab 04.11.: der Zugang vom 03.11. liegt davor');
  assert.deepStrictEqual(zahlen(durchsatz(null, beispiel(), { zeitraum: 'eigen', von: '2026-11-03', bis: '2026-11-04' })), { zugang: [0, 0], abgang: [0, 1], summen: [0, 1] }, 'Zeitraum 03.–04.11.: angelegt wurde am 02.11.');
});

test('R00167 B0817 (AK 10): eine direkt in der Zielspalte angelegte Aufgabe zählt in Zugang und Abgang derselben Periode — 04.11. Zugang 1 · Abgang 2, bei von = Backlog wie bei von = Arbeit', () => {
  const bew = beispiel();
  bew.aufgaben.push({ nummer: 4, wechsel: [z(4, 'Erledigt')] });
  assert.deepStrictEqual(zahlen(durchsatz('Arbeit', bew)), { zugang: [0, 2, 1], abgang: [0, 0, 2], summen: [3, 2] });
  assert.deepStrictEqual(zahlen(durchsatz(null, bew)), { zugang: [3, 0, 1], abgang: [0, 0, 2], summen: [4, 2] });
});

test('R00167 B0817 (AK 6): eine Von-Spalte, die es nicht gibt, rechnet ab der ersten Spalte; ohne Bewegung gibt es weder Zugang noch Abgang', () => {
  assert.deepStrictEqual(zahlen(durchsatz('Abnahme')), zahlen(durchsatz(null)));
  const leer = durchsatz('Arbeit', { spalten: ['Backlog', 'Arbeit', 'Erledigt'], aufgaben: [] });
  assert.deepStrictEqual([leer.perioden, leer.gesamt, leer.durchschnitt, leer.zugangGesamt, leer.zugangDurchschnitt], [[], 0, null, 0, null]);
});

test('R00167 B0817: mit Phasen zählt das erste Erreichen der ersten Spalte der Phase oder einer Spalte rechts davon; ohne Wahl die erste Spalte des Boards', () => {
  const bew = { ...mitPhasen(), aufgaben: [
    { nummer: 1, wechsel: [z(2, 'Eingang'), z(3, 'Entwicklertest'), z(4, 'Erledigt')] },
    { nummer: 2, wechsel: [z(2, 'Eingang'), z(4, 'Abnahme')] },
    { nummer: 3, wechsel: [z(3, 'Entwicklung')] },
  ] };
  assert.deepStrictEqual(zahlen(durchsatz('Entwicklertest', bew)), { zugang: [0, 1, 1], abgang: [0, 0, 1], summen: [2, 1] });
  assert.deepStrictEqual(zahlen(durchsatz('Entwicklung', bew)).zugang, [0, 2, 1]);
  assert.deepStrictEqual(zahlen(durchsatz(null, bew)).zugang, [2, 1, 0]);
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
