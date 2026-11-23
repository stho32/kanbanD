// R00249 Review-Seite — Ansicht nebeneinander (Karte #260, I0239, Scheibe S7 von ADR-0042 Punkt 8, N6): AK 1–10 und US-1..US-6 im
// echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`nebeneinanderRepository`: N1 mit K-Lauf, K-Datei, K-Lang; N2 K-Block,
// N3 K-Zwei in `wb`, N4 K-Last, N5 ohne Dateien). Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Messungen nur hier).
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastFarben } = require('./hilfen');
const { nebeneinanderRepository, nebeneinanderVorbereiten, UM_A, UM_B } = require('./review-hilfen');

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const N = () => nebeneinanderRepository();

function seite(page) {
  const schalter = page.locator('#review .rv-leiste label.ru-sch').filter({ has: page.locator('#rv-nb') });
  const eingabe = page.locator('#review .rv-leiste #rv-nb');
  const umbrechen = page.locator('#review .rv-leiste #rv-umbr');
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const bereich = pfad => datei(pfad).locator('.df-sc');
  /** Die Tabellenzeile (ohne Kopf), deren Zelle genau `text` zeigt (ohne Lesetext). */
  const zeile = (pfad, text) => bereich(pfad).locator('tbody tr, table > tr').filter({ has: page.locator('td.c[data-z]', { hasText: new RegExp(`^(entfernt: |hinzugefügt: )?${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
  return {
    schalter, eingabe, umbrechen, datei, bereich, zeile,
    commitOeffnen: async (k, nr, commit) => {
      await page.goto(commitAdresse(k, nr, commit));
      await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    },
    alleOeffnen: async (k, nr) => {
      await page.goto(alleAdresse(k, nr));
      await page.locator('#rv-insel section.df').first().waitFor();
    },
    /** Je Tabellenzeile des Bereichs: Klasse und Zellen `{k: Klasse, t: Text, v: aria-hidden, z: data-z, s: colspan}`. */
    tabelle: pfad => bereich(pfad).evaluate(b => Array.from(b.querySelectorAll('table.dz tr'), tr => tr.closest('thead') ? null : ({
      k: tr.className,
      zellen: Array.from(tr.cells, c => ({ k: c.className, t: c.textContent, v: c.getAttribute('aria-hidden') === 'true', z: c.dataset.z ?? null, s: c.colSpan })),
    })).filter(Boolean)),
    nebeneinander: pfad => bereich(pfad).evaluate(b => b.querySelectorAll('table.ru-nb').length > 0),
    /** Ein Zustand der Seite, der sich durch das Umschalten nicht ändern darf. */
    zustand: () => page.evaluate(() => ({
      dateien: Array.from(document.querySelectorAll('#rv-insel .df-k[aria-expanded]'), b => b.getAttribute('aria-expanded')),
      gruppen: Array.from(document.querySelectorAll('#rv-insel [id^="rv-gk"][aria-expanded]'), b => b.getAttribute('aria-expanded')),
      gesehen: (document.querySelector('.rv-ges') || {}).textContent || '',
      haken: Array.from(document.querySelectorAll('#rv-insel input[type=checkbox]'), e => e.checked),
      alle: (document.getElementById('rv-alle') || {}).textContent || '',
      adresse: location.hash,
    })),
    /** Text aller Tabellen der Insel und Zahl ihrer Zeilen; `textContent`, weil Blöcke außerhalb des Bildes (`content-visibility`) kein
        `innerText` haben. */
    tabellenText: () => page.evaluate(() => Array.from(document.querySelectorAll('#rv-insel table.dz'), t => [t.rows.length, t.textContent])),
    /** Klappt die Datei auf, wenn sie zu ist. */
    oeffnen: async pfad => {
      const kopf = datei(pfad).locator('.df-k');
      if ((await kopf.getAttribute('aria-expanded')) === 'false') await kopf.click();
      await expect(datei(pfad).locator('.df-sc')).toBeAttached();
    },
    dokuOeffnen: async () => {
      const kopf = page.locator('#rv-insel button[id^="rv-gk"][id$="-doku"]').first();
      await kopf.click();
      await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    },
  };
}

/** Hält fest, ob die Farbe eines Diffbereichs entschieden ist (`data-farbe` ja oder nein). */
const farbeAbwarten = (page, bereich) => bereich.elementHandle().then(el => page.waitForFunction(e => e.dataset.farbe === 'ja' || e.dataset.farbe === 'nein', el, { timeout: 15000 }));
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
/** Lage der Oberkante eines Knotens zur Oberkante der Rolle `#review`. */
const lage = knoten => knoten.evaluate(e => e.getBoundingClientRect().top - document.getElementById('review').getBoundingClientRect().top);
/** Rollt `#review` so, dass die Oberkante des Knotens `ziel` px unter der Oberkante der Rolle steht. */
const rollenAuf = (knoten, ziel) => knoten.evaluate((e, z) => { const r = document.getElementById('review'); r.scrollTop += e.getBoundingClientRect().top - r.getBoundingClientRect().top - z; }, ziel);
/** Lage der Tabellenzeile mit `data-z` im n-ten Code-Bereich; null, wenn es sie nicht gibt. */
const lageNachKennung = (page, n, z) => page.evaluate(([n, z]) => {
  const c = document.querySelectorAll('#review .df-sc')[n].querySelector(`[data-z="${z}"]`);
  return c ? c.closest('tr').getBoundingClientRect().top - document.getElementById('review').getBoundingClientRect().top : null;
}, [n, z]);
/** Je Zeichen des Textes einer Zelle (ohne Lesetext) die berechnete Farbe. */
const zeichenFarben = zelle => zelle.evaluate(c => {
  const aus = [], w = document.createTreeWalker(c, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.parentElement.closest('.vh')) continue;
    for (const ch of n.data) aus.push([ch, getComputedStyle(n.parentElement).color]);
  }
  return aus;
});
const marken = zelle => zelle.locator('mark.wm').allTextContents();
const seitenQuer = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
/** Textzeilen einer Zelle (verschiedene Oberkanten der Rechtecke des Textes ohne Lesetext). */
const textZeilen = zelle => zelle.evaluate(c => {
  const lesen = c.querySelector('.vh'), r = document.createRange();
  r.selectNodeContents(c);
  if (lesen) r.setStartAfter(lesen);
  return new Set(Array.from(r.getClientRects()).filter(q => q.width > 0).map(q => Math.round(q.top))).size;
});

/** Long Tasks ab dem Laden (PerformanceObserver `longtask`, ereignisgenau). */
function langeAufgabenSammeln() {
  window.kdLang = [];
  new PerformanceObserver(l => l.getEntries().forEach(e => window.kdLang.push({ start: e.startTime, dauer: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true });
}

test.describe('R00249 Review-Seite — Ansicht nebeneinander', () => {
  let k;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(nebeneinanderVorbereiten(N()));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1 Schalter, Umschalten und Rundlauf (US-1) ── */

  test('AK 1: Schalter „Nebeneinander“ rechts neben „Umbrechen“ in Ein Commit und Alle Änderungen, aus, nicht ohne Dateien', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await expect(s.schalter).toHaveCount(1);
    await expect(s.schalter).toHaveText('Nebeneinander');
    await expect(s.eingabe).toHaveAttribute('type', 'checkbox');
    await expect(s.eingabe).toHaveAttribute('role', 'switch');
    await expect(s.eingabe).not.toBeChecked();
    expect(await page.evaluate(() => document.getElementById('rv-umbr').closest('label').nextElementSibling === document.getElementById('rv-nb').closest('label'))).toBe(true);
    expect(await s.nebeneinander('src/n.rs')).toBe(false);
    await s.alleOeffnen(k, 9);
    await expect(s.schalter).toHaveCount(1);
    await expect(s.eingabe).not.toBeChecked();
    await s.commitOeffnen(k, 12, N().leer);
    await expect(page.locator('#review .rv-leer')).toHaveText('Dieser Commit ändert keine Dateien.');
    await expect(s.schalter).toHaveCount(0);
  });

  for (const ansicht of ['commit', 'alle']) {
    test(`AK 1: ${ansicht} — Klick auf das Label schaltet um, ohne Anfrage; Dateien, Gesehen, Marker, Fokus bleiben; zurück gleich wie vorher`, async ({ page }) => {
      const s = seite(page);
      if (ansicht === 'commit') await s.commitOeffnen(k, 9, N().n1); else await s.alleOeffnen(k, 9);
      await s.datei('src/neu.rs').locator('.df-k').click();
      await expect(s.datei('src/neu.rs').locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
      await s.datei('src/weg.rs').getByRole('checkbox', { name: /Gesehen/ }).check();
      await expect(page.locator('.rv-ges')).toContainText('1 von');
      await expect(s.bereich('src/n.rs').locator('td.c[data-z]').first()).toBeVisible();
      await page.evaluate(() => { for (const e of [document.querySelector('#rv-insel .df-k'), document.querySelector('#rv-insel input[type=checkbox]'), document.getElementById('rv-nb'), document.querySelector('.rv-leiste')]) e.kdMarke = 'vorab'; });
      const marker = () => page.evaluate(() => [document.querySelector('#rv-insel .df-k'), document.querySelector('#rv-insel input[type=checkbox]'), document.getElementById('rv-nb'), document.querySelector('.rv-leiste')].map(e => e.kdMarke));
      const vorher = await s.zustand();
      const textVorher = await s.tabellenText();
      const anfragen = [];
      page.on('request', r => { if (new URL(r.url()).pathname.startsWith('/api/')) anfragen.push(r.url()); });
      await s.schalter.click();
      await expect(s.eingabe).toBeChecked();
      await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
      expect(await s.eingabe.evaluate(e => document.activeElement === e), 'Fokus auf dem Schalter').toBe(true);
      expect(await marker(), 'Kopf, Haken, Schalter und Kopfzeile sind dieselben Knoten').toEqual(Array(4).fill('vorab'));
      expect(await s.zustand()).toEqual(vorher);
      await s.schalter.click();
      await expect(s.eingabe).not.toBeChecked();
      await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(false);
      expect(await s.zustand()).toEqual(vorher);
      expect(await s.tabellenText(), 'Rundlauf: gleiche Zeilen und gleicher Text').toEqual(textVorher);
      expect(anfragen, 'keine Anfrage an den Server').toEqual([]);
    });
  }

  for (const breite of [980, 320]) {
    test(`AK 1: ${breite} px — die Lesezeile (über elementFromPoint) bleibt beim Ein- und Ausschalten an ihrer Stelle (≤ 36 px); sonst der Kopf der Datei`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, breite, 400);
      await s.commitOeffnen(k, 9, N().n1);
      const zeile = s.zeile('src/n.rs', '// n nach a 2');
      await expect(zeile).toBeAttached();
      await rollenAuf(zeile, 0);
      await zweiBilder(page);
      const kennung = await page.evaluate(() => {
        const r = document.getElementById('review').getBoundingClientRect(), b = document.querySelector('#review .dz-b');
        const x = b.getBoundingClientRect().left + parseFloat(getComputedStyle(b.firstElementChild).paddingLeft) + 4;
        const e = document.elementFromPoint(x, r.top + 1);
        const tr = e && e.closest('.df-sc tr');
        if (!tr || !tr.querySelector('[data-z]')) return { getroffen: e && `${e.tagName}.${e.className}` };
        return { n: Array.from(document.querySelectorAll('#review .df-sc')).indexOf(tr.closest('.df-sc')), z: Number(tr.querySelector('[data-z]').dataset.z) };
      });
      expect(JSON.stringify(kennung), "der Punkt an der Oberkante der Rolle trifft eine Zeile mit data-z").toMatch(/"z":\d+/);
      for (const an of [true, false]) {
        const davor = await lageNachKennung(page, kennung.n, kennung.z);
        expect(davor).toBeGreaterThanOrEqual(-1);
        expect(davor).toBeLessThanOrEqual(36);
        await s.eingabe.evaluate(e => e.click());
        if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
        await zweiBilder(page);
        const danach = await lageNachKennung(page, kennung.n, kennung.z);
        expect(Math.abs(danach - davor), `${an ? 'an' : 'aus'}: davor ${davor} danach ${danach}`).toBeLessThanOrEqual(36);
        await rollenAuf(page.locator('#review .df-sc').nth(kennung.n).locator(`[data-z="${kennung.z}"]`).first(), 0);
      }
      const kopf = s.datei('src/l.rs').locator('.df-k');
      await rollenAuf(kopf, 2);
      await zweiBilder(page);
      for (const an of [true, false]) {
        await s.eingabe.evaluate(e => e.click());
        if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
        await zweiBilder(page);
        const oben = await lage(kopf);
        expect(oben, `Kopf bei ${an ? 'an' : 'aus'}`).toBeGreaterThanOrEqual(0);
        expect(oben).toBeLessThan(36);
      }
    });
  }

  /* ── AK 2 Gegenüberstellung (US-2) ── */

  test('AK 2: K-Lauf — vier Zellen je Zeile; (a) eine Zeile, (b) drei, (c) links leer, (d) rechts leer; Hunk (b) 9 statt 11 Zeilen; Kontext beidseits mit data-z', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    const aus = await s.tabelle('src/n.rs');
    const hunkB = t => { const kopf = t.map((z, i) => [z, i]).filter(([z]) => z.k === 'hk')[1][1]; const ende = t.findIndex((z, i) => i > kopf && z.k === 'hk'); return t.slice(kopf + 1, ende < 0 ? t.length : ende).length; };
    expect(hunkB(aus), 'aus: 3 + 5 + 3').toBe(11);
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
    const t = await s.tabelle('src/n.rs');
    expect(hunkB(t), 'an: 3 + 3 + 3').toBe(9);
    const zeilen = t.filter(z => z.k !== 'hk');
    for (const z of zeilen) expect(z.zellen.map(c => c.k.split(' ')[0]), JSON.stringify(z)).toEqual(['n', 'c', 'n', 'c']);
    for (const kopf of t.filter(z => z.k === 'hk')) { expect(kopf.zellen.length).toBe(1); expect(kopf.zellen[0].s).toBe(4); expect(kopf.zellen[0].z).not.toBeNull(); }
    const seiten = z => [z.zellen[1].t.replace(/^(entfernt|hinzugefügt): /, ''), z.zellen[3].t.replace(/^(entfernt|hinzugefügt): /, '')];
    const finde = text => zeilen.findIndex(z => seiten(z).includes(text));
    const a = zeilen[finde('let a = 1;')];
    expect(seiten(a)).toEqual(['let a = 1;', 'let a = 2;']);
    expect(a.zellen[0].t).toBe('9');
    expect(a.zellen[2].t).toBe('9');
    const b = finde('p = 10;');
    expect(zeilen.slice(b, b + 3).map(seiten)).toEqual([['p = 10;', 'p = 11;'], ['q = 20;', 'q = 21;'], ['', 'r = 31;']]);
    const c = zeilen[finde('z = 0;')], d = zeilen[finde('y = 0;')];
    for (const [z, leer] of [[c, [0, 1]], [d, [2, 3]]]) for (const i of leer) {
      expect(z.zellen[i].t, 'leer: kein Text, keine Nummer').toBe('');
      expect(z.zellen[i].v, 'leer: aria-hidden').toBe(true);
      expect(z.zellen[i].z, 'leer: ohne data-z').toBeNull();
    }
    const kontext = zeilen[finde('// n nach b 2')];
    expect(kontext.zellen[1].t).toBe(kontext.zellen[3].t);
    expect(kontext.zellen[0].t).not.toBe('');
    expect(kontext.zellen[2].t).not.toBe('');
    expect(kontext.zellen[1].z).toBe(kontext.zellen[3].z);
    expect(zeilen.every(z => z.zellen.filter(c => c.k.startsWith('c') && !c.k.includes('lz')).every(c => c.z !== null)), 'jede Code-Zelle trägt data-z').toBe(true);
  });

  for (const thm of ['light', 'dark']) {
    test(`AK 2: ${thm} — die leere Seite ist eine Fläche --kd-sunken (Nummer und Code), ohne Rand dazwischen, anders als del/add gegenüber`, async ({ page }) => {
      const s = seite(page);
      await thema(page, thm);
      await s.commitOeffnen(k, 9, N().n1);
      await s.schalter.click();
      await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
      const m = await s.zeile('src/n.rs', 'z = 0;').evaluate(tr => {
        const st = c => getComputedStyle(c);
        const sunken = (() => { const p = document.createElement('i'); p.style.background = 'var(--kd-sunken)'; document.body.appendChild(p); const f = getComputedStyle(p).backgroundColor; p.remove(); return f; })();
        const [n, c, , gegen] = tr.cells;
        return { n: st(n).backgroundColor, c: st(c).backgroundColor, rand: st(n).borderRightWidth + '/' + st(c).borderLeftWidth, gegen: st(gegen).backgroundColor, sunken };
      });
      expect(m.n).toBe(m.sunken);
      expect(m.c).toBe(m.sunken);
      expect(m.rand).toBe('0px/0px');
      expect(m.gegen).not.toBe(m.sunken);
    });
  }

  test('AK 2: K-Datei — neu.rs links ganz leer, weg.rs rechts ganz leer; ende.rs eine Zeile und eine Hinweiszeile in beiden Spalten, enden.rs Hinweis nur links; Lesetexte und Kontrast', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
    const ohneKopf = t => t.filter(z => z.k !== 'hk');
    for (const pfad of ['src/neu.rs', 'src/weg.rs', 'src/ende.rs', 'src/enden.rs']) await s.oeffnen(pfad);
    const neu = ohneKopf(await s.tabelle('src/neu.rs'));
    expect(neu.length).toBe(4);
    expect(neu.every(z => z.zellen[0].t === '' && z.zellen[1].t === '' && z.zellen[1].v)).toBe(true);
    const weg = ohneKopf(await s.tabelle('src/weg.rs'));
    expect(weg.length).toBe(3);
    expect(weg.every(z => z.zellen[2].t === '' && z.zellen[3].t === '' && z.zellen[3].v)).toBe(true);
    const ende = ohneKopf(await s.tabelle('src/ende.rs'));
    expect(ende.map(z => z.k)).toEqual(['', '', 'nn']);
    const hinweis = ende[2].zellen;
    expect(hinweis[1].t).toBe('beide Fassungen: \\ No newline at end of file');
    expect(hinweis[3].t).toBe('\\ No newline at end of file');
    expect(hinweis[3].v, 'rechts einmal gelesen').toBe(true);
    expect(hinweis[0].v && hinweis[2].v).toBe(true);
    const enden = ohneKopf(await s.tabelle('src/enden.rs'));
    expect(enden.map(z => z.k)).toEqual(['', '', 'nn']);
    expect(enden[2].zellen[1].t).toBe('alte Fassung: \\ No newline at end of file');
    expect(enden[2].zellen[3].t).toBe('');
    const nn = s.bereich('src/ende.rs').locator('tr.nn td.c').first();
    const [farbe, grund, stil] = await nn.evaluate(c => [getComputedStyle(c).color, getComputedStyle(c).backgroundColor, getComputedStyle(c).fontStyle]);
    expect(stil, 'gedämpft').toBe('italic');
    expect(await kontrastFarben(page, farbe, grund === 'rgba(0, 0, 0, 0)' ? await page.evaluate(() => getComputedStyle(document.getElementById('review')).backgroundColor) : grund)).toBeGreaterThanOrEqual(4.5);
  });

  /* ── AK 3 Marke und Farbe (US-3) ── */

  test('AK 3: Marke links „1“, rechts „2“ wie bei „aus“; (b) ohne Marke; jedes Zeichen behält seine Farbe, auch nach dem Umschalten; Kontext beidseits gefärbt', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await farbeAbwarten(page, s.bereich('src/n.rs'));
    const aus = { alt: s.bereich('src/n.rs').locator('tr.del td.c').filter({ hasText: 'let a = 1;' }), neu: s.bereich('src/n.rs').locator('tr.add td.c').filter({ hasText: 'let a = 2;' }) };
    const ausMarken = [await marken(aus.alt), await marken(aus.neu)];
    const ausFarben = [await zeichenFarben(aus.alt), await zeichenFarben(aus.neu)];
    const kontextAus = await zeichenFarben(s.zeile('src/n.rs', '// n nach b 2').locator('td.c'));
    expect(ausMarken).toEqual([['1'], ['2']]);
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
    await expect(s.bereich('src/n.rs')).toHaveAttribute('data-farbe', 'ja', { timeout: 15000 });
    const zeile = s.zeile('src/n.rs', 'let a = 1;');
    const [l, r] = [zeile.locator('td.c').nth(0), zeile.locator('td.c').nth(1)];
    expect([await marken(l), await marken(r)]).toEqual(ausMarken);
    expect([await zeichenFarben(l), await zeichenFarben(r)]).toEqual(ausFarben);
    const b = s.zeile('src/n.rs', 'p = 10;');
    expect(await b.locator('mark.wm').count(), '(b) ungleich lange Läufe ohne Marke').toBe(0);
    const kontext = s.zeile('src/n.rs', '// n nach b 2').locator('td.c');
    expect(await kontext.count()).toBe(2);
    expect(await zeichenFarben(kontext.nth(0)), 'links gefärbt wie bei „aus“').toEqual(kontextAus);
    expect(await zeichenFarben(kontext.nth(1)), 'rechts gefärbt wie links').toEqual(kontextAus);
    expect(await kontext.nth(0).locator('[class^="tk-"]').count()).toBeGreaterThan(0);
    // ohne bekannte Endung: ohne Farbe, mit derselben Marke wie bei „aus“ (die Auflage überdeckt hier nichts)
    await expect(s.bereich('src/n.xyz')).toHaveAttribute('data-farbe', 'nein');
    const ohne = s.zeile('src/n.xyz', 'let a = 1;').locator('td.c');
    expect([await marken(ohne.nth(0)), await marken(ohne.nth(1))]).toEqual([['1'], ['2']]);
    expect(await ohne.nth(0).locator('mark.wm').evaluate(m => m.parentElement.textContent)).toBe('entfernt: let a = 1;');
  });

  /* ── AK 4 Text, Sprung, Ansage (US-2) ── */

  test('AK 4: Auswahl ohne Nummer und Zeichen; Lesetexte; Kontext einmal im Zugänglichkeitsbaum; Spaltenköpfe; nur die neue Nummer springt', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    const ausBaum = await s.bereich('src/n.rs').ariaSnapshot();
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
    const zeile = s.zeile('src/n.rs', 'let a = 1;');
    const auswahl = i => zeile.locator('td.c').nth(i).evaluate(c => {
      const r = document.createRange(), lesen = c.querySelector('.vh');
      r.selectNodeContents(c);
      if (lesen) r.setStartAfter(lesen);
      const a = getSelection(); a.removeAllRanges(); a.addRange(r);
      return a.toString();
    });
    expect(await auswahl(0)).toBe('let a = 1;');
    expect(await auswahl(1)).toBe('let a = 2;');
    const baum = await s.bereich('src/n.rs').ariaSnapshot();
    expect(baum).toMatch(/entfernt: let a = 1;[\s\S]*hinzugefügt: let a = 2;/);
    expect(baum).toContain('alte Fassung');
    expect(baum).toContain('neue Fassung');
    expect(baum.split('\n').filter(z => /- cell "\/\/ n nach b 2"/.test(z)).length, 'Kontextzeile einmal (eine Zelle)').toBe(1);
    const eintraege = text => text.split('\n').filter(z => /^\s*- (cell|gridcell|text)/.test(z)).length;
    expect(eintraege(baum), `an ${eintraege(baum)} ≤ aus ${eintraege(ausBaum)}`).toBeLessThanOrEqual(eintraege(ausBaum));
    expect(baum).not.toMatch(/- cell "\d+"/);
    const nummern = await zeile.evaluate(tr => [tr.cells[0], tr.cells[2]].map(c => ({ k: c.className, title: c.getAttribute('title') })));
    expect(nummern[0].k).not.toContain('ru-nk');
    expect(nummern[0].title).toBeNull();
    expect(nummern[1].k).toContain('ru-nk');
    expect(nummern[1].title).toBe('In VS Code an Zeile 9 öffnen');
    await expect(s.bereich('src/n.rs')).toHaveAttribute('data-vsc', /^vscode:\/\/file\//);
  });

  /* ── AK 5 Merken (US-5) ── */

  test('AK 5: „an“ bleibt nach Neuladen, neuem Tab, Blättern, Ansichtswechsel und anderer Aufgabe; neuer Kontext aus; „aus“ bleibt aus', async ({ page, browser, context }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    await page.reload();
    await expect(s.eingabe).toBeChecked();
    await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
    const zweite = await context.newPage();
    const s2 = seite(zweite);
    await s2.commitOeffnen(k, 9, N().n1);
    await expect(s2.eingabe).toBeChecked();
    await s2.commitOeffnen(k, 10, N().n2);
    await expect(s2.eingabe).toBeChecked();
    expect(await s2.nebeneinander('src/g.rs')).toBe(true);
    await s2.alleOeffnen(k, 9);
    await expect(s2.eingabe).toBeChecked();
    expect(await s2.nebeneinander('src/n.rs')).toBe(true);
    await zweite.close();
    const fremd = await browser.newContext();
    const fremdSeite = await fremd.newPage();
    await alsPerson(fremdSeite, 'sh');
    const s3 = seite(fremdSeite);
    await s3.commitOeffnen(k, 9, N().n1);
    await expect(s3.eingabe).not.toBeChecked();
    expect(await s3.nebeneinander('src/n.rs')).toBe(false);
    await fremd.close();
    await s.schalter.click();
    await expect(s.eingabe).not.toBeChecked();
    await page.reload();
    await expect(s.eingabe).not.toBeChecked();
    expect(await s.nebeneinander('src/n.rs')).toBe(false);
  });

  test('AK 5: wirft localStorage, bleibt die Seite bedienbar, der Schalter wirkt bis zum Neuladen, ohne Meldung und Konsolenfehler', async ({ page }) => {
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    await page.addInitScript(() => {
      const gesperrt = k => k === 'kanbanD.nebeneinander';
      const lesen = Storage.prototype.getItem, schreiben = Storage.prototype.setItem;
      Storage.prototype.getItem = function (k) { if (gesperrt(k)) throw new Error('gesperrt'); return lesen.call(this, k); };
      Storage.prototype.setItem = function (k, v) { if (gesperrt(k)) throw new Error('voll'); return schreiben.call(this, k, v); };
    });
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await expect(s.eingabe).not.toBeChecked();
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    await expect.poll(() => s.nebeneinander('src/n.rs'), 'wirkt bis zum Neuladen').toBe(true);
    await page.locator('#rv-u-alle').click();
    await page.locator('#rv-insel section.df').first().waitFor();
    await expect(s.eingabe).toBeChecked();
    expect(await s.nebeneinander('src/n.rs')).toBe(true);
    await expect(page.getByText(/gespeichert|Speicher|Einstellung/i)).toHaveCount(0);
    expect(fehler, 'kein Konsolenfehler').toEqual([]);
  });

  /* ── AK 6 Lange Zeilen (US-4) ── */

  test('AK 6: 980 px, „Umbrechen“ aus — der Code scrollt quer, beide Spalten gleich breit und gemeinsam, eine Textzeile hoch, nichts abgeschnitten', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 9, N().n1);
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/l.rs')).toBe(true);
    const bereich = s.bereich('src/l.rs');
    const [sw, cw] = await bereich.evaluate(b => [b.scrollWidth, b.clientWidth]);
    expect(sw, 'der Code scrollt quer').toBeGreaterThan(cw);
    const zeile = s.zeile('src/l.rs', UM_A);
    const m = await zeile.evaluate(tr => ({ links: tr.cells[1].getBoundingClientRect().width, rechts: tr.cells[3].getBoundingClientRect().width, hoehe: tr.getBoundingClientRect().height, ueber: getComputedStyle(tr.cells[3]).overflowX }));
    expect(Math.abs(m.links - m.rechts), JSON.stringify(m)).toBeLessThanOrEqual(1);
    expect(m.hoehe).toBeLessThanOrEqual(19);
    expect(m.ueber).not.toBe('hidden');
    const verschiebung = await zeile.evaluate(tr => {
      const b = tr.closest('.df-sc'), l0 = tr.cells[1].getBoundingClientRect().left, r0 = tr.cells[3].getBoundingClientRect().left;
      b.scrollLeft = 300;
      return [l0 - tr.cells[1].getBoundingClientRect().left, r0 - tr.cells[3].getBoundingClientRect().left];
    });
    expect(verschiebung[0], 'beide Spalten gemeinsam').toBe(verschiebung[1]);
    expect(verschiebung[0]).toBeGreaterThan(0);
    for (const text of [UM_A, UM_B]) {
      const erreichbar = await s.zeile('src/l.rs', text).evaluate(tr => {
        const c = tr.cells[3], b = c.closest('.df-sc');
        b.scrollLeft = b.scrollWidth;
        const r = document.createRange(), t = c.lastChild.nodeType === 3 ? c.lastChild : c.lastChild.lastChild || c.lastChild;
        r.setStart(t, Math.max(0, t.length - 1)); r.setEnd(t, t.length);
        return r.getBoundingClientRect().right <= b.getBoundingClientRect().right + 0.5;
      });
      expect(erreichbar, `das Ende von ${text.slice(0, 12)}… ist erreichbar`).toBe(true);
    }
    expect(await seitenQuer(page)).toBe(true);
  });

  test('AK 6: 980 px, „Umbrechen“ an — nichts scrollt quer, Spalten gleich breit, Zeile so hoch wie die höhere Seite, Nummern und leere Zellen oben, Text wie bei „aus“', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 9, N().n1);
    const textAus = await s.zeile('src/l.rs', UM_A).locator('td.c').innerText();
    await s.umbrechen.check();
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/l.rs')).toBe(true);
    const [sw, cw] = await s.bereich('src/l.rs').evaluate(b => [b.scrollWidth, b.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
    const zeile = s.zeile('src/l.rs', UM_A);
    const rechtsZeilen = await textZeilen(zeile.locator('td.c').nth(1));
    const m = await zeile.evaluate(tr => ({ links: tr.cells[1].getBoundingClientRect().width, rechts: tr.cells[3].getBoundingClientRect().width, hoehe: tr.getBoundingClientRect().height, nTop: tr.cells[0].getBoundingClientRect().top - tr.getBoundingClientRect().top, nText: (() => { const r = document.createRange(); r.selectNodeContents(tr.cells[0]); return r.getClientRects()[0].top - tr.getBoundingClientRect().top; })() }));
    expect(Math.abs(m.links - m.rechts), JSON.stringify(m)).toBeLessThanOrEqual(1);
    expect(rechtsZeilen).toBeGreaterThan(1);
    expect(Math.abs(m.hoehe - rechtsZeilen * 18), `Höhe ${m.hoehe} gegen ${rechtsZeilen} × 18`).toBeLessThanOrEqual(1);
    expect(m.nText, 'Nummer oben').toBeLessThanOrEqual(2);
    expect(await textZeilen(s.zeile('src/l.rs', UM_B).locator('td.c').nth(1)), '(b) ohne Leerzeichen bricht um').toBeGreaterThan(1);
    const leerOben = await s.zeile('src/l.rs', UM_B).evaluate(tr => tr.cells[0].getBoundingClientRect().top - tr.getBoundingClientRect().top);
    expect(leerOben).toBeLessThanOrEqual(1);
    expect(await zeile.locator('td.c').nth(1).innerText()).toBe(textAus);
  });

  /* ── AK 7 Breiten und Kontrast (US-6) ── */

  for (const thm of ['light', 'dark', 'system-dark']) {
    test(`AK 7: ${thm} — 320, 414, 980, 1280 px: die Seite scrollt nie quer (Umbrechen aus und an), Schalter sichtbar und aus; del/add ≥ 4,5:1; Marke wie bei „aus“`, async ({ page }) => {
      const s = seite(page);
      if (thm === 'system-dark') await page.emulateMedia({ colorScheme: 'dark' }); else await thema(page, thm);
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite, 800);
        await s.commitOeffnen(k, 9, N().n1);
        await farbeAbwarten(page, s.bereich('src/n.rs'));
        await expect(s.schalter).toBeVisible();
        await expect(s.eingabe).not.toBeChecked();
        await expect(s.eingabe).toBeEnabled();
        const ausMarke = await s.bereich('src/n.rs').locator('tr.del mark.wm').first().evaluate(m => [getComputedStyle(m).backgroundColor, getComputedStyle(m).boxShadow, getComputedStyle(m).color]);
        await s.schalter.click();
        await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
        for (const umbr of [false, true]) {
          if (umbr) await s.umbrechen.check(); else await s.umbrechen.uncheck();
          expect(await seitenQuer(page), `${breite} ${umbr ? 'an' : 'aus'}: Seite`).toBe(true);
          if (umbr) for (const [bsw, bcw] of await page.locator('#rv-insel .df-sc').evaluateAll(l => l.map(e => [e.scrollWidth, e.clientWidth]))) expect(bsw, `${breite} an: Code`).toBeLessThanOrEqual(bcw);
        }
        const zelle = s.zeile('src/n.rs', 'let a = 1;').locator('td.c');
        for (const i of [0, 1]) {
          const [farbe, grund] = await zelle.nth(i).evaluate(c => [getComputedStyle(c).color, getComputedStyle(c).backgroundColor]);
          expect(await kontrastFarben(page, farbe, grund), `${breite} ${i ? 'add' : 'del'}`).toBeGreaterThanOrEqual(4.5);
          const marke = await zelle.nth(i).locator('mark.wm').evaluate(m => [getComputedStyle(m).color, getComputedStyle(m).backgroundColor]);
          expect(await kontrastFarben(page, marke[0], marke[1]), 'Marke ≥ 4,5:1').toBeGreaterThanOrEqual(4.5);
        }
        expect(await zelle.nth(0).locator('mark.wm').evaluate(m => [getComputedStyle(m).backgroundColor, getComputedStyle(m).boxShadow, getComputedStyle(m).color]), 'Marke wie bei „aus“').toEqual(ausMarke);
        if (breite === 320) {
          await s.umbrechen.check();
          const m = await s.zeile('src/l.rs', UM_A).evaluate(tr => {
            const e = document.createElement('span'); e.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;font:inherit'; e.textContent = 'x'.repeat(100); tr.cells[3].appendChild(e);
            const w = e.getBoundingClientRect().width / 100; e.remove();
            return { nummer: tr.cells[2].getBoundingClientRect().width, code: tr.cells[3].clientWidth, zeichen: w, hoehe: tr.getBoundingClientRect().height };
          });
          expect(Math.round(m.nummer), JSON.stringify(m)).toBe(34);
          expect(m.code, JSON.stringify(m)).toBeGreaterThanOrEqual(14 * m.zeichen);
          expect(m.hoehe, 'K-Lang (a) höchstens 32 Textzeilen').toBeLessThanOrEqual(32 * 18);
        }
        await s.umbrechen.uncheck();
        await s.schalter.click();
        await expect(s.eingabe).not.toBeChecked();
      }
    });
  }

  test('AK 7: Tab erreicht den Schalter direkt nach „Umbrechen“, Leertaste schaltet, Rolle switch, Fokusring ganz sichtbar; Form und Rand an/aus', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    await s.umbrechen.focus();
    await page.keyboard.press('Tab');
    await expect(s.eingabe).toBeFocused();
    await expect(page.getByRole('switch', { name: 'Nebeneinander', exact: true })).not.toBeChecked();
    const messen = () => s.eingabe.evaluate(e => { const st = getComputedStyle(e); return { form: st.backgroundPosition, farbe: st.backgroundColor, rand: st.borderTopColor, grund: getComputedStyle(e.closest('.rv-leiste')).backgroundColor }; });
    const aus = await messen();
    await page.keyboard.press('Space');
    await expect(page.getByRole('switch', { name: 'Nebeneinander', exact: true })).toBeChecked();
    await expect(s.eingabe).toBeFocused();
    const an = await messen();
    expect(an.form).not.toBe(aus.form);
    for (const m of [aus, an]) expect(await kontrastFarben(page, m.rand, m.grund)).toBeGreaterThanOrEqual(3);
    const ring = await s.eingabe.evaluate(e => {
      const st = getComputedStyle(e), r = e.getBoundingClientRect(), a = document.getElementById('review').getBoundingClientRect();
      const aussen = (parseFloat(st.outlineOffset) || 0) + (parseFloat(st.outlineWidth) || 0);
      return { stil: st.outlineStyle, drin: r.left - aussen >= a.left && r.right + aussen <= a.right && r.top - aussen >= a.top && r.bottom + aussen <= a.bottom };
    });
    expect(ring.stil).not.toBe('none');
    expect(ring.drin).toBe(true);
  });

  test.describe('grober Zeiger', () => {
    test.use({ hasTouch: true });
    test('AK 7: Touch bei 320 px — das Label ist mindestens 48 px hoch, steht im Fenster und verbreitert die Seite nicht', async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, 320, 800);
      await s.commitOeffnen(k, 9, N().n1);
      await expect(s.schalter).toBeVisible();
      const messen = () => s.schalter.evaluate(l => { const r = l.getBoundingClientRect(); return { hoehe: r.height, rechts: r.right, breite: innerWidth }; });
      await expect.poll(async () => (await messen()).hoehe, 'Zielfläche des Labels').toBeGreaterThanOrEqual(48);
      const m = await messen();
      expect(m.rechts).toBeLessThanOrEqual(m.breite);
      expect(await seitenQuer(page)).toBe(true);
    });
  });

  /* ── AK 8 Budget, Alle Änderungen und Blockgrenze ── */

  test('AK 8: Alle Änderungen — dieselben Dateien offen wie bei „aus“; (a) in kd und wb je eine Zeile mit Marke „1“/„2“', async ({ page }) => {
    const s = seite(page);
    const beideGeladen = async () => {
      await expect(page.locator('#rv-insel .rv-abs')).toHaveCount(2);
      await expect(page.locator('#rv-insel .rv-abs[aria-busy]')).toHaveCount(0);
      await expect(page.locator('#rv-insel .rv-abs').nth(1).locator('.rv-gk').first()).toBeAttached();
    };
    await s.alleOeffnen(k, 9);
    await beideGeladen();
    const offenAus = (await s.zustand()).dateien;
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/n.rs')).toBe(true);
    await page.reload();
    await page.locator('#rv-insel section.df').first().waitFor();
    await beideGeladen();
    await expect(s.eingabe).toBeChecked();
    expect((await s.zustand()).dateien, 'Budget zählt die Zeilen der Liste').toEqual(offenAus);
    await s.dokuOeffnen();
    for (const pfad of ['src/n.rs', 'docs/n.md']) {
      const zeile = s.zeile(pfad, 'let a = 1;');
      expect([await marken(zeile.locator('td.c').nth(0)), await marken(zeile.locator('td.c').nth(1))], pfad).toEqual([['1'], ['2']]);
    }
  });

  test('AK 8: K-Block — der Lauf über die Blockgrenze steht in drei Tabellenzeilen, alle sechs tragen eine Marke', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 10, N().n2);
    await s.schalter.click();
    await expect.poll(() => s.nebeneinander('src/g.rs')).toBe(true);
    const paare = await s.bereich('src/g.rs').evaluate(b => Array.from(b.querySelectorAll('tr'), tr => Array.from(tr.querySelectorAll('td.c'), c => [c.textContent.replace(/^(entfernt|hinzugefügt): /, ''), c.querySelectorAll('mark.wm').length])).filter(z => z.length === 2 && /^d\d = /.test(z[0][0])));
    expect(paare.map(z => z.map(c => c[0]))).toEqual([['d1 = 1;', 'd1 = 2;'], ['d2 = 1;', 'd2 = 2;'], ['d3 = 1;', 'd3 = 2;']]);
    expect(paare.flat().every(c => c[1] === 1)).toBe(true);
  });

  /* ── AK 9 Tempo und Leseposition bei 10.000 Zeilen (US-6): Messung mit Ausgabe, Grenze nach der Messung ── */

  test('AK 9: K-Last — Umschalten und Scrollen ohne Long Task über 150 ms, 5.000 Tabellenzeilen; die Lesezeile bleibt (30 Wiederholungen)', async ({ page }) => {
    test.setTimeout(240000);
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await page.addInitScript(langeAufgabenSammeln);
    await s.commitOeffnen(k, 11, N().n4);
    await s.datei('src/gross.rs').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(s.bereich('src/gross.rs').locator('tr.add').first()).toBeVisible();
    await farbeAbwarten(page, s.bereich('src/gross.rs'));
    await zweiBilder(page);
    const laengste = t => page.evaluate(von => Math.max(0, ...window.kdLang.filter(e => e.start >= von).map(e => e.dauer)), t);
    const jetzt = () => page.evaluate(() => performance.now());
    const bisEnde = () => page.evaluate(() => new Promise(fertig => {
      const r = document.getElementById('review');
      r.scrollTop = 0;
      const schritt = () => { const vorher = r.scrollTop; r.scrollTop += r.clientHeight * 0.8; if (r.scrollTop === vorher) fertig(); else requestAnimationFrame(schritt); };
      requestAnimationFrame(schritt);
    }));
    const t0 = await jetzt();
    await s.schalter.click();
    await expect(s.eingabe).toBeChecked();
    await expect.poll(() => s.nebeneinander('src/gross.rs')).toBe(true);
    await zweiBilder(page);
    const umschalten = await laengste(t0);
    expect(await s.bereich('src/gross.rs').evaluate(b => b.querySelectorAll('tbody tr, table > tr').length - b.querySelectorAll('tr.hk').length), '5.000 Tabellenzeilen').toBe(5000);
    const t1 = await jetzt();
    await bisEnde();
    await zweiBilder(page);
    const scrollen = await laengste(t1);
    const t2 = await jetzt();
    await s.schalter.click();
    await expect(s.eingabe).not.toBeChecked();
    await zweiBilder(page);
    const zurueck = await laengste(t2);
    // Lesezeile: eine Zeile in der Mitte der Datei oben im Bild, 30-mal hin und her
    const versatz = [];
    for (let i = 0; i < 30; i++) {
      const z = 1001 + 2 * (i * 37 % 4000);
      const zelle = page.locator(`#review .df-sc [data-z="${z}"]`).first();
      await rollenAuf(zelle, 10);
      await zweiBilder(page);
      const n = await zelle.evaluate(c => Array.from(document.querySelectorAll('#review .df-sc')).indexOf(c.closest('.df-sc')));
      const davor = await lageNachKennung(page, n, z);
      await s.eingabe.evaluate(e => e.click());
      await zweiBilder(page);
      versatz.push(Math.abs((await lageNachKennung(page, n, z)) - davor));
    }
    const messung = { umschalten, scrollen, zurueck, groessterVersatz: Math.max(...versatz), workers: test.info().config.workers };
    test.info().annotations.push({ type: 'AK 9 Messung', description: JSON.stringify(messung) });
    console.log(`AK 9 Messung ${JSON.stringify(messung)}`);
    if (process.env.KD_MESS_AUS) fs.appendFileSync(process.env.KD_MESS_AUS, JSON.stringify(messung) + '\n');
    expect(Math.max(...versatz), 'Lesezeile ≤ 36 px').toBeLessThanOrEqual(36);
    expect(Math.max(umschalten, scrollen, zurueck), 'Long Task').toBeLessThanOrEqual(150);
  });

  /* ── ADR-0042 N7.4 P8: Hinaufrollen nach frischem Laden in „Nebeneinander“, „Umbrechen“ an und aus ── */

  for (const [breite, umbr] of [[980, true], [320, true], [980, false]]) {
    test(`N7.4 P8: K-Last frisch geladen nebeneinander, „Umbrechen“ ${umbr ? 'an' : 'aus'}, ${breite} px — ans Ende gesprungen, in 400-px-Schritten hinauf: größter Sprung ≤ 36 px`, async ({ page }) => {
      test.setTimeout(240000);
      const s = seite(page);
      await breiteSetzen(page, breite, 800);
      await page.addInitScript(wert => { localStorage.setItem('kanbanD.nebeneinander', '1'); localStorage.setItem('kanbanD.umbrechen', wert); }, umbr ? '1' : '0');
      await s.commitOeffnen(k, 11, N().n4);
      await expect(s.eingabe).toBeChecked();
      await s.datei('src/gross.rs').getByRole('button', { name: 'Änderungen anzeigen' }).click();
      await expect(s.bereich('src/gross.rs').locator('table.ru-nb').first()).toBeAttached();
      await farbeAbwarten(page, s.bereich('src/gross.rs'));
      await zweiBilder(page);
      await page.evaluate(async () => {
        const r = document.getElementById('review');
        const bild = () => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        r.scrollTop = r.scrollHeight; await bild();
        r.scrollTop = r.scrollHeight; await bild();
      });
      const m = await page.evaluate(async () => {
        const r = document.getElementById('review');
        const bild = () => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig)));
        const mitte = () => {
          const q = r.getBoundingClientRect(), b = document.querySelector('#review .dz-b');
          const z = document.elementFromPoint(b.getBoundingClientRect().left + 20, q.top + q.height / 2);
          const tr = z && z.closest('#rv-insel tr');
          return tr ? { tr, top: tr.getBoundingClientRect().top - q.top } : null;
        };
        let groesster = 0, schritte = 0, gemessen = 0;
        while (schritte < 450 && r.scrollTop > 400) {
          const vorher = mitte();
          r.scrollTop -= 400;
          await bild();
          schritte++;
          if (!vorher) continue;
          gemessen++;
          groesster = Math.max(groesster, Math.abs(vorher.tr.getBoundingClientRect().top - r.getBoundingClientRect().top - vorher.top - 400));
        }
        return { groesster: Math.round(groesster), schritte, gemessen };
      });
      console.log(`N7.4 P8 ${JSON.stringify({ breite, umbr, ...m })}`);
      expect(m.gemessen, 'genug Schritte mit Zeuge').toBeGreaterThanOrEqual(umbr ? 100 : 150);
      expect(m.groesster, 'größter Sprung der Zeile in der Fenstermitte').toBeLessThanOrEqual(36);
    });
  }

  /* ── AK 10 Bestand bei „aus“ ── */

  test('AK 10: bei „aus“ wie vor der Karte — Tabelle mit Spalte „+/−“, Zeilen tr.add/tr.del, kein ru-nb, Schätzung --bb', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, N().n1);
    const aus = await s.bereich('src/n.rs').evaluate(b => ({ nb: b.querySelectorAll('.ru-nb').length, m: b.querySelectorAll('td.m').length, add: b.querySelectorAll('tr.add').length, del: b.querySelectorAll('tr.del').length, stil: b.querySelector('.dz-b').getAttribute('style') }));
    expect(aus.nb).toBe(0);
    expect(aus.m).toBeGreaterThan(0);
    expect([aus.add, aus.del]).toEqual([5, 4]);
    expect(aus.stil).toMatch(/^--bb:\d+px;contain-intrinsic-block-size:auto \d+px$/);
  });
});
