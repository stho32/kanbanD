/* kanbanD — genau ein Auslöser je Aktion (R00148, ADR-0025 Regel 1): der Sperrzustand, im Browser und in Node nutzbar. */
(function (ziel) {
  "use strict";

  /**
   * Führt die Menge der laufenden Auslöser über `laufend` — den Sichtzustand (`S.ui.laufend`, ADR-0007), damit die
   * Sperre das Neuzeichnen übersteht und nicht am DOM-Knoten hängt. Solange die Anfrage eines Schreib-Auslösers läuft,
   * hat derselbe Auslöser keine Wirkung; er endet mit der Antwort, auch bei einem Fehlschlag (ADR-0025 Regel 1/2).
   */
  function sperreFuehren(laufend = new Set()) {
    // Die Auslöser, die schon ihre sichtbare Sperrform zeigen (R00190): erst nach einer Frist gedämpft, mit dem Ende sofort nicht mehr
    const gedaempft = new Set();
    return {
      ...abfragen(laufend),
      starten: name => { laufend.add(name); },
      beenden: name => { laufend.delete(name); gedaempft.delete(name); },
      namen: () => [...laufend],
      /** Der laufende Auslöser `name` zeigt ab jetzt seine Sperrform; einen beendeten lässt es in Ruhe. */
      daempfen: name => { if (laufend.has(name)) gedaempft.add(name); },
      /** Dieselben Abfragen über die gedämpften Auslöser: welcher Knoten trägt die Sperrform? */
      gedaempft: () => abfragen(gedaempft),
    };
  }

  /** `laeuft` und `laeuftAktion` über eine Menge von Kennungen. */
  function abfragen(menge) {
    return {
      laeuft: name => menge.has(name),
      /** Läuft die Aktion `name` (aus `aktionsName` ohne Wert) — mit oder ohne Wert aus einem Feld? */
      laeuftAktion: name => [...menge].some(n => n === name || n.startsWith(name + WERT)),
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
