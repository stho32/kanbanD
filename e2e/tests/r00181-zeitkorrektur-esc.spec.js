// R00181 (Karte #190, I0171 B0883–B0884; ADR-0010 N9 Ziffer 2 und 4): die Zeitkorrektur ist ein Bearbeitungsmodus — das erste
// Esc beendet nur sie, ohne Schreibweg: Fenster offen, die Zeile zeigt den Stand der Datei, Fokus auf dem Stift der Zeile.
// Erst das zweite Esc schließt das Fenster. Enter und ✓ speichern weiter.
const { test, expect } = require('@playwright/test');
const { reiter } = require('./hilfen');
const { GRUNDBESTAND, DATEI_1, DATEI_2, starten, fensterOeffnen, standMerken, nichtsGeschrieben } = require('./r00155-hilfen');

/** Beginn der laufenden Zeit von #2: Ortszeit `minuten` vor jetzt — die Datei kennt nur Minuten. */
const vor = minuten => {
  const d = new Date(Date.now() - minuten * 6e4), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const LAEUFT_SEIT = vor(5);
const zeiten = (...zeilen) => `\`\`\`kanbanD-time\n${zeilen.join('\n')}\n\`\`\`\n`;
/** Ausgangslage der Anforderung: #1 mit einer beendeten Zeit 09:00–09:30, #2 mit einer laufenden Zeit, beide von st. */
const BESTAND = {
  ...GRUNDBESTAND,
  [DATEI_1]: GRUNDBESTAND[DATEI_1] + zeiten('2026-11-16 09:00 · 2026-11-16 09:30 · st'),
  [DATEI_2]: GRUNDBESTAND[DATEI_2] + zeiten(`${LAEUFT_SEIT} · ... · st`),
};
const STIFT = '#fenster .zt [data-act="zeit-edit"]';
const ZEILE = '#fenster .zt tr[data-kennung]';
const BEGINN = '#z-beginn';

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/** Aufgabenfenster der Aufgabe in der Ansicht „Zeiten“, die Korrektur ihrer einen Zeit über den Stift geöffnet, Fokus in „Beginn“. */
async function korrekturOeffnen(page, nummer) {
  k = await starten(page, BESTAND);
  const fenster = await fensterOeffnen(page, nummer);
  await reiter(page, 'Zeiten');
  await page.locator(STIFT).click();
  await expect(page.locator(BEGINN)).toBeFocused();
  return fenster;
}

/** Das erste Esc: Korrektur beendet, Fenster offen, die Zeile zeigt `spanne`, Fokus auf dem Stift der Zeile, nichts geschrieben. */
async function escBeendetNurDieKorrektur(page, fenster, vorher, spanne, wo) {
  await page.keyboard.press('Escape');
  await expect(fenster, `${wo}: das Fenster bleibt offen`).toBeVisible();
  await expect(page.locator(BEGINN), `${wo}: die Korrektur ist beendet`).toHaveCount(0);
  await expect(page.locator(ZEILE), `${wo}: die Zeile zeigt den Stand der Datei`).toContainText(spanne);
  await expect(page.locator(STIFT), `${wo}: Fokus auf dem Stift der Zeile`).toBeFocused();
  await nichtsGeschrieben(page, k, vorher, wo);
}

/** Das zweite Esc schließt das Fenster — auch dabei ist nichts geschrieben. */
async function zweitesEscSchliesst(page, vorher, wo) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#over [role="dialog"]'), `${wo}: das zweite Esc schließt das Fenster`).toHaveCount(0);
  await nichtsGeschrieben(page, k, vorher, `${wo}, zweites Esc`);
}

test.describe('R00181: Esc beendet nur die Zeitkorrektur', () => {
  test('AK 1/US-1 (Abnahme-Probe #190): beendete Zeit, „Beginn“ geändert, Esc → Fenster offen, Zeile 09:00–09:30, Fokus auf dem Stift, nichts geschrieben; das zweite Esc schließt', async ({ page }) => {
    const fenster = await korrekturOeffnen(page, 1);
    await expect(page.locator('#z-ende')).toHaveValue('2026-11-16 09:30');
    await page.locator(BEGINN).fill('2026-11-16 08:00');
    const vorher = await standMerken(page, k);
    await escBeendetNurDieKorrektur(page, fenster, vorher, '09:00–09:30', 'AK 1');
    // die verworfene Eingabe ist fort: die nächste Korrektur beginnt wieder beim Stand der Datei
    await page.keyboard.press('Enter');
    await expect(page.locator(BEGINN)).toHaveValue('2026-11-16 09:00');
    await escBeendetNurDieKorrektur(page, fenster, vorher, '09:00–09:30', 'AK 1, erneut geöffnet');
    await zweitesEscSchliesst(page, vorher, 'AK 1');
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
  });

  test('AK 1, Fokus in „Ende“: auch dort beendet das erste Esc nur die Korrektur', async ({ page }) => {
    const fenster = await korrekturOeffnen(page, 1);
    await page.locator('#z-ende').fill('2026-11-16 10:15');
    const vorher = await standMerken(page, k);
    await escBeendetNurDieKorrektur(page, fenster, vorher, '09:00–09:30', 'Esc in „Ende“');
    await zweitesEscSchliesst(page, vorher, 'Esc in „Ende“');
  });
});
