// Karte #199 (Bug): ein mehrzeiliger Titel im Aufgabenfenster schiebt „Beschreibung“ und alles Folgende nach unten —
// nach Enter, nach Verlassen per Klick und per Tab, beim Öffnen einer Karte mit langem Titel; 320 px und breit, hell und dunkel.
// Gemessen wird die Lage in einem Zug: Unterkante des Titels ≤ Oberkante der Überschrift „Beschreibung“.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, breiteSetzen, thema } = require('./hilfen');
const { GRUNDBESTAND, DATEI_1, fensterOeffnen } = require('./r00155-hilfen');

const LANG = 'Mehrzeiliger Titel im Kartendetail überlappt die Überschrift Beschreibung nach dem Verlassen der Bearbeitung, '
  + 'und zwar auch dann, wenn das Fenster breit ist und der Titel weit über eine Zeile hinausläuft';
/** #1 mit langem Titel und langer Beschreibung (der Inhalt läuft über die Höhe des Fensters), #2 kurz. */
const zeilen = anzahl => Array.from({ length: anzahl }, (_, i) => `Zeile ${i + 1}`).join('\n\n');
const BESTAND = {
  ...GRUNDBESTAND,
  [DATEI_1]: `---\nid: 1\ntitle: ${JSON.stringify(LANG)}\n---\n\n${zeilen(40)}\n`,
};
const LESE = '#fenster [data-act="titel-bearbeiten"]';
const FELD = '#fenster [data-af="titel"]';
const TOLERANZ = 0.5;

/**
 * Lage in einem Zug: Titel (Lese- oder Eingabeform) und Überschrift „Beschreibung“, dazu die Zeilenzahl des Titels.
 * Die Unterkante des Titels ist die tiefere von Kasten und letzter Textzeile: schrumpft der Kasten, läuft der Text
 * sichtbar über ihn hinaus — gerade das ist der Befund, den der Kasten allein nicht zeigt.
 */
const lage = page => page.evaluate(() => {
  const titel = document.querySelector('#fenster .titel');
  const kopf = document.querySelector('#fenster .besch-kopf');
  if (!titel || !kopf) return null;
  const kasten = titel.getBoundingClientRect();
  const range = document.createRange();
  range.selectNodeContents(titel);
  const textzeilen = [...range.getClientRects()].filter(r => r.width > 1);
  const zeilen = new Set(textzeilen.map(r => Math.round(r.top))).size;
  const titelUnten = Math.max(kasten.bottom, ...textzeilen.map(r => r.bottom));
  return { titelUnten, kastenUnten: kasten.bottom, kopfOben: kopf.getBoundingClientRect().top, zeilen, lesend: titel.tagName === 'DIV' };
});

/** Wartet, bis der Titel liest, und prüft: mehrzeilig, Unterkante über „Beschreibung“. */
async function ohneUeberlappen(page, wo, mehrzeilig = true) {
  await expect(page.locator(LESE)).toBeVisible();
  await expect.poll(async () => {
    const m = await lage(page);
    const ok = m && m.lesend && (!mehrzeilig || m.zeilen > 1) && m.titelUnten <= m.kopfOben + TOLERANZ;
    return ok ? 'ok' : JSON.stringify(m);
  }, { message: `${wo}: der Titel liest und endet über „Beschreibung“` }).toBe('ok');
}

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

async function starten(page) {
  k = await kanbanStarten(einrichten(BESTAND));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="2"]')).toBeVisible();
}

for (const [breite, hoehe] of [[1280, 800], [320, 568]]) {
  for (const schema of ['light', 'dark']) {
    test(`#199 ${breite} px ${schema}: langer Titel schiebt „Beschreibung“ — beim Öffnen, nach Enter, Klick und Tab`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: hoehe });
      await starten(page);
      await thema(page, schema);
      await breiteSetzen(page, breite, hoehe);
      await fensterOeffnen(page, 1);
      await ohneUeberlappen(page, 'beim Öffnen');

      // Enter beendet die Bearbeitung
      await page.locator(LESE).click();
      await expect(page.locator(FELD)).toBeFocused();
      await page.keyboard.press('End');
      await page.keyboard.type(' x');
      await page.keyboard.press('Enter');
      await ohneUeberlappen(page, 'nach Enter');

      // Klick daneben beendet die Bearbeitung
      await page.locator(LESE).click();
      await expect(page.locator(FELD)).toBeFocused();
      await page.locator('#fenster .besch-kopf').click({ position: { x: 2, y: 2 } });
      await ohneUeberlappen(page, 'nach Klick');

      // Tab beendet die Bearbeitung
      await page.locator(LESE).click();
      await expect(page.locator(FELD)).toBeFocused();
      await page.keyboard.press('Tab');
      await ohneUeberlappen(page, 'nach Tab');
    });
  }
}

test('#199: ein einzeiliger Titel steht wie bisher — eine Zeile, 25 px Zeilenhöhe, über „Beschreibung“', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await starten(page);
  await fensterOeffnen(page, 2);
  await ohneUeberlappen(page, 'kurzer Titel', false);
  const m = await lage(page);
  expect(m.zeilen, 'der kurze Titel hat eine Zeile').toBe(1);
  await expect(page.locator(LESE)).toHaveCSS('line-height', '25px');
});
