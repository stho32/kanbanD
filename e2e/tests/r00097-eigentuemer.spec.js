// R00097 F0015 Eigentümer in der Oberfläche
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, ausMehr, kontrastFarben } = require('./hilfen');

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

  test('Nacharbeit: unbekannter Rohwert lässt sich per „— keiner —“ entfernen', async ({ page }) => {
    k = await kanbanStarten(einrichten({ ...DATEIEN, 'boards/entwicklung.md': '---\ncolumn-owner:\n  In Arbeit: chef\n---\n\n' + DATEIEN['boards/entwicklung.md'] }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await ausMehr(page, 'Spalten einrichten');
    const wahl = page.getByRole('combobox', { name: 'Eigentümer In Arbeit' });
    const roh = page.locator('[title="unbekannter Eigentümer — bleibt erhalten"]');
    await expect(roh).toHaveText('chef');
    await wahl.selectOption({ label: 'Mensch' });
    await wahl.selectOption({ label: '— keiner —' });
    await expect(roh).toBeHidden();
    await expect(page.locator('#setup-vorschau')).not.toContainText('column-owner');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).not.toContain('column-owner');
    expect(k.lies('boards/entwicklung.md')).not.toContain('chef');
  });

  test('B0297: Zeichen im Spaltenkopf und im zugeklappten Streifen, Kontrast in Hell und Dunkel', async ({ page }) => {
    const datei = '---\nlimits:\n  Eingang: 1\ncolumn-owner:\n  Eingang: human\n  In Arbeit: agent\n---\n\n# Entwicklung\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n';
    k = await kanbanStarten(einrichten({ ...DATEIEN, 'boards/entwicklung.md': datei, 'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const zeichen = spalte => page.locator(`.bahn[data-col="${spalte}"] .bahn-kopf [role="img"]`);
    for (const runde of ['geladen', 'neu geladen']) {
      await expect(zeichen('Eingang'), runde).toHaveAttribute('aria-label', MENSCH);
      await expect(zeichen('Eingang')).toHaveAttribute('title', MENSCH);
      await expect(zeichen('In Arbeit')).toHaveAttribute('aria-label', AGENT);
      await expect(zeichen('In Arbeit')).toHaveAttribute('title', AGENT);
      await expect(zeichen('Erledigt')).toHaveCount(0);
      if (runde === 'geladen') await page.reload();
    }
    await expect(page.getByRole('img', { name: MENSCH })).toBeVisible();
    expect(await zeichen('Eingang').evaluate(e => [e.tabIndex, e.hasAttribute('tabindex')])).toEqual([-1, false]);
    expect(await zeichen('Eingang').boundingBox()).toMatchObject({ width: 14, height: 14 });
    // Kontrast gegen den Kopf (--kd-sunken) und den Kopf über der Grenze, in beiden Themen
    const kontrast = async () => {
      const sunken = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kd-sunken'));
      const ueber = await page.locator('.bahn[data-col="Eingang"] .bahn-kopf.ueber').evaluate(e => getComputedStyle(e).backgroundColor);
      const farbe = sel => page.locator(sel).evaluate(e => getComputedStyle(e).color);
      const m = await farbe('.bahn[data-col="Eingang"] .bahn-kopf [role="img"]'), a = await farbe('.bahn[data-col="In Arbeit"] .bahn-kopf [role="img"]');
      return Math.min(await kontrastFarben(page, m, sunken), await kontrastFarben(page, m, ueber), await kontrastFarben(page, a, sunken), await kontrastFarben(page, a, ueber));
    };
    for (const thema of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
      expect(await kontrast(), thema).toBeGreaterThanOrEqual(3);
    }
    await page.getByRole('button', { name: 'Eingang zuklappen' }).click();
    const streifen = page.getByRole('button', { name: 'Eingang aufklappen, gehört dem Menschen' });
    await expect(streifen).toBeVisible();
    await expect(streifen.locator('.eig-z')).toHaveAttribute('aria-hidden', 'true');
    await page.getByRole('button', { name: 'In Arbeit zuklappen' }).click();
    await expect(page.getByRole('button', { name: 'In Arbeit aufklappen, gehört den Agenten' })).toBeVisible();
    await page.getByRole('button', { name: 'Erledigt zuklappen' }).click();
    await expect(page.getByRole('button', { name: 'Erledigt aufklappen', exact: true })).toBeVisible();
  });

  test('B0297: ein Mensch zieht eine Karte per Maus aus der Menschen-Spalte', async ({ page }) => {
    k = await kanbanStarten(einrichten({ ...DATEIEN, 'boards/entwicklung.md': '---\ncolumn-owner:\n  Eingang: human\n---\n\n' + DATEIEN['boards/entwicklung.md'] }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka[data-id="1"]')).toBeVisible();
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/## In Arbeit\n\n- \[#1\]/);
  });
});
