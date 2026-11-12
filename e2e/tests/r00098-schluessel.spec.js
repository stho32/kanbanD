// R00098 Idempotentes Anlegen über einen Fremdschlüssel — der Schlüssel im Aufgabenfenster
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #7\n- #8\n\n## Erledigt\n',
  'aufgaben/0007-fund.md': '---\nid: 7\ntitle: Fund\nkey: k4\n---\n',
  'aufgaben/0008-ohne.md': '---\nid: 8\ntitle: ohne Schlüssel\n---\n',
};

test.describe('R00098', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('AK Aufgabenfenster: Schlüssel sichtbar, nicht änderbar', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="7"]').click();
    await reiter(page, 'Details');
    const feld = page.locator('#schluessel');
    await expect(page.locator('#reiterpanel-details .k', { hasText: /^Schlüssel$/ })).toHaveCount(1);
    await expect(feld).toHaveText('k4');
    await expect(feld.locator('input, select, textarea, [contenteditable]')).toHaveCount(0);
    await page.keyboard.press('Escape');

    await page.locator('.ka[data-id="8"]').click();
    await reiter(page, 'Details');
    await expect(page.locator('#reiterpanel-details .felder')).toBeVisible();
    await expect(page.locator('#reiterpanel-details .k', { hasText: /^Schlüssel$/ })).toHaveCount(0);
    await expect(page.locator('#schluessel')).toHaveCount(0);
  });
});
