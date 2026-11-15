// Unit-Tests des einen Entwurfs je Aufgabenfenster (R00155 G-1, ADR-0015 N2; node --test): die abgelehnte Eingabe
// `{ nummer, feld, wert }` und der Verweis des Felds auf die Fenstermeldung.
const test = require('node:test');
const assert = require('node:assert');
const { entwurfswert, meldungsverweis } = require('../../web/sichtzustand.js');

const VERWEIS = ' aria-invalid="true" aria-describedby="fenster-meldung"';
const verweis = (entwurf, meldung, nummer, feld) => meldungsverweis(entwurf, meldung, nummer, feld, 'fenster-meldung');

test('entwurfswert: die abgelehnte Eingabe gehört zu genau einer Aufgabe und einem Feld', () => {
  const entwurf = { nummer: 1, feld: 'zeit', wert: 'abc' };
  assert.strictEqual(entwurfswert(entwurf, 1, 'zeit'), 'abc');
  assert.strictEqual(entwurfswert(entwurf, 2, 'zeit'), null, 'andere Aufgabe');
  assert.strictEqual(entwurfswert(entwurf, 1, 'herkunft'), null, 'anderes Feld');
  assert.strictEqual(entwurfswert(null, 1, 'zeit'), null, 'kein Entwurf');
});

test('entwurfswert: ein leer abgelehnter Titel ist ein Entwurf — leer ist nicht „keiner“', () => {
  assert.strictEqual(entwurfswert({ nummer: 1, feld: 'titel', wert: '' }, 1, 'titel'), '');
});

test('meldungsverweis: ungültig mit Verweis, solange die Meldung das Feld nennt und der Entwurf zu Aufgabe und Feld gehört', () => {
  assert.strictEqual(verweis({ nummer: 1, feld: 'herkunft', wert: 'X1' }, { text: '„X1“ ist keine Herkunft', feld: 'herkunft' }, 1, 'herkunft'), VERWEIS);
  assert.strictEqual(verweis({ nummer: 1, feld: 'titel', wert: '' }, { text: 'Die Aufgabe braucht einen Titel', feld: 'titel' }, 1, 'titel'), VERWEIS);
});

test('meldungsverweis: kein Verweis ohne Meldung, bei Meldung ohne Feld oder für ein anderes Feld, bei anderer Aufgabe, ohne Entwurf', () => {
  const entwurf = { nummer: 1, feld: 'herkunft', wert: 'X1' };
  assert.strictEqual(verweis(entwurf, { text: null, feld: null }, 1, 'herkunft'), '', 'Meldung gelöscht');
  assert.strictEqual(verweis(entwurf, { text: 'Anhang zu groß', feld: null }, 1, 'herkunft'), '', 'Meldung ohne Feld');
  assert.strictEqual(verweis(entwurf, { text: 'Dauer „abc“', feld: 'zeit' }, 1, 'herkunft'), '', 'Meldung eines anderen Felds');
  assert.strictEqual(verweis(entwurf, { text: '„X1“ ist keine Herkunft', feld: 'herkunft' }, 2, 'herkunft'), '', 'andere Aufgabe offen');
  assert.strictEqual(verweis(entwurf, { text: 'Dauer „abc“', feld: 'zeit' }, 1, 'zeit'), '', 'der eine Entwurf nennt ein anderes Feld');
  assert.strictEqual(verweis(null, { text: '„X1“ ist keine Herkunft', feld: 'herkunft' }, 1, 'herkunft'), '', 'kein Entwurf');
});
