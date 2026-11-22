// Lauf T13 und T13f aus R00240 „Ausgangslage“ (Datum 2026-11-21 statt 2026-11-23: der Server lehnt Zeitpunkte in der Zukunft ab): 17 Einträge mit Shell-Block, Kürzung, `<persisted-output>`, Diff, eingebetteten
// Systemhinweisen und JSON-Ergebnis; T13f mit einem Fehler und einem eingebetteten Hinweis. Alle Inhalte erfunden. Geteilt von den
// Node-Tests und der E2E-Spec.
'use strict';

const um = uhr => `2026-11-21T${uhr}+01:00`;
const json = o => JSON.stringify(o);
const zeilenVon = (anzahl, wort) => Array.from({ length: anzahl }, (_, i) => `${wort}${i + 1}`);

const T13_KENNUNG = 'entwickler@2026-11-21T09:00+01:00';
const T13F_KENNUNG = 'entwickler@2026-11-21T10:00+01:00';

const BEFEHL_2 = 'cd /w/demo && npm test; echo "a && b" | grep \'x;y\' # Ende; z';
const BEFEHL_4 = `echo ${'a'.repeat(250)} && cat gross.log`;
const BEFEHL_15 = ['cat <<EOF > c.txt', ...zeilenVon(19, 'l'), 'EOF'].join('\n');
const ERGEBNIS_3 = [...zeilenVon(23, 'Zeile '), '1 failed, 3 passed', 'Ende'].join('\n');
const ERGEBNIS_5 = ['<persisted-output>', 'Output too large (69.9KB). Full output saved to: /tmp/demo/tool-results/b1.txt', '', 'Preview (first 2KB):',
  'Exit code 1', 'fehlt: gross.log', '...', '</persisted-output>'].join('\n');
const INHALT_8 = zeilenVon(25, 'b').join('\n');

/** Die Einträge von T13 in der Reihenfolge der Tabelle (Nr = Index + 1). */
const T13 = [
  { zeit: um('09:00:00'), art: 'nachricht', wer: 'mensch', text: 'Projekt: /w/demo · Karte: #9' },
  { zeit: um('09:00:01'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_2, description: 'Tests fahren', timeout: 120000 }) },
  { zeit: um('09:00:41'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_3 },
  { zeit: um('09:00:42'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_4, description: 'Protokoll lesen' }) },
  { zeit: um('09:01:12'), art: 'werkzeugergebnis', wer: 'werkzeug', text: ERGEBNIS_5 },
  { zeit: um('09:01:13'), art: 'werkzeugaufruf', wer: 'agent', name: 'Edit', text: json({ file_path: '/w/demo/a.js', old_string: 'x\nalt\ny', new_string: 'x\nneu\ny' }) },
  { zeit: um('09:01:14'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Datei geändert.\n<system-reminder>\nNicht vergessen.\n</system-reminder>\nweiter' },
  { zeit: um('09:01:15'), art: 'werkzeugaufruf', wer: 'agent', name: 'Write', text: json({ file_path: '/w/demo/b.txt', content: INHALT_8 }) },
  { zeit: um('09:01:35'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Datei geschrieben.' },
  { zeit: um('09:01:36'), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: '{"file_path":"/w/demo/a.md","offset":10,"limit":2}' },
  { zeit: um('09:01:37'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '<system-reminder>\nNur Hinweis.\n</system-reminder>' },
  { zeit: um('09:01:38'), art: 'nachricht', wer: 'mensch', text: 'Bitte weiter.\n<system-reminder>\nTodo-Liste leer.\n</system-reminder>' },
  { zeit: um('09:01:39'), art: 'werkzeugaufruf', wer: 'agent', name: 'mcp__demo__abfrage', text: '{"query":"stand"}' },
  { zeit: um('09:01:40'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '{"ok":true,"n":3,"liste":[1,null],"text":"a"}' },
  { zeit: um('09:01:41'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_15, description: 'Datei anlegen' }) },
  { zeit: um('09:01:42'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' },
  { zeit: um('09:01:43'), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' },
];

/** T13f: ein Aufruf mit Fehler und ein Ergebnis mit eingebettetem Hinweis (AK 7, „nur Fehler“). */
const T13F = [
  { zeit: '2026-11-21T10:00:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'false', description: 'Fehler zeigen' }) },
  { zeit: '2026-11-21T10:00:01+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Exit code 1\n<system-reminder>\nHinweis F.\n</system-reminder>' },
];

/** Der breite Aufruf aus AK 10: Schlüssel aus 60 × `k`, Wert aus 300 Zeichen ohne Leerzeichen. */
const BREIT = [
  { zeit: um('09:01:44'), art: 'werkzeugaufruf', wer: 'agent', name: 'mcp__demo__abfrage', text: json({ ['k'.repeat(60)]: 'w'.repeat(300) }) },
  { zeit: um('09:01:45'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' },
];

module.exports = { T13, T13F, BREIT, T13_KENNUNG, T13F_KENNUNG, BEFEHL_2, BEFEHL_4, BEFEHL_15, ERGEBNIS_3, ERGEBNIS_5, INHALT_8 };
