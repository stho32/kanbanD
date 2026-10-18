// R00002 Erster Start einrichten
const { test, expect } = require('@playwright/test');
const { kanbanStarten } = require('./hilfen');

test.describe('R00002', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(); });
  test.afterEach(() => k.stoppen());

  test('US-1: Einrichten zeigt das Board mit drei Spalten, Commit von Stefan', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Kürzel').fill('st');
    await page.getByLabel('Name').fill('Stefan');
    await page.getByRole('button', { name: 'Einrichten und committen' }).click();
    await expect(page.locator('.bahn-kopf')).toHaveCount(3);
    await expect(page.locator('.bahn-kopf').first()).toContainText('Zu erledigen');
    await expect(page.locator('.kz-z1')).toContainText('Entwicklung');
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    expect(k.lies('kanbanD.md')).toContain('st: {name: Stefan, kind: human}');
  });

  test('US-2: Vorschau zeigt sofort den neuen Namen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Kürzel').fill('st');
    await page.getByLabel('Name').fill('Stefan Hoffmann');
    await expect(page.locator('#vorschau-einstellungen')).toContainText('st: {name: Stefan Hoffmann, kind: human}');
    await page.getByLabel('Board').fill('Mein Board');
    await expect(page.locator('#vorschau-board')).toContainText('# Mein Board');
  });

  test('US-3: ohne Kürzel nennt die Seite den Fehler und legt nichts an', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Name').fill('Stefan');
    await page.getByRole('button', { name: 'Einrichten und committen' }).click();
    await expect(page.getByRole('alert')).toContainText('Kürzel');
    expect(require('fs').existsSync(k.ordner + '/kanbanD.md')).toBe(false);
  });
});
