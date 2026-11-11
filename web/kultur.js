/* kanbanD — Kultur der Anzeige (R00109, ADR-0013): deutsche Datumsformen und Feldbeschriftungen.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. Gerechnet und gespeichert wird weiter in ISO;
   erst an der Zeichengrenze formt dieses Modul. „Heute“ kommt als Argument, damit der Jahreswechsel prüfbar bleibt. */
(function (ziel) {
  'use strict';
  const { ortszeit } = typeof module !== 'undefined' ? require('./zeiten.js') : window;
  const zweistellig = zahl => String(zahl).padStart(2, '0');

  const ISO_TAG = /^\d{4}-\d{2}-\d{2}/;
  /** Tag `JJJJ-MM-TT` (auch Anfang eines Zeitpunkts) → `TT.MM.JJJJ`; ein Wert, der kein ISO-Tag ist, bleibt unverändert. */
  function datumLang(iso) {
    if (!ISO_TAG.test(iso)) return iso;
    const [jahr, monat, tag] = iso.slice(0, 10).split('-');
    return `${tag}.${monat}.${jahr}`;
  }
  /** `TT.MM.` im Jahr von `heute` (ISO-Tag), sonst lang — nur für die drei kompakten Stellen (FA 4). */
  function datumKurz(iso, heute) {
    if (!ISO_TAG.test(iso) || iso.slice(0, 4) !== heute.slice(0, 4)) return datumLang(iso);
    return datumLang(iso).slice(0, 6);
  }
  /** Zeitpunkt der Datei (mit oder ohne Versatz) → `TT.MM.JJJJ HH:MM` in Ortszeit. */
  function zeitpunktLang(zeitpunkt) {
    const ort = ortszeit(zeitpunkt);
    return `${datumLang(ort)} ${ort.slice(11, 16)}`;
  }
  /** Zeitpunkt → `TT.MM. HH:MM` im Jahr von `heute`, sonst lang. */
  function zeitpunktKurz(zeitpunkt, heute) {
    const ort = ortszeit(zeitpunkt);
    return `${datumKurz(ort, heute)} ${ort.slice(11, 16)}`;
  }
  /** Zeitstempel in ms → `TT.MM.JJJJ` in Ortszeit. */
  function datumAusMs(ms) {
    const zeit = new Date(ms);
    return `${zweistellig(zeit.getDate())}.${zweistellig(zeit.getMonth() + 1)}.${zeit.getFullYear()}`;
  }
  /** Zeitstempel in ms → `TT.MM.JJJJ HH:MM` in Ortszeit. */
  function zeitpunktAusMs(ms) {
    const zeit = new Date(ms);
    return `${datumAusMs(ms)} ${zweistellig(zeit.getHours())}:${zweistellig(zeit.getMinutes())}`;
  }
  /** Zeitstempel in ms → `Mi 28.10.2026` (Tooltip-Kopf, R00073). */
  function datumMitWochentag(ms) {
    const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return `${WOCHENTAG[new Date(ms).getDay()]} ${datumAusMs(ms)}`;
  }
  /** Achsenmarke der Diagramme: `TT.MM.` über `JJJJ`. */
  function achsenMarke(ms) {
    const datum = datumAusMs(ms);
    return [datum.slice(0, 6), datum.slice(6)];
  }
  /** Dauer in Worten (R00114 FA 3): unter 48 Stunden in Stunden abgerundet, ab 48 Stunden in Tagen kaufmännisch gerundet. */
  function seitText(ms) {
    const laufzeit = Math.max(0, ms);
    const stunden = Math.floor(laufzeit / 36e5);
    if (stunden >= 48) return `seit ${Math.round(laufzeit / 864e5)} Tagen`;
    if (stunden === 1) return 'seit 1 Stunde';
    return `seit ${stunden} Stunden`;
  }

  /** Sichtbare Beschriftung je Schlüssel der Datei; der Schlüssel selbst bleibt Hilfstext (FA 10). */
  const FELDER = Object.freeze({
    board: 'Board', column: 'Spalte', class: 'Klasse', origins: 'Herkunft', assignees: 'Zuständig', labels: 'Labels', due: 'Fällig', estimate: 'Geschätzt',
    'wbs-effects': 'Wirkungen', phases: 'Phasen', reservation: 'Reservierung', wbs: 'WBS', requirements: 'Anforderungen',
    ich: 'Ich', agents: 'Agenten', spalten: 'Spalten',
  });
  /** Anzeigetext der Herkunft `thin air` (FA 15); in Datei, API und Filter bleibt `thin air`. */
  const OHNE_HERKUNFT = 'ohne Herkunft';
  /** Meint die Eingabe „keine Herkunft“? „ohne Herkunft“ oder `thin air`, getrimmt, Groß-/Kleinschreibung egal (FA 16). */
  function istOhneHerkunft(eingabe) {
    const wort = eingabe.trim().toLowerCase();
    return wort === OHNE_HERKUNFT.toLowerCase() || wort === 'thin air';
  }
  /** Anzeigetext einer gespeicherten Herkunft: `thin air` → „ohne Herkunft“, jede andere bleibt (FA 15). */
  function herkunftAnzeige(wert) {
    if (wert === 'thin air') return OHNE_HERKUNFT;
    return wert;
  }
  /** Herkunft aus dem Feld von „Neue Aufgabe“: „ohne Herkunft“ oder thin air als ganzer Inhalt wird thin air, außer der Titel bringt eine Herkunft mit (FA 20); sonst getrennt an Leerzeichen und Kommas. */
  function herkunftAusFeld(feld, herkunftAusTitel) {
    if (!istOhneHerkunft(feld)) return feld.split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
    if (herkunftAusTitel.length) return [];
    return ['thin air'];
  }

  Object.assign(ziel, { datumLang, datumKurz, zeitpunktLang, zeitpunktKurz, datumAusMs, zeitpunktAusMs, datumMitWochentag, achsenMarke, seitText, FELDER, OHNE_HERKUNFT, istOhneHerkunft, herkunftAnzeige, herkunftAusFeld });
})(typeof module !== 'undefined' ? module.exports : window);
