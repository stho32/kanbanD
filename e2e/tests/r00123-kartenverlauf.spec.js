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

/** Ein Commit mit fester Autor-Zeit und Git-Identität; `wer` ohne `@` wird `<wer>@kanbanD` (wie die AK-Probe). */
function verfassen(ordner, datum, wer, nachricht) {
  spawnSync('git', ['-C', ordner, 'add', '-A'], { encoding: 'utf8' });
  const email = wer.includes('@') ? wer : `${wer}@kanbanD`;
  const name = wer.includes('@') ? 'Extern' : `Name ${wer}`;
  const r = spawnSync('git', ['-C', ordner, 'commit', '-q', '-m', nachricht], {
    encoding: 'utf8',
    env: { ...process.env, GIT_AUTHOR_DATE: `${datum}T09:00:00`, GIT_COMMITTER_DATE: `${datum}T09:00:00`, GIT_AUTHOR_NAME: name, GIT_AUTHOR_EMAIL: email, GIT_COMMITTER_NAME: name, GIT_COMMITTER_EMAIL: email },
  });
  if (r.status !== 0) throw new Error(`Commit ${nachricht}: ${r.stderr}`);
}

/** AK „Mehrere Boards“: #1 zusätzlich auf „privat“ gelegt (07.10.) und dort bewegt (08.10.) — gemischt mit der fabrik-Folge. */
function mehrereBoardsBestand(ordner) {
  verlaufBestand(ordner);
  const privat = nummern => `# privat\n\n## Ideen\n\n${nummern.map(n => `- #${n}`).join('\n')}\n\n## Erledigt\n`;
  fs.writeFileSync(path.join(ordner, 'boards/privat.md'), privat([1]));
  verfassen(ordner, '2026-10-07', 'st', '#1 auf privat gelegt');
  fs.writeFileSync(path.join(ordner, 'boards/privat.md'), '# privat\n\n## Ideen\n\n\n## Erledigt\n\n- #1\n');
  verfassen(ordner, '2026-10-08', 'st', '#1 auf privat nach Erledigt');
}

/** Datum `TT.MM.JJJJ`-fähig: `JJJJ-MM-TT`, `n` Tage nach dem 01.01.2026 (feste, aufsteigende Commit-Zeiten). */
const tagPlus = n => { const d = new Date(2026, 0, 1); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** Nicht-funktionale Probe: #9 auf fünf Boards je 20-mal bewegt — rund 100 Verlaufs-Einträge über 5 Boards. */
function grosserBestand(ordner) {
  const b = (i, spalte) => `# b${i}\n\n## A\n\n${spalte === 'A' ? '- #9\n' : '\n'}## B\n\n${spalte === 'B' ? '- #9\n' : '\n'}`;
  fs.mkdirSync(path.join(ordner, 'boards'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'aufgaben'), { recursive: true });
  fs.writeFileSync(path.join(ordner, 'kanbanD.md'), KANBAND);
  for (let i = 1; i <= 5; i++) fs.writeFileSync(path.join(ordner, `boards/b${i}.md`), b(i, 'A'));
  fs.writeFileSync(path.join(ordner, 'aufgaben/0009-neun.md'), aufgabe(9, 'neun'));
  spawnSync('git', ['-C', ordner, 'init', '-q'], { encoding: 'utf8' });
  verfassen(ordner, '2020-01-01', 'st', 'eingerichtet');
  let n = 0;
  for (let i = 1; i <= 5; i++) {
    for (let k = 0; k < 20; k++) {
      fs.writeFileSync(path.join(ordner, `boards/b${i}.md`), b(i, k % 2 === 0 ? 'B' : 'A'));
      verfassen(ordner, tagPlus(n), 'st', `#9 auf b${i}`);
      n++;
    }
  }
}

async function fensterAusListe(page, nr) {
  await page.goto(k.adresse + '#/aufgaben');
  await liveBereit(page);
  await page.locator(`tr[data-zeile="${nr}"] a`).click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nr}` });
  await fenster.waitFor();
  return fenster;
}
const zeilen = fenster => fenster.locator('.mod-body[data-ansicht="verlauf"] tbody tr');
/** Wählt im Aufgabenfenster die Ansicht „Verlauf“ (R00145: ein Menü statt der Reiterleiste). */
async function verlaufZeigen(page, fenster) {
  await fenster.locator('[data-act="fenster-menue"][data-arg="ansicht"]').click();
  await page.locator('#fenster [role="menu"][data-art="ansicht"]').getByRole('menuitemradio', { name: 'Verlauf', exact: true }).click();
}

let k;
test.describe('R00123', () => {
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(verlaufBestand); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-1/US-3/US-4: der Reiter zeigt sechs Einträge, neueste oben, Zeit mit Jahr, Art als Wort, „—“ in leeren Zellen', async ({ page }) => {
    const fenster = await fensterAusListe(page, 1);
    await verlaufZeigen(page, fenster);
    await expect(fenster.locator('.mod-body[data-ansicht="verlauf"] table')).toBeVisible();
    await expect(fenster.locator('.mod-body[data-ansicht="verlauf"] th[scope="col"]')).toHaveText(['Zeit', 'Art', 'von → nach', 'Board', 'Wer']);
    const inhalt = await zeilen(fenster).evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())));
    expect(inhalt).toEqual([
      ['06.10.2026 09:00', 'bewegt', 'Fertig → vom Board genommen', 'fabrik', 'SHStefan'],
      ['05.10.2026 09:00', 'zurückgeholt', '—', '—', 'SHStefan'],
      ['04.10.2026 09:00', 'archiviert', '—', '—', 'SHStefan'],
      ['03.10.2026 09:00', 'bewegt', 'In Arbeit → Fertig', 'fabrik', 'CLClaude'],
      ['02.10.2026 09:00', 'bewegt', 'Eingang → In Arbeit', 'fabrik', 'CLClaude'],
      ['01.10.2026 09:00', 'erstellt', '—', '—', 'SHStefan'],
    ]);
    await expect(fenster.locator('.mod-body[data-ansicht="verlauf"] .vh-hin')).toContainText('liest nur · gerechnet aus der Git-Geschichte');
  });

  test('Ansichtsmenü: „Verlauf“ ist der letzte Eintrag', async ({ page }) => {
    const fenster = await fensterAusListe(page, 1);
    await fenster.locator('[data-act="fenster-menue"][data-arg="ansicht"]').click();
    const namen = await page.locator('#fenster [role="menu"][data-art="ansicht"] .fm-text').allInnerTexts();
    expect(namen.at(-1)).toBe('Verlauf');
    await expect(page.locator('#fenster [role="menu"][data-art="ansicht"]').getByRole('menuitemradio', { name: 'Verlauf', exact: true })).toHaveCount(1);
  });

  test('US-6: nur gelesen — Datei und git log unverändert, kein Datenblock', async ({ page }) => {
    const vorherDatei = k.lies('aufgaben/0001-eins.md'), vorherLog = k.git('log', '--oneline');
    const fenster = await fensterAusListe(page, 1);
    await verlaufZeigen(page, fenster);
    await expect(zeilen(fenster)).toHaveCount(6);
    expect(k.lies('aufgaben/0001-eins.md')).toBe(vorherDatei);
    expect(k.git('log', '--oneline')).toBe(vorherLog);
    expect(k.lies('aufgaben/0001-eins.md')).not.toMatch(/kanbanD-log|kanbanD-verlauf/);
  });

  test('US-7: #1 schließen, #2 mit gewähltem Verlauf öffnen — das Panel leert sich und zeigt nur den Verlauf der neuen Aufgabe', async ({ page }) => {
    const fenster = await fensterAusListe(page, 1);
    await verlaufZeigen(page, fenster);
    await expect(zeilen(fenster)).toHaveCount(6);
    await expect(fenster.locator('.mod-body[data-ansicht="verlauf"]')).toContainText('Fertig → vom Board genommen');
    await page.keyboard.press('Escape');
    // das Laden der neuen Aufgabe verzögern, damit das leere Panel sichtbar geprüft werden kann
    await page.route('**/api/aufgaben/2/verlauf', async route => { await new Promise(r => setTimeout(r, 400)); await route.continue(); });
    await page.locator('tr[data-zeile="2"] a').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
    await expect(page.locator('.mod-body[data-ansicht="verlauf"] .vh-laedt')).toHaveText('lädt …');
    expect(await page.locator('.mod-body[data-ansicht="verlauf"]').innerText()).not.toContain('Fertig → vom Board genommen');
    await expect(page.locator('.mod-body[data-ansicht="verlauf"] tbody tr')).toHaveCount(2);
    await expect(page.locator('.mod-body[data-ansicht="verlauf"]')).toContainText('Eingang → In Arbeit');
  });

  test('US-8: Ladezustand „lädt …“ und Fehlerzustand (role=alert) — nie Zeilen der vorigen Aufgabe', async ({ page }) => {
    const fenster = await fensterAusListe(page, 2);
    await page.route('**/api/aufgaben/*/verlauf', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ fehler: 'Git nicht erreichbar' }) });
    });
    await verlaufZeigen(page, fenster);
    await expect(fenster.locator('.vh-laedt')).toHaveText('lädt …');
    await expect(fenster.locator('.mod-body[data-ansicht="verlauf"] [role=alert]')).toContainText('Git nicht erreichbar');
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
    await verlaufZeigen(page, page.getByRole('dialog', { name: 'Aufgabe #9' }));
    await expect(page.locator('.mod-body[data-ansicht="verlauf"] .vh-leer')).toHaveText('Kein Verlauf — diese Aufgabe steht noch in keiner Fassung.');
    await expect(zeilen(page.getByRole('dialog', { name: 'Aufgabe #9' }))).toHaveCount(0);
  });

  test('US-6 Fremdautor: ein von Hand committeter Zug erscheint mit dem Git-Namen „Extern“', async ({ page }) => {
    await k.stoppen();
    k = await kanbanStarten(fremdBestand);
    const fenster = await fensterAusListe(page, 2);
    await verlaufZeigen(page, fenster);
    await expect(fenster.locator('.mod-body[data-ansicht="verlauf"]')).toContainText('Extern');
    await expect(zeilen(fenster).first()).toContainText('11.10.2026 09:00');
    await expect(zeilen(fenster).first()).toContainText('Extern');
  });

  test('Kultur und Breite: Reiter ≥ 24 px, 375/320/414 px ohne Querscrollen, Zeit mit Jahr', async ({ page }) => {
    for (const breite of [375, 320, 414]) {
      await page.setViewportSize({ width: breite, height: 820 });
      const fenster = await fensterAusListe(page, 1);
      await verlaufZeigen(page, fenster);
      await expect(zeilen(fenster).first()).toContainText('2026');
      const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(quer, `Querscrollen bei ${breite}`).toBeLessThanOrEqual(0);
      const hoehe = await page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]').evaluate(el => el.getBoundingClientRect().height);
      expect(hoehe).toBeGreaterThanOrEqual(24);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toHaveCount(0);
    }
  });

  test('AK Live: eine neue Bewegung erscheint ≤ 1 s oben im geöffneten Verlauf (D00005)', async ({ page }) => {
    const fenster = await fensterAusListe(page, 2);
    await verlaufZeigen(page, fenster);
    await expect(zeilen(fenster)).toHaveCount(2);
    await liveBereit(page);
    const antwort = await page.request.post(k.adresse + 'api/boards/fabrik/bewegen', { headers: { 'X-KanbanD-Wer': 'st' }, data: { nummer: 2, spalte: 'Fertig' } });
    expect(antwort.ok(), await antwort.text()).toBe(true);
    await expect(zeilen(fenster).first()).toContainText('In Arbeit → Fertig', { timeout: 1000 });
    await expect(zeilen(fenster).first()).toContainText('fabrik');
  });

  test('AK mehrere Boards: eine Karte auf zwei Boards — jeder Bewegungseintrag nennt sein Board, zeitlich gemischt', async ({ page }) => {
    await k.stoppen();
    k = await kanbanStarten(mehrereBoardsBestand);
    const fenster = await fensterAusListe(page, 1);
    await verlaufZeigen(page, fenster);
    await expect(zeilen(fenster).first()).toBeVisible();
    const inhalt = await zeilen(fenster).evaluateAll(trs => trs.map(tr => [...tr.children].map(td => td.textContent.replace(/\s+/g, ' ').trim())));
    const bewegungen = inhalt.filter(r => r[1] === 'bewegt');
    const boards = bewegungen.map(r => r[3]);
    expect(new Set(boards)).toEqual(new Set(['fabrik', 'privat']), 'beide Bewegungsfolgen genannt');
    // zeitlich gemischt: privat (07./08.10.) steht über dem letzten fabrik-Zug (06.10.)
    expect(bewegungen[0]).toEqual(['08.10.2026 09:00', 'bewegt', 'Ideen → Erledigt', 'privat', 'STStefan']);
    expect(bewegungen[1]).toEqual(['07.10.2026 09:00', 'bewegt', 'auf das Board gelegt → Ideen', 'privat', 'STStefan']);
    expect(bewegungen[2]).toEqual(['06.10.2026 09:00', 'bewegt', 'Fertig → vom Board genommen', 'fabrik', 'SHStefan']);
  });

  test('Nicht-funktional: 100 Verlaufs-Einträge über 5 Boards werden in unter 200 ms gezeichnet', async ({ page }) => {
    await k.stoppen();
    k = await kanbanStarten(grosserBestand);
    const fenster = await fensterAusListe(page, 9);
    await verlaufZeigen(page, fenster);
    await expect(zeilen(fenster).first()).toBeVisible();
    expect(await zeilen(fenster).count()).toBeGreaterThanOrEqual(100);
    // Zeichnen der 100 Zeilen im Browser (AK) — das ist die stabile Größe (r00100-Muster). Das Lesen über die
    // Git-Historie ist funktional belegt (>= 100 Zeilen aus dem Endpunkt) und wird als Rechnung im Rust-Test
    // `kartenverlauf_leistung_100_eintraege` gegen dieselbe Grenze geprüft; als Wanduhr-Gate taugt es unter Last nicht.
    const ms = await page.evaluate(() => {
      const t0 = performance.now();
      document.querySelector('.mod-body[data-ansicht="verlauf"]').innerHTML = vVerlaufPanel();
      if (!document.querySelector('.mod-body[data-ansicht="verlauf"] table')) throw new Error('keine Tabelle');
      return performance.now() - t0;
    });
    expect(ms, `${ms.toFixed(1)} ms`).toBeLessThan(200);
  });
});
