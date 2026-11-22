// Lauf T8 aus R00238 „Ausgangslage“: 12 Einträge, vier Antworten mit `tokens` (Nr 2 mit Nr 3, 5, 7, 12), Nr 9 mit falsch geformtem
// `tokens`, eine Wartezeile von 5 min 17 s vor Nr 11. Geteilt von den Node-Tests und der E2E-Spec.
'use strict';

const um = uhr => `2026-11-22T${uhr}+01:00`;
const tk = (ein, aus, cache_lesen, cache_schreiben) => ({ ein, aus, cache_lesen, cache_schreiben });

/** Die Einträge von T8 in der Reihenfolge der Tabelle (Nr = Index + 1). */
const T8 = [
  { zeit: um('10:00:00'), art: 'nachricht', wer: 'mensch', text: 'Projekt: kanbanD · Karte: #263' },
  { zeit: um('10:00:05'), art: 'nachricht', wer: 'agent', text: 'Ich lese zuerst die Regeln.', tokens: tk(3, 120, 0, 18000) },
  { zeit: um('10:00:06'), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: '{"file_path":"regeln.md"}' },
  { zeit: um('10:00:07'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '1→# Regeln' },
  { zeit: um('10:00:20'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"grep -n tokens web/lauf.js"}', tokens: tk(1, 300, 18000, 34800) },
  { zeit: um('10:00:21'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '77: tokens' },
  { zeit: um('10:00:30'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"git status --short"}', tokens: tk(1, 50, 52800, 400) },
  { zeit: um('10:00:31'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ' M web/lauf.js' },
  { zeit: um('10:00:35'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"ls"}', tokens: { ein: -1, aus: 1.5 } },
  { zeit: um('10:00:36'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'a.md' },
  { zeit: um('10:05:53'), art: 'nachricht', wer: 'mensch', text: 'Bitte weiter.' },
  { zeit: um('10:05:55'), art: 'nachricht', wer: 'agent', text: 'Fertig.\nErgebnis: bestanden\nCommits: keine', tokens: tk(2, 1500, 53200, 60000) },
];

module.exports = { T8 };
