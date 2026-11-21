// R00218 Nachfolger eines verwaisten Commits suchen und ersetzen (Karte #220, I0208) — Oberfläche, AK 7–13 im echten Programm.
// AK 12 (mittlere Form der Liste ohne Suche) läuft auf der Ausgangslage von R00205 (commits-hilfen.js, Breitendaten an #4 und #3);
// AK 7–11, 13 auf der Ausgangslage von R00218 (nachfolger-hilfen.js).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, breiteSetzen, reiter, thema, mutanteEinsetzen, kontrastMessen, kontrastFarben, kontrastAm } = require('./hilfen');
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

/** Zählt `GET …/commits` der Aufgabe 1 (das Neulesen der Liste). */
function zaehlen1(page) {
  const aufrufe = [];
  page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === '/api/aufgaben/1/commits') aufrufe.push(r.url()); });
  return aufrufe;
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

  /* ── AK 9 Ersetzen und Entfernen, AK 10 Fehler und Sperre, AK 13 Ansage beim Erfolg (jeder Test mit eigenem R, er schreibt an der Karte) ── */

  const zahl = () => +k.git('rev-list', '--count', 'HEAD');
  const datei = nr => k.lies(`aufgaben/000${nr}-karte-${nr}.md`);
  const ersetzenKnopf = page => page.locator(`${GRUPPE} .nf-k`).first().getByRole('button', { name: /^Ersetzen/ });
  const entfernenKnopf = page => page.locator(GRUPPE).getByRole('button', { name: 'Verwaisten Verweis entfernen', exact: true });
  /** Die Verweise der Aufgabendatei in ihrer Reihenfolge: „an Platz 1“ heißt an der Stelle des alten Verweises (R00203 FA 3). */
  const verweiseDerDatei = nr => [...datei(nr).matchAll(/^  - (.+)$/gm)].map(m => m[1].replace(/"/g, ''));
  /** Hält `methode` auf `muster`, bis `frei()`; zählt die Anfragen samt Rumpf. */
  async function schreibenHalten(page, methode, muster) {
    const aufrufe = []; let freigaben = [];
    await page.route(muster, async route => {
      if (route.request().method() !== methode) return route.continue();
      aufrufe.push(route.request().postData());
      await new Promise(r => freigaben.push(r));
      await route.continue();
    });
    return { aufrufe, frei: () => { const f = freigaben; freigaben = []; f.forEach(r => r()); } };
  }

  test('AK 9, AK 13: „Ersetzen“ — genau ein POST mit dem Paar, ein Commit von sh, Liste neu mit K′ an Platz 1, „Ersetzt durch …“ als einzige Ansage, danach Fokus auf dem Kurz-Hash von K′', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const vorher = zahl();
    const dialoge = []; page.on('dialog', d => { dialoge.push(d.message()); d.dismiss(); });
    await suchKnopf(page, rep.k).click();
    await expect(gruppe(page)).toBeFocused();
    const ansagen = await ansagenBeobachten(page);
    const fokusBeimText = page.evaluate(() => new Promise(fertig => {
      const st = document.getElementById('commits-status');
      new MutationObserver((_, b) => { if (st.textContent.startsWith('Ersetzt')) { b.disconnect(); fertig(document.activeElement.className); } }).observe(st, { childList: true, characterData: true, subtree: true });
    }));
    const h = await schreibenHalten(page, 'POST', '**/api/aufgaben/1/commits/ersetzen');
    const gelesen = zaehlen1(page);
    await ersetzenKnopf(page).click();
    await expect(page.locator('#commits-status')).toHaveText('');
    expect(h.aufrufe.map(JSON.parse)).toEqual([{ ersetzungen: [{ alt: `kd:${rep.k}`, neu: `kd:${rep.k2}` }] }]);
    h.frei();
    await expect(page.locator('#commits-status')).toHaveText(`Ersetzt durch ${kurz(rep.k2)}.`);
    await expect(page.locator('#commits-status')).toBeVisible();
    const ziel = page.locator(`${ZEILEN} a.cl-hash`, { hasText: kurz(rep.k2) });
    await expect(ziel).toBeFocused();
    expect(await ziel.getAttribute('aria-label')).toMatch(new RegExp(`^Commit ${kurz(rep.k2)}`));
    expect(await fokusBeimText, 'der Fokus springt erst, wenn der Satz steht').not.toContain('cl-hash');
    expect(verweiseDerDatei(1)[0]).toBe(`kd:${rep.k2}`);
    await expect(zeileMit(page, kurz(rep.k2)).locator('.cl-br')).toHaveText(['main']);
    await expect(page.locator(`${PANEL}`).getByText('auf keinem Zweig')).toHaveCount(0);
    expect(zahl()).toBe(vorher + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    expect(gelesen.length, 'die Liste wird einmal neu gelesen').toBe(1);
    expect(await ansagen()).toEqual([`Ersetzt durch ${kurz(rep.k2)}.`]);
    expect(dialoge).toEqual([]);
    expect(h.aufrufe.length).toBe(1);
  });

  test('AK 9: #3 „Verwaisten Verweis entfernen“ — genau ein DELETE, ein Commit, K′ allein, Satz im Statusbereich, Fokus auf dem Kurz-Hash von K′', async ({ page }) => {
    await commitsOeffnen(page, 3, 2);
    const vorher = zahl();
    await suchKnopf(page, rep.k).click();
    const ansagen = await ansagenBeobachten(page);
    const h = await schreibenHalten(page, 'DELETE', /\/api\/aufgaben\/3\/commits\/[^/]+$/);
    await entfernenKnopf(page).click();
    h.frei();
    await expect(page.locator('#commits-status')).toHaveText(`Verwaisten Verweis ${kurz(rep.k)} entfernt.`);
    await expect(page.locator(ZEILEN)).toHaveCount(1);
    await expect(page.locator(`${ZEILEN} a.cl-hash`, { hasText: kurz(rep.k2) })).toBeFocused();
    expect(h.aufrufe.length).toBe(1);
    expect(zahl()).toBe(vorher + 1);
    expect(await ansagen()).toEqual([`Verwaisten Verweis ${kurz(rep.k)} entfernt.`]);
  });

  test('AK 9: ohne gewählte Person öffnet „Ersetzen“ „Ich bin …“ mit Hinweis und sendet nichts', async ({ page }) => {
    // nach dem Setzen aus beforeEach: ohne Person
    await page.addInitScript(() => sessionStorage.removeItem('kanbanD.ich'));
    await commitsOeffnen(page, 1, 2);
    const vorher = zahl();
    const gesendet = []; page.on('request', r => { if (r.method() !== 'GET') gesendet.push(r.url()); });
    await suchKnopf(page, rep.k).click();
    await ersetzenKnopf(page).click();
    await expect(page.locator('#pop .warnh')).toHaveText('Für diese Aktion zuerst wählen, wer du bist.');
    expect(gesendet).toEqual([]);
    expect(zahl()).toBe(vorher);
  });

  test('AK 10: hat eine zweite Sitzung K′ inzwischen hinterlegt, ergibt „Ersetzen“ 409 — Satz ohne Servertext, Wechsel nach „an der Aufgabe“, Fokus auf „Verwaisten Verweis entfernen“, kein DELETE, Datei byte-gleich; erst der Klick entfernt', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    await suchKnopf(page, rep.k).click();
    await expect(ersetzenKnopf(page)).toBeVisible();
    const r = await page.request.post(`${k.adresse}api/aufgaben/1/commits`, { headers: { 'X-KanbanD-Wer': 'entw1' }, data: { commits: [`kd:${rep.k2}`] } });
    expect(r.status()).toBe(200);
    const vorher = datei(1), anzahl = zahl();
    const ansagen = await ansagenBeobachten(page);
    const loeschen = []; page.on('request', q => { if (q.method() === 'DELETE') loeschen.push(q.url()); });
    await ersetzenKnopf(page).click();
    const kand = page.locator(`${GRUPPE} .nf-k`).first();
    const satz = `Der Verweis ließ sich nicht ersetzen: ${kurz(rep.k2)} steht inzwischen schon an der Aufgabe (409).`;
    await expect(kand.getByText(satz, { exact: true })).toBeVisible();
    await expect(kand.locator('.nf-marke')).toHaveText('schon an der Aufgabe');
    const entf = entfernenKnopf(page);
    await expect(entf).toBeFocused();
    const beschreibung = await entf.getAttribute('aria-describedby');
    await expect(page.locator(`#${beschreibung}`)).toHaveText(satz);
    expect(await kand.evaluate(e => e.querySelectorAll('[role=status],[role=alert],[aria-live]').length)).toBe(0);
    await expect(page.locator(`${GRUPPE} .nf-kopf span`)).toHaveText(`neuester zuerst · „Verwaisten Verweis entfernen“ nimmt ${kurz(rep.k)} von der Aufgabe`);
    expect(loeschen).toEqual([]);
    expect(datei(1)).toBe(vorher);
    expect(zahl()).toBe(anzahl);
    expect(await ansagen(), 'beim 409 mit Wechsel keine Ansage').toEqual([]);
    await entf.click();
    await expect(page.locator('#commits-status')).toHaveText(`Verwaisten Verweis ${kurz(rep.k)} entfernt.`);
    expect(loeschen.length).toBe(1);
    expect(zahl()).toBe(anzahl + 1);
  });

  test('US-8: zweimal schnell „Ersetzen“ nach einer zweiten Sitzung — genau ein Aufruf, sichtbar gesperrt, dann der 409-Satz, Datei byte-gleich, Fokus auf „Verwaisten Verweis entfernen“', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    await suchKnopf(page, rep.k).click();
    await expect(ersetzenKnopf(page)).toBeVisible();
    expect((await page.request.post(`${k.adresse}api/aufgaben/1/commits`, { headers: { 'X-KanbanD-Wer': 'entw1' }, data: { commits: [`kd:${rep.k2}`] } })).status()).toBe(200);
    const vorher = datei(1);
    const h = await schreibenHalten(page, 'POST', '**/api/aufgaben/1/commits/ersetzen');
    await ersetzenKnopf(page).dblclick();
    await expect(ersetzenKnopf(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(ersetzenKnopf(page)).toHaveAttribute('data-sperrform', '');
    expect(h.aufrufe.length).toBe(1);
    h.frei();
    await expect(page.locator(GRUPPE).getByText(`Der Verweis ließ sich nicht ersetzen: ${kurz(rep.k2)} steht inzwischen schon an der Aufgabe (409).`, { exact: true })).toBeVisible();
    await expect(entfernenKnopf(page)).toBeFocused();
    expect(datei(1)).toBe(vorher);
    expect(h.aufrufe.length).toBe(1);
  });

  test('AK 10: jeder andere 409 (per page.route) zeigt die allgemeine Form in einer schon stehenden Live-Region, „Ersetzen“ bleibt, Fokus bleibt; 423 ebenso, die Datei bleibt byte-gleich', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    await suchKnopf(page, rep.k).click();
    await expect(ersetzenKnopf(page)).toBeVisible();
    const ansagen = await ansagenBeobachten(page);
    let antwort = { status: 409, body: JSON.stringify({ fehler: 'etwas anderes', verweis: 'kd:anderer' }) };
    let frei; const tor = () => new Promise(r => { frei = r; });
    let warten = tor();
    await page.route('**/api/aufgaben/1/commits/ersetzen', async route => { await warten; route.fulfill({ status: antwort.status, contentType: 'application/json', body: antwort.body }); });
    await ersetzenKnopf(page).click();
    const region = page.locator(`${GRUPPE} #nf-meld`);
    await expect(region).toHaveAttribute('role', 'status');
    await expect(region).toHaveText('');
    frei();
    await expect(region).toHaveText('Der Verweis ließ sich nicht ersetzen: etwas anderes (409).');
    await expect(ersetzenKnopf(page)).toBeFocused();
    expect(await ansagen()).toEqual(['Der Verweis ließ sich nicht ersetzen: etwas anderes (409).']);
    antwort = { status: 409, body: JSON.stringify({ fehler: 'ohne verweis' }) };
    warten = Promise.resolve();
    await ersetzenKnopf(page).click();
    await expect(region).toHaveText('Der Verweis ließ sich nicht ersetzen: ohne verweis (409).');
    // 423: eine defekte Datei schaltete das Fenster über das Live-Ereignis in die Ansicht der defekten Datei; die Antwort kommt per page.route
    // (wie R00205 AK 7), dass der Server dabei nichts schreibt, prüft R00203 an der API
    const vorher = datei(1);
    antwort = { status: 423, body: JSON.stringify({ fehler: 'Die Aufgabendatei ist defekt' }) };
    await ersetzenKnopf(page).click();
    await expect(region).toHaveText('Der Verweis ließ sich nicht ersetzen: Die Aufgabendatei ist defekt (423).');
    await expect(ersetzenKnopf(page)).toBeFocused();
    expect(datei(1)).toBe(vorher);
  });

  test('AK 10: 423 beim Entfernen nennt „ließ sich nicht entfernen“ (#3)', async ({ page }) => {
    await commitsOeffnen(page, 3, 2);
    await suchKnopf(page, rep.k).click();
    await expect(entfernenKnopf(page)).toBeVisible();
    await page.route(/\/api\/aufgaben\/3\/commits\/[^/]+$/, route => route.request().method() === 'DELETE' ? route.fulfill({ status: 423, contentType: 'application/json', body: JSON.stringify({ fehler: 'Die Aufgabendatei ist defekt' }) }) : route.continue());
    await entfernenKnopf(page).click();
    await expect(page.locator(`${GRUPPE} #nf-meld`)).toHaveText('Der Verweis ließ sich nicht entfernen: Die Aufgabendatei ist defekt (423).');
    await expect(entfernenKnopf(page)).toBeFocused();
  });

  test('AK 10: solange „Ersetzen“ wartet, sind alle Knöpfe der Suche und jedes „Nachfolger suchen“ gesperrt; ein zweiter Klick ergibt keinen zweiten Aufruf und keinen zweiten Commit', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    const echt = await (await page.request.get(`${k.adresse}api/aufgaben/1/commits/kd:${rep.k}/nachfolger`)).json();
    const zweiter = { ...echt.kandidaten[0], verweis: `kd:${rep.k2}`, an_der_karte: true };
    await page.route(/\/nachfolger$/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...echt, kandidaten: [echt.kandidaten[0], zweiter] }) }));
    await suchKnopf(page, rep.k).click();
    const vorher = zahl();
    const h = await schreibenHalten(page, 'POST', '**/api/aufgaben/1/commits/ersetzen');
    await ersetzenKnopf(page).click();
    for (const knopf of [ersetzenKnopf(page), entfernenKnopf(page), suchKnopf(page, rep.k)]) {
      await expect(knopf).toHaveAttribute('aria-disabled', 'true');
      await expect(knopf).toHaveAttribute('data-sperrform', '');
    }
    await expect(ersetzenKnopf(page)).toHaveAttribute('aria-busy', 'true');
    await ersetzenKnopf(page).click({ force: true });
    await entfernenKnopf(page).click({ force: true });
    expect(h.aufrufe.length).toBe(1);
    h.frei();
    await expect(page.locator('#commits-status')).toHaveText(`Ersetzt durch ${kurz(rep.k2)}.`);
    expect(zahl()).toBe(vorher + 1);
    expect(h.aufrufe.length).toBe(1);
  });

  test('AK 10: Ansichtswechsel während „Ersetzen“ — genau ein Commit, zurück in „Commits“ steht K′ an Platz 1', async ({ page }) => {
    await commitsOeffnen(page, 1, 2);
    await suchKnopf(page, rep.k).click();
    const vorher = zahl();
    const h = await schreibenHalten(page, 'POST', '**/api/aufgaben/1/commits/ersetzen');
    await ersetzenKnopf(page).click();
    await reiter(page, 'Inhalt');
    h.frei();
    await expect.poll(zahl).toBe(vorher + 1);
    await reiter(page, 'Commits');
    await expect(page.locator(ZEILEN)).toHaveCount(2);
    await expect(zeileMit(page, kurz(rep.k2))).toHaveCount(1);
    expect(verweiseDerDatei(1)[0]).toBe(`kd:${rep.k2}`);
    expect(zahl()).toBe(vorher + 1);
  });
});


/* ── AK 11: Breite, Themen, Kontrast und Tastatur — 10 Kandidaten per page.route (Titel 500 Zeichen mit einem Wort aus 120, je 10 Zweige zu 60,
   Kandidat 4 an der Karte) ── */
test.describe('R00218 AK 11 — Breite, Ziele, Themen, Kontrast, Tastatur', () => {
  let k, rep;
  const WORT = 'W'.repeat(120);
  const titel = i => (`Titel ${i} ` + WORT + ' ').padEnd(500, 'x y ');
  const zweige = i => Array.from({ length: 10 }, (_, z) => `zweig-${i}-${z}-`.padEnd(60, 'q'));
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = geteiltesNachfolgerRepository().rep;
    k = await kanbanStarten(nachfolgerVorbereiten(rep));
    await alsPerson(page, 'sh');
    await zehnKandidaten(page);
  });
  const zehnKandidaten = seite => seite.route(/\/api\/aufgaben\/1\/commits\/[^/]+\/nachfolger$/, async route => {
    const echt = await (await route.fetch()).json();
    const kandidaten = Array.from({ length: 10 }, (_, i) => ({ ...echt.kandidaten[0], verweis: `kd:${String(i).repeat(40)}`, hash: String(i).repeat(40), titel: titel(i), zweige: zweige(i), entfernte_zweige: [], an_der_karte: i === 3 }));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...echt, kandidaten }) });
  });
  test.afterEach(() => k.stoppen());

  async function gesucht(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator(ZEILEN)).toHaveCount(2);
    await zeileMit(page, kurz(rep.k)).getByRole('button', { name: 'Nachfolger suchen' }).click();
    await expect(page.locator('#nf-gruppe .nf-k')).toHaveCount(10);
  }
  /** Läuft im Browser: je Kandidat die Rechtecke von Block, Hash, Titel, Autor, Knopf. */
  const kandidatenMessen = () => [...document.querySelectorAll('#nf-gruppe .nf-k')].map(k => {
    const r = sel => { const b = (sel ? k.querySelector(sel) : k).getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom, width: b.width }; };
    return { block: r(null), hash: r('.nf-h'), titel: r('.nf-t'), autor: r('.nf-a'), datum: r('.nf-d'), zweige: r('.nf-z'), knopf: r('.nf-akt button') };
  });

  for (const farbe of ['hell', 'dunkel']) {
    for (const breite of [320, 414, 641, 768, 980, 1100, 1280]) {
      test(`AK 11: ${breite} px ${farbe} — nichts scrollt quer, Titel ${breite >= 641 ? '≥ 200 px' : 'über die ganze Breite'}, Knopf im Block`, async ({ page }) => {
        await gesucht(page);
        await thema(page, farbe === 'hell' ? 'light' : 'dark');
        await breiteSetzen(page, breite);
        expect(await page.evaluate(ueberlaufMessen)).toEqual({ seite: 'ok', fenster: 'ok', rahmen: 'ok', rechts: [] });
        for (const [i, m] of (await page.evaluate(kandidatenMessen)).entries()) {
          if (breite >= 641) expect(m.titel.width, `${breite} Kandidat ${i}: Titel`).toBeGreaterThanOrEqual(200);
          else expect(m.titel.width, `${breite} Kandidat ${i}: Titel über den Block`).toBeGreaterThanOrEqual(m.block.width - 2 * 12 - 2);
          expect(m.knopf.left, `${breite} Kandidat ${i}: Knopf links im Block`).toBeGreaterThanOrEqual(m.block.left - 0.5);
          expect(m.knopf.right, `${breite} Kandidat ${i}: Knopf rechts im Block`).toBeLessThanOrEqual(m.block.right + 0.5);
          if (breite >= 641 && breite <= 980) {
            expect(m.titel.left, 'mittel: Titel rechts vom Hash').toBeGreaterThanOrEqual(m.hash.right - 0.5);
            expect(Math.abs(m.titel.top - m.hash.top), 'mittel: Titel neben dem Hash').toBeLessThanOrEqual(3);
            expect(m.autor.top, 'mittel: Autor · Datum unter dem Titel').toBeGreaterThanOrEqual(m.titel.bottom - 1);
            expect(m.zweige.top, 'mittel: Zweige darunter').toBeGreaterThanOrEqual(m.autor.bottom - 1);
            expect(m.knopf.top, 'mittel: Knopf darunter').toBeGreaterThanOrEqual(m.zweige.bottom - 1);
          }
          if (breite >= 1100) {
            expect(Math.abs(m.autor.top - m.titel.top), 'breit: Autor in der Reihe des Titels').toBeLessThanOrEqual(3);
            expect(m.autor.left, 'breit: Autor in seiner Spalte rechts vom Titel').toBeGreaterThanOrEqual(m.titel.right - 0.5);
          }
        }
      });
    }
  }

  test('AK 11: die mittlere Form hängt nur an der Breite — bei 768 px fein und grob dieselbe Reihenfolge und dieselben linken Kanten von Hash, Titel und Knopf', async ({ browser }) => {
    const lage = async optionen => {
      const kontext = await browser.newContext({ viewport: { width: 768, height: 900 }, locale: 'de-DE', timezoneId: 'Europe/Berlin', ...optionen });
      try {
        const seite = await kontext.newPage();
        await alsPerson(seite, 'sh');
        await zehnKandidaten(seite);
        await gesucht(seite);
        const m = (await seite.evaluate(kandidatenMessen))[0];
        return { grob: await seite.evaluate(() => matchMedia('(pointer: coarse)').matches), reihe: m.titel.top < m.autor.top && m.autor.top < m.knopf.top, links: [m.hash.left, m.titel.left, m.knopf.left].map(Math.round) };
      } finally { await kontext.close(); }
    };
    const fein = await lage({}), grob = await lage({ isMobile: true, hasTouch: true });
    expect([fein.grob, grob.grob]).toEqual([false, true]);
    expect(fein.reihe && grob.reihe).toBe(true);
    expect(grob.links).toEqual(fein.links);
  });

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 768, height: 900 }, isMobile: true, hasTouch: true });
    test('AK 11: bei grobem Zeiger ist jedes Bedienziel ≥ 48 × 48 px bei 768, 414 und 320 px — „Nachfolger suchen“, „Ersetzen“, „Verwaisten Verweis entfernen“, „+n weitere“, „Erneut versuchen“', async ({ page }) => {
      await gesucht(page);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      for (const breite of [768, 414, 320]) {
        await breiteSetzen(page, breite);
        const ziele = await page.evaluate(() => [...document.querySelectorAll('#fenster .nf-such, #nf-gruppe .nf-knopf, #nf-gruppe .cl-mehr')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 30), r.width, r.height]; }));
        expect(ziele.length).toBeGreaterThanOrEqual(21);
        for (const [name, b, h] of ziele) {
          expect(b, `${breite}: ${name}`).toBeGreaterThanOrEqual(47.5);
          expect(h, `${breite}: ${name}`).toBeGreaterThanOrEqual(47.5);
        }
      }
      await page.unroute(/nachfolger$/);
      await page.route(/nachfolger$/, route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"fehler":"x"}' }));
      await zeileMit(page, kurz(rep.k)).getByRole('button', { name: 'Nachfolger suchen' }).click();
      const erneut = page.locator('#nf-gruppe').getByRole('button', { name: 'Erneut versuchen' });
      const [b, h] = await erneut.evaluate(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
      expect(b).toBeGreaterThanOrEqual(47.5);
      expect(h).toBeGreaterThanOrEqual(47.5);
    });
  });

  for (const farbe of ['hell', 'dunkel']) {
    test(`AK 11: ${farbe} — Text ≥ 4,5:1 in Ruhe, beim Zeigen und mit Fokus; Fokusring ≥ 3:1; Knopfrand ist --kd-line-strong`, async ({ page }) => {
      await gesucht(page);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      const zuWenig = m => m.filter(x => x.wert < 4.5).map(x => `${x.element} „${String(x.text).slice(0, 30)}“ ${x.wert.toFixed(2)}`);
      const messungen = await kontrastMessen(page, ['#fenster .cl-panel']);
      expect(messungen.length).toBeGreaterThanOrEqual(30);
      expect(zuWenig(messungen), 'Ruhe').toEqual([]);
      const knopf = page.locator('#nf-gruppe .nf-knopf').first();
      await knopf.hover();
      expect(await kontrastAm(knopf), 'Zeigen').toBeGreaterThanOrEqual(4.5);
      await knopf.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      expect(await kontrastAm(knopf), 'Fokus').toBeGreaterThanOrEqual(4.5);
      const ring = await knopf.evaluate(e => { const st = getComputedStyle(e); let g = e.parentElement; while (g && getComputedStyle(g).backgroundColor === 'rgba(0, 0, 0, 0)') g = g.parentElement; return { ring: st.outlineColor, breite: st.outlineWidth, stil: st.outlineStyle, grund: getComputedStyle(g).backgroundColor, rand: st.borderTopColor, linie: getComputedStyle(document.documentElement).getPropertyValue('--kd-line-strong').trim() }; });
      expect(ring.stil).not.toBe('none');
      expect(await kontrastFarben(page, ring.ring, ring.grund), 'Fokusring').toBeGreaterThanOrEqual(3);
      expect(await kontrastFarben(page, ring.rand, ring.linie), 'Knopfrand = --kd-line-strong').toBeLessThan(1.01);
    });

    test(`AK 11: ${farbe} — gesperrte Auslöser in der Form nach Z. 216 (Schrift --kd-faint, Kontur --kd-line, Fläche bleibt) mit ungedämpftem Fokusring ≥ 3:1`, async ({ page }) => {
      await gesucht(page);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      let frei; const tor = new Promise(r => { frei = r; });
      await page.route('**/api/aufgaben/1/commits/ersetzen', async route => { await tor; await route.fulfill({ status: 409, contentType: 'application/json', body: '{"fehler":"x"}' }); });
      const ruhe = await page.locator('#nf-gruppe .nf-knopf').nth(1).evaluate(e => getComputedStyle(e).backgroundColor);
      await page.locator('#nf-gruppe .nf-knopf').first().click();
      const gesperrt = page.locator('#nf-gruppe .nf-knopf').nth(1);
      await expect(gesperrt).toHaveAttribute('aria-disabled', 'true');
      const werte = await gesperrt.evaluate(e => { const st = getComputedStyle(e), wurzel = getComputedStyle(document.documentElement); const farbe = n => { const p = document.createElement('i'); p.style.color = `var(${n})`; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }; return { schrift: st.color, rand: st.borderTopColor, flaeche: st.backgroundColor, faint: farbe('--kd-faint'), line: farbe('--kd-line') }; });
      expect(werte.schrift).toBe(werte.faint);
      expect(werte.rand).toBe(werte.line);
      expect(werte.flaeche).toBe(ruhe);
      await page.locator('#nf-gruppe .nf-knopf').first().focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const fokus = await page.evaluate(() => { const e = document.activeElement, st = getComputedStyle(e); let g = e.parentElement; while (g && getComputedStyle(g).backgroundColor === 'rgba(0, 0, 0, 0)') g = g.parentElement; return { ring: st.outlineColor, stil: st.outlineStyle, grund: getComputedStyle(g).backgroundColor, gesperrt: e.getAttribute('aria-disabled'), opacity: st.opacity }; });
      expect(fokus.gesperrt).toBe('true');
      expect(fokus.stil).not.toBe('none');
      expect(fokus.opacity).toBe('1');
      expect(await kontrastFarben(page, fokus.ring, fokus.grund)).toBeGreaterThanOrEqual(3);
      frei();
    });
  }

  test('AK 11: Tab erreicht „Nachfolger suchen“, danach je Kandidat „+n weitere“ und seinen Knopf; Enter und Leertaste lösen aus; nach der Suche Fokus auf der Gruppe', async ({ page }) => {
    await page.unroute(/nachfolger$/);
    await page.route(/nachfolger$/, async route => {
      const echt = await (await route.fetch()).json();
      const kandidaten = [0, 1].map(i => ({ ...echt.kandidaten[0], verweis: `kd:${String(i).repeat(40)}`, hash: String(i).repeat(40), zweige: zweige(i).slice(0, i ? 3 : 5) }));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...echt, kandidaten }) });
    });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await liveBereit(page);
    await reiter(page, 'Commits');
    const such = zeileMit(page, kurz(rep.k)).getByRole('button', { name: 'Nachfolger suchen' });
    await such.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#nf-gruppe')).toBeFocused();
    await expect(page.locator('#nf-gruppe')).toHaveAttribute('role', 'group');
    const reihe = [];
    await such.focus();
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('Tab');
      reihe.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()));
    }
    expect(reihe).toEqual(['2 weitere Zweige zeigen', 'Ersetzen durch kd:0000000', 'Ersetzen durch kd:1111111', reihe[3]]);
    await such.focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#nf-gruppe')).toBeFocused();
    await page.locator('#nf-gruppe').getByRole('button', { name: '2 weitere Zweige zeigen' }).focus();
    await page.keyboard.press(' ');
    await expect(page.locator('#nf-gruppe').getByRole('button', { name: '2 weitere Zweige verbergen' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#nf-gruppe').getByRole('button', { name: '2 weitere Zweige zeigen' })).toBeFocused();
  });
});
