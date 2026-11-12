/* kanbanD — Preisetikett (R00105, ADR-0009): geschätzte API-Kosten in ganzen Cent rechnen; rein, im Browser und in Node nutzbar.
   Jeder Geldwert aus GET (Dollar als JSON-Zahl) wird genau einmal hier in Cent gewandelt; formatiert wird erst beim Anzeigen. */
(function (ziel) {
  const inCent = dollar => Math.round(dollar * 100);

  /** Grenzen eines Werts {amount} oder {min, max} in Cent; ein Betrag zählt als min = max. */
  function grenzenInCent(wert) {
    if (wert.amount != null) return { min: inCent(wert.amount), max: inCent(wert.amount) };
    return { min: inCent(wert.min), max: inCent(wert.max) };
  }

  /** cost aus GET → {waehrung, min, max, mitte, basis, positionen: [{text, tokens, min, max}]} in Cent; Gesamt aus
      Positionen als Summe der Unter- bzw. Obergrenzen, Mitte kaufmännisch gerundet. */
  function kostenInCent(cost) {
    const positionen = (cost.items || []).map(p => ({ text: p.text, tokens: p.tokens ?? null, ...grenzenInCent(p) }));
    const gesamt = positionen.length
      ? { min: positionen.reduce((s, p) => s + p.min, 0), max: positionen.reduce((s, p) => s + p.max, 0) }
      : grenzenInCent(cost);
    return { waehrung: cost.currency, ...gesamt, mitte: Math.floor((gesamt.min + gesamt.max + 1) / 2), basis: cost.basis ?? null, positionen };
  }

  /** Cent als Text der Währung: „1,63 $“, „25,55 €“, „2,00 CHF“ — immer zwei Nachkommastellen. */
  function geld(cent, waehrung) {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: waehrung, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);
  }

  const zahl = cent => new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cent / 100);

  /** Grenzen als Text mit einem Währungszeichen am Ende: „0,60–1,60 $“, bei gleichen Grenzen ein Betrag „1,63 $“. */
  function spanne(min, max, waehrung, zwischen) {
    if (min === max) return geld(max, waehrung);
    return `${zahl(min)}${zwischen}${geld(max, waehrung)}`;
  }

  /** Kosten in Cent → Texte des Preisetiketts der Karte: sichtbar die Mitte, Hinweis und zugänglicher Name mit den Grenzen. */
  function preisetikett(k) {
    return {
      sichtbar: `≈ ${geld(k.mitte, k.waehrung)}`,
      hinweis: `${spanne(k.min, k.max, k.waehrung, '–')} · geschätzte API-Kosten`,
      name: `Preisetikett: geschätzt ${spanne(k.min, k.max, k.waehrung, ' bis ')}, API-Kosten`,
    };
  }

  /** Kosten in Cent → Zeilen des Reiters „Kosten“: Positionen in Dateireihenfolge mit Summenzeile, ohne Positionen eine
      Zeile „Gesamt“ ohne Summe; die Spalte Tokens nur, wenn eine Position Tokens trägt. Beträge bleiben Cent. */
  function kostentabelle(k) {
    const zeilen = k.positionen.length
      ? k.positionen.map(p => ({ text: p.text, tokens: p.tokens, niedrig: p.min, hoch: p.max }))
      : [{ text: 'Gesamt', tokens: null, niedrig: k.min, hoch: k.max }];
    const mitTokens = zeilen.filter(z => z.tokens != null);
    const summe = k.positionen.length
      ? { tokens: mitTokens.length ? mitTokens.reduce((s, z) => s + z.tokens, 0) : null, niedrig: k.min, hoch: k.max }
      : null;
    return { beschriftung: `Geschätzte API-Kosten (${k.waehrung})`, spalteTokens: mitTokens.length > 0, zeilen, summe, basis: k.basis };
  }

  /** Reihenfolge der Währungszeilen: USD zuerst, dann alphabetisch nach ISO-Code. */
  const waehrungVor = (a, b) => (a === 'USD' ? -1 : b === 'USD' ? 1 : a.localeCompare(b));

  /** Board (Spalten samt archivierter Aufgaben) + Aufgaben + Filter der Berichte → {m, jeWaehrung: [{waehrung, n, niedrig, hoch}]}
      in Cent. m zählt alle passenden Aufgaben in den Spalten, n und Summen die davon mit Etikett; der Filter wirkt über
      Spalten, Klasse, Zuständige und Labels wie in den übrigen Berichten. */
  function kostenbericht(board, aufgaben, f) {
    const { aufgabePasst } = typeof module !== 'undefined' ? require('./berichte.js') : window;
    const nachNummer = new Map(aufgaben.map(a => [a.nummer, a]));
    const gezaehlt = board.spalten.filter(sp => !f.ohneSpalten.includes(sp.name))
      .flatMap(sp => sp.aufgaben.map(nr => nachNummer.get(nr)))
      .filter(a => aufgabePasst(f, a));
    const summen = new Map();
    for (const a of gezaehlt.filter(x => x && x.cost)) {
      const k = kostenInCent(a.cost), s = summen.get(k.waehrung) || { waehrung: k.waehrung, n: 0, niedrig: 0, hoch: 0 };
      summen.set(k.waehrung, { ...s, n: s.n + 1, niedrig: s.niedrig + k.min, hoch: s.hoch + k.max });
    }
    return { m: gezaehlt.length, jeWaehrung: [...summen.values()].sort((a, b) => waehrungVor(a.waehrung, b.waehrung)) };
  }

  /** Filter der Berichte für Bestandsberichte (Kosten, Bestand nach Labels): ein gespeicherter Zeitraum gilt dort nicht
      (ein Bestand ist keine Bewegung) und bleibt für die übrigen Berichte unverändert gespeichert; „Rechnen ab“ nehmen
      kostenbericht und bestandNachLabels gar nicht an. */
  const filterOhneZeitraum = f => ({ ...f, zeitraum: 'alles', von: '', bis: '' });

  /** Umfangstext der Summenzeile: „alle Spalten“ nur, wenn ohne Zeitraum kein Filter wirkt. */
  function kostenUmfang(f) {
    const { filterAnzahl } = typeof module !== 'undefined' ? require('./berichte.js') : window;
    return filterAnzahl(filterOhneZeitraum(f)) === 0 ? 'alle Spalten, auch archivierte' : 'nach Filter, auch archivierte';
  }

  /** Rückfall (R00105 B0376, generisch R00145 FA 2): führt die offene Aufgabe den gemerkten Anzeigeschlüssel nicht
   *  (`tab ∉ schluessel`), gilt „Inhalt“. Die Regel selbst steht einmal in `rueckfallAnsicht` (web/reiter.js); hier kommt
   *  nur der Fokus hinzu: der Ansichts-Auslöser, wenn er auf dem Auslöser, im Ansichtsmenü oder im gezeichneten Panel lag —
   *  sonst bleibt der Fokus, wo er ist (ADR-0010). */
  function reiterRueckfall(lage) {
    const { rueckfallAnsicht } = typeof module !== 'undefined' ? require('./reiter.js') : window;
    if (rueckfallAnsicht(lage.schluessel, lage.tab) === lage.tab) return null;
    return { tab: 'inhalt', fokus: lage.fokusBeiReiter ? '#fenster [data-act="fenster-menue"][data-arg="ansicht"]' : null };
  }

  Object.assign(ziel, { kostenInCent, geld, spanne, preisetikett, reiterRueckfall, kostentabelle, kostenbericht, filterOhneZeitraum, kostenUmfang });
})(typeof module !== 'undefined' ? module.exports : window);
