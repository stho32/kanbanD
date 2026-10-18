// R00005 Aufgabe anlegen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

test.describe('R00005', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten()); });
  test.afterEach(() => k.stoppen());

  test('US-1: Karte in „In Arbeit“ anlegen, ein Commit von Stefan', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const bahn = page.locator('.bahn[data-col="In Arbeit"]');
    await page.getByRole('button', { name: 'Neue Aufgabe in In Arbeit' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('Dateiwächter');
    await page.keyboard.press('Enter');
    await expect(bahn.locator('.ka .t')).toHaveText(['Dateiwächter']);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    expect(k.git('show', '--name-only', '--format=', 'HEAD').split('\n')).toEqual(['aufgaben/0001-dateiwaechter.md', 'boards/entwicklung.md']);
  });

  test('US-2: mehrere nacheinander, das Feld bleibt offen', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const bahn = page.locator('.bahn[data-col="Zu erledigen"]');
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('Erste');
    await page.keyboard.press('Shift+Enter');
    await expect(bahn.locator('.ka')).toHaveCount(1);
    await expect(page.getByLabel('Titel der neuen Aufgabe')).toBeFocused();
    await page.keyboard.type('Zweite');
    await page.keyboard.press('Shift+Enter');
    await expect(bahn.locator('.ka .id')).toHaveText(['#1', '#2']);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Titel der neuen Aufgabe')).toHaveCount(0);
  });

  test('US-3: ohne Identität öffnet sich „Ich bin …“ und nichts entsteht', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await expect(page.locator('.warnh')).toContainText('zuerst wählen');
    expect(require('fs').existsSync(k.ordner + '/aufgaben')).toBe(false);
  });
});
