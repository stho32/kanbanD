/* kanbanD — Adresse der Ansicht und der geöffneten Aufgabe (R00174, ADR-0029): reines Lesen und Bilden, im Browser und in Node nutzbar.
   Formen: `#/board/<slug>[/aufgabe/<nr>]`, `#/aufgaben[/aufgabe/<nr>]`, dazu die Seiten ohne Aufgabe (Personen, Einrichten, Berichte). */
(function (ziel) {
  "use strict";

  /**
   * Liest aus dem Hash `{sicht, slug, nummer}`. `sicht` ist immer eine bekannte Ansicht (Unbekanntes zeigt das Board); `slug`
   * steht da, wie er in der Adresse steht — ob es das Board gibt, prüft der Aufrufer gegen die bekannten Boards; `nummer` ist
   * eine Zahl aus höchstens neun Ziffern oder null. Sonst kommt nichts aus der Adresse heraus.
   */
  function adresseLesen(hash) {
    const text = String(hash || '');
    const review = reviewLesen(text);
    if (review) return { sicht: 'review', slug: slugLesen(text), nummer: null, review };
    const lauf = laufLesen(text);
    if (lauf) return { sicht: 'lauf', slug: slugLesen(text), nummer: null, lauf };
    return { sicht: ansichtAusAdresse(text), slug: slugLesen(text), nummer: nummerLesen(text) };
  }

  /** Form eines Commit-Verweises, bevor er in eine Anfrage geht (ADR-0033 Punkt 1): Kürzel und Hash von 7 bis 64 Hex-Zeichen. */
  const VERWEIS_FORM = /^([a-z0-9]{1,8}:)?[0-9a-fA-F]{7,64}$/;

  /** Review-Seite `…/aufgabe/<nr>/review[?commit=<verweis>]` (R00207 FA 2): `nummer` ist die der Seite, nicht die des Fensters —
      das Fenster bleibt auf dieser Adresse zu. Ein Verweis, der nicht in Form ist, kommt nie heraus, nur `ungueltig`. */
  function reviewLesen(text) {
    const m = /^#\/(board\/[^/]+|aufgaben)\/aufgabe\/([0-9]{1,9})\/review(?:\?(.*))?$/.exec(text);
    const nummer = m && Number(m[2]);
    if (!nummer) return null;
    const basis = m[1] === 'aufgaben' ? 'aufgaben' : 'board';
    const roh = new URLSearchParams(m[3] || '').get('commit');
    if (roh === null) return { basis, nummer, commit: null, ungueltig: false };
    const gueltig = VERWEIS_FORM.test(roh);
    return { basis, nummer, commit: gueltig ? roh : null, ungueltig: !gueltig };
  }

  /** Die Adresse der Review-Seite; ohne `commit` die Seite ohne Verweis. */
  function reviewAdresseBilden({ basis, slug, nummer, commit }) {
    const seite = adresseBilden({ sicht: basis, slug, nummer });
    if (!commit) return seite + '/review';
    return seite + '/review?commit=' + encodeURIComponent(commit);
  }

  /** Laufansicht `…/aufgabe/<nr>/lauf?kennung=<kodiert>` (R00221 FA 2, ADR-0041 Punkt 1): `nummer` ist die der Seite, das Fenster
      bleibt zu. Die Kennung ist nur Suchtext für einen Textvergleich mit `a.transkripte`: höchstens 100 Zeichen ohne Steuerzeichen,
      sonst null — dann gibt es keinen Treffer und keine Anfrage. */
  function laufLesen(text) {
    const m = /^#\/(board\/[^/]+|aufgaben)\/aufgabe\/([0-9]{1,9})\/lauf(?:\?(.*))?$/.exec(text);
    const nummer = m && Number(m[2]);
    if (!nummer) return null;
    const basis = m[1] === 'aufgaben' ? 'aufgaben' : 'board';
    const roh = new URLSearchParams(m[3] || '').get('kennung');
    const gueltig = Boolean(roh) && Array.from(roh).length <= KENNUNG_ZEICHEN && !STEUERZEICHEN.test(roh);
    return { basis, nummer, kennung: gueltig ? roh : null };
  }
  const KENNUNG_ZEICHEN = 100;
  const STEUERZEICHEN = /[\u0000-\u001F\u007F-\u009F]/;

  /** Die Adresse der Laufansicht; die gespeicherte Kennung geht kodiert hinein. */
  function laufAdresseBilden({ basis, slug, nummer, kennung }) {
    return adresseBilden({ sicht: basis, slug, nummer }) + '/lauf?kennung=' + encodeURIComponent(kennung);
  }

  /** Der Router der Ansichten: Unbekanntes zeigt das Board. */
  function ansichtAusAdresse(hash) {
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

  /** Was der Hinweis nach „Link kopieren“ sagt. Ein Link von `localhost`, `127.0.0.1` oder `[::1]` führt nur auf dem eigenen Rechner zum Ziel. */
  function linkRueckmeldung({ kopiert, hostname }) {
    let text = 'Kopieren nicht erlaubt — der Link steht in der Adresszeile';
    if (kopiert) text = 'Link kopiert';
    const nurAufDiesemRechner = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
    if (!nurAufDiesemRechner) return text;
    return text + ' — gilt nur auf diesem Rechner';
  }

  Object.assign(ziel, { adresseLesen, adresseBilden, reviewAdresseBilden, laufAdresseBilden, linkRueckmeldung });
})(typeof module !== 'undefined' ? module.exports : window);
