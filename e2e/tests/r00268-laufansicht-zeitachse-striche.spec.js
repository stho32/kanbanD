// R00268 Laufansicht — Commits als Striche in der Zeitachse (Karte #271, I0241, F0199, ADR-0041 N8), Ausbaustufe 2, im echten
// Programm. Ausgangslage: Aufgabe #1 mit T17 (R00251 „Ausgangslage“) bzw. 40 gleichmäßig verteilten Commit-Schritten; die Commits
// der Karte kommen wie in R00251 aus `GET …/commits` (hier als gehaltene Antwort, die Hashes sind erfunden). Testfälle in
// Fachwörtern; Selektoren nur in der Sprache. Gehaltene Antworten statt Schlafzeiten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, thema, kontrastAm } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T17, T17_KENNUNG, T17_COMMITS } = require('./laufansicht-t17');

/* ── Die Commits der Karte: T17 und ein Lauf aus `n` gleichmäßigen Commit-Schritten ── */

const hashVon = name => (Buffer.from(name).toString('hex') + '0'.repeat(40)).slice(0, 40);
const kurz = hash => hash.slice(0, 7);
const KARTE_T17 = ['C1', 'C2', 'C3', 'C5a', 'C5b', 'C6'].map(name => {
  const c = T17_COMMITS.find(x => x.name === name);
  return { verweis: `kd:${hashVon(name)}`, hash: hashVon(name), zustand: 'auf_zweig', titel: c.titel, autordatum: c.autordatum };
});
const KURZ_T17 = Object.fromEntries(['C1', 'C2', 'C3', 'C5a', 'C5b', 'C6'].map(n => [n, kurz(hashVon(n))]));

const BASIS = Date.parse('2026-11-22T12:00:00+01:00');
const SEKUNDE_JE_SCHRITT = 10;
/** Der Zeitpunkt des `i`-ten Schritts (`plus` Sekunden später) als ISO-Zeit mit `Z`. */
const schrittZeit = (i, plus = 0) => new Date(BASIS + (i * SEKUNDE_JE_SCHRITT + plus) * 1000).toISOString();
/** Ein Hash je Schritt, der sich schon in den ersten sieben Zeichen unterscheidet. */
const schrittHash = i => (i + 1).toString(16).padStart(8, '0').repeat(5);
/** `n` Commit-Schritte im Abstand von 10 s: je Schritt ein `git commit`-Aufruf und sein Ergebnis eine Sekunde später. */
function schrittLauf(n) {
  const eintraege = [];
  for (let i = 0; i < n; i++) {
    eintraege.push({ zeit: schrittZeit(i), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: `a${i}`, text: JSON.stringify({ command: `git commit -q -m "Schritt ${i}"` }) });
    eintraege.push({ zeit: schrittZeit(i, 1), art: 'werkzeugergebnis', wer: 'werkzeug', zu: `a${i}`, text: '' });
  }
  return eintraege;
}
function schrittKarte(n) {
  return Array.from({ length: n }, (_, i) => {
    const hash = schrittHash(i);
    return { verweis: `kd:${hash}`, hash, zustand: 'auf_zweig', titel: `Schritt ${i}`, autordatum: Date.parse(schrittZeit(i)) / 1000 };
  });
}

/** Board `fabrik` (erfasst Transkripte) mit #1, die Läufe kommen über die API; die Commits der Karte hält die Probe als Antwort. */
function ausgangslage() {
  return lv.ausgangslage();
}

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const STATUS = '#lv-status';
const INSEL = '#lv-insel';
const adresse = (kennung, nr = 1) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;
const istCommits = url => new URL(url).pathname === '/api/aufgaben/1/commits';

const sprache = (page, k) => ({
  async oeffnen(kennung) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(k.adresse + adresse(kennung));
  },
  async gelesen() {
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
  },
  /** Die Zeitachse: der Balkenbereich (`.lv-bw`) und die Knopfleiste. */
  achse: () => page.locator('#lauf .lv-bw'),
  knopfleiste: () => page.locator('#lauf .lv-ck'),
  knoepfe: () => page.locator('#lauf .lv-ck .lv-ckb'),
  /** Je Knopf: die sichtbare Beschriftung, die Mitte des Strichs `i` in px der Achse, die Mitte in % und die Breite der Beschriftung. */
  striche: () => page.locator('#lauf .lv-bw').evaluate(bw => {
    const achse = bw.getBoundingClientRect();
    return [...bw.querySelectorAll('.lv-ck .lv-ckb')].map(knopf => {
      const strich = knopf.querySelector('i').getBoundingClientRect();
      const beschriftung = knopf.querySelector('.t').getBoundingClientRect();
      const mitte = strich.left + strich.width / 2 - achse.left;
      return { text: knopf.querySelector('.t').textContent.trim(), mittePx: mitte,
        mitteProzent: mitte / achse.width * 100, breitePx: beschriftung.width };
    });
  }),
  /** Die Antwort der Trefferprobe: Mitte jedes Strichs in Dokumentkoordinaten, getroffen über `elementFromPoint`. */
  treffer: () => page.evaluate(() => {
    const bw = document.querySelector('#lauf .lv-bw');
    const m = bw.getBoundingClientRect();
    return [...bw.querySelectorAll('.lv-ck .lv-ckb')].map(knopf => {
      const strich = knopf.querySelector('i').getBoundingClientRect();
      const x = strich.left + strich.width / 2, y = strich.top + strich.height / 2;
      const getroffen = document.elementFromPoint(x - window.scrollX, y - window.scrollY);
      const treffer = getroffen ? getroffen.closest('.lv-ckb') : null;
      return { text: knopf.querySelector('.t').textContent.trim(), trifft: treffer === knopf, x, y, achse: m.width };
    });
  }),
  /** Je Knopf: liegt die Beschriftung ganz in der Zeitachse, und um wie viel ragt sie sonst hinaus? */
  beschriftungen: () => page.locator('#lauf .lv-za').evaluate(za => {
    const aussen = za.getBoundingClientRect();
    return [...za.querySelectorAll('.lv-ck .lv-ckb .t')].map(t => {
      const r = t.getBoundingClientRect();
      return { text: t.textContent.trim(), links: r.left - aussen.left, rechts: aussen.right - r.right, ganzInnen: r.left >= aussen.left && r.right <= aussen.right };
    });
  }),
  achsenbreite: () => page.locator('#lauf .lv-bw').evaluate(bw => bw.getBoundingClientRect().width),
  insel: () => page.locator(INSEL),
  zeitachseHtml: () => page.locator('#lauf .lv-za').evaluate(el => el.outerHTML),
  /** Die Zahl der Ersetzungen der Knopfleiste zählt die Probe im Browser (MutationObserver am Dokument). */
  ersetzzungen: () => page.evaluate(() => window.KD_ERSETZUNGEN ? window.KD_ERSETZUNGEN.n : -1),
  ersetzzungenZuruecksetzen: () => page.evaluate(() => { window.KD_ERSETZUNGEN.n = 0; }),
});

/** Läuft im Browser vor jeder Seite: zählt jede Ersetzung der Knopfleiste (childList an `.lv-ck`). Der Beobachter hängt am
    Fenster, sonst räumt ihn die Speicherbereinigung ab. */
function ersetzzungenZaehlen() {
  window.KD_ERSETZUNGEN = { n: 0, beobachter: null };
  const beobachter = new MutationObserver(aenderungen => {
    for (const a of aenderungen) if (a.type === 'childList' && a.target.classList && a.target.classList.contains('lv-ck')) window.KD_ERSETZUNGEN.n++;
  });
  window.KD_ERSETZUNGEN.beobachter = beobachter;
  beobachter.observe(document, { childList: true, subtree: true });
}

const zahlAus = text => {
  const treffer = /^(\d+) Commits$/.exec(text);
  return treffer ? Number(treffer[1]) : 1;
};

test.describe('R00268 Laufansicht: Striche in der Zeitachse', () => {
  let k, s;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(ausgangslage());
    s = sprache(page, k);
  });
  test.afterEach(async () => {
    await k.stoppen();
  });

  /* ── B1465: Lage, Verdichtung nach Abstand, Breitenwechsel ── */

  test('AK 1 · US-1: T17 bei 1280 px — fünf Striche an den Stellen der Ergebnisse 3, 7, 9, 13 und 15, „2 Commits“ am Ergebnis 7', async ({ page }) => {
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: KARTE_T17 }) }));
    await lv.hochladen(k.adresse, 1, T17_KENNUNG, 'Entwicklung', lv.gz(T17.map(lv.zeile).join('')));
    await page.setViewportSize({ width: 1280, height: 900 });
    await s.oeffnen(T17_KENNUNG);
    await s.gelesen();
    const striche = await s.striche();
    expect(striche.map(x => x.text)).toEqual([KURZ_T17.C1, '2 Commits', 'e5f6a7b', KURZ_T17.C5a, KURZ_T17.C5b]);
    // Ergebnisse 3, 7, 9, 13, 15 von 11:00:00 bis 11:02:00: 12,9 / 31,6 / 41 / 65,3 / 100,2 Sekunden
    const prozent = [12900, 31600, 41000, 65300, 100200].map(t => t / 1200);
    const breite = await s.achsenbreite();
    striche.forEach((x, i) => expect(Math.abs(x.mitteProzent - prozent[i]) * breite / 100, `${x.text} an seiner Stelle`).toBeLessThanOrEqual(1));
  });

  test('AK 1: T17 — der Strich steht an der Prozentstelle der Balkenbreite (Rechenbeispiel 100 s, Ergebnis bei 25 s)', async ({ page }) => {
    const kennung = 'rechenbeispiel@2026-11-22T12:00+01:00';
    const lauf = [
      { zeit: '2026-11-22T12:00:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: 'a', text: JSON.stringify({ command: 'git commit -q -m "Titel im Befehl"' }) },
      { zeit: '2026-11-22T12:00:25+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', zu: 'a', text: '' },
      { zeit: '2026-11-22T12:00:50+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: 'b', text: JSON.stringify({ command: 'cargo test -q' }) },
      { zeit: '2026-11-22T12:01:40+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', zu: 'b', text: '' },
    ];
    const hash = hashVon('Titel im Befehl');
    const commits = [{ verweis: `kd:${hash}`, hash, zustand: 'auf_zweig', titel: 'Titel im Befehl', autordatum: Date.parse('2026-11-22T12:00:25+01:00') / 1000 }];
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits }) }));
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(lauf.map(lv.zeile).join('')));
    await page.setViewportSize({ width: 1000, height: 900 });
    await s.oeffnen(kennung);
    await s.gelesen();
    const striche = await s.striche();
    expect(striche).toHaveLength(1);
    expect(striche[0].text).toBe(kurz(hash));
    const abweichung = Math.abs(striche[0].mitteProzent - 25) / 100 * await s.achsenbreite();
    expect(abweichung, '25 % der Balkenbreite').toBeLessThanOrEqual(1);
  });

  for (const breite of [1280, 320]) {
    test(`AK 2 · US-3 · M1 wörtlich: 40 Commit-Schritte, gleichmäßig verteilt, bei ${breite} px — Mitten ≥ 24 px, keine Überschneidung, Σn = 40, jede Mitte trifft ihren Knopf`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 900 });
      const kennung = `schritte-${breite}@2026-11-22T12:00+01:00`;
      await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: schrittKarte(40) }) }));
      await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(schrittLauf(40).map(lv.zeile).join('')));
      await s.oeffnen(kennung);
      await s.gelesen();
      const striche = await s.striche();
      expect(striche.length).toBeGreaterThan(0);
      expect(striche.length).toBeLessThan(40);
      expect(striche.reduce((summe, x) => summe + zahlAus(x.text), 0)).toBe(40);
      for (let i = 1; i < striche.length; i++) {
        const abstand = striche[i].mittePx - striche[i - 1].mittePx;
        expect(abstand, `Mitten ${striche[i - 1].text} und ${striche[i].text}`).toBeGreaterThanOrEqual(24);
        expect(abstand, `Beschriftungen von ${striche[i - 1].text} und ${striche[i].text} überschneiden sich nicht`)
          .toBeGreaterThanOrEqual((striche[i - 1].breitePx + striche[i].breitePx) / 2);
      }
      for (const treffer of await s.treffer()) expect(treffer.trifft, `Mitte von „${treffer.text}“ trifft ihren Knopf`).toBe(true);
    });
  }

  test('AK 2 · US-3 (Muss): T17 bei 1280 px und 40 Schritte bei 320 px — der Strich bleibt an seiner Prozentstelle, jede Beschriftung ganz in der Zeitachse', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: KARTE_T17 }) }));
    await lv.hochladen(k.adresse, 1, T17_KENNUNG, 'Entwicklung', lv.gz(T17.map(lv.zeile).join('')));
    const kennung = 'schritte-320-muss@2026-11-22T12:00+01:00';
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(schrittLauf(40).map(lv.zeile).join('')));
    await s.oeffnen(T17_KENNUNG);
    await s.gelesen();
    const breite = await s.achsenbreite();
    const prozent = [12900, 31600, 41000, 65300, 100200].map(t => t / 1200);
    (await s.striche()).forEach((x, i) => expect(Math.abs(x.mitteProzent - prozent[i]) * breite / 100, `Strich ${i}`).toBeLessThanOrEqual(1));
    for (const b of await s.beschriftungen()) expect(b.ganzInnen, `„${b.text}“ ragt links ${b.links.toFixed(1)} px, rechts ${b.rechts.toFixed(1)} px`).toBe(true);
  });

  test('AK 3 · US-3: Breitenwechsel 1280 → 320 → 1280 — neu verdichtet ohne Anfrage und ohne neues Zeichnen der Insel, je Durchlauf eine Ersetzung', async ({ page }) => {
    const gesehen = [];
    await page.addInitScript(ersetzzungenZaehlen);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: schrittKarte(40) }) }));
    const kennung = 'breitenwechsel@2026-11-22T12:00+01:00';
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(schrittLauf(40).map(lv.zeile).join('')));
    page.on('request', r => gesehen.push(r.url()));
    await s.oeffnen(kennung);
    await s.gelesen();
    const erste = (await s.striche()).length;
    expect(erste).toBeGreaterThan(0);
    await s.insel().evaluate(el => { el.__probe = true; });
    await page.evaluate(() => document.fonts.ready);
    for (const breite of [320, 1280]) {
      await s.ersetzzungenZuruecksetzen();
      const vorher = gesehen.length;
      await page.setViewportSize({ width: breite, height: 900 });
      await expect.poll(() => s.striche().then(striche => striche.length)).toBeGreaterThan(0);
      await expect.poll(() => s.ersetzzungen(), `${breite} px: Ersetzungen der Knopfleiste`).toBeGreaterThanOrEqual(1);
      const striche = await s.striche();
      for (let i = 1; i < striche.length; i++) {
        expect(striche[i].mittePx - striche[i - 1].mittePx, `${breite} px: Mitten benachbarter Knöpfe`).toBeGreaterThanOrEqual(24);
      }
      expect(await s.ersetzzungen(), `${breite} px: genau eine Ersetzung je Durchlauf`).toBe(1);
      expect(gesehen.length - vorher, `${breite} px: keine neue Anfrage`).toBe(0);
    }
    expect(await s.insel().evaluate(el => el.__probe === true), 'die Insel bleibt derselbe Knoten').toBe(true);
  });
});
