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
const getippt = (wert, jahrVorDerZiffer) => datumsaenderung({ wert, verlassen: false, jahrVorDerZiffer });

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
  assert.strictEqual(datumsaenderung({ wert: '2026-11-12', verlassen: false }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '', verlassen: false }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '2026-11-12', verlassen: true }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '', verlassen: true }), 'speichern');
});

test('R00173 AK 3: ein Jahr unter 1000 wird nie gespeichert — im Feld gehalten, beim Verlassen verworfen', () => {
  assert.strictEqual(datumsaenderung({ wert: '0002-11-12', verlassen: false }), 'halten');
  assert.strictEqual(datumsaenderung({ wert: '0999-12-31', verlassen: false }), 'halten');
  assert.strictEqual(datumsaenderung({ wert: '1000-01-01', verlassen: false }), 'speichern');
  assert.strictEqual(datumsaenderung({ wert: '0002-11-12', verlassen: true }), 'verwerfen');
  assert.strictEqual(datumsaenderung({ wert: '0999-12-31', verlassen: true }), 'verwerfen');
});

test('R00173: fertig ist ein Datum mit vierstelligem Jahr; ein leeres Feld trägt kein Jahr', () => {
  assert.deepStrictEqual(['2026-11-12', '1000-01-01', '0999-12-31', '0002-11-12', ''].map(datumFertig), [true, true, false, false, false]);
  assert.deepStrictEqual(['2026-11-12', '0002-11-12', '', undefined].map(jahrDesDatums), [2026, 2, null, null]);
});

test('R00173 B1: ein getippter Zwischenstand, den es als Datum nicht gibt (31.11.), leert den Wert — gehalten, nicht gespeichert', () => {
  assert.strictEqual(datumsaenderung({ wert: '', verlassen: false, jahrVorDerZiffer: 2026 }), 'halten');
});

test('R00173 B1: nach dem leeren Zwischenstand ist „31.01.2026“ und „31.12.2026“ noch nicht fertig — das Jahr 2026 stand schon vor dem Tippen im Feld', () => {
  assert.strictEqual(getippt('2026-01-31', 2026), 'halten');
  assert.strictEqual(getippt('2026-12-31', 2026), 'halten');
  // erst das getippte Jahr (… 0202 → 2026) macht das Datum fertig
  assert.strictEqual(getippt('2026-12-31', 202), 'speichern');
});

test('R00173 B1: Tag und Monat getippt, das Jahr stand schon im Feld und wurde nicht getippt — gehalten, auch wenn vorher kein gültiges Datum im Feld war', () => {
  assert.strictEqual(getippt('2026-01-12', null), 'halten');
});

test('R00173 B1: der 29.02. ist während des Tippens des Jahrs nur zeitweise ein Datum (0020 ja, 0202 nein) — mit dem fertigen 2024 wird gespeichert', () => {
  assert.deepStrictEqual([['0020-02-29', null], ['', 20], ['2024-02-29', 20]].map(([wert, vorher]) => getippt(wert, vorher)), ['halten', 'halten', 'speichern']);
});

/* R00179: welche Taste eine getippte Datumseingabe beginnt, bestehen lässt oder beendet */
const { datumstaste } = require('../../web/eingabe.js');
const taste = (key, zusatz = {}) => datumstaste({ key, ctrlKey: false, metaKey: false, altKey: false, ...zusatz });

test('R00179: jede Ziffer beginnt die getippte Datumseingabe bzw. setzt sie fort', () => {
  assert.deepStrictEqual(['0', '3', '9'].map(key => taste(key)), ['beginnt', 'beginnt', 'beginnt']);
});

test('R00179: Trenner, Pfeile, Tab, Rücktaste, Umschalt und Enter lassen die Eingabe, wie sie ist — sie lösen nichts aus, das gezeichnet werden müsste', () => {
  for (const key of ['.', '/', '-', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace', 'Shift', 'x', 'Enter']) assert.strictEqual(taste(key), 'bleibt', key);
});

test('R00179: Esc und jedes Tastenkürzel beenden die Eingabe — was sie auslösen, darf nicht hinter dem Aufschub hängen bleiben', () => {
  assert.strictEqual(taste('Escape'), 'endet');
  assert.strictEqual(taste('Enter', { ctrlKey: true }), 'endet');
  assert.strictEqual(taste('z', { ctrlKey: true }), 'endet');
  assert.strictEqual(taste('z', { metaKey: true }), 'endet');
  assert.strictEqual(taste('ArrowLeft', { altKey: true }), 'endet');
  // auch eine Ziffer mit Strg ist ein Kürzel, keine Eingabe
  assert.strictEqual(taste('1', { ctrlKey: true }), 'endet');
});

test('R00191 AK 5: Strg, Alt, Meta und AltGr allein gedrückt lassen die Eingabe laufen — erst mit einer zweiten Taste sind sie ein Kürzel', () => {
  // beim Druck der Modifikatortaste selbst meldet der Browser sie schon als gesetzt
  const allein = { Control: { ctrlKey: true }, Alt: { altKey: true }, Meta: { metaKey: true }, AltGraph: { ctrlKey: true, altKey: true } };
  for (const [key, zusatz] of Object.entries(allein)) assert.strictEqual(taste(key, zusatz), 'bleibt', key);
  assert.strictEqual(taste('Enter', { ctrlKey: true }), 'endet');
  assert.strictEqual(taste('ArrowLeft', { altKey: true }), 'endet');
  assert.strictEqual(taste('z', { metaKey: true }), 'endet');
});
