// R00162 (Karte #161, I0149): die Lesefläche der Beschreibung ist reiner Text — auswählbar und kopierbar; das Bearbeiten
// beginnt über den Stift-Knopf auf der Zeile „BESCHREIBUNG“ oder über `b`. Zeichnung: D0003 `#beschreibung-stift`.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { GRUNDBESTAND, DATEI_1, fensterOeffnen } = require('./r00155-hilfen');

const MARKDOWN = 'Erster Absatz mit [Verweis](https://example.org)';
const BESTAND = { ...GRUNDBESTAND, [DATEI_1]: `---\nid: 1\ntitle: Abnahme prüfen\n---\n\n${MARKDOWN}\n\n- [ ] Unterlagen sichten\n` };
const LESEFLAECHE = '#fenster .besch-lesen';
const TEXTFELD = '#fenster #beschreibung';
const UEBERSCHRIFT = '#fenster .abs h3:has-text("BESCHREIBUNG")';
const STIFT = `${UEBERSCHRIFT} button[data-act="beschreibung-bearbeiten"]`;

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/** Ausgangslage der Anforderung: Board geladen, `st` gewählt, Aufgabenfenster der Aufgabe offen (Ansicht „Inhalt“). */
async function fensterVon(page, nummer = 1, tippen = false) {
  k = await kanbanStarten(einrichten(BESTAND));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="2"]')).toBeVisible();
  return fensterOeffnen(page, nummer, tippen);
}

/** Wo `text` in der Lesefläche steht: linker und rechter Rand und die Mitte der Zeile, in Seitenkoordinaten. */
function ortImText(page, text) {
  return page.locator(LESEFLAECHE).evaluate((flaeche, gesucht) => {
    const knoten = document.createTreeWalker(flaeche, NodeFilter.SHOW_TEXT);
    while (knoten.nextNode()) {
      const beginn = knoten.currentNode.data.indexOf(gesucht);
      if (beginn < 0) continue;
      const bereich = document.createRange();
      bereich.setStart(knoten.currentNode, beginn);
      bereich.setEnd(knoten.currentNode, beginn + gesucht.length);
      const rect = bereich.getBoundingClientRect();
      return { links: rect.left, rechts: rect.right, mitteX: rect.left + rect.width / 2, mitteY: rect.top + rect.height / 2 };
    }
    throw new Error(`„${gesucht}“ steht nicht in der Lesefläche`);
  }, text);
}
const ausgewaehlt = page => page.evaluate(() => window.getSelection().toString().trim());

test.describe('R00162 AK 1: der Text bleibt Text', () => {
  test('AK 1/US-1: Klick, Doppelklick auf „Absatz“ und Ziehen über „Erster Absatz“ öffnen kein Textfeld; die Auswahl steht und lässt sich kopieren', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await fensterVon(page);
    const wort = await ortImText(page, 'Absatz');

    await page.mouse.click(wort.mitteX, wort.mitteY);
    await expect(page.locator(LESEFLAECHE), 'Klick: die Lesefläche bleibt').toBeVisible();
    await expect(page.locator(TEXTFELD), 'Klick öffnet kein Textfeld').toHaveCount(0);

    await page.mouse.dblclick(wort.mitteX, wort.mitteY);
    await expect(page.locator(TEXTFELD), 'Doppelklick öffnet kein Textfeld').toHaveCount(0);
    await expect.poll(() => ausgewaehlt(page), 'Doppelklick wählt das Wort').toBe('Absatz');

    const strecke = await ortImText(page, 'Erster Absatz');
    await page.mouse.move(strecke.links, strecke.mitteY);
    await page.mouse.down();
    await page.mouse.move(strecke.rechts, strecke.mitteY, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator(TEXTFELD), 'Ziehen öffnet kein Textfeld').toHaveCount(0);
    await expect.poll(() => ausgewaehlt(page), 'Ziehen wählt die Strecke').toBe('Erster Absatz');

    await page.keyboard.press('Control+c');
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText()), 'Kopieren legt die Auswahl in die Zwischenablage').toBe('Erster Absatz');
    expect(await ausgewaehlt(page), 'die Auswahl bleibt stehen').toBe('Erster Absatz');
  });
});

test.describe('R00162 AK 2, 3, 6, 8: Lesefläche ohne Aktion, Stift-Knopf auf der Zeile „BESCHREIBUNG“', () => {
  test('AK 2: die Lesefläche trägt weder role noch data-act noch tabindex; ein Klick auf „Verweis“ folgt seinem Ziel und öffnet kein Textfeld', async ({ page, context }) => {
    await context.route('https://example.org/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Ziel</title>' }));
    await fensterVon(page);
    const flaeche = page.locator(LESEFLAECHE);
    for (const merkmal of ['role', 'data-act', 'tabindex', 'aria-label', 'title']) await expect(flaeche, merkmal).not.toHaveAttribute(merkmal);
    const [ziel] = await Promise.all([page.waitForEvent('popup'), flaeche.getByRole('link', { name: 'Verweis' }).click()]);
    expect(ziel.url()).toBe('https://example.org/');
    await expect(flaeche).toBeVisible();
    await expect(page.locator(TEXTFELD)).toHaveCount(0);
  });

  const WEGE = [
    ['Klick', async (page, stift) => { await page.locator(LESEFLAECHE).hover(); await stift.click(); }],
    ['Enter', (page, stift) => stift.press('Enter')],
    ['Leertaste', (page, stift) => stift.press(' ')],
  ];
  for (const [weg, ausloesen] of WEGE) {
    test(`AK 3/US-2: ${weg} auf dem Stift öffnet das Textfeld mit dem Markdown, Fokus im Feld; solange es offen ist, gibt es keinen Stift`, async ({ page }) => {
      await fensterVon(page);
      const stift = page.locator(STIFT);
      await expect(stift).toHaveAttribute('title', 'Beschreibung bearbeiten (b)');
      await expect(stift).toHaveAttribute('type', 'button');
      await expect(stift).toHaveAccessibleName('Beschreibung bearbeiten');
      await ausloesen(page, stift);
      await expect(page.locator(TEXTFELD)).toBeFocused();
      await expect(page.locator(TEXTFELD)).toHaveValue(MARKDOWN);
      await expect(page.locator('#fenster [data-act="beschreibung-bearbeiten"]')).toHaveCount(0);
      await expect(page.locator(UEBERSCHRIFT), 'die Zeile der Überschrift bleibt').toBeVisible();
    });
  }

  test('AK 3: der Stift liegt in der Tab-Folge des Fensters', async ({ page }) => {
    await fensterVon(page);
    const stift = page.locator(STIFT);
    await expect(stift).toBeAttached();
    for (let schritt = 0; schritt < 40 && !(await stift.evaluate(knopf => knopf === document.activeElement)); schritt++) await page.keyboard.press('Tab');
    await expect(stift).toBeFocused();
  });

  test('AK 6: `b` öffnet das Textfeld der Beschreibung wie bisher', async ({ page }) => {
    await fensterVon(page);
    await page.keyboard.press('b');
    await expect(page.locator(TEXTFELD)).toBeFocused();
    await expect(page.locator(TEXTFELD)).toHaveValue(MARKDOWN);
  });

  test('AK 8/US-4: leere Beschreibung von #2 — direkt das Textfeld mit Platzhalter, kein Stift', async ({ page }) => {
    await fensterVon(page, 2);
    await expect(page.locator(UEBERSCHRIFT)).toBeVisible();
    await expect(page.locator(TEXTFELD)).toHaveAttribute('placeholder', 'Beschreibung in Markdown');
    await expect(page.locator(TEXTFELD)).toHaveValue('');
    await expect(page.locator('#fenster [data-act="beschreibung-bearbeiten"]')).toHaveCount(0);
    await page.locator(TEXTFELD).click();
    await page.keyboard.type('Neu');
    await page.keyboard.press('Control+Enter');
    await expect(page.locator(LESEFLAECHE)).toHaveText('Neu');
    await expect(page.locator(STIFT)).toBeAttached();
  });

  test('AK 8: Klick auf den Titel und auf eine Teilaufgabe öffnet deren Bearbeiten wie bisher', async ({ page }) => {
    const fenster = await fensterVon(page);
    await fenster.getByRole('button', { name: 'Unterlagen sichten', exact: true }).click();
    await expect(fenster.getByLabel('Teilaufgabe bearbeiten')).toBeFocused();
    await page.keyboard.press('Escape');
    await fenster.getByLabel('Titel bearbeiten', { exact: true }).click();
    await expect(fenster.locator('[data-af="titel"]')).toBeFocused();
    await expect(page.locator(TEXTFELD)).toHaveCount(0);
  });

  test('Entwurf am neuen Einstieg: ein geänderter Titel im Bearbeiten wird beim Klick auf den Stift gespeichert, nicht verloren; das Textfeld der Beschreibung öffnet', async ({ page }) => {
    const fenster = await fensterVon(page);
    await fenster.getByLabel('Titel bearbeiten', { exact: true }).click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' und sichern');
    await page.locator(LESEFLAECHE).hover();
    await page.locator(STIFT).click();
    await expect(page.locator(TEXTFELD)).toBeFocused();
    await expect(page.locator(TEXTFELD)).toHaveValue(MARKDOWN);
    await expect.poll(() => k.lies(DATEI_1)).toContain('title: Abnahme prüfen und sichern\n');
  });
});

/** Wie der Stift gerade gezeichnet ist: Deckkraft, Anklickbarkeit und dass er nie über `visibility` oder `display` verborgen wird. */
function zeichnung(page) {
  return page.locator(STIFT).evaluate(knopf => {
    const stil = getComputedStyle(knopf);
    return { deckkraft: Number(stil.opacity), zeiger: stil.pointerEvents, sichtbar: stil.visibility, gezeichnet: stil.display !== 'none' };
  });
}
const SO = (deckkraft, zeiger) => ({ deckkraft, zeiger, sichtbar: 'visible', gezeichnet: true });
/** Kantenlänge eines Ziels nach ADR-0012: der gerechnete Wert von `--kd-ziel` im Fenster. */
function zielgroesse(page) {
  return page.locator('#fenster').evaluate(fenster => {
    const mass = document.createElement('i');
    mass.style.cssText = 'position:absolute;inline-size:var(--kd-ziel)';
    fenster.append(mass);
    const breite = mass.getBoundingClientRect().width;
    mass.remove();
    return breite;
  });
}
/** Der Stift ist quadratisch in `--kd-ziel` und steht rechts auf der Zeile der Überschrift, die so hoch ist wie er. */
async function stiftSitzt(page, erwarteteKante) {
  const kante = await zielgroesse(page);
  expect(kante, '--kd-ziel').toBe(erwarteteKante);
  const stift = await page.locator(STIFT).boundingBox();
  const zeile = await page.locator(UEBERSCHRIFT).boundingBox();
  expect([stift.width, stift.height], 'Stift quadratisch in --kd-ziel').toEqual([kante, kante]);
  expect(zeile.height, 'die Zeile der Überschrift ist so hoch wie das Ziel').toBe(kante);
  expect(Math.abs(stift.x + stift.width - (zeile.x + zeile.width)), 'der Stift steht rechts').toBeLessThan(1);
  return zeile;
}

test.describe('R00162 AK 4, 5: Sichtbarkeit und Zielgröße des Stifts', () => {
  test('AK 4/US-2: in Ruhe unsichtbar und nicht anklickbar; Zeiger im Abschnitt halbtransparent; Zeiger auf dem Stift voll; die Lesefläche bekommt keinen Rahmen', async ({ page }) => {
    await fensterVon(page);
    await page.locator('#fenster .mod-kopf').hover({ position: { x: 5, y: 5 } });
    await expect.poll(() => zeichnung(page), 'Ruhe').toEqual(SO(0, 'none'));
    await stiftSitzt(page, 24);
    const ruhehoehe = (await page.locator(UEBERSCHRIFT).boundingBox()).height;

    const rahmen = () => page.locator(LESEFLAECHE).evaluate(flaeche => getComputedStyle(flaeche).borderTopColor);
    const rahmenInRuhe = await rahmen();
    await page.locator(LESEFLAECHE).hover();
    await expect.poll(() => zeichnung(page), 'Zeiger auf der Lesefläche').toEqual(SO(0.5, 'auto'));
    expect(await rahmen(), 'kein Rahmen beim Zeigen').toBe(rahmenInRuhe);
    expect(await page.locator(LESEFLAECHE).evaluate(flaeche => getComputedStyle(flaeche).cursor)).toBe('text');
    await page.locator(UEBERSCHRIFT).hover({ position: { x: 5, y: 5 } });
    await expect.poll(() => zeichnung(page), 'Zeiger auf der Zeile der Überschrift').toEqual(SO(0.5, 'auto'));
    await page.locator(STIFT).hover();
    await expect.poll(() => zeichnung(page), 'Zeiger auf dem Stift').toEqual(SO(1, 'auto'));

    await page.locator(STIFT).click();
    await expect(page.locator(TEXTFELD)).toBeFocused();
    expect((await page.locator(UEBERSCHRIFT).boundingBox()).height, 'beim Öffnen springt die Zeile nicht').toBe(ruhehoehe);
  });

  test('AK 4/US-3: mit Tastatur-Fokus ist der Stift voll sichtbar, ohne dass ein Zeiger auf dem Abschnitt liegt', async ({ page }) => {
    await fensterVon(page);
    await page.locator('#fenster .mod-kopf').hover({ position: { x: 5, y: 5 } });
    for (let schritt = 0; schritt < 40 && !(await page.locator(STIFT).evaluate(knopf => knopf === document.activeElement)); schritt++) await page.keyboard.press('Tab');
    await expect(page.locator(STIFT)).toBeFocused();
    await expect.poll(() => zeichnung(page), 'Fokus').toEqual(SO(1, 'auto'));
    const rahmen = await page.locator(STIFT).evaluate(knopf => { const stil = getComputedStyle(knopf); return [stil.outlineStyle, stil.outlineWidth, stil.outlineOffset]; });
    expect(rahmen, 'Fokusrahmen bei Tastatur: 2 px, Abstand 2 px').toEqual(['solid', '2px', '2px']);
  });

  test('AK 4: ohne Bewegung (prefers-reduced-motion) wechselt die Deckkraft ohne Übergang', async ({ page }) => {
    await fensterVon(page);
    const uebergang = () => page.locator(STIFT).evaluate(knopf => getComputedStyle(knopf).transitionDuration);
    expect(await uebergang()).toBe('0.1s');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await uebergang()).toBe('0s');
  });

  test.describe('Touch (kein Hover, grober Zeiger), 320 px', () => {
    test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });

    test('AK 4, 5: dauerhaft halbtransparent und anklickbar, Ziel 48 × 48 px, Überschrift und Stift auf einer Zeile; ein Tipp öffnet das Textfeld', async ({ page }) => {
      await fensterVon(page, 1, true);
      await expect.poll(() => zeichnung(page), 'ohne Hover').toEqual(SO(0.5, 'auto'));
      const zeile = await stiftSitzt(page, 48);
      const fenster = await page.locator('#fenster').boundingBox();
      expect(zeile.x + zeile.width, 'nichts ragt aus dem Fenster').toBeLessThanOrEqual(fenster.x + fenster.width);
      await page.locator(STIFT).tap();
      await expect(page.locator(TEXTFELD)).toBeFocused();
      await expect(page.locator(TEXTFELD)).toHaveValue(MARKDOWN);
    });
  });
});
