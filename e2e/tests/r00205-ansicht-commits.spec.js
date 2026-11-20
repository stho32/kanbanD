// R00205 Ansicht „Commits“ im Aufgabenfenster (Karte #212, I0195, Scheibe B1) — AK 1–10 im echten Programm gegen echtes Git.
// Ausgangslage und Hilfen: commits-hilfen.js (Arbeits-Repository R, Register, Aufgaben #1–#5).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit, reiter, mutanteEinsetzen } = require('./hilfen');
const { geteiltesRepository, ausgangslageVorbereiten } = require('./commits-hilfen');

const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const MENUE = '#fenster [role="menu"][data-art="ansicht"]';
const ANSICHT_COMMITS = '#fenster .mod-body[aria-label="Ansicht: Commits"]';
const AGENT = { 'X-KanbanD-Wer': 'cl' };

test.describe('R00205 Ansicht „Commits“', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    const geteilt = geteiltesRepository();
    rep = geteilt.rep;
    k = await kanbanStarten(ausgangslageVorbereiten(rep, geteilt.basis));
  });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  const ausloeser = page => page.locator(AUSLOESER);
  const menue = page => page.locator(MENUE);
  const eintraege = page => menue(page).getByRole('menuitemradio');
  const menueNamen = page => eintraege(page).evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
  async function menueOeffnen(page) { await ausloeser(page).click(); await menue(page).waitFor(); }

  /* ── AK 1 Ort und Sichtbarkeit ── */

  test('AK 1: #1 mit fünf Verweisen nennt „Commits“ zwischen „Datei“ und „Verlauf“, mit Preisetikett hinter „Kosten“', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Commits', 'Verlauf']);
    await page.keyboard.press('Escape');
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: AGENT, data: { cost: { currency: 'USD', amount: 1.63 } } })).ok()).toBe(true);
    await expect(async () => {
      if (await menue(page).count() === 0) await ausloeser(page).click();
      expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Commits', 'Verlauf']);
    }).toPass();
  });

  test('AK 1: #2 ohne Verweise hat keinen Eintrag und sendet kein GET …/commits (geprüft bei sichtbarem Menü)', async ({ page }) => {
    const gelesen = [];
    page.on('request', r => { if (r.method() === 'GET' && /\/api\/aufgaben\/\d+\/commits$/.test(new URL(r.url()).pathname)) gelesen.push(r.url()); });
    await oeffnen(page, 2);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
    expect(gelesen).toEqual([]);
  });

  test('AK 1: fallen alle Verweise von #1 weg, entfällt der Eintrag, das Fenster zeigt „Inhalt“, der Fokus steht auf dem Auslöser', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Commits');
    await expect(page.locator(ANSICHT_COMMITS)).toBeVisible();
    const verweise = (await (await page.request.get(k.adresse + 'api/aufgaben/1')).json()).commits;
    expect(verweise).toHaveLength(5);
    for (const v of verweise) expect((await page.request.delete(k.adresse + 'api/aufgaben/1/commits/' + encodeURIComponent(v), { headers: AGENT })).ok()).toBe(true);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(ANSICHT_COMMITS)).toHaveCount(0);
    await expect(ausloeser(page)).toBeFocused();
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
  });

  test('AK 1: bekommt #2 den ersten Verweis (Live), steht „Commits“ im Menü, und das Fenster bleibt auf „Inhalt“', async ({ page }) => {
    await oeffnen(page, 2);
    await liveBereit(page);
    expect((await page.request.post(k.adresse + 'api/aufgaben/2/commits', { headers: AGENT, data: { commits: [`kd:${rep.k1}`] } })).ok()).toBe(true);
    await expect(async () => {
      if (await menue(page).count() === 0) await ausloeser(page).click();
      expect(await menueNamen(page)).toContain('Commits');
    }).toPass();
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(ANSICHT_COMMITS)).toHaveCount(0);
  });

  test('AK 1: bei offenem Menü fügt das Ereignis „Commits“ ein — Menü und Fokus bleiben, Pfeilreihenfolge Datei → Commits → Verlauf', async ({ page }) => {
    await oeffnen(page, 2);
    await liveBereit(page);
    await menueOeffnen(page);
    const inhalt = eintraege(page).filter({ hasText: 'Inhalt' });
    await expect(inhalt).toBeFocused();
    expect((await page.request.post(k.adresse + 'api/aufgaben/2/commits', { headers: AGENT, data: { commits: [`kd:${rep.k1}`] } })).ok()).toBe(true);
    await expect(eintraege(page)).toHaveCount(6);
    await expect(menue(page)).toBeVisible();
    await expect(inhalt).toBeFocused();
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Commits', 'Verlauf']);
    for (const name of ['Zeiten', 'Details', 'Datei', 'Commits', 'Verlauf']) {
      await page.keyboard.press('ArrowDown');
      await expect(menue(page).getByRole('menuitemradio', { name, exact: true })).toBeFocused();
    }
  });
});
