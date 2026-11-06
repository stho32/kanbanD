// R00104 Board-Name als Pfad — Nacharbeit B0345 (Entwicklertest #48): ein Board, dessen Dateiname nicht die
// Form eines Board-Namens hat, steht im Board-Menü als „defekt“; gewählt zeigt es die Defektfläche wie ein
// defektes Board (R00025) statt eines unbehandelten Seitenfehlers, und zurück zu einem gültigen Board geht.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const ENTWICKLUNG = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n';

test.describe('R00104', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('B0345: handbenanntes Board im Menü gewählt — Hinweis statt Seitenfehler, zurück geht', async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': ENTWICKLUNG,
      'boards/Alt_Board.md': '# Alt\n\n## Offen\n',
      'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
    }));
    const seitenfehler = [];
    page.on('pageerror', e => seitenfehler.push(e.message));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await expect(page.locator('.ka[data-id="1"]')).toBeVisible();

    await page.locator('#t-board').click();
    await page.getByRole('dialog', { name: 'Boards' }).getByRole('button', { name: /Alt_Board/ }).click();

    await expect(page).toHaveURL(/#\/board\/Alt_Board$/);
    await expect(page.getByRole('alert')).toContainText('boards/Alt_Board.md ist defekt');
    await expect(page.getByRole('alert')).toContainText('Dateiname ist kein gültiger Board-Name — umbenennen');
    await expect(page.locator('#t-board')).not.toContainText('Entwicklung');
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(0);
    expect(seitenfehler).toEqual([]);

    await page.locator('#t-board').click();
    await page.getByRole('dialog', { name: 'Boards' }).getByRole('button', { name: /Entwicklung/ }).click();
    await expect(page).toHaveURL(/#\/board\/entwicklung$/);
    await expect(page.locator('#t-board')).toContainText('Entwicklung');
    await expect(page.locator('.ka[data-id="1"]')).toBeVisible();
    expect(seitenfehler).toEqual([]);
  });
});
