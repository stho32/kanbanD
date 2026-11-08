// R00113 Struktur für Hilfstechnik (ADR-0018): Seitenüberschrift und Landmarks je Route und Zustand, abgeglichen gegen vHaupt().
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, ausMehr } = require('./hilfen');
const {
  grundbestand, arbeitMitEinerPhase, ROUTEN, ZUSTAENDE, APP_JS,
  gezeichnet, seitenueberschriftPruefen, landmarkenPruefen, sichtenVonVHaupt, vollstaendigkeitPruefen,
  ebenenPruefen, GESTALTUNG, gestaltungPruefen,
} = require('./struktur-hilfen');

// Breite der Spalten und der Seite vor dem Bau, „In Arbeit“ zugeklappt: gemessen mit getBoundingClientRect und scrollWidth am Stand
// 9e806a7 (Spalten unverändert seit f719975) über das Messskript der Karte #13 (bahnbreite.js, fotos.js, 2026-11-08). Handy mit Touch.
const SPALTEN_VORHER = [
  { breite: 1280, handy: false, bahnen: [272, 34, 272] },
  { breite: 414, handy: true, bahnen: [386, 49, 386] },
  { breite: 320, handy: true, bahnen: [292, 49, 292] },
];
const [ERSTER_START, EINRICHTUNGSMODUS, DEFEKTES_BOARD] = ZUSTAENDE;
const WBS_SICHT = ROUTEN.find(r => r.ansicht === 'WBS-Sicht');

let laufende = [];
test.afterEach(async () => {
  for (const aufraeumen of laufende.reverse()) await aufraeumen();
  laufende = [];
});

/** kanbanD mit dem Grundbestand der User Story; `mehr` überschreibt Dateien. */
async function starten(page, mehr = {}) {
  const arbeit = arbeitMitEinerPhase();
  laufende.push(async () => arbeit.aufraeumen());
  const k = await kanbanStarten(einrichten({ ...grundbestand(arbeit), ...mehr }));
  laufende.push(() => k.stoppen());
  await alsPerson(page, 'st');
  return k;
}

/** Öffnet jede Route und jeden Zustand und sammelt die Verstöße von `pruefen(page, eintrag)`. */
async function ueberAlleSeiten(page, pruefen) {
  const verstoesse = [];
  const k = await starten(page);
  for (const route of ROUTEN) {
    await page.goto(k.adresse + route.adresse);
    await gezeichnet(page, route.adresse, route.bereit);
    verstoesse.push(...await pruefen(page, route));
  }
  await page.goto(k.adresse + '#/board/entwicklung');
  await page.locator('.bahn').first().waitFor();
  await ausMehr(page, 'Spalten einrichten');
  await page.locator('.setup').waitFor();
  verstoesse.push(...await pruefen(page, EINRICHTUNGSMODUS));

  const defekt = await starten(page, { 'boards/entwicklung.md': '# Entwicklung\n- #1\n## A\n', 'boards/test.md': '# Test\n\n## Bereit\n' });
  await page.goto(defekt.adresse + '#/board/entwicklung');
  await page.locator('.defektflaeche').waitFor();
  verstoesse.push(...await pruefen(page, DEFEKTES_BOARD));

  const leer = await kanbanStarten();
  laufende.push(() => leer.stoppen());
  await page.goto(leer.adresse);
  await page.locator('.first').waitFor();
  verstoesse.push(...await pruefen(page, ERSTER_START));
  return verstoesse;
}

test.describe('R00113 Struktur für Hilfstechnik', () => {
  test.describe.configure({ timeout: 180000 });

  test('US-1: jede Route hat genau eine Seitenüberschrift', async ({ page }) => {
    expect(await ueberAlleSeiten(page, seitenueberschriftPruefen)).toEqual([]);
  });

  test('US-1: Landmarks je Route und Zustand, ohne navigation bei 560 px', async ({ page }) => {
    expect(await ueberAlleSeiten(page, landmarkenPruefen)).toEqual([]);
    await page.setViewportSize({ width: 560, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    await gezeichnet(page, '#/aufgaben');
    expect(await landmarkenPruefen(page, { ansicht: 'Aufgabenliste bei 560 px', ohneNavigation: true })).toEqual([]);
  });

  test('US-1: die Probe prüft jede Verzweigung von vHaupt()', () => {
    const quelltext = fs.readFileSync(APP_JS, 'utf8');
    expect(sichtenVonVHaupt(quelltext)).toHaveLength(15);
    expect(vollstaendigkeitPruefen(quelltext, [...ROUTEN, ...ZUSTAENDE])).toEqual([]);
  });

  test('US-2: M1 — eine zweite Überschrift erster Ebene in der WBS-Sicht macht die Probe rot', async ({ page }) => {
    await page.route('**/ansicht.js', async route => {
      const antwort = await route.fetch();
      const text = await antwort.text();
      const mutiert = text.replace('<h2 class="wbs-titel">', '<h1 class="wbs-titel">').replace('${nc}</h2>', '${nc}</h1>');
      expect(mutiert, 'Mutante M1 greift nicht').not.toBe(text);
      await route.fulfill({ response: antwort, body: mutiert });
    });
    const k = await starten(page);
    await page.goto(k.adresse + WBS_SICHT.adresse);
    await gezeichnet(page, WBS_SICHT.adresse, WBS_SICHT.bereit);
    expect(await seitenueberschriftPruefen(page, WBS_SICHT)).toEqual(['2 Überschriften erster Ebene in WBS-Sicht']);
  });

  test('US-2: M2 — eine Verzweigung mehr in vHaupt(), als die Probe prüft, macht die Probe rot', () => {
    const quelltext = fs.readFileSync(APP_JS, 'utf8');
    const mutiert = quelltext.replace("  if (S.ui.view === 'wbs') return vWbs();", "  if (S.ui.view === 'wbs') return vWbs();\n  if (S.ui.view === 'neu') return vNeueSicht();");
    expect(mutiert, 'Mutante M2 greift nicht').not.toBe(quelltext);
    expect(vollstaendigkeitPruefen(mutiert, [...ROUTEN, ...ZUSTAENDE])).toEqual(['Route ohne Prüfung: vNeueSicht() in vHaupt()']);
  });

  for (const vorher of SPALTEN_VORHER) {
    test.describe(`${vorher.breite} px`, () => {
      test.use({ viewport: { width: vorher.breite, height: 800 }, isMobile: vorher.handy, hasTouch: vorher.handy });

      test(`US-3: jede Spalte ist als Überschrift erreichbar, bei ${vorher.breite} px so breit wie vorher`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('kanbanD.spalten-zu.entwicklung', JSON.stringify(['In Arbeit'])));
        const k = await starten(page);
        await page.goto(k.adresse + '#/board/entwicklung');
        await gezeichnet(page, '#/board/entwicklung', '.bahn.zu');
        const spalten = await page.locator('#main section.bahn').evaluateAll(bahnen => bahnen.map(b => {
          const koepfe = [...b.querySelectorAll('h2')];
          const flaeche = koepfe.map(h => h.getBoundingClientRect()).map(r => r.width * r.height);
          return { koepfe: koepfe.map(h => h.textContent.trim()), sichtbar: flaeche.some(f => f > 1), breite: b.getBoundingClientRect().width };
        }));
        expect(await page.locator('#main h2').count()).toBe(3);
        expect(spalten.map(s => s.koepfe)).toEqual([['Zu erledigen'], ['In Arbeit'], ['Erledigt']]);
        expect(spalten.map(s => s.sichtbar)).toEqual([false, false, false]);
        expect(spalten.map(s => s.breite)).toEqual(vorher.bahnen);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), 'Seite scrollt nicht quer').toBe(vorher.breite);
      });
    });
  }

  test.describe('Abschnitte', () => {
    test('US-4: keine Route und kein Zustand springt eine Überschriftenebene', async ({ page }) => {
      expect(await ueberAlleSeiten(page, ebenenPruefen)).toEqual([]);
    });

    test('US-4: Abschnitte der Berichte, von Einrichten und der Aufgabenliste sind zweite Ebene und sehen aus wie vorher', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const k = await starten(page);
      const verstoesse = [];
      for (const seite of GESTALTUNG.filter(g => g.adresse)) {
        await page.goto(k.adresse + seite.adresse);
        await gezeichnet(page, seite.adresse, seite.kopf);
        verstoesse.push(...await gestaltungPruefen(page, seite));
      }
      await page.goto(k.adresse + '#/board/entwicklung');
      await page.locator('.bahn').first().waitFor();
      await ausMehr(page, 'Spalten einrichten');
      await page.locator('.setup').waitFor();
      verstoesse.push(...await gestaltungPruefen(page, GESTALTUNG.find(g => g.ansicht === 'Einrichtungsmodus')));
      expect(verstoesse).toEqual([]);
    });
  });

  test.describe('Karten', () => {
    const spalte = (page, name) => page.locator(`#main section.bahn[data-col="${name}"]`);
    /** Zugänglicher Name je Listeneintrag einer Spalte, wie ihn die Hilfstechnik ansagt (leer ohne Namen). */
    const namenDerSpalte = (page, name) => spalte(page, name).getByRole('list').getByRole('listitem')
      .evaluateAll(eintraege => eintraege.map(e => e.getAttribute('aria-label') || ''));
    const NAMEN_ZU_ERLEDIGEN = ['#1 eins, Fehler', '#2 zwei, Funktion', '#3 Ölwechsel & <Prüfung>'];

    test('US-5: Karte #1 wird als „#1 eins, Fehler“ angesagt', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const liste = spalte(page, 'Zu erledigen').getByRole('list');
      await expect(liste).toHaveCount(1);
      const eintraege = liste.getByRole('listitem');
      await expect(eintraege).toHaveCount(3);
      const namen = await namenDerSpalte(page, 'Zu erledigen');
      expect(namen).toEqual(NAMEN_ZU_ERLEDIGEN);
      const eins = liste.getByRole('listitem', { name: '#1 eins, Fehler', exact: true });
      await expect(eins.getByRole('button', { name: /Neue E-Mail/ })).toHaveCount(1);
      await expect(eins.getByRole('link').first()).toHaveAccessibleName(/\S/);
      expect(await eins.ariaSnapshot()).toContain('fällig 28.10.2026');
      expect(namen[0]).not.toMatch(/\d{1,2}\.\d{1,2}\.|bug/);
    });

    test('US-6: die Auswahl wird mit angesagt, ohne aria-selected', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const eins = page.locator('.ka[data-id="1"]');
      await eins.click({ modifiers: ['ControlOrMeta'] });
      await expect(eins).toHaveClass(/gewaehlt/);
      await expect(eins).toHaveAttribute('aria-label', '#1 eins, Fehler, ausgewählt');
      await expect(page.locator('#main [aria-selected]')).toHaveCount(0);
      await eins.click({ modifiers: ['ControlOrMeta'] });
      await expect(eins).not.toHaveClass(/gewaehlt/);
      await expect(eins).toHaveAttribute('aria-label', '#1 eins, Fehler');
    });

    test('US-7: defekte und fehlende Karten haben einen Namen', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const liste = spalte(page, 'In Arbeit').getByRole('list');
      await expect(liste.getByRole('listitem', { name: '#4 Datei defekt, nur lesbar', exact: true })).toHaveCount(1);
      await expect(liste.getByRole('listitem', { name: '#9 Aufgabe fehlt', exact: true })).toHaveCount(1);
    });

    test('US-8: der Name folgt einer Änderung durch einen Agenten, ohne Neuladen', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await page.evaluate(() => { window.ohneNeuladen = true; });
      const antwort = await page.request.patch(k.adresse + 'api/aufgaben/2', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'umbenannt' } });
      expect(antwort.ok()).toBe(true);
      await expect.poll(() => page.evaluate(() => window.kdTest.gezeichnet())).toBe(true);
      const zwei = spalte(page, 'Zu erledigen').getByRole('listitem', { name: '#2 umbenannt, Funktion', exact: true });
      await expect(zwei).toHaveCount(1);
      await expect(zwei.locator('.t')).toHaveText('umbenannt');
      expect(await page.evaluate(() => window.ohneNeuladen)).toBe(true);
    });

    test('US-5: M3 — ohne aria-label an .ka macht die Probe rot', async ({ page }) => {
      await page.route('**/ansicht.js', async route => {
        const antwort = await route.fetch();
        const text = await antwort.text();
        const mutiert = text.replace('role="listitem" aria-label="${esc(kartenName(', 'role="listitem" data-m3="${esc(kartenName(');
        expect(mutiert, 'Mutante M3 greift nicht').not.toBe(text);
        await route.fulfill({ response: antwort, body: mutiert });
      });
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const namen = await namenDerSpalte(page, 'Zu erledigen');
      expect(namen).toEqual(['', '', '']);
      expect(namen).not.toEqual(NAMEN_ZU_ERLEDIGEN);
    });
  });
});
