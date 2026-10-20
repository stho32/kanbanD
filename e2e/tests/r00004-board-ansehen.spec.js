// R00004 Board ansehen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-erste.md)\n- [#2](../aufgaben/0002-zweite.md)\n- #9\n\n## In Arbeit\n\n- [#3](../aufgaben/0003-dritte.md)\n\n## Erledigt\n',
  'aufgaben/0001-erste.md': '---\nid: 1\ntitle: Erste Aufgabe\n---\n- [x] a\n- [ ] b\n- [ ] c\n',
  'aufgaben/0002-zweite.md': '---\nid: 2\ntitle: Zweite Aufgabe\nclass: bug\nassignees: [st]\ndue: 2030-01-31\norigins: [I0004]\n---\n',
  'aufgaben/0003-dritte.md': '---\nid: 3\ntitle: Dritte Aufgabe\nlabels: [ui]\n---\n',
  'aufgaben/0004-archiv.md': '---\nid: 4\ntitle: Archiviert\narchived: 2026-10-01\n---\n',
};

test.describe('R00004', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  test('US-1: Karten in ihren Spalten und in Zeilenreihenfolge', async ({ page }) => {
    await page.goto(k.adresse);
    const zu = page.locator('.bahn').nth(0), arbeit = page.locator('.bahn').nth(1);
    await expect(zu.locator('.ka:not(.fehlt) .id')).toHaveText(['#1', '#2']);
    await expect(arbeit.locator('.ka .id')).toHaveText(['#3']);
    await expect(zu.locator('.bahn-kopf .n')).toHaveText('3');
    await expect(page.locator('.bahn').nth(2).locator('.leer')).toBeVisible();
    await expect(page.locator('.ka', { hasText: 'Archiviert' })).toHaveCount(0);
  });

  test('US-2: Klasse, Zuständige, Fälligkeit und Teilaufgaben auf der Karte', async ({ page }) => {
    await page.goto(k.adresse);
    const zwei = page.locator('.ka[data-id="2"]');
    // die Klasse zeigt sich allein in der Farbe der Karte, ohne eigene Einblendung
    await expect(zwei).toHaveAttribute('data-c', 'bug');
    await expect(zwei.locator('.cls')).toHaveCount(0);
    const [mit, ohne] = await Promise.all([zwei, page.locator('.ka[data-id="3"]')].map(l => l.evaluate(k => getComputedStyle(k).backgroundColor)));
    expect(mit).not.toBe(ohne);
    await expect(zwei.locator('.pk')).toHaveText('ST');
    await expect(zwei.locator('.due')).toHaveText('2030-01-31');
    await expect(zwei.locator('.org')).toHaveText('I0004');
    await expect(page.locator('.ka[data-id="1"] .tk')).toHaveText('☑ 1/3');
    await expect(page.locator('.ka[data-id="3"] .lbl')).toHaveText('ui');
  });

  test('Kopfzeile: oben links erst die Nummer, dann der Titel; alles andere darunter', async ({ page }) => {
    await page.goto(k.adresse);
    const zwei = page.locator('.ka[data-id="2"]');
    const [karte, id, titel, herkunft] = await Promise.all([zwei, zwei.locator('.id'), zwei.locator('.t'), zwei.locator('.org')].map(l => l.boundingBox()));
    expect(id.x - karte.x).toBeLessThan(16);
    expect(id.y - karte.y).toBeLessThan(16);
    expect(Math.abs(id.y - titel.y)).toBeLessThan(6);
    expect(titel.x).toBeGreaterThan(id.x + id.width - 1);
    expect(herkunft.y).toBeGreaterThanOrEqual(titel.y + titel.height - 1);
  });

  test('Unterste Zeile: Fälligkeit, Herkunft und Zuständige rechtsbündig, kein Startknopf', async ({ page }) => {
    await page.goto(k.adresse);
    const zwei = page.locator('.ka[data-id="2"]');
    await zwei.hover();
    await expect(zwei.getByRole('button', { name: 'Timer an #2 starten' })).toHaveCount(0);
    const [karte, herkunft, person] = await Promise.all([zwei, zwei.locator('.org'), zwei.locator('.avs .pk')].map(l => l.boundingBox()));
    const mitte = b => b.y + b.height / 2;
    expect(Math.abs(mitte(herkunft) - mitte(person))).toBeLessThan(4);
    expect(herkunft.x - karte.x).toBeGreaterThan(24); // links bleibt Platz, die Gruppe steht rechts
    expect(herkunft.x + herkunft.width).toBeLessThanOrEqual(person.x);
    expect(karte.x + karte.width - (person.x + person.width)).toBeLessThan(16);
    expect(karte.y + karte.height - (person.y + person.height)).toBeLessThan(16);
  });

  test('US-3: fehlende Aufgabe als Platzhalter', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.locator('.ka.fehlt')).toHaveText(/#9 — Aufgabe fehlt/);
  });
});
