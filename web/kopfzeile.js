/* Kopfzeile nach den Breakpoints von Material 3 (R00101). Läuft im Browser und unter Node (Einheitstests). */
(function (ziel) {
  "use strict";

  /** M3-Fensterklassen; die Grenzen stehen nur hier, das CSS richtet sich nach `data-stufe` der Kopfzeile. */
  function stufeAusBreite(breiteInPx) {
    if (breiteInPx >= 1200) return 'large';
    if (breiteInPx >= 840) return 'expanded';
    if (breiteInPx >= 600) return 'medium';
    return 'compact';
  }

  /**
   * Welche Elemente in welcher Zeile der Kopfzeile stehen und welche im Menü „Mehr“.
   * `luecke` schiebt alles Folgende an den rechten Rand. „Neue Aufgabe“ und der Bereich wandern nie ins Menü.
   */
  function kopfPlaetze(stufe, ansicht) {
    const werkzeug = werkzeugDerAnsicht(ansicht, stufe);
    const status = ['luecke', 'lauf', 'live', 'ich'];
    if (stufe === 'large') return { reihen: [['board', 'navigation', ...werkzeug, ...status, 'mehr']], mehr: mehrDerAnsicht(ansicht) };
    if (stufe === 'expanded') return { reihen: ohneLeere([['board', 'navigation', ...status, 'mehr'], werkzeug]), mehr: mehrDerAnsicht(ansicht) };
    if (stufe === 'medium') return { reihen: [['board', 'navigation', 'luecke', 'mehr'], [...werkzeug, ...status]], mehr: mehrDerAnsicht(ansicht) };
    if (stufe === 'compact') {
      const direkt = werkzeug.filter(k => k === 'neu');
      const unten = werkzeug.filter(k => k !== 'neu');
      return { reihen: ohneLeere([['board', 'seitenmenue', ...direkt, ...status, 'mehr'], unten]), mehr: [...mehrDerAnsicht(ansicht), 'lauf', 'ich'] };
    }
    throw new Error(`Unbekannte Stufe der Kopfzeile: ${stufe}`);
  }

  function werkzeugDerAnsicht(ansicht, stufe) {
    const bereichAlsChips = stufe === 'compact' || stufe === 'medium';
    if (ansicht === 'board' && bereichAlsChips) return ['filter', 'bereichChips', 'neu'];
    if (ansicht === 'board') return ['filter', 'bereich', 'neu'];
    if (ansicht === 'aufgaben') return ['filter', 'listenbereich'];
    if (ansicht === 'sonst') return [];
    throw new Error(`Unbekannte Ansicht der Kopfzeile: ${ansicht}`);
  }

  function mehrDerAnsicht(ansicht) {
    if (ansicht === 'board') return ['signale', 'spalten', 'darstellung'];
    return ['darstellung'];
  }

  function ohneLeere(reihen) {
    return reihen.filter(reihe => reihe.length > 0);
  }

  Object.assign(ziel, { stufeAusBreite, kopfPlaetze });
})(typeof module !== 'undefined' ? module.exports : window);
