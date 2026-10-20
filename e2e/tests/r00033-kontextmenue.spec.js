// R00033 Kontextmenü der Karte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'boards/test.md': '# Test\n\n## Bereit\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
};

test.describe('R00033', () => {
  let k;
  test.beforeEach(async ({ page, context }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Rechtsklick, Untermenü, verschieben, Klasse', async ({ page }) => {
    await page.goto(k.adresse);
    // im Ruhezustand zeigt die Karte die Zeigefinger-Hand, nicht die Greifhand
    expect(await page.locator('.ka[data-id="1"]').evaluate(e => getComputedStyle(e).cursor)).toBe('pointer');
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    const menue = page.getByRole('menu', { name: '#1 eins' });
    await expect(menue).toBeVisible();
    await expect(menue.getByRole('menuitem', { name: /Timer starten/ })).toContainText('t');
    await menue.getByRole('menuitem', { name: /Verschieben nach/ }).hover();
    await menue.getByRole('menuitem', { name: 'Erledigt' }).click();
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Klasse/ }).click();
    // Untermenü lesbar: dunkle Schrift auf hellem Grund, nicht die weiße Schrift des markierten Eintrags
    const fehler = page.getByRole('menuitem', { name: 'Fehler' });
    const ux = page.locator('.kmenue.unter .km-e:not(.an)', { hasText: 'Funktion' });
    const [schrift, grund] = await ux.evaluate(e => [getComputedStyle(e).color, getComputedStyle(e).backgroundColor]);
    expect(schrift).not.toBe('rgb(255, 255, 255)');
    expect(grund).not.toBe(await page.locator('.km-e.an').first().evaluate(e => getComputedStyle(e).backgroundColor));
    // der aktuelle Eintrag steht wie die anderen in einer Zeile
    const hoehen = await page.locator('.kmenue.unter .km-e').evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(new Set(hoehen).size).toBe(1);
    await fehler.click();
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('data-c', 'bug');
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Auf Board legen/ }).hover();
    await page.getByRole('menuitem', { name: 'Test · Bereit' }).click();
    await expect.poll(() => k.lies('boards/test.md')).toContain('[#1]');
  });

  test('US-2: Menü per Tastatur', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: '#1 eins' })).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('.km-e.an')).toContainText('Mir zuweisen');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"] .avs .pk')).toHaveText('ST');
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Shift+F10');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).toHaveCount(0);
  });

  test('US-3: neue Kürzel 3, c, a', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('3');
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="2"]')).toBeVisible();
    await expect(page.getByRole('status')).toContainText('#2 nach „Erledigt“');
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('c');
    await expect(page.getByRole('status')).toContainText('„#2 zwei“ kopiert');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#2 zwei');
    await page.locator('.ka[data-id="2"]').focus();
    await page.keyboard.press('a');
    await expect(page.locator('.ka[data-id="2"]')).toHaveCount(0);
    await expect(page.getByRole('status').getByRole('button', { name: 'rückgängig' })).toBeVisible();
  });
});

// Bug: das Neuzeichnen beim Öffnen des Menüs setzte das gescrollte Board zurück — nach links oder nur so weit, dass die Karte gerade sichtbar war
test.describe('R00033 breites Board', () => {
  const SPALTEN = Array.from({ length: 12 }, (_, i) => `Spalte ${i + 1}`);
  const KARTEN = Array.from({ length: 30 }, (_, i) => i + 1);
  const BREIT = {
    'boards/entwicklung.md': '# Entwicklung\n\n' + SPALTEN.map(s => `## ${s}\n\n${s === 'Spalte 6' ? KARTEN.map(n => `- #${n}\n`).join('') : ''}`).join('\n'),
    ...Object.fromEntries(KARTEN.map(n => [`aufgaben/${String(n).padStart(4, '0')}-k${n}.md`, `---\nid: ${n}\ntitle: k${n}\n---\n`])),
  };
  const rollen = page => page.evaluate(() => ({ links: document.querySelector('.bahnen').scrollLeft, oben: document.querySelector('.bahn[data-col="Spalte 6"] .flaeche').scrollTop }));
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(BREIT));
    await alsPerson(page, 'st');
    await page.setViewportSize({ width: 800, height: 600 });
    await page.goto(k.adresse);
    // Spalte 6 steht am linken Rand, Karte 15 oben in ihrer Spalte
    await page.locator('.bahnen').evaluate(b => { b.scrollLeft = b.querySelector('.bahn[data-col="Spalte 6"]').offsetLeft - b.offsetLeft; });
    await page.locator('.bahn[data-col="Spalte 6"] .flaeche').evaluate(f => { f.scrollTop = f.querySelector('.ka[data-id="15"]').offsetTop - f.offsetTop; });
  });
  test.afterEach(() => k.stoppen());

  test('Rechtsklick auf eine Karte lässt die Scrollposition stehen, Karte und Menü liegen beieinander', async ({ page }) => {
    const vorher = await rollen(page);
    expect(vorher.links).toBeGreaterThan(0);
    expect(vorher.oben).toBeGreaterThan(0);
    const karte = page.locator('.ka[data-id="15"]');
    const kasten = await karte.boundingBox();
    await karte.click({ button: 'right', position: { x: 10, y: 10 } });
    await expect(page.getByRole('menu', { name: '#15 k15' })).toBeVisible();
    expect(await rollen(page)).toEqual(vorher);
    expect(await karte.boundingBox()).toEqual(kasten);
    // Überfahren eines Eintrags zeichnet ebenfalls neu
    await page.getByRole('menuitem', { name: /Verschieben nach/ }).hover();
    expect(await rollen(page)).toEqual(vorher);
  });

  test('Rechtsklick auf einen Spaltenkopf lässt die Scrollposition stehen', async ({ page }) => {
    const vorher = await rollen(page);
    await page.locator('.bahn[data-col="Spalte 7"] .bahn-kopf').click({ button: 'right' });
    await expect(page.getByRole('menu', { name: 'Spalte „Spalte 7“' })).toBeVisible();
    expect(await rollen(page)).toEqual(vorher);
  });
});
