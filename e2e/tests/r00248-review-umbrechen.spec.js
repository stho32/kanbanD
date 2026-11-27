// R00248 Review-Seite — lange Zeilen umbrechen (Karte #259, I0238, Scheibe S6 von ADR-0042 Punkt 8): AK 1–10 und US-1..US-6 im echten
// Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`umbrechenRepository`: U1 mit K-Lang und K-Kurz, U2 K-Zwei, U3 K-Last, U4 ohne Dateien).
// Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Adressen, Messungen nur hier) → Programm.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastFarben, farbPixel } = require('./hilfen');
const { umbrechenRepository, umbrechenVorbereiten, UM_A, UM_B, WM_BREIT } = require('./review-hilfen');

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

function seite(page) {
  const schalter = page.locator('#review .rv-leiste label.ru-sch').filter({ has: page.locator('#rv-umbr') });
  const eingabe = schalter.locator('input[type=checkbox][role=switch]');
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const bereich = pfad => datei(pfad).locator('.df-sc');
  /** Die erste Zeile `art` (del/add) mit genau dem Zeilentext `text`. */
  const zeile = (pfad, art, text) => bereich(pfad).locator(`tr.${art}`).filter({ has: page.locator('td.c', { hasText: exakt(`${art === 'add' ? 'hinzugefügt: ' : 'entfernt: '}${text}`) }) }).first();
  return {
    schalter, eingabe, datei, bereich, zeile,
    commitOeffnen: async (k, nr, commit) => {
      await page.goto(commitAdresse(k, nr, commit));
      await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    },
    alleOeffnen: async (k, nr) => {
      await page.goto(alleAdresse(k, nr));
      await page.locator('#rv-insel section.df').first().waitFor();
    },
    umbrechen: () => page.locator('#review').evaluate(r => r.classList.contains('umbr')),
    /** Ein Zustand der Seite, der sich durch das Umschalten nicht ändern darf. */
    zustand: () => page.evaluate(() => ({
      dateien: Array.from(document.querySelectorAll('#rv-insel .df-k[aria-expanded]'), b => b.getAttribute('aria-expanded')),
      gruppen: Array.from(document.querySelectorAll('#rv-insel [id^="rv-gk"][aria-expanded]'), b => b.getAttribute('aria-expanded')),
      gesehen: (document.querySelector('.rv-ges') || {}).textContent || '',
      alle: (document.getElementById('rv-alle') || {}).textContent || '',
      adresse: location.hash,
    })),
  };
}

/** Hält fest, ob die Farbe eines Diffbereichs entschieden ist (`data-farbe` ja oder nein). */
const farbeAbwarten = (page, bereich) => bereich.elementHandle().then(el => page.waitForFunction(e => e.dataset.farbe === 'ja' || e.dataset.farbe === 'nein', el, { timeout: 15000 }));

/** Die Textzeilen einer Zelle `td.c` (ohne Lesetext): verschiedene Oberkanten der Rechtecke des Textes; dazu, ob rechts etwas übersteht. */
const textZeilen = zelle => zelle.evaluate(c => {
  const lesen = c.querySelector('.vh'), r = document.createRange();
  r.selectNodeContents(c);
  if (lesen) r.setStartAfter(lesen);
  // der Block `content-visibility:auto` schneidet über seine Kante hinaus ab, ohne `scrollWidth` zu vergrößern: gemessen wird am Sichtbereich
  const rand = Math.min(c.getBoundingClientRect().right, c.closest('.df-sc').getBoundingClientRect().right);
  const rechtecke = Array.from(r.getClientRects()).filter(q => q.width > 0);
  return { zeilen: new Set(rechtecke.map(q => Math.round(q.top))).size, ueber: rechtecke.filter(q => q.right > rand + 0.5).length };
});

/** Maße einer Zeile: Höhe, Oberkanten von Nummer und Zeichen, Höhe von `td.n`/`td.m`, Hintergründe, Zahl der Nummern. */
const zeilenMasse = tr => tr.evaluate(z => {
  const t = z.getBoundingClientRect().top, n = z.querySelector('td.n'), m = z.querySelector('td.m'), c = z.querySelector('td.c');
  // Lage des Textes in der Zelle (nicht der Zelle selbst: eine mittig gesetzte Nummer steht in einer ganzhohen Zelle)
  const textTop = zelle => { const r = document.createRange(); r.selectNodeContents(zelle); const q = Array.from(r.getClientRects()).find(x => x.width > 0); return q ? q.top - t : null; };
  const nummer = Array.from(z.querySelectorAll('td.n')).find(x => x.textContent.trim());
  return { hoehe: z.offsetHeight, nTop: textTop(nummer), mTop: textTop(m), nHoehe: n.offsetHeight, mHoehe: m.offsetHeight, mGrund: getComputedStyle(m).backgroundColor, cGrund: getComputedStyle(c).backgroundColor, nummern: z.querySelectorAll('td.n').length };
});

const quer = bereich => bereich.evaluate(b => [b.scrollWidth, b.clientWidth]);
const seitenQuer = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

/** Farbe der Kante einer Marke aus dem berechneten Stil (Schatten). */
const kantenStil = marke => marke.evaluate(m => {
  const s = getComputedStyle(m), schatten = s.boxShadow;
  const farbe = schatten === 'none' ? null : schatten.match(/^((?:rgba?|oklch|oklab|lab|lch|color|hsla?)\([^)]*\)|#[0-9a-f]+|\w+)/i)[1];
  return { farbe, randLinks: s.borderLeftWidth, randRechts: s.borderRightWidth, paddingLinks: s.paddingLeft, paddingRechts: s.paddingRight };
});

/** Je Rechteck der Marke: hat die unterste 2-px-Reihe über die ganze Breite die Kantenfarbe (±2 je Kanal)? (R00247 AK 8, Bildschirmfoto) */
async function kanteDurchgehend(page, marke, farbe) {
  const soll = await farbPixel(page, farbe);
  await marke.scrollIntoViewIfNeeded();
  const rechtecke = await marke.evaluate(m => Array.from(m.getClientRects(), r => ({ x: r.left, y: r.top, w: r.width, h: r.height })));
  const ergebnisse = [];
  for (const r of rechtecke) {
    const links = Math.ceil(r.x), rechts = Math.floor(r.x + r.w), unten = Math.round(r.y + r.h);
    const bild = (await page.screenshot({ clip: { x: links, y: unten - 2, width: rechts - links, height: 2 }, animations: 'disabled' })).toString('base64');
    ergebnisse.push(await page.evaluate(async ([daten, sollPixel]) => {
      const img = new Image();
      img.src = `data:image/png;base64,${daten}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let anzahl = 0;
      for (let p = 0; p < d.length; p += 4) if ([0, 1, 2].some(i => Math.abs(d[p + i] - sollPixel[i]) > 2)) anzahl++;
      return { breite: c.width, anzahl };
    }, [bild, soll]));
  }
  return ergebnisse;
}

/** Long Tasks ab dem Laden (PerformanceObserver `longtask`, ereignisgenau). */
function langeAufgabenSammeln() {
  window.kdLang = [];
  new PerformanceObserver(l => l.getEntries().forEach(e => window.kdLang.push({ start: e.startTime, dauer: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
}
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
/** Lage der Oberkante eines Knotens zur Oberkante der Rolle `#review`. */
const lage = knoten => knoten.evaluate(e => e.getBoundingClientRect().top - document.getElementById('review').getBoundingClientRect().top);
/** Rollt `#review` so, dass die Oberkante des Knotens `ziel` px unter der Oberkante der Rolle steht. */
const rollenAuf = (knoten, ziel) => knoten.evaluate((e, z) => { const r = document.getElementById('review'); r.scrollTop += e.getBoundingClientRect().top - r.getBoundingClientRect().top - z; }, ziel);

test.describe('R00248 Review-Seite — lange Zeilen umbrechen', () => {
  let k;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(umbrechenVorbereiten(umbrechenRepository()));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1 Schalter und Zustand (US-1) ── */

  test('AK 1: Schalter „Umbrechen“ neben „Alle einklappen“ in Ein Commit und Alle Änderungen, nicht ohne Dateien', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    await expect(s.schalter).toHaveCount(1);
    await expect(s.schalter).toHaveText('Umbrechen');
    await expect(s.eingabe).not.toBeChecked();
    expect(await s.umbrechen()).toBe(false);
    expect(await page.evaluate(() => document.getElementById('rv-alle').nextElementSibling === document.getElementById('rv-umbr').closest('label.ru-sch'))).toBe(true);
    await s.alleOeffnen(k, 9);
    await expect(s.schalter).toHaveCount(1);
    await expect(s.eingabe).not.toBeChecked();
    await s.commitOeffnen(k, 11, umbrechenRepository().leer);
    await expect(page.locator('#review .rv-leer')).toHaveText('Dieser Commit ändert keine Dateien.');
    await expect(s.schalter).toHaveCount(0);
  });

  for (const ansicht of ['commit', 'alle']) {
    test(`AK 1: ${ansicht} — Klick auf das Label schaltet um, ohne Anfrage, ohne Neuzeichnen, Zustand und Fokus bleiben`, async ({ page }) => {
      const s = seite(page);
      if (ansicht === 'commit') await s.commitOeffnen(k, 9, umbrechenRepository().u1); else await s.alleOeffnen(k, 9);
      const zeile = s.bereich('src/kurz.rs').locator('tr.add').first();
      await expect(zeile).toBeVisible();
      await zeile.evaluate(tr => { tr.kdMarke = 'vorab'; });
      await page.evaluate(() => { for (const e of [document.getElementById('review'), document.getElementById('rv-umbr'), document.getElementById('rv-alle'), document.querySelector('.rv-leiste'), document.querySelector('#rv-insel')]) e.kdMarke = 'vorab'; });
      const knotenGleich = () => page.evaluate(() => [document.getElementById('review'), document.getElementById('rv-umbr'), document.getElementById('rv-alle'), document.querySelector('.rv-leiste'), document.querySelector('#rv-insel')].map(e => e.kdMarke));
      const vorher = await s.zustand();
      const anfragen = [];
      page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) anfragen.push(r.url()); });
      await s.schalter.click();
      await expect(s.eingabe).toBeChecked();
      expect(await s.umbrechen()).toBe(true);
      expect(await s.eingabe.evaluate(e => document.activeElement === e), 'Fokus auf dem Schalter').toBe(true);
      expect(await zeile.evaluate(tr => tr.kdMarke), 'dieselbe Zeile').toBe('vorab');
      expect(await knotenGleich(), 'Rolle, Schalter, Knopf, Kopfzeile und Insel sind dieselben Knoten').toEqual(Array(5).fill('vorab'));
      expect(await s.zustand()).toEqual(vorher);
      await s.schalter.click();
      await expect(s.eingabe).not.toBeChecked();
      expect(await s.umbrechen()).toBe(false);
      expect(await zeile.evaluate(tr => tr.kdMarke)).toBe('vorab');
      expect(await s.zustand()).toEqual(vorher);
      expect(anfragen, 'keine Anfrage an den Server').toEqual([]);
    });
  }

  /* ── AK 8 Tastatur, Ansage, sichtbarer Zustand (US-6) ── */

  test('AK 8: Tab erreicht den Schalter nach „Alle einklappen“, Leertaste schaltet, Name bleibt, Fokusring ganz sichtbar', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    await page.locator('#rv-alle').focus();
    await page.keyboard.press('Tab');
    await expect(s.eingabe).toBeFocused();
    const schalter = page.getByRole('switch', { name: 'Umbrechen', exact: true });
    await expect(schalter).not.toBeChecked();
    await page.keyboard.press('Space');
    await expect(page.getByRole('switch', { name: 'Umbrechen', exact: true })).toBeChecked();
    await expect(s.eingabe).toBeFocused();
    const ring = await s.eingabe.evaluate(e => {
      const st = getComputedStyle(e), r = e.getBoundingClientRect(), a = document.getElementById('review').getBoundingClientRect();
      const aussen = (parseFloat(st.outlineOffset) || 0) + (parseFloat(st.outlineWidth) || 0);
      return { stil: st.outlineStyle, aussen, drin: r.left - aussen >= a.left && r.right + aussen <= a.right && r.top - aussen >= a.top && r.bottom + aussen <= a.bottom };
    });
    expect(ring.stil).not.toBe('none');
    expect(ring.drin, 'der Fokusring ist nicht beschnitten').toBe(true);
    await page.keyboard.press('Space');
    await expect(page.getByRole('switch', { name: 'Umbrechen', exact: true })).not.toBeChecked();
  });

  for (const thm of ['light', 'dark']) {
    test(`AK 8: ${thm} — Form und Farbe des Schalters sind an und aus verschieden, Rand ≥ 3:1 gegen den Grund`, async ({ page }) => {
      const s = seite(page);
      await thema(page, thm);
      await s.commitOeffnen(k, 9, umbrechenRepository().u1);
      const messen = () => s.eingabe.evaluate(e => {
        const st = getComputedStyle(e);
        return { form: st.backgroundPosition, farbe: st.backgroundColor, rand: st.borderTopColor, randBreite: st.borderTopWidth, grund: getComputedStyle(e.closest('.rv-leiste')).backgroundColor };
      });
      await expect.poll(async () => (await messen()).randBreite, 'der Schalter ist gezeichnet').toMatch(/px$/);
      const aus = await messen();
      await s.schalter.click();
      await expect(s.eingabe).toBeChecked();
      const an = await messen();
      expect(an.form, 'Lage des Daumens').not.toBe(aus.form);
      expect(an.farbe, 'gefüllte Fläche').not.toBe(aus.farbe);
      for (const m of [aus, an]) {
        expect(parseFloat(m.randBreite)).toBeGreaterThanOrEqual(1);
        expect(await kontrastFarben(page, m.rand, m.grund)).toBeGreaterThanOrEqual(3);
      }
    });
  }

  /* ── AK 8 (Erweiterung, PO Z. 681): bei grobem Zeiger bleibt der Schalter, wie er gezeichnet ist ── */

  test.describe('grober Zeiger', () => {
    test.use({ hasTouch: true });
    for (const breite of [375, 320]) {
      test(`AK 8: Touch bei ${breite} px — das Eingabefeld misst 40×22 px (±1), das Label ist mindestens 48 px hoch, an und aus unterscheiden sich in der Form`, async ({ page }) => {
        const s = seite(page);
        await breiteSetzen(page, breite, 800);
        expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), 'der Kontext hat einen groben Zeiger').toBe(true);
        await s.commitOeffnen(k, 9, umbrechenRepository().u1);
        const messen = () => s.schalter.evaluate(l => {
          const e = l.querySelector('input'), r = e.getBoundingClientRect(), st = getComputedStyle(e);
          return { breite: r.width, hoehe: r.height, label: l.getBoundingClientRect().height, form: st.backgroundPosition, farbe: st.backgroundColor };
        });
        await expect.poll(async () => (await messen()).farbe, 'der Schalter ist gezeichnet').not.toBe('');
        const aus = await messen();
        await s.eingabe.evaluate(e => e.click());
        await expect(s.eingabe).toBeChecked();
        await zweiBilder(page);
        const an = await messen();
        for (const m of [aus, an]) {
          expect(m.breite, `Breite ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(39);
          expect(m.breite, `Breite ${JSON.stringify(m)}`).toBeLessThanOrEqual(41);
          expect(m.hoehe, `Höhe ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(21);
          expect(m.hoehe, `Höhe ${JSON.stringify(m)}`).toBeLessThanOrEqual(23);
          expect(m.label, 'Zielfläche des Labels').toBeGreaterThanOrEqual(48);
        }
        expect(an.form, 'Lage des Daumens').not.toBe(aus.form);
        expect(an.farbe, 'gefüllte Fläche').not.toBe(aus.farbe);
      });
    }
  });

  /* ── AK 2 Wirkung (US-2) ── */

  test('AK 2: bei „aus“ scrollt der Code quer und Fall (a) ist eine Zeile hoch; bei „an“ nicht, Höhe = Textzeilen × 18 px, Nummer und Zeichen oben', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    const a = s.zeile('src/u.rs', 'add', UM_A), b = s.zeile('src/u.rs', 'add', UM_B), kurz = s.zeile('src/kurz.rs', 'add', 'let a = 2;');
    await expect(a).toBeVisible();
    const [sw, cw] = await quer(s.bereich('src/u.rs'));
    expect(sw, 'aus: quer scrollbar').toBeGreaterThan(cw);
    const aus = { a: await zeilenMasse(a), kurz: await zeilenMasse(kurz), nummern: await s.bereich('src/u.rs').locator('td.n').count() };
    expect(aus.a.hoehe).toBe(18);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    const [sw2, cw2] = await quer(s.bereich('src/u.rs'));
    expect(sw2, 'an: nicht quer scrollbar').toBeLessThanOrEqual(cw2);
    for (const [name, zeile] of [['a', a], ['b', b]]) {
      const t = await textZeilen(zeile.locator('td.c')), m = await zeilenMasse(zeile);
      expect(t.zeilen, `${name}: mehr als eine Textzeile`).toBeGreaterThan(1);
      expect(m.hoehe, `${name}: Höhe`).toBe(t.zeilen * 18);
      expect(t.ueber, `${name}: kein Zeichen abgeschnitten`).toBe(0);
      expect(m.nTop, `${name}: Nummer oben`).toBeLessThan(9);
      expect(m.mTop, `${name}: Zeichen oben`).toBeLessThan(9);
      expect([m.nHoehe, m.mHoehe], `${name}: Zellen auf voller Höhe`).toEqual([m.hoehe, m.hoehe]);
      expect(m.mGrund, `${name}: Zeichen auf dem Grund der Zeile`).toBe(m.cGrund);
      expect(m.nummern, `${name}: eine Nummer je Zeile`).toBe(aus.a.nummern);
    }
    expect(await s.bereich('src/u.rs').locator('td.n').count(), 'Zahl der Nummern gleich').toBe(aus.nummern);
    expect((await zeilenMasse(kurz)).hoehe, 'die kurze Zeile bleibt eine Zeile').toBe(aus.kurz.hoehe);
    expect(aus.kurz.hoehe).toBe(18);
  });

  test('AK 2: der Hunk-Kopf aus (c) bricht bei 320 px und „an“ um, bei „aus“ bleibt er eine Zeile', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 320, 800);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    const kopf = s.bereich('src/u.rs').locator('tr.hk').filter({ hasText: 'funktion_mit_einem' });
    await expect(kopf).toHaveCount(1);
    const aus = await kopf.evaluate(t => t.offsetHeight);
    expect(aus, 'aus: eine Zeile').toBeLessThan(30);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    expect(await kopf.evaluate(t => t.offsetHeight), 'an: mehrzeilig').toBeGreaterThan(30);
    const [sw, cw] = await quer(s.bereich('src/u.rs'));
    expect(sw).toBeLessThanOrEqual(cw);
  });

  test('AK 2: „an“ gilt auch für eine Datei, die erst danach aufgeklappt wird, und für einen nachgeladenen Abschnitt in Alle Änderungen', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    const kopf = s.datei('src/u.rs').locator('.df-k');
    await kopf.click();
    await expect(kopf).toHaveAttribute('aria-expanded', 'false');
    await kopf.click();
    await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    const a = s.zeile('src/u.rs', 'add', UM_A);
    await expect(a).toBeVisible();
    const [sw, cw] = await quer(s.bereich('src/u.rs'));
    expect(sw).toBeLessThanOrEqual(cw);
    expect((await textZeilen(a.locator('td.c'))).zeilen).toBeGreaterThan(1);
    await s.alleOeffnen(k, 9);
    const doku = page.locator('#rv-insel button[id^="rv-gk"][id$="-doku"]');
    await doku.click();
    await expect(doku).toHaveAttribute('aria-expanded', 'true');
    const md = s.zeile('docs/u.md', 'add', UM_A);
    await expect(md).toBeVisible();
    const [sw3, cw3] = await quer(s.bereich('docs/u.md'));
    expect(sw3).toBeLessThanOrEqual(cw3);
    expect((await textZeilen(md.locator('td.c'))).zeilen).toBeGreaterThan(1);
  });

  /* ── AK 3 Merken (US-3) ── */

  test('AK 3: „an“ bleibt nach Neuladen, neuem Tab, Blättern und Ansichtswechsel; ein neuer Kontext ist aus; „aus“ bleibt aus', async ({ page, browser, context }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    await page.reload();
    await expect(s.eingabe).toBeChecked();
    expect(await s.umbrechen()).toBe(true);
    const zweite = await context.newPage();
    const s2 = seite(zweite);
    await s2.commitOeffnen(k, 9, umbrechenRepository().u1);
    await expect(s2.eingabe).toBeChecked();
    expect(await s2.umbrechen()).toBe(true);
    await s2.commitOeffnen(k, 10, umbrechenRepository().u3);
    await expect(s2.eingabe).toBeChecked();
    await s2.alleOeffnen(k, 9);
    await expect(s2.eingabe).toBeChecked();
    expect(await s2.umbrechen()).toBe(true);
    await zweite.close();
    const fremd = await browser.newContext();
    const fremdSeite = await fremd.newPage();
    await alsPerson(fremdSeite, 'sh');
    const s3 = seite(fremdSeite);
    await s3.commitOeffnen(k, 9, umbrechenRepository().u1);
    await expect(s3.eingabe).not.toBeChecked();
    await fremd.close();
    await s.schalter.click();
    await expect(s.eingabe).not.toBeChecked();
    await page.reload();
    await expect(s.eingabe).not.toBeChecked();
    expect(await s.umbrechen()).toBe(false);
  });

  /* ── AK 4 Kopieren und Zeilenzahl (US-4) ── */

  test('AK 4: Auswahl und Kopie gleich bei „aus“ und „an“, keine Einfügungen; Zeilen, Nummern, offene Dateien und Sprungziel unverändert', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    const a = s.zeile('src/u.rs', 'add', UM_A), b = s.zeile('src/u.rs', 'add', UM_B);
    await expect(a).toBeVisible();
    const lesen = () => page.evaluate(() => {
      const rolle = document.querySelector('.df-sc[aria-label="Änderungen in src/u.rs"]');
      const zellen = Array.from(rolle.querySelectorAll('tr.add td.c'));
      const von = zellen.find(c => c.textContent.endsWith('ende') && c.textContent.includes('wort wort')), bis = zellen.find(c => c.textContent.includes('"xxxx'));
      const nach = z => { const l = z.querySelector('.vh'), r = document.createRange(); r.selectNodeContents(z); if (l) r.setStartAfter(l); return r; };
      const eine = nach(von);
      const mehrere = document.createRange();
      mehrere.setStart(von.parentElement, 0);
      mehrere.setEnd(bis, bis.childNodes.length);
      const ausw = r => { const g = getSelection(); g.removeAllRanges(); g.addRange(r); return g.toString(); };
      const text = ausw(eine);
      const bereich = ausw(mehrere);
      return {
        text, bereich, umbrueche: (bereich.match(/\n/g) || []).length,
        tr: document.querySelectorAll('#rv-insel tr').length, nummern: document.querySelectorAll('#rv-insel td.n').length,
        offen: Array.from(document.querySelectorAll('#rv-insel .df-k[aria-expanded]'), x => x.getAttribute('aria-expanded')),
        sprung: Array.from(document.querySelectorAll('#rv-insel td.n[title]'), n => [n.textContent, n.title]),
        vsc: Array.from(document.querySelectorAll('#rv-insel .df-sc'), x => x.dataset.vsc),
      };
    });
    const aus = await lesen();
    expect(aus.text).toBe(UM_A);
    expect(aus.text.length).toBe(407);
    expect(aus.sprung.length).toBeGreaterThan(0);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    const an = await lesen();
    expect(an.text, 'Text der Zeile gleich, 407 Zeichen').toBe(UM_A);
    expect(an.text).not.toMatch(/[\n​]/);
    expect(an.bereich.length, 'gleich lang').toBe(aus.bereich.length);
    expect(an.bereich, 'gleich').toBe(aus.bereich);
    expect(an.umbrueche).toBe(aus.umbrueche);
    expect({ ...an, text: null, bereich: null }).toEqual({ ...aus, text: null, bereich: null });
    void b;
  });

  /* ── AK 5 Marke und Farbe über den Umbruch (US-2) ── */

  test('AK 5: die Marke bricht bei 320 px mit, Kante auf jedem Fragment, keine Seitenränder, Text und Farbe je Zeichen wie bei „aus“', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 320, 800);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    await farbeAbwarten(page, s.bereich('src/breit.rs'));
    const text = WM_BREIT('2');
    expect(text.length).toBe(120);
    const zeile = s.zeile('src/breit.rs', 'add', text);
    const marke = zeile.locator('mark.wm');
    await expect(marke).toHaveText(text.slice(60, 110));
    const farben = () => zeile.evaluate(tr => Array.from(tr.querySelectorAll('td.c [class^="tk-"]'), e => [e.className, e.textContent, getComputedStyle(e).color]));
    const aus = await farben();
    expect(aus.length).toBeGreaterThan(0);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    expect(await zeile.evaluate(tr => tr.offsetHeight)).toBeGreaterThanOrEqual(36);
    expect(await marke.evaluate(m => m.getClientRects().length)).toBeGreaterThanOrEqual(2);
    expect(await farben(), 'Farbe je Zeichen gleich').toEqual(aus);
    expect((await textZeilen(zeile.locator('td.c'))).zeilen).toBeGreaterThanOrEqual(2);
    const st = await kantenStil(marke);
    expect([st.randLinks, st.randRechts, st.paddingLinks, st.paddingRechts]).toEqual(['0px', '0px', '0px', '0px']);
    expect(await zeile.locator('td.c').evaluate(c => c.textContent.replace(c.querySelector('.vh').textContent, ''))).toBe(text);
    expect(await seitenQuer(page)).toBe(true);
    const je = await kanteDurchgehend(page, marke, st.farbe);
    expect(je.length).toBeGreaterThanOrEqual(2);
    expect(je.every(r => r.anzahl === 0), JSON.stringify(je)).toBe(true);
  });

  /* ── AK 6 Breiten (US-2) ── */

  for (const thm of ['light', 'dark']) {
    test(`AK 6: ${thm} — 320, 414, 980, 1280 px: die Seite scrollt nie quer, bei „an“ auch der Code nicht; Schalter ≥ --kd-ziel; 320 px lesbar`, async ({ page }) => {
      const s = seite(page);
      await thema(page, thm);
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite, 800);
        await s.commitOeffnen(k, 9, umbrechenRepository().u1);
        await expect(s.eingabe).not.toBeChecked();
        expect(await seitenQuer(page), `${breite} aus: Seite`).toBe(true);
        const [sw, cw] = await quer(s.bereich('src/u.rs'));
        expect(sw, `${breite} aus: nur der Code scrollt quer`).toBeGreaterThan(cw);
        const ziel = await s.schalter.evaluate(l => [l.offsetHeight, parseFloat(getComputedStyle(l).minBlockSize), parseFloat(getComputedStyle(document.querySelector('#rv-alle')).minHeight) || 0]);
        expect(ziel[0]).toBeGreaterThanOrEqual(24);
        await s.schalter.click();
        await expect(s.eingabe).toBeChecked();
        expect(await seitenQuer(page), `${breite} an: Seite`).toBe(true);
        for (const [bsw, bcw] of await page.locator('#rv-insel .df-sc').evaluateAll(l => l.map(e => [e.scrollWidth, e.clientWidth]))) expect(bsw, `${breite} an: Code`).toBeLessThanOrEqual(bcw);
        if (breite === 320) {
          const c = s.zeile('src/u.rs', 'add', UM_B).locator('td.c');
          const m = await c.evaluate(z => { const e = document.createElement('span'); e.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit'; e.textContent = 'x'.repeat(100); z.appendChild(e); const w = e.getBoundingClientRect().width / 100; e.remove(); return { breite: z.clientWidth, zeichen: w }; });
          expect((await textZeilen(c)).ueber, '320: kein Zeichen von Fall (b) abgeschnitten').toBe(0);
          expect(m.breite, `320: td.c ≥ 24 Zeichen (${JSON.stringify(m)})`).toBeGreaterThanOrEqual(24 * m.zeichen);
          expect(await zeilenMasse(s.zeile('src/u.rs', 'add', UM_B)).then(x => x.hoehe), 'Fall (b) höchstens 20 Textzeilen').toBeLessThanOrEqual(20 * 18);
          const bruch = await s.bereich('src/u.rs').locator('tr.hk').filter({ hasText: 'funktion_mit_einem' }).evaluate(t => {
            const text = t.textContent, kopf = text.match(/^@@ [^@]*@@/)[0];
            const tops = [], w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
            for (let n = w.nextNode(); n && tops.length < kopf.length; n = w.nextNode()) {
              for (let i = 0; i < n.data.length && tops.length < kopf.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const q = r.getClientRects()[0]; tops.push(q ? Math.round(q.top) : null); }
            }
            const gebrochen = [];
            let start = 0;
            kopf.split(' ').forEach(wort => { const t0 = new Set(tops.slice(start, start + wort.length)); if (t0.size > 1) gebrochen.push(wort); start += wort.length + 1; });
            return gebrochen;
          });
          expect(bruch, 'keine Zahl im Hunk-Kopf wird getrennt').toEqual([]);
        }
        await s.schalter.click();
        await expect(s.eingabe).not.toBeChecked();
      }
    });
  }

  /* ── AK 7 Tempo und kein Neuaufbau (US-5): der Gate-Fall prüft Zeilen, Knoten und Anfragen ohne Zeitmaß; das Wanduhr-Maß misst die Lastprobe (R00260) ── */

  test('AK 7: K-Last — Umschalten und Scrollen, dieselben Zeilenknoten, keine Anfrage', async ({ page }) => {
    test.setTimeout(120000);
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 10, umbrechenRepository().u3);
    const anzeigen = s.datei('src/gross.rs').getByRole('button', { name: 'Änderungen anzeigen' });
    await anzeigen.click();
    await expect(s.bereich('src/gross.rs').locator('tr.add').first()).toBeVisible();
    await farbeAbwarten(page, s.bereich('src/gross.rs'));
    await expect(s.bereich('src/gross.rs').locator('tr.add')).toHaveCount(5000);
    await zweiBilder(page);
    await s.bereich('src/gross.rs').evaluate(b => { const z = b.querySelectorAll('tr'); z[0].kdMarke = 'erste'; z[z.length - 1].kdMarke = 'letzte'; });
    const anfragen = [];
    page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) anfragen.push(r.url()); });
    const bisEnde = () => page.evaluate(() => new Promise(fertig => {
      const r = document.getElementById('review');
      r.scrollTop = 0;
      const schritt = () => { const vorher = r.scrollTop; r.scrollTop += r.clientHeight * 0.8; if (r.scrollTop === vorher) fertig(); else requestAnimationFrame(schritt); };
      requestAnimationFrame(schritt);
    }));
    // Umschalten und Scrollen müssen dieselben Zeilenknoten behalten (Mutant m5: Umschalten zeichnet die Seite neu)
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    await zweiBilder(page);
    await s.bereich('src/gross.rs').scrollIntoViewIfNeeded();
    await bisEnde();
    await zweiBilder(page);
    await s.schalter.click();
    await expect(s.eingabe).not.toBeChecked();
    await zweiBilder(page);
    const knoten = await s.bereich('src/gross.rs').evaluate(b => { const z = b.querySelectorAll('tr'); return [z[0].kdMarke, z[z.length - 1].kdMarke]; });
    expect(knoten, 'dieselben Zeilenknoten').toEqual(['erste', 'letzte']);
    expect(anfragen, 'keine Anfrage').toEqual([]);
  });

  /* ── AK 7 (Erweiterung, PO Z. 679, ADR-0042 N7.4 P1/P2): Hinaufrollen nach frischem Laden springt nicht ── */

  for (const [breite, an] of [[980, true], [320, true], [980, false], [320, false]]) {
    test(`AK 7: K-Last frisch geladen mit „${an ? 'an' : 'aus'}“ bei ${breite} px — ans Ende gesprungen, dann in 400-px-Schritten hinauf: größter Sprung der Zeile in der Fenstermitte ≤ 36 px, Scroll-Anker ${an ? 'auto' : 'none'}`, async ({ page }) => {
      test.setTimeout(240000);
      const s = seite(page);
      await breiteSetzen(page, breite, 800);
      await page.addInitScript(wert => localStorage.setItem('kanbanD.umbrechen', wert), an ? '1' : '0');
      await s.commitOeffnen(k, 10, umbrechenRepository().u3);
      if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
      await s.datei('src/gross.rs').getByRole('button', { name: 'Änderungen anzeigen' }).click();
      await expect(s.bereich('src/gross.rs').locator('tr.add')).toHaveCount(5000);
      await farbeAbwarten(page, s.bereich('src/gross.rs'));
      await zweiBilder(page);
      // Ein Sprung ans Ende (kein schrittweises Rollen: das ließe jeden Block seine Höhe merken, der Test wäre auch ohne die Regel grün)
      await page.evaluate(async () => {
        const r = document.getElementById('review');
        const bild = () => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        r.scrollTop = r.scrollHeight; await bild();
        r.scrollTop = r.scrollHeight; await bild();
      });
      const m = await page.evaluate(async () => {
        const r = document.getElementById('review');
        const bild = () => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        const mitte = () => {
          const q = r.getBoundingClientRect();
          const z = document.elementFromPoint(q.left + q.width / 2, q.top + q.height / 2);
          const tr = z && z.closest('#rv-insel tr');
          return tr ? { tr, top: tr.getBoundingClientRect().top - q.top } : null;
        };
        let groesster = 0, schritte = 0, gemessen = 0;
        while (schritte < 450 && r.scrollTop > 400) {
          const vorher = mitte();
          const st = r.scrollTop;
          r.scrollTop = st - 400;
          await bild();
          schritte++;
          if (!vorher) continue;
          const nachher = vorher.tr.getBoundingClientRect().top - r.getBoundingClientRect().top;
          gemessen++;
          groesster = Math.max(groesster, Math.abs(nachher - vorher.top - 400));
        }
        return { groesster: Math.round(groesster), schritte, gemessen, anker: getComputedStyle(r).overflowAnchor };
      });
      test.info().annotations.push({ type: 'AK 7 Hinaufrollen', description: JSON.stringify({ breite, an, ...m }) });
      console.log(`AK 7 Hinaufrollen ${JSON.stringify({ breite, an, ...m })}`);
      expect(m.gemessen, 'genug Schritte mit Zeuge').toBeGreaterThanOrEqual(300);
      expect(m.groesster, 'größter Sprung der Zeile in der Fenstermitte').toBeLessThanOrEqual(36);
      expect(m.anker, 'Scroll-Anker des Browsers').toBe(an ? 'auto' : 'none');
    });
  }

  /* ── AK 9 Leseposition bleibt (US-6) ── */

  for (const breite of [980, 320]) {
    test(`AK 9: ${breite} px — die oberste Zeile bleibt beim Ein- und Ausschalten an ihrer Stelle (≤ 36 px), der Kopf der zweiten Datei im Fenster`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, breite, 800);
      await s.commitOeffnen(k, 9, umbrechenRepository().u1);
      await expect(s.zeile('src/u.rs', 'add', UM_A)).toBeVisible();
      const zeile = s.bereich('src/u.rs').locator('tr').nth(24);
      await rollenAuf(zeile, 10);
      await zweiBilder(page);
      await zeile.evaluate(tr => { tr.kdMarke = 'fest'; });
      for (const an of [true, false]) {
        const davor = await lage(zeile);
        expect(davor).toBeGreaterThanOrEqual(0);
        expect(davor).toBeLessThanOrEqual(36);
        await s.eingabe.evaluate(e => e.click()); // ohne Rollen: der Schalter steht oben, die Leseposition liegt weiter unten
        if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
        await zweiBilder(page);
        expect(await zeile.evaluate(tr => tr.kdMarke), 'derselbe Knoten').toBe('fest');
        const danach = await lage(zeile);
        expect(Math.abs(danach - davor), `${an ? 'an' : 'aus'}: davor ${davor} danach ${danach}`).toBeLessThanOrEqual(36);
        await rollenAuf(zeile, 10);
      }
      // der Kopf einer anderen Datei am oberen Rand
      const kopf = s.datei('src/kurz.rs').locator('.df-k');
      await rollenAuf(kopf, 2); // am oberen Rand; scrollTop ist ganzzahlig, 2 px Luft gegen 0,5 px Rundung
      await zweiBilder(page);
      for (const an of [true, false]) {
        await s.eingabe.evaluate(e => e.click()); // ohne Rollen: der Schalter steht oben, die Leseposition liegt weiter unten
        if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
        await zweiBilder(page);
        const oben = await lage(kopf);
        expect(oben, `Kopf bei ${an ? 'an' : 'aus'}`).toBeGreaterThanOrEqual(0);
        expect(oben).toBeLessThan(36);
      }
    });
  }

  /* ── AK 3 (Fortsetzung): ein werfender localStorage ── */

  test('AK 3: wirft localStorage beim Lesen und Schreiben, bleibt die Seite bedienbar, der Schalter wirkt bis zum Neuladen, ohne Meldung und Konsolenfehler, auch nach Blättern und Ansichtswechsel', async ({ page }) => {
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    await page.addInitScript(() => {
      const gesperrt = k => k === 'kanbanD.umbrechen';
      const lesen = Storage.prototype.getItem, schreiben = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { if (gesperrt(k)) throw new Error('gesperrt'); return lesen.call(this, k); };
      Storage.prototype.setItem = function (k, v) { if (gesperrt(k)) throw new Error('voll'); return schreiben.call(this, k, v); };
    });
    const s = seite(page);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    await expect(s.eingabe).not.toBeChecked();
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    expect(await s.umbrechen(), 'wirkt bis zum Neuladen').toBe(true);
    // Blättern und Wechsel der Ansicht: Zustand bleibt, Klasse und Haken stimmen überein
    const vor = page.locator('#rv-vor, #rv-zurueck').first();
    if (await vor.count()) { await vor.click(); await expect(s.eingabe).toBeChecked(); expect(await s.umbrechen()).toBe(true); }
    await page.locator('#rv-u-alle').click();
    await page.locator('#rv-insel section.df').first().waitFor();
    await expect(s.eingabe).toBeChecked();
    expect(await s.umbrechen()).toBe(true);
    await expect(page.getByText(/gespeichert|Speicher|Einstellung/i)).toHaveCount(0);
    expect(fehler, 'kein Konsolenfehler').toEqual([]);
  });

  /* ── AK 10 Bestand bei „aus“ ── */

  test('AK 10: bei „aus“ wie vor der Karte — Codezelle pre, Block so breit wie sein Inhalt mit der Breite als Eigenschaft --bb, keine Klasse umbr', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, umbrechenRepository().u1);
    expect(await s.umbrechen()).toBe(false);
    const aus = await s.bereich('src/u.rs').evaluate(b => {
      const blk = b.querySelector('.dz-b'), c = b.querySelector('td.c');
      return { stil: blk.getAttribute('style'), whiteSpace: getComputedStyle(c).whiteSpace, inline: getComputedStyle(blk).inlineSize, intrinsic: getComputedStyle(blk).containIntrinsicInlineSize, kopf: getComputedStyle(b.querySelector('tr.hk > td')).whiteSpace };
    });
    expect(aus.stil).toMatch(/^--bb:\d+px;contain-intrinsic-block-size:auto \d+px$/);
    expect(aus.whiteSpace).toBe('pre');
    expect(aus.kopf).toBe('pre');
    expect(aus.intrinsic).toMatch(/\d+px$/);
  });
});
