// R00112 Entfernen rückgängig und sichtbare Entfernen-Knöpfe (Karte #12, ADR-0017)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const ALS_CL = { headers: { 'X-KanbanD-Wer': 'cl' } };

const grundbestand = (boardTitel = 'Entwicklung') => ({
  'boards/entwicklung.md': `# ${boardTitel}\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n`,
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n- [ ] a\n- [x] b\n- [ ] c\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
});

/** Nummern einer Spalte in der Reihenfolge der Board-Datei. */
function spalteDerDatei(text, spalte) {
  const abschnitt = text.split(/^## /m).find(teil => teil.startsWith(spalte + '\n'));
  return [...abschnitt.matchAll(/#(\d+)\]/g)].map(m => +m[1]);
}

const commits = k => +k.git('rev-list', '--count', 'HEAD');

test.describe('R00112 von Board nehmen', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(grundbestand())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const ort = page => page.locator('tr[data-zeile="2"] .orte');
  const hinweis = page => page.locator('.toast[role="status"]');

  /** Gemeinsames Dann von US-1 und US-2 ab „zeigt nach Strg+Z“. */
  async function wiederAnSeinemPlatz(page, vorher) {
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    await expect(hinweis(page)).toHaveText('#2 wieder auf „Entwicklung“ · Spalte Zu erledigen');
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toHaveCount(0);
    expect(spalteDerDatei(k.lies('boards/entwicklung.md'), 'Zu erledigen')).toEqual([1, 2, 3]);
    expect(commits(k)).toBe(vorher + 2);
    expect(k.git('log', '-2', '--format=%an|%s').split('\n')).toEqual(['Stefan|#2 auf „Entwicklung“ gelegt (Zu erledigen)', 'Stefan|#2 von „Entwicklung“ genommen']);
    await page.goto(k.adresse);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .id')).toHaveText(['#1', '#2', '#3']);
  }

  test('US-1: Strg+Z nach von Board nehmen legt #2 an die alte Stelle zurück (#12)', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    const vorher = commits(k);
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    await expect(hinweis(page)).toContainText('#2 von „Entwicklung“ genommen');
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toBeVisible();
    await expect(ort(page)).toHaveText('auf keinem Board');
    await page.keyboard.press('Control+z');
    await wiederAnSeinemPlatz(page, vorher);
  });

  test('US-2: Kontextmenü „Von Board nehmen“ und Knopf „rückgängig“ (#12)', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    const vorher = commits(k);
    await page.locator('tr[data-zeile="2"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Von Board nehmen/ }).hover();
    await page.getByRole('menuitem', { name: 'Entwicklung · Zu erledigen' }).click();
    await expect(ort(page)).toHaveText('auf keinem Board');
    await hinweis(page).getByRole('button', { name: 'rückgängig' }).click();
    await wiederAnSeinemPlatz(page, vorher);
  });

  test('US-3: der Hinweis läuft ab, danach wirkt Strg+Z nicht mehr (#12)', async ({ page }) => {
    await page.clock.install();
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    await expect(ort(page)).toHaveText('auf keinem Board');
    const nachDemEntfernen = commits(k);
    await page.clock.runFor(5000);
    await expect(hinweis(page).getByRole('button', { name: 'rückgängig' })).toBeVisible();
    await page.clock.runFor(7000);
    await expect(page.locator('[data-act="rueckgaengig"]')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await expect(ort(page)).toHaveText('auf keinem Board');
    expect(commits(k)).toBe(nachDemEntfernen);
  });

  test('US-4: hat ein Agent #2 schon zurückgelegt, meldet rückgängig das und legt nichts doppelt (#12)', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    await expect(hinweis(page).getByRole('button', { name: 'rückgängig' })).toBeVisible();
    const gelegt = await page.request.post(k.adresse + 'api/boards/entwicklung/aufgaben', { ...ALS_CL, data: { nummer: 2 } });
    expect(gelegt.status()).toBe(201);
    const vorher = commits(k);
    await hinweis(page).getByRole('button', { name: 'rückgängig' }).click();
    await expect(hinweis(page)).toHaveText('nicht rückgängig: #2 liegt schon auf „Entwicklung“');
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toHaveCount(0);
    expect(k.lies('boards/entwicklung.md').match(/#2\]/g)).toHaveLength(1);
    expect(commits(k)).toBe(vorher);
    expect(k.git('log', '-1', '--format=%an')).toBe('Claude');
  });
});
