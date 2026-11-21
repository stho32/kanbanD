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
