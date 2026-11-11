// R00123 Karten-Verlauf im Aufgabenfenster (Karte #119, ADR-0021, Artboard D0003 #reiter-verlauf)
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, liveBereit, kontrastAm } = require('./hilfen');

const KANBAND = '---\npeople:\n  sh: {name: Stefan, kind: human}\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\n---\n';
const board = (eingang, arbeit, fertig) => `# fabrik\n\n## Eingang\n\n${eingang.map(n => `- #${n}`).join('\n')}\n\n## In Arbeit\n\n${arbeit.map(n => `- #${n}`).join('\n')}\n\n## Fertig\n\n${fertig.map(n => `- #${n}`).join('\n')}\n`;
const aufgabe = (n, t, archiviert) => `---\nid: ${n}\ntitle: ${t}\n${archiviert ? `archived: ${archiviert}\n` : ''}---\n`;

/** Grundbestand (AK R00123): Board „fabrik“ mit Eingang/In Arbeit/Fertig; #1 mit vollem Weg, #2 und #3 auf dem Board. */
function verlaufBestand(ordner) {
  fs.mkdirSync(path.join(ordner, 'boards'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'aufgaben'), { recursive: true });
  const schreib = (rel, inhalt) => fs.writeFileSync(path.join(ordner, rel), inhalt);
  const commit = (datum, wer, nachricht) => {
    spawnSync('git', ['-C', ordner, 'add', '-A'], { encoding: 'utf8' });
    const email = wer.includes('@') ? wer : `${wer}@kanbanD`;
    const name = wer.includes('@') ? 'Extern' : `Name ${wer}`;
    const r = spawnSync('git', ['-C', ordner, 'commit', '-q', '-m', nachricht], {
      encoding: 'utf8',
      env: { ...process.env, ...(datum ? { GIT_AUTHOR_DATE: `${datum}T09:00:00`, GIT_COMMITTER_DATE: `${datum}T09:00:00` } : {}), GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email },
    });
    if (r.status !== 0) throw new Error(`Commit ${nachricht}: ${r.stderr}`);
  };
  schreib('kanbanD.md', KANBAND);
  schreib('boards/fabrik.md', board([], [], []));
  spawnSync('git', ['-C', ordner, 'init', '-q'], { encoding: 'utf8' });
  // Der Grundstein liegt deutlich vor allen Bewegungen — sonst sortierte er (echte Commit-Zeit) ans Ende
  commit('2020-01-01', 'Vorbereitung', 'eingerichtet');
  // #1: 01.10 angelegt in Eingang, 02.10 bewegt, 03.10 nach Fertig, 04.10 archiviert, 05.10 zurückgeholt, 06.10 vom Board
  schreib('aufgaben/0001-eins.md', aufgabe(1, 'eins'));
  schreib('boards/fabrik.md', board([1], [], []));
  commit('2026-10-01', 'sh', '#1 angelegt');
  schreib('boards/fabrik.md', board([], [1], []));
  commit('2026-10-02', 'cl', '#1 nach In Arbeit');
  schreib('boards/fabrik.md', board([], [], [1]));
  commit('2026-10-03', 'cl', '#1 nach Fertig');
  schreib('aufgaben/0001-eins.md', aufgabe(1, 'eins', '2026-10-04'));
  commit('2026-10-04', 'sh', '#1 archiviert');
  schreib('aufgaben/0001-eins.md', aufgabe(1, 'eins'));
  commit('2026-10-05', 'sh', '#1 zurückgeholt');
  schreib('boards/fabrik.md', board([], [], []));
  commit('2026-10-06', 'sh', '#1 vom Board genommen');
  // #2: 08.10 angelegt in Eingang, 08.10 10:00 nach In Arbeit; #3: 09.10 in Eingang
  schreib('aufgaben/0002-zwei.md', aufgabe(2, 'zwei'));
  schreib('boards/fabrik.md', board([2], [], []));
  commit('2026-10-08', 'st', '#2 angelegt');
  schreib('boards/fabrik.md', board([], [2], []));
  commit('2026-10-09', 'st', '#2 nach In Arbeit');
  schreib('aufgaben/0003-drei.md', aufgabe(3, 'drei'));
  schreib('boards/fabrik.md', board([3], [2], []));
  commit('2026-10-10', 'st', '#3 angelegt');
}

/** Für den fremden Autor: eine Board-Zeile von Hand mit Git-Identität „Extern“ bewegt. */
function fremdBestand(ordner) {
  verlaufBestand(ordner);
  const rel = path.join(ordner, 'boards/fabrik.md');
  fs.writeFileSync(rel, board([3], [], [2]));
  spawnSync('git', ['-C', ordner, 'add', '-A'], { encoding: 'utf8' });
  spawnSync('git', ['-C', ordner, 'commit', '-q', '-m', 'von Hand'], {
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_DATE: '2026-10-11T09:00:00', GIT_COMMITTER_DATE: '2026-10-11T09:00:00', GIT_AUTHOR_NAME: 'Extern', GIT_AUTHOR_EMAIL: 'extern@example.org', GIT_COMMITTER_NAME: 'Extern', GIT_COMMITTER_EMAIL: 'extern@example.org' },
  });
}

async function fensterAusListe(page, nr) {
  await page.goto(k.adresse + '#/aufgaben');
  await liveBereit(page);
  await page.locator(`tr[data-zeile="${nr}"] a`).click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nr}` });
  await fenster.waitFor();
  return fenster;
}
const zeilen = fenster => fenster.locator('#reiterpanel-verlauf tbody tr');

let k;
test.describe('R00123', () => {
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(verlaufBestand); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1/US-3/US-4: der Reiter zeigt sechs Einträge, neueste oben, Zeit mit Jahr, Art als Wort, „—“ in leeren Zellen', async ({ page }) => {
    const fenster = await fensterAusListe(page, 1);
    await fenster.getByRole('tab', { name: 'Verlauf' }).click();
    await expect(fenster.locator('#reiterpanel-verlauf table')).toBeVisible();
    await expect(fenster.locator('#reiterpanel-verlauf th[scope="col"]')).toHaveText(['Zeit', 'Art', 'von → nach', 'Board', 'Wer']);
    const inhalt = await zeilen(fenster).evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())));
    expect(inhalt).toEqual([
      ['06.10.2026 09:00', 'bewegt', 'Fertig → vom Board genommen', 'fabrik', 'SHStefan'],
      ['05.10.2026 09:00', 'zurückgeholt', '—', '—', 'SHStefan'],
      ['04.10.2026 09:00', 'archiviert', '—', '—', 'SHStefan'],
      ['03.10.2026 09:00', 'bewegt', 'In Arbeit → Fertig', 'fabrik', 'CLClaude'],
      ['02.10.2026 09:00', 'bewegt', 'Eingang → In Arbeit', 'fabrik', 'CLClaude'],
      ['01.10.2026 09:00', 'erstellt', '—', '—', 'SHStefan'],
    ]);
    await expect(fenster.locator('#reiterpanel-verlauf .vh-hin')).toContainText('liest nur · gerechnet aus der Git-Geschichte');
  });

  test('Reiterleiste: „Verlauf“ ist der letzte Reiter', async ({ page }) => {
    const fenster = await fensterAusListe(page, 1);
    const namen = await fenster.getByRole('tablist', { name: 'Ansicht der Aufgabe' }).getByRole('tab').allInnerTexts();
    expect(namen[namen.length - 1]).toBe('Verlauf');
    await expect(fenster.getByRole('tab', { name: 'Verlauf' })).toHaveCount(1);
  });

  test('US-6: nur gelesen — Datei und git log unverändert, kein Datenblock', async ({ page }) => {
    const vorherDatei = k.lies('aufgaben/0001-eins.md'), vorherLog = k.git('log', '--oneline');
    const fenster = await fensterAusListe(page, 1);
    await fenster.getByRole('tab', { name: 'Verlauf' }).click();
    await expect(zeilen(fenster)).toHaveCount(6);
    expect(k.lies('aufgaben/0001-eins.md')).toBe(vorherDatei);
    expect(k.git('log', '--oneline')).toBe(vorherLog);
    expect(k.lies('aufgaben/0001-eins.md')).not.toMatch(/kanbanD-log|kanbanD-verlauf/);
  });

  test('US-7: Blättern per ↓ bei gewähltem Verlauf leert das Panel und zeigt nur den Verlauf der neuen Aufgabe', async ({ page }) => {
    const fenster = await fensterAusListe(page, 2);
    await fenster.getByRole('tab', { name: 'Verlauf' }).click();
    await expect(zeilen(fenster)).toHaveCount(2);
    await expect(fenster.locator('#reiterpanel-verlauf')).toContainText('Eingang → In Arbeit');
    // das Laden der neuen Aufgabe verzögern, damit das leere Panel sichtbar geprüft werden kann
    await page.route('**/api/aufgaben/3/verlauf', async route => { await new Promise(r => setTimeout(r, 400)); await route.continue(); });
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#reiterpanel-verlauf .vh-laedt')).toHaveText('lädt …');
    expect(await page.locator('#reiterpanel-verlauf').innerText()).not.toContain('Eingang → In Arbeit');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #3' })).toBeVisible();
    await expect(page.locator('#reiterpanel-verlauf tbody tr')).toHaveCount(1);
    await expect(page.locator('#reiterpanel-verlauf')).toContainText('erstellt');
    expect(await page.locator('#reiterpanel-verlauf').innerText()).not.toContain('Eingang → In Arbeit');
  });

  test('US-8: Ladezustand „lädt …“ und Fehlerzustand (role=alert) — nie Zeilen der vorigen Aufgabe', async ({ page }) => {
    const fenster = await fensterAusListe(page, 2);
    await page.route('**/api/aufgaben/*/verlauf', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ fehler: 'Git nicht erreichbar' }) });
    });
    await fenster.getByRole('tab', { name: 'Verlauf' }).click();
    await expect(fenster.locator('.vh-laedt')).toHaveText('lädt …');
    await expect(fenster.locator('#reiterpanel-verlauf [role=alert]')).toContainText('Git nicht erreichbar');
    await expect(zeilen(fenster)).toHaveCount(0);
  });

  test('US-6 Leerzustand: eine noch nicht committete Aufgabe zeigt „Kein Verlauf …“', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    // direkt auf die Platte, ohne Commit — die Aufgabe steht in keiner Fassung
    k.schreib('aufgaben/0009-neun.md', aufgabe(9, 'neun'));
    k.schreib('boards/fabrik.md', board([3], [2], [9]));
    await expect(page.locator('.ka[data-id="9"]')).toBeVisible();
    await page.locator('.ka[data-id="9"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #9' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Aufgabe #9' }).getByRole('tab', { name: 'Verlauf' }).click();
    await expect(page.locator('#reiterpanel-verlauf .vh-leer')).toHaveText('Kein Verlauf — diese Aufgabe steht noch in keiner Fassung.');
    await expect(zeilen(page.getByRole('dialog', { name: 'Aufgabe #9' }))).toHaveCount(0);
  });

  test('US-6 Fremdautor: ein von Hand committeter Zug erscheint mit dem Git-Namen „Extern“', async ({ page }) => {
    await k.stoppen();
    k = await kanbanStarten(fremdBestand);
    const fenster = await fensterAusListe(page, 2);
    await fenster.getByRole('tab', { name: 'Verlauf' }).click();
    await expect(fenster.locator('#reiterpanel-verlauf')).toContainText('Extern');
    await expect(zeilen(fenster).first()).toContainText('11.10.2026 09:00');
    await expect(zeilen(fenster).first()).toContainText('Extern');
  });

  test('Kultur und Breite: Reiter ≥ 24 px, 375/320/414 px ohne Querscrollen, Zeit mit Jahr', async ({ page }) => {
    for (const breite of [375, 320, 414]) {
      await page.setViewportSize({ width: breite, height: 820 });
      const fenster = await fensterAusListe(page, 1);
      await fenster.getByRole('tab', { name: 'Verlauf' }).click();
      await expect(zeilen(fenster).first()).toContainText('2026');
      const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(quer, `Querscrollen bei ${breite}`).toBeLessThanOrEqual(0);
      const hoehe = await fenster.getByRole('tab', { name: 'Verlauf' }).evaluate(el => el.getBoundingClientRect().height);
      expect(hoehe).toBeGreaterThanOrEqual(24);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toHaveCount(0);
    }
  });
});
