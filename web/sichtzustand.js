// Sichtzustand, der das Neuzeichnen übersteht (R00103, ADR-0007): die Schlüsselregel.
// Ein Element wird nach dem Neuzeichnen über einen stabilen Schlüssel wiedergefunden.
// Die Schlüsselregel ist rein: Das Element kommt als { id, daten, klassen, href }, der Bereich als Zählfunktion je Selektor.
// Sichern und Zurücksetzen arbeiten auf dem DOM eines Bereichs, dessen Inhalt neu gezeichnet wird.
(function (ziel) {
  // Aufgabe, Neu, Wirkung, WBS-Knoten, Termin, Fieber-Chart, Berichtsfilter, Durchlaufzeit, Einrichtung, Spalten, Erststart
  const FELDSCHLUESSEL = ['af', 'nf', 'wf', 'wn', 'tf', 'fb', 'bf', 'dl', 'ef', 'sf', 'fr'];
  const EINFACHE_KLASSE = /^[A-Za-z_][\w-]*$/;
  // Entfernende Aktionen (teil-weg, herkunft-weg, zeit-weg, anhang-weg …): eine Stelle ist kein Schlüssel (ADR-0007 N3 Regel 4).
  const ZERSTOERENDE_AKTION = /-weg$/;
  // Felder, deren getippter Wert zurückgesetzt und noch nicht per „change“ gemeldet ist. Der Browser misst „geändert“
  // ab dem Fokussieren — nach dem Zurücksetzen meldet er beim Verlassen ohne Weitertippen deshalb nichts.
  const ungemeldet = new WeakSet();

  /** Attributwert für einen Selektor in Anführungszeichen. */
  function zitiert(wert) {
    const ersetzt = String(wert).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\a ');
    return `"${ersetzt}"`;
  }

  /** Die Kandidaten in Vorrangfolge: id, data-halt, Feldschlüssel (samt Zeile), Aktion, Linkziel, Klassen. */
  function kandidaten(element) {
    const daten = element.daten || {};
    const liste = [];
    if (element.id) liste.push(`[id=${zitiert(element.id)}]`);
    if (daten.halt) liste.push(`[data-halt=${zitiert(daten.halt)}]`);
    // Zerstörender Knopf mit inhaltsbezogenem data-halt: ist er im Bereich nicht eindeutig, hält der Sicherer nichts,
    // statt auf data-act+data-arg (die Stelle) oder eine Klasse auszuweichen — sonst träfe der nächste Tastendruck ein
    // fremdes ✕ (R00138, ADR-0007 N3 Regel 4).
    if (daten.halt && ZERSTOERENDE_AKTION.test(daten.act || '')) return liste;
    const feld = FELDSCHLUESSEL.find(name => daten[name]);
    // In Listen (Spalten, Personen, Klassen) steht dasselbe Feld je Zeile; data-i nennt die Zeile
    const zeile = daten.i !== undefined ? `[data-i=${zitiert(daten.i)}]` : '';
    if (feld) liste.push(`[data-${feld}=${zitiert(daten[feld])}]${zeile}`);
    if (daten.act && daten.arg !== undefined) liste.push(`[data-act=${zitiert(daten.act)}][data-arg=${zitiert(daten.arg)}]`);
    else if (daten.act) liste.push(`[data-act=${zitiert(daten.act)}]`);
    if (element.href) liste.push(`[href=${zitiert(element.href)}]`);
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

  /** Schlüssel eines DOM-Elements in seinem Bereich. */
  function schluesselIm(element, bereich) {
    const beschreibung = { id: element.id, daten: { ...element.dataset }, klassen: [...element.classList], href: element.getAttribute('href') };
    return schluessel(beschreibung, selektor => bereich.querySelectorAll(selektor).length);
  }

  /** Das eine Element zum Schlüssel; mehrdeutig oder fehlend: null. */
  function wiedergefunden(bereich, selektor) {
    const treffer = bereich.querySelectorAll(selektor);
    if (treffer.length !== 1) return null;
    return treffer[0];
  }

  /** Scrollstände aller gescrollten Flächen im Bereich, je mit Schlüssel; Flächen ohne Schlüssel fallen weg. */
  function rollstaende(bereich) {
    const gerollt = [...bereich.querySelectorAll('*')].filter(element => element.scrollTop || element.scrollLeft);
    return gerollt
      .map(element => ({ bereich, schluessel: schluesselIm(element, bereich), links: element.scrollLeft, oben: element.scrollTop }))
      .filter(stand => stand.schluessel);
  }

  /** Setzt die Scrollstände auf die nach dem Neuzeichnen wiedergefundenen Flächen. */
  function rollstaendeSetzen(staende) {
    for (const stand of staende) {
      const flaeche = wiedergefunden(stand.bereich, stand.schluessel);
      if (!flaeche) continue;
      flaeche.scrollLeft = stand.links;
      flaeche.scrollTop = stand.oben;
    }
  }

  const EINGABEFELD = /^(INPUT|TEXTAREA|SELECT)$/;
  const SCHALTER = /^(checkbox|radio)$/;

  /** Der zuletzt gezeichnete Wert eines Felds: Wertattribut, Textinhalt oder die als ausgewählt gezeichnete Option. */
  function gezeichneterWert(feld) {
    if (feld.tagName !== 'SELECT') return feld.defaultValue;
    const optionen = [...feld.options];
    const gezeichnet = optionen.find(option => option.defaultSelected) || optionen[0];
    if (!gezeichnet) return '';
    return gezeichnet.value;
  }

  /** Geändert heißt: Der Wert weicht vom zuletzt gezeichneten ab. Schalter speichern sofort und gelten nie als geändert. */
  function geaendert(feld) {
    if (SCHALTER.test(feld.type)) return false;
    return feld.value !== gezeichneterWert(feld);
  }

  /** Das fokussierte Element in einem der Bereiche: Schlüssel und — nur bei Eingabefeldern — Wert, ob geändert, Auswahl; sonst null. */
  function fokusstand(aktiv, bereiche) {
    if (!aktiv) return null;
    const bereich = bereiche.find(kandidat => kandidat && kandidat.contains(aktiv));
    if (!bereich) return null;
    const schluesselDesElements = schluesselIm(aktiv, bereich);
    if (!schluesselDesElements) return null;
    const stand = { bereich, schluessel: schluesselDesElements, wert: null, geaendert: false, von: null, bis: null };
    if (!EINGABEFELD.test(aktiv.tagName)) return stand;
    return { ...stand, wert: aktiv.value, geaendert: geaendert(aktiv), von: auswahlGrenze(aktiv, 'selectionStart'), bis: auswahlGrenze(aktiv, 'selectionEnd') };
  }

  /** Cursor- oder Auswahlgrenze; Felder ohne Textauswahl (Datum, Auswahlliste) haben keine. */
  function auswahlGrenze(feld, name) {
    try { return feld[name]; } catch (_) { return null; }
  }

  /** Nach dem Neuzeichnen: Wert nur bei geändertem Feld, dann Fokus ohne Scrollen, dann Auswahl. Wahr, wenn das Element wiedergefunden ist. */
  function fokusSetzen(stand) {
    const feld = wiedergefunden(stand.bereich, stand.schluessel);
    if (!feld) return false;
    if (stand.geaendert) {
      feld.value = stand.wert;
      ungemeldet.add(feld);
    }
    feld.focus({ preventScroll: true });
    if (typeof stand.von === 'number' && typeof stand.bis === 'number') {
      try { feld.setSelectionRange(stand.von, stand.bis); } catch (_) { /* Feldtyp ohne Textauswahl */ }
    }
    return true;
  }

  /** Ein „change“ des Felds ist angekommen: nichts mehr nachzutragen. */
  function aenderungGemeldet(feld) {
    ungemeldet.delete(feld);
  }

  /** Beim Verlassen: ein zurückgesetzter, noch abweichender Wert wird als „change“ nachgetragen — genau einmal. */
  function aenderungNachtragen(feld) {
    if (!ungemeldet.has(feld)) return;
    ungemeldet.delete(feld);
    if (geaendert(feld)) feld.dispatchEvent(new Event('change', { bubbles: true }));
  }

  Object.assign(ziel, { schluessel, rollstaende, rollstaendeSetzen, fokusstand, fokusSetzen, aenderungGemeldet, aenderungNachtragen });
})(typeof module !== 'undefined' ? module.exports : window);
