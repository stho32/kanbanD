// R00218 Nachfolger eines verwaisten Commits suchen und ersetzen (Karte #220, I0208) — Oberfläche, AK 7–13 im echten Programm.
// AK 12 (mittlere Form der Liste ohne Suche) läuft auf der Ausgangslage von R00205 (commits-hilfen.js, Breitendaten an #4 und #3);
// AK 7–11, 13 auf der Ausgangslage von R00218 (nachfolger-hilfen.js).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, breiteSetzen, reiter, thema, mutanteEinsetzen } = require('./hilfen');
const { geteiltesRepository, ausgangslageVorbereiten } = require('./commits-hilfen');

const PANEL = '#fenster .mod-body[aria-label="Ansicht: Commits"]';
const ZEILEN = `${PANEL} tbody tr.cl-z`;
const kurz = h => `kd:${h.slice(0, 7)}`;
const zeileMit = (page, text) => page.locator(ZEILEN).filter({ has: page.locator('th .cl-hash', { hasText: new RegExp(`^${text}$`) }) });

/** Läuft im Browser: Überlauf von Seite, Fenster und Rahmen (gegen clientWidth) und jedes Element der Ansicht mit rechter Kante darüber. */
const ueberlaufMessen = () => {
  const de = document.documentElement, fenster = document.getElementById('fenster'), rahmen = document.querySelector('#fenster .cl-rahmen');
  const rechts = [...fenster.querySelectorAll('.mod-body *')]
    .filter(e => !e.closest('.vh') && e.getClientRects().length && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().right > de.clientWidth + 0.5)
    .map(e => `${e.tagName.toLowerCase()}.${e.className} rechts ${Math.round(e.getBoundingClientRect().right)} > ${de.clientWidth}`);
  return {
    seite: de.scrollWidth <= de.clientWidth ? 'ok' : `${de.scrollWidth} > ${de.clientWidth}`,
    fenster: fenster.scrollWidth <= fenster.clientWidth ? 'ok' : `${fenster.scrollWidth} > ${fenster.clientWidth}`,
    rahmen: !rahmen ? 'fehlt' : rahmen.scrollWidth <= rahmen.clientWidth ? 'ok' : `${rahmen.scrollWidth} > ${rahmen.clientWidth}`,
    rechts: rechts.slice(0, 6),
  };
};

/** Läuft im Browser: Lage der Zellen einer Zeile (gefunden über den Kurz-Hash). */
const lageMessen = h => {
  const zeile = [...document.querySelectorAll('#fenster tbody tr.cl-z')].find(r => r.querySelector('th .cl-hash').textContent === h);
  const r = sel => { const b = zeile.querySelector(sel).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
  const kopf = document.querySelector('#fenster thead').getBoundingClientRect();
  return { kopfBreite: kopf.width, hash: r('.cl-c-hash'), titel: r('.cl-c-titel'), autor: r('.cl-c-autor'), datum: r('.cl-c-datum'), pm: r('.cl-c-pm'), zst: r('.cl-c-zst') };
};

test.describe('R00218 AK 12 — Liste ohne Suche in der mittleren Form', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    const geteilt = geteiltesRepository();
    rep = geteilt.rep;
    k = await kanbanStarten(ausgangslageVorbereiten(rep, geteilt.basis));
  });
  test.afterEach(() => k.stoppen());

  async function commitsOeffnen(page, nr) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator(PANEL)).toBeVisible();
    await expect(page.locator(ZEILEN)).toHaveCount(8);
  }
  /** Breitendaten wie R00205 AK 8: #4 mit aufgeklappter Zweigliste. */
  async function breitendatenOeffnen(page) {
    await commitsOeffnen(page, 4);
    await zeileMit(page, kurz(rep.z)).getByRole('button', { name: '20 weitere Zweige zeigen' }).click();
    await expect(page.locator(`${PANEL} tr.cl-zw`)).toHaveCount(1);
  }

  for (const farbe of ['hell', 'dunkel']) {
    for (const breite of [641, 768, 980]) {
      test(`AK 12: ${breite} px ${farbe} — Seite, Fenster und Rahmen der Liste scrollen nicht quer, nichts ragt über clientWidth (#4 mit Zweigliste, #3)`, async ({ page }) => {
        await breitendatenOeffnen(page);
        await thema(page, farbe === 'hell' ? 'light' : 'dark');
        await breiteSetzen(page, breite);
        expect(await page.evaluate(ueberlaufMessen), `#4 ${breite}`).toEqual({ seite: 'ok', fenster: 'ok', rahmen: 'ok', rechts: [] });
        await page.keyboard.press('Escape');
        await commitsOeffnen(page, 3);
        expect(await page.evaluate(ueberlaufMessen), `#3 ${breite}`).toEqual({ seite: 'ok', fenster: 'ok', rahmen: 'ok', rechts: [] });
      });
    }
  }

  for (const breite of [641, 768, 980, 1099]) {
    test(`AK 12: ${breite} px — links der Hash, rechts untereinander Titel (≥ 200 px), Autor · Datum, Zustand bzw. Zweige; +/− oben rechts neben dem Titel; Spaltenköpfe vorlesbar`, async ({ page }) => {
      await breitendatenOeffnen(page);
      await breiteSetzen(page, breite);
      for (const h of [rep.z, rep.t500, rep.boese]) {
        const l = await page.evaluate(lageMessen, kurz(h));
        expect(l.kopfBreite, `${breite}: Spaltenköpfe nur für Bedienhilfen`).toBeLessThanOrEqual(1);
        expect(l.titel.width, `${breite} ${kurz(h)}: Titel`).toBeGreaterThanOrEqual(200);
        expect(l.titel.left, 'Titel rechts vom Hash').toBeGreaterThanOrEqual(l.hash.right - 0.5);
        expect(Math.abs(l.titel.top - l.hash.top), 'Titel in der Reihe des Hashs').toBeLessThanOrEqual(3);
        expect(l.autor.top, 'Autor unter dem Titel').toBeGreaterThanOrEqual(l.titel.bottom - 1);
        expect(Math.abs(l.autor.top - l.datum.top), 'Autor und Datum in einer Reihe').toBeLessThanOrEqual(3);
        expect(l.autor.left, 'Autor in der rechten Spalte').toBeGreaterThanOrEqual(l.hash.right - 0.5);
        expect(l.zst.top, 'Zustand bzw. Zweige zuletzt').toBeGreaterThanOrEqual(l.autor.bottom - 1);
        expect(l.zst.left, 'Zustand in der rechten Spalte').toBeGreaterThanOrEqual(l.hash.right - 0.5);
        expect(Math.abs(l.pm.top - l.titel.top), '+/− in der Reihe des Titels (Sollte C)').toBeLessThanOrEqual(3);
        expect(l.pm.left, '+/− rechts neben dem Titel').toBeGreaterThanOrEqual(l.titel.right - 0.5);
      }
      const koepfe = await page.locator(`${PANEL} thead th[scope="col"]`).allTextContents();
      expect(koepfe).toEqual(['Commit', 'Titel', 'Autor', 'Datum', '+ / −', 'Zustand']);
      await expect(page.locator(`${PANEL} tbody th[scope="row"]`).first()).toBeAttached();
    });
  }

  for (const breite of [641, 768]) {
    test(`AK 12 (Sollte B): ${breite} px — die aufgeklappte Zweigliste nimmt die ganze rechte Spalte ein (mindestens so breit wie der Titel darüber)`, async ({ page }) => {
      await breitendatenOeffnen(page);
      await breiteSetzen(page, breite);
      const { liste, titel } = await page.evaluate(h => {
        const zeile = [...document.querySelectorAll('#fenster tbody tr.cl-z')].find(r => r.querySelector('th .cl-hash').textContent === h);
        return { liste: document.querySelector('#fenster tr.cl-zw .cl-zeilen').getBoundingClientRect().width, titel: zeile.querySelector('.cl-c-titel').getBoundingClientRect().width };
      }, kurz(rep.z));
      expect(liste).toBeGreaterThanOrEqual(Math.min(titel, 200));
      expect(liste).toBeGreaterThanOrEqual(titel - 1);
    });
  }

  test('AK 12: Grenze an .rv-abs-rumpf — 640 px schmal, 1099 px mittel, 1100 px Tabelle mit sichtbaren Spaltenköpfen', async ({ page }) => {
    await breitendatenOeffnen(page);
    await breiteSetzen(page, 640);
    const schmal = await page.evaluate(lageMessen, kurz(rep.z));
    expect(schmal.titel.top, '640: Titel unter dem Hash (schmale Form)').toBeGreaterThanOrEqual(schmal.hash.bottom - 1);
    await breiteSetzen(page, 1099);
    const mittel = await page.evaluate(lageMessen, kurz(rep.z));
    expect(Math.abs(mittel.titel.top - mittel.hash.top), '1099: Titel neben dem Hash').toBeLessThanOrEqual(3);
    expect(mittel.autor.top, '1099: Autor unter dem Titel').toBeGreaterThanOrEqual(mittel.titel.bottom - 1);
    await breiteSetzen(page, 1100);
    const breit = await page.evaluate(lageMessen, kurz(rep.z));
    expect(breit.kopfBreite, '1100: Spaltenköpfe sichtbar').toBeGreaterThan(300);
    expect(Math.abs(breit.autor.top - breit.titel.top), '1100: Autor in der Reihe des Titels (Tabelle)').toBeLessThanOrEqual(1);
    expect(breit.autor.left).toBeGreaterThan(breit.titel.left);
  });

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 768, height: 900 }, isMobile: true, hasTouch: true });

    test('AK 12: bei grobem Zeiger und 768 px ist jedes Bedienziel der Ansicht mindestens 48 × 48 px — „+n weitere“, „Neu lesen“, „Alle Änderungen ansehen“, der Kurz-Hash-Verweis, „Erneut versuchen“', async ({ page }) => {
      await commitsOeffnen(page, 4);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches && innerWidth === 768)).toBe(true);
      const maße = loc => loc.evaluate(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; });
      for (const ziel of [page.getByRole('button', { name: /weitere Zweige zeigen/ }).first(), page.locator('#commits-neu'), page.getByRole('link', { name: 'Alle Änderungen ansehen' })]) {
        const [b, h] = await maße(ziel);
        expect(b, await ziel.innerText()).toBeGreaterThanOrEqual(47.5);
        expect(h, await ziel.innerText()).toBeGreaterThanOrEqual(47.5);
      }
      // der Kurz-Hash-Verweis trägt seine Zeile als Fläche (::after, R00207 FA 1): gemessen ist die Zeile, und ein Punkt im Titel trifft ihn
      const ziel = await page.evaluate(h => {
        const zeile = [...document.querySelectorAll('#fenster tbody tr.cl-z')].find(r => r.querySelector('th .cl-hash').textContent === h);
        const a = zeile.querySelector('a.cl-hash'), r = zeile.getBoundingClientRect(), t = zeile.querySelector('.cl-c-titel').getBoundingClientRect();
        return { b: r.width, h: r.height, trifft: document.elementFromPoint(t.left + 4, t.top + 4) === a };
      }, kurz(rep.z));
      expect(ziel).toEqual({ b: expect.any(Number), h: expect.any(Number), trifft: true });
      expect(ziel.b).toBeGreaterThanOrEqual(47.5);
      expect(ziel.h).toBeGreaterThanOrEqual(47.5);
      await page.route('**/api/aufgaben/4/commits', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"fehler":"x"}' }));
      await page.locator('#commits-neu').click();
      const erneut = page.getByRole('button', { name: 'Erneut versuchen' });
      await expect(erneut).toBeVisible();
      const [b, h] = await maße(erneut);
      expect(b).toBeGreaterThanOrEqual(47.5);
      expect(h).toBeGreaterThanOrEqual(47.5);
    });
  });
});
