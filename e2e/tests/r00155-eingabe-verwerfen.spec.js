// R00155 Mitglied #54, Kriterium 54-12 und 54B-5 (Karte #54, I0142 B0739; US-10): der sichtbare Knopf „Eingabe verwerfen“
// rechts im Fensterfuß für alle ohne Esc-Taste. Er liest den Entwurf beim Drücken und geht denselben Weg wie Esc im selben
// Feld; hat das Feld mit Fokus keinen Entwurf, verwirft er die abgelehnte Eingabe des Fensters; sonst tut er nichts.
// Er schließt das Fenster nie. Getippt wird mit echtem Tipp im Touch-Kontext — ein Aufruf der Aktion bewiese nicht, dass
// der Tipp dem Feld den Fokus lässt (das Verlassen speicherte sonst den Entwurf).
const { test, expect } = require('@playwright/test');
const { reiter, thema } = require('./hilfen');
const { DATEI_1, MELDUNG_TITEL, MELDUNG_DAUER, starten, fensterOeffnen, standMerken, nichtsGeschrieben, verweise, ansagen, ansichtNeuZeichnen, fremdesNeuzeichnen } = require('./r00155-hilfen');

const TOUCH = breite => ({ viewport: { width: breite, height: 896 }, isMobile: true, hasTouch: true });
const TITELFELD = '#fenster [data-af="titel"]';
const TITEL_LESEN = '#fenster [data-act="titel-bearbeiten"]';
const BESCHREIBUNG = '#fenster #beschreibung';
const BESCHREIBUNG_LESEN = '#fenster [data-act="beschreibung-bearbeiten"]';
const KEINES = { ungueltig: [], verweist: [], meldungen: 0 };

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

const knopfIm = fenster => fenster.locator('.mod-fuss').getByRole('button', { name: 'Eingabe verwerfen', exact: true });

/** Aufgabenfenster einer Aufgabe per Tipp geöffnet, in der genannten Ansicht. */
async function fensterIn(page, ansicht, nummer = 1) {
  k = await starten(page);
  const fenster = await fensterOeffnen(page, nummer, true);
  if (ansicht !== 'Inhalt') await reiter(page, ansicht);
  return fenster;
}

/** Titel von #1 im Bearbeiten, Fokus im Feld. */
async function titelBearbeiten(page) {
  const fenster = await fensterIn(page, 'Inhalt');
  await page.locator(TITEL_LESEN).tap();
  await expect(page.locator(TITELFELD)).toBeFocused();
  return fenster;
}

/** Lage nach 96-1: Titel von #1 geleert und mit Enter abgelehnt. */
async function titelAbgelehnt(page) {
  const fenster = await titelBearbeiten(page);
  await page.locator(TITELFELD).fill('');
  await page.keyboard.press('Enter');
  await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_TITEL);
  await expect(page.locator(TITELFELD)).toHaveAttribute('aria-invalid', 'true');
  return fenster;
}

/** Lage nach 93-1: `abc` in „Zeit nachtragen“ von #1 mit Enter abgelehnt. */
async function dauerAbgelehnt(page) {
  const fenster = await fensterIn(page, 'Zeiten');
  const zeit = fenster.getByLabel('Zeit nachtragen');
  await zeit.tap();
  await page.keyboard.type('abc');
  await page.keyboard.press('Enter');
  await expect(fenster.locator('.mod-fuss [role=alert]')).toHaveText(MELDUNG_DAUER);
  await expect(zeit).toHaveAttribute('aria-invalid', 'true');
  return { fenster, zeit };
}

/** Nichts scrollt quer: je `[scrollWidth, clientWidth]` von Dokument, Fenster und Fuß. */
function breiten(page, fenster) {
  return Promise.all([
    page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]),
    fenster.evaluate(f => [f.scrollWidth, f.clientWidth]),
    fenster.locator('.mod-fuss').evaluate(f => [f.scrollWidth, f.clientWidth]),
  ]);
}

test.describe('R00155 #54: Knopf „Eingabe verwerfen“, 414 px mit Touch', () => {
  test.use(TOUCH(414));

  test('54-12 (Wortlaut product-owner, Titel): der Knopf steht rechts im Fuß, mindestens 48 × 48 px; Tipp → der Titel zeigt den Stand der Datei, Fokus auf „Titel bearbeiten“, Fenster offen, nichts geschrieben, stumm', async ({ page }) => {
    const fenster = await titelBearbeiten(page);
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    const knopf = knopfIm(fenster);
    await expect(knopf).toBeVisible();
    const [flaeche, fuss] = [await knopf.boundingBox(), await fenster.locator('.mod-fuss').boundingBox()];
    expect(flaeche.height).toBeGreaterThanOrEqual(48);
    expect(flaeche.width).toBeGreaterThanOrEqual(48);
    expect(fuss.x + fuss.width - (flaeche.x + flaeche.width), 'rechts im Fuß: höchstens das Polster des Fußes bis zum Rand').toBeLessThanOrEqual(16);
    expect(flaeche.y, 'ganz im Fuß').toBeGreaterThanOrEqual(fuss.y);
    expect(flaeche.y + flaeche.height, 'ganz im Fuß').toBeLessThanOrEqual(fuss.y + fuss.height + 0.5);
    const vorher = await standMerken(page, k);
    const angesagt = await ansagen(page);
    await knopf.tap();
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await expect(page.locator(TITELFELD)).toHaveCount(0);
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-12 Titel');
    expect(await ansagen(page), 'das Verwerfen bleibt stumm').toEqual(angesagt);
    expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
  });

  test('54-12/US-10 (Abnahme-Probe der UX-Vorprüfung, wörtlich): „ui, daten, neu“ in Labels tippen, „Eingabe verwerfen“ antippen → Feld „ui, daten“, Fenster offen, kein PATCH, Datei und Zahl der Commits unverändert; der Fokus bleibt im Feld', async ({ page }) => {
    const fenster = await fensterIn(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.tap();
    await page.keyboard.press('End');
    await page.keyboard.type(', neu');
    await expect(labels).toHaveValue('ui, daten, neu');
    const vorher = await standMerken(page, k);
    const angesagt = await ansagen(page);
    await knopfIm(fenster).tap();
    await expect(labels).toHaveValue('ui, daten');
    await expect(labels).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-12 Labels');
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('PATCH')), 'kein PATCH').toEqual([]);
    expect(await ansagen(page), 'stumm').toEqual(angesagt);
    // verlassen ohne neue Eingabe: auch danach ist nichts geschrieben
    await fenster.getByLabel('Neue Herkunft').tap();
    await expect(labels).not.toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54-12 Labels, nach dem Verlassen');
  });

  test('54-12: „Neue Herkunft“ mit getipptem I00 → nach dem Tipp ist das Feld leer, der Fokus im Feld, nichts geschrieben; auch neu gezeichnet steht I00 nicht wieder da', async ({ page }) => {
    const fenster = await fensterIn(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.tap();
    await page.keyboard.type('I00');
    const vorher = await standMerken(page, k);
    await knopfIm(fenster).tap();
    await expect(herkunft).toHaveValue('');
    await expect(herkunft).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-12 Herkunft');
    await ansichtNeuZeichnen(page, 'Details');
    await expect(herkunft).toHaveValue('');
  });

  test('54-15/54-12 „Fälle mit Entwurf“: „Neuer Kommentar“ mit getipptem Notiz → nach dem Tipp ist das Feld leer, der Fokus im Feld, Fenster offen, nichts geschrieben (kein POST); auch neu gezeichnet steht Notiz nicht wieder da', async ({ page }) => {
    const fenster = await fensterIn(page, 'Inhalt');
    const kommentar = fenster.getByLabel('Neuer Kommentar', { exact: true });
    await kommentar.tap();
    await page.keyboard.type('Notiz');
    await expect(kommentar).toHaveValue('Notiz');
    const vorher = await standMerken(page, k);
    await knopfIm(fenster).tap();
    await expect(kommentar).toHaveValue('');
    await expect(kommentar).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-15 Knopf');
    await ansichtNeuZeichnen(page, 'Inhalt');
    await expect(kommentar).toHaveValue('');
    expect(k.lies(DATEI_1)).not.toContain('Notiz');
  });

  test('54-12: Titel nach abgelehnter Eingabe (Lage nach 96-1) → nach dem Tipp liest der Titel „Abnahme prüfen“, Meldung fort, Fokus auf „Titel bearbeiten“ (wie 96-5)', async ({ page }) => {
    const fenster = await titelAbgelehnt(page);
    const vorher = await standMerken(page, k);
    await knopfIm(fenster).tap();
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-12 abgelehnter Titel');
  });

  test('54-12 Regel (2): der abgelehnte Titel steht ohne Fokus da (Fokus in der neuen Teilaufgabe, leer) → der Tipp stellt den Titel in den Lesezustand, Meldung fort, der Fokus bleibt, wo er war', async ({ page }) => {
    const fenster = await titelAbgelehnt(page);
    const teil = fenster.getByLabel('Neue Teilaufgabe', { exact: true });
    await teil.tap();
    await expect(teil).toBeFocused();
    await expect(page.locator(TITELFELD), 'der abgelehnte Titel bleibt auch ohne Fokus Eingabefeld').toHaveAttribute('aria-invalid', 'true');
    const vorher = await standMerken(page, k);
    await knopfIm(fenster).tap();
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITELFELD)).toHaveCount(0);
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    expect(await verweise(fenster)).toEqual(KEINES);
    await expect(teil).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-12 Regel (2), Titel');
  });

  for (const [lage, fokussieren] of [
    ['Fokus im unveränderten Labels-Feld', async fenster => { await reiter(fenster.page(), 'Details'); await fenster.getByLabel('Labels').tap(); return fenster.getByLabel('Labels'); }],
    ['Titel im Bearbeiten, unverändert', async fenster => { await fenster.page().locator(TITEL_LESEN).tap(); return fenster.page().locator(TITELFELD); }],
    ['Fokus in keinem Textfeld (Spalte)', async fenster => { await reiter(fenster.page(), 'Details'); await fenster.getByLabel('Spalte', { exact: true }).focus(); return fenster.getByLabel('Spalte', { exact: true }); }],
  ]) {
    test(`54-12/US-10 ohne Entwurf (${lage}): ein Tipp ändert nichts — kein Schreiben, keine Meldung, kein Fokuswechsel, das Fenster bleibt offen; auch ein Doppeltipp schließt es nicht`, async ({ page }) => {
      const fenster = await fensterIn(page, 'Inhalt');
      const feld = await fokussieren(fenster);
      await expect(feld).toBeFocused();
      const wert = await feld.inputValue();
      const knopf = knopfIm(fenster);
      const vorher = await standMerken(page, k);
      const angesagt = await ansagen(page);
      await knopf.tap();
      await knopf.tap();
      await knopf.tap();
      await expect(fenster).toBeVisible();
      await expect(feld).toBeFocused();
      await expect(feld).toHaveValue(wert);
      await expect(fenster.locator('[role=alert]')).toHaveCount(0);
      await nichtsGeschrieben(page, k, vorher, '54-12 ohne Entwurf');
      expect(await ansagen(page), 'keine Meldung').toEqual(angesagt);
      await expect(knopf, 'nie ausgegraut').toBeEnabled();
      await expect(knopf).not.toHaveAttribute('aria-disabled');
    });
  }

  // Herauslösbar mit dem Block 54B (US-5): fällt er heraus, entfällt dieser describe-Block.
  test.describe('54B-5: Knopf in der Beschreibung', () => {
    test('54B-5: Beschreibung von #1 im Bearbeiten, „ und mehr“ angehängt, Tipp → die Beschreibung liest „Erster Absatz“, Fokus auf „Beschreibung bearbeiten“, Fenster offen, nichts geschrieben (wie 54B-1)', async ({ page }) => {
      const fenster = await fensterIn(page, 'Inhalt');
      await page.locator(BESCHREIBUNG_LESEN).tap();
      await expect(page.locator(BESCHREIBUNG)).toBeFocused();
      await page.keyboard.press('Control+End');
      await page.keyboard.type(' und mehr');
      await expect(page.locator(BESCHREIBUNG)).toHaveValue('Erster Absatz und mehr');
      const vorher = await standMerken(page, k);
      await knopfIm(fenster).tap();
      await expect(page.locator(BESCHREIBUNG_LESEN)).toHaveText('Erster Absatz');
      await expect(page.locator(BESCHREIBUNG_LESEN)).toBeFocused();
      await expect(fenster).toBeVisible();
      await nichtsGeschrieben(page, k, vorher, '54B-5');
    });

    test('54B-5: leere Beschreibung von #2 mit getipptem „Notiz“, Tipp → Feld leer, Fokus im Feld, Fenster offen, nichts geschrieben (wie 54B-3)', async ({ page }) => {
      const fenster = await fensterIn(page, 'Inhalt', 2);
      const feld = page.locator(BESCHREIBUNG);
      await feld.tap();
      await page.keyboard.type('Notiz');
      const vorher = await standMerken(page, k);
      await knopfIm(fenster).tap();
      await expect(feld).toHaveValue('');
      await expect(feld).toBeFocused();
      await expect(fenster).toBeVisible();
      await nichtsGeschrieben(page, k, vorher, '54B-5, leer');
    });
  });
});

// 54-13 (Muss M-A des ux-reviewer, US-10 drittes Szenario): Hilfstechnik löst den Knopf ohne Zeiger aus — der Fokus wandert
// zuerst auf den Knopf, erst dann kommt der Klick. Das Feld „unmittelbar vor dem Knopf“ gilt als noch nicht verlassen.
test.describe('R00155 #54: Knopf „Eingabe verwerfen“ ohne Zeiger ausgelöst (54-13), 414 px mit Touch', () => {
  test.use(TOUCH(414));

  /** Der Knopf bekommt den Fokus und wird in einem Zug ausgelöst — ohne Zeigerereignis davor. */
  const ohneZeigerAusloesen = knopf => knopf.evaluate(element => { element.focus(); element.click(); });

  /** Labels von #1 mit getipptem `ui, daten, neu`, Fokus im Feld. */
  async function labelsMitEntwurf(page) {
    const fenster = await fensterIn(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.tap();
    await page.keyboard.press('End');
    await page.keyboard.type(', neu');
    await expect(labels).toHaveValue('ui, daten, neu');
    return { fenster, labels };
  }

  test('54-13/US-10 (Abnahme-Probe des ux-reviewer, wörtlich): im Labels-Feld ist „ui, daten, neu“ getippt, knopf.focus(); knopf.click() → Labels zeigt „ui, daten“, das Fenster ist offen, kein PATCH, Datei und Zahl der Commits unverändert; der Fokus steht wieder im Feld', async ({ page }) => {
    const { fenster, labels } = await labelsMitEntwurf(page);
    const vorher = await standMerken(page, k);
    const angesagt = await ansagen(page);
    await ohneZeigerAusloesen(knopfIm(fenster));
    await expect(labels).toHaveValue('ui, daten');
    await expect(labels).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-13 Labels');
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('PATCH')), 'kein PATCH').toEqual([]);
    expect(k.lies(DATEI_1)).toContain('labels: [ui, daten]\n');
    expect(await ansagen(page), 'stumm').toEqual(angesagt);
    // verlassen ohne neue Eingabe: auch danach ist nichts geschrieben
    await fenster.getByLabel('Neue Herkunft').tap();
    await expect(labels).not.toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54-13 Labels, nach dem Verlassen');
  });

  test('54-13 Variante Titel: im Bearbeiten „Abnahme geprüft“ getippt, knopf.focus(); knopf.click() → der Titel liest „Abnahme prüfen“, Fokus auf „Titel bearbeiten“, Fenster offen, nichts geschrieben', async ({ page }) => {
    const fenster = await titelBearbeiten(page);
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    const vorher = await standMerken(page, k);
    await ohneZeigerAusloesen(knopfIm(fenster));
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await expect(page.locator(TITELFELD)).toHaveCount(0);
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-13 Titel');
    expect(k.lies(DATEI_1)).toContain('title: Abnahme prüfen\n');
  });

  // Herauslösbar mit dem Block 54B (US-5): fällt er heraus, entfällt dieser Test.
  test('54-13 Variante Beschreibung: „ und mehr“ angehängt, knopf.focus(); knopf.click() → die Beschreibung liest „Erster Absatz“, Fokus auf „Beschreibung bearbeiten“, Fenster offen, nichts geschrieben', async ({ page }) => {
    const fenster = await fensterIn(page, 'Inhalt');
    await page.locator(BESCHREIBUNG_LESEN).tap();
    await expect(page.locator(BESCHREIBUNG)).toBeFocused();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' und mehr');
    await expect(page.locator(BESCHREIBUNG)).toHaveValue('Erster Absatz und mehr');
    const vorher = await standMerken(page, k);
    await ohneZeigerAusloesen(knopfIm(fenster));
    await expect(page.locator(BESCHREIBUNG_LESEN)).toHaveText('Erster Absatz');
    await expect(page.locator(BESCHREIBUNG_LESEN)).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-13 Beschreibung');
  });

  test('54-13 Klarstellung (iii), Enter-Feld: in „Neue Herkunft“ ist I00 getippt, knopf.focus(); knopf.click() → Feld leer, Fokus im Feld, nichts geschrieben', async ({ page }) => {
    const fenster = await fensterIn(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.tap();
    await page.keyboard.type('I00');
    const vorher = await standMerken(page, k);
    await ohneZeigerAusloesen(knopfIm(fenster));
    await expect(herkunft).toHaveValue('');
    await expect(herkunft).toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54-13 Herkunft');
  });

  test('54-13: der Fokus ruht erst auf dem Knopf (eigener Schritt, Titel über die 50 ms des Verlassens hinaus), dann wird ausgelöst → der Titel liest „Abnahme prüfen“, nichts geschrieben', async ({ page }) => {
    const fenster = await titelBearbeiten(page);
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    const vorher = await standMerken(page, k);
    const knopf = knopfIm(fenster);
    await knopf.focus();
    await expect(knopf).toBeFocused();
    // Die Pause ist der Reiz, keine Synchronisation: der Zeitgeber, der einen verlassenen Titel nach 50 ms in den Lesezustand stellt, ist abgelaufen
    await page.evaluate(() => new Promise(fertig => setTimeout(fertig, 80)));
    await expect(page.locator(TITELFELD), 'der Entwurf steht noch im Feld').toHaveValue('Abnahme geprüft');
    await nichtsGeschrieben(page, k, vorher, '54-13 Titel, Fokus ruht auf dem Knopf');
    await knopf.evaluate(element => element.click());
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme prüfen');
    await expect(page.locator(TITEL_LESEN)).toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54-13 Titel, danach ausgelöst');
  });

  test('54-13 Gegenprobe: Tab aus Labels nach „Fällig“ speichert weiter (54-10), ein Commit', async ({ page }) => {
    const { fenster, labels } = await labelsMitEntwurf(page);
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.keyboard.press('Tab');
    await expect(fenster.getByLabel('Fälligkeit', { exact: true })).toBeFocused();
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    await expect(labels).toHaveValue('ui, daten, neu');
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('PATCH')), 'genau ein PATCH').toHaveLength(1);
  });

  test('54-13 Gegenprobe: Fokus auf den Knopf und ohne Auslösen weiter → solange der Fokus auf dem Knopf steht, steht der Entwurf im Feld; geht er weiter, ist er gespeichert — nie still verloren', async ({ page }) => {
    const { fenster, labels } = await labelsMitEntwurf(page);
    const vorher = await standMerken(page, k);
    const knopf = knopfIm(fenster);
    await knopf.focus();
    await expect(knopf).toBeFocused();
    await expect(labels).toHaveValue('ui, daten, neu');
    await nichtsGeschrieben(page, k, vorher, '54-13 Fokus auf dem Knopf');
    await fenster.getByLabel('Neue Herkunft').focus();
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
    await expect.poll(() => k.git('rev-list', '--count', 'HEAD')).toBe(String(Number(vorher.commits) + 1));
    await expect(labels).toHaveValue('ui, daten, neu');
  });

  test('54-13 Gegenprobe: der Fokus steht auf dem Knopf, und das Fenster zeichnet neu (bot ändert #2) → der Entwurf ist gespeichert, nie still verloren', async ({ page }) => {
    const { fenster, labels } = await labelsMitEntwurf(page);
    const knopf = knopfIm(fenster);
    await knopf.focus();
    await expect(knopf).toBeFocused();
    await fremdesNeuzeichnen(page, k);
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
    await expect(labels).toHaveValue('ui, daten, neu');
  });

  test('54-13 Gegenprobe: der Fokus steht auf dem Knopf, Esc schließt das Fenster → der Entwurf ist gespeichert wie beim Verlassen, nie still verloren', async ({ page }) => {
    const { fenster } = await labelsMitEntwurf(page);
    const knopf = knopfIm(fenster);
    await knopf.focus();
    await expect(knopf).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(fenster).toHaveCount(0);
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
  });
});

test.describe('R00155 #54: Knopf „Eingabe verwerfen“, 320 px mit Touch', () => {
  test.use(TOUCH(320));

  test('54-12 Regel (2)/US-10: Lage nach 93-1, danach das Labels-Feld angetippt (unverändert) → der Tipp leert „Zeit nachtragen“, Meldung fort, kein aria-invalid, Fokus im Labels-Feld, nichts geschrieben; neu gezeichnet steht abc nicht wieder da', async ({ page }) => {
    const { fenster, zeit } = await dauerAbgelehnt(page);
    await reiter(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.tap();
    await expect(labels).toBeFocused();
    await expect(labels).toHaveValue('ui, daten');
    await expect(fenster.locator('.mod-fuss [role=alert]'), 'die Meldung übersteht den Wechsel der Ansicht').toHaveText(MELDUNG_DAUER);
    const vorher = await standMerken(page, k);
    await knopfIm(fenster).tap();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    await expect(labels).toBeFocused();
    await expect(labels).toHaveValue('ui, daten');
    await expect(fenster).toBeVisible();
    expect(await verweise(fenster)).toEqual(KEINES);
    await nichtsGeschrieben(page, k, vorher, '54-12 Regel (2)');
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
    await expect(fenster.locator('.zt tr')).toHaveCount(0);
  });

  test('54-12 Regel (1), dann (2)/US-10: Lage nach 93-1, im Labels-Feld „ui, daten, neu“ getippt → der erste Tipp stellt nur die Labels zurück, abc und die Meldung stehen weiter; der zweite Tipp räumt abc und die Meldung, das Fenster bleibt offen', async ({ page }) => {
    const { fenster, zeit } = await dauerAbgelehnt(page);
    await reiter(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.tap();
    await page.keyboard.press('End');
    await page.keyboard.type(', neu');
    await expect(labels).toHaveValue('ui, daten, neu');
    const vorher = await standMerken(page, k);
    const knopf = knopfIm(fenster);
    await knopf.tap();
    await expect(labels).toHaveValue('ui, daten');
    await expect(labels).toBeFocused();
    await expect(fenster.locator('.mod-fuss [role=alert]'), 'die Meldung zur Dauer steht weiter').toHaveText(MELDUNG_DAUER);
    await knopf.tap();
    await expect(fenster.locator('[role=alert]')).toHaveCount(0);
    await expect(labels).toBeFocused();
    await expect(fenster).toBeVisible();
    await nichtsGeschrieben(page, k, vorher, '54-12 Regel (1), dann (2)');
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
  });

  test('54-12 Regel (1) lässt die abgelehnte Eingabe stehen: nach dem ersten Tipp zeigt „Zeit nachtragen“ weiter abc, ungültig, mit Meldung (wie 54-8)', async ({ page }) => {
    const { fenster, zeit } = await dauerAbgelehnt(page);
    await reiter(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.tap();
    await page.keyboard.press('End');
    await page.keyboard.type(', neu');
    await knopfIm(fenster).tap();
    await expect(labels).toHaveValue('ui, daten');
    await reiter(page, 'Zeiten');
    await expect(zeit).toHaveValue('abc');
    await expect(zeit).toHaveAttribute('aria-invalid', 'true');
    await expect(fenster.locator('#fenster-meldung')).toHaveText(MELDUNG_DAUER);
    expect(await verweise(fenster)).toEqual({ ungueltig: ['#zeit-neu'], verweist: ['#zeit-neu'], meldungen: 1 });
  });

  for (const farbe of ['light', 'dark']) {
    test(`54-12 (${farbe}): bei 320 px scrollt nichts quer, auch mit Meldung im Fuß (96-1) — Meldung und Knopf stehen untereinander ganz im Bild`, async ({ page }) => {
      const fenster = await titelAbgelehnt(page);
      await thema(page, farbe);
      const knopf = knopfIm(fenster);
      const meldung = fenster.locator('#fenster-meldung');
      await expect(knopf).toBeVisible();
      for (const [scrollbreite, breite] of await breiten(page, fenster)) expect(scrollbreite).toBeLessThanOrEqual(breite);
      const [m, kn, f] = [await meldung.boundingBox(), await knopf.boundingBox(), await fenster.locator('.mod-fuss').boundingBox()];
      expect(kn.y, 'der Knopf steht unter der Meldung').toBeGreaterThanOrEqual(m.y + m.height - 0.5);
      for (const [name, r] of [['Meldung', m], ['Knopf', kn]]) {
        expect(r.x, `${name} links im Bild`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, `${name} rechts im Bild`).toBeLessThanOrEqual(320);
        expect(r.y, `${name} im Fuß`).toBeGreaterThanOrEqual(f.y - 0.5);
        expect(r.y + r.height, `${name} im Fuß`).toBeLessThanOrEqual(f.y + f.height + 0.5);
        expect(r.y + r.height, `${name} unten im Bild`).toBeLessThanOrEqual(896);
      }
      expect(kn.height).toBeGreaterThanOrEqual(48);
    });
  }
});

// Sichtbarkeit und Maß (Tabelle in 54-12), je hell und dunkel
const SICHTBARKEIT = [
  { breite: 320, grob: true, sichtbar: true, hoehe: [48, 60], hinweis: false },
  { breite: 414, grob: true, sichtbar: true, hoehe: [48, 60], hinweis: false },
  { breite: 414, grob: false, sichtbar: true, hoehe: [24, 24], hinweis: false },
  { breite: 640, grob: false, sichtbar: true, hoehe: [24, 24], hinweis: false },
  { breite: 641, grob: false, sichtbar: false, hinweis: true },
  { breite: 820, grob: true, sichtbar: true, hoehe: [48, 48], hinweis: true },
  { breite: 1280, grob: false, sichtbar: false, hinweis: true },
];
for (const zeile of SICHTBARKEIT) {
  const zeiger = zeile.grob ? 'grober Zeiger' : 'feiner Zeiger';
  test.describe(`R00155 #54: Sichtbarkeit des Knopfs, ${zeile.breite} px, ${zeiger}`, () => {
    test.use(zeile.grob ? TOUCH(zeile.breite) : { viewport: { width: zeile.breite, height: 896 } });
    for (const farbe of ['light', 'dark']) {
      test(`54-12/54-11 (${farbe}): Knopf ${zeile.sichtbar ? `sichtbar, ${zeile.hoehe[0]} px hoch` : 'nicht sichtbar'}; Tastenhinweis im Fuß ${zeile.hinweis ? 'sichtbar' : 'ausgeblendet'}`, async ({ page }) => {
        k = await starten(page);
        const fenster = await fensterOeffnen(page, 1, zeile.grob);
        await thema(page, farbe);
        const knopf = fenster.locator('.mod-fuss [data-act="eingabe-verwerfen"]');
        const hinweis = fenster.locator('.mod-fuss .tastenhinweis');
        await expect(knopf, 'der Knopf wird immer gezeichnet, nie je Zustand').toHaveCount(1);
        if (zeile.hinweis) await expect(hinweis).toBeVisible(); else await expect(hinweis).toBeHidden();
        if (!zeile.sichtbar) { await expect(knopf).toBeHidden(); return; }
        await expect(knopf).toBeVisible();
        await expect(knopf).toHaveText('Eingabe verwerfen');
        await expect(knopf).toBeEnabled();
        await expect(knopf).not.toHaveAttribute('aria-disabled');
        const [flaeche, fuss] = [await knopf.boundingBox(), await fenster.locator('.mod-fuss').boundingBox()];
        expect(flaeche.height).toBeGreaterThanOrEqual(zeile.hoehe[0]);
        expect(flaeche.height).toBeLessThanOrEqual(zeile.hoehe[1]);
        expect(fuss.x + fuss.width - (flaeche.x + flaeche.width), 'rechts im Fuß').toBeLessThanOrEqual(16);
        expect(flaeche.y, 'ganz im Fuß').toBeGreaterThanOrEqual(fuss.y - 0.5);
        expect(flaeche.y + flaeche.height, 'ganz im Fuß').toBeLessThanOrEqual(fuss.y + fuss.height + 0.5);
        if (zeile.hinweis) {
          const h = await hinweis.boundingBox();
          expect(flaeche.x, 'der Knopf steht hinter dem Tastenhinweis').toBeGreaterThanOrEqual(h.x + h.width);
        }
        // Kontrast gehört zur Hausform .btn; hier nur: der Knopf ist nicht gedämpft
        expect(await knopf.evaluate(element => getComputedStyle(element).opacity)).toBe('1');
      });
    }
  });
}
