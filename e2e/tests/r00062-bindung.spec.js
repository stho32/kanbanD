// R00062 Leere Anwendungsliste löst die Bindung
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson } = require('./hilfen');
const { arbeitsRepository, mitRegister, wbsText, zeile } = require('./wbs-hilfen');

const WBS = wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]);
const BOARD = '# Entwicklung\n\n## Backlog\n\n## Erledigt\n';

test.describe('R00062', () => {
  let k, arbeit;
  test.beforeEach(async () => {
    arbeit = arbeitsRepository(WBS);
    k = await kanbanStarten(mitRegister(arbeit, { 'boards/entwicklung.md': BOARD }));
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });
  const spalten = page => page.locator('.bahn[data-col]');
  const wbsMenue = page => page.locator('.kz-nav a', { hasText: 'WBS' });

  test('US-2: Standard bleibt bequem — ohne Angabe an die einzige Anwendung gebunden, mit ihren Phasen-Spalten', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(wbsMenue(page)).toHaveAttribute('href', '#/wbs/kd');
    await expect(spalten(page)).toHaveCount(5);
    expect(k.git('log', '-1', '--format=%s')).toContain('Phasen-Spalten von „Entwicklung“ ergänzt');
  });

  test('US-1: Board lösen — im Spalten-Dialog „keine“, danach reines Kanban ohne neue Phasen-Spalten', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(spalten(page)).toHaveCount(5);
    await page.getByRole('button', { name: 'Spalten', exact: true }).click();
    const kd = page.getByRole('button', { name: 'Bindung kanbanD' });
    await expect(kd).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Bindung keine' }).click();
    await expect(kd).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#setup-vorschau')).toContainText('applications: []');
    const commits = +k.git('rev-list', '--count', 'HEAD');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('#setup-vorschau')).toHaveCount(0);
    await expect(page.locator('.kz-nav a', { hasText: 'Board' })).toBeVisible();
    await expect(wbsMenue(page)).toHaveCount(0);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(commits + 1);
    expect(k.git('log', '-1', '--format=%s')).toBe('Anwendungen von „Entwicklung“: keine');
    expect(k.lies('boards/entwicklung.md')).toMatch(/^---\napplications: \[\]\n/);

    // Die nachgetragenen Spalten entfernt der Mensch selbst; danach kommen sie nicht wieder.
    k.schreib('boards/entwicklung.md', '---\napplications: []\n---\n\n' + BOARD);
    k.git('-c', 'user.name=x', '-c', 'user.email=x@x', 'commit', '-q', '-am', 'leere Spalten weg');
    await page.reload();
    await expect(spalten(page)).toHaveCount(2);
    await expect(page.locator('.kz-nav a', { hasText: 'Board' })).toBeVisible();
    await expect(wbsMenue(page)).toHaveCount(0);
    expect(k.git('log', '-1', '--format=%s')).toBe('leere Spalten weg');
  });
});
