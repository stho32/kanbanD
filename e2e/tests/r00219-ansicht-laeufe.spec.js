// R00219 Ansicht „Läufe“ im Aufgabenfenster (Karte #217, I0209, Scheibe D1) — AK 3–10 im echten Programm.
// Ausgangslage und Hilfen: laeufe-hilfen.js (Boards `fabrik` erfassend und `zweit` ausgeschaltet, Aufgaben #1–#6).
// Zeitproben deterministisch: Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten;
// jede Verneinung („kein GET“) erst nach einem sichtbaren Signal.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, reiter, alsPerson, mutanteEinsetzen } = require('./hilfen');
const lauf = require('./laeufe-hilfen');

const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const MENUE = '#fenster [role="menu"][data-art="ansicht"]';
const ANSICHT_LAEUFE = '#fenster .mod-body[aria-label="Ansicht: Läufe"]';
const ANSICHT_INHALT = '#fenster .mod-body[data-ansicht="inhalt"]';
const ZEILEN = `${ANSICHT_LAEUFE} .lf-tab tbody tr`;
const STATUS = '#laeufe-status';
const HINWEIS = `${ANSICHT_LAEUFE} [role="note"]`;

/** Sichtbarer Text je Zelle jeder Zeile (ohne den Text nur zum Vorlesen in `.vh`). */
const alleZellen = page => page.locator(ZEILEN).evaluateAll(trs => trs.map(tr => [...tr.children].map(zelle => {
  const kopie = zelle.cloneNode(true);
  kopie.querySelectorAll('.vh').forEach(v => v.remove());
  return kopie.textContent.replace(/\u00a0/g, ' ');
})));
/** Die sechs Zeilen von #1 (R00219 AK 4): Zeitpunkt, Rolle, Spalte samt Nebentext, Betrag, Zustandswort. */
const SECHS = [
  ['20.11.2026 12:00', 'entwicklertester', 'Entwicklertest', '0,30 $', 'kein Transkript abgelegt'],
  ['20.11.2026 11:00', 'code-reviewer', 'Reviews', '—', 'liegt nicht auf diesem Rechner'],
  ['20.11.2026 10:00', 'entwickler', 'EntwicklungKosten gebucht in Reviews', '1,80 $', ''],
  ['20.11.2026 09:00', 'planer', 'Detailplanung', '0,42 $', ''],
  ['20.11.2026 08:00', 'architekt', 'Architektur', '0,55 $', 'Datei weicht vom abgelegten Stand ab'],
  ['—', '—', '—', '—', 'Eintrag nicht lesbar'],
];

/** Zählt die GET-Aufrufe `…/transkripte` der Aufgabe `nr` (ohne Herunterladen einzelner Transkripte). */
function zaehlen(page, nr) {
  const aufrufe = [];
  page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === `/api/aufgaben/${nr}/transkripte`) aufrufe.push(r.url()); });
  return aufrufe;
}

test.describe('R00219 Ansicht „Läufe“', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lauf.MENSCH);
    k = await kanbanStarten(lauf.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1, board = 'fabrik') {
    await page.goto(`${k.adresse}#/board/${board}/aufgabe/${nr}`);
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
    await liveBereit(page);
  }
  const ausloeser = page => page.locator(AUSLOESER);
  const menue = page => page.locator(MENUE);
  const menueNamen = page => menue(page).getByRole('menuitemradio').evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
  async function menueOeffnen(page) { await ausloeser(page).click(); await menue(page).waitFor(); }

  /* ── AK 3 Ort und Sichtbarkeit ── */

  test('AK 3: #1 mit Kosten und ohne Commits nennt „…, Datei, Kosten, Läufe, Verlauf“; #5 mit Commit-Verweis „…, Kosten, Commits, Läufe, Verlauf“', async ({ page }) => {
    await oeffnen(page, 1);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Läufe', 'Verlauf']);
    await page.keyboard.press('Escape');
    await oeffnen(page, 5);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Commits', 'Läufe', 'Verlauf']);
  });

  test('AK 3 · US-4: #2 nur mit Kosten hat kein „Läufe“, und es wird kein GET …/transkripte gesendet (geprüft bei sichtbarem Menü)', async ({ page }) => {
    const gelesen = zaehlen(page, 2);
    await oeffnen(page, 2);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']);
    expect(gelesen).toEqual([]);
  });

  test('AK 3 · US-4: werden an #1 alle Transkripte über die API gelöscht, während „Läufe“ offen ist, zeigt das Fenster „Inhalt“ und der Fokus steht auf „Ansicht: Inhalt“', async ({ page }) => {
    await oeffnen(page, 1);
    await reiter(page, 'Läufe');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Läufe');
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    for (const kennung of [lauf.L.L1, lauf.L.L2, lauf.L.L3, lauf.L.L5]) await lauf.entfernen(k.adresse, 1, kennung);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(ANSICHT_LAEUFE)).toHaveCount(0);
    await expect(page.locator(ANSICHT_INHALT)).toBeVisible();
    await expect(ausloeser(page)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  });

  /* ── AK 4 Zeilen, Zustände, Reihenfolge ── */

  async function laeufeOeffnen(page, nr = 1, board = 'fabrik') {
    await oeffnen(page, nr, board);
    await reiter(page, 'Läufe');
    await expect(page.locator(STATUS)).toHaveText(/ Läufe? · Stand /);
  }

  test('AK 4 · US-1 · US-2: #1 zeigt L4, L3, L2, L1, L5, L6 mit Zeitpunkt, Rolle, Spalte, Betrag und Zustand', async ({ page }) => {
    await laeufeOeffnen(page);
    await expect(page.locator(ZEILEN)).toHaveCount(6);
    expect(await alleZellen(page)).toEqual(SECHS);
    expect((await page.locator(STATUS).textContent()).replace(/\d{2}:\d{2}:\d{2}$/, 'hh:mm:ss')).toBe('6 Läufe · Stand hh:mm:ss');
  });

  test('AK 4: vorgelesen — L1 und L2 nennen „Transkript vorhanden“, L3 und L6 „kein Betrag“, L6 „kein Zeitpunkt“, „keine Rolle“, „keine Spalte“; kein „—“', async ({ page }) => {
    await laeufeOeffnen(page);
    const zeilen = page.locator(ZEILEN);
    const baum = i => zeilen.nth(i).ariaSnapshot();
    for (const i of [2, 3]) expect(await baum(i)).toContain('Transkript vorhanden');
    for (const i of [1, 5]) expect(await baum(i)).toContain('kein Betrag');
    for (const wort of ['kein Zeitpunkt', 'keine Rolle', 'keine Spalte']) expect(await baum(5)).toContain(wort);
    for (let i = 0; i < 6; i++) expect(await baum(i)).not.toContain('—');
    for (const i of [0, 1, 4, 5]) expect(await baum(i)).not.toContain('Transkript vorhanden');
  });

  test('AK 4 · US-2: die Zustandswörter sind verschieden und sichtbar, die drei Marken tragen verschiedene Symbole, „kein Transkript abgelegt“ keines', async ({ page }) => {
    await laeufeOeffnen(page);
    const sichtbar = await page.locator(`${ANSICHT_LAEUFE} .lf-zs`).evaluateAll(zellen => zellen.map(z => {
      const wortknoten = z.querySelector('.cl-zs, .lf-ohne');
      if (!wortknoten) return null;
      const r = wortknoten.getBoundingClientRect();
      return { wort: wortknoten.textContent, sichtbar: !wortknoten.closest('.vh') && r.width > 0 && r.height > 0 && getComputedStyle(wortknoten).opacity !== '0', pfad: (wortknoten.querySelector('svg') || { innerHTML: null }).innerHTML };
    }).filter(Boolean));
    expect(sichtbar.map(w => w.wort)).toEqual(['kein Transkript abgelegt', 'liegt nicht auf diesem Rechner', 'Datei weicht vom abgelegten Stand ab', 'Eintrag nicht lesbar']);
    expect(sichtbar.every(w => w.sichtbar)).toBe(true);
    expect(sichtbar[0].pfad).toBeNull();
    const pfade = sichtbar.slice(1).map(w => w.pfad);
    expect(pfade.every(Boolean)).toBe(true);
    expect(new Set(pfade).size).toBe(3);
  });

  test('AK 4 · US-1: keine Zeile ist ein Ziel — kein a[href] in der Liste, ein Klick ändert weder Adresse noch Ansicht', async ({ page }) => {
    await laeufeOeffnen(page);
    await expect(page.locator(`${ANSICHT_LAEUFE} .lf-tab a[href]`)).toHaveCount(0);
    const adresse = page.url();
    for (let i = 0; i < 6; i++) await page.locator(ZEILEN).nth(i).click();
    expect(page.url()).toBe(adresse);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Läufe');
    await expect(page.locator(ZEILEN)).toHaveCount(6);
  });

  /* ── AK 5 Hinweis bei ausgeschaltetem Erfassen ── */

  test('AK 5 · US-5: #3 auf „zweit“ trägt den Hinweis über der Liste und die Zeile „kein Transkript abgelegt“; #1 keinen Hinweis', async ({ page }) => {
    await laeufeOeffnen(page, 3, 'zweit');
    await expect(page.locator(HINWEIS)).toHaveText('Auf „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.');
    const reihenfolge = await page.locator(`${ANSICHT_LAEUFE} [role="note"], ${ANSICHT_LAEUFE} .lf-rahmen`).evaluateAll(e => e.map(x => x.className));
    expect(reihenfolge).toEqual(['lf-hw', 'lf-rahmen']);
    const zeilen = await alleZellen(page);
    expect(zeilen[0]).toEqual(['21.11.2026 09:00', 'entwickler', 'Entwicklung', '0,20 $', 'kein Transkript abgelegt']);
    await laeufeOeffnen(page, 1);
    await expect(page.locator(ZEILEN)).toHaveCount(6);
    await expect(page.locator(HINWEIS)).toHaveCount(0);
  });

  for (const [boards, text] of [
    [['zweit', 'dritt'], 'Auf „zweit“ und „dritt“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.'],
    [['zweit', 'dritt', 'viert'], 'Auf „zweit“, „dritt“ und „viert“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.'],
    [['viert', 'zweit'], 'Auf „viert“ und „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.'],
  ]) {
    test(`AK 5 · US-5: mehrere Boards ${JSON.stringify(boards)} — ganzer Text in der Reihenfolge der Antwort`, async ({ page }) => {
      await page.route('**/api/aufgaben/3/transkripte', async route => {
        const antwort = await route.fetch();
        await route.fulfill({ response: antwort, json: { ...(await antwort.json()), boards_aus: boards } });
      });
      await laeufeOeffnen(page, 3, 'zweit');
      await expect(page.locator(HINWEIS)).toHaveText(text);
    });
  }

  /* ── AK 8 Fremder Text ── */

  test('AK 8: #4 — Rolle aus 40 Zeichen zeichengleich, Spalte als Text ohne U+202E (36 Zeichen), kein img, window.pwn nicht gesetzt', async ({ page }) => {
    await laeufeOeffnen(page, 4);
    const zeilen = await alleZellen(page);
    expect(zeilen.some(z => z[1] === lauf.ROLLE_40)).toBe(true);
    const bereinigt = lauf.SPALTE_FREMD.replace('‮', '');
    expect(bereinigt).toHaveLength(36);
    expect(zeilen.some(z => z[2] === bereinigt)).toBe(true);
    await expect(page.locator('#fenster img')).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelectorAll('img').length + (window.pwn === undefined ? 0 : 1))).toBe(0);
    const mitZeichen = await page.locator(ANSICHT_LAEUFE).evaluate(wurzel => {
      const funde = [];
      const lauf = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      for (let n = wurzel; n; n = lauf.nextNode()) {
        if (n.nodeType === 3 && n.textContent.includes('‮')) funde.push('Text');
        if (n.nodeType === 1) for (const a of n.attributes) if (a.value.includes('‮')) funde.push(a.name);
      }
      return funde;
    });
    expect(mitZeichen).toEqual([]);
  });

  /* ── AK 4 1.000 Läufe am Stück ── */

  test('AK 4: 1.000 Transkripte und 1.000 Kosteneinträge — 1.000 Zeilen am Stück, kein zweites Lesen beim Scrollen, „1.000 Läufe“', async ({ page }) => {
    await k.stoppen();
    k = await kanbanStarten(lauf.ausgangslage({ tausend: true }));
    const gelesen = zaehlen(page, 7);
    await laeufeOeffnen(page, 7);
    await expect(page.locator(ZEILEN)).toHaveCount(1000);
    await expect(page.locator(STATUS)).toHaveText(/^1\.000 Läufe · Stand \d{2}:\d{2}:\d{2}$/);
    await page.locator(ZEILEN).last().scrollIntoViewIfNeeded();
    await expect(page.locator(ZEILEN).last()).toBeInViewport();
    await expect(page.locator(ZEILEN)).toHaveCount(1000);
    expect(gelesen).toHaveLength(1);
  });
});
