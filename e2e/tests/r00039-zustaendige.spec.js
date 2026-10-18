// R00039 Zuständige frei setzen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nassignees: [mi]\n---\n' };

test.describe('R00039', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: per Rechtsklick zuweisen und abnehmen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Zuständige/ }).hover();
    const unter = page.locator('.kmenue.unter .km-e');
    await expect(unter).toHaveText(['Stefan', '✓ Mia', 'Claude']);
    await unter.filter({ hasText: 'Claude' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('assignees: [mi, cl]');
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Zuständige/ }).hover();
    await page.locator('.kmenue.unter .km-e', { hasText: 'Mia' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('assignees: [cl]');
    expect(k.git('log', '-1', '--format=%s')).toContain('#1');
  });

  test('US-2: p öffnet die Personen, Pfeil und Enter schalten um', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('p');
    await expect(page.locator('.kmenue.unter .km-e.an')).toHaveText('Stefan');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.kmenue.unter .km-e.an')).toContainText('Mia');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toContain('assignees');
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
  });
});
