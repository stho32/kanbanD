// R00100 Bestand nach Labels: reine Rechnung in web/berichte.js
const test = require('node:test');
const assert = require('node:assert');
const { offeneAufgaben, praefixe, vorschlag } = require('../../web/berichte.js');

const aufgabe = (nummer, labels, klasse = '', mehr = {}) => ({ nummer, titel: `A${nummer}`, klasse, labels, zustaendige: [], archiviert: false, ...mehr });
const boardMit = (eingang, fertig = []) => ({ slug: 'fabrik', spalten: [{ name: 'Eingang', aufgaben: eingang }, { name: 'Fertig', aufgaben: fertig }] });

/** Grundbestand der Akzeptanzkriterien: #1–#5 offen in „Eingang“, #6 in „Fertig“, #7 archiviert. */
function grundbestand(dazu = []) {
  const aufgaben = [
    aufgabe(1, ['repo:shop', 'nc:304'], 'sicherheit'),
    aufgabe(2, ['repo:shop', 'nc:304'], 'drift'),
    aufgabe(3, ['repo:shop', 'nc:305'], 'eol'),
    aufgabe(4, ['repo:lager', 'nc:304']),
    aufgabe(5, ['repo:lager'], 'drift'),
    aufgabe(6, ['repo:shop', 'nc:304']),
    aufgabe(7, ['repo:shop', 'nc:304'], '', { archiviert: true }),
    ...dazu,
  ];
  const eingang = aufgaben.filter(a => a.nummer !== 6).map(a => a.nummer);
  return { aufgaben, board: boardMit(eingang, [6]) };
}

/** Offene Aufgaben mit je einem Satz Labels, numeriert ab 1. */
function mitLabels(...labelSaetze) {
  const aufgaben = labelSaetze.map((l, i) => aufgabe(i + 1, l));
  return offeneAufgaben(aufgaben, boardMit(aufgaben.map(a => a.nummer)));
}

test('B0346 offen: auf dem Board, nicht archiviert, nicht in der letzten Spalte', () => {
  const { aufgaben, board } = grundbestand();
  const woanders = aufgabe(99, ['repo:shop']);
  assert.deepStrictEqual(offeneAufgaben([woanders, ...aufgaben], board).map(a => a.nummer), [1, 2, 3, 4, 5], '#6 in „Fertig“, #7 archiviert, #99 nicht auf dem Board');
});

test('B0346 Präfixe: Häufigkeit je Präfix = offene Aufgaben mit mindestens einem Label davon', () => {
  const { aufgaben, board } = grundbestand([aufgabe(8, ['repo:shop', 'nc:304', 'nc:305'], 'drift')]);
  assert.deepStrictEqual(praefixe(offeneAufgaben(aufgaben, board)), [
    { praefix: 'repo', schluessel: 'repo', anzahl: 6 },
    { praefix: 'nc', schluessel: 'nc', anzahl: 5 },
  ], '#8 trägt nc zweimal und zählt einmal; #5 ohne nc');
});

test('B0346 Grenzwert: ohne Doppelpunkt kein Präfix, leerer Präfix kein Präfix, nc:304:a hat das Präfix nc', () => {
  const p = praefixe(mitLabels(['dringend'], [':x'], ['nc:304:a'], ['nc:304']));
  assert.deepStrictEqual(p, [{ praefix: 'nc', schluessel: 'nc', anzahl: 2 }]);
});

test('B0346 Groß und Klein: Repo und repo sind ein Präfix, angezeigt wie bei der kleinsten Nummer', () => {
  const offene = mitLabels(['Repo:Shop'], ['repo:shop'], ['REPO:x', 'nc:1']);
  assert.deepStrictEqual(praefixe(offene), [
    { praefix: 'Repo', schluessel: 'repo', anzahl: 3 },
    { praefix: 'nc', schluessel: 'nc', anzahl: 1 },
  ]);
  const umgekehrt = offene.slice().reverse();
  assert.strictEqual(praefixe(umgekehrt)[0].praefix, 'Repo', 'die Nummer entscheidet, nicht die Reihenfolge der Eingabe');
});

test('B0346 Vorschlag: die zwei häufigsten, häufigster als Zeilen', () => {
  const repo5nc4 = mitLabels(['repo:a', 'nc:1'], ['repo:b', 'nc:2'], ['repo:c', 'nc:3'], ['repo:d', 'nc:4'], ['repo:e'], ['team:x']);
  assert.deepStrictEqual(vorschlag(praefixe(repo5nc4)), { zeilen: 'repo', spalten: 'nc' });
});

test('B0346 Vorschlag bei Gleichstand alphabetisch: team, repo, nc je dreimal → nc × repo', () => {
  const je3 = mitLabels(['team:a', 'repo:a', 'nc:1'], ['team:b', 'repo:b', 'nc:2'], ['team:c', 'repo:c', 'nc:3']);
  assert.deepStrictEqual(vorschlag(praefixe(je3)), { zeilen: 'nc', spalten: 'repo' });
});

test('B0346 Vorschlag: weniger als zwei Präfixe → null', () => {
  assert.strictEqual(vorschlag(praefixe(mitLabels(['repo:a'], ['Repo:b']))), null, 'nur repo, auch in zwei Schreibweisen');
  assert.strictEqual(vorschlag(praefixe(mitLabels(['dringend'], []))), null, 'gar kein Präfix');
  assert.strictEqual(vorschlag([]), null, 'keine offene Aufgabe');
});
