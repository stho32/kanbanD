// R00027 Mehrere Aufgaben auf einmal anlegen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

/** Fügt Text ein wie aus der Zwischenablage (ClipboardEvent mit DataTransfer). */
async function einfuegen(page, selektor, text) {
  await page.locator(selektor).evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData('text/plain', t);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

test.describe('R00027', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' }));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Liste in eine Spalte einfügen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.bahn[data-col="In Arbeit"]').getByRole('button', { name: '+ Karte' }).click();
    await einfuegen(page, '#add-inp', '- Login\n- Logout\n- Passwort vergessen');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka .t')).toHaveText(['Login', 'Logout', 'Passwort vergessen']);
    await expect(page.getByRole('status')).toContainText('3 Aufgaben angelegt');
    expect(k.git('log', '-1', '--format=%s')).toBe('#2–#4 angelegt (3 Aufgaben) in „In Arbeit“ (Entwicklung)');
    await expect(page.locator('#add-inp')).toBeFocused();
  });

  test('US-2: Teilaufgaben einfügen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await einfuegen(page, '#teil-neu', '1. a\n2. b\n3. c');
    await expect(page.locator('.chk')).toHaveCount(3);
    await expect(page.locator('.ka[data-id="1"] .tk')).toHaveText('☑ 0/3');
  });

  test('US-3: Aufgaben ohne Board einfügen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await einfuegen(page, '#liste-neu', 'x\ny');
    await page.getByRole('radio', { name: /ohne Board/ }).click();
    await expect(page.locator('tr[data-zeile] .tt')).toHaveText(['x', 'y']);
  });
});
