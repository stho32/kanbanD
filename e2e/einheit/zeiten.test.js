// Unit-Tests der Zeitrechnung (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { anteil, ortszeit, personenZeilen, wochenbeginn, zeitMs } = require('../../web/zeiten.js');

const jetzt = new Date(2026, 9, 21, 12, 0).getTime(); // Mittwoch, 21.10.2026 12:00
const t0 = new Date(2026, 9, 21).getTime(), morgen = t0 + 864e5;
const H = 36e5;

test('Anteile über Mitternacht, laufend, Woche', () => {
  assert.strictEqual(anteil({ beginn: '2026-10-20 23:00', ende: '2026-10-21 01:00' }, t0, morgen, jetzt), 1 * H);
  assert.strictEqual(anteil({ beginn: '2026-10-21 11:30', ende: null }, t0, morgen, jetzt), 0.5 * H);
  assert.strictEqual(wochenbeginn(jetzt), new Date(2026, 9, 19).getTime());
  assert.strictEqual(anteil({ beginn: '2026-10-19 08:00', ende: '2026-10-19 09:00' }, wochenbeginn(jetzt), morgen, jetzt), H);
  assert.strictEqual(anteil({ beginn: '2026-10-18 08:00', ende: '2026-10-18 09:00' }, wochenbeginn(jetzt), morgen, jetzt), 0);
  assert.strictEqual(zeitMs('2026-10-21 12:00'), jetzt);
});

test('Gruppen, Summen, offen und begonnen', () => {
  const personen = [{ kuerzel: 'st' }, { kuerzel: 'cl' }, { kuerzel: 'mi' }];
  const board = { spalten: [{ aufgaben: [3] }, { aufgaben: [1] }, { aufgaben: [2] }] };
  const aufgaben = [
    { nummer: 1, zustaendige: ['st'], zeiten: [{ wer: 'st', beginn: '2026-10-21 11:30', ende: null }] },
    { nummer: 2, zustaendige: ['st', 'cl'], zeiten: [{ wer: 'cl', beginn: '2026-10-21 08:00', ende: '2026-10-21 09:00' }] },
    { nummer: 3, zustaendige: ['mi'], zeiten: [], archiviert: null },
    { nummer: 4, zustaendige: ['mi'], zeiten: [], archiviert: '2026-10-01' },
  ];
  const [st, cl, mi] = personenZeilen(aufgaben, personen, board, jetzt);
  assert.deepStrictEqual([st.gruppe, cl.gruppe, mi.gruppe], [0, 1, 2]);
  assert.strictEqual(st.heute, 0.5 * H);
  assert.strictEqual(cl.woche, H);
  assert.deepStrictEqual([st.offen, st.begonnen], [1, 1], '#2 liegt in der Abschlussspalte');
  assert.deepStrictEqual([mi.offen, mi.begonnen], [1, 0], '#4 ist archiviert');
  assert.strictEqual(cl.abschnitte[0].nummer, 2);
  assert.ok(st.abschnitte[0].laeuft);
});

const { stundenzettel, kreuztabelle } = require('../../web/zeiten.js');

test('Stundenzettel verteilt über Mitternacht und summiert', () => {
  const w0 = wochenbeginn(jetzt);
  const aufgaben = [
    { nummer: 1, zeiten: [{ wer: 'st', beginn: '2026-10-19 23:00', ende: '2026-10-20 01:00' }, { wer: 'cl', beginn: '2026-10-19 08:00', ende: '2026-10-19 09:00' }] },
    { nummer: 2, zeiten: [{ wer: 'cl', beginn: '2026-10-20 08:00', ende: '2026-10-20 09:00' }] },
    { nummer: 3, zeiten: [{ wer: 'st', beginn: '2026-10-12 08:00', ende: '2026-10-12 09:00' }] },
  ];
  const s = stundenzettel(aufgaben, 'st', w0, jetzt);
  assert.strictEqual(s.zeilen.length, 1, 'nur #1 hat Zeit von st in dieser Woche');
  assert.deepStrictEqual(s.zeilen[0].proTag.slice(0, 3), [H, H, 0]);
  assert.strictEqual(s.summe, 2 * H);
  assert.strictEqual(s.jeTag[1], H);
});

test('Kreuztabelle mit Summen in beide Richtungen', () => {
  const aufgaben = [
    { nummer: 1, zeiten: [{ wer: 'st', beginn: '2026-10-20 08:00', ende: '2026-10-20 09:30' }, { wer: 'cl', beginn: '2026-10-20 10:00', ende: '2026-10-20 10:30' }] },
    { nummer: 2, zeiten: [{ wer: 'cl', beginn: '2026-10-01 10:00', ende: '2026-10-01 11:00' }] },
  ];
  const alles = kreuztabelle(aufgaben, 0, jetzt);
  assert.deepStrictEqual(alles.personen, ['st', 'cl']);
  assert.deepStrictEqual(alles.zeilen.map(z => z.aufgabe.nummer), [2, 1]);
  assert.deepStrictEqual(alles.zeilen[1].jePerson, [1.5 * H, 0.5 * H]);
  assert.strictEqual(alles.zeilen[1].summe, 2 * H);
  assert.deepStrictEqual(alles.jeSpalte, [1.5 * H, 1.5 * H]);
  const woche = kreuztabelle(aufgaben, wochenbeginn(jetzt), jetzt);
  assert.deepStrictEqual(woche.zeilen.map(z => z.aufgabe.nummer), [1]);
  assert.strictEqual(woche.summe, 2 * H);
});

// R00084: mit Versatz ein eindeutiger Moment, gleich in welcher Zone der Browser läuft; ohne Versatz Ortszeit wie bisher
test('Zeitpunkte mit Versatz', () => {
  assert.strictEqual(zeitMs('2026-10-25 02:33+02:00'), Date.UTC(2026, 9, 25, 0, 33));
  assert.strictEqual(zeitMs('2026-10-25 02:10+01:00'), Date.UTC(2026, 9, 25, 1, 10));
  assert.strictEqual(zeitMs('2026-10-25 06:41+00:00'), Date.UTC(2026, 9, 25, 6, 41));
  assert.strictEqual(zeitMs('2026-10-25 07:41-03:30'), Date.UTC(2026, 9, 25, 11, 11));
  assert.strictEqual(zeitMs('2026-10-25 02:10+01:00') - zeitMs('2026-10-25 02:33+02:00'), 37 * 6e4, 'über die Umstellung');
  // ein laufender Timer, gestartet 05:57+01:00, um 07:40 Ortszeit: 1:43
  assert.strictEqual(Date.UTC(2026, 9, 25, 6, 40) - zeitMs('2026-10-25 05:57+01:00'), (60 + 43) * 6e4);
});

test('Anzeige in Ortszeit ohne Versatz', () => {
  const ort = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  assert.strictEqual(ortszeit('2026-10-18 09:00'), '2026-10-18 09:00', 'Altbestand bleibt, wie er ist');
  assert.strictEqual(ortszeit('2026-10-25 02:33+02:00'), ort(Date.UTC(2026, 9, 25, 0, 33)));
  if (process.env.TZ === 'Europe/Berlin') assert.strictEqual(ortszeit('2026-10-25 06:41+00:00'), '2026-10-25 07:41');
  if (process.env.TZ === 'UTC') assert.strictEqual(ortszeit('2026-10-25 07:41+01:00'), '2026-10-25 06:41');
});

// R00087: Restzeit einer Reservierung — 24 h ab seit, abgelaufen ist null
test('Restzeit einer Reservierung', () => {
  const { reservierungRest } = require('../../web/zeiten.js');
  const seit = '2026-10-25 08:00+01:00', t = zeitMs(seit);
  assert.strictEqual(reservierungRest({ seit }, t + H), 23 * H);
  assert.strictEqual(reservierungRest({ seit }, t + 24 * H), null);
  assert.strictEqual(reservierungRest(null, t), null);
});

// R00089: Summe aller Einträge, laufende bis jetzt; je Person absteigend
test('Summe der Zeiten gesamt und je Person', () => {
  const { summeMs, summeJePerson } = require('../../web/zeiten.js');
  const zeiten = [
    { wer: 'st', beginn: '2026-10-21 09:00', ende: '2026-10-21 10:00' },
    { wer: 'en', beginn: '2026-10-21 10:00', ende: '2026-10-21 10:42' },
    { wer: 'en', beginn: '2026-10-21 11:55', ende: null },
  ];
  assert.strictEqual(summeMs(zeiten.slice(0, 2), jetzt), 102 * 6e4);
  assert.strictEqual(summeMs(zeiten, jetzt), (102 + 5) * 6e4, 'laufend bis jetzt');
  assert.strictEqual(summeMs(zeiten, jetzt, z => zeitMs(z.beginn) + 60e3), (102 + 4) * 6e4, 'eigener Beginn eines laufenden Timers');
  assert.deepStrictEqual(summeJePerson(zeiten, jetzt), [{ wer: 'en', ms: 47 * 6e4 }, { wer: 'st', ms: 60 * 6e4 }].sort((a, b) => b.ms - a.ms));
  assert.strictEqual(summeMs([], jetzt), 0);
});
