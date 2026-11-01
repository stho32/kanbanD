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
    const kontrast = () => page.evaluate(() => {
      const rgb = farbe => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = farbe; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const hell = f => { const l = rgb(f).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
      const verh = (a, b) => { const [x, y] = [hell(a), hell(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      const farbe = sel => getComputedStyle(document.querySelector(sel)).color;
      const sunken = getComputedStyle(document.documentElement).getPropertyValue('--kd-sunken');
      const ueber = getComputedStyle(document.querySelector('.bahn[data-col="Eingang"] .bahn-kopf.ueber')).backgroundColor;
      const m = farbe('.bahn[data-col="Eingang"] .bahn-kopf [role="img"]'), a = farbe('.bahn[data-col="In Arbeit"] .bahn-kopf [role="img"]');
      return Math.min(verh(m, sunken), verh(m, ueber), verh(a, sunken), verh(a, ueber));
    });
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
