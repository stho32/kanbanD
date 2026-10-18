// R00043 Berichtsfilter wie Kanbanflow
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const tag = (n, h) => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(h)}:00`; };
const zeiten = zeilen => '```kanbanD-time\n' + zeilen.map(([n, h, wer]) => `${tag(n, h)} · ${tag(n, h + 1)} · ${wer}`).join('\n') + '\n```\n';

test.describe('R00043', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## Erledigt\n',
      'aufgaben/0001-fehler.md': `---\nid: 1\ntitle: Fehler\nclass: bug\nlabels: [ui]\n---\n${zeiten([[-1, 9, 'st'], [0, 1, 'mi']])}`,
      'aufgaben/0002-funktion.md': `---\nid: 2\ntitle: Funktion\nclass: feature\n---\n${zeiten([[-1, 10, 'mi'], [0, 2, 'st']])}`,
    }));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Zeitraum gestern', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/kreuz');
    await expect(page.locator('#kreuz tr.klick')).toHaveCount(2);
    await page.getByLabel('Zeitraum', { exact: true }).selectOption('gestern');
    await expect(page.locator('#kreuz tr.klick td')).toHaveText([/#2/, '0:00', '1:00', '1:00', /#1/, '1:00', '0:00', '1:00'].map(x => typeof x === 'string' && x === '0:00' ? '—' : x));
    await expect(page.getByLabel('Zeitraum von')).toHaveValue(tag(-1, 0).slice(0, 10));
  });

  test('US-2 und US-3: Farbe ausschließen, nur Mia, gemerkt, zurücksetzen', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/kreuz');
    const filter = page.getByRole('group', { name: 'Berichtsfilter' });
    await filter.getByRole('button', { name: 'Fehler' }).click();
    await expect(filter.getByRole('button', { name: 'Fehler' })).toHaveAttribute('aria-pressed', 'false');
    await filter.getByRole('button', { name: /Mia/ }).click();
    await expect(page.locator('#kreuz tr.klick td')).toHaveText([/#2 Funktion/, '1:00', '1:00']);
    await expect(page.locator('#kreuz thead th')).toHaveText(['Aufgabe', /Mia/, 'Summe']);
    await page.reload();
    await expect(page.locator('#kreuz tr.klick')).toHaveCount(1);
    await expect(filter.getByRole('button', { name: /Zurücksetzen/ })).toContainText('2');
    await filter.getByRole('button', { name: /Zurücksetzen/ }).click();
    await expect(page.locator('#kreuz tr.klick')).toHaveCount(2);
    await page.goto(k.adresse + '#/berichte/stundenzettel');
    await filter.getByRole('button', { name: 'Funktion' }).click();
    await expect(page.locator('#stundenzettel tbody tr.klick')).toHaveText([/Fehler/]);
  });
});
