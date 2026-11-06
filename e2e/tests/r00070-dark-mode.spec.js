// R00070 Dark-Mode
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, mehrOeffnen, kontrastAm, leuchtdichte } = require('./hilfen');

const DATEIEN = {
  'kanbanD.md': '---\npeople:\n  st: {name: Stefan, kind: human}\nclasses:\n  bug: {label: Fehler, color: red}\n  eigen: {label: Eigen, color: "#3366ff"}\n---\n',
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nclass: bug\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\nclass: eigen\n---\n',
};

const grund = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

test.describe('R00070', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: folgt dem System, Karten bleiben lesbar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(k.adresse);
    await expect(page.locator('.ka')).toHaveCount(3);
    const hell = await grund(page);
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect.poll(() => grund(page)).not.toBe(hell);
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('data-c', 'bug');
    await expect(page.locator('.ka[data-id="3"]')).toHaveAttribute('data-c', 'eigen');
    const karte = await page.locator('.ka[data-id="2"]').evaluate(e => getComputedStyle(e).backgroundColor);
    expect(await leuchtdichte(page, karte), 'Karte ohne Klasse ist dunkel').toBeLessThan(0.1);
    for (const nr of [1, 2, 3]) {
      expect(await kontrastAm(page.locator(`.ka[data-id="${nr}"] .t`)), `Karte #${nr}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('US-2: Knopf wechselt System → Hell → Dunkel → System, Wahl überlebt Neuladen', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(k.adresse);
    await mehrOeffnen(page);
    const knopf = page.locator('#t-thema');
    await expect(knopf).toHaveAttribute('aria-label', 'Darstellung: System');
    const hell = await grund(page);
    await knopf.click();
    await expect(page.locator('#t-thema')).toHaveAttribute('aria-label', 'Darstellung: Hell');
    await page.emulateMedia({ colorScheme: 'dark' });
    expect(await grund(page), 'Hell gilt auch bei dunklem System').toBe(hell);
    await page.locator('#t-thema').click();
    await expect(page.locator('#t-thema')).toHaveAttribute('aria-label', 'Darstellung: Dunkel');
    await page.emulateMedia({ colorScheme: 'light' });
    const dunkel = await grund(page);
    expect(dunkel, 'Dunkel gilt auch bei hellem System').not.toBe(hell);
    await page.reload();
    await mehrOeffnen(page);
    await expect(page.locator('#t-thema')).toHaveAttribute('aria-label', 'Darstellung: Dunkel');
    expect(await grund(page)).toBe(dunkel);
    await page.locator('#t-thema').click();
    await expect(page.locator('#t-thema')).toHaveAttribute('aria-label', 'Darstellung: System');
    expect(await grund(page)).toBe(hell);
  });
});
