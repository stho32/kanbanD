// R00168 Wie lange noch: Hinweis, wenn der Zugang den Abgang erreicht (ADR-0027 N4, Karte #158)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen } = require('./hilfen');

/* ── Treiber: Ordner mit datierter Geschichte ── */
const BOARD = 'boards/fabrik.md';
const zeilen = nummern => nummern.map(n => `- #${n}\n`).join('');
const board = (backlog, erledigt) => `# fabrik\n\n## Backlog\n\n${zeilen(backlog)}\n## Arbeit\n\n\n## Erledigt\n\n${zeilen(erledigt)}`;
const datei = n => `aufgaben/${String(n).padStart(4, '0')}-a${n}.md`;
const aufgabe = n => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n---\n`;
/** Legt `anzahl` Aufgaben an und hält je Schritt `[Datum, Backlog, Erledigt]` den Stand des Boards als Commit dieses Tages fest. */
const geschichte = (anzahl, schritte) => ordner => {
  einrichten({ ...Object.fromEntries(bis(1, anzahl).map(n => [datei(n), aufgabe(n)])), [BOARD]: board([], []) })(ordner);
  for (const [datum, backlog, erledigt] of schritte) {
    fs.writeFileSync(path.join(ordner, BOARD), board(backlog, erledigt));
    const zeit = `${datum}T09:00:00`;
    execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: zeit, GIT_COMMITTER_DATE: zeit } });
  }
};
const bis = (von, ende) => [...Array(Math.max(0, ende - von + 1))].map((_, i) => von + i);

/* ── Testsprache: die Rechenbeispiele der Anforderung; heute ist der 05.11.2026, die Messbasis „letzte 10 Tage“ beginnt am 27.10. ── */
/** Beispiel A: vor der Messbasis nichts offen (#1 lange vorher erledigt), 10 hinzugekommen, 4 erledigt, 6 offen. */
const beispielA = geschichte(11, [
  ['2026-10-01', [1], []], ['2026-10-02', [], [1]],
  ['2026-10-27', bis(2, 3), [1]], ['2026-10-28', bis(2, 5), [1]], ['2026-10-29', bis(2, 7), [1]], ['2026-10-30', bis(2, 9), [1]], ['2026-10-31', bis(2, 11), [1]],
  ['2026-11-01', bis(3, 11), bis(1, 2)], ['2026-11-02', bis(4, 11), bis(1, 3)], ['2026-11-03', bis(5, 11), bis(1, 4)], ['2026-11-04', bis(6, 11), bis(1, 5)],
]);
/** Beispiel B: 5 vor der Messbasis offen, 2 hinzugekommen, 4 erledigt, 3 offen. */
const beispielB = geschichte(7, [
  ['2026-10-20', bis(1, 5), []], ['2026-10-28', bis(1, 6), []], ['2026-10-29', bis(1, 7), []],
  ['2026-10-30', bis(2, 7), [1]], ['2026-10-31', bis(3, 7), bis(1, 2)], ['2026-11-02', bis(4, 7), bis(1, 3)], ['2026-11-03', bis(5, 7), bis(1, 4)],
]);
/** 4 offen, 2 erledigt in der Messbasis: unter drei Läufen. */
const zweiLaeufe = geschichte(6, [['2026-10-20', bis(1, 6), []], ['2026-10-30', bis(2, 6), [1]], ['2026-10-31', bis(3, 6), bis(1, 2)]]);

const ZEILE_KEIN_ENDE = 'Bei diesem Zugang kein Ende absehbar: Die Prognose rechnet nur mit den heute offenen Aufgaben.';
const METHODIK_ZUGANG = 'Zugang: Aufgaben, die in der Messbasis offen wurden (neu oder zurückgeholt), abzüglich der entfernten; Abgang ist der Durchsatz. Die Prognose rechnet ohne Zugang.';

/* ── Treiber: Oberfläche ── */
/** Öffnet „Wie lange noch“ des Boards „fabrik“ am 05.11.2026, 12:00 Uhr (ADR-0026 Regel 6: feste Browser-Uhr), Messbasis 10 Tage. */
async function wieLangeNochAm0511(page, k) {
  await alsPerson(page, 'st');
  await page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));
  await page.clock.setFixedTime(new Date('2026-11-05T12:00:00+01:00'));
  await page.goto(`${k.adresse}#/berichte/prognose`);
  await filterOeffnen(page);
  await messbasis(page, 10);
}
/** Stellt die Messbasis ein; fertig ist es, wenn die Methodik die neue Zahl nennt und die Ansicht steht. */
async function messbasis(page, tage) {
  const feld = page.getByLabel('Messbasis in Tagen');
  await feld.fill(String(tage));
  await feld.press('Enter');
  await expect(methodik(page)).toContainText(`die letzten ${tage} Tage`);
  await bereit(page);
}
const methodik = page => page.locator('.wl-liste').last();
const block = (page, spalte) => page.locator(`.wl-phase[data-spalte="${spalte}"]`);
const messzeilen = ort => ort.locator('p.sek');
const restlicheDauer = ort => ort.locator('.wl-tab tbody tr td:nth-child(4)');
/** Der Absatz direkt unter der Prognosetabelle; die Messzeilen (`p.sek`) sind es nicht. */
const unterDerTabelle = ort => ort.locator('.wl-scroll + p:not(.sek)');

test('R00168 US-1 (AK 1, AK 3, AK 6; Abnahme der Karte): Zugang Ø 1,0 gegen Abgang Ø 0,4 — „kein Ende absehbar“, die Prognosetabelle wie zuvor', async ({ page }, testInfo) => {
  const k = await kanbanStarten(beispielA);
  try {
    await wieLangeNochAm0511(page, k);
    const erledigt = block(page, 'Erledigt');
    await expect(messzeilen(erledigt)).toHaveText(['Durchsatz Ø 0,4 je Kalendertag aus 4 Läufen · Tagesreihe: 0 0 0 0 0 1 1 1 1 0', 'Zugang Ø 1,0, Abgang Ø 0,4 je Kalendertag in der Messbasis.']);
    await expect(unterDerTabelle(erledigt)).toHaveText(ZEILE_KEIN_ENDE);
    // Werte von main (e819a47), vor der Karte gerechnet
    await expect(restlicheDauer(erledigt)).toHaveText(['14 Kalendertage · 12 Arbeitstage', '17 Kalendertage · 15 Arbeitstage', '20 Kalendertage · 17 Arbeitstage', '24 Kalendertage · 22 Arbeitstage']);
    await expect(methodik(page).locator('li').filter({ hasText: /^Zugang:/ })).toHaveText(METHODIK_ZUGANG);
    // je Block: auch „Arbeit“ trägt beide Zeilen (dieselben 4 Läufe, 10 hinzugekommen)
    await expect(messzeilen(block(page, 'Arbeit')).last()).toHaveText('Zugang Ø 1,0, Abgang Ø 0,4 je Kalendertag in der Messbasis.');
    await erledigt.screenshot({ path: testInfo.outputPath('kein-ende-absehbar.png') });

    // AK 6: dieselben Tage für beide Mittel — über 20 Tage 10 : 20 und 4 : 20
    await messbasis(page, 20);
    await expect(messzeilen(erledigt).last()).toHaveText('Zugang Ø 0,5, Abgang Ø 0,2 je Kalendertag in der Messbasis.');
    await expect(messzeilen(erledigt).first()).toContainText('Durchsatz Ø 0,2 je Kalendertag aus 4 Läufen');
    await expect(unterDerTabelle(erledigt)).toHaveText(ZEILE_KEIN_ENDE);
    await expect(restlicheDauer(erledigt)).toHaveText(['29 Kalendertage · 20 Arbeitstage', '35 Kalendertage · 26 Arbeitstage', '41 Kalendertage · 32 Arbeitstage', '50 Kalendertage · 40 Arbeitstage']);
  } finally { await k.stoppen(); }
});

test('R00168 US-2 (AK 2, AK 3): Zugang Ø 0,2 unter Abgang Ø 0,4 — nur die Zeile mit den beiden Mitteln', async ({ page }) => {
  const k = await kanbanStarten(beispielB);
  try {
    await wieLangeNochAm0511(page, k);
    const erledigt = block(page, 'Erledigt');
    await expect(messzeilen(erledigt)).toHaveText(['Durchsatz Ø 0,4 je Kalendertag aus 4 Läufen · Tagesreihe: 0 0 0 1 1 0 1 1 0 0', 'Zugang Ø 0,2, Abgang Ø 0,4 je Kalendertag in der Messbasis.']);
    await expect(restlicheDauer(erledigt)).toHaveText(['7 Kalendertage · 6 Arbeitstage', '9 Kalendertage · 8 Arbeitstage', '11 Kalendertage · 10 Arbeitstage', '14 Kalendertage · 13 Arbeitstage']);
    await expect(unterDerTabelle(erledigt)).toHaveCount(0);
    await expect(page.getByText('kein Ende absehbar')).toHaveCount(0);
  } finally { await k.stoppen(); }
});

test('R00168 US-3 (AK 4): ohne Prognose keine der beiden Zeilen — es bleibt der heutige Satz', async ({ page }) => {
  const k = await kanbanStarten(zweiLaeufe);
  try {
    await wieLangeNochAm0511(page, k);
    const erledigt = block(page, 'Erledigt');
    await expect(erledigt.getByText('4 offen — keine Prognose unter 3 Läufen in der Messbasis (gemessen: 2).')).toBeVisible();
    await expect(messzeilen(erledigt)).toHaveText([/^Durchsatz Ø 0,2 je Kalendertag aus 2 Läufen/]);
    await expect(page.locator('.wl-phase').getByText(/Zugang Ø|kein Ende absehbar/)).toHaveCount(0);
  } finally { await k.stoppen(); }
});
