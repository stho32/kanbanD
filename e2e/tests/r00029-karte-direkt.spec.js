// R00029 Karte direkt bedienen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const iso = n => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' };

test.describe('R00029', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Timer an der Karte', async ({ page }) => {
    await page.goto(k.adresse);
    const karte = page.locator('.ka[data-id="1"]');
    // gestartet wird über Menü oder Taste t; die Karte selbst hat keinen Startknopf mehr, auch kein „+ mich“ (R00064)
    await karte.hover();
    await expect(page.getByRole('button', { name: 'Timer an #1 starten' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'mich zu #1' })).toHaveCount(0);
    await karte.focus();
    await page.keyboard.press('t');
    await expect(karte.locator('.lauf.eigen')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // die Laufzeit zeigt Sekunden und zählt sichtbar weiter
    const zeit = karte.locator('.lauf [data-since]');
    await expect(zeit).toHaveText(/^\d+:\d{2}:\d{2}$/);
    const erst = await zeit.textContent();
    await expect(zeit).not.toHaveText(erst, { timeout: 3000 });
    // Laufanzeige und Stoppknopf stehen rechts oben, sichtbar auch ohne Zeigen
    await page.mouse.move(0, 0);
    const stopp = page.getByRole('button', { name: 'Timer an #1 stoppen' });
    await expect(stopp).toBeVisible();
    const [kk, lauf, knopf] = await Promise.all([karte.boundingBox(), karte.locator('.lauf').boundingBox(), stopp.boundingBox()]);
    expect(kk.x + kk.width - (knopf.x + knopf.width)).toBeLessThan(16);
    expect(knopf.y - kk.y).toBeLessThan(16);
    expect(lauf.x + lauf.width).toBeLessThanOrEqual(knopf.x);
    await stopp.click();
    await expect(karte.locator('.lauf')).toHaveCount(0);
    await expect(stopp).toHaveCount(0);
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
