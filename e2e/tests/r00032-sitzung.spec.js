// R00032 Sitzung und Verbindung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const jetzt = () => { const d = new Date(Date.now() - 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

test.describe('R00032', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
      'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n',
      'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\n---\n\`\`\`kanbanD-time\n${jetzt()} · ... · st\n\`\`\`\n`,
    }));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: letztes Board, Titel mit Timer', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page).toHaveTitle('(1 ▶) Entwicklung — kanbanD');
    await page.locator('#t-board').click();
    await page.getByRole('menuitem', { name: /Test/ }).click();
    await expect(page).toHaveTitle('(1 ▶) Test — kanbanD');
    await page.goto(k.adresse);
    await expect(page.locator('#t-board')).toContainText('Test');
  });

  test('US-3: leeres Board erklärt sich, Wiederverbindung', async ({ page }) => {
    await page.goto(k.adresse + '#/board/test');
    await expect(page.locator('.hilfe-leer')).toContainText('Noch keine Karten');
    await page.evaluate(() => { S.ereignisquelle.onerror(); });
    await expect(page.locator('.kz-z3')).toContainText('nicht live');
    await page.evaluate(() => { S.ereignisquelle.onopen(); });
    await expect(page.getByRole('status')).toContainText('Wieder verbunden');
    await expect(page.locator('.kz-z3')).not.toContainText('nicht live');
  });
});
