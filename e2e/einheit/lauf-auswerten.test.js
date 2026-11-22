// R00234 B1206–B1208: Auswertung eines gelesenen Laufs — reine Rechnung aus web/lauf.js (ADR-0041 N1 Punkte 1, 3, 4, 5;
// „Durchsetzung“ Node-Tests). T1 ist die Ausgangslage von R00234, geprobt gegen das Rechenbeispiel.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const lauf = require('../../web/lauf.js');
const { T1_ZEILEN } = require('../tests/laufansicht-t1.js');

const { laufAuswerten, dauerText, DENKZEILE_AB_MS } = lauf;
const e = (nr, art, wer, zeit, text = 'x', name = null) => ({ nr, eintrag: { art, wer, text, zeit, name } });
const um = s => `2026-11-21T08:00:${String(s).padStart(2, '0')}+01:00`;

test('AK 1: dauerText rundet ab auf ganze Sekunden — < 1 s, n s, m min s s, h h m min', () => {
  const tabelle = [[0, '< 1 s'], [999, '< 1 s'], [1000, '1 s'], [4999, '4 s'], [59999, '59 s'], [60000, '1 min 0 s'], [71000, '1 min 11 s'],
    [3599999, '59 min 59 s'], [3600000, '1 h 0 min'], [3725000, '1 h 2 min']];
  for (const [ms, text] of tabelle) assert.strictEqual(dauerText(ms), text, String(ms));
});

test('AK 1: T1 ergibt Werkzeug 13 s, Denken 71 s, Warten 66 s, zusammen 150 s', () => {
  const a = laufAuswerten(T1_ZEILEN, false);
  assert.deepStrictEqual({ gesamt: a.gesamt, werkzeug: a.werkzeug, denken: a.denken, warten: a.warten, bekannt: a.bekannt, grenze: a.grenze },
    { gesamt: 150000, werkzeug: 13000, denken: 71000, warten: 66000, bekannt: true, grenze: false });
});

test('FA 1: jede Lücke gehört dem späteren Eintrag — Ergebnis Werkzeug, agent Denken, Nachricht von mensch Warten', () => {
  const a = laufAuswerten([e(1, 'nachricht', 'mensch', um(0)), e(2, 'werkzeugaufruf', 'agent', um(3)), e(3, 'werkzeugergebnis', 'werkzeug', um(10)), e(4, 'nachricht', 'mensch', um(30))], false);
  assert.deepStrictEqual([a.denken, a.werkzeug, a.warten, a.gesamt], [3000, 7000, 20000, 30000]);
});

test('FA 1: A A E E zählt nichts doppelt — Summe der Teile ist die Gesamtdauer', () => {
  const a = laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0)), e(2, 'werkzeugaufruf', 'agent', um(1)), e(3, 'werkzeugergebnis', 'werkzeug', um(5)), e(4, 'werkzeugergebnis', 'werkzeug', um(6))], false);
  assert.deepStrictEqual([a.gesamt, a.werkzeug, a.denken, a.warten], [6000, 5000, 1000, 0]);
});

test('FA 1: negative Lücke zählt 0; fehlende und falsch geformte zeit mitten im Lauf werden übersprungen', () => {
  const a = laufAuswerten([e(1, 'nachricht', 'agent', um(10)), e(2, 'werkzeugaufruf', 'agent', um(5)), e(3, 'werkzeugergebnis', 'werkzeug', null),
    e(4, 'nachricht', 'agent', 'gestern'), { nr: 5, eintrag: null }, e(6, 'werkzeugergebnis', 'werkzeug', um(9))], false);
  assert.deepStrictEqual([a.gesamt, a.denken, a.werkzeug], [4000, 0, 4000], 'Lücke 5 → 9 gehört Nr 6 über Nr 3–5 hinweg');
});

test('FA 1: weniger als zwei Einträge mit Zeit ergeben „unbekannt“; ein Lauf nur aus Werkzeug und Denken hat Warten 0', () => {
  assert.strictEqual(laufAuswerten([e(1, 'nachricht', 'agent', um(1)), e(2, 'nachricht', 'agent', null)], false).bekannt, false);
  assert.strictEqual(laufAuswerten([], false).bekannt, false);
  const a = laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0)), e(2, 'werkzeugergebnis', 'werkzeug', um(2))], true);
  assert.deepStrictEqual([a.bekannt, a.warten, a.grenze], [true, 0, true]);
});

test('FA 1, offene Frage 1: Nachricht von werkzeug zählt als Werkzeug, Aufruf von mensch als Warten', () => {
  const a = laufAuswerten([e(1, 'nachricht', 'agent', um(0)), e(2, 'nachricht', 'werkzeug', um(2)), e(3, 'werkzeugaufruf', 'mensch', um(5)), e(4, 'werkzeugergebnis', 'agent', um(6))], false);
  assert.deepStrictEqual([a.werkzeug, a.warten, a.denken], [3000, 3000, 0], 'ein Ergebnis zählt immer als Werkzeug');
});

test('AK 7: Denk- und Wartezeilen ab genau 5.000 ms — T1 vor Nr 3, 7, 13, 15', () => {
  assert.strictEqual(DENKZEILE_AB_MS, 5000);
  const a = laufAuswerten(T1_ZEILEN, false);
  assert.deepStrictEqual(a.luecken, [{ vorNr: 3, art: 'denken', dauer: 21000 }, { vorNr: 7, art: 'denken', dauer: 5000 }, { vorNr: 13, art: 'warten', dauer: 65000 }, { vorNr: 15, art: 'denken', dauer: 38000 }]);
  const knapp = laufAuswerten([e(1, 'nachricht', 'mensch', um(0)), { nr: 2, eintrag: { art: 'nachricht', wer: 'agent', text: 'x', zeit: '2026-11-21T08:00:04.999+01:00', name: null } }], false);
  assert.deepStrictEqual(knapp.luecken, [], '4.999 ms ergibt keine');
  const werkzeug = laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0)), e(2, 'werkzeugergebnis', 'werkzeug', um(30))], false);
  assert.deepStrictEqual(werkzeug.luecken, [], 'Werkzeuglücken werden keine Denkzeile');
});
