// R00046 Wie lange noch
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit, filterOeffnen, filterSchalten } = require('./hilfen');

const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00:00`; };
function commitAm(ordner, datum, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const board = (zu, arbeit, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${zu.map(n => `- #${n}\n`).join('')}\n## In Arbeit\n\n${arbeit.map(n => `- #${n}\n`).join('')}\n## Erledigt\n\n${fertig.map(n => `- #${n}\n`).join('')}`;

test.describe('R00046', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(async ordner => {
      const dateien = {};
      for (let n = 1; n <= 6; n++) dateien[`aufgaben/000${n}-a${n}.md`] = `---\nid: ${n}\ntitle: a${n}\n${n === 6 ? 'class: bug\n' : ''}---\n`;
      einrichten(dateien)(ordner);
      commitAm(ordner, vorTagen(5), board([1, 2, 3, 4, 5, 6], [], []));
      commitAm(ordner, vorTagen(4), board([2, 3, 4, 5, 6], [], [1]));
      commitAm(ordner, vorTagen(3), board([4, 5, 6], [3], [1, 2]));
      commitAm(ordner, vorTagen(2), board([4, 5, 6], [], [1, 2, 3]));
      commitAm(ordner, vorTagen(1), board([5, 6], [4], [1, 2, 3]));
    });
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: Prognose je Spalte, ausschließen, ungemessen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /Wie lange noch/ }).click();
    await expect(page.locator('#wl-kopf')).toHaveText('3 von 6 fertig · „In Arbeit“ 4 von 6 erreicht');
    const erledigt = page.locator('.wl-block[data-spalte="Erledigt"]');
    // die erste Tabelle des Blocks — seit R00193 kann „Mit Zugang wie in der Messbasis“ folgen
    await expect(erledigt.locator('.wl-tab').first().locator('tbody tr td:first-child')).toHaveText(['50 %', '70 %', '85 %', '95 %']);
    await expect(erledigt).toContainText('3 VON 6 ERREICHT');
    await expect(page.getByRole('img', { name: /Prognose/ }).locator('.wl-p85')).toHaveCount(2);
    await filterOeffnen(page);
    const filter = page.getByRole('group', { name: 'Berichtsfilter' });
    await filterSchalten(page, filter.getByRole('button', { name: 'In Arbeit' }));
    await expect(page.locator('.wl-block')).toHaveCount(1);
    await expect(page.locator('#wl-kopf')).toHaveText('3 von 5 fertig');
    await filterSchalten(page, filter.getByRole('button', { name: 'In Arbeit' }));
    await filterSchalten(page, filter.getByRole('button', { name: 'Fehler' }));
    await expect(page.locator('#wl-kopf')).toContainText('3 von 5 fertig');
    // seit R00083: Messbasis der letzten N Tage statt Kalenderzeitraum
    await page.getByLabel('Messbasis in Tagen').fill('1');
    await page.getByLabel('Messbasis in Tagen').press('Enter');
    await expect(erledigt).toContainText('keine Prognose unter 3 Läufen');
  });

  // R00083 Messbasis: ein getippter Wert, den ein Neuzeichnen in ein neues Feld rettet, gilt mit Enter.
  test('US-4: Messbasis überlebt ein Neuzeichnen und gilt mit Enter', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('#wl-kopf')).toContainText('3 von 6 fertig');
    await liveBereit(page);
    await filterOeffnen(page);
    const feld = page.getByLabel('Messbasis in Tagen');
    await feld.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('1');
    // Ein Live-Ereignis von außen zeichnet neu, während der Fokus im Feld steht und der Wert noch nicht übernommen ist
    await page.request.post(k.adresse + 'api/aufgaben', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'neu', board: 'entwicklung' } });
    await expect(page.locator('#wl-kopf')).toContainText('3 von 7 fertig');
    await expect(feld).toHaveValue('1');
    await feld.press('Enter');
    await expect(page.locator('.wl-block[data-spalte="Erledigt"]')).toContainText('keine Prognose unter 3 Läufen');
    expect(k.lies('boards/entwicklung.md')).toContain('window-days: 1');
  });

  test('US-3: live — bewegen, anlegen, archivieren ohne Neuladen', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('#wl-kopf')).toContainText('3 von 6 fertig');
    await liveBereit(page);
    const als = { headers: { 'X-KanbanD-Wer': 'cl' } };
    await page.request.post(k.adresse + 'api/boards/entwicklung/bewegen', { ...als, data: { nummer: 4, spalte: 'Erledigt', index: 3 } });
    await expect(page.locator('#wl-kopf')).toContainText('4 von 6 fertig');
    await page.request.post(k.adresse + 'api/aufgaben', { ...als, data: { titel: 'neu', board: 'entwicklung' } });
    await expect(page.locator('#wl-kopf')).toContainText('4 von 7 fertig');
    await page.request.post(k.adresse + 'api/aufgaben/5/archivieren', als);
    await expect(page.locator('#wl-kopf')).toContainText('4 von 6 fertig');
    await expect(page.locator('.wl-liste').first()).toContainText('gelten als verworfen): 1');
  });
});
