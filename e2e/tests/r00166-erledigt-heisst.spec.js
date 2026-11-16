// R00166 „Erledigt heißt“ je Board — gilt für Burndown, Durchsatz und Fever Chart (ADR-0027 N2, Karte #156)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');
const { arbeitsRepository, mitRegister, wbsText, zeile } = require('./wbs-hilfen');

/* ── Treiber: Ordner mit datierter Geschichte ── */
/** Schreibt Dateien und hält den Stand als Commit mit diesem Datum fest. */
function standAm(ordner, datum, dateien) {
  for (const [rel, inhalt] of Object.entries(dateien)) fs.writeFileSync(path.join(ordner, rel), inhalt);
  execFileSync('git', ['-C', ordner, 'add', '-A']);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const BOARD = 'boards/fabrik.md';
const zeilen = nummern => nummern.map(n => `- #${n}\n`).join('');
const datei = n => `aufgaben/${String(n).padStart(4, '0')}-a${n}.md`;
const aufgabe = n => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n---\n`;

/* ── Testsprache: das Rechenbeispiel der Anforderung ── */
/** Board A · B · C · Erledigt: 02.11. #1 bis #3 in A angelegt; 03.11. #1 und #2 nach B, #3 nach Erledigt; 04.11. #1 weiter
    nach C, #2 zurück nach A. `kopf` ist der Kopf der Board-Datei (leer = keine Zielspalte gespeichert). */
const rechenbeispiel = (kopf = '') => ordner => {
  const board = (a, b, c, erledigt) => `${kopf}# fabrik\n\n## A\n\n${zeilen(a)}\n## B\n\n${zeilen(b)}\n## C\n\n${zeilen(c)}\n## Erledigt\n\n${zeilen(erledigt)}`;
  einrichten({ ...Object.fromEntries([1, 2, 3].map(n => [datei(n), aufgabe(n)])), [BOARD]: board([], [], [], []) })(ordner);
  standAm(ordner, '2026-11-02T09:00:00', { [BOARD]: board([1, 2, 3], [], [], []) });
  standAm(ordner, '2026-11-03T09:00:00', { [BOARD]: board([], [1, 2], [], [3]) });
  standAm(ordner, '2026-11-04T09:00:00', { [BOARD]: board([2], [], [1], [3]) });
};
const mitZielspalte = name => `---\nfever: {target-column: ${name}}\n---\n\n`;
/** Die Zahlen der Anforderung je Tag 02.–04.11.: Burndown als „offen · Umfang · + · − erledigt · − entfernt“, Durchsatz je Tag. */
const OHNE_WAHL = { burndown: [['3', '3', '3', '0', '0'], ['2', '3', '0', '1', '0'], ['2', '3', '0', '0', '0']], durchsatz: ['0', '1', '0'] };
const ZIELSPALTE_B = { burndown: [['3', '3', '3', '0', '0'], ['0', '3', '0', '3', '0'], ['1', '3', '1', '0', '0']], durchsatz: ['0', '3', '0'] };

/* ── Treiber: Oberfläche ── */
/** Öffnet einen Bericht des Boards „fabrik“ am 04.11.2026, 12:00 Uhr (ADR-0026 Regel 6: feste Browser-Uhr). */
async function berichtAm0411(page, k, route) {
  await alsPerson(page, 'st');
  await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00'));
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await bereit(page, '#main .leiste');
}
/** Wechselt in derselben Sitzung den Bericht. */
async function zumBericht(page, k, route) {
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await bereit(page, '#main .leiste');
  await expect(page).toHaveURL(new RegExp(`#/berichte/${route}$`));
}
const zellen = (ort, zelle) => ort.evaluateAll((trs, zelle) => trs.map(tr => [...tr.querySelectorAll(zelle)].map(td => td.textContent.trim())), zelle);
/** Tabellenansicht des Burndowns ohne die Tagesspalte: je Tag offen, Umfang, +, − erledigt, − entfernt. */
const burndownJeTag = async page => (await zellen(page.locator('.bd-tabelle tbody tr'), 'td')).map(zeile => zeile.slice(1));
/** Durchsatz je Tag aus der Tabellenansicht (Auflösung „je Tag“ gewählt). */
async function durchsatzJeTag(page) {
  await page.getByRole('radio', { name: 'je Tag' }).click();
  await expect(page.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
  return (await zellen(page.locator('.fluss-tab tbody tr'), 'td')).map(zeile => zeile[1]);
}
async function erwarteZahlen(page, k, zahlen) {
  await zumBericht(page, k, 'verlauf');
  await expect.poll(() => burndownJeTag(page)).toEqual(zahlen.burndown);
  await zumBericht(page, k, 'durchsatz');
  expect(await durchsatzJeTag(page)).toEqual(zahlen.durchsatz);
}

/* ── F0129 Rechnung mit Zielspalte ── */
test('R00166 AK 7 (B0806): ohne gespeicherte Zielspalte zeigen Burndown und Durchsatz die Zahlen „ohne Wahl“, die Board-Datei bleibt, wie sie ist', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    const [vorher, commits] = [k.lies(BOARD), k.git('rev-list', '--count', 'HEAD')];
    await berichtAm0411(page, k, 'verlauf');
    await erwarteZahlen(page, k, OHNE_WAHL);
    expect(k.lies(BOARD)).toBe(vorher);
    expect(k.lies(BOARD)).not.toContain('fever');
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  } finally { await k.stoppen(); }
});

test('R00166 AK 1–3, AK 6 (B0806): eine Board-Datei mit `fever: {target-column: B}` wirkt ohne Handgriff — Burndown „− erledigt“ 0·3·0 bei offen 3·0·1, Durchsatz 0·3·0, das Fever Chart nennt „B“', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await erwarteZahlen(page, k, ZIELSPALTE_B);
    await zumBericht(page, k, 'fieber');
    await expect(page.getByLabel('Erledigt heißt')).toHaveValue('B');
  } finally { await k.stoppen(); }
});

test('R00166 AK 8 (B0806): Kumulativer Fluss, Durchlaufzeit und „Wie lange noch“ zeigen mit Zielspalte B dasselbe wie ohne — „fertig“ am 03.11. bleibt 1', async ({ browser }) => {
  const seiteZu = async kopf => {
    const k = await kanbanStarten(rechenbeispiel(kopf)), kontext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    return { k, kontext, page: await kontext.newPage() };
  };
  const ohne = await seiteZu(''), mit = await seiteZu(mitZielspalte('B'));
  try {
    await berichtAm0411(ohne.page, ohne.k, 'fluss');
    await berichtAm0411(mit.page, mit.k, 'fluss');
    const fertigAm0311 = async page => (await zellen(page.locator('.fluss-tab tbody tr'), 'td'))[1].slice(-1);
    expect(await fertigAm0311(mit.page)).toEqual(['1']);
    for (const route of ['fluss', 'durchlauf', 'prognose']) {
      await zumBericht(ohne.page, ohne.k, route);
      await zumBericht(mit.page, mit.k, route);
      const [textOhne, textMit] = await Promise.all([ohne.page, mit.page].map(page => page.locator('#main').innerText()));
      expect(textMit.length, route).toBeGreaterThan(40);
      expect(textMit, route).toBe(textOhne);
    }
    await expect(mit.page.locator('#main')).toContainText('Abschlussspalte');
  } finally {
    for (const x of [ohne, mit]) { await x.kontext.close(); await x.k.stoppen(); }
  }
});

/* ── F0130 Auswahl in beiden Kopfleisten (Zeichnung D0006 #erledigt-heisst) ── */
const GILT_FUER = 'gilt für Burndown, Durchsatz und Fever Chart dieses Boards';
const auswahl = page => page.getByRole('combobox', { name: 'Erledigt heißt' });
const gruppe = page => page.getByRole('group', { name: 'Erledigt heißt' });
const eintraege = page => auswahl(page).locator('option').evaluateAll(optionen => optionen.map(o => [o.textContent, o.value, o.selected]));
const oberkante = async ort => (await ort.boundingBox()).y;

/** Board mit Phasen (Entwicklung → Entwicklertest → Abnahme), gebunden an die Anwendung des Registers; #1 und #2 am 02.11. in
    „Entwicklung“, #1 am 03.11. nach „Erledigt“. `kopfzeile` ergänzt den Kopf der Board-Datei. */
function phasenBoard(arbeit, kopfzeile = '') {
  const kopf = `---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\n${kopfzeile}---\n\n# Entwicklung\n`;
  const board = spalten => kopf + ['Backlog', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'].map(sp => `\n## ${sp}\n\n${zeilen(spalten[sp] || [])}`).join('');
  return ordner => {
    mitRegister(arbeit, { ...Object.fromEntries([1, 2].map(n => [datei(n), aufgabe(n)])), 'boards/entwicklung.md': board({}) })(ordner);
    standAm(ordner, '2026-11-02T09:00:00', { 'boards/entwicklung.md': board({ Entwicklung: [1, 2] }) });
    standAm(ordner, '2026-11-03T09:00:00', { 'boards/entwicklung.md': board({ Entwicklung: [2], Erledigt: [1] }) });
  };
}
async function phasenBerichtAm0411(page, k, route) {
  await alsPerson(page, 'st');
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00'));
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await bereit(page, '#main .leiste');
}

test('R00166 AK 4 (B0807): der Burndown zeigt „Erledigt heißt“ mit den Blöcken des Fever Charts und dem Geltungssatz — zwischen Berichtsfilter und Kennzahlzeile', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'verlauf');
    expect(await eintraege(page)).toEqual([['Spalte „B“', 'B', false], ['Spalte „C“', 'C', false], ['Spalte „Erledigt“ (Standard)', '', true]]);
    await expect(gruppe(page)).toContainText(`Erledigt heißt`);
    await expect(gruppe(page).locator('.muted')).toHaveText(GILT_FUER);
    await expect(gruppe(page)).toHaveClass('fb-einst');
    const [filter, wahl, kennzahl] = await Promise.all([page.locator('.bfilter-box'), gruppe(page), page.locator('#bd-kennzahl')].map(oberkante));
    expect(filter).toBeLessThan(wahl);
    expect(wahl).toBeLessThan(kennzahl);
    expect(await gruppe(page).evaluate(g => g.parentElement.className)).toBe('body bericht');
    expect(await gruppe(page).evaluate(g => g.previousElementSibling), 'erste Zeile in .body.bericht').toBeNull();
  } finally { await k.stoppen(); }
});

test('R00166 AK 4 (B0807): der Durchsatz zeigt dieselbe Auswahl an derselben Stelle — vor „Gesamt“, über dem Umschalter „Auflösung“, auch über dem Leerzustand', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    expect(await eintraege(page)).toEqual([['Spalte „B“', 'B', false], ['Spalte „C“', 'C', false], ['Spalte „Erledigt“ (Standard)', '', true]]);
    await expect(gruppe(page).locator('.muted')).toHaveText(GILT_FUER);
    const [filter, wahl, kennzahl, aufloesung] = await Promise.all([page.locator('.bfilter-box'), gruppe(page), page.locator('#dus-kennzahl'), page.locator('.dus-um')].map(oberkante));
    expect(filter).toBeLessThan(wahl);
    expect(wahl).toBeLessThan(kennzahl);
    expect(kennzahl).toBeLessThan(aufloesung);
    await expect(page.locator('#main .leiste').first()).toHaveText('Durchsatz je Zeitraum · erledigte Aufgaben je Periode');
    // Leerzustand: am 02.11. hat noch keine Aufgabe das Ziel erreicht
    await page.clock.setFixedTime(new Date('2026-11-02T12:00:00+01:00'));
    await page.reload();
    await bereit(page, '.fluss-satz');
    await expect(page.locator('.fluss-satz')).toHaveText('Keine Aufgabe im Zeitraum.');
    expect(await oberkante(gruppe(page))).toBeLessThan(await oberkante(page.locator('.fluss-satz')));
  } finally { await k.stoppen(); }
});

test('R00166 AK 4, AK 6 (B0807): eine gespeicherte Zielspalte ist in Burndown und Durchsatz vorbelegt; das Fever Chart trägt denselben Geltungssatz', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await expect(auswahl(page)).toHaveValue('B');
    await zumBericht(page, k, 'durchsatz');
    await expect(auswahl(page)).toHaveValue('B');
    await zumBericht(page, k, 'fieber');
    await expect(auswahl(page)).toHaveValue('B');
    await expect(page.locator('.fb-einst > .muted')).toHaveText(GILT_FUER);
    expect(await page.locator('.fb-einst > .muted').evaluate(e => [getComputedStyle(e).fontSize, e.previousElementSibling.textContent.startsWith('Erledigt heißt')])).toEqual(['12px', true]);
  } finally { await k.stoppen(); }
});

test.describe('R00166 Board mit Phasen', () => {
  let k, arbeit;
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('R00166 AK 4 (B0807): auf einem Board mit Phasen sind die Einträge in Burndown und Durchsatz die Blöcke „… durchlaufen“', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    k = await kanbanStarten(phasenBoard(arbeit));
    const BLOECKE = [['Entwicklung durchlaufen', 'Entwicklung', false], ['Entwicklertest durchlaufen', 'Entwicklertest', false], ['Abnahme durchlaufen (Standard)', '', true]];
    await phasenBerichtAm0411(page, k, 'verlauf');
    expect(await eintraege(page)).toEqual(BLOECKE);
    await page.goto(`${k.adresse}#/berichte/durchsatz`);
    await bereit(page, '#dus-kennzahl');
    expect(await eintraege(page)).toEqual(BLOECKE);
  });
});
