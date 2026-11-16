// Unit-Tests der Frist je Anfrage (node --test), R00186 148-1/148-2, ADR-0025 Nachtrag N4:
// jede Anfrage endet spätestens mit der Frist — mit ihrem Ergebnis oder mit dem Fehler der Frist. Die Uhr ist Eingabe.
const test = require('node:test');
const assert = require('node:assert');
const { mitFrist } = require('../../web/warteschlange.js');

/** Eine Uhr, die nur der Test vorstellt: Wecker klingeln, sobald `vor` ihre Zeit erreicht. */
function uhrStellen() {
  let jetzt = 0;
  const wecker = [];
  return {
    stellen: (klingeln, ms) => { const w = { klingeln, um: jetzt + ms, gestellt: true }; wecker.push(w); return w; },
    raeumen: w => { w.gestellt = false; },
    vor: ms => {
      jetzt += ms;
      wecker.filter(w => w.gestellt && w.um <= jetzt).forEach(w => { w.gestellt = false; w.klingeln(); });
    },
    gestellt: () => wecker.filter(w => w.gestellt).length,
  };
}

/** Eine Anfrage, die der Test beantwortet oder scheitern lässt; merkt sich das Abbruchsignal. */
function anfrageOffen() {
  const a = {};
  a.arbeit = signal => { a.signal = signal; return new Promise((ok, fehler) => { a.antworten = ok; a.scheitern = fehler; }); };
  return a;
}

/** Der Ausgang eines Versprechens, sobald alle anstehenden Schritte gelaufen sind: `offen`, `erfuellt` oder `abgelehnt`. */
async function ausgang(versprechen) {
  const stand = { art: 'offen' };
  versprechen.then(wert => Object.assign(stand, { art: 'erfuellt', wert }), fehler => Object.assign(stand, { art: 'abgelehnt', fehler }));
  await new Promise(setImmediate);
  return stand;
}

const keineAntwort = () => Object.assign(new Error('Keine Antwort vom Server'), { status: 0, daten: null });

test('148-2 Rechenbeispiel: Frist 15 000 ms, Antwort nach 14 000 ms — das Ergebnis wie ohne Frist, der Zeitgeber ist geräumt', async () => {
  const uhr = uhrStellen(), a = anfrageOffen();
  const lauf = mitFrist(a.arbeit, 15000, keineAntwort, uhr);
  await ausgang(lauf);
  uhr.vor(14000);
  assert.strictEqual((await ausgang(lauf)).art, 'offen', 'vor der Antwort ist die Anfrage offen');
  a.antworten({ nummer: 1 });
  assert.deepStrictEqual(await ausgang(lauf), { art: 'erfuellt', wert: { nummer: 1 } });
  assert.strictEqual(a.signal.aborted, false, 'eine beantwortete Anfrage wird nicht abgebrochen');
  assert.strictEqual(uhr.gestellt(), 0, 'der Zeitgeber ist geräumt');
  // auch wenn die Uhr danach über die Frist läuft, bricht nichts mehr ab
  uhr.vor(5000);
  assert.strictEqual(a.signal.aborted, false);
});

test('148-2 Rechenbeispiel: keine Antwort nach 15 000 ms — Abbruch und der Fehler der Frist mit status 0', async () => {
  const uhr = uhrStellen(), a = anfrageOffen();
  const lauf = mitFrist(a.arbeit, 15000, keineAntwort, uhr);
  await ausgang(lauf);
  uhr.vor(14999);
  assert.strictEqual((await ausgang(lauf)).art, 'offen', 'eine Millisekunde vor der Frist ist die Anfrage offen');
  assert.strictEqual(a.signal.aborted, false);
  uhr.vor(1);
  const ende = await ausgang(lauf);
  assert.strictEqual(ende.art, 'abgelehnt', 'mit der Frist endet die Anfrage');
  assert.strictEqual(ende.fehler.message, 'Keine Antwort vom Server');
  assert.strictEqual(ende.fehler.status, 0);
  assert.strictEqual(ende.fehler.daten, null);
  assert.strictEqual(a.signal.aborted, true, 'die Anfrage ist abgebrochen');
  assert.strictEqual(uhr.gestellt(), 0, 'der Zeitgeber ist geräumt');
});

test('die Frist ist Eingabe: 300 ms gelten wie 15 000 ms', async () => {
  const uhr = uhrStellen(), a = anfrageOffen();
  const lauf = mitFrist(a.arbeit, 300, keineAntwort, uhr);
  await ausgang(lauf);
  uhr.vor(299);
  assert.strictEqual((await ausgang(lauf)).art, 'offen');
  uhr.vor(1);
  assert.strictEqual((await ausgang(lauf)).art, 'abgelehnt');
});

test('scheitert die Anfrage vor der Frist, gilt ihr eigener Fehler, und der Zeitgeber ist geräumt', async () => {
  const uhr = uhrStellen(), a = anfrageOffen();
  const lauf = mitFrist(a.arbeit, 15000, keineAntwort, uhr);
  await ausgang(lauf);
  const abgelehnt = Object.assign(new Error('Titel fehlt'), { status: 422 });
  a.scheitern(abgelehnt);
  const ende = await ausgang(lauf);
  assert.strictEqual(ende.fehler, abgelehnt);
  assert.strictEqual(uhr.gestellt(), 0);
});

test('eine späte Antwort nach der Frist ändert den Ausgang nicht und hinterlässt keine unbehandelte Ablehnung', async () => {
  const uhr = uhrStellen(), a = anfrageOffen();
  const unbehandelt = [];
  const merken = grund => unbehandelt.push(grund);
  process.on('unhandledRejection', merken);
  try {
    const lauf = mitFrist(a.arbeit, 15000, keineAntwort, uhr);
    await ausgang(lauf);
    uhr.vor(15000);
    assert.strictEqual((await ausgang(lauf)).art, 'abgelehnt');
    // der abgebrochene Abruf wirft erst jetzt seinen Abbruchfehler
    a.scheitern(new Error('abgebrochen'));
    assert.strictEqual((await ausgang(lauf)).fehler.message, 'Keine Antwort vom Server');
    assert.deepStrictEqual(unbehandelt, []);
  } finally {
    process.off('unhandledRejection', merken);
  }
});
