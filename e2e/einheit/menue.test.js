// Unit-Tests der Menüs (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { kartenMenue, menueSchritt } = require('../../web/menue.js');

const a = { nummer: 3, titel: 'drei', klasse: 'bug', faellig: null, zustaendige: [] };
const u = { spalten: ['Zu erledigen', 'In Arbeit', 'Erledigt'], spalte: 'Zu erledigen', klassen: [{ schluessel: 'bug', bezeichnung: 'Fehler' }, { schluessel: 'ux', bezeichnung: 'UX' }], boards: [{ slug: 'test', titel: 'Test', spalte: 'Bereit' }], ich: 'st', meinerLaeuft: true, meine: false };

test('Menü der Karte', () => {
  const m = kartenMenue(a, u);
  const texte = m.map(e => e.trenner ? '—' : e.text);
  assert.deepStrictEqual(texte, ['Öffnen', '—', 'Timer stoppen', 'Mir zuweisen', 'Zuständige zuweisen …', 'Umbenennen', '—', 'Verschieben nach', 'Klasse', 'Fälligkeit', 'Auf Board legen', '—', 'Verweis kopieren', 'Archivieren']);
  assert.strictEqual(m[2].arg, '3|st');
  assert.deepStrictEqual([m[4].act, m[4].arg, m[4].kuerzel, m[4].unter], ['zuweisen', '3', 'p', undefined], 'Dialog statt Untermenü (R00064)');
  const spalten = m[7].unter;
  assert.deepStrictEqual(spalten.map(s => [s.text, s.kuerzel, !!s.aktuell]), [['Zu erledigen', '1', true], ['In Arbeit', '2', false], ['Erledigt', '3', false]]);
  assert.ok(m[8].unter.find(k => k.text === 'Fehler').aktuell);
  assert.deepStrictEqual(m[9].unter.map(f => f.text), ['heute', 'morgen', '+1 Woche'], 'ohne Fälligkeit kein „entfernen“');
  assert.strictEqual(m[10].unter[0].arg, 'test|3|Bereit');
  const ohne = kartenMenue({ ...a, faellig: '2026-10-20' }, { ...u, boards: [], meinerLaeuft: false, meine: true });
  assert.ok(!ohne.some(e => e.text === 'Auf Board legen'));
  assert.ok(ohne.some(e => e.text === 'Timer starten') && ohne.some(e => e.text === 'Mich abnehmen'));
  assert.ok(ohne.find(e => e.text === 'Fälligkeit').unter.some(e => e.text === 'entfernen'));
});

test('Menüschritt überspringt Trenner und Aktuelles, mit Umlauf', () => {
  const m = kartenMenue(a, u);
  assert.strictEqual(menueSchritt(m, 0, 1), 2);
  assert.strictEqual(menueSchritt(m, 0, -1), m.length - 1);
  assert.strictEqual(menueSchritt(m, m.length - 1, 1), 0);
  assert.strictEqual(menueSchritt(m, 5, 'anfang'), 0);
  assert.strictEqual(menueSchritt(m, 0, 'ende'), m.length - 1);
  assert.strictEqual(menueSchritt(m[7].unter, -1, 1), 1, 'aktuelle Spalte ist nicht wählbar');
  assert.strictEqual(menueSchritt([{ trenner: true }], 0, 1), -1);
});

const { spaltenMenue, listenMenue } = require('../../web/menue.js');

test('Menü des Spaltenkopfs', () => {
  const t = m => m.map(e => e.trenner ? '—' : e.text);
  assert.deepStrictEqual(t(spaltenMenue('Erledigt', 2, 3, 2)), ['Karte hinzufügen', 'Alle 2 Karten archivieren', '—', 'Spalte nach links', 'Spalten einrichten …']);
  assert.deepStrictEqual(t(spaltenMenue('Zu erledigen', 0, 3, 0)), ['Karte hinzufügen', '—', 'Spalte nach rechts', 'Spalten einrichten …']);
  assert.strictEqual(spaltenMenue('A', 1, 3, 1)[1].text, 'Alle 1 Karte archivieren');
  assert.strictEqual(spaltenMenue('A', 1, 3, 0)[3].arg, '1|1');
});

test('Menü der Listenzeile', () => {
  const a = { nummer: 4, titel: 'vier', archiviert: null };
  const m = listenMenue(a, { liegtAuf: [{ slug: 'e', titel: 'Entwicklung', spalte: 'Zu erledigen' }], frei: [{ slug: 't', titel: 'Test', spalten: ['Bereit', 'Geprüft'] }] });
  assert.deepStrictEqual(m.find(e => e.text === 'Auf Board legen').unter.map(e => e.arg), ['t|4|Bereit', 't|4|Geprüft']);
  assert.strictEqual(m.find(e => e.text === 'Von Board nehmen').unter[0].arg, 'e|4');
  assert.deepStrictEqual(['zuweisen', '4'], (e => [e.act, e.arg])(m.find(e => e.text === 'Zuständige zuweisen …')));
  assert.ok(!m.some(e => e.text === 'Zuständige'));
  const arch = listenMenue({ ...a, archiviert: '2026-10-01' }, { liegtAuf: [], frei: [{ slug: 't', titel: 'Test', spalten: ['Bereit'] }] });
  assert.ok(arch.some(e => e.text === 'Zurückholen') && !arch.some(e => e.text === 'Auf Board legen'));
});

const { massenMenue } = require('../../web/menue.js');

test('Menü für mehrere Karten (R00065)', () => {
  const m = massenMenue([3, 5], { spalten: ['A', 'B'], klassen: [{ schluessel: 'bug', bezeichnung: 'Fehler' }], boards: [{ slug: 'test', titel: 'Test', spalte: 'Bereit' }] });
  assert.deepStrictEqual(m.map(e => e.trenner ? '—' : e.text), ['Verschieben nach', 'Klasse', 'Fälligkeit', '—', 'Zuständige zuweisen …', 'Mir zuweisen', 'Auf Board legen', '—', 'Archivieren']);
  assert.deepStrictEqual(m[0].unter.map(e => [e.act, e.arg]), [['m-verschieben', '3,5|A'], ['m-verschieben', '3,5|B']]);
  assert.deepStrictEqual(m[1].unter.filter(e => !e.trenner).map(e => e.arg), ['3,5|bug', '3,5|']);
  assert.deepStrictEqual(m[2].unter.filter(e => !e.trenner).map(e => e.arg), ['3,5|0', '3,5|1', '3,5|7', '3,5|']);
  assert.deepStrictEqual([m[4].act, m[4].arg, m[5].act, m[6].unter[0].arg, m[8].act], ['zuweisen', '3,5', 'm-mich', 'test|Bereit|3,5', 'm-archivieren']);
  assert.ok(!massenMenue([3, 5], { spalten: [], klassen: [], boards: [] }).some(e => e.text === 'Auf Board legen'));
});
