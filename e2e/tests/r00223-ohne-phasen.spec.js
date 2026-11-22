// R00223 (I0213, Karte #227, Scheibe S3 von ADR-0034): Phasen werden gewöhnliche Spalten — AK 1 (Text der Berichte), 10, 11,
// 12 und 13 im echten Programm gegen ein echtes Arbeits-Repository mit WBS und Phasen-Datei. Schichten: Testfall (je AK) →
// Testsprache (`ausgangslage`, `ansichten`, `farbenMessen`) → Treiber (Playwright, Selektoren nur hier). Die API-Seite prüft
// tests/akzeptanz_r00223.rs, die Rechnung der Berichte e2e/einheit/r00223-ohne-phasen.test.js.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, alsPerson, bereit, breiteSetzen, thema, mehrOeffnen, reiter } = require('./hilfen');

const FARBEN_DATEI = path.join(__dirname, 'r00223-farben.json');
const FIEBER_PUNKT = 'Fortschritt: Anteil der Aufgaben, die die Zielspalte erreicht haben — ohne Wahl die Abschlussspalte („Erledigt heißt“) —, am Umfang des Tages. Prognose und Durchsatz gehören zu demselben Block wie in „Wie lange noch“. Neue Aufgaben senken ihn — der Punkt springt nach links.';
const SPALTEN_PUNKT = 'Eine Aufgabe hat eine Spalte erreicht, sobald sie dort oder rechts davon liegt; es zählt das erste Erreichen. Je Spalte (außer der ersten) eine Kurve „noch nicht erreicht“.';
const BREITEN = [375, 641, 768, 980];

// ---- Testsprache: Ausgangslage ------------------------------------------------------------------------------------------

/** Arbeits-Repository R: WBS `Dokumentation/Planung/kd.md`, Phasen-Datei `kd-phasen.md` (Entwicklung, Reviews, Abnahme), C1. */
function arbeitsRepository() {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-r00223-')));
  const git = (...a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' }).trim();
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/kd.md'), '# WBS\n\n| ID | Ebene | Eltern | Name | Status |\n|---|---|---|---|---|\n| I0007 | Interaction | — | Liste | rot |\n');
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/kd-phasen.md'), '# Phasen\n\n## Phasen\n\n| Nr | Phase | Nachweis |\n|---|---|---|\n| 1 | Entwicklung | — |\n| 2 | Reviews | — |\n| 3 | Abnahme | — |\n');
  fs.writeFileSync(path.join(r, 'export.txt'), 'eins\n');
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=Ada', '-c', 'user.email=a@a', 'commit', '-q', '-m', 'C1 Export');
  return { r, c1: git('rev-parse', 'HEAD'), wbs: `${r}/Dokumentation/Planung/kd.md` };
}

const datei = n => `aufgaben/${String(n).padStart(4, '0')}-a${n}.md`;
const boardText = (titel, kopf, spalten, lage) => `---\n${kopf}---\n\n# ${titel}\n` + spalten.map((s, i) => `\n## ${s}\n\n` + (lage[i] || []).map(n => `- [#${n}](../${datei(n)})\n`).join('')).join('');

const ENTWICKLUNG = ['Offen', 'Entwicklung', 'Nacharbeit', 'Reviews', 'Erledigt'];
const ZUORDNUNG = ['Offen', 'Bereit', 'Live'];
const BREIT = ['Offen', 'Bereit', 'Entwicklung', 'Nacharbeit', 'Code-Review', 'Reviews', 'Erledigt'];

/** Je Tag die Lage der Boards: `entwicklung` aus R00223 (#1–#4), `breit` aus AK 13 (#9–#14, je Tag eine in die nächste Spalte). */
const TAGE = [
  ['2026-11-01', [[1, 2, 3, 4]], [[9, 10, 11, 12, 13, 14]]],
  ['2026-11-02', [[3, 4], [1, 2]], [[10, 11, 12, 13, 14], [9]]],
  ['2026-11-03', [[4], [2, 3], [], [1]], [[11, 12, 13, 14], [9], [10]]],
  ['2026-11-04', [[4], [], [2], [3]], [[12, 13, 14], [9], [10], [11]]],
  ['2026-11-05', [[4], [], [2], [3], [1]], [[13, 14], [9], [10], [11], [12]]],
  ['2026-11-06', [[4], [], [2], [3], [1]], [[14], [9], [10], [11], [12], [13]]],
  ['2026-11-07', [[4], [], [2], [3], [1]], [[], [9], [10], [11], [12], [13], [14]]],
];

/** Ordner `K` (mit `column-phases` und `phases` an #3) bzw. sein Zwilling `K'` (ohne), mit denselben datierten Bewegungen.
 *  Beide tragen zusätzlich `zuordnung` (AK 10) und `breit` (AK 13), nur `K` mit `column-phases`; `register` ersetzt die Registerzeilen (AK 11); ohne
 *  `gebunden` steht `applications: []` (Farbprobe AK 13: vor und nach der Karte dieselben Spaltenblöcke). */
const ausgangslage = (R, { mitPhasen = true, register = null, gebunden = true } = {}) => ordner => {
  const schreib = (rel, inhalt) => { fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true }); fs.writeFileSync(path.join(ordner, rel), inhalt); };
  const git = (args, datum) => execFileSync('git', ['-C', ordner, '-c', 'user.name=V', '-c', 'user.email=v@v', ...args], { env: { ...process.env, GIT_AUTHOR_DATE: `${datum}T09:00:00`, GIT_COMMITTER_DATE: `${datum}T09:00:00` } });
  const zeilen = register || `kd: {name: KD, repository: ${R.r}, wbs: ${R.wbs}}`;
  schreib('kanbanD.md', `---\npeople:\n  sh: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n  applications:\n    ${zeilen}\n---\n`);
  for (const n of [1, 2, 3, 4, 9, 10, 11, 12, 13, 14]) {
    const zusatz = n === 1 ? `commits:\n  - kd:${R.c1}\n` : n === 3 && mitPhasen ? 'phases: {skipped: [Reviews]}\n' : '';
    schreib(datei(n), `---\nid: ${n}\ntitle: Aufgabe ${n}\n${zusatz}---\n`);
  }
  const phasen = mitPhasen ? 'column-phases:\n  Entwicklung: Entwicklung\n  Reviews: Reviews\n' : '';
  execFileSync('git', ['-C', ordner, 'init', '-q']);
  for (const [datum, entwicklung, breit] of TAGE) {
    schreib('boards/entwicklung.md', boardText('Entwicklung', `limits:\n  Nacharbeit: 1\n${phasen}applications: [${gebunden ? 'kd' : ''}]\n`, ENTWICKLUNG, entwicklung));
    schreib('boards/zuordnung.md', boardText('Zuordnung', `${mitPhasen ? 'column-phases:\n  Bereit: Abnahme\n  Live: Abnahme\n' : ''}column-owner:\n  Offen: chef\napplications: [kd]\n`, ZUORDNUNG, []));
    schreib('boards/breit.md', boardText('Breit', `${mitPhasen ? 'column-phases:\n  Entwicklung: Entwicklung\n  Code-Review: Reviews\n  Reviews: Reviews\n' : ''}applications: [kd]\n`, BREIT, breit));
    git(['add', '-A'], datum);
    git(['commit', '-q', '--allow-empty', '-m', `Stand ${datum}`], datum);
  }
};

// ---- Treiber: Oberfläche ------------------------------------------------------------------------------------------------

const AM_0808 = new Date('2026-11-08T12:00:00+01:00');

/** Öffnet das Board `slug` (es wird damit das Board der Berichte, web/app.js) und danach `route`, falls genannt. */
async function oeffnen(page, k, slug, route, anker) {
  await page.goto(`${k.adresse}#/board/${slug}`);
  await bereit(page, '.bahn');
  if (!route) return;
  await page.goto(`${k.adresse}#/${route}`);
  await expect(page).toHaveURL(new RegExp(`#/${route}$`));
  await bereit(page, anker);
}

async function vorbereiten(page) {
  await alsPerson(page, 'sh');
  await page.clock.setFixedTime(AM_0808);
}

/** Anker je Bericht: ein Element, das erst mit dem fertig gerechneten Bericht entsteht (das Fever Chart wartet auf seinen Cache). */
const ANKER = { verlauf: '#bd-kennzahl', prognose: '#main .dtitel', fieber: '#main .fb-einst' };
const bericht = (page, k, slug, route) => oeffnen(page, k, slug, `berichte/${route}`, ANKER[route] || '#main .dtitel');
const board = (page, k, slug) => oeffnen(page, k, slug, null);

/** Sichtbarer Text des Hauptbereichs (bzw. des Aufgabenfensters) ohne den Bereich `#durchlaeufe`, jede Box aufgeklappt.
 *  Die Seite hält aufgeklappte `<details>` beim Neuzeichnen nicht (ADR-0007): deshalb klappt die Kopie auf, im selben Aufruf
 *  wie die Lesung (ADR-0026 N4 Regel 9). Dazu die Positivprobe: `boxen` in der Kopie und `gefuellt`, deren Inhalt außer
 *  `<summary>` sichtbaren Text trägt — eine zugeklappte Box liest sich leer und darf „Wort fehlt“ nicht grün machen. */
const sichttext = (page, sel = '#main') => page.locator(sel).first().evaluate(e => {
  const kopie = e.cloneNode(true);
  kopie.querySelectorAll('#durchlaeufe').forEach(d => d.remove());
  const boxen = [...kopie.querySelectorAll('details')];
  for (const box of boxen) box.open = true;
  document.body.append(kopie);
  const text = kopie.innerText;
  const gefuellt = boxen.filter(box => [...box.children].some(c => c.tagName !== 'SUMMARY' && c.innerText.trim() !== '')).length;
  kopie.remove();
  return { text, boxen: boxen.length, gefuellt };
});

/** Positivprobe (R00232 AK 10): mindestens eine Box, und jede ist mitgelesen. */
function allesMitgelesen(wo, sicht) {
  expect(sicht.boxen, `${wo}: Boxen in der Kopie`).toBeGreaterThanOrEqual(1);
  expect(sicht.gefuellt, `${wo}: jede Box mit Inhalt gelesen`).toBe(sicht.boxen);
}

async function aufgabeDetails(page, k, nr) {
  await board(page, k, 'entwicklung');
  await page.locator(`.ka[data-id="${nr}"]`).click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nr}` });
  await expect(fenster).toBeVisible();
  await reiter(page, 'Details');
  // die Details stehen, sobald die Zeile „Herkunft“ gezeichnet ist (wie in r00222-ohne-wbs.spec.js)
  await expect(fenster.locator('.felder-details .k', { hasText: 'Herkunft' })).toBeVisible();
  return fenster;
}

async function spaltenEinrichten(page, k, slug) {
  await board(page, k, slug);
  await mehrOeffnen(page);
  await page.locator('#mehr-spalten').click();
  await expect(page.locator('#setup-vorschau')).toBeVisible();
  await bereit(page);
}

/** Text jedes Spaltenkopfs des offenen Boards, je Spaltenname. */
const kopftexte = page => page.locator('.bahn').evaluateAll(bahnen => Object.fromEntries(bahnen.map(b => [b.dataset.col, b.querySelector('.bahn-kopf').innerText])));

/** Die gemessenen Farben eines Elements; misst erneut, wenn es zwischen Warten und Messen abgehängt wurde (Lehre aus #224). */
async function farbeVon(locator) {
  await expect(locator).toBeVisible();
  let farben = null;
  await expect.poll(async () => {
    farben = await locator.evaluate(e => { if (!e.isConnected) return null; const s = getComputedStyle(e); return { color: s.color, background: s.backgroundColor, borderTop: s.borderTopColor, borderLeft: s.borderLeftColor, borderBottom: s.borderBottomColor }; });
    return farben !== null && farben.color !== '';
  }, { message: 'Element nicht messbar (abgehängt)' }).toBe(true);
  return farben;
}

/** Farben je Thema: Leiste `#pruefungen-hinweis` und Spaltenköpfe von `zuordnung`, Blöcke von Wie lange noch auf `entwicklung`
 *  eines ungebundenen Zwillings — dort sind es vor und nach der Karte dieselben Spaltenblöcke mit demselben Anteil. */
async function farbenMessen(page, k, ungebunden) {
  const ergebnis = {};
  for (const t of ['light', 'dark']) {
    const m = { koepfe: {}, bloecke: {} };
    await board(page, k, 'zuordnung');
    await thema(page, t);
    m.hinweis = await farbeVon(page.locator('#pruefungen-hinweis'));
    for (const s of ZUORDNUNG) m.koepfe[s] = await farbeVon(page.locator(`.bahn[data-col="${s}"] .bahn-kopf`));
    await bericht(page, ungebunden, 'entwicklung', 'prognose');
    await thema(page, t);
    for (const s of ENTWICKLUNG.slice(1)) m.bloecke[s] = await farbeVon(page.locator(`#main section[data-spalte="${s}"]`));
    ergebnis[t] = m;
  }
  return ergebnis;
}

/** Breiten, an denen Dokument oder ein Bildlaufbehälter quer scrollt (`scrollWidth > clientWidth`). */
async function querScrollen(page, { fensterOffen = false } = {}) {
  const treffer = [];
  for (const breite of BREITEN) {
    await breiteSetzen(page, breite);
    // bei offenem Aufgabenfenster meldet `kdTest.gezeichnet()` keinen gezeichneten Stand; dann genügt das Layout von breiteSetzen
    if (!fensterOffen) await bereit(page);
    // aufklappen und messen in einem Aufruf: ein Neuzeichnen dazwischen klappte die Boxen wieder zu (ADR-0026 N4 Regel 9)
    const zuBreit = await page.evaluate(() => {
      for (const box of document.querySelectorAll('#main details, #fenster details')) box.open = true;
      const behaelter = [document.documentElement, ...document.querySelectorAll('#main, #main *, #fenster, #fenster *')].filter(e => {
        const s = getComputedStyle(e);
        return e === document.documentElement || /(auto|scroll)/.test(s.overflowX);
      });
      // ausgenommen sind die Behälter, die eine breite Tabelle bzw. die Bahnen absichtlich in sich quer rollen (vor wie nach der Karte)
      const breit = behaelter.filter(e => e.scrollWidth > e.clientWidth + 1 && !e.closest('.bahnen') && !e.matches('.wl-scroll, .bericht-rahmen')).map(e => `${e.tagName}.${e.className}#${e.id}`);
      // Positivprobe der Messung: jede Box stand beim Messen offen — eine zugeklappte Box macht „kein Querscrollen“ leer wahr
      const zu = document.querySelectorAll('#main details:not([open]), #fenster details:not([open])').length;
      return zu ? [...breit, `${zu} Box(en) beim Messen zu`] : breit;
    });
    if (zuBreit.length) treffer.push(`${breite}: ${zuBreit.join(', ')}`);
  }
  await breiteSetzen(page, 1280);
  return treffer;
}

const OHNE_WOERTER = ['durchlaufen', 'DURCHLAUFEN', 'Vorphase', 'bzw. ihre Phase', 'bzw. die letzte Phase'];

/** AK 12/13 am gezeichneten Fever Chart: Sichttext mit Positivprobe, ohne die alten Wörter und ohne /phase/i, kein Querscrollen. */
async function fieberLesen(page, wann) {
  const sicht = await sichttext(page);
  allesMitgelesen(`fieber ${wann}`, sicht);
  for (const wort of OHNE_WOERTER) expect(sicht.text, `fieber ${wann}: ohne „${wort}“`).not.toContain(wort);
  expect(sicht.text.match(/.{0,40}phase.{0,40}/gi), `fieber ${wann}: /phase/i im Sichttext`).toBeNull();
  expect(await querScrollen(page), `fieber ${wann}: kein Querscrollen`).toEqual([]);
}

// ---- Testfälle ----------------------------------------------------------------------------------------------------------

test.describe('R00223 Phasen werden gewöhnliche Spalten', () => {
  let R, k, zwilling;
  test.beforeEach(() => { R = arbeitsRepository(); });
  test.afterEach(async () => {
    for (const x of [k, zwilling]) if (x) await x.stoppen();
    k = zwilling = null;
    fs.rmSync(R.r, { recursive: true, force: true });
  });

  test('AK 1: Burndown, Wie lange noch und Fever Chart zeigen auf K denselben Text wie auf K\'', async ({ page }) => {
    test.setTimeout(90000);
    k = await kanbanStarten(ausgangslage(R));
    zwilling = await kanbanStarten(ausgangslage(R, { mitPhasen: false }));
    await vorbereiten(page);
    for (const route of ['verlauf', 'prognose', 'fieber']) {
      const texte = [];
      for (const x of [k, zwilling]) {
        await bericht(page, x, 'entwicklung', route);
        // das Fever Chart zeichnet nach dem Rechnen seines Caches neu: lesen (die Kopie klappt auf), bis der Text zwischen zwei
        // Lesungen gleich bleibt
        let vorher = null, text = null;
        await expect.poll(async () => {
          vorher = text;
          text = (await sichttext(page)).text;
          return text === vorher;
        }, { message: `${route}: Text steht` }).toBe(true);
        texte.push(text);
      }
      expect(texte[0], `${route}: derselbe Text auf K und K'`).toBe(texte[1]);
    }
  });

  test('AK 10: kein Feld „Phasen“ im Reiter „Details“, keine Leiste und kein Phasenname am Spaltenkopf, Leiste „Prüfungen“ bleibt, kein Commit', async ({ page }) => {
    k = await kanbanStarten(ausgangslage(R));
    const vorher = k.git('rev-list', '--count', 'HEAD');
    const schreibend = [];
    page.on('request', r => { if (r.url().includes('/api/') && r.method() !== 'GET') schreibend.push(`${r.method()} ${r.url()}`); });
    await vorbereiten(page);
    const fenster = await aufgabeDetails(page, k, 3);
    await expect(fenster.locator('.felder-details .k', { hasText: /^Phasen$/ })).toHaveCount(0);
    await expect(fenster.locator('#phasen-entfallen')).toHaveCount(0);
    await expect(fenster.getByText('phases', { exact: true })).toHaveCount(0);
    await expect(fenster.locator('[data-act="phase-entfaellt"]')).toHaveCount(0);
    for (const slug of ['entwicklung', 'zuordnung']) {
      await board(page, k, slug);
      await expect(page.locator('#phasen-hinweis')).toHaveCount(0);
      const koepfe = await kopftexte(page);
      for (const [spalte, text] of Object.entries(koepfe)) {
        expect(text, `${slug}/${spalte}: kein Phasenname am Kopf`).not.toMatch(/Abnahme|Phase/);
        expect(text.split(spalte).length - 1, `${slug}/${spalte}: der Name steht einmal`).toBe(1);
      }
    }
    await expect(page.locator('#pruefungen-hinweis')).toContainText('Spalte „Offen“: unbekannter Eigentümer „chef“');
    expect(k.git('rev-list', '--count', 'HEAD'), 'kein Commit beim Öffnen').toBe(vorher);
    expect(schreibend, 'keine schreibende Anfrage').toEqual([]);
  });

  test('AK 11: Tooltips unter „GEBUNDEN AN“ nennen nur Name und Kürzel bzw. applications: []', async ({ page }) => {
    k = await kanbanStarten(ausgangslage(R, { register: `kd: {name: KD, repository: ${R.r}, wbs: ${R.wbs}}\n    ab: {name: Abrechnung, repository: ${R.r}}` }));
    await vorbereiten(page);
    await spaltenEinrichten(page, k, 'entwicklung');
    const schalter = page.locator('[data-act="bind"]');
    const titel = await schalter.evaluateAll(l => l.map(b => [b.getAttribute('aria-label'), b.getAttribute('title')]));
    // die Schalter stehen in der Reihenfolge des Registers (nach Kürzel), „keine“ zuletzt
    expect(titel).toEqual([['Bindung Abrechnung', '„Abrechnung“ (ab)'], ['Bindung KD', '„KD“ (kd)'], ['Bindung keine', 'applications: []']]);
    for (const [, t] of titel) expect(t).not.toMatch(/Phasen|reines Kanban|Spalten bleiben/);
  });

  test('AK 12: Wie lange noch und Fever Chart ohne „durchlaufen“, Blöcke „ERREICHT“, Tabellenkopf und Methodik nach PO Z. 504', async ({ page }) => {
    k = await kanbanStarten(ausgangslage(R));
    await vorbereiten(page);
    for (const route of ['prognose', 'fieber']) {
      await bericht(page, k, 'entwicklung', route);
      const sicht = await sichttext(page);
      allesMitgelesen(route, sicht);
      const text = sicht.text;
      for (const wort of OHNE_WOERTER) expect(text, `${route}: ohne „${wort}“`).not.toContain(wort);
      await expect(page.locator('#main [data-phase]')).toHaveCount(0);
      const koepfe = await page.locator('#main table thead tr').evaluateAll(z => z.map(tr => tr.lastElementChild.textContent.trim()).filter(t => t.startsWith('Nicht vor')));
      for (const kopf of koepfe) expect(kopf).toBe('Nicht vor (Spalte links)');
      if (route === 'prognose') {
        expect(koepfe.length, 'Wie lange noch hat Tabellen mit „Nicht vor“').toBeGreaterThan(0);
        await expect(page.locator('#main section[data-spalte="Reviews"] .wl-badge')).toHaveText('2 VON 4 ERREICHT');
        const badges = await page.locator('#main .wl-badge').allTextContents();
        for (const b of badges) expect(b).toMatch(/ERREICHT$/);
        await expect(page.locator('#main .wl-liste li', { hasText: SPALTEN_PUNKT })).toHaveText(SPALTEN_PUNKT);
      } else {
        expect(await page.locator('#main .wl-liste li').first().textContent()).toBe(FIEBER_PUNKT);
      }
    }
  });

  test('AK 12: Sichttext von Board, Details, Spalten einrichten, Wie lange noch und Fever Chart trifft /phase/i nicht (ohne #durchlaeufe)', async ({ page }) => {
    k = await kanbanStarten(ausgangslage(R));
    await vorbereiten(page);
    // je Ansicht sofort: am Stand vor der Karte hält das Nachtragen der Phasen-Spalten (Commit beim Lesen) die Seite später an
    const pruefen = (wo, text) => expect(text.match(/.{0,40}phase.{0,40}/gi), `${wo}: /phase/i im Sichttext`).toBeNull();
    await board(page, k, 'entwicklung');
    pruefen('Board', (await sichttext(page)).text);
    await aufgabeDetails(page, k, 3);
    pruefen('Aufgabenfenster Details', (await sichttext(page, '#fenster')).text);
    // bei offenem Fenster meldet `kdTest.gezeichnet()` keinen gezeichneten Stand: geschlossen und frisch geladen weiter
    await page.keyboard.press('Escape');
    await page.reload();
    await spaltenEinrichten(page, k, 'entwicklung');
    pruefen('Spalten einrichten', (await sichttext(page, 'body')).text);
    await page.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(page.locator('#setup-vorschau')).toHaveCount(0);
    for (const route of ['prognose', 'fieber']) {
      await bericht(page, k, 'entwicklung', route);
      const sicht = await sichttext(page);
      allesMitgelesen(route, sicht);
      pruefen(route, sicht.text);
    }
  });

  test('AK 13: kein Querscrollen bei 375–980 px; Farben von Leiste, Blöcken und Spaltenköpfen wie vor der Karte', async ({ page }) => {
    test.setTimeout(120000);
    k = await kanbanStarten(ausgangslage(R));
    zwilling = await kanbanStarten(ausgangslage(R, { mitPhasen: false, gebunden: false }));
    await vorbereiten(page);
    // die Farben zuerst: am Stand vor der Karte (R00223_MESSEN=1) werden sie gemessen, bevor die Blockzahl auf breit scheitert
    const gemessen = await farbenMessen(page, k, zwilling);
    if (process.env.R00223_MESSEN) fs.writeFileSync(FARBEN_DATEI, JSON.stringify(gemessen, null, 2) + '\n');
    expect(gemessen).toEqual(JSON.parse(fs.readFileSync(FARBEN_DATEI, 'utf8')));
    const funde = [];
    await board(page, k, 'zuordnung');
    funde.push(...(await querScrollen(page)).map(x => `Board zuordnung ${x}`));
    await aufgabeDetails(page, k, 3);
    funde.push(...(await querScrollen(page, { fensterOffen: true })).map(x => `Aufgabe #3 ${x}`));
    await page.keyboard.press('Escape');
    await page.reload();
    for (const [slug, route] of [['entwicklung', 'prognose'], ['breit', 'prognose'], ['entwicklung', 'fieber']]) {
      await bericht(page, k, slug, route);
      if (slug === 'breit') expect(await page.locator('#main section[data-spalte]').count(), 'breit: sechs Spaltenblöcke').toBe(6);
      funde.push(...(await querScrollen(page)).map(x => `${route} ${slug} ${x}`));
    }
    expect(funde).toEqual([]);
  });

  // R00232 AK 11 (ADR-0026 N4, Abnahme-Probe): das Fever Chart ersetzt #main nach dem Nachtrag seines Caches bzw. in jedem Frame
  test('AK 12/13 Variante v1: Fever Chart mit 1,5 s verzögertem POST …/fieber/cache — Sichttext vollständig, kein Querscrollen, vor und nach dem Nachtrag', async ({ page }) => {
    test.setTimeout(60000);
    k = await kanbanStarten(ausgangslage(R));
    await vorbereiten(page);
    let gehalten = 0;
    await page.route(u => u.pathname.endsWith('/fieber/cache'), async route => {
      if (route.request().method() === 'POST') {
        gehalten++;
        await new Promise(weiter => setTimeout(weiter, 1500));
      }
      await route.continue();
    });
    const nachgetragen = page.waitForResponse(a => a.request().method() === 'POST' && a.url().endsWith('/fieber/cache'));
    await bericht(page, k, 'entwicklung', 'fieber');
    await fieberLesen(page, 'während der Nachtrag gehalten ist');
    // nach dem Nachtrag lädt die Seite den Cache neu und ersetzt #main — die Boxen stehen dann wieder zu (ADR-0007)
    const neuGeladen = page.waitForResponse(a => a.request().method() === 'GET' && a.url().endsWith('/fieber/cache'));
    await (await nachgetragen).finished();
    await (await neuGeladen).finished();
    await bereit(page, ANKER.fieber);
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
    await fieberLesen(page, 'nach dem Nachtrag');
    expect(gehalten, 'der Nachtrag lief über den Halter').toBeGreaterThan(0);
  });

  test('AK 12/13 Variante v2: Fever Chart, das in jedem Frame neu zeichnet — Sichttext vollständig, kein Querscrollen', async ({ page }) => {
    test.setTimeout(60000);
    k = await kanbanStarten(ausgangslage(R));
    await vorbereiten(page);
    await bericht(page, k, 'entwicklung', 'fieber');
    await page.evaluate(() => { const los = () => { render(); requestAnimationFrame(los); }; requestAnimationFrame(los); });
    await fieberLesen(page, 'bei Neuzeichnen in jedem Frame');
  });
});
