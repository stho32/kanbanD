// R00077 Responsive für Tablet und Handy
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0002', 'Dialog', 'A0001', 'Board mit einem recht langen Namen für die Tabelle', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0014', 'Interaction', 'D0002', 'Ziehen', 'rot', { fertig: 'US-1', notiz: 'eine lange Notiz, damit die Tabelle breiter wird als ein Handy' }),
]);
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-a1.md)\n- [#2](../aufgaben/0002-a2.md)\n\n## In Arbeit\n\n- [#3](../aufgaben/0003-a3.md)\n\n## Erledigt\n';
const AUFGABEN = Object.fromEntries([1, 2, 3].map(n => [`aufgaben/000${n}-a${n}.md`, `---\nid: ${n}\ntitle: Aufgabe ${n} mit einem Titel, der umbrechen muss\nlabels: [ui]\n---\n\nBeschreibung ${n}\n`]));

let k, arbeit;
const starten = async page => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(mitRegister(arbeit, { 'boards/entwicklung.md': BOARD, ...AUFGABEN }));
  await alsPerson(page, 'st');
  await page.goto(k.adresse);
  await expect(page.locator('.ka')).toHaveCount(3);
};
test.afterEach(async () => { await k.stoppen(); arbeit.aufraeumen(); });
const seitenbreite = page => page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
const box = loc => loc.boundingBox();

test.describe('Handy', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('US-1: keine Seite ist breiter als der Bildschirm; Spalten fast bildschirmbreit mit Einrasten; Navigation erreicht jede Seite', async ({ page }) => {
    await starten(page);
    expect(await seitenbreite(page)).toEqual([390, 390]);
    const spalte = await box(page.locator('.bahn').first());
    expect(spalte.width).toBeGreaterThan(330);
    expect(spalte.width).toBeLessThanOrEqual(390);
    expect(await page.locator('.bahnen').evaluate(e => getComputedStyle(e).scrollSnapType)).toContain('x');
    await page.locator('.kz-nav a', { hasText: 'Einrichten' }).click();
    await expect(page).toHaveURL(/#\/einrichten$/);
    for (const ziel of ['#/einrichten', '#/aufgaben', '#/berichte/prognose', '#/berichte/verlauf', '#/wbs/kd']) {
      await page.goto(k.adresse + ziel);
      await page.waitForTimeout(300);
      expect(await seitenbreite(page), ziel).toEqual([390, 390]);
    }
    const tabelle = page.locator('.wbs-tabelle');
    expect(await tabelle.evaluate(e => e.scrollWidth > e.clientWidth), 'die WBS-Tabelle scrollt in sich').toBe(true);
  });

  test('US-2: das Aufgabenfenster füllt den Bildschirm, Felder unter dem Text, Verschieben über „Spalte“', async ({ page }) => {
    await starten(page);
    await page.locator('.ka[data-id="1"] .t').tap();
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
    const f = await box(fenster);
    expect([f.x, f.y, f.width, f.height]).toEqual([0, 0, 390, 844]);
    const [haupt, seite] = await Promise.all([box(fenster.locator('.mod-main')), box(fenster.locator('.mod-side'))]);
    expect(seite.y).toBeGreaterThanOrEqual(haupt.y + haupt.height - 1);
    expect(seite.width).toBeGreaterThan(350);
    await fenster.locator('select[data-af="spalte"]').selectOption('In Arbeit');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toContain('## In Arbeit\n\n- [#3](../aufgaben/0003-a3.md)\n- [#1]');
  });

  test('Touch: Symbolknöpfe haben mindestens 32 px Tippfläche; der Personenknopf zeigt nur das Kürzel', async ({ page }) => {
    await starten(page);
    for (const sel of ['.kopf-plus', '.bk-name', '#t-thema']) {
      const b = await box(page.locator(sel).first());
      expect(Math.min(b.width, b.height), sel).toBeGreaterThanOrEqual(32);
    }
    await expect(page.locator('#t-ich .ich-name')).toBeHidden();
  });
});

test.describe('Tablet', () => {
  test.use({ viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true });

  test('US-3: die Kopfzeile bricht um, Filter und Personenknopf überlappen nicht; das Fenster füllt den Bildschirm', async ({ page }) => {
    await starten(page);
    expect(await seitenbreite(page)).toEqual([820, 820]);
    const [filter, ich] = await Promise.all([box(page.getByLabel('Filter')), box(page.locator('#t-ich'))]);
    const ueberlappt = filter.x < ich.x + ich.width && ich.x < filter.x + filter.width && filter.y < ich.y + ich.height && ich.y < filter.y + filter.height;
    expect(ueberlappt).toBe(false);
    expect(filter.y).toBeGreaterThan(ich.y + 10);
    await page.locator('.ka[data-id="1"] .t').tap();
    const f = await box(page.getByRole('dialog', { name: 'Aufgabe #1' }));
    expect([f.width, f.height]).toEqual([820, 1180]);
  });
});

test('Desktop bleibt: Kopfzeile einzeilig, Fenster mit Rand', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 900 });
  await starten(page);
  expect((await box(page.locator('header.kz'))).height).toBe(40);
  await page.locator('.ka[data-id="1"] .t').click();
  expect((await box(page.getByRole('dialog', { name: 'Aufgabe #1' }))).width).toBe(1080);
});
