// R00106 Nacharbeit (Karte #8, architektur-reviewer M1): auch das Menü „Auf Board legen“ (das Menü „Status“ der WBS-Sicht entfiel mit R00222)
// führen den echten DOM-Fokus — Enter öffnet auf dem ersten Eintrag, ↓ und Ende bewegen ihn, Esc gibt ihn dem Auslöser zurück.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

/** Fokus per Tastatur auf den Auslöser, Enter; danach Erster, ↓ Zweiter, Ende Letzter, Esc zurück auf den Auslöser. */
async function menueFuehrtDenFokus(page, ausloeser, eintraege) {
  await page.locator(ausloeser).focus();
  await page.keyboard.press('Enter');
  const menue = page.locator('#pop[role="menu"]');
  await expect(menue).toBeVisible();
  await expect(page.locator(ausloeser)).toHaveAttribute('aria-expanded', 'true');
  const eintrag = menue.getByRole('menuitem');
  await expect(eintrag).toHaveText(eintraege);
  await expect(eintrag.first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(eintrag.nth(1)).toBeFocused();
  await page.keyboard.press('End');
  await expect(eintrag.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(eintrag.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  await expect(page.locator(ausloeser)).toBeFocused();
  await expect(page.locator(ausloeser)).toHaveAttribute('aria-expanded', 'false');
}

test.describe('Menü „Auf Board legen“', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n',
      'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier ohne Board\n---\n',
    }));
    await alsPerson(page, 'st');
  });
  test.afterEach(async () => { await k.stoppen(); });

  test('Enter auf „Auf Board legen“ → Fokus auf dem ersten Eintrag; ↓, Ende, Pos1; Esc → Fokus auf dem Auslöser', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await liveBereit(page);
    await menueFuehrtDenFokus(page, '#leg-4', ['Entwicklung · Zu erledigen', 'Entwicklung · In Arbeit', 'Entwicklung · Erledigt', 'Test · Bereit', 'Test · Geprüft']);
  });

  test('Enter auf einem Eintrag legt die Aufgabe auf das Board', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await liveBereit(page);
    await page.locator('#leg-4').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page.locator('tr[data-zeile="4"] .orte')).toContainText('Test · Geprüft');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  });
});

test.describe('Menünamen', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier ohne Board\n---\n' }));
    await alsPerson(page, 'st');
  });
  test.afterEach(async () => { await k.stoppen(); });

  test('„Auf Board legen“ heißt „#4 auf Board legen“', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('#leg-4').click();
    await expect(page.getByRole('menu', { name: '#4 auf Board legen', exact: true })).toBeVisible();
  });
});
