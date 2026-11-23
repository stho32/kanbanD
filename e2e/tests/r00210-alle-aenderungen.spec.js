// R00210 Alle Änderungen der Aufgabe in der Review-Seite (Karte #215, I0200, Scheibe B3) — AK 1–10 im echten Programm gegen echtes Git.
// Ausgangslage: gesamt-hilfen.js (R mit K1, F, K2, L1, L2, N1, MK, N2, N1', P1/P2; S mit W1, FS, W2; T mit X1). Seltene Zustände als
// feste Antworten per page.route; gehaltene Antworten über ein Promise, ohne Schlafzeiten; Verneinungen erst nach einem sichtbaren Signal.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit, reiter, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen, kontrastFarben } = require('./hilfen');
const { breiteMessen, zieleMessen } = require('./ziele-hilfen');
const { gesamtRepositorien, gesamtVorbereiten } = require('./gesamt-hilfen');

const kurz = (h, k = 'kd') => `${k}:${h.slice(0, 7)}`;
const AGENT = { 'X-KanbanD-Wer': 'cl' };

/* ── Treiber: Adressen, Zähler, gehaltene und feste Antworten ── */
const reviewAdresse = (k, nr, commit = null) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review${commit == null ? '' : `?commit=${encodeURIComponent(commit)}`}`;
const istDiff = (url, nr) => url.pathname === `/api/aufgaben/${nr}/diff`;
// umgestellt mit R00245 (FA 1): der Umschalter „Alle Änderungen | Ein Commit“ ist der Leiste gewichen; „Ein Commit“ heißt jetzt ein
// bestimmter Eintrag der Leiste, das Ziel „zuletzt gezeigter Commit“ entfällt (jeder Eintrag ist sein eigenes Ziel)
const LEISTE = '#rv-ls';
const eintragVon = verweis => `#rv-ls li > a[data-arg="${verweis}"]`;
const ERSTER_COMMIT = '#rv-l1';

/** Zählt die GET-Anfragen an `…/diff` der Seite in Reihenfolge (Suchteil) und die höchste Zahl gleichzeitig offener. */
function zaehlen(page) {
  const z = { diff: [], offen: 0, hoechstens: 0, abgebrochen: [], kopf: [] };
  const istDiffAnfrage = r => r.method() === 'GET' && /^\/api\/aufgaben\/\d+\/diff$/.test(new URL(r.url()).pathname);
  page.on('request', r => {
    if (!istDiffAnfrage(r)) return;
    z.diff.push(new URL(r.url()).search);
    z.kopf.push(r.headers()['if-none-match'] || null);
    z.offen++;
    z.hoechstens = Math.max(z.hoechstens, z.offen);
  });
  const fertig = r => { if (istDiffAnfrage(r)) z.offen--; };
  page.on('requestfinished', fertig);
  page.on('requestfailed', r => { if (istDiffAnfrage(r)) { z.abgebrochen.push(new URL(r.url()).search); fertig(r); } });
  return z;
}

/** Hält passende Antworten an, bis `frei(i, wert)` die i-te freigibt; `wert` ersetzt sie (Status, JSON) oder bricht ab. */
async function halten(page, muster) {
  const tore = [];
  await page.route(muster, async route => {
    let frei; const tor = new Promise(r => { frei = r; });
    tore.push(frei);
    const wert = await tor;
    const still = p => p.catch(() => {});
    if (wert && wert.status) return still(route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify(wert.body || {}) }));
    if (wert && wert.json) return still(route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(wert.json) }));
    if (wert === 'abbrechen') return still(route.abort());
    return still(route.continue());
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

/** Feste Antwort für eine Anfrage an `…/diff` (Form nach R00208 FA 7), aus der echten abgeleitet: `aendern(json, url)`. */
async function festeAntwort(page, nr, aendern) {
  await page.route(url => istDiff(url, nr), async route => {
    const echt = await route.fetch();
    const json = echt.status() === 200 ? await echt.json() : null;
    const neu = aendern(json, new URL(route.request().url()));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(neu) });
  });
}

const patchMit = (n, vorsatz = 'x') => '@@ -0,0 +1 @@\n' + Array.from({ length: n - 1 }, (_, i) => `+${vorsatz}${i}\n`).join('');
// eine geänderte statt einer neuen Datei: neue Dateien über 500 Zeilen beginnen seit R00235 FA 6 eingeklappt und zählen nicht ins Budget
const geaendert = name => ({ status: 'M', alt: name });
const netto = (name, n, zusatz = {}) => ({ neu: name, alt: null, status: 'A', plus: n - 1, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: patchMit(n), ...zusatz });
const commitEintrag = (k, hash, titel) => ({ verweis: `${k}:${hash}`, anwendung: k, hash, titel, autor: 'Ada', datum: '2026-05-02T10:00:00Z', plus: 1, minus: 0, dateien: 1 });
const schritt = (k, hash, n, zusatz = {}) => ({ commit: `${k}:${hash}`, alt: 'f.dat', neu: 'f.dat', status: 'M', plus: n - 1, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: patchMit(n), ...zusatz });

/** Gezeichnete Zeilen offener Dateien und Schritte: Zeilen aller Code-Tabellen je Datei-Abschnitt. */
const offeneDateien = page => page.locator('#rv-insel section.df').evaluateAll(ds => ds.filter(d => d.querySelector('.df-k').getAttribute('aria-expanded') === 'true' && d.querySelector('table.dz')).map(d => d.id));

/** Bis 1099 px stehen Dateiliste und Commits hinter dem Aufklapper „Dateien (<n>) und Commits“ (R00235 FA 11): öffnet ihn, wenn er zu ist. */
async function aufklapperOeffnen(page) {
  if (await page.evaluate(() => innerWidth > 1099)) return;
  const auf = page.locator('#rv-auf');
  await auf.waitFor();
  if (await auf.getAttribute('aria-expanded') === 'false') await auf.click();
  await expect(auf).toHaveAttribute('aria-expanded', 'true');
}

test.describe('R00210 Alle Änderungen der Aufgabe', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = gesamtRepositorien();
    k = await kanbanStarten(gesamtVorbereiten(rep));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /** Die erste Antwort von #11 mit `k.dat` (zweite Datei von kd) in `nachladen`; `aendern` kann die Hinweise ersetzen. */
  async function ersteAntwortElf(page, aendern = json => json) {
    await page.route(url => istDiff(url, 11) && !url.searchParams.has('anwendung') && !url.searchParams.has('datei'), async route => {
      const echt = await route.fetch();
      const json = await echt.json();
      json.dateien[1] = { ...json.dateien[1], nachladen: true, patch: undefined };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(aendern(json)) });
    });
  }
  const weitere = liste => json => ({ ...json, hinweise: json.hinweise.map(h => (h.art === 'weitere_anwendungen' ? { ...h, anwendungen: liste } : h)) });

  /* ── Nacharbeit 1: AK 11 (Code-Review M1, Abnahme-Probe wörtlich) ── */

  test('AK 11 (M1): „Erneut versuchen“ an wb, während datei= von kd läuft — #rv-a1 „Wartet, bis die Anwendung kd geladen ist …“; die Ansage wird sofort leer', async ({ page }) => {
    await ersteAntwortElf(page);
    const datei = await halten(page, url => istDiff(url, 11) && url.searchParams.has('datei'));
    const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
    wb.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht' } });
    await expect(page.locator('#rv-a1 .rv-abs-f')).toBeVisible();
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
    await expect(page.locator('#rv-ansage')).toContainText('ohne Anwendung wb: ließ sich nicht lesen');
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
    await expect.poll(() => datei.angehalten()).toBe(1);
    await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(page.locator('#rv-a1 .rv-abs-zust')).toHaveText('Wartet, bis die Anwendung kd geladen ist …');
    await expect(page.locator('#rv-ansage')).toHaveText('');
    datei.frei(0);
    await expect.poll(() => wb.angehalten()).toBe(2);
    wb.frei(1);
    await expect(page.locator('#rv-a1 .rv-cl')).toBeVisible();
    await expect(page.locator('#rv-ansage')).toHaveText(/^Alle Änderungen der Aufgabe #11: .* entfernt\.$/);
  });

  /* ── AK 12 Standardanwendung ── */

  test('AK 12: weitere Anwendung ist die Standardanwendung — lädt, wartet, Leiste, Fehler und Ansage sagen „Standardanwendung“, nie „Anwendung  “', async ({ page }) => {
    await ersteAntwortElf(page, weitere(['', 'xx']));
    const standard = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === '');
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a1 .rv-abs-zust')).toHaveText('Lädt die Änderungen der Standardanwendung …');
    await expect(page.locator('#rv-a2 .rv-abs-zust')).toHaveText('Wartet, bis die Standardanwendung geladen ist …');
    await expect(page.locator('#rv-summe')).toHaveText(/ · Standardanwendung lädt noch …$/);
    await expect(page.locator('#rv-a1 h2')).toHaveText(/^Standardanwendung/);
    const texte = [await page.locator('#review').textContent()];
    standard.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht' } });
    await expect(page.locator('#rv-a1 .rv-abs-f')).toHaveText(/^Die Änderungen der Standardanwendung ließen sich nicht lesen: Git antwortete nicht \(503\)\./);
    await expect(page.locator('#rv-ansage')).toContainText('ohne Standardanwendung: ließ sich nicht lesen');
    texte.push(await page.locator('#review').textContent(), await page.locator('#rv-ansage').textContent());
    for (const t of texte) expect(t).not.toMatch(/Anwendung {2}|Anwendung :|Anwendung …|Anwendung lädt|Anwendung wurden|Anwendung ließen|Anwendung geladen/);
  });

  /* ── AK 13 Netzabbruch ohne „(0)“ ── */

  test('AK 13: Netzabbruch auf der Seite und bei datei= — „: keine Verbindung zum Programm.“ ohne „(0)“', async ({ page }) => {
    const seite = await halten(page, url => istDiff(url, 2) && !url.searchParams.has('datei'));
    await page.goto(reviewAdresse(k, 2));
    await expect.poll(() => seite.angehalten()).toBe(1);
    seite.frei(0, 'abbrechen');
    await expect(page.locator('.rv-meld h2')).toHaveText('Der Diff ließ sich nicht lesen: keine Verbindung zum Programm.');
    await page.unrouteAll();
    await ersteAntwortElf(page);
    const datei = await halten(page, url => istDiff(url, 11) && url.searchParams.has('datei'));
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
    await expect.poll(() => datei.angehalten()).toBe(1);
    datei.frei(0, 'abbrechen');
    await expect(page.locator('#rv-d0-1 .df-hin.fehl p')).toHaveText('Die Änderungen dieser Datei ließen sich nicht laden: keine Verbindung zum Programm.');
    expect(await page.locator('#review').textContent()).not.toContain('(0)');
  });

  /* ── AK 14 Fremder Text an den Rückfall-Senken ── */

  test('AK 14: Grund, Status von Datei und Schritt, Dateimodus mit <img onerror> — window.PWN bleibt undefined, der Text steht maskiert da', async ({ page }) => {
    const PWN = '<img src=x onerror=window.PWN=1>';
    await festeAntwort(page, 2, json => {
      const [a, kd] = json.dateien;
      return { ...json, dateien: [{ ...a, schritte: a.schritte.map(s => ({ ...s, status: PWN, modus_alt: PWN, modus_neu: '100755' })) }, { ...kd, status: PWN, modus_alt: PWN, modus_neu: '100755' }], hinweise: [{ art: 'ganz_als_folge', grund: PWN }] };
    });
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-a0 .rv-ganz')).toContainText(`Grund „${PWN}“.`);
    for (const kopf of ['#rv-dk0-0', '#rv-dk0-1']) { await page.locator(kopf).click(); await page.locator(kopf).click(); }
    await expect(page.locator('#rv-d0-1 .df-mm')).toContainText(PWN);
    expect(await page.evaluate(() => window.PWN)).toBeUndefined();
    expect(await page.locator('#rv-insel img').count()).toBe(0);
  });

  test('AK 14: wartetAuf nur beim Einsetzen maskiert — Kürzel „a&b“ steht an Abschnitt und Datei als „a&b“', async ({ page }) => {
    await ersteAntwortElf(page, weitere(['a&b', 'xx']));
    const ab = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'a&b');
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a2 .rv-abs-zust')).toHaveText('Wartet, bis die Anwendung a&b geladen ist …');
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
    await expect(page.locator('#rv-d0-1 .df-wartet')).toHaveText('Wartet, bis die Anwendung a&b geladen ist …');
    ab.frei(0, { status: 404, body: { fehler: 'nichts' } });
  });

  /* ── AK 15 Mutanten G, J, A und die Fälle S9, AK 2 verzögert, Tab-Folge ── */

  test('AK 15 (G): bei 320 px ändert die Leiste ihre Höhe, wenn die letzte Anwendung ankommt — der sichtbare Schrittkopf von kd bleibt (≤ 1 px)', async ({ page }) => {
    await breiteSetzen(page, 320, 700);
    await ersteAntwortElf(page, weitere(['langname']));
    let frei;
    const tor = new Promise(r => { frei = r; });
    await page.route(url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'langname', async route => {
      await tor;
      const echt = await (await route.fetch({ url: route.request().url().replace('anwendung=langname', 'anwendung=wb') })).json();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...echt, anwendung: 'langname' }) });
    });
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-summe')).toHaveText(/Anwendung langname lädt noch …$/);
    await page.locator('#rv-d0-0-1 .fs-k').evaluate(e => e.scrollIntoView({ block: 'start' }));
    // R00245: erst messen, wenn die Blöcke mit `content-visibility: auto` nach dem Rollen gezeichnet sind (zwei Bilder) — sonst misst
    // die Probe die Kante vor ihrer eigenen Verschiebung um die echte Höhe des ersten Schritts (Testseiten-Rennen, 19 px)
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
    const hoehe = () => page.locator('.rv-leiste').evaluate(e => e.getBoundingClientRect().height);
    const kante = () => page.locator('#rv-d0-0-1 .fs-k').evaluate(e => e.getBoundingClientRect().top);
    const [h0, k0] = [await hoehe(), await kante()];
    frei();
    await expect(page.locator('#rv-summe')).not.toContainText('lädt noch');
    expect(await hoehe(), 'die Leiste ändert ihre Höhe (Vorbedingung)').not.toBe(h0);
    expect(Math.abs((await kante()) - k0)).toBeLessThanOrEqual(1);
  });

  test('AK 15 (J): Klappen gelten nur bei gleicher Dateiliste — eine neue Datei vorn öffnet nach Plan, nicht nach der alten Klappe', async ({ page }) => {
    let mitNeuer = false;
    await festeAntwort(page, 2, json => {
      if (!mitNeuer) return json;
      return { ...json, dateien: [{ neu: '0-neu.dat', status: 'A', plus: 1, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -0,0 +1 @@\n+n\n' }, ...json.dateien] };
    });
    await page.goto(reviewAdresse(k, 2));
    await page.locator('#rv-dk0-0').click();
    await expect(page.locator('#rv-dk0-0')).toHaveAttribute('aria-expanded', 'false');
    await page.locator(ERSTER_COMMIT).click();
    await expect(page.locator('#rv-pos')).toBeVisible();
    await page.locator('#rv-u-alle').click();
    await expect(page.locator('#rv-dk0-0')).toHaveAttribute('aria-expanded', 'false');
    mitNeuer = true;
    await page.locator(ERSTER_COMMIT).click();
    await expect(page.locator('#rv-pos')).toBeVisible();
    await page.locator('#rv-u-alle').click();
    await expect(page.locator('#rv-dk0-2')).toBeVisible();
    await expect(page.locator('#rv-dk0-0')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rv-dk0-1')).toHaveAttribute('aria-expanded', 'true');
  });

  test('AK 15 (A): vierte Anwendung — „Erneut versuchen“ an wb geht vor die noch nicht begonnene yy', async ({ page }) => {
    const z = zaehlen(page);
    await ersteAntwortElf(page, weitere(['wb', 'xx', 'yy']));
    await page.route(url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'yy', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ anwendung: 'yy', commits: [], dateien: [], hinweise: [] }) }));
    const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
    const xx = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'xx');
    await page.goto(reviewAdresse(k, 11));
    await expect.poll(() => wb.angehalten()).toBe(1);
    wb.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht' } });
    await expect.poll(() => xx.angehalten()).toBe(1);
    await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
    xx.frei(0);
    await expect.poll(() => wb.angehalten()).toBe(2);
    wb.frei(1);
    await expect(page.locator('#rv-a3 .rv-abs-leer')).toBeVisible();
    expect(z.diff.filter(s => !s.includes('datei='))).toEqual(['', '?anwendung=wb', '?anwendung=xx', '?anwendung=wb', '?anwendung=yy']);
  });

  test('AK 15 (S9): Browser-Zurück ins Fenster und Vor auf die Seite — Fokus auf dem Rückweg, Titel wie beim Öffnen', async ({ page }) => {
    await page.goto(`${k.adresse}#/board/entwicklung/aufgabe/2`);
    await liveBereit(page);
    await reiter(page, 'Commits');
    await page.getByRole('link', { name: 'Alle Änderungen ansehen' }).click();
    await expect(page.locator('#rv-a0')).toBeVisible();
    await expect(page.locator('#rv-rueckweg')).toBeFocused();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
    await page.goForward();
    await expect(page.locator('#rv-a0')).toBeVisible();
    await expect(page).toHaveTitle('Review #2 · Alle Änderungen — kanbanD');
    await expect(page.locator('#rv-rueckweg')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });

  test('AK 15 (AK 2 verzögert): #2 mit gehaltener Antwort — nach der Freigabe dasselbe Bild wie direkt', async ({ page }) => {
    const h = await halten(page, url => istDiff(url, 2));
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('.rv-laedt')).toBeVisible();
    h.frei(0);
    await expect(page.locator('#rv-a0 h2')).toHaveText('Anwendung kd 2 Commits · 2 Dateien');
    await expect(page.locator('#rv-dk0-0')).toHaveText('a.datFolge · 2 Commits+2 −2');
    await expect(page.locator('#rv-d0-0 .fs-l')).toHaveCount(2);
    await expect(page.locator('#rv-dk0-1')).toHaveText(/^neuk\.dat\+3 −0/);
    await expect(page.locator('#rv-ansage')).toHaveText('Alle Änderungen der Aufgabe #2: 2 Dateien, 5 Zeilen hinzugefügt, 2 entfernt.');
  });

  test('AK 15 (Tab-Folge der ganzen Seite): #12 — Rückweg, Leiste, Alle einklappen, Hinweis-Verweise, Commit-Liste, Dateiliste, Dateien mit Code', async ({ page }) => {
    await page.goto(reviewAdresse(k, 12));
    await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
    // umgestellt mit R00245 (FA 1, AK 3): statt „Alle Änderungen | Ein Commit“ stehen alle Einträge der Leiste in ihrer Reihenfolge
    const leiste = await page.locator(`${LEISTE} li > a`).evaluateAll(as => as.map(a => a.id));
    expect(leiste[0]).toBe('rv-u-alle');
    await page.locator('#rv-rueckweg').focus();
    const folge = [];
    // R00235: vor den Dateien steht der Kopf ihrer Gruppe „Code“ (rv-gk0-code) in der Tab-Folge; R00236: nach dem Klappknopf Pfad, VS Code, Patch
    for (let i = 0; i < 16 + leiste.length; i++) {
      folge.push(await page.evaluate(() => { const e = document.activeElement; return e.closest('#review, #kopf') ? (e.id || e.className) : 'aus'; }));
      await page.keyboard.press('Tab');
    }
    expect(folge).toEqual(['rv-rueckweg', ...leiste, 'rv-alle', 'rv-einzeln', 'rv-einzeln', 'rv-cv', 'rv-cv', 'rv-cv', 'rv-cv', 'dn-e', 'rv-gk0-code', 'rv-dk0-0', 'rv-pk0-0', 'btn ru-k1 ru-vsc', 'btn ru-k1 ru-patch', 'df-sc', 'aus']);
  });

  /* ── AK 1 Adresse, Umschalter, Titel, Ansage ── */

  test('AK 1: aus der Liste geöffnet — Adresse bleibt, Titel und Ansage in Worten, die Leiste ersetzt den Eintrag (R00245 umgestellt)', async ({ page }) => {
    await page.goto(`${k.adresse}#/board/entwicklung/aufgabe/2`);
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator('#fenster tbody tr.cl-z').first()).toBeVisible();
    const laenge = await page.evaluate(() => history.length);
    await page.getByRole('link', { name: 'Alle Änderungen ansehen' }).click();
    await expect(page.locator('#rv-a0')).toBeVisible();
    expect(page.url()).toMatch(/\/aufgabe\/2\/review$/);
    await expect(page.locator('#rv-u-alle')).toHaveAttribute('aria-current', 'page');
    await expect(page).toHaveTitle('Review #2 · Alle Änderungen — kanbanD');
    await expect(page.locator('#rv-ansage')).toHaveText('Alle Änderungen der Aufgabe #2: 2 Dateien, 5 Zeilen hinzugefügt, 2 entfernt.');
    expect(await page.locator(`${LEISTE} li > a`).evaluateAll(t => t.map(e => e.tagName + (e.hasAttribute('href') ? '[href]' : '')))).toEqual(['A[href]', 'A[href]', 'A[href]']);
    const nachListe = laenge + 1;
    await page.locator(eintragVon(`kd:${rep.k1}`)).click();
    await expect(page.locator('#rv-pos')).toHaveText('1 von 2');
    expect(decodeURIComponent(page.url())).toContain(`review?commit=kd:${rep.k1}`);
    await expect(page.locator(eintragVon(`kd:${rep.k1}`))).toBeFocused();
    await expect(page).toHaveTitle(`Review #2 · ${kurz(rep.k1)} — kanbanD`);
    await page.locator('#rv-vor').click();
    await expect(page.locator('#rv-pos')).toHaveText('2 von 2');
    await page.locator('#rv-u-alle').click();
    await expect(page.locator('#rv-a0')).toBeVisible();
    await expect(page.locator('#rv-u-alle')).toBeFocused();
    expect(page.url()).toMatch(/\/aufgabe\/2\/review$/);
    // das Ziel „zuletzt gezeigter Commit“ entfällt (R00245 Notizen): K2 hat seinen eigenen Eintrag
    expect(decodeURIComponent(await page.locator(eintragVon(`kd:${rep.k2}`)).getAttribute('href'))).toContain(`review?commit=kd:${rep.k2}`);
    expect(await page.evaluate(() => history.length)).toBe(nachListe);
    // ein Schrittkopf ersetzt den Eintrag ebenfalls (S4)
    await page.locator('#rv-a0 .fs-l').first().click();
    await expect(page.locator('#rv-pos')).toHaveText('1 von 2');
    expect(await page.evaluate(() => history.length)).toBe(nachListe);
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
  });

  test('AK 1: Mittelklick auf den ersten Commit der Leiste öffnet einen Tab, die Seite bleibt bei „Alle Änderungen“ (R00245 umgestellt)', async ({ page, context }) => {
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator(`${ERSTER_COMMIT}[href]`)).toBeVisible();
    const neu = context.waitForEvent('page');
    await page.locator(ERSTER_COMMIT).click({ button: 'middle' });
    const tab = await neu;
    await tab.waitForLoadState();
    expect(decodeURIComponent(tab.url())).toContain(`review?commit=kd:${rep.k1}`);
    await expect(page.locator('#rv-u-alle')).toHaveAttribute('aria-current', 'page');
    await tab.close();
  });

  test('AK 1 (S8): die Leiste steht beim Laden der ersten Antwort und beim Seitenfehler; „Erneut versuchen“ liest genau einmal', async ({ page }) => {
    const z = zaehlen(page);
    const h = await halten(page, url => istDiff(url, 2));
    await page.goto(reviewAdresse(k, 2));
    const laedt = page.locator('.rv-laedt');
    await expect(laedt).toHaveText('Liest die Änderungen der Aufgabe …');
    await expect(laedt).toHaveAttribute('role', 'status');
    await expect(laedt).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#rv-u-alle')).toBeVisible();
    await expect(page.locator('#rv-ansage')).toHaveText('');
    h.frei(0, { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } });
    await expect(page.locator('.rv-meld.warn')).toContainText('Server ausgelastet (Antwortbudget).');
    await expect(page.locator('#rv-u-alle')).toBeVisible();
    expect(z.diff.length).toBe(1);
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect.poll(() => h.angehalten()).toBe(2);
    h.frei(1);
    await expect(page.locator('#rv-a0')).toBeVisible();
    expect(z.diff.length).toBe(2);
  });

  /* ── AK 2 Folge-Datei und Netto-Datei ── */

  test('AK 2: #2 — „Anwendung kd“ mit 2 Commits · 2 Dateien; a.dat als Folge ohne Statuswort mit Schrittköpfen als Verweis; k.dat netto „neu“; nie fremd', async ({ page }) => {
    await page.goto(reviewAdresse(k, 2));
    const ab = page.locator('#rv-a0');
    await expect(ab.locator('h2')).toHaveText('Anwendung kd 2 Commits · 2 Dateien');
    const kopf = page.locator('#rv-dk0-0');
    await expect(kopf).toHaveText('a.datFolge · 2 Commits+2 −2');
    await expect(kopf).toHaveAttribute('aria-label', 'a.dat, Folge · 2 Commits, +2 −2, aufgeklappt');
    await expect(kopf.locator('.st:not(.st-folge)')).toHaveCount(0);
    await expect(page.locator('#rv-d0-0 .df-folge')).toHaveText('Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert. Hier stehen die Schritte der Aufgabe nacheinander; Änderungen fremder Commits fehlen.');
    const schritte = page.locator('#rv-d0-0 .fs-l');
    await expect(schritte).toHaveText([`${kurz(rep.k1)}K1 a.dat und k.datgeändert+1 −1`, `${kurz(rep.k2)}K2 a.datgeändert+1 −1`]);
    await expect(schritte.first()).toHaveAttribute('aria-label', `Commit ${kurz(rep.k1)}, K1 a.dat und k.dat, geändert, +1 −1`);
    expect(decodeURIComponent(await schritte.nth(1).getAttribute('href'))).toMatch(new RegExp(`review\\?commit=kd:${rep.k2}$`));
    await expect(page.locator('#rv-d0-0 .fs table.dz')).toHaveCount(2);
    await expect(page.locator('#rv-dk0-1')).toHaveText(/^neuk\.dat\+3 −0/);
    // Summe gleich der Summe der Schritte; keine +/−-Zeile mit FREMD
    const zahlen = await page.locator('#rv-d0-0 .fs .z').allTextContents();
    expect(zahlen).toEqual(['+1 −1', '+1 −1']);
    const fremd = await page.locator('#rv-insel tr.add, #rv-insel tr.del').evaluateAll(z => z.filter(e => e.textContent.includes('FREMD')).length);
    expect(fremd).toBe(0);
  });

  /* ── AK 3 Hinweise in Worten ── */

  test('AK 3: #2 Hinweis fremd_dazwischen wörtlich; feste Antwort {3, 5} in der Mehrzahl', async ({ page }) => {
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-a0 .rv-hw')).toHaveText('Zwischen den Commits der Aufgabe liegt 1 fremder Commit. Er berührt Dateien der Aufgabe; 1 Datei steht deshalb als Folge der Schritte der Aufgabe. Die Änderungen des fremden Commits sind nicht zu sehen.');
    await festeAntwort(page, 2, json => ({ ...json, hinweise: [{ art: 'fremd_dazwischen', commits: 3, dateien: 5 }] }));
    await page.reload();
    await expect(page.locator('#rv-a0 .rv-hw')).toHaveText('Zwischen den Commits der Aufgabe liegen 3 fremde Commits. Sie berühren Dateien der Aufgabe; 5 Dateien stehen deshalb als Folge der Schritte der Aufgabe. Die Änderungen fremder Commits sind nicht zu sehen.');
  });

  test('AK 3: #12 — Merge und verwaist mit „einzeln ansehen“, „nicht einbezogen: …“ in der Liste, fehlt im Abschnitt, xy und unlesbar einmal darüber mit Marke', async ({ page }) => {
    await page.goto(reviewAdresse(k, 12));
    const ab = page.locator('#rv-a0');
    await expect(ab.locator('.rv-hw li').filter({ hasText: 'ist ein Merge' })).toHaveText(`${kurz(rep.mk)} ist ein Merge und in diesem Gesamtbild ausgelassen.einzeln ansehen`);
    await expect(ab.locator('.rv-hw li').filter({ hasText: 'ist verwaist' })).toHaveText(`${kurz(rep.n1s)} ist verwaist: Kein Zweig führt zu ihm, darum zählt er hier nicht mit.einzeln ansehen`);
    await expect(ab.locator('.rv-cl')).toContainText('nicht einbezogen: Merge');
    await expect(ab.locator('.rv-cl')).toContainText('nicht einbezogen: verwaist');
    await expect(ab.locator('.rv-aus')).toContainText(`${kurz(rep.v2)}`);
    await expect(ab.locator('.rv-aus')).toContainText('nicht mehr im Repository');
    const seite = page.locator('#rv-seite-hw li');
    await expect(seite).toHaveCount(2);
    await expect(seite.filter({ hasText: 'Anwendung unbekannt' })).toContainText(`xy:${rep.k1.slice(0, 7)}`);
    await expect(seite.filter({ hasText: 'Eintrag nicht lesbar' })).toContainText('kd:ab⟨U+202E⟩cd');
    expect(await page.locator('#review').evaluate(e => e.textContent.includes('‮'))).toBe(false);
    await ab.locator('.rv-hw li').filter({ hasText: 'ist ein Merge' }).getByRole('link', { name: `Commit ${kurz(rep.mk)} einzeln ansehen` }).click();
    await expect(page.locator('#rv-ctitel')).toHaveText('MK Merge nebenzweig');
  });

  test('AK 3: #7 nicht linear und feste Antworten fremd_zu_viele, fremd_zu_gross — Grund über den Dateien, jede Datei als Folge', async ({ page }) => {
    await page.goto(reviewAdresse(k, 7));
    const rest = ' Darum steht jede Datei als Folge der Schritte der Aufgabe; einen zusammengefassten Diff der ganzen Aufgabe gibt es hier nicht.';
    await expect(page.locator('#rv-a0 .rv-ganz')).toHaveText('Die Commits der Aufgabe folgen nicht auf einem Zweig aufeinander.' + rest);
    await expect(page.locator('#rv-a0 section.df')).toHaveCount(2);
    await expect(page.locator('#rv-a0 section.df.df-fo')).toHaveCount(2);
    for (const [grund, satz] of [['fremd_zu_viele', 'Zwischen den Commits der Aufgabe liegen mehr als 1.000 fremde Commits.'], ['fremd_zu_gross', 'Die Commits zwischen denen der Aufgabe sind zu umfangreich, um zu erkennen, welche Dateien sie berühren.']]) {
      await page.unrouteAll();
      await festeAntwort(page, 7, json => ({ ...json, hinweise: [{ art: 'ganz_als_folge', grund }] }));
      await page.reload();
      await expect(page.locator('#rv-a0 .rv-ganz')).toHaveText(satz + rest);
    }
  });

  test('AK 3: unbekannte Art und dateien_gekappt — neutraler Satz, „2.000 von 2.431 Dateien gezeigt …“; kein Hash eines fremden Commits', async ({ page }) => {
    await festeAntwort(page, 2, json => ({ ...json, hinweise: [...json.hinweise, { art: 'neu_art' }, { art: 'dateien_gekappt', gezeigt: 2000, gesamt: 2431 }] }));
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-a0 .rv-hw')).toContainText('Die Antwort nennt einen Hinweis „neu_art“, den diese Ansicht nicht kennt.');
    await expect(page.locator('#rv-a0 .rv-hw')).toContainText('2.000 von 2.431 Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; sie lassen sich über „Ein Commit“ lesen.');
    expect(await page.locator('#review').textContent()).not.toContain(rep.f.slice(0, 7));
  });

  /* ── AK 4 Leere und Fehler ── */

  test('AK 4: #13 nichts einbezogen — „Keine Änderungen zu zeigen.“ mit dem Satz zum Gesamtbild, verwaist mit „einzeln ansehen“; die Leiste führt auf N1\'', async ({ page }) => {
    await page.goto(reviewAdresse(k, 13));
    await expect(page.locator('#rv-a0 .rv-abs-leer')).toHaveText('Keine Änderungen zu zeigen. Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.');
    await expect(page.locator('#rv-a0 .rv-hw').getByRole('link', { name: `Commit ${kurz(rep.n1s)} einzeln ansehen` })).toBeVisible();
    // umgestellt mit R00245: statt „Ein Commit“ führt der Eintrag von N1' der Leiste auf N1'
    await expect(page.locator(`${eintragVon(`kd:${rep.n1s}`)}[href]`)).toBeVisible();
    expect(decodeURIComponent(await page.locator(eintragVon(`kd:${rep.n1s}`)).getAttribute('href'))).toContain(`review?commit=kd:${rep.n1s}`);
  });

  test('AK 4: gemischt — verwaist und fehlt (#15) bzw. Merge und fehlt (feste Antwort): weiter der Satz zum Gesamtbild, nie „… keinen Diff.“', async ({ page }) => {
    const EINBEZOGEN = 'Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.';
    await page.goto(reviewAdresse(k, 15));
    await expect(page.locator('#rv-a0 .rv-abs-leer')).toHaveText(`Keine Änderungen zu zeigen. ${EINBEZOGEN}`);
    await expect(page.locator('#rv-a0 .rv-aus')).toContainText('nicht mehr im Repository');
    await expect(page.locator('#rv-a0')).not.toContainText('Zu den Verweisen dieser Anwendung gibt es keinen Diff.');
    await festeAntwort(page, 15, json => ({ ...json, hinweise: [{ art: 'ausgelassen', verweis: `kd:${rep.v2}`, zustand: 'fehlt' }, { art: 'merge_ausgelassen', verweis: `kd:${rep.mk}` }] }));
    await page.reload();
    await expect(page.locator('#rv-a0 .rv-abs-leer')).toHaveText(`Keine Änderungen zu zeigen. ${EINBEZOGEN}`);
  });

  test('AK 4: #14 ohne Verweise — „Keine Änderungen zu zeigen“ mit Satz und Rückweg, ohne Leiste', async ({ page }) => {
    await page.goto(reviewAdresse(k, 14));
    await expect(page.locator('.rv-meld')).toContainText('Keine Änderungen zu zeigen. An dieser Aufgabe sind keine Commit-Verweise hinterlegt.');
    await expect(page.getByRole('button', { name: 'Zurück zur Liste der Commits' })).toBeVisible();
    await expect(page.locator(LEISTE)).toHaveCount(0);
  });

  test('AK 4: #6 keine Einträge mit Diff — die Leiste nur mit „Alle Änderungen“, kein weiterer Tab-Stopp, kein Commit als Verweis im Baum; eingetippte Adresse wie R00207 (R00245 umgestellt)', async ({ page }) => {
    await page.goto(reviewAdresse(k, 6));
    await expect(page.locator('#rv-a0 .rv-abs-leer')).toHaveText('Keine Änderungen zu zeigen. Zu den Verweisen dieser Anwendung gibt es keinen Diff.');
    await expect(page.locator('#rv-a0 .rv-aus')).toContainText('nicht mehr im Repository');
    await expect(page.locator('#rv-seite-hw')).toContainText('Anwendung unbekannt');
    // umgestellt mit R00245 (FA 7): statt eines gedämpften „Ein Commit“ steht in der Leiste nur „Alle Änderungen“ ohne Zahlen
    await expect(page.locator(`${LEISTE} li > a`)).toHaveCount(1);
    await page.locator('#rv-u-alle').focus();
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement.closest('#rv-ls')))).toBe(false);
    const baum = await page.locator(LEISTE).ariaSnapshot();
    expect(baum).not.toMatch(/link "(Ein )?Commit/);
    await page.goto(reviewAdresse(k, 6, `kd:${rep.v2}`));
    // umgestellt mit R00224 FA 6: die Überschrift nennt den Verweis („Zu kd:<kurz> gibt es keinen Diff.“)
    await expect(page.locator('.rv-meld h2')).toHaveText(`Zu ${kurz(rep.v2)} gibt es keinen Diff.`);
  });

  test('AK 4/4a: #11 — Abschnitt wb mit Zeitgrenze rot, mit Antwortbudget amber, mit Netzabbruch „keine Verbindung“; kd und xx lesbar; „Erneut versuchen“ liest einmal, Fokus auf „Anwendung wb“; Meldung ohne Live-Rolle', async ({ page }) => {
    for (const [fall, wert, satz, klasse] of [
      ['Zeitgrenze', { status: 503, body: { fehler: 'Git antwortete nicht' } }, 'Die Änderungen der Anwendung wb ließen sich nicht lesen: Git antwortete nicht (503).', 'fehl'],
      ['Antwortbudget', { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } }, 'Server ausgelastet (Antwortbudget). Die Änderungen der Anwendung wb wurden nicht gelesen. Es wird nicht von selbst wiederholt.', 'warn'],
      ['Netz', 'abbrechen', 'Die Änderungen der Anwendung wb ließen sich nicht lesen: keine Verbindung zum Programm.', 'fehl'],
    ]) {
      await page.unrouteAll();
      await page.goto('about:blank');
      const z = zaehlen(page);
      const h = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
      await page.goto(reviewAdresse(k, 11));
      await expect.poll(() => h.angehalten(), fall).toBe(1);
      h.frei(0, wert);
      const meldung = page.locator(`#rv-a1 .rv-abs-f.${klasse}`);
      await expect(meldung, fall).toHaveText(new RegExp(`^${satz.replace(/[.()]/g, '\\$&')}Erneut versuchen$`));
      // umgestellt mit R00230 AK 8: keine Live-Rolle an der Meldung, angesagt wird einmal in #rv-ansage (ADR-0018 N4)
      expect(await meldung.evaluate(e => [e.getAttribute('role'), e.getAttribute('aria-live')]), fall).toEqual([null, null]);
      await expect(page.locator('#rv-a2 h2')).toHaveText(/^Anwendung xx/);
      await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
      await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
      await expect(page.locator('#rv-ansage')).toContainText('ohne Anwendung wb: ließ sich nicht lesen');
      const vorher = z.diff.length;
      await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
      await expect(page.locator('#rv-a1-t')).toBeFocused();
      await expect.poll(() => h.angehalten()).toBe(2);
      h.frei(1);
      await expect(page.locator('#rv-a1 .rv-cl')).toBeVisible();
      expect(z.diff.length - vorher, fall).toBe(1);
      await expect(page.locator('#rv-ansage')).not.toContainText('ohne Anwendung');
    }
  });

  /* ── AK 5 Zeichenbudget seitenweit ── */

  test('AK 5 (a): kd vier Dateien zu 2.250, wb eine zu 1.500 — die Datei von wb bleibt zu (Budget über die Seite)', async ({ page }) => {
    await festeAntwort(page, 11, (json, url) => {
      const anw = url.searchParams.get('anwendung');
      if (anw === 'wb') return { anwendung: 'wb', commits: [commitEintrag('wb', rep.w1, 'W')], dateien: [netto('w.dat', 1500, geaendert('w.dat'))], hinweise: [] };
      if (anw === 'xx') return { anwendung: 'xx', commits: [commitEintrag('xx', rep.x1, 'X')], dateien: [], hinweise: [] };
      return { anwendung: 'kd', commits: [commitEintrag('kd', rep.k1, 'K')], dateien: [1, 2, 3, 4].map(n => netto(`b${n}.dat`, 2250, geaendert(`b${n}.dat`))), hinweise: [{ art: 'weitere_anwendungen', anwendungen: ['wb', 'xx'] }] };
    });
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a2 h2')).toHaveText(/1 Commit/);
    expect(await offeneDateien(page)).toEqual(['rv-d0-0', 'rv-d0-1', 'rv-d0-2', 'rv-d0-3']);
    await expect(page.locator('#rv-dk1-0')).toHaveAttribute('aria-expanded', 'false');
  });

  test('AK 5 (b)/(c): Folge 3 × 2.800 nach 2.000 ganz zu, danach 100 zu; erste Datei der Seite als Folge 4 × 2.800 mit Schritt ohne patch ganz offen', async ({ page }) => {
    let fall = 'b';
    await festeAntwort(page, 2, () => {
      const folge = (...je) => ({ pfad: 'f.dat', plus: 0, minus: 0, binaer: false, schritte: je.map((n, j) => (n === null ? schritt('kd', rep.k1, 2, { gross: true, patch: undefined }) : schritt('kd', j % 2 ? rep.k2 : rep.k1, n))) });
      if (fall === 'b') return { anwendung: 'kd', commits: [commitEintrag('kd', rep.k1, 'K1'), commitEintrag('kd', rep.k2, 'K2')], dateien: [netto('a.dat', 2000, geaendert('a.dat')), folge(2800, 2800, 2800), netto('z.dat', 100)], hinweise: [] };
      return { anwendung: 'kd', commits: [commitEintrag('kd', rep.k1, 'K1'), commitEintrag('kd', rep.k2, 'K2')], dateien: [folge(2800, 2800, null, 2800, 2800), netto('z.dat', 100)], hinweise: [] };
    });
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-dk0-2')).toBeVisible();
    expect(await offeneDateien(page)).toEqual(['rv-d0-0']);
    fall = 'c';
    await page.reload();
    await expect(page.locator('#rv-dk0-1')).toBeVisible();
    expect(await offeneDateien(page)).toEqual(['rv-d0-0']);
    await expect(page.locator('#rv-d0-0 .fs .df-sc')).toHaveCount(4);
  });

  /* ── AK 6 Reihe ── */

  for (const breite of [320, 1280]) {
    test(`AK 6 (${breite} px): #11 mit gehaltenem wb — kd steht, wb „lädt …“, xx „wartet“; Leiste zählt nur kd; Nachladen vor xx; nie > 1 Anfrage; Insel bleibt; Live ohne Anfrage`, async ({ page }) => {
      await breiteSetzen(page, breite, 800);
      const z = zaehlen(page);
      await page.route(url => istDiff(url, 11) && !url.searchParams.has('anwendung') && !url.searchParams.has('datei'), async route => {
        const echt = await route.fetch();
        const json = await echt.json();
        json.dateien[1] = { ...json.dateien[1], nachladen: true, patch: undefined };
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
      });
      const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
      await page.goto(reviewAdresse(k, 11));
      await aufklapperOeffnen(page);
      await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
      await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
      await expect(page.locator('#rv-a1 .rv-abs-zust')).toHaveText('Lädt die Änderungen der Anwendung wb …');
      await expect(page.locator('#rv-a2 .zw')).toHaveText('wartet');
      await expect(page.locator('#rv-a2 .rv-abs-zust')).toHaveText('Wartet, bis die Anwendung wb geladen ist …');
      await expect(page.locator('#rv-summe')).toHaveText('2 Dateien · +5 −2 · Anwendung wb lädt noch …');
      await page.evaluate(() => { document.getElementById('rv-insel').kdMarke = 'B3'; });
      // Leseposition: Kopf des ersten Schritts von kd
      const kante = () => page.locator('#rv-d0-0-0 .fs-k').evaluate(e => e.getBoundingClientRect().top);
      await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
      await expect(page.locator('#rv-d0-1 .df-wartet')).toHaveText('Wartet, bis die Anwendung wb geladen ist …');
      await expect(page.locator('#rv-dk0-1')).toBeFocused();
      await page.locator('#rv-d0-0-0 .fs-k').evaluate(e => e.scrollIntoView({ block: 'start' }));
      const vorher = await kante();
      wb.frei(0);
      await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
      await expect(page.locator('#rv-d0-1 table.dz')).toBeVisible();
      expect(z.diff).toEqual(['', '?anwendung=wb', '?datei=k.dat&anwendung=kd', '?anwendung=xx']);
      expect(z.hoechstens).toBe(1);
      expect(Math.abs((await kante()) - vorher)).toBeLessThanOrEqual(1);
      expect(await page.evaluate(() => document.getElementById('rv-insel').kdMarke)).toBe('B3');
      // Live-Ereignis an #11: keine Anfrage, dieselbe Insel
      await liveBereit(page);
      const anzahl = z.diff.length;
      const antwort = await page.request.post(`${k.adresse}api/aufgaben/11/kommentare`, { headers: AGENT, data: { text: 'live' } });
      expect(antwort.ok()).toBe(true);
      await page.waitForFunction(() => document.getElementById('rv-insel').kdMarke === 'B3');
      expect(z.diff.length).toBe(anzahl);
    });
  }

  /* ── AK 7 Nachladen mit anwendung= ── */

  test('AK 7: README.dat in kd und wb mit nachladen — datei=README.dat&anwendung=<kürzel> ohne commit, jede zeigt ihren Inhalt', async ({ page }) => {
    const z = zaehlen(page);
    await festeAntwort(page, 11, (json, url) => {
      const anw = url.searchParams.get('anwendung');
      const datei = url.searchParams.get('datei');
      const k2 = anw || 'kd';
      if (datei) return { anwendung: k2, commits: [commitEintrag(k2, rep.k1, 'R')], dateien: [netto('README.dat', 2, { patch: `@@ -0,0 +1 @@\n+Inhalt von ${k2}\n` })], hinweise: [] };
      const weitere = anw ? [] : [{ art: 'weitere_anwendungen', anwendungen: ['wb'] }];
      return { anwendung: k2, commits: [commitEintrag(k2, rep.k1, 'R')], dateien: [netto('README.dat', 2, { nachladen: true, patch: undefined })], hinweise: weitere };
    });
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a1 .rv-cl')).toBeVisible();
    await page.locator('#rv-d1-0').getByRole('button', { name: 'Nachladen' }).click();
    await expect(page.locator('#rv-d1-0 table.dz')).toContainText('Inhalt von wb');
    await page.locator('#rv-d0-0').getByRole('button', { name: 'Nachladen' }).click();
    await expect(page.locator('#rv-d0-0 table.dz')).toContainText('Inhalt von kd');
    expect(z.diff.filter(s => s.includes('datei='))).toEqual(['?datei=README.dat&anwendung=wb', '?datei=README.dat&anwendung=kd']);
  });

  test('AK 7: Standardanwendung (Kürzel leer) — datei= trägt das leere anwendung=, nie weggelassen', async ({ page }) => {
    const z = zaehlen(page);
    await festeAntwort(page, 2, (json, url) => {
      if (url.searchParams.has('datei')) return { anwendung: '', commits: [], dateien: [{ neu: 'k.dat', status: 'A', plus: 3, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -0,0 +1,3 @@\n+k1\n+k2\n+k3\n' }], hinweise: [] };
      return { ...json, anwendung: '', dateien: [json.dateien[0], { ...json.dateien[1], nachladen: true, patch: undefined }] };
    });
    await page.goto(reviewAdresse(k, 2));
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
    await expect(page.locator('#rv-d0-1 table.dz')).toBeVisible();
    expect(z.diff.filter(s => s.includes('datei='))).toEqual(['?datei=k.dat&anwendung=']);
  });

  test('AK 7: Folge-Datei mit gross → „Änderungen anzeigen“ ersetzt den Eintrag, alle Schritte offen; zu_gross_zum_anzeigen ohne Knopf, Schrittköpfe als Verweise', async ({ page }) => {
    let zuGross = false;
    await festeAntwort(page, 2, (json, url) => {
      const a = json.dateien[0];
      if (url.searchParams.has('datei')) {
        if (zuGross) return { ...json, dateien: [{ ...a, schritte: a.schritte.map(s => ({ ...s, gross: true, patch: undefined })) }], hinweise: [{ art: 'zu_gross_zum_anzeigen', datei: 'a.dat' }] };
        return { ...json, dateien: [a], hinweise: [] };
      }
      return { ...json, dateien: [{ ...a, schritte: [a.schritte[0], { ...a.schritte[1], gross: true, patch: undefined }] }, json.dateien[1]] };
    });
    await page.goto(reviewAdresse(k, 2));
    await page.locator('#rv-d0-0').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(page.locator('#rv-d0-0 .fs table.dz')).toHaveCount(2);
    await expect(page.locator('#rv-dk0-0')).toBeFocused();
    zuGross = true;
    await page.reload();
    await page.locator('#rv-d0-0').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(page.locator('#rv-d0-0 .df-hin').first()).toHaveText('Zu groß zum Anzeigen. Es stehen nur die Zahlen: +2 −2. Jeder Schritt lässt sich über seinen Kopf einzeln ansehen.');
    await expect(page.locator('#rv-d0-0 a.fs-l')).toHaveCount(2);
    // R00236: „Pfad“ im Kopf ist ein Knopf; im Inhalt steht keiner
    await expect(page.locator('#rv-d0-0 .df-inhalt button.btn')).toHaveCount(0);
  });

  test('AK 7a: Nachladen mit 503 an Netto- und Folge-Datei — Fehler an der Datei, Fokus auf dem Kopf, wartende Anwendung startet, „Erneut versuchen“ liest einmal', async ({ page }) => {
    const z = zaehlen(page);
    await page.route(url => istDiff(url, 11) && !url.searchParams.has('anwendung') && !url.searchParams.has('datei'), async route => {
      const echt = await route.fetch();
      const json = await echt.json();
      json.dateien = [{ ...json.dateien[0], schritte: json.dateien[0].schritte.map(s => ({ ...s, gross: true, patch: undefined })) }, { ...json.dateien[1], nachladen: true, patch: undefined }];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });
    const datei = await halten(page, url => istDiff(url, 11) && url.searchParams.has('datei'));
    const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
    await page.locator('#rv-d0-0').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    wb.frei(0);
    await expect.poll(() => datei.angehalten()).toBe(1);
    datei.frei(0, { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } });
    await expect(page.locator('#rv-d0-1 .df-hin.warn')).toContainText('Server ausgelastet (Antwortbudget).');
    await expect.poll(() => datei.angehalten()).toBe(2);
    datei.frei(1, { status: 503, body: { fehler: 'Git antwortete nicht' } });
    await expect(page.locator('#rv-d0-0 .df-hin.fehl')).toContainText('Zeitgrenze überschritten.');
    await expect(page.locator('#rv-dk0-0')).toBeFocused();
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
    const vorher = z.diff.length;
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect.poll(() => datei.angehalten()).toBe(3);
    datei.frei(2);
    await expect(page.locator('#rv-d0-1 table.dz')).toBeVisible();
    expect(z.diff.length - vorher).toBe(1);
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });

  /* ── AK 8 Lauf-Kennung, Rückkehr, Live ── */

  test('AK 8 (1)/(2): Umschalten bricht die laufende Anfrage wb ab; ihre späte Antwort erscheint nie, xx wird nicht gelesen; die Rückkehr liest genau einmal neu', async ({ page }) => {
    const z = zaehlen(page);
    const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
    await page.locator(ERSTER_COMMIT).click();
    await expect(page.locator('#rv-pos')).toBeVisible();
    await expect.poll(() => z.abgebrochen).toEqual(['?anwendung=wb']);
    const vorher = z.diff.filter(s => s === '').length;
    await page.locator('#rv-u-alle').click();
    await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
    wb.frei(0);
    await expect.poll(() => wb.angehalten()).toBe(2);
    expect(z.diff.filter(s => s === '').length - vorher).toBe(1);
    await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
    expect(z.diff.filter(s => s === '?anwendung=xx')).toEqual([]);
    wb.frei(1);
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
  });

  test('AK 8 (3): #2 im echten Programm dreimal hin und zurück — jedes Mal der Abschnitt kd, nie „(304)“, kein eigener If-None-Match', async ({ page }) => {
    // jeder Aufruf von fetch an …/diff mit den Köpfen, die die Seite selbst setzt (der Browser fragt von selbst bedingt nach)
    await page.addInitScript(() => {
      window.kdDiffKoepfe = [];
      const echt = window.fetch;
      window.fetch = (u, o = {}) => { if (String(u).includes('/diff')) window.kdDiffKoepfe.push(JSON.stringify(o.headers || {})); return echt(u, o); };
    });
    await page.goto(reviewAdresse(k, 2));
    await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
    for (let i = 0; i < 3; i++) {
      await page.locator(ERSTER_COMMIT).click();
      await expect(page.locator('#rv-pos')).toBeVisible();
      await page.locator('#rv-u-alle').click();
      await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
      await expect(page.locator('#review')).not.toContainText('304');
    }
    const koepfe = await page.evaluate(() => window.kdDiffKoepfe);
    expect(koepfe.length, 'je Ansicht eine Anfrage: 1 + 3 × (Ein Commit + Alle)').toBe(7);
    expect(koepfe.filter(k => /if-none-match/i.test(k))).toEqual([]);
  });

  test('AK 8 (4): Live-Ereignis an #2 — dieselbe Insel, Klappen, Auswahl und Leseposition bleiben, keine Anfrage', async ({ page }) => {
    await breiteSetzen(page, 1280, 500);
    const z = zaehlen(page);
    await page.goto(reviewAdresse(k, 2));
    await liveBereit(page);
    await page.locator('#rv-dk0-1').click();
    await expect(page.locator('#rv-dk0-1')).toHaveAttribute('aria-expanded', 'false');
    await page.evaluate(() => { document.getElementById('rv-insel').kdMarke = 'live'; const r = document.createRange(); r.selectNodeContents(document.querySelector('#rv-d0-0 .df-folge')); getSelection().removeAllRanges(); getSelection().addRange(r); document.getElementById('review').scrollTop = 60; });
    const anzahl = z.diff.length;
    const antwort = await page.request.post(`${k.adresse}api/aufgaben/2/kommentare`, { headers: AGENT, data: { text: 'live' } });
    expect(antwort.ok()).toBe(true);
    await expect(page.locator('#fenster, #over')).toHaveCount(1);
    await page.waitForFunction(() => document.getElementById('rv-insel').kdMarke === 'live');
    expect(await page.evaluate(() => [getSelection().toString().startsWith('Fremde Commits'), document.getElementById('review').scrollTop])).toEqual([true, 60]);
    await expect(page.locator('#rv-dk0-1')).toHaveAttribute('aria-expanded', 'false');
    expect(z.diff.length).toBe(anzahl);
  });

  /* ── AK 9 Breite, Ziele, Kontrast ── */

  for (const breite of [320, 414, 641, 768, 980, 1280]) {
    test(`AK 9: ${breite} px hell und dunkel — kein Querscrollen der Seite; Textspalten ≥ 160 px bei 641–980; Zustandswort und Zahlen ganz sichtbar`, async ({ page }) => {
      await breiteSetzen(page, breite, 900);
      for (const nr of [2, 12]) {
        await page.goto(reviewAdresse(k, nr));
        await aufklapperOeffnen(page);
        await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
        for (const farbe of ['light', 'dark']) {
          await thema(page, farbe);
          expect(await breiteMessen(page, `Alle ${nr} ${breite} ${farbe}`)).toEqual([]);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
          const lage = await page.evaluate(() => {
            const w = sel => Math.min(...[...document.querySelectorAll(sel)].filter(e => e.checkVisibility()).map(e => e.getBoundingClientRect().width));
            const abgeschnitten = [...document.querySelectorAll('#rv-insel .df-k .z, #rv-insel .df-k .st, #rv-insel .fs-l .z, #rv-insel .fs-l .st')].filter(e => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > document.documentElement.clientWidth);
            return { spalten: { pfad: w('#rv-insel .dn .p'), titel: w('#rv-insel .rv-cl .t'), schritt: w('#rv-insel .fs-t'), code: w('#rv-insel .df-sc') }, abgeschnitten: abgeschnitten.length };
          });
          expect(lage.abgeschnitten).toBe(0);
          if (breite >= 641 && breite <= 980 && nr === 2) for (const [spalte, px] of Object.entries(lage.spalten)) expect(px, `${spalte} bei ${breite}`).toBeGreaterThanOrEqual(160);
        }
      }
      if (breite === 320) {
        // umgestellt mit R00245 (FA 10): unter 600 px stehen die Einträge der Leiste untereinander, keiner ragt aus der Breite
        const leiste = await page.locator(LEISTE).evaluate(e => [...e.querySelectorAll('li > a')].every(a => a.getBoundingClientRect().right <= document.documentElement.clientWidth));
        expect(leiste).toBe(true);
      }
    });
  }

  test('AK 9: feiner Zeiger — Leiste, Schrittköpfe, „einzeln ansehen“ und Verweise der Commit-Liste ≥ 24 × 24 px', async ({ page }) => {
    await page.goto(reviewAdresse(k, 12));
    await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
    const klein = await page.evaluate(() => [...document.querySelectorAll('#rv-ls li > a, .rv-einzeln, .rv-cv, .fs-l')].map(e => { const r = e.getBoundingClientRect(); return [e.className || e.id, Math.round(r.width), Math.round(r.height)]; }).filter(([, b, h]) => b < 24 || h < 24));
    expect(klein).toEqual([]);
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'Alle 12' })).toEqual([]);
  });

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
    test('AK 9: grober Zeiger — Leiste, Schrittköpfe, „einzeln ansehen“ und Verweise der Commit-Liste ≥ 48 × 48 px', async ({ page }) => {
      for (const nr of [2, 12]) {
        await page.goto(reviewAdresse(k, nr));
        await aufklapperOeffnen(page);
        await expect(page.locator('#rv-a0 .rv-cl')).toBeVisible();
        const klein = await page.evaluate(() => [...document.querySelectorAll('#rv-ls li > a, .rv-einzeln, .rv-cv, .fs-l')].map(e => { const r = e.getBoundingClientRect(); return [e.className || e.id, Math.round(r.width), Math.round(r.height)]; }).filter(([, b, h]) => b < 48 || h < 48));
        expect(klein).toEqual([]);
        expect(await zieleMessen(page, { zeiger: 'touch', ansicht: `Alle ${nr} 414` })).toEqual([]);
      }
    });
  });

  for (const farbe of ['light', 'dark']) {
    test(`AK 9: Kontrast ${farbe} — Leiste in Ruhe, Hover, Fokus, gewählt, gewählt + Hover; Verweise in Ruhe und Hover; lädt, wartet, Hinweise, Fehler amber und rot`, async ({ page }) => {
      const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
      await page.goto(reviewAdresse(k, 11));
      await thema(page, farbe);
      await expect(page.locator('#rv-a2 .zw')).toHaveText('wartet');
      const fehler = [];
      const textPruefen = async wo => {
        for (const m of await kontrastMessen(page, ['#review'])) if (m.wert < 4.5) fehler.push(`${wo}: ${m.element} „${String(m.text).slice(0, 30)}“ ${m.wert.toFixed(2)}`);
      };
      const randPruefen = async (sel, wo) => {
        const [rand, aussen] = await page.locator(sel).evaluate(e => { let g = e.parentElement; while (getComputedStyle(g).backgroundColor === 'rgba(0, 0, 0, 0)') g = g.parentElement; return [getComputedStyle(e).borderTopColor, getComputedStyle(g).backgroundColor]; });
        if ((await kontrastFarben(page, rand, aussen)) < 3) fehler.push(`${wo}: Rand ${sel}`);
      };
      const symbolePruefen = async wo => {
        const marken = await page.evaluate(() => [...document.querySelectorAll('#review .zw svg, #review .rv-abs-zust svg, #review .rv-abs-f svg, #review .df-hin svg')].map(m => { let g = m.parentElement; while (getComputedStyle(g).backgroundColor === 'rgba(0, 0, 0, 0)') g = g.parentElement; return [getComputedStyle(m).color, getComputedStyle(g).backgroundColor]; }));
        for (const [tinte, grund] of marken) if ((await kontrastFarben(page, tinte, grund)) < 3) fehler.push(`${wo}: Symbol`);
      };
      await textPruefen('lädt und wartet');
      await symbolePruefen('lädt und wartet');
      // umgestellt mit R00245 (FA 5, PO Z. 542): der Rand der Einträge der Leiste ist --kd-muted, eine .seg der Anwendung behält ihren
      await randPruefen(ERSTER_COMMIT, 'Leiste');
      const [leistenRand, muted, segRand, segBasis] = await page.evaluate(() => {
        const probe = (stil, klasse = '') => { const p = document.createElement('div'); if (klasse) p.className = klasse; Object.assign(p.style, stil); document.body.append(p); const f = getComputedStyle(p).borderTopColor; const c = getComputedStyle(p).color; p.remove(); return [f, c]; };
        const seg = probe({}, 'seg');
        const basis = probe({ border: '1px solid var(--kd-line-strong)' });
        return [getComputedStyle(document.querySelector('#rv-l1')).borderTopColor, probe({ color: 'var(--kd-muted)' })[1], seg[0], basis[0]];
      });
      expect(leistenRand).toBe(muted);
      expect(segRand).toBe(segBasis);
      for (const [zustand, handlung] of [['Hover', () => page.locator(ERSTER_COMMIT).hover()], ['gewählt + Hover', () => page.locator('#rv-u-alle').hover()], ['Fokus', () => page.locator(ERSTER_COMMIT).focus()]]) {
        await handlung();
        await textPruefen(`Leiste ${zustand}`);
      }
      wb.frei(0, { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } });
      await expect(page.locator('#rv-a1 .rv-abs-f.warn')).toBeVisible();
      await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
      await textPruefen('Fehler amber');
      await symbolePruefen('Fehler amber');
      for (const sel of ['#rv-a0 .fs-l', '#rv-a0 .rv-cv']) {
        await page.locator(sel).first().hover();
        await textPruefen(`Hover ${sel}`);
        const [tinte, hover] = await page.locator(sel).first().evaluate(e => [getComputedStyle(e).color, (() => { const p = document.createElement('p'); p.style.color = 'var(--kd-link-hover)'; document.body.append(p); const f = getComputedStyle(p).color; p.remove(); return f; })()]);
        if (tinte === hover && farbe === 'light') fehler.push(`Hover ${sel}: Farbe aus a:hover`);
      }
      // Fokusring eines Eintrags der Leiste ≥ 3:1
      await page.locator(ERSTER_COMMIT).focus();
      const [ring, grund] = await page.locator(ERSTER_COMMIT).evaluate(e => { const s = getComputedStyle(e); return [s.outlineColor, getComputedStyle(e.closest('.rv-ls')).backgroundColor]; });
      if ((await kontrastFarben(page, ring, grund)) < 3) fehler.push('Fokusring Leiste');
      await page.goto(reviewAdresse(k, 12));
      await thema(page, farbe);
      await expect(page.locator('#rv-a0 .rv-hw')).toBeVisible();
      await textPruefen('Hinweise #12');
      await page.locator('#rv-a0 .rv-einzeln').first().hover();
      await textPruefen('Hover einzeln ansehen');
      expect(fehler).toEqual([]);
    });
  }

  /* ── AK 10 Tastatur, Fokus, Ansage ── */

  test('AK 10: Tabulatorfolge Rückweg, Leiste, Alle einklappen, dann je Abschnitt Hinweis-Verweise, Commit-Liste, Dateien; Fokus bleibt bei Ankunft', async ({ page }) => {
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
    // umgestellt mit R00245 (AK 3): statt „Alle Änderungen | Ein Commit“ folgen alle Einträge der Leiste in ihrer Reihenfolge
    const leiste = await page.locator(`${LEISTE} li > a`).evaluateAll(as => as.map(a => a.id));
    await page.locator('#rv-rueckweg').focus();
    const folge = [];
    for (let i = 0; i < 6 + leiste.length; i++) {
      folge.push(await page.evaluate(() => { const e = document.activeElement; return e.id || e.className || e.tagName; }));
      await page.keyboard.press('Tab');
    }
    expect(folge.slice(0, 2 + leiste.length)).toEqual(['rv-rueckweg', ...leiste, 'rv-alle']);
    expect(folge[2 + leiste.length]).toBe('rv-cv');
  });

  test('AK 10: Fokus auf einem Schrittkopf von kd bleibt, während wb und xx ankommen; „Nachladen“ an einer wartenden Datei → Fokus auf ihrem Kopf, nie body', async ({ page }) => {
    await page.route(url => istDiff(url, 11) && !url.searchParams.has('anwendung') && !url.searchParams.has('datei'), async route => {
      const echt = await route.fetch();
      const json = await echt.json();
      json.dateien[1] = { ...json.dateien[1], nachladen: true, patch: undefined };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) });
    });
    const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
    const datei = await halten(page, url => istDiff(url, 11) && url.searchParams.has('datei'));
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
    await page.evaluate(() => { window.kdBody = 0; document.addEventListener('focusout', () => setTimeout(() => { if (document.activeElement === document.body) window.kdBody++; })); });
    await page.locator('#rv-d0-1').getByRole('button', { name: 'Nachladen' }).click();
    await expect(page.locator('#rv-d0-1 .df-wartet')).toBeVisible();
    await expect(page.locator('#rv-dk0-1')).toBeFocused();
    wb.frei(0);
    await expect.poll(() => datei.angehalten()).toBe(1);
    await expect(page.locator('#rv-d0-1 .df-laedt')).toBeVisible();
    await expect(page.locator('#rv-dk0-1')).toBeFocused();
    datei.frei(0);
    await expect(page.locator('#rv-d0-1 table.dz')).toBeVisible();
    await expect(page.locator('#rv-dk0-1')).toBeFocused();
    await page.locator('#rv-d0-0-0 .fs-l').focus();
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
    await expect(page.locator('#rv-d0-0-0 .fs-l')).toBeFocused();
    expect(await page.evaluate(() => window.kdBody)).toBe(0);
  });

  test('AK 10: Ansage — Region leer vor der ersten Antwort, genau eine Textänderung nach dem letzten Abschnitt; mit wb 503 „ohne Anwendung wb“, nach Erneut einmal neu', async ({ page }) => {
    const erste = await halten(page, url => istDiff(url, 11) && !url.searchParams.has('anwendung'));
    const wb = await halten(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb');
    await page.goto(reviewAdresse(k, 11));
    const region = page.locator('#rv-ansage');
    await expect(region).toHaveText('');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await expect(region).toHaveAttribute('aria-atomic', 'true');
    await page.evaluate(() => { window.kdAnsagen = []; const r = document.getElementById('rv-ansage'); window.kdRegion = r; new MutationObserver(() => window.kdAnsagen.push(document.getElementById('rv-ansage').textContent)).observe(r, { childList: true, characterData: true, subtree: true }); });
    erste.frei(0);
    await expect(page.locator('#rv-a1 .zw')).toHaveText('lädt …');
    wb.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht' } });
    await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
    await expect(region).toContainText('ohne Anwendung wb: ließ sich nicht lesen');
    expect(await page.evaluate(() => [window.kdAnsagen.length, document.getElementById('rv-ansage') === window.kdRegion])).toEqual([1, true]);
    await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect.poll(() => wb.angehalten()).toBe(2);
    wb.frei(1);
    await expect(page.locator('#rv-a1 .rv-cl')).toBeVisible();
    await expect(region).not.toContainText('ohne Anwendung');
    // „Erneut versuchen“ leert die Region sofort (AK 11), der neue Text kommt einmal, wenn alle Abschnitte entschieden sind
    expect(await page.evaluate(() => window.kdAnsagen.slice(1))).toEqual(['', await region.textContent()]);
  });
});
