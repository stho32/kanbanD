/* kanbanD — zugänglicher Name einer Karte (R00113, ADR-0018 Regel 3): reine Funktionen, im Browser und in Node nutzbar.
   Der Name ist Klartext ohne Datum und ohne Klassenschlüssel; maskiert wird erst beim Einsetzen ins Attribut. */
(function (ziel) {
  "use strict";

  /** Bezeichnung der Klasse aus kanbanD.md; ein unbekannter Schlüssel ergibt keine. */
  function klassenBezeichnung(schluessel, klassen) {
    const gefunden = (klassen || []).find(k => k.schluessel === schluessel);
    if (!gefunden) return '';
    return gefunden.bezeichnung;
  }

  /** `#<nr> <Titel>[, <Bezeichnung der Klasse>][, <Zusatz>…][, ausgewählt]`. `zusaetze` ist eine Liste von Zusätzen in fester
      Reihenfolge (Timer, dann Alter); eine Zeichenkette gilt als deren einziges Element, leere Teile fallen samt Komma weg. */
  function kartenName({ nummer, titel, klasse }, klassen, gewaehlt, zusaetze) {
    const teile = [`#${nummer} ${titel}`];
    const bezeichnung = klassenBezeichnung(klasse, klassen);
    if (bezeichnung) teile.push(bezeichnung);
    if (zusaetze) {
      let liste = zusaetze;
      if (!Array.isArray(zusaetze)) liste = [zusaetze];
      for (const zusatz of liste) if (zusatz) teile.push(zusatz);
    }
    if (gewaehlt) teile.push('ausgewählt');
    return teile.join(', ');
  }

  const kartenNameDefekt = nummer => `#${nummer} Datei defekt, nur lesbar`;
  const kartenNameFehlt = nummer => `#${nummer} Aufgabe fehlt`;

  Object.assign(ziel, { kartenName, kartenNameDefekt, kartenNameFehlt });
})((typeof module !== 'undefined' && module.exports) || window);
