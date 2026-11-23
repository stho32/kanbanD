// Lauf T16 aus R00244 „Ausgangslage“ (Datum 2026-11-22 statt 2026-11-25: der Server lehnt Zeitpunkte in der Zukunft ab): Farbfolgen
// im Ergebnis (Playwright-„Call log“, rustfmt, verbotene Folgen), fehlgeschlagenes Edit und Write, Edit ohne Ergebnis und erfolgreich,
// `ESC` in Aufruf und Nachricht. Nr 18 der Tabelle ist Aufruf (Nr 18) und Ergebnis (Nr 19). Alle Inhalte erfunden. Geteilt von den
// Node-Tests und der E2E-Spec.
'use strict';

const E = '\u001b';
const um = uhr => `2026-11-22T${uhr}+01:00`;
const json = o => JSON.stringify(o);

const T16_KENNUNG = 'planer@2026-11-22T10:00+01:00';

const ERGEBNIS_3 = ['Exit code 1', '### Error: locator.click: Timeout 5000ms exceeded.', 'Call log:',
  `${E}[2m  - waiting for getByRole('button', { name: 'Speichern' })${E}[22m`, `${E}[2m  - locator resolved to <button>${E}[22m`, `${E}(B ${E}[m`].join('\n');
const ERGEBNIS_5 = ['Exit code 1', 'Diff in src/main.rs:3:', `${E}[31m-    let x=1;${E}[0m`, `${E}[32m+    let x = 1;${E}[0m`, 'ok-Zeile ohne Farbe'].join('\n');
const NICHT_GELESEN = '<tool_use_error>File has not been read yet. Read it first before writing to it.</tool_use_error>';
const EDIT_A = json({ file_path: '/w/wt/demo/karte-7/web/a.js', old_string: 'alt', new_string: 'neu' });
const ERGEBNIS_14 = `${E}[8mgeheim${E}[0m ${E}[7mumgekehrt${E}[0m ${E}[30;40mschwarz${E}[0m ${E}[38;5;196mrot${E}[0m`;
const ERGEBNIS_19 = `${E}[2mgedämpft${E}[22m ${E}[31mrot${E}[0m ${E}[32mgrün${E}[0m ${E}[33mgelb${E}[0m ${E}[1mfett${E}[22m ${E}[1;31mrot-fett${E}[0m`;

/** Die Einträge von T16 in der Reihenfolge der Tabelle (Nr = Index + 1). */
const T16 = [
  { zeit: um('10:00:00'), art: 'nachricht', wer: 'mensch', text: 'Projekt: /w/demo\nArbeitsort: Worktree /w/wt/demo/karte-7' },
  { zeit: um('10:00:10'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'npx playwright test', description: 'E2E' }) },
  { zeit: um('10:00:20'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_3 },
  { zeit: um('10:00:30'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'cargo fmt --check', description: 'Format' }) },
  { zeit: um('10:00:31'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_5 },
  { zeit: um('10:00:40'), art: 'werkzeugaufruf', wer: 'agent', name: 'Edit', text: EDIT_A },
  { zeit: um('10:00:41'), art: 'werkzeugergebnis', wer: 'werkzeug', text: NICHT_GELESEN },
  { zeit: um('10:00:50'), art: 'werkzeugaufruf', wer: 'agent', name: 'Write', text: json({ file_path: '/w/wt/demo/karte-7/notiz.md', content: 'a' }) },
  { zeit: um('10:00:51'), art: 'werkzeugergebnis', wer: 'werkzeug', text: NICHT_GELESEN },
  { zeit: um('10:01:00'), art: 'werkzeugaufruf', wer: 'agent', name: 'Edit', text: EDIT_A },
  { zeit: um('10:01:10'), art: 'werkzeugaufruf', wer: 'agent', name: 'Edit', text: json({ file_path: '/w/wt/demo/karte-7/web/b.js', old_string: 'alt', new_string: 'neu' }) },
  { zeit: um('10:01:11'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'The file /w/wt/demo/karte-7/web/b.js has been updated.' },
  { zeit: um('10:01:20'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: `{"command":"echo ${E}[31mrot${E}[0m","description":"Marke"}` },
  { zeit: um('10:01:21'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_14 },
  { zeit: um('10:01:30'), art: 'nachricht', wer: 'agent', text: `${E}[31mfertig${E}[0m` },
  { zeit: um('10:01:40'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'ls', description: 'Liste' }) },
  { zeit: um('10:01:41'), art: 'werkzeugergebnis', wer: 'werkzeug', text: `${E}[32mgruen${E}[0m fertig` },
  { zeit: um('10:01:50'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'ls', description: 'Spannen' }) },
  { zeit: um('10:01:51'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_19 },
];

module.exports = { T16, T16_KENNUNG, ERGEBNIS_3, ERGEBNIS_5, ERGEBNIS_14, ERGEBNIS_19 };
