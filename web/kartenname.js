/* kanbanD — zugänglicher Name einer Karte (R00113, ADR-0018 Regel 3): reine Funktionen, im Browser und in Node nutzbar.
   Der Name ist Klartext ohne Datum; eine bekannte Klasse nennt ihre Bezeichnung, eine fremde ihren Schlüssel hinter dem
   Wort „Klasse“ (R00195 AK 6). Maskiert wird erst beim Einsetzen ins Attribut. */
(function (ziel) {
  "use strict";

  /** Die Klasse im Namen: die Bezeichnung aus dem Klassenvorrat `klassen`; kennt er den Schlüssel nicht, ist die Klasse fremd
      und heißt „Klasse <schlüssel>“ — das Wort unterscheidet den Schlüssel von einer Bezeichnung. Ohne Klasse und ohne
      bekannten Vorrat (`klassen` fehlt: kanbanD.md ist defekt) steht nichts. */
  function klasseImNamen(schluessel, klassen) {
    if (!schluessel || !klassen) return '';
    const gefunden = klassen.find(k => k.schluessel === schluessel);
    if (!gefunden) return `Klasse ${schluessel}`;
    return gefunden.bezeichnung;
  }

  /** `#<nr> <Titel>[, <Bezeichnung der Klasse> | Klasse <Schlüssel>][, <Zusatz>…][, ausgewählt]`. `zusaetze` ist eine Liste
      von Zusätzen in fester Reihenfolge (Timer, dann Alter); eine Zeichenkette gilt als deren einziges Element, leere Teile
      fallen samt Komma weg. */
  function kartenName({ nummer, titel, klasse }, klassen, gewaehlt, zusaetze) {
    const teile = [`#${nummer} ${titel}`];
    const klassenteil = klasseImNamen(klasse, klassen);
    if (klassenteil) teile.push(klassenteil);
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
