// R00019 Filtern
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: Kopfzeile verdichten\nclass: feature\nassignees: [st]\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: Absturz beim Start\nclass: bug\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: Dateiwächter\nclass: bug\nassignees: [cl]\n---\n',
};

test.describe('R00019', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: nach Klasse filtern, Spaltenzahlen zählen Treffer', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Filter').fill('class:bug');
    await expect(page.locator('.ka')).toHaveCount(2);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .bahn-kopf .n')).toHaveText('1');
    await expect(page.locator('.bahn[data-col="Erledigt"] .leer')).toHaveText('keine Treffer');
    await page.reload();
    await expect(page.getByLabel('Filter')).toHaveValue('class:bug');
  });

  test('US-2: Legende schaltet den Klassenfilter', async ({ page }) => {
    await page.goto(k.adresse);
    const fehler = page.getByRole('button', { name: /Fehler/ });
    await expect(fehler.locator('.n')).toHaveText('2');
    await fehler.click();
    await expect(page.getByLabel('Filter')).toHaveValue('class:bug');
    await expect(page.locator('.ka')).toHaveCount(2);
    await page.getByRole('button', { name: /Fehler/ }).click();
    await expect(page.getByLabel('Filter')).toHaveValue('');
    await expect(page.locator('.ka')).toHaveCount(3);
  });

  test('US-3: meine Karten und Tastatur', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('radio', { name: 'meine' }).click();
    await expect(page.locator('.ka .id')).toHaveText(['#1']);
    await page.getByRole('radio', { name: 'Agenten' }).click();
    await expect(page.locator('.ka .id')).toHaveText(['#3']);
    await page.getByRole('radio', { name: 'alle' }).click();
    await page.keyboard.press('/');
    await expect(page.getByLabel('Filter')).toBeFocused();
    await page.keyboard.type('#2');
    await expect(page.locator('.ka .id')).toHaveText(['#2']);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Filter')).toHaveValue('');
    await expect(page.locator('.ka')).toHaveCount(3);
  });
});
