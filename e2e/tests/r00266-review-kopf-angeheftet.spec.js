// R00266 Review-Seite — Kopfzeile mit den Schaltern anheften (Karte #270, I0256, ADR-0042 N9): Abnahme-Proben P1–P3 und P5 aus
// ADR-0042 N9.5 im echten Programm gegen echtes Git. Der Kopf liegt als `flex:none`-Geschwister über `#review` in `#main`; Leseanker
// (N6.2), Sprungziele und Scroll-Anker (N7) bleiben unverändert. Ausgangslage: review-hilfen.js `kopfRepository` (K-N mit langer Zeile).
// Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Adressen, Messungen nur hier) → Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastFarben } = require('./hilfen');
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

/** Die Unterkante der Kopfzeile — und zugleich die Oberkante von `#review` (ADR-0042 N9.6). */
const kopfUnten = async page => {
  const m = await page.evaluate(() => { const k = document.querySelector('#rv-kopf'); const r = document.getElementById('review'); return { k: k ? k.getBoundingClientRect().bottom : null, r: r.getBoundingClientRect().top }; });
  expect(m.k, 'die Kopfzeile ist gezeichnet').not.toBeNull();
  expect(Math.abs(m.k - m.r), 'die Unterkante des Kopfs ist die Oberkante von #review (kein Spalt)').toBeLessThanOrEqual(0.5);
  return m.r;
};

/** Rollt `#review` so, dass die Oberkante des Knotens `ziel` px unter der Oberkante der Rolle steht. */
const rollenAuf = (knoten, ziel) => knoten.evaluate((e, z) => { const r = document.getElementById('review'); r.scrollTop += e.getBoundingClientRect().top - r.getBoundingClientRect().top - z; }, ziel);

const lage = (selektor) => async page => {
  const m = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? { oben: e.getBoundingClientRect().top, rollen: document.getElementById('review').getBoundingClientRect().top } : null; }, selektor);
  return m;
};

/** Zwei Bilder abwarten: erst danach ist der gescrollte Block `content-visibility:auto` gerechnet (ADR-0026 Regeln 1–3). */
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));

/** Hält Anfragen auf `muster` an, bis die Probe sie freigibt; `angehalten()` zählt die gehaltenen (Vorbild r00207). */
async function halten(page, muster) {
  const tore = [];
  await page.route(muster, async route => {
    let frei; const tor = new Promise(f => { frei = f; }); tore.push(frei);
    const wert = await tor;
    // eine inzwischen abgebrochene Anfrage ist kein Testfehler
    try { if (wert) await route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify(wert.body) }); else await route.continue(); } catch { /* abgebrochen */ }
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

/** Der Alpha-Wert einer berechneten Farbe: `oklch(… / 0.5)`, `color(srgb … / 0.5)`, `rgba(…, 0.5)` oder ohne Angabe 1. */
const alphaVon = (farbe) => {
  const s = String(farbe).trim();
  const schraeg = s.match(/\/\s*([\d.]+)\s*\)/);
  if (schraeg) return Number(schraeg[1]);
  const rgba = s.match(/^rgba\([^)]*,\s*([\d.]+)\s*\)$/);
  if (rgba) return Number(rgba[1]);
  const hex8 = s.match(/^#([0-9a-f]{6})([0-9a-f]{2})$/i);
  if (hex8) return parseInt(hex8[2], 16) / 255;
  return 1;
};

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
      // bis unter die erste Datei rollen: die 60. Zeile der ersten Datei (src/a.rs) steht oben
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
    // ADR-0042 N9.6: die Unterkante des Kopfs ist die Oberkante von #review — dieselbe Zahl, aber sie toetet den Mutanten
    // „Kopf mit position:sticky in #review“ (dort steht das Ziel hinter dem Kopf).
    await expect.poll(async () => (await lage('#rv-dk2')(page)).oben).toBeGreaterThanOrEqual(await kopfUnten(page));
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
    expect(insel.oben).toBeGreaterThanOrEqual(await kopfUnten(page));
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

  /* ── AK 5: Jeder Zustand, Neuladen und Ansichtswechsel ── */

  test('AK 5: der Kopf liegt in den Zustaenden mit Schaltern ausserhalb von #review, in den anderen gibt es keinen', async ({ page }) => {
    const s = seite(page);
    const ausserhalb = () => page.evaluate(() => { const k = document.getElementById('rv-kopf'), r = document.getElementById('review'); return k && r ? !r.contains(k) : null; });
    await s.commitOeffnen(k, 9, kopfRepository().n);
    expect(await ausserhalb(), 'geladene Ansicht: Kopf ausserhalb von #review').toBe(true);
    await expect(page.locator('#review .rv-ls'), 'die Commit-Leiste bleibt in #review').toHaveCount(1);
    await page.reload();
    await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    expect(await ausserhalb(), 'nach Neuladen').toBe(true);
    // Blättern zu einem anderen Commit (AK 5, PO Z. 743): der Kopf bleibt ausserhalb von #review
    await expect(page.locator('#rv-pos')).toHaveText('8 von 9');
    await page.locator('#rv-zurueck').click();
    await expect(page.locator('#rv-pos')).toHaveText('7 von 9');
    await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    expect(await ausserhalb(), 'nach Blättern').toBe(true);
    await page.locator('#rv-u-alle').click();
    await page.locator('#rv-insel section.df, #review .rv-leer').first().waitFor();
    expect(await ausserhalb(), '„Alle Aenderungen“').toBe(true);
    await expect(page.locator('#review .rv-ls')).toHaveCount(1);
    // Zustaende ohne Schalter: kein sichtbarer Kopf
    for (const [adresse, anker] of [
      [`${k.adresse}#/aufgaben/aufgabe/999/review`, '#review .rv-meld'],
      [`${k.adresse}#/aufgaben/aufgabe/9/review?commit=zz`, '#review .rv-meld'],
      [commitAdresse(k, 11, kopfRepository().leer), '#review .rv-leer'],
    ]) {
      await page.goto(adresse);
      await page.locator(anker).waitFor();
      await expect(page.locator('#rv-kopf'), `kein Kopf: ${adresse}`).toHaveCount(0);
      await expect(page.locator('#review .rv-ls, #review .rv-meld, #review .rv-leer').first()).toHaveCount(1);
    }
  });

  test('AK 5: nach einem Diff-Fehler mit „Erneut versuchen“ liegt der Kopf wieder ausserhalb von #review', async ({ page }) => {
    const s = seite(page);
    const ausserhalb = () => page.evaluate(() => { const k = document.getElementById('rv-kopf'), r = document.getElementById('review'); return k && r ? !r.contains(k) : null; });
    const h = await halten(page, '**/api/aufgaben/9/diff?**');
    await page.goto(commitAdresse(k, 9, kopfRepository().n));
    await expect.poll(() => h.angehalten()).toBe(1);
    h.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht rechtzeitig.' } });
    await expect(page.locator('#review .rv-meld')).toContainText('Zeitgrenze überschritten.');
    await expect(page.locator('#rv-kopf'), 'im Fehlerzustand gibt es keinen Kopf').toHaveCount(0);
    await expect(page.locator('#review .rv-ls'), 'die Commit-Leiste bleibt in #review').toHaveCount(1);
    await page.locator('#rv-erneut').click();
    await expect.poll(() => h.angehalten()).toBe(2);
    h.frei(1, null);
    await expect(s.kopf).toHaveCount(1);
    expect(await ausserhalb(), 'nach „Erneut versuchen“').toBe(true);
    expect(await s.kopfImBild(), 'der Kopf ist sichtbar').toBe(true);
  });

  /* ── AK 6: Breiten und Bedienung (D0009 Bild 11) ── */

  for (const thm of ['light', 'dark']) {
    for (const breite of [320, 414, 980, 1280]) {
      test(`AK 6: ${thm} ${breite} px — kein Querrollen, Kopf sichtbar und bedienbar, deckende Flaeche, Umbruch und Zielgroessen`, async ({ page }) => {
        const s = seite(page);
        await thema(page, thm);
        await breiteSetzen(page, breite, 800);
        await s.commitOeffnen(k, 9, kopfRepository().n);
        await expect(s.kopf).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), 'kein Querrollen').toBe(true);
        expect(await s.kopfImBild()).toBe(true);
        const stil = await s.kopf.evaluate(e => { const st = getComputedStyle(e); const r = e.getBoundingClientRect(); return { grund: st.backgroundColor, hoehe: r.height, zeilen: (() => { const rs = Array.from(e.querySelectorAll('label.ru-sch, .btn'), c => c.getBoundingClientRect()).sort((a, b) => a.top - b.top); let n = 0, unten = -1e9; for (const q of rs) if (q.top >= unten - 2) { n++; unten = q.bottom; } else unten = Math.max(unten, q.bottom); return n; })() }; });
        expect(stil.grund, 'deckende Flaeche (Alpha 1)').toMatch(/^(oklch|rgb|rgba|#)/);
        expect(alphaVon(stil.grund), `Alpha ist 1 (${stil.grund})`).toBe(1);
        if (breite === 320) expect(stil.zeilen, 'hoechstens zwei Zeilen bei 320 px').toBeLessThanOrEqual(2);
        // die Schalterwoerter stehen ganz
        for (const wort of ['Alle einklappen', 'Umbrechen', 'Nebeneinander']) {
          const knoepfe = await page.getByText(wort, { exact: true }).evaluateAll(es => es.map(e => e.getBoundingClientRect().width));
          expect(knoepfe.length, `${wort} ist da`).toBeGreaterThan(0);
        }
        // Zielgroesse und Kontrast
        const ziele = await page.locator('#rv-kopf label.ru-sch, #rv-kopf .btn').evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
        for (const [b, h] of ziele) expect(Math.min(b, h), 'Zielgroesse >= 24 px').toBeGreaterThanOrEqual(24);
        const paare = await page.locator('#rv-kopf .btn').evaluateAll(es => es.map(e => { const st = getComputedStyle(e); return [st.color, getComputedStyle(e.closest('#rv-kopf')).backgroundColor]; }));
        for (const [text, grund] of paare) expect(await kontrastFarben(page, text, grund), 'Text >= 4,5:1').toBeGreaterThanOrEqual(4.5);
        // Tab erreicht „Zum Code“ (erstes Element), dann Umbrechen und Nebeneinander; die Leertaste schaltet um
        await page.locator('#rv-rueckweg').focus();
        await page.keyboard.press('Tab');
        await expect(page.locator('#rv-zc')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(page.locator('#rv-alle')).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(s.eingabe).toBeFocused();
        await page.keyboard.press('Space');
        await expect(s.eingabe).toBeChecked();
        await page.keyboard.press('Space');
        await expect(s.eingabe).not.toBeChecked();
      });
    }
  }

  /* ── AK 6 / FA 2: der Name des Kopfbereichs (B1455, PO Z. 745–747) ── */

  test('AK 6: der Kopfbereich heisst „Darstellung der Review-Seite“ und ist von der Navigation unterscheidbar', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, kopfRepository().n);
    const kopf = page.locator('#rv-kopf');
    await expect(kopf).toHaveCount(1);
    // der berechnete Name (aria-label) — der Name, den der Kopfbereich fuer Hilfstechnik traegt
    await expect(kopf).toHaveAccessibleName('Darstellung der Review-Seite');
    // die Navigation behaelt ihren Namen (R00245 FA 1)
    await expect(page.getByRole('navigation', { name: 'Ansicht der Review-Seite' })).toHaveCount(1);
    // unterscheidbar: zwei Bereiche gleichen Namens waeren fuer Bildschirmleser nicht auseinanderzuhalten
    expect(await kopf.getAttribute('aria-label')).not.toBe(await page.locator('nav#rv-ls').getAttribute('aria-label'));
  });

  /* ── AK 6a: Flaeche im niedrigen Fenster und bei Zoom ── */

  test('AK 6a: 320 x 480 und 640 x 360 (200 % Zoom) — Kopf + .rv-kz <= halbe #main-Hoehe, #review >= 200 px', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, kopfRepository().n);
    for (const [breite, hoehe] of [[320, 480], [640, 360]]) {
      await breiteSetzen(page, breite, hoehe);
      await expect(s.kopf).toHaveCount(1);
      const m = await page.evaluate(() => {
        const main = document.getElementById('main'), rolle = document.getElementById('review'), kz = document.querySelector('.rv-kz');
        // `.rv-kz` liegt in `#kopf`, ausserhalb von `#main`: `main.children` erreicht ihn nicht (B1, 270-code-reviewer-1)
        const geschwister = Array.from(main.children).filter(e => e !== rolle).reduce((s2, e) => s2 + e.getBoundingClientRect().height, 0);
        const kopfFlaeche = geschwister + (kz ? kz.getBoundingClientRect().height : NaN);
        return { kopfFlaeche, geschwister, kz: kz ? kz.getBoundingClientRect().height : null, main: main.clientHeight, rolle: rolle.clientHeight, scroll: rolle.scrollHeight };
      });
      expect(m.kz, '.rv-kz ist gezeichnet').not.toBeNull();
      expect(m.kopfFlaeche, `Kopf + .rv-kz <= 50 % von #main (${breite}x${hoehe})`).toBeLessThanOrEqual(0.5 * m.main);
      expect(m.rolle, `#review >= 200 px (${breite}x${hoehe})`).toBeGreaterThanOrEqual(200);
      expect(m.scroll, 'Dateiliste und Code sind durch Rollen erreichbar').toBeGreaterThan(m.rolle);
      // die Kopfhoehe ist mit und ohne Tastaturfokus gleich
      const ohne = await s.kopf.evaluate(e => e.getBoundingClientRect().height);
      await page.locator('#rv-zc').focus();
      const mit = await s.kopf.evaluate(e => e.getBoundingClientRect().height);
      expect(Math.abs(mit - ohne), 'kein Hoehenwechsel bei Fokus').toBeLessThanOrEqual(0.5);
    }
  });

  /* ── AK 6 bei grobem Zeiger (D0009 Bild 11: zwei Zeilen bei 320 px) ── */

  test.describe('grober Zeiger', () => {
    test.use({ hasTouch: true });
    test('AK 6: 320 px grober Zeiger — hoechstens zwei Zeilen, die Schalterwoerter stehen ganz, Ziele >= 48 px', async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, 320, 480);
      expect(await page.evaluate(() => matchMedia('(pointer:coarse)').matches), 'grober Zeiger').toBe(true);
      await s.commitOeffnen(k, 9, kopfRepository().n);
      await expect(s.kopf).toHaveCount(1);
      const zeilen = await s.kopf.evaluate(e => { const rs = Array.from(e.querySelectorAll('label.ru-sch, .btn'), c => c.getBoundingClientRect()).sort((a, b) => a.top - b.top); let n = 0, unten = -1e9; for (const q of rs) if (q.top >= unten - 2) { n++; unten = q.bottom; } else unten = Math.max(unten, q.bottom); return n; });
      expect(zeilen, 'hoechstens zwei Zeilen bei 320 px').toBeLessThanOrEqual(2);
      for (const wort of ['Alle einklappen', 'Umbrechen', 'Nebeneinander']) {
        const masse = await page.getByText(wort, { exact: true }).evaluateAll(es => es.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; }));
        expect(masse.length, `${wort} ist da`).toBeGreaterThan(0);
        for (const [b, h] of masse) expect(Math.min(b, h), `${wort} >= 48 px`).toBeGreaterThanOrEqual(48);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    });
  });
});
