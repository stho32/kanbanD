// Unit-Tests der Sperre „genau ein Auslöser je Aktion“ (node --test), R00148 AK 12–16 / ADR-0025 Regel 1/2:
// der Sperrzustand liegt im Sichtzustand, zwei Auslöser sind unabhängig, die Kennung trägt den Ort und nicht das Argument.
const test = require('node:test');
const assert = require('node:assert');
const { sperreFuehren, ausloeserName } = require('../../web/sperre.js');

const TEIL_WEG = ausloeserName({ aktion: 'teil-weg', anker: 'teil-1', argument: '1' }, 0);
const TEIL_KARTE = ausloeserName({ aktion: 'teil-karte', anker: 'ka-1', argument: '1|0' }, 0);

test('AK 12: ein gestarteter Auslöser läuft, ein nie gestarteter nicht', () => {
  const sperre = sperreFuehren();
  assert.strictEqual(sperre.laeuft(TEIL_WEG), false);
  sperre.starten(TEIL_WEG);
  assert.strictEqual(sperre.laeuft(TEIL_WEG), true);
});

test('AK 12: zwei verschiedene Auslöser sind unabhängig', () => {
  const sperre = sperreFuehren();
  sperre.starten(TEIL_WEG);
  assert.strictEqual(sperre.laeuft(TEIL_KARTE), false, 'der andere Auslöser bleibt bedienbar (AK 15)');
  assert.deepStrictEqual(sperre.namen(), [TEIL_WEG]);
});

test('AK 16: die Sperre endet mit der Antwort — auch bei einem Fehlschlag', () => {
  const sperre = sperreFuehren();
  sperre.starten(TEIL_WEG);
  sperre.beenden(TEIL_WEG);
  assert.strictEqual(sperre.laeuft(TEIL_WEG), false);
  assert.deepStrictEqual(sperre.namen(), [], 'kein Auslöser bleibt stehen');
});

test('AK 12: die Sperre endet bei jedem der beiden Auslöser einzeln', () => {
  const sperre = sperreFuehren();
  sperre.starten(TEIL_WEG);
  sperre.starten(TEIL_KARTE);
  sperre.beenden(TEIL_WEG);
  assert.strictEqual(sperre.laeuft(TEIL_WEG), false);
  assert.strictEqual(sperre.laeuft(TEIL_KARTE), true, 'der zweite läuft weiter');
});

test('die Kennung führt über den Zustand, nicht über den Knoten (M1)', () => {
  const laufend = new Set();
  const sperre = sperreFuehren(laufend);
  sperre.starten(TEIL_WEG);
  assert.deepStrictEqual([...laufend], [TEIL_WEG], 'der Sichtzustand trägt die laufenden Auslöser');
});

test('die Kennung trägt den Ort, nicht das Argument: die Kartenleiste fällt nicht durch (M2, AK 5/6)', () => {
  const vorher = ausloeserName({ aktion: 'teil-karte', anker: 'ka-1', argument: '1|0' }, 0);
  const nachher = ausloeserName({ aktion: 'teil-karte', anker: 'ka-1', argument: '1|1' }, 0);
  assert.strictEqual(vorher, nachher, 'derselbe Platz bleibt derselbe Auslöser, obwohl das Neuzeichnen das Argument umschreibt');
});

test('die Kennung unterscheidet den Ort: zwei Plätze und zwei Anker sind zwei Auslöser', () => {
  const eins = ausloeserName({ aktion: 'teil-weg', anker: 'teil-1', argument: '1' }, 0);
  const zwei = ausloeserName({ aktion: 'teil-weg', anker: 'teil-2', argument: '2' }, 0);
  const andereKarte = ausloeserName({ aktion: 'teil-karte', anker: 'ka-2', argument: '2|0' }, 0);
  assert.notStrictEqual(eins, zwei);
  assert.notStrictEqual(ausloeserName({ aktion: 'teil-karte', anker: 'ka-1', argument: '1|0' }, 0), andereKarte);
  assert.notStrictEqual(ausloeserName({ aktion: 'nf-teil-weg', anker: '#neu-fenster', argument: '0' }, 0), ausloeserName({ aktion: 'nf-teil-weg', anker: '#neu-fenster', argument: '1' }, 1));
});
