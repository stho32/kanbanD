// R00152 Eine Bestandsregel für Burndown, Kumulativen Fluss und „Wie lange noch“ (ADR-0027, Karte #155)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');

/* ── Treiber: Ordner mit datierter Geschichte ── */
/** Schreibt und löscht Dateien und hält den Stand als Commit mit diesem Datum fest. */
function standAm(ordner, datum, dateien, geloescht = []) {
  for (const [rel, inhalt] of Object.entries(dateien)) fs.writeFileSync(path.join(ordner, rel), inhalt);
  for (const rel of geloescht) fs.rmSync(path.join(ordner, rel));
  execFileSync('git', ['-C', ordner, 'add', '-A']);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}
const BOARD = 'boards/fabrik.md';
const zeilen = nummern => nummern.map(n => `- #${n}\n`).join('');
const board = (eingang, arbeit, fertig, kopf = '') => `${kopf}# fabrik\n\n## Eingang\n\n${zeilen(eingang)}\n## In Arbeit\n\n${zeilen(arbeit)}\n## Fertig\n\n${zeilen(fertig)}`;
const datei = n => `aufgaben/${String(n).padStart(4, '0')}-a${n}.md`;
const aufgabe = (n, archiviertAm, zusatz = '') => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n${archiviertAm ? `archived: ${archiviertAm}\n` : ''}${zusatz}---\n`;
const aufgaben = anzahl => Object.fromEntries([...Array(anzahl).keys()].map(i => [datei(i + 1), aufgabe(i + 1)]));

/* ── Testsprache: die zwei Grundbestände der Anforderung ── */
/** Grundbestand A: 02.11. #1–#7 in „Eingang“; 03.11. #2, #4, #6 nach „Fertig“; 06.11. #3 archiviert (in „Eingang“), #4 archiviert
    (in „Fertig“), #5 und #6 endgültig gelöscht, #7 vom Board genommen. `archivtag3: null` heißt: #3 ist zurückgeholt;
    `zusatz3` ergänzt die Kopfdaten von #3. */
const grundbestandA = ({ archivtag3 = '2026-11-06', kopf = '', zusatz3 = '' } = {}) => ordner => {
  einrichten({ ...aufgaben(7), [BOARD]: board([], [], [], kopf) })(ordner);
  standAm(ordner, '2026-11-02T09:00:00', { [BOARD]: board([1, 2, 3, 4, 5, 6, 7], [], [], kopf) });
  standAm(ordner, '2026-11-03T09:00:00', { [BOARD]: board([1, 3, 5, 7], [], [2, 4, 6], kopf) });
  standAm(ordner, '2026-11-06T09:00:00', { [BOARD]: board([1, 3], [], [2, 4], kopf), [datei(3)]: aufgabe(3, archivtag3, zusatz3), [datei(4)]: aufgabe(4, '2026-11-06') }, [datei(5), datei(6)]);
};
/** Grundbestand B: 02.11. #1–#10 in „Eingang“; 03.11. #1–#5 nach „Fertig“; 05.11. #6 archiviert (in „Eingang“). */
const grundbestandB = ordner => {
  einrichten({ ...aufgaben(10), [BOARD]: board([], [], []) })(ordner);
  standAm(ordner, '2026-11-02T09:00:00', { [BOARD]: board([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [], []) });
  standAm(ordner, '2026-11-03T09:00:00', { [BOARD]: board([6, 7, 8, 9, 10], [], [1, 2, 3, 4, 5]) });
  standAm(ordner, '2026-11-05T09:00:00', { [datei(6)]: aufgabe(6, '2026-11-05') });
};
const NUR_ST = '---\nreport-filter: {people: [st]}\n---\n';

/* ── Treiber: Oberfläche ── */
/** Öffnet einen Bericht des Boards „fabrik“; „heute“ ist der genannte Tag, 12:00 Uhr (ADR-0026 Regel 6: feste Browser-Uhr). */
async function berichtAm(page, k, heute, route) {
  await alsPerson(page, 'st');
  await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
  await page.clock.setFixedTime(new Date(`${heute}T12:00:00+01:00`));
  await page.goto(`${k.adresse}#/berichte/${route}`);
}
/** Klappt die Tabellenansicht auf und liefert ihre Zeilen (je Tag eine). */
async function tabelle(page, selektor) {
  const kopf = page.getByText('Tabellenansicht', { exact: true });
  await bereit(page, kopf);
  await kopf.click();
  return page.locator(`${selektor} tbody tr`);
}
/** Vom Burndown liest diese Spec Tag, offen und Umfang; die Ereignisspalten rechts davon (R00164) prüft r00164-zugang-abgang.spec.js. */
const burndownTabelle = async page => Object.assign(await tabelle(page, '.tabellenansicht'), { spalten: 3 });
const flussTabelle = page => tabelle(page, '.fluss-tab');
const tag = t => `${String(t).padStart(2, '0')}.11.2026`;
/** Erwartete Zeilen einer Tabelle: je Tag das Datum und die Zahlen. */
const reihe = (ab, werte) => werte.map((w, i) => [tag(ab + i), ...w.map(String)].join(' '));
const zeilenText = zeilenOrt => zeilenOrt.evaluateAll((trs, spalten) => trs.map(tr => [...tr.cells].slice(0, spalten ?? undefined).map(td => td.textContent.trim()).join(' ')), zeilenOrt.spalten ?? null);
const erwarteZeilen = (zeilenOrt, soll) => expect.poll(() => zeilenText(zeilenOrt)).toEqual(soll);

/** Fährt mit der Maus auf eine Stelle eines Diagramms, angegeben in Koordinaten seiner viewBox. */
async function zeigeAuf(page, svg, x, y) {
  const [vb, kasten] = await Promise.all([svg.getAttribute('viewBox'), svg.boundingBox()]);
  const [, , w, h] = vb.split(' ').map(Number), s = Math.min(kasten.width / w, kasten.height / h);
  await page.mouse.move(kasten.x + (kasten.width - w * s) / 2 + x * s, kasten.y + (kasten.height - h * s) / 2 + y * s);
}

test('R00152 US-1 (AK 4): im Burndown zählt die verworfene Aufgabe ab dem Archivtag nicht mehr — 05.11. und 06.11. offen 4, Umfang 9', async ({ page }) => {
  const k = await kanbanStarten(grundbestandB);
  try {
    await berichtAm(page, k, '2026-11-06', 'verlauf');
    await erwarteZeilen(await burndownTabelle(page), reihe(2, [[10, 10], [5, 10], [5, 10], [4, 9], [4, 9]]));
    await expect(page.locator('.endwert').first()).toHaveText('offen 4');
    await expect(page.locator('.endwert.leise')).toHaveText('Umfang 9');
  } finally { await k.stoppen(); }
});

test('R00152 US-2 (AK 4): Burndown, „Wie lange noch“ und Kumulativer Fluss nennen am selben Tag dieselbe Zahl offener Aufgaben', async ({ page }) => {
  const k = await kanbanStarten(grundbestandB);
  try {
    await berichtAm(page, k, '2026-11-06', 'verlauf');
    const burndown = await zeilenTextNach(page, burndownTabelle);
    await page.goto(`${k.adresse}#/berichte/prognose`);
    await expect(page.locator('#wl-kopf')).toHaveText('5 von 9 fertig · „In Arbeit“ 5 von 9 erreicht');
    const zeilenOrt = await tabelle(page, '.tabellenansicht');
    await expect(page.locator('.tabellenansicht thead th')).toHaveText(['Tag', 'Umfang', 'noch nicht in „In Arbeit“', 'noch nicht in „Fertig“']);
    // Spalten der Prognose: Tag, Umfang, noch nicht in „In Arbeit“, noch nicht in „Fertig“
    await erwarteZeilen(zeilenOrt, reihe(2, [[10, 10, 10], [10, 5, 5], [10, 5, 5], [9, 4, 4], [9, 4, 4]]));
    const prognose = await zeilenText(zeilenOrt);
    // dieselbe Zahl je Tag: Burndown „Tag offen Umfang“ gegen Prognose „Tag Umfang … noch nicht in „Fertig““
    expect(burndown.map(z => z.split(' '))).toEqual(prognose.map(z => z.split(' ')).map(([t, umfang, , offen]) => [t, offen, umfang]));
    expect(burndown[4]).toBe('06.11.2026 4 9');
    // der Kumulative Fluss am selben Bestand: Eingang, In Arbeit, Fertig, offen, gesamt, angekommen, fertig
    await page.goto(`${k.adresse}#/berichte/fluss`);
    await erwarteZeilen(await flussTabelle(page), reihe(2, [[10, 0, 0, 10, 10, 10, 0], [5, 0, 5, 5, 10, 10, 5], [5, 0, 5, 5, 10, 10, 5], [4, 0, 5, 4, 9, 10, 5], [4, 0, 5, 4, 9, 10, 5]]));
  } finally { await k.stoppen(); }
});
/** Die Zeilen einer Tabellenansicht, sobald alle fünf Tage des Grundbestands B dastehen. */
async function zeilenTextNach(page, tabelleOeffnen) {
  const zeilenOrt = await tabelleOeffnen(page);
  await expect(zeilenOrt).toHaveCount(5);
  return zeilenText(zeilenOrt);
}

test('R00152 US-3 (AK 2): im Kumulativen Fluss fällt die verworfene Aufgabe am Archivtag aus dem Stapel, der Vortag bleibt', async ({ page }) => {
  const k = await kanbanStarten(grundbestandA());
  try {
    await berichtAm(page, k, '2026-11-10', 'fluss');
    const svg = page.getByRole('img', { name: 'Kumulativer Fluss: Bestand je Spalte je Tag' });
    await bereit(page, svg);
    const tip = page.locator('#tooltip');
    // neun Tage auf 636 Einheiten Breite ab x = 44: der 06.11. ist der fünfte Tag (x = 362), der 05.11. der vierte (x = 282,5)
    await zeigeAuf(page, svg, 362, 150);
    await expect(tip).toHaveText('06.11.2026 · Eingang 1 · In Arbeit 0 · Fertig 2 · offen 1 · gesamt 3 · angekommen 7 · fertig 3');
    await zeigeAuf(page, svg, 283, 150);
    await expect(tip).toHaveText('05.11.2026 · Eingang 4 · In Arbeit 0 · Fertig 3 · offen 4 · gesamt 7 · angekommen 7 · fertig 3');
    // Tabelle: Tag, Eingang, In Arbeit, Fertig, offen, gesamt, angekommen, fertig
    await erwarteZeilen(await flussTabelle(page), reihe(2, [[7, 0, 0, 7, 7, 7, 0], ...Array(3).fill([4, 0, 3, 4, 7, 7, 3]), ...Array(5).fill([1, 0, 2, 1, 3, 7, 3])]));
  } finally { await k.stoppen(); }
});

test('R00152 US-4 (AK 1, AK 6): die erledigte, archivierte Aufgabe bleibt im Umfang — Burndown am 10.11. offen 1, Umfang 3', async ({ page }) => {
  const k = await kanbanStarten(grundbestandA());
  try {
    await berichtAm(page, k, '2026-11-10', 'verlauf');
    await erwarteZeilen(await burndownTabelle(page), reihe(2, [[7, 7], ...Array(3).fill([4, 7]), ...Array(5).fill([1, 3])]));
    await expect(page.locator('#bd-nicht')).toHaveText('Ausgenommen (reporting.burndown: false): 0.');
  } finally { await k.stoppen(); }
});

test('R00152 US-5 (AK 10): der Durchsatz zählt, was erreicht war — am 03.11. drei Aufgaben, gesamt 3', async ({ page }) => {
  const k = await kanbanStarten(grundbestandA());
  try {
    await berichtAm(page, k, '2026-11-10', 'durchsatz');
    const aufloesung = page.getByRole('radiogroup', { name: 'Auflösung' });
    await bereit(page, aufloesung);
    await aufloesung.getByRole('radio', { name: 'je Tag' }).click();
    await expect(aufloesung.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 3');
    await expect(page.locator('#dus-kennzahl')).toContainText('9 Perioden');
    const balken = page.getByRole('img', { name: 'Durchsatz je Zeitraum: erledigte Aufgaben je Periode' }).locator('rect.balken');
    await expect(balken, 'nur der 03.11. trägt einen Balken').toHaveCount(1);
  } finally { await k.stoppen(); }
});

test('R00152 US-6 (AK 13): zurückgeholt zählt an allen Tagen wieder — Burndown und „Wie lange noch“ am 06.–10.11. offen 2, Umfang 4', async ({ page }) => {
  const k = await kanbanStarten(grundbestandA({ archivtag3: null }));
  try {
    await berichtAm(page, k, '2026-11-10', 'verlauf');
    await erwarteZeilen(await burndownTabelle(page), reihe(2, [[7, 7], ...Array(3).fill([4, 7]), ...Array(5).fill([2, 4])]));
    await page.goto(`${k.adresse}#/berichte/fluss`);
    await erwarteZeilen(await flussTabelle(page), reihe(2, [[7, 0, 0, 7, 7, 7, 0], ...Array(3).fill([4, 0, 3, 4, 7, 7, 3]), ...Array(5).fill([2, 0, 2, 2, 4, 7, 3])]));
    await page.goto(`${k.adresse}#/berichte/prognose`);
    await expect(page.locator('#wl-kopf')).toHaveText('2 von 4 fertig · „In Arbeit“ 2 von 4 erreicht');
    await erwarteZeilen(await tabelle(page, '.tabellenansicht'), reihe(2, [[7, 7, 7], ...Array(3).fill([7, 4, 4]), ...Array(5).fill([4, 2, 2])]));
  } finally { await k.stoppen(); }
});

test('R00152 US-7 (AK 12): unter „nur Person st“ fehlen die endgültig gelöschten Aufgaben an allen Tagen — Burndown 5 / 5, Durchsatz gesamt 2', async ({ page }) => {
  const k = await kanbanStarten(grundbestandA({ kopf: NUR_ST }));
  try {
    await berichtAm(page, k, '2026-11-10', 'verlauf');
    await erwarteZeilen(await burndownTabelle(page), reihe(2, [[5, 5], ...Array(3).fill([3, 5]), ...Array(5).fill([1, 3])]));
    await page.goto(`${k.adresse}#/berichte/durchsatz`);
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 2');
  } finally { await k.stoppen(); }
});

test('R00152 AK 7: die verworfene, per reporting ausgenommene Aufgabe steht in Burndown und Kumulativem Fluss nicht unter „Ausgenommen“', async ({ page }) => {
  const k = await kanbanStarten(grundbestandA({ zusatz3: 'reporting: {burndown: false}\n' }));
  try {
    await berichtAm(page, k, '2026-11-10', 'verlauf');
    await erwarteZeilen(await burndownTabelle(page), reihe(2, [[6, 6], ...Array(3).fill([3, 6]), ...Array(5).fill([1, 3])]));
    await expect(page.locator('#bd-nicht')).toHaveText('Ausgenommen (reporting.burndown: false): 0.');
    await page.goto(`${k.adresse}#/berichte/fluss`);
    await expect(page.locator('#fl-nicht')).toHaveText('Ausgenommen (reporting.burndown: false): 0.');
  } finally { await k.stoppen(); }
});
