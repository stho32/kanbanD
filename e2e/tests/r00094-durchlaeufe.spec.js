// R00094 Durchläufe als Daten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};
const ALS_AGENT = { headers: { 'X-KanbanD-Wer': 'cl' } };

test.describe('R00094', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: ein eingetragener Durchlauf steht als Tabelle im Detail, ein Befund in Warnfarbe, neueste oben', async ({ page }) => {
    await page.request.post(k.adresse + 'api/aufgaben/1/durchlaeufe', { ...ALS_AGENT, data: { phase: 'Entwicklung', ergebnis: 'bestanden', dauer: '1:43', text: 'Gate grün' } });
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="1"]').click();
    const tabelle = page.locator('#durchlaeufe tbody tr');
    await expect(tabelle).toHaveCount(1);
    await expect(tabelle.first()).toContainText('Entwicklung');
    await expect(tabelle.first()).toContainText('1:43');
    await expect(tabelle.first()).toContainText('Gate grün');
    await expect(page.locator('.km')).toContainText('Entwicklung bestanden (cl, 1:43): Gate grün');
    await page.request.post(k.adresse + 'api/aufgaben/1/durchlaeufe', { ...ALS_AGENT, data: { phase: 'Code-Review', ergebnis: 'befund', text: 'Benennung' } });
    await expect(tabelle).toHaveCount(2);
    await expect(tabelle.first()).toContainText('Code-Review');
    const farben = await page.evaluate(() => {
      const befund = getComputedStyle(document.querySelector('#durchlaeufe .erg.befund')).color;
      const probe = document.createElement('span'); probe.style.color = 'var(--kd-warn)'; document.body.append(probe);
      const warn = getComputedStyle(probe).color; probe.remove();
      return { befund, warn };
    });
    expect(farben.befund).toBe(farben.warn);
  });

  test('ohne Durchläufe kein Abschnitt', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await expect(page.locator('.mod')).toBeVisible();
    await expect(page.locator('#durchlaeufe')).toHaveCount(0);
  });
});
