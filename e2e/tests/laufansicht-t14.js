// Lauf T14 und T14o aus R00242 „Ausgangslage“ (Datum 2026-11-22 statt 2026-11-24: der Server lehnt Zeitpunkte in der Zukunft ab):
// 16 Einträge mit Kopf des Auftrags, Read/Edit/Write/NotebookEdit, Bash, `<persisted-output>`, Grep und einer Nachricht mit Pfaden;
// T14o ohne Kopf. Alle Inhalte erfunden; Kopf, `cat -n` und `<persisted-output>` sind echten Transkripten nachgebildet. Geteilt von den
// Node-Tests und der E2E-Spec.
'use strict';

const um = uhr => `2026-11-22T${uhr}+01:00`;
const json = o => JSON.stringify(o);

const T14_KENNUNG = 'planer@2026-11-22T10:00+01:00';
const T14O_KENNUNG = 'planer@2026-11-22T11:00+01:00';

const KOPF = ['Projekt: /w/demo  ·  Factory: /w/fab', 'Karte: #7 Probe', 'Arbeitsort: Worktree /w/wt/demo/karte-7, Zweig karte/7. Arbeite nur dort.',
  'Ablage: /w/fab/ablage/plan-7/ (nur dieser Ordner)', 'Lies zuerst /w/fab/ablage/plan-7/auftrag.md.'].join('\n');
const EDIT_PFAD = '/w/wt/demo/karte-7/web/a b?c#d%e:12.js';
const ERGEBNIS_5 = `The file ${EDIT_PFAD} has been updated. Here's the result of running \`cat -n\` on a snippet of the edited file:\n    42→y\n    43→z`;
const ERGEBNIS_9 = ['<persisted-output>', 'Output too large (12.0KB). Full output saved to: /w/fab/ablage/plan-7/tool-results/b1.txt', '', 'Preview (first 2KB):',
  'ok /w/demo/y.txt', '</persisted-output>'].join('\n');
const BEFEHL_8 = 'cat /w/demo/README.md && ls /w/wt/demo/karte-7/web';
const NACHRICHT_16 = 'Geändert: `web/a.js`, siehe /w/demo/src/b.rs:42 und /w/demo/a&b.js. Lauf `cat web/a.js` bleibt Code; nicht ../x/y.js, nicht /w/demox/c.rs, nicht /w/demo/‮d.rs.';

/** Die Einträge von T14 in der Reihenfolge der Tabelle (Nr = Index + 1). */
const T14 = [
  { zeit: um('10:00:00'), art: 'nachricht', wer: 'mensch', text: KOPF },
  { zeit: um('10:00:01'), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: '{"file_path":"/w/wt/demo/karte-7/web/a.js","offset":10,"limit":2}' },
  { zeit: um('10:00:02'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '    10→x\n    11→/w/demo/z.txt' },
  { zeit: um('10:00:03'), art: 'werkzeugaufruf', wer: 'agent', name: 'Edit', text: json({ file_path: EDIT_PFAD, old_string: 'x', new_string: 'y' }) },
  { zeit: um('10:00:04'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_5 },
  { zeit: um('10:00:05'), art: 'werkzeugaufruf', wer: 'agent', name: 'Write', text: json({ file_path: '/w/fab/ablage/plan-7/notiz.md', content: 'a' }) },
  { zeit: um('10:00:06'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'File created successfully at: /w/fab/ablage/plan-7/notiz.md' },
  { zeit: um('10:00:07'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_8, description: 'Lesen' }) },
  { zeit: um('10:00:08'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_9 },
  { zeit: um('10:00:09'), art: 'werkzeugaufruf', wer: 'agent', name: 'Grep', text: json({ pattern: 'x', path: '/w/demo/src' }) },
  { zeit: um('10:00:10'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '/w/demo/src/m.rs' },
  { zeit: um('10:00:11'), art: 'werkzeugaufruf', wer: 'agent', name: 'NotebookEdit', text: json({ notebook_path: '/w/demo/n.ipynb', new_source: 'x' }) },
  { zeit: um('10:00:12'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' },
  { zeit: um('10:00:13'), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: json({ file_path: '/w/demo/‮evil.js' }) },
  { zeit: um('10:00:14'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' },
  { zeit: um('10:00:15'), art: 'nachricht', wer: 'agent', text: NACHRICHT_16 },
];

/** T14o (Aufgabe #2, ohne Kopf). */
const T14O = [
  { zeit: '2026-11-22T11:00:00+01:00', art: 'nachricht', wer: 'mensch', text: 'Bitte /w/demo/a.js und `web/a.js` prüfen.' },
  { zeit: '2026-11-22T11:00:01+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: '{"file_path":"/w/demo/a.js"}' },
  { zeit: '2026-11-22T11:00:02+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' },
];

/** AK 8: Nachrichten mit langen absoluten Pfaden — 300 Zeichen ohne `/` nach dem ersten Teil (Link ohne Marke) und mit Marke. */
const LANG = [
  { zeit: um('10:00:16'), art: 'nachricht', wer: 'agent', text: `Lang: /w/${'p'.repeat(297)} und /w/wt/demo/karte-7/${'q'.repeat(280)}.js` },
];

module.exports = { T14, T14O, LANG, T14_KENNUNG, T14O_KENNUNG, KOPF, EDIT_PFAD, ERGEBNIS_5, ERGEBNIS_9, BEFEHL_8, NACHRICHT_16 };
