// R00014 Timer starten und stoppen
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const jetztMinus = min => { const d = new Date(Date.now() - min * 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

test.describe('R00014', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1: Timer im Fenster starten', async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
    }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').click();
    await page.getByRole('button', { name: '▶ Meinen Timer starten' }).click();
    await expect(page.locator('.tz.eigen')).toContainText('Stefan');
    await expect(page.getByRole('button', { name: '▶ Meinen Timer starten' })).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"] .lauf.eigen')).toContainText('0:00');
    expect(k.lies('aufgaben/0001-eins.md')).toMatch(/```kanbanD-time\n\d{4}-\d\d-\d\d \d\d:\d\d\+0[12]:00 · \.\.\. · st\n```/);
    await page.getByRole('button', { name: 'Timer von Stefan stoppen' }).click();
    await expect(page.getByRole('button', { name: '▶ Meinen Timer starten' })).toBeVisible();
    await expect(page.locator('.ka[data-id="1"] .lauf')).toHaveCount(0);
  });

  test('US-2: fremden Timer stoppen, eigener läuft weiter', async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\n---\n\`\`\`kanbanD-time\n${jetztMinus(90)} · ... · st\n${jetztMinus(30)} · ... · cl\n\`\`\`\n`,
    }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"] .lauf')).toContainText('2× 1:30');
    await page.locator('#t-lauf').click();
    await expect(page.locator('#pop .pz2')).toHaveCount(2);
    await page.getByRole('button', { name: 'Timer von Claude stoppen' }).click();
    await expect(page.locator('#t-lauf')).toContainText('1 läuft');
    expect(k.lies('aufgaben/0001-eins.md')).toMatch(/· st\n.* · \d{4}-\d\d-\d\d \d\d:\d\d\+0[12]:00 · cl\n/);
    expect(k.git('log', '-1', '--format=%an|%s')).toMatch(/^Stefan\|#1 Timer von Claude gestoppt \(0:(29|30|31)\)$/);
  });
});
