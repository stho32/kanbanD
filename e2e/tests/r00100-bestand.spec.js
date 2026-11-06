// E2E R00100 Bericht „Bestand nach Labels“ (I0092): offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, filterOeffnen } = require('./hilfen');

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
const commits = k => Number(k.git('rev-list', '--count', 'HEAD'));

test.describe('R00100 Bestand nach Labels', () => {
  let k;
  test.afterEach(() => k && k.stoppen());

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
    await expect(eintrag.locator('small')).toHaveText('Offene Aufgaben je Label-Paar, gefärbt nach der dringendsten Klasse — Klick öffnet das Board.');
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

  test('Zu wenige Präfixe: nur repo:* → Hinweis statt Tabelle, kein Commit; ganz ohne Präfix derselbe Hinweis', async ({ page }) => {
    const nurRepo = { 'kanbanD.md': EINSTELLUNGEN, 'boards/fabrik.md': boardMd([1, 2], []), 'aufgaben/0001-a1.md': aufgabeMd(1, ['repo:shop'], 'drift'), 'aufgaben/0002-a2.md': aufgabeMd(2, ['repo:lager', 'dringend']) };
    await bericht(page, nurRepo);
    const vorher = commits(k);
    await expect(bericht_(page)).toContainText(HINWEIS);
    await expect(tabelle(page)).toHaveCount(0);
    expect(commits(k)).toBe(vorher);
    k.schreib('aufgaben/0001-a1.md', aufgabeMd(1, ['dringend'], 'drift'));
    k.schreib('aufgaben/0002-a2.md', aufgabeMd(2, []));
    await expect(bericht_(page)).toContainText(HINWEIS);
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

  test('Legende: Sicherheit, EOL, Drift mit Farbfeld, „ohne Klasse“ ohne; ein Klick darauf ändert nichts', async ({ page }) => {
    await bericht(page, grundbestand());
    await expect(legende(page)).toHaveAttribute('aria-label', 'Legende');
    await expect(legende(page).locator('.best-le')).toHaveText(['Sicherheit', 'EOL', 'Drift', 'ohne Klasse']);
    await expect(legende(page).locator('.best-le').filter({ has: page.locator('.sw') })).toHaveText(['Sicherheit', 'EOL', 'Drift']);
    const vorher = await alleZahlen(page), adresse = page.url();
    await legende(page).getByText('Drift', { exact: true }).click();
    expect(await alleZahlen(page)).toEqual(vorher);
    expect(page.url()).toBe(adresse);
    await page.goto(k.adresse + '#/board/fabrik');
    await expect(page.locator('#flt')).toHaveValue('');
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
