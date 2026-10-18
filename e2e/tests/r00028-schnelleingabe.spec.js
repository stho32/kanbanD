// R00028 Schnelleingabe mit Kürzeln
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const morgen = () => { const d = new Date(); d.setDate(d.getDate() + 1); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

test.describe('R00028', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten()); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: Vorschau und Anlegen mit Feldern', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('Login reparieren @mi class:bug due:morgen');
    await expect(page.locator('#neu-vorschau')).toContainText('→ Login reparieren');
    await expect(page.locator('#neu-vorschau')).toContainText('Mia');
    await expect(page.locator('#neu-vorschau')).toContainText('Fehler');
    await page.keyboard.press('Enter');
    const karte = page.locator('.ka[data-id="1"]');
    await expect(karte.locator('.t')).toHaveText('Login reparieren');
    await expect(karte.locator('.cls')).toHaveText('Fehler');
    await expect(karte.locator('.due')).toHaveText(morgen());
    expect(k.lies('aufgaben/0001-login-reparieren.md')).toContain('assignees: [mi]');
  });

  test('US-2: Liste mit Kürzeln', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.locator('#neu-titel').evaluate(el => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'Doku @cl label:doku\nTests @mi');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.ka .t')).toHaveText(['Doku', 'Tests']);
    await expect(page.locator('.ka[data-id="1"] .lbl')).toHaveText('doku');
    await expect(page.locator('.ka[data-id="2"] .pk')).toHaveText('MI');
  });
});
