// R00041 Kürzel nach Kanbanflow-Konvention
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n', 'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n' };

test.describe('R00041', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Leertaste Timer, Entf archiviert', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press(' ');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toMatch(/kanbanD-time\n\d{4}-\d\d-\d\d \d\d:\d\d\+0[12]:00 · \.\.\. · st\n/);
    await expect(page.locator('.ka[data-id="1"] .lauf.eigen')).toBeVisible();
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press(' ');
    await expect(page.locator('.ka[data-id="1"] .lauf')).toHaveCount(0);
    // sofort wieder gestoppt: unter 20 Sekunden bleibt kein Zeitblock (R00068)
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toMatch(/· st\n/);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Delete');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('archived:');
  });

  test('US-2: n von überall, Entf in der Liste', async ({ page }) => {
    await page.goto(k.adresse + '#/personen');
    await expect(page.locator('table.pt')).toBeVisible();
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toContainText('ohne Board');
    await page.keyboard.press('Escape');
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="2"]').focus();
    await page.keyboard.press('Delete');
    await expect.poll(() => k.lies('aufgaben/0002-zwei.md')).toContain('archived:');
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toContainText('ohne Board');
  });
});
