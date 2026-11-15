// R00124 Datums-Trenner in den Spalten (Karte #119, Artboard D0002 #datums-trenner)
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, liveBereit, breiteSetzen, kontrastAm, mehrOeffnen, ausMehr } = require('./hilfen');

const tag = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Grundbestand (AK R00124) mit gesetzten Commit-Zeiten: #1 vor zwei Tagen, #2/#3 gestern, #4 heute in „Fertig“. */
function grundbestand(ordner) {
  fs.mkdirSync(path.join(ordner, 'boards'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'aufgaben'), { recursive: true });
  const schreib = (rel, inhalt) => fs.writeFileSync(path.join(ordner, rel), inhalt);
  const commit = (datum, nachricht) => {
    spawnSync('git', ['-C', ordner, 'add', '-A'], { encoding: 'utf8' });
    const r = spawnSync('git', ['-C', ordner, 'commit', '-q', '-m', nachricht], {
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_DATE: `${datum}T09:00:00`, GIT_COMMITTER_DATE: `${datum}T09:00:00`, GIT_AUTHOR_NAME: 'sh', GIT_AUTHOR_EMAIL: 'sh@kanbanD', GIT_COMMITTER_NAME: 'sh', GIT_COMMITTER_EMAIL: 'sh@kanbanD' },
    });
    if (r.status !== 0) throw new Error(`Commit ${nachricht}: ${r.stderr}`);
  };
  const fertig = (...nummern) => `# fabrik\n\n## Eingang\n\n## In Arbeit\n\n## Fertig\n\n${nummern.map(n => `- #${n}`).join('\n')}\n`;
  schreib('kanbanD.md', '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\n---\n');
  schreib('boards/fabrik.md', fertig());
  for (const n of [1, 2, 3, 4]) schreib(`aufgaben/000${n}-x.md`, `---\nid: ${n}\ntitle: x\n---\n`);
  spawnSync('git', ['-C', ordner, 'init', '-q'], { encoding: 'utf8' });
  // Der Grundstein liegt deutlich vor allen Bewegungen — sonst sortierte er (echte Commit-Zeit) ans Ende
  commit('2020-01-01', 'eingerichtet');
  schreib('boards/fabrik.md', fertig(1));
  commit(tag(-2), '#1 in Fertig');
  schreib('boards/fabrik.md', fertig(3, 2, 1));
  commit(tag(-1), '#2 und #3 in Fertig');
  schreib('boards/fabrik.md', fertig(4, 3, 2, 1));
  commit(tag(0), '#4 in Fertig');
}

const trenner = page => page.locator('[data-col="Fertig"] .dtrenn');
const texte = async page => (await trenner(page).allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());

test.describe('R00124', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(grundbestand); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1: „Fertig“ zeigt Heute / Gestern / Datum vor der jeweiligen Tagesgruppe, die Reihenfolge bleibt', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    const daten = await texte(page);
    expect(daten).toEqual(['— Heute —', '— Gestern —', `— ${tag(-2).split('-').reverse().join('.')} —`]);
    // die Trenner stehen vor #4 (Heute), #3 (Gestern) und #1 (Datum), nicht vor #2 (same day)
    const folge = await page.locator('[data-col="Fertig"] .flaeche > *').evaluateAll(els => els.map(e => e.classList.contains('dtrenn') ? 'T' : e.dataset.id));
    expect(folge).toEqual(['T', '4', 'T', '3', '2', 'T', '1']);
    // jede Karte liegt in einem role=listitem, der Trenner ist keinesfalls ein Bedienziel
    for (const t of await trenner(page).all()) {
      await expect(t).toHaveAttribute('role', 'listitem');
      await expect(t).not.toHaveAttribute('tabindex', /.*/);
    }
  });

  test('US-2: Standard nur in der Abschlussspalte an; „Eingang“ und „In Arbeit“ ohne Trenner', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await expect(page.locator('[data-col="Eingang"] .dtrenn')).toHaveCount(0);
    await expect(page.locator('[data-col="In Arbeit"] .dtrenn')).toHaveCount(0);
    await expect(trenner(page)).toHaveCount(3);
  });

  test('US-3: der Trenner ist nur Anzeige — keine Zahl, kein Commit, nicht bedienbar', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    const vorher = k.git('rev-list', '--count', 'HEAD');
    const datei = k.lies('boards/fabrik.md');
    await expect(page.locator('[data-col="Fertig"] .bahn-kopf .n')).toHaveText('4');
    await trenner(page).first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(vorher);
    expect(k.lies('boards/fabrik.md')).toBe(datei);
  });

  test('US-5: im Archiv keine Trenner, danach wieder unverändert', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.request.post(k.adresse + 'api/aufgaben/4/archivieren', { headers: { 'X-KanbanD-Wer': 'st' } });
    await expect(page.locator('[data-col="Fertig"] .flaeche > .ka')).toHaveCount(3);
    await page.locator('[data-act="archiv-an"]').click();
    await expect(page.locator('.archbar')).toContainText('Archiv');
    await expect(page.locator('.dtrenn')).toHaveCount(0);
    await page.locator('[data-act="archiv-aus"]').click();
    // #4 ist archiviert: #3/#2 (Gestern) und #1 (Datum) bleiben — zwei Trenner
    await expect(trenner(page)).toHaveCount(2);
  });

  test('AK Einschalten: „Eingang“ im Spalten-Dialog einschalten → column-dates in der Datei, genau ein Commit', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await page.locator('#t-mehr').click();
    await page.locator('#mehr-spalten').click();
    const eingang = page.getByRole('button', { name: /Datums-Trenner Eingang/ });
    await expect(eingang).toHaveAttribute('aria-pressed', 'false');
    await eingang.click();
    await expect(eingang).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-act="setup-ok"]').click();
    await expect(page.locator('.setup')).toHaveCount(0);
    expect(k.lies('boards/fabrik.md')).toMatch(/column-dates:[\s\S]*Eingang: true/);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher + 1);
  });

  test('Wächter: Speichern ohne Änderung lässt die Board-Datei byte-gleich (kein column-dates ohne Abweichung)', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    const datei = k.lies('boards/fabrik.md');
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await page.locator('#t-mehr').click();
    await page.locator('#mehr-spalten').click();
    await page.locator('.setup').waitFor();
    await page.locator('[data-act="setup-ok"]').click();
    await expect(page.locator('.setup')).toHaveCount(0);
    await page.waitForTimeout(300);
    expect(k.lies('boards/fabrik.md')).toBe(datei, 'ohne Änderung byte-gleich');
    expect(k.lies('boards/fabrik.md')).not.toMatch(/column-dates/, 'kein Spalten-Schluessel ohne Abweichung');
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher, 'kein Commit ohne Änderung');
  });

  test('AK Standard im Schalter: die Vorschau führt column-dates, die Abschlussspalte steht an', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.locator('#t-mehr').click();
    await page.locator('#mehr-spalten').click();
    await expect(page.getByRole('button', { name: /Datums-Trenner Fertig/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /Datums-Trenner In Arbeit/ })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#setup-vorschau')).toContainText('column-dates');
    // Zielgröße ≥ 24 px fein
    const hoehe = await page.getByRole('button', { name: /Datums-Trenner Fertig/ }).evaluate(el => el.getBoundingClientRect().height);
    expect(hoehe).toBeGreaterThanOrEqual(24);
  });

  test('Kontrast: die Beschriftung hält 4,5:1, hell und dunkel', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    for (const thema of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
      const erste = trenner(page).first().locator('.dtrenn-t');
      expect(await kontrastAm(erste)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('Schmales Layout: 320/375/414 px ohne Querscrollen, Beschriftung vollständig', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    for (const breite of [320, 375, 414]) {
      await breiteSetzen(page, breite, 800);
      const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(quer, `Querscrollen bei ${breite}`).toBeLessThanOrEqual(0);
      await expect(trenner(page).first().locator('.dtrenn-t')).toBeVisible();
    }
  });
});

/** Grundbestand für die Reihenfolge-Proben: #1 vor zwei Tagen, #2/#3 gestern, #4 heute in „Fertig“ (Datei-Reihenfolge 4·3·2·1);
    #3 trägt das Signal „review“. */
function reihenfolgeBestand(ordner) {
  fs.mkdirSync(path.join(ordner, 'boards'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'aufgaben'), { recursive: true });
  const schreib = (rel, inhalt) => fs.writeFileSync(path.join(ordner, rel), inhalt);
  const commit = (datum, nachricht) => {
    spawnSync('git', ['-C', ordner, 'add', '-A'], { encoding: 'utf8' });
    const r = spawnSync('git', ['-C', ordner, 'commit', '-q', '-m', nachricht], {
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_DATE: `${datum}T09:00:00`, GIT_COMMITTER_DATE: `${datum}T09:00:00`, GIT_AUTHOR_NAME: 'sh', GIT_AUTHOR_EMAIL: 'sh@kanbanD', GIT_COMMITTER_NAME: 'sh', GIT_COMMITTER_EMAIL: 'sh@kanbanD' },
    });
    if (r.status !== 0) throw new Error(`Commit ${nachricht}: ${r.stderr}`);
  };
  const fertig = (...nummern) => `# fabrik\n\n## Eingang\n\n## In Arbeit\n\n## Fertig\n\n${nummern.map(n => `- #${n}`).join('\n')}\n`;
  schreib('kanbanD.md', '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses: {}\nsignals:\n  review: {label: Review nötig, color: red}\n---\n');
  schreib('boards/fabrik.md', fertig());
  schreib('aufgaben/0001-eins.md', '---\nid: 1\ntitle: alpha eins\n---\n');
  schreib('aufgaben/0002-zwei.md', '---\nid: 2\ntitle: zwei\n---\n');
  schreib('aufgaben/0003-drei.md', '---\nid: 3\ntitle: drei\nsignals: [review]\n---\n');
  schreib('aufgaben/0004-vier.md', '---\nid: 4\ntitle: alpha vier\n---\n');
  spawnSync('git', ['-C', ordner, 'init', '-q'], { encoding: 'utf8' });
  commit('2020-01-01', 'eingerichtet');
  schreib('boards/fabrik.md', fertig(1));
  commit(tag(-2), '#1 in Fertig');
  schreib('boards/fabrik.md', fertig(3, 2, 1));
  commit(tag(-1), '#2 und #3 in Fertig');
  schreib('boards/fabrik.md', fertig(4, 3, 2, 1));
  commit(tag(0), '#4 in Fertig');
}

test.describe('R00124 Reihenfolge bei „Signale oben“ und Filter', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(reihenfolgeBestand); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const folge = page => page.locator('[data-col="Fertig"] .flaeche > *').evaluateAll(els => els.map(e => e.classList.contains('dtrenn') ? 'T' : e.dataset.id));

  test('AK Reihenfolge: „Signale oben“ rückt Karte und Trenner mit (gezeichnete Reihe, nicht sp.aufgaben)', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    // ohne „Signale oben“: die Trenner folgen der Datei-Reihenfolge 4·3·2·1
    expect(await folge(page)).toEqual(['T', '4', 'T', '3', '2', 'T', '1']);
    await ausMehr(page, 'Signale oben');
    // #3 (gestern) rückt nach oben: seine Tagesgruppe wandert mit, die Trenner folgen der gezeichneten Reihe
    await expect.poll(() => folge(page)).toEqual(['T', '3', 'T', '4', 'T', '2', 'T', '1']);
    const texte = (await page.locator('[data-col="Fertig"] .dtrenn').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    expect(texte).toEqual(['— Gestern —', '— Heute —', '— Gestern —', `— ${tag(-2).split('-').reverse().join('.')} —`]);
    // die Board-Datei bleibt unverändert (nur die Anzeige ändert sich)
    expect(k.lies('boards/fabrik.md')).toMatch(/- #4\n- #3\n- #2\n- #1/);
  });

  test('AK Filter: die Trenner richten sich nach den sichtbaren Karten', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.locator('#flt').fill('alpha');
    // nur #1 und #4 sichtbar (Titel „alpha …“) — zwei Tagesgruppen, die Trenner der verdeckten Karten entfallen
    await expect.poll(() => folge(page)).toEqual(['T', '4', 'T', '1']);
    const texte = (await page.locator('[data-col="Fertig"] .dtrenn').allInnerTexts()).map(t => t.replace(/\s+/g, ' ').trim());
    expect(texte).toEqual(['— Heute —', `— ${tag(-2).split('-').reverse().join('.')} —`]);
  });
});
