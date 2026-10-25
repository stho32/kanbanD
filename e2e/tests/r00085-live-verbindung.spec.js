// R00085 Live-Verbindung mit Herzschlag
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const ALS_AGENT = { headers: { 'X-KanbanD-Wer': 'cl' } };

test.describe('R00085', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1: stille Verbindung — der Wächter verbindet nach 40 s neu und lädt nach', async ({ page }) => {
    test.setTimeout(90000);
    k = await kanbanStarten(einrichten());
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.evaluate(() => window.kdTest.liveStilllegen());
    await page.request.post(k.adresse + 'api/aufgaben', { ...ALS_AGENT, data: { titel: 'während der Stille', board: 'entwicklung' } });
    await page.waitForTimeout(2000);
    await expect(page.locator('.ka')).toHaveCount(0);
    await expect(page.locator('.ka')).toHaveCount(1, { timeout: 50000 });
    await expect(page.getByText('Wieder verbunden · Stand nachgeladen')).toBeVisible();
  });

  test('US-2: Server neu gestartet — eine danach angelegte Karte erscheint ohne Reload', async ({ page }) => {
    k = await kanbanStarten(einrichten());
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await k.neuStarten();
    await liveBereit(page);
    await page.request.post(k.adresse + 'api/aufgaben', { ...ALS_AGENT, data: { titel: 'nach dem Neustart', board: 'entwicklung' } });
    await expect(page.locator('.ka')).toHaveCount(1, { timeout: 15000 });
  });

  test('Herzschlag zeichnet nicht neu', async ({ page }) => {
    k = await kanbanStarten(einrichten(), { KANBAND_HERZSCHLAG_MS: '200' });
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.waitForTimeout(500);
    const vorher = await page.evaluate(() => window.kdTest.renders());
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.kdTest.renders())).toBe(vorher);
  });
});
