// R00220 „Transkripte erfassen“ in „Einrichten“ umschalten (Karte #218, I0210, Scheibe C2) — AK 5–10 im echten Programm.
// Ausgangslage: `kanbanD.md` ohne `record-transcripts` (Vorgabe „aus“), `fabrik` mit `record-transcripts: true`, `zweit` ohne
// Schlüssel, ein Board mit einem Namen aus 60 Zeichen ohne Schlüssel (Titel; ein Slug hat höchstens 40 Zeichen), #3 auf `zweit`
// mit einem Kosteneintrag ohne Transkript, #1 auf `fabrik`. Antworten des Umschaltens per `page.route` gehalten und über ein
// Promise freigegeben, keine Schlafzeiten (ADR-0026).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { kanbanStarten, alsPerson, bereit, commitSteht, reiter, liveBereit } = require('./hilfen');

const LANGER_NAME = 'zweites-board-mit-einem-sehr-langen-namen-aus-sechzig-zeiche';
const ERKLAERTEXT = 'Ein Transkript hält den ganzen Lauf eines Agenten fest, auch die Ausgaben seiner Werkzeuge. Es liegt gezippt im Board-Ordner, bleibt auf diesem Rechner und reist nicht mit dem Repository; Löschen löscht es wirklich. Ausschalten gilt nur für neue Läufe; abgelegte Transkripte bleiben. Umschalten können nur Menschen. Jeder Klick gilt sofort, ohne „Speichern“.';
const ABSCHNITT = '#transkripte';

function ausgangslage(ordner) {
  const spalten = '## Eingang\n\n## Entwicklung\n\n## Fertig\n';
  const dateien = {
    'kanbanD.md': '---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler eins, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n---\n',
    'boards/fabrik.md': `---\nrecord-transcripts: true\n---\n\n# fabrik\n\n${spalten.replace('## Entwicklung\n', '## Entwicklung\n\n- [#1](../aufgaben/0001-eins.md)\n')}`,
    'boards/zweit.md': `# zweit\n\n${spalten.replace('## Entwicklung\n', '## Entwicklung\n\n- [#3](../aufgaben/0003-drei.md)\n')}`,
    'boards/lang.md': `# ${LANGER_NAME}\n\n${spalten}`,
    'aufgaben/0001-eins.md': '---\nid: 1\ntitle: Eins\ntranscripts:\n  - {at: 2026-11-19 15:00+01:00, role: entwickler, column: Entwicklung, bytes: 2048}\n---\n',
    // wie R00219 #3: ein früherer Lauf mit Transkript (sonst gibt es die Ansicht „Läufe“ nicht) und ein Kosteneintrag ohne Transkript
    'aufgaben/0003-drei.md': '---\nid: 3\ntitle: Drei\ntranscripts:\n  - {at: 2026-11-19 15:00+01:00, role: entwickler, column: Entwicklung, bytes: 2048}\ncost-entries:\n  - {at: 2026-11-20 10:00+01:00, role: entwickler, column: Entwicklung, amount: 0.2, currency: USD}\n---\n',
  };
  for (const [rel, inhalt] of Object.entries(dateien)) {
    fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
    fs.writeFileSync(path.join(ordner, rel), inhalt);
  }
  execFileSync('git', ['-C', ordner, 'init', '-q']);
  execFileSync('git', ['-C', ordner, 'add', '-A']);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=V', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'Ausgangslage R00220']);
}

const gruppe = (page, board) => page.getByRole('radiogroup', { name: board === null ? 'Vorgabe: Transkripte erfassen' : `Transkripte erfassen auf ${board}`, exact: true });
const wahl = (page, board, name) => gruppe(page, board).getByRole('radio', { name, exact: true });
const zeile = (page, board) => page.locator(`${ABSCHNITT} .ts-z`).filter({ has: gruppe(page, board) });
const wirkung = (page, board) => zeile(page, board).locator('.wk');
const satz = (page, board) => zeile(page, board).locator('[role="status"]');

let k;
test.beforeEach(async ({ page }) => {
  k = await kanbanStarten(ausgangslage);
  await alsPerson(page, 'sh');
});
test.afterEach(async () => { await k.stoppen(); });

async function einrichtenOeffnen(page) {
  await page.goto(`${k.adresse}#/einrichten`);
  await bereit(page, `${ABSCHNITT} .ts-z`);
}

/* ── AK 5 Abschnitt und Wirkung ── */

test('AK 5 · US-4: TRANSKRIPTE unter den übrigen Abschnitten — Erklärtext, Vorgabe „aus“, drei Boards in der Reihenfolge der API mit Wirkung', async ({ page }) => {
  await einrichtenOeffnen(page);
  const abschnitt = page.locator(ABSCHNITT);
  await expect(abschnitt.locator('h2')).toHaveText(/^TRANSKRIPTE/);
  await expect(abschnitt.locator('.hin')).toHaveText(ERKLAERTEXT);
  // unter den übrigen Abschnitten: nach der Knopfzeile „Speichern“ / „Verwerfen“
  const unten = await page.evaluate(() => {
    const knoepfe = document.querySelector('[data-act="einr-ok"]');
    return Boolean(knoepfe.compareDocumentPosition(document.querySelector('#transkripte')) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(unten).toBe(true);
  await expect(zeile(page, null).locator('.nm')).toHaveText('Vorgabe des Ordnersfür Boards ohne eigenen Wert');
  const boards = (await (await page.request.get(`${k.adresse}api/boards`)).json()).map(b => b.titel);
  expect([...boards].sort()).toEqual(['fabrik', LANGER_NAME, 'zweit'].sort());
  await expect(page.locator(ABSCHNITT).getByRole('radiogroup')).toHaveCount(4);
  const namen = await page.locator(`${ABSCHNITT} [role="radiogroup"]`).evaluateAll(g => g.map(x => x.getAttribute('aria-label')));
  expect(namen).toEqual(['Vorgabe: Transkripte erfassen', ...boards.map(b => `Transkripte erfassen auf ${b}`)]);
  for (const [board, gewaehlt, wirkt] of [[null, 'aus', null], ['fabrik', 'an', 'erfasst'], ['zweit', 'wie Vorgabe', 'erfasst nicht'], [LANGER_NAME, 'wie Vorgabe', 'erfasst nicht']]) {
    await expect(gruppe(page, board).locator('[role="radio"][aria-checked="true"]')).toHaveCount(1);
    await expect(wahl(page, board, gewaehlt)).toHaveAttribute('aria-checked', 'true');
    if (wirkt) await expect(wirkung(page, board)).toHaveText(wirkt);
  }
  await expect(gruppe(page, 'zweit').getByRole('radio')).toHaveText(['wie Vorgabe', 'an', 'aus']);
  await expect(gruppe(page, null).getByRole('radio')).toHaveText(['an', 'aus']);
});

test('AK 5 / FA 11: ein Boardname aus der Datei bleibt Text, Bidi-Steuerzeichen fallen weg', async ({ page }) => {
  k.schreib('boards/fremd.md', '# <img src=x onerror=window.pwn=1>‮ab\n\n## Eingang\n');
  k.git('add', '-A');
  k.git('-c', 'user.name=V', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'fremd');
  await einrichtenOeffnen(page);
  await expect(zeile(page, '<img src=x onerror=window.pwn=1>ab').locator('.nm')).toHaveText('<img src=x onerror=window.pwn=1>ab');
  expect(await page.evaluate(() => window.pwn)).toBeUndefined();
});

/* ── Gehaltene Antworten und gezählte Anfragen ── */

/** Zählt die schreibenden Anfragen an Schalter und Einstellungen: [{pfad, rumpf}]. */
function schreibzaehler(page) {
  const liste = [];
  page.on('request', r => {
    if (r.method() !== 'PUT') return;
    const pfad = new URL(r.url()).pathname;
    if (pfad.endsWith('/transkripte') || pfad === '/api/einstellungen') liste.push({ pfad, rumpf: r.postDataJSON() });
  });
  return liste;
}

/** Hält jedes `PUT …/transkripte`, bis `freigeben(wie)` es beantwortet: `'weiter'` (Server), eine Zahl (Fehler mit diesem Status
 *  und `{fehler}`) oder `'abbruch'` (keine Verbindung). */
async function anhalten(page, fehler = 'Git ist beschäftigt') {
  const wartend = [];
  await page.route(url => url.pathname.endsWith('/transkripte') && url.pathname !== '/api/aufgaben/3/transkripte', async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    const wie = await new Promise(r => wartend.push(r));
    if (wie === 'weiter') return route.continue();
    if (wie === 'abbruch') return route.abort('connectionrefused');
    return route.fulfill({ status: wie, json: { fehler } });
  });
  return {
    gehalten: () => wartend.length,
    freigeben: async (wie = 'weiter') => {
      await expect.poll(() => wartend.length, 'ein Umschalten ist gehalten').toBeGreaterThan(0);
      wartend.shift()(wie);
    },
  };
}

const commits = () => +k.git('rev-list', '--count', 'HEAD');
const vorschau = page => page.locator('#einr-vorschau');
const gesperrt = async (page, board) => {
  await expect(gruppe(page, board)).toHaveAttribute('aria-disabled', 'true');
  for (const r of await gruppe(page, board).getByRole('radio').all()) await expect(r).toHaveAttribute('aria-disabled', 'true');
};
const frei = async (page, board) => {
  await expect(gruppe(page, board)).not.toHaveAttribute('aria-disabled');
  for (const r of await gruppe(page, board).getByRole('radio').all()) await expect(r).not.toHaveAttribute('aria-disabled');
};

/* ── AK 6 Sofort und ein Commit ── */

test('AK 6 · US-4: „an“ bei zweit — genau ein PUT, nur diese Gruppe gesperrt, „stellt um …“, Fokus; danach Satz, Wirkung, ein Commit; Vorgabe an wirkt auf „wie Vorgabe“', async ({ page }) => {
  await einrichtenOeffnen(page);
  const anfragen = schreibzaehler(page);
  const h = await anhalten(page);
  // Klick auf die schon gewählte Wahl: kein PUT
  await wahl(page, null, 'aus').click();
  await page.waitForFunction(() => window.kdTest.gezeichnet());
  expect(anfragen).toHaveLength(0);

  const vorher = commits();
  await wahl(page, 'zweit', 'an').click();
  await expect(wirkung(page, 'zweit')).toHaveText('stellt um …');
  await gesperrt(page, 'zweit');
  for (const b of [null, 'fabrik', LANGER_NAME]) await frei(page, b);
  await expect(wahl(page, 'zweit', 'an')).toHaveAttribute('aria-checked', 'true');
  await expect(wahl(page, 'zweit', 'an')).toBeFocused();
  // eine weitere Wahl in der gesperrten Gruppe schickt nichts (force: Playwright wartet sonst, bis aria-disabled fällt)
  await wahl(page, 'zweit', 'aus').click({ force: true });
  await page.waitForFunction(() => window.kdTest.gezeichnet());
  expect(anfragen).toEqual([{ pfad: '/api/boards/zweit/transkripte', rumpf: { erfassen: true } }]);
  expect(h.gehalten()).toBe(1);
  await expect(vorschau(page)).not.toContainText('record-transcripts');

  await h.freigeben();
  await expect(satz(page, 'zweit')).toHaveText('Auf „zweit“ werden jetzt Transkripte erfasst.');
  await expect(wirkung(page, 'zweit')).toHaveText('erfasst');
  await frei(page, 'zweit');
  await commitSteht(k, vorher + 1);
  expect(commits()).toBe(vorher + 1);
  expect(k.git('show', '--name-only', '--format=', 'HEAD')).toBe('boards/zweit.md');

  await wahl(page, null, 'an').click();
  await h.freigeben();
  await expect(satz(page, null)).toHaveText('Für Boards ohne eigenen Wert werden jetzt Transkripte erfasst.');
  await expect(wirkung(page, LANGER_NAME)).toHaveText('erfasst');
  await expect(vorschau(page)).toContainText('record-transcripts: true');

  await wahl(page, 'zweit', 'wie Vorgabe').click();
  await h.freigeben();
  await expect(satz(page, 'zweit')).toHaveText('Auf „zweit“ werden jetzt Transkripte erfasst.');
  await expect(wirkung(page, 'zweit')).toHaveText('erfasst');
  await expect.poll(() => k.lies('boards/zweit.md')).not.toContain('record-transcripts');
  expect(anfragen.map(a => [a.pfad, a.rumpf.erfassen])).toEqual([['/api/boards/zweit/transkripte', true], ['/api/einstellungen/transkripte', true], ['/api/boards/zweit/transkripte', null]]);
});

/* ── AK 7 Fehler und Agent ── */

test('AK 7 · US-5: 503 — die Wahl springt zurück, Satz mit Status ohne „Erneut versuchen“, Fokus in der Gruppe, kein Commit', async ({ page }) => {
  await einrichtenOeffnen(page);
  const h = await anhalten(page);
  const vorher = commits();
  await wahl(page, 'zweit', 'an').click();
  await h.freigeben(503);
  await expect(satz(page, 'zweit')).toHaveText('Der Schalter ließ sich nicht umstellen: Git ist beschäftigt (503).');
  await expect(wahl(page, 'zweit', 'wie Vorgabe')).toHaveAttribute('aria-checked', 'true');
  await expect(wirkung(page, 'zweit')).toHaveText('erfasst nicht');
  await expect(zeile(page, 'zweit').getByRole('button', { name: 'Erneut versuchen' })).toHaveCount(0);
  expect(await gruppe(page, 'zweit').evaluate(g => g.contains(document.activeElement) && document.activeElement.getAttribute('role') === 'radio')).toBe(true);
  expect(commits()).toBe(vorher);
});

test('AK 7 · US-5: ohne Verbindung — eigener Satz mit „Erneut versuchen“, das dasselbe PUT noch einmal schickt', async ({ page }) => {
  await einrichtenOeffnen(page);
  const anfragen = schreibzaehler(page);
  const h = await anhalten(page);
  await wahl(page, 'zweit', 'an').click();
  await h.freigeben('abbruch');
  await expect(satz(page, 'zweit')).toHaveText('Der Schalter ließ sich nicht umstellen: keine Verbindung zum Programm.');
  await expect(wahl(page, 'zweit', 'wie Vorgabe')).toHaveAttribute('aria-checked', 'true');
  expect(await gruppe(page, 'zweit').evaluate(g => g.contains(document.activeElement))).toBe(true);
  await zeile(page, 'zweit').getByRole('button', { name: 'Erneut versuchen' }).click();
  await h.freigeben();
  await expect(satz(page, 'zweit')).toHaveText('Auf „zweit“ werden jetzt Transkripte erfasst.');
  expect(anfragen).toEqual([{ pfad: '/api/boards/zweit/transkripte', rumpf: { erfassen: true } }, { pfad: '/api/boards/zweit/transkripte', rumpf: { erfassen: true } }]);
  await expect.poll(() => k.lies('boards/zweit.md')).toContain('record-transcripts: true');
});

test('AK 7 · US-5: entw1 im Ich-Menü — die Abweisung des Servers steht an der Zeile, die Wahl springt zurück', async ({ browser }) => {
  const kontext = await browser.newContext();
  const seite = await kontext.newPage();
  await alsPerson(seite, 'entw1');
  try {
    await einrichtenOeffnen(seite);
    const vorher = commits();
    await wahl(seite, 'fabrik', 'aus').click();
    await expect(satz(seite, 'fabrik')).toHaveText('Der Schalter ließ sich nicht umstellen: Den Schalter „Transkripte erfassen“ stellen nur Menschen um (403).');
    await expect(wahl(seite, 'fabrik', 'an')).toHaveAttribute('aria-checked', 'true');
    expect(commits()).toBe(vorher);
    expect(k.lies('boards/fabrik.md')).toContain('record-transcripts: true');
  } finally {
    await kontext.close();
  }
});

/* ── AK 8 Getrennt vom Entwurf, Vorschau zeigt den geschriebenen Stand ── */

const namensfeld = page => page.locator('[data-person="sh"] input[data-ef="pname"]');

test('AK 8 · US-6: offener Entwurf bleibt nach dem Live-Ereignis; Vorschau erst nach der Antwort; „Verwerfen“ und „Speichern“ lassen den Schalter', async ({ page }) => {
  await einrichtenOeffnen(page);
  const anfragen = schreibzaehler(page);
  await namensfeld(page).fill('Stefan H');
  const h = await anhalten(page);
  await wahl(page, null, 'an').click();
  await expect(wirkung(page, LANGER_NAME)).toHaveText('erfasst nicht');
  await expect(vorschau(page)).not.toContainText('record-transcripts: true');
  await h.freigeben();
  await expect(vorschau(page)).toContainText('record-transcripts: true');
  await expect.poll(() => k.lies('kanbanD.md')).toContain('record-transcripts: true');
  await bereit(page, `${ABSCHNITT} .ts-z`);
  await expect(namensfeld(page)).toHaveValue('Stefan H');

  await page.getByRole('button', { name: 'Verwerfen' }).click();
  await expect(namensfeld(page)).toHaveValue('Stefan');
  await expect(wahl(page, null, 'an')).toHaveAttribute('aria-checked', 'true');
  expect(anfragen.filter(a => a.pfad.endsWith('/transkripte'))).toHaveLength(1);

  await namensfeld(page).fill('Stefan H');
  const vorher = commits();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await commitSteht(k, vorher + 1);
  const speichern = anfragen.filter(a => a.pfad === '/api/einstellungen');
  expect(speichern).toHaveLength(1);
  expect(Object.keys(speichern[0].rumpf)).not.toContain('transkripte_erfassen');
  expect(Object.keys(speichern[0].rumpf)).not.toContain('record-transcripts');
  expect(k.lies('kanbanD.md')).toContain('record-transcripts: true');
  expect(k.lies('kanbanD.md')).toContain('Stefan H');
  await expect(vorschau(page)).toContainText('record-transcripts: true');
});

test('AK 8: ein Entwurf aus einem zweiten Fenster, vor dem Umschalten geöffnet, nach dem Umschalten gespeichert — die Datei trägt true, beide Vorschauen zeigen true', async ({ page, browser }) => {
  const kontext = await browser.newContext();
  const zweite = await kontext.newPage();
  await alsPerson(zweite, 'sh');
  try {
    await einrichtenOeffnen(zweite);
    await namensfeld(zweite).fill('Stefan Zwei');
    await einrichtenOeffnen(page);
    await wahl(page, null, 'an').click();
    await expect(satz(page, null)).toHaveText('Für Boards ohne eigenen Wert werden jetzt Transkripte erfasst.');
    await expect.poll(() => k.lies('kanbanD.md')).toContain('record-transcripts: true');
    await expect(vorschau(zweite)).toContainText('record-transcripts: true');
    await expect(namensfeld(zweite)).toHaveValue('Stefan Zwei');
    const vorher = commits();
    await zweite.getByRole('button', { name: 'Speichern' }).click();
    await commitSteht(k, vorher + 1);
    expect(k.lies('kanbanD.md')).toContain('record-transcripts: true');
    expect(k.lies('kanbanD.md')).toContain('Stefan Zwei');
    await expect(vorschau(page)).toContainText('record-transcripts: true');
    await expect(vorschau(zweite)).toContainText('record-transcripts: true');
  } finally {
    await kontext.close();
  }
});

/* ── AK 9 Verweis aus „Läufe“ ── */

const HINWEIS = '#fenster [role="note"]';
const VERWEIS_NAME = 'In „Einrichten“ umschalten';

async function laeufeOeffnen(page, nr, board) {
  await page.goto(`${k.adresse}#/board/${board}/aufgabe/${nr}`);
  await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  await liveBereit(page);
  await reiter(page, 'Läufe');
  await expect(page.locator('#laeufe-status')).toHaveText(/ (Lauf|Läufe) · Stand /);
}

/** Nach dem Aktivieren: kein Dialog mehr, „Einrichten“ offen, Fokus auf TRANSKRIPTE, sichtbar im Bildlaufbehälter, auch nach 500 ms. */
async function amAbschnittTranskripte(page) {
  await expect(page).toHaveURL(/#\/einrichten$/);
  const kopf = page.locator('#transkripte h2');
  await expect(kopf).toBeFocused();
  await expect(page.locator('[aria-modal="true"]')).toHaveCount(0);
  const lage = () => kopf.evaluate(h => {
    let behaelter = h.parentElement;
    while (behaelter && !/(auto|scroll)/.test(getComputedStyle(behaelter).overflowY)) behaelter = behaelter.parentElement;
    const r = h.getBoundingClientRect(), b = (behaelter || document.documentElement).getBoundingClientRect();
    // feste oder klebende Kopfzeilen, die die Überschrift überdecken (nicht ihre eigenen Vorfahren)
    const feste = [...document.querySelectorAll('body *')].filter(e => !e.contains(h) && ['fixed', 'sticky'].includes(getComputedStyle(e).position) && e.getClientRects().length)
      .map(e => e.getBoundingClientRect()).filter(f => f.bottom > r.top && f.top < r.bottom && f.right > r.left && f.left < r.right);
    return { innen: r.top >= b.top - 1 && r.bottom <= b.bottom + 1, verdeckt: feste.length, tag: document.activeElement.tagName, text: document.activeElement.textContent, tabindex: document.activeElement.getAttribute('tabindex') };
  });
  await expect.poll(lage).toMatchObject({ innen: true, verdeckt: 0, tag: 'H2', tabindex: '-1' });
  expect((await lage()).text.startsWith('TRANSKRIPTE')).toBe(true);
  // Frist nur für das Ausbleiben eines Ereignisses (ADR-0026 Regel 5): der Fokus springt nicht zurück
  await page.waitForTimeout(500);
  await expect(kopf).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(wahl(page, null, 'aus')).toBeFocused();
}

test('AK 9 · US-7: Verweis hinter dem Hinweis an #3 auf zweit — Enter öffnet „Einrichten“ am Abschnitt TRANSKRIPTE mit Fokus und Fokusring', async ({ page }) => {
  await laeufeOeffnen(page, 3, 'zweit');
  await expect(page.locator(HINWEIS)).toHaveText(`Auf „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript. ${VERWEIS_NAME}`);
  const verweis = page.locator(HINWEIS).getByRole('link', { name: VERWEIS_NAME });
  await verweis.focus();
  await page.keyboard.press('Enter');
  const kopf = page.locator('#transkripte h2');
  await expect(kopf).toBeFocused();
  const ring = await kopf.evaluate(h => { const st = getComputedStyle(h); return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth) }; });
  expect(ring.stil).toBe('solid');
  expect(ring.breite).toBeGreaterThanOrEqual(2);
  await amAbschnittTranskripte(page);
  // US-7: dort lässt sich zweit einschalten
  await wahl(page, 'zweit', 'an').click();
  await expect(satz(page, 'zweit')).toHaveText('Auf „zweit“ werden jetzt Transkripte erfasst.');
});

test('AK 9: derselbe Verweis per Mausklick; an #1 auf fabrik weder Hinweis noch Verweis', async ({ page }) => {
  await laeufeOeffnen(page, 1, 'fabrik');
  await expect(page.locator(HINWEIS)).toHaveCount(0);
  await expect(page.getByRole('link', { name: VERWEIS_NAME })).toHaveCount(0);
  await laeufeOeffnen(page, 3, 'zweit');
  await page.locator(HINWEIS).getByRole('link', { name: VERWEIS_NAME }).click();
  await amAbschnittTranskripte(page);
});
