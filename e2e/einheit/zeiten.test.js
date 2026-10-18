// Unit-Tests der Zeitrechnung (node --test)
const test = require('node:test');
const assert = require('node:assert');
const { anteil, personenZeilen, wochenbeginn, zeitMs } = require('../../web/zeiten.js');

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
