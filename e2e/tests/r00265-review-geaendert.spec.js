// R00265 Review-Seite — Hinweis „Seit dem Haken verändert“ (Karte #268, I0255, ADR-0042 N8): AK 2–7 im echten Programm gegen echtes
// Git; hier AK 5 (Breite, Themen, Kontrast, Ansage). Ausgangslage: review-hilfen.js (`gesehenRepository`/`gesehenVorbereiten`;
// Aufgabe #3 = kd:k3 + wb:w3, der Commit K3b ändert `src/a.rs` um eine Zeile). Schichten: Testfälle → Testsprache (`seite`) →
// Treiber (Selektoren, Adressen, Speicher nur hier) → Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen } = require('./hilfen');
const { gesehenRepository, gesehenVorbereiten } = require('./review-hilfen');

const HINWEIS = 'Seit dem Haken verändert';
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const ANZ = 5;

/* ── Treiber: Adressen und Selektoren (nur hier) ── */

const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

function seite(page) {
  const name = pfad => pfad.slice(pfad.lastIndexOf('/') + 1);
  const zeile = (pfad, a = null) => page
    .locator(a === null ? '#review .dn-e' : `#rv-a${a} .dn-e`)
    .filter({ has: page.locator('.p b', { hasText: exakt(name(pfad)) }) });
  const datei = (pfad, a = null) => page
    .locator(a === null ? '#rv-insel section.df' : `#rv-a${a} section.df`)
    .filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const kaestchen = (pfad, a = null) => datei(pfad, a).locator('input.ru-ges-k');
  return {
    zeile, datei, kaestchen,
    zeileHinweis: (pfad, a = null) => zeile(pfad, a).locator('.ru-hg'),
    kopfHinweis: (pfad, a = null) => datei(pfad, a).locator('.ru-hg'),
    zeileText: () => page.locator('#rv-ges-z'),
    ganzeZeile: () => page.locator('#rv-ges-t'),
    live: () => page.locator('#rv-gesehen'),
    kaestchenAlle: () => page.locator('#rv-insel input.ru-ges-k'),
    speicher: () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(s => s.startsWith('kanbanD.gesehen.')).map(s => [s, localStorage.getItem(s)]))),
  };
}

async function alleOeffnen(page, k, nr) {
  await page.goto(alleAdresse(k, nr));
  await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
}

async function neuLaden(page) {
  await page.reload();
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

/** Hängt K3b über die API an Aufgabe #3 (wie ein Agent, der einen Commit hinterlegt). */
async function k3bAnhaengen(page, k, h) {
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/3/commits`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { commits: [`kd:${h.k3b}`] } });
  expect(antwort.ok()).toBe(true);
}

/** Öffnet die Dateiliste hinter „Dateien (n) und Commit“, wo das Fenster sie verbirgt (unter 1100 px). */
async function listeOeffnen(page) {
  const knopf = page.locator('#rv-auf');
  if (await knopf.isVisible() && (await knopf.getAttribute('aria-expanded')) !== 'true') await knopf.click();
}

test.describe('R00265 Hinweis „Seit dem Haken verändert“', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k, h, fehler;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    fehler = [];
    page.on('pageerror', f => fehler.push(String(f)));
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    h = gesehenRepository();
    k = await kanbanStarten(gesehenVorbereiten(h));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /** Der Zustand der Probe: Aufgabe #3 in „Alle Änderungen“, src/a.rs abgehakt, K3b geändert, neu geladen. */
  async function geaendertVorbereiten(page) {
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await s.kaestchen('src/a.rs').click();
    await expect(s.zeileText()).toHaveText(`1 von ${ANZ} gesehen`);
    await k3bAnhaengen(page, k, h);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`0 von ${ANZ} gesehen`);
    return s;
  }

  /* ── AK 5 Breite, Themen, Kontrast, Ansage ── */

  for (const themaName of ['light', 'dark']) {
    test(`AK 5 (${themaName}): 320/414/980/1280 px — kein Querscrollen, beide Hinweise ganz in der Breite, Text ≥ 4,5:1`, async ({ page }) => {
      const s = await geaendertVorbereiten(page);
      await thema(page, themaName);
      await expect(s.zeileHinweis('src/a.rs')).toHaveText(HINWEIS);
      await expect(s.kopfHinweis('src/a.rs')).toHaveText(HINWEIS);
      await expect(s.kopfHinweis('src/a.rs')).toHaveAttribute('title', HINWEIS);
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite);
        await listeOeffnen(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${breite}`).toBe(true);
        for (const [wer, ort] of [['Liste', s.zeileHinweis('src/a.rs')], ['Kopf', s.kopfHinweis('src/a.rs')]]) {
          const lage = await ort.evaluate(e => { const b = e.getBoundingClientRect(); return { links: b.left, rechts: b.right, breite: innerWidth }; });
          expect(lage.links, `${themaName} ${breite} ${wer}`).toBeGreaterThanOrEqual(0);
          expect(lage.rechts, `${themaName} ${breite} ${wer}`).toBeLessThanOrEqual(lage.breite);
        }
      }
      await breiteSetzen(page, 1280);
      const messungen = await kontrastMessen(page, ['.ru-hg']);
      expect(messungen.length).toBeGreaterThan(0);
      for (const m of messungen) expect(m.wert, `${themaName} ${m.element}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('AK 5: der Hinweis trägt das Gewand der .mk-Marke (Schrift --kd-muted, Fläche --kd-surface, Rand --kd-line-strong), kein Bedienelement', async ({ page }) => {
    const s = await geaendertVorbereiten(page);
    for (const themaName of ['light', 'dark']) {
      await thema(page, themaName);
      const farben = await page.evaluate(() => {
        const wert = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const probe = (name, eigenschaft) => { const p = document.createElement('span'); p.style[eigenschaft] = wert(name); document.body.append(p); const f = getComputedStyle(p)[eigenschaft]; p.remove(); return f; };
        const st = getComputedStyle(document.querySelector('.ru-hg'));
        return {
          farbe: st.color, grund: st.backgroundColor, rand: st.borderTopColor,
          token: { farbe: probe('--kd-muted', 'color'), grund: probe('--kd-surface', 'backgroundColor'), rand: probe('--kd-line-strong', 'borderTopColor') },
        };
      });
      expect(farben.farbe, themaName).toBe(farben.token.farbe);
      expect(farben.grund, themaName).toBe(farben.token.grund);
      expect(farben.rand, themaName).toBe(farben.token.rand);
    }
    for (const ort of [s.zeileHinweis('src/a.rs'), s.kopfHinweis('src/a.rs')]) {
      expect(await ort.evaluate(e => [e.localName, e.getAttribute('role'), e.getAttribute('tabindex')])).toEqual(['span', null, null]);
    }
  });

  test('AK 5: der Hinweis am Kopf ist per aria-describedby mit „Gesehen“ verbunden; der Hinweis löst keine Ansage aus', async ({ page }) => {
    const s = await geaendertVorbereiten(page);
    const kennung = await s.kaestchen('src/a.rs').getAttribute('aria-describedby');
    expect(kennung).toMatch(/^rv-hg/);
    await expect(page.locator(`#${kennung}`)).toHaveText(HINWEIS);
    await expect(s.kopfHinweis('src/a.rs')).toHaveAttribute('id', kennung);
    await expect(s.live()).toHaveText(`0 von ${ANZ} gesehen`);
    for (const ort of [s.zeileHinweis('src/a.rs'), s.kopfHinweis('src/a.rs')]) {
      expect(await ort.evaluate(e => Boolean(e.closest('[aria-live],[role="status"],[role="alert"]')))).toBe(false);
    }
    expect(fehler).toEqual([]);
  });
});
