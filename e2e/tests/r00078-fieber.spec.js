// R00078 Projekt-Fever-Chart
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const tag = n => { const d = new Date(); d.setDate(d.getDate() + n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
function commitAm(ordner, n, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  const datum = tag(n) + 'T10:00:00';
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const liste = l => l.map(n => `- #${n}\n`).join('');
const board = (zu, arbeit, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${liste(zu)}\n## In Arbeit\n\n${liste(arbeit)}\n## Erledigt\n\n${liste(fertig)}`;

test.describe('R00078', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(async ordner => {
      const dateien = {};
      for (let n = 1; n <= 8; n++) dateien[`aufgaben/000${n}-a${n}.md`] = `---\nid: ${n}\ntitle: a${n}\n---\n`;
      einrichten(dateien)(ordner);
      commitAm(ordner, -10, board([1, 2, 3, 4, 5, 6, 7, 8], [], []));
      commitAm(ordner, -9, board([2, 3, 4, 5, 6, 7, 8], [], [1]));
      commitAm(ordner, -8, board([3, 4, 5, 6, 7, 8], [], [1, 2]));
      commitAm(ordner, -6, board([4, 5, 6, 7, 8], [], [1, 2, 3]));
      commitAm(ordner, -5, board([5, 6, 7, 8], [4], [1, 2, 3]));
      commitAm(ordner, -3, board([5, 6, 7, 8], [], [1, 2, 3, 4]));
      commitAm(ordner, -1, board([6, 7, 8], [], [1, 2, 3, 4, 5]));
    });
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());
  const kanbandCommits = () => k.git('log', '--reverse', '--format=%an|%s').split('\n').filter(z => z.startsWith('kanbanD|')).map(z => z.slice(8));

  test('US-1 bis US-3: Zieltermin wählen, Puffer vorschlagen, Bahn mit Zonen, Tooltip, Cache, verwerfen', async ({ page }) => {
    await page.request.put(k.adresse + 'api/boards/entwicklung/termine', { headers: { 'X-KanbanD-Wer': 'st' }, data: [{ name: 'Deadline', datum: tag(20), farbe: 'red' }, { name: 'Review', datum: tag(5), farbe: 'blue' }] });
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /Projekt-Fever-Chart/ }).click();
    await expect(page).toHaveURL(/#\/berichte\/fieber$/);
    await expect(page.locator('#fb-hinweis')).toHaveText('Wähle einen Zieltermin oben.');
    // Cache: die Tage vom Start bis gestern, ohne heute, von „kanbanD“
    await expect.poll(kanbandCommits).toEqual(['Fever Chart „Entwicklung“: 10 Tage ergänzt']);
    const cache = k.lies('berichte/entwicklung-fieber.md');
    expect(cache).toContain(`| ${tag(-10)} | 0 | 8 |`);
    expect(cache).toContain(`| ${tag(-1)} | 5 | 8 |`);
    expect(cache).not.toContain(`| ${tag(0)} |`);

    await page.getByLabel('Zieltermin').selectOption({ label: `Deadline · ${tag(20).split('-').reverse().join('.')}` });
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain(`{name: Deadline, date: ${tag(20)}, color: red, line: solid, width: normal, target: true}`);
    await expect(page.locator('#fb-hinweis')).toContainText('Der Puffer fehlt');
    await page.getByRole('button', { name: 'Puffer vorschlagen' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/\nfever: \{buffer: \d+\}\n/);
    const puffer = +/fever: \{buffer: (\d+)\}/.exec(k.lies('boards/entwicklung.md'))[1];
    const kennzahl = page.locator('#fb-kennzahl');
    const gesamt = +/Gesamtdauer (\d+) Arbeitstage/.exec(await kennzahl.innerText())[1];
    expect(puffer).toBe(Math.round(gesamt / 3));
    await expect(kennzahl).toContainText(`Puffer ${puffer}`);
    await expect.poll(() => k.git('log', '-1', '--format=%an|%s')).toBe(`Stefan|Fever Chart von „Entwicklung“ eingestellt: Puffer ${puffer} Arbeitstage, P95`);

    const svg = page.locator('svg.fieber');
    await expect(svg).toBeVisible();
    await expect(svg.locator('.fb-zone')).toHaveCount(4);
    const aktuell = svg.locator('#fb-aktuell');
    await expect(aktuell).toHaveAttribute('data-zone', /^(gruen|gelb|rot|schwarz)$/);
    await expect(page.locator('#fb-stand')).toContainText('Fortschritt');
    await expect(page.locator('#fb-gemessen')).toContainText('gemessen — vorher zu wenig Läufe');
    // Tooltip am Punkt
    await aktuell.hover();
    const tip = page.locator('#tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Pufferverbrauch');
    await expect(tip).toContainText(`Zieltermin`);
    await expect(tip).toContainText('(P95)');

    // Puffer und Perzentil ändern rechnet ohne neuen Cache-Commit
    const vorher = await page.locator('#fb-tabelle tbody tr').last().innerText();
    await page.getByLabel('Puffer in Tagen').fill(String(puffer + 3));
    await page.getByLabel('Puffer in Tagen').press('Enter');
    await expect(kennzahl).toContainText(`Puffer ${puffer + 3}`);
    await page.getByLabel('Perzentil der Prognose').selectOption('50');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain(`fever: {buffer: ${puffer + 3}, percentile: 50}`);
    await expect(page.locator('#fb-tabelle tbody tr').last()).not.toHaveText(vorher);
    expect(kanbandCommits()).toHaveLength(1);

    // verwerfen und neu rechnen
    await page.getByRole('button', { name: 'Cache verwerfen und neu rechnen' }).click();
    await expect.poll(kanbandCommits).toEqual(['Fever Chart „Entwicklung“: 10 Tage ergänzt', 'Fever Chart „Entwicklung“: Cache verworfen', 'Fever Chart „Entwicklung“: 10 Tage ergänzt']);
    expect(k.lies('berichte/entwicklung-fieber.md')).toContain(`| ${tag(-1)} | 5 | 8 |`);
  });

  test('US-4: Projektstart in „Wie lange noch“ ist Messbasis; Zieltermin in der Termintabelle', async ({ page }) => {
    await page.request.put(k.adresse + 'api/boards/entwicklung/termine', { headers: { 'X-KanbanD-Wer': 'st' }, data: [{ name: 'Deadline', datum: tag(20), farbe: 'red' }] });
    await page.goto(k.adresse + '#/berichte/prognose');
    await liveBereit(page);
    const erledigt = page.locator('.wl-phase[data-spalte="Erledigt"]');
    await expect(erledigt.locator('tbody tr')).toHaveCount(4);
    await expect(page.locator('.fb-start')).toContainText(`erste Aufgabe auf dem Board (${tag(-10).split('-').reverse().join('.')})`);
    await page.getByLabel('Projektstart').fill(tag(-4));
    await page.getByLabel('Projektstart').blur();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain(`\nstart: ${tag(-4)}\n`);
    await expect.poll(() => k.git('log', '-1', '--format=%an|%s')).toBe(`Stefan|Projektstart von „Entwicklung“: ${tag(-4).split('-').reverse().join('.')}`);
    await expect(erledigt).toContainText('keine Prognose unter 3 Läufen in der Messbasis (gemessen: 2)');
    const ziel = page.getByRole('radio', { name: 'Termin Deadline ist Zieltermin' });
    await expect(ziel).toHaveAttribute('aria-checked', 'false');
    await ziel.click();
    await expect(ziel).toHaveAttribute('aria-checked', 'true');
    expect(k.lies('boards/entwicklung.md')).toContain('target: true}');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe(`Zieltermin von „Entwicklung“: „Deadline“ (${tag(20).split('-').reverse().join('.')})`);
  });
});
