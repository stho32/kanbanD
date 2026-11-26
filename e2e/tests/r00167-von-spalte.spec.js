// R00167 Durchsatz: Von-Spalte wählbar, Zugang je Periode als zweiter Balken (ADR-0027 N3, Karte #157)
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
const GILT_FUER = '„Zugang ab“ gilt nur für den Durchsatz, „Erledigt heißt“ für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards; in der Durchlaufzeit als Vorgabe für „bis“';
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
/** Wählt einen Eintrag einer der zwei Auswahlen und wartet, bis die Wahl gespeichert, nachgeladen und gezeichnet ist. Gewartet
    wird auf das Nachladen, das NACH der Antwort auf das Speichern beginnt — ein Nachladen aus dem Seitenwechsel davor zeigt
    noch den alten Stand, und eine zweite Wahl darauf schriebe ihn zurück (die Route ersetzt das ganze `fever`-Objekt). */
async function waehle(page, auswahl, eintrag, wert) {
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
    await expect(page.getByRole('group', { name: 'Erledigt heißt', exact: true }).locator('.muted')).toHaveText('gilt für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards; in der Durchlaufzeit als Vorgabe für „bis“');
    await expect(zugangAb(page)).toHaveCount(0);
    await zurAnsicht(page, k, 'berichte/fieber');
    await expect(erledigtHeisst(page)).toHaveValue('');
    await expect(zugangAb(page)).toHaveCount(0);
    await expect(page.locator('.fb-einst > .muted')).toHaveText('gilt für Burndown, Durchsatz, Kumulativen Fluss und Fever Chart dieses Boards; in der Durchlaufzeit als Vorgabe für „bis“');
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

/* ── F0133 Zugang rechnen und zeigen (Zeichnung D0006 #durchsatz-von, Bild 2 bis 6) ── */
const kopftext = page => page.locator('#main .leiste .muted').first();
const kennzahlen = page => page.locator('#dus-kennzahl > span');
const diagramm = page => page.getByRole('img', { name: 'Durchsatz je Zeitraum: Zugang und Abgang je Periode' });
const legende = page => page.locator('.fluss-leg .fluss-le');
const zugangSatz = page => page.locator('#dus-zugang-satz');
const nettoSatz = page => page.locator('#dus-netto-satz');
const NETTO_SATZ = 'Netto = Abgang − Zugang; Rückläufer und vom Board genommene Aufgaben zählen nicht — den offenen Bestand zeigt der Burndown.';
const masse = balken => balken.evaluateAll(bs => bs.map(b => ['x', 'y', 'width', 'height'].map(a => Number(b.getAttribute(a)))));
/** Zeigt im Durchsatz „je Tag“ des Beispiels auf den Platz des Tages: drei Perioden auf 636 Einheiten Breite ab x = 44. */
async function zeigeAufTag(page, tagImNovember) {
  const svg = diagramm(page);
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  const x = 44 + (tagImNovember - 2 + 0.5) * 636 / 3;
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + 120 * s);
  return page.locator('#tooltip');
}
const tooltipAm = (page, tagImNovember) => expect.poll(async () => (await zeigeAufTag(page, tagImNovember)).textContent());
const SATZ = spalte => `„Zugang“ zählt jede Aufgabe einmal: in der Periode, in der sie „${spalte}“ oder eine Spalte rechts davon erstmals erreicht; Rückläufer zählen nicht erneut.Deshalb darf der Zugang vom „+ hinzugekommen“ des Burndowns abweichen: dort zählt Nacharbeit jedes Mal.`;
/** Legt ein Bild des Berichts ab, wenn KD_BILDER einen Ordner nennt (Beleg für den Bericht der Karte). */
async function bildAblegen(page, name) {
  if (process.env.KD_BILDER) await page.locator('.bericht').screenshot({ path: path.join(process.env.KD_BILDER, name) });
}

test('R00167 US-1, AK 1, AK 8 (B0819): ohne Wahl steht der Zugang ab der ersten Spalte — 3 · 0 · 0 neben dem Abgang 0 · 0 · 1; kein Zusatz „ab …“, Legende und Satz nennen „Backlog“', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    expect(await tabelleJeTag(page)).toEqual({ kopf: ['Zeitraum', 'Zugang', 'Abgang', 'Netto'], jeTag: [['3', '0', '−3'], ['0', '0', '0'], ['0', '1', '+1']], summe: ['Summe', '3', '1', '−2'] });
    await expect(kopftext(page)).toHaveText('· Zugang und Abgang je Periode');
    await expect(kennzahlen(page)).toHaveText(['Zugang 3 · Ø 1,0 je Tag', 'Abgang 1 · Ø 0,3 je Tag', 'Netto −2 · Ø −0,7 je Tag · staut auf', '3 Perioden']);
    await expect(nettoSatz(page)).toHaveText(NETTO_SATZ);
    await tooltipAm(page, 2).toBe('02.11.2026 · Zugang 3 · Abgang 0');
    await expect(legende(page)).toHaveText(['Zugang (erstmals ab „Backlog“)', 'Abgang: erledigte Aufgaben', 'Ø Zugang 1,0 je Tag', 'Ø Abgang 0,3 je Tag']);
    await expect(page.locator('.fluss-leg .rechts')).toHaveText('zeigt nur, filtert nicht');
    await expect(zugangSatz(page)).toHaveText(SATZ('Backlog'));
    expect(k.lies(BOARD), 'Standard: kein Schlüssel in der Datei').not.toContain('fever');
  } finally { await k.stoppen(); }
});

test('R00167 US-1, US-2, AK 1, AK 4, AK 8 (B0819, Abnahme der Karte #157): „Zugang ab“ = Arbeit — Zugang 0 · 2 · 0 (Summe 2), Abgang 0 · 0 · 1 (Summe 1); Kopftext, Kennzahl, Tooltip, Legende und Tabelle nennen beide', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel());
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await waehle(page, zugangAb, 'Spalte „Arbeit“', 'Arbeit');
    expect(await tabelleJeTag(page)).toEqual({ kopf: ['Zeitraum', 'Zugang', 'Abgang', 'Netto'], jeTag: [['0', '0', '0'], ['2', '0', '−2'], ['0', '1', '+1']], summe: ['Summe', '2', '1', '−1'] });
    await expect(kopftext(page)).toHaveText('· Zugang und Abgang je Periode · ab „Arbeit“');
    await expect(kennzahlen(page)).toHaveText(['Zugang 2 ab „Arbeit“ · Ø 0,7 je Tag', 'Abgang 1 · Ø 0,3 je Tag', 'Netto −1 · Ø −0,3 je Tag · staut auf', '3 Perioden']);
    await expect(nettoSatz(page)).toHaveText(NETTO_SATZ);
    await tooltipAm(page, 3).toBe('03.11.2026 · Zugang 2 ab „Arbeit“ · Abgang 0');
    await tooltipAm(page, 4).toBe('04.11.2026 · Zugang 0 ab „Arbeit“ · Abgang 1');
    await expect(legende(page)).toHaveText(['Zugang (erstmals ab „Arbeit“)', 'Abgang: erledigte Aufgaben', 'Ø Zugang 0,7 je Tag', 'Ø Abgang 0,3 je Tag']);
    await expect(zugangSatz(page)).toHaveText(SATZ('Arbeit'));
    const [leg, satz] = await Promise.all([page.locator('.fluss-leg'), zugangSatz(page)].map(o => o.boundingBox()));
    expect(satz.y, 'die zwei Sätze stehen unter der Legende').toBeGreaterThanOrEqual(leg.y + leg.height);
    await expect(page.locator('.fluss-tab tfoot th')).toHaveAttribute('scope', 'row');
  } finally { await k.stoppen(); }
});

test('R00167 AK 1 (B0818): je Periode ein Balkenpaar um die Marke — Zugang links und hohl, Abgang rechts und gefüllt, eine y-Skala, bei 0 kein Rechteck', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitFever('from-column: Arbeit')));
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await tabelleJeTag(page);
    const svg = diagramm(page), zugang = svg.locator('rect.balken.zugang'), abgang = svg.locator('rect.balken:not(.zugang)');
    // drei Perioden: Mitten 150 · 362 · 574, Paar 96, Lücke 2, je Balken 47; Skala bis 2 (0 → 228, 1 → 126, 2 → 24)
    expect(await masse(zugang), 'Zugang 2 am 03.11.: links der Marke, um 1 eingerückt für die Kontur nach innen').toEqual([[315, 25, 45, 203]]);
    expect(await masse(abgang), 'Abgang 1 am 04.11.: rechts der Marke').toEqual([[575, 126, 47, 102]]);
    await expect(svg.locator('line.marke')).toHaveCount(3);
    await expect(svg.locator('text.achse:not(.achse-x)')).toHaveText(['0', '1', '2']);
    await expect(svg.locator('text.ratetext')).toHaveText(['Ø Zugang 0,7 je Tag', 'Ø Abgang 0,3 je Tag']);
    const stil = ort => ort.evaluate(e => { const s = getComputedStyle(e); return { flaeche: s.fill, kontur: s.stroke, staerke: s.strokeWidth }; });
    const [z, a] = [await stil(zugang), await stil(abgang)];
    expect(z.staerke).toBe('2px');
    expect(z.kontur, 'hohl: die Kontur ist kräftiger als die Fläche').not.toBe(z.flaeche);
    expect(a.kontur).toBe('none');
    expect(a.flaeche).not.toBe(z.flaeche);
    expect(a.flaeche).not.toBe(z.kontur);
    // die Farbfelder vor den Wörtern tragen dieselben Zeichen
    expect(await page.locator('#dus-kennzahl .k-zugang').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(await page.locator('.fluss-sw.zugang').evaluate(e => getComputedStyle(e).backgroundColor));
    expect(await page.locator('#dus-kennzahl .k-abgang').evaluate(e => getComputedStyle(e).backgroundColor)).toBe(a.flaeche);
  } finally { await k.stoppen(); }
});

test('R00167 US-4, AK 5 (B0818): „Zugang ab“ = Erledigt — kein Zugang in Kennzahl, Diagramm, Tooltip, Legende und Tabelle; der Abgang bleibt 0 · 0 · 1 an seinem Platz rechts der Marke', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitFever('from-column: Erledigt')));
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await expect(zugangAb(page)).toHaveValue('Erledigt');
    await expect(hinweisRechts(page)).toBeVisible();
    expect(await tabelleJeTag(page)).toEqual({ kopf: ['Zeitraum', 'Abgang'], jeTag: [['0'], ['0'], ['1']], summe: ['Summe', '1'] });
    await expect(kopftext(page)).toHaveText('· Zugang und Abgang je Periode');
    await expect(kennzahlen(page)).toHaveText(['Abgang 1 · Ø 0,3 je Tag', '3 Perioden']);
    await expect(nettoSatz(page)).toHaveCount(0);
    await expect(diagramm(page).locator('text.ratetext')).toHaveText(['Ø Abgang 0,3 je Tag']);
    await expect(diagramm(page).locator('rect.balken.zugang')).toHaveCount(0);
    expect(await masse(diagramm(page).locator('rect.balken')), 'die Skala folgt allein dem Abgang').toEqual([[575, 24, 47, 204]]);
    await tooltipAm(page, 4).toBe('04.11.2026 · Abgang 1');
    await expect(legende(page)).toHaveText(['Abgang: erledigte Aufgaben', 'Ø Abgang 0,3 je Tag']);
    await expect(zugangSatz(page)).toHaveCount(0);
  } finally { await k.stoppen(); }
});

test('R00167 AK 6 (B0819): `from-column: Abnahme` rechnet und beschriftet wie ohne Wahl — Zugang 3 · 0 · 0 ab „Backlog“', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitFever('from-column: Abnahme')));
  try {
    await berichtAm0411(page, k, 'durchsatz');
    await expect(hinweisWeg(page)).toBeVisible();
    expect((await tabelleJeTag(page)).jeTag).toEqual([['3', '0', '−3'], ['0', '0', '0'], ['0', '1', '+1']]);
    await expect(kopftext(page)).toHaveText('· Zugang und Abgang je Periode');
    await expect(kennzahlen(page)).toHaveText(['Zugang 3 · Ø 1,0 je Tag', 'Abgang 1 · Ø 0,3 je Tag', 'Netto −2 · Ø −0,7 je Tag · staut auf', '3 Perioden']);
    await expect(legende(page).first()).toHaveText('Zugang (erstmals ab „Backlog“)');
  } finally { await k.stoppen(); }
});

test('R00167 AK 7 (B0819): `reporting.forecast: false` an #1 wirkt auf beide Balken — von = Arbeit Zugang 0 · 1 · 0, Abgang 0 · 0 · 0', async ({ page }) => {
  const k = await kanbanStarten(rechenbeispiel(mitFever('from-column: Arbeit'), { aufgaben: { 1: aufgabe(1, 'reporting: {forecast: false}\n') } }));
  try {
    await berichtAm0411(page, k, 'durchsatz');
    expect(await tabelleJeTag(page)).toEqual({ kopf: ['Zeitraum', 'Zugang', 'Abgang', 'Netto'], jeTag: [['0', '0', '0'], ['1', '0', '−1'], ['0', '0', '0']], summe: ['Summe', '1', '0', '−1'] });
    await expect(page.locator('#dus-nicht')).toContainText('Nicht enthalten: ausgenommen 1');
  } finally { await k.stoppen(); }
});

for (const [fall, kopf, zugang, netto] of [['von = Backlog', '', ['3', '0', '1'], ['−3', '0', '+1']], ['von = Arbeit', mitFever('from-column: Arbeit'), ['0', '2', '1'], ['0', '−2', '+1']]]) {
  test(`R00167 AK 10 (B0819): #4 am 04.11. direkt in Erledigt angelegt zählt in Zugang und Abgang desselben Tages — ${fall}: 04.11. Zugang 1 · Abgang 2`, async ({ page }) => {
    const k = await kanbanStarten(rechenbeispiel(kopf, { nummern: [1, 2, 3, 4], am0411: [[3], [2], [4, 1]] }));
    try {
      await berichtAm0411(page, k, 'durchsatz');
      expect((await tabelleJeTag(page)).jeTag).toEqual([[zugang[0], '0', netto[0]], [zugang[1], '0', netto[1]], [zugang[2], '2', netto[2]]]);
    } finally { await k.stoppen(); }
  });
}

test('R00167 US-3, AK 3b (B0819): Burndown, Kumulativer Fluss, Durchlaufzeit, „Wie lange noch“ und Fever Chart zeigen mit „Zugang ab“ = Arbeit dasselbe wie ohne Wahl', async ({ browser }) => {
  const seiteZu = async kopf => {
    const k = await kanbanStarten(rechenbeispiel(kopf)), kontext = await browser.newContext({ locale: 'de-DE', timezoneId: 'Europe/Berlin' });
    return { k, kontext, page: await kontext.newPage() };
  };
  const ohne = await seiteZu(''), mit = await seiteZu(mitFever('from-column: Arbeit'));
  try {
    await berichtAm0411(ohne.page, ohne.k, 'verlauf');
    await berichtAm0411(mit.page, mit.k, 'verlauf');
    for (const route of ['verlauf', 'fluss', 'durchlauf', 'prognose', 'fieber']) {
      await zurAnsicht(ohne.page, ohne.k, `berichte/${route}`);
      await zurAnsicht(mit.page, mit.k, `berichte/${route}`);
      // das Fever Chart trägt seine Tage nach dem Zeichnen in den Cache nach — verglichen wird der Zielzustand beider Seiten (ADR-0026 Regel 1)
      const texte = () => Promise.all([ohne.page, mit.page].map(page => page.locator('#main').innerText()));
      await expect.poll(async () => { const [textOhne, textMit] = await texte(); return textMit === textOhne ? 'gleich' : textMit; }, route).toBe('gleich');
      expect((await texte())[1].length, route).toBeGreaterThan(40);
    }
  } finally {
    for (const x of [ohne, mit]) { await x.kontext.close(); await x.k.stoppen(); }
  }
});

for (const farbschema of ['light', 'dark']) {
  test(`R00167 AK 1, AK 8 (B0819): Auswahl, Kennzahl, Legende und die zwei Sätze sind lesbar (${farbschema}); bei 375 px brechen die zwei Auswahlen um, nichts scrollt quer`, async ({ page }) => {
    const k = await kanbanStarten(rechenbeispiel(mitFever('from-column: Arbeit')));
    try {
      await berichtAm0411(page, k, 'durchsatz');
      await thema(page, farbschema);
      await tabelleJeTag(page);
      await expect(kennzahlen(page).first()).toHaveText('Zugang 2 ab „Arbeit“ · Ø 0,7 je Tag');
      expect(await kontrastVerstoesse(page, ['#main .leiste', '.fb-einst', '#dus-kennzahl', '.fluss-leg', '.bd-hinweis'])).toEqual([]);
      await bildAblegen(page, `durchsatz-von-arbeit-${farbschema}.png`);
      await breiteSetzen(page, 375);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 'kein Querscrollen').toBeLessThanOrEqual(0);
      const [von, bis, satz] = await Promise.all([zugangAb(page), erledigtHeisst(page), gruppe(page).locator('.muted')].map(o => o.boundingBox()));
      expect(von.x + von.width, 'die Auswahl bleibt im Fenster').toBeLessThanOrEqual(375);
      expect(bis.x + bis.width).toBeLessThanOrEqual(375);
      expect(satz.y, 'der Geltungssatz bricht unter die Auswahlen').toBeGreaterThanOrEqual(bis.y + bis.height);
      await bildAblegen(page, `durchsatz-von-arbeit-375-${farbschema}.png`);
    } finally { await k.stoppen(); }
  });
}
