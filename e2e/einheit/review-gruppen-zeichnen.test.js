// R00235 B1217/B1218: Gruppen der Review-Seite als HTML-Text (web/diff.js, web/gesamt.js) — ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');
const g = require('../../web/gesamt.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ohneTags = html => html.replace(/<[^>]+>/g, '');
const patchMit = n => '@@ -1 +1 @@\n' + '+x\n'.repeat(n - 1);
const datei = (neu, zusatz = {}) => ({ neu, alt: neu, status: 'M', plus: 1, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-a\n+b\n', ...zusatz });
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
const offen = (zusatz = {}) => ({ offen: true, laden: null, fehler: null, ...zusatz });
const zu = (zusatz = {}) => ({ offen: false, laden: null, fehler: null, ...zusatz });
const STANDARD = { code: true, test: true, doku: false };

test('inselHtml K-Art: Gruppen Code, Tests, Doku und Planung als h2 mit Knopf, Dateien als h3; Doku zu und verborgen', () => {
  const html = d.inselHtml('1:abc', K_ART, K_ART.map(() => offen()), [], esc, STANDARD);
  const koepfe = [...html.matchAll(/<h2 class="rv-gh"><button type="button" class="rv-gk" id="rv-gk-(\w+)" data-act="review-gruppe" data-arg="(\w+)" aria-expanded="(\w+)" aria-controls="rv-gc-(\w+)">(.*?)<\/button><\/h2>/g)];
  assert.deepStrictEqual(koepfe.map(k => [k[1], k[2], k[3], k[4], ohneTags(k[5])]), [
    ['code', 'code', 'true', 'code', 'Code 1 Datei · +2 −3'],
    ['test', 'test', 'true', 'test', 'Tests 4 Dateien · +297 −3'],
    ['doku', 'doku', 'false', 'doku', 'Doku und Planung 3 Dateien · +3 −0'],
  ]);
  assert.match(html, /<div class="rv-gc" id="rv-gc-doku" hidden>/);
  assert.match(html, /<div class="rv-gc" id="rv-gc-code">/);
  const reihenfolge = [...html.matchAll(/id="rv-d(\d+)"/g)].map(m => +m[1]);
  assert.deepStrictEqual(reihenfolge, [7, 3, 4, 5, 6, 0, 1, 2]);
  assert.strictEqual((html.match(/<h3 class="df-h">/g) || []).length, 8);
});

test('inselHtml: eine Gruppe mit einer Datei heißt „1 Datei“, nicht „1 Dateien“ (Mutant m8); Tausenderpunkt', () => {
  const html = ohneTags(d.inselHtml('1:abc', [datei('src/a.rs', { plus: 1240, minus: 0 })], [offen()], [], esc, STANDARD));
  assert.match(html, /Code 1 Datei · \+1\.240 −0/);
});

test('dateilisteHtml K-Art: DATEIEN 8, je Gruppe ein Kopf (h4) mit Zahlen und eine Liste; Test-Hinweise nur bei geänderten Tests', () => {
  const html = d.dateilisteHtml(K_ART, esc);
  assert.match(html, /<h3 class="rv-ue">DATEIEN <span class="mono">8<\/span><\/h3>/);
  const koepfe = [...html.matchAll(/<h4 class="rv-gl">(.*?)<\/h4>/g)].map(m => ohneTags(m[1]));
  assert.deepStrictEqual(koepfe, ['Code 1 Datei · +2 −3', 'Tests 4 Dateien · +297 −3', 'Doku und Planung 3 Dateien · +3 −0']);
  const zeilen = [...html.matchAll(/data-arg="(\d+)">(.*?)<\/button>/g)].map(m => [+m[1], /bestehender Test geändert/.test(m[2])]);
  assert.deepStrictEqual(zeilen, [[7, false], [3, true], [4, false], [5, true], [6, false], [0, false], [1, false], [2, false]]);
});

test('Größenbalken: aria-hidden, je Teil der Anteil an der größten Summe der Gruppe, eine 0 ergibt keinen Teil (AK 7)', () => {
  const html = d.dateilisteHtml(K_ART, esc);
  const balken = i => new RegExp(`data-arg="${i}">.*?<span class="rv-gb" aria-hidden="true">(.*?)</span>`).exec(html)[1];
  assert.strictEqual(balken(7), '<i class="rv-gb-p" style="--anteil:0.4"></i><i class="rv-gb-m" style="--anteil:0.6"></i>');
  assert.strictEqual(balken(6), '<i class="rv-gb-p" style="--anteil:1"></i>');
  assert.strictEqual(balken(0), '<i class="rv-gb-p" style="--anteil:1"></i>', 'Doku: größte Summe 1');
});

test('Kopf einer Datei: Test-Hinweis „bestehender Test geändert“ bzw. „Test gelöscht“, an Code nie', () => {
  const kopf = x => /<button[^>]*class="df-k"[^>]*>(.*?)<\/button>/.exec(d.dateiHtml(x, 0, offen(), [], esc))[1];
  assert.match(kopf(K_ART[3]), /<span class="rv-th">bestehender Test geändert<\/span>/);
  assert.match(kopf(datei('tests/weg.rs', { status: 'D', neu: null, minus: 118, patch: undefined })), /<span class="rv-th">Test gelöscht<\/span>/);
  assert.doesNotMatch(kopf(K_ART[7]), /rv-th/);
  assert.doesNotMatch(kopf(K_ART[4]), /rv-th/);
});

test('große neue Datei zu: Satz und „Änderungen anzeigen“ im sichtbaren Teil, der Knopf klappt wie der Kopf (AK 5)', () => {
  const neu = datei('tests/fixtures/genau-501.json', { status: 'A', alt: null, plus: 501, patch: patchMit(502) });
  const html = d.dateiHtml(neu, 4, zu(), [], esc);
  const sichtbar = html.replace(/<div class="df-inhalt"[^>]*hidden>.*?<\/div><\/section>$/, '');
  assert.match(ohneTags(sichtbar), /Neue Datei mit 501 Zeilen, beginnt eingeklappt\.Änderungen anzeigen/);
  assert.match(sichtbar, /<button type="button" class="btn" data-act="review-klappe" data-arg="4" aria-describedby="rv-dk4">Änderungen anzeigen<\/button>/);
  assert.match(ohneTags(html), /\+501 −0/);
  assert.match(ohneTags(d.dateiHtml({ ...neu, plus: 1240 }, 4, zu(), [], esc)), /Neue Datei mit 1\.240 Zeilen, beginnt eingeklappt\./);
  const auf = d.dateiHtml(neu, 4, offen(), [], esc);
  assert.doesNotMatch(auf, /Neue Datei mit/);
  assert.strictEqual((auf.match(/<tr /g) || []).length, 502);
});

test('wegen des Budgets zu: der bestehende Satz „Der Patch ist groß (<n> Zeilen) …“ mit „Änderungen anzeigen“, nie „Neue Datei“ (AK 5)', () => {
  const g2501 = datei('tests/g.rs', { plus: 2500, minus: 1, patch: patchMit(2501) });
  const html = ohneTags(d.dateiHtml(g2501, 6, zu({ budgetZu: true }), [], esc));
  assert.match(html, /Der Patch ist groß \(2\.501 Zeilen\) und wird erst auf Wunsch geladen\.Änderungen anzeigen/);
  assert.doesNotMatch(html, /Neue Datei/);
  assert.doesNotMatch(ohneTags(d.dateiHtml(g2501, 6, zu(), [], esc)), /Der Patch ist groß/, 'selbst zugeklappt: kein Satz');
});

test('Alle Änderungen (AK 8): je Abschnitt Gruppen als h3 unter der Anwendung (h2), Dateien h4, Folge-Datei docs/x.md als Doku', () => {
  const folge = { pfad: 'docs/x.md', plus: 2, minus: 0, binaer: false, schritte: [{ commit: 'kd:' + 'a'.repeat(40), ...datei('docs/x.md') }] };
  const antwort = { anwendung: 'kd', commits: [{ verweis: 'kd:' + 'a'.repeat(40), hash: 'a'.repeat(40), titel: 'K', autor: 'sh', datum: '2026-11-20T10:00:00+01:00', plus: 1, minus: 0, dateien: 1 }],
    dateien: [datei('README.md'), datei('tests/a_test.rs', { status: 'A', alt: null }), datei('src/a.rs'), folge], hinweise: [] };
  const ab = { status: 'da', kuerzel: 'kd', antwort, staende: antwort.dateien.map(() => offen()), gruppen: { code: true, test: true, doku: false } };
  const ctx = { esc, adresse: v => `#r/${v}`, titelVon: () => null };
  const html = g.abschnittHtml(ab, 1, ctx);
  const koepfe = [...html.matchAll(/<h3 class="rv-gh"><button type="button" class="rv-gk" id="rv-gk1-(\w+)" data-act="review-gruppe" data-arg="1:(\w+)" aria-expanded="(\w+)"/g)].map(m => [m[1], m[2], m[3]]);
  assert.deepStrictEqual(koepfe, [['code', 'code', 'true'], ['test', 'test', 'true'], ['doku', 'doku', 'false']]);
  assert.deepStrictEqual([...html.matchAll(/<section class="df[^"]*" id="rv-d1-(\d+)"/g)].map(m => +m[1]), [2, 1, 0, 3]);
  assert.strictEqual((html.match(/<h4 class="df-h">/g) || []).length, 4, 'Netto- und Folge-Dateien h4');
  assert.match(html, /<div class="rv-gc" id="rv-gc1-doku" hidden>/);
  assert.match(html, /<div class="rv-abs-rail" id="rv-a1-rail">/);
  assert.deepStrictEqual([...html.matchAll(/<h4 class="rv-gl">(.*?)<\/h4>/g)].map(m => ohneTags(m[1])), ['Code 1 Datei · +1 −0', 'Tests 1 Datei · +1 −0', 'Doku und Planung 2 Dateien · +3 −0']);
  assert.deepStrictEqual([...html.matchAll(/data-act="review-datei" data-arg="1:(\d+)"/g)].map(m => +m[1]), [2, 1, 0, 3]);
});
