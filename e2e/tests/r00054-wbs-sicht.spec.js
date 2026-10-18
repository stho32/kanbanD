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

  test('Tabelle: Einrückung, Ampel, Widerspruch, Ausbaustufe, Braucht, Anforderung', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    const z = id => page.locator(`tr.wbs-z[data-id="${id}"]`);
    await expect(page.locator('tr.wbs-z')).toHaveCount(12);
    const einzug = async id => parseFloat(await z(id).locator('td.wbs-name').evaluate(td => getComputedStyle(td).paddingLeft));
    const [a, d, i, b] = [await einzug('A0001'), await einzug('D0001'), await einzug('I0001'), await einzug('B0001')];
    expect(d - a).toBeCloseTo(18, 0); expect(i - d).toBeCloseTo(18, 0); expect(b - i).toBeCloseTo(18, 0);
    await expect(z('I0001')).toHaveClass(/\bgelb\b/);
    await expect(z('I0001').locator('.ampel.gerechnet')).toHaveText('gelb');
    await expect(z('I0001').locator('.wbs-widerspruch')).toHaveText('Datei: gruen');
    await expect(z('B0002').locator('.ampel')).not.toHaveClass(/gerechnet/);
    await expect(z('B0001')).toHaveClass(/\brot\b/);
    await expect(z('B0001').locator('td').nth(3)).toHaveText('Datei → Board');
    await expect(z('B0001').locator('td').nth(4)).toHaveText('0,5-1h');
    await expect(z('F0003').locator('.n')).toHaveText('2 · Blockziffern');
    await expect(z('I0002').locator('td.wbs-name')).toHaveAttribute('title', 'braucht: I0001');
    await expect(z('I0001').locator('a', { hasText: 'R00001' })).toHaveAttribute('href', `vscode://file${arbeit.wurzel}/Anforderungen/R00001-board.md`);
    await expect(z('I0001').locator('td').first().locator('a')).toHaveAttribute('href', `vscode://file${arbeit.wbs}:11`);
    await expect(z('I0001').locator('td').nth(2)).toHaveText(/Ansehen/);
  });

  test('US-2: Dialog zuklappen blendet Interactions und Bubbles aus, der Status bleibt', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    const z = id => page.locator(`tr.wbs-z[data-id="${id}"]`);
    await expect(z('I0002')).toBeVisible();
    await expect(z('I0003')).toBeHidden();
    await expect(z('B0001')).toBeHidden();
    await expect(z('D0002').getByRole('button', { name: 'D0002 aufklappen' })).toBeVisible();
    await z('D0001').getByRole('button', { name: 'D0001 zuklappen' }).click();
    for (const id of ['I0001', 'B0001', 'B0002', 'I0002', 'F0001', 'F0002']) await expect(z(id)).toBeHidden();
    await expect(z('D0001')).toBeVisible();
    await expect(z('D0001').locator('.ampel.gerechnet')).toHaveText('gelb');
    await page.reload();
    await expect(z('D0001')).toBeVisible();
    await expect(z('I0001')).toBeHidden();
    await z('D0001').getByRole('button', { name: 'D0001 aufklappen' }).click();
    await z('I0001').getByRole('button', { name: 'I0001 aufklappen' }).click();
    await expect(z('B0001')).toBeVisible();
  });

  test('US-1: Kopf zeigt Stand über die Slices, aktiven Pfad und was läuft', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await expect(page.locator('#wbs-stand')).toHaveText('25 % funktional · 50 % in Bearbeitung · 25 % offen');
    await expect(page.locator('.wbs-stand span')).toHaveText('1 von 4 Slices funktional · 2 in Bearbeitung · 1 offen');
    await expect(page.locator('.wbs-pfad')).toHaveText('kanbanD A0001›Board D0001›Bewegen I0002›Tastatur F0002');
    await expect(page.locator('.wbs-laufend')).toHaveText('Tastatur F0002');
    await expect(page.locator('.wbs-nc')).toHaveCount(0);
    await expect(page).toHaveTitle('25 % · WBS · kanbanD — kanbanD');
    await page.locator('tr.wbs-z[data-id="D0001"]').getByRole('button', { name: 'D0001 zuklappen' }).click();
    await page.locator('.wbs-laufend').getByRole('button', { name: /Tastatur/ }).click();
    await expect(page.locator('tr.wbs-z[data-id="F0002"]')).toBeVisible();
    await expect(page.locator('tr.wbs-z[data-id="F0002"]')).toHaveClass(/ziel/);
  });

  test('US-3: Editor im Arbeits-Repository setzt B0001 auf gruen — Zeile wird ohne Neuladen grün, nicht committet bis zum Commit', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 420 });
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    const z = id => page.locator(`tr.wbs-z[data-id="${id}"]`);
    await z('I0001').getByRole('button', { name: 'I0001 aufklappen' }).click();
    await expect(z('B0001')).toHaveClass(/\brot\b/);
    await page.locator('.wbs-seite').evaluate(el => { el.scrollTop = 120; });
    let geladen = 0;
    page.on('framenavigated', () => { geladen++; });
    fs.writeFileSync(arbeit.wbs, WBS.replace('| B0001 | Bubble | I0001 | Board lesen | rot |', '| B0001 | Bubble | I0001 | Board lesen | gruen |'));
    await expect(z('B0001')).toHaveClass(/\bgruen\b/);
    await expect(z('I0001').locator('.ampel')).toHaveText('gruen');
    await expect(z('I0001').locator('.wbs-widerspruch')).toHaveCount(0);
    await expect(page.locator('#wbs-stand')).toHaveText('50 % funktional · 25 % in Bearbeitung · 25 % offen');
    await expect(page.locator('.wbs-nc')).toHaveText('nicht committet');
    expect(await page.locator('.wbs-seite').evaluate(el => el.scrollTop)).toBe(120);
    arbeit.git('-c', 'user.name=KI', '-c', 'user.email=k@k', 'commit', '-q', '-am', 'B0001 gruen');
    await expect(page.locator('.wbs-nc')).toHaveCount(0);
    expect(geladen).toBe(0);
    expect(k.git('status', '--porcelain')).toBe('');
  });

  test('WBS verschoben: Hinweis statt Tabelle, zurückgelegt erscheint sie ohne Neuladen; unbekanntes Kürzel', async ({ page }) => {
    await page.goto(k.adresse + '#/wbs/kd');
    await liveBereit(page);
    await expect(page.locator('tr.wbs-z')).toHaveCount(12);
    fs.renameSync(arbeit.wbs, arbeit.wbs + '.weg');
    await expect(page.locator('.warnh')).toContainText('WBS von „kd“ nicht erreichbar');
    fs.renameSync(arbeit.wbs + '.weg', arbeit.wbs);
    await expect(page.locator('tr.wbs-z')).toHaveCount(12);
    await page.goto(k.adresse + '#/wbs/xx');
    await expect(page.locator('.warnh')).toHaveText('Anwendung „xx“ steht nicht im Register');
  });

  test('Board ohne Bindung bei zwei Anwendungen: kein Menüpunkt, g k erklärt die Bindung', async ({ page }) => {
    const zweite = arbeitsRepository();
    try {
      const text = k.lies('kanbanD.md').replace('---\n', '').replace(/\n---\n$/, `\n    kc: {name: Kasse, wbs: "${zweite.wbs}", requirements: ""}\n---\n`);
      k.schreib('kanbanD.md', '---\n' + text);
      await page.goto(k.adresse);
      await page.locator('.bahn').first().waitFor();
      await expect(page.locator('.kz-nav a', { hasText: 'WBS' })).toHaveCount(0);
      await page.keyboard.press('g');
      await page.keyboard.press('k');
      await expect(page.locator('.body.bericht')).toContainText('Dieses Board ist an keine Anwendung gebunden');
      k.schreib('boards/entwicklung.md', '---\napplications: [kc, kd]\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n');
      await expect(page.locator('.kz-nav a', { hasText: 'WBS · kc' })).toHaveAttribute('href', '#/wbs/kc');
      await expect(page.locator('.kz-nav a', { hasText: 'WBS · kd' })).toBeVisible();
    } finally { fs.rmSync(zweite.wurzel, { recursive: true, force: true }); }
  });
});
