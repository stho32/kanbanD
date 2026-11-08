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

  test('US-7: entfernter Zeiteintrag kommt mit Strg+Z zurück (#12)', async ({ page }) => {
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

  test('US-7 Gegenfall: hat ein Agent den Eintrag schon wiederhergestellt, meldet der Fuß das (#12)', async ({ page }) => {
    await zeitEntfernen(page);
    const zurueck = await page.request.post(k.adresse + 'api/aufgaben/1/zeiten', { ...ALS_CL, data: { wer: 'st', beginn: `${gestern()} 09:00`, ende: `${gestern()} 10:00` } });
    expect(zurueck.status()).toBe(200);
    const commitsVorher = commits(k);
    await imFenster(page).getByRole('button', { name: 'rückgängig' }).click();
    await expect(page.locator('#fenster .mod-fuss [role="alert"]')).toContainText('nicht rückgängig: #1 hat schon einen Eintrag st@');
    expect(await zeitenVon1(page, k)).toHaveLength(1);
    expect(commits(k)).toBe(commitsVorher);
  });
});

// US-5 und US-6: #1 hat die Teilaufgaben a, b (erledigt), c
test.describe('R00112 Teilaufgabe im Fenster', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(grundbestand())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const imFenster = page => page.locator('[aria-modal="true"] .toast[role="status"]');
  const zeilen = page => page.locator('#fenster .chk');
  const checkliste = () => k.lies('aufgaben/0001-eins.md').split('\n').filter(z => /^- \[[ x]\] /.test(z));

  async function bEntfernen(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(zeilen(page)).toHaveCount(3);
    await page.getByLabel('Teilaufgabe b entfernen').click();
    await expect(zeilen(page)).toHaveText(['a', 'c'].map(t => new RegExp(`^✓?${t}✕`)));
    await expect(imFenster(page)).toContainText('Teilaufgabe „b“ entfernt');
  }

  test('US-5: entfernte Teilaufgabe b kommt an Index 1 und erledigt zurück (#12)', async ({ page }) => {
    await bEntfernen(page);
    const knopf = imFenster(page).getByRole('button', { name: 'rückgängig' });
    for (let i = 0; i < 80 && !(await knopf.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(knopf).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(zeilen(page)).toHaveText(['a', 'b', 'c'].map(t => new RegExp(`^✓?${t}✕`)));
    await expect(zeilen(page).nth(1)).toHaveClass(/\bok\b/);
    await expect(imFenster(page)).toHaveText('Teilaufgabe „b“ wiederhergestellt');
    expect(checkliste()).toEqual(['- [ ] a', '- [x] b', '- [ ] c']);
  });

  test('US-6: neben einem Agenten und doppelt geklickt steht b einmal, d bleibt (#12)', async ({ page }) => {
    await bEntfernen(page);
    const d = await page.request.post(k.adresse + 'api/aufgaben/1/teilaufgaben', { ...ALS_CL, data: { text: 'd' } });
    expect(d.ok()).toBe(true);
    await expect(zeilen(page)).toHaveCount(3);
    await imFenster(page).getByRole('button', { name: 'rückgängig' }).dblclick();
    await expect(zeilen(page)).toHaveText(['a', 'b', 'c', 'd'].map(t => new RegExp(`^✓?${t}✕`)));
    await expect(zeilen(page).nth(1)).toHaveClass(/\bok\b/);
    expect(checkliste()).toEqual(['- [ ] a', '- [x] b', '- [ ] c', '- [ ] d']);
  });
});

// US-8 und US-9: #1 hat den Anhang plan.pdf mit 2048 festen Bytes
const PLAN = 'aufgaben/0001-eins/plan.pdf';
const sha256 = puffer => require('crypto').createHash('sha256').update(puffer).digest('hex');

test.describe('R00112 Anhang im Fenster', () => {
  let k;
  const platte = rel => require('fs').readFileSync(require('path').join(k.ordner, rel));
  const daliegt = rel => require('fs').existsSync(require('path').join(k.ordner, rel));
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(mitZeitUndAnhang())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  const imFenster = page => page.locator('[aria-modal="true"] .toast[role="status"]');
  const anhaenge = page => page.locator('#anhaenge .anh-z a');

  async function fensterAuf(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(anhaenge(page)).toHaveText(['plan.pdf']);
  }

  test('US-8: entfernter Anhang kommt bytegleich zurück (#12)', async ({ page }) => {
    const vorher = sha256(platte(PLAN));
    await fensterAuf(page);
    await page.getByLabel('Anhang plan.pdf entfernen').click();
    await expect(imFenster(page)).toContainText('Anhang „plan.pdf“ entfernt');
    await expect(anhaenge(page)).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(anhaenge(page)).toHaveText(['plan.pdf']);
    await expect(imFenster(page)).toHaveText('Anhang „plan.pdf“ wiederhergestellt');
    expect(platte(PLAN).length).toBe(2048);
    expect(sha256(platte(PLAN))).toBe(vorher);
  });

  test('US-8 Gegenfall: hat ein Agent „plan.pdf“ neu hochgeladen, kommt der alte als plan-2.pdf zurück (#12)', async ({ page }) => {
    const vorher = sha256(platte(PLAN));
    await fensterAuf(page);
    await page.getByLabel('Anhang plan.pdf entfernen').click();
    await expect(imFenster(page)).toContainText('Anhang „plan.pdf“ entfernt');
    const fremd = Buffer.alloc(100, 1);
    const hoch = await page.request.post(k.adresse + 'api/aufgaben/1/anhaenge', { ...ALS_CL, multipart: { datei: { name: 'plan.pdf', mimeType: 'application/pdf', buffer: fremd } } });
    expect(hoch.status()).toBe(201);
    await page.keyboard.press('Control+z');
    await expect(anhaenge(page)).toHaveText(['plan-2.pdf', 'plan.pdf']); // die Liste ist nach Namen sortiert
    await expect(imFenster(page)).toHaveText('Anhang als „plan-2.pdf“ wiederhergestellt');
    expect(sha256(platte(PLAN))).toBe(sha256(fremd));
    expect(platte('aufgaben/0001-eins/plan-2.pdf').length).toBe(2048);
    expect(sha256(platte('aufgaben/0001-eins/plan-2.pdf'))).toBe(vorher);
  });

  test('AK 13: während des Lesens zeigt das ✕ den Ladezustand, danach ist der Anhang entfernt (#12)', async ({ page }) => {
    await fensterAuf(page);
    let freigeben;
    const gehalten = new Promise(r => { freigeben = r; });
    await page.route('**/api/aufgaben/1/anhaenge/plan.pdf', async route => { if (route.request().method() === 'GET') await gehalten; await route.continue(); });
    const x = page.getByLabel('Anhang plan.pdf entfernen');
    await x.click();
    await expect(x).toBeDisabled();
    await expect(x).toHaveAttribute('aria-busy', 'true');
    expect(daliegt(PLAN)).toBe(true);
    freigeben();
    await expect(anhaenge(page)).toHaveCount(0);
    await expect(imFenster(page)).toContainText('Anhang „plan.pdf“ entfernt');
    expect(daliegt(PLAN)).toBe(false);
  });

  test('US-9: lässt sich der Anhang nicht lesen, wird er nicht gelöscht (#12)', async ({ page }) => {
    await fensterAuf(page);
    const geloescht = [];
    page.on('request', r => { if (r.method() === 'DELETE') geloescht.push(r.url()); });
    await page.route('**/api/aufgaben/1/anhaenge/plan.pdf', route => route.request().method() === 'GET' ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"Platte nicht lesbar"}' }) : route.continue());
    await page.getByLabel('Anhang plan.pdf entfernen').click();
    await expect(page.locator('#fenster .mod-fuss [role="alert"]')).toContainText('Anhang „plan.pdf“ nicht entfernt: ');
    await expect(anhaenge(page)).toHaveText(['plan.pdf']);
    expect(geloescht).toEqual([]);
    expect(daliegt(PLAN)).toBe(true);
    await expect(page.locator('.toast').getByRole('button', { name: 'rückgängig' })).toHaveCount(0);
  });
});

// B0463 (ADR-0017 Regel 5, Artboard D0003 #hinweis-im-fenster, PO Z. 162–164): bei offenem modalem Fenster steht der
// Hinweis als Overlay 8 px über dem Fuß im obersten Dialog. „Zurückholen“ im Fenster einer archivierten Aufgabe ist ein
// Hinweis, der ohne eine der neuen Rückgängig-Arten entsteht.
test.describe('R00112 Hinweis im obersten Fenster', () => {
  let k;
  test.afterEach(() => k.stoppen());
  const hinweis = page => page.locator('.toast[role="status"]');
  const rechteck = loc => loc.evaluate(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, o: r.top, u: r.bottom }; });

  async function zurueckgeholt(page) {
    k = await kanbanStarten(einrichten({ ...grundbestand(), 'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\narchived: 2026-10-01\n---\n' }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.getByRole('link', { name: 'Archiv (1)' }).click();
    await page.locator('.ka[data-id="1"]').click();
    await page.getByRole('button', { name: 'Zurückholen', exact: true }).click();
    await expect(hinweis(page)).toContainText('#1 zurückgeholt');
  }

  test('liegt im Dialog mit aria-modal, mittig 8 px über dem Fuß', async ({ page }) => {
    await zurueckgeholt(page);
    await expect(page.locator('[aria-modal="true"] .toast[role="status"]')).toHaveCount(1);
    await expect(hinweis(page)).toHaveCount(1);
    const h = await rechteck(hinweis(page)), fuss = await rechteck(page.locator('#fenster .mod-fuss')), mod = await rechteck(page.locator('#fenster'));
    expect(Math.abs(fuss.o - 8 - h.u)).toBeLessThanOrEqual(1);
    expect(Math.abs((h.l + h.r) / 2 - (mod.l + mod.r) / 2)).toBeLessThanOrEqual(1);
    expect(h.r - h.l).toBeLessThanOrEqual(Math.min(720, mod.r - mod.l - 32) + 0.5);
  });

  test('ohne Fenster bleibt er unten über allem', async ({ page }) => {
    await zurueckgeholt(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#fenster')).toHaveCount(0);
    await expect(hinweis(page)).toContainText('#1 zurückgeholt');
    expect(await hinweis(page).evaluate(e => getComputedStyle(e).position)).toBe('fixed');
  });

  test('Zeiger nur im Rechteck: neben dem Hinweis trifft ein Klick den Körper', async ({ page }) => {
    await zurueckgeholt(page);
    await expect(page.locator('[aria-modal="true"] .toast[role="status"]')).toHaveCount(1);
    const h = await rechteck(hinweis(page)), mod = await rechteck(page.locator('#fenster'));
    const mitte = (h.o + h.u) / 2;
    const ziel = (x, y) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.closest('.toast') ? 'hinweis' : e.closest('.mod-body') ? 'koerper' : e.className) : null; }, [x, y]);
    expect(await ziel((h.l + h.r) / 2, mitte)).toBe('hinweis');
    expect(await ziel(mod.l + 4, mitte)).toBe('koerper');
    expect(await ziel(h.l - 4, mitte)).toBe('koerper');
    expect(await ziel(h.r + 4, mitte)).toBe('koerper');
    expect(await ziel((h.l + h.r) / 2, h.o - 4)).toBe('koerper');
  });

  test('der Rand --kd-hinweis-rand gilt für jeden Hinweis, ohne Maßänderung', async ({ page }) => {
    await zurueckgeholt(page);
    const stil = await hinweis(page).evaluate(e => { const s = getComputedStyle(e); return { outline: s.outlineStyle + ' ' + s.outlineWidth, rand: s.borderTopWidth }; });
    expect(stil).toEqual({ outline: 'solid 1px', rand: '0px' });
  });
});

test.describe('R00112 Fokus nie verdeckt (320 × 640)', () => {
  test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(mitZeit())); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  test('nach ✕ an einer Zeit liegt „Spalte“ nach Tab ganz außerhalb des Hinweises (#12)', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await page.getByLabel('Zeit 1 löschen').click();
    const hinweis = page.locator('[aria-modal="true"] .toast[role="status"]');
    await expect(hinweis).toContainText('Zeit 09:00–10:00 von Stefan gelöscht');
    const spalte = page.locator('#fenster select[aria-label="Spalte"]');
    for (let i = 0; i < 120 && !(await spalte.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(spalte).toBeFocused();
    await expect(hinweis).toBeVisible();
    const [f, h] = await Promise.all([spalte, hinweis].map(l => l.evaluate(e => { const r = e.getBoundingClientRect(); return { o: r.top, u: r.bottom }; })));
    expect(f.u <= h.o || f.o >= h.u, `Spalte ${f.o}–${f.u}, Hinweis ${h.o}–${h.u}`).toBe(true);
  });
});
