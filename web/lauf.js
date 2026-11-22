/* kanbanD — Laufansicht (R00221, ADR-0041): Zeilen eines entpackten Transkripts im Strom lesen und prüfen. Reine Funktionen,
   im Browser und in Node (Unit-Tests) nutzbar wie laeufe.js. Fremder Text geht hier unverändert durch; maskiert wird beim Zeichnen. */
(function (ziel) {
  'use strict';
  const { markdownHtml } = typeof module !== 'undefined' ? require('./markdown.js') : window;
  const { sichtbarHtml, sichtbarText } = typeof module !== 'undefined' ? require('./diff.js') : window;
  const { geld, inCent } = typeof module !== 'undefined' ? require('./kosten.js') : window;

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
    return { schrittAm, gepaart, lueckeVor, eintragAm, eingeklappt: a.eingeklappt, laengste, esc, budget };
  }

  function zeileMitLueckeHtml(zeile, z) {
    const luecke = z.lueckeVor.get(zeile.nr);
    return (luecke ? lueckeHtml(luecke, z.laengste) : '') + eintragHtml(zeile, z);
  }

  const LUECKE_WORT = { denken: 'denkt', warten: 'wartet' };
  const LUECKE_KLASSE = { werkzeug: 'w', denken: 'd', warten: 't' };

  /** Denk- oder Wartezeile (FA 8): ein Listeneintrag, der sich mit seinem Text liest; Marke, Linie und Balken sind Schmuck. */
  function lueckeHtml(l, laengste) {
    const klasse = LUECKE_KLASSE[l.art];
    return `<li id="lv-s${l.vorNr}-vor" tabindex="-1" class="lv-d ${klasse}"><span class="mk" aria-hidden="true"></span><span class="tx"><b>${dauerText(l.dauer)}</b> ${LUECKE_WORT[l.art]}</span><span class="ln" aria-hidden="true"></span><span class="du">${balkenHtml(l.dauer, laengste, klasse)}</span></li>`;
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
    if (eintrag.art === 'nachricht') return nachrichtHtml(nr, eintrag, z.esc, z.budget);
    if (z.gepaart.has(nr)) return '';
    return schrittHtml(z.schrittAm.get(nr), eintrag, z);
  }

  /** Name mit Marken, gebucht; leer ohne Namen. */
  function nameHtml(name, esc, budget) {
    if (name === null) return '';
    return gebuchtHtml(zeichenBuchen(name, budget), z => zeileHtml(z, esc), esc);
  }

  /** Nachricht offen: Kürzel, Name, Wer, Uhrzeit; der Text je Zeile sichtbar gemacht, dann Markdown (maskiert, ADR-0030). */
  function nachrichtHtml(nr, e, esc, budget) {
    const uhrzeit = uhrzeitText(e.zeit);
    const name = e.name === null ? '' : `<b>${nameHtml(e.name, esc, budget)}</b>`;
    const zeit = uhrzeit === null ? '' : `<span class="mono">${uhrzeit}</span>`;
    return `<li id="lv-s${nr}" tabindex="-1" class="lv-n ${e.wer}"><span class="pk ${PK_KLASSE[e.wer]}" aria-hidden="true">${esc(kuerzel(e))}</span><div class="lv-wer">${name}<span>${WER_WORT[e.wer]}</span>${zeit}</div><div class="lv-text">${nachrichtTextHtml(e.text, esc, budget)}</div></li>`;
  }

  /** Text einer Nachricht oder des Berichts: gebucht, je Zeile sichtbar gemacht, dann Markdown (maskiert). */
  function nachrichtTextHtml(text, esc, budget) {
    const alsMarkdown = teil => (teil ? markdownHtml(teil.split('\n').map(sichtbarText).join('\n'), 1) : '');
    return gebuchtHtml(zeichenBuchen(text, budget), alsMarkdown, esc);
  }

  const EINGEKLAPPT_WORT = { auftrag: 'Auftrag', systemhinweis: 'Systemhinweis' };

  /** Auftrag und Systemhinweis (FA 9) eingeklappt an ihrer Stelle: Wort, erste Zeile, Uhrzeit; aufgeklappt der Text als Nachricht. */
  function eingeklapptHtml(nr, e, art, esc, budget) {
    const uhrzeit = uhrzeitText(e.zeit);
    const zeit = uhrzeit === null ? '' : `<span class="zt">${uhrzeit}</span>`;
    const klasse = art === 'systemhinweis' ? 'lv-e sys' : 'lv-e';
    const summary = `<summary>${PFEIL}<span class="nm">${EINGEKLAPPT_WORT[art]}</span><span class="z1">${esc(sichtbarText(ersteZeileGekuerzt(e.text)))}</span>${zeit}</summary>`;
    return `<li id="lv-s${nr}" tabindex="-1"><details class="${klasse}">${summary}<div class="lv-text">${nachrichtTextHtml(e.text, esc, budget)}</div></details></li>`;
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
      Befehl, Absicht, Kürzel des Ergebnisses und Dauer mit Balken; aufgeklappt beide Texte ganz, nie Markdown (Wortlaut 20). */
  function schrittHtml(s, eintrag, z) {
    const { esc, budget } = z;
    const aufruf = s.aufruf ? eintrag : null;
    const ergebnis = s.aufruf ? (s.ergebnisNr === null ? null : z.eintragAm.get(s.ergebnisNr)) : eintrag;
    const name = nameHtml(s.name, esc, budget) + (s.parallel ? '<span class="par">parallel</span>' : '');
    const aufrufGebucht = aufruf ? zeichenBuchen(aufruf.text, budget) : null;
    const ergebnisGebucht = ergebnis ? zeichenBuchen(ergebnis.text, budget) : null;
    const befehl = aufruf ? `<span class="bf">${esc(sichtbarText(s.befehl || ''))}</span>` : '';
    const absicht = s.absicht === null ? '' : `<span class="ab">${esc(sichtbarText(s.absicht))}</span>`;
    const fehler = s.fehler ? `${ACHTUNG}<span class="vh">Fehler: </span>` : '';
    const kuerzelTeil = ergebnisGebucht ? `<span class="eg">${fehler}${ersteZeileHtml(ergebnisGebucht, esc)}</span>` : '';
    const summary = `<summary>${PFEIL}<span class="nm">${name}</span>${befehl}${absicht}${kuerzelTeil}<span class="du">${schrittDauerHtml(s, aufruf, ergebnis, z.laengste)}</span></summary>`;
    const teil = (wort, b) => (b ? `<span class="k">${wort}</span><pre>${gebuchtHtml(b, t => zeilenHtml(t, esc), esc)}</pre>` : '');
    const klasse = `lv-s${s.fehler ? ' fehl' : ''}${s.absicht === null ? ' ohne-ab' : ''}`;
    return `<li id="lv-s${s.nr}" tabindex="-1"><details class="${klasse}">${summary}<div class="lv-s-ganz">${teil('Aufruf', aufrufGebucht)}${teil('Ergebnis', ergebnisGebucht)}</div></details></li>`;
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

  /** „Längste Schritte“ (FA 10): je Zeile ein Knopf, der über `act` zu ihr springt — nie `href="#…"`, der Hash ist die Adresse
      (ADR-0029). Ohne Dauer gibt es keine Liste. */
  function laufTopHtml(a, esc) {
    if (!a.top3.length) return '';
    const ziel = t => (t.schritt ? `lv-s${t.nr}` : `lv-s${t.nr}-vor`);
    const knoepfe = a.top3.map((t, i) => `<li><button type="button" id="lv-top-${i + 1}" data-act="lauf-springe" data-arg="${ziel(t)}"><span class="was">${esc(sichtbarText(t.was))}</span><span class="d">${dauerText(t.dauer)}</span></button></li>`);
    return `<section class="lv-gl" aria-labelledby="lv-top-t"><h2 id="lv-top-t">Längste Schritte</h2><ol class="lv-top">${knoepfe.join('')}</ol></section>`;
  }

  /** Die erste Zeile eingeklappt, gekürzt auf 200 Zeichen, aus dem gebuchten Text; endet sie am Budget, folgt die Zusammenfassung.
      Ihre Zeichen sind schon im aufgeklappten Text als Marke gezählt: hier stehen sie nur als Text der Marke (`⟨U+202E⟩`), ohne
      eigenes Markenelement — so bleibt es bei höchstens 1.000 Marken je Text. */
  function ersteZeileHtml(b, esc) {
    const zeile = b.vorher.split('\n')[0];
    const amBudget = b.rest > 0 && zeile.length === b.vorher.length && Array.from(zeile).length <= ERSTE_ZEILE_ZEICHEN;
    const anfang = esc(sichtbarText(gekuerzt(zeile)));
    if (!amBudget) return anfang;
    return `${anfang}<span class="mk-rest">${esc(restText(b.rest))}</span>`;
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
    const luecken = [], schritte = [], offen = [];
    let vorher = null, mitZeit = 0;
    for (const { nr, eintrag } of zeilen) {
      if (!eintrag) continue;
      const ms = zeitMs(eintrag.zeit);
      const schritt = eintrag.art === 'werkzeugaufruf' ? aufrufOeffnen(nr, eintrag, ms, offen) : null;
      if (schritt) schritte.push(schritt);
      if (eintrag.art === 'werkzeugergebnis') ergebnisZuordnen(nr, eintrag, ms, offen, schritte);
      if (ms === null) continue;
      mitZeit++;
      if (vorher !== null) {
        const dauer = Math.max(0, ms - vorher), art = lueckenArt(eintrag);
        summe[art] += dauer;
        if (art !== 'werkzeug' && dauer >= DENKZEILE_AB_MS) luecken.push({ vorNr: nr, art, dauer, vor: schritt ? schrittText(schritt) : `Nachricht von ${eintrag.name || WER_WORT[eintrag.wer]}` });
      }
      vorher = ms;
    }
    const gesamt = summe.werkzeug + summe.denken + summe.warten, bekannt = mitZeit >= 2;
    const kennzahlen = { werkzeugaufrufe: schritte.filter(s => s.aufruf).length, fehler: schritte.filter(s => s.fehler).length };
    const top3 = bekannt ? laengsteSchritte(schritte, luecken) : [];
    return { gesamt, ...summe, bekannt, grenze, luecken, schritte: schritte.map(ohneBeginn), top3, kennzahlen, bericht: berichtFinden(zeilen), eingeklappt: eingeklapptFinden(zeilen) };
  }

  /** Die drei längsten Schritt-, Denk- und Wartezeilen, nach Dauer absteigend, bei Gleichstand die frühere Zeile zuerst — eine Denk-
      oder Wartezeile steht vor dem Eintrag `nr`, ein Schritt an seiner Stelle. */
  function laengsteSchritte(schritte, luecken) {
    const zeilen = [
      ...luecken.map(l => ({ art: l.art, nr: l.vorNr, schritt: false, dauer: l.dauer, was: `${LUECKE_WORT[l.art]} · vor ${l.vor}`, stelle: l.vorNr - 0.5 })),
      ...schritte.filter(s => s.dauer !== null).map(s => ({ art: 'werkzeug', nr: s.nr, schritt: true, dauer: s.dauer, was: schrittText(s), stelle: s.nr })),
    ];
    zeilen.sort((a, b) => b.dauer - a.dauer || a.stelle - b.stelle);
    return zeilen.slice(0, 3).map(({ stelle, ...zeile }) => zeile);
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

  /** Ein Aufruf kommt in die Warteschlange; wartet dort schon einer, laufen alle offenen parallel (N1 Punkt 3). */
  function aufrufOeffnen(nr, eintrag, ms, offen) {
    const schritt = { nr, ergebnisNr: null, aufruf: true, name: eintrag.name, ...kurzbefehl(eintrag.text), dauer: null, parallel: offen.length > 0, fehler: false, beginn: ms };
    offen.forEach(o => { o.parallel = true; });
    offen.push(schritt);
    return schritt;
  }

  /** Ein Ergebnis gehört zum ältesten offenen Aufruf; ohne offenen Aufruf ist es ein eigener Schritt ohne Dauer. */
  function ergebnisZuordnen(nr, eintrag, ms, offen, schritte) {
    const fehler = fehlerErkennen(eintrag.text);
    const schritt = offen.shift();
    if (!schritt) {
      schritte.push({ nr, ergebnisNr: nr, aufruf: false, name: eintrag.name, befehl: null, absicht: null, dauer: null, parallel: false, fehler, beginn: null });
      return;
    }
    schritt.ergebnisNr = nr;
    schritt.fehler = fehler;
    if (ms !== null && schritt.beginn !== null) schritt.dauer = Math.max(0, ms - schritt.beginn);
  }

  const ohneBeginn = ({ beginn, ...schritt }) => schritt;

  /** Ein Ergebnis ist ein Fehler, wenn seine erste Zeile `Exit code <n>` mit n ≠ 0 lautet oder der Text mit `<tool_use_error>`
      beginnt (N1 Punkt 4) — nie eine Suche nach „error“. */
  function fehlerErkennen(text) {
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
    return `<div class="lv-aw"><div class="lv-gd"><span class="k">Gesamtdauer</span>${a ? dauerKopfHtml(a) : `<span class="w">${leer}</span>`}</div><dl class="lv-kz">${kennzahlen}</dl></div>`;
  }

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

  Object.assign(ziel, { laufKopfHtml, laufBerichtHtml, laufTopHtml, laufAuswerten, dauerText, kurzbefehl, fehlerErkennen, DENKZEILE_AB_MS, zeilenLesen, eintragPruefen, laufHtml, laufFehlerText, laufFehlerArt, laufAnsage, laufRumpfHtml, zeichenBuchen, LAUF_GRENZEN, ZEICHEN_JE_TEXT, ZEICHEN_JE_LAUF });
})(typeof module !== 'undefined' ? module.exports : window);
