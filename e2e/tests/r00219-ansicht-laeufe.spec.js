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

/** Hält jedes `GET …/transkripte` der Aufgabe `nr`, bis `freigeben(wie)` es beantwortet: `'weiter'` (Server), eine Zahl (Fehler mit
 *  diesem Status und `{fehler}`) oder `'abbruch'` (keine Verbindung). `anzahl()` zählt die gesendeten Aufrufe. */
async function anhalten(page, nr) {
  const wartend = [];
  let anzahl = 0;
  await page.route(`**/api/aufgaben/${nr}/transkripte`, async route => {
    if (route.request().method() !== 'GET') return route.continue();
    anzahl++;
    const wie = await new Promise(r => wartend.push(r));
    if (wie === 'weiter') return route.continue();
    if (wie === 'abbruch') return route.abort('connectionrefused');
    return route.fulfill({ status: wie, json: { fehler: 'Dienst nicht verfügbar' } });
  });
  return {
    anzahl: () => anzahl,
    gehalten: () => wartend.length,
    /** Beantwortet das gehaltene Lesen an Stelle `welches` (0 = das älteste). */
    freigeben: async (wie = 'weiter', welches = 0) => {
      await expect.poll(() => wartend.length, 'ein Lesen ist gehalten').toBeGreaterThan(welches);
      wartend.splice(welches, 1)[0](wie);
    },
  };
}
/** Gibt eine gehaltene Antwort frei und wartet, bis die Seite sie hat und ein Bild gezeichnet ist — erst danach prüft eine Verneinung. */
async function spaetBeantwortet(page, nr, freigeben) {
  const angekommen = page.waitForResponse(r => new URL(r.url()).pathname === `/api/aufgaben/${nr}/transkripte`);
  await freigeben();
  await (await angekommen).finished();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => window.kdTest.gezeichnet());
}
const FEHLER_503 = 'Die Läufe ließen sich nicht lesen: Dienst nicht verfügbar (503).';
const OHNE_VERBINDUNG = 'Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.';
const STATUS_FEHLER = 'Die Läufe ließen sich nicht lesen.';
const KOSTENZEILEN_BEI_FEHLER = [
  ['20.11.2026 12:00', 'entwicklertester', 'Entwicklertest', '0,30 $', 'Transkript nicht gelesen'],
  ['20.11.2026 10:00', 'entwickler', 'Reviews', '1,80 $', 'Transkript nicht gelesen'],
  ['20.11.2026 09:00', 'planer', 'Detailplanung', '0,42 $', 'Transkript nicht gelesen'],
  ['20.11.2026 08:00', 'architekt', 'Architektur', '0,55 $', 'Transkript nicht gelesen'],
];

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

  /* ── AK 6 Live und genau ein Lesen ── */

  const MELDUNG = `${ANSICHT_LAEUFE} .lf-meld`;
  const NEU = '#laeufe-neu';
  const ERNEUT = '#laeufe-erneut';
  /** Öffnet „Läufe“ an `nr` mit gehaltenem Lesen und gibt das erste Lesen frei (`wie`). */
  async function gehaltenOeffnen(page, nr = 1, wie = 'weiter', board = 'fabrik') {
    const h = await anhalten(page, nr);
    await oeffnen(page, nr, board);
    await reiter(page, 'Läufe');
    await h.freigeben(wie);
    await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
    return h;
  }
  const zeileVon = (page, rolle) => page.locator(ZEILEN).filter({ has: page.locator('.lf-ro', { hasText: new RegExp(`^${rolle}$`) }) });

  test('AK 6: beim Öffnen genau ein GET …/transkripte, „Neu lesen“ genau ein weiteres', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await expect(page.locator(ZEILEN)).toHaveCount(6);
    expect(h.anzahl()).toBe(1);
    await page.locator(NEU).click();
    await h.freigeben();
    await expect(page.locator(STATUS)).toHaveText(/^6 Läufe · Stand /);
    expect(h.anzahl()).toBe(2);
  });

  for (const breite of [320, 1280]) {
    test(`AK 6: erstes Öffnen bei ${breite} px — solange gehalten, keine Zeile und keine Meldung, „Liest die Läufe …“, „Neu lesen“ gesperrt; danach sechs Zeilen`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 900 });
      const h = await anhalten(page, 1);
      await oeffnen(page);
      await reiter(page, 'Läufe');
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      await expect(page.locator(NEU)).toHaveAttribute('aria-disabled', 'true');
      await expect(page.locator(ZEILEN)).toHaveCount(0);
      await expect(page.locator(MELDUNG)).toHaveCount(0);
      await expect(page.locator(`${ANSICHT_LAEUFE} .cl-leer`)).toHaveCount(0);
      await h.freigeben();
      await expect(page.locator(ZEILEN)).toHaveCount(6);
      await expect(page.locator(NEU)).not.toHaveAttribute('aria-disabled', 'true');
    });
  }

  test('AK 6 · US-3: bucht entw1 für L3 0,25 USD, zeigt L3 „0,25 $“ ohne neues GET …/transkripte', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await lauf.buchen(k.adresse, 1, lauf.L.L3, 'Reviews', 0.25);
    await expect(zeileVon(page, 'code-reviewer').locator('.lf-be')).toHaveText('0,25 $');
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    expect(h.anzahl()).toBe(1);
  });

  test('AK 6 · US-3: legt entw1 ein Transkript für L4 ab, folgt genau ein GET; solange gehalten bleibt L4 „kein Transkript abgelegt“', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await lauf.ablegen(k.adresse, 1, lauf.L.L4, 'Entwicklertest');
    await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
    expect(h.anzahl()).toBe(2);
    await expect(zeileVon(page, 'entwicklertester').locator('.lf-zs')).toHaveText('kein Transkript abgelegt');
    await h.freigeben();
    await expect(page.locator(STATUS)).toHaveText(/^6 Läufe · Stand /);
    await expect(zeileVon(page, 'entwicklertester').locator('.lf-zs')).toHaveText('Transkript vorhanden');
    await expect(zeileVon(page, 'entwicklertester').locator('.lf-ohne')).toHaveCount(0);
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    expect(h.anzahl()).toBe(2);
  });

  test('AK 6: löscht entw1 das Transkript von L1, folgt genau ein GET, und L1 steht als „kein Transkript abgelegt“', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await lauf.entfernen(k.adresse, 1, lauf.L.L1);
    await h.freigeben();
    await expect(zeileVon(page, 'planer').locator('.lf-zs')).toHaveText('kein Transkript abgelegt');
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    expect(h.anzahl()).toBe(2);
  });

  test('AK 6 · US-3: ein Kommentar von sh an #1 löst kein GET …/transkripte aus (geprüft, nachdem der Kommentar im Stand gezeichnet ist)', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await lauf.kommentieren(k.adresse, 1, 'Ein Kommentar');
    await page.waitForFunction(() => window.kdTest.kommentare(1) === 1 && window.kdTest.gezeichnet());
    await expect(page.locator(STATUS)).toHaveText(/^6 Läufe · Stand /);
    expect(h.anzahl()).toBe(1);
  });

  test('AK 6: wird die Datei von L2 im Ordner gelöscht, zeigt L2 „liegt nicht auf diesem Rechner“ erst nach „Neu lesen“', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    require('fs').rmSync(require('path').join(k.ordner, 'transkripte/0001', lauf.dateiname(lauf.L.L2)));
    await expect(zeileVon(page, 'entwickler').locator('.lf-zs')).toHaveText('Transkript vorhanden');
    await page.locator(NEU).click();
    await h.freigeben();
    await expect(zeileVon(page, 'entwickler').locator('.lf-zs')).toHaveText('liegt nicht auf diesem Rechner');
  });

  /* ── AK 7 Späte Antwort und Fehler ── */

  test('AK 7: die gehaltene Antwort für #1 zeichnet nach dem Wechsel auf #3 nichts — #3 zeigt nur seine Zeilen und seinen Hinweis', async ({ page }) => {
    const h1 = await anhalten(page, 1);
    const gelesen3 = zaehlen(page, 3);
    await oeffnen(page, 1);
    await reiter(page, 'Läufe');
    await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
    await page.goto(`${k.adresse}#/board/zweit/aufgabe/3`);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #3' })).toBeVisible();
    await expect(page.locator(HINWEIS)).toBeVisible();
    await page.evaluate(() => {
      window.kdFremdeZeile = false;
      new MutationObserver(() => { if (document.querySelector('#fenster .lf-tab .lf-ro')?.closest('tbody').textContent.includes('planer')) window.kdFremdeZeile = true; })
        .observe(document.body, { subtree: true, childList: true, characterData: true });
    });
    await spaetBeantwortet(page, 1, () => h1.freigeben());
    expect(await page.evaluate(() => window.kdFremdeZeile), 'keine Zeile von #1 ist je gezeichnet').toBe(false);
    expect(gelesen3).toHaveLength(1);
    await expect(page.locator(ZEILEN)).toHaveCount(2);
    expect((await alleZellen(page)).map(z => z[1])).toEqual(['entwickler', 'entwickler']);
    await expect(page.locator(HINWEIS)).toHaveText(/„zweit“/);
  });

  test('AK 7: die gehaltene Antwort zeichnet nach dem Wechsel auf „Inhalt“ nichts — „Inhalt“ bleibt', async ({ page }) => {
    const h = await anhalten(page, 1);
    await oeffnen(page, 1);
    await reiter(page, 'Läufe');
    await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
    await reiter(page, 'Inhalt');
    await expect(page.locator(ANSICHT_INHALT)).toBeVisible();
    await spaetBeantwortet(page, 1, () => h.freigeben());
    await expect(page.locator(ANSICHT_INHALT)).toBeVisible();
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
  });

  test('AK 7: zwei Lesungen in Folge, deren erste zuletzt antwortet — es gilt die zweite', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await lauf.ablegen(k.adresse, 1, lauf.L.L4, 'Entwicklertest');
    await expect.poll(() => h.gehalten()).toBe(1);
    await lauf.entfernen(k.adresse, 1, lauf.L.L1);
    await expect.poll(() => h.gehalten()).toBe(2);
    await h.freigeben('weiter', 1);
    await expect(zeileVon(page, 'planer').locator('.lf-zs')).toHaveText('kein Transkript abgelegt');
    await expect(zeileVon(page, 'entwicklertester').locator('.lf-zs')).toHaveText('Transkript vorhanden');
    await spaetBeantwortet(page, 1, () => h.freigeben(503));
    await expect(page.locator(MELDUNG)).toHaveCount(0);
    await expect(page.locator(STATUS)).toHaveText(/^6 Läufe · Stand /);
    expect(h.anzahl()).toBe(3);
  });

  test('AK 7 · US-6: 503 — Meldung mit „Erneut versuchen“, die Kosteneinträge mit Betrag und „Transkript nicht gelesen“; ein Klick liest genau einmal', async ({ page }) => {
    const h = await gehaltenOeffnen(page, 1, 503);
    await expect(page.locator(MELDUNG)).toHaveText(`${FEHLER_503}Erneut versuchen`);
    expect(await alleZellen(page)).toEqual(KOSTENZEILEN_BEI_FEHLER);
    await expect(page.locator(`${ANSICHT_LAEUFE}`)).not.toContainText('kein Transkript abgelegt');
    await expect(page.locator(STATUS)).toHaveText(STATUS_FEHLER);
    await page.locator(ERNEUT).click();
    await h.freigeben();
    await expect(page.locator(ZEILEN)).toHaveCount(6);
    await expect(page.locator(MELDUNG)).toHaveCount(0);
    expect(h.anzahl()).toBe(2);
  });

  test('AK 7: ohne Verbindung — eigener Satz mit „Erneut versuchen“, dieselben vier Kostenzeilen, Statusbereich meldet den Fehler', async ({ page }) => {
    await gehaltenOeffnen(page, 1, 'abbruch');
    await expect(page.locator(MELDUNG)).toHaveText(`${OHNE_VERBINDUNG}Erneut versuchen`);
    expect(await alleZellen(page)).toEqual(KOSTENZEILEN_BEI_FEHLER);
    await expect(page.locator(STATUS)).toHaveText(STATUS_FEHLER);
  });

  for (const wie of [503, 'abbruch']) {
    test(`AK 7 · US-7: Fehler (${wie}) beim selbsttätigen Lesen nach früherem Erfolg — bis zur Antwort die alten Zeilen, danach das Fehlerbild; der Fokus bleibt auf „Neu lesen“`, async ({ page }) => {
      const h = await gehaltenOeffnen(page);
      await expect(page.locator(ZEILEN)).toHaveCount(6);
      await page.locator(NEU).focus();
      const knoten = await page.locator(NEU).elementHandle();
      await lauf.ablegen(k.adresse, 1, lauf.L.L4, 'Entwicklertest');
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      expect(await alleZellen(page)).toEqual(SECHS);
      expect(await knoten.evaluate(n => n === document.activeElement)).toBe(true);
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).toHaveText(STATUS_FEHLER);
      await expect(page.locator(MELDUNG)).toHaveText(`${wie === 503 ? FEHLER_503 : OHNE_VERBINDUNG}Erneut versuchen`);
      expect(await alleZellen(page)).toEqual(KOSTENZEILEN_BEI_FEHLER);
      expect(await knoten.evaluate(n => n === document.activeElement && n.isConnected)).toBe(true);
    });
  }

  /* ── AK 10 Fokus bei „Erneut versuchen“ und „Neu lesen“ (UX-Vorprüfung M1, Bild 7, PO Z. 478–479) ── */

  /** Merkt einen Knoten in der Seite unter `name`, damit die Probe später `===` prüfen kann. */
  const merken = (page, selektor, name) => page.locator(selektor).evaluate((n, nm) => { window[nm] = n; }, name);
  const istGemerkt = (page, selektor, name) => page.locator(selektor).evaluate((n, nm) => n === window[nm], name);
  const fokusIst = (page, name) => page.evaluate(nm => document.activeElement === window[nm], name);
  const nieBody = page => page.evaluate(() => document.activeElement !== document.body && document.activeElement !== null);

  /** Tab vom Auslöser „Ansicht: Läufe“ vorwärts, bis `selektor` den Fokus hat (Tastatur, nicht `focus()`). */
  async function perTab(page, selektor) {
    await ausloeser(page).focus();
    for (let i = 0; i < 40 && !(await page.locator(selektor).evaluate(n => n === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(page.locator(selektor)).toBeFocused();
  }

  for (const [wie, ende] of [['weiter', 'Erfolg'], [503, '503'], ['abbruch', 'ohne Verbindung']]) {
    test(`AK 10 · US-6: Enter auf „Erneut versuchen“ — derselbe Knoten, gesperrt, behält den Fokus, ein zweites Enter liest nicht; danach ${ende}`, async ({ page }) => {
      const h = await gehaltenOeffnen(page, 1, 503);
      await perTab(page, ERNEUT);
      await merken(page, ERNEUT, 'kdErneut');
      await page.keyboard.press('Enter');
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      await expect(page.locator(MELDUNG)).toHaveText(`${FEHLER_503}Erneut versuchen`);
      expect(await istGemerkt(page, ERNEUT, 'kdErneut')).toBe(true);
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
      expect(await fokusIst(page, 'kdErneut')).toBe(true);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.kdTest.gezeichnet());
      expect(h.anzahl()).toBe(2);
      await h.freigeben(wie);
      if (wie === 'weiter') {
        await expect(page.locator(ZEILEN)).toHaveCount(6);
        await expect(page.locator(MELDUNG)).toHaveCount(0);
        await expect(page.locator(NEU)).toBeFocused();
      } else {
        await expect(page.locator(STATUS)).toHaveText(STATUS_FEHLER);
        await expect(page.locator(ERNEUT)).not.toHaveAttribute('aria-disabled', 'true');
        expect(await istGemerkt(page, ERNEUT, 'kdErneut')).toBe(true);
        expect(await fokusIst(page, 'kdErneut')).toBe(true);
      }
      expect(await nieBody(page)).toBe(true);
    });
  }

  for (const wie of ['weiter', 503]) {
    test(`AK 10: setzt sh den Fokus während des Haltens mit Umschalt+Tab auf „Ansicht: Läufe“, steht er nach der Freigabe (${wie}) dort`, async ({ page }) => {
      const h = await gehaltenOeffnen(page, 1, 503);
      await perTab(page, ERNEUT);
      await page.keyboard.press('Enter');
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
      for (let i = 0; i < 40 && !(await ausloeser(page).evaluate(n => n === document.activeElement)); i++) await page.keyboard.press('Shift+Tab');
      await expect(ausloeser(page)).toBeFocused();
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
      await expect(ausloeser(page)).toBeFocused();
      expect(await nieBody(page)).toBe(true);
    });
  }

  test('AK 10: „Neu lesen“ ist vor, während und nach dem Lesen derselbe Knoten, gesperrt beim Lesen, Enter liest dann nicht; der Fokus bleibt', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await perTab(page, NEU);
    await merken(page, NEU, 'kdNeu');
    await page.keyboard.press('Enter');
    await expect(page.locator(NEU)).toHaveAttribute('aria-disabled', 'true');
    expect(await istGemerkt(page, NEU, 'kdNeu')).toBe(true);
    expect(await fokusIst(page, 'kdNeu')).toBe(true);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    expect(h.anzahl()).toBe(2);
    await h.freigeben();
    await expect(page.locator(NEU)).not.toHaveAttribute('aria-disabled', 'true');
    expect(await istGemerkt(page, NEU, 'kdNeu')).toBe(true);
    expect(await fokusIst(page, 'kdNeu')).toBe(true);
  });

  test('AK 10: hat sh den Fokus nach „Neu lesen“ weitergesetzt, bleibt er dort', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await perTab(page, NEU);
    await page.keyboard.press('Enter');
    await expect(page.locator(NEU)).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Shift+Tab');
    const ziel = await page.evaluate(() => { window.kdZiel = document.activeElement; return document.activeElement.id || document.activeElement.className; });
    expect(await page.locator(NEU).evaluate(n => n === document.activeElement)).toBe(false);
    await h.freigeben();
    await expect(page.locator(NEU)).not.toHaveAttribute('aria-disabled', 'true');
    expect(await page.evaluate(() => document.activeElement === window.kdZiel || document.activeElement.id === window.kdZiel.id), ziel).toBe(true);
    expect(await nieBody(page)).toBe(true);
  });

  for (const wie of ['weiter', 503, 'abbruch']) {
    test(`AK 10 · US-7: ein selbsttätiges Lesen (${wie}) bewegt den Fokus nie — auf „Neu lesen“ derselbe Knoten, auf dem Auslöser bleibt er dort`, async ({ page }) => {
      const h = await gehaltenOeffnen(page);
      await perTab(page, NEU);
      await merken(page, NEU, 'kdNeu');
      await lauf.ablegen(k.adresse, 1, lauf.L.L4, 'Entwicklertest');
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      expect(await fokusIst(page, 'kdNeu')).toBe(true);
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
      expect(await fokusIst(page, 'kdNeu')).toBe(true);
      await ausloeser(page).focus();
      await lauf.entfernen(k.adresse, 1, lauf.L.L1);
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      await expect(ausloeser(page)).toBeFocused();
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
      await expect(ausloeser(page)).toBeFocused();
      expect(await nieBody(page)).toBe(true);
    });
  }
});
