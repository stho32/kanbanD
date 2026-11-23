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

/** Hängt K3b über die API an Aufgabe #3 (wie ein Agent, der einen Commit hinterlegt). */
async function k3bAnhaengen(page, k, h) {
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/3/commits`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { commits: [`kd:${h.k3b}`] } });
  expect(antwort.ok()).toBe(true);
}

/** Speicher gesperrt: schon der Zugriff auf `localStorage` wirft (privates Fenster, gesperrte Website-Daten). */
function speicherGesperrt() {
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('gesperrt', 'SecurityError'); } });
}

/** Der Speicher wirft genau beim ersten Schreiben eines Schlüssels „Gesehen“ (Kontingent kurz voll), danach nicht mehr. */
function ersterSchreibfehler() {
  const setzen = Storage.prototype.setItem;
  let geworfen = false;
  Storage.prototype.setItem = function (schluessel, wert) {
    if (!geworfen && String(schluessel).startsWith('kanbanD.gesehen.')) { geworfen = true; throw new DOMException('voll', 'QuotaExceededError'); }
    return setzen.call(this, schluessel, wert);
  };
}

/** Kontrast des Rands eines nativ gezeichneten Kästchens gegen den Grund daneben: Bildschirmfoto des Labels, im Browser dekodiert;
    Grund ist das Pixel links oben im Label, gemessen wird das Pixel im Kästchen mit dem größten Abstand dazu. */
async function kaestchenRandKontrast(page, label) {
  const bild = (await label.screenshot({ animations: 'disabled' })).toString('base64');
  const box = await label.evaluate(l => { const a = l.getBoundingClientRect(), i = l.querySelector('input').getBoundingClientRect(); return { x: i.x - a.x, y: i.y - a.y, w: i.width, h: i.height, dpr: devicePixelRatio }; });
  return page.evaluate(async ([daten, b]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${daten}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const lum = ([r, gr, bl]) => { const k = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * k(r) + 0.7152 * k(gr) + 0.0722 * k(bl); };
    const grund = lum(g.getImageData(1, 1, 1, 1).data);
    const d = g.getImageData(Math.round(b.x * b.dpr), Math.round(b.y * b.dpr), Math.round(b.w * b.dpr), Math.round(b.h * b.dpr)).data;
    let best = 1;
    for (let p = 0; p < d.length; p += 4) {
      const l = lum([d[p], d[p + 1], d[p + 2]]);
      best = Math.max(best, (Math.max(l, grund) + 0.05) / (Math.min(l, grund) + 0.05));
    }
    return best;
  }, [bild, box]);
}

/** Zählt Textänderungen am Statusknoten des Satzes zum Speicher (der Knoten muss derselbe bleiben). */
async function speicherSatzZaehlen(page) {
  await page.evaluate(() => {
    const knoten = document.getElementById('rv-gesehen-speicher');
    window.kdSatz = { knoten, texte: [] };
    new MutationObserver(() => window.kdSatz.texte.push(knoten.textContent)).observe(knoten, { childList: true, characterData: true, subtree: true });
  });
  return {
    texte: () => page.evaluate(() => window.kdSatz.texte.slice()),
    derselbe: () => page.evaluate(() => window.kdSatz.knoten === document.getElementById('rv-gesehen-speicher')),
  };
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
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
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

  /* ── AK 2 Dauerhaft im Browser, nichts zum Server (US-2) ── */

  test('AK 2/US-2: zwei Haken überleben Neuladen und neuen Tab, nicht einen neuen Kontext; ein Schlüssel je Board und Karte; nur GET', async ({ page, context, browser }) => {
    const s = seite(page), board = '#/board/entwicklung';
    const methoden = [];
    page.on('request', anfrage => { if (anfrage.url().startsWith(k.adresse)) methoden.push(anfrage.method()); });
    const commitsVorher = k.git('rev-list', '--count', 'HEAD');
    await commitOeffnen(page, k, 1, h.kArt, board);
    await s.kaestchen('web/kd-app.css').click();
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    for (const pfad of ['web/kd-app.css', 'e2e/einheit/kontrast.test.js']) {
      expect(await s.offen(pfad), pfad).toBe(false);
      await expect(s.kaestchen(pfad)).toBeChecked();
    }
    expect(await s.offen('e2e/einheit/sperrform.test.js')).toBe(true);

    const gespeichert = await s.speicher();
    expect(Object.keys(gespeichert)).toEqual(['kanbanD.gesehen.entwicklung.1']);
    const wert = JSON.parse(gespeichert['kanbanD.gesehen.entwicklung.1']);
    expect(typeof wert.zeit).toBe('number');
    expect(wert.gesehen.sort()).toEqual([`${h.kArt}\u0000e2e/einheit/kontrast.test.js`, `${h.kArt}\u0000web/kd-app.css`]);

    const tab = await context.newPage();
    await commitOeffnen(tab, k, 1, h.kArt, board);
    await expect(seite(tab).zeileText()).toHaveText('2 von 8 gesehen');
    await commitOeffnen(tab, k, 1, h.kArt, '#/board/zweites');
    await expect(seite(tab).zeileText()).toHaveText('0 von 8 gesehen');
    await commitOeffnen(tab, k, 201, h.kArt, board);
    await expect(seite(tab).zeileText()).toHaveText('0 von 8 gesehen');
    await tab.close();

    const fremd = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await mutanteEinsetzen(fremd);
    const andere = await fremd.newPage();
    await alsPerson(andere, 'sh');
    await commitOeffnen(andere, k, 1, h.kArt, board);
    await expect(seite(andere).zeileText()).toHaveText('0 von 8 gesehen');
    await fremd.close();

    expect(methoden.filter(m => m !== 'GET')).toEqual([]);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commitsVorher);
    expect(fehler).toEqual([]);
  });

  test('AK 2/FA 8: ein anderer Commit derselben Datei — src/a.rs gesehen in K3, ungesehen in K3b', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 3, h.k3);
    await s.kaestchen('src/a.rs').click();
    await expect(s.zeileText()).toHaveText('1 von 3 gesehen');
    await k3bAnhaengen(page, k, h);
    await commitOeffnen(page, k, 3, h.k3b);
    await expect(s.kaestchen('src/a.rs')).not.toBeChecked();
    await expect(s.zeileText()).toHaveText('0 von 1 gesehen');
    expect(await s.offen('src/a.rs')).toBe(true);
  });

  /* ── AK 3 Gesehene zählen nicht ins Zeichenbudget (US-3) ── */

  test('AK 3/US-3: K-Budget — ohne Haken b, e, f, c offen; b und e gesehen und neu geladen: f, c und g offen (7.501), b und e zu', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 4, h.kBudget);
    const offen = async () => Object.fromEntries(await Promise.all(['src/b.rs', 'src/d.rs', 'src/e.rs', 'src/f.rs', 'tests/c.rs', 'tests/g.rs'].map(async p => [p, await s.offen(p)])));
    expect(await offen()).toEqual({ 'src/b.rs': true, 'src/d.rs': false, 'src/e.rs': true, 'src/f.rs': true, 'tests/c.rs': true, 'tests/g.rs': false });
    await s.kaestchen('src/b.rs').click();
    await s.kaestchen('src/e.rs').click();
    await expect(s.zeileText()).toHaveText('2 von 7 gesehen');
    await neuLaden(page);
    expect(await offen()).toEqual({ 'src/b.rs': false, 'src/d.rs': false, 'src/e.rs': false, 'src/f.rs': true, 'tests/c.rs': true, 'tests/g.rs': true });
    await expect(s.datei('tests/g.rs').locator('.df-zu')).toHaveCount(0);
    await s.gruppenkopf('doku').click();
    expect(await s.offen('Dokumentation/a.md')).toBe(true);
  });

  /* ── AK 4 „Alle aufklappen“, Dateiliste, Entfernen (US-4) ── */

  test('AK 4/US-4: K-Art mit zwei Haken — „Alle aufklappen“ öffnet auch gesehene, Haken bleiben; Klappknopf, Neuladen, Klick in der Liste', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await s.kaestchen('web/kd-app.css').click();
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await neuLaden(page);
    await expect(s.alleKnopf()).toHaveText('Alle einklappen');
    await s.alleKnopf().click();
    await expect(s.alleKnopf()).toHaveText('Alle aufklappen');
    await s.alleKnopf().click();
    for (const pfad of K_ART_DATEIEN) expect(await s.offen(pfad), pfad).toBe(true);
    for (const art of ['code', 'test', 'doku']) await expect(s.gruppenkopf(art)).toHaveAttribute('aria-expanded', 'true');
    await expect(s.kaestchen('web/kd-app.css')).toBeChecked();
    await expect(s.kaestchen('e2e/einheit/kontrast.test.js')).toBeChecked();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    await s.alleKnopf().click();
    for (const pfad of K_ART_DATEIEN) expect(await s.offen(pfad), pfad).toBe(false);
    for (const art of ['code', 'test', 'doku']) await expect(s.gruppenkopf(art)).toHaveAttribute('aria-expanded', 'true');

    await s.zeile('e2e/einheit/kontrast.test.js').click();
    expect(await s.offen('e2e/einheit/kontrast.test.js')).toBe(true);
    await expect(s.klappe('e2e/einheit/kontrast.test.js')).toBeFocused();
    await expect(s.klappe('e2e/einheit/kontrast.test.js')).toBeInViewport();
    await expect(s.kaestchen('e2e/einheit/kontrast.test.js')).toBeChecked();

    await s.klappe('web/kd-app.css').click();
    expect(await s.offen('web/kd-app.css')).toBe(true);
    await s.klappe('web/kd-app.css').click();
    expect(await s.offen('web/kd-app.css')).toBe(false);
    await s.klappe('web/kd-app.css').click();
    await expect(s.kaestchen('web/kd-app.css')).toBeChecked();
    await neuLaden(page);
    expect(await s.offen('web/kd-app.css')).toBe(false);
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    expect(fehler).toEqual([]);
  });

  test('AK 4/FA 4: K-Rand — genau-501.json angehakt und wieder entfernt bleibt zu mit ihrem Satz; eine Datei mit Code öffnet wieder', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 2, h.kRand);
    const g501 = 'tests/fixtures/genau-501.json';
    await s.kaestchen(g501).click();
    await s.kaestchen(g501).click();
    await expect(s.kaestchen(g501)).not.toBeChecked();
    expect(await s.offen(g501)).toBe(false);
    await expect(s.datei(g501).locator('.df-zu p')).toHaveText('Neue Datei mit 501 Zeilen, beginnt eingeklappt.');
    await s.kaestchen('tests/fixtures/genau-500.json').click();
    expect(await s.offen('tests/fixtures/genau-500.json')).toBe(false);
    await s.kaestchen('tests/fixtures/genau-500.json').click();
    expect(await s.offen('tests/fixtures/genau-500.json')).toBe(true);
  });

  /* ── AK 8 Zwei Tabs ── */

  test('AK 8: zwei Tabs eines Kontexts — Haken in A, dann in B: B überschreibt A nicht; nach dem Neuladen beider „2 von 8“', async ({ page, context }) => {
    const a = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const tabB = await context.newPage();
    const b = seite(tabB);
    await commitOeffnen(tabB, k, 1, h.kArt);
    await a.kaestchen('web/kd-app.css').click();
    await expect(a.zeileText()).toHaveText('1 von 8 gesehen');
    await expect(b.kaestchen('web/kd-app.css')).not.toBeChecked();
    await expect(b.zeileText()).toHaveText('0 von 8 gesehen');
    await b.kaestchen('e2e/einheit/kontrast.test.js').click();
    await neuLaden(page);
    await neuLaden(tabB);
    await expect(a.zeileText()).toHaveText('2 von 8 gesehen');
    await expect(b.zeileText()).toHaveText('2 von 8 gesehen');
    await tabB.close();
  });


  /* ── AK 5 Alle Änderungen, Änderung der Datei, Nachladen (US-5) ── */

  test('AK 5: Aufgabe #7 — wb mit 503: „5 von 5 gesehen · 1 Abschnitt nicht geladen“; nach „Erneut versuchen“ „5 von 8“, die Live-Region schweigt', async ({ page }) => {
    const s = seite(page);
    const wb = url => url.pathname === '/api/aufgaben/7/diff' && url.searchParams.get('anwendung') === 'wb' && !url.searchParams.has('datei');
    await page.route(wb, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Zeitgrenze' }) }));
    await alleOeffnen(page, k, 7);
    await expect(page.locator('#rv-a1 .rv-abs-f')).toBeVisible();
    await expect(s.zeileText()).toHaveText('0 von 5 gesehen');
    await expect(s.ganzeZeile()).toHaveText('0 von 5 gesehen · 1 Abschnitt nicht geladen');
    for (const pfad of ['src/a.rs', 'src/k5-1.rs', 'src/k5-2.rs', 'src/k5-3.rs', 'src/k5-4.rs']) {
      await s.kaestchen(pfad).click();
      expect(await s.fokusIstKaestchenVon(pfad), pfad).toBe(true);
      expect(await s.fokusGanzSichtbar(), pfad).toBe(true);
    }
    await expect(s.ganzeZeile()).toHaveText('5 von 5 gesehen · 1 Abschnitt nicht geladen');
    expect(await s.balkenAnteil()).toBe(1);
    await expect(s.live()).toHaveText('5 von 5 gesehen');
    await expect(s.zeile('src/a.rs')).toHaveAccessibleName(/gesehen/);
    const live = await liveZaehlen(page);
    await page.unroute(wb);
    await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(s.ganzeZeile()).toHaveText('5 von 8 gesehen');
    expect(await live.texte()).toEqual([]);
    expect(await live.derselbe()).toBe(true);
    await expect(s.live()).toHaveText('5 von 5 gesehen');
    await expect(page.locator('#rv-gesehen-n')).toHaveText('8');
    expect(await page.locator('#rv-gesehen-n').evaluate(e => Boolean(e.closest('[aria-hidden="true"]')) && !e.closest('#rv-gesehen'))).toBe(true);
    const wbDatei = page.locator('#rv-a1 section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt('src/a.rs') }) });
    await expect(wbDatei.locator('input.ru-ges-k')).not.toBeChecked();
    await wbDatei.locator('input.ru-ges-k').click();
    await expect(s.zeileText()).toHaveText('6 von 8 gesehen');
    expect(await live.texte()).toEqual(['6 von 8 gesehen']);
    expect(fehler.filter(f => !f.includes('503'))).toEqual([]);
  });

  test('AK 5: der Fokus bleibt auf dem Kästchen, während ein anderer Abschnitt nachlädt; ein Commit ohne Dateien zeigt keine Zeile', async ({ page }) => {
    const s = seite(page);
    let freigeben;
    const gehalten = new Promise(ok => { freigeben = ok; });
    const wb = url => url.pathname === '/api/aufgaben/7/diff' && url.searchParams.get('anwendung') === 'wb' && !url.searchParams.has('datei');
    await page.route(wb, async route => { await gehalten; await route.continue(); });
    await alleOeffnen(page, k, 7);
    await s.kaestchen('src/k5-2.rs').click();
    await expect(s.ganzeZeile()).toHaveText('1 von 5 gesehen · 1 Abschnitt nicht geladen');
    freigeben();
    await expect(s.ganzeZeile()).toHaveText('1 von 8 gesehen');
    expect(await s.fokusIstKaestchenVon('src/k5-2.rs')).toBe(true);
    expect(await s.fokusGanzSichtbar()).toBe(true);
    await s.kaestchen('src/k5-2.rs').click();
    expect(await s.fokusIstKaestchenVon('src/k5-2.rs')).toBe(true);
    expect(await s.fokusGanzSichtbar()).toBe(true);
    await expect(s.zeileText()).toHaveText('0 von 8 gesehen');

    await page.goto(commitAdresse(k, 8, h.leer));
    await expect(page.locator('.rv-leer')).toHaveText('Dieser Commit ändert keine Dateien.');
    await expect(s.zeileText()).toHaveCount(0);
    await expect(s.balken()).toHaveCount(0);
    await expect(page.locator('#rv-ges')).not.toContainText('0 von 0');
  });

  test('AK 5/US-5: Aufgabe #3 — src/a.rs gesehen überlebt das Neuladen; K3b ändert sie: wieder ungesehen und offen, README.md behält ihren Haken', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await expect(s.zeileText()).toHaveText('0 von 5 gesehen');
    await s.kaestchen('src/a.rs').click();
    await expect(s.zeileText()).toHaveText('1 von 5 gesehen');
    expect(await s.offen('src/a.rs')).toBe(false);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText('1 von 5 gesehen');
    expect(await s.offen('src/a.rs')).toBe(false);
    await s.gruppenkopf('doku', 0).click();
    await s.kaestchen('README.md').click();
    await expect(s.zeileText()).toHaveText('2 von 5 gesehen');
    await k3bAnhaengen(page, k, h);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText('1 von 5 gesehen');
    await expect(s.kaestchen('src/a.rs')).not.toBeChecked();
    expect(await s.offen('src/a.rs')).toBe(true);
    await expect(s.kaestchen('README.md')).toBeChecked();
  });

  test('AK 5: K-Rand in „Alle Änderungen“ — src/grosse-antwort.json angehakt, „Änderungen anzeigen“ lässt den Haken', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 2);
    await s.kaestchen('src/grosse-antwort.json').click();
    await s.datei('src/grosse-antwort.json').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    expect(await s.offen('src/grosse-antwort.json')).toBe(true);
    await expect(s.kaestchen('src/grosse-antwort.json')).toBeChecked();
    await expect(s.zeileText()).toHaveText(/^1 von \d+ gesehen$/);
  });

  test('AK 5/m7: KG — eine große Datei nachgeladen, dann angehakt: der Haken überlebt das Neuladen ohne patch', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 6);
    const riesig = s.datei('src/riesig.rs');
    await riesig.getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(riesig.locator('table.dz').first()).toBeVisible();
    await s.kaestchen('src/riesig.rs').click();
    await expect(s.zeileText()).toHaveText('1 von 1 gesehen');
    await neuLaden(page);
    await expect(s.kaestchen('src/riesig.rs')).toBeChecked();
    await expect(s.zeileText()).toHaveText('1 von 1 gesehen');
  });


  /* ── AK 6 Obergrenze und unlesbarer Wert (US-6) ── */

  test('AK 6/US-6: #1–#200 mit je einem Haken, dann ein Haken bei #1 und bei #201 — 200 Schlüssel, #2 fehlt, fremde bleiben', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await page.evaluate(() => {
      for (let nr = 1; nr <= 200; nr++) localStorage.setItem(`kanbanD.gesehen..${nr}`, JSON.stringify({ zeit: 1000 + nr, gesehen: [`alt${nr}`] }));
      localStorage.setItem('kanbanD.spalten-zu.entwicklung', '["Erledigt"]');
    });
    await neuLaden(page);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    await commitOeffnen(page, k, 201, h.kArt);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    const gespeichert = await s.speicher();
    expect(Object.keys(gespeichert)).toHaveLength(200);
    expect(gespeichert['kanbanD.gesehen..2']).toBeUndefined();
    expect(gespeichert['kanbanD.gesehen..3']).toBeDefined();
    expect(JSON.parse(gespeichert['kanbanD.gesehen..1']).gesehen).toEqual(['alt1', `${h.kArt}\u0000web/kd-app.css`]);
    expect(JSON.parse(gespeichert['kanbanD.gesehen..201']).gesehen).toEqual([`${h.kArt}\u0000web/kd-app.css`]);
    expect(await page.evaluate(() => localStorage.getItem('kanbanD.spalten-zu.entwicklung'))).toBe('["Erledigt"]');
    expect(fehler).toEqual([]);
  });

  test('AK 6: ein unlesbarer Wert „{kaputt“ — „0 von 8 gesehen“ ohne Fehler, der nächste Haken überschreibt ihn', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await page.evaluate(() => localStorage.setItem('kanbanD.gesehen..1', '{kaputt'));
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText('0 von 8 gesehen');
    await expect(s.speicherSatz()).toHaveText('');
    await s.kaestchen('web/kd-app.css').click();
    const wert = JSON.parse((await s.speicher())['kanbanD.gesehen..1']);
    expect(wert.gesehen).toEqual([`${h.kArt}\u0000web/kd-app.css`]);
    expect(fehler).toEqual([]);
  });

  /* ── AK 7 Speicher nicht verfügbar (US-7) ── */

  test('AK 7/US-7: gesperrter Speicher — Satz schon beim Laden, Haken klappt ein, „1 von 8“, kein Fehler; nach dem Neuladen „0 von 8“ und der Satz', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(speicherGesperrt);
    await commitOeffnen(page, k, 1, h.kArt);
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    await expect(s.speicherSatz()).toHaveAttribute('role', 'status');
    await expect(s.speicherSatz().locator('button, a')).toHaveCount(0);
    const satz = await speicherSatzZaehlen(page);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(await s.offen('web/kd-app.css')).toBe(false);
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    expect(await satz.texte()).toEqual([]);
    expect(await satz.derselbe()).toBe(true);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText('0 von 8 gesehen');
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    expect(fehler).toEqual([]);
  });

  test('AK 7: der Satz steht nicht vor dem ersten Fehlschlag und erscheint mit einer Textänderung, wenn erst das Schreiben scheitert', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new DOMException('voll', 'QuotaExceededError'); };
    });
    await commitOeffnen(page, k, 1, h.kArt);
    await expect(s.speicherSatz()).toHaveText('');
    const satz = await speicherSatzZaehlen(page);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    expect(await satz.texte()).toEqual([SATZ_SPEICHER]);
    expect(await satz.derselbe()).toBe(true);
    expect(fehler).toEqual([]);
  });

  test('AK 7: wirft nur beim ersten Schreiben — Satz nach dem ersten Haken, nach dem zweiten weg; beide Haken gespeichert', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(ersterSchreibfehler);
    await commitOeffnen(page, k, 1, h.kArt);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await expect(s.speicherSatz()).toHaveText('');
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    expect(fehler).toEqual([]);
  });

  test('Nacharbeit S2/FA 10: das Schreiben scheitert immer — der Haken steht nach dem Blättern zu einem anderen Commit und zurück', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('voll', 'QuotaExceededError'); }; });
    await commitOeffnen(page, k, 1, h.kArt);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    await page.locator('#rv-vor').click();
    await expect(page.locator('#rv-pos')).toHaveText(/^2 von 2/);
    await page.locator('#rv-zurueck').click();
    await expect(page.locator('#rv-pos')).toHaveText(/^1 von 2/);
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    await expect(s.kaestchen('web/kd-app.css')).toBeChecked();
    expect(await s.offen('web/kd-app.css')).toBe(false);
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    await page.locator('#rv-vor').click();
    await page.locator('#rv-zurueck').click();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    expect(fehler).toEqual([]);
  });

  test('Nacharbeit S2/FA 10: das Schreiben scheitert immer — in „Alle Änderungen“ bleibt der Haken beim Nachladen eines Abschnitts', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('voll', 'QuotaExceededError'); }; });
    const wb = url => url.pathname === '/api/aufgaben/7/diff' && url.searchParams.get('anwendung') === 'wb' && !url.searchParams.has('datei');
    await page.route(wb, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Zeitgrenze' }) }));
    await alleOeffnen(page, k, 7);
    await expect(page.locator('#rv-a1 .rv-abs-f')).toBeVisible();
    await s.kaestchen('src/k5-2.rs').click();
    await expect(s.ganzeZeile()).toHaveText('1 von 5 gesehen · 1 Abschnitt nicht geladen');
    await page.unroute(wb);
    await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(s.ganzeZeile()).toHaveText('1 von 8 gesehen');
    await expect(s.kaestchen('src/k5-2.rs')).toBeChecked();
    expect(fehler.filter(f => !f.includes('503'))).toEqual([]);
  });

  test('Nacharbeit UX S1/FA 2: nach dem Neuladen mit 2 Haken steht „2 von 8 gesehen“ schon in der Live-Region, das Laden ändert sie nicht; ein Haken ändert den Text genau einmal', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await s.kaestchen('web/kd-app.css').click();
    await s.kaestchen('e2e/einheit/kontrast.test.js').click();
    await expect(s.zeileText()).toHaveText('2 von 8 gesehen');
    await page.addInitScript(() => {
      window.kdLadeAenderungen = [];
      new MutationObserver(records => records.forEach(m => {
        const knoten = m.target.nodeType === 1 ? m.target : m.target.parentElement;
        if (knoten && knoten.closest('#rv-gesehen')) window.kdLadeAenderungen.push(knoten.closest('#rv-gesehen').textContent);
      })).observe(document, { childList: true, characterData: true, subtree: true });
    });
    await neuLaden(page);
    await expect(s.live()).toHaveText('2 von 8 gesehen');
    expect(await page.evaluate(() => window.kdLadeAenderungen)).toEqual([]);
    const live = await liveZaehlen(page);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(await live.texte()).toEqual(['1 von 8 gesehen']);
    expect(await live.derselbe()).toBe(true);
  });

  test('Nacharbeit UX S1/AK 5, AK 9: Blättern und Nachladen sagen nichts an, die Live-Region trägt jeweils schon den aktuellen Stand', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await expect(s.live()).toHaveText('0 von 8 gesehen');
    const live = await liveZaehlen(page);
    await page.locator('#rv-vor').click();
    await expect(page.locator('#rv-pos')).toHaveText(/^2 von 2/);
    await expect(s.live()).toHaveText(/^0 von \d+ gesehen$/);
    expect(await live.texte()).toEqual([]);
  });

  test('Nacharbeit UX S2: „1 Abschnitt nicht geladen“ wird zusammen mit „gesehen“ gelesen — die Lesetexte der Zeile enthalten beides, in dieser Reihenfolge, der sichtbare Text bleibt', async ({ page }) => {
    const s = seite(page);
    const wb = url => url.pathname === '/api/aufgaben/7/diff' && url.searchParams.get('anwendung') === 'wb' && !url.searchParams.has('datei');
    await page.route(wb, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Zeitgrenze' }) }));
    await alleOeffnen(page, k, 7);
    await expect(page.locator('#rv-a1 .rv-abs-f')).toBeVisible();
    await expect(s.ganzeZeile()).toHaveText('0 von 5 gesehen · 1 Abschnitt nicht geladen');
    const gelesen = () => page.locator('#rv-ges').evaluate(wurzel => {
      const teile = [];
      const gehen = e => { if (e.getAttribute && e.getAttribute('aria-hidden') === 'true') return; e.childNodes.forEach(n => (n.nodeType === 3 ? teile.push(n.textContent) : gehen(n))); };
      gehen(wurzel);
      return teile.join(' ').replace(/\s+/g, ' ').trim();
    });
    expect(await gelesen()).toMatch(/gesehen.*nicht geladen/);
    await s.kaestchen('src/a.rs').click();
    await expect(s.ganzeZeile()).toHaveText('1 von 5 gesehen · 1 Abschnitt nicht geladen');
    expect(await gelesen()).toMatch(/1 von 5 gesehen.*1 Abschnitt nicht geladen/);
  });

  test('AK 7: der Satz ist gedämpft, nicht im Fehlerrot, ≥ 4,5:1 in Hell und Dunkel und bricht bei 320 px um', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(speicherGesperrt);
    await commitOeffnen(page, k, 1, h.kArt);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      expect(await kontrastAm(s.speicherSatz()), name).toBeGreaterThanOrEqual(4.5);
      const farben = await page.evaluate(() => {
        const wurzel = getComputedStyle(document.documentElement);
        const probe = farbe => { const e = document.createElement('span'); e.style.color = farbe; document.body.append(e); const f = getComputedStyle(e).color; e.remove(); return f; };
        return { satz: getComputedStyle(document.getElementById('rv-gesehen-speicher')).color, gedaempft: probe(wurzel.getPropertyValue('--kd-muted')), rot: probe(wurzel.getPropertyValue('--kd-status-error-ink')) };
      });
      expect(farben.satz, name).toBe(farben.gedaempft);
      expect(farben.satz, name).not.toBe(farben.rot);
    }
    await breiteSetzen(page, 320);
    await expect(s.speicherSatz()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const satz = await s.speicherSatz().evaluate(e => ({ breit: e.scrollWidth <= e.clientWidth, hoch: e.getBoundingClientRect().height }));
    expect(satz.breit).toBe(true);
    expect(satz.hoch).toBeGreaterThan(20);
  });

  test('AK 7: bei funktionierendem Speicher steht der Satz nie da (Laden, Haken, Entfernen, Neuladen)', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const satz = await speicherSatzZaehlen(page);
    await s.kaestchen('web/kd-app.css').click();
    await s.kaestchen('web/kd-app.css').click();
    expect(await satz.texte()).toEqual([]);
    await neuLaden(page);
    await expect(s.speicherSatz()).toHaveText('');
  });


  /* ── AK 9 Breite, Themen, Kontrast, Tastatur, Ansage ── */

  test('AK 9: Ein Commit — Live-Region ändert sich genau einmal auf „1 von 8 gesehen“, derselbe Knoten; Tab-Folge im Kopf endet mit „Gesehen“', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const live = await liveZaehlen(page);
    await s.kaestchen('web/kd-app.css').click();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(await live.texte()).toEqual(['1 von 8 gesehen']);
    expect(await live.derselbe()).toBe(true);
    await s.kaestchen('web/kd-app.css').click();
    await s.klappe('web/kd-app.css').focus();
    const reihe = [];
    for (let n = 0; n < 4; n++) {
      await page.keyboard.press('Tab');
      reihe.push(await page.evaluate(() => document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()));
    }
    expect(reihe).toEqual(['Pfad', 'VS Code', 'Patch', 'Gesehen: web/kd-app.css']);
    const ring = await page.evaluate(() => { const st = getComputedStyle(document.activeElement); return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth), farbe: st.outlineColor }; });
    expect(ring.stil).not.toBe('none');
    expect(ring.breite).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => document.activeElement.matches('input.ru-ges-k:focus-visible'))).toBe(true);
  });

  for (const name of ['light', 'dark']) {
    test(`AK 9 (${name}): Breiten 320, 414, 980, 1280 — kein Querscrollen, Kästchen und Haken-Symbol ganz in der Breite, Ziel ≥ 24 px, Kontraste`, async ({ page }) => {
      const s = seite(page);
      await commitOeffnen(page, k, 1, h.kArt);
      await thema(page, name);
      await s.kaestchen('web/kd-app.css').click();
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite);
        if (await page.locator('#rv-auf').isVisible()) {
          if ((await page.locator('#rv-auf').getAttribute('aria-expanded')) !== 'true') await page.locator('#rv-auf').click();
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${breite}`).toBe(true);
        const lage = await page.evaluate(() => {
          const r = e => e.getBoundingClientRect();
          const label = document.querySelector('#rv-insel label.ru-ges'), symbol = document.querySelector('#review .dn-e .rv-gm svg');
          return { label: r(label), kaestchen: r(label.querySelector('input')), symbol: r(symbol), breite: innerWidth };
        });
        for (const teil of ['label', 'kaestchen', 'symbol']) {
          expect(lage[teil].left, `${breite} ${teil}`).toBeGreaterThanOrEqual(0);
          expect(lage[teil].right, `${breite} ${teil}`).toBeLessThanOrEqual(lage.breite);
        }
        expect(lage.label.height, `${breite}`).toBeGreaterThanOrEqual(24);
        expect(lage.kaestchen.width, `${breite}`).toBeGreaterThanOrEqual(16);
      }
      await breiteSetzen(page, 1280);
      const texte = await kontrastMessen(page, ['#rv-ges-t', '#rv-insel label.ru-ges']);
      expect(texte.length).toBeGreaterThan(0);
      for (const m of texte) expect(m.wert, m.element).toBeGreaterThanOrEqual(4.5);
      const zeile = s.zeile('web/kd-app.css');
      const symbolKontrast = () => zeile.locator('.rv-gm svg').evaluate(e => window.kdKontrast.schriftGegenGrund(e, getComputedStyle(e).color));
      expect(await symbolKontrast(), 'normal').toBeGreaterThanOrEqual(3);
      await zeile.hover();
      expect(await symbolKontrast(), 'hover').toBeGreaterThanOrEqual(3);
      await page.mouse.move(0, 0);
      await s.kaestchen('e2e/einheit/kontrast.test.js').focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ring = await s.kaestchen('e2e/einheit/kontrast.test.js').evaluate(e => {
        const farbe = getComputedStyle(e).outlineColor;
        return window.kdKontrast.schriftGegenGrund(e.closest('label'), farbe);
      });
      expect(ring, 'Fokusring').toBeGreaterThanOrEqual(3);
      await page.evaluate(() => document.activeElement.blur());
      expect(await kaestchenRandKontrast(page, s.label('e2e/tests/r00229-sperrform.spec.js')), 'Rand ungehakt').toBeGreaterThanOrEqual(3);
    });
  }

  test('AK 9: Alle Änderungen mit 30 Dateien und einem Pfad über 300 Zeichen und bei gesperrtem Speicher — kein Querscrollen bei 320 px, Ziele ganz in der Breite', async ({ page }) => {
    await page.addInitScript(speicherGesperrt);
    const s = seite(page);
    await alleOeffnen(page, k, 9);
    await expect(s.zeileText()).toHaveText('0 von 30 gesehen');
    await expect(page.locator('#rv-insel .ru-k.ru-lang')).toHaveCount(1);
    await s.kaestchen(h.k30Lang).click();
    await expect(s.zeileText()).toHaveText('1 von 30 gesehen');
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${name} ${breite}`).toBe(true);
        const lage = await s.label(h.k30Lang).evaluate(e => { const r = e.getBoundingClientRect(); return { links: r.left, rechts: r.right, hoehe: r.height, breite: innerWidth }; });
        expect(lage.links).toBeGreaterThanOrEqual(0);
        expect(lage.rechts).toBeLessThanOrEqual(lage.breite);
        expect(lage.hoehe).toBeGreaterThanOrEqual(24);
        for (const m of await kontrastMessen(page, ['#rv-ges', '#rv-insel label.ru-ges'])) expect(m.wert, `${name} ${breite} ${m.element}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

});

test.describe('R00246 Gesehen bei grobem Zeiger', () => {
  test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });
  let k, h;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    h = gesehenRepository();
    k = await kanbanStarten(gesehenVorbereiten(h));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  test('AK 9: Touch — das Label ist ≥ 44 px hoch, ein Tippen darauf setzt den Haken, kein Querscrollen', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const hoehe = await s.label('web/kd-app.css').evaluate(e => e.getBoundingClientRect().height);
    expect(hoehe).toBeGreaterThanOrEqual(44);
    await s.label('web/kd-app.css').tap();
    await expect(s.kaestchen('web/kd-app.css')).toBeChecked();
    await expect(s.zeileText()).toHaveText('1 von 8 gesehen');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
