// Unit-Tests der Filterregeln (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { filterWoerter, passt, archivGefiltert, klasseUmschalten } = require('../../web/filter.js');

const A = (nummer, titel, o = {}) => ({ nummer, titel, klasse: o.klasse || null, zustaendige: o.z || [], herkunft: o.h || [], labels: o.l || [] });
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

test('unbekannter Schlüssel sucht im Titel, is:archived filtert nicht', () => {
  assert.ok(passt(A(1, 'Termin 10:30 klären'), '10:30'));
  assert.ok(!passt(zwoelf, 'x:y'));
  assert.ok(passt(zwoelf, 'is:archived'));
  assert.ok(archivGefiltert('kopf is:Archived') && !archivGefiltert('kopf'));
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
