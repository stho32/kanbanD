// Unit-Tests der Menüs (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { kartenMenue, menueSchritt } = require('../../web/menue.js');

const a = { nummer: 3, titel: 'drei', klasse: 'bug', faellig: null };
const u = { spalten: ['Zu erledigen', 'In Arbeit', 'Erledigt'], spalte: 'Zu erledigen', klassen: [{ schluessel: 'bug', bezeichnung: 'Fehler' }, { schluessel: 'ux', bezeichnung: 'UX' }], boards: [{ slug: 'test', titel: 'Test', spalte: 'Bereit' }], ich: 'st', meinerLaeuft: true, meine: false };

test('Menü der Karte', () => {
  const m = kartenMenue(a, u);
  const texte = m.map(e => e.trenner ? '—' : e.text);
  assert.deepStrictEqual(texte, ['Öffnen', '—', 'Timer stoppen', 'Mir zuweisen', 'Umbenennen', '—', 'Verschieben nach', 'Klasse', 'Fälligkeit', 'Auf Board legen', '—', 'Verweis kopieren', 'Archivieren']);
  assert.strictEqual(m[2].arg, '3|st');
  const spalten = m[6].unter;
  assert.deepStrictEqual(spalten.map(s => [s.text, s.kuerzel, !!s.aktuell]), [['Zu erledigen', '1', true], ['In Arbeit', '2', false], ['Erledigt', '3', false]]);
  assert.ok(m[7].unter.find(k => k.text === 'Fehler').aktuell);
  assert.deepStrictEqual(m[8].unter.map(f => f.text), ['heute', 'morgen', '+1 Woche'], 'ohne Fälligkeit kein „entfernen“');
  assert.strictEqual(m[9].unter[0].arg, 'test|3|Bereit');
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
  assert.strictEqual(menueSchritt(m[6].unter, -1, 1), 1, 'aktuelle Spalte ist nicht wählbar');
  assert.strictEqual(menueSchritt([{ trenner: true }], 0, 1), -1);
});
