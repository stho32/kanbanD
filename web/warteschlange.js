/* kanbanD — die Warteschlange eigener Änderungen (R00037, R00110, R00147) und die Frist je Anfrage (R00186): reine Kette, im Browser und in Node nutzbar. */
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
   * Ein Programmfehler beim Nachladen (Fehler ohne `status`) steht zusätzlich als `console.error` in der Konsole (R00186).
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
          // bevor das Nachladen beginnt. Ein Fehler des Hakens bricht die Kette nicht (sonst sprängen alle folgenden Glieder
          // über die Ablehnung, und `offen` ginge nie herunter) und bleibt in der Konsole sichtbar.
          try { nachAnfrage(); } catch (fehler) { console.error('Warteschlange: nachAnfrage', fehler); }
          offen--;
          if (offen > 0) return;
          vorLaden(ausloeser);
          // Auch das Nachladen endet erfüllt; scheiterte die eigene Anfrage, ist ihre Meldung die einzige (AK 8).
          return Promise.resolve().then(laden).catch(fehler => {
            // Netzfehler und Frist tragen `status: 0`, Ablehnungen des Servers ihren Status; ein Fehler ohne `status` ist ein
            // Programmfehler (etwa eine unlesbare Antwort) und bleibt in der Konsole sichtbar (R00186 150-2).
            if (fehler == null || fehler.status === undefined) console.error('Warteschlange: Nachladen', fehler);
            if (!eigeneGescheitert) melden('laden', fehler, ausloeser);
          });
        });
      return kette;
    }

    return { einreihen, offen: () => offen };
  }

  /**
   * Lässt `arbeit(signal)` höchstens `fristMs` laufen (R00186, ADR-0025 Nachtrag N4): antwortet sie vorher, gilt ihr Ausgang
   * unverändert; sonst wird sie über `signal` abgebrochen, und das Ergebnis ist die Ablehnung mit `fehlerNachFrist()`.
   * Der Zeitgeber wird in jedem Fall geräumt. `uhr` ist Eingabe, damit die Frist ohne Wanduhr prüfbar ist.
   */
  function mitFrist(arbeit, fristMs, fehlerNachFrist, uhr = { stellen: (klingeln, ms) => setTimeout(klingeln, ms), raeumen: wecker => clearTimeout(wecker) }) {
    const abbruch = new AbortController();
    let wecker;
    const frist = new Promise((_, ablehnen) => {
      wecker = uhr.stellen(() => { abbruch.abort(); ablehnen(fehlerNachFrist()); }, fristMs);
    });
    // Das Wettrennen hört beiden zu: wirft die abgebrochene Arbeit später ihren Abbruchfehler, bleibt er nicht unbehandelt.
    return Promise.race([Promise.resolve().then(() => arbeit(abbruch.signal)), frist]).finally(() => uhr.raeumen(wecker));
  }

  Object.assign(ziel, { warteschlangeFuehren, mitFrist });
})(typeof module !== 'undefined' ? module.exports : window);