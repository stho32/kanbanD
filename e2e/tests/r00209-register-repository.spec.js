// R00209 (I0199, Karte #225): Register führt das Repository der Anwendung — AK 9 bis 12 und die NFA über die Einstellungsseite.
// Schichten: Testfall (je AK) → Testsprache (`Lage`, `zeileVon`, `speichern`, `vorschauGleichDatei`) → Treiber (Playwright).
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen, thema, kontrastAm, commitSteht } = require('./hilfen');

const HINWEIS_ANWENDUNGEN = 'Je Anwendung ein Kürzel und der Pfad ihres Repositorys; ein Ordner darin genügt. Daraus liest kanbanD die Commits zu Verweisen wie kd:<hash>. Aufgaben nennen ihre Herkunft als kd:I0007; Boards binden mit applications: [kd].';

// ---- Testsprache --------------------------------------------------------------------------------------------------------

/** Arbeits-Repository R mit Documentation/Planning/app.md und Requirements/, ein Commit auf main. */
function arbeitsRepository() {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-r00209-')));
  fs.mkdirSync(path.join(r, 'Documentation/Planning'), { recursive: true });
  fs.mkdirSync(path.join(r, 'Requirements'));
  fs.writeFileSync(path.join(r, 'Documentation/Planning/app.md'), '# WBS\n');
  fs.writeFileSync(path.join(r, 'Requirements/R00001.md'), '# R00001\n');
  const git = (...a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('add', '-A');
  git('-c', 'user.name=Ada', '-c', 'user.email=a@a', 'commit', '-q', '-m', 'Erster Stand');
  return r;
}

const register = (quellen, zeilen) => `---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsources:\n${quellen}${zeilen.length ? `  applications:\n${zeilen.map(z => `    ${z}\n`).join('')}` : ''}---\n`;

const zeileVon = (page, kuerzel) => page.locator(`.anw[data-anwendung="${kuerzel}"]`);
const zustandVon = (page, kuerzel) => zeileVon(page, kuerzel).locator('.felder .erreich').first();

async function speichern(page) {
  await page.getByRole('button', { name: 'Speichern' }).click();
}

/** AK 11: der Text der Vorschau vor dem Speichern ist nach dem Speichern genau kanbanD.md. */
async function speichernUndVorschauPruefen(page, k) {
  const vorschau = await page.locator('#einr-vorschau').textContent();
  const vorher = +k.git('rev-list', '--count', 'HEAD');
  await speichern(page);
  await expect(page.getByText('gespeichert', { exact: true })).toBeVisible();
  await commitSteht(k, vorher + 1);
  expect(k.lies('kanbanD.md')).toBe(vorschau);
  expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher + 1);
}

/** R00215: verzögert jede GET-Anfrage der Seite an die API (außer dem Ereignisstrom) um `verzoegerung(ms)` und zählt, wie
 *  viele noch offen sind — `ruhig()` wartet, bis keine mehr offen ist und der geladene Stand gezeichnet ist. */
async function langsameApi(page) {
  let offen = 0, ms = 0;
  const betrifft = req => req.url().includes('/api/') && !req.url().includes('/api/ereignisse') && req.method() === 'GET';
  page.on('request', req => { if (betrifft(req)) offen++; });
  for (const ende of ['requestfinished', 'requestfailed']) page.on(ende, req => { if (betrifft(req)) offen--; });
  await page.route('**/api/**', async route => {
    if (betrifft(route.request())) await new Promise(ok => setTimeout(ok, ms));
    await route.continue();
  });
  return {
    verzoegerung: neu => { ms = neu; },
    offen: () => offen,
    ruhig: () => expect.poll(async () => offen === 0 && await page.evaluate(() => window.kdTest.gezeichnet()), { message: 'die Seite lädt nicht mehr', timeout: 15000 }).toBe(true),
  };
}

const zeileInDatei = (k, kuerzel) => k.lies('kanbanD.md').split('\n').find(z => z.trim().startsWith(`${kuerzel}: `)) || '';

// ---- Testfälle ----------------------------------------------------------------------------------------------------------

test.describe('R00209 Einrichten mit Repository', () => {
  let k, r;
  test.beforeEach(() => { r = arbeitsRepository(); });
  test.afterEach(async () => { if (k) await k.stoppen(); fs.rmSync(r, { recursive: true, force: true }); });

  // R00222 (ADR-0034 N2 Regel 4) beendet die Übergangsform: nur noch das Feld „Repository“, geschrieben wird nur `repository`
  test('AK 9: Altbestand zeigt das Repository als Startordner, erreichbar; nur das Feld Repository; speichern mit und ohne Änderung (R00222)', async ({ page }) => {
    const wbs = `${r}/Documentation/Planning/app.md`, anf = `${r}/Requirements`, planung = `${r}/Documentation/Planning`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', [`jopu: {name: JoinPuya, wbs: ${wbs}, requirements: ${anf}}`]) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    const zeile = zeileVon(page, 'jopu');
    const repository = page.getByLabel('Repository jopu', { exact: true });
    await expect(repository).toHaveValue(planung);
    await expect(zustandVon(page, 'jopu')).toHaveText('erreichbar');
    expect(await zeile.locator('.felder input').evaluateAll(f => f.map(e => e.dataset.ef))).toEqual(['arepo']);
    expect(await zeile.locator('.felder .kb .k').allTextContents()).toEqual(['Repository']);
    await expect(repository).toHaveAccessibleDescription('erreichbar');
    await expect(zeile.locator('.feld-hinweis')).toHaveCount(0);

    // speichern ohne Änderung: die Altform wird auf repository umgestellt, wbs/requirements fallen weg
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${planung}}`);

    // Repository ändern: bis zum Speichern „noch nicht geprüft“, danach erreichbar
    await repository.fill(r);
    await expect(zustandVon(page, 'jopu')).toHaveText('noch nicht geprüft');
    await expect(repository).toHaveAccessibleDescription('noch nicht geprüft');
    await expect(page.locator('#einr-vorschau')).toContainText(`jopu: {name: JoinPuya, repository: ${r}}`);
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${r}}`);
    await expect(zustandVon(page, 'jopu')).toHaveText('erreichbar');

    // ein Ordner, den es nicht gibt, und ein leeres Feld: speichern geht ohne Meldung
    await page.getByLabel('Repository jopu', { exact: true }).fill(`${r}/gibt-es-nicht`);
    await speichernUndVorschauPruefen(page, k);
    await expect(zustandVon(page, 'jopu')).toHaveText('nicht erreichbar');
    await expect(page.locator('#einr-fehler')).toHaveCount(0);
    await page.getByLabel('Repository jopu', { exact: true }).fill('');
    await expect(zustandVon(page, 'jopu')).toHaveText('kein Repository');
    await page.getByLabel('Repository jopu', { exact: true }).fill('relativ/ordner');
    await speichernUndVorschauPruefen(page, k);
    await expect(page.locator('#einr-fehler')).toHaveCount(0);
    expect(zeileInDatei(k, 'jopu').trim()).toBe('jopu: {name: JoinPuya, repository: relativ/ordner}');
  });

  test('AK 10: Hinweistext, neue Anwendung nur mit Repository, Quellen mit Zustandswort, Fokus nach dem Entfernen', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', []) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    await expect(page.locator('.einr-kopf:has-text("ANWENDUNGEN") + .hin')).toHaveText(HINWEIS_ANWENDUNGEN);
    await expect(page.getByLabel('Repository', { exact: true })).toBeVisible();
    await expect(page.locator('#quellen-repo')).toHaveText('kein Repository');
    await page.getByLabel('Neues Anwendungskürzel').fill('lc');
    await page.getByLabel('Neuer Anwendungsname').fill('Lokal');
    await page.keyboard.press('Enter');
    const lc = page.getByLabel('Repository lc', { exact: true });
    await expect(lc).toBeFocused();
    await expect(lc).toHaveAttribute('placeholder', '/voller/pfad/zum/Repository');
    await expect(zustandVon(page, 'lc')).toHaveText('kein Repository');
    await page.keyboard.type(r);
    await expect(zustandVon(page, 'lc')).toHaveText('noch nicht geprüft');
    await page.getByLabel('Repository', { exact: true }).fill(r);
    await expect(page.locator('#quellen-repo')).toHaveText('noch nicht geprüft');
    await speichernUndVorschauPruefen(page, k);
    const datei = k.lies('kanbanD.md');
    expect(datei).toContain(`sources:\n  repository: ${r}\n  applications:\n    lc: {name: Lokal, repository: ${r}}\n---`);
    await expect(page.locator('#quellen-repo')).toHaveText('erreichbar');
    await expect(zustandVon(page, 'lc')).toHaveText('erreichbar');

    await page.getByLabel('Repository', { exact: true }).fill(`${r}/gibt-es-nicht`);
    await speichernUndVorschauPruefen(page, k);
    await expect(page.locator('#quellen-repo')).toHaveText('nicht erreichbar');

    // Entfernen: Fokus auf die Nachbarzeile, ohne Zeile auf „Neues Anwendungskürzel“
    await page.getByLabel('Neues Anwendungskürzel').fill('ma');
    await page.getByLabel('Neuer Anwendungsname').fill('Mail');
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: 'Anwendung lc entfernen' }).click();
    await expect(page.getByRole('button', { name: 'Anwendung ma entfernen' })).toBeFocused();
    await page.getByRole('button', { name: 'Anwendung ma entfernen' }).click();
    await expect(page.getByLabel('Neues Anwendungskürzel')).toBeFocused();
  });

  test('AK 11: die Vorschau zeigt vor dem Speichern genau die Zeilen der Datei — Repository ändern, leeren (R00222: ohne wbs)', async ({ page }) => {
    const wbs = `${r}/Documentation/Planning/app.md`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register(`  repository: ${r}\n`, [`kd: {name: kanbanD, repository: ${r}, wbs: ${wbs}}`]) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    await page.getByLabel('Repository kd', { exact: true }).fill(`  ${r}/Documentation  `);
    await expect(page.locator('#einr-vorschau')).toContainText(`kd: {name: kanbanD, repository: ${r}/Documentation}`);
    await expect(page.locator('#einr-vorschau')).not.toContainText('wbs');
    await speichernUndVorschauPruefen(page, k);
    await page.getByLabel('Repository kd', { exact: true }).fill('');
    await expect(page.locator('#einr-vorschau')).toContainText('kd: {name: kanbanD, repository: ""}');
    await speichernUndVorschauPruefen(page, k);
  });

  // R00215 AK 8 (PO-Vorschlag): eine Eingabe, die der Betreiber macht, während die Seite nach dem Speichern nachlädt, bleibt stehen
  test('R00215 AK 8: Eingabe nach „gespeichert“ bleibt stehen, auch wenn das Nachladen 600 ms braucht', async ({ page }) => {
    const anf = `${r}/Requirements`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', [`jopu: {name: JoinPuya, requirements: ${anf}}`]) }));
    const api = await langsameApi(page);
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    const repository = page.getByLabel('Repository jopu', { exact: true });
    await repository.fill(`${r}/Requirements`);
    await speichernUndVorschauPruefen(page, k);
    await api.ruhig();
    api.verzoegerung(600);
    // zweites Speichern; sobald die Seite den neuen Stand zeigt (erreichbar, gespeichert), tippt der Betreiber weiter
    await repository.fill(r);
    await speichern(page);
    await expect(zustandVon(page, 'jopu')).toHaveText('erreichbar');
    await expect(page.getByText('gespeichert', { exact: true })).toBeVisible();
    await repository.fill(`${r}/neu`);
    await api.ruhig();
    await expect(repository).toHaveValue(`${r}/neu`);
    await expect(zustandVon(page, 'jopu')).toHaveText('noch nicht geprüft');
    await expect(page.locator('#einr-vorschau')).toContainText(`jopu: {name: JoinPuya, repository: ${r}/neu}`);
    await expect(page.getByText('gespeichert', { exact: true })).toHaveCount(0);
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${r}/neu}`);
  });

  test('R00215 AK 8: Eingabe, während das Speichern noch nachlädt, bleibt stehen und ist nicht „gespeichert“', async ({ page }) => {
    const anf = `${r}/Requirements`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', [`jopu: {name: JoinPuya, requirements: ${anf}}`]) }));
    const api = await langsameApi(page);
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    await bereit(page, zeileVon(page, 'jopu'));
    api.verzoegerung(600);
    const repository = page.getByLabel('Repository jopu', { exact: true });
    await repository.fill(r);
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await speichern(page);
    await commitSteht(k, vorher + 1);
    // Vorbedingung: das Nachladen nach dem Speichern läuft noch — sonst prüft der Test das Fenster nicht (Code-Review A3)
    expect(api.offen()).toBeGreaterThan(0);
    await repository.fill(`${r}/neu`);
    await api.ruhig();
    await expect(repository).toHaveValue(`${r}/neu`);
    await expect(page.locator('#einr-vorschau')).toContainText(`jopu: {name: JoinPuya, repository: ${r}/neu}`);
    await expect(page.getByText('gespeichert', { exact: true })).toHaveCount(0);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${r}}`);
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${r}/neu}`);
  });

  // R00215 AK 11 (Entwicklertest #231 Muss S1): wer speichert und gleich die Ansicht wechselt, sieht keine technische Meldung
  for (const ms of [100, 300, 600]) {
    test(`R00215 AK 11: Ansicht wechseln 100 ms nach dem Speichern, Nachladen ${ms} ms — keine technische Meldung, genau ein Commit`, async ({ page }) => {
      const anf = `${r}/Requirements`;
      k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', [`jopu: {name: JoinPuya, requirements: ${anf}}`]) }));
      const meldungen = [];
      page.on('pageerror', e => meldungen.push(`pageerror: ${e.message}`));
      page.on('console', m => { if (['error', 'warning'].includes(m.type())) meldungen.push(`${m.type()}: ${m.text()}`); });
      const api = await langsameApi(page);
      await alsPerson(page, 'st');
      await page.goto(k.adresse + '#/einrichten');
      await bereit(page, zeileVon(page, 'jopu'));
      api.verzoegerung(ms);
      await page.getByLabel('Repository jopu', { exact: true }).fill(r);
      const vorher = +k.git('rev-list', '--count', 'HEAD');
      await speichern(page);
      await page.waitForTimeout(100);
      await page.evaluate(() => { location.hash = '#/board/entwicklung'; });
      await page.waitForTimeout(3000);
      await api.ruhig();
      await expect(page.locator('#stat')).not.toContainText('Cannot');
      await expect(page.locator('#stat .fehl')).toHaveCount(0);
      expect(meldungen).toEqual([]);
      await commitSteht(k, vorher + 1);
      expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${r}}`);
      expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher + 1);
    });
  }

  test('R00215 AK 11: scheitert das Speichern erst nach dem Ansichtswechsel, steht die Meldung der Anfrage in der Fußzeile, nichts gespeichert', async ({ page }) => {
    const anf = `${r}/Requirements`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', [`jopu: {name: JoinPuya, requirements: ${anf}}`]) }));
    await alsPerson(page, 'st');
    await page.route('**/api/einstellungen', async route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      await new Promise(ok => setTimeout(ok, 600));
      return route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"Git oder Dateisystem: Probe"}' });
    });
    await page.goto(k.adresse + '#/einrichten');
    await bereit(page, zeileVon(page, 'jopu'));
    await page.getByLabel('Repository jopu', { exact: true }).fill(r);
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await speichern(page);
    await page.waitForTimeout(100);
    await page.evaluate(() => { location.hash = '#/board/entwicklung'; });
    await expect(page.locator('#stat .fehl')).toHaveText('Git oder Dateisystem: Probe');
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, requirements: ${anf}}`);
  });

  test('AK 12: scheitert das Speichern (400 doppeltes Kürzel, 500), bleibt der Entwurf, die Meldung steht über den Knöpfen und hat den Fokus', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', []) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    const datei = k.lies('kanbanD.md');
    for (const name of ['Eins', 'Zwei']) {
      await page.getByLabel('Neues Anwendungskürzel').fill('kd');
      await page.getByLabel('Neuer Anwendungsname').fill(name);
      await page.keyboard.press('Enter');
    }
    await page.locator('[data-ef="arepo"][data-i="1"]').fill(r);
    await speichern(page);
    const meldung = page.getByRole('alert');
    await expect(meldung).toContainText('doppelt');
    await expect(meldung).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(await meldung.evaluate(m => m.nextElementSibling.classList.contains('zeile-knoepfe'))).toBe(true);
    await expect(page.locator('[data-ef="arepo"][data-i="1"]')).toHaveValue(r);
    await expect(page.locator('.anw')).toHaveCount(2);
    expect(k.lies('kanbanD.md')).toBe(datei);

    await page.getByRole('button', { name: 'Anwendung kd entfernen' }).first().click();
    await page.route('**/api/einstellungen', route => (route.request().method() === 'PUT' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"Git oder Dateisystem: Probe"}' }) : route.fallback()));
    await speichern(page);
    await expect(page.getByRole('alert')).toContainText('Probe');
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.locator('[data-ef="arepo"][data-i="0"]')).toHaveValue(r);
    expect(k.lies('kanbanD.md')).toBe(datei);
  });

  test('UX S1: „kein Repository“ trägt keine fremde Polsterung — Padding 0, die Zeile so hoch wie mit gefülltem Feld', async ({ page }) => {
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register(`  repository: ${r}\n`, [`kd: {name: kanbanD, repository: ${r}}`, 'ma: {name: Mail}']) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    const leer = zustandVon(page, 'ma'), voll = zustandVon(page, 'kd');
    await expect(leer).toHaveText('kein Repository');
    await expect(voll).toHaveText('erreichbar');
    expect(await leer.evaluate(e => getComputedStyle(e).padding)).toBe('0px');
    const hoehe = async kuerzel => zeileVon(page, kuerzel).locator('.felder .w').first().evaluate(e => e.getBoundingClientRect().height);
    expect(await hoehe('ma')).toBe(await hoehe('kd'));
  });

  for (const farbe of ['hell', 'dunkel']) {
    for (const breite of [375, 641, 768, 980]) {
      test(`NFA: ${breite} px ${farbe} — kein Querscrollen in Quellen und Anwendungen, Zustandswörter ab 4,5:1 auch im Hover, 120 Zeichen lesbar`, async ({ page }) => {
        const lang = `${r}/${'x'.repeat(Math.max(1, 120 - r.length - 1))}`;
        k = await kanbanStarten(einrichten({ 'kanbanD.md': register(`  repository: ${r}\n`, [`kd: {name: kanbanD, repository: ${r}, wbs: ${r}/Documentation/Planning/app.md}`, `lc: {name: Lokal, repository: ${lang}}`, 'ma: {name: Mail}']) }));
        await alsPerson(page, 'st');
        await page.goto(k.adresse + '#/einrichten');
        await thema(page, farbe === 'hell' ? 'light' : 'dark');
        await breiteSetzen(page, breite);
        await page.getByLabel('Repository kd', { exact: true }).fill(`${r}/neu`);
        await expect(zustandVon(page, 'kd')).toHaveText('noch nicht geprüft');
        const quer = await page.evaluate(() => [document.scrollingElement, ...document.querySelectorAll('.einr.breit, .anw, .anw .felder, .einr.breit > .felder')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.className || e.tagName));
        expect(quer).toEqual([]);
        await expect(page.getByLabel('Repository lc', { exact: true })).toHaveAttribute('title', lang);
        const woerter = page.locator('.einrichten .erreich');
        expect(await woerter.allTextContents()).toEqual(expect.arrayContaining(['erreichbar', 'nicht erreichbar', 'kein Repository', 'noch nicht geprüft']));
        for (let i = 0; i < await woerter.count(); i++) {
          const wort = woerter.nth(i);
          expect(await wort.evaluate(e => e.closest('.vh') === null && getComputedStyle(e).display !== 'none')).toBe(true);
          expect(await kontrastAm(wort), `${await wort.textContent()} ${farbe}`).toBeGreaterThanOrEqual(4.5);
          await wort.hover();
          expect(await kontrastAm(wort), `${await wort.textContent()} ${farbe} Hover`).toBeGreaterThanOrEqual(4.5);
        }
        const ziele = await page.locator('.einrichten .anw input, .einrichten .anw button').evaluateAll(e => e.map(x => x.getBoundingClientRect().height));
        expect(Math.min(...ziele)).toBeGreaterThanOrEqual(24);
      });
    }
  }
});
