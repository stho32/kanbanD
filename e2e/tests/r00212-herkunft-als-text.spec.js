// R00212 (I0202, Karte #226): Herkunft als Text ohne Auflösung — AK 2, 2a, 3, 4, 5 (Oberfläche) und 6 gegen das echte Programm.
// Schichten: Testfall (je AK) → Testsprache (`ausgangslage`, `chip`, `messung`) → Treiber (Playwright).
// Die Erwartung der Stile ist am Stand vor der Karte gemessen (B1059, Chromium, 1280×800): der Ruhezustand des `span.org`
// war schon vor der Karte der des aufgelösten `a.org`, nur dessen Höhe war 24 px (Mindestgröße eines Links), die des
// `span.org` und des Chips „ohne Herkunft“ 16 px (AK 3).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, reiter, thema, bereit } = require('./hilfen');

// ---- Testsprache --------------------------------------------------------------------------------------------------------

const WBS = '# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0007 | Interaction | D0001 | Bewegen | rot | |\n| I0008 | Interaction | D0001 | Warten | rot | I0007 |\n';
const SCHRIFT = '"IBM Plex Mono", ui-monospace, monospace';
/** Ruhezustand des Chips vor der Karte, je Thema und Ort (Karte, Aufgabenfenster); `hoehe` ist der neue Wert (AK 3). */
const RUHE = {
  light: { karte: { color: 'oklch(0.48 0.018 255)', backgroundColor: 'rgba(0, 0, 0, 0)', border: '0px none oklch(0.48 0.018 255)' },
           fenster: { color: 'oklch(0.38 0.12 255)', backgroundColor: 'oklch(0.93 0.035 255)', border: '0px none oklch(0.38 0.12 255)' } },
  dark: { karte: { color: 'oklch(0.74 0.014 250)', backgroundColor: 'rgba(0, 0, 0, 0)', border: '0px none oklch(0.74 0.014 250)' },
          fenster: { color: 'oklch(0.84 0.08 255)', backgroundColor: 'oklch(0.32 0.06 255)', border: '0px none oklch(0.84 0.08 255)' } },
};
const GEMEINSAM = { fontFamily: SCHRIFT, fontSize: '11px', padding: '0px 4px', textDecorationLine: 'none', height: 16 };

/** Arbeits-Repository R mit WBS `I0007`/`I0008` (`I0008` braucht `I0007`) und Anforderung `R00014`. */
function arbeitsRepository() {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-r00212-')));
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.mkdirSync(path.join(r, 'Anforderungen'));
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/kd.md'), WBS);
  fs.writeFileSync(path.join(r, 'Anforderungen/R00014-probe.md'), '# R00014: Probe\n');
  return r;
}

/** Register mit `kd` und, wenn `zweite` gesetzt ist, einer zweiten Anwendung `lc`. */
const register = (r, zweite) => `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n${zweite ? `    lc: {name: localchat, repository: ${r}, wbs: "", requirements: ""}\n` : ''}    kd: {name: kanbanD, repository: ${r}, wbs: ${r}/Dokumentation/Planung/kd.md, requirements: ${r}/Anforderungen}\n---\n`;

/** Ausgangslage von R00212: #1 mit `kd:I0007, kd:R00014`, Label `braucht:2` und 30 Minuten; #2 mit `kd:I0008`; #3 ohne Herkunft. */
function ausgangslage(r, extra = {}, zweite = false) {
  return {
    'kanbanD.md': register(r, zweite),
    'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
    'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nlabels: [braucht:2]\norigins: [kd:I0007, kd:R00014]\n---\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 09:30 · st\n```\n',
    'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\norigins: [kd:I0008]\n---\n',
    'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
    ...extra,
  };
}

const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
const chip = (ort, text) => ort.locator('.org', { hasText: text });
async function fensterOeffnen(page, nr) {
  await karte(page, nr).locator('.id').click();
  await reiter(page, 'Details');
  await expect(page.locator('#fenster .felder-details')).toBeVisible();
}
/** Berechnete Stile des Chips: die Werte der Zusage AK 3. */
const messung = ort => ort.evaluate(e => {
  const c = getComputedStyle(e);
  return { color: c.color, backgroundColor: c.backgroundColor, border: c.border, fontFamily: c.fontFamily, fontSize: c.fontSize, padding: c.padding, textDecorationLine: c.textDecorationLine, height: e.getBoundingClientRect().height, cursor: c.cursor };
});

test.describe('R00212 Herkunft als Text ohne Auflösung', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k, repos = [], anfragen;
  test.afterEach(async () => { await k.stoppen(); for (const r of repos) fs.rmSync(r, { recursive: true, force: true }); repos = []; });

  async function starten(page, extra = {}, zweite = false) {
    const r = arbeitsRepository(); repos.push(r);
    k = await kanbanStarten(einrichten(ausgangslage(r, extra, zweite)));
    await alsPerson(page, 'st');
    anfragen = [];
    page.on('request', a => anfragen.push(new URL(a.url()).pathname));
    await page.goto(k.adresse);
    await bereit(page, karte(page, 1));
  }

  test('AK 2: jeder Chip ist Text ohne href und title, ohne Anfrage an /api/herkunft; Klick öffnet die Karte', async ({ page }) => {
    await starten(page);
    await page.reload();
    await bereit(page, karte(page, 1));
    for (const text of ['kd:I0007', 'kd:R00014']) {
      const c = chip(karte(page, 1), text);
      await expect(c).toHaveCount(1);
      expect(await c.evaluate(e => [e.tagName, e.hasAttribute('href'), e.hasAttribute('title')])).toEqual(['SPAN', false, false]);
    }
    expect(await page.locator('.org').evaluateAll(l => l.filter(e => e.hasAttribute('href') || /Quelle|Editor/.test(e.getAttribute('title') || '')).length)).toBe(0);
    await expect(karte(page, 3).locator('.org.leer')).toHaveText('ohne Herkunft');
    // Klick auf den Chip der Karte öffnet das Fenster wie ein Klick auf den Titel, ohne Navigation und ohne vscode:
    const adresse = page.url();
    await chip(karte(page, 1), 'kd:I0007').click();
    await expect(page.locator('#fenster')).toBeVisible();
    await expect(page.locator('#fenster')).toContainText('eins');
    expect(page.url().split('#')[0]).toBe(adresse.split('#')[0]);
    await reiter(page, 'Details');
    const imFenster = chip(page.locator('#fenster'), 'kd:I0007');
    expect(await imFenster.evaluate(e => [e.tagName, e.hasAttribute('href'), e.hasAttribute('title')])).toEqual(['SPAN', false, false]);
    const hash = await page.evaluate(() => location.hash);
    await imFenster.click();
    await expect(page.locator('#fenster')).toBeVisible();
    expect(await page.evaluate(() => location.hash), 'ein Klick auf den Chip im Fenster tut nichts').toBe(hash);
    expect(anfragen.filter(p => p === '/api/herkunft'), 'Laden, Neuladen und Klicken fragen /api/herkunft nie an').toEqual([]);
  });

  test('AK 2: ohne Kürzel ist die Herkunft bei zwei Anwendungen mehrdeutig, mit Kürzel nicht', async ({ page }) => {
    await starten(page, { 'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\norigins: [I0007]\n---\n' }, true);
    await expect(karte(page, 3).locator('.org.mehrdeutig')).toHaveText('I0007 · mehrdeutig');
    await expect(karte(page, 3).locator('.org.mehrdeutig')).toHaveAttribute('title', 'mehrdeutig — mehrere Anwendungen registriert; mit Kürzel schreiben, z. B. kd:I0007');
    await expect(chip(karte(page, 1), 'kd:I0007')).toHaveText('kd:I0007');
    await expect(karte(page, 1).locator('.org.mehrdeutig')).toHaveCount(0);
  });

  test('AK 2a: im Fenster ist kein .org fokussierbar, die Tab-Folge nennt nur ✕ und Feld, der Text steht hinter der Beschriftung', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    const orgs = page.locator('#fenster .org');
    expect(await orgs.evaluateAll(l => l.map(e => [e.tabIndex < 0, e.hasAttribute('href')]))).toEqual([[true, false], [true, false]]);
    await page.getByLabel('Herkunft kd:I0007 entfernen').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Herkunft kd:R00014 entfernen')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Neue Herkunft')).toBeFocused();
    // Lesereihenfolge: Beschriftung „origins“, Chip, ✕
    const reihenfolge = await page.locator('#fenster .felder-details').evaluate(f => {
      const bst = [...f.querySelectorAll('.sl')].find(e => e.textContent === 'origins');
      const zeile = bst.closest('.kb').nextElementSibling;
      return { beschriftung: bst.textContent, erster: [...zeile.querySelector('.ochip').children].map(e => e.tagName + ':' + (e.textContent || e.getAttribute('aria-label'))) };
    });
    expect(reihenfolge).toEqual({ beschriftung: 'origins', erster: ['SPAN:kd:I0007', 'BUTTON:×'] });
  });

  test('AK 3: Ruhezustand wie vor der Karte, 16 px hoch, hell und dunkel, ohne Hover-Änderung und ohne eigenen Zeiger', async ({ page }) => {
    await starten(page);
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      const c = chip(karte(page, 1), 'kd:I0007');
      await expect.poll(() => messung(c)).toMatchObject({ ...RUHE[t].karte, ...GEMEINSAM });
      const ruhe = await messung(c);
      expect(await karte(page, 1).evaluate(e => getComputedStyle(e).cursor), 'kein eigener Zeiger am Chip der Karte').toBe(ruhe.cursor);
      await c.hover();
      expect(await messung(c), 'Hover ändert nichts').toEqual(ruhe);
      await page.mouse.move(0, 0);
    }
    await fensterOeffnen(page, 1);
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      const c = chip(page.locator('#fenster'), 'kd:I0007');
      await expect.poll(() => messung(c)).toMatchObject({ ...RUHE[t].fenster, ...GEMEINSAM });
      const ruhe = await messung(c);
      expect(ruhe.cursor).not.toBe('pointer');
      await c.hover();
      expect(await messung(c), 'Hover ändert nichts').toEqual(ruhe);
    }
    await expect(page.locator('a.org')).toHaveCount(0);
  });

  test('AK 4: kein „wartet auf“ trotz Braucht in der WBS, braucht:2 bleibt als Label', async ({ page }) => {
    await starten(page);
    await expect(karte(page, 2).locator('.wartet')).toHaveCount(0);
    await expect(karte(page, 2)).not.toContainText('wartet auf');
    await expect(karte(page, 1).locator('.lbl', { hasText: 'braucht:2' })).toHaveCount(1);
    for (const nr of [1, 2]) {
      await expect(karte(page, nr)).not.toContainText('⧗');
    }
    await fensterOeffnen(page, 2);
    await expect(page.locator('#fenster')).not.toContainText('wartet auf');
    await expect(page.locator('#fenster .wartet')).toHaveCount(0);
    expect(await page.locator('#fenster .k').evaluateAll(l => l.filter(e => !e.textContent.trim()).length), 'kein leeres .k').toBe(0);
    await page.keyboard.press('Escape');
    await fensterOeffnen(page, 1);
    await expect(page.getByLabel('Labels')).toHaveValue('braucht:2');
  });

  test('AK 5: neue Herkunft erscheint als Chip, ✕ und Rückgängig stellen sie an derselben Stelle wieder her', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 3);
    await page.getByLabel('Neue Herkunft').fill('kd:I0009');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0003-drei.md')).toContain('origins: [kd:I0009]');
    await expect(chip(page.locator('#fenster'), 'kd:I0009')).toBeVisible();
    await page.getByLabel('Neue Herkunft').fill('kd:I0010');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0003-drei.md')).toContain('origins: [kd:I0009, kd:I0010]');
    await expect.poll(() => page.locator('#fenster .ochip .org').allTextContents()).toEqual(['kd:I0009', 'kd:I0010']);
    await bereit(page);
    await page.getByLabel('Herkunft kd:I0009 entfernen').click();
    await expect.poll(() => k.lies('aufgaben/0003-drei.md')).toContain('origins: [kd:I0010]');
    await page.locator('[aria-modal="true"] .toast[role="status"]').getByRole('button', { name: 'rückgängig' }).click();
    await expect.poll(() => k.lies('aufgaben/0003-drei.md')).toContain('origins: [kd:I0009, kd:I0010]');
    await expect.poll(() => page.locator('#fenster .ochip .org').allTextContents()).toEqual(['kd:I0009', 'kd:I0010']);
  });

  test('AK 6: Filter origin: und Export der Zeiten wie vor der Karte', async ({ page }) => {
    await starten(page);
    const sichtbar = page.locator('.ka:visible');
    await page.getByLabel('Filter').fill('origin:kd:I0007');
    await expect.poll(() => sichtbar.evaluateAll(l => l.map(e => e.dataset.id))).toEqual(['1']);
    await page.getByLabel('Filter').fill('origin:"thin air"');
    await expect.poll(() => sichtbar.evaluateAll(l => l.map(e => e.dataset.id))).toEqual(['3']);
    const csv = await (await page.request.get(k.adresse + 'api/berichte/zeiten.csv')).text();
    expect(csv.split('\n')).toContain('1;eins;st;human;2026-10-17 09:00;2026-10-17 09:30;30;kd:I0007 kd:R00014');
  });
});
