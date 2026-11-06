// Unit-Tests der gemeinsamen Ansichtenliste von Kontrast- und Zielprobe (ADR-0012 Regel 6): node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { G_ZIELE } = require('../../web/tastatur.js');
const { ansichtenDerAnwendung } = require('../tests/ansichten.js');

const ANSICHTEN = ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' });
const adressen = ANSICHTEN.map(a => a.adresse);
const gedeckt = (liste, ziel) => liste.some(adresse => adresse.startsWith(ziel));

test('Ansichten: jedes Ziel eines g-Kürzels aus tastatur.js ist eine Ansicht der Liste', () => {
  assert.deepStrictEqual(Object.values(G_ZIELE).filter(ziel => !gedeckt(adressen, ziel)), []);
});

test('Ansichten: jeder Bericht, den app.js zeichnet, ist eine Ansicht der Liste', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../web/app.js'), 'utf8');
  const berichte = [...app.matchAll(/S\.ui\.view === '(berichte\/[\w-]+)'\) return/g)].map(treffer => '#/' + treffer[1]);
  assert.ok(berichte.length >= 8, `Berichte in app.js gefunden: ${berichte.length}`);
  assert.deepStrictEqual(berichte.filter(ziel => !gedeckt(adressen, ziel)), []);
});

test('Ansichten: Board und WBS-Sicht tragen den übergebenen Slug, jeder Name kommt einmal vor', () => {
  assert.ok(adressen.includes('#/board/entwicklung'));
  assert.ok(adressen.includes('#/wbs/kd'));
  const namen = ANSICHTEN.map(a => a.ansicht);
  assert.strictEqual(new Set(namen).size, namen.length);
});

test('Selbstprobe Ansichten: eine Liste ohne die Personen deckt das Ziel von g p nicht', () => {
  const ohnePersonen = adressen.filter(adresse => adresse !== '#/personen');
  assert.strictEqual(gedeckt(ohnePersonen, G_ZIELE.p), false);
  assert.strictEqual(gedeckt(adressen, G_ZIELE.p), true);
});
