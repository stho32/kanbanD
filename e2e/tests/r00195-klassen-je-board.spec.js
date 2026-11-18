// R00195 Klassen und Farben je Board, sonst die Vorgabe des Ordners (ADR-0031, Karte #200)
//
// Aufbau: Testfälle in der Sprache der Anforderung; darunter die Testsprache (Ausgangslage, eigenerSatz, legende, …);
// Selektoren und Adressen stehen nur in der Testsprache.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, bereit, filterOeffnen, ausMehr, breiteSetzen, commitSteht } = require('./hilfen');

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
const fremdeKlasse = (page, nr) => karte(page, nr).locator('.kb-fremd');
/** Sammelt Fehler der Browser-Konsole und nicht gefangene Fehler der Seite. */
function konsolenfehler(page) {
  const fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
  return fehler;
}
const verlaufDerDatei = (k, rel) => k.git('log', '--format=%s', '--', rel);
// „Spalten einrichten“ des Boards, Abschnitt „Klassen dieses Boards“
async function einrichtenOeffnen(page, k, slug, nr) {
  await boardZeigen(page, k, slug, nr);
  await ausMehr(page, 'Spalten einrichten');
  await expect(klassenWahl(page)).toBeVisible();
}
const abschnitt = page => page.locator('#klassen-dieses-boards');
const klassenWahl = page => page.getByRole('radiogroup', { name: 'Klassen dieses Boards' });
const wahl = (page, name) => klassenWahl(page).getByRole('radio', { name });
const VORGABE_WAHL = 'Vorgabe des Ordners', EIGENE_WAHL = 'eigene Klassen';
/** Die Zeilen des Klassen-Editors als [Schlüssel, Bezeichnung]; die Neu-Zeile zählt nicht. */
const editorZeilen = bereich => bereich.locator('.klz[data-klasse]').evaluateAll(zeilen => zeilen.map(z => [z.dataset.klasse, z.querySelector('input').value]));
const vorschau = page => page.locator('#setup-vorschau');
const fertig = page => page.getByRole('button', { name: 'Fertig' });
/** „Fertig“ und warten, bis der Modus geschlossen und das Board neu gezeichnet ist. */
async function speichern(page, nr) {
  await fertig(page).click();
  await expect(vorschau(page)).toHaveCount(0);
  await bereit(page, karte(page, nr));
}
async function klasseErgaenzen(page, schluessel, bezeichnung, farbe) {
  await page.getByLabel('Neuer Klassenschlüssel').fill(schluessel);
  await page.getByLabel('Neue Bezeichnung').fill(bezeichnung);
  await page.getByLabel('Neue Bezeichnung').press('Enter');
  await expect(abschnitt(page).locator(`.klz[data-klasse="${schluessel}"]`)).toBeVisible();
  if (!farbe) return;
  await page.getByRole('button', { name: `Farbe ${schluessel}`, exact: true }).click();
  await page.getByRole('button', { name: farbe, exact: true }).click();
}
const commits = k => +k.git('rev-list', '--count', 'HEAD');
// Klassen-Editor: Zeile, Streichen, Hinweiszeile — im Board („Spalten einrichten“) und im Ordner („Einrichten“)
const SICHERHEIT = { schluessel: 'sicherheit', bezeichnung: 'Sicherheit', farbe: 'red' }, EOL = { schluessel: 'eol', bezeichnung: 'EOL', farbe: 'amber' };
const editorZeile = (bereich, schluessel) => bereich.locator(`.klz[data-klasse="${schluessel}"]`);
const zahlDerZeile = (bereich, schluessel) => editorZeile(bereich, schluessel).locator('.n');
const streichen = (page, schluessel) => page.getByRole('button', { name: `Klasse ${schluessel} entfernen`, exact: true }).click();
const zuruecknehmen = (page, schluessel) => page.getByRole('button', { name: `Klasse ${schluessel} zurücknehmen`, exact: true });
/** Die Hinweiszeile direkt unter der Zeile der Klasse. */
const hinweisAn = (bereich, schluessel) => bereich.locator(`.klz[data-klasse="${schluessel}"] + .kb-hinweis`);
const hinweise = bereich => bereich.locator('.kb-hinweis');
const ordnerEditor = page => page.locator('.einrichten');
async function ordnerEinrichten(page, k) {
  await page.goto(`${k.adresse}#/einrichten`);
  await bereit(page, editorZeile(ordnerEditor(page), 'sicherheit'));
}
/** Zählt Bestätigungsfenster: native Dialoge des Browsers und modale Dialoge der Seite. */
function bestaetigungsfenster(page) {
  const gesehen = [];
  page.on('dialog', d => { gesehen.push(d.message()); d.dismiss(); });
  return async () => [...gesehen, ...await page.locator('[role="dialog"], [role="alertdialog"]').allTextContents()];
}
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

  test('AK 6 / US-2: die fremde Klasse steht als Text auf der Karte, ohne Farbe, und im Namen; ohne Klasse steht nichts', async ({ page }) => {
    await eigenerSatz(k, [PHASE1, ALTLAST]);
    await boardZeigen(page, k, 'umzug', 2);

    await expect(fremdeKlasse(page, 2)).toHaveText('sicherheit');
    await expect(karte(page, 2)).not.toHaveAttribute('data-c');
    await expect(karte(page, 2)).not.toHaveAttribute('style', /--c:/);
    await expect(karte(page, 2)).toHaveAccessibleName(/^#2 Zwei, Klasse sicherheit(, |$)/);
    await expect(fremdeKlasse(page, 4), 'ohne Klasse: kein Text').toHaveCount(0);
    await expect(karte(page, 4)).toHaveAccessibleName(/^#4 Vier(, seit|$)/);
    await expect(fremdeKlasse(page, 3), 'bekannte Klasse: Farbe, kein Text').toHaveCount(0);
    // Zeichnung 3.1: erstes Element der Fußzeile, Mono, gestrichelter Rahmen, kein Grund, Schrift in Textfarbe
    expect(await fremdeKlasse(page, 2).evaluate(e => {
      const stil = getComputedStyle(e), probe = document.createElement('i');
      probe.style.color = 'var(--kd-text)'; document.body.append(probe);
      const textfarbe = getComputedStyle(probe).color; probe.remove();
      return { erstes: e === e.closest('.r3').firstElementChild, mono: /Mono/.test(stil.fontFamily), rahmen: stil.borderTopStyle, grund: stil.backgroundColor, textfarbe: stil.color === textfarbe, groesse: stil.fontSize };
    })).toEqual({ erstes: true, mono: true, rahmen: 'dashed', grund: 'rgba(0, 0, 0, 0)', textfarbe: true, groesse: '11px' });
    await expect(legende(page), 'die fremde Klasse ist kein Eintrag der Legende').toHaveText([/^Phase 1\s*0$/, /^Altlast\s*1$/, /^ohne Klasse\s*1$/]);

    // Klassenwahl von #2: der Schlüssel als gewählter eigener Eintrag ohne Farbe neben den Klassen des Boards
    await karte(page, 2).click();
    const wahl = page.getByRole('dialog').getByLabel('Klasse');
    await expect.poll(() => eintraege(wahl)).toEqual([KEINE, ['phase1', 'Phase 1'], ['eol', 'Altlast'], ['sicherheit', 'sicherheit']]);
    await expect(wahl).toHaveValue('sicherheit');
    await expect(wahl).not.toHaveAttribute('style');
    expect(await wahl.locator('option:checked').getAttribute('style')).toBeNull();
  });

  test('AK 6: ein langer fremder Schlüssel kürzt mit „…“, die Karte wird nicht breiter (Zeichnung 3.4)', async ({ page }) => {
    await k.stoppen();
    const lang = 'sicherheit-sehr-lang-abc';
    k = await kanbanStarten(ordnerMit({
      ...AUSGANGSLAGE,
      'kanbanD.md': VORGABE.replace('  sicherheit:', `  ${lang}:`),
      'boards/umzug.md': '---\nclasses: {}\n---\n\n' + AUSGANGSLAGE['boards/umzug.md'],
      'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: Zwei\nclass: ${lang}\nsubtasks:\n  - {text: eins, done: false}\nassignees: [st, cl]\ndue: 2031-12-24\n---\n`,
    }));
    await page.setViewportSize({ width: 320, height: 700 });
    await boardZeigen(page, k, 'umzug', 2);
    await expect(fremdeKlasse(page, 2)).toHaveText(lang);
    await karte(page, 2).evaluate(e => { e.style.width = '120px'; });
    await expect.poll(() => fremdeKlasse(page, 2).evaluate(e => ({ gekuerzt: e.scrollWidth > e.clientWidth, ellipse: getComputedStyle(e).textOverflow }))).toEqual({ gekuerzt: true, ellipse: 'ellipsis' });
    expect(await karte(page, 2).evaluate(e => e.scrollWidth <= e.clientWidth), 'die Karte wird nicht breiter').toBe(true);
    await expect(fremdeKlasse(page, 2), 'der ganze Schlüssel bleibt erreichbar').toHaveAttribute('title', `Klasse ${lang}`);
  });

  test('AK 6: die Aufgabe bleibt zeichengleich — Satz einschalten, drauflegen, bewegen, herunternehmen', async ({ page }) => {
    const vorher = verlaufDerDatei(k, 'aufgaben/0002-zwei.md');
    await eigenerSatz(k, [PHASE1, ALTLAST]);
    await aufBoardLegen(k, 'wartung', 2);
    expect((await api(k, 'POST', '/api/boards/umzug/bewegen', { nummer: 2, spalte: 'In Arbeit' })).status).toBe(200);
    expect((await api(k, 'DELETE', '/api/boards/wartung/aufgaben/2')).status).toBe(200);
    await boardZeigen(page, k, 'umzug', 2);
    await expect(page.locator('.bahn[data-col="In Arbeit"]').locator(fremdeKlasse(page, 2))).toHaveText('sicherheit');
    expect(k.lies('aufgaben/0002-zwei.md')).toBe(AUFGABE_2);
    expect(verlaufDerDatei(k, 'aufgaben/0002-zwei.md'), 'kein Commit berührt die Aufgabe').toBe(vorher);
    expect(k.git('status', '--porcelain')).toBe('');
  });

  test('AK 6: die Schnelleingabe mit einer Klasse, die der Vorrat der Sicht nicht kennt, erzeugt keinen Fehler in der Konsole', async ({ page }) => {
    const fehler = konsolenfehler(page);
    await eigenerSatz(k, [PHASE1, ALTLAST]);
    await boardZeigen(page, k, 'wartung', 1);
    await karte(page, 1).focus();
    await page.keyboard.press('n');
    const neu = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    const titel = page.getByLabel('Titel der neuen Aufgabe');
    // Wartung kennt phase1 nicht: der Text bleibt im Titel
    await titel.fill('Kisten class:phase1');
    await expect(neu.locator('#neu-vorschau')).toContainText('@kürzel');
    // das Zielboard Umzug kennt phase1, das gezeigte Board Wartung nicht — die Vorschau nimmt den Vorrat des Zielboards
    await neu.getByLabel('Board').selectOption('umzug');
    await titel.fill('Kisten class:phase1 @cl');
    await expect(neu.locator('#neu-vorschau .cls')).toHaveText('Phase 1');
    await expect(neu.locator('#neu-vorschau .cls')).toHaveAttribute('style', /--kd-c-green\b/);
    await titel.fill('Kisten class:sicherheit @cl');
    await expect(neu.locator('#neu-vorschau')).toContainText('Kisten class:sicherheit');
    await expect(neu.locator('#neu-vorschau .cls')).toHaveCount(0);
    expect(fehler).toEqual([]);
  });

  test('AK 8 / US-1: eigene Klassen beginnen mit einer Kopie der Vorgabe und stehen danach in der Board-Datei', async ({ page }) => {
    const vorgabeVorher = k.lies('kanbanD.md');
    await einrichtenOeffnen(page, k, 'umzug', 3);
    await expect(wahl(page, VORGABE_WAHL)).toBeChecked();
    await expect(abschnitt(page)).toContainText('Dieses Board zeigt die Klassen des Ordners: Sicherheit, EOL. Gepflegt werden sie unter „Einrichten“.');
    expect(await editorZeilen(abschnitt(page))).toEqual([]);
    await expect(vorschau(page)).not.toContainText('classes');

    await wahl(page, EIGENE_WAHL).click();
    await expect(wahl(page, EIGENE_WAHL)).toBeChecked();
    await expect(abschnitt(page)).toContainText('Eigene Klassen gelten nur auf diesem Board; begonnen wird mit einer Kopie der Vorgabe. Aufgaben behalten ihren Schlüssel.');
    await expect.poll(() => editorZeilen(abschnitt(page))).toEqual([['sicherheit', 'Sicherheit'], ['eol', 'EOL']]);
    await expect(vorschau(page)).toContainText('---\nclasses:\n  sicherheit: {label: Sicherheit, color: red}\n  eol: {label: EOL, color: amber}\n');

    // ohne weitere Änderung gespeichert: ein Commit, jede Karte sieht aus wie vorher
    const vorher = commits(k);
    await speichern(page, 3);
    await commitSteht(k, vorher + 1);
    expect(commits(k)).toBe(vorher + 1);
    expect(k.git('show', '--name-only', '--format=%s', 'HEAD')).toBe('Klassen von „Umzug“: sicherheit, eol\n\nboards/umzug.md');
    expect(k.lies('boards/umzug.md')).toMatch(/^---\nclasses:\n  sicherheit: \{label: Sicherheit, color: red\}\n  eol: \{label: EOL, color: amber\}\n/);
    expect(k.lies('kanbanD.md')).toBe(vorgabeVorher);
    await expect(karte(page, 2)).toHaveAttribute('data-c', 'sicherheit');
    await expect(karte(page, 2)).toHaveAttribute('style', /--kd-c-red\b/);
    await expect(karte(page, 3)).toHaveAttribute('style', /--kd-c-amber\b/);
    await expect(legende(page)).toHaveText([/^Sicherheit\s*1$/, /^EOL\s*1$/, /^ohne Klasse\s*1$/]);

    // phase1 ergänzt: nur Umzug zeigt sie
    await ausMehr(page, 'Spalten einrichten');
    await expect(wahl(page, EIGENE_WAHL)).toBeChecked();
    await klasseErgaenzen(page, 'phase1', 'Phase 1', 'green');
    await expect(vorschau(page)).toContainText('  phase1: {label: Phase 1, color: green}\n');
    await speichern(page, 3);
    await expect(legende(page)).toHaveText([/^Sicherheit\s*1$/, /^EOL\s*1$/, /^Phase 1\s*0$/, /^ohne Klasse\s*1$/]);
    expect(k.lies('boards/umzug.md')).toContain('  eol: {label: EOL, color: amber}\n  phase1: {label: Phase 1, color: green}\n');
    expect(k.lies('kanbanD.md')).toBe(vorgabeVorher);
    await karte(page, 4).click();
    await expect.poll(() => eintraege(page.getByRole('dialog').getByLabel('Klasse'))).toEqual([KEINE, ['sicherheit', 'Sicherheit'], ['eol', 'EOL'], ['phase1', 'Phase 1']]);
    await boardZeigen(page, k, 'wartung', 1);
    await expect(legende(page)).toHaveText([/^Sicherheit\s*1$/, /^EOL\s*0$/, /^ohne Klasse\s*0$/]);
  });

  test('AK 8: die Wahl ist eine Radiogruppe mit einem Tab-Halt; Hin- und Herschalten behält den bearbeiteten Satz', async ({ page }) => {
    await einrichtenOeffnen(page, k, 'umzug', 3);
    await expect(wahl(page, VORGABE_WAHL)).toHaveAttribute('tabindex', '0');
    await expect(wahl(page, EIGENE_WAHL)).toHaveAttribute('tabindex', '-1');
    await wahl(page, VORGABE_WAHL).focus();
    await page.keyboard.press('ArrowRight');
    await expect(wahl(page, EIGENE_WAHL)).toBeChecked();
    await expect(wahl(page, EIGENE_WAHL)).toBeFocused();

    await page.getByLabel('Bezeichnung eol').fill('Altlast');
    await klasseErgaenzen(page, 'phase1', 'Phase 1');
    await wahl(page, VORGABE_WAHL).click();
    await expect(vorschau(page)).not.toContainText('classes');
    expect(await editorZeilen(abschnitt(page))).toEqual([]);
    await wahl(page, EIGENE_WAHL).click();
    await expect.poll(() => editorZeilen(abschnitt(page))).toEqual([['sicherheit', 'Sicherheit'], ['eol', 'Altlast'], ['phase1', 'Phase 1']]);
    await expect(vorschau(page)).toContainText('  eol: {label: Altlast, color: amber}\n');

    // „Verwerfen“ schreibt nichts
    const vorher = commits(k);
    await page.getByRole('button', { name: 'Verwerfen' }).click();
    await expect(vorschau(page)).toHaveCount(0);
    expect(commits(k)).toBe(vorher);
    expect(k.lies('boards/umzug.md')).toBe(AUSGANGSLAGE['boards/umzug.md']);
  });

  test('AK 8, AK 2: der leere eigene Satz schreibt classes: {} — das Board führt ausdrücklich keine Klassen (Zeichnung 1.4)', async ({ page }) => {
    await einrichtenOeffnen(page, k, 'umzug', 3);
    await wahl(page, EIGENE_WAHL).click();
    await page.getByRole('button', { name: 'Klasse sicherheit entfernen' }).click();
    await page.getByRole('button', { name: 'Klasse eol entfernen' }).click();
    await expect(vorschau(page)).toContainText('---\nclasses: {}\n');
    await speichern(page, 3);
    expect(k.lies('boards/umzug.md')).toMatch(/^---\nclasses: \{\}\n/);
    await expect(legende(page)).toHaveCount(0);
    await expect(fremdeKlasse(page, 3)).toHaveText('eol');
  });

  test('AK 3, Zeichnung 1.5: ein ungültiger Satz wird gemeldet, bevor etwas geschrieben ist — auch die Spalten nicht', async ({ page }) => {
    await einrichtenOeffnen(page, k, 'umzug', 3);
    await wahl(page, EIGENE_WAHL).click();
    await klasseErgaenzen(page, 'phase1', 'Phase 1');
    await page.getByLabel('Bezeichnung phase1').fill('   ');
    await page.getByLabel('Spaltenname 2').fill('Unterwegs');
    const vorher = k.git('rev-parse', 'HEAD');
    const anfragen = [];
    page.on('request', r => { if (r.method() === 'PUT') anfragen.push(new URL(r.url()).pathname); });

    await fertig(page).click();
    const meldung = abschnitt(page).getByRole('alert');
    await expect(meldung).toHaveText('Klasse „phase1“ braucht eine Bezeichnung');
    await expect(meldung).toHaveClass(/warnh/);
    expect(anfragen, 'die Spalten gehen erst nach den Klassen hinaus').toEqual(['/api/boards/umzug/klassen']);
    expect(k.git('rev-parse', 'HEAD')).toBe(vorher);
    expect(k.git('status', '--porcelain')).toBe('');
    // die Eingaben bleiben stehen
    await expect.poll(() => editorZeilen(abschnitt(page))).toEqual([['sicherheit', 'Sicherheit'], ['eol', 'EOL'], ['phase1', '   ']]);
    await expect(page.getByLabel('Spaltenname 2')).toHaveValue('Unterwegs');

    await page.getByLabel('Bezeichnung phase1').fill('Phase 1');
    await expect(meldung).toHaveCount(0);
    await fertig(page).click();
    await expect(vorschau(page)).toHaveCount(0);
    await expect.poll(() => k.lies('boards/umzug.md')).toContain('## Unterwegs');
    expect(k.lies('boards/umzug.md')).toContain('  phase1: {label: Phase 1, color:');
  });

  test('Zeichnung 2.3: bei 375 px steht die Seitenleiste unter den Spalten in voller Breite, nichts scrollt waagrecht', async ({ page }) => {
    await einrichtenOeffnen(page, k, 'umzug', 3);
    await wahl(page, EIGENE_WAHL).click();
    await breiteSetzen(page, 375, 800);
    const masse = await page.evaluate(() => {
      const leiste = document.querySelector('.setup aside.einr').getBoundingClientRect(), spalten = document.querySelector('.setup .bahnen').getBoundingClientRect();
      const zeile = document.querySelector('#klassen-dieses-boards .klz[data-klasse]').getBoundingClientRect();
      const rollt = e => e.scrollWidth > e.clientWidth;
      return { seite: rollt(document.documentElement), main: rollt(document.querySelector('#main')), setup: rollt(document.querySelector('.setup')), leiste: rollt(document.querySelector('.setup aside.einr')), links: leiste.left, breite: leiste.width, unter: leiste.top >= spalten.bottom - 1, zeileRechts: zeile.right <= 375 };
    });
    expect(masse).toEqual({ seite: false, main: false, setup: false, leiste: false, links: 0, breite: 375, unter: true, zeileRechts: true });
  });

  test('AK 9 / US-3: im Editor des Boards steht vor dem Speichern an der gestrichenen Klasse die Zahl der Karten', async ({ page }) => {
    const fenster = bestaetigungsfenster(page);
    await eigenerSatz(k, [SICHERHEIT, EOL, PHASE1]);
    await einrichtenOeffnen(page, k, 'umzug', 2);
    // die Zahl je Zeile folgt der Zählregel der Hinweiszeile: Karten dieses Boards (#1 liegt auf Wartung)
    await expect(zahlDerZeile(abschnitt(page), 'sicherheit')).toHaveText('1');
    await expect(zahlDerZeile(abschnitt(page), 'eol')).toHaveText('1');
    await expect(zahlDerZeile(abschnitt(page), 'phase1')).toHaveText('0');
    await expect(hinweise(abschnitt(page))).toHaveCount(0);

    await streichen(page, 'sicherheit');
    // die Zeile bleibt stehen: durchgestrichen, mit dem Wort „gestrichen“, nicht mehr bedienbar, „zurücknehmen“ im Fokus
    const zeile = editorZeile(abschnitt(page), 'sicherheit');
    await expect(zeile).toHaveClass(/gestrichen/);
    await expect(zeile).toContainText('gestrichen');
    await expect(zeile.locator('.key')).toHaveCSS('text-decoration-line', 'line-through');
    await expect(zeile.locator('input, [data-act="k-pal"]')).toHaveCount(0);
    await expect(zuruecknehmen(page, 'sicherheit')).toBeFocused();
    const hinweis = hinweisAn(abschnitt(page), 'sicherheit');
    await expect(hinweis).toHaveText('1 Karte zeigt die Klasse danach als Text ohne Farbe.');
    await expect(hinweis).toHaveAttribute('role', 'status');
    await expect(zuruecknehmen(page, 'sicherheit')).toHaveAttribute('aria-describedby', await hinweis.getAttribute('id'));
    await expect(hinweis.locator('button, a')).toHaveCount(0);
    await expect(vorschau(page)).not.toContainText('sicherheit:');
    await expect(vorschau(page)).toContainText('classes:\n  eol: {label: EOL, color: amber}\n  phase1: {label: Phase 1, color: green}\n');

    // keine Karte trägt phase1: gestrichen, aber keine Hinweiszeile; zurückgenommen steht die Zeile wieder wie vorher
    await streichen(page, 'phase1');
    await expect(editorZeile(abschnitt(page), 'phase1')).toHaveClass(/gestrichen/);
    await expect(hinweise(abschnitt(page))).toHaveCount(1);
    await zuruecknehmen(page, 'phase1').click();
    await expect(editorZeile(abschnitt(page), 'phase1')).not.toHaveClass(/gestrichen/);
    await expect(page.getByRole('button', { name: 'Klasse phase1 entfernen' })).toBeFocused();
    await expect(page.getByLabel('Bezeichnung phase1')).toHaveValue('Phase 1');

    // Speichern bleibt ein Schritt, ohne Bestätigungsfenster
    const vorher = commits(k);
    await speichern(page, 2);
    await commitSteht(k, vorher + 1);
    expect(await fenster()).toEqual([]);
    expect(k.lies('boards/umzug.md')).toMatch(/^---\nclasses:\n  eol: \{label: EOL, color: amber\}\n  phase1: \{label: Phase 1, color: green\}\n/);
    await expect(fremdeKlasse(page, 2)).toHaveText('sicherheit');
    expect(k.lies('aufgaben/0002-zwei.md')).toBe(AUFGABE_2);

    // nach „Fertig“ ist die Zeile weg; wieder angelegt, hat #2 ihre Farbe zurück
    await ausMehr(page, 'Spalten einrichten');
    await expect(editorZeile(abschnitt(page), 'sicherheit')).toHaveCount(0);
    await klasseErgaenzen(page, 'sicherheit', 'Sicherheit', 'red');
    await speichern(page, 2);
    await expect(karte(page, 2)).toHaveAttribute('data-c', 'sicherheit');
    await expect(karte(page, 2)).toHaveAttribute('style', /--kd-c-red\b/);
    await expect(fremdeKlasse(page, 2)).toHaveCount(0);
  });

  test('AK 9: wird der gestrichene Schlüssel zurückgenommen oder neu angelegt, entfällt die Hinweiszeile', async ({ page }) => {
    await eigenerSatz(k, [SICHERHEIT, EOL, PHASE1]);
    await einrichtenOeffnen(page, k, 'umzug', 2);
    await streichen(page, 'eol');
    await expect(hinweisAn(abschnitt(page), 'eol')).toHaveText('1 Karte zeigt die Klasse danach als Text ohne Farbe.');
    await zuruecknehmen(page, 'eol').click();
    await expect(hinweise(abschnitt(page))).toHaveCount(0);

    await streichen(page, 'eol');
    await expect(hinweise(abschnitt(page))).toHaveCount(1);
    await page.getByLabel('Neuer Klassenschlüssel').fill('eol');
    await page.getByLabel('Neue Bezeichnung').fill('Altlast');
    await page.getByLabel('Neue Bezeichnung').press('Enter');
    await expect(hinweise(abschnitt(page))).toHaveCount(0);
    await expect(vorschau(page)).toContainText('  eol: {label: Altlast, color:');
    await speichern(page, 3);
    await expect(karte(page, 3)).toHaveAccessibleName(/^#3 Drei, Altlast(, |$)/);
  });

  test('AK 9: im Klassen-Editor des Ordners gilt dasselbe — gezählt wird, wo die Vorgabe gilt', async ({ page }) => {
    const fenster = bestaetigungsfenster(page);
    await ordnerEinrichten(page, k);
    const editor = ordnerEditor(page);
    await expect(zahlDerZeile(editor, 'sicherheit')).toHaveText('2');
    await expect(zahlDerZeile(editor, 'eol')).toHaveText('1');

    await streichen(page, 'eol');
    await expect(editorZeile(editor, 'eol')).toHaveClass(/gestrichen/);
    await expect(zuruecknehmen(page, 'eol')).toBeFocused();
    await expect(hinweisAn(editor, 'eol')).toHaveText('1 Karte zeigt die Klasse danach als Text ohne Farbe.');
    await expect(hinweisAn(editor, 'eol')).toHaveAttribute('role', 'status');
    await expect(page.locator('#einr-vorschau')).not.toContainText('eol:');
    await streichen(page, 'sicherheit');
    await expect(hinweisAn(editor, 'sicherheit')).toHaveText('2 Karten zeigen die Klasse danach als Text ohne Farbe.');
    await zuruecknehmen(page, 'sicherheit').click();
    await expect(hinweise(editor)).toHaveCount(1);

    const vorher = commits(k);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await commitSteht(k, vorher + 1);
    expect(await fenster()).toEqual([]);
    expect(k.lies('kanbanD.md')).toContain('classes:\n  sicherheit: {label: Sicherheit, color: red}\nsources:');
    await expect(editorZeile(editor, 'eol')).toHaveCount(0);
    expect(k.lies('aufgaben/0003-drei.md')).toBe(AUSGANGSLAGE['aufgaben/0003-drei.md']);
  });

  test('AK 9: hat Umzug einen eigenen Satz, zählen seine Karten im Ordner nicht mit — keine Hinweiszeile', async ({ page }) => {
    await eigenerSatz(k, [PHASE1, ALTLAST]);
    await ordnerEinrichten(page, k);
    const editor = ordnerEditor(page);
    await expect(zahlDerZeile(editor, 'sicherheit')).toHaveText('1');
    await expect(zahlDerZeile(editor, 'eol')).toHaveText('0');
    await streichen(page, 'eol');
    await expect(editorZeile(editor, 'eol')).toHaveClass(/gestrichen/);
    await expect(hinweise(editor)).toHaveCount(0);
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
