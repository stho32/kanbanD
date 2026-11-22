/* kanbanD — Laufansicht (R00221, ADR-0041): Zeilen eines entpackten Transkripts im Strom lesen und prüfen. Reine Funktionen,
   im Browser und in Node (Unit-Tests) nutzbar wie laeufe.js. Fremder Text geht hier unverändert durch; maskiert wird beim Zeichnen. */
(function (ziel) {
  'use strict';
  const { markdownHtml } = typeof module !== 'undefined' ? require('./markdown.js') : window;
  const { sichtbarHtml, sichtbarText } = typeof module !== 'undefined' ? require('./diff.js') : window;
  const { geld, inCent } = typeof module !== 'undefined' ? require('./kosten.js') : window;
  const satz = typeof module !== 'undefined' ? require('./lauf-satz.js') : window;

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

  const KENNUNG_LAENGE = { min: 1, max: 256 };

  /** Die Kennung `schluessel` eines Eintrags der Art `art` (`id` am Aufruf, `zu` am Ergebnis): ein Text von 1 bis 256 Zeichen
      (`length`), sonst null — ein falsch geformtes Feld gilt als fehlend, der Eintrag bleibt lesbar (ADR-0041 N2). */
  function kennungLesen(o, art, schluessel) {
    if (o.art !== art) return null;
    const wert = o[schluessel];
    if (typeof wert !== 'string') return null;
    if (wert.length < KENNUNG_LAENGE.min || wert.length > KENNUNG_LAENGE.max) return null;
    return wert;
  }

  const TOKEN_SCHLUESSEL = ['ein', 'aus', 'cache_lesen', 'cache_schreiben'];

  /** `tokens` eines Eintrags von `agent` (ADR-0041 N3 Punkt 1): je Schlüssel eine ganze Zahl ≥ 0, ein fehlender oder falscher
      Wert zählt 0, unbekannte Schlüssel fallen weg; bleibt kein gültiger Wert, fehlt das Feld (null) — der Eintrag bleibt lesbar. */
  function tokensLesen(o) {
    if (o.wer !== 'agent') return null;
    const roh = o.tokens;
    const objekt = typeof roh === 'object' && roh !== null && !Array.isArray(roh);
    if (!objekt) return null;
    const tokens = { ein: 0, aus: 0, cache_lesen: 0, cache_schreiben: 0 };
    let gueltige = 0;
    for (const schluessel of TOKEN_SCHLUESSEL) {
      const wert = Object.prototype.hasOwnProperty.call(roh, schluessel) ? roh[schluessel] : undefined;
      if (!Number.isSafeInteger(wert) || wert < 0) continue;
      tokens[schluessel] = wert;
      gueltige++;
    }
    if (gueltige === 0) return null;
    return tokens;
  }

  /** Ein Eintrag nach dem Format (PO Z. 371) oder null: `art` und `wer` aus den festen Mengen, `text` als Text; `zeit` und `name`
      sind, wenn vorhanden, Text; `id` (nur am Aufruf) und `zu` (nur am Ergebnis) sind Kennungen oder null; `tokens` nur an
      Einträgen von `agent`, sonst null. Unbekannte Schlüssel fallen weg. */
  function eintragPruefen(o) {
    const objekt = typeof o === 'object' && o !== null && !Array.isArray(o);
    if (!objekt || !ARTEN.includes(o.art) || !WER.includes(o.wer) || typeof o.text !== 'string') return null;
    if (!textOderFehlt(o, 'zeit') || !textOderFehlt(o, 'name')) return null;
    return {
      art: o.art, wer: o.wer, text: o.text, zeit: 'zeit' in o ? o.zeit : null, name: 'name' in o ? o.name : null,
      id: kennungLesen(o, 'werkzeugaufruf', 'id'), zu: kennungLesen(o, 'werkzeugergebnis', 'zu'), tokens: tokensLesen(o),
    };
  }

  /* ── Zeichnen (FA 6, FA 10, Zeichnung D0009 `#laufansicht`): HTML-Text der Einträge, einmal je erfolgreichem Lesen. ── */

  const ENDE = 'Ende des Transkripts';
  const GRENZE_ERREICHT = 'Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.';
  const nichtLesbar = nr => `Zeile ${nr} des Transkripts ist nicht lesbar.`;
  const WER_WORT = { agent: 'Agent', mensch: 'Mensch', werkzeug: 'Werkzeug' };
  const ERSTE_ZEILE_ZEICHEN = 200;
  const ACHTUNG = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg>';
  const GRENZE_SYMBOL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16M4 10h16"/><path d="M4 15h3M10 15h4M17 15h3M4 20h3M10 20h4M17 20h3"/></svg>';
  const PFEIL = '<span class="pf"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg></span>';

  /* ── Budget für sichtbar gemachte Zeichen (FA 10, PO Z. 493): gezählt und gebucht nur in `zeichenBuchen`, gezeichnet wird nur,
     was gebucht ist. Grund: jedes Zeichen wird zu einer Marke von gut 250 Byte HTML — ohne Budget wüchse ein Lauf aus 3 MiB
     Steuerzeichen auf Millionen Knoten (Security-Review #210 Muss 1). ── */

  const ZEICHEN_JE_TEXT = 1000;
  const ZEICHEN_JE_LAUF = 10000;
  /** Was `sichtbarTeile` (diff.js) sichtbar macht — ohne `\n`, das hier die Zeilen trennt; ein Node-Test hält beide gleich. */
  const MARKIERBAR = '[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u200B-\u200D\u2028\u2029\u2060\uFEFF]';
  const tausender = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const restText = n => (n === 1 ? '… und 1 weiteres Steuerzeichen' : `… und ${tausender(n)} weitere Steuerzeichen`);

  /** Bucht die sichtbar zu machenden Zeichen eines Texts gegen `budget = {lauf, gebucht}`: höchstens 1.000 je Text und was der
      Lauf noch hat. Liefert `{vorher, rest, nachher, gezeigt}`: `vorher` bis zum ersten Zeichen über dem Budget, `rest` die Zahl
      der nicht gezeigten, `nachher` den übrigen Text ohne sie — kein nicht gezeigtes Zeichen bleibt im Text. */
  function zeichenBuchen(text, budget) {
    const frei = Math.min(ZEICHEN_JE_TEXT, budget.lauf);
    const suche = new RegExp(MARKIERBAR, 'g');
    let gezeigt = 0, schnitt = -1;
    for (let m = suche.exec(text); m; m = suche.exec(text)) {
      if (gezeigt === frei) { schnitt = m.index; break; }
      gezeigt++;
    }
    budget.lauf -= gezeigt;
    budget.gebucht += gezeigt;
    if (schnitt < 0) return { vorher: text, rest: 0, nachher: '', gezeigt };
    const ueber = text.slice(schnitt);
    const nachher = ueber.replace(new RegExp(MARKIERBAR, 'g'), '');
    return { vorher: text.slice(0, schnitt), rest: ueber.length - nachher.length, nachher, gezeigt };
  }

  /** Ein gebuchter Text: `teil(text)` zeichnet einen Abschnitt, dazwischen steht einmal die Zusammenfassung in der Farbe der Marken. */
  function gebuchtHtml(b, teil, esc) {
    if (!b.rest) return teil(b.vorher);
    return `${teil(b.vorher)}<span class="mk-rest">${esc(restText(b.rest))}</span>${teil(b.nachher)}`;
  }

  /** Fremder Text einer Zeile mit Marken; ohne zu markierendes Zeichen nur maskiert (ein langer Text wird nicht zerlegt). */
  const zeileHtml = (z, esc) => (new RegExp(MARKIERBAR).test(z) ? sichtbarHtml(z, esc) : esc(z));
  const zeilenHtml = (text, esc) => text.split('\n').map(z => zeileHtml(z, esc)).join('\n');

  /** Die Liste der Einträge `[{nr, eintrag}]` samt Schluss: „Ende des Transkripts“ oder, an der Grenze, Wortlaut 15. Aufruf und
      Ergebnis stehen als eine Zeile an der Stelle des Aufrufs, vor einem Eintrag steht seine Denk- oder Wartezeile (R00234 FA 6, FA 8).
      Jede Zeile ist mit `id="lv-s<Nr>"` ein Sprungziel. Je Aufruf ein Lauf und ein frisches Budget. */
  function laufHtml(zeilen, grenze, esc, auswertung = laufAuswerten(zeilen, grenze)) {
    const budget = { lauf: ZEICHEN_JE_LAUF, gebucht: 0 };
    const schluss = grenze
      ? `<li class="lv-g meld warn" role="note">${GRENZE_SYMBOL}<p>${GRENZE_ERREICHT}</p></li>`
      : `<li class="lv-ende">${ENDE}</li>`;
    const z = zeichenKontext(zeilen, auswertung, esc, budget);
    return `<ol class="lv-l" id="lv-insel" data-ohne-rollstand aria-label="Einträge des Transkripts der Reihe nach">${zeilen.map(zeile => zeileMitLueckeHtml(zeile, z)).join('')}${schluss}</ol>`;
  }

  /** Was das Zeichnen einer Zeile braucht: Schritte und Lücken nach Nummer, Ergebnisse, die zu einem Aufruf gehören, die
      Eingeklappten, die längste Dauer von „Längste Schritte“ (Maß der Balken) und die Einträge nach Nummer für die Partner. */
  function zeichenKontext(zeilen, a, esc, budget) {
    const schrittAm = new Map(a.schritte.map(s => [s.nr, s]));
    const gepaart = new Set(a.schritte.filter(s => s.aufruf && s.ergebnisNr !== null).map(s => s.ergebnisNr));
    const lueckeVor = new Map(a.luecken.map(l => [l.vorNr, l]));
    const eintragAm = new Map(a.schritte.filter(s => s.ergebnisNr !== null).map(s => [s.ergebnisNr, null]));
    for (const { nr, eintrag } of zeilen) if (eintragAm.has(nr)) eintragAm.set(nr, eintrag);
    const laengste = a.top3.length ? a.top3[0].dauer : null;
    const tokens = tokenKontext(a.tokens);
    return { schrittAm, gepaart, lueckeVor, eintragAm, eingeklappt: a.eingeklappt, laengste, tokens, esc, budget };
  }

  /** Neue Tokens je Träger (Nummer der Zeile) und die Folgezeilen einer Antwort aus der Auswertung; ohne `tokens` beide leer. */
  function tokenKontext(t) {
    if (t === null || t === undefined) return { neuAm: new Map(), folge: {} };
    return { neuAm: new Map(t.antworten.map(x => [x.nr, x.neu])), folge: t.folge };
  }

  /** Die Art einer Zeile für den Filter „Zeigen“ (FA 5): `n` Nachricht, `w` Werkzeug, `h` Systemhinweis. Eine Denk- oder Wartezeile
      hat die Art des Eintrags dahinter, denn ihre Lücke gehört ihm (ADR-0041 N1 Punkt 1). */
  function zeileArt(eintrag, eingeklappt) {
    if (!eintrag) return 'n';
    if (eintrag.art !== 'nachricht') return 'w';
    if (eingeklappt === 'systemhinweis') return 'h';
    return 'n';
  }

  /** Die Art als Attribut der Zeile; Nachrichten sind die Grundart und tragen keins (das CSS kennt sie als Zeile ohne Art). */
  function artAttribut(art) {
    if (art === 'n') return '';
    return ` data-art="${art}"`;
  }

  function zeileMitLueckeHtml(zeile, z) {
    const luecke = z.lueckeVor.get(zeile.nr);
    let davor = '';
    if (luecke) davor = lueckeHtml(luecke, z.laengste, artAttribut(zeileArt(zeile.eintrag, z.eingeklappt[zeile.nr])));
    return davor + eintragHtml(zeile, z);
  }

  const LUECKE_WORT = { denken: 'denkt', warten: 'wartet' };
  const LUECKE_KLASSE = { werkzeug: 'w', denken: 'd', warten: 't' };

  /** Denk- oder Wartezeile (FA 8): ein Listeneintrag, der sich mit seinem Text liest; Marke, Linie und Balken sind Schmuck. */
  function lueckeHtml(l, laengste, art) {
    const klasse = LUECKE_KLASSE[l.art];
    return `<li id="lv-s${l.vorNr}-vor" tabindex="-1" class="lv-d ${klasse}"${art}><span class="mk" aria-hidden="true"></span><span class="tx"><b>${dauerText(l.dauer)}</b> ${LUECKE_WORT[l.art]}</span><span class="ln" aria-hidden="true"></span><span class="du">${balkenHtml(l.dauer, laengste, klasse)}</span></li>`;
  }

  /** Balken der Dauer (FA 6): Anteil an der längsten Zeile von „Längste Schritte“, ganzzahlig, mindestens 2 %; ohne Maß keiner. */
  function balkenHtml(dauer, laengste, klasse) {
    if (dauer === null || laengste === null) return '';
    const anteil = laengste > 0 ? Math.round((dauer / laengste) * 100) : 0;
    return `<i class="${klasse}" style="width:${Math.max(2, anteil)}%" aria-hidden="true"></i>`;
  }

  function eintragHtml({ nr, eintrag }, z) {
    if (!eintrag) return `<li id="lv-s${nr}" tabindex="-1" class="lv-f meld fehl" role="note">${ACHTUNG}<p>${nichtLesbar(nr)}</p></li>`;
    if (eintrag.art === 'nachricht' && z.eingeklappt[nr]) return eingeklapptHtml(nr, eintrag, z.eingeklappt[nr], z.esc, z.budget);
    if (eintrag.art === 'nachricht') return nachrichtHtml(nr, eintrag, z);
    if (z.gepaart.has(nr)) return '';
    return schrittHtml(z.schrittAm.get(nr), eintrag, z);
  }

  /** Name mit Marken, gebucht; leer ohne Namen. */
  function nameHtml(name, esc, budget) {
    if (name === null) return '';
    return gebuchtHtml(zeichenBuchen(name, budget), z => zeileHtml(z, esc), esc);
  }

  /** Nachricht offen: Kürzel, Name, Wer, Uhrzeit, Token-Angabe; der Text je Zeile sichtbar gemacht, dann Markdown (maskiert,
      ADR-0030); trägt sie `tokens`, darunter die Zeile „Tokens“ mit den vier Werten (R00238 FA 7). */
  function nachrichtHtml(nr, e, z) {
    const { esc, budget } = z;
    const uhrzeit = uhrzeitText(e.zeit);
    const name = e.name === null ? '' : `<b>${nameHtml(e.name, esc, budget)}</b>`;
    const zeit = uhrzeit === null ? '' : `<span class="mono">${uhrzeit}</span>`;
    let vierWerte = '';
    if (e.wer === 'agent' && e.tokens) vierWerte = `<p class="lv-tokens"><span class="k">Tokens</span> <span class="lv-tk4">${vierWerteHtml(e.tokens)}</span></p>`;
    return `<li id="lv-s${nr}" tabindex="-1" class="lv-n ${e.wer}"><span class="pk ${PK_KLASSE[e.wer]}" aria-hidden="true">${esc(kuerzel(e))}</span><div class="lv-wer">${name}<span>${WER_WORT[e.wer]}</span>${zeit}${tokenAngabeHtml(nr, e, z.tokens)}</div><div class="lv-text">${nachrichtMitHinweisenHtml(e.text, esc, budget)}</div>${vierWerte}</li>`;
  }

  const IN_DER_ANTWORT_DARUEBER = 'Tokens in der Antwort darüber gezählt';
  const TOKENS_UNBEKANNT = 'Tokens unbekannt';

  /** Token-Angabe einer Zeile von `agent` (R00238 FA 6): am Träger die neuen Tokens, an einer Folgezeile der Antwort „–“ mit Verweis,
      sonst „–“ mit „Tokens unbekannt“; Zeilen anderer `wer` tragen keine. */
  function tokenAngabeHtml(nr, eintrag, tokens) {
    if (eintrag.wer !== 'agent') return '';
    const neu = tokens.neuAm.get(nr);
    if (neu !== undefined) return `<span class="tk">${neueTokensHtml(neu)}</span>`;
    if (tokens.folge[nr] !== undefined) return `<span class="tk">${ohneWert(IN_DER_ANTWORT_DARUEBER)}</span>`;
    return `<span class="tk">${ohneWert(TOKENS_UNBEKANNT)}</span>`;
  }

  const WERT_TRENNER = '<span aria-hidden="true"> · </span><span class="vh">, </span>';
  /** „Eingabe <n> · Cache-Schreiben <n> · Ausgabe <n> · Cache-Lesen <n>“, volle Zahlen; vorgelesen mit Kommata (UX S6). */
  function vierWerteHtml(t) {
    const werte = [['Eingabe', t.ein], ['Cache-Schreiben', t.cache_schreiben], ['Ausgabe', t.aus], ['Cache-Lesen', t.cache_lesen]];
    return werte.map(([wort, n]) => `${wort} ${tokenVoll(n)}`).join(WERT_TRENNER);
  }

  /** Text einer Nachricht oder des Berichts: gebucht, je Zeile sichtbar gemacht, dann Markdown (maskiert). */
  function nachrichtTextHtml(text, esc, budget) {
    return gebuchtHtml(zeichenBuchen(text, budget), markdownTeilHtml, esc);
  }

  /** Ein Abschnitt einer Nachricht: je Zeile sichtbar gemacht, dann Markdown (maskiert); leer bleibt leer. */
  function markdownTeilHtml(teil) {
    if (!teil) return '';
    return markdownHtml(teil.split('\n').map(sichtbarText).join('\n'), 1);
  }

  /** Text einer Nachricht in der Liste (R00240 FA 10): eingebettete Systemhinweise an ihrer Stelle eingeklappt, der Rest als Markdown.
      Reicht das Budget nicht für den ganzen Text, steht er wie bisher. */
  function nachrichtMitHinweisenHtml(text, esc, budget) {
    const b = zeichenBuchen(text, budget);
    if (b.rest) return gebuchtHtml(b, markdownTeilHtml, esc);
    return satz.systemhinweiseTrennen(text).map(t => {
      if (t.art === 'hinweis') return satz.systemhinweisHtml(t.text, z => zeileHtml(z, esc));
      return markdownTeilHtml(t.text);
    }).join('');
  }

  const EINGEKLAPPT_WORT = { auftrag: 'Auftrag', systemhinweis: 'Systemhinweis' };

  /** Auftrag und Systemhinweis (FA 9) eingeklappt an ihrer Stelle: Wort, erste Zeile, Uhrzeit; aufgeklappt der Text als Nachricht. */
  function eingeklapptHtml(nr, e, art, esc, budget) {
    const uhrzeit = uhrzeitText(e.zeit);
    const zeit = uhrzeit === null ? '' : `<span class="zt">${uhrzeit}</span>`;
    const klasse = art === 'systemhinweis' ? 'lv-e sys' : 'lv-e';
    const summary = `<summary>${PFEIL}<span class="nm">${EINGEKLAPPT_WORT[art]}</span><span class="z1">${kurzTextHtml(ersteZeileGekuerzt(e.text), esc)}</span>${zeit}</summary>`;
    return `<li id="lv-s${nr}" tabindex="-1"${artAttribut(zeileArt(e, art))}><details class="${klasse}">${summary}<div class="lv-text">${nachrichtTextHtml(e.text, esc, budget)}</div></details></li>`;
  }

  const PK_KLASSE = { agent: 'pk-a', mensch: 'pk-m', werkzeug: 'pk-0' };
  /** Zwei Buchstaben aus dem Namen (zwei Wörter: je der erste), ohne Namen aus dem Wort für „wer“; nur Zierde, nie vorgelesen. */
  function kuerzel(e) {
    const quelle = e.name === null ? WER_WORT[e.wer] : e.name.slice(0, 200).replace(new RegExp(MARKIERBAR, 'g'), '');
    const woerter = quelle.split(/\s+/).filter(Boolean);
    if (woerter.length > 1) return (Array.from(woerter[0])[0] + Array.from(woerter[1])[0]).toUpperCase();
    return Array.from(woerter[0] || '').slice(0, 2).join('').toUpperCase();
  }

  /** Werkzeugzeile (FA 6, FA 7): Aufruf samt Ergebnis an der Stelle des Aufrufs, oder einer allein. Eingeklappt Name, „parallel“,
      Befehl, Absicht, Kürzel des Ergebnisses und Dauer mit Balken; aufgeklappt der Block „Aufruf“ und darunter „Ergebnis“, gesetzt
      von `lauf-satz.js` (R00240), nie Markdown (Wortlaut 20). */
  function schrittHtml(s, eintrag, z) {
    const { esc, budget } = z;
    const aufruf = s.aufruf ? eintrag : null;
    const ergebnis = s.aufruf ? (s.ergebnisNr === null ? null : z.eintragAm.get(s.ergebnisNr)) : eintrag;
    const name = nameHtml(s.name, esc, budget) + (s.parallel ? '<span class="par">parallel</span>' : '');
    const aufrufGebucht = aufruf ? zeichenBuchen(aufruf.text, budget) : null;
    const ergebnisGebucht = ergebnis ? zeichenBuchen(ergebnis.text, budget) : null;
    const zeile = t => zeileHtml(t, esc);
    let ergebnisGesetzt = null;
    if (ergebnisGebucht && !ergebnisGebucht.rest) ergebnisGesetzt = satz.ergebnisSatz(ergebnis.text, zeile);
    const befehl = aufruf ? `<span class="bf">${kurzTextHtml(s.befehl || '', esc)}</span>` : '';
    const absicht = s.absicht === null ? '' : `<span class="ab">${kurzTextHtml(s.absicht, esc)}</span>`;
    const fehler = s.fehler ? `${ACHTUNG}<span class="vh">Fehler: </span>` : '';
    const kuerzelTeil = ergebnisGebucht ? `<span class="eg">${fehler}${kurzformHtml(ergebnisGesetzt, ergebnisGebucht, esc)}</span>` : '';
    let angabe = '', tokensGanz = '';
    if (aufruf) angabe = tokenAngabeHtml(s.nr, aufruf, z.tokens);
    if (aufruf && aufruf.wer === 'agent' && aufruf.tokens) tokensGanz = `<span class="k">Tokens</span><p class="lv-tk4">${vierWerteHtml(aufruf.tokens)}</p>`;
    const summary = `<summary>${PFEIL}<span class="nm">${name}</span>${befehl}${absicht}${kuerzelTeil}<span class="du">${schrittDauerHtml(s, aufruf, ergebnis, z.laengste)}</span>${angabe}</summary>`;
    const ganz = tokensGanz + aufrufBlockHtml(aufruf, aufrufGebucht, s.name, z) + ergebnisBlockHtml(aufruf, ergebnisGebucht, ergebnisGesetzt, esc);
    const klasse = `lv-s${s.fehler ? ' fehl' : ''}${s.absicht === null ? ' ohne-ab' : ''}`;
    let marken = artAttribut('w');
    if (s.fehler) marken += ' data-fehler';
    return `<li id="lv-s${s.nr}" tabindex="-1"${marken}><details class="${klasse}">${summary}<div class="lv-s-ganz">${ganz}</div></details></li>`;
  }

  /** Text, wie er heute aufgeklappt steht: gebucht, je Zeile sichtbar gemacht, in einem `pre` — der Rückfall jedes Satzes. */
  const rohHtml = (b, esc) => `<pre>${gebuchtHtml(b, t => zeilenHtml(t, esc), esc)}</pre>`;

  /** Block „Aufruf“ (FA 1, 13): Fläche, Rand, Kante und das Wort als erstes Kind; der Satz nur, wenn das Budget den ganzen Text trägt
      und die Grenzen ihn erlauben, sonst der Text wie heute. */
  function aufrufBlockHtml(aufruf, gebucht, name, z) {
    if (!aufruf) return '';
    let inhalt = null;
    if (!gebucht.rest) inhalt = satz.aufrufSatz(name, aufruf.text, t => zeileHtml(t, z.esc));
    if (inhalt === null) inhalt = rohHtml(gebucht, z.esc);
    return `<div class="lv-auf"><span class="k">Aufruf</span>${inhalt}</div>`;
  }

  /** „Ergebnis“ ohne Fläche darunter; ohne Ergebnis im Transkript unter dem Aufruf gedämpft der Satz dazu (PO Z. 612). */
  function ergebnisBlockHtml(aufruf, gebucht, gesetzt, esc) {
    if (!gebucht && aufruf) return `<p class="lv-gedaempft">${KEIN_ERGEBNIS}</p>`;
    if (!gebucht) return '';
    let inhalt = rohHtml(gebucht, esc);
    if (gesetzt !== null) inhalt = gesetzt.html;
    return `<div class="lv-erg"><span class="k">Ergebnis</span>${inhalt}</div>`;
  }
  const KEIN_ERGEBNIS = 'Kein Ergebnis im Transkript.';

  /** Kürzel des Ergebnisses in der Zusammenfassung (PO Z. 604, 605): „Von Claude Code gekürzt“ mit Symbol, gedämpft „Systemhinweis“
      oder die erste Zeile. */
  function kurzformHtml(gesetzt, gebucht, esc) {
    if (gesetzt !== null && gesetzt.kurz === 'gekuerzt') return satz.GEKUERZT_KURZ;
    if (gesetzt !== null && gesetzt.kurz === 'systemhinweis') return '<span class="lv-syseg">Systemhinweis</span>';
    return ersteZeileHtml(gebucht, esc);
  }

  /** Dauer der Werkzeugzeile mit Balken; „–“ mit Lesetext: ohne Partner „kein Ergebnis“ bzw. „kein Aufruf“, sonst „Dauer unbekannt“. */
  function schrittDauerHtml(s, aufruf, ergebnis, laengste) {
    if (s.dauer !== null) return `<span>${dauerText(s.dauer)}</span>${balkenHtml(s.dauer, laengste, 'w')}`;
    if (!ergebnis) return ohneWert('kein Ergebnis');
    if (!aufruf) return ohneWert('kein Aufruf');
    return ohneWert('Dauer unbekannt');
  }

  /** Karte „Bericht“ vor den Einträgen, außerhalb ihrer Liste (FA 5); ohne Bericht die gedämpfte Zeile. */
  function laufBerichtHtml(a, esc) {
    if (!a.bericht) return `<p class="lv-ohne-ber">${KEIN_BERICHT}</p>`;
    const budget = { lauf: ZEICHEN_JE_LAUF, gebucht: 0 };
    return `<article class="lv-ber ${a.bericht.ergebnis}" aria-labelledby="lv-ber-t"><h2 id="lv-ber-t">Bericht</h2><div class="lv-text">${nachrichtTextHtml(a.bericht.text, esc, budget)}</div></article>`;
  }
  const KEIN_BERICHT = 'Kein Bericht erkannt: Keine Nachricht des Agenten enthält eine Zeile „Ergebnis:“.';

  /** Die Gliederung links: „Längste Schritte“ (R00234 FA 10) und darunter „Teuerste Schritte“ (R00238 FA 8), beide aus
      `schrittListeHtml`, darunter `zeigen` (R00239 FA 8). Ohne Dauer entfällt die erste, ohne `tokens` die zweite; ohne beide steht
      `zeigen` allein, ohne alles entfällt der Abschnitt. */
  function laufTopHtml(a, esc, zeigen = '') {
    const listen = [];
    if (a.top3.length) listen.push(laengsteListe(a.top3, esc));
    if (a.teuer3 && a.teuer3.length) listen.push(teuersteListe(a.teuer3, esc));
    if (!listen.length && !zeigen) return '';
    if (!listen.length) return `<section class="lv-gl">${zeigen}</section>`;
    return `<section class="lv-gl" aria-labelledby="${listen.map(l => `${l.praefix}-t`).join(' ')}">${listen.map(schrittListeHtml).join('')}${zeigen}</section>`;
  }

  /* ── Filter „Zeigen“ (R00239 FA 5–7, FA 9; PO Z. 520 (10), 587, 588): Stand `{n, w, h, f}`, gewirkt wird über ein Attribut ── */

  /** Vorgabe beim Öffnen: Nachrichten und Werkzeuge an, Systemhinweise und „nur Fehler“ aus. */
  const FILTER_VORGABE = Object.freeze({ n: true, w: true, h: false, f: false });
  const FILTER_WORT = { n: 'Nachrichten', w: 'Werkzeuge', h: 'Systemhinweise', f: 'nur Fehler' };
  const ARTEN_DER_ZEILEN = ['n', 'w', 'h'];

  /** Das `fieldset` „Zeigen“: je Kästchen ein `data-act`; unter „nur Fehler“ sind die drei Arten gesperrt (Sperrform Z. 216,
      fokussierbar, ohne `data-act`) und behalten ihren Stand (Z. 588). */
  function laufFilterHtml(filter) {
    const kaestchen = art => {
      let wirkung = ` data-act="lauf-filter" data-arg="${art}"`;
      if (filter.f && art !== 'f') wirkung = ' aria-disabled="true"';
      let haken = '';
      if (filter[art]) haken = ' checked';
      return `<label><input type="checkbox" id="lv-f-${art}" data-filter="${art}"${wirkung}${haken}>${FILTER_WORT[art]}</label>`;
    };
    return `<fieldset class="lv-filt"><legend>Zeigen</legend>${[...ARTEN_DER_ZEILEN, 'f'].map(kaestchen).join('')}</fieldset>`;
  }

  /** Wert des Attributs `data-zeigen` an der Insel: die eingeschalteten Arten, durch Leerzeichen getrennt. */
  const laufZeigenWert = filter => ARTEN_DER_ZEILEN.filter(art => filter[art]).join(' ');

  /** Ansage nach einem Wechsel des Kästchens `geaendert` (PO Z. 587) aus den Zahlen der Auswertung, nie aus dem DOM; nach einem Wechsel
      von „Systemhinweise“ folgt die Zahl der eingebetteten Hinweise in den sichtbaren Zeilen (R00240 FA 10, PO Z. 608). */
  function laufFilterAnsage(arten, filter, geaendert, eingebettet) {
    const sichtbar = sichtbareZeilen(arten, filter, filter.f);
    const satzDerZeilen = zeilenAnsage(sichtbar, arten.n + arten.w + arten.h, filter.f);
    if (geaendert !== 'h' || sichtbar === 0 || !eingebettet) return satzDerZeilen;
    const e = sichtbareZeilen(eingebettet, filter, filter.f);
    if (e === 0) return satzDerZeilen;
    let zahl = `${tausender(e)} eingebettete Systemhinweise`;
    if (e === 1) zahl = '1 eingebetteter Systemhinweis';
    let zustand = 'ausgeblendet';
    if (filter.h) zustand = 'sichtbar';
    return `${satzDerZeilen.slice(0, -1)}, ${zahl} ${zustand}.`;
  }

  /** Summe der sichtbaren Zeilen bzw. Hinweise: unter „nur Fehler“ die der Fehlerzeilen, sonst die der eingeschalteten Arten. */
  function sichtbareZeilen(zahlen, filter, nurFehler) {
    if (nurFehler) return zahlen.fehler;
    return ARTEN_DER_ZEILEN.filter(art => filter[art]).reduce((summe, art) => summe + (zahlen[art] || 0), 0);
  }

  function zeilenAnsage(sichtbar, gesamt, nurFehler) {
    if (sichtbar === 0 && nurFehler) return 'Keine Fehler erkannt.';
    if (sichtbar === 0) return 'Keine Einträge sichtbar.';
    let wort = 'Einträgen';
    if (gesamt === 1) wort = 'Eintrag';
    return `${sichtbar} von ${gesamt} ${wort} sichtbar.`;
  }

  /** Vor dem Sprung in eine Zeile der Art `art` (FA 9): ist sie verborgen, erst „nur Fehler“ aus, dann ihre Art an; sonst bleibt der Stand. */
  function laufSprungFilter(filter, art, fehler) {
    let sichtbar = filter[art];
    if (filter.f) sichtbar = fehler;
    if (sichtbar) return filter;
    return { ...filter, f: false, [art]: true };
  }

  const KEINE_FEHLER = 'Keine Fehler erkannt. Erkannt werden ein Exit-Code ungleich 0 und Fehler des Werkzeugs.';
  /** An der Stelle der Einträge unter „nur Fehler“ ohne erkannten Fehler (FA 7, Bild 8): gedämpft, ohne Live-Rolle. */
  function laufKeineFehlerHtml(a, filter) {
    if (!filter.f || a.kennzahlen.fehler > 0) return '';
    return `<p class="lv-keinf">${KEINE_FEHLER}</p>`;
  }

  /** Eine Liste der Gliederung: Überschrift, wahlweise ein Erklärsatz, auf den die Liste mit `aria-describedby` zeigt, und je Eintrag
      ein Knopf `<praefix>-<i>`, der über `act` zu seiner Zeile springt — nie `href="#…"`, der Hash ist die Adresse (ADR-0029). */
  function schrittListeHtml({ praefix, titel, erklaerung, eintraege }) {
    let satz = '', beschrieben = '';
    if (erklaerung) {
      satz = `<p class="lv-erkl" id="${praefix}-erkl">${erklaerung}</p>`;
      beschrieben = ` aria-describedby="${praefix}-erkl"`;
    }
    const knoepfe = eintraege.map((e, i) => {
      const id = `${praefix}-${i + 1}`;
      if (!e.name) return `<li><button type="button" id="${id}" data-act="lauf-springe" data-arg="${e.ziel}">${e.inhalt}</button></li>`;
      return `<li><button type="button" id="${id}" data-act="lauf-springe" data-arg="${e.ziel}" aria-labelledby="${id}-n">${e.inhalt}<span class="vh" id="${id}-n">${e.name}</span></button></li>`;
    });
    return `<h2 id="${praefix}-t">${titel}</h2>${satz}<ol class="${praefix}"${beschrieben}>${knoepfe.join('')}</ol>`;
  }

  function laengsteListe(top3, esc) {
    const ziel = t => (t.schritt ? `lv-s${t.nr}` : `lv-s${t.nr}-vor`);
    const eintraege = top3.map(t => ({ ziel: ziel(t), inhalt: `${beschriftungHtml(beschriftungVon(t), esc)}<span class="d">${dauerText(t.dauer)}</span>` }));
    return { praefix: 'lv-top', titel: 'Längste Schritte', eintraege };
  }

  /** Die Beschriftung eines Eintrags; ein Eintrag ohne (von Hand gebaut) steht mit seinem Text wie vor R00240. */
  function beschriftungVon(t) {
    if (t.beschriftung) return t.beschriftung;
    let nach = null;
    if (t.nach !== undefined && t.nach !== null) nach = wort(t.nach, false);
    return { was: wort(t.was, false), absicht: null, nach };
  }

  /** Mit Absicht zweizeilig: die Absicht als Titel, darunter einzeilig gedämpft der Befehl; ohne Absicht der Befehl allein. */
  function beschriftungHtml(b, esc) {
    if (b.absicht === null) return `<span class="was">${wortHtml(b.was, esc)}</span>`;
    return `<span class="was zw"><span class="wt">${wortHtml(b.absicht, esc)}</span><span class="bf2">${wortHtml(b.was, esc)}</span></span>`;
  }

  const TEUERSTE_ERKLAERUNG = 'Gezählt sind die neuen Tokens je Antwort: Eingabe, Cache-Schreiben und Ausgabe. Den schon vorhandenen Kontext (Cache-Lesen) trägt jede Antwort, er zählt hier nicht.';

  /** „Teuerste Schritte“: Beschriftung, darunter gedämpft der Anlass, rechts die neuen Tokens; der Name des Knopfes ist
      „<Beschriftung>, <Wert in Lesefassung>, <nach …>“ (UX S3) — als eigener Lesetext, weil die Teile Blöcke sind. Ziel ist die
      Zeile, die die Tokens der Antwort trägt. */
  function teuersteListe(teuer3, esc) {
    const eintraege = teuer3.map(t => {
      const b = beschriftungVon(t);
      let nach = '';
      const name = [esc(sichtbarText((b.absicht || b.was).text)), neueTokensLesetext(t.neu)];
      if (b.nach !== null) {
        nach = `<span class="nach">${wortHtml(b.nach, esc)}</span>`;
        name.push(esc(sichtbarText(b.nach.text)));
      }
      return { ziel: `lv-s${t.nr}`, inhalt: `${beschriftungHtml(b, esc)}${nach}<span class="d">${neueTokensHtml(t.neu)}</span>`, name: name.join(', ') };
    });
    return { praefix: 'lv-teu', titel: 'Teuerste Schritte', erklaerung: TEUERSTE_ERKLAERUNG, eintraege };
  }

  /** Die erste Zeile eingeklappt, gekürzt auf 200 Zeichen, aus dem gebuchten Text; endet sie am Budget, folgt die Zusammenfassung.
      Ihre Zeichen sind schon im aufgeklappten Text als Marke gezählt: hier stehen sie nur als Text der Marke (`⟨U+202E⟩`), ohne
      eigenes Markenelement — so bleibt es bei höchstens 1.000 Marken je Text. */
  function ersteZeileHtml(b, esc) {
    const zeile = b.vorher.split('\n')[0];
    const amBudget = b.rest > 0 && zeile.length === b.vorher.length && Array.from(zeile).length <= ERSTE_ZEILE_ZEICHEN;
    const anfang = kurzTextHtml(gekuerzt(zeile), esc);
    if (!amBudget) return anfang;
    return `${anfang}<span class="mk-rest">${esc(restText(b.rest))}</span>`;
  }

  function gekuerzt(zeile) {
    const zeichen = Array.from(zeile);
    if (zeichen.length <= ERSTE_ZEILE_ZEICHEN) return zeile;
    return zeichen.slice(0, ERSTE_ZEILE_ZEICHEN).join('') + '…';
  }

  /** Hat `gekuerzt` diesen Text geschnitten? Nur dann hat er 201 Zeichen und endet auf „…“ — ein ungekürzter hat höchstens 200. */
  function vonKanbanGekuerzt(text) {
    if (text === null || text === undefined || !text.endsWith('…')) return false;
    return Array.from(text).length === ERSTE_ZEILE_ZEICHEN + 1;
  }

  const ELL_LESETEXT = 'Von kanbanD gekürzt, vollständig im aufgeklappten Schritt';
  /** Das „…“ von kanbanD (PO Z. 601, 610): eigenes, gedämpftes Element mit Tooltip; der Lesetext steht unsichtbar im Element. */
  const ELL = `<span class="lv-ell" title="${ELL_LESETEXT}"><span aria-hidden="true">…</span><span class="vh">${ELL_LESETEXT}</span></span>`;

  /** Ein Text der Zusammenfassung oder der Listen: maskiert und sichtbar gemacht; hat kanbanD ihn gekürzt, mit dem eigenen „…“. */
  function kurzTextHtml(text, esc) {
    if (!vonKanbanGekuerzt(text)) return esc(sichtbarText(text));
    return esc(sichtbarText(text.slice(0, -1))) + ELL;
  }

  function wortHtml(w, esc) {
    if (!w.gekuerzt) return esc(sichtbarText(w.text));
    return esc(sichtbarText(w.text.slice(0, -1))) + ELL;
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

  /* ── Auswertung (R00234, ADR-0041 N1 Punkte 1, 3, 4, 5): einmal je erfolgreichem Lesen, ein Durchlauf über die Zeilen ── */

  /** Ab dieser Lücke steht Denken oder Warten als eigene Zeile vor dem Eintrag (PO Z. 518); nie in der Oberfläche. */
  const DENKZEILE_AB_MS = 5000;

  /** `zeit` nach ISO 8601 mit Versatz oder `Z` → Millisekunden; jede andere Form ergibt null. */
  function zeitMs(zeit) {
    if (zeit === null || !ISO_MIT_VERSATZ.test(zeit)) return null;
    const ms = new Date(zeit).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  /** Wem die Lücke vor einem Eintrag gehört (FA 1): ein Ergebnis ist Werkzeug, sonst entscheidet `wer` (offene Frage 1). */
  function lueckenArt(eintrag) {
    if (eintrag.art === 'werkzeugergebnis' || eintrag.wer === 'werkzeug') return 'werkzeug';
    if (eintrag.wer === 'agent') return 'denken';
    return 'warten';
  }

  /** Gelesene Zeilen `[{nr, eintrag}]` und `grenze` → Dauer in ms je Art und gesamt, die Denk- und Wartelücken ab
      `DENKZEILE_AB_MS` (`luecken: [{vorNr, art, dauer}]`) und die Schritte (`schritte`, je Aufruf samt Ergebnis oder je Ergebnis
      ohne Aufruf, an der Stelle seiner ersten Zeile). Jede Lücke gehört dem späteren Eintrag mit Zeit, negativ zählt 0;
      `bekannt` ist falsch, wenn weniger als zwei Einträge eine Zeit tragen. */
  function laufAuswerten(zeilen, grenze) {
    const summe = { werkzeug: 0, denken: 0, warten: 0 };
    const luecken = [], schritte = [], offen = offeneAufrufe(), tokens = tokenZaehlung(), achse = zeitachseBeginnen(), arten = artenBeginnen();
    const einbettung = einbettungBeginnen(), vorSchritt = new Map();
    let vorher = null, mitZeit = 0;
    for (const { nr, eintrag } of zeilen) {
      if (!eintrag) { unlesbarZaehlen(tokens); arten.unlesbar++; continue; }
      if (eintrag.art === 'nachricht') arten.nachrichten++;
      const ms = zeitMs(eintrag.zeit);
      const schritt = eintrag.art === 'werkzeugaufruf' ? aufrufOeffnen(nr, eintrag, ms, offen) : null;
      if (schritt) schritte.push(schritt);
      const ergebnisSchritt = eintrag.art === 'werkzeugergebnis' ? ergebnisZuordnen(nr, eintrag, ms, offen, schritte) : null;
      tokensZaehlen(tokens, nr, eintrag, schritt, ergebnisSchritt);
      einbettungZaehlen(einbettung, nr, eintrag, ergebnisSchritt);
      if (ms === null) continue;
      mitZeit++;
      if (vorher !== null) {
        const dauer = Math.max(0, ms - vorher), art = lueckenArt(eintrag);
        summe[art] += dauer;
        stueckAnhaengen(achse, art, dauer);
        if (art !== 'werkzeug' && dauer >= DENKZEILE_AB_MS && eintrag.art === 'nachricht') arten.vorNachricht.push(nr);
        if (art !== 'werkzeug' && dauer >= DENKZEILE_AB_MS) luecken.push({ vorNr: nr, art, dauer, vor: schritt ? schrittText(schritt) : `Nachricht von ${eintrag.name || WER_WORT[eintrag.wer]}` });
        if (art !== 'werkzeug' && dauer >= DENKZEILE_AB_MS && schritt) vorSchritt.set(nr, schritt);
        if (art === 'warten' && dauer >= DENKZEILE_AB_MS) tokens.wartenSeit = dauer;
      } else achse.erste = ms;
      vorher = ms;
    }
    const gesamt = summe.werkzeug + summe.denken + summe.warten, bekannt = mitZeit >= 2;
    const kennzahlen = { werkzeugaufrufe: schritte.filter(s => s.aufruf).length, fehler: schritte.filter(s => s.fehler).length };
    const top3 = bekannt ? laengsteSchritte(schritte, luecken, vorSchritt) : [];
    const eingeklappt = eingeklapptFinden(zeilen);
    const wurzeln = wurzelnAusAuftrag(zeilen, eingeklappt);
    return { wurzeln, gesamt, ...summe, bekannt, grenze, luecken, schritte: schritte.map(s => schrittAbschliessen(s, offen.begonnen)), top3, kennzahlen, bericht: berichtFinden(zeilen), eingeklappt, tokens: tokensAbschliessen(tokens), teuer3: teuersteAbschliessen(tokens.teuer), zeitachse: zeitachseAbschliessen(achse, bekannt), zeilenArten: artenAbschliessen(arten, schritte.length, luecken.length, eingeklappt, kennzahlen.fehler), eingebettet: einbettungAbschliessen(einbettung, eingeklappt) };
  }

  /* ── Arten der Zeilen (R00239 FA 5): wie viele Zeilen der Liste Nachrichten, Werkzeuge und Systemhinweise sind, für die Ansage ── */

  function artenBeginnen() {
    return { nachrichten: 0, unlesbar: 0, vorNachricht: [] };
  }

  /** Je Art die Zahl der Zeilen, wie `laufHtml` sie zeichnet (`zeileArt`): jeder Schritt und jede Denk- oder Wartezeile vor einem
      Aufruf ist ein Werkzeug; eine Nachricht, eine unlesbare Zeile und eine Denk- oder Wartezeile vor einer Nachricht sind Nachrichten,
      außer der Systemhinweis und die Zeile davor; `fehler` sind die Schrittzeilen mit Fehler. */
  function artenAbschliessen({ nachrichten, unlesbar, vorNachricht }, schritte, luecken, eingeklappt, fehler) {
    const hinweise = Object.values(eingeklappt).filter(art => art === 'systemhinweis').length;
    const vorHinweis = vorNachricht.filter(nr => eingeklappt[nr] === 'systemhinweis').length;
    return { n: nachrichten - hinweise + unlesbar + vorNachricht.length - vorHinweis, w: schritte + luecken - vorNachricht.length, h: hinweise + vorHinweis, fehler };
  }

  /* ── Eingebettete Systemhinweise (R00240 FA 10, PO Z. 608): je Art der Zeile, für die Ansage aus der Auswertung ── */

  function einbettungBeginnen() {
    return { w: 0, fehler: 0, nachrichten: [] };
  }

  /** Ein Ergebnis zählt in seiner Werkzeugzeile (und als Fehlerzeile, wenn sein Schritt einer ist), eine Nachricht in ihrer Zeile —
      gezählt wie `ergebnisSatz` und `nachrichtHtml` setzen, ohne zu setzen. */
  function einbettungZaehlen(z, nr, eintrag, ergebnisSchritt) {
    const anzahl = satz.systemhinweiseZaehlen(eintrag.text, eintrag.art === 'werkzeugergebnis');
    if (anzahl === 0) return;
    if (eintrag.art === 'nachricht') { z.nachrichten.push({ nr, anzahl }); return; }
    if (eintrag.art !== 'werkzeugergebnis') return;
    z.w += anzahl;
    if (ergebnisSchritt.fehler) z.fehler += anzahl;
  }

  /** `{n, w, fehler}`: eine eingeklappte Nachricht (Auftrag, Systemhinweis) zeigt ihren Text ungeteilt und zählt nicht. */
  function einbettungAbschliessen({ w, fehler, nachrichten }, eingeklappt) {
    const n = nachrichten.filter(x => !eingeklappt[x.nr]).reduce((summe, x) => summe + x.anzahl, 0);
    return { n, w, fehler };
  }

  /* ── Zeitachse (R00239 FA 1, FA 2; ADR-0041 N1 Punkt 2): Stücke im selben Durchlauf, Fächer danach in O(Stücke + 200) ── */

  /** Ab mehr als so vielen Stücken teilt die Zeitachse die Gesamtdauer in ebenso viele gleich lange Fächer (PO Z. 530). */
  const FAECHER = 200;
  /** Reihenfolge der Arten bei Gleichstand im Fach — dieselbe wie in Kopf, Legende und Lesetext. */
  const ACHSEN_ARTEN = ['werkzeug', 'denken', 'warten'];

  function zeitachseBeginnen() {
    return { erste: null, bisher: 0, stuecke: [] };
  }

  /** Eine Lücke der Art `art`: ab 1 ms ein Stück, das an ein gleichartiges davor anschließt; 0 ms trennt keine Stücke. */
  function stueckAnhaengen(achse, art, dauer) {
    if (dauer === 0) return;
    const letztes = achse.stuecke[achse.stuecke.length - 1];
    if (letztes && letztes.art === art) letztes.dauer += dauer;
    else achse.stuecke.push({ art, ab: achse.erste + achse.bisher, dauer });
    achse.bisher += dauer;
  }

  /** `{erste, gesamt, stuecke, faecher}` oder null: ohne bekannte Dauer und bei 0 ms gibt es keine Zeitachse (FA 4). */
  function zeitachseAbschliessen({ erste, bisher, stuecke }, bekannt) {
    if (!bekannt || bisher === 0) return null;
    let faecher = null;
    if (stuecke.length > FAECHER) faecher = faecherBilden(erste, bisher, stuecke);
    return { erste, gesamt: bisher, stuecke, faecher };
  }

  /** 200 gleich lange Fächer über die Gesamtdauer, je mit der Art, deren Stücke darin am meisten Zeit haben. Gerechnet in
      200-fachen Millisekunden: so sind Grenzen und Anteile ganze Zahlen, und ein Gleichstand ist ein echter. */
  function faecherBilden(erste, gesamt, stuecke) {
    const faecher = [];
    let j = 0, beginn = 0;
    for (let i = 0; i < FAECHER; i++) {
      const von = gesamt * i, bis = gesamt * (i + 1), anteil = { werkzeug: 0, denken: 0, warten: 0 };
      let k = j, ab = beginn;
      while (k < stuecke.length && ab < bis) {
        const ende = ab + stuecke[k].dauer * FAECHER;
        anteil[stuecke[k].art] += Math.min(ende, bis) - Math.max(ab, von);
        if (ende > bis) break;
        ab = ende;
        k++;
      }
      const art = ueberwiegendeArt(anteil);
      j = k;
      beginn = ab;
      faecher.push({ art, ab: erste + von / FAECHER, bis: erste + bis / FAECHER });
    }
    return faecher;
  }

  /** Die Art mit dem größten Anteil; bei Gleichstand die frühere in Werkzeuge, Denken, Warten (PO Z. 585). */
  function ueberwiegendeArt(anteil) {
    let sieger = ACHSEN_ARTEN[0];
    for (const art of ACHSEN_ARTEN) if (anteil[art] > anteil[sieger]) sieger = art;
    return sieger;
  }

  /* ── Tokens je Antwort (R00238, ADR-0041 N3 Punkte 2–5, N3.1): im selben Durchlauf, je Eintrag O(1) ── */

  /** Zustand des Durchlaufs: Summen, Antworten, Folgezeilen, die laufende Antwort, der Schritt, dessen Ergebnis unmittelbar davor
      stand, die Dauer der letzten gezeichneten Wartezeile seit der vorigen Antwort und die drei teuersten (Liste fester Länge). */
  function tokenZaehlung() {
    return { summe: 0, neu: 0, ein: 0, aus: 0, cache_lesen: 0, cache_schreiben: 0, antworten: [], folge: {}, laufend: null, nachSchritt: null, wartenSeit: null, teuer: [] };
  }

  /** Eine Antwort beginnt an einem Eintrag von `agent` mit `tokens` und umfasst die unmittelbar folgenden Einträge von `agent` ohne
      `tokens`; jeder andere Eintrag beendet sie. Ihr erster Aufruf beschriftet sie in „Teuerste Schritte“. */
  function tokensZaehlen(z, nr, eintrag, schritt, ergebnisSchritt) {
    const mitTokens = eintrag.tokens !== null && eintrag.tokens !== undefined;
    if (mitTokens) antwortBeginnen(z, nr, eintrag.tokens);
    else if (z.laufend !== null && eintrag.wer === 'agent') z.folge[nr] = z.laufend.nr;
    else z.laufend = null;
    if (z.laufend !== null && schritt !== null && z.laufend.ersterAufruf === null) z.laufend.ersterAufruf = schritt;
    z.nachSchritt = ergebnisSchritt;
  }

  /** Eine unlesbare Zeile beendet die laufende Antwort; danach stand kein Ergebnis mehr unmittelbar vor der nächsten. */
  function unlesbarZaehlen(z) {
    z.laufend = null;
    z.nachSchritt = null;
  }

  /** Neue Tokens = Eingabe + Cache-Schreiben + Ausgabe (N3 Punkt 4). `warten_davor` gilt nur ohne `nachNr` (N3.1); danach gilt die
      Wartezeile für keine weitere Antwort. */
  function antwortBeginnen(z, nr, tokens) {
    const neu = tokens.ein + tokens.cache_schreiben + tokens.aus;
    let nachNr = null, wartenDavor = z.wartenSeit;
    if (z.nachSchritt !== null) { nachNr = z.nachSchritt.nr; wartenDavor = null; }
    z.antworten.push({ nr, tokens, neu, nachNr, warten_davor: wartenDavor });
    for (const schluessel of TOKEN_SCHLUESSEL) z[schluessel] += tokens[schluessel];
    z.summe += tokens.ein + tokens.aus + tokens.cache_lesen + tokens.cache_schreiben;
    z.neu += neu;
    z.wartenSeit = null;
    z.laufend = { nr, neu, nachSchritt: z.nachSchritt, wartenDavor, ersterAufruf: null };
    teuerEinordnen(z.teuer, z.laufend);
  }

  const TEUERSTE = 3;
  /** Hält die teuersten Antworten absteigend nach neuen Tokens, bei Gleichstand die frühere zuerst — ohne alle zu sortieren. */
  function teuerEinordnen(teuer, antwort) {
    let stelle = teuer.findIndex(t => antwort.neu > t.neu);
    if (stelle < 0) stelle = teuer.length;
    if (stelle >= TEUERSTE) return;
    teuer.splice(stelle, 0, antwort);
    if (teuer.length > TEUERSTE) teuer.pop();
  }

  function tokensAbschliessen({ summe, neu, ein, aus, cache_lesen, cache_schreiben, antworten, folge }) {
    if (!antworten.length) return null;
    return { summe, neu, ein, aus, cache_lesen, cache_schreiben, antworten, folge };
  }

  /** Die teuersten in Worten: erster Aufruf oder „Nachricht von Agent“, dazu „nach <Schritt>“ oder „nach <Dauer> Warten“. */
  function teuersteAbschliessen(teuer) {
    return teuer.map(t => ({ nr: t.nr, neu: t.neu, was: antwortText(t), nach: anlassText(t), beschriftung: teuersteBeschriften(t) }));
  }

  function antwortText(antwort) {
    if (antwort.ersterAufruf === null) return 'Nachricht von Agent';
    return schrittText(antwort.ersterAufruf);
  }

  function anlassText(antwort) {
    if (antwort.nachSchritt !== null) return `nach ${schrittText(antwort.nachSchritt)}`;
    if (antwort.wartenDavor !== null) return `nach ${dauerText(antwort.wartenDavor)} Warten`;
    return null;
  }

  /** Die drei längsten Schritt-, Denk- und Wartezeilen, nach Dauer absteigend, bei Gleichstand die frühere Zeile zuerst — eine Denk-
      oder Wartezeile steht vor dem Eintrag `nr`, ein Schritt an seiner Stelle. */
  function laengsteSchritte(schritte, luecken, vorSchritt) {
    const zeilen = [
      ...luecken.map(l => ({ art: l.art, nr: l.vorNr, schritt: false, dauer: l.dauer, was: `${LUECKE_WORT[l.art]} · vor ${l.vor}`, stelle: l.vorNr - 0.5, quelle: vorSchritt.get(l.vorNr) || null })),
      ...schritte.filter(s => s.dauer !== null).map(s => ({ art: 'werkzeug', nr: s.nr, schritt: true, dauer: s.dauer, was: schrittText(s), stelle: s.nr, quelle: s })),
    ];
    zeilen.sort((a, b) => b.dauer - a.dauer || a.stelle - b.stelle);
    return zeilen.slice(0, 3).map(({ stelle, quelle, ...zeile }) => ({ ...zeile, beschriftung: laengsteBeschriften(zeile, quelle) }));
  }

  /* ── Beschriftung der Listen (R00240 FA 11, FA 12; PO Z. 599, 601): Wörter mit dem Wissen, ob kanbanD sie gekürzt hat ── */

  /** Ein Wort der Listen: `text` und ob er auf das „…“ von kanbanD endet. */
  const wort = (text, gekuerzt) => ({ text, gekuerzt });
  const schrittWort = s => wort(schrittText(s), vonKanbanGekuerzt(s.befehl));
  function absichtWort(s) {
    if (s === null || s.absicht === null) return null;
    return wort(s.absicht, vonKanbanGekuerzt(s.absicht));
  }

  /** Ein Schritt mit Absicht trägt sie als Titel, darunter den Befehl; eine Denk- oder Wartezeile behält ihren Text. */
  function laengsteBeschriften(l, quelle) {
    if (!l.schritt) return { was: wort(l.was, quelle !== null && vonKanbanGekuerzt(quelle.befehl)), absicht: null };
    return { was: schrittWort(quelle), absicht: absichtWort(quelle) };
  }

  /** Wie `teuersteAbschliessen`, mit der Absicht des ersten Aufrufs und „nach <Absicht>“, wenn der Schritt davor eine hat (PO Z. 599). */
  function teuersteBeschriften(t) {
    const aufruf = t.ersterAufruf;
    let was = wort(antwortText(t), false), nach = null;
    if (aufruf !== null) was = schrittWort(aufruf);
    if (t.nachSchritt !== null && t.nachSchritt.absicht !== null) nach = wort(`nach ${t.nachSchritt.absicht}`, vonKanbanGekuerzt(t.nachSchritt.absicht));
    else if (t.nachSchritt !== null) nach = wort(`nach ${schrittText(t.nachSchritt)}`, vonKanbanGekuerzt(t.nachSchritt.befehl));
    else if (anlassText(t) !== null) nach = wort(anlassText(t), false);
    return { was, absicht: absichtWort(aufruf), nach };
  }

  /** Ein Schritt in Worten: Werkzeug und Kurzbefehl, etwa „Bash ls Anforderungen“. */
  const schrittText = s => [s.name, s.befehl].filter(Boolean).join(' ');

  const ERGEBNIS_ZEILE = /^Ergebnis: (bestanden|befund|blockiert)/m;

  /** Der Bericht (N1 Punkt 5): der letzte Eintrag von `agent`, dessen Text — bei einem Aufruf ein Textwert seines JSON-Objekts —
      eine Zeile `Ergebnis: bestanden|befund|blockiert` trägt; dazu die Zahl der Kennungen in seiner Zeile `Commits:` oder null. */
  function berichtFinden(zeilen) {
    for (let i = zeilen.length - 1; i >= 0; i--) {
      const eintrag = zeilen[i].eintrag;
      if (!eintrag || eintrag.wer !== 'agent' || eintrag.art === 'werkzeugergebnis') continue;
      const text = berichtText(eintrag);
      if (text !== null) return { nr: zeilen[i].nr, text, ergebnis: ERGEBNIS_ZEILE.exec(text)[1], commits: commitsZaehlen(text) };
    }
    return null;
  }

  function berichtText(eintrag) {
    const objekt = eintrag.art === 'werkzeugaufruf' ? jsonObjekt(eintrag.text) : null;
    const texte = objekt === null ? [eintrag.text] : Object.values(objekt).filter(w => typeof w === 'string');
    return texte.find(t => ERGEBNIS_ZEILE.test(t)) || null;
  }

  function commitsZaehlen(text) {
    const zeile = /^Commits:(.*)$/m.exec(text);
    if (zeile === null) return null;
    return (zeile[1].match(/\b[0-9a-f]{7,40}\b/g) || []).length;
  }

  /** Auftrag (erste Nachricht von `mensch`) und Systemhinweise (Nachricht von `mensch`, die ohne führenden Leerraum mit
      `<system-reminder>` oder `[SYSTEM NOTIFICATION` beginnt) → `{<nr>: 'auftrag' | 'systemhinweis'}`. */
  function eingeklapptFinden(zeilen) {
    const eingeklappt = {};
    let auftragGefunden = false;
    for (const { nr, eintrag } of zeilen) {
      if (!eintrag || eintrag.art !== 'nachricht' || eintrag.wer !== 'mensch') continue;
      const anfang = eintrag.text.trimStart();
      if (!auftragGefunden) eingeklappt[nr] = 'auftrag';
      else if (anfang.startsWith('<system-reminder>') || anfang.startsWith('[SYSTEM NOTIFICATION')) eingeklappt[nr] = 'systemhinweis';
      auftragGefunden = true;
    }
    return eingeklappt;
  }

  /** Die Wurzeln der Pfad-Marken (R00242 FA 1) aus dem Auftrag, der ersten Nachricht von `mensch`; ohne Auftrag keine. */
  function wurzelnAusAuftrag(zeilen, eingeklappt) {
    const auftrag = zeilen.find(({ nr }) => eingeklappt[nr] === 'auftrag');
    if (auftrag === undefined) return [];
    return satz.pfadMarken(auftrag.eintrag.text);
  }

  /** Die offenen Aufrufe eines Laufs (ADR-0041 N2, G1): `alle` und `ohneId` sind Warteschlangen mit Kopfzeiger (gepaarte werden
      übersprungen, nie entfernt), `nachId` führt die Aufrufe mit Kennung — nur in einer `Map`, nie in einem Objekt. */
  function offeneAufrufe() {
    return { alle: [], alleKopf: 0, ohneId: [], ohneKopf: 0, nachId: new Map(), anzahl: 0, begonnen: 0 };
  }

  /** Ein Aufruf wird offen geführt; war bei seinem Beginn schon einer offen, laufen sie parallel (siehe `paarungAbschliessen`).
      Die erste `id` gilt, ein späterer Aufruf mit derselben `id` zählt als Aufruf ohne `id`. */
  function aufrufOeffnen(nr, eintrag, ms, offen) {
    const schritt = { nr, ergebnisNr: null, aufruf: true, name: eintrag.name, ...kurzbefehl(eintrag.text), dauer: null, parallel: offen.anzahl > 0, fehler: false, beginn: ms, laufendeNummer: offen.begonnen, gepaart: false };
    offen.begonnen++;
    offen.anzahl++;
    offen.alle.push(schritt);
    if (eintrag.id !== null && eintrag.id !== undefined && !offen.nachId.has(eintrag.id)) offen.nachId.set(eintrag.id, schritt);
    else offen.ohneId.push(schritt);
    return schritt;
  }

  /** Der älteste noch offene Aufruf einer Warteschlange oder null; der Kopfzeiger überspringt gepaarte, jeder höchstens einmal. */
  function aeltesterOffener(schlange, kopf) {
    let i = kopf;
    while (i < schlange.length && schlange[i].gepaart) i++;
    return { schritt: i < schlange.length ? schlange[i] : null, kopf: i };
  }

  /** Zu welchem offenen Aufruf ein Ergebnis gehört oder null: mit `zu` nur der Aufruf dieser Kennung (kein Rückfall), ohne `zu` der
      älteste offene ohne `id`, sonst der älteste offene überhaupt. */
  function aufrufFinden(eintrag, offen) {
    if (eintrag.zu !== null && eintrag.zu !== undefined) {
      const mitKennung = offen.nachId.get(eintrag.zu);
      if (mitKennung === undefined || mitKennung.gepaart) return null;
      return mitKennung;
    }
    const ohneKennung = aeltesterOffener(offen.ohneId, offen.ohneKopf);
    offen.ohneKopf = ohneKennung.kopf;
    if (ohneKennung.schritt !== null) return ohneKennung.schritt;
    const irgendeiner = aeltesterOffener(offen.alle, offen.alleKopf);
    offen.alleKopf = irgendeiner.kopf;
    return irgendeiner.schritt;
  }

  /** Ein Ergebnis gehört zu seinem Aufruf (`aufrufFinden`); ohne Aufruf ist es ein eigener Schritt ohne Dauer. Liefert den Schritt. */
  function ergebnisZuordnen(nr, eintrag, ms, offen, schritte) {
    const fehler = fehlerErkennen(eintrag.text);
    const schritt = aufrufFinden(eintrag, offen);
    if (schritt === null) {
      const allein = { nr, ergebnisNr: nr, aufruf: false, name: eintrag.name, befehl: null, absicht: null, dauer: null, parallel: false, fehler, beginn: null, laufendeNummer: null, gepaart: true };
      schritte.push(allein);
      return allein;
    }
    schritt.ergebnisNr = nr;
    schritt.fehler = fehler;
    schritt.gepaart = true;
    offen.anzahl--;
    if (offen.begonnen > schritt.laufendeNummer + 1) schritt.parallel = true;
    if (ms !== null && schritt.beginn !== null) schritt.dauer = Math.max(0, ms - schritt.beginn);
    return schritt;
  }

  /** Der Schritt ohne Rechengrößen; ein Aufruf, der bis zum Ende offen blieb, ist parallel, wenn nach ihm ein weiterer begann. */
  function schrittAbschliessen({ beginn, laufendeNummer, gepaart, ...schritt }, begonnen) {
    if (schritt.aufruf && !gepaart && begonnen > laufendeNummer + 1) schritt.parallel = true;
    return schritt;
  }

  /** Ein Ergebnis ist ein Fehler, wenn seine erste Zeile `Exit code <n>` mit n ≠ 0 lautet oder der Text mit `<tool_use_error>`
      beginnt (N1 Punkt 4) — nie eine Suche nach „error“. Bei einer von Claude Code gekürzten Ausgabe gilt die Vorschau (N4 Punkt 3). */
  function fehlerErkennen(text) {
    const gekuerzt = satz.gekuerztErkennen(text);
    if (gekuerzt !== null && gekuerzt.form) return fehlerAmAnfang(gekuerzt.vorschau);
    return fehlerAmAnfang(text);
  }

  function fehlerAmAnfang(text) {
    if (text.startsWith('<tool_use_error>')) return true;
    const exit = /^Exit code (-?\d+)\s*$/.exec(text.split('\n', 1)[0]);
    return exit !== null && Number(exit[1]) !== 0;
  }

  /** Bevorzugte Schlüssel des Befehls im JSON eines Aufrufs (N1 Punkt 3), in dieser Reihenfolge. */
  const BEFEHL_SCHLUESSEL = ['command', 'file_path', 'pattern', 'url', 'query', 'prompt', 'message'];

  /** Text eines Aufrufs → `{befehl, absicht}`, je erste Zeile, gekürzt auf 200 Zeichen. Ein JSON-Objekt liefert den Befehl aus dem
      ersten bevorzugten Schlüssel mit Text, sonst aus dem ersten Textwert außer `description`; `description` ist die Absicht. */
  function kurzbefehl(text) {
    const objekt = jsonObjekt(text);
    if (objekt === null) return { befehl: ersteZeileGekuerzt(text), absicht: null };
    const texte = Object.entries(objekt).filter(([k, w]) => k !== 'description' && typeof w === 'string');
    const bevorzugt = BEFEHL_SCHLUESSEL.map(k => texte.find(([s]) => s === k)).find(Boolean) || texte[0];
    const absicht = typeof objekt.description === 'string' ? ersteZeileGekuerzt(objekt.description) : null;
    return { befehl: bevorzugt ? ersteZeileGekuerzt(bevorzugt[1]) : null, absicht };
  }

  function jsonObjekt(text) {
    try {
      const o = JSON.parse(text);
      return typeof o === 'object' && o !== null && !Array.isArray(o) ? o : null;
    } catch (_) {
      return null;
    }
  }

  const ersteZeileGekuerzt = text => gekuerzt(text.split('\n', 1)[0]);

  /** Dauerform (FA 2), abgerundet auf ganze Sekunden: „< 1 s“, „<n> s“, „<m> min <s> s“, ab 1 h „<h> h <m> min“. */
  function dauerText(ms) {
    const s = Math.floor(ms / 1000);
    if (s < 1) return '< 1 s';
    if (s < 60) return `${s} s`;
    if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`;
    return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  }

  /* ── Zahlform der Tokens (R00238 FA 2, FA 3; PO Z. 573, 574): immer abgerundet, gleich in Kopf, Zeile und Liste ── */

  const TAUSEND = 1000, VOLL_UNTER = 10000, MILLION = 1000000;

  /** Zahl → Teile der gekürzten Form: unter 10.000 die volle Zahl, dann ganze Tausend, ab 1.000.000 Millionen mit einer Stelle. */
  function tokenTeile(n) {
    if (n < VOLL_UNTER) return { art: 'voll', zahl: tausender(n) };
    if (n < MILLION) return { art: 'tausend', zahl: String(Math.floor(n / TAUSEND)) };
    const zehntel = Math.floor(n / (MILLION / 10));
    const ganz = Math.floor(zehntel / 10), stelle = zehntel % 10;
    let zahl = tausender(ganz);
    if (stelle > 0) zahl += `,${stelle}`;
    return { art: 'million', zahl, eine: ganz === 1 && stelle === 0 };
  }

  /** „8.412“, „35 Tsd.“, „4,3 Mio.“, „1 Mio.“. */
  function tokenKurz(n) {
    const t = tokenTeile(n);
    if (t.art === 'tausend') return `${t.zahl} Tsd.`;
    if (t.art === 'million') return `${t.zahl} Mio.`;
    return t.zahl;
  }

  /** Lesefassung der Kurzform (UX S1): „35 Tausend“, „1 Million“, „1,2 Millionen“; volle Zahlen bleiben. */
  function tokenLesetext(n) {
    const t = tokenTeile(n);
    if (t.art === 'tausend') return `${t.zahl} Tausend`;
    if (t.art === 'million' && t.eine) return '1 Million';
    if (t.art === 'million') return `${t.zahl} Millionen`;
    return t.zahl;
  }

  const tokenVoll = tausender;

  /** Gekürzte Zahl für Augen (`aria-hidden`) und ausgeschrieben für Bildschirmleser (`vh`); eine volle Zahl steht nur einmal. */
  function tokenZahlHtml(n) {
    const kurz = tokenKurz(n), lesetext = tokenLesetext(n);
    if (kurz === lesetext) return kurz;
    return `<span aria-hidden="true">${kurz}</span><span class="vh">${lesetext}</span>`;
  }

  const EIN_TOKEN = '1 neues Token';
  /** „<Zahl> neue Tokens“, in der Einzahl „1 neues Token“ (Z. 574). */
  function neueTokensText(n) {
    if (n === 1) return EIN_TOKEN;
    return `${tokenKurz(n)} neue Tokens`;
  }

  function neueTokensLesetext(n) {
    if (n === 1) return EIN_TOKEN;
    return `${tokenLesetext(n)} neue Tokens`;
  }

  function neueTokensHtml(n) {
    if (n === 1) return EIN_TOKEN;
    return `${tokenZahlHtml(n)} neue Tokens`;
  }

  /* ── Kopf mit Gesamtdauer und Kennzahlen (R00234 FA 3, FA 4; Zeichnung D0009 `#laufansicht`) ── */

  const LESETEXT = { liest: 'wird gelesen', ohne: 'nicht verfügbar' };
  const ERGEBNIS_FORM = { bestanden: 'ok', befund: 'warn', blockiert: 'fehl' };
  const HAKEN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  /** „–“ für Augen, daneben der Lesetext; nie ein `aria-label` an einem `span` (FA 4). */
  const ohneWert = lesetext => `<span class="lv-leerwert" aria-hidden="true">–</span><span class="vh">${lesetext}</span>`;

  /** Kopf aus `{zustand, auswertung, kosten}`: `zustand` ist `eintraege` (mit Auswertung), `liest` oder `ohne` (fehlt, Fehler);
      `kosten` ist der Kosteneintrag der Karte mit dieser Kennung (`{amount, currency}`) oder null. */
  function laufKopfHtml({ zustand, auswertung, kosten }, esc) {
    const a = zustand === 'eintraege' ? auswertung : null;
    const leer = ohneWert(LESETEXT[zustand]);
    const feld = (name, wert, klasse = '') => `<div class="${klasse}"><dt>${name}</dt><dd>${wert}</dd></div>`;
    const kostenWert = kosten ? `<span class="mono">${esc(geld(inCent(kosten.amount), kosten.currency))}</span>` : ohneWert('kein Kosteneintrag');
    let kennzahlen = feld('Ergebnis', leer, 'ohne') + feld('Werkzeugaufrufe', leer, 'ohne') + feld('Fehler erkannt', leer, 'ohne') + feld('Commits', leer, 'ohne');
    if (a) {
      const k = a.kennzahlen;
      kennzahlen = feld('Ergebnis', ergebnisHtml(a.bericht), a.bericht ? '' : 'ohne') + feld('Werkzeugaufrufe', String(k.werkzeugaufrufe))
        + feld('Fehler erkannt', String(k.fehler), k.fehler ? 'fehl' : '') + feld('Commits', commitsHtml(a.bericht), a.bericht && a.bericht.commits !== null ? '' : 'ohne');
    }
    kennzahlen += feld('Kosten', kostenWert, kosten ? '' : 'ohne');
    const tokens = tokensKopf(zustand, a, kosten);
    kennzahlen += feld('Tokens', tokens.html, tokens.klasse);
    return `<div class="lv-aw"><div class="lv-gd"><span class="k">Gesamtdauer</span>${a ? dauerKopfHtml(a) : `<span class="w">${leer}</span>`}</div><dl class="lv-kz">${kennzahlen}</dl></div>`;
  }

  const GEZAEHLT = 'aus dem Transkript gezählt';
  const GEZAEHLT_GRENZE = 'aus dem Transkript gezählt bis zur Grenze des Transkripts';

  /** Kennzahl „Tokens“ (R00238 FA 4, ADR-0041 N3 Punkt 2, K1): `tokens` des Kosteneintrags dieser Kennung, sonst die Summe aller vier
      Werte über die gelesenen Einträge mit Satz darunter, an der Grenze „mindestens“; sonst „–“ mit Lesetext. */
  function tokensKopf(zustand, a, kosten) {
    const wert = inhalt => `<span class="tw">${inhalt}</span>`;
    if (kosten && gebuchteTokens(kosten.tokens)) return { html: wert(tokenZahlHtml(kosten.tokens)), klasse: '' };
    if (a && a.tokens && a.grenze) return { html: wert(`mindestens ${tokenZahlHtml(a.tokens.summe)}`) + `<span class="auf">${GEZAEHLT_GRENZE}</span>`, klasse: '' };
    if (a && a.tokens) return { html: wert(tokenZahlHtml(a.tokens.summe)) + `<span class="auf">${GEZAEHLT}</span>`, klasse: '' };
    if (zustand === 'liest') return { html: wert(ohneWert(LESETEXT.liest)), klasse: 'ohne' };
    return { html: wert(ohneWert('Tokens unbekannt')), klasse: 'ohne' };
  }

  /** Nur eine ganze Zahl ≥ 0 gilt als gebucht; alles andere wie ein fehlendes Feld — ins HTML geht nur eine Zahl. */
  const gebuchteTokens = n => Number.isSafeInteger(n) && n >= 0;

  /** Wert und Zeilen unter „Gesamtdauer“ (FA 3): Dauer mit Aufteilung, an der Grenze „mindestens“, sonst „Dauer unbekannt“. */
  function dauerKopfHtml(a) {
    if (!a.bekannt) return '<span class="w">Dauer unbekannt</span><span class="auf">Weniger als zwei Einträge tragen eine Zeit.</span>';
    const teile = [['Werkzeuge', a.werkzeug], ['Denken', a.denken], ['Warten', a.warten]].filter(([, ms]) => ms > 0);
    const aufteilung = `<span class="auf">${teile.map(([name, ms]) => `${name} ${dauerText(ms)}`).join(' · ')}</span>`;
    if (a.grenze) return `<span class="w">mindestens ${dauerText(a.gesamt)}</span><span class="auf">gerechnet bis zur Grenze des Transkripts</span>${aufteilung}`;
    return `<span class="w">${dauerText(a.gesamt)}</span>${aufteilung}`;
  }

  function ergebnisHtml(bericht) {
    if (!bericht) return ohneWert('kein Bericht erkannt');
    const form = ERGEBNIS_FORM[bericht.ergebnis];
    return `<span class="erg ${form}">${form === 'ok' ? HAKEN : ACHTUNG}${bericht.ergebnis}</span>`;
  }

  function commitsHtml(bericht) {
    if (!bericht) return ohneWert('kein Bericht erkannt');
    if (bericht.commits === null) return ohneWert('nicht verfügbar');
    return String(bericht.commits);
  }

  /* ── Zeitachse (R00239 FA 3, PO Z. 520 (9), 527, 528; Zeichnung D0009 `#laufansicht` Notiz „Zeitachse (B)“) ── */

  const ACHSEN_WORT = { werkzeug: 'Werkzeuge', denken: 'Denken', warten: 'Warten' };
  const LEGENDE = `<ul class="lv-leg" aria-hidden="true">${ACHSEN_ARTEN.map(art => `<li><i class="${LUECKE_KLASSE[art]}"></i>${ACHSEN_WORT[art]}</li>`).join('')}</ul>`;

  /** Uhrzeit eines Zeitpunkts in ms als `hh:mm:ss` in Ortszeit, abgerundet auf die Sekunde. */
  function uhrzeitAusMs(ms) {
    const d = new Date(Math.floor(ms / 1000) * 1000);
    return `${zwei(d.getHours())}:${zwei(d.getMinutes())}:${zwei(d.getSeconds())}`;
  }

  /** „Zeitachse: Werkzeuge <Dauer>, Denken <Dauer>, Warten <Dauer>“ — ein Teil mit 0 ms entfällt (PO Z. 527). */
  function zeitachseLesetext(a) {
    const teile = ACHSEN_ARTEN.filter(art => a[art] > 0).map(art => `${ACHSEN_WORT[art]} ${dauerText(a[art])}`);
    return `Zeitachse: ${teile.join(', ')}`;
  }

  /** Ein Stück: Breite nach Anteil über `flex-grow`, mindestens 1 px; Trennlinie und Muster stehen im inneren Element (CSS). */
  const stueckHtml = s => `<span class="${LUECKE_KLASSE[s.art]}" style="flex-grow:${s.dauer}" title="${ACHSEN_WORT[s.art]} ${dauerText(s.dauer)} ab ${uhrzeitAusMs(s.ab)}"><i></i></span>`;
  const fachHtml = f => `<span class="${LUECKE_KLASSE[f.art]}" title="überwiegend ${ACHSEN_WORT[f.art]}, ${uhrzeitAusMs(f.ab)}–${uhrzeitAusMs(f.bis)}"><i></i></span>`;

  /** Die Zeitachse aus der Auswertung (FA 3): Überschrift, Legende immer mit drei Arten, Balken als Bild mit Lesetext, darunter
      erste und letzte Zeit. Ohne Zeitachse (FA 4) leer. Gerechnet wird hier nichts. */
  function laufZeitachseHtml(a) {
    if (!a || !a.zeitachse) return '';
    const z = a.zeitachse;
    let teile = z.stuecke.map(stueckHtml), klasse = 'lv-balken';
    if (z.faecher) {
      teile = z.faecher.map(fachHtml);
      klasse += ' faecher';
    }
    const balken = `<div class="${klasse}" role="img" aria-label="${zeitachseLesetext(a)}">${teile.join('')}</div>`;
    const zeiten = `<div class="lv-za-zeit" aria-hidden="true"><span>${uhrzeitAusMs(z.erste)}</span><span>${uhrzeitAusMs(z.erste + z.gesamt)}</span></div>`;
    return `<section class="lv-za" aria-labelledby="lv-za-t"><div class="lv-za-kopf"><h2 id="lv-za-t">Zeitachse</h2>${LEGENDE}</div>${balken}${zeiten}</section>`;
  }

  /* ── Zustände der Seite (FA 7, FA 8, FA 11; Bilder 2, 4, 5): Meldungen, Ansage und Rumpf ── */

  const LIEST = 'Liest das Transkript …';
  const FEHLT = 'Das Transkript liegt nicht auf diesem Rechner.';
  const FEHLT_ERKLAERUNG = 'Transkripte bleiben auf dem Rechner, auf dem sie abgelegt wurden; nach einem frischen Klon oder auf einem anderen Rechner fehlen sie. Der Lauf und seine Kosten stehen weiter an der Aufgabe.';
  const NICHT_GELESEN = 'Das Transkript ließ sich nicht lesen: ';
  const ohneBidi = text => String(text).replace(/[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '');

  /** Satz der Fehlermeldung (Wortlaut 19, PO Z. 490): Server mit `fehler` und Status; Verbindung und Frist; Entpacken und
      unbekannte Kennung ohne Status, ohne Text des Browsers und ohne Text der Adresse. */
  /** Art eines Fehlers beim Lesen oder Zeichnen (FA 8): Server mit Status, Verbindung und Frist, Entpacken, `fehlt`; jede andere,
      unerwartete Ausnahme heißt „verarbeiten“ — ihr Text (etwa „Invalid string length“) kommt nie auf die Seite (PO Z. 495). */
  function laufFehlerArt(g) {
    const fehler = g !== null && typeof g === 'object' ? g : {};
    if (fehler.entpacken) return { art: 'entpacken' };
    if (fehler.frist || fehler.status === 0) return { art: 'verbindung' };
    if (typeof fehler.status !== 'number' || fehler.status < 400) return { art: 'verarbeiten' };
    if (fehler.status === 404 && fehler.daten && fehler.daten.zustand === 'fehlt') return { art: 'fehlt' };
    return { art: 'server', status: fehler.status, fehler: fehler.message };
  }

  function laufFehlerText(fehler) {
    if (fehler.art === 'verarbeiten') return NICHT_GELESEN + 'Die Datei lässt sich nicht verarbeiten.';
    if (fehler.art === 'unbekannt') return NICHT_GELESEN + 'An dieser Aufgabe steht kein Lauf mit dieser Kennung.';
    if (fehler.art === 'entpacken') return NICHT_GELESEN + 'Die Datei lässt sich nicht entpacken.';
    if (fehler.art === 'verbindung') return NICHT_GELESEN + 'keine Verbindung zum Programm.';
    return `${NICHT_GELESEN}${ohneBidi(fehler.fehler || 'unbekannter Fehler')} (${fehler.status}).`;
  }

  /** Was der Statusbereich sagt: beim Lesen Wortlaut 14, danach den sichtbaren Satz des Ergebnisses, vorher nichts. */
  function laufAnsage(v) {
    if (v.laedt) return LIEST;
    if (!v.ergebnis) return '';
    if (v.ansage) return v.ansage;
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

  Object.assign(ziel, { laufZeitachseHtml, FILTER_VORGABE, laufFilterHtml, laufZeigenWert, laufFilterAnsage, laufSprungFilter, laufKeineFehlerHtml, tokenKurz, tokenLesetext, tokenVoll, tokenZahlHtml, neueTokensText, neueTokensHtml, laufKopfHtml, laufBerichtHtml, laufTopHtml, laufAuswerten, dauerText, kurzbefehl, fehlerErkennen, DENKZEILE_AB_MS, zeilenLesen, eintragPruefen, laufHtml, laufFehlerText, laufFehlerArt, laufAnsage, laufRumpfHtml, zeichenBuchen, LAUF_GRENZEN, ZEICHEN_JE_TEXT, ZEICHEN_JE_LAUF });
})(typeof module !== 'undefined' ? module.exports : window);
