// R00217 B1109 (ADR-0040 Punkt 4): Schlange mit Frist für den Färbe-Worker — ein Worker, ein Auftrag zur Zeit, Frist mit Abbruch,
// veraltete Antworten verworfen, stiller Fehlerpfad. Fake-Worker, der verzögert, nie oder falsch antwortet; Uhr injiziert.
const test = require('node:test');
const assert = require('node:assert');
const { farbschlange, FRIST_MS } = require('../../web/farbschlange.js');

/** Fake-Worker: hält jeden Auftrag, bis der Test ihn beantwortet; merkt `terminate`. */
function fakeWorker(protokoll) {
  const w = { auftraege: [], beendet: false, onmessage: null, onerror: null, onmessageerror: null };
  w.postMessage = auftrag => { w.auftraege.push(auftrag); protokoll.push(`post ${auftrag.sprache}`); };
  w.terminate = () => { w.beendet = true; protokoll.push('terminate'); };
  w.antworten = daten => w.onmessage({ data: daten });
  return w;
}

/** Uhr zum Weiterdrehen: `setTimeout` merkt sich die Frist, `vor(ms)` lässt sie ablaufen. */
function fakeUhr() {
  let jetzt = 0, naechste = 1;
  const wecker = new Map();
  return {
    setTimeout: (f, ms) => { wecker.set(naechste, { f, um: jetzt + ms }); return naechste++; },
    clearTimeout: id => wecker.delete(id),
    vor: ms => { jetzt += ms; for (const [id, w] of [...wecker]) if (w.um <= jetzt) { wecker.delete(id); w.f(); } },
    offen: () => wecker.size,
  };
}

function aufbau({ ohneWorker = false } = {}) {
  const protokoll = [], worker = [], uhr = fakeUhr();
  const workerAnlegen = () => {
    if (ohneWorker) return null;
    const w = fakeWorker(protokoll);
    worker.push(w);
    protokoll.push('neu');
    return w;
  };
  const schlange = farbschlange({ workerAnlegen, frist: 50, uhr });
  const ergebnisse = [];
  const auftrag = (name, { aktuell = () => true, sprache = 'rust' } = {}) => ({ sprache, zeilen: [{ art: 'plus', text: name }], aktuell, fertig: s => ergebnisse.push([name, s && Array.from(s)]) });
  return { protokoll, worker, uhr, schlange, ergebnisse, auftrag };
}

test('FRIST_MS ist 1.000', () => {
  assert.strictEqual(FRIST_MS, 1000);
});

test('ein Auftrag: Antwort als Int32Array geht an die Datei, der Wecker ist danach weg', () => {
  const a = aufbau();
  a.schlange.stellen(a.auftrag('eins'));
  assert.deepStrictEqual(a.protokoll, ['neu', 'post rust']);
  assert.deepStrictEqual(a.worker[0].auftraege[0].zeilen, [{ art: 'plus', text: 'eins' }]);
  a.worker[0].antworten(Int32Array.of(1, 0, 2, 0));
  assert.deepStrictEqual(a.ergebnisse, [['eins', [1, 0, 2, 0]]]);
  assert.strictEqual(a.uhr.offen(), 0);
});

test('Frist abgelaufen: terminate, ohne Farbe, der nächste Auftrag bekommt einen neuen Worker; die späte Antwort zählt nicht', () => {
  const a = aufbau();
  a.schlange.stellen(a.auftrag('feindlich'));
  a.schlange.stellen(a.auftrag('gut'));
  a.uhr.vor(49);
  assert.deepStrictEqual(a.ergebnisse, [], 'vor der Frist nichts');
  a.uhr.vor(1);
  assert.deepStrictEqual(a.ergebnisse, [['feindlich', null]]);
  assert.strictEqual(a.worker[0].beendet, true);
  assert.deepStrictEqual(a.protokoll, ['neu', 'post rust', 'terminate', 'neu', 'post rust']);
  a.worker[0].antworten(Int32Array.of(1, 0, 1, 2));
  a.worker[1].antworten(Int32Array.of(1, 0, 2, 0));
  assert.deepStrictEqual(a.ergebnisse, [['feindlich', null], ['gut', [1, 0, 2, 0]]]);
});

test('ein Auftrag zur Zeit; wartend läuft der zuletzt gestellte zuerst (UX S1)', () => {
  const a = aufbau();
  a.schlange.stellen(a.auftrag('erste'));
  a.schlange.stellen(a.auftrag('zweite'));
  a.schlange.stellen(a.auftrag('dritte'));
  assert.strictEqual(a.worker[0].auftraege.length, 1, 'nur einer läuft');
  a.worker[0].antworten(new Int32Array(0));
  assert.deepStrictEqual(a.worker[0].auftraege.map(x => x.zeilen[0].text), ['erste', 'dritte']);
  a.worker[0].antworten(new Int32Array(0));
  a.worker[0].antworten(new Int32Array(0));
  assert.deepStrictEqual(a.ergebnisse.map(e => e[0]), ['erste', 'dritte', 'zweite']);
  assert.strictEqual(a.worker.length, 1, 'derselbe Worker');
});

test('veraltet: die Antwort einer nicht mehr gezeigten Datei wird verworfen, ein wartender Auftrag einer geschlossenen Datei entfällt', () => {
  const a = aufbau();
  let laufendGezeigt = true, wartendGezeigt = true;
  a.schlange.stellen(a.auftrag('laufend', { aktuell: () => laufendGezeigt }));
  a.schlange.stellen(a.auftrag('wartend', { aktuell: () => wartendGezeigt }));
  a.schlange.stellen(a.auftrag('bleibt'));
  laufendGezeigt = false;
  wartendGezeigt = false;
  a.worker[0].antworten(Int32Array.of(1, 0, 2, 0));
  assert.deepStrictEqual(a.worker[0].auftraege.map(x => x.zeilen[0].text), ['laufend', 'bleibt'], 'der geschlossene wartende fällt aus der Schlange');
  a.worker[0].antworten(Int32Array.of(1, 0, 3, 1));
  assert.deepStrictEqual(a.ergebnisse, [['bleibt', [1, 0, 3, 1]]], 'die veraltete Antwort wird nie übergeben');
});

test('Fehler still: Antwort mit fehler, error und messageerror ergeben ohne Farbe; error mit preventDefault, danach neuer Worker', () => {
  const a = aufbau();
  const konsole = ['error', 'warn', 'log', 'info'].map(n => [n, console[n]]);
  const geschrieben = [];
  for (const [n] of konsole) console[n] = (...x) => geschrieben.push([n, ...x]);
  try {
    a.schlange.stellen(a.auftrag('fehler'));
    a.schlange.stellen(a.auftrag('error'));
    a.schlange.stellen(a.auftrag('messageerror'));
    a.worker[0].antworten({ fehler: true });
    let verhindert = false;
    a.worker[0].onerror({ preventDefault: () => { verhindert = true; } });
    assert.strictEqual(verhindert, true);
    assert.strictEqual(a.worker[0].beendet, true, 'ein Worker mit error wird ersetzt');
    a.worker[1].onmessageerror({ preventDefault() {} });
    assert.deepStrictEqual(a.ergebnisse, [['fehler', null], ['messageerror', null], ['error', null]]);
  } finally {
    for (const [n, f] of konsole) console[n] = f;
  }
  assert.deepStrictEqual(geschrieben, [], 'kein console.*');
});

test('ohne Worker (kein Worker im Browser oder Anlegen wirft): jeder Auftrag ohne Farbe, still', () => {
  const a = aufbau({ ohneWorker: true });
  a.schlange.stellen(a.auftrag('eins'));
  a.schlange.stellen(a.auftrag('zwei'));
  assert.deepStrictEqual(a.ergebnisse, [['eins', null], ['zwei', null]]);
  const wirft = farbschlange({ workerAnlegen: () => { throw new Error('kein Worker'); }, uhr: fakeUhr() });
  const aus = [];
  wirft.stellen({ sprache: 'rust', zeilen: [], aktuell: () => true, fertig: s => aus.push(s) });
  assert.deepStrictEqual(aus, [null]);
});

test('eine fremde Antwort, die kein Int32Array und kein fehler ist, ergibt ohne Farbe', () => {
  const a = aufbau();
  a.schlange.stellen(a.auftrag('html'));
  a.worker[0].antworten('<span class="token keyword">fn</span>');
  assert.deepStrictEqual(a.ergebnisse, [['html', null]]);
});
