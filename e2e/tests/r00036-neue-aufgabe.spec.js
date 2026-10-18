// R00036 Neue Aufgabe im Dialog
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

test.describe('R00036', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: n öffnet den Dialog in der Spalte der Karte, alle Felder', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('n');
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await expect(dialog).toContainText('Entwicklung · In Arbeit');
    await page.getByLabel('Titel der neuen Aufgabe').fill('Login reparieren');
    await dialog.getByLabel('Klasse').selectOption('bug');
    await dialog.locator('.as', { hasText: 'Mia' }).click();
    await dialog.locator('.as', { hasText: 'Stefan' }).click();
    await page.getByLabel('Neue Teilaufgabe der neuen Aufgabe').fill('Fall nachstellen');
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Neue Teilaufgabe der neuen Aufgabe')).toBeFocused();
    await page.keyboard.type('Test schreiben');
    await page.keyboard.press('Enter');
    await page.getByLabel('Beschreibung der neuen Aufgabe').fill('Nach dem Abmelden');
    await page.keyboard.press('Control+Enter');
    await expect(dialog).toHaveCount(0);
    const karte = page.locator('.ka[data-id="2"]');
    await expect(karte).toBeVisible();
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka[data-id="2"]')).toBeVisible();
    expect(k.lies('aufgaben/0002-login-reparieren.md')).toBe('---\nid: 2\ntitle: Login reparieren\nclass: bug\nassignees: [mi]\n---\n\nNach dem Abmelden\n\n- [ ] Fall nachstellen\n- [ ] Test schreiben\n');
    expect(k.git('log', '-1', '--format=%s')).toBe('#2 „Login reparieren“ angelegt in „In Arbeit“ (Entwicklung)');
  });

  test('US-2: Anlegen und weitere behält Spalte und Klasse', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: '+ Neue Aufgabe' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await expect(dialog).toContainText('Entwicklung · Zu erledigen');
    await dialog.getByLabel('Klasse').selectOption('feature');
    await page.getByLabel('Titel der neuen Aufgabe').fill('A');
    await dialog.getByRole('button', { name: 'Anlegen und weitere' }).click();
    await expect(page.getByLabel('Titel der neuen Aufgabe')).toHaveValue('');
    await expect(dialog.getByLabel('Klasse')).toHaveValue('feature');
    await page.getByLabel('Titel der neuen Aufgabe').fill('B');
    await page.keyboard.press('Control+Shift+Enter');
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .t')).toHaveText(['A', 'B']);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .cls')).toHaveText(['Funktion', 'Funktion']);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('US-3: kein + Karte mehr, + im Spaltenkopf, Esc legt nichts an, Liste mit Feldern', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.getByRole('button', { name: '+ Karte' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Neue Aufgabe in Erledigt' }).click();
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toContainText('Entwicklung · Erledigt');
    await page.getByLabel('Titel der neuen Aufgabe').fill('nicht anlegen');
    await page.keyboard.press('Escape');
    expect(require('fs').existsSync(k.ordner + '/aufgaben/0002-nicht-anlegen.md')).toBe(false);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByRole('dialog').getByLabel('Klasse').selectOption('bug');
    await page.locator('#neu-titel').evaluate(el => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'x\ny');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .cls')).toHaveText(['Fehler', 'Fehler']);
  });
});
