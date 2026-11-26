// R00257 AK 5 (I0247, Karte #241): Die Oberfläche zeigt die 400 der Sammelwege dort, wo sie heute jeden Fehler
// dieses Weges zeigt — bei „Spalte archivieren“ in der Kopfzeile (#stat), ohne Aufteilen und ohne eigenen Zähler
// (PO Z. 671, ADR-0044 E2). 5001 Karten auf einem Board sind im Gate zu teuer, deshalb antwortet die Probe per
// `page.route`; eine Positivkontrolle ohne die Route beweist, dass derselbe Klick wirklich archiviert.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, mutanteEinsetzen } = require('./hilfen');

const WORTLAUT = 'Zu viele Einträge in einer Sammelanfrage: 5001, höchstens 5000 sind erlaubt. Bitte in Teilen senden.';

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
};

/** Der eine Weg, den „Spalte archivieren“ nimmt; zählt die Anfragen der Seite. */
async function grenzeAntworten(page) {
  const gesehen = [];
  await page.route('**/api/aufgaben/archivieren', route => {
    gesehen.push(route.request().method());
    return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ fehler: WORTLAUT }) });
  });
  return gesehen;
}

/** Öffnet das Spaltenmenü von „Zu erledigen“ und wählt „Alle 1 Karte archivieren“. */
async function spalteArchivieren(page) {
  await page.locator('.bahn[data-col="Zu erledigen"] .bahn-kopf').click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Alle 1 Karte archivieren' }).click();
}

test.describe('R00257 AK 5', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); await mutanteEinsetzen(page); });
  test.afterEach(() => k.stoppen());

  test('„Spalte archivieren“ zeigt die 400, nichts ist archiviert', async ({ page }) => {
    const gesehen = await grenzeAntworten(page);
    await page.goto(k.adresse);
    await bereit(page, '.bahn[data-col="Zu erledigen"] .ka');
    const vorher = k.git('log', '-1', '--format=%s');
    await spalteArchivieren(page);
    // der Wortlaut steht sichtbar auf dem Board, dort wo jeder Fehler dieses Weges steht
    await expect(page.locator('#stat .fehl')).toHaveText(WORTLAUT);
    // keine Karte ist archiviert, kein Commit, kein Hinweis „… archiviert“ mit Rückgängig
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka')).toHaveCount(1);
    expect(k.lies('aufgaben/0001-eins.md')).not.toContain('archived:');
    expect(k.git('log', '-1', '--format=%s')).toBe(vorher);
    await expect(page.getByRole('status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'rückgängig' })).toHaveCount(0);
    // die Oberfläche sendet genau eine Anfrage und teilt nicht auf
    expect(gesehen).toEqual(['POST']);
  });

  test('Positivkontrolle: ohne die Route archiviert derselbe Klick', async ({ page }) => {
    await page.goto(k.adresse);
    await bereit(page, '.bahn[data-col="Zu erledigen"] .ka');
    await spalteArchivieren(page);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka')).toHaveCount(0);
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 archiviert');
    await expect(page.getByRole('status')).toContainText('archiviert');
    await expect(page.getByRole('status').getByRole('button', { name: 'rückgängig' })).toHaveCount(1);
    await expect(page.locator('#stat .fehl')).toHaveCount(0);
  });
});
