// R00229 Gesperrte Leseknöpfe tragen die Sperrform von Z. 216 (Karte #247, I0219) — AK 1–7 im echten Programm, hell und dunkel.
// Z (Zeiger) = `default`. Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten.
// Farben: je Thema aus den Rollen (`--kd-*`) berechnet und als Pixel verglichen (Canvas, RGB), nie als feste Zahl.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, reiter, alsPerson, mutanteEinsetzen, thema, kontrastAm, farbPixel } = require('./hilfen');
const lauf = require('./laeufe-hilfen');
const lv = require('./laufansicht-hilfen');
const { geteiltesRepository, ausgangslageVorbereiten } = require('./commits-hilfen');

const Z = 'default';
const THEMEN = [['hell', 'light'], ['dunkel', 'dark']];
const ROLLEN = ['--kd-faint', '--kd-line', '--kd-line-strong', '--kd-surface', '--kd-sunken', '--kd-accent-ink', '--kd-text', '--kd-muted'];
const STATUS_LAEUFE = '#laeufe-status';
const NEU = '#laeufe-neu';
const ERNEUT = '#laeufe-erneut';
const COMMITS_NEU = '#commits-neu';
const LV_ERNEUT = '#lv-erneut';
const DURCHSICHTIG = 'rgba(0, 0, 0, 0)';

/** Die berechnete Form eines Knotens: Schrift, Kontur, Fläche, Deckkraft, Zeiger, Fokusring. */
const form = knopf => knopf.evaluate(e => {
  const s = getComputedStyle(e);
  return { farbe: s.color, rand: s.borderTopColor, randBreite: s.borderTopWidth, grund: s.backgroundColor, deckkraft: s.opacity, zeiger: s.cursor, ring: [s.outlineStyle, s.outlineWidth, s.outlineColor, s.outlineOffset] };
});
/** Die Rollen als berechnete Farben im aktuellen Thema (ein Probe-Element je Rolle). */
const rollen = (page) => page.evaluate(namen => Object.fromEntries(namen.map(n => {
  const s = document.createElement('span');
  s.style.color = `var(${n})`;
  document.body.append(s);
  const c = getComputedStyle(s).color;
  s.remove();
  return [n, c];
})), ROLLEN);
/** Zwei CSS-Farben ergeben dasselbe Pixel (Schreibweise egal). */
async function gleich(page, ist, soll, was) {
  expect(await farbPixel(page, ist), was).toEqual(await farbPixel(page, soll));
}
async function ungleich(page, ist, soll, was) {
  expect(await farbPixel(page, ist), was).not.toEqual(await farbPixel(page, soll));
}
/** Hält jedes GET auf einen Pfad, der `teil` enthält; `freigeben(wie)` beantwortet das älteste: 'weiter' oder ein Status (503). */
async function halten(page, teil) {
  const wartend = [];
  await page.route(url => new URL(url).pathname.includes(teil), async route => {
    if (route.request().method() !== 'GET') return route.continue();
    const wie = await new Promise(r => wartend.push(r));
    if (wie === 'weiter') return route.continue();
    return route.fulfill({ status: wie, json: { fehler: 'Dienst nicht verfügbar' } });
  });
  return {
    freigeben: async (wie = 'weiter') => {
      await expect.poll(() => wartend.length, 'ein Lesen ist gehalten').toBeGreaterThan(0);
      wartend.shift()(wie);
    },
  };
}
async function perTab(page, knopf, davor) {
  await davor.focus();
  for (let i = 0; i < 60 && !(await knopf.evaluate(n => n === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(knopf).toBeFocused();
}
/** Gesperrt in der Form von Z. 216 für die Schrift: Rolle `--kd-faint`, Deckkraft 1, Zeiger Z, ≥ 3:1 gegen den ersten deckenden Grund. */
async function gedaempft(page, knopf, r, wo) {
  const f = await form(knopf);
  await gleich(page, f.farbe, r['--kd-faint'], `${wo}: Schrift --kd-faint`);
  expect(f.deckkraft, `${wo}: opacity`).toBe('1');
  expect(f.zeiger, `${wo}: Zeiger`).toBe(Z);
  expect(await kontrastAm(knopf), `${wo}: Kontrast`).toBeGreaterThanOrEqual(3);
  return f;
}
/** Dieselben berechneten Werte mit dem Zeiger über dem Knopf (`force`: Playwright wartet sonst auf „enabled“). */
async function hoverNeutral(page, knopf, ohne, r, wo) {
  await knopf.hover({ force: true });
  const mit = await form(knopf);
  expect(mit.farbe, `${wo}: Hover Schrift`).toBe(ohne.farbe);
  expect(mit.rand, `${wo}: Hover Kontur`).toBe(ohne.rand);
  expect(mit.grund, `${wo}: Hover Fläche`).toBe(ohne.grund);
  if (mit.grund !== DURCHSICHTIG) await ungleich(page, mit.grund, r['--kd-sunken'], `${wo}: Hover nicht --kd-sunken`);
  await page.mouse.move(0, 0);
}
/** Gesperrt mit Fokus: der Ring ist derselbe wie frei (solid, ≥ 2 px). */
function ringGleich(frei, gesperrt, wo, streng = true) {
  expect(gesperrt.ring, `${wo}: Ring`).toEqual(frei.ring);
  expect(frei.ring[0], `${wo}: sichtbar`).not.toBe('none');
  expect(parseFloat(frei.ring[1]), `${wo}: sichtbar`).toBeGreaterThan(0);
  // „Neu lesen“ in „Commits“ trägt den Standardring des Browsers (`auto`), nicht den Hausring (R00205 AK 10 prüft nur „sichtbar“)
  if (!streng) return;
  expect(frei.ring[0], `${wo}: solid`).toBe('solid');
  expect(parseFloat(frei.ring[1]), `${wo}: ≥ 2 px`).toBeGreaterThanOrEqual(2);
}

test.describe('R00229 gesperrte Leseknöpfe in „Läufe“', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lauf.MENSCH);
    k = await kanbanStarten(lauf.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  async function laeufeOeffnen(page, erstes = 'weiter') {
    const h = await halten(page, '/api/aufgaben/1/transkripte');
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1`);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await liveBereit(page);
    await reiter(page, 'Läufe');
    await h.freigeben(erstes);
    await expect(page.locator(STATUS_LAEUFE)).not.toHaveText('Liest die Läufe …');
    return h;
  }
  const ausloeser = page => page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]');

  for (const [farbe, name] of THEMEN) {
    test(`AK 1 · AK 4 · AK 5 · US-1: ${farbe} — „Neu lesen“ gesperrt: --kd-faint, durchsichtig, ohne Rand, Zeiger Z, ≥ 3:1, Hover neutral, Ring wie frei`, async ({ page }) => {
      const h = await laeufeOeffnen(page);
      await thema(page, name);
      const r = await rollen(page);
      const knopf = page.locator(NEU);
      await perTab(page, knopf, ausloeser(page));
      const frei = await form(knopf);
      await gleich(page, frei.farbe, r['--kd-accent-ink'], 'frei: Schrift --kd-accent-ink');
      await page.keyboard.press('Enter');
      await expect(knopf).toHaveAttribute('aria-disabled', 'true');
      const f = await gedaempft(page, knopf, r, 'Neu lesen (Läufe)');
      expect(f.grund, 'durchsichtig').toBe(DURCHSICHTIG);
      expect(f.randBreite, 'kein Rand').toBe('0px');
      await hoverNeutral(page, knopf, f, r, 'Neu lesen (Läufe)');
      ringGleich(frei, await form(knopf), 'Neu lesen (Läufe)');
      await h.freigeben();
      await expect(knopf).not.toHaveAttribute('aria-disabled', 'true');
    });

    test(`AK 3 · AK 4 · AK 5 · AK 6 · US-1: ${farbe} — „Erneut versuchen“ gesperrt: --kd-faint auf --kd-surface mit --kd-line, Zeiger Z, ≥ 3:1, Hover neutral, Ring wie frei; frei bleibt --kd-text mit --kd-line-strong`, async ({ page }) => {
      const h = await laeufeOeffnen(page, 503);
      await thema(page, name);
      const r = await rollen(page);
      const knopf = page.locator(ERNEUT);
      await perTab(page, knopf, ausloeser(page));
      const frei = await form(knopf);
      await gleich(page, frei.farbe, r['--kd-text'], 'frei: Schrift --kd-text');
      await gleich(page, frei.rand, r['--kd-line-strong'], 'frei: Kontur --kd-line-strong');
      expect(frei.zeiger, 'frei: Zeiger').toBe('pointer');
      await knopf.hover();
      await gleich(page, (await form(knopf)).grund, r['--kd-sunken'], 'frei: Hover --kd-sunken');
      await page.mouse.move(0, 0);
      await page.keyboard.press('Enter');
      await expect(knopf).toHaveAttribute('aria-disabled', 'true');
      const f = await gedaempft(page, knopf, r, 'Erneut versuchen (Läufe)');
      await gleich(page, f.rand, r['--kd-line'], 'Kontur --kd-line');
      await gleich(page, f.grund, r['--kd-surface'], 'Fläche --kd-surface');
      await hoverNeutral(page, knopf, f, r, 'Erneut versuchen (Läufe)');
      ringGleich(frei, await form(knopf), 'Erneut versuchen (Läufe)');
      await h.freigeben(503);
      await expect(knopf).not.toHaveAttribute('aria-disabled', 'true');
      expect((await form(knopf)).farbe, 'frei wie vorher').toBe(frei.farbe);
    });

    test(`AK 7: ${farbe} — der aktuelle Eintrag im Kontextmenü (Untermenü Klasse) bleibt --kd-muted`, async ({ page }) => {
      await page.goto(k.adresse);
      await page.locator('.ka[data-id="1"]').click({ button: 'right' });
      await page.getByRole('menuitem', { name: /^Klasse/ }).click();
      await thema(page, name);
      const r = await rollen(page);
      const aktuell = page.locator('.kmenue.unter .km-aktuell');
      await expect(aktuell).toHaveAttribute('aria-disabled', 'true');
      await gleich(page, (await form(aktuell)).farbe, r['--kd-muted'], 'Menüeintrag --kd-muted');
    });
  }
});

test.describe('R00229 gesperrtes „Neu lesen“ in „Commits“', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    const geteilt = geteiltesRepository();
    k = await kanbanStarten(ausgangslageVorbereiten(geteilt.rep, geteilt.basis));
  });
  test.afterEach(() => k.stoppen());

  for (const [farbe, name] of THEMEN) {
    test(`AK 2 · AK 4 · AK 5 · AK 6 · US-2: ${farbe} — „Neu lesen“ gesperrt: --kd-faint, durchsichtig, ohne Rand, Zeiger Z, ≥ 3:1, Hover neutral, Ring wie frei`, async ({ page }) => {
      await page.goto(k.adresse);
      await page.locator('.ka[data-id="4"] .id').click();
      await expect(page.getByRole('dialog', { name: 'Aufgabe #4' })).toBeVisible();
      await liveBereit(page);
      await reiter(page, 'Commits');
      const knopf = page.locator(COMMITS_NEU);
      await expect(knopf).toBeVisible();
      await expect(page.locator('#commits-status')).toContainText('gelesen');
      await thema(page, name);
      const r = await rollen(page);
      await perTab(page, knopf, page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]'));
      const frei = await form(knopf);
      await gleich(page, frei.farbe, r['--kd-accent-ink'], 'frei: Schrift --kd-accent-ink');
      expect(frei.zeiger, 'frei: Zeiger').toBe('pointer');
      const h = await halten(page, '/api/aufgaben/4/commits');
      await page.keyboard.press('Enter');
      await expect(knopf).toHaveAttribute('aria-disabled', 'true');
      await expect(knopf).toBeFocused();
      const f = await gedaempft(page, knopf, r, 'Neu lesen (Commits)');
      expect(f.grund, 'durchsichtig').toBe(DURCHSICHTIG);
      expect(f.randBreite, 'kein Rand').toBe('0px');
      await hoverNeutral(page, knopf, f, r, 'Neu lesen (Commits)');
      ringGleich(frei, await form(knopf), 'Neu lesen (Commits)', false);
      await h.freigeben();
      await expect(knopf).not.toHaveAttribute('aria-disabled', 'true');
    });
  }
});

test.describe('R00229 Laufansicht bleibt', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    await lv.ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  for (const [farbe, name] of THEMEN) {
    test(`AK 7 · US-3: ${farbe} — „Erneut versuchen“ der Laufansicht gesperrt: --kd-faint, --kd-line, --kd-surface, Hover neutral, Zeiger Z, Ring wie frei`, async ({ page }) => {
      const h = await halten(page, '/api/aufgaben/1/transkripte/');
      await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(lv.L.L1)}`);
      await expect(page.locator('#lv-h1')).toBeVisible();
      await h.freigeben(503);
      const knopf = page.locator(LV_ERNEUT);
      await expect(knopf).toBeVisible();
      await thema(page, name);
      const r = await rollen(page);
      await perTab(page, knopf, page.locator('#lv-rueckweg'));
      const frei = await form(knopf);
      await gleich(page, frei.farbe, r['--kd-text'], 'frei: Schrift --kd-text');
      await gleich(page, frei.rand, r['--kd-line-strong'], 'frei: Kontur --kd-line-strong');
      await page.keyboard.press('Enter');
      await expect(knopf).toHaveAttribute('aria-disabled', 'true');
      const f = await gedaempft(page, knopf, r, 'Erneut versuchen (Laufansicht)');
      await gleich(page, f.rand, r['--kd-line'], 'Kontur --kd-line');
      await gleich(page, f.grund, r['--kd-surface'], 'Fläche --kd-surface');
      await hoverNeutral(page, knopf, f, r, 'Erneut versuchen (Laufansicht)');
      ringGleich(frei, await form(knopf), 'Erneut versuchen (Laufansicht)');
      await h.freigeben(503);
    });
  }
});
