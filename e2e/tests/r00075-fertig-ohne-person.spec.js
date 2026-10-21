// R00075 „Fertig“ in „Spalten einrichten“ ohne gewählte Person
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten } = require('./hilfen');

test('US-1: ohne Person erst wählen, dann speichert „Fertig“ — auch mit „/“ im Namen', async ({ page }) => {
  const k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n' }));
  try {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Spalten', exact: true }).click();
    await page.getByLabel('Spaltenname 3').fill('Läuft Produktiv/Erledigt');
    await page.getByRole('button', { name: 'Fertig' }).click();
    const auswahl = page.locator('#pop');
    await expect(auswahl).toBeVisible();
    await expect(auswahl).toContainText('Für diese Aktion zuerst wählen, wer du bist.');
    await auswahl.getByRole('menuitem', { name: /Stefan/ }).click();
    await expect(page.locator('#t-ich')).toContainText('Stefan');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.bahn[data-col="Läuft Produktiv/Erledigt"] .ka')).toHaveCount(1);
    expect(k.lies('boards/entwicklung.md')).toContain('## Läuft Produktiv/Erledigt\n');
  } finally { await k.stoppen(); }
});
