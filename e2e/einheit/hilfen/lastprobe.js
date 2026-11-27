// Lastproben der Einheitentests (R00261, ADR-0026 N5/N6, Regel 12): ein Zeitmaß in ms urteilt nicht im Gate,
// sondern läuft nur ausdrücklich (KD_LASTPROBE=1) und nur bei ruhiger Maschine (1-Minuten-Last < 2 aus
// /proc/loadavg); im Gate erscheinen diese Fälle als `skipped`. Vorbilder: e2e/tests/r00249-review-nebeneinander.spec.js
// (R00256) und tests/lastprobe_r00206.rs. Die Ausgabe nennt Last und Werte; bei Last >= 2 steht „keine Messung“
// statt eines stillen Grüns. Der Grund des Überspringens steht in `SPRUNG`, die Meldung in `messung`.
const fs = require('node:fs');

/** Ab dieser 1-Minuten-Last wird nicht gemessen (ruhige Maschine: unter 2). */
const LAST_GRENZE = 2;
/** Der Grund, aus dem die Zeitfälle im Gate übersprungen werden. */
const SPRUNG = { skip: !process.env.KD_LASTPROBE && 'Lastprobe: nur ausdrücklich (KD_LASTPROBE=1), Last < 2' };

/** Die 1-Minuten-Last der Maschine aus `/proc/loadavg`. */
function last() {
  return Number(fs.readFileSync('/proc/loadavg', 'utf8').split(/\s+/)[0]);
}

/** `true`, wenn die Maschine ruhig genug für ein Zeiturteil ist (Last < 2). */
function ruhig() {
  return last() < LAST_GRENZE;
}

/**
 * Meldet die Messwerte eines Falls mit der Last in die Ausgabe. Bei Last >= 2 steht „keine Messung: Last < 2 nötig“
 * und der Aufrufer bricht ab, statt die Werte als bestanden zu werten. Liefert `true`, wenn gemessen werden darf.
 */
function messung(name, text) {
  const jetzt = last();
  if (jetzt >= LAST_GRENZE) {
    console.log(`${name}: keine Messung: Last < 2 nötig (Last ${jetzt.toFixed(2)})`);
    return false;
  }
  console.log(`${name}: Last ${jetzt.toFixed(2)} | ${text}`);
  if (process.env.KD_MESS_AUS) fs.appendFileSync(process.env.KD_MESS_AUS, JSON.stringify({ name, last: jetzt, text }) + '\n');
  return true;
}

module.exports = { last, ruhig, messung, SPRUNG };
