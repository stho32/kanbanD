/* kanbanD — Fokusführung über Ebenen (R00106, ADR-0010): reine Funktionen, im Browser und in Node nutzbar.
   Eine Ebene ist ein offener Dialog oder ein offenes Menü: {art, selektor, start (Selektor oder Liste in Rangfolge), rueckgabe: [Selektoren], modal, fenster}. */
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
    return { art, selektor, start, rueckgabe, modal: false, fenster: false };
  }

  /** Pops, die nicht-modale Fenster sind (PO Z. 107–108): kein Startziel, der Fokus geht aufs erste Tabbare. */
  const POP_FENSTER = new Set(['board', 'lauf', 'defekt']);
  /** Das Ich-Menü öffnet auf dem gewählten Menschen, ohne Wahl auf dem ersten wählbaren. */
  const GEWAEHLTER_MENSCH = '#pop [role="menuitemradio"][aria-checked="true"]';
  /** Kopf-Menü des Fensters: Startziel ist der gewählte Eintrag (Ansichten), sonst der erste (Aktionen); die Rangfolge deckt beides. */
  const GEWAEHLTER_MENUEEINTRAG = ['#fenster [role="menu"] [role="menuitemradio"][aria-checked="true"]', `#fenster [role="menu"] ${ERSTER_MENUEEINTRAG}`];

  function popEbene(ui, gemerkt) {
    if (POP_FENSTER.has(ui.pop)) return { art: 'pop', selektor: '#pop', start: null, rueckgabe: ausloeser(gemerkt, 'pop'), modal: false, fenster: true };
    if (ui.pop === 'ich') return menue('pop', '#pop', [GEWAEHLTER_MENSCH, `#pop ${ERSTER_MENUEEINTRAG}`], ausloeser(gemerkt, 'pop'));
    return menue('pop', '#pop', `#pop ${ERSTER_MENUEEINTRAG}`, ausloeser(gemerkt, 'pop'));
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

  /** Selektor des aktiven Kontextmenü-Eintrags: im offenen Untermenü dessen Eintrag, sonst der Eintrag der obersten Ebene. */
  function kmenueEintrag(menue) {
    if (menue.unter && menue.unter.index >= 0) return `#kmenue [data-mp="${menue.unter.von}.${menue.unter.index}"]`;
    return `#kmenue [data-mp="${menue.index}"]`;
  }

  /** Offene Ebenen von unten nach oben; gemerkt = {art: Selektor des Auslösers beim Öffnen}.
      Das Kopf-Menü des Aufgabenfensters (R00144/R00145) liegt im Fenster: über `fenster`, unter `pop` (ADR-0018 N2). */
  function ebenen(ui, gemerkt = {}) {
    const liste = dialogstapel(ui, gemerkt);
    if (ui.fensterMenue && ui.offen && !ui.setup) liste.push(menue('fenstermenue', '#fenster [role="menu"]', GEWAEHLTER_MENUEEINTRAG, ausloeser(gemerkt, 'fenstermenue')));
    if (ui.pop) liste.push(popEbene(ui, gemerkt));
    if (ui.alDialog) liste.push(dialog('aldialog', '#al-dialog', '#al-abbrechen', ausloeser(gemerkt, 'aldialog')));
    if (ui.menue) liste.push(menue('kmenue', '#kmenue', kmenueEintrag(ui.menue), ausloeser(gemerkt, 'kmenue')));
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

  /** Tab am Rand eines nicht-modalen Pop-Fensters: 'nach-ausloeser' (Tab am letzten), 'ausloeser' (Umschalt+Tab am ersten), sonst 'weiter'. */
  function fensterRand(anzahl, index, rueckwaerts) {
    if (rueckwaerts && index <= 0 && anzahl > 0) return 'ausloeser';
    if (!rueckwaerts && index >= anzahl - 1) return 'nach-ausloeser';
    return 'weiter';
  }

  /** Fokusziele nach dem Neuzeichnen in Rangfolge; das erste, das sich setzen lässt, gilt. 'gesichert' steht für den Sicherer.
      lage = {ausdruecklich, gesichert, gesichertInOberster, ort, vorgemerkt, geschlossen, geoeffnet, oberste, fuehrung, vorher}
      vorher = {stand: 'nichts' (BODY) | 'gehalten' (hängt noch im Dokument) | 'verloren' (mit dem Neuzeichnen ersetzt), selektor, sichtbar}
      ort = der Ort des Abschnitts (data-ort) des zuletzt fokussierten Elements: dorthin, wenn der Sicherer es nicht wiederfindet
      (mehrdeutiger Inhalt oder fremd geändert) — nie auf ein fremdes Element, aber auch nicht eigens ins Fenster.
      vorgemerkt = ein Ziel, das nicht im selben Zug wie das Zeichnen gesetzt wurde (Timer, Antwort des Servers): es überholt
      den Menschen nicht und gilt erst, wenn der Sicherer nichts wiederfindet und nichts im Dokument geblieben ist
      (ADR-0010 N10 Ziffer 3, R00191 AK 4). */
  function fokusZiel(lage) {
    const ziele = [];
    if (lage.ausdruecklich) ziele.push(...[].concat(lage.ausdruecklich));
    if (lage.gesichert && lage.gesichertInOberster) ziele.push(GESICHERT);
    if (lage.ort) ziele.push(lage.ort);
    if (vorgemerktGilt(lage)) ziele.push(lage.vorgemerkt);
    if (lage.geschlossen) ziele.push(...lage.geschlossen.rueckgabe);
    if (lage.geoeffnet && lage.geoeffnet.start) ziele.push(...[].concat(lage.geoeffnet.start));
    if (lage.oberste && lage.oberste.start) ziele.push(...[].concat(lage.oberste.start));
    if (fuehrungGilt(lage)) ziele.push(lage.fuehrung);
    return [...new Set(ziele)];
  }

  function vorgemerktGilt(lage) {
    const fokusGehalten = Boolean(lage.vorher) && lage.vorher.stand === 'gehalten';
    return Boolean(lage.vorgemerkt) && !fokusGehalten;
  }

  /** Karte bzw. Zeile der Führung nur ohne offene Ebene und nur, wenn das Neuzeichnen den Fokus genommen hat:
      wer per Maus ins Leere geklickt hat (BODY), bekommt ihn von einem Live-Ereignis nicht zurück. */
  function fuehrungGilt(lage) {
    const fokusVerloren = Boolean(lage.vorher) && lage.vorher.stand === 'verloren';
    return !lage.oberste && Boolean(lage.fuehrung) && fokusVerloren;
  }

  /** Das Ziel ohne Scrollen setzen: das Aufgabenfenster selbst immer; dasselbe Element wie vor dem Neuzeichnen, wenn es
      außer Sicht lag — der Nutzer hat weggescrollt. Rückgabe an den Auslöser, Öffnen und ein neues Ziel dürfen scrollen. */
  function ohneRollen(ziel, vorher) {
    if (ziel === '#fenster') return true;
    const gehalten = Boolean(vorher.selektor) && ziel === vorher.selektor;
    return gehalten && !vorher.sichtbar;
  }

  /** Stelle des Nachbarn in einer Liste von `anzahl` Einträgen, nachdem der an `index` entfernt ist: der folgende rückt
      nach, am Ende der vorige; -1, wenn keiner bleibt (R00112 FA 8). */
  function nachbarNachEntfernen(anzahl, index) {
    if (anzahl < 2) return -1;
    return Math.min(index, anzahl - 2);
  }

  Object.assign(ziel, { ebenen, fallenSchritt, fensterRand, fokusZiel, kmenueEintrag, nachbarNachEntfernen, ohneRollen, GESICHERT });
})(typeof module !== 'undefined' ? module.exports : window);
