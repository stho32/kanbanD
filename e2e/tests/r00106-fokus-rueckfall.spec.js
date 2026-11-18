// R00106 Rückfall ohne offene Ebene (PO Z. 111, Z. 113): verschwindet das fokussierte Element oder der Auslöser der
// zuletzt geschlossenen Ebene, steht der Fokus auf der geführten Karte bzw. Zeile, sonst auf BODY — nie auf einem Feld
// oder Bedienelement, das mit dem vorigen nichts zu tun hat. Ein Test je Akzeptanzkriterium, Wortlaut in den Titeln.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'kanbanD.md': '---\npeople:\n  st: {name: Stefan, kind: human}\n  pl: {name: planer, kind: agent}\n  an: {name: Anna, kind: human}\nclasses:\n  bug: {label: Fehler, color: red}\n---\n',
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
};
const ALS_PLANER = { headers: { 'X-KanbanD-Wer': 'pl' } };
const ALS_ANNA = { headers: { 'X-KanbanD-Wer': 'an' } };

let k;
let titelWechsel = 0;
test.beforeEach(async ({ page }) => {
  k = await kanbanStarten(einrichten(DATEIEN));
  titelWechsel = 0;
  await alsPerson(page, 'st');
});
test.afterEach(async () => { await k.stoppen(); });

async function oeffnen(page, adresse, sicht) {
  await page.goto(k.adresse + adresse);
  await liveBereit(page);
  await expect(page.locator(`#main[data-sicht^="${sicht}"]`)).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.kdTest.gezeichnet())).toBe(true);
}

/** Wartet auf das Neuzeichnen nach einer Änderung von außen, nicht auf die Uhr. */
async function nachEreignis(page, aenderung) {
  const vorher = await page.evaluate(() => window.kdTest.renders());
  expect((await aenderung()).ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 1000 }).toBeGreaterThan(vorher);
}

const planerAendertTitel = page => nachEreignis(page, () => {
  titelWechsel += 1;
  return page.request.patch(`${k.adresse}api/aufgaben/3`, { ...ALS_PLANER, data: { titel: titelWechsel % 2 ? 'drei neu' : 'drei' } });
});
const annaStartet = page => page.request.post(`${k.adresse}api/aufgaben/1/timer/start`, ALS_ANNA);
const annaStoppt = page => nachEreignis(page, () => page.request.post(`${k.adresse}api/aufgaben/1/timer/stop`, ALS_ANNA));

/** Was fokussiert ist, mit den Merkmalen der Gegenbeispiele. */
const aktiv = page => page.evaluate(() => {
  const element = document.activeElement;
  return {
    body: element === document.body,
    tag: element.tagName,
    rolle: element.getAttribute('role'),
    act: element.dataset.act || '',
    text: element.textContent.trim(),
    karte: element.matches('.ka[data-id]') ? element.dataset.id : null,
    beschreibung: element === document.body ? 'BODY' : element.outerHTML.slice(0, 120),
  };
});
const EINGABEFELDER = ['INPUT', 'TEXTAREA', 'SELECT'];

/** Board mit per ↓ von Karte #1 auf Karte #2 geführtem Fokus. */
async function karteZweiGefuehrt(page) {
  await oeffnen(page, '#/board/fabrik', 'board/fabrik');
  await page.locator('.ka[data-id="1"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.ka[data-id="2"]')).toBeFocused();
}

test('Gegeben Einrichten und Fokus auf „Speichern“, wenn planer den Titel von #3 ändert, dann steht der Fokus weiter auf „Speichern“', async ({ page }) => {
  await oeffnen(page, '#/einrichten', 'einrichten');
  const speichern = page.getByRole('button', { name: 'Speichern', exact: true });
  await speichern.focus();
  await planerAendertTitel(page);
  await expect(speichern).toBeFocused();
});

// Seit R00195 (AK 9, Zeichnung D0001 #klassen-hinweiszeile) bleibt die gestrichene Klasse bis zum Speichern als Zeile stehen:
// der Knopf „entfernen“ weicht „zurücknehmen“, und dorthin geht der Fokus — statt auf BODY, weiterhin nie in ein Eingabefeld.
test('Gegeben Einrichten mit der Klasse „bug“ und Fokus auf „Klasse bug entfernen“, wenn Enter gedrückt wird, dann ist die Zeile „bug“ gestrichen und der Fokus auf „Klasse bug zurücknehmen“, nie im Feld „Name st“ oder einem anderen Eingabefeld', async ({ page }) => {
  await oeffnen(page, '#/einrichten', 'einrichten');
  await page.getByRole('button', { name: 'Klasse bug entfernen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.klz[data-klasse="bug"]')).toHaveClass(/gestrichen/);
  await expect(page.getByRole('button', { name: 'Klasse bug entfernen' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Klasse bug zurücknehmen' })).toBeFocused();
  const danach = await aktiv(page);
  expect(EINGABEFELDER, danach.beschreibung).not.toContain(danach.tag);
});

test('Gegeben Personen und Fokus auf dem Personenlink „Anna“, wenn planer den Titel von #3 ändert, dann steht der Fokus weiter auf „Anna“', async ({ page }) => {
  await oeffnen(page, '#/personen', 'personen');
  const anna = page.locator('#main a.wer[data-arg="an"]');
  await anna.focus();
  await planerAendertTitel(page);
  await expect(anna).toBeFocused();
});

test('Gegeben ein laufender Timer von Anna auf #1, Personen und Fokus auf „Timer von Anna stoppen“, wenn Anna über die API stoppt, dann ist der Knopf fort und der Fokus auf BODY, nie auf einem Radio der Gruppe Personen oder in einem Eingabefeld', async ({ page }) => {
  expect((await annaStartet(page)).ok()).toBe(true);
  await oeffnen(page, '#/personen', 'personen');
  const stopp = page.getByRole('button', { name: 'Timer von Anna stoppen' });
  await stopp.focus();
  await annaStoppt(page);
  await expect(stopp).toHaveCount(0);
  const danach = await aktiv(page);
  expect(danach.rolle, danach.beschreibung).not.toBe('radio');
  expect(EINGABEFELDER, danach.beschreibung).not.toContain(danach.tag);
  expect(danach.body, danach.beschreibung).toBe(true);
});

test('Gegeben ein laufender Timer von Anna auf #1, Board mit Fokus per ↓ auf Karte #2 geführt und dann auf #t-lauf, wenn Anna stoppt, dann ist #t-lauf fort und der Fokus auf Karte #2', async ({ page }) => {
  expect((await annaStartet(page)).ok()).toBe(true);
  await karteZweiGefuehrt(page);
  await page.locator('#t-lauf').focus();
  await annaStoppt(page);
  await expect(page.locator('#t-lauf')).toHaveCount(0);
  await expect(page.locator('.ka[data-id="2"]')).toBeFocused();
});

test('Leerfall: dasselbe auf einem frisch geladenen Board ohne geführte Karte → BODY, nicht das Filterfeld und nicht das Radio „alle“', async ({ page }) => {
  expect((await annaStartet(page)).ok()).toBe(true);
  await oeffnen(page, '#/board/fabrik', 'board/fabrik');
  await page.locator('#t-lauf').focus();
  await annaStoppt(page);
  await expect(page.locator('#t-lauf')).toHaveCount(0);
  const danach = await aktiv(page);
  expect(danach.rolle, danach.beschreibung).not.toBe('radio');
  expect(EINGABEFELDER, danach.beschreibung).not.toContain(danach.tag);
  expect(danach.body, danach.beschreibung).toBe(true);
});

test('Letzte Ebene geschlossen, Auslöser fort: Personen, Link „#1“ in Annas Zeile öffnet per Enter das Fenster #1, Anna stoppt, Esc → Fenster zu, BODY, nie Radio, Personenlink oder Eingabefeld', async ({ page }) => {
  expect((await annaStartet(page)).ok()).toBe(true);
  await oeffnen(page, '#/personen', 'personen');
  const link = page.locator('#main a.id[data-act="oeffnen"][data-arg="1"]');
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#fenster')).toBeVisible();
  await annaStoppt(page);
  await expect(link).toHaveCount(0);
  await expect(page.locator('#fenster')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#fenster')).toHaveCount(0);
  const danach = await aktiv(page);
  expect(danach.rolle, danach.beschreibung).not.toBe('radio');
  expect(danach.tag, danach.beschreibung).not.toBe('A');
  expect(EINGABEFELDER, danach.beschreibung).not.toContain(danach.tag);
  expect(danach.body, danach.beschreibung).toBe(true);
});

test('Gegeben ein laufender Timer von Anna und Einrichten, #t-lauf öffnet per Enter „Läuft gerade“, Anna stoppt, Esc → kein Pop-Fenster, BODY, nicht das Feld „Name st“ und kein anderes Eingabefeld', async ({ page }) => {
  expect((await annaStartet(page)).ok()).toBe(true);
  await oeffnen(page, '#/einrichten', 'einrichten');
  await page.locator('#t-lauf').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Läuft gerade' })).toBeVisible();
  await annaStoppt(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pop')).toHaveCount(0);
  const danach = await aktiv(page);
  expect(EINGABEFELDER, danach.beschreibung).not.toContain(danach.tag);
  expect(danach.body, danach.beschreibung).toBe(true);
});

test('Gegeben ein laufender Timer von Anna und das Board mit Fokus per ↓ auf Karte #2, #t-lauf öffnet per Enter „Läuft gerade“, Anna stoppt, Esc → kein Pop-Fenster, Fokus auf Karte #2, nicht Filterfeld, nicht Radio „alle“', async ({ page }) => {
  expect((await annaStartet(page)).ok()).toBe(true);
  await karteZweiGefuehrt(page);
  await page.locator('#t-lauf').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Läuft gerade' })).toBeVisible();
  await annaStoppt(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#pop')).toHaveCount(0);
  await expect(page.locator('.ka[data-id="2"]')).toBeFocused();
});
