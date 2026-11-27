// R00268 Laufansicht — Commits als Striche in der Zeitachse (Karte #271, I0241, F0199, ADR-0041 N8), Ausbaustufe 2, im echten
// Programm. Ausgangslage: Aufgabe #1 mit T17 (R00251 „Ausgangslage“) bzw. 40 gleichmäßig verteilten Commit-Schritten; die Commits
// der Karte kommen wie in R00251 aus `GET …/commits` (hier als gehaltene Antwort, die Hashes sind erfunden). Testfälle in
// Fachwörtern; Selektoren nur in der Sprache. Gehaltene Antworten statt Schlafzeiten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, thema, kontrastAm, kontrastFarben } = require('./hilfen');
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

/** Ein Lauf mit Zeitachse, aber ohne Commit-Aufruf: zwei Bash-Schritte und eine Nachricht. */
function ohneCommitLauf() {
  return [
    { zeit: schrittZeit(0), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: 'a', text: JSON.stringify({ command: 'cargo test -q' }) },
    { zeit: schrittZeit(0, 1), art: 'werkzeugergebnis', wer: 'werkzeug', zu: 'a', text: 'test result: ok' },
    { zeit: schrittZeit(0, 30), art: 'nachricht', wer: 'agent', text: 'Fertig.' },
  ];
}

/** Ein Lauf mit genau einem Commit (Titel „Einzeltitel“) und seiner Karte. */
const EINZEL_HASH = schrittHash(0);
const EINZEL_TITEL = 'Einzeltitel';
function einzelLauf() {
  return [
    { zeit: schrittZeit(0), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: 'a', text: JSON.stringify({ command: `git commit -q -m "${EINZEL_TITEL}"` }) },
    { zeit: schrittZeit(0, 1), art: 'werkzeugergebnis', wer: 'werkzeug', zu: 'a', text: '' },
    { zeit: schrittZeit(0, 30), art: 'nachricht', wer: 'agent', text: 'Fertig.' },
  ];
}
const EINZEL_KARTE = [{ verweis: `kd:${EINZEL_HASH}`, hash: EINZEL_HASH, zustand: 'auf_zweig', titel: EINZEL_TITEL, autordatum: Date.parse(schrittZeit(0)) / 1000 }];

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
  /** Je Knopf: die sichtbare Beschriftung, die Mitte des Strichs `i` in px der Achse, die Mitte in % und das Rechteck der
      Beschriftung (linke und rechte Kante in px der Achse). */
  striche: () => page.locator('#lauf .lv-bw').evaluate(bw => {
    const achse = bw.getBoundingClientRect();
    return [...bw.querySelectorAll('.lv-ck .lv-ckb')].map(knopf => {
      const strich = knopf.querySelector('i').getBoundingClientRect();
      const beschriftung = knopf.querySelector('.t').getBoundingClientRect();
      const mitte = strich.left + strich.width / 2 - achse.left;
      return { text: knopf.querySelector('.t').textContent.trim(), mittePx: mitte,
        mitteProzent: mitte / achse.width * 100, breitePx: beschriftung.width,
        links: beschriftung.left - achse.left, rechts: beschriftung.right - achse.left };
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
    test(`AK 2 · US-3 · M1 wörtlich: 40 Commit-Schritte, gleichmäßig verteilt, bei ${breite} px — Mitten ≥ 24 px, die Rechtecke der Beschriftungen schneiden sich nicht, Σn = 40, jede Mitte trifft ihren Knopf`, async ({ page }) => {
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
        expect(striche[i - 1].rechts, `Rechtecke von ${striche[i - 1].text} (${striche[i - 1].rechts.toFixed(2)} px) und ${striche[i].text} (${striche[i].links.toFixed(2)} px) schneiden sich nicht`)
          .toBeLessThanOrEqual(striche[i].links + 0.5);
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
    for (const breite of [320, 1280, 1210]) {
      await s.ersetzzungenZuruecksetzen();
      const vorher = gesehen.length;
      await page.setViewportSize({ width: breite, height: 900 });
      await expect.poll(() => s.striche().then(striche => striche.length)).toBeGreaterThan(0);
      await expect.poll(() => s.ersetzzungen(), `${breite} px: Ersetzungen der Knopfleiste`).toBeGreaterThanOrEqual(1);
      const striche = await s.striche();
      for (let i = 1; i < striche.length; i++) {
        expect(striche[i].mittePx - striche[i - 1].mittePx, `${breite} px: Mitten benachbarter Knöpfe`).toBeGreaterThanOrEqual(24);
      }
      // 1210 px liegt in derselben Fensterklasse wie 1280 (kopfzeile.js): der Wechsel löst kein Neuzeichnen aus, nur der Beobachter verdichtet
      expect(await s.ersetzzungen(), `${breite} px: genau eine Ersetzung je Durchlauf`).toBe(1);
      expect(gesehen.length - vorher, `${breite} px: keine neue Anfrage`).toBe(0);
    }
    expect(await s.insel().evaluate(el => el.__probe === true), 'die Insel bleibt derselbe Knoten').toBe(true);
  });

  /* ── B1466: Gruppe, Tastatur, Sprung, Zielfläche, Legende, Lesetext, Filter und Grenzen ── */

  /** T17 an #1 mit den Commits der Karte; öffnet den Lauf. */
  const t17Oeffnen = async page => {
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: KARTE_T17 }) }));
    await lv.hochladen(k.adresse, 1, T17_KENNUNG, 'Entwicklung', lv.gz(T17.map(lv.zeile).join('')));
    await s.oeffnen(T17_KENNUNG);
    await s.gelesen();
  };
  const KNOPF = '#lauf .lv-ck .lv-ckb';
  const T17_NAMEN = [`Commit ${KURZ_T17.C1}, zur Zeile springen`, '2 Commits, zur ersten Zeile springen',
    'Commit e5f6a7b, zur Zeile springen', `Commit ${KURZ_T17.C5a}, zur Zeile springen`, `Commit ${KURZ_T17.C5b}, zur Zeile springen`];

  test('AK 4 · US-2 · M2 wörtlich: T17 — Knöpfe in einer Gruppe „Commits der Zeitachse“ neben dem Bild, Namen mit dem sichtbaren Text', async ({ page }) => {
    await t17Oeffnen(page);
    const gruppe = page.locator('#lauf .lv-ck');
    await expect(gruppe).toHaveAttribute('role', 'group');
    await expect(gruppe).toHaveAttribute('aria-label', 'Commits der Zeitachse');
    const knoepfe = await page.locator(KNOPF).evaluateAll(alle => alle.map(k => ({
      name: k.getAttribute('aria-label'),
      imBild: k.closest('[role="img"]') === null,
      sichtbarImNamen: (k.getAttribute('aria-label') || '').includes(k.querySelector('.t').textContent.trim()),
      geschwisterDesBildes: k.closest('.lv-bw') !== null && !k.closest('[role="img"]'),
    })));
    expect(knoepfe.map(k => k.name)).toEqual(T17_NAMEN);
    for (const k of knoepfe) {
      expect(k.imBild, 'nie im role="img"-Balken').toBe(true);
      expect(k.geschwisterDesBildes, 'neben dem Balken').toBe(true);
      expect(k.sichtbarImNamen, 'der Name enthält den sichtbaren Text').toBe(true);
    }
  });

  test('AK 5 · US-2 · S1: ein Tab-Stopp, der nächste Tab verlässt die Gruppe, Pfeile und Pos1/Ende, Umriss ganz im Blick', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await t17Oeffnen(page);
    const tabStopps = () => page.locator(`${KNOPF}[tabindex="0"]`).count();
    expect(await tabStopps(), 'genau ein Knopf ist der Tab-Stopp').toBe(1);
    // von vorne durchtabben, bis der Fokus in der Gruppe steht: der erste Tab trifft genau einen Knopf
    let schritte = 0;
    while (schritte < 40 && !(await page.evaluate(() => Boolean(document.activeElement.closest && document.activeElement.closest('#lauf .lv-ck'))))) {
      await page.keyboard.press('Tab');
      schritte++;
    }
    expect(schritte, 'die Gruppe ist mit der Tastatur erreichbar').toBeLessThan(40);
    expect(await page.locator(`${KNOPF}:focus`).count(), 'genau ein Knopf hat den Fokus').toBe(1);
    expect(await tabStopps(), 'weiterhin genau ein Tab-Stopp').toBe(1);
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('[role="group"]') === null), 'der nächste Tab verlässt die Gruppe').toBe(true);
    // zurück in die Gruppe und mit den Pfeilen
    await page.locator(KNOPF).first().focus();
    const namen = async () => page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    const vorwaerts = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('ArrowRight'); vorwaerts.push(await namen()); }
    expect(vorwaerts).toEqual(T17_NAMEN.slice(1));
    const rueckwaerts = [];
    for (let i = 0; i < 2; i++) { await page.keyboard.press('ArrowLeft'); rueckwaerts.push(await namen()); }
    expect(rueckwaerts).toEqual([T17_NAMEN[3], T17_NAMEN[2]]);
    await page.keyboard.press('Home');
    expect(await namen()).toBe(T17_NAMEN[0]);
    await page.keyboard.press('End');
    expect(await namen()).toBe(T17_NAMEN[4]);
    expect(await page.locator(`${KNOPF}[tabindex="0"]`).evaluate(k => k.getAttribute('aria-label')), 'der Tab-Stopp wandert mit dem Fokus').toBe(T17_NAMEN[4]);
    for (const breite of [1280, 320]) {
      await page.setViewportSize({ width: breite, height: 700 });
      await page.locator(KNOPF).first().focus();
      const lage = await page.locator(`${KNOPF}:focus`).evaluate(k => {
        const r = k.getBoundingClientRect();
        const rand = 3;
        let sichtbar = r.left - rand >= 0 && r.top - rand >= 0 && r.right + rand <= innerWidth && r.bottom + rand <= innerHeight;
        const beschnitten = [];
        for (let e = k.parentElement; e; e = e.parentElement) {
          const st = getComputedStyle(e);
          if (st.overflow === 'hidden' || st.overflow === 'clip') {
            const a = e.getBoundingClientRect();
            if (r.left - rand < a.left || r.top - rand < a.top || r.right + rand > a.right || r.bottom + rand > a.bottom) beschnitten.push(e.className || e.tagName);
          }
        }
        return { sichtbar, beschnitten };
      });
      expect(lage.sichtbar, `${breite} px: der Fokusumriss liegt ganz im Viewport`).toBe(true);
      expect(lage.beschnitten, `${breite} px: kein Vorfahre mit overflow: hidden schneidet ihn ab`).toEqual([]);
    }
  });

  test('AK 5 · US-2 (S7): ein Live-Ereignis baut die Leiste neu — genau ein Tab-Stopp, der Fokus kehrt in die Leiste zurück', async ({ page }) => {
    await t17Oeffnen(page);
    await page.locator(KNOPF).nth(2).focus();
    const vorher = await page.evaluate(() => document.activeElement.getAttribute('aria-label'));
    const renders = await page.evaluate(() => window.kdTest.renders());
    await lv.buchen(k.adresse, 1, 'pruefer@2026-11-22T12:30+01:00', 'Reviews', 0.2);
    await expect.poll(() => page.evaluate(() => window.kdTest.renders()), 'das Live-Ereignis ist gezeichnet').toBeGreaterThan(renders);
    await page.waitForFunction(() => window.kdTest.gezeichnet());
    expect(await page.locator(`${KNOPF}[tabindex="0"]`).count(), 'genau ein Tab-Stopp nach dem Neuaufbau').toBe(1);
    expect(await page.evaluate(() => document.activeElement.className), 'der Fokus fällt nicht auf body').toContain('lv-ckb');
    expect(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'der zuletzt fokussierte Knopf').toBe(vorher);
  });

  test('AK 6 · US-2 · S2/S3: „2 Commits“ bringt die Zeile von C2 in den Blick mit Fokusumriss, Adresse unverändert; die Text-Marker-Zeile über lv-cmt', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 700 });
    await t17Oeffnen(page);
    const adresseVorher = page.url();
    await page.locator(KNOPF).nth(1).click();
    await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-cm2');
    const lage = await page.evaluate(() => {
      const el = document.activeElement, r = el.getBoundingClientRect(), st = getComputedStyle(el);
      return { klassen: el.className, imBlick: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth,
        breite: parseFloat(st.outlineWidth), text: el.textContent.trim().slice(0, 20) };
    });
    expect(lage.klassen, 'die erste Marker-Zeile von C2').toBe('lv-cm');
    expect(lage.text).toContain(KURZ_T17.C2);
    expect(lage.imBlick, 'ganz im Blick').toBe(true);
    expect(lage.breite, 'Fokusumriss ≥ 2 px').toBeGreaterThanOrEqual(2);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      await page.locator('#lv-cm2').focus();
      const farben = await page.locator('#lv-cm2').evaluate(el => { const st = getComputedStyle(el); return { umriss: st.outlineColor, grund: st.backgroundColor, breite: parseFloat(st.outlineWidth) }; });
      expect(farben.breite, `${name}: Umriss ≥ 2 px`).toBeGreaterThanOrEqual(2);
      expect(await kontrastFarben(page, farben.umriss, farben.grund), `${name}: Umriss gegen den Grund`).toBeGreaterThanOrEqual(3);
    }
    expect(page.url(), 'kein #…-Sprung').toBe(adresseVorher);
    // die Text-Marker-Zeile von C4
    await page.locator(KNOPF).nth(2).click();
    await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-cmt');
    expect(await page.evaluate(() => document.activeElement.classList.contains('text'))).toBe(true);
    expect(await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
    expect(page.url()).toBe(adresseVorher);
  });

  test('AK 6 · US-2: mit prefers-reduced-motion steht die Zeile ohne weiches Scrollen sofort im Blick', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1280, height: 700 });
    await t17Oeffnen(page);
    await page.locator(KNOPF).nth(4).click();
    await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-cm5');
    expect(await page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })).toBe(true);
  });

  for (const breite of [1280, 320]) {
    test(`AK 7 · US-2 (PO Z. 664 a): Zielfläche der Striche bei ${breite} px — Höhe ≥ --kd-ziel, Breite wie gezeichnet, Kontraste hell und dunkel`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 800 });
      await t17Oeffnen(page);
      const ziel = await page.evaluate(() => { const p = document.createElement('i'); p.style.blockSize = 'var(--kd-ziel)'; p.style.display = 'block'; document.body.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h; });
      const masse = await page.locator(KNOPF).evaluateAll(alle => alle.map(k => {
        const r = k.getBoundingClientRect(), t = k.querySelector('.t').getBoundingClientRect();
        return { hoehe: r.height, breite: r.width - t.width };
      }));
      expect(masse.length, 'mindestens ein Strich').toBeGreaterThan(0);
      if (breite === 1280) expect(masse.length, 'bei 1280 px bleiben die fünf Stellen getrennt').toBe(5);
      for (const m of masse) {
        expect(m.hoehe, 'Zielfläche in der Höhe').toBeGreaterThanOrEqual(ziel - 1);
        expect(m.breite, 'die Breite bleibt wie gezeichnet').toBeLessThanOrEqual(4);
      }
      for (const name of ['light', 'dark']) {
        await thema(page, name);
        for (const teil of await page.locator(`${KNOPF} .t`).all()) expect(await kontrastAm(teil), `${name}: Beschriftung`).toBeGreaterThanOrEqual(4.5);
        const farben = await page.evaluate(() => {
          const probe = document.createElement('i');
          probe.style.background = 'var(--kd-surface)';
          document.body.appendChild(probe);
          const rand = getComputedStyle(probe).backgroundColor;
          probe.remove();
          return { rand, strich: getComputedStyle(document.querySelector('#lauf .lv-ckb i')).backgroundColor,
            stuecke: [...new Set([...document.querySelectorAll('#lauf .lv-balken > span')].map(s => getComputedStyle(s).backgroundColor))] };
        });
        // „der Strich mit Rand hebt sich vom Grund ab“ (AK 7): der Rand gegen jede Art der Achse, der Strich gegen seinen Rand
        for (const farbe of farben.stuecke) expect(await kontrastFarben(page, farben.rand, farbe), `${name}: Rand gegen ${farbe}`).toBeGreaterThanOrEqual(3);
        expect(await kontrastFarben(page, farben.strich, farben.rand), `${name}: Strich gegen seinen Rand`).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test('AK 8 · US-1 · US-4 (PO Z. 691, S6): Legende „Commit“ und Lesetext „, 6 Commits“; genau ein Marker „, 1 Commit“; ein Lauf ohne Strich bleibt byte-gleich', async ({ page }) => {
    await t17Oeffnen(page);
    await expect(page.locator('#lauf .lv-za .lv-leg')).toContainText('Commit');
    expect(await page.locator('#lauf .lv-za .lv-balken').getAttribute('aria-label')).toMatch(/, 6 Commits$/);
    // genau ein Marker: „, 1 Commit“
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: EINZEL_KARTE }) }));
    await lv.hochladen(k.adresse, 1, 'einzel@2026-11-22T12:00+01:00', 'Entwicklung', lv.gz(einzelLauf().map(lv.zeile).join('')));
    await s.oeffnen('einzel@2026-11-22T12:00+01:00');
    await s.gelesen();
    expect(await page.locator('#lauf .lv-za .lv-balken').getAttribute('aria-label')).toMatch(/, 1 Commit$/);
    expect(await page.locator('#lauf .lv-za .lv-leg')).toContainText('Commit');
    // ein Lauf mit Zeitachse, aber ohne Commit: Zeitachse, Legende und Lesetext byte-gleich wie vor der Karte
    const kennung = 'ohne-strich@2026-11-22T12:00+01:00';
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(ohneCommitLauf().map(lv.zeile).join('')));
    await s.oeffnen(kennung);
    await s.gelesen();
    const { laufZeitachseHtml, laufAuswerten, eintragPruefen } = require('../../web/lauf.js');
    const zeilen = ohneCommitLauf().map((o, i) => ({ nr: i + 1, eintrag: eintragPruefen(JSON.parse(JSON.stringify(o))) }));
    const erwartet = await page.evaluate(html => { const t = document.createElement('template'); t.innerHTML = html; return t.content.firstElementChild.outerHTML; }, laufZeitachseHtml(laufAuswerten(zeilen, false)));
    const html = await s.zeitachseHtml();
    expect(html, 'byte-gleich wie vor der Anforderung').toBe(erwartet);
    expect(html).not.toContain('Commit');
    expect(html).not.toContain('lv-ck');
    expect(html).not.toContain('lv-bw');
  });

  test('AK 9 · US-2 · US-4: jeder Filter lässt alle fünf Striche stehen; 101 Stellen — höchstens 100 Knöpfe und „100 von 101 Commits“', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await t17Oeffnen(page);
    for (const name of ['Nachrichten', 'Werkzeuge', 'Systemhinweise', 'nur Fehler']) {
      await page.locator(`.lv-filt input[data-filter="${ { Nachrichten: 'n', Werkzeuge: 'w', Systemhinweise: 'h', 'nur Fehler': 'f' }[name] }"]`).click();
      await expect(page.locator(KNOPF), `Filter ${name}`).toHaveCount(5);
      await expect(page.locator(KNOPF).first()).toBeVisible();
      await page.locator(`.lv-filt input[data-filter="${ { Nachrichten: 'n', Werkzeuge: 'w', Systemhinweise: 'h', 'nur Fehler': 'f' }[name] }"]`).click();
    }
    const kennung = 'hundertundeins@2026-11-22T12:00+01:00';
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits: schrittKarte(101) }) }));
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(schrittLauf(101).map(lv.zeile).join('')));
    await s.oeffnen(kennung);
    await s.gelesen();
    expect(await page.locator(KNOPF).count(), 'höchstens 100 Knöpfe').toBeLessThanOrEqual(100);
    expect(await page.locator('#lauf .lv-za .lv-balken').getAttribute('aria-label')).toMatch(/, 100 von 101 Commits$/);
  });
});
