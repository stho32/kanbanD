// R00090 Zeiten-API mit Beginn, Ende und Kennung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 11:00 · st\n2026-10-18 08:00 · 2026-10-18 09:00 · cl\n```\n',
};

test.describe('R00090', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-3: im Detail den zweiten Eintrag korrigieren — der erste bleibt', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('tr[data-kennung="cl@2026-10-18T08:00+02:00"]')).toBeVisible();
    await page.getByLabel('Zeit 2 korrigieren').click();
    await page.getByLabel('Ende', { exact: true }).fill('2026-10-18 08:30');
    await page.keyboard.press('Enter');
    await expect(page.locator('#zeitsumme')).toContainText('2:30');
    const datei = k.lies('aufgaben/0001-eins.md');
    expect(datei).toContain('2026-10-17 09:00 · 2026-10-17 11:00 · st\n');
    expect(datei).toContain('· 2026-10-18 08:30+02:00 · cl\n');
  });

  test('löschen über die Kennung trifft den gewählten Eintrag', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByLabel('Zeit 1 löschen').click();
    await expect(page.locator('#zeitsumme')).toContainText('1:00');
    expect(k.lies('aufgaben/0001-eins.md')).not.toContain('· st\n');
  });
});
