// R00169 Kumulativer Fluss und Durchlaufzeit folgen der Zielspalte des Boards (ADR-0027 N5, Karte #159)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen } = require('./hilfen');
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
const OHNE_ERLEDIGT = '---\nreport-filter: {exclude-columns: [Erledigt]}\n---\n\n';
/** Die Zahlen der Anforderung je Tag 02.–04.11. — Burndown „offen · Umfang“, Fluss „Bänder · offen · gesamt · angekommen · fertig“. */
const BAENDER = [['3', '0', '0', '0'], ['0', '2', '0', '1'], ['1', '0', '1', '1']];
const OHNE_WAHL = { burndown: [['3', '3'], ['2', '3'], ['2', '3']], fluss: [['3', '3', '3', '0'], ['2', '3', '3', '1'], ['2', '3', '3', '1']] };
const ZIELSPALTE_B = { burndown: [['3', '3'], ['0', '3'], ['1', '3']], fluss: [['3', '3', '3', '0'], ['0', '3', '3', '3'], ['1', '3', '3', '3']] };

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
/** Tabellenansicht des Burndowns: je Tag offen und Umfang. */
const burndownJeTag = async page => (await zellen(page.locator('.bd-tabelle tbody tr'), 'td')).map(z => z.slice(1, 3));
/** Tabellenansicht des Flusses: je Tag die Bänder und die vier Ränder offen · gesamt · angekommen · fertig. */
async function flussJeTag(page) {
  const jeTag = (await zellen(page.locator('.fluss-tab tbody tr'), 'td')).map(z => z.slice(1));
  return { baender: jeTag.map(z => z.slice(0, -4)), raender: jeTag.map(z => z.slice(-4)) };
}
const auswahl = page => page.getByRole('combobox', { name: 'Erledigt heißt' });
const gruppe = page => page.getByRole('group', { name: 'Erledigt heißt', exact: true });
const eintraege = page => auswahl(page).locator('option').evaluateAll(optionen => optionen.map(o => [o.textContent, o.value, o.selected]));
const kopfleiste = page => page.locator('#main .leiste').first();
const legende = page => page.locator('.fluss-leg .fluss-le');
const oberkante = async ort => (await ort.boundingBox()).y;
/** Wählt einen Eintrag von „Erledigt heißt“ und wartet, bis die Wahl gespeichert, nachgeladen und gezeichnet ist — gewartet
    wird auf das Nachladen, das NACH der Antwort auf das Speichern beginnt (Vorbild `waehle` in r00167-von-spalte.spec.js). */
async function waehle(page, eintrag, wert) {
  let gespeichert = false, nachgeladen = null;
  const beiAntwort = antwort => { if (antwort.request().method() === 'PUT' && antwort.url().endsWith('/fieber')) gespeichert = true; };
  const beiAnfrage = anfrage => { if (gespeichert && !nachgeladen && anfrage.method() === 'GET' && anfrage.url().includes('/api/berichte/bewegungen')) nachgeladen = anfrage; };
  page.on('response', beiAntwort);
  page.on('request', beiAnfrage);
  try {
    await auswahl(page).selectOption({ label: eintrag });
    await expect.poll(() => nachgeladen !== null, 'Nachladen nach dem Speichern').toBe(true);
    await (await nachgeladen.response()).finished();
  } finally {
    page.off('response', beiAntwort);
    page.off('request', beiAnfrage);
  }
  await bereit(page);
  await expect(auswahl(page)).toHaveValue(wert);
}
const commitsSeit = (k, stand) => k.git('log', '--format=%an|%s', `${stand}..HEAD`).split('\n').filter(Boolean).filter(c => !c.startsWith('kanbanD|'));
/** Legt ein Bildschirmfoto ab, wenn der Lauf einen Ordner dafür nennt (`R00169_BILDER`) — für den Bericht an den Director. */
async function bild(page, name) {
  if (process.env.R00169_BILDER) await page.screenshot({ path: path.join(process.env.R00169_BILDER, name), fullPage: true });
}
const GILT_FUER = 'gilt für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards';
const GILT_FUER_IM_DURCHSATZ = '„Zugang ab“ gilt nur für den Durchsatz, „Erledigt heißt“ für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards';

/* ── F0134 Kumulativer Fluss folgt der Zielspalte ── */
test('R00169 AK 1 (B0826): ohne gespeicherte Zielspalte zeigt der Fluss „offen“ 3·2·2 und „fertig“ 0·1·1; Kopfleiste und Legende nennen keinen Block, „liest nur“ ist entfallen, die Board-Datei bleibt', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    const [vorher, commits] = [k.lies(BOARD), k.git('rev-list', '--count', 'HEAD')];
    await berichtAm0411(page, k, 'fluss');
    expect(await flussJeTag(page)).toEqual({ baender: BAENDER, raender: OHNE_WAHL.fluss });
    await expect(kopfleiste(page)).toHaveText('Kumulativer Fluss · Bestand je Spalte über die Zeit');
    await expect(legende(page)).toHaveText(['A', 'B', 'C', 'Erledigt', 'angekommen', 'fertig']);
    await expect(page.locator('#fb-ziel-filter')).toHaveCount(0);
    await zumBericht(page, k, 'verlauf');
    await expect.poll(() => burndownJeTag(page)).toEqual(OHNE_WAHL.burndown);
    expect(k.lies(BOARD)).toBe(vorher);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  } finally { await k.stoppen(); }
});

test('R00169 US-1, AK 2, AK 4 (B0826): mit `fever: {target-column: B}` nennen Burndown und Fluss „offen“ 3·0·1, „Umfang“ und „gesamt“ 3·3·3; am 04.11. stehen die Bänder A 1 · B 0 · C 1 · Erledigt 1', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await expect.poll(() => burndownJeTag(page)).toEqual(ZIELSPALTE_B.burndown);
    await zumBericht(page, k, 'fluss');
    const fluss = await flussJeTag(page);
    expect(fluss).toEqual({ baender: BAENDER, raender: ZIELSPALTE_B.fluss });
    expect(fluss.raender.map(([offen, gesamt]) => [offen, gesamt]), 'dieselben zwei Zahlen wie im Burndown').toEqual(ZIELSPALTE_B.burndown);
    expect(fluss.baender.map(([a]) => a), '„offen“ ist das Band links von B').toEqual(fluss.raender.map(([offen]) => offen));
    await expect(auswahl(page)).toHaveValue('B');
  } finally { await k.stoppen(); }
});

test('R00169 US-2, AK 3, AK 7a, AK 10 (B0826, Abnahme der Karte #159): die Wahl „B“ über dem Diagramm des Flusses hebt „fertig“ auf 0·3·3 — Kopfleiste und Legende nennen „B“, die Bänder und „Wie lange noch“ bleiben, ein Commit in der Board-Datei', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'prognose');
    const wieLangeNoch = await page.locator('#main').innerText();
    await zumBericht(page, k, 'fluss');
    expect(await eintraege(page)).toEqual([['Spalte „B“', 'B', false], ['Spalte „C“', 'C', false], ['Spalte „Erledigt“ (Standard)', '', true]]);
    expect((await flussJeTag(page)).raender.map(z => z[3])).toEqual(['0', '1', '1']);
    const vorDerWahl = k.git('rev-parse', 'HEAD');
    await waehle(page, 'Spalte „B“', 'B');
    expect(await flussJeTag(page)).toEqual({ baender: BAENDER, raender: ZIELSPALTE_B.fluss });
    await expect(kopfleiste(page)).toHaveText('Kumulativer Fluss · Bestand je Spalte über die Zeit · fertig heißt: in „B“ oder rechts davon');
    await expect(legende(page)).toHaveText(['A', 'B', 'C', 'Erledigt', 'angekommen', 'fertig (ab „B“)']);
    await expect(page.locator('.fluss-tab thead th')).toHaveText(['Tag', 'A', 'B', 'C', 'Erledigt', 'offen', 'gesamt', 'angekommen', 'fertig']);
    await expect(page.locator('svg.cfd text.randtext')).toHaveText(['angekommen 3', 'fertig 3']);
    await bild(page, 'fluss-zielspalte-b.png');
    expect(k.lies(BOARD)).toContain('fever: {target-column: B}\n');
    expect(commitsSeit(k, vorDerWahl)).toEqual([expect.stringMatching(/^Stefan\|.*erledigt heißt „B“$/)]);
    await zumBericht(page, k, 'prognose');
    expect(await page.locator('#main').innerText(), '„Wie lange noch“ zeigt dieselben Zahlen wie vor der Wahl').toBe(wieLangeNoch);
  } finally { await k.stoppen(); }
});

test('R00169 AK 7a (B0826): die Zeile „Erledigt heißt“ ist im Fluss die erste Zeile unter dem Berichtsfilter — über dem Diagramm und über dem Leerzustand; bei 375 px bricht sie um, ohne Querscrollen', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await berichtAm0411(page, k, 'fluss');
    await expect(gruppe(page)).toHaveClass('fb-einst');
    await expect(gruppe(page).locator('.muted')).toHaveText(GILT_FUER);
    expect(await gruppe(page).evaluate(g => [g.parentElement.className, g.previousElementSibling]), 'erste Zeile in .body.bericht').toEqual(['body bericht', null]);
    const [filter, wahl, diagramm] = await Promise.all([page.locator('.bfilter-box'), gruppe(page), page.locator('svg.cfd')].map(oberkante));
    expect(filter).toBeLessThan(wahl);
    expect(wahl).toBeLessThan(diagramm);
    await breiteSetzen(page, 375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'kein Querscrollen der Seite').toBe(true);
    const [beschriftung, feld] = await Promise.all([gruppe(page).locator('label'), auswahl(page)].map(o => o.boundingBox()));
    expect(feld.y, 'die Beschriftung bleibt bei ihrem Select').toBeLessThan(beschriftung.y + beschriftung.height);
    // Leerzustand: am 01.11. liegt noch keine Aufgabe auf dem Board
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00+01:00'));
    await page.reload();
    await bereit(page, '.fluss-satz');
    await expect(page.locator('.fluss-satz')).toHaveText('Keine Aufgabe im Zeitraum.');
    expect(await oberkante(gruppe(page))).toBeLessThan(await oberkante(page.locator('.fluss-satz')));
  } finally { await k.stoppen(); }
});

test('R00169 AK 7a (B0826): der Geltungssatz nennt in Burndown, Durchsatz, Fluss und Fever Chart den Kumulativen Fluss — im Durchsatz zusammengesetzt mit „Zugang ab“', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    for (const route of ['verlauf', 'fluss', 'fieber']) {
      await zumBericht(page, k, route);
      await expect(page.locator('.fb-einst > .muted').first(), route).toHaveText(GILT_FUER);
    }
    await zumBericht(page, k, 'durchsatz');
    await expect(page.locator('.fb-einst > .muted')).toHaveText(GILT_FUER_IM_DURCHSATZ);
  } finally { await k.stoppen(); }
});

const hinweisFilter = page => page.locator('#fb-ziel-filter');
/** Die Zeile im Randfall: der letzte sichtbare Block steht als „(Standard)“ gewählt da, der Hinweis folgt dem Geltungssatz —
    im Fever Chart (`geltung` null) steht er am Ende der Einstellungen, wo dort auch „gibt es nicht mehr“ steht. */
async function erwarteRandfall(page, geltung = GILT_FUER) {
  expect(await eintraege(page)).toEqual([['Spalte „B“', 'B', false], ['Spalte „C“ (Standard)', '', true]]);
  await expect(hinweisFilter(page)).toHaveText('„Erledigt“ ist im Filter ausgeschlossen — gerechnet wird mit „C“.');
  await expect(hinweisFilter(page)).toHaveClass('muted');
  if (geltung) expect(await hinweisFilter(page).evaluate(h => h.previousElementSibling.textContent)).toBe(geltung);
}

test('R00169 US-4, AK 8 (B0826): Spalte „Erledigt“ im Berichtsfilter ausgeschlossen, nichts gewählt — die Auswahl zeigt „C (Standard)“ samt Hinweis; Burndown und Fluss nennen „offen“ 3·2·1, der Durchsatz zählt am 04.11. eine Aufgabe', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(OHNE_ERLEDIGT));
  try {
    const vorher = k.lies(BOARD);
    await berichtAm0411(page, k, 'verlauf');
    await erwarteRandfall(page);
    await expect.poll(async () => (await burndownJeTag(page)).map(([offen]) => offen)).toEqual(['3', '2', '1']);
    await expect(page.locator('#main .leiste .muted').first()).toContainText('· erledigt = in „C“ oder rechts davon');
    await zumBericht(page, k, 'fluss');
    await erwarteRandfall(page);
    const fluss = await flussJeTag(page);
    expect(fluss.baender, 'die ausgeschlossene Spalte trägt kein Band').toEqual([['3', '0', '0', '0'], ['0', '2', '0', '0'], ['1', '0', '1', '0']]);
    expect(fluss.raender.map(([offen, , , fertig]) => [offen, fertig])).toEqual([['3', '0'], ['2', '1'], ['1', '2']]);
    await expect(kopfleiste(page)).toHaveText('Kumulativer Fluss · Bestand je Spalte über die Zeit · fertig heißt: in „C“ oder rechts davon');
    await expect(legende(page).last()).toHaveText('fertig (ab „C“)');
    await zumBericht(page, k, 'durchsatz');
    await erwarteRandfall(page, GILT_FUER_IM_DURCHSATZ);
    await page.getByRole('radio', { name: 'je Tag' }).click();
    await expect(page.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#main')).not.toContainText('ist ausgeschlossen.');
    expect((await zellen(page.locator('.fluss-tab tbody tr'), 'td')).map(z => z[z.length - 1]), 'Abgang je Tag: #3 am 03.11. direkt nach „Erledigt“, #1 am 04.11. nach C').toEqual(['0', '1', '1']);
    await expect(kopfleiste(page)).toHaveText('Durchsatz je Zeitraum · Zugang und Abgang je Periode · bis „C“');
    await zumBericht(page, k, 'fieber');
    await erwarteRandfall(page, null);
    expect(await hinweisFilter(page).evaluate(h => h.parentElement.className)).toBe('fb-einst');
    expect(k.lies(BOARD), 'gespeichert wird nichts').toBe(vorher);
  } finally { await k.stoppen(); }
});

test('R00169 AK 8 (B0826): mit gespeicherter Zielspalte steht bei ausgeschlossener Spalte „Erledigt“ kein Hinweis; ist die gespeicherte Wahl verschwunden, steht nur der Hinweis „gibt es nicht mehr“ — gerechnet wird mit „C“', async ({ page }) => {
  const kopf = zielspalte => `---\nfever: {target-column: ${zielspalte}}\nreport-filter: {exclude-columns: [Erledigt]}\n---\n\n`;
  const k = await kanbanStarten(rechenbeispiel(kopf('B')));
  const k2 = await kanbanStarten(rechenbeispiel(kopf('Abnahme')));
  try {
    await berichtAm0411(page, k, 'fluss');
    await expect(auswahl(page)).toHaveValue('B');
    await expect(hinweisFilter(page)).toHaveCount(0);
    await expect(legende(page).last()).toHaveText('fertig (ab „B“)');
    await zumBericht(page, k2, 'fluss');
    await expect(page.locator('#fb-ziel-weg')).toHaveText('Zielspalte „Abnahme“ gibt es nicht mehr — gerechnet wird mit „C“.');
    await expect(hinweisFilter(page)).toHaveCount(0);
    expect((await flussJeTag(page)).raender.map(([offen]) => offen)).toEqual(['3', '2', '1']);
  } finally { await k.stoppen(); await k2.stoppen(); }
});

/* ── Board mit Phasen (AK 9) ── */
/** Board mit Phasen (Entwicklung → Entwicklertest → Abnahme), gebunden an die Anwendung des Registers; #1 und #2 am 02.11. in
    „Entwicklung“, am 03.11. #1 nach „Abnahme“ und #2 nach „Entwicklertest“. `kopfzeile` ergänzt den Kopf der Board-Datei. */
function phasenBoard(arbeit, kopfzeile = '') {
  const kopf = `---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\n${kopfzeile}---\n\n# Entwicklung\n`;
  const board = spalten => kopf + ['Backlog', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'].map(sp => `\n## ${sp}\n\n${zeilen(spalten[sp] || [])}`).join('');
  return ordner => {
    mitRegister(arbeit, { ...Object.fromEntries([1, 2].map(n => [datei(n), aufgabe(n)])), 'boards/entwicklung.md': board({}) })(ordner);
    standAm(ordner, '2026-11-02T09:00:00', { 'boards/entwicklung.md': board({ Entwicklung: [1, 2] }) });
    standAm(ordner, '2026-11-03T09:00:00', { 'boards/entwicklung.md': board({ Entwicklertest: [2], Abnahme: [1] }) });
  };
}
async function phasenBerichtAm0411(page, k, route) {
  await alsPerson(page, 'st');
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00'));
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await bereit(page, '#main .leiste');
}

test.describe('R00169 Board mit Phasen', () => {
  let k, arbeit;
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('R00169 AK 9 (B0826): mit der Phase „Entwicklertest“ als Ziel nennen Burndown und Fluss dieselben Zahlen — „fertig heißt: „Entwicklertest“ durchlaufen“, „fertig (nach „Entwicklertest“)“', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    k = await kanbanStarten(phasenBoard(arbeit, 'fever: {target-column: Entwicklertest}\n'));
    await phasenBerichtAm0411(page, k, 'verlauf');
    await expect.poll(() => burndownJeTag(page)).toEqual([['2', '2'], ['1', '2'], ['1', '2']]);
    await page.goto(`${k.adresse}#/berichte/fluss`);
    await bereit(page, 'svg.cfd');
    const raender = (await flussJeTag(page)).raender;
    expect(raender.map(([offen, gesamt]) => [offen, gesamt]), 'offen · gesamt wie Burndown offen · Umfang').toEqual([['2', '2'], ['1', '2'], ['1', '2']]);
    expect(raender.map(z => z[3]), '„fertig“: #1 hat den Entwicklertest am 03.11. durchlaufen, #2 steht noch in seiner Spalte').toEqual(['0', '1', '1']);
    await expect(kopfleiste(page)).toHaveText('Kumulativer Fluss · Bestand je Spalte über die Zeit · fertig heißt: „Entwicklertest“ durchlaufen');
    await expect(legende(page).last()).toHaveText('fertig (nach „Entwicklertest“)');
  });

  test('R00169 AK 8 (B0826): auf einem Board mit Phasen gibt es den Hinweis auf die ausgeschlossene Abschlussspalte nicht — Auswahl und Texte bleiben', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    k = await kanbanStarten(phasenBoard(arbeit, 'report-filter: {exclude-columns: [Erledigt]}\n'));
    await phasenBerichtAm0411(page, k, 'fluss');
    expect((await eintraege(page)).slice(-1)).toEqual([['Abnahme durchlaufen (Standard)', '', true]]);
    await expect(hinweisFilter(page)).toHaveCount(0);
    await expect(kopfleiste(page)).toHaveText('Kumulativer Fluss · Bestand je Spalte über die Zeit');
    await expect(legende(page).last()).toHaveText('fertig');
  });
});
