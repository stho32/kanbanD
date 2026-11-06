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

  Object.assign(ziel, { kostenInCent, geld });
})(typeof module !== 'undefined' ? module.exports : window);
