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
