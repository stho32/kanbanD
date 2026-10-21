// R00065 Mehrfachauswahl auf dem Board
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const titel = ['eins', 'zwei', 'drei', 'vier', 'fünf'];
const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n- #4\n\n## Erledigt\n\n- #5\n',
  'boards/test.md': '# Test\n\n## Bereit\n\n- #2\n',
  ...Object.fromEntries(titel.map((t, i) => [`aufgaben/000${i + 1}-k${i + 1}.md`, `---\nid: ${i + 1}\ntitle: ${t}\n${i === 0 ? 'assignees: [mi]\n' : ''}---\n`])),
};

/** Nummern je Spalte aus der Board-Datei. */
function spalten(text) {
  const erg = {};
  let akt = null;
  for (const z of text.split('\n')) {
    if (z.startsWith('## ')) { akt = z.slice(3); erg[akt] = []; } else if (akt && /^- \[?#(\d+)/.test(z)) erg[akt].push(+/#(\d+)/.exec(z)[1]);
  }
  return erg;
}
const ANFANG = { 'Zu erledigen': [1, 2, 3], 'In Arbeit': [4], 'Erledigt': [5] };

test.describe('R00065', () => {
  let k;
  const karte = (page, n) => page.locator(`.ka[data-id="${n}"]`);
  const commits = () => +k.git('rev-list', '--count', 'HEAD');
  const brett = () => spalten(k.lies('boards/entwicklung.md'));
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); await page.goto(k.adresse); });
  test.afterEach(() => k.stoppen());

  test('US-1: Strg und Umschalt wählen aus, Esc hebt auf', async ({ page }) => {
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 3).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(2);
    await expect(karte(page, 3)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#stat')).toContainText('2 Karten ausgewählt');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await karte(page, 3).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(1);
    // Anker ist #3 (zuletzt mit Strg geklickt), die Reihe läuft in Lesereihenfolge bis #4 in der nächsten Spalte
    await karte(page, 4).click({ modifiers: ['Shift'] });
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(2);
    await expect(karte(page, 3)).toHaveClass(/gewaehlt/);
    await expect(karte(page, 4)).toHaveClass(/gewaehlt/);
    await karte(page, 1).click({ modifiers: ['Shift'] });
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(3, { timeout: 2000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(0);
    await expect(page.locator('#stat')).not.toContainText('ausgewählt');
    // ein normaler Klick öffnet wie bisher und hebt die Auswahl auf
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 2).click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(0);
  });

  test('US-1: Umschalt + ↓ erweitert die Auswahl, ohne zu verschieben', async ({ page }) => {
    await karte(page, 1).focus();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(2);
    await expect(karte(page, 2)).toBeFocused();
    await page.keyboard.press('Shift+ArrowDown');
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(3);
    expect(brett()).toEqual(ANFANG);
  });

  test('US-2: Verschieben über das Menü „n Karten“, ein Commit, Strg + Z legt zurück', async ({ page }) => {
    const vorher = commits();
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 3).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 4).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 3).click({ button: 'right' });
    const menue = page.getByRole('menu', { name: '3 Karten' });
    await expect(menue).toBeVisible();
    await menue.getByRole('menuitem', { name: /Verschieben nach/ }).hover();
    await page.getByRole('menuitem', { name: 'Erledigt' }).click();
    await expect.poll(brett).toEqual({ 'Zu erledigen': [2], 'In Arbeit': [], 'Erledigt': [5, 1, 3, 4] });
    await expect.poll(commits).toBe(vorher + 1);
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(3);
    await expect(page.getByRole('status').getByRole('button', { name: 'rückgängig' })).toBeVisible(); // Strg + Z wirkt erst, wenn die Meldung steht
    await page.keyboard.press('Control+z');
    await expect.poll(brett).toEqual(ANFANG);
    await expect.poll(commits).toBe(vorher + 2);
  });

  test('US-2: Rechtsklick auf eine nicht ausgewählte Karte öffnet ihr eigenes Menü und hebt die Auswahl auf', async ({ page }) => {
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 3).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 2).click({ button: 'right' });
    await expect(page.getByRole('menu', { name: '#2 zwei' })).toBeVisible();
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(0);
  });

  test('US-2: Klasse, Fälligkeit, Mir zuweisen und Auf Board legen je in einem Commit', async ({ page }) => {
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 3).click({ modifiers: ['ControlOrMeta'] });
    const vorher = commits();
    const menue = async () => { await karte(page, 1).click({ button: 'right' }); return page.getByRole('menu', { name: '2 Karten' }); };
    await (await menue()).getByRole('menuitem', { name: /^Klasse/ }).hover();
    await page.getByRole('menuitem', { name: 'Fehler' }).click();
    await expect.poll(() => k.lies('aufgaben/0003-k3.md')).toContain('class: bug');
    expect(k.lies('aufgaben/0001-k1.md')).toContain('class: bug');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1, #3 geändert: Klasse (2 Aufgaben)');
    await (await menue()).getByRole('menuitem', { name: /^Fälligkeit/ }).hover();
    await page.getByRole('menuitem', { name: 'morgen' }).click();
    await expect.poll(() => k.lies('aufgaben/0003-k3.md')).toContain('due:');
    await (await menue()).getByRole('menuitem', { name: 'Mir zuweisen' }).click();
    await expect.poll(() => k.lies('aufgaben/0003-k3.md')).toContain('assignees: [st]');
    expect(k.lies('aufgaben/0001-k1.md')).toContain('assignees: [mi, st]');
    await (await menue()).getByRole('menuitem', { name: /Auf Board legen/ }).hover();
    await page.getByRole('menuitem', { name: 'Test · Bereit' }).click();
    await expect.poll(() => spalten(k.lies('boards/test.md'))).toEqual({ Bereit: [2, 1, 3] });
    await expect.poll(commits).toBe(vorher + 4);
  });

  test('US-2: Archivieren in einem Commit, Strg + Z holt alle zurück', async ({ page }) => {
    await karte(page, 2).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 4).click({ modifiers: ['ControlOrMeta'] });
    const vorher = commits();
    await karte(page, 4).click({ button: 'right' });
    await page.getByRole('menu', { name: '2 Karten' }).getByRole('menuitem', { name: 'Archivieren' }).click();
    await expect(karte(page, 2)).toHaveCount(0);
    await expect(karte(page, 4)).toHaveCount(0);
    await expect.poll(commits).toBe(vorher + 1);
    await expect(page.getByRole('status').getByRole('button', { name: 'rückgängig' })).toBeVisible(); // Strg + Z wirkt erst, wenn die Meldung steht
    await page.keyboard.press('Control+z');
    await expect(karte(page, 2)).toBeVisible();
    await expect(karte(page, 4)).toBeVisible();
  });

  test('US-3: Ziehen einer ausgewählten Karte nimmt alle mit, Strg + Z macht den Zug rückgängig', async ({ page }) => {
    await karte(page, 4).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    const vorher = commits();
    await karte(page, 4).dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'), { targetPosition: { x: 20, y: 200 } });
    await expect.poll(brett).toEqual({ 'Zu erledigen': [2, 3], 'In Arbeit': [], 'Erledigt': [5, 1, 4] });
    await expect.poll(commits).toBe(vorher + 1);
    await expect(page.getByRole('status').getByRole('button', { name: 'rückgängig' })).toBeVisible(); // Strg + Z wirkt erst, wenn die Meldung steht
    await page.keyboard.press('Control+z');
    await expect.poll(brett).toEqual(ANFANG);
    // erst ziehen, wenn die Oberfläche den zurückgelegten Stand zeigt — sonst ersetzt das Neuzeichnen die Karte unter dem Zeiger
    await expect(page.getByRole('status')).toContainText('2 Karten zurückgelegt');
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .id')).toHaveText(['#1', '#2', '#3']);
    // eine nicht ausgewählte Karte zieht allein
    await karte(page, 2).dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'), { targetPosition: { x: 20, y: 200 } });
    await expect.poll(brett).toEqual({ 'Zu erledigen': [1, 3], 'In Arbeit': [4, 2], 'Erledigt': [5] });
  });

  test('US-4: Zuständige für mehrere — gemischt bleibt je Karte', async ({ page }) => {
    await karte(page, 1).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 2).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 1).click({ button: 'right' });
    await page.getByRole('menu', { name: '2 Karten' }).getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Zuständige für 2 Karten' });
    await expect(dialog.getByRole('checkbox', { name: /Mia/ })).toBeChecked({ indeterminate: true });
    await dialog.getByRole('checkbox', { name: /Claude/ }).check();
    const vorher = commits();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect.poll(() => k.lies('aufgaben/0002-k2.md')).toContain('assignees: [cl]');
    expect(k.lies('aufgaben/0001-k1.md')).toContain('assignees: [mi, cl]');
    await expect.poll(commits).toBe(vorher + 1);
    // ein Klick auf „gemischt“ setzt auf allen, ein weiterer nimmt auf allen ab
    await karte(page, 1).click({ button: 'right' });
    await page.getByRole('menu', { name: '2 Karten' }).getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    await dialog.getByRole('checkbox', { name: /Mia/ }).click();
    await expect(dialog.getByRole('checkbox', { name: /Mia/ })).toBeChecked();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect.poll(() => k.lies('aufgaben/0002-k2.md')).toContain('assignees: [cl, mi]');
  });
});
