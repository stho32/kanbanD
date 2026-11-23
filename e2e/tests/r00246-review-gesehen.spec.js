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

});
