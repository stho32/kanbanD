// R00097 F0015 Eigentümer in der Oberfläche
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, ausMehr } = require('./hilfen');

const MENSCH = 'Spalte gehört dem Menschen — Agenten können Karten hineinlegen, aber nicht herausnehmen';
const AGENT = 'Spalte gehört den Agenten — kennzeichnet nur, sperrt nichts';
const KEINER = 'Kein Eigentümer — Menschen und Agenten nehmen Karten frei heraus';
const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Eingang\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};
const board = async k => (await (await fetch(`${k.adresse}api/boards/entwicklung`)).json()).spalten.map(s => s.eigentuemer);

test.describe('R00097', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('B0296: Eigentümer im Spalten-Dialog setzen, vorbelegen und entfernen', async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await ausMehr(page, 'Spalten einrichten');
    const wahl = page.getByRole('combobox', { name: 'Eigentümer Eingang' });
    await expect(wahl).toHaveValue('');
    await expect(wahl.locator('option')).toHaveText(['— keiner —', 'Mensch', 'Agent']);
    await expect(wahl).toHaveAccessibleDescription(KEINER);
    await wahl.selectOption({ label: 'Mensch' });
    await expect(wahl).toHaveAccessibleDescription(MENSCH);
    await expect(page.locator('#setup-vorschau')).toContainText('column-owner:\n  Eingang: human');
    await page.getByRole('combobox', { name: 'Eigentümer In Arbeit' }).selectOption({ label: 'Agent' });
    await expect(page.getByRole('combobox', { name: 'Eigentümer In Arbeit' })).toHaveAccessibleDescription(AGENT);
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => board(k)).toEqual(['human', 'agent', null]);
    expect(k.lies('boards/entwicklung.md')).toContain('column-owner:\n  Eingang: human\n  In Arbeit: agent\n');
    await page.reload();
    await ausMehr(page, 'Spalten einrichten');
    await expect(wahl).toHaveValue('human');
    await expect(wahl).toHaveAccessibleDescription(MENSCH);
    await wahl.selectOption({ label: '— keiner —' });
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => board(k)).toEqual([null, 'agent', null]);
    expect(k.lies('boards/entwicklung.md')).not.toContain('Eingang: human');
  });

  test('B0296: unbekannter Rohwert bleibt beim Speichern ohne Änderung erhalten', async ({ page }) => {
    k = await kanbanStarten(einrichten({ ...DATEIEN, 'boards/entwicklung.md': '---\ncolumn-owner:\n  In Arbeit: chef\n---\n\n' + DATEIEN['boards/entwicklung.md'] }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await ausMehr(page, 'Spalten einrichten');
    const wahl = page.getByRole('combobox', { name: 'Eigentümer In Arbeit' });
    await expect(wahl).toHaveValue('');
    await expect(wahl).toHaveAccessibleDescription(KEINER);
    const roh = page.locator('[title="unbekannter Eigentümer — bleibt erhalten"]');
    await expect(roh).toHaveText('chef');
    await expect(page.locator('#setup-vorschau')).toContainText('column-owner:\n  In Arbeit: chef');
    await page.getByLabel('Kommentar In Arbeit').fill('nur zwei');
    await page.getByLabel('Spaltenname 2').fill('Laufend');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('column-notes:\n  Laufend: nur zwei');
    expect(k.lies('boards/entwicklung.md')).toContain('column-owner:\n  Laufend: chef\n');
  });
});
