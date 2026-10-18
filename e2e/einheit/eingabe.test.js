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
