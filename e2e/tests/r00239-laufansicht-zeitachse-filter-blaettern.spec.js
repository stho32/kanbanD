// R00239 Laufansicht — Zeitachse, Filter und Blättern zwischen den Läufen (Karte #253, I0229, Scheibe B) — AK 1–10 im echten Programm.
// Ausgangslage (R00239): Board `fabrik` aus laufansicht-hilfen.js; an #1 liegen T1, T3, T4, T5 aus R00234 und T10, T11, dazu der
// Kosteneintrag K1 ohne Transkript; an #2 nur T12. Über die API abgelegt, T5 danach gelöscht. Antworten per `page.route` gehalten;
// Verneinungen erst nach einem sichtbaren Signal. Aufbau: Testfälle in Fachwörtern, darunter die Testsprache (Abschnitt „Sprache“),
// die als einzige Selektoren kennt.
const { test, expect } = require('@playwright/test');
/** Rote Spezifikation (ATDD): bis zum Bau der Bubbles erwartet rot; die Markierung fällt je Test, sobald er grün ist. */
const ERWARTET_ROT = true;
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastVerstoesse, kontrastFarben, kontrastAm, reiter } = require('./hilfen');
const { perTabErreicht } = require('./ziele-hilfen');
const lv = require('./laufansicht-hilfen');
const { T1 } = require('./laufansicht-t1');

const T = {
  T1: 'planer@2026-11-21T23:30+01:00',
  T3: 'entwickler@2026-11-21T08:00+01:00',
  T4: 'architekt@2026-11-21T23:40+01:00',
  T5: 'code-reviewer@2026-11-21T22:00+01:00',
  T10: 'tester@2026-11-22T10:00+01:00',
  T11: 'entwickler@2026-11-22T10:30+01:00',
  K1: 'pruefer@2026-11-21T12:00+01:00',
  T12: 'planer@2026-11-21T09:00+01:00',
};

/* ── Ausgangslage ── */

const zeile = o => JSON.stringify(o) + '\n';
const t1Text = () => T1.map(e => zeile(e)).join('');
const um = (beginnMs, k) => new Date(beginnMs + (k - 1) * 1000).toISOString().replace('Z', '+00:00');
/** T3 aus R00234: 20.000 Einträge zu je 1 s im Wechsel Aufruf/Ergebnis, danach der Bericht — liest bis zur Grenze. */
function t3Text() {
  const beginn = Date.parse('2026-11-21T08:00:00+01:00');
  const zeilen = [];
  for (let k = 1; k <= 20000; k++) {
    zeilen.push(zeile(k % 2 === 1 ? { zeit: um(beginn, k), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: `echo ${k}` }) }
      : { zeit: um(beginn, k), art: 'werkzeugergebnis', wer: 'werkzeug', text: String(k - 1) }));
  }
  zeilen.push(zeile({ zeit: um(beginn, 20001), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' }));
  return zeilen.join('');
}
const T4_TEXT = zeile({ zeit: '2026-11-21T23:40:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"true"}' })
  + zeile({ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Exit code 0' })
  + zeile({ zeit: 'gestern', art: 'nachricht', wer: 'agent', text: 'fertig' });
/** T10 und T11 (R00239): Eintrag k mit `zeit` Beginn + (k − 1) s; ungerade ein Aufruf `Bash` von `agent`, gerade sein Ergebnis „ok“. */
function tText(anzahl, beginn) {
  const start = Date.parse(beginn);
  return Array.from({ length: anzahl }, (_, i) => zeile(i % 2 === 0
    ? { zeit: um(start, i + 1), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"true"}' }
    : { zeit: um(start, i + 1), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' })).join('');
}

async function ablegen(k) {
  await lv.hochladen(k.adresse, 1, T.T1, 'Detailplanung', lv.gz(t1Text()));
  await lv.hochladen(k.adresse, 1, T.T3, 'Entwicklung', lv.gz(t3Text()));
  await lv.hochladen(k.adresse, 1, T.T4, 'Entwicklung', lv.gz(T4_TEXT));
  await lv.hochladen(k.adresse, 1, T.T5, 'Reviews', lv.gz(t1Text()));
  await lv.hochladen(k.adresse, 1, T.T10, 'Reviews', lv.gz(tText(202, '2026-11-22T10:00:00+01:00')));
  await lv.hochladen(k.adresse, 1, T.T11, 'Entwicklung', lv.gz(tText(201, '2026-11-22T10:30:00+01:00')));
  await lv.hochladen(k.adresse, 2, T.T12, 'Detailplanung', lv.gz(t1Text()));
  await lv.buchen(k.adresse, 1, T.T1, 'Detailplanung', 1.79);
  await lv.buchen(k.adresse, 1, T.T5, 'Reviews', 0.42);
  await lv.buchen(k.adresse, 1, T.K1, 'Reviews', 0.10);
  const ordner = path.join(k.ordner, 'transkripte/0001');
  fs.rmSync(path.join(ordner, fs.readdirSync(ordner).find(n => n.startsWith('code-reviewer@'))));
}

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const ZA = '#lauf section.lv-za';
const BALKEN = '#lauf .lv-balken';
const TEILE = `${BALKEN} > span`;
const INSEL = '#lv-insel';
const ZEILEN = `${INSEL} > li:not(.lv-ende):not(.lv-g)`;
const STATUS = '#lv-status';
const ZEIGEN = '#lauf fieldset.lv-filt';
const KEINE_FEHLER = '#lauf .lv-keinf';
const BLATT = '#lauf nav.lv-blatt';
const VORIGER = '#lv-vor';
const NAECHSTER = '#lv-nach';
const STELLE = `${BLATT} .stelle`;
const ENDE = 'Ende des Transkripts';
const KEINE_FEHLER_SATZ = 'Keine Fehler erkannt. Erkannt werden ein Exit-Code ungleich 0 und Fehler des Werkzeugs.';
const ART = { Nachrichten: 'n', Werkzeuge: 'w', Systemhinweise: 'h', 'nur Fehler': 'f' };

const adresse = (nr, kennung) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;
const istTranskriptVon = (url, kennung) => decodeURIComponent(new URL(url).pathname).endsWith(`/transkripte/${kennung}`);
const istTranskript = url => /\/api\/aufgaben\/\d+\/transkripte\/./.test(new URL(url).pathname);

/** Zählt `laufAuswerten` (R00239 FA 6, NFR Leistung): `lauf.js` legt die Funktion auf `window`, der Zähler umschließt sie. */
function auswertungenZaehlen() {
  let echt = null;
  window.kdAuswertungen = 0;
  Object.defineProperty(window, 'laufAuswerten', {
    configurable: true,
    get: () => echt && ((...a) => { window.kdAuswertungen++; return echt(...a); }),
    set: f => { echt = f; },
  });
}

/** Je Änderung in einer Live-Region (`role=status|alert`, `aria-live`) ein Eintrag mit dem Text der Region danach. */
function liveBeobachten() {
  window.kdLive = [];
  const LIVE = '[role=status],[role=alert],[aria-live]';
  new MutationObserver(eintraege => {
    for (const e of eintraege) {
      const ort = e.target.nodeType === 3 ? e.target.parentElement : e.target;
      const region = ort && ort.closest && ort.closest(LIVE);
      if (region) window.kdLive.push(region.textContent);
    }
  }).observe(document, { subtree: true, childList: true, characterData: true });
}
const liveSeit = async page => {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  return page.evaluate(() => window.kdLive.splice(0));
};

const sprache = (page, k) => ({
  async oeffnen(kennung, nr = 1) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(k.adresse + adresse(nr, kennung));
    await expect(page.locator('#lv-h1')).toBeVisible();
  },
  gelesen: () => expect(page.locator(STATUS)).toHaveText(/^(Ende des Transkripts|Grenze erreicht.*|Das Transkript .*|Lauf .*)$/),
  async laeufeVonEins() {
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1`);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await reiter(page, 'Läufe');
    await expect(page.locator('#fenster a.lf-an').first()).toBeVisible();
  },
  ansehen: kennung => page.locator(`#fenster a.lf-an[data-arg="${kennung}"]`).click(),
  kaestchen: name => page.locator(`${ZEIGEN} input[data-filter="${ART[name]}"]`),
  /** Stand der vier Kästchen als `{Name: angehakt}`. */
  stand: () => page.locator(`${ZEIGEN} label`).evaluateAll(ls => Object.fromEntries(ls.map(l => [l.textContent.trim(), l.querySelector('input').checked]))),
  /** Die sichtbaren Zeilen der Insel als ids, gemessen über die Höhe. */
  sichtbar: () => page.locator(ZEILEN).evaluateAll(ls => ls.filter(l => l.getBoundingClientRect().height > 0).map(l => l.id)),
  titel: () => page.locator(TEILE).evaluateAll(ts => ts.map(t => t.title)),
  async markieren() {
    await page.locator(INSEL).evaluate(el => { el.__probe = 1; });
  },
  markeSteht: () => page.locator(INSEL).evaluate(el => el.__probe === 1),
  auswertungen: () => page.evaluate(() => window.kdAuswertungen),
});

/** Die 13 Zeilen von T1 unter der Vorgabe: alle außer dem Systemhinweis Nr 2. */
const T1_VORGABE = ['lv-s1', 'lv-s3-vor', 'lv-s3', 'lv-s5', 'lv-s7-vor', 'lv-s7', 'lv-s8', 'lv-s11', 'lv-s13-vor', 'lv-s13', 'lv-s14', 'lv-s15-vor', 'lv-s15'];

test.describe('R00239 Laufansicht: Zeitachse, Filter, Blättern', () => {
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    await page.addInitScript(auswertungenZaehlen);
    k = await kanbanStarten(lv.ausgangslage());
    s = sprache(page, k);
    await ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  /* ── Zeitachse ── */

  test('AK 1 · US-1: T1 — „Zeitachse“ zwischen Kopf und Einträgen, 9 Stücke mit Tooltip, Breite nach Anteil, 23:30:00 bis 23:32:30', async ({ page }) => {
    await breiteSetzen(page, 1280);
    await s.oeffnen(T.T1);
    await s.gelesen();
    await expect(page.locator(`${ZA} h2`)).toHaveText('Zeitachse');
    const lage = await page.evaluate(() => {
      const kopf = document.querySelector('#lauf .lv-aw'), za = document.querySelector('#lauf .lv-za'), insel = document.getElementById('lv-insel');
      return { nachKopf: Boolean(kopf.compareDocumentPosition(za) & Node.DOCUMENT_POSITION_FOLLOWING), vorEintraegen: Boolean(za.compareDocumentPosition(insel) & Node.DOCUMENT_POSITION_FOLLOWING),
        unterKopf: za.getBoundingClientRect().top >= kopf.getBoundingClientRect().bottom - 0.5, ueberEintraegen: za.getBoundingClientRect().bottom <= insel.getBoundingClientRect().top + 0.5 };
    });
    expect(lage).toEqual({ nachKopf: true, vorEintraegen: true, unterKopf: true, ueberEintraegen: true });
    expect(await s.titel()).toEqual(['Warten 1 s ab 23:30:00', 'Denken 21 s ab 23:30:01', 'Werkzeuge 4 s ab 23:30:22', 'Denken 4 s ab 23:30:26', 'Werkzeuge 1 s ab 23:30:30',
      'Denken 5 s ab 23:30:31', 'Werkzeuge 8 s ab 23:30:37', 'Warten 1 min 5 s ab 23:30:45', 'Denken 39 s ab 23:31:50']);
    const dauern = [1000, 21000, 4000, 4999, 1000, 5500, 8000, 65000, 39501];
    const m = await page.locator(BALKEN).evaluate(b => ({ balken: b.getBoundingClientRect().width, links: b.getBoundingClientRect().left,
      teile: [...b.children].map(t => [t.getBoundingClientRect().left, t.getBoundingClientRect().width]) }));
    m.teile.forEach(([, breite], i) => {
      expect(Math.abs(breite - dauern[i] / 150000 * m.balken), `Stück ${i + 1}: ${breite} px`).toBeLessThanOrEqual(1);
      expect(breite).toBeGreaterThanOrEqual(1);
    });
    // die Trennlinie liegt im Stück: die Teile schließen ohne Abstand aneinander an und füllen den Balken
    m.teile.forEach(([links], i) => expect(Math.abs(links - (i ? m.teile[i - 1][0] + m.teile[i - 1][1] : m.links))).toBeLessThanOrEqual(0.05));
    expect(Math.abs(m.teile.reduce((summe, [, b]) => summe + b, 0) - m.balken)).toBeLessThanOrEqual(0.5);
    await expect(page.locator(`${ZA} .lv-za-zeit > span`)).toHaveText(['23:30:00', '23:32:30']);
    // das breiteste Stück (US-1)
    const breitestes = m.teile.reduce((best, t, i) => (t[1] > m.teile[best][1] ? i : best), 0);
    expect((await s.titel())[breitestes]).toBe('Warten 1 min 5 s ab 23:30:45');
  });

  test('AK 2 · US-1: vorgelesen als Bild mit Lesetext; T3 ohne „Warten“, Legende immer mit drei Arten; T4, T5, gehalten und 503 ohne Zeitachse', async ({ page }) => {
    await s.oeffnen(T.T1);
    await s.gelesen();
    await expect(page.locator(BALKEN)).toHaveAttribute('role', 'img');
    expect(await page.locator(ZA).ariaSnapshot()).toContain('img "Zeitachse: Werkzeuge 13 s, Denken 1 min 11 s, Warten 1 min 6 s"');
    await s.oeffnen(T.T3);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    expect(await page.locator(ZA).ariaSnapshot()).toContain('img "Zeitachse: Werkzeuge 2 h 46 min, Denken 2 h 46 min"');
    await expect(page.locator(`${ZA} .lv-leg li`)).toHaveText(['Werkzeuge', 'Denken', 'Warten']);
    await expect(page.locator(`${ZA} .lv-leg`)).toHaveAttribute('aria-hidden', 'true');
    for (const kennung of [T.T4, T.T5]) {
      await s.oeffnen(kennung);
      await s.gelesen();
      await expect(page.locator('#lauf .lv-aw')).toBeVisible();
      await expect(page.locator(ZA), kennung).toHaveCount(0);
    }
    const wartend = [];
    await page.route(url => istTranskriptVon(url.href, T.T1), route => wartend.push(route));
    await s.oeffnen(T.T1);
    await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
    await expect(page.locator(ZA)).toHaveCount(0);
    await expect.poll(() => wartend.length).toBe(1);
    await wartend[0].fulfill({ status: 503, json: { fehler: 'Antwortbudget erschöpft' } });
    await expect(page.locator(STATUS)).toHaveText(/\(503\)\.$/);
    await expect(page.locator(ZA)).toHaveCount(0);
  });

  test('AK 3 · US-2: T10 mit 200 Fächern, 100 Werkzeuge und 100 Denken; T11 mit 200 Stücken ohne Fach; T3 mit 200 Fächern', async ({ page }) => {
    await s.oeffnen(T.T10);
    await s.gelesen();
    const titel = await s.titel();
    expect(titel.length).toBe(200);
    expect([titel[0], titel[1], titel[99], titel[100], titel[199]]).toEqual(['überwiegend Werkzeuge, 10:00:00–10:00:01', 'überwiegend Denken, 10:00:01–10:00:02',
      'überwiegend Denken, 10:01:39–10:01:40', 'überwiegend Denken, 10:01:40–10:01:41', 'überwiegend Werkzeuge, 10:03:19–10:03:21']);
    const farben = await page.evaluate(() => {
      const farbe = sel => getComputedStyle(document.querySelector(sel)).backgroundColor;
      const w = farbe('#lauf .lv-leg i.w'), d = farbe('#lauf .lv-leg i.d');
      const teile = [...document.querySelectorAll('#lauf .lv-balken > span')].map(t => getComputedStyle(t).backgroundColor);
      return { w: teile.filter(f => f === w).length, d: teile.filter(f => f === d).length, verschieden: w !== d };
    });
    expect(farben).toEqual({ w: 100, d: 100, verschieden: true });
    await s.oeffnen(T.T11);
    await s.gelesen();
    const t11 = await s.titel();
    expect(t11.length).toBe(200);
    expect([t11[0], t11[199]]).toEqual(['Werkzeuge 1 s ab 10:30:00', 'Denken 1 s ab 10:33:19']);
    expect(t11.filter(t => t.startsWith('überwiegend'))).toEqual([]);
    await s.oeffnen(T.T3);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    const t3 = await s.titel();
    expect(t3.length).toBe(200);
    expect(t3[0]).toBe('überwiegend Werkzeuge, 08:00:00–08:01:39');
  });

  /* ── Filter ── */

  test('AK 4 · US-4: Vorgabe an/an/aus/aus, 13 Zeilen; Wechsel nur über das Attribut der Insel, je eine Ansage, keine Anfrage', async ({ page }) => {
    await s.oeffnen(T.T1);
    await s.gelesen();
    await expect(page.locator(`${ZEIGEN} legend`)).toHaveText('Zeigen');
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: true, Systemhinweise: false, 'nur Fehler': false });
    expect(await s.sichtbar()).toEqual(T1_VORGABE);
    await s.markieren();
    const anfragen = [];
    page.on('request', r => anfragen.push(r.url()));
    await page.evaluate(liveBeobachten);
    const schritte = [
      ['Systemhinweise', '14 von 14 Einträgen sichtbar.', 14],
      ['Werkzeuge', '5 von 14 Einträgen sichtbar.', ['lv-s1', 'lv-s2', 'lv-s13-vor', 'lv-s13', 'lv-s14']],
      ['Nachrichten', '1 von 14 Einträgen sichtbar.', ['lv-s2']],
      ['Systemhinweise', 'Keine Einträge sichtbar.', []],
    ];
    for (const [name, satz, zeilen] of schritte) {
      await s.kaestchen(name).click();
      await expect(page.locator(STATUS)).toHaveText(satz);
      const sichtbar = await s.sichtbar();
      if (typeof zeilen === 'number') expect(sichtbar.length).toBe(zeilen);
      else expect(sichtbar).toEqual(zeilen);
      expect(await liveSeit(page), name).toEqual([satz]);
      expect(await s.markeSteht(), name).toBe(true);
      expect(await s.auswertungen(), name).toBe(1);
    }
    expect(await page.locator(`${INSEL} > li.lv-d.d`).evaluateAll(ls => ls.filter(l => l.getBoundingClientRect().height > 0).length)).toBe(0);
    await expect(page.locator(`${INSEL} > li.lv-ende`)).toBeVisible();
    await expect(page.locator(KEINE_FEHLER)).toHaveCount(0);
    expect(anfragen.filter(u => new URL(u).pathname.startsWith('/api/'))).toEqual([]);
  });

  test('AK 5 · US-3: T1 „nur Fehler“ — zwei Fehlerzeilen unter dem Bericht, Arten gesperrt mit ihrem Stand; T4 „Keine Fehler erkannt …“', async ({ page }) => {
    await s.oeffnen(T.T1);
    await s.gelesen();
    await page.evaluate(liveBeobachten);
    await s.kaestchen('nur Fehler').click();
    await expect(page.locator(STATUS)).toHaveText('2 von 14 Einträgen sichtbar.');
    expect(await s.sichtbar()).toEqual(['lv-s5', 'lv-s8']);
    await expect(page.locator('#lauf .lv-ber'), 'der Bericht bleibt unter jedem Filter').toBeVisible();
    await expect(page.locator('#lv-s5 .eg')).toContainText('Exit code 1');
    await expect(page.locator('#lv-s8 .eg')).toContainText('<tool_use_error>');
    const lage = await page.evaluate(() => {
      const ber = document.querySelector('#lauf .lv-ber').getBoundingClientRect(), ende = document.querySelector('#lv-insel > li.lv-ende').getBoundingClientRect();
      const s5 = document.getElementById('lv-s5').getBoundingClientRect(), s8 = document.getElementById('lv-s8').getBoundingClientRect();
      return { berichtDarueber: ber.bottom <= s5.top, endeDarunter: ende.top >= s8.bottom && ende.height > 0 };
    });
    expect(lage).toEqual({ berichtDarueber: true, endeDarunter: true });
    for (const name of ['Nachrichten', 'Werkzeuge', 'Systemhinweise']) await expect(s.kaestchen(name), name).toHaveAttribute('aria-disabled', 'true');
    await expect(s.kaestchen('nur Fehler')).not.toHaveAttribute('aria-disabled', 'true');
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: true, Systemhinweise: false, 'nur Fehler': true });
    await liveSeit(page);
    // gesperrt (aria-disabled): Playwright klickt nur mit force — so wie ein Mensch, der trotzdem klickt
    await s.kaestchen('Werkzeuge').click({ force: true });
    await s.kaestchen('Systemhinweise').focus();
    await page.keyboard.press('Space');
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: true, Systemhinweise: false, 'nur Fehler': true });
    expect(await s.sichtbar()).toEqual(['lv-s5', 'lv-s8']);
    expect(await liveSeit(page)).toEqual([]);
    await s.kaestchen('nur Fehler').click();
    await expect(page.locator(STATUS)).toHaveText('13 von 14 Einträgen sichtbar.');
    expect(await s.sichtbar()).toEqual(T1_VORGABE);
    for (const name of ['Nachrichten', 'Werkzeuge', 'Systemhinweise']) await expect(s.kaestchen(name), name).not.toHaveAttribute('aria-disabled', 'true');
    await s.kaestchen('Werkzeuge').click();
    await expect(page.locator(STATUS)).toHaveText('4 von 14 Einträgen sichtbar.');
    await expect(page.locator(KEINE_FEHLER)).toHaveCount(0);
    // T4 (Bild 8): kein erkannter Fehler
    await s.oeffnen(T.T4);
    await s.gelesen();
    await page.evaluate(liveBeobachten);
    await s.kaestchen('nur Fehler').click();
    await expect(page.locator(STATUS)).toHaveText('Keine Fehler erkannt.');
    await expect(page.locator(KEINE_FEHLER)).toHaveText(KEINE_FEHLER_SATZ);
    await expect(page.locator(KEINE_FEHLER)).toBeVisible();
    await expect(page.locator('#lauf .lv-kz > div:has(dt:text-is("Fehler erkannt")) dd')).toHaveText('0');
    await expect(page.locator('#lauf .lv-ohne-ber')).toBeVisible();
    expect(await s.sichtbar()).toEqual([]);
    expect(await liveSeit(page)).toEqual(['Keine Fehler erkannt.']);
    expect(await page.locator(KEINE_FEHLER).evaluate(p => p.hasAttribute('role') || p.hasAttribute('aria-live') || Boolean(p.closest('[role=status],[role=alert],[aria-live]')))).toBe(false);
  });

  test('AK 6 · US-4: „Zeigen“ unter „Längste Schritte“, bei T4 allein; Live lässt den Stand; Sprung schaltet die Filter für eine verborgene Zeile um', async ({ page }) => {
    await s.oeffnen(T.T4);
    await s.gelesen();
    await expect(page.locator(ZEIGEN)).toBeVisible();
    await expect(page.locator('#lauf .lv-top, #lauf .lv-teu')).toHaveCount(0);
    await s.oeffnen(T.T1);
    await s.gelesen();
    expect(await page.evaluate(() => {
      const gl = document.querySelector('#lauf .lv-gl'), top = document.querySelector('#lauf .lv-top'), zeigen = document.querySelector('#lauf fieldset.lv-filt');
      return gl.contains(zeigen) && zeigen.getBoundingClientRect().top >= top.getBoundingClientRect().bottom && Boolean(top.compareDocumentPosition(zeigen) & Node.DOCUMENT_POSITION_FOLLOWING);
    })).toBe(true);
    await s.kaestchen('Werkzeuge').click();
    await s.kaestchen('nur Fehler').click();
    await expect(page.locator(STATUS)).toHaveText('2 von 14 Einträgen sichtbar.');
    const renders = await page.evaluate(() => window.kdTest.renders());
    await lv.buchen(k.adresse, 1, 'pruefer@2026-11-21T12:30+01:00', 'Reviews', 0.20);
    await expect.poll(() => page.evaluate(() => window.kdTest.renders()), 'das Live-Ereignis ist gezeichnet').toBeGreaterThan(renders);
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: false, Systemhinweise: false, 'nur Fehler': true });
    expect(await s.sichtbar()).toEqual(['lv-s5', 'lv-s8']);
    await page.evaluate(liveBeobachten);
    await page.locator('#lv-top-2').click();
    await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-s15-vor');
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: true, Systemhinweise: false, 'nur Fehler': false });
    await expect.poll(() => page.evaluate(() => {
      const kopf = document.querySelector('#kopf header').getBoundingClientRect().bottom, z = document.activeElement.getBoundingClientRect();
      return kopf <= z.top && z.top < innerHeight && z.height > 0;
    })).toBe(true);
    expect(await liveSeit(page)).toEqual([]);
    // unter der Vorgabe: der erste Eintrag (1 min 5 s) ist sichtbar, kein Kästchen ändert sich
    await s.oeffnen(T.T1);
    await s.gelesen();
    await page.locator('#lv-top-1').click();
    await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-s13-vor');
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: true, Systemhinweise: false, 'nur Fehler': false });
  });

  /* ── Blättern ── */

  /** Gesperrt heißt: aria-disabled, role=link, tabindex=0, kein href, Name ohne Pfeil, Schrift --kd-faint, Kontur --kd-line. */
  async function gesperrt(page, sel, name) {
    const link = page.locator(sel);
    await expect(link).toHaveAttribute('aria-disabled', 'true');
    await expect(link).toHaveAttribute('role', 'link');
    await expect(link).toHaveAttribute('tabindex', '0');
    await expect(link).not.toHaveAttribute('href');
    expect(await page.locator(BLATT).ariaSnapshot()).toContain(`- link "${name}" [disabled]`);
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      const f = await link.evaluate(el => {
        const token = n => { const p = document.createElement('span'); p.style.color = `var(${n})`; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
        const st = getComputedStyle(el);
        return { schrift: st.color === token('--kd-faint'), kontur: st.borderTopColor === token('--kd-line') };
      });
      expect(f, `${name} ${farbe}`).toEqual({ schrift: true, kontur: true });
    }
    await thema(page, 'light');
  }

  test('AK 7 · US-5: Folge, „Lauf k von n“, Links auf die Nachbarn; Sperrform am ersten und letzten Lauf und bei einem Lauf; T5 ohne Anfrage', async ({ page }) => {
    test.fail(ERWARTET_ROT, 'erwartet rot: rote Spezifikation vor dem Bau');
    await s.oeffnen(T.T1);
    await s.gelesen();
    await expect(page.locator(VORIGER)).toHaveText('‹ Voriger Lauf');
    await expect(page.locator(STELLE)).toHaveText('Lauf 3 von 6');
    await expect(page.locator(NAECHSTER)).toHaveText('Nächster Lauf ›');
    await expect(page.locator(VORIGER)).toHaveAttribute('href', adresse(1, T.T5));
    await expect(page.locator(NAECHSTER)).toHaveAttribute('href', adresse(1, T.T4));
    expect(await page.evaluate(k => laufAdresseBilden({ basis: 'board', slug: 'fabrik', nummer: 1, kennung: k }), T.T4)).toBe(adresse(1, T.T4));
    const snapshot = await page.locator(BLATT).ariaSnapshot();
    expect(snapshot).toContain('- link "Voriger Lauf"');
    expect(snapshot).toContain('- link "Nächster Lauf"');
    await s.oeffnen(T.T3);
    await expect(page.locator(STELLE)).toHaveText('Lauf 1 von 6');
    await gesperrt(page, VORIGER, 'Voriger Lauf');
    await s.oeffnen(T.T11);
    await expect(page.locator(STELLE)).toHaveText('Lauf 6 von 6');
    await gesperrt(page, NAECHSTER, 'Nächster Lauf');
    await s.gelesen();
    await page.evaluate(liveBeobachten);
    const vorher = await page.evaluate(() => location.hash);
    await page.locator(NAECHSTER).click({ force: true });
    expect(await page.evaluate(() => location.hash)).toBe(vorher);
    expect(await liveSeit(page)).toEqual([]);
    await s.oeffnen(T.T12, 2);
    await expect(page.locator(STELLE)).toHaveText('Lauf 1 von 1');
    await gesperrt(page, VORIGER, 'Voriger Lauf');
    await gesperrt(page, NAECHSTER, 'Nächster Lauf');
    await page.locator('#lv-h1').focus();
    expect(await perTabErreicht(page, page.locator(VORIGER)), 'gesperrt und mit Tab erreichbar').toBeGreaterThan(0);
    // T5 (fehlt) über „‹ Voriger Lauf“ von T1: Bild 4 mit „Lauf 2 von 6“
    await s.oeffnen(T.T1);
    await s.gelesen();
    await page.locator(VORIGER).click();
    await expect(page.locator(STELLE)).toHaveText('Lauf 2 von 6');
    await expect(page.locator('#lauf .lv-leer')).toContainText('Das Transkript liegt nicht auf diesem Rechner.');
  });

  test('AK 7: T5 (fehlt) über „‹ Voriger Lauf“ von T1 — „Lauf 2 von 6“, Bild 4 und keine Anfrage an …/transkripte/…', async ({ page }) => {
    // Widerspruch (Bericht #253, Fragen): `a.transkripte` trägt keinen Zustand, und Server, OpenAPI und Format bleiben unverändert (R00239);
    // ADR-0041 N1 Punkt 5: „der Zustand ist ohne GET …/transkripte nicht bekannt“. Bis zur Entscheidung bleibt die Probe rot.
    test.fail(true, 'erwartet rot: „ohne Anfrage“ ist ohne Zustand in a.transkripte nicht baubar (ADR-0041 N1 Punkt 5)');
    await s.oeffnen(T.T1);
    await s.gelesen();
    const anfragen = [];
    page.on('request', r => { if (istTranskript(r.url())) anfragen.push(r.url()); });
    await page.locator(VORIGER).click();
    await expect(page.locator('#lauf .lv-leer')).toContainText('Das Transkript liegt nicht auf diesem Rechner.');
    expect(anfragen).toEqual([]);
  });

  test('AK 8 · US-5: Wechsel mit replaceState — Abbruch der gehaltenen Anfrage, Ansagen je Wechsel, Fokus auf dem Link, Rückweg zu „Läufe“', async ({ page }) => {
    test.fail(ERWARTET_ROT, 'erwartet rot: rote Spezifikation vor dem Bau');
    const wartend = [];
    await page.route(url => istTranskriptVon(url.href, T.T3), route => wartend.push(route));
    await s.laeufeVonEins();
    await s.ansehen(T.T3);
    await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
    const laenge = await page.evaluate(() => history.length);
    const abgebrochen = page.waitForEvent('requestfailed', r => istTranskriptVon(r.url(), T.T3));
    await page.evaluate(liveBeobachten);
    await page.locator(NAECHSTER).click();
    await abgebrochen;
    await expect(page.locator(STELLE)).toHaveText('Lauf 2 von 6');
    await expect(page.locator(STATUS)).toHaveText('Lauf 2 von 6, code-reviewer. Das Transkript liegt nicht auf diesem Rechner.');
    expect(await liveSeit(page)).toEqual(['Lauf 2 von 6, code-reviewer. Das Transkript liegt nicht auf diesem Rechner.']);
    await expect.poll(() => wartend.length).toBe(1);
    await wartend[0].continue().catch(() => { });
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    await expect(page.locator(STELLE)).toHaveText('Lauf 2 von 6');
    await expect(page.locator('#lauf .lv-leer')).toBeVisible();
    for (const [stelle, satz] of [['Lauf 3 von 6', 'Lauf 3 von 6, planer. Ende des Transkripts'], ['Lauf 4 von 6', 'Lauf 4 von 6, architekt. Ende des Transkripts']]) {
      await page.locator(NAECHSTER).focus();
      await page.keyboard.press('Enter');
      await expect(page.locator(STELLE)).toHaveText(stelle);
      await expect(page.locator(STATUS)).toHaveText(satz);
      expect(await liveSeit(page), stelle).toEqual(['Liest das Transkript …', satz]);
    }
    expect(await page.evaluate(() => [location.hash, history.length, document.activeElement.id])).toEqual([adresse(1, T.T4), laenge, 'lv-nach']);
    await page.locator('#lv-rueckweg').click();
    await expect(page.locator('#laeufe-kopf')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    // am Rand: der Fokus bleibt auf dem jetzt gesperrten Link
    await s.oeffnen(T.T10);
    await s.gelesen();
    await page.evaluate(liveBeobachten);
    await page.locator(NAECHSTER).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(STELLE)).toHaveText('Lauf 6 von 6');
    await expect(page.locator(STATUS)).toHaveText('Lauf 6 von 6, entwickler, letzter Lauf. Ende des Transkripts');
    expect(await page.evaluate(() => [document.activeElement.id, document.activeElement.getAttribute('aria-disabled')])).toEqual(['lv-nach', 'true']);
    await liveSeit(page);
    await page.locator(NAECHSTER).click({ force: true });
    expect(await liveSeit(page)).toEqual([]);
    // Filter beim Blättern (PO Z. 583)
    await s.laeufeVonEins();
    await s.ansehen(T.T1);
    await s.gelesen();
    await s.kaestchen('nur Fehler').click();
    await page.locator(NAECHSTER).click();
    await expect(page.locator(STELLE)).toHaveText('Lauf 4 von 6');
    await expect(s.kaestchen('nur Fehler')).toBeChecked();
    await expect(page.locator(KEINE_FEHLER)).toHaveText(KEINE_FEHLER_SATZ);
    await expect(page.locator(KEINE_FEHLER)).toBeVisible();
    await page.locator('#lv-rueckweg').click();
    await expect(page.locator('#laeufe-kopf')).toBeVisible();
    await s.ansehen(T.T1);
    await s.gelesen();
    expect(await s.stand()).toEqual({ Nachrichten: true, Werkzeuge: true, Systemhinweise: false, 'nur Fehler': false });
  });

  /* ── Live und Darstellung ── */

  test('AK 9: ein neues Transkript ändert „Lauf k von n“ ohne neues Lesen; Insel, Klappzustand, Filter, Fokus und Live-Regionen bleiben', async ({ page }) => {
    test.fail(ERWARTET_ROT, 'erwartet rot: rote Spezifikation vor dem Bau');
    await s.oeffnen(T.T1);
    await s.gelesen();
    await expect(page.locator(STELLE)).toHaveText('Lauf 3 von 6');
    await s.kaestchen('Systemhinweise').click();
    await expect(page.locator(STATUS)).toHaveText('14 von 14 Einträgen sichtbar.');
    await page.locator('#lv-s3 summary').click();
    await expect(page.locator('#lv-s3 details')).toHaveAttribute('open', '');
    await s.markieren();
    const anfragen = [];
    page.on('request', r => { if (istTranskript(r.url())) anfragen.push(r.url()); });
    await page.evaluate(liveBeobachten);
    await lv.hochladen(k.adresse, 1, 'planer@2026-11-21T07:00+01:00', 'Detailplanung', lv.gz(t1Text()));
    await expect(page.locator(STELLE)).toHaveText('Lauf 4 von 7');
    await expect(page.locator(VORIGER)).toHaveAttribute('href', adresse(1, T.T5));
    expect(anfragen).toEqual([]);
    expect(await s.markeSteht()).toBe(true);
    await expect(page.locator('#lv-s3 details')).toHaveAttribute('open', '');
    expect((await s.stand()).Systemhinweise).toBe(true);
    expect(await s.auswertungen()).toBe(1);
    expect(await page.evaluate(() => document.activeElement.closest('li') && document.activeElement.closest('li').id)).toBe('lv-s3');
    expect(await liveSeit(page)).toEqual([]);
  });

  const BREITEN = [320, 641, 980, 1280];
  test('AK 10: Breite — T1 und T10 ohne Querscrollen; Balken ohne Überlauf bei 320/375/414 px; Spalte 232/200 px; Lage unter 641 px', async ({ page }) => {
    test.fail(ERWARTET_ROT, 'erwartet rot: rote Spezifikation vor dem Bau');
    test.setTimeout(90000);
    for (const kennung of [T.T1, T.T10]) {
      await s.oeffnen(kennung);
      await s.gelesen();
      for (const b of BREITEN) {
        await breiteSetzen(page, b);
        for (const farbe of ['light', 'dark']) {
          await thema(page, farbe);
          const zuBreit = await page.evaluate(() => [['Dokument', document.documentElement], ['Seite', document.getElementById('lauf')], ['Leiste', document.querySelector('#lauf .lv-leiste')], ['Zeitachse', document.querySelector('#lauf .lv-za')], ['Balken', document.querySelector('#lauf .lv-balken')]]
            .filter(([, el]) => el.scrollWidth > el.clientWidth).map(([ort, el]) => `${ort} ${el.scrollWidth} > ${el.clientWidth}`));
          expect(zuBreit, `${kennung} ${b} ${farbe}`).toEqual([]);
        }
      }
    }
    await thema(page, 'light');
    for (const kennung of [T.T1, T.T3, T.T10, T.T11]) {
      await s.oeffnen(kennung);
      await s.gelesen();
      for (const b of [320, 375, 414]) {
        await breiteSetzen(page, b);
        const m = await page.locator(BALKEN).evaluate(bk => {
          const r = bk.getBoundingClientRect(), teile = [...bk.children].map(t => t.getBoundingClientRect());
          return { ueber: bk.scrollWidth > bk.clientWidth, rechts: teile[teile.length - 1].right - r.right, breiten: teile.map(t => t.width), faecher: bk.classList.contains('faecher') };
        });
        expect(m.ueber, `${kennung} ${b}`).toBe(false);
        expect(m.rechts, `${kennung} ${b}`).toBeLessThanOrEqual(0.5);
        if (kennung === T.T10) expect(Math.max(...m.breiten) - Math.min(...m.breiten), `Fächer gleich breit bei ${b}`).toBeLessThanOrEqual(0.5);
      }
    }
    await s.oeffnen(T.T1);
    await s.gelesen();
    for (const [b, breite] of [[1280, 232], [980, 200]]) {
      await breiteSetzen(page, b);
      expect(Math.round(await page.locator('#lauf .lv-gl').evaluate(g => g.getBoundingClientRect().width)), `${b} px`).toBe(breite);
    }
    await breiteSetzen(page, 320);
    expect(await page.evaluate(() => {
      const r = sel => document.querySelector(sel).getBoundingClientRect();
      const ber = document.querySelector('#lauf .lv-ber'), gl = document.querySelector('#lauf .lv-gl');
      const ersterEintrag = [...document.querySelectorAll('#lv-insel > li')].find(l => l.getBoundingClientRect().height > 0).getBoundingClientRect();
      const zeitpunkt = [...document.querySelectorAll('#lauf .lv-leiste > span')].find(x => x.textContent.startsWith('ZEITPUNKT')).getBoundingClientRect();
      return { berichtUeberListen: r('#lauf .lv-ber').bottom <= r('#lauf .lv-top').top, zeigenUeberEintraegen: r('#lauf fieldset.lv-filt').bottom <= ersterEintrag.top,
        berichtVorGliederung: Boolean(ber.compareDocumentPosition(gl) & Node.DOCUMENT_POSITION_FOLLOWING), blaetternEigeneZeile: r('#lauf nav.lv-blatt').top >= zeitpunkt.bottom };
    })).toEqual({ berichtUeberListen: true, zeigenUeberEintraegen: true, berichtVorGliederung: true, blaetternEigeneZeile: true });
  });

  test('AK 10: Themen und Zugänglichkeit — Stücke ≥ 3:1, Wörter ≥ 4,5:1, gesperrt ≥ 3:1, Fokusring, Legende verborgen, kein Stück ein Tab-Ziel', async ({ page }) => {
    test.fail(ERWARTET_ROT, 'erwartet rot: rote Spezifikation vor dem Bau');
    await breiteSetzen(page, 320);
    await s.oeffnen(T.T1);
    await s.gelesen();
    // ein Warten-Teil unter 6 px ist einfarbig, ab 6 px gestreift
    const muster = await page.locator(TEILE).evaluateAll(ts => ts.filter(t => t.classList.contains('t')).map(t => [Math.round(t.getBoundingClientRect().width * 10) / 10, getComputedStyle(t.firstElementChild).backgroundImage !== 'none']));
    expect(muster.length).toBe(2);
    expect(muster[0][0]).toBeLessThan(6);
    expect(muster[0][1], 'schmal einfarbig').toBe(false);
    expect(muster[1][0]).toBeGreaterThanOrEqual(6);
    expect(muster[1][1], 'breit gestreift').toBe(true);
    await breiteSetzen(page, 1280);
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      const f = await page.evaluate(() => {
        const token = n => { const p = document.createElement('span'); p.style.color = `var(${n})`; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
        const teil = art => getComputedStyle(document.querySelector(`#lauf .lv-balken > span.${art}`)).backgroundColor;
        return { flaeche: token('--kd-surface'), w: teil('w'), d: teil('d'), t: teil('t') };
      });
      for (const art of ['w', 'd', 't']) expect(await kontrastFarben(page, f[art], f.flaeche), `${art} ${farbe}`).toBeGreaterThanOrEqual(3);
      expect(await kontrastVerstoesse(page, [ZA, ZEIGEN, BLATT]), farbe).toEqual([]);
      expect(await kontrastAm(page.locator(STELLE)), `Lauf k von n ${farbe}`).toBeGreaterThanOrEqual(4.5);
    }
    await thema(page, 'light');
    await expect(page.locator(`${ZA} .lv-leg`)).toHaveAttribute('aria-hidden', 'true');
    expect(await page.locator(TEILE).evaluateAll(ts => ts.filter(t => t.tabIndex >= 0 || t.querySelector('[tabindex]')).length)).toBe(0);
    // gesperrte Kästchen und Links: Schrift ≥ 3:1, Fokusring ≥ 2 px und ≥ 3:1
    await s.kaestchen('nur Fehler').click();
    await expect(page.locator(STATUS)).toHaveText('2 von 14 Einträgen sichtbar.');
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      for (const sel of [`${ZEIGEN} label:has(input[aria-disabled="true"])`]) {
        const labels = page.locator(sel);
        expect(await labels.count()).toBe(3);
        for (let i = 0; i < 3; i++) expect(await kontrastAm(labels.nth(i)), `${farbe} Kästchen ${i}`).toBeGreaterThanOrEqual(3);
      }
      for (const name of ['Werkzeuge', 'nur Fehler']) {
        await s.kaestchen(name).focus();
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        const ring = await s.kaestchen(name).evaluate(el => { const st = getComputedStyle(el); return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth), farbe: st.outlineColor }; });
        expect(ring.stil, `${name} ${farbe}`).not.toBe('none');
        expect(ring.breite).toBeGreaterThanOrEqual(2);
        const grund = await page.evaluate(() => { const p = document.createElement('span'); p.style.color = 'var(--kd-surface)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
        expect(await kontrastFarben(page, ring.farbe, grund), `${name} ${farbe} Ring`).toBeGreaterThanOrEqual(3);
      }
    }
    await thema(page, 'light');
    await s.oeffnen(T.T3);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      expect(await kontrastAm(page.locator(VORIGER)), `gesperrter Link ${farbe}`).toBeGreaterThanOrEqual(3);
      await page.locator(VORIGER).focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      const ring = await page.locator(VORIGER).evaluate(el => { const st = getComputedStyle(el); return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth) }; });
      expect(ring.stil, farbe).not.toBe('none');
      expect(ring.breite, farbe).toBeGreaterThanOrEqual(2);
    }
    // Ziele bei feinem Zeiger ≥ 24 px
    const hoehen = await page.locator(`${ZEIGEN} label, ${BLATT} a`).evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(hoehen.length).toBe(6);
    expect(Math.min(...hoehen)).toBeGreaterThanOrEqual(24);
  });
});

test.describe('R00239 Laufansicht: Ziele bei grobem Zeiger', () => {
  test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    await ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  test('AK 10: Kästchen samt Beschriftung und die Links des Blätterns ≥ 48 px hoch', async ({ page }) => {
    test.fail(ERWARTET_ROT, 'erwartet rot: rote Spezifikation vor dem Bau');
    await page.goto(k.adresse + adresse(1, T.T1));
    await expect(page.locator(STATUS)).toHaveText(ENDE);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const hoehen = await page.locator(`${ZEIGEN} label, ${BLATT} a`).evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(hoehen.length).toBe(6);
    expect(Math.min(...hoehen)).toBeGreaterThanOrEqual(48);
  });
});
