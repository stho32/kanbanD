// Unit-Tests der Datums-Trenner (R00124 B0578, node --test)
process.env.TZ = 'Europe/Berlin'; // „Gestern“ rechnet in Ortszeit; die Umstellungstage unten sind nur in einer Sommerzeit-Zone eindeutig
const test = require('node:test');
const assert = require('node:assert');
const { datumsTrenner, trennerText, ankunftsTag } = require('../../web/berichte.js');

/** Bewegungen in der Form von GET /api/berichte/bewegungen. */
const bew = paare => ({ aufgaben: paare.map(([nummer, wechsel]) => ({ nummer, wechsel })) });
const texte = (spalte, reihe, bewegungen, heute, archiv = false) => [...datumsTrenner(spalte, reihe, bewegungen, heute, archiv).values()];

test('Grundbestand am 06.11.: Heute, Gestern, Datum — in der gezeichneten Reihenfolge', () => {
  const bewegungen = bew([
    [1, [{ zeitpunkt: '2026-11-04 09:00', spalte: 'Fertig' }]],
    [2, [{ zeitpunkt: '2026-11-05 09:00', spalte: 'Fertig' }]],
    [3, [{ zeitpunkt: '2026-11-05 09:00', spalte: 'Fertig' }]],
    [4, [{ zeitpunkt: '2026-11-06 09:00', spalte: 'Fertig' }]],
  ]);
  assert.deepStrictEqual(texte('Fertig', [4, 3, 2, 1], bewegungen, '2026-11-06'), ['Heute', 'Gestern', null, '04.11.2026']);
});

test('Grenzfall am 07.11.: kein „Heute“, #4 ist gestern', () => {
  const bewegungen = bew([
    [1, [{ zeitpunkt: '2026-11-04 09:00', spalte: 'Fertig' }]],
    [2, [{ zeitpunkt: '2026-11-05 09:00', spalte: 'Fertig' }]],
    [3, [{ zeitpunkt: '2026-11-05 09:00', spalte: 'Fertig' }]],
    [4, [{ zeitpunkt: '2026-11-06 09:00', spalte: 'Fertig' }]],
  ]);
  assert.deepStrictEqual(texte('Fertig', [4, 3, 2, 1], bewegungen, '2026-11-07'), ['Gestern', '05.11.2026', null, '04.11.2026']);
});

test('der Trenner folgt der gegebenen (gezeichneten) Reihe, nicht sp.aufgaben', () => {
  const bewegungen = bew([
    [1, [{ zeitpunkt: '2026-11-04 09:00', spalte: 'Fertig' }]],
    [3, [{ zeitpunkt: '2026-11-05 09:00', spalte: 'Fertig' }]],
    [4, [{ zeitpunkt: '2026-11-06 09:00', spalte: 'Fertig' }]],
  ]);
  // gefiltert/„Signale oben“: nur #4 und #1 sichtbar, in dieser Zeichnung
  assert.deepStrictEqual(texte('Fertig', [4, 1], bewegungen, '2026-11-06'), ['Heute', '04.11.2026']);
});

test('Ankunftstag: der letzte Wechsel in die Spalte, sonst das erste Erscheinen', () => {
  assert.strictEqual(ankunftsTag([{ zeitpunkt: '2026-11-01 08:00', spalte: 'Eingang' }, { zeitpunkt: '2026-11-03 08:00', spalte: 'Fertig' }, { zeitpunkt: '2026-11-05 08:00', spalte: 'Eingang' }], 'Fertig'), '2026-11-03');
  assert.strictEqual(ankunftsTag([{ zeitpunkt: '2026-11-01 08:00', spalte: 'Eingang' }], 'Fertig'), '2026-11-01', 'ohne Wechsel in die Spalte das erste Erscheinen');
  assert.strictEqual(ankunftsTag([], 'Fertig'), null);
});

test('im Archiv keine Trenner', () => {
  const bewegungen = bew([[4, [{ zeitpunkt: '2026-11-06 09:00', spalte: 'Fertig' }]]]);
  assert.deepStrictEqual(texte('Fertig', [4], bewegungen, '2026-11-06', true), []);
});

test('trennerText: Heute, Gestern (auch über den Jahreswechsel), sonst das Datum', () => {
  assert.strictEqual(trennerText('2026-11-06', '2026-11-06'), 'Heute');
  assert.strictEqual(trennerText('2026-11-05', '2026-11-06'), 'Gestern');
  assert.strictEqual(trennerText('2025-12-31', '2026-01-01'), 'Gestern');
  assert.strictEqual(trennerText('2026-11-04', '2026-11-06'), '04.11.2026');
  assert.strictEqual(trennerText('2025-11-04', '2026-11-06'), '04.11.2025');
});

test('trennerText rechnet „Gestern“ als Kalendertag, nicht als feste 24 Stunden (Zeitumstellung)', () => {
  // Frühjahrsumstellung 2026 (29.03., 02:00 → 03:00): der 29.03. ist der 30.03. minus ein Kalendertag, auch wenn der
  // Kalendertag nur 23 Stunden hat — feste 864e5 landeten auf dem 28.03.
  assert.strictEqual(trennerText('2026-03-29', '2026-03-30'), 'Gestern');
  assert.strictEqual(trennerText('2026-03-28', '2026-03-30'), '28.03.2026', 'zwei Kalendertage davor ist nicht „Gestern“');
  // Herbstumstellung 2026 (25.10., 03:00 → 02:00): der Kalendertag hat 25 Stunden, der 25.10. bleibt „Gestern“ des 26.10.
  assert.strictEqual(trennerText('2026-10-25', '2026-10-26'), 'Gestern');
  assert.strictEqual(trennerText('2026-10-24', '2026-10-26'), '24.10.2026');
});

test('ohne eine einzige Karte keine Trenner', () => {
  assert.deepStrictEqual(texte('Fertig', [], bew([]), '2026-11-06'), []);
});
