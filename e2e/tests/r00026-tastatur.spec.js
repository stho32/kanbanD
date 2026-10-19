// R00026 Tastaturbedienung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00026', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: wählen, verschieben, öffnen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('body').click({ position: { x: 1200, y: 600 } });
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka[data-id="1"]')).toBeVisible();
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/## In Arbeit\n\n- \[#1\]/);
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.ka[data-id="2"]')).toBeFocused();
    await page.keyboard.press('Alt+ArrowUp'); // Umschalt + ↑ wählt seit R00065 aus
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('zwei');
  });

  test('US-3: n und ?', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Tastaturkürzel' })).toContainText('Umschalt');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('n');
    await expect(page.getByLabel('Titel der neuen Aufgabe')).toBeFocused();
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toContainText('Entwicklung · Zu erledigen');
  });
});
