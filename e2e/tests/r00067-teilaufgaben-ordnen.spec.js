// R00067 Teilaufgaben per Ziehen ordnen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = { 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n- [ ] a\n- [ ] b\n- [ ] c\n' };

test.describe('R00067', () => {
  let k;
  const teil = (page, t) => page.getByRole('dialog').locator('.chk', { has: page.locator('span', { hasText: new RegExp(`^${t}$`) }) });
  const reihenfolge = page => page.getByRole('dialog').locator('.chk span');
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
  });
  test.afterEach(() => k.stoppen());

  test('US-1: nach vorn ziehen, die Karte zeigt die neue erste', async ({ page }) => {
    await teil(page, 'c').dragTo(teil(page, 'a'), { targetPosition: { x: 40, y: 3 } });
    await expect(reihenfolge(page)).toHaveText(['c', 'a', 'b']);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [ ] c\n- [ ] a\n- [ ] b\n');
    await expect(page.locator('.ka[data-id="1"] .naechste span')).toHaveText('c');
  });

  test('US-2: ans Ende ziehen', async ({ page }) => {
    const c = await teil(page, 'c').boundingBox();
    await teil(page, 'a').dragTo(teil(page, 'c'), { targetPosition: { x: 40, y: c.height - 3 } });
    await expect(reihenfolge(page)).toHaveText(['b', 'c', 'a']);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [ ] b\n- [ ] c\n- [ ] a\n');
  });
});
