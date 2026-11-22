// R00228 (I0218, Karte #249): das Feld „Repository“ in Einrichten nutzt die Zeile, die Review-Seite hat eine eigene Klasse,
// der erste Start scrollt nicht quer. AK 1, 1a, 2, 3 und die Mutanten m1–m6 (KD_MUTANTE, Pfade /web/…).
// Schichten: Testfall (je AK) → Testsprache (`lage`, `ersterStart`, `stileDerReviewSeite`) → Treiber (Playwright).
// Gemessen wird immer mit getBoundingClientRect in EINEM page.evaluate (ADR-0026 N3 Regel 8), nie mit innerText.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen, thema, mutanteEinsetzen } = require('./hilfen');
const { gesamtRepositorien, gesamtVorbereiten } = require('./gesamt-hilfen');

// ---- Testsprache --------------------------------------------------------------------------------------------------------

/** Ein 120 Zeichen langer Pfad, den es nicht gibt (Zustandswort „nicht erreichbar“). */
const LANG = `${os.tmpdir()}/kanband-r00228-${'x'.repeat(120)}`.slice(0, 120);
const register = `---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n  repository: ${LANG}\n  applications:\n    kd: {name: kanbanD, repository: ${LANG}}\n---\n`;

/** Misst die Lage von Feld, Zustandswort und Zeile `.anw` der Anwendung kd und der Quellen in einem Zug. */
const lage = page => page.evaluate(() => {
  const rechteck = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const schnitt = (a, b) => !(a.r <= b.l || b.r <= a.l || a.b <= b.t || b.b <= a.t);
  const von = (feld, zustand, zeile) => {
    const f = rechteck(feld), e = rechteck(zustand), z = rechteck(zeile);
    return {
      verhaeltnis: f.w / z.w, feld: f, erreich: e, zeile: z,
      schneidet: schnitt(f, e), ganzInZeile: e.l >= z.l - 0.5 && e.r <= z.r + 0.5 && e.t >= z.t - 0.5 && e.b <= z.b + 0.5, unterFeld: e.t >= f.b - 0.5, rechtsVomFeld: e.l >= f.r - 0.5, wort: zustand.textContent,
    };
  };
  const anw = document.querySelector('.anw[data-anwendung="kd"]');
  const quellen = document.querySelector('#quellen-repo');
  const wurzel = document.documentElement;
  return {
    anw: von(anw.querySelector('input[aria-label="Repository kd"]'), anw.querySelector('.erreich'), anw),
    quellen: von(document.querySelector('input[aria-label="Repository"]'), quellen, quellen.closest('.felder')),
    fontWeight: getComputedStyle(anw).fontWeight, display: getComputedStyle(anw).display,
    quer: wurzel.scrollWidth - innerWidth,
    ziele: [...anw.querySelectorAll('input, button')].map(e => e.getBoundingClientRect().height),
    ziel: parseFloat(getComputedStyle(wurzel).getPropertyValue('--kd-ziel')) || 0,
  };
});

/** Öffnet Einrichten als `st` mit dem Register der Ausgangslage und wartet auf das Zustandswort „nicht erreichbar“. */
async function einrichtenOeffnen(page, k, farbe) {
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/einrichten');
  await thema(page, farbe === 'hell' ? 'light' : 'dark');
  await bereit(page, page.locator('.anw[data-anwendung="kd"]'));
  await expect(page.locator('.anw[data-anwendung="kd"] .erreich')).toHaveText('nicht erreichbar');
  await expect(page.locator('#quellen-repo')).toHaveText('nicht erreichbar');
}

/** Der erste Start: Lage von Maske (`.first-l`) und Vorschau (`.first-r`) und das Querscrollen der Seite. */
const ersterStart = page => page.evaluate(() => {
  const l = document.querySelector('.first-l').getBoundingClientRect(), r = document.querySelector('.first-r').getBoundingClientRect();
  return { quer: document.documentElement.scrollWidth - innerWidth, darunter: r.top >= l.bottom - 0.5, nebeneinander: Math.abs(r.top - l.top) <= 1 && r.left >= l.right - 1, l: [l.left, l.top, l.right, l.bottom], r: [r.left, r.top, r.right, r.bottom] };
});

const SELEKTOR_KOPF = 'h2[id^="rv-a"][id$="-t"]';
const STILE_VORHER = JSON.parse(fs.readFileSync(path.join(__dirname, 'r00228-stile-vorher.json'), 'utf8'));

/** Berechnete Stile der Abschnittsköpfe der Review-Seite (AK 2); die Zeile mit `.zw` und `svg.i` ist ein Nachbau mit der Klasse des echten Kopfes. */
const stileDerReviewSeite = page => page.evaluate(selektor => {
  const nimm = (e, namen) => Object.fromEntries(namen.map(n => [n, getComputedStyle(e)[n]]));
  const koepfe = [...document.querySelectorAll(selektor)];
  const klasse = koepfe[0].className;
  const probe = document.createElement('section');
  probe.innerHTML = `<h2 class="${klasse}"><span class="mono">1 Commit</span> <span class="zw"><svg class="i" viewBox="0 0 12 12"></svg>wartet</span></h2><p class="rv-abs-zust"><svg class="i" viewBox="0 0 12 12"></svg>Wartet</p>`;
  document.querySelector('#rv-insel').append(probe);
  const kopfNamen = ['display', 'flexWrap', 'alignItems', 'rowGap', 'columnGap', 'margin', 'fontSize', 'fontWeight'];
  const ergebnis = {
    koepfe: koepfe.map(h => ({ kopf: nimm(h, kopfNamen), mono: [...h.querySelectorAll('.mono')].map(m => nimm(m, ['fontWeight', 'color'])) })),
    probe: {
      kopf: nimm(probe.querySelector('h2'), kopfNamen),
      mono: nimm(probe.querySelector('.mono'), ['fontWeight', 'color']),
      zw: nimm(probe.querySelector('.zw'), ['display', 'gap', 'font', 'color']),
      zwSvg: nimm(probe.querySelector('.zw svg.i'), ['width', 'height']),
      zustSvg: nimm(probe.querySelector('.rv-abs-zust svg.i'), ['width', 'height']),
    },
    klassenAnw: document.querySelectorAll('.anw').length,
  };
  probe.remove();
  return ergebnis;
}, SELEKTOR_KOPF);

// ---- Testfälle ----------------------------------------------------------------------------------------------------------

test.describe('R00228 Repository-Feld und erster Start', () => {
  let k;
  test.afterEach(() => k.stoppen());

  for (const farbe of ['hell', 'dunkel']) {
    test(`AK 1 (${farbe}): das Feld „Repository kd“ ist bei 375, 768 und 1280 px mindestens 60 % der Zeile, das Zustandswort schneidet es nicht, die Zeile ist nicht fett`, async ({ page }) => {
      await mutanteEinsetzen(page);
      k = await kanbanStarten(einrichten({ 'kanbanD.md': register }));
      await einrichtenOeffnen(page, k, farbe);
      for (const breite of [375, 768, 1280]) {
        await breiteSetzen(page, breite);
        const m = await lage(page);
        expect(m.anw.verhaeltnis, `${breite} px: Feld ${Math.round(m.anw.feld.w)} von ${Math.round(m.anw.zeile.w)} px`).toBeGreaterThanOrEqual(0.6);
        expect(m.anw.schneidet, `${breite} px: Zustandswort schneidet das Feld`).toBe(false);
        expect(m.anw.ganzInZeile, `${breite} px: Zustandswort ganz in der Zeile`).toBe(true);
        expect(m.anw.wort).toBe('nicht erreichbar');
        expect(m.fontWeight, `${breite} px: Schrift der Zeile`).toBe('400');
      }
    });

    test(`AK 1a (${farbe}): bei 320 und 375 px steht das Zustandswort unter dem Feld, das Feld ist mindestens 60 % breit (Anwendung und Quellen), nichts scrollt quer, die Ziele bleiben hoch`, async ({ page }) => {
      await mutanteEinsetzen(page);
      k = await kanbanStarten(einrichten({ 'kanbanD.md': register }));
      await einrichtenOeffnen(page, k, farbe);
      for (const breite of [320, 375]) {
        await breiteSetzen(page, breite);
        const m = await lage(page);
        for (const [ort, x] of [['Anwendung', m.anw], ['Quellen', m.quellen]]) {
          expect(x.verhaeltnis, `${breite} px ${ort}: Feld ${Math.round(x.feld.w)} von ${Math.round(x.zeile.w)} px`).toBeGreaterThanOrEqual(0.6);
          expect(x.schneidet, `${breite} px ${ort}: Zustandswort schneidet das Feld`).toBe(false);
          expect(x.ganzInZeile, `${breite} px ${ort}: Zustandswort ganz in der Zeile`).toBe(true);
          expect(x.unterFeld, `${breite} px ${ort}: erreich.top ${x.erreich.t} >= feld.bottom ${x.feld.b}`).toBe(true);
        }
        expect(m.quer, `${breite} px: Querscrollen`).toBeLessThanOrEqual(0);
        expect(Math.min(...m.ziele), `${breite} px: kleinstes Ziel`).toBeGreaterThanOrEqual(m.ziel);
      }
    });
  }

  test('AK 1 Grenze: ab 641 px bleibt die Beschriftungsspalte, das Zustandswort steht neben dem Feld', async ({ page }) => {
    await mutanteEinsetzen(page);
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register }));
    await einrichtenOeffnen(page, k, 'hell');
    for (const breite of [641, 768]) {
      await breiteSetzen(page, breite);
      const m = await lage(page);
      expect(m.anw.rechtsVomFeld, `${breite} px: Zustandswort rechts vom Feld`).toBe(true);
      expect(m.anw.unterFeld, `${breite} px: nicht unter dem Feld`).toBe(false);
    }
  });

  test('AK 2 (erster Teil): `.anw` ist in Einrichten keine Flex-Zeile (375, 768, 1280 px)', async ({ page }) => {
    await mutanteEinsetzen(page);
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register }));
    await einrichtenOeffnen(page, k, 'hell');
    for (const breite of [375, 768, 1280]) {
      await breiteSetzen(page, breite);
      expect((await lage(page)).display, `${breite} px`).not.toBe('flex');
    }
  });

  for (const farbe of ['hell', 'dunkel']) {
    test(`AK 2 (zweiter Teil, ${farbe}): kein Element der Review-Seite trägt die Klasse anw, der Kopf trägt rv-anw, seine Stile sind die von vor der Karte`, async ({ page }) => {
      await mutanteEinsetzen(page);
      const rep = gesamtRepositorien();
      k = await kanbanStarten(gesamtVorbereiten(rep));
      await alsPerson(page, 'st');
      await page.goto(`${k.adresse}#/aufgaben/aufgabe/11/review`);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      await breiteSetzen(page, 1280);
      await bereit(page, page.locator(SELEKTOR_KOPF).first());
      await expect(page.locator(SELEKTOR_KOPF)).toHaveCount(3);
      const jetzt = await stileDerReviewSeite(page);
      if (process.env.KD_STILE_AUS) fs.writeFileSync(`${process.env.KD_STILE_AUS}-${farbe}.json`, JSON.stringify({ koepfe: jetzt.koepfe, probe: jetzt.probe }, null, 1));
      expect(jetzt.klassenAnw, 'Elemente mit der Klasse anw auf der Review-Seite').toBe(0);
      expect(await page.locator('h2.rv-anw').count(), 'Abschnittsköpfe mit rv-anw').toBe(3);
      expect({ koepfe: jetzt.koepfe, probe: jetzt.probe }).toEqual(STILE_VORHER[farbe]);
    });
  }

  for (const farbe of ['hell', 'dunkel']) {
    test(`AK 3 (${farbe}): erster Start — bei 320, 375 und 768 px scrollt die Seite nicht quer, die Vorschau steht unter der Maske; 900 px untereinander, 901 und 1280 px nebeneinander`, async ({ page }) => {
      await mutanteEinsetzen(page);
      k = await kanbanStarten();
      await page.goto(k.adresse);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      await page.locator('.first-r').waitFor({ state: 'visible' });
      await expect(page.locator('#vorschau-einstellungen')).toBeVisible();
      for (const breite of [320, 375, 768, 900]) {
        await breiteSetzen(page, breite);
        const m = await ersterStart(page);
        expect(m.quer, `${breite} px: scrollWidth - innerWidth`).toBeLessThanOrEqual(0);
        expect(m.darunter, `${breite} px: Vorschau unter der Maske ${JSON.stringify([m.l, m.r])}`).toBe(true);
      }
      for (const breite of [901, 1280]) {
        await breiteSetzen(page, breite);
        const m = await ersterStart(page);
        expect(m.nebeneinander, `${breite} px: nebeneinander ${JSON.stringify([m.l, m.r])}`).toBe(true);
        expect(m.darunter, `${breite} px: nicht untereinander`).toBe(false);
      }
    });
  }
});
