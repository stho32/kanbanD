// R00088 Signal auffällig und „Signale oben“
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes: {}
signals:
  review: {label: Review nötig, color: red}
  mail: {label: Neue E-Mail, color: blue}
sources:
  wbs: plan/wbs.md
  requirements: anf/
---
`;
const aufgabe = (n, mehr = '') => [`aufgaben/000${n}-a${n}.md`, `---\nid: ${n}\ntitle: a${n}\n${mehr}---\n`];
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n## Erledigt\n';
const ALS_AGENT = { headers: { 'X-KanbanD-Wer': 'cl' } };

test.describe('R00088', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(Object.fromEntries([['kanbanD.md', EINSTELLUNGEN], ['boards/entwicklung.md', BOARD], aufgabe(1), aufgabe(2, 'signals: [mail]\n'), aufgabe(3), aufgabe(4, 'signals: [mail, review]\n')])));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
  });
  test.afterEach(() => k.stoppen());
  const karte = (page, n) => page.locator(`.ka[data-id="${n}"]`);

  test('US-1: ein Agent setzt „review“ — die Karte bekommt live Streifen und Ton in Rot', async ({ page }) => {
    await expect(karte(page, 1)).not.toHaveAttribute('data-sig');
    const ohne = await karte(page, 1).evaluate(e => getComputedStyle(e).backgroundColor);
    await page.request.put(k.adresse + 'api/aufgaben/1/signale/review', ALS_AGENT);
    await expect(karte(page, 1)).toHaveAttribute('data-sig', 'review');
    const stil = await karte(page, 1).evaluate(e => {
      const s = getComputedStyle(e), probe = document.createElement('span');
      probe.style.color = 'var(--kd-c-red-line)'; document.body.append(probe);
      const rot = getComputedStyle(probe).color; probe.remove();
      return { links: s.borderLeftWidth, rand: s.borderLeftColor, ton: s.backgroundColor, rot };
    });
    expect(stil.links).toBe('4px');
    expect(stil.rand).toBe(stil.rot);
    expect(stil.ton).not.toBe(ohne);
    // „review“ steht in den Einstellungen vor „mail“: #4 trägt Rot, nicht Blau
    await expect(karte(page, 4)).toHaveAttribute('data-sig', 'review');
    await expect(karte(page, 2)).toHaveAttribute('data-sig', 'mail');
    await expect(karte(page, 3)).not.toHaveAttribute('data-sig');
  });

  const reihe = page => page.locator('.bahn[data-col="Zu erledigen"] .ka').evaluateAll(ks => ks.map(k => +k.dataset.id));

  test('US-2: Signale oben — erst mit Signal, nach dem Neuladen noch an, aus wieder wie im Board', async ({ page }) => {
    await expect.poll(() => reihe(page)).toEqual([1, 2, 3, 4]);
    await page.locator('#signale-oben').click();
    await expect(page.locator('#signale-oben')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => reihe(page)).toEqual([2, 4, 1, 3]);
    expect(k.lies('boards/entwicklung.md')).toBe(BOARD);
    await page.reload();
    await expect(page.locator('#signale-oben')).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => reihe(page)).toEqual([2, 4, 1, 3]);
    await page.locator('#signale-oben').click();
    await expect.poll(() => reihe(page)).toEqual([1, 2, 3, 4]);
  });

  test('US-3: bei Signale oben ändert Ziehen nichts, ein Hinweis erklärt warum', async ({ page }) => {
    await page.locator('#signale-oben').click();
    await karte(page, 3).dragTo(karte(page, 2));
    await expect(page.getByText('Bei „Signale oben“ nicht umsortierbar')).toBeVisible();
    await karte(page, 1).focus();
    await page.keyboard.press('Alt+ArrowDown');
    await page.waitForTimeout(300);
    expect(k.lies('boards/entwicklung.md')).toBe(BOARD);
  });

  test('ein Signal per API rückt bei Signale oben live nach oben', async ({ page }) => {
    await page.locator('#signale-oben').click();
    await page.request.put(k.adresse + 'api/aufgaben/3/signale/review', ALS_AGENT);
    await expect.poll(() => reihe(page)).toEqual([2, 3, 4, 1]);
  });
});
