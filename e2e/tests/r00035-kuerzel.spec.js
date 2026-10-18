// R00035 Tastenkürzel überall
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00035', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Seiten wechseln, b und i', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('body').click({ position: { x: 1200, y: 500 } });
    await page.keyboard.press('g');
    await page.keyboard.press('p');
    await expect(page).toHaveURL(/#\/personen$/);
    await expect(page.getByRole('link', { name: 'Personen' })).toHaveClass(/an/);
    await page.keyboard.press('g');
    await page.keyboard.press('a');
    await expect(page.locator('tr[data-zeile]')).toHaveCount(2);
    await page.keyboard.press('g');
    await page.keyboard.press('b');
    await expect(page.locator('.bahn')).toHaveCount(3);
    await page.keyboard.press('b');
    await expect(page.getByRole('menuitem', { name: /Entwicklung/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('i');
    await expect(page.getByRole('menuitem', { name: /Stefan/ })).toBeVisible();
  });

  test('US-2: im Fenster arbeiten, Hilfe je Ort', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.keyboard.press('t');
    await expect(page.locator('.tz.eigen')).toBeVisible();
    await page.keyboard.press('m');
    await expect(page.locator('.as.an', { hasText: 'Stefan' })).toBeVisible();
    await page.keyboard.press('?');
    await expect(page.getByRole('dialog', { name: 'Tastaturkürzel' })).toContainText('HIER: AUFGABENFENSTER');
    await expect(page.getByRole('dialog', { name: 'Tastaturkürzel' })).toContainText('ÜBERALL');
    await page.keyboard.press('Escape');
    await page.keyboard.press('d');
    await expect(page.locator('#dateitext')).toContainText('assignees: [st]');
    await page.keyboard.press('d');
    await page.keyboard.press('k');
    await expect(page.getByLabel('Neuer Kommentar')).toBeFocused();
  });

  test('US-3: Aufgabenliste mit Pfeilen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('body').click({ position: { x: 1200, y: 500 } });
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('tr[data-zeile="2"]')).toBeFocused();
    await page.keyboard.press('a');
    await expect(page.locator('tr[data-zeile="2"] .tt .lbl')).toContainText('archiviert');
    await expect(page.locator('tr[data-zeile="2"]')).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('eins');
  });
});

test('Hilfe auch per Klick in der Statuszeile', async ({ page }) => {
  const { kanbanStarten: start, einrichten: ein } = require('./hilfen');
  const k = await start(ein());
  try {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: /Tastenkürzel/ }).click();
    await expect(page.getByRole('dialog', { name: 'Tastaturkürzel' })).toContainText('HIER: BOARD');
  } finally { await k.stoppen(); }
});
