// R00011 Aufgabe ansehen und bearbeiten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\nAlte Beschreibung\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00011', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Titel ändern', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByLabel('Titel', { exact: true }).fill('eins neu');
    await page.getByLabel('Beschreibung').click();
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('eins neu');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|#1 geändert: Titel');
    await expect(page.locator('.mod-fuss .gs')).toContainText('gespeichert');
  });

  test('US-2: Felder in der Seitenleiste', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByLabel('Klasse').selectOption('bug');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('class: bug');
    // Auswahl und Eintrag tragen die Farbe der Klasse wie die Karte
    const wahl = page.getByLabel('Klasse');
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('data-c', 'bug');
    await expect(wahl).toHaveAttribute('style', /--cl/);
    const karte = await page.locator('.ka[data-id="1"]').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(await wahl.evaluate(e => getComputedStyle(e).backgroundColor)).toBe(karte);
    expect(await wahl.locator('option[value="bug"]').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(karte);
    expect(await wahl.locator('option[value=""]').evaluate(e => getComputedStyle(e).backgroundColor)).not.toBe(karte);
    await page.locator('.as', { hasText: 'Mia' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('assignees: [mi]');
    await page.getByLabel('Fälligkeit').fill('2026-12-24');
    await page.getByLabel('Labels').click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('due: 2026-12-24');
    await page.getByLabel('Spalte').selectOption('Erledigt');
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
  });

  test('US-3: Datei ansehen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByRole('tab', { name: 'Datei' }).click();
    await expect(page.locator('#dateitext')).toHaveText('---\nid: 1\ntitle: eins\n---\nAlte Beschreibung\n');
  });

  test('US-4: blättern und schließen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('.mod-kopf .id')).toHaveText('#1');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.mod-kopf .id')).toHaveText('#2');
    await expect(page.locator('.mod-kopf .nav')).toHaveText('2 / 2');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
