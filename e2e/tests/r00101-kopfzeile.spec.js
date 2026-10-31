// R00101 Kopfzeile auf jeder Breite bedienbar
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { wbsText, zeile, arbeitsRepository } = require('./wbs-hilfen');
const { kopfzeilePruefen } = require('./kopfzeile-hilfen');

const BREITEN = [375, 414, 600, 768, 900, 1024, 1100, 1280, 1366, 1440];

const jetztMinus = min => { const d = new Date(Date.now() - min * 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const aufgabe = (n, zustaendige, timer = '') => [`aufgaben/000${n}-k${n}.md`, `---\nid: ${n}\ntitle: Karte ${n}\nassignees: [${zustaendige.join(', ')}]\n---\n${timer}`];
const lauft = wer => `\`\`\`kanbanD-time\n${jetztMinus(30)} · ... · ${wer}\n\`\`\`\n`;

/** Gegeben aus R00101: drei Spalten, fünf Karten, EM bei #1, #2 (mit Agent) und #4, drei Timer laufen; WBS gebunden. */
const gegeben = arbeit => einrichten({
  'kanbanD.md': `---\npeople:\n  em: {name: Erika Mustermann, kind: human}\n  mi: {name: Mia, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}\n---\n`,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n- #4\n\n## Erledigt\n\n- #5\n',
  ...Object.fromEntries([
    aufgabe(1, ['em'], lauft('em')),
    aufgabe(2, ['em', 'cl'], lauft('cl')),
    aufgabe(3, []),
    aufgabe(4, ['em'], lauft('mi')),
    aufgabe(5, []),
  ]),
});

let k, arbeit;
async function starten(page, { ich = 'em' } = {}) {
  arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
  k = await kanbanStarten(gegeben(arbeit));
  if (ich) await alsPerson(page, ich);
  await page.goto(k.adresse);
  await expect(page.locator('.ka')).toHaveCount(5);
}
test.afterEach(async () => { if (k) await k.stoppen(); if (arbeit) arbeit.aufraeumen(); });

const kopf = page => page.locator('header.kz');

test('Stufe nach M3 an den Grenzen, auch nach einem Wechsel der Fensterbreite', async ({ page }) => {
  await starten(page);
  for (const [breite, stufe] of [[599, 'compact'], [600, 'medium'], [839, 'medium'], [840, 'expanded'], [1199, 'expanded'], [1200, 'large'], [320, 'compact']]) {
    await page.setViewportSize({ width: breite, height: 800 });
    await expect(kopf(page), `${breite} px`).toHaveAttribute('data-stufe', stufe);
  }
});

/** Setzt die Breite und wartet, bis die Kopfzeile in der Stufe dieser Breite gezeichnet ist. */
async function breiteSetzen(page, breite) {
  await page.setViewportSize({ width: breite, height: 800 });
  await expect(kopf(page)).toHaveAttribute('data-stufe', await page.evaluate(b => stufeAusBreite(b), breite));
}

/** Keine Überlappung, nichts abgeschnitten oder verdeckt, keine Zeile mit Überlauf (Abnahme-Probe von #7). */
async function ohneKonflikte(page, wo) {
  const { konflikte } = await kopfzeilePruefen(page);
  expect(konflikte, wo).toEqual([]);
}

const mehr = page => kopf(page).getByRole('button', { name: 'Mehr' });
const menue = page => page.locator('#pop[role="menu"]');

test('ab 600 px: keine zwei Kopfzeilen-Bedienelemente überlappen, keins ist verdeckt oder abgeschnitten, keine Zeile läuft über', async ({ page }) => {
  await starten(page);
  for (const breite of [600, 768, 840, 900, 1024, 1100, 1200, 1280, 1366, 1440]) {
    await breiteSetzen(page, breite);
    await ohneKonflikte(page, `${breite} px`);
  }
});

test('large: Filter, Bereich und „Neue Aufgabe“ direkt in der Kopfzeile; Signale oben, Spalten, Darstellung im Menü „Mehr“', async ({ page }) => {
  await starten(page);
  for (const breite of [1280, 1366, 1440]) {
    await breiteSetzen(page, breite);
    await expect(kopf(page).getByLabel('Filter')).toBeVisible();
    await expect(kopf(page).getByRole('radiogroup', { name: 'Bereich' })).toBeVisible();
    await expect(kopf(page).getByRole('button', { name: /Neue Aufgabe/ })).toBeVisible();
    await expect(kopf(page).getByText('Signale oben')).toHaveCount(0);
  }
  await expect(mehr(page)).toHaveAttribute('aria-haspopup', 'menu');
  await mehr(page).click();
  await expect(menue(page).getByRole('menuitemcheckbox')).toHaveText(['Signale oben']);
  await expect(menue(page).getByRole('menuitem')).toHaveText(['Spalten einrichten', /Darstellung: System/]);
  await menue(page).getByRole('menuitem', { name: 'Spalten einrichten' }).click();
  await expect(page.locator('header.kz.modus')).toContainText('Spalten einrichten');
});

test('Menü „Mehr“: ein Eintrag löst dieselbe Aktion aus wie vorher der Knopf; per Tastatur Tab, Enter, Esc', async ({ page }) => {
  await starten(page);
  await mehr(page).focus();
  await page.keyboard.press('Enter');
  const signale = menue(page).getByRole('menuitemcheckbox', { name: 'Signale oben' });
  await expect(signale).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(menue(page).getByRole('menuitemcheckbox', { name: 'Signale oben' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  await expect(menue(page).getByRole('menuitem', { name: /Darstellung/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  await expect(menue(page)).toHaveCount(0);
  await expect(mehr(page)).toBeFocused();
});
