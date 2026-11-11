// R00121 Kumulativer Fluss (CFD)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, filterOeffnen } = require('./hilfen');

function commitAm(ordner, datum, inhalt) {
  fs.writeFileSync(ordner + '/boards/fabrik.md', inhalt);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

const KOPF = '# fabrik\n\n## Eingang\n\n';
const AUFGABEN = {
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n',
};

/** Grundbestand der AK: Board „fabrik“ (Eingang/In Arbeit/Fertig), Bewegungen 01.11.–05.11.2026; #2 verlässt am 05.11. */
function grundbestand(ordner) {
  einrichten({ ...AUFGABEN, 'boards/fabrik.md': `${KOPF}\n\n## In Arbeit\n\n## Fertig\n` })(ordner);
  commitAm(ordner, '2026-11-01T09:00:00', `${KOPF}- #1\n\n## In Arbeit\n\n## Fertig\n`);
  commitAm(ordner, '2026-11-02T09:00:00', `${KOPF}- #2\n\n## In Arbeit\n\n- #1\n\n## Fertig\n`);
  commitAm(ordner, '2026-11-03T09:00:00', `${KOPF}- #3\n\n## In Arbeit\n\n- #2\n\n## Fertig\n\n- #1\n`);
  commitAm(ordner, '2026-11-04T09:00:00', `${KOPF}- #4\n\n## In Arbeit\n\n- #3\n\n## Fertig\n\n- #2\n- #1\n`);
  commitAm(ordner, '2026-11-05T09:00:00', `${KOPF}\n\n## In Arbeit\n\n- #4\n\n## Fertig\n\n- #3\n- #1\n`);
}

test('R00121 B0556: Menüeintrag in VERLAUF, Route, Fenstertitel und Kopfleiste', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('#t-ber').click();
    const menue = page.getByRole('menu', { name: 'Berichte' });
    const namen = await menue.getByRole('menuitem').allInnerTexts();
    const stelle = t => namen.findIndex(x => x.includes(t));
    expect(stelle('Burndown')).toBeLessThan(stelle('Kumulativer Fluss'));
    expect(stelle('Kumulativer Fluss')).toBeLessThan(stelle('Wie lange noch'));
    const eintrag = menue.getByRole('menuitem', { name: /Kumulativer Fluss/ });
    await expect(eintrag.locator('svg.i')).toHaveCount(1);
    await expect(eintrag).toContainText('Bestand je Spalte über die Zeit – gestapelte Bänder aus der Git-Geschichte dieses Boards.');
    await eintrag.click();
    await expect(page).toHaveURL(/#\/berichte\/fluss$/);
    await expect(page).toHaveTitle('Fluss — kanbanD');
    await expect(page.locator('#main .leiste').first()).toContainText('Kumulativer Fluss · liest nur · Bestand je Spalte über die Zeit');
  } finally { await k.stoppen(); }
});
