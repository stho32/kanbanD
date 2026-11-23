// Lauf T17 aus R00251 „Ausgangslage“ (Datum 2026-11-22): sechs `git commit` mit `-q`, davon zwei in einem Aufruf (Heredoc und `-m`),
// zwei mit gleichem Titel in getrennten Fenstern, einer nicht an der Karte mit Belegzeile, `--amend` und ein Hook-Abbruch. Dazu die
// Commits C1–C6 mit ihrem Autordatum. Alle Inhalte erfunden. Geteilt von den Node-Tests und der E2E-Spec.
'use strict';

const um = uhr => `2026-11-22T${uhr}+01:00`;
const json = o => JSON.stringify(o);

const T17_KENNUNG = 'entwickler@2026-11-22T11:00+01:00';

const BEFEHL_6 = `git commit -q -F - <<'EOF'\n[R00999] B0002: Zähler zeichnen\nEOF\ngit commit -q -m "[R00999] B0003: Grenze prüfen"`;

/** Die Einträge von T17 in der Reihenfolge der Tabelle (Nr = Index + 1), alle Aufrufe `Bash` mit `command` im JSON. */
const OHNE_KENNUNG = [
  { zeit: um('11:00:00'), art: 'nachricht', wer: 'mensch', text: 'Projekt: /w/demo' },
  { zeit: um('11:00:10.400'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'git add -A && git commit -q -m "[R00999] B0001: Zähler zuerst"', description: 'Commit B0001' }) },
  { zeit: um('11:00:12.900'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '' },
  { zeit: um('11:00:20'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'cargo test -q', description: 'Tests' }) },
  { zeit: um('11:00:29'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'test result: ok' },
  { zeit: um('11:00:30.200'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: BEFEHL_6, description: 'Zwei Commits' }) },
  { zeit: um('11:00:31.600'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '' },
  { zeit: um('11:00:40'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'git commit -q -m "[DOC] Anforderung angelegt" && git log --oneline -1', description: 'Anforderung' }) },
  { zeit: um('11:00:41'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'e5f6a7b [DOC] Anforderung angelegt' },
  { zeit: um('11:00:50'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'git commit -q --amend --no-edit', description: 'Nachbessern' }) },
  { zeit: um('11:00:51'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '' },
  { zeit: um('11:01:04.500'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'git commit -q -m "[R00999] B0004: Nacharbeit"', description: 'Nacharbeit 1' }) },
  { zeit: um('11:01:05.300'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '' },
  { zeit: um('11:01:39.800'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'git commit -q -m "[R00999] B0004: Nacharbeit"', description: 'Nacharbeit 2' }) },
  { zeit: um('11:01:40.200'), art: 'werkzeugergebnis', wer: 'werkzeug', text: '' },
  { zeit: um('11:01:50'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: json({ command: 'git commit -m "[R00999] B0005: Hook bricht ab"', description: 'Hook' }) },
  { zeit: um('11:01:52'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Exit code 1\npre-commit hook exited with code 1' },
  { zeit: um('11:02:00'), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' },
];
const T17 = OHNE_KENNUNG.map((e, i) => {
  if (e.art === 'werkzeugaufruf') return { ...e, id: `t17-${i + 1}` };
  if (e.art === 'werkzeugergebnis') return { ...e, zu: `t17-${i}` };
  return e;
});

/** Die Commits der Ausgangslage: Name, Titel, Autordatum (ISO und Epoch-Sekunden), an Aufgabe #1. */
const T17_COMMITS = [
  { name: 'C1', titel: '[R00999] B0001: Zähler zuerst', datum: um('11:00:13'), anDerKarte: true },
  { name: 'C2', titel: '[R00999] B0002: Zähler zeichnen', datum: um('11:00:31'), anDerKarte: true },
  { name: 'C3', titel: '[R00999] B0003: Grenze prüfen', datum: um('11:00:31'), anDerKarte: true },
  { name: 'C4', titel: '[DOC] Anforderung angelegt', datum: um('11:00:40'), anDerKarte: false },
  { name: 'C5a', titel: '[R00999] B0004: Nacharbeit', datum: um('11:01:05'), anDerKarte: true },
  { name: 'C5b', titel: '[R00999] B0004: Nacharbeit', datum: um('11:01:39'), anDerKarte: true },
  { name: 'C6', titel: '[R00999] B0006: von Hand', datum: um('11:00:45'), anDerKarte: true },
].map(c => ({ ...c, autordatum: Date.parse(c.datum) / 1000 }));

module.exports = { T17, T17_KENNUNG, T17_COMMITS };
