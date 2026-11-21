// R00193 Wie lange noch: zweite Prognose „Mit Zugang wie in der Messbasis“ (Karte #196)
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen, thema, kontrastVerstoesse } = require('./hilfen');

/* ── Treiber: Ordner mit datierter Geschichte (wie R00168) ── */
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

/* ── Testsprache: heute ist der 05.11.2026, die Messbasis „letzte 10 Tage“ beginnt am 27.10. ── */
/** Rechenbeispiel A aus R00168: vor der Messbasis nichts offen, 10 hinzugekommen, 4 erledigt, 6 offen — Zugang 1,0 gegen Abgang 0,4. */
const beispielA = geschichte(11, [
  ['2026-10-01', [1], []], ['2026-10-02', [], [1]],
  ['2026-10-27', bis(2, 3), [1]], ['2026-10-28', bis(2, 5), [1]], ['2026-10-29', bis(2, 7), [1]], ['2026-10-30', bis(2, 9), [1]], ['2026-10-31', bis(2, 11), [1]],
  ['2026-11-01', bis(3, 11), bis(1, 2)], ['2026-11-02', bis(4, 11), bis(1, 3)], ['2026-11-03', bis(5, 11), bis(1, 4)], ['2026-11-04', bis(6, 11), bis(1, 5)],
]);
/** Zugang 0: sechs Aufgaben lange vor der Messbasis angelegt, in ihr nur erledigt (4 Läufe, 2 offen). */
const ohneZugang = geschichte(6, [
  ['2026-10-01', bis(1, 6), []],
  ['2026-10-28', bis(2, 6), [1]], ['2026-10-30', bis(3, 6), bis(1, 2)], ['2026-11-02', bis(4, 6), bis(1, 3)], ['2026-11-04', bis(5, 6), bis(1, 4)],
]);

const UEBERSCHRIFT = 'Mit Zugang wie in der Messbasis';
const KEIN_ENDE = 'kein Ende innerhalb von 365 Tagen';
const ZEILE_KEIN_ENDE_ABSEHBAR = 'Bei diesem Zugang kein Ende absehbar: Die Prognose rechnet nur mit den heute offenen Aufgaben.';

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
/** Messbasis setzen; fertig erst nach dem Zeichnen mit der Eingabe und dem nach dem Nachladen (ADR-0026 Regel 3, wie R00168). */
async function messbasis(page, tage) {
  const feld = page.getByLabel('Messbasis in Tagen');
  await feld.fill(String(tage));
  const vorher = await page.evaluate(() => window.kdTest.renders());
  await feld.press('Enter');
  await expect(methodik(page)).toContainText(`die letzten ${tage} Tage`);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), 'Zeichnen nach Eingabe und nach dem Nachladen').toBeGreaterThanOrEqual(vorher + 2);
  await bereit(page);
}
const methodik = page => page.locator('.wl-liste').last();
const block = (page, spalte) => page.locator(`.wl-block[data-spalte="${spalte}"]`);
const ersteTabelle = ort => ort.locator('.wl-tab').first();
const ueberschrift = ort => ort.getByText(UEBERSCHRIFT, { exact: true });
const spalteDerTabelle = (tabelle, n) => tabelle.locator(`tbody tr td:nth-child(${n})`);

test('R00193 US-1 (AK 3, AK 5, AK 6; Abnahme der Karte): Beispiel A — unter der ersten Tabelle die zweite, „kein Ende“ oder später, der Hinweis bleibt', async ({ page }, testInfo) => {
  const k = await kanbanStarten(beispielA);
  try {
    await wieLangeNochAm0511(page, k);
    const erledigt = block(page, 'Erledigt');
    await expect(ueberschrift(erledigt)).toBeVisible();
    const zweite = erledigt.locator('.wl-tab').nth(1);
    await expect(zweite.locator('thead th')).toHaveText(['Mit X % Wkt.', 'Fertig zum, 7-Tage-Woche', 'Fertig zum, 5-Tage-Woche', 'Restliche Dauer']);
    await expect(spalteDerTabelle(zweite, 1)).toHaveText(['50 %', '70 %', '85 %', '95 %']);
    // Zugang 1,0 gegen Abgang 0,4 je Tag: in keinem Perzentil ein Ende
    await expect(spalteDerTabelle(zweite, 2)).toHaveText(Array(4).fill(KEIN_ENDE));
    await expect(spalteDerTabelle(zweite, 3)).toHaveText(Array(4).fill(KEIN_ENDE));
    await expect(spalteDerTabelle(zweite, 4)).toHaveText(Array(4).fill('über 365 Kalendertage · über 365 Arbeitstage'));
    // die erste Tabelle, der Hinweis und „Durchsatz Ø“ wie vor der Karte (Werte aus der Spec zu R00168)
    await expect(spalteDerTabelle(ersteTabelle(erledigt), 4)).toHaveText(['14 Kalendertage · 12 Arbeitstage', '17 Kalendertage · 15 Arbeitstage', '20 Kalendertage · 17 Arbeitstage', '24 Kalendertage · 22 Arbeitstage']);
    await expect(erledigt.locator('.wl-scroll + p:not(.sek)').first()).toHaveText(ZEILE_KEIN_ENDE_ABSEHBAR);
    await expect(erledigt.locator('p.sek').first()).toHaveText('Durchsatz Ø 0,4 je Kalendertag aus 4 Läufen · Tagesreihe: 0 0 0 0 0 1 1 1 1 0');
    // je Block mit Prognose und Zugang: auch „Arbeit“
    await expect(ueberschrift(block(page, 'Arbeit'))).toBeVisible();
    // AK 6: ein Punkt der Methodik erklärt die zweite Tabelle
    const punkt = methodik(page).locator('li').filter({ hasText: new RegExp(`^${UEBERSCHRIFT}:`) });
    await expect(punkt).toContainText('Zugang wie in der Messbasis, ohne Rückläufer-Sonderbehandlung, gleichbleibend');
    await expect(punkt).toContainText('kein Ende');
    await erledigt.screenshot({ path: testInfo.outputPath('mit-zugang.png') });
    // ohne neues CSS: die zweite Tabelle ist in beiden Themen so lesbar wie die erste
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      expect(await kontrastVerstoesse(page, ['.wl-block[data-spalte="Erledigt"] .wl-mit-zugang']), t).toEqual([]);
    }

    // AK 6: Messbasis 20 Tage — beide Reihen über dieselben Tage; die erste Tabelle wie in R00168, die zweite weiter ohne Ende
    await messbasis(page, 20);
    await expect(erledigt.locator('p.sek').first()).toContainText('Durchsatz Ø 0,2 je Kalendertag aus 4 Läufen');
    await expect(erledigt.locator('p.sek').last()).toHaveText('Zugang Ø 0,5, Abgang Ø 0,2 je Kalendertag in der Messbasis.');
    await expect(spalteDerTabelle(ersteTabelle(erledigt), 4)).toHaveText(['29 Kalendertage · 20 Arbeitstage', '35 Kalendertage · 26 Arbeitstage', '41 Kalendertage · 32 Arbeitstage', '50 Kalendertage · 40 Arbeitstage']);
    await expect(spalteDerTabelle(erledigt.locator('.wl-tab').nth(1), 2)).toHaveText(Array(4).fill(KEIN_ENDE));
  } finally { await k.stoppen(); }
});

test('R00193 US-2 (AK 1): Zugang 0 — keine zweite Tabelle, der Block wie heute', async ({ page }) => {
  const k = await kanbanStarten(ohneZugang);
  try {
    await wieLangeNochAm0511(page, k);
    const erledigt = block(page, 'Erledigt');
    await expect(spalteDerTabelle(ersteTabelle(erledigt), 1)).toHaveText(['50 %', '70 %', '85 %', '95 %']);
    await expect(erledigt.locator('p.sek').last()).toHaveText('Zugang Ø 0,0, Abgang Ø 0,4 je Kalendertag in der Messbasis.');
    await expect(page.locator('.wl-block .wl-tab')).toHaveCount(2, { message: 'je Block nur die erste Tabelle' });
    await expect(page.locator('.wl-block').getByText(UEBERSCHRIFT)).toHaveCount(0);
  } finally { await k.stoppen(); }
});
