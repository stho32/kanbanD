// R00010 Personen und Klassen pflegen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nclass: bug\nassignees: [mi]\n---\n',
};

test.describe('R00010', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Person und Klasse hinzufügen', async ({ page }) => {
    await page.goto(k.adresse + '#/einrichten');
    await page.getByLabel('Neues Kürzel').fill('ka');
    await page.getByLabel('Neuer Name').fill('Kai');
    await page.keyboard.press('Enter');
    await page.getByLabel('Neuer Klassenschlüssel').fill('doku');
    await page.getByLabel('Neue Bezeichnung').fill('Doku');
    await page.keyboard.press('Enter');
    await expect(page.locator('#einr-vorschau')).toContainText('ka: {name: Kai, kind: human}');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('gespeichert')).toBeVisible();
    expect(k.lies('kanbanD.md')).toContain('doku: {label: Doku, color:');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|Einstellungen geändert');
    await page.locator('#t-ich').click();
    await expect(page.getByRole('menuitem', { name: /Kai/ })).toBeVisible();
  });

  test('US-2: stilllegen statt entfernen', async ({ page }) => {
    await page.goto(k.adresse + '#/einrichten');
    await page.getByLabel('stilllegen mi').click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('gespeichert')).toBeVisible();
    expect(k.lies('kanbanD.md')).toContain('mi: {name: Mia, kind: human, active: false}');
    await page.locator('#t-ich').click();
    await expect(page.getByRole('menuitem', { name: /Mia/ })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Board' }).click();
    await expect(page.locator('.ka[data-id="1"] .pk')).toHaveAttribute('title', 'Mia (stillgelegt)');
  });

  test('US-3: Klassenfarbe ändern', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('style', /kd-c-red/);
    await page.getByRole('link', { name: 'Einrichten' }).click();
    await page.getByLabel('Farbe bug').click();
    await page.getByLabel('orange', { exact: true }).click();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('gespeichert')).toBeVisible();
    await page.getByRole('link', { name: 'Board' }).click();
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('style', /kd-c-orange/);
  });
});
