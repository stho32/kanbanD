// R00119 Kopfzeichen-Tooltip: die Textregel der Blase lebt an genau einer Stelle (ADR-0020 Nachtrag N1, Nacharbeit M1, node --test)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const quelle = datei => fs.readFileSync(path.join(__dirname, '../../web', datei), 'utf8');
const ABLEITUNG = /dataset\.tipText\s*\|\|/g;

test('Eine Textquelle: die Ableitung `dataset.tipText || aria-label` steht in web/app.js und web/ansicht.js zusammen genau einmal', () => {
  const stellen = ['app.js', 'ansicht.js'].flatMap(datei => [...quelle(datei).matchAll(ABLEITUNG)].map(() => datei));
  assert.deepStrictEqual(stellen, ['ansicht.js'], `gefunden in: ${stellen.join(', ') || 'keiner Datei'}`);
});

test('Beide Wege benutzen dieselbe Funktion: `tippText` ist in web/ansicht.js definiert und wird in web/app.js gerufen', () => {
  assert.match(quelle('ansicht.js'), /function tippText\s*\(/, 'in ansicht.js definiert');
  assert.match(quelle('app.js'), /\btippText\s*\(/, 'in app.js gerufen');
  assert.doesNotMatch(quelle('app.js'), /(function|const)\s+tippText\b/, 'app.js definiert sie nicht erneut');
});
