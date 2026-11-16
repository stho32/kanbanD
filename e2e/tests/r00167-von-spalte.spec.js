// R00167 Durchsatz: Von-Spalte wählbar, Zugang je Periode als zweiter Balken (ADR-0027 N3, Karte #157)
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
const aufgabe = (n, zusatz = '') => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n${zusatz}---\n`;

/* ── Testsprache: das Rechenbeispiel der Anforderung ── */
/** Board Backlog · Arbeit · Erledigt: 02.11. #1 bis #3 im Backlog angelegt; 03.11. #1 und #2 nach Arbeit; 04.11. #1 nach
    Erledigt, #2 zurück in den Backlog und wieder nach Arbeit. `kopf` ist der Kopf der Board-Datei (leer = nichts gespeichert),
    `aufgaben` ersetzt einzelne Aufgabendateien, `am0411` den Stand am Ende des 04.11. */
const rechenbeispiel = (kopf = '', { aufgaben = {}, nummern = [1, 2, 3], am0411 = [[3], [2], [1]] } = {}) => ordner => {
  const board = (backlog, arbeit, erledigt) => `${kopf}# fabrik\n\n## Backlog\n\n${zeilen(backlog)}\n## Arbeit\n\n${zeilen(arbeit)}\n## Erledigt\n\n${zeilen(erledigt)}`;
  einrichten({ ...Object.fromEntries(nummern.map(n => [datei(n), aufgaben[n] || aufgabe(n)])), [BOARD]: board([], [], []) })(ordner);
  standAm(ordner, '2026-11-02T09:00:00', { [BOARD]: board([1, 2, 3], [], []) });
  standAm(ordner, '2026-11-03T09:00:00', { [BOARD]: board([3], [1, 2], []) });
  standAm(ordner, '2026-11-04T08:00:00', { [BOARD]: board([2, 3], [], [1]) });
  standAm(ordner, '2026-11-04T09:00:00', { [BOARD]: board(...am0411) });
};
const mitFever = inhalt => `---\nfever: {${inhalt}}\n---\n\n`;

/* ── Treiber: Oberfläche ── */
/** Öffnet einen Bericht des Boards „fabrik“ am 04.11.2026, 12:00 Uhr (ADR-0026 Regel 6: feste Browser-Uhr). */
async function berichtAm0411(page, k, route) {
  await alsPerson(page, 'st');
  await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
  await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00'));
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await bereit(page, '#main .leiste');
}
/** Wechselt in derselben Sitzung die Ansicht. */
async function zurAnsicht(page, k, route) {
  await page.goto(`${k.adresse}#/${route}`);
  await bereit(page, '#main .leiste');
  await expect(page).toHaveURL(new RegExp(`#/${route}$`));
}
const zugangAb = page => page.getByRole('combobox', { name: 'Zugang ab' });
const erledigtHeisst = page => page.getByRole('combobox', { name: 'Erledigt heißt' });
const gruppe = page => page.getByRole('group', { name: 'Zugang ab und Erledigt heißt' });
const eintraege = auswahl => auswahl.locator('option').evaluateAll(optionen => optionen.map(o => [o.textContent, o.value, o.selected]));
const GILT_FUER = '„Zugang ab“ gilt nur für den Durchsatz, „Erledigt heißt“ für Burndown, Durchsatz und Fever Chart dieses Boards';
const zellen = (ort, zelle) => ort.evaluateAll((trs, zelle) => trs.map(tr => [...tr.querySelectorAll(zelle)].map(td => td.textContent.trim())), zelle);
/** Stellt die Auflösung „je Tag“ ein und liest die Tabellenansicht: Kopf, je Tag die Zahlenspalten, Fußzeile. */
async function tabelleJeTag(page) {
  await page.getByRole('radio', { name: 'je Tag' }).click();
  await expect(page.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
  const tabelle = page.locator('.fluss-tab');
  return {
    kopf: await tabelle.locator('thead th').allTextContents(),
    jeTag: (await zellen(tabelle.locator('tbody tr'), 'td')).map(z => z.slice(1)),
    summe: (await zellen(tabelle.locator('tfoot tr'), 'th,td'))[0],
  };
}
/** Wählt einen Eintrag einer der zwei Auswahlen und wartet, bis die Wahl gespeichert, nachgeladen und gezeichnet ist. */
async function waehle(page, auswahl, eintrag, wert) {
  const nachgeladen = page.waitForResponse(antwort => antwort.request().method() === 'GET' && antwort.url().includes('/api/berichte/bewegungen'));
  await auswahl(page).selectOption({ label: eintrag });
  await (await nachgeladen).finished();
  await bereit(page);
  await expect(auswahl(page)).toHaveValue(wert);
}
const commitsSeit = (k, stand) => k.git('log', '--format=%an|%s', `${stand}..HEAD`).split('\n').filter(Boolean).filter(c => !c.startsWith('kanbanD|'));

/* ── F0132 Von-Spalte speichern und wählen (Zeichnung D0006 #durchsatz-von, Bild 1) ── */
test('R00167 (B0815): der Durchsatz zeigt „Zugang ab“ links von „Erledigt heißt“ — erste Spalte als Standard davor, dann die Blöcke, ein Geltungssatz für beide', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    expect(await eintraege(zugangAb(page))).toEqual([['Spalte „Backlog“ (Standard)', '', true], ['Spalte „Arbeit“', 'Arbeit', false], ['Spalte „Erledigt“', 'Erledigt', false]]);
    expect(await eintraege(erledigtHeisst(page))).toEqual([['Spalte „Arbeit“', 'Arbeit', false], ['Spalte „Erledigt“ (Standard)', '', true]]);
    await expect(gruppe(page)).toHaveClass('fb-einst');
    await expect(gruppe(page).locator('.muted')).toHaveText(GILT_FUER);
    expect(await gruppe(page).evaluate(g => [...g.children].slice(0, 3).map(kind => kind.tagName + ':' + kind.textContent.trim().slice(0, 14))), 'Zugang ab · Erledigt heißt · Geltungssatz')
      .toEqual(['LABEL:Zugang ab Spal', 'LABEL:Erledigt heißt', 'SPAN:„Zugang ab“ gi']);
    const [von, bis] = await Promise.all([zugangAb(page), erledigtHeisst(page)].map(a => a.boundingBox()));
    expect(von.x + von.width, 'von steht links von bis').toBeLessThanOrEqual(bis.x);
    expect(await zugangAb(page).evaluate(s => [s.className, s.dataset.fb])).toEqual(['mini-inp', 'vonspalte']);
    await expect(page.locator('#main')).not.toContainText('lässt sich noch nicht wählen');
  } finally { await k.stoppen(); }
});

test('R00167 (B0815): Burndown und Fever Chart kennen „Zugang ab“ nicht — dort bleiben Auswahl, Geltungssatz und Name der Gruppe die alten', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitFever('from-column: Arbeit')));
  try {
    await berichtAm0411(page, k, 'verlauf');
    await expect(page.getByRole('group', { name: 'Erledigt heißt', exact: true }).locator('.muted')).toHaveText('gilt für Burndown, Durchsatz und Fever Chart dieses Boards');
    await expect(zugangAb(page)).toHaveCount(0);
    await zurAnsicht(page, k, 'berichte/fieber');
    await expect(erledigtHeisst(page)).toHaveValue('');
    await expect(zugangAb(page)).toHaveCount(0);
    await expect(page.locator('.fb-einst > .muted')).toHaveText('gilt für Burndown, Durchsatz und Fever Chart dieses Boards');
  } finally { await k.stoppen(); }
});

test('R00167 US-3, AK 2, AK 9 (B0815): die Wahl „Arbeit“ steht nach dem Neuladen mit genau einem Commit in der Board-Datei und übersteht Auflösung im Fever Chart, Kartenzug und Zielspalte', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    const vorDerWahl = k.git('rev-parse', 'HEAD');
    await waehle(page, zugangAb, 'Spalte „Arbeit“', 'Arbeit');
    expect(k.lies(BOARD).startsWith('---\nfever: {from-column: Arbeit}\n---\n')).toBe(true);
    expect(commitsSeit(k, vorDerWahl)).toEqual(['Stefan|Fever Chart von „fabrik“ eingestellt: ohne Puffer, P95, Zugang ab „Arbeit“']);
    await page.reload();
    await bereit(page, '#main .leiste');
    await expect(zugangAb(page)).toHaveValue('Arbeit');
    // Fever Chart: Auflösung ändern
    await zurAnsicht(page, k, 'berichte/fieber');
    await page.getByLabel('Auflösung').selectOption({ label: 'Woche (alle 7 T)' });
    await expect.poll(() => k.lies(BOARD)).toContain('fever: {resolution: week, from-column: Arbeit}\n');
    // Kartenzug über die Oberfläche
    await zurAnsicht(page, k, 'board');
    await page.locator('.ka[data-id="3"]').dragTo(page.locator('.bahn[data-col="Arbeit"] .flaeche'));
    await expect(page.locator('.bahn[data-col="Arbeit"] .ka[data-id="3"]')).toBeVisible();
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#3 nach „Arbeit“ (fabrik)');
    expect(k.lies(BOARD)).toContain('fever: {resolution: week, from-column: Arbeit}\n');
    // Zielspalte ändern erhält die Von-Spalte, Von-Spalte ändern erhält alle übrigen Werte
    await zurAnsicht(page, k, 'berichte/durchsatz');
    await expect(zugangAb(page)).toHaveValue('Arbeit');
    await waehle(page, erledigtHeisst, 'Spalte „Arbeit“', 'Arbeit');
    expect(k.lies(BOARD)).toContain('fever: {resolution: week, target-column: Arbeit, from-column: Arbeit}\n');
    await waehle(page, zugangAb, 'Spalte „Backlog“ (Standard)', '');
    expect(k.lies(BOARD), 'Standard gewählt: kein Schlüssel from-column, alles Übrige bleibt').toContain('fever: {resolution: week, target-column: Arbeit}\n');
  } finally { await k.stoppen(); }
});

test('R00167 AK 3a (B0815): ohne Wahl schreibt das Öffnen des Durchsatzes nichts — die Board-Datei bleibt zeichengleich, kein Commit', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    const [vorher, stand] = [k.lies(BOARD), k.git('rev-parse', 'HEAD')];
    await berichtAm0411(page, k, 'durchsatz');
    await expect(zugangAb(page)).toHaveValue('');
    expect(k.lies(BOARD)).toBe(vorher);
    expect(commitsSeit(k, stand)).toEqual([]);
  } finally { await k.stoppen(); }
});

const hinweisRechts = page => gruppe(page).locator('#fb-von-rechts');
const hinweisWeg = page => gruppe(page).locator('#fb-von-weg');

test('R00167 US-4, AK 5 (B0815): „Zugang ab“ = Erledigt liegt nicht links vom Ziel — der Hinweis steht in der Zeile, die Wahl bleibt gespeichert und gewählt', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await waehle(page, zugangAb, 'Spalte „Erledigt“', 'Erledigt');
    await expect(hinweisRechts(page)).toHaveText('„Zugang ab“ muss links von „Erledigt heißt“ liegen — der Zugang wird nicht gezeigt.');
    await expect(hinweisRechts(page)).toHaveClass('fehl');
    expect(k.lies(BOARD)).toContain('fever: {from-column: Erledigt}\n');
    await waehle(page, zugangAb, 'Spalte „Arbeit“', 'Arbeit');
    await expect(hinweisRechts(page)).toHaveCount(0);
    await waehle(page, erledigtHeisst, 'Spalte „Arbeit“', 'Arbeit');
    await expect(hinweisRechts(page), 'dieselbe Spalte als von und bis').toHaveCount(1);
  } finally { await k.stoppen(); }
});

test('R00167 AK 6 (B0815): `from-column: Abnahme` — Eintrag am Ende der Liste gewählt, Hinweis „gibt es nicht mehr“, gerechnet wird ab „Backlog“; mit verschwundener Zielspalte stehen beide Hinweise, Ziel zuerst', async ({ page }) => {
  const fehler = [];
  page.on('pageerror', f => fehler.push(String(f)));
  const k = await kanbanStarten(rechenbeispiel(mitFever('target-column: Abnahme, from-column: Abnahme')));
  try {
    await berichtAm0411(page, k, 'durchsatz');
    expect((await eintraege(zugangAb(page))).slice(-1)).toEqual([['„Abnahme“ — gibt es nicht mehr', 'Abnahme', true]]);
    expect((await eintraege(zugangAb(page))).slice(0, 1)).toEqual([['Spalte „Backlog“ (Standard)', '', false]]);
    await expect(hinweisWeg(page)).toHaveText('Spalte „Abnahme“ für „Zugang ab“ gibt es nicht mehr — gerechnet wird ab „Backlog“.');
    await expect(hinweisWeg(page)).toHaveClass('fehl');
    expect(await gruppe(page).locator('span.fehl').evaluateAll(h => h.map(x => x.id))).toEqual(['fb-ziel-weg', 'fb-von-weg']);
    await expect(hinweisRechts(page)).toHaveCount(0);
    expect(fehler).toEqual([]);
  } finally { await k.stoppen(); }
});

test('R00167 AK 6 (B0815): schließt der Berichtsfilter die gewählte Von-Spalte aus, gilt derselbe Hinweis', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel('---\nfever: {from-column: Arbeit}\nreport-filter: {exclude-columns: [Arbeit]}\n---\n\n'));
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await expect(hinweisWeg(page)).toHaveText('Spalte „Arbeit“ für „Zugang ab“ gibt es nicht mehr — gerechnet wird ab „Backlog“.');
    expect(await eintraege(zugangAb(page))).toEqual([['Spalte „Backlog“ (Standard)', '', false], ['Spalte „Erledigt“', 'Erledigt', false], ['„Arbeit“ — gibt es nicht mehr', 'Arbeit', true]]);
  } finally { await k.stoppen(); }
});

test.describe('R00167 Board mit Phasen', () => {
  let k, arbeit;
  test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });

  test('R00167 (B0815): auf einem Board mit Phasen ist der Standard die erste Spalte des Boards, die Blöcke heißen „Phase „…““', async ({ page }) => {
    arbeit = arbeitsRepository(wbsText([zeile('A0001', 'Application', '—', 'kanbanD', 'rot')]));
    const kopf = '---\ncolumn-phases:\n  Entwicklung: Entwicklung\n  Entwicklertest: Entwicklertest\n  Abnahme: Abnahme\n---\n\n# Entwicklung\n';
    const board = spalten => kopf + ['Backlog', 'Entwicklung', 'Entwicklertest', 'Abnahme', 'Erledigt'].map(sp => `\n## ${sp}\n\n${zeilen(spalten[sp] || [])}`).join('');
    k = await kanbanStarten(ordner => {
      mitRegister(arbeit, { ...Object.fromEntries([1, 2].map(n => [datei(n), aufgabe(n)])), 'boards/entwicklung.md': board({}) })(ordner);
      standAm(ordner, '2026-11-02T09:00:00', { 'boards/entwicklung.md': board({ Entwicklung: [1, 2] }) });
      standAm(ordner, '2026-11-03T09:00:00', { 'boards/entwicklung.md': board({ Entwicklung: [2], Erledigt: [1] }) });
    });
    await alsPerson(page, 'st');
    await page.clock.setFixedTime(new Date('2026-11-04T12:00:00+01:00'));
    await page.goto(`${k.adresse}#/berichte/durchsatz`);
    await bereit(page, '#dus-kennzahl');
    expect(await eintraege(zugangAb(page))).toEqual([['Spalte „Backlog“ (Standard)', '', true], ['Phase „Entwicklung“', 'Entwicklung', false], ['Phase „Entwicklertest“', 'Entwicklertest', false], ['Phase „Abnahme“', 'Abnahme', false]]);
  });
});
