/* kanbanD — Kultur der Anzeige (R00109, ADR-0013): deutsche Datumsformen und Feldbeschriftungen.
   Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. Gerechnet und gespeichert wird weiter in ISO;
   erst an der Zeichengrenze formt dieses Modul. „Heute“ kommt als Argument, damit der Jahreswechsel prüfbar bleibt. */
(function (ziel) {
  const { ortszeit } = typeof module !== 'undefined' ? require('./zeiten.js') : window;
  const zwei = n => String(n).padStart(2, '0');
  const WOCHENTAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

  /** Tag `JJJJ-MM-TT` (auch Anfang eines Zeitpunkts) → `TT.MM.JJJJ`. */
  function datumLang(iso) {
    const [jahr, monat, tag] = iso.slice(0, 10).split('-');
    return `${tag}.${monat}.${jahr}`;
  }
  /** `TT.MM.` im Jahr von `heute` (ISO-Tag), sonst lang — nur für die drei kompakten Stellen (FA 4). */
  function datumKurz(iso, heute) {
    if (iso.slice(0, 4) !== heute.slice(0, 4)) return datumLang(iso);
    return datumLang(iso).slice(0, 6);
  }
  /** Zeitpunkt der Datei (mit oder ohne Versatz) → `TT.MM.JJJJ HH:MM` in Ortszeit. */
  function zeitpunktLang(z) {
    const ort = ortszeit(z);
    return `${datumLang(ort)} ${ort.slice(11, 16)}`;
  }
  /** Zeitpunkt → `TT.MM. HH:MM` im Jahr von `heute`, sonst lang. */
  function zeitpunktKurz(z, heute) {
    const ort = ortszeit(z);
    return `${datumKurz(ort, heute)} ${ort.slice(11, 16)}`;
  }
  /** Zeitstempel in ms → `TT.MM.JJJJ` in Ortszeit. */
  function datumAusMs(ms) {
    const d = new Date(ms);
    return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}.${d.getFullYear()}`;
  }
  /** Zeitstempel in ms → `TT.MM.JJJJ HH:MM` in Ortszeit. */
  function zeitpunktAusMs(ms) {
    const d = new Date(ms);
    return `${datumAusMs(ms)} ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
  }
  /** Zeitstempel in ms → `Mi 28.10.2026` (Tooltip-Kopf, R00073). */
  function datumMitWochentag(ms) {
    return `${WOCHENTAG[new Date(ms).getDay()]} ${datumAusMs(ms)}`;
  }
  /** Achsenmarke der Diagramme: `TT.MM.` über `JJJJ`. */
  function achsenMarke(ms) {
    const d = datumAusMs(ms);
    return [d.slice(0, 6), d.slice(6)];
  }

  /** Sichtbare Beschriftung je Schlüssel der Datei; der Schlüssel selbst bleibt Hilfstext (FA 10). */
  const FELDER = Object.freeze({
    board: 'Board', column: 'Spalte', class: 'Klasse', origins: 'Herkunft', assignees: 'Zuständig', labels: 'Labels', due: 'Fällig',
    'wbs-effects': 'Wirkungen', phases: 'Phasen', reservation: 'Reservierung', wbs: 'WBS', requirements: 'Anforderungen',
    ich: 'Ich', agents: 'Agenten', spalten: 'Spalten', anforderungen: 'Anforderungen',
  });
  /** Anzeigetext der Herkunft `thin air` (FA 15); in Datei, API und Filter bleibt `thin air`. */
  const OHNE_HERKUNFT = 'ohne Herkunft';
  /** Meint die Eingabe „keine Herkunft“? „ohne Herkunft“ oder `thin air`, getrimmt, Groß/klein egal (FA 16). */
  function istOhneHerkunft(eingabe) {
    const wort = eingabe.trim().toLowerCase();
    return wort === OHNE_HERKUNFT.toLowerCase() || wort === 'thin air';
  }

  Object.assign(ziel, { datumLang, datumKurz, zeitpunktLang, zeitpunktKurz, datumAusMs, zeitpunktAusMs, datumMitWochentag, achsenMarke, FELDER, OHNE_HERKUNFT, istOhneHerkunft });
})(typeof module !== 'undefined' ? module.exports : window);
