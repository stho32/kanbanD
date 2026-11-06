/* kanbanD — Fokusführung über Ebenen (R00106, ADR-0010): reine Funktionen, im Browser und in Node nutzbar.
   Eine Ebene ist ein offener Dialog oder ein offenes Menü: {art, selektor, start, rueckgabe: [Selektoren], modal}. */
(function (ziel) {
  'use strict';
  const GESICHERT = 'gesichert';
  const ERSTER_MENUEEINTRAG = '[role^="menuitem"]:not([aria-disabled="true"])';

  /** Karte im Board bzw. Zeile in der Aufgabenliste einer Aufgabe; andere Sichten haben keine. */
  function ortDerAufgabe(view, nummer) {
    if (view === 'board') return [`.ka[data-id="${nummer}"]`];
    if (view === 'aufgaben') return [`tr[data-zeile="${nummer}"]`];
    return [];
  }

  /** Gemerkter Auslöser der Ebene als Liste mit höchstens einem Selektor. */
  function ausloeser(gemerkt, art) {
    if (!gemerkt[art]) return [];
    return [gemerkt[art]];
  }

  function dialog(art, selektor, start, rueckgabe) {
    return { art, selektor, start, rueckgabe, modal: true };
  }

  function menue(art, selektor, start, rueckgabe) {
    return { art, selektor, start, rueckgabe, modal: false };
  }

  /** Offene Dialoge von unten nach oben: Fenster bzw. Neu und Defekt, darüber Zuweisen und Hilfe. */
  function dialogstapel(ui, gemerkt) {
    const stapel = [];
    if (ui.offen && !ui.setup) stapel.push(dialog('fenster', '#fenster', '#fenster', [...ortDerAufgabe(ui.view, ui.offen), ...ausloeser(gemerkt, 'fenster')]));
    if (ui.neu) stapel.push(dialog('neu', '#neu-fenster', null, ausloeser(gemerkt, 'neu')));
    if (ui.offenDefekt) stapel.push(dialog('defekt', '#defekt-fenster', null, [...ortDerAufgabe(ui.view, ui.offenDefekt), ...ausloeser(gemerkt, 'defekt')]));
    if (ui.zuweisen) stapel.push(dialog('zuweisen', '#zuweisen', null, ausloeser(gemerkt, 'zuweisen')));
    if (ui.hilfe) stapel.push(dialog('hilfe', '#hilfe', '#hilfe', ausloeser(gemerkt, 'hilfe')));
    return stapel;
  }

  /** Offene Ebenen von unten nach oben; gemerkt = {art: Selektor des Auslösers beim Öffnen}. */
  function ebenen(ui, gemerkt = {}) {
    const liste = dialogstapel(ui, gemerkt);
    if (ui.pop) liste.push(menue('pop', '#pop', `#pop ${ERSTER_MENUEEINTRAG}`, ausloeser(gemerkt, 'pop')));
    if (ui.menue) liste.push(menue('kmenue', '#kmenue', '#kmenue .km-e.an', ausloeser(gemerkt, 'kmenue')));
    return liste;
  }

  /** Nächster Index im Tab-Umlauf über `anzahl` tabbare Elemente; -1, wenn es keines gibt. */
  function fallenSchritt(anzahl, index, rueckwaerts) {
    if (anzahl < 1) return -1;
    if (index < 0 && rueckwaerts) return anzahl - 1;
    if (index < 0) return 0;
    if (rueckwaerts) return (index - 1 + anzahl) % anzahl;
    return (index + 1) % anzahl;
  }

  /** Fokusziele nach dem Neuzeichnen in Rangfolge; das erste, das sich setzen lässt, gilt. 'gesichert' steht für den Sicherer.
      lage = {ausdruecklich, gesichert, gesichertInOberster, geschlossen, geoeffnet, oberste, fuehrung} */
  function fokusZiel(lage) {
    const ziele = [];
    if (lage.ausdruecklich) ziele.push(lage.ausdruecklich);
    if (lage.gesichert && lage.gesichertInOberster) ziele.push(GESICHERT);
    if (lage.geschlossen) ziele.push(...lage.geschlossen.rueckgabe);
    if (lage.geoeffnet && lage.geoeffnet.start) ziele.push(lage.geoeffnet.start);
    if (lage.oberste && lage.oberste.start) ziele.push(lage.oberste.start);
    if (!lage.oberste && lage.fuehrung) ziele.push(lage.fuehrung);
    return [...new Set(ziele)];
  }

  Object.assign(ziel, { ebenen, fallenSchritt, fokusZiel, GESICHERT });
})(typeof module !== 'undefined' ? module.exports : window);
