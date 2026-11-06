// Unit-Tests des Preisetiketts (R00105, node --test): Rechnen in ganzen Cent, Formatieren erst beim Anzeigen
const test = require('node:test');
const assert = require('node:assert');
const { kostenInCent, geld } = require('../../web/kosten.js');

const NBSP = ' ';
const usd = rest => ({ currency: 'USD', ...rest });

test('Spanne: Grenzen in Cent, Mitte kaufmännisch gerundet', () => {
  assert.deepStrictEqual(kostenInCent(usd({ min: 0.6, max: 1.6, basis: 'Schätzung planer' })),
    { waehrung: 'USD', min: 60, max: 160, mitte: 110, basis: 'Schätzung planer', positionen: [] });
  assert.strictEqual(kostenInCent(usd({ min: 0.6, max: 1.61 })).mitte, 111, 'Grenzwert: 1,105 aufgerundet');
  assert.strictEqual(kostenInCent(usd({ min: 0.6, max: 1.62 })).mitte, 111, 'Gegenwert: 1,11 genau');
  assert.strictEqual(kostenInCent(usd({ min: 0, max: 0 })).mitte, 0, 'Leerfall: null Cent');
});

test('Betrag zählt als min = max, ohne Basis null', () => {
  assert.deepStrictEqual(kostenInCent(usd({ amount: 1.63 })), { waehrung: 'USD', min: 163, max: 163, mitte: 163, basis: null, positionen: [] });
  assert.strictEqual(kostenInCent(usd({ amount: 1.1 })).min, 110, 'genau einmal Math.round(x * 100), nicht abgeschnitten');
  assert.strictEqual(kostenInCent(usd({ amount: 0.29 })).min, 29, '0,29 × 100 = 28,999… → 29');
  assert.strictEqual(kostenInCent(usd({ amount: 1000000 })).max, 100000000, 'Höchstwert');
});

test('Positionen: Gesamt als Summe der Unter- bzw. Obergrenzen', () => {
  const k = kostenInCent(usd({ items: [
    { text: 'Planung', min: 0.1, max: 0.2, tokens: 12000 },
    { text: 'Bau', min: 0.2, max: 0.4 },
    { text: 'Gemeinkostenanteil', amount: 0.3 },
  ] }));
  assert.deepStrictEqual([k.min, k.max, k.mitte], [60, 90, 75]);
  assert.deepStrictEqual(k.positionen, [
    { text: 'Planung', tokens: 12000, min: 10, max: 20 },
    { text: 'Bau', tokens: null, min: 20, max: 40 },
    { text: 'Gemeinkostenanteil', tokens: null, min: 30, max: 30 },
  ]);
  const drei = kostenInCent(usd({ items: [{ text: 'a', amount: 0.1 }, { text: 'b', amount: 0.2 }, { text: 'c', amount: 0.3 }] }));
  assert.deepStrictEqual([drei.min, drei.max], [60, 60], '0,10 + 0,20 + 0,30 = 60 Cent, nicht 0,6000000000000001');
  const gross = kostenInCent(usd({ items: [{ text: 'a', amount: 600000 }, { text: 'b', amount: 600000 }] }));
  assert.strictEqual(gross.max, 120000000, 'die Summe darf über dem Höchstwert je Wert liegen');
});

test('Format je Währung: zwei Nachkommastellen, Symbol hinter dem Betrag mit geschütztem Leerzeichen', () => {
  assert.strictEqual(geld(163, 'USD'), `1,63${NBSP}$`);
  assert.strictEqual(geld(110, 'USD'), `1,10${NBSP}$`);
  assert.strictEqual(geld(2555, 'EUR'), `25,55${NBSP}€`);
  assert.strictEqual(geld(200, 'CHF'), `2,00${NBSP}CHF`);
  assert.strictEqual(geld(0, 'USD'), `0,00${NBSP}$`);
  assert.strictEqual(geld(100000000, 'USD'), `1.000.000,00${NBSP}$`);
  assert.strictEqual(geld(250, 'JPY'), `2,50${NBSP}¥`, 'auch für Währungen ohne Unterteilung zwei Nachkommastellen');
});
