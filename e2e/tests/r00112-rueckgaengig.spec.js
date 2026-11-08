// R00112 Entfernen rückgängig und sichtbare Entfernen-Knöpfe (Karte #12, ADR-0017)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, kontrastAm, mutanteEinsetzen } = require('./hilfen');

const ALS_CL = { headers: { 'X-KanbanD-Wer': 'cl' } };

const grundbestand = (boardTitel = 'Entwicklung') => ({
  'boards/entwicklung.md': `# ${boardTitel}\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n`,
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n- [ ] a\n- [x] b\n- [ ] c\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
});

/** Nummern einer Spalte in der Reihenfolge der Board-Datei. */
function spalteDerDatei(text, spalte) {
  const abschnitt = text.split(/^## /m).find(teil => teil.startsWith(spalte + '\n'));
  return [...abschnitt.matchAll(/#(\d+)\]/g)].map(m => +m[1]);
}

const commits = k => +k.git('rev-list', '--count', 'HEAD');

test.describe('R00112 von Board nehmen', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(grundbestand())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const ort = page => page.locator('tr[data-zeile="2"] .orte');
  const hinweis = page => page.locator('.toast[role="status"]');

  /** Gemeinsames Dann von US-1 und US-2 ab „zeigt nach Strg+Z“. */
  async function wiederAnSeinemPlatz(page, vorher) {
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    await expect(hinweis(page)).toHaveText('#2 wieder auf „Entwicklung“ · Spalte Zu erledigen');
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toHaveCount(0);
    expect(spalteDerDatei(k.lies('boards/entwicklung.md'), 'Zu erledigen')).toEqual([1, 2, 3]);
    expect(commits(k)).toBe(vorher + 2);
    expect(k.git('log', '-2', '--format=%an|%s').split('\n')).toEqual(['Stefan|#2 auf „Entwicklung“ gelegt (Zu erledigen)', 'Stefan|#2 von „Entwicklung“ genommen']);
    await page.goto(k.adresse);
    await expect(page.locator('.bahn[data-col="Zu erledigen"] .ka .id')).toHaveText(['#1', '#2', '#3']);
  }

  test('US-1: Strg+Z nach von Board nehmen legt #2 an die alte Stelle zurück (#12)', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    const vorher = commits(k);
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    await expect(hinweis(page)).toContainText('#2 von „Entwicklung“ genommen');
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toBeVisible();
    await expect(ort(page)).toHaveText('auf keinem Board');
    await page.keyboard.press('Control+z');
    await wiederAnSeinemPlatz(page, vorher);
  });

  test('US-2: Kontextmenü „Von Board nehmen“ und Knopf „rückgängig“ (#12)', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    const vorher = commits(k);
    await page.locator('tr[data-zeile="2"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Von Board nehmen/ }).hover();
    await page.getByRole('menuitem', { name: 'Entwicklung · Zu erledigen' }).click();
    await expect(ort(page)).toHaveText('auf keinem Board');
    await hinweis(page).getByRole('button', { name: 'rückgängig' }).click();
    await wiederAnSeinemPlatz(page, vorher);
  });

  test('US-3: der Hinweis läuft ab, danach wirkt Strg+Z nicht mehr (#12)', async ({ page }) => {
    await page.clock.install();
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    await expect(ort(page)).toHaveText('auf keinem Board');
    const nachDemEntfernen = commits(k);
    await page.clock.runFor(5000);
    await expect(hinweis(page).getByRole('button', { name: 'rückgängig' })).toBeVisible();
    await page.clock.runFor(7000);
    await expect(page.locator('[data-act="rueckgaengig"]')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(500);
    await expect(ort(page)).toHaveText('auf keinem Board');
    expect(commits(k)).toBe(nachDemEntfernen);
  });

  test('US-4: hat ein Agent #2 schon zurückgelegt, meldet rückgängig das und legt nichts doppelt (#12)', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await expect(ort(page)).toContainText('Entwicklung · Zu erledigen');
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    await expect(hinweis(page).getByRole('button', { name: 'rückgängig' })).toBeVisible();
    const gelegt = await page.request.post(k.adresse + 'api/boards/entwicklung/aufgaben', { ...ALS_CL, data: { nummer: 2 } });
    expect(gelegt.status()).toBe(201);
    const vorher = commits(k);
    await hinweis(page).getByRole('button', { name: 'rückgängig' }).click();
    await expect(hinweis(page)).toHaveText('nicht rückgängig: #2 liegt schon auf „Entwicklung“');
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toHaveCount(0);
    expect(k.lies('boards/entwicklung.md').match(/#2\]/g)).toHaveLength(1);
    expect(commits(k)).toBe(vorher);
    expect(k.git('log', '-1', '--format=%an')).toBe('Claude');
  });
});

/**
 * Maße des Elements, wenn es samt seinem Text ganz im Bildschirm liegt und kein Vorfahr mit overflow es abschneidet; sonst null.
 * Der Text zählt mit, weil ein zu schmaler Knopf seine Beschriftung über den Rand hinausschiebt, ohne dass sein Rechteck es zeigt.
 */
function ganzSichtbar(el) {
  const bereich = document.createRange();
  bereich.selectNodeContents(el);
  const kasten = el.getBoundingClientRect(), text = bereich.getBoundingClientRect();
  const r = { left: Math.min(kasten.left, text.left), top: Math.min(kasten.top, text.top), right: Math.max(kasten.right, text.right), bottom: Math.max(kasten.bottom, text.bottom) };
  if (!el.getClientRects().length || r.left < 0 || r.top < 0 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) return null;
  for (let v = el.parentElement; v; v = v.parentElement) {
    const s = getComputedStyle(v), b = v.getBoundingClientRect(), schneidet = o => o !== 'visible';
    const ausserhalb = v.classList.contains('toast') || schneidet(s.overflowX);
    if (ausserhalb && (r.left < b.left - 0.5 || r.right > b.right + 0.5)) return null;
    if ((v.classList.contains('toast') || schneidet(s.overflowY)) && (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5)) return null;
  }
  return { breite: kasten.width, hoehe: kasten.height };
}

/** Anzahl der Zeilen, über die der Text des Hinweises (vor dem Knopf) läuft. */
function zeilenDesTextes(hinweis) {
  const bereich = document.createRange();
  bereich.selectNodeContents(hinweis.firstChild);
  return new Set([...bereich.getClientRects()].map(r => Math.round(r.top))).size;
}

test.describe('R00112 Hinweis schmal', () => {
  let k;
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(grundbestand('Entwicklung und Betrieb der Plattform'))); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-11: der Hinweis bricht bei 320 px um, „rückgängig“ liegt ganz im Bild', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.getByLabel('#2 von Entwicklung und Betrieb der Plattform nehmen').tap();
    const hinweis = page.locator('.toast[role="status"]');
    await expect(hinweis).toContainText('#2 von „Entwicklung und Betrieb der Plattform“ genommen');
    expect(await hinweis.evaluate(ganzSichtbar)).not.toBeNull();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    const knopf = await hinweis.getByRole('button', { name: 'rückgängig' }).evaluate(ganzSichtbar);
    expect(knopf).not.toBeNull();
    expect(knopf.breite).toBeGreaterThanOrEqual(44);
    expect(knopf.hoehe).toBeGreaterThanOrEqual(44);
    // umbrechen heißt: die Breite des Bildschirms nutzen (ADR-0015 Regel 1), nicht den Text in eine schmale Spalte zwängen
    expect(await hinweis.evaluate(zeilenDesTextes)).toBeLessThanOrEqual(2);
  });
});

test.describe('R00112 Hinweis breit', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(grundbestand())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('US-11: bei 1280 px steht der kurze Hinweis in einer Zeile', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.getByLabel('#2 von Entwicklung nehmen').click();
    const hinweis = page.locator('.toast[role="status"]');
    await expect(hinweis).toContainText('#2 von „Entwicklung“ genommen');
    expect(await hinweis.evaluate(zeilenDesTextes)).toBe(1);
    const [knopf, zeile] = await Promise.all([hinweis.getByRole('button', { name: 'rückgängig' }).boundingBox(), hinweis.boundingBox()]);
    expect(Math.abs((knopf.y + knopf.height / 2) - (zeile.y + zeile.height / 2))).toBeLessThan(2);
  });
});

// US-10: #1 mit einem beendeten Zeiteintrag, Teilaufgaben a, b, c und dem Anhang plan.pdf.
const mitZeitUndAnhang = () => ({
  ...grundbestand(),
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n- [ ] a\n- [x] b\n- [ ] c\n\n```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 10:00 · st\n```\n',
  'aufgaben/0001-eins/plan.pdf': Buffer.alloc(2048, 7),
});

/** Die ✕ zum Entfernen; `.zt .btn-sym` umfasst auch das ✎ derselben Zeile. */
const ENTFERNEN = { liste: ['.lnk-x'], fenster: ['.zt .btn-sym', '.chk .x', '.anh-z .x'] };

/** Je Selektor die Anzahl und die verschiedenen berechneten opacity-Werte; die Mindestanzahl ist die Selbstprobe der Messung. */
const deckkraft = (page, selektoren) => page.evaluate(alle => Object.fromEntries(alle.map(s => {
  const treffer = [...document.querySelectorAll(s)];
  return [s, { anzahl: treffer.length, opacity: [...new Set(treffer.map(el => getComputedStyle(el).opacity))] }];
})), selektoren);

const IMMER_SICHTBAR = selektoren => Object.fromEntries(selektoren.map(s => [s, { anzahl: expect.any(Number), opacity: ['1'] }]));

/** Misst ohne Zeigen und ohne Fokus: Maus in der Ecke, kein Element fokussiert. */
async function ohneZeigen(page) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
}

async function alleEntfernenKnoepfeSichtbar(page, k) {
  await page.goto(k.adresse + '#/aufgaben');
  await expect(page.locator('.lnk-x').first()).toBeAttached();
  await ohneZeigen(page);
  const liste = await deckkraft(page, ENTFERNEN.liste);
  await page.goto(k.adresse);
  await page.locator('.ka[data-id="1"] .id').click();
  await expect(page.locator('#anhaenge .anh-z')).toHaveCount(1);
  await ohneZeigen(page);
  const fenster = await deckkraft(page, ENTFERNEN.fenster);
  for (const s of [...ENTFERNEN.liste, ...ENTFERNEN.fenster]) expect({ s, anzahl: { ...liste, ...fenster }[s].anzahl > 0 }).toEqual({ s, anzahl: true });
  expect({ ...liste, ...fenster }).toEqual(IMMER_SICHTBAR([...ENTFERNEN.liste, ...ENTFERNEN.fenster]));
  for (const s of ENTFERNEN.fenster) expect(await kontrastAm(page.locator(s).first())).toBeGreaterThanOrEqual(4.5);
}

test.describe('R00112 ✕ sichtbar bei Touch', () => {
  let k;
  test.use({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true });
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(mitZeitUndAnhang())); await alsPerson(page, 'st'); await mutanteEinsetzen(page); });
  test.afterEach(() => k.stoppen());

  test('US-10: jedes ✕ ist ohne Zeigen sichtbar (414 px Touch)', async ({ page }) => {
    await alleEntfernenKnoepfeSichtbar(page, k);
  });
});

test.describe('R00112 ✕ sichtbar mit Maus', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(mitZeitUndAnhang())); await alsPerson(page, 'st'); await mutanteEinsetzen(page); });
  test.afterEach(() => k.stoppen());

  test('US-10: jedes ✕ ist ohne Hover sichtbar (1280 px, feiner Zeiger)', async ({ page }) => {
    await alleEntfernenKnoepfeSichtbar(page, k);
  });
});

// US-7: Stefan 09:00–10:00 an #1. Die User Story sagt „heute“; vor 10:00 läge das Ende in der Zukunft, und der Server lehnt
// das Wiederherstellen ab (Zeitnachtrag: ende nicht in der Zukunft). Gestern ergibt dieselbe Zeile und denselben Hinweis.
const gestern = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(Date.now() - 864e5);
const mitZeit = () => ({
  ...grundbestand(),
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\n---\n\n\`\`\`kanbanD-time\n${gestern()} 09:00 · ${gestern()} 10:00 · st\n\`\`\`\n`,
});
const zeitenVon1 = async (page, k) => (await (await page.request.get(k.adresse + 'api/aufgaben/1')).json()).zeiten;

test.describe('R00112 Zeiteintrag im Fenster', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(mitZeit())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const imFenster = page => page.locator('[aria-modal="true"] .toast[role="status"]');

  async function zeitEntfernen(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.locator('.zt')).toContainText('09:00–10:00');
    await page.getByLabel('Zeit 1 löschen').click();
    await expect(page.locator('.zt')).not.toContainText('09:00–10:00');
    await expect(imFenster(page)).toContainText('Zeit 09:00–10:00 von Stefan gelöscht');
  }

  test.fail('US-7: entfernter Zeiteintrag kommt mit Strg+Z zurück (#12)', async ({ page }) => {
    const [vorher] = await zeitenVon1(page, k);
    await zeitEntfernen(page);
    const knopf = imFenster(page).getByRole('button', { name: 'rückgängig' });
    for (let i = 0; i < 80 && !(await knopf.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(knopf).toBeFocused();
    const commitsVorher = commits(k);
    await page.keyboard.press('Control+z');
    await expect(page.locator('.zt')).toContainText('09:00–10:00');
    await expect(imFenster(page)).toHaveText('Zeit 09:00–10:00 von Stefan wiederhergestellt');
    const nachher = await zeitenVon1(page, k);
    expect(nachher.map(z => z.kennung)).toEqual([vorher.kennung]);
    expect(commits(k)).toBe(commitsVorher + 1);
    expect(k.git('log', '-1', '--format=%an|%s')).toMatch(/^Stefan\|#1 Zeit nachgetragen: 1:00 \(Stefan\)$/);
  });

  test.fail('US-7 Gegenfall: hat ein Agent den Eintrag schon wiederhergestellt, meldet der Fuß das (#12)', async ({ page }) => {
    await zeitEntfernen(page);
    const zurueck = await page.request.post(k.adresse + 'api/aufgaben/1/zeiten', { ...ALS_CL, data: { wer: 'st', beginn: `${gestern()} 09:00`, ende: `${gestern()} 10:00` } });
    expect(zurueck.status()).toBe(201);
    const commitsVorher = commits(k);
    await imFenster(page).getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('#fenster .mod-fuss [role="alert"]')).toContainText('nicht rückgängig: #1 hat schon einen Eintrag st@');
    expect(await zeitenVon1(page, k)).toHaveLength(1);
    expect(commits(k)).toBe(commitsVorher);
  });
});
