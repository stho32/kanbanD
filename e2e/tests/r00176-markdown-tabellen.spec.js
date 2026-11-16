// R00176 (Karte #184, I0166): eine Tabelle nach GFM steht in der Lesesicht der Beschreibung als Tabelle; fremder Text
// bleibt Text (ADR-0030), und bei 375 px scrollt nur die Hülle der Tabelle, nie das Fenster.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, breiteSetzen } = require('./hilfen');
const { GRUNDBESTAND, fensterOeffnen } = require('./r00155-hilfen');

const SPALTEN = 8;
const kopfzeile = `| ${Array.from({ length: SPALTEN }, (_, i) => `Spalte Nummer ${i + 1}`).join(' | ')} |`;
const trennzeile = `|${'---|'.repeat(SPALTEN)}`;
const wertezeile = `| ${Array.from({ length: SPALTEN }, (_, i) => `Wert ${i + 1}`).join(' | ')} |`;
/** Ausgangslage der User Story: #1 die Abnahme-Probe der Karte, #2 acht Spalten, #3 zwei Zeilen ohne Trennzeile. */
const BESTAND = {
  ...GRUNDBESTAND,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\n---\n\n| Spalte | Wert |\n|:---|---:|\n| **a** | 1 |\n| <script>alert(1)</script> | 2 |\n',
  'aufgaben/0002-zweite-aufgabe.md': `---\nid: 2\ntitle: Zweite Aufgabe\n---\n\nAcht Spalten:\n\n${kopfzeile}\n${trennzeile}\n${wertezeile}\n`,
  'aufgaben/0003-ohne-trennzeile.md': '---\nid: 3\ntitle: Ohne Trennzeile\n---\n\n| a | b |\n| c | d |\n',
};
const LESEN = '#fenster .besch-lesen.md-text';
const HUELLE = `${LESEN} .md-tab`;

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

async function starten(page) {
  k = await kanbanStarten(einrichten(BESTAND));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="3"]')).toBeVisible();
}

const ausrichtung = zelle => zelle.evaluate(element => getComputedStyle(element).textAlign);

test('US-1, AK 1 Abnahme-Probe der Karte: zwei Spalten, „Wert“ rechtsbündig, „a“ fett, das Skript als sichtbarer Text', async ({ page }) => {
  let dialoge = 0;
  page.on('dialog', dialog => { dialoge++; dialog.dismiss(); });
  await starten(page);
  const skripteVorher = await page.locator('script').count();
  await fensterOeffnen(page, 1);

  const tabelle = page.locator(`${HUELLE} > table`);
  await expect(tabelle).toBeVisible();
  await expect(page.locator(HUELLE)).toHaveCount(1);
  await expect(tabelle.locator('thead th')).toHaveText(['Spalte', 'Wert']);
  await expect(tabelle.locator('tbody tr')).toHaveCount(2);
  await expect(tabelle.locator('tbody td')).toHaveText(['a', '1', '<script>alert(1)</script>', '2']);
  await expect(tabelle.locator('tbody td').nth(2)).toBeVisible();

  expect(await ausrichtung(tabelle.locator('th').nth(1))).toBe('right');
  expect(await ausrichtung(tabelle.locator('tbody tr').nth(0).locator('td').nth(1))).toBe('right');
  expect(await ausrichtung(tabelle.locator('th').nth(0))).toBe('left');
  await expect(tabelle.locator('tbody td').nth(0).locator('strong')).toHaveText('a');
  expect(await tabelle.locator('tbody td strong').evaluate(element => Number(getComputedStyle(element).fontWeight))).toBeGreaterThanOrEqual(600);

  // Fremder Text erzeugt kein Element: kein Skript im Fenster, keines mehr im Dokument als vor dem Öffnen, kein Dialog.
  await expect(page.locator('#fenster script')).toHaveCount(0);
  expect(await page.locator('script').count()).toBe(skripteVorher);
  expect(dialoge).toBe(0);
  // Die drei Attribute der Hülle stammen aus dem Renderer; an den Zellen steht nur die feste Klasse.
  await expect(page.locator(HUELLE)).toHaveAttribute('tabindex', '0');
  await expect(page.locator(HUELLE)).toHaveAttribute('role', 'group');
  await expect(page.locator(HUELLE)).toHaveAttribute('aria-label', 'Tabelle');
  expect(await tabelle.locator('th, td').evaluateAll(zellen => zellen.map(zelle => zelle.getAttributeNames().join(' ')))).toEqual(['class', 'class', 'class', 'class', 'class', 'class']);
  expect(await tabelle.locator('th, td').evaluateAll(zellen => zellen.map(zelle => zelle.className))).toEqual(['ta-l', 'ta-r', 'ta-l', 'ta-r', 'ta-l', 'ta-r']);
});

test('Gestaltung: Kopf abgesetzt, nur waagrechte Linien, Schrift wie der Absatz', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 2);
  const kopfzelle = page.locator(`${HUELLE} th`).first();
  await expect(kopfzelle).toBeVisible();
  const bild = await page.locator(HUELLE).evaluate(huelle => {
    const stil = element => getComputedStyle(element);
    const th = huelle.querySelector('th'), td = huelle.querySelector('td'), absatz = huelle.parentElement.querySelector('p');
    return {
      kopfFett: Number(stil(th).fontWeight), kopfUmbruch: stil(th).whiteSpace, kopfFlaeche: stil(th).backgroundColor !== stil(td).backgroundColor,
      linieUnten: stil(td).borderBottomWidth, linieLinks: stil(td).borderLeftWidth, linieRechts: stil(td).borderRightWidth,
      schriftGleich: stil(td).fontSize === stil(absatz).fontSize,
    };
  });
  expect(bild).toEqual({ kopfFett: 600, kopfUmbruch: 'nowrap', kopfFlaeche: true, linieUnten: '1px', linieLinks: '0px', linieRechts: '0px', schriftGleich: true });
});

test('US-2, AK 6: bei 375 px scrollt die Tabelle mit acht Spalten in sich bis zur achten Spalte, das Fenster nicht — auch mit der Tastatur', async ({ page }) => {
  await starten(page);
  await breiteSetzen(page, 375, 800);
  await fensterOeffnen(page, 2);
  const huelle = page.locator(HUELLE);
  await expect(huelle).toBeVisible();
  await expect(huelle.locator('th')).toHaveCount(SPALTEN);
  const achte = huelle.locator('th').nth(SPALTEN - 1);
  await expect(achte).not.toBeInViewport();

  // Nur die Hülle hat waagrecht mehr Inhalt als Platz.
  await expect.poll(() => huelle.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(100);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await huelle.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);

  // Tastatur: vom Stift der Beschreibung führt Tab auf die Hülle, die Pfeiltaste schiebt sie bis ans Ende.
  await page.locator('#fenster [data-act="beschreibung-bearbeiten"]').focus();
  await page.keyboard.press('Tab');
  await expect(huelle).toBeFocused();
  expect(await huelle.evaluate(element => getComputedStyle(element).outlineStyle + ' ' + getComputedStyle(element).outlineWidth)).toBe('solid 2px');
  await page.keyboard.press('ArrowRight');
  await expect.poll(() => huelle.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  await expect.poll(async () => {
    await page.keyboard.press('ArrowRight');
    return huelle.evaluate(element => element.scrollWidth - element.clientWidth - element.scrollLeft);
  }, { intervals: [20] }).toBeLessThanOrEqual(1);
  await expect(achte).toBeInViewport({ ratio: 1 });

  // Das Fenster selbst lässt sich nicht waagrecht schieben: weder das Dokument noch ein Vorfahre der Hülle nimmt einen Rollstand an.
  const verschoben = await huelle.evaluate(element => {
    const namen = [];
    scrollTo(200, 0);
    if (scrollX !== 0) namen.push('Fenster des Browsers');
    for (let vorfahre = element.parentElement; vorfahre; vorfahre = vorfahre.parentElement) {
      vorfahre.scrollLeft = 200;
      if (vorfahre.scrollLeft !== 0) namen.push(vorfahre.id || vorfahre.className || vorfahre.tagName);
    }
    return namen;
  });
  expect(verschoben).toEqual([]);
});

test('US-3, AK 4: zwei Zeilen ohne Trennzeile bleiben Text mit ihren Strichen', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 3);
  await expect(page.locator(`${LESEN} p`)).toHaveText('| a | b || c | d |');
  expect(await page.locator(`${LESEN} p`).innerHTML()).toBe('| a | b |<br>| c | d |');
  await expect(page.locator(`${LESEN} table, #fenster .md-tab`)).toHaveCount(0);
});
