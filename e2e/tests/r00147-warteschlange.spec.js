// R00147 Eine gescheiterte Ladung der Warteschlange verschluckt die nächste eigene Änderung nicht mehr
// (Karte #80, ADR-0025 Regel 3 / Nachtrag N1): das Kettenende endet erfüllt, je Fehlschlag genau eine Meldung am Auslöser.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, mutanteEinsetzen } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\n---\n- [ ] eins\n- [ ] zwei\n- [ ] drei\n',
  'aufgaben/0002-board-aufraeumen.md': '---\nid: 2\ntitle: Board aufräumen\n---\n',
};
const KARTE = 'aufgaben/0001-abnahme-pruefen.md';
const HINWEIS = '.toast[role="status"]';
const FUSS = '#fenster .mod-fuss [role="alert"]';

/**
 * Bricht die nächste Anfrage `methode pfad` hart ab (fetch wirft: „Failed to fetch"); weitere Anfragen gehen durch.
 * Der Netzfehler entsteht so an der Grenze des Browsers, ohne den Server zu stoppen.
 */
async function naechsteAbbrechen(page, methode, pfad) {
  let scharf = true;
  await page.route(url => url.pathname === pfad, route => {
    if (!scharf || route.request().method() !== methode) return route.fallback();
    scharf = false;
    return route.abort('failed');
  });
  return { getroffen: () => !scharf };
}

/** Wartet, bis der erste Stand geladen und gezeichnet ist — erst dann darf der nächste GET abgerissen werden. */
async function boardBereit(page) {
  await liveBereit(page);
  await expect(page.locator('.ka[data-id="1"] .naechste-ziel')).toHaveText('eins');
}

/** Zahl der Commits auf `pfad`; der erste kommt aus `einrichten` (Autor „Vorbereitung"). */
const commitsAuf = (k, pfad = KARTE) => +k.git('rev-list', '--count', 'HEAD', '--', pfad);

test.describe('R00147 Warteschlange', () => {
  let k, seitenfehler;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    seitenfehler = [];
    page.on('pageerror', f => seitenfehler.push(f.message));
  });
  test.afterEach(() => k.stoppen());

  test('AK 1–3, 5, 6: nach gescheitertem Nachladen laufen die eigenen Änderungen weiter, eine Meldung sagt was geschah', async ({ page }) => {
    await mutanteEinsetzen(page);
    await page.goto(k.adresse);
    await boardBereit(page);
    await page.evaluate(() => { window.ohneNeuladen = true; });
    const ladungAb = await naechsteAbbrechen(page, 'GET', '/api/zustand');
    const vorher = commitsAuf(k);

    // AK 1: die erste Teilaufgabe wird gespeichert, das Nachladen scheitert (die unbehandelte Ablehnung prüft das Ende)
    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');

    // AK 5/6: genau eine Meldung auf dem Board, sie sagt „gespeichert" und nicht „nichts geändert"; knopflos
    const hinweis = page.locator(HINWEIS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toContainText('gespeichert');
    await expect(hinweis).not.toContainText('nichts geändert');
    await expect(hinweis.locator('button')).toHaveCount(0);
    await expect(page.locator('#fenster')).toHaveCount(0);
    expect(ladungAb.getroffen(), 'das Nachladen ist abgerissen').toBe(true);

    // AK 2: die zweite Teilaufgabe wird wirklich gesendet und committet
    const zweite = page.waitForRequest(r => r.method() === 'PATCH' && new URL(r.url()).pathname === '/api/aufgaben/1/teilaufgaben/1');
    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    expect((await zweite).postDataJSON()).toEqual({ erledigt: true });
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [x] zwei\n- [ ] drei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 2);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');

    // AK 3: auch die dritte kommt an, die Ansicht zeigt den neuen Stand ohne Neuladen der Seite
    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [x] zwei\n- [x] drei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 3);
    await expect(page.locator('.ka[data-id="1"] .naechste-ziel')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"] .tk')).toHaveText('☑ 3/3');
    expect(await page.evaluate(() => window.ohneNeuladen)).toBe(true);
    // AK 1: keine unbehandelte Ablehnung (pageerror) — zuletzt, damit ein Kettenriss die Meldungs- und Sendeprüfungen nicht verdeckt
    expect(seitenfehler, 'unbehandelte Ablehnung (pageerror)').toEqual([]);
  });

  test('AK 8: scheitern eigene Anfrage und Nachladen im selben Schritt, sagt die eine Meldung „nichts geändert"', async ({ page }) => {
    await mutanteEinsetzen(page);
    const eigeneAb = await naechsteAbbrechen(page, 'PATCH', '/api/aufgaben/1/teilaufgaben/0');
    await page.goto(k.adresse);
    await boardBereit(page);
    const ladungAb = await naechsteAbbrechen(page, 'GET', '/api/zustand');
    const vorher = commitsAuf(k);

    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    const hinweis = page.locator(HINWEIS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toHaveText('Keine Verbindung zum Server — nichts geändert.');
    await expect(hinweis).not.toContainText('gespeichert');
    await expect(page.locator('#fenster')).toHaveCount(0);
    expect(eigeneAb.getroffen(), 'die eigene Anfrage ist abgerissen').toBe(true);
    expect(ladungAb.getroffen(), 'das Nachladen ist abgerissen').toBe(true);
    // der Server hat die Änderung nie angenommen: kein Haken, kein Commit
    expect(k.lies(KARTE)).toContain('- [ ] eins\n- [ ] zwei');
    expect(commitsAuf(k)).toBe(vorher);
  });

  test('AK 7: eine gescheiterte eigene Anfrage vom Board meldet im Hinweis, nicht im Fensterfuß', async ({ page }) => {
    await mutanteEinsetzen(page);
    await naechsteAbbrechen(page, 'PATCH', '/api/aufgaben/1/teilaufgaben/0');
    await page.goto(k.adresse);
    await boardBereit(page);

    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    const hinweis = page.locator(HINWEIS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toHaveText('Keine Verbindung zum Server — nichts geändert.');
    await expect(page.locator('#fenster')).toHaveCount(0);
  });

  test('AK 7 / US-4: im Aufgabenfenster bleibt der Fuß der Ort der gescheiterten eigenen Anfrage', async ({ page }) => {
    await mutanteEinsetzen(page);
    await naechsteAbbrechen(page, 'PATCH', '/api/aufgaben/1/teilaufgaben/0');
    await page.goto(k.adresse);
    await boardBereit(page);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    await page.getByRole('dialog').waitFor();

    await page.getByRole('dialog').getByRole('checkbox', { name: 'eins', exact: true }).click();
    await expect(page.locator(FUSS)).toHaveText('Keine Verbindung zum Server — nichts geändert.');
    await expect(page.locator(HINWEIS)).toHaveCount(0);
  });

  test('AK 9: ein stehender Rückgängig-Hinweis wird nicht vom Fehlschlag verdrängt', async ({ page }) => {
    await mutanteEinsetzen(page);
    await page.goto(k.adresse);
    await boardBereit(page);
    // „Neue Aufgabe" hinterlässt einen Hinweis mit „rückgängig" (ADR-0017)
    await page.getByRole('button', { name: '+ Neue Aufgabe' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('vier');
    await page.keyboard.press('Control+Enter');
    const hinweis = page.locator(HINWEIS);
    await expect(hinweis).toContainText('#3 angelegt');

    await naechsteAbbrechen(page, 'PATCH', '/api/aufgaben/1/teilaufgaben/0');
    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    await expect(hinweis).toContainText('#3 angelegt');
    await expect(hinweis.locator('[data-act="rueckgaengig"]')).toBeVisible();
    // nach Ablauf des Rückgängig-Hinweises erscheint der Fehlschlag (er verfällt nicht still)
    await expect(hinweis).toContainText('nichts geändert', { timeout: 12000 });
  });
});