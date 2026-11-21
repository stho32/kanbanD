// R00219 Ansicht „Läufe“ im Aufgabenfenster (Karte #217, I0209, Scheibe D1) — AK 3–10 im echten Programm.
// Ausgangslage und Hilfen: laeufe-hilfen.js (Boards `fabrik` erfassend und `zweit` ausgeschaltet, Aufgaben #1–#6).
// Zeitproben deterministisch: Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten;
// jede Verneinung („kein GET“) erst nach einem sichtbaren Signal.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, reiter, alsPerson, mutanteEinsetzen } = require('./hilfen');
const lauf = require('./laeufe-hilfen');

const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const MENUE = '#fenster [role="menu"][data-art="ansicht"]';
const ANSICHT_LAEUFE = '#fenster .mod-body[aria-label="Ansicht: Läufe"]';
const ANSICHT_INHALT = '#fenster .mod-body[data-ansicht="inhalt"]';

/** Zählt die GET-Aufrufe `…/transkripte` der Aufgabe `nr` (ohne Herunterladen einzelner Transkripte). */
function zaehlen(page, nr) {
  const aufrufe = [];
  page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === `/api/aufgaben/${nr}/transkripte`) aufrufe.push(r.url()); });
  return aufrufe;
}

test.describe('R00219 Ansicht „Läufe“', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lauf.MENSCH);
    k = await kanbanStarten(lauf.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1, board = 'fabrik') {
    await page.goto(`${k.adresse}#/board/${board}/aufgabe/${nr}`);
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
    await liveBereit(page);
  }
  const ausloeser = page => page.locator(AUSLOESER);
  const menue = page => page.locator(MENUE);
  const menueNamen = page => menue(page).getByRole('menuitemradio').evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
  async function menueOeffnen(page) { await ausloeser(page).click(); await menue(page).waitFor(); }

  /* ── AK 3 Ort und Sichtbarkeit ── */

  test('AK 3: #1 mit Kosten und ohne Commits nennt „…, Datei, Kosten, Läufe, Verlauf“; #5 mit Commit-Verweis „…, Kosten, Commits, Läufe, Verlauf“', async ({ page }) => {
    await oeffnen(page, 1);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Läufe', 'Verlauf']);
    await page.keyboard.press('Escape');
    await oeffnen(page, 5);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Commits', 'Läufe', 'Verlauf']);
  });

  test('AK 3 · US-4: #2 nur mit Kosten hat kein „Läufe“, und es wird kein GET …/transkripte gesendet (geprüft bei sichtbarem Menü)', async ({ page }) => {
    const gelesen = zaehlen(page, 2);
    await oeffnen(page, 2);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']);
    expect(gelesen).toEqual([]);
  });

  test('AK 3 · US-4: werden an #1 alle Transkripte über die API gelöscht, während „Läufe“ offen ist, zeigt das Fenster „Inhalt“ und der Fokus steht auf „Ansicht: Inhalt“', async ({ page }) => {
    await oeffnen(page, 1);
    await reiter(page, 'Läufe');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Läufe');
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    for (const kennung of [lauf.L.L1, lauf.L.L2, lauf.L.L3, lauf.L.L5]) await lauf.entfernen(k.adresse, 1, kennung);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(ANSICHT_LAEUFE)).toHaveCount(0);
    await expect(page.locator(ANSICHT_INHALT)).toBeVisible();
    await expect(ausloeser(page)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });
});
