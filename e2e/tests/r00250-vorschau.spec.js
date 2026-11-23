// R00250 Nacharbeit (ADR-0043 N1, PO Z. 683, 693–694): die Vorschau in „Einrichten“ ist ein Trockenlauf des Servers —
// V1 Abnahme des PO, V2 CRLF und BOM, V4 Handform und Kürzel doppelt, V10–V13 Takt und Zustände.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, commitSteht } = require('./hilfen');

// ---- Testsprache --------------------------------------------------------------------------------------------------------

const SH = '  sh: {name: Sven, kind: human}\n';
const SH_NEU = '  sh: {name: Sven Hansen, kind: human}\n';
/** Datei H aus R00250 (Ausgangslage). */
const H = `---\n# von Hand\neigener-schluessel: 1\npeople:\n${SH}  ag: {name: Agent A, kind: agent}\n# Klassen folgen\nclasses:\n  bug: {label: Fehler, color: red}\nsources:\n  repository: ""\n---\n# Unser Ordner\n\nVon Hand geschrieben.\n`;
const WORTLAUT = 'Nicht gespeichert: Der Abschnitt „people“ in kanbanD.md ist von Hand gestaltet und lässt sich nicht zeilengenau ändern. Bitte die Änderung direkt in kanbanD.md eintragen.';
const WARTET = 'Vorschau wird aktualisiert …';
const VORSCHAU = '/api/einstellungen/vorschau';

/** „Vergleich in der Oberfläche“ (ADR-0043 N1.5): BOM entfernt, Zeilenenden als `\n`. */
const vergleichbar = t => t.replace(/^﻿/, '').replace(/\r\n/g, '\n');

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

const vorschau = page => page.locator('#einr-vorschau');
const statuszeile = page => page.locator('#einr-vorschau-stand');

async function einrichtenOeffnen(page, datei) {
  k = await kanbanStarten(einrichten({ 'kanbanD.md': datei }));
  await alsPerson(page, 'sh');
  await page.goto(k.adresse + '#/einrichten');
  await expect(page.getByLabel('Name sh')).toHaveValue('Sven');
  await expect(vorschau(page)).toHaveAttribute('data-stand', 'aktuell');
}

/** Liest die Vorschau, sobald sie den Stand `stand` trägt. */
async function vorschauText(page, stand = 'aktuell') {
  await expect(vorschau(page)).toHaveAttribute('data-stand', stand);
  return vorschau(page).textContent();
}

/** Zählt die Anfragen an den Trockenlauf. */
function anfragenZaehlen(page) {
  const zaehler = { n: 0 };
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === VORSCHAU) zaehler.n++; });
  return zaehler;
}

// ---- V1/V2: Abnahme des PO ----------------------------------------------------------------------------------------------

for (const [fall, datei] of [['H', H], ['H in CRLF mit BOM', '﻿' + H.replace(/\n/g, '\r\n')]]) {
  test(`V1/V2 Abnahme des PO (${fall}): die Vorschau vor dem Speichern ist kanbanD.md nach dem Speichern`, async ({ page }) => {
    await einrichtenOeffnen(page, datei);
    expect(vergleichbar(await vorschauText(page))).toBe(vergleichbar(datei));
    await page.getByLabel('Name sh').fill('Sven Hansen');
    const text = await vorschauText(page);
    for (const zeile of ['# von Hand', 'eigener-schluessel: 1', '# Klassen folgen', '# Unser Ordner', SH_NEU.trim()]) expect(text).toContain(zeile);
    expect(text).not.toContain('# kanbanD');
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await commitSteht(k, vorher + 1);
    expect(vergleichbar(k.lies('kanbanD.md'))).toBe(vergleichbar(text));
    expect(vergleichbar(k.lies('kanbanD.md'))).toBe(vergleichbar(datei).replace(SH, SH_NEU));
    expect(vergleichbar(await vorschauText(page))).toBe(vergleichbar(k.lies('kanbanD.md')), 'nach dem Speichern: aktuell und gleich der neuen Datei');
  });
}

// ---- V4: Handform und Kürzel doppelt — die Vorschau zeigt, was „Speichern“ melden würde ----------------------------------

test('V4 Handform: verweigert mit dem Wortlaut vor dem Klick; „Speichern“ zeigt denselben Text, kein Commit', async ({ page }) => {
  const datei = H.replace(SH, `${SH}  # Vertretung\n`);
  await einrichtenOeffnen(page, datei);
  await page.getByLabel('Name sh').fill('Sven Hansen');
  expect(await vorschauText(page, 'verweigert')).toBe(WORTLAUT);
  const head = k.git('rev-parse', 'HEAD');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('#einr-fehler')).toHaveText(WORTLAUT);
  await expect(vorschau(page)).toHaveAttribute('data-stand', 'verweigert');
  await expect(vorschau(page)).toHaveText(WORTLAUT);
  expect(k.git('rev-parse', 'HEAD')).toBe(head);
  expect(k.lies('kanbanD.md')).toBe(datei);
});

test('V4 Variante Kürzel doppelt (PO Z. 694): verweigert mit dem fehler, das „Speichern“ zeigt', async ({ page }) => {
  await einrichtenOeffnen(page, H);
  await page.getByLabel('Neues Kürzel').fill('sh');
  await page.getByLabel('Neuer Name').fill('Zweiter');
  await page.getByLabel('Neuer Name').press('Enter');
  const text = await vorschauText(page, 'verweigert');
  expect(text).toContain('sh');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('#einr-fehler')).toHaveText(text);
  expect(k.lies('kanbanD.md')).toBe(H);
});

// ---- V10–V13: Takt und Zustände ------------------------------------------------------------------------------------------

test('V10 Takt: fünf schnell getippte Zeichen — höchstens 2 Anfragen, übernommen wird der letzte Stand', async ({ page }) => {
  await einrichtenOeffnen(page, H);
  const anfragen = anfragenZaehlen(page);
  const feld = page.getByLabel('Name sh');
  await feld.click();
  await feld.press('End');
  await feld.pressSequentially('abcde');
  await expect(vorschau(page)).toContainText('sh: {name: Svenabcde, kind: human}');
  await expect(vorschau(page)).toHaveAttribute('data-stand', 'aktuell');
  expect(anfragen.n).toBeGreaterThanOrEqual(1);
  expect(anfragen.n).toBeLessThanOrEqual(2);
  await expect(feld).toBeFocused();
});

test('V11 verzögerte Antwort: wartet mit altem Text und aria-busy, nach 400 ms die Statuszeile; Endstand = jüngste Eingabe', async ({ page }) => {
  await einrichtenOeffnen(page, H);
  const alt = await vorschauText(page);
  let erste = true;
  await page.route('**' + VORSCHAU, async route => {
    if (erste) { erste = false; await new Promise(r => setTimeout(r, 1000)); }
    await route.continue();
  });
  const feld = page.getByLabel('Name sh');
  await feld.fill('Sven 1');
  await expect(vorschau(page)).toHaveAttribute('data-stand', 'wartet');
  await expect(vorschau(page)).toHaveAttribute('aria-busy', 'true');
  await expect(vorschau(page)).toHaveText(alt);
  await expect(statuszeile(page)).toHaveText(WARTET);
  await expect(vorschau(page)).toHaveClass(/gedaempft/);
  await feld.fill('Sven 2');
  await expect(vorschau(page)).toHaveAttribute('data-stand', 'aktuell', { timeout: 5000 });
  await expect(vorschau(page)).toContainText('sh: {name: Sven 2, kind: human}');
  await expect(vorschau(page)).toHaveAttribute('aria-busy', 'false');
  await expect(statuszeile(page)).toHaveText('');
  await expect(vorschau(page)).not.toHaveClass(/gedaempft/);
});

for (const [fall, antworten, satz] of [
  ['keine Antwort', route => route.abort(), 'Vorschau nicht aktuell — keine Antwort vom Server.'],
  ['500 mit fehler', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ fehler: 'x' }) }), 'Vorschau nicht aktuell: x (500).'],
  ['503 ohne fehler', route => route.fulfill({ status: 503, body: '' }), 'Vorschau nicht aktuell: Fehler im Server (503).'],
]) {
  test(`V12 ${fall}: fehler, alter Text gedämpft, Statuszeile wörtlich, „Speichern“ bedienbar`, async ({ page }) => {
    await einrichtenOeffnen(page, H);
    const alt = await vorschauText(page);
    await page.route('**' + VORSCHAU, antworten);
    await page.getByLabel('Name sh').fill('Sven Hansen');
    expect(await vorschauText(page, 'fehler')).toBe(alt);
    await expect(statuszeile(page)).toHaveText(satz);
    await expect(statuszeile(page)).toHaveAttribute('role', 'status');
    await expect(vorschau(page)).toHaveClass(/gedaempft/);
    await expect(page.getByRole('button', { name: 'Speichern' })).toBeEnabled();
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await commitSteht(k, vorher + 1);
    expect(k.lies('kanbanD.md')).toBe(H.replace(SH, SH_NEU));
  });
}

test('V13 Klick-Aktion ohne Tastatur: stilllegen aktualisiert die Vorschau; nach dem Speichern aktuell und gleich der Datei', async ({ page }) => {
  await einrichtenOeffnen(page, H);
  const anfragen = anfragenZaehlen(page);
  await page.getByRole('button', { name: 'stilllegen ag' }).click();
  await expect(vorschau(page)).toContainText('ag: {name: Agent A, kind: agent, active: false}');
  expect(anfragen.n).toBe(1);
  const text = await vorschauText(page);
  const vorher = +k.git('rev-list', '--count', 'HEAD');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await commitSteht(k, vorher + 1);
  expect(k.lies('kanbanD.md')).toBe(text);
  await expect(vorschau(page)).toHaveAttribute('data-stand', 'aktuell');
  await expect(vorschau(page)).toHaveText(k.lies('kanbanD.md'));
});
