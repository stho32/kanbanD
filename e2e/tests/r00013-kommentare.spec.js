// R00013 Kommentieren
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n```kanbanD-comments\n2026-10-17 09:00 · cl · Erster\\nGedanke\n```\n',
};

test.describe('R00013', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  test('US-1: Mensch kommentiert', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('.km').first()).toContainText('Claude · 2026-10-17 09:00');
    await expect(page.locator('.km p').first()).toHaveText('ErsterGedanke');
    await page.getByLabel('Neuer Kommentar').fill('Gut so.');
    await page.keyboard.press('Enter');
    await expect(page.locator('.km')).toHaveCount(2);
    await expect(page.locator('.km').nth(1)).toContainText('Stefan');
    expect(k.lies('aufgaben/0001-eins.md')).toMatch(/· st · Gut so\.\n```/);
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|#1 kommentiert: Gut so.');
  });

  test('ohne Identität ist das Feld gesperrt', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.getByLabel('Neuer Kommentar')).toBeDisabled();
  });
});
