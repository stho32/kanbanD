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

  // R00118 Anmerkung 10: Ziehen per Maus ohne gewählte Person öffnet „Ich bin …“; der Zug wird nicht ausgeführt,
  // nach der Wahl nicht automatisch nachgeholt (heutiges Verhalten, festgehalten).
  test('ohne gewählte Person öffnet das Ziehen „Ich bin …“ und führt den Zug nicht aus', async ({ page }) => {
    await page.goto(k.adresse);
    const commits = +k.git('rev-list', '--count', 'HEAD');
    await page.locator('.ka[data-id="7"]').dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('#pop[data-for="t-ich"]')).toBeVisible();
    await expect(page.locator('#ich-hinweis')).toContainText('zuerst wählen, wer du bist');
    // Der Zug ist nicht ausgeführt: #7 liegt weiter in „Zu erledigen“, kein Commit.
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka')).toHaveCount(2);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka[data-id="7"]')).toHaveCount(1);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(commits);
    // Nach der Wahl wird der Zug nicht automatisch nachgeholt.
    await page.locator('#pop[data-for="t-ich"] .iz', { hasText: 'Stefan' }).click();
    await expect(page.locator('#pop[data-for="t-ich"]')).toHaveCount(0);
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka')).toHaveCount(2);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka[data-id="7"]')).toHaveCount(1);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  });
});
