// Unit-Tests des Kulturmoduls (R00109, ADR-0013): deutsche Datumsformen und Feldbeschriftungen (node --test)
process.env.TZ = 'Europe/Berlin'; // Ortszeit der Erwartungen, wie e2e/tests/hilfen.js
const test = require('node:test');
const assert = require('node:assert');
const { datumLang, datumKurz, zeitpunktLang, zeitpunktKurz, datumAusMs, zeitpunktAusMs, datumMitWochentag, achsenMarke, FELDER, OHNE_HERKUNFT, istOhneHerkunft, herkunftAnzeige, herkunftAusFeld } = require('../../web/kultur.js');

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
    board: 'Board', column: 'Spalte', class: 'Klasse', origins: 'Herkunft', assignees: 'Zuständig', labels: 'Labels', due: 'Fällig', estimate: 'Geschätzt',
    'wbs-effects': 'Wirkungen', phases: 'Phasen', reservation: 'Reservierung', wbs: 'WBS', requirements: 'Anforderungen',
    ich: 'Ich', agents: 'Agenten', spalten: 'Spalten',
  });
  const schluessel = Object.keys(FELDER);
  assert.deepStrictEqual(Object.values(FELDER).filter(b => schluessel.includes(b)), []);
  assert.strictEqual(OHNE_HERKUNFT, 'ohne Herkunft');
});

test('FELDER: „Anforderungen“ steht nur unter requirements — auch der erste Start nennt den Schlüssel der Datei (PO Z. 159)', () => {
  assert.strictEqual(FELDER.requirements, 'Anforderungen');
  assert.strictEqual(Object.hasOwn(FELDER, 'anforderungen'), false);
  assert.deepStrictEqual(Object.keys(FELDER).filter(s => FELDER[s] === 'Anforderungen'), ['requirements']);
});

test('istOhneHerkunft: „ohne Herkunft“ und thin air, getrimmt, Groß-/Kleinschreibung egal (FA 16) — Ähnliches nicht', () => {
  for (const ja of ['ohne Herkunft', '  Ohne Herkunft ', 'OHNE HERKUNFT', 'Thin Air', 'thin air', ' THIN AIR ']) assert.strictEqual(istOhneHerkunft(ja), true, ja);
  for (const nein of ['ohne Herkunftx', 'ohne', 'Herkunft', 'thin', 'ohne  Herkunft', 'I0001', '']) assert.strictEqual(istOhneHerkunft(nein), false, nein);
});

test('herkunftAnzeige: thin air heißt „ohne Herkunft“, jede andere Herkunft bleibt, wie sie ist (FA 15)', () => {
  assert.strictEqual(herkunftAnzeige('thin air'), 'ohne Herkunft');
  for (const wert of ['I0001', 'R00014', 'kd:I0001', 'Thin Air']) assert.strictEqual(herkunftAnzeige(wert), wert);
});

test('herkunftAusFeld: Feld von „Neue Aufgabe“ — „ohne Herkunft“ als ganzer Inhalt wird thin air, eine Herkunft aus dem Titel verdrängt es (FA 20, AK 10)', () => {
  assert.deepStrictEqual(herkunftAusFeld('  Ohne Herkunft ', []), ['thin air']);
  assert.deepStrictEqual(herkunftAusFeld(' THIN AIR ', []), ['thin air']);
  assert.deepStrictEqual(herkunftAusFeld('I0001 R00014', []), ['I0001', 'R00014']);
  assert.deepStrictEqual(herkunftAusFeld('ohne Herkunft', ['I0001']), []);
  assert.deepStrictEqual(herkunftAusFeld('I0001 ohne Herkunft', []), ['I0001', 'ohne', 'Herkunft']);
});

test('kein ISO-Tag: datumLang und datumKurz geben den Wert unverändert zurück, das Escapen bleibt beim Aufrufer', () => {
  for (const wert of ['<b>x', 'morgen', '24.12.', '2026', '']) {
    assert.strictEqual(datumLang(wert), wert, wert);
    assert.strictEqual(datumKurz(wert, '2026-11-07'), wert, wert);
  }
  // Jahr wie heute, aber kein Tag: nur der Guard in datumKurz hält ihn vom Zerschneiden ab
  assert.strictEqual(datumKurz('2026-1x', '2026-11-07'), '2026-1x');
});

// R00114 FA 3 (ADR-0019 Regel 2): die Dauer im Wort, monoton und ohne Sonderfall — Rechenbeispiele der Anforderung
test('seitText: unter 48 Stunden abgerundete Stunden, ab 48 Stunden kaufmännisch gerundete Tage', () => {
  const { seitText } = require('../../web/kultur.js');
  const stunde = 36e5, tag = 864e5;
  assert.strictEqual(seitText(90 * 6e4), 'seit 1 Stunde');
  assert.strictEqual(seitText(10 * stunde), 'seit 10 Stunden');
  assert.strictEqual(seitText(25 * stunde), 'seit 25 Stunden');
  assert.strictEqual(seitText(47 * stunde + 59 * 6e4 + 59e3), 'seit 47 Stunden');
  assert.strictEqual(seitText(48 * stunde), 'seit 2 Tagen');
  assert.strictEqual(seitText(143 * stunde + 10 * 6e4 + 23e3), 'seit 6 Tagen');
  assert.strictEqual(seitText(30 * tag), 'seit 30 Tagen');
});

// R00134: die eine Zählwort-Hilfe zieht nach web/kultur.js (ADR-0013) — 1 → Einzahl, sonst Mehrzahl (PO Z. 117)
test('zaehlwort: nach der Zahl 1 die Einzahl, sonst die Mehrzahl', () => {
  const { zaehlwort } = require('../../web/kultur.js');
  assert.strictEqual(zaehlwort(1, 'Tag', 'Tagen'), 'Tag');
  assert.strictEqual(zaehlwort(0, 'Tag', 'Tagen'), 'Tagen', '0 von 0 Tagen');
  assert.strictEqual(zaehlwort(2, 'Tag', 'Tagen'), 'Tagen');
  assert.strictEqual(zaehlwort(11, 'Tag', 'Tagen'), 'Tagen', 'nur die Zahl 1, nicht die Endziffer');
});

test('seitText: kein Sprung zwischen 35 und 36 Stunden — Tage erscheinen erst ab 48 Stunden (AK 3)', () => {
  const { seitText } = require('../../web/kultur.js');
  const stunde = 36e5;
  assert.strictEqual(seitText(35 * stunde), 'seit 35 Stunden');
  assert.strictEqual(seitText(36 * stunde), 'seit 36 Stunden');
  assert.strictEqual(seitText(24 * stunde), 'seit 24 Stunden', 'auch über einem Tag bleibt die Stunde');
  // monoton: die Stundenzahl wächst bis 47,59 h, danach beginnt der Tag bei 2 und steigt
  const folge = [...Array(48)].map((_, h) => seitText(h * stunde));
  assert.deepStrictEqual(folge.slice(2, 48).filter(t => t.endsWith('Tag') || t.endsWith('Tagen')), []);
});
