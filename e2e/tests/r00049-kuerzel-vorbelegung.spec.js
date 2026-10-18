// R00049 @kürzel ersetzt die Vorbelegung im Dialog „Neue Aufgabe“ (Nachtrag)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const lesbar = (k, rel) => () => { try { return k.lies(rel); } catch (_) { return ''; } };

test('US-1 und US-2: ersetzen ohne Handauswahl, dazunehmen mit', async ({ page }) => {
  const k = await kanbanStarten(einrichten({}));
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('.bahn').first()).toBeVisible();
    await page.keyboard.press('n');
    await page.getByLabel('Titel der neuen Aufgabe').fill('Login reparieren @mi');
    await page.keyboard.press('Control+Shift+Enter');
    await expect.poll(lesbar(k, 'aufgaben/0001-login-reparieren.md')).toContain('assignees: [mi]');
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await dialog.locator('.as', { hasText: 'Claude' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('Prüfen @mi');
    await page.keyboard.press('Control+Enter');
    await expect.poll(lesbar(k, 'aufgaben/0002-pruefen.md')).toContain('assignees: [st, cl, mi]');
  } finally { await k.stoppen(); }
});
