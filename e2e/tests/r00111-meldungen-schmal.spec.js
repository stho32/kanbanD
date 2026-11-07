// R00111 Meldungen und Knöpfe der Fenster auf schmalen Bildschirmen (Karte #74, ADR-0015, ADR-0016)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

const HANDY = { viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1280, height: 800 } };

const AUFGABE_1 = 'aufgaben/0001-abnahme-pruefen.md';
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-abnahme-pruefen.md)\n\n## In Arbeit\n\n## Erledigt\n';
const AUSGANGSLAGE = { 'boards/entwicklung.md': BOARD, [AUFGABE_1]: '---\nid: 1\ntitle: Abnahme prüfen\n---\n' };

const MELDUNG_X1 = '\u201eX1\u201c ist keine Herkunft';
/** Höhe des Fußes am Desktop mit der Meldung aus US-1, gemessen vor dem Fix (ADR-0015 N1: 28 px, einzeilig). */
const FUSS_HOEHE_VOR_DEM_FIX = 28;

let k;
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

  // Erwartet rot bis B0449: die Meldung hat Client-Rects, aber .mod-fuss schneidet sie mit nowrap/overflow ab (#74, ADR-0015 N1)
  test.fail('US-1: abgelehnte Herkunft X1 wird bei 414 px als alert gemeldet, Fokus bleibt im Feld (#74)', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    await herkunftEingeben(page, fenster, 'X1', true);
    const meldung = fenster.locator('[role=alert]');
    await expect(meldung).toHaveCount(1);
    await expect(meldung).toHaveText(new RegExp('^' + MELDUNG_X1));
    expect(await sichtbarkeit(meldung)).toEqual([]);
    expect(await alertImSnapshot(fenster, MELDUNG_X1)).toHaveLength(1);
    expect(await page.evaluate(() => [document.activeElement.id, document.activeElement.value])).toEqual(['herkunft-neu', 'X1']);
    expect(k.lies(AUFGABE_1)).not.toContain('X1');
    expect(await sichtbarkeit(fenster.locator('.mod-fuss span', { hasText: 'Karte wechseln' })), 'Tastenhinweise schmal nicht gezeichnet').toEqual(['keine Client-Rects']);
  });

  test('US-2: „gespeichert“ mit der Uhrzeit der Änderung ist bei 414 px sichtbar', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, true);
    const titel = fenster.getByLabel('Titel', { exact: true });
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
});

test.describe('Desktop, 1280 px mit Maus', () => {
  test.use(DESKTOP);

  test('US-3: Meldung im einzeiligen Fuß neben den Tastenhinweisen, Fokus bleibt im Feld', async ({ page }) => {
    await starten(page);
    const fenster = await fensterOeffnen(page, 1, false);
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
    await expect(tastenhinweis).toContainText('Karte wechseln');
    expect(await sichtbarkeit(tastenhinweis)).toEqual([]);
  });
});
