// R00209 B1039: Register der Anwendungen in der Einstellungsseite — reine Rechnung aus web/register.js, ohne Browser.
// Dieselbe Schreibregel wie der Server (src/modell/einstellungen.rs `startordner`, src/format/einstellungen.rs `pfade`),
// damit die Vorschau zeigt, was nach dem Speichern in kanbanD.md steht (AK 11).
const test = require('node:test');
const assert = require('node:assert');
const { startordner, pfadeZurDatei, repositoryZustand, anwendungenZahl, REPOSITORY_ZUSTAENDE } = require('../../web/register.js');

test('startordner: die Tabelle aus AK 1 — repository, sonst Ordner von wbs, sonst requirements, sonst leer', () => {
  const wbs = '/p/app/Dokumentation/Planung/app.md';
  const zeilen = [
    ['/p/app', wbs, '/p/app/Anforderungen', '/p/app'],
    ['', wbs, '/p/app/Anforderungen', '/p/app/Dokumentation/Planung'],
    ['', '', '/p/app/Anforderungen', '/p/app/Anforderungen'],
    ['  ', 'Dokumentation/Planung/app.md', '', 'Dokumentation/Planung'],
    ['', 'app.md', '', '.'],
    ['/p/fehlt', wbs, '', '/p/fehlt'],
    ['', '', '', ''],
    [' /p/rand ', '', '', '/p/rand'],
    ['', '/app.md', '', '/'],
    ['', 'a//b/c.md', '', 'a//b'],
    ['', 'C:\\p\\plan.md', '', 'C:\\p'],
    [undefined, undefined, ' /p/anf ', '/p/anf'],
  ];
  for (const [repository, w, anforderungen, erwartet] of zeilen) {
    assert.strictEqual(startordner(repository, w, anforderungen), erwartet, JSON.stringify([repository, w, anforderungen]));
  }
});

test('pfadeZurDatei: repository immer, wbs und requirements nur, wenn nicht leer — getrimmt, in dieser Reihenfolge', () => {
  assert.deepStrictEqual(pfadeZurDatei({ repository: ' /r ', wbs: '', anforderungen: '' }), [['repository', '/r']]);
  assert.deepStrictEqual(pfadeZurDatei({ repository: '', wbs: ' /r/D/P/kd.md ', anforderungen: '/r/A' }), [['repository', '/r/D/P'], ['wbs', '/r/D/P/kd.md'], ['requirements', '/r/A']]);
  assert.deepStrictEqual(pfadeZurDatei({ repository: '', wbs: '  ', anforderungen: '' }), [['repository', '']]);
  assert.deepStrictEqual(pfadeZurDatei({ wbs: 'plan/wbs.md' }), [['repository', 'plan'], ['wbs', 'plan/wbs.md']]);
});

test('repositoryZustand: kein Repository, noch nicht geprüft, erreichbar, nicht erreichbar (PO Z. 434)', () => {
  assert.deepStrictEqual(Object.values(REPOSITORY_ZUSTAENDE).map(z => z.wort), ['kein Repository', 'noch nicht geprüft', 'erreichbar', 'nicht erreichbar']);
  assert.strictEqual(repositoryZustand('  ', { repository: '', erreichbar: false }), REPOSITORY_ZUSTAENDE.leer);
  assert.strictEqual(repositoryZustand('', undefined), REPOSITORY_ZUSTAENDE.leer, 'eine neue Zeile ohne Pfad');
  assert.strictEqual(repositoryZustand('/r', undefined), REPOSITORY_ZUSTAENDE.ungeprueft, 'neue Anwendung, noch nicht gespeichert');
  assert.strictEqual(repositoryZustand('/r/neu', { repository: '/r', erreichbar: true }), REPOSITORY_ZUSTAENDE.ungeprueft, 'geändert, nicht gespeichert');
  assert.strictEqual(repositoryZustand(' /r ', { repository: '/r', erreichbar: true }), REPOSITORY_ZUSTAENDE.erreichbar, 'gespeichert wird getrimmt');
  assert.strictEqual(repositoryZustand('/r', { repository: '/r', erreichbar: false }), REPOSITORY_ZUSTAENDE.fehlt);
});

test('anwendungenZahl: Standardanwendung über den Startordner wie der Server (Anwendungen::aus), dazu das Register (Architektur S2)', () => {
  const kd = { kuerzel: 'kd', name: 'K', repository: '/k', wbs: '', anforderungen: '' };
  assert.strictEqual(anwendungenZahl({ repository: '/r', wbs: '', anforderungen: '', anwendungen: [kd] }), 2, 'Probe aus dem Review');
  assert.strictEqual(anwendungenZahl({ repository: '', wbs: 'plan/wbs.md', anforderungen: '', anwendungen: [kd] }), 2);
  assert.strictEqual(anwendungenZahl({ repository: '', wbs: '', anforderungen: 'anf', anwendungen: [] }), 1);
  assert.strictEqual(anwendungenZahl({ repository: '  ', wbs: ' ', anforderungen: '', anwendungen: [kd] }), 1, 'nur Leerzeichen zählt nicht');
  assert.strictEqual(anwendungenZahl({}), 0);
});
