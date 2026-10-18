// R00009 Spalten einrichten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n- #1\n- #2\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00009', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: umbenennen und ergänzen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Spaltenname 2').fill('Doing');
    await page.getByLabel('Neue Spalte').fill('Review');
    await page.keyboard.press('Enter');
    await expect(page.locator('#setup-vorschau')).toContainText('## Doing');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.bahn')).toHaveCount(4);
    await expect(page.locator('.bahn-kopf')).toHaveText([/Zu erledigen/, /Doing/, /Review/, /Erledigt/]);
    await expect(page.locator('.bahn[data-col="Doing"] .ka')).toHaveCount(2);
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|Spalten von „Entwicklung“ geändert');
  });

  test('US-2: volle Spalte lässt sich nicht entfernen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Spalten' }).click();
    await expect(page.getByLabel('Spalte In Arbeit entfernen')).toBeDisabled();
    await expect(page.getByLabel('Spalte In Arbeit entfernen')).toHaveAttribute('title', /2 Karten/);
    await page.getByLabel('Spalte Zu erledigen entfernen').click();
    await page.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(page.locator('.bahn')).toHaveCount(3);
  });

  test('US-3: Grenze überschritten', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Grenze In Arbeit').fill('1');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf')).toHaveClass(/ueber/);
    await expect(page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf')).toContainText('Grenze 1 · überschritten');
    expect(k.lies('boards/entwicklung.md')).toContain('limits:\n  In Arbeit: 1');
  });
});
