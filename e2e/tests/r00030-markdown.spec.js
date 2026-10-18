// R00030 Beschreibung als Markdown lesen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

test('US-1 und US-2: formatiert lesen, bearbeiten, zurück', async ({ page }) => {
  const k = await kanbanStarten(einrichten({
    'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
    'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n## Ziel\n\n* schnell\n* **sicher**\n',
  }));
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    const lesen = page.locator('.besch-lesen');
    await expect(lesen.locator('h4')).toHaveText('Ziel');
    await expect(lesen.locator('li strong')).toHaveText('sicher');
    await lesen.click();
    const feld = page.getByLabel('Beschreibung', { exact: true });
    await expect(feld).toBeFocused();
    await expect(feld).toHaveValue('## Ziel\n\n* schnell\n* **sicher**');
    await feld.press('Control+End');
    await feld.type('\n* günstig');
    await page.getByLabel('Titel', { exact: true }).click();
    await expect(page.locator('.besch-lesen li')).toHaveText(['schnell', 'sicher', 'günstig']);
    expect(k.lies('aufgaben/0001-eins.md')).toContain('* günstig');
  } finally { await k.stoppen(); }
});
