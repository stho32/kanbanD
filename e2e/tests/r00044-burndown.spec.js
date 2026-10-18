// R00044 Burndown nach Zeitraum
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

function commitAm(ordner, datum, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

test('US-1 und US-2: Zeitraum und Spalte ausschließen', async ({ page }) => {
  const k = await kanbanStarten(async ordner => {
    einrichten({ 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n', 'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\nclass: bug\n---\n' })(ordner);
    const kopf = '# Entwicklung\n\n## Zu erledigen\n\n';
    commitAm(ordner, '2026-10-01T09:00:00', `${kopf}- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n`);
    commitAm(ordner, '2026-10-02T09:00:00', `${kopf}- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n`);
  });
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/verlauf');
    await expect(page.locator('.endwert').first()).toHaveText('offen 1');
    await page.getByLabel('Zeitraum von').fill('2026-10-01');
    await page.getByLabel('Zeitraum bis').fill('2026-10-01');
    await expect(page.getByLabel('Zeitraum', { exact: true })).toHaveValue('eigen');
    await page.getByText('Tabellenansicht').click();
    await expect(page.locator('.tabellenansicht tbody tr')).toHaveCount(1);
    await expect(page.locator('.endwert').first()).toHaveText('offen 2');
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    const filter = page.getByRole('group', { name: 'Berichtsfilter' });
    await filter.getByRole('button', { name: 'Zu erledigen' }).click();
    await expect(page.locator('.endwert').first()).toHaveText('offen 0');
    await filter.getByRole('button', { name: 'Zu erledigen' }).click();
    await filter.getByRole('button', { name: 'Fehler' }).click();
    await expect(page.locator('.endwert').first()).toHaveText('offen 0');
    await expect(page.locator('.endwert.leise')).toHaveText('Umfang 1');
  } finally { await k.stoppen(); }
});
