// R00266 Review-Seite — Kopfzeile mit den Schaltern anheften (Karte #270, I0256, ADR-0042 N9): Abnahme-Proben P1–P3 und P5 aus
// ADR-0042 N9.5 im echten Programm gegen echtes Git. Der Kopf liegt als `flex:none`-Geschwister über `#review` in `#main`; Leseanker
// (N6.2), Sprungziele und Scroll-Anker (N7) bleiben unverändert. Ausgangslage: review-hilfen.js `kopfRepository` (K-N mit langer Zeile).
// Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Adressen, Messungen nur hier) → Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen } = require('./hilfen');
const { kopfRepository, kopfVorbereiten } = require('./review-hilfen');

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;

function seite(page) {
  /** Die Kopfzeile mit den Schaltern — die Leiste, die `#rv-umbr` trägt (AK 1 nennt sie `.rv-leiste`, die Vorgabe D0009 Bild 11
      `.rv-kopf`); die Suche über beide Namen trägt den Vorher-Stand mit, sonst prüfte sie nur „Knoten fehlt“. */
  const kopf = page.locator(':is(.rv-kopf,.rv-leiste):has(#rv-umbr)');
  const schalter = page.locator(':is(.rv-kopf,.rv-leiste) label.ru-sch').filter({ has: page.locator('#rv-umbr') });
  const eingabe = page.locator('#rv-umbr');
  return {
    kopf, schalter, eingabe,
    commitOeffnen: async (k, nr, commit) => {
      await page.goto(commitAdresse(k, nr, commit));
      await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    },
    umbrechen: () => page.locator('#review').evaluate(r => r.classList.contains('umbr')),
    /** Der Kopf ganz im Sichtbereich (jede Kante innerhalb des Fensters). */
    kopfImBild: () => kopf.evaluate(e => { const r = e.getBoundingClientRect(); return r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth; }),
  };
}

/** Die oberste sichtbare Zeile an der Oberkante von `#review` (ADR-0042 N6.2): `elementFromPoint` an der Oberkante, ueber die
    Breite abgetastet — die Nummernspalte der Zeile ist der einzige Punkt, den jeder Zeilentyp trifft. */
const obersteZeile = page => page.evaluate(() => {
  const rolle = document.getElementById('review'), r = rolle.getBoundingClientRect();
  for (let x = r.left + 2; x < r.right; x += 4) {
    const p = document.elementFromPoint(x, r.top + 2);
    const tr = p && p.closest && p.closest('tr');
    const zelle = tr && tr.querySelector('[data-z]');
    if (zelle) return { id: zelle.dataset.z, oben: tr.getBoundingClientRect().top, imAnker: Boolean(tr.closest('#rv-insel')) };
  }
  return null;
});

/** Rollt `#review` so, dass die Oberkante des Knotens `ziel` px unter der Oberkante der Rolle steht. */
const rollenAuf = (knoten, ziel) => knoten.evaluate((e, z) => { const r = document.getElementById('review'); r.scrollTop += e.getBoundingClientRect().top - r.getBoundingClientRect().top - z; }, ziel);

const lage = (selektor) => async page => {
  const m = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { oben: e.getBoundingClientRect().top, rollen: document.getElementById('review').getBoundingClientRect().top } : null; }, selektor);
  return m;
};

/** Zwei Bilder abwarten: erst danach ist der gescrollte Block `content-visibility:auto` gerechnet (ADR-0026 Regeln 1–3). */
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));

test.describe('R00266 Review-Seite — Kopfzeile angeheftet', () => {
  let k;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(kopfVorbereiten(kopfRepository()));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /* ── P1 (AK 1): Der Kopf bleibt beim Lesen sichtbar, die Lesestelle steht ── */

  for (const breite of [980, 320]) {
    test(`P1 (AK 1): ${breite} px — der Kopf mit den Schaltern bleibt im Bild, die oberste Lesezeile steht nach dem Umschalten`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, breite, 800);
      await s.commitOeffnen(k, 9, kopfRepository().n);
      // bis unter die erste Datei rollen: die erste Zeile der langen Datei (src/l.rs, 407-Zeichen-Zeile) steht oben
      const erste = page.locator('#rv-d0 .df-sc tr').filter({ has: page.locator('[data-z]') }).nth(60);
      await rollenAuf(erste, 0);
      await zweiBilder(page);
      const vorher = await obersteZeile(page);
      expect(vorher, 'eine Zeile steht an der Oberkante der Rolle').not.toBeNull();
      // umschalten und zurückschalten
      await s.schalter.click();
      await expect(s.eingabe).toBeChecked();
      expect(await s.umbrechen()).toBe(true);
      expect(await s.kopfImBild(), 'die Kopfzeile mit den Schaltern liegt ganz im Sichtbereich').toBe(true);
      await zweiBilder(page);
      const nachher = await obersteZeile(page);
      expect(nachher, 'dieselbe Zeile steht oben').not.toBeNull();
      expect(nachher.id, 'dieselbe Lesezeile (data-z)').toBe(vorher.id);
      expect(Math.abs(nachher.oben - vorher.oben), 'die Lesestelle steht (Toleranz 36 px)').toBeLessThanOrEqual(36);
      await s.schalter.click();
      await expect(s.eingabe).not.toBeChecked();
      expect(await s.kopfImBild()).toBe(true);
    });
  }

  /* ── P2 (AK 2): Sprungziel unter dem Kopf ── */

  test('P2 (AK 2): der Sprung aus der Dateiliste landet unter dem Kopf', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, kopfRepository().n);
    const ziel = page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: /z\.rs$/ }) });
    await expect(ziel).toHaveCount(1);
    await page.locator('#rv-liste button.dn-e[data-act="review-datei"]').filter({ hasText: 'z.rs' }).click();
    expect(await s.kopfImBild(), 'die Kopfzeile steht dabei im Bild').toBe(true);
    await expect.poll(async () => (await lage('#rv-dk2')(page)).oben).toBeGreaterThanOrEqual((await lage('#review')(page)).rollen - 0.5);
  });

  /* ── P3 (AK 3): „Zum Code“ unter dem Kopf ── */

  test('P3 (AK 3): „Zum Code“ per Tastatur landet unter dem Kopf', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, kopfRepository().n);
    await expect(page.locator('#rv-zc'), 'bei neun Einträgen gibt es den Sprung').toHaveCount(1);
    await page.locator('#rv-zc').focus();
    await page.keyboard.press('Enter');
    expect(await s.kopfImBild(), 'die Kopfzeile steht dabei im Bild').toBe(true);
    const insel = await lage('#rv-insel')(page);
    const rolle = await lage('#review')(page);
    expect(insel.oben).toBeGreaterThanOrEqual(rolle.rollen - 0.5);
  });

  /* ── P5 (AK 4): Der Leseanker greift ── */

  test('P5 (AK 4): der Leseanker trifft an der Oberkante von #review eine Zeile, nicht den Rückfall', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, kopfRepository().n);
    await rollenAuf(page.locator('#rv-d0 .df-sc tr').filter({ has: page.locator('[data-z]') }).nth(200), 0);
    await zweiBilder(page);
    const zeile = await obersteZeile(page);
    expect(zeile, 'eine Zeile `tr` steht an der Oberkante von #review').not.toBeNull();
    expect(zeile.imAnker, 'die Zeile liegt in der Insel, nicht im Rückfall').toBe(true);
  });
});
