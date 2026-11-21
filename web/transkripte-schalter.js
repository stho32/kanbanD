/* kanbanD — Schalter „Transkripte erfassen“ in „Einrichten“ (R00220, ADR-0036 Nachtrag „Umschalten“): Wahl, Wirkung,
   Rumpf und die Sätze an der Zeile. Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar wie laeufe.js. `board`
   ist der Name des Boards, `null` meint die Vorgabe des Ordners; Werte sind `true | false | null` wie in der API. Die
   Exporte tragen den Namen des Moduls, damit kein anderes Modul sie auf `window` überschreibt (Lehre #217). */
(function (ziel) {
  'use strict';

  const ohneSteuerzeichen = text => (typeof text === 'string' ? text.replace(/[‪-‮⁦-⁩]/g, '') : text);

  /** Gewählte Wahl: an der Vorgabe „an“ · „aus“ (fehlt der Schlüssel, „aus“), am Board „vorgabe“ · „an“ · „aus“. */
  function schalterWahl(board, wert) {
    if (wert === true) return 'an';
    if (wert === false || board === null) return 'aus';
    return 'vorgabe';
  }

  /** Was für das Board gilt: eigener Wert, sonst Vorgabe, sonst aus (ADR-0036 Regel 4). */
  const schalterWirkung = (vorgabe, wert) => (wert ?? vorgabe ?? false) === true;

  /** Wortlaut 22. */
  const schalterWirkungText = wirksam => (wirksam ? 'erfasst' : 'erfasst nicht');

  /** Rumpf des `PUT …/transkripte` für eine Wahl; die Vorgabe kennt kein „wie Vorgabe“. */
  function schalterRumpf(board, wahl) {
    if (wahl === 'an') return { erfassen: true };
    if (wahl === 'aus') return { erfassen: false };
    if (wahl === 'vorgabe' && board !== null) return { erfassen: null };
    throw new Error(`keine Wahl „${wahl}“ an ${board === null ? 'der Vorgabe' : 'einem Board'}`);
  }

  /** Wortlaut 23, nach der wirksamen Lage. */
  function schalterErfolgsSatz(board, wirksam) {
    const wo = board === null ? 'Für Boards ohne eigenen Wert' : `Auf „${ohneSteuerzeichen(board)}“`;
    return `${wo} werden ${wirksam ? 'jetzt Transkripte erfasst' : 'keine Transkripte mehr erfasst'}.`;
  }

  /** Wortlaut 24; Status 0 heißt: keine Antwort (Netz oder Frist). */
  function schalterFehlerSatz({ status, fehler }) {
    if (status === 0) return 'Der Schalter ließ sich nicht umstellen: keine Verbindung zum Programm.';
    return `Der Schalter ließ sich nicht umstellen: ${ohneSteuerzeichen(fehler) || 'unbekannter Fehler'} (${status}).`;
  }

  Object.assign(ziel, { schalterWahl, schalterWirkung, schalterWirkungText, schalterRumpf, schalterErfolgsSatz, schalterFehlerSatz });
})(typeof module !== 'undefined' ? module.exports : window);
