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

  /** Je Aufgabennummer das erste offene Board in der Reihenfolge der Boardliste, auf dem sie liegt. */
  function erstesBoardJeAufgabe(boards) {
    const erstes = new Map();
    for (const board of boards || []) {
      if (board.archiviert) continue;
      for (const spalte of board.spalten) {
        for (const nummer of spalte.aufgaben) if (!erstes.has(nummer)) erstes.set(nummer, board);
      }
    }
    return erstes;
  }

  /** Außerhalb eines Boards (ADR-0031 Regel 3): der Vorrat des ersten Boards der Aufgabe; liegt sie auf keinem, die Vorgabe. */
  function klassenvorratDerAufgabe(nummer, boards, einstellungen) {
    return klassenvorrat(erstesBoardJeAufgabe(boards).get(nummer) || null, einstellungen);
  }

  Object.assign(ziel, { vorgabeDesOrdners, klassenvorrat, erstesBoardJeAufgabe, klassenvorratDerAufgabe });
})((typeof module !== 'undefined' && module.exports) || window);
