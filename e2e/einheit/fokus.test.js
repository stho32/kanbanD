// Unit-Tests der Fokusführung über Ebenen (R00106, ADR-0010): node --test
const test = require('node:test');
const assert = require('node:assert');
const { ebenen, fallenSchritt, fokusZiel } = require('../../web/fokus.js');

const arten = ui => ebenen(ui).map(ebene => ebene.art);

test('fokusZiel: Aufgabenfenster #1 geschlossen, Sicherer leer → .ka[data-id="1"]', () => {
  const geschlossen = ebenen({ view: 'board', offen: 1 })[0];
  const ziele = fokusZiel({ ausdruecklich: null, gesichert: false, gesichertInOberster: false, geschlossen, geoeffnet: null, oberste: null, fuehrung: null });
  assert.strictEqual(ziele[0], '.ka[data-id="1"]');
});

test('fokusZiel: Fenster aus der Aufgabenliste geschlossen → Zeile der Aufgabe, danach der gemerkte Auslöser', () => {
  const geschlossen = ebenen({ view: 'aufgaben', offen: 3 }, { fenster: '#t-x' })[0];
  const ziele = fokusZiel({ geschlossen });
  assert.deepStrictEqual(ziele, ['tr[data-zeile="3"]', '#t-x']);
});

test('fokusZiel: ein Sicherer-Treffer unter der obersten Ebene wird verworfen', () => {
  const oberste = ebenen({ view: 'board', offen: 1 })[0];
  const ziele = fokusZiel({ gesichert: true, gesichertInOberster: false, oberste });
  assert.ok(!ziele.includes('gesichert'), 'Sicherer verworfen');
  assert.strictEqual(ziele[0], '#fenster', 'stattdessen das Startziel der obersten Ebene');
});

test('fokusZiel: Rangfolge ausdrücklich > Sicherer in oberster > Rückgabe > Start > Führung', () => {
  const fenster = ebenen({ view: 'board', offen: 1 })[0];
  const hilfe = ebenen({ view: 'board', offen: 1, hilfe: true })[1];
  const ziele = fokusZiel({ ausdruecklich: '#neu-titel', gesichert: true, gesichertInOberster: true, geschlossen: hilfe, geoeffnet: fenster, oberste: fenster, fuehrung: '.ka[data-id="2"]' });
  assert.deepStrictEqual(ziele.slice(0, 2), ['#neu-titel', 'gesichert']);
  assert.ok(ziele.indexOf('#fenster') > 1);
  assert.ok(!ziele.includes('.ka[data-id="2"]'), 'Führung über Karten nur, wenn keine Ebene offen ist');
});

test('fokusZiel: ohne Ebene führt fokusKarte bzw. fokusZeile', () => {
  assert.deepStrictEqual(fokusZiel({ fuehrung: '.ka[data-id="2"]' }), ['.ka[data-id="2"]']);
  assert.deepStrictEqual(fokusZiel({}), []);
});

test('ebenen: Reihenfolge von unten nach oben, Kontextmenü über Pop über Dialogstapel', () => {
  assert.deepStrictEqual(arten({}), []);
  assert.deepStrictEqual(arten({ offen: 1, setup: {} }), [], 'im Einrichten zeigt das Fenster nicht');
  assert.deepStrictEqual(arten({ offen: 1, zuweisen: {}, hilfe: true, pop: 'mehr', menue: {} }), ['fenster', 'zuweisen', 'hilfe', 'pop', 'kmenue']);
  assert.deepStrictEqual(arten({ neu: {}, offenDefekt: 9 }), ['neu', 'defekt']);
});

test('ebenen: Dialoge sind modal, Menüs nicht; Rückgabe aus dem gemerkten Auslöser', () => {
  const liste = ebenen({ offen: 1, view: 'board', pop: 'mehr' }, { pop: '#t-mehr' });
  assert.deepStrictEqual(liste.map(ebene => ebene.modal), [true, false]);
  assert.deepStrictEqual(liste[1].rueckgabe, ['#t-mehr']);
  assert.deepStrictEqual(ebenen({ hilfe: true })[0].rueckgabe, [], 'ohne gemerkten Auslöser keine Rückgabe');
});

test('fallenSchritt: Umlauf an beiden Rändern', () => {
  assert.strictEqual(fallenSchritt(5, 4, false), 0);
  assert.strictEqual(fallenSchritt(5, 0, true), 4);
  assert.strictEqual(fallenSchritt(5, 2, false), 3);
  assert.strictEqual(fallenSchritt(5, 2, true), 1);
  assert.strictEqual(fallenSchritt(5, -1, false), 0, 'Fokus außerhalb der Ebene: vorwärts zum ersten');
  assert.strictEqual(fallenSchritt(5, -1, true), 4, 'Fokus außerhalb der Ebene: rückwärts zum letzten');
  assert.strictEqual(fallenSchritt(0, 0, false), -1, 'nichts Tabbares');
});
