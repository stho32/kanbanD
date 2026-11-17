// E2E R00191 (I0181, Karte #192): ein Klick aus einem Datumsfeld heraus trifft sein Ziel, und ein vorgemerkter Fokus überholt
// den Menschen nicht (ADR-0010 N10 Ziffern 2 und 3). Getippt wird Taste für Taste (`keyboard.type`, nie `fill()`); geklickt
// wird mit `mouse.down`, zwei Bildern und `mouse.up`, weil `click()` die Taste nicht hält (Gelerntes R00179). Gewartet wird
// auf Zustand (ADR-0026): auf die angekommene Antwort, den Commit im Verlauf und das angekommene Live-Ereignis — nie auf
// den Renderzähler.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen, mutanteEinsetzen } = require('./hilfen');
const { GRUNDBESTAND, DATEI_1, fensterOeffnen } = require('./r00155-hilfen');

const BOARD = 'boards/entwicklung.md';
const EINS = 'aufgaben/0001-eins.md';
const SPALTEN = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n';
const GESPEICHERT = '2026-11-12';
const kopf = (titel, mehr = '') => `---\nid: 1\ntitle: ${titel}\n${mehr}---\n`;
const VERZOEGERUNG_MS = 500;

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/* ── Testsprache ── */
const filtergruppe = page => page.getByRole('group', { name: 'Berichtsfilter' });
const vonFeld = page => filtergruppe(page).getByLabel('Zeitraum von', { exact: true });
const bisFeld = page => filtergruppe(page).getByLabel('Zeitraum bis', { exact: true });
/** Zwei Bilder: was eine Taste oder ein Zeiger auslöst — auch ein Zeichnen im nächsten Zug —, ist danach geschehen. */
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
const speicherungen = () => k.git('log', '--format=%h', '-G', '\\bfrom:', '--', BOARD).split('\n').filter(Boolean).length;
const imVerlauf = vorher => expect.poll(() => speicherungen() - vorher).toBeGreaterThanOrEqual(1);
const gespeichertAm = tag => new RegExp(`\\bfrom: ${tag}\\b`);

/** Der geöffnete Durchsatz mit `report-filter: {period: eigen, from: 2026-11-12}`; liefert „Zeitraum von“. */
async function durchsatzOeffnen(page) {
  k = await kanbanStarten(einrichten({ [BOARD]: `---\nreport-filter: {period: eigen, from: ${GESPEICHERT}}\n---\n` + SPALTEN, [EINS]: kopf('eins') }));
  await mutanteEinsetzen(page);
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/berichte/durchsatz');
  await filterOeffnen(page);
  await expect(vonFeld(page)).toHaveValue(GESPEICHERT);
  return vonFeld(page);
}
async function tippen(page, feld, ziffern) {
  await feld.focus();
  await page.keyboard.type(ziffern, { delay: 120 });
}
const weitertippen = (page, ziffern) => page.keyboard.type(ziffern, { delay: 120 });
/** Ein Klick wie von einer Hand: drücken, `waehrenddessen` (zwei Bilder, wenn nichts), loslassen. */
async function klickAuf(page, ziel, waehrenddessen = () => zweiBilder(page)) {
  await zeigerAuf(page, ziel);
  await page.mouse.down();
  await waehrenddessen();
  await page.mouse.up();
}
/** Führt den Zeiger über `ziel`, sobald es steht. */
async function zeigerAuf(page, ziel) {
  // erst, wenn das Ziel steht: ein Zeichnen kurz davor ersetzt es, und das ersetzte hat keinen Kasten mehr
  let kasten = null;
  await expect.poll(async () => { kasten = await ziel.boundingBox(); return kasten; }).not.toBeNull();
  await page.mouse.move(kasten.x + Math.min(12, kasten.width / 2), kasten.y + kasten.height / 2);
}
/** Die Antwort auf das Speichern des Berichtsfilters kommt `VERZOEGERUNG_MS` später; liefert, wann sie angekommen ist. */
async function filterAntwortBremsen(page) {
  await page.route(url => url.pathname.endsWith('/berichtsfilter'), async route => {
    const antwort = await route.fetch();
    await new Promise(weiter => setTimeout(weiter, VERZOEGERUNG_MS));
    await route.fulfill({ response: antwort });
  });
  return () => page.waitForResponse(antwort => antwort.url().endsWith('/berichtsfilter') && antwort.request().method() === 'PUT');
}
/** Ein Commit im Ordner, der nicht aus dieser Seite kommt: der Agent benennt #1 und das Board um. Fertig, wenn sein
 *  Live-Ereignis in der Seite angekommen ist (der geladene Stand trägt ihn); liefert den Commit. */
async function fremdeAenderung(page) {
  k.schreib(EINS, kopf('eins umbenannt'));
  k.schreib(BOARD, k.lies(BOARD).replace('# Entwicklung\n', '# Entwicklung fremd\n'));
  k.git('add', '-A');
  k.git('-c', 'user.name=Agent', '-c', 'user.email=a@a', 'commit', '-q', '-m', 'fremd');
  await page.waitForFunction(() => window.kdTest.titel(1) === 'eins umbenannt');
  return k.git('rev-parse', 'HEAD');
}
/** Die Seite zeigt die fremde Änderung: der Kopf nennt das umbenannte Board. */
const zeigtDieFremdeAenderung = page => expect(page.locator('#kopf')).toContainText('Entwicklung fremd');

/* ── AK 1, AK 2, US-1: aus dem fertig getippten Datum in ein anderes Feld oder aufs Menü ── */
test.describe('R00191 AK 1, AK 2, US-1: Klick aus dem Datumsfeld trifft sein Ziel', () => {
  test('AK 1, US-1: „3112“ und „2026“ in „Zeitraum von“ getippt, Klick in „Zeitraum bis“ → „from: 2026-12-31“, Fokus in „Zeitraum bis“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);
    const vorher = speicherungen();

    await tippen(page, von, '3112');
    await weitertippen(page, '2026');
    await klickAuf(page, bisFeld(page));

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
    await imVerlauf(vorher);
    await bereit(page);
    await zweiBilder(page);
    await expect(bisFeld(page)).toBeFocused();
    await expect(vonFeld(page)).toHaveValue('2026-12-31');
  });

  test('AK 1: wie AK 1, die Antwort auf das Speichern kommt, während die Maustaste in „Zeitraum bis“ noch gedrückt ist → Fokus in „Zeitraum bis“, „from: 2026-12-31“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);
    const antwort = await filterAntwortBremsen(page);
    const vorher = speicherungen();

    await tippen(page, von, '3112');
    const angekommen = antwort();
    await weitertippen(page, '2026');
    await klickAuf(page, bisFeld(page), async () => { await angekommen; await imVerlauf(vorher); await zweiBilder(page); });

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
    await bereit(page);
    await zweiBilder(page);
    await expect(bisFeld(page)).toBeFocused();
  });

  test('AK 2, US-1: „3112“ und „2026“ in „Zeitraum von“ getippt, ein Klick auf „Berichte“ → das Menü ist offen, „from: 2026-12-31“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);
    const vorher = speicherungen();

    await tippen(page, von, '3112');
    await weitertippen(page, '2026');
    await klickAuf(page, page.locator('#t-ber'));

    await expect(page.locator('#pop').getByRole('menuitem').first()).toBeVisible();
    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
    await imVerlauf(vorher);
  });

  test('AK 2: wie AK 2, die Antwort auf das Speichern kommt, während die Maustaste auf „Berichte“ noch gedrückt ist → das Menü ist nach diesem einen Klick offen', async ({ page }) => {
    const von = await durchsatzOeffnen(page);
    const antwort = await filterAntwortBremsen(page);
    const vorher = speicherungen();

    await tippen(page, von, '3112');
    const angekommen = antwort();
    await weitertippen(page, '2026');
    await klickAuf(page, page.locator('#t-ber'), async () => { await angekommen; await imVerlauf(vorher); await zweiBilder(page); });

    await expect(page.locator('#pop').getByRole('menuitem').first()).toBeVisible();
    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
  });
});

/* ── AK 3, AK 6, US-2: ein gehaltenes Datum, dann Klick — das Speichern beim Verlassen zeichnet erst nach der Geste ── */
test.describe('R00191 AK 3, AK 6, US-2: gehaltenes Datum, dann Klick ins andere Feld', () => {
  // AK 3 (geändert 2026-11-17): eine Regel für jedes Verlassen wie in R00173 — ein gehaltenes fertiges Datum wird gespeichert,
  // ein unfertiges (Jahr unter vier Stellen) verworfen; in beiden Fällen trifft der Klick sein Ziel.
  test('AK 3, US-2: „31122“ in „Zeitraum von“ getippt (Jahr 0002, unfertig), Klick in „Zeitraum bis“ → „Zeitraum von“ zeigt wieder 12.11.2026, nichts gespeichert, Fokus in „Zeitraum bis“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);
    const kopfVorher = k.git('rev-parse', 'HEAD');

    await tippen(page, von, '31122');
    await klickAuf(page, bisFeld(page));

    await expect(vonFeld(page)).toHaveValue(GESPEICHERT);
    await bereit(page);
    await zweiBilder(page);
    await expect(bisFeld(page)).toBeFocused();
    expect(k.lies(BOARD)).toMatch(gespeichertAm(GESPEICHERT));
    expect(k.git('rev-parse', 'HEAD')).toBe(kopfVorher);
  });

  test('AK 3, US-2: „3112“ in „Zeitraum von“ getippt (gehalten), Klick in „Zeitraum bis“ → „from: 2026-12-31“ gespeichert (gehalten und fertig, wie in R00173), der Fokus steht in „Zeitraum bis“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);
    const vorher = speicherungen();

    await tippen(page, von, '3112');
    await klickAuf(page, bisFeld(page));

    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
    await imVerlauf(vorher);
    await bereit(page);
    await zweiBilder(page);
    await expect(bisFeld(page)).toBeFocused();
    expect(speicherungen() - vorher).toBe(1);
  });

  test('AK 3, AK 2: „3112“ in „Zeitraum von“ getippt (gehalten), ein Klick auf „Berichte“ → das Menü ist nach diesem einen Klick offen, „from: 2026-12-31“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);

    await tippen(page, von, '3112');
    await klickAuf(page, page.locator('#t-ber'));

    await expect(page.locator('#pop').getByRole('menuitem').first()).toBeVisible();
    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
  });

  test('AK 6: „3112“ getippt, fremde Änderung trifft ein, Klick in „Zeitraum bis“ → nach dem Loslassen zeigt die Seite die fremde Änderung, „from: 2026-12-31“, Fokus in „Zeitraum bis“', async ({ page }) => {
    const von = await durchsatzOeffnen(page);

    await tippen(page, von, '3112');
    const fremd = await fremdeAenderung(page);
    await klickAuf(page, bisFeld(page));

    await zeigtDieFremdeAenderung(page);
    await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
    await expect.poll(() => k.git('rev-list', '--count', fremd + '..HEAD')).toBe('1');
    await bereit(page);
    await zweiBilder(page);
    await expect(bisFeld(page)).toBeFocused();
  });
});

/* ── Nacharbeit Review #192: der Aufschub der Zeigergeste bleibt nie hängen, auch wenn kein Loslassen ankommt ── */
test.describe('R00191 AK 6, Nacharbeit: Zeigerdruck aus dem Datumsfeld ohne Loslassen', () => {
  const OHNE_LOSLASSEN = {
    // Rechtsklick: das Kontextmenü des Browsers schluckt das Loslassen
    'Rechtsklick (Kontextmenü)': async (page, ziel) => {
      await zeigerAuf(page, ziel);
      await page.mouse.down({ button: 'right' });
    },
    // Fensterwechsel mit gedrückter Taste: das Fenster verliert den Fokus, das Loslassen kommt woanders an
    'Taste gedrückt, das Fenster verliert den Fokus': async (page, ziel) => {
      await zeigerAuf(page, ziel);
      await page.mouse.down();
      await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    },
  };
  for (const [wie, druecken] of Object.entries(OHNE_LOSLASSEN)) {
    test(`Fokus in „Zeitraum von“, ${wie} auf der Kopfzeile des Berichts, kein Loslassen, dann fremde Änderung → die Seite zeigt sie`, async ({ page }) => {
      const von = await durchsatzOeffnen(page);
      await von.focus();

      await druecken(page, page.locator('.leiste b', { hasText: 'Durchsatz je Zeitraum' }));
      await zweiBilder(page);
      await fremdeAenderung(page);

      await zeigtDieFremdeAenderung(page);
    });
  }
});

/* ── AK 5, US-2: eine allein gedrückte Modifikatortaste beendet die Eingabe nicht ── */
test.describe('R00191 AK 5, US-2: Strg, Alt oder Meta allein zwischen den Ziffern', () => {
  for (const taste of ['Control', 'Alt', 'Meta']) {
    test(`AK 5, US-2: „3112“, ${taste} einzeln gedrückt und losgelassen, fremde Änderung trifft ein, „2026“ → Feld 31.12.2026, „from: 2026-12-31“`, async ({ page }) => {
      const von = await durchsatzOeffnen(page);
      const vorher = speicherungen();

      await tippen(page, von, '3112');
      await page.keyboard.press(taste);
      await fremdeAenderung(page);
      await weitertippen(page, '2026');

      await expect.poll(() => k.lies(BOARD)).toMatch(gespeichertAm('2026-12-31'));
      await imVerlauf(vorher);
      await expect(von).toHaveValue('2026-12-31');
      await expect(von).toBeFocused();
      await zeigtDieFremdeAenderung(page);
    });
  }
});

/* ── AK 4, US-3: der vorgemerkte Fokus „Stift“ überholt den Menschen nicht ── */
test.describe('R00191 AK 4, US-3: nach dem Speichern der Beschreibung ins Kommentarfeld', () => {
  const STIFT = '#fenster button[data-act="beschreibung-bearbeiten"]';
  const KOMMENTARFELD = '#fenster #km-inp';

  /** Aufgabenfenster von #1, Beschreibung über den Stift in Bearbeitung, „ Zusatz“ angehängt; die Antwort auf das Speichern
   *  kommt `VERZOEGERUNG_MS` später. Liefert `angekommen`: wann sie da ist. */
  async function beschreibungBearbeitet(page) {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await mutanteEinsetzen(page);
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await expect(page.locator('.ka[data-id="2"]')).toBeVisible();
    await fensterOeffnen(page, 1);
    // der Stift ist sichtbar, solange der Zeiger auf der Lesefläche liegt (R00162)
    await page.locator('#fenster .besch-lesen').hover();
    await page.locator(STIFT).click();
    await expect(page.locator('#fenster #beschreibung')).toBeFocused();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' Zusatz');
    await page.route(url => url.pathname === '/api/aufgaben/1', async route => {
      if (route.request().method() !== 'PATCH') return route.fallback();
      const antwort = await route.fetch();
      await new Promise(weiter => setTimeout(weiter, VERZOEGERUNG_MS));
      await route.fulfill({ response: antwort });
    });
    // in einer Hülle: ein zurückgegebenes Promise würde das `await` des Aufrufers schon hier abwarten
    return { angekommen: page.waitForResponse(antwort => new URL(antwort.url()).pathname === '/api/aufgaben/1' && antwort.request().method() === 'PATCH') };
  }
  async function gespeichertUndGezeichnet(page, angekommen) {
    await angekommen;
    await expect.poll(() => k.lies(DATEI_1)).toContain('Erster Absatz Zusatz');
    await bereit(page);
    await zweiBilder(page);
  }

  test('AK 4, US-3: Strg+Enter, dann Klick ins Kommentarfeld, Antwort 500 ms verzögert → der Fokus bleibt im Kommentarfeld', async ({ page }) => {
    const { angekommen } = await beschreibungBearbeitet(page);

    await page.keyboard.press('Control+Enter');
    await klickAuf(page, page.locator(KOMMENTARFELD));
    await expect(page.locator(KOMMENTARFELD)).toBeFocused();
    await gespeichertUndGezeichnet(page, angekommen);

    await expect(page.locator(KOMMENTARFELD)).toBeFocused();
  });

  test('AK 4, Gegenprobe (R00162 AK 7): Strg+Enter ohne Klick, Antwort 500 ms verzögert → nach der Antwort steht der Fokus auf dem Stift', async ({ page }) => {
    const { angekommen } = await beschreibungBearbeitet(page);

    await page.keyboard.press('Control+Enter');
    await gespeichertUndGezeichnet(page, angekommen);

    await expect(page.locator(STIFT)).toBeFocused();
  });
});
