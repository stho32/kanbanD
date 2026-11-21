/* kanbanD — Laufansicht (R00221, ADR-0041): Zeilen eines entpackten Transkripts im Strom lesen und prüfen. Reine Funktionen,
   im Browser und in Node (Unit-Tests) nutzbar wie laeufe.js. Fremder Text geht hier unverändert durch; maskiert wird beim Zeichnen. */
(function (ziel) {
  'use strict';

  /** Grenze des Lesens (ADR-0041 Punkt 4): 16 MiB entpackt, gezählt vor dem Dekodieren, und 20.000 Zeilen — 10-mal der größte
      echte Lauf. Die Zahlen stehen nie in der Oberfläche (PO Z. 468). */
  const LAUF_GRENZEN = { bytes: 16777216, zeilen: 20000 };

  /** Byte-Stücke eines entpackten Stroms → je nicht leerer Zeile `{nr, eintrag}` (`eintrag` null, wenn die Zeile nicht lesbar
      ist), zum Schluss `{grenze}`. Getrennt wird nur an `\n`, gezählt ab 1, Leerraumzeilen zählen mit. An der Grenze endet das
      Lesen sofort — der Strom wird nicht weiter angefordert, eine angefangene Zeile entfällt. */
  async function* zeilenLesen(strom, grenzen) {
    const dekodierer = new TextDecoder('utf-8');
    let gelesen = 0, nr = 0, rest = '';
    for await (const stueck of strom) {
      const frei = grenzen.bytes - gelesen;
      const teil = stueck.length > frei ? stueck.subarray(0, frei) : stueck;
      gelesen += teil.length;
      const zeilen = zeilenTrennen(rest, dekodierer.decode(teil, { stream: true }));
      rest = zeilen.pop();
      for (const zeile of zeilen) {
        if (nr === grenzen.zeilen) { yield { grenze: true }; return; }
        nr++;
        if (zeile.trim()) yield { nr, eintrag: zeilePruefen(zeile) };
      }
      const amEnde = teil !== stueck || (nr === grenzen.zeilen && rest !== '');
      if (amEnde) { yield { grenze: true }; return; }
    }
    rest += dekodierer.decode();
    if (rest !== '') {
      if (nr === grenzen.zeilen) { yield { grenze: true }; return; }
      nr++;
      if (rest.trim()) yield { nr, eintrag: zeilePruefen(rest) };
    }
    yield { grenze: false };
  }

  /** `rest` + neuer Text → fertige Zeilen und als letztes Element der neue Rest. Gesucht wird nur im neuen Text, damit eine
      einzige riesige Zeile nicht bei jedem Stück ganz durchsucht wird. */
  function zeilenTrennen(rest, text) {
    const erstes = text.indexOf('\n');
    if (erstes < 0) return [rest + text];
    return [rest + text.slice(0, erstes), ...text.slice(erstes + 1).split('\n')];
  }

  function zeilePruefen(zeile) {
    try {
      return eintragPruefen(JSON.parse(zeile));
    } catch (_) {
      return null;
    }
  }

  const ARTEN = ['nachricht', 'werkzeugaufruf', 'werkzeugergebnis'];
  const WER = ['mensch', 'agent', 'werkzeug'];
  const textOderFehlt = (o, schluessel) => !(schluessel in o) || typeof o[schluessel] === 'string';

  /** Ein Eintrag nach dem Format (PO Z. 371) oder null: `art` und `wer` aus den festen Mengen, `text` als Text; `zeit` und `name`
      sind, wenn vorhanden, Text. Unbekannte Schlüssel fallen weg. */
  function eintragPruefen(o) {
    const objekt = typeof o === 'object' && o !== null && !Array.isArray(o);
    if (!objekt || !ARTEN.includes(o.art) || !WER.includes(o.wer) || typeof o.text !== 'string') return null;
    if (!textOderFehlt(o, 'zeit') || !textOderFehlt(o, 'name')) return null;
    return { art: o.art, wer: o.wer, text: o.text, zeit: 'zeit' in o ? o.zeit : null, name: 'name' in o ? o.name : null };
  }

  Object.assign(ziel, { zeilenLesen, eintragPruefen, LAUF_GRENZEN });
})(typeof module !== 'undefined' ? module.exports : window);
