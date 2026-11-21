// R00061 Ein Ereignis ohne neuen Stand zeichnet die Seite nicht neu.
// Ursache der unzuverlässigen Specs: das Echo eines eigenen Schreibzugriffs (Phasen-Spalten beim ersten Lesen) lud neu und
// ersetzte die Ansicht, während der Test schon klickte oder maß. Seit R00222 (ADR-0034 Regel 4) ohne die WBS-Sicht: die
// Zusage gilt am Board, dessen erstes Lesen die Phasen-Spalten mit eigenem Commit nachträgt (S3 bleibt bis #227).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'gelb'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'gelb'),
  zeile('B0001', 'Bubble', 'D0001', 'Board lesen', 'rot'),
  zeile('D0002', 'Dialog', 'A0001', 'Berichte', 'rot'),
]);

/** Zählt, wie oft `#main` ersetzt wird, und welche Ereignisse ankommen. */
const sondeEinbauen = page => page.addInitScript(() => {
  window.__neu = 0; window.__ereignisse = 0;
  const Quelle = window.EventSource;
  window.EventSource = function (u) { const q = new Quelle(u); q.addEventListener('message', () => { window.__ereignisse++; }); return q; };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => { window.__neu++; }).observe(document.querySelector('#main'), { childList: true }));
});
const gezaehlt = page => page.evaluate(() => ({ neu: window.__neu, ereignisse: window.__ereignisse }));
/** Wartet, bis `n` Ereignisse angekommen sind, und lässt dem Neuladen danach Zeit. */
async function nachEreignissen(page, n) {
  await expect.poll(async () => (await gezaehlt(page)).ereignisse).toBeGreaterThanOrEqual(n);
  await page.waitForTimeout(400);
}

test.describe('R00061', () => {
  let k, arbeit;
  test.beforeEach(async ({ page }) => {
    arbeit = arbeitsRepository(WBS);
    k = await kanbanStarten(mitRegister(arbeit));
    await alsPerson(page, 'st');
    await sondeEinbauen(page);
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('Erstes Lesen trägt Phasen-Spalten nach — das Echo des Commits zeichnet das Board nicht ein zweites Mal', async ({ page }) => {
    await page.goto(k.adresse + '#/board/entwicklung');
    await expect(page.locator('.bahn[data-col="Entwicklertest"]')).toBeVisible();
    await nachEreignissen(page, 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('kanbanD');
    expect((await gezaehlt(page)).neu).toBe(1);
  });
});
