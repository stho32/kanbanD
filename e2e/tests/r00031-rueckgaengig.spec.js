// R00031 Rückgängig
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00031', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Bewegung zurück an die alte Stelle', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'));
    await expect(page.getByRole('status')).toContainText('#1 nach „Erledigt“');
    await page.getByRole('status').getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .id')).toHaveText(['#1', '#2']);
    expect(k.git('log', '-2', '--format=%s').split('\n')).toEqual(['#1 nach „Zu erledigen“ (Entwicklung)', '#1 nach „Erledigt“ (Entwicklung)']);
  });

  test('US-2: Strg+Z nach Umschalt+Pfeil, nicht im Eingabefeld', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka[data-id="2"]')).toBeVisible();
    await page.getByLabel('Filter').focus();
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka[data-id="2"]')).toBeVisible();
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('Control+z');
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .id')).toHaveText(['#1', '#2']);
  });

  test('US-3: Anlegen zurück archiviert die neuen Aufgaben', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.bahn[data-col="In Arbeit"]').getByRole('button', { name: '+ Karte' }).click();
    await page.locator('#add-inp').evaluate(el => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'falsch eins\nfalsch zwei');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka')).toHaveCount(2);
    await page.getByRole('status').getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('2 Aufgaben archiviert');
    expect(k.lies('aufgaben/0003-falsch-eins.md')).toContain('archived:');
  });
});
