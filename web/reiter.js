/* kanbanD — Ansichten des Aufgabenfensters (R00105, R00127, R00145): welche Ansichten eine Aufgabe trägt, in Anzeigereihenfolge.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. Auslöser und Menü zeichnet web/ansicht.js (vAnsichtWahl),
   der Rückfall auf „Inhalt“ steht in web/kosten.js (reiterRueckfall) — beide bauen auf diesen Schlüsseln auf. */
(function (ziel) {
  /** Ansichts-Schlüssel und Beschriftungen in Anzeigereihenfolge (R00145): „Kosten“ steht bedingt direkt hinter „Datei“ (R00105),
      „Verlauf“ ist immer letzter (R00123). „Anhänge“ ist keine Ansicht mehr: die Liste steht im Inhalt (R00145 FA 11/13). */
  const REITER = [['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['details', 'Details'], ['datei', 'Datei'], ['kosten', 'Kosten'], ['verlauf', 'Verlauf']];
  /** Die Ansichten einer Aufgabe: „Kosten“ nur, wenn sie ein Preisetikett trägt (R00105). */
  const reiterDerAufgabe = a => REITER.filter(([k]) => k !== 'kosten' || a.cost);
  /** Die Schlüssel der sichtbaren Ansichten — Zuhause der generischen Rückfallregel (R00145 FA 2). */
  const reiterSchluessel = a => reiterDerAufgabe(a).map(([k]) => k);

  Object.assign(ziel, { REITER, reiterDerAufgabe, reiterSchluessel });
})(typeof module !== 'undefined' ? module.exports : window);
