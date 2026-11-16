// Unit-Tests des Preisetiketts (R00105, node --test): Rechnen in ganzen Cent, Formatieren erst beim Anzeigen
process.env.TZ = 'Europe/Berlin'; // der Betrachter des Beispielboards (R00171) sitzt in +01:00
const test = require('node:test');
const assert = require('node:assert');
const { kostenInCent, geld, kostentabelle, kosteneintragstabelle, kostenbericht, kostenaufstellung, kostenSpaltenwahl, kostenbereichGewaehlt, filterOhneZeitraum, kostenUmfang } = require('../../web/kosten.js');
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
/** Seit R00165 zählt der Bericht angefallene Kosten: der Grundbestand trägt seine Beträge als alte Posten (cost.items). */
const posten = (currency, wert) => ({ currency, items: [{ text: 'Bau', ...wert }] });
const nurPosten = (waehrung, n, niedrig, hoch) => ({ waehrung, n, eintraege: null, posten: { niedrig, hoch }, niedrig, hoch });
const spalten = (eingang, inArbeit, fertig) => ({ spalten: [{ name: 'Eingang', aufgaben: eingang }, { name: 'In Arbeit', aufgaben: inArbeit }, { name: 'Fertig', aufgaben: fertig }] });
const GRUND = [aufgabe(1, posten('USD', { min: 0.6, max: 1.6 })), aufgabe(2, posten('USD', { amount: 1.63 }), { klasse: 'drift' }), aufgabe(3), aufgabe(4)];
const GRUND_BOARD = spalten([1, 4], [2], [3]);
const ARCHIV = [...GRUND, aufgabe(5, posten('USD', { amount: 0.5 }), { archiviert: '2026-11-01' }), aufgabe(6, posten('USD', { min: 0.1, max: 0.3 }), { archiviert: '2026-11-02' })];
const ARCHIV_BOARD = spalten([1, 4, 6], [2], [3, 5]);
const filter = mehr => ({ ...FILTER_LEER, ...mehr });

test('Kostenbericht: Summe je Währung über die Aufgaben mit angefallenen Kosten, m über alle Aufgaben des Boards', () => {
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, FILTER_LEER), { m: 4, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 2, 223, 323)] });
  assert.deepStrictEqual(kostenbericht(ARCHIV_BOARD, ARCHIV, FILTER_LEER), { m: 6, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 4, 283, 403)] }, 'archivierte zählen mit');
});

test('Kostenbericht: je Währung eine Zeile, USD zuerst, dann alphabetisch', () => {
  const mitEur = [...ARCHIV, aufgabe(7, posten('EUR', { amount: 25.55 }))];
  assert.deepStrictEqual(kostenbericht(spalten([1, 4, 6, 7], [2], [3, 5]), mitEur, FILTER_LEER).jeWaehrung,
    [nurPosten('USD', 4, 283, 403), nurPosten('EUR', 1, 2555, 2555)]);
  const mitChf = [...mitEur, aufgabe(8, posten('CHF', { amount: 2 })), aufgabe(9, posten('AUD', { amount: 1 }))];
  assert.deepStrictEqual(kostenbericht(spalten([1, 4, 6, 7, 8, 9], [2], [3, 5]), mitChf, FILTER_LEER).jeWaehrung.map(z => z.waehrung), ['USD', 'AUD', 'CHF', 'EUR']);
  const ohneUsd = [aufgabe(1, posten('EUR', { amount: 1 })), aufgabe(2, posten('CHF', { amount: 1 }))];
  assert.deepStrictEqual(kostenbericht(spalten([1, 2], [], []), ohneUsd, FILTER_LEER).jeWaehrung.map(z => z.waehrung), ['CHF', 'EUR']);
});

test('Kostenbericht Gegenbeispiele: Aufgabe auf keinem Board, Leerfälle', () => {
  const mitFremder = [...GRUND, aufgabe(10, posten('USD', { amount: 5 }))];
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, mitFremder, FILTER_LEER), { m: 4, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 2, 223, 323)] }, 'nicht auf dem Board → zählt nicht');
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, [aufgabe(1), aufgabe(2), aufgabe(3), aufgabe(4)], FILTER_LEER), { m: 4, nurSchaetzung: 0, jeWaehrung: [] }, 'keine angefallenen Kosten');
  assert.deepStrictEqual(kostenbericht(spalten([], [], []), [], FILTER_LEER), { m: 0, nurSchaetzung: 0, jeWaehrung: [] }, 'Board ohne Aufgaben');
});

test('Kostenbericht nach Filter: Spalten, Klasse, Zuständige, Labels', () => {
  assert.deepStrictEqual(kostenbericht(ARCHIV_BOARD, ARCHIV, filter({ ohneSpalten: ['Fertig'] })), { m: 4, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 3, 233, 353)] });
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneSpalten: ['Fertig'] })), { m: 3, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 2, 223, 323)] }, '2 von 3');
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneSpalten: ['Eingang'] })), { m: 2, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 1, 163, 163)] }, '1,63 · 1 von 2');
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneFarben: ['drift'] })), { m: 3, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 1, 60, 160)] }, 'Klasse drift aus');
  const mitPerson = GRUND.map(a => a.nummer === 1 ? { ...a, zustaendige: ['st'], labels: ['x'] } : a);
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, mitPerson, filter({ personen: ['st'] })), { m: 1, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 1, 60, 160)] });
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, mitPerson, filter({ labels: ['x'] })).m, 1);
  assert.deepStrictEqual(kostenbericht(GRUND_BOARD, GRUND, filter({ ohneSpalten: ['Eingang', 'In Arbeit', 'Fertig'] })), { m: 0, nurSchaetzung: 0, jeWaehrung: [] }, 'alle Spalten aus');
});

test('Kostenbericht: eine Nummer in der Spalte ohne lesbare Aufgabe zählt in m wie in den übrigen Berichten, ohne Kosten', () => {
  assert.deepStrictEqual(kostenbericht(spalten([1, 4, 11], [2], [3]), GRUND, FILTER_LEER), { m: 5, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 2, 223, 323)] });
  assert.strictEqual(kostenbericht(spalten([1, 4, 11], [2], [3]), GRUND, filter({ labels: ['x'] })).m, 0, 'mit Label-Filter passt sie nicht');
});

/* ── Angefallene Kosten (R00165 AK 9, I0155): Kosteneinträge und alte Posten zählen, Schätzungen nicht ── */
const eintrag = (amount, mehr = {}) => ({ at: '2026-11-13 10:34+01:00', role: 'entwickler', column: 'Entwicklung', amount, currency: 'USD', ...mehr });
const ALTE_POSTEN = usd({ items: [{ text: 'Planung', min: 0.10, max: 0.20 }, { text: 'Bau', amount: 0.30 }] });
const SCHAETZUNG = usd({ amount: 1.63 });

test('Rechenbeispiel R00165 AK 9: Einträge 4,66 · alte Posten 0,40–0,50 · Summe 5,06–5,16 · 2 von 4, die Schätzung zählt nicht', () => {
  const aufgaben = [aufgabe(1, null, { kosteneintraege: [eintrag(3.46), eintrag(1.20, { at: '2026-11-13 11:02+01:00' })] }), aufgabe(2, ALTE_POSTEN), aufgabe(3, SCHAETZUNG), aufgabe(4)];
  assert.deepStrictEqual(kostenbericht(spalten([3, 4], [1], [2]), aufgaben, FILTER_LEER),
    { m: 4, nurSchaetzung: 1, jeWaehrung: [{ waehrung: 'USD', n: 2, eintraege: 466, posten: { niedrig: 40, hoch: 50 }, niedrig: 506, hoch: 516 }] });
});

test('Rechenbeispiel der Zeichnung (Bericht Bild 1): Einträge 5,18 · alte Posten 0,40–0,50 · Summe 5,58–5,68 · 2 von 3', () => {
  const drei = [eintrag(3.46), eintrag(1.20, { at: '2026-11-13 11:02+01:00' }), eintrag(0.52, { at: '2026-11-12 16:48+01:00', role: 'planer', column: 'Detailplanung' })];
  const aufgaben = [aufgabe(1, null, { kosteneintraege: drei }), aufgabe(2, ALTE_POSTEN), aufgabe(3, SCHAETZUNG)];
  assert.deepStrictEqual(kostenbericht(spalten([3], [1], [2]), aufgaben, FILTER_LEER),
    { m: 3, nurSchaetzung: 1, jeWaehrung: [{ waehrung: 'USD', n: 2, eintraege: 518, posten: { niedrig: 40, hoch: 50 }, niedrig: 558, hoch: 568 }] });
});

const nurEintraege = (waehrung, n, cent) => ({ waehrung, n, eintraege: cent, posten: null, niedrig: cent, hoch: cent });
const mitEintraegen = (nummer, eintraege, cost = null, mehr = {}) => aufgabe(nummer, cost, { kosteneintraege: eintraege, ...mehr });

test('Schaden 1: Beträge in ganzen Cent — 0,10 + 0,20 + 3,46 ergibt genau 376, jeder Eintrag einmal in seiner Währung', () => {
  const gemischt = [eintrag(0.10), eintrag(0.20), eintrag(3.46), eintrag(25.55, { currency: 'EUR' })];
  assert.deepStrictEqual(kostenbericht(spalten([1], [], []), [mitEintraegen(1, gemischt)], FILTER_LEER),
    { m: 1, nurSchaetzung: 0, jeWaehrung: [nurEintraege('USD', 1, 376), nurEintraege('EUR', 1, 2555)] });
  const zehnmal = Array.from({ length: 10 }, () => eintrag(0.10));
  assert.notStrictEqual(zehnmal.reduce((summe, e) => summe + e.amount, 0), 1, 'Gegenprobe: als Gleitkommazahlen addiert sind zehnmal 0,10 nicht 1,00');
  assert.deepStrictEqual(kostenbericht(spalten([1], [], []), [mitEintraegen(1, zehnmal)], FILTER_LEER).jeWaehrung, [nurEintraege('USD', 1, 100)]);
});

test('Schaden 1: Einträge und alte Posten derselben Aufgabe zählen beide, die Aufgabe einmal in n; Posten in ihrer eigenen Währung', () => {
  const beides = mitEintraegen(1, [eintrag(3.46)], ALTE_POSTEN);
  assert.deepStrictEqual(kostenbericht(spalten([1], [], []), [beides], FILTER_LEER).jeWaehrung,
    [{ waehrung: 'USD', n: 1, eintraege: 346, posten: { niedrig: 40, hoch: 50 }, niedrig: 386, hoch: 396 }]);
  const postenInEur = mitEintraegen(1, [eintrag(3.46)], posten('EUR', { min: 1, max: 2 }));
  assert.deepStrictEqual(kostenbericht(spalten([1], [], []), [postenInEur], FILTER_LEER).jeWaehrung,
    [nurEintraege('USD', 1, 346), nurPosten('EUR', 1, 100, 200)]);
});

test('Schaden 2: reine Schätzungen zählen in keiner Summe und in keinem n, werden aber gezählt ausgewiesen', () => {
  const zweiSchaetzungen = [aufgabe(1, SCHAETZUNG), aufgabe(2, { currency: 'EUR', min: 1, max: 2 }), aufgabe(3)];
  assert.deepStrictEqual(kostenbericht(spalten([1, 2, 3], [], []), zweiSchaetzungen, FILTER_LEER), { m: 3, nurSchaetzung: 2, jeWaehrung: [] });
  const schaetzungUndEintrag = mitEintraegen(1, [eintrag(1.20)], SCHAETZUNG);
  assert.deepStrictEqual(kostenbericht(spalten([1], [], []), [schaetzungUndEintrag], FILTER_LEER),
    { m: 1, nurSchaetzung: 0, jeWaehrung: [nurEintraege('USD', 1, 120)] }, 'Schätzung neben Einträgen bleibt unerwähnt, ihre 1,63 zählen nicht');
  const leerePostenliste = aufgabe(1, usd({ amount: 1.63, items: [] }));
  assert.deepStrictEqual(kostenbericht(spalten([1], [], []), [leerePostenliste], FILTER_LEER), { m: 1, nurSchaetzung: 1, jeWaehrung: [] });
});

test('Schaden 3: Spannen alter Posten bleiben Spannen in der Summe, Einträge zählen in Unter- und Obergrenze', () => {
  const aufgaben = [mitEintraegen(1, [eintrag(4.66)]), aufgabe(2, posten('USD', { min: 0.6, max: 1.6 })), aufgabe(3, posten('USD', { amount: 1.63 }))];
  assert.deepStrictEqual(kostenbericht(spalten([1, 2, 3], [], []), aufgaben, FILTER_LEER).jeWaehrung,
    [{ waehrung: 'USD', n: 3, eintraege: 466, posten: { niedrig: 223, hoch: 323 }, niedrig: 689, hoch: 789 }]);
});

test('Schaden 4: Filter (Person, Label, Farbe, Spalten) wirken auf Einträge, alte Posten und Schätzungen gleich; archivierte zählen', () => {
  const mehr = { zustaendige: ['st'], labels: ['x'], klasse: 'drift' };
  const aufgaben = [mitEintraegen(1, [eintrag(3.46)], null, mehr), aufgabe(2, ALTE_POSTEN, mehr), aufgabe(3, SCHAETZUNG, mehr),
    mitEintraegen(4, [eintrag(1.20)], null, { archiviert: '2026-11-02' }), aufgabe(5, ALTE_POSTEN), aufgabe(6, SCHAETZUNG)];
  const board = spalten([1, 2, 3], [], [4, 5, 6]);
  const alle = { m: 6, nurSchaetzung: 2, jeWaehrung: [{ waehrung: 'USD', n: 4, eintraege: 466, posten: { niedrig: 80, hoch: 100 }, niedrig: 546, hoch: 566 }] };
  const nurMarkierte = { m: 3, nurSchaetzung: 1, jeWaehrung: [{ waehrung: 'USD', n: 2, eintraege: 346, posten: { niedrig: 40, hoch: 50 }, niedrig: 386, hoch: 396 }] };
  const ohneMarkierte = { m: 3, nurSchaetzung: 1, jeWaehrung: [{ waehrung: 'USD', n: 2, eintraege: 120, posten: { niedrig: 40, hoch: 50 }, niedrig: 160, hoch: 170 }] };
  assert.deepStrictEqual(kostenbericht(board, aufgaben, FILTER_LEER), alle, 'ohne Filter, die archivierte #4 zählt');
  for (const f of [{ personen: ['st'] }, { labels: ['x'] }, { ohneSpalten: ['Fertig'] }])
    assert.deepStrictEqual(kostenbericht(board, aufgaben, filter(f)), nurMarkierte, JSON.stringify(f));
  for (const f of [{ ohneFarben: ['drift'] }, { ohneSpalten: ['Eingang'] }])
    assert.deepStrictEqual(kostenbericht(board, aufgaben, filter(f)), ohneMarkierte, JSON.stringify(f));
});

/* ── Ansicht „Kosten“: Tabelle der Kosteneinträge (R00165 AK 10, Zeichnung D0003 #kosten-eintraege) ── */
const LAUF_1034 = eintrag(3.46, { tokens: 81234 });
const LAUF_1102 = eintrag(1.20, { at: '2026-11-13 11:02+01:00' });
const LAUF_PLANER = eintrag(0.52, { at: '2026-11-12 16:48+01:00', role: 'planer', column: 'Detailplanung', tokens: 12000 });

test('Kosteneinträge AK 10: neueste oben mit Zeitpunkt, Rolle, Spalte, Tokens und Betrag in Cent; Summe 4,66 bzw. 5,18 mit Tokens', () => {
  assert.deepStrictEqual(kosteneintragstabelle([LAUF_1034, LAUF_1102]), {
    spalteTokens: true,
    zeilen: [
      { zeitpunkt: '2026-11-13 11:02+01:00', rolle: 'entwickler', spalte: 'Entwicklung', tokens: null, cent: 120, waehrung: 'USD' },
      { zeitpunkt: '2026-11-13 10:34+01:00', rolle: 'entwickler', spalte: 'Entwicklung', tokens: 81234, cent: 346, waehrung: 'USD' },
    ],
    summen: [{ waehrung: 'USD', cent: 466, tokens: 81234 }],
  });
  const drei = kosteneintragstabelle([LAUF_PLANER, LAUF_1034, LAUF_1102]);
  assert.deepStrictEqual(drei.zeilen.map(z => z.cent), [120, 346, 52], 'nach Zeitpunkt, nicht nach Dateireihenfolge');
  assert.deepStrictEqual(drei.summen, [{ waehrung: 'USD', cent: 518, tokens: 93234 }]);
});

test('Kosteneinträge: gleicher Moment in zwei Schreibweisen bleibt in Dateireihenfolge; ein späterer Versatz sortiert nach dem Moment, nicht nach dem Text', () => {
  const gleich = [eintrag(1, { at: '2026-11-13 10:34+01:00', role: 'a' }), eintrag(2, { at: '2026-11-13 09:34Z', role: 'b' }), eintrag(3, { at: '2026-11-13 10:34+01:00', role: 'c' })];
  assert.deepStrictEqual(kosteneintragstabelle(gleich).zeilen.map(z => z.rolle), ['a', 'b', 'c']);
  const versatz = [eintrag(1, { at: '2026-11-13 10:00+01:00', role: 'frueher' }), eintrag(2, { at: '2026-11-13 09:30-01:00', role: 'spaeter' })];
  assert.deepStrictEqual(kosteneintragstabelle(versatz).zeilen.map(z => z.rolle), ['spaeter', 'frueher']);
});

test('Kosteneinträge in zwei Währungen: je Währung eine Summe, USD zuerst, die Tokens-Summe aller Einträge nur in der ersten', () => {
  const t = kosteneintragstabelle([LAUF_1034, eintrag(25.55, { at: '2026-11-12 16:48+01:00', currency: 'EUR', tokens: 12000 }), LAUF_PLANER]);
  assert.deepStrictEqual(t.summen, [{ waehrung: 'USD', cent: 398, tokens: 105234 }, { waehrung: 'EUR', cent: 2555, tokens: null }]);
  assert.deepStrictEqual(t.zeilen.map(z => [z.cent, z.waehrung]), [[346, 'USD'], [2555, 'EUR'], [52, 'USD']], 'gleicher Zeitpunkt: Dateireihenfolge');
});

test('Kosteneinträge Gegenbeispiele: kein Eintrag mit Tokens → keine Spalte Tokens; 0 Tokens sind Tokens; ein Eintrag hat schon eine Summe', () => {
  const ohne = kosteneintragstabelle([LAUF_1102]);
  assert.deepStrictEqual([ohne.spalteTokens, ohne.summen], [false, [{ waehrung: 'USD', cent: 120, tokens: null }]]);
  const null_tokens = kosteneintragstabelle([eintrag(0.10, { tokens: 0 })]);
  assert.deepStrictEqual([null_tokens.spalteTokens, null_tokens.summen[0].tokens], [true, 0]);
  assert.deepStrictEqual(kosteneintragstabelle([]), { spalteTokens: false, zeilen: [], summen: [] });
});

test('Schaden 5: die Summe der Ansicht einer Aufgabe ist ihr Beitrag „Einträge“ im Bericht — je Währung derselbe Cent-Betrag', () => {
  const eintraege = [eintrag(0.10), eintrag(0.20), eintrag(3.46), eintrag(25.55, { currency: 'EUR' }), eintrag(0.07, { currency: 'EUR' })];
  const ansicht = kosteneintragstabelle(eintraege).summen.map(s => [s.waehrung, s.cent]);
  const bericht = kostenbericht(spalten([1], [], []), [mitEintraegen(1, eintraege, SCHAETZUNG)], FILTER_LEER).jeWaehrung.map(g => [g.waehrung, g.eintraege]);
  assert.deepStrictEqual(ansicht, [['USD', 376], ['EUR', 2562]]);
  assert.deepStrictEqual(bericht, ansicht);
});

/* ── Filter auf den Kostenbericht (B0373): Zeitraum und Rechnen ab gelten nicht ── */
const ALLE = 'alle Spalten, auch archivierte', NACH_FILTER = 'nach Filter, auch archivierte';
const MIT_PRUEFUNG = { spalten: [...GRUND_BOARD.spalten.slice(0, 2), { name: 'Prüfung', aufgaben: [] }, GRUND_BOARD.spalten[2]] };

test('Filter ohne Zeitraum (Kosten, Bestand): gespeicherter Zeitraum fällt weg, alles andere bleibt', () => {
  const letzteWoche = filter({ zeitraum: 'vorwoche', ohneFarben: ['drift'], personen: ['st'], labels: ['x'], ohneSpalten: ['Fertig'] });
  assert.deepStrictEqual(filterOhneZeitraum(letzteWoche), { ...letzteWoche, zeitraum: 'alles', von: '', bis: '' });
  const eigen = filter({ zeitraum: 'eigen', von: '2026-11-01', bis: '2026-11-07' });
  assert.deepStrictEqual(filterOhneZeitraum(eigen), FILTER_LEER);
  assert.deepStrictEqual(eigen.zeitraum, 'eigen', 'der gespeicherte Filter bleibt unverändert (Burndown zeigt ihn weiter)');
});

test('Kostenbericht mit gespeichertem Zeitraum: gleiche Zahlen und Umfang „alle Spalten“', () => {
  const letzteWoche = filter({ zeitraum: 'vorwoche' });
  assert.deepStrictEqual(kostenbericht(ARCHIV_BOARD, ARCHIV, filterOhneZeitraum(letzteWoche)), kostenbericht(ARCHIV_BOARD, ARCHIV, FILTER_LEER));
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
  assert.deepStrictEqual(kostenbericht(MIT_PRUEFUNG, GRUND, filterOhneZeitraum(filter({ ohneSpalten: ['Prüfung', 'Fertig'] }))),
    { m: 3, nurSchaetzung: 0, jeWaehrung: [nurPosten('USD', 2, 223, 323)] });
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

test('Ansichts-Rückfall (R00145 FA 2, generisch): tab ∉ Ansichten(a) → inhalt; Fokus nur vom Auslöser oder aus dem Menü', () => {
  const { reiterRueckfall } = require('../../web/kosten.js');
  const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
  const ohneKosten = ['inhalt', 'zeiten', 'details', 'datei', 'verlauf'];
  assert.deepStrictEqual(reiterRueckfall({ tab: 'kosten', schluessel: ohneKosten, fokusBeiReiter: true }), { tab: 'inhalt', fokus: AUSLOESER });
  assert.deepStrictEqual(reiterRueckfall({ tab: 'kosten', schluessel: ohneKosten, fokusBeiReiter: false }), { tab: 'inhalt', fokus: null }, 'Fokus anderswo bleibt dort');
  assert.strictEqual(reiterRueckfall({ tab: 'datei', schluessel: ohneKosten, fokusBeiReiter: true }), null, 'eine vorhandene Ansicht bleibt');
  const ohneVerlauf = ['inhalt', 'zeiten', 'details', 'datei'];
  assert.deepStrictEqual(reiterRueckfall({ tab: 'verlauf', schluessel: ohneVerlauf, fokusBeiReiter: true }), { tab: 'inhalt', fokus: AUSLOESER }, 'generisch für jede fehlende Ansicht („Verlauf“, nicht nur „Kosten“)');
  assert.deepStrictEqual(reiterRueckfall({ tab: 'anhaenge', schluessel: ohneVerlauf, fokusBeiReiter: true }), { tab: 'inhalt', fokus: AUSLOESER }, 'der entfallene Stand „Anhänge“ fällt auf „Inhalt“');
});

test('Zählwort (R00105 US-24, PO Z. 117; R00134): nach der Zahl 1 Einzahl, sonst Mehrzahl — die Hilfe liegt in web/kultur.js', () => {
  const { zaehlwort } = require('../../web/kultur.js');
  assert.strictEqual(zaehlwort(1, 'Aufgabe', 'Aufgaben'), 'Aufgabe');
  assert.strictEqual(zaehlwort(0, 'Aufgabe', 'Aufgaben'), 'Aufgaben', '0 von 0 Aufgaben');
  assert.strictEqual(zaehlwort(2, 'Aufgabe', 'Aufgaben'), 'Aufgaben');
  assert.strictEqual(zaehlwort(11, 'Aufgabe', 'Aufgaben'), 'Aufgaben', 'nur die Zahl 1, nicht die Endziffer');
});

test('R00134: web/kosten.js exportiert zaehlwort nicht mehr — eine Zählwort-Hilfe an einer Stelle', () => {
  const kosten = require('../../web/kosten.js');
  assert.strictEqual(Object.hasOwn(kosten, 'zaehlwort'), false, 'keine zweite Definition in web/kosten.js');
  assert.strictEqual(typeof require('../../web/kultur.js').zaehlwort, 'function');
});

/* ── R00171 Zeitraum, Spaltenabschnitt und Aufgabenliste: das Beispielboard mit vier Aufgaben ── */
const BEISPIEL = require('../tests/r00171-beispielboard.js');
const JETZT = new Date(BEISPIEL.HEUTE).getTime();
function beispielAufgabe(vorlage, zusatz = []) {
  let cost = null;
  if (vorlage.altePosten) cost = posten('USD', { amount: vorlage.altePosten });
  return aufgabe(vorlage.nummer, cost, { titel: vorlage.titel, archiviert: vorlage.archiviert || null, reservierung: null, kosteneintraege: [...vorlage.eintraege, ...zusatz] });
}
/** `zusatz` hängt weitere Einträge an eine Aufgabe: {2: [FREMDE_SPALTE]}. */
const beispielAufgaben = (zusatz = {}) => BEISPIEL.AUFGABEN.map(a => beispielAufgabe(a, zusatz[a.nummer]));
const BEISPIEL_BOARD = { fieber: { zielspalte: null }, spalten: BEISPIEL.SPALTEN.map(name => ({ name, aufgaben: BEISPIEL.AUFGABEN.filter(a => a.spalte === name).map(a => a.nummer) })) };
/** Stand vor der Karte (main `6ebaeef`), am unveränderten web/kosten.js mit kostenbericht(BEISPIEL_BOARD, beispielAufgaben(), FILTER_LEER) gerechnet und hier festgehalten. */
const VOR_DER_KARTE = { m: 4, nurSchaetzung: 0, jeWaehrung: [{ waehrung: 'USD', n: 4, eintraege: 1100, posten: { niedrig: 500, hoch: 500 }, niedrig: 1600, hoch: 1600 }] };

test('R00171 B0833 (AK 3, AK 4): ohne Zeitraum und Abschnitt rechnet kostenbericht() das Beispielboard wie vor der Karte — Einträge 11,00, alte Posten 5,00, Summe 16,00 · 4 von 4', () => {
  assert.deepStrictEqual(kostenbericht(BEISPIEL_BOARD, beispielAufgaben(), FILTER_LEER, JETZT), VOR_DER_KARTE);
  assert.deepStrictEqual(kostenbericht(BEISPIEL_BOARD, beispielAufgaben(), FILTER_LEER), VOR_DER_KARTE, 'der Aufruf von heute, ohne Uhr');
});

test('R00171 B0833 (AK 1, Teil Zeitraum): mit Zeitraum 12.11.–13.11. zählen nur die Einträge dieser Tage — 1,00 + 3,46 + 0,54 = 5,00 in 2 von 4 Aufgaben; die alten Posten zählen nicht mit', () => {
  const [usd] = kostenbericht(BEISPIEL_BOARD, beispielAufgaben(), filter(BEISPIEL.ZEITRAUM_12_13), JETZT).jeWaehrung;
  assert.deepStrictEqual([usd.eintraege, usd.niedrig, usd.hoch, usd.n], [500, 500, 500, 2]);
});

/* ── B0834 kostenbericht() rechnet mit Zeitraum, kostenaufstellung() nennt die Aufgaben dahinter ── */
const aufstellung = (f, zusatz = {}, board = BEISPIEL_BOARD) => kostenaufstellung(board, beispielAufgaben(zusatz), filter(f), JETZT);
const usdSumme = (f, zusatz = {}) => kostenbericht(BEISPIEL_BOARD, beispielAufgaben(zusatz), filter(f), JETZT).jeWaehrung.map(g => [g.waehrung, g.eintraege, g.niedrig, g.hoch]);
const betraege = gruppe => gruppe.aufgaben.map(a => [a.nummer, a.cent]);

test('R00171 B0834 (AK 3): ohne Bereiche nennt die Aufstellung #1 6,46, #2 0,54 und #3 4,00 — die alten Posten von #4 bleiben in der Summe und stehen nie in der Liste', () => {
  const a = aufstellung({});
  assert.strictEqual(a.bereich, false);
  assert.deepStrictEqual([a.m, a.nurSchaetzung], [4, 0]);
  assert.deepStrictEqual(a.gruppen.map(g => g.waehrung), ['USD']);
  assert.deepStrictEqual(a.gruppen[0].summe, VOR_DER_KARTE.jeWaehrung[0], 'die Summe ist die von kostenbericht()');
  assert.deepStrictEqual(betraege(a.gruppen[0]), [[1, 646], [2, 54], [3, 400]]);
  assert.deepStrictEqual(a.gruppen[0].aufgaben[0].titel, 'Angebot für das Kundenprojekt schreiben');
  assert.strictEqual(a.gruppen[0].altePostenAussen, null, 'ohne Bereich steht nichts neben der Summe');
});

test('R00171 B0834 (AK 1, Teil Zeitraum): 12.11.–13.11. — Summe 5,00, Liste #1 4,46 und #2 0,54, #3 fehlt; die alten Posten 5,00 stehen daneben und zählen nicht mit', () => {
  const a = aufstellung(BEISPIEL.ZEITRAUM_12_13);
  assert.strictEqual(a.bereich, true);
  assert.deepStrictEqual(a.gruppen[0].summe, { waehrung: 'USD', n: 2, eintraege: 500, posten: null, niedrig: 500, hoch: 500 });
  assert.deepStrictEqual(betraege(a.gruppen[0]), [[1, 446], [2, 54]]);
  assert.deepStrictEqual(a.gruppen[0].altePostenAussen, { niedrig: 500, hoch: 500 });
  assert.strictEqual(a.m, 4, 'm zählt weiter alle Aufgaben des Boards');
});

test('R00171 B0834 (AK 9, Schaden b): Tagesgrenze in der Ortszeit — 13.11. 23:30+01:00 zählt zum 13.11., 14.11. 00:10+01:00 nicht: Summe 5,10', () => {
  const zusatz = { 2: [BEISPIEL.VOR_MITTERNACHT, BEISPIEL.NACH_MITTERNACHT] };
  assert.deepStrictEqual(usdSumme(BEISPIEL.ZEITRAUM_12_13, zusatz), [['USD', 510, 510, 510]]);
  assert.deepStrictEqual(betraege(aufstellung(BEISPIEL.ZEITRAUM_12_13, zusatz).gruppen[0]), [[1, 446], [2, 64]]);
  const inUtc = { ...BEISPIEL.VOR_MITTERNACHT, at: '2026-11-13 22:30Z' }, schonMorgen = { ...BEISPIEL.VOR_MITTERNACHT, at: '2026-11-13 23:30+00:00' };
  assert.deepStrictEqual(usdSumme(BEISPIEL.ZEITRAUM_12_13, { 2: [inUtc] }), [['USD', 510, 510, 510]], 'derselbe Moment in UTC geschrieben');
  assert.deepStrictEqual(usdSumme(BEISPIEL.ZEITRAUM_12_13, { 2: [schonMorgen] }), [['USD', 500, 500, 500]], '23:30 in UTC ist beim Betrachter schon der 14.11.');
});

test('R00171 B0834 (Schaden b): beide Grenzen zählen mit, jeder Eintrag genau einmal — ein Tag allein, offene Grenzen und die Zerlegung des Ganzen in zwei Zeiträume', () => {
  assert.deepStrictEqual(usdSumme({ zeitraum: 'eigen', von: '2026-11-13', bis: '2026-11-13' }), [['USD', 400, 400, 400]], '13.11. allein: 3,46 + 0,54');
  assert.deepStrictEqual(usdSumme({ zeitraum: 'eigen', von: '2026-11-14', bis: '' }), [['USD', 200, 200, 200]], 'ab dem 14.11.');
  assert.deepStrictEqual(usdSumme({ zeitraum: 'eigen', von: '', bis: '2026-11-13' }), [['USD', 900, 900, 900]], 'bis zum 13.11.: 4,00 + 1,00 + 3,46 + 0,54');
  assert.strictEqual(900 + 200, VOR_DER_KARTE.jeWaehrung[0].eintraege, 'bis 13.11. und ab 14.11. ergeben zusammen alle Einträge');
  assert.deepStrictEqual(usdSumme({ zeitraum: 'eigen', von: '2026-11-20', bis: '2026-11-21' }), [], 'ein Zeitraum ohne Eintrag: keine Gruppe');
});

test('R00171 B0834: ein benannter Zeitraum rechnet von der Uhr des Betrachters aus — „letzte Woche“ am 16.11. ist der 09.11.–15.11.', () => {
  assert.deepStrictEqual(usdSumme({ zeitraum: 'vorwoche' }), [['USD', 700, 700, 700]], '1,00 + 3,46 + 2,00 + 0,54');
  assert.deepStrictEqual(usdSumme({ zeitraum: 'heute' }), []);
});

test('R00171 B0834 (Schaden b): mit Zeitraum je Währung getrennt und in ganzen Cent — 0,10 + 0,20 USD = 30 Cent, der Euro-Eintrag in seiner eigenen Gruppe und Liste', () => {
  const zehn = BEISPIEL.eintrag('12 10:00', 'Entwicklung', 0.10), zwanzig = BEISPIEL.eintrag('13 10:00', 'Entwicklung', 0.20);
  const euro = { ...BEISPIEL.eintrag('13 12:00', 'Abnahme', 25.55), currency: 'EUR' }, euroDanach = { ...BEISPIEL.eintrag('14 12:00', 'Abnahme', 1.00), currency: 'EUR' };
  const board = spalten([1, 2], [], []);
  const aufgaben = [mitEintraegen(1, [zehn, zwanzig, euro]), mitEintraegen(2, [euroDanach], posten('EUR', { min: 1, max: 2 }))];
  const a = kostenaufstellung(board, aufgaben, filter(BEISPIEL.ZEITRAUM_12_13), JETZT);
  assert.deepStrictEqual(a.gruppen.map(g => [g.waehrung, g.summe && g.summe.eintraege, betraege(g), g.altePostenAussen]),
    [['USD', 30, [[1, 30]], null], ['EUR', 2555, [[1, 2555]], { niedrig: 100, hoch: 200 }]]);
});

test('R00171 B0834 (Schaden c): stehen im Zeitraum nur alte Posten, bleibt ihre Währung mit dem Betrag daneben genannt — ohne Summe und ohne Liste', () => {
  const a = kostenaufstellung(spalten([1], [], []), [aufgabe(1, posten('EUR', { amount: 3 }), { titel: 'alt' })], filter(BEISPIEL.ZEITRAUM_12_13), JETZT);
  assert.deepStrictEqual(a.gruppen.map(g => [g.waehrung, g.summe, g.aufgaben, g.altePostenAussen]), [['EUR', null, [], { niedrig: 300, hoch: 300 }]]);
});

/* ── B0838 der Spaltenabschnitt als Schnitt mit dem Zeitraum (ADR-0028 N1 Punkt 4) ── */
const abschnitt = (von, bis, mehr = {}) => ({ kostenVonSpalte: von, kostenBisSpalte: bis, ...mehr });

test('R00171 B0838 (AK 1): Zeitraum 12.11.–13.11. und Abschnitt „Entwicklung“–„Abnahme“ — Summe 5,00, #1 4,46 und #2 0,54; die alten Posten 5,00 stehen daneben', () => {
  const a = aufstellung(abschnitt('Entwicklung', 'Abnahme', BEISPIEL.ZEITRAUM_12_13));
  assert.deepStrictEqual(a.gruppen[0].summe, { waehrung: 'USD', n: 2, eintraege: 500, posten: null, niedrig: 500, hoch: 500 });
  assert.deepStrictEqual(betraege(a.gruppen[0]), [[1, 446], [2, 54]]);
  assert.deepStrictEqual(a.gruppen[0].altePostenAussen, { niedrig: 500, hoch: 500 });
});

test('R00171 B0838 (AK 2): Zeitraum 12.11.–14.11. und Abschnitt „Abnahme“–„Abnahme“ — Summe 2,00, allein #1 mit 2,00; ihre Einträge aus „Entwicklung“ zählen nicht', () => {
  const a = aufstellung(abschnitt('Abnahme', 'Abnahme', BEISPIEL.ZEITRAUM_12_14));
  assert.deepStrictEqual(a.gruppen[0].summe, { waehrung: 'USD', n: 1, eintraege: 200, posten: null, niedrig: 200, hoch: 200 });
  assert.deepStrictEqual(betraege(a.gruppen[0]), [[1, 200]]);
});

test('R00171 B0838 (Schaden b, c): der Abschnitt allein, ohne Zeitraum — beide Grenzen zählen mit, die Reihenfolge der Angabe ist gleichgültig, eine Grenze allein ist offen bis zum Rand; alte Posten stehen daneben', () => {
  const summe = (von, bis) => usdSumme(abschnitt(von, bis)).map(g => g[1]);
  assert.deepStrictEqual(summe('Entwicklung', 'Entwicklung'), [900], '4,00 + 1,00 + 3,46 + 0,54');
  assert.deepStrictEqual(summe('Entwicklung', 'Abnahme'), [1100]);
  assert.deepStrictEqual(summe('Abnahme', 'Entwicklung'), [1100], 'vertauscht angegeben');
  assert.deepStrictEqual(summe('Abnahme', ''), [200], 'nur von: bis zum rechten Rand');
  assert.deepStrictEqual(summe('', 'Entwicklung'), [900], 'nur bis: ab dem linken Rand');
  assert.deepStrictEqual(summe('Produktiv', 'Produktiv'), [], 'in „Produktiv“ ist nichts angefallen — die Aufgaben, die dort stehen, zählen nicht deshalb');
  assert.deepStrictEqual(summe('Eingang', 'Produktiv'), [1100], 'alle Spalten gewählt: jeder Eintrag einmal');
  assert.strictEqual(900 + 200, 1100, '„bis Entwicklung“ und „ab Abnahme“ ergeben zusammen alle Einträge');
  const a = aufstellung(abschnitt('Abnahme', ''));
  assert.deepStrictEqual([a.bereich, a.gruppen[0].summe.posten, a.gruppen[0].altePostenAussen], [true, null, { niedrig: 500, hoch: 500 }]);
});

test('R00171 B0838: es zählt die Spalte des Eintrags, nicht die Spalte, in der die Aufgabe heute steht — und Phasen ändern die Spaltenfolge nicht', () => {
  const mitPhasen = { ...BEISPIEL_BOARD, spalten: BEISPIEL_BOARD.spalten.map((sp, i) => ({ ...sp, phase: i < 2 ? 'Bau' : 'Betrieb' })) };
  const a = aufstellung(abschnitt('Entwicklung', 'Entwicklung'), {}, mitPhasen);
  assert.deepStrictEqual(betraege(a.gruppen[0]), [[1, 446], [2, 54], [3, 400]], '#1 steht in „Produktiv“, ihre Einträge aus „Entwicklung“ zählen');
});

/* ── B0839 Auswahl der Von- und Bis-Spalte in der Bereichszeile ── */
const gesperrte = eintraege => eintraege.filter(e => e.gesperrt).map(e => e.name);
const gewaehlte = eintraege => eintraege.filter(e => e.gewaehlt).map(e => e.name);

test('R00171 B0839 (Zeichnung Bild 1): die Auswahlen führen die Spalten des Boards in ihrer Folge; was die andere Grenze ausschließt, ist gesperrt — in „von“ alles rechts von „bis“, in „bis“ alles links von „von“', () => {
  const wahl = kostenSpaltenwahl(BEISPIEL_BOARD, filter(abschnitt('Entwicklung', 'Abnahme')));
  assert.deepStrictEqual(wahl.von.map(e => e.name), BEISPIEL.SPALTEN);
  assert.deepStrictEqual(wahl.bis.map(e => e.name), BEISPIEL.SPALTEN);
  assert.deepStrictEqual([gewaehlte(wahl.von), gesperrte(wahl.von)], [['Entwicklung'], ['Produktiv']]);
  assert.deepStrictEqual([gewaehlte(wahl.bis), gesperrte(wahl.bis)], [['Abnahme'], ['Eingang']]);
  const gleich = kostenSpaltenwahl(BEISPIEL_BOARD, filter(abschnitt('Abnahme', 'Abnahme')));
  assert.deepStrictEqual([gesperrte(gleich.von), gesperrte(gleich.bis)], [['Produktiv'], ['Eingang', 'Entwicklung']], 'dieselbe Spalte bleibt auf beiden Seiten wählbar');
});

test('R00171 B0839: ohne Wahl ist nichts gewählt und nichts gesperrt; eine Grenze allein sperrt nur die andere Seite; „Zurücksetzen“ steht, sobald Zeitraum oder eine Spalte gewählt ist', () => {
  const ohne = kostenSpaltenwahl(BEISPIEL_BOARD, FILTER_LEER);
  assert.deepStrictEqual([gewaehlte(ohne.von), gesperrte(ohne.von), gewaehlte(ohne.bis), gesperrte(ohne.bis)], [[], [], [], []]);
  const nurVon = kostenSpaltenwahl(BEISPIEL_BOARD, filter(abschnitt('Abnahme', '')));
  assert.deepStrictEqual([gesperrte(nurVon.von), gesperrte(nurVon.bis)], [[], ['Eingang', 'Entwicklung']]);
  assert.deepStrictEqual([FILTER_LEER, filter(BEISPIEL.ZEITRAUM_12_13), filter(abschnitt('Abnahme', '')), filter(abschnitt('', 'Test'))].map(kostenbereichGewaehlt), [false, true, true, true]);
});

const B0841 = { todo: 'erwartet rot bis B0841' }, B0842 = { todo: 'erwartet rot bis B0842' };

/* ── B0840 fester Vergleich erweitert: Kennzeichen, fremde Spalte, „erledigt ab“ am Beispielboard ── */
const kennzeichen = gruppe => gruppe.aufgaben.map(a => [a.nummer, a.kennzeichen]);
const FALL_1 = abschnitt('Entwicklung', 'Abnahme', BEISPIEL.ZEITRAUM_12_13);

test('R00171 B0840 (AK 3, AK 4): ohne Bereiche bleibt die Summe die von vor der Karte; die Liste nennt #1 „erledigt“, #2 „offen“, #3 „archiviert“ — erledigt heißt: in „Produktiv“, der letzten Spalte', B0841, () => {
  const a = aufstellung({});
  assert.deepStrictEqual(a.gruppen[0].summe, VOR_DER_KARTE.jeWaehrung[0]);
  assert.deepStrictEqual(kennzeichen(a.gruppen[0]), [[1, 'erledigt'], [2, 'offen'], [3, 'archiviert']]);
  assert.deepStrictEqual(a.erledigtAb, { spalte: 'Produktiv', grund: 'letzte' });
});

test('R00171 B0840 (AK 1): Fall 1 nennt #1 „erledigt“ und #2 „offen“ — erledigt heißt: in „Abnahme“, der Bis-Spalte, oder rechts davon', B0841, () => {
  const a = aufstellung(FALL_1);
  assert.deepStrictEqual(kennzeichen(a.gruppen[0]), [[1, 'erledigt'], [2, 'offen']]);
  assert.deepStrictEqual(a.erledigtAb, { spalte: 'Abnahme', grund: 'bis' });
});

test('R00171 B0840 (AK 7, Schaden d): ein Eintrag aus „Review“ zählt ohne Abschnitt mit (Einträge 11,25); in Fall 1 bleibt die Summe 5,00 und er steht mit 0,25 unter „Spalte nicht auf diesem Board“', B0842, () => {
  const zusatz = { 2: [BEISPIEL.FREMDE_SPALTE] };
  const ohne = aufstellung({}, zusatz), mit = aufstellung(FALL_1, zusatz);
  assert.deepStrictEqual([ohne.gruppen[0].summe.eintraege, ohne.gruppen[0].fremdeSpalte], [1125, null]);
  assert.deepStrictEqual([mit.gruppen[0].summe.eintraege, mit.gruppen[0].summe.niedrig, mit.gruppen[0].fremdeSpalte], [500, 500, 25]);
  assert.deepStrictEqual(betraege(mit.gruppen[0]), [[1, 446], [2, 54]], 'in der Liste zählt der fremde Eintrag nicht zu #2');
});

test('R00171 B0840 (AK 8, Schaden d): eine gespeicherte Grenze „Test“, die das Board nicht führt, gilt als nicht gesetzt und wird genannt — die Zahlen sind die ohne Bereiche', B0842, () => {
  const a = aufstellung(abschnitt('', 'Test'));
  assert.deepStrictEqual(a.grenzenWeg, [{ seite: 'bis', name: 'Test' }]);
  assert.strictEqual(a.bereich, false);
  assert.deepStrictEqual(a.gruppen[0].summe, VOR_DER_KARTE.jeWaehrung[0]);
  assert.deepStrictEqual(a.gruppen[0].altePostenAussen, null);
  assert.deepStrictEqual(aufstellung({}).grenzenWeg, []);
});
