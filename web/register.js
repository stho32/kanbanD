/* kanbanD — Register der Anwendungen in der Einstellungsseite (R00209, R00222, ADR-0034 N2 Regel 4): Schreibregel und
   Zustandswort des Repositorys, Bindung eines Boards, Einstellungen des ersten Starts. Reine Funktionen, im Browser und in
   Node (Unit-Tests) nutzbar wie kultur.js. Dieselbe Schreibregel hat der Server (src/format/einstellungen.rs `pfad`): je
   Anwendung und in den Quellen nur `repository` — die Vorschau zeigt so genau, was nach dem Speichern in kanbanD.md steht.
   Den Lese-Rückfall auf ein Register in Altform rechnet nur der Server; die API liefert `repository` schon ergänzt. */
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

  /** Die Pfade einer Anwendung oder der Quellen, wie sie in der Datei stehen (ADR-0034 N2 Regel 4): nur `repository`,
      getrimmt — als Paare [Schlüssel, Wert]. */
  function pfadeZurDatei(a) {
    return [['repository', text(a.repository)]];
  }

  /** Zustand des Repository-Felds: leer → „kein Repository“; anders als zuletzt gespeichert → „noch nicht geprüft“;
      sonst, was der Server zur Erreichbarkeit gemeldet hat. `gespeichert` = {repository, erreichbar} oder undefined. */
  function repositoryZustand(feld, gespeichert) {
    if (!text(feld)) return REPOSITORY_ZUSTAENDE.leer;
    if (!gespeichert || text(feld) !== gespeichert.repository) return REPOSITORY_ZUSTAENDE.ungeprueft;
    if (gespeichert.erreichbar) return REPOSITORY_ZUSTAENDE.erreichbar;
    return REPOSITORY_ZUSTAENDE.fehlt;
  }

  /** Zahl der Anwendungen, wie der Server zählt (`Anwendungen::aus`): die Standardanwendung, wenn sie ein Repository hat
      (die API liefert es aus dem Lese-Rückfall schon ergänzt), dazu jede Anwendung des Registers. */
  function anwendungenZahl(quellen) {
    const standard = text(quellen.repository) ? 1 : 0;
    return standard + (quellen.anwendungen || []).length;
  }

  // Bindung eines Boards an Anwendungen (R00062) — seit R00222 hier (ADR-0034 Regel 4: die Bindung bleibt)
  /** Die Anwendungen, an die ein Board gebunden ist: die genannten, soweit registriert; fehlt `applications`
      (null), gilt bei genau einer registrierten Anwendung diese, `[]` bindet keine (R00062). `register` = [{kuerzel, name, …}]. */
  function gebundeneAnwendungen(board, register) {
    const genannt = board && board.anwendungen;
    if (!Array.isArray(genannt)) return register.length === 1 ? [register[0]] : [];
    return genannt.map(k => register.find(a => a.kuerzel === k)).filter(Boolean);
  }

  /** Bindung im Spalten-Dialog: schaltet `kuerzel` im gerechneten Stand um (fehlt `applications`, der Standard);
      leeres Kürzel = „keine“. Ergebnis ist immer eine ausdrückliche Liste für PUT …/anwendungen (R00062). */
  function bindungUmschalten(anwendungen, kuerzel, register) {
    if (!kuerzel) return [];
    const jetzt = Array.isArray(anwendungen) ? anwendungen : gebundeneAnwendungen({ anwendungen }, register).map(a => a.kuerzel);
    return jetzt.includes(kuerzel) ? jetzt.filter(k => k !== kuerzel) : [...jetzt, kuerzel];
  }

  /** Die Einstellungen, die der erste Start anlegt (R00002): Ich, die gewählten Agenten, keine Klassen. */
  function ersteEinstellungen(f) {
    const ag = [['cl', 'Claude'], ['cx', 'Codex']].filter(([k]) => f.agenten[k]);
    return {
      personen: [{ kuerzel: f.kuerzel.trim(), name: f.name.trim(), art: 'human' }, ...ag.map(([k, n]) => ({ kuerzel: k, name: n, art: 'agent' }))],
      klassen: [],
      quellen: { repository: '' },
    };
  }

  Object.assign(ziel, { ersteEinstellungen, REPOSITORY_ZUSTAENDE, pfadeZurDatei, repositoryZustand, anwendungenZahl, gebundeneAnwendungen, bindungUmschalten });
})(typeof module !== 'undefined' ? module.exports : window);
