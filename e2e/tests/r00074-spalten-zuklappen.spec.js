// R00074 Spalten zusammenklappen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const BOARD = '---\nlimits:\n  In Arbeit: 1\n---\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-a1.md)\n\n## In Arbeit\n\n- [#2](../aufgaben/0002-a2.md)\n- [#3](../aufgaben/0003-a3.md)\n\n## Erledigt\n\n- [#4](../aufgaben/0004-a4.md)\n';
const aufgaben = Object.fromEntries([1, 2, 3, 4].map(n => [`aufgaben/000${n}-a${n}.md`, `---\nid: ${n}\ntitle: a${n}\n---\n`]));

test.describe('R00074', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': BOARD, ...aufgaben }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
  });
  test.afterEach(() => k.stoppen());
  const bahn = (page, name) => page.locator(`.bahn[data-col="${name}"]`);

  test('US-1 und US-3: zuklappen, bleibt nach dem Neuladen, aufklappen; Datei unverändert', async ({ page }) => {
    const datei = k.lies('boards/entwicklung.md');
    const erledigt = bahn(page, 'Erledigt');
    await expect(erledigt.locator('.ka')).toHaveCount(1);
    const breit = (await erledigt.boundingBox()).width;
    await page.getByRole('button', { name: 'Erledigt zuklappen' }).click();
    await expect(erledigt).toHaveClass(/\bzu\b/);
    await expect(erledigt.locator('.ka')).toHaveCount(0);
    await expect(erledigt.locator('.bahn-kopf')).toHaveText('1');
    const streifen = erledigt.getByRole('button', { name: 'Erledigt aufklappen' });
    await expect(streifen).toHaveText('Erledigt');
    expect(await streifen.locator('.zu-name').evaluate(e => getComputedStyle(e).writingMode)).toBe('vertical-rl');
    expect((await erledigt.boundingBox()).width).toBeLessThan(breit / 4);
    await expect(bahn(page, 'In Arbeit').locator('.ka')).toHaveCount(2);
    await page.reload();
    await expect(bahn(page, 'Erledigt')).toHaveClass(/\bzu\b/);
    expect(k.lies('boards/entwicklung.md')).toBe(datei);
    await page.getByRole('button', { name: 'Erledigt aufklappen' }).click();
    await expect(bahn(page, 'Erledigt')).not.toHaveClass(/\bzu\b/);
    await expect(bahn(page, 'Erledigt').locator('.ka')).toHaveCount(1);
    await expect(bahn(page, 'Erledigt').locator('.bahn-kopf')).toContainText('Erledigt');
  });

  test('US-2: Grenze überschritten macht die Zahl rot; Karte auf den Streifen ziehen', async ({ page }) => {
    await page.getByRole('button', { name: 'In Arbeit zuklappen' }).click();
    const kopf = bahn(page, 'In Arbeit').locator('.bahn-kopf');
    await expect(kopf).toHaveText('2');
    await expect(kopf).toHaveClass(/\bueber\b/);
    await expect(bahn(page, 'In Arbeit').getByRole('button', { name: 'In Arbeit aufklappen' })).toHaveAttribute('title', /Grenze 1 · überschritten/);
    await page.locator('.ka[data-id="1"]').dragTo(bahn(page, 'In Arbeit').locator('.zu-streifen'));
    await expect(kopf).toHaveText('3');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/## In Arbeit\n\n- \[#2\][^\n]*\n- \[#3\][^\n]*\n- \[#1\]/);
  });
});
