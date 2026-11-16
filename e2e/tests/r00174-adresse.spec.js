// R00174 Aufgabe über Adresse öffnen (F0143): `#/board/<slug>/aufgabe/<nr>` und `#/aufgaben/aufgabe/<nr>` (ADR-0029).
// Testfall in der Sprache der Anforderung; Selektoren und Adressen nur in den Helfern darunter.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');

const KONFLIKT = '---\nid: 11\n<<<<<<< HEAD\ntitle: elf\n=======\ntitle: elf anders\n>>>>>>> zweig\n---\n';
/** Ausgangslage von R00174: #7 auf beiden Boards, #8 auf keinem, #9 nur auf „Zweit“, #99 gibt es nicht; dazu #10 archiviert, #11 defekt. */
const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Bereit\n\n- #7\n- #10\n- #11\n\n## In Arbeit\n\n## Erledigt\n',
  'boards/zweit.md': '# Zweit\n\n## Bereit\n\n- #7\n- #9\n',
  'aufgaben/0007-dateiwaechter.md': '---\nid: 7\ntitle: Dateiwächter\n---\n',
  'aufgaben/0008-ohne-board.md': '---\nid: 8\ntitle: Ohne Board\n---\n',
  'aufgaben/0009-zweitablage.md': '---\nid: 9\ntitle: Zweitablage\n---\n',
  'aufgaben/0010-abgelegt.md': '---\nid: 10\ntitle: Abgelegt\narchived: 2026-10-01\n---\n',
  'aufgaben/0011-elf.md': KONFLIKT,
};

const HINWEIS = '.toast[role="status"]';
const fenster = (page, nr) => page.getByRole('dialog', { name: `Aufgabe #${nr}`, exact: true });
const irgendeinFenster = page => page.locator('#fenster, #defekt-fenster');
const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
const adresseEndetAuf = (page, ende) => expect.poll(() => page.url()).toMatch(new RegExp(ende.replace(/[/#]/g, '\\$&') + '$'));

/** Öffnet die Adresse in einem frischen Tab und wartet, bis die Ansicht steht. */
async function linkOeffnen(page, k, hash, anker = '.bahn') {
  await page.goto(k.adresse + hash);
  await bereit(page, anker);
}
/** Board „Entwicklung“ zeigt #10 und nie #9, „Zweit“ zeigt #9 — daran ist das gezeigte Board zu erkennen. */
async function zeigtBoard(page, name) {
  await expect(page.locator('.bahn').first()).toBeVisible();
  await expect(karte(page, 9)).toHaveCount(name === 'Zweit' ? 1 : 0);
  await expect(page).toHaveTitle(new RegExp(name));
}

test.describe('R00174 F0143: Adresse öffnet die Aufgabe', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-3 / AK 3: #7 liegt auf zwei Boards — die Adresse nennt das Board, das sich öffnet', async ({ page, context }) => {
    await linkOeffnen(page, k, '#/board/zweit/aufgabe/7');
    await zeigtBoard(page, 'Zweit');
    await expect(fenster(page, 7)).toBeVisible();
    await expect(fenster(page, 7)).toContainText('Dateiwächter');

    const zweiterTab = await context.newPage();
    await alsPerson(zweiterTab, 'st');
    await linkOeffnen(zweiterTab, k, '#/board/entwicklung/aufgabe/7');
    await zeigtBoard(zweiterTab, 'Entwicklung');
    await expect(fenster(zweiterTab, 7)).toBeVisible();
    await adresseEndetAuf(zweiterTab, '#/board/entwicklung/aufgabe/7');
  });

  test('AK 4: #/aufgaben/aufgabe/8 öffnet die Aufgabenliste mit dem Fenster „Aufgabe #8“', async ({ page }) => {
    await linkOeffnen(page, k, '#/aufgaben/aufgabe/8', 'tr[data-zeile]');
    await expect(page.locator('tr[data-zeile]').first()).toBeVisible();
    await expect(fenster(page, 8)).toBeVisible();
    await expect(fenster(page, 8)).toContainText('Ohne Board');
    await expect(page.locator(HINWEIS)).toHaveCount(0);
  });

  test('US-4 / AK 5: #99 gibt es nicht — Board ohne Fenster, Hinweis, die Adresse fällt auf das Board', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung/aufgabe/99');
    await zeigtBoard(page, 'Entwicklung');
    await expect(page.locator(HINWEIS)).toHaveText('Aufgabe #99 gibt es nicht');
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/board/entwicklung');
  });

  test('AK 5: in der Aufgabenliste fällt die Adresse einer unbekannten Nummer auf #/aufgaben', async ({ page }) => {
    await linkOeffnen(page, k, '#/aufgaben/aufgabe/99', 'tr[data-zeile]');
    await expect(page.locator(HINWEIS)).toHaveText('Aufgabe #99 gibt es nicht');
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/aufgaben');
  });

  test('AK 5: unbekanntes Board — erstes Board mit Fenster, Hinweis ohne den Slug, die Adresse nennt das gezeigte Board', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/gibtsnicht/aufgabe/7');
    await zeigtBoard(page, 'Entwicklung');
    await expect(fenster(page, 7)).toBeVisible();
    await expect(page.locator(HINWEIS)).toHaveText('Board aus dem Link gibt es nicht');
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    await expect(page.locator('body')).not.toContainText('gibtsnicht');
  });

  test('AK 5: #9 liegt nicht auf „Entwicklung“ — Board und Fenster, Hinweis im Fenster; ebenso die archivierte #10', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung/aufgabe/9');
    await zeigtBoard(page, 'Entwicklung');
    await expect(fenster(page, 9)).toBeVisible();
    await expect(fenster(page, 9).locator(HINWEIS)).toHaveText('#9 liegt nicht auf diesem Board');
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/9');

    await linkOeffnen(page, k, '#/board/entwicklung/aufgabe/10');
    await expect(fenster(page, 10)).toBeVisible();
    await expect(fenster(page, 10).locator(HINWEIS)).toHaveText('#10 liegt nicht auf diesem Board');
  });

  test('AK 5: liegt die Aufgabe auf dem Board, steht kein Hinweis', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/zweit/aufgabe/9');
    await expect(fenster(page, 9)).toBeVisible();
    await expect(page.locator(HINWEIS)).toHaveCount(0);
  });

  test('AK 6: ist die Datei der Aufgabe defekt, zeigt die Adresse das Defekt-Fenster', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung/aufgabe/11');
    await expect(page.getByRole('dialog', { name: 'Defekte Datei #11' })).toBeVisible();
    await expect(page.locator('#defekttext')).toContainText('<<<<<<< HEAD');
    await expect(page.locator(HINWEIS)).toHaveCount(0);
  });

  const FREMD = [
    '#/board/entwicklung/aufgabe/<img src=x onerror=alert(1)>',
    '#/board/entwicklung/aufgabe/%3Cimg%20src=x%20onerror=alert(1)%3E',
    '#/board/entwicklung/aufgabe/7<script>alert(1)</script>',
    '#/board/entwicklung/aufgabe/7%3Cscript%3E',
    '#/board/entwicklung/aufgabe/-1',
    '#/board/entwicklung/aufgabe/99999999999999999999',
    '#/board/entwicklung/aufgabe/7/8',
    '#/board/entwicklung/aufgabe/7' + 'x'.repeat(20000),
    '#/aufgaben/aufgabe/<img src=x onerror=alert(1)>',
  ];
  for (const hash of FREMD) {
    test(`AK 9: fremde Zeichen statt der Nummer öffnen kein Fenster und stehen nirgends in der Seite — ${hash.slice(0, 60)}`, async ({ page }) => {
      const dialoge = [];
      page.on('dialog', dialog => { dialoge.push(dialog.message()); dialog.dismiss(); });
      await linkOeffnen(page, k, hash, hash.startsWith('#/aufgaben') ? 'tr[data-zeile]' : '.bahn');
      await expect(irgendeinFenster(page)).toHaveCount(0);
      await expect(page.locator(HINWEIS)).toHaveCount(0);
      const seite = await page.evaluate(() => document.documentElement.outerHTML);
      for (const fremd of ['onerror', 'alert(1)', '%3C', 'xxxxxxxx', '99999999999999999999']) expect(seite, fremd).not.toContain(fremd);
      await expect(page.locator('img[src="x"]')).toHaveCount(0);
      expect(dialoge).toEqual([]);
    });
  }

  test('AK 9: fremde Zeichen statt des Boards — erstes Board, Fenster #7, der Adresstext steht nirgends in der Seite', async ({ page }) => {
    const dialoge = [];
    page.on('dialog', dialog => { dialoge.push(dialog.message()); dialog.dismiss(); });
    await linkOeffnen(page, k, '#/board/<img src=x onerror=alert(1)>/aufgabe/7');
    await zeigtBoard(page, 'Entwicklung');
    await expect(fenster(page, 7)).toBeVisible();
    await expect(page.locator(HINWEIS)).toHaveText('Board aus dem Link gibt es nicht');
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    const seite = await page.evaluate(() => document.documentElement.outerHTML);
    for (const fremd of ['onerror', 'alert(1)', '%3C']) expect(seite, fremd).not.toContain(fremd);
    expect(dialoge).toEqual([]);
  });

  test('Nur Navigation: das Laden eines Links stellt nur GET-Anfragen und erzeugt keinen Commit', async ({ page }) => {
    const commitsVorher = k.git('rev-list', '--count', 'HEAD');
    const anfragen = [];
    page.on('request', anfrage => anfragen.push(anfrage.method() + ' ' + new URL(anfrage.url()).pathname));
    for (const hash of ['#/board/zweit/aufgabe/7', '#/aufgaben/aufgabe/8', '#/board/entwicklung/aufgabe/99', '#/board/gibtsnicht/aufgabe/7', '#/board/entwicklung/aufgabe/11']) {
      await page.goto(k.adresse + hash);
      await page.reload();
      await bereit(page, hash.startsWith('#/aufgaben') ? 'tr[data-zeile]' : '.bahn');
    }
    await expect(fenster(page, 7)).toHaveCount(0);
    expect(anfragen.some(a => a === 'GET /api/aufgaben/7')).toBe(true);
    expect(anfragen.filter(a => !a.startsWith('GET '))).toEqual([]);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commitsVorher);
    expect(k.git('status', '--porcelain')).toBe('');
  });

  test('AK 2 / R00155: ein Link in derselben Sitzung wechselt das Fenster — der ungespeicherte Titel wird gespeichert wie beim Schließen über ✕', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/zweit/aufgabe/7');
    await fenster(page, 7).locator('[data-act="titel-bearbeiten"]').click();
    await page.locator('#fenster [data-af="titel"]').fill('Waechter per Kreuz');
    await fenster(page, 7).getByRole('button', { name: /Schließen/ }).click();
    await expect.poll(() => k.lies('aufgaben/0007-dateiwaechter.md'), 'Vergleich: ✕ speichert den Entwurf').toContain('title: Waechter per Kreuz');
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await expect(karte(page, 7).locator('.t')).toHaveText('Waechter per Kreuz');

    await karte(page, 7).locator('.t').click();
    await fenster(page, 7).locator('[data-act="titel-bearbeiten"]').click();
    await page.locator('#fenster [data-af="titel"]').fill('Waechter per Link');
    const commitsVorher = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.evaluate(() => { location.hash = '#/board/zweit/aufgabe/9'; });
    await expect(fenster(page, 9)).toBeVisible();
    await expect(fenster(page, 9)).toContainText('Zweitablage');
    await expect(fenster(page, 7)).toHaveCount(0);
    await expect.poll(() => k.lies('aufgaben/0007-dateiwaechter.md')).toContain('title: Waechter per Link');
    expect(k.lies('aufgaben/0009-zweitablage.md')).toContain('title: Zweitablage');
    await bereit(page, '.bahn');
    expect(Number(k.git('rev-list', '--count', 'HEAD')), 'genau ein Speichern, kein doppeltes').toBe(commitsVorher + 1);
    await expect(karte(page, 7).locator('.t')).toHaveText('Waechter per Link');
  });

  test('Eine Adresse ohne Nummer schließt das offene Fenster; dieselbe Aufgabe bleibt beim Wechsel des Boards offen', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/zweit/aufgabe/7');
    await page.evaluate(() => { location.hash = '#/board/entwicklung/aufgabe/7'; });
    await zeigtBoard(page, 'Entwicklung');
    await expect(fenster(page, 7)).toBeVisible();
    await page.evaluate(() => { location.hash = '#/board/entwicklung'; });
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await zeigtBoard(page, 'Entwicklung');
  });

  test('Ein Laden aus anderem Anlass öffnet das geschlossene Fenster nicht wieder', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/zweit/aufgabe/7');
    await page.keyboard.press('Escape');
    await expect(irgendeinFenster(page)).toHaveCount(0);
    k.schreib('aufgaben/0009-zweitablage.md', '---\nid: 9\ntitle: Von außen geändert\n---\n');
    await expect(karte(page, 9).locator('.t')).toHaveText('Von außen geändert');
    await expect(irgendeinFenster(page)).toHaveCount(0);
  });

  test('AK 10: die bisherigen Adressen wirken wie zuvor — kein Fenster, kein Hinweis, die Adresse bleibt stehen', async ({ page }) => {
    const bisher = [
      ['#/board/zweit', '.bahn'], ['#/board/gibtsnicht', '.bahn'], ['#/aufgaben', 'tr[data-zeile]'], ['#/personen', '#main'],
      ['#/einrichten', '#main'], ['#/berichte/kosten', '#main'], ['#/berichte/stundenzettel', '#main'],
    ];
    for (const [hash, anker] of bisher) {
      await page.goto(k.adresse + hash);
      await page.reload();
      await bereit(page, anker);
      await expect(irgendeinFenster(page), hash).toHaveCount(0);
      await expect(page.locator(HINWEIS), hash).toHaveCount(0);
      expect(page.url().endsWith(hash), hash).toBe(true);
    }
    await page.goto(k.adresse + '#/board/zweit');
    await page.reload();
    await zeigtBoard(page, 'Zweit');
    await page.goto(k.adresse + '#/board/gibtsnicht');
    await page.reload();
    await zeigtBoard(page, 'Entwicklung');
  });

  test('AK 10: Zurück und Vor zwischen Board und Bericht wie zuvor', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/zweit');
    await page.evaluate(() => { location.hash = '#/berichte/kosten'; });
    await expect(page.locator('.bahn')).toHaveCount(0);
    await expect(page).toHaveTitle(/Kosten|Berichte/);
    await page.goBack();
    await zeigtBoard(page, 'Zweit');
    await adresseEndetAuf(page, '#/board/zweit');
    await page.goForward();
    await expect(page.locator('.bahn')).toHaveCount(0);
    await adresseEndetAuf(page, '#/berichte/kosten');
  });
});

test.describe('R00174 F0144: Adresse folgt dem Fenster, Zurück und Vor', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  /** Merkt, ob die Seite neu geladen oder die Ansicht neu vom Server geholt wird. */
  async function neuladenBeobachten(page) {
    await page.evaluate(() => { window.__nichtNeuGeladen = true; });
    const zustandsabrufe = [];
    page.on('request', anfrage => { if (new URL(anfrage.url()).pathname === '/api/zustand') zustandsabrufe.push(anfrage.url()); });
    return { zustandsabrufe, seiteSteht: () => page.evaluate(() => window.__nichtNeuGeladen === true) };
  }

  test('US-2 / AK 2: Öffnen und Schließen schreiben die Adresse ohne Neuladen; Zurück schließt, Vor öffnet', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung');
    const beobachtung = await neuladenBeobachten(page);
    await karte(page, 7).locator('.t').click();
    await expect(fenster(page, 7)).toBeVisible();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    await fenster(page, 7).getByRole('button', { name: /Schließen/ }).click();
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/board/entwicklung');
    await karte(page, 7).locator('.t').click();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    await page.keyboard.press('Escape');
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/board/entwicklung');
    expect(beobachtung.zustandsabrufe, 'das Nachführen der Adresse lädt die Ansicht nicht neu').toEqual([]);

    await karte(page, 7).locator('.t').click();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    await page.goBack();
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/board/entwicklung');
    await expect(karte(page, 7).locator('.t')).toHaveText('Dateiwächter');
    await page.goForward();
    await expect(fenster(page, 7)).toBeVisible();
    await expect(fenster(page, 7)).toContainText('Dateiwächter');
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    expect(await beobachtung.seiteSteht(), 'die Seite wurde nie neu geladen').toBe(true);
    await expect(page.locator(HINWEIS)).toHaveCount(0);
  });

  test('AK 2: der Fokus steht nach dem Öffnen im Fenster und nach dem Schließen wieder auf der Karte — wie ohne Adresse', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung');
    await karte(page, 7).focus();
    await page.keyboard.press('Enter');
    await expect(fenster(page, 7)).toBeVisible();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement.closest('#fenster')))).toBe(true);
    await page.keyboard.press('Escape');
    await adresseEndetAuf(page, '#/board/entwicklung');
    await expect(karte(page, 7)).toBeFocused();
  });

  test('AK 2: ohne Adresse gestartet nennt die Adresse nach dem Öffnen das gezeigte Board', async ({ page }) => {
    await page.goto(k.adresse);
    await bereit(page, '.bahn');
    await karte(page, 7).locator('.t').click();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
    await page.goBack();
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await zeigtBoard(page, 'Entwicklung');
  });

  test('AK 2 / R00155: Zurück bei ungespeichertem Titel speichert ihn wie das Schließen über ✕ — einmal, nichts geht verloren', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung');
    await karte(page, 7).locator('.t').click();
    await fenster(page, 7).locator('[data-act="titel-bearbeiten"]').click();
    await page.locator('#fenster [data-af="titel"]').fill('Waechter per Zurueck');
    const commitsVorher = Number(k.git('rev-list', '--count', 'HEAD'));
    await page.goBack();
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/board/entwicklung');
    await expect(karte(page, 7).locator('.t')).toHaveText('Waechter per Zurueck');
    expect(k.lies('aufgaben/0007-dateiwaechter.md')).toContain('title: Waechter per Zurueck');
    await bereit(page, '.bahn');
    expect(Number(k.git('rev-list', '--count', 'HEAD')), 'genau ein Speichern').toBe(commitsVorher + 1);
    await page.goForward();
    await expect(fenster(page, 7)).toContainText('Waechter per Zurueck');
    expect(Number(k.git('rev-list', '--count', 'HEAD')), 'Vor schreibt nichts').toBe(commitsVorher + 1);
  });

  test('AK 2: Vor zu einer anderen Aufgabe bei ungespeichertem Titel — gespeichert an der verlassenen Aufgabe, nie an der neuen', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/zweit');
    await karte(page, 9).locator('.t').click();
    await adresseEndetAuf(page, '#/board/zweit/aufgabe/9');
    await page.keyboard.press('Escape');
    await karte(page, 7).locator('.t').click();
    await adresseEndetAuf(page, '#/board/zweit/aufgabe/7');
    await fenster(page, 7).locator('[data-act="titel-bearbeiten"]').click();
    await page.locator('#fenster [data-af="titel"]').fill('Waechter verlassen');
    await page.evaluate(() => history.go(-2));
    await expect(fenster(page, 9)).toBeVisible();
    await expect(fenster(page, 9)).toContainText('Zweitablage');
    await expect.poll(() => k.lies('aufgaben/0007-dateiwaechter.md')).toContain('title: Waechter verlassen');
    expect(k.lies('aufgaben/0009-zweitablage.md')).toContain('title: Zweitablage');
  });

  test('AK 4: in der Aufgabenliste folgt die Adresse dem Fenster als #/aufgaben/aufgabe/<nr>', async ({ page }) => {
    await linkOeffnen(page, k, '#/aufgaben', 'tr[data-zeile]');
    await page.locator('tr[data-zeile]', { hasText: 'Ohne Board' }).getByText('Ohne Board').click();
    await expect(fenster(page, 8)).toBeVisible();
    await adresseEndetAuf(page, '#/aufgaben/aufgabe/8');
    await page.keyboard.press('Escape');
    await adresseEndetAuf(page, '#/aufgaben');
  });

  test('AK 6: auch das Defekt-Fenster hat seine Adresse', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung');
    await page.locator('.ka.defekt[data-id="11"]').click();
    await expect(page.getByRole('dialog', { name: 'Defekte Datei #11' })).toBeVisible();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/11');
    await page.keyboard.press('Escape');
    await adresseEndetAuf(page, '#/board/entwicklung');
  });

  test('Der Wechsel des Boards bei offenem Fenster und der Wechsel zum Bericht bleiben Sache der Adresse', async ({ page }) => {
    await linkOeffnen(page, k, '#/board/entwicklung/aufgabe/7');
    await page.evaluate(() => { location.hash = '#/berichte/kosten'; });
    await expect(irgendeinFenster(page)).toHaveCount(0);
    await adresseEndetAuf(page, '#/berichte/kosten');
    await page.goBack();
    await expect(fenster(page, 7)).toBeVisible();
    await adresseEndetAuf(page, '#/board/entwicklung/aufgabe/7');
  });
});
