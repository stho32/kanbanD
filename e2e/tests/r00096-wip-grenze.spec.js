// R00096 WIP-Grenze: ein Mensch darf über die Grenze ziehen und sieht die Warnung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, einrichten } = require('./hilfen');

const BOARD = '---\nlimits:\n  In Arbeit: 2\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- #7\n\n## In Arbeit\n\n- #5\n- #6\n\n## Erledigt\n';
const aufgabe = nr => ['aufgaben/000' + nr + '-k.md', '---\nid: ' + nr + '\ntitle: Karte ' + nr + '\n---\n'];

test.describe('R00096', () => {
  let k;
  test.beforeEach(async () => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': BOARD, ...Object.fromEntries([5, 6, 7].map(aufgabe)) }));
  });
  test.afterEach(() => k.stoppen());

  test('US-3: Mensch zieht per Maus in die volle Spalte — Karte liegt dort, Warnung nennt die Grenze', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const commits = +k.git('rev-list', '--count', 'HEAD');
    await page.locator('.ka[data-id="7"]').dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('#pruef-warnung')).toContainText('Grenze erreicht: „In Arbeit“ hat 3 von 2');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka')).toHaveCount(3);
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#7 nach „In Arbeit“ (Entwicklung)');
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(commits + 1);
    expect(k.lies('boards/entwicklung.md').split('## In Arbeit')[1]).toContain('[#7]');
  });
});
