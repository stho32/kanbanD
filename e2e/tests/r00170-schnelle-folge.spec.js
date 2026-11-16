// R00170 Schnell hintereinander gesetzte Fever-Einstellungen bleiben alle erhalten (ADR-0025 N3 Regel 7, Karte #177)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');

/* ── Testsprache: der Grundbestand der Anforderung ── */
const BOARD = 'boards/fabrik.md';
const boardText = (titel, nummer) => `# ${titel}\n\n## Backlog\n\n- #${nummer}\n\n## Arbeit\n\n## Erledigt\n`;
const aufgabe = n => `---\nid: ${n}\ntitle: a${n}\nassignees: [st]\n---\n`;
/** Zwei Boards mit Backlog · Arbeit · Erledigt, je eine Aufgabe, kein `fever` in der Board-Datei. */
const grundbestand = einrichten({ 'aufgaben/0001-a1.md': aufgabe(1), 'aufgaben/0002-a2.md': aufgabe(2), [BOARD]: boardText('fabrik', 1), 'boards/zweites.md': boardText('zweites', 2) });
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
const DREI_IM_FEVER_CHART = [['puffer', '7'], ['perzentil', '70'], ['aufloesung', '7']];

// erwartet rot bis B0831: am heutigen Stand trägt die Board-Datei nur `fever: {resolution: week}`
test.fail('R00170 US-1, AK 1, AK 3 (B0830, Abnahme der Karte #177): Puffer 7, Perzentil 70 und Auflösung Woche direkt nacheinander — die Board-Datei trägt alle drei, die Anzeige zeigt sie, drei Commits in der Reihenfolge der Eingabe', async ({ page }) => {
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
