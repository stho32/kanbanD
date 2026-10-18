// R00016 Anhänge verwalten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

test.describe('R00016', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: hinzufügen, öffnen, entfernen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByLabel('Anhang hinzufügen').setInputFiles({ name: 'protokoll.txt', mimeType: 'text/plain', buffer: Buffer.from('Inhalt des Protokolls') });
    const link = page.getByRole('link', { name: 'protokoll.txt' });
    await expect(link).toBeVisible();
    expect(k.lies('aufgaben/0001-eins/protokoll.txt')).toBe('Inhalt des Protokolls');
    const antwort = await page.request.get(k.adresse + 'api/aufgaben/1/anhaenge/protokoll.txt');
    expect(await antwort.text()).toBe('Inhalt des Protokolls');
    await page.getByLabel('Anhang protokoll.txt entfernen').click();
    await expect(link).toHaveCount(0);
    expect(require('fs').existsSync(k.ordner + '/aufgaben/0001-eins')).toBe(false);
  });
});
