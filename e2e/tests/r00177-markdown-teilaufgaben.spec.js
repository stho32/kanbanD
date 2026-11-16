// R00177 (Karte #185, I0167): im Text einer Teilaufgabe des Aufgabenfensters werden Links, fett, kursiv und Code
// formatiert (ADR-0030). Der Link ist klickbar, ohne das Bearbeiten auszulösen; der Text ist kein Knopf mehr, für die
// Tastatur trägt jede Zeile einen Stift. Zeichnung: D0003 `#markdown-elemente`.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { GRUNDBESTAND, fensterOeffnen } = require('./r00155-hilfen');

const PROBE = 'siehe https://example.org und **wichtig**';
const DATEI_1 = 'aufgaben/0001-abnahme-pruefen.md';
/** Ausgangslage der User Story: #1 mit der Abnahme-Probe der Karte und `# kein Titel`. */
const BESTAND = {
  ...GRUNDBESTAND,
  [DATEI_1]: `---\nid: 1\ntitle: Abnahme prüfen\n---\n\n- [ ] ${PROBE}\n- [ ] # kein Titel\n- [x] erledigt mit [Doku](https://example.org/doku) und \`code\`\n`,
};
const ZEILE = '#fenster .chk[data-teil]';
/** Der Text der Zeile: der einzige `span` darin, nach der Zeichnung `span.teil-text`. */
const TEXT = `${ZEILE} > span`;

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/** Startet kanbanD mit dem Bestand; fremde Adressen beantwortet der Test selbst, nichts geht ins Netz. */
async function starten(page, bestand = BESTAND) {
  k = await kanbanStarten(einrichten(bestand));
  await page.context().route(/^https?:\/\/example\.org\//, route => route.fulfill({ contentType: 'text/html', body: '<title>Ziel</title>Ziel' }));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="2"]')).toBeVisible();
}

test('US-1, AK 1 Abnahme-Probe der Karte: die Adresse ist ein Link in neuem Fenster, „wichtig“ fett; `# kein Titel` bleibt Text', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);

  const erste = page.locator(TEXT).nth(0);
  await expect(erste).toHaveText('siehe https://example.org und wichtig');
  await expect(erste).toHaveClass('teil-text');
  const link = erste.locator('a');
  await expect(link).toHaveText('https://example.org');
  await expect(link).toHaveAttribute('href', 'https://example.org');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  await expect(erste.locator('strong')).toHaveText('wichtig');
  expect(await erste.locator('strong').evaluate(element => Number(getComputedStyle(element).fontWeight))).toBeGreaterThanOrEqual(600);

  // AK 2: ein Block entsteht in einer Teilaufgabe nie
  await expect(page.locator(TEXT).nth(1)).toHaveText('# kein Titel');
  await expect(page.locator(`${ZEILE} :is(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,table,pre)`)).toHaveCount(0);
});

const STIFT = `${ZEILE} .teil-stift`;
const FELD = '#teil-edit';
const stift = (page, stelle) => page.locator(`#fenster .chk[data-teil="${stelle}"] .teil-stift`);
const commits = () => Number(k.git('rev-list', '--count', 'HEAD'));
/** Jede schreibende Anfrage ab jetzt — „nichts geschrieben“ heißt: die Liste bleibt leer. */
function schreibendeAnfragen(page) {
  const schreibend = [];
  page.on('request', anfrage => { if (anfrage.method() !== 'GET') schreibend.push(`${anfrage.method()} ${new URL(anfrage.url()).pathname}`); });
  return schreibend;
}

test.describe('AK 3, Schaden (d): Klick auf den Link folgt dem Link — kein Bearbeiten, kein Abhaken, nichts geschrieben', () => {
  for (const [wie, klick] of [['Klick', {}], ['Strg+Klick', { modifiers: ['Control'] }], ['Mittelklick', { button: 'middle' }]]) {
    test(`US-1: ${wie} auf die Adresse öffnet sie in einem neuen Fenster, die Zeile bleibt in der Lesesicht`, async ({ page }) => {
      await starten(page);
      const fenster = await fensterOeffnen(page, 1);
      const schreibend = schreibendeAnfragen(page);
      const vorher = [k.lies(DATEI_1), commits(), page.url()];
      const link = page.locator(TEXT).nth(0).locator('a');
      await expect(link).toBeVisible();

      const [neueSeite] = await Promise.all([page.context().waitForEvent('page'), link.click(klick)]);
      await neueSeite.waitForLoadState();
      expect(neueSeite.url()).toBe('https://example.org/');
      expect(await neueSeite.evaluate(() => window.opener), 'rel=noopener: das neue Fenster kennt seinen Öffner nicht').toBeNull();

      await expect(fenster).toBeVisible();
      await expect(page.locator(FELD)).toHaveCount(0);
      await expect(page.locator(TEXT).nth(0)).toHaveText('siehe https://example.org und wichtig');
      await expect(fenster.getByRole('checkbox', { name: PROBE, exact: true })).toHaveAttribute('aria-checked', 'false');
      expect(schreibend).toEqual([]);
      expect([k.lies(DATEI_1), commits(), page.url()], 'Datei, Commits und die Adresse der Seite selbst bleiben').toEqual(vorher);
    });
  }
});

test('US-2, AK 3, AK 4: Klick neben den Link öffnet das Textfeld mit dem Rohtext; nach Esc steht der Fokus auf dem Stift der Zeile, Enter dort öffnet wieder', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);
  const schreibend = schreibendeAnfragen(page);

  await page.locator(TEXT).nth(0).click({ position: { x: 6, y: 6 } }); // auf „siehe“
  await expect(page.locator(FELD)).toBeFocused();
  await expect(page.locator(FELD)).toHaveValue(PROBE);
  await page.keyboard.press('Escape');
  await expect(page.locator(FELD)).toHaveCount(0);
  await expect(stift(page, 0)).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page.locator(FELD)).toBeFocused();
  await expect(page.locator(FELD)).toHaveValue(PROBE);
  await page.keyboard.press('Escape');
  await expect(stift(page, 0)).toBeFocused();
  await expect(page.locator(TEXT).nth(0).locator('a')).toHaveAttribute('href', 'https://example.org');
  expect(schreibend).toEqual([]);
  expect(k.lies(DATEI_1)).toBe(BESTAND[DATEI_1]);
});

test('AK 4: nur Tastatur — Tab führt vom Link zum Stift zum ✕; der Text selbst hat weder Rolle noch Tab-Halt', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);
  const zeile = page.locator(ZEILE).nth(0);
  const text = zeile.locator('.teil-text');
  await expect(text).toBeVisible();
  expect(await text.evaluate(element => [element.getAttribute('role'), element.getAttribute('tabindex'), element.tabIndex])).toEqual([null, null, -1]);
  await expect(page.locator('#fenster').getByRole('button', { name: PROBE, exact: true })).toHaveCount(0);

  await zeile.locator('a').focus();
  await page.keyboard.press('Tab');
  await expect(stift(page, 0)).toBeFocused();
  await expect(stift(page, 0)).toHaveAttribute('type', 'button');
  await expect(stift(page, 0)).toHaveAttribute('title', 'Text bearbeiten');
  expect(await stift(page, 0).evaluate(knopf => getComputedStyle(knopf, '::before').content), 'das Zeichen des Stifts').toBe('"✎"');
  await expect(zeile, 'der Text der Zeile bleibt Text und ✕').toHaveText('siehe https://example.org und wichtig✕');
  await expect(stift(page, 0)).toHaveAccessibleName('Teilaufgabe bearbeiten: siehe https://example.org und wichtig');
  await page.keyboard.press('Tab');
  await expect(zeile.locator('.x')).toBeFocused();
  await page.keyboard.press('Tab');
  // Seit R00180 ist das Kästchen ein Tab-Halt: es liegt zwischen dem ✕ dieser Zeile und dem Stift der nächsten
  await expect(page.locator(ZEILE).nth(1).getByRole('checkbox')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(stift(page, 1), 'die Zeile ohne Link: nach dem Kästchen folgt direkt der Stift').toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(stift(page, 0)).toBeFocused();

  await page.keyboard.press(' ');
  await expect(page.locator(FELD)).toBeFocused();
  await expect(page.locator(FELD)).toHaveValue(PROBE);
  // Solange das Feld offen ist, trägt die Zeile keinen Stift.
  await expect(stift(page, 0)).toHaveCount(0);
});

test('Schaden (c): bearbeitet wird der Rohtext — ein angehängtes Zeichen, Enter: die Datei trägt den Rohtext plus das Zeichen, der Fokus steht auf dem Stift', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);
  const vorher = commits();
  await stift(page, 0).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator(FELD)).toHaveValue(PROBE);
  await page.keyboard.press('End');
  await page.keyboard.type('!');
  await page.keyboard.press('Enter');

  await expect(page.locator(FELD)).toHaveCount(0);
  await expect(stift(page, 0)).toBeFocused();
  await expect.poll(() => k.lies(DATEI_1)).toBe(BESTAND[DATEI_1].replace(PROBE, PROBE + '!'));
  await expect.poll(commits).toBe(vorher + 1);
  await expect(page.locator(TEXT).nth(0)).toHaveText('siehe https://example.org und wichtig!');
  await expect(page.locator(TEXT).nth(0).locator('strong')).toHaveText('wichtig');

  // Die erledigte Zeile mit Link und Code: geöffnet steht ihr Rohtext im Feld, Verlassen ohne Änderung schreibt nichts.
  const erledigtRoh = 'erledigt mit [Doku](https://example.org/doku) und `code`';
  await page.locator(TEXT).nth(2).click({ position: { x: 6, y: 6 } });
  await expect(page.locator(FELD)).toHaveValue(erledigtRoh);
  await page.locator('#teil-neu').click();
  await expect(page.locator(FELD)).toHaveCount(0);
  await expect(page.locator(TEXT).nth(2).locator('a')).toHaveAttribute('href', 'https://example.org/doku');
  expect(k.lies(DATEI_1)).toContain(`- [x] ${erledigtRoh}\n`);
  expect(commits()).toBe(vorher + 1);
});

test('AK 5: im Aufgabenfenster liegt kein Link in einem Knopf', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);
  await expect(page.locator(`${ZEILE} a`)).toHaveCount(2);
  await expect(page.locator('#fenster :is(button, [role="button"]) a')).toHaveCount(0);
  await expect(page.locator('#fenster a :is(button, [role="button"])')).toHaveCount(0);
});

test('US-3, AK 6, Schaden (e): die Karte auf dem Board und der Dialog „Neue Aufgabe“ zeigen Rohtext', async ({ page }) => {
  await starten(page);
  const leiste = page.locator('.ka[data-id="1"] .naechste');
  await expect(leiste.locator('span')).toHaveText(PROBE);
  await expect(leiste.locator('a, strong, em, code')).toHaveCount(0);
  await expect(leiste.getByRole('checkbox')).toHaveAccessibleName(`${PROBE} abhaken`);

  await page.getByRole('button', { name: '+ Neue Aufgabe' }).click();
  await page.locator('#neu-teil').fill(PROBE);
  await page.locator('#neu-teil').press('Enter');
  const neueZeile = page.locator('#neu-teil').locator('xpath=preceding-sibling::div[contains(@class,"chk")]');
  await expect(neueZeile.locator('span')).toHaveText(PROBE);
  await expect(neueZeile.locator('a, strong, em, code, .teil-stift')).toHaveCount(0);
});

test.describe('AK 6: Abhaken, Löschen und Umsortieren wirken wie heute', () => {
  test('das Kästchen hakt ab, der Link bleibt ein Link; ✕ entfernt die Zeile', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1);
    await fenster.getByRole('checkbox', { name: PROBE, exact: true }).click();
    await expect.poll(() => k.lies(DATEI_1)).toContain(`- [x] ${PROBE}\n`);
    await expect(page.locator(FELD)).toHaveCount(0);
    await expect(page.locator(`${ZEILE}.ok`).nth(0).locator('a')).toHaveAttribute('href', 'https://example.org');

    await fenster.getByLabel('Teilaufgabe # kein Titel entfernen').click();
    await expect(page.locator(TEXT)).toHaveCount(2);
    await expect.poll(() => k.lies(DATEI_1)).not.toContain('# kein Titel');
  });

  for (const [woran, griff] of [['am Text', zeile => zeile.locator('.teil-text')], ['am Link', zeile => zeile.locator('.teil-text a')]]) {
    test(`Ziehen ${woran} angefasst ordnet um: die dritte Zeile vor die erste`, async ({ page }) => {
      await starten(page);
      await fensterOeffnen(page, 1);
      const schreibend = schreibendeAnfragen(page);
      const seiten = page.context().pages().length;
      await griff(page.locator(ZEILE).nth(2)).dragTo(page.locator(ZEILE).nth(0), { targetPosition: { x: 40, y: 3 } });

      await expect(page.locator(TEXT)).toHaveText(['erledigt mit Doku und code', 'siehe https://example.org und wichtig', '# kein Titel']);
      await expect.poll(() => k.lies(DATEI_1)).toContain(`- [x] erledigt mit [Doku](https://example.org/doku) und \`code\`\n- [ ] ${PROBE}\n- [ ] # kein Titel\n`);
      await expect(page.locator(FELD), 'das Ziehen bearbeitet nicht').toHaveCount(0);
      expect(page.context().pages().length, 'das Ziehen folgt keinem Link').toBe(seiten);
      expect(schreibend).toEqual(['PATCH /api/aufgaben/1/teilaufgaben/2']);
    });
  }
});

test('Schaden (b): der Name des Stifts trägt den Text ohne Markdown-Zeichen und nie HTML aus dem Text in ein Attribut', async ({ page }) => {
  const FEINDLICH = 'x" onfocus="document.title=1" autofocus <b>k</b> [L](https://example.org/?a="1"&b=<2>) **fett** `c` >';
  await starten(page, { ...BESTAND, [DATEI_1]: `---\nid: 1\ntitle: Abnahme prüfen\n---\n\n- [ ] ${FEINDLICH}\n- [ ] [Doku](https://example.org/doku) *lesen*, dann \`--probe\` setzen\n` });
  let dialoge = 0;
  page.on('dialog', dialog => { dialoge++; dialog.dismiss(); });
  const fenster = await fensterOeffnen(page, 1);

  await expect(stift(page, 0)).toHaveAttribute('aria-label', 'Teilaufgabe bearbeiten: x" onfocus="document.title=1" autofocus <b>k</b> L fett c >');
  await expect(stift(page, 1)).toHaveAccessibleName('Teilaufgabe bearbeiten: Doku lesen, dann --probe setzen');
  // Kästchen und ✕ nennen den Text wie heute: roh, als Text im Attribut.
  await expect(fenster.getByRole('checkbox').nth(0)).toHaveAttribute('aria-label', FEINDLICH);
  await expect(page.locator(`${ZEILE} .x`).nth(0)).toHaveAttribute('aria-label', `Teilaufgabe ${FEINDLICH} entfernen`);

  const attribute = element => element.getAttributeNames().sort();
  expect(await stift(page, 0).evaluate(attribute)).toEqual(['aria-label', 'class', 'data-act', 'data-arg', 'data-halt', 'data-ort', 'title', 'type']);
  expect(await page.locator(TEXT).nth(0).evaluate(attribute)).toEqual(['class', 'data-act', 'data-arg']);
  expect(await page.locator(TEXT).nth(0).locator('a').evaluate(attribute)).toEqual(['href', 'rel', 'target']);
  await expect(page.locator(TEXT).nth(0).locator('a')).toHaveAttribute('href', 'https://example.org/?a="1"&b=<2>');
  await expect(page.locator(TEXT).nth(0)).toHaveText('x" onfocus="document.title=1" autofocus <b>k</b> L fett c >');
  await expect(page.locator('#fenster .chk b')).toHaveCount(0);
  await expect(page.locator('#fenster [onfocus], #fenster [autofocus]')).toHaveCount(0);
  expect(await page.title()).not.toBe('1');
  expect(dialoge).toBe(0);
});

/** Wie der Stift einer Zeile gerade gezeichnet ist — verborgen nur über Deckkraft und Zeiger, nie über visibility oder display. */
function zeichnung(page, stelle) {
  return stift(page, stelle).evaluate(knopf => {
    const stil = getComputedStyle(knopf);
    return { deckkraft: Number(stil.opacity), zeiger: stil.pointerEvents, sichtbar: stil.visibility, gezeichnet: stil.display !== 'none' };
  });
}
const SO = (deckkraft, zeiger) => ({ deckkraft, zeiger, sichtbar: 'visible', gezeichnet: true });

test.describe('Gestaltung nach D0003 `#markdown-elemente`', () => {
  test('Stift: in Ruhe unsichtbar, Zeiger auf der Zeile halb, auf dem Stift und bei Fokus voll; 24 px; ein Klick öffnet das Textfeld', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await expect(stift(page, 0)).toBeAttached();
    await page.locator('#fenster .mod-kopf').hover({ position: { x: 5, y: 5 } });
    // In Ruhe unsichtbar, aber weiter ein Ziel des Zeigers: die Messprobe der Ziele (ADR-0012) verlangt, dass jedes Ziel trifft.
    await expect.poll(() => zeichnung(page, 0), 'Ruhe').toEqual(SO(0, 'auto'));

    await page.locator(TEXT).nth(0).hover({ position: { x: 6, y: 6 } });
    await expect.poll(() => zeichnung(page, 0), 'Zeiger auf der Zeile').toEqual(SO(0.5, 'auto'));
    expect(await zeichnung(page, 1), 'nur der Stift der gezeigten Zeile').toEqual(SO(0, 'auto'));
    const kasten = await stift(page, 0).boundingBox();
    expect([kasten.width, kasten.height]).toEqual([24, 24]);

    await stift(page, 0).hover();
    await expect.poll(() => zeichnung(page, 0), 'Zeiger auf dem Stift').toEqual(SO(1, 'auto'));
    await page.locator('#fenster .mod-kopf').hover({ position: { x: 5, y: 5 } });
    await stift(page, 1).focus();
    await expect.poll(() => zeichnung(page, 1), 'Fokus ohne Zeiger').toEqual(SO(1, 'auto'));

    await page.locator(TEXT).nth(0).hover({ position: { x: 6, y: 6 } });
    await stift(page, 0).click();
    await expect(page.locator(FELD)).toBeFocused();
    await expect(page.locator(FELD)).toHaveValue(PROBE);
  });

  test('Link gegen Text: der Link ist dauerhaft unterstrichen mit Zeigehand, der Text daneben trägt die Schreibmarke; erledigt bleibt der Link erkennbar', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    const stil = (ort, eigenschaft) => ort.evaluate((element, name) => getComputedStyle(element)[name], eigenschaft);
    const offen = page.locator(TEXT).nth(0), erledigt = page.locator(TEXT).nth(2);
    await expect(offen.locator('a')).toBeVisible();
    expect(await stil(offen, 'cursor')).toBe('text');
    expect(await stil(offen.locator('a'), 'cursor')).toBe('pointer');
    expect(await stil(offen.locator('a'), 'textDecorationLine')).toBe('underline');

    // Erledigt: Text gedämpft und durchgestrichen wie heute; der Link behält seine Farbe und seine eigene Linie.
    expect(await stil(erledigt, 'textDecorationLine')).toBe('line-through');
    expect(await stil(erledigt.locator('a'), 'textDecorationLine')).toBe('underline');
    expect(await stil(erledigt.locator('a'), 'color')).toBe(await stil(offen.locator('a'), 'color'));
    expect(await stil(erledigt.locator('a'), 'color')).not.toBe(await stil(erledigt, 'color'));
    const ohneLeerraum = schriften => schriften.replace(/\s*,\s*/g, ',');
    expect(ohneLeerraum(await stil(erledigt.locator('code'), 'fontFamily'))).toBe(ohneLeerraum(await page.locator('#fenster').evaluate(fenster => getComputedStyle(fenster).getPropertyValue('--kd-mono').trim())));
  });

  test.describe('Touch (kein Hover, grober Zeiger), 375 px', () => {
    test.use({ viewport: { width: 375, height: 800 }, isMobile: true, hasTouch: true });

    test('der Stift ist dauerhaft halb sichtbar, mindestens 44 px groß und ragt nicht aus dem Fenster; ein Tipp öffnet das Textfeld, ein Tipp auf den Link bearbeitet nicht', async ({ page }) => {
      await starten(page);
      await fensterOeffnen(page, 1, true);
      await expect(stift(page, 0)).toBeVisible();
      await expect.poll(() => zeichnung(page, 0), 'ohne Hover').toEqual(SO(0.5, 'auto'));
      const kasten = await stift(page, 0).boundingBox();
      expect(kasten.width).toBeGreaterThanOrEqual(44);
      expect(kasten.height).toBeGreaterThanOrEqual(44);
      const fenster = await page.locator('#fenster').boundingBox();
      const zeile = await page.locator(ZEILE).nth(0).boundingBox();
      expect(zeile.x + zeile.width, 'nichts ragt aus dem Fenster').toBeLessThanOrEqual(fenster.x + fenster.width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), 'die Seite scrollt nicht quer').toBeLessThanOrEqual(375);

      const [neueSeite] = await Promise.all([page.context().waitForEvent('page'), page.locator(TEXT).nth(0).locator('a').tap()]);
      await neueSeite.close();
      await expect(page.locator(FELD)).toHaveCount(0);

      await stift(page, 0).tap();
      await expect(page.locator(FELD)).toBeFocused();
      await expect(page.locator(FELD)).toHaveValue(PROBE);
    });
  });
});
