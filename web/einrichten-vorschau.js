/* kanbanD — Vorschau in „Einrichten“ als Trockenlauf des Servers (R00250, ADR-0043 N1.2): welche Antwort welchen Stand zeigt,
   und der Takt der Anfragen. Rein, im Browser und in Node nutzbar; Anfrage, Zeichnen und Uhr gibt der Aufrufer. */
(function (ziel) {
  "use strict";

  /** Statuszeile, solange die Antwort länger als `daempfMs` ausbleibt, und vor der ersten Antwort (PO Z. 693). */
  const VORSCHAU_WARTET = 'Vorschau wird aktualisiert …';
  const KEINE_ANTWORT = 'Vorschau nicht aktuell — keine Antwort vom Server.';

  /**
   * Der Stand nach einer Antwort `{status, daten, meldung}` (`status` 0 = keine Antwort: Netz oder Frist; `meldung` = Text der
   * Anfrage, falls `daten` kein `fehler` trägt). 200: der Text der Datei. Jede 4xx: wörtlich das `fehler`, das „Speichern“
   * zeigen würde (PO Z. 694). Keine Antwort und 5xx: der alte Text bleibt gedämpft stehen, die Statuszeile sagt warum (Z. 693).
   */
  function vorschauAntwort({ status, daten, meldung }, alterText) {
    const fehler = daten && typeof daten.fehler === 'string' ? daten.fehler : '';
    if (status === 200) return { stand: 'aktuell', text: daten.text, meldung: '', gedaempft: false };
    if (status >= 400 && status < 500) return { stand: 'verweigert', text: fehler || meldung || '', meldung: '', gedaempft: false };
    const grund = status ? `Vorschau nicht aktuell: ${fehler || 'Fehler im Server'} (${status}).` : KEINE_ANTWORT;
    return { stand: 'fehler', text: alterText, meldung: grund, gedaempft: true };
  }

  /**
   * Der Takt (ADR-0043 N1.2): `anstossen(false)` nach einer Eingabe wartet `entprellMs`, `anstossen(true)` fragt sofort. Ab dem
   * Anstoß ist der Stand „wartet“ mit dem alten Text; erst nach `daempfMs` ohne Antwort wird er gedämpft und die Statuszeile
   * erscheint. Höchstens eine Anfrage ist unterwegs; was währenddessen angestoßen wird, geht danach einmal los, und nur die
   * Antwort der jüngsten Anfrage zählt. `schliessen()` verwirft alles Laufende; danach beginnt die Vorschau wieder leer.
   * `anfrage()` liefert eine Zusage auf `{status, daten, meldung}` und scheitert nie; `zeigen(stand)` zeichnet.
   */
  function vorschauTakt({ anfrage, zeigen, uhr, entprellMs, daempfMs }) {
    const leer = () => ({ stand: 'wartet', text: '', meldung: VORSCHAU_WARTET, gedaempft: false });
    let stand = leer();
    let nummer = 0, unterwegs = false, nochmal = false, entprellt = null, daempfer = null;

    function zeichnen(neu) {
      stand = neu;
      zeigen({ ...stand });
    }

    function weckerAus() {
      if (entprellt) uhr.clearTimeout(entprellt);
      if (daempfer) uhr.clearTimeout(daempfer);
      entprellt = daempfer = null;
    }

    function starten() {
      if (unterwegs) { nochmal = true; return; }
      const meine = ++nummer;
      unterwegs = true;
      anfrage().then(antwort => {
        if (meine !== nummer) return;
        unterwegs = false;
        if (nochmal) { nochmal = false; starten(); return; }
        // eine Eingabe wartet noch auf ihre Entprellung: der Stand bleibt „wartet“, ihre Anfrage folgt
        if (entprellt) return;
        if (daempfer) uhr.clearTimeout(daempfer);
        daempfer = null;
        zeichnen(vorschauAntwort(antwort, stand.text));
      });
    }

    function anstossen(sofort) {
      if (stand.stand !== 'wartet') zeichnen({ ...stand, stand: 'wartet' });
      else zeigen({ ...stand });
      if (!daempfer) {
        daempfer = uhr.setTimeout(() => {
          daempfer = null;
          if (stand.stand === 'wartet') zeichnen({ ...stand, meldung: VORSCHAU_WARTET, gedaempft: true });
        }, daempfMs);
      }
      if (entprellt) uhr.clearTimeout(entprellt);
      entprellt = null;
      if (sofort) starten();
      else entprellt = uhr.setTimeout(() => { entprellt = null; starten(); }, entprellMs);
    }

    function schliessen() {
      weckerAus();
      nummer++;
      unterwegs = nochmal = false;
      stand = leer();
    }

    return { anstossen, schliessen, zustand: () => ({ ...stand }) };
  }

  Object.assign(ziel, { vorschauAntwort, vorschauTakt, VORSCHAU_WARTET });
})(typeof module !== 'undefined' ? module.exports : window);
