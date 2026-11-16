/* kanbanD — Adresse der Ansicht und der geöffneten Aufgabe (R00174, ADR-0029): reines Lesen und Bilden, im Browser und in Node nutzbar.
   Formen: `#/board/<slug>[/aufgabe/<nr>]`, `#/aufgaben[/aufgabe/<nr>]`, dazu die Seiten ohne Aufgabe (Personen, Einrichten, Berichte, WBS). */
(function (ziel) {
  "use strict";

  /**
   * Liest aus dem Hash `{sicht, slug, nummer}`. `sicht` ist immer eine bekannte Ansicht (Unbekanntes zeigt das Board); `slug`
   * steht da, wie er in der Adresse steht — ob es das Board gibt, prüft der Aufrufer gegen die bekannten Boards; `nummer` ist
   * eine Zahl aus höchstens neun Ziffern oder null. Sonst kommt nichts aus der Adresse heraus.
   */
  function adresseLesen(hash) {
    const text = String(hash || '');
    return { sicht: ansichtAusAdresse(text), slug: slugLesen(text), nummer: nummerLesen(text) };
  }

  /** Der Router der Ansichten: Unbekanntes zeigt das Board. */
  function ansichtAusAdresse(hash) {
    if (/^#\/wbs\//.test(hash)) return 'wbs';
    const m = /^#\/(einrichten|aufgaben|personen|berichte\/stundenzettel|berichte\/kreuz|berichte\/verlauf|berichte\/fluss|berichte\/durchsatz|berichte\/durchlauf|berichte\/prognose|berichte\/fieber|berichte\/kosten|berichte\/bestand)/.exec(hash);
    return m ? m[1] : 'board';
  }

  function slugLesen(text) {
    const board = /^#\/board\/([^/]+)/.exec(text);
    if (board) return board[1];
    return null;
  }

  /** Die Nummer steht nur am Ende der beiden zugesagten Formen und besteht nur aus den Ziffern 0–9; null ist keine Nummer. */
  function nummerLesen(text) {
    const aufgabe = /^#\/(?:board\/[^/]+|aufgaben)\/aufgabe\/([0-9]{1,9})$/.exec(text);
    if (!aufgabe) return null;
    return Number(aufgabe[1]) || null;
  }

  /** Die Adresse zu Board bzw. Aufgabenliste, mit `nummer` die der geöffneten Aufgabe. */
  function adresseBilden({ sicht, slug, nummer }) {
    let seite = '#/board/' + slug;
    if (sicht === 'aufgaben') seite = '#/aufgaben';
    if (!nummer) return seite;
    return seite + '/aufgabe/' + nummer;
  }

  /** Was der Hinweis nach „Link kopieren“ sagt. Ein Link von `localhost` oder `127.0.0.1` führt nur auf dem eigenen Rechner zum Ziel. */
  function linkRueckmeldung({ kopiert, hostname }) {
    let text = 'Kopieren nicht erlaubt — der Link steht in der Adresszeile';
    if (kopiert) text = 'Link kopiert';
    const nurAufDiesemRechner = hostname === 'localhost' || hostname === '127.0.0.1';
    if (!nurAufDiesemRechner) return text;
    return text + ' — gilt nur auf diesem Rechner';
  }

  Object.assign(ziel, { adresseLesen, adresseBilden, linkRueckmeldung });
})(typeof module !== 'undefined' ? module.exports : window);
