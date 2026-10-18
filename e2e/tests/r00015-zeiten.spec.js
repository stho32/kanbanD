// R00015 Zeiten nachtragen und korrigieren
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 11:00 · st\n```\n',
};

test.describe('R00015', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: nachtragen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('#zeitsumme')).toContainText('2:00');
    await page.getByLabel('Zeit nachtragen').fill('0:45');
    await page.keyboard.press('Enter');
    await expect(page.locator('#zeitsumme')).toContainText('2:45');
    await expect(page.locator('.zt tr')).toHaveCount(2);
  });

  test('US-2: korrigieren', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByLabel('Zeit 1 korrigieren').click();
    await page.getByLabel('Ende', { exact: true }).fill('2026-10-17 10:00');
    await page.keyboard.press('Enter');
    await expect(page.locator('#zeitsumme')).toContainText('1:00');
    expect(k.lies('aufgaben/0001-eins.md')).toContain('2026-10-17 09:00 · 2026-10-17 10:00 · st');
  });

  test('US-3: löschen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByLabel('Zeit 1 löschen').click();
    await expect(page.locator('#zeitsumme')).toContainText('0:00');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toContain('kanbanD-time');
  });
});
