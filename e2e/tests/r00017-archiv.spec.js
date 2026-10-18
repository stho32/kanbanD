// R00017 Archivieren und zurückholen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00017', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: archivieren und rückgängig', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByRole('button', { name: 'Archivieren' }).click();
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Archiv (1)' })).toBeVisible();
    expect(k.lies('aufgaben/0001-eins.md')).toMatch(/archived: \d{4}-\d\d-\d\d/);
    await page.getByRole('status').getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await expect(page.getByRole('link', { name: /Archiv \(/ })).toHaveCount(0);
  });

  test('US-3: aus der Archivansicht zurückholen', async ({ page }) => {
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins\narchived: 2026-10-01\n---\n');
    await page.goto(k.adresse);
    await page.getByRole('link', { name: 'Archiv (1)' }).click();
    await expect(page.locator('.archbar')).toContainText('Archiv · 1 Karten');
    await expect(page.locator('.ka')).toHaveCount(1);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('.mod .archbar')).toContainText('Archiviert am 2026-10-01');
    await page.getByRole('button', { name: 'Zurückholen', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Archiv verlassen' }).click();
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
  });
});
