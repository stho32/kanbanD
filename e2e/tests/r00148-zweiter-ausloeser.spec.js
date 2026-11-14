// R00148 Eine laufende Aktion nimmt keinen zweiten Auslöser an (Karte #138, ADR-0025 Regel 1/2/5/6).
// Doppelklick und Doppeltipp treffen heute die nachgerückte Stelle oder wiederholen die Aktion: zwei Anfragen,
// zwei Commits, im Fall #106 Datenverlust. Die Proben halten die Antwort der ersten Anfrage (page.route), sonst
// ist sie vor dem zweiten Auslöser beendet und der Fall prüft nichts (R00148, „Zeitfenster“).
// ERWARTET ROT bis die Sperre (B0687) und der eine Schreibweg (B0688) stehen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, ausMehr, filterOeffnen, reiter, thema, kontrastFarben, mutanteEinsetzen } = require('./hilfen');

// Mutantenprobe (KD_MUTANTE, Muster R00110): jeder Test dieser Datei lädt auf Wunsch eine veränderte Oberfläche.
test.beforeEach(({ page }) => mutanteEinsetzen(page));

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
sources:
  wbs: plan/wbs.md
  requirements: anf/
---
`;

const KARTE = 'aufgaben/0001-abnahme-pruefen.md';
const AUFGABE = '---\nid: 1\ntitle: Abnahme prüfen\n---\n- [ ] eins\n- [ ] zwei\n- [ ] drei\n';
const BOARD = 'boards/entwicklung.md';

/** Board „entwicklung“ mit Karte #1 (drei offene Teilaufgaben); `kopf` ist das Frontmatter des Boards. */
function bestand(kopf = '') {
  return {
    'kanbanD.md': EINSTELLUNGEN,
    [BOARD]: `${kopf ? `---\n${kopf}---\n` : ''}# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n\n## In Arbeit\n\n## Erledigt\n`,
    [KARTE]: AUFGABE,
  };
}

const commits = k => +k.git('rev-list', '--count', 'HEAD');

/**
 * Hält ab jetzt jede Anfrage `methode` auf einen Pfad, für den `passt` gilt, an der Grenze des Browsers fest, bis
 * `freigeben()` sie hinauslässt — der Server hat sie dann noch nicht gesehen, die Aktion ist „läuft“ (R00148).
 * `anzahl` zählt die gehaltenen Anfragen: ohne Sperre sind es beim Doppelklick zwei.
 */
async function anfragenHalten(page, passt, methode) {
  let scharf = true, anzahl = 0, gesamt = 0, oeffnen, ausgang = 'durch';
  const tor = new Promise(ok => { oeffnen = ok; });
  await page.route(url => passt(url.pathname), async route => {
    if (route.request().method() === methode) gesamt++;
    if (!scharf || route.request().method() !== methode) return route.fallback();
    anzahl++;
    await tor;
    // `freigeben('abbrechen')` reißt die Anfrage ab (Netzfehler), `freigeben('500')` beantwortet sie mit einem Serverfehler
    if (ausgang === 'abbrechen') return route.abort();
    if (ausgang === '500') return route.fulfill({ status: 500, json: { fehler: 'Probe: Serverfehler' } });
    await route.continue();
  });
  // `gesamt` zählt auch, was nach der Freigabe kommt: eine zweite Anfrage, die in der Schlange hinter der ersten wartete
  return { anzahl: () => anzahl, gesamt: () => gesamt, freigeben: (wie = 'durch') => { ausgang = wie; scharf = false; oeffnen(); } };
}

/** Wartet, bis die erste gehaltene Anfrage draußen ist (die Aktion „läuft“). */
const bisAnfrageLaeuft = halte => expect.poll(() => halte.anzahl(), { message: 'die erste Anfrage läuft' }).toBeGreaterThanOrEqual(1);

/** Anfänge und Enden der schreibenden Anfragen in Reihenfolge (AK 17: keine Überlappung). */
function netzprotokoll(page) {
  const reihe = [];
  page.on('request', r => { if (r.method() !== 'GET') reihe.push(`an ${r.method()} ${new URL(r.url()).pathname}`); });
  page.on('requestfinished', r => { if (r.method() !== 'GET') reihe.push(`aus ${r.method()} ${new URL(r.url()).pathname}`); });
  return reihe;
}

test.describe('R00148 Doppelter Auslöser auf dem Board', () => {
  let k;
  test.afterEach(() => k.stoppen());

  test('AK 7 (#95): Doppelklick auf „Anlegen“ legt genau eine Aufgabe an', async ({ page }) => {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben', 'POST');

    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await dialog.getByLabel('Titel der neuen Aufgabe').fill('nur einmal');
    await dialog.getByRole('button', { name: 'Anlegen', exact: true }).dblclick();
    await bisAnfrageLaeuft(halte);
    halte.freigeben();

    // eine neue Aufgabe: eine Datei, eine Board-Zeile, genau ein Commit
    await expect(page.locator('.ka', { hasText: 'nur einmal' })).toHaveCount(1);
    await expect.poll(() => commits(k)).toBe(vorher + 1);
    const dateien = k.git('ls-files', 'aufgaben').split('\n').filter(p => p.includes('nur-einmal'));
    expect(dateien, 'genau eine neue Datei').toHaveLength(1);
    expect(k.lies(BOARD).match(/#2\]/g) || [], 'eine Board-Zeile').toHaveLength(1);
    expect(halte.anzahl(), 'genau ein POST /api/aufgaben').toBe(1);
    // der Hinweis nennt genau eine Nummer
    const hinweis = page.locator('.toast[role="status"]');
    await expect(hinweis).toHaveCount(1);
    expect((await hinweis.textContent()).match(/#\d+/g) || []).toEqual(['#2']);
  });

  test('AK 8 (#121 A2): zweimal „Fertig“ im Spalten-Dialog ergibt einen Commit', async ({ page }) => {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    const vorher = commits(k);
    await ausMehr(page, 'Spalten einrichten');
    await page.getByLabel('Grenze Zu erledigen').fill('5');
    await page.getByLabel('Kommentar Zu erledigen').fill('nur einmal');
    const halte = await anfragenHalten(page, p => p === '/api/boards/entwicklung/spalten', 'PUT');

    const fertig = page.getByRole('button', { name: 'Fertig', exact: true });
    await fertig.dblclick();
    await bisAnfrageLaeuft(halte);
    halte.freigeben();

    await expect(page.locator('.kz-modus')).toHaveCount(0);
    expect(halte.anzahl(), 'genau ein PUT …/spalten').toBe(1);
    expect(commits(k), 'genau ein Commit').toBe(vorher + 1);
    const board = k.lies(BOARD);
    expect(board.match(/nur einmal/g) || [], 'die Notiz steht einmal in der Datei').toHaveLength(1);
  });

  test('AK 9 (#55): Doppelklick auf „⇄ Achsen tauschen“ tauscht genau einmal', async ({ page }) => {
    // der Bericht braucht Aufgaben mit zwei Label-Präfixen (sonst gibt es keine Achsen zu tauschen)
    const mitLabels = bestand('report-labels: {rows: repo, columns: nc}\n');
    mitLabels['boards/entwicklung.md'] = '---\nreport-labels: {rows: repo, columns: nc}\n---\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n- [#2](../aufgaben/0002-shop.md)\n\n## In Arbeit\n\n## Erledigt\n';
    mitLabels['aufgaben/0002-shop.md'] = '---\nid: 2\ntitle: shop\nlabels: ["repo:shop", "nc:304"]\n---\n';
    k = await kanbanStarten(einrichten(mitLabels));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/bestand');
    await filterOeffnen(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/boards/entwicklung/bestand', 'PUT');

    await page.getByRole('button', { name: '⇄ Achsen tauschen' }).dblclick();
    await bisAnfrageLaeuft(halte);
    halte.freigeben();

    await expect.poll(() => k.lies(BOARD)).toContain('report-labels: {rows: nc, columns: repo}');
    expect(halte.anzahl(), 'genau ein PUT …/bestand').toBe(1);
    expect(commits(k), 'höchstens ein Commit').toBeLessThanOrEqual(vorher + 1);
    expect(k.lies(BOARD), 'die Achsen sind genau einmal getauscht').toContain('report-labels: {rows: nc, columns: repo}');
  });

  test('AK 17: kein Überholen zweier Schreib-Auslöser', async ({ page }) => {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    const reihe = netzprotokoll(page);
    const vorher = commits(k);
    // die erste schreibende Anfrage läuft (Teilaufgabe abhaken)
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/teilaufgaben/0', 'PATCH');

    await page.locator('.ka[data-id="1"] .naechste-ziel').click();
    await bisAnfrageLaeuft(halte);
    // währenddessen ein anderer schreibender Auslöser: eine neue Aufgabe anlegen
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await dialog.getByLabel('Titel der neuen Aufgabe').fill('danach');
    await dialog.getByRole('button', { name: 'Anlegen', exact: true }).click();
    halte.freigeben();

    await expect(page.locator('.ka', { hasText: 'danach' })).toHaveCount(1);
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins');
    // die zweite schreibende Anfrage beginnt erst nach der Antwort der ersten (Netzprotokoll: keine Überlappung)
    await expect.poll(() => reihe.filter(z => z.startsWith('an ')).length, { message: `Protokoll: ${reihe.join(' | ')}` }).toBe(2);
    const an = reihe.filter(z => z.startsWith('an '));
    expect(reihe.indexOf(an[1]), `Protokoll: ${reihe.join(' | ')}`).toBeGreaterThan(reihe.indexOf(`aus ${an[0].slice(3)}`));
    expect(commits(k), 'beide Änderungen sind gespeichert').toBe(vorher + 2);
  });

  test('US-8 (AK 13–16): die Sperre übersteht das Neuzeichnen, lässt anderes frei und endet mit der Antwort', async ({ page }) => {
    const dateien = bestand();
    dateien['boards/entwicklung.md'] = '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n- [#2](../aufgaben/0002-zweite.md)\n\n## In Arbeit\n\n## Erledigt\n';
    dateien['aufgaben/0002-zweite.md'] = '---\nid: 2\ntitle: zweite\n---\n';
    k = await kanbanStarten(einrichten(dateien));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/teilaufgaben/0', 'PATCH');
    const ziel = page.locator('.ka[data-id="1"] .naechste-ziel');

    await ziel.click();
    await bisAnfrageLaeuft(halte);
    // AK 14: aria-disabled, nie natives disabled, der Fokus bleibt am Auslöser
    await expect(ziel).toHaveAttribute('aria-disabled', 'true');
    expect(await ziel.evaluate(e => e.disabled), 'kein natives disabled').toBe(false);
    await expect(ziel).toBeFocused();

    // AK 15: ein Auslöser ohne Schreibwirkung bleibt frei — das Aufgabenfenster öffnet normal und zeichnet die Seite neu
    // (die Kartenleiste ist danach ein neuer Knoten; R00110 überspringt Live-Ereignisse, solange eine eigene Anfrage läuft)
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    expect(halte.anzahl(), 'das Öffnen ist keine Anfrage').toBe(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#fenster')).toHaveCount(0);

    // AK 13: die Sperre hängt nicht am Knoten — nach dem Neuzeichnen trägt derselbe Platz sie weiter
    await expect(ziel).toHaveAttribute('aria-disabled', 'true');
    await ziel.click({ force: true }); // aria-disabled hält Playwrights Zielprüfung auf — der Klick geht trotzdem an den Verteiler
    await page.waitForTimeout(150);
    expect(halte.anzahl(), 'auch nach dem Neuzeichnen keine zweite Anfrage').toBe(1);

    // AK 16: die Sperre endet mit der Antwort — derselbe Auslöser ist wieder bedienbar
    halte.freigeben();
    await expect(ziel).not.toHaveAttribute('aria-disabled', 'true');
    const zweite = page.waitForRequest(r => r.method() === 'PATCH' && new URL(r.url()).pathname === '/api/aufgaben/1/teilaufgaben/1');
    await ziel.click();
    await zweite;
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [x] zwei');
  });

  test('AK 18: Anlegen trägt den Schlüssel; derselbe Aufruf ein zweites Mal schreibt nichts', async ({ page }) => {
    k = await kanbanStarten(einrichten(bestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    const vorher = commits(k);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    // derselbe Formularstand trägt denselben Schlüssel
    const schluesselVorher = await page.evaluate(() => S.ui.neu.schluessel);
    await dialog.getByLabel('Titel der neuen Aufgabe').fill('nur einmal');
    expect(await page.evaluate(() => S.ui.neu.schluessel), 'der Schlüssel bleibt über die Formularfüllung stabil').toBe(schluesselVorher);

    const [anfrage] = await Promise.all([
      page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/aufgaben'),
      dialog.getByRole('button', { name: 'Anlegen', exact: true }).click(),
    ]);
    const key = anfrage.postDataJSON().key;
    expect(typeof key, 'der POST /api/aufgaben trägt einen Schlüssel').toBe('string');
    expect(key.length).toBeGreaterThan(0);
    await expect.poll(() => commits(k)).toBe(vorher + 1);
    expect(k.git('ls-files', 'aufgaben').split('\n').filter(p => p.includes('nur-einmal')), 'genau eine neue Datei').toHaveLength(1);

    // derselbe POST ein zweites Mal (aus der Seite heraus): 200 mit neu: false, keine zweite Datei, kein zweiter Commit
    const zweite = await page.evaluate(async (k) => {
      const r = await fetch('/api/aufgaben', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-KanbanD-Wer': 'st' }, body: JSON.stringify({ titel: 'nur einmal', key: k }) });
      return { status: r.status, antwort: await r.json() };
    }, key);
    expect(zweite.status, 'die Wiederholung antwortet 200').toBe(200);
    expect(zweite.antwort.neu, 'nichts wird geschrieben').toBe(false);
    expect(k.git('ls-files', 'aufgaben').split('\n').filter(p => p.includes('nur-einmal'))).toHaveLength(1);
    expect(commits(k), 'kein zweiter Commit').toBe(vorher + 1);

    // ein neu geöffnetes Fenster trägt einen anderen Schlüssel
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const zweitesFenster = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await zweitesFenster.getByLabel('Titel der neuen Aufgabe').fill('noch eine');
    const [zweiteAnfrage] = await Promise.all([
      page.waitForRequest(r => r.method() === 'POST' && new URL(r.url()).pathname === '/api/aufgaben'),
      zweitesFenster.getByRole('button', { name: 'Anlegen', exact: true }).click(),
    ]);
    expect(zweiteAnfrage.postDataJSON().key, 'ein neues Fenster, ein neuer Schlüssel').not.toBe(key);
  });
});

/** Karte #1 mit den genannten Teilaufgaben (Haken laut `erledigt`). */
const karteMit = (teilaufgaben, mehr = '') =>
  `---\nid: 1\ntitle: Abnahme prüfen\n${mehr}---\n` + teilaufgaben.map(([text, erledigt]) => `- [${erledigt ? 'x' : ' '}] ${text}\n`).join('');
const DREI_OFFEN = [['eins', false], ['zwei', false], ['drei', false]];
const ZWEI_OFFEN = [['eins', true], ['zwei', false], ['drei', false]];
const LETZTE_OFFEN = [['eins', true], ['zwei', true], ['drei', false]];

const bestandMit = (teilaufgaben, mehr = '') => ({
  'kanbanD.md': EINSTELLUNGEN,
  [BOARD]: `# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n\n## In Arbeit\n\n## Erledigt\n`,
  [KARTE]: karteMit(teilaufgaben, mehr),
});

test.describe('R00148 Doppelter Auslöser im Aufgabenfenster', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(bestandMit(DREI_OFFEN))); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const fensterOeffnen = async (page) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="1"] .t').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
  };

  test('AK 4 (#106): Doppelklick auf das ✕ an „zwei“ löscht nur „zwei“', async ({ page }) => {
    await fensterOeffnen(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/teilaufgaben/'), 'DELETE');
    await page.getByLabel('Teilaufgabe zwei entfernen').dblclick();
    await bisAnfrageLaeuft(halte);
    halte.freigeben();

    await expect(page.locator('#fenster .chk span')).toHaveText(['eins', 'drei']);
    expect(halte.anzahl(), 'genau ein DELETE').toBe(1);
    expect(commits(k), 'genau ein Commit').toBe(vorher + 1);
    expect(k.git('log', '-1', '--format=%an')).toBe('Stefan');
    expect(k.lies(KARTE), 'die Datei trägt eins und drei').toContain('- [ ] eins\n- [ ] drei');
    // der Hinweis bietet „Teilaufgabe „zwei“ entfernt“ mit rückgängig an
    const hinweis = page.locator('.toast');
    await expect(hinweis).toContainText('Teilaufgabe „zwei“ entfernt');
    await expect(hinweis.getByRole('button', { name: 'rückgängig' })).toHaveCount(1);
  });

  test('AK 4 (#106): zweimal Enter auf dem fokussierten ✕ löscht nur „zwei“', async ({ page }) => {
    await fensterOeffnen(page);
    const halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/teilaufgaben/'), 'DELETE');
    await page.getByLabel('Teilaufgabe zwei entfernen').focus();
    await page.keyboard.press('Enter');
    await bisAnfrageLaeuft(halte);
    await page.keyboard.press('Enter');
    halte.freigeben();

    await expect(page.locator('#fenster .chk span')).toHaveText(['eins', 'drei']);
    expect(halte.anzahl(), 'genau ein DELETE').toBe(1);
  });

  test('AK 10 (#134 a): Doppelklick auf das ✕ einer Wirkung entfernt genau eine', async ({ page }) => {
    await k.stoppen();
    k = await kanbanStarten(einrichten(bestandMit(DREI_OFFEN, 'wbs-effects:\n  - {application: kd, action: rework, node: D0002}\n  - {application: kd, action: remove, node: I0014}\n')));
    await fensterOeffnen(page);
    const vorher = commits(k);
    await reiter(page, 'Details');
    await expect(page.locator('#fenster #wirkungen button[data-act="wirkung-weg"]')).toHaveCount(2);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/wbs-effects/0', 'DELETE');
    await page.locator('#fenster #wirkungen button[data-act="wirkung-weg"]').nth(0).dblclick();
    await bisAnfrageLaeuft(halte);
    halte.freigeben();

    expect(halte.anzahl(), 'genau ein DELETE').toBe(1);
    await expect.poll(() => commits(k), { message: 'genau ein Commit' }).toBe(vorher + 1);
    await expect(page.locator('#fenster #wirkungen button[data-act="wirkung-weg"]')).toHaveCount(1);
    const datei = k.lies(KARTE);
    expect(datei.match(/node: D0002/g) || [], 'die erste Wirkung ist weg').toHaveLength(0);
    expect(datei.match(/node: I0014/g) || [], 'die zweite Wirkung steht noch').toHaveLength(1);
  });

  test('AK 11 (#134 b): Doppelklick auf das ✕ einer Entwurfs-Teilaufgabe lässt „zwei“ stehen', async ({ page }) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    const vorher = commits(k);
    const schreibend = [];
    page.on('request', r => { if (r.method() !== 'GET') schreibend.push(`${r.method()} ${new URL(r.url()).pathname}`); });
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('Probe');
    await page.locator('#neu-teil').fill('eins');
    await page.locator('#neu-teil').press('Enter');
    await page.locator('#neu-teil').fill('zwei');
    await page.locator('#neu-teil').press('Enter');
    await expect(page.locator('#neu-fenster .chk span')).toHaveText(['eins', 'zwei']);

    await page.locator('#neu-fenster .chk .x').nth(0).dblclick();

    await expect(page.locator('#neu-fenster .chk span'), 'nur „eins“ ist weg, „zwei“ steht noch').toHaveText(['zwei']);
    expect(schreibend, 'kein Serveraufruf').toEqual([]);
    expect(commits(k), 'kein Commit').toBe(vorher);
  });

  test('AK 11: das ✕ einer Entwurfszeile trägt eine im Zustand vergebene Kennung (Mutant M5)', async ({ page }) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('Probe');
    for (const text of ['eins', 'zwei', 'drei']) {
      await page.locator('#neu-teil').fill(text);
      await page.locator('#neu-teil').press('Enter');
    }
    const kennungen = () => page.locator('#neu-fenster .chk .x').evaluateAll(x => x.map(e => e.dataset.arg));
    const vorher = await kennungen();
    expect(new Set(vorher).size, 'jede Zeile trägt eine eigene Kennung').toBe(3);

    // „eins“ entfernen: „zwei“ rückt auf Platz 0 nach — seine Kennung bleibt dieselbe (die Stelle wäre jetzt „0“)
    await page.locator('#neu-fenster .chk .x').nth(0).click();
    await expect(page.locator('#neu-fenster .chk span')).toHaveText(['zwei', 'drei']);
    expect(await kennungen()).toEqual([vorher[1], vorher[2]], 'die Kennung führt die Zeile, nicht die Stelle');

    // und das ✕ trifft die Zeile, die es nennt — nicht die Stelle (die Stelle 1 wäre jetzt „drei“)
    await page.locator('#neu-fenster .chk .x').nth(1).click();
    await expect(page.locator('#neu-fenster .chk span')).toHaveText(['zwei']);
  });
});

test.describe('R00148 Doppeltipp auf die Kartenleiste (Touch 390)', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  let k;
  test.afterEach(() => k.stoppen());

  const leiste = page => page.locator('.ka[data-id="1"] .naechste-ziel');
  /** Zwei Berührungen desselben Ziels im Abstand `abstand` ms; die Antwort der ersten wird gehalten. */
  async function doppeltipp(page, halte, abstand) {
    const box = await leiste(page).boundingBox();
    const mitte = [box.x + box.width / 2, box.y + box.height / 2];
    await page.touchscreen.tap(...mitte);
    await bisAnfrageLaeuft(halte);
    await page.waitForTimeout(abstand);
    await page.touchscreen.tap(...mitte);
  }

  for (const abstand of [120, 600]) {
    test(`AK 5 (#65): Doppeltipp in ${abstand} ms hakt nur „zwei“ ab`, async ({ page }) => {
      k = await kanbanStarten(einrichten(bestandMit(ZWEI_OFFEN)));
      await alsPerson(page, 'st');
      await page.goto(k.adresse);
      await liveBereit(page);
      await expect(leiste(page)).toHaveText('zwei');
      const vorher = commits(k);
      const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/teilaufgaben/1', 'PATCH');
      await doppeltipp(page, halte, abstand);
      halte.freigeben();

      await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [x] zwei\n- [ ] drei');
      expect(halte.anzahl(), 'genau ein PATCH').toBe(1);
      expect(commits(k), 'genau ein Commit').toBe(vorher + 1);
      expect(k.lies(KARTE), '„drei“ bleibt offen').toContain('- [ ] drei');
    });
  }

  test('AK 6 (#65 c): Doppeltipp auf der letzten offenen Teilaufgabe öffnet kein Fenster', async ({ page }) => {
    k = await kanbanStarten(einrichten(bestandMit(LETZTE_OFFEN)));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await expect(leiste(page)).toHaveText('drei');
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/teilaufgaben/2', 'PATCH');
    await doppeltipp(page, halte, 120);
    halte.freigeben();

    await expect.poll(() => k.lies(KARTE)).toContain('- [x] drei');
    expect(halte.anzahl(), 'genau ein PATCH').toBe(1);
    expect(commits(k), 'genau ein Commit').toBe(vorher + 1);
    await expect(page.locator('[role="dialog"]'), 'kein Fenster offen').toHaveCount(0);
    await expect(page.locator('#fenster')).toHaveCount(0);
  });
});

test.describe('R00148 Nacharbeit: Schreibwirkung entscheidet, jeder Weg ist gesperrt', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(bestand())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  /** Öffnet #1 wie ein Mensch mit der Tastatur (Karte fokussieren, Enter) — danach wirken die Fensterkürzel. */
  const fensterPerTaste = async (page) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
  };

  test('B1 (AK 12/15): Doppelklick auf „nächste Woche“ blättert zwei Wochen weiter', async ({ page }) => {
    await page.goto(k.adresse + '#/berichte/stundenzettel');
    const woche = page.locator('#woche');
    await expect(woche).toBeVisible();
    const heute = await woche.textContent();
    await page.getByLabel('nächste Woche').click();
    await expect(woche).not.toHaveText(heute);
    const eineWeiter = await woche.textContent();
    await page.getByLabel('vorige Woche').click();
    await expect(woche).toHaveText(heute);

    await page.getByLabel('nächste Woche').dblclick();
    // zwei Wochen weiter: eine Woche zurück steht genau eine Woche weiter (nicht heute, nicht zwei zurück)
    await expect(woche).not.toHaveText(eineWeiter);
    await expect(woche).not.toHaveText(heute);
    await page.getByLabel('vorige Woche').click();
    await expect(woche).toHaveText(eineWeiter);
  });

  test('B1 (AK 11, Klasse): Doppelklick auf das ✕ einer Entwurfsspalte entfernt nur diese Spalte', async ({ page }) => {
    // Eine Entwurfsliste ohne Anfrage hat Schreibwirkung wie eine Anfrage: der zweite Klick der Geste träfe die nachgerückte Zeile.
    await page.goto(k.adresse);
    await liveBereit(page);
    await ausMehr(page, 'Spalten einrichten');
    await expect(page.getByLabel('Spalte In Arbeit entfernen')).toBeVisible();
    await page.getByLabel('Spalte In Arbeit entfernen').dblclick();
    await expect(page.getByLabel('Spalte In Arbeit entfernen')).toHaveCount(0);
    await expect(page.getByLabel('Spalte Erledigt entfernen'), 'die nachgerückte Spalte bleibt').toHaveCount(1);
  });

  test('B2 (AK 12): zweimal Enter im Kommentarfeld ergibt genau einen Kommentar', async ({ page }) => {
    await fensterPerTaste(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/kommentare', 'POST');
    const feld = page.getByLabel('Neuer Kommentar');
    await feld.fill('Hallo');
    await feld.press('Enter');
    await bisAnfrageLaeuft(halte);
    await page.waitForTimeout(80); // der Abstand der Probe, keine Wartezeit auf einen Zustand
    await feld.press('Enter');
    expect(halte.anzahl(), 'genau ein POST …/kommentare, solange die Antwort aussteht').toBe(1);
    halte.freigeben();

    await expect(page.locator('#fenster .km p', { hasText: 'Hallo' })).toHaveCount(1);
    await expect.poll(() => commits(k), { message: 'genau ein Commit' }).toBe(vorher + 1);
    expect(halte.anzahl(), 'genau ein POST').toBe(1);
    expect(k.lies(KARTE).match(/Hallo/g) || [], 'die Datei trägt „Hallo“ einmal').toHaveLength(1);
  });

  test('B2 (AK 12): Taste „t“ zweimal startet den Timer einmal, nach der Antwort wirkt sie wieder', async ({ page }) => {
    await fensterPerTaste(page);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/timer/start', 'POST');
    await page.keyboard.press('t');
    await bisAnfrageLaeuft(halte);
    await page.keyboard.press('t');
    expect(halte.anzahl(), 'genau ein POST …/timer/start').toBe(1);
    halte.freigeben();
    await expect(page.locator('.tz.eigen')).toBeVisible();
    expect(halte.anzahl()).toBe(1);

    // nach der Antwort ist die Taste wieder wirksam: jetzt stoppt sie den laufenden Timer
    const stopp = page.waitForRequest(r => r.method() === 'POST' && /\/api\/aufgaben\/1\/timer\/stop/.test(new URL(r.url()).pathname));
    await page.keyboard.press('t');
    await stopp;
  });

  test('B2 (AK 12): Taste „a“ zweimal archiviert einmal — Taste und Menüpunkt „Archivieren“ sind ein Auslöser', async ({ page }) => {
    await fensterPerTaste(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/archivieren', 'POST');
    await page.keyboard.press('a');
    await bisAnfrageLaeuft(halte);
    await page.keyboard.press('a');
    expect(halte.anzahl(), 'genau ein POST …/archivieren').toBe(1);
    // derselbe Auslöser als Menüpunkt im ⋮-Menü des Fensters: gesperrt, solange die Anfrage der Taste läuft
    await page.locator('#fenster [data-act="fenster-menue"][data-arg="aktionen"]').click();
    const menuepunkt = page.locator('#fenster [data-act="archivieren"][data-arg="1"]');
    await expect(menuepunkt).toHaveAttribute('aria-disabled', 'true');
    await menuepunkt.click({ force: true });
    expect(halte.anzahl(), 'auch der Menüpunkt sendet nicht').toBe(1);
    halte.freigeben();
    await expect.poll(() => commits(k), { message: 'genau ein Commit' }).toBe(vorher + 1);
    await expect.poll(() => k.lies(KARTE)).toContain('archived:');
    expect(halte.anzahl()).toBe(1);
  });
});

/** Karte #1 mit drei Teilaufgaben und zwei Wirkungen — die Familien ✕, Kästchen und Chip-✕ an einem Fenster. */
const MIT_WIRKUNGEN = 'wbs-effects:\n  - {application: kd, action: rework, node: D0002}\n  - {application: kd, action: remove, node: I0014}\n';

test.describe('R00148 Nacharbeit: jede Variante als eigene Probe (AK 12, 14, 16, 19, 20)', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(bestandMit(DREI_OFFEN, MIT_WIRKUNGEN))); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const fensterOeffnen = async (page) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="1"] .t').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
  };

  /** Zweimal Enter auf dem fokussierten Auslöser (Klick mit detail 0): nur die Sperre hält den zweiten auf, nicht der
      Wächter gegen den zweiten Klick einer Geste. Der Auslöser behält dazwischen den Fokus (AK 14). Danach wartet die
      Probe, bis die Schlange leer ist — eine zweite Anfrage stünde sonst noch hinter der ersten (`halte.gesamt()`). */
  async function zweimalEnter(page, ausloeser, halte) {
    const seitenfehler = [];
    page.on('pageerror', f => seitenfehler.push(f.message));
    await ausloeser.focus();
    await page.keyboard.press('Enter');
    await bisAnfrageLaeuft(halte);
    await expect(ausloeser, 'der Auslöser behält den Fokus').toBeFocused();
    await expect(ausloeser).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Enter');
    expect(halte.anzahl(), 'die zweite Betätigung sendet nicht').toBe(1);
    halte.freigeben();
    await expect.poll(() => page.evaluate(() => schlangeOffen()), { message: 'die Schlange ist leer' }).toBe(0);
    expect(halte.gesamt(), 'auch nach der Antwort keine zweite Anfrage').toBe(1);
    expect(seitenfehler, 'keine zweite Ausführung ins Leere').toEqual([]);
  }

  for (const ausgang of ['abbrechen', '500']) {
    test(`AK 16: scheitert die Anfrage (${ausgang}), ist derselbe Auslöser wieder bedienbar`, async ({ page }) => {
      await fensterOeffnen(page);
      const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/teilaufgaben/1', 'DELETE');
      const knopf = page.getByLabel('Teilaufgabe zwei entfernen');
      await knopf.click();
      await bisAnfrageLaeuft(halte);
      await expect(knopf).toHaveAttribute('aria-disabled', 'true');
      halte.freigeben(ausgang);

      await expect(knopf, 'die Sperre endet mit der Ablehnung').not.toHaveAttribute('aria-disabled', 'true');
      expect(k.lies(KARTE), 'nichts wurde entfernt').toContain('- [ ] zwei');
      const zweite = page.waitForRequest(r => r.method() === 'DELETE' && new URL(r.url()).pathname === '/api/aufgaben/1/teilaufgaben/1');
      await knopf.click();
      await zweite;
      await expect.poll(() => k.lies(KARTE)).toContain('- [ ] eins\n- [ ] drei');
    });
  }

  test('AK 12 (nf-anlegen): zweimal Enter auf „Anlegen“ und zweimal Enter im Titel senden je genau einen POST', async ({ page }) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    const vorher = commits(k);
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await dialog.getByLabel('Titel der neuen Aufgabe').fill('per Knopf');
    let halte = await anfragenHalten(page, p => p === '/api/aufgaben', 'POST');
    await zweimalEnter(page, dialog.getByRole('button', { name: 'Anlegen', exact: true }), halte);
    await expect(page.locator('.ka', { hasText: 'per Knopf' })).toHaveCount(1);
    await expect.poll(() => commits(k)).toBe(vorher + 1);
    expect(halte.anzahl()).toBe(1);
    await page.unrouteAll({ behavior: 'wait' });

    // Enter im Titel ist derselbe Auslöser „Anlegen“
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    const titel = page.getByRole('dialog', { name: 'Neue Aufgabe' }).getByLabel('Titel der neuen Aufgabe');
    await titel.fill('per Enter');
    halte = await anfragenHalten(page, p => p === '/api/aufgaben', 'POST');
    await titel.press('Enter');
    await bisAnfrageLaeuft(halte);
    await titel.press('Enter');
    expect(halte.anzahl(), 'Enter im Titel sendet kein zweites Mal').toBe(1);
    halte.freigeben();
    await expect(page.locator('.ka', { hasText: 'per Enter' })).toHaveCount(1);
    await expect.poll(() => commits(k)).toBe(vorher + 2);
    expect(halte.anzahl()).toBe(1);
  });

  test('AK 12 (Fertig im Spalten-Dialog): zweimal Enter auf „Fertig“ sendet genau einen PUT', async ({ page }) => {
    await page.goto(k.adresse);
    await liveBereit(page);
    const vorher = commits(k);
    await ausMehr(page, 'Spalten einrichten');
    await page.getByLabel('Kommentar Zu erledigen').fill('nur einmal');
    const halte = await anfragenHalten(page, p => p === '/api/boards/entwicklung/spalten', 'PUT');
    await zweimalEnter(page, page.getByRole('button', { name: 'Fertig', exact: true }), halte);
    await expect(page.locator('.kz-modus')).toHaveCount(0);
    await expect.poll(() => commits(k)).toBe(vorher + 1);
    expect(halte.anzahl(), 'genau ein PUT …/spalten').toBe(1);
    expect(k.lies(BOARD).match(/nur einmal/g) || []).toHaveLength(1);
  });

  test('AK 12 (bestand-tauschen): zweimal Enter auf „⇄ Achsen tauschen“ sendet genau einen PUT', async ({ page }) => {
    await k.stoppen();
    const mitLabels = bestandMit(DREI_OFFEN);
    mitLabels[BOARD] = '---\nreport-labels: {rows: repo, columns: nc}\n---\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n- [#2](../aufgaben/0002-shop.md)\n\n## In Arbeit\n\n## Erledigt\n';
    mitLabels['aufgaben/0002-shop.md'] = '---\nid: 2\ntitle: shop\nlabels: ["repo:shop", "nc:304"]\n---\n';
    k = await kanbanStarten(einrichten(mitLabels));
    await page.goto(k.adresse + '#/berichte/bestand');
    await filterOeffnen(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/boards/entwicklung/bestand', 'PUT');
    await zweimalEnter(page, page.getByRole('button', { name: '⇄ Achsen tauschen' }), halte);
    await expect.poll(() => k.lies(BOARD)).toContain('report-labels: {rows: nc, columns: repo}');
    expect(halte.anzahl(), 'genau ein PUT …/bestand').toBe(1);
    expect(commits(k)).toBe(vorher + 1);
  });

  test('AK 12 (wirkung-weg): zweimal Enter auf dem ✕ der ersten Wirkung sendet genau ein DELETE', async ({ page }) => {
    await fensterOeffnen(page);
    const vorher = commits(k);
    await reiter(page, 'Details');
    const halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/wbs-effects/'), 'DELETE');
    await zweimalEnter(page, page.locator('#fenster #wirkungen button[data-act="wirkung-weg"]').nth(0), halte);
    await expect(page.locator('#fenster #wirkungen button[data-act="wirkung-weg"]')).toHaveCount(1);
    await expect.poll(() => commits(k)).toBe(vorher + 1);
    expect(halte.anzahl(), 'genau ein DELETE').toBe(1);
    expect(k.lies(KARTE)).toContain('node: I0014');
    expect(k.lies(KARTE)).not.toContain('node: D0002');
  });

  test('AK 14: der gesperrte Auslöser bleibt per Tab erreichbar', async ({ page }) => {
    await fensterOeffnen(page);
    const halte = await anfragenHalten(page, p => p === '/api/aufgaben/1/teilaufgaben/1', 'DELETE');
    const knopf = page.getByLabel('Teilaufgabe zwei entfernen');
    await knopf.focus();
    await page.keyboard.press('Enter');
    await bisAnfrageLaeuft(halte);
    await expect(knopf).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Shift+Tab');
    await expect(knopf, 'der Fokus hat den Auslöser verlassen').not.toBeFocused();
    await page.keyboard.press('Tab');
    await expect(knopf, 'Tab erreicht den gesperrten Auslöser').toBeFocused();
    expect(await knopf.evaluate(e => e.disabled), 'kein natives disabled').toBe(false);
    halte.freigeben();
    await expect.poll(() => k.lies(KARTE)).toContain('- [ ] eins\n- [ ] drei');
  });

  /** Sichtbare Sperrform am Knoten: kein opacity, im Fokus ein ungedämpfter Ring mit mindestens 3:1 zur Fläche. */
  async function sperrformPruefen(page, ausloeser, familie, fokussierbar = true) {
    await expect(ausloeser, familie).toHaveAttribute('aria-disabled', 'true');
    expect(await ausloeser.evaluate(e => getComputedStyle(e).opacity), `${familie}: kein opacity am Knoten`).toBe('1');
    if (!fokussierbar) return;
    await page.keyboard.press('Shift'); // die letzte Eingabe war die Tastatur: der Fokus zeigt seinen Ring (:focus-visible)
    await ausloeser.focus();
    const ring = await ausloeser.evaluate(e => { const s = getComputedStyle(e); return { stil: s.outlineStyle, breite: s.outlineWidth, farbe: s.outlineColor }; });
    expect(ring.stil, `${familie}: Fokusring`).toBe('solid');
    expect(ring.breite, `${familie}: Fokusring 2 px`).toBe('2px');
    await page.evaluate(() => window.kdKontrast || null);
    const kontrast = await ausloeser.evaluate((e, farbe) => window.kdKontrast.schriftGegenGrund(e.parentElement, farbe), ring.farbe);
    expect(kontrast, `${familie}: Fokusring ${ring.farbe} ≥ 3:1`).toBeGreaterThanOrEqual(3);
  }

  for (const name of ['light', 'dark']) {
    test(`AK 19/20 (${name}): gesperrte Auslöser je Familie — kein opacity, Fokusring ≥ 3:1, Kästchen behält aria-checked`, async ({ page }) => {
      await page.goto(k.adresse);
      await thema(page, name);
      await liveBereit(page);
      await kontrastFarben(page, '#000', '#fff'); // baut das Messwerkzeug ein

      // Kartenleiste (D0002)
      let halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/'), 'PATCH');
      const leiste = page.locator('.ka[data-id="1"] .naechste-ziel');
      await leiste.click();
      await bisAnfrageLaeuft(halte);
      await sperrformPruefen(page, leiste, 'Kartenleiste');
      halte.freigeben();
      await expect(leiste).not.toHaveAttribute('aria-disabled', 'true');
      await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins');
      await page.unrouteAll({ behavior: 'wait' });

      // Textknopf (D0002): „Anlegen“ im Fenster „Neue Aufgabe“
      await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
      const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
      await dialog.getByLabel('Titel der neuen Aufgabe').fill('Sperrform');
      halte = await anfragenHalten(page, p => p === '/api/aufgaben', 'POST');
      const anlegen = dialog.getByRole('button', { name: 'Anlegen', exact: true });
      await anlegen.click();
      await bisAnfrageLaeuft(halte);
      await sperrformPruefen(page, anlegen, 'Textknopf');
      halte.freigeben();
      await expect(page.locator('.ka', { hasText: 'Sperrform' })).toHaveCount(1);
      await page.unrouteAll({ behavior: 'wait' });

      // Symbolknopf ✕, Kästchen und Chip-✕ (D0003) im Aufgabenfenster — alle drei zugleich gesperrt (die Schlange hält sie)
      await page.locator('.ka[data-id="1"] .t').click();
      await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
      await reiter(page, 'Details');
      halte = await anfragenHalten(page, p => p.startsWith('/api/aufgaben/1/'), 'DELETE');
      const chip = page.locator('#fenster #wirkungen button[data-act="wirkung-weg"]').nth(0);
      await chip.click();
      await bisAnfrageLaeuft(halte);
      await sperrformPruefen(page, chip, 'Chip-✕');
      await reiter(page, 'Inhalt');
      const kreuz = page.getByLabel('Teilaufgabe drei entfernen');
      await kreuz.click();
      await sperrformPruefen(page, kreuz, 'Symbolknopf ✕');
      const kaestchen = page.locator('#fenster .chk i[role="checkbox"][aria-label="zwei"]');
      const vorher = await kaestchen.getAttribute('aria-checked');
      await kaestchen.click();
      await sperrformPruefen(page, kaestchen, 'Kästchen', false);
      await expect(kaestchen, 'das Kästchen wechselt seinen Zustand nicht').toHaveAttribute('aria-checked', vorher);
      halte.freigeben();
    });
  }
});
