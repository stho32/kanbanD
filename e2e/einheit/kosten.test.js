// Unit-Tests des Preisetiketts (R00105, node --test): Rechnen in ganzen Cent, Formatieren erst beim Anzeigen
const test = require('node:test');
const assert = require('node:assert');
const { kostenInCent, geld, kostentabelle } = require('../../web/kosten.js');

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

test('Kostentabelle aus Positionen: Reihenfolge, Tokens nur wo vorhanden, Summe', () => {
  const t = kostentabelle(kostenInCent(usd({ basis: 'Schätzung planer', items: [
    { text: 'Planung', min: 0.1, max: 0.2, tokens: 12000 },
    { text: 'Bau', min: 0.2, max: 0.4 },
    { text: 'Gemeinkostenanteil', amount: 0.3 },
  ] })));
  assert.deepStrictEqual(t, {
    beschriftung: 'Geschätzte API-Kosten (USD)',
    spalteTokens: true,
    zeilen: [
      { text: 'Planung', tokens: 12000, niedrig: 10, hoch: 20 },
      { text: 'Bau', tokens: null, niedrig: 20, hoch: 40 },
      { text: 'Gemeinkostenanteil', tokens: null, niedrig: 30, hoch: 30 },
    ],
    summe: { tokens: 12000, niedrig: 60, hoch: 90 },
    basis: 'Schätzung planer',
  });
  const zwei = kostentabelle(kostenInCent(usd({ items: [{ text: 'a', amount: 0.1, tokens: 5 }, { text: 'b', amount: 0.2, tokens: 7 }] })));
  assert.deepStrictEqual(zwei.summe, { tokens: 12, niedrig: 30, hoch: 30 }, 'Tokens summiert');
});

test('Kostentabelle ohne Positionen: eine Zeile „Gesamt“, keine Summenzeile, keine Spalte Tokens', () => {
  assert.deepStrictEqual(kostentabelle(kostenInCent(usd({ min: 0.6, max: 1.6 }))),
    { beschriftung: 'Geschätzte API-Kosten (USD)', spalteTokens: false, zeilen: [{ text: 'Gesamt', tokens: null, niedrig: 60, hoch: 160 }], summe: null, basis: null });
  assert.deepStrictEqual(kostentabelle(kostenInCent(usd({ amount: 1.63 }))).zeilen, [{ text: 'Gesamt', tokens: null, niedrig: 163, hoch: 163 }], 'Betrag in beiden Spalten');
  const eur = kostentabelle(kostenInCent({ currency: 'EUR', amount: 25.55 }));
  assert.deepStrictEqual([eur.beschriftung, eur.zeilen[0].niedrig, eur.zeilen[0].hoch], ['Geschätzte API-Kosten (EUR)', 2555, 2555]);
});

test('Gegenbeispiel: Positionen ohne Tokens — keine Spalte Tokens, Summe ohne Tokens', () => {
  const t = kostentabelle(kostenInCent(usd({ items: [{ text: 'a', min: 0.1, max: 0.2 }, { text: 'b', amount: 0.3 }] })));
  assert.deepStrictEqual([t.spalteTokens, t.summe], [false, { tokens: null, niedrig: 40, hoch: 50 }]);
  const null_tokens = kostentabelle(kostenInCent(usd({ items: [{ text: 'a', amount: 0.1, tokens: 0 }] })));
  assert.deepStrictEqual([null_tokens.spalteTokens, null_tokens.summe.tokens], [true, 0], 'Grenzwert: 0 Tokens sind Tokens');
});
