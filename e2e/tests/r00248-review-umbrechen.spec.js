// R00248 Review-Seite — lange Zeilen umbrechen (Karte #259, I0238, Scheibe S6 von ADR-0042 Punkt 8): AK 1–10 und US-1..US-6 im echten
// Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`umbrechenRepository`: U1 mit K-Lang und K-Kurz, U2 K-Zwei, U3 K-Last, U4 ohne Dateien).
// Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Adressen, Messungen nur hier) → Programm.
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastFarben } = require('./hilfen');
const { umbrechenRepository, umbrechenVorbereiten, UM_A, UM_B } = require('./review-hilfen');

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

function seite(page) {
  const schalter = page.locator('#review .rv-leiste label.ru-sch');
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
    expect(await page.evaluate(() => document.getElementById('rv-alle').nextElementSibling === document.querySelector('.rv-leiste label.ru-sch'))).toBe(true);
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
      const vorher = await s.zustand();
      const anfragen = [];
      page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) anfragen.push(r.url()); });
      await s.schalter.click();
      await expect(s.eingabe).toBeChecked();
      expect(await s.umbrechen()).toBe(true);
      expect(await s.eingabe.evaluate(e => document.activeElement === e), 'Fokus auf dem Schalter').toBe(true);
      expect(await zeile.evaluate(tr => tr.kdMarke), 'dieselbe Zeile').toBe('vorab');
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
        return { form: st.backgroundPosition + '|' + st.backgroundImage, farbe: st.backgroundColor, rand: st.borderTopColor, randBreite: st.borderTopWidth, grund: getComputedStyle(e.closest('.rv-leiste')).backgroundColor };
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
});
