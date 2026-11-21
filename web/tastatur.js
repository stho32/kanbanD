/* kanbanD — Tastaturziele: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar.
   `spalten` = [{name, karten: [nr, …]}] in sichtbarer Reihenfolge. */
(function (ziel) {
  function ort(spalten, nr) {
    for (let s = 0; s < spalten.length; s++) {
      const i = spalten[s].karten.indexOf(nr);
      if (i >= 0) return { s, i };
    }
    return null;
  }

  /** Nachbarkarte in Richtung 'links' | 'rechts' | 'hoch' | 'runter'; ohne Karte die erste sichtbare. */
  function nachbar(spalten, nr, richtung) {
    const o = ort(spalten, nr);
    if (!o) { const s = spalten.find(x => x.karten.length); return s ? s.karten[0] : null; }
    if (richtung === 'hoch') return o.i > 0 ? spalten[o.s].karten[o.i - 1] : null;
    if (richtung === 'runter') return o.i < spalten[o.s].karten.length - 1 ? spalten[o.s].karten[o.i + 1] : null;
    const d = richtung === 'links' ? -1 : 1;
    for (let s = o.s + d; s >= 0 && s < spalten.length; s += d) {
      const k = spalten[s].karten;
      if (k.length) return k[Math.min(o.i, k.length - 1)];
    }
    return null;
  }

  /** Ziel zum Verschieben: {spalte, index} (index in der Zielspalte nach dem Herausnehmen) oder null am Rand. */
  function verschiebeziel(spalten, nr, richtung) {
    const o = ort(spalten, nr);
    if (!o) return null;
    if (richtung === 'hoch') return o.i > 0 ? { spalte: spalten[o.s].name, index: o.i - 1 } : null;
    if (richtung === 'runter') return o.i < spalten[o.s].karten.length - 1 ? { spalte: spalten[o.s].name, index: o.i + 1 } : null;
    const s = o.s + (richtung === 'links' ? -1 : 1);
    if (s < 0 || s >= spalten.length) return null;
    return { spalte: spalten[s].name, index: Math.min(o.i, spalten[s].karten.length) };
  }

  const G_ZIELE = { b: '#/board/', a: '#/aufgaben', p: '#/personen', s: '#/berichte/stundenzettel', z: '#/berichte/kreuz', v: '#/berichte/verlauf', d: '#/berichte/durchlauf', u: '#/berichte/durchsatz', w: '#/berichte/prognose', f: '#/berichte/fieber', e: '#/einrichten' };

  /** g-Folgen: vorher = vorige Taste (oder null), taste = jetzige. Liefert {ziel, warte}. */
  function gFolge(vorher, taste) {
    if (vorher === 'g' && G_ZIELE[taste]) return { ziel: G_ZIELE[taste], warte: false };
    return { ziel: null, warte: taste === 'g' && vorher !== 'g' };
  }

  const RADIO_RICHTUNG = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

  /** Radiogruppe (R00106, APG Radio Group): Index des Radios, das Fokus und Wahl bekommt, mit Umlauf;
      ohne Wahl (index -1) vorwärts das erste, rückwärts das letzte. Null, wenn die Taste nicht der Gruppe gehört. */
  function radioSchritt(anzahl, index, taste) {
    if (!Object.hasOwn(RADIO_RICHTUNG, taste)) return null;
    const richtung = RADIO_RICHTUNG[taste];
    if (index < 0 && richtung > 0) return 0;
    if (index < 0) return anzahl - 1;
    return (index + richtung + anzahl) % anzahl;
  }

  const LOEST_SELBST_AUS = /^(BUTTON|A|SUMMARY|INPUT|TEXTAREA|SELECT)$/;

  /** Ob ein Tastendruck das fokussierte Bedienelement auslöst wie ein Klick (R00180, APG Button und Checkbox): Rolle button
      und eine Tabellenzeile mit Aktion auf Enter und Leertaste, Rolle checkbox nur auf die Leertaste, mit Strg, Alt oder
      Meta nie. Native Knöpfe und Links lösen selbst aus, in Eingabefeldern schreibt die Leertaste.
      `element` = {tag, rolle, aktion}, `druck` = {taste, strg, alt, meta}. */
  function tasteLoestAus(element, druck) {
    if (druck.strg || druck.alt || druck.meta) return false;
    if (LOEST_SELBST_AUS.test(element.tag)) return false;
    const leertaste = druck.taste === ' ';
    if (element.rolle === 'checkbox') return leertaste;
    const zeileMitAktion = element.tag === 'TR' && Boolean(element.aktion);
    if (element.rolle !== 'button' && !zeileMitAktion) return false;
    return leertaste || druck.taste === 'Enter';
  }

  Object.assign(ziel, { nachbar, verschiebeziel, gFolge, G_ZIELE, radioSchritt, tasteLoestAus });
})(typeof module !== 'undefined' ? module.exports : window);
