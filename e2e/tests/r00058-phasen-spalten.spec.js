// R00058 Phasen als Spalten
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, alsPerson } = require('./hilfen');
const { arbeitsRepository, mitRegister, wbsText, zeile } = require('./wbs-hilfen');

const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00:00`; };
const KOPF = '---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\n---\n\n# Entwicklung\n';
/** Board-Text: je Spalte die Nummern darin. */
const board = spalten => KOPF + Object.entries(spalten).map(([s, n]) => `\n## ${s}\n\n${n.map(x => `- #${x}\n`).join('')}`).join('');
function commitAm(ordner, datum, text) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', text);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const aufgaben = n => Object.fromEntries([...Array(n)].map((_, i) => [`aufgaben/000${i + 1}-a${i + 1}.md`, `---\nid: ${i + 1}\ntitle: a${i + 1}\n---\n`]));

test.describe('R00058', () => {
  let k, arbeit;
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('US-3: Wie lange noch zeigt je Phase einen Block „… durchlaufen“ mit Perzentilen', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    k = await kanbanStarten(async ordner => {
      mitRegister(arbeit, aufgaben(6))(ordner);
      const leer = { Backlog: [], Entwicklung: [], Entwicklertest: [], Abnahme: [], Erledigt: [] };
      commitAm(ordner, vorTagen(7), board({ ...leer, Entwicklung: [1, 2, 3, 4, 5, 6] }));
      commitAm(ordner, vorTagen(6), board({ ...leer, Entwicklung: [2, 3, 4, 5, 6], Entwicklertest: [1] }));
      commitAm(ordner, vorTagen(5), board({ ...leer, Entwicklung: [3, 4, 5, 6], Entwicklertest: [2], Abnahme: [1] }));
      commitAm(ordner, vorTagen(4), board({ ...leer, Entwicklung: [4, 5, 6], Entwicklertest: [3], Abnahme: [2], Erledigt: [1] }));
      commitAm(ordner, vorTagen(3), board({ ...leer, Entwicklung: [5, 6], Entwicklertest: [4], Abnahme: [3], Erledigt: [1, 2] }));
      commitAm(ordner, vorTagen(2), board({ ...leer, Entwicklung: [6], Entwicklertest: [5], Abnahme: [4], Erledigt: [1, 2, 3] }));
    });
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('#wl-kopf')).toHaveText('3 von 6 fertig · Entwicklung durchlaufen 5 von 6 · Entwicklertest durchlaufen 4 von 6');
    for (const phase of ['Entwicklung', 'Entwicklertest', 'Abnahme']) {
      const block = page.locator(`.wl-phase[data-phase="${phase}"]`);
      await expect(block.locator('h3')).toContainText(`${phase} durchlaufen`);
      await expect(block.locator('tbody tr td:first-child')).toHaveText(['50 %', '70 %', '85 %', '95 %']);
    }
    await expect(page.locator('.wl-phase[data-phase="Abnahme"]')).toContainText('3 VON 6 DURCHLAUFEN');
    await expect(page.locator('.wl-phase[data-phase="Abnahme"] thead')).toContainText('Nicht vor (Vorphase)');
    await expect(page.locator('.wl-legende')).toContainText('„Abnahme“ noch nicht durchlaufen');
  });
});

test.describe('R00058 Hinweis', () => {
  let k, arbeit;
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('Spalte einer späteren Phase links einer früheren: Hinweis am Board, Phase im Spaltenkopf', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    k = await kanbanStarten(mitRegister(arbeit, {
      'boards/entwicklung.md': '---\ncolumn-phases:\n  Abnahme Mia: Abnahme\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n---\n\n# Entwicklung\n\n## Abnahme Mia\n\n## Entwicklung\n\n## Entwicklertest\n\n## Erledigt\n',
    }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('#phasen-hinweis')).toContainText('„Abnahme Mia“ (Abnahme) steht links von „Entwicklung“ — die Phasenfolge ist Entwicklung → Entwicklertest → Abnahme');
    await expect(page.locator('.bahn[data-col="Abnahme Mia"] .bahn-kopf .ph')).toHaveText('Abnahme');
    await expect(page.locator('.bahn[data-col="Entwicklung"] .bahn-kopf .ph')).toHaveCount(0);
    expect(k.git('log', '--format=%s')).not.toContain('Phasen-Spalten'); // nichts fehlt, nichts wird umgeordnet
  });
});

test.describe('R00058 entfällt', () => {
  let k, arbeit;
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('Schalter im Aufgabenfenster setzt und entfernt phases.skipped', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    k = await kanbanStarten(mitRegister(arbeit, {
      ...aufgaben(1),
      'boards/entwicklung.md': '# Entwicklung\n\n## Entwicklung\n\n- #1\n\n## Erledigt\n',
    }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .t').click();
    const feld = page.locator('#phasen-entfallen');
    await expect(feld.getByRole('button')).toHaveText(['Entwicklertest entfällt', 'Abnahme entfällt']);
    await feld.getByRole('button', { name: 'Abnahme entfällt' }).click();
    await expect(feld.getByRole('button', { name: 'Abnahme entfällt' })).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => k.lies('aufgaben/0001-a1.md')).toContain('phases:\n  skipped: [Abnahme]\n');
    expect(k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Phasen');
    await feld.getByRole('button', { name: 'Abnahme entfällt' }).click();
    await expect.poll(() => k.lies('aufgaben/0001-a1.md')).not.toContain('phases');
  });
});
