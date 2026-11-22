// R00230 Ein gescheiterter Abschnitt auf „Alle Änderungen“ wird genau einmal angesagt (Karte #245, I0220, ADR-0018 N4) — AK 2–4, 6, 7
// im echten Programm gegen echtes Git. Ausgangslage: gesamt-hilfen.js (#11 mit kd, wb, xx); für AK 6 commits-hilfen.js („Commits“),
// nachfolger-hilfen.js (Suche und Ersetzen) und review-hilfen.js („Ein Commit“). Antworten von `wb` (und `xx`) werden über ein
// Promise gehalten und freigegeben, ohne Schlafzeiten. Gezählt wird mit `ansagenZaehlen` ab der Freigabe; das Zählfenster endet nach
// der letzten Zusicherung des Durchlaufs (S1 der UX-Vorprüfung).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit, reiter, mutanteEinsetzen, ansagenZaehlen } = require('./hilfen');
const { gesamtRepositorien, gesamtVorbereiten, istLadesatz } = require('./gesamt-hilfen');
const { geteiltesRepository, ausgangslageVorbereiten } = require('./commits-hilfen');
const { geteiltesNachfolgerRepository, nachfolgerVorbereiten } = require('./nachfolger-hilfen');
const { reviewRepository, reviewVorbereiten } = require('./review-hilfen');

/* ── Treiber: Adresse, gehaltene Antworten, Abschnitt ── */
const reviewAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const diffVon = (...anwendungen) => url => url.pathname === '/api/aufgaben/11/diff' && anwendungen.includes(url.searchParams.get('anwendung'));

/** Hält passende Antworten an, bis `frei(i, wert)` die i-te freigibt: `{ status, body }` antwortet, 'abbrechen' bricht ab, 'weiter'
    lässt die echte Antwort durch. */
async function halten(page, muster) {
  const tore = [];
  await page.route(muster, async route => {
    let frei;
    const tor = new Promise(r => { frei = r; });
    tore.push(frei);
    const wert = await tor;
    const still = p => p.catch(() => {});
    if (wert === 'abbrechen') return still(route.abort());
    if (wert === 'weiter') return still(route.continue());
    return still(route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify(wert.body) }));
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

const liveAttribute = meldung => meldung.evaluate(e => ({ role: e.getAttribute('role'), live: e.getAttribute('aria-live') }));
const OHNE_LIVE = { role: null, live: null };

/* ── DSL: Fehlerfälle F1–F5 an einer Anwendung, Einträge einordnen ── */
const GRUND = 'Ordner fehlt: /nirgends/S';
/** Die fünf Fehlerfälle aus R00230 „Ausgangslage“, je mit Antwort, Ton und sichtbarem Satz (unverändert). */
const fall = name => ({
  F1: { wert: { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } }, ton: 'warn', satz: `Server ausgelastet (Antwortbudget). Die Änderungen der Anwendung ${name} wurden nicht gelesen. Es wird nicht von selbst wiederholt.` },
  F2: { wert: { status: 503, body: { fehler: 'Git antwortete nicht' } }, ton: 'fehl', satz: `Die Änderungen der Anwendung ${name} ließen sich nicht lesen: Git antwortete nicht (503).` },
  F3: { wert: { status: 404, body: { zustand: 'repository_fehlt', grund: GRUND } }, ton: 'fehl', satz: `Das Repository der Anwendung ${name} ist nicht erreichbar.`, hinweis: GRUND },
  F4: { wert: { status: 500, body: { fehler: 'kaputt' } }, ton: 'fehl', satz: `Die Änderungen der Anwendung ${name} ließen sich nicht lesen: kaputt (500).` },
  F5: { wert: 'abbrechen', ton: 'fehl', satz: `Die Änderungen der Anwendung ${name} ließen sich nicht lesen: keine Verbindung zum Programm.` },
});

/** Einträge des Fensters getrennt: Ergebnis- bzw. Fehleransagen und Ladesätze (R00230 „Zählfenster“). */
const einordnen = eintraege => ({ ergebnisse: eintraege.filter(e => !istLadesatz(e)), ladesaetze: eintraege.filter(istLadesatz) });

/** Die Meldung am Abschnitt zeigt Satz, Ton, Symbol und „Erneut versuchen“ wie bisher; liefert ihre Live-Attribute (geprüft wird
    zuletzt, damit eine zweite Ansage als Zahl rot wird und nicht schon am Attribut). */
async function meldungSteht(page, a, f, bezeichnung) {
  const meldung = page.locator(`#rv-a${a} .rv-abs-f`);
  await expect(meldung, bezeichnung).toHaveClass(new RegExp(`\\b${f.ton}\\b`));
  if (f.hinweis) {
    await expect(meldung.locator('.rv-satz')).toHaveText(f.satz);
    await expect(meldung.locator('.rv-hin')).toHaveText(f.hinweis);
  } else {
    await expect(meldung.locator('p').first()).toHaveText(f.satz);
  }
  await expect(meldung.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  await expect(meldung.locator('svg').first()).toBeVisible();
  return liveAttribute(meldung);
}

test.describe('R00230 Ein gescheiterter Abschnitt, eine Ansage', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    k = await kanbanStarten(gesamtVorbereiten(gesamtRepositorien()));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /** #11 offen, `wb` gehalten; liefert Halter und Zähler. */
  async function elfMitWbGehalten(page, muster = diffVon('wb')) {
    const zaehler = await ansagenZaehlen(page);
    const h = await halten(page, muster);
    await page.goto(reviewAdresse(k, 11));
    await expect.poll(() => h.angehalten()).toBe(1);
    return { zaehler, h };
  }

  for (const name of ['F1', 'F2', 'F3', 'F4', 'F5']) {
    test(`AK 2: #11 — wb endet mit ${name}: genau eine Ergebnisansage, in #rv-ansage, höchstens der Ladesatz von xx daneben; .rv-abs-f ohne role und aria-live`, async ({ page }) => {
      const f = fall('wb')[name];
      const { zaehler, h } = await elfMitWbGehalten(page);
      await zaehler.beginnen();
      h.frei(0, f.wert);
      await expect(page.locator('#rv-ansage')).toContainText('ohne Anwendung wb: ließ sich nicht lesen');
      await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
      const attribute = await meldungSteht(page, 1, f, name);
      const { ergebnisse, ladesaetze } = einordnen(await zaehler.eintraege());
      expect(ergebnisse, name).toHaveLength(1);
      expect(ergebnisse[0].ort).toBe('#rv-ansage');
      expect(ergebnisse[0].text).toContain('ohne Anwendung wb: ließ sich nicht lesen');
      expect(ladesaetze.length, name).toBeLessThanOrEqual(1);
      for (const l of ladesaetze) expect(l.text).toMatch(/^Lädt die Änderungen der Anwendung xx /);
      expect(attribute, name).toEqual(OHNE_LIVE);
    });
  }

  test('AK 3: #11 — wb endet mit F2, xx mit F4, nacheinander freigegeben: genau eine Ergebnisansage in #rv-ansage, sie nennt beide', async ({ page }) => {
    const { zaehler, h } = await elfMitWbGehalten(page, diffVon('wb', 'xx'));
    await zaehler.beginnen();
    h.frei(0, fall('wb').F2.wert);
    await expect.poll(() => h.angehalten()).toBe(2);
    h.frei(1, fall('xx').F4.wert);
    await expect(page.locator('#rv-ansage')).toContainText('ohne Anwendung wb: ließ sich nicht lesen, ohne Anwendung xx: ließ sich nicht lesen.');
    const anWb = await meldungSteht(page, 1, fall('wb').F2, 'wb');
    const anXx = await meldungSteht(page, 2, fall('xx').F4, 'xx');
    const { ergebnisse, ladesaetze } = einordnen(await zaehler.eintraege());
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].ort).toBe('#rv-ansage');
    expect(ergebnisse[0].text).toContain('ohne Anwendung wb: ließ sich nicht lesen, ohne Anwendung xx: ließ sich nicht lesen.');
    expect(ladesaetze.length).toBeLessThanOrEqual(1);
    for (const l of ladesaetze) expect(l.text).toMatch(/^Lädt die Änderungen der Anwendung xx /);
    expect([anWb, anXx]).toEqual([OHNE_LIVE, OHNE_LIVE]);
  });

  for (const name of ['F1', 'F5']) {
    test(`AK 4: #11 — wb mit F1, „Erneut versuchen“ endet wieder mit ${name}: ab der Freigabe genau eine Ergebnisansage in #rv-ansage, sonst nichts; Fokus auf „Anwendung wb“`, async ({ page }) => {
      const { zaehler, h } = await elfMitWbGehalten(page);
      h.frei(0, fall('wb').F1.wert);
      await expect(page.locator('#rv-ansage')).toContainText('ohne Anwendung wb: ließ sich nicht lesen');
      await expect(page.locator('#rv-a2 .rv-cl')).toBeVisible();
      await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
      await expect(page.locator('#rv-a1-t')).toBeFocused();
      await expect.poll(() => h.angehalten()).toBe(2);
      await expect(page.locator('#rv-ansage')).toHaveText('');
      await zaehler.beginnen();
      h.frei(1, fall('wb')[name].wert);
      await expect(page.locator('#rv-ansage')).toContainText('ohne Anwendung wb: ließ sich nicht lesen');
      const attribute = await meldungSteht(page, 1, fall('wb')[name], name);
      await expect(page.locator('#rv-a1-t')).toBeFocused();
      const eintraege = await zaehler.eintraege();
      expect(eintraege, name).toHaveLength(1);
      expect(eintraege[0].ort).toBe('#rv-ansage');
      expect(eintraege[0].text).toContain('ohne Anwendung wb: ließ sich nicht lesen');
      expect(attribute, name).toEqual(OHNE_LIVE);
    });
  }

  test('AK 7: #11 ohne Fehler, ab dem Öffnen — wb und xx sagen ihren Start je genau einmal in ihrer Region an, kd und die Seite höchstens einmal; #rv-ansage genau einmal „Alle Änderungen der Aufgabe #11: …“, nie einen Start', async ({ page }) => {
    const zaehler = await ansagenZaehlen(page);
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('#rv-ansage')).toHaveText(/^Alle Änderungen der Aufgabe #11: /);
    for (const a of [0, 1, 2]) await expect(page.locator(`#rv-a${a} .rv-cl`)).toBeVisible();
    const eintraege = await zaehler.eintraege();
    const start = kuerzel => eintraege.filter(e => e.text.startsWith(`Lädt die Änderungen der Anwendung ${kuerzel} `));
    for (const [kuerzel, a] of [['wb', 1], ['xx', 2]]) {
      expect(start(kuerzel), kuerzel).toHaveLength(1);
      expect(start(kuerzel)[0].ort, kuerzel).toMatch(new RegExp(`^#rv-a${a} p\\.rv-abs-zust`));
    }
    expect(start('kd').length, 'kd').toBeLessThanOrEqual(1);
    const seite = eintraege.filter(e => e.text.startsWith('Liest die Änderungen der Aufgabe'));
    expect(seite.length, 'Ladesatz der Seite').toBeLessThanOrEqual(1);
    const ansage = eintraege.filter(e => e.ort === '#rv-ansage');
    expect(ansage.map(e => e.text)).toEqual([await page.locator('#rv-ansage').textContent()]);
    const uebrige = eintraege.filter(e => !start('wb').includes(e) && !start('xx').includes(e) && !start('kd').includes(e) && !seite.includes(e) && !ansage.includes(e));
    expect(uebrige).toEqual([]);
  });

  test('AK 7 (S2): kommt die Liste der Commits, während die erste Antwort noch gehalten ist, sagt die Seite ihren Start trotzdem nur einmal an', async ({ page }) => {
    const zaehler = await ansagenZaehlen(page);
    const h = await halten(page, url => url.pathname === '/api/aufgaben/11/diff' && !url.searchParams.has('anwendung'));
    await page.goto(reviewAdresse(k, 11));
    await expect.poll(() => h.angehalten()).toBe(1);
    await expect(page.locator('.rv-laedt')).toHaveText('Liest die Änderungen der Aufgabe …');
    await expect(page.locator('#rv-u-commit')).toHaveAttribute('href', /commit=/);
    h.frei(0, 'weiter');
    await expect(page.locator('#rv-ansage')).toHaveText(/^Alle Änderungen der Aufgabe #11: /);
    const seite = (await zaehler.eintraege()).filter(e => e.text.startsWith('Liest die Änderungen der Aufgabe'));
    expect(seite).toEqual([{ ort: expect.stringMatching(/rv-laedt/), text: 'Liest die Änderungen der Aufgabe …' }]);
  });
});

/* ── AK 6 Rückfallschutz: „Commits“ und „Ein Commit“ sagen je Fehler genau einmal an (heute grün) ── */

/** Genau eine Ergebnis- bzw. Fehleransage am erwarteten Ort, daneben höchstens ein Ladesatz. */
function genauEineAnsage(eintraege, ort, text, bezeichnung) {
  const { ergebnisse, ladesaetze } = einordnen(eintraege);
  expect(ergebnisse, bezeichnung).toEqual([{ ort, text }]);
  expect(ladesaetze.length, bezeichnung).toBeLessThanOrEqual(1);
}

test.describe('R00230 AK 6 „Commits“ — Lesen', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    const geteilt = geteiltesRepository();
    k = await kanbanStarten(ausgangslageVorbereiten(geteilt.rep, geteilt.basis));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  test('AK 6: #4 — Lesen scheitert mit 503: genau eine Fehleransage, in #commits-status', async ({ page }) => {
    const zaehler = await ansagenZaehlen(page);
    const h = await halten(page, url => url.pathname === '/api/aufgaben/4/commits');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="4"] .id').click();
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect.poll(() => h.angehalten()).toBe(1);
    await zaehler.beginnen();
    h.frei(0, { status: 503, body: { fehler: 'Git hängt' } });
    const satz = 'Die Commits ließen sich nicht lesen: Git hängt (503).';
    await expect(page.locator('#commits-status')).toHaveText(satz);
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    genauEineAnsage(await zaehler.eintraege(), '#commits-status', satz, 'Lesen 503');
  });
});

test.describe('R00230 AK 6 „Commits“ — Nachfolger suchen und ersetzen', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = geteiltesNachfolgerRepository().rep;
    k = await kanbanStarten(nachfolgerVorbereiten(rep));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  const GRUPPE = '#nf-gruppe';
  const suchKnopf = page => page.locator('#fenster tbody tr.cl-z').filter({ has: page.locator('th .cl-hash', { hasText: new RegExp(`^kd:${rep.k.slice(0, 7)}$`) }) }).getByRole('button', { name: 'Nachfolger suchen' });
  const ersetzenKnopf = page => page.locator(`${GRUPPE} .nf-k`).first().getByRole('button', { name: /^Ersetzen/ });
  async function commitsOeffnen(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator('#fenster tbody tr.cl-z')).toHaveCount(2);
  }

  test('AK 6: Suche nach dem Nachfolger scheitert mit 503, der Fokus ist vom Auslöser weggewandert (PO Z. 488): genau eine Fehleransage, in #commits-status', async ({ page }) => {
    await commitsOeffnen(page);
    const zaehler = await ansagenZaehlen(page);
    const h = await halten(page, url => /\/api\/aufgaben\/1\/commits\/[^/]+\/nachfolger$/.test(url.pathname));
    await suchKnopf(page).click();
    await page.locator('#commits-neu').focus();
    await expect.poll(() => h.angehalten()).toBe(1);
    await zaehler.beginnen();
    h.frei(0, { status: 503, body: { fehler: 'Git hängt' } });
    const satz = 'Der Nachfolger ließ sich nicht suchen: Git hängt (503).';
    await expect(page.locator(`${GRUPPE} #nf-erster`)).toHaveText(satz);
    await expect(page.locator('#commits-status')).toHaveText(satz);
    await expect(page.locator('#commits-neu')).toBeFocused();
    genauEineAnsage(await zaehler.eintraege(), '#commits-status', satz, 'Suche 503');
  });

  for (const [fall, antwort, satz] of [
    ['409 allgemein', { status: 409, body: { fehler: 'etwas anderes', verweis: 'kd:anderer' } }, 'Der Verweis ließ sich nicht ersetzen: etwas anderes (409).'],
    ['423', { status: 423, body: { fehler: 'Die Aufgabendatei ist defekt' } }, 'Der Verweis ließ sich nicht ersetzen: Die Aufgabendatei ist defekt (423).'],
  ]) {
    test(`AK 6: Schreiben am Kandidaten scheitert mit ${fall}: genau eine Fehleransage, in #nf-meld`, async ({ page }) => {
      await commitsOeffnen(page);
      await suchKnopf(page).click();
      await expect(ersetzenKnopf(page)).toBeVisible();
      const zaehler = await ansagenZaehlen(page);
      const h = await halten(page, url => url.pathname === '/api/aufgaben/1/commits/ersetzen');
      await ersetzenKnopf(page).click();
      await expect.poll(() => h.angehalten()).toBe(1);
      await zaehler.beginnen();
      h.frei(0, antwort);
      await expect(page.locator(`${GRUPPE} #nf-meld`)).toHaveText(satz);
      await expect(ersetzenKnopf(page)).toBeFocused();
      genauEineAnsage(await zaehler.eintraege(), '#nf-meld', satz, fall);
    });
  }
});

test.describe('R00230 AK 6 „Ein Commit“', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = reviewRepository().rep;
    k = await kanbanStarten(reviewVorbereiten(rep));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  const commitAdresse = (nr, verweis) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(verweis)}`;

  for (const [fall, wert, satz] of [
    ['503', { status: 503, body: { fehler: 'Git antwortete nicht innerhalb von 10 s' } }, 'Zeitgrenze überschritten. Der Diff ließ sich nicht lesen: Git antwortete nicht innerhalb von 10 s (503).'],
    ['500', { status: 500, body: { fehler: 'innen kaputt' } }, 'Der Diff ließ sich nicht lesen: innen kaputt (500).'],
  ]) {
    test(`AK 6: Diff endet mit ${fall}: genau eine Fehleransage, in der Seitenmeldung .rv-meld`, async ({ page }) => {
      const zaehler = await ansagenZaehlen(page);
      const h = await halten(page, url => url.pathname === '/api/aufgaben/1/diff');
      await page.goto(commitAdresse(1, `kd:${rep.k3}`));
      await expect.poll(() => h.angehalten()).toBe(1);
      await zaehler.beginnen();
      h.frei(0, wert);
      await expect(page.locator('.rv-meld')).toContainText(satz);
      await expect(page.locator('#rv-meld')).toBeFocused();
      const { ergebnisse, ladesaetze } = einordnen(await zaehler.eintraege());
      expect(ergebnisse.map(e => e.ort), fall).toEqual([expect.stringMatching(/^#review div\.rv-meld\./)]);
      expect(ergebnisse[0].text, fall).toContain(satz);
      expect(ladesaetze.length, fall).toBeLessThanOrEqual(1);
    });
  }

  test('AK 6: Nachladen einer Datei endet mit 503: genau eine Fehleransage, in der Dateimeldung', async ({ page }) => {
    const h = await halten(page, url => url.pathname === '/api/aufgaben/9/diff' && url.searchParams.has('datei'));
    const zaehler = await ansagenZaehlen(page);
    await page.goto(commitAdresse(9, `kd:${rep.f}`));
    await expect(page.locator('#rv-d20')).toContainText('Sie wird einzeln geladen.');
    await page.locator('#rv-d20').getByRole('button', { name: 'Nachladen' }).click();
    await expect.poll(() => h.angehalten()).toBe(1);
    await zaehler.beginnen();
    h.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht innerhalb von 10 s' } });
    const satz = 'Zeitgrenze überschritten. Die Änderungen dieser Datei konnten nicht geladen werden (503).';
    const fehler = page.locator('#rv-d20 .df-hin.fehl');
    await expect(fehler).toContainText(satz);
    await expect(fehler.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    const { ergebnisse, ladesaetze } = einordnen(await zaehler.eintraege());
    expect(ergebnisse).toHaveLength(1);
    expect(ergebnisse[0].ort).toMatch(/^#rv-dc20 div\.df-hin\.fehl/);
    expect(ergebnisse[0].text).toContain(satz);
    expect(ladesaetze.length).toBeLessThanOrEqual(1);
  });
});
