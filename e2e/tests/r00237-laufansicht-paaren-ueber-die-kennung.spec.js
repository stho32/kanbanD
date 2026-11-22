// R00237 Laufansicht — Aufruf und Ergebnis über die Kennung gepaart (Karte #262, I0227) — AK 9 und US-1..US-3 im echten Programm.
// Ausgangslage wie R00234: Board `fabrik` aus laufansicht-hilfen.js, T6 (vertauschte Ergebnisse, mit `id` und `zu`), T6o (dieselben
// Zeilen ohne Felder), T7 (ein `zu` ohne Aufruf) und T8 (Kennung `<b>x</b>`) an #1 über die API abgelegt.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen } = require('./hilfen');
const lv = require('./laufansicht-hilfen');

const T = {
  T6: 'entwickler@2026-11-22T11:00+01:00',
  T6o: 'planer@2026-11-22T11:00+01:00',
  T7: 'architekt@2026-11-22T11:00+01:00',
  T8: 'code-reviewer@2026-11-22T11:00+01:00',
};
const INSEL = '#lv-insel';
const TOP = '#lauf .lv-top li > :first-child';
const KENNZAHLEN = '#lauf .lv-kz';

const um = s => `2026-11-22T10:00:${String(s).padStart(2, '0')}+00:00`;
const aufruf = (s, befehl, id) => ({ zeit: um(s), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: befehl }), ...(id === undefined ? {} : { id }) });
const ergebnis = (s, text, zu) => ({ zeit: um(s), art: 'werkzeugergebnis', wer: 'werkzeug', text, ...(zu === undefined ? {} : { zu }) });
const text = zeilen => zeilen.map(lv.zeile).join('');
const t6 = (idA = 'toolu_A') => [aufruf(0, 'cat regeln', idA), aufruf(1, 'cat entwickler', 'toolu_B'), ergebnis(3, 'entwickler', 'toolu_B'), ergebnis(10, 'Exit code 1\nregeln', idA)];
const ohneFelder = zeilen => zeilen.map(({ id, zu, ...rest }) => rest);
const T7_ZEILEN = [aufruf(0, 'cat regeln', 'toolu_A'), ergebnis(2, 'Exit code 1\nregeln', 'toolu_X')];

const kennzahlen = page => page.locator(`${KENNZAHLEN} > div`).evaluateAll(ds => ds.map(d => {
  const wert = d.querySelector('dd').cloneNode(true);
  wert.querySelectorAll('.vh').forEach(v => v.remove());
  return [d.querySelector('dt').textContent, wert.textContent.replace(/\s+/g, ' ').trim()];
}));

test.describe('R00237 Laufansicht: Paaren über die Kennung', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  async function ablegen(kennung, zeilen) {
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(text(zeilen)));
  }
  async function laufOeffnen(page, kennung) {
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(kennung)}`);
    await expect(page.locator('#lv-h1')).toBeVisible();
    await expect(page.locator('#lv-status')).toHaveText(/^Ende des Transkripts$/);
  }
  const dauerVon = (page, nr) => page.locator(`#lv-s${nr} .du > span`).first();

  test('AK 9 · US-1: T6 — cat regeln 10 s rot mit Warnzeichen und „Exit code 1“, cat entwickler 2 s; „Längste Schritte“ 10 s vor 2 s; Fehler erkannt 1', async ({ page }) => {
    await ablegen(T.T6, t6());
    await laufOeffnen(page, T.T6);
    const regeln = page.locator('#lv-s1 > details');
    await expect(regeln).toContainText('cat regeln');
    await expect(dauerVon(page, 1)).toHaveText('10 s');
    await expect(regeln).toHaveClass(/\bfehl\b/);
    await expect(regeln.locator('summary svg.i')).toHaveCount(2); // Pfeil und Warnzeichen
    await expect(regeln.locator('summary .eg')).toContainText('Exit code 1');
    const entwickler = page.locator('#lv-s2 > details');
    await expect(entwickler).toContainText('cat entwickler');
    await expect(dauerVon(page, 2)).toHaveText('2 s');
    await expect(entwickler).not.toHaveClass(/\bfehl\b/);
    await expect(entwickler.locator('summary .eg')).toContainText('entwickler');
    await expect(page.locator(TOP)).toHaveText([/10 s$/, /2 s$/]);
    expect((await kennzahlen(page)).find(([name]) => name === 'Fehler erkannt')[1]).toBe('1');
    await expect(page.locator('#lauf')).not.toContainText('toolu_');
  });

  test('AK 2, AK 9 · US-2: T6o ohne Felder — wie vor der Karte: cat regeln 3 s, cat entwickler 9 s mit Fehler', async ({ page }) => {
    await ablegen(T.T6o, ohneFelder(t6()));
    await laufOeffnen(page, T.T6o);
    await expect(dauerVon(page, 1)).toHaveText('3 s');
    await expect(dauerVon(page, 2)).toHaveText('9 s');
    await expect(page.locator('#lv-s1 > details')).not.toHaveClass(/\bfehl\b/);
    await expect(page.locator('#lv-s2 > details')).toHaveClass(/\bfehl\b/);
    await expect(page.locator('#lauf')).not.toContainText(/Kennung|toolu_/);
  });

  test('AK 4 · US-3: ein zu ohne Aufruf steht als eigene Zeile „kein Aufruf“, der Aufruf steht ohne Ergebnis', async ({ page }) => {
    await ablegen(T.T7, T7_ZEILEN);
    await laufOeffnen(page, T.T7);
    await expect(page.locator('#lv-s1 .du')).toContainText('kein Ergebnis');
    await expect(page.locator('#lv-s2 .du')).toContainText('kein Aufruf');
    await expect(page.locator('#lv-s2 > details')).toHaveClass(/\bfehl\b/);
  });

  test('AK 9, m8 · US-2: eine Kennung wie <b>x</b> erscheint weder im Text der Seite noch im HTML der Insel, auch nicht maskiert', async ({ page }) => {
    await ablegen(T.T8, t6('<b>x</b>'));
    await laufOeffnen(page, T.T8);
    await expect(dauerVon(page, 1)).toHaveText('10 s');
    expect(await page.locator('body').innerText()).not.toContain('<b>x</b>');
    const html = await page.locator(INSEL).evaluate(e => e.innerHTML);
    expect(html).not.toContain('b&gt;x');
    expect(html).not.toContain('<b>x');
    expect(html).not.toContain('toolu_');
    expect(await page.locator(INSEL).evaluate(e => e.querySelectorAll('b').length)).toBe(0);
  });
});
