// R00100 Bestand nach Labels: reine Rechnung in web/berichte.js
const test = require('node:test');
const assert = require('node:assert');
const { offeneAufgaben, praefixe, vorschlag, bestandNachLabels, dringendste, zellName } = require('../../web/berichte.js');

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

const KLASSEN = ['sicherheit', 'eol', 'drift'];
const bestand = ({ aufgaben, board }, zeilen = 'repo', spalten = 'nc') => bestandNachLabels(aufgaben, board, KLASSEN, zeilen, spalten);
const namen = achse => achse.map(x => x.wert);
const zahlen = t => t.zellen.map(z => z.map(x => x.zahl));
const zelle = (t, zeile, spalte) => t.zellen[namen(t.zeilen).indexOf(zeile)][namen(t.spalten).indexOf(spalte)];

test('B0347 Grundbestand: Zahlen, Farbe der dringendsten Klasse, Summen zählen jede Aufgabe einmal', () => {
  const t = bestand(grundbestand());
  assert.deepStrictEqual([namen(t.zeilen), namen(t.spalten)], [['lager', 'shop', '(ohne repo)'], ['304', '305', '(ohne nc)']]);
  assert.deepStrictEqual(t.zeilen.map(x => x.ohne), [false, false, true]);
  assert.deepStrictEqual(zahlen(t), [[1, 0, 1], [2, 1, 0], [0, 0, 0]], '#6 in „Fertig“ und #7 archiviert zählen nicht');
  assert.deepStrictEqual(zelle(t, 'shop', '304'), { zahl: 2, nummern: [1, 2], jeKlasse: { sicherheit: 1, drift: 1 }, dringendste: 'sicherheit' });
  assert.deepStrictEqual([zelle(t, 'shop', '305').dringendste, zelle(t, 'lager', '304').dringendste, zelle(t, 'lager', '(ohne nc)').dringendste], ['eol', '', 'drift']);
  assert.deepStrictEqual(zelle(t, 'shop', '(ohne nc)'), { zahl: 0, nummern: [], jeKlasse: {}, dringendste: null }, 'leere Zelle');
  assert.deepStrictEqual(t.summen, { zeilen: [2, 3, 0], spalten: [3, 1, 1], gesamt: 5 });
});

test('B0347 #8 mit zwei nc-Werten: zählt in beiden Zellen, in den Summen einmal (shop 4, nicht 5)', () => {
  const t = bestand(grundbestand([aufgabe(8, ['repo:shop', 'nc:304', 'nc:305'], 'drift')]));
  assert.deepStrictEqual([zelle(t, 'shop', '304').zahl, zelle(t, 'shop', '305').zahl, zelle(t, 'shop', '305').dringendste], [3, 2, 'eol'], '#3 eol ist dringender als #8 drift');
  assert.deepStrictEqual(t.summen, { zeilen: [2, 4, 0], spalten: [4, 2, 1], gesamt: 6 });
});

test('B0347 Grenzwert Präfix: nc:304:a bildet die Spalte 304:a, dringend keinen Präfix', () => {
  const t = bestand(grundbestand([aufgabe(9, ['repo:shop', 'nc:304:a']), aufgabe(10, ['dringend', 'repo:lager'], 'drift')]));
  assert.deepStrictEqual(namen(t.spalten), ['304', '304:a', '305', '(ohne nc)']);
  assert.deepStrictEqual([zelle(t, 'shop', '304:a').zahl, zelle(t, 'lager', '(ohne nc)').nummern, t.summen.gesamt], [1, [5, 10], 7]);
  assert.ok(![...namen(t.zeilen), ...namen(t.spalten)].some(w => w.includes('dringend')));
});

test('B0347 Groß und Klein: Repo:Shop und NC:304 fallen in shop × 304, angezeigt wie bei #1', () => {
  const t = bestand(grundbestand([aufgabe(11, ['Repo:Shop', 'NC:304'], 'eol')]));
  assert.deepStrictEqual([namen(t.zeilen), namen(t.spalten)], [['lager', 'shop', '(ohne repo)'], ['304', '305', '(ohne nc)']]);
  assert.deepStrictEqual(zelle(t, 'shop', '304').nummern, [1, 2, 11]);
  assert.deepStrictEqual([t.summen.zeilen[1], t.summen.spalten[0], t.summen.gesamt], [4, 4, 6]);
  const klein11 = bestand(grundbestand([aufgabe(0, ['Repo:SHOP', 'nc:304'])]));
  assert.strictEqual(namen(klein11.zeilen)[1], 'SHOP', 'die kleinste Nummer bestimmt die Schreibweise');
  assert.strictEqual(bestand(grundbestand(), 'REPO', 'Nc').summen.gesamt, 5, 'auch die Achsen ohne Groß/Klein');
});

test('B0347 Ordnung: Ziffernfolgen als Zahl, sonst alphabetisch, „(ohne)“ am Ende', () => {
  const t = bestand(grundbestand([aufgabe(12, ['repo:shop', 'nc:1000'], 'drift'), aufgabe(13, ['repo:Äpfel', 'nc:304'])]));
  assert.deepStrictEqual(namen(t.spalten), ['304', '305', '1000', '(ohne nc)']);
  assert.deepStrictEqual(namen(t.zeilen), ['Äpfel', 'lager', 'shop', '(ohne repo)']);
});

test('B0347 Leerfall: alles in der Abschlussspalte oder archiviert → gesamt 0, nur „(ohne)“', () => {
  const { aufgaben } = grundbestand();
  const board = boardMit([7], aufgaben.filter(a => a.nummer !== 7).map(a => a.nummer));
  const t = bestandNachLabels(aufgaben, board, KLASSEN, 'repo', 'nc');
  assert.deepStrictEqual([namen(t.zeilen), namen(t.spalten), zahlen(t), t.summen], [['(ohne repo)'], ['(ohne nc)'], [[0]], { zeilen: [0], spalten: [0], gesamt: 0 }]);
});

test('B0347 dringendste: erste Klasse der Reihenfolge, unbekannte danach, ohne Klasse zuletzt, leer null', () => {
  assert.strictEqual(dringendste(['drift', 'eol'], KLASSEN), 'eol');
  assert.strictEqual(dringendste(['', 'drift'], KLASSEN), 'drift');
  assert.strictEqual(dringendste(['', 'alt'], KLASSEN), 'alt', 'eine Klasse, die es nicht mehr gibt, ist dringender als keine');
  assert.strictEqual(dringendste(['alt', 'drift'], KLASSEN), 'drift');
  assert.strictEqual(dringendste([''], KLASSEN), '');
  assert.strictEqual(dringendste([], KLASSEN), null);
});

test('B0347 Leistung: 500 offene Aufgaben, 30 × 30 Werte in unter 200 ms gerechnet', () => {
  const aufgaben = Array.from({ length: 500 }, (_, i) => aufgabe(i + 1, [`repo:r${i % 30}`, `nc:${100 + (i * 7) % 30}`], KLASSEN[i % 3]));
  const board = boardMit(aufgaben.map(a => a.nummer));
  const start = performance.now();
  const t = bestandNachLabels(aufgaben, board, KLASSEN, 'repo', 'nc');
  const dauer = performance.now() - start;
  assert.deepStrictEqual([t.zeilen.length, t.spalten.length, t.summen.gesamt], [31, 31, 500]);
  assert.ok(dauer < 200, `${dauer.toFixed(1)} ms`);
});

const KLASSEN_MIT_NAMEN = [{ schluessel: 'sicherheit', bezeichnung: 'Sicherheit' }, { schluessel: 'eol', bezeichnung: 'EOL' }, { schluessel: 'drift', bezeichnung: 'Drift' }];
const ACHSEN = { zeilen: 'repo', spalten: 'nc' };
/** Name einer Stelle der Tabelle; null als Zeile oder Spalte heißt Summe. */
function nameAn(t, zeile, spalte) {
  const i = namen(t.zeilen).indexOf(zeile), j = namen(t.spalten).indexOf(spalte);
  const ort = { zeile: t.zeilen[i] || null, spalte: t.spalten[j] || null };
  if (ort.zeile && ort.spalte) return zellName({ ...ort, zelle: t.zellen[i][j] }, ACHSEN, KLASSEN_MIT_NAMEN);
  let zahl = t.summen.gesamt;
  if (ort.zeile) zahl = t.summen.zeilen[i];
  if (ort.spalte) zahl = t.summen.spalten[j];
  return zellName({ ...ort, zelle: { zahl, jeKlasse: {} } }, ACHSEN, KLASSEN_MIT_NAMEN);
}

test('B0357 Name einer klickbaren Zahl: Kopf, Zahl, Klassen in der Reihenfolge der Dringlichkeit, ohne Klasse am Ende', () => {
  const t = bestand(grundbestand([aufgabe(14, ['repo:shop', 'nc:304'])]));
  assert.strictEqual(nameAn(bestand(grundbestand()), 'shop', '304'), 'repo:shop × nc:304: 2 offen — Sicherheit 1 · Drift 1 · ohne Abschlussspalte, ohne Filter der Berichte');
  assert.strictEqual(nameAn(bestand(grundbestand()), 'lager', '304'), 'repo:lager × nc:304: 1 offen — ohne Klasse 1 · ohne Abschlussspalte, ohne Filter der Berichte');
  assert.strictEqual(nameAn(t, 'shop', '304'), 'repo:shop × nc:304: 3 offen — Sicherheit 1 · Drift 1 · ohne Klasse 1 · ohne Abschlussspalte, ohne Filter der Berichte');
});

test('B0357 Name von „(ohne …)“, Summen und leerer Zelle: nicht klickbar', () => {
  const t = bestand(grundbestand());
  assert.strictEqual(nameAn(t, 'lager', '(ohne nc)'), 'repo:lager × (ohne nc): 1 offen — Drift 1 · nicht klickbar');
  assert.strictEqual(nameAn(t, 'shop', null), 'Summe repo:shop: 3 offen · nicht klickbar');
  assert.strictEqual(nameAn(t, null, '304'), 'Summe nc:304: 3 offen · nicht klickbar');
  assert.strictEqual(nameAn(t, null, '(ohne nc)'), 'Summe (ohne nc): 1 offen · nicht klickbar');
  assert.strictEqual(nameAn(t, null, null), 'Summe gesamt: 5 offen · nicht klickbar');
  assert.strictEqual(nameAn(t, 'shop', '(ohne nc)'), 'repo:shop × (ohne nc): keine offen');
  assert.strictEqual(nameAn(t, '(ohne repo)', null), 'Summe (ohne repo): keine offen · nicht klickbar');
});

test('B0357 Name mit einer Klasse, die es unter classes nicht mehr gibt: mit ihrem Schlüssel vor „ohne Klasse“', () => {
  const zelle = { zahl: 3, jeKlasse: { '': 1, alt: 1, eol: 1 } };
  const ort = { zeile: { wert: 'shop', ohne: false }, spalte: { wert: '304', ohne: false }, zelle };
  assert.strictEqual(zellName(ort, ACHSEN, KLASSEN_MIT_NAMEN), 'repo:shop × nc:304: 3 offen — EOL 1 · alt 1 · ohne Klasse 1 · ohne Abschlussspalte, ohne Filter der Berichte');
});
