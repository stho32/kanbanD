// Unit-Tests der Kopfzeile nach M3-Breakpoints (R00101, B0264)
const test = require('node:test');
const assert = require('node:assert');
const { stufeAusBreite, kopfPlaetze } = require('../../web/kopfzeile.js');

const BREITEN = [375, 414, 600, 768, 900, 1024, 1100, 1280, 1366, 1440];

test('Stufe je Breite: compact < 600, medium 600–839, expanded 840–1199, large ab 1200', () => {
  assert.deepStrictEqual(BREITEN.map(stufeAusBreite), ['compact', 'compact', 'medium', 'medium', 'expanded', 'expanded', 'expanded', 'large', 'large', 'large']);
});

test('Stufe an den Grenzen', () => {
  assert.deepStrictEqual([320, 599, 600, 839, 840, 1199, 1200].map(stufeAusBreite), ['compact', 'compact', 'medium', 'medium', 'expanded', 'expanded', 'large']);
});

const alleInDerKopfzeile = plaetze => plaetze.reihen.flat();

test('„Neue Aufgabe“ und der Bereichsfilter stehen auf dem Board bei jeder Breite in der Kopfzeile, nie im Menü', () => {
  for (const breite of BREITEN) {
    const plaetze = kopfPlaetze(stufeAusBreite(breite), 'board');
    assert.ok(alleInDerKopfzeile(plaetze).includes('neu'), `neu bei ${breite}`);
    assert.ok(alleInDerKopfzeile(plaetze).some(k => k === 'bereich' || k === 'bereichChips'), `Bereich bei ${breite}`);
    assert.ok(!plaetze.mehr.includes('neu') && !plaetze.mehr.some(k => k.startsWith('bereich')), `nicht im Menü bei ${breite}`);
  }
});

test('Bereich unter 840 px als Filter-Chips, darüber als bisherige Gruppe', () => {
  assert.ok(alleInDerKopfzeile(kopfPlaetze('compact', 'board')).includes('bereichChips'));
  assert.ok(alleInDerKopfzeile(kopfPlaetze('medium', 'board')).includes('bereichChips'));
  assert.ok(alleInDerKopfzeile(kopfPlaetze('expanded', 'board')).includes('bereich'));
  assert.ok(alleInDerKopfzeile(kopfPlaetze('large', 'board')).includes('bereich'));
});

test('large: eine Zeile mit Filter, Bereich, „Neue Aufgabe“; Signale oben, Spalten, Darstellung im Menü „Mehr“', () => {
  assert.deepStrictEqual(kopfPlaetze('large', 'board'), {
    reihen: [['board', 'navigation', 'filter', 'bereich', 'neu', 'luecke', 'lauf', 'live', 'ich', 'mehr']],
    mehr: ['signale', 'spalten', 'darstellung'],
  });
});

test('expanded: oben Board, Navigation, Timer, Person, Mehr; unten Filter, Bereich, „Neue Aufgabe“', () => {
  assert.deepStrictEqual(kopfPlaetze('expanded', 'board').reihen, [
    ['board', 'navigation', 'luecke', 'lauf', 'live', 'ich', 'mehr'],
    ['filter', 'bereich', 'neu'],
  ]);
});

test('medium: oben Board, Navigation, Mehr; unten Filter, Chips, „Neue Aufgabe“, Timer, Person', () => {
  assert.deepStrictEqual(kopfPlaetze('medium', 'board').reihen, [
    ['board', 'navigation', 'luecke', 'mehr'],
    ['filter', 'bereichChips', 'neu', 'luecke', 'lauf', 'live', 'ich'],
  ]);
});

test('compact: Seiten-Menü statt Navigation, „+“ direkt; Timer und Ich zusätzlich im Menü „Mehr“', () => {
  assert.deepStrictEqual(kopfPlaetze('compact', 'board'), {
    reihen: [['board', 'seitenmenue', 'neu', 'luecke', 'lauf', 'live', 'ich', 'mehr'], ['filter', 'bereichChips']],
    mehr: ['signale', 'spalten', 'darstellung', 'lauf', 'ich'],
  });
});

test('Aufgabenliste: Filter und Listenbereich statt Board-Werkzeug, im Menü nur die Darstellung', () => {
  assert.deepStrictEqual(kopfPlaetze('large', 'aufgaben'), {
    reihen: [['board', 'navigation', 'filter', 'listenbereich', 'luecke', 'lauf', 'live', 'ich', 'mehr']],
    mehr: ['darstellung'],
  });
  assert.deepStrictEqual(kopfPlaetze('compact', 'aufgaben').reihen, [['board', 'seitenmenue', 'luecke', 'lauf', 'live', 'ich', 'mehr'], ['filter', 'listenbereich']]);
});

test('übrige Ansichten: kein Werkzeug; medium bricht in zwei Zeilen um, keine leere Zeile', () => {
  assert.deepStrictEqual(kopfPlaetze('expanded', 'sonst').reihen, [['board', 'navigation', 'luecke', 'lauf', 'live', 'ich', 'mehr']]);
  assert.deepStrictEqual(kopfPlaetze('medium', 'sonst').reihen, [['board', 'navigation', 'luecke', 'mehr'], ['luecke', 'lauf', 'live', 'ich']]);
  assert.deepStrictEqual(kopfPlaetze('compact', 'sonst').reihen, [['board', 'seitenmenue', 'luecke', 'lauf', 'live', 'ich', 'mehr']]);
});

test('unbekannte Stufe oder Ansicht ist ein sichtbarer Fehler', () => {
  assert.throws(() => kopfPlaetze('riesig', 'board'), /Stufe/);
  assert.throws(() => kopfPlaetze('large', 'kalender'), /Ansicht/);
});
