// R00084 Zeitpunkte mit Zeitzone
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## Erledigt\n',
  'aufgaben/0001-umstellung.md': '---\nid: 1\ntitle: Umstellung\n---\n```kanbanD-time\n2026-10-25 02:33+02:00 · 2026-10-25 02:10+01:00 · st\n```\n',
  'aufgaben/0002-alt.md': '---\nid: 2\ntitle: Alt\n---\n```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 10:42 · st\n```\n',
};

test.describe('R00084', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Eintrag über die Zeitumstellung', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('tr[data-zeit="0"]')).toContainText('02:33–02:10');
    await expect(page.locator('tr[data-zeit="0"]')).not.toContainText('+0');
    await expect(page.locator('#zeitsumme')).toContainText('0:37');
  });

  test('US-2: neuer Timer trägt den Versatz', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await page.getByRole('button', { name: '▶ Meinen Timer starten' }).click();
    await expect.poll(() => k.lies('aufgaben/0002-alt.md')).toMatch(/\n\d{4}-\d\d-\d\d \d\d:\d\d\+0[12]:00 · \.\.\. · st\n/);
    await expect(page.locator('.tz[data-timer="st"] b')).toHaveText(/^0:00:0\d$/);
    await expect(page.locator('.tz[data-timer="st"]')).not.toContainText('+0');
  });

  test('US-3: Altbestand bleibt lesbar', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await expect(page.locator('tr[data-zeit="0"]')).toContainText('09:00–10:42');
    await expect(page.locator('#zeitsumme')).toContainText('1:42');
    expect(k.lies('aufgaben/0002-alt.md')).toContain('2026-10-18 09:00 · 2026-10-18 10:42 · st\n');
  });
});
