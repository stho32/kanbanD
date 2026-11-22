// R00219 B1126: Läufe zusammenführen und ordnen — reine Rechnung aus web/laeufe.js, ohne Browser (ADR-0039 „Durchsetzung“ (a)–(f)).
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { laeufe } = require('../../web/laeufe.js');

const transkript = (kennung, column, zusatz = {}) => {
  const [role, zeit] = kennung.split('@');
  return { kennung, at: zeit.replace('T', ' '), role, column, bytes: 2048, zustand: 'vorhanden', ...zusatz };
};
const kosten = (kennung, column, amount, zusatz = {}) => {
  const [role, zeit] = kennung.split('@');
  return { at: zeit.replace('T', ' '), role, column, amount, currency: 'USD', kennung, ...zusatz };
};
const UNLESBAR = { kennung: null, at: null, role: null, column: null, bytes: null, zustand: 'unlesbar' };

test('(a) gleiche Kennung, verschiedene Spalte: eine Zeile mit beiden Spalten', () => {
  const k = 'entwickler@2026-11-20T10:00+01:00';
  const zeilen = laeufe([transkript(k, 'Entwicklung')], [kosten(k, 'Reviews', 1.8)]);
  assert.strictEqual(zeilen.length, 1);
  assert.strictEqual(zeilen[0].kennung, k);
  assert.strictEqual(zeilen[0].column, 'Entwicklung');
  assert.strictEqual(zeilen[0].role, 'entwickler');
  assert.deepStrictEqual(zeilen[0].transkript, { bytes: 2048, zustand: 'vorhanden' });
  assert.deepStrictEqual(zeilen[0].kosten, { amount: 1.8, currency: 'USD', tokens: null, column: 'Reviews' });
});

test('(b) Transkript ohne Kosteneintrag: eine Zeile mit kosten: null', () => {
  const k = 'code-reviewer@2026-11-20T11:00+01:00';
  const zeilen = laeufe([transkript(k, 'Reviews', { zustand: 'fehlt' })], [kosten('planer@2026-11-20T09:00+01:00', 'Detailplanung', 0.42)]);
  const zeile = zeilen.find(z => z.kennung === k);
  assert.strictEqual(zeile.kosten, null);
  assert.deepStrictEqual(zeile.transkript, { bytes: 2048, zustand: 'fehlt' });
  assert.strictEqual(zeilen.length, 2);
});

test('(c) Kosteneintrag ohne Transkript: transkript: null, Spalte und Rolle des Kosteneintrags, kein „fehlt“', () => {
  const k = 'entwicklertester@2026-11-20T12:00+01:00';
  const zeilen = laeufe([], [kosten(k, 'Entwicklertest', 0.3, { tokens: 1200 })]);
  assert.strictEqual(zeilen.length, 1);
  assert.strictEqual(zeilen[0].transkript, null);
  assert.strictEqual(zeilen[0].column, 'Entwicklertest');
  assert.strictEqual(zeilen[0].role, 'entwicklertester');
  assert.deepStrictEqual(zeilen[0].kosten, { amount: 0.3, currency: 'USD', tokens: 1200, column: 'Entwicklertest' });
  assert.notStrictEqual(zeilen[0].transkript?.zustand, 'fehlt');
});

test('(d) unlesbar ohne Kennung wird keinem Kosteneintrag zugeordnet, auch wenn nur einer da ist', () => {
  const k = 'entwickler@2026-11-20T10:00+01:00';
  const zeilen = laeufe([UNLESBAR], [kosten(k, 'Entwicklung', 1)]);
  assert.strictEqual(zeilen.length, 2);
  const ohne = zeilen.find(z => z.kennung === null);
  assert.deepStrictEqual(ohne.transkript, { bytes: null, zustand: 'unlesbar' });
  assert.strictEqual(ohne.kosten, null);
  assert.strictEqual(zeilen.find(z => z.kennung === k).transkript, null);
});

test('(d) ein Kosteneintrag ohne Kennung paart sich nicht mit einem unlesbaren Eintrag ohne Kennung', () => {
  const zeilen = laeufe([UNLESBAR], [{ at: '2026-11-20 10:00+01:00', role: 'x', column: 'A', amount: 1, currency: 'USD' }]);
  assert.strictEqual(zeilen.length, 2);
  assert.ok(zeilen.every(z => z.transkript === null || z.kosten === null));
});

test('(e) je zwei Transkripte und zwei Kosteneinträge derselben Kennung: genau zwei Paare in Dateireihenfolge', () => {
  const k = 'entwickler@2026-11-20T10:00+01:00';
  const zeilen = laeufe(
    [transkript(k, 'A', { bytes: 1 }), transkript(k, 'B', { bytes: 2 })],
    [kosten(k, 'C', 1.1), kosten(k, 'D', 2.2)]);
  assert.strictEqual(zeilen.length, 2);
  assert.deepStrictEqual(zeilen.map(z => [z.column, z.transkript.bytes, z.kosten.column, z.kosten.amount]), [['A', 1, 'C', 1.1], ['B', 2, 'D', 2.2]]);
});

test('(e) ungleiche Doppel: drei Transkripte, ein Kosteneintrag — das erste paart sich, die übrigen stehen allein', () => {
  const k = 'entwickler@2026-11-20T10:00+01:00';
  const zeilen = laeufe([transkript(k, 'A'), transkript(k, 'B'), transkript(k, 'C')], [kosten(k, 'K', 1)]);
  assert.deepStrictEqual(zeilen.map(z => [z.column, z.kosten && z.kosten.column]), [['A', 'K'], ['B', null], ['C', null]]);
});

test('(f) verglichen wird nur die Kennung des Servers, nicht das `at` des Kosteneintrags', () => {
  const k = 'entwickler@2026-11-20T14:00+01:00';
  const handgeschrieben = kosten(k, 'Entwicklung', 0.5, { at: '2026-11-20 13:00Z' });
  const zeilen = laeufe([transkript(k, 'Entwicklung')], [handgeschrieben]);
  assert.strictEqual(zeilen.length, 1);
  assert.strictEqual(zeilen[0].kosten.amount, 0.5);
});

test('(f) Gegenprobe: gleiches Moment, aber verschiedene Kennung des Servers ergibt zwei Zeilen — die Seite bildet keine eigene Kennung', () => {
  const zeilen = laeufe(
    [transkript('entwickler@2026-11-20T14:00+01:00', 'Entwicklung')],
    [kosten('entwicklerin@2026-11-20T14:00+01:00', 'Entwicklung', 0.5, { role: 'entwickler', at: '2026-11-20 14:00+01:00' })]);
  assert.strictEqual(zeilen.length, 2);
});

test('Reihenfolge aus #1: L4, L3, L2, L1, L5, L6 — neueste zuerst nach der Kennung, ohne Kennung am Ende', () => {
  const L1 = 'planer@2026-11-20T09:00+01:00', L2 = 'entwickler@2026-11-20T10:00+01:00', L3 = 'code-reviewer@2026-11-20T11:00+01:00';
  const L4 = 'entwicklertester@2026-11-20T12:00+01:00', L5 = 'architekt@2026-11-20T08:00+01:00';
  const zeilen = laeufe(
    [transkript(L1, 'Detailplanung'), transkript(L2, 'Entwicklung'), transkript(L3, 'Reviews', { zustand: 'fehlt' }), transkript(L5, 'Architektur', { zustand: 'abweichend' }), UNLESBAR],
    [kosten(L1, 'Detailplanung', 0.42), kosten(L2, 'Reviews', 1.8), kosten(L4, 'Entwicklertest', 0.3), kosten(L5, 'Architektur', 0.55)]);
  assert.deepStrictEqual(zeilen.map(z => z.kennung), [L4, L3, L2, L1, L5, null]);
});

test('Reihenfolge nach dem Zeitpunkt der Kennung, nicht nach dem `at` des Kosteneintrags', () => {
  const frueh = 'a@2026-11-20T08:00+01:00', spaet = 'b@2026-11-20T09:00+01:00';
  const zeilen = laeufe([], [kosten(frueh, 'X', 1, { at: '2026-11-20 23:00+01:00' }), kosten(spaet, 'X', 1)]);
  assert.deepStrictEqual(zeilen.map(z => z.kennung), [spaet, frueh]);
});

test('Gleichstand: Dateireihenfolge, Transkripte vor Kosteneinträgen ohne Transkript', () => {
  const zeit = '2026-11-20T10:00+01:00';
  const zeilen = laeufe(
    [transkript(`b@${zeit}`, 'X'), transkript(`a@${zeit}`, 'X')],
    [kosten(`d@${zeit}`, 'X', 1), kosten(`c@${zeit}`, 'X', 1)]);
  assert.deepStrictEqual(zeilen.map(z => z.role), ['b', 'a', 'd', 'c']);
});

test('Versatz der Kennung zählt: 10:00+02:00 ist früher als 09:30+01:00', () => {
  const zeilen = laeufe([], [kosten('a@2026-11-20T10:00+02:00', 'X', 1), kosten('b@2026-11-20T09:30+01:00', 'X', 1)]);
  assert.deepStrictEqual(zeilen.map(z => z.role), ['b', 'a']);
});

test('mehrere Einträge ohne Kennung stehen am Ende in Dateireihenfolge, nichts geht verloren', () => {
  const zeilen = laeufe([{ ...UNLESBAR, bytes: 1 }, transkript('a@2026-11-20T10:00+01:00', 'X'), { ...UNLESBAR, bytes: 2 }], []);
  assert.deepStrictEqual(zeilen.map(z => z.transkript.bytes), [2048, 1, 2]);
});

test('ohne Einträge: leere Liste; Eingaben bleiben unverändert', () => {
  assert.deepStrictEqual(laeufe([], []), []);
  const t = [transkript('a@2026-11-20T10:00+01:00', 'X')], k = [kosten('a@2026-11-20T10:00+01:00', 'Y', 1)];
  const vorher = JSON.stringify([t, k]);
  laeufe(t, k);
  assert.strictEqual(JSON.stringify([t, k]), vorher);
});

const { kennungsmengeGeaendert } = require('../../web/laeufe.js');
const kennungen = (...k) => k.map(kennung => ({ kennung }));

test('kennungsmengeGeaendert (FA 7, ADR-0039 L2): gleiche Menge — auch in anderer Reihenfolge — ist keine Änderung', () => {
  assert.strictEqual(kennungsmengeGeaendert(kennungen('a@1', 'b@2'), ['a@1', 'b@2']), false);
  assert.strictEqual(kennungsmengeGeaendert(kennungen('b@2', 'a@1'), ['a@1', 'b@2']), false);
  assert.strictEqual(kennungsmengeGeaendert([], []), false);
});

test('kennungsmengeGeaendert: eine neue, eine entfernte oder eine ausgetauschte Kennung ist eine Änderung', () => {
  assert.strictEqual(kennungsmengeGeaendert(kennungen('a@1', 'b@2', 'c@3'), ['a@1', 'b@2']), true, 'abgelegt');
  assert.strictEqual(kennungsmengeGeaendert(kennungen('a@1'), ['a@1', 'b@2']), true, 'gelöscht');
  assert.strictEqual(kennungsmengeGeaendert(kennungen('a@1', 'c@3'), ['a@1', 'b@2']), true, 'gleich viele, andere');
  assert.strictEqual(kennungsmengeGeaendert(kennungen('a@1'), []), true);
});

test('web/laeufe.js überschreibt im Browser keinen Namen, den ein anderes Modul auf window legt — über alle Zuweisungen je Modul (diff.js liest fehlerText aus commits.js, diff.js hat zwei)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ordner = path.join(__dirname, '../../web');
  const namen = datei => {
    const text = fs.readFileSync(path.join(ordner, datei), 'utf8');
    return [...text.matchAll(/Object\.assign\(ziel, \{([^}]*)\}\);/g)].flatMap(m => m[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean));
  };
  const eigene = namen('laeufe.js');
  assert.ok(eigene.includes('laeufe'));
  for (const datei of fs.readdirSync(ordner).filter(d => d.endsWith('.js') && d !== 'laeufe.js')) {
    const doppelt = namen(datei).filter(n => eigene.includes(n));
    assert.deepStrictEqual(doppelt, [], datei);
  }
  const global = fs.readFileSync(path.join(ordner, 'ansicht.js'), 'utf8') + fs.readFileSync(path.join(ordner, 'app.js'), 'utf8');
  for (const n of eigene) assert.doesNotMatch(global, new RegExp(`^(function|const|let|async function) ${n}\\b`, 'm'), n);
});

/* ── R00239 B1249, B1250: Folge der Läufe, „Lauf k von n“, Blättern und seine Ansage (FA 10–12; AK 7, AK 8 Node) ── */

const { laeufeFolge, laeufeBlaetternHtml, laufBlaetternAnsage } = require('../../web/laeufe.js');
const R = {
  T1: 'planer@2026-11-21T23:30+01:00', T3: 'entwickler@2026-11-21T08:00+01:00', T4: 'architekt@2026-11-21T23:40+01:00',
  T5: 'code-reviewer@2026-11-21T22:00+01:00', T10: 'tester@2026-11-22T10:00+01:00', T11: 'entwickler@2026-11-22T10:30+01:00',
};
const AN_EINS = [transkript(R.T1, 'Detailplanung'), transkript(R.T3, 'Entwicklung'), transkript(R.T4, 'Entwicklung'), transkript(R.T5, 'Reviews', { zustand: 'fehlt' }),
  transkript(R.T10, 'Reviews'), transkript(R.T11, 'Entwicklung')];

test('R00239 FA 10: Folge an #1 aufsteigend T3 · T5 · T1 · T4 · T10 · T11 — T1 ist Lauf 3 von 6 mit T5 davor und T4 danach', () => {
  const folge = laeufeFolge(AN_EINS, R.T1);
  assert.deepStrictEqual({ k: folge.k, n: folge.n, vorige: folge.vorige.kennung, naechste: folge.naechste.kennung, rolle: folge.lauf.role },
    { k: 3, n: 6, vorige: R.T5, naechste: R.T4, rolle: 'planer' });
  assert.deepStrictEqual([laeufeFolge(AN_EINS, R.T3).k, laeufeFolge(AN_EINS, R.T3).vorige], [1, null]);
  assert.deepStrictEqual([laeufeFolge(AN_EINS, R.T11).k, laeufeFolge(AN_EINS, R.T11).naechste], [6, null]);
  assert.strictEqual(laeufeFolge(AN_EINS, R.T5).vorige.kennung, R.T3, 'ein Lauf im Zustand fehlt gehört zur Folge');
});

test('R00239 FA 10: Gleichstand behält die Reihenfolge von a.transkripte, ohne lesbaren Zeitpunkt ans Ende, ohne Kennung nicht dabei', () => {
  const a = 'a@2026-11-21T10:00+01:00', b = 'b@2026-11-21T10:00+01:00', ohneZeit = 'c@gestern';
  const folge = [transkript(b, 'X'), transkript(ohneZeit, 'X'), transkript(a, 'X'), UNLESBAR];
  assert.deepStrictEqual([b, a, ohneZeit].map(kennung => laeufeFolge(folge, kennung).k), [1, 2, 3]);
  assert.strictEqual(laeufeFolge(folge, b).n, 3);
});

test('R00239 FA 10: steht die gezeigte Kennung nicht in der Folge, gibt es kein Blättern', () => {
  assert.strictEqual(laeufeFolge(AN_EINS, 'pruefer@2026-11-21T12:00+01:00'), null);
  assert.strictEqual(laeufeFolge([], R.T1), null);
  assert.strictEqual(laeufeBlaetternHtml(null, k => k), '');
});

const htmlEsc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
test('R00239 FA 11: Links auf die Nachbarn über die Adresse, „Lauf k von n“; am Rand Sperrform ohne href, fokussierbar, Pfeile verborgen', () => {
  const adresse = kennung => `#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(kennung)}`;
  const mitte = laeufeBlaetternHtml(laeufeFolge(AN_EINS, R.T1), adresse, htmlEsc);
  assert.strictEqual(mitte, '<nav class="lv-blatt" aria-label="Läufe dieser Aufgabe">'
    + `<a class="btn" id="lv-vor" href="${adresse(R.T5)}" data-act="lauf-blaettern" data-arg="${R.T5}"><span aria-hidden="true">‹ </span>Voriger Lauf</a>`
    + '<span class="stelle">Lauf 3 von 6</span>'
    + `<a class="btn" id="lv-nach" href="${adresse(R.T4)}" data-act="lauf-blaettern" data-arg="${R.T4}">Nächster Lauf<span aria-hidden="true"> ›</span></a></nav>`);
  const eins = laeufeBlaetternHtml(laeufeFolge([transkript(R.T1, 'X')], R.T1), adresse, htmlEsc);
  assert.match(eins, /<a class="btn" id="lv-vor" role="link" tabindex="0" aria-disabled="true"><span aria-hidden="true">‹ <\/span>Voriger Lauf<\/a><span class="stelle">Lauf 1 von 1<\/span><a class="btn" id="lv-nach" role="link" tabindex="0" aria-disabled="true">Nächster Lauf/);
  assert.doesNotMatch(eins, /href|data-act/);
});

test('R00239 FA 12: Ansage nach dem Blättern — „Lauf k von n, Rolle. Satz“, am Rand „erster/letzter Lauf“, ohne Rolle samt Komma', () => {
  const grenze = 'Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.';
  assert.strictEqual(laufBlaetternAnsage(laeufeFolge(AN_EINS, R.T3), grenze), `Lauf 1 von 6, entwickler, erster Lauf. ${grenze}`);
  assert.strictEqual(laufBlaetternAnsage(laeufeFolge(AN_EINS, R.T1), 'Ende des Transkripts'), 'Lauf 3 von 6, planer. Ende des Transkripts');
  assert.strictEqual(laufBlaetternAnsage(laeufeFolge(AN_EINS, R.T11), 'Ende des Transkripts'), 'Lauf 6 von 6, entwickler, letzter Lauf. Ende des Transkripts');
  const ohneRolle = [{ ...transkript(R.T1, 'X'), role: null }, transkript(R.T4, 'X')];
  assert.strictEqual(laufBlaetternAnsage(laeufeFolge(ohneRolle, R.T1), 'Ende des Transkripts'), 'Lauf 1 von 2, erster Lauf. Ende des Transkripts');
  const mitte = [transkript(R.T3, 'X'), { ...transkript(R.T1, 'X'), role: null }, transkript(R.T4, 'X')];
  assert.strictEqual(laufBlaetternAnsage(laeufeFolge(mitte, R.T1), 'Das Transkript liegt nicht auf diesem Rechner.'), 'Lauf 2 von 3. Das Transkript liegt nicht auf diesem Rechner.');
});
