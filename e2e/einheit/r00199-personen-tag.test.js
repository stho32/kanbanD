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
