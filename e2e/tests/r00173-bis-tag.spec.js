// E2E R00173 (I0163, F0142): das Bis-Feld eines benannten Zeitraums zeigt dessen letzten Tag — auch wenn der ein Tag der
// Zeitumstellung ist. Feste Browser-Uhr am 29.03.2026 (23 Stunden), Zeitzone Europe/Berlin (playwright.config.js).
// Die Grenzen selbst weist der Einheitstest e2e/einheit/r00173-bis-tag.test.js nach.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, filterOeffnen } = require('./hilfen');

const UMSTELLUNG_FRUEHJAHR = '2026-03-29T12:00:00+02:00'; // Sonntag
const boardMit = zeitraum => `---\nreport-filter: {period: ${zeitraum}}\n---\n# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n`;

test.describe('R00173 F0142: Bis-Feld benannter Zeiträume am Tag der Zeitumstellung', () => {
  let k;
  test.afterEach(() => k.stoppen());

  for (const [zeitraum, name, von] of [['heute', 'heute', '2026-03-29'], ['woche', 'diese Woche', '2026-03-23'], ['monat', 'dieser Monat', '2026-03-01']]) {
    test(`AK 6: am 29.03.2026 zeigt „${name}“ im Bis-Feld seinen letzten Tag — ${zeitraum === 'monat' ? 'den 31.03.' : 'den 29.03., nicht den 28.03.'}`, async ({ page }) => {
      k = await kanbanStarten(einrichten({ 'boards/entwicklung.md': boardMit(zeitraum) }));
      await page.clock.setFixedTime(new Date(UMSTELLUNG_FRUEHJAHR));
      await alsPerson(page, 'st');
      await page.goto(k.adresse + '#/berichte/durchsatz');
      await filterOeffnen(page);

      const filter = page.getByRole('group', { name: 'Berichtsfilter' });
      await expect(filter.getByLabel('Zeitraum', { exact: true })).toHaveValue(zeitraum);
      await expect(filter.getByLabel('Zeitraum von', { exact: true })).toHaveValue(von);
      await expect(filter.getByLabel('Zeitraum bis', { exact: true })).toHaveValue(zeitraum === 'monat' ? '2026-03-31' : '2026-03-29');
    });
  }
});
