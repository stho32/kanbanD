/* kanbanD — Ansichten des Aufgabenfensters (R00105, R00127, R00145): welche Ansichten eine Aufgabe trägt, in Anzeigereihenfolge.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. Auslöser und Menü zeichnet web/ansicht.js (vAnsichtWahl),
   die eine Rückfallregel auf „Inhalt“ steht hier (rueckfallAnsicht); web/ansicht.js (ansichtDerAufgabe) und web/kosten.js
   (reiterRueckfall) rufen sie. */
(function (ziel) {
  /** Ansichts-Schlüssel und Beschriftungen in Anzeigereihenfolge (R00145): „Kosten“ steht bedingt direkt hinter „Datei“ (R00105),
      „Verlauf“ ist immer letzter (R00123). „Anhänge“ ist keine Ansicht mehr: die Liste steht im Inhalt (R00145 FA 11/13). */
  const REITER = [['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['details', 'Details'], ['datei', 'Datei'], ['kosten', 'Kosten'], ['verlauf', 'Verlauf']];
  /** Die Ansichten einer Aufgabe: „Kosten“ nur, wenn sie ein Preisetikett (R00105) oder einen Kosteneintrag (R00165) trägt. */
  const hatKosten = a => Boolean(a.cost) || (a.kosteneintraege || []).length > 0;
  const reiterDerAufgabe = a => REITER.filter(([k]) => k !== 'kosten' || hatKosten(a));
  /** Die Schlüssel der sichtbaren Ansichten — Zuhause der generischen Rückfallregel (R00145 FA 2). */
  const reiterSchluessel = a => reiterDerAufgabe(a).map(([k]) => k);
  /** Die gewählte Ansicht: der gemerkte Schlüssel, wenn die Aufgabe ihn führt, sonst „Inhalt“. Die eine Rückfallregel —
      gleich, ob „Kosten“ fehlt oder ein später gebauter bzw. entfallener Schlüssel („Anhänge“) gemeint ist. */
  const rueckfallAnsicht = (schluessel, tab) => schluessel.includes(tab) ? tab : 'inhalt';

  Object.assign(ziel, { REITER, reiterDerAufgabe, reiterSchluessel, rueckfallAnsicht });
})(typeof module !== 'undefined' ? module.exports : window);
