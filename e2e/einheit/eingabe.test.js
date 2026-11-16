// Unit-Tests der Eingabe-Auswertung (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { zeilenAusText } = require('../../web/eingabe.js');

test('Zeilen ohne Listenzeichen und Leerzeilen', () => {
  assert.deepStrictEqual(zeilenAusText('- a\n\n* b\n1. c\n- [ ] d\n  e  \r\n2) f\n+ g\n- [x] h'), ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  assert.deepStrictEqual(zeilenAusText('-nicht entfernt\n#12 bleibt'), ['-nicht entfernt', '#12 bleibt']);
  assert.deepStrictEqual(zeilenAusText(''), []);
  assert.deepStrictEqual(zeilenAusText(undefined), []);
});

const { schnelleingabe, datumLesen } = require('../../web/eingabe.js');
const heute = new Date(2026, 9, 18);
const umfeld = { personen: [{ kuerzel: 'st' }, { kuerzel: 'mi' }], klassen: [{ schluessel: 'bug' }] };

test('Schnelleingabe nimmt Bekanntes heraus und lässt Unbekanntes stehen', () => {
  assert.deepStrictEqual(schnelleingabe('Login reparieren @mi @zz class:bug class:gibts label:ui due:morgen I0007', umfeld, heute), {
    titel: 'Login reparieren @zz class:gibts', zustaendige: ['mi'], klasse: 'bug', labels: ['ui'], faellig: '2026-10-19', herkunft: ['I0007'],
  });
  const zwei = schnelleingabe('@ST @mi label:a label:a R00014 x', umfeld, heute);
  assert.deepStrictEqual([zwei.zustaendige, zwei.labels, zwei.herkunft, zwei.titel], [['st', 'mi'], ['a'], ['R00014'], 'x']);
  assert.strictEqual(schnelleingabe('nur Titel', umfeld, heute).klasse, null);
  assert.strictEqual(schnelleingabe('', umfeld, heute).titel, '');
});

test('Datumsformen', () => {
  assert.strictEqual(datumLesen('heute', heute), '2026-10-18');
  assert.strictEqual(datumLesen('übermorgen', heute), '2026-10-20');
  assert.strictEqual(datumLesen('+7', heute), '2026-10-25');
  assert.strictEqual(datumLesen('24.12.', heute), '2026-12-24');
  assert.strictEqual(datumLesen('1.2.2027', heute), '2027-02-01');
  assert.strictEqual(datumLesen('2026-11-03', heute), '2026-11-03');
  assert.strictEqual(datumLesen('31.02.', heute), null);
  assert.strictEqual(datumLesen('bald', heute), null);
  assert.strictEqual(schnelleingabe('a due:31.02.', umfeld, heute).titel, 'a due:31.02.');
});

/* ── R00173 F0141: Datumsfeld, das ohne Knopf speichert — ein unfertig getipptes Datum wird nicht gespeichert ── */
const { datumFertig, datumsaenderung, jahrDesDatums } = require('../../web/eingabe.js');
const getippt = (wert, jahrVorDerZiffer) => datumsaenderung({ wert, hatFokus: true, jahrVorDerZiffer });

test('R00173 AK 1: „12112026“ ins leere Feld getippt — 0002, 0020 und 0202 werden gehalten, erst 2026 wird gespeichert', () => {
  assert.deepStrictEqual(
    [['0002-11-12', null], ['0020-11-12', 2], ['0202-11-12', 20], ['2026-11-12', 202]].map(([wert, vorher]) => getippt(wert, vorher)),
    ['halten', 'halten', 'halten', 'speichern']);
});

test('R00173 US-2: über ein gespeichertes Datum getippt — Tag und Monat werden gehalten, obwohl das Feld ein gültiges Datum trägt', () => {
  assert.strictEqual(getippt('2026-11-12', 2026), 'halten');
  assert.strictEqual(getippt('2026-01-12', 2026), 'halten');
  // ein unmögliches Datum (30.02.) leert den Wert des Felds: getippt wird weiter, gelöscht wird nichts
  assert.strictEqual(getippt('', null), 'halten');
  assert.strictEqual(getippt('0002-11-12', 2026), 'halten');
  assert.strictEqual(getippt('2027-11-12', 202), 'speichern');
});

test('R00173 AK 4: Kalender, Pfeiltasten und Leeren kommen nicht aus einer Ziffer — gespeichert wie vor der Karte', () => {
  assert.strictEqual(datumsaenderung({ wert: '2026-11-12', hatFokus: true }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '', hatFokus: true }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '2026-11-12', hatFokus: false }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '', hatFokus: false }), 'speichern');
});

test('R00173 AK 3: ein Jahr unter 1000 wird nie gespeichert — mit Fokus gehalten, beim Verlassen verworfen', () => {
  assert.strictEqual(datumsaenderung({ wert: '0002-11-12', hatFokus: true }), 'halten');
  assert.strictEqual(datumsaenderung({ wert: '0999-12-31', hatFokus: true }), 'halten');
  assert.strictEqual(datumsaenderung({ wert: '1000-01-01', hatFokus: true }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '0002-11-12', hatFokus: false }), 'verwerfen');
  assert.strictEqual(datumsaenderung({ wert: '0999-12-31', hatFokus: false }), 'verwerfen');
});

test('R00173: fertig ist ein Datum mit vierstelligem Jahr; ein leeres Feld trägt kein Jahr', () => {
  assert.deepStrictEqual(['2026-11-12', '1000-01-01', '0999-12-31', '0002-11-12', ''].map(datumFertig), [true, true, false, false, false]);
  assert.deepStrictEqual(['2026-11-12', '0002-11-12', '', undefined].map(jahrDesDatums), [2026, 2, null, null]);
});
