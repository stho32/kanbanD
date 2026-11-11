// R00119 Kopfzeichen ohne Hover erklären: Tooltip bei Tastaturfokus und langem Druck (ADR-0020, I0109)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, kontrastAm, thema } = require('./hilfen');

const MENSCH = 'Spalte gehört dem Menschen — Agenten können Karten hineinlegen, aber nicht herausnehmen';
const AGENT = 'Spalte gehört den Agenten — kennzeichnet nur, sperrt nichts';
const INFO = 'Kommentar: Hier legen Agenten Rückfragen ab';
const PHASE = 'Phase: Abnahme';
const GRENZE_UEBER = 'Grenze 3 · überschritten — höchstens 3 Karten in dieser Spalte';
const GRENZE_NORMAL = 'Grenze 5 — höchstens 5 Karten in dieser Spalte';
const OK = 'Abschlussspalte';

const BOARD = '---\nlimits:\n  Eingang: 3\n  In Arbeit: 5\ncolumn-owner:\n  Eingang: human\n  In Arbeit: agent\ncolumn-phases:\n  Eingang: Abnahme\n  In Arbeit: Entwicklung\ncolumn-notes:\n  Eingang: Hier legen Agenten Rückfragen ab\n---\n\n# Entwicklung\n\n## Eingang\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n- #5\n\n## Bereit\n\n- #6\n\n## Erledigt\n\n- #7\n';
const OHNE_INFO = '---\nlimits:\n  Eingang: 3\n  In Arbeit: 5\ncolumn-owner:\n  Eingang: human\n  In Arbeit: agent\ncolumn-phases:\n  Eingang: Abnahme\n  In Arbeit: Entwicklung\n---\n\n# Entwicklung\n\n## Eingang\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n- #5\n\n## Bereit\n\n- #6\n\n## Erledigt\n\n- #7\n';

const DATEIEN = {
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n',
  'aufgaben/0005-fuenf.md': '---\nid: 5\ntitle: fünf\n---\n',
  'aufgaben/0006-sechs.md': '---\nid: 6\ntitle: sechs\n---\n',
  'aufgaben/0007-sieben.md': '---\nid: 7\ntitle: sieben\n---\n',
};

const spalte = (page, name) => page.locator(`.bahn[data-col="${name}"]`);
const kopf = (page, name) => spalte(page, name).locator('.bahn-kopf');
const blase = page => page.locator('#kd-tipp');
const sichtbar = page => page.locator('#kd-tipp:visible');

/** Tab vom Anfang (Fokus auf BODY) bis `ziel`; bricht nach 200 Schritten ab. */
async function perTab(page, ziel) {
  await page.evaluate(() => document.activeElement.blur());
  for (let i = 0; i < 200; i++) {
    await page.keyboard.press('Tab');
    if (await ziel.evaluate(el => el === document.activeElement)) return i + 1;
  }
  return 0;
}

/** Fokussiert ein Element (löst focusin aus) und wartet, bis die Blase steht. */
async function fokussiere(page, ort, text) {
  await ort.focus();
  if (text !== undefined) await expect(blase(page)).toHaveText(text);
  return ort;
}

/** Langen Druck auf einem Auslöser: touch-pointerdown, mindestens eine halbe Sekunde halten, ohne loszulassen. */
async function langerDruck(page, ort) {
  await ort.dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 7, isPrimary: true, buttons: 1, bubbles: true });
  await page.waitForTimeout(600);
}

test.describe('R00119', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: Tab auf ⓘ und auf das Eigentümer-Zeichen zeigt die Erklärung sichtbar, der Fokus bleibt', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    const info = kopf(page, 'Eingang').locator('.info');
    const eig = kopf(page, 'Eingang').locator('.eig-z');
    await expect(sichtbar(page)).toHaveCount(0);
    expect(await perTab(page, info), 'ⓘ per Tab erreichbar').toBeGreaterThan(0);
    await expect(info).toBeFocused();
    await expect(blase(page)).toHaveAttribute('role', 'tooltip');
    await expect(blase(page)).toHaveText(INFO);
    await fokussiere(page, eig, MENSCH);
    await expect(eig).toBeFocused();
    await expect(blase(page)).toHaveAttribute('role', 'tooltip');
    await expect(blase(page)).toBeVisible();
  });

  test('US-1: ✓, Phase und Grenze zeigen ihre Blase bei Fokus, hell und dunkel (375 px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(k.adresse);
    const faelle = [
      [kopf(page, 'Erledigt').locator('.ok'), OK],
      [kopf(page, 'In Arbeit').locator('.v.ph'), 'Phase: Entwicklung'],
      [kopf(page, 'In Arbeit').locator('.v:not(.ph)'), GRENZE_NORMAL],
      [kopf(page, 'Eingang').locator('.v:not(.ph)'), GRENZE_UEBER],
    ];
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      for (const [ort, text] of faelle) await fokussiere(page, ort, text);
    }
  });

  test('US-1: leere Erklärung ist kein Auslöser', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await expect(kopf(page, 'Bereit').locator('[data-tip]')).toHaveCount(0);
    await expect(kopf(page, 'Eingang').locator('[data-tip]'), 'Gegenprobe: ein erklärender Kopf ist Auslöser').not.toHaveCount(0);
    await kopf(page, 'Bereit').locator('.bk-name').focus();
    await expect(sichtbar(page)).toHaveCount(0);
  });

  test('US-1: jeder Auslöser erfüllt --kd-ziel über Zielgröße oder Trefferhof (fein 24)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await expect(spalte(page, 'Eingang')).toBeVisible();
    const masse = await page.evaluate(() => {
      const ziel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kd-ziel'));
      const px = w => { const n = parseFloat(w); return Number.isFinite(n) ? n : 0; };
      const flaeche = el => {
        const r = el.getBoundingClientRect(), nach = getComputedStyle(el, '::after');
        let [l, o, ri, u] = [r.left, r.top, r.right, r.bottom];
        if (nach.content === '""' && nach.position === 'absolute') { l += px(nach.left); o += px(nach.top); ri -= px(nach.right); u -= px(nach.bottom); }
        return { breite: Math.round((ri - l) * 10) / 10, hoehe: Math.round((u - o) * 10) / 10 };
      };
      return { ziel, zeichen: [...document.querySelectorAll('.bahn-kopf [data-tip]')].map(el => ({ id: el.dataset.tip, ...flaeche(el) })) };
    });
    expect(masse.zeichen.map(z => z.id).sort()).toEqual(['eig:Eingang', 'eig:In Arbeit', 'grenze:Eingang', 'grenze:In Arbeit', 'info:Eingang', 'ph:Eingang', 'ph:In Arbeit', 'ok:Erledigt'].sort());
    const zuKlein = masse.zeichen.filter(z => z.breite < masse.ziel || z.hoehe < masse.ziel);
    expect(zuKlein, `--kd-ziel fein ${masse.ziel}`).toEqual([]);
  });

  test('US-2: langer Druck auf Touch zeigt dieselbe Blase wie der Fokus', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(k.adresse);
    const eig = kopf(page, 'Eingang').locator('.eig-z');
    await expect(sichtbar(page)).toHaveCount(0);
    await langerDruck(page, eig);
    await expect(blase(page)).toHaveText(MENSCH);
    await expect(sichtbar(page)).toHaveCount(1);
    await eig.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
  });

  test('US-3: Esc schließt den Tooltip zuerst, der Fokus bleibt am Auslöser', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    const info = kopf(page, 'Eingang').locator('.info');
    await fokussiere(page, info, INFO);
    await page.keyboard.press('Escape');
    await expect(sichtbar(page)).toHaveCount(0);
    await expect(info).toBeFocused();
  });

  test('US-3/Grenzfall Kaskade: ist zugleich ein Pop offen, schließt Esc nur den Tooltip', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await page.locator('#t-mehr').click();
    await expect(page.locator('#pop')).toBeVisible();
    const info = kopf(page, 'Eingang').locator('.info');
    await info.focus();
    await expect(blase(page)).toHaveText(INFO);
    await page.keyboard.press('Escape');
    await expect(sichtbar(page)).toHaveCount(0);
    await expect(page.locator('#pop')).toBeVisible();
  });

  test('US-3/Gegenbeispiel Fokus-Ebene: der Tooltip hat keinen Tab-Halt, Tab führt weiter', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await liveBereit(page);
    const info = kopf(page, 'Eingang').locator('.info');
    await fokussiere(page, info, INFO);
    // Ein Neuzeichnen reproduziert die Blase aus S.ui.tooltip (ADR-0007) — auch dann ohne Tab-Halt
    const vorher = await page.evaluate(() => window.kdTest.renders());
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins neu\n---\n');
    await expect.poll(() => page.evaluate(() => window.kdTest.renders())).toBeGreaterThan(vorher);
    await expect(blase(page)).toHaveText(INFO);
    await expect(blase(page)).not.toHaveAttribute('tabindex', /.+/);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.id)).not.toBe('kd-tipp');
    const fokus = await page.evaluate(() => ({ inKopf: Boolean(document.activeElement.closest('.bahn-kopf')) }));
    expect(fokus.inKopf, 'der Fokus steht auf dem nächsten Kopfzeichen').toBe(true);
  });

  test('US-4: zugänglicher Name ist wörtlich der Tooltiptext, ohne aria-describedby an den fünf Zeichen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    const zeichen = [
      [kopf(page, 'Eingang').locator('.info'), INFO],
      [kopf(page, 'Erledigt').locator('.ok'), OK],
      [kopf(page, 'Eingang').locator('.v.ph'), PHASE],
      [kopf(page, 'Eingang').locator('.v:not(.ph)'), GRENZE_UEBER],
      [kopf(page, 'Eingang').locator('.eig-z'), MENSCH],
    ];
    for (const [ort, text] of zeichen) {
      await ort.focus();
      await expect(blase(page)).toHaveText(text);
      expect(await ort.getAttribute('aria-label'), 'Name = Tooltiptext').toBe(text);
      await expect(ort).not.toHaveAttribute('aria-describedby', /.+/);
      await expect(ort).not.toHaveAttribute('title', /.+/);
    }
  });

  test('US-5: nur eine Blase zugleich; der Wechsel des Auslösers ersetzt den Text', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    const info = kopf(page, 'Eingang').locator('.info');
    const eig = kopf(page, 'Eingang').locator('.eig-z');
    await fokussiere(page, info, INFO);
    await expect(sichtbar(page)).toHaveCount(1);
    await fokussiere(page, eig, MENSCH);
    await expect(sichtbar(page)).toHaveCount(1);
    await expect(page.locator('[role="tooltip"]')).toHaveCount(1);
  });

  test('US-5: in der zugeklappten Spalte ist das Zeichen Schmuck, der Streifen-Knopf ist der Auslöser', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Eingang zuklappen' }).click();
    const streifen = page.getByRole('button', { name: 'Eingang aufklappen, gehört dem Menschen' });
    await expect(streifen).toBeVisible();
    await expect(streifen.locator('.eig-z')).toHaveAttribute('aria-hidden', 'true');
    await expect(streifen).toHaveAttribute('aria-describedby', /.+/);
    await expect(streifen).toHaveAccessibleDescription(MENSCH);
    await streifen.focus();
    await expect(blase(page)).toHaveText(MENSCH);
    await expect(sichtbar(page)).toHaveCount(1);
  });

  test('US-6: ein Live-Ereignis hinterlässt keinen verwaisten Tooltip', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await liveBereit(page);
    const info = kopf(page, 'Eingang').locator('.info');
    await fokussiere(page, info, INFO);
    // Fremder Schreibaufruf: eine andere Instanz legt eine Karte an → Live-Ereignis zeichnet neu
    const zweiter = await page.context().newPage();
    await alsPerson(zweiter, 'mi');
    await zweiter.goto(k.adresse);
    await liveBereit(zweiter);
    await zweiter.getByRole('button', { name: 'Neue Aufgabe in In Arbeit' }).click();
    await zweiter.getByLabel('Titel der neuen Aufgabe').fill('von Mia');
    await zweiter.keyboard.press('Enter');
    await zweiter.close();
    await expect(blase(page)).toHaveText(INFO);
    await expect(sichtbar(page)).toHaveCount(1);
    await expect(info).toBeFocused();
    // Verschwindet der Auslöser, bleibt keine Blase stehen
    k.schreib('boards/entwicklung.md', OHNE_INFO);
    await expect(kopf(page, 'Eingang').locator('.info')).toHaveCount(0);
    await expect(sichtbar(page)).toHaveCount(0);
  });

  test('M1/P1: der Blasentext nach Fokus und nach erzwungenem Neuzeichnen ist identisch — auch am data-tip-text-Überläufer des Streifen-Knopfs', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.getByRole('button', { name: 'Eingang zuklappen' }).click();
    const streifen = page.getByRole('button', { name: 'Eingang aufklappen, gehört dem Menschen' });
    await streifen.focus();
    const nachFokus = await blase(page).textContent();
    expect(nachFokus).toBe(MENSCH);
    const vorher = await page.evaluate(() => window.kdTest.renders());
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins neu\n---\n');
    await expect.poll(() => page.evaluate(() => window.kdTest.renders())).toBeGreaterThan(vorher);
    // Nach dem Neuzeichnen reproduziert `vTipp()` die Blase aus S.ui.tooltip — derselbe Wortlaut wie beim direkten Stellen
    await expect(sichtbar(page)).toHaveCount(1);
    expect(await blase(page).textContent()).toBe(nachFokus);
  });

  test('US-7: auf Touch schließt ein Tippen außerhalb, der Fokus bleibt am Auslöser', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(k.adresse);
    const eig = kopf(page, 'Eingang').locator('.eig-z');
    await eig.focus();
    await expect(blase(page)).toHaveText(MENSCH);
    await page.locator('.bahnen').dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 8, isPrimary: true, bubbles: true });
    await expect(sichtbar(page)).toHaveCount(0);
    await expect(eig).toBeFocused();
  });
});

test.describe('R00119 Touch (hasTouch/isMobile)', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('US-1: jeder Auslöser erfüllt --kd-ziel bei Touch (≥ 44)', async ({ page }) => {
    await page.goto(k.adresse);
    await expect(spalte(page, 'Eingang')).toBeVisible();
    const masse = await page.evaluate(() => {
      const ziel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kd-ziel'));
      const zeichen = [...document.querySelectorAll('.bahn-kopf [data-tip]')].map(el => { const r = el.getBoundingClientRect(); return { id: el.dataset.tip, breite: r.width, hoehe: r.height }; });
      return { ziel, zeichen };
    });
    expect(masse.ziel).toBe(48);
    expect(masse.zeichen.length, 'die fünf Zeichen sind da').toBeGreaterThanOrEqual(5);
    const zuKlein = masse.zeichen.filter(z => z.breite < 44 || z.hoehe < 44);
    expect(zuKlein, `--kd-ziel Touch ${masse.ziel}`).toEqual([]);
  });

  test('US-1/US-2: langer Druck zeigt die Blase, Esc schließt sie auf Touch', async ({ page }) => {
    await page.goto(k.adresse);
    const info = kopf(page, 'Eingang').locator('.info');
    await langerDruck(page, info);
    await expect(blase(page)).toHaveText(INFO);
    await info.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
    await page.keyboard.press('Escape');
    await expect(sichtbar(page)).toHaveCount(0);
  });

  test('US-7: langer Druck, dann außerhalb tippen schließt die Blase', async ({ page }) => {
    await page.goto(k.adresse);
    const info = kopf(page, 'Eingang').locator('.info');
    await info.focus();
    await langerDruck(page, info);
    await info.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
    await expect(sichtbar(page)).toHaveCount(1);
    await page.locator('.flaeche').first().dispatchEvent('pointerdown', { pointerType: 'touch', pointerId: 9, isPrimary: true, bubbles: true });
    await expect(sichtbar(page)).toHaveCount(0);
  });

  test('US-6: eine per langem Druck geöffnete Blase übersteht ein Live-Ereignis (Zustand in S.ui)', async ({ page }) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    const info = kopf(page, 'Eingang').locator('.info');
    await langerDruck(page, info);
    await info.dispatchEvent('pointerup', { pointerType: 'touch', pointerId: 7, isPrimary: true });
    await expect(sichtbar(page)).toHaveCount(1);
    const vorher = await page.evaluate(() => window.kdTest.renders());
    k.schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: eins neu\n---\n');
    await expect.poll(() => page.evaluate(() => window.kdTest.renders())).toBeGreaterThan(vorher);
    await expect(kopf(page, 'Eingang').locator('.info')).toHaveCount(1);
    await expect(blase(page)).toHaveText(INFO);
    await expect(sichtbar(page)).toHaveCount(1);
  });
});

test.describe('R00119 Anzeige, Kontrast und Breiten', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('Anzeige: Plain-Fläche, umbruchfähig bis 236 px, außerhalb von .bahnen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    const eig = kopf(page, 'Eingang').locator('.eig-z');
    await fokussiere(page, eig, MENSCH);
    await expect(page.locator('.bahnen #kd-tipp')).toHaveCount(0);
    await expect(page.locator('#over #kd-tipp')).toHaveCount(1);
    const stil = await blase(page).evaluate(el => { const s = getComputedStyle(el); return { position: s.position, maxBreite: s.maxInlineSize || s.maxWidth, weissraum: s.whiteSpace, hatTitel: el.children.length === 0 }; });
    expect(stil.position).toBe('fixed');
    expect(parseFloat(stil.maxBreite), 'max. 236 px').toBeLessThanOrEqual(236);
    expect(stil.weissraum).not.toBe('nowrap');
    expect(stil.hatTitel, 'kein Titel, keine Aktionen').toBe(true);
  });

  test('Kontrast: der Erklärtext misst hell und dunkel ≥ 4,5:1', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await fokussiere(page, kopf(page, 'Eingang').locator('.eig-z'), MENSCH);
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      const wert = await kontrastAm(blase(page));
      expect(wert, `${t}: ${wert.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
    }
  });

  for (const breite of [320, 375, 414]) {
    test(`Breite ${breite} px: die Blase liegt ganz im Fenster, nichts scrollt quer`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 812 });
      await page.goto(k.adresse);
      // Der äußerste rechte Auslöser: das Erledigt-Zeichen in der letzten Spalte
      await page.locator('.bahnen').evaluate(b => { b.scrollLeft = b.scrollWidth; });
      await fokussiere(page, kopf(page, 'Erledigt').locator('.ok'), OK);
      const masse = await blase(page).evaluate(el => { const r = el.getBoundingClientRect(); return { links: r.left, rechts: r.right, breite: innerWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }; });
      expect(masse.links, 'links im Fenster').toBeGreaterThanOrEqual(0);
      expect(masse.rechts, 'rechts im Fenster').toBeLessThanOrEqual(masse.breite);
      expect(masse.scrollWidth, 'kein Querscrollen').toBeLessThanOrEqual(masse.clientWidth);
    });
  }

  test('Tooltip am äußersten rechten und linken Auslöser wird an der Board-Kante nicht abgeschnitten', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 812 });
    await page.goto(k.adresse);
    await fokussiere(page, kopf(page, 'In Arbeit').locator('.eig-z'), AGENT);
    const drin = async () => blase(page).evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
    await page.locator('.bahnen').evaluate(b => { b.scrollLeft = b.scrollWidth; });
    await fokussiere(page, kopf(page, 'Erledigt').locator('.ok'), OK);
    expect(await drin(), 'rechter Auslöser').toBe(true);
  });
});
