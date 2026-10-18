// R00003 Identität wählen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten } = require('./hilfen');

test.describe('R00003', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten()); });
  test.afterEach(() => k.stoppen());

  test('US-1: Mensch wählt sich, Wahl übersteht Neuladen', async ({ page }) => {
    await page.goto(k.adresse);
    const knopf = page.locator('#t-ich');
    await expect(knopf).toContainText('nicht gewählt');
    await knopf.click();
    await page.getByRole('menuitem', { name: /Stefan/ }).click();
    await expect(knopf).toContainText('Stefan');
    await page.reload();
    await expect(page.locator('#t-ich')).toContainText('Stefan');
  });

  test('US-2: neue Sitzung ist wieder nicht gewählt', async ({ page, browser }) => {
    await page.goto(k.adresse);
    await page.locator('#t-ich').click();
    await page.getByRole('menuitem', { name: /Mia/ }).click();
    await expect(page.locator('#t-ich')).toContainText('Mia');
    const zweite = await browser.newPage();
    await zweite.goto(k.adresse);
    await expect(zweite.locator('#t-ich')).toContainText('nicht gewählt');
    await zweite.close();
  });

  test('Agenten und Stillgelegte sind sichtbar, aber nicht wählbar', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('#t-ich').click();
    await expect(page.getByRole('menuitem')).toHaveCount(2);
    await expect(page.locator('.iz.aus')).toHaveCount(2);
    await page.locator('.iz.aus', { hasText: 'Claude' }).click();
    await expect(page.locator('#t-ich')).toContainText('nicht gewählt');
    await page.keyboard.press('Escape');
    await expect(page.locator('#pop')).toHaveCount(0);
  });
});
