// R00060 Zählen in Berichten je Aufgabe
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-arbeitspaket.md': '---\nid: 1\ntitle: Arbeitspaket\n---\n',
  'aufgaben/0002-anmerkung.md': '---\nid: 2\ntitle: Anmerkung\nreporting: {cycle-time: true}\n---\n',
};

test.describe('R00060', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  test('US-1 und US-2: „Wie lange noch“ ausschalten nimmt die Anmerkung live aus, zurücksetzen zeigt „(Standard)“', async ({ page, context }) => {
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    await liveBereit(page);
    await expect(page.locator('#wl-kopf')).toContainText('0 von 2 fertig');
    await expect(page.locator('#wl-ausgenommen')).toContainText(': 0.');
    const board = await context.newPage();
    await alsPerson(board, 'st');
    await board.goto(k.adresse + '#/board/entwicklung');
    await board.locator('.ka[data-id="2"]').click();
    const schalter = board.getByRole('button', { name: 'zählt in Wie lange noch' });
    await expect(schalter).toHaveAttribute('aria-pressed', 'true');
    await expect(schalter).toContainText('(Standard)');
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-pressed', 'false');
    await expect(schalter).not.toContainText('(Standard)');
    expect(k.lies('aufgaben/0002-anmerkung.md')).toContain('reporting:\n  forecast: false\n  cycle-time: true\n');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|#2 geändert: Zählen in Berichten');
    await expect(page.locator('#wl-kopf')).toContainText('0 von 1 fertig');
    await expect(page.locator('#wl-ausgenommen')).toContainText(': 1.');
    await board.goto(k.adresse + '#/berichte/verlauf');
    await expect(board.locator('#bd-nicht')).toContainText(': 0.', { timeout: 5000 });
    await expect(board.locator('.endwert.leise')).toHaveText('Umfang 2');
    await board.goto(k.adresse + '#/board/entwicklung');
    // das Aufgabenfenster bleibt beim Wechsel der Ansicht offen
    await board.getByRole('button', { name: 'zählt in Wie lange noch' }).click();
    await expect(board.getByRole('button', { name: 'zählt in Wie lange noch' })).toContainText('(Standard)');
    expect(k.lies('aufgaben/0002-anmerkung.md')).toContain('reporting:\n  cycle-time: true\n');
    await expect(page.locator('#wl-kopf')).toContainText('0 von 2 fertig');
  });
});
