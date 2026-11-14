// R00148 Eine laufende Aktion nimmt keinen zweiten Auslöser an (Karte #138, ADR-0025 Regel 1/2/5/6).
// Doppelklick und Doppeltipp treffen heute die nachgerückte Stelle oder wiederholen die Aktion: zwei Anfragen,
// zwei Commits, im Fall #106 Datenverlust. Die Proben halten die Antwort der ersten Anfrage (page.route), sonst
// ist sie vor dem zweiten Auslöser beendet und der Fall prüft nichts (R00148, „Zeitfenster“).
// ERWARTET ROT bis die Sperre (B0687) und der eine Schreibweg (B0688) stehen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, ausMehr, filterOeffnen, reiter, mutanteEinsetzen } = require('./hilfen');

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
  let scharf = true, anzahl = 0, oeffnen;
  const tor = new Promise(ok => { oeffnen = ok; });
  await page.route(url => passt(url.pathname), async route => {
    if (!scharf || route.request().method() !== methode) return route.fallback();
    anzahl++;
    await tor;
    await route.continue();
  });
  return { anzahl: () => anzahl, freigeben: () => { scharf = false; oeffnen(); } };
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
});
