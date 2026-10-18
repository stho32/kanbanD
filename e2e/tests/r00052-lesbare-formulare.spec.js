// R00052 Lesbare Formulare in den Berichten (Nachtrag)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

test.describe('R00052', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' })); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Spaltenwahl der Durchlaufzeit ungekürzt', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/durchlauf');
    const von = page.getByLabel('von Spalte');
    await expect(von).toHaveValue('Zu erledigen');
    const passt = await von.evaluate(s => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(s).font; return c.measureText(s.value).width + 24 <= s.clientWidth; });
    expect(passt).toBe(true);
  });

  test('US-2: deutsche Farbnamen, Datei behält den Schlüssel', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/prognose');
    const farbe = page.getByLabel('Farbe des Termins', { exact: true });
    await expect(farbe.locator('option[value="red"]')).toHaveText('rot');
    await expect(farbe.locator('option[value="green"]')).toHaveText('grün');
    const name = page.getByLabel('Name des Termins');
    const ungekuerzt = await name.evaluate(i => { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(i).font; return c.measureText(i.placeholder).width + 16 <= i.clientWidth; });
    expect(ungekuerzt).toBe(true);
    await name.fill('Deadline');
    await page.getByLabel('Datum des Termins').fill('2027-10-31');
    await farbe.selectOption({ label: 'rot' });
    await page.getByRole('button', { name: 'Termin anlegen' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('color: red');
  });
});
