// R00045 Durchlaufzeit als eigener Bericht
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

function commitAm(ordner, datum, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

test('US-1 und US-2: Lead Time, Cycle Time, Filter', async ({ page }) => {
  const k = await kanbanStarten(async ordner => {
    einrichten({ 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n', 'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\nclass: bug\n---\n' })(ordner);
    const kopf = '# Entwicklung\n\n## Zu erledigen\n\n';
    commitAm(ordner, '2026-10-01T09:00:00', `${kopf}- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n`);
    commitAm(ordner, '2026-10-02T09:00:00', `${kopf}- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n`);
    commitAm(ordner, '2026-10-03T09:00:00', `${kopf}## In Arbeit\n\n- #2\n\n## Erledigt\n\n- #1\n`);
    commitAm(ordner, '2026-10-05T21:00:00', `${kopf}## In Arbeit\n\n## Erledigt\n\n- #1\n- #2\n`);
  });
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /Durchlaufzeit/ }).click();
    await expect(page.locator('#durchlauf tr.klick td:last-child')).toHaveText(['4,5', '1,0']);
    await expect(page.locator('#durchlauf-kennzahl')).toContainText('Median 2,8 T');
    await expect(page.getByRole('img', { name: /Durchlaufzeit je Aufgabe/ }).locator('circle')).toHaveCount(2);
    await page.getByLabel('von Spalte').selectOption('In Arbeit');
    await expect(page.locator('#durchlauf tr.klick td:last-child')).toHaveText(['2,5', '0,0']);
    await page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'Fehler' }).click();
    await expect(page.locator('#durchlauf tr.klick')).toHaveCount(1);
    await page.getByLabel('bis Spalte').selectOption('Zu erledigen');
    await expect(page.locator('.bericht')).toContainText('„von“ muss links von „bis“ liegen.');
    await page.getByLabel('von Spalte').selectOption('Zu erledigen');
    await page.getByLabel('bis Spalte').selectOption('Erledigt');
    await page.locator('circle.punkt').first().click();
    await expect(page.getByRole('dialog')).toContainText('eins');
  } finally { await k.stoppen(); }
});
