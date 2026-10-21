// R00076 Signale
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes: {}
signals:
  mail: {label: Neue E-Mail, color: blue}
  fragen: {label: Coding-Agent hat Fragen, color: violet}
sources:
  wbs: plan/wbs.md
  requirements: anf/
---
`;
// Der Browser rechnet in Europe/Berlin (playwright.config.js) — die Daten der Fälligkeit ebenso.
const tag = n => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() + n * 864e5));
const aufgabe = (n, titel, mehr = '') => [`aufgaben/000${n}-a${n}.md`, `---\nid: ${n}\ntitle: ${titel}\n${mehr}---\n`];
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-a1.md)\n- [#2](../aufgaben/0002-a2.md)\n- [#3](../aufgaben/0003-a3.md)\n\n## In Arbeit\n\n- [#4](../aufgaben/0004-a4.md)\n\n## Erledigt\n\n- [#5](../aufgaben/0005-a5.md)\n';

test.describe('R00076', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(Object.fromEntries([
      ['kanbanD.md', EINSTELLUNGEN], ['boards/entwicklung.md', BOARD],
      aufgabe(1, 'eins'), aufgabe(2, 'zwei', 'signals: [mail]\n'), aufgabe(3, 'drei', `due: ${tag(-1)}\n`), aufgabe(4, 'vier', `due: ${tag(0)}\n`), aufgabe(5, 'fünf', `due: ${tag(-3)}\n`),
    ])));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
  });
  test.afterEach(() => k.stoppen());
  const karte = (page, n) => page.locator(`.ka[data-id="${n}"]`);
  const kopf = (page, spalte) => page.locator(`.bahn[data-col="${spalte}"] .bahn-kopf`);

  test('US-2: ein Agent setzt ein Signal, die Karte zeigt die Fackel, Klick nimmt es zurück, im Fenster wieder setzen', async ({ page }) => {
    await page.request.put(k.adresse + 'api/aufgaben/1/signale/fragen', { headers: { 'X-KanbanD-Wer': 'cl' } });
    const fackel = karte(page, 1).getByRole('button', { name: 'Signal Coding-Agent hat Fragen zurücknehmen' });
    await expect(fackel).toBeVisible();
    await expect(fackel).toHaveAttribute('title', 'Coding-Agent hat Fragen — Klick nimmt das Signal zurück');
    expect(await fackel.locator('svg').evaluate(e => getComputedStyle(e).animationName)).toBe('kd-puls'); // das Symbol pulsiert, der Knopf steht still
    await expect(kopf(page, 'Zu erledigen').locator('.sigz[data-signal="fragen"]')).toHaveText('×1');
    await expect(kopf(page, 'Zu erledigen').locator('.sigz[data-signal="mail"]')).toHaveText('×1');
    await fackel.click();
    await expect(fackel).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0); // der Klick öffnet die Karte nicht
    expect(k.lies('aufgaben/0001-a1.md')).not.toContain('signals');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|#1 Signal „Coding-Agent hat Fragen“ zurückgenommen');
    await karte(page, 1).locator('.t').click();
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
    const schalter = fenster.getByRole('button', { name: 'Signal Coding-Agent hat Fragen' });
    await expect(schalter).toHaveAttribute('aria-pressed', 'false');
    await schalter.click();
    await expect(schalter).toHaveAttribute('aria-pressed', 'true');
    expect(k.lies('aufgaben/0001-a1.md')).toContain('signals: [fragen]\n');
  });

  test('US-3: Klick auf das Signal im Spaltenkopf filtert, signal:any und signal:due', async ({ page }) => {
    await kopf(page, 'Zu erledigen').locator('.sigz[data-signal="mail"]').click();
    await expect(page.getByLabel('Filter')).toHaveValue('signal:mail');
    await expect(page.locator('.ka')).toHaveCount(1);
    await expect(karte(page, 2)).toBeVisible();
    await page.getByLabel('Filter').fill('signal:due');
    await expect(page.locator('.ka').evaluateAll(l => l.map(e => +e.dataset.id))).resolves.toEqual([3, 4]);
    await page.getByLabel('Filter').fill('signal:any');
    await expect(page.locator('.ka').evaluateAll(l => l.map(e => +e.dataset.id))).resolves.toEqual([2, 3, 4]);
  });

  test('US-4: Fälligkeit heute bernstein, überschritten rot, nicht in der Abschlussspalte; Kopf zählt', async ({ page }) => {
    await expect(karte(page, 3).locator('.signal.faellig')).toHaveClass(/\bueber\b/);
    await expect(karte(page, 3).locator('.signal.faellig')).toHaveAttribute('title', `überfällig seit ${tag(-1).split('-').reverse().join('.')}`);
    await expect(karte(page, 4).locator('.signal.faellig')).toHaveClass(/\bheute\b/);
    await expect(karte(page, 4).locator('.signal.faellig')).toHaveAttribute('title', 'heute fällig');
    await expect(karte(page, 5).locator('.signal')).toHaveCount(0);
    await expect(kopf(page, 'Zu erledigen').locator('.sigz[data-signal="due"]')).toHaveText('×1');
    await expect(kopf(page, 'Erledigt').locator('.sigz')).toHaveCount(0);
  });

  test('US-1: Signal unter „Einrichten“ anlegen schreibt signals:', async ({ page }) => {
    await page.goto(k.adresse + '#/einrichten');
    await page.getByLabel('Neuer Signalschlüssel').fill('fertig');
    await page.getByLabel('Neue Bedeutung').fill('Agent ist fertig');
    await page.getByLabel('Neue Bedeutung').press('Enter');
    await expect(page.locator('#einr-vorschau')).toContainText('signals:\n  mail: {label: Neue E-Mail, color: blue}\n  fragen: {label: Coding-Agent hat Fragen, color: violet}\n  fertig: {label: Agent ist fertig, color:');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('gespeichert')).toBeVisible();
    expect(k.lies('kanbanD.md')).toMatch(/\n  fertig: \{label: Agent ist fertig, color: [a-z]+\}\n/);
    await page.getByLabel('Signal fertig entfernen').click();
    await expect(page.locator('#einr-vorschau')).not.toContainText('fertig');
  });
});
