// R00265 B1440: der Zustand einer Datei in „Alle Änderungen“ (gesehen, geändert, offen) aus der Gesehen-Menge — reine Rechnung
// (ADR-0042 N8.4 Punkt 2 und 3). Der Leseweg zerlegt einen `alle`-Schlüssel an U+0000 in genau vier Felder; ein fremder Schlüssel
// wird nur auf Gleichheit geprüft, nie zerlegt. Der Zähler zählt nur `gesehen`.
const test = require('node:test');
const assert = require('node:assert');
const { gesehenZustand, alleSchluesselTeile, alleDateiSchluessel, commitDateiSchluessel, fingerabdruck } = require('../../web/review-uebersicht.js');

const datei = (zusatz = {}) => ({ neu: 'src/a.rs', alt: 'src/a.rs', status: 'M', plus: 1, minus: 1, binaer: false, schritte: undefined, ...zusatz });
const mitFingerabdruck = (anwendung, d) => alleDateiSchluessel(anwendung, d);

/* ── Der Zustand aus der Menge (AK 1) ── */

test('der genaue Schlüssel steht in der Menge → gesehen; er schließt geändert aus', () => {
  const d = datei();
  assert.strictEqual(gesehenZustand(new Set([mitFingerabdruck('kd', d)]), 'kd', d), 'gesehen');
  // neben dem genauen Schlüssel steht ein älterer derselben Datei: trotzdem gesehen, nie geändert
  const alt = datei({ plus: 5, minus: 0 });
  assert.strictEqual(gesehenZustand([mitFingerabdruck('kd', alt), mitFingerabdruck('kd', d)], 'kd', d), 'gesehen');
});

test('nur ein Schlüssel derselben (Anwendung, Pfad) mit anderem Fingerabdruck → geändert', () => {
  const alt = datei({ plus: 3, minus: 0 });
  assert.notStrictEqual(fingerabdruck(alt), fingerabdruck(datei()));
  assert.strictEqual(gesehenZustand([mitFingerabdruck('kd', alt)], 'kd', datei()), 'geaendert');
});

test('kein Schlüssel dieser (Anwendung, Pfad) → offen; leere Menge → offen', () => {
  assert.strictEqual(gesehenZustand([], 'kd', datei()), 'offen');
  assert.strictEqual(gesehenZustand(new Set(), 'kd', datei()), 'offen');
  assert.strictEqual(gesehenZustand([mitFingerabdruck('kd', datei({ neu: 'src/b.rs', alt: 'src/b.rs' }))], 'kd', datei()), 'offen');
});

test('eine andere Anwendung oder ein anderer Pfad ergibt offen, nicht geändert', () => {
  const d = datei();
  assert.strictEqual(gesehenZustand([mitFingerabdruck('wb', d)], 'kd', d), 'offen', 'andere Anwendung');
  assert.strictEqual(gesehenZustand([mitFingerabdruck('kd', datei({ neu: 'src/x.rs', alt: 'src/x.rs' }))], 'kd', d), 'offen', 'anderer Pfad');
  // derselbe Pfad in einer anderen Anwendung genügt nie
  const wbSchluessel = mitFingerabdruck('wb', datei({ plus: 9 }));
  assert.strictEqual(gesehenZustand([wbSchluessel], 'kd', d), 'offen');
});

test('ein Ein-Commit-Schlüssel wird nie als `alle`-Schlüssel gelesen', () => {
  const d = datei();
  const commitSchluessel = commitDateiSchluessel('a'.repeat(40), d);
  assert.strictEqual(commitSchluessel.split('\u0000').length, 2, 'zwei Felder');
  assert.strictEqual(gesehenZustand([commitSchluessel], 'kd', d), 'offen');
  // auch wenn er einen Teil des Pfades trägt: nie geändert, nie gesehen
  assert.strictEqual(gesehenZustand([`alle\u0000kd\u0000src/a.rs`], 'kd', d), 'offen', 'drei Felder sind fremd');
  assert.strictEqual(gesehenZustand([`fremd\u0000kd\u0000src/a.rs\u0000${fingerabdruck(d)}`], 'kd', d), 'offen', 'erstes Feld nicht alle');
});

test('ein Schlüssel ohne vier Felder ist fremd und wird nur auf Gleichheit geprüft', () => {
  const d = datei();
  assert.strictEqual(alleSchluesselTeile(`alle\u0000kd\u0000src/a.rs`), null);
  assert.strictEqual(alleSchluesselTeile(`alle\u0000kd\u0000src/a.rs\u0000x\u0000y`), null);
  assert.strictEqual(alleSchluesselTeile(`x\u0000kd\u0000src/a.rs\u0000y`), null);
  assert.strictEqual(alleSchluesselTeile(commitDateiSchluessel('b'.repeat(40), d)), null);
  assert.strictEqual(alleSchluesselTeile(null), null);
  // der genaue Schlüssel ist trotz fehlerhafter Form gesehen, wenn er zeichengleich dasteht
  const schief = mitFingerabdruck('kd', d);
  assert.strictEqual(gesehenZustand([schief], 'kd', d), 'gesehen');
});

/* ── Rundlauf durch den lesenden Parser (ADR-0042 N8.4 Punkt 2) ── */

test('Rundlauf: vier Felder, wieder zusammengesetzt zeichengleich — Bidi/Steuerzeichen im Pfad, Leerzeichen in der Anwendung', () => {
  const pfade = ['src/a.rs', 'bidi-\u202Edatei.dat', 'mit\u001Bsteuer\t.dat', 'ordner/datei mit leerzeichen.rs', '‮nur‮bidi'];
  for (const pfad of pfade) {
    const d = datei({ neu: pfad, alt: pfad });
    const schluessel = mitFingerabdruck('kd', d);
    const felder = alleSchluesselTeile(schluessel);
    assert.deepStrictEqual(felder, ['alle', 'kd', pfad, fingerabdruck(d)], pfad);
    assert.strictEqual(felder.join('\u0000'), schluessel, `Rundlauf ${pfad}`);
  }
  const anwendung = 'meine Anwendung';
  const d = datei();
  const schluessel = mitFingerabdruck(anwendung, d);
  assert.strictEqual(alleSchluesselTeile(schluessel).join('\u0000'), schluessel);
  assert.strictEqual(alleSchluesselTeile(schluessel)[1], anwendung);
});

/* ── Zähler (FA 3, ADR-0042 N8.4 Punkt 4) ── */

test('Zähler-Rechnung: eine gesehen, eine geändert, eine offen → nur die gesehen zählt („1 von 3“)', () => {
  const gesehenDatei = datei({ neu: 'src/a.rs', alt: 'src/a.rs' });
  const geaenderteDatei = datei({ neu: 'src/b.rs', alt: 'src/b.rs' });
  const offeneDatei = datei({ neu: 'src/c.rs', alt: 'src/c.rs' });
  const menge = [mitFingerabdruck('kd', gesehenDatei), mitFingerabdruck('kd', datei({ neu: 'src/b.rs', alt: 'src/b.rs', plus: 8, minus: 2 }))];
  const zustaende = [gesehenDatei, geaenderteDatei, offeneDatei].map(d => gesehenZustand(menge, 'kd', d));
  assert.deepStrictEqual(zustaende, ['gesehen', 'geaendert', 'offen']);
  assert.strictEqual(zustaende.filter(z => z === 'gesehen').length, 1);
});
