// R00047 Termine in Wie lange noch
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function commitAm(ordner, datum, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum + 'T10:00:00', GIT_COMMITTER_DATE: datum + 'T10:00:00' } });
}
const board = (zu, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${zu.map(n => `- #${n}\n`).join('')}\n## Erledigt\n\n${fertig.map(n => `- #${n}\n`).join('')}`;

test('US-1 bis US-3: Termin anlegen, Chance, ändern, entfernen', async ({ page }) => {
  const k = await kanbanStarten(async ordner => {
    const dateien = {};
    for (let n = 1; n <= 6; n++) dateien[`aufgaben/000${n}-a${n}.md`] = `---\nid: ${n}\ntitle: a${n}\n---\n`;
    einrichten(dateien)(ordner);
    commitAm(ordner, vorTagen(4), board([1, 2, 3, 4, 5, 6], []));
    commitAm(ordner, vorTagen(3), board([2, 3, 4, 5, 6], [1]));
    commitAm(ordner, vorTagen(2), board([3, 4, 5, 6], [1, 2]));
    commitAm(ordner, vorTagen(1), board([4, 5, 6], [1, 2, 3]));
  });
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('.wl-termine')).toContainText('Noch keine Termine');
    await page.getByLabel('Name des Termins').fill('Deadline');
    await page.getByLabel('Datum des Termins').fill('2027-10-31');
    await page.getByLabel('Farbe des Termins', { exact: true }).selectOption('red');
    await page.getByLabel('Linie des Termins').selectOption('durchgehend');
    await page.getByLabel('Stärke des Termins').selectOption('fett');
    await page.getByRole('button', { name: 'Termin anlegen' }).click();
    const linie = page.locator('.wl-termin[data-termin="Deadline"] line');
    await expect(linie).toHaveCount(1);
    expect(await linie.evaluate(l => [getComputedStyle(l).strokeWidth, getComputedStyle(l).strokeDasharray])).toEqual(['4px', 'none']);
    expect(await linie.evaluate(l => getComputedStyle(l).stroke)).not.toBe('none');
    await expect(page.locator('.wl-termin[data-termin="Deadline"] text')).toHaveText('Deadline 31.10.');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('milestones:\n  - {name: Deadline, date: 2027-10-31, color: red, line: solid, width: bold}');
    expect(k.git('log', '-1', '--format=%s')).toBe('Termin „Deadline“ (31.10.2027) angelegt in „Entwicklung“');
    await expect(page.locator('#termine tbody tr')).toContainText(['Deadline']);
    await expect(page.locator('#termine tbody td').nth(3)).toHaveText(/^100 % · 100 % in der 5-Tage-Woche$/);
    await expect(page.locator('.wl-phase[data-spalte="Erledigt"] .wl-tchance')).toContainText('Deadline · bis So 31.10.2027: 100 %');
    // zweiter Termin, gestrichelt, eigene Farbe, in der Vergangenheit
    await page.getByLabel('Name des Termins').fill('Kickoff');
    await page.getByLabel('Datum des Termins').fill(vorTagen(10));
    await page.getByLabel('Eigene Farbe des Termins').fill('#2a78d6');
    await page.getByLabel('Eigene Farbe des Termins').blur();
    await page.getByLabel('Linie des Termins').selectOption('gestrichelt');
    await page.getByRole('button', { name: 'Termin anlegen' }).click();
    await expect(page.locator('#termine tbody tr')).toHaveCount(2);
    await expect(page.locator('#termine tbody tr').first()).toContainText('vorbei');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('color: "#2a78d6", line: dashed');
    // ändern
    await page.getByLabel('Termin Deadline ändern').click();
    await expect(page.getByLabel('Name des Termins')).toHaveValue('Deadline');
    await page.getByLabel('Stärke des Termins').selectOption('fein');
    await page.getByRole('button', { name: 'Übernehmen' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('{name: Deadline, date: 2027-10-31, color: red, line: solid, width: thin}');
    await expect(page.getByRole('button', { name: 'Termin anlegen' })).toBeVisible();
    // entfernen
    await page.getByLabel('Termin Kickoff entfernen').click();
    await expect(page.locator('#termine tbody tr')).toHaveCount(1);
    expect(k.git('log', '-1', '--format=%s')).toContain('Termin „Kickoff“');
    // ohne Name: Hinweis, nichts geschrieben
    await page.getByRole('button', { name: 'Termin anlegen' }).click();
    await expect(page.locator('.tm-form [role="alert"]')).toHaveText('Der Termin braucht einen Namen');
  } finally { await k.stoppen(); }
});
