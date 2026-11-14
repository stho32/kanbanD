// R00148 Eine laufende Aktion nimmt keinen zweiten Auslöser an (Karte #138, ADR-0025 Regel 1/2/5/6).
// Doppelklick und Doppeltipp treffen heute die nachgerückte Stelle oder wiederholen die Aktion: zwei Anfragen,
// zwei Commits, im Fall #106 Datenverlust. Die Proben halten die Antwort der ersten Anfrage (page.route), sonst
// ist sie vor dem zweiten Auslöser beendet und der Fall prüft nichts (R00148, „Zeitfenster“).
// ERWARTET ROT bis die Sperre (B0687) und der eine Schreibweg (B0688) stehen.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, ausMehr, filterOeffnen } = require('./hilfen');

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
    expect(k.lies(BOARD).match(/- #2\b/g) || [], 'eine Board-Zeile').toHaveLength(1);
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
    k = await kanbanStarten(einrichten(bestand('report-labels: {rows: repo, columns: nc}\n')));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/bestand');
    await filterOeffnen(page);
    const vorher = commits(k);
    const halte = await anfragenHalten(page, p => p === '/api/boards/entwicklung/bestand', 'PUT');

    await page.getByRole('button', { name: '⇄ Achsen tauschen' }).dblclick();
    await bisAnfrageLaeuft(halte);
    halte.freigeben();

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
});
