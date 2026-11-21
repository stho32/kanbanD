// R00224 Review-Seite nennt den Grund einer 404 in Worten (Karte #232, I0214) — AK 1–12 im echten Programm gegen echtes Git.
// Ausgangslage: gesamt-hilfen.js (R00210), danach ist das Repository S umbenannt — der Registereintrag wb zeigt auf einen Ordner, den
// es nicht gibt. Der erwartete `grund` kommt aus GET /api/aufgaben/11/commits, nie als fester Pfad. Seltene Zustände als feste
// Antworten per page.route; gehaltene Antworten über ein Promise, ohne Schlafzeiten.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen } = require('./hilfen');
const { breiteMessen } = require('./ziele-hilfen');
const { gesamtRepositorien, gesamtVorbereiten } = require('./gesamt-hilfen');
const { basisAnlegen, langerOrdner } = require('./commits-hilfen');

const kurz = (h, k) => (k ? `${k}:` : '') + h.slice(0, 7);
const BOESE = 'Ordner fehlt: /x/<img src=x onerror=window.PWN=1>‮gpj.exe';
const BIDI = /[‪-‮⁦-⁩]/;

/* ── Ausgangslage: R00210 mit umbenanntem S; #20, #21, #24 ── */

let umbenannt = null;
/** Die Repositories von R00210, S als eigene Kopie, die danach umbenannt ist (S → S-weg); einmal je Prozess. */
function ausgangslage() {
  if (!umbenannt) {
    const rep = gesamtRepositorien();
    const basis = basisAnlegen();
    const s = path.join(basis, 'S');
    fs.cpSync(rep.s, s, { recursive: true });
    fs.renameSync(s, path.join(basis, 'S-weg'));
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
    umbenannt = { ...rep, s };
  }
  return umbenannt;
}

const zusatz = rep => ({
  20: [`wb:${rep.w1}`, `kd:${rep.k1}`, `xx:${rep.x1}`],
  21: [`wb:${rep.w1}`, `wb:${rep.w2}`, `xy:${rep.k1}`],
  24: [rep.f],
});

/* ── Treiber: Adressen, Zähler, gehaltene und feste Antworten, Messungen ── */

const reviewAdresse = (k, nr, commit = null) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review${commit == null ? '' : `?commit=${encodeURIComponent(commit)}`}`;
const istDiff = (url, nr) => url.pathname === `/api/aufgaben/${nr}/diff`;
const istListe = (url, nr) => url.pathname === `/api/aufgaben/${nr}/commits`;
const ersteAnfrage = url => !url.searchParams.has('anwendung') && !url.searchParams.has('datei') && !url.searchParams.has('commit');

/** Die Einträge der Liste einer Aufgabe aus dem echten Programm. */
async function listeLesen(page, k, nr) {
  const antwort = await page.request.get(`${k.adresse}api/aufgaben/${nr}/commits`);
  return (await antwort.json()).commits;
}

/** Der erwartete `grund`: der des Eintrags wb:<W1> aus der Liste von #11. */
async function erwarteterGrund(page, k, rep) {
  const e = (await listeLesen(page, k, 11)).find(x => x.verweis === `wb:${rep.w1}`);
  return e.grund;
}

/** Zählt GET-Anfragen an `…/diff` (Suchteil) und `…/commits` der Seite und die höchste Zahl gleichzeitig offener `…/diff`. */
function zaehlen(page) {
  const z = { diff: [], commits: 0, offen: 0, hoechstens: 0 };
  const pfadVon = r => new URL(r.url()).pathname;
  const istDiffAnfrage = r => r.method() === 'GET' && /^\/api\/aufgaben\/\d+\/diff$/.test(pfadVon(r));
  page.on('request', r => {
    if (r.method() === 'GET' && /^\/api\/aufgaben\/\d+\/commits$/.test(pfadVon(r))) z.commits++;
    if (!istDiffAnfrage(r)) return;
    z.diff.push(new URL(r.url()).search);
    z.offen++;
    z.hoechstens = Math.max(z.hoechstens, z.offen);
  });
  const fertig = r => { if (istDiffAnfrage(r)) z.offen--; };
  page.on('requestfinished', fertig);
  page.on('requestfailed', fertig);
  return z;
}

/** Hält passende Antworten an, bis `frei(i, wert)` die i-te freigibt; `wert` ersetzt sie (Status, JSON) oder lässt sie durch. */
async function halten(page, muster) {
  const tore = [];
  await page.route(muster, async route => {
    let frei; const tor = new Promise(r => { frei = r; });
    tore.push(frei);
    const wert = await tor;
    const still = p => p.catch(() => {});
    if (wert && wert.status) return still(route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify(wert.body || {}) }));
    return still(route.continue());
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

/** Feste Antwort `status` mit `body` für passende Anfragen. */
const fest = (page, muster, status, body) => page.route(muster, route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));
const fehlt404 = (grund, zustand = 'repository_fehlt') => ({ fehler: 'Repository nicht erreichbar', zustand, ...(grund == null ? {} : { grund }) });

/** Der Abschnitt einer Anwendung in „Alle Änderungen“ über seine Überschrift. */
const abschnitt = (page, name) => page.locator('section.rv-abs', { has: page.locator('h2', { hasText: new RegExp(`^${name}(?![a-z0-9])`) }) });

/** Das SVG ist dasselbe wie die Marke des Zustands in der Liste „Commits“ (SYMBOLE in web/commits.js) und enthält kein `undefined`. */
async function symbolGleich(svg, name) {
  return svg.evaluate((e, name) => {
    const d = document.createElement('div');
    d.innerHTML = window.zustandsSymbol(name);
    return d.firstElementChild.outerHTML === e.outerHTML && !e.outerHTML.includes('undefined');
  }, name);
}

/** Lage der Zeilen: je Element Ober- und Unterkante. */
const kanten = (page, selektoren) => page.evaluate(sel => sel.map(s => { const r = document.querySelector(s).getBoundingClientRect(); return { oben: r.top, unten: r.bottom }; }), selektoren);

/** Zwischen dem Satz und der Hinweiszeile steht im textContent der Meldung nur Leerraum. */
const nurLeerraumDazwischen = (meldung, satz, hinweis) => meldung.evaluate((e, [satz, hinweis]) => {
  const t = e.textContent, ende = t.indexOf(satz) + satz.length, beginn = t.indexOf(hinweis, ende);
  return t.indexOf(satz) >= 0 && beginn >= ende && /^\s*$/.test(t.slice(ende, beginn));
}, [satz, hinweis]);

/** Zeichnet ab jetzt jede Ansage auf: eine Live-Region (role alert/status, aria-live), die mit Text erscheint oder ihren Text ändert. */
function ansagenAufzeichnen(page) {
  return page.evaluate(() => {
    window.ANSAGEN = [];
    const live = n => n.nodeType === 1 && (n.matches('[role="alert"],[role="status"],[aria-live]') ? n : n.closest('[role="alert"],[role="status"],[aria-live]'));
    const merken = n => { const r = live(n); if (r && r.textContent.trim()) window.ANSAGEN.push({ id: r.id, klasse: r.className, text: r.textContent.trim() }); };
    new MutationObserver(liste => liste.forEach(m => {
      if (m.type === 'characterData') merken(m.target.parentElement);
      else { merken(m.target); m.addedNodes.forEach(n => { if (n.nodeType === 1) { merken(n); n.querySelectorAll('[role="alert"],[role="status"],[aria-live]').forEach(merken); } }); }
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

/** Die Ansagen, je Live-Region einmal. */
const ansagen = page => page.evaluate(() => [...new Map(window.ANSAGEN.map(a => [a.id + '|' + a.klasse, a])).values()]);

/** Kriterien, die am heutigen Stand rot sind (ATDD): ihre Tests laufen als „erwartet rot“, bis die Bubble sie grün macht. */
const ERWARTET_ROT = new Set(['AK 2', 'AK 3', 'AK 5', 'AK 6', 'AK 10']);
const erwartetRot = ak => test.fail(ERWARTET_ROT.has(ak), `${ak} erwartet rot (R00224 B1167)`);

test.describe('R00224 Grund bei 404 in Worten', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = ausgangslage();
    k = await kanbanStarten(gesamtVorbereiten(rep, zusatz(rep)));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── Alle Änderungen ── */

  test('AK 1: #11 — Abschnitt wb sagt „Das Repository der Anwendung wb ist nicht erreichbar.“ mit dem grund darunter, ordner-offen im Ton fehl, Live-Rolle wie bei 503; kd und xx geladen', async ({ page }) => {
    erwartetRot('AK 1');
    const grund = await erwarteterGrund(page, k, rep);
    expect(grund).toMatch(/^Ordner fehlt: /);
    await page.goto(reviewAdresse(k, 11));
    const wb = abschnitt(page, 'Anwendung wb');
    const meldung = wb.locator('.rv-abs-f');
    await expect(meldung.locator('.rv-satz')).toHaveText('Das Repository der Anwendung wb ist nicht erreichbar.');
    await expect(meldung.locator('.rv-hin')).toHaveText(grund);
    await expect(meldung).toHaveClass(/\bfehl\b/);
    expect(await symbolGleich(meldung.locator('svg.i'), 'ordner-offen')).toBe(true);
    await expect(meldung.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    const text = await wb.textContent();
    for (const alt of ['ließen sich nicht lesen', '(404)', 'kein Diff zu diesem Verweis', 'der Zustand sagt warum']) expect(text).not.toContain(alt);
    await expect(abschnitt(page, 'Anwendung kd').locator('.rv-cl')).toBeVisible();
    await expect(abschnitt(page, 'Anwendung xx').locator('.rv-cl')).toBeVisible();
    const attribute = l => l.evaluate(e => [e.getAttribute('role'), e.getAttribute('aria-live')]);
    const bei404 = await attribute(meldung);
    await page.goto('about:blank');
    await fest(page, url => istDiff(url, 11) && url.searchParams.get('anwendung') === 'wb', 503, { fehler: 'Git antwortete nicht' });
    await page.goto(reviewAdresse(k, 11));
    const bei503 = abschnitt(page, 'Anwendung wb').locator('.rv-abs-f');
    await expect(bei503).toContainText('Git antwortete nicht (503)');
    expect(bei404).toEqual(await attribute(bei503));
  });

  test('AK 2: #20 — erste Anwendung fehlt: drei Abschnitte in der Reihenfolge der Liste, wb mit Satz und grund, nie die Leer-Meldung', async ({ page }) => {
    erwartetRot('AK 2');
    const grund = await erwarteterGrund(page, k, rep);
    const liste = await listeLesen(page, k, 20);
    const reihe = [...new Set(liste.filter(e => !['unlesbar', 'anwendung_unbekannt'].includes(e.zustand)).map(e => e.anwendung))];
    expect([...reihe].sort()).toEqual(['kd', 'wb', 'xx']);
    expect(reihe[2]).toBe('wb');
    await page.goto(reviewAdresse(k, 20));
    await expect(page.locator('section.rv-abs')).toHaveCount(3);
    await expect(page.locator('section.rv-abs h2')).toHaveText(reihe.map(kz => new RegExp(`^Anwendung ${kz}(?![a-z0-9])`)));
    const wb = abschnitt(page, 'Anwendung wb');
    await expect(wb.locator('.rv-satz')).toHaveText('Das Repository der Anwendung wb ist nicht erreichbar.');
    await expect(wb.locator('.rv-hin')).toHaveText(grund);
    await expect(abschnitt(page, 'Anwendung kd').locator('.dn .p', { hasText: 'k.txt' }).first()).toBeVisible();
    await expect(abschnitt(page, 'Anwendung xx').locator('.dn .p', { hasText: 'x.txt' }).first()).toBeVisible();
    const seite = await page.locator('#review').textContent();
    expect(seite).not.toContain('Keine Änderungen zu zeigen.');
    expect(seite).not.toContain('An dieser Aufgabe sind keine Commit-Verweise hinterlegt.');
    const ersterMitDiff = liste.find(e => ['auf_zweig', 'verwaist'].includes(e.zustand)).verweis;
    await expect(page.locator('#rv-u-commit')).toHaveAttribute('href', new RegExp(`commit=${encodeURIComponent(ersterMitDiff)}`));
  });

  test('AK 3: #21 — nur wb: ein Abschnitt mit Satz und grund, darüber der Hinweis zu xy:<K1>, „Ein Commit“ gedämpft ohne href', async ({ page }) => {
    erwartetRot('AK 3');
    const grund = await erwarteterGrund(page, k, rep);
    await page.goto(reviewAdresse(k, 21));
    await expect(page.locator('section.rv-abs')).toHaveCount(1);
    const wb = abschnitt(page, 'Anwendung wb');
    await expect(wb.locator('.rv-satz')).toHaveText('Das Repository der Anwendung wb ist nicht erreichbar.');
    await expect(wb.locator('.rv-hin')).toHaveText(grund);
    const hinweis = page.locator('#rv-seite-hw .rv-aus li');
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toContainText(kurz(rep.k1, 'xy'));
    await expect(hinweis).toContainText('Anwendung unbekannt');
    expect(await page.locator('#rv-seite-hw').evaluate(h => Boolean(h.compareDocumentPosition(document.querySelector('section.rv-abs')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    const teil = page.locator('#rv-u-commit');
    expect(await teil.evaluate(e => [e.tagName, e.hasAttribute('href')])).toEqual(['SPAN', false]);
    await expect(page.locator('#review')).not.toContainText('Keine Änderungen zu zeigen.');
  });

  test('AK 4: #14 ohne Verweise und eine feste 404 ohne zustand — die Leer-Meldung bleibt', async ({ page }) => {
    erwartetRot('AK 4');
    await page.goto(reviewAdresse(k, 14));
    await expect(page.locator('.rv-meld')).toContainText('Keine Änderungen zu zeigen. An dieser Aufgabe sind keine Commit-Verweise hinterlegt.');
    await expect(page.getByRole('button', { name: 'Zurück zur Liste der Commits' })).toBeVisible();
    await page.goto('about:blank');
    await fest(page, url => istDiff(url, 11) && ersteAnfrage(url), 404, { fehler: 'Keine Verweise' });
    await page.goto(reviewAdresse(k, 11));
    await expect(page.locator('.rv-meld')).toContainText('Keine Änderungen zu zeigen. An dieser Aufgabe sind keine Commit-Verweise hinterlegt.');
    await expect(page.locator('section.rv-abs')).toHaveCount(0);
  });

  test('AK 5: #20 — je Kürzel genau eine Anfrage, nie zwei zugleich; „Erneut versuchen“ an wb liest einmal; gehaltene Liste lässt warten', async ({ page }) => {
    erwartetRot('AK 5');
    const z = zaehlen(page);
    const reihe = [...new Set((await listeLesen(page, k, 20)).map(e => e.anwendung))];
    const liste = await halten(page, url => istListe(url, 20));
    await page.goto(reviewAdresse(k, 20));
    await expect.poll(() => liste.angehalten()).toBe(1);
    await expect.poll(() => z.diff.length).toBe(1);
    await expect.poll(() => z.offen).toBe(0);
    await expect(page.locator('.rv-laedt')).toHaveText('Liest die Änderungen der Aufgabe …');
    liste.frei(0);
    await expect(page.locator('section.rv-abs')).toHaveCount(3);
    await expect(abschnitt(page, 'Anwendung wb').locator('.rv-satz')).toBeVisible();
    await expect(page.locator('section.rv-abs[aria-busy]')).toHaveCount(0);
    expect(z.diff).toEqual(['', ...reihe.map(kz => `?anwendung=${kz}`)]);
    expect(z.hoechstens).toBe(1);
    const vorher = z.diff.length;
    await abschnitt(page, 'Anwendung wb').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(abschnitt(page, 'Anwendung wb').locator('.rv-satz')).toBeVisible();
    await expect.poll(() => z.offen).toBe(0);
    expect(z.diff.slice(vorher)).toEqual(['?anwendung=wb']);
    await expect(abschnitt(page, 'Anwendung kd').locator('.rv-cl')).toBeVisible();
    await expect(abschnitt(page, 'Anwendung xx').locator('.rv-cl')).toBeVisible();
  });

  test('AK 6: #20 und die Liste scheitert (500) — eine Seitenmeldung mit grund und Listensatz, Fokus, genau eine Ansage, untereinander; Erneut liest beides', async ({ page }) => {
    erwartetRot('AK 6');
    const grund = await erwarteterGrund(page, k, rep);
    const z = zaehlen(page);
    const liste = await halten(page, url => istListe(url, 20));
    await page.goto(reviewAdresse(k, 20));
    await expect.poll(() => z.diff.length).toBe(1);
    await expect.poll(() => z.offen).toBe(0);
    await expect(page.locator('.rv-laedt')).toBeVisible();
    await ansagenAufzeichnen(page);
    liste.frei(0, { status: 500, body: { fehler: 'kaputt' } });
    const meldung = page.locator('.rv-meld.fehl');
    await expect(meldung.locator('h2')).toHaveText('Das Repository einer Anwendung dieser Aufgabe ist nicht erreichbar.');
    await expect(meldung.locator('.rv-hin')).toHaveText(grund);
    await expect(meldung.locator('.rv-satz')).toHaveText('Die Liste der Commits ließ sich nicht lesen: kaputt (500). Die übrigen Anwendungen der Aufgabe sind deshalb nicht zu sehen.');
    await expect(meldung.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await expect(page.locator('#rv-meld')).toBeFocused();
    expect(await symbolGleich(meldung.locator('svg.i'), 'ordner-offen')).toBe(true);
    await expect(page.locator('#review')).not.toContainText('Keine Änderungen zu zeigen.');
    const gehoert = await ansagen(page);
    expect(gehoert.map(a => a.text)).toEqual([await meldung.evaluate(e => e.textContent.trim())]);
    await expect(page.locator('#rv-ansage')).toHaveText('');
    for (const breite of [320, 1280]) {
      await breiteSetzen(page, breite, 900);
      const [kopf, hin, satz] = await kanten(page, ['.rv-meld h2', '.rv-meld .rv-hin', '.rv-meld .rv-satz']);
      expect(hin.oben, `Hinweiszeile unter der Überschrift bei ${breite}`).toBeGreaterThanOrEqual(kopf.unten);
      expect(satz.oben, `Listensatz unter der Hinweiszeile bei ${breite}`).toBeGreaterThanOrEqual(hin.unten);
    }
    const vorher = { diff: z.diff.length, commits: z.commits };
    await meldung.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect.poll(() => liste.angehalten()).toBe(2);
    liste.frei(1);
    await expect(page.locator('section.rv-abs')).toHaveCount(3);
    await expect(abschnitt(page, 'Anwendung wb').locator('.rv-satz')).toBeVisible();
    expect(z.commits - vorher.commits).toBe(1);
    expect(z.diff.slice(vorher.diff).filter(s => s === '')).toEqual(['']);
  });

  test('AK 6: erste 404 ohne grund und die Liste scheitert — die Meldung steht ohne Hinweiszeile', async ({ page }) => {
    erwartetRot('AK 6');
    await fest(page, url => istDiff(url, 20) && ersteAnfrage(url), 404, fehlt404(null));
    await fest(page, url => istListe(url, 20), 500, { fehler: 'kaputt' });
    await page.goto(reviewAdresse(k, 20));
    const meldung = page.locator('.rv-meld.fehl');
    await expect(meldung.locator('h2')).toHaveText('Das Repository einer Anwendung dieser Aufgabe ist nicht erreichbar.');
    await expect(meldung.locator('.rv-satz')).toBeVisible();
    await expect(meldung.locator('.rv-hin')).toHaveCount(0);
  });

  /* ── Ein Commit ── */

  for (const [fall, adresse] of [['voller Verweis', r => `wb:${r.w1}`], ['Hash-Präfix ohne Kürzel', r => r.w1.slice(0, 7)]]) {
    test(`AK 7: #11 ?commit=<${fall}> — „Zu wb:<W1> gibt es keinen Diff.“, Satz, grund, Zur Liste; fehl, status, ordner-offen`, async ({ page }) => {
      erwartetRot('AK 7');
      const grund = await erwarteterGrund(page, k, rep);
      await page.goto(reviewAdresse(k, 11, adresse(rep)));
      const meldung = page.locator('.rv-meld');
      await expect(meldung.locator('h2')).toHaveText(`Zu ${kurz(rep.w1, 'wb')} gibt es keinen Diff.`);
      await expect(meldung.locator('.rv-satz')).toHaveText('Das Repository der Anwendung wb ist nicht erreichbar.');
      await expect(meldung.locator('.rv-hin')).toHaveText(grund);
      await expect(meldung.getByRole('button', { name: 'Zur Liste der Commits' })).toBeVisible();
      await expect(meldung).toHaveClass(/\bfehl\b/);
      await expect(meldung).toHaveAttribute('role', 'status');
      expect(await symbolGleich(meldung.locator('svg.i'), 'ordner-offen')).toBe(true);
      await expect(page.locator('#review')).not.toContainText('ist Repository nicht erreichbar');
    });
  }

  test('AK 8: #6 und #24 — fehlt, anwendung_unbekannt mit und ohne Kürzel; Symbol und Ton der Liste, Rolle status', async ({ page }) => {
    erwartetRot('AK 8');
    for (const [nr, adresse, kopf, satz, ton, symbol] of [
      [6, `kd:${rep.v2}`, `Zu ${kurz(rep.v2, 'kd')} gibt es keinen Diff.`, 'Das Repository der Anwendung kd kennt diesen Commit nicht mehr.', 'fehl', 'fehlt'],
      [6, `xy:${rep.k1}`, `Zu ${kurz(rep.k1, 'xy')} gibt es keinen Diff.`, 'Die Anwendung xy ist unter Einrichten nicht eingetragen.', 'warn', 'frage'],
      [24, rep.f, `Zu ${kurz(rep.f)} gibt es keinen Diff.`, 'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.', 'warn', 'frage'],
    ]) {
      await page.goto('about:blank');
      await page.goto(reviewAdresse(k, nr, adresse));
      const meldung = page.locator('.rv-meld');
      await expect(meldung.locator('h2'), adresse).toHaveText(kopf);
      await expect(meldung.locator('.rv-satz')).toHaveText(satz);
      await expect(meldung.locator('.rv-hin')).toHaveCount(0);
      await expect(meldung).toHaveClass(new RegExp(`\\b${ton}\\b`));
      await expect(meldung).toHaveAttribute('role', 'status');
      expect(await symbolGleich(meldung.locator('svg.i'), symbol), adresse).toBe(true);
    }
  });

  test('AK 8: feste 404 unlesbar — „Der Eintrag an der Aufgabe ist nicht lesbar.“ mit „Kurz-Hash mehrdeutig“, ohne grund ohne Hinweiszeile', async ({ page }) => {
    erwartetRot('AK 8');
    for (const grund of ['Kurz-Hash mehrdeutig', null]) {
      await page.unrouteAll();
      await page.goto('about:blank');
      await fest(page, url => istDiff(url, 11) && url.searchParams.has('commit'), 404, fehlt404(grund, 'unlesbar'));
      await page.goto(reviewAdresse(k, 11, `kd:${rep.k1}`));
      const meldung = page.locator('.rv-meld');
      await expect(meldung.locator('.rv-satz')).toHaveText('Der Eintrag an der Aufgabe ist nicht lesbar.');
      if (grund) await expect(meldung.locator('.rv-hin')).toHaveText(grund);
      else await expect(meldung.locator('.rv-hin')).toHaveCount(0);
      await expect(meldung).toHaveClass(/\bfehl\b/);
      await expect(meldung).toHaveAttribute('role', 'status');
      expect(await symbolGleich(meldung.locator('svg.i'), 'achtung')).toBe(true);
    }
  });

  test('AK 9: unbekannter Zustand und 404 ohne zustand — der alte Satz, ohne Symbol und ohne Ton', async ({ page }) => {
    erwartetRot('AK 9');
    await fest(page, url => istDiff(url, 11) && url.searchParams.has('commit'), 404, { fehler: 'x', zustand: 'neu_art' });
    await page.goto(reviewAdresse(k, 11, `kd:${rep.k1}`));
    const meldung = page.locator('.rv-meld');
    await expect(meldung.locator('h2')).toHaveText(`Zu diesem Verweis gibt es keinen Diff: ${kurz(rep.k1, 'kd')} — x.`);
    await expect(meldung.locator('svg')).toHaveCount(0);
    await expect(meldung).not.toHaveClass(/\b(fehl|warn)\b/);
    await page.unrouteAll();
    await page.goto('about:blank');
    await page.goto(reviewAdresse(k, 11, `kd:${rep.a0}`));
    await expect(meldung.locator('h2')).toHaveText(new RegExp(`^Zu diesem Verweis gibt es keinen Diff: ${kurz(rep.a0, 'kd')} — .+\\.$`));
    await expect(meldung.locator('svg')).toHaveCount(0);
    await expect(meldung).not.toHaveClass(/\b(fehl|warn)\b/);
  });

  /* ── Beide Ansichten ── */

  /** #24 mit fester Liste (ein Eintrag ohne Kürzel, `zustand`) und fester 404 an jeder Anfrage `…/diff`. */
  async function standardFest(page, zustand, grund) {
    await page.unrouteAll();
    await page.goto('about:blank');
    await fest(page, url => istListe(url, 24), 200, { commits: [{ verweis: rep.f, anwendung: '', hash: rep.f, zustand, ...(grund == null ? {} : { grund }) }] });
    await fest(page, url => istDiff(url, 24), 404, fehlt404(grund, zustand));
  }

  test('AK 10: Verweis ohne Kürzel — „Das Repository der Standardanwendung …“ in beiden Ansichten, nie „Anwendung “ ohne Namen; ohne grund ohne Hinweiszeile', async ({ page }) => {
    erwartetRot('AK 10');
    for (const [zustand, grund, satz] of [
      ['repository_fehlt', 'Ordner fehlt: /da/weg', 'Das Repository der Standardanwendung ist nicht erreichbar.'],
      ['repository_fehlt', null, 'Das Repository der Standardanwendung ist nicht erreichbar.'],
      ['fehlt', null, 'Das Repository der Standardanwendung kennt diesen Commit nicht mehr.'],
    ]) {
      await standardFest(page, zustand, grund);
      await page.goto(reviewAdresse(k, 24, rep.f));
      const meldung = page.locator('.rv-meld');
      await expect(meldung.locator('.rv-satz'), `${zustand} ${grund}`).toHaveText(satz);
      if (grund) await expect(meldung.locator('.rv-hin')).toHaveText(grund);
      else await expect(meldung.locator('.rv-hin')).toHaveCount(0);
      expect(await page.locator('#review').textContent()).not.toMatch(/Anwendung\s(?![a-z0-9])/);
      if (zustand !== 'repository_fehlt') continue;
      await page.goto('about:blank');
      await page.goto(reviewAdresse(k, 24));
      const standard = abschnitt(page, 'Standardanwendung').locator('.rv-abs-f');
      await expect(standard.locator('.rv-satz'), `Alle ${grund}`).toHaveText(satz);
      if (grund) await expect(standard.locator('.rv-hin')).toHaveText(grund);
      else await expect(standard.locator('.rv-hin')).toHaveCount(0);
      expect(await page.locator('#review').textContent()).not.toMatch(/Anwendung\s(?![a-z0-9])/);
    }
  });

  test('AK 11: fremder Text im grund — kein Skript, kein Bild, wörtlich als Text, ohne Bidi-Steuerzeichen, endet auf „gpj.exe“, beide Ansichten', async ({ page }) => {
    erwartetRot('AK 11');
    await fest(page, url => istDiff(url, 11) && (url.searchParams.get('anwendung') === 'wb' || url.searchParams.has('commit')), 404, fehlt404(BOESE));
    for (const [ansicht, adresse, ort] of [['Alle', null, 'section.rv-abs .rv-hin'], ['Ein Commit', `wb:${rep.w1}`, '.rv-meld .rv-hin']]) {
      await page.goto('about:blank');
      await page.goto(reviewAdresse(k, 11, adresse));
      const hin = page.locator(ort);
      await expect(hin, ansicht).toContainText('<img src=x onerror=window.PWN=1>');
      const text = await hin.textContent();
      expect(BIDI.test(text), ansicht).toBe(false);
      expect(text.endsWith('gpj.exe'), ansicht).toBe(true);
      expect(await page.evaluate(() => window.PWN)).toBeUndefined();
      await expect(page.locator('img[src="x"]')).toHaveCount(0);
    }
  });

  for (const breite of [320, 414]) {
    test(`AK 12 (${breite} px): grund mit 500 Zeichen — kein Querscrollen in beiden Ansichten, Symbol, Satz und Hinweiszeile sichtbar, „Erneut versuchen“ in der Breite`, async ({ page }) => {
      erwartetRot('AK 12');
      const grund = 'Ordner fehlt: ' + langerOrdner('/tmp/kanband-lang', 500);
      expect(grund.length).toBe(500);
      await breiteSetzen(page, breite, 900);
      await fest(page, url => istDiff(url, 11) && (url.searchParams.get('anwendung') === 'wb' || url.searchParams.has('commit')), 404, fehlt404(grund));
      for (const [ansicht, adresse, ort] of [['Alle', null, 'section.rv-abs .rv-abs-f'], ['Ein Commit', `wb:${rep.w1}`, '.rv-meld']]) {
        await page.goto('about:blank');
        await page.goto(reviewAdresse(k, 11, adresse));
        const meldung = page.locator(ort);
        await expect(meldung.locator('.rv-hin'), ansicht).toHaveText(grund);
        for (const teil of ['svg.i', '.rv-satz', '.rv-hin']) await expect(meldung.locator(teil), `${ansicht} ${teil}`).toBeVisible();
        expect(await breiteMessen(page, `${ansicht} ${breite}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        expect(await meldung.locator('.vh').count()).toBe(0);
        if (ansicht === 'Alle') {
          const rechts = await meldung.getByRole('button', { name: 'Erneut versuchen' }).evaluate(e => e.getBoundingClientRect().right <= document.documentElement.clientWidth);
          expect(rechts).toBe(true);
        }
      }
    });
  }

  for (const breite of [320, 414, 1280]) {
    test(`AK 12 Lage (${breite} px): #11 — Hinweiszeile unter dem Satz, auf „Ein Commit“ der Satz unter der Überschrift; dazwischen nur Leerraum`, async ({ page }) => {
      erwartetRot('AK 12');
      const grund = await erwarteterGrund(page, k, rep);
      const satz = 'Das Repository der Anwendung wb ist nicht erreichbar.';
      await breiteSetzen(page, breite, 900);
      await page.goto(reviewAdresse(k, 11));
      const abs = abschnitt(page, 'Anwendung wb').locator('.rv-abs-f');
      await expect(abs.locator('.rv-hin')).toHaveText(grund);
      const [s1, h1] = await kanten(page, ['section.rv-abs .rv-abs-f .rv-satz', 'section.rv-abs .rv-abs-f .rv-hin']);
      expect(h1.oben, 'Alle: Hinweiszeile unter dem Satz').toBeGreaterThanOrEqual(s1.unten);
      expect(await nurLeerraumDazwischen(abs, satz, grund)).toBe(true);
      await page.goto(reviewAdresse(k, 11, `wb:${rep.w1}`));
      const meldung = page.locator('.rv-meld');
      await expect(meldung.locator('.rv-hin')).toHaveText(grund);
      const [kopf, s2, h2] = await kanten(page, ['.rv-meld h2', '.rv-meld .rv-satz', '.rv-meld .rv-hin']);
      expect(s2.oben, 'Ein Commit: Satz unter der Überschrift').toBeGreaterThanOrEqual(kopf.unten);
      expect(h2.oben, 'Ein Commit: Hinweiszeile unter dem Satz').toBeGreaterThanOrEqual(s2.unten);
      expect(await nurLeerraumDazwischen(meldung, satz, grund)).toBe(true);
    });
  }
});
