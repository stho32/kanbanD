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
  assert.deepStrictEqual(a.luecken.map(({ vorNr, art, dauer }) => ({ vorNr, art, dauer })), [{ vorNr: 3, art: 'denken', dauer: 21000 }, { vorNr: 7, art: 'denken', dauer: 5000 }, { vorNr: 13, art: 'warten', dauer: 65000 }, { vorNr: 15, art: 'denken', dauer: 38000 }]);
  const knapp = laufAuswerten([e(1, 'nachricht', 'mensch', um(0)), { nr: 2, eintrag: { art: 'nachricht', wer: 'agent', text: 'x', zeit: '2026-11-21T08:00:04.999+01:00', name: null } }], false);
  assert.deepStrictEqual(knapp.luecken, [], '4.999 ms ergibt keine');
  const werkzeug = laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0)), e(2, 'werkzeugergebnis', 'werkzeug', um(30))], false);
  assert.deepStrictEqual(werkzeug.luecken, [], 'Werkzeuglücken werden keine Denkzeile');
});

/* ── B1207: Paaren über die Warteschlange, Kurzbefehl und Absicht, Fehler am Textanfang ── */
const { kurzbefehl, fehlerErkennen } = lauf;
const kurz = s => ({ nr: s.nr, ergebnisNr: s.ergebnisNr, name: s.name, dauer: s.dauer, parallel: s.parallel, fehler: s.fehler });

test('AK 5: T1 paart nach der Warteschlange — 3↔4, 5↔6, 7↔9, 8↔10, 11↔12, 15 allein; Dauer Ergebnis minus Aufruf', () => {
  const a = laufAuswerten(T1_ZEILEN, false);
  assert.deepStrictEqual(a.schritte.map(kurz), [
    { nr: 3, ergebnisNr: 4, name: 'Bash', dauer: 4000, parallel: false, fehler: false },
    { nr: 5, ergebnisNr: 6, name: 'Bash', dauer: 1000, parallel: false, fehler: true },
    { nr: 7, ergebnisNr: 9, name: 'Read', dauer: 2500, parallel: true, fehler: false },
    { nr: 8, ergebnisNr: 10, name: 'Read', dauer: 3000, parallel: true, fehler: true },
    { nr: 11, ergebnisNr: 12, name: 'Bash', dauer: null, parallel: false, fehler: false },
    { nr: 15, ergebnisNr: null, name: 'SubagentHandback', dauer: null, parallel: false, fehler: false },
  ]);
  assert.deepStrictEqual([a.schritte[0].befehl, a.schritte[0].absicht, a.schritte[1].absicht], ['ls Anforderungen | tail -2', 'Nächste freie Nummer', null]);
});

test('FA 6: ein Ergebnis ohne offenen Aufruf steht allein; ein Aufruf ohne Ergebnis auch', () => {
  const a = laufAuswerten([e(1, 'werkzeugergebnis', 'werkzeug', um(0), 'Exit code 2'), e(2, 'werkzeugaufruf', 'agent', um(1), 'ls', 'Bash')], false);
  assert.deepStrictEqual(a.schritte.map(kurz), [
    { nr: 1, ergebnisNr: 1, name: null, dauer: null, parallel: false, fehler: true },
    { nr: 2, ergebnisNr: null, name: 'Bash', dauer: null, parallel: false, fehler: false },
  ]);
  assert.strictEqual(a.schritte[0].aufruf, false);
  assert.strictEqual(a.schritte[1].aufruf, true);
});

test('AK 5: kurzbefehl — JSON mit command, Text ohne JSON, JSON ohne bekannten Schlüssel, Vorrang der Schlüssel, 200 Zeichen', () => {
  assert.deepStrictEqual(kurzbefehl('{"command":"git log -1\\nzweite","description":"Stand"}'), { befehl: 'git log -1', absicht: 'Stand' });
  assert.deepStrictEqual(kurzbefehl('Anforderungen/R00219.md\nzweite'), { befehl: 'Anforderungen/R00219.md', absicht: null });
  assert.deepStrictEqual(kurzbefehl('{"zahl":3,"ziel":"erste Zeile\\nzweite","description":"Absicht"}'), { befehl: 'erste Zeile', absicht: 'Absicht' });
  assert.deepStrictEqual(kurzbefehl('{"old_string":"a","file_path":"web/app.js"}'), { befehl: 'web/app.js', absicht: null });
  assert.deepStrictEqual(kurzbefehl('{"description":"nur Absicht"}'), { befehl: null, absicht: 'nur Absicht' });
  assert.deepStrictEqual(kurzbefehl('[1,2]'), { befehl: '[1,2]', absicht: null });
  assert.strictEqual(kurzbefehl(JSON.stringify({ command: 'x'.repeat(250) })).befehl, 'x'.repeat(200) + '…');
  assert.strictEqual(kurzbefehl(JSON.stringify({ command: 'x', description: 'y'.repeat(250) })).absicht, 'y'.repeat(200) + '…');
});

test('AK 6: fehlerErkennen nur am Anfang — Exit code 0 nein, Exit code 2 ja, error mitten im Text nein, <tool_use_error> am Anfang ja', () => {
  assert.strictEqual(fehlerErkennen('Exit code 0'), false);
  assert.strictEqual(fehlerErkennen('Exit code 2\nstderr'), true);
  assert.strictEqual(fehlerErkennen('kein error gefunden'), false);
  assert.strictEqual(fehlerErkennen('<tool_use_error>File does not exist.</tool_use_error>'), true);
  assert.strictEqual(fehlerErkennen('Ausgabe\nExit code 1'), false, 'nur die erste Zeile');
  assert.strictEqual(fehlerErkennen(' <tool_use_error>x'), false, 'nur am Textanfang');
  assert.strictEqual(fehlerErkennen('Exit code 12'), true);
});

/* ── B1208: Bericht, Kennzahlen, Längste Schritte, Auftrag und Systemhinweise ── */
const { BERICHT } = require('../tests/laufansicht-t1.js');

test('AK 4: T1 — der Bericht ist Nr 15 (JSON eines Aufrufs), nicht Nr 14 mit „Ergebnis:“ mitten im Satz; Commits 1', () => {
  const a = laufAuswerten(T1_ZEILEN, false);
  assert.deepStrictEqual(a.bericht, { nr: 15, text: BERICHT, ergebnis: 'bestanden', commits: 1 });
});

test('AK 4: Bericht in einer Nachricht wie im Aufruf; der letzte zählt; „Commits: keine“ ergibt 0; ohne Commits-Zeile null', () => {
  const n = laufAuswerten([e(1, 'nachricht', 'agent', null, 'Fertig.\nErgebnis: befund\nCommits: keine · Arbeitsbaum sauber: ja')], false);
  assert.deepStrictEqual(n.bericht, { nr: 1, text: 'Fertig.\nErgebnis: befund\nCommits: keine · Arbeitsbaum sauber: ja', ergebnis: 'befund', commits: 0 });
  const zwei = laufAuswerten([e(1, 'nachricht', 'agent', null, 'Ergebnis: befund'), e(2, 'nachricht', 'agent', null, 'Ergebnis: blockiert\nCommits: abc1234 def5678 0123456789abcdef0123456789abcdef01234567')], false);
  assert.deepStrictEqual([zwei.bericht.nr, zwei.bericht.ergebnis, zwei.bericht.commits], [2, 'blockiert', 3]);
  assert.strictEqual(laufAuswerten([e(1, 'nachricht', 'agent', null, 'Ergebnis: bestanden')], false).bericht.commits, null);
});

test('AK 4: kein Bericht — Ergebnis nur mitten in einer Zeile, unbekanntes Wort, Nachricht von mensch oder werkzeug', () => {
  for (const [wer, text] of [['agent', 'Das Ergebnis: bestanden'], ['agent', 'Ergebnis: gut'], ['mensch', 'Ergebnis: bestanden'], ['werkzeug', 'Ergebnis: bestanden']]) {
    assert.strictEqual(laufAuswerten([e(1, 'nachricht', wer, null, text)], false).bericht, null, `${wer}: ${text}`);
  }
});

test('AK 3: Kennzahlen von T1 — 6 Werkzeugaufrufe, 2 Fehler', () => {
  assert.deepStrictEqual(laufAuswerten(T1_ZEILEN, false).kennzahlen, { werkzeugaufrufe: 6, fehler: 2 });
});

test('AK 9: Längste Schritte von T1 — Wartezeile vor 13, Denkzeilen vor 15 und vor 3', () => {
  assert.deepStrictEqual(laufAuswerten(T1_ZEILEN, false).top3, [
    { art: 'warten', nr: 13, schritt: false, dauer: 65000, was: 'wartet · vor Nachricht von Mensch' },
    { art: 'denken', nr: 15, schritt: false, dauer: 38000, was: 'denkt · vor SubagentHandback R00229 angelegt.' },
    { art: 'denken', nr: 3, schritt: false, dauer: 21000, was: 'denkt · vor Bash ls Anforderungen | tail -2' }]);
  const schritt = laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0), '{"file_path":"a.md"}', 'Read'), e(2, 'werkzeugergebnis', 'werkzeug', um(3))], false).top3;
  assert.deepStrictEqual(schritt, [{ art: 'werkzeug', nr: 1, schritt: true, dauer: 3000, was: 'Read a.md' }]);
});

test('AK 9: Gleichstand — die frühere Zeile zuerst; eine Denkzeile vor Nr k liegt vor dem Schritt Nr k; ohne Dauer keine Liste', () => {
  const gleich = laufAuswerten([1, 2, 3, 4, 5, 6, 7, 8].map(k => e(k, k % 2 ? 'werkzeugaufruf' : 'werkzeugergebnis', k % 2 ? 'agent' : 'werkzeug', um(k - 1))), false);
  assert.deepStrictEqual(gleich.top3.map(t => [t.nr, t.schritt]), [[1, true], [3, true], [5, true]]);
  const vorher = laufAuswerten([e(1, 'nachricht', 'mensch', um(0)), e(2, 'werkzeugaufruf', 'agent', um(9)), e(3, 'werkzeugergebnis', 'werkzeug', um(18))], false);
  assert.deepStrictEqual(vorher.top3.map(t => [t.nr, t.schritt, t.dauer]), [[2, false, 9000], [2, true, 9000]]);
  assert.deepStrictEqual(laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0)), e(2, 'werkzeugergebnis', 'werkzeug', null)], false).top3, []);
});

test('AK 8: Auftrag ist die erste Nachricht von mensch, Systemhinweise beginnen ohne führenden Leerraum mit der Marke', () => {
  assert.deepStrictEqual(laufAuswerten(T1_ZEILEN, false).eingeklappt, { 1: 'auftrag', 2: 'systemhinweis' });
  const a = laufAuswerten([e(1, 'nachricht', 'agent', null, 'a'), e(2, 'nachricht', 'mensch', null, 'Auftrag'), e(3, 'nachricht', 'mensch', null, '  [SYSTEM NOTIFICATION - x]'),
    e(4, 'nachricht', 'mensch', null, 'Hinweis: <system-reminder>'), e(5, 'nachricht', 'mensch', null, '\n<system-reminder>y'), e(6, 'werkzeugaufruf', 'mensch', null, '<system-reminder>')], false);
  assert.deepStrictEqual(a.eingeklappt, { 2: 'auftrag', 3: 'systemhinweis', 5: 'systemhinweis' });
});

test('AK 2: T3 — 20.000 gelesene Zeilen an der Grenze: 19.999 s, Werkzeug 10.000 s, Denken 9.999 s, kein Bericht, Top 3 Zeilen 1, 3, 5', () => {
  const beginn = Date.parse('2026-11-21T08:00:00+01:00');
  const iso = ms => new Date(ms).toISOString();
  const zeilen = Array.from({ length: 20000 }, (_, i) => e(i + 1, i % 2 ? 'werkzeugergebnis' : 'werkzeugaufruf', i % 2 ? 'werkzeug' : 'agent', iso(beginn + i * 1000), i % 2 ? 'ok' : '{"command":"true"}', i % 2 ? null : 'Bash'));
  const vor = process.hrtime.bigint();
  const a = laufAuswerten(zeilen, true);
  const dauer = Number(process.hrtime.bigint() - vor) / 1e6;
  assert.deepStrictEqual([a.gesamt, a.werkzeug, a.denken, a.warten, a.grenze, a.bericht, a.kennzahlen.werkzeugaufrufe], [19999000, 10000000, 9999000, 0, true, null, 10000]);
  assert.deepStrictEqual(a.top3.map(t => t.nr), [1, 3, 5]);
  console.log(`# Beobachtung: laufAuswerten über 20.000 Zeilen in ${dauer.toFixed(1)} ms`);
});
