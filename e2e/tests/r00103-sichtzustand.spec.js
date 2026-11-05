// R00103 Aufgabenfenster übersteht Live-Änderungen (ADR-0007: Sichtzustand übersteht das Neuzeichnen)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  bot: {name: Bot, kind: agent}
---
`;
const KOMMENTARE = Array.from({ length: 40 }, (_, i) => `2026-10-${String(1 + (i % 28)).padStart(2, '0')} 09:00 · bot · Kommentar ${i + 1}: ein Satz, der die Zeile füllt und das Fenster länger macht als den Bildschirm`).join('\n');
const DATEIEN = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': `---\nid: 1\ntitle: Abnahme prüfen\nlabels: [ux]\n---\nBeschreibung der Abnahme\n\n\`\`\`kanbanD-comments\n${KOMMENTARE}\n\`\`\`\n`,
  'aufgaben/0002-board-aufraeumen.md': '---\nid: 2\ntitle: Board aufräumen\n---\n',
};
const ALS_BOT = { headers: { 'X-KanbanD-Wer': 'bot' } };
const BREIT = { width: 1400, height: 700 };
const SCHMAL = { width: 600, height: 700 };

/** Öffnet das Fenster von #1 als st in der gegebenen Fenstergröße. */
async function fensterOeffnen(page, k, groesse) {
  await page.setViewportSize(groesse);
  await alsPerson(page, 'st');
  await page.goto(k.adresse);
  await liveBereit(page);
  await page.locator('.ka[data-id="1"] .t').click();
  await expect(page.locator('.mod-kopf .id')).toHaveText('#1');
}

/** bot kommentiert über die API. */
async function kommentiert(page, k, nummer, text) {
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/${nummer}/kommentare`, { ...ALS_BOT, data: { text } });
  expect(antwort.ok()).toBe(true);
}

const renders = page => page.evaluate(() => window.kdTest.renders());

/** Wartet, bis nach `vorher` neu gezeichnet wurde und der Kommentar an #1 im Fenster steht. */
async function neuGezeichnetMit(page, vorher, text) {
  await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
  await expect(page.locator('.km p', { hasText: text })).toHaveCount(1);
}

/** Wartet nur auf ein neues Zeichnen (Ereignis an #2: im Fenster von #1 nichts zu sehen). */
async function neuGezeichnet(page, vorher) {
  await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
}

/** Rollstand gleich bis auf einen Pixel (Rundung bei gebrochenen Höhen). */
const nahe = (ist, soll) => expect(Math.abs(ist - soll), `Rollstand ${ist} statt ${soll}`).toBeLessThanOrEqual(1);
const rollstand = (page, selektor) => page.locator(selektor).evaluate(e => e.scrollTop);
const rollen = (page, selektor, oben) => page.locator(selektor).evaluate((e, y) => { e.scrollTop = y; return e.scrollTop; }, oben);

test.describe('R00103 Leseposition', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  test('US-1: breit bleibt der Hauptbereich nach Kommentaren an #2 und #1 auf 400', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    let vorher = await renders(page);
    await kommentiert(page, k, 2, 'an zwei');
    await neuGezeichnet(page, vorher);
    nahe(await rollstand(page, '.mod-main'), 400);
    vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-main'), 400);
  });

  test('US-2: schmal bleibt der Fensterinhalt nach Kommentaren an #2 und #1 auf 400', async ({ page }) => {
    await fensterOeffnen(page, k, SCHMAL);
    expect(await rollen(page, '.mod-body', 400)).toBe(400);
    let vorher = await renders(page);
    await kommentiert(page, k, 2, 'an zwei');
    await neuGezeichnet(page, vorher);
    nahe(await rollstand(page, '.mod-body'), 400);
    vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-body'), 400);
  });

  test('zwei Ereignisse kurz hintereinander: Hauptbereich und Seitenleiste bleiben stehen', async ({ page }) => {
    await fensterOeffnen(page, k, { width: 1400, height: 420 });
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    const seite = await rollen(page, '.mod-side', 120);
    expect(seite, 'die Seitenleiste scrollt bei 420 px Höhe').toBeGreaterThan(0);
    const vorher = await renders(page);
    await Promise.all([kommentiert(page, k, 2, 'an zwei'), kommentiert(page, k, 1, 'an eins')]);
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-main'), 400);
    nahe(await rollstand(page, '.mod-side'), seite);
  });

  test('ganz unten bleibt der Hauptbereich, wo er war', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    const unten = await rollen(page, '.mod-main', 100000);
    expect(unten).toBeGreaterThan(400);
    const vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-main'), unten);
  });

  test('Leerfall: ungescrollt bleibt der Hauptbereich oben', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    const vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    expect(await rollstand(page, '.mod-main')).toBe(0);
  });

  test('US-5: Blättern zu #2 beginnt oben', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    await page.locator('.mod-kopf [data-act="blaettern"][data-arg="1"]').click();
    await expect(page.locator('.mod-kopf .id')).toHaveText('#2');
    expect(await rollstand(page, '.mod-main')).toBe(0);
  });
});
