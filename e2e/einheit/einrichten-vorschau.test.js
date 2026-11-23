// Unit-Tests der Vorschau in „Einrichten“ als Trockenlauf des Servers (node --test), R00250 Nacharbeit / ADR-0043 N1.2
const test = require('node:test');
const assert = require('node:assert');
const { vorschauAntwort, vorschauTakt, VORSCHAU_WARTET } = require('../../web/einrichten-vorschau.js');

const KEINE_ANTWORT = 'Vorschau nicht aktuell — keine Antwort vom Server.';

test('200: der Text der Antwort, aktuell, ohne Statuszeile', () => {
  assert.deepStrictEqual(vorschauAntwort({ status: 200, daten: { text: '﻿---\r\na: 1\r\n---\r\n', geaendert: true } }, 'alt'), { stand: 'aktuell', text: '﻿---\r\na: 1\r\n---\r\n', meldung: '', gedaempft: false });
});

test('jede 4xx: wörtlich das fehler, das „Speichern“ zeigen würde (PO Z. 694)', () => {
  for (const status of [400, 403, 409, 423]) {
    assert.deepStrictEqual(vorschauAntwort({ status, daten: { fehler: `F${status}` } }, 'alt'), { stand: 'verweigert', text: `F${status}`, meldung: '', gedaempft: false });
  }
  assert.strictEqual(vorschauAntwort({ status: 400, daten: null, meldung: 'Bad Request' }, 'alt').text, 'Bad Request', 'ohne JSON die Meldung der Anfrage');
});

test('keine Antwort und 5xx: alter Text gedämpft, Statuszeile wörtlich (PO Z. 693)', () => {
  assert.deepStrictEqual(vorschauAntwort({ status: 0, daten: null, meldung: 'Keine Verbindung zum Server — nichts geändert.' }, 'alt'), { stand: 'fehler', text: 'alt', meldung: KEINE_ANTWORT, gedaempft: true });
  assert.deepStrictEqual(vorschauAntwort({ status: 500, daten: { fehler: 'x' } }, 'alt'), { stand: 'fehler', text: 'alt', meldung: 'Vorschau nicht aktuell: x (500).', gedaempft: true });
  assert.strictEqual(vorschauAntwort({ status: 503, daten: null, meldung: 'Service Unavailable' }, 'alt').meldung, 'Vorschau nicht aktuell: Fehler im Server (503).');
  assert.strictEqual(vorschauAntwort({ status: 502, daten: {} }, 'alt').meldung, 'Vorschau nicht aktuell: Fehler im Server (502).');
});

/** Eine Uhr zum Vorstellen und eine Anfrage, deren Antworten der Test auflöst. */
function lage() {
  let jetzt = 0;
  const wecker = [];
  const uhr = {
    setTimeout: (f, ms) => { const w = { zeit: jetzt + ms, f }; wecker.push(w); return w; },
    clearTimeout: w => { const i = wecker.indexOf(w); if (i >= 0) wecker.splice(i, 1); },
  };
  const vor = async ms => {
    jetzt += ms;
    for (;;) {
      const faellig = wecker.filter(w => w.zeit <= jetzt).sort((a, b) => a.zeit - b.zeit)[0];
      if (!faellig) break;
      wecker.splice(wecker.indexOf(faellig), 1);
      faellig.f();
      await Promise.resolve();
    }
    await new Promise(r => setImmediate(r));
  };
  const anfragen = [];
  const gezeigt = [];
  let rumpf = 'r0';
  const takt = vorschauTakt({
    anfrage: () => new Promise(r => anfragen.push({ rumpf, antworten: r })),
    zeigen: z => gezeigt.push({ ...z }),
    uhr, entprellMs: 250, daempfMs: 400,
  });
  const antworten = async (i, antwort) => { anfragen[i].antworten(antwort); await new Promise(r => setImmediate(r)); };
  return { takt, anfragen, gezeigt, vor, antworten, rumpf: r => { rumpf = r; } };
}

const ok = text => ({ status: 200, daten: { text, geaendert: true } });

test('vor der ersten Antwort: leer, wartet, Statuszeile „Vorschau wird aktualisiert …“; sofort eine Anfrage', async () => {
  const l = lage();
  l.takt.anstossen(true);
  assert.strictEqual(l.anfragen.length, 1);
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'wartet', text: '', meldung: VORSCHAU_WARTET, gedaempft: false });
  assert.strictEqual(VORSCHAU_WARTET, 'Vorschau wird aktualisiert …');
  await l.antworten(0, ok('T1'));
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'aktuell', text: 'T1', meldung: '', gedaempft: false });
});

test('Eingaben: 250 ms entprellt — fünf schnelle Anstöße ergeben eine Anfrage mit dem letzten Stand (V10)', async () => {
  const l = lage();
  l.takt.anstossen(true);
  await l.antworten(0, ok('T0'));
  for (const r of ['a', 'ab', 'abc', 'abcd', 'abcde']) { l.rumpf(r); l.takt.anstossen(false); await l.vor(40); }
  assert.strictEqual(l.anfragen.length, 1, 'noch keine Anfrage während des Tippens');
  assert.strictEqual(l.takt.zustand().stand, 'wartet');
  assert.strictEqual(l.takt.zustand().text, 'T0', 'der alte Text bleibt stehen');
  await l.vor(250);
  assert.strictEqual(l.anfragen.length, 2);
  assert.strictEqual(l.anfragen[1].rumpf, 'abcde');
});

test('erst nach 400 ms ohne Antwort gedämpft mit Statuszeile; kein Flackern davor (V11)', async () => {
  const l = lage();
  l.takt.anstossen(true);
  await l.antworten(0, ok('T0'));
  l.takt.anstossen(true);
  await l.vor(399);
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'wartet', text: 'T0', meldung: '', gedaempft: false });
  await l.vor(1);
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'wartet', text: 'T0', meldung: VORSCHAU_WARTET, gedaempft: true });
  await l.antworten(1, ok('T1'));
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'aktuell', text: 'T1', meldung: '', gedaempft: false });
  l.takt.anstossen(true);
  await l.antworten(2, ok('T2'));
  await l.vor(1000);
  assert.strictEqual(l.takt.zustand().gedaempft, false, 'ein alter Dämpfer greift nach der Antwort nicht mehr');
});

test('höchstens eine Anfrage unterwegs; was währenddessen angestoßen wird, geht danach einmal los — nur die jüngste Antwort zählt (V11)', async () => {
  const l = lage();
  l.rumpf('erst');
  l.takt.anstossen(true);
  l.rumpf('zwei'); l.takt.anstossen(true);
  l.rumpf('drei'); l.takt.anstossen(true);
  assert.strictEqual(l.anfragen.length, 1, 'die zweite wartet auf die erste');
  await l.antworten(0, ok('ALT'));
  assert.strictEqual(l.anfragen.length, 2, 'danach genau eine mit dem letzten Stand');
  assert.strictEqual(l.anfragen[1].rumpf, 'drei');
  assert.notStrictEqual(l.takt.zustand().text, 'ALT', 'die überholte Antwort wird nicht übernommen');
  assert.strictEqual(l.takt.zustand().stand, 'wartet');
  await l.antworten(1, ok('NEU'));
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'aktuell', text: 'NEU', meldung: '', gedaempft: false });
});

test('eine Antwort, während eine Eingabe entprellt wird, bleibt „wartet“; die Eingabe folgt', async () => {
  const l = lage();
  l.takt.anstossen(true);
  l.takt.anstossen(false);
  await l.antworten(0, ok('ALT'));
  assert.strictEqual(l.takt.zustand().stand, 'wartet');
  await l.vor(250);
  assert.strictEqual(l.anfragen.length, 2);
  await l.antworten(1, ok('NEU'));
  assert.strictEqual(l.takt.zustand().text, 'NEU');
});

test('Schließen: keine Antwort mehr übernommen, kein Wecker, beim nächsten Öffnen wieder leer', async () => {
  const l = lage();
  l.takt.anstossen(true);
  await l.antworten(0, ok('T0'));
  l.takt.anstossen(false);
  l.takt.anstossen(true);
  const vorher = l.gezeigt.length;
  l.takt.schliessen();
  await l.antworten(1, ok('SPAET'));
  await l.vor(1000);
  assert.strictEqual(l.gezeigt.length, vorher, 'nichts mehr gezeigt');
  assert.strictEqual(l.anfragen.length, 2, 'die entprellte Eingabe geht nicht mehr los');
  l.takt.anstossen(true);
  assert.strictEqual(l.takt.zustand().text, '');
  assert.strictEqual(l.anfragen.length, 3);
});

test('Fehler und Verweigerung: alter Text bzw. fehler; danach wieder aktuell', async () => {
  const l = lage();
  l.takt.anstossen(true);
  await l.antworten(0, ok('T0'));
  l.takt.anstossen(true);
  await l.antworten(1, { status: 0, daten: null });
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'fehler', text: 'T0', meldung: KEINE_ANTWORT, gedaempft: true });
  l.takt.anstossen(true);
  await l.antworten(2, { status: 409, daten: { fehler: 'Nicht gespeichert: …' } });
  assert.deepStrictEqual(l.takt.zustand(), { stand: 'verweigert', text: 'Nicht gespeichert: …', meldung: '', gedaempft: false });
  l.takt.anstossen(true);
  await l.antworten(3, ok('T3'));
  assert.strictEqual(l.takt.zustand().stand, 'aktuell');
});
