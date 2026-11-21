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
 *  `K` trägt zusätzlich `zuordnung` (AK 10) und `breit` (AK 13); `register` ersetzt die Registerzeilen (AK 11); ohne
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
    if (mitPhasen) {
      schreib('boards/zuordnung.md', boardText('Zuordnung', 'column-phases:\n  Bereit: Abnahme\n  Live: Abnahme\ncolumn-owner:\n  Offen: chef\napplications: [kd]\n', ZUORDNUNG, []));
      schreib('boards/breit.md', boardText('Breit', 'column-phases:\n  Entwicklung: Entwicklung\n  Code-Review: Reviews\n  Reviews: Reviews\napplications: [kd]\n', BREIT, breit));
    }
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

const bericht = (page, k, slug, route) => oeffnen(page, k, slug, `berichte/${route}`, '#main .dtitel');
const board = (page, k, slug) => oeffnen(page, k, slug, null);

/** Klappt Tabellenansicht und jede weitere zugeklappte Box des Hauptbereichs auf und wartet, bis sie offen stehen. */
async function allesAufklappen(page) {
  const zu = page.locator('#main details:not([open]) > summary');
  for (let i = await zu.count(); i > 0; i--) {
    await zu.first().click();
    await bereit(page);
  }
  await expect(page.locator('#main details:not([open])')).toHaveCount(0);
}

/** Sichtbarer Text des Hauptbereichs (bzw. des Aufgabenfensters) ohne den Bereich `#durchlaeufe`. */
const sichttext = (page, sel = '#main') => page.locator(sel).first().evaluate(e => {
  const kopie = e.cloneNode(true);
  kopie.querySelectorAll('#durchlaeufe').forEach(d => d.remove());
  document.body.append(kopie);
  const text = kopie.innerText;
  kopie.remove();
  return text;
});

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
async function querScrollen(page) {
  const treffer = [];
  for (const breite of BREITEN) {
    await breiteSetzen(page, breite);
    await bereit(page);
    const zuBreit = await page.evaluate(() => {
      const behaelter = [document.documentElement, ...document.querySelectorAll('#main, #main *, #fenster, #fenster *')].filter(e => {
        const s = getComputedStyle(e);
        return e === document.documentElement || /(auto|scroll)/.test(s.overflowX);
      });
      return behaelter.filter(e => e.scrollWidth > e.clientWidth + 1 && !e.closest('.bahnen')).map(e => `${e.tagName}.${e.className}#${e.id}`);
    });
    if (zuBreit.length) treffer.push(`${breite}: ${zuBreit.join(', ')}`);
  }
  await breiteSetzen(page, 1280);
  return treffer;
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
        await allesAufklappen(page);
        texte.push(await sichttext(page));
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
    expect(titel).toEqual([['Bindung KD', '„KD“ (kd)'], ['Bindung Abrechnung', '„Abrechnung“ (ab)'], ['Bindung keine', 'applications: []']]);
    for (const [, t] of titel) expect(t).not.toMatch(/Phasen|reines Kanban|Spalten bleiben/);
  });

  test('AK 12: Wie lange noch und Fever Chart ohne „durchlaufen“, Blöcke „ERREICHT“, Tabellenkopf und Methodik nach PO Z. 504', async ({ page }) => {
    k = await kanbanStarten(ausgangslage(R));
    await vorbereiten(page);
    for (const route of ['prognose', 'fieber']) {
      await bericht(page, k, 'entwicklung', route);
      await allesAufklappen(page);
      const text = await sichttext(page);
      for (const wort of ['durchlaufen', 'DURCHLAUFEN', 'Vorphase', 'bzw. ihre Phase', 'bzw. die letzte Phase']) expect(text, `${route}: ohne „${wort}“`).not.toContain(wort);
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
    pruefen('Board', await sichttext(page));
    await aufgabeDetails(page, k, 3);
    pruefen('Aufgabenfenster Details', await sichttext(page, '#fenster'));
    await page.keyboard.press('Escape');
    await spaltenEinrichten(page, k, 'entwicklung');
    pruefen('Spalten einrichten', await sichttext(page, 'body'));
    for (const route of ['prognose', 'fieber']) {
      await bericht(page, k, 'entwicklung', route);
      await allesAufklappen(page);
      pruefen(route, await sichttext(page));
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
    funde.push(...(await querScrollen(page)).map(x => `Aufgabe #3 ${x}`));
    for (const [slug, route] of [['entwicklung', 'prognose'], ['breit', 'prognose'], ['entwicklung', 'fieber']]) {
      await bericht(page, k, slug, route);
      await allesAufklappen(page);
      if (slug === 'breit') expect(await page.locator('#main section[data-spalte]').count(), 'breit: sechs Spaltenblöcke').toBe(6);
      funde.push(...(await querScrollen(page)).map(x => `${route} ${slug} ${x}`));
    }
    expect(funde).toEqual([]);
  });
});
