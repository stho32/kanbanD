// R00066 Teilaufgaben nachträglich bearbeiten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n- [x] Board lesen\n- [ ] Spalten lesn\n' };

test.describe('R00066', () => {
  let k;
  const commits = () => +k.git('rev-list', '--count', 'HEAD');
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Klick auf den Text bearbeitet, Enter speichert, der Haken bleibt', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    const vorher = commits();
    await dialog.locator('.chk span', { hasText: 'Spalten lesn' }).click();
    const feld = dialog.getByLabel('Teilaufgabe bearbeiten');
    await expect(feld).toBeFocused();
    await expect(feld).toHaveValue('Spalten lesn');
    expect(k.lies('aufgaben/0001-eins.md')).toContain('- [ ] Spalten lesn');
    await feld.fill('Spalten lesen');
    await page.keyboard.press('Enter');
    await expect(dialog.getByRole('checkbox', { name: 'Spalten lesen', exact: true })).toHaveAttribute('aria-checked', 'false');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] Board lesen\n- [ ] Spalten lesen\n');
    await expect.poll(commits).toBe(vorher + 1);
    // auch ein erledigter Text lässt sich bearbeiten und bleibt erledigt; Verlassen des Feldes speichert
    await dialog.locator('.chk span', { hasText: 'Board lesen' }).click();
    await dialog.getByLabel('Teilaufgabe bearbeiten').fill('Board ganz lesen');
    await dialog.getByLabel('Neue Teilaufgabe').click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] Board ganz lesen\n');
  });

  test('US-2: Esc verwirft, das Fenster bleibt offen', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Aufgabe #1' });
    await dialog.locator('.chk span', { hasText: 'Spalten lesn' }).click();
    await dialog.getByLabel('Teilaufgabe bearbeiten').fill('verworfen');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Teilaufgabe bearbeiten')).toHaveCount(0);
    await expect(dialog.locator('.chk span', { hasText: 'Spalten lesn' })).toBeVisible();
    expect(k.lies('aufgaben/0001-eins.md')).toContain('- [ ] Spalten lesn');
  });

  test('US-3: Klick auf das Kästchen hakt ab', async ({ page }) => {
    await page.getByRole('dialog').getByRole('checkbox', { name: 'Spalten lesn', exact: true }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] Spalten lesn');
  });
});
