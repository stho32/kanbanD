// R00120 US-4: der unbekannte Rohwert im Spalten-Dialog — vorausgewählte Option, Hinweissatz als Auswahl-Beschreibung,
// Sende-/Rundlauf-Vertrag (byte-gleich ohne Änderung, „— keiner —“ entfernt); dazu die Kontrast-Regressionswächter.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, ausMehr, kontrastFarben } = require('./hilfen');

const ROH_SATZ = 'Unbekannter Eigentümer „chef“ — bleibt erhalten';
const DATEIEN = {
  'boards/entwicklung.md': '---\ncolumn-owner:\n  In Arbeit: chef\n---\n\n# Entwicklung\n\n## Eingang\n\n## In Arbeit\n\n## Erledigt\n',
};

test.describe('R00120 Rohwert im Spalten-Dialog', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('AK 13/14: Rohwert-Option vorausgewählt, Hinweissatz als Beschreibung, Sende-Vertrag byte-gleich und Entfernen', async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await ausMehr(page, 'Spalten einrichten');
    const wahl = page.getByRole('combobox', { name: 'Eigentümer In Arbeit' });
    await expect(wahl).toHaveValue('roh');
    await expect(wahl.locator('option')).toHaveText(['— keiner —', 'Mensch', 'Agent', '„chef“ (unbekannt)']);
    await expect(wahl).toHaveAccessibleDescription(ROH_SATZ);
    // der Satz steht nicht mehr im title eines nicht fokussierbaren span
    await expect(page.locator('.eig-roh')).toHaveText('chef');
    await expect(page.locator('.eig-roh')).not.toHaveAttribute('title', /.+/);
    // (a) ohne Änderung „Fertig“ → Board-Datei byte-gleich (kein eigentuemer gesendet)
    const vorher = k.lies('boards/entwicklung.md');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.ka, .bahn').first()).toBeVisible();
    expect(k.lies('boards/entwicklung.md')).toBe(vorher);
    // (b) „— keiner —“ + „Fertig“ → der Eintrag verschwindet in einem Schritt
    await page.reload();
    await ausMehr(page, 'Spalten einrichten');
    await page.getByRole('combobox', { name: 'Eigentümer In Arbeit' }).selectOption({ label: '— keiner —' });
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect.poll(() => k.lies('boards/entwicklung.md')).not.toContain('chef');
  });

  test('AK 12/15: Kontrast des Rohwerts und der Modusleiste in Hell und Dunkel (Regressionswächter)', async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await ausMehr(page, 'Spalten einrichten');
    for (const thema of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
      const rohFarbe = await page.locator('.eig-roh').evaluate(e => getComputedStyle(e).color);
      const bkGrund = await page.locator('.bk-ed').filter({ has: page.locator('.eig-roh') }).evaluate(e => getComputedStyle(e).backgroundColor);
      expect(await kontrastFarben(page, rohFarbe, bkGrund), `Rohwert ${thema}`).toBeGreaterThanOrEqual(4.5);
      const modus = page.locator('.kz.modus');
      const grund = await modus.evaluate(e => getComputedStyle(e).backgroundColor);
      const ziele = [['Titel', modus.locator('.kz-modus b')], ['Board-Name', modus.locator('.kz-z1')], ['Verwerfen', modus.getByRole('button', { name: 'Verwerfen' })]];
      for (const [was, ziel] of ziele) {
        const farbe = await ziel.evaluate(e => getComputedStyle(e).color);
        expect(await kontrastFarben(page, farbe, grund), `${was} ${thema}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
