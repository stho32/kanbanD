// R00033 Kontextmenü der Karte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'boards/test.md': '# Test\n\n## Bereit\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00033', () => {
  let k;
  test.beforeEach(async ({ page, context }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Rechtsklick, Untermenü, verschieben, Klasse', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    const menue = page.getByRole('menu', { name: '#1 eins' });
    await expect(menue).toBeVisible();
    await expect(menue.getByRole('menuitem', { name: /Timer starten/ })).toContainText('t');
    await menue.getByRole('menuitem', { name: /Verschieben nach/ }).hover();
    await menue.getByRole('menuitem', { name: 'Erledigt' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Klasse/ }).click();
    // Untermenü lesbar: dunkle Schrift auf hellem Grund, nicht die weiße Schrift des markierten Eintrags
    const fehler = page.getByRole('menuitem', { name: 'Fehler' });
    const ux = page.locator('.kmenue.unter .km-e:not(.an)', { hasText: 'Funktion' });
    const [schrift, grund] = await ux.evaluate(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
    expect(schrift).not.toBe('rgb(255, 255, 255)');
    expect(grund).not.toBe(await page.locator('.km-e.an').first().evaluate(e => getComputedStyle(e).backgroundColor));
    // der aktuelle Eintrag steht wie die anderen in einer Zeile
    const hoehen = await page.locator('.kmenue.unter .km-e').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(new Set(hoehen).size).toBe(1);
    await fehler.click();
    await expect(page.locator('.ka[data-id="1"] .cls')).toHaveText('Fehler');
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Auf Board legen/ }).hover();
    await page.getByRole('menuitem', { name: 'Test · Bereit' }).click();
    await expect.poll(() => k.lies('boards/test.md')).toContain('[#1]');
  });

  test('US-2: Menü per Tastatur', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: '#1 eins' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.km-e.an')).toContainText('Mir zuweisen');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"] .avs .pk')).toHaveText('ST');
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('US-3: neue Kürzel 3, c, a', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('3');
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="2"]')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('#2 nach „Erledigt“');
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('c');
    await expect(page.getByRole('status')).toContainText('„#2 zwei“ kopiert');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#2 zwei');
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('a');
    await expect(page.locator('.ka[data-id="2"]')).toHaveCount(0);
    await expect(page.getByRole('status').getByRole('button', { name: 'rückgängig' })).toBeVisible();
  });
});
