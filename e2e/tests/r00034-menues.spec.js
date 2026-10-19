// R00034 Kontextmenüs für Spalten und Listen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n\n- #2\n- #3\n',
  'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n',
};

test.describe('R00034', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Erledigtes aufräumen und zurückholen, je ein Commit', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.bahn[data-col="Erledigt"] .bahn-kopf').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Alle 2 Karten archivieren' }).click();
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka')).toHaveCount(0);
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#2, #3 archiviert (2 Aufgaben)');
    await page.getByRole('status').getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka')).toHaveCount(2);
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#2, #3 zurückgeholt (2 Aufgaben)');
  });

  test('US-2: Spalte per Tastatur nach rechts', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.bahn[data-col="Zu erledigen"] .bahn-kopf').focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: 'Spalte „Zu erledigen“' })).toBeVisible();
    await page.getByRole('menuitem', { name: 'Spalte nach rechts' }).click();
    await expect(page.locator('.bahn-kopf')).toHaveText([/In Arbeit/, /Zu erledigen/, /Erledigt/]);
  });

  test('US-3: aus der Aufgabenliste aufs Board', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="4"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Auf Board legen/ }).hover();
    await page.getByRole('menuitem', { name: 'Test · Bereit' }).click();
    await expect(page.locator('tr[data-zeile="4"] .orte')).toContainText('Test · Bereit');
    await page.locator('tr[data-zeile="4"]').focus();
    await page.keyboard.press('Shift+F10');
    await page.getByRole('menuitem', { name: /Von Board nehmen/ }).hover();
    await page.getByRole('menuitem', { name: 'Test · Bereit' }).click();
    await expect(page.locator('tr[data-zeile="4"] .orte')).toHaveText('auf keinem Board');
  });
});

// Bug: das Neuzeichnen beim Öffnen des Menüs setzte die gescrollte Aufgabenliste nach oben zurück
test.describe('R00034 lange Liste', () => {
  const NUMMERN = Array.from({ length: 60 }, (_, i) => i + 1);
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(Object.fromEntries(NUMMERN.map(n => [`aufgaben/${String(n).padStart(4, '0')}-k${n}.md`, `---\nid: ${n}\ntitle: k${n}\n---\n`]))));
    await alsPerson(page, 'st');
    await page.setViewportSize({ width: 800, height: 500 });
  });
  test.afterEach(() => k.stoppen());

  test('Rechtsklick auf eine Zeile lässt die Scrollposition stehen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    const liste = page.locator('.body.liste-mit-zielen');
    // die erste Zeile, die nach dem Scrollen ganz sichtbar ist
    const nr = await liste.evaluate(b => { b.scrollTop = 600; const oben = b.getBoundingClientRect().top + 40; return [...b.querySelectorAll('tr[data-zeile]')].find(z => z.getBoundingClientRect().top > oben).dataset.zeile; });
    const zeile = page.locator(`tr[data-zeile="${nr}"]`);
    const kasten = await zeile.boundingBox();
    await zeile.click({ button: 'right' });
    await expect(page.getByRole('menu')).toBeVisible();
    expect(await liste.evaluate(b => b.scrollTop)).toBe(600);
    expect(await zeile.boundingBox()).toEqual(kasten);
  });
});
