/* kanbanD — genau ein Auslöser je Aktion (R00148, ADR-0025 Regel 1): der Sperrzustand, im Browser und in Node nutzbar. */
(function (ziel) {
  "use strict";

  /**
   * Führt die Menge der laufenden Auslöser über `laufend` — den Sichtzustand (`S.ui.laufend`, ADR-0007), damit die
   * Sperre das Neuzeichnen übersteht und nicht am DOM-Knoten hängt. Solange die Anfrage eines Schreib-Auslösers läuft,
   * hat derselbe Auslöser keine Wirkung; er endet mit der Antwort, auch bei einem Fehlschlag (ADR-0025 Regel 1/2).
   */
  function sperreFuehren(laufend = new Set()) {
    return {
      laeuft: name => laufend.has(name),
      starten: name => { laufend.add(name); },
      beenden: name => { laufend.delete(name); },
      namen: () => [...laufend],
      /** Läuft die Aktion `name` (aus `aktionsName` ohne Wert) — mit oder ohne Wert aus einem Feld? */
      laeuftAktion: name => [...laufend].some(n => n === name || n.startsWith(name + WERT)),
    };
  }

  /**
   * Kennung eines Auslösers: seine Aktion und sein Ort in der gezeichneten Fläche. `element` ist der getroffene Knoten
   * als `{ aktion, anker, argument }`, `platz` zählt, der wievielte Auslöser derselben Aktion in seinem Anker er ist.
   * Das Argument trägt die Kennung **nicht**: die Kartenleiste schreibt ihr Argument beim eigenen Neuzeichnen auf den
   * nächsten Eintrag um (web/ansicht.js) — ein Argument-Schlüssel ließe den zweiten Tipp den Nachbarn abhaken.
   */
  function ausloeserName(element, platz) {
    return `${element.aktion}|${element.anker}|${platz}`;
  }

  /** Trennt den Wert eines Felds von Aktion und Argument; kommt in keinem `data-arg` vor. */
  const WERT = '\u0000';

  /**
   * Kennung einer Aktion mit ihrem Argument — die Kennung eines Auslösers, der kein Element hat (Tastenkürzel), und die
   * zweite Kennung jedes Knopfs: so sind Taste „a“ und Menüpunkt „Archivieren“ derselbe Auslöser (R00148 AK 12). Ein
   * fehlendes Argument gilt als leeres (Knopf „Anlegen“ trägt `data-arg=""`). Enter im Feld trägt den Wert des Felds
   * mit: derselbe Eintrag zweimal ist derselbe Auslöser, ein neuer Eintrag eine neue Aktion (schnelles Tippen, R00037).
   */
  function aktionsName(aktion, argument, wert) {
    const name = `aktion:${aktion}|${argument == null ? '' : argument}`;
    return wert === undefined ? name : name + WERT + wert;
  }

  Object.assign(ziel, { sperreFuehren, ausloeserName, aktionsName });
})(typeof module !== 'undefined' ? module.exports : window);
