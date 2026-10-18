// R00057 Wirkungen von Aufgaben auf die WBS — Chips an Karte und Fenster, sofort in der WBS, Gegenanzeige in der WBS-Sicht.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'gruen'),
  zeile('D0002', 'Dialog', 'A0001', 'Board', 'gruen', { fertig: 'alle Interactions gruen' }),
  zeile('I0014', 'Interaction', 'D0002', 'Ziehen', 'gruen', { fertig: 'US-1' }),
  zeile('B0001', 'Bubble', 'I0014', 'Zug lesen', 'gruen', { ea: 'Maus → Zug', aufwand: '0,5-1' }),
  zeile('I0047', 'Interaction', 'D0002', 'Ansehen', 'gruen', { fertig: 'US-1' }),
]);
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#7](../aufgaben/0007-dialog-export-bauen.md)\n- [#8](../aufgaben/0008-ziehen-ueberarbeiten.md)\n\n## In Arbeit\n\n## Erledigt\n';
const aufgabe = (nr, titel, frontmatter = '') => `---\nid: ${nr}\ntitle: ${titel}\n${frontmatter}---\n`;

test.describe('R00057', () => {
  let k, arbeit;
  const starten = async (page, aufgaben) => {
    arbeit = arbeitsRepository(WBS);
    k = await kanbanStarten(mitRegister(arbeit, { 'boards/entwicklung.md': BOARD, ...aufgaben }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
  };
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });
  const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
  const z = (page, id) => page.locator(`tr.wbs-z[data-id="${id}"]`);

  test('Chips + / ↻ / − an Karte und Aufgabenfenster führen zur Zeile in der WBS-Sicht', async ({ page }) => {
    await starten(page, {
      'aufgaben/0007-dialog-export-bauen.md': aufgabe(7, 'Dialog Export bauen', 'wbs-effects:\n  - {application: kd, action: create, node: I0047, parent: D0002, level: Interaction, name: Ansehen, done-criterion: US-1}\n  - {application: kd, action: rework, node: D0002}\n  - {application: kd, action: remove, node: I0014}\n'),
      'aufgaben/0008-ziehen-ueberarbeiten.md': aufgabe(8, 'Ziehen überarbeiten'),
    });
    await expect(karte(page, 7).locator('.wchip')).toHaveText(['+ kd:I0047', '↻ kd:D0002', '− kd:I0014']);
    await expect(karte(page, 8).locator('.wchip')).toHaveCount(0);
    await karte(page, 7).locator('.t').click();
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #7' });
    await expect(fenster.locator('#wirkungen .wchip')).toHaveText(['+ kd:I0047', '↻ kd:D0002', '− kd:I0014']);
    await fenster.getByRole('link', { name: '↻ kd:D0002' }).click();
    await expect(page).toHaveURL(/#\/wbs\/kd\/D0002$/);
    await expect(fenster).toHaveCount(0);
    await expect(z(page, 'D0002')).toHaveClass(/\bziel\b/);
    await page.goBack();
    await karte(page, 7).getByRole('link', { name: '+ kd:I0047' }).click();
    await expect(z(page, 'I0047')).toBeVisible();
    await expect(z(page, 'I0047')).toHaveClass(/\bziel\b/);
  });

  const zweiAufgaben = () => ({ 'aufgaben/0007-dialog-export-bauen.md': aufgabe(7, 'Dialog Export bauen'), 'aufgaben/0008-ziehen-ueberarbeiten.md': aufgabe(8, 'Ziehen überarbeiten') });
  const oeffnen = async (page, nr) => { await karte(page, nr).locator('.t').click(); return page.getByRole('dialog', { name: `Aufgabe #${nr}` }); };

  test('US-1: Wirkung „anlegen“ im Aufgabenfenster — neuer roter Knoten, die Karte zeigt seine ID, Commit nur im Board-Repository', async ({ page }) => {
    await starten(page, zweiAufgaben());
    const boardVorher = +k.git('rev-list', '--count', 'HEAD'), arbeitVorher = arbeit.git('rev-list', '--count', 'HEAD');
    const fenster = await oeffnen(page, 7);
    await fenster.getByRole('button', { name: '+ Wirkung' }).click();
    const form = fenster.getByRole('group', { name: 'Neue Wirkung' });
    await expect(form.getByLabel('Aktion')).toHaveValue('create');
    await expect(form.getByLabel('Anwendung')).toHaveValue('kd');
    await form.getByLabel('Eltern').fill('D0002');
    await form.getByLabel('Name').fill('Export');
    await form.getByRole('button', { name: 'wirken' }).click();
    await expect(form.getByRole('alert')).toHaveText('Fertig-Kriterium fehlt — ein Knoten, ein Fertig-Kriterium');
    await form.getByLabel('Fertig').fill('US-1');
    await form.getByLabel('Fertig').press('Enter');
    await expect(form).toHaveCount(0);
    await expect(fenster.locator('#wirkungen .wchip')).toHaveText(['+ kd:I0048']);
    await page.keyboard.press('Escape');
    await expect(karte(page, 7).locator('.wchip')).toHaveText(['+ kd:I0048']);
    expect(arbeit.lies()).toContain('| I0048 | Interaction | D0002 | Export | rot | US-1 |');
    expect(k.lies('aufgaben/0007-dialog-export-bauen.md')).toContain('  - {application: kd, action: create, node: I0048, parent: D0002, level: Interaction, name: Export, done-criterion: US-1}');
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(boardVorher + 1);
    expect(k.git('log', '-1', '--format=%s')).toBe('#7 wirkt auf kd:I0048 (create)');
    expect(arbeit.git('rev-list', '--count', 'HEAD')).toBe(arbeitVorher);
  });

  test('US-2: „überarbeiten“ setzt den grünen Dialog samt Nachfahren rot; unbekannter Knoten lässt die Aufgabe unverändert', async ({ page }) => {
    await starten(page, zweiAufgaben());
    const fenster = await oeffnen(page, 8);
    await fenster.getByRole('button', { name: '+ Wirkung' }).click();
    const form = fenster.getByRole('group', { name: 'Neue Wirkung' });
    await form.getByLabel('Aktion').selectOption('rework');
    await expect(form.getByLabel('Eltern')).toHaveCount(0);
    await form.getByLabel('Knoten').fill('D0099');
    await form.getByLabel('Knoten').press('Enter');
    await expect(form.getByRole('alert')).toHaveText('Knoten „D0099“ steht nicht in der WBS');
    expect(k.lies('aufgaben/0008-ziehen-ueberarbeiten.md')).toBe(aufgabe(8, 'Ziehen überarbeiten'));
    await form.getByLabel('Knoten').fill('d0002');
    await form.getByRole('button', { name: 'wirken' }).click();
    await expect(fenster.locator('#wirkungen .wchip')).toHaveText(['↻ kd:D0002']);
    for (const id of ['D0002', 'I0014', 'B0001', 'I0047']) expect(arbeit.lies()).toMatch(new RegExp(`\\| ${id} \\| [^|]+ \\| [^|]+ \\| [^|]+ \\| rot \\|`));
  });

  test('US-3 und Entfernen: „verwerfen“ wirkt sofort; die Wirkung aus der Aufgabe nehmen lässt die WBS, wie sie ist', async ({ page }) => {
    await starten(page, zweiAufgaben());
    const fenster = await oeffnen(page, 8);
    await fenster.getByRole('button', { name: '+ Wirkung' }).click();
    const form = fenster.getByRole('group', { name: 'Neue Wirkung' });
    await form.getByLabel('Aktion').selectOption('remove');
    await form.getByLabel('Knoten').fill('I0014');
    await form.getByRole('button', { name: 'wirken' }).click();
    await expect(fenster.locator('#wirkungen .wchip')).toHaveText(['− kd:I0014']);
    expect(arbeit.lies()).toContain('| I0014 | Interaction | D0002 | Ziehen | verworfen |');
    expect(arbeit.lies()).toContain('verworfen: #8 Ziehen überarbeiten');
    const plan = arbeit.lies();
    await fenster.getByRole('button', { name: 'Wirkung − kd:I0014 entfernen' }).click();
    await expect(fenster.locator('#wirkungen .wchip')).toHaveCount(0);
    expect(k.lies('aufgaben/0008-ziehen-ueberarbeiten.md')).not.toContain('wbs-effects');
    expect(arbeit.lies()).toBe(plan);
  });
});
