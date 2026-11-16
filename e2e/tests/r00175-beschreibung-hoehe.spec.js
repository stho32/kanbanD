// R00175 (Karte #183, I0165): das Textfeld der Beschreibung öffnet in der Höhe seines Inhalts, wächst beim Tippen bis 60 %
// des sichtbaren Bereichs und scrollt danach in sich; von Hand gezogen bleibt gezogen. Gleich im Dialog „Neue Aufgabe“.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, breiteSetzen } = require('./hilfen');
const { GRUNDBESTAND, DATEI_1, fensterOeffnen, fremdesNeuzeichnen } = require('./r00155-hilfen');

const zeilen = anzahl => Array.from({ length: anzahl }, (_, i) => `Zeile ${i + 1}`).join('\n');
const DATEI_3 = 'aufgaben/0003-zehn-zeilen.md';
/** Ausgangslage der Anforderung: #1 mit 30 Zeilen, #2 ohne Beschreibung; dazu #3 mit 10 Zeilen (Wachsen unter der Grenze). */
const BESTAND = {
  ...GRUNDBESTAND,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  [DATEI_1]: `---\nid: 1\ntitle: Abnahme prüfen\n---\n\n${zeilen(30)}\n`,
  [DATEI_3]: `---\nid: 3\ntitle: Zehn Zeilen\n---\n\n${zeilen(10)}\n`,
};
const FELD = '#fenster #beschreibung';
const FELD_NEU = '#neu-fenster textarea[data-nf="beschreibung"]';
const LEER_HOCH = 120;
const ANTEIL = 0.6;
const FENSTER = { width: 1280, height: 900 };
const GRENZE = FENSTER.height * ANTEIL;
const TOLERANZ = 1;

let k;
test.use({ viewport: FENSTER });
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

async function starten(page) {
  k = await kanbanStarten(einrichten(BESTAND));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="3"]')).toBeVisible();
}

/** Aufgabenfenster von `nummer` im Bearbeiten der Beschreibung: über den Stift; die leere Beschreibung steht gleich als Feld da. */
async function bearbeiten(page, nummer, tippen = false) {
  await fensterOeffnen(page, nummer, tippen);
  const stift = page.locator('#fenster [data-act="beschreibung-bearbeiten"]');
  if (await stift.count()) {
    if (!tippen) await page.locator('#fenster .besch-lesen').hover();
    if (tippen) await stift.tap(); else await stift.click();
  }
  const feld = page.locator(FELD);
  await expect(feld).toBeVisible();
  return feld;
}

/**
 * Alle Maße in einem Zug: Höhe des Felds, Inhalt gegen sichtbaren Teil, Rollstand, Zeilenhöhe, Innenabstand unten; wo Überschrift und Fuß des
 * Fensters stehen; der sichtbare Bereich des Browsers.
 */
function masse(feld) {
  return feld.evaluate(f => {
    const fenster = f.closest('.mod');
    const rect = f.getBoundingClientRect();
    const fuss = fenster.querySelector('.mod-fuss').getBoundingClientRect();
    return {
      hoehe: rect.height, oben: rect.top, unten: rect.bottom,
      inhalt: f.scrollHeight, sichtbar: f.clientHeight, rollstand: f.scrollTop,
      zeile: parseFloat(getComputedStyle(f).lineHeight), innenabstandUnten: parseFloat(getComputedStyle(f).paddingBottom),
      ueberschriftOben: f.closest('.abs').querySelector('h3').getBoundingClientRect().top,
      fussOben: fuss.top, fussUnten: fuss.bottom,
      bereichOben: visualViewport.offsetTop, bereichUnten: visualViewport.offsetTop + visualViewport.height,
    };
  });
}
const zeigtAllesOhneRollen = m => m.inhalt <= m.sichtbar;
const stehtAnDerGrenze = (m, grenze) => Math.abs(m.hoehe - grenze) <= TOLERANZ && m.inhalt > m.sichtbar;
/**
 * Die letzte Textzeile liegt im sichtbaren Teil des Felds. Der Browser rollt den Cursor ins Bild, nicht den Zeilenkasten: der
 * Innenabstand darunter und der Durchschuss der Zeile (hier ein Viertel) dürfen abgeschnitten sein.
 */
const endeIstSichtbar = m => m.rollstand + m.sichtbar >= m.inhalt - m.innenabstandUnten - m.zeile / 4;

function fussErreichbar(m, wo) {
  expect(m.fussOben, `${wo}: der Fensterfuß beginnt im sichtbaren Bereich`).toBeGreaterThanOrEqual(m.bereichOben - TOLERANZ);
  expect(m.fussUnten, `${wo}: der Fensterfuß endet im sichtbaren Bereich`).toBeLessThanOrEqual(m.bereichUnten + TOLERANZ);
  expect(m.unten, `${wo}: das Feld endet über dem Fensterfuß`).toBeLessThanOrEqual(m.fussOben + TOLERANZ);
}

/** Zieht das Feld am Griff unten rechts auf `zielHoehe` px — wie ein Mensch mit der Maus. */
async function ziehenAuf(page, feld, zielHoehe) {
  await feld.evaluate(f => f.scrollIntoView({ block: 'end' }));
  const rect = await feld.boundingBox();
  const griff = { x: rect.x + rect.width - 4, y: rect.y + rect.height - 4 };
  await page.mouse.move(griff.x, griff.y);
  await page.mouse.down();
  await page.mouse.move(griff.x, griff.y + zielHoehe - rect.height, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Math.abs((await masse(feld)).hoehe - zielHoehe), `gezogen auf ${zielHoehe} px`).toBeLessThanOrEqual(2);
}

const cursor = feld => feld.evaluate(f => ({ von: f.selectionStart, bis: f.selectionEnd }));

test.describe('R00175 AK 1–3, US-1: öffnet in Inhaltshöhe, wächst bis zur Grenze', () => {
  test('AK 1, 2 (Abnahme-Probe #183): 30 Zeilen, Stift → höher als 120 px, alle Zeilen sichtbar oder an der Grenze von 540 px und scrollt; fünf weitere Zeilen: das Feld scrollt, der Fuß bleibt', async ({ page }) => {
    await starten(page);
    const feld = await bearbeiten(page, 1);

    const offen = await masse(feld);
    expect(offen.hoehe, 'höher als die 120 px von heute').toBeGreaterThan(LEER_HOCH);
    expect(zeigtAllesOhneRollen(offen) || stehtAnDerGrenze(offen, GRENZE), `alle 30 Zeilen sichtbar oder an der Grenze: ${JSON.stringify(offen)}`).toBe(true);
    expect(offen.hoehe, '30 Zeilen stehen bei 900 px Fensterhöhe an der Grenze').toBeCloseTo(GRENZE, 0);

    await feld.press('Control+End');
    await page.keyboard.type('\nEins\nZwei\nDrei\nVier\nFünf');
    const getippt = await masse(feld);
    expect(getippt.hoehe, 'AK 2: an der Grenze wächst das Feld nicht weiter').toBeCloseTo(GRENZE, 0);
    expect(getippt.inhalt, 'AK 2: der Inhalt ist gewachsen').toBeGreaterThan(offen.inhalt + 4 * offen.zeile);
    expect(endeIstSichtbar(getippt), `AK 3: die Zeile mit dem Cursor ist im Feld sichtbar: ${JSON.stringify(getippt)}`).toBe(true);
    fussErreichbar(getippt, 'AK 2');
    await expect(feld).toHaveValue(`${zeilen(30)}\nEins\nZwei\nDrei\nVier\nFünf`);
  });

  test('AK 1, 3: 10 Zeilen öffnen in Inhaltshöhe; fünf getippte Zeilen lassen das Feld um fünf Zeilen wachsen, die Überschrift behält ihren Platz', async ({ page }) => {
    await starten(page);
    const feld = await bearbeiten(page, 3);

    const offen = await masse(feld);
    expect(offen.hoehe, 'höher als 120 px').toBeGreaterThan(LEER_HOCH);
    expect(offen.hoehe, 'unter der Grenze').toBeLessThan(GRENZE);
    expect(zeigtAllesOhneRollen(offen), 'alle 10 Zeilen ohne Ziehen sichtbar').toBe(true);

    await feld.press('Control+End');
    await page.keyboard.type('\nEins\nZwei\nDrei\nVier\nFünf');
    const getippt = await masse(feld);
    expect(getippt.hoehe - offen.hoehe, 'um fünf Zeilen gewachsen').toBeCloseTo(5 * offen.zeile, 0);
    expect(zeigtAllesOhneRollen(getippt), 'weiter alle Zeilen sichtbar').toBe(true);
    expect(getippt.ueberschriftOben, 'AK 3: das Fenster springt nicht').toBe(offen.ueberschriftOben);
    fussErreichbar(getippt, 'AK 3');
  });
});

test.describe('R00175 AK 4, 5, US-2: von Hand gezogen bleibt gezogen, kein Entwurf geht verloren', () => {
  // 400 px aus der Anforderung; 200 px ist kleiner als der Inhalt — auch das ist eine Absicht
  for (const gezogen of [400, 200]) {
    test(`AK 4, 5: auf ${gezogen} px gezogen, „Entwurf“ getippt, ein Live-Ereignis zeichnet neu → Höhe, Text, Cursor und Rollstand bleiben; Verlassen speichert`, async ({ page }) => {
      await starten(page);
      const feld = await bearbeiten(page, 1);
      await ziehenAuf(page, feld, gezogen);
      await feld.press('Control+End');
      await page.keyboard.type('\nEntwurf');
      const vorher = { ...await masse(feld), ...await cursor(feld) };
      expect(vorher.rollstand, 'Selbstprobe: das Feld ist in sich gerollt').toBeGreaterThan(0);

      await fremdesNeuzeichnen(page, k);
      const nachher = { ...await masse(feld), ...await cursor(feld) };
      expect(Math.abs(nachher.hoehe - gezogen), `nach dem Neuzeichnen weiter ${gezogen} px: ${nachher.hoehe}`).toBeLessThanOrEqual(2);
      expect({ rollstand: nachher.rollstand, von: nachher.von, bis: nachher.bis }, 'Rollstand und Cursor bleiben').toEqual({ rollstand: vorher.rollstand, von: vorher.von, bis: vorher.bis });
      await expect(feld).toHaveValue(`${zeilen(30)}\nEntwurf`);
      await expect(feld).toBeFocused();

      await page.keyboard.type(' bleibt');
      await expect(feld).toHaveValue(`${zeilen(30)}\nEntwurf bleibt`);
      expect(Math.abs((await masse(feld)).hoehe - gezogen), 'beim Weitertippen springt das Feld nicht zurück').toBeLessThanOrEqual(2);

      await page.keyboard.press('Tab');
      await expect.poll(() => k.lies(DATEI_1), 'beim Verlassen gespeichert').toContain('Zeile 30\nEntwurf bleibt');
    });
  }

  test('AK 5: mitten im Text getippt, Live-Ereignis, weitergetippt → der Text steht an der gemeinten Stelle, die Auswahl bleibt', async ({ page }) => {
    await starten(page);
    const feld = await bearbeiten(page, 3);
    await feld.press('Control+Home');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    await page.keyboard.type(' mitten\nneu');
    const hoeheVorher = (await masse(feld)).hoehe;

    await fremdesNeuzeichnen(page, k);
    await page.keyboard.type(' drin');
    await expect(feld).toHaveValue(zeilen(10).replace('Zeile 3\n', 'Zeile 3 mitten\nneu drin\n'));
    expect((await masse(feld)).hoehe, 'die gewachsene Höhe bleibt über das Neuzeichnen').toBe(hoeheVorher);

    await page.keyboard.press('Shift+Home');
    const auswahl = await cursor(feld);
    await fremdesNeuzeichnen(page, k, 'Zweite Aufgabe, noch einmal geändert');
    expect(await cursor(feld), 'die Auswahl bleibt').toEqual(auswahl);
    expect(auswahl.bis - auswahl.von, 'Selbstprobe: „neu drin“ ist ausgewählt').toBe('neu drin'.length);
  });
});

test.describe('R00175 AK 6, US-3: leer, neue Aufgabe, schmal', () => {
  test('AK 6: die leere Beschreibung öffnet 120 px hoch; im Dialog „Neue Aufgabe“ wächst das Feld bis zur Grenze und scrollt, „Anlegen“ bleibt erreichbar', async ({ page }) => {
    await starten(page);
    const leer = await bearbeiten(page, 2);
    expect((await masse(leer)).hoehe, '#2: leer wie heute').toBe(LEER_HOCH);
    await page.keyboard.press('Escape');
    await expect(page.locator('#fenster')).toHaveCount(0);

    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    const feld = page.locator(FELD_NEU);
    await expect(feld).toBeVisible();
    expect((await masse(feld)).hoehe, 'Neue Aufgabe: leer wie heute').toBe(LEER_HOCH);

    await feld.fill(zeilen(10));
    const zehn = await masse(feld);
    expect(zehn.hoehe, '10 Zeilen: gewachsen').toBeGreaterThan(LEER_HOCH);
    expect(zeigtAllesOhneRollen(zehn), '10 Zeilen: alle sichtbar').toBe(true);

    await feld.fill(zeilen(30));
    const dreissig = await masse(feld);
    expect(stehtAnDerGrenze(dreissig, GRENZE), `30 Zeilen: an der Grenze und scrollt: ${JSON.stringify(dreissig)}`).toBe(true);
    fussErreichbar(dreissig, 'Neue Aufgabe');
    const anlegen = dialog.getByRole('button', { name: 'Anlegen', exact: true });
    await expect(anlegen).toBeInViewport({ ratio: 1 });

    await page.getByLabel('Titel der neuen Aufgabe').fill('Mit langer Beschreibung');
    await anlegen.click();
    await expect.poll(() => k.git('ls-files', 'aufgaben'), 'angelegt').toContain('0004-');
    expect(k.lies(k.git('ls-files', 'aufgaben').split('\n').find(datei => datei.includes('0004-')))).toContain(zeilen(30));
  });
});

/**
 * Bildet die Schnittstelle der Bildschirmtastatur nach wie r00111-tastatur.spec.js (F0062): `visualViewport.height` und
 * `offsetTop` lesen aus `window.__kdTastatur`, das Layout bleibt unverändert.
 */
function tastaturNachbilden(page) {
  return page.addInitScript(() => {
    window.__kdTastatur = {};
    for (const name of ['height', 'offsetTop']) {
      const echt = Object.getOwnPropertyDescriptor(VisualViewport.prototype, name);
      Object.defineProperty(VisualViewport.prototype, name, {
        configurable: true,
        get() { return name in window.__kdTastatur ? window.__kdTastatur[name] : echt.get.call(this); },
      });
    }
  });
}

test.describe('R00175 AK 6: 375 px mit Bildschirmtastatur', () => {
  const SCHMAL = { width: 375, height: 667 };
  const SICHTBAR_MIT_TASTATUR = 400;
  test.use({ viewport: SCHMAL, isMobile: true, hasTouch: true });

  test('AK 6: die Grenze richtet sich nach dem sichtbaren Bereich (400 px → 240 px); Feld und Fensterfuß mit „Eingabe verwerfen“ bleiben darin', async ({ page }) => {
    await tastaturNachbilden(page);
    await starten(page);
    await breiteSetzen(page, SCHMAL.width, SCHMAL.height);
    const feld = await bearbeiten(page, 1, true);
    const ohneTastatur = await masse(feld);
    expect(ohneTastatur.hoehe, 'ohne Tastatur: 60 % von 667 px').toBeCloseTo(SCHMAL.height * ANTEIL, 0);

    await page.evaluate(sichtbar => {
      Object.assign(window.__kdTastatur, { height: sichtbar, offsetTop: 0 });
      visualViewport.dispatchEvent(new Event('resize'));
    }, SICHTBAR_MIT_TASTATUR);
    await expect.poll(async () => (await masse(feld)).hoehe, 'mit Tastatur: 60 % von 400 px').toBeCloseTo(SICHTBAR_MIT_TASTATUR * ANTEIL, 0);

    await feld.press('Control+End');
    await page.keyboard.type('\nEntwurf');
    const getippt = await masse(feld);
    expect(getippt.bereichUnten, 'Selbstprobe: die Nachbildung wirkt').toBe(SICHTBAR_MIT_TASTATUR);
    expect(stehtAnDerGrenze(getippt, SICHTBAR_MIT_TASTATUR * ANTEIL), `an der Grenze und scrollt: ${JSON.stringify(getippt)}`).toBe(true);
    expect(endeIstSichtbar(getippt), 'die Zeile mit dem Cursor ist im Feld sichtbar').toBe(true);
    expect(getippt.oben, 'das Feld beginnt im sichtbaren Bereich').toBeGreaterThanOrEqual(getippt.bereichOben);
    fussErreichbar(getippt, 'schmal');
    const verwerfen = page.locator('#fenster .mod-fuss .eingabe-verwerfen');
    await expect(verwerfen).toBeVisible();
    const knopf = await verwerfen.boundingBox();
    expect(knopf.y + knopf.height, '„Eingabe verwerfen“ liegt über der Tastatur').toBeLessThanOrEqual(SICHTBAR_MIT_TASTATUR + TOLERANZ);
  });
});
