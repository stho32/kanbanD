// R00195 Klassen und Farben je Board, sonst die Vorgabe des Ordners (ADR-0031, Karte #200)
//
// Aufbau: Testfälle in der Sprache der Anforderung; darunter die Testsprache (Ausgangslage, eigenerSatz, legende, …);
// Selektoren und Adressen stehen nur in der Testsprache.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, bereit, filterOeffnen } = require('./hilfen');

// ── Ausgangslage der Anforderung ──
const VORGABE = '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  sicherheit: {label: Sicherheit, color: red}\n  eol: {label: EOL, color: amber}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n';
const AUFGABE_2 = '---\nid: 2\ntitle: Zwei\nclass: sicherheit\n---\n';
const AUSGANGSLAGE = {
  'kanbanD.md': VORGABE,
  'boards/wartung.md': '# Wartung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'boards/umzug.md': '# Umzug\n\n## Zu erledigen\n\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: Eins\nclass: sicherheit\n---\n',
  'aufgaben/0002-zwei.md': AUFGABE_2,
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: Drei\nclass: eol\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: Vier\n---\n',
};
const PHASE1 = { schluessel: 'phase1', bezeichnung: 'Phase 1', farbe: 'green' };
const ALTLAST = { schluessel: 'eol', bezeichnung: 'Altlast', farbe: '#885500' };

/** Ein Ordner aus genau diesen Dateien, als Git-Ordner; ohne das Board „Entwicklung“ der gemeinsamen Hilfe. */
function ordnerMit(dateien) {
  return ordner => {
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

// ── Testsprache ──
/** Aufruf der API als Stefan; liefert Status und Antwort. */
async function api(k, methode, pfad, rumpf) {
  const antwort = await fetch(new URL(pfad, k.adresse), { method: methode, headers: { 'Content-Type': 'application/json', 'X-KanbanD-Wer': 'st' }, body: rumpf === undefined ? undefined : JSON.stringify(rumpf) });
  return { status: antwort.status, daten: await antwort.json().catch(() => null) };
}
const eigenerSatz = async (k, klassen) => expect((await api(k, 'PUT', '/api/boards/umzug/klassen', { klassen })).status).toBe(200);
const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
async function boardZeigen(page, k, slug, nr) {
  await page.goto(`${k.adresse}#/board/${slug}`);
  await bereit(page, karte(page, nr));
}
const legende = page => page.locator('.leg button');
/** Die Einträge einer Klassenwahl als [Wert, Text]. */
const eintraege = wahl => wahl.locator('option').evaluateAll(optionen => optionen.map(o => [o.value, o.textContent]));
const KEINE = ['', '— keine —'];
/** Der Bericht „Bestand nach Labels“ des Boards; die Berichte gelten dem zuletzt gezeigten Board. */
async function bestandZeigen(page, k, slug, nr) {
  await boardZeigen(page, k, slug, nr);
  await page.goto(`${k.adresse}#/berichte/bestand`);
  await bereit(page, '#bestand table.best-tab');
}
const bestandLegende = page => page.locator('#bestand .best-leg .best-le');
const klassenImBerichtsfilter = page => page.locator('.bf-chip[data-act="bf-farbe"]');
/** Die Aufgabenliste: außerhalb eines Boards. */
async function listeZeigen(page, k) {
  await page.goto(`${k.adresse}#/aufgaben`);
  await bereit(page, zeile(page, 1));
}
const zeile = (page, nr) => page.locator(`tr[data-zeile="${nr}"]`);
const klasseInDerListe = (page, nr) => zeile(page, nr).locator('.cls');
const aufBoardLegen = async (k, slug, nummer) => expect((await api(k, 'POST', `/api/boards/${slug}/aufgaben`, { nummer })).status).toBe(201);
/** Die Namen der Einträge im geöffneten Untermenü „Klasse“. */
const untermenue = page => page.locator('.kmenue.unter .km-e').allTextContents();

test.describe('R00195', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(ordnerMit(AUSGANGSLAGE)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('AK 5 / US-2: jedes Board zeigt seine Klassen — Legende, Karte, Klassenwahl, Menüs und Schnelleingabe', async ({ page }) => {
    await eigenerSatz(k, [PHASE1, ALTLAST]);
    await boardZeigen(page, k, 'umzug', 3);

    await expect(legende(page)).toHaveText([/^Phase 1\s*0$/, /^Altlast\s*1$/, /^ohne Klasse\s*1$/]);
    await expect(karte(page, 3)).toHaveAttribute('data-c', 'eol');
    await expect(karte(page, 3)).toHaveAttribute('style', /#885500/);
    await expect(karte(page, 3)).toHaveAccessibleName(/^#3 Drei, Altlast(, |$)/);

    await karte(page, 3).click();
    const fenster = page.getByRole('dialog');
    await expect.poll(() => eintraege(fenster.getByLabel('Klasse'))).toEqual([KEINE, ['phase1', 'Phase 1'], ['eol', 'Altlast']]);
    await expect(fenster.getByLabel('Klasse')).toHaveValue('eol');
    await page.keyboard.press('Escape');

    await karte(page, 3).click({ button: 'right' });
    await page.getByRole('menu', { name: '#3 Drei' }).getByRole('menuitem', { name: /^Klasse/ }).click();
    await expect.poll(() => untermenue(page)).toEqual(['Phase 1', '✓ Altlast', 'keine']);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await karte(page, 3).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 4).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, 3).click({ button: 'right' });
    await page.getByRole('menu', { name: '2 Karten' }).getByRole('menuitem', { name: /^Klasse/ }).hover();
    await expect.poll(() => untermenue(page)).toEqual(['Phase 1', 'Altlast', 'keine']);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');

    await karte(page, 4).focus();
    await page.keyboard.press('n');
    const neu = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await expect.poll(() => eintraege(neu.getByLabel('Klasse'))).toEqual([KEINE, ['phase1', 'Phase 1'], ['eol', 'Altlast']]);
    await page.getByLabel('Titel der neuen Aufgabe').fill('Kisten packen class:phase1');
    await expect(neu.locator('#neu-vorschau .cls')).toHaveText('Phase 1');
    await page.getByLabel('Titel der neuen Aufgabe').fill('Kisten packen class:sicherheit');
    await expect(neu.locator('#neu-vorschau .cls')).toHaveCount(0);
    await page.getByLabel('Titel der neuen Aufgabe').fill('Kisten packen class:phase1');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toContain('„Kisten packen“ angelegt');
    expect(k.lies('aufgaben/0005-kisten-packen.md')).toContain('\nclass: phase1\n');

    // Wartung bleibt, wie es ist
    await boardZeigen(page, k, 'wartung', 1);
    await expect(legende(page)).toHaveText([/^Sicherheit\s*1$/, /^EOL\s*0$/, /^ohne Klasse\s*0$/]);
    await expect(karte(page, 1)).toHaveAttribute('data-c', 'sicherheit');
    await expect(karte(page, 1)).toHaveAttribute('style', /--kd-c-red\b/);
    await expect(karte(page, 1)).toHaveAccessibleName(/^#1 Eins, Sicherheit(, |$)/);
    await karte(page, 1).click();
    await expect.poll(() => eintraege(page.getByRole('dialog').getByLabel('Klasse'))).toEqual([KEINE, ['sicherheit', 'Sicherheit'], ['eol', 'EOL']]);
  });

  test('AK 7: außerhalb eines Boards gilt das erste Board der Aufgabe, sonst die Vorgabe', async ({ page }) => {
    await k.stoppen();
    // „Altbestand“ steht in der Boardliste (nach Dateiname) vor Umzug, Wartung dahinter; beide ohne eigene Klassen
    k = await kanbanStarten(ordnerMit({ ...AUSGANGSLAGE, 'boards/altbestand.md': '# Altbestand\n\n## Zu erledigen\n' }));
    await eigenerSatz(k, [PHASE1, ALTLAST]);
    expect((await api(k, 'POST', '/api/aufgaben', { titel: 'Ohne Board', klasse: 'eol' })).status).toBe(201);
    await listeZeigen(page, k);

    await expect(klasseInDerListe(page, 3)).toHaveText('Altlast');
    await expect(klasseInDerListe(page, 3)).toHaveAttribute('style', /#885500/);
    await expect(klasseInDerListe(page, 5), 'auf keinem Board: die Vorgabe').toHaveText('EOL');
    await expect(klasseInDerListe(page, 5)).toHaveAttribute('style', /--kd-c-amber\b/);
    await expect(klasseInDerListe(page, 1)).toHaveText('Sicherheit');
    // #2 trägt auf ihrem ersten Board eine fremde Klasse: der Schlüssel als Text, ohne Farbe
    await expect(klasseInDerListe(page, 2)).toHaveCount(0);
    await expect(zeile(page, 2).locator('td').nth(2)).toHaveText('sicherheit');

    // das aus der Liste geöffnete Fenster bietet den Vorrat des ersten Boards
    await zeile(page, 3).getByRole('link', { name: 'Drei' }).click();
    await expect.poll(() => eintraege(page.getByRole('dialog').getByLabel('Klasse'))).toEqual([KEINE, ['phase1', 'Phase 1'], ['eol', 'Altlast']]);
    await page.keyboard.press('Escape');

    // zusätzlich auf Wartung — in der Boardliste hinter Umzug: es bleibt beim ersten Board
    await aufBoardLegen(k, 'wartung', 3);
    await expect(zeile(page, 3).locator('.ort')).toHaveCount(2);
    await expect(klasseInDerListe(page, 3)).toHaveText('Altlast');
    // zusätzlich auf einem Board vor Umzug, das die Vorgabe nimmt: „EOL“ in amber
    await aufBoardLegen(k, 'altbestand', 3);
    await expect(klasseInDerListe(page, 3)).toHaveText('EOL');
    await expect(klasseInDerListe(page, 3)).toHaveAttribute('style', /--kd-c-amber\b/);
    await zeile(page, 3).getByRole('link', { name: 'Drei' }).click();
    await expect.poll(() => eintraege(page.getByRole('dialog').getByLabel('Klasse'))).toEqual([KEINE, ['sicherheit', 'Sicherheit'], ['eol', 'EOL']]);
  });

  test('AK 5, AK 6: Berichte und Berichtsfilter führen die Klassen des Boards in ihrer Reihenfolge, die fremde dahinter', async ({ page }) => {
    await k.stoppen();
    const mitLabels = (text, labels = 'labels: ["repo:shop", "nc:304"]\n') => text.replace(/\n---\n$/, `\n${labels}---\n`);
    k = await kanbanStarten(ordnerMit({
      ...AUSGANGSLAGE,
      'boards/umzug.md': '---\nclasses:\n  phase1: {label: Phase 1, color: green}\n  eol: {label: Altlast, color: "#885500"}\nreport-labels: {rows: repo, columns: nc}\n---\n\n# Umzug\n\n## Zu erledigen\n\n- #2\n- #3\n- #4\n- #5\n\n## In Arbeit\n\n## Erledigt\n',
      'aufgaben/0002-zwei.md': mitLabels(AUFGABE_2),
      'aufgaben/0003-drei.md': mitLabels(AUSGANGSLAGE['aufgaben/0003-drei.md']),
      'aufgaben/0005-fuenf.md': mitLabels('---\nid: 5\ntitle: Fünf\nclass: phase1\n---\n'),
    }));
    await bestandZeigen(page, k, 'umzug', 3);

    await expect(bestandLegende(page)).toHaveText(['Phase 1', 'Altlast', 'ohne Klasse']);
    const zelle = page.getByLabel(/^repo:shop × nc:304: /);
    await expect(zelle).toHaveAttribute('aria-label', 'repo:shop × nc:304: 3 offen — Phase 1 1 · Altlast 1 · sicherheit 1 · ohne Abschlussspalte, ohne Filter der Berichte');
    // gefärbt nach der dringendsten Klasse des Boards: Phase 1 (grün) steht vor Altlast
    await expect(page.locator('#bestand td.k').filter({ has: zelle })).toHaveAttribute('style', /--kd-c-green\b/);
    await filterOeffnen(page);
    await expect(klassenImBerichtsfilter(page)).toHaveText(['Phase 1', 'Altlast', 'ohne Klasse']);
  });
});
