// R00006 Aufgabe bewegen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
};

test.describe('R00006', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: in eine andere Spalte ziehen ändert nur die Board-Datei', async ({ page }) => {
    await page.goto(k.adresse);
    const aufgabe = k.lies('aufgaben/0001-eins.md');
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka .id')).toHaveText(['#1']);
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 nach „In Arbeit“ (Entwicklung)');
    expect(k.git('show', '--name-only', '--format=', 'HEAD')).toBe('boards/entwicklung.md');
    expect(k.lies('aufgaben/0001-eins.md')).toBe(aufgabe);
  });

  test('US-2: auf die obere Hälfte einer Karte ziehen setzt davor', async ({ page }) => {
    await page.goto(k.adresse);
    const eins = page.locator('.ka[data-id="1"]');
    await page.locator('.ka[data-id="3"]').dragTo(eins, { targetPosition: { x: 20, y: 5 } });
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .id')).toHaveText(['#3', '#1', '#2']);
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/\[#3\].*\n- \[#1\].*\n- \[#2\]/);
  });
});
