/* kanbanD — nur die neueste Antwort wird übernommen (R00110, ADR-0014): reine Prüfung, im Browser und in Node nutzbar. */
(function (ziel) {
  "use strict";

  /**
   * Wahr, wenn eine Antwort, deren Laden mit der Nummer `start` begann, übernommen werden darf: sie ist neuer als die zuletzt
   * übernommene (`zuletzt`), neuer als die Marke der Warteschlange (`marke`) und keine Änderung wartet noch (`schlangeOffen`).
   */
  function uebernehmen({ start, zuletzt, marke, schlangeOffen }) {
    return schlangeOffen === 0 && start > zuletzt && start > marke;
  }

  Object.assign(ziel, { uebernehmen });
})(typeof module !== 'undefined' ? module.exports : window);
