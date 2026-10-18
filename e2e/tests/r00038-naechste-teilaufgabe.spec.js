// R00038 Erste offene Teilaufgabe auf der Karte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

test('US-1 und US-2: nächster Schritt sichtbar und direkt abhakbar', async ({ page }) => {
  const k = await kanbanStarten(einrichten({
    'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #3\n',
    'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n- [x] a\n- [ ] b\n- [ ] c\n',
    'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
    'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n- [ ] offen, aber erledigt\n',
  }));
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const eins = page.locator('.ka[data-id="1"]');
    await expect(eins.locator('.naechste')).toHaveText('b');
    await expect(page.locator('.ka[data-id="2"] .naechste')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="3"] .naechste')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'b abhaken' }).click();
    await expect(eins.locator('.naechste')).toHaveText('c');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
    await page.getByRole('checkbox', { name: 'c abhaken' }).click();
    await expect(eins.locator('.naechste')).toHaveCount(0);
    await expect(eins.locator('.tk')).toHaveText('☑ 3/3');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] c');
  } finally { await k.stoppen(); }
});
