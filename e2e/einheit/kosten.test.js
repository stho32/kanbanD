// Unit-Tests des Preisetiketts (R00105, node --test): Rechnen in ganzen Cent, Formatieren erst beim Anzeigen
const test = require('node:test');
const assert = require('node:assert');
const { kostenInCent, geld, kostentabelle, kostenbericht, kostenFilter, kostenUmfang } = require('../../web/kosten.js');
const { FILTER_LEER, filterAnzahl } = require('../../web/berichte.js');

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

/* ── Kostenbericht (B0371): Grundbestand aus F0041 ── */
const aufgabe = (nummer, cost = null, mehr = {}) => ({ nummer, klasse: null, zustaendige: [], labels: [], archiviert: null, cost, ...mehr });
const spalten = (eingang, inArbeit, fertig) => ({ spalten: [{ name: 'Eingang', aufgaben: eingang }, { name: 'In Arbeit', aufgaben: inArbeit }, { name: 'Fertig', aufgaben: fertig }] });
const GRUND = [aufgabe(1, usd({ min: 0.6, max: 1.6 })), aufgabe(2, usd({ amount: 1.63 }), { klasse: 'drift' }), aufgabe(3), aufgabe(4)];
const GRUND_BOARD = spalten([1, 4], [2], [3]);
const ARCHIV = [...GRUND, aufgabe(5, usd({ amount: 0.5 }), { archiviert: '2026-11-01' }), aufgabe(6, usd({ min: 0.1, max: 0.3 }), { archiviert: '2026-11-02' })];
const ARCHIV_BOARD = spalten([1, 4, 6], [2], [3, 5]);
const filter = mehr => ({ ...FILTER_LEER, ...mehr });

test('Kostenbericht: Summe je Währung über die Aufgaben mit Etikett, m über alle Aufgaben des Boards', () => {
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, FILTER_LEER), { m: 4, jeWaehrung: [{ waehrung: 'USD', n: 2, niedrig: 223, hoch: 323 }] });
  assert.deepStrictEqual(kostenbericht(ARCHIV_BOARD, ARCHIV, FILTER_LEER), { m: 6, jeWaehrung: [{ waehrung: 'USD', n: 4, niedrig: 283, hoch: 403 }] }, 'archivierte zählen mit');
});

test('Kostenbericht: je Währung eine Zeile, USD zuerst, dann alphabetisch', () => {
  const mitEur = [...ARCHIV, aufgabe(7, { currency: 'EUR', amount: 25.55 })];
  assert.deepStrictEqual(kostenbericht(spalten([1, 4, 6, 7], [2], [3, 5]), mitEur, FILTER_LEER).jeWaehrung,
    [{ waehrung: 'USD', n: 4, niedrig: 283, hoch: 403 }, { waehrung: 'EUR', n: 1, niedrig: 2555, hoch: 2555 }]);
  const mitChf = [...mitEur, aufgabe(8, { currency: 'CHF', amount: 2 }), aufgabe(9, { currency: 'AUD', amount: 1 })];
  assert.deepStrictEqual(kostenbericht(spalten([1, 4, 6, 7, 8, 9], [2], [3, 5]), mitChf, FILTER_LEER).jeWaehrung.map(z => z.waehrung), ['USD', 'AUD', 'CHF', 'EUR']);
  const ohneUsd = [aufgabe(1, { currency: 'EUR', amount: 1 }), aufgabe(2, { currency: 'CHF', amount: 1 })];
  assert.deepStrictEqual(kostenbericht(spalten([1, 2], [], []), ohneUsd, FILTER_LEER).jeWaehrung.map(z => z.waehrung), ['CHF', 'EUR']);
});

test('Kostenbericht Gegenbeispiele: Aufgabe auf keinem Board, Leerfälle', () => {
  const mitFremder = [...GRUND, aufgabe(10, usd({ amount: 5 }))];
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, mitFremder, FILTER_LEER), { m: 4, jeWaehrung: [{ waehrung: 'USD', n: 2, niedrig: 223, hoch: 323 }] }, 'nicht auf dem Board → zählt nicht');
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, [aufgabe(1), aufgabe(2), aufgabe(3), aufgabe(4)], FILTER_LEER), { m: 4, jeWaehrung: [] }, 'kein Etikett');
  assert.deepStrictEqual(kostenbericht(spalten([], [], []), [], FILTER_LEER), { m: 0, jeWaehrung: [] }, 'Board ohne Aufgaben');
});

test('Kostenbericht nach Filter: Spalten, Klasse, Zuständige, Labels', () => {
  assert.deepStrictEqual(kostenbericht(ARCHIV_BOARD, ARCHIV, filter({ ohneSpalten: ['Fertig'] })), { m: 4, jeWaehrung: [{ waehrung: 'USD', n: 3, niedrig: 233, hoch: 353 }] });
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneSpalten: ['Fertig'] })), { m: 3, jeWaehrung: [{ waehrung: 'USD', n: 2, niedrig: 223, hoch: 323 }] }, '2 von 3');
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneSpalten: ['Eingang'] })), { m: 2, jeWaehrung: [{ waehrung: 'USD', n: 1, niedrig: 163, hoch: 163 }] }, '1,63 · 1 von 2');
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneFarben: ['drift'] })), { m: 3, jeWaehrung: [{ waehrung: 'USD', n: 1, niedrig: 60, hoch: 160 }] }, 'Klasse drift aus');
  const mitPerson = GRUND.map(a => a.nummer === 1 ? { ...a, zustaendige: ['st'], labels: ['x'] } : a);
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, mitPerson, filter({ personen: ['st'] })), { m: 1, jeWaehrung: [{ waehrung: 'USD', n: 1, niedrig: 60, hoch: 160 }] });
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, mitPerson, filter({ labels: ['x'] })).m, 1);
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneSpalten: ['Eingang', 'In Arbeit', 'Fertig'] })), { m: 0, jeWaehrung: [] }, 'alle Spalten aus');
});

test('Kostenbericht: eine Nummer in der Spalte ohne lesbare Aufgabe zählt in m wie in den übrigen Berichten, ohne Etikett', () => {
  assert.deepStrictEqual(kostenbericht(spalten([1, 4, 11], [2], [3]), GRUND, FILTER_LEER), { m: 5, jeWaehrung: [{ waehrung: 'USD', n: 2, niedrig: 223, hoch: 323 }] });
  assert.strictEqual(kostenbericht(spalten([1, 4, 11], [2], [3]), GRUND, filter({ labels: ['x'] })).m, 0, 'mit Label-Filter passt sie nicht');
});

/* ── Filter auf den Kostenbericht (B0373): Zeitraum und Rechnen ab gelten nicht ── */
const ALLE = 'alle Spalten, auch archivierte', NACH_FILTER = 'nach Filter, auch archivierte';
const MIT_PRUEFUNG = { spalten: [...GRUND_BOARD.spalten.slice(0, 2), { name: 'Prüfung', aufgaben: [] }, GRUND_BOARD.spalten[2]] };

test('Kostenfilter: gespeicherter Zeitraum fällt weg, alles andere bleibt', () => {
  const letzteWoche = filter({ zeitraum: 'vorwoche', ohneFarben: ['drift'], personen: ['st'], labels: ['x'], ohneSpalten: ['Fertig'] });
  assert.deepStrictEqual(kostenFilter(letzteWoche), { ...letzteWoche, zeitraum: 'alles', von: '', bis: '' });
  const eigen = filter({ zeitraum: 'eigen', von: '2026-11-01', bis: '2026-11-07' });
  assert.deepStrictEqual(kostenFilter(eigen), FILTER_LEER);
  assert.deepStrictEqual(eigen.zeitraum, 'eigen', 'der gespeicherte Filter bleibt unverändert (Burndown zeigt ihn weiter)');
});

test('Kostenbericht mit gespeichertem Zeitraum: gleiche Zahlen und Umfang „alle Spalten“', () => {
  const letzteWoche = filter({ zeitraum: 'vorwoche' });
  assert.deepStrictEqual(kostenbericht(ARCHIV_BOARD, ARCHIV, kostenFilter(letzteWoche)), kostenbericht(ARCHIV_BOARD, ARCHIV, FILTER_LEER));
  assert.strictEqual(kostenUmfang(letzteWoche), ALLE);
  assert.strictEqual(kostenUmfang(filter({ zeitraum: 'eigen', von: '2026-11-01' })), ALLE);
  assert.strictEqual(kostenUmfang(FILTER_LEER), ALLE);
  assert.notStrictEqual(filterAnzahl(letzteWoche), 0, 'Gegenprobe: die Zahl der übrigen Berichte zählt den Zeitraum');
});

test('Probe PO Z. 89 mit vierter Spalte „Prüfung“: 1, 2, 3 ausgeschlossene Spalten → nie „alle Spalten“', () => {
  for (const ohne of [['Prüfung'], ['Prüfung', 'Fertig'], ['Eingang', 'Prüfung', 'Fertig']]) {
    const f = filter({ ohneSpalten: ohne });
    assert.strictEqual(kostenUmfang(f), NACH_FILTER, ohne.join(', '));
    assert.doesNotMatch(kostenUmfang(f), /alle Spalten/, ohne.join(', '));
  }
  assert.deepStrictEqual(kostenbericht(MIT_PRUEFUNG, GRUND, kostenFilter(filter({ ohneSpalten: ['Prüfung', 'Fertig'] }))),
    { m: 3, jeWaehrung: [{ waehrung: 'USD', n: 2, niedrig: 223, hoch: 323 }] });
  for (const f of [{ ohneFarben: ['drift'] }, { personen: ['st'] }, { labels: ['x'] }, { zeitraum: 'vorwoche', labels: ['x'] }])
    assert.strictEqual(kostenUmfang(filter(f)), NACH_FILTER, JSON.stringify(f));
});

test('Preisetikett: Spanne zeigt die Mitte, nennt die Spanne im Hinweis und im zugänglichen Namen', () => {
  const { preisetikett } = require('../../web/kosten.js');
  assert.deepStrictEqual(preisetikett(kostenInCent(usd({ min: 0.6, max: 1.6 }))), {
    sichtbar: `≈ 1,10${NBSP}$`,
    hinweis: `0,60–1,60${NBSP}$ · geschätzte API-Kosten`,
    name: `Preisetikett: geschätzt 0,60 bis 1,60${NBSP}$, API-Kosten`,
  });
  assert.strictEqual(preisetikett(kostenInCent(usd({ min: 0.6, max: 1.61 }))).sichtbar, `≈ 1,11${NBSP}$`, 'Mitte an der Rundungsgrenze');
});

test('Preisetikett: Betrag und Positionen mit gleichen Grenzen nennen einen Betrag, keine Spanne', () => {
  const { preisetikett } = require('../../web/kosten.js');
  assert.deepStrictEqual(preisetikett(kostenInCent({ currency: 'EUR', amount: 25.55 })), {
    sichtbar: `≈ 25,55${NBSP}€`,
    hinweis: `25,55${NBSP}€ · geschätzte API-Kosten`,
    name: `Preisetikett: geschätzt 25,55${NBSP}€, API-Kosten`,
  });
  const gleich = preisetikett(kostenInCent(usd({ items: [{ text: 'a', amount: 0.1 }, { text: 'b', amount: 0.2 }] })));
  assert.strictEqual(gleich.hinweis, `0,30${NBSP}$ · geschätzte API-Kosten`);
  const positionen = preisetikett(kostenInCent(usd({ items: [{ text: 'a', min: 0.1, max: 0.2 }, { text: 'b', min: 0.2, max: 0.4 }, { text: 'c', amount: 0.3 }] })));
  assert.strictEqual(positionen.sichtbar, `≈ 0,75${NBSP}$`);
  for (const k of [usd({ min: 0.6, max: 1.6 }), { currency: 'EUR', amount: 25.55 }, usd({ items: [{ text: 'a', amount: 0.1 }] })]) assert.strictEqual(preisetikett(kostenInCent(k)).name.match(/geschätzt/g).length, 1, 'PO Z. 120: „geschätzt“ nur einmal im Namen');
  assert.strictEqual(preisetikett(kostenInCent(usd({ min: 1000, max: 2000 }))).hinweis, `1.000,00–2.000,00${NBSP}$ · geschätzte API-Kosten`, 'Tausenderpunkt in beiden Grenzen');
});

test('Reiter-Rückfall: ohne Etikett gilt „Inhalt“; Fokus nur von Reiterleiste oder Panel „Kosten“', () => {
  const { reiterRueckfall } = require('../../web/kosten.js');
  assert.deepStrictEqual(reiterRueckfall({ tab: 'kosten', etikett: false, fokusBeiKosten: true }), { tab: 'inhalt', fokus: '#reiter-inhalt' });
  assert.deepStrictEqual(reiterRueckfall({ tab: 'kosten', etikett: false, fokusBeiKosten: false }), { tab: 'inhalt', fokus: null }, 'Fokus anderswo bleibt dort');
  assert.strictEqual(reiterRueckfall({ tab: 'kosten', etikett: true, fokusBeiKosten: true }), null, 'mit Etikett bleibt der Reiter');
  assert.strictEqual(reiterRueckfall({ tab: 'datei', etikett: false, fokusBeiKosten: true }), null, 'nur „Kosten“ fällt weg');
});

test('Zählwort (R00105 US-24, PO Z. 117): nach der Zahl 1 Einzahl, sonst Mehrzahl', () => {
  const { zaehlwort } = require('../../web/kosten.js');
  assert.strictEqual(zaehlwort(1, 'Aufgabe', 'Aufgaben'), 'Aufgabe');
  assert.strictEqual(zaehlwort(0, 'Aufgabe', 'Aufgaben'), 'Aufgaben', '0 von 0 Aufgaben');
  assert.strictEqual(zaehlwort(2, 'Aufgabe', 'Aufgaben'), 'Aufgaben');
  assert.strictEqual(zaehlwort(11, 'Aufgabe', 'Aufgaben'), 'Aufgaben', 'nur die Zahl 1, nicht die Endziffer');
});
