// Unit-Tests zu R00175 AK 4: die von Hand gezogene Höhe eines Textfelds übersteht das Neuzeichnen (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { gezogeneHoehen, gezogeneHoehenSetzen } = require('../../web/sichtzustand.js');

/** Ein Textfeld, wie der Sicherer es liest: id, data-Attribute, Klassen und die Höhe, die der Browser beim Ziehen schreibt. */
const textfeld = ({ id = '', daten = {}, hoehe = '' }) => ({ id, dataset: daten, classList: ['besch'], getAttribute: () => null, style: { height: hoehe } });

/** Ein Bereich mit festen Textfeldern: `textarea.besch` liefert alle, ein Schlüssel-Selektor die Felder, die ihn tragen. */
function bereichMit(felder) {
  const traegt = (feld, selektor) => selektor === `[id="${feld.id}"]` || Object.entries(feld.dataset).some(([name, wert]) => selektor === `[data-${name}="${wert}"]`);
  return {
    querySelectorAll(selektor) {
      if (selektor === 'textarea.besch') return felder;
      return felder.filter(feld => traegt(feld, selektor));
    },
  };
}

test('ein gezogenes Feld liefert seine Höhe mit Schlüssel; ein nicht gezogenes liefert nichts', () => {
  const gezogen = textfeld({ id: 'beschreibung', daten: { af: 'beschreibung' }, hoehe: '400px' });
  const bereich = bereichMit([gezogen, textfeld({ daten: { nf: 'beschreibung' } })]);
  assert.deepStrictEqual(gezogeneHoehen(bereich, 'textarea.besch'), [{ bereich, schluessel: '[id="beschreibung"]', hoehe: '400px' }]);
  assert.deepStrictEqual(gezogeneHoehen(bereichMit([textfeld({ id: 'beschreibung' })]), 'textarea.besch'), []);
});

test('das Feld im Dialog „Neue Aufgabe“ hält über data-nf; ein Feld ohne Schlüssel fällt weg', () => {
  const bereich = bereichMit([textfeld({ daten: { nf: 'beschreibung' }, hoehe: '200px' })]);
  assert.deepStrictEqual(gezogeneHoehen(bereich, 'textarea.besch').map(stand => [stand.schluessel, stand.hoehe]), [['[data-nf="beschreibung"]', '200px']]);
  const ohneSchluessel = { ...textfeld({ hoehe: '200px' }), classList: [] };
  assert.deepStrictEqual(gezogeneHoehen(bereichMit([ohneSchluessel]), 'textarea.besch'), []);
});

test('nach dem Neuzeichnen trägt das neue Feld die gezogene Höhe; sein Wert bleibt unberührt', () => {
  const vorher = bereichMit([textfeld({ id: 'beschreibung', hoehe: '400px' })]);
  const staende = gezogeneHoehen(vorher, 'textarea.besch');
  const neuesFeld = { ...textfeld({ id: 'beschreibung' }), value: 'Entwurf' };
  const neuerInhalt = bereichMit([neuesFeld]);
  gezogeneHoehenSetzen(staende.map(stand => ({ ...stand, bereich: neuerInhalt })));
  assert.strictEqual(neuesFeld.style.height, '400px');
  assert.strictEqual(neuesFeld.value, 'Entwurf');
});

test('ist das Feld nach dem Neuzeichnen fort (Lesesicht), geschieht nichts', () => {
  const staende = [{ bereich: bereichMit([]), schluessel: '[id="beschreibung"]', hoehe: '400px' }];
  assert.doesNotThrow(() => gezogeneHoehenSetzen(staende));
});
