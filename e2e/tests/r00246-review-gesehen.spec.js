// R00246 Review-Seite — Dateien als gesehen markieren (Karte #257, I0236, Scheibe S3 von ADR-0042): AK 1–10 und US-1..US-7 im echten
// Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`gesehenRepository`: K-Art, K-Rand, K-Budget, K3/W3 wie R00235, dazu K3b,
// KG, K5/W5). Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Adressen, Speicher nur hier) → Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen, kontrastAm } = require('./hilfen');
const { gesehenRepository, gesehenVorbereiten } = require('./review-hilfen');

const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const SATZ_SPEICHER = 'Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.';
const K_ART_DATEIEN = ['web/kd-app.css', 'e2e/einheit/kontrast.test.js', 'e2e/einheit/sperrform.test.js', 'e2e/tests/r00219-ansicht.spec.js', 'e2e/tests/r00229-sperrform.spec.js', 'Anforderungen/R00001.md', 'Dokumentation/Gelerntes.md', 'Schaetzungen/S00001.md'];

/* ── Treiber: Adressen, Selektoren, Speicher ── */

const commitAdresse = (k, nr, commit, basis = '#/aufgaben') => `${k.adresse}${basis}/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

function seite(page) {
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const zeile = pfad => page.locator('#review .dn-e').filter({ has: page.locator('.p', { hasText: exakt(pfad) }) });
  const kaestchen = pfad => datei(pfad).locator('input.ru-ges-k');
  return {
    datei, zeile, kaestchen,
    label: pfad => datei(pfad).locator('label.ru-ges'),
    klappe: pfad => datei(pfad).locator('.df-k').first(),
    offen: async pfad => (await datei(pfad).locator('.df-k').first().getAttribute('aria-expanded')) === 'true',
    haken: pfad => zeile(pfad).locator('.rv-gm svg'),
    zeileText: () => page.locator('#rv-ges-z'),
    ganzeZeile: () => page.locator('#rv-ges-t'),
    balken: () => page.locator('#rv-ges-balken'),
    balkenAnteil: () => page.locator('#rv-ges-balken').evaluate(b => { const i = b.querySelector('i'); return i.getBoundingClientRect().width / b.getBoundingClientRect().width; }),
    live: () => page.locator('#rv-gesehen'),
    speicherSatz: () => page.locator('#rv-gesehen-speicher'),
    alleKnopf: () => page.locator('#rv-alle'),
    gruppenkopf: (art, a = null) => page.locator(a === null ? `#rv-gk-${art}` : `#rv-gk${a}-${art}`),
    fokusIstKaestchenVon: pfad => page.evaluate(p => {
      const e = document.activeElement;
      return Boolean(e && e.matches('input.ru-ges-k') && e.getAttribute('aria-label') === `Gesehen: ${p}`);
    }, pfad),
    /** Das fokussierte Element samt 4 px Fokusring liegt ganz im Fenster und im sichtbaren Teil der Rollfläche. */
    fokusGanzSichtbar: () => page.evaluate(() => {
      const r = document.activeElement.getBoundingClientRect(), rolle = document.getElementById('review').getBoundingClientRect();
      return r.top - 4 >= Math.max(0, rolle.top) && r.bottom + 4 <= Math.min(innerHeight, rolle.bottom) && r.left - 4 >= 0 && r.right + 4 <= innerWidth;
    }),
    speicher: () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(s => s.startsWith('kanbanD.gesehen.')).map(s => [s, localStorage.getItem(s)]))),
  };
}

async function commitOeffnen(page, k, nr, commit, basis) {
  await page.goto(commitAdresse(k, nr, commit, basis));
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

async function alleOeffnen(page, k, nr) {
  await page.goto(alleAdresse(k, nr));
  await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
}

async function neuLaden(page) {
  await page.reload();
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

/** Zählt Textänderungen an der Live-Region `#rv-gesehen` (der Knoten muss derselbe bleiben). */
async function liveZaehlen(page) {
  await page.evaluate(() => {
    const knoten = document.getElementById('rv-gesehen');
    window.kdLive = { knoten, texte: [] };
    new MutationObserver(() => window.kdLive.texte.push(knoten.textContent)).observe(knoten, { childList: true, characterData: true, subtree: true });
  });
  return {
    texte: () => page.evaluate(() => window.kdLive.texte.slice()),
    derselbe: () => page.evaluate(() => window.kdLive.knoten === document.getElementById('rv-gesehen')),
  };
}

test.describe('R00246 Dateien als gesehen markieren', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k, h, fehler;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    fehler = [];
    page.on('pageerror', f => fehler.push(String(f)));
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    h = gesehenRepository();
    k = await kanbanStarten(gesehenVorbereiten(h));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1 Haken, Fortschritt, Ein- und Aufklappen (US-1) ── */

  test('AK 1/US-1: K-Art — „0 von 8 gesehen“, Haken an web/kd-app.css: „1 von 8“, zu, Fokus bleibt, Haken-Symbol; Entfernen kehrt alles um', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await expect(s.zeileText()).toHaveText('0 von 8 gesehen');
    expect(await s.balkenAnteil()).toBe(0);
    await expect(s.balken()).toHaveAttribute('aria-hidden', 'true');
    expect(await s.balken().evaluate(b => [b.textContent, b.getAttribute('role')])).toEqual(['', null]);
    await expect(page.locator('#rv-insel input.ru-ges-k')).toHaveCount(8);
    for (const pfad of K_ART_DATEIEN.slice(0, 5)) await expect(s.label(pfad)).toBeVisible();
    for (const pfad of K_ART_DATEIEN.slice(5)) await expect(s.kaestchen(pfad)).toBeHidden();
    await expect(s.label('web/kd-app.css')).toHaveText('Gesehen');
    await expect(s.kaestchen('web/kd-app.css')).toHaveAttribute('aria-label', 'Gesehen: web/kd-app.css');
    expect(await s.offen('web/kd-app.css')).toBe(true);

    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(await s.balkenAnteil()).toBeCloseTo(1 / 8, 2);
    await expect(s.kaestchen('web/kd-app.css')).toBeChecked();
    expect(await s.offen('web/kd-app.css')).toBe(false);
    await expect(s.datei('web/kd-app.css').locator('.df-inhalt')).toBeHidden();
    await expect(s.klappe('web/kd-app.css')).toBeVisible();
    expect(await s.fokusIstKaestchenVon('web/kd-app.css')).toBe(true);
    expect(await s.fokusGanzSichtbar()).toBe(true);
    await expect(s.haken('web/kd-app.css')).toHaveCount(1);
    await expect(s.zeile('web/kd-app.css')).toHaveAccessibleName(/gesehen/);
    await expect(s.haken('e2e/einheit/kontrast.test.js')).toHaveCount(0);
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'false');

    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('0 von 8 gesehen');
    expect(await s.balkenAnteil()).toBe(0);
    expect(await s.offen('web/kd-app.css')).toBe(true);
    await expect(s.haken('web/kd-app.css')).toHaveCount(0);
    expect(await s.fokusIstKaestchenVon('web/kd-app.css')).toBe(true);
    expect(await s.fokusGanzSichtbar()).toBe(true);

    await page.keyboard.press('Space');
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(await s.offen('web/kd-app.css')).toBe(false);
    await s.gruppenkopf('doku').click();
    for (const pfad of K_ART_DATEIEN.slice(5)) await expect(s.label(pfad)).toBeVisible();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(fehler).toEqual([]);
  });
});
