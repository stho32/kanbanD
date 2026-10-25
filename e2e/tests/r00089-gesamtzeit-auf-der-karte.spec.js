// R00089 Gesamtzeit auf der Karte
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

/** Ortszeit vor `minuten` Minuten als Dateiform ohne Versatz — der Browser rechnet in derselben Zone (Europe/Berlin). */
const vor = minuten => { const d = new Date(Date.now() - minuten * 6e4), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

test.describe('R00089', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1 und US-3: Σ mit Anteilen je Person, ohne Zeit kein Feld, Detail zeigt dieselbe Summe', async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 10:00 · st\n2026-10-19 09:00+02:00 · 2026-10-19 09:42+02:00 · cl\n```\n',
      'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
    }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const sum = page.locator('.ka[data-id="1"] .sum');
    await expect(sum).toHaveText('Σ 1:42');
    await expect(sum).toHaveAttribute('title', 'Stefan 1:00 · Claude 0:42');
    await expect(page.locator('.ka[data-id="2"] .sum')).toHaveCount(0);
    await page.locator('.ka[data-id="1"]').click();
    await expect(page.locator('#zeitsumme')).toContainText('1:42');
  });

  test('US-2: ein laufender Timer zählt in Σ jede Minute mit', async ({ page }) => {
    k = await kanbanStarten(einrichten({
      'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\n---\n\`\`\`kanbanD-time\n2026-10-18 09:00 · 2026-10-18 10:00 · st\n${vor(5)} · ... · cl\n\`\`\`\n`,
    }));
    await alsPerson(page, 'st');
    await page.clock.install();
    await page.goto(k.adresse);
    const sum = page.locator('.ka[data-id="1"] .sum');
    await expect(sum).toHaveText(/^Σ 1:0[56]$/);
    const vorher = await sum.textContent();
    await page.clock.runFor(61000);
    await expect(sum).not.toHaveText(vorher);
    await expect(sum).toHaveText(/^Σ 1:0[67]$/);
  });
});
