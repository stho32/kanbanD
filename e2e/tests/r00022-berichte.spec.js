// R00022 Stundenzettel und CSV
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const heute = (h, m) => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(h)}:${p(m)}`; };

test.describe('R00022', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\n---\n\`\`\`kanbanD-time\n${heute(1, 0)} · ${heute(2, 30)} · st\n${heute(3, 0)} · ${heute(3, 30)} · cl\n\`\`\`\n`,
    }));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Stundenzettel', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /Stundenzettel/ }).click();
    await expect(page.locator('#stundenzettel tbody tr.klick')).toHaveCount(1);
    await expect(page.locator('#zettelsumme')).toHaveText('1:30');
    await page.getByRole('radio', { name: 'Claude' }).click();
    await expect(page.locator('#zettelsumme')).toHaveText('0:30');
    await page.getByLabel('vorige Woche').click();
    await expect(page.locator('#zettelsumme')).toHaveText('0:00');
    await page.getByLabel('nächste Woche').click();
    await page.locator('#stundenzettel tr.klick').click();
    await expect(page.getByRole('dialog')).toContainText('eins');
  });

  test('US-2 und US-3: Kreuztabelle und CSV', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/kreuz');
    await page.getByRole('radio', { name: 'alles' }).click();
    await expect(page.locator('#kreuz tr.klick td')).toHaveText([/#1/, '1:30', '0:30', '2:00']);
    const download = page.waitForEvent('download');
    await page.getByRole('link', { name: 'CSV' }).click();
    const datei = await download;
    expect(datei.suggestedFilename()).toBe('kanbanD-zeiten.csv');
    const text = require('fs').readFileSync(await datei.path(), 'utf8');
    expect(text.split('\n').filter(Boolean)).toHaveLength(3);
  });
});
