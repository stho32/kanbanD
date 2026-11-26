// R00259 (I0249, Karte #235): „wartet auf #n" an der Karte und im Aufgabenfenster — AK 1–10, 12 gegen das echte Programm.
// Schichten: Testfall (je AK) → Testsprache (`ausgangslage`, `karte`, `fensterOeffnen`) → Treiber (Playwright).
// Browser-Eigenes (Darstellung, Fokus, Live, Aria) über E2E; die Deutung prüft der Unit-Test (e2e/einheit/braucht.test.js).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter, bereit, breiteSetzen } = require('./hilfen');

// ---- Testsprache --------------------------------------------------------------------------------------------------------

const EINSTELLUNGEN = '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\n---\n';

/** Ausgangslage von R00259: #1 Gerüst (offen), #2 Bau `[ui, braucht:1]`, #3 Doku `[braucht:1, braucht:4]` (#4 archiviert),
 *  #5 Frei ohne Labels, #7 Berichte (offen), #6 Fertig-Karte in „Fertig" `braucht:1`. */
function ausgangslage(extra = {}) {
  return {
    'kanbanD.md': EINSTELLUNGEN,
    'boards/e.md': '# e\n\n## Offen\n\n- #1\n- #2\n- #3\n- #5\n- #7\n\n## In Arbeit\n\n## Fertig\n\n- #6\n',
    'aufgaben/0001-geruest.md': '---\nid: 1\ntitle: Gerüst\n---\n',
    'aufgaben/0002-bau.md': '---\nid: 2\ntitle: Bau\nlabels: [ui, "braucht:1"]\n---\n',
    'aufgaben/0003-doku.md': '---\nid: 3\ntitle: Doku\nlabels: ["braucht:1", "braucht:4"]\n---\n',
    'aufgaben/0004-alt.md': '---\nid: 4\ntitle: Alt\narchived: 2026-11-01\n---\n',
    'aufgaben/0005-frei.md': '---\nid: 5\ntitle: Frei\n---\n',
    'aufgaben/0006-fertig.md': '---\nid: 6\ntitle: Fertig-Karte\nlabels: ["braucht:1"]\n---\n',
    'aufgaben/0007-berichte.md': '---\nid: 7\ntitle: Berichte\n---\n',
    ...extra,
  };
}

const ALS_CL = { headers: { 'X-KanbanD-Wer': 'cl', 'X-KanbanD-Instanz': 'lauf-1' } };
const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
const chipAnKarte = (page, nr) => karte(page, nr).locator('.wt-chip');
const labelFeld = page => page.locator('#fenster [data-af="labels"]');

/** Öffnet das Aufgabenfenster der Karte `nr` und schaltet auf die Ansicht `name`. `kdTest.gezeichnet()` ist bei offenem Fenster
 *  nicht wahr (die Adresse und die geladene Datei stehen außerhalb des zuletzt geladenen Stands) — gewartet wird auf den Dialog. */
async function fensterOeffnen(page, nr, name = 'Details') {
  if (await page.locator('#fenster').count()) { await page.keyboard.press('Escape'); await expect(page.locator('#fenster')).toHaveCount(0); }
  await karte(page, nr).locator('.id').click();
  await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  await reiter(page, name);
  await expect(page.locator('#fenster .mod-body')).toBeVisible();
}

/** Die erste Anfrage `GET /api/aufgaben` und alle Anfragen zählen; null lässt den Zähler laufen. */
function anfragenAufzeichnen(page) {
  const anfragen = [];
  page.on('request', a => anfragen.push(new URL(a.url()).pathname));
  return anfragen;
}

// ---- Testfälle ----------------------------------------------------------------------------------------------------------

test.describe('R00259 wartet auf #n', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

  async function starten(page, extra = {}) {
    k = await kanbanStarten(einrichten(ausgangslage(extra)));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await bereit(page, karte(page, 1));
  }

  test('AK 1: #2 trägt genau einen Chip „wartet auf #1", nur „ui" als Label, Name nennt ihn; #3 einen, #5 keinen', async ({ page }) => {
    await starten(page);
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
    await expect(chipAnKarte(page, 2)).toHaveText('wartet auf #1');
    await expect(chipAnKarte(page, 2)).toHaveAttribute('title', 'Gerüst');
    expect(await chipAnKarte(page, 2).locator('svg').count(), 'Sanduhr am Chip').toBe(1);
    expect(await karte(page, 2).locator('.lbl').allTextContents()).toEqual(['ui']);
    await expect(chipAnKarte(page, 3)).toHaveCount(1);
    await expect(chipAnKarte(page, 3)).toHaveText('wartet auf #1');
    await expect(chipAnKarte(page, 5)).toHaveCount(0);
    expect(await karte(page, 2).getAttribute('aria-label')).toContain('wartet auf #1');
  });

  test('AK 3: fehlende Datei — derselbe Chip, Tooltip „#999 fehlt", keine Warnfarbe, Name „… wartet auf #999, fehlt"', async ({ page }) => {
    await starten(page, { 'aufgaben/0005-frei.md': '---\nid: 5\ntitle: Frei\nlabels: ["braucht:999"]\n---\n' });
    const chip = chipAnKarte(page, 5);
    await expect(chip).toHaveCount(1);
    await expect(chip).toHaveText('wartet auf #999');
    await expect(chip).toHaveAttribute('title', '#999 fehlt');
    expect(await karte(page, 5).getAttribute('aria-label')).toContain('wartet auf #999, fehlt');
    // keine Warnfarbe: der Chip sieht aus wie der von #2 (hell)
    const grund = await chip.evaluate(e => getComputedStyle(e).backgroundColor);
    const vergleich = await chipAnKarte(page, 2).evaluate(e => getComputedStyle(e).backgroundColor);
    expect(grund).toBe(vergleich);
  });

  test('AK 4: #6 in „Fertig" trägt ihren offenen Chip; ist #1 erledigt, keinen', async ({ page }) => {
    await starten(page);
    await expect(chipAnKarte(page, 6)).toHaveCount(1);
    await expect(chipAnKarte(page, 6)).toHaveText('wartet auf #1');
    await expect(chipAnKarte(page, 6)).toHaveCount(1);
    await page.request.post(k.adresse + 'api/boards/e/bewegen', { ...ALS_CL, data: { nummer: 1, spalte: 'Fertig' } });
    await expect(chipAnKarte(page, 6)).toHaveCount(0);
  });

  test('AK 5: zwei Chips bei 320 px sichtbar, Seite scrollt nicht quer', async ({ page }) => {
    await starten(page, { 'aufgaben/0003-doku.md': '---\nid: 3\ntitle: Doku\nlabels: ["braucht:1", "braucht:7"]\n---\n' });
    await breiteSetzen(page, 320, 800);
    await bereit(page);
    await expect(chipAnKarte(page, 3)).toHaveCount(2);
    for (const c of await chipAnKarte(page, 3).all()) await expect(c).toBeVisible();
    const eng = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(eng, 'die Seite scrollt nicht quer').toBe(true);
  });

  test('AK 5 Variante: sechs Chips bei 320 px liegen ganz in der Karte, kein Querscrollen', async ({ page }) => {
    const extra = {};
    for (const nr of [8, 9, 10, 11]) extra[`aufgaben/000${nr}-k${nr}.md`] = `---\nid: ${nr}\ntitle: K${nr}\n---\n`;
    extra['boards/e.md'] = '# e\n\n## Offen\n\n- #1\n- #2\n- #3\n- #5\n- #7\n- #8\n- #9\n- #10\n- #11\n\n## In Arbeit\n\n## Fertig\n\n- #6\n';
    extra['aufgaben/0003-doku.md'] = '---\nid: 3\ntitle: Doku\nlabels: ["braucht:1", "braucht:7", "braucht:8", "braucht:9", "braucht:10", "braucht:11"]\n---\n';
    await starten(page, extra);
    await breiteSetzen(page, 320, 800);
    await bereit(page);
    await expect(chipAnKarte(page, 3)).toHaveCount(6);
    const ausserhalb = await chipAnKarte(page, 3).evaluateAll(ls => ls.map(c => {
      const r = c.getBoundingClientRect(), kasten = c.closest('.ka').getBoundingClientRect();
      return r.left >= kasten.left - 0.5 && r.right <= kasten.right + 0.5;
    }));
    expect(ausserhalb).toEqual([true, true, true, true, true, true]);
    const eng = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(eng, 'die Seite scrollt nicht quer').toBe(true);
  });

  test('AK 6: Fenster #3 zeigt „wartet auf #1 Gerüst" und „#4 erledigt"; #5 „#999 fehlt" als Warnung ohne Bedienelement — auch in der schmalen Spalte', async ({ page }) => {
    await starten(page, { 'aufgaben/0005-frei.md': '---\nid: 5\ntitle: Frei\nlabels: ["braucht:999"]\n---\n' });
    await fensterOeffnen(page, 3, 'Details');
    await expect(page.locator('#fenster .wt-dep .wt-t', { hasText: 'wartet auf #1 Gerüst' })).toHaveCount(1);
    await expect(page.locator('#fenster .wt-dep.erledigt .wt-t', { hasText: '#4 erledigt' })).toHaveCount(1);
    await fensterOeffnen(page, 5, 'Details');
    const fehlt = page.locator('#fenster .wt-dep.fehlt .wt-t');
    await expect(fehlt).toHaveText('#999 fehlt');
    expect(await fehlt.evaluate(e => [e.tagName, e.hasAttribute('href')])).toEqual(['SPAN', false]);
    expect(await fehlt.evaluate(e => e.tabIndex)).toBeLessThan(0);
    // schmale Spalte im Inhalt: dieselben Chips
    await reiter(page, 'Inhalt');
    await expect(page.locator('#inhalt-spalte .wt-dep.fehlt .wt-t')).toHaveText('#999 fehlt');
  });

  test('AK 7: Klick auf „wartet auf #1" öffnet #1 (Adresse /aufgabe/1); „#4 erledigt" öffnet #4', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 3, 'Details');
    await page.locator('#fenster .wt-dep .wt-t', { hasText: 'wartet auf #1 Gerüst' }).click();
    await expect(page.locator('#fenster .mod-kopf .id')).toHaveText('#1');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/\/aufgabe\/1$/);
    await fensterOeffnen(page, 3, 'Details');
    await page.locator('#fenster .wt-dep.erledigt .wt-t', { hasText: '#4 erledigt' }).click();
    await expect(page.locator('#fenster .mod-kopf .id')).toHaveText('#4');
    await expect.poll(() => page.evaluate(() => location.hash)).toMatch(/\/aufgabe\/4$/);
  });

  test('AK 8: Feld führt nur „ui"; „ui, prio" speichern schickt braucht:1 mit, der Chip bleibt', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 2, 'Details');
    await expect(labelFeld(page)).toHaveValue('ui');
    await labelFeld(page).fill('ui, prio');
    await labelFeld(page).blur();
    await expect.poll(() => k.lies('aufgaben/0002-bau.md')).toMatch(/labels: \[(.*"?)braucht:1/);
    const text = k.lies('aufgaben/0002-bau.md');
    expect(text.indexOf('braucht:1')).toBeGreaterThanOrEqual(0);
    expect(text.indexOf('braucht:1')).toBeLessThan(text.indexOf('ui'));
    expect(text.indexOf('ui')).toBeLessThan(text.indexOf('prio'));
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
  });

  test('AK 9: × entfernt braucht:1, ui bleibt, ein Commit, Hinweis „Abhängigkeit #1 entfernt" mit Rückgängig', async ({ page }) => {
    await starten(page);
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await fensterOeffnen(page, 2, 'Details');
    await page.getByLabel('Abhängigkeit #1 entfernen').click();
    await expect.poll(() => k.lies('aufgaben/0002-bau.md')).not.toContain('braucht:1');
    expect(k.lies('aufgaben/0002-bau.md')).toContain('ui');
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(vorher + 1);
    await expect(labelFeld(page)).toBeVisible();
    const toast = page.locator('#fenster .toast[role="status"]');
    await expect(toast).toContainText('Abhängigkeit #1 entfernt');
    await toast.getByRole('button', { name: 'rückgängig' }).click();
    await expect.poll(() => k.lies('aufgaben/0002-bau.md')).toContain('braucht:1');
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
  });

  test('AK 9: [braucht:1, BRAUCHT:1] — ein × entfernt beide', async ({ page }) => {
    await starten(page, { 'aufgaben/0002-bau.md': '---\nid: 2\ntitle: Bau\nlabels: [ui, "braucht:1", "BRAUCHT:1"]\n---\n' });
    await fensterOeffnen(page, 2, 'Details');
    await page.getByLabel('Abhängigkeit #1 entfernen').click();
    await expect.poll(() => k.lies('aufgaben/0002-bau.md')).not.toContain('braucht:1');
    expect(k.lies('aufgaben/0002-bau.md').toLowerCase()).not.toContain('braucht:1');
  });

  test('AK 9: #1 inzwischen gelöscht — Rückgängig zeigt die 400, nichts wird geschrieben', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 2, 'Details');
    await page.getByLabel('Abhängigkeit #1 entfernen').click();
    await expect.poll(() => k.lies('aufgaben/0002-bau.md')).not.toContain('braucht:1');
    await page.request.delete(k.adresse + 'api/aufgaben/1', ALS_CL);
    const textVorher = k.lies('aufgaben/0002-bau.md');
    await page.locator('#fenster .toast[role="status"]').getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('#fenster')).toContainText('Aufgabe #1 gibt es nicht (braucht:1)');
    expect(k.lies('aufgaben/0002-bau.md')).toBe(textVorher);
  });

  test('AK 10: 400 am Label-Feld — Eingabe bleibt, aria-invalid, Verweis auf die Meldung, Datei bytegleich', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 5, 'Details');
    const vorher = k.lies('aufgaben/0005-frei.md');
    const vorCommits = +k.git('rev-list', '--count', 'HEAD');
    await labelFeld(page).fill('braucht:999');
    await labelFeld(page).blur();
    await expect(page.locator('#fenster .fehl')).toContainText('Aufgabe #999 gibt es nicht (braucht:999)');
    await expect(labelFeld(page)).toHaveValue('braucht:999');
    await expect(labelFeld(page)).toHaveAttribute('aria-invalid', 'true');
    expect(await labelFeld(page).getAttribute('aria-describedby')).toBe('fenster-meldung');
    expect(k.lies('aufgaben/0005-frei.md')).toBe(vorher);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorCommits);
    // Selbstbezug
    await labelFeld(page).fill('braucht:5');
    await labelFeld(page).blur();
    await expect(page.locator('#fenster .fehl')).toContainText('#5 kann nicht auf sich selbst warten');
    // 400 ohne braucht: Feld bleibt, Meldung im Wortlaut des Servers
    await labelFeld(page).fill('braucht:5', 'x'.repeat(200));
    await labelFeld(page).blur();
    await expect(page.locator('#fenster .fehl')).toBeVisible();
    expect(k.lies('aufgaben/0005-frei.md')).toBe(vorher);
  });

  test('AK 10: nach erfolgreichem Speichern ist das Feld nicht mehr ungültig', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 5, 'Details');
    await labelFeld(page).fill('braucht:999');
    await labelFeld(page).blur();
    await expect(labelFeld(page)).toHaveAttribute('aria-invalid', 'true');
    await labelFeld(page).fill('braucht:1');
    await labelFeld(page).blur();
    await expect.poll(() => k.lies('aufgaben/0005-frei.md')).toContain('braucht:1');
    await expect(labelFeld(page)).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('AK 12: genau eine Anfrage GET /api/aufgaben je Aufbau, keine GET /api/aufgaben/1', async ({ page }) => {
    k = await kanbanStarten(einrichten(ausgangslage()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await bereit(page, karte(page, 1));
    const anfragen = anfragenAufzeichnen(page);
    await page.reload();
    await bereit(page, karte(page, 1));
    await fensterOeffnen(page, 2, 'Details');
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
    expect(anfragen.filter(p => p === '/api/aufgaben').length, 'genau eine Liste je Aufbau').toBe(1);
    expect(anfragen.filter(p => p === '/api/aufgaben/1'), 'die gebrauchte Karte wird nicht geladen').toEqual([]);
  });

  test('AK 2: Live — #1 nach „Fertig": Chips weg, Fenster zeigt „#1 erledigt"; zurück: wieder da', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 2, 'Details');
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
    await page.request.post(k.adresse + 'api/boards/e/bewegen', { ...ALS_CL, data: { nummer: 1, spalte: 'Fertig' } });
    await expect(chipAnKarte(page, 2)).toHaveCount(0);
    await expect(chipAnKarte(page, 3)).toHaveCount(0);
    await expect(page.locator('#fenster .wt-dep.erledigt .wt-t')).toContainText('#1 erledigt');
    await page.request.post(k.adresse + 'api/boards/e/bewegen', { ...ALS_CL, data: { nummer: 1, spalte: 'Offen' } });
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
  });

  test('Sollte (UX 3): scheitert × mit einem Serverfehler, bleibt der Chip und die Meldung nennt den Vorgang', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 2, 'Details');
    await page.route('**/api/aufgaben/2', async route => {
      if (route.request().method() === 'PATCH') return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ fehler: 'kaputt' }) });
      return route.continue();
    });
    await page.getByLabel('Abhängigkeit #1 entfernen').click();
    await expect(page.locator('#fenster .fehl')).toContainText('Abhängigkeit #1 nicht entfernt');
    await expect(chipAnKarte(page, 2)).toHaveCount(1);
  });
});
