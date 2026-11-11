// R00128 Board umbenennen, archivieren und löschen in der Oberfläche (I0119, #35)
// Artboard D0002 #board-verwalten (PO-freigegeben); Server F0103 in tests/boards.rs.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

// Boards „Entwicklung“ (aus einrichten) und „Test“ mit der Karte #7.
const BESTAND = {
  'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n\n- [#7](../aufgaben/0007-sieben.md)\n',
  'aufgaben/0007-sieben.md': '---\nid: 7\ntitle: sieben\n---\n',
};

const heute = () => new Date().toLocaleDateString('de-DE');
const isoHeute = () => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const status = page => page.locator('.toast[role="status"]');

test.describe('R00128', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(BESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
  });
  test.afterEach(async () => { await k.stoppen(); });

  const pop = page => page.locator('#pop[aria-label="Boards"]');
  const ausloeser = (page, titel) => pop(page).getByRole('button', { name: `Aktionen für Board ‚${titel}‘` });
  const oeffnenMenue = async (page, slug) => {
    if (await pop(page).count() === 0) await page.locator('#t-board').click();
    await pop(page).locator(`[data-act="board-menue"][data-arg="${slug}"]`).click();
  };
  const bestaetigen = async (page, text, meldung) => {
    await page.getByRole('alertdialog').getByRole('button', { name: text }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(status(page)).toContainText(meldung);
  };
  const archivieren = async (page, slug, titel) => {
    await oeffnenMenue(page, slug);
    await pop(page).getByRole('menuitem', { name: 'Archivieren' }).click();
    await bestaetigen(page, 'Archivieren', `Board ‚${titel}‘ archiviert`);
  };
  const loeschen = async (page, slug, titel) => {
    await oeffnenMenue(page, slug);
    await pop(page).getByRole('menuitem', { name: 'Löschen' }).click();
    await bestaetigen(page, 'endgültig löschen', `Board ‚${titel}‘ endgültig gelöscht`);
  };

  test('US-9/AK10: jede Board-Zeile traegt einen eigenen ⋮-Ausloeser mit Menue', async ({ page }) => {
    await page.locator('#t-board').click();
    for (const titel of ['Entwicklung', 'Test']) {
      await expect(ausloeser(page, titel)).toHaveAttribute('aria-haspopup', 'menu');
    }
    await ausloeser(page, 'Test').click();
    const menue = pop(page).getByRole('menu', { name: 'Aktionen für Board ‚Test‘' });
    await expect(menue).toBeVisible();
    await expect(menue.getByRole('menuitem')).toHaveText(['Umbenennen', 'Archivieren', 'Löschen']);
    // „Löschen“ ist in --kd-warn abgesetzt (S1)
    const farbe = await menue.getByRole('menuitem', { name: 'Löschen' }).evaluate(el => getComputedStyle(el).color);
    const warn = await page.evaluate(() => { const s = getComputedStyle(document.documentElement).getPropertyValue('--kd-warn').trim(); const d = document.createElement('span'); d.style.color = s; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    expect(farbe).toBe(warn);
    // kein Knopf im Knopf: der Zeilenname wechselt weiter
    await pop(page).locator('[data-act="board-wahl"][data-arg="test"]').click();
    await expect(page.locator('#t-board')).toContainText('Test');
  });

  test('US-1/AK1: Umbenennen aendert den Titel, der Slug bleibt', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = page.getByLabel('Neuer Name für Board ‚Entwicklung‘');
    await expect(feld).toHaveValue('Entwicklung');
    await expect(feld).toBeFocused();
    await feld.fill('Entwicklung 2026');
    await feld.press('Enter');
    await expect(page.locator('#t-board')).toContainText('Entwicklung 2026');
    expect(page.url()).toMatch(/#\/board\/entwicklung$/);
    expect(() => k.lies('boards/entwicklung-2026.md')).toThrow();
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung 2026\n');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|Board „Entwicklung 2026“ umbenannt');
    expect(k.git('log', '-1', '--format=%s')).toBe('Board „Entwicklung 2026“ umbenannt');
  });

  test('US-11/AK11: leerer Titel zeigt den Feldfehler, das Feld bleibt offen', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = page.getByLabel('Neuer Name für Board ‚Entwicklung‘');
    await feld.fill('');
    await feld.press('Enter');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(feld).toBeVisible();
    // Esc verwirft ohne Schreiben
    await feld.press('Escape');
    await expect(page.getByLabel('Neuer Name für Board ‚Entwicklung‘')).toHaveCount(0);
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung\n');
  });

  test('US-2/US-10/AK12: Archivieren nimmt aus der Liste in den Abschnitt ARCHIVIERT', async ({ page }) => {
    // der Dialog fragt nach (Name, Startfokus Abbrechen)
    await oeffnenMenue(page, 'test');
    await pop(page).getByRole('menuitem', { name: 'Archivieren' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveAccessibleName('Test archivieren');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Archivieren' }).click();
    await expect(status(page)).toContainText('Board ‚Test‘ archiviert');
    // aus der offenen Liste, im Abschnitt
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="test"]')).toHaveCount(0);
    await expect(pop(page).locator('details.barch summary')).toHaveText(/ARCHIVIERT \(1\)/);
    await pop(page).locator('details.barch summary').click();
    const eintrag = pop(page).locator('.barchz');
    await expect(eintrag).toContainText('Test');
    await expect(eintrag).toContainText(`archiviert am ${heute()}`);
    expect(k.lies('boards/test.md')).toContain('archived: ' + isoHeute());
  });

  test('US-3/AK3: wieder oeffnen holt das Board zurueck', async ({ page }) => {
    await archivieren(page, 'test', 'Test');
    await pop(page).locator('details.barch summary').click();
    await pop(page).getByRole('button', { name: 'wieder öffnen' }).click();
    await expect(status(page)).toContainText('Board ‚Test‘ wieder geöffnet');
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="test"]')).toHaveCount(1);
    expect(k.lies('boards/test.md')).not.toContain('archived');
  });

  test('US-4/US-8/AK8/16: Loeschen mit Bestaetigungsdialog, kein Undo', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await oeffnenMenue(page, 'test');
    await pop(page).getByRole('menuitem', { name: 'Löschen' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveAccessibleName('Test endgültig löschen');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('button')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await expect(dialog).toContainText('Die Board-Datei boards/test.md wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte.');
    // ≤ min(360px, 100% − 32px) und 320 px ohne Querscrollen
    const breite = await dialog.evaluate(el => el.getBoundingClientRect().width);
    expect(breite).toBeLessThanOrEqual(Math.min(360, 320 - 32) + 0.5);
    const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(quer).toBeLessThanOrEqual(1);
    // Esc schließt ohne Schreiben; der Fokus kehrt an den Auslöser zurück
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.locator('[data-act="board-menue"][data-arg="test"]')).toBeFocused();
    expect(k.lies('boards/test.md')).toContain('# Test');
    // bestätigen
    await loeschen(page, 'test', 'Test');
    await expect(status(page).getByRole('button', { name: /rückgängig/i })).toHaveCount(0);
    expect(() => k.lies('boards/test.md')).toThrow();
    const aufgaben = await (await page.request.get(k.adresse + 'api/aufgaben')).json();
    expect(aufgaben.aufgaben.some(a => a.nummer === 7)).toBe(true);
    expect(k.git('log', '-1', '--format=%s')).toBe('Board „Test“ endgültig gelöscht');
  });

  test('AK13/M6: Fokus faellt nach dem Verschwinden des offenen Boards nicht auf BODY', async ({ page }) => {
    await page.locator('#t-board').click();
    await pop(page).locator('[data-act="board-wahl"][data-arg="test"]').click();
    await expect(page.locator('#t-board')).toContainText('Test');
    await archivieren(page, 'test', 'Test');
    await expect(page.locator('#t-board')).toContainText('Entwicklung');
    const rolle = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(rolle).not.toBe('BODY');
  });

  test('AK7/M7: das letzte Board darf weg — Leerzustand mit Weg', async ({ page }) => {
    await loeschen(page, 'test', 'Test');
    await loeschen(page, 'entwicklung', 'Entwicklung');
    await expect(page.getByText('Kein Board · neues anlegen')).toBeVisible();
    await expect(page.locator('#board-neu-leer')).toBeVisible();
    // ein neues entsteht mit POST /api/boards
    await page.locator('#board-neu-leer').fill('Release');
    await page.locator('#board-neu-leer').press('Enter');
    await expect(page.locator('#t-board')).toContainText('Release');
  });
});
