/* kanbanD — Ansicht „Läufe“ (R00219, ADR-0039): Transkripte aus GET /api/aufgaben/{nr}/transkripte und die Kosteneinträge
   der Aufgabe je Lauf zu einer Zeile. Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar wie commits.js.
   Zusammenführen und Ordnen rechnen auf den Rohwerten; beim Zeichnen geht fremder Text (Rolle, Spalte, Boards) ohne
   Bidi-Steuerzeichen durch `esc` (ADR-0030). */
(function (ziel) {
  'use strict';
  const { zeitMs } = typeof module !== 'undefined' ? require('./zeiten.js') : window;
  const { zeitpunktAusMs } = typeof module !== 'undefined' ? require('./kultur.js') : window;
  const { geld, inCent } = typeof module !== 'undefined' ? require('./kosten.js') : window;

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

  /** Hat sich die Menge der Kennungen in `a.transkripte` gegenüber dem Stand beim letzten Lesen geändert (FA 7, ADR-0039 L2)?
      Nur dann liest die Ansicht nach einem Live-Ereignis neu — Kommentar, Timer oder Kosten ändern sie nicht. */
  function kennungsmengeGeaendert(transkripteDerAufgabe, kennungenBeimLesen) {
    const jetzt = new Set(transkripteDerAufgabe.map(t => t.kennung));
    const damals = new Set(kennungenBeimLesen);
    return jetzt.size !== damals.size || [...jetzt].some(k => !damals.has(k));
  }

  /* ── Zeichnen (R00219 FA 3–8, Zeichnung D0009 `#laeufe`): HTML-Text aus dem Zustand der Ansicht. ── */

  /** Bidi-Steuerzeichen (U+202A–202E, U+2066–2069) aus fremdem Text, wie in commits.js. */
  const ohneSteuerzeichen = text => (typeof text === 'string' ? text.replace(/[\u202A-\u202E\u2066-\u2069]/g, '') : text);

  /** Wörter und Marken je Zustand (Wortlaute 1–6, PO Z. 472/474); `vorhanden` trägt kein sichtbares Wort. */
  const MARKEN = {
    fehlt: { wort: 'liegt nicht auf diesem Rechner', ton: 'lf-neutral', symbol: '<rect x="3" y="4" width="18" height="12"/><path d="M8 20h8M12 16v4"/><path d="M3 3l18 18"/>' },
    abweichend: { wort: 'Datei weicht vom abgelegten Stand ab', ton: 'cl-warn', symbol: '<path d="M6 3h8l4 4v14H6z"/><path d="M9 12h6M9 16h6M14 9.5l-4 9"/>' },
    unlesbar: { wort: 'Eintrag nicht lesbar', ton: 'cl-fehl', symbol: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>' },
  };
  const VORHANDEN = 'Transkript vorhanden';
  const OHNE_TRANSKRIPT = 'kein Transkript abgelegt';
  const NICHT_GELESEN = 'Transkript nicht gelesen';
  const SPALTEN = ['Zeitpunkt', 'Rolle', 'Spalte', 'Betrag', 'Transkript'];
  const NEU_SYMBOL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/></svg>';
  const ACHTUNG_SYMBOL = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/></svg>';

  /** Ein fehlender Wert: sichtbar „—“, vorgelesen das Wort (kein „—“ als Zeichen, R00219 AK 4). */
  const ohneWert = vorgelesen => `<span class="lf-kein" aria-hidden="true">—</span><span class="vh">${vorgelesen}</span>`;

  /** Zeitpunkt aus der Kennung als `TT.MM.JJJJ hh:mm` in Ortszeit; ohne Kennung `null`. */
  function zeitpunktText(kennung) {
    const ms = kennungMs(kennung);
    return ms === null ? null : zeitpunktAusMs(ms);
  }

  /** Zustandszelle: Marke mit Symbol, „vorhanden“ nur vorgelesen, ohne Transkript ein gedämpftes Wort ohne Marke —
      „Transkript nicht gelesen“, solange die Seite das Transkript nicht kennt, sonst „kein Transkript abgelegt“. */
  function zustandHtml(z, gelesen, esc, ansehen) {
    if (!z.transkript) return `<span class="lf-ohne">${gelesen ? OHNE_TRANSKRIPT : NICHT_GELESEN}</span>`;
    const marke = MARKEN[z.transkript.zustand];
    if (!marke) return `<span class="vh">${VORHANDEN}</span>${ansehenHtml(z, esc, ansehen)}`;
    return `<span class="cl-zs ${marke.ton}" data-zustand="${z.transkript.zustand}"><svg class="i" viewBox="0 0 24 24" aria-hidden="true">${marke.symbol}</svg>${marke.wort}</span>`;
  }

  const AUGE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  /** „Ansehen“ (R00221 FA 1, ADR-0041 Punkt 2): echter Verweis auf die Laufansicht der gespeicherten Kennung, nur bei `vorhanden`
      und nur mit Ziel; ein einfacher Linksklick läuft über `act`, Mittelklick und neuer Tab bleiben Verweis. */
  function ansehenHtml(z, esc, ansehen) {
    if (!ansehen || typeof z.kennung !== 'string') return '';
    const vorgelesen = ` — Transkript ${esc(ohneSteuerzeichen(z.role))}, ${zeitpunktText(z.kennung) || ''}`;
    return `<a class="lf-an" href="${esc(ansehen(z.kennung))}" data-act="lauf-oeffnen" data-arg="${esc(z.kennung)}">${AUGE}Ansehen<span class="vh">${vorgelesen}</span></a>`;
  }

  /** Spalte des Transkripts; weicht die des Kosteneintrags ab, steht sie als Nebentext darunter (FA 3). */
  function spalteHtml(z, esc) {
    if (z.column == null) return ohneWert('keine Spalte');
    const spalte = esc(ohneSteuerzeichen(z.column));
    if (!z.transkript || !z.kosten || z.kosten.column === z.column) return spalte;
    return `${spalte}<span class="lf-neben">Kosten gebucht in ${esc(ohneSteuerzeichen(z.kosten.column))}</span>`;
  }

  function zeileHtml(z, gelesen, esc, ansehen) {
    const zeitpunkt = zeitpunktText(z.kennung);
    const zelle = (klasse, inhalt) => `<td role="cell" class="${klasse}">${inhalt}</td>`;
    return `<tr role="row"${z.kennung === null ? ' class="ohnek"' : ''}><th scope="row" role="rowheader" class="lf-zp">${zeitpunkt === null ? ohneWert('kein Zeitpunkt') : zeitpunkt}</th>`
      + zelle('lf-ro', z.role == null ? ohneWert('keine Rolle') : esc(ohneSteuerzeichen(z.role)))
      + zelle('lf-sp', spalteHtml(z, esc))
      + zelle('lf-be r', z.kosten ? esc(geld(inCent(z.kosten.amount), z.kosten.currency)) : ohneWert('kein Betrag'))
      + zelle('lf-zs', zustandHtml(z, gelesen, esc, ansehen)) + '</tr>';
  }

  /** Die Tabelle; die Rollen stehen ausdrücklich, damit die Blockform schmaler Breiten (CSS `display`) sie nicht nimmt. */
  function tabelleHtml(zeilen, gelesen, esc, ansehen) {
    const kopf = SPALTEN.map(name => `<th scope="col" role="columnheader"${name === 'Betrag' ? ' class="r"' : ''}>${name}</th>`).join('');
    return `<div class="lf-rahmen" id="lf-insel"><table class="lf-tab" role="table" aria-label="Läufe dieser Aufgabe, neueste zuerst"><thead role="rowgroup"><tr role="row">${kopf}</tr></thead><tbody role="rowgroup">${zeilen.map(z => zeileHtml(z, gelesen, esc, ansehen)).join('')}</tbody></table></div>`;
  }

  /** Boards in „…“, mit Komma, vor dem letzten „und“ ohne Komma; alle genannt (PO Z. 480). */
  function boardsText(boards) {
    const genannt = boards.map(b => `„${ohneSteuerzeichen(b)}“`);
    if (genannt.length <= 1) return genannt.join('');
    return `${genannt.slice(0, -1).join(', ')} und ${genannt[genannt.length - 1]}`;
  }
  /** Der Verweis hinter dem Hinweis (R00220 Wortlaut 13). */
  const LAEUFE_VERWEIS = 'In „Einrichten“ umschalten';
  /** Hinweis bei `erfassen: false` (Wortlaut 12), nur Text. */
  const laeufeHinweisText = boards => `Auf ${boardsText(boards)} werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.`;

  /** Meldung über der Liste (Wortlaut 10, Form wie R00205 FA 8). */
  function laeufeFehlerText({ status, fehler }) {
    if (status === 0) return 'Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.';
    return `Die Läufe ließen sich nicht lesen: ${ohneSteuerzeichen(fehler) || 'unbekannter Fehler'} (${status}).`;
  }

  const tausender = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  /** Statusbereich (Wortlaut 9): Laden, Zahl mit Einzahl „1 Lauf“ und Tausenderpunkt, Fehler. */
  function statusText(l, anzahl) {
    if (l.laedt) return 'Liest die Läufe …';
    if (!l.ergebnis) return '';
    if (l.ergebnis.art === 'fehler') return 'Die Läufe ließen sich nicht lesen.';
    return `${anzahl === 1 ? '1 Lauf' : `${tausender(anzahl)} Läufe`} · Stand ${l.ergebnis.stand}`;
  }

  /** Zeilen der Ansicht: nach einem Erfolg aus dessen Antwort, nach einem Fehler nur die Kosteneinträge, vor der ersten Antwort keine. */
  function sichtbareZeilen(l, kosteneintraege) {
    if (!l.ergebnis) return [];
    if (l.ergebnis.art === 'fehler') return laeufe([], kosteneintraege);
    return laeufe(l.ergebnis.antwort.transkripte, kosteneintraege);
  }

  /** Die Tabelle allein (ADR-0039 N1: die Insel und ihr Schlüssel); ohne Zeilen leer. `ansehen(kennung)` bildet die Adresse der
      Laufansicht; ohne sie trägt keine Zeile ein Ziel. */
  function laeufeTabelleHtml(l, kosteneintraege, esc, ansehen = null) {
    const zeilen = sichtbareZeilen(l, kosteneintraege);
    if (!zeilen.length) return '';
    return tabelleHtml(zeilen, Boolean(l.ergebnis && l.ergebnis.art === 'liste'), esc, ansehen);
  }

  /** Die ganze Ansicht aus dem Zustand `l = {laedt, ergebnis: null | {art: 'liste', antwort, stand} | {art: 'fehler', fehler}}`
      und den Kosteneinträgen der Aufgabe im aktuellen Stand. Einzige Live-Region ist der Statusbereich im Fuß. `tabelle` ist
      der schon gebaute Text der Tabelle oder, wenn die alte Tabelle stehen bleibt, ihr leerer Platzhalter (ADR-0039 N1). */
  function laeufeAnsichtHtml(l, kosteneintraege, esc, tabelle = laeufeTabelleHtml(l, kosteneintraege, esc)) {
    const zeilen = sichtbareZeilen(l, kosteneintraege);
    const liste = l.ergebnis && l.ergebnis.art === 'liste';
    const kopf = `<div class="cl-kopf"><h3 id="laeufe-kopf" tabindex="-1">LÄUFE ${l.ergebnis ? `<span class="mono">${tausender(zeilen.length)}</span>` : ''}</h3><span class="cl-hin">neueste zuerst · Kosten und Transkript eines Laufs in einer Zeile</span></div>`;
    let oben = '';
    if (l.ergebnis && l.ergebnis.art === 'fehler') {
      const erneut = `<button type="button" class="cl-knopf" id="laeufe-erneut"${l.laedt ? ' aria-disabled="true"' : ' data-act="laeufe-lesen"'}>Erneut versuchen</button>`;
      oben = `<div class="cl-meld lf-meld">${ACHTUNG_SYMBOL}<p class="cl-meldtext">${esc(laeufeFehlerText(l.ergebnis.fehler))}</p>${erneut}</div>`;
    }
    // R00220 FA 10 (Wortlaut 13): hinter dem Hinweis der Verweis auf den Schalter in „Einrichten“
    if (liste && l.ergebnis.antwort.erfassen === false) oben += `<p class="lf-hw" role="note">${esc(laeufeHinweisText(l.ergebnis.antwort.boards_aus || []))} <a href="#/einrichten" class="lf-verweis" data-act="transkripte-einrichten">${LAEUFE_VERWEIS}</a></p>`;
    let mitte = '';
    if (zeilen.length) mitte = tabelle;
    else if (liste) mitte = '<div class="cl-leer">An dieser Aufgabe stehen keine Läufe mehr.</div>';
    const neu = `<button type="button" class="cl-textknopf" id="laeufe-neu"${l.laedt ? ' aria-disabled="true"' : ' data-act="laeufe-lesen"'}>${NEU_SYMBOL}Neu lesen</button>`;
    const fuss = `<div class="cl-fuss"><span class="lf-stand" id="laeufe-status" role="status">${esc(statusText(l, zeilen.length))}</span>${neu}</div>`;
    return `<div class="mod-main lf-panel">${kopf}${oben}${mitte}${fuss}</div>`;
  }

  /* ── Kopf und Leiste der Laufansicht (R00221 FA 4, ADR-0041 Punkt 3): aus der Zeile von `laeufe()`, ohne eigenes Lesen ── */

  /** „<Rolle> · <Zeitpunkt>“ hinter „Lauf“; Rolle ohne Bidi-Steuerzeichen, maskiert. */
  const laeufeTitelHtml = (z, esc) => `${esc(ohneSteuerzeichen(z.role))} · ${zeitpunktText(z.kennung) || ''}`;

  /** Rolle, Zeitpunkt, Spalte samt Nebentext, Betrag und Größe der Datei (`groesse` wie bei den Anhängen). */
  function laeufeLeisteHtml(z, esc, groesse) {
    const feld = (name, inhalt) => `<span><span class="k">${name}</span>${inhalt}</span>`;
    const betrag = z.kosten ? `<span class="mono">${esc(geld(inCent(z.kosten.amount), z.kosten.currency))}</span>` : ohneWert('kein Betrag');
    const bytes = z.transkript && typeof z.transkript.bytes === 'number' ? `<span class="mono">${esc(groesse(z.transkript.bytes))}</span>` : ohneWert('keine Größe');
    return `<div class="lv-leiste">${feld('ROLLE', esc(ohneSteuerzeichen(z.role)))}${feld('ZEITPUNKT', `<span class="mono">${zeitpunktText(z.kennung) || ''}</span>`)}`
      + `${feld('SPALTE', spalteHtml(z, esc))}${feld('BETRAG', betrag)}${feld('GRÖSSE', bytes)}</div>`;
  }

  Object.assign(ziel, { laeufeTitelHtml, laeufeLeisteHtml });
  Object.assign(ziel, { laeufe, kennungsmengeGeaendert, laeufeTabelleHtml, laeufeAnsichtHtml, laeufeHinweisText, laeufeFehlerText });
})(typeof module !== 'undefined' ? module.exports : window);
