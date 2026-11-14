// Unit-Tests der Sperre „genau ein Auslöser je Aktion“ (node --test), R00148 AK 12–16 / ADR-0025 Regel 1/2:
// der Sperrzustand liegt im Sichtzustand, zwei Auslöser sind unabhängig, die Kennung trägt den Ort und nicht das Argument.
const test = require('node:test');
const assert = require('node:assert');
const { sperreFuehren, ausloeserName, aktionsName } = require('../../web/sperre.js');

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

test('B2: Taste und Knopf derselben Aktion tragen dieselbe Kennung — auch ohne Element (AK 12)', () => {
  // Taste „a“ im Fenster ruft act('archivieren', String(nr)), der Menüpunkt trägt data-act="archivieren" data-arg="1"
  assert.strictEqual(aktionsName('archivieren', String(1)), aktionsName('archivieren', '1'));
  // Enter im Titel und der Knopf „Anlegen“ (data-arg="") sind ein Auslöser; ein fehlendes Argument ist das leere
  assert.strictEqual(aktionsName('nf-anlegen', undefined), aktionsName('nf-anlegen', ''));
});

test('B2: die Aktionskennung unterscheidet Argument und Aktion und fällt nie mit einer Ortskennung zusammen', () => {
  assert.notStrictEqual(aktionsName('archivieren', '1'), aktionsName('archivieren', '2'));
  assert.notStrictEqual(aktionsName('archivieren', '1'), aktionsName('zurueckholen', '1'));
  assert.notStrictEqual(aktionsName('teil-weg', '0'), ausloeserName({ aktion: 'teil-weg', anker: '#fenster', argument: '0' }, 0));
});

test('B2: Enter im Feld trägt den Wert — derselbe Eintrag ist derselbe Auslöser, ein neuer nicht (R00037)', () => {
  assert.strictEqual(aktionsName('kommentar', undefined, 'Hallo'), aktionsName('kommentar', '', 'Hallo'));
  assert.notStrictEqual(aktionsName('teil-neu', undefined, 'a'), aktionsName('teil-neu', undefined, 'b'));
  assert.notStrictEqual(aktionsName('teil-neu', undefined, ''), aktionsName('teil-neu', undefined), 'ein leerer Wert ist ein Wert');
});

test('B2: laeuftAktion trifft die Aktion mit und ohne Feldwert, nicht ein anderes Argument', () => {
  const sperre = sperreFuehren();
  sperre.starten(aktionsName('zeit-ok', 'z1', '9:00'));
  assert.strictEqual(sperre.laeuftAktion(aktionsName('zeit-ok', 'z1')), true, 'der Knopf ✓ trifft das laufende Enter im Feld');
  assert.strictEqual(sperre.laeuftAktion(aktionsName('zeit-ok', 'z2')), false);
  sperre.starten(aktionsName('stop', '1|st'));
  assert.strictEqual(sperre.laeuftAktion(aktionsName('stop', '1')), false, 'ein Argument ist kein Präfix eines anderen');
  assert.strictEqual(sperre.laeuftAktion(aktionsName('stop', '1|st')), true);
});
