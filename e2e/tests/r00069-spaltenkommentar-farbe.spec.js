// R00069 Spaltenkommentar und Spaltenfarbe
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

const hintergrund = l => l.evaluate(e => getComputedStyle(e).backgroundColor);

test.describe('R00069', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Kommentar als ⓘ mit Tooltip', async ({ page }) => {
    await page.goto(k.adresse);
    const kopf = page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf');
    await expect(kopf.locator('.info')).toHaveCount(0);
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Kommentar In Arbeit').fill('höchstens zwei gleichzeitig');
    await expect(page.locator('#setup-vorschau')).toContainText('column-notes:\n  In Arbeit: höchstens zwei gleichzeitig');
    await page.getByRole('button', { name: 'Fertig' }).click();
    const info = kopf.locator('.info');
    await expect(info).toHaveText('ⓘ');
    await expect(info).toHaveAttribute('title', 'höchstens zwei gleichzeitig');
    await expect(page.locator('.bahn[data-col="Erledigt"] .info')).toHaveCount(0);
    expect(k.lies('boards/entwicklung.md')).toContain('column-notes:\n  In Arbeit: höchstens zwei gleichzeitig\n');
  });

  test('US-2: Farbe als Hintergrund, wieder entfernbar', async ({ page }) => {
    await page.goto(k.adresse);
    const flaeche = page.locator('.bahn[data-col="In Arbeit"] > .flaeche');
    const vorher = await hintergrund(flaeche);
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Farbe In Arbeit').fill('#ffcc00');
    await expect(page.locator('#setup-vorschau')).toContainText('column-colors:\n  In Arbeit: "#ffcc00"');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => hintergrund(flaeche)).toBe('color(srgb 1 0.8 0)');
    expect(await hintergrund(page.locator('.bahn[data-col="Erledigt"] > .flaeche'))).toBe(vorher);
    expect(k.lies('boards/entwicklung.md')).toContain('column-colors:\n  In Arbeit: "#ffcc00"\n');
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Farbe In Arbeit entfernen').click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => hintergrund(flaeche)).toBe(vorher);
    expect(k.lies('boards/entwicklung.md')).not.toContain('column-colors');
  });
});
