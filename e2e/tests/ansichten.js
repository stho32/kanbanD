// Die Ansichten der Anwendung, geteilt von Kontrast- und Zielprobe (ADR-0012 Regel 6): eine Liste, damit keine Probe eine Ansicht auslässt

const BERICHTE = ['stundenzettel', 'kreuz', 'verlauf', 'durchlauf', 'prognose', 'fieber', 'kosten', 'bestand'];

/** Je Ansicht Name und Adresse (Hash); Board und WBS-Sicht tragen den Slug des Testbestands. */
function ansichtenDerAnwendung({ board, wbs }) {
  return [
    { ansicht: 'Board', adresse: '#/board/' + board },
    { ansicht: 'Aufgabenliste', adresse: '#/aufgaben' },
    { ansicht: 'Personen', adresse: '#/personen' },
    { ansicht: 'Einrichten', adresse: '#/einrichten' },
    ...BERICHTE.map(name => ({ ansicht: 'Bericht ' + name, adresse: '#/berichte/' + name })),
    { ansicht: 'WBS-Sicht', adresse: '#/wbs/' + wbs },
  ];
}

module.exports = { ansichtenDerAnwendung };
