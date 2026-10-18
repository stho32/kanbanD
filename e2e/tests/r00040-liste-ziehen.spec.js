// R00040 Ziehen in der Aufgabenliste
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n';
const DATEIEN = { 'boards/entwicklung.md': BOARD, 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n', 'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n' };

test.describe('R00040', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); await page.goto(k.adresse + '#/aufgaben'); });
  test.afterEach(() => k.stoppen());

  test('US-1: auf ein Board legen und dort bewegen', async ({ page }) => {
    await page.locator('tr[data-zeile="2"]').dragTo(page.getByLabel('Ziel Entwicklung · In Arbeit'));
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('## In Arbeit\n\n- [#2](../aufgaben/0002-zwei.md)');
    expect(k.lies('aufgaben/0002-zwei.md')).toBe('---\nid: 2\ntitle: zwei\n---\n');
    await expect(page.getByRole('status')).toContainText('#2 nach Entwicklung · In Arbeit');
    await page.locator('tr[data-zeile="1"]').dragTo(page.getByLabel('Ziel Entwicklung · Erledigt'));
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/## Erledigt\n\n- \[#1\]/);
    expect(k.git('log', '-1', '--name-only', '--format=')).toBe('boards/entwicklung.md');
  });

  test('US-2: ins Archiv ziehen', async ({ page }) => {
    await page.locator('tr[data-zeile="1"]').dragTo(page.getByLabel('Ziel Archiv'));
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('archived:');
    await expect(page.getByRole('status')).toContainText('#1 archiviert');
  });
});
