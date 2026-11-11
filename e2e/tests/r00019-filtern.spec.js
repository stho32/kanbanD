// R00019 Filtern
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: Kopfzeile verdichten\nclass: feature\nassignees: [st]\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: Absturz beim Start\nclass: bug\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: Dateiwächter\nclass: bug\nassignees: [cl]\n---\n',
};

test.describe('R00019', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: nach Klasse filtern, Spaltenzahlen zählen Treffer', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Filter').fill('class:bug');
    await expect(page.locator('.ka')).toHaveCount(2);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .bahn-kopf .n')).toHaveText('1');
    await expect(page.locator('.bahn[data-col="Erledigt"] .leer')).toHaveText('keine Treffer');
    await page.reload();
    await expect(page.getByLabel('Filter')).toHaveValue('class:bug');
  });

  test('US-2: Legende schaltet den Klassenfilter', async ({ page }) => {
    await page.goto(k.adresse);
    const fehler = page.getByRole('button', { name: /Fehler/ });
    await expect(fehler.locator('.n')).toHaveText('2');
    await fehler.click();
    await expect(page.getByLabel('Filter')).toHaveValue('class:bug');
    await expect(page.locator('.ka')).toHaveCount(2);
    await page.getByRole('button', { name: /Fehler/ }).click();
    await expect(page.getByLabel('Filter')).toHaveValue('');
    await expect(page.locator('.ka')).toHaveCount(3);
  });

  test('US-3: meine Karten und Tastatur', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('radio', { name: 'meine' }).click();
    await expect(page.locator('.ka .id')).toHaveText(['#1']);
    await page.getByRole('radio', { name: 'Agenten' }).click();
    await expect(page.locator('.ka .id')).toHaveText(['#3']);
    await page.getByRole('radio', { name: 'alle' }).click();
    await page.keyboard.press('/');
    await expect(page.getByLabel('Filter')).toBeFocused();
    await page.keyboard.type('#2');
    await expect(page.locator('.ka .id')).toHaveText(['#2']);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Filter')).toHaveValue('');
    await expect(page.locator('.ka')).toHaveCount(3);
  });
});

// Karte #31: freie Wörter suchen in Beschreibung, Kommentaren und Teilaufgaben
const VOLLTEXT = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: Dateiwächter\nclass: bug\n---\n\nDie Wartung läuft nachts.\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: Sammelstelle\nclass: bug\n---\n\nEin Kommentar nennt die Wartung.\n\n```kanbanD-comments\n2026-11-11 10:00+01:00 · st · Die Wartung des Schiebers\n```\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: Prüfliste\nclass: bug\n---\n\n- [ ] Schieber justieren\n',
};

test.describe('R00019 US-4', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(VOLLTEXT)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-4: freies Wort in Beschreibung, Kommentar und Teilaufgabe', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Filter').fill('wartung');
    await expect(page.locator('.ka .id')).toHaveText(['#1', '#2']);
    await page.getByLabel('Filter').fill('schieber');
    await expect(page.locator('.ka .id')).toHaveText(['#2', '#3']);
    await page.getByLabel('Filter').fill('WARTUNG');
    await expect(page.locator('.ka .id')).toHaveText(['#1', '#2']);
  });

  test('US-4: Felder ODER, Wörter UND', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByLabel('Filter').fill('wartung schieber');
    await expect(page.locator('.ka .id')).toHaveText(['#2']);
    await page.getByLabel('Filter').fill('wartung spindel');
    await expect(page.locator('.ka')).toHaveCount(0);
  });

  test('US-4: Platzhalter nennt die Textfelder; / fokussiert, Esc leert', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(page.getByLabel('Filter')).toHaveAttribute('placeholder', /^Filtern: Text,/);
    await expect(page.getByLabel('Filter')).not.toHaveAttribute('placeholder', /Titel/);
    await page.keyboard.press('/');
    await expect(page.getByLabel('Filter')).toBeFocused();
    await page.keyboard.type('wartung');
    await expect(page.locator('.ka .id')).toHaveText(['#1', '#2']);
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Filter')).toHaveValue('');
  });
});
