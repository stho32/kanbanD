// R00155 Mitglieder #96 und #93 (Karte #54, I0142 B0725–B0728; ADR-0015 N2): eine abgelehnte Eingabe bleibt im Feld stehen,
// das Feld ist ungültig und verweist auf die Fenstermeldung — Titel (#96, US-6) und „Zeit nachtragen“ (#93, US-7).
// Je Mitglied ein eigener Block, damit eines ohne das andere herausgeht. 96-5 und 93-5 (Esc) gelten, solange #54 im Paket ist.
const { test, expect } = require('@playwright/test');
const { reiter } = require('./hilfen');
const { DATEI_1, MELDUNG_TITEL, MELDUNG_DAUER, MELDUNG_X1, starten, fensterOeffnen, standMerken, nichtsGeschrieben, fremdesNeuzeichnen, verweise, ansichtNeuZeichnen } = require('./r00155-hilfen');

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
    const { fenster, feld } = await dauerAbgelehnt(page);
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(feld).toHaveValue('');
    await expect(feld).toBeFocused();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    // gemessen vor dem fremden Neuzeichnen: bot schreibt dabei selbst in die Datei von #2
    await nichtsGeschrieben(page, k, vorher, '93-5');
    await fremdesNeuzeichnen(page, k);
    await expect(feld).toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
    await ansichtNeuZeichnen(page, 'Zeiten');
    await expect(feld, 'auch ohne Fokus neu gezeichnet steht abc nicht wieder da').toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
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

// G-3 (Muss B1 des code-reviewer, product-owner 2026-11-15): Meldung und abgelehnte Eingabe stehen und gehen nur gemeinsam.
// Die Probe des code-reviewer (Titel) liegt in r00155-titel-nach-fremdem-erfolg.spec.js; hier die vier weiteren Proben.
test.describe('R00155 #96 und #93 gemeinsam: Meldung und abgelehnte Eingabe gehören zusammen (G-3)', () => {
  const MELDUNG_ENDE = 'Das Ende liegt vor dem Beginn';

  /** Aufgabenfenster von #1 in „Zeiten“, `abc` in „Zeit nachtragen“ mit Enter abgelehnt (Lage nach 93-1). */
  async function dauerAbgelehnt(page) {
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Zeiten');
    const zeit = fenster.getByLabel('Zeit nachtragen');
    await zeit.fill('abc');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
    await expect(zeit).toHaveAttribute('aria-invalid', 'true');
    return { fenster, zeit };
  }

  test('G-3 Variante Dauer: Lage nach 93-1, danach Kommentar „Notiz“ + Enter gespeichert → in „Zeiten“ steht abc, ungültig, die Meldung zur Dauer steht neben „gespeichert“', async ({ page }) => {
    k = await starten(page);
    const { fenster, zeit } = await dauerAbgelehnt(page);
    await reiter(page, 'Inhalt');
    const kommentar = fenster.getByLabel('Neuer Kommentar');
    await kommentar.fill('Notiz');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies(DATEI_1)).toContain('Notiz');
    await expect(fenster.locator('.mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('abc');
    await expect(zeit).toHaveAttribute('aria-invalid', 'true');
    await expect(zeit).toHaveAttribute('aria-describedby', 'fenster-meldung');
    await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster)).toEqual(NUR('#zeit-neu'));
  });

  test('G-3 Variante Herkunft: X1 in „Neue Herkunft“ abgelehnt, danach Labels + Tab gespeichert → X1 steht, ungültig, die Meldung steht neben „gespeichert“', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.fill('X1');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
    await fenster.getByLabel('Labels').fill('ui, daten, neu');
    await page.keyboard.press('Tab');
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
    await expect(fenster.locator('.mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
    await expect(fenster.locator('[role=alert]')).toContainText(MELDUNG_X1);
    await expect(herkunft).toHaveValue('X1');
    await expect(herkunft).toHaveAttribute('aria-invalid', 'true');
    await expect(herkunft).toHaveAttribute('aria-describedby', 'fenster-meldung');
    expect(await verweise(fenster)).toEqual(NUR('#herkunft-neu'));
    // auch neu gezeichnet ohne Fokus im Feld
    await ansichtNeuZeichnen(page, 'Details');
    await expect(herkunft).toHaveValue('X1');
    expect(await verweise(fenster)).toEqual(NUR('#herkunft-neu'));
  });

  test('G-3 Variante Verdrängung, Feld: Titel abgelehnt, danach abc in „Zeit nachtragen“ abgelehnt, zurück zu „Inhalt“ → Titel im Lesezustand „Abnahme prüfen“, die Meldung nennt die Dauer, nur „Zeit nachtragen“ ist ungültig', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await page.locator(TITEL_LESEN).click();
    await page.locator(TITELFELD).fill('');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_TITEL);
    await reiter(page, 'Zeiten');
    const zeit = fenster.getByLabel('Zeit nachtragen');
    await zeit.fill('abc');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster)).toEqual(NUR('#zeit-neu'));
    await reiter(page, 'Inhalt');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITELFELD), 'kein Titelfeld ohne abgelehnte Eingabe').toHaveCount(0);
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster), 'in „Inhalt“ ist kein Feld ungültig').toEqual({ ungueltig: [], verweist: [], meldungen: 1 });
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('abc');
    expect(await verweise(fenster)).toEqual(NUR('#zeit-neu'));
    expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
  });

  test('G-3 Variante Verdrängung, Meldung ohne Feld: Lage nach 93-1, danach lehnt der Server eine Zeitkorrektur ab (Ende vor Beginn) → „Zeit nachtragen“ leer und nicht ungültig, die neue Meldung steht', async ({ page }) => {
    k = await starten(page);
    const angelegt = await page.request.post(k.adresse + 'api/aufgaben/1/zeiten', { headers: { 'X-KanbanD-Wer': 'st' }, data: { wer: 'st', beginn: '2026-01-05 09:00', ende: '2026-01-05 10:00' } });
    expect(angelegt.status(), await angelegt.text()).toBe(200);
    const { fenster, zeit } = await dauerAbgelehnt(page);
    await fenster.getByRole('button', { name: 'Zeit 1 korrigieren' }).click();
    const [beginn, ende] = [fenster.getByLabel('Beginn', { exact: true }), fenster.getByLabel('Ende', { exact: true })];
    const [von, bis] = [await beginn.inputValue(), await ende.inputValue()];
    await expect(zeit, 'bis zur neuen Meldung steht die abgelehnte Eingabe').toHaveValue('abc');
    await beginn.fill(bis);
    await ende.fill(von);
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_ENDE);
    await expect(zeit).toHaveValue('');
    expect(await verweise(fenster), 'kein Feld ist ungültig, die neue Meldung steht').toEqual({ ungueltig: [], verweist: [], meldungen: 1 });
    // auch neu gezeichnet steht abc nicht wieder da
    await ansichtNeuZeichnen(page, 'Zeiten');
    await expect(zeit).toHaveValue('');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_ENDE);
  });

  // Ausgang (e) (Betreiber 2026-11-15): ein abgeschicktes anderes Entwurfsfeld nimmt den einen Platz des Fensters — die
  // frühere abgelehnte Eingabe geht samt Meldung schon beim Abschicken, auch wenn die neue Eingabe angenommen wird.
  /** Der Kern von G-3: nie ein ungültiges Feld ohne Meldung, nie eine Meldung ohne ihr Feld — gelesen in der Ansicht, die das Feld zeigt. */
  const kernGilt = async fenster => {
    const stand = await verweise(fenster);
    expect(stand.ungueltig.length, `ungültige Felder ${JSON.stringify(stand.ungueltig)} und Meldungen (${stand.meldungen}) gehören zusammen`).toBe(stand.meldungen);
    expect(stand.verweist, 'jedes ungültige Feld verweist auf die Meldung').toEqual(stand.ungueltig);
  };

  test('G-3 (e-1): Lage nach 93-1, danach der Titel auf „Abnahme geprüft“ geändert, mit Enter gespeichert und zu „Zeiten“ zurückgewechselt → Titel gespeichert (ein Commit), „Zeit nachtragen“ leer ohne aria-invalid und aria-describedby, keine Meldung, der Fuß zeigt „gespeichert hh:mm:ss“', async ({ page }) => {
    k = await starten(page);
    const { fenster, zeit } = await dauerAbgelehnt(page);
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await kernGilt(fenster);
    await reiter(page, 'Inhalt');
    await page.locator(TITEL_LESEN).click();
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    await page.keyboard.press('Enter');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme geprüft');
    await expect.poll(() => k.lies(DATEI_1)).toContain('title: Abnahme geprüft\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    await expect(fenster.locator('.mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('');
    await expect(zeit).not.toHaveAttribute('aria-invalid');
    await expect(zeit).not.toHaveAttribute('aria-describedby');
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    await expect(fenster.locator('.mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
    expect(await verweise(fenster)).toEqual(KEINES);
    await kernGilt(fenster);
    expect(k.lies(DATEI_1), 'keine Zeit eingetragen').not.toContain('kanbanD-time');
    expect(Number(k.git('rev-list', '--count', 'HEAD')), 'genau ein Commit').toBe(commits + 1);
  });

  test('G-3 (e-2): Lage nach 96-1, danach 0:45 in „Zeit nachtragen“ mit Enter eingetragen und zu „Inhalt“ zurückgewechselt → Zeit eingetragen (ein Commit), Titel im Lesezustand „Abnahme prüfen“, keine Meldung, kein Feld des Fensters ist ungültig', async ({ page }) => {
    k = await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await page.locator(TITEL_LESEN).click();
    await page.locator(TITELFELD).fill('');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_TITEL);
    await expect(page.locator(TITELFELD)).toHaveAttribute('aria-invalid', 'true');
    await kernGilt(fenster);
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await reiter(page, 'Zeiten');
    const zeit = fenster.getByLabel('Zeit nachtragen');
    await zeit.fill('0:45');
    await page.keyboard.press('Enter');
    await expect(fenster.locator('.zt tr')).toHaveCount(1);
    await expect.poll(() => k.lies(DATEI_1)).toContain('kanbanD-time');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    await expect(zeit).toHaveValue('');
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await reiter(page, 'Inhalt');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITELFELD), 'kein Titelfeld ohne abgelehnte Eingabe').toHaveCount(0);
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await kernGilt(fenster);
    expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
    expect(Number(k.git('rev-list', '--count', 'HEAD')), 'genau ein Commit').toBe(commits + 1);
  });
});
