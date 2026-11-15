// R00155 Mitglieder #96 und #93 (Karte #54, I0142 B0725–B0728; ADR-0015 N2): eine abgelehnte Eingabe bleibt im Feld stehen,
// das Feld ist ungültig und verweist auf die Fenstermeldung — Titel (#96, US-6) und „Zeit nachtragen“ (#93, US-7).
// Je Mitglied ein eigener Block, damit eines ohne das andere herausgeht. 96-5 und 93-5 (Esc) gelten, solange #54 im Paket ist.
const { test, expect } = require('@playwright/test');
const { reiter } = require('./hilfen');
const { DATEI_1, MELDUNG_TITEL, MELDUNG_DAUER, MELDUNG_X1, starten, fensterOeffnen, standMerken, nichtsGeschrieben, fremdesNeuzeichnen, verweise } = require('./r00155-hilfen');

const TITELFELD = '#fenster [data-af="titel"]';
const TITEL_LESEN = '#fenster [data-act="titel-bearbeiten"]';
const NUR = feld => ({ ungueltig: [feld], verweist: [feld], meldungen: 1 });
const KEINES = { ungueltig: [], verweist: [], meldungen: 0 };

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

test.describe('R00155 #96: der abgelehnte Titel bleibt im Feld', () => {
  /** Titel von #1 im Bearbeiten, Feld geleert; `verlassen` drückt Tab statt Enter. Liefert das Fenster in der Lage nach 96-1. */
  async function titelAbgelehnt(page, verlassen = 'Enter') {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await page.locator(TITEL_LESEN).click();
    const feld = page.locator(TITELFELD);
    await expect(feld).toBeFocused();
    await feld.fill('');
    await page.keyboard.press(verlassen);
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_TITEL);
    return fenster;
  }

  for (const [kriterium, taste] of [['96-1/US-6: Titel leeren und speichern (Enter)', 'Enter'], ['96-3: Titel leeren und mit Tab verlassen', 'Tab']]) {
    test(`${kriterium} → das Titelfeld bleibt Eingabefeld, leer, mit Fokus, aria-invalid, describedby verweist auf die vorhandene Meldung; die Datei behält den Titel`, async ({ page }) => {
      const fenster = await titelAbgelehnt(page, taste);
      const feld = page.locator(TITELFELD);
      await expect(feld, 'weiter Eingabefeld').toHaveCount(1);
      await expect(page.locator(TITEL_LESEN), 'kein Lesediv').toHaveCount(0);
      await expect(feld).toHaveValue('');
      await expect(feld).toBeFocused();
      await expect(feld).toHaveAttribute('aria-invalid', 'true');
      await expect(feld).toHaveAttribute('aria-describedby', 'fenster-meldung');
      await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_TITEL);
      // 96-4: nur das eine Feld
      expect(await verweise(fenster)).toEqual(NUR('[data-af=titel]'));
      expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
      // der Zustand hält: auch nach der Frist des Verlassens (50 ms) und einem fremden Neuzeichnen steht das Feld da
      await fremdesNeuzeichnen(page, k);
      await expect(feld).toHaveValue('');
      await expect(feld).toHaveAttribute('aria-invalid', 'true');
      await expect(feld).toBeFocused();
    });
  }

  test('96-2/US-6: Berichtigung — „Abnahme geprüft“ und Enter speichert (ein Commit), Meldung fort, kein Feld mehr ungültig', async ({ page }) => {
    const fenster = await titelAbgelehnt(page);
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.keyboard.type('Abnahme geprüft');
    await page.keyboard.press('Enter');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme geprüft');
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await expect.poll(() => k.lies(DATEI_1)).toContain('title: Abnahme geprüft\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
  });

  test('96-5 (#54): Esc nach der Ablehnung — Titel liest „Abnahme prüfen“, Meldung fort, Fokus auf „Titel bearbeiten“, Fenster offen', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0721/B0722 (#54)');
    const fenster = await titelAbgelehnt(page);
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await nichtsGeschrieben(page, k, vorher, '96-5');
  });

  for (const ziel of [1, 2]) {
    test(`96-6: der Entwurf gehört zur offenen Aufgabe — Fenster schließen, #${ziel} öffnen: Titel im Lesezustand, keine Meldung, kein ungültiges Feld`, async ({ page }) => {
      const fenster = await titelAbgelehnt(page);
      await fenster.getByRole('button', { name: 'Schließen', exact: true }).click();
      await expect(fenster).toHaveCount(0);
      const neu = await fensterOeffnen(page, ziel);
      await expect(page.locator(TITEL_LESEN)).toHaveText(ziel === 1 ? 'Abnahme prüfen' : 'Zweite Aufgabe');
      await expect(page.locator(TITELFELD)).toHaveCount(0);
      await expect(neu.locator('[role=alert]')).toHaveCount(0);
      expect(await verweise(neu)).toEqual(KEINES);
    });
  }
});

test.describe('R00155 #93: „Zeit nachtragen“ behält die abgelehnte Eingabe', () => {
  /** Aufgabenfenster von #1 in der Ansicht „Zeiten“, `abc` + Enter abgelehnt (Lage nach 93-1). */
  async function dauerAbgelehnt(page) {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Zeiten');
    const feld = fenster.getByLabel('Zeit nachtragen');
    await feld.fill('abc');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
    return { fenster, feld };
  }
  const feldIstUngueltig = async (fenster, feld) => {
    await expect(feld).toHaveValue('abc');
    await expect(feld).toHaveAttribute('aria-invalid', 'true');
    await expect(feld).toHaveAttribute('aria-describedby', 'fenster-meldung');
    await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster)).toEqual(NUR('#zeit-neu'));
  };

  test('93-1/US-7: abc + Enter → Meldung als alert, das Feld zeigt abc, hat den Fokus, ist ungültig und verweist auf die Meldung; keine Zeit eingetragen', async ({ page }) => {
    const { fenster, feld } = await dauerAbgelehnt(page);
    await feldIstUngueltig(fenster, feld);
    await expect(feld).toBeFocused();
    await expect(fenster.locator('.zt tr')).toHaveCount(0);
    expect(k.lies(DATEI_1)).not.toContain('kanbanD-time');
    expect(k.git('rev-list', '--count', 'HEAD')).toBe('1');
  });

  test('93-2/US-7: Berichtigung auf 0:45 + Enter → Zeit eingetragen (ein Commit), Feld leer, Meldung fort, kein Feld ungültig', async ({ page }) => {
    const { fenster, feld } = await dauerAbgelehnt(page);
    await feld.fill('0:45');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.zt tr')).toHaveCount(1);
    await expect(fenster.locator('.zt tr')).toContainText('0:45');
    await expect(feld).toHaveValue('');
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await expect.poll(() => k.git('rev-list', '--count', 'HEAD')).toBe('2');
    expect(k.lies(DATEI_1)).toContain('kanbanD-time');
  });

  test('93-3: die abgelehnte Eingabe übersteht das Neuzeichnen — bot ändert #2, das Feld zeigt weiter abc und ist ungültig, die Meldung steht', async ({ page }) => {
    const { fenster, feld } = await dauerAbgelehnt(page);
    await fremdesNeuzeichnen(page, k);
    await feldIstUngueltig(fenster, feld);
  });

  test('93-4: ein ungültiges Feld — nach X1 in „Neue Herkunft“ und abc in „Zeit nachtragen“ nennt die eine Meldung die Dauer, „Neue Herkunft“ ist nicht mehr ungültig', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.fill('X1');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
    await expect(herkunft).toHaveAttribute('aria-invalid', 'true');
    await reiter(page, 'Zeiten');
    const zeit = fenster.getByLabel('Zeit nachtragen');
    await zeit.fill('abc');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('[role=alert]')).toHaveCount(1);
    await expect(fenster.locator('[role=alert]')).toHaveText(MELDUNG_DAUER);
    await feldIstUngueltig(fenster, zeit);
    await reiter(page, 'Details');
    await expect(herkunft).toBeVisible();
    await expect(fenster.locator('[role=alert]')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster), '„Neue Herkunft“ trägt weder aria-invalid noch aria-describedby').toEqual({ ungueltig: [], verweist: [], meldungen: 1 });
  });

  test('93-5 (#54): Esc nach der Ablehnung — Feld leer, Meldung fort, kein aria-invalid, Fokus bleibt, Fenster offen; nach dem Neuzeichnen steht abc nicht wieder da', async ({ page }) => {
    test.fail(true, 'erwartet rot bis B0722 (#54)');
    const { fenster, feld } = await dauerAbgelehnt(page);
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(feld).toHaveValue('');
    await expect(feld).toBeFocused();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await fremdesNeuzeichnen(page, k);
    await expect(feld).toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
    await nichtsGeschrieben(page, k, vorher, '93-5');
  });

  test('93-6: der Entwurf gehört zur offenen Aufgabe — Fenster schließen, #2 öffnen: „Zeit nachtragen“ leer, keine Meldung, kein ungültiges Feld', async ({ page }) => {
    const { fenster } = await dauerAbgelehnt(page);
    await fenster.getByRole('button', { name: 'Schließen', exact: true }).click();
    await expect(fenster).toHaveCount(0);
    const neu = await fensterOeffnen(page, 2);
    await expect(neu.getByLabel('Zeit nachtragen')).toHaveValue('');
    await expect(neu.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(neu)).toEqual(KEINES);
  });
});

test.describe('R00155 #96 und #93 gemeinsam: wer den einen Entwurf hält (G-2)', () => {
  const HERKUNFT_FREI = { ungueltig: [], verweist: [], meldungen: 1 };

  test('G-2 (b)/US-7: Getipptes verdrängt keine abgelehnte Eingabe — nach abgelehntem abc in „Neue Herkunft“ I00 tippen, zu „Zeiten“ wechseln: abc steht weiter, ungültig, die Meldung zur Dauer steht', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Zeiten');
    const zeit = fenster.getByLabel('Zeit nachtragen');
    await zeit.fill('abc');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
    await reiter(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.click();
    await page.keyboard.type('I00');
    expect(await verweise(fenster), '„Neue Herkunft“ trägt weder aria-invalid noch aria-describedby').toEqual(HERKUNFT_FREI);
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('abc');
    await expect(zeit).toHaveAttribute('aria-invalid', 'true');
    await expect(zeit).toHaveAttribute('aria-describedby', 'fenster-meldung');
    await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster)).toEqual(NUR('#zeit-neu'));
    // In Kauf genommen (R00155 Notizen): solange die abgelehnte Dauer dasteht, hält das Fenster das in „Neue Herkunft“ Getippte nicht
    await reiter(page, 'Details');
    await expect(herkunft).toHaveValue('');
    expect(await verweise(fenster)).toEqual(HERKUNFT_FREI);
  });

  test('G-2 (c): Gegenprobe — ohne abgelehnte Eingabe eines anderen Felds übersteht in „Neue Herkunft“ Getipptes den Wechsel der Ansicht', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.click();
    await page.keyboard.type('I00');
    await reiter(page, 'Inhalt');
    await expect(herkunft).toHaveCount(0);
    await reiter(page, 'Details');
    await expect(herkunft).toHaveValue('I00');
    expect(await verweise(fenster)).toEqual(KEINES);
  });

  test('G-2 (c): Gegenprobe — nach abgelehntem X1 bleibt die eigene Berichtigung über ein Neuzeichnen stehen', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.fill('X1');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
    await herkunft.fill('I0001');
    await fremdesNeuzeichnen(page, k);
    await expect(herkunft).toHaveValue('I0001');
    await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
  });
});
