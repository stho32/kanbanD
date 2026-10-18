// R00020 Aufgabenliste und Board-Zuordnung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n\n- #3\n',
  'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\narchived: 2026-10-01\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier ohne Board\n---\n',
};

test.describe('R00020', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: ohne Board finden und auf ein Board legen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(page.locator('tr[data-zeile]')).toHaveCount(3);
    await page.getByRole('radio', { name: /ohne Board/ }).click();
    await expect(page.locator('tr[data-zeile]')).toHaveCount(1);
    await expect(page.locator('tr[data-zeile="4"] .orte')).toHaveText('auf keinem Board');
    await page.locator('#leg-4').click();
    await page.getByRole('menuitem', { name: 'Test · Bereit' }).click();
    await expect(page.locator('tr[data-zeile]')).toHaveCount(0);
    await page.getByRole('radio', { name: /^alle/ }).click();
    await expect(page.locator('tr[data-zeile="4"] .orte')).toContainText('Test · Bereit');
    expect(k.lies('boards/test.md')).toContain('## Bereit\n\n- [#4](../aufgaben/0004-vier.md)');
    await page.getByLabel('#4 von Test nehmen').click();
    await expect(page.locator('tr[data-zeile="4"] .orte')).toHaveText('auf keinem Board');
  });

  test('US-3: neue Aufgabe ohne Board, archivierte zurückholen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.getByLabel('Neue Aufgabe ohne Board').fill('Idee für später');
    await page.keyboard.press('Enter');
    await page.getByRole('radio', { name: /ohne Board/ }).click();
    await expect(page.locator('tr[data-zeile] .tt')).toContainText(['vier ohne Board', 'Idee für später']);
    await page.getByRole('radio', { name: /archiviert/ }).click();
    await expect(page.locator('tr[data-zeile]')).toHaveCount(1);
    await page.getByRole('button', { name: 'zurückholen' }).click();
    await expect(page.locator('tr[data-zeile]')).toHaveCount(0);
  });
});
