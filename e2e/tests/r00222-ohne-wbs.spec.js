// R00222 (I0212, Karte #224, Scheibe S2 von ADR-0034): kanbanD zeigt die WBS nicht mehr — AK 3, 4, 6 (Spalten-Dialog), 10, 11
// und 14 im echten Programm gegen ein echtes Arbeits-Repository. Schichten: Testfall (je AK) → Testsprache (`lage`, `menueTexte`,
// `farbenMessen`) → Treiber (Playwright, Selektoren nur hier). Die API-Seite (AK 1, 2, 5–9, 13) prüft tests/akzeptanz_r00222.rs.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen, thema, mehrOeffnen, reiter } = require('./hilfen');

const HINWEIS_ANWENDUNGEN = 'Je Anwendung ein Kürzel und der Pfad ihres Repositorys; ein Ordner darin genügt. Daraus liest kanbanD die Commits zu Verweisen wie kd:<hash>. Aufgaben nennen ihre Herkunft als kd:I0007; Boards binden mit applications: [kd].';
const FARBEN_DATEI = path.join(__dirname, 'r00222-farben.json');

// ---- Testsprache: Ausgangslage ------------------------------------------------------------------------------------------

/** Arbeits-Repository R: WBS `Dokumentation/Planung/kd.md`, `Anforderungen/`; C1 ändert `a.txt` (eine Zeile weg, eine dazu),
 *  legt `bidi.txt` mit U+202E an und löscht `weg.txt` — Diff-Zeichen, Bidi-Marke und alle drei Statuswörter. */
function arbeitsRepository() {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-r00222-')));
  const git = (...a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' }).trim();
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.mkdirSync(path.join(r, 'Anforderungen'));
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/kd.md'), '# WBS\n\n| ID | Ebene | Eltern | Name | Status |\n|---|---|---|---|---|\n| I0007 | Interaction | — | Liste | rot |\n');
  fs.writeFileSync(path.join(r, 'Anforderungen/R00001.md'), '# R00001\n');
  fs.writeFileSync(path.join(r, 'a.txt'), 'alt\nbleibt\n');
  fs.writeFileSync(path.join(r, 'weg.txt'), 'weg\n');
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=Ada', '-c', 'user.email=a@a', 'commit', '-q', '-m', 'C0 Anfang');
  fs.writeFileSync(path.join(r, 'a.txt'), 'neu\nbleibt\n');
  fs.writeFileSync(path.join(r, 'bidi.txt'), 'a‮b\n');
  fs.rmSync(path.join(r, 'weg.txt'));
  git('add', '-A');
  git('-c', 'user.name=Ada', '-c', 'user.email=a@a', 'commit', '-q', '-m', 'C1 Export');
  return { r, c1: git('rev-parse', 'HEAD'), wbs: `${r}/Dokumentation/Planung/kd.md`, anf: `${r}/Anforderungen` };
}

const register = zeile => `---\npeople:\n  sh: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n  applications:\n    ${zeile}\n---\n`;

/** Ausgangslage von R00222 (wie tests/akzeptanz_r00222.rs); `inArbeit` legt #3 nach „In Arbeit“ (für die WIP-Warnung). */
function lage(R, { registerZeile, inArbeit = false } = {}) {
  const board = `---\nlimits:\n  In Arbeit: 1\ncolumn-phases:\n  In Arbeit: Entwicklung\n  Review: Entwicklertest\n  Erledigt: Abnahme\ncolumn-checks:\n  Review: [wbs-effects-green]\napplications: [kd]\n---\n\n# Entwicklung\n\n## Offen\n\n- [#2](../aufgaben/0002-liste.md)\n\n## In Arbeit\n${inArbeit ? '\n- [#3](../aufgaben/0003-belegt.md)\n' : ''}\n## Review\n\n- [#1](../aufgaben/0001-export.md)\n\n## Erledigt\n`;
  return einrichten({
    'kanbanD.md': register(registerZeile || `kd: {name: KD, repository: ${R.r}, wbs: ${R.wbs}, requirements: ${R.anf}}`),
    'boards/entwicklung.md': board,
    'aufgaben/0001-export.md': `---\nid: 1\ntitle: Export\ncommits:\n  - kd:${R.c1}\nwbs-effects:\n  - {application: kd, action: create, node: I0048, parent: D0002, level: Interaction, name: Export, done-criterion: US-1}\n  - {application: kd, action: rework, node: D0002, executed: 2026-11-01}\n---\n`,
    'aufgaben/0002-liste.md': '---\nid: 2\ntitle: Liste\n---\n',
    'aufgaben/0003-belegt.md': '---\nid: 3\ntitle: Belegt\n---\n',
  });
}

/** Zählt die Anfragen der Seite an Pfade mit `/api/wbs` oder `wbs-effects`. */
function wbsAnfragen(page) {
  const liste = [];
  page.on('request', r => { if (/\/api\/wbs|wbs-effects/.test(r.url())) liste.push(r.url()); });
  return liste;
}

const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);

async function menueTexte(page, knopf, name) {
  await page.locator(knopf).click();
  const menue = page.locator(`#pop[aria-label="${name}"]`);
  await menue.waitFor();
  const texte = await menue.locator('[role^="menuitem"]').allTextContents();
  const aktuell = await menue.locator('[aria-current]').count();
  await page.keyboard.press('Escape');
  await expect(menue).toHaveCount(0);
  return { texte, aktuell };
}

/** Fenstertitel und Seitenname (Knopf „Seite“) samt Überschriften, wie sie nach dem Laden stehen. */
async function seitenKopf(page) {
  return { titel: await page.title(), kopf: await page.locator('.kz-z1').allTextContents(), h1: await page.locator('h1').allTextContents() };
}

// ---- Farben (AK 11) -----------------------------------------------------------------------------------------------------

/** Die gemessenen Eigenschaften eines Elements: Schrift, Fläche, Rahmen (oben und links, die Statuswörter tragen links). */
async function farbeVon(locator) {
  await locator.first().waitFor({ state: 'attached' });
  return locator.first().evaluate(e => { const s = getComputedStyle(e); return { color: s.color, background: s.backgroundColor, borderTop: s.borderTopColor, borderLeft: s.borderLeftColor }; });
}

/** `--kd-fehler-text` aufgelöst an einem Probe-Element. */
const fehlerText = page => page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--kd-fehler-text)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });

/** Misst je Thema die Farben auf Review-Seite (Diff-Zeichen, Bidi-Marke, Statuswörter, Meldungen „Fehler“ und „Warnung“),
 *  Commit-Liste von #1 (+/−) und Board (WIP-Warnung samt „!“). */
async function farbenMessen(page, k, R) {
  const ergebnis = {};
  for (const t of ['light', 'dark']) {
    const m = {};
    await page.goto(`${k.adresse}#/aufgaben/aufgabe/1/review?commit=${encodeURIComponent('kd:' + R.c1)}`);
    await thema(page, t);
    await expect(page.locator('#rv-pos')).toHaveText('1 von 1');
    await page.locator('.dz tr.add .m').first().waitFor();
    m.diffPlus = await farbeVon(page.locator('.dz tr.add .m'));
    m.diffMinus = await farbeVon(page.locator('.dz tr.del .m'));
    m.kopfPlus = await farbeVon(page.locator('.rv .pl'));
    m.kopfMinus = await farbeVon(page.locator('.rv .mi'));
    m.bidi = await farbeVon(page.locator('.mk-z'));
    for (const [n, s] of [['neu', '.st-neu'], ['entfernt', '.st-weg'], ['geaendert', '.st-mod']]) m[n] = await farbeVon(page.locator(s));
    m.fehlerText = await fehlerText(page);
    for (const [n, status, fehler, sel] of [['meldungFehler', 500, 'kaputt', '.rv-meld.fehl'], ['meldungWarnung', 503, 'Antwortbudget belegt', '.rv-meld.warn']]) {
      await page.route('**/api/aufgaben/1/diff?**', route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ fehler }) }));
      await page.goto(`${k.adresse}#/aufgaben/aufgabe/1/review?commit=${encodeURIComponent('kd:' + R.c1)}`);
      await page.reload();
      await thema(page, t);
      m[n] = await farbeVon(page.locator(sel));
      await page.unroute('**/api/aufgaben/1/diff?**');
    }
    await page.goto(`${k.adresse}#/aufgaben/aufgabe/1`);
    await thema(page, t);
    await reiter(page, 'Commits');
    m.listePlus = await farbeVon(page.locator('#fenster .cl-pl'));
    m.listeMinus = await farbeVon(page.locator('#fenster .cl-mi'));
    await page.goto(`${k.adresse}#/board/entwicklung`);
    await thema(page, t);
    await bereit(page, karte(page, 2));
    await karte(page, 2).dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('#pruef-warnung')).toContainText('Grenze erreicht');
    m.wipWarnung = await farbeVon(page.locator('#pruef-warnung'));
    m.wipAusruf = await farbeVon(page.locator('#pruef-warnung .ausruf'));
    execFileSync('git', ['-C', k.ordner, 'reset', '-q', '--hard', 'HEAD~1']);
    ergebnis[t] = m;
  }
  return ergebnis;
}

// ---- Testfälle ----------------------------------------------------------------------------------------------------------

test.describe('R00222 ohne WBS', () => {
  let k, R;
  test.beforeEach(() => { R = arbeitsRepository(); });
  test.afterEach(async () => { if (k) await k.stoppen(); k = null; fs.rmSync(R.r, { recursive: true, force: true }); });

  test('AK 3: kein Menüeintrag, keine Kürzelzeile, g k tut nichts, #/wbs/kd zeigt das Board mit dessen Titel', async ({ page }) => {
    k = await kanbanStarten(lage(R));
    await alsPerson(page, 'sh');
    const anfragen = wbsAnfragen(page);
    await page.goto(`${k.adresse}#/board/entwicklung`);
    await bereit(page, karte(page, 1));
    const board = await seitenKopf(page);
    const mehr = await menueTexte(page, '#t-mehr', 'Mehr');
    // „Seite“ steht nur auf schmalen Breiten in der Kopfzeile (R00140); dort wird es mitgeprüft
    await breiteSetzen(page, 600);
    const seite = await page.locator('#t-seite').count() ? await menueTexte(page, '#t-seite', 'Seite') : { texte: [] };
    await breiteSetzen(page, 1280);
    for (const text of [...mehr.texte, ...seite.texte]) expect(text, 'kein Eintrag nennt die WBS').not.toMatch(/WBS/);
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe).toBeVisible();
    await expect(hilfe.locator('td', { hasText: /^g k$/ })).toHaveCount(0);
    await expect(hilfe).not.toContainText('WBS');
    await page.keyboard.press('Escape');
    await expect(hilfe).toHaveCount(0);
    const vorher = page.url();
    await page.keyboard.press('g');
    await page.keyboard.press('k');
    await page.keyboard.press('g');
    await page.keyboard.press('a');
    await expect(page).toHaveURL(/#\/aufgaben$/);
    await page.goBack();
    await expect(page).toHaveURL(vorher);
    await page.goto(`${k.adresse}#/wbs/kd`);
    await page.reload();
    await bereit(page, karte(page, 1));
    const alt = await seitenKopf(page);
    expect(alt).toEqual(board);
    expect(alt.titel).not.toMatch(/WBS|\d+ %/);
    const mehrAlt = await menueTexte(page, '#t-mehr', 'Mehr');
    expect(mehrAlt.aktuell, 'kein Eintrag des Menüs ist aktuell').toBe(0);
    expect(anfragen, 'keine Anfrage an /api/wbs').toEqual([]);
  });

  test('AK 4: Fenster von #1 ohne Wirkungen, Karte ohne Wirkungspunkt, keine Anfrage an wbs-effects', async ({ page }) => {
    k = await kanbanStarten(lage(R));
    await alsPerson(page, 'sh');
    const anfragen = wbsAnfragen(page);
    await page.goto(`${k.adresse}#/board/entwicklung`);
    await bereit(page, karte(page, 1));
    await expect(karte(page, 1).locator('.wpunkt')).toHaveCount(0);
    await karte(page, 1).click();
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
    await expect(fenster).toBeVisible();
    await reiter(page, 'Details');
    // die Details stehen, sobald die Zeile „Herkunft“ gezeichnet ist — davor lag die Zeile „Wirkungen“ (R00057)
    await expect(fenster.locator('.felder-details .k', { hasText: 'Herkunft' })).toBeVisible();
    await expect(fenster.getByText('Wirkungen', { exact: true })).toHaveCount(0);
    await expect(fenster.getByRole('button', { name: /Wirkung/ })).toHaveCount(0);
    await expect(fenster.locator('.ampel, .wirkung, [data-act^="wirkung"]')).toHaveCount(0);
    expect(anfragen).toEqual([]);
  });

  test('AK 6: „Spalten einrichten“ zeigt keinen Prüfschalter', async ({ page }) => {
    k = await kanbanStarten(lage(R));
    await alsPerson(page, 'sh');
    await page.goto(`${k.adresse}#/board/entwicklung`);
    await bereit(page, karte(page, 1));
    await mehrOeffnen(page);
    await page.locator('#mehr-spalten').click();
    await expect(page.locator('#setup-vorschau')).toBeVisible();
    await expect(page.locator('[data-act="col-pruef"]')).toHaveCount(0);
    await expect(page.getByText(/prüft: WBS|wbs-effects-green/)).toHaveCount(0);
    await expect(page.locator('#setup-vorschau')).not.toContainText('column-checks');
  });

  test('AK 10: Einrichten zeigt je Anwendung nur Repository; Altform mit Startordner, erreichbar; Speichern schreibt repository', async ({ page }) => {
    const planung = `${R.r}/Dokumentation/Planung`;
    k = await kanbanStarten(lage(R, { registerZeile: `kd: {name: KD, wbs: ${R.wbs}}` }));
    await alsPerson(page, 'sh');
    await page.goto(`${k.adresse}#/einrichten`);
    const feld = page.getByLabel('Repository kd');
    await expect(feld).toHaveValue(planung);
    const zeile = page.locator('.anw[data-anwendung="kd"]');
    await expect(zeile.locator('.felder .erreich').first()).toHaveText('erreichbar');
    await expect(page.getByLabel(/WBS/)).toHaveCount(0);
    await expect(page.getByLabel(/Anforderung/)).toHaveCount(0);
    await expect(page.getByText('Die Factory erkennt die Anwendung an diesem Pfad', { exact: false })).toHaveCount(0);
    await expect(page.locator('.einr-kopf:has-text("ANWENDUNGEN") + .hin')).toHaveText(HINWEIS_ANWENDUNGEN);
    const vorschau = page.locator('#einr-vorschau');
    await expect(vorschau).toContainText(`kd: {name: KD, repository: ${planung}}`);
    await expect(vorschau).not.toContainText('wbs');
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    const text = await vorschau.textContent();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('gespeichert', { exact: true })).toBeVisible();
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(vorher + 1);
    expect(k.lies('kanbanD.md')).toBe(text);
    expect(k.lies('kanbanD.md')).not.toMatch(/wbs|requirements/);
    for (const breite of [375, 641, 768, 980]) {
      await breiteSetzen(page, breite);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `kein Querscrollen bei ${breite} px`).toBe(true);
    }
  });

  test('AK 14: Erster Start fragt nur Ich, Agenten, Board, Spalten; Vorschau und Datei ohne wbs, requirements und leeres sources', async ({ page }) => {
    k = await kanbanStarten(ordner => { fs.mkdirSync(ordner, { recursive: true }); execFileSync('git', ['-C', ordner, 'init', '-q']); });
    await page.goto(k.adresse);
    const maske = page.locator('.first-l');
    await expect(maske.getByLabel('Kürzel')).toBeVisible();
    expect(await maske.locator('.felder .kb .k').allTextContents()).toEqual(['Ich', 'Agenten', 'Board', 'Spalten']);
    expect(await maske.locator('input').evaluateAll(f => f.map(e => e.getAttribute('aria-label')))).toEqual(['Kürzel', 'Name', 'Board', 'Spalten']);
    expect(await maske.locator('[data-act="fr-agent"]').allTextContents()).toEqual(['CLClaude', 'CXCodex']);
    await expect(page.getByLabel(/^(WBS|Anforderungen)$/)).toHaveCount(0);
    await expect(maske.getByText(/^(WBS|Anforderungen)$/)).toHaveCount(0);
    await maske.getByLabel('Kürzel').fill('sh');
    await maske.getByLabel('Name').fill('Stefan');
    await maske.getByLabel('Spalten').fill('Offen, In Arbeit, Erledigt');
    const vorschau = page.locator('#vorschau-einstellungen');
    await expect(vorschau).toContainText('sh: {name: Stefan, kind: human}');
    const text = await vorschau.textContent();
    expect(text).not.toMatch(/wbs|requirements|sources:\s*(\n---|\n?$)/);
    await page.getByRole('button', { name: 'Einrichten und committen' }).click();
    await expect(page.locator('.bahn-kopf')).toHaveCount(3);
    const datei = k.lies('kanbanD.md');
    expect(datei).not.toMatch(/wbs|requirements/);
    expect(datei).not.toMatch(/sources:\s*\n---/);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe('1');
    expect(k.git('show', '--name-only', '--format=', 'HEAD').split('\n').sort()).toEqual(['boards/entwicklung.md', 'kanbanD.md']);
  });

  test('AK 11: Diff-Zeichen, Bidi-Marke, Statuswörter, Meldungen und WIP-Warnung in Hell und Dunkel wie vor der Karte; kein --kd-wbs-', async ({ page }) => {
    test.setTimeout(90000);
    k = await kanbanStarten(lage(R, { inArbeit: true }));
    await alsPerson(page, 'sh');
    const gemessen = await farbenMessen(page, k, R);
    if (process.env.R00222_MESSEN) fs.writeFileSync(FARBEN_DATEI, JSON.stringify(gemessen, null, 2) + '\n');
    expect(gemessen).toEqual(JSON.parse(fs.readFileSync(FARBEN_DATEI, 'utf8')));
    const namen = ordner => execFileSync('grep', ['-rlE', '--include=*.css', '--include=*.js', '--', '--kd-wbs-', ordner], { encoding: 'utf8' }).trim();
    for (const ordner of [path.resolve(__dirname, '../../web'), path.resolve(__dirname, '..')]) {
      let treffer = '';
      try { treffer = namen(ordner).split('\n').filter(d => !d.includes('node_modules') && !d.endsWith('r00222-ohne-wbs.spec.js')).join('\n'); } catch (_) { treffer = ''; }
      expect(treffer, `kein Name beginnt mit --kd-wbs- in ${ordner}`).toBe('');
    }
  });
});
