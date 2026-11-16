// R00116 Titel im Aufgabenfenster mehrzeilig lesbar (Karte #115, ADR-0007 Nachtrag N2) — Abnahme-Proben US-1 bis US-6.
// Der Titel liest als mehrzeiliges div data-act="titel-bearbeiten" (overflow-wrap:break-word, Range-Sonde wie r00115),
// bearbeitet als einzeiliges input data-af="titel" im Zustand S.ui.titelBearbeiten (Muster besch-lesen).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, mutanteEinsetzen, breiteSetzen } = require('./hilfen');
const { breiteMessen, perTabErreicht } = require('./ziele-hilfen');

test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });

const KOPF = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
sources:
  wbs: ""
  requirements: ""
---
`;
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n';
const karte = (nr, titel) => `---\nid: ${nr}\ntitle: ${JSON.stringify(titel)}\n---\n`;
const TITEL_EINS = 'Volltextsuche über alle Boards und Aufgaben';
const EINZELWORT = 'Donaudampfschifffahrtskapitänsanwärterunterricht';

/** Grundbestand der User Story: Board „Entwicklung“, #1 langer Titel, #2 mit Sonderzeichen. */
const GRUNDBESTAND = {
  'kanbanD.md': KOPF,
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': karte(1, TITEL_EINS),
  'aufgaben/0002-zwei.md': karte(2, 'Ölwechsel & <Prüfung>'),
};

/** Das Lesediv des Fenstertitels (AK 1/FA 1) — im Bearbeitungszustand steht dort das Eingabefeld. */
const LESE = '#fenster [data-act="titel-bearbeiten"]';
/** Das einzeilige Eingabefeld des Titels (FA 4) — Wert und aria-label wie heute. */
const FELD = '#fenster [data-af="titel"]';

/** Öffnet das Aufgabenfenster über die Tastatur: Karte fokussieren, Enter (Muster r00106). */
async function fensterOeffnen(page, nummer) {
  await page.locator(`.ka[data-id="${nummer}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(1);
}

/** Das Eingabefeld ist da, trägt den erwarteten Titelwert, heißt „Titel“ und hat den Fokus (FA 4). */
async function feldPruefen(page, titel) {
  const feld = page.locator(FELD);
  await expect(feld).toBeVisible();
  await expect(feld).toHaveAttribute('aria-label', 'Titel');
  await expect(feld).toHaveValue(titel);
  expect(await feld.evaluate(e => e === document.activeElement), 'der Fokus steht im Eingabefeld').toBe(true);
}

/** Wörter des Fenstertitels, die über mehr als eine Zeile laufen (leer: keine Zeile endet mitten in einem Wort,
 *  Range-Sonde wie r00115; ein Wort, das allein nicht in die Zeile passt, darf innerhalb brechen — US-6). */
const mittenWoerter = page => page.evaluate(() => {
  const titel = document.querySelector('#fenster [data-act="titel-bearbeiten"]');
  const knoten = titel && [...titel.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
  if (!knoten) return null;
  const brueche = [];
  for (const wort of knoten.data.split(/\s+/).filter(Boolean)) {
    const start = knoten.data.indexOf(wort);
    const range = document.createRange();
    range.setStart(knoten, start);
    range.setEnd(knoten, start + wort.length);
    if (range.getClientRects().length > 1) brueche.push(wort);
  }
  return brueche;
});

/** Zeilen des Fenstertitels im ersten rollenden Vorfahrn (breit: .mod-main, schmal: .mod-body — der „Fensterkörper“):
 *  jede Zeile ganz im sichtbaren Körper, kein Querscrollen des Körpers wegen des Titels. */
const titelMessen = page => page.evaluate(() => {
  const titel = document.querySelector('#fenster [data-act="titel-bearbeiten"]');
  if (!titel) return null;
  let koerper = null;
  for (let x = titel.parentElement; x && x !== document.body; x = x.parentElement) {
    const st = getComputedStyle(x);
    if (['auto', 'scroll'].includes(st.overflowX) || ['auto', 'scroll'].includes(st.overflowY)) { koerper = x; break; }
  }
  const rahmen = koerper || titel.closest('.mod');
  const range = document.createRange();
  range.selectNodeContents(titel);
  const zeilen = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
  const k = rahmen.getBoundingClientRect();
  return {
    text: titel.textContent.trim(),
    zeilen: zeilen.length,
    imKoerper: zeilen.every(r => r.left >= k.left - 0.5 && r.right <= k.right + 0.5 && r.bottom <= k.bottom + 0.5),
    quer: rahmen.scrollWidth - rahmen.clientWidth,
    abgeschnitten: getComputedStyle(titel).textOverflow !== 'clip' || getComputedStyle(titel).overflow !== 'visible',
  };
});

/** Berechnete Typografie des Lesedivs — wie heute .titel: Schriftstärke 600, Größe 20 px, Zeilenhöhe 1,25 × 20 px (FA 3). */
const typografie = page => page.evaluate(() => {
  const titel = document.querySelector('#fenster [data-act="titel-bearbeiten"]');
  if (!titel) return null;
  const st = getComputedStyle(titel);
  return { staerke: st.fontWeight, groesse: st.fontSize, zeilenHoehe: st.lineHeight };
});

test.describe('R00116', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.afterEach(() => k && k.stoppen());

  test('US-1: der Fenstertitel bricht zwischen Wörtern, ganz lesbar (AK 1, Karte #115 wörtlich)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    for (const [breite, hoehe] of [[1280, 800], [320, 568]]) {
      await breiteSetzen(page, breite, hoehe);
      await page.locator(`.ka[data-id="1"]`).waitFor();
      await fensterOeffnen(page, 1);
      expect(await mittenWoerter(page), `${breite} px: kein Wort des Titels endet mitten gebrochen`).toEqual([]);
      const z = await titelMessen(page);
      expect(z.zeilen, `${breite} px: der Titel hat sichtbare Zeilen`).toBeGreaterThan(0);
      expect(z.abgeschnitten, `${breite} px: kein Auslassungszeichen, nichts abgeschnitten`).toBe(false);
      expect(z.imKoerper, `${breite} px: jede Zeile liegt im sichtbaren Fensterkörper`).toBe(true);
      expect(z.quer, `${breite} px: der Fensterkörper scrollt nicht quer`).toBeLessThanOrEqual(1);
      expect(await breiteMessen(page, `US-1 ${breite}`), `${breite} px: kein Rahmen scrollt quer`).toEqual([]);
      const typo = await typografie(page);
      expect(typo.staerke, `${breite} px: Schriftstärke wie .titel`).toBe('600');
      expect(typo.groesse, `${breite} px: Schriftgröße wie .titel`).toBe('20px');
      expect(typo.zeilenHoehe, `${breite} px: Zeilenhöhe 1,25 × 20 px`).toBe('25px');
      await page.keyboard.press('Escape');
      await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
    }
  });

  test('US-2: das Lesediv ist zugänglich — Tab, Rolle, Name, Werkzeughinweis (AK 2)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await fensterOeffnen(page, 1);
    const les = page.locator(LESE);
    await expect(les).toHaveAttribute('tabindex', '0');
    await expect(les).toHaveAttribute('role', 'button');
    await expect(les).toHaveAttribute('aria-label', 'Titel bearbeiten');
    await expect(les).toHaveAttribute('title', 'Klick bearbeitet');
    // per Tab erreichbar: der Fokus der Tastatur findet das Lesediv im Fenster
    expect(await perTabErreicht(page, les), 'das Lesediv ist per Tab erreichbar').toBeGreaterThan(0);
  });

  /** R00155 54-1/54-3: das erste Esc verlässt nur den Bearbeitungsmodus des Titels, erst das zweite schließt das Fenster. */
  async function zweimalEsc(page) {
    await page.keyboard.press('Escape');
    await expect(page.locator(LESE)).toBeFocused();
    await page.keyboard.press('Escape');
  }

  test('US-3: Klick, Enter auf dem Lesediv und Taste e öffnen die Bearbeitung; erneutes Öffnen zeigt das Lesediv (AK 3)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await fensterOeffnen(page, 1);
    // 1. Klick auf das Lesediv
    await page.locator(LESE).click();
    await feldPruefen(page, TITEL_EINS);
    await zweimalEsc(page);
    await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
    // 2. Enter bei fokussiertem Lesediv — nach Schließen und erneutem Öffnen (titelBearbeiten zurückgesetzt)
    await fensterOeffnen(page, 1);
    await expect(page.locator(LESE)).toHaveCount(1);
    await page.locator(LESE).focus();
    await page.keyboard.press('Enter');
    await feldPruefen(page, TITEL_EINS);
    await zweimalEsc(page);
    await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
    // 3. Taste e im Fenster
    await fensterOeffnen(page, 1);
    await page.keyboard.press('e');
    await feldPruefen(page, TITEL_EINS);
    await zweimalEsc(page);
    // Schließen und erneutes Öffnen zeigt wieder das Lesediv (FA 4: oeffnen setzt titelBearbeiten zurück)
    await fensterOeffnen(page, 1);
    await expect(page.locator(LESE)).toHaveCount(1);
    await expect(page.locator(FELD)).toHaveCount(0);
  });

  test('US-4: Live-Ereignis bei fokussiertem Lesediv hält den Fokus; e öffnet die Bearbeitung mit neuem Wert (AK 4)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await fensterOeffnen(page, 1);
    await page.locator(LESE).focus();
    const vorher = await page.evaluate(() => window.kdTest.renders());
    // fremder Schreibaufruf: Titeländerung über die API, während das Fenster offen und das Lesediv fokussiert ist
    const neu = TITEL_EINS + ' neu';
    expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: neu } })).ok()).toBe(true);
    await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 1000 }).toBeGreaterThan(vorher);
    expect(await page.evaluate(() => document.activeElement.matches('#fenster [data-act="titel-bearbeiten"]')),
      'der Fokus steht nach dem Neuzeichnen wieder auf dem Lesediv (Sicherer N1, Schlüssel titel-bearbeiten)').toBe(true);
    // e öffnet die Bearbeitung auch nach dem Neuzeichnen — mit dem neuen Titelwert
    await page.keyboard.press('e');
    await feldPruefen(page, neu);
  });

  test('US-5 (aufgehoben durch Betreiber-Entscheidung #144): ↑/↓ wechseln die Aufgabe nicht mehr', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await fensterOeffnen(page, 1);
    await page.locator(LESE).focus();
    // R00144 FA 9: das Blättern samt ↑/↓ ist gestrichen — das Fenster bleibt bei #1, auch im Lesediv
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#fenster')).toHaveAttribute('aria-label', 'Aufgabe #1');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#fenster')).toHaveAttribute('aria-label', 'Aufgabe #1');
    await page.keyboard.press('e');
    await feldPruefen(page, TITEL_EINS);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#fenster')).toHaveAttribute('aria-label', 'Aufgabe #1');
  });

  test('US-6: ein langes Einzelwort bricht innerhalb und bleibt im Fenster (AK 6)', async ({ page }) => {
    const bestand = { ...GRUNDBESTAND, 'aufgaben/0002-zwei.md': karte(2, EINZELWORT) };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    for (const [breite, hoehe] of [[1280, 800], [320, 568]]) {
      await breiteSetzen(page, breite, hoehe);
      await page.locator(`.ka[data-id="2"]`).waitFor();
      await fensterOeffnen(page, 2);
      const m = await titelMessen(page);
      expect(m.text, `${breite} px: das ganze Wort steht im Fenster, kein Auslassungszeichen`).toBe(EINZELWORT);
      expect(m.zeilen, `${breite} px: der Titel hat sichtbare Zeilen`).toBeGreaterThan(0);
      expect(m.abgeschnitten, `${breite} px: nichts abgeschnitten`).toBe(false);
      expect(m.imKoerper, `${breite} px: jede Zeile bleibt im sichtbaren Fensterkörper`).toBe(true);
      expect(m.quer, `${breite} px: der Fensterkörper scrollt nicht quer`).toBeLessThanOrEqual(1);
      expect(await breiteMessen(page, `US-6 ${breite}`), `${breite} px: kein Rahmen scrollt quer`).toEqual([]);
      // das Wort übersteitet die Zeile: es bricht innerhalb (break-word) statt das Fenster zu überlaufen
      if (breite === 320) expect(m.zeilen, `${breite} px: das Einzelwort bricht innerhalb des Wortes`).toBeGreaterThan(1);
      await page.keyboard.press('Escape');
      await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
    }
  });
});