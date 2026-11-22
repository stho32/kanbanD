// Lauf T1 aus R00234 „Ausgangslage“: 15 Einträge mit Auftrag, Systemhinweis, zwei Fehlern, zwei parallelen Aufrufen, einem Aufruf
// ohne Zeit, einer Wartezeit und dem Bericht im JSON eines Aufrufs. Geteilt von den Node-Tests und der E2E-Spec.
'use strict';

const zeit = uhr => `2026-11-21T${uhr}+01:00`;
const aufruf = (uhr, name, text) => ({ art: 'werkzeugaufruf', wer: 'agent', name, text: JSON.stringify(text), ...(uhr ? { zeit: zeit(uhr) } : {}) });
const ergebnis = (uhr, text) => ({ art: 'werkzeugergebnis', wer: 'werkzeug', text, zeit: zeit(uhr) });
const nachricht = (uhr, wer, text) => ({ art: 'nachricht', wer, text, zeit: zeit(uhr) });

const BERICHT = 'R00229 angelegt.\nErgebnis: bestanden\nCommits: f9e808a6 [DOC] R00229 · Arbeitsbaum sauber: ja';

/** Die Einträge von T1 in der Reihenfolge der Tabelle (Nr = Index + 1). */
const T1 = [
  nachricht('23:30:00.000', 'mensch', 'Projekt: kanbanD · Karte: #247'),
  nachricht('23:30:01.000', 'mensch', '<system-reminder>Lies zuerst die Regeln.</system-reminder>'),
  aufruf('23:30:22.000', 'Bash', { command: 'ls Anforderungen | tail -2', description: 'Nächste freie Nummer' }),
  ergebnis('23:30:26.000', 'R00228-wackler-unter-last.md\nR00229-frei.md'),
  aufruf('23:30:30.999', 'Bash', { command: 'grep -n kd-muted web/laeufe.js' }),
  ergebnis('23:30:31.999', 'Exit code 1'),
  aufruf('23:30:36.999', 'Read', { file_path: 'a.md' }),
  aufruf('23:30:37.499', 'Read', { file_path: 'b.md' }),
  ergebnis('23:30:39.499', '1→# a'),
  ergebnis('23:30:40.499', '<tool_use_error>File does not exist.</tool_use_error>'),
  aufruf(null, 'Bash', { command: 'git status --short', description: 'Arbeitsbaum prüfen' }),
  ergebnis('23:30:45.499', 'kein error gefunden'),
  nachricht('23:31:50.499', 'mensch', 'Bitte weiter.'),
  nachricht('23:31:52.000', 'agent', 'Zwischenstand, Ergebnis: befund mitten im Satz.'),
  aufruf('23:32:30.000', 'SubagentHandback', { message: BERICHT }),
];

/** Als Zeilen des Lesens `{nr, eintrag}` (ohne fehlende Schlüssel wie `eintragPruefen`). */
const T1_ZEILEN = T1.map((e, i) => ({ nr: i + 1, eintrag: { art: e.art, wer: e.wer, text: e.text, zeit: e.zeit || null, name: e.name || null } }));

module.exports = { T1, T1_ZEILEN, BERICHT };
