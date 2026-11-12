/* kanbanD — Reiterleiste des Aufgabenfensters (R00105, R00127): welche Reiter eine Aufgabe trägt, in Anzeigereihenfolge.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. Die Tastenwahl je Reiter liegt in web/tastatur.js
   (naechsterReiter), der Rückfall auf „Inhalt“ in web/kosten.js (reiterRueckfall) — beide bauen auf diesen Schlüsseln auf. */
(function (ziel) {
  /** Reiter-Schlüssel und Beschriftungen in Anzeigereihenfolge (R00127): „Kosten“ steht bedingt direkt hinter „Datei“ (R00105),
      „Verlauf“ ist immer letzter (R00123). */
  const REITER = [['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['anhaenge', 'Anhänge'], ['details', 'Details'], ['datei', 'Datei'], ['kosten', 'Kosten'], ['verlauf', 'Verlauf']];
  /** Die Reiter einer Aufgabe: „Kosten“ nur, wenn sie ein Preisetikett trägt (R00105). */
  const reiterDerAufgabe = a => REITER.filter(([k]) => k !== 'kosten' || a.cost);
  /** Die Schlüssel der sichtbaren Reiter — Zuhause der generischen Rückfallregel (R00127 S3). */
  const reiterSchluessel = a => reiterDerAufgabe(a).map(([k]) => k);

  Object.assign(ziel, { REITER, reiterDerAufgabe, reiterSchluessel });
})(typeof module !== 'undefined' ? module.exports : window);
