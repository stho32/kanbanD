/* kanbanD — Satz der Laufansicht (R00240, ADR-0041 N4): Aufruf und Ergebnis eines Schritts gesetzt. Rein, im Browser und in Node. */
(function (ziel) {
  'use strict';
  const offen = () => undefined;
  Object.assign(ziel, { shellUmbruch: offen, kuerzungHtml: offen, editDiff: offen, gekuerztErkennen: offen, groesseDeutsch: offen, systemhinweiseTrennen: offen, testzeileFinden: offen, aufrufSatz: offen, ergebnisSatz: offen, jsonZeilen: offen, SATZ_GRENZEN: { aufrufBytes: 65536, aufrufZeilen: 2000, befehlBytes: 16384 } });
})(typeof module !== 'undefined' ? module.exports : window);
