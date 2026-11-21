/* kanbanD — Laufansicht (R00221, ADR-0041): Zeilen eines entpackten Transkripts im Strom lesen und prüfen. Reine Funktionen,
   im Browser und in Node (Unit-Tests) nutzbar wie laeufe.js. Fremder Text geht hier unverändert durch; maskiert wird beim Zeichnen. */
(function (ziel) {
  'use strict';
  const { markdownHtml } = typeof module !== 'undefined' ? require('./markdown.js') : window;
  const { sichtbarHtml, sichtbarText } = typeof module !== 'undefined' ? require('./diff.js') : window;

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

  /* ── Zeichnen (FA 6, FA 10, Zeichnung D0009 `#laufansicht`): HTML-Text der Einträge, einmal je erfolgreichem Lesen. ── */

  const ENDE = 'Ende des Transkripts';
  const GRENZE_ERREICHT = 'Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.';
  const nichtLesbar = nr => `Zeile ${nr} des Transkripts ist nicht lesbar.`;
  const WER_WORT = { agent: 'Agent', mensch: 'Mensch', werkzeug: 'Werkzeug' };
  const ART_WORT = { werkzeugaufruf: 'Aufruf', werkzeugergebnis: 'Ergebnis' };
  const ERSTE_ZEILE_ZEICHEN = 200;
  const ACHTUNG = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg>';
  const GRENZE_SYMBOL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16"/><path d="M4 15h3M10 15h4M17 15h3M4 20h3M10 20h4M17 20h3"/></svg>';
  const PFEIL = '<span class="pf"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></span>';
  const ART_SYMBOL = {
    werkzeugaufruf: '<span class="ic"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6l6 6-6 6M12 18h8"/></svg></span>',
    werkzeugergebnis: '<span class="ic"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v9h12M14 9l4 4-4 4"/></svg></span>',
  };

  /** Die Liste der Einträge `[{nr, eintrag}]` samt Schluss: „Ende des Transkripts“ oder, an der Grenze, Wortlaut 15. */
  function laufHtml(zeilen, grenze, esc) {
    const schluss = grenze
      ? `<li class="lv-g meld warn" role="note">${GRENZE_SYMBOL}<p>${GRENZE_ERREICHT}</p></li>`
      : `<li class="lv-ende">${ENDE}</li>`;
    return `<ol class="lv-l" id="lv-insel" data-ohne-rollstand aria-label="Einträge des Transkripts der Reihe nach">${zeilen.map(z => eintragHtml(z, esc)).join('')}${schluss}</ol>`;
  }

  function eintragHtml({ nr, eintrag }, esc) {
    if (!eintrag) return `<li class="lv-f meld fehl" role="note">${ACHTUNG}<p>${nichtLesbar(nr)}</p></li>`;
    if (eintrag.art === 'nachricht') return nachrichtHtml(eintrag, esc);
    return werkzeugHtml(eintrag, esc);
  }

  /** Nachricht offen: Kürzel, Name, Wer, Uhrzeit; der Text je Zeile sichtbar gemacht, dann Markdown (maskiert, ADR-0030). */
  function nachrichtHtml(e, esc) {
    const uhrzeit = uhrzeitText(e.zeit);
    const name = e.name === null ? '' : `<b>${sichtbarHtml(e.name, esc)}</b>`;
    const zeit = uhrzeit === null ? '' : `<span class="mono">${uhrzeit}</span>`;
    const text = markdownHtml(e.text.split('\n').map(sichtbarText).join('\n'), 1);
    return `<li class="lv-n ${e.wer}"><span class="pk ${PK_KLASSE[e.wer]}" aria-hidden="true">${esc(kuerzel(e))}</span><div class="lv-wer">${name}<span>${WER_WORT[e.wer]}</span>${zeit}</div><div class="lv-text">${text}</div></li>`;
  }

  const PK_KLASSE = { agent: 'pk-a', mensch: 'pk-m', werkzeug: 'pk-0' };
  /** Zwei Buchstaben aus dem Namen (zwei Wörter: je der erste), ohne Namen aus dem Wort für „wer“; nur Zierde, nie vorgelesen. */
  function kuerzel(e) {
    const woerter = sichtbarText(e.name === null ? WER_WORT[e.wer] : e.name).split(/\s+/).filter(Boolean);
    if (woerter.length > 1) return (Array.from(woerter[0])[0] + Array.from(woerter[1])[0]).toUpperCase();
    return Array.from(woerter[0] || '').slice(0, 2).join('').toUpperCase();
  }

  /** Werkzeugaufruf und -ergebnis eingeklappt: Name, Art, erste Zeile gekürzt, Uhrzeit; aufgeklappt der ganze Text, nie Markdown. */
  function werkzeugHtml(e, esc) {
    const uhrzeit = uhrzeitText(e.zeit);
    const name = e.name === null ? '' : sichtbarHtml(e.name, esc);
    const zeilen = e.text.split('\n');
    const zeit = uhrzeit === null ? '' : `<span class="zt">${uhrzeit}</span>`;
    const summary = `<summary>${PFEIL}${ART_SYMBOL[e.art]}<span class="nm">${name}<span>${ART_WORT[e.art]}</span></span><span class="z1">${sichtbarHtml(gekuerzt(zeilen[0]), esc)}</span>${zeit}</summary>`;
    return `<li class="lv-e"><details class="lv-w">${summary}<pre>${zeilen.map(z => sichtbarHtml(z, esc)).join('\n')}</pre></details></li>`;
  }

  function gekuerzt(zeile) {
    const zeichen = Array.from(zeile);
    if (zeichen.length <= ERSTE_ZEILE_ZEICHEN) return zeile;
    return zeichen.slice(0, ERSTE_ZEILE_ZEICHEN).join('') + '…';
  }

  const ISO_MIT_VERSATZ = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
  const zwei = n => String(n).padStart(2, '0');
  /** `zeit` nach ISO 8601 mit Versatz oder `Z` → `hh:mm:ss` in Ortszeit; jede andere Form ergibt null (die Angabe entfällt). */
  function uhrzeitText(zeit) {
    if (zeit === null || !ISO_MIT_VERSATZ.test(zeit)) return null;
    const d = new Date(zeit);
    if (Number.isNaN(d.getTime())) return null;
    return `${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`;
  }

  /* ── Zustände der Seite (FA 7, FA 8, FA 11; Bilder 2, 4, 5): Meldungen, Ansage und Rumpf ── */

  const LIEST = 'Liest das Transkript …';
  const FEHLT = 'Das Transkript liegt nicht auf diesem Rechner.';
  const FEHLT_ERKLAERUNG = 'Transkripte bleiben auf dem Rechner, auf dem sie abgelegt wurden; nach einem frischen Klon oder auf einem anderen Rechner fehlen sie. Der Lauf und seine Kosten stehen weiter an der Aufgabe.';
  const NICHT_GELESEN = 'Das Transkript ließ sich nicht lesen: ';
  const ohneBidi = text => String(text).replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

  /** Satz der Fehlermeldung (Wortlaut 19, PO Z. 490): Server mit `fehler` und Status; Verbindung und Frist; Entpacken und
      unbekannte Kennung ohne Status, ohne Text des Browsers und ohne Text der Adresse. */
  function laufFehlerText(fehler) {
    if (fehler.art === 'unbekannt') return NICHT_GELESEN + 'An dieser Aufgabe steht kein Lauf mit dieser Kennung.';
    if (fehler.art === 'entpacken') return NICHT_GELESEN + 'Die Datei lässt sich nicht entpacken.';
    if (fehler.art === 'verbindung') return NICHT_GELESEN + 'keine Verbindung zum Programm.';
    return `${NICHT_GELESEN}${ohneBidi(fehler.fehler || 'unbekannter Fehler')} (${fehler.status}).`;
  }

  /** Was der Statusbereich sagt: beim Lesen Wortlaut 14, danach den sichtbaren Satz des Ergebnisses, vorher nichts. */
  function laufAnsage(v) {
    if (v.laedt) return LIEST;
    if (!v.ergebnis) return '';
    if (v.ergebnis.art === 'eintraege') return v.ergebnis.grenze ? GRENZE_ERREICHT : ENDE;
    if (v.ergebnis.art === 'fehlt') return FEHLT;
    return laufFehlerText(v.ergebnis.fehler);
  }

  /** Rumpf der Seite aus dem Zustand `v = {laedt, ergebnis: null | {art: 'eintraege', html} | {art: 'fehlt'} | {art: 'fehler', fehler}}`.
      Einzige Live-Region ist der Statusbereich (PO Z. 481 b): sichtbar nur im ersten Lesen, sonst nur vorgelesen. Beim erneuten
      Lesen bleibt die Meldung stehen und „Erneut versuchen“ ist gesperrt (PO Z. 484 S-A). `insel` ist der Text der Einträge. */
  function laufRumpfHtml(v, insel, esc) {
    const sichtbar = v.laedt && !v.ergebnis;
    const status = `<p class="${sichtbar ? 'lv-laedt' : 'vh'}" id="lv-status" role="status">${esc(laufAnsage(v))}</p>`;
    const e = v.ergebnis;
    let inhalt = '';
    if (e && e.art === 'eintraege') inhalt = insel;
    if (e && e.art === 'fehlt') inhalt = `<div class="lv-leer"><p><b>${FEHLT}</b></p><p>${FEHLT_ERKLAERUNG}</p></div>`;
    if (e && e.art === 'fehler') {
      const knopf = `<button type="button" class="cl-knopf" id="lv-erneut"${v.laedt ? ' aria-disabled="true"' : ' data-act="lauf-erneut"'}>Erneut versuchen</button>`;
      inhalt = `<div class="cl-meld lv-ganz">${ACHTUNG}<p class="cl-meldtext">${esc(laufFehlerText(e.fehler))}</p>${knopf}</div>`;
    }
    return `<div class="lv-rumpf">${status}${inhalt}</div>`;
  }

  Object.assign(ziel, { zeilenLesen, eintragPruefen, laufHtml, laufFehlerText, laufAnsage, laufRumpfHtml, LAUF_GRENZEN });
})(typeof module !== 'undefined' ? module.exports : window);
