// R00161 Nicht-UTF-8-Datei in aufgaben/ wird als defekt geführt (Karte #171)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEI = 'aufgaben/0007-kaputt.md';
const GRUND = 'Datei ist kein gültiges UTF-8 — als UTF-8 speichern';

test.describe('R00161', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1, AK 1 und AK 6: das Board lädt und nennt Pfad und Grund der Nicht-UTF-8-Datei', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/fabrik.md': '# Fabrik\n\n## Eingang\n\n- #1\n\n## Fertig\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n', [DATEI]: Buffer.from([0xff, 0xfe, 0x00]) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('eins');
    await expect(page.locator('#t-defekt')).toHaveText('1 defekte Datei');
    await page.locator('#t-defekt').click();
    await expect(page.locator('#pop .dz')).toHaveText([DATEI + GRUND]);
  });
});
