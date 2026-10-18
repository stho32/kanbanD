// R00001 Ordner öffnen — US-1: Start in einem neuen Ordner
const { test, expect } = require('@playwright/test');
const { kanbanStarten } = require('./hilfen');

test('US-1: neuer Ordner wird Git-Repository und der Browser zeigt kanbanD', async ({ page }) => {
  const k = await kanbanStarten();
  try {
    await page.goto(k.adresse);
    await expect(page).toHaveTitle(/kanbanD/);
    expect(k.git('rev-parse', '--is-inside-work-tree')).toBe('true');
  } finally { k.stoppen(); }
});
