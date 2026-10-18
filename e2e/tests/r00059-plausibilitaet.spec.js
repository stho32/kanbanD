// R00059 Plausibilitätsprüfung je Spalte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, einrichten } = require('./hilfen');

test.describe('R00059 Konfiguration', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('Spalten konfigurieren: Prüfung je Spalte schalten, unbekannte bleibt erhalten', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '---\ncolumn-checks:\n  In Arbeit: [xyz]\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('#pruefungen-hinweis')).toContainText('Spalte „In Arbeit“: unbekannte Prüfung „xyz“');
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Prüfung wbs-effects-green Zu erledigen').click();
    await page.getByLabel('Prüfung wbs-effects-green In Arbeit').click();
    await expect(page.locator('#setup-vorschau')).toContainText('column-checks:\n  Zu erledigen: [wbs-effects-green]\n  In Arbeit: [xyz, wbs-effects-green]');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.bahn')).toHaveCount(3);
    expect(k.lies('boards/entwicklung.md')).toContain('column-checks:\n  Zu erledigen: [wbs-effects-green]\n  In Arbeit: [xyz, wbs-effects-green]\n');
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Prüfung wbs-effects-green Zu erledigen').click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('column-checks:\n  In Arbeit: [xyz, wbs-effects-green]\n---');
  });
});
