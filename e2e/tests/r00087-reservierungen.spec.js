// R00087 Reservierungen und Ziehen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const karte = (nr, extra = '') => `---\nid: ${nr}\ntitle: k${nr}\n${extra}---\n`;
const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #7\n- #8\n- #9\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0007-k.md': karte(7),
  'aufgaben/0008-k.md': karte(8),
  // seit über 24 h: gilt nicht mehr und erscheint nirgends
  'aufgaben/0009-k.md': karte(9, 'reservation: {who: cl, instance: alt, since: "2026-01-01 08:00+01:00"}\n'),
};
const als = instanz => ({ headers: { 'X-KanbanD-Wer': 'cl', 'X-KanbanD-Instanz': instanz } });

test.describe('R00087', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: zwei Agenten ziehen gleichzeitig — zwei Karten oben in der Folgespalte, je mit Schloss', async ({ page }) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    const [a, b] = await Promise.all(['A', 'B'].map(i => page.request.post(k.adresse + 'api/boards/entwicklung/ziehen', { ...als(i), data: { von: 'Zu erledigen' } })));
    const nummern = [(await a.json()).aufgabe.nummer, (await b.json()).aufgabe.nummer].sort();
    expect(nummern).toEqual([7, 8]);
    const bahn = page.locator('.bahn[data-col="In Arbeit"]');
    await expect(bahn.locator('.ka .schloss')).toHaveCount(2);
    await expect(bahn.locator('.ka[data-id="7"] .schloss')).toHaveAttribute('title', /^reserviert von Claude · Instanz [AB] · noch 2[34]:\d\d$/);
  });

  test('US-3: Reservierung im Detail freigeben — das Schloss verschwindet live', async ({ page }) => {
    await page.request.post(k.adresse + 'api/aufgaben/7/reservierung', als('A'));
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="7"] .schloss')).toContainText('cl');
    await expect(page.locator('.ka[data-id="9"] .schloss')).toHaveCount(0, { timeout: 1000 });
    await page.locator('.ka[data-id="7"]').click();
    await expect(page.locator('#reservierung')).toContainText('Claude · Instanz A');
    await page.locator('#reservierung').getByRole('button', { name: 'freigeben' }).click();
    await expect(page.locator('#reservierung')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="7"] .schloss')).toHaveCount(0);
    expect(k.lies('aufgaben/0007-k.md')).not.toContain('reservation');
  });

  test('US-4: alle Reservierungen zentral — genau die gültigen, „alle freigeben“ leert die Liste', async ({ page }) => {
    await page.request.post(k.adresse + 'api/aufgaben/7/reservierung', als('A'));
    await page.request.post(k.adresse + 'api/aufgaben/8/reservierung', als('B'));
    await page.goto(k.adresse);
    await page.locator('#t-board').click();
    await page.locator('#reservierungen-zeigen').click();
    await expect(page.locator('#reservierungen tbody tr')).toHaveCount(2);
    await expect(page.locator('#reservierungen tr[data-reserviert="8"]')).toContainText('B');
    await page.getByRole('button', { name: 'alle freigeben' }).click();
    await expect(page.locator('#reservierungen')).toHaveCount(0);
    await expect(page.getByText('Keine gültigen Reservierungen auf diesem Board.')).toBeVisible();
    await expect(page.locator('.ka .schloss')).toHaveCount(0);
  });
});
