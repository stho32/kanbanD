// R00106 Nacharbeit (Karte #8, architektur-reviewer M1): auch die Menüs „Auf Board legen“ und „Status“ der WBS-Sicht
// führen den echten DOM-Fokus — Enter öffnet auf dem ersten Eintrag, ↓ und Ende bewegen ihn, Esc gibt ihn dem Auslöser zurück.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

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

test.describe('Menü „Status“ der WBS-Sicht', () => {
  let k, arbeit;
  test.beforeEach(async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([
      zeile('A0001', 'Application', '—', 'kanbanD', 'gelb'),
      zeile('D0001', 'Dialog', 'A0001', 'Board', 'gelb'),
      zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'gelb', { fertig: 'US-1' }),
      zeile('B0001', 'Bubble', 'I0001', 'Board lesen', 'gruen', { ea: 'Datei → Board', aufwand: '0,5-1' }),
      zeile('B0002', 'Bubble', 'I0001', 'Board zeigen', 'rot', { ea: 'Board → HTML', aufwand: '1-2' }),
    ]));
    k = await kanbanStarten(mitRegister(arbeit));
    await alsPerson(page, 'st');
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('Enter auf den Status von B0002 → Fokus auf „rot“; ↓, Ende, Pos1; Esc → Fokus auf dem Auslöser', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    await menueFuehrtDenFokus(page, '#wbs-st-B0002', [/^rot/, /^gelb/, /^gruen/]);
  });
});
