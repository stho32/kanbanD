// R00169 Kumulativer Fluss und Durchlaufzeit folgen der Zielspalte des Boards (ADR-0027 N5, Karte #159) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const z = (t, spalte) => ({ zeitpunkt: `2026-11-0${t} 09:00`, spalte });
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = () => ({ klasse: null, zustaendige: ['st'], labels: [] });
const JETZT = new Date(2026, 10, 4, 12, 0).getTime();

/** Rechenbeispiel der Anforderung: Spalten A · B · C · Erledigt; 02.11. #1 bis #3 in A; 03.11. #1 und #2 nach B, #3 nach
    Erledigt; 04.11. #1 weiter nach C, #2 zurück nach A. */
const beispiel = () => ({ spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [
  { nummer: 1, wechsel: [z(2, 'A'), z(3, 'B'), z(4, 'C')] },
  { nummer: 2, wechsel: [z(2, 'A'), z(3, 'B'), z(4, 'A')] },
  { nummer: 3, wechsel: [z(2, 'A'), z(3, 'Erledigt')] },
] });
/** Burndown und Fluss eines Boards mit dieser gespeicherten Zielspalte unter dem Filter, verdrahtet wie in web/ansicht.js. */
function beideBerichte(bew, f, zielspalte, aufgabeZu = mitDatei, jetzt = JETZT, start = null) {
  const ziel = B.zielblock(bew, f, zielspalte);
  return { ziel, burndown: B.burndown(bew, f, aufgabeZu, jetzt, start, ziel.gewaehlt), fluss: B.fluss(bew, f, aufgabeZu, jetzt, start, ziel.gewaehlt).tage };
}
/** Die Zeilen der Tabelle in R00169, von Hand gerechnet: Bänder, Burndown offen · Umfang, Fluss offen · fertig · gesamt. */
const tabelle = ({ burndown, fluss }) => fluss.map((x, i) => ({
  baender: Object.values(x.jeSpalte), burndown: [burndown[i].offen, burndown[i].umfang], fluss: [x.offen, x.fertig, x.gesamt], angekommen: x.angekommen,
}));
const BAENDER = [[3, 0, 0, 0], [0, 2, 0, 1], [1, 0, 1, 1]];

/* ── B0823 Rechenbeispiel und die Gleichung „eine Zahl“ (ADR-0027 N5 Punkte 7, 8) ── */
test('R00169 B0823 (AK 1): Rechenbeispiel ohne Wahl — Bänder 3·0·0·0, 0·2·0·1, 1·0·1·1; Burndown offen · Umfang 3·3, 2·3, 2·3; Fluss offen · fertig · gesamt 3·0·3, 2·1·3, 2·1·3', () => {
  assert.deepStrictEqual(tabelle(beideBerichte(beispiel(), filter({}), null)), [
    { baender: BAENDER[0], burndown: [3, 3], fluss: [3, 0, 3], angekommen: 3 },
    { baender: BAENDER[1], burndown: [2, 3], fluss: [2, 1, 3], angekommen: 3 },
    { baender: BAENDER[2], burndown: [2, 3], fluss: [2, 1, 3], angekommen: 3 },
  ]);
});

test('R00169 B0823 (AK 2–4): Rechenbeispiel mit Zielspalte B — Burndown offen · Umfang 3·3, 0·3, 1·3; Fluss offen · fertig · gesamt 3·0·3, 0·3·3, 1·3·3; „fertig“ sinkt am 04.11. nicht; Bänder und „angekommen“ wie ohne Wahl', () => {
  assert.deepStrictEqual(tabelle(beideBerichte(beispiel(), filter({}), 'B')), [
    { baender: BAENDER[0], burndown: [3, 3], fluss: [3, 0, 3], angekommen: 3 },
    { baender: BAENDER[1], burndown: [0, 3], fluss: [0, 3, 3], angekommen: 3 },
    { baender: BAENDER[2], burndown: [1, 3], fluss: [1, 3, 3], angekommen: 3 },
  ]);
});

/** Zufall mit fester Saat (mulberry32) — derselbe Bestand in jedem Lauf. */
function zufall(saat) {
  let a = saat >>> 0;
  const naechste = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const bis = n => Math.floor(naechste() * n);
  return { bis, einer: liste => liste[bis(liste.length)], trifft: anteil => naechste() < anteil };
}
const zwei = n => String(n).padStart(2, '0');
const JETZT_ZUFALL = new Date(2026, 10, 10, 12, 0).getTime();
/** Ein Zufallsbestand: 3–6 Spalten, bis zu 12 Aufgaben mit Zügen vom 01.11. bis 09.11. — auch nach links (Rückläufer), vom
    Board genommen und wieder da —, Archivtage, Labels, `reporting.burndown: false`. Dazu ein Filter,
    der mal Spalten ausschließt (auch die Abschlussspalte), mal „Rechnen ab“ setzt, und eine gespeicherte Zielspalte. */
function zufallsbestand(saat) {
  const w = zufall(saat), spalten = ['Eingang', 'Analyse', 'Bau', 'Test', 'Abnahme', 'Erledigt'].slice(0, 2 + w.bis(4)).concat('Fertig');
  const bew = { spalten, aufgaben: [] }, dateien = new Map();
  for (let nummer = 1, n = 1 + w.bis(12); nummer <= n; nummer++) {
    const wechsel = [];
    let t = 1 + w.bis(5), spalte = spalten[w.bis(2)];
    while (t <= 9) {
      wechsel.push({ zeitpunkt: `2026-11-${zwei(t)} ${zwei(8 + w.bis(9))}:${zwei(w.bis(60))}`, spalte });
      if (w.trifft(0.2)) break;
      t += 1 + w.bis(3);
      spalte = w.trifft(0.08) ? null : w.einer(spalten);
    }
    const a = { nummer, wechsel }, datei = { klasse: null, zustaendige: ['st'], labels: [] };
    if (w.trifft(0.3)) { a.labels = ['klein']; datei.labels = ['klein']; }
    if (w.trifft(0.1)) a.reporting = { burndown: false };
    if (w.trifft(0.25)) datei.archiviert = `2026-11-${zwei(2 + w.bis(8))}`;
    bew.aufgaben.push(a);
    dateien.set(nummer, datei);
  }
  const f = filter({});
  if (w.trifft(0.4)) f.ohneSpalten = spalten.filter(() => w.trifft(0.25));
  if (w.trifft(0.2)) f.ohneSpalten = [...new Set([...f.ohneSpalten, 'Fertig'])];
  let start = null;
  if (w.trifft(0.2)) start = `2026-11-${zwei(2 + w.bis(4))}`;
  const zielspalte = w.einer([null, ...spalten.slice(1, -1), ...spalten.slice(1, -1), 'Gibt es nicht']);
  return { bew, f, start, zielspalte, aufgabeZu: nr => dateien.get(nr) };
}

test('R00169 B0823 (AK 2, AK 9): an jedem Tag von 500 Zufallsbeständen — mit Rückläufern, Archivtagen, ausgeschlossenen Spalten — ist Burndown „offen“ = Fluss „offen“ und Burndown „Umfang“ = Fluss „gesamt“; „offen“ ist die Summe der Bänder links vom Zielblock', () => {
  const gesehen = { tage: 0, mitWahl: 0, offenAndersAlsOhneWahl: 0 };
  for (let saat = 1; saat <= 500; saat++) {
    const { bew, f, start, zielspalte, aufgabeZu } = zufallsbestand(saat);
    const { ziel, burndown, fluss } = beideBerichte(bew, f, zielspalte, aufgabeZu, JETZT_ZUFALL, start);
    const ohneWahl = B.burndown(bew, f, aufgabeZu, JETZT_ZUFALL, start);
    assert.deepStrictEqual(fluss.map(x => x.datum), burndown.map(x => x.datum), `Bestand ${saat}: dieselben Tage`);
    fluss.forEach((tag, i) => {
      const wo = `Bestand ${saat} (Zielspalte ${zielspalte}, zählt ${ziel.gewaehlt}) am ${tag.datum}`;
      assert.strictEqual(tag.offen, burndown[i].offen, `offen — ${wo}`);
      assert.strictEqual(tag.gesamt, burndown[i].umfang, `gesamt — ${wo}`);
      if (ziel.gewaehlt) {
        const links = bew.spalten.slice(0, bew.spalten.indexOf(ziel.gewaehlt));
        assert.strictEqual(tag.offen, links.reduce((summe, s) => summe + tag.jeSpalte[s], 0), `Bänder links — ${wo}`);
      }
      if (burndown[i].offen !== ohneWahl[i].offen) gesehen.offenAndersAlsOhneWahl++;
    });
    gesehen.tage += fluss.length;
    if (ziel.gewaehlt) gesehen.mitWahl++;
  }
  assert.ok(gesehen.tage > 2000 && gesehen.mitWahl > 150 && gesehen.offenAndersAlsOhneWahl > 300, `die Bestände decken die Fälle ab: ${JSON.stringify(gesehen)}`);
});

/* ── B0824 `fluss()` rechnet „offen“ und „fertig“ bis zum Zielblock (ADR-0027 N5 Punkte 2, 4) ── */
const rand = (bew, zielblock, f = filter({}), aufgabeZu = mitDatei) => B.fluss(bew, f, aufgabeZu, JETZT, null, zielblock).tage.map(x => [x.offen, x.fertig, x.gesamt]);

test('R00169 B0824 (AK 3): „fertig“ zählt je Aufgabe das erste Erreichen des Zielblocks oder einer Spalte rechts davon — ein Rückläufer, der B ein zweites Mal erreicht, zählt einmal; direkt nach „Erledigt“ zählt mit', () => {
  const bew = { spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [
    { nummer: 1, wechsel: [z(2, 'B'), z(3, 'A'), z(4, 'B')] },
    { nummer: 2, wechsel: [z(2, 'A'), z(4, 'Erledigt')] },
  ] };
  assert.deepStrictEqual(rand(bew, 'B'), [[1, 1, 2], [2, 1, 2], [0, 2, 2]]);
  assert.deepStrictEqual(rand(bew, 'C'), [[2, 0, 2], [2, 0, 2], [1, 1, 2]]);
  assert.deepStrictEqual(rand(bew, null), [[2, 0, 2], [2, 0, 2], [1, 1, 2]], 'ohne Zielblock die Abschlussspalte');
});

test('R00169 B0824 (AK 1): ein Zielblock, den es nicht gibt, rechnet wie ohne Wahl', () => {
  assert.deepStrictEqual(rand(beispiel(), 'Abnahme'), rand(beispiel(), null));
  assert.deepStrictEqual(rand(beispiel(), undefined), [[3, 0, 3], [2, 1, 3], [2, 1, 3]]);
});

test('R00169 B0824 (AK 3, ADR-0027 Regel 3): archiviert im Zielblock bleibt erledigt und fertig; außerhalb archiviert fällt aus „offen“ und „gesamt“, „fertig“ sinkt nicht', () => {
  const bew = { spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [{ nummer: 1, wechsel: [z(2, 'A'), z(3, 'C')] }] };
  const archiviertAm04 = () => ({ ...mitDatei(), archiviert: '2026-11-04' });
  assert.deepStrictEqual(rand(bew, 'B', filter({}), archiviertAm04), [[1, 0, 1], [0, 1, 1], [0, 1, 1]]);
  assert.deepStrictEqual(rand(bew, null, filter({}), archiviertAm04), [[1, 0, 1], [1, 0, 1], [0, 0, 0]]);
});

test('R00169 (Code-Review B1, AK 2 vor AK 4): #1 am 03.11. nach C, am 04.11. archiviert — mit Zielspalte B bleibt sie am 04.11. in Band C 1 und in „gesamt“ 1 = Burndown „Umfang“ 1; ohne Wahl sind Band, „gesamt“ und „Umfang“ 0', () => {
  const bew = { spalten: ['A', 'B', 'C', 'Erledigt'], aufgaben: [{ nummer: 1, wechsel: [z(2, 'A'), z(3, 'C')] }] };
  const archiviertAm04 = () => ({ ...mitDatei(), archiviert: '2026-11-04' });
  const am0411 = zielspalte => {
    const { burndown, fluss } = beideBerichte(bew, filter({}), zielspalte, archiviertAm04);
    return { bandC: fluss[2].jeSpalte.C, gesamt: fluss[2].gesamt, umfang: burndown[2].umfang };
  };
  assert.deepStrictEqual(am0411('B'), { bandC: 1, gesamt: 1, umfang: 1 });
  assert.deepStrictEqual(am0411(null), { bandC: 0, gesamt: 0, umfang: 0 });
});

/* ── B0825 Randfall: ausgeschlossene Abschlussspalte ohne Wahl — es zählt der letzte sichtbare Block (ADR-0027 N5 Punkte 5, 6) ── */
const OHNE_ERLEDIGT = { ohneSpalten: ['Erledigt'] };
const kern = zb => ({ gewaehlt: zb.gewaehlt, zaehlt: zb.zaehlt && zb.zaehlt.schluessel, verschwunden: zb.verschwunden, standard: zb.standard, ausgeschlossen: zb.ausgeschlossen });
/** Die Berichte des Rechenbeispiels unter diesem Filter und dieser gespeicherten Zielspalte, verdrahtet wie in web/ansicht.js. */
function randfall(f, zielspalte = null) {
  const bew = beispiel(), { ziel, burndown, fluss } = beideBerichte(bew, f, zielspalte), gespeichert = ziel.block && ziel.block.schluessel;
  const d = B.durchsatz(bew, f, mitDatei, JETZT, null, 'tag', ziel.gewaehlt), p = B.prognose(bew, f, mitDatei, JETZT);
  return {
    folgen: {
      burndown: burndown.map(x => [x.hinzugekommen, x.erledigt, x.entfernt, x.offen, x.umfang]),
      fluss: fluss.map(x => [x.offen, x.fertig, x.gesamt]),
      durchsatz: { ausgeschlossen: d.zielAusgeschlossen, jeTag: d.perioden.map(x => x.anzahl), ziel: d.ziel.name },
    },
    bleiben: {
      baender: fluss.map(x => [Object.values(x.jeSpalte), x.angekommen]),
      prognose: [p.umfang, p.bloecke.map(x => [x.schluessel, x.nenner, x.erreicht, x.offen, x.laeufe])],
      fieberTag: B.fieberTag(bew, f, mitDatei, '2026-11-04', '2026-11-02', gespeichert),
      fieberSchluessel: B.fieberSchluessel('2026-11-02', f, gespeichert),
    },
  };
}
/** Was der Randfall nicht anfasst — Stand vor der Karte (main `a66ca77`) mit ausgeschlossener Spalte „Erledigt“ und ohne Wahl,
    am unveränderten web/berichte.js gerechnet und hier festgehalten: das Fever Chart rechnet schon bis „C“ (1 von 2). */
const RANDFALL_BLEIBT = {
  baender: [[[3, 0, 0, 0], 3], [[0, 2, 0, 0], 3], [[1, 0, 1, 0], 3]],
  prognose: [2, [['B', 2, 1, 1, 2], ['C', 2, 1, 1, 1]]],
  fieberTag: { datum: '2026-11-04', erledigt: 1, umfang: 2, ende7: [null, null, null, null], ende5: [null, null, null, null] },
  fieberSchluessel: '{"v":2,"start":"2026-11-02","filter":{"ohneFarben":[],"ohneSpalten":["Erledigt"],"personen":[],"labels":[],"messbasisTage":90}}',
};

test('R00169 B0825 (AK 8): Abschlussspalte ausgeschlossen, nichts gewählt — `zielblock()` nennt den letzten sichtbaren Block „C“ als gewählt und als Standard, samt Worten und dem Namen der ausgeschlossenen Spalte', () => {
  const zb = B.zielblock(beispiel(), filter(OHNE_ERLEDIGT), null);
  assert.deepStrictEqual(kern(zb), { gewaehlt: 'C', zaehlt: 'C', verschwunden: null, standard: 'C', ausgeschlossen: 'Erledigt' });
  assert.deepStrictEqual(zb.worte, { lang: 'in „C“ oder rechts davon', kurz: 'ab „C“', bis: 'bis „C“' });
  assert.deepStrictEqual(zb.bloecke.map(x => x.schluessel), ['B', 'C'], 'der letzte Eintrag der Auswahl — „(Standard)“ — ist dieser Block');
  assert.strictEqual(zb.block, null, 'gespeichert ist nichts: Fever Chart und Cache-Schlüssel lesen weiter diese Stelle');
});

test('R00169 B0825 (AK 8, Rechenbeispiel „Randfall“): Burndown und Fluss nennen „offen“ 3·2·1 (vor der Karte 3·2·2), der Durchsatz zählt am 03.11. und 04.11. je eine Aufgabe statt „ausgeschlossen“ — Bänder, „Wie lange noch“, Fever Chart und sein Cache-Schlüssel bleiben', () => {
  const r = randfall(filter(OHNE_ERLEDIGT));
  assert.deepStrictEqual(r.folgen.burndown.map(x => x[3]), [3, 2, 1]);
  assert.deepStrictEqual(r.folgen.fluss, [[3, 0, 3], [2, 1, 2], [1, 2, 2]]);
  assert.deepStrictEqual(r.folgen.durchsatz, { ausgeschlossen: false, jeTag: [0, 1, 1], ziel: 'C' });
  assert.deepStrictEqual(r.bleiben, RANDFALL_BLEIBT);
});

test('R00169 B0825 (Entscheidung): eine Aufgabe, die den letzten sichtbaren Block überspringt und direkt in die ausgeschlossene Abschlussspalte geht, ist an dem Tag „− erledigt“, „fertig“ und Abgang und verlässt den Bestand — die Bilanz des Burndowns geht an jedem Tag auf', () => {
  const r = randfall(filter(OHNE_ERLEDIGT)), tage = r.folgen.burndown;
  // + hinzugekommen · − erledigt · − entfernt · offen · Umfang: #3 geht am 03.11. von A nach „Erledigt“, #1 am 04.11. nach C
  assert.deepStrictEqual(tage, [[3, 0, 0, 3, 3], [0, 1, 0, 2, 2], [0, 1, 0, 1, 2]]);
  for (let i = 1; i < tage.length; i++) {
    const [hinzugekommen, erledigt, entfernt, offen] = tage[i];
    assert.strictEqual(offen, tage[i - 1][3] + hinzugekommen - erledigt - entfernt, `Bilanz am Tag ${i + 1}`);
  }
  assert.deepStrictEqual(r.folgen.fluss.map(x => x[1]), [0, 1, 2], '„fertig“ zählt #3 am 03.11. mit');
  assert.deepStrictEqual(r.folgen.durchsatz.jeTag, [0, 1, 1], 'der Durchsatz ebenso');
});

test('R00169 B0825 (AK 1): ohne ausgeschlossene Abschlussspalte ist nichts anders — auch wenn der Filter andere Spalten ausschließt', () => {
  for (const ohneSpalten of [[], ['A'], ['B'], ['C'], ['A', 'C']]) {
    const zb = B.zielblock(beispiel(), filter({ ohneSpalten }), null);
    assert.deepStrictEqual(kern(zb), { gewaehlt: null, zaehlt: 'Erledigt', verschwunden: null, standard: 'Erledigt', ausgeschlossen: null }, `ohne ${ohneSpalten}`);
    assert.strictEqual(zb.worte, null);
  }
  // Stand vor der Karte (main `a66ca77`) mit ausgeschlossener Spalte „B“: #1 und #2 fallen am 03.11. aus dem Bestand
  assert.deepStrictEqual(randfall(filter({ ohneSpalten: ['B'] })).folgen, {
    burndown: [[3, 0, 0, 3, 3], [0, 1, 2, 0, 1], [2, 0, 0, 2, 3]], fluss: [[3, 0, 3], [0, 1, 1], [2, 1, 3]], durchsatz: { ausgeschlossen: false, jeTag: [0, 1, 0], ziel: 'Erledigt' },
  });
});

test('R00169 B0825: mit ausgeschlossener Abschlussspalte zählt eine gespeicherte Wahl wie gewählt — „B“ bleibt „B“, „C“ rechnet bis „C“ und nicht bis zur ausgeschlossenen Spalte; der Hinweis auf den Filter steht nur ohne Wahl', () => {
  const f = filter(OHNE_ERLEDIGT);
  assert.deepStrictEqual(kern(B.zielblock(beispiel(), f, 'B')), { gewaehlt: 'B', zaehlt: 'B', verschwunden: null, standard: 'C', ausgeschlossen: null });
  assert.deepStrictEqual(kern(B.zielblock(beispiel(), f, 'C')), { gewaehlt: 'C', zaehlt: 'C', verschwunden: null, standard: 'C', ausgeschlossen: null });
  assert.deepStrictEqual(randfall(f, 'C').folgen, randfall(f, null).folgen);
  assert.strictEqual(randfall(f, 'C').bleiben.fieberSchluessel, RANDFALL_BLEIBT.fieberSchluessel.replace(/}$/, ',"ziel":"C"}'), 'der Schlüssel liest die gespeicherte Wahl');
});

test('R00169 B0825 (ADR-0027 N5 Punkt 5): eine Wahl, die es nicht mehr gibt, fällt bei ausgeschlossener Abschlussspalte auf den letzten sichtbaren Block — gemeldet wird nur die verschwundene Wahl', () => {
  const f = filter(OHNE_ERLEDIGT);
  for (const zielspalte of ['Abnahme', 'Erledigt']) {
    assert.deepStrictEqual(kern(B.zielblock(beispiel(), f, zielspalte)), { gewaehlt: 'C', zaehlt: 'C', verschwunden: zielspalte, standard: 'C', ausgeschlossen: null }, `Zielspalte ${zielspalte}`);
    assert.deepStrictEqual(randfall(f, zielspalte), randfall(f, null));
  }
});

test('R00169 B0825: ohne sichtbaren Block (zwei Spalten) bleibt es beim Stand vor der Karte', () => {
  const f = filter(OHNE_ERLEDIGT);
  const zweiSpalten = { spalten: ['A', 'Erledigt'], aufgaben: [{ nummer: 1, wechsel: [z(2, 'A'), z(3, 'Erledigt')] }] };
  assert.deepStrictEqual(kern(B.zielblock(zweiSpalten, f, null)), { gewaehlt: null, zaehlt: null, verschwunden: null, standard: 'Erledigt', ausgeschlossen: null });
  assert.strictEqual(B.durchsatz(zweiSpalten, f, mitDatei, JETZT, null, 'tag', null).zielAusgeschlossen, true);
});
