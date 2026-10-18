// R00007 Live-Aktualisierung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

test.describe('R00007', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  test('US-1: Editor ändert den Titel, Karte zeigt ihn mit Marke extern', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('eins');
    await page.waitForTimeout(300);
    await liveBereit(page);
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins neu\n---\n');
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('eins neu');
    await expect(page.locator('.ka[data-id="1"] .ein')).toContainText('extern · aufgaben/0001-eins.md');
  });

  test('US-2: Agent verschiebt in der Board-Datei, Karte steht mit Marke in Erledigt', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"]')).toBeVisible();
    await page.waitForTimeout(300);
    await liveBereit(page);
    k.schreib('boards/entwicklung.md', '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n');
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await expect(page.locator('.ka[data-id="1"] .ein')).toContainText('boards/entwicklung.md');
  });

  test('US-3: zweiter Browser legt an, erster zeigt es ohne Marke', async ({ page, browser }) => {
    await page.goto(k.adresse);
    await expect(page.locator('.ka')).toHaveCount(1);
    const zweiter = await browser.newPage();
    await alsPerson(zweiter, 'mi');
    await liveBereit(page);
    await zweiter.goto(k.adresse);
    await zweiter.getByRole('button', { name: 'Neue Aufgabe in In Arbeit' }).click();
    await zweiter.getByLabel('Titel der neuen Aufgabe').fill('von Mia');
    await zweiter.keyboard.press('Enter');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka .t')).toHaveText(['von Mia']);
    await expect(page.locator('.ka.fremd')).toHaveCount(0);
    await zweiter.close();
  });
});
