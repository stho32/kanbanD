// Unit-Tests R00199 (Karte #204): Personenseite mit gewähltem Tag — Tagesgrenzen und Kalenderwoche in Ortszeit,
// die Zeilen eines Tages in einem Durchlauf, die Marken der Leiste 0–24 Uhr und das Blättern bis heute.
process.env.TZ = 'Europe/Berlin'; // die Tage der Zeitumstellung 2026: 29.03. (23 Stunden) und 25.10. (25 Stunden)
const test = require('node:test');
const assert = require('node:assert');
const { tagesbeginn, tagesende, wochenbeginn, wochenende } = require('../../web/zeiten.js');

const H = 36e5;
const ms = (j, m, t, h = 0, mi = 0) => new Date(j, m - 1, t, h, mi).getTime();

test('B0976: der Tag reicht von 0 Uhr bis 0 Uhr des Folgetags, auch an den Umstelltagen', () => {
  assert.strictEqual(tagesende(ms(2026, 11, 17, 14)) - tagesbeginn(ms(2026, 11, 17, 14)), 24 * H, 'Di 17.11.');
  assert.strictEqual(tagesende(ms(2026, 11, 17, 14)), ms(2026, 11, 18));
  assert.strictEqual(tagesende(ms(2026, 3, 29, 12)) - tagesbeginn(ms(2026, 3, 29, 12)), 23 * H, '29.03. hat 23 Stunden');
  assert.strictEqual(tagesende(ms(2026, 10, 25, 12)) - tagesbeginn(ms(2026, 10, 25, 12)), 25 * H, '25.10. hat 25 Stunden');
  assert.strictEqual(tagesende(ms(2026, 10, 25, 23, 59)), ms(2026, 10, 26), 'auch kurz vor Mitternacht');
});

test('B0976: die Kalenderwoche reicht von Montag 0 Uhr bis Montag darauf 0 Uhr', () => {
  assert.strictEqual(wochenbeginn(ms(2026, 11, 17, 14)), ms(2026, 11, 16), 'Di 17.11. → Mo 16.11.');
  assert.strictEqual(wochenende(ms(2026, 11, 17, 14)), ms(2026, 11, 23));
  assert.strictEqual(wochenbeginn(ms(2026, 11, 15, 14)), ms(2026, 11, 9), 'So 15.11. gehört zur Woche ab 09.11.');
  assert.strictEqual(wochenende(ms(2026, 11, 15, 14)), ms(2026, 11, 16));
  assert.strictEqual(wochenende(ms(2026, 10, 25, 12)) - wochenbeginn(ms(2026, 10, 25, 12)), (7 * 24 + 1) * H, 'Woche 19.10.–25.10. hat 169 Stunden');
  assert.strictEqual(wochenende(ms(2026, 3, 29, 12)) - wochenbeginn(ms(2026, 3, 29, 12)), (7 * 24 - 1) * H, 'Woche 23.03.–29.03. hat 167 Stunden');
});

/* ── B0977: die Zeilen eines gewählten Tages (Ausgangslage von R00199, Uhr Do 19.11.2026 14:00) ── */
const { hm, personenZeilen, zeitMs } = require('../../web/zeiten.js');

const JETZT = ms(2026, 11, 19, 14);
const PERSONEN = [{ kuerzel: 'st' }, { kuerzel: 'cl' }, { kuerzel: 'mi' }];
const BOARD = { spalten: [{ aufgaben: [2] }, { aufgaben: [1] }, { aufgaben: [] }] };
const AUSGANGSLAGE = [
  { nummer: 1, zustaendige: ['st'], zeiten: [{ wer: 'st', beginn: '2026-11-17 09:00', ende: '2026-11-17 10:30' }, { wer: 'st', beginn: '2026-11-19 13:30+01:00', ende: null }] },
  { nummer: 2, zustaendige: ['mi', 'cl'], zeiten: [{ wer: 'cl', beginn: '2026-11-16 23:00', ende: '2026-11-17 02:00' }, { wer: 'cl', beginn: '2026-11-18 21:00', ende: null }] },
  { nummer: 3, zustaendige: ['mi'], archiviert: '2026-11-18', zeiten: [{ wer: 'mi', beginn: '2026-11-16 08:00', ende: '2026-11-16 08:30' }] },
];
const zeilenAm = tag => personenZeilen(AUSGANGSLAGE, PERSONEN, BOARD, tag, JETZT);
/** Tag / Woche in h:mm je Person in der Reihenfolge Stefan, Claude, Mia — wie die Tabelle der Anforderung. */
const summen = tag => zeilenAm(tag).map(z => `${hm(z.tag)} / ${hm(z.woche)}`);

test('B0977: Tag- und Wochensumme jeder Person folgen dem gewählten Tag (Tabelle R00199)', () => {
  assert.deepStrictEqual(summen(ms(2026, 11, 19)), ['0:30 / 2:00', '14:00 / 20:00', '0:00 / 0:30'], 'Do 19.11. (heute)');
  assert.deepStrictEqual(summen(ms(2026, 11, 18)), ['0:00 / 2:00', '3:00 / 20:00', '0:00 / 0:30'], 'Mi 18.11.: Claudes laufender Eintrag zählt nur bis 24 Uhr');
  assert.deepStrictEqual(summen(ms(2026, 11, 17)), ['1:30 / 2:00', '2:00 / 20:00', '0:00 / 0:30'], 'Di 17.11.');
  assert.deepStrictEqual(summen(ms(2026, 11, 16)), ['0:00 / 2:00', '1:00 / 20:00', '0:30 / 0:30'], 'Mo 16.11.: Mias archivierte #3 zählt');
  assert.deepStrictEqual(summen(ms(2026, 11, 15)), ['0:00 / 0:00', '0:00 / 0:00', '0:00 / 0:00'], 'So 15.11.: Woche 09.11.–15.11.');
});

test('B0977: Gruppen — heute läuft/aktiv/ruhig, an einem vergangenen Tag nur aktiv oder ruhig', () => {
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 19)).map(z => z.gruppe), [0, 0, 2], 'heute');
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 18)).map(z => z.gruppe), [2, 1, 2], 'Mi 18.11.: Claudes damals laufender Eintrag macht ihn aktiv, nicht „läuft“');
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 17)).map(z => z.gruppe), [1, 1, 2], 'Di 17.11.');
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 16)).map(z => z.gruppe), [2, 1, 1], 'Mo 16.11.');
});

test('B0977: „zuletzt“ ist am vergangenen Tag das letzte Ende an diesem Tag, heute wie bisher', () => {
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 17)).map(z => z.zuletzt), [ms(2026, 11, 17, 10, 30), ms(2026, 11, 17, 2), 0]);
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 18)).map(z => z.zuletzt), [0, 0, 0], 'Mi 18.11.: kein Eintrag endet an diesem Tag');
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 16)).map(z => z.zuletzt), [0, 0, ms(2026, 11, 16, 8, 30)], 'Claudes Nachtlauf endet erst am 17.11.');
  assert.strictEqual(zeilenAm(ms(2026, 11, 19))[2].zuletzt, ms(2026, 11, 16, 8, 30), 'heute: Mias letztes Ende über alle Zeit');
});

test('B0977: Abschnitte liegen im gewählten Tag, laufend heißt: läuft jetzt', () => {
  const [st, cl] = zeilenAm(ms(2026, 11, 17));
  assert.deepStrictEqual(st.abschnitte, [{ nummer: 1, von: ms(2026, 11, 17, 9), bis: ms(2026, 11, 17, 10, 30), laeuft: false }]);
  assert.deepStrictEqual(cl.abschnitte, [{ nummer: 2, von: ms(2026, 11, 17), bis: ms(2026, 11, 17, 2), laeuft: false }]);
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 18))[1].abschnitte, [{ nummer: 2, von: ms(2026, 11, 18, 21), bis: ms(2026, 11, 19), laeuft: true }]);
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 16))[1].abschnitte, [{ nummer: 2, von: ms(2026, 11, 16, 23), bis: ms(2026, 11, 17), laeuft: false }], 'beendet, reicht nur über das Tagesende');
  assert.deepStrictEqual(zeilenAm(ms(2026, 11, 19))[1].abschnitte, [{ nummer: 2, von: ms(2026, 11, 19), bis: JETZT, laeuft: true }]);
});

test('B0977: „zugewiesen offen“ und laufende Timer zeigen an jedem Tag den heutigen Stand', () => {
  for (const tag of [ms(2026, 11, 16), ms(2026, 11, 19)]) {
    const [st, cl, mi] = zeilenAm(tag);
    assert.deepStrictEqual([st.offen, st.begonnen, cl.offen, cl.begonnen, mi.offen, mi.begonnen], [1, 1, 1, 0, 1, 0], new Date(tag).toDateString());
    assert.deepStrictEqual([st.laeuft.length, cl.laeuft.length, mi.laeuft.length], [1, 1, 0]);
  }
  assert.strictEqual(zeilenAm(ms(2026, 11, 19))[0].laeuft[0].a.nummer, 1);
});

test('B0977 (AK 11): jeder Zeiteintrag wird höchstens zweimal in einen Zeitpunkt umgewandelt — bei 1, 10 und 30 Personen', () => {
  const alle = [...Array(30)].map((_, i) => ({ kuerzel: 'p' + i }));
  const aufgaben = [...Array(5000)].map((_, i) => ({
    nummer: i + 1, zustaendige: ['p' + (i % 30)],
    zeiten: [{ wer: 'p' + (i % 30), beginn: '2026-11-17 09:00', ende: '2026-11-17 10:00' }, { wer: 'p' + ((i + 7) % 30), beginn: '2026-11-18 21:00', ende: i % 100 ? '2026-11-18 22:00' : null }],
  }));
  const eintraege = aufgaben.reduce((s, a) => s + a.zeiten.length, 0);
  for (const anzahl of [1, 10, 30]) {
    let umwandlungen = 0;
    const zaehlend = z => { umwandlungen++; return zeitMs(z); };
    const zeilen = personenZeilen(aufgaben, alle.slice(0, anzahl), { spalten: [{ aufgaben: [] }] }, ms(2026, 11, 17), JETZT, zaehlend);
    assert.ok(umwandlungen > 0, `${anzahl} Personen: die Zeiten werden über den Zählhaken umgewandelt`);
    assert.ok(umwandlungen <= 2 * eintraege, `${anzahl} Personen: ${umwandlungen} Umwandlungen bei ${eintraege} Einträgen`);
    assert.strictEqual(zeilen[0].tag, 36e5 * aufgaben.filter(a => a.nummer % 30 === 1).length, 'die Rechnung stimmt trotzdem');
  }
});

/* ── B0978: Lage in der Leiste 0–24 Uhr, Marken auf echten Ortszeit-Stunden (AK 1, AK 9) ── */
const { stundenmarken, lageImTag } = require('../../web/zeiten.js');
const lage = (zeitpunkt, tag) => Math.round(lageImTag(zeitpunkt, tagesbeginn(tag), tagesende(tag)) * 100) / 100;
const markenAm = tag => stundenmarken(tag).map(m => [m.stunde, lage(m.zeitpunkt, tag)]);

test('B0978: an einem gewöhnlichen Tag stehen die Marken 0, 3, …, 24 bei 0 %, 12,5 %, …, 100 %', () => {
  assert.deepStrictEqual(markenAm(ms(2026, 11, 19, 14)), [[0, 0], [3, 12.5], [6, 25], [9, 37.5], [12, 50], [15, 62.5], [18, 75], [21, 87.5], [24, 100]]);
  assert.strictEqual(lage(JETZT, JETZT), 58.33, 'Jetzt-Marke 14 / 24');
  assert.strictEqual(lage(ms(2026, 11, 17, 9), ms(2026, 11, 17)), 37.5);
});

test('B0978 (AK 9): am 25.10. (25 Stunden) und am 29.03. (23 Stunden) stehen die Marken auf den echten Ortszeit-Stunden', () => {
  const am25 = markenAm(ms(2026, 10, 25));
  assert.deepStrictEqual(am25[1], [3, 16], '03:00 ist am 25.10. vier Stunden nach 0 Uhr');
  assert.deepStrictEqual(am25.at(-1), [24, 100]);
  assert.strictEqual(lage(zeitMs('2026-10-25 23:15+01:00'), ms(2026, 10, 25)), 97, '24,25 / 25');
  assert.deepStrictEqual(markenAm(ms(2026, 3, 29))[1], [3, 8.7], '03:00 ist am 29.03. zwei Stunden nach 0 Uhr');
  assert.strictEqual(lage(ms(2026, 3, 28, 22), ms(2026, 3, 29)), 0, 'vor dem Tag: am linken Rand');
  assert.strictEqual(lage(ms(2026, 3, 30, 1), ms(2026, 3, 29)), 100, 'nach dem Tag: am rechten Rand');
});

test('B0978 (AK 9): Tag und Woche zählen an den Umstelltagen die echte Zeit', () => {
  const p = [{ kuerzel: 'st' }];
  const am = (zeiten, tag) => personenZeilen([{ nummer: 1, zustaendige: [], zeiten }], p, null, tag, ms(2026, 11, 19, 14))[0];
  const herbst = am([{ wer: 'st', beginn: '2026-10-25 23:15+01:00', ende: '2026-10-25 23:45+01:00' }], ms(2026, 10, 25));
  assert.deepStrictEqual([herbst.tag, herbst.woche], [0.5 * H, 0.5 * H]);
  const fruehling = [{ wer: 'st', beginn: '2026-03-29 22:00+02:00', ende: '2026-03-30 01:00+02:00' }];
  assert.strictEqual(am(fruehling, ms(2026, 3, 29)).tag, 2 * H, '29.03.: 2:00, nicht 3:00');
  assert.strictEqual(am(fruehling, ms(2026, 3, 30)).tag, 1 * H, '30.03.: 1:00');
});
