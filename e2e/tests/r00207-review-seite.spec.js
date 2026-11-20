// R00207 Review-Seite eines Commits (Karte #209, I0197, Scheibe B2) — AK 1–10 und 6a im echten Programm gegen echtes Git.
// Ausgangslage: review-hilfen.js (R mit K1–K4, W1, V1, V2, R1; D, E, E0, F). Gehaltene Antworten über page.route und ein Promise,
// Fristen mit page.clock, keine Schlafzeiten; Verneinungen erst nach einem sichtbaren Signal.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit, bereit, reiter, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen, kontrastFarben } = require('./hilfen');
const { breiteMessen, zieleMessen } = require('./ziele-hilfen');
const { reviewRepository, reviewVorbereiten, BOESE } = require('./review-hilfen');

const AGENT = { 'X-KanbanD-Wer': 'cl' };
const kurz = h => `kd:${h.slice(0, 7)}`;
const SEITE = '#review';
const POS = '#rv-pos';

/* ── Treiber: Adressen, Zähler, gehaltene Antworten ── */
const reviewAdresse = (k, nr, commit, basis = 'aufgaben') => `${k.adresse}#/${basis === 'board' ? 'board/entwicklung' : 'aufgaben'}/aufgabe/${nr}/review${commit == null ? '' : `?commit=${encodeURIComponent(commit)}`}`;

/** Zählt die GET-Anfragen an `…/commits` und `…/diff` (mit und ohne `datei=`) der Seite. */
function zaehlen(page) {
  const z = { commits: [], diff: [], datei: [] };
  page.on('request', r => {
    if (r.method() !== 'GET') return;
    const u = new URL(r.url());
    if (/^\/api\/aufgaben\/\d+\/commits$/.test(u.pathname)) z.commits.push(u.href);
    if (/^\/api\/aufgaben\/\d+\/diff$/.test(u.pathname)) (u.searchParams.has('datei') ? z.datei : z.diff).push(u.href);
  });
  return z;
}

/** Hält die Antworten auf passende Anfragen an, bis `frei(i)` die i-te freigibt; `antwort` kann sie ersetzen. */
async function halten(page, muster, antwort = null) {
  const tore = [];
  await page.route(muster, async route => {
    let frei; const tor = new Promise(r => { frei = r; });
    tore.push(frei);
    const wert = await tor;
    if (wert && wert.status) return route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify(wert.body || {}) });
    if (wert === 'abbrechen') return route.abort();
    if (antwort) return antwort(route);
    return route.continue();
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

const textDer = (page, sel) => page.locator(sel).first().evaluate(e => e.textContent);

test.describe('R00207 Review-Seite eines Commits', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = reviewRepository().rep;
    k = await kanbanStarten(reviewVorbereiten(rep));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 2 Adresse ── */

  test('AK 2: Kurz-Präfix aus einem Lesezeichen zeigt V1 mit „3 von 4“ (gezählt über den vollen Hash), das Fenster ist zu', async ({ page }) => {
    const z = zaehlen(page);
    await page.goto(reviewAdresse(k, 1, rep.v1.slice(0, 7)));
    await expect(page.locator(POS)).toHaveText('3 von 4');
    await expect(page.locator('#rv-ctitel')).toHaveText('v.txt anlegen');
    await expect(page.locator('#fenster')).toHaveCount(0);
    expect([z.commits.length, z.diff.length]).toEqual([1, 1]);
    await expect(page.locator('#rv-rueckweg')).toBeFocused();
    await expect(page).toHaveTitle(`Review #1 · ${kurz(rep.v1)} — kanbanD`);
    await expect(page.locator('h1')).toHaveText(['Review']);
  });

  test('AK 2: „← #1“ ersetzt die Adresse durch die des Fensters mit „Commits“, ohne Verlaufseintrag', async ({ page }) => {
    await page.goto(reviewAdresse(k, 1, `kd:${rep.v1}`));
    await expect(page.locator(POS)).toHaveText('3 von 4');
    const laenge = await page.evaluate(() => history.length);
    await page.locator('#rv-rueckweg').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]')).toHaveAttribute('aria-label', 'Ansicht: Commits');
    expect(page.url()).toMatch(/#\/aufgaben\/aufgabe\/1$/);
    expect(await page.evaluate(() => history.length)).toBe(laenge);
  });

  test('AK 2: dieselbe Seite unter der Board-Form', async ({ page }) => {
    await page.goto(reviewAdresse(k, 1, `kd:${rep.w1}`, 'board'));
    await expect(page.locator(POS)).toHaveText('2 von 4');
    await expect(page.locator('#rv-ctitel')).toHaveText('b.txt anlegen');
  });

  for (const [name, commit] of [['6 Hex', 'a'.repeat(6)], ['65 Hex', 'a'.repeat(65)], ['<script>', '<script>alert(1)</script>']]) {
    test(`AK 2: ?commit= mit ${name} → „Verweis ungültig …“ ohne den Text der Adresse und ohne Anfrage an …/diff`, async ({ page }) => {
      const z = zaehlen(page);
      await page.goto(reviewAdresse(k, 1, commit));
      const meldung = page.locator('.rv-meld');
      await expect(meldung).toContainText('Verweis ungültig. Die Adresse nennt keinen Commit in gültiger Form.');
      await expect(meldung).toHaveAttribute('role', 'status');
      await expect(meldung.getByRole('button', { name: 'Zur Liste der Commits' })).toBeVisible();
      expect(await page.locator('#app').innerText()).not.toContain(commit.slice(0, 6));
      await expect(page.locator('#rv-meld')).toBeFocused();
      expect(z.diff).toEqual([]);
    });
  }
  /* ── AK 3 Blättern und Ränder ── */

  test('AK 3: K3 „1 von 4“ ohne Zurück, Vor bis R1 „4 von 4“ ohne Vor; jeder Schritt ersetzt den Eintrag; Fokus auf dem Blätterknopf', async ({ page }) => {
    await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
    await expect(page.locator(POS)).toHaveText('1 von 4');
    await expect(page.locator('#rv-zurueck')).toHaveCount(0);
    await expect(page.locator('#review button:disabled, #review [aria-disabled="true"]')).toHaveCount(0);
    const laenge = await page.evaluate(() => history.length);
    const erwartet = [['2 von 4', rep.w1, 'b.txt anlegen'], ['3 von 4', rep.v1, 'v.txt anlegen'], ['4 von 4', rep.r1, 'r.txt anlegen']];
    for (const [pos, hash, titel] of erwartet) {
      await page.locator('#rv-vor').click();
      await expect(page.locator(POS)).toHaveText(pos);
      await expect(page.locator('#rv-ctitel')).toHaveText(titel);
      expect(decodeURIComponent(page.url())).toContain(`review?commit=kd:${hash}`);
      await expect(page).toHaveTitle(`Review #1 · ${kurz(hash)} — kanbanD`);
    }
    await expect(page.locator('#rv-vor')).toHaveCount(0);
    await expect(page.locator('#rv-zurueck')).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(laenge);
    await page.locator('#rv-zurueck').click();
    await expect(page.locator(POS)).toHaveText('3 von 4');
    await expect(page.locator('#rv-zurueck')).toBeFocused();
    await expect(page.locator('#review .rv-band')).toHaveText(/^Dieser Commit ist verwaist: Kein Zweig führt zu ihm\./);
  });

  test('AK 3 (b): Liste ohne W1 → Diff ohne „i von n“ und ohne Blättern, mit „Zum ersten Commit“ → K3 „1 von 3“', async ({ page }) => {
    await page.route('**/api/aufgaben/1/commits', async route => {
      const antwort = await route.fetch();
      const json = await antwort.json();
      json.commits = json.commits.filter(e => e.hash !== rep.w1);
      await route.fulfill({ response: antwort, json });
    });
    await page.goto(reviewAdresse(k, 1, `kd:${rep.w1}`));
    const rand = page.locator('.rv-randb');
    await expect(rand).toContainText(`${kurz(rep.w1)} gehört nicht zu den Commits dieser Aufgabe mit Diff. Gezeigt wird sein Diff, ohne „i von n“.`);
    await expect(rand).toHaveAttribute('role', 'status');
    await expect(page.locator('#rv-ctitel')).toHaveText('b.txt anlegen');
    await expect(page.locator(`${POS}, #rv-vor, #rv-zurueck`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Zum ersten Commit' }).click();
    await expect(page.locator(POS)).toHaveText('1 von 3');
    await expect(page.locator('#rv-ctitel')).toHaveText('c.txt anlegen');
  });

  test('AK 3 (c): #6 ohne Eintrag mit Diff → „Keine Änderungen zu zeigen …“, Adresse ohne ?commit=, Rückweg ins Fenster', async ({ page }) => {
    await page.goto(reviewAdresse(k, 6, null));
    const meldung = page.locator('.rv-meld');
    await expect(meldung).toContainText('Keine Änderungen zu zeigen. Zu keinem Commit der Aufgabe gibt es einen Diff:');
    await expect(meldung).toContainText('nicht mehr im Repository');
    await expect(meldung).toContainText('Anwendung unbekannt');
    await expect(meldung).toContainText('Anwendung „xy“ ist unter Einrichten nicht eingetragen.');
    await expect(page.locator('#rv-meld')).toBeFocused();
    expect(page.url()).toMatch(/\/review$/);
    await page.getByRole('button', { name: 'Zurück zur Liste der Commits' }).click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #6' })).toBeVisible();
    await expect(page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]')).toHaveAttribute('aria-label', 'Ansicht: Commits');
  });

  test('…/review ohne commit zeigt den ersten Commit mit Diff und ersetzt die Adresse (zwei Anfragen)', async ({ page }) => {
    const z = zaehlen(page);
    await page.goto(reviewAdresse(k, 1, null));
    await expect(page.locator(POS)).toHaveText('1 von 4');
    expect(decodeURIComponent(page.url())).toMatch(new RegExp(`review\\?commit=kd:${rep.k3}$`));
    expect([z.commits.length, z.diff.length]).toEqual([1, 1]);
  });

  /* ── AK 6 Fehler und Laden der Seite ── */

  test('AK 6: gehaltener Diff zeigt „Liest den Diff von kd:<kurz> …“ mit role=status und aria-busy', async ({ page }) => {
    const h = await halten(page, '**/api/aufgaben/1/diff?**');
    await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
    const laedt = page.locator('.rv-laedt');
    await expect(laedt).toHaveText(`Liest den Diff von ${kurz(rep.k3)} …`);
    await expect(laedt).toHaveAttribute('role', 'status');
    await expect(laedt).toHaveAttribute('aria-busy', 'true');
    await expect.poll(() => h.angehalten()).toBe(1);
    h.frei(0);
    await expect(page.locator(POS)).toHaveText('1 von 4');
    await expect(page.locator('.rv-laedt')).toHaveCount(0);
  });

  for (const [fall, fehler, art, text] of [
    ['Antwortbudget', 'Antwortbudget von 64 MB belegt — Diff in einigen Sekunden erneut laden', 'warn', 'Server ausgelastet (Antwortbudget). Der Diff wurde nicht gelesen, weil der Server gerade zu viele große Antworten ausliefert. Es wird nicht von selbst wiederholt.'],
    ['Zeitgrenze', 'Git antwortete nicht innerhalb von 10 s', 'fehl', 'Zeitgrenze überschritten. Der Diff ließ sich nicht lesen: Git antwortete nicht innerhalb von 10 s (503).'],
  ]) {
    test(`AK 6: 503 ${fall} → Meldung mit Symbol und „Erneut versuchen“; genau eine Folgeanfrage, keine von selbst (auch nach 70 s)`, async ({ page }) => {
      await page.clock.install();
      let n = 0;
      await page.route('**/api/aufgaben/1/diff?**', route => { n++; return n === 1 ? route.fulfill({ status: 503, json: { fehler } }) : route.continue(); });
      const z = zaehlen(page);
      await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
      const meldung = page.locator('.rv-meld');
      await expect(meldung).toHaveText(new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(meldung).toHaveClass(new RegExp(art));
      await expect(meldung).toHaveAttribute('role', 'alert');
      await expect(meldung.locator('svg.i')).toHaveCount(1);
      await expect(page.locator('#rv-meld')).toBeFocused();
      expect(z.diff.length).toBe(1);
      await page.clock.runFor(70000);
      expect(z.diff.length).toBe(1);
      await page.getByRole('button', { name: 'Erneut versuchen' }).click();
      await expect(page.locator(POS)).toHaveText('1 von 4');
      expect([z.diff.length, z.commits.length]).toEqual([2, 1]);
    });
  }

  test('AK 6: ?commit=kd:<V2> → „Zu diesem Verweis gibt es keinen Diff: kd:<kurz> ist nicht mehr im Repository.“', async ({ page }) => {
    await page.goto(reviewAdresse(k, 1, `kd:${rep.v2}`));
    const meldung = page.locator('.rv-meld');
    await expect(meldung).toContainText(`Zu diesem Verweis gibt es keinen Diff: ${kurz(rep.v2)} ist nicht mehr im Repository.`);
    await expect(meldung).toHaveAttribute('role', 'status');
    await expect(meldung.getByRole('button', { name: 'Zur Liste der Commits' })).toBeVisible();
  });

  test('AK 6: Frist — ein Kopf nach 14 s wird gezeigt, einer, der nach 15 s fehlt, endet als „Zeitgrenze überschritten“', async ({ page }) => {
    await page.clock.install();
    const h = await halten(page, '**/api/aufgaben/1/diff?**');
    await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
    await expect(page.locator('.rv-laedt')).toBeVisible();
    await page.clock.runFor(14000);
    h.frei(0);
    await expect(page.locator(POS)).toHaveText('1 von 4');
    await page.locator('#rv-vor').click();
    await expect(page.locator('.rv-laedt')).toBeVisible();
    await page.clock.runFor(15000);
    await expect(page.locator('.rv-meld')).toContainText('Zeitgrenze überschritten.');
    h.frei(1);
  });

  /* ── AK 6a Andere Fehler und unbekannte Aufgabe ── */

  for (const [fall, wert, text] of [['500', { status: 500, body: { fehler: 'innen kaputt' } }, 'Der Diff ließ sich nicht lesen: innen kaputt (500).'], ['abort', 'abbrechen', 'Der Diff ließ sich nicht lesen: keine Verbindung zum Programm (0).']]) {
    test(`AK 6a: …/diff endet mit ${fall} → „${text}“ mit „Erneut versuchen“ und „Zur Liste der Commits“, role=alert; ein Klick, eine Anfrage`, async ({ page }) => {
      const z = zaehlen(page);
      const h = await halten(page, '**/api/aufgaben/1/diff?**');
      await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
      await expect(page.locator('.rv-laedt')).toBeVisible();
      h.frei(0, wert);
      const meldung = page.locator('.rv-meld');
      await expect(meldung).toContainText(text);
      await expect(meldung).toHaveAttribute('role', 'alert');
      await expect(meldung.getByRole('button', { name: 'Zur Liste der Commits' })).toBeVisible();
      await expect(page.locator('.rv-laedt')).toHaveCount(0);
      await expect(page.locator('#rv-meld')).toBeFocused();
      expect(z.diff.length).toBe(1);
      await page.getByRole('button', { name: 'Erneut versuchen' }).click();
      await expect.poll(() => h.angehalten()).toBe(2);
      await expect(page.locator('#rv-meld')).toHaveCount(0);
      h.frei(1, wert);
      await expect(page.locator('#rv-meld')).toBeFocused();
      expect(z.diff.length).toBe(2);
    });
  }

  for (const [fall, wert] of [['500', { status: 500, body: { fehler: 'x' } }], ['abort', 'abbrechen']]) {
    test(`AK 6a: nur …/commits endet mit ${fall} → Diff ohne Blättern, Hinweis mit „Erneut versuchen“, das nur die Liste liest`, async ({ page }) => {
      const z = zaehlen(page);
      const h = await halten(page, '**/api/aufgaben/1/commits');
      await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
      await expect.poll(() => h.angehalten()).toBe(1);
      h.frei(0, wert);
      const hinweis = page.locator('.rv-lfehl');
      await expect(hinweis).toContainText('Die Liste der Commits ließ sich nicht lesen; das Blättern ist nicht möglich.');
      await expect(page.locator('#rv-ctitel')).toBeFocused();
      await expect(page.locator(`${POS}, #rv-vor, #rv-zurueck`)).toHaveCount(0);
      await hinweis.getByRole('button', { name: 'Erneut versuchen' }).click();
      await expect.poll(() => h.angehalten()).toBe(2);
      h.frei(1);
      await expect(page.locator(POS)).toHaveText('1 von 4');
      expect([z.commits.length, z.diff.length]).toEqual([2, 1]);
    });
  }

  for (const [basis, knopf, ziel] of [['board', 'Zum Board', /#\/board\/entwicklung$/], ['aufgaben', 'Zu den Aufgaben', /#\/aufgaben$/]]) {
    test(`AK 6a: unbekannte Aufgabe in der ${basis}-Form → „Aufgabe #999 gibt es nicht.“ mit „${knopf}“`, async ({ page }) => {
      await page.goto(reviewAdresse(k, 999, `kd:${rep.k3}`, basis));
      await expect(page.locator('.rv-meld')).toContainText('Aufgabe #999 gibt es nicht.');
      await expect(page.locator('#rv-meld')).toBeFocused();
      expect(page.url()).toContain('/aufgabe/999/review');
      await expect(page.locator('.rv-laedt')).toHaveCount(0);
      await page.getByRole('button', { name: knopf }).click();
      await expect(page).toHaveURL(ziel);
    });
  }

  /* ── Nacharbeit 1, Code-Review M1 und S1: ein Präfix ohne Kürzel geht nie wörtlich hinaus, auch nicht beim Wiederholen ── */

  const verweiseDer = anfragen => anfragen.map(u => new URL(u).searchParams.get('commit'));
  const ZEIT_503 = { status: 503, body: { fehler: 'Git antwortete nicht innerhalb von 10 s' } };

  test('Nacharbeit 1 (Code M1): „Erneut versuchen“ nach 503 liest mit dem aufgelösten Verweis kd:<voll>, nie mit dem nackten Präfix', async ({ page }) => {
    const z = zaehlen(page);
    const h = await halten(page, '**/api/aufgaben/1/diff?**');
    await page.goto(reviewAdresse(k, 1, rep.v1.slice(0, 7)));
    await expect.poll(() => h.angehalten()).toBe(1);
    h.frei(0, ZEIT_503);
    await expect(page.locator('.rv-meld')).toContainText('Zeitgrenze überschritten.');
    await page.locator('#rv-erneut').click();
    await expect.poll(() => h.angehalten()).toBe(2);
    h.frei(1);
    await expect(page.locator(POS)).toHaveText('3 von 4');
    await expect(page.locator('#rv-ctitel')).toHaveText('v.txt anlegen');
    expect(verweiseDer(z.diff)).toEqual([`kd:${rep.v1}`, `kd:${rep.v1}`]);
  });

  test('Nacharbeit 1 (Code S1/M1): scheitert die Liste bei nacktem Präfix, steht „Die Liste der Commits ließ sich nicht lesen …“ mit „Erneut versuchen“; gelesen wird erst nach der Liste und nur kd:<voll>', async ({ page }) => {
    const z = zaehlen(page);
    const liste = await halten(page, '**/api/aufgaben/1/commits');
    const h = await halten(page, '**/api/aufgaben/1/diff?**');
    await page.goto(reviewAdresse(k, 1, rep.v1.slice(0, 7)));
    await expect.poll(() => liste.angehalten()).toBe(1);
    liste.frei(0, { status: 500, body: { fehler: 'innen kaputt' } });
    const meldung = page.locator('.rv-meld');
    await expect(meldung).toContainText('Die Liste der Commits ließ sich nicht lesen: innen kaputt (500).');
    await expect(meldung).toHaveAttribute('role', 'alert');
    await expect(meldung).not.toContainText('Commit-Verweis');
    await expect(page.locator('#rv-meld')).toBeFocused();
    expect(z.diff.length).toBe(0);
    // Wiederholen, während die Liste noch liest: der Diff wartet auf sie
    await meldung.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect.poll(() => liste.angehalten()).toBe(2);
    await expect(page.locator('.rv-laedt')).toBeVisible();
    expect(z.diff.length).toBe(0);
    liste.frei(1);
    await expect.poll(() => h.angehalten()).toBe(1);
    h.frei(0, ZEIT_503);
    await expect(meldung).toContainText('Zeitgrenze überschritten.');
    await page.locator('#rv-erneut').click();
    await expect.poll(() => h.angehalten()).toBe(2);
    h.frei(1);
    await expect(page.locator(POS)).toHaveText('3 von 4');
    expect(verweiseDer(z.diff)).toEqual([`kd:${rep.v1}`, `kd:${rep.v1}`]);
    expect(z.commits.length).toBe(2);
  });

  /* ── AK 7 Verzögerte Antworten, Insel, Live ── */

  test('AK 7 (1): die gehaltene Antwort für K3 kommt nach dem Wechsel zu W1 — sie wird verworfen, keine Folgeanfrage', async ({ page }) => {
    const z = zaehlen(page);
    const h = await halten(page, url => url.pathname === '/api/aufgaben/1/diff' && url.searchParams.get('commit') === `kd:${rep.k3}`);
    await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
    await expect(page.locator('.rv-laedt')).toBeVisible();
    await page.evaluate(h => { location.hash = `#/aufgaben/aufgabe/1/review?commit=kd%3A${h}`; }, rep.w1);
    await expect(page.locator(POS)).toHaveText('2 von 4');
    h.frei(0);
    await page.waitForFunction(k3 => performance.getEntriesByType('resource').some(e => e.name.includes(k3) && e.responseEnd > 0), rep.k3);
    await expect(page.locator(POS)).toHaveText('2 von 4');
    await expect(page.locator('#rv-ctitel')).toHaveText('b.txt anlegen');
    await expect(page.locator('#rv-insel .df-k .p')).toHaveText(['b.txt']);
    expect([z.commits.length, z.diff.length]).toEqual([1, 2]);
  });

  test('AK 7 (2): Live-Ereignis an #9 — die Insel bleibt derselbe Knoten mit Klappen, Nachgeladenem, Auswahl und Leseposition; nichts wird gelesen', async ({ page }) => {
    const z = zaehlen(page);
    await page.goto(reviewAdresse(k, 9, `kd:${rep.f}`));
    await expect(page.locator('#rv-dk0')).toHaveAttribute('aria-expanded', 'true');
    await liveBereit(page);
    await page.locator('#rv-dk0').click();
    await expect(page.locator('#rv-dk0')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#rv-d20').getByRole('button', { name: 'Nachladen' }).click();
    await expect(page.locator('#rv-d20 table.dz').first()).toBeVisible();
    const vorher = await page.evaluate(() => {
      const insel = document.getElementById('rv-insel');
      insel.kdMarke = 'gleich';
      const zelle = document.querySelector('#rv-d1 tr.add .c');
      const auswahl = getSelection(); const bereich = document.createRange(); bereich.selectNodeContents(zelle); auswahl.removeAllRanges(); auswahl.addRange(bereich);
      const rv = document.getElementById('review'); rv.scrollTop = 900;
      return { auswahl: auswahl.toString(), oben: rv.scrollTop };
    });
    const anfragen = [z.commits.length, z.diff.length, z.datei.length];
    expect((await page.request.post(k.adresse + 'api/aufgaben/9/kommentare', { headers: AGENT, data: { text: 'live' } })).ok()).toBe(true);
    await expect.poll(() => page.evaluate(() => window.kdTest.kommentare(9))).toBe(1);
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    const nachher = await page.evaluate(() => ({ marke: document.getElementById('rv-insel').kdMarke, auswahl: getSelection().toString(), oben: document.getElementById('review').scrollTop }));
    expect(nachher).toEqual({ marke: 'gleich', ...vorher });
    await expect(page.locator('#rv-dk0')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#rv-d20 table.dz').first()).toBeVisible();
    expect([z.commits.length, z.diff.length, z.datei.length]).toEqual(anfragen);
  });
  /* ── AK 5 Nachladen in Reihe und „wartet“ ── */

  async function nachladenVorbereiten(page) {
    const z = zaehlen(page);
    const h = await halten(page, url => url.pathname === '/api/aufgaben/9/diff' && url.searchParams.has('datei'));
    await page.goto(reviewAdresse(k, 9, `kd:${rep.f}`));
    await expect(page.locator('#rv-d20')).toContainText('Diese Datei war nicht in der ersten Antwort, weil die Antwort zu groß wurde. Sie wird einzeln geladen.');
    return { z, h };
  }

  for (const [fall, erste] of [['fertig', undefined], ['mit 503', { status: 503, body: { fehler: 'Git antwortete nicht innerhalb von 10 s' } }]]) {
    test(`AK 5: zwei „Nachladen“ — eine Anfrage zur Zeit, die zweite wartet ohne Knopf und startet, wenn die erste ${fall} ist`, async ({ page }) => {
      const { z, h } = await nachladenVorbereiten(page);
      await page.locator('#rv-d20').getByRole('button', { name: 'Nachladen' }).click();
      await expect(page.locator('#rv-d20 .df-laedt')).toHaveText('Lädt die Änderungen …');
      await expect(page.locator('#rv-d20')).toHaveAttribute('aria-busy', 'true');
      await expect(page.locator('#rv-dk20')).toBeFocused();
      await page.locator('#rv-d21').getByRole('button', { name: 'Nachladen' }).click();
      const wartet = page.locator('#rv-d21 .df-wartet');
      await expect(wartet).toHaveText('Wartet, bis die andere Datei geladen ist …');
      await expect(wartet).toHaveAttribute('role', 'status');
      await expect(wartet.locator('svg.i')).toHaveCount(1);
      await expect(page.locator('#rv-d21 .df-inhalt button')).toHaveCount(0);
      await expect(page.locator('#rv-dk21')).toBeFocused();
      expect(z.datei.length).toBe(1);
      h.frei(0, erste);
      await expect(page.locator('#rv-d21 .df-laedt')).toHaveText('Lädt die Änderungen …');
      expect(z.datei.length).toBe(2);
      if (erste) {
        const fehler = page.locator('#rv-d20 .df-hin.fehl');
        await expect(fehler).toContainText('Zeitgrenze überschritten. Die Änderungen dieser Datei konnten nicht geladen werden (503).');
        await expect(fehler).toHaveAttribute('role', 'alert');
        await expect(page.locator('#rv-d20 table.dz')).toHaveCount(0);
        await expect(fehler.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
      } else {
        await expect(page.locator('#rv-d20 table.dz').first()).toBeVisible();
      }
      h.frei(1);
      await expect(page.locator('#rv-d21 table.dz').first()).toBeVisible();
      expect(z.datei.length).toBe(2);
      expect(new URL(z.datei[1]).searchParams.get('datei')).toBe('f22.txt');
    });
  }

  test('AK 5: die gross-Datei lädt mit „Änderungen anzeigen“ einzeln und steht danach ganz gezeichnet (3.001 Zeilen und Kopf)', async ({ page }) => {
    const { z, h } = await nachladenVorbereiten(page);
    const gross = page.locator('#rv-d25');
    await expect(gross).toContainText('Der Patch ist groß (3.001 Zeilen) und wird erst auf Wunsch geladen.');
    await gross.getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(gross.locator('.df-laedt')).toBeVisible();
    h.frei(0);
    await expect(gross.locator('table.dz')).toHaveCount(7);
    expect(await gross.locator('tr').count()).toBe(3002);
    expect(new URL(z.datei[0]).searchParams.get('datei')).toBe('gross.txt');
    expect(new URL(z.datei[0]).searchParams.get('commit')).toBe(`kd:${rep.f}`);
  });

  test('AK 5: Antwort mit zu_gross_zum_anzeigen → „Zu groß zum Anzeigen. Es stehen nur die Zahlen: +3.001 −0.“ ohne Knopf', async ({ page }) => {
    await page.route(url => url.pathname === '/api/aufgaben/9/diff' && url.searchParams.get('datei') === 'gross.txt', async route => {
      const antwort = await route.fetch();
      const json = await antwort.json();
      json.dateien = json.dateien.map(d => ({ ...d, gross: true, patch: undefined }));
      json.hinweise = [{ art: 'zu_gross_zum_anzeigen', datei: 'gross.txt' }];
      await route.fulfill({ response: antwort, json });
    });
    await page.goto(reviewAdresse(k, 9, `kd:${rep.f}`));
    const gross = page.locator('#rv-d25');
    await gross.getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(gross).toContainText('Zu groß zum Anzeigen. Es stehen nur die Zahlen: +3.001 −0.');
    await expect(gross.locator('.df-inhalt button')).toHaveCount(0);
    await expect(page.locator('#rv-dk25')).toBeFocused();
  });
  /* ── AK 1 Einstieg aus der Liste ── */

  async function listeOeffnen(page, nr = 1) {
    await page.goto(`${k.adresse}#/board/entwicklung/aufgabe/${nr}`);
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator('#fenster tbody tr.cl-z').first()).toBeVisible();
  }
  const zeile = (page, hash) => page.locator('#fenster tbody tr.cl-z').filter({ has: page.locator('th .cl-hash', { hasText: new RegExp(`^${kurz(hash)}$`) }) });

  test('AK 1: je Zeile mit Diff genau ein Verweis mit Namen; Hash und Rand der Zeile treffen ihn; V2 ohne Verweis', async ({ page }) => {
    await listeOeffnen(page);
    for (const [hash, titel, wort] of [[rep.k3, 'c.txt anlegen', 'auf 2 Zweigen'], [rep.w1, 'b.txt anlegen', 'auf Zweig karte/1'], [rep.v1, 'v.txt anlegen', 'auf keinem Zweig'], [rep.r1, 'r.txt anlegen', 'auf Zweig o/x']]) {
      const z = zeile(page, hash);
      expect(await z.evaluate(e => e.querySelectorAll('a[href]').length)).toBe(1);
      const verweis = z.locator('a[href]');
      await expect(verweis).toHaveAttribute('aria-label', `Commit ${kurz(hash)}, ${titel}, ${wort}`);
      expect(decodeURIComponent(await verweis.getAttribute('href'))).toBe(`#/board/entwicklung/aufgabe/1/review?commit=kd:${hash}`);
      const kasten = await z.boundingBox();
      for (const [x, y] of [[kasten.x + 4, kasten.y + 4], [kasten.x + kasten.width - 6, kasten.y + kasten.height - 4]]) {
        expect(await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.closest('a') && e.closest('a').getAttribute('href'); }, [x, y])).toBe(await verweis.getAttribute('href'));
      }
    }
    expect(await zeile(page, rep.v2).evaluate(e => e.querySelectorAll('a[href]').length)).toBe(0);
  });

  test('AK 1/US-1: Linksklick auf die Zeile V1 → „3 von 4“ mit Band; zweimal blättern; ein Browser-Zurück → Fenster mit „Commits“, Fokus auf V1', async ({ page }) => {
    await listeOeffnen(page);
    const laenge = await page.evaluate(() => history.length);
    const z = zeile(page, rep.v1);
    const kasten = await z.boundingBox();
    await page.mouse.click(kasten.x + kasten.width - 8, kasten.y + 6);
    await expect(page.locator(POS)).toHaveText('3 von 4');
    await expect(page.locator('.rv-band')).toBeVisible();
    await expect(page.locator('#fenster')).toHaveCount(0);
    expect(await page.evaluate(() => history.length)).toBe(laenge + 1);
    await page.locator('#rv-vor').click();
    await expect(page.locator(POS)).toHaveText('4 von 4');
    await expect(page.locator('#rv-zurueck')).toBeFocused();
    await page.locator('#rv-zurueck').click();
    await page.locator('#rv-zurueck').click();
    await expect(page.locator(POS)).toHaveText('2 von 4');
    expect(await page.evaluate(() => history.length)).toBe(laenge + 1);
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]')).toHaveAttribute('aria-label', 'Ansicht: Commits');
    expect(page.url()).toMatch(/#\/board\/entwicklung\/aufgabe\/1$/);
    await expect(zeile(page, rep.v1).locator('a.cl-ziel')).toBeFocused();
  });

  test('AK 1: „← #1“ nach dem Öffnen aus der Liste geht einen Schritt zurück, Fokus auf dem Verweis der Zeile', async ({ page }) => {
    await listeOeffnen(page);
    const laenge = await page.evaluate(() => history.length);
    await zeile(page, rep.w1).locator('a.cl-ziel').click();
    await expect(page.locator(POS)).toHaveText('2 von 4');
    await expect(page.locator('#rv-rueckweg')).toBeFocused();
    await page.locator('#rv-rueckweg').click();
    await expect(zeile(page, rep.w1).locator('a.cl-ziel')).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(laenge + 1);
    expect(page.url()).toMatch(/#\/board\/entwicklung\/aufgabe\/1$/);
    // es war ein Schritt zurück im Verlauf (nicht ersetzt): vorwärts steht wieder die Review-Seite
    await page.goForward();
    await expect(page.locator(POS)).toHaveText('2 von 4');
  });

  test('AK 1/US-2: „Alle Änderungen ansehen“ zeigt K3 „1 von 4“ ohne Zurück; die Adresse nennt danach den vollen Verweis', async ({ page }) => {
    await listeOeffnen(page);
    await page.getByRole('link', { name: 'Alle Änderungen ansehen' }).click();
    await expect(page.locator(POS)).toHaveText('1 von 4');
    await expect(page.locator('#rv-zurueck')).toHaveCount(0);
    expect(page.url()).toContain(`/review?commit=kd%3A${rep.k3}`);
  });

  test('AK 1/US-8: „Alle Änderungen ansehen“ an #6 → „Keine Änderungen zu zeigen …“, Adresse ohne ?commit=, „Zurück zur Liste der Commits“ ins Fenster', async ({ page }) => {
    await listeOeffnen(page, 6);
    await page.getByRole('link', { name: 'Alle Änderungen ansehen' }).click();
    await expect(page.locator('.rv-meld')).toContainText('Keine Änderungen zu zeigen.');
    expect(page.url()).toMatch(/\/aufgabe\/6\/review$/);
    await page.getByRole('button', { name: 'Zurück zur Liste der Commits' }).click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #6' })).toBeVisible();
    await expect(page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]')).toBeFocused();
  });

  test('AK 1: Strg+Klick auf den Verweis bleibt ein Link — die Seite selbst wechselt nicht', async ({ page, context }) => {
    await listeOeffnen(page);
    const neu = context.waitForEvent('page');
    await zeile(page, rep.k3).locator('a.cl-ziel').click({ modifiers: ['Control'] });
    const tab = await neu;
    await tab.waitForLoadState();
    expect(decodeURIComponent(tab.url())).toContain(`/review?commit=kd:${rep.k3}`);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await tab.close();
  });
  /* ── AK 4 Diff und Merkmale (#7, #8) ── */

  const datei = (page, pfad) => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: pfad }) });
  async function merkmaleOeffnen(page) {
    await page.goto(reviewAdresse(k, 7, `kd:${rep.d}`));
    await expect(page.locator('#rv-ctitel')).toHaveText(rep.dTitel);
  }

  test('AK 4: Dateiliste mit Statuswort, Pfad und +/−; Zeilennummern nach den Hunk-Köpfen, U+2028 eine Zeile, „\\ No newline“ ohne Nummer', async ({ page }) => {
    await merkmaleOeffnen(page);
    const eintraege = page.locator('.dn .dn-e');
    await expect(eintraege).toHaveCount(13);
    for (const [pfad, wort] of [['text.txt', 'geändert'], ['neu.txt', 'neu'], ['weg.txt', 'gelöscht'], ['neu-name.txt', 'umbenannt'], ['skript.sh', 'geändert']]) {
      const e = eintraege.filter({ hasText: pfad }).first();
      await expect(e.locator('.s')).toHaveText(wort);
      await expect(e.locator('.z')).toHaveText(/^\+\d+ −\d+$/);
    }
    const text = datei(page, 'text.txt');
    await expect(text.locator('tr.hk')).toHaveCount(3);
    const zeilen = await text.locator('tr').evaluateAll(z => z.map(r => [...r.children].map(c => c.textContent)));
    const nummern = zeilen.filter(z => z.length === 4).map(z => [z[0], z[1], z[2]]);
    expect(nummern.slice(0, 7)).toEqual([['1', '1', ''], ['2', '', '−'], ['', '2', '+'], ['3', '3', ''], ['4', '4', ''], ['5', '5', '']].concat([nummern[6]]));
    const trenner = zeilen.find(z => z[3] && z[3].includes(' '));
    expect(trenner.slice(0, 3)).toEqual(['', '20', '+']);
    const ohneEnde = zeilen.find(z => z[3] === '\\ No newline at end of file');
    expect(ohneEnde.slice(0, 3)).toEqual(['', '', '']);
    await expect(page.locator('h3 .df-k')).toHaveCount(13);
    await expect(text.locator('table.dz').first()).toHaveAttribute('aria-label', 'Änderungen in text.txt');
  });

  test('AK 4: Merkmale nie still — umbenannt, Modus, nicht UTF-8, binär, gelöscht zu, groß mit Knopf, Pfad über 4.096 Byte ohne Knopf, 200.000 Zeichen ganz', async ({ page }) => {
    await merkmaleOeffnen(page);
    await expect(datei(page, 'neu-name.txt').locator('.ren')).toHaveText('umbenannt ← alt-name.txt · 100 %');
    await expect(datei(page, 'skript.sh')).toContainText('Dateimodus 100644 → 100755; der Inhalt ist unverändert.');
    await expect(datei(page, 'latin.txt')).toContainText('Nicht als UTF-8 lesbar — nicht darstellbare Zeichen sind ersatzweise mit � wiedergegeben.');
    await expect(datei(page, 'bild.bin')).toContainText('Binärdatei — der Inhalt wird nicht angezeigt.');
    await expect(datei(page, 'weg.txt').locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    const gross = datei(page, 'gross.txt');
    await expect(gross).toContainText('Der Patch ist groß (3.001 Zeilen) und wird erst auf Wunsch geladen.');
    await expect(gross.getByRole('button', { name: 'Änderungen anzeigen' })).toBeVisible();
    const tief = datei(page, 'x.txt');
    await expect(tief).toContainText('Zu groß zum Anzeigen. Es stehen nur die Zahlen: +1 −0.');
    await expect(tief.locator('.df-inhalt button')).toHaveCount(0);
    const lang = datei(page, 'lang.txt').locator('tr.add .c');
    expect(await lang.evaluate(c => c.textContent.length)).toBe('hinzugefügt: '.length + 200000);
    expect(await lang.evaluate(c => getComputedStyle(c).whiteSpace)).toBe('pre');
    expect(await lang.evaluate(c => c.getBoundingClientRect().height)).toBeLessThan(30);
    expect(await page.locator('#app').innerText()).not.toMatch(/\bKB\b|\bMB\b/);
  });

  test('AK 4: ein Eintrag der Dateiliste klappt eine zugeklappte Datei auf und bringt ihren Kopf ins Bild; Fokus auf ihrem Kopf', async ({ page }) => {
    await merkmaleOeffnen(page);
    const weg = datei(page, 'weg.txt');
    await expect(weg.locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('.dn .dn-e').filter({ hasText: 'weg.txt' }).click();
    await expect(weg.locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
    await expect(weg.locator('tr.del')).toHaveCount(1);
    await expect(weg.locator('.df-k')).toBeFocused();
    await expect(weg.locator('.df-k')).toBeInViewport();
  });

  test('AK 4: dateien_gekappt (2.000 von 2.431) steht über den Dateien mit den Zahlen der Antwort', async ({ page }) => {
    await page.route('**/api/aufgaben/7/diff?**', async route => {
      const antwort = await route.fetch();
      const json = await antwort.json();
      json.hinweise.push({ art: 'dateien_gekappt', gezeigt: 2000, gesamt: 2431 });
      await route.fulfill({ response: antwort, json });
    });
    await merkmaleOeffnen(page);
    await expect(page.locator('.rv-gekappt')).toHaveText('2.000 von 2.431 Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; der Commit liegt vollständig im Repository.');
  });

  test('AK 4: Budget an #8 — vier Dateien offen, die fünfte zu mit „anzeigen“; ihr Aufklappen fragt den Server nicht; Blöcke ≤ 500 mit content-visibility', async ({ page }) => {
    const z = zaehlen(page);
    await page.goto(reviewAdresse(k, 8, `kd:${rep.e}`));
    const koepfe = page.locator('#rv-insel .df-k');
    await expect(koepfe).toHaveCount(5);
    expect(await koepfe.evaluateAll(k => k.map(e => e.getAttribute('aria-expanded')))).toEqual(['true', 'true', 'true', 'true', 'false']);
    await expect(koepfe.nth(4).locator('.mk')).toHaveText('anzeigen');
    const bloecke = await page.locator('#rv-insel .dz-b').evaluateAll(b => b.map(e => [e.querySelectorAll('tr').length, getComputedStyle(e).contentVisibility]));
    expect(bloecke.length).toBe(20);
    for (const [zeilen, sicht] of bloecke) { expect(zeilen).toBeLessThanOrEqual(500); expect(sicht).toBe('auto'); }
    const vorher = [z.commits.length, z.diff.length, z.datei.length];
    await koepfe.nth(4).click();
    await expect(koepfe.nth(4)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rv-d4 tr')).toHaveCount(2);
    expect([z.commits.length, z.diff.length, z.datei.length]).toEqual(vorher);
  });

  test('AK 4: „Alle einklappen“ schließt alle Dateien, „Alle aufklappen“ öffnet die mit patch, die groß-Datei bleibt zu, keine datei=-Anfrage', async ({ page }) => {
    const z = zaehlen(page);
    await merkmaleOeffnen(page);
    const alle = page.locator('#rv-alle');
    await expect(alle).toHaveText('Alle einklappen');
    await alle.click();
    await expect(alle).toHaveText('Alle aufklappen');
    await expect(page.locator('#rv-insel .df-k[aria-expanded="true"]')).toHaveCount(0);
    await expect(alle).toBeFocused();
    await alle.click();
    await expect(alle).toHaveText('Alle einklappen');
    await expect(datei(page, 'text.txt').locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
    await expect(datei(page, 'weg.txt').locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
    await expect(datei(page, 'gross.txt').locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    expect(z.datei).toEqual([]);
  });

  test('AK 4: #8 „Vor“ auf E0 → „2 von 2“, „Dieser Commit ändert keine Dateien.“, „0 Dateien · +0 −0“, keine Liste, kein „Alle …“', async ({ page }) => {
    await page.goto(reviewAdresse(k, 8, `kd:${rep.e}`));
    await expect(page.locator(POS)).toHaveText('1 von 2');
    await page.locator('#rv-vor').click();
    await expect(page.locator(POS)).toHaveText('2 von 2');
    await expect(page.locator('.rv-leer')).toHaveText('Dieser Commit ändert keine Dateien.');
    await expect(page.locator('.rv-leiste .sum')).toHaveText('0 Dateien · +0 −0');
    await expect(page.locator('.dn, #rv-alle, #rv-insel')).toHaveCount(0);
  });

  test('AK 4: Fenstertitel „Review #7 · kd:<kurz> — kanbanD“, mit laufendem Timer „(1 ▶) …“; h1 Review, h2 Titel, h3 je Datei', async ({ page }) => {
    await merkmaleOeffnen(page);
    await expect(page).toHaveTitle(`Review #7 · ${kurz(rep.d)} — kanbanD`);
    await expect(page.locator('h1')).toHaveText(['Review']);
    await expect(page.locator('h2#rv-ctitel')).toHaveCount(1);
    await expect(page.locator('#rv-insel h3')).toHaveCount(13);
    await liveBereit(page);
    expect((await page.request.post(k.adresse + 'api/aufgaben/7/timer/start', { headers: { 'X-KanbanD-Wer': 'st' } })).ok()).toBe(true);
    await expect(page).toHaveTitle(`(1 ▶) Review #7 · ${kurz(rep.d)} — kanbanD`);
  });

  /* ── AK 8 Fremder Text und sichtbare Zeichen ── */

  test('AK 8: <img onerror> in Pfad, Zeile und Titel steht als Text, es entsteht kein img; Bidi als Marke, ESC und \\r sichtbar, Tab bleibt', async ({ page }) => {
    await merkmaleOeffnen(page);
    await expect(page.locator('#rv-ctitel')).toContainText(BOESE);
    await expect(page.locator('.dn .dn-e').filter({ hasText: BOESE })).toHaveCount(1);
    await expect(datei(page, BOESE).locator('tr.add .c')).toHaveText(`hinzugefügt: ${BOESE}`);
    await expect(page.locator('#app img')).toHaveCount(0);
    expect(await page.evaluate(() => window.pwn)).toBeUndefined();
    const bidi = datei(page, 'datei.txt');
    const marken = page.locator('.mk-bidi');
    await expect(marken).toHaveCount(3);
    for (const m of await marken.all()) {
      await expect(m).toHaveAttribute('role', 'img');
      await expect(m).toHaveAttribute('aria-label', 'sichtbar gemachtes Bidi-Steuerzeichen U+202E');
      await expect(m).toHaveText('⟨U+202E⟩');
      await expect(m.locator('svg')).toHaveCount(1);
    }
    await expect(page.locator('.dn .mk-bidi')).toHaveCount(1);
    await expect(bidi.locator('.df-k .mk-bidi')).toHaveCount(1);
    await expect(bidi.locator('tr.add .mk-bidi')).toHaveCount(1);
    await expect(bidi.locator('tr.add .mk-st')).toHaveText('␛ U+001B');
    expect(await bidi.locator('tr.add .c').evaluate(c => c.textContent.includes('c\td'))).toBe(true);
    await expect(datei(page, 'text.txt').locator('tr.add .mk-st').first()).toHaveText('␍');
    expect(await page.evaluate(() => document.getElementById('review').textContent.includes('‮'))).toBe(false);
  });

  /* ── AK 10 Tastatur und Bedienhilfe ── */

  test('AK 10: Tab-Folge Rückweg, Zurück, Vor, Alle einklappen, Dateiliste, Kopf und Code je Datei; Enter und Leertaste klappen, Fokus bleibt, Fokusring', async ({ page }) => {
    await page.goto(reviewAdresse(k, 1, `kd:${rep.v1}`));
    await expect(page.locator('#rv-rueckweg')).toBeFocused();
    const reihe = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      reihe.push(await page.evaluate(() => { const e = document.activeElement, st = getComputedStyle(e); return { id: e.id || e.className, ring: st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0 }; }));
    }
    expect(reihe.map(r => r.id)).toEqual(['rv-zurueck', 'rv-vor', 'rv-alle', 'dn-e', 'rv-dk0', 'df-sc']);
    for (const r of reihe) expect(r.ring, `Fokusring an ${r.id}`).toBe(true);
    await expect(page.locator('#rv-zurueck')).toHaveAttribute('aria-label', 'Zurück, voriger Commit 2 von 4');
    await expect(page.locator(POS)).toHaveAttribute('aria-live', 'polite');
    const kopf = page.locator('#rv-dk0');
    await kopf.focus();
    await page.keyboard.press('Enter');
    await expect(kopf).toHaveAttribute('aria-expanded', 'false');
    await expect(kopf).toBeFocused();
    await page.keyboard.press('Space');
    await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    await expect(kopf).toBeFocused();
    const zeile = page.locator('#rv-d0 tr.add').first();
    expect(await zeile.evaluate(r => [...r.querySelectorAll('.n, .m')].every(c => c.getAttribute('aria-hidden') === 'true'))).toBe(true);
    await expect(zeile.locator('.c .vh')).toHaveText('hinzugefügt: ');
  });

  test('AK 6/AK 10: Antwortbudget an einer nachgeladenen Datei steht an der Datei mit role=status, die Seite bleibt lesbar', async ({ page }) => {
    await page.route(url => url.pathname === '/api/aufgaben/9/diff' && url.searchParams.has('datei'), route => route.fulfill({ status: 503, json: { fehler: 'Antwortbudget von 64 MB belegt' } }));
    await page.goto(reviewAdresse(k, 9, `kd:${rep.f}`));
    await page.locator('#rv-d20').getByRole('button', { name: 'Nachladen' }).click();
    const meldung = page.locator('#rv-d20 .df-hin.warn');
    await expect(meldung).toContainText('Server ausgelastet (Antwortbudget). Die Änderungen dieser Datei wurden nicht geladen. Es wird nicht von selbst wiederholt.');
    await expect(meldung).toHaveAttribute('role', 'status');
    await expect(page.locator('#rv-d0 table.dz').first()).toBeVisible();
    await expect(page.locator('#rv-dk20')).toBeFocused();
  });
  /* ── AK 9 Breite, Ziele, Knöpfe, Themen ── */

  /** Rechte Kanten von Dateiliste, Leiste und Commit-Kopf; Breiten der Textspalten; Zeilen des 200-Zeichen-Pfads in der Dateiliste. */
  const lageMessen = page => page.evaluate(() => {
    const breite = document.documentElement.clientWidth;
    const rechts = ['.dn', '.rv-leiste', '.rv-commit'].flatMap(sel => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().right > breite + 0.5).map(() => sel));
    const w = sel => Math.min(...[...document.querySelectorAll(sel)].map(e => e.getBoundingClientRect().width));
    const pfad = [...document.querySelectorAll('.dn .p')].find(e => e.textContent.startsWith('pppp'));
    const hoehe = parseFloat(getComputedStyle(pfad).lineHeight);
    return { rechts, spalten: { pfad: w('.dn .p'), titel: w('.rv-commit h2'), zweige: w('.rv-zweige'), code: w('.df-sc') }, zeilen: Math.round(pfad.getBoundingClientRect().height / hoehe) };
  });

  for (const breite of [320, 414, 641, 768, 980, 1280]) {
    test(`AK 9: ${breite} px hell und dunkel — die Seite scrollt nie quer, nur der Code-Bereich; Spalten ≥ 160 px und Pfad ≤ 3 Zeilen zwischen 641 und 980`, async ({ page }) => {
      await breiteSetzen(page, breite, 900);
      await merkmaleOeffnen(page);
      await expect(datei(page, 'lang.txt').locator('table.dz')).toBeVisible();
      for (const farbe of ['light', 'dark']) {
        await thema(page, farbe);
        expect(await breiteMessen(page, `Review ${breite} ${farbe}`)).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
        // Blöcke außerhalb des Bildes zeichnet der Browser nicht (content-visibility): gemessen wird an der Zeile im Bild
        await datei(page, 'lang.txt').locator('tr.add').scrollIntoViewIfNeeded();
        expect(await breiteMessen(page, `Review ${breite} ${farbe}, lange Zeile im Bild`)).toEqual([]);
        const quer = await datei(page, 'lang.txt').locator('.df-sc').evaluate(e => e.scrollWidth > e.clientWidth);
        expect(quer, 'die lange Zeile scrollt in ihrem Code-Bereich').toBe(true);
        const lage = await lageMessen(page);
        expect(lage.rechts).toEqual([]);
        if (breite >= 641 && breite <= 980) {
          for (const [spalte, px] of Object.entries(lage.spalten)) expect(px, `${spalte} bei ${breite}`).toBeGreaterThanOrEqual(160);
          expect(lage.zeilen, 'Pfad aus 200 Zeichen').toBeLessThanOrEqual(3);
        }
      }
    });
  }

  test('AK 9: bis 640 px „‹“ und „›“ mit Namen „Voriger Commit, 2 von 4“ / „Nächster Commit, 4 von 4“, Symbol ≥ 3:1; darüber der Text im Namen', async ({ page }) => {
    await breiteSetzen(page, 640, 800);
    await page.goto(reviewAdresse(k, 1, `kd:${rep.v1}`));
    await expect(page.locator('#rv-zurueck')).toHaveAttribute('aria-label', 'Voriger Commit, 2 von 4');
    await expect(page.locator('#rv-vor')).toHaveAttribute('aria-label', 'Nächster Commit, 4 von 4');
    await expect(page.locator('#rv-zurueck')).toHaveText('‹');
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      for (const id of ['#rv-zurueck', '#rv-vor']) {
        const [tinte, grund] = await page.locator(`${id} .bl-s`).evaluate(e => [getComputedStyle(e).color, getComputedStyle(e.closest('button')).backgroundColor]);
        expect(await kontrastFarben(page, tinte, grund), `${id} ${farbe}`).toBeGreaterThanOrEqual(3);
      }
    }
    await breiteSetzen(page, 641, 800);
    await expect(page.locator('#rv-zurueck')).toHaveAttribute('aria-label', 'Zurück, voriger Commit 2 von 4');
    await expect(page.locator('#rv-zurueck .t')).toHaveText('Zurück');
  });

  test('AK 9: jeder Knopf der Seite und der Liste trägt .btn mit der Randfarbe eines .btn außerhalb der Seite', async ({ page }) => {
    const randVon = sel => page.evaluate(sel => [...document.querySelectorAll(sel)].map(e => [e.textContent.trim().slice(0, 30), e.classList.contains('btn'), getComputedStyle(e).borderTopColor]), sel);
    const bezug = () => page.evaluate(() => { const b = document.createElement('button'); b.className = 'btn'; document.body.append(b); const f = getComputedStyle(b).borderTopColor; b.remove(); return f; });
    const KNOEPFE = '#review .rv-leiste button, #review .rv-meld button, #review .df-hin button, #review .rv-randb button, #review .rv-lfehl button, #fenster .cl-alle';
    await page.route('**/api/aufgaben/1/commits', async route => { const a = await route.fetch(); const json = await a.json(); json.commits = json.commits.filter(e => e.hash !== rep.w1); await route.fulfill({ response: a, json }); });
    const proben = [[reviewAdresse(k, 9, `kd:${rep.f}`), '#rv-d25'], [reviewAdresse(k, 1, `kd:${rep.w1}`), '.rv-randb'], [reviewAdresse(k, 1, 'zz'), '.rv-meld'], [reviewAdresse(k, 6, null), '.rv-meld']];
    let gezaehlt = 0;
    for (const [adresse, anker] of proben) {
      await page.goto(adresse);
      await expect(page.locator(anker)).toBeVisible();
      const soll = await bezug();
      for (const [text, btn, rand] of await randVon(KNOEPFE)) { gezaehlt++; expect(btn, text).toBe(true); expect(rand, text).toBe(soll); }
    }
    await page.goto(`${k.adresse}#/board/entwicklung/aufgabe/1`);
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator('#fenster .cl-alle')).toBeVisible();
    const soll = await bezug();
    for (const [text, btn, rand] of await randVon(KNOEPFE)) { gezaehlt++; expect(btn, text).toBe(true); expect(rand, text).toBe(soll); }
    expect(gezaehlt).toBeGreaterThanOrEqual(6);
  });

  /** Kontrast im Bereich: Text ≥ 4,5:1, Rand und Symbol der Marken ≥ 3:1; Text in „wartet“ und im Band nie in --kd-faint. */
  async function kontrastPruefen(page, wo) {
    const messungen = await kontrastMessen(page, ['#review', '#kopf']);
    const fehler = messungen.filter(m => m.wert < 4.5).map(m => `${wo}: ${m.element} „${String(m.text).slice(0, 30)}“ ${m.wert.toFixed(2)}`);
    const marken = await page.evaluate(() => [...document.querySelectorAll('#review .mk-z, #review .bl-s, #review .df-wartet svg, #review .rv-meld svg, #review .df-hin svg')].map(m => {
      let grund = m.parentElement;
      while (grund && getComputedStyle(grund).backgroundColor === 'rgba(0, 0, 0, 0)') grund = grund.parentElement;
      const st = getComputedStyle(m);
      // der Rand gegen den ersten deckenden Grund um die Marke, Symbol und Schrift gegen die Fläche der Marke selbst
      return { text: m.textContent.slice(0, 20) || m.tagName, rand: st.borderTopStyle === 'none' ? null : st.borderTopColor, tinte: st.color, flaeche: st.backgroundColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(grund).backgroundColor : st.backgroundColor, aussen: getComputedStyle(grund).backgroundColor };
    }));
    for (const m of marken) {
      if (m.rand && (await kontrastFarben(page, m.rand, m.aussen)) < 3) fehler.push(`${wo}: Rand ${m.text}`);
      if ((await kontrastFarben(page, m.tinte, m.flaeche)) < 3) fehler.push(`${wo}: Symbol ${m.text}`);
    }
    const blass = await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--kd-faint)'; document.body.append(p); const f = getComputedStyle(p).color; p.remove(); return [...document.querySelectorAll('#review .df-wartet, #review .rv-band')].filter(e => getComputedStyle(e).color === f).length; });
    if (blass) fehler.push(`${wo}: Text in --kd-faint`);
    return { fehler, gemessen: messungen.length };
  }

  for (const farbe of ['light', 'dark']) {
    test(`AK 9: Kontrast ${farbe} an allen Zuständen — Laden, wartet, lädt, 503 an Seite und Datei, verwaist, Marken, gekappt, Rand b und c`, async ({ page }) => {
      test.setTimeout(90000);
      await thema(page, farbe);
      const fehler = [];
      const pruefe = async wo => { await thema(page, farbe); const r = await kontrastPruefen(page, wo); expect(r.gemessen, `${wo}: Text gemessen`).toBeGreaterThan(0); fehler.push(...r.fehler); };
      // Laden der Seite
      const diffVon1 = url => url.pathname === '/api/aufgaben/1/diff';
      const h = await halten(page, diffVon1);
      await page.goto(reviewAdresse(k, 1, `kd:${rep.v1}`));
      await expect(page.locator('.rv-laedt')).toBeVisible();
      await pruefe('Laden');
      h.frei(0);
      await expect(page.locator('.rv-band')).toBeVisible();
      await pruefe('verwaist');
      await page.unroute(diffVon1);
      // 503 an der Seite, beide Arten
      for (const [wo, f] of [['503 Budget', 'Antwortbudget von 64 MB belegt'], ['503 Zeit', 'Git antwortete nicht']]) {
        await page.route('**/api/aufgaben/1/diff?**', route => route.fulfill({ status: 503, json: { fehler: f } }));
        await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
        await expect(page.locator('.rv-meld')).toBeVisible();
        await pruefe(wo);
        await page.unroute('**/api/aufgaben/1/diff?**');
      }
      // Rand c und b
      await page.goto(reviewAdresse(k, 6, null));
      await expect(page.locator('.rv-meld')).toBeVisible();
      await pruefe('Rand c');
      await page.route('**/api/aufgaben/1/commits', async route => { const a = await route.fetch(); const json = await a.json(); json.commits = json.commits.filter(e => e.hash !== rep.w1); await route.fulfill({ response: a, json }); });
      await page.goto(reviewAdresse(k, 1, `kd:${rep.w1}`));
      await expect(page.locator('.rv-randb')).toBeVisible();
      await pruefe('Rand b');
      // Marken und gekappt an #7
      await page.route('**/api/aufgaben/7/diff?**', async route => { const a = await route.fetch(); const json = await a.json(); json.hinweise.push({ art: 'dateien_gekappt', gezeigt: 2000, gesamt: 2431 }); await route.fulfill({ response: a, json }); });
      await page.goto(reviewAdresse(k, 7, `kd:${rep.d}`));
      await expect(page.locator('.rv-gekappt')).toBeVisible();
      await pruefe('Marken und gekappt');
      // lädt, wartet, 503 an der Datei (#9)
      const d = await halten(page, url => url.pathname === '/api/aufgaben/9/diff' && url.searchParams.has('datei'));
      await page.goto(reviewAdresse(k, 9, `kd:${rep.f}`));
      await page.locator('#rv-d20').getByRole('button', { name: 'Nachladen' }).click();
      await page.locator('#rv-d21').getByRole('button', { name: 'Nachladen' }).click();
      await page.locator('#rv-d22').getByRole('button', { name: 'Nachladen' }).click();
      await expect(page.locator('#rv-d21 .df-wartet')).toBeVisible();
      await pruefe('lädt und wartet');
      d.frei(0, { status: 503, body: { fehler: 'Git antwortete nicht' } });
      await expect.poll(() => d.angehalten()).toBe(2);
      d.frei(1, { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } });
      await expect(page.locator('#rv-d21 .df-hin.warn')).toBeVisible();
      await expect(page.locator('#rv-d20 .df-hin.fehl')).toBeVisible();
      await pruefe('503 an der Datei');
      expect(fehler).toEqual([]);
    });
  }

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
    test('AK 9/AK 1: bei grobem Zeiger ist jedes Ziel der Seite mindestens 48 × 48 px, jede Zeile der Liste mindestens 48 px hoch', async ({ page }) => {
      await page.goto(reviewAdresse(k, 1, `kd:${rep.v1}`));
      await expect(page.locator(POS)).toHaveText('3 von 4');
      const klein = await page.evaluate(() => [...document.querySelectorAll('#kopf a[href], #review button, #review a[href]')].filter(e => e.checkVisibility()).map(e => { const r = e.getBoundingClientRect(); return [e.id || e.className, Math.round(r.width), Math.round(r.height)]; }).filter(([, b, h]) => b < 48 || h < 48));
      expect(klein).toEqual([]);
      expect(await zieleMessen(page, { zeiger: 'touch', ansicht: 'Review 414' })).toEqual([]);
      await page.goto(`${k.adresse}#/board/entwicklung/aufgabe/1`);
      await liveBereit(page);
      await reiter(page, 'Commits');
      await expect(page.locator('#fenster tbody tr.cl-z')).toHaveCount(5);
      const flach = await page.locator('#fenster tbody tr.cl-z').evaluateAll(z => z.map(e => Math.round(e.getBoundingClientRect().height)).filter(h => h < 48));
      expect(flach).toEqual([]);
    });
  });

  test('AK 9: bei feinem Zeiger ist jedes Ziel der Seite mindestens 24 × 24 px', async ({ page }) => {
    await page.goto(reviewAdresse(k, 7, `kd:${rep.d}`));
    await expect(page.locator('#rv-ctitel')).toBeVisible();
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'Review fein' })).toEqual([]);
  });
});
