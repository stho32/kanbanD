// R00113 Struktur für Hilfstechnik (ADR-0018): Seitenüberschrift und Landmarks je Route und Zustand, abgeglichen gegen vHaupt().
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, ausMehr } = require('./hilfen');
const {
  grundbestand, arbeitMitEinerPhase, ROUTEN, ZUSTAENDE, APP_JS,
  gezeichnet, seitenueberschriftPruefen, landmarkenPruefen, vollstaendigkeitPruefen,
} = require('./struktur-hilfen');

const [ERSTER_START, EINRICHTUNGSMODUS, DEFEKTES_BOARD] = ZUSTAENDE;

let laufende = [];
test.afterEach(async () => {
  for (const aufraeumen of laufende.reverse()) await aufraeumen();
  laufende = [];
});

/** kanbanD mit dem Grundbestand der User Story; `mehr` überschreibt Dateien. */
async function starten(page, mehr = {}) {
  const arbeit = arbeitMitEinerPhase();
  laufende.push(async () => arbeit.aufraeumen());
  const k = await kanbanStarten(einrichten({ ...grundbestand(arbeit), ...mehr }));
  laufende.push(() => k.stoppen());
  await alsPerson(page, 'st');
  return k;
}

/** Öffnet jede Route und jeden Zustand und sammelt die Verstöße von `pruefen(page, eintrag)`. */
async function ueberAlleSeiten(page, pruefen) {
  const verstoesse = [];
  const k = await starten(page);
  for (const route of ROUTEN) {
    await page.goto(k.adresse + route.adresse);
    await gezeichnet(page, route.adresse, route.bereit);
    verstoesse.push(...await pruefen(page, route));
  }
  await page.goto(k.adresse + '#/board/entwicklung');
  await page.locator('.bahn').first().waitFor();
  await ausMehr(page, 'Spalten einrichten');
  await page.locator('.setup').waitFor();
  verstoesse.push(...await pruefen(page, EINRICHTUNGSMODUS));

  const defekt = await starten(page, { 'boards/entwicklung.md': '# Entwicklung\n- #1\n## A\n', 'boards/test.md': '# Test\n\n## Bereit\n' });
  await page.goto(defekt.adresse + '#/board/entwicklung');
  await page.locator('.defektflaeche').waitFor();
  verstoesse.push(...await pruefen(page, DEFEKTES_BOARD));

  const leer = await kanbanStarten();
  laufende.push(() => leer.stoppen());
  await page.goto(leer.adresse);
  await page.locator('.first').waitFor();
  verstoesse.push(...await pruefen(page, ERSTER_START));
  return verstoesse;
}

test.describe('R00113 Struktur für Hilfstechnik', () => {
  test.describe.configure({ timeout: 180000 });

  test('US-1: jede Route hat genau eine Seitenüberschrift', async ({ page }) => {
    expect(await ueberAlleSeiten(page, seitenueberschriftPruefen)).toEqual([]);
  });

  test('US-1: Landmarks je Route und Zustand, ohne navigation bei 560 px', async ({ page }) => {
    expect(await ueberAlleSeiten(page, landmarkenPruefen)).toEqual([]);
    await page.setViewportSize({ width: 560, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    await gezeichnet(page, '#/aufgaben');
    expect(await landmarkenPruefen(page, { ansicht: 'Aufgabenliste bei 560 px', ohneNavigation: true })).toEqual([]);
  });

  test('US-1: die Probe prüft jede Verzweigung von vHaupt()', () => {
    expect(vollstaendigkeitPruefen(fs.readFileSync(APP_JS, 'utf8'), ROUTEN.length + ZUSTAENDE.length)).toEqual([]);
  });

});
