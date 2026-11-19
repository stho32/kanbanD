// R00201 (Karte #206, Bug): die Personenwahl im Stundenzettel macht die Seite mit vielen Personen breiter als das Fenster.
// Ausgangslage: 20 aktive Personen (zwei Namen ≥ 30 Zeichen, einer ≥ 60 Zeichen und breiter als die Leiste bei 414 px),
// „Gast“ stillgelegt, im Tab ist Stefan gewählt. Gemessen wird gegen documentElement.clientWidth, nicht gegen innerWidth.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, thema, kontrastFarben, mutanteEinsetzen } = require('./hilfen');

const heute = (h, m) => { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(h)}:${p(m)}`; };
const ALS_STEFAN = { headers: { 'X-KanbanD-Wer': 'st' } };
const ALS_CLAUDE = { headers: { 'X-KanbanD-Wer': 'cl' } };

const NAME_34 = 'Entwicklertesterin Oberfläche Nord';
const NAME_38 = 'Sicherheitsprüferin Schnittstellen Ost';
const NAME_76 = 'Entwicklertesterin Oberfläche Nord für die Abnahme der Stundenzettel-Ansicht';
const NEUE_PERSONEN = [
  ['n01', NAME_34, 'agent'], ['n02', NAME_38, 'agent'], ['n03', NAME_76, 'agent'],
  ...Array.from({ length: 14 }, (_, i) => [`n${String(i + 4).padStart(2, '0')}`, `Agent Nummer ${i + 4}`, 'agent']),
];
/** Reihenfolge von `personen()`: Grundbestand der Helfer (Stefan, Mia, Claude), dann in der Reihenfolge des Anlegens. */
const AKTIVE = [['st', 'Stefan'], ['mi', 'Mia'], ['cl', 'Claude'], ...NEUE_PERSONEN.map(([kuerzel, name]) => [kuerzel, name])];
const LEERFALL = '— Person wählen —';

async function ausgangslageSchaffen(k) {
  const api = k.adresse + 'api/personen';
  for (const [kuerzel, name, art] of NEUE_PERSONEN) {
    const antwort = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-KanbanD-Wer': 'st' }, body: JSON.stringify({ kuerzel, name, art }) });
    expect(antwort.status, `Person ${kuerzel} anlegen`).toBe(201);
  }
  const gast = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-KanbanD-Wer': 'st' }, body: JSON.stringify({ kuerzel: 'ga', name: 'Gast', art: 'human' }) });
  expect(gast.status).toBe(201);
  const still = await fetch(`${api}/ga`, { method: 'DELETE', headers: { 'X-KanbanD-Wer': 'st' } });
  expect(still.ok, 'Gast stilllegen').toBe(true);
}

const ZEITEN = `---\nid: 1\ntitle: eins\n---\n\`\`\`kanbanD-time\n${heute(1, 0)} · ${heute(2, 30)} · st\n${heute(3, 0)} · ${heute(3, 30)} · cl\n\`\`\`\n`;
const BESTAND = einrichten({
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': ZEITEN,
});

const wahl = page => page.getByRole('combobox', { name: 'Person', exact: true });

/** Stundenzettel öffnen und warten, bis die Tabelle steht. */
async function stundenzettelOeffnen(page, k) {
  await page.goto(k.adresse + '#/berichte/stundenzettel');
  await bereit(page, '#stundenzettel');
}

/** Querscrollen und Lage in einem Zug: documentElement gegen clientWidth, rechte Kante der Personenwahl, Oberkante der Tabelle. */
const lage = page => page.evaluate(() => {
  const dokument = document.documentElement;
  const wahlDomElement = document.querySelector('[aria-label="Person"]');
  const rect = wahlDomElement ? wahlDomElement.getBoundingClientRect() : null;
  return {
    scrollWidth: dokument.scrollWidth, clientWidth: dokument.clientWidth,
    wahlRechts: rect ? rect.right : null, wahlBreite: rect ? rect.width : null,
    tabelleOben: document.getElementById('stundenzettel').getBoundingClientRect().top,
  };
});

for (const [breite, mobil] of [[1280, false], [320, true], [375, true], [414, true]]) {
  test.describe(`R00201 mit 20 Personen bei ${breite} px`, () => {
    test.use({ viewport: { width: breite, height: 844 }, isMobile: mobil, hasTouch: mobil });
    let k;
    test.beforeEach(async ({ page }) => {
      k = await kanbanStarten(BESTAND);
      await ausgangslageSchaffen(k);
      await alsPerson(page, 'st');
      await mutanteEinsetzen(page);
    });
    test.afterEach(() => k.stoppen());

    for (const name of ['light', 'dark']) {
      test(`AK 1: ${name}: die Seite scrollt nicht quer, die Personenwahl endet im Fenster`, async ({ page }) => {
        await stundenzettelOeffnen(page, k);
        await thema(page, name);
        const m = await lage(page);
        expect(m.scrollWidth, `scrollWidth ${m.scrollWidth} gegen clientWidth ${m.clientWidth}`).toBeLessThanOrEqual(m.clientWidth);
        expect(m.wahlRechts, 'rechte Kante der Personenwahl').not.toBeNull();
        expect(m.wahlRechts).toBeLessThanOrEqual(m.clientWidth);
      });
    }

    test('AK 2: eine Auswahlliste mit den aktiven Personen, ohne Radiogruppe', async ({ page }) => {
      await stundenzettelOeffnen(page, k);
      await expect(page.getByRole('radiogroup', { name: 'Person' })).toHaveCount(0);
      await expect(wahl(page)).toHaveCount(1);
      expect(await wahl(page).evaluate(e => [e.tagName, e.classList.contains('mini-inp'), e.querySelector('optgroup') === null])).toEqual(['SELECT', true, true]);
      const eintraege = await wahl(page).locator('option').evaluateAll(os => os.map(o => [o.value, o.textContent]));
      expect(eintraege).toEqual(AKTIVE);
      expect(eintraege.map(([kuerzel]) => kuerzel)).not.toContain('ga');
      await expect(wahl(page)).toHaveValue('st');
    });

    test('AK 6: die Tabelle beginnt weit oben', async ({ page }) => {
      test.skip(breite !== 375, 'gemessen bei 375 px');
      await stundenzettelOeffnen(page, k);
      expect((await lage(page)).tabelleOben).toBeLessThanOrEqual(400);
    });

    test('AK 3: jede Person ist wählbar, ein Tipp trifft die Liste', async ({ page }) => {
      test.skip(breite !== 1280 && breite !== 375, 'gemessen bei 1280 und 375 px');
      await stundenzettelOeffnen(page, k);
      if (mobil) {
        const treffer = await wahl(page).evaluate(e => { const r = e.getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e; });
        expect(treffer, 'ein Tipp auf die Mitte trifft die Liste selbst').toBe(true);
      }
      if (breite !== 1280) return;
      for (const [kuerzel, name] of AKTIVE) {
        await wahl(page).selectOption(kuerzel);
        await expect(wahl(page)).toHaveValue(kuerzel);
        if (kuerzel === 'st') await expect(page.locator('#zettelsumme')).toHaveText('1:30');
        else if (kuerzel === 'cl') await expect(page.locator('#zettelsumme')).toHaveText('0:30');
        else await expect(page.locator('#stundenzettel tbody')).toContainText(`${name} hat in dieser Woche keine Zeiten.`);
      }
    });

    test('AK 4: ohne aktive eigene Person steht „— Person wählen —“ vor, ohne Vorwahl', async ({ page }) => {
      test.skip(breite !== 1280 && breite !== 375, 'gemessen bei 1280 und 375 px');
      await page.addInitScript(() => sessionStorage.setItem('kanbanD.ich', 'ga'));
      await stundenzettelOeffnen(page, k);
      const erster = wahl(page).locator('option').first();
      await expect(erster).toHaveText(LEERFALL);
      expect(await erster.evaluate(o => [o.getAttribute('value'), o.selected, o.disabled])).toEqual(['', true, true]);
      await expect(wahl(page)).toHaveValue('');
      await expect(wahl(page).locator('option')).toHaveCount(AKTIVE.length + 1);
      await wahl(page).selectOption('st');
      await expect(page.locator('#zettelsumme')).toHaveText('1:30');
      await expect(wahl(page).locator('option')).toHaveCount(AKTIVE.length);
      await expect(wahl(page).locator('option', { hasText: LEERFALL })).toHaveCount(0);
    });
  });
}

test.describe('R00201 bei 1280 px', () => {
  test.use({ viewport: { width: 1280, height: 844 } });
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(BESTAND);
    await ausgangslageSchaffen(k);
    await alsPerson(page, 'st');
    await mutanteEinsetzen(page);
  });
  test.afterEach(() => k.stoppen());

  /** Breite der Liste gegen die Textbreite des Namens in der berechneten Schrift der Liste (Canvas measureText). */
  const textbreite = (ort, text) => ort.evaluate((e, t) => {
    const stil = getComputedStyle(e);
    const kontext = document.createElement('canvas').getContext('2d');
    kontext.font = `${stil.fontStyle} ${stil.fontWeight} ${stil.fontSize} ${stil.fontFamily}`;
    return kontext.measureText(t).width;
  }, text);

  test('AK 1b: die Liste ist so breit wie ihr längster Eintrag, höchstens so breit wie die Leiste', async ({ page }) => {
    await stundenzettelOeffnen(page, k);
    const m = await lage(page);
    const leiste = await wahl(page).evaluate(e => e.closest('.leiste').getBoundingClientRect().width);
    expect(m.wahlBreite).toBeGreaterThanOrEqual(await textbreite(wahl(page), NAME_34) + 24);
    expect(m.wahlBreite).toBeLessThanOrEqual(leiste);
  });

  test('AK 1b: im Leerfall ist die Liste mindestens so breit wie „— Person wählen —“', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('kanbanD.ich', 'ga'));
    await stundenzettelOeffnen(page, k);
    const m = await lage(page);
    expect(m.wahlBreite).toBeGreaterThanOrEqual(await textbreite(wahl(page), LEERFALL) + 24);
  });

  test('AK 5: Tab erreicht die Liste mit einem Halt, ↓ wählt die nächste Person, der Fokus bleibt', async ({ page }) => {
    await stundenzettelOeffnen(page, k);
    await page.locator('.leiste b', { hasText: 'Stundenzettel' }).click();
    await page.keyboard.press('Tab');
    await expect(wahl(page)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(wahl(page)).toHaveValue('mi');
    await expect(page.locator('#stundenzettel tbody')).toContainText('Mia hat in dieser Woche keine Zeiten.');
    await expect(wahl(page)).toBeFocused();
  });

  for (const name of ['light', 'dark']) {
    test(`AK 5: ${name}: der Fokusring der Liste hat mindestens 3:1 gegen den Grund`, async ({ page }) => {
      await stundenzettelOeffnen(page, k);
      await thema(page, name);
      await wahl(page).focus();
      const ring = await wahl(page).evaluate(e => {
        const stil = getComputedStyle(e);
        return { farbe: stil.outlineColor, stil: stil.outlineStyle, breite: parseFloat(stil.outlineWidth), grund: getComputedStyle(e.closest('.leiste')).backgroundColor };
      });
      expect(ring.stil).not.toBe('none');
      expect(ring.breite).toBeGreaterThanOrEqual(2);
      expect(await kontrastFarben(page, ring.farbe, ring.grund)).toBeGreaterThanOrEqual(3);
    });
  }

  test('AK 9: ein fremdes Live-Ereignis lässt dieselbe Liste mit Fokus und Wahl stehen', async ({ page }) => {
    await stundenzettelOeffnen(page, k);
    await wahl(page).selectOption('cl');
    await expect(page.locator('#zettelsumme')).toHaveText('0:30');
    await wahl(page).focus();
    await page.evaluate(() => { window.gemerkteListe = document.activeElement; });
    const vorher = await page.evaluate(() => window.kdTest.renders());
    const antwort = await page.request.patch(`${k.adresse}api/aufgaben/1`, { ...ALS_CLAUDE, data: { titel: 'eins neu' } });
    expect(antwort.ok()).toBe(true);
    await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 3000 }).toBeGreaterThan(vorher);
    await expect(page.locator('#stundenzettel tbody')).toContainText('eins neu');
    expect(await page.evaluate(() => document.activeElement === window.gemerkteListe), 'dieselbe Liste hat den Fokus').toBe(true);
    await expect(wahl(page)).toHaveValue('cl');
  });

  test('AK 9: kommt mit dem Ereignis eine neue Person, bleibt der Knoten und die Liste zeigt sie', async ({ page }) => {
    await stundenzettelOeffnen(page, k);
    await wahl(page).focus();
    await page.evaluate(() => { window.gemerkteListe = document.activeElement; });
    const vorher = await page.evaluate(() => window.kdTest.renders());
    const antwort = await page.request.post(`${k.adresse}api/personen`, { ...ALS_STEFAN, data: { kuerzel: 'neu', name: 'Neuling', art: 'agent' } });
    expect(antwort.status()).toBe(201);
    await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 3000 }).toBeGreaterThan(vorher);
    await expect(wahl(page).locator('option')).toHaveCount(AKTIVE.length + 1);
    expect(await page.evaluate(() => document.querySelector('[aria-label="Person"]') === window.gemerkteListe)).toBe(true);
    await expect(wahl(page)).toHaveValue('st');
  });
});

test.describe('R00201 mit dem Grundbestand (3 Personen)', () => {
  test.use({ viewport: { width: 375, height: 844 }, isMobile: true, hasTouch: true });
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(BESTAND);
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('AK 2: auch mit 3 Personen eine Auswahlliste, keine Radiogruppe', async ({ page }) => {
    await stundenzettelOeffnen(page, k);
    await expect(page.getByRole('radiogroup', { name: 'Person' })).toHaveCount(0);
    expect(await wahl(page).locator('option').evaluateAll(os => os.map(o => [o.value, o.textContent]))).toEqual([['st', 'Stefan'], ['mi', 'Mia'], ['cl', 'Claude']]);
  });
});
