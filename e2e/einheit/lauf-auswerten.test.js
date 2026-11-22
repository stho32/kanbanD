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
/** R00240 ergänzt an jedem Eintrag von „Längste“ und „Teuerste Schritte“ die Beschriftung (geprüft in lauf-zeichnen.test.js). */
const ohneB = ({ beschriftung, ...t }) => t;
const ohneBeschriftung = a => ({ ...a, top3: a.top3.map(ohneB), teuer3: a.teuer3.map(ohneB) });

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
  assert.deepStrictEqual(laufAuswerten(T1_ZEILEN, false).top3.map(ohneB), [
    { art: 'warten', nr: 13, schritt: false, dauer: 65000, was: 'wartet · vor Nachricht von Mensch' },
    { art: 'denken', nr: 15, schritt: false, dauer: 38000, was: 'denkt · vor SubagentHandback R00229 angelegt.' },
    { art: 'denken', nr: 3, schritt: false, dauer: 21000, was: 'denkt · vor Bash ls Anforderungen | tail -2' }]);
  const schritt = laufAuswerten([e(1, 'werkzeugaufruf', 'agent', um(0), '{"file_path":"a.md"}', 'Read'), e(2, 'werkzeugergebnis', 'werkzeug', um(3))], false).top3;
  assert.deepStrictEqual(schritt.map(ohneB), [{ art: 'werkzeug', nr: 1, schritt: true, dauer: 3000, was: 'Read a.md' }]);
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

// R00238 AK 2 (B1239): die Auswertung von T1 (ohne `tokens`), aufgenommen vor der ersten Änderung an web/lauf.js für #263.
const ALTBESTAND_T1 = {
  gesamt: 150000, werkzeug: 13000, denken: 71000, warten: 66000, bekannt: true, grenze: false,
  luecken: [
    { vorNr: 3, art: 'denken', dauer: 21000, vor: 'Bash ls Anforderungen | tail -2' },
    { vorNr: 7, art: 'denken', dauer: 5000, vor: 'Read a.md' },
    { vorNr: 13, art: 'warten', dauer: 65000, vor: 'Nachricht von Mensch' },
    { vorNr: 15, art: 'denken', dauer: 38000, vor: 'SubagentHandback R00229 angelegt.' },
  ],
  schritte: [
    { nr: 3, ergebnisNr: 4, aufruf: true, name: 'Bash', befehl: 'ls Anforderungen | tail -2', absicht: 'Nächste freie Nummer', dauer: 4000, parallel: false, fehler: false },
    { nr: 5, ergebnisNr: 6, aufruf: true, name: 'Bash', befehl: 'grep -n kd-muted web/laeufe.js', absicht: null, dauer: 1000, parallel: false, fehler: true },
    { nr: 7, ergebnisNr: 9, aufruf: true, name: 'Read', befehl: 'a.md', absicht: null, dauer: 2500, parallel: true, fehler: false },
    { nr: 8, ergebnisNr: 10, aufruf: true, name: 'Read', befehl: 'b.md', absicht: null, dauer: 3000, parallel: true, fehler: true },
    { nr: 11, ergebnisNr: 12, aufruf: true, name: 'Bash', befehl: 'git status --short', absicht: 'Arbeitsbaum prüfen', dauer: null, parallel: false, fehler: false },
    { nr: 15, ergebnisNr: null, aufruf: true, name: 'SubagentHandback', befehl: 'R00229 angelegt.', absicht: null, dauer: null, parallel: false, fehler: false },
  ],
  top3: [
    { art: 'warten', nr: 13, schritt: false, dauer: 65000, was: 'wartet · vor Nachricht von Mensch' },
    { art: 'denken', nr: 15, schritt: false, dauer: 38000, was: 'denkt · vor SubagentHandback R00229 angelegt.' },
    { art: 'denken', nr: 3, schritt: false, dauer: 21000, was: 'denkt · vor Bash ls Anforderungen | tail -2' },
  ],
  kennzahlen: { werkzeugaufrufe: 6, fehler: 2 },
  bericht: { nr: 15, text: 'R00229 angelegt.\nErgebnis: bestanden\nCommits: f9e808a6 [DOC] R00229 · Arbeitsbaum sauber: ja', ergebnis: 'bestanden', commits: 1 },
  eingeklappt: { 1: 'auftrag', 2: 'systemhinweis' },
};

test('R00238 AK 2: Altbestand — T1 ohne tokens ergibt dieselbe Auswertung wie vor #263, bis auf tokens: null und eine leere Liste der teuersten', () => {
  // R00239 ergänzt Zeitachse und Arten der Zeilen (geprüft in lauf-zeitachse.test.js, lauf-filter.test.js), R00240 die eingebetteten
  // Hinweise und die Beschriftung der Listen (lauf-zeichnen.test.js), R00242 die Wurzeln der Pfad-Marken (lauf-pfade.test.js);
  // jedes alte Feld bleibt gleich
  const { zeitachse, zeilenArten, eingebettet, wurzeln, ...alt } = ohneBeschriftung(laufAuswerten(T1_ZEILEN, false));
  assert.deepStrictEqual(alt, { ...ALTBESTAND_T1, tokens: null, teuer3: [] });
});

/* ── R00238 B1238: Zahlform der Tokens (PO Z. 573, 574; UX S1) ── */

test('R00238 AK 1: tokenKurz rundet ab — volle Zahl unter 10.000, „<n> Tsd.“, „<x,y> Mio.“ ohne „,0“', () => {
  const tabelle = [[0, '0'], [9999, '9.999'], [10000, '10 Tsd.'], [10999, '10 Tsd.'], [999999, '999 Tsd.'], [1000000, '1 Mio.'], [1099999, '1 Mio.'],
    [1100000, '1,1 Mio.'], [4399999, '4,3 Mio.'], [55083706, '55 Mio.'], [1234567890, '1.234,5 Mio.']];
  for (const [n, text] of tabelle) assert.strictEqual(lauf.tokenKurz(n), text, String(n));
});

test('R00238 AK 1: tokenLesetext schreibt die Kurzform aus — „10 Tausend“, „1 Million“, „1,1 Millionen“', () => {
  const tabelle = [[9999, '9.999'], [10000, '10 Tausend'], [1000000, '1 Million'], [1099999, '1 Million'], [1100000, '1,1 Millionen'], [4399999, '4,3 Millionen'],
    [2000000, '2 Millionen'], [1234567890, '1.234,5 Millionen']];
  for (const [n, text] of tabelle) assert.strictEqual(lauf.tokenLesetext(n), text, String(n));
});

test('R00238 AK 1: neue Tokens in der Einzahl „1 neues Token“, sonst „<kurz> neue Tokens“; volle Form mit Tausenderpunkt', () => {
  assert.strictEqual(lauf.neueTokensText(1), '1 neues Token');
  assert.strictEqual(lauf.neueTokensText(0), '0 neue Tokens');
  assert.strictEqual(lauf.neueTokensText(61502), '61 Tsd. neue Tokens');
  assert.strictEqual(lauf.neueTokensText(451), '451 neue Tokens');
  assert.strictEqual(lauf.tokenVoll(34800), '34.800');
  assert.strictEqual(lauf.tokenVoll(0), '0');
});

test('R00238 FA 2: gekürzte Zahl sichtbar aria-hidden, ausgeschrieben in .vh; volle Zahl nur einmal', () => {
  assert.strictEqual(lauf.tokenZahlHtml(35101), '<span aria-hidden="true">35 Tsd.</span><span class="vh">35 Tausend</span>');
  assert.strictEqual(lauf.tokenZahlHtml(9999), '9.999');
  assert.strictEqual(lauf.neueTokensHtml(1), '1 neues Token');
  assert.strictEqual(lauf.neueTokensHtml(61502), '<span aria-hidden="true">61 Tsd.</span><span class="vh">61 Tausend</span> neue Tokens');
});

/* ── R00238 B1239: Antworten, Summe, `warten_davor`, drei teuerste (ADR-0041 N3 Punkte 2–5, N3.1) ── */

const { T8 } = require('../tests/laufansicht-t8');
/** Wie im Programm: jede Zeile geht durch `eintragPruefen`, die Nummer ist die Stelle (ab 1). */
const wieGelesen = eintraege => eintraege.map((o, i) => ({ nr: i + 1, eintrag: lauf.eintragPruefen(JSON.parse(JSON.stringify(o))) }));
const T8_ZEILEN = wieGelesen(T8);
const tk = (ein, aus, cache_lesen, cache_schreiben) => ({ ein, aus, cache_lesen, cache_schreiben });
const s = sek => `2026-11-22T10:00:00+01:00`.replace('10:00:00', `10:${String(Math.floor(sek / 60)).padStart(2, '0')}:${String(sek % 60).padStart(2, '0')}`);
const msg = (wer, sek, tokens) => ({ art: 'nachricht', wer, text: 'x', zeit: sek === null ? 'gestern' : s(sek), ...(tokens ? { tokens } : {}) });
const call = (sek, befehl, tokens) => ({ art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: befehl }), zeit: s(sek), ...(tokens ? { tokens } : {}) });
const res = sek => ({ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok', zeit: s(sek) });

test('R00238 Rechenbeispiel T8: Summe aller vier 239.177, neue Tokens 115.177, Einzelwerte über die gelesenen Einträge', () => {
  const a = laufAuswerten(T8_ZEILEN, false);
  const { antworten, folge, ...summe } = a.tokens;
  assert.deepStrictEqual(summe, { summe: 239177, neu: 115177, ein: 7, aus: 1970, cache_lesen: 124000, cache_schreiben: 113200 });
});

test('R00238 AK 4, AK 7: T8 — Antworten 2, 5, 7, 12 mit neuen Tokens, nachNr und warten_davor; Nr 9 ist keine Antwort', () => {
  const a = laufAuswerten(T8_ZEILEN, false);
  assert.deepStrictEqual(a.tokens.antworten, [
    { nr: 2, tokens: tk(3, 120, 0, 18000), neu: 18123, nachNr: null, warten_davor: null },
    { nr: 5, tokens: tk(1, 300, 18000, 34800), neu: 35101, nachNr: 3, warten_davor: null },
    { nr: 7, tokens: tk(1, 50, 52800, 400), neu: 451, nachNr: 5, warten_davor: null },
    { nr: 12, tokens: tk(2, 1500, 53200, 60000), neu: 61502, nachNr: null, warten_davor: 317000 },
  ]);
  assert.strictEqual(a.tokens.antworten.reduce((n, x) => n + x.neu, 0), 115177, 'die neuen Tokens aller Antworten ergeben zusammen 115.177');
  assert.deepStrictEqual(a.tokens.folge, { 3: 2 }, 'Nr 3 gehört zur Antwort von Nr 2; Nr 9 zu keiner (Antwort endet am Ergebnis)');
  assert.deepStrictEqual(a.luecken.filter(l => l.art === 'warten').map(l => [l.vorNr, dauerText(l.dauer)]), [[11, '5 min 17 s']]);
});

test('R00238 AK 6: T8 — „Teuerste Schritte“ 12, 5, 2 nach neuen Tokens; Nr 7 mit der zweitgrößten Summe fehlt', () => {
  assert.deepStrictEqual(laufAuswerten(T8_ZEILEN, false).teuer3.map(ohneB), [
    { nr: 12, neu: 61502, was: 'Nachricht von Agent', nach: 'nach 5 min 17 s Warten' },
    { nr: 5, neu: 35101, was: 'Bash grep -n tokens web/lauf.js', nach: 'nach Read regeln.md' },
    { nr: 2, neu: 18123, was: 'Read regeln.md', nach: null },
  ]);
});

test('R00238 AK 4: Antwort aus Nachricht und zwei parallelen Aufrufen — Tokens an der Nachricht, beide Aufrufe verweisen; Summe der Antworten = Summe des Transkripts', () => {
  const a = laufAuswerten(wieGelesen([msg('mensch', 0), msg('agent', 2, tk(5, 10, 100, 1000)), call(3, 'a'), call(3, 'b'), res(4), res(5), call(6, 'c', tk(1, 1, 1, 1))]), false);
  assert.deepStrictEqual(a.tokens.antworten.map(x => [x.nr, x.neu]), [[2, 1015], [7, 3]]);
  assert.deepStrictEqual(a.tokens.folge, { 3: 2, 4: 2 });
  assert.deepStrictEqual(a.schritte.filter(x => x.aufruf).map(x => x.parallel), [true, true, false]);
  assert.strictEqual(a.tokens.antworten.reduce((n, x) => n + x.neu, 0), a.tokens.neu);
  assert.strictEqual(a.teuer3[0].was, 'Bash a', 'beschriftet mit dem ersten Aufruf der Antwort');
});

test('R00238 AK 4: zwei Antworten mit tokens ohne Eintrag eines anderen wer dazwischen sind zwei Antworten', () => {
  const a = laufAuswerten(wieGelesen([msg('agent', 0, tk(1, 0, 0, 0)), call(1, 'a', tk(2, 0, 0, 0)), msg('agent', 2)]), false);
  assert.deepStrictEqual(a.tokens.antworten.map(x => [x.nr, x.neu]), [[1, 1], [2, 2]]);
  assert.deepStrictEqual(a.tokens.folge, { 3: 2 }, 'die Nachricht ohne tokens gehört zur zweiten Antwort');
});

test('R00238 AK 4: eine Antwort endet an einem Eintrag von mensch, an einem Ergebnis und an einer unlesbaren Zeile', () => {
  const zeilen = wieGelesen([msg('agent', 0, tk(1, 0, 0, 0)), msg('mensch', 1), msg('agent', 2), msg('agent', 3, tk(1, 0, 0, 0)), res(4), call(5, 'x'), msg('agent', 6, tk(1, 0, 0, 0))]);
  zeilen.push({ nr: 8, eintrag: null }, { nr: 9, eintrag: lauf.eintragPruefen(msg('agent', 7)) });
  assert.deepStrictEqual(laufAuswerten(zeilen, false).tokens.folge, {});
});

test('R00238 AK 6: Rangfolge nach neuen Tokens — große Summe mit wenig neuen fehlt; Gleichstand die frühere zuerst; nie mehr als drei', () => {
  const zeilen = wieGelesen([
    call(0, 'a', tk(0, 10, 0, 0)), res(1), call(2, 'b', tk(0, 5, 9999999, 0)), res(3), call(4, 'c', tk(0, 10, 0, 0)), res(5),
    call(6, 'd', tk(0, 10, 0, 0)), res(7), call(8, 'e', tk(0, 11, 0, 0)), res(9),
  ]);
  assert.deepStrictEqual(laufAuswerten(zeilen, false).teuer3.map(t => [t.was, t.neu]), [['Bash e', 11], ['Bash a', 10], ['Bash c', 10]]);
});

test('R00238 AK 7: warten_davor — 5.000 ms ergibt 5.000, 4.900 ms null; die letzte von zwei Wartezeilen', () => {
  const ms = (sek, milli) => s(sek).replace('+01:00', `.${String(milli).padStart(3, '0')}+01:00`);
  const fuenf = laufAuswerten(wieGelesen([msg('agent', 0, tk(1, 0, 0, 0)), msg('mensch', 5), msg('agent', 6, tk(1, 0, 0, 0))]), false);
  assert.strictEqual(fuenf.tokens.antworten[1].warten_davor, 5000);
  const knapp = laufAuswerten(wieGelesen([msg('agent', 0, tk(1, 0, 0, 0)), { ...msg('mensch', 0), zeit: ms(4, 900) }, msg('agent', 6, tk(1, 0, 0, 0))]), false);
  assert.strictEqual(knapp.tokens.antworten[1].warten_davor, null, '4.900 ms ist keine Wartezeile');
  const zwei = laufAuswerten(wieGelesen([msg('agent', 0, tk(1, 0, 0, 0)), msg('mensch', 10), msg('mensch', 30), msg('agent', 31, tk(1, 0, 0, 0))]), false);
  assert.strictEqual(zwei.tokens.antworten[1].warten_davor, 20000, 'die letzte, also die der Antwort nächste');
});

test('R00238 AK 7: warten_davor null bei gesetztem nachNr; eine Wartezeile gilt nicht für die nächste Antwort; Lücke ohne gültige zeit setzt nichts', () => {
  const mitNach = laufAuswerten(wieGelesen([msg('mensch', 0), msg('mensch', 10), call(11, 'a'), res(12), msg('agent', 13, tk(1, 0, 0, 0))]), false);
  assert.deepStrictEqual(mitNach.tokens.antworten.map(x => [x.nachNr, x.warten_davor]), [[3, null]]);
  assert.strictEqual(mitNach.teuer3[0].nach, 'nach Bash a');
  const naechste = laufAuswerten(wieGelesen([msg('mensch', 0), msg('mensch', 10), msg('agent', 11, tk(1, 0, 0, 0)), msg('agent', 12, tk(1, 0, 0, 0))]), false);
  assert.deepStrictEqual(naechste.tokens.antworten.map(x => x.warten_davor), [10000, null]);
  assert.deepStrictEqual(naechste.teuer3.map(t => t.nach), ['nach 10 s Warten', null]);
  const ohneZeit = laufAuswerten(wieGelesen([msg('agent', 0, tk(1, 0, 0, 0)), msg('mensch', null), msg('agent', 40, tk(1, 0, 0, 0))]), false);
  assert.deepStrictEqual(ohneZeit.tokens.antworten.map(x => x.warten_davor), [null, null]);
});

test('R00238 AK 2: ohne tokens im Transkript tokens null und keine teuersten; der Kopf zählt nur gelesene Einträge', () => {
  const a = laufAuswerten(wieGelesen([msg('agent', 0), call(1, 'a'), res(2)]), false);
  assert.deepStrictEqual([a.tokens, a.teuer3], [null, []]);
});

test('R00238 FA 9: T9 — 20.000 Zeilen, jeder Aufruf mit {aus: 10}: Summe 100.000, teuerste die Zeilen 1, 3, 5 (Beobachtung Dauer)', () => {
  const beginn = Date.parse('2026-11-22T08:00:00+01:00');
  const iso = ms => new Date(ms).toISOString();
  const zeilen = Array.from({ length: 20000 }, (_, i) => ({ nr: i + 1, eintrag: lauf.eintragPruefen(i % 2
    ? { art: 'werkzeugergebnis', wer: 'werkzeug', text: String(i), zeit: iso(beginn + i * 1000) }
    : { art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: `echo ${i + 1}` }), zeit: iso(beginn + i * 1000), tokens: { aus: 10 } }) }));
  const vor = process.hrtime.bigint();
  const a = laufAuswerten(zeilen, true);
  const dauer = Number(process.hrtime.bigint() - vor) / 1e6;
  assert.deepStrictEqual([a.tokens.summe, a.tokens.neu, a.tokens.antworten.length], [100000, 100000, 10000]);
  assert.deepStrictEqual(a.teuer3.map(t => [t.nr, t.neu]), [[1, 10], [3, 10], [5, 10]]);
  console.log(`# Beobachtung: laufAuswerten über 20.000 Zeilen mit tokens in ${dauer.toFixed(1)} ms`);
});
