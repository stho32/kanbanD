/* kanbanD — Eingaben auswerten: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  /** Eingefügter Text → ein Titel je nicht leerer Zeile, ohne Listenzeichen. */
  function zeilenAusText(text) {
    return (text || '').split(/\r?\n/)
      .map(z => z.trim().replace(/^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').trim())
      .filter(Boolean);
  }

  Object.assign(ziel, { zeilenAusText });
})(typeof module !== 'undefined' ? module.exports : window);
