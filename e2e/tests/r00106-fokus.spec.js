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
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n\n## Fertig\n\n- #9\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  'aufgaben/0009-kaputt.md': '---\nid: 9\n<<<<<<< HEAD\ntitle: neun\n=======\ntitle: neun anders\n>>>>>>> zweig\n---\n',
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

test('US-4: p öffnet „Zuständige“ mit Fokus auf der ersten Wahl, Tab bleibt darin, Esc → Karte #1', async ({ page }) => {
  await page.locator('.ka[data-id="1"]').focus();
  await page.keyboard.press('p');
  const dialog = page.locator('#zuweisen');
  await expect(dialog).toBeVisible();
  const name = await dialog.getAttribute('aria-label');
  expect(await page.evaluate(() => document.activeElement.closest('#zuweisen') !== null)).toBe(true);
  expect(await page.evaluate(() => document.activeElement === document.querySelector('#zuweisen [data-act="zuweisen-wahl"]'))).toBe(true);
  await tabBleibtIm(page, name, 'Tab');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect((await fokus(page)).karte).toBe('1');
});

test('US-4: defekte Datei #9: Enter → Fokus im Fenster, Tab bleibt darin, Esc → Karte #9', async ({ page }) => {
  await perTastaturOeffnen(page, 9);
  await expect(page.getByRole('dialog', { name: 'Defekte Datei #9' })).toBeVisible();
  expect((await fokus(page)).dialog).toBe('Defekte Datei #9');
  await tabBleibtIm(page, 'Defekte Datei #9', 'Tab');
  await page.keyboard.press('Escape');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
  expect((await fokus(page)).karte).toBe('9');
});

test('US-4: ? über dem Fenster: Hilfe fängt, Fenster inert, Esc schließt nur die Hilfe, Fokus wieder auf dem Fenster', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  await page.keyboard.press('?');
  const hilfe = page.locator('#hilfe');
  await expect(hilfe).toBeVisible();
  const name = await hilfe.getAttribute('aria-label');
  expect((await fokus(page)).dialog).toBe(name);
  expect(await page.evaluate(() => Boolean(document.querySelector('#fenster').closest('[inert]')))).toBe(true);
  await tabBleibtIm(page, name, 'Tab');
  await page.keyboard.press('Escape');
  await expect(hilfe).toHaveCount(0);
  expect((await fokus(page)).id).toBe('fenster');
});

test('US-5: Live-Ereignis bei offenem Fenster: Fokus bleibt im Fenster, Tab bleibt darin, Esc → Karte #1', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  const vorher = await page.evaluate(() => window.kdTest.renders());
  expect((await page.request.patch(`${k.adresse}api/aufgaben/3`, { ...ALS_PLANER, data: { titel: 'drei neu' } })).ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 1000 }).toBeGreaterThan(vorher);
  await expect(page.locator('.ka[data-id="3"]')).toContainText('drei neu');
  expect((await fokus(page)).dialog).toBe('Aufgabe #1');
  await tabBleibtIm(page, 'Aufgabe #1', 'Tab');
  await page.keyboard.press('Escape');
  expect((await fokus(page)).karte).toBe('1');
});

test('US-5: Fenster offen, #1 live nach „In Arbeit“ verschoben, Esc → Karte #1 in „In Arbeit“', async ({ page }) => {
  await perTastaturOeffnen(page, 1);
  expect((await page.request.post(`${k.adresse}api/boards/fabrik/bewegen`, { ...ALS_PLANER, data: { nummer: 1, spalte: 'In Arbeit' } })).ok()).toBe(true);
  await expect(page.locator('[data-col="In Arbeit"] .ka[data-id="1"]')).toHaveCount(1);
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.activeElement.matches('[data-col="In Arbeit"] .ka[data-id="1"]'))).toBe(true);
});

test('US-8: Enter auf „In Arbeit“ klappt zu, Fokus auf den Aufklapp-Knopf; Live-Ereignis hält ihn; Enter klappt auf, Fokus auf „In Arbeit“', async ({ page }) => {
  await page.locator('.bk-name[data-arg="In Arbeit"]').focus();
  await page.keyboard.press('Enter');
  const streifen = page.locator('.zu-streifen[data-arg="In Arbeit"]');
  await expect(streifen).toBeVisible();
  await expect(streifen).toBeFocused();
  const vorher = await page.evaluate(() => window.kdTest.renders());
  expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { ...ALS_PLANER, data: { titel: 'eins neu' } })).ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 1000 }).toBeGreaterThan(vorher);
  await expect(streifen).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.bk-name[data-arg="In Arbeit"]')).toBeFocused();
});

/** Index des fokussierten Eintrags unter den wählbaren Einträgen des offenen Pops, -1 außerhalb. */
const menueIndex = page => page.evaluate(() => [...document.querySelectorAll('#pop [role^="menuitem"]:not([aria-disabled="true"])')].indexOf(document.activeElement));
const menueAnzahl = page => page.locator('#pop [role^="menuitem"]:not([aria-disabled="true"])').count();

test('US-6: Enter auf „Mehr“ → aria-expanded, Fokus auf dem ersten Eintrag; ↓, ↑↑ (Umlauf), Ende, Pos1', async ({ page }) => {
  await page.locator('#t-mehr').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#t-mehr')).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.activeElement.getAttribute('role') || '')).toMatch(/^menuitem/);
  expect(await menueIndex(page)).toBe(0);
  const letzter = (await menueAnzahl(page)) - 1;
  await page.keyboard.press('ArrowDown');
  expect(await menueIndex(page)).toBe(1);
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  expect(await menueIndex(page), 'Umlauf nach oben').toBe(letzter);
  await page.keyboard.press('Home');
  expect(await menueIndex(page)).toBe(0);
  await page.keyboard.press('End');
  expect(await menueIndex(page)).toBe(letzter);
});

test('US-6: 375 px: Enter auf „Seite“ → Fokus auf „Board“, ↓ → „Aufgaben“', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator('#t-seite').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#t-seite')).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#pop [role="menuitem"]', { hasText: /^Board$/ })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#pop [role="menuitem"]', { hasText: /^Aufgaben$/ })).toBeFocused();
});

test('US-6: Enter auf „Berichte“ → aria-haspopup=menu, aria-expanded, Fokus auf „Stundenzettel“, ↓ → zweiter Eintrag', async ({ page }) => {
  await page.locator('#t-ber').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#t-ber')).toHaveAttribute('aria-haspopup', 'menu');
  await expect(page.locator('#t-ber')).toHaveAttribute('aria-expanded', 'true');
  expect(await page.evaluate(() => document.activeElement.textContent)).toContain('Stundenzettel');
  await page.keyboard.press('ArrowDown');
  expect(await menueIndex(page)).toBe(1);
});

test('US-5: Live-Ereignis bei offenem Menü „Mehr“: Fokus bleibt auf dem zweiten Eintrag', async ({ page }) => {
  await page.locator('#t-mehr').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  expect(await menueIndex(page)).toBe(1);
  const vorher = await page.evaluate(() => window.kdTest.renders());
  expect((await page.request.patch(`${k.adresse}api/aufgaben/3`, { ...ALS_PLANER, data: { titel: 'drei neu' } })).ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 1000 }).toBeGreaterThan(vorher);
  await expect(page.locator('.ka[data-id="3"]')).toContainText('drei neu');
  expect(await menueIndex(page)).toBe(1);
});

test('US-6: Menü „Mehr“: Esc → kein role=menu, Fokus auf #t-mehr mit aria-expanded=false', async ({ page }) => {
  await page.locator('#t-mehr').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('[role="menu"]')).toHaveCount(0);
  await expect(page.locator('#t-mehr')).toBeFocused();
  await expect(page.locator('#t-mehr')).toHaveAttribute('aria-expanded', 'false');
});

test('US-6: Menü „Mehr“: Tab schließt, Fokus auf dem Element nach dem Auslöser, nicht BODY', async ({ page }) => {
  const nachDemAusloeser = await page.evaluate(() => {
    const alle = [...document.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]')].filter(e => e.tabIndex >= 0 && e.getClientRects().length);
    return alle[alle.indexOf(document.querySelector('#t-mehr')) + 1].outerHTML.slice(0, 100);
  });
  await page.locator('#t-mehr').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await expect(page.locator('#pop')).toHaveCount(0);
  await expect(page.locator('#t-mehr')).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.activeElement.outerHTML.slice(0, 100))).toBe(nachDemAusloeser);
});

test('US-6: 375 px: Seite-Menü Esc → Fokus auf #t-seite mit aria-expanded=false', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.locator('#t-seite').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(page.locator('#t-seite')).toBeFocused();
  await expect(page.locator('#t-seite')).toHaveAttribute('aria-expanded', 'false');
});

test('US-6: ein Eintrag mit Aktion („Signale oben“ in „Mehr“) lässt den Fokus nie auf BODY', async ({ page }) => {
  await page.locator('#t-mehr').focus();
  await page.keyboard.press('Enter');
  await page.locator('#pop [role^="menuitem"]').first().focus();
  await page.keyboard.press('Enter');
  expect((await fokus(page)).tag).not.toBe('BODY');
});

test('US-7: Umschalt+F10 auf Karte #1 → Fokus auf „Öffnen“; ↓↓ → „Mir zuweisen“ (Trenner übersprungen); Esc → Karte #1', async ({ page }) => {
  await page.locator('.ka[data-id="1"]').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.getByRole('menu', { name: '#1 eins' })).toBeVisible();
  await expect(page.locator('#kmenue [role="menuitem"]', { hasText: 'Öffnen' }).first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#kmenue [role="menuitem"]', { hasText: 'Mir zuweisen' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#kmenue')).toHaveCount(0);
  expect((await fokus(page)).karte).toBe('1');
});

test('US-7: → öffnet „Verschieben nach“ mit Fokus auf „In Arbeit“ (nicht „Eingang“), ← zurück auf „Verschieben nach“', async ({ page }) => {
  await page.locator('.ka[data-id="1"]').focus();
  await page.keyboard.press('Shift+F10');
  const verschieben = page.locator('#kmenue > [role="menuitem"]', { hasText: 'Verschieben nach' });
  for (let i = 0; i < 12 && !(await verschieben.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
  await expect(verschieben).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#kmenue .unter [role="menuitem"]', { hasText: 'In Arbeit' })).toBeFocused();
  await expect(page.locator('#kmenue .unter [role="menuitem"]', { hasText: 'Eingang' })).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(verschieben).toBeFocused();
});

test('US-7: Enter auf „Mir zuweisen“ → ST zuständig, Menü zu, Fokus auf Karte #1', async ({ page }) => {
  await page.locator('.ka[data-id="1"]').focus();
  await page.keyboard.press('Shift+F10');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(page.locator('#kmenue')).toHaveCount(0);
  await expect.poll(async () => (await (await page.request.get(`${k.adresse}api/aufgaben/1`)).json()).zustaendige).toContain('st');
  expect((await fokus(page)).karte).toBe('1');
});
