// R00209 B1039, R00222: Register der Anwendungen in der Einstellungsseite — reine Rechnung aus web/register.js, ohne Browser.
// Dieselbe Schreibregel wie der Server (src/format/einstellungen.rs `pfad`): nur `repository` (ADR-0034 N2 Regel 4), damit
// die Vorschau zeigt, was nach dem Speichern in kanbanD.md steht. Den Lese-Rückfall rechnet nur der Server.
const test = require('node:test');
const assert = require('node:assert');
const { ersteEinstellungen, pfadeZurDatei, repositoryZustand, anwendungenZahl, REPOSITORY_ZUSTAENDE, gebundeneAnwendungen, bindungUmschalten } = require('../../web/register.js');

test('pfadeZurDatei: nur repository, getrimmt — wbs und anforderungen werden nie geschrieben (R00222)', () => {
  assert.deepStrictEqual(pfadeZurDatei({ repository: ' /r ' }), [['repository', '/r']]);
  assert.deepStrictEqual(pfadeZurDatei({ repository: '', wbs: ' /r/D/P/kd.md ', anforderungen: '/r/A' }), [['repository', '']], 'mitgeschickt: ignoriert');
  assert.deepStrictEqual(pfadeZurDatei({}), [['repository', '']]);
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

test('anwendungenZahl: Standardanwendung über ihr Repository (die API liefert es aus dem Lese-Rückfall ergänzt), dazu das Register', () => {
  const kd = { kuerzel: 'kd', name: 'K', repository: '/k' };
  assert.strictEqual(anwendungenZahl({ repository: '/r', anwendungen: [kd] }), 2, 'Probe aus dem Review');
  assert.strictEqual(anwendungenZahl({ repository: '', anwendungen: [kd] }), 1);
  assert.strictEqual(anwendungenZahl({ repository: '  ', anwendungen: [kd] }), 1, 'nur Leerzeichen zählt nicht');
  assert.strictEqual(anwendungenZahl({}), 0);
});

// R00222: die Bindung zog mit ihren Tests hierher (ADR-0034 Regel 4: die Bindung bleibt)
const kd = { kuerzel: 'kd', name: 'kanbanD' }, kc = { kuerzel: 'kc', name: 'Kasse' };

test('Board bindet die genannten registrierten Anwendungen, ohne Schlüssel die einzige', () => {
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: ['kc', 'kd'] }, [kd, kc]), [kc, kd], 'Reihenfolge des Boards');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: ['kd', 'xx'] }, [kd, kc]), [kd], 'nicht registriert fällt weg');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: null }, [kd]), [kd], 'Schlüssel fehlt: genau eine registrierte gilt als gebunden');
  assert.deepStrictEqual(gebundeneAnwendungen({}, [kd]), [kd], 'auch ohne Feld');
  assert.deepStrictEqual(gebundeneAnwendungen({ anwendungen: null }, [kd, kc]), [], 'bei mehreren ein reines Kanban');
  assert.deepStrictEqual(gebundeneAnwendungen(null, []), []);
});

test('Bindung im Spalten-Dialog umschalten: vom gerechneten Stand aus, „keine“ = []', () => {
  assert.deepStrictEqual(bindungUmschalten(null, 'kd', [kd]), [], 'Standard gebunden → ausschalten löst');
  assert.deepStrictEqual(bindungUmschalten([], 'kd', [kd]), ['kd']);
  assert.deepStrictEqual(bindungUmschalten(null, 'kc', [kd, kc]), ['kc'], 'Standard bei zweien ist keine');
  assert.deepStrictEqual(bindungUmschalten(['kd'], 'kc', [kd, kc]), ['kd', 'kc'], 'angehängt');
  assert.deepStrictEqual(bindungUmschalten(['kc', 'kd'], 'kc', [kd, kc]), ['kd']);
  assert.deepStrictEqual(bindungUmschalten(['kd', 'xx'], 'kd', [kd]), ['xx'], 'nicht registrierte bleiben erhalten');
  assert.deepStrictEqual(bindungUmschalten(['kd'], '', [kd]), [], 'leeres Kürzel = keine');
});

// R00222 AK 14 (PO Z. 497): der erste Start fragt weder WBS noch Anforderungen; die Einstellungen tragen keine Quellen dazu
test('ersteEinstellungen: Ich, Agenten, keine Klassen und kein quellen.wbs/quellen.anforderungen', () => {
  const e = ersteEinstellungen({ kuerzel: ' sh ', name: ' Stefan ', agenten: { cl: true, cx: false }, board: 'Entwicklung', spalten: 'Offen, In Arbeit, Erledigt' });
  assert.deepStrictEqual(e.personen, [{ kuerzel: 'sh', name: 'Stefan', art: 'human' }, { kuerzel: 'cl', name: 'Claude', art: 'agent' }]);
  assert.deepStrictEqual(e.klassen, []);
  assert.ok(!('wbs' in (e.quellen || {})) && !('anforderungen' in (e.quellen || {})), JSON.stringify(e.quellen));
});
