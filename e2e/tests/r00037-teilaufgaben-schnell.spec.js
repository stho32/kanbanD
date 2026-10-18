// R00037 Teilaufgaben schnell hintereinander
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' };

test.describe('R00037', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: fünf Teilaufgaben ohne Pause', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    await page.getByLabel('Neue Teilaufgabe').focus();
    for (const t of ['eins', 'zwei', 'drei', 'vier', 'fünf']) { await page.keyboard.type(t); await page.keyboard.press('Enter'); }
    await expect(page.getByLabel('Neue Teilaufgabe')).toBeFocused();
    await expect(page.getByLabel('Neue Teilaufgabe')).toHaveValue('');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md'), { timeout: 10000 }).toContain('- [ ] eins\n- [ ] zwei\n- [ ] drei\n- [ ] vier\n- [ ] fünf\n');
    await expect(page.locator('.chk span')).toHaveText(['eins', 'zwei', 'drei', 'vier', 'fünf']);
    expect(k.git('log', '-5', '--format=%s').split('\n').reverse()).toEqual(['eins', 'zwei', 'drei', 'vier', 'fünf'].map(t => `#1 Teilaufgabe „${t}“ ergänzt`));
  });

  test('US-2: Live-Änderung lässt den angefangenen Text im Feld', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    await page.getByLabel('Neue Teilaufgabe').focus();
    await page.keyboard.type('halb getipp');
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins von außen\n---\n');
    await expect(page.getByLabel('Titel', { exact: true })).toHaveValue('eins von außen');
    await expect(page.getByLabel('Neue Teilaufgabe')).toBeFocused();
    await page.keyboard.type('t');
    await expect(page.getByLabel('Neue Teilaufgabe')).toHaveValue('halb getippt');
  });
});
