// Lauf T15 aus R00243 „Ausgangslage“: lange Befehle (über 150 Zeichen) und lange Pfade (über 100 Zeichen), Tokens je Antwort,
// zwei in Nachrichten eingebettete Systemhinweise und ein Fehler — „Längste Schritte“ und „Teuerste Schritte“ tragen je drei
// Einträge, das Seitenfeld ist ungekürzt über 1.000 px hoch. Alle Inhalte erfunden. Geteilt von Node-Tests und E2E-Spec.
'use strict';

const um = uhr => `2026-11-21T${uhr}+01:00`;
const json = o => JSON.stringify(o);
const tk = (ein, aus, cache_lesen, cache_schreiben) => ({ ein, aus, cache_lesen, cache_schreiben });

const T15_KENNUNG = 'entwickler@2026-11-21T09:00+01:00';

const PFAD_A = '/home/entwickler/Projekte/.worktrees/demo/karte-263/src/handler/auflister/transkript/abschnitte/zeitachse/berechnung/worker/verteiler/datei-a.rs';
const PFAD_C = '/home/entwickler/Projekte/.worktrees/demo/karte-263/src/handler/auflister/transkript/abschnitte/zeitachse/berechnung/worker/verteiler/datei-c.rs';
const PFAD_B = '/home/entwickler/Projekte/.worktrees/demo/karte-263/src/handler/auflister/transkript/abschnitte/zeitachse/berechnung/worker/verteiler/datei-b.rs';
const BEFEHL_1 = 'cd /home/entwickler/Projekte/.worktrees/demo/karte-263 && cp web/app.js /home/entwickler/Projekte/Factory/gemeinsam/scratchpad/entw1-263/app.js.fix && git show HEAD:web/app.js | head -n 40';
const BEFEHL_2 = 'cd /home/entwickler/Projekte/.worktrees/demo/karte-263 && cargo test --release --no-fail-fast -- --test-threads=2 handler::auflister::transkript::abschnitte 2>&1 | tail -n 40';

/** Die Einträge von T15 in der Reihenfolge (Nr = Index + 1). */
const uhr = sek => `09:${String(Math.floor(sek / 60)).padStart(2, '0')}:${String(sek % 60).padStart(2, '0')}`;
/** 40 kurze Schritte (je 1 s, ohne Tokens) zwischen der Nachricht und dem Lesen: die Einträge sind länger als das Seitenfeld, so klebt es. */
const FUELLER = Array.from({ length: 40 }, (_, i) => [
  { zeit: um(uhr(310 + 2 * i)), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: `echo ${i + 1}` }) },
  { zeit: um(uhr(311 + 2 * i)), art: 'werkzeugergebnis', wer: 'werkzeug', text: String(i + 1) },
]).flat();

/** Ein Lesen mit langem Pfad und ohne Beschreibung, 1 s: der Anlass („nach Read …“) der Antwort danach wird lang. */
const lesen = (sek, pfad) => [
  { zeit: um(uhr(sek)), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: json({ file_path: pfad }) },
  { zeit: um(uhr(sek + 1)), art: 'werkzeugergebnis', wer: 'werkzeug', text: '1→fn x() {}' },
];

const T15 = [
  { zeit: um('09:00:00'), art: 'nachricht', wer: 'mensch', text: 'Projekt: /w/demo · Karte: #9\n<system-reminder>\nHinweis A.\n</system-reminder>' },
  { zeit: um('09:00:01'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_1, description: 'Echte Probe am Stand vor dem Fix und danach nochmals' }), tokens: tk(5, 800, 30000, 4000) },
  { zeit: um('09:03:01'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Exit code 1\nfehlt: app.js.fix' },
  ...lesen(182, PFAD_C),
  { zeit: um('09:03:05'), art: 'werkzeugaufruf', wer: 'agent', name: 'Edit', text: json({ file_path: PFAD_A, old_string: 'a', new_string: 'b', description: 'Den Fehler im Verteiler beheben' }), tokens: tk(2, 9000, 34000, 41000) },
  { zeit: um('09:05:05'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Datei geändert.\n<system-reminder>\nHinweis C.\n</system-reminder>' },
  { zeit: um('09:05:06'), art: 'nachricht', wer: 'mensch', text: 'Bitte weiter.\n<system-reminder>\nHinweis B.\n</system-reminder>' },
  ...FUELLER,
  ...lesen(391, PFAD_C),
  { zeit: um('09:06:40'), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: json({ file_path: PFAD_B, description: 'Die Datei des Verteilers lesen' }), tokens: tk(1, 700, 75000, 22000) },
  { zeit: um('09:07:20'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '1→fn x() {}' },
  ...lesen(441, PFAD_C),
  { zeit: um('09:07:30'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_2, description: 'Tests der Abschnitte fahren und das Ende lesen' }), tokens: tk(1, 400, 97000, 12000) },
  { zeit: um('09:09:00'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'test result: ok. 12 passed' },
  { zeit: um('09:09:10'), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden', tokens: tk(1, 90, 109000, 300) },
];

module.exports = { T15, T15_KENNUNG, PFAD_A, PFAD_B, BEFEHL_1, BEFEHL_2 };
