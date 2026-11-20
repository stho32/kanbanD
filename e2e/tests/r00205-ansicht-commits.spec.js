// R00205 Ansicht „Commits“ im Aufgabenfenster (Karte #212, I0195, Scheibe B1) — AK 1–10 im echten Programm gegen echtes Git.
// Ausgangslage und Hilfen: commits-hilfen.js (Arbeits-Repository R, Register, Aufgaben #1–#5).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const { kanbanStarten, alsPerson, liveBereit, bereit, breiteSetzen, reiter, mutanteEinsetzen } = require('./hilfen');
const { geteiltesRepository, arbeitsRepositoryBauen, basisAnlegen, ausgangslageVorbereiten } = require('./commits-hilfen');

const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const MENUE = '#fenster [role="menu"][data-art="ansicht"]';
const ANSICHT_COMMITS = '#fenster .mod-body[aria-label="Ansicht: Commits"]';
const AGENT = { 'X-KanbanD-Wer': 'cl' };
const PANEL = ANSICHT_COMMITS;
const ZEILEN = `${PANEL} tbody tr.cl-z`;
const STATUS = '#commits-status';
const NEU_LESEN = '#commits-neu';
const kurz = h => `kd:${h.slice(0, 7)}`;
/** Die Zeile mit diesem Kurz-Hash (genau, nicht als Teilstring). */
const zeileMit = (page, text) => page.locator(ZEILEN).filter({ has: page.locator('th .cl-hash', { hasText: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
const kurzListe = page => page.locator(`${ZEILEN} th .cl-hash`).allInnerTexts();
/** Eine Antwort anhalten, bis `frei()` gerufen wird; `anzahl()` zählt die GET-Aufrufe der Aufgabe. */
async function anhalten(page, nr) {
  let frei; const tor = new Promise(r => { frei = r; });
  const aufrufe = [];
  await page.route(`**/api/aufgaben/${nr}/commits`, async route => {
    if (route.request().method() !== 'GET') return route.continue();
    aufrufe.push(route.request().headers());
    await tor;
    await route.continue();
  });
  return { frei, aufrufe };
}
function zaehlen(page, nr) {
  const aufrufe = [];
  page.on('request', r => { if (r.method() === 'GET' && new URL(r.url()).pathname === `/api/aufgaben/${nr}/commits`) aufrufe.push(r.headers()); });
  return aufrufe;
}

test.describe('R00205 Ansicht „Commits“', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    const geteilt = geteiltesRepository();
    rep = geteilt.rep;
    k = await kanbanStarten(ausgangslageVorbereiten(rep, geteilt.basis));
  });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  const ausloeser = page => page.locator(AUSLOESER);
  const menue = page => page.locator(MENUE);
  const eintraege = page => menue(page).getByRole('menuitemradio');
  const menueNamen = page => eintraege(page).evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
  async function menueOeffnen(page) { await ausloeser(page).click(); await menue(page).waitFor(); }

  /* ── AK 1 Ort und Sichtbarkeit ── */

  test('AK 1: #1 mit fünf Verweisen nennt „Commits“ zwischen „Datei“ und „Verlauf“, mit Preisetikett hinter „Kosten“', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Commits', 'Verlauf']);
    await page.keyboard.press('Escape');
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: AGENT, data: { cost: { currency: 'USD', amount: 1.63 } } })).ok()).toBe(true);
    await expect(async () => {
      if (await menue(page).count() === 0) await ausloeser(page).click();
      expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Commits', 'Verlauf']);
    }).toPass();
  });

  test('AK 1: #2 ohne Verweise hat keinen Eintrag und sendet kein GET …/commits (geprüft bei sichtbarem Menü)', async ({ page }) => {
    const gelesen = [];
    page.on('request', r => { if (r.method() === 'GET' && /\/api\/aufgaben\/\d+\/commits$/.test(new URL(r.url()).pathname)) gelesen.push(r.url()); });
    await oeffnen(page, 2);
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
    expect(gelesen).toEqual([]);
  });

  test('AK 1: fallen alle Verweise von #1 weg, entfällt der Eintrag, das Fenster zeigt „Inhalt“, der Fokus steht auf dem Auslöser', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Commits');
    await expect(page.locator(ANSICHT_COMMITS)).toBeVisible();
    const verweise = (await (await page.request.get(k.adresse + 'api/aufgaben/1')).json()).commits;
    expect(verweise).toHaveLength(5);
    for (const v of verweise) expect((await page.request.delete(k.adresse + 'api/aufgaben/1/commits/' + encodeURIComponent(v), { headers: AGENT })).ok()).toBe(true);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(ANSICHT_COMMITS)).toHaveCount(0);
    await expect(ausloeser(page)).toBeFocused();
    await menueOeffnen(page);
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
  });

  test('AK 1: bekommt #2 den ersten Verweis (Live), steht „Commits“ im Menü, und das Fenster bleibt auf „Inhalt“', async ({ page }) => {
    await oeffnen(page, 2);
    await liveBereit(page);
    expect((await page.request.post(k.adresse + 'api/aufgaben/2/commits', { headers: AGENT, data: { commits: [`kd:${rep.k1}`] } })).ok()).toBe(true);
    await expect(async () => {
      if (await menue(page).count() === 0) await ausloeser(page).click();
      expect(await menueNamen(page)).toContain('Commits');
    }).toPass();
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(ANSICHT_COMMITS)).toHaveCount(0);
  });

  test('AK 1: bei offenem Menü fügt das Ereignis „Commits“ ein — Menü und Fokus bleiben, Pfeilreihenfolge Datei → Commits → Verlauf', async ({ page }) => {
    await oeffnen(page, 2);
    await liveBereit(page);
    await menueOeffnen(page);
    const inhalt = eintraege(page).filter({ hasText: 'Inhalt' });
    await expect(inhalt).toBeFocused();
    expect((await page.request.post(k.adresse + 'api/aufgaben/2/commits', { headers: AGENT, data: { commits: [`kd:${rep.k1}`] } })).ok()).toBe(true);
    await expect(eintraege(page)).toHaveCount(6);
    await expect(menue(page)).toBeVisible();
    await expect(inhalt).toBeFocused();
    expect(await menueNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Commits', 'Verlauf']);
    for (const name of ['Zeiten', 'Details', 'Datei', 'Commits', 'Verlauf']) {
      await page.keyboard.press('ArrowDown');
      await expect(menue(page).getByRole('menuitemradio', { name, exact: true })).toBeFocused();
    }
  });

  async function commitsOeffnen(page, nr = 1) {
    await oeffnen(page, nr);
    await liveBereit(page);
    await reiter(page, 'Commits');
    await expect(page.locator(PANEL)).toBeVisible();
  }
  const antwortVon = async (page, nr) => (await (await page.request.get(`${k.adresse}api/aufgaben/${nr}/commits`)).json()).commits;
  const text = loc => loc.innerText().then(t => t.replace(/\s+/g, ' ').trim());
  const dreiBlock = rep => [rep.k3, rep.w1, rep.v1, rep.r1, rep.v2];

  /* ── AK 2 Liste und Zeilen (#1) ── */

  test('AK 2: #1 zeigt „COMMITS 5“, „ältester zuerst“ und die Zeilen in der Reihenfolge der Antwort', async ({ page }) => {
    await commitsOeffnen(page);
    await expect(page.locator(`${PANEL} .cl-kopf h3`)).toHaveText('COMMITS 5');
    await expect(page.locator(`${PANEL} .cl-kopf`)).toContainText('ältester zuerst');
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    const antwort = await antwortVon(page, 1);
    expect(antwort.map(e => e.verweis)).toEqual(dreiBlock(rep).map(h => `kd:${h}`));
    expect(await kurzListe(page)).toEqual(dreiBlock(rep).map(kurz));
  });

  test('AK 2: Zeile K3 — Titel, Autor, Datum, +3 −0, Zweige main und o/main (kein o/HEAD); W1 karte/1; R1 nur o/x gestrichelt „(entfernt)“', async ({ page }) => {
    await commitsOeffnen(page);
    const k3 = zeileMit(page, kurz(rep.k3));
    await expect(k3.locator('.cl-c-titel')).toHaveText('c.txt anlegen');
    await expect(k3.locator('.cl-c-autor')).toHaveText('Ada Autorin');
    await expect(k3.locator('.cl-c-datum')).toHaveText('01.03.2026 10:00');
    expect(await text(k3.locator('.cl-c-pm'))).toBe('+3 −0 Zeilen');
    await expect(k3.locator('.cl-c-datum span')).toHaveAttribute('title', '2026-03-01T10:00:00+01:00');
    await expect(k3.locator('.cl-hash')).toHaveAttribute('title', `kd:${rep.k3}`);
    await expect(k3.locator('.cl-br > span:not(.vh)')).toHaveText(['main', 'o/main']);
    expect(await k3.innerText()).not.toContain('o/HEAD');
    const w1 = zeileMit(page, kurz(rep.w1));
    await expect(w1.locator('.cl-c-autor')).toHaveText('Bernd Beispiel');
    await expect(w1.locator('.cl-br > span:not(.vh)')).toHaveText(['karte/1']);
    const r1 = zeileMit(page, kurz(rep.r1));
    const chips = r1.locator('.cl-br');
    await expect(chips).toHaveCount(1);
    await expect(chips.locator('> span:not(.vh)')).toHaveText('o/x');
    await expect(chips).toHaveCSS('border-top-style', 'dashed');
    await expect(chips.locator('.vh')).toHaveText('(entfernt)');
  });

  test('AK 2: keine E-Mail-Adresse, kein Knopf „Alle Änderungen ansehen“, kein Verweis; Klick auf Hash und Zeile ändert Adresse und Ansicht nicht', async ({ page }) => {
    await commitsOeffnen(page);
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    const alles = await text(page.locator(PANEL));
    expect(alles).not.toContain('@');
    expect(alles).not.toContain('ada@example.org');
    await expect(page.locator(`${PANEL} a[href]`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Alle Änderungen/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Alle Änderungen/ })).toHaveCount(0);
    const adresse = page.url();
    const zeile = zeileMit(page, kurz(rep.k3));
    await zeile.locator('.cl-hash').click();
    await zeile.locator('.cl-c-titel').click();
    expect(page.url()).toBe(adresse);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Commits');
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    // weder sortieren noch filtern, keine Spalte „Dateien“
    await expect(page.locator(`${PANEL} thead button, ${PANEL} thead [data-act], ${PANEL} input, ${PANEL} select`)).toHaveCount(0);
    expect(await page.locator(`${PANEL} thead th`).allInnerTexts()).toEqual(['Commit', 'Titel', 'Autor', 'Datum', '+ / −', 'Zustand']);
  });

  test('AK 2: das Lesen ändert weder die Aufgabendatei noch die Commit-Zahl des Board-Ordners', async ({ page }) => {
    const datei = 'aufgaben/0001-aufgabe-1.md';
    const vorher = { text: k.lies(datei), commits: k.git('rev-list', '--count', 'HEAD'), status: k.git('status', '--porcelain') };
    await commitsOeffnen(page);
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    await page.locator(NEU_LESEN).click();
    await expect(page.locator(NEU_LESEN)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.locator(STATUS)).toHaveText('5 Commits gelesen');
    expect({ text: k.lies(datei), commits: k.git('rev-list', '--count', 'HEAD'), status: k.git('status', '--porcelain') }).toEqual(vorher);
  });

  /* ── AK 3 Sechs Zustände (#3, #5) ── */

  test('AK 3: #3 zeigt acht Zeilen in der Reihenfolge der Antwort und je Zustand Symbol, Wort und Hinweis', async ({ page }) => {
    await commitsOeffnen(page, 3);
    await expect(page.locator(`${PANEL} .cl-kopf h3`)).toHaveText('COMMITS 8');
    const antwort = await antwortVon(page, 3);
    expect(antwort.map(e => e.verweis)).toEqual([...dreiBlock(rep).map(h => `kd:${h}`), `xx:${rep.k1}`, `xy:${rep.k1}`, 'kd:3f2a9c1;rm -rf x']);
    expect(await kurzListe(page)).toEqual(dreiBlock(rep).map(kurz).concat([`xx:${rep.k1.slice(0, 7)}`, `xy:${rep.k1.slice(0, 7)}`, 'kd:3f2a9c1;rm -rf x']));
    const marke = async (z, wort, hinweis) => {
      await expect(z.locator('.cl-zs')).toHaveText(wort);
      await expect(z.locator('.cl-zs svg')).toHaveCount(1);
      await expect(z.locator('.cl-zh')).toHaveText(hinweis);
    };
    await marke(zeileMit(page, kurz(rep.v1)), 'auf keinem Zweig', 'Der Commit ist noch da, aber kein Zweig führt zu ihm — meist nach einem Rebase.');
    await marke(zeileMit(page, kurz(rep.v2)), 'nicht mehr im Repository', 'Das Repository kennt diesen Commit nicht mehr.');
    const xx = antwort.find(e => e.zustand === 'repository_fehlt'), semikolon = antwort.find(e => e.zustand === 'unlesbar');
    await marke(zeileMit(page, `xx:${rep.k1.slice(0, 7)}`), 'Repository nicht erreichbar', xx.grund);
    await marke(zeileMit(page, `xy:${rep.k1.slice(0, 7)}`), 'Anwendung unbekannt', 'Anwendung „xy“ ist unter Einrichten nicht eingetragen.');
    await marke(zeileMit(page, 'kd:3f2a9c1;rm -rf x'), 'Eintrag nicht lesbar', semikolon.grund);
    // auf keinem Zweig hat Titel und Zahlen, die vier anderen „—“ (aria-hidden) mit verstecktem „keine Angabe“
    const v1 = zeileMit(page, kurz(rep.v1));
    await expect(v1.locator('.cl-c-titel')).toHaveText('v.txt anlegen');
    expect(await text(v1.locator('.cl-c-pm'))).toBe('+1 −0 Zeilen');
    await expect(v1.getByText('keine Angabe')).toHaveCount(0);
    for (const hash of [kurz(rep.v2), `xx:${rep.k1.slice(0, 7)}`, `xy:${rep.k1.slice(0, 7)}`, 'kd:3f2a9c1;rm -rf x']) {
      const z = zeileMit(page, hash);
      await expect(z.locator('td > span[aria-hidden="true"]')).toHaveText(['—', '—', '—', '—']);
      await expect(z.locator('td .vh')).toHaveText(['keine Angabe', 'keine Angabe', 'keine Angabe', 'keine Angabe']);
    }
  });

  test('AK 3: #5 (Verweis ohne Kürzel, keine Standardanwendung) nennt den Satz ohne „xy“', async ({ page }) => {
    await commitsOeffnen(page, 5);
    await expect(page.locator(`${PANEL} .cl-kopf h3`)).toHaveText('COMMITS 1');
    const z = zeileMit(page, rep.k1.slice(0, 7));
    await expect(z.locator('.cl-zs')).toHaveText('Anwendung unbekannt');
    await expect(z.locator('.cl-zh')).toHaveText('Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.');
    expect(await text(z)).not.toContain('„xy“');
  });

  for (const breite of [320, 414, 1280]) {
    test(`AK 3: bei ${breite} px sind die fünf Zustandswörter sichtbar (nicht in .vh, Rechteck, kein Beschnitt, kein opacity:0, kein font-size:0, in der Zeile)`, async ({ page }) => {
      await commitsOeffnen(page, 3);
      await breiteSetzen(page, breite);
      await expect(page.locator(ZEILEN)).toHaveCount(8);
      const verstoesse = await page.evaluate(() => {
        const woerter = ['auf keinem Zweig', 'nicht mehr im Repository', 'Repository nicht erreichbar', 'Anwendung unbekannt', 'Eintrag nicht lesbar'];
        const aus = [];
        for (const wort of woerter) {
          const el = [...document.querySelectorAll('#fenster .cl-zs')].find(e => e.textContent.trim() === wort);
          if (!el) { aus.push(`${wort}: fehlt`); continue; }
          const zeile = el.closest('tr'), r = el.getBoundingClientRect(), zr = zeile.getBoundingClientRect();
          if (el.closest('.vh')) aus.push(`${wort}: in .vh`);
          if (r.width <= 0 || r.height <= 0) aus.push(`${wort}: ohne Rechteck`);
          if (r.left < zr.left - 0.5 || r.right > zr.right + 0.5 || r.top < zr.top - 0.5 || r.bottom > zr.bottom + 0.5) aus.push(`${wort}: außerhalb der Zeile`);
          for (let n = el; n && n !== document.body; n = n.parentElement) {
            const st = getComputedStyle(n);
            if (st.opacity === '0') aus.push(`${wort}: opacity 0 an ${n.tagName}`);
            if (st.fontSize === '0px') aus.push(`${wort}: font-size 0 an ${n.tagName}`);
            if (st.visibility === 'hidden' || st.display === 'none') aus.push(`${wort}: unsichtbar an ${n.tagName}`);
            if (st.clipPath !== 'none') aus.push(`${wort}: clip-path an ${n.tagName}`);
            if (n !== el && st.overflowX !== 'visible' && n.id !== 'fenster') {
              const nr = n.getBoundingClientRect();
              if (r.right > nr.right + 0.5 || r.left < nr.left - 0.5) aus.push(`${wort}: beschnitten von ${n.className}`);
            }
          }
        }
        return aus;
      });
      expect(verstoesse).toEqual([]);
    });
  }

  test('AK 3: fremder Text (Titel, Autor, Zweig aus #4) steht als Text da — kein img, b, i, kein window.pwn, Attribute unverändert', async ({ page }) => {
    await commitsOeffnen(page, 4);
    const z = zeileMit(page, kurz(rep.boese));
    await expect(z.locator('.cl-c-titel')).toHaveText('<img src=x onerror=window.pwn=1> "x" \\ y');
    // Git entfernt „<“ und „>“ aus Namen (ident crud): der Name steht, wie Git ihn speichert und die API ihn liefert — zeichengleich
    const autor = (await antwortVon(page, 4)).find(e => e.hash === rep.boese).autor;
    expect(autor).toContain('"q" &');
    await expect(z.locator('.cl-c-autor')).toHaveText(autor);
    await expect(z.locator('.cl-br > span:not(.vh)')).toContainText(['a"><i>z']);
    await expect(page.locator(`${PANEL} img, ${PANEL} b, ${PANEL} i`)).toHaveCount(0);
    expect(await page.evaluate(() => window.pwn)).toBeUndefined();
    await expect(z.locator('.cl-br').filter({ hasText: 'a"><i>z' })).toHaveAttribute('title', 'a"><i>z');
    const attribute = await z.evaluate(zeile => [...zeile.querySelectorAll('*')].flatMap(e => [...e.attributes].map(a => a.name)));
    expect(attribute.filter(n => n.startsWith('on'))).toEqual([]);
  });

  /* ── AK 4 Gekürzter Titel, AK 5 Zweige (#4) ── */

  test('AK 4: 600 Zeichen kommen als 501 mit „…“ und der Marke „gekürzt“; 500 (auch mit „…“) und 499 + Emoji ohne Marke; nichts wird gekürzt', async ({ page }) => {
    await commitsOeffnen(page, 4);
    await expect(page.locator(ZEILEN)).toHaveCount(8);
    const titel = h => zeileMit(page, kurz(h)).locator('.cl-c-titel');
    const z = zeileMit(page, kurz(rep.z));
    const textZ = await z.locator('.cl-c-titel').evaluate(e => e.firstChild.textContent);
    expect(Array.from(textZ)).toHaveLength(501);
    expect(textZ.endsWith('…')).toBe(true);
    await expect(z.locator('.cl-kurz')).toHaveText('gekürzt');
    await expect(z.locator('.cl-kurz')).toHaveAttribute('title', 'Der Titel ist bei 500 Zeichen gekürzt; vollständig steht er im Repository.');
    expect(await titel(rep.t501).evaluate(e => e.firstChild.textContent)).toBe('a'.repeat(500) + '…');
    await expect(zeileMit(page, kurz(rep.t501)).locator('.cl-kurz')).toHaveText('gekürzt');
    expect(await titel(rep.t500).evaluate(e => e.textContent)).toBe('a'.repeat(500));
    await expect(zeileMit(page, kurz(rep.t500)).locator('.cl-kurz')).toHaveCount(0);
    await expect(zeileMit(page, kurz(rep.t500punkte)).locator('.cl-kurz')).toHaveCount(0);
    expect(await titel(rep.t500punkte).evaluate(e => e.textContent)).toBe('a'.repeat(499) + '…');
    expect(await titel(rep.t499).evaluate(e => e.textContent)).toBe('a'.repeat(499) + '\u{1F600}');
    await expect(zeileMit(page, kurz(rep.t499)).locator('.cl-kurz')).toHaveCount(0);
    expect(await page.evaluate(() => [...document.querySelectorAll('#fenster .mod-body *')].filter(e => getComputedStyle(e).textOverflow === 'ellipsis').length)).toBe(0);
  });

  test('AK 5: Commit Z — drei Namen, „+20 weitere“; zeigen/verbergen mit aria-expanded und Namen; die Listen mit Zahlen und der Satz zum Rest', async ({ page }) => {
    await commitsOeffnen(page, 4);
    await expect(page.locator(ZEILEN)).toHaveCount(8);
    const z = zeileMit(page, kurz(rep.z));
    const namen = await z.locator('.cl-zweige .cl-br > span:not(.vh)').allInnerTexts();
    expect(namen).toHaveLength(3);
    namen.forEach((n, i) => expect(n.startsWith(`z0${i + 1}`)).toBe(true));
    const knopf = z.getByRole('button', { name: '20 weitere Zweige zeigen' });
    await expect(knopf).toHaveText('+20 weitere');
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await knopf.click();
    const geoeffnet = z.getByRole('button', { name: '20 weitere Zweige verbergen' });
    await expect(geoeffnet).toHaveAttribute('aria-expanded', 'true');
    const klappe = page.locator(`${PANEL} tr.cl-zw`);
    await expect(klappe).toHaveCount(1);
    await expect(klappe).toContainText('LOKALE ZWEIGE 10');
    await expect(klappe).toContainText('ENTFERNTE ZWEIGE 10');
    await expect(klappe).toContainText('und 3 weitere Zweige, hier nicht aufgeführt');
    const lokal = await klappe.locator('p').nth(1).locator('.cl-br > span:not(.vh)').allInnerTexts();
    expect(lokal.map(n => n.slice(0, 3))).toEqual(Array.from({ length: 10 }, (_, i) => `z${String(i + 1).padStart(2, '0')}`));
    const fern = await klappe.locator('p').nth(3).locator('.cl-br > span:not(.vh)').allInnerTexts();
    expect(fern.map(n => n.slice(0, 5))).toEqual(Array.from({ length: 10 }, (_, i) => `o/e${String(i + 1).padStart(2, '0')}`));
    await geoeffnet.click();
    await expect(klappe).toHaveCount(0);
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
  });

  test('AK 5: ein Commit mit genau 3 Zweigen hat keinen Knopf, mit 4 „+1 weitere“; R1 (nur o/x) hat keinen Knopf', async ({ page }) => {
    const { gitAls } = require('./commits-hilfen');
    const basis = basisAnlegen();
    const eigenes = arbeitsRepositoryBauen(basis);
    try {
      await k.stoppen();
      k = await kanbanStarten(ausgangslageVorbereiten(eigenes, basis));
      gitAls(eigenes.r, 'Ada Autorin', '2026-03-12T09:00:00+00:00', 'branch', 'drei-a', eigenes.k3);
      await commitsOeffnen(page, 3);
      await expect(zeileMit(page, kurz(eigenes.k3)).locator('.cl-br')).toHaveCount(3);
      await expect(zeileMit(page, kurz(eigenes.k3)).locator('.cl-mehr')).toHaveCount(0);
      gitAls(eigenes.r, 'Ada Autorin', '2026-03-12T09:00:00+00:00', 'branch', 'drei-b', eigenes.k3);
      await page.locator(NEU_LESEN).click();
      await expect(zeileMit(page, kurz(eigenes.k3)).getByRole('button', { name: '1 weitere Zweige zeigen' })).toHaveText('+1 weitere');
      await expect(zeileMit(page, kurz(eigenes.r1)).locator('.cl-mehr')).toHaveCount(0);
    } finally { fs.rmSync(basis, { recursive: true, force: true }); }
  });

  /* ── AK 6 Laden und „Neu lesen“ (Antworten per page.route gehalten, keine Schlafzeiten) ── */

  test('AK 6: gehaltene Antwort — „Liest die Commits aus dem Repository …“, keine Zeilen, keine Zahl, kein Stand; danach Liste und Stand HH:MM:SS im Fenster von Klick bis Meldung', async ({ page }) => {
    const { frei } = await anhalten(page, 1);
    await oeffnen(page);
    await liveBereit(page);
    const vorKlick = await page.evaluate(() => Date.now());
    await reiter(page, 'Commits');
    await expect(page.locator(`${PANEL} ${STATUS}`)).toHaveText('Liest die Commits aus dem Repository …');
    await expect(page.locator(ZEILEN)).toHaveCount(0);
    await expect(page.locator(`${PANEL} .cl-kopf h3 .mono`)).toHaveCount(0);
    await expect(page.locator(`${PANEL} .cl-fuss`)).not.toContainText('Stand');
    frei();
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    await expect(page.locator(STATUS)).toHaveText('5 Commits gelesen');
    const nachMeldung = await page.evaluate(() => Date.now());
    const stand = (await page.locator(`${PANEL} .cl-fuss span`).first().innerText()).match(/Stand (\S+)$/)[1];
    expect(stand).toMatch(/^\d\d:\d\d:\d\d$/);
    const sek = ms => page.evaluate(m => { const d = new Date(m); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }, ms);
    const [von, bis, ist] = [await sek(vorKlick), await sek(nachMeldung), stand.split(':').reduce((a, n) => a * 60 + +n, 0)];
    expect(ist).toBeGreaterThanOrEqual(von);
    expect(ist).toBeLessThanOrEqual(bis);
  });

  test('AK 6: beim Lesen bleibt „Neu lesen“ im Dokument mit aria-disabled, der Fokus darauf, ein zweiter Klick löst keinen zweiten Aufruf aus; der Statusbereich bleibt derselbe Knoten', async ({ page }) => {
    const aufrufe = zaehlen(page, 1);
    await commitsOeffnen(page);
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    expect(aufrufe).toHaveLength(1);
    const statusVorher = await page.locator(STATUS).elementHandle();
    const { frei, aufrufe: gehalten } = await anhalten(page, 1);
    const knopf = page.locator(NEU_LESEN);
    await knopf.click();
    await expect(knopf).toHaveAttribute('aria-disabled', 'true');
    await expect(knopf).toBeFocused();
    await expect(page.locator(`${PANEL} ${STATUS}`)).toHaveText('Liest die Commits aus dem Repository …');
    // aria-disabled: Playwright wartet sonst auf „enabled“; erzwungen kommt der zweite Klick wirklich an
    await knopf.click({ force: true });
    await expect(knopf).toBeFocused();
    frei();
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    await expect(knopf).not.toHaveAttribute('aria-disabled', 'true');
    expect(gehalten).toHaveLength(1);
    await expect(knopf).toBeFocused();
    const statusNachher = await page.locator(STATUS).elementHandle();
    expect(await page.evaluate(([a, b]) => a === b && a.isConnected, [statusVorher, statusNachher])).toBe(true);
    await expect(page.locator(STATUS)).toHaveText('5 Commits gelesen');
  });

  test('AK 6: „Neu lesen“ liest genau einmal erneut; nach einer Änderung im Arbeits-Repository steht W1 „auf keinem Zweig“ (kein Cache der Oberfläche)', async ({ page }) => {
    const basis = basisAnlegen();
    const eigenes = arbeitsRepositoryBauen(basis);
    try {
      await k.stoppen();
      k = await kanbanStarten(ausgangslageVorbereiten(eigenes, basis));
      const aufrufe = zaehlen(page, 1);
      await commitsOeffnen(page);
      await expect(page.locator(ZEILEN)).toHaveCount(5);
      expect(aufrufe).toHaveLength(1);
      await expect(zeileMit(page, kurz(eigenes.w1)).locator('.cl-br > span:not(.vh)')).toHaveText(['karte/1']);
      require('child_process').execFileSync('git', ['-C', eigenes.r, 'update-ref', 'refs/heads/karte/1', eigenes.k4]);
      await page.locator(NEU_LESEN).click();
      await expect(zeileMit(page, kurz(eigenes.w1)).locator('.cl-zs')).toHaveText('auf keinem Zweig');
      expect(aufrufe).toHaveLength(2);
      await expect(page.locator(NEU_LESEN)).toBeFocused();
    } finally { fs.rmSync(basis, { recursive: true, force: true }); }
  });

  test('AK 6: ein Live-Ereignis (Titeländerung an #4) lässt die gelesene Liste samt Klappen unverändert und liest nicht neu', async ({ page }) => {
    const aufrufe = zaehlen(page, 4);
    await commitsOeffnen(page, 4);
    await expect(page.locator(ZEILEN)).toHaveCount(8);
    const z = zeileMit(page, kurz(rep.z));
    await z.getByRole('button', { name: '20 weitere Zweige zeigen' }).click();
    await expect(page.locator(`${PANEL} tr.cl-zw`)).toHaveCount(1);
    expect((await page.request.patch(k.adresse + 'api/aufgaben/4', { headers: AGENT, data: { titel: 'Neuer Titel vier' } })).ok()).toBe(true);
    await expect(page.locator('.ka[data-id="4"]')).toContainText('Neuer Titel vier');
    await bereit(page, page.locator(PANEL));
    await expect(page.locator(`${PANEL} tr.cl-zw`)).toHaveCount(1);
    await expect(page.locator(ZEILEN)).toHaveCount(8);
    expect(aufrufe).toHaveLength(1);
  });

  test('AK 6: verspätete Antwort für #1 wird nach dem Wechsel auf #3 verworfen — #3 zeigt „COMMITS 8“ mit eigenen Zeilen, Stand und Meldung aus der Antwort für #3', async ({ page }) => {
    const { frei } = await anhalten(page, 1);
    await commitsOeffnen(page, 1);
    await expect(page.locator(`${PANEL} ${STATUS}`)).toHaveText('Liest die Commits aus dem Repository …');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toHaveCount(0);
    await page.locator('.ka[data-id="3"] .id').click();
    await expect(page.locator(`${PANEL} .cl-kopf h3`)).toHaveText('COMMITS 8');
    await expect(page.locator(STATUS)).toHaveText('8 Commits gelesen');
    const stand3 = await page.locator(`${PANEL} .cl-fuss span`).first().innerText();
    frei();
    // die verspätete Antwort ist angekommen und verworfen, sobald ein weiteres, lokales Ereignis sichtbar verarbeitet wurde:
    // eine Titeländerung an #3 (Live) erscheint auf der Karte; danach muss die Ansicht noch dieselbe sein
    await page.request.patch(k.adresse + 'api/aufgaben/3', { headers: AGENT, data: { titel: 'Drei nach der Freigabe' } });
    await expect(page.locator('.ka[data-id="3"]')).toContainText('Drei nach der Freigabe');
    await bereit(page, page.locator(PANEL));
    await expect(page.locator(`${PANEL} .cl-kopf h3`)).toHaveText('COMMITS 8');
    await expect(page.locator(STATUS)).toHaveText('8 Commits gelesen');
    expect(await kurzListe(page)).toEqual(dreiBlock(rep).map(kurz).concat([`xx:${rep.k1.slice(0, 7)}`, `xy:${rep.k1.slice(0, 7)}`, 'kd:3f2a9c1;rm -rf x']));
    expect(await page.locator(`${PANEL} .cl-fuss span`).first().innerText()).toBe(stand3);
  });

  test('AK 6: verspätete Antwort für #1 nach dem Wechsel auf „Inhalt“ — das Fenster bleibt auf „Inhalt“, „Commits“ erscheint nicht', async ({ page }) => {
    const { frei } = await anhalten(page, 1);
    await commitsOeffnen(page, 1);
    await expect(page.locator(`${PANEL} ${STATUS}`)).toHaveText('Liest die Commits aus dem Repository …');
    await reiter(page, 'Inhalt');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    frei();
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: AGENT, data: { titel: 'Nach der Antwort' } });
    await expect(page.locator('.ka[data-id="1"]')).toContainText('Nach der Antwort');
    await bereit(page, page.locator('#fenster .mod-body'));
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator(PANEL)).toHaveCount(0);
    await expect(page.locator(ZEILEN)).toHaveCount(0);
    // zurück auf „Commits“ liest neu (kein Rest der verworfenen Antwort)
    await reiter(page, 'Commits');
    await expect(page.locator(ZEILEN)).toHaveCount(5);
  });

  test('AK 6: ohne gewählte Person lädt die Ansicht ohne Hinweis und ohne Fehler (das GET trägt kein X-KanbanD-Wer)', async ({ page }) => {
    const aufrufe = zaehlen(page, 1);
    await commitsOeffnen(page);
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]['x-kanband-wer']).toBeUndefined();
    await expect(page.locator('#fenster [role="alert"]')).toHaveCount(0);
    await expect(page.locator('#fenster .fehl')).toHaveCount(0);
  });

  /* ── AK 7 Fehler und leer ── */

  test('AK 7: 503 — Wortlaut mit „Erneut versuchen“, keine Zeilen und keine Zahl; ein Klick liest genau einmal erneut, danach die Liste, Fokus nie auf body', async ({ page }) => {
    let versuche = 0;
    await page.route('**/api/aufgaben/1/commits', route => {
      if (route.request().method() !== 'GET') return route.continue();
      versuche += 1;
      if (versuche === 1) return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Git in einem Arbeits-Repository antwortete nicht innerhalb von 10 s — keine Liste' }) });
      return route.continue();
    });
    await commitsOeffnen(page);
    await expect(page.locator(STATUS)).toHaveText('Die Commits ließen sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden (503).');
    await expect(page.locator(ZEILEN)).toHaveCount(0);
    await expect(page.locator(`${PANEL} .cl-kopf h3 .mono`)).toHaveCount(0);
    const erneut = page.getByRole('button', { name: 'Erneut versuchen' });
    await expect(erneut).toBeVisible();
    await erneut.click();
    await expect(page.locator(ZEILEN)).toHaveCount(5);
    expect(versuche).toBe(2);
    expect(await page.evaluate(() => document.activeElement && document.activeElement.tagName)).not.toBe('BODY');
    await expect(page.locator(NEU_LESEN)).toBeFocused();
  });

  test('AK 7: defekte Aufgabendatei (423) und fehlende Verbindung nennen den fehler der Antwort bzw. „keine Verbindung zum Programm“ mit dem Status', async ({ page }) => {
    await page.route('**/api/aufgaben/1/commits', route => route.fulfill({ status: 423, contentType: 'application/json', body: JSON.stringify({ fehler: 'Die Aufgabendatei ist defekt' }) }));
    await commitsOeffnen(page);
    await expect(page.locator(STATUS)).toHaveText('Die Commits ließen sich nicht lesen: Die Aufgabendatei ist defekt (423).');
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    await page.unroute('**/api/aufgaben/1/commits');
    await page.route('**/api/aufgaben/1/commits', route => route.abort('connectionrefused'));
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(page.locator(STATUS)).toHaveText('Die Commits ließen sich nicht lesen: keine Verbindung zum Programm (0).');
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
  });

  test('AK 7: 200 mit leerer Liste — „An dieser Aufgabe sind keine Commits hinterlegt.“ mit dem Satz zur API, ohne Zahl', async ({ page }) => {
    await page.route('**/api/aufgaben/1/commits', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"commits":[]}' }));
    await commitsOeffnen(page);
    await expect(page.locator(PANEL)).toContainText('An dieser Aufgabe sind keine Commits hinterlegt.');
    await expect(page.locator(PANEL)).toContainText('Ein Agent hinterlegt sie über die API (POST /api/aufgaben/{nr}/commits); siehe Endpunktliste unter /api.');
    await expect(page.locator(`${PANEL} .cl-kopf h3 .mono`)).toHaveCount(0);
    await expect(page.locator(ZEILEN)).toHaveCount(0);
  });
});
