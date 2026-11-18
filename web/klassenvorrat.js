/* kanbanD — Klassenvorrat (R00195, ADR-0031 Regel 2 und 3): reine Funktionen, im Browser und in Node nutzbar.
   Die eine Stelle in web/, die für Karten auf `einstellungen.klassen` (die Vorgabe des Ordners) zugreift. */
(function (ziel) {
  "use strict";

  /** Die Vorgabe des Ordners: `classes` aus kanbanD.md; bei defekter Datei keine. */
  function vorgabeDesOrdners(einstellungen) {
    return (einstellungen && einstellungen.klassen) || [];
  }

  /** Der Klassenvorrat eines Boards: sein eigener Satz, sonst die Vorgabe des Ordners — ganz oder gar nicht. */
  function klassenvorrat(board, einstellungen) {
    if (board && Array.isArray(board.klassen)) return board.klassen;
    return vorgabeDesOrdners(einstellungen);
  }

  Object.assign(ziel, { vorgabeDesOrdners, klassenvorrat });
})((typeof module !== 'undefined' && module.exports) || window);
