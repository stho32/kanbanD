// R00021 Personenübersicht
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const vor = min => { const d = new Date(Date.now() - min * 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

test.describe('R00021', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #2\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nassignees: [st]\n---\n\`\`\`kanbanD-time\n${vor(20)} · ... · st\n\`\`\`\n`,
      'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: zwei\nassignees: [mi]\n---\n\`\`\`kanbanD-time\n${vor(5)} · ${vor(5)} · cl\n\`\`\`\n`,
    }));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Gruppen und Stopp', async ({ page }) => {
    await page.goto(k.adresse + '#/personen');
    const gruppen = page.locator('tr.grp td');
    await expect(gruppen.nth(0)).toContainText('LÄUFT JETZT');
    await expect(page.locator('tr[data-person="st"] .akt')).toContainText('#1');
    await expect(page.locator('tr[data-person="mi"]')).toHaveClass(/ruhe/);
    await expect(page.locator('tr[data-person="st"]')).toContainText('1 · 1 begonnen');
    await page.getByRole('button', { name: 'Timer von Stefan stoppen' }).click();
    await expect(page.locator('tr[data-person="st"] .akt')).toHaveCount(0);
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).not.toContain('...');
  });

  test('US-2: Klick auf Mia filtert das Board', async ({ page }) => {
    await page.goto(k.adresse + '#/personen');
    await page.getByRole('radio', { name: 'nur Agenten' }).click();
    await expect(page.locator('tr[data-person]')).toHaveCount(1);
    await page.getByRole('radio', { name: 'Menschen + Agenten' }).click();
    await page.locator('tr[data-person="mi"] .wer').click();
    await expect(page.getByLabel('Filter')).toHaveValue('@mi');
    await expect(page.locator('.ka .id')).toHaveText(['#2']);
  });
});
