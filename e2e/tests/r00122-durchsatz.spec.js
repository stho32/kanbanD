// R00122 Bericht „Durchsatz je Zeitraum“
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, filterOeffnen, liveBereit, mutanteEinsetzen } = require('./hilfen');

function commitAm(ordner, datum, inhalt, pfad = 'boards/fabrik.md') {
  fs.writeFileSync(ordner + '/' + pfad, inhalt);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

const FILTER = '---\nreport-filter: {period: eigen, from: 2026-11-02, to: 2026-11-11}\n---\n';
const AUFGABEN = Object.fromEntries([1, 2, 3, 4, 5].map(n => [`aufgaben/${String(n).padStart(4, '0')}-a${n}.md`, `---\nid: ${n}\ntitle: a${n}\n---\n`]));

const spalte = namen => namen.length ? namen.map(n => `- #${n}`).join('\n') + '\n' : '';
const board = (kopf, e, a, f) => `${kopf}${spalte(e)}\n## In Arbeit\n\n${spalte(a)}\n## Fertig\n\n${spalte(f)}`;

/** Grundbestand der AK (R00122): Board „fabrik“ (Eingang/In Arbeit/Fertig), Bewegungen 02.–11.11.2026.
    Ziel = Abschlussspalte „Fertig“; Ankünfte #1 04.11., #2 05.11., #3 09.11., #4 11.11. */
function grundbestand(ordner, filter = FILTER) {
  const kopf = `${filter}# fabrik\n\n## Eingang\n\n`;
  einrichten({ ...AUFGABEN, 'boards/fabrik.md': board(kopf, [], [], []) })(ordner);
  commitAm(ordner, '2026-11-02T09:00:00', board(kopf, [1], [], []));
  commitAm(ordner, '2026-11-03T09:00:00', board(kopf, [2], [1], []));
  commitAm(ordner, '2026-11-04T09:00:00', board(kopf, [3], [], [1]));
  commitAm(ordner, '2026-11-05T09:00:00', board(kopf, [3], [], [2, 1]));
  commitAm(ordner, '2026-11-06T09:00:00', board(kopf, [], [3], [2, 1]));
  commitAm(ordner, '2026-11-09T09:00:00', board(kopf, [4], [], [3, 2, 1]));
  commitAm(ordner, '2026-11-10T09:00:00', board(kopf, [4], [], [3, 1]));
  commitAm(ordner, '2026-11-11T09:00:00', board(kopf, [], [], [4, 3, 1]));
}

const diagramm = page => page.getByRole('img', { name: 'Durchsatz je Zeitraum: erledigte Aufgaben je Periode' });
const alsFabrik = page => page.addInitScript(() => localStorage.setItem('kanbanD.board', 'fabrik'));

// Mutantenprobe: KD_MUTANTE setzt eine Datei der Oberfläche mit einem Ersatz aus (Muster r00110/r00116).
test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });

test('R00122 B0564: Menüeintrag in VERLAUF, Route, Fenstertitel, Kopfleiste, Kürzel g u und verborgene Überschrift', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse);
    await page.locator('#t-ber').click();
    const menue = page.getByRole('menu', { name: 'Berichte' });
    const namen = await menue.getByRole('menuitem').allInnerTexts();
    const stelle = t => namen.findIndex(x => x.includes(t));
    expect(stelle('Kumulativer Fluss')).toBeLessThan(stelle('Durchsatz'));
    expect(stelle('Durchsatz')).toBeLessThan(stelle('Wie lange noch'));
    const eintrag = menue.getByRole('menuitem', { name: /^Durchsatz/ });
    await expect(eintrag.locator('svg.i')).toHaveCount(1);
    await expect(eintrag).toContainText('Erledigte Aufgaben je Zeitraum – Balken aus der Git-Geschichte dieses Boards.');
    await eintrag.click();
    await expect(page).toHaveURL(/#\/berichte\/durchsatz$/);
    await expect(page).toHaveTitle('Durchsatz — kanbanD');
    await expect(page.locator('h1.vh')).toHaveText('Berichte · Durchsatz');
    await expect(page.locator('#main .leiste').first()).toContainText('Durchsatz je Zeitraum · liest nur · erledigte Aufgaben je Periode');
    // g u öffnet den Bericht
    await page.locator('body').click({ position: { x: 1200, y: 500 } });
    await page.keyboard.press('g');
    await page.keyboard.press('v');
    await expect(page).toHaveURL(/#\/berichte\/verlauf$/);
    await page.keyboard.press('g');
    await page.keyboard.press('u');
    await expect(page).toHaveURL(/#\/berichte\/durchsatz$/);
    await expect(diagramm(page)).toBeVisible();
  } finally { await k.stoppen(); }
});

test('R00122 B0565 (US-1): zwei Wochenbalken, Ø-Linie, Achsen, Grundlinie, Marken und Kennzahlen', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    const svg = diagramm(page);
    await expect(svg).toBeVisible();
    await expect(svg).toHaveAttribute('role', 'img');
    await expect(svg).toHaveAttribute('aria-label', 'Durchsatz je Zeitraum: erledigte Aufgaben je Periode');
    const balken = svg.locator('rect.balken');
    await expect(balken).toHaveCount(2);
    const werte = await balken.evaluateAll(bs => bs.map(b => [Number(b.getAttribute('y')), Number(b.getAttribute('height'))]));
    expect(werte, 'KW45 und KW46 je Höhe 2').toEqual([[24, 204], [24, 204]]);
    await expect(svg.locator('text.achse:not(.achse-x)')).toHaveText(['0', '1', '2']); // y-Achse bis 2
    await expect(svg.locator('text.achse-x')).toHaveCount(2);
    await expect(svg.locator('text.achse-x').first().locator('tspan')).toHaveText(['KW45', '2026']);
    await expect(svg.locator('text.achse-x').nth(1).locator('tspan')).toHaveText(['KW46', '2026']);
    await expect(svg.locator('line.grund')).toHaveCount(1);
    await expect(svg.locator('line.marke')).toHaveCount(2);
    // Ø-Linie auf der Balkenkante, abweichende Farbe, beschriftet
    const rate = svg.locator('line.rate');
    await expect(rate).toHaveAttribute('y1', '24');
    await expect(svg.locator('text.ratetext')).toHaveText('Ø 2,0 je Woche');
    const [strichRate, fuellungBalken] = await Promise.all([rate.evaluate(e => getComputedStyle(e).stroke), balken.first().evaluate(e => getComputedStyle(e).fill)]);
    expect(strichRate).not.toBe(fuellungBalken);
    // Legende (B1): das Farbfeld trägt denselben Ton wie die Balken, nicht transparent
    const feldFarbe = await page.locator('.fluss-leg .fluss-sw').first().evaluate(e => getComputedStyle(e).backgroundColor);
    expect(feldFarbe).toBe(fuellungBalken);
    // Legende spricht von „erledigten Aufgaben" (S1), die Tabelle ebenso
    await expect(page.locator('.fluss-leg')).toContainText('erledigte Aufgaben');
    // Kennzahlenzeile (M4)
    const kz = page.locator('#dus-kennzahl');
    await expect(kz).toContainText('Gesamt 4');
    await expect(kz).toContainText('Ø 2,0 je Woche');
    await expect(kz).toContainText('2 Perioden');
  } finally { await k.stoppen(); }
});

test('R00122 B0566 (US-2): Auflösung je Tag und je Monat — Balken, x-Achse und Kennzahlen wechseln, per Tastatur', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    const um = page.getByRole('radiogroup', { name: 'Auflösung' });
    await expect(um.getByRole('radio', { name: 'je Woche' })).toHaveAttribute('aria-checked', 'true');
    await um.getByRole('radio', { name: 'je Tag' }).click();
    await expect(um.getByRole('radio', { name: 'je Tag' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#dus-kennzahl')).toContainText('Ø 0,4 je Tag');
    await expect(page.locator('#dus-kennzahl')).toContainText('10 Perioden');
    await expect(diagramm(page).locator('rect.balken')).toHaveCount(4);
    await expect(diagramm(page).locator('text.achse-x')).toHaveCount(6); // 10 Tage, höchstens acht Marken
    // per Tastatur auf „je Monat“ (M3)
    await um.getByRole('radio', { name: 'je Tag' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(um.getByRole('radio', { name: 'je Monat' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('#dus-kennzahl')).toContainText('Ø 4,0 je Monat');
    await expect(page.locator('#dus-kennzahl')).toContainText('1 Periode');
    await expect(diagramm(page).locator('rect.balken')).toHaveCount(1);
    await expect(diagramm(page).locator('text.achse-x')).toHaveText('November 2026');
  } finally { await k.stoppen(); }
});

test('R00122 B0567 (US-1, US-5): Tabelle mit Summe, Tooltip und zeigerlose Bedienung', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    // Tooltip auf dem Balken der KW46
    await diagramm(page).locator('rect.balken').nth(1).hover();
    const tip = page.locator('#tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Woche 09.–15.11.2026 · 2');
    await page.mouse.move(1, 1);
    await expect(tip).toBeHidden();
    // Tabellenansicht (M5)
    await expect(page.locator('.fluss-tabs > summary')).toHaveText('Tabellenansicht');
    await page.locator('.fluss-tabs > summary').click();
    const rahmen = page.locator('.bericht-rahmen');
    await expect(rahmen).toHaveAttribute('tabindex', '0');
    await expect(rahmen).toHaveAttribute('role', 'group');
    await expect(rahmen).toHaveAttribute('aria-label', 'Durchsatz je Zeitraum');
    const tabelle = page.locator('.fluss-tab');
    await expect(tabelle.locator('thead th')).toHaveText(['Zeitraum', 'Erledigt']);
    await expect(tabelle.locator('thead th').first()).toHaveAttribute('scope', 'col');
    await expect(tabelle.locator('tbody tr')).toHaveCount(2);
    await expect(tabelle.locator('tbody tr').nth(1).locator('td')).toHaveText(['KW46 09.–15.11.2026', '2']);
    await expect(tabelle.locator('tfoot th')).toHaveText('Summe');
    await expect(tabelle.locator('tfoot th')).toHaveAttribute('scope', 'row');
    await expect(tabelle.locator('tfoot td')).toHaveText('4');
    // zeigerlos: der Rahmen ist per Tab erreichbar
    await rahmen.focus();
    expect(await rahmen.evaluate(el => el === document.activeElement)).toBe(true);
  } finally { await k.stoppen(); }
});

test('R00122 US-4 (B0569): Zeitraum 05.–11.11. begrenzt die Ankünfte', async ({ page }) => {
  const k = await kanbanStarten(ordner => grundbestand(ordner, '---\nreport-filter: {period: eigen, from: 2026-11-05, to: 2026-11-11}\n---\n'));
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 3');
    await page.locator('.fluss-tabs > summary').click();
    await expect(page.locator('.fluss-tab tbody tr').first().locator('td')).toHaveText(['KW45 02.–08.11.2026', '1']);
    await expect(page.locator('.fluss-tab tbody tr').nth(1).locator('td')).toHaveText(['KW46 09.–15.11.2026', '2']);
  } finally { await k.stoppen(); }
});

test('R00122 US-3: die leere Periode KW47 trägt ihre Marke (als 0 erkennbar) und senkt die Ø-Linie', async ({ page }) => {
  const k = await kanbanStarten(async ordner => {
    const kopf = '# fabrik\n\n## Eingang\n\n';
    einrichten({ ...AUFGABEN, 'boards/fabrik.md': board(kopf, [], [], []) })(ordner);
    commitAm(ordner, '2026-11-02T09:00:00', board(kopf, [1], [], []));
    commitAm(ordner, '2026-11-03T09:00:00', board(kopf, [2], [1], []));
    commitAm(ordner, '2026-11-04T09:00:00', board(kopf, [3], [], [1]));
    commitAm(ordner, '2026-11-05T09:00:00', board(kopf, [3], [], [2, 1]));
    commitAm(ordner, '2026-11-06T09:00:00', board(kopf, [], [3], [2, 1]));
    commitAm(ordner, '2026-11-09T09:00:00', board(kopf, [4], [], [3, 2, 1]));
    commitAm(ordner, '2026-11-10T09:00:00', board(kopf, [4], [], [3, 1]));
    commitAm(ordner, '2026-11-11T09:00:00', board(kopf, [], [], [4, 3, 1]));
    commitAm(ordner, '2026-11-16T09:00:00', board(kopf, [5], [], [4, 3, 1]));
  });
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.clock.setFixedTime(new Date('2026-11-20T12:00:00'));
    await page.goto(k.adresse + '#/berichte/durchsatz');
    const svg = diagramm(page);
    await expect(svg.locator('text.achse-x')).toHaveCount(3);
    await expect(svg.locator('text.achse-x').nth(2).locator('tspan')).toHaveText(['KW47', '2026']);
    await expect(svg.locator('line.marke')).toHaveCount(3, 'auch die leere Periode hat ihre Marke');
    await expect(svg.locator('rect.balken')).toHaveCount(2, 'die leere KW47 hat keinen Balken');
    await expect(page.locator('#dus-kennzahl')).toContainText('Ø 1,3 je Woche');
    await expect(page.locator('#dus-kennzahl')).toContainText('3 Perioden');
    await expect(svg.locator('text.ratetext')).toHaveText('Ø 1,3 je Woche');
  } finally { await k.stoppen(); }
});

test('R00122 B0568 (M7): kein Stand, Zielspalte ausgeschlossen mit Zurücksetzen, leere Periode mit Zurücksetzen', async ({ page }) => {
  // Board ohne jede Bewegung
  const k0 = await kanbanStarten(einrichten({ 'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n## In Arbeit\n\n## Fertig\n' }));
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k0.adresse + '#/berichte/durchsatz');
    await expect(page.locator('.fluss-satz')).toHaveText('Noch kein Stand dieses Boards.');
  } finally { await k0.stoppen(); }

  // Zielspalte ausgeschlossen
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    await filterOeffnen(page);
    await page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.fluss-satz')).toHaveText('Die Zielspalte „Fertig“ ist ausgeschlossen.');
    await page.locator('.fluss-leer').getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(diagramm(page)).toBeVisible();
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 4');
  } finally { await k.stoppen(); }

  // aktiver Filter ohne Treffer → Leersatz mit „Zurücksetzen“ (US-7)
  const k2 = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k2.adresse + '#/berichte/durchsatz');
    await filterOeffnen(page);
    await page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'ohne Klasse' }).click();
    const leer = page.locator('.fluss-leer');
    await expect(leer.locator('.fluss-satz')).toHaveText('Keine Aufgabe im Zeitraum.');
    await leer.getByRole('button', { name: 'Zurücksetzen' }).click();
    await expect(diagramm(page)).toBeVisible();
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 4');
  } finally { await k2.stoppen(); }
});

test('R00122 B0563 (M7): reporting.forecast false nimmt aus und nennt die Zahl', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    const antwort = await page.request.patch(k.adresse + 'api/aufgaben/3', { headers: { 'X-KanbanD-Wer': 'st' }, data: { reporting: { forecast: false } } });
    expect(antwort.ok()).toBe(true);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 3');
    await expect(page.locator('#dus-nicht')).toContainText('Nicht enthalten: ausgenommen 1');
    await expect(diagramm(page).locator('rect.balken')).toHaveCount(2);
  } finally { await k.stoppen(); }
});

test('R00122 B0568: Live — eine über die API bewegte Aufgabe ändert den Durchsatz ohne Neuladen', async ({ page }) => {
  const k = await kanbanStarten(ordner => {
    grundbestand(ordner, '');
    // #5 liegt auf dem Board (Eingang), damit es nach „Fertig“ bewegt werden kann
    commitAm(ordner, '2026-11-11T10:00:00', board('# fabrik\n\n## Eingang\n\n', [5], [], [4, 3, 1]));
  });
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    await liveBereit(page);
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 4');
    const bewegt = await page.request.post(k.adresse + 'api/boards/fabrik/bewegen', { headers: { 'X-KanbanD-Wer': 'st' }, data: { nummer: 5, spalte: 'Fertig' } });
    expect(bewegt.ok()).toBe(true);
    await expect(page.locator('#dus-kennzahl')).toContainText('Gesamt 5', { timeout: 3000 });
  } finally { await k.stoppen(); }
});

test('R00122 B0570 (F0094): „Zurücksetzen“ hebt nur Gezeigtes auf, der Zeitraum bleibt in der Board-Datei', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    await filterOeffnen(page);
    const filter = page.getByRole('group', { name: 'Berichtsfilter' });
    await filter.getByRole('button', { name: 'Eingang' }).click();
    const zurueck = page.locator('.bfilter .bf-leeren');
    await expect(zurueck).toContainText('Zurücksetzen 1'); // der Zeitraum zählt nicht mit
    await zurueck.click();
    await expect(page.locator('.bfilter .bf-leeren')).toHaveCount(0);
    await filterOeffnen(page);
    await expect(page.getByLabel('Zeitraum', { exact: true })).toHaveValue('eigen');
    expect(k.lies('boards/fabrik.md')).toContain('report-filter');
    expect(k.lies('boards/fabrik.md')).toContain('from: 2026-11-02');
    expect(k.lies('boards/fabrik.md')).not.toContain('exclude-columns');
    // der Burndown sieht denselben Zeitraum
    await page.goto(k.adresse + '#/berichte/verlauf');
    await expect(page.locator('.endwert').first()).toBeVisible();
  } finally { await k.stoppen(); }
});

test('R00122: Gegenprobe — der Bericht liest nur (boards/fabrik.md byte-gleich, git log unverändert)', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.goto(k.adresse + '#/berichte/durchsatz');
    const datei = k.lies('boards/fabrik.md'), log = k.git('log', '--oneline');
    // Klick auf einen Balken öffnet nichts und ändert keinen Filter
    await diagramm(page).locator('rect.balken').first().click();
    await expect(page).toHaveURL(/#\/berichte\/durchsatz$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    // Umschalten der Auflösung schreibt nichts
    await page.getByRole('radiogroup', { name: 'Auflösung' }).getByRole('radio', { name: 'je Monat' }).click();
    await page.goto(k.adresse + '#/berichte/verlauf');
    await expect(page.locator('.endwert').first()).toBeVisible();
    expect(k.lies('boards/fabrik.md')).toBe(datei);
    expect(k.git('log', '--oneline')).toBe(log);
  } finally { await k.stoppen(); }
});

for (const breite of [320, 375, 414]) {
  test(`R00122 B0645 (M8): ${breite} px ohne Querscrollen, höchstens acht Periodenmarken`, async ({ page }) => {
    const k = await kanbanStarten(ordner => grundbestand(ordner, ''));
    try {
      await alsPerson(page, 'st');
      await alsFabrik(page);
      await page.setViewportSize({ width: breite, height: 900 });
      await page.goto(k.adresse + '#/berichte/durchsatz');
      await expect(diagramm(page)).toBeVisible();
      await page.getByRole('radiogroup', { name: 'Auflösung' }).getByRole('radio', { name: 'je Tag' }).click();
      expect(await diagramm(page).locator('text.achse-x').count()).toBeLessThanOrEqual(8);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    } finally { await k.stoppen(); }
  });
}

test('R00122 B0645 (M8): je Tag über 16 Perioden → höchstens acht Marken, 320 px ohne Querscrollen', async ({ page }) => {
  const k = await kanbanStarten(async ordner => {
    const kopf = '# fabrik\n\n## Eingang\n\n';
    const p2 = n => String(n).padStart(2, '0');
    const vor = n => { const d = new Date(Date.now() - n * 864e5); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T09:00:00`; };
    einrichten({ ...AUFGABEN, 'boards/fabrik.md': board(kopf, [], [], []) })(ordner);
    commitAm(ordner, vor(30), board(kopf, [1], [], []));
    commitAm(ordner, vor(29), board(kopf, [], [], [1]));
  });
  try {
    await alsPerson(page, 'st');
    await alsFabrik(page);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto(k.adresse + '#/berichte/durchsatz');
    await page.getByRole('radiogroup', { name: 'Auflösung' }).getByRole('radio', { name: 'je Tag' }).click();
    const anzahl = await diagramm(page).locator('text.achse-x').count();
    expect(anzahl).toBeGreaterThan(0);
    expect(anzahl).toBeLessThanOrEqual(8);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  } finally { await k.stoppen(); }
});

test.describe('R00122 B0645 (M6): Zielgrößen bei Touch, 375 px', () => {
  test.use({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
  test('Auflösungs-Umschalter, <summary> und Filter-Chips mindestens 44 hoch', async ({ page }) => {
    const k = await kanbanStarten(grundbestand);
    try {
      await alsPerson(page, 'st');
      await alsFabrik(page);
      await page.goto(k.adresse + '#/berichte/durchsatz');
      await filterOeffnen(page);
      const hoehen = await page.evaluate(() => ({
        um: [...document.querySelectorAll('.dus-um [role=radio]')].map(e => e.getBoundingClientRect().height),
        summary: document.querySelector('.fluss-tabs > summary').getBoundingClientRect().height,
        chip: document.querySelector('.bfilter .bf-chip').getBoundingClientRect().height,
      }));
      for (const h of [...hoehen.um, hoehen.summary, hoehen.chip]) expect(h).toBeGreaterThanOrEqual(44);
    } finally { await k.stoppen(); }
  });
});
