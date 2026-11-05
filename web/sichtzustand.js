// Sichtzustand, der das Neuzeichnen übersteht (R00103, ADR-0007): die Schlüsselregel.
// Ein Element wird nach dem Neuzeichnen über einen stabilen Schlüssel wiedergefunden.
// Die Schlüsselregel ist rein: das Element kommt als { id, daten, klassen }, der Bereich als Zählfunktion je Selektor.
// Sichern und Zurücksetzen arbeiten auf dem DOM eines Bereichs, dessen Inhalt neu gezeichnet wird.
(function (ziel) {
  const FELDSCHLUESSEL = ['af', 'nf', 'wf', 'wn', 'tf'];
  const EINFACHE_KLASSE = /^[A-Za-z_][\w-]*$/;
  // Felder, deren getippter Wert zurückgesetzt und noch nicht per „change“ gemeldet ist. Der Browser misst „geändert“
  // ab dem Fokussieren — nach dem Zurücksetzen meldet er beim Verlassen ohne Weitertippen deshalb nichts.
  const ungemeldet = new WeakSet();

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

  /** Schlüssel eines DOM-Elements in seinem Bereich. */
  function schluesselIm(element, bereich) {
    const beschreibung = { id: element.id, daten: { ...element.dataset }, klassen: [...element.classList] };
    return schluessel(beschreibung, selektor => bereich.querySelectorAll(selektor).length);
  }

  /** Das eine Element zum Schlüssel; mehrdeutig oder fehlend: null. */
  function wiedergefunden(bereich, selektor) {
    const treffer = bereich.querySelectorAll(selektor);
    if (treffer.length !== 1) return null;
    return treffer[0];
  }

  /** Rollstände aller gescrollten Flächen im Bereich, je mit Schlüssel; Flächen ohne Schlüssel fallen weg. */
  function rollstaende(bereich) {
    const gerollt = [...bereich.querySelectorAll('*')].filter(element => element.scrollTop || element.scrollLeft);
    return gerollt
      .map(element => ({ bereich, schluessel: schluesselIm(element, bereich), links: element.scrollLeft, oben: element.scrollTop }))
      .filter(stand => stand.schluessel);
  }

  /** Setzt die Rollstände auf die nach dem Neuzeichnen wiedergefundenen Flächen. */
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

  /** Geändert heißt: der Wert weicht vom zuletzt gezeichneten ab. Schalter speichern sofort und gelten nie als geändert. */
  function geaendert(feld) {
    if (SCHALTER.test(feld.type)) return false;
    return feld.value !== gezeichneterWert(feld);
  }

  /** Das fokussierte Eingabefeld in einem der Bereiche: Schlüssel, Wert, ob geändert, Auswahl; sonst null. */
  function eingabestand(aktiv, bereiche) {
    if (!aktiv || !EINGABEFELD.test(aktiv.tagName)) return null;
    const bereich = bereiche.find(kandidat => kandidat && kandidat.contains(aktiv));
    if (!bereich) return null;
    const schluesselDesFelds = schluesselIm(aktiv, bereich);
    if (!schluesselDesFelds) return null;
    return { bereich, schluessel: schluesselDesFelds, wert: aktiv.value, geaendert: geaendert(aktiv), von: auswahlGrenze(aktiv, 'selectionStart'), bis: auswahlGrenze(aktiv, 'selectionEnd') };
  }

  /** Cursor- oder Auswahlgrenze; Felder ohne Textauswahl (Datum, Auswahlliste) haben keine. */
  function auswahlGrenze(feld, name) {
    try { return feld[name]; } catch (_) { return null; }
  }

  /** Nach dem Neuzeichnen: Wert nur bei geändertem Feld, dann Fokus ohne Scrollen, dann Auswahl. Wahr, wenn das Feld wiedergefunden ist. */
  function eingabeSetzen(stand) {
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

  Object.assign(ziel, { schluessel, rollstaende, rollstaendeSetzen, eingabestand, eingabeSetzen, aenderungGemeldet, aenderungNachtragen });
})(typeof module !== 'undefined' ? module.exports : window);
