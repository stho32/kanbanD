// Name der offenen Seite für Seitenknopf und Seitenüberschrift (R00101, R00113 ADR-0018 Regel 2); lädt in Browser und Node.
(function (ziel) {
  "use strict";

  /** Namen der Berichte wie im Menü „Berichte“, je Route unter #/berichte/. */
  const BERICHTSNAMEN = {
    stundenzettel: 'Stundenzettel',
    kreuz: 'Zeiten nach Aufgabe und Person',
    verlauf: 'Burndown',
    fluss: 'Kumulativer Fluss',
    durchsatz: 'Durchsatz',
    prognose: 'Wie lange noch',
    fieber: 'Projekt-Fever-Chart',
    durchlauf: 'Durchlaufzeit',
    bestand: 'Bestand nach Labels',
    kosten: 'Kosten',
  };

  function seitenNameVon(ansicht) {
    if (ansicht === 'aufgaben') return 'Aufgaben';
    if (ansicht === 'personen') return 'Personen';
    if (ansicht.startsWith('berichte')) return 'Berichte';
    if (ansicht === 'einrichten') return 'Einrichten';
    if (ansicht === 'review') return 'Review';
    if (ansicht === 'lauf') return 'Lauf';
    return 'Board';
  }

  /** Was hinter dem Seitennamen steht: Boardtitel oder Berichtsname; leer, wenn nichts dazugehört. */
  function zusatz({ ansicht, boardTitel }) {
    const name = seitenNameVon(ansicht);
    if (name === 'Board') return boardTitel;
    if (name === 'Berichte') return BERICHTSNAMEN[ansicht.slice('berichte/'.length)];
    return '';
  }

  /** Text der verborgenen Überschrift erster Ebene: „Board · Entwicklung“, „Berichte · Burndown“, im ersten Start „Einrichten“. */
  function seitenUeberschrift(seite) {
    if (seite.ersterStart) return 'Einrichten';
    if (seite.ansicht === 'review' && seite.review) return seite.review.kurz ? `Review #${seite.review.nummer} · ${seite.review.kurz}` : `Review #${seite.review.nummer}`;
    const teile = [seitenNameVon(seite.ansicht), zusatz(seite)].filter(Boolean);
    return teile.join(' · ');
  }

  /** Fenstertitel aus derselben Namensquelle wie die Seitenüberschrift: Zähler laufender Timer vorn, „ — kanbanD“ hinten. */
  function fenstertitelName(seite, { zaehler = 0 } = {}) {
    const ueberschrift = seitenUeberschrift(seite);
    if (zaehler) return `(${zaehler} ▶) ${ueberschrift} — kanbanD`;
    return `${ueberschrift} — kanbanD`;
  }

  Object.assign(ziel, { BERICHTSNAMEN, seitenNameVon, seitenUeberschrift, fenstertitelName });
})((typeof module !== 'undefined' && module.exports) || window);
