// Sichtzustand, der das Neuzeichnen übersteht (R00103, ADR-0007): die Schlüsselregel.
// Ein Element wird nach dem Neuzeichnen über einen stabilen Schlüssel wiedergefunden.
// Rein: das Element kommt als { id, daten, klassen }, der Bereich als Zählfunktion je Selektor.
(function (ziel) {
  const FELDSCHLUESSEL = ['af', 'nf', 'wf', 'wn', 'tf'];
  const EINFACHE_KLASSE = /^[A-Za-z_][\w-]*$/;

  /** Attributwert für einen Selektor in Anführungszeichen. */
  function zitiert(wert) {
    const ersetzt = String(wert).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ');
    return `"${ersetzt}"`;
  }

  /** Die Kandidaten in Vorrangfolge: id, data-halt, Feldschlüssel, Aktion, Klassen. */
  function kandidaten(element) {
    const daten = element.daten || {};
    const liste = [];
    if (element.id) liste.push(`[id=${zitiert(element.id)}]`);
    if (daten.halt) liste.push(`[data-halt=${zitiert(daten.halt)}]`);
    const feld = FELDSCHLUESSEL.find(name => daten[name]);
    if (feld) liste.push(`[data-${feld}=${zitiert(daten[feld])}]`);
    if (daten.act && daten.arg !== undefined) liste.push(`[data-act=${zitiert(daten.act)}][data-arg=${zitiert(daten.arg)}]`);
    else if (daten.act) liste.push(`[data-act=${zitiert(daten.act)}]`);
    const einfacheKlassen = (element.klassen || []).filter(klasse => EINFACHE_KLASSE.test(klasse));
    for (const klasse of einfacheKlassen) liste.push(`.${klasse}`);
    return liste;
  }

  /** Erster Kandidat, der im Bereich genau einmal vorkommt; ohne eindeutigen Schlüssel ''. */
  function schluessel(element, anzahlImBereich) {
    const eindeutig = kandidaten(element).find(selektor => anzahlImBereich(selektor) === 1);
    if (eindeutig === undefined) return '';
    return eindeutig;
  }

  Object.assign(ziel, { schluessel });
})(typeof module !== 'undefined' ? module.exports : window);
