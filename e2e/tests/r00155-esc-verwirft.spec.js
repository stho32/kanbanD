// R00155 Mitglied #54 (Karte #54, I0142 B0720–B0724, B0739; ADR-0010 N9): Esc tut je Druck genau eines, das Innerste zuerst —
// hat das fokussierte Textfeld einen Entwurf oder einen Bearbeitungsmodus, verwirft Esc ihn ohne Schreibweg und das Fenster
// bleibt offen; sonst schließt Esc. Enter und das Verlassen speichern weiter.
const { test, expect } = require('@playwright/test');
const { reiter, breiteSetzen } = require('./hilfen');
const { DATEI_1, DATEI_2, MELDUNG_X1, starten, fensterOeffnen, standMerken, nichtsGeschrieben, fremdesNeuzeichnen, verweise, ansagen, ansichtNeuZeichnen } = require('./r00155-hilfen');

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

// 54-14 (US-1 zweites Szenario): nach einem fremden Neuzeichnen steht der getippte Wert in einem neuen Feld — der Browser
// meldet dafür auf Enter kein „change“. Enter speichert trotzdem; sonst verwürfe das folgende Esc, was Enter speichern sollte.
test.describe('R00155 #54: Enter speichert auch nach einem fremden Neuzeichnen (54-14)', () => {
  test('54-14/US-1: Titel — „Abnahme geprüft“ getippt, bot ändert #2 (das Fenster zeichnet neu), Enter → title: Abnahme geprüft in der Datei, genau ein neuer Commit von st, Titel im Lesezustand; ein Esc danach verwirft nichts und schließt', async ({ page }) => {
    await titelBearbeiten(page);
    await page.locator(TITELFELD).fill('Abnahme geprüft');
    await fremdesNeuzeichnen(page, k);
    await expect(page.locator(TITELFELD), 'der getippte Wert übersteht das Neuzeichnen').toHaveValue('Abnahme geprüft');
    await expect(page.locator(TITELFELD)).toBeFocused();
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.keyboard.press('Enter');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme geprüft');
    await expect(page.locator(TITELFELD)).toHaveCount(0);
    await expect.poll(() => k.lies(DATEI_1)).toContain('title: Abnahme geprüft\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('PATCH')), 'genau ein PATCH').toEqual(['PATCH /api/aufgaben/1']);
    // Folgeprobe: Esc verwirft nichts und schließt
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await fensterIstZu(page);
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('Abnahme geprüft');
    await nichtsGeschrieben(page, k, vorher, '54-14 Titel, Esc danach');
    expect(k.lies(DATEI_1)).toContain('title: Abnahme geprüft\n');
  });

  test('54-14 Variante Labels: ui, daten, neu getippt, bot ändert #2, Enter → gespeichert, genau ein Commit von st — wie Enter ohne Neuzeichnen; ein Esc danach verwirft nichts und schließt', async ({ page }) => {
    const fenster = await fensterIn(page, 'Details');
    const labels = fenster.getByLabel('Labels');
    await labels.fill('ui, daten, neu');
    await fremdesNeuzeichnen(page, k);
    await expect(labels, 'der getippte Wert übersteht das Neuzeichnen').toHaveValue('ui, daten, neu');
    await expect(labels).toBeFocused();
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    await expect(fenster.locator('.mod-fuss .gs')).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('PATCH')), 'genau ein PATCH').toEqual(['PATCH /api/aufgaben/1']);
    await expect(labels).toHaveValue('ui, daten, neu');
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await fensterIstZu(page);
    await nichtsGeschrieben(page, k, vorher, '54-14 Labels, Esc danach');
    expect(k.lies(DATEI_1)).toContain('labels: [ui, daten, neu]\n');
  });

  test('54-14: nach dem Neuzeichnen weitergetippt, Enter → einmal gespeichert (ein PATCH, ein Commit), nicht doppelt', async ({ page }) => {
    await titelBearbeiten(page);
    await page.locator(TITELFELD).fill('Abnahme');
    await fremdesNeuzeichnen(page, k);
    await expect(page.locator(TITELFELD)).toBeFocused();
    await page.keyboard.press('End');
    await page.keyboard.type(' geprüft');
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.keyboard.press('Enter');
    await expect(page.locator(TITEL_LESEN)).toHaveText('Abnahme geprüft');
    await expect.poll(() => k.lies(DATEI_1)).toContain('title: Abnahme geprüft\n');
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('Abnahme geprüft');
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('PATCH')), 'genau ein PATCH').toEqual(['PATCH /api/aufgaben/1']);
    expect(Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
  });
});

test.describe('R00155 #54: Esc in den Feldern, die erst mit Enter schreiben', () => {
  for (const [ansicht, name, getippt] of [['Details', 'Neue Herkunft', 'I00'], ['Inhalt', 'Neue Teilaufgabe', 'Entwurf'], ['Zeiten', 'Zeit nachtragen', '0:4'], ['Inhalt', 'Neuer Kommentar', 'Notiz']]) {
    test(`54-6/US-3: „${name}“ — ${getippt} tippen, Esc → Feld leer, Fokus im Feld, Fenster offen, nichts geschrieben; auch nach dem Neuzeichnen leer; ein weiteres Esc im leeren Feld schließt`, async ({ page }) => {
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
      await ansichtNeuZeichnen(page, ansicht);
      await expect(feld, 'auch ohne Fokus neu gezeichnet steht der verworfene Text nicht wieder da').toHaveValue('');
      await feld.focus();
      await page.keyboard.press('Escape');
      await fensterIstZu(page);
      expect(k.schreibend.slice(vorher.anfragen), '54-6, zweites Esc: keine schreibende Anfrage').toEqual([]);
    });
  }

  test('54-15/US-3: Gegenprobe — „Notiz“ in „Neuer Kommentar“ und Enter speichert den Kommentar wie bisher, ein Commit von st', async ({ page }) => {
    const fenster = await fensterIn(page, 'Inhalt');
    const commits = Number(k.git('rev-list', '--count', 'HEAD'));
    const kommentar = fenster.getByLabel('Neuer Kommentar', { exact: true });
    await kommentar.click();
    await page.keyboard.type('Notiz');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies(DATEI_1)).toContain('Notiz');
    await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    await expect(fenster.locator('.km p')).toHaveText(['Notiz']);
    await expect(kommentar).toHaveValue('');
    expect(k.schreibend.filter(anfrage => anfrage.startsWith('POST')), 'genau ein POST').toEqual(['POST /api/aufgaben/1/kommentare']);
  });

  test('54-7: abgelehnte Herkunft X1, Esc → Feld leer, Meldung fort, weder aria-invalid noch aria-describedby, Fokus bleibt, Fenster offen; nach dem Neuzeichnen steht X1 nicht wieder da', async ({ page }) => {
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
    await ansichtNeuZeichnen(page, 'Details');
    await expect(herkunft, 'auch ohne Fokus neu gezeichnet steht X1 nicht wieder da').toHaveValue('');
    expect(await verweise(fenster)).toEqual(KEINES);
  });

  test('54-8: die Meldung eines anderen Felds bleibt — X1 abgelehnt, in Labels neu tippen, Esc → Labels zeigt ui, daten, die Meldung zu X1 samt ungültigem Herkunftsfeld steht weiter', async ({ page }) => {
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

// Mit Enter Abgeschicktes ist kein Entwurf mehr: solange die Antwort aussteht, steht der Text noch im Feld — Esc schließt
// trotzdem wie bisher beim ersten Druck und nimmt die Eingabe nicht zurück. Die Antwort wird gehalten, damit das Fenster sicher offen ist.
test.describe('R00155 #54: eine abgeschickte Eingabe ist kein Entwurf', () => {
  const FAELLE = [
    ['„Neue Herkunft“', 'Details', fenster => fenster.getByLabel('Neue Herkunft'), 'ohne Herkunft', 'origins: [thin air]'],
    ['Labels', 'Details', fenster => fenster.getByLabel('Labels'), 'ui, daten, neu', 'labels: [ui, daten, neu]'],
    ['Titel', 'Inhalt', () => null, 'Abnahme geprüft', 'title: Abnahme geprüft'],
    ['neue Teilaufgabe', 'Inhalt', fenster => fenster.getByLabel('Neue Teilaufgabe', { exact: true }), 'Entwurf', '- [ ] Entwurf'],
  ];
  for (const [name, ansicht, feldIn, eingabe, inDerDatei] of FAELLE) {
    test(`54-10 unter Verzögerung: ${name} — Enter und sofort Esc, die Antwort steht noch aus → das Fenster ist beim ersten Esc zu, die Eingabe ist gespeichert, genau ein Commit`, async ({ page }) => {
      const fenster = await fensterIn(page, ansicht);
      let feld = feldIn(fenster);
      if (!feld) { await page.locator(TITEL_LESEN).click(); feld = page.locator(TITELFELD); }
      let freigeben;
      const gehalten = new Promise(fertig => { freigeben = fertig; });
      let unterwegs = 0;
      await page.route(url => url.pathname.startsWith('/api/aufgaben/1'), async (route, anfrage) => {
        if (anfrage.method() === 'GET') { await route.continue(); return; }
        unterwegs++;
        await gehalten;
        await route.continue();
      });
      const commits = Number(k.git('rev-list', '--count', 'HEAD'));
      await feld.fill(eingabe);
      await page.keyboard.press('Enter');
      await expect.poll(() => unterwegs, 'die schreibende Anfrage ist gestellt und wird gehalten').toBe(1);
      await page.keyboard.press('Escape');
      await fensterIstZu(page);
      freigeben();
      await expect.poll(() => k.lies(DATEI_1)).toContain(inDerDatei + '\n');
      await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
      expect(unterwegs, 'genau eine schreibende Anfrage').toBe(1);
    });
  }
});

test.describe('R00155 #54: Fußhinweis und Kürzelhilfe nennen das Verwerfen', () => {
  test('54-11: bei 1280 px lautet der Tastenhinweis im Fuß „Esc Eingabe verwerfen · erneut schließen“ (Esc als Taste); die Kürzelhilfe führt „Esc — Eingabe verwerfen; ohne Eingabe schließen“; bis 640 px ist der Hinweis ausgeblendet', async ({ page }) => {
    const fenster = await fensterIn(page, 'Inhalt');
    const hinweis = fenster.locator('.mod-fuss .tastenhinweis');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toHaveText('Esc Eingabe verwerfen · erneut schließen');
    await expect(hinweis.locator('kbd')).toHaveText(['Esc']);
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe.locator('h3').first()).toHaveText('HIER: AUFGABENFENSTER');
    const zeile = hilfe.locator('table').first().locator('tr', { has: page.locator('kbd', { hasText: /^Esc$/ }) });
    await expect(zeile.locator('td')).toHaveText(['Esc', 'Eingabe verwerfen; ohne Eingabe schließen']);
    await page.keyboard.press('Escape');
    await expect(hilfe).toHaveCount(0);
    await expect(fenster).toBeVisible();
    await breiteSetzen(page, 640);
    await expect(hinweis).toBeHidden();
    await breiteSetzen(page, 641);
    await expect(hinweis).toBeVisible();
  });
});

// Herauslösbarer Block 54B (US-5): nimmt der Betreiber die Regel für die Beschreibung zurück, entfällt genau dieser Block.
test.describe('R00155 #54, Block Beschreibung (54B): Esc verwirft den Entwurf der Beschreibung', () => {
  const BESCHREIBUNG = '#fenster #beschreibung';
  const BESCHREIBUNG_LESEN = '#fenster [data-act="beschreibung-bearbeiten"]';

  /** Beschreibung von #1 („Erster Absatz“) im Bearbeiten, Schreibmarke am Ende. */
  async function beschreibungBearbeiten(page) {
    const fenster = await fensterIn(page, 'Inhalt');
    await page.locator(BESCHREIBUNG_LESEN).click();
    await expect(page.locator(BESCHREIBUNG)).toBeFocused();
    await page.keyboard.press('Control+End');
    return fenster;
  }

  test('54B-1/US-5: „ und mehr“ anhängen, Esc → die Beschreibung liest „Erster Absatz“, Fokus auf „Beschreibung bearbeiten“, Fenster offen, nichts geschrieben; ein zweites Esc schließt', async ({ page }) => {
    const fenster = await beschreibungBearbeiten(page);
    await page.keyboard.type(' und mehr');
    await expect(page.locator(BESCHREIBUNG)).toHaveValue('Erster Absatz und mehr');
    const vorher = await standMerken(page, k);
    const angesagt = await ansagen(page);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(page.locator(BESCHREIBUNG_LESEN)).toHaveText('Erster Absatz');
    await expect(page.locator(BESCHREIBUNG_LESEN)).toBeFocused();
    await expect(page.locator(BESCHREIBUNG)).toHaveCount(0);
    await nichtsGeschrieben(page, k, vorher, '54B-1');
    expect(await ansagen(page), 'stumm').toEqual(angesagt);
    await page.keyboard.press('Escape');
    await fensterIstZu(page);
    await nichtsGeschrieben(page, k, vorher, '54B-1, zweites Esc');
  });

  test('54B-2: Beschreibung im Bearbeiten und unverändert, Esc → Bearbeitungsmodus beendet, Fenster offen', async ({ page }) => {
    const fenster = await beschreibungBearbeiten(page);
    const vorher = await standMerken(page, k);
    await page.keyboard.press('Escape');
    await expect(fenster).toBeVisible();
    await expect(page.locator(BESCHREIBUNG)).toHaveCount(0);
    await expect(page.locator(BESCHREIBUNG_LESEN)).toBeFocused();
    await nichtsGeschrieben(page, k, vorher, '54B-2');
  });

  for (const einstieg of ['Klick ins Feld', 'Taste b']) {
    test(`54B-3/US-5: leere Beschreibung von #2 (${einstieg}) — „Notiz“ tippen, Esc → Feld leer, Fokus im Feld, Fenster offen, nichts geschrieben; ein weiteres Esc im leeren Feld schließt`, async ({ page }) => {
      k = await starten(page);
      const fenster = await fensterOeffnen(page, 2);
      const feld = page.locator(BESCHREIBUNG);
      if (einstieg === 'Taste b') await page.keyboard.press('b'); else await feld.click();
      await expect(feld).toBeFocused();
      await page.keyboard.type('Notiz');
      const vorher = await standMerken(page, k);
      await page.keyboard.press('Escape');
      await expect(fenster).toBeVisible();
      await expect(feld).toHaveValue('');
      await expect(feld).toBeFocused();
      await nichtsGeschrieben(page, k, vorher, '54B-3');
      await page.keyboard.press('Escape');
      await fensterIstZu(page);
      await nichtsGeschrieben(page, k, vorher, '54B-3, zweites Esc');
    });
  }

  for (const [weg, taste] of [['Strg+Enter', 'Control+Enter'], ['Verlassen des Felds', 'Tab']]) {
    test(`54B-4: Gegenprobe — ${weg} speichert die Beschreibung wie bisher, ein Commit`, async ({ page }) => {
      await beschreibungBearbeiten(page);
      const commits = Number(k.git('rev-list', '--count', 'HEAD'));
      await page.keyboard.type(' und mehr');
      await page.keyboard.press(taste);
      await expect(page.locator(BESCHREIBUNG_LESEN)).toHaveText('Erster Absatz und mehr');
      await expect.poll(() => k.lies(DATEI_1)).toContain('Erster Absatz und mehr');
      await expect.poll(() => Number(k.git('rev-list', '--count', 'HEAD'))).toBe(commits + 1);
      expect(k.lies(DATEI_2)).toBe('---\nid: 2\ntitle: Zweite Aufgabe\n---\n');
    });
  }
});
