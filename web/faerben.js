/* kanbanD — Syntaxfarben der Review-Seite (R00217, ADR-0040): Prism läuft nur hier, im Dedicated Worker, nie auf der Seite.
   Als Worker antwortet die Datei je Auftrag nur mit Zahlen; unter Node exportiert sie die reinen Funktionen für die Unit-Tests. */
(function () {
  'use strict';
  const imWorker = typeof module === 'undefined' && typeof importScripts === 'function';

  /** Prism im Worker: der eingebaute Nachrichten-Hörer von Prism (JSON rein, `highlight`-HTML raus) wird vor dem Laden abgeschaltet. */
  function prismLaden() {
    if (!imWorker) return require('./vendor/prism.js');
    self.Prism = { disableWorkerMessageHandler: true };
    try {
      importScripts('/web/vendor/prism.js');
      return self.Prism;
    } catch (_) {
      // Ladefehler: der Worker antwortet auf jeden Auftrag mit `fehler`, die Datei bleibt ohne Farbe (ADR-0040 Punkt 4)
      return null;
    }
  }

  const prism = prismLaden();

  if (!imWorker) module.exports = { prism };
})();
