// R00018 Herkunft und Abhängigkeiten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const WBS = '# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0005 | Interaction | D0001 | Anlegen | gruen | |\n| I0007 | Interaction | D0001 | Bewegen | rot | I0005 |\n';
const DATEIEN = {
  'plan/wbs.md': WBS,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #2\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\norigins: [I0005]\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00018', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1 bis US-3: Herkunft setzen, Link, wartet auf', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await page.getByLabel('Neue Herkunft').fill('I0007');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0002-zwei.md')).toContain('origins: [I0007]');
    await page.keyboard.press('Escape');
    const chip = page.locator('.ka[data-id="2"] a.org', { hasText: 'I0007' });
    await expect(chip).toHaveAttribute('href', `vscode://file${require('fs').realpathSync(k.ordner)}/plan/wbs.md:6`);
    await expect(page.locator('.ka[data-id="2"] .wartet')).toHaveText('wartet auf #1');
    // auf der Karte tritt die Herkunft zurück, bis man auf sie zeigt
    const grund = () => chip.evaluate(e => getComputedStyle(e).backgroundColor);
    expect(await grund()).toBe('rgba(0, 0, 0, 0)');
    await chip.hover();
    await expect.poll(grund).not.toBe('rgba(0, 0, 0, 0)');
    await page.mouse.move(0, 0);
    // „wartet auf“ steht über der untersten Zeile, mit etwas Abstand unter dem Titel
    const [titel, wartet, unten] = await Promise.all(['.t', '.wartet', '.r3'].map(s => page.locator(`.ka[data-id="2"] ${s}`).boundingBox()));
    expect(wartet.y + wartet.height).toBeLessThanOrEqual(unten.y + 1);
    expect(wartet.y - (titel.y + titel.height)).toBeGreaterThanOrEqual(7);
    // erst ziehen, wenn Speichern und Live-Abgleich durch sind — sonst wird die Karte unter dem Zeiger ersetzt
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#2 geändert: Herkunft');
    await page.waitForTimeout(400);
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'));
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await expect(page.locator('.ka[data-id="2"] .wartet')).toHaveCount(0);
  });

  test('ungültige Herkunft wird gemeldet', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await page.getByLabel('Neue Herkunft').fill('X1');
    await page.keyboard.press('Enter');
    await expect(page.locator('.mod-fuss .fehl')).toContainText('„X1“ ist keine Herkunft');
  });
});
