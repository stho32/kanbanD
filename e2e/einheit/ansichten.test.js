// Unit-Tests der gemeinsamen Ansichtenliste von Kontrast- und Zielprobe (ADR-0012 Regel 6): node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { G_ZIELE } = require('../../web/tastatur.js');
const { ansichtenDerAnwendung } = require('../tests/ansichten.js');

const ANSICHTEN = ansichtenDerAnwendung({ board: 'entwicklung' });
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

/**
 * Die Adressen, die der Router `ansichtAusAdresse` in adresse.js erkennt (bis R00174 in app.js): je Regex-Literal ab `^#\/` seine Alternativen
 * (`#/einrichten`, `#/aufgaben`, …) und der Rückfall (`board`). Gelesen wird der Router selbst, nicht eine zweite Liste.
 */
function routerAdressen(app) {
  const rumpf = /function ansichtAusAdresse\(hash\) \{([\s\S]*?)\n  \}/.exec(app);
  if (!rumpf) throw new Error('ansichtAusAdresse nicht gefunden');
  const muster = [...rumpf[1].matchAll(/\/\^#\\\/((?:\\.|[^/\\])*)\//g)].map(treffer => treffer[1].replace(/\\\//g, '/'));
  const alternativen = muster.flatMap(text => text.replace(/^\(|\)$/g, '').split('|'));
  const rueckfall = [...rumpf[1].matchAll(/: '(\w+)';/g)].map(treffer => treffer[1]);
  return [...alternativen, ...rueckfall].map(teil => '#/' + teil);
}
const APP = fs.readFileSync(path.join(__dirname, '../../web/adresse.js'), 'utf8');

test('Ansichten: jede Adresse, die der Router ansichtAusAdresse erkennt, ist eine Ansicht der Liste', () => {
  const erkannt = routerAdressen(APP);
  assert.ok(erkannt.length >= 11, `Adressen des Routers: ${erkannt.join(' ')}`);
  for (const muss of ['#/board', '#/einrichten', '#/berichte/bestand']) assert.ok(erkannt.includes(muss), muss);
  assert.ok(!erkannt.some(a => a.startsWith('#/wbs')), 'R00222: der Router kennt keine WBS-Sicht mehr');
  assert.deepStrictEqual(erkannt.filter(ziel => !gedeckt(adressen, ziel)), []);
});

test('Selbstprobe Router: eine zusätzliche Alternative hilfe in ansichtAusAdresse fehlt der Liste als #/hilfe', () => {
  const mitHilfe = APP.replace('/^#\\/(einrichten|', '/^#\\/(einrichten|hilfe|');
  assert.notStrictEqual(mitHilfe, APP, 'Probe hat den Router verändert');
  assert.deepStrictEqual(routerAdressen(mitHilfe).filter(ziel => !gedeckt(adressen, ziel)), ['#/hilfe']);
});

test('Ansichten: das Board trägt den übergebenen Slug, keine Ansicht ist die WBS-Sicht (R00222), jeder Name kommt einmal vor', () => {
  assert.ok(adressen.includes('#/board/entwicklung'));
  assert.ok(!adressen.some(a => a.startsWith('#/wbs')));
  const namen = ANSICHTEN.map(a => a.ansicht);
  assert.strictEqual(new Set(namen).size, namen.length);
});

test('Selbstprobe Ansichten: eine Liste ohne die Personen deckt das Ziel von g p nicht', () => {
  const ohnePersonen = adressen.filter(adresse => adresse !== '#/personen');
  assert.strictEqual(gedeckt(ohnePersonen, G_ZIELE.p), false);
  assert.strictEqual(gedeckt(adressen, G_ZIELE.p), true);
});
