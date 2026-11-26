// R00207: reine Rechnung der Review-Seite (web/diff.js) — Folge „i von n“, ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const { folge } = require('../../web/diff.js');

const hash = c => c.repeat(40);
const e = (c, zustand) => ({ verweis: `kd:${hash(c)}`, anwendung: 'kd', hash: zustand === 'fehlt' ? undefined : hash(c), zustand });
// Aufgabe #1 aus R00207: Liste K3, W1, V1, R1, V2 — V2 fehlt, die Folge ist K3, W1, V1, R1 (n = 4)
const LISTE = [e('a', 'auf_zweig'), e('b', 'auf_zweig'), e('c', 'verwaist'), e('d', 'auf_zweig'), e('e', 'fehlt')];

test('folge: Einträge mit Diff in Reihenfolge der Antwort; i über den vollen Hash, Nachbarn als volle Verweise', () => {
  assert.deepStrictEqual(folge(LISTE, hash('c')), { art: 'folge', i: 3, n: 4, zurueck: `kd:${hash('b')}`, vor: `kd:${hash('d')}`, erster: `kd:${hash('a')}` });
});

test('folge Ränder (d): am ersten kein zurück, am letzten kein vor; n = 1 hat keins von beiden', () => {
  const erster = folge(LISTE, hash('a')), letzter = folge(LISTE, hash('d'));
  assert.deepStrictEqual([erster.i, erster.zurueck, erster.vor], [1, null, `kd:${hash('b')}`]);
  assert.deepStrictEqual([letzter.i, letzter.n, letzter.zurueck, letzter.vor], [4, 4, `kd:${hash('c')}`, null]);
  const einer = folge([e('a', 'verwaist')], hash('a'));
  assert.deepStrictEqual([einer.i, einer.n, einer.zurueck, einer.vor], [1, 1, null, null]);
});

test('folge Rand (a): gezählt wird über den vollen Hash der Diff-Antwort, Groß- und Kleinschreibung gleich', () => {
  assert.strictEqual(folge(LISTE, hash('C')).i, 3);
});

test('folge Rand (b): voller Hash nicht unter den Einträgen mit Diff → „fremd“ mit dem ersten Verweis; auch ein Eintrag ohne Diff zählt nicht', () => {
  assert.deepStrictEqual(folge(LISTE, hash('f')), { art: 'fremd', erster: `kd:${hash('a')}` });
  assert.deepStrictEqual(folge(LISTE, hash('e')), { art: 'fremd', erster: `kd:${hash('a')}` });
});

test('folge Rand (c): keine Einträge mit Diff (n = 0) → „keine“ mit den Einträgen ohne Diff', () => {
  const ohne = [e('e', 'fehlt'), { verweis: `xy:${hash('a')}`, anwendung: 'xy', hash: hash('a'), zustand: 'anwendung_unbekannt' }];
  assert.deepStrictEqual(folge(ohne, null), { art: 'keine', eintraege: ohne });
  assert.deepStrictEqual(folge([], hash('a')), { art: 'keine', eintraege: [] });
});

test('folge ohne Hash (Adresse ohne commit): der erste Eintrag mit Diff', () => {
  assert.deepStrictEqual(folge(LISTE, null), { art: 'erster', erster: `kd:${hash('a')}` });
});

/* ── B1018: Diff rechnen — Zeilen, Marken, Dateizustand, Aufklapp-Plan, Fehlerart ── */
const { patchZeilen, sichtbarTeile, dateiZustand, aufklappPlan, bloecke, fehlerArt, zuordnen, BUDGET_ZEILEN, BLOCK_ZEILEN } = require('../../web/diff.js');

test('patchZeilen: Nummern aus den Hunk-Köpfen, Kontext zählt beide Seiten, `\\ No newline` ohne Nummer, das letzte \\n ergibt keine Zeile', () => {
  const patch = '@@ -3,3 +3,3 @@ fn x\n a\n-b\n+B\n c\n@@ -10 +10,2 @@\n z\n+y\n\\ No newline at end of file\n';
  assert.deepStrictEqual(patchZeilen(patch), [
    { art: 'kopf', alt: null, neu: null, text: '@@ -3,3 +3,3 @@ fn x' },
    { art: 'kontext', alt: 3, neu: 3, text: 'a' },
    { art: 'minus', alt: 4, neu: null, text: 'b' },
    { art: 'plus', alt: null, neu: 4, text: 'B' },
    { art: 'kontext', alt: 5, neu: 5, text: 'c' },
    { art: 'kopf', alt: null, neu: null, text: '@@ -10 +10,2 @@' },
    { art: 'kontext', alt: 10, neu: 10, text: 'z' },
    { art: 'plus', alt: null, neu: 11, text: 'y' },
    { art: 'hinweis', alt: null, neu: null, text: '\\ No newline at end of file' },
  ]);
});

test('patchZeilen: zerlegt nur an \\n — \\r\\n behält das \\r, U+2028 bleibt in einer Zeile; @@ -0,0 +1 @@ beginnt bei 1', () => {
  const z = patchZeilen('@@ -0,0 +1,2 @@\n+a\r\n+b c\n');
  assert.strictEqual(z.length, 3);
  assert.deepStrictEqual(z[1], { art: 'plus', alt: null, neu: 1, text: 'a\r' });
  assert.deepStrictEqual(z[2], { art: 'plus', alt: null, neu: 2, text: 'b c' });
  assert.deepStrictEqual(patchZeilen('@@ -1 +0,0 @@\n-x').map(x => [x.art, x.alt]), [['kopf', null], ['minus', 1]], 'ohne abschließendes \\n');
});

test('sichtbarTeile: Bidi wird zur Marke ⟨U+202E⟩, ESC zu „␛ U+001B“, \\r am Ende zu ␍; Tab und Text bleiben — nichts wird entfernt', () => {
  assert.deepStrictEqual(sichtbarTeile('a‮b\tc\u001Bd\r'), [
    { text: 'a' },
    { marke: 'bidi', code: 'U+202E', text: '⟨U+202E⟩' },
    { text: 'b\tc' },
    { marke: 'steuer', code: 'U+001B', text: '␛ U+001B' },
    { text: 'd' },
    { marke: 'steuer', code: 'U+000D', text: '␍' },
  ]);
  for (const c of [0x202A, 0x202B, 0x202C, 0x202D, 0x202E, 0x2066, 0x2067, 0x2068, 0x2069]) {
    const teile = sichtbarTeile('x' + String.fromCodePoint(c));
    assert.strictEqual(teile[1].marke, 'bidi', c.toString(16));
  }
  assert.deepStrictEqual(sichtbarTeile('a\rb'), [{ text: 'a' }, { marke: 'steuer', code: 'U+000D', text: '␍ U+000D' }, { text: 'b' }], '\\r mitten in der Zeile mit Code');
  assert.deepStrictEqual(sichtbarTeile('\u0000\u007F'), [{ marke: 'steuer', code: 'U+0000', text: '␀ U+0000' }, { marke: 'steuer', code: 'U+007F', text: '␡ U+007F' }]);
  assert.deepStrictEqual(sichtbarTeile('nur Text '), [{ text: 'nur Text ' }]);
  assert.deepStrictEqual(sichtbarTeile(''), []);
});

const datei = (zusatz = {}) => ({ neu: 'a.dat', alt: 'a.dat', status: 'M', plus: 1, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-a\n+b\n', ...zusatz });

test('dateiZustand: zu groß (Hinweis zur Datei) vor groß vor nachladen vor binär vor patch vor ohne Inhalt', () => {
  const zuGross = [{ art: 'zu_gross_zum_anzeigen', datei: 'a.dat' }];
  assert.strictEqual(dateiZustand(datei({ gross: true, patch: undefined }), zuGross), 'zu_gross');
  assert.strictEqual(dateiZustand(datei({ gross: true, patch: undefined }), [{ art: 'zu_gross_zum_anzeigen', datei: 'b.dat' }]), 'gross');
  assert.strictEqual(dateiZustand(datei({ gross: true, patch: undefined }), [{ art: 'unbekannt', datei: 'a.dat' }]), 'gross');
  assert.strictEqual(dateiZustand(datei({ status: 'D', neu: undefined, gross: true, patch: undefined }), zuGross), 'zu_gross', 'gelöschte über alt');
  assert.strictEqual(dateiZustand(datei({ nachladen: true, patch: undefined }), []), 'nachladen');
  assert.strictEqual(dateiZustand(datei({ binaer: true, patch: undefined }), []), 'binaer');
  assert.strictEqual(dateiZustand(datei(), []), 'patch');
  assert.strictEqual(dateiZustand(datei({ patch: undefined }), []), 'ohne');
});

const mitZeilen = (n, zusatz = {}) => datei({ patch: '@@ -0,0 +1 @@\n' + '+x\n'.repeat(n - 1), ...zusatz });

test('aufklappPlan: 4 × 2.500 = 10.000 offen, die fünfte (2 Zeilen) ergäbe 10.002 → zu (R00207 #8)', () => {
  assert.strictEqual(BUDGET_ZEILEN, 10000);
  const dateien = [mitZeilen(2500), mitZeilen(2500), mitZeilen(2500), mitZeilen(2500), mitZeilen(2)];
  assert.deepStrictEqual(aufklappPlan(dateien, []), [true, true, true, true, false]);
});

test('aufklappPlan: genau 10.000 offen, 10.001 in Summe zu; die erste Datei öffnet immer, auch mit 10.001 Zeilen — danach keine', () => {
  assert.deepStrictEqual(aufklappPlan([mitZeilen(9999), mitZeilen(1)], []), [true, true]);
  assert.deepStrictEqual(aufklappPlan([mitZeilen(9999), mitZeilen(2)], []), [true, false]);
  assert.deepStrictEqual(aufklappPlan([mitZeilen(10001), mitZeilen(2)], []), [true, false]);
});

test('aufklappPlan: nach der ersten, die nicht passt, öffnet keine kleinere spätere; gelöschte und Dateien ohne patch zählen nicht und unterbrechen nicht', () => {
  assert.deepStrictEqual(aufklappPlan([mitZeilen(6000), mitZeilen(5000), mitZeilen(2)], []), [true, false, false]);
  const geloescht = mitZeilen(9000, { status: 'D', neu: undefined });
  const ohne = datei({ patch: undefined, binaer: true });
  assert.deepStrictEqual(aufklappPlan([mitZeilen(5000), geloescht, ohne, mitZeilen(5000)], []), [true, false, false, true]);
  assert.deepStrictEqual(aufklappPlan([geloescht, mitZeilen(10001)], []), [false, true], 'erste Datei mit patch, nicht die erste der Liste');
  assert.deepStrictEqual(aufklappPlan([], []), []);
});

test('bloecke: zu höchstens 500 Zeilen — 500 ist ein Block, 501 sind zwei', () => {
  assert.strictEqual(BLOCK_ZEILEN, 500);
  const z = n => Array.from({ length: n }, (_, i) => i);
  assert.deepStrictEqual(bloecke(z(500)).map(b => b.length), [500]);
  assert.deepStrictEqual(bloecke(z(501)).map(b => b.length), [500, 1]);
  assert.deepStrictEqual(bloecke(z(0)), []);
});

test('fehlerArt: 503 mit „Antwortbudget …“ ist ausgelastet, jeder andere 503 Zeitgrenze — nach Text, nicht nur nach Status', () => {
  assert.strictEqual(fehlerArt({ status: 503, fehler: 'Antwortbudget von 64 MB belegt — Diff in einigen Sekunden erneut laden' }, 'diff'), 'antwortbudget');
  assert.strictEqual(fehlerArt({ status: 503, fehler: 'Git antwortete nicht innerhalb von 10 s' }, 'diff'), 'zeitgrenze');
  assert.strictEqual(fehlerArt({ status: 503, fehler: 'kein Antwortbudget' }, 'diff'), 'zeitgrenze', 'beginnt nicht mit „Antwortbudget“');
  assert.strictEqual(fehlerArt({ status: 503, fehler: null }, 'diff'), 'zeitgrenze');
  assert.strictEqual(fehlerArt({ status: 404, fehler: 'x' }, 'diff'), 'kein_diff');
  assert.strictEqual(fehlerArt({ status: 400, fehler: 'x' }, 'diff'), 'kein_diff');
  assert.strictEqual(fehlerArt({ status: 500, fehler: 'x' }, 'diff'), 'anderer');
  assert.strictEqual(fehlerArt({ status: 0, fehler: null }, 'diff'), 'anderer');
  assert.strictEqual(fehlerArt({ status: 404, fehler: 'Aufgabe 999 gibt es nicht' }, 'commits'), 'aufgabe_unbekannt');
  assert.strictEqual(fehlerArt({ status: 503, fehler: 'Antwortbudget …' }, 'commits'), 'anderer', 'die Liste kennt kein Budget');
});

test('zuordnen: aus einer Antwort mit mehreren gleichnamigen Dateien die mit gleichem status, alt, neu an derselben Position', () => {
  const a = { status: 'M', alt: '�.dat', neu: '�.dat' }, b = { status: 'A', neu: '�.dat' };
  const liste = [datei({ neu: 'x' }), { ...a, nr: 1 }, { ...b, nr: 2 }, { ...a, nr: 3 }];
  const antwort = [{ ...a, patch: 'p1' }, { ...b, patch: 'p2' }, { ...a, patch: 'p3' }];
  assert.strictEqual(zuordnen(liste, 1, antwort).patch, 'p1');
  assert.strictEqual(zuordnen(liste, 2, antwort).patch, 'p2');
  assert.strictEqual(zuordnen(liste, 3, antwort).patch, 'p3');
  assert.strictEqual(zuordnen(liste, 0, antwort), null, 'nicht in der Antwort');
});

// Nacharbeit 1 (Security-Review #209 S1): jedes unsichtbare oder richtungsändernde Zeichen wird sichtbar, keins entfernt
for (const [c, marke] of [[0x200E, 'bidi'], [0x200F, 'bidi'], [0x061C, 'bidi'], [0x200B, 'steuer'], [0x200C, 'steuer'], [0x200D, 'steuer'], [0x2028, 'steuer'], [0x2029, 'steuer'], [0x2060, 'steuer'], [0xFEFF, 'steuer'], [0x00AD, 'steuer']]) {
  const code = 'U+' + c.toString(16).toUpperCase().padStart(4, '0');
  test(`Nacharbeit 1 (Security S1): ${code} wird zur Marke „${marke}“ mit Code, der Text davor und danach bleibt`, () => {
    const text = marke === 'bidi' ? `⟨${code}⟩` : code;
    assert.deepStrictEqual(sichtbarTeile('a' + String.fromCodePoint(c) + 'b'), [{ text: 'a' }, { marke, code, text }, { text: 'b' }]);
  });
}

// R00226 AK 5 (Probe O, Wächter; PO Z. 513): die Liste nennt den Text der belegten Lesegrenze wörtlich, die Diff-Seite
// behält den Kopf „Zeitgrenze überschritten.“ und nennt darunter den Text
const BELEGT = 'Lesegrenze von 4 gleichzeitigen Lesevorgängen bis zur Frist von 10 s belegt, Git nicht gestartet';
test('listeFehlerText: 503 „Lesegrenze … — keine Liste“ steht wörtlich da', () => {
  const d = require('../../web/diff.js');
  assert.strictEqual(d.listeFehlerText({ status: 503, fehler: `${BELEGT} — keine Liste` }), `Die Liste der Commits ließ sich nicht lesen: ${BELEGT} — keine Liste (503).`);
});

test('fehlerArt und Diff-Seite: 503 „Lesegrenze … — kein Diff“ bleibt zeitgrenze mit Kopf „Zeitgrenze überschritten.“ und dem Text darunter', () => {
  const d = require('../../web/diff.js');
  const f = { status: 503, fehler: `${BELEGT} — kein Diff` };
  assert.strictEqual(d.fehlerArt(f, 'diff'), 'zeitgrenze');
  const text = d.diffFehlerHtml(f, 'kd:a41e0c5b3c7d9e8f00112233445566778899aabb', s => String(s)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
  assert.ok(text.includes('Zeitgrenze überschritten.'), text);
  assert.ok(text.includes(`Der Diff ließ sich nicht lesen: ${BELEGT} — kein Diff (503).`), text);
});

/* ── R00253 B1348: die Hinweiszeile „umbenennung_eingeschraenkt“ über den Dateien, vor der Kappungszeile ── */

const UMBENENNUNG_SATZ = n => `Sehr großer Commit (${n} Dateien): Umbenennungen werden nur erkannt, wenn der Inhalt gleich blieb. Umbenannte und zugleich geänderte Dateien erscheinen als gelöscht und neu.`;

test('hinweiseHtml: über der Schwelle die Zeile mit Symbol und dem Satz (PO Z. 700), vor der Kappungszeile', () => {
  const html = require('../../web/diff.js').hinweiseHtml([{ art: 'umbenennung_eingeschraenkt', dateien: 10001, schwelle: 10000 }, { art: 'dateien_gekappt', gezeigt: 2000, gesamt: 10000 }]);
  assert.ok(html.includes(UMBENENNUNG_SATZ('10.001')), html);
  assert.ok(/<svg[^>]*>/.test(html), 'Symbol, nicht nur Farbe');
  const satz = html.indexOf('Sehr großer Commit');
  const kappung = html.indexOf('2.000 von 10.000 Dateien gezeigt');
  assert.ok(satz >= 0 && kappung >= 0 && satz < kappung, `Satz ${satz} vor Kappung ${kappung}: ${html}`);
});

test('hinweiseHtml: ohne den Hinweis keine Zeile; der Tausenderpunkt kommt aus der Zahl des Hinweises', () => {
  const d = require('../../web/diff.js');
  assert.strictEqual(d.hinweiseHtml([]), '');
  assert.strictEqual(d.hinweiseHtml([{ art: 'zu_gross_zum_anzeigen', datei: 'x' }]), '');
  const html = d.hinweiseHtml([{ art: 'umbenennung_eingeschraenkt', dateien: 250000, schwelle: 10000 }]);
  assert.ok(html.includes(UMBENENNUNG_SATZ('250.000')), html);
  assert.ok(!html.includes('100.000') && !html.includes('10.000 '), 'die Schwelle steht nicht im Satz');
});
