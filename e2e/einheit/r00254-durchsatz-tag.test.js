// R00254 Durchsatz: drei Ø je Kalendertag, Netto je Periode (Karte #277) — node --test
const test = require('node:test');
const assert = require('node:assert');
const B = require('../../web/berichte.js');

const filter = x => ({ ...B.FILTER_LEER, ...x });
const mitDatei = () => ({ klasse: null, zustaendige: ['st'], labels: [] });
const TAG = 864e5;
const nah = (x, y, text) => assert.ok(Math.abs(x - y) < 1e-9, `${text}: ${x} statt ${y}`);

/** Rechenbeispiel A (= R00167): Backlog · Arbeit · Erledigt, 02.–04.11.2026, Ziel nicht gewählt. */
const beispielA = () => ({
  spalten: ['Backlog', 'Arbeit', 'Erledigt'],
  aufgaben: [
    { nummer: 1, wechsel: [['2026-11-02 09:00', 'Backlog'], ['2026-11-03 09:00', 'Arbeit'], ['2026-11-04 09:00', 'Erledigt']] },
    { nummer: 2, wechsel: [['2026-11-02 09:00', 'Backlog'], ['2026-11-03 09:00', 'Arbeit'], ['2026-11-04 08:00', 'Backlog'], ['2026-11-04 10:00', 'Arbeit']] },
    { nummer: 3, wechsel: [['2026-11-02 09:00', 'Backlog']] },
  ].map(a => ({ ...a, wechsel: a.wechsel.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte })) })),
});
const JETZT_A = new Date(2026, 10, 4, 12, 0).getTime();
const A_FILTER = filter({ zeitraum: 'eigen', von: '2026-11-02', bis: '2026-11-04' });
const beispielA_Lauf = (von, einheit = 'tag') => B.durchsatz(beispielA(), A_FILTER, mitDatei, JETZT_A, null, einheit, null, von);

/** Rechenbeispiel B (= Grundbestand von R00122): Eingang · In Arbeit · Fertig, 02.–11.11.2026. */
const beispielB = () => ({
  spalten: ['Eingang', 'In Arbeit', 'Fertig'],
  aufgaben: [
    { nummer: 1, wechsel: [['2026-11-02 09:00', 'Eingang'], ['2026-11-03 09:00', 'In Arbeit'], ['2026-11-04 09:00', 'Fertig']] },
    { nummer: 2, wechsel: [['2026-11-03 09:00', 'Eingang'], ['2026-11-05 09:00', 'Fertig'], ['2026-11-10 09:00', null]] },
    { nummer: 3, wechsel: [['2026-11-04 09:00', 'Eingang'], ['2026-11-06 09:00', 'In Arbeit'], ['2026-11-09 09:00', 'Fertig']] },
    { nummer: 4, wechsel: [['2026-11-09 09:00', 'Eingang'], ['2026-11-11 09:00', 'Fertig']] },
  ].map(a => ({ ...a, wechsel: a.wechsel.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte })) })),
});
const JETZT_B = new Date(2026, 10, 11, 20, 0).getTime();
const B_Lauf = (von, bis) => B.durchsatz(beispielB(), filter({ zeitraum: 'eigen', von, bis }), mitDatei, JETZT_B, null, 'tag', null, null);

const summen = d => [d.zugangGesamt, d.gesamt, d.nettoGesamt];

test('R00254 B1350 (AK 1): Beispiel A, Von = Backlog — Netto je Tag −3·0·+1, Summe −2, Ø je Kalendertag 1,0 / 0,3 / −0,7', () => {
  const d = beispielA_Lauf(null);
  assert.strictEqual(d.tage, 3, 'drei Kalendertage 02.–04.11.');
  assert.deepStrictEqual(d.perioden.map(p => p.netto), [-3, 0, 1], 'Netto je Periode = Abgang − Zugang');
  assert.deepStrictEqual(summen(d), [3, 1, -2], 'Zugang 3 · Abgang 1 · Netto −2');
  nah(d.zugangJeTag, 1, 'Zugang-Ø je Tag');
  nah(d.abgangJeTag, 1 / 3, 'Abgang-Ø je Tag');
  nah(d.nettoJeTag, -2 / 3, 'Netto-Ø je Tag');
  assert.deepStrictEqual([d.zugangDurchschnitt, d.durchschnitt], [1, 1 / 3], 'die Ø je Periode für die Linien bleiben');
});

test('R00254 B1350 (AK 1): Beispiel A, Von = Arbeit — Netto 0·−2·+1, Summe −1, Ø je Kalendertag 0,7 / 0,3 / −0,3', () => {
  const d = beispielA_Lauf('Arbeit');
  assert.deepStrictEqual(d.perioden.map(p => p.netto), [0, -2, 1], 'Netto je Periode = Abgang − Zugang');
  assert.deepStrictEqual(summen(d), [2, 1, -1], 'Zugang 2 · Abgang 1 · Netto −1');
  nah(d.zugangJeTag, 2 / 3, 'Zugang-Ø je Tag');
  nah(d.abgangJeTag, 1 / 3, 'Abgang-Ø je Tag');
  nah(d.nettoJeTag, -1 / 3, 'Netto-Ø je Tag');
});

test('R00254 B1350 (AK 3): Beispiel B 05.–11.11. (7 Tage) — Zugang 1 · Abgang 3 · Netto +2, Ø 0,1 / 0,4 / +0,3', () => {
  const d = B_Lauf('2026-11-05', '2026-11-11');
  assert.strictEqual(d.tage, 7, 'sieben Kalendertage');
  assert.deepStrictEqual(d.perioden.map(p => p.netto), [1, 0, 0, 0, 0, 0, 1], 'Netto je Tag 05.–11.11.');
  assert.deepStrictEqual(summen(d), [1, 3, 2], 'Zugang 1 · Abgang 3 · Netto +2');
  nah(d.zugangJeTag, 1 / 7, 'Zugang-Ø je Tag');
  nah(d.abgangJeTag, 3 / 7, 'Abgang-Ø je Tag');
  nah(d.nettoJeTag, 2 / 7, 'Netto-Ø je Tag');
});

test('R00254 B1350 (AK 3): Beispiel B 02.–11.11. (10 Tage) — Netto 0, Ø 0,4 / 0,4 / 0,0', () => {
  const d = B_Lauf('2026-11-02', '2026-11-11');
  assert.strictEqual(d.tage, 10, 'zehn Kalendertage');
  assert.deepStrictEqual(d.perioden.map(p => p.netto), [-1, -1, 0, 1, 0, 0, 0, 0, 0, 1], 'Netto je Tag 02.–11.11.');
  assert.deepStrictEqual(summen(d), [4, 4, 0], 'Zugang 4 · Abgang 4 · Netto 0');
  nah(d.abgangJeTag, 4 / 10, 'Abgang-Ø je Tag');
  nah(d.nettoJeTag, 0, 'Netto-Ø je Tag');
});

test('R00254 B1350 (AK 3): Netto-Ø aus den Summen, nicht aus gerundeten Ø — Zugang 1, Abgang 2 über 7 Tage ergibt 1/7, nicht 0,2', () => {
  const bew = { spalten: ['Backlog', 'Arbeit', 'Erledigt'], aufgaben: [
    { nummer: 1, wechsel: [['2026-11-05 09:00', 'Backlog'], ['2026-11-06 09:00', 'Erledigt']] },
    { nummer: 2, wechsel: [['2026-11-04 09:00', 'Backlog'], ['2026-11-07 09:00', 'Erledigt']] },
  ].map(a => ({ ...a, wechsel: a.wechsel.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte })) })) };
  const d = B.durchsatz(bew, filter({ zeitraum: 'eigen', von: '2026-11-05', bis: '2026-11-11' }), mitDatei, JETZT_B, null, 'tag', null, null);
  assert.deepStrictEqual(summen(d), [1, 2, 1], 'Zugang 1 · Abgang 2 · Netto +1');
  assert.strictEqual(d.tage, 7);
  nah(d.nettoJeTag, 1 / 7, 'Netto-Ø 1/7, nicht 0,2');
  assert.ok(Math.abs(d.nettoJeTag - 0.2) > 1e-9, 'die Differenz gerundeter Ø (0,3 − 0,1 = 0,2) wäre falsch');
});

test('R00254 B1350 (AK 3): Grenzfall 30 Tage — Summe +1 ergibt Netto-Ø 1/30, auf 0,0 zu runden', () => {
  const bew = { spalten: ['Backlog', 'Erledigt'], aufgaben: [
    { nummer: 1, wechsel: [['2026-10-01 09:00', 'Backlog'], ['2026-10-02 09:00', 'Erledigt']] },
  ].map(a => ({ ...a, wechsel: a.wechsel.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte })) })) };
  const d = B.durchsatz(bew, filter({ zeitraum: 'eigen', von: '2026-10-02', bis: '2026-10-31' }), mitDatei, JETZT_B, null, 'tag', null, null);
  assert.strictEqual(d.tage, 30, '30 Kalendertage 02.–31.10.');
  assert.deepStrictEqual(summen(d), [0, 1, 1], 'Zugang 0 · Abgang 1 · Netto +1');
  nah(d.nettoJeTag, 1 / 30, 'Netto-Ø 1/30');
});

test('R00254 B1350 (AK 2): die Kalendertage zählen Tage, nicht 24-Stunden-Blöcke — Zeitumstellung 25.–27.10.2026 ergibt 3', () => {
  const bew = { spalten: ['Backlog', 'Erledigt'], aufgaben: [
    { nummer: 1, wechsel: [['2026-10-25 09:00', 'Backlog'], ['2026-10-26 09:00', 'Erledigt']] },
  ].map(a => ({ ...a, wechsel: a.wechsel.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte })) })) };
  const d = B.durchsatz(bew, filter({ zeitraum: 'eigen', von: '2026-10-25', bis: '2026-10-27' }), mitDatei, new Date(2026, 9, 27, 20).getTime(), null, 'tag', null, null);
  assert.strictEqual(d.tage, 3, '25., 26. und 27.10. sind drei Kalendertage, nicht 72 Stunden');
  assert.strictEqual(d.perioden.length, 3);
  const eins = B.durchsatz(bew, filter({ zeitraum: 'eigen', von: '2026-10-25', bis: '2026-10-25' }), mitDatei, new Date(2026, 9, 27, 20).getTime(), null, 'tag', null, null);
  assert.strictEqual(eins.tage, 1, 'ein Tag ist ein Tag');
});

test('R00254 B1350 (AK 2): die Auflösung ändert die Kalendertage und die Ø je Tag nicht — Beispiel A als Woche und Monat', () => {
  const tag = beispielA_Lauf(null), woche = beispielA_Lauf(null, 'woche'), monat = beispielA_Lauf(null, 'monat');
  assert.strictEqual(tag.tage, 3);
  assert.strictEqual(woche.tage, 3, 'Wochen-Auflösung: derselbe Nenner 3');
  assert.strictEqual(monat.tage, 3, 'Monats-Auflösung: derselbe Nenner 3');
  for (const d of [tag, woche, monat]) {
    nah(d.zugangJeTag, 1, 'Zugang-Ø je Tag');
    nah(d.abgangJeTag, 1 / 3, 'Abgang-Ø je Tag');
    nah(d.nettoJeTag, -2 / 3, 'Netto-Ø je Tag');
  }
  assert.deepStrictEqual(woche.perioden.map(p => p.netto), [-2], 'eine Woche, Netto −2');
  assert.deepStrictEqual(monat.perioden.map(p => p.netto), [-2], 'ein Monat, Netto −2');
  assert.deepStrictEqual([woche.zugangDurchschnitt, woche.durchschnitt], [3, 1], 'die Ø je Periode folgen der Auflösung');
  assert.deepStrictEqual([monat.zugangDurchschnitt, monat.durchschnitt], [3, 1]);
});

test('R00254 B1350: leerer Zeitraum und Board ohne Bewegung liefern keine Kalendertage und keinen Ø', () => {
  const leer = B.durchsatz({ spalten: ['Backlog', 'Erledigt'], aufgaben: [] }, A_FILTER, mitDatei, JETZT_A, null, 'tag', null, null);
  assert.deepStrictEqual([leer.tage, leer.nettoGesamt, leer.zugangJeTag, leer.abgangJeTag, leer.nettoJeTag], [0, 0, null, null, null]);
  const vorher = B.durchsatz(beispielA(), filter({ zeitraum: 'eigen', von: '2026-01-01', bis: '2026-01-31' }), mitDatei, JETZT_A, null, 'tag', null, null);
  assert.deepStrictEqual([vorher.tage, vorher.nettoGesamt, vorher.nettoJeTag], [0, 0, null], 'Zeitraum vor der ersten Bewegung');
});

/* ── B1353: alles oder nichts — tragen die Zahlen an den Balken? ──────────────────────────────────────────────────────── */
const DUS_BREITE = 636; // Zeichenfläche des Durchsatzes (DUS_B − DUS_L − DUS_R = 900 − 44 − 220)

test('R00254 B1353 (AK 4): Beispiel A trägt die Zahlen — 3 Perioden, zwei Balken je Periode, Fläche 636, einstellig', () => {
  assert.strictEqual(B.zahlenPassen(3, 2, DUS_BREITE, 1), true, 'Beispiel A: sechs Balken, je eine Ziffer');
  assert.strictEqual(B.zahlenPassen(3, 2, DUS_BREITE, 2), true, 'auch zweistellig trägt Beispiel A');
});

test('R00254 B1353 (AK 5): 90 Perioden je Tag entfallen — keine Zahl, auch nicht einstellig', () => {
  assert.strictEqual(B.zahlenPassen(90, 2, DUS_BREITE, 1), false, '90 Perioden je Tag: alle Zahlen entfallen');
});

test('R00254 B1353 (AK 5): einstellig und zweistellig an derselben Grenze — 25 Perioden tragen „3“, nicht „12“', () => {
  assert.strictEqual(B.zahlenPassen(25, 2, DUS_BREITE, 1), true, 'einstellig passt');
  assert.strictEqual(B.zahlenPassen(25, 2, DUS_BREITE, 2), false, 'zweistellig berührt die Nachbarzahl');
});

test('R00254 B1353 (AK 5): ohne gezeigten Zugang ein Balken je Periode — mehr Platz, dieselbe Zahl trägt', () => {
  assert.strictEqual(B.zahlenPassen(40, 2, DUS_BREITE, 1), false, 'zwei Balken je Periode: zu eng');
  assert.strictEqual(B.zahlenPassen(40, 1, DUS_BREITE, 1), true, 'ein Balken je Periode: die Zahl passt');
});

test('R00254 B1353 (AK 5): größere Schrift braucht mehr Platz — dieselbe Lage trägt bei 11, nicht bei 22', () => {
  assert.strictEqual(B.zahlenPassen(25, 2, DUS_BREITE, 1, 11), true, 'Schriftgröße 11 wie .achse');
  assert.strictEqual(B.zahlenPassen(25, 2, DUS_BREITE, 1, 22), false, 'doppelte Schriftgröße: entfällt');
});

test('R00254 B1353 (AK 5): die Antwort ist eine Entscheidung für die ganze Fläche — keine Liste, keine einzelne Zahl', () => {
  for (const [perioden, balken, ziffern] of [[3, 2, 1], [90, 2, 1], [25, 2, 2], [40, 1, 1]]) {
    assert.strictEqual(typeof B.zahlenPassen(perioden, balken, DUS_BREITE, ziffern), 'boolean', 'ein Wahrheitswert für alle');
  }
  assert.strictEqual(B.zahlenPassen(0, 2, DUS_BREITE, 1), false, 'ohne Periode keine Zahl');
  assert.strictEqual(B.zahlenPassen(3, 2, 0, 1), false, 'ohne Fläche keine Zahl');
});
