// R00237 B1232–B1234: Aufruf und Ergebnis werden über die Kennung gepaart (ADR-0041 N2, Variante G1). Die Zeilen laufen wie im
// Programm erst durch `zeilenLesen`/`eintragPruefen`, dann durch `laufAuswerten`. T6 ist das Beispiel der Karte #262.
// Die Literale aus `r00237-vor-der-karte.json` sind am Stand vor dem Fix (`cddb15ac`) aufgenommen, nie aus dem neuen Code abgeleitet.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { laufAuswerten, eintragPruefen, zeilenLesen, LAUF_GRENZEN } = require('../../web/lauf.js');
const { T1_ZEILEN } = require('../tests/laufansicht-t1.js');
const VOR_DER_KARTE = require('./r00237-vor-der-karte.json');

const um = s => `2026-11-22T10:00:${String(s).padStart(2, '0')}Z`;
/** Ein Aufruf `Bash` von `agent` bei t+`s`, mit `id` nur, wenn angegeben (auch falsch geformt: der Wert wird roh übernommen). */
const aufruf = (s, befehl, id) => ({ art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: befehl }), zeit: um(s), ...(id === undefined ? {} : { id }) });
const ergebnis = (s, text, zu) => ({ art: 'werkzeugergebnis', wer: 'werkzeug', text, zeit: um(s), ...(zu === undefined ? {} : { zu }) });
const T6 = [aufruf(0, 'cat regeln', 'toolu_A'), aufruf(1, 'cat entwickler', 'toolu_B'), ergebnis(3, 'entwickler', 'toolu_B'), ergebnis(10, 'Exit code 1\nregeln', 'toolu_A')];
const ohneFelder = zeilen => zeilen.map(({ id, zu, ...rest }) => rest);

/** Wie im Programm: jede Zeile geht durch `eintragPruefen`, die Nummer ist die Stelle (ab 1). */
const wieGelesen = eintraege => eintraege.map((o, i) => ({ nr: i + 1, eintrag: eintragPruefen(JSON.parse(JSON.stringify(o))) }));
const auswerten = eintraege => laufAuswerten(wieGelesen(eintraege), false);
/** Eine Schrittzeile als Text: `<nr>→<Ergebnis-nr>:<Sekunden>`, `!` bei Fehler, ein Ergebnis allein als `<nr>e→<nr>:–`. */
const text = a => a.schritte.map(s => `${s.nr}${s.aufruf ? '' : 'e'}→${s.ergebnisNr ?? '–'}:${s.dauer === null ? '–' : s.dauer / 1000}${s.fehler ? '!' : ''}`).join(' ');

test('AK 1: T6 — vertauschte Ergebnisse gehören zu ihrem Aufruf, Dauer, Fehler und „Längste Schritte“ stimmen', () => {
  const a = auswerten(T6);
  assert.strictEqual(text(a), '1→4:10! 2→3:2');
  assert.deepStrictEqual(a.top3.map(t => [t.nr, t.dauer, t.was]), [[1, 10000, 'Bash cat regeln'], [2, 2000, 'Bash cat entwickler']]);
  assert.deepStrictEqual([a.gesamt, a.werkzeug, a.denken, a.warten], [10000, 9000, 1000, 0]);
  assert.deepStrictEqual(a.schritte.map(s => s.parallel), [true, true]);
  assert.deepStrictEqual(a.kennzahlen, { werkzeugaufrufe: 2, fehler: 1 });
});

test('AK 2: T6o ohne Felder ist deepStrictEqual zum Literal vor dem Fix (Nr 1 mit 3 s, Nr 2 mit 9 s und Fehler)', () => {
  const a = auswerten(ohneFelder(T6));
  assert.deepStrictEqual(JSON.parse(JSON.stringify(a)), { ...VOR_DER_KARTE.T6o, tokens: null, teuer3: [] }, 'R00238: dazu tokens null und keine teuersten');
  assert.strictEqual(text(a), '1→3:3 2→4:9!');
});

test('AK 2: T1 aus R00234 ist deepStrictEqual zum Literal vor dem Fix', () => {
  assert.deepStrictEqual(JSON.parse(JSON.stringify(laufAuswerten(T1_ZEILEN, false))), { ...VOR_DER_KARTE.T1, tokens: null, teuer3: [] }, 'R00238: dazu tokens null und keine teuersten');
});

test('AK 4: ein zu ohne passenden Aufruf steht allein, die Warteschlange greift nicht', () => {
  assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), ergebnis(2, 'x', 'x')])), '1→–:– 2e→2:–');
});

test('AK 4: ein zu eines schon gepaarten Aufrufs steht allein', () => {
  assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), ergebnis(2, 'x', 'a'), ergebnis(5, 'y', 'a')])), '1→2:2 3e→3:–');
});

test('AK 5: bei doppelter id gilt die erste, die zweite zählt als Aufruf ohne id', () => {
  assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), aufruf(1, 'b', 'a'), ergebnis(3, 'x', 'a'), ergebnis(6, 'y')])), '1→3:3 2→4:5');
});

test('AK 5, Variante mit vertauschten Ergebnissen: das zu a gehört zum ersten Aufruf, das ohne zu zum zweiten', () => {
  assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), aufruf(1, 'b', 'a'), ergebnis(3, 'x'), ergebnis(6, 'y', 'a')])), '1→4:6 2→3:2');
});

test('AK 6: gemischt — ein Ergebnis ohne zu nimmt den ältesten offenen Aufruf ohne id vor dem mit id', () => {
  assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), aufruf(1, 'b'), ergebnis(3, 'x'), ergebnis(10, 'y', 'a')])), '1→4:10 2→3:2');
});

test('AK 6: gibt es keinen Aufruf ohne id, nimmt ein Ergebnis ohne zu den ältesten offenen — danach steht das zu allein', () => {
  assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), ergebnis(2, 'x'), ergebnis(5, 'y', 'a')])), '1→2:2 3e→3:–');
});

const FALSCH = [['Zahl 7', 7], ['leer', ''], ['257 Zeichen', 'x'.repeat(257)], ['null', null], ['Objekt', {}]];
for (const [was, wert] of FALSCH) {
  test(`AK 7: ein id als ${was} macht die Zeile nicht unlesbar und zählt als fehlend (kein Rückfall für das Ergebnis mit zu)`, () => {
    const eintraege = [{ ...T6[0], id: wert }, T6[1], T6[2], T6[3]];
    assert.strictEqual(wieGelesen(eintraege)[0].eintrag.id, null);
    assert.strictEqual(text(auswerten(eintraege)), '1→–:– 2→3:2 4e→4:–!');
  });
}

test('AK 7: ein Text aus genau 256 Zeichen paart wie toolu_A', () => {
  const k = 'y'.repeat(256);
  assert.strictEqual(text(auswerten([{ ...T6[0], id: k }, T6[1], T6[2], { ...T6[3], zu: k }])), '1→4:10! 2→3:2');
});

test('AK 7: id an einer Nachricht und zu an einem Aufruf fallen weg', () => {
  assert.strictEqual(eintragPruefen({ art: 'nachricht', wer: 'agent', text: 'x', id: 'a' }).id, null);
  assert.strictEqual(eintragPruefen({ art: 'werkzeugaufruf', wer: 'agent', text: 'x', zu: 'a' }).zu, null);
  assert.strictEqual(eintragPruefen({ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'x', id: 'a' }).id, null);
});

test('AK 7: ohne Trimmen und ohne Angleichen der Schreibweise — toolu_a und „ toolu_A“ paaren nicht mit toolu_A', () => {
  for (const zu of ['toolu_a', ' toolu_A', 'toolu_A ']) {
    assert.strictEqual(text(auswerten([T6[0], T6[1], T6[2], { ...T6[3], zu }])), '1→–:– 2→3:2 4e→4:–!', JSON.stringify(zu));
  }
});

test('AK 7: __proto__ und constructor paaren wie jede Kennung, ein zu constructor ohne Aufruf steht allein', () => {
  for (const k of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
    assert.strictEqual(text(auswerten([aufruf(0, 'a', k), ergebnis(2, 'x', k)])), '1→2:2', k);
    assert.strictEqual(text(auswerten([aufruf(0, 'a', 'a'), ergebnis(2, 'x', k)])), '1→–:– 2e→2:–', `zu ${k} ohne Aufruf`);
  }
});

test('AK 7: eine Zeile mit falsch geformtem id ist lesbar — keine Meldung „nicht lesbar“, eintragPruefen liefert id null', async () => {
  const zeile = id => JSON.stringify({ ...T6[0], id });
  for (const id of [7, '', 'x'.repeat(257), null, {}]) {
    const eintraege = [];
    for await (const stueck of zeilenLesen((async function* () { yield new TextEncoder().encode(zeile(id) + '\n'); })(), LAUF_GRENZEN)) if (stueck.nr) eintraege.push(stueck);
    assert.ok(eintraege[0].eintrag, JSON.stringify(id));
    assert.strictEqual(eintraege[0].eintrag.id, null, JSON.stringify(id));
  }
});

test('B1233: eintragPruefen liefert id nur an einem Aufruf und zu nur an einem Ergebnis, sonst null; tokens fällt weg', () => {
  assert.deepStrictEqual(eintragPruefen({ art: 'werkzeugaufruf', wer: 'agent', text: 'x', id: 'toolu_A', tokens: 12 }), { art: 'werkzeugaufruf', wer: 'agent', text: 'x', zeit: null, name: null, id: 'toolu_A', zu: null, tokens: null });
  assert.deepStrictEqual(eintragPruefen({ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'x', zu: 'toolu_A' }), { art: 'werkzeugergebnis', wer: 'werkzeug', text: 'x', zeit: null, name: null, id: null, zu: 'toolu_A', tokens: null });
});

test('AK 8: die Paarung hat auf den offenen Aufrufen kein shift, splice, indexOf, findIndex, filter, forEach und kein Objekt als Kennungsspeicher', () => {
  const quelle = require('node:fs').readFileSync(require.resolve('../../web/lauf.js'), 'utf8');
  const paarung = quelle.slice(quelle.indexOf('function offeneAufrufe'), quelle.indexOf('function schrittAbschliessen'));
  assert.ok(paarung.length > 500, 'Ausschnitt gefunden');
  assert.deepStrictEqual(paarung.match(/\.(shift|splice|indexOf|findIndex|find|filter|forEach|includes)\(/g), null);
  assert.match(paarung, /nachId: new Map\(\)/);
});
