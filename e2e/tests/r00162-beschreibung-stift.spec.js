// R00162 (Karte #161, I0149): die Lesefläche der Beschreibung ist reiner Text — auswählbar und kopierbar; das Bearbeiten
// beginnt über den Stift-Knopf auf der Zeile „BESCHREIBUNG“ oder über `b`. Zeichnung: D0003 `#beschreibung-stift`.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { GRUNDBESTAND, DATEI_1, fensterOeffnen } = require('./r00155-hilfen');

const MARKDOWN = 'Erster Absatz mit [Verweis](https://example.org)';
const BESTAND = { ...GRUNDBESTAND, [DATEI_1]: `---\nid: 1\ntitle: Abnahme prüfen\n---\n\n${MARKDOWN}\n` };
const LESEFLAECHE = '#fenster .besch-lesen';
const TEXTFELD = '#fenster #beschreibung';

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
  // erwartet rot bis B0771: am Stand vor dem Bau öffnet schon der Klick in den Text das Textfeld (die Lesefläche verschwindet)
  test.fail();
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
