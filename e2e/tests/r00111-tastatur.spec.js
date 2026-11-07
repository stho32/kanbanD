// R00111 US-9, AK 11: Meldung und Feld über der Bildschirmtastatur (Karte #74, ADR-0016)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, mutanteEinsetzen } = require('./hilfen');

const HANDY = { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true };
const HANDY_QUER = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 } };

const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n\n## In Arbeit\n\n## Erledigt\n';
const AUSGANGSLAGE = { 'boards/entwicklung.md': BOARD, 'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\n---\n' };
const MELDUNG_X1 = '„X1“ ist keine Herkunft';
const MELDUNG_TITEL = 'Die Aufgabe braucht einen Titel';
/** Sichtbarer Bereich mit eingeblendeter Tastatur (AK 11) und, quer, der UX-Fall mit 200 px. */
const TASTATUR_HOCH = 500;
const TASTATUR_QUER = 200;
/** iOS scrollt den sichtbaren Bereich mit offener Tastatur (AK 11, ADR-0016 Regel 1). */
const GESCROLLT = 150;

let k;
test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/**
 * Bildet die Schnittstelle der Bildschirmtastatur nach, nicht die Tastatur (R00111 Test-Strategie): `visualViewport.height`,
 * `offsetTop` und `scale` lesen aus `window.__kdTastatur`, solange dort ein Wert steht, sonst den echten Wert. Das Layout bleibt
 * unverändert — ein kleinerer Viewport würde das feste Fenster mitrücken lassen und den Test ohne Fix grün machen.
 */
function tastaturNachbilden(page) {
  return page.addInitScript(() => {
    window.__kdTastatur = {};
    for (const name of ['height', 'offsetTop', 'scale']) {
      const echt = Object.getOwnPropertyDescriptor(VisualViewport.prototype, name);
      Object.defineProperty(VisualViewport.prototype, name, {
        configurable: true,
        get() { return name in window.__kdTastatur ? window.__kdTastatur[name] : echt.get.call(this); },
      });
    }
  });
}

/** Setzt den sichtbaren Bereich und löst das Ereignis aus, das der Browser dabei auslöst (`resize` bzw. `scroll`). */
function sichtbarerBereich(page, werte, ereignis) {
  return page.evaluate(([werte, ereignis]) => {
    Object.assign(window.__kdTastatur, werte);
    visualViewport.dispatchEvent(new Event(ereignis));
  }, [werte, ereignis]);
}

/** Rechteck eines Elements im Layout: oben und unten in px. */
function rechteck(locator) {
  return locator.evaluate(el => { const r = el.getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; });
}

/** Liegen Meldung und fokussiertes Feld ganz im sichtbaren Bereich? Liefert die Gründe, warum nicht — leer heißt ja. */
async function imSichtbarenBereich(page, meldung, feld) {
  const { oben, hoehe } = await page.evaluate(() => ({ oben: visualViewport.offsetTop, hoehe: visualViewport.height }));
  const m = await rechteck(meldung), f = await rechteck(feld);
  const grenze = oben + hoehe;
  return [
    ...(m.unten <= grenze + 0.5 ? [] : [`Meldung endet bei ${Math.round(m.unten)}, sichtbar bis ${grenze}`]),
    ...(f.unten <= grenze + 0.5 ? [] : [`Feld endet bei ${Math.round(f.unten)}, sichtbar bis ${grenze}`]),
    ...(f.oben >= oben - 0.5 ? [] : [`Feld beginnt bei ${Math.round(f.oben)}, sichtbar ab ${oben}`]),
  ];
}

async function starten(page) {
  k = await kanbanStarten(einrichten(AUSGANGSLAGE));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="1"]')).toHaveCount(1);
}

/** Aufgabenfenster #1, Tipp ins Feld „Neue Herkunft“, dann geht die Tastatur auf, dann „X1“ und Eingabetaste (US-9). */
async function herkunftMitTastatur(page, sichtbar) {
  await page.locator('.ka[data-id="1"] .t').tap();
  const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
  const feld = fenster.getByLabel('Neue Herkunft');
  await feld.tap();
  await expect(feld).toBeFocused();
  await sichtbarerBereich(page, { height: sichtbar, offsetTop: 0 }, 'resize');
  expect(await page.evaluate(() => visualViewport.height), 'Selbstprobe: die Nachbildung wirkt').toBe(sichtbar);
  await page.keyboard.type('X1');
  await page.keyboard.press('Enter');
  const meldung = fenster.locator('[role=alert]');
  await expect(meldung).toContainText(MELDUNG_X1);
  await expect(feld).toBeFocused();
  return { meldung, feld };
}

test.describe('Bildschirmtastatur, 414 px mit Touch', () => {
  test.use(HANDY);
  test.beforeEach(async ({ page }) => { await tastaturNachbilden(page); });

  test('AK 11 zu US-1, US-9: abgelehnte Herkunft — Meldung und Feld über der Tastatur, auch gescrollt; Kopf unverändert', async ({ page }) => {
    await starten(page);
    const kopf = await rechteck(page.locator('#kopf'));
    const { meldung, feld } = await herkunftMitTastatur(page, TASTATUR_HOCH);
    await expect.poll(() => imSichtbarenBereich(page, meldung, feld)).toEqual([]);

    await sichtbarerBereich(page, { offsetTop: GESCROLLT }, 'scroll');
    expect(await page.evaluate(() => visualViewport.offsetTop), 'Selbstprobe: gescrollt').toBe(GESCROLLT);
    await expect.poll(() => imSichtbarenBereich(page, meldung, feld)).toEqual([]);
    expect(await rechteck(page.locator('#kopf'))).toEqual(kopf);
  });

  test('AK 11 zu US-4: „Anlegen“ mit leerem Titel — Meldung und Titel über der Tastatur, auch gescrollt; Kopf unverändert', async ({ page }) => {
    await starten(page);
    const kopf = await rechteck(page.locator('#kopf'));
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).tap();
    const fenster = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    const titel = page.getByLabel('Titel der neuen Aufgabe');
    await expect(titel).toBeFocused();
    await sichtbarerBereich(page, { height: TASTATUR_HOCH, offsetTop: 0 }, 'resize');
    expect(await page.evaluate(() => visualViewport.height), 'Selbstprobe: die Nachbildung wirkt').toBe(TASTATUR_HOCH);
    await fenster.getByRole('button', { name: 'Anlegen', exact: true }).tap();
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toHaveText(MELDUNG_TITEL);
    await expect(titel).toBeFocused();
    await expect.poll(() => imSichtbarenBereich(page, meldung, titel)).toEqual([]);

    await sichtbarerBereich(page, { offsetTop: GESCROLLT }, 'scroll');
    await expect.poll(() => imSichtbarenBereich(page, meldung, titel)).toEqual([]);
    expect(await rechteck(page.locator('#kopf'))).toEqual(kopf);
  });

  test('Zoom mit zwei Fingern: bei scale ≠ 1 folgt das Fenster dem sichtbaren Bereich nicht (ADR-0016 Regel 2)', async ({ page }) => {
    await starten(page);
    await page.locator('.ka[data-id="1"] .t').tap();
    const vorher = await rechteck(page.locator('.mod-bg'));
    await sichtbarerBereich(page, { height: 448, offsetTop: 200, scale: 2 }, 'resize');
    expect(await page.evaluate(() => visualViewport.scale), 'Selbstprobe: gezoomt').toBe(2);
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--kd-vv-oben'))).toBe('');
    expect(await rechteck(page.locator('.mod-bg'))).toEqual(vorher);
  });
});

test.describe('Bildschirmtastatur, Handy quer 844 × 390 mit Touch', () => {
  test.use(HANDY_QUER);
  test.beforeEach(async ({ page }) => { await tastaturNachbilden(page); });

  test('AK 11 zu US-1 quer: bei 200 px sichtbarem Bereich liegen Meldung und Feld über der Tastatur', async ({ page }) => {
    await starten(page);
    const { meldung, feld } = await herkunftMitTastatur(page, TASTATUR_QUER);
    await expect.poll(() => imSichtbarenBereich(page, meldung, feld)).toEqual([]);
  });
});

test.describe('Desktop 1280 × 800 ohne Tastatur', () => {
  test.use(DESKTOP);

  test('ohne verdeckten Bereich keine Variable, das Fenster liegt wie bisher unter dem Kopf (ADR-0016)', async ({ page }) => {
    await starten(page);
    await page.locator('.ka[data-id="1"] .t').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
    expect(await page.evaluate(() => document.documentElement.style.getPropertyValue('--kd-vv-oben'))).toBe('');
    const kopfHoehe = await page.evaluate(() => {
      const probe = document.body.appendChild(Object.assign(document.createElement('div'), { style: 'height:var(--kd-head-h)' }));
      const hoehe = probe.getBoundingClientRect().height;
      probe.remove();
      return hoehe;
    });
    expect(await rechteck(page.locator('.mod-bg'))).toEqual({ oben: kopfHoehe, unten: 800 });
  });
});
