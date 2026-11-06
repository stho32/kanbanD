// R00106 Fokus in Fenstern und Menüs führen und nach jeder Aktion halten (ADR-0010: Fokusführung über Ebenen)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  pl: {name: planer, kind: agent}
---
`;
const DATEIEN = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n\n## Fertig\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
};
const ALS_PLANER = { headers: { 'X-KanbanD-Wer': 'pl' } };

/** Beschreibung des fokussierten Elements: Tag, Rolle, Name des umgebenden Dialogs, Karte, ob inert. */
const fokus = page => page.evaluate(() => {
  const e = document.activeElement;
  const dialog = e.closest('[role="dialog"]');
  return {
    tag: e.tagName, rolle: e.getAttribute('role'), id: e.id, karte: e.dataset.id || null, zeile: e.dataset.zeile || null,
    text: (e.textContent || '').trim(), dialog: dialog ? dialog.getAttribute('aria-label') || document.getElementById(dialog.getAttribute('aria-labelledby') || '-')?.textContent : null,
    imInert: Boolean(e.closest('[inert]')), imMain: Boolean(e.closest('#main')),
  };
});

let k;
test.beforeEach(async ({ page }) => {
  k = await kanbanStarten(einrichten(DATEIEN));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/fabrik');
  await liveBereit(page);
  await expect(page.locator('.ka[data-id="3"]')).toBeVisible();
});
test.afterEach(async () => { await k.stoppen(); });

/** Fokus auf die Karte und Enter: öffnet das Aufgabenfenster über die Tastatur. */
async function perTastaturOeffnen(page, nummer) {
  await page.locator(`.ka[data-id="${nummer}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(1);
}

/** n-mal Tab (bzw. Umschalt+Tab); nach jedem Schritt muss der Fokus im Dialog `name` stehen, nie auf BODY. */
async function tabBleibtIm(page, name, taste, n = 30) {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(taste);
    const f = await fokus(page);
    expect(f.tag, `Schritt ${i + 1}`).not.toBe('BODY');
    expect(f.dialog, `Schritt ${i + 1}: ${f.tag}#${f.id}`).toBe(name);
  }
}

test('US-1: 30× Tab bleibt im Fenster #1, Umschalt+Tab ebenso; Kopf und Board sind inert, der Hintergrund schließt per Klick', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#app')).toHaveAttribute('inert', '');
  await tabBleibtIm(page, 'Aufgabe #1', 'Tab');
  await tabBleibtIm(page, 'Aufgabe #1', 'Shift+Tab');
  // Missing-Docs R00106: inert trifft nur Kopf und Board — der abgedunkelte Hintergrund des Fensters bleibt klickbar
  await page.locator('.mod-bg').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
  await expect(page.locator('[inert]')).toHaveCount(0);
});

test('US-1: das letzte tabbare Element läuft zum ersten um, das erste rückwärts zum letzten', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  const tabbar = '#over [role="dialog"] :is(a[href], button, input, select, textarea, [tabindex]):not([tabindex="-1"]):not([disabled]) >> visible=true';
  const merkmal = () => page.evaluate(() => document.activeElement.outerHTML.slice(0, 120));
  await page.locator(tabbar).first().focus();
  const erstes = await merkmal();
  await page.locator(tabbar).last().focus();
  const letztes = await merkmal();
  expect(erstes).not.toBe(letztes);
  await page.keyboard.press('Tab');
  expect(await merkmal(), 'vom letzten vorwärts zum ersten').toBe(erstes);
  await page.keyboard.press('Shift+Tab');
  expect(await merkmal(), 'vom ersten rückwärts zum letzten').toBe(letztes);
});


test('US-1: Enter auf Karte #1 fokussiert den Dialog selbst; d zeigt sofort „Datei“, im Titelfeld wird d getippt', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  const f = await fokus(page);
  expect(f.rolle).toBe('dialog');
  expect(f.dialog).toBe('Aufgabe #1');
  await page.keyboard.press('d');
  await expect(page.getByRole('tab', { name: 'Datei' })).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('Escape');
  await perTastaturOeffnen(page, 1);
  await page.locator('[data-af="titel"]').focus();
  await page.keyboard.press('End');
  await page.keyboard.press('d');
  await expect(page.locator('[data-af="titel"]')).toHaveValue('einsd');
});

test('US-1: Esc → Fokus auf Karte #1, nichts mehr inert', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
  expect((await fokus(page)).karte).toBe('1');
  await expect(page.locator('[inert]')).toHaveCount(0);
});

test('US-2: ↓ blättert zu #2, Esc → Fokus auf Karte #2', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
  expect((await fokus(page)).karte).toBe('2');
});

test('US-2: aus der Aufgabenliste: Enter auf Zeile #3, Esc → Fokus auf tr[data-zeile="3"]', async ({ page }) => {
  await page.goto(k.adresse + '#/aufgaben');
  await page.locator('tr[data-zeile="3"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Aufgabe #3' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
  expect((await fokus(page)).zeile).toBe('3');
});

test('US-3: „Neue Aufgabe“ hält den Fokus im Fenster, Esc gibt ihn dem Auslöser zurück; Leerfall n aus BODY → Fokus im #main', async ({ page }) => {
  const knopf = page.locator('#kopf [data-act="add"]').first();
  await knopf.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeVisible();
  await tabBleibtIm(page, 'Neue Aufgabe', 'Tab', 12);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toHaveCount(0);
  expect(await page.evaluate(() => document.activeElement.dataset.act)).toBe('add');
  await page.evaluate(() => document.activeElement.blur());
  await page.keyboard.press('n');
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toHaveCount(0);
  const f = await fokus(page);
  expect(f.imMain || f.id === 'main', `${f.tag}#${f.id}`).toBe(true);
});
