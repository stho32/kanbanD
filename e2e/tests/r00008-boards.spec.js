// R00008 Boards wechseln und anlegen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

test.describe('R00008', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n' }));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: wechseln und nach Neuladen bleiben', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.locator('#t-board')).toContainText('Entwicklung');
    await page.locator('#t-board').click();
    await expect(page.getByRole('menuitem')).toHaveText([/Entwicklung/, /Test/, /Alle Aufgabenreservierungen anzeigen/]);
    await page.getByRole('menuitem', { name: /Test/ }).click();
    await expect(page.locator('.bahn-kopf')).toHaveCount(2);
    await expect(page.locator('.bahn').first()).toHaveAttribute('data-col', 'Bereit');
    expect(page.url()).toMatch(/#\/board\/test$/);
    await page.reload();
    await expect(page.locator('#t-board')).toContainText('Test');
  });

  test('US-2: neues Board über das Popover', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('#t-board').click();
    await page.getByLabel('Name des neuen Boards').fill('Release');
    await page.keyboard.press('Enter');
    await expect(page.locator('#t-board')).toContainText('Release');
    await expect(page.locator('.bahn-kopf')).toHaveCount(3);
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|Board „Release“ angelegt');
  });

  test('US-3: doppelter Name nennt den Konflikt', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('#t-board').click();
    await page.getByLabel('Name des neuen Boards').fill('Test');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('boards/test.md');
  });
});
