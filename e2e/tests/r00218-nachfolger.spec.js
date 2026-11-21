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

/* ── AK 7–11, 13 auf der Ausgangslage von R00218 ── */
const { nachfolgerRepository, nachfolgerVorbereiten, geteiltesNachfolgerRepository } = require('./nachfolger-hilfen');
const { basisAnlegen } = require('./commits-hilfen');
const { alsPerson } = require('./hilfen');

const SUCHEN = 'Nachfolger suchen';
const LAEDT = 'Sucht Commits mit gleichem Patch …';
const GRUPPE = '#nf-gruppe';

/** Hält jede Antwort von `GET …/nachfolger` der Aufgabe `nr`, bis `frei()`; `aufrufe` zählt die Anfragen. `antwort` ersetzt die Antwort. */
async function nachfolgerHalten(page, nr, antwort = null) {
  const aufrufe = [];
  let freigaben = [];
  await page.route(new RegExp(`/api/aufgaben/${nr}/commits/[^/]+/nachfolger$`), async route => {
    aufrufe.push(route.request().url());
    await new Promise(r => freigaben.push(r));
    if (antwort) await route.fulfill(typeof antwort === 'function' ? await antwort(route) : antwort);
    else await route.continue();
  });
  return { aufrufe, frei: () => { const f = freigaben; freigaben = []; f.forEach(r => r()); } };
}

/** Zählt `GET …/nachfolger` ohne zu halten. */
function nachfolgerZaehlen(page) {
  const aufrufe = [];
  page.on('request', r => { if (r.method() === 'GET' && /\/commits\/[^/]+\/nachfolger$/.test(new URL(r.url()).pathname)) aufrufe.push(r.url()); });
  return aufrufe;
}

/** Ein Beobachter, der jeden neuen Text in [role=status], [role=alert] und [aria-live] der Ansicht mitschreibt (AK 13); leere Texte zählen nicht. */
async function ansagenBeobachten(page) {
  await page.evaluate(() => {
    window.kdAnsagen = [];
    const live = n => n && n.nodeType === 1 && n.matches('[role=status],[role=alert],[aria-live]');
    const region = n => { for (let e = n && (n.nodeType === 1 ? n : n.parentElement); e; e = e.parentElement) if (live(e)) return e; return null; };
    const merken = (r, art) => { const t = r.textContent.trim(); if (t) window.kdAnsagen.push({ text: t, art, id: r.id }); };
    new MutationObserver(liste => {
      for (const m of liste) {
        if (!document.querySelector('#fenster') || !document.querySelector('#fenster').contains(m.target)) continue;
        if (m.type === 'childList') {
          for (const n of m.addedNodes) {
            // ein eingehängter Knoten ist noch keine Ansage (der gehaltene Statusbereich wird bei jedem Zeichnen neu eingehängt); gesprochen wird ein neuer Text darin
            if (live(n)) { window.kdAnsagen.push({ knoten: true, id: n.id }); continue; }
            const r = region(m.target); if (r) merken(r, 'text');
          }
        } else if (m.type === 'characterData') { const r = region(m.target); if (r) merken(r, 'text'); }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  return () => page.evaluate(() => window.kdAnsagen.filter(a => a.text).map(a => a.text));
}

test.describe('R00218 AK 7–11, 13 — Nachfolger in der Ansicht „Commits“', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = geteiltesNachfolgerRepository().rep;
    k = await kanbanStarten(nachfolgerVorbereiten(rep));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  async function commitsOeffnen(page, nr, anzahl) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator(ZEILEN)).toHaveCount(anzahl);
  }
  const suchKnopf = (page, h) => zeileMit(page, kurz(h)).getByRole('button', { name: SUCHEN });
  const gruppe = page => page.locator(GRUPPE);
  const text = loc => loc.innerText().then(t => t.replace(/\s+/g, ' ').trim());

  /* ── AK 7 ── */

  test('AK 7: nur der Eintrag „auf keinem Zweig“ trägt „Nachfolger suchen“; Öffnen und „Neu lesen“ suchen nicht', async ({ page }) => {
    const aufrufe = nachfolgerZaehlen(page);
    await commitsOeffnen(page, 1, 2);
    await expect(suchKnopf(page, rep.k)).toHaveCount(1);
    await expect(zeileMit(page, kurz(rep.m1)).getByRole('button', { name: SUCHEN })).toHaveCount(0);
    await page.locator('#commits-neu').click();
    await expect(page.locator('#commits-status')).toHaveText('2 Commits gelesen');
    expect(aufrufe).toEqual([]);
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/review`);
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('button', { name: SUCHEN })).toHaveCount(0);
  });

  test('AK 7, AK 13: ein Klick ergibt genau einen Aufruf; „Sucht …“, Sperre, kein zweiter Aufruf; danach Kopf, K′ mit Zweig main und „Ersetzen durch …“, Fokus auf der Gruppe', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const ansagen = await ansagenBeobachten(page);
    const h = await nachfolgerHalten(page, 1);
    await suchKnopf(page, rep.k).click();
    await expect(page.getByText(LAEDT, { exact: true }).first()).toBeVisible();
    const knopf = suchKnopf(page, rep.k);
    await expect(knopf).toHaveAttribute('aria-disabled', 'true');
    await expect(knopf).toHaveAttribute('aria-busy', 'true');
    await expect(knopf).toBeFocused();
    await knopf.click({ force: true });
    expect(h.aufrufe.length, 'der zweite Klick am gesperrten Knopf ruft nicht').toBe(1);
    h.frei();
    await expect(gruppe(page)).toBeFocused();
    await expect(gruppe(page)).toHaveAttribute('aria-label', `Nachfolger von ${kurz(rep.k)}`);
    await expect(page.locator(`${GRUPPE} .nf-kopf b`)).toHaveText('1 Commit mit gleichem Patch');
    await expect(page.locator(`${GRUPPE} .nf-kopf span`)).toHaveText(`neuester zuerst · „Ersetzen“ trägt ihn an der Stelle von ${kurz(rep.k)} ein`);
    const kand = page.locator(`${GRUPPE} .nf-k`);
    await expect(kand).toHaveCount(1);
    expect(await text(kand)).toContain(kurz(rep.k2));
    expect(await text(kand)).toContain('Zeile zwei ändern');
    expect(await text(kand)).toContain('Ada Autorin');
    expect(await text(kand)).toContain('04.05.2026');
    await expect(kand.locator('.cl-br')).toHaveText(['main']);
    await expect(kand.getByRole('button', { name: `Ersetzen durch ${kurz(rep.k2)}`, exact: true })).toBeVisible();
    // Keine Live-Region am Fokusziel, der erste Satz beschreibt die Gruppe; je Suche höchstens eine Ansage: „Sucht …“
    expect(await gruppe(page).evaluate(g => g.querySelectorAll('[role=status],[role=alert],[aria-live]').length)).toBe(0);
    await expect(gruppe(page)).toHaveAttribute('aria-describedby', 'nf-erster');
    expect(await ansagen()).toEqual([LAEDT]);
    expect(h.aufrufe.length).toBe(1);
  });

  test('AK 7: erneuter Klick bei angezeigtem Ergebnis — Ergebnis weg, „Sucht …“, gesperrt, genau ein weiterer Aufruf, dann das neue Ergebnis', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const h = await nachfolgerHalten(page, 1);
    await suchKnopf(page, rep.k).click();
    h.frei();
    await expect(page.locator(`${GRUPPE} .nf-k`)).toHaveCount(1);
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE}`)).toHaveCount(0);
    await expect(page.getByText(LAEDT, { exact: true }).first()).toBeVisible();
    await expect(suchKnopf(page, rep.k)).toHaveAttribute('aria-disabled', 'true');
    expect(h.aufrufe.length).toBe(2);
    h.frei();
    await expect(page.locator(`${GRUPPE} .nf-k`)).toHaveCount(1);
    expect(h.aufrufe.length).toBe(2);
  });

  test('AK 7: #3 — K′ steht schon an der Aufgabe: Marke, „Verwaisten Verweis entfernen“, nur der Zusatz zu „Entfernen“', async ({ page }) => {
    await commitsOeffnen(page, 3, 2);
    await suchKnopf(page, rep.k).click();
    const kand = page.locator(`${GRUPPE} .nf-k`);
    await expect(kand).toHaveCount(1);
    await expect(kand.locator('.nf-marke')).toHaveText('schon an der Aufgabe');
    await expect(kand.getByRole('button', { name: 'Verwaisten Verweis entfernen', exact: true })).toBeVisible();
    await expect(kand.getByRole('button', { name: /^Ersetzen/ })).toHaveCount(0);
    await expect(page.locator(`${GRUPPE} .nf-kopf span`)).toHaveText(`neuester zuerst · „Verwaisten Verweis entfernen“ nimmt ${kurz(rep.k)} von der Aufgabe`);
  });

  test('AK 7: gemischte Antwort (per page.route) — beide Zusätze, zuerst „Ersetzen“', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const echt = await (await page.request.get(`${k.adresse}api/aufgaben/1/commits/kd:${rep.k}/nachfolger`)).json();
    const zweiter = { ...echt.kandidaten[0], verweis: `kd:${'b'.repeat(40)}`, hash: 'b'.repeat(40), an_der_karte: true };
    await page.route(/\/nachfolger$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...echt, kandidaten: [echt.kandidaten[0], zweiter] }) }));
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE} .nf-kopf span`)).toHaveText(`neuester zuerst · „Ersetzen“ trägt ihn an der Stelle von ${kurz(rep.k)} ein · „Verwaisten Verweis entfernen“ nimmt ${kurz(rep.k)} von der Aufgabe`);
  });

  test('AK 7: Zweige am Kandidaten — drei Namen und „+7 weitere“, auf- und zuklappen mit Fokus am Knopf; mit genau 3 kein Knopf; neue Suche klappt zu', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const echt = await (await page.request.get(`${k.adresse}api/aufgaben/1/commits/kd:${rep.k}/nachfolger`)).json();
    let zweige = Array.from({ length: 10 }, (_, i) => `z${String(i).padStart(2, '0')}`);
    await page.route(/\/nachfolger$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...echt, kandidaten: [{ ...echt.kandidaten[0], zweige }] }) }));
    await suchKnopf(page, rep.k).click();
    const kand = page.locator(`${GRUPPE} .nf-k`);
    await expect(kand.locator('.cl-zweige .cl-br')).toHaveText(['z00', 'z01', 'z02']);
    const mehr = kand.getByRole('button', { name: '7 weitere Zweige zeigen' });
    await expect(mehr).toHaveAttribute('aria-expanded', 'false');
    await expect(mehr).toHaveText('+7 weitere');
    await mehr.click();
    const zu = kand.getByRole('button', { name: '7 weitere Zweige verbergen' });
    await expect(zu).toHaveAttribute('aria-expanded', 'true');
    await expect(zu).toBeFocused();
    await expect(kand.locator('.nf-zw')).toContainText('LOKALE ZWEIGE 10');
    await expect(kand.locator('.nf-zw .cl-br')).toHaveCount(10);
    await expect(kand.locator('.nf-zw')).not.toContainText('ENTFERNTE ZWEIGE');
    await zu.click();
    await expect(kand.getByRole('button', { name: '7 weitere Zweige zeigen' })).toBeFocused();
    await expect(kand.locator('.nf-zw')).toHaveCount(0);
    await kand.getByRole('button', { name: '7 weitere Zweige zeigen' }).click();
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE} .nf-k .nf-zw`)).toHaveCount(0);
    await expect(page.locator(`${GRUPPE} .nf-k`).getByRole('button', { name: '7 weitere Zweige zeigen' })).toHaveAttribute('aria-expanded', 'false');
    zweige = ['a', 'b', 'c'];
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE} .nf-k .cl-zweige .cl-br`)).toHaveText(['a', 'b', 'c']);
    await expect(page.locator(`${GRUPPE} .nf-k .cl-mehr`)).toHaveCount(0);
  });

  test('AK 7, AK 13: zwei verwaiste Einträge (#4) — höchstens eine Suche und ein Ergebnis; während S1 gesucht wird, ist „Nachfolger suchen“ an B gesperrt; die Gruppe von B bekommt den Fokus', async ({ page }) => {
    await commitsOeffnen(page, 4, 4);
    const h = await nachfolgerHalten(page, 4);
    await suchKnopf(page, rep.s1).click();
    for (const andere of [rep.mg, rep.e, rep.b]) {
      await expect(suchKnopf(page, andere)).toHaveAttribute('aria-disabled', 'true');
      await expect(suchKnopf(page, andere)).toHaveAttribute('data-sperrform', '');
    }
    await suchKnopf(page, rep.b).click({ force: true });
    h.frei();
    await expect(gruppe(page)).toHaveAttribute('aria-label', `Nachfolger von ${kurz(rep.s1)}`);
    expect(h.aufrufe.length, 'der Klick an B während der Suche löste keinen Aufruf aus').toBe(1);
    await suchKnopf(page, rep.b).click();
    h.frei();
    await expect(gruppe(page)).toHaveAttribute('aria-label', `Nachfolger von ${kurz(rep.b)}`);
    await expect(gruppe(page)).toHaveCount(1);
    await expect(gruppe(page)).toBeFocused();
    expect(h.aufrufe.length).toBe(2);
  });

  /* ── AK 8 ── */

  test('AK 8: Squash, Merge und leerer Commit — die Sätze aus ADR-0038 und der PO-Entscheidung', async ({ page }) => {
    await commitsOeffnen(page, 4, 4);
    const faelle = [[rep.s1, 'Kein Commit mit gleichem Patch auf einem Zweig gefunden. Nach Squash oder einem anders gelösten Konflikt findet die Suche keinen Nachfolger.'], [rep.mg, 'Für einen Merge-Commit sucht kanbanD keinen Nachfolger.'], [rep.e, 'Der Commit ändert keine Datei, darum gibt es keinen Patch zum Vergleichen.']];
    for (const [h, satz] of faelle) {
      await suchKnopf(page, h).click();
      await expect(page.locator(`${GRUPPE} #nf-erster`)).toHaveText(satz);
      await expect(page.locator(`${GRUPPE} .nf-k`)).toHaveCount(0);
    }
  });

  test('AK 8: gekappt, weitere (Einzahl und Mehrzahl) und der Ort der Sätze nach der Liste (per page.route)', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const echt = await (await page.request.get(`${k.adresse}api/aufgaben/1/commits/kd:${rep.k}/nachfolger`)).json();
    const zehn = Array.from({ length: 10 }, (_, i) => ({ ...echt.kandidaten[0], verweis: `kd:${String(i).repeat(40)}`, hash: String(i).repeat(40) }));
    let rumpf = { ...echt, kandidaten: [], hinweise: [{ art: 'suche_gekappt', durchsucht: 1000, grund: 'vorfilter' }] };
    await page.route(/\/nachfolger$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rumpf) }));
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE} .nf-satz`)).toHaveText(['Die Suche hat nach 1.000 Commits aufgehört; ein Nachfolger kann fehlen.', 'Kein Commit mit gleichem Patch auf einem Zweig gefunden.']);
    rumpf = { ...echt, kandidaten: zehn, kandidaten_weitere: 2, hinweise: [] };
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE} .nf-k`)).toHaveCount(10);
    await expect(page.locator(`${GRUPPE} .nf-satz`)).toHaveText(['2 weitere Commits mit gleichem Patch sind nicht gezeigt.']);
    rumpf = { ...echt, kandidaten: zehn, kandidaten_weitere: 1, hinweise: [{ art: 'suche_gekappt', durchsucht: 1000, grund: 'fenster' }] };
    await suchKnopf(page, rep.k).click();
    const folge = await gruppe(page).evaluate(g => [...g.children].map(e => e.matches('.nf-kopf') ? 'kopf' : e.matches('ul') ? 'liste' : e.textContent));
    expect(folge).toEqual(['kopf', 'liste', '1 weiterer Commit mit gleichem Patch ist nicht gezeigt.', 'Die Suche hat nach 1.000 Commits aufgehört; ein Nachfolger kann fehlen.']);
  });

  test('AK 8, AK 13: 503 mit „Erneut versuchen“ (genau ein weiterer Aufruf), ohne Verbindung ohne Zahl; der Satz beschreibt die Gruppe', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    let art = 503;
    const aufrufe = [];
    await page.route(/\/nachfolger$/, route => { aufrufe.push(1); return art === 0 ? route.abort() : route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Git hängt' }) }); });
    await suchKnopf(page, rep.k).click();
    await expect(page.locator(`${GRUPPE} #nf-erster`)).toHaveText('Der Nachfolger ließ sich nicht suchen: Git hängt (503).');
    await expect(gruppe(page)).toBeFocused();
    await expect(gruppe(page)).toHaveAttribute('aria-describedby', 'nf-erster');
    art = 0;
    await gruppe(page).getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(page.locator(`${GRUPPE} #nf-erster`)).toHaveText('Der Nachfolger ließ sich nicht suchen: keine Verbindung zum Programm.');
    expect(aufrufe.length).toBe(2);
    await expect(gruppe(page).getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  });

  /* ── AK 10: Nachbarübergänge der Suche ── */

  test('AK 10: Ansichtswechsel während der Suche — keine Fehlermeldung, „Inhalt“ unverändert, zurück steht wieder „Nachfolger suchen“; „Neu lesen“ verwirft das Ergebnis', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const h = await nachfolgerHalten(page, 1);
    await suchKnopf(page, rep.k).click();
    await reiter(page, 'Inhalt');
    const inhalt = await page.locator('#fenster .mod-body').innerHTML();
    h.frei();
    await page.waitForTimeout(0);
    await expect(page.locator('#fenster .mod-body')).not.toContainText('ließ sich nicht');
    expect(await page.locator('#fenster .mod-body').innerHTML()).toBe(inhalt);
    await reiter(page, 'Commits');
    await expect(page.locator(ZEILEN)).toHaveCount(2);
    await expect(suchKnopf(page, rep.k)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(gruppe(page)).toHaveCount(0);
    await suchKnopf(page, rep.k).click();
    h.frei();
    await expect(page.locator(`${GRUPPE} .nf-k`)).toHaveCount(1);
    await page.locator('#commits-neu').click();
    await expect(page.locator(ZEILEN)).toHaveCount(2);
    await expect(gruppe(page)).toHaveCount(0);
  });

  /* ── AK 13: Fokus nur vom Auslöser (Sollte A der UX-Vorprüfung: stille Ankunft ohne Fokusraub) ── */

  test('AK 13: setzt sh den Fokus vor der Antwort auf „Neu lesen“, bleibt er dort; das Ergebnis kommt still an (keine weitere Ansage)', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const ansagen = await ansagenBeobachten(page);
    const h = await nachfolgerHalten(page, 1);
    await suchKnopf(page, rep.k).click();
    await page.locator('#commits-neu').focus();
    h.frei();
    await expect(page.locator(`${GRUPPE} .nf-k`)).toHaveCount(1);
    await expect(page.locator('#commits-neu')).toBeFocused();
    expect(await ansagen()).toEqual([LAEDT]);
  });
});
