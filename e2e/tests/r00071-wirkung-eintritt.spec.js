// R00071 Wirkungen vermerken und eintreten lassen — anbinden ohne Änderung, Ampel aus der WBS, Schalter hin und zurück.
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
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#8](../aufgaben/0008-ziehen.md)\n\n## Erledigt\n';

test.describe('R00071', () => {
  let k, arbeit;
  test.beforeEach(async ({ page }) => {
    arbeit = arbeitsRepository(WBS);
    k = await kanbanStarten(mitRegister(arbeit, { 'boards/entwicklung.md': BOARD, 'aufgaben/0008-ziehen.md': '---\nid: 8\ntitle: Ziehen\n---\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
  });
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  const vermerken = async (page, aktion, knoten) => {
    await page.locator('.ka[data-id="8"] .t').click();
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #8' });
    await fenster.getByRole('button', { name: '+ Wirkung' }).click();
    const form = fenster.getByRole('group', { name: 'Neue Wirkung' });
    await form.getByLabel('Aktion').selectOption(aktion);
    await form.getByLabel('Knoten').fill(knoten);
    await form.getByRole('button', { name: 'vermerken' }).click();
    await expect(form).toHaveCount(0);
    return fenster;
  };

  test('US-1: einen grünen Knoten anbinden — er bleibt grün, die WBS-Sicht zeigt die Karte, die Ampel ist rot', async ({ page }) => {
    const plan = arbeit.lies();
    const fenster = await vermerken(page, 'rework', 'I0014');
    await expect(fenster.locator('#wirkungen .ampel')).toHaveClass(/\baus\b/);
    await expect(fenster.getByRole('button', { name: 'Wirkung ↻ kd:I0014 eingetreten' })).toHaveAttribute('aria-pressed', 'false');
    expect(arbeit.lies()).toBe(plan);
    expect(k.lies('aufgaben/0008-ziehen.md')).toContain('  - {application: kd, action: rework, node: I0014, executed: false}');
    await fenster.getByRole('link', { name: '↻ kd:I0014' }).click();
    const z = page.locator('tr.wbs-z[data-id="I0014"]');
    await expect(z.locator('.wbs-aufgabe')).toHaveText(['#8']);
    await expect(z).toHaveClass(/\bgruen\b/);
  });

  test('US-2: Schalter hin und zurück — remove verwirft und hebt das Verwerfen wieder auf; die Ampel folgt der WBS', async ({ page }) => {
    const fenster = await vermerken(page, 'remove', 'I0014');
    const schalter = fenster.getByRole('button', { name: 'Wirkung − kd:I0014 eingetreten' });
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-pressed', 'true');
    await expect(fenster.locator('#wirkungen .ampel')).toHaveClass(/\ban\b/);
    expect(arbeit.lies()).toContain('| I0014 | Interaction | D0002 | Ziehen | verworfen |');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|#8 Wirkung auf kd:I0014 (remove) eingetreten');
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-pressed', 'false');
    await expect(fenster.locator('#wirkungen .ampel')).toHaveClass(/\baus\b/);
    expect(arbeit.lies()).toContain('| I0014 | Interaction | D0002 | Ziehen | rot |');
    expect(arbeit.lies()).not.toContain('verworfen: #8');
    expect(k.git('log', '-1', '--format=%s')).toBe('#8 Wirkung auf kd:I0014 (remove) zurückgenommen');
  });
});
