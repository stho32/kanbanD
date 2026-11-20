/* kanbanD — Ansicht „Commits“ (R00205): aus einem Eintrag der Antwort von GET /api/aufgaben/{nr}/commits die Werte der Zeile.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar wie kultur.js. Fremder Text (Titel, Autor, Zweige, grund)
   geht hier unverändert durch; maskiert wird erst beim Zeichnen (web/ansicht.js, esc). */
(function (ziel) {
  'use strict';
  const { zeitpunktAusMs } = typeof module !== 'undefined' ? require('./kultur.js') : window;

  /** Länge, ab der die API einen Titel kürzt: höchstens 500 Zeichen, sonst 500 und „…“ (R00204 AK 17). */
  const TITEL_HOECHSTENS = 500;
  /** Wörter der fünf Zustände ohne Zweige (R00205 FA 5, Entscheidung des PO), in der Reihenfolge der Tabelle. */
  const ZUSTANDSWOERTER = {
    verwaist: 'auf keinem Zweig',
    fehlt: 'nicht mehr im Repository',
    repository_fehlt: 'Repository nicht erreichbar',
    anwendung_unbekannt: 'Anwendung unbekannt',
    unlesbar: 'Eintrag nicht lesbar',
  };
  const HINWEIS_VERWAIST = 'Der Commit ist noch da, aber kein Zweig führt zu ihm — meist nach einem Rebase.';
  const HINWEIS_FEHLT = 'Das Repository kennt diesen Commit nicht mehr.';
  const HINWEIS_OHNE_ANWENDUNG = 'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.';
  /** Symbol (Name der Zeichnung in web/ansicht.js) und Ton je Zustand: der Zustand hängt nie allein an der Farbe. */
  const ZEICHEN = {
    verwaist: ['kette-offen', 'warn'],
    fehlt: ['fehlt', 'fehl'],
    repository_fehlt: ['ordner-offen', 'fehl'],
    anwendung_unbekannt: ['frage', 'warn'],
    unlesbar: ['achtung', 'fehl'],
  };
  /** Zustände, in denen die API keine Metadaten kennt (R00204): Titel, Autor, Datum und Zahlen fehlen. */
  const OHNE_METADATEN = ['fehlt', 'unlesbar', 'repository_fehlt', 'anwendung_unbekannt'];
  /** Wie viele Zweignamen in der Zeile stehen, der Rest hinter „+n weitere“. */
  const ZWEIGE_IN_ZEILE = 3;

  const hinweisVon = (e) => {
    switch (e.zustand) {
      case 'verwaist': return HINWEIS_VERWAIST;
      case 'fehlt': return HINWEIS_FEHLT;
      case 'anwendung_unbekannt': return e.anwendung ? `Anwendung „${e.anwendung}“ ist unter Einrichten nicht eingetragen.` : HINWEIS_OHNE_ANWENDUNG;
      default: return e.grund || '';
    }
  };

  /** Der Commit in der Zeile: Kürzel und die ersten 7 Zeichen des Hashs, ohne Kürzel nur die 7; ohne Hash der Verweis wörtlich. */
  function kurzform(e) {
    if (!e.hash) return e.verweis;
    return (e.anwendung ? `${e.anwendung}:` : '') + e.hash.slice(0, 7);
  }

  /** Die Marke „gekürzt“: genau 501 Zeichen (Unicode-Codepunkte, nicht UTF-16-Einheiten) und am Ende „…“. */
  function titelGekuerzt(e) {
    const titel = e.titel || '';
    return titel.endsWith('…') && Array.from(titel).length === TITEL_HOECHSTENS + 1;
  }

  const tausender = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  /** `+1.204 −87` mit Tausenderpunkt und dem Minus-Zeichen U+2212. */
  const zahlenText = e => `+${tausender(e.plus)} −${tausender(e.minus)}`;

  /** `TT.MM.JJJJ HH:MM` in Ortszeit wie in der Ansicht „Verlauf“; was kein Zeitpunkt ist, bleibt wörtlich stehen. */
  function datumText(iso) {
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? iso : zeitpunktAusMs(ms);
  }

  /** Marke eines Zustands: Wort, Hinweiszeile, Symbol, Ton; `null` für `auf_zweig` (der hat die Zweige statt eines Worts). */
  function zustandsmarke(e) {
    if (!ZUSTANDSWOERTER[e.zustand]) return null;
    const [symbol, ton] = ZEICHEN[e.zustand];
    return { zustand: e.zustand, wort: ZUSTANDSWOERTER[e.zustand], hinweis: hinweisVon(e), symbol, ton };
  }

  /** Zweige der Zeile und der Klappe: bis zu drei Namen (lokale zuerst, dann entfernte), `weitere` = Summe aller Angaben − 3. */
  function zweigmarken(e) {
    const lokal = e.zweige || [], entfernt = e.entfernte_zweige || [], nichtAufgefuehrt = e.zweige_weitere || 0;
    const alle = [...lokal.map(name => ({ name, entfernt: false })), ...entfernt.map(name => ({ name, entfernt: true }))];
    const summe = alle.length + nichtAufgefuehrt;
    return {
      sichtbar: alle.slice(0, ZWEIGE_IN_ZEILE),
      weitere: Math.max(0, summe - ZWEIGE_IN_ZEILE),
      lokal, entfernt, nichtAufgefuehrt,
      satzRest: nichtAufgefuehrt > 0 ? `und ${nichtAufgefuehrt} weitere Zweige, hier nicht aufgeführt` : null,
    };
  }

  /** Alle Anzeigewerte einer Zeile. */
  function zeilenwerte(e) {
    const ohneMetadaten = OHNE_METADATEN.includes(e.zustand);
    return {
      verweis: e.verweis,
      kurz: kurzform(e),
      ohneMetadaten,
      titel: ohneMetadaten ? null : e.titel,
      gekuerzt: !ohneMetadaten && titelGekuerzt(e),
      autor: ohneMetadaten ? null : e.autor,
      datum: ohneMetadaten ? null : datumText(e.datum),
      datumTitel: ohneMetadaten ? null : e.datum,
      zahlen: ohneMetadaten ? null : zahlenText(e),
      zustand: zustandsmarke(e),
      zweige: e.zustand === 'auf_zweig' ? zweigmarken(e) : null,
    };
  }

  /** Meldung der Ansicht beim Fehler (R00205 FA 8): 503 mit dem festen Wortlaut des PO, ohne Verbindung (Status 0) ohne Antwort. */
  function fehlerText({ status, fehler }) {
    let grund = fehler || 'unbekannter Fehler';
    if (status === 503) grund = 'Das Repository antwortete nicht innerhalb von 10 Sekunden';
    if (status === 0) grund = 'keine Verbindung zum Programm';
    return `Die Commits ließen sich nicht lesen: ${grund} (${status}).`;
  }

  /** Ansage im Statusbereich nach dem Lesen. */
  function gelesenText(anzahl) {
    if (anzahl === 0) return 'Keine Commits gelesen';
    return anzahl === 1 ? '1 Commit gelesen' : `${anzahl} Commits gelesen`;
  }

  /* ── Zeichnen: HTML-Text aus den Zeilenwerten (R00205 FA 4–7, Artboard D0009 `#commits-ansicht`). Aller fremde Text geht durch
     `esc` (ADR-0030 Grundsatz 1), die Zustandswörter stehen als sichtbarer Text in ihrer Marke, nie in `.vh`. ── */
  const SYMBOLE = {
    'kette-offen': '<path d="M10 14a4 4 0 0 0 5 .5M14 10a4 4 0 0 0-5-.5M8 16l-2 2M16 8l2-2M4 4l16 16"/>',
    fehlt: '<rect x="4" y="4" width="16" height="16" stroke-dasharray="3 3"/><path d="M9 9l6 6M15 9l-6 6"/>',
    'ordner-offen': '<path d="M3 7h7l2 2h9v11H3z"/><path d="M3 3l18 18"/>',
    frage: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17v.01"/>',
    achtung: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
    zweig: '<circle cx="6" cy="5" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="8" r="2"/><path d="M6 7v10M18 10c0 5-8 3-12 7"/>',
    weiter: '<path d="M9 5l7 7-7 7"/>',
    neu: '<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  };
  const symbol = name => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${SYMBOLE[name]}</svg>`;

  const SPALTEN = ['Commit', 'Titel', 'Autor', 'Datum', '+ / −', 'Zustand'];
  const KEINE_ANGABE = '<span aria-hidden="true">—</span><span class="vh">keine Angabe</span>';
  const GEKUERZT_HINWEIS = 'Der Titel ist bei 500 Zeichen gekürzt; vollständig steht er im Repository.';

  /** Ein Zweig als Marke; entfernte gestrichelt und mit Lesetext. Der volle Name steht im `title`. */
  const zweigMarke = (z, esc) => `<span class="cl-br${z.entfernt ? ' cl-fern' : ''}" title="${esc(z.name)}">${symbol('zweig')}<span>${esc(z.name)}</span>${z.entfernt ? '<span class="vh"> (entfernt)</span>' : ''}</span>`;

  function zweigeZelle(z, i, offen, esc) {
    if (!z.sichtbar.length && !z.weitere) return '';
    const knopf = z.weitere ? `<button type="button" class="cl-mehr" data-act="commits-klappe" data-arg="${i}" aria-expanded="${offen}" aria-controls="cl-zw-${i}" aria-label="${z.weitere} weitere Zweige ${offen ? 'verbergen' : 'zeigen'}">${symbol('weiter')}+${z.weitere} weitere</button>` : '';
    return `<span class="vh">auf Zweigen: </span><div class="cl-zweige">${z.sichtbar.map(m => zweigMarke(m, esc)).join('')}${knopf}</div>`;
  }

  /** Die volle Zweigliste unter der Zeile: je Liste eine Überschrift mit Zahl (eine leere entfällt), dazu der Satz zum Rest. */
  function zweigeKlappe(z, i, esc) {
    const liste = (titel, namen, entfernt) => namen.length ? `<p><b>${titel} ${namen.length}</b></p><p>${namen.map(name => zweigMarke({ name, entfernt }, esc)).join('')}</p>` : '';
    const rest = z.satzRest ? `<p class="cl-rest">${esc(z.satzRest)}</p>` : '';
    return `<tr class="cl-zw" id="cl-zw-${i}"><td colspan="6"><div class="cl-zeilen">${liste('LOKALE ZWEIGE', z.lokal, false)}${liste('ENTFERNTE ZWEIGE', z.entfernt, true)}${rest}</div></td></tr>`;
  }

  function zustandsZelle(w, i, offen, esc) {
    if (w.zweige) return zweigeZelle(w.zweige, i, offen, esc);
    const m = w.zustand;
    return `<span class="cl-zs cl-${m.ton}">${symbol(m.symbol)}${esc(m.wort)}</span><p class="cl-zh">${esc(m.hinweis)}</p>`;
  }

  function zeileHtml(e, i, offen, esc) {
    const w = zeilenwerte(e);
    const wert = text => (w.ohneMetadaten ? KEINE_ANGABE : text);
    const titel = wert(`${esc(w.titel)}${w.gekuerzt ? `<span class="cl-kurz" title="${esc(GEKUERZT_HINWEIS)}">gekürzt</span>` : ''}`);
    const datum = wert(`<span title="${esc(w.datumTitel)}">${esc(w.datum)}</span>`);
    const zahlen = wert(w.zahlen && `<span class="cl-pl">+${tausender(e.plus)}</span> <span class="cl-mi">−${tausender(e.minus)}</span><span class="vh"> Zeilen</span>`);
    const hash = `<span class="cl-hash${e.hash ? '' : ' cl-roh'}" title="${esc(w.verweis)}">${esc(w.kurz)}</span>`;
    const zeile = `<tr class="cl-z${w.ohneMetadaten ? ' cl-ohne' : ''}"><th scope="row" class="cl-c-hash">${hash}</th><td class="cl-c-titel">${titel}</td><td class="cl-c-autor">${wert(esc(w.autor))}</td><td class="cl-c-datum">${datum}</td><td class="cl-c-pm cl-r">${zahlen}</td><td class="cl-c-zst">${zustandsZelle(w, i, offen, esc)}</td></tr>`;
    return offen && w.zweige ? zeile + zweigeKlappe(w.zweige, i, esc) : zeile;
  }

  /** Die Tabelle der Liste im querscrollbaren Rahmen (Gruppe mit Namen, per Tab fokussierbar). `klappen` nennt die Zeilen mit offener Zweigliste. */
  function commitsListeHtml(eintraege, klappen, esc) {
    const kopf = SPALTEN.map(name => `<th scope="col"${name === '+ / −' ? ' class="cl-r"' : ''}>${name}</th>`).join('');
    const zeilen = eintraege.map((e, i) => zeileHtml(e, i, klappen.has(i), esc)).join('');
    return `<div class="cl-rahmen" tabindex="0" role="group" aria-label="Commits dieser Aufgabe, ältester zuerst"><table class="cl-tab"><thead><tr>${kopf}</tr></thead><tbody>${zeilen}</tbody></table></div>`;
  }

  /** Kopf der Ansicht: „COMMITS“ mit der Zahl der Einträge (ohne Zahl, solange gelesen wird). */
  function commitsKopfHtml(anzahl) {
    return `<div class="cl-kopf"><h3>COMMITS ${anzahl == null ? '' : `<span class="mono">${anzahl}</span>`}</h3><span class="cl-hin">an dieser Aufgabe hinterlegt · ältester zuerst</span></div>`;
  }

  /** Fuß: „liest nur“ mit der Uhrzeit der letzten erfolgreichen Antwort und „Neu lesen“; beim Lesen `aria-disabled` statt `disabled`, damit der Fokus bleibt. */
  function commitsFussHtml({ stand, laedt }) {
    const knopf = `<button type="button" class="cl-textknopf" id="commits-neu" data-act="commits-lesen"${laedt ? ' aria-disabled="true"' : ''}>${symbol('neu')}Neu lesen</button>`;
    return `<div class="cl-fuss"><span>liest nur · gelesen aus dem Repository der Anwendung${stand ? ` · Stand ${stand}` : ''}</span>${knopf}</div>`;
  }

  Object.assign(ziel, { ZUSTANDSWOERTER, kurzform, titelGekuerzt, zahlenText, datumText, zustandsmarke, zweigmarken, zeilenwerte, fehlerText, gelesenText, commitsListeHtml, commitsKopfHtml, commitsFussHtml, symbol });
})(typeof module !== 'undefined' ? module.exports : window);
