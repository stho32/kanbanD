// R00219 Ansicht „Läufe“ im Aufgabenfenster (Karte #217, I0209, Scheibe D1) — AK 3–10 im echten Programm.
// Ausgangslage und Hilfen: laeufe-hilfen.js (Boards `fabrik` erfassend und `zweit` ausgeschaltet, Aufgaben #1–#6).
// Zeitproben deterministisch: Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten;
// jede Verneinung („kein GET“) erst nach einem sichtbaren Signal.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, reiter, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen, kontrastFarben, kontrastAm } = require('./hilfen');
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
    await expect(page.locator(STATUS)).toHaveText(/ (Lauf|Läufe) · Stand /);
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

  /* ── AK 9 Breite, Tabelle und Ziele ── */

  const BREITEN = [320, 414, 640, 641, 768, 980, 1099, 1100, 1280];
  /** Stellt an #4 einen Zustand her: Liste mit Hinweis (zwei Boards, eines aus 60 Zeichen), Laden, Fehler, Fehler liest erneut. */
  async function zustandAn4(page, zustand) {
    const wartend = [];
    await page.route('**/api/aufgaben/4/transkripte', async route => {
      const wie = await new Promise(r => wartend.push(r));
      if (wie === 503) return route.fulfill({ status: 503, json: { fehler: 'Dienst nicht verfügbar' } });
      const antwort = await route.fetch();
      await route.fulfill({ response: antwort, json: { ...(await antwort.json()), boards_aus: ['zweit', lauf.BOARD_60] } });
    });
    const gehalten = { freigeben: async wie => { await expect.poll(() => wartend.length).toBeGreaterThan(0); wartend.shift()(wie); } };
    await oeffnen(page, 4);
    await reiter(page, 'Läufe');
    if (zustand === 'Laden') return expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
    if (zustand === 'Liste' || zustand === 'Hinweis') {
      await gehalten.freigeben('weiter');
      return expect(page.locator(HINWEIS)).toBeVisible();
    }
    await gehalten.freigeben(503);
    await expect(page.locator(MELDUNG)).toBeVisible();
    if (zustand === 'Fehler liest erneut') {
      await page.locator(ERNEUT).click();
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
    }
  }
  /** Im Browser: Querscrollen von Seite und Fenster und jeder lange Text in seiner eigenen Zelle bzw. seinem Block (Toleranz 1 px). */
  const breiteImBrowser = ({ rolle, spalte, board }) => {
    const de = document.documentElement, fenster = document.getElementById('fenster');
    const aus = [];
    if (de.scrollWidth > de.clientWidth) aus.push(`Seite ${de.scrollWidth} > ${de.clientWidth}`);
    if (fenster.scrollWidth > fenster.clientWidth) aus.push(`Fenster ${fenster.scrollWidth} > ${fenster.clientWidth}`);
    const inEigenerZelle = (knoten, zelle, was) => {
      const r = document.createRange(); r.selectNodeContents(knoten);
      const z = zelle.getBoundingClientRect();
      for (const t of r.getClientRects()) if (t.left < z.left - 1 || t.right > z.right + 1 || t.top < z.top - 1 || t.bottom > z.bottom + 1) aus.push(`${was} ragt aus ${zelle.className}: ${Math.round(t.left)}–${Math.round(t.right)} statt ${Math.round(z.left)}–${Math.round(z.right)}`);
    };
    const textknoten = (wurzel, text) => { const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT); for (let t; (t = w.nextNode());) if (t.textContent.includes(text)) return t; return null; };
    const panel = document.querySelector('#fenster .lf-panel');
    for (const zelle of panel.querySelectorAll('.lf-ro')) { const t = textknoten(zelle, rolle); if (t) inEigenerZelle(t, zelle, 'Rolle'); }
    for (const zelle of panel.querySelectorAll('.lf-sp')) {
      for (const kind of zelle.childNodes) if (kind.nodeType === 3 && kind.textContent.includes(spalte)) inEigenerZelle(kind, zelle, 'Spalte');
      const neben = zelle.querySelector('.lf-neben'); if (neben) { inEigenerZelle(neben, zelle, 'Nebentext'); inEigenerZelle(neben, neben, 'Nebentext im Block'); }
    }
    const hw = panel.querySelector('.lf-hw'); if (hw) { const t = textknoten(hw, board); if (t) inEigenerZelle(t, hw, 'Boardname'); }
    return aus;
  };
  const kopfSichtbar = page => page.locator(`${ANSICHT_LAEUFE} .lf-tab thead`).evaluate(kopf => { const r = kopf.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(kopf).clipPath === 'none'; });

  for (const farbe of ['hell', 'dunkel']) {
    for (const zustand of ['Liste', 'Laden', 'Fehler', 'Fehler liest erneut']) {
      test(`AK 9: #4 ${zustand}, ${farbe} — bei neun Breiten kein Querscrollen, jeder lange Text in seiner Zelle, Kopfzeile nur ab 1100 px`, async ({ page }) => {
        await zustandAn4(page, zustand);
        await thema(page, farbe === 'hell' ? 'light' : 'dark');
        for (const breite of BREITEN) {
          await breiteSetzen(page, breite);
          expect(await page.evaluate(breiteImBrowser, { rolle: lauf.ROLLE_40, spalte: lauf.SPALTE_60, board: lauf.BOARD_60 }), `${zustand} ${farbe} ${breite} px`).toEqual([]);
          if (zustand !== 'Laden') expect(await kopfSichtbar(page), `${breite} px Kopfzeile`).toBe(breite >= 1100);
        }
      });
    }
  }

  test('AK 9: #3 mit Hinweis — bei neun Breiten kein Querscrollen', async ({ page }) => {
    await laeufeOeffnen(page, 3, 'zweit');
    for (const breite of BREITEN) {
      await breiteSetzen(page, breite);
      expect(await page.evaluate(breiteImBrowser, { rolle: '—', spalte: '—', board: 'zweit' }), `${breite} px`).toEqual([]);
    }
  });

  for (const breite of [320, 1280]) {
    test(`AK 9: Tabelle für Vorlesende bei ${breite} px — eine table „Läufe dieser Aufgabe, neueste zuerst“ mit sechs Zeilen, fünf Spaltenköpfen, Zeitpunkt als Zeilenkopf`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 900 });
      await laeufeOeffnen(page);
      const tabelle = page.getByRole('table', { name: 'Läufe dieser Aufgabe, neueste zuerst' });
      await expect(tabelle).toHaveCount(1);
      await expect(tabelle.getByRole('columnheader')).toHaveText(['Zeitpunkt', 'Rolle', 'Spalte', 'Betrag', 'Transkript']);
      const daten = tabelle.getByRole('row').filter({ has: page.getByRole('rowheader') });
      await expect(daten).toHaveCount(6);
      for (let i = 0; i < 6; i++) await expect(daten.nth(i).getByRole('rowheader')).toHaveAccessibleName(SECHS[i][0] === '—' ? 'kein Zeitpunkt' : SECHS[i][0]);
    });
  }

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
    test('AK 9: bei grobem Zeiger ist jedes Bedienziel mindestens 48 × 48 px — „Läufe“ im Menü, „Neu lesen“, „Erneut versuchen“', async ({ page }) => {
      const h = await anhalten(page, 1);
      await oeffnen(page);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      await menueOeffnen(page);
      const masse = loc => loc.evaluate(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; });
      const eintrag = menue(page).getByRole('menuitemradio', { name: 'Läufe', exact: true });
      expect((await masse(eintrag))[1]).toBeGreaterThanOrEqual(47.5);
      expect((await masse(eintrag))[0]).toBeGreaterThanOrEqual(47.5);
      await eintrag.click();
      await h.freigeben(503);
      await expect(page.locator(ERNEUT)).toBeVisible();
      for (const ziel of [page.locator(NEU), page.locator(ERNEUT)]) {
        const [b, hoehe] = await masse(ziel);
        expect(b, await ziel.innerText()).toBeGreaterThanOrEqual(47.5);
        expect(hoehe, await ziel.innerText()).toBeGreaterThanOrEqual(47.5);
      }
    });
  });

  /* ── AK 10 Themen, Tastatur, Fokusring, Ansage ── */

  const SCHRIFT = 4.5, MARKE = 3, GESPERRT = 3;
  /** Text der Ansicht ≥ 4,5:1 (gesperrte Knöpfe ≥ 3:1, WCAG 1.4.3 inaktive Komponenten, UX-Nachprüfung S-A); Rand und Symbol jeder Marke ≥ 3:1. */
  async function kontrastPruefen(page, wo) {
    const messungen = await kontrastMessen(page, [ANSICHT_LAEUFE]);
    expect(messungen.length, `${wo}: es gibt Text zu messen`).toBeGreaterThanOrEqual(3);
    const zuWenig = messungen.filter(m => m.wert < SCHRIFT).map(m => `${wo}: ${m.element} „${String(m.text).slice(0, 30)}“ ${m.wert.toFixed(2)}`);
    for (const gesperrt of await page.locator(`${ANSICHT_LAEUFE} [aria-disabled="true"]`).all()) {
      const wert = await kontrastAm(gesperrt);
      if (wert < GESPERRT) zuWenig.push(`${wo}: gesperrt „${await gesperrt.innerText()}“ ${wert.toFixed(2)}`);
    }
    const marken = await page.evaluate(() => [...document.querySelectorAll('#fenster .lf-panel .cl-zs, #fenster .lf-panel .cl-meld')].map(m => {
      const st = getComputedStyle(m);
      let grund = m.parentElement;
      while (grund && getComputedStyle(grund).backgroundColor === 'rgba(0, 0, 0, 0)') grund = grund.parentElement;
      const aussen = grund ? getComputedStyle(grund).backgroundColor : getComputedStyle(document.getElementById('fenster')).backgroundColor;
      const svg = m.querySelector('svg');
      return { text: m.textContent.slice(0, 24), rand: st.borderTopColor, flaeche: st.backgroundColor, tinte: svg ? getComputedStyle(svg).stroke === 'none' ? st.color : getComputedStyle(svg).stroke : st.color, aussen };
    }));
    for (const m of marken) {
      const rand = await kontrastFarben(page, m.rand, m.aussen);
      if (rand < MARKE) zuWenig.push(`${wo}: Rand der Marke „${m.text}“ ${rand.toFixed(2)}`);
      const symbol = await kontrastFarben(page, m.tinte, m.flaeche);
      if (symbol < MARKE) zuWenig.push(`${wo}: Symbol der Marke „${m.text}“ ${symbol.toFixed(2)}`);
    }
    return { zuWenig, marken: marken.length };
  }
  for (const farbe of ['hell', 'dunkel']) {
    test(`AK 10: ${farbe} — Liste, Laden, Fehler, Fehler liest erneut und Hinweis: Text 4,5:1 (gesperrt 3:1), Marken 3:1`, async ({ page }) => {
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      await page.emulateMedia({ colorScheme: farbe === 'hell' ? 'light' : 'dark' });
      const ergebnisse = [];
      const h = await gehaltenOeffnen(page);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      const liste = await kontrastPruefen(page, `Liste ${farbe}`);
      expect(liste.marken).toBe(3);
      ergebnisse.push(...liste.zuWenig);
      await page.locator(NEU).click();
      await expect(page.locator(NEU)).toHaveAttribute('aria-disabled', 'true');
      ergebnisse.push(...(await kontrastPruefen(page, `Laden ${farbe}`)).zuWenig);
      await h.freigeben(503);
      await expect(page.locator(MELDUNG)).toBeVisible();
      ergebnisse.push(...(await kontrastPruefen(page, `Fehler ${farbe}`)).zuWenig);
      await page.locator(ERNEUT).click();
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
      ergebnisse.push(...(await kontrastPruefen(page, `Fehler liest erneut ${farbe}`)).zuWenig);
      await h.freigeben();
      await laeufeOeffnen(page, 3, 'zweit');
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      await expect(page.locator(HINWEIS)).toBeVisible();
      ergebnisse.push(...(await kontrastPruefen(page, `Hinweis ${farbe}`)).zuWenig);
      expect(ergebnisse).toEqual([]);
    });

    test(`AK 10: ${farbe} — Fokusring an „Läufe“ im Menü, „Neu lesen“ und „Erneut versuchen“ (auch gesperrt): solid, ≥ 2 px, ≥ 3:1 gegen die Fläche`, async ({ page }) => {
      const h = await anhalten(page, 1);
      await oeffnen(page);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      const ring = async (ort, wo) => {
        await expect(ort).toBeFocused();
        const r = await ort.evaluate(e => {
          const st = getComputedStyle(e);
          // ein Ring nach innen (negativer Versatz) liegt auf der eigenen Fläche, sonst auf der des ersten deckenden Vorfahren
          let grund = parseFloat(st.outlineOffset) < 0 ? e : e.parentElement;
          while (grund && getComputedStyle(grund).backgroundColor === 'rgba(0, 0, 0, 0)') grund = grund.parentElement;
          return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth), farbe: st.outlineColor, flaeche: grund ? getComputedStyle(grund).backgroundColor : '#fff' };
        });
        expect(r.stil, wo).toBe('solid');
        expect(r.breite, wo).toBeGreaterThanOrEqual(2);
        expect(await kontrastFarben(page, r.farbe, r.flaeche), wo).toBeGreaterThanOrEqual(3);
      };
      await ausloeser(page).focus();
      await page.keyboard.press('Enter');
      await menue(page).waitFor();
      const eintrag = menue(page).getByRole('menuitemradio', { name: 'Läufe', exact: true });
      for (let i = 0; i < 10 && !(await eintrag.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
      await ring(eintrag, 'Läufe im Menü');
      await page.keyboard.press('Enter');
      await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Läufe');
      await perTab(page, NEU);
      await ring(page.locator(NEU), 'Neu lesen gesperrt');
      await h.freigeben(503);
      await expect(page.locator(MELDUNG)).toBeVisible();
      await ring(page.locator(NEU), 'Neu lesen');
      await perTab(page, ERNEUT);
      await ring(page.locator(ERNEUT), 'Erneut versuchen');
      await page.keyboard.press('Enter');
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
      await ring(page.locator(ERNEUT), 'Erneut versuchen gesperrt');
    });
  }

  test('AK 10: Einzahl — #6 mit genau einem Transkript ohne Kosten meldet „1 Lauf · Stand hh:mm:ss“', async ({ page }) => {
    await laeufeOeffnen(page, 6);
    await expect(page.locator(STATUS)).toHaveText(/^1 Lauf · Stand \d{2}:\d{2}:\d{2}$/);
  });

  test('AK 10: der Statusbereich ist schon im Laden-Zustand derselbe Knoten wie nach dem Lesen, und das Fokusziel liegt in keiner Live-Region', async ({ page }) => {
    const h = await anhalten(page, 1);
    await oeffnen(page);
    await reiter(page, 'Läufe');
    await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
    await merken(page, STATUS, 'kdStatus');
    await h.freigeben();
    await expect(page.locator(STATUS)).toHaveText(/^6 Läufe · Stand /);
    expect(await istGemerkt(page, STATUS, 'kdStatus')).toBe(true);
    for (const ziel of [NEU]) expect(await page.locator(ziel).evaluate(e => e.closest('[role=status],[role=alert],[aria-live]') === null)).toBe(true);
    await page.route('**/api/aufgaben/1/transkripte', r => r.fulfill({ status: 503, json: { fehler: 'x' } }));
    await page.locator(NEU).click();
    await expect(page.locator(ERNEUT)).toBeVisible();
    for (const ziel of [NEU, ERNEUT]) expect(await page.locator(ziel).evaluate(e => e.closest('[role=status],[role=alert],[aria-live]') === null)).toBe(true);
    await expect(page.locator(`${MELDUNG} [role], ${MELDUNG}[role], ${MELDUNG} [aria-live], ${MELDUNG}[aria-live]`)).toHaveCount(0);
    expect(await page.locator(MELDUNG).evaluate(e => e.closest('[role=status],[role=alert],[aria-live]') === null)).toBe(true);
  });

  /** Zählt Textänderungen in Live-Regionen (`[role=status],[role=alert],[aria-live]`): Änderungen in ihrem Inhalt und neu eingefügte Regionen mit Text. */
  const ansagenZaehlen = page => page.evaluate(() => {
    if (window.kdBeobachter) window.kdBeobachter.disconnect();
    window.kdAnsagen = [];
    const LIVE = '[role=status],[role=alert],[aria-live]';
    const bekannt = new WeakSet(document.querySelectorAll(LIVE));
    const beobachter = new MutationObserver(eintraege => {
      for (const e of eintraege) {
        const ort = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        const region = ort && ort.closest(LIVE);
        if (region) { window.kdAnsagen.push(`${region.getAttribute('role') || 'live'}: ${region.textContent}`); continue; }
        for (const n of e.addedNodes) {
          if (n.nodeType !== 1) continue;
          for (const neu of [n, ...n.querySelectorAll(LIVE)].filter(x => x.matches(LIVE) && !bekannt.has(x) && x.textContent.trim())) {
            bekannt.add(neu);
            window.kdAnsagen.push(`${neu.getAttribute('role') || 'live'} neu: ${neu.textContent}`);
          }
        }
      }
    });
    beobachter.observe(document, { subtree: true, childList: true, characterData: true });
    window.kdBeobachter = beobachter;
  });
  const ansagen = page => page.evaluate(() => window.kdAnsagen);

  for (const [fall, wie, erwartet] of [['Erfolg', 'weiter', /^status: 6 Läufe · Stand \d{2}:\d{2}:\d{2}$/], ['503', 503, /^status: Die Läufe ließen sich nicht lesen\.$/], ['ohne Verbindung', 'abbruch', /^status: Die Läufe ließen sich nicht lesen\.$/]]) {
    test(`AK 10: genau eine Ansage im Statusbereich je Ereignis (${fall}) — beim ersten Lesen, nach „Erneut versuchen“ und nach einem selbsttätigen Lesen`, async ({ page }) => {
      const h = await anhalten(page, 1);
      await oeffnen(page);
      await reiter(page, 'Läufe');
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      await ansagenZaehlen(page);
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
      await page.waitForFunction(() => window.kdTest.gezeichnet());
      const erstes = await ansagen(page);
      expect(erstes, 'erstes Lesen').toHaveLength(1);
      expect(erstes[0]).toMatch(erwartet);
      if (wie !== 'weiter') {
        await page.locator(ERNEUT).click();
        await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
        await ansagenZaehlen(page);
        await h.freigeben(wie);
        await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
        await page.waitForFunction(() => window.kdTest.gezeichnet());
        const nachErneut = await ansagen(page);
        expect(nachErneut, 'nach „Erneut versuchen“').toHaveLength(1);
        expect(nachErneut[0]).toMatch(erwartet);
        await page.locator(ERNEUT).click();
        await h.freigeben('weiter');
        await expect(page.locator(STATUS)).toHaveText(/^6 Läufe/);
      }
      await lauf.ablegen(k.adresse, 1, lauf.L.L4, 'Entwicklertest');
      await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
      await ansagenZaehlen(page);
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).not.toHaveText('Liest die Läufe …');
      await page.waitForFunction(() => window.kdTest.gezeichnet());
      const selbst = await ansagen(page);
      expect(selbst, 'selbsttätiges Lesen').toHaveLength(1);
      expect(selbst[0]).toMatch(erwartet);
    });
  }

  test('AK 10 (UX-Nachprüfung S-B): ab dem Klick auf „Neu lesen“ zwei Änderungen im Statusbereich — „Liest die Läufe …“ und das Ergebnis', async ({ page }) => {
    const h = await gehaltenOeffnen(page);
    await ansagenZaehlen(page);
    await page.locator(NEU).click();
    await expect(page.locator(STATUS)).toHaveText('Liest die Läufe …');
    await h.freigeben();
    await expect(page.locator(STATUS)).toHaveText(/^6 Läufe/);
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    const alle = await ansagen(page);
    expect(alle).toHaveLength(2);
    expect(alle[0]).toBe('status: Liest die Läufe …');
  });
});
