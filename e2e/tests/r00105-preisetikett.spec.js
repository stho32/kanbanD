// R00105 Preisetikett je Aufgabe — Reiterleiste des Aufgabenfensters per Tastatur (US-15, F0043)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Eingang\n\n- #4\n\n## In Arbeit\n\n## Fertig\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\nOhne Preisetikett\n',
};

test.describe('R00105', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="4"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #4' })).toBeVisible();
  }

  test('US-15: Reiterleiste ist eine tablist mit roving tabindex', async ({ page }) => {
    await oeffnen(page);
    const leiste = page.getByRole('tablist', { name: 'Ansicht der Aufgabe' });
    await expect(leiste.getByRole('tab')).toHaveCount(2);
    const inhalt = leiste.getByRole('tab', { name: 'Inhalt' }), datei = leiste.getByRole('tab', { name: 'Datei' });
    await expect(inhalt).toHaveAttribute('aria-selected', 'true');
    await expect(datei).toHaveAttribute('aria-selected', 'false');
    await expect(inhalt).toHaveAttribute('tabindex', '0');
    await expect(datei).toHaveAttribute('tabindex', '-1');
    const panel = await inhalt.getAttribute('aria-controls');
    await expect(page.locator(`#${panel}`)).toHaveAttribute('role', 'tabpanel');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('US-15: Pfeile, Pos1, Ende, Enter und Leertaste auf den Reitern', async ({ page }) => {
    await oeffnen(page);
    const inhalt = page.getByRole('tab', { name: 'Inhalt' }), datei = page.getByRole('tab', { name: 'Datei' });
    await inhalt.focus();
    await page.keyboard.press('ArrowRight');
    await expect(datei).toBeFocused();
    await expect(datei).toHaveAttribute('aria-selected', 'true');
    await expect(datei).toHaveAttribute('tabindex', '0');
    await expect(inhalt).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#dateitext')).toContainText('title: vier');
    await page.keyboard.press('ArrowRight');
    await expect(inhalt).toBeFocused();
    await expect(inhalt).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Titel')).toHaveValue('vier');
    await page.keyboard.press('ArrowLeft');
    await expect(datei).toBeFocused();
    await page.keyboard.press('Home');
    await expect(inhalt).toBeFocused();
    await page.keyboard.press('End');
    await expect(datei).toBeFocused();
    await expect(datei).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(datei).toBeFocused();
    await expect(page.locator('#dateitext')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(datei).toBeFocused();
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #4' })).toBeVisible();
  });

  test('US-15 Gegenbeispiel: → im Titelfeld bewegt nur die Schreibmarke, d wechselt weiter', async ({ page }) => {
    await oeffnen(page);
    const titel = page.getByLabel('Titel');
    await titel.focus();
    await titel.evaluate(el => el.setSelectionRange(0, 0));
    await page.keyboard.press('ArrowRight');
    await expect(titel).toBeFocused();
    expect(await titel.evaluate(el => el.selectionStart)).toBe(1);
    await expect(page.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
    await titel.blur();
    await page.locator('.mod-kopf .pfad').click();
    await page.keyboard.press('d');
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Datei' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('d');
    await expect(page.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
  });

  test('US-15: Kürzelhilfe des Fensters nennt ← →', async ({ page }) => {
    await oeffnen(page);
    await page.locator('.mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe.locator('tr', { hasText: 'Reiter wechseln (Fokus auf einem Reiter)' })).toContainText('←');
    await expect(hilfe.locator('tr', { hasText: 'Reiter wechseln (Fokus auf einem Reiter)' })).toContainText('→');
  });
});
