// R00186 Warteschlange: Frist je Anfrage und ehrliche Meldung bei gescheiterter Anfrage
// (Paket der Karten #149, #148, #150; ADR-0025 Nachtrag N4). Die Frist von 15 s läuft über die Uhr des Browsers
// (`page.clock`), nie über echte Zeit: die Probe wartet, bis die Anfrage hängt, und stellt dann die Uhr vor.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, bereit, mutanteEinsetzen } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\n---\n- [ ] eins\n- [ ] zwei\n- [ ] drei\n',
  'aufgaben/0002-board-aufraeumen.md': '---\nid: 2\ntitle: Board aufräumen\n---\n',
};
const KARTE = 'aufgaben/0001-abnahme-pruefen.md';
const HINWEIS = '.toast[role="status"]';
const FUSS = '#fenster .mod-fuss [role="alert"]';
const NAECHSTE = '.ka[data-id="1"] .naechste-ziel';
const ZUSTAND = '/api/zustand';
const ERSTE_TEILAUFGABE = '/api/aufgaben/1/teilaufgaben/0';

const NICHTS_GEAENDERT = 'Keine Verbindung zum Server — nichts geändert.';
const KEINE_ANTWORT = 'Keine Antwort vom Server — bitte prüfen, ob die Änderung ankam.';
const NICHT_NEU_GELADEN = 'Änderung gespeichert — Ansicht nicht neu geladen.';
/** Die Frist je Anfrage (ADR-0025 N4): bis kurz davor geschieht nichts, mit ihrem Ablauf endet die Anfrage. */
const FRIST_MS = 15000, KURZ_DAVOR_MS = 14000;

/** Fängt die nächste Anfrage `methode pfad` an der Grenze des Browsers ab und behandelt sie mit `behandeln`; weitere gehen durch. */
async function naechsteAbfangen(page, methode, pfad, behandeln) {
  let scharf = true;
  await page.route(url => url.pathname === pfad, route => {
    if (!scharf || route.request().method() !== methode) return route.fallback();
    scharf = false;
    return behandeln(route);
  });
  return { getroffen: () => !scharf };
}
/** Scheitert hart: `fetch` wirft („Failed to fetch") — der Server ist weg. */
const naechsteAbbrechen = (page, methode, pfad) => naechsteAbfangen(page, methode, pfad, route => route.abort('failed'));
/** Hängt: die Anfrage wird nie beantwortet und erreicht den Server nicht. */
const naechsteHaengen = (page, methode, pfad) => naechsteAbfangen(page, methode, pfad, () => { });
/** Antwortet mit 200 und ungültigem JSON — ein Programmfehler beim Lesen, kein Netzfehler. */
const naechsteVerstuemmeln = (page, methode, pfad) => naechsteAbfangen(page, methode, pfad, route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"eingerichtet": tr' }));

/**
 * Fängt den nächsten `GET /api/zustand` ab, der NACH der eigenen Anfrage `methode pfad` beginnt — das Nachladen der
 * Warteschlange — und behandelt ihn mit `behandeln`. Im offenen Aufgabenfenster laufen vorher weitere Ladungen (Öffnen,
 * Adresse), die nicht gemeint sind.
 */
async function nachladenAbfangenNach(page, methode, pfad, behandeln) {
  let eigeneGesendet = false, getroffen = false;
  await page.route(url => url.pathname === pfad, route => {
    if (route.request().method() === methode) eigeneGesendet = true;
    return route.fallback();
  });
  await page.route(url => url.pathname === ZUSTAND, route => {
    if (!eigeneGesendet || getroffen || route.request().method() !== 'GET') return route.fallback();
    getroffen = true;
    return behandeln(route);
  });
  return { getroffen: () => getroffen };
}
const nachladenAbbrechenNach = (page, methode, pfad) => nachladenAbfangenNach(page, methode, pfad, route => route.abort('failed'));
const nachladenHaengenNach = (page, methode, pfad) => nachladenAbfangenNach(page, methode, pfad, () => { });

/** Wartet, bis der erste Stand geladen und gezeichnet ist — erst dann darf ein Fehler scharf geschaltet werden. */
async function boardBereit(page) {
  await liveBereit(page);
  await expect(page.locator(NAECHSTE)).toHaveText('eins');
}

/** Stellt die Uhr des Browsers vor; der Herzschlag hält die Live-Verbindung dabei frisch (der Server meldet sich real alle 15 s). */
async function uhrVor(page, ms) {
  await page.clock.fastForward(ms);
  await page.evaluate(() => window.kdTest.herzschlag());
}

/** Zahl der Commits auf `pfad`; der erste kommt aus `einrichten` (Autor „Vorbereitung"). */
const commitsAuf = (k, pfad = KARTE) => +k.git('rev-list', '--count', 'HEAD', '--', pfad);

test.describe('R00186 Frist je Anfrage und ehrliche Meldung', () => {
  let k, seitenfehler, spuren;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    seitenfehler = [];
    spuren = [];
    page.on('pageerror', f => seitenfehler.push(f.message));
    // Nur die Spur der Warteschlange: der Browser selbst schreibt für jede abgerissene Anfrage einen eigenen Konsolenfehler.
    page.on('console', m => { if (m.type() === 'error' && m.text().includes('Warteschlange')) spuren.push(m.text()); });
    await mutanteEinsetzen(page);
  });
  test.afterEach(async ({ page }) => {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await k.stoppen();
  });

  test('149-1 / US-1: Server weg — eine Meldung „nichts geändert" auf dem Board, der Haken verschwindet', async ({ page }) => {
    const eigeneAb = await naechsteAbbrechen(page, 'PATCH', ERSTE_TEILAUFGABE);
    await page.goto(k.adresse);
    await boardBereit(page);
    const ladungAb = await naechsteAbbrechen(page, 'GET', ZUSTAND);
    const vorher = commitsAuf(k);

    await page.locator(NAECHSTE).click();

    const hinweis = page.locator(HINWEIS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toHaveText(NICHTS_GEAENDERT);
    expect(eigeneAb.getroffen(), 'die eigene Anfrage ist abgerissen').toBe(true);
    await expect.poll(() => ladungAb.getroffen(), 'das Nachladen ist abgerissen').toBe(true);
    // die Karte widerspricht der Meldung nicht: „eins" ist wieder die nächste offene Teilaufgabe, nichts ist abgehakt
    await expect(page.locator(NAECHSTE)).toHaveText('eins');
    await expect(page.locator(NAECHSTE)).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.ka[data-id="1"] .tk')).toHaveText('☑ 0/3');
    await expect(page.locator('#fenster')).toHaveCount(0);
    // der Server hat die Änderung nie gesehen
    expect(k.lies(KARTE)).toContain('- [ ] eins\n- [ ] zwei\n- [ ] drei');
    expect(commitsAuf(k)).toBe(vorher);
    // 150-2 Gegenprobe: ein Netzfehler ist kein Programmfehler und hinterlässt keine Spur
    expect(spuren).toEqual([]);
    expect(seitenfehler, 'unbehandelte Ablehnung (pageerror)').toEqual([]);
  });

  test('148-1 / US-3: hängt die eigene Anfrage, meldet der Hinweis nach der Frist „Keine Antwort", und es geht weiter', async ({ page }) => {
    await page.clock.install();
    await page.goto(k.adresse);
    await boardBereit(page);
    const eigeneHaengt = await naechsteHaengen(page, 'PATCH', ERSTE_TEILAUFGABE);
    const vorher = commitsAuf(k);

    await page.locator(NAECHSTE).click();
    await expect.poll(() => eigeneHaengt.getroffen(), 'die eigene Anfrage hängt').toBe(true);
    const hinweis = page.locator(HINWEIS);
    // kurz vor der Frist steht noch nichts: sie ist nicht kürzer als zugesagt
    await uhrVor(page, KURZ_DAVOR_MS);
    await expect(hinweis).toHaveCount(0);

    // mit Ablauf der Frist: genau eine Meldung — ob die Änderung ankam, ist offen, also nie „nichts geändert"
    const nachgeladen = page.waitForResponse(r => r.request().method() === 'GET' && new URL(r.url()).pathname === ZUSTAND);
    await uhrVor(page, FRIST_MS - KURZ_DAVOR_MS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toHaveText(KEINE_ANTWORT);
    await expect(hinweis).not.toContainText('nichts geändert');
    // die Ansicht lädt neu und zeigt den Stand der Datei: „eins" ist offen
    expect((await nachgeladen).ok()).toBe(true);
    await expect(page.locator(NAECHSTE)).toHaveText('eins');
    await expect(page.locator('.ka[data-id="1"] .tk')).toHaveText('☑ 0/3');
    expect(k.lies(KARTE)).toContain('- [ ] eins\n- [ ] zwei');
    expect(commitsAuf(k)).toBe(vorher);

    // die Warteschlange läuft weiter: erneutes Abhaken wird gesendet und gespeichert, genau ein Commit — nichts wurde von selbst wiederholt
    const erneut = page.waitForRequest(r => r.method() === 'PATCH' && new URL(r.url()).pathname === ERSTE_TEILAUFGABE);
    await page.locator(NAECHSTE).click();
    expect((await erneut).postDataJSON()).toEqual({ erledigt: true });
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 1);
    await expect(page.locator(NAECHSTE)).toHaveText('zwei');
    await bereit(page, NAECHSTE);
    expect(commitsAuf(k), 'genau ein Commit').toBe(vorher + 1);
    expect(spuren, 'eine abgelaufene Frist ist kein Programmfehler').toEqual([]);
    expect(seitenfehler, 'unbehandelte Ablehnung (pageerror)').toEqual([]);
  });

  test('148-2 / US-2: hängt das Nachladen, meldet der Hinweis nach der Frist „gespeichert", eigene Änderungen und Live-Ereignisse wirken wieder', async ({ page, request }) => {
    await page.clock.install();
    await page.goto(k.adresse);
    await boardBereit(page);
    const ladungHaengt = await naechsteHaengen(page, 'GET', ZUSTAND);
    const vorher = commitsAuf(k);

    // die eigene Änderung wird gespeichert, das Nachladen bleibt unbeantwortet
    await page.locator(NAECHSTE).click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 1);
    await expect.poll(() => ladungHaengt.getroffen(), 'das Nachladen hängt').toBe(true);
    const hinweis = page.locator(HINWEIS);
    await uhrVor(page, KURZ_DAVOR_MS);
    await expect(hinweis).toHaveCount(0);

    await uhrVor(page, FRIST_MS - KURZ_DAVOR_MS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toHaveText(NICHT_NEU_GELADEN);

    // die nächste eigene Änderung wird gesendet: zwei Haken in der Datei, zwei Commits
    const zweite = page.waitForRequest(r => r.method() === 'PATCH' && new URL(r.url()).pathname === '/api/aufgaben/1/teilaufgaben/1');
    await page.locator(NAECHSTE).click();
    expect((await zweite).postDataJSON()).toEqual({ erledigt: true });
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [x] zwei\n- [ ] drei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 2);
    await expect(page.locator(NAECHSTE)).toHaveText('drei');
    await bereit(page, NAECHSTE);

    // ein Agent ändert den Titel von #2 über die API: das Board zeigt ihn ohne Zutun (Live-Ereignisse werden nicht mehr übersprungen)
    const antwort = await request.patch(k.adresse + 'api/aufgaben/2', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'Board entrümpeln' } });
    expect(antwort.ok()).toBe(true);
    await expect(page.locator('.ka[data-id="2"]')).toContainText('Board entrümpeln');
    expect(spuren, 'eine abgelaufene Frist ist kein Programmfehler').toEqual([]);
    expect(seitenfehler, 'unbehandelte Ablehnung (pageerror)').toEqual([]);
  });

  test('150-1 / US-4: im Aufgabenfenster steht das gescheiterte Nachladen am Hinweis-Anker, nicht im Fuß', async ({ page }) => {
    await page.goto(k.adresse);
    await boardBereit(page);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    const fenster = page.getByRole('dialog');
    await fenster.waitFor();
    const ladungAb = await nachladenAbbrechenNach(page, 'PATCH', ERSTE_TEILAUFGABE);

    await fenster.getByRole('checkbox', { name: 'eins', exact: true }).click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');

    const amAnker = page.locator('#fenster .hinweis-anker [role="status"]');
    await expect(amAnker).toHaveCount(1);
    await expect(amAnker).toHaveText(NICHT_NEU_GELADEN);
    await expect(page.locator(HINWEIS), 'genau eine Meldung auf dem Schirm').toHaveCount(1);
    expect(ladungAb.getroffen(), 'das Nachladen ist abgerissen').toBe(true);
    // nicht im Fuß, und nirgends „nichts geändert" (Fuß, Statusleiste)
    await expect(page.locator(FUSS)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('nichts geändert');
  });

  test('Datumseingabe (R00179): die Meldung erscheint beim Nachholen des Zeichnens, auch nach mehr als ihrer Lebensdauer', async ({ page }) => {
    await page.clock.install();
    await page.goto(k.adresse);
    await boardBereit(page);
    await page.locator('.ka[data-id="1"]').click({ position: { x: 5, y: 5 } });
    const fenster = page.getByRole('dialog');
    await fenster.waitFor();
    const ladungHaengt = await nachladenHaengenNach(page, 'PATCH', ERSTE_TEILAUFGABE);

    await fenster.getByRole('checkbox', { name: 'eins', exact: true }).click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');
    await expect.poll(() => ladungHaengt.getroffen(), 'das Nachladen hängt').toBe(true);
    // ein Datum wird getippt: solange die Eingabe läuft, zeichnet die Seite nicht (R00179)
    const faellig = fenster.getByLabel('Fälligkeit', { exact: true });
    await faellig.focus();
    await page.keyboard.press('1');

    const amAnker = page.locator('#fenster .hinweis-anker [role="status"]');
    await uhrVor(page, FRIST_MS);
    await expect(amAnker, 'die Probe trifft das aufgeschobene Zeichnen').toHaveCount(0);
    // die Eingabe dauert länger als die 20 s, die die Meldung steht — gezählt wird ihre Lebensdauer erst ab dem Zeigen
    await uhrVor(page, 25000);
    await page.keyboard.press('Tab');

    await expect(amAnker).toHaveCount(1);
    await expect(amAnker).toHaveText(NICHT_NEU_GELADEN);
    await expect(page.locator(HINWEIS), 'genau eine Meldung auf dem Schirm').toHaveCount(1);
    expect(seitenfehler, 'unbehandelte Ablehnung (pageerror)').toEqual([]);
  });

  test('150-2: ein Programmfehler beim Nachladen steht in der Konsole, die eine Meldung bleibt', async ({ page }) => {
    await page.goto(k.adresse);
    await boardBereit(page);
    const ladungKaputt = await naechsteVerstuemmeln(page, 'GET', ZUSTAND);

    await page.locator(NAECHSTE).click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');

    const hinweis = page.locator(HINWEIS);
    await expect(hinweis).toHaveCount(1);
    await expect(hinweis).toHaveText(NICHT_NEU_GELADEN);
    expect(ladungKaputt.getroffen(), 'das Nachladen hat die verstümmelte Antwort bekommen').toBe(true);
    await expect.poll(() => spuren, 'der Programmfehler steht als console.error in der Konsole').toHaveLength(1);
    expect(spuren[0]).toContain('Nachladen');
    expect(spuren[0]).toContain('SyntaxError');
  });

  test('Bleibt: im Normalbetrieb erscheint keine der Meldungen', async ({ page }) => {
    await page.goto(k.adresse);
    await boardBereit(page);
    const vorher = commitsAuf(k);

    await page.locator(NAECHSTE).click();
    await expect.poll(() => k.lies(KARTE)).toContain('- [x] eins\n- [ ] zwei');
    await expect.poll(() => commitsAuf(k)).toBe(vorher + 1);
    await expect(page.locator(NAECHSTE)).toHaveText('zwei');
    await bereit(page, NAECHSTE);

    await expect(page.locator(HINWEIS)).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Keine Antwort vom Server');
    await expect(page.locator('body')).not.toContainText('nicht neu geladen');
    expect(spuren).toEqual([]);
    expect(seitenfehler).toEqual([]);
  });
});
