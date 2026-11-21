// R00166 „Erledigt heißt“ je Board — gilt für Burndown, Durchsatz und Fever Chart (ADR-0027 N2, Karte #156)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, thema, breiteSetzen, kontrastVerstoesse } = require('./hilfen');

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
/** Tabellenansicht des Burndowns ohne die Tagesspalte: je Tag offen, Umfang, +, − erledigt, − entfernt — ohne die Teilmenge
    „davon zurückgekommen“ (R00192, Spalte rechts von „+“), die diese Anforderung nicht rechnet. */
const burndownJeTag = async page => (await zellen(page.locator('.bd-tabelle tbody tr'), 'td')).map(([, offen, umfang, plus, , ...abgang]) => [offen, umfang, plus, ...abgang]);
/** Durchsatz je Tag aus der Tabellenansicht (Auflösung „je Tag“ gewählt): die Spalte „Abgang“, die letzte seit R00167. */
async function durchsatzJeTag(page) {
  await page.getByRole('radio', { name: 'je Tag' }).click();
  await expect(page.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
  return (await zellen(page.locator('.fluss-tab tbody tr'), 'td')).map(zeile => zeile[zeile.length - 1]);
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

test('R00166 AK 8 (B0806), seit R00169: „Wie lange noch“ zeigt mit Zielspalte B dasselbe wie ohne — der Kumulative Fluss folgt der Wahl („fertig“ am 03.11. ist 3 statt 1), die Durchlaufzeit öffnet mit „bis B“', async ({ browser }) => {
  const seiteZu = async kopf => {
    const k = await kanbanStarten(rechenbeispiel(kopf)), kontext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    return { k, kontext, page: await kontext.newPage() };
  };
  const ohne = await seiteZu(''), mit = await seiteZu(mitZielspalte('B'));
  try {
    await berichtAm0411(ohne.page, ohne.k, 'fluss');
    await berichtAm0411(mit.page, mit.k, 'fluss');
    const fertigAm0311 = async page => (await zellen(page.locator('.fluss-tab tbody tr'), 'td'))[1].slice(-1);
    expect(await fertigAm0311(ohne.page)).toEqual(['1']);
    expect(await fertigAm0311(mit.page)).toEqual(['3']);
    for (const x of [ohne, mit]) await zumBericht(x.page, x.k, 'durchlauf');
    await expect(ohne.page.getByRole('combobox', { name: 'bis Spalte' })).toHaveValue('Erledigt');
    await expect(mit.page.getByRole('combobox', { name: 'bis Spalte' })).toHaveValue('B');
    for (const x of [ohne, mit]) await zumBericht(x.page, x.k, 'prognose');
    const [textOhne, textMit] = await Promise.all([ohne.page, mit.page].map(page => page.locator('#main').innerText()));
    expect(textMit.length).toBeGreaterThan(40);
    expect(textMit).toBe(textOhne);
    await expect(mit.page.locator('#main')).toContainText('Abschlussspalte');
  } finally {
    for (const x of [ohne, mit]) { await x.kontext.close(); await x.k.stoppen(); }
  }
});

/* ── F0130 Auswahl in beiden Kopfleisten (Zeichnung D0006 #erledigt-heisst) ── */
const GILT_FUER = 'gilt für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards; in der Durchlaufzeit als Vorgabe für „bis“';
/** Im Durchsatz steht seit R00167 „Zugang ab“ daneben — ein Geltungssatz für beide Auswahlen. */
const GILT_FUER_IM_DURCHSATZ = '„Zugang ab“ gilt nur für den Durchsatz, „Erledigt heißt“ für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards; in der Durchlaufzeit als Vorgabe für „bis“';
const auswahl = page => page.getByRole('combobox', { name: 'Erledigt heißt' });
const gruppe = page => page.getByRole('group', { name: 'Erledigt heißt' });
const eintraege = page => auswahl(page).locator('option').evaluateAll(optionen => optionen.map(o => [o.textContent, o.value, o.selected]));
const oberkante = async ort => (await ort.boundingBox()).y;

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

test('R00166 AK 4 (B0807): der Durchsatz zeigt dieselbe Auswahl an derselben Stelle — vor der Kennzahlzeile, über dem Umschalter „Auflösung“, auch über dem Leerzustand', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    expect(await eintraege(page)).toEqual([['Spalte „B“', 'B', false], ['Spalte „C“', 'C', false], ['Spalte „Erledigt“ (Standard)', '', true]]);
    await expect(gruppe(page).locator('.muted')).toHaveText(GILT_FUER_IM_DURCHSATZ);
    const [filter, wahl, kennzahl, aufloesung] = await Promise.all([page.locator('.bfilter-box'), gruppe(page), page.locator('#dus-kennzahl'), page.locator('.dus-um')].map(oberkante));
    expect(filter).toBeLessThan(wahl);
    expect(wahl).toBeLessThan(kennzahl);
    expect(kennzahl).toBeLessThan(aufloesung);
    await expect(page.locator('#main .leiste').first()).toHaveText('Durchsatz je Zeitraum · Zugang und Abgang je Periode');
    // Leerzustand: am 01.11. liegt noch keine Aufgabe auf dem Board — seit R00167 zählt am 02.11. schon der Zugang
    await page.clock.setFixedTime(new Date('2026-11-01T12:00:00+01:00'));
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

/** Wählt einen Eintrag und wartet, bis die Wahl gespeichert, nachgeladen und gezeichnet ist: die Auswahl trägt den neuen Wert. */
async function waehle(page, eintrag, wert) {
  const nachgeladen = page.waitForResponse(antwort => antwort.request().method() === 'GET' && antwort.url().includes('/api/berichte/bewegungen'));
  await auswahl(page).selectOption({ label: eintrag });
  await (await nachgeladen).finished();
  await bereit(page);
  await expect(auswahl(page)).toHaveValue(wert);
}
const commitsSeit = (k, stand) => k.git('log', '--format=%an|%s', `${stand}..HEAD`).split('\n').filter(Boolean);

test('R00166 US-1 bis US-3, AK 5 (B0808): die Wahl „B“ im Burndown rechnet neu, steht im Durchsatz und im Fever Chart und nach dem Neuladen mit genau einem Commit in der Board-Datei', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'verlauf');
    await expect.poll(() => burndownJeTag(page)).toEqual(OHNE_WAHL.burndown);
    const vorDerWahl = k.git('rev-parse', 'HEAD');
    await waehle(page, 'Spalte „B“', 'B');
    await expect.poll(() => burndownJeTag(page)).toEqual(ZIELSPALTE_B.burndown);
    await expect(gruppe(page).locator('.muted')).toHaveText(GILT_FUER);
    await zumBericht(page, k, 'durchsatz');
    await expect(auswahl(page)).toHaveValue('B');
    expect(await durchsatzJeTag(page)).toEqual(ZIELSPALTE_B.durchsatz);
    await page.reload();
    await bereit(page, '#main .leiste');
    await zumBericht(page, k, 'fieber');
    await expect(auswahl(page)).toHaveValue('B');
    expect(k.lies(BOARD)).toContain('fever: {target-column: B}\n');
    expect(commitsSeit(k, vorDerWahl).filter(c => !c.startsWith('kanbanD|'))).toEqual([expect.stringMatching(/^Stefan\|.*erledigt heißt „B“$/)]);
  } finally { await k.stoppen(); }
});

test('R00166 AK 5, AK 7 (B0808): eine Wahl im Durchsatz gilt im Burndown; zurück auf den Standardblock steht kein Schlüssel mehr in der Board-Datei', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await waehle(page, 'Spalte „B“', 'B');
    expect(await durchsatzJeTag(page)).toEqual(ZIELSPALTE_B.durchsatz);
    await zumBericht(page, k, 'verlauf');
    await expect.poll(() => burndownJeTag(page)).toEqual(ZIELSPALTE_B.burndown);
    await waehle(page, 'Spalte „Erledigt“ (Standard)', '');
    await expect.poll(() => burndownJeTag(page)).toEqual(OHNE_WAHL.burndown);
    expect(k.lies(BOARD)).not.toContain('fever');
  } finally { await k.stoppen(); }
});

test('R00166 (B0808): ohne gewähltes „Ich bin …“ greift die Sperre des Fever Charts — nichts wird gespeichert', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
    await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00'));
    await page.goto(`${k.adresse}#/berichte/verlauf`);
    await bereit(page, '#main .leiste');
    const [vorher, stand] = [k.lies(BOARD), k.git('rev-parse', 'HEAD')];
    await auswahl(page).selectOption({ label: 'Spalte „B“' });
    await expect(page.locator('#ich-hinweis')).toHaveText('Für diese Aktion zuerst wählen, wer du bist.');
    expect(k.lies(BOARD)).toBe(vorher);
    expect(k.git('rev-parse', 'HEAD')).toBe(stand);
  } finally { await k.stoppen(); }
});

const hinweisWeg = page => gruppe(page).locator('#fb-ziel-weg');
/** Die Zeile bei einer Wahl, die es nicht mehr gibt: Eintrag am Ende der Liste gewählt, Hinweis hinter dem Geltungssatz. */
async function erwarteVerschwunden(page, name, geltung = GILT_FUER) {
  expect((await eintraege(page)).slice(-1)).toEqual([[`„${name}“ — gibt es nicht mehr`, name, true]]);
  await expect(hinweisWeg(page)).toHaveText(`Zielspalte „${name}“ gibt es nicht mehr — gerechnet wird mit „Erledigt“.`);
  await expect(hinweisWeg(page)).toHaveClass('fehl');
  expect(await hinweisWeg(page).evaluate(h => h.previousElementSibling.textContent)).toBe(geltung);
}

test('R00166 US-4, AK 9 (B0809): `target-column: Abnahme` — Burndown und Durchsatz zeigen den Hinweis aus dem Fever Chart und die Zahlen ohne Wahl', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('Abnahme')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await erwarteVerschwunden(page, 'Abnahme');
    await expect.poll(() => burndownJeTag(page)).toEqual(OHNE_WAHL.burndown);
    await zumBericht(page, k, 'durchsatz');
    await erwarteVerschwunden(page, 'Abnahme', GILT_FUER_IM_DURCHSATZ);
    expect(await durchsatzJeTag(page)).toEqual(OHNE_WAHL.durchsatz);
    await zumBericht(page, k, 'fieber');
    await expect(page.locator('#fb-ziel-weg')).toHaveText('Zielspalte „Abnahme“ gibt es nicht mehr — gerechnet wird mit „Erledigt“.');
  } finally { await k.stoppen(); }
});

test('R00166 AK 9 (B0809): schließt der Berichtsfilter die gewählte Spalte B aus, gilt derselbe Hinweis — gerechnet wird bis „Erledigt“', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel('---\nfever: {target-column: B}\nreport-filter: {exclude-columns: [B]}\n---\n\n'));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await erwarteVerschwunden(page, 'B');
    // ohne Wahl und ohne Spalte B: am 03.11. verlassen #1 und #2 den Bestand (− entfernt 2), #3 ist erledigt; am 04.11. kommen beide zurück
    await expect.poll(() => burndownJeTag(page)).toEqual([['3', '3', '3', '0', '0'], ['0', '1', '0', '1', '2'], ['2', '3', '2', '0', '0']]);
    await zumBericht(page, k, 'durchsatz');
    await erwarteVerschwunden(page, 'B', GILT_FUER_IM_DURCHSATZ);
    expect(await durchsatzJeTag(page)).toEqual(OHNE_WAHL.durchsatz);
  } finally { await k.stoppen(); }
});

test('R00166 (B0809): scheitert das Speichern, steht der Fehler als Meldung in der Zeile der Auswahl', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'verlauf');
    await page.route('**/api/boards/fabrik/fieber', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ fehler: 'geht gerade nicht' }) }));
    await auswahl(page).selectOption({ label: 'Spalte „B“' });
    await expect(gruppe(page).getByRole('alert')).toHaveText('geht gerade nicht');
    await expect(auswahl(page)).toHaveValue('');
    expect(k.lies(BOARD)).not.toContain('fever');
  } finally { await k.stoppen(); }
});

/* ── F0131 Texte nennen, was als erledigt zählt (Zeichnung D0006 #erledigt-heisst) ── */
const kopftext = page => page.locator('#main .leiste .muted').first();
const burndownDiagramm = page => page.getByRole('img', { name: 'Offene Aufgaben je Tag' });
/** Zeigt im Burndown des Beispiels auf den Tag: drei Tage auf 668 Einheiten Breite ab x = 36. */
async function zeigeAufTag(page, tagImNovember) {
  const svg = burndownDiagramm(page);
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  const x = 36 + (tagImNovember - 2) * 668 / 2;
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + 100 * s);
  return page.locator('#tooltip');
}
const tooltipZeilen = tip => tip.locator('span').evaluateAll(spans => spans.map(s => s.textContent.trim()));
const ZUG_ZURUECK = 'Ein Zug zurück nach links zählt als „+ hinzugekommen“.';

test('R00166 AK 10 (B0810): mit Zielspalte B nennt der Burndown „B“ in Kopfleiste, Kennzahl, Tooltip und Legende; der Tabellenkopf bleibt „− erledigt“', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await expect(kopftext(page)).toHaveText('fabrik · aus den Commits von boards/fabrik.md · erledigt = in „B“ oder rechts davon');
    await expect(page.locator('#bd-kennzahl span')).toHaveText(['+ 4 hinzugekommen', '− 3 erledigt (ab „B“)', '− 0 entfernt']);
    await expect.poll(async () => tooltipZeilen(await zeigeAufTag(page, 3))).toEqual(['offen 0', 'Umfang 3', '+ hinzugekommen 0', '− erledigt (ab „B“) 3', '− entfernt 0']);
    await expect(page.locator('#bd-legende span')).toHaveText(['+ hinzugekommen', '− erledigt (ab „B“)', '− entfernt']);
    await expect(page.locator('.bd-hinweis')).toContainText(`Erledigt heißt hier: in „B“ oder rechts davon. ${ZUG_ZURUECK}`);
    await expect(page.locator('.bd-hinweis')).toContainText('„− erledigt“ kann über dem Durchsatz liegen');
    expect(await zellen(page.locator('.bd-tabelle thead tr'), 'th')).toEqual([['Tag', 'offen', 'Umfang', '+ hinzugekommen', 'davon zurückgekommen', '− erledigt', '− entfernt']]); // Spalte „davon zurückgekommen“ seit R00192
  } finally { await k.stoppen(); }
});

for (const [fall, kopf] of [['ohne Wahl', ''], ['mit einer Zielspalte, die es nicht mehr gibt', mitZielspalte('Abnahme')]]) {
  test(`R00166 AK 10 (B0810): ${fall} stehen die Texte des Burndowns wörtlich wie vor der Karte`, async ({ page }) => {
    const k = await kanbanStarten(rechenbeispiel(kopf));
    try {
      await berichtAm0411(page, k, 'verlauf');
      await expect(kopftext(page)).toHaveText('fabrik · aus den Commits von boards/fabrik.md · offen = nicht in der Abschlussspalte');
      await expect(page.locator('#bd-kennzahl span')).toHaveText(['+ 3 hinzugekommen', '− 1 erledigt', '− 0 entfernt']);
      await expect.poll(async () => tooltipZeilen(await zeigeAufTag(page, 3))).toEqual(['offen 2', 'Umfang 3', '+ hinzugekommen 0', '− erledigt 1', '− entfernt 0']);
      await expect(page.locator('#bd-legende span')).toHaveText(['+ hinzugekommen', '− erledigt', '− entfernt']);
      // seit R00192 AK 4 folgt der Satz zu „davon zurückgekommen“
      await expect(page.locator('.bd-hinweis')).toHaveText('„+“ zählt ab dem Eintritt in eine gezählte Spalte; ausgeschlossene Spalten zählen nicht.„− erledigt“ kann über dem Durchsatz liegen: Nacharbeit wird erneut erledigt und zählt jedes Mal.'
        + '„davon zurückgekommen“ zählt Nacharbeit aus der Zielspalte: Aufgaben, die von dort zurück nach links gezogen wurden — deshalb kann „− erledigt“ über dem Durchsatz liegen.');
    } finally { await k.stoppen(); }
  });
}

/** Seit R00167 steht unter der Legende, was der Zugang zählt — der Satz „„Von“ lässt sich noch nicht wählen: …“ ist entfallen. */
const ZUGANG_ZAEHLT = '„Zugang“ zählt jede Aufgabe einmal: in der Periode, in der sie „A“ oder eine Spalte rechts davon erstmals erreicht; Rückläufer zählen nicht erneut.Deshalb darf der Zugang vom „+ hinzugekommen“ des Burndowns abweichen: dort zählt Nacharbeit jedes Mal.';
const durchsatzDiagramm = page => page.getByRole('img', { name: 'Durchsatz je Zeitraum: Zugang und Abgang je Periode' });
/** Zeigt im Durchsatz „je Tag“ des Beispiels auf den Balkenplatz des Tages: drei Perioden auf 636 Einheiten Breite ab x = 44. */
async function zeigeAufPeriode(page, tagImNovember) {
  const svg = durchsatzDiagramm(page);
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  const x = 44 + (tagImNovember - 2 + 0.5) * 636 / 3;
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + 120 * s);
  return page.locator('#tooltip');
}
async function durchsatzJeTagOeffnen(page, k) {
  await berichtAm0411(page, k, 'durchsatz');
  await page.getByRole('radio', { name: 'je Tag' }).click();
  await expect(page.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
}

test('R00166 US-2, AK 10 (B0811): mit Zielspalte B nennt der Durchsatz „bis „B““ in Kopfleiste, Kennzahl, Tooltip und Legende; darunter steht, was der Zugang zählt', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
  try {
    await durchsatzJeTagOeffnen(page, k);
    await expect(page.locator('#main .leiste').first()).toHaveText('Durchsatz je Zeitraum · Zugang und Abgang je Periode · bis „B“');
    await expect(page.locator('#dus-kennzahl span')).toHaveText(['Zugang 3 · Ø 1,0 je Tag', 'Abgang 3 bis „B“ · Ø 1,0 je Tag', '3 Perioden']);
    await expect.poll(async () => (await zeigeAufPeriode(page, 3)).textContent()).toBe('03.11.2026 · Zugang 0 · Abgang 3 bis „B“');
    await expect(page.locator('.fluss-leg .fluss-le').nth(1)).toHaveText('Abgang: erledigte Aufgaben (bis „B“)');
    await expect(page.locator('p.bd-hinweis')).toHaveText(ZUGANG_ZAEHLT);
    const [legende, satz] = await Promise.all([page.locator('.fluss-leg'), page.locator('p.bd-hinweis')].map(o => o.boundingBox()));
    expect(satz.y).toBeGreaterThanOrEqual(legende.y + legende.height);
    expect(await zellen(page.locator('.fluss-tab thead tr'), 'th')).toEqual([['Zeitraum', 'Zugang', 'Abgang']]);
  } finally { await k.stoppen(); }
});

for (const [fall, kopf] of [['ohne Wahl', ''], ['mit einer Zielspalte, die es nicht mehr gibt', mitZielspalte('Abnahme')]]) {
  test(`R00166 AK 10 (B0811): ${fall} nennt der Durchsatz keinen Block — der Satz zum Zugang steht trotzdem`, async ({ page }) => {
    const k = await kanbanStarten(rechenbeispiel(kopf));
    try {
      await durchsatzJeTagOeffnen(page, k);
      await expect(page.locator('#main .leiste').first()).toHaveText('Durchsatz je Zeitraum · Zugang und Abgang je Periode');
      await expect(page.locator('#dus-kennzahl span')).toHaveText(['Zugang 3 · Ø 1,0 je Tag', 'Abgang 1 · Ø 0,3 je Tag', '3 Perioden']);
      await expect.poll(async () => (await zeigeAufPeriode(page, 3)).textContent()).toBe('03.11.2026 · Zugang 0 · Abgang 1');
      await expect(page.locator('.fluss-leg .fluss-le').nth(1)).toHaveText('Abgang: erledigte Aufgaben');
      await expect(page.locator('p.bd-hinweis')).toHaveText(ZUGANG_ZAEHLT);
    } finally { await k.stoppen(); }
  });
}

for (const farbschema of ['light', 'dark']) {
  test(`R00166 AK 10 (B0811): Auswahl, Geltungssatz und die neuen Texte sind in Burndown und Durchsatz lesbar (${farbschema}); bei 375 px scrollt nichts quer`, async ({ page }) => {
    const k = await kanbanStarten(rechenbeispiel(mitZielspalte('B')));
    try {
      await berichtAm0411(page, k, 'verlauf');
      await thema(page, farbschema);
      await expect(page.locator('.bd-hinweis')).toContainText('Erledigt heißt hier: in „B“ oder rechts davon.');
      expect(await kontrastVerstoesse(page, ['#main .leiste', '.fb-einst', '#bd-kennzahl', '#bd-legende', '.bd-hinweis'])).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`burndown-wahl-b-${farbschema}.png`), fullPage: true });
      await zumBericht(page, k, 'durchsatz');
      await page.getByRole('radio', { name: 'je Tag' }).click();
      await expect(page.locator('#dus-kennzahl')).toContainText('Abgang 3 bis „B“ ·');
      expect(await kontrastVerstoesse(page, ['#main .leiste', '.fb-einst', '#dus-kennzahl', '.fluss-leg', '.bd-hinweis'])).toEqual([]);
      await page.screenshot({ path: test.info().outputPath(`durchsatz-wahl-b-${farbschema}.png`), fullPage: true });
      for (const route of ['durchsatz', 'verlauf']) {
        await zumBericht(page, k, route);
        await breiteSetzen(page, 375);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${route}: kein Querscrollen`).toBeLessThanOrEqual(0);
        const [wahl, satz] = await Promise.all([auswahl(page), gruppe(page).locator('.muted')].map(o => o.boundingBox()));
        expect(satz.y, `${route}: der Geltungssatz bricht als eigene Zeile unter die Auswahl`).toBeGreaterThanOrEqual(wahl.y + wahl.height);
        await breiteSetzen(page, 1280);
      }
    } finally { await k.stoppen(); }
  });
}
