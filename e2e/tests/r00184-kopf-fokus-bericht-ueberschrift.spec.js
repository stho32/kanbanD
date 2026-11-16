// R00184 Fokusring im Kopf sichtbar (Karte #59), aktueller Bericht im Menü angesagt und Überschriftenfolge im Aufgabenfenster
// ohne Sprung (Karte #111). Die Vorher-Werte für AK 2 und AK 5 stehen in r00184-vorher.json, gemessen am Stand ddfb656 vor dem Bau.
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen, reiter, ausMehr, thema, kontrastFarben } = require('./hilfen');
const { gezeichnet } = require('./struktur-hilfen');

const VORHER_DATEI = path.join(__dirname, 'r00184-vorher.json');
/** Nur für die einmalige Messung vor dem Bau: KD_R00184_VORHER=schreiben legt die Datei neu an, statt gegen sie zu prüfen. */
const VORHER_SCHREIBEN = process.env.KD_R00184_VORHER === 'schreiben';
const VORHER = VORHER_SCHREIBEN ? {} : JSON.parse(fs.readFileSync(VORHER_DATEI, 'utf8'));

const THEMEN = ['light', 'dark'];
/** WCAG 1.4.11: der Ring steht mindestens 3:1 gegen die Fläche des Kopfs. */
const RING_MASS = 3;
/** Die zehn Berichte mit ihrem Namen im Menü „Berichte“ (R00184 AK 3). */
const BERICHTE = {
  stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', fluss: 'Kumulativer Fluss', durchsatz: 'Durchsatz',
  prognose: 'Wie lange noch', fieber: 'Projekt-Fever-Chart', durchlauf: 'Durchlaufzeit', bestand: 'Bestand nach Labels', kosten: 'Kosten',
};
const ANSICHTEN_DES_FENSTERS = [['inhalt', 'Inhalt'], ['zeiten', 'Zeiten'], ['details', 'Details'], ['datei', 'Datei'], ['verlauf', 'Verlauf']];
const BESTAND = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\nText\n\n- [ ] Teil\n',
};

/** Wartet, bis keine CSS-Transition mehr läuft: gemessen wird der ruhende Zustand. */
async function uebergaengeAbwarten(page) {
  await page.waitForFunction(() => document.getAnimations().filter(a => a instanceof CSSTransition).every(a => a.playState !== 'running'));
}

/** Der Ring am Element mit dem Fokus, in einem Schritt gelesen; `null`, wenn der Fokus nicht in `bereich` steht. */
const ringAmFokus = (page, bereich) => page.evaluate(sel => {
  const e = document.activeElement;
  if (!e || !e.closest(sel)) return null;
  const stil = getComputedStyle(e);
  const name = e.id ? '#' + e.id : (e.getAttribute('aria-label') || e.textContent.replace(/\s+/g, ' ').trim());
  return { name, stil: stil.outlineStyle, breite: stil.outlineWidth, farbe: stil.outlineColor, versatz: stil.outlineOffset };
}, bereich);

/** Der Ring am Fokus ohne den Namen des Elements: der Name einer Karte nennt ihr Alter und wandert mit der Uhr. */
async function ringOhneName(page, bereich) {
  const ring = await ringAmFokus(page, bereich);
  return ring && { stil: ring.stil, breite: ring.breite, farbe: ring.farbe, versatz: ring.versatz };
}

/** Geht mit Tab vom Seitenanfang durch den Kopf und liefert den Ring jedes Elements, das dabei den Fokus trägt. */
async function ringeImKopf(page) {
  const ringe = [];
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let schritt = 0; schritt < 40; schritt++) {
    await page.keyboard.press('Tab');
    await uebergaengeAbwarten(page);
    const ring = await ringAmFokus(page, 'header.kz');
    if (ring) ringe.push(ring);
    else if (ringe.length) break;
  }
  return ringe;
}

/** Verstöße gegen „durchgezogen, 2 px, mindestens 3:1 gegen den Kopf“ (AK 1). */
async function ringVerstoesse(page, ringe, themaName) {
  const kopf = await page.locator('header.kz').evaluate(k => getComputedStyle(k).backgroundColor);
  const verstoesse = [];
  for (const ring of ringe) {
    const kontrast = await kontrastFarben(page, ring.farbe, kopf);
    if (ring.stil !== 'solid' || ring.breite !== '2px' || kontrast < RING_MASS) verstoesse.push(`${themaName} ${ring.name}: ${ring.stil} ${ring.breite} ${kontrast.toFixed(2)}:1`);
  }
  return verstoesse;
}

/** Öffnet das Aufgabenfenster von #1 über die Tastatur — ein Klick träfe auf der Karte die nächste Teilaufgabe. */
async function fensterOeffnen(page) {
  await page.locator('.ka[data-id="1"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#fenster')).toBeVisible();
}

/** Öffnet das Menü „Berichte“: ab 600 px über die Leiste, darunter über „Seite“ → „Berichte“. */
async function berichteOeffnen(page) {
  if (await page.locator('#pop').count()) await page.keyboard.press('Escape');
  await expect(page.locator('#pop')).toHaveCount(0);
  if (await page.locator('#t-ber').count()) await page.locator('#t-ber').click();
  else {
    await page.locator('#t-seite').click();
    await page.locator('#pop[aria-label="Seite"]').getByRole('menuitem', { name: 'Berichte' }).click();
  }
  await page.locator('#pop[aria-label="Berichte"]').waitFor();
}

/** Die Einträge des offenen Menüs „Berichte“ mit ihren beiden Auszeichnungen. */
const menueEintraege = page => page.locator('#pop[aria-label="Berichte"] [role="menuitem"]').evaluateAll(es => es.map(e => ({
  name: e.querySelector('b').textContent, an: e.classList.contains('an'), aktuell: e.getAttribute('aria-current'),
})));

/** Überschriften eines Dialogs in Dokumentreihenfolge; was aus Markdown stammt (`.md-text`), zählt nicht (AK 4). */
const ueberschriften = (page, dialog) => page.locator(dialog).evaluate(d => [...d.querySelectorAll('h1, h2, h3, h4, h5, h6, [role=heading]')]
  .filter(h => !h.closest('.md-text'))
  .map(h => ({ ebene: Number(h.getAttribute('aria-level') || h.tagName.slice(1)), text: h.textContent.replace(/\s+/g, ' ').trim() })));

/** Verstöße gegen „erste Überschrift zweite Ebene mit dem Namen des Fensters, danach kein Sprung“. */
async function folgeVerstoesse(page, dialog, name) {
  const folge = await ueberschriften(page, dialog);
  if (!folge.length) return ['keine Überschrift'];
  const verstoesse = [];
  if (folge[0].ebene !== 2 || folge[0].text !== name) verstoesse.push(`erste Überschrift: Ebene ${folge[0].ebene} „${folge[0].text}“ statt Ebene 2 „${name}“`);
  folge.reduce((vorige, h) => {
    if (h.ebene > vorige + 1) verstoesse.push(`Ebene ${h.ebene} „${h.text}“ nach Ebene ${vorige}`);
    return h.ebene;
  }, 1);
  return verstoesse;
}

/** Gestaltung und Lage der Elemente zu `selektor`: Schrift, Farbe, Ränder, Höhe und Lage auf 1 px (AK 5). */
const gestalt = (page, selektor) => page.locator(selektor).evaluateAll(es => es.map(e => {
  const stil = getComputedStyle(e), r = e.getBoundingClientRect();
  return {
    schrift: `${stil.fontWeight} ${stil.fontSize}`, farbe: stil.color, rand: stil.margin, innen: stil.padding,
    lage: [r.x, r.y, r.width, r.height].map(Math.round).join(' '),
  };
}));

/** Vergleicht eine Messung mit ihrem Vorher-Wert; im Schreibmodus wird sie stattdessen gemerkt. */
const gemessen = {};
async function gleichVorher(schluessel, messen) {
  if (VORHER_SCHREIBEN) { gemessen[schluessel] = await messen(); return; }
  await expect.poll(messen, `${schluessel} wie vor dem Bau`).toEqual(VORHER[schluessel]);
}

test.describe('R00184 Fokusring im Kopf, aktueller Bericht, Überschriftenfolge', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(BESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await bereit(page, '.ka[data-id="1"]');
    await thema(page, 'light');
  });
  test.afterEach(async () => { await k.stoppen(); });
  test.afterAll(() => {
    if (VORHER_SCHREIBEN && Object.keys(gemessen).length) fs.writeFileSync(VORHER_DATEI, JSON.stringify({ ...(fs.existsSync(VORHER_DATEI) ? JSON.parse(fs.readFileSync(VORHER_DATEI, 'utf8')) : {}), ...gemessen }, null, 1) + '\n');
  });

  test('US-1/AK 1: Tab durch den Kopf zeigt an jedem Element einen durchgezogenen Ring von 2 px, mindestens 3:1 gegen den Kopf — hell und dunkel', async ({ page }) => {
    const verstoesse = [];
    for (const t of THEMEN) {
      await thema(page, t);
      const ringe = await ringeImKopf(page);
      const namen = ringe.map(r => r.name);
      for (const ziel of ['Board', '#t-ber', '#flt', '#t-board', '#t-mehr']) expect(namen, `${t}: Tab erreicht ${ziel}`).toContain(ziel);
      verstoesse.push(...await ringVerstoesse(page, ringe, t));
    }
    expect(verstoesse).toEqual([]);
  });

  test('US-1/AK 2: ein Mausklick auf „Board“ zeigt keinen Ring, das Filterfeld zeigt ihn auch nach einem Klick — hell und dunkel', async ({ page }) => {
    for (const t of THEMEN) {
      await thema(page, t);
      const board = page.locator('.kz-nav a', { hasText: 'Board' });
      await board.click();
      await expect(board).toBeFocused();
      await expect(board, `${t}: kein Ring nach Mausklick`).toHaveCSS('outline-style', 'none');
      await page.locator('#flt').click();
      await expect(page.locator('#flt')).toBeFocused();
      await uebergaengeAbwarten(page);
      await expect.poll(async () => ringVerstoesse(page, [await ringAmFokus(page, 'header.kz')], t)).toEqual([]);
    }
  });

  test('AK 2: der Kopf im Modus „Spalten einrichten“ zeigt seinen Ring wie vor dem Bau', async ({ page }) => {
    await ausMehr(page, 'Spalten einrichten');
    await page.locator('header.kz.modus').waitFor();
    await gleichVorher('ringeImModus', () => ringeImKopf(page));
  });

  test('AK 2: Ringe außerhalb des Kopfs (Menüeintrag, Karte) sind wie vor dem Bau', async ({ page }) => {
    await page.locator('#t-ber').focus();
    await page.keyboard.press('Enter');
    await page.locator('#pop[aria-label="Berichte"]').waitFor();
    await expect(page.locator('#pop [role="menuitem"]').first()).toBeFocused();
    await gleichVorher('ringImMenue', () => ringOhneName(page, '#pop'));
    await page.keyboard.press('Escape');
    await expect(page.locator('#pop')).toHaveCount(0);
    await page.locator('.ka[data-id="1"]').focus();
    await gleichVorher('ringAnDerKarte', () => ringOhneName(page, '#main'));
  });

  for (const breite of [1280, 560]) {
    test(`US-2/AK 3: im Menü „Berichte“ trägt genau der offene Bericht aria-current und die Klasse an — ${breite} px`, async ({ page }) => {
      test.setTimeout(90000);
      await breiteSetzen(page, breite);
      await page.locator(breite < 600 ? '#t-seite' : '#t-ber').waitFor();
      await berichteOeffnen(page);
      const amBoard = await menueEintraege(page);
      expect(amBoard.map(e => e.name), 'zehn Berichte und der Export').toEqual([...Object.values(BERICHTE), 'Export als CSV']);
      expect(amBoard.filter(e => e.an || e.aktuell), 'auf dem Board ist kein Eintrag ausgezeichnet').toEqual([]);
      for (const [schluessel, name] of Object.entries(BERICHTE)) {
        await page.goto(`${k.adresse}#/berichte/${schluessel}`);
        await gezeichnet(page, `#/berichte/${schluessel}`);
        if (breite >= 600) await expect(page.locator('#t-ber'), 'der Auslöser behält seine Markierung').toHaveAttribute('aria-current', 'page');
        await berichteOeffnen(page);
        const ausgezeichnet = (await menueEintraege(page)).filter(e => e.an || e.aktuell);
        expect(ausgezeichnet, `Bericht ${schluessel}`).toEqual([{ name, an: true, aktuell: 'page' }]);
      }
    });
  }

  test('US-3/AK 4: das Aufgabenfenster beginnt in jeder Ansicht mit „Aufgabe #1“ als zweiter Ebene, die Abschnitte folgen als dritte', async ({ page }) => {
    await fensterOeffnen(page);
    const fenster = page.locator('#fenster');
    await expect(fenster, 'der Dialog heißt wörtlich wie bisher').toHaveAttribute('aria-label', 'Aufgabe #1');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1', exact: true })).toHaveCount(1);
    for (const [schluessel, name] of ANSICHTEN_DES_FENSTERS) {
      if (schluessel !== 'inhalt') await reiter(page, name);
      await page.locator(`#fenster .mod-body[data-ansicht="${schluessel}"]`).waitFor();
      await expect(page.locator('#fenster .vh-laedt')).toHaveCount(0);
      await expect.poll(() => folgeVerstoesse(page, '#fenster', 'Aufgabe #1'), `Ansicht ${name}`).toEqual([]);
    }
    await reiter(page, 'Inhalt');
    await page.locator('#fenster .mod-body[data-ansicht="inhalt"]').waitFor();
    const abschnitte = (await ueberschriften(page, '#fenster')).filter(h => h.ebene === 3).map(h => h.text.split(' ')[0]);
    for (const abschnitt of ['BESCHREIBUNG', 'TEILAUFGABEN']) expect(abschnitte).toContain(abschnitt);
  });

  test('US-3/AK 4: der Dialog „Neue Aufgabe“ beginnt mit „Neue Aufgabe“ als zweiter Ebene, die Abschnitte folgen als dritte', async ({ page }) => {
    await page.locator('.neu-btn').click();
    const dialog = page.locator('#neu-fenster');
    await expect(dialog).toBeVisible();
    await expect(dialog, 'der Dialog heißt wörtlich wie bisher').toHaveAttribute('aria-label', 'Neue Aufgabe');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe', exact: true })).toHaveCount(1);
    await expect.poll(() => folgeVerstoesse(page, '#neu-fenster', 'Neue Aufgabe')).toEqual([]);
    const abschnitte = (await ueberschriften(page, '#neu-fenster')).filter(h => h.ebene === 3).map(h => h.text.split(' ')[0]);
    for (const abschnitt of ['BESCHREIBUNG', 'TEILAUFGABEN']) expect(abschnitte).toContain(abschnitt);
  });

  test('AK 5: Fensterkopf, Abschnittsköpfe und Menüeinträge sind gestaltet und liegen wie vor dem Bau', async ({ page }) => {
    await fensterOeffnen(page);
    await gleichVorher('fensterKopf', () => gestalt(page, '#fenster .mod-kopf, #fenster .mod-kopf .id'));
    await gleichVorher('fensterAbschnitte', () => gestalt(page, '#fenster .abs h3'));
    await page.locator('#fenster [data-act="schliessen"]').click();
    await expect(page.locator('#fenster')).toHaveCount(0);

    await page.locator('.neu-btn').click();
    await expect(page.locator('#neu-fenster')).toBeVisible();
    await gleichVorher('neuKopf', () => gestalt(page, '#neu-fenster .mod-kopf, #neu-fenster .mod-kopf .id'));
    await gleichVorher('neuAbschnitte', () => gestalt(page, '#neu-fenster .abs h3'));
    await page.locator('#neu-fenster .mod-kopf [data-act="nf-zu"]').click();
    await expect(page.locator('#neu-fenster')).toHaveCount(0);

    await page.goto(`${k.adresse}#/berichte/verlauf`);
    await gezeichnet(page, '#/berichte/verlauf');
    await berichteOeffnen(page);
    await gleichVorher('menueEintraege', () => gestalt(page, '#pop[aria-label="Berichte"] .e'));
    await gleichVorher('menueMarke', () => page.locator('#pop[aria-label="Berichte"] .e.an').evaluateAll(es => es.map(e => getComputedStyle(e).boxShadow)));
  });
});
