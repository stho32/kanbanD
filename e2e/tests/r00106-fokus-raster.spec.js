// R00106 Abtastraster: ein fremdes Live-Ereignis lässt den Fokus auf jedem tabbaren Element jeder Sicht stehen
// (Nacharbeit 3 Karte #8 — die Abnahme ist eine Menge, kein Beispiel; ADR-0007 Sicherer, ADR-0010 Fokusführung).
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'kanbanD.md': '---\npeople:\n  st: {name: Stefan, kind: human}\n  pl: {name: planer, kind: agent}\n  al: {name: Alt, kind: human, active: false}\n---\n',
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n- #3\n\n## Fertig\n\n- #9\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  'aufgaben/0009-kaputt.md': '---\nid: 9\n<<<<<<< HEAD\ntitle: neun\n=======\ntitle: neun anders\n>>>>>>> zweig\n---\n',
};
const ALS_PLANER = { headers: { 'X-KanbanD-Wer': 'pl' } };
const SICHTEN = [
  { name: 'Board', adresse: '#/board/fabrik', sicht: 'board/fabrik/' },
  { name: 'Aufgaben', adresse: '#/aufgaben', sicht: 'aufgaben/' },
  { name: 'Personen', adresse: '#/personen', sicht: 'personen/' },
  { name: 'Einrichten', adresse: '#/einrichten', sicht: 'einrichten/' },
  { name: 'Stundenzettel', adresse: '#/berichte/stundenzettel', sicht: 'berichte/stundenzettel/' },
];

/** Grundbestand der Anforderung: nur das Board „fabrik“. */
function grundbestand(ordner) {
  einrichten(DATEIEN)(ordner);
  fs.rmSync(path.join(ordner, 'boards/entwicklung.md'));
  execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-am', 'nur fabrik']);
}

let k;
test.beforeEach(async ({ page }) => {
  k = await kanbanStarten(grundbestand);
  await alsPerson(page, 'st');
});
test.afterEach(async () => { await k.stoppen(); });

/** Im Browser: die Menge (tabbar nach TABBAR aus web/app.js, ohne tabindex -1, sichtbar und nicht verborgen, nicht inert) und das Merkmal je Element.
    Das Merkmal ist Tag+id, href, data-act/data-arg, data-halt, data-id, data-zeile, Feldschlüssel samt Zeile, bei Radios der Text —
    dazu die laufende Nummer unter Elementen mit gleichem Merkmal. */
function rasterImBrowser() {
  window.kdRaster = {
    menge() {
      // Inhalt eines zugeklappten <details> hat Rechtecke, ist aber verborgen und nicht fokussierbar — checkVisibility sieht das
      const sichtbar = element => element.getClientRects().length > 0 && element.checkVisibility();
      return [...document.querySelector('#app').querySelectorAll(TABBAR)]
        .filter(element => element.getAttribute('tabindex') !== '-1' && sichtbar(element) && !element.closest('[inert]'));
    },
    roh(element) {
      if (!element || element === document.body) return 'BODY';
      const attr = name => element.getAttribute(name);
      const felder = Object.entries(element.dataset).filter(([name]) => /^(af|nf|wf|wn|tf|fb|bf|dl|ef|sf|fr|i)$/.test(name)).map(([name, wert]) => `${name}=${wert}`);
      const teile = [element.tagName + (element.id ? '#' + element.id : ''), attr('href') !== null ? `href=${attr('href')}` : '',
        attr('data-act') ? `act=${attr('data-act')}/${attr('data-arg') || ''}` : '', attr('data-halt') ? `halt=${attr('data-halt')}` : '',
        attr('data-id') ? `id=${attr('data-id')}` : '', attr('data-zeile') ? `zeile=${attr('data-zeile')}` : '', ...felder,
        attr('role') === 'radio' ? `radio=${element.textContent.trim()}` : ''];
      return teile.filter(Boolean).join(' ');
    },
    merkmal(element) {
      const roh = this.roh(element);
      if (roh === 'BODY') return roh;
      const gleiche = [...document.querySelectorAll(element.tagName)].filter(anderes => this.roh(anderes) === roh);
      return `${roh} @${gleiche.indexOf(element)}`;
    },
  };
}

/** Sicht öffnen und warten, bis sie gezeichnet ist. */
async function sichtOeffnen(page, sicht) {
  await page.goto(k.adresse + sicht.adresse);
  await liveBereit(page);
  await expect(page.locator(`#main[data-sicht^="${sicht.sicht}"]`)).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.kdTest.gezeichnet())).toBe(true);
  await page.evaluate(rasterImBrowser);
}

let schreibzaehler = 0;
/** Der Agent planer ändert den Titel von #3; gewartet wird auf das Neuzeichnen (Zähler), nicht auf die Uhr. */
async function fremdesEreignis(page) {
  const vorher = await page.evaluate(() => window.kdTest.renders());
  schreibzaehler += 1;
  const antwort = await page.request.patch(`${k.adresse}api/aufgaben/3`, { ...ALS_PLANER, data: { titel: `drei ${schreibzaehler}` } });
  expect(antwort.ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 2000 }).toBeGreaterThan(vorher);
}

/** Tastet alle Elemente der Sicht ab: fokussieren, fremdes Ereignis, Merkmal vergleichen. Liefert Zahl und Abweichungen. */
async function sichtAbtasten(page, sicht, breite) {
  await sichtOeffnen(page, sicht);
  const anzahl = await page.evaluate(() => window.kdRaster.menge().length);
  const abweichungen = [];
  for (let index = 0; index < anzahl; index++) {
    const vorher = await page.evaluate(nummer => {
      const element = window.kdRaster.menge()[nummer];
      if (!element) return { fehlt: true };
      element.focus();
      return { merkmal: window.kdRaster.merkmal(element), sitzt: document.activeElement === element };
    }, index);
    if (vorher.fehlt) { abweichungen.push(`${breite} ${sicht.name} [${index}]: Menge nach dem Neuzeichnen kleiner`); continue; }
    if (!vorher.sitzt) { abweichungen.push(`${breite} ${sicht.name} [${index}] ${vorher.merkmal}: nimmt keinen Fokus`); continue; }
    await fremdesEreignis(page);
    const nachher = await page.evaluate(() => window.kdRaster.merkmal(document.activeElement));
    if (nachher !== vorher.merkmal) abweichungen.push(`${breite} ${sicht.name} [${index}] ${vorher.merkmal} → ${nachher}`);
  }
  return { anzahl, abweichungen };
}

for (const breite of [1280, 375]) {
  test(`Raster ${breite} px: ein fremdes Live-Ereignis lässt den Fokus auf jedem tabbaren Element in Board, Aufgaben, Personen, Einrichten, Stundenzettel`, async ({ page }) => {
    test.setTimeout(300000);
    await page.setViewportSize({ width: breite, height: 800 });
    let gesamt = 0;
    const alle = [];
    for (const sicht of SICHTEN) {
      const { anzahl, abweichungen } = await sichtAbtasten(page, sicht, breite);
      gesamt += anzahl;
      alle.push(...abweichungen);
    }
    console.log(`Raster ${breite} px: ${alle.length} von ${gesamt} verlieren den Fokus\n${alle.join('\n')}`);
    expect(gesamt, 'die Menge ist nicht leer').toBeGreaterThan(0);
    expect(alle, `${alle.length} von ${gesamt}`).toEqual([]);
  });
}

for (const sicht of SICHTEN) {
  test(`Raster-Stichprobe per Tastatur in ${sicht.name}: Tab vom Seitenanfang auf das erste Element und weiter bis in die Statuszeile, fremdes Ereignis → Fokus bleibt`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await sichtOeffnen(page, sicht);
    await page.evaluate(() => document.activeElement.blur());
    for (const ziel of ['erstes', 'Statuszeile']) {
      await page.keyboard.press('Tab');
      for (let schritt = 0; ziel === 'Statuszeile' && schritt < 200 && !(await page.evaluate(() => Boolean(document.activeElement.closest('#stat')))); schritt++) await page.keyboard.press('Tab');
      const vorher = await page.evaluate(() => window.kdRaster.merkmal(document.activeElement));
      expect(vorher, `Tab erreicht ${ziel}`).not.toBe('BODY');
      await fremdesEreignis(page);
      expect(await page.evaluate(() => window.kdRaster.merkmal(document.activeElement)), ziel).toBe(vorher);
    }
  });
}

for (const [sicht, selektor] of [[SICHTEN[0], '.ka[data-id="3"]'], [SICHTEN[1], 'tr[data-zeile="3"]']]) {
  test(`Raster-Variante ${sicht.name}: das Ereignis trifft das fokussierte Element selbst (#3 bekommt einen neuen Titel) → Fokus bleibt darauf`, async ({ page }) => {
    await sichtOeffnen(page, sicht);
    await page.locator(selektor).focus();
    await fremdesEreignis(page);
    await expect(page.locator(selektor)).toContainText(`drei ${schreibzaehler}`);
    await expect(page.locator(selektor)).toBeFocused();
  });
}

test('Raster-Grenze: Fokus auf Karte #2, planer archiviert #2 → der Fokus steht nie in einem Eingabefeld oder auf einem Radio', async ({ page }) => {
  await sichtOeffnen(page, SICHTEN[0]);
  await page.locator('.ka[data-id="2"]').focus();
  const vorher = await page.evaluate(() => window.kdTest.renders());
  expect((await page.request.post(`${k.adresse}api/aufgaben/2/archivieren`, ALS_PLANER)).ok()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders()), { timeout: 2000 }).toBeGreaterThan(vorher);
  await expect(page.locator('.ka[data-id="2"]')).toHaveCount(0);
  const danach = await page.evaluate(() => ({ tag: document.activeElement.tagName, rolle: document.activeElement.getAttribute('role'), merkmal: window.kdRaster.merkmal(document.activeElement) }));
  expect(['INPUT', 'TEXTAREA', 'SELECT'], danach.merkmal).not.toContain(danach.tag);
  expect(danach.rolle, danach.merkmal).not.toBe('radio');
});
