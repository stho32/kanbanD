// R00155 Mitglied #54 (Karte #54, I0142 B0720–B0724, B0739; ADR-0010 N9): Esc tut je Druck genau eines, das Innerste zuerst —
// hat das fokussierte Textfeld einen Entwurf oder einen Bearbeitungsmodus, verwirft Esc ihn ohne Schreibweg und das Fenster
// bleibt offen; sonst schließt Esc. Enter und das Verlassen speichern weiter.
const { test, expect } = require('@playwright/test');
const { reiter } = require('./hilfen');
const { DATEI_1, MELDUNG_X1, starten, fensterOeffnen, standMerken, nichtsGeschrieben, fremdesNeuzeichnen, verweise, ansagen } = require('./r00155-hilfen');

const TITELFELD = '#fenster [data-af="titel"]';
const TITEL_LESEN = '#fenster [data-act="titel-bearbeiten"]';
const KEINES = { ungueltig: [], verweist: [], meldungen: 0 };

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/** Aufgabenfenster von #1 in der genannten Ansicht. */
async function fensterIn(page, ansicht) {
  k = await starten(page);
  const fenster = await fensterOeffnen(page, 1);
  if (ansicht !== 'Inhalt') await reiter(page, ansicht);
  return fenster;
}

/** Titel von #1 im Bearbeiten, Fokus im Feld. */
async function titelBearbeiten(page) {
  const fenster = await fensterIn(page, 'Inhalt');
  await page.locator(TITEL_LESEN).click();
  await expect(page.locator(TITELFELD)).toBeFocused();
  return fenster;
}

/** `X1` in „Neue Herkunft“ mit Enter abgelehnt: Meldung steht, das Feld ist ungültig (R00111 AK 1). */
async function herkunftAbgelehnt(page) {
  const fenster = await fensterIn(page, 'Details');
  const herkunft = fenster.getByLabel('Neue Herkunft');
  await herkunft.fill('X1');
  await page.keyboard.press('Enter');
  await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
  await expect(herkunft).toHaveAttribute('aria-invalid', 'true');
  return { fenster, herkunft };
}

async function fensterIstZu(page) {
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
}

test.describe('R00155 #54: Esc im Titelfeld', () => {
  test('54-1/54-2/US-1: Titel ändern, Esc → Datei und git unverändert, alter Titel sichtbar, Fokus auf „Titel bearbeiten“, Fenster offen, stumm; das zweite Esc schließt und gibt den Fokus an Karte #1', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0721');
    const fenster = await titelBearbeiten(page);
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    const vorher = await standMerken(page, k);
    const angesagt = await ansagen(page);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await expect(page.locator(TITELFELD)).toHaveCount(0);
    await nichtsGeschrieben(page, k, vorher, '54-1');
    expect(await ansagen(page), 'das Verwerfen bleibt stumm: kein Live-Bereich bekommt einen neuen Text').toEqual(angesagt);
    await page.keyboard.press('Escape');
    await fensterIstZu(page);
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54-2');
  });

  test('54-3: Titel im Bearbeiten und unverändert, Esc → Bearbeitungsmodus beendet, Fenster offen, Fokus auf „Titel bearbeiten“; ein zweites Esc schließt', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0721');
    const fenster = await titelBearbeiten(page);
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(page.locator(TITELFELD)).toHaveCount(0);
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await page.keyboard.press('Escape');
    await fensterIstZu(page);
    await nichtsGeschrieben(page, k, vorher, '54-3');
  });

  test('54-10/US-4: Gegenprobe — „Abnahme geprüft“ und Enter speichert den Titel, genau ein neuer Commit von st', async ({ page }) => {
    await titelBearbeiten(page);
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    await page.keyboard.press('Enter');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme geprüft');
    await expect.poll(() => k.lies(DATEI_1)).toContain('title: Abnahme geprüft\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
  });
});

test.describe('R00155 #54: Esc in Labels', () => {
  test('54-4/US-2: ui, daten, neu tippen, Esc → das Feld zeigt ui, daten, Fokus im Feld, Fenster offen, nichts geschrieben, stumm; ein weiteres Esc im unveränderten Feld schließt', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0722');
    const fenster = await fensterIn(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.fill('ui, daten, neu');
    const vorher = await standMerken(page, k);
    const angesagt = await ansagen(page);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(labels).toHaveValue('ui, daten');
    await expect(labels).toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54-4');
    expect(await ansagen(page), 'stumm').toEqual(angesagt);
    await page.keyboard.press('Escape');
    await fensterIstZu(page);
    await nichtsGeschrieben(page, k, vorher, '54-4, zweites Esc');
  });

  test('54-5: Labels nach einem Live-Ereignis — getippt, bot ändert #2 (das Fenster zeichnet neu), Esc und Tab → nichts geschrieben, die Datei trägt weiter ui, daten', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0722');
    const fenster = await fensterIn(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.fill('ui, daten, neu');
    await fremdesNeuzeichnen(page, k);
    await expect(labels, 'der getippte Wert übersteht das Neuzeichnen').toHaveValue('ui, daten, neu');
    await expect(labels).toBeFocused();
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(labels).toHaveValue('ui, daten');
    await page.keyboard.press('Tab');
    await expect(labels).not.toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-5');
    expect(k.lies(DATEI_1)).toContain('labels: [ui, daten]\n');
  });

  test('54-10: Gegenprobe — ui, daten, neu in Labels und Tab speichert, ein Commit', async ({ page }) => {
    const fenster = await fensterIn(page, 'Details');
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await fenster.getByLabel('Labels').fill('ui, daten, neu');
    await page.keyboard.press('Tab');
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
  });
});

test.describe('R00155 #54: Esc in den Feldern, die erst mit Enter schreiben', () => {
  for (const [ansicht, name, getippt] of [['Details', 'Neue Herkunft', 'I00'], ['Inhalt', 'Neue Teilaufgabe', 'Entwurf'], ['Zeiten', 'Zeit nachtragen', '0:4']]) {
    test(`54-6/US-3: „${name}“ — ${getippt} tippen, Esc → Feld leer, Fokus im Feld, Fenster offen, nichts geschrieben; auch nach dem Neuzeichnen leer; ein weiteres Esc im leeren Feld schließt`, async ({ page }) => {
      test.fail(true, 'erwartet rot bis B0722');
      const fenster = await fensterIn(page, ansicht);
      const feld = fenster.getByLabel(name, { exact: true });
      await feld.click();
      await page.keyboard.type(getippt);
      const vorher = await standMerken(page, k);
      const angesagt = await ansagen(page);
      await page.keyboard.press('Escape');
      await expect(fenster).toBeVisible();
      await expect(feld).toHaveValue('');
      await expect(feld).toBeFocused();
      await nichtsGeschrieben(page, k, vorher, '54-6');
      expect(await ansagen(page), 'stumm').toEqual(angesagt);
      await fremdesNeuzeichnen(page, k);
      await expect(feld).toHaveValue('');
      await expect(feld).toBeFocused();
      await page.keyboard.press('Escape');
      await fensterIstZu(page);
      expect(k.schreibend.slice(vorher.anfragen), '54-6, zweites Esc: keine schreibende Anfrage').toEqual([]);
    });
  }

  test('54-7: abgelehnte Herkunft X1, Esc → Feld leer, Meldung fort, weder aria-invalid noch aria-describedby, Fokus bleibt, Fenster offen; nach dem Neuzeichnen steht X1 nicht wieder da', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0722');
    const { fenster, herkunft } = await herkunftAbgelehnt(page);
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(herkunft).toHaveValue('');
    await expect(herkunft).toBeFocused();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await nichtsGeschrieben(page, k, vorher, '54-7');
    await fremdesNeuzeichnen(page, k);
    await expect(herkunft).toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
  });

  test('54-8: die Meldung eines anderen Felds bleibt — X1 abgelehnt, in Labels neu tippen, Esc → Labels zeigt ui, daten, die Meldung zu X1 samt ungültigem Herkunftsfeld steht weiter', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0722');
    const { fenster, herkunft } = await herkunftAbgelehnt(page);
    const labels = fenster.getByLabel('Labels');
    await labels.fill('neu');
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(labels).toHaveValue('ui, daten');
    await expect(labels).toBeFocused();
    await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
    await expect(herkunft).toHaveValue('X1');
    expect(await verweise(fenster)).toEqual({ ungueltig: ['#herkunft-neu'], verweist: ['#herkunft-neu'], meldungen: 1 });
    await nichtsGeschrieben(page, k, vorher, '54-8');
  });
});

test.describe('R00155 #54: Felder ohne Entwurf', () => {
  for (const name of ['Spalte', 'Klasse', 'Fälligkeit']) {
    test(`54-9/US-4: Fokus im Feld ${name}, Esc → das Fenster ist beim ersten Esc zu, nichts geschrieben`, async ({ page }) => {
      const fenster = await fensterIn(page, 'Details');
      const feld = fenster.getByLabel(name, { exact: true });
      await feld.focus();
      await expect(feld).toBeFocused();
      const vorher = await standMerken(page, k);
      await page.keyboard.press('Escape');
      await fensterIstZu(page);
      await nichtsGeschrieben(page, k, vorher, '54-9');
    });
  }
});
