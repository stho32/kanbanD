// R00081 Berichtsfilter am Board, zugeklappt, mit „Rechnen ab“
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit, filterOeffnen } = require('./hilfen');

const tag = n => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
const deutsch = n => tag(n).split('-').reverse().join('.');
function commitAm(ordner, n, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  const datum = tag(n) + 'T10:00:00';
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const board = (zu, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${zu.map(n => `- #${n}\n`).join('')}\n## Erledigt\n\n${fertig.map(n => `- #${n}\n`).join('')}`;

test.describe('R00081', () => {
  let k;
  test.beforeEach(async () => {
    k = await kanbanStarten(async ordner => {
      einrichten({ 'aufgaben/0001-a.md': '---\nid: 1\ntitle: eins\nclass: bug\n---\n', 'aufgaben/0002-b.md': '---\nid: 2\ntitle: zwei\n---\n', 'aufgaben/0003-c.md': '---\nid: 3\ntitle: drei\n---\n' })(ordner);
      commitAm(ordner, -4, board([1, 2, 3], []));
      commitAm(ordner, -3, board([2, 3], [1]));
      commitAm(ordner, -1, board([3], [1, 2]));
    });
  });
  test.afterEach(() => k.stoppen());
  const zusammen = page => page.locator('.bf-zusammen');

  test('US-1 und US-2: Box zu, auf, eine Zeile je Filter; Farbe ausschließen steht im Board und übersteht das Neuladen', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/verlauf');
    await liveBereit(page);
    await expect(page.locator('details.bfilter-box')).not.toHaveAttribute('open', '');
    await expect(page.getByRole('group', { name: 'Berichtsfilter' })).toBeHidden();
    await expect(zusammen(page)).toHaveText('Filter · keine · Rechnen ab der ersten Aufgabe');
    await filterOeffnen(page);
    const zeilen = page.locator('.bfilter .bf-gruppe');
    await expect(zeilen.locator('.bf-k')).toHaveText(['Rechnen ab', 'Zeitraum', 'Farben', 'Spalten', 'Zuständig']);
    const boxen = await zeilen.evaluateAll(l => l.map(e => e.getBoundingClientRect()).map(r => [Math.round(r.left), Math.round(r.top), Math.round(r.bottom)]));
    for (let i = 1; i < boxen.length; i++) {
      expect(boxen[i][0], 'gleicher linker Rand').toBe(boxen[0][0]);
      expect(boxen[i][1], 'jede Gruppe unter der vorigen').toBeGreaterThanOrEqual(boxen[i - 1][2]);
    }
    await page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'Fehler' }).click();
    await expect(zusammen(page)).toHaveText('Filter · 1 aktiv · Rechnen ab der ersten Aufgabe');
    await expect.poll(() => k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|Berichtsfilter von „Entwicklung“ geändert');
    expect(k.lies('boards/entwicklung.md')).toContain('\nreport-filter: {exclude-classes: [bug]}\n');
    await page.reload();
    await expect(zusammen(page)).toHaveText('Filter · 1 aktiv · Rechnen ab der ersten Aufgabe');
    await expect(page.locator('details.bfilter-box')).toHaveAttribute('open', '');
    await expect(page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'Fehler' })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.endwert.leise')).toHaveText('Umfang 2');
  });

  test('US-3: Rechnen ab setzt den Projektstart, der Burndown beginnt dort', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/verlauf');
    await liveBereit(page);
    const tage = page.locator('.tabellenansicht tbody tr td:first-child');
    await expect(tage).toHaveText([-4, -3, -2, -1, 0].map(tag));
    await filterOeffnen(page);
    await page.getByLabel('Rechnen ab').fill(tag(-2));
    await page.getByLabel('Rechnen ab').blur();
    await expect(tage).toHaveText([-2, -1, 0].map(tag));
    await expect(zusammen(page)).toHaveText(`Filter · keine · Rechnen ab ${deutsch(-2)}`);
    expect(k.lies('boards/entwicklung.md')).toContain(`\nstart: ${tag(-2)}\n`);
    await page.goto(k.adresse + '#/berichte/stundenzettel');
    await expect(zusammen(page)).toHaveText('Filter · keine');
  });

  test('ohne Person wirkt der Filter nur in dieser Ansicht und wird nicht gespeichert', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/verlauf');
    await liveBereit(page);
    const vorher = k.git('rev-list', '--count', 'HEAD');
    await filterOeffnen(page);
    await page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'Fehler' }).click();
    await expect(zusammen(page)).toHaveText('Filter · 1 aktiv · Rechnen ab der ersten Aufgabe · nicht gespeichert — zum Speichern „Ich bin …“ wählen');
    await expect(page.locator('.endwert.leise')).toHaveText('Umfang 2');
    await page.waitForTimeout(300);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(vorher);
    expect(k.lies('boards/entwicklung.md')).not.toContain('report-filter');
  });

  test('R00083: Messbasis „letzte N Tage“ in Wie lange noch statt Kalenderzeitraum; gespeichert am Board', async ({ page }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    await liveBereit(page);
    await expect(zusammen(page)).toHaveText('Filter · keine · Messbasis 90 T · Rechnen ab der ersten Aufgabe');
    await filterOeffnen(page);
    await expect(page.locator('.bfilter .bf-k')).toHaveText(['Rechnen ab', 'Messbasis', 'Farben', 'Spalten', 'Zuständig']);
    await expect(page.getByLabel('Zeitraum', { exact: true })).toHaveCount(0);
    const erledigt = page.locator('.wl-phase[data-spalte="Erledigt"]');
    await expect(erledigt).toContainText('Durchsatz Ø 0,4 je Kalendertag aus 2 Läufen');
    await page.getByLabel('Messbasis in Tagen').fill('2');
    await page.getByLabel('Messbasis in Tagen').press('Enter');
    await expect(zusammen(page)).toHaveText('Filter · keine · Messbasis 2 T · Rechnen ab der ersten Aufgabe');
    await expect(erledigt).toContainText('aus 1 Lauf');
    await expect(erledigt).toContainText('Tagesreihe: 1 0');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('report-filter: {window-days: 2}');
  });
});
