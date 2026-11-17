// R00189 (Karte #86, I0179 B0928–B0930; ADR-0015 N3): die Fenstermeldung behält beim Neuzeichnen ihren Knoten.
// Solange dieselbe Meldung im selben Aufgabenfenster steht, ist ihr Knoten über jedes Neuzeichnen dasselbe Objekt;
// eine neu gesetzte Meldung — auch mit gleichem Text — ist ein neuer Knoten. Geprüft über die Objektidentität im Browser.
const { test, expect } = require('@playwright/test');
const { reiter } = require('./hilfen');
const { MELDUNG_X1, MELDUNG_DAUER, starten, fensterOeffnen, fremdesNeuzeichnen } = require('./r00155-hilfen');

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/** Ausgangslage: Aufgabenfenster von #1, in „Neue Herkunft“ `X1` mit Enter abgeschickt, die Meldung steht im Fensterfuß. */
async function x1Abgelehnt(page) {
  k = await starten(page);
  const fenster = await fensterOeffnen(page, 1);
  await reiter(page, 'Details');
  const herkunft = fenster.getByLabel('Neue Herkunft');
  await herkunft.fill('X1');
  await page.keyboard.press('Enter');
  await expect(fenster.locator('.mod-fuss [role=alert]')).toContainText(MELDUNG_X1);
  return { fenster, herkunft };
}

/** Hält den heutigen Knoten der Meldung im Browser fest und zählt ab jetzt jedes Ersetzen des Inhalts von `#over`. */
function knotenFesthalten(page) {
  return page.evaluate(() => {
    window.__meldung = document.getElementById('fenster-meldung');
    window.__ersetzt = 0;
    if (window.__beobachter) window.__beobachter.disconnect();
    window.__beobachter = new MutationObserver(eintraege => { window.__ersetzt += eintraege.filter(e => e.removedNodes.length).length; });
    window.__beobachter.observe(document.getElementById('over'), { childList: true });
  });
}

/** Wie steht der festgehaltene Knoten jetzt da? */
function knotenStand(page) {
  return page.evaluate(() => {
    const jetzt = document.getElementById('fenster-meldung');
    return {
      derselbe: jetzt !== null && jetzt === window.__meldung,
      haengt: Boolean(window.__meldung && window.__meldung.isConnected),
      alerts: document.querySelectorAll('#fenster [role=alert]').length,
      imFuss: Boolean(jetzt && jetzt.closest('#fenster .mod-fuss')),
      text: jetzt ? jetzt.textContent : null,
    };
  });
}

test.describe('R00189: die Fenstermeldung behält beim Neuzeichnen ihren Knoten', () => {
  test('AK 1/US-1 (Abnahme-Probe #86): ein Agent ändert #2 dreimal → der Knoten der Meldung ist jedes Mal dasselbe Objekt, einmal als alert im Fuß', async ({ page }) => {
    await x1Abgelehnt(page);
    await knotenFesthalten(page);
    for (const nr of [1, 2, 3]) {
      await fremdesNeuzeichnen(page, k, `Zweite Aufgabe, von bot geändert (${nr})`);
      // ohne Neuzeichnen prüfte die Probe nichts
      await expect.poll(() => page.evaluate(() => window.__ersetzt), `Änderung ${nr}: #over wurde neu gezeichnet`).toBeGreaterThanOrEqual(nr);
      expect(await knotenStand(page), `Änderung ${nr}`).toEqual({ derselbe: true, haengt: true, alerts: 1, imFuss: true, text: expect.stringContaining(MELDUNG_X1) });
    }
  });

  test('AK 2/US-1: nach dem Neuzeichnen steht X1 im Feld, das Feld ist ungültig, verweist auf genau diesen Knoten und hat den Fokus', async ({ page }) => {
    const { herkunft } = await x1Abgelehnt(page);
    await expect(herkunft).toBeFocused();
    await knotenFesthalten(page);
    await fremdesNeuzeichnen(page, k);
    await expect.poll(() => page.evaluate(() => window.__ersetzt)).toBeGreaterThanOrEqual(1);
    await expect(herkunft).toHaveValue('X1');
    await expect(herkunft).toHaveAttribute('aria-invalid', 'true');
    await expect(herkunft).toBeFocused();
    const verweistAufFestgehaltenen = await herkunft.evaluate(feld => document.getElementById(feld.getAttribute('aria-describedby')) === window.__meldung);
    expect(verweistAufFestgehaltenen, 'aria-describedby trifft den festgehaltenen Knoten').toBe(true);
  });

  test('AK 3/US-2: X1 ein zweites Mal und danach abc in „Zeit nachtragen“ → jedes Abschicken ist ein neuer Knoten, zuletzt mit dem Text der Dauer', async ({ page }) => {
    const { fenster } = await x1Abgelehnt(page);
    await knotenFesthalten(page);
    await page.keyboard.press('Enter');
    await expect.poll(() => knotenStand(page), 'X1 erneut: ein neuer Knoten mit demselben Text')
      .toEqual({ derselbe: false, haengt: false, alerts: 1, imFuss: true, text: expect.stringContaining(MELDUNG_X1) });
    await reiter(page, 'Zeiten');
    await knotenFesthalten(page);
    await fenster.getByLabel('Zeit nachtragen').fill('abc');
    await page.keyboard.press('Enter');
    await expect.poll(() => knotenStand(page), 'abc: ein neuer Knoten mit dem Text der Dauer')
      .toEqual({ derselbe: false, haengt: false, alerts: 1, imFuss: true, text: expect.stringContaining(MELDUNG_DAUER) });
  });

  test('AK 3/US-3: Esc räumt die Meldung — kein alert im Fenster von #1; im Fenster von #2 steht keine Meldung und nicht der Knoten aus #1', async ({ page }) => {
    const { fenster } = await x1Abgelehnt(page);
    await knotenFesthalten(page);
    await fremdesNeuzeichnen(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    // auch ein weiteres Neuzeichnen holt die geräumte Meldung nicht zurück
    await fremdesNeuzeichnen(page, k, 'Zweite Aufgabe, nach Esc geändert');
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    await fenster.getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(fenster).toBeHidden();
    const zwei = await fensterOeffnen(page, 2);
    await expect(zwei.locator('[role=alert]')).toHaveCount(0);
    expect(await zwei.evaluate(wurzel => wurzel.contains(window.__meldung)), 'der Knoten aus #1 liegt nicht im Fenster von #2').toBe(false);
  });
});
