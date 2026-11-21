// R00223 Phasen werden gewöhnliche Spalten (Karte #227, ADR-0034 N4) — die Berichte rechnen nur je Spalte — node --test
// AK 1 (Berichte aus den Bewegungen von K und K' gleich), AK 9 (gespeicherte Wahl, Literale von fieberSchluessel), AK 16
// (Fieber-Tage JoinPuya vor und nach der Karte, nur mit R00223_JOPU, sonst übersprungen).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const B = require('../../web/berichte.js');

/* ── Testsprache: die Ausgangslage von R00223 ── */
const z = (t, spalte) => ({ zeitpunkt: `2026-11-0${t} 09:00`, spalte });
const SPALTEN = ['Offen', 'Entwicklung', 'Nacharbeit', 'Reviews', 'Erledigt'];
const JETZT = new Date(2026, 10, 6, 12, 0).getTime();
const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = () => ({ klasse: null, zustaendige: [], labels: [] });
const START = '2026-11-01';

/** Die Wechsel der Ausgangslage: #1 Offen → Entwicklung (02.11.) → Reviews (03.11.) → Erledigt (05.11.); #2 Offen →
    Entwicklung (02.11.) → Nacharbeit (04.11.); #3 Offen → Entwicklung (03.11.) → Reviews (04.11.); #4 in Offen. */
const aufgaben = () => [
  { nummer: 1, wechsel: [z(1, 'Offen'), z(2, 'Entwicklung'), z(3, 'Reviews'), z(5, 'Erledigt')], labels: [], reporting: {} },
  { nummer: 2, wechsel: [z(1, 'Offen'), z(2, 'Entwicklung'), z(4, 'Nacharbeit')], labels: [], reporting: {} },
  { nummer: 3, wechsel: [z(1, 'Offen'), z(3, 'Entwicklung'), z(4, 'Reviews')], labels: [], reporting: {} },
  { nummer: 4, wechsel: [z(1, 'Offen')], labels: [], reporting: {} },
];
const phase = (nr, name) => ({ nr, name, eingebettet: '', gleich: '' });
/** `bewegungen` von K, wie das Programm vor der Karte sie lieferte: `phasen` (Folge Entwicklung, Reviews, Abnahme; Spalten
    Entwicklung, Reviews) und `uebersprungen` an #3. Ein Leser, der diese Reste beachtet, rechnet anders als für K'. */
const bewK = () => ({
  spalten: [...SPALTEN], jetzt: '2026-11-06 12:00',
  aufgaben: aufgaben().map(a => ({ ...a, uebersprungen: a.nummer === 3 ? ['Reviews'] : [] })),
  phasen: { anwendung: 'kd', folge: [phase(1, 'Entwicklung'), phase(2, 'Reviews'), phase(3, 'Abnahme')], spaltenphasen: { Entwicklung: 'Entwicklung', Reviews: 'Reviews' } },
});
/** `bewegungen` des Zwillings K' (ohne `column-phases`, ohne `phases`). */
const bewZwilling = () => ({ spalten: [...SPALTEN], jetzt: '2026-11-06 12:00', aufgaben: aufgaben() });

/* ── Treiber: die Berichte, verdrahtet wie in web/ansicht.js (vBurndown, vPrognose, vFieber). Nur diese Schicht folgt der
      Schnittstelle von web/berichte.js; am Stand vor der Karte reicht die Oberfläche `S.bew.phasen` durch und das Ergebnis
      der Prognose heißt `phasen` (B1159), danach entfällt das Argument (B1163). ── */
const block = (bew, f, wahl) => { const ziel = B.zielblock(bew, f, wahl); return ziel.block && ziel.block.schluessel; };
const fieberTag = (bew, f, datum, wahl = null) => B.fieberTag(bew, f, mitDatei, datum, bew.phasen, START, block(bew, f, wahl));
const prognose = (bew, f) => { const p = B.prognose(bew, f, mitDatei, JETZT, bew.phasen, { start: START }); return { ...p, bloecke: p.phasen }; };
function berichte(bew) {
  const f = filter({}), ziel = B.zielblock(bew, f, null), p = prognose(bew, f);
  return {
    burndown: B.burndown(bew, f, mitDatei, JETZT, START, ziel.gewaehlt).map(t => [t.datum, t.offen, t.umfang, t.hinzugekommen, t.erledigt]),
    durchsatz: B.durchsatz(bew, f, mitDatei, JETZT, START, 'tag', ziel.gewaehlt).perioden.map(x => x.anzahl),
    fluss: B.fluss(bew, f, mitDatei, JETZT, START, ziel.gewaehlt).tage.map(x => [x.jeSpalte, x.offen, x.fertig]),
    durchlaufzeit: B.durchlaufzeiten(bew, f, mitDatei, JETZT, 'Offen', 'Erledigt', START),
    fieber: ['2026-11-03', '2026-11-04', '2026-11-05'].map(d => fieberTag(bew, f, d)),
    prognose: [p.umfang, p.bloecke.map(b => [b.schluessel, b.titel, b.erreicht, b.nenner, b.offen])],
  };
}

/* ── AK 1: Berichte von K gleich denen von K' ── */
test('AK 1: Burndown, Durchsatz, Fluss, Durchlaufzeit, drei Fieber-Tage und Wie lange noch sind für K und K\' gleich', () => {
  assert.deepStrictEqual(berichte(bewK()), berichte(bewZwilling()));
});

test('AK 1: Rechenbeispiel — Block „Reviews“ 2 von 4 erreicht (#1, #3), Block „Erledigt“ 1 von 4 (#1), auch auf K', () => {
  for (const bew of [bewK(), bewZwilling()]) {
    const bloecke = Object.fromEntries(prognose(bew, filter({})).bloecke.map(b => [b.schluessel, [b.erreicht, b.nenner]]));
    assert.deepStrictEqual(bloecke, { Entwicklung: [3, 4], Nacharbeit: [3, 4], Reviews: [2, 4], Erledigt: [1, 4] });
  }
});

/* ── AK 9: gespeicherte Wahl gilt als Spalte, sonst die Vorgabe; fieberSchluessel unverändert ── */
test('AK 9: Wahl „Reviews“ zählt #3 in „Reviews“ als erledigt (2 von 4), Wahl „Abnahme“ (keine Spalte) gilt als Vorgabe (1 von 4)', () => {
  for (const bew of [bewK(), bewZwilling()]) {
    const f = filter({});
    const reviews = fieberTag(bew, f, '2026-11-05', 'Reviews'), abnahme = fieberTag(bew, f, '2026-11-05', 'Abnahme');
    assert.deepStrictEqual([reviews.erledigt, reviews.umfang], [2, 4]);
    assert.deepStrictEqual([abnahme.erledigt, abnahme.umfang], [1, 4]);
    assert.strictEqual(B.zielblock(bew, f, 'Abnahme').verschwunden, 'Abnahme', 'die Wahl nennt keine Spalte');
  }
});

/** Am Stand vor der Karte (`266ce20d`, inhaltlich gleich `941c7f03`) mit dem dortigen web/berichte.js erzeugt (B1159). */
const SCHLUESSEL_OHNE_WAHL = '{"v":2,"start":"2026-11-01","filter":{"ohneFarben":[],"ohneSpalten":[],"personen":[],"labels":[],"messbasisTage":90}}';
const SCHLUESSEL_REVIEWS = '{"v":2,"start":"2026-11-01","filter":{"ohneFarben":[],"ohneSpalten":[],"personen":[],"labels":[],"messbasisTage":90},"ziel":"Reviews"}';

test('AK 9: fieberSchluessel ergibt ohne Wahl und mit Wahl „Reviews“ dieselben Zeichenfolgen wie vor der Karte', () => {
  assert.strictEqual(B.fieberSchluessel(START, filter({})), SCHLUESSEL_OHNE_WAHL);
  assert.strictEqual(B.fieberSchluessel(START, filter({}), 'Reviews'), SCHLUESSEL_REVIEWS);
});

/* ── AK 16: Fieber-Tage JoinPuya vor und nach der Karte (Legacy-Probe von Hand, B1166) ── */
/** R00223_JOPU = Ordner mit `bewegungen-alt.json` (Programm vor der Karte) und `bewegungen-neu.json` (dieses Programm) aus
    tests/akzeptanz_r00223.rs `ak16_…`, dazu `fieber-alt.json`: die Fieber-Tage, mit dem web/berichte.js vor der Karte gerechnet. */
const JOPU = process.env.R00223_JOPU;
test('AK 16: fieberTag ohne Wahl an 2026-11-10, -15, -20 gleich wie mit dem Programm vor der Karte', { skip: !JOPU && 'R00223_JOPU fehlt (Legacy-Probe von Hand)' }, () => {
  const lies = n => JSON.parse(fs.readFileSync(path.join(JOPU, n), 'utf8'));
  const bew = lies('bewegungen-neu.json'), vorher = lies('fieber-alt.json');
  const nachher = vorher.map(t => B.fieberTag(bew, filter({}), mitDatei, t.datum, bew.phasen, t.start, null));
  assert.deepStrictEqual(nachher.map(t => [t.datum, t.erledigt, t.umfang, t.ende7, t.ende5]), vorher.map(t => [t.datum, t.erledigt, t.umfang, t.ende7, t.ende5]));
});

/* ── AK 14, 15: Durchsetzung (ADR-0034 N4 Regel 5) und README ── */
const WURZEL = path.resolve(__dirname, '../..');
/** Jede Zeile unter `src` und `web` als `datei:nr:text`, Pfade relativ zur Wurzel (wie `rg -n … src web`). */
function zeilen() {
  const liste = [];
  const gehe = ordner => {
    for (const e of fs.readdirSync(path.join(WURZEL, ordner), { withFileTypes: true })) {
      const rel = `${ordner}/${e.name}`;
      if (e.isDirectory()) gehe(rel);
      else if (!/\.(woff2|png|ico|svg)$/.test(e.name)) fs.readFileSync(path.join(WURZEL, rel), 'utf8').split('\n').forEach((t, i) => liste.push({ datei: rel, nr: i + 1, text: t }));
    }
  };
  gehe('src');
  gehe('web');
  return liste;
}
const zeigen = l => l.map(z => `${z.datei}:${z.nr}: ${z.text.trim().slice(0, 140)}`);

test('AK 14: phasen, column-phases, spaltenphasen, uebersprungen stehen in src und web nur in Zeilen mit „ADR-0034“', () => {
  const treffer = zeilen().filter(z => /phasen|column-phases|spaltenphasen|uebersprungen/i.test(z.text) && !z.text.includes('ADR-0034'));
  assert.deepStrictEqual(zeigen(treffer), []);
});

/** Die erlaubten Stellen aus R00223 „Durchsetzung“: Durchläufe, „Speicherphase“, Kommentare mit ADR-0034. */
function erlaubt(z) {
  if (z.datei === 'src/dienst/durchlaeufe.rs' || z.text.includes('ADR-0034') || /durchlauf|durchl[äa]ufe|kanbanD-runs/i.test(z.text)) return true;
  if (z.datei === 'src/git/arbeitsrepo.rs' && /[Ss]peicherphase/.test(z.text)) return true;
  // was danach bleibt, gehört zur Zeile `kanbanD-runs`, zu `Durchlauf` oder zur Tabelle „DURCHLÄUFE“ (d.phase)
  if (['src/format/aufgabe.rs', 'src/modell/aufgabe.rs'].includes(z.datei)) return /\bphase\b/.test(z.text) && !/phasen/i.test(z.text);
  return z.datei === 'web/ansicht.js' && z.text.includes('d.phase');
}

test('AK 14: das Wort „phase“ steht in src und web nur an den erlaubten Stellen', () => {
  assert.deepStrictEqual(zeigen(zeilen().filter(z => /phase/i.test(z.text) && !erlaubt(z))), []);
});

test('AK 14: das Kürzel des Phasennamens am Spaltenkopf (.v.ph, ph:) steht nirgends in web', () => {
  assert.deepStrictEqual(zeigen(zeilen().filter(z => z.datei.startsWith('web/') && /\.v\.ph\b|ph:/.test(z.text))), []);
});

test('AK 15: README nennt „phase“ nur bei den Durchläufen, ohne Absatz „Phasen als Spalten“ und ohne phasen in bewegungen', () => {
  const readme = fs.readFileSync(path.join(WURZEL, 'README.md'), 'utf8').split('\n');
  assert.deepStrictEqual(readme.filter(z => /phase/i.test(z) && !/durchl[äa]u/i.test(z)).map(z => z.slice(0, 140)), []);
  assert.ok(!readme.some(z => z.includes('Phasen als Spalten')));
  const bewegungen = readme.filter(z => z.includes('/api/berichte/bewegungen'));
  assert.ok(bewegungen.length > 0 && bewegungen.every(z => !z.includes('phasen')));
});
