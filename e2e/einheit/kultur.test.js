// Unit-Tests des Kulturmoduls (R00109, ADR-0013): deutsche Datumsformen und Feldbeschriftungen (node --test)
process.env.TZ = 'Europe/Berlin'; // Ortszeit der Erwartungen, wie e2e/tests/hilfen.js
const test = require('node:test');
const assert = require('node:assert');
const { datumLang, datumKurz, zeitpunktLang, zeitpunktKurz, datumAusMs, zeitpunktAusMs, datumMitWochentag, achsenMarke, FELDER, OHNE_HERKUNFT } = require('../../web/kultur.js');

test('lang(2026-10-28) ist 28.10.2026', () => {
  assert.strictEqual(datumLang('2026-10-28'), '28.10.2026');
  assert.strictEqual(datumLang('2026-01-05'), '05.01.2026');
});

test('kurz nur im Jahr von heute, sonst lang — auch über den Jahreswechsel', () => {
  assert.strictEqual(datumKurz('2026-10-28', '2026-11-06'), '28.10.');
  assert.strictEqual(datumKurz('2026-12-31', '2026-12-31'), '31.12.');
  assert.strictEqual(datumKurz('2027-01-01', '2026-12-31'), '01.01.2027');
  assert.strictEqual(datumKurz('2026-12-31', '2027-01-01'), '31.12.2026');
  assert.strictEqual(datumKurz('2025-03-15', '2026-11-06'), '15.03.2025');
  assert.strictEqual(datumKurz('2026-01-05', '2026-11-06'), '05.01.');
});

test('Zeitpunkt der Datei lang und kurz, mit Versatz in Ortszeit', () => {
  assert.strictEqual(zeitpunktLang('2026-10-28 14:05'), '28.10.2026 14:05');
  assert.strictEqual(zeitpunktLang('2026-10-28 14:05+01:00'), '28.10.2026 14:05');
  assert.strictEqual(zeitpunktLang('2026-10-17 07:00Z'), '17.10.2026 09:00');
  assert.strictEqual(zeitpunktKurz('2026-10-28 14:05+01:00', '2026-11-06'), '28.10. 14:05');
  assert.strictEqual(zeitpunktKurz('2025-12-30 14:05', '2026-11-06'), '30.12.2025 14:05');
});

test('Zeitstempel in ms: lang, mit Wochentag Mo–So wie deDatum (R00073), Achsenmarke TT.MM. über JJJJ', () => {
  const ms = (j, m, t) => new Date(j, m - 1, t, 12).getTime();
  assert.strictEqual(datumAusMs(ms(2026, 10, 1)), '01.10.2026');
  const woche = [[5, 'Mo'], [6, 'Di'], [7, 'Mi'], [1, 'Do'], [2, 'Fr'], [3, 'Sa'], [4, 'So']];
  for (const [t, wt] of woche) assert.strictEqual(datumMitWochentag(ms(2026, 10, t)), `${wt} 0${t}.10.2026`);
  assert.strictEqual(datumMitWochentag(ms(2026, 10, 28)), 'Mi 28.10.2026');
  assert.deepStrictEqual(achsenMarke(ms(2026, 10, 1)), ['01.10.', '2026']);
  assert.strictEqual(zeitpunktAusMs(new Date(2026, 0, 5, 9, 7).getTime()), '05.01.2026 09:07');
});

test('FELDER: je Schlüssel eine deutsche Beschriftung, keine ist ein Schlüssel', () => {
  assert.deepStrictEqual(FELDER, {
    board: 'Board', column: 'Spalte', class: 'Klasse', origins: 'Herkunft', assignees: 'Zuständig', labels: 'Labels', due: 'Fällig',
    'wbs-effects': 'Wirkungen', phases: 'Phasen', reservation: 'Reservierung', wbs: 'WBS', requirements: 'Anforderungen',
    ich: 'Ich', agents: 'Agenten', spalten: 'Spalten', anforderungen: 'Anforderungen',
  });
  const schluessel = Object.keys(FELDER);
  assert.deepStrictEqual(Object.values(FELDER).filter(b => schluessel.includes(b)), []);
  assert.strictEqual(OHNE_HERKUNFT, 'ohne Herkunft');
});
