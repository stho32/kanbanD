// E2E R00100 Bericht „Bestand nach Labels“ (I0092): offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, liveBereit, filterOeffnen, kontrastAm } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  sicherheit: {label: Sicherheit, color: red}
  eol: {label: EOL, color: orange}
  drift: {label: Drift, color: blue}
sources:
  wbs: plan/wbs.md
  requirements: anf/
---
`;
const ACHSEN_REPO_NC = 'report-labels: {rows: repo, columns: nc}\n';
const aufgabeMd = (nr, labels, klasse = '', mehr = '') => `---\nid: ${nr}\ntitle: A${nr}\n${klasse ? `class: ${klasse}\n` : ''}labels: [${labels.map(l => JSON.stringify(l)).join(', ')}]\n${mehr}---\n`;
const boardMd = (eingang, fertig, kopf) => `${kopf ? `---\n${kopf}---\n` : ''}# fabrik\n\n## Eingang\n\n${eingang.map(n => `- #${n}\n`).join('')}\n## Fertig\n\n${fertig.map(n => `- #${n}\n`).join('')}`;

/** Grundbestand der AK: #1–#5 offen in „Eingang“, #6 in „Fertig“, #7 archiviert; `dazu` sind weitere offene Aufgaben. */
function grundbestand({ dazu = {}, kopf = ACHSEN_REPO_NC, eingang, fertig = [6] } = {}) {
  const aufgaben = {
    1: aufgabeMd(1, ['repo:shop', 'nc:304'], 'sicherheit'),
    2: aufgabeMd(2, ['repo:shop', 'nc:304'], 'drift'),
    3: aufgabeMd(3, ['repo:shop', 'nc:305'], 'eol'),
    4: aufgabeMd(4, ['repo:lager', 'nc:304']),
    5: aufgabeMd(5, ['repo:lager'], 'drift'),
    6: aufgabeMd(6, ['repo:shop', 'nc:304']),
    7: aufgabeMd(7, ['repo:shop', 'nc:304'], '', 'archived: 2026-10-01\n'),
    ...dazu,
  };
  const nummern = Object.keys(aufgaben).map(Number);
  const offen = eingang || nummern.filter(n => !fertig.includes(n));
  const dateien = { 'kanbanD.md': EINSTELLUNGEN, 'boards/fabrik.md': boardMd(offen, fertig, kopf) };
  for (const [nr, inhalt] of Object.entries(aufgaben)) dateien[`aufgaben/${String(nr).padStart(4, '0')}-a${nr}.md`] = inhalt;
  return dateien;
}

/* ── Testsprache: nur dieser Abschnitt kennt Selektoren ── */
const tabelle = page => page.locator('#bestand table.best-tab');
const spaltenkoepfe = page => tabelle(page).locator('thead th');
const zeilenkoepfe = page => tabelle(page).locator('tbody th');
/** Zelle nach Zeilen- und Spaltenkopf (sichtbarer Text). */
async function zelle(page, zeile, spalte) {
  await expect(tabelle(page)).toBeVisible();
  const koepfe = await spaltenkoepfe(page).allTextContents();
  const j = koepfe.indexOf(spalte);
  expect(j, `Spalte ${spalte} in ${koepfe.join(' | ')}`).toBeGreaterThan(0);
  return tabelle(page).locator('tbody tr').filter({ has: page.locator(`th:text-is("${zeile}")`) }).locator(':scope > *').nth(j);
}
const LEER = 'Keine offenen Aufgaben, die zu den Filtern der Berichte passen.';
const HINWEIS = 'Für diese Tabelle braucht das Board Labels mit zwei verschiedenen Präfixen, z. B. repo:shop und nc:304.';
const bericht_ = page => page.locator('#bestand');
const legende = page => page.locator('#bestand .best-leg');
const alleZahlen = page => tabelle(page).locator('tbody tr').evaluateAll(z => z.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim())));
const gesamt = page => page.getByRole('cell', { name: /^Summe gesamt: / });
const feld = (page, name) => page.getByLabel(name, { exact: true });
const status = page => page.locator('#bestand-achsen .best-status');
const NICHT_GESPEICHERT = 'nicht gespeichert — zum Speichern „Ich bin …“ wählen';
const farbe = (page, wert) => page.evaluate(w => { const p = document.createElement('p'); p.style.color = w; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }, wert);
const commits = k => Number(k.git('rev-list', '--count', 'HEAD'));

test.describe('R00100 Bestand nach Labels', () => {
  let k, schreibgeschuetzt = null;
  test.afterEach(async () => {
    if (schreibgeschuetzt) { fs.chmodSync(schreibgeschuetzt, 0o755); schreibgeschuetzt = null; }
    if (k) await k.stoppen();
  });

  async function bericht(page, dateien, { person = 'st' } = {}) {
    k = await kanbanStarten(einrichten(dateien));
    if (person) await alsPerson(page, person);
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await expect(page).toHaveTitle('fabrik — kanbanD'); // das Board ist gewählt und gemerkt; die Berichte gelten dem gemerkten Board
    await page.goto(k.adresse + '#/berichte/bestand');
    await expect(page.locator('#bestand')).toBeVisible();
  }

  test('Menü: Gruppe BESTAND zwischen VERLAUF und AUSLEITEN mit Tabellensymbol, Route und Fenstertitel', async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.locator('#t-ber').click();
    const menue = page.getByRole('menu', { name: 'Berichte' });
    const gruppen = await menue.evaluate(m => [...m.children].map(e => (e.classList.contains('k') ? `[${e.textContent}]` : e.querySelector('b').textContent)));
    expect(gruppen.slice(gruppen.indexOf('[VERLAUF]') + 1).filter(g => g.startsWith('['))).toEqual(['[BESTAND]', '[AUSLEITEN]']);
    expect(gruppen[gruppen.indexOf('[BESTAND]') + 1]).toBe('Bestand nach Labels');
    const eintrag = menue.getByRole('menuitem', { name: /^Bestand nach Labels/ });
    await expect(eintrag.locator('small')).toHaveText('Offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse – Klick öffnet das Board.');
    await expect(eintrag.locator('svg.i path')).toHaveCount(1);
    await expect(eintrag).toHaveAttribute('href', '#/berichte/bestand');
    await eintrag.click();
    await expect(page).toHaveURL(/#\/berichte\/bestand$/);
    await expect(page).toHaveTitle('Bestand — kanbanD');
  });

  test('US-1 / Darstellung: Kopfleiste, Eckzelle, Köpfe, Zahlen und Summen des Grundbestands, — in --kd-muted, kein Wort „Karte“', async ({ page }) => {
    await bericht(page, grundbestand());
    await expect(page.locator('#main .leiste').first()).toHaveText('Bestand nach Labels · liest nur · Klick auf eine Zahl öffnet das Board');
    await expect(page.getByRole('table', { name: 'Bestand nach Labels: repo × nc' })).toBeVisible();
    await expect(spaltenkoepfe(page)).toHaveText(['repo ↓ · nc →', '304', '305', '(ohne nc)', 'Summe']);
    await expect(tabelle(page).locator('thead th[scope="col"]')).toHaveCount(5);
    await expect(zeilenkoepfe(page)).toHaveText(['lager', 'shop', '(ohne repo)', 'Summe']);
    await expect(tabelle(page).locator('tbody th[scope="row"]')).toHaveCount(4);
    const zahlen = await tabelle(page).locator('tbody tr').evaluateAll(z => z.map(tr => [...tr.querySelectorAll('td')].map(td => td.textContent.trim())));
    expect(zahlen).toEqual([
      ['1', '—', '1', '2'],
      ['2', '1', '—', '3'],
      ['—', '—', '—', '0'],
      ['3', '1', '1', '5'],
    ]);
    const leer = (await zelle(page, 'shop', '(ohne nc)')).locator('span');
    const muted = await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--kd-muted)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
    await expect(leer).toHaveCSS('color', muted);
    expect(await page.locator('#main').innerText()).not.toMatch(/Karte/);
  });

  test('Name je Zelle: Tooltip und zugänglicher Name sind derselbe Text', async ({ page }) => {
    await bericht(page, grundbestand());
    const name = 'repo:shop × nc:304: 2 offen — Sicherheit 1 · Drift 1 · ohne Abschlussspalte, ohne Filter der Berichte';
    const benannt = (await zelle(page, 'shop', '304')).locator('xpath=descendant-or-self::*[@title]').first();
    await expect(benannt).toHaveAttribute('title', name);
    await expect(benannt).toHaveAttribute('aria-label', name);
    await expect(page.getByLabel('repo:lager × nc:304: 1 offen — ohne Klasse 1 · ohne Abschlussspalte, ohne Filter der Berichte', { exact: true })).toHaveText('1');
    await expect(page.getByRole('cell', { name: 'repo:lager × (ohne nc): 1 offen — Drift 1 · nicht klickbar' })).toHaveAttribute('title', 'repo:lager × (ohne nc): 1 offen — Drift 1 · nicht klickbar');
    await expect(page.getByRole('cell', { name: 'Summe repo:shop: 3 offen · nicht klickbar' })).toHaveText('3');
    await expect(page.getByRole('cell', { name: 'Summe gesamt: 5 offen · nicht klickbar' })).toHaveText('5');
    await expect(page.getByRole('cell', { name: 'repo:shop × (ohne nc): keine offen' })).toHaveText('—');
    const summeOhneRepo = await zelle(page, '(ohne repo)', 'Summe');
    await expect(summeOhneRepo).toHaveText('0');
    await expect(summeOhneRepo).toHaveAttribute('title', 'Summe (ohne repo): 0 offen · nicht klickbar');
    await expect(summeOhneRepo).toHaveAttribute('aria-label', 'Summe (ohne repo): 0 offen · nicht klickbar');
  });

  test('US-5: ohne gespeicherte Achsen der Vorschlag repo × nc, ohne Commit', async ({ page }) => {
    await bericht(page, grundbestand({ kopf: '' }));
    const vorher = commits(k);
    await expect(page.getByRole('table', { name: 'Bestand nach Labels: repo × nc' })).toBeVisible();
    await expect(spaltenkoepfe(page).first()).toHaveText('repo ↓ · nc →');
    expect(commits(k)).toBe(vorher);
    expect(k.lies('boards/fabrik.md')).not.toContain('report-labels');
  });

  test('US-4: gespeicherter Zeitraum „letzte Woche“ gilt hier nicht — Zahlen wie ohne, keine Gruppe Zeitraum, nicht unter „aktiv“, Datei byte-gleich', async ({ page }) => {
    await bericht(page, grundbestand({ kopf: `${ACHSEN_REPO_NC}report-filter: {period: vorwoche, window-days: 30}\n` }));
    const vorher = k.lies('boards/fabrik.md');
    await expect(gesamt(page)).toHaveText('5');
    await expect(page.locator('.bf-zusammen')).toHaveText('Filter · keine · Zeitraum gilt hier nicht');
    await filterOeffnen(page);
    await expect(page.locator('.bfilter .bf-k')).toHaveText(['Farben', 'Spalten', 'Zuständig', 'Labels']);
    await page.goto(k.adresse + '#/berichte/verlauf');
    await expect(page.getByLabel('Zeitraum', { exact: true })).toHaveValue('vorwoche');
    expect(k.lies('boards/fabrik.md')).toBe(vorher);
  });

  test('US-6: alles in „Fertig“ oder archiviert → Leersatz ohne „Zurücksetzen“, kein Commit', async ({ page }) => {
    await bericht(page, grundbestand({ eingang: [7], fertig: [1, 2, 3, 4, 5, 6] }));
    const vorher = commits(k);
    await expect(bericht_(page)).toContainText(LEER);
    await expect(tabelle(page)).toHaveCount(0);
    await expect(bericht_(page).getByRole('button', { name: 'Zurücksetzen' })).toHaveCount(0);
    await expect(feld(page, 'Zeilen')).toHaveValue('repo');
    await expect(feld(page, 'Spalten')).toHaveValue('nc');
    expect(commits(k)).toBe(vorher);
  });

  test('Leerfall mit Filter: „Eingang“ ausgeschlossen → Leersatz mit „Zurücksetzen“; Klick hebt nur den Spaltenausschluss auf (ein Commit), Zeitraum und Messbasis bleiben', async ({ page }) => {
    await bericht(page, grundbestand({ kopf: `${ACHSEN_REPO_NC}report-filter: {period: vorwoche, exclude-columns: [Eingang], window-days: 30}\n` }));
    await expect(page.locator('.bf-zusammen')).toHaveText('Filter · 1 aktiv · Zeitraum gilt hier nicht');
    await expect(bericht_(page)).toContainText(LEER);
    const vorher = commits(k);
    await bericht_(page).getByRole('button', { name: 'Zurücksetzen', exact: true }).click();
    await expect(gesamt(page)).toHaveText('5');
    await expect.poll(() => commits(k)).toBe(vorher + 1);
    const datei = k.lies('boards/fabrik.md');
    expect(datei).toContain('period: vorwoche');
    expect(datei).toContain('window-days: 30');
    expect(datei).not.toContain('Eingang]');
  });

  test('Zu wenige Präfixe: nur repo:* → Hinweis statt Tabelle, Feld „Zeilen“ bietet repo an, kein Commit; ganz ohne Präfix derselbe Hinweis ohne Präfix-Option', async ({ page }) => {
    const nurRepo = { 'kanbanD.md': EINSTELLUNGEN, 'boards/fabrik.md': boardMd([1, 2], []), 'aufgaben/0001-a1.md': aufgabeMd(1, ['repo:shop'], 'drift'), 'aufgaben/0002-a2.md': aufgabeMd(2, ['repo:lager', 'dringend']) };
    await bericht(page, nurRepo);
    const vorher = commits(k), puts = [];
    page.on('request', r => { if (r.method() === 'PUT') puts.push(r.url()); });
    await expect(bericht_(page)).toContainText(HINWEIS);
    await expect(tabelle(page)).toHaveCount(0);
    await expect(feld(page, 'Zeilen').locator('option')).toHaveText(['repo']);
    await expect(feld(page, 'Zeilen')).toHaveValue('repo');
    await expect(feld(page, 'Spalten')).toHaveCount(0);
    await expect(page.getByRole('button', { name: '⇄ Achsen tauschen' })).toBeDisabled();
    await feld(page, 'Zeilen').selectOption('repo');
    await expect(bericht_(page)).toContainText(HINWEIS);
    expect(puts).toEqual([]);
    expect(commits(k)).toBe(vorher);
    k.schreib('aufgaben/0001-a1.md', aufgabeMd(1, ['dringend'], 'drift'));
    k.schreib('aufgaben/0002-a2.md', aufgabeMd(2, []));
    await expect(feld(page, 'Zeilen')).toHaveCount(0);
    await expect(bericht_(page)).toContainText(HINWEIS);
    await expect(bericht_(page).locator('option')).toHaveCount(0);
    await expect(tabelle(page)).toHaveCount(0);
  });

  test('Zellmarke: Balken 3 px in --cl der dringendsten Klasse wie der Kartenrand, Hintergrund wie die Karte; ohne Klasse weder Farbe noch Balken', async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    const karte = n => page.locator(`.ka[data-id="${n}"]`);
    const rand = async n => [await karte(n).evaluate(e => getComputedStyle(e).borderLeftColor), await karte(n).evaluate(e => getComputedStyle(e).backgroundColor)];
    const [randSicherheit, grundSicherheit] = await rand(1), [randEol] = await rand(3);
    await page.goto(k.adresse + '#/berichte/bestand');
    const shop304 = await zelle(page, 'shop', '304'), shop305 = await zelle(page, 'shop', '305'), lager304 = await zelle(page, 'lager', '304'), leer = await zelle(page, 'shop', '(ohne nc)');
    await expect(shop304).toHaveCSS('border-left-width', '3px');
    await expect(shop304).toHaveCSS('border-left-style', 'solid');
    await expect(shop304).toHaveCSS('border-left-color', randSicherheit);
    await expect(shop304).toHaveCSS('background-color', grundSicherheit);
    await expect(shop305).toHaveCSS('border-left-color', randEol);
    await expect(lager304).toHaveCSS('border-left-width', '0px');
    await expect(lager304).toHaveCSS('background-color', await leer.evaluate(e => getComputedStyle(e).backgroundColor));
  });

  test('Legende: je Eintrag genau ein Farbfeld, „ohne Klasse“ leer wie in der Board-Legende (hell und dunkel); ein Klick darauf ändert nichts', async ({ page }) => {
    await bericht(page, grundbestand());
    await expect(legende(page)).toHaveAttribute('aria-label', 'Legende');
    await expect(legende(page).locator('.best-le')).toHaveText(['Sicherheit', 'EOL', 'Drift', 'ohne Klasse']);
    for (const eintrag of await legende(page).locator('.best-le').all()) await expect(eintrag.locator('.sw')).toHaveCount(1);
    const feldOhne = legende(page).locator('.best-le').filter({ hasText: 'ohne Klasse' }).locator('.sw');
    await expect(feldOhne).toHaveClass('sw leer');
    const flaeche = ort => ort.evaluate(e => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopColor, s.borderTopWidth]; });
    for (const schema of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: schema });
      await page.goto(k.adresse + '#/board/fabrik');
      const vorbild = await flaeche(page.locator('.leg button[data-arg="none"] .sw'));
      await page.goto(k.adresse + '#/berichte/bestand');
      expect(await flaeche(feldOhne), schema).toEqual(vorbild);
    }
    await page.emulateMedia({ colorScheme: 'light' });
    const vorher = await alleZahlen(page), adresse = page.url();
    await legende(page).getByText('Drift', { exact: true }).click();
    expect(await alleZahlen(page)).toEqual(vorher);
    expect(page.url()).toBe(adresse);
    await page.goto(k.adresse + '#/board/fabrik');
    await expect(page.locator('#flt')).toHaveValue('');
  });

  test('Legendenhinweis „zeigt nur, filtert nicht“ in der Farbe des Erklärsatzes, Kontrast mindestens 4,5:1 hell und dunkel', async ({ page }) => {
    await bericht(page, grundbestand());
    const hinweis = legende(page).locator('.rechts');
    await expect(hinweis).toHaveText('zeigt nur, filtert nicht');
    for (const schema of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: schema });
      const erklaerfarbe = await page.locator('#bestand .best-erkl').evaluate(e => getComputedStyle(e).color);
      await expect(hinweis, schema).toHaveCSS('color', erklaerfarbe);
      expect(await kontrastAm(hinweis), schema).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('Feldwahl: „Spalten“ = repo tauscht zu nc × repo, ein PUT, ein Commit, Frontmatter; ein zweiter Browser folgt ohne und nach Neuladen', async ({ page, browser }) => {
    await bericht(page, grundbestand());
    const zweit = await browser.newContext(), seite2 = await zweit.newPage();
    try {
      await alsPerson(seite2, 'st');
      await seite2.goto(k.adresse + '#/board/fabrik');
      await liveBereit(seite2);
      await seite2.goto(k.adresse + '#/berichte/bestand');
      await expect(seite2.getByRole('table', { name: 'Bestand nach Labels: repo × nc' })).toBeVisible();
      await expect(feld(page, 'Zeilen').locator('option')).toHaveText(['repo', 'nc']);
      const vorher = commits(k), puts = [];
      page.on('request', r => { if (r.method() === 'PUT') puts.push(r.url()); });
      await feld(page, 'Spalten').selectOption('repo');
      await expect(page.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
      await expect(feld(page, 'Zeilen')).toHaveValue('nc');
      await expect(feld(page, 'Spalten')).toHaveValue('repo');
      await expect.poll(() => commits(k)).toBe(vorher + 1);
      expect(puts.map(u => new URL(u).pathname)).toEqual(['/api/boards/fabrik/bestand']);
      expect(k.lies('boards/fabrik.md')).toContain('report-labels: {rows: nc, columns: repo}');
      await expect(status(page)).toHaveCount(0);
      await expect(seite2.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
      await seite2.reload();
      await expect(seite2.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
    } finally { await zweit.close(); }
  });

  test('Feldwahl ohne Person: nur diese Ansicht wechselt, Hinweis in Textfarbe mit amberfarbener Linie, git log und Datei gleich', async ({ page }) => {
    await bericht(page, grundbestand(), { person: null });
    const vorher = commits(k), datei = k.lies('boards/fabrik.md'), puts = [];
    page.on('request', r => { if (r.method() === 'PUT') puts.push(r.url()); });
    await feld(page, 'Zeilen').selectOption('nc');
    await expect(page.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
    await expect(status(page)).toHaveText(NICHT_GESPEICHERT);
    await expect(status(page)).toHaveCSS('color', await farbe(page, 'var(--kd-text)'));
    await expect(status(page)).toHaveCSS('border-left-color', await farbe(page, 'var(--kd-c-amber-line)'));
    await page.waitForTimeout(300);
    expect(puts).toEqual([]);
    expect(commits(k)).toBe(vorher);
    expect(k.lies('boards/fabrik.md')).toBe(datei);
  });

  test('Speicherfehler: boards/ schreibgeschützt → „Achsen nicht gespeichert: “ + Grund, Ansicht zeigt die Wahl, git log gleich', async ({ page }) => {
    await bericht(page, grundbestand());
    const vorher = commits(k);
    schreibgeschuetzt = path.join(k.ordner, 'boards');
    fs.chmodSync(schreibgeschuetzt, 0o555);
    await feld(page, 'Spalten').selectOption('repo');
    await expect(status(page)).toHaveText(/^Achsen nicht gespeichert: \S/);
    await expect(page.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
    expect(commits(k)).toBe(vorher);
  });

  test('Gespeicherter Präfix ohne offene Aufgaben bleibt wählbar und zeigt nur „(ohne …)“', async ({ page }) => {
    await bericht(page, grundbestand({ kopf: 'report-labels: {rows: repo, columns: os}\n' }));
    await expect(feld(page, 'Spalten')).toHaveValue('os');
    await expect(feld(page, 'Spalten').locator('option')).toHaveText(['repo', 'nc', 'os']);
    await expect(spaltenkoepfe(page)).toHaveText(['repo ↓ · os →', '(ohne os)', 'Summe']);
  });

  test('US-3: „⇄ Achsen tauschen“ → nc × repo, genau ein PUT, ein Commit, Frontmatter; zweiter Browser live und nach Neuladen; Enter tauscht zurück', async ({ page, browser }) => {
    await bericht(page, grundbestand());
    const zweit = await browser.newContext(), seite2 = await zweit.newPage();
    try {
      await alsPerson(seite2, 'st');
      await seite2.goto(k.adresse + '#/board/fabrik');
      await liveBereit(seite2);
      await seite2.goto(k.adresse + '#/berichte/bestand');
      await expect(seite2.getByRole('table', { name: 'Bestand nach Labels: repo × nc' })).toBeVisible();
      const vorher = commits(k), puts = [];
      page.on('request', r => { if (r.method() === 'PUT') puts.push(new URL(r.url()).pathname); });
      await page.getByRole('button', { name: '⇄ Achsen tauschen' }).click();
      await expect(page.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
      await expect.poll(() => commits(k)).toBe(vorher + 1);
      expect(puts).toEqual(['/api/boards/fabrik/bestand']);
      expect(k.lies('boards/fabrik.md')).toContain('report-labels: {rows: nc, columns: repo}');
      await expect(seite2.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
      await seite2.reload();
      await expect(seite2.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
      await page.getByRole('button', { name: '⇄ Achsen tauschen' }).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByRole('table', { name: 'Bestand nach Labels: repo × nc' })).toBeVisible();
      await expect.poll(() => commits(k)).toBe(vorher + 2);
      expect(k.lies('boards/fabrik.md')).toContain('report-labels: {rows: repo, columns: nc}');
    } finally { await zweit.close(); }
  });

  test('US-8: „⇄ Achsen tauschen“ ohne Person → nc × repo nur hier mit Hinweis, kein PUT, git log und boards/fabrik.md gleich', async ({ page }) => {
    await bericht(page, grundbestand(), { person: null });
    const vorher = commits(k), datei = k.lies('boards/fabrik.md'), puts = [];
    page.on('request', r => { if (r.method() === 'PUT') puts.push(r.url()); });
    await page.getByRole('button', { name: '⇄ Achsen tauschen' }).click();
    await expect(page.getByRole('table', { name: 'Bestand nach Labels: nc × repo' })).toBeVisible();
    await expect(status(page)).toHaveText(NICHT_GESPEICHERT);
    await page.waitForTimeout(300);
    expect(puts).toEqual([]);
    expect(commits(k)).toBe(vorher);
    expect(k.lies('boards/fabrik.md')).toBe(datei);
  });

  test('US-2: Klick auf die Zahl in shop × 304 öffnet das Board mit label:repo:shop label:nc:304 — sichtbar genau #1, #2, #6', async ({ page }) => {
    await bericht(page, grundbestand());
    await (await zelle(page, 'shop', '304')).getByRole('link', { name: /^repo:shop × nc:304: 2 offen/ }).click();
    await expect(page).toHaveURL(/#\/board\/fabrik$/);
    await expect(page.locator('#flt')).toHaveValue('label:repo:shop label:nc:304');
    await expect(page.locator('.ka[data-id]:visible')).toHaveCount(3);
    expect((await page.locator('.ka[data-id]:visible').evaluateAll(e => e.map(x => Number(x.dataset.id)))).sort()).toEqual([1, 2, 6]);
  });

  test('Gegenbeispiele: „(ohne …)“, Summe und leere Zelle sind kein Link, ein Klick ändert weder Route noch Filter; unterstrichen sind genau die drei klickbaren Zahlen; Erklärsatz', async ({ page }) => {
    await bericht(page, grundbestand());
    await expect(tabelle(page).getByRole('link')).toHaveText(['1', '2', '1']);
    const unterstrichen = await tabelle(page).locator('td, td *').evaluateAll(e => e.filter(x => getComputedStyle(x).textDecorationLine.includes('underline')).map(x => x.textContent.trim()));
    expect(unterstrichen).toEqual(['1', '2', '1']);
    const adresse = page.url();
    for (const [z, s] of [['lager', '(ohne nc)'], ['shop', 'Summe'], ['shop', '(ohne nc)'], ['Summe', '304']]) {
      const ort = await zelle(page, z, s);
      await expect(ort.getByRole('link'), `${z} × ${s}`).toHaveCount(0);
      await ort.click();
      expect(page.url(), `${z} × ${s}`).toBe(adresse);
    }
    await expect(page.locator('#bestand .best-erkl')).toHaveText('Eine Zahl öffnet das Board mit diesen Aufgaben. Nicht klickbar sind „(ohne …)“ und die Summen. Das Board übernimmt die Filter der Berichte nicht und zeigt auch die Abschlussspalte.');
    await page.goto(k.adresse + '#/board/fabrik');
    await expect(page.locator('#flt')).toHaveValue('');
  });

  test('US-7: nur Tab ab „Spalten“ — nach „⇄ Achsen tauschen“ genau lager × 304, shop × 304, shop × 305 mit Fokusring, dann aus der Tabelle; zurück und Enter öffnet das Board', async ({ page }) => {
    await bericht(page, grundbestand());
    await feld(page, 'Spalten').focus();
    const fokus = () => page.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { name: e.getAttribute('aria-label') || e.textContent.trim(), inTabelle: !!e.closest('table'), ring: s.outlineStyle !== 'none' && s.outlineWidth !== '0px' || s.boxShadow !== 'none', breite: e.getBoundingClientRect().width, hoehe: e.getBoundingClientRect().height }; });
    const weg = [];
    for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); weg.push(await fokus()); }
    expect(weg[0].name).toBe('⇄ Achsen tauschen');
    expect(weg.slice(1, 4).map(f => f.name.split(':').slice(0, 3).join(':'))).toEqual(['repo:lager × nc:304', 'repo:shop × nc:304', 'repo:shop × nc:305']);
    for (const f of weg.slice(1, 4)) {
      expect(f.inTabelle && f.ring, f.name).toBe(true);
      expect(f.breite, f.name).toBeGreaterThanOrEqual(24);
      expect(f.hoehe, f.name).toBeGreaterThanOrEqual(24);
    }
    expect(weg[4].inTabelle).toBe(false);
    await expect(tabelle(page).locator('a.bz:focus-visible')).toHaveCount(0);
    await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Shift+Tab');
    expect((await fokus()).name).toMatch(/^repo:shop × nc:304: /);
    await expect(tabelle(page).locator('a.bz:focus-visible')).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/board\/fabrik$/);
    await expect(page.locator('#flt')).toHaveValue('label:repo:shop label:nc:304');
  });

  test('Zielgröße bei Touch (pointer: coarse, 375 px): jede klickbare Zahl, beide Auswahlfelder und „⇄ Achsen tauschen“ mindestens 44 px hoch', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 375, height: 800 } }), page = await ctx.newPage();
    try {
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      await bericht(page, grundbestand());
      const hoehen = await tabelle(page).locator('a.bz').evaluateAll(e => e.map(x => x.getBoundingClientRect().height));
      expect(hoehen).toHaveLength(3);
      for (const h of hoehen) expect(h).toBeGreaterThanOrEqual(44);
      for (const ort of [feld(page, 'Zeilen'), feld(page, 'Spalten'), page.getByRole('button', { name: '⇄ Achsen tauschen' })]) {
        const box = await ort.boundingBox();
        expect(box.height, await ort.evaluate(e => e.id || e.textContent)).toBeGreaterThanOrEqual(44);
      }
    } finally { await ctx.close(); }
  });

  for (const breite of [320, 375, 414]) {
    test(`Schmales Layout ${breite} px: nur der Tabellenbereich scrollt quer, „shop“ und „409“ bleiben am Ende sichtbar`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 800 });
      const dazu = {};
      for (let i = 0; i < 10; i++) dazu[8 + i] = aufgabeMd(8 + i, ['repo:shop', `nc:${400 + i}`], 'drift');
      await bericht(page, grundbestand({ dazu }));
      await expect(spaltenkoepfe(page).last()).toHaveText('Summe');
      const flaeche = page.locator('#best-scroll');
      await flaeche.evaluate(e => { e.scrollLeft = e.scrollWidth; });
      expect(await flaeche.evaluate(e => e.scrollLeft)).toBeGreaterThan(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(breite);
      const rahmen = await flaeche.boundingBox();
      const drin = async ort => { const b = await ort.boundingBox(); return b.x >= rahmen.x - 0.5 && b.x + b.width <= rahmen.x + rahmen.width + 0.5; };
      expect(await drin(zeilenkoepfe(page).filter({ hasText: /^shop$/ })), 'Zeilenkopf shop').toBe(true);
      expect(await drin(spaltenkoepfe(page).filter({ hasText: /^409$/ })), 'Spaltenkopf 409').toBe(true);
    });
  }

  test('Live: eine neue Aufgabe [repo:shop, nc:304] in „Eingang“ zeigt shop × 304 = 3 ohne Neuladen', async ({ page }) => {
    await bericht(page, grundbestand());
    await expect(await zelle(page, 'shop', '304')).toHaveText('2');
    const antwort = await page.request.post(`${k.adresse}api/aufgaben`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'neu', board: 'fabrik', spalte: 'Eingang', labels: ['repo:shop', 'nc:304'] } });
    expect(antwort.ok(), await antwort.text()).toBe(true);
    await expect(await zelle(page, 'shop', '304')).toHaveText('3', { timeout: 1000 });
  });

  test('Live-Neuzeichnen hält den Sichtzustand: Fokus bleibt auf der Zahl shop × 304, das Querscrollen der Tabelle bleibt (375 px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    const dazu = {};
    for (let i = 0; i < 10; i++) dazu[8 + i] = aufgabeMd(8 + i, ['repo:shop', `nc:${400 + i}`], 'drift');
    await bericht(page, grundbestand({ dazu }));
    const flaeche = page.locator('#best-scroll');
    await flaeche.evaluate(e => { e.scrollLeft = 120; });
    const quer = await flaeche.evaluate(e => e.scrollLeft);
    expect(quer).toBeGreaterThan(0);
    await (await zelle(page, 'shop', '304')).getByRole('link').focus();
    const antwort = await page.request.post(`${k.adresse}api/aufgaben`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'neu', board: 'fabrik', spalte: 'Eingang', labels: ['repo:shop', 'nc:304'] } });
    expect(antwort.ok(), await antwort.text()).toBe(true);
    await expect(await zelle(page, 'shop', '304')).toHaveText('3', { timeout: 1000 });
    expect(await page.evaluate(() => document.activeElement.getAttribute('aria-label'))).toMatch(/^repo:shop × nc:304: 3 offen/);
    expect(await flaeche.evaluate(e => e.scrollLeft)).toBe(quer);
  });

  test('Nicht-funktional: 500 offene Aufgaben mit 30 × 30 Werten in unter 200 ms gerechnet und gezeichnet', async ({ page }) => {
    const dazu = {};
    for (let n = 8; n < 508; n++) dazu[n] = aufgabeMd(n, [`repo:r${n % 30}`, `nc:${(n * 7) % 30}`], ['sicherheit', 'eol', 'drift', ''][n % 4]);
    await bericht(page, grundbestand({ dazu }));
    await expect(zeilenkoepfe(page)).toHaveCount(30 + 2 + 1 + 1); // r0–r29, lager, shop, (ohne repo), Summe
    const ms = await page.evaluate(() => {
      const t0 = performance.now();
      document.getElementById('main').innerHTML = vHaupt();
      if (!document.querySelector('#bestand table.best-tab')) throw new Error('keine Tabelle');
      return performance.now() - t0;
    });
    expect(ms).toBeLessThan(200);
  });
});
