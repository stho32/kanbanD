// R00025 Defekte Dateien zeigen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n';
const KONFLIKT = '---\nid: 2\n<<<<<<< HEAD\ntitle: zwei\n=======\ntitle: zwei anders\n>>>>>>> zweig\n---\n';

test.describe('R00025', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1 und US-3: defekte Aufgabe, nur lesbar, Reparatur ohne Neuladen', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': BOARD, 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n', 'aufgaben/0002-zwei.md': KONFLIKT }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const karte = page.locator('.ka.defekt[data-id="2"]');
    await expect(karte).toContainText('#2 — Datei defekt');
    await expect(karte).toContainText('Konfliktmarker');
    await expect(page.locator('#t-defekt')).toHaveText('1 defekte Datei');
    await karte.click();
    await expect(page.locator('#defekttext')).toContainText('<<<<<<< HEAD');
    await expect(page.getByRole('dialog').locator('input, textarea')).toHaveCount(0);
    await page.keyboard.press('Escape');
    k.schreib('aufgaben/0002-zwei.md', '---\nid: 2\ntitle: zwei repariert\n---\n');
    await expect(page.locator('.ka[data-id="2"] .t')).toHaveText('zwei repariert');
    await expect(page.locator('.ka.defekt')).toHaveCount(0);
    await expect(page.locator('#t-defekt')).toHaveCount(0);
  });

  test('US-2: defektes Board und defekte Einstellungen', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '# Entwicklung\n- #1\n## A\n', 'boards/test.md': '# Test\n\n## Bereit\n' }));
    await page.goto(k.adresse + '#/board/entwicklung');
    await expect(page.getByRole('alert')).toContainText('boards/entwicklung.md ist defekt');
    await expect(page.getByRole('alert')).toContainText('vor der ersten Spalte');
    await page.locator('#t-defekt').click();
    await expect(page.locator('#pop .dz')).toContainText(['boards/entwicklung.md']);
    await page.keyboard.press('Escape');
    await page.locator('#t-board').click();
    await page.getByRole('menuitem', { name: /Test/ }).click();
    await expect(page.locator('.bahn')).toHaveCount(1);
    k.schreib('kanbanD.md', '---\npeople: [\n---\n');
    await expect(page.locator('.warnbar')).toContainText('kanbanD.md ist defekt');
    await expect(page.locator('.bahn')).toHaveCount(1);
  });
});
