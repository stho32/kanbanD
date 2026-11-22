// R00229 AK 8 (ADR-0025 N5 B): die Sperrform der Leseknöpfe hängt an der Komponente, nicht an einer Ansicht — node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const WEB = path.join(__dirname, '../../web');

const KOMPONENTEN = ['.cl-textknopf', '.cl-knopf'];
const GESPERRT = '[aria-disabled="true"]';

/** Alle Selektoren aller Regeln aller `web/*.css` ohne Kommentare, Selektorlisten an Kommas der obersten Ebene getrennt. */
function selektoren() {
  const alle = [];
  for (const datei of fs.readdirSync(WEB).filter(d => d.endsWith('.css'))) {
    const quelle = fs.readFileSync(path.join(WEB, datei), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const regel of quelle.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
      let tiefe = 0, start = 0;
      const liste = regel[1];
      for (let i = 0; i <= liste.length; i++) {
        if (liste[i] === '(') tiefe++;
        else if (liste[i] === ')') tiefe--;
        else if (i === liste.length || (liste[i] === ',' && tiefe === 0)) {
          alle.push({ datei, selektor: liste.slice(start, i).trim().replace(/\s+/g, ' ') });
          start = i + 1;
        }
      }
    }
  }
  return alle;
}

test('AK 8: kein Selektor mit gesperrtem Leseknopf steht hinter einem Ansichtspräfix oder in einer fremden Form', () => {
  const erlaubt = KOMPONENTEN.flatMap(k => [`${k}${GESPERRT}`, `${k}${GESPERRT}:hover`]);
  const falsch = selektoren().filter(({ selektor }) => KOMPONENTEN.some(k => selektor.includes(`${k}${GESPERRT}`)) && !erlaubt.includes(selektor));
  assert.deepStrictEqual(falsch, []);
});

test('AK 8: kein Selektor beginnt mit [aria-disabled="true"] (kein globaler Selektor)', () => {
  assert.deepStrictEqual(selektoren().filter(({ selektor }) => selektor.startsWith(GESPERRT)), []);
});

for (const komponente of KOMPONENTEN) {
  test(`AK 8: ${komponente} hat eine Form für gesperrt und eine für gesperrt mit :hover`, () => {
    const vorhanden = selektoren().map(s => s.selektor);
    assert.ok(vorhanden.includes(`${komponente}${GESPERRT}`), `${komponente}${GESPERRT} fehlt`);
    assert.ok(vorhanden.includes(`${komponente}${GESPERRT}:hover`), `${komponente}${GESPERRT}:hover fehlt`);
  });
}
