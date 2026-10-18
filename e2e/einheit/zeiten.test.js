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
