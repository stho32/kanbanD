// R00029 Karte direkt bedienen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' };

test.describe('R00029', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Timer und mir zuweisen an der Karte', async ({ page }) => {
    await page.goto(k.adresse);
    const karte = page.locator('.ka[data-id="1"]');
    await karte.hover();
    await page.getByRole('button', { name: 'Timer an #1 starten' }).click();
    await expect(karte.locator('.lauf.eigen')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await karte.hover();
    await page.getByRole('button', { name: 'mich zu #1' }).click();
    await expect(karte.locator('.avs .pk')).toHaveText('ST');
    expect(k.lies('aufgaben/0001-eins.md')).toContain('assignees: [st]');
    await karte.hover();
    await page.getByRole('button', { name: 'Timer an #1 stoppen' }).click();
    await expect(karte.locator('.lauf')).toHaveCount(0);
  });

  test('US-2: umbenennen per Doppelklick und F2, Esc verwirft', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .t').dblclick();
    await page.getByLabel('Neuer Titel').fill('eins neu');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('eins neu');
    expect(k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Titel');
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('F2');
    await page.getByLabel('Neuer Titel').fill('verworfen');
    await page.keyboard.press('Escape');
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('eins neu');
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('m');
    await expect(page.locator('.ka[data-id="1"] .avs .pk')).toHaveText('ST');
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('t');
    await expect(page.locator('.ka[data-id="1"] .lauf.eigen')).toBeVisible();
  });

  test('US-3: Fälligkeit per Knopf', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .t').click();
    await page.getByRole('button', { name: 'morgen' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain(`due: ${iso(1)}`);
    await page.getByRole('button', { name: '+1 Woche' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain(`due: ${iso(7)}`);
    await page.getByRole('button', { name: 'Fälligkeit entfernen' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toContain('due:');
  });
});
