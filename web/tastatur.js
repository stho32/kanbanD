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

  const G_ZIELE = { b: '#/board/', a: '#/aufgaben', p: '#/personen', s: '#/berichte/stundenzettel', z: '#/berichte/kreuz', v: '#/berichte/verlauf', d: '#/berichte/durchlauf', e: '#/einrichten' };

  /** g-Folgen: vorher = vorige Taste (oder null), taste = jetzige. Liefert {ziel, warte}. */
  function gFolge(vorher, taste) {
    if (vorher === 'g' && G_ZIELE[taste]) return { ziel: G_ZIELE[taste], warte: false };
    return { ziel: null, warte: taste === 'g' && vorher !== 'g' };
  }

  Object.assign(ziel, { nachbar, verschiebeziel, gFolge, G_ZIELE });
})(typeof module !== 'undefined' ? module.exports : window);
