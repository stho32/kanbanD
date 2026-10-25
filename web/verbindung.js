/* kanbanD — Wächter der Live-Verbindung (R00085): reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  // die Werte von EventSource.readyState
  const VERBINDET = 0, OFFEN = 1, GESCHLOSSEN = 2;
  /** Der Server meldet sich alle 15 s; wer 40 s nichts hört, hat eine still abgerissene Verbindung. */
  const STILLE_MS = 40000;
  const RUECKZUG_MS = [1000, 2000, 5000, 10000];

  /** `neu`, wenn die Verbindung geschlossen oder zu lange still ist; mit `sofort` (Tab sichtbar, wieder online)
      auch, wenn sie gerade nicht offen ist — sonst `nichts`. */
  function entscheide({ zuletzt, jetzt, zustand, sofort = false }) {
    if (zustand === GESCHLOSSEN || jetzt - zuletzt > STILLE_MS) return 'neu';
    if (sofort && zustand !== OFFEN) return 'neu';
    return 'nichts';
  }

  /** Wartezeit vor dem Versuch Nummer `versuch` (ab 0): 1 s, 2 s, 5 s, dann alle 10 s. */
  const rueckzug = versuch => RUECKZUG_MS[Math.min(versuch, RUECKZUG_MS.length - 1)];

  Object.assign(ziel, { entscheide, rueckzug, VERBINDET, OFFEN, GESCHLOSSEN, STILLE_MS });
})(typeof module !== 'undefined' ? module.exports : window);
