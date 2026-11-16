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
/** Phasen über die mittleren Spalten, mal mit „eingebettet in“ an der zweiten Phase. */
function zufallsPhasen(w, spalten) {
  const mitte = spalten.slice(1, -1);
  const folge = mitte.map((name, k) => {
    const phase = { nr: k + 1, name };
    if (k === 1 && w.trifft(0.5)) phase.eingebettet = 'klein';
    return phase;
  });
  return { anwendung: 'kd', folge, spaltenphasen: Object.fromEntries(mitte.map(name => [name, name])) };
}
/** Ein Zufallsbestand: 3–6 Spalten, bis zu 12 Aufgaben mit Zügen vom 01.11. bis 09.11. — auch nach links (Rückläufer), vom
    Board genommen und wieder da —, Archivtage, Labels, `reporting.burndown: false`; jeder dritte mit Phasen. Dazu ein Filter,
    der mal Spalten ausschließt (auch die Abschlussspalte), mal „Rechnen ab“ setzt, und eine gespeicherte Zielspalte. */
function zufallsbestand(saat) {
  const w = zufall(saat), spalten = ['Eingang', 'Analyse', 'Bau', 'Test', 'Abnahme', 'Erledigt'].slice(0, 2 + w.bis(4)).concat('Fertig');
  const bew = { spalten, aufgaben: [] }, dateien = new Map();
  if (saat % 3 === 0 && spalten.length >= 4) bew.phasen = zufallsPhasen(w, spalten);
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

test('R00169 B0823 (AK 2, AK 9): an jedem Tag von 500 Zufallsbeständen — mit Rückläufern, Archivtagen, ausgeschlossenen Spalten, jeder dritte mit Phasen — ist Burndown „offen“ = Fluss „offen“ und Burndown „Umfang“ = Fluss „gesamt“; ohne Phasen ist „offen“ die Summe der Bänder links vom Zielblock', () => {
  const gesehen = { tage: 0, mitWahl: 0, mitPhasenUndWahl: 0, offenAndersAlsOhneWahl: 0 };
  for (let saat = 1; saat <= 500; saat++) {
    const { bew, f, start, zielspalte, aufgabeZu } = zufallsbestand(saat);
    const { ziel, burndown, fluss } = beideBerichte(bew, f, zielspalte, aufgabeZu, JETZT_ZUFALL, start);
    const ohneWahl = B.burndown(bew, f, aufgabeZu, JETZT_ZUFALL, start);
    assert.deepStrictEqual(fluss.map(x => x.datum), burndown.map(x => x.datum), `Bestand ${saat}: dieselben Tage`);
    fluss.forEach((tag, i) => {
      const wo = `Bestand ${saat} (Zielspalte ${zielspalte}, zählt ${ziel.gewaehlt}) am ${tag.datum}`;
      assert.strictEqual(tag.offen, burndown[i].offen, `offen — ${wo}`);
      assert.strictEqual(tag.gesamt, burndown[i].umfang, `gesamt — ${wo}`);
      if (ziel.gewaehlt && !bew.phasen) {
        const links = bew.spalten.slice(0, bew.spalten.indexOf(ziel.gewaehlt));
        assert.strictEqual(tag.offen, links.reduce((summe, s) => summe + tag.jeSpalte[s], 0), `Bänder links — ${wo}`);
      }
      if (burndown[i].offen !== ohneWahl[i].offen) gesehen.offenAndersAlsOhneWahl++;
    });
    gesehen.tage += fluss.length;
    if (ziel.gewaehlt) gesehen.mitWahl++;
    if (ziel.gewaehlt && bew.phasen) gesehen.mitPhasenUndWahl++;
  }
  assert.ok(gesehen.tage > 2000 && gesehen.mitWahl > 150 && gesehen.mitPhasenUndWahl > 30 && gesehen.offenAndersAlsOhneWahl > 300, `die Bestände decken die Fälle ab: ${JSON.stringify(gesehen)}`);
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

const PHASEN = { anwendung: 'kd', folge: [{ nr: 1, name: 'Entwicklung' }, { nr: 2, name: 'Entwicklertest' }, { nr: 3, name: 'Abnahme' }], spaltenphasen: { Entwicklung: 'Entwicklung', Entwicklertest: 'Entwicklertest', Abnahme: 'Abnahme' } };
const mitPhasen = () => ({ spalten: ['Eingang', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'], phasen: PHASEN, aufgaben: [
  { nummer: 1, labels: ['klein'], wechsel: [z(2, 'Entwicklung'), z(3, 'Entwicklertest')] },
  { nummer: 2, wechsel: [z(2, 'Entwicklung')] },
  { nummer: 3, wechsel: [z(2, 'Entwicklung'), z(3, 'Entwicklertest'), z(4, 'Abnahme')] },
] });

test('R00169 B0824 (AK 9): mit Phasen zählen „offen“ und „fertig“ je Aufgabe über die Stufe des Blocks — wie im Burndown; „eingebettet in“ gilt nur für die Aufgabe mit dem Label', () => {
  const bew = mitPhasen();
  const eingebettet = { ...bew, phasen: { ...PHASEN, folge: [PHASEN.folge[0], { nr: 2, name: 'Entwicklertest', eingebettet: 'klein' }, PHASEN.folge[2]] } };
  assert.deepStrictEqual(rand(bew, 'Entwicklung'), [[3, 0, 3], [1, 2, 3], [1, 2, 3]]);
  assert.deepStrictEqual(rand(bew, 'Entwicklertest'), [[3, 0, 3], [3, 0, 3], [2, 1, 3]], 'in der Spalte der Phase ist sie noch nicht durchlaufen');
  assert.deepStrictEqual(rand(eingebettet, 'Entwicklertest'), [[3, 0, 3], [2, 1, 3], [1, 2, 3]], '#1 trägt das Label und hat den Entwicklertest in dessen Spalte durchlaufen');
  for (const b of [bew, eingebettet]) for (const zielblock of ['Entwicklung', 'Entwicklertest', 'Abnahme', null]) {
    const burndown = B.burndown(b, filter({}), mitDatei, JETZT, null, zielblock).map(x => [x.offen, x.umfang]);
    assert.deepStrictEqual(rand(b, zielblock).map(([offen, , gesamt]) => [offen, gesamt]), burndown, `Zielblock ${zielblock}`);
  }
});
