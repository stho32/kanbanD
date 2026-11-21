/* kanbanD — Ansicht „Läufe“ (R00219, ADR-0039): Transkripte aus GET /api/aufgaben/{nr}/transkripte und die Kosteneinträge
   der Aufgabe je Lauf zu einer Zeile. Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar wie commits.js.
   Fremder Text (Rolle, Spalte) geht hier unverändert durch; maskiert wird erst beim Zeichnen. */
(function (ziel) {
  'use strict';
  const { zeitMs } = typeof module !== 'undefined' ? require('./zeiten.js') : window;

  /** Je Lauf eine Zeile `{kennung, at, role, column, transkript, kosten}`, neueste zuerst. Schlüssel ist allein die `kennung`
      des Servers als Text — die Spalte zählt nicht; Doppel paaren sich der Reihe nach, ein Teil ohne Partner steht allein. */
  function laeufe(transkripte, kosteneintraege) {
    const offeneKosten = kostenNachKennung(kosteneintraege);
    const mitTranskript = transkripte.map(t => zeileMitTranskript(t, naechsteKosten(offeneKosten, t.kennung)));
    const ohneTranskript = kosteneintraege.filter(k => nochOffen(offeneKosten, k)).map(zeileOhneTranskript);
    return neuesteZuerst([...mitTranskript, ...ohneTranskript]);
  }

  const hatKennung = eintrag => typeof eintrag.kennung === 'string';

  /** Kosteneinträge mit Kennung je Kennung als Warteschlange in Dateireihenfolge. */
  function kostenNachKennung(kosteneintraege) {
    const nachKennung = new Map();
    for (const k of kosteneintraege.filter(hatKennung)) {
      if (!nachKennung.has(k.kennung)) nachKennung.set(k.kennung, []);
      nachKennung.get(k.kennung).push(k);
    }
    return nachKennung;
  }

  /** Der erste noch freie Kosteneintrag dieser Kennung, aus der Warteschlange genommen; ohne Kennung nie einer. */
  function naechsteKosten(offeneKosten, kennung) {
    if (typeof kennung !== 'string') return null;
    const warteschlange = offeneKosten.get(kennung);
    if (!warteschlange || !warteschlange.length) return null;
    return warteschlange.shift();
  }

  /** Ohne Kennung bleibt ein Kosteneintrag immer allein; mit Kennung, solange kein Transkript ihn genommen hat. */
  const nochOffen = (offeneKosten, k) => !hatKennung(k) || offeneKosten.get(k.kennung).includes(k);

  const kostenteil = k => ({ amount: k.amount, currency: k.currency, tokens: k.tokens ?? null, column: k.column });

  const zeileMitTranskript = (t, k) => ({
    kennung: t.kennung ?? null, at: t.at ?? null, role: t.role ?? null, column: t.column ?? null,
    transkript: { bytes: t.bytes ?? null, zustand: t.zustand }, kosten: k ? kostenteil(k) : null,
  });

  const zeileOhneTranskript = k => ({
    kennung: hatKennung(k) ? k.kennung : null, at: k.at, role: k.role, column: k.column,
    transkript: null, kosten: kostenteil(k),
  });

  /** Zeitpunkt der Kennung `role@JJJJ-MM-TTTHH:MM±HH:MM` in ms; ohne Kennung `null`. */
  function kennungMs(kennung) {
    if (typeof kennung !== 'string') return null;
    const ms = zeitMs(kennung.slice(kennung.lastIndexOf('@') + 1).replace('T', ' '));
    return Number.isNaN(ms) ? null : ms;
  }

  /** Neueste zuerst nach der Kennung, Gleichstand in der Reihenfolge der Eingabe (stabil), ohne Zeitpunkt ans Ende. */
  function neuesteZuerst(zeilen) {
    const mitZeit = zeilen.map(z => [z, kennungMs(z.kennung)]);
    const datiert = mitZeit.filter(([, ms]) => ms !== null).sort((a, b) => b[1] - a[1]).map(([z]) => z);
    const undatiert = mitZeit.filter(([, ms]) => ms === null).map(([z]) => z);
    return [...datiert, ...undatiert];
  }

  Object.assign(ziel, { laeufe });
})(typeof module !== 'undefined' ? module.exports : window);
