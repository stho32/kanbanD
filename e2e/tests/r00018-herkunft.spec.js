// R00018 Herkunft und Abhängigkeiten — seit R00212 (#226) ist die Herkunft Text: kein Link, kein „wartet auf“ (die WBS hat dafür keine Rolle mehr)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter, bereit } = require('./hilfen');

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

  test('US-1 bis US-3: Herkunft setzen, sie steht als Text auf der Karte — kein Link, kein „wartet auf“ trotz Braucht in der WBS', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await reiter(page, 'Details');
    await page.getByLabel('Neue Herkunft').fill('I0007');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0002-zwei.md')).toContain('origins: [I0007]');
    await page.keyboard.press('Escape');
    // Das Speichern der Herkunft lädt nach und zeichnet die Karte kurz darauf neu: Zustand prüfen, nie ein Element, das zwischen Finden und Lesen ersetzt sein kann (#188).
    const chip = page.locator('.ka[data-id="2"] .org', { hasText: 'I0007' });
    await expect(chip).toHaveCount(1);
    expect(await chip.evaluate(e => [e.tagName, e.hasAttribute('href'), e.hasAttribute('title')])).toEqual(['SPAN', false, false]);
    await expect(page.locator('.ka[data-id="2"] .wartet')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="2"]')).not.toContainText('wartet auf');
    // erst ziehen, wenn Speichern und Live-Abgleich durch sind — sonst wird die Karte unter dem Zeiger ersetzt
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#2 geändert: Herkunft');
    await bereit(page, '.ka[data-id="1"]');
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'));
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await expect(page.locator('.ka[data-id="2"] .wartet')).toHaveCount(0);
  });

  test('ungültige Herkunft wird gemeldet', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').click();
    await reiter(page, 'Details');
    await page.getByLabel('Neue Herkunft').fill('X1');
    await page.keyboard.press('Enter');
    await expect(page.locator('.mod-fuss .fehl')).toContainText('„X1“ ist keine Herkunft');
  });
});
