/* kanbanD — Menüs: Modelle und Tastennavigation als reine Funktionen, im Browser und in Node nutzbar.
   Eintrag: {text, kuerzel?, act, arg, aktuell?} · Untermenü: {text, unter: [...]} · Trenner: {trenner: true} */
(function (ziel) {
  const T = { trenner: true };

  /** Menü einer Karte. u = {spalten: [Namen], spalte, klassen: [{schluessel, bezeichnung}], boards: [{slug, titel, spalte}], ich, meinerLaeuft, meine} */
  function kartenMenue(a, u) {
    const nr = a.nummer;
    return [
      { text: 'Öffnen', kuerzel: 'Enter', act: 'oeffnen', arg: String(nr) },
      T,
      u.meinerLaeuft ? { text: 'Timer stoppen', kuerzel: 't', act: 'stop', arg: `${nr}|${u.ich}` } : { text: 'Timer starten', kuerzel: 't', act: 'start', arg: String(nr) },
      { text: u.meine ? 'Mich abnehmen' : 'Mir zuweisen', kuerzel: 'm', act: 'mich', arg: String(nr) },
      { text: 'Zuständige zuweisen …', kuerzel: 'p', act: 'zuweisen', arg: String(nr) },
      { text: 'Umbenennen', kuerzel: 'F2', act: 'umbenennen', arg: String(nr) },
      T,
      { text: 'Verschieben nach', unter: (u.spalten || []).map((s, i) => ({ text: s, kuerzel: i < 9 ? String(i + 1) : undefined, act: 'verschieben', arg: `${nr}|${s}`, aktuell: s === u.spalte })) },
      { text: 'Klasse', unter: [...(u.klassen || []).map(k => ({ text: k.bezeichnung, act: 'klasse-setzen', arg: `${nr}|${k.schluessel}`, aktuell: k.schluessel === a.klasse })), T, { text: 'keine', act: 'klasse-setzen', arg: `${nr}|`, aktuell: !a.klasse }] },
      { text: 'Fälligkeit', unter: [{ text: 'heute', act: 'faellig-karte', arg: `${nr}|0` }, { text: 'morgen', act: 'faellig-karte', arg: `${nr}|1` }, { text: '+1 Woche', act: 'faellig-karte', arg: `${nr}|7` }, ...(a.faellig ? [T, { text: 'entfernen', act: 'faellig-karte', arg: `${nr}|` }] : [])] },
      ...((u.boards || []).length ? [{ text: 'Auf Board legen', unter: u.boards.map(b => ({ text: `${b.titel} · ${b.spalte}`, act: 'legen', arg: `${b.slug}|${nr}|${b.spalte}` })) }] : []),
      T,
      { text: 'Verweis kopieren', kuerzel: 'c', act: 'kopieren', arg: String(nr) },
      { text: 'Archivieren', kuerzel: 'a', act: 'archivieren', arg: String(nr) },
    ];
  }

  /** Menü für mehrere ausgewählte Karten (R00065); das Argument trägt die Nummernliste „3,5“. u = {spalten, klassen, boards: [{slug, titel, spalte}]} */
  function massenMenue(nummern, u) {
    const l = nummern.join(',');
    return [
      { text: 'Verschieben nach', unter: u.spalten.map((s, i) => ({ text: s, kuerzel: i < 9 ? String(i + 1) : undefined, act: 'm-verschieben', arg: `${l}|${s}` })) },
      { text: 'Klasse', unter: [...u.klassen.map(k => ({ text: k.bezeichnung, act: 'm-klasse', arg: `${l}|${k.schluessel}` })), T, { text: 'keine', act: 'm-klasse', arg: `${l}|` }] },
      { text: 'Fälligkeit', unter: [{ text: 'heute', act: 'm-faellig', arg: `${l}|0` }, { text: 'morgen', act: 'm-faellig', arg: `${l}|1` }, { text: '+1 Woche', act: 'm-faellig', arg: `${l}|7` }, T, { text: 'entfernen', act: 'm-faellig', arg: `${l}|` }] },
      T,
      { text: 'Zuständige zuweisen …', act: 'zuweisen', arg: l },
      { text: 'Mir zuweisen', act: 'm-mich', arg: l },
      ...(u.boards.length ? [{ text: 'Auf Board legen', unter: u.boards.map(b => ({ text: `${b.titel} · ${b.spalte}`, act: 'm-legen', arg: `${b.slug}|${b.spalte}|${l}` })) }] : []),
      T,
      { text: 'Archivieren', act: 'm-archivieren', arg: l },
    ];
  }

  /** Menü eines Spaltenkopfs: i = Position, anzahl = Spaltenzahl, offen = nicht archivierte Karten der Spalte. */
  function spaltenMenue(name, i, anzahl, offen) {
    return [
      { text: 'Karte hinzufügen', kuerzel: 'n', act: 'add', arg: name },
      ...(offen ? [{ text: `Alle ${offen} ${offen === 1 ? 'Karte' : 'Karten'} archivieren`, act: 'spalte-archivieren', arg: name }] : []),
      T,
      ...(i > 0 ? [{ text: 'Spalte nach links', act: 'spalte-schieben', arg: `${i}|-1` }] : []),
      ...(i < anzahl - 1 ? [{ text: 'Spalte nach rechts', act: 'spalte-schieben', arg: `${i}|1` }] : []),
      { text: 'Spalten einrichten …', act: 'setup', arg: '' },
    ];
  }

  /** Menü einer Zeile der Aufgabenliste. u = {liegtAuf: [{slug, titel, spalte}], frei: [{slug, titel, spalten: [Namen]}]} */
  function listenMenue(a, u) {
    const nr = a.nummer;
    return [
      { text: 'Öffnen', kuerzel: 'Enter', act: 'oeffnen', arg: String(nr) },
      T,
      ...(!a.archiviert && u.frei.length ? [{ text: 'Auf Board legen', unter: u.frei.flatMap(b => b.spalten.map(s => ({ text: `${b.titel} · ${s}`, act: 'legen', arg: `${b.slug}|${nr}|${s}` }))) }] : []),
      { text: 'Zuständige zuweisen …', act: 'zuweisen', arg: String(nr) },
      ...(u.liegtAuf.length ? [{ text: 'Von Board nehmen', unter: u.liegtAuf.map(b => ({ text: `${b.titel} · ${b.spalte}`, act: 'abnehmen', arg: `${b.slug}|${nr}` })) }] : []),
      T,
      { text: 'Verweis kopieren', kuerzel: 'c', act: 'kopieren', arg: String(nr) },
      a.archiviert ? { text: 'Zurückholen', act: 'zurueckholen', arg: String(nr) } : { text: 'Archivieren', kuerzel: 'a', act: 'archivieren', arg: String(nr) },
    ];
  }

  const waehlbar = e => e && !e.trenner && !e.aktuell;

  /** Nächster wählbarer Index in Richtung +1/−1 mit Umlauf; Home/End als 'anfang'/'ende'. */
  function menueSchritt(eintraege, index, richtung) {
    const n = eintraege.length;
    if (!eintraege.some(waehlbar)) return -1;
    if (richtung === 'anfang') return menueSchritt(eintraege, -1, 1);
    if (richtung === 'ende') return menueSchritt(eintraege, n, -1);
    let i = index;
    do { i = (i + richtung + n) % n; } while (!waehlbar(eintraege[i]));
    return i;
  }

  Object.assign(ziel, { kartenMenue, massenMenue, spaltenMenue, listenMenue, menueSchritt });
})(typeof module !== 'undefined' ? module.exports : window);
