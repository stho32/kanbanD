// Unit-Tests der Filterregeln (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { filterWoerter, passt, archivGefiltert, klasseUmschalten } = require('../../web/filter.js');

const A = (nummer, titel, o = {}) => ({ nummer, titel, beschreibung: o.b || '', kommentare: o.k || [], teilaufgaben: o.t || [], klasse: o.klasse || null, zustaendige: o.z || [], herkunft: o.h || [], labels: o.l || [] });
const zwoelf = A(12, 'Kopfzeile verdichten', { klasse: 'feature', z: ['st', 'cl'], h: ['I0027'], l: ['ui'] });
const dreizehn = A(13, 'Kopfzeile', { klasse: 'bug' });
const vierzehn = A(14, 'Ohne alles');

test('Wörter mit Schlüssel, Anführungszeichen, # und @', () => {
  assert.deepStrictEqual(filterWoerter('kopf CLASS:bug origin:"thin air" @st #12'), [['', 'kopf'], ['class', 'bug'], ['origin', 'thin air'], ['', '@st'], ['', '#12']]);
  assert.deepStrictEqual(filterWoerter(''), []);
});

test('UND-Verknüpfung aus Text und Klasse', () => {
  assert.ok(passt(zwoelf, 'kopf class:feature'));
  assert.ok(!passt(dreizehn, 'kopf class:feature'));
  assert.ok(passt(dreizehn, 'KOPF'));
});

test('Nummer, Person, Herkunft, Klasse none, Label', () => {
  assert.ok(passt(zwoelf, '#12') && !passt(dreizehn, '#12'));
  assert.ok(passt(zwoelf, '@cl') && !passt(dreizehn, '@cl'));
  assert.ok(passt(vierzehn, 'origin:"thin air"') && !passt(zwoelf, 'origin:"thin air"'));
  assert.ok(passt(zwoelf, 'origin:i0027'));
  assert.ok(passt(vierzehn, 'class:none') && !passt(dreizehn, 'class:none'));
  assert.ok(passt(zwoelf, 'label:UI') && !passt(dreizehn, 'label:ui'));
  assert.ok(passt(zwoelf, '# @ class: origin: label:'), 'leere Werte filtern nicht');
});

test('unbekannter Schlüssel sucht im ganzen Text, is:archived filtert nicht', () => {
  assert.ok(passt(A(1, 'Termin 10:30 klären'), '10:30'));
  assert.ok(passt(A(2, 'Kopfzeile', { b: 'Bezug 10:30' }), '10:30'), 'das Wort steht nur in der Beschreibung');
  assert.ok(!passt(zwoelf, 'x:y'));
  assert.ok(passt(zwoelf, 'is:archived'));
  assert.ok(archivGefiltert('kopf is:Archived') && !archivGefiltert('kopf'));
});

// R00019 Karte #31: ein freies Wort sucht auch in Beschreibung, Kommentaren und Teilaufgaben
test('freies Wort trifft Beschreibung, Kommentar und Teilaufgabe (Felder ODER)', () => {
  assert.ok(passt(A(21, 'Kopfzeile', { b: 'Die Wartung läuft.' }), 'wartung'), 'nur die Beschreibung nennt es');
  assert.ok(passt(A(22, 'Kopfzeile', { k: [{ text: 'Wartung erledigt' }] }), 'wartung'), 'nur ein Kommentar nennt es');
  assert.ok(passt(A(23, 'Kopfzeile', { t: [{ text: 'Wartung abhaken', erledigt: false }] }), 'wartung'), 'nur eine Teilaufgabe nennt es');
  assert.ok(!passt(A(24, 'Kopfzeile', { b: 'ohne das Wort' }), 'wartung'), 'kein Feld nennt es');
});

test('Wörter UND über die Felder verteilt, fehlt eines trifft nichts', () => {
  const a = A(25, 'Kopfzeile', { b: 'Die Wartung', t: [{ text: 'Schieber justieren' }] });
  assert.ok(passt(a, 'wartung schieber'), 'das eine Wort in der Beschreibung, das andere in der Teilaufgabe');
  assert.ok(passt(a, 'schieber wartung'), 'die Reihenfolge zählt nicht');
  assert.ok(!passt(a, 'wartung spindel'), 'ein fehlendes Wort im ganzen Text trifft nicht');
});

test('ohne Groß/Klein in allen Feldern', () => {
  assert.ok(passt(A(26, 'Kopfzeile', { t: [{ text: 'wartung prüfen' }] }), 'WARTUNG'), 'in der Teilaufgabe');
  assert.ok(passt(A(27, 'Kopfzeile', { b: 'Die WARTUNG' }), 'wartung'), 'in der Beschreibung');
  assert.ok(passt(A(28, 'Kopfzeile', { k: [{ text: 'Wartung' }] }), 'wArTuNg'), 'im Kommentar');
});

test('Bereiche meine und Agenten', () => {
  const personen = [{ kuerzel: 'st', art: 'human' }, { kuerzel: 'cl', art: 'agent' }];
  assert.ok(passt(zwoelf, '', { bereich: 'meine', ich: 'st' }) && !passt(dreizehn, '', { bereich: 'meine', ich: 'st' }));
  assert.ok(passt(zwoelf, '', { bereich: 'agenten', personen }) && !passt(vierzehn, '', { bereich: 'agenten', personen }));
});

test('Legende schaltet class: um', () => {
  assert.strictEqual(klasseUmschalten('kopf', 'bug'), 'kopf class:bug');
  assert.strictEqual(klasseUmschalten('kopf class:bug', 'bug'), 'kopf');
  assert.strictEqual(klasseUmschalten('class:bug kopf', 'feature'), 'kopf class:feature');
});

test('qualifizierte Herkunft (R00053): origin:kd:I0007 trifft genau diese Schreibweise', () => {
  const kd = { nummer: 20, titel: 'x', zustaendige: [], labels: [], herkunft: ['kd:I0007'] };
  assert.ok(passt(kd, 'origin:kd:I0007') && passt(kd, 'origin:KD:i0007'));
  assert.ok(!passt(kd, 'origin:kc:I0007') && !passt(kd, 'origin:I0007'));
});

test('Signale je Aufgabe: gesetzte und die Fälligkeit (R00076)', () => {
  const { aufgabenSignale } = require('../../web/filter.js');
  const heute = '2026-10-21';
  const a = (o = {}) => ({ nummer: o.n || 1, signale: o.s || [], faellig: o.f || null });
  assert.deepStrictEqual(aufgabenSignale(a({ s: ['mail', 'fragen'] }), heute), [{ schluessel: 'mail' }, { schluessel: 'fragen' }]);
  assert.deepStrictEqual(aufgabenSignale(a({ f: '2026-10-21' }), heute), [{ schluessel: 'due', faellig: 'heute' }]);
  assert.deepStrictEqual(aufgabenSignale(a({ f: '2026-10-20', s: ['mail'] }), heute), [{ schluessel: 'mail' }, { schluessel: 'due', faellig: 'ueber' }]);
  assert.deepStrictEqual(aufgabenSignale(a({ f: '2026-10-22' }), heute), [], 'morgen fällig ist noch kein Signal');
  assert.deepStrictEqual(aufgabenSignale(a({ f: '2026-10-20', s: ['mail'] }), heute, true), [{ schluessel: 'mail' }], 'abgeschlossen: keine Fälligkeit');
  assert.deepStrictEqual(aufgabenSignale({ nummer: 2 }, heute), [], 'ohne Felder');
});

test('Filter signal: — Schlüssel, due, any; Umschalten (R00076)', () => {
  const { signalUmschalten } = require('../../web/filter.js');
  const u = { heute: '2026-10-21', abgeschlossen: new Set([3]) };
  const mail = { ...A(1, 'eins'), signale: ['mail'] }, faellig = { ...A(2, 'zwei'), signale: [], faellig: '2026-10-21' }, fertig = { ...A(3, 'drei'), signale: [], faellig: '2026-10-01' }, ohne = { ...A(4, 'vier'), signale: [] };
  const treffer = f => [mail, faellig, fertig, ohne].filter(x => passt(x, f, u)).map(x => x.nummer);
  assert.deepStrictEqual(treffer('signal:mail'), [1]);
  assert.deepStrictEqual(treffer('signal:MAIL'), [1]);
  assert.deepStrictEqual(treffer('signal:due'), [2], 'die abgeschlossene zählt nicht');
  assert.deepStrictEqual(treffer('signal:any'), [1, 2]);
  assert.deepStrictEqual(treffer('signal:fragen'), []);
  assert.strictEqual(signalUmschalten('kopf', 'mail'), 'kopf signal:mail');
  assert.strictEqual(signalUmschalten('kopf signal:mail', 'mail'), 'kopf');
  assert.strictEqual(signalUmschalten('signal:due', 'mail'), 'signal:mail');
});

// R00088: die Farbe der Karte kommt vom ersten gesetzten Signal in der Reihenfolge der Einstellungen
test('erstes Signal nach der Reihenfolge der Einstellungen', () => {
  const { ersteSignal } = require('../../web/filter.js');
  const reihe = ['review', 'blockiert'];
  assert.strictEqual(ersteSignal({ signale: ['blockiert', 'review'] }, reihe), 'review');
  assert.strictEqual(ersteSignal({ signale: ['blockiert'] }, reihe), 'blockiert');
  assert.strictEqual(ersteSignal({ signale: ['unbekannt'] }, reihe), 'unbekannt', 'ein unbekanntes Signal zählt trotzdem');
  assert.strictEqual(ersteSignal({ signale: [], faellig: '2026-01-01' }, reihe), null, 'die Fälligkeit färbt nicht');
});

// R00088: „Signale oben“ zeigt erst die Karten mit Signal, dann den Rest — beide in ihrer echten Reihenfolge
test('Signale oben sortiert stabil, ohne das Board zu ändern', () => {
  const { signaleOben } = require('../../web/filter.js');
  const aufgaben = { 1: { signale: [] }, 2: { signale: ['mail'] }, 3: {}, 4: { signale: ['review'] } };
  const spalte = [1, 2, 3, 4];
  assert.deepStrictEqual(signaleOben(spalte, n => aufgaben[n]), [2, 4, 1, 3]);
  assert.deepStrictEqual(spalte, [1, 2, 3, 4], 'die Eingabe bleibt');
  assert.deepStrictEqual(signaleOben([9, 2], n => aufgaben[n]), [2, 9], 'eine fehlende Aufgabe zählt als ohne Signal');
});
