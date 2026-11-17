// R00155 G-3 (Karte #54 / Mitglied #96, I0142 B0758; US-6 zweites Szenario): Abnahme-Probe des code-reviewer (Muss B1) — nach
// abgelehntem Titel und einem fremden Erfolg steht kein leerer Titel ohne Meldung da. Meldung und abgelehnte Eingabe stehen
// und gehen nur gemeinsam: ein angenommener Schreibweg eines anderen Felds lässt beide stehen.
const { test, expect } = require('@playwright/test');
const { commitSteht, reiter } = require('./hilfen');
const { DATEI_1, MELDUNG_TITEL, starten, fensterOeffnen, fremdesNeuzeichnen } = require('./r00155-hilfen');
const TITELFELD = '#fenster [data-af="titel"]';
const TITEL_LESEN = '#fenster [data-act="titel-bearbeiten"]';
let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/** Der Titel steht ehrlich da — nach G-3 gilt nur ein Ausgang: Eingabefeld mit der abgelehnten (leeren) Eingabe, ungültig, mit stehender Titelmeldung. */
const titelStehtEhrlich = page => page.evaluate(meldung => {
  const feld = document.querySelector('#fenster [data-af="titel"]');
  if (!feld) return false;
  const m = document.querySelector('#fenster-meldung');
  return feld.value === '' && feld.getAttribute('aria-invalid') === 'true' && feld.getAttribute('aria-describedby') === 'fenster-meldung' && Boolean(m) && m.textContent === meldung;
}, MELDUNG_TITEL);

async function titelAbgelehnt(page) {
  k = await starten(page);
  const fenster = await fensterOeffnen(page, 1);
  await page.locator(TITEL_LESEN).click();
  await page.locator(TITELFELD).fill('');
  await page.keyboard.press('Enter');
  await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_TITEL);
  expect(await titelStehtEhrlich(page), 'Selbstprobe: Lage nach 96-1 ist ehrlich').toBe(true);
  return fenster;
}

/** Der Fuß zeigt „gespeichert hh:mm:ss“ und die Meldung zum Titel nebeneinander. */
async function fussZeigtBeides(fenster) {
  await expect(fenster.locator('.mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
  await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_TITEL);
}

test('G-3/US-6 (a) Lage nach 96-1, danach Kommentar „Notiz“ + Enter gespeichert, danach ändert bot #2 → das Titelfeld ist ungültig und verweist auf die stehende Meldung „Die Aufgabe braucht einen Titel“', async ({ page }) => {
  const fenster = await titelAbgelehnt(page);
  const commits = Number(k.git('rev-list', '--count', 'HEAD'));
  const km = fenster.getByLabel('Neuer Kommentar');
  await km.click();
  await km.fill('Notiz');
  await page.keyboard.press('Enter');
  await expect.poll(() => k.lies(DATEI_1)).toContain('Notiz');
  await fussZeigtBeides(fenster);
  expect(await titelStehtEhrlich(page), 'nach dem gespeicherten Kommentar').toBe(true);
  await fremdesNeuzeichnen(page, k);
  expect(await titelStehtEhrlich(page), 'nach fremdem Neuzeichnen').toBe(true);
  await expect(page.locator(TITELFELD)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(TITELFELD)).toHaveAttribute('aria-describedby', 'fenster-meldung');
  await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_TITEL);
  await fussZeigtBeides(fenster);
  expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
  // der Kommentar ist ein Commit von st, der Titel von #2 einer von bot
  await commitSteht(k, commits + 2);
  expect(Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 2);
});

test('G-3/US-6 (b) Lage nach 96-1, danach in Details Labels „ui, daten, neu“ + Tab gespeichert und zu „Inhalt“ gewechselt → das Titelfeld ist ungültig und verweist auf die stehende Meldung', async ({ page }) => {
  const fenster = await titelAbgelehnt(page);
  const commits = Number(k.git('rev-list', '--count', 'HEAD'));
  await reiter(page, 'Details');
  await fenster.getByLabel('Labels').fill('ui, daten, neu');
  await page.keyboard.press('Tab');
  await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]');
  await fussZeigtBeides(fenster);
  await reiter(page, 'Inhalt');
  expect(await titelStehtEhrlich(page), 'zurück in Inhalt').toBe(true);
  await expect(page.locator(TITELFELD)).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator(TITELFELD)).toHaveAttribute('aria-describedby', 'fenster-meldung');
  await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_TITEL);
  await fussZeigtBeides(fenster);
  expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
  await commitSteht(k, commits + 1);
  expect(Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
});
