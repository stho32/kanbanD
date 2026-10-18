// R00054 WBS-Sicht — das Arbeits-Repository ist ein eigenes Git-Repository neben dem kanbanD-Ordner.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const KOPF = '| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz | Phase |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
const zeile = (id, ebene, eltern, name, status, rest = {}) => `| ${id} | ${ebene} | ${eltern} | ${name} | ${status} | ${rest.fertig || ''} | ${rest.ea || ''} | ${rest.aufwand || ''} | ${rest.stufe || ''} | ${rest.braucht || ''} | ${rest.req || ''} | ${rest.notiz || ''} | ${rest.phase || ''} |\n`;
const WBS = '---\napplication: kanbanD\n---\n\n# WBS\n\n' + KOPF
  + zeile('A0001', 'Application', '—', 'kanbanD', 'gelb', { fertig: 'alle Dialogs gruen' })
  + zeile('D0001', 'Dialog', 'A0001', 'Board', 'gelb', { req: 'R00001' })
  + zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'gruen', { fertig: 'US-1', req: 'R00001', phase: 'Abnahme' })
  + zeile('B0001', 'Bubble', 'I0001', 'Board lesen', 'rot', { ea: 'Datei → Board', aufwand: '0,5-1' })
  + zeile('B0002', 'Bubble', 'I0001', 'Board zeigen', 'gruen', { ea: 'Board → HTML', aufwand: '1-2' })
  + zeile('I0002', 'Interaction', 'D0001', 'Bewegen', 'gelb', { braucht: 'I0001' })
  + zeile('F0001', 'Feature', 'I0002', 'Ziehen', 'gruen')
  + zeile('F0002', 'Feature', 'I0002', 'Tastatur', 'gelb')
  + zeile('F0003', 'Feature', 'I0002', 'Blockziffern', 'ausbau', { stufe: '2' })
  + zeile('F0004', 'Feature', 'I0002', 'Option B: Gesten', 'option')
  + zeile('D0002', 'Dialog', 'A0001', 'Berichte', 'rot')
  + zeile('I0003', 'Interaction', 'D0002', 'Burndown', 'rot');

/** Ein Arbeits-Repository: WBS committet, Anforderung R00001 im Anforderungsordner. */
function arbeitsRepository() {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-arbeit-')));
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.mkdirSync(path.join(r, 'Anforderungen'));
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/kanbanD.md'), WBS);
  fs.writeFileSync(path.join(r, 'Anforderungen/R00001-board.md'), '# R00001: Board\n');
  const git = (...a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' });
  git('init', '-q'); git('add', '-A'); git('-c', 'user.name=KI', '-c', 'user.email=k@k', 'commit', '-q', '-m', 'WBS');
  return { wurzel: r, wbs: path.join(r, 'Dokumentation/Planung/kanbanD.md'), git };
}

const mitRegister = arbeit => einrichten({
  'kanbanD.md': `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}\n---\n`,
});

test.describe('R00054', () => {
  let k, arbeit;
  test.beforeEach(async ({ page }) => {
    arbeit = arbeitsRepository();
    k = await kanbanStarten(mitRegister(arbeit));
    await alsPerson(page, 'st');
  });
  test.afterEach(async () => { await k.stoppen(); fs.rmSync(arbeit.wurzel, { recursive: true, force: true }); });

  test('US-1: g k öffnet die WBS der gebundenen Anwendung', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.locator('.kz-nav a', { hasText: 'WBS' })).toHaveAttribute('href', '#/wbs/kd');
    await page.locator('.ka, .bahn').first().waitFor();
    await page.keyboard.press('g');
    await page.keyboard.press('k');
    await expect(page).toHaveURL(/#\/wbs\/kd$/);
    await expect(page.locator('.wbs-titel')).toContainText('WBS · kanbanD');
    await expect(page.locator('.kz-nav a.an')).toHaveText('WBS');
  });
});
