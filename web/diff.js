/* kanbanD — Review-Seite eines Commits (R00207, ADR-0033): reine Rechnung, im Browser und in Node (Unit-Tests) nutzbar wie commits.js.
   Fremder Text geht hier unverändert durch; maskiert wird erst beim Zeichnen (esc). */
(function (ziel) {
  'use strict';

  /** Zustände der Liste, zu denen es einen Diff gibt (ADR-0033 Punkt 2). */
  const MIT_DIFF = ['auf_zweig', 'verwaist'];

  /** Folge der Review-Seite aus der Liste `GET …/commits` und dem vollen Hash der Diff-Antwort (ADR-0033 Punkte 2 und 9):
      gezählt wird über die Einträge mit Diff in der Reihenfolge der Antwort, „i“ nie aus dem Text der Adresse (Rand a).
      Arten: `folge` {i, n, zurueck, vor}, `fremd` (Rand b), `keine` (Rand c), `erster` (Adresse ohne Verweis). */
  function folge(eintraege, vollerHash) {
    const mitDiff = eintraege.filter(e => MIT_DIFF.includes(e.zustand) && e.hash);
    if (!mitDiff.length) return { art: 'keine', eintraege };
    const erster = mitDiff[0].verweis;
    if (!vollerHash) return { art: 'erster', erster };
    const stelle = mitDiff.findIndex(e => e.hash.toLowerCase() === vollerHash.toLowerCase());
    if (stelle < 0) return { art: 'fremd', erster };
    const nachbar = k => (mitDiff[k] ? mitDiff[k].verweis : null);
    return { art: 'folge', i: stelle + 1, n: mitDiff.length, zurueck: nachbar(stelle - 1), vor: nachbar(stelle + 1), erster };
  }

  Object.assign(ziel, { folge });
})(typeof module !== 'undefined' ? module.exports : window);
