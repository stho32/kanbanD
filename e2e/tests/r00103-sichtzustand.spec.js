// R00103 Aufgabenfenster übersteht Live-Änderungen (ADR-0007: Sichtzustand übersteht das Neuzeichnen)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  bot: {name: Bot, kind: agent}
---
`;
const KOMMENTARE = Array.from({ length: 40 }, (_, i) => `2026-10-${String(1 + (i % 28)).padStart(2, '0')} 09:00 · bot · Kommentar ${i + 1}: ein Satz, der die Zeile füllt und das Fenster länger macht als den Bildschirm`).join('\n');
const DATEIEN = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': `---\nid: 1\ntitle: Abnahme prüfen\nlabels: [ux]\n---\nBeschreibung der Abnahme\n\n\`\`\`kanbanD-comments\n${KOMMENTARE}\n\`\`\`\n`,
  'aufgaben/0002-board-aufraeumen.md': '---\nid: 2\ntitle: Board aufräumen\n---\n',
};
const ALS_BOT = { headers: { 'X-KanbanD-Wer': 'bot' } };
const BREIT = { width: 1400, height: 700 };
const SCHMAL = { width: 600, height: 700 };

/** Öffnet das Fenster von #1 als st in der gegebenen Fenstergröße. */
async function fensterOeffnen(page, k, groesse) {
  await page.setViewportSize(groesse);
  await alsPerson(page, 'st');
  await page.goto(k.adresse);
  await liveBereit(page);
  await page.locator('.ka[data-id="1"] .t').click();
  await expect(page.locator('.mod-kopf .id')).toHaveText('#1');
}

/** bot kommentiert über die API. */
async function kommentiert(page, k, nummer, text) {
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/${nummer}/kommentare`, { ...ALS_BOT, data: { text } });
  expect(antwort.ok()).toBe(true);
}

const renders = page => page.evaluate(() => window.kdTest.renders());

/** Wartet, bis nach `vorher` neu gezeichnet wurde und der Kommentar an #1 im Fenster steht. */
async function neuGezeichnetMit(page, vorher, text) {
  await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
  await expect(page.locator('.km p', { hasText: text })).toHaveCount(1);
}

/** Wartet nur auf ein neues Zeichnen (Ereignis an #2: im Fenster von #1 nichts zu sehen). */
async function neuGezeichnet(page, vorher) {
  await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
}

/** Wartet, bis gezeichnet wurde und der gezeichnete Stand `anzahl` Kommentare an `nummer` kennt — auch nach zwei Ereignissen kurz hintereinander. */
async function gezeichnetMitKommentaren(page, vorher, nummer, anzahl) {
  await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
  await expect.poll(() => page.evaluate(n => window.kdTest.gezeichnet() && window.kdTest.kommentare(n), nummer)).toBe(anzahl);
}

/** Fokus, Wert und Auswahl des aktiven Elements. */
const eingabe = page => page.evaluate(() => {
  const e = document.activeElement;
  return { feld: e.dataset.af || e.id, wert: e.value, von: e.selectionStart, bis: e.selectionEnd };
});
const commits = (k, betreff) => k.git('log', '--format=%an|%s').split('\n').filter(z => z.endsWith(betreff)).length;

/** Scrollstand gleich bis auf einen Pixel (Rundung bei gebrochenen Höhen). */
const nahe = (ist, soll) => expect(Math.abs(ist - soll), `Scrollstand ${ist} statt ${soll}`).toBeLessThanOrEqual(1);
const rollstand = (page, selektor) => page.locator(selektor).evaluate(e => e.scrollTop);
const rollen = (page, selektor, oben) => page.locator(selektor).evaluate((e, y) => { e.scrollTop = y; return e.scrollTop; }, oben);

test.describe('R00103 Leseposition', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  test('US-1: breit bleibt der Hauptbereich nach Kommentaren an #2 und #1 auf 400', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    let vorher = await renders(page);
    await kommentiert(page, k, 2, 'an zwei');
    await neuGezeichnet(page, vorher);
    nahe(await rollstand(page, '.mod-main'), 400);
    vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-main'), 400);
  });

  test('US-2: schmal bleibt der Fensterinhalt nach Kommentaren an #2 und #1 auf 400', async ({ page }) => {
    await fensterOeffnen(page, k, SCHMAL);
    expect(await rollen(page, '.mod-body', 400)).toBe(400);
    let vorher = await renders(page);
    await kommentiert(page, k, 2, 'an zwei');
    await neuGezeichnet(page, vorher);
    nahe(await rollstand(page, '.mod-body'), 400);
    vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-body'), 400);
  });

  test('zwei Ereignisse kurz hintereinander: Hauptbereich und Seitenleiste bleiben stehen', async ({ page }) => {
    await fensterOeffnen(page, k, { width: 1400, height: 420 });
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    const seite = await rollen(page, '.mod-side', 120);
    expect(seite, 'die Seitenleiste scrollt bei 420 px Höhe').toBeGreaterThan(0);
    const vorher = await renders(page);
    await Promise.all([kommentiert(page, k, 2, 'an zwei'), kommentiert(page, k, 1, 'an eins')]);
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-main'), 400);
    nahe(await rollstand(page, '.mod-side'), seite);
  });

  test('ganz unten bleibt der Hauptbereich, wo er war', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    const unten = await rollen(page, '.mod-main', 100000);
    expect(unten).toBeGreaterThan(400);
    const vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    nahe(await rollstand(page, '.mod-main'), unten);
  });

  test('Leerfall: ungescrollt bleibt der Hauptbereich oben', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    const vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await neuGezeichnetMit(page, vorher, 'an eins');
    expect(await rollstand(page, '.mod-main')).toBe(0);
  });

  test('US-5: Blättern zu #2 beginnt oben', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    await page.locator('.mod-kopf [data-act="blaettern"][data-arg="1"]').click();
    await expect(page.locator('.mod-kopf .id')).toHaveText('#2');
    expect(await rollstand(page, '.mod-main')).toBe(0);
  });
});

test.describe('R00103 Tippen', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  /** st kürzt den Titel von #1 auf „Abnahme prü“, der Cursor steht dahinter. */
  async function titelGekuerzt(page) {
    // R00116: das Titelfeld steht erst im Bearbeitungszustand — das Lesediv öffnet ihn
    await page.getByLabel('Titel bearbeiten', { exact: true }).click();
    const titel = page.getByLabel('Titel', { exact: true });
    await titel.click();
    await page.keyboard.press('End');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
    expect(await eingabe(page)).toEqual({ feld: 'titel', wert: 'Abnahme prü', von: 11, bis: 11 });
  }

  test('US-3: zwei Kommentare an #2 — der Titel behält Fokus, „Abnahme prü“ und den Cursor', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await titelGekuerzt(page);
    const vorher = await renders(page);
    await Promise.all([kommentiert(page, k, 2, 'erster'), kommentiert(page, k, 2, 'zweiter')]);
    await gezeichnetMitKommentaren(page, vorher, 2, 2);
    expect(await eingabe(page)).toEqual({ feld: 'titel', wert: 'Abnahme prü', von: 11, bis: 11 });
  });

  test('Auswahl: markiertes „prüfen“ bleibt markiert', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Titel bearbeiten', { exact: true }).click(); // R00116: Bearbeitungszustand öffnen
    await page.getByLabel('Titel', { exact: true }).click();
    await page.getByLabel('Titel', { exact: true }).evaluate(e => e.setSelectionRange(8, 14));
    const vorher = await renders(page);
    await kommentiert(page, k, 2, 'erster');
    await gezeichnetMitKommentaren(page, vorher, 2, 1);
    expect(await eingabe(page)).toEqual({ feld: 'titel', wert: 'Abnahme prüfen', von: 8, bis: 14 });
  });

  test('Labels: angefangenes „ux, bu“ bleibt mit Fokus und Cursor', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Labels').click();
    await page.keyboard.press('End');
    await page.keyboard.type(', bu');
    const vorher = await renders(page);
    await Promise.all([kommentiert(page, k, 2, 'erster'), kommentiert(page, k, 2, 'zweiter')]);
    await gezeichnetMitKommentaren(page, vorher, 2, 2);
    expect(await eingabe(page)).toEqual({ feld: 'labels', wert: 'ux, bu', von: 6, bis: 6 });
  });

  test('US-6: das Kommentarfeld behält Fokus und „noch offen“, von st kein Kommentar', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Neuer Kommentar').click();
    await page.keyboard.type('noch offen');
    const vorher = await renders(page);
    await Promise.all([kommentiert(page, k, 1, 'erster'), kommentiert(page, k, 1, 'zweiter')]);
    await gezeichnetMitKommentaren(page, vorher, 1, 42);
    expect(await eingabe(page)).toEqual({ feld: 'km-inp', wert: 'noch offen', von: 10, bis: 10 });
    expect(k.lies('aufgaben/0001-abnahme-pruefen.md')).not.toContain(' · st · ');
  });

  test('Fokus und Scrollstand: das Kommentarfeld behält den Fokus, ohne dass der Hauptbereich zu ihm springt', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Neuer Kommentar').click();
    await page.keyboard.type('noch offen');
    expect(await rollen(page, '.mod-main', 400)).toBe(400);
    const vorher = await renders(page);
    await kommentiert(page, k, 2, 'an zwei');
    await gezeichnetMitKommentaren(page, vorher, 2, 1);
    expect(await eingabe(page)).toEqual({ feld: 'km-inp', wert: 'noch offen', von: 10, bis: 10 });
    nahe(await rollstand(page, '.mod-main'), 400);
  });

  test('US-7 getippt: bot ändert den Titel — das Feld zeigt weiter „Abnahme prü“ mit Fokus und Cursor', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await titelGekuerzt(page);
    const vorher = await renders(page);
    const antwort = await page.request.patch(`${k.adresse}api/aufgaben/1`, { ...ALS_BOT, data: { titel: 'Abnahme durchführen' } });
    expect(antwort.ok()).toBe(true);
    await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
    await expect.poll(() => page.evaluate(() => window.kdTest.gezeichnet())).toBe(true);
    expect(await eingabe(page)).toEqual({ feld: 'titel', wert: 'Abnahme prü', von: 11, bis: 11 });
  });

  test('US-7 nicht getippt: bot ändert den Titel — das Feld zeigt „Abnahme durchführen“ und behält den Fokus', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Titel bearbeiten', { exact: true }).click(); // R00116: Bearbeitungszustand öffnen
    await page.getByLabel('Titel', { exact: true }).click();
    const vorher = await renders(page);
    const antwort = await page.request.patch(`${k.adresse}api/aufgaben/1`, { ...ALS_BOT, data: { titel: 'Abnahme durchführen' } });
    expect(antwort.ok()).toBe(true);
    await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('Abnahme durchführen');
    expect((await eingabe(page)).feld).toBe('titel');
    expect((await eingabe(page)).wert).toBe('Abnahme durchführen');
  });
});

test.describe('R00103 Fokus auf Knöpfen', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  const ZIELE = [
    '.mod-kopf [data-act="blaettern"][data-arg="1"]',
    '.mod-kopf [data-act="blaettern"][data-arg="-1"]',
    '.mod-kopf [data-act="schliessen"]',
    '.mod-kopf [data-act="archivieren"]',
    '.mod-main .besch-lesen',
  ];
  /** Wahr, wenn das aktive Element genau das eine Element zum Selektor ist. */
  const aktivIst = (page, selektor) => page.evaluate(sel => {
    const treffer = document.querySelectorAll(sel);
    return treffer.length === 1 && document.activeElement === treffer[0];
  }, selektor);
  /** Kurzbeschreibung des aktiven Elements für die Tab-Folge. */
  const aktivesElement = page => page.evaluate(() => {
    const e = document.activeElement;
    return [e.tagName, e.getAttribute('aria-label') || e.title || e.id || ''].join(' ');
  });
  /** Ein Kommentar von bot an #2, gewartet bis er gezeichnet ist. */
  async function fremdesEreignis(page) {
    const vorher = await renders(page);
    const schon = await page.evaluate(() => window.kdTest.kommentare(2));
    await kommentiert(page, k, 2, 'fremd');
    await gezeichnetMitKommentaren(page, vorher, 2, schon + 1);
  }

  for (const ziel of ZIELE) {
    test(`Fokus bleibt auf ${ziel}`, async ({ page }) => {
      await fensterOeffnen(page, k, BREIT);
      await page.locator(ziel).focus();
      expect(await aktivIst(page, ziel)).toBe(true);
      await fremdesEreignis(page);
      expect(await aktivIst(page, ziel), `aktiv ist ${await aktivesElement(page)}`).toBe(true);
    });
  }

  test('„nächste Karte“, Ereignis, Enter blättert zu #2', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.locator(ZIELE[0]).focus();
    await fremdesEreignis(page);
    await page.keyboard.press('Enter');
    await expect(page.locator('.mod-kopf .id')).toHaveText('#2');
  });

  test('Tab-Folge ab „vorige Karte“ ist mit Ereignissen dieselbe wie ohne', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.locator(ZIELE[1]).focus();
    const ohne = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); ohne.push(await aktivesElement(page)); }
    await page.locator(ZIELE[1]).focus();
    const mit = [];
    for (let i = 0; i < 4; i++) { await fremdesEreignis(page); await page.keyboard.press('Tab'); mit.push(await aktivesElement(page)); }
    expect(ohne.every(e => !e.startsWith('BODY')), ohne.join(' · ')).toBe(true);
    expect(mit).toEqual(ohne);
  });

  test('zwei Ereignisse kurz hintereinander: der Fokus bleibt auf „nächste Karte“', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.locator(ZIELE[0]).focus();
    const vorher = await renders(page);
    await Promise.all([kommentiert(page, k, 2, 'erster'), kommentiert(page, k, 2, 'zweiter')]);
    await gezeichnetMitKommentaren(page, vorher, 2, 2);
    expect(await aktivIst(page, ZIELE[0]), `aktiv ist ${await aktivesElement(page)}`).toBe(true);
  });
});

test.describe('R00103 Nur das Verlassen speichert', () => {
  let k;
  let speichern;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    // Speicheraufrufe des Browsers für #1 — die Anfragen des Tests über page.request zählen hier nicht mit
    speichern = [];
    page.on('request', r => { if (r.method() === 'PATCH' && r.url().endsWith('/api/aufgaben/1')) speichern.push(r.postDataJSON()); });
  });
  test.afterEach(() => k.stoppen());

  const TITEL = '#1 geändert: Titel';
  const titelImServer = async (page) => (await (await page.request.get(`${k.adresse}api/aufgaben/1`)).json()).titel;

  /** st kürzt den Titel von #1 auf „Abnahme prü“, der Cursor steht dahinter. */
  async function titelGekuerzt(page) {
    await page.getByLabel('Titel bearbeiten', { exact: true }).click(); // R00116: Bearbeitungszustand öffnen
    await page.getByLabel('Titel', { exact: true }).click();
    await page.keyboard.press('End');
    for (let i = 0; i < 3; i++) await page.keyboard.press('Backspace');
  }

  /** Zwei Kommentare von bot an #2 kurz hintereinander, gewartet bis beide gezeichnet sind. */
  async function zweiFremdeEreignisse(page) {
    const vorher = await renders(page);
    const schon = await page.evaluate(() => window.kdTest.kommentare(2));
    await Promise.all([kommentiert(page, k, 2, 'erster'), kommentiert(page, k, 2, 'zweiter')]);
    await gezeichnetMitKommentaren(page, vorher, 2, schon + 2);
  }

  test('US-3 Negativbeweis: zwei fremde Ereignisse speichern den halben Titel nicht', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await titelGekuerzt(page);
    expect(commits(k, TITEL)).toBe(0);
    await zweiFremdeEreignisse(page);
    expect(commits(k, TITEL)).toBe(0);
    expect(speichern).toEqual([]);
    expect(await titelImServer(page)).toBe('Abnahme prüfen');
    expect(await eingabe(page)).toEqual({ feld: 'titel', wert: 'Abnahme prü', von: 11, bis: 11 });
  });

  test('US-4: Weitertippen und Verlassen speichern genau einmal', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await titelGekuerzt(page);
    await zweiFremdeEreignisse(page);
    await page.keyboard.type('fen lassen');
    await page.keyboard.press('Tab');
    await expect.poll(() => titelImServer(page)).toBe('Abnahme prüfen lassen');
    await zweiFremdeEreignisse(page);
    await expect.poll(() => commits(k, TITEL)).toBe(1);
    expect(speichern).toEqual([{ titel: 'Abnahme prüfen lassen' }]);
  });

  test('nach dem Zurücksetzen speichert Verlassen ohne Weitertippen den getippten Wert genau einmal', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await titelGekuerzt(page);
    await zweiFremdeEreignisse(page);
    await page.keyboard.press('Tab');
    await expect.poll(() => titelImServer(page)).toBe('Abnahme prü');
    await zweiFremdeEreignisse(page);
    await expect.poll(() => commits(k, TITEL)).toBe(1);
    expect(speichern).toEqual([{ titel: 'Abnahme prü' }]);
  });

  test('Leerfall: Fokus im unveränderten Titel, Ereignisse, Verlassen — kein Commit', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Titel bearbeiten', { exact: true }).click(); // R00116: Bearbeitungszustand öffnen
    await page.getByLabel('Titel', { exact: true }).click();
    await zweiFremdeEreignisse(page);
    await page.keyboard.press('Tab');
    await zweiFremdeEreignisse(page);
    expect(speichern).toEqual([]);
    expect(commits(k, TITEL)).toBe(0);
  });

  test('US-7 getippt: der Commit von bot steht vor genau einem Commit von st', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await titelGekuerzt(page);
    const vorher = await renders(page);
    expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { ...ALS_BOT, data: { titel: 'Abnahme durchführen' } })).ok()).toBe(true);
    await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('Abnahme durchführen');
    expect(await eingabe(page)).toEqual({ feld: 'titel', wert: 'Abnahme prü', von: 11, bis: 11 });
    await page.keyboard.type('fen lassen');
    await page.keyboard.press('Tab');
    await expect.poll(() => titelImServer(page)).toBe('Abnahme prüfen lassen');
    // Die Datei steht vor dem Commit — auf den Commit warten, dann die Geschichte prüfen
    await expect.poll(() => commits(k, TITEL)).toBe(2);
    await zweiFremdeEreignisse(page);
    const titelCommits = k.git('log', '--format=%an|%s').split('\n').filter(z => z.endsWith(TITEL));
    expect(titelCommits).toEqual(['Stefan|' + TITEL, 'Bot|' + TITEL]);
  });

  test('US-7 nicht getippt: das Feld zeigt den fremden Titel, Verlassen speichert nichts', async ({ page }) => {
    await fensterOeffnen(page, k, BREIT);
    await page.getByLabel('Titel bearbeiten', { exact: true }).click(); // R00116: Bearbeitungszustand öffnen
    await page.getByLabel('Titel', { exact: true }).click();
    const vorher = await renders(page);
    expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { ...ALS_BOT, data: { titel: 'Abnahme durchführen' } })).ok()).toBe(true);
    await expect.poll(() => renders(page)).toBeGreaterThan(vorher);
    await expect(page.getByLabel('Titel', { exact: true })).toHaveValue('Abnahme durchführen');
    await page.keyboard.press('Tab');
    await zweiFremdeEreignisse(page);
    expect(speichern).toEqual([]);
    expect(k.git('log', '--format=%an|%s').split('\n').filter(z => z.endsWith(TITEL))).toEqual(['Bot|' + TITEL]);
    expect(await titelImServer(page)).toBe('Abnahme durchführen');
  });
});

test.describe('R00103 Felder außerhalb des Fensters', () => {
  let k;
  test.beforeEach(async () => { k = await kanbanStarten(einrichten(DATEIEN)); });
  test.afterEach(() => k.stoppen());

  const FIEBER = 'Fever Chart von „Entwicklung“ eingestellt';
  const fieberCommitsVonSt = () => k.git('log', '--format=%an|%s').split('\n').filter(z => z.startsWith('Stefan|' + FIEBER)).length;

  test('Fieber: „1“ in „Puffer in Tagen“ übersteht einen Kommentar an #1, Verlassen speichert genau einmal', async ({ page }) => {
    await page.setViewportSize(BREIT);
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /Projekt-Fever-Chart/ }).click();
    const puffer = page.getByLabel('Puffer in Tagen');
    await puffer.click();
    await page.keyboard.type('1');
    const vorher = await renders(page);
    await kommentiert(page, k, 1, 'an eins');
    await gezeichnetMitKommentaren(page, vorher, 1, 41);
    expect(await page.evaluate(() => ({ feld: document.activeElement.dataset.fb, wert: document.activeElement.value }))).toEqual({ feld: 'puffer', wert: '1' });
    expect(fieberCommitsVonSt()).toBe(0);
    await page.keyboard.press('Tab');
    await expect.poll(fieberCommitsVonSt).toBe(1);
    const nachher = await renders(page);
    await kommentiert(page, k, 1, 'noch eins');
    await gezeichnetMitKommentaren(page, nachher, 1, 42);
    expect(fieberCommitsVonSt()).toBe(1);
  });
});
