/* kanbanD — Deutung des Labels `braucht:<n>` im Browser (R00259, ADR-0035 N1.4): dieselbe Regel wie der Server
   (`src/modell/braucht.rs`, `deuten`/`braucht_nummern`). Reine Funktionen, im Browser und in Node nutzbar, ohne DOM und Netz. */
(function (ziel) {
  "use strict";

  const PRAEFIX = 'braucht:';

  /** Die Nummer eines Labels `braucht:<n>` — ohne Groß/Klein, `n` eine ganze Zahl ≥ 1 ohne führende Null und ohne
      Leerzeichen (nach dem Trimmen); sonst null (kein Präfix oder andere Form). Wie die Deutung des Servers: der Browser
      unterscheidet „kein Träger" und „falsche Form" nicht, beide bleiben gewöhnliche Labels (ADR-0035 Punkt 1). */
  function nummerAusLabel(label) {
    const text = String(label == null ? '' : label).trim();
    if (text.slice(0, PRAEFIX.length).toLowerCase() !== PRAEFIX) return null;
    const rest = text.slice(PRAEFIX.length);
    if (!/^[1-9][0-9]*$/.test(rest)) return null;
    const nummer = Number(rest);
    return Number.isSafeInteger(nummer) ? nummer : null;
  }

  /** Die gedeuteten Nummern in Label-Reihenfolge; dieselbe Nummer einmal (beim ersten Vorkommen). */
  function brauchtNummern(labels) {
    const gesehen = new Set(), nummern = [];
    for (const label of labels || []) {
      const nummer = nummerAusLabel(label);
      if (nummer !== null && !gesehen.has(nummer)) { gesehen.add(nummer); nummern.push(nummer); }
    }
    return nummern;
  }

  /** Die Labels, die keine Abhängigkeit tragen — was das Label-Feld zeigt (ADR-0035 N1.5). */
  function uebrigeLabels(labels) {
    return (labels || []).filter(label => nummerAusLabel(label) === null);
  }

  /** Alle Labels der Liste, die auf `nummer` deuten — für das × (ADR-0035 N1.6), jede Schreibweise und Größe. */
  function labelsDerNummer(labels, nummer) {
    return (labels || []).filter(label => nummerAusLabel(label) === nummer);
  }

  /** Der Zusatz im zugänglichen Namen der Karte (R00259 AK 1/3/4): „wartet auf #1, #2", bei fehlender Datei „…, fehlt".
      Erledigte Abhängigkeiten erscheinen nicht; ohne offene Abhängigkeit nichts. */
  function wartetZusatz(braucht) {
    const offen = (braucht || []).filter(b => b && !b.erledigt);
    if (!offen.length) return '';
    const text = 'wartet auf ' + offen.map(b => '#' + b.nummer).join(', ');
    return offen.some(b => b.titel == null) ? text + ', fehlt' : text;
  }

  Object.assign(ziel, { nummerAusLabel, brauchtNummern, uebrigeLabels, labelsDerNummer, wartetZusatz });
})((typeof module !== 'undefined' && module.exports) || window);
