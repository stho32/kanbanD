// R00170 Schnell hintereinander gesetzte Fever-Einstellungen bleiben alle erhalten (ADR-0025 N3 Regel 7, Karte #177)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');

/* ── Testsprache: der Grundbestand der Anforderung ── */
const BOARD = 'boards/fabrik.md';
const ZWEITES = 'boards/zweites.md';
const boardText = (titel, nummer) => `# ${titel}\n\n## Backlog\n\n- #${nummer}\n\n## Arbeit\n\n## Erledigt\n`;
const aufgabe = n => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n---\n`;
/** Zwei Boards mit Backlog · Arbeit · Erledigt, je eine Aufgabe, kein `fever` in der Board-Datei. */
const grundbestand = einrichten({ 'aufgaben/0001-a1.md': aufgabe(1), 'aufgaben/0002-a2.md': aufgabe(2), [BOARD]: boardText('fabrik', 1), [ZWEITES]: boardText('zweites', 2) });
const ALS_STEFAN = { headers: { 'X-KanbanD-Wer': 'st' } };
const EINGESTELLT = 'Stefan|Fever Chart von „fabrik“ eingestellt: ';

/* ── Treiber: Oberfläche und Ordner ── */
/** Öffnet einen Bericht des Boards „fabrik“ als Stefan. */
async function berichtOeffnen(page, k, route) {
  await alsPerson(page, 'st');
  await page.addInitScript(() => { if (!localStorage.getItem('kanbanD.board')) localStorage.setItem('kanbanD.board', 'fabrik'); });
  await page.goto(`${k.adresse}#/berichte/${route}`);
  await steht(page, route);
}
/** Der Bericht ist geladen und gezeichnet; der Anker ist ein Feld, das nur dieser Bericht zeigt. */
const steht = (page, route = 'fieber') => bereit(page, `#main [data-fb="${route === 'fieber' ? 'puffer' : 'vonspalte'}"]`);
/**
 * Löst die Schritte direkt nacheinander aus, ohne auf Antwort oder Nachladen zu warten (ein `page.evaluate`, kein `await`):
 * `[feld, wert]` setzt das Feld `data-fb` und meldet `change`, `['klick', aktion]` klickt den Knopf `data-act`,
 * `['adresse', hash]` wechselt die Adresse. Ein Wert, den die Auswahl nicht anbietet, wird als Eintrag ergänzt.
 */
const inEinemZug = (page, schritte) => page.evaluate(liste => {
  for (const [feld, wert] of liste) {
    if (feld === 'klick') { document.querySelector(`[data-act="${wert}"]`).click(); continue; }
    if (feld === 'adresse') { location.hash = wert; continue; }
    const el = document.querySelector(`[data-fb="${feld}"]`);
    if (el.tagName === 'SELECT' && ![...el.options].some(o => o.value === wert)) el.add(new Option(wert, wert));
    el.value = wert;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}, schritte);
const feld = (page, name) => page.locator(`#main [data-fb="${name}"]`);
const kopf = (k, rel = BOARD) => k.lies(rel).split('# ')[0];
const commitsVonStefanSeit = (k, stand) => k.git('log', '--reverse', '--format=%an|%s', `${stand}..HEAD`).split('\n').filter(z => z.startsWith('Stefan|'));
/** Hält die `PUT …/fieber`-Anfragen der Seite an, bis `freigeben()` gerufen wird. */
async function fieberAnfragenHalten(page) {
  let freigeben;
  const frei = new Promise(ok => { freigeben = ok; });
  await page.route(url => url.pathname.endsWith('/fieber'), async route => {
    if (route.request().method() === 'PUT') await frei;
    await route.continue();
  });
  return freigeben;
}

const DREI_IM_FEVER_CHART = [['puffer', '7'], ['perzentil', '70'], ['aufloesung', '7']];

test('R00170 US-1, AK 1, AK 3 (B0830, Abnahme der Karte #177): Puffer 7, Perzentil 70 und Auflösung Woche direkt nacheinander — die Board-Datei trägt alle drei, die Anzeige zeigt sie, drei Commits in der Reihenfolge der Eingabe', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await berichtOeffnen(page, k, 'fieber');
    const vorher = k.git('rev-parse', 'HEAD');
    await inEinemZug(page, DREI_IM_FEVER_CHART);
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 7, percentile: 70, resolution: week}\n---\n\n');
    await steht(page);
    await expect(feld(page, 'puffer')).toHaveValue('7');
    await expect(feld(page, 'perzentil')).toHaveValue('70');
    await expect(feld(page, 'aufloesung')).toHaveValue('7');
    // die Auflösung steht nicht in der Meldung: der dritte Commit nennt denselben Stand wie der zweite
    expect(commitsVonStefanSeit(k, vorher)).toEqual([`${EINGESTELLT}Puffer 7 Arbeitstage, P95`, `${EINGESTELLT}Puffer 7 Arbeitstage, P70`, `${EINGESTELLT}Puffer 7 Arbeitstage, P70`]);
    expect(k.git('log', '-3', '--format=%an', '--', BOARD).split('\n')).toEqual(['Stefan', 'Stefan', 'Stefan']);
  } finally { await k.stoppen(); }
});

test('R00170 US-2, AK 2 (B0831): „Zugang ab“ und „Erledigt heißt“ im Durchsatz in einem Zug auf Arbeit — beide stehen in der Board-Datei und nach dem Neuladen in beiden Auswahlen', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await berichtOeffnen(page, k, 'durchsatz');
    await inEinemZug(page, [['vonspalte', 'Arbeit'], ['zielspalte', 'Arbeit']]);
    await expect.poll(() => kopf(k)).toBe('---\nfever: {target-column: Arbeit, from-column: Arbeit}\n---\n\n');
    await page.reload();
    await steht(page, 'durchsatz');
    await expect(page.getByRole('combobox', { name: 'Zugang ab' })).toHaveValue('Arbeit');
    await expect(page.getByRole('combobox', { name: 'Erledigt heißt' })).toHaveValue('Arbeit');
  } finally { await k.stoppen(); }
});

test('R00170 AK 4 (B0831): eine einzelne Änderung wie vor der Karte — Puffer 7 ergibt genau einen Commit mit der bisherigen Meldung, die Anzeige zeigt ihn', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await berichtOeffnen(page, k, 'fieber');
    const vorher = k.git('rev-parse', 'HEAD');
    await feld(page, 'puffer').fill('7');
    await feld(page, 'puffer').press('Enter');
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 7}\n---\n\n');
    await steht(page);
    await expect(feld(page, 'puffer')).toHaveValue('7');
    await expect(feld(page, 'perzentil')).toHaveValue('95');
    await expect(page.locator('#main .fb-einst [role="alert"]')).toHaveCount(0);
    expect(commitsVonStefanSeit(k, vorher)).toEqual([`${EINGESTELLT}Puffer 7 Arbeitstage, P95`]);
  } finally { await k.stoppen(); }
});

test('R00170 AK 6 (B0831): „Puffer vorschlagen“ direkt nach dem Wechsel auf Arbeitstage rechnet mit Arbeitstagen und behält sie — 30 Arbeitstage ergeben Puffer 10, nicht 13 aus 39 Kalendertagen', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    // Montag 02.11.2026 bis Freitag 11.12.2026: sechs volle Wochen
    await page.request.put(`${k.adresse}api/boards/fabrik/start`, { ...ALS_STEFAN, data: { start: '2026-11-02' } });
    await page.request.put(`${k.adresse}api/boards/fabrik/termine`, { ...ALS_STEFAN, data: [{ name: 'Lieferung', datum: '2026-12-11', farbe: 'red', ziel: true }] });
    await page.request.put(`${k.adresse}api/boards/fabrik/fieber`, { ...ALS_STEFAN, data: { woche: 7 } });
    expect(k.lies(BOARD)).toContain('fever: {week: 7}\n');
    await berichtOeffnen(page, k, 'fieber');
    await expect(page.locator('#main [data-act="fb-vorschlag"]')).toBeEnabled();
    await inEinemZug(page, [['woche', '5'], ['klick', 'fb-vorschlag']]);
    await expect.poll(() => k.lies(BOARD)).toContain('fever: {buffer: 10}\n');
    await steht(page);
    await expect(feld(page, 'woche')).toHaveValue('5');
    await expect(feld(page, 'puffer')).toHaveValue('10');
  } finally { await k.stoppen(); }
});

test('R00170 (B0831, Schadensstelle c): nach einem übernommenen Laden gilt wieder der geladene Stand — eine Änderung von außen (Puffer 9, P85) übersteht die nächste eigene Änderung', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await berichtOeffnen(page, k, 'fieber');
    await inEinemZug(page, [['puffer', '7'], ['perzentil', '70']]);
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 7, percentile: 70}\n---\n\n');
    await page.request.put(`${k.adresse}api/boards/fabrik/fieber`, { ...ALS_STEFAN, data: { puffer: 9, perzentil: 85 } });
    // der Wechsel der Adresse lädt sicher neu, auch wenn das Live-Ereignis ausbleibt
    await page.goto(`${k.adresse}#/berichte/durchsatz`);
    await steht(page, 'durchsatz');
    await page.goto(`${k.adresse}#/berichte/fieber`);
    await expect(feld(page, 'puffer')).toHaveValue('9');
    await steht(page);
    await inEinemZug(page, [['aufloesung', '7']]);
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 9, percentile: 85, resolution: week}\n---\n\n');
  } finally { await k.stoppen(); }
});

test('R00170 US-3, AK 5 (B0832): lehnt der Server das mittlere von drei (Perzentil 60) ab, steht die Meldung am Formular; Puffer 7 und Auflösung Woche sind gespeichert, das Perzentil 60 nirgends, auch nicht nach der nächsten Änderung', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await berichtOeffnen(page, k, 'fieber');
    const vorher = k.git('rev-parse', 'HEAD');
    await inEinemZug(page, [['puffer', '7'], ['perzentil', '60'], ['aufloesung', '7']]);
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 7, resolution: week}\n---\n\n');
    await expect(page.locator('#main .fb-einst [role="alert"]')).toHaveText('Perzentil 60 ist nicht 50, 70, 85 oder 95');
    await steht(page);
    await expect(feld(page, 'perzentil')).toHaveValue('95');
    await expect(feld(page, 'puffer')).toHaveValue('7');
    expect(commitsVonStefanSeit(k, vorher)).toEqual([`${EINGESTELLT}Puffer 7 Arbeitstage, P95`, `${EINGESTELLT}Puffer 7 Arbeitstage, P95`]);
    // der abgelehnte Wert wird auch später nicht mitgeschickt
    await inEinemZug(page, [['puffer', '8']]);
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 8, resolution: week}\n---\n\n');
    expect(k.git('log', '-p', `${vorher}..HEAD`, '--', BOARD)).not.toContain('percentile');
  } finally { await k.stoppen(); }
});

test('R00170 (B0832, Schadensstelle b): Boardwechsel zwischen Auslösen und Senden — beide Änderungen landen im Board, in dem sie ausgelöst wurden; das andere Board bekommt danach nur seine eigene', async ({ page }) => {
  const k = await kanbanStarten(grundbestand);
  try {
    await berichtOeffnen(page, k, 'fieber');
    const freigeben = await fieberAnfragenHalten(page);
    const zweitesVorher = k.lies(ZWEITES);
    await inEinemZug(page, [['puffer', '7'], ['perzentil', '70'], ['adresse', '#/board/zweites']]);
    freigeben();
    await expect.poll(() => kopf(k)).toBe('---\nfever: {buffer: 7, percentile: 70}\n---\n\n');
    await expect(page.getByRole('banner').getByRole('button', { name: /^zweites/ })).toBeVisible();
    expect(k.lies(ZWEITES)).toBe(zweitesVorher);
    await page.goto(`${k.adresse}#/berichte/fieber`);
    await expect(page.locator('#main .leiste').first()).toContainText('zweites');
    await steht(page);
    await inEinemZug(page, [['aufloesung', '7']]);
    await expect.poll(() => kopf(k, ZWEITES)).toBe('---\nfever: {resolution: week}\n---\n\n');
    expect(kopf(k)).toBe('---\nfever: {buffer: 7, percentile: 70}\n---\n\n');
  } finally { await k.stoppen(); }
});
