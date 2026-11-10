// R00117 Punkt 4 (Begriffe, AK 8/10/11): statische Proben über die Quelltexte.
// Der Laufzeit-Text des Menüeintrags steht in r00117-kopfzeile.spec.js (AK 8/9); hier die Textstellen, die keine Oberfläche sind.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const lies = rel => fs.readFileSync(path.resolve(__dirname, '../..', rel), 'utf8');

test('AK 8: web/ansicht.js nennt den Menüeintrag nicht mehr „Laufende Timer“', () => {
  assert.strictEqual((lies('web/ansicht.js').match(/Laufende Timer/g) || []).length, 0);
});

test('AK 10: R00101/US-3 nennt „Spalten einrichten“ und nicht mehr „Spalten“', () => {
  const story = lies('Anforderungen/user-stories/R00101.md');
  assert.match(story, /Spalten einrichten/);
  assert.strictEqual((story.match(/dort „Spalten“ wähle/g) || []).length, 0);
});

test('AK 11: Dokumentation/Gelerntes.md:46 beginnt nach dem Doppelpunkt mit „Ein Knopf“', () => {
  const zeile = lies('Dokumentation/Gelerntes.md').split('\n')[45];
  assert.match(zeile, /schwach: Ein Knopf/);
  assert.doesNotMatch(zeile, /schwach: ein Knopf/);
});
