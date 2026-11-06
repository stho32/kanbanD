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
  // seit R00106 führen die Pfeile durchs Menü; Tab schließt es
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(menue(page).getByRole('menuitem', { name: /Darstellung/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.keyboard.press('Escape');
  await expect(menue(page)).toHaveCount(0);
  await expect(mehr(page)).toBeFocused();
});

test.describe('compact, 375 px', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  const seite = page => kopf(page).getByRole('button', { name: /Seite/ });

  test('der Navigationsknopf öffnet Board, Aufgaben, Personen, Berichte, WBS, Einrichten; „Aufgaben“ zeigt die Aufgabenliste', async ({ page }) => {
    await starten(page);
    await expect(kopf(page).locator('.kz-nav')).toHaveCount(0);
    await expect(seite(page)).toHaveText(/Board/);
    await expect(seite(page)).toHaveAttribute('aria-haspopup', 'menu');
    await seite(page).click();
    await expect(menue(page).getByRole('menuitem')).toHaveText(['Board', 'Aufgaben', 'Personen', /Berichte/, 'WBS', 'Einrichten']);
    await menue(page).getByRole('menuitem', { name: 'Aufgaben' }).click();
    await expect(page).toHaveURL(/#\/aufgaben$/);
    await expect(page.locator('.leiste')).toContainText('Aufgaben');
    await expect(menue(page)).toHaveCount(0);
    await expect(seite(page)).toHaveText(/Aufgaben/);
  });

  test('„Berichte“ im Navigationsmenü öffnet die Liste der Berichte', async ({ page }) => {
    await starten(page);
    await seite(page).click();
    await menue(page).getByRole('menuitem', { name: /Berichte/ }).click();
    await page.locator('#pop').getByRole('menuitem', { name: /Burndown/ }).click();
    await expect(page).toHaveURL(/#\/berichte\/verlauf$/);
  });

  test('„Signale oben“, „Spalten“ und „Darstellung“ mit zwei Klicks über „Mehr“; das offene Menü liegt ganz im Fenster', async ({ page }) => {
    await starten(page);
    await mehr(page).click();
    await expect(menue(page).getByRole('menuitemcheckbox', { name: 'Signale oben' })).toBeVisible();
    await expect(menue(page).getByRole('menuitem', { name: /Darstellung/ })).toBeVisible();
    const r = await menue(page).boundingBox();
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + r.width).toBeLessThanOrEqual(375);
    expect(r.y + r.height).toBeLessThanOrEqual(800);
    await menue(page).getByRole('menuitem', { name: 'Spalten einrichten' }).click();
    await expect(page.locator('header.kz.modus')).toContainText('Spalten einrichten');
  });
});

const neuKnopf = page => kopf(page).getByRole('button', { name: /Neue Aufgabe/ });

test('bei allen zehn Breiten und an den Untergrenzen: keine Konflikte, „Neue Aufgabe“ ohne Menü sichtbar, ein Klick öffnet das Fenster', async ({ page }) => {
  await starten(page);
  for (const breite of [...BREITEN, 320, 840, 1200]) {
    await breiteSetzen(page, breite);
    await ohneKonflikte(page, `${breite} px`);
    await expect(neuKnopf(page), `${breite} px`).toBeVisible();
    await neuKnopf(page).click();
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' }), `${breite} px`).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toHaveCount(0);
  }
});

test('unter 600 px zeigt „Neue Aufgabe“ nur „+“, behält aber den Namen; darüber den ganzen Text', async ({ page }) => {
  await starten(page);
  await breiteSetzen(page, 375);
  expect((await neuKnopf(page).innerText()).trim()).toBe('+');
  await breiteSetzen(page, 600);
  expect((await neuKnopf(page).innerText()).replace(/\s+/g, ' ').trim()).toBe('+ Neue Aufgabe');
});

for (const breite of [375, 768]) {
  test.describe(`Touch, ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 800 }, isMobile: true, hasTouch: true });

    test('„meine“ ist ohne Menü sichtbar, als Filter-Chip mit Tippfläche nach dem zentralen Touch-Maß, und filtert auf die eigenen Karten', async ({ page }) => {
      await starten(page);
      const meine = kopf(page).getByRole('radio', { name: 'meine' });
      await expect(meine).toBeVisible();
      await expect(meine).toHaveClass(/kz-chip/);
      const r = await meine.boundingBox();
      expect(Math.min(r.width, r.height)).toBeGreaterThanOrEqual(32);
      await meine.tap();
      await expect(page.locator('.ka')).toHaveCount(3);
      expect(await page.locator('.ka').evaluateAll(ks => ks.map(k => +k.dataset.id).sort())).toEqual([1, 2, 4]);
      await expect(kopf(page).getByRole('radio', { name: 'meine' })).toHaveAttribute('aria-checked', 'true');
      await kopf(page).getByRole('radio', { name: 'alle' }).tap();
      await expect(page.locator('.ka')).toHaveCount(5);
      await ohneKonflikte(page, `${breite} px`);
    });
  });
}

test('nach einem Wechsel von 375 auf 1280 px bleibt „meine“ gewählt, das Board zeigt weiter 3 von 5 Karten', async ({ page }) => {
  await starten(page);
  await breiteSetzen(page, 375);
  await kopf(page).getByRole('radio', { name: 'meine' }).click();
  await expect(page.locator('.ka')).toHaveCount(3);
  await breiteSetzen(page, 1280);
  await expect(kopf(page).getByRole('radio', { name: 'meine' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('.ka')).toHaveCount(3);
});

test('ohne gewähltes Ich zeigt „meine“ bei 375 px 0 Karten, die Kopfzeile bleibt bedienbar, die Konsole bleibt ohne Fehler', async ({ page }) => {
  const fehler = [];
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  page.on('pageerror', e => fehler.push(e.message));
  await page.setViewportSize({ width: 375, height: 800 });
  await starten(page, { ich: null });
  await kopf(page).getByRole('radio', { name: 'meine' }).click();
  await expect(page.locator('.ka')).toHaveCount(0);
  await ohneKonflikte(page, '375 px ohne Ich');
  await kopf(page).getByRole('radio', { name: 'alle' }).click();
  await expect(page.locator('.ka')).toHaveCount(5);
  expect(fehler).toEqual([]);
});

test('Aufgaben, Personen, Berichte, Einrichten und „Spalten einrichten“: keine Konflikte bei 375, 768 und 1280 px', async ({ page }) => {
  await starten(page);
  for (const ziel of ['#/aufgaben', '#/personen', '#/berichte/verlauf', '#/einrichten']) {
    await page.goto(k.adresse + ziel);
    for (const breite of [375, 768, 1280]) {
      await breiteSetzen(page, breite);
      await ohneKonflikte(page, `${ziel} bei ${breite} px`);
    }
  }
  await page.goto(k.adresse);
  await mehr(page).click();
  await menue(page).getByRole('menuitem', { name: 'Spalten einrichten' }).click();
  for (const breite of [375, 768, 1280]) {
    await breiteSetzen(page, breite);
    await expect(page.locator('header.kz.modus')).toBeVisible();
    await ohneKonflikte(page, `Spalten einrichten bei ${breite} px`);
  }
});
