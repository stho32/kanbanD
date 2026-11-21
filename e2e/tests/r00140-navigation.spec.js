// R00140 Aufgaben, Personen und Einrichten im Menü „…“ (Karte #105; der Eintrag „WBS“ entfiel mit R00222). Die Leiste trägt ab 600 px nur
// Board und Berichte ▾; die seltenen Ziele liegen im Menü „…“ (`#t-mehr`, role=menu) als erste Gruppe,
// jeder als menuitem-Link mit tabindex="-1" und data-act="seite", gefolgt von genau einem
// role="separator" und den Werkzeugen. Markiert ist genau ein Eintrag mit `an` + aria-current="page" —
// in der Leiste oder im offenen Menü; der „…“-Auslöser nie (ADR-0018 Regel 5 geweitet).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, breiteSetzen: layoutBeiBreite } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');
const { gezeichnet } = require('./struktur-hilfen');

const DREI_PUNKTE = '…';
// R00222: der Eintrag „WBS“ entfiel mit der WBS-Sicht (ADR-0034 Regel 4)
const ZIELE = ['Aufgaben', 'Personen', 'Einrichten'];

const jetztMinus = min => { const d = new Date(Date.now() - min * 60000); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
const lauft = wer => `\`\`\`kanbanD-time\n${jetztMinus(30)} · ... · ${wer}\n\`\`\`\n`;

/** Grundbestand der R00140: Board „entwicklung“, an kd gebunden , Ich „EM“, drei Spalten, #1 mit laufendem Timer. */
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n';
const AUFGABE_1 = ['aufgaben/0001-eins.md', `---\nid: 1\ntitle: eins\nassignees: [em]\n---\n${lauft('em')}`];

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'rot', { fertig: 'US-1' }),
]);

/** Die sechs Ansichten der Kopfzeile mit dem Eintrag, der `an` + aria-current trägt. */
const ROUTEN = [
  { adresse: '#/board/entwicklung', eintrag: 'Board', bereit: '.bahn' },
  { adresse: '#/aufgaben', eintrag: 'Aufgaben', bereit: '.ziele' },
  { adresse: '#/personen', eintrag: 'Personen' },
  { adresse: '#/berichte/verlauf', eintrag: 'Berichte', bereit: '.dtitel' },
  { adresse: '#/einrichten', eintrag: 'Einrichten', bereit: '.einr' },
];

let laufende = [];
async function starten(page) {
  const arbeit = arbeitsRepository(WBS);
  laufende.push(async () => arbeit.aufraeumen());
  const k = await kanbanStarten(mitRegister(arbeit, { 'boards/entwicklung.md': BOARD, ...Object.fromEntries([AUFGABE_1]) }));
  laufende.push(async () => k.stoppen());
  await alsPerson(page, 'em');
  return k;
}

test.afterEach(async () => {
  for (const aufraeumen of laufende.reverse()) await aufraeumen();
  laufende = [];
});

const kopf = page => page.locator('header.kz');
const leiste = page => kopf(page).locator('nav.kz-nav');
const mehr = page => kopf(page).getByRole('button', { name: 'Mehr' });
const menue = page => page.locator('#pop[role="menu"]');
/** Die Kopfzeilen-Bedienelemente samt offenem Menü — der Bereich, in dem genau ein Eintrag markiert ist. */
const markierte = page => page.locator('header.kz [aria-current="page"], #pop[role="menu"] [aria-current="page"]');

/** Setzt die Breite und wartet, bis die Kopfzeile in der M3-Stufe dieser Breite gezeichnet ist. */
async function breiteSetzen(page, breite) {
  const stufe = breite >= 1200 ? 'large' : breite >= 840 ? 'expanded' : breite >= 600 ? 'medium' : 'compact';
  await layoutBeiBreite(page, breite, 800);
  await expect(kopf(page)).toHaveAttribute('data-stufe', stufe);
}

/** Öffnet das Menü „…“ (Mehr), falls es zu ist. */
async function mehrOeffnen(page) {
  if (await page.locator('#pop[aria-label="Mehr"]').count() === 0) await mehr(page).click();
  await page.locator('#pop[aria-label="Mehr"]').waitFor();
}

test.describe('R00140 Aufgaben, Personen und Einrichten im Menü „…“', () => {
  test.describe.configure({ timeout: 180000 });

  test('US-1/AK 1: die Leiste trägt nur Board und Berichte; die drei Ziele kommen darin nicht vor', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await expect(leiste(page).locator('a')).toHaveCount(2);
    await expect(leiste(page).getByRole('link', { name: 'Board' })).toBeVisible();
    await expect(leiste(page).getByRole('link', { name: /Berichte/ })).toBeVisible();
    const text = await leiste(page).innerText();
    for (const ziel of ZIELE) expect(text, `„${ziel}“ steht noch in der Leiste`).not.toContain(ziel);
  });

  test('US-2/AK 2: unter 600 px trägt das Seitenmenü dieselben zwei Ziele — die drei nicht', async ({ page }) => {
    const k = await starten(page);
    await page.goto(k.adresse);
    await expect(page.locator('.ka')).toHaveCount(1);
    for (const breite of [375, 560]) {
      await breiteSetzen(page, breite);
      await expect(kopf(page).getByRole('navigation')).toHaveCount(0);
      const seitenknopf = page.locator('#t-seite');
      await expect(seitenknopf).toHaveAttribute('aria-label', 'Seite: Board');
      await seitenknopf.click();
      const seite = page.getByRole('menu', { name: 'Seite' });
      await expect(seite.locator('[role^="menuitem"]')).toHaveCount(2);
      await expect(seite.getByRole('menuitem', { name: /^Board$/ })).toBeVisible();
      await expect(seite.getByRole('menuitem', { name: /Berichte/ })).toBeVisible();
      const text = await seite.innerText();
      for (const ziel of ZIELE) expect(text, `${breite} px: „${ziel}“ steht im Seitenmenü`).not.toContain(ziel);
      await page.keyboard.press('Escape');
      await expect(page.locator('#pop')).toHaveCount(0);
    }
  });

  test('US-3/US-4/AK 3+4: das Menü „…“ trägt die drei Ziele bei jeder Breite; jeder Eintrag zeigt seine Ansicht', async ({ page }) => {
    const k = await starten(page);
    for (const breite of [375, 560, 900, 1280, 1440]) {
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await breiteSetzen(page, breite);
      await expect(mehr(page), `${breite} px`).toBeVisible();
      await mehrOeffnen(page);
      const menueBreite = menue(page);
      await expect(menueBreite, `${breite} px`).toHaveAttribute('role', 'menu');
      for (const ziel of ZIELE) {
        const eintrag = menueBreite.getByRole('menuitem', { name: ziel, exact: true });
        await expect(eintrag, `${breite} px: „${ziel}“`).toBeVisible();
        await expect(eintrag).toHaveAttribute('role', 'menuitem');
        await expect(eintrag).toHaveAttribute('tabindex', '-1');
        await expect(eintrag).toHaveAttribute('data-act', 'seite');
        expect(await eintrag.evaluate(e => e.tagName), `${ziel} ist ein Link`).toBe('A');
      }
      if (breite === 375) {
        const r = await menueBreite.boundingBox();
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(375);
        expect(r.y + r.height).toBeLessThanOrEqual(800);
      }
      await page.keyboard.press('Escape');
    }
    for (const [ziel, url] of [['Aufgaben', /#\/aufgaben$/], ['Personen', /#\/personen$/], ['Einrichten', /#\/einrichten$/]]) {
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await mehrOeffnen(page);
      await menue(page).getByRole('menuitem', { name: ziel, exact: true }).click();
      await expect(page, `Klick auf „${ziel}“`).toHaveURL(url);
      await expect(menue(page)).toHaveCount(0);
    }
  });

  test('US-8/AK 11: jeder Menüeintrag ist per ↓ erreichbar, auch die Ziele; im Menü steht kein a ohne Rolle', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await mehrOeffnen(page);
    await expect(menue(page).locator('a:not([role])'), 'kein Link ohne Rolle im offenen Menü').toHaveCount(0);
    const zahl = await menue(page).locator('[role^="menuitem"]').count();
    // Das geöffnete Menü führt den Fokus auf den ersten Eintrag; ↓ läuft durch alle (Umlauf am Ende).
    await menue(page).locator('[role^="menuitem"]').first().focus();
    const besucht = [];
    for (let i = 0; i < zahl; i++) {
      besucht.push(await page.evaluate(() => Boolean(document.activeElement.closest('#pop[role="menu"]')) && document.activeElement.textContent.replace(/\s+/g, ' ').trim()));
      await page.keyboard.press('ArrowDown');
    }
    expect(besucht, '↓ erreicht jeden Eintrag').toHaveLength(zahl);
    expect(besucht.every(Boolean), 'der Fokus bleibt im Menü').toBe(true);
    expect(besucht).toEqual(expect.arrayContaining(ZIELE));
  });

  test('US-9/AK 12: die drei Ziele zuerst, genau ein Trenner, dann die Werkzeuge; kein zweiter Abschnittskopf', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await mehrOeffnen(page);
    const kinder = await menue(page).evaluate(m => [...m.children].map(c => ({
      tag: c.tagName, rolle: c.getAttribute('role'), kopf: c.classList.contains('pop-kopf'),
      text: (c.textContent || '').replace(/\s+/g, ' ').trim(),
    })));
    const trenner = kinder.map((k, i) => k.rolle === 'separator' ? i : -1).filter(i => i >= 0);
    expect(trenner, 'genau ein role="separator"').toHaveLength(1);
    const zielIndizes = kinder.map((k, i) => k.rolle === 'menuitem' && k.tag === 'A' ? i : -1).filter(i => i >= 0);
    expect(zielIndizes.map(i => kinder[i].text), 'die drei Ziele als erste Gruppe').toEqual(ZIELE);
    expect(Math.max(...zielIndizes), 'die Ziele stehen vor dem Trenner').toBeLessThan(trenner[0]);
    expect(trenner[0], 'der Trenner folgt direkt auf das letzte Ziel').toBe(Math.max(...zielIndizes) + 1);
    const werkzeuge = kinder.map((k, i) => k.tag === 'BUTTON' && k.rolle && k.rolle.startsWith('menuitem') ? i : -1).filter(i => i >= 0);
    expect(Math.min(...werkzeuge), 'die Werkzeuge stehen nach dem Trenner').toBeGreaterThan(trenner[0]);
    expect(kinder.filter(k => k.kopf), 'genau ein Abschnittskopf (MEHR)').toHaveLength(1);
    expect(kinder.find(k => k.kopf).text).toBe('MEHR');
    await expect(menue(page).locator('h1, h2, h3, h4, h5, h6')).toHaveCount(0);
  });

  test('US-4/AK 6: die Werkzeuge stehen je Breite; „Neue Aufgabe“ und der Bereich bleiben in der Kopfzeile', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await mehrOeffnen(page);
    await expect(menue(page).getByRole('menuitem')).toHaveText([...ZIELE, 'Spalten einrichten', /^Darstellung:/]);
    await expect(menue(page).getByRole('menuitemcheckbox')).toHaveText(['Signale oben']);
    await expect(menue(page), 'bei 1280 px stehen „Läuft gerade“/„Ich bin …“ in der Kopfzeile').not.toContainText('Läuft gerade');
    await expect(menue(page)).not.toContainText('Ich bin');
    await expect(kopf(page).locator('#t-lauf')).toBeVisible();
    await expect(kopf(page).locator('#t-ich')).toBeVisible();
    await expect(kopf(page).getByLabel('Filter')).toBeVisible();
    await expect(kopf(page).getByRole('button', { name: /Neue Aufgabe/ })).toBeVisible();
    await expect(kopf(page).getByRole('radiogroup', { name: 'Bereich' })).toBeVisible();
    await page.keyboard.press('Escape');
    await breiteSetzen(page, 560);
    await mehrOeffnen(page);
    await expect(menue(page), 'bei 560 px stehen beide im Menü').toContainText('Läuft gerade');
    await expect(menue(page)).toContainText('Ich bin');
    await expect(kopf(page).getByLabel('Filter')).toBeVisible();
    await expect(kopf(page).getByRole('button', { name: /Neue Aufgabe/ })).toBeVisible();
  });

  test('US-6/AK 7: kein Ziel geht verloren — alle sechs sind über die Kopfzeile erreichbar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await expect(leiste(page).getByRole('link', { name: 'Board' })).toBeVisible();
    await expect(leiste(page).getByRole('link', { name: /Berichte/ })).toBeVisible();
    await mehrOeffnen(page);
    for (const ziel of ZIELE) await expect(menue(page).getByRole('menuitem', { name: ziel, exact: true }), `„${ziel}“ fehlt`).toBeVisible();
  });

  test('US-5/AK 4: auf jeder Route trägt genau ein Bedienelement `an` + aria-current — im Menü bei Sekundärrouten', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    for (const route of ROUTEN) {
      await page.goto(k.adresse + route.adresse);
      await gezeichnet(page, route.adresse, route.bereit);
      await mehrOeffnen(page);
      const gefunden = await markierte(page).evaluateAll(es => es.map(e => ({ text: e.textContent.replace(/[▾▸◐\s]/g, '').trim(), an: e.classList.contains('an') })));
      expect(gefunden.map(f => f.text), route.adresse).toEqual([route.eintrag]);
      expect(gefunden[0].an, `${route.adresse}: der Eintrag mit aria-current trägt an`).toBe(true);
      // Auf einer Sekundärroute liegt die Markierung im geöffneten Menü „…“, sonst in der Leiste.
      const imMenue = await markierte(page).evaluateAll(es => es.map(e => e.closest('#pop[role="menu"]') !== null));
      expect(imMenue, `${route.adresse}: Ort der Markierung`).toEqual([ZIELE.includes(route.eintrag)]);
      await expect(page.locator('#t-mehr'), `der „${DREI_PUNKTE}“-Auslöser ist nie markiert`).not.toHaveClass(/\ban\b/);
      await expect(page.locator('#t-mehr')).not.toHaveAttribute('aria-current', /page/);
      await page.keyboard.press('Escape');
    }
  });

  test('US-5/AK 5: bei 560 px in der Aufgabenliste ist „Aufgaben“ im Menü „…“ markiert, der Seitenknopf nennt die Seite', async ({ page }) => {
    await page.setViewportSize({ width: 560, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    await gezeichnet(page, '#/aufgaben', '.ziele');
    await expect(kopf(page).getByRole('navigation')).toHaveCount(0);
    await expect(page.locator('#t-seite')).toHaveAttribute('aria-label', 'Seite: Aufgaben');
    await mehrOeffnen(page);
    const gefunden = await menue(page).locator('[aria-current="page"]').evaluateAll(es => es.map(e => ({ text: e.textContent.trim(), an: e.classList.contains('an') })));
    expect(gefunden).toEqual([{ text: 'Aufgaben', an: true }]);
  });

  test('AK 6: ein Ziel aus dem Menü entfernt macht die Probe rot', async ({ page }) => {
    let griff = false;
    await page.route('**/ansicht.js', async route => {
      const antwort = await route.fetch();
      const text = await antwort.text();
      const mutiert = text.replace(/\$\{mehrZiel\('Personen', u\.view === 'personen', '#\/personen'\)\}/, '');
      griff = mutiert !== text;
      await route.fulfill({ response: antwort, body: mutiert });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await mehrOeffnen(page);
    expect(griff, 'die Mutante „Ziel entfernt“ greift').toBe(true);
    await expect(menue(page).getByRole('menuitem', { name: 'Personen', exact: true })).toHaveCount(0);
  });

  test('AK 11: ein Ziel als bloßer Link ohne Rolle macht die Probe rot', async ({ page }) => {
    let griff = false;
    await page.route('**/ansicht.js', async route => {
      const antwort = await route.fetch();
      const text = await antwort.text();
      const mutiert = text.replace('${eintrag.attribut} href="${hash}" data-act="seite" data-arg="${hash}" role="menuitem" tabindex="-1"', '${eintrag.attribut} href="${hash}" data-act="seite" data-arg="${hash}"');
      griff = mutiert !== text;
      await route.fulfill({ response: antwort, body: mutiert });
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await gezeichnet(page, '#/board/entwicklung', '.bahn');
    await mehrOeffnen(page);
    expect(griff, 'die Mutante „Ziel ohne Rolle“ greift').toBe(true);
    expect(await menue(page).locator('a:not([role])').count()).toBeGreaterThan(0);
  });

  test('AK 12: kein Trenner und zwei Trenner machen die Probe rot', async ({ page }) => {
    for (const [name, ersatz, erwartet] of [['kein Trenner', '', 0], ['zwei Trenner', '<div role="separator"></div><div role="separator"></div>', 2]]) {
      let griff = false;
      await page.route('**/ansicht.js', async route => {
        const antwort = await route.fetch();
        const text = await antwort.text();
        const mutiert = text.replace('<div role="separator"></div>', ersatz);
        griff = mutiert !== text;
        await route.fulfill({ response: antwort, body: mutiert });
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await mehrOeffnen(page);
      expect(griff, `die Mutante „${name}“ greift`).toBe(true);
      expect(await menue(page).locator('[role="separator"]').count(), `Mutante „${name}“`).toBe(erwartet);
      await page.unroute('**/ansicht.js');
    }
  });
});
