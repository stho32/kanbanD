// R00064 Zuständige per Dialog, Mitglieder rechts auf der Karte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nassignees: [mi]\n---\n' };

test.describe('R00064', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Karte ohne mich-Knopf, Mitglieder rechtsbündig', async ({ page }) => {
    await page.goto(k.adresse);
    const karte = page.locator('.ka[data-id="1"]');
    await karte.hover();
    await expect(page.getByRole('button', { name: /mich (zu|von) #1/ })).toHaveCount(0);
    const [k1, mitglieder] = await Promise.all([karte.boundingBox(), karte.locator('.avs').boundingBox()]);
    expect(k1.x + k1.width - (mitglieder.x + mitglieder.width)).toBeLessThan(16);
  });

  test('US-2: Dialog aus dem Kartenmenü speichert gesammelt, Abbrechen und Esc verwerfen', async ({ page }) => {
    await page.goto(k.adresse);
    const commits = () => +k.git('rev-list', '--count', 'HEAD');
    const vorher = commits();
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Zuständige für #1' });
    await expect(dialog.getByRole('checkbox')).toHaveCount(3);
    await expect(dialog.getByRole('checkbox', { name: /Mia/ })).toBeChecked();
    await dialog.getByRole('checkbox', { name: /Claude/ }).check();
    await dialog.getByRole('checkbox', { name: /Mia/ }).uncheck();
    await dialog.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog).toHaveCount(0);
    expect(k.lies('aufgaben/0001-eins.md')).toContain('assignees: [mi]');

    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    await expect(dialog.getByRole('checkbox', { name: /Claude/ })).not.toBeChecked();
    await dialog.getByRole('checkbox', { name: /Claude/ }).check();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    expect(k.lies('aufgaben/0001-eins.md')).toContain('assignees: [mi]');
    expect(commits()).toBe(vorher);

    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    await dialog.getByRole('checkbox', { name: /Claude/ }).check();
    await dialog.getByRole('checkbox', { name: /Mia/ }).uncheck();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('assignees: [cl]');
    expect(commits()).toBe(vorher + 1);
    expect(k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Zuständige');
    await expect(page.locator('.ka[data-id="1"] .avs .pk')).toHaveText('CL');
  });

  test('US-3: p öffnet den Dialog, Leertaste schaltet, Enter speichert, Fokus zurück auf der Karte', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('p');
    const dialog = page.getByRole('dialog', { name: 'Zuständige für #1' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('checkbox').first()).toBeFocused();
    await page.keyboard.press(' ');
    await expect(dialog.getByRole('checkbox', { name: /Stefan/ })).toBeChecked();
    await page.keyboard.press('Enter');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('assignees: [mi, st]');
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
  });

  test('US-4: Dialog aus der Aufgabenliste', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Zuständige für #1' });
    await dialog.getByRole('checkbox', { name: /Claude/ }).check();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('assignees: [mi, cl]');
  });
});
