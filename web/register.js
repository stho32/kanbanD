/* kanbanD — Register der Anwendungen in der Einstellungsseite (R00209, ADR-0034 N2): Startordner, Schreibregel und
   Zustandswort des Repositorys. Reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar wie kultur.js. Dieselbe Regel
   rechnet der Server (src/modell/einstellungen.rs `startordner`, src/format/einstellungen.rs `pfade`) — die Vorschau zeigt
   so genau, was nach dem Speichern in kanbanD.md steht. */
(function (ziel) {
  'use strict';

  /** Die vier Zustandswörter des Repositorys (PO Z. 434) mit der Klasse ihrer Marke, in der Reihenfolge der Prüfung. */
  const REPOSITORY_ZUSTAENDE = Object.freeze({
    leer: Object.freeze({ wort: 'kein Repository', klasse: 'ohne' }),
    ungeprueft: Object.freeze({ wort: 'noch nicht geprüft', klasse: 'ungeprueft' }),
    erreichbar: Object.freeze({ wort: 'erreichbar', klasse: 'ja' }),
    fehlt: Object.freeze({ wort: 'nicht erreichbar', klasse: 'nein' }),
  });

  const text = wert => String(wert || '').trim();

  /** Der Ordneranteil eines Dateipfads, für beide Trennzeichen: `a/b/c.md` → `a/b`, `/c.md` → `/`, `c.md` → `.`. */
  function ordnerVon(datei) {
    const ohneSchluss = datei.replace(/[/\\]+$/, '');
    const trenner = Math.max(ohneSchluss.lastIndexOf('/'), ohneSchluss.lastIndexOf('\\'));
    if (trenner < 0) return '.';
    const ordner = datei.slice(0, trenner).replace(/[/\\]+$/, '');
    if (ordner === '') return datei.slice(0, 1);
    return ordner;
  }

  /** Startordner einer Anwendung (ADR-0034 Regel 1): `repository`, sonst Ordner von `wbs`, sonst `requirements`, sonst leer. */
  function startordner(repository, wbs, anforderungen) {
    if (text(repository)) return text(repository);
    if (text(wbs)) return ordnerVon(text(wbs));
    return text(anforderungen);
  }

  /** Die Pfade einer Anwendung oder der Quellen, wie sie in der Datei stehen (N2 Regel 1): `repository` immer (als
      Startordner), `wbs` und `requirements` nur, wenn sie nicht leer sind — als Paare [Schlüssel, Wert]. */
  function pfadeZurDatei(a) {
    const paare = [['repository', startordner(a.repository, a.wbs, a.anforderungen)]];
    if (text(a.wbs)) paare.push(['wbs', text(a.wbs)]);
    if (text(a.anforderungen)) paare.push(['requirements', text(a.anforderungen)]);
    return paare;
  }

  /** Zustand des Repository-Felds: leer → „kein Repository“; anders als zuletzt gespeichert → „noch nicht geprüft“;
      sonst, was der Server zur Erreichbarkeit gemeldet hat. `gespeichert` = {repository, erreichbar} oder undefined. */
  function repositoryZustand(feld, gespeichert) {
    if (!text(feld)) return REPOSITORY_ZUSTAENDE.leer;
    if (!gespeichert || text(feld) !== gespeichert.repository) return REPOSITORY_ZUSTAENDE.ungeprueft;
    if (gespeichert.erreichbar) return REPOSITORY_ZUSTAENDE.erreichbar;
    return REPOSITORY_ZUSTAENDE.fehlt;
  }

  /** Zahl der Anwendungen, wie der Server zählt (`Anwendungen::aus`): die Standardanwendung, wenn sie einen Startordner
      hat, dazu jede Anwendung des Registers. */
  function anwendungenZahl(quellen) {
    const standard = startordner(quellen.repository, quellen.wbs, quellen.anforderungen) ? 1 : 0;
    return standard + (quellen.anwendungen || []).length;
  }

  Object.assign(ziel, { REPOSITORY_ZUSTAENDE, startordner, pfadeZurDatei, repositoryZustand, anwendungenZahl });
})(typeof module !== 'undefined' ? module.exports : window);
