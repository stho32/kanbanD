// R00235 B1216: Aufklappplan in der gruppierten Folge (ADR-0042 Punkt 1, ADR-0033 Punkt 5 und N1.4) — Doku und große neue Dateien
// zählen nicht und unterbrechen nicht, „die erste Datei immer“ gilt für die erste, die öffnen darf.
const test = require('node:test');
const assert = require('node:assert');
const { aufklappPlan, aufklappPlanSeite, BUDGET_ZEILEN } = require('../../web/diff.js');

// n gezeichnete Zeilen: ein Hunk-Kopf und n − 1 Zeilen (R00207 FA 6)
const patchMit = n => '@@ -1 +1 @@\n' + '+x\n'.repeat(n - 1);
const geaendert = (pfad, n) => ({ neu: pfad, alt: pfad, status: 'M', plus: n - 1, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: patchMit(n) });
const neu = (pfad, plus) => ({ ...geaendert(pfad, plus + 1), status: 'A', alt: null, plus });
const voll = () => ({ rest: BUDGET_ZEILEN, gesperrt: false, erste: true });

test('AK 6 K-Budget: b, e, f und c offen; d (A +600), g (12.501 > 10.000) und a (Doku) zu', () => {
  const kBudget = [geaendert('Dokumentation/a.md', 2500), geaendert('src/b.rs', 2500), neu('src/d.rs', 600), geaendert('src/e.rs', 2500), geaendert('src/f.rs', 2500), geaendert('tests/c.rs', 2500), geaendert('tests/g.rs', 2501)];
  assert.deepStrictEqual(aufklappPlan(kBudget, []), [false, true, false, true, true, true, false]);
  const seite = aufklappPlanSeite(kBudget, [], voll());
  assert.deepStrictEqual(seite.budgetZu, [false, false, false, false, false, false, true], 'nur g ist wegen des Budgets zu (Satz „Der Patch ist groß …“, AK 5)');
});

test('AK 6 Einheitenprobe: Doku zu 11.000 Zeilen an erster Stelle, danach Code zu 10.500 — der Code öffnet, die Doku bleibt zu', () => {
  assert.deepStrictEqual(aufklappPlan([geaendert('README.md', 11000), geaendert('src/a.rs', 10500)], []), [false, true]);
});

test('AK 6 gruppierte Folge statt API (Mutant m7): ein Test vor dem Code in der API — der Code zählt zuerst', () => {
  assert.deepStrictEqual(aufklappPlan([geaendert('tests/t.rs', 6000), geaendert('src/a.rs', 6000)], []), [false, true]);
});

test('AK 5 Grenze 500/501: A +500 offen, A +501 und A +1.240 zu, M +600 offen (Schwelle nur für neue Dateien)', () => {
  const kRand = [neu('tests/fixtures/genau-500.json', 500), neu('tests/fixtures/genau-501.json', 501), neu('src/grosse-antwort.json', 1240), geaendert('src/lang.rs', 601)];
  assert.deepStrictEqual(aufklappPlan(kRand, []), [true, false, false, true]);
});

test('große neue Datei unterbricht nicht: danach öffnet die nächste weiter nach dem Budget', () => {
  assert.deepStrictEqual(aufklappPlan([neu('src/gross.rs', 9000), geaendert('src/a.rs', 9000), geaendert('src/b.rs', 900)], []), [false, true, true]);
});

test('seitenweit (ADR-0033 N1.4): die Abschnitte teilen das Budget in gruppierter Folge, Doku zählt in keinem', () => {
  const kd = aufklappPlanSeite([geaendert('README.md', 9000), geaendert('src/a.rs', 9000)], [], voll());
  assert.deepStrictEqual(kd.offen, [false, true]);
  assert.strictEqual(kd.stand.rest, 1000);
  const wb = aufklappPlanSeite([geaendert('docs/b.md', 10), geaendert('b.js', 2000)], [], kd.stand);
  assert.deepStrictEqual(wb.offen, [false, false]);
});

test('seitenweit: besteht der erste Abschnitt nur aus Doku, ist die erste Code-Datei des nächsten „die erste“ und öffnet über das Budget', () => {
  const kd = aufklappPlanSeite([geaendert('Dokumentation/x.md', 11000)], [], voll());
  assert.deepStrictEqual(kd.offen, [false]);
  assert.strictEqual(kd.stand.erste, true);
  const wb = aufklappPlanSeite([geaendert('b.js', 10500)], [], kd.stand);
  assert.deepStrictEqual(wb.offen, [true]);
});

test('Folge-Datei nach ihrem Pfad: eine Folge unter docs/ zählt nicht', () => {
  const folgeDoku = { pfad: 'docs/x.md', plus: 9000, minus: 0, schritte: [{ ...geaendert('docs/x.md', 9000) }] };
  assert.deepStrictEqual(aufklappPlanSeite([folgeDoku, geaendert('src/a.rs', 9500)], [], voll()).offen, [false, true]);
});
