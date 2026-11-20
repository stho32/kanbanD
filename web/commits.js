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

  Object.assign(ziel, { ZUSTANDSWOERTER, kurzform, titelGekuerzt, zahlenText, datumText, zustandsmarke, zweigmarken, zeilenwerte, fehlerText, gelesenText });
})(typeof module !== 'undefined' ? module.exports : window);
