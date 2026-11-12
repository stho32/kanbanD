// R00111 Meldungen und Knöpfe der Fenster auf schmalen Bildschirmen (Karte #74, ADR-0015, ADR-0016)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, mutanteEinsetzen, reiter } = require('./hilfen');

const HANDY = { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 } };

const AUFGABE_1 = 'aufgaben/0001-abnahme-pruefen.md';
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n\n## In Arbeit\n\n## Erledigt\n';
const AUSGANGSLAGE = { 'boards/entwicklung.md': BOARD, [AUFGABE_1]: '---\nid: 1\ntitle: Abnahme prüfen\n---\n' };

const MELDUNG_X1 = '\u201eX1\u201c ist keine Herkunft';
/** Eine Herkunft, deren Meldung breiter ist als der Fuß bei 1280 px (ADR-0015 N1: heute endet sie bei 2195 px, der Fuß bei 1180 px). */
const LANGE_HERKUNFT = 'Herkunft aus dem Gespräch mit dem Auftraggeber am Montagmorgen über die Abnahme der Fenster auf schmalen Bildschirmen, über die Meldungen darin und über die Knöpfe, die nicht abgeschnitten werden dürfen';
/** Höhe des Fußes am Desktop mit der Meldung aus US-1, gemessen vor dem Fix (ADR-0015 N1: 28 px, einzeilig). */
const FUSS_HOEHE_VOR_DEM_FIX = 28;

const MELDUNG_TITEL = 'Die Aufgabe braucht einen Titel';
const BOARD_DATEI = 'boards/entwicklung.md';
/** Handy hoch, quer und Tablet: die Breiten, bei denen „Anlegen“ vor dem Fix fehlte, und die schmalen (AK 7). */
const ZWISCHENBREITEN = [{ width: 641, height: 896 }, { width: 768, height: 1024 }, { width: 844, height: 390 }];
const SCHMALE_BREITEN = [320, 375, 414].map(width => ({ width, height: 896 }));

let k;
test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

async function starten(page, dateien = AUSGANGSLAGE) {
  k = await kanbanStarten(einrichten(dateien));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="1"]')).toHaveCount(1);
}

/** Öffnet das Aufgabenfenster einer Karte wie der Mensch am Gerät: Tipp bei Touch, Klick mit der Maus. */
async function fensterOeffnen(page, nummer, touch) {
  const titel = page.locator(`.ka[data-id="${nummer}"] .t`);
  if (touch) await titel.tap(); else await titel.click();
  const fenster = page.getByRole('dialog', { name: `Aufgabe #${nummer}` });
  await expect(fenster).toBeVisible();
  return fenster;
}

/** Trägt im Feld „Neue Herkunft“ einen Wert ein und schickt ihn mit der Eingabetaste ab (Bildschirmtastatur bzw. Enter). */
async function herkunftEingeben(page, fenster, wert, touch) {
  const feld = fenster.getByLabel('Neue Herkunft');
  if (touch) await feld.tap(); else await feld.click();
  await page.keyboard.type(wert);
  await page.keyboard.press('Enter');
}

/** Öffnet „Neue Aufgabe“ über das „+“ der Spalte „Zu erledigen“, wie der Mensch am Handy. */
async function neueAufgabeOeffnen(page) {
  await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).tap();
  const fenster = page.getByRole('dialog', { name: 'Neue Aufgabe' });
  await expect(fenster).toBeVisible();
  return fenster;
}

/** Die Knöpfe im Fuß von „Neue Aufgabe“ in der Reihenfolge des Desktops. */
function fussKnoepfe(fenster) {
  return ['Abbrechen', 'Anlegen und weitere', 'Anlegen'].map(name => fenster.getByRole('button', { name, exact: true }));
}

/** Karten der Spalte „Zu erledigen“ in der Board-Datei, je als Link-Zeile. */
function zuErledigen() {
  return k.lies(BOARD_DATEI).split('## In Arbeit')[0].split('\n').filter(z => z.startsWith('- ['));
}

/**
 * Sichtbar im Sinne von R00111: Client-Rects vorhanden, das Rechteck liegt ganz im Fenster (`[role=dialog]`) und in
 * jedem Vorfahren, dessen `overflow` nicht `visible` ist. Liefert die Liste der Gründe, warum nicht — leer heißt sichtbar.
 */
function sichtbarkeit(locator) {
  return locator.evaluate(element => {
    const gruende = [];
    if (element.getClientRects().length === 0) return ['keine Client-Rects'];
    const r = element.getBoundingClientRect();
    const liegtIn = (aussen, name) => {
      const a = aussen.getBoundingClientRect();
      if (r.left < a.left - 0.5 || r.top < a.top - 0.5 || r.right > a.right + 0.5 || r.bottom > a.bottom + 0.5)
        gruende.push(`ragt aus ${name} (${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)} gegen ${Math.round(a.left)},${Math.round(a.top)}–${Math.round(a.right)},${Math.round(a.bottom)})`);
    };
    for (let v = element.parentElement; v && v !== document.documentElement; v = v.parentElement) {
      const stil = getComputedStyle(v);
      if (stil.overflowX !== 'visible' || stil.overflowY !== 'visible') liegtIn(v, `${v.tagName.toLowerCase()}.${[...v.classList].join('.')}`);
      if (v.getAttribute('role') === 'dialog') { liegtIn(v, 'dem Fenster'); break; }
    }
    return gruende;
  });
}

/** Waagrechtes Scrollen an Dokument und Fenster und ob die Meldung ganz lesbar ist: je `[scrollWidth, clientWidth]`. */
function breiten(page, fenster, meldung) {
  return Promise.all([
    page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]),
    fenster.evaluate(f => [f.scrollWidth, f.clientWidth]),
    meldung.evaluate(m => [m.scrollWidth, m.clientWidth]),
  ]);
}

/** Liegt das Rechteck der Meldung ganz im Rechteck des Fußes? */
function imFuss(meldung) {
  return meldung.evaluate(m => {
    const r = m.getBoundingClientRect(), f = m.closest('.mod-fuss').getBoundingClientRect();
    return r.left >= f.left - 0.5 && r.right <= f.right + 0.5 && r.top >= f.top - 0.5 && r.bottom <= f.bottom + 0.5;
  });
}

/** Zeile des Accessibility-Snapshots, die eine Meldung als `alert` mit dem erwarteten Text führt. */
async function alertImSnapshot(fenster, text) {
  const snapshot = await fenster.ariaSnapshot();
  return snapshot.split('\n').filter(zeile => zeile.includes('alert') && zeile.includes(text));
}

/** Sekunden des Tages in Europe/Berlin (Zeitzone des Browsers, playwright.config.js). */
function sekundenInBerlin(zeitpunkt) {
  const [h, m, s] = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(zeitpunkt).split(':').map(Number);
  return h * 3600 + m * 60 + s;
}

test.describe('Handy, 414 px mit Touch', () => {
  test.use(HANDY);

  test('US-1: abgelehnte Herkunft X1 wird bei 414 px als alert gemeldet, Fokus bleibt im Feld (#74)', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    await reiter(page, 'Details');
    await herkunftEingeben(page, fenster, 'X1', true);
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toHaveCount(1);
    await expect(meldung).toHaveText(new RegExp('^' + MELDUNG_X1));
    expect(await sichtbarkeit(meldung)).toEqual([]);
    expect(await alertImSnapshot(fenster, MELDUNG_X1)).toHaveLength(1);
    expect(await page.evaluate(() => [document.activeElement.id, document.activeElement.value])).toEqual(['herkunft-neu', 'X1']);
    expect(k.lies(AUFGABE_1)).not.toContain('X1');
    expect(await sichtbarkeit(fenster.locator('.mod-fuss span', { hasText: 'schließen' })), 'Tastenhinweise schmal nicht gezeichnet').toEqual(['keine Client-Rects']);

    const feld = fenster.getByLabel('Neue Herkunft');
    const id = await meldung.getAttribute('id');
    expect(id, 'die Meldung hat eine id').toBeTruthy();
    await expect(feld).toHaveAttribute('aria-invalid', 'true');
    await expect(feld).toHaveAttribute('aria-describedby', id);
    await expect(feld, 'der Verweis führt zur Meldung').toHaveAccessibleDescription(new RegExp('^' + MELDUNG_X1));

    await feld.fill('');
    await herkunftEingeben(page, fenster, 'I0001', true);
    await expect.poll(() => k.lies(AUFGABE_1)).toContain('I0001');
    await expect(meldung).toHaveCount(0);
    await expect(feld).not.toHaveAttribute('aria-invalid');
    await expect(feld).not.toHaveAttribute('aria-describedby');
  });

  test('US-2: „gespeichert“ mit der Uhrzeit der Änderung ist bei 414 px sichtbar', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    const titel = fenster.getByLabel('Titel', { exact: true });
    await fenster.getByLabel('Titel bearbeiten', { exact: true }).tap(); // R00116: Bearbeitungszustand öffnen
    await titel.tap();
    await titel.fill('Abnahme prüfen lassen');
    const vorher = new Date();
    await titel.blur();
    await expect.poll(() => k.lies(AUFGABE_1)).toContain('title: Abnahme prüfen lassen');
    const gespeichert = fenster.locator('.mod-fuss .gs');
    await expect(gespeichert).toHaveText(/^gespeichert \d\d:\d\d:\d\d$/);
    const nachher = new Date();
    const uhr = (await gespeichert.textContent()).slice('gespeichert '.length).split(':').map(Number);
    const sekunden = uhr[0] * 3600 + uhr[1] * 60 + uhr[2];
    expect(sekunden).toBeGreaterThanOrEqual(sekundenInBerlin(vorher) - 1);
    expect(sekunden).toBeLessThanOrEqual(sekundenInBerlin(nachher) + 1);
    expect(await sichtbarkeit(gespeichert)).toEqual([]);
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('Abnahme prüfen lassen');
  });

  // Das Feld „Neue Herkunft“ verweist nur auf eine Meldung, die es selbst betrifft; eine andere Meldung im Fuß
  // macht es nicht ungültig, auch wenn darin ein Entwurf steht.
  test('US-1: ein abgelehnter Titel macht „Neue Herkunft“ mit Entwurf nicht ungültig', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    await reiter(page, 'Details');
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.tap();
    await page.keyboard.type('I00');
    const titel = fenster.getByLabel('Titel', { exact: true });
    await reiter(page, 'Inhalt');
    await fenster.getByLabel('Titel bearbeiten', { exact: true }).tap(); // R00116: Bearbeitungszustand öffnen
    await titel.tap();
    await titel.fill('');
    await titel.blur();
    await expect(fenster.locator('[role=alert]')).toHaveCount(1);
    expect(k.lies(AUFGABE_1), 'der Titel wurde abgelehnt').toContain('title: Abnahme prüfen');
    await reiter(page, 'Details');
    await expect(herkunft).toHaveValue('I00');
    await expect(herkunft).not.toHaveAttribute('aria-invalid');
    await expect(herkunft).not.toHaveAttribute('aria-describedby');
  });

  test('US-1: eine abgelehnte Dauer macht „Neue Herkunft“ nach X1 nicht mehr ungültig', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    await reiter(page, 'Details');
    await herkunftEingeben(page, fenster, 'X1', true);
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toHaveText(new RegExp('^' + MELDUNG_X1));
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await herkunft.fill('I0001');
    await reiter(page, 'Zeiten');
    const dauer = fenster.getByLabel('Zeit nachtragen');
    await dauer.tap();
    await page.keyboard.type('abc');
    await page.keyboard.press('Enter');
    await expect(meldung).toHaveCount(1);
    await expect(meldung).not.toHaveText(new RegExp('^' + MELDUNG_X1));
    await reiter(page, 'Details');
    await expect(herkunft).toHaveValue('I0001');
    await expect(herkunft).not.toHaveAttribute('aria-invalid');
    await expect(herkunft).not.toHaveAttribute('aria-describedby');
  });

  test('US-1: die abgelehnte Herkunft X1 behält ihren Verweis auf die Meldung', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    await reiter(page, 'Details');
    await herkunftEingeben(page, fenster, 'X1', true);
    await expect(fenster.locator('[role=alert]')).toHaveText(new RegExp('^' + MELDUNG_X1));
    const herkunft = fenster.getByLabel('Neue Herkunft');
    await expect(herkunft).toHaveAttribute('aria-invalid', 'true');
    await expect(herkunft).toHaveAttribute('aria-describedby', 'fenster-meldung');
  });
});

for (const breite of [320, 375, 414]) {
  test.describe(`Handy, ${breite} px mit Touch`, () => {
    test.use({ viewport: { width: breite, height: 896 }, isMobile: true, hasTouch: true });

    test(`AK 4: die Meldung aus US-1 bricht bei ${breite} px um, ist ganz lesbar, nichts scrollt quer`, async ({ page }) => {
      await starten(page);
      const fenster = await fensterOeffnen(page, 1, true);
      await reiter(page, 'Details');
      await herkunftEingeben(page, fenster, 'X1', true);
      const meldung = fenster.locator('[role=alert]');
      await expect(meldung).toHaveText(new RegExp('^' + MELDUNG_X1));
      expect(await sichtbarkeit(meldung)).toEqual([]);
      const [dokument, imFenster, inMeldung] = await breiten(page, fenster, meldung);
      expect(dokument[0], 'Seite scrollt nicht quer').toBeLessThanOrEqual(dokument[1]);
      expect(dokument[0], 'Seite höchstens so breit wie der Bildschirm').toBeLessThanOrEqual(breite);
      expect(imFenster[0], 'Fenster scrollt nicht quer').toBeLessThanOrEqual(imFenster[1]);
      expect(inMeldung[0], 'Meldung nicht abgeschnitten').toBeLessThanOrEqual(inMeldung[1]);
      expect(await sichtbarkeit(fenster.locator('.mod-fuss span', { hasText: 'schließen' }))).toEqual(['keine Client-Rects']);
    });
  });
}

test.describe('„Neue Aufgabe“, 414 px mit Touch', () => {
  test.use(HANDY);

  test('US-4: Tipp auf „Anlegen“ mit leerem Titel wird gemeldet, Fokus im Titel, keine neue Aufgabe', async ({ page }) => {
    await starten(page);
    const fenster = await neueAufgabeOeffnen(page);
    await fenster.getByRole('button', { name: 'Anlegen', exact: true }).tap();
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toHaveText(MELDUNG_TITEL);
    expect(await sichtbarkeit(meldung)).toEqual([]);
    expect(await alertImSnapshot(fenster, MELDUNG_TITEL)).toHaveLength(1);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('neu-titel');
    expect(k.lies(BOARD_DATEI)).toBe(BOARD);

    const titel = page.getByLabel('Titel der neuen Aufgabe');
    const id = await meldung.getAttribute('id');
    expect(id, 'die Meldung hat eine id').toBeTruthy();
    await expect(titel).toHaveAttribute('aria-invalid', 'true');
    await expect(titel).toHaveAttribute('aria-describedby', id);
    await expect(titel, 'der Verweis führt zur Meldung').toHaveAccessibleDescription(MELDUNG_TITEL);

    // „Anlegen und weitere“ lässt den Titel stehen: so ist beobachtbar, dass der Verweis mit der angenommenen Eingabe wegfällt
    await titel.fill('Handy-Aufgabe');
    await fenster.getByRole('button', { name: 'Anlegen und weitere', exact: true }).tap();
    await expect.poll(zuErledigen).toHaveLength(2);
    await expect(meldung).toHaveCount(0);
    await expect(titel).not.toHaveAttribute('aria-invalid');
    await expect(titel).not.toHaveAttribute('aria-describedby');
  });

  test('US-5: Titel „Handy-Aufgabe“ und Tipp auf „Anlegen“ legt in „Zu erledigen“ an und schließt', async ({ page }) => {
    await starten(page);
    const fenster = await neueAufgabeOeffnen(page);
    for (const knopf of fussKnoepfe(fenster)) expect(await sichtbarkeit(knopf)).toEqual([]);
    await page.getByLabel('Titel der neuen Aufgabe').fill('Handy-Aufgabe');
    await fenster.getByRole('button', { name: 'Anlegen', exact: true }).tap();
    await expect(fenster).toHaveCount(0);
    await expect.poll(zuErledigen).toHaveLength(2);
    expect(zuErledigen()[1]).toContain('handy-aufgabe');
  });

  test('US-6: „Anlegen und weitere“ legt an und lässt das Fenster mit leerem Titel offen', async ({ page }) => {
    await starten(page);
    const fenster = await neueAufgabeOeffnen(page);
    await page.getByLabel('Titel der neuen Aufgabe').fill('Zweite');
    await fenster.getByRole('button', { name: 'Anlegen und weitere', exact: true }).tap();
    await expect.poll(zuErledigen).toHaveLength(2);
    expect(zuErledigen()[1]).toContain('zweite');
    await expect(fenster).toBeVisible();
    await expect(page.getByLabel('Titel der neuen Aufgabe')).toHaveValue('');
  });

  test('US-7: Tipp auf „Abbrechen“ schließt ohne neue Aufgabe', async ({ page }) => {
    await starten(page);
    const fenster = await neueAufgabeOeffnen(page);
    await page.getByLabel('Titel der neuen Aufgabe').fill('Verworfen');
    await fenster.getByRole('button', { name: 'Abbrechen', exact: true }).tap();
    await expect(fenster).toHaveCount(0);
    expect(k.lies(BOARD_DATEI)).toBe(BOARD);
    await expect(page.locator('.ka', { hasText: 'Verworfen' })).toHaveCount(0);
  });
});

/** AK 7 und US-5 Gegeben: die drei Knöpfe ganz im Fenster, Touch-Zielmaß, „Anlegen“ zuletzt und rechtsbündig, nichts scrollt quer. */
async function knoepfeUndBreitePruefen(page, fenster, breite, zustand) {
  const kaesten = [];
  for (const knopf of fussKnoepfe(fenster)) {
    expect(await sichtbarkeit(knopf), zustand).toEqual([]);
    const kasten = await knopf.boundingBox();
    expect(kasten.width, `${zustand}: Knopf mindestens 44 breit`).toBeGreaterThanOrEqual(44);
    expect(kasten.height, `${zustand}: Knopf mindestens 44 hoch`).toBeGreaterThanOrEqual(44);
    kaesten.push(kasten);
  }
  const [, weitere, anlegen] = kaesten;
  const nachWeitere = anlegen.y > weitere.y + weitere.height - 1 || (Math.abs(anlegen.y - weitere.y) < 1 && anlegen.x > weitere.x);
  expect(nachWeitere, `${zustand}: „Anlegen“ steht hinter „Anlegen und weitere“`).toBe(true);
  const rechts = Math.max(...kaesten.map(b => b.x + b.width));
  expect(Math.abs(anlegen.x + anlegen.width - rechts), `${zustand}: „Anlegen“ rechtsbündig zur Gruppe`).toBeLessThanOrEqual(1);
  const [dokument, imFenster] = await Promise.all([
    page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]),
    fenster.evaluate(f => [f.scrollWidth, f.clientWidth]),
  ]);
  expect(dokument[0], `${zustand}: Seite scrollt nicht quer`).toBeLessThanOrEqual(dokument[1]);
  expect(dokument[0], `${zustand}: Seite höchstens so breit wie der Bildschirm`).toBeLessThanOrEqual(breite);
  expect(imFenster[0], `${zustand}: Fenster scrollt nicht quer`).toBeLessThanOrEqual(imFenster[1]);
}

for (const viewport of [...SCHMALE_BREITEN, ...ZWISCHENBREITEN]) {
  test.describe(`„Neue Aufgabe“, ${viewport.width} × ${viewport.height} mit Touch`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    test(`AK 7: bei ${viewport.width} px ist jeder Knopf ganz da, ≥ 44 × 44, „Anlegen“ zuletzt, nichts scrollt quer — beim Öffnen und mit der Meldung aus US-4`, async ({ page }) => {
      await starten(page);
      const fenster = await neueAufgabeOeffnen(page);
      await knoepfeUndBreitePruefen(page, fenster, viewport.width, 'beim Öffnen');
      await fenster.getByRole('button', { name: 'Anlegen', exact: true }).tap();
      await expect(fenster.locator('[role=alert]')).toHaveText(MELDUNG_TITEL);
      await knoepfeUndBreitePruefen(page, fenster, viewport.width, 'mit Meldung');
    });
  });
}

test.describe('Desktop, 1280 px mit Maus', () => {
  test.use(DESKTOP);

  test('US-3: Meldung im einzeiligen Fuß neben den Tastenhinweisen, Fokus bleibt im Feld', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, false);
    await reiter(page, 'Details');
    await herkunftEingeben(page, fenster, 'X1', false);
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toHaveCount(1);
    await expect(meldung).toHaveText(new RegExp('^' + MELDUNG_X1));
    expect(await sichtbarkeit(meldung)).toEqual([]);
    expect(await alertImSnapshot(fenster, MELDUNG_X1)).toHaveLength(1);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('herkunft-neu');
    const fuss = fenster.locator('.mod-fuss');
    expect((await fuss.boundingBox()).height).toBe(FUSS_HOEHE_VOR_DEM_FIX);
    const mitten = await fuss.evaluate(f => [...f.children].map(kind => { const r = kind.getBoundingClientRect(); return r.top + r.height / 2; }));
    expect(Math.max(...mitten) - Math.min(...mitten), 'alle Teile des Fußes in einer Zeile').toBeLessThanOrEqual(2);
    const tastenhinweis = fuss.locator('span', { hasText: 'schließen' });
    await expect(tastenhinweis).toContainText('schließen');
    expect(await sichtbarkeit(tastenhinweis)).toEqual([]);
  });

  test('AK 3: eine Meldung, breiter als der Fuß, bricht im Fuß um und ist ganz lesbar (#84)', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, false);
    await reiter(page, 'Details');
    await herkunftEingeben(page, fenster, LANGE_HERKUNFT, false);
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toContainText('ist keine Herkunft');
    await expect(meldung).toContainText('oder thin air');
    expect(await sichtbarkeit(meldung)).toEqual([]);
    expect(await imFuss(meldung), 'Rechteck der Meldung im Rechteck von .mod-fuss').toBe(true);
    const [, , inMeldung] = await breiten(page, fenster, meldung);
    expect(inMeldung[0], 'Meldung nicht abgeschnitten').toBeLessThanOrEqual(inMeldung[1]);
    expect((await meldung.boundingBox()).height, 'die Meldung bricht um').toBeGreaterThan(20);
  });
});
