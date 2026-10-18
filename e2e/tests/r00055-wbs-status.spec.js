// R00055 WBS-Status setzen — kanbanD schreibt die WBS-Datei im Arbeits-Repository, committet dort aber nie.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'gelb'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'gelb'),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'gelb', { fertig: 'US-1' }),
  zeile('B0001', 'Bubble', 'I0001', 'Board lesen', 'gruen', { ea: 'Datei → Board', aufwand: '0,5-1' }),
  zeile('B0002', 'Bubble', 'I0001', 'Board zeigen', 'rot', { ea: 'Board → HTML', aufwand: '1-2' }),
]);

test.describe('R00055', () => {
  let k, arbeit;
  test.beforeEach(async () => {
    arbeit = arbeitsRepository(WBS);
    k = await kanbanStarten(mitRegister(arbeit));
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });
  const z = (page, id) => page.locator(`tr.wbs-z[data-id="${id}"]`);

  test('US-1: zweite Bubble per Klick grün — Interaction und Dialog werden grün, Datei geändert und nicht committet', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    const commits = arbeit.git('rev-list', '--count', 'HEAD');
    await expect(z(page, 'I0001').locator('.ampel')).toHaveText('gelb');
    await z(page, 'B0002').getByRole('button', { name: /Status von B0002/ }).click();
    await page.getByRole('menuitem', { name: 'gruen' }).click();
    await expect(z(page, 'B0002')).toHaveClass(/\bgruen\b/);
    await expect(z(page, 'I0001').locator('.ampel')).toHaveText('gruen');
    await expect(z(page, 'D0001').locator('.ampel')).toHaveText('gruen');
    await expect(page.locator('.wbs-nc')).toHaveText('nicht committet');
    expect(arbeit.lies()).toContain('| B0002 | Bubble | I0001 | Board zeigen | gruen |');
    expect(arbeit.lies()).toContain('| I0001 | Interaction | D0001 | Ansehen | gruen |');
    expect(arbeit.git('rev-list', '--count', 'HEAD')).toBe(commits);
    expect(k.git('status', '--porcelain')).toBe('');
  });

  test('Sicht: Bubble per Klick auf gelb — Zeile gelb, Kopf „nicht committet“', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    await expect(page.locator('.wbs-nc')).toHaveCount(0);
    await z(page, 'B0001').getByRole('button', { name: /Status von B0001/ }).click();
    await expect(page.getByRole('menu', { name: 'Status von B0001' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'gelb' }).click();
    await expect(z(page, 'B0001')).toHaveClass(/\bgelb\b/);
    await expect(page.locator('.wbs-nc')).toHaveText('nicht committet');
    await expect(page.locator('.wbs-laufend')).toContainText('Board lesen');
  });

  test('US-2: Interaction mit Bubbles hat keine Wahl, die API lehnt ab mit „Status wird gerechnet“', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/wbs/kd');
    await expect(z(page, 'I0001').locator('.ampel.gerechnet')).toBeVisible();
    await expect(z(page, 'I0001').getByRole('button', { name: /Status von/ })).toHaveCount(0);
    const r = await page.request.patch(k.adresse + 'api/wbs/kd/knoten/I0001', { headers: { 'X-KanbanD-Wer': 'st' }, data: { status: 'rot' } });
    expect(r.status()).toBe(409);
    expect((await r.json()).fehler).toMatch(/^Status wird gerechnet/);
    expect(arbeit.lies()).toBe(WBS);
  });

  test('ohne Identität öffnet der Klick „Ich bin …“', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await z(page, 'B0002').getByRole('button', { name: /Status von B0002/ }).click();
    await expect(page.locator('#pop .warnh')).toHaveText('Für diese Aktion zuerst wählen, wer du bist.');
    expect(arbeit.lies()).toBe(WBS);
  });
});
