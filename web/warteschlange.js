/* kanbanD — die Warteschlange eigener Änderungen (R00037, R00110, R00147): reine Kette, im Browser und in Node nutzbar. */
(function (ziel) {
  "use strict";

  /**
   * Führt eigene Anfragen strikt nacheinander aus (R00037) und lädt danach einmal neu, wenn die Kette leer ist
   * (R00110, ADR-0014 Regel 3). Das Kettenende endet in **jedem** Fall erfüllt (R00147, ADR-0025 Regel 3): ein
   * Fehlschlag — der eigenen Anfrage oder des Nachladens — hinterlässt keine Ablehnung bei den folgenden Anfragen,
   * und `offen` geht in jedem Fall herunter.
   *
   * `melden(art, fehler, ausloeser)` nennt je Fehlschlag genau einmal, was geschah: `art` ist `'anfrage'` (die eigene
   * Änderung kam nicht an) oder `'laden'` (die Änderung ist gespeichert, die Ansicht nicht neu geladen). Scheitern im
   * selben Schritt beide, wird nur die eigene Anfrage gemeldet (R00147 AK 8) — der Text „gespeichert“ ist dann falsch.
   * `vorLaden()` setzt die Marke vor dem Laden; `gespeichert(ergebnis, ausloeser)` merkt eine angenommene Änderung.
   */
  function warteschlangeFuehren({ laden, melden, gespeichert = () => { }, vorLaden = () => { } }) {
    let kette = Promise.resolve(), offen = 0;

    function einreihen(anfrage, ausloeser, nachAnfrage = () => { }) {
      offen++;
      let eigeneGescheitert = false;
      kette = kette
        .then(anfrage)
        .then(ergebnis => { gespeichert(ergebnis, ausloeser); return ergebnis; })
        .catch(fehler => { eigeneGescheitert = true; melden('anfrage', fehler, ausloeser); })
        .then(() => {
          // Die Anfrage ist beantwortet (auch mit Fehlschlag) — wer daran etwas aufhängt (die Sperre, R00148), erfährt es hier,
          // bevor das Nachladen beginnt.
          nachAnfrage();
          offen--;
          if (offen > 0) return;
          vorLaden(ausloeser);
          // Auch das Nachladen endet erfüllt; scheiterte die eigene Anfrage, ist ihre Meldung die einzige (AK 8).
          return Promise.resolve().then(laden).catch(fehler => {
            if (!eigeneGescheitert) melden('laden', fehler, ausloeser);
          });
        });
      return kette;
    }

    return { einreihen, offen: () => offen };
  }

  Object.assign(ziel, { warteschlangeFuehren });
})(typeof module !== 'undefined' ? module.exports : window);