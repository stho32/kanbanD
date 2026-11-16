// Unit-Tests R00173 F0142 (Karte #181): der Bis-Tag eines eigenen Berichtszeitraums endet am Beginn des Folgetags —
// in Kalenderrechnung, nicht nach 24 Stunden. An einem Tag der Zeitumstellung liegen dazwischen 25 oder 23 Stunden.
process.env.TZ = 'Europe/Berlin'; // die Tage der Zeitumstellung 2026: 29.03. (23 Stunden) und 25.10. (25 Stunden)
const test = require('node:test');
const assert = require('node:assert');
const { FILTER_LEER, zeitraumGrenzen, durchsatz } = require('../../web/berichte.js');

const JETZT = new Date(2026, 10, 16, 12, 0).getTime();
const ms = zeitpunkt => new Date(zeitpunkt.replace(' ', 'T')).getTime();
const eigen = (von, bis) => ({ ...FILTER_LEER, zeitraum: 'eigen', von, bis });
/** Die Zeitpunkte, die in den Grenzen [von, bis) des eigenen Zeitraums liegen. */
function imZeitraum(zeitpunkte, von, bis) {
  const g = zeitraumGrenzen(eigen(von, bis), JETZT);
  return zeitpunkte.filter(z => ms(z) >= g.von && ms(z) < g.bis);
}

const HERBST = ['2026-10-25 22:59+01:00', '2026-10-25 23:00+01:00', '2026-10-25 23:30+01:00', '2026-10-25 23:59+01:00', '2026-10-26 00:00+01:00', '2026-10-26 00:30+01:00'];
const FRUEHJAHR = ['2026-03-29 23:30+02:00', '2026-03-29 23:59+02:00', '2026-03-30 00:00+02:00', '2026-03-30 00:30+02:00', '2026-03-30 00:59+02:00', '2026-03-30 01:00+02:00'];

test('R00173 AK 6 (Abnahme-Probe #181): eigener Zeitraum bis 25.10.2026 — die Bewegung um 23:30+01:00 zählt, die vom 26.10. nicht', () => {
  assert.deepStrictEqual(imZeitraum(HERBST, '2026-10-19', '2026-10-25'), HERBST.slice(0, 4));
});

test('R00173 AK 6 (Abnahme-Probe #181): eigener Zeitraum bis 29.03.2026 — die Bewegung vom 30.03. um 00:30+02:00 zählt nicht', () => {
  assert.deepStrictEqual(imZeitraum(FRUEHJAHR, '2026-03-23', '2026-03-29'), FRUEHJAHR.slice(0, 2));
});

test('R00173 AK 6 (Schaden e): „bis Tag X“ und „ab Tag X+1“ ergeben zusammen jede Bewegung genau einmal — an beiden Umstellungen', () => {
  for (const [zeitpunkte, x, folgetag] of [[HERBST, '2026-10-25', '2026-10-26'], [FRUEHJAHR, '2026-03-29', '2026-03-30']]) {
    const bisX = imZeitraum(zeitpunkte, '', x), abFolgetag = imZeitraum(zeitpunkte, folgetag, '');
    assert.deepStrictEqual([...bisX, ...abFolgetag], zeitpunkte, `bis ${x} + ab ${folgetag}`);
  }
});

test('R00173 US-3: Durchsatz 19.10.–25.10.2026 zählt die um 23:30 erledigte Aufgabe #1, ab 26.10. die um 00:30 erledigte #2 — zusammen beide', () => {
  // Bewegungen tragen die Ortszeit des Betrachters ohne Versatz: 23:30 am 25.10. ist 23:30+01:00
  const wechsel = (...paare) => paare.map(([zeitpunkt, spalte]) => ({ zeitpunkt, spalte }));
  const bewegungen = { spalten: ['Backlog', 'Arbeit', 'Erledigt'], aufgaben: [
    { nummer: 1, wechsel: wechsel(['2026-10-20 09:00', 'Backlog'], ['2026-10-25 23:30', 'Erledigt']) },
    { nummer: 2, wechsel: wechsel(['2026-10-20 09:00', 'Backlog'], ['2026-10-26 00:30', 'Erledigt']) },
  ] };
  const ohneMerkmale = () => ({ klasse: '', zustaendige: [], labels: [] });
  const erledigt = (von, bis) => durchsatz(bewegungen, eigen(von, bis), ohneMerkmale, JETZT, null, 'tag').gesamt;
  assert.deepStrictEqual([erledigt('2026-10-19', '2026-10-25'), erledigt('2026-10-26', '')], [1, 1]);
});

test('R00173 AK 8 (Schaden d): an jedem Tag 2025–2027, der kein Tag der Zeitumstellung ist, liegt die Obergrenze wie vor der Karte 24 Stunden nach dem Tagesanfang', () => {
  const UMSTELLUNG = { '2025-03-30': 23, '2025-10-26': 25, '2026-03-29': 23, '2026-10-25': 25, '2027-03-28': 23, '2027-10-31': 25 };
  const zwei = n => String(n).padStart(2, '0');
  const abweichend = {};
  for (let d = new Date(2025, 0, 1); d.getFullYear() < 2028; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${zwei(d.getMonth() + 1)}-${zwei(d.getDate())}`;
    const g = zeitraumGrenzen(eigen(iso, iso), JETZT);
    assert.strictEqual(g.von, d.getTime(), iso);
    const stunden = (g.bis - g.von) / 36e5;
    if (stunden !== 24) abweichend[iso] = stunden;
  }
  assert.deepStrictEqual(abweichend, UMSTELLUNG);
});

test('R00173 AK 8: ohne Bis-Tag bleibt der eigene Zeitraum nach oben offen, ohne Von-Tag nach unten', () => {
  assert.deepStrictEqual(zeitraumGrenzen(eigen('2026-10-25', ''), JETZT), { von: new Date(2026, 9, 25).getTime(), bis: Infinity });
  assert.deepStrictEqual(zeitraumGrenzen(eigen('', '2026-10-24'), JETZT), { von: 0, bis: new Date(2026, 9, 25).getTime() });
});
