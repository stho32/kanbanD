// R00235 B1214: Art einer Datei, Gruppen, Test-Hinweis, große neue Datei und Größenbalken (web/review-uebersicht.js) — rein, ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const u = require('../../web/review-uebersicht.js');

const datei = (neu, zusatz = {}) => ({ neu, alt: neu, status: 'M', plus: 1, minus: 0, ...zusatz });
// K-Art aus R00235 „Ausgangslage“, in der Reihenfolge der API (so geformt wie b0bea5fd aus #247)
const K_ART = [
  datei('Anforderungen/R00001.md'),
  datei('Dokumentation/Gelerntes.md'),
  datei('Schaetzungen/S00001.md'),
  datei('e2e/einheit/kontrast.test.js', { plus: 2, minus: 1 }),
  datei('e2e/einheit/sperrform.test.js', { status: 'A', alt: null, plus: 143 }),
  datei('e2e/tests/r00219-ansicht.spec.js', { plus: 2, minus: 2 }),
  datei('e2e/tests/r00229-sperrform.spec.js', { status: 'A', alt: null, plus: 150 }),
  datei('web/kd-app.css', { plus: 2, minus: 3 }),
];

test('dateiArt: die Pfade von #247 ergeben 1 Code, 4 Tests, 3 Doku (ADR-0042 „Durchsetzung“)', () => {
  assert.deepStrictEqual(K_ART.map(d => u.dateiArt(d.neu)), ['doku', 'doku', 'doku', 'test', 'test', 'test', 'test', 'code']);
});

test('dateiArt: Abnahme-Probe aus ADR-0042 — test vor doku vor code, im Zweifel code', () => {
  const erwartet = {
    'src/foo_test.go': 'test', 'FooTests.cs': 'test', 'tests/fixtures/a.md': 'test',
    'README.md': 'doku',
    'Cargo.toml': 'code', '.github/workflows/ci.yml': 'code',
  };
  for (const [pfad, art] of Object.entries(erwartet)) assert.strictEqual(u.dateiArt(pfad), art, pfad);
});

test('dateiArt: Ordner- und Namensregeln für test, Groß- und Kleinschreibung der Ordner egal', () => {
  const tests = ['TESTS/a.rs', 'src/Test/a.rs', 'a/spec/b.rb', 'specs/x.js', 'x/__tests__/y.js', 'E2E/z.js',
    'src/a.test.ts', 'a.spec.js', 'lib/a_spec.rb', 'test_a.py', 'FooTest.java', 'src/sperre.test.js'];
  for (const pfad of tests) assert.strictEqual(u.dateiArt(pfad), 'test', pfad);
  const keine = ['src/latest.rs', 'src/contest.rs', 'src/testen.rs', 'attest/a.rs', 'src/a.test', 'teststand.rs'];
  for (const pfad of keine) assert.strictEqual(u.dateiArt(pfad), 'code', pfad);
});

test('dateiArt: Endungen und erster Ordner für doku; der erste Ordner zählt nur an erster Stelle', () => {
  const doku = ['a.markdown', 'b.TXT', 'c.adoc', 'd.rst', 'README.MD', 'docs/x.md', 'docs/bild.png', 'doc/a.rs',
    'Documentation/a.html', 'Requirements/R1.yml', 'Anforderungen/user-stories/R1.md', 'dokumentation/a.json'];
  for (const pfad of doku) assert.strictEqual(u.dateiArt(pfad), 'doku', pfad);
  for (const pfad of ['src/docs/a.rs', 'a.dat', 'web/app.js', 'Makefile', 'mdbuch.rs']) assert.strictEqual(u.dateiArt(pfad), 'code', pfad);
});

test('dateiGruppen K-Art: Code, Tests, Doku und Planung in dieser Reihenfolge, innerhalb in der Reihenfolge der API, mit Summen', () => {
  assert.deepStrictEqual(u.dateiGruppen(K_ART), [
    { art: 'code', name: 'Code', indizes: [7], n: 1, plus: 2, minus: 3 },
    { art: 'test', name: 'Tests', indizes: [3, 4, 5, 6], n: 4, plus: 297, minus: 3 },
    { art: 'doku', name: 'Doku und Planung', indizes: [0, 1, 2], n: 3, plus: 3, minus: 0 },
  ]);
});

test('dateiGruppen: leere Gruppen entfallen; nur Doku (K-Doku) ergibt eine Gruppe; keine Datei keine Gruppe', () => {
  const kDoku = [datei('Dokumentation/x.md'), datei('README.md')];
  assert.deepStrictEqual(u.dateiGruppen(kDoku).map(g => [g.name, g.n, g.plus, g.minus]), [['Doku und Planung', 2, 2, 0]]);
  assert.deepStrictEqual(u.dateiGruppen([]), []);
  assert.deepStrictEqual(u.dateiGruppen([datei('src/a.rs'), datei('b.js')]).map(g => [g.art, g.indizes]), [['code', [0, 1]]]);
});

test('dateiGruppen: Folge-Dateien (ADR-0033 N1.4) werden nach ihrem `pfad` eingeteilt, gelöschte nach dem alten Pfad', () => {
  const folge = { pfad: 'docs/x.md', plus: 4, minus: 1, schritte: [] };
  const geloescht = { neu: null, alt: 'tests/weg.rs', status: 'D', plus: 0, minus: 7 };
  const gruppen = u.dateiGruppen([folge, geloescht, datei('b.js')]);
  assert.deepStrictEqual(gruppen.map(g => [g.art, g.indizes]), [['code', [2]], ['test', [1]], ['doku', [0]]]);
  assert.strictEqual(u.dateiArt(u.dateiPfad(folge)), 'doku');
});

test('gruppierteFolge: die Indizes der API in der Reihenfolge der Gruppen', () => {
  assert.deepStrictEqual(u.gruppierteFolge(K_ART), [7, 3, 4, 5, 6, 0, 1, 2]);
});

test('testHinweis: „bestehender Test geändert“ bei M oder R mit entfernter Zeile, „Test gelöscht“ bei D, sonst keiner (FA 5)', () => {
  const t = (zusatz) => u.testHinweis(datei('tests/a.rs', zusatz));
  assert.strictEqual(t({ status: 'M', minus: 1 }), 'bestehender Test geändert');
  assert.strictEqual(t({ status: 'R', alt: 'tests/alt.rs', minus: 2 }), 'bestehender Test geändert');
  assert.strictEqual(t({ status: 'D', neu: null, minus: 118 }), 'Test gelöscht');
  assert.strictEqual(t({ status: 'M', plus: 4, minus: 0 }), '', 'M −0 ist die Grenze: kein Hinweis');
  assert.strictEqual(t({ status: 'R', minus: 0 }), '');
  assert.strictEqual(t({ status: 'A', plus: 143, minus: 0 }), '');
  assert.strictEqual(u.testHinweis(datei('web/kd-app.css', { minus: 3 })), '', 'Code mit −3 trägt keinen Hinweis');
  assert.strictEqual(u.testHinweis(datei('README.md', { status: 'D', minus: 3 })), '', 'gelöschte Doku trägt keinen Hinweis');
});

test('grosseNeueDatei: nur `A` mit mehr als 500 hinzugefügten Zeilen (Grenze 500/501), nie M', () => {
  assert.strictEqual(u.grosseNeueDatei(datei('tests/fixtures/genau-500.json', { status: 'A', plus: 500 })), false);
  assert.strictEqual(u.grosseNeueDatei(datei('tests/fixtures/genau-501.json', { status: 'A', plus: 501 })), true);
  assert.strictEqual(u.grosseNeueDatei(datei('src/grosse-antwort.json', { status: 'A', plus: 1240 })), true);
  assert.strictEqual(u.grosseNeueDatei(datei('src/lang.rs', { status: 'M', plus: 600 })), false);
  assert.strictEqual(u.grosseNeueDatei({ pfad: 'a.rs', plus: 900, minus: 0, schritte: [] }), false, 'Folge-Datei hat keinen Netto-Zustand');
});

test('groessteSumme: größte Summe plus + minus der Indizes einer Gruppe; balkenTeile als Anteil daran (AK 7, Skala je Gruppe)', () => {
  const [code, tests, doku] = u.dateiGruppen(K_ART);
  assert.deepStrictEqual([code, tests, doku].map(g => u.groessteSumme(K_ART, g.indizes)), [5, 150, 1]);
  assert.deepStrictEqual(u.balkenTeile(K_ART[7], 5), { plus: 0.4, minus: 0.6 });
  assert.deepStrictEqual(u.balkenTeile(K_ART[6], 150), { plus: 1, minus: 0 });
  assert.strictEqual(Math.round(u.balkenTeile(K_ART[4], 150).plus * 44 * 10) / 10, 41.9);
  assert.deepStrictEqual(u.balkenTeile(K_ART[3], 150), { plus: 2 / 150, minus: 1 / 150 });
  assert.deepStrictEqual(u.balkenTeile(K_ART[0], 1), { plus: 1, minus: 0 });
  assert.deepStrictEqual(u.balkenTeile({ plus: 0, minus: 0 }, 0), { plus: 0, minus: 0 }, 'ohne Zeilen kein Teil, keine Division durch 0');
});
