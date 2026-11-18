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

  /** Je Schlüssel die Zahl der nicht archivierten Aufgaben mit Klasse aus `aufgaben`. */
  function gezaehltJeKlasse(aufgaben) {
    const zahlen = {};
    for (const a of aufgaben) {
      if (a.klasse && !a.archiviert) zahlen[a.klasse] = (zahlen[a.klasse] || 0) + 1;
    }
    return zahlen;
  }

  /** Zählregel der Hinweiszeile im Editor eines Boards (R00195): je Schlüssel die nicht archivierten Aufgaben, die auf
      diesem Board liegen. */
  function kartenJeKlasseAufBoard(board, aufgaben) {
    const aufDemBoard = new Set(board.spalten.flatMap(spalte => spalte.aufgaben));
    return gezaehltJeKlasse(aufgaben.filter(a => aufDemBoard.has(a.nummer)));
  }

  /** Zählregel im Editor des Ordners: je Schlüssel die nicht archivierten Aufgaben, die auf mindestens einem Board ohne
      eigene Klassen oder auf keinem Board liegen — nur für sie gilt die Vorgabe. */
  function kartenJeKlasseInDerVorgabe(boards, aufgaben) {
    const offene = (boards || []).filter(board => !board.archiviert);
    const nummernAuf = auswahl => new Set(auswahl.flatMap(board => board.spalten.flatMap(spalte => spalte.aufgaben)));
    const aufEinemBoard = nummernAuf(offene), mitVorgabe = nummernAuf(offene.filter(board => !Array.isArray(board.klassen)));
    return gezaehltJeKlasse(aufgaben.filter(a => mitVorgabe.has(a.nummer) || !aufEinemBoard.has(a.nummer)));
  }

  /** Die Hinweiszeile an einer gestrichenen Klasse (Wortlaut der Zeichnung D0002 #klassen-hinweiszeile); ohne Karte keine. */
  function hinweisGestrichen(karten) {
    if (!karten) return '';
    if (karten === 1) return '1 Karte zeigt die Klasse danach als Text ohne Farbe.';
    return `${karten} Karten zeigen die Klasse danach als Text ohne Farbe.`;
  }

  /** Rückkehr eines Boards zur Vorgabe (R00195 AK 10): die nicht archivierten Aufgaben dieses Boards, deren Schlüssel der
      eigene Satz kennt und die Vorgabe nicht — sie werden fremd. `schluessel` in der Reihenfolge des eigenen Satzes. */
  function fremdNachRueckkehr(board, einstellungen, aufgaben) {
    if (!Array.isArray(board.klassen)) return { karten: 0, schluessel: [] };
    const vorgabe = vorgabeDesOrdners(einstellungen).map(k => k.schluessel);
    const jeKlasse = kartenJeKlasseAufBoard(board, aufgaben);
    const schluessel = board.klassen.map(k => k.schluessel).filter(k => jeKlasse[k] && !vorgabe.includes(k));
    return { karten: schluessel.reduce((summe, k) => summe + jeKlasse[k], 0), schluessel };
  }

  /** Die Zeile unter „Vorgabe des Ordners“, wenn das Board einen gespeicherten eigenen Satz hat (Wortlaut der Zeichnung). */
  function hinweisRueckkehr(eigeneKlassen, betroffen) {
    if (!eigeneKlassen) return '';
    const entfernt = eigeneKlassen === 1 ? '1 eigene Klasse dieses Boards wird entfernt.' : `${eigeneKlassen} eigene Klassen dieses Boards werden entfernt.`;
    if (!betroffen.karten) return entfernt;
    const karten = betroffen.karten === 1 ? '1 Karte zeigt' : `${betroffen.karten} Karten zeigen`;
    return `${entfernt} ${karten} ihre Klasse danach als Text ohne Farbe: ${betroffen.schluessel.join(', ')}.`;
  }

  Object.assign(ziel, { vorgabeDesOrdners, klassenvorrat, erstesBoardJeAufgabe, klassenvorratDerAufgabe, kartenJeKlasseAufBoard, kartenJeKlasseInDerVorgabe, hinweisGestrichen, fremdNachRueckkehr, hinweisRueckkehr });
})((typeof module !== 'undefined' && module.exports) || window);
