// R00073 Diagramme im Vollbild, Datum überall unter dem Zeiger
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const p2 = x => String(x).padStart(2, '0');
const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T10:00:00`; };
const tagDatum = s => { const [j, m, t] = s.slice(0, 10).split('-'); return `${t}.${m}.${j}`; };
function commitAm(ordner, datum, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const board = (zu, arbeit, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${zu.map(n => `- #${n}\n`).join('')}\n## In Arbeit\n\n${arbeit.map(n => `- #${n}\n`).join('')}\n## Erledigt\n\n${fertig.map(n => `- #${n}\n`).join('')}`;
const aufgaben = n => Object.fromEntries([...Array(n)].map((_, i) => [`aufgaben/000${i + 1}-a${i + 1}.md`, `---\nid: ${i + 1}\ntitle: a${i + 1}\n---\n`]));

/** Fährt mit der Maus auf eine Stelle des Diagramms, angegeben in Koordinaten seiner viewBox. */
async function zeigeAuf(page, svg, x, y) {
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + y * s);
}
const tooltip = page => page.locator('#tooltip');

test.describe('R00073 Wie lange noch', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(async ordner => {
      einrichten(aufgaben(6))(ordner);
      commitAm(ordner, vorTagen(5), board([1, 2, 3, 4, 5, 6], [], []));
      commitAm(ordner, vorTagen(4), board([2, 3, 4, 5, 6], [], [1]));
      commitAm(ordner, vorTagen(3), board([4, 5, 6], [3], [1, 2]));
      commitAm(ordner, vorTagen(2), board([4, 5, 6], [], [1, 2, 3]));
      commitAm(ordner, vorTagen(1), board([5, 6], [4], [1, 2, 3]));
    });
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('#wl-kopf')).toContainText('3 von 6 fertig');
  });
  test.afterEach(() => k.stoppen());
  const diagramm = page => page.getByRole('img', { name: /Prognose/ });

  test('US-2 und US-3: Tooltip bis heute und in der Zukunft, Achse mit Jahr', async ({ page }) => {
    const svg = diagramm(page);
    await zeigeAuf(page, svg, 49, 200);
    await expect(tooltip(page).locator('b')).toHaveText(new RegExp(`${tagDatum(vorTagen(5))}$`));
    await expect(tooltip(page)).toContainText('Umfang 6');
    await zeigeAuf(page, svg, 930, 200);
    await expect(tooltip(page)).toBeVisible();
    const kopf = await tooltip(page).locator('b').textContent();
    const [t, m, j] = kopf.match(/(\d\d)\.(\d\d)\.(\d{4})$/).slice(1).map(Number);
    expect(new Date(j, m - 1, t).getTime()).toBeGreaterThan(Date.now());
    await expect(tooltip(page)).toContainText(/„Erledigt“ erreicht bis dahin: \d+ % · \d+ % in der 5-Tage-Woche/);
    await expect(tooltip(page)).toContainText(/„In Arbeit“ erreicht bis dahin: (\d+ %|erreicht)/);
    const achse = svg.locator('text.achse-x').first();
    await expect(achse.locator('tspan')).toHaveText([/^\d\d\.\d\d\.$/, /^\d{4}$/]);
    await page.mouse.move(1, 1);
    await expect(tooltip(page)).toBeHidden();
  });

  test('US-1: Vollbild übersteht das Live-Neuzeichnen, Esc beendet', async ({ page }) => {
    await liveBereit(page);
    await page.getByRole('button', { name: 'Diagramm im Vollbild' }).click();
    const flaeche = page.locator('.dflaeche');
    await expect(flaeche).toHaveClass(/\bvollbild\b/);
    const groesse = page.viewportSize(), kasten = await flaeche.boundingBox();
    expect([kasten.x, kasten.y, kasten.width, kasten.height]).toEqual([0, 0, groesse.width, groesse.height]);
    await page.request.post(k.adresse + 'api/boards/entwicklung/bewegen', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { nummer: 4, spalte: 'Erledigt', index: 3 } });
    await expect(page.locator('#wl-kopf')).toContainText('4 von 6 fertig');
    await expect(flaeche).toHaveClass(/\bvollbild\b/);
    await zeigeAuf(page, diagramm(page), 930, 200);
    await expect(tooltip(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(flaeche).not.toHaveClass(/\bvollbild\b/);
    await expect(page.getByRole('button', { name: 'Diagramm im Vollbild' })).toBeVisible();
  });
});

test('US-3: Durchlaufzeit und Burndown — Datum mit Jahr auf der ganzen Fläche', async ({ page }) => {
  const k = await kanbanStarten(async ordner => {
    einrichten(aufgaben(2))(ordner);
    const kopf = '# Entwicklung\n\n## Zu erledigen\n\n';
    commitAm(ordner, '2026-10-01T09:00:00', `${kopf}- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n`);
    commitAm(ordner, '2026-10-02T09:00:00', `${kopf}- #2\n\n## In Arbeit\n\n## Erledigt\n\n- #1\n`);
    commitAm(ordner, '2026-10-05T21:00:00', `${kopf}## In Arbeit\n\n## Erledigt\n\n- #1\n- #2\n`);
  });
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/durchlauf');
    const streu = page.getByRole('img', { name: /Durchlaufzeit je Aufgabe/ });
    await expect(streu.locator('circle')).toHaveCount(2);
    // leere Fläche zwischen den Punkten: Achse 02.10. 09:00 bis 05.10. 21:00 (84 h) über 650 Einheiten ab x = 40; 33 h = 03.10. 18:00
    await zeigeAuf(page, streu, 40 + 650 * 33 / 84, 40);
    await expect(tooltip(page).locator('b')).toHaveText('Ankunft Sa 03.10.2026');
    await expect(tooltip(page)).toContainText('keine Aufgabe angekommen');
    await zeigeAuf(page, streu, 41, 40);
    await expect(tooltip(page)).toContainText('#1 a1 · 1,0 Tage');
    await expect(streu.locator('text.achse-x').first().locator('tspan')).toHaveText(['02.10.', '2026']);
    await page.goto(k.adresse + '#/berichte/verlauf');
    const bd = page.getByRole('img', { name: 'Offene Aufgaben je Tag' });
    await zeigeAuf(page, bd, 37, 100);
    await expect(tooltip(page).locator('b')).toHaveText('Do 01.10.2026');
    await expect(tooltip(page)).toContainText('offen 2');
    await expect(bd.locator('text.achse-x').first().locator('tspan')).toHaveText(['01.10.', '2026']);
  } finally { await k.stoppen(); }
});
