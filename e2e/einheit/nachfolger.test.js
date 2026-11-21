// R00218 B1118: Antwort von GET …/commits/{verweis}/nachfolger deuten — Zustände und Wortlaute (PO Z. 461, 465), rein, ohne Browser.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { nachfolgerDeuten, schreibfehlerText, erfolgText, NACHFOLGER_LAEDT } = require('../../web/commits.js');

const K = 'a41e0c5b3c7d9e8f00112233445566778899aabb';
const K2 = 'f3febe4c0ffee0000111122223333444455556666';
const kandidat = (zusatz = {}) => ({ verweis: `kd:${K2}`, hash: K2, titel: 'Zeile zwei ändern', autor: 'Ada Autorin', datum: '2026-05-04T09:00:00+00:00', zweige: ['main'], entfernte_zweige: [], an_der_karte: false, ...zusatz });
const antwort = (zusatz = {}) => ({ status: 200, rumpf: { verweis: `kd:${K}`, hash: K, durchsucht: 4, kandidaten: [kandidat()], hinweise: [], ...zusatz } });
const ohneKandidat = (hinweise = []) => antwort({ kandidaten: [], hinweise });

test('lädt: „Sucht Commits mit gleichem Patch …“', () => {
  assert.strictEqual(NACHFOLGER_LAEDT, 'Sucht Commits mit gleichem Patch …');
});

test('ein Kandidat: Kopf, Zusatz zu „Ersetzen“, Zeilenwerte und Name des Knopfs', () => {
  const d = nachfolgerDeuten(antwort(), `kd:${K}`);
  assert.strictEqual(d.art, 'kandidaten');
  assert.strictEqual(d.kopf, '1 Commit mit gleichem Patch');
  assert.strictEqual(d.zusatz, 'neuester zuerst · „Ersetzen“ trägt ihn an der Stelle von kd:a41e0c5 ein');
  assert.strictEqual(d.gruppe, 'Nachfolger von kd:a41e0c5');
  const [k] = d.kandidaten;
  assert.deepStrictEqual([k.verweis, k.kurz, k.titel, k.autor, k.datum, k.knopf, k.name], [`kd:${K2}`, 'kd:f3febe4', 'Zeile zwei ändern', 'Ada Autorin', '04.05.2026 11:00', 'ersetzen', 'Ersetzen durch kd:f3febe4']);
  assert.deepStrictEqual(k.zweige.sichtbar.map(z => z.name), ['main']);
  assert.deepStrictEqual(d.saetze, []);
});

test('an der Karte: Marke, Knopf „Verwaisten Verweis entfernen“, nur der Zusatz zu „Entfernen“ (Z. 465)', () => {
  const d = nachfolgerDeuten(antwort({ kandidaten: [kandidat({ an_der_karte: true })] }), `kd:${K}`);
  assert.strictEqual(d.kandidaten[0].knopf, 'entfernen');
  assert.strictEqual(d.kandidaten[0].marke, 'schon an der Aufgabe');
  assert.strictEqual(d.kandidaten[0].name, 'Verwaisten Verweis entfernen');
  assert.strictEqual(d.zusatz, 'neuester zuerst · „Verwaisten Verweis entfernen“ nimmt kd:a41e0c5 von der Aufgabe');
  assert.strictEqual(nachfolgerDeuten(antwort(), `kd:${K}`).kandidaten[0].marke, null);
});

test('gemischt: beide Zusätze, zuerst „Ersetzen“; ein Kandidat je Knopf genügt', () => {
  const d = nachfolgerDeuten(antwort({ kandidaten: [kandidat({ an_der_karte: true }), kandidat({ hash: 'b'.repeat(40), verweis: `kd:${'b'.repeat(40)}` })] }), `kd:${K}`);
  assert.strictEqual(d.kopf, '2 Commits mit gleichem Patch');
  assert.strictEqual(d.zusatz, 'neuester zuerst · „Ersetzen“ trägt ihn an der Stelle von kd:a41e0c5 ein · „Verwaisten Verweis entfernen“ nimmt kd:a41e0c5 von der Aufgabe');
});

test('nach dem 409-Wechsel: `alsEntfernen` macht den Kandidaten zu „entfernen“, der Zusatz zu „Ersetzen“ fällt weg', () => {
  const d = nachfolgerDeuten(antwort(), `kd:${K}`, new Set([`kd:${K2}`]));
  assert.strictEqual(d.kandidaten[0].knopf, 'entfernen');
  assert.strictEqual(d.zusatz, 'neuester zuerst · „Verwaisten Verweis entfernen“ nimmt kd:a41e0c5 von der Aufgabe');
});

test('kein Kandidat: Wortlaut aus ADR-0038 Punkt 4', () => {
  const d = nachfolgerDeuten(ohneKandidat(), `kd:${K}`);
  assert.strictEqual(d.art, 'keiner');
  assert.deepStrictEqual(d.saetze, ['Kein Commit mit gleichem Patch auf einem Zweig gefunden. Nach Squash oder einem anders gelösten Konflikt findet die Suche keinen Nachfolger.']);
});

test('Merge und leer', () => {
  assert.deepStrictEqual(nachfolgerDeuten(ohneKandidat([{ art: 'merge' }]), `kd:${K}`).saetze, ['Für einen Merge-Commit sucht kanbanD keinen Nachfolger.']);
  assert.deepStrictEqual(nachfolgerDeuten(ohneKandidat([{ art: 'leer' }]), `kd:${K}`).saetze, ['Der Commit ändert keine Datei, darum gibt es keinen Patch zum Vergleichen.']);
});

test('gekappt: ein Satz für jeden Grund, Zahl mit Tausenderpunkt; ohne Kandidat darunter „Kein Commit …“', () => {
  for (const grund of ['fenster', 'vorfilter', 'patch']) {
    const d = nachfolgerDeuten(ohneKandidat([{ art: 'suche_gekappt', durchsucht: 1000, grund }]), `kd:${K}`);
    assert.deepStrictEqual(d.saetze, ['Die Suche hat nach 1.000 Commits aufgehört; ein Nachfolger kann fehlen.', 'Kein Commit mit gleichem Patch auf einem Zweig gefunden.'], grund);
  }
  const mit = nachfolgerDeuten(antwort({ hinweise: [{ art: 'suche_gekappt', durchsucht: 250, grund: 'patch' }] }), `kd:${K}`);
  assert.deepStrictEqual(mit.saetze, ['Die Suche hat nach 250 Commits aufgehört; ein Nachfolger kann fehlen.']);
});

test('weitere: Mehrzahl und Einzahl; mit gekappt zuerst „weitere“, dann „gekappt“', () => {
  assert.deepStrictEqual(nachfolgerDeuten(antwort({ kandidaten_weitere: 2 }), `kd:${K}`).saetze, ['2 weitere Commits mit gleichem Patch sind nicht gezeigt.']);
  const beides = nachfolgerDeuten(antwort({ kandidaten_weitere: 1, hinweise: [{ art: 'suche_gekappt', durchsucht: 1000, grund: 'fenster' }] }), `kd:${K}`);
  assert.deepStrictEqual(beides.saetze, ['1 weiterer Commit mit gleichem Patch ist nicht gezeigt.', 'Die Suche hat nach 1.000 Commits aufgehört; ein Nachfolger kann fehlen.']);
});

test('unbekannte Art wird übersprungen', () => {
  assert.strictEqual(nachfolgerDeuten(antwort({ hinweise: [{ art: 'neu_erfunden' }] }), `kd:${K}`).saetze.length, 0);
});

test('Fehler der Suche: Text des Servers mit Status, ohne Verbindung ohne Zahl', () => {
  const d = nachfolgerDeuten({ status: 503, fehler: 'Git hängt' }, `kd:${K}`);
  assert.deepStrictEqual([d.art, d.saetze], ['fehler', ['Der Nachfolger ließ sich nicht suchen: Git hängt (503).']]);
  assert.deepStrictEqual(nachfolgerDeuten({ status: 0 }, `kd:${K}`).saetze, ['Der Nachfolger ließ sich nicht suchen: keine Verbindung zum Programm.']);
});

test('Fehler beim Schreiben: 409 mit dem Verweis des verwaisten Eintrags ist der Wechsel, sonst die allgemeine Form', () => {
  assert.deepStrictEqual(schreibfehlerText('ersetzen', { status: 409, verweis: `kd:${K}`, fehler: '… lässt sich mit DELETE entfernen' }, `kd:${K}`, `kd:${K2}`), { wechsel: true, text: 'Der Verweis ließ sich nicht ersetzen: kd:f3febe4 steht inzwischen schon an der Aufgabe (409).' });
  assert.deepStrictEqual(schreibfehlerText('ersetzen', { status: 409, verweis: 'kd:anderer', fehler: 'anders' }, `kd:${K}`, `kd:${K2}`), { wechsel: false, text: 'Der Verweis ließ sich nicht ersetzen: anders (409).' });
  assert.deepStrictEqual(schreibfehlerText('ersetzen', { status: 409, fehler: 'ohne' }, `kd:${K}`, `kd:${K2}`).wechsel, false);
  assert.strictEqual(schreibfehlerText('ersetzen', { status: 423, fehler: 'defekt' }, `kd:${K}`, `kd:${K2}`).text, 'Der Verweis ließ sich nicht ersetzen: defekt (423).');
  assert.strictEqual(schreibfehlerText('entfernen', { status: 423, fehler: 'defekt' }, `kd:${K}`, `kd:${K2}`).text, 'Der Verweis ließ sich nicht entfernen: defekt (423).');
  assert.strictEqual(schreibfehlerText('entfernen', { status: 0 }, `kd:${K}`, `kd:${K2}`).text, 'Der Verweis ließ sich nicht entfernen: keine Verbindung zum Programm.');
});

test('Erfolg: „Ersetzt durch kd:<K\':7>.“ und „Verwaisten Verweis kd:<K:7> entfernt.“', () => {
  assert.strictEqual(erfolgText('ersetzen', `kd:${K}`, `kd:${K2}`), 'Ersetzt durch kd:f3febe4.');
  assert.strictEqual(erfolgText('entfernen', `kd:${K}`, `kd:${K2}`), 'Verwaisten Verweis kd:a41e0c5 entfernt.');
});

test('Steuerzeichen im fremden Text fallen weg', () => {
  const d = nachfolgerDeuten(antwort({ kandidaten: [kandidat({ titel: 'fix-‮gpj.exe', autor: 'A⁦B' })] }), `kd:${K}`);
  assert.deepStrictEqual([d.kandidaten[0].titel, d.kandidaten[0].autor], ['fix-gpj.exe', 'AB']);
});

test('gekappt nach genau einem Commit: Einzahl (Rechtschreib-Review Sollte), 0 und ab 2 Mehrzahl', () => {
  const satz = n => nachfolgerDeuten(ohneKandidat([{ art: 'suche_gekappt', durchsucht: n, grund: 'patch' }]), `kd:${K}`).saetze[0];
  assert.strictEqual(satz(1), 'Die Suche hat nach 1 Commit aufgehört; ein Nachfolger kann fehlen.');
  assert.strictEqual(satz(0), 'Die Suche hat nach 0 Commits aufgehört; ein Nachfolger kann fehlen.');
  assert.strictEqual(satz(2), 'Die Suche hat nach 2 Commits aufgehört; ein Nachfolger kann fehlen.');
});
