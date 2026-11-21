// R00053 Anwendungen registrieren
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, reiter } = require('./hilfen');

const WBS = name => `# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0005 | Interaction | D0001 | Anlegen | gruen | |\n| I0007 | Interaction | D0001 | ${name} | rot | I0005 |\n`;

/** Ein Arbeits-Repository neben dem kanbanD-Ordner: WBS und Anforderungsordner. */
function arbeitsRepository(name) {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-app-')));
  fs.writeFileSync(path.join(r, 'plan.md'), WBS(name));
  fs.mkdirSync(path.join(r, 'anf'));
  return r;
}

test.describe('R00053', () => {
  let k, repos = [];
  test.afterEach(async () => { await k.stoppen(); for (const r of repos) fs.rmSync(r, { recursive: true, force: true }); repos = []; });

  test('US-1: Anwendung eintragen — erreichbar, genau ein Commit', async ({ page }) => {
    const kd = arbeitsRepository('Bewegen'); repos.push(kd);
    k = await kanbanStarten(einrichten());
    await alsPerson(page, 'st');
    const vorher = +k.git('rev-list', '--count', 'HEAD', '--', 'kanbanD.md');
    await page.goto(k.adresse + '#/einrichten');
    await page.getByLabel('Neues Anwendungskürzel').fill('kd');
    await page.getByLabel('Neuer Anwendungsname').fill('kanbanD');
    await page.keyboard.press('Enter');
    // R00209 AK 10: der Fokus steht im Feld „Repository“ der neuen Zeile; seit R00222 ist es das einzige Pfadfeld
    const repository = page.getByLabel('Repository kd', { exact: true });
    await expect(repository).toBeFocused();
    await repository.fill(kd);
    await expect(page.locator('#einr-vorschau')).toContainText(`applications:\n    kd: {name: kanbanD, repository: ${kd}}`);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('gespeichert')).toBeVisible();
    const zeile = page.locator('.anw[data-anwendung="kd"]');
    await expect(zeile.locator('.erreich.ja')).toHaveCount(1);
    expect(k.lies('kanbanD.md')).toContain(`    kd: {name: kanbanD, repository: ${kd}}\n`);
    // das Board ist jetzt gebunden: seine Phasen-Spalten trägt kanbanD als eigene Aktion nach (R00058)
    expect(+k.git('rev-list', '--count', 'HEAD', '--', 'kanbanD.md')).toBe(vorher + 1);
    expect(k.git('log', '-1', '--format=%an|%s', '--', 'kanbanD.md')).toBe('Stefan|Einstellungen geändert');
  });

  test('US-3: verschobene WBS — das Repository bleibt erreichbar, Boards bleiben benutzbar (R00222: kein Feld WBS mehr)', async ({ page }) => {
    const kd = arbeitsRepository('Bewegen'); repos.push(kd);
    const kanban = `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: kanbanD, wbs: "${kd}/plan.md", requirements: "${kd}/anf"}\n---\n`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': kanban, 'boards/entwicklung.md': '---\napplications: [kd]\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\norigins: [kd:I0007]\n---\n' }));
    fs.renameSync(path.join(kd, 'plan.md'), path.join(kd, 'plan-alt.md'));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    const zeile = page.locator('.anw[data-anwendung="kd"]');
    // R00209: das Repository (der Ordner) bleibt erreichbar, auch wenn die WBS-Datei fehlt; R00222: ihr Feld gibt es nicht mehr
    await expect(zeile.locator('.erreich.ja')).toHaveCount(1);
    await expect(zeile.locator('.erreich.nein')).toHaveCount(0);
    await page.getByRole('link', { name: 'Board' }).click();
    // R00212: kanbanD löst die Herkunft nicht auf — der Chip ist Text, mit erreichbarer und mit verschobener WBS gleich
    const text = page.locator('.ka[data-id="1"] .org', { hasText: 'kd:I0007' });
    expect(await text.evaluate(e => [e.tagName, e.hasAttribute('href'), e.hasAttribute('title')])).toEqual(['SPAN', false, false]);
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'));
    await expect(page.locator('.bahn[data-col="Erledigt"] .ka[data-id="1"]')).toBeVisible();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('## Erledigt\n\n- [#1]');
  });

  test('US-2: qualifizierte Herkunft — Text ohne Auflösung, ohne Kürzel mehrdeutig', async ({ page }) => {
    const kd = arbeitsRepository('Bewegen'), kc = arbeitsRepository('Kassieren'); repos.push(kd, kc);
    const kanban = `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kc: {name: Kasse, wbs: "${kc}/plan.md", requirements: ""}\n    kd: {name: kanbanD, wbs: "${kd}/plan.md", requirements: ""}\n---\n`;
    k = await kanbanStarten(einrichten({
      'kanbanD.md': kanban,
      'boards/entwicklung.md': '---\napplications: [kd, kc]\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- #2\n- #3\n\n## In Arbeit\n\n- #1\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\norigins: [kd:I0005]\n---\n',
      'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
      'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\norigins: [I0007]\n---\n',
    }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="3"] .org.mehrdeutig')).toHaveText('I0007 · mehrdeutig');
    await page.locator('.ka[data-id="2"]').click();
    await reiter(page, 'Details');
    await page.getByLabel('Neue Herkunft').fill('kd:I0007');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0002-zwei.md')).toContain('origins: [kd:I0007]');
    await page.keyboard.press('Escape');
    const chip = page.locator('.ka[data-id="2"] .org', { hasText: 'kd:I0007' });
    await expect(chip).toHaveCount(1);
    expect(await chip.evaluate(e => [e.tagName, e.hasAttribute('href'), e.hasAttribute('title')]), 'kein Link, kein Tooltip aus der WBS').toEqual(['SPAN', false, false]);
    await expect(page.locator('.ka[data-id="2"] .wartet')).toHaveCount(0);
  });

  test('mit einer Anwendung ist unqualifizierte Herkunft Text, nicht mehrdeutig', async ({ page }) => {
    const kd = arbeitsRepository('Bewegen'); repos.push(kd);
    const kanban = `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: kanbanD, wbs: "${kd}/plan.md", requirements: ""}\n---\n`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': kanban, 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n', 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\norigins: [I0007]\n---\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const chip = page.locator('.ka[data-id="1"] .org', { hasText: 'I0007' });
    await expect(chip).toHaveText('I0007');
    expect(await chip.evaluate(e => [e.tagName, e.hasAttribute('href')])).toEqual(['SPAN', false]);
    await expect(page.locator('.ka[data-id="1"] .org.mehrdeutig')).toHaveCount(0);
  });
});
