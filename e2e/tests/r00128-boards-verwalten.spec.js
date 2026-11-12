// R00128 Board umbenennen, archivieren und löschen in der Oberfläche (I0119, #35)
// Artboard D0002 #board-verwalten (PO-freigegeben); Server F0103 in tests/boards.rs.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, mutanteEinsetzen } = require('./hilfen');

// Boards „Entwicklung“ (aus einrichten) und „Test“ mit der Karte #7.
const BESTAND = {
  'boards/test.md': '# Test\n\n## Bereit\n\n## Geprüft\n\n- [#7](../aufgaben/0007-sieben.md)\n',
  'aufgaben/0007-sieben.md': '---\nid: 7\ntitle: sieben\n---\n',
};

const heute = () => new Date().toLocaleDateString('de-DE');
const isoHeute = () => { const d = new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; };
const status = page => page.locator('.toast[role="status"]');

test.describe('R00128', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(BESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
  });
  test.afterEach(async () => { await k.stoppen(); });

  const pop = page => page.locator('#pop[aria-label="Boards"]');
  const ausloeser = (page, titel) => pop(page).getByRole('button', { name: `Aktionen für Board ‚${titel}‘` });
  const oeffnenMenue = async (page, slug) => {
    if (await pop(page).count() === 0) await page.locator('#t-board').click();
    await pop(page).locator(`[data-act="board-menue"][data-arg="${slug}"]`).click();
  };
  const bestaetigen = async (page, text, meldung) => {
    await page.getByRole('alertdialog').getByRole('button', { name: text }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(status(page)).toContainText(meldung);
  };
  const archivieren = async (page, slug, titel) => {
    await oeffnenMenue(page, slug);
    await pop(page).getByRole('menuitem', { name: 'Archivieren' }).click();
    await bestaetigen(page, 'Archivieren', `Board ‚${titel}‘ archiviert`);
  };
  const loeschen = async (page, slug, titel) => {
    await oeffnenMenue(page, slug);
    await pop(page).getByRole('menuitem', { name: 'Löschen' }).click();
    await bestaetigen(page, 'endgültig löschen', `Board ‚${titel}‘ endgültig gelöscht`);
  };

  test('US-9/AK10: jede Board-Zeile traegt einen eigenen ⋮-Ausloeser mit Menue', async ({ page }) => {
    await page.locator('#t-board').click();
    for (const titel of ['Entwicklung', 'Test']) {
      await expect(ausloeser(page, titel)).toHaveAttribute('aria-haspopup', 'menu');
    }
    // kein offenes Board traegt die Marke „defekt“ (nur eine defekte Datei bekommt sie)
    await expect(pop(page).getByText('defekt', { exact: true })).toHaveCount(0);
    await ausloeser(page, 'Test').click();
    const menue = pop(page).getByRole('menu', { name: 'Aktionen für Board ‚Test‘' });
    await expect(menue).toBeVisible();
    await expect(menue.getByRole('menuitem')).toHaveText(['Umbenennen', 'Archivieren', 'Löschen']);
    // „Löschen“ ist in --kd-warn abgesetzt (S1)
    const farbe = await menue.getByRole('menuitem', { name: 'Löschen' }).evaluate(el => getComputedStyle(el).color);
    const warn = await page.evaluate(() => { const s = getComputedStyle(document.documentElement).getPropertyValue('--kd-warn').trim(); const d = document.createElement('span'); d.style.color = s; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    expect(farbe).toBe(warn);
    // kein Knopf im Knopf: der Zeilenname wechselt weiter
    await pop(page).locator('[data-act="board-wahl"][data-arg="test"]').click();
    await expect(page.locator('#t-board')).toContainText('Test');
  });

  test('US-1/AK1: Umbenennen aendert den Titel, der Slug bleibt', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = page.getByLabel('Neuer Name für Board ‚Entwicklung‘');
    await expect(feld).toHaveValue('Entwicklung');
    await expect(feld).toBeFocused();
    await feld.fill('Entwicklung 2026');
    await feld.press('Enter');
    await expect(page.locator('#t-board')).toContainText('Entwicklung 2026');
    expect(page.url()).toMatch(/#\/board\/entwicklung$/);
    expect(() => k.lies('boards/entwicklung-2026.md')).toThrow();
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung 2026\n');
    expect(k.git('log', '-1', '--format=%an|%s')).toBe('Stefan|Board „Entwicklung 2026“ umbenannt');
    expect(k.git('log', '-1', '--format=%s')).toBe('Board „Entwicklung 2026“ umbenannt');
  });

  test('US-11/AK11: leerer Titel zeigt den Feldfehler, das Feld bleibt offen', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = page.getByLabel('Neuer Name für Board ‚Entwicklung‘');
    await feld.fill('');
    await feld.press('Enter');
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(feld).toBeVisible();
    // Esc verwirft ohne Schreiben
    await feld.press('Escape');
    await expect(page.getByLabel('Neuer Name für Board ‚Entwicklung‘')).toHaveCount(0);
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung\n');
  });

  // Härtung #129/1 (ux): die abgelehnte Eingabe übersteht den Feldfehler. Das Artboard D0002 (#board-verwalten) zeichnet
  // das Feld mit der abgelehnten Zeichenkette samt Feldfehler; heute setzt jeder Render den Board-Titel wieder ein.
  test('H129/1: nach dem 400 stehen die getippten 201 Zeichen im Feld, aria-invalid, kein Commit', async ({ page }) => {
    const vorher = k.lies('boards/entwicklung.md');
    const vorherCommit = k.git('log', '-1', '--format=%s');
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = pop(page).locator('#board-umbenennen');
    const zuLang = 'X'.repeat(201);
    await feld.fill(zuLang);
    await feld.press('Enter');
    await expect(pop(page).getByRole('alert')).toBeVisible();
    // das Feld bleibt offen und trägt die abgelehnte Eingabe — nicht wieder den Titel des Boards
    await expect(feld).toBeVisible();
    await expect(feld).toHaveValue(zuLang);
    await expect(feld).toHaveAttribute('aria-invalid', 'true');
    await expect(feld).toHaveAttribute('aria-describedby', 'board-fehler');
    // kein Schreiben, kein Commit
    expect(k.lies('boards/entwicklung.md')).toBe(vorher);
    expect(k.git('log', '-1', '--format=%s')).toBe(vorherCommit);
    // Gegenprobe: der berichtigte Titel geht durch — Feld zu, Toast, ein Commit
    await feld.fill('Entwicklung 2026');
    await feld.press('Enter');
    await expect(feld).toHaveCount(0);
    await expect(status(page)).toContainText('Entwicklung 2026');
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung 2026\n');
    expect(k.git('log', '-1', '--format=%s')).not.toBe(vorherCommit);
    // der gemerkte Wert ist danach weg: ein Umbenennen auf einem anderen Board beginnt mit dessen Titel
    await pop(page).locator('[data-act="board-menue"][data-arg="test"]').click();
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    await expect(pop(page).locator('#board-umbenennen')).toHaveValue('Test');
    await pop(page).locator('#board-umbenennen').press('Escape');
  });

  // H129/1 (Variante derselben Klasse): der ✓-Knopf neben dem Feld nimmt den getippten Wert, nicht ein leeres Feld.
  test('H129/1b: der ✓-Knopf bestaetigt den getippten Namen', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    await pop(page).locator('#board-umbenennen').fill('Entwicklung 2026');
    await pop(page).getByRole('button', { name: 'Umbenennen bestätigen (Enter)' }).click();
    await expect(pop(page).locator('#board-umbenennen')).toHaveCount(0);
    await expect(status(page)).toContainText('Entwicklung 2026');
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung 2026\n');
  });

  test('US-2/US-10/AK12: Archivieren nimmt aus der Liste in den Abschnitt ARCHIVIERT', async ({ page }) => {
    // der Dialog fragt nach (Name, Startfokus Abbrechen)
    await oeffnenMenue(page, 'test');
    await pop(page).getByRole('menuitem', { name: 'Archivieren' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveAccessibleName('Test archivieren');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Archivieren' }).click();
    await expect(status(page)).toContainText('Board ‚Test‘ archiviert');
    // aus der offenen Liste, im Abschnitt
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="test"]')).toHaveCount(0);
    await expect(pop(page).locator('details.barch summary')).toHaveText(/ARCHIVIERT \(1\)/);
    await pop(page).locator('details.barch summary').click();
    const eintrag = pop(page).locator('.barchz');
    await expect(eintrag).toContainText('Test');
    await expect(eintrag).toContainText(`archiviert am ${heute()}`);
    expect(k.lies('boards/test.md')).toContain('archived: ' + isoHeute());
  });

  test('US-3/AK3: wieder oeffnen holt das Board zurueck', async ({ page }) => {
    await archivieren(page, 'test', 'Test');
    await pop(page).locator('details.barch summary').click();
    await pop(page).getByRole('button', { name: 'wieder öffnen' }).click();
    await expect(status(page)).toContainText('Board ‚Test‘ wieder geöffnet');
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="test"]')).toHaveCount(1);
    expect(k.lies('boards/test.md')).not.toContain('archived');
  });

  test('US-4/US-8/AK8/16: Loeschen mit Bestaetigungsdialog, kein Undo', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 760 });
    await oeffnenMenue(page, 'test');
    await pop(page).getByRole('menuitem', { name: 'Löschen' }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toHaveAccessibleName('Test endgültig löschen');
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('button')).toHaveCount(2);
    await expect(dialog.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await expect(dialog).toContainText('Die Board-Datei boards/test.md wird entfernt. Die Aufgaben bleiben erhalten; wiederherstellbar nur über die Git-Geschichte.');
    // ≤ min(360px, 100% − 32px) und 320 px ohne Querscrollen
    const breite = await dialog.evaluate(el => el.getBoundingClientRect().width);
    expect(breite).toBeLessThanOrEqual(Math.min(360, 320 - 32) + 0.5);
    const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(quer).toBeLessThanOrEqual(1);
    // Esc schließt ohne Schreiben; der Fokus kehrt an den Auslöser zurück
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.locator('[data-act="board-menue"][data-arg="test"]')).toBeFocused();
    expect(k.lies('boards/test.md')).toContain('# Test');
    // bestätigen
    await loeschen(page, 'test', 'Test');
    await expect(status(page).getByRole('button', { name: /rückgängig/i })).toHaveCount(0);
    expect(() => k.lies('boards/test.md')).toThrow();
    const aufgaben = await (await page.request.get(k.adresse + 'api/aufgaben')).json();
    expect(aufgaben.aufgaben.some(a => a.nummer === 7)).toBe(true);
    expect(k.git('log', '-1', '--format=%s')).toBe('Board „Test“ endgültig gelöscht');
  });

  test('AK13/M6: Fokus faellt nach dem Verschwinden des offenen Boards nicht auf BODY', async ({ page }) => {
    await page.locator('#t-board').click();
    await pop(page).locator('[data-act="board-wahl"][data-arg="test"]').click();
    await expect(page.locator('#t-board')).toContainText('Test');
    await archivieren(page, 'test', 'Test');
    await expect(page.locator('#t-board')).toContainText('Entwicklung');
    const rolle = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(rolle).not.toBe('BODY');
  });

  test('AK7/M7: das letzte Board darf weg — Leerzustand mit Weg', async ({ page }) => {
    await loeschen(page, 'test', 'Test');
    await loeschen(page, 'entwicklung', 'Entwicklung');
    await expect(page.getByText('Kein Board · neues anlegen')).toBeVisible();
    await expect(page.locator('#board-neu-leer')).toBeVisible();
    // ein neues entsteht mit POST /api/boards
    await page.locator('#board-neu-leer').fill('Release');
    await page.locator('#board-neu-leer').press('Enter');
    await expect(page.locator('#t-board')).toContainText('Release');
  });

  // B2 (Nacharbeit): Esc im Umbenennen-Feld schliesst nur die Eingabe, nicht den ganzen Umschalter (M10)
  test('M10/AK11 (Nacharbeit): Esc schliesst nur die Eingabe, der Umschalter bleibt offen', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = page.getByLabel('Neuer Name für Board ‚Entwicklung‘');
    await feld.fill('Entwicklung 2026');
    await feld.press('Escape');
    await expect(feld).toHaveCount(0);
    await expect(pop(page)).toBeVisible();
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="entwicklung"]')).toBeVisible();
    expect(k.lies('boards/entwicklung.md')).toContain('# Entwicklung\n');
  });

  // AK13/M6 (Nacharbeit): nach dem Umbenennen steht der Fokus auf der umbenannten Zeile
  test('AK13/M6 (Nacharbeit): der Fokus steht nach dem Umbenennen auf der Zeile', async ({ page }) => {
    await oeffnenMenue(page, 'entwicklung');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    await page.getByLabel('Neuer Name für Board ‚Entwicklung‘').fill('Entwicklung 2026');
    await page.getByLabel('Neuer Name für Board ‚Entwicklung‘').press('Enter');
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="entwicklung"]')).toBeFocused();
    await expect(pop(page).locator('[data-act="board-wahl"][data-arg="entwicklung"]')).toContainText('Entwicklung 2026');
  });

  // AK14/S4 (Nacharbeit): ein defektes Board meldet 423 sichtbar — beim Umbenennen als Feldfehler
  test('AK14/S4 (Nacharbeit): ein defektes Board meldet 423 sichtbar (Umbenennen)', async ({ page }) => {
    k.schreib('boards/kaputt.md', '# Kaputt\n- #1\n## A\n');
    await page.reload();
    await liveBereit(page);
    const vorher = k.lies('boards/kaputt.md');
    await oeffnenMenue(page, 'kaputt');
    await pop(page).getByRole('menuitem', { name: 'Umbenennen' }).click();
    const feld = page.getByLabel('Neuer Name für Board ‚kaputt‘');
    await feld.fill('Neu');
    await feld.press('Enter');
    const fehler = pop(page).getByRole('alert');
    await expect(fehler).toBeVisible();
    await expect(fehler).not.toBeEmpty();
    // es sieht nicht so aus, als sei etwas geschehen: die Datei ist unverändert
    expect(k.lies('boards/kaputt.md')).toBe(vorher);
    await expect(feld).toBeVisible();
  });

  // AK14/S4 (Nacharbeit): ein defektes Board meldet 423 sichtbar — beim Archivieren im Dialog
  test('AK14/S4 (Nacharbeit): ein defektes Board meldet 423 sichtbar (Archivieren)', async ({ page }) => {
    k.schreib('boards/kaputt.md', '# Kaputt\n- #1\n## A\n');
    await page.reload();
    await liveBereit(page);
    await oeffnenMenue(page, 'kaputt');
    await pop(page).getByRole('menuitem', { name: 'Archivieren' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archivieren' }).click();
    const fehler = page.getByRole('alertdialog').getByRole('alert');
    await expect(fehler).toBeVisible();
    await expect(fehler).not.toBeEmpty();
    await expect(status(page)).toHaveCount(0);
    expect(k.lies('boards/kaputt.md')).toContain('# Kaputt');
  });

  // AK15/S6 (Nacharbeit): Archivieren eines anderen Boards laesst die Ansicht stehen
  test('AK15/S6 (Nacharbeit): ein anderes Board zu archivieren laesst die Ansicht stehen', async ({ page }) => {
    await archivieren(page, 'test', 'Test');
    await expect(page.locator('#t-board')).toContainText('Entwicklung');
    expect(page.url()).toMatch(/#\/board\/entwicklung$/);
    await expect(page.locator('.ka[data-id="7"]')).toHaveCount(0);
  });
});

// B1 (Nacharbeit): ein archiviertes Board ist kein Kartenziel — aus allen vier Quellen gefiltert
test.describe('R00128 B1 (Nacharbeit): archivierte Boards sind kein Kartenziel', () => {
  let k;
  const BESTAND_B1 = {
    'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
    'boards/test.md': '# Test\n\n## Bereit\n\n',
    'boards/zweit.md': '# Zweit\n\n## Offen\n\n',
    'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
    'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  };
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(einrichten(BESTAND_B1));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
    // Board „Test“ archivieren (über die API)
    const r = await page.request.patch(k.adresse + 'api/boards/test', { headers: { 'X-KanbanD-Wer': 'st' }, data: { archiviert: true } });
    expect(r.status()).toBe(200);
    await page.reload();
    await liveBereit(page);
  });
  test.afterEach(async () => { await k.stoppen(); });

  const unterEintraege = page => page.locator('#kmenue .kmenue.unter .km-e');

  /** Öffnet das Kontextmenü und liest die Board-Ziele unter „Auf Board legen“ (leer, wenn der Eintrag fehlt). */
  async function zieleDerQuelle(page, oeffnen) {
    await oeffnen();
    const eintrag = page.locator('#kmenue').getByRole('menuitem', { name: /Auf Board legen/ });
    if (await eintrag.count() === 0) return '';
    await eintrag.first().hover();
    return (await unterEintraege(page).allTextContents()).join('|');
  }

  test('archiviertes Board fehlt in allen vier Quellen, ein zweites offenes bleibt Ziel', async ({ page }) => {
    // (1) Kontextmenü einer Karte (menueFuerKarte)
    const karte = await zieleDerQuelle(page, () => page.locator('.ka[data-id="1"]').click({ button: 'right' }));
    expect(karte).not.toContain('Test');
    expect(karte).toContain('Zweit');
    await page.keyboard.press('Escape');
    // (2) Menü einer Auswahl (menueFuerAuswahl)
    await page.locator('.ka[data-id="1"]').click({ modifiers: ['ControlOrMeta'] });
    await page.locator('.ka[data-id="2"]').click({ modifiers: ['ControlOrMeta'] });
    const auswahl = await zieleDerQuelle(page, () => page.locator('.ka[data-id="1"]').click({ button: 'right' }));
    expect(auswahl).not.toContain('Test');
    expect(auswahl).toContain('Zweit');
    await page.keyboard.press('Escape');
    // (3) Zeilenmenü der Aufgabenliste (menueFuerZeile)
    await page.goto(k.adresse + '#/aufgaben');
    await liveBereit(page);
    const zeile = await zieleDerQuelle(page, () => page.locator('tr[data-zeile="1"]').click({ button: 'right' }));
    expect(zeile).not.toContain('Test');
    expect(zeile).toContain('Zweit');
    await page.keyboard.press('Escape');
    // (4) Formular „Neue Aufgabe“ (vNeu)
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
    await page.keyboard.press('n');
    await page.getByRole('dialog', { name: 'Neue Aufgabe' }).waitFor();
    const optionen = await page.locator('select[data-nf="board"] option').allTextContents();
    expect(optionen).not.toContain('Test');
    expect(optionen).toContain('Entwicklung');
    expect(optionen).toContain('Zweit');
  });
});

// AK13/M6 (Nacharbeit, N1): nach dem Archivieren des *offenen* Boards landet der Fokus auf der nächsten Board-Zeile
// (`naechsteBoardZeile`) — nicht nur „nicht BODY“. Drei Boards a/b/c, b offen: der Fokus muss auf c stehen, nicht auf a.
test.describe('R00128 AK13/M6 (Nacharbeit N1): Fokus auf der naechsten Board-Zeile', () => {
  let k;
  const BESTAND_N1 = {
    'boards/a.md': '# A\n\n## Offen\n',
    'boards/b.md': '# B\n\n## Offen\n',
    'boards/c.md': '# C\n\n## Offen\n',
  };
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(einrichten(BESTAND_N1));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/b');
    await liveBereit(page);
  });
  test.afterEach(async () => { await k.stoppen(); });

  test('archivieren des offenen Boards setzt den Fokus auf die naechste Zeile c', async ({ page }) => {
    const pop = page.locator('#pop[aria-label="Boards"]');
    // `einrichten` legt zusätzlich „Entwicklung“ an (Slug `entwicklung` sortiert hinter `c`): Reihenfolge a, b, c, entwicklung;
    // b ist offen. „Die nächste Zeile“ ist damit eindeutig c — nicht der Anfang der Liste.
    await page.locator('#t-board').click();
    await expect(pop.locator('[data-act="board-wahl"]')).toHaveText(['Aa.md', 'Bb.md', 'Cc.md', 'Entwicklungentwicklung.md']);
    await expect(page.locator('#t-board')).toContainText('B');
    // b archivieren (b ist das offene Board)
    await pop.locator('[data-act="board-menue"][data-arg="b"]').click();
    await pop.getByRole('menuitem', { name: 'Archivieren' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archivieren' }).click();
    await expect(page.locator('.toast[role="status"]')).toContainText('Board ‚B‘ archiviert');
    // der Fokus steht auf der nächsten offenen Zeile c — weder auf a (Anfang) noch auf BODY
    await expect(pop.locator('[data-act="board-wahl"][data-arg="c"]')).toBeFocused();
    await expect(pop.locator('[data-act="board-wahl"][data-arg="a"]')).not.toBeFocused();
    await expect(page.locator('#t-board')).toContainText('A');
  });
});
