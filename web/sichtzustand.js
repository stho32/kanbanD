// Sichtzustand, der das Neuzeichnen übersteht (R00103, ADR-0007): die Schlüsselregel.
// Ein Element wird nach dem Neuzeichnen über einen stabilen Schlüssel wiedergefunden.
// Die Schlüsselregel ist rein: Das Element kommt als { id, daten, klassen, href }, der Bereich als Zählfunktion je Selektor.
// Sichern und Zurücksetzen arbeiten auf dem DOM eines Bereichs, dessen Inhalt neu gezeichnet wird.
(function (ziel) {
  // Aufgabe, Neu, Wirkung, WBS-Knoten, Termin, Fieber-Chart, Berichtsfilter, Durchlaufzeit, Einrichtung, Spalten, Erststart
  const FELDSCHLUESSEL = ['af', 'nf', 'wf', 'wn', 'tf', 'fb', 'bf', 'dl', 'ef', 'sf', 'fr'];
  const EINFACHE_KLASSE = /^[A-Za-z_][\w-]*$/;
  // Felder, deren getippter Wert zurückgesetzt und noch nicht per „change“ gemeldet ist. Der Browser misst „geändert“
  // ab dem Fokussieren — nach dem Zurücksetzen meldet er beim Verlassen ohne Weitertippen deshalb nichts.
  const ungemeldet = new WeakSet();
  // Felder, deren „change“ der Browser gemeldet hat, das aber erst mit dem Verlassen wirken soll.
  const aufgeschoben = new WeakSet();

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
    if (daten.halt) {
      liste.push(`[data-halt=${zitiert(daten.halt)}]`);
      // Ein Element, das seinen Inhalt als Schlüssel trägt, hält nur über diesen Inhalt — nie über die Stelle
      // (data-act+data-arg, data-i), ein Linkziel oder eine Klasse. Ist der Inhalt im Bereich nicht eindeutig
      // (derselbe Text zweimal), hält der Sicherer nichts: der nächste Tastendruck träfe sonst ein fremdes Element
      // — beim ✕ einen fremden Eintrag, bei der Zeile eine fremde Teilaufgabe (R00138, R00134, ADR-0007 N3 Regel 4).
      return liste;
    }
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
    // Der Ort des Abschnitts (data-ort), an den der Fokus fällt, wenn der Schlüssel unter dem Menschen verschwindet
    const stand = { bereich, schluessel: schluesselDesElements, ort: aktiv.dataset.ort || null, wert: null, geaendert: false, von: null, bis: null };
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
    aufgeschoben.delete(feld);
  }

  /** Der Browser hat „change“ gemeldet, es hat aber noch nicht gewirkt (beim Verlassen ist das Ziel des Fokus offen): es bleibt nachzutragen. */
  function aenderungAufschieben(feld) {
    aufgeschoben.add(feld);
  }

  /** Beim Verlassen und auf Enter: ein aufgeschobenes „change“ oder ein zurückgesetzter, noch abweichender Wert wird als „change“ nachgetragen — genau einmal. Wahr, wenn nachgetragen wurde. */
  function aenderungNachtragen(feld) {
    const warAufgeschoben = aufgeschoben.delete(feld);
    const warZurueckgesetzt = ungemeldet.delete(feld);
    const nachzutragen = warAufgeschoben || (warZurueckgesetzt && geaendert(feld));
    if (nachzutragen) feld.dispatchEvent(new Event('change', { bubbles: true }));
    return nachzutragen;
  }

  /**
   * Der eine Entwurf je Aufgabenfenster (ADR-0015 N2): die abgelehnte Eingabe `{ nummer, feld, wert }` — reiner Sichtzustand,
   * nie Datei. Liefert die Eingabe, wenn der Entwurf dieses Feld dieser Aufgabe nennt, sonst null; leer ist auch eine Eingabe.
   */
  function entwurfswert(entwurf, nummer, feld) {
    if (!entwurf || entwurf.nummer !== nummer || entwurf.feld !== feld) return null;
    return entwurf.wert;
  }

  /**
   * Der Entwurf, nachdem in `feld` getippt wurde (R00155 G-2): Getipptes hält den einen Platz, verdrängt aber nie die
   * Eingabe eines anderen Felds derselben Aufgabe — die steht dort nur, wenn sie abgelehnt wurde oder gerade geschrieben wird.
   */
  function entwurfNachTippen(entwurf, nummer, feld, wert) {
    const anderesFeldHaeltDenPlatz = Boolean(entwurf) && entwurf.nummer === nummer && entwurf.feld !== feld;
    if (anderesFeldHaeltDenPlatz) return entwurf;
    return { nummer, feld, wert };
  }

  // „Neue Herkunft“, neue Teilaufgabe, „Zeit nachtragen“: schreiben erst mit Enter
  const ENTER_FELDER = ['herkunft-neu', 'teil-neu', 'zeit-neu'];

  /**
   * Die Esc-Regel des Aufgabenfensters (ADR-0010 N9 Ziffer 4): was das fokussierte Feld zu verwerfen hat. Das Feld kommt als
   * `{ af, id, wert, gezeichnet, imModus, haeltEntwurf }`. Liefert den Stand, auf den der Wert zurückgeht, ob der
   * Bearbeitungsmodus endet und ob das Feld einen Entwurf hat (ein unveränderter Titel im Bearbeiten hat keinen: Esc
   * verlässt den Modus, der Knopf „Eingabe verwerfen“ tut nichts) — oder null: nichts zu verwerfen, Esc schließt das Fenster.
   */
  function verwerfung(feld) {
    // Titel und Beschreibung mit Text haben einen Lesezustand; die leere Beschreibung steht immer als Feld da
    const hatLesezustand = feld.af === 'titel' || (feld.af === 'beschreibung' && feld.gezeichnet !== '');
    if (hatLesezustand && feld.imModus) return { wert: feld.gezeichnet, verlaesstModus: true, hatEntwurf: feld.wert !== feld.gezeichnet || feld.haeltEntwurf };
    const schreibtAufEnter = ENTER_FELDER.includes(feld.id);
    const schreibtBeimVerlassen = feld.af === 'labels' || feld.af === 'beschreibung';
    if (!schreibtBeimVerlassen && !schreibtAufEnter) return null;
    // der Stand eines Enter-Felds ist leer, auch wenn die abgelehnte Eingabe darin gezeichnet ist
    let stand = feld.gezeichnet;
    if (schreibtAufEnter) stand = '';
    if (feld.wert === stand && !feld.haeltEntwurf) return null;
    return { wert: stand, verlaesstModus: false, hatEntwurf: true };
  }

  /** Das Feld der abgelehnten Eingabe des Fensters: der eine Entwurf der offenen Aufgabe, solange die Meldung sein Feld nennt; sonst null. */
  function abgelehntesFeld(entwurf, meldung, nummer) {
    if (!entwurf || entwurf.nummer !== nummer) return null;
    if (!meldung.text || meldung.feld !== entwurf.feld) return null;
    return entwurf.feld;
  }

  /** Attribute, mit denen ein Feld als ungültig auf die Fenstermeldung verweist — nur solange die Meldung dieses Feld nennt und der Entwurf zu ihm gehört. */
  function meldungsverweis(entwurf, meldung, nummer, feld, meldungsId) {
    const feldIstAbgelehnt = Boolean(meldung.text) && meldung.feld === feld && entwurfswert(entwurf, nummer, feld) !== null;
    if (!feldIstAbgelehnt) return '';
    return ` aria-invalid="true" aria-describedby="${meldungsId}"`;
  }

  Object.assign(ziel, { schluessel, rollstaende, rollstaendeSetzen, fokusstand, fokusSetzen, aenderungGemeldet, aenderungAufschieben, aenderungNachtragen, entwurfswert, entwurfNachTippen, verwerfung, abgelehntesFeld, meldungsverweis });
})(typeof module !== 'undefined' ? module.exports : window);
