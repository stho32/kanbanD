// R00012 Teilaufgaben abhaken
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

test.describe('R00012', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: anlegen und abhaken', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    await page.getByLabel('Neue Teilaufgabe').fill('Spalten lesen');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Spalten lesen', exact: true })).toBeVisible();
    await page.keyboard.type('Klassen lesen');
    await page.keyboard.press('Enter');
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Spalten lesen', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('checkbox', { name: 'Spalten lesen', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.ka[data-id="1"] .tk')).toHaveText('☑ 1/2');
    expect(k.lies('aufgaben/0001-eins.md')).toContain('- [x] Spalten lesen\n- [ ] Klassen lesen');
  });

  test('US-2: entfernen', async ({ page }) => {
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins\n---\n- [ ] Klassen lesen\n');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    await page.getByRole('dialog').locator('.chk').hover();
    await page.getByLabel('Teilaufgabe Klassen lesen entfernen').click();
    await expect(page.getByRole('dialog').locator('.chk')).toHaveCount(0);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toContain('Klassen lesen');
  });
});
