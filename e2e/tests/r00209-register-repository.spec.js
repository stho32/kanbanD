// R00209 (I0199, Karte #225): Register führt das Repository der Anwendung — AK 9 bis 12 und die NFA über die Einstellungsseite.
// Schichten: Testfall (je AK) → Testsprache (`Lage`, `zeileVon`, `speichern`, `vorschauGleichDatei`) → Treiber (Playwright).
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, breiteSetzen, thema, kontrastAm, commitSteht } = require('./hilfen');

const HINWEIS_WBS = 'Die Factory erkennt die Anwendung an diesem Pfad. Leeren erst, wenn die Factory umgestellt ist.';
const HINWEIS_ANWENDUNGEN = 'Je Anwendung ein Kürzel und der Pfad ihres Repositorys; ein Ordner darin genügt. Daraus liest kanbanD die Commits zu Verweisen wie kd:<hash>. WBS und Anforderungen braucht nur noch die Factory; die Felder entfallen, sobald sie umgestellt ist. Aufgaben nennen ihre Herkunft als kd:I0007; Boards binden mit applications: [kd].';

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

const zeileInDatei = (k, kuerzel) => k.lies('kanbanD.md').split('\n').find(z => z.trim().startsWith(`${kuerzel}: `)) || '';

// ---- Testfälle ----------------------------------------------------------------------------------------------------------

test.describe('R00209 Einrichten mit Repository', () => {
  let k, r;
  test.beforeEach(() => { r = arbeitsRepository(); });
  test.afterEach(async () => { if (k) await k.stoppen(); fs.rmSync(r, { recursive: true, force: true }); });

  test('AK 9: Altbestand zeigt das Repository als Startordner, erreichbar; Reihenfolge, Name und Hinweis am WBS-Feld; speichern mit und ohne Änderung', async ({ page }) => {
    const wbs = `${r}/Documentation/Planning/app.md`, anf = `${r}/Requirements`, planung = `${r}/Documentation/Planning`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register('  wbs: ""\n  requirements: ""\n', [`jopu: {name: JoinPuya, wbs: ${wbs}, requirements: ${anf}}`]) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    const zeile = zeileVon(page, 'jopu');
    const repository = page.getByLabel('Repository jopu', { exact: true });
    await expect(repository).toHaveValue(planung);
    await expect(zustandVon(page, 'jopu')).toHaveText('erreichbar');
    expect(await zeile.locator('.felder input').evaluateAll(f => f.map(e => e.dataset.ef))).toEqual(['arepo', 'awbs', 'aanf']);
    expect(await zeile.locator('.felder .kb .k').allTextContents()).toEqual(['Repository', 'WBS', 'Anforderungen']);
    await expect(repository).toHaveAccessibleDescription('erreichbar');
    const hinweis = zeile.locator('.feld-hinweis');
    await expect(hinweis).toBeVisible();
    await expect(hinweis).toHaveText(HINWEIS_WBS);
    await expect(page.getByLabel('WBS-Pfad jopu')).toHaveAccessibleDescription(HINWEIS_WBS);
    await expect(hinweis).not.toHaveAttribute('role', /alert|status/);

    // speichern ohne Änderung: repository kommt dazu, wbs/requirements bleiben (die Seite sendet sie mit)
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${planung}, wbs: ${wbs}, requirements: ${anf}}`);

    // Repository ändern: bis zum Speichern „noch nicht geprüft“, danach erreichbar
    await repository.fill(r);
    await expect(zustandVon(page, 'jopu')).toHaveText('noch nicht geprüft');
    await expect(repository).toHaveAccessibleDescription('noch nicht geprüft');
    await expect(page.locator('#einr-vorschau')).toContainText(`jopu: {name: JoinPuya, repository: ${r}, wbs: ${wbs}, requirements: ${anf}}`);
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: ${r}, wbs: ${wbs}, requirements: ${anf}}`);
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

    // WBS leeren: der Hinweis fällt weg, die Vorschau zeigt kein wbs mehr
    await page.getByLabel('WBS-Pfad jopu').fill('');
    await expect(zeile.locator('.feld-hinweis')).toBeHidden();
    await expect(page.getByLabel('WBS-Pfad jopu')).not.toHaveAttribute('aria-describedby', /./);
    await speichernUndVorschauPruefen(page, k);
    expect(zeileInDatei(k, 'jopu').trim()).toBe(`jopu: {name: JoinPuya, repository: relativ/ordner, requirements: ${anf}}`);
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
    await expect(zeileVon(page, 'lc').locator('.feld-hinweis')).toBeHidden();
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

  test('AK 11: die Vorschau zeigt vor dem Speichern genau die Zeilen der Datei — Repository ändern, WBS leeren', async ({ page }) => {
    const wbs = `${r}/Documentation/Planning/app.md`;
    k = await kanbanStarten(einrichten({ 'kanbanD.md': register(`  repository: ${r}\n`, [`kd: {name: kanbanD, repository: ${r}, wbs: ${wbs}}`]) }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/einrichten');
    await page.getByLabel('Repository kd', { exact: true }).fill(`  ${r}/Documentation  `);
    await expect(page.locator('#einr-vorschau')).toContainText(`kd: {name: kanbanD, repository: ${r}/Documentation, wbs: ${wbs}}`);
    await speichernUndVorschauPruefen(page, k);
    await page.getByLabel('WBS-Pfad kd').fill('');
    await page.getByLabel('Repository kd', { exact: true }).fill('');
    await expect(page.locator('#einr-vorschau')).toContainText('kd: {name: kanbanD, repository: ""}');
    await speichernUndVorschauPruefen(page, k);
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
        const hinweis = zeileVon(page, 'kd').locator('.feld-hinweis');
        expect(await kontrastAm(hinweis), `Hinweis ${farbe}`).toBeGreaterThanOrEqual(4.5);
        const ziele = await page.locator('.einrichten .anw input, .einrichten .anw button').evaluateAll(e => e.map(x => x.getBoundingClientRect().height));
        expect(Math.min(...ziele)).toBeGreaterThanOrEqual(24);
      });
    }
  }
});
