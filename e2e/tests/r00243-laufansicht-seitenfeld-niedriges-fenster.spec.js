// R00243 Laufansicht — Seitenfeld mit den Filtern bei niedrigem Fenster erreichbar (Karte #266, I0233) — AK 1–6 im echten Programm.
// Ausgangslage: Board `fabrik` aus laufansicht-hilfen.js, an #1 liegt T15 (laufansicht-t15.js). Je Fenster ein eigener Kontext
// (Größe, Touch). Testfälle in Fachwörtern, darunter die Testsprache mit den einzigen Selektoren.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T15, T15_KENNUNG, PFAD_A } = require('./laufansicht-t15');

/* ── Sprache ── */

const GL = '#lauf .lv-gl';
const ZEIGEN = `${GL} fieldset.lv-filt`;
const STATUS = '#lv-status';
const ART = { Nachrichten: 'n', Werkzeuge: 'w', Systemhinweise: 'h', 'nur Fehler': 'f' };
/** Die fünf Fenster von AK 1/3 (Breite, Höhe, Touch) und die zwei Gegenproben unter 641 px von AK 2. */
const HOCH = [[1920, 950, false], [1366, 640, false], [1280, 500, false], [844, 390, true], [641, 700, false]];
const SCHMAL = [[375, 667, true], [320, 568, true]];
const name = ([b, h, t]) => `${b} × ${h}${t ? ' Touch' : ''}`;

const zeile = lv.zeile;
const t15Text = () => T15.map(zeile).join('');

async function ablegen(k) {
  await lv.hochladen(k.adresse, 1, T15_KENNUNG, 'Entwicklung', lv.gz(t15Text()));
}

test.describe('R00243 Laufansicht: Seitenfeld bei niedrigem Fenster', () => {
  let k;
  const kontexte = [];
  test.beforeEach(async () => {
    k = await kanbanStarten(lv.ausgangslage());
    await ablegen(k);
  });
  test.afterEach(async () => {
    for (const ctx of kontexte.splice(0)) await ctx.close();
    await k.stoppen();
  });

  /** Öffnet T15 in einem eigenen Fenster der Größe `fenster`; liefert die Seite, wenn das Transkript gelesen ist. */
  async function oeffnen(browser, [breite, hoehe, touch], kennung = T15_KENNUNG) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, hasTouch: touch, isMobile: touch, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    kontexte.push(ctx);
    const page = await ctx.newPage();
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(kennung)}`);
    await expect(page.locator('#lv-h1')).toBeVisible();
    await expect(page.locator(STATUS)).toHaveText(/^(Ende des Transkripts|Grenze erreicht.*)$/);
    await expect(page.locator(ZEIGEN)).toBeVisible();
    return page;
  }
  const kaestchen = (page, wort) => page.locator(`${ZEIGEN} input[data-filter="${ART[wort]}"]`);
  const stand = page => page.locator(`${ZEIGEN} label`).evaluateAll(ls => Object.fromEntries(ls.map(l => [l.textContent.trim(), l.querySelector('input').checked])));
  /** Ein echter Mausklick auf die Mitte, ohne Prüfung der Bedienbarkeit — für ein gesperrtes Kästchen. */
  async function klickMitte(page, ort) {
    const r = await ort.boundingBox();
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  }
  /** Läuft im Browser: der Fokus — liegt er im Seitenfeld, ganz im Rollbereich `.lv` und im Seitenfeld, über der Fußzeile, und trifft ein Klick ihn? */
  function fokusStand() {
    const el = document.activeElement, gl = document.querySelector('.lv-gl');
    if (!gl.contains(el)) return { drin: false, id: el.id, ganz: false, getroffen: false };
    const lvr = document.querySelector('.lv').getBoundingClientRect(), glr = gl.getBoundingClientRect(), stat = document.getElementById('stat').getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const treffer = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    const ganz = r.top >= lvr.top - 0.5 && r.bottom <= Math.min(lvr.bottom, stat.top) + 0.5 && r.top >= glr.top - 0.5 && r.bottom <= glr.bottom + 0.5;
    const getroffen = Boolean(treffer) && (treffer === el || el.contains(treffer) || (Boolean(treffer.closest('label')) && treffer.closest('label') === el.closest('label')));
    return { drin: true, id: el.id, ganz, getroffen };
  }
  const reihenfolge = page => page.evaluate(() => {
    const gl = document.querySelector('.lv-gl');
    const marke = e => (e.matches('fieldset') ? 'Zeigen' : e.id === 'lv-top-t' ? 'Längste' : e.id === 'lv-teu-t' ? 'Teuerste' : null);
    const dom = [...gl.children].map(marke).filter(Boolean);
    const sicht = [...gl.children].filter(marke).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top).map(marke);
    return { dom, sicht };
  });
  /** Tab vom Seitenkopf bis zum Verlassen des Seitenfelds: Folge der Kennungen im Seitenfeld, je mit `imBlick`. */
  async function tabDurchSeitenfeld(page) {
    await page.locator('#lv-h1').focus();
    const folge = [];
    let drin = false;
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const hier = await page.evaluate(fokusStand);
      if (hier.drin) { drin = true; folge.push(hier); } else if (drin) break;
    }
    return folge;
  }

  /* ── AK 1 ── */

  for (const fenster of HOCH) {
    test(`AK 1 · US-1: ${name(fenster)} — „Systemhinweise“, „Werkzeuge“, „nur Fehler“ ohne force anklicken; „Zeigen“ bleibt im Fenster`, async ({ browser }) => {
      const page = await oeffnen(browser, fenster);
      const zeigenImFenster = () => page.evaluate(() => { const r = document.querySelector('.lv-gl fieldset.lv-filt').getBoundingClientRect(), s = document.getElementById('stat').getBoundingClientRect(); return r.top >= 0 && r.bottom <= s.top + 0.5; });
      await kaestchen(page, 'Systemhinweise').click();
      await expect(kaestchen(page, 'Systemhinweise')).toBeChecked();
      await expect(page.locator(STATUS)).toHaveText(/eingebettete Systemhinweise sichtbar\.$/);
      expect(await zeigenImFenster()).toBe(true);
      await kaestchen(page, 'Werkzeuge').click();
      await expect(kaestchen(page, 'Werkzeuge')).not.toBeChecked();
      await expect(page.locator(STATUS)).toHaveText(/^\d+ von \d+ Einträgen sichtbar\.$/);
      expect(await zeigenImFenster()).toBe(true);
      await kaestchen(page, 'nur Fehler').click();
      await expect(kaestchen(page, 'nur Fehler')).toBeChecked();
      await expect(page.locator(STATUS)).toHaveText(/^\d+ von \d+ Einträgen sichtbar\.$/);
      expect(await zeigenImFenster()).toBe(true);
      // Sperrform: die drei anderen sind gesperrt, ihr Klick bleibt ohne Wirkung
      for (const wort of ['Nachrichten', 'Werkzeuge', 'Systemhinweise']) await expect(kaestchen(page, wort)).toHaveAttribute('aria-disabled', 'true');
      const vorher = await stand(page);
      await klickMitte(page, kaestchen(page, 'Nachrichten'));
      expect(await stand(page)).toEqual(vorher);
    });
  }

  /* ── AK 2 ── */

  for (const fenster of SCHMAL) {
    test(`AK 2 · US-1: ${name(fenster)} — Klick ohne force, keine Höhengrenze, „Zeigen“ nach „Teuerste Schritte“, die Seite rollt selbst`, async ({ browser }) => {
      const page = await oeffnen(browser, fenster);
      const gl = await page.locator(GL).evaluate(e => ({ oy: getComputedStyle(e).overflowY, zu: e.scrollHeight - e.clientHeight }));
      expect(gl).toEqual({ oy: 'visible', zu: 0 });
      expect(await page.locator('#lauf').evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
      expect((await reihenfolge(page)).dom).toEqual(['Längste', 'Teuerste', 'Zeigen']);
      for (const wort of ['Systemhinweise', 'Werkzeuge', 'nur Fehler']) {
        const vorher = (await stand(page))[wort];
        await kaestchen(page, wort).click();
        await expect.poll(async () => (await stand(page))[wort]).toBe(!vorher);
      }
      await expect(page.locator(STATUS)).toHaveText(/^\d+ von \d+ Einträgen sichtbar\.$/);
    });
  }

  /* ── AK 3 ── */

  for (const fenster of HOCH) {
    test(`AK 3 · US-2: ${name(fenster)} — Tab durch alle zehn Elemente des Seitenfelds, jedes im Blick und treffbar`, async ({ browser }) => {
      const page = await oeffnen(browser, fenster);
      const folge = await tabDurchSeitenfeld(page);
      // die Reihenfolge prüft AK 4; hier zählt, dass alle zehn erreicht werden und im Blick liegen
      expect(folge.map(f => f.id).sort()).toEqual(['lv-f-f', 'lv-f-h', 'lv-f-n', 'lv-f-w', 'lv-teu-1', 'lv-teu-2', 'lv-teu-3', 'lv-top-1', 'lv-top-2', 'lv-top-3']);
      expect(folge.filter(f => !f.ganz || !f.getroffen).map(f => f.id)).toEqual([]);
    });
  }

  /* ── AK 4 ── */

  test('AK 4 · US-3: ab 641 px „Zeigen“, „Längste“, „Teuerste“ in Lese-, Tab- und sichtbarer Reihenfolge; bis 640 px „Längste“, „Teuerste“, „Zeigen“; Wechsel ohne Neuladen', async ({ browser }) => {
    const page = await oeffnen(browser, [700, 700, false]);
    expect(await reihenfolge(page)).toEqual({ dom: ['Zeigen', 'Längste', 'Teuerste'], sicht: ['Zeigen', 'Längste', 'Teuerste'] });
    expect((await tabDurchSeitenfeld(page))[0].id).toBe('lv-f-n');
    await breiteSetzen(page, 600, 700);
    await expect.poll(() => reihenfolge(page)).toEqual({ dom: ['Längste', 'Teuerste', 'Zeigen'], sicht: ['Längste', 'Teuerste', 'Zeigen'] });
    expect((await tabDurchSeitenfeld(page)).map(f => f.id)).toEqual(['lv-top-1', 'lv-top-2', 'lv-top-3', 'lv-teu-1', 'lv-teu-2', 'lv-teu-3', 'lv-f-n', 'lv-f-w', 'lv-f-h', 'lv-f-f']);
    await breiteSetzen(page, 700, 700);
    await expect.poll(() => reihenfolge(page)).toEqual({ dom: ['Zeigen', 'Längste', 'Teuerste'], sicht: ['Zeigen', 'Längste', 'Teuerste'] });
    expect((await tabDurchSeitenfeld(page))[0].id).toBe('lv-f-n');
    await page.close();
  });

  test('AK 4 · US-3: genau 641 px „Zeigen“ zuerst, genau 640 px zuletzt', async ({ browser }) => {
    const p641 = await oeffnen(browser, [641, 700, false]);
    expect((await reihenfolge(p641)).dom[0]).toBe('Zeigen');
    const p640 = await oeffnen(browser, [640, 700, false]);
    expect((await reihenfolge(p640)).dom[2]).toBe('Zeigen');
  });

  /* ── AK 5 ── */

  test('AK 5 · US-4: `overflowY` ab 641 px `auto`, bei 640 px `visible`; das Feld ist nie höher als `.lv`, rollt innen', async ({ browser }) => {
    for (const fenster of [[641, 700, false], [844, 390, true], [1280, 500, false], [1920, 950, false]]) {
      const page = await oeffnen(browser, fenster);
      expect(await page.locator(GL).evaluate(e => getComputedStyle(e).overflowY), name(fenster)).toBe('auto');
    }
    const schmal = await oeffnen(browser, [640, 700, false]);
    expect(await schmal.locator(GL).evaluate(e => getComputedStyle(e).overflowY)).toBe('visible');
    const page = await oeffnen(browser, [1366, 640, false]);
    const m = await page.evaluate(() => { const lv = document.querySelector('.lv'), gl = document.querySelector('.lv-gl'); return { lv: lv.getBoundingClientRect().height, gl: gl.getBoundingClientRect().height, innen: gl.scrollHeight > gl.clientHeight }; });
    expect(m.gl).toBeLessThanOrEqual(m.lv + 0.5);
    expect(m.innen).toBe(true);
  });

  test('AK 5 · US-4: der Rollstand des Seitenfelds ist nach Tastenwechsel, Klick und Live-Ereignis 0, „Zeigen“ ist sichtbar', async ({ browser }) => {
    const page = await oeffnen(browser, [1366, 640, false]);
    const unten = () => page.locator(GL).evaluate(e => { e.scrollTop = e.scrollHeight; return e.scrollTop; });
    const oben = () => page.locator(GL).evaluate(e => e.scrollTop);
    const zeigenSichtbar = () => page.locator(ZEIGEN).evaluate(e => { const r = e.getBoundingClientRect(), g = document.querySelector('.lv-gl').getBoundingClientRect(); return r.top >= g.top - 0.5 && r.bottom <= g.bottom + 0.5; });
    // Tab-Weg: Fokus ohne Rollen, Leertaste
    expect(await unten()).toBeGreaterThan(0);
    await page.locator('#lv-f-n').evaluate(e => e.focus({ preventScroll: true }));
    await page.keyboard.press('Space');
    await expect(kaestchen(page, 'Nachrichten')).not.toBeChecked();
    await expect.poll(oben).toBe(0);
    expect(await zeigenSichtbar()).toBe(true);
    // Klick-Weg: Klick im DOM, ohne dass der Browser das Kästchen in Sicht rollt
    expect(await unten()).toBeGreaterThan(0);
    await page.locator('#lv-f-n').evaluate(e => e.click());
    await expect(kaestchen(page, 'Nachrichten')).toBeChecked();
    await expect.poll(oben).toBe(0);
    expect(await zeigenSichtbar()).toBe(true);
    // Live: ein Kosteneintrag zeichnet die Laufansicht neu
    expect(await unten()).toBeGreaterThan(0);
    const renders = await page.evaluate(() => window.kdTest.renders());
    await lv.buchen(k.adresse, 1, 'pruefer@2026-11-21T12:30+01:00', 'Reviews', 0.20);
    await expect.poll(() => page.evaluate(() => window.kdTest.renders()), 'das Live-Ereignis ist gezeichnet').toBeGreaterThan(renders);
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    await expect.poll(oben).toBe(0);
  });

  test('AK 5 · US-4: der Anlass in „Teuerste Schritte“ ist höchstens zwei Zeilen hoch, gekürzt, ohne vollen Pfad; der volle Pfad steht im Schritt', async ({ browser }) => {
    const page = await oeffnen(browser, [1280, 720, false]);
    const nach = await page.locator('#lauf .lv-teu .nach').evaluateAll(es => es.map(e => ({ zeilen: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)), gekuerzt: e.scrollHeight > e.clientHeight + 1 })));
    expect(nach.length).toBeGreaterThan(0);
    for (const n of nach) expect(n.zeilen).toBeLessThanOrEqual(2);
    expect(nach.some(n => n.gekuerzt)).toBe(true);
    expect(await page.locator('#lauf #lv-insel').evaluate((e, pfad) => e.textContent.includes(pfad), PFAD_A)).toBe(true);
    for (const breite of [320, 641, 980, 1280]) {
      await breiteSetzen(page, breite, 700);
      await expect.poll(() => page.evaluate(() => { const l = document.querySelector('.lv'), d = document.documentElement; return l.scrollWidth <= l.clientWidth && d.scrollWidth <= d.clientWidth; }), `kein Querscrollen bei ${breite}`).toBe(true);
    }
  });

  /* ── AK 6 ── */

  test('AK 6 · US-5: kein Nachfahre von `.lv` ist `position:fixed`, auch mit allen Schritten aufgeklappt und einem Tooltip', async ({ browser }) => {
    const page = await oeffnen(browser, [1280, 720, false]);
    await page.locator('#lv-insel details').evaluateAll(ds => ds.forEach(d => { d.open = true; }));
    await page.locator('#lv-top-1').hover();
    await page.locator('#lv-teu-1').focus();
    const fest = await page.evaluate(() => [...document.querySelectorAll('.lv *')].filter(e => getComputedStyle(e).position === 'fixed').map(e => e.className || e.tagName));
    expect(fest).toEqual([]);
    expect(await page.evaluate(() => [...document.querySelectorAll('.kd-tipp, .pop, .kmenue, .mod-bg, .al-bg')].filter(e => e.closest('.lv')).length)).toBe(0);
  });
});
