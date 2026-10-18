// R00059 Plausibilitätsprüfung je Spalte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, einrichten, liveBereit } = require('./hilfen');
const { arbeitsRepository, mitRegister, wbsText, zeile } = require('./wbs-hilfen');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0002', 'Dialog', 'A0001', 'Board', 'rot'),
  zeile('I0048', 'Interaction', 'D0002', 'Export', 'rot', { fertig: 'US-1' }),
]);
const BOARD = '---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\ncolumn-checks:\n  Entwicklung: [wbs-effects-green]\n---\n\n# Entwicklung\n\n## Backlog\n\n## Entwicklung\n\n- #7\n\n## Entwicklertest\n\n## Abnahme\n\n## Erledigt\n';

test.describe('R00059', () => {
  let k, arbeit;
  test.beforeEach(async () => {
    arbeit = arbeitsRepository(WBS);
    k = await kanbanStarten(mitRegister(arbeit, { 'boards/entwicklung.md': BOARD, 'aufgaben/0007-export.md': '---\nid: 7\ntitle: Export\nwbs-effects:\n  - {application: kd, action: create, node: I0048}\n---\n' }));
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });
  const karte = page => page.locator('.ka[data-id="7"]');

  test('US-1: Warnung beim Ziehen — Zug ausgeführt, Hinweis mit dem roten Knoten, Ausrufezeichen an der Karte', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(karte(page).locator('.ausruf')).toHaveCount(0);
    const commits = +k.git('rev-list', '--count', 'HEAD');
    await karte(page).dragTo(page.locator('.bahn[data-col="Entwicklertest"] .flaeche'));
    await expect(page.locator('.bahn[data-col="Entwicklertest"] .ka .id')).toHaveText(['#7']);
    const warnung = page.locator('#pruef-warnung');
    await expect(warnung).toContainText('Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.');
    await expect(warnung.getByRole('link', { name: 'kd:I0048' })).toHaveAttribute('href', '#/wbs/kd/I0048');
    await expect(karte(page).locator('.ausruf')).toHaveAttribute('title', 'wbs-effects-green: kd:I0048 rot');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#7 nach „Entwicklertest“ (Entwicklung)');
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(commits + 1);
    await warnung.getByRole('link', { name: 'kd:I0048' }).click();
    await expect(page).toHaveURL(/#\/wbs\/kd\/I0048$/);
    await expect(page.locator('tr.wbs-z[data-id="I0048"]')).toBeVisible();
  });

  test('US-2: Ausrufezeichen verschwindet ohne Neuladen, sobald der Knoten grün wird; nach links keine Warnung', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await karte(page).dragTo(page.locator('.bahn[data-col="Abnahme"] .flaeche'));
    await expect(karte(page).locator('.ausruf')).toBeVisible();
    await page.locator('#pruef-warnung').waitFor();
    await karte(page).dragTo(page.locator('.bahn[data-col="Entwicklung"] .flaeche'));
    await expect(page.locator('.bahn[data-col="Entwicklung"] .ka .id')).toHaveText(['#7']);
    await expect(page.locator('#pruef-warnung')).toHaveCount(0);
    await expect(karte(page).locator('.ausruf')).toHaveCount(0);
    await karte(page).dragTo(page.locator('.bahn[data-col="Entwicklertest"] .flaeche'));
    await expect(karte(page).locator('.ausruf')).toBeVisible();
    const r = await page.request.patch(k.adresse + 'api/wbs/kd/knoten/I0048', { headers: { 'X-KanbanD-Wer': 'st' }, data: { status: 'gruen' } });
    expect(r.ok()).toBeTruthy();
    await expect(karte(page).locator('.ausruf')).toHaveCount(0);
  });
});

test.describe('R00059 Konfiguration', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('Spalten konfigurieren: Prüfung je Spalte schalten, unbekannte bleibt erhalten', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': '---\ncolumn-checks:\n  In Arbeit: [xyz]\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('#pruefungen-hinweis')).toContainText('Spalte „In Arbeit“: unbekannte Prüfung „xyz“');
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Prüfung wbs-effects-green Zu erledigen').click();
    await page.getByLabel('Prüfung wbs-effects-green In Arbeit').click();
    await expect(page.locator('#setup-vorschau')).toContainText('column-checks:\n  Zu erledigen: [wbs-effects-green]\n  In Arbeit: [xyz, wbs-effects-green]');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.bahn')).toHaveCount(3);
    expect(k.lies('boards/entwicklung.md')).toContain('column-checks:\n  Zu erledigen: [wbs-effects-green]\n  In Arbeit: [xyz, wbs-effects-green]\n');
    await page.getByRole('button', { name: 'Spalten' }).click();
    await page.getByLabel('Prüfung wbs-effects-green Zu erledigen').click();
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('column-checks:\n  In Arbeit: [xyz, wbs-effects-green]\n---');
  });
});
