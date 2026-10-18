// R00061 Ein Ereignis ohne neuen Stand zeichnet die Seite nicht neu.
// Ursache der unzuverlässigen WBS-Specs: das Echo eines eigenen Schreibzugriffs (Phasen-Spalten beim ersten Lesen,
// Status gesetzt) lud neu und ersetzte die Tabelle, während der Test schon klickte oder maß.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit } = require('./hilfen');
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

  test('Erstes Lesen trägt Phasen-Spalten nach — das Echo des Commits zeichnet die WBS-Sicht nicht ein zweites Mal', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await expect(page.locator('tr.wbs-z')).toHaveCount(4);
    await nachEreignissen(page, 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('kanbanD');
    expect((await gezaehlt(page)).neu).toBe(1);
  });

  test('Eigener Schreibzugriff: Status gesetzt — einmal neu gezeichnet, das Echo aus dem Arbeits-Repository nicht', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    await nachEreignissen(page, 1);
    const vorher = await gezaehlt(page);
    await page.locator('tr.wbs-z[data-id="B0001"]').getByRole('button', { name: /Status von B0001/ }).click();
    await page.getByRole('menuitem', { name: 'gelb' }).click();
    await expect(page.locator('tr.wbs-z[data-id="B0001"]')).toHaveClass(/\bgelb\b/);
    await nachEreignissen(page, vorher.ereignisse + 1);
    const nachher = await gezaehlt(page);
    expect(nachher.neu - vorher.neu).toBe(2); // Menü auf, Status gesetzt und neu geladen — kein drittes Mal durch das Echo
  });

  test('Fremde Änderung im Arbeits-Repository zeichnet weiterhin neu', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    await nachEreignissen(page, 1);
    const vorher = await gezaehlt(page);
    require('fs').writeFileSync(arbeit.wbs, WBS.replace('| B0001 | Bubble | D0001 | Board lesen | rot |', '| B0001 | Bubble | D0001 | Board lesen | gruen |'));
    await expect(page.locator('tr.wbs-z[data-id="B0001"]')).toHaveClass(/\bgruen\b/);
    expect((await gezaehlt(page)).neu).toBeGreaterThan(vorher.neu);
  });

  test('Klick während eines Neuladens: Zuklappen wirkt, auch wenn die WBS noch unterwegs ist', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    await nachEreignissen(page, 1);
    const z = id => page.locator(`tr.wbs-z[data-id="${id}"]`);
    await expect(z('B0001')).toBeVisible();
    let unterwegs, freigeben;
    const angekommen = new Promise(ok => { unterwegs = ok; });
    await page.route('**/api/wbs/kd', async route => { unterwegs(); await new Promise(ok => { freigeben = ok; }); await route.continue(); });
    require('fs').writeFileSync(arbeit.wbs, WBS.replace('| D0002 | Dialog | A0001 | Berichte | rot |', '| D0002 | Dialog | A0001 | Berichte | gelb |'));
    await angekommen; // das Neuladen nach der fremden Änderung wartet jetzt auf die WBS
    await z('D0001').getByRole('button', { name: 'D0001 zuklappen' }).click();
    await expect(z('B0001')).toBeHidden();
    freigeben();
    await expect(z('D0002').locator('.ampel')).toHaveText('gelb');
    await expect(z('B0001')).toBeHidden();
    await expect(z('D0001').getByRole('button', { name: 'D0001 aufklappen' })).toBeVisible();
  });
});
