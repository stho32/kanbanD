// R00251 Laufansicht — Commits des Laufs als Marker an ihrer Stelle, Link ins Diff (Karte #269, I0241, ADR-0041 N7), Ausbaustufe 1,
// im echten Programm gegen echtes Git. Ausgangslage: Arbeits-Repository R mit C1–C6 (Autordatum aus T17) auf `karte/1`, danach auf einen
// neuen Stand von `main` rebasiert (neue Hashes, gleiches Autordatum); Aufgabe #1 trägt die rebasierten Verweise, T17 liegt über die API
// an #1. Testfälle in Fachwörtern; Selektoren nur in der Sprache. Gehaltene Antworten statt Schlafzeiten.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { kanbanStarten, alsPerson, mutanteEinsetzen, thema, kontrastAm, reiter } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T17, T17_KENNUNG, T17_COMMITS } = require('./laufansicht-t17');

/* ── Ausgangslage: R mit den Commits, Board `fabrik` mit #1 ── */

const ZWEITER_LAUF = 'planer@2026-11-22T12:00+01:00';
const ZWEITER = [{ zeit: '2026-11-22T12:00:00+01:00', art: 'nachricht', wer: 'agent', text: 'Zweiter Lauf ohne Commits.' }];

function git(r, env, ...args) {
  return execFileSync('git', ['-C', r, '-c', 'user.name=Entwickler', '-c', 'user.email=e@example.org', ...args], { encoding: 'utf8', env: { ...process.env, ...env } }).trim();
}

/** R: `main` mit M0; `karte/1` ab M0 mit C1–C6 (ohne C4) in der Reihenfolge des Autordatums; `main` bekommt M1, `karte/1` wird
    rebasiert. Liefert R und die Hashes nach dem Rebase je Name, dazu den Hash von C1 vor dem Rebase. */
function arbeitsRepository() {
  const basis = fs.mkdtempSync(path.join(os.tmpdir(), 'r00251-'));
  const r = path.join(basis, 'R');
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/app.md'), '# App\n');
  const am = datum => ({ GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum });
  git(r, am('2026-11-22T10:00:00+01:00'), 'init', '-q', '-b', 'main');
  git(r, am('2026-11-22T10:00:00+01:00'), 'add', '-A');
  git(r, am('2026-11-22T10:00:00+01:00'), 'commit', '-q', '-m', 'M0');
  git(r, {}, 'checkout', '-q', '-b', 'karte/1');
  const vorher = {};
  const reihe = [...T17_COMMITS].filter(c => c.anDerKarte).sort((a, b) => a.autordatum - b.autordatum);
  for (const c of reihe) {
    fs.writeFileSync(path.join(r, `${c.name}.txt`), `${c.name}\n`);
    git(r, am(c.datum), 'add', '-A');
    git(r, am(c.datum), 'commit', '-q', '-m', c.titel);
    vorher[c.name] = git(r, {}, 'rev-parse', 'HEAD');
  }
  git(r, {}, 'checkout', '-q', 'main');
  fs.writeFileSync(path.join(r, 'm1.txt'), 'M1\n');
  git(r, am('2026-11-22T12:00:00+01:00'), 'add', '-A');
  git(r, am('2026-11-22T12:00:00+01:00'), 'commit', '-q', '-m', 'M1');
  git(r, {}, 'checkout', '-q', 'karte/1');
  git(r, { GIT_COMMITTER_DATE: '2026-11-22T12:30:00+01:00' }, 'rebase', '-q', 'main');
  const neu = git(r, {}, 'log', '--reverse', '--format=%H', 'main..karte/1').split('\n');
  const nachher = Object.fromEntries(reihe.map((c, i) => [c.name, neu[i]]));
  return { basis, r, vorher, nachher };
}

/** Board `fabrik` (erfasst Transkripte) mit #1, dessen Verweise `verweise` sind; Anwendung `kd` mit R. */
function ausgangslage(r, verweise) {
  return ordner => {
    const dateien = {
      'kanbanD.md': `---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler eins, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: KD, wbs: ${r}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`,
      'boards/fabrik.md': '---\nrecord-transcripts: true\n---\n\n# fabrik\n\n## Entwicklung\n\n- [#1](../aufgaben/0001-commits.md)\n',
      'aufgaben/0001-commits.md': `---\nid: 1\ntitle: Commits im Lauf\ncommits:\n${verweise.map(v => `  - "${v}"\n`).join('')}---\n`,
    };
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'Ausgangslage R00251']);
  };
}

/* ── Sprache: die einzigen Stellen mit Selektoren ── */

const STATUS = '#lv-status';
const INSEL = '#lv-insel';
const adresse = (kennung, nr = 1) => `#/board/fabrik/aufgabe/${nr}/lauf?kennung=${encodeURIComponent(kennung)}`;
const istCommits = url => new URL(url).pathname === '/api/aufgaben/1/commits';
const istTranskript = (url, kennung) => new URL(url).pathname === `/api/aufgaben/1/transkripte/${encodeURIComponent(kennung)}`;
const TEILWEISE = 'Commits nur teilweise zugeordnet — der Lauf ist zu groß.';
const NICHT_LESBAR = 'Commits der Karte nicht lesbar';

const sprache = (page, k) => ({
  async oeffnen(kennung = T17_KENNUNG) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(k.adresse + adresse(kennung));
  },
  async gelesen() {
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
  },
  satzImKopf: () => page.locator('.lv-gd .lv-cn'),
  kachelGesamtdauer: () => page.locator('.lv-gd'),
  fehlerbild: () => page.locator('#lauf .cl-meld'),
  insel: () => page.locator(INSEL),
  /** Die Marker-Zeilen der Reihe nach als `{nach, text, link}`: `nach` ist die Nummer der Schrittzeile davor. */
  marker: () => page.locator(`${INSEL} > li.lv-cm`).evaluateAll(lis => lis.map(li => {
    let davor = li.previousElementSibling;
    while (davor && davor.classList.contains('lv-cm')) davor = davor.previousElementSibling;
    const a = li.querySelector('a');
    return { nach: davor ? davor.id : null, text: li.textContent.replace(/\s+/g, ' ').trim(), link: a ? a.getAttribute('href') : null };
  })),
  /** Farbe eines Tokens, gemessen an einem Probeelement in der Kachel. */
  token: name => page.locator('.lv-gd').evaluate((el, n) => {
    const probe = document.createElement('i');
    probe.style.color = `var(${n})`;
    el.appendChild(probe);
    const farbe = getComputedStyle(probe).color;
    probe.remove();
    return farbe;
  }, name),
  /** Lage des Satzes: das Textelement davor in derselben Kachel, Attribute und Lage gegen „Werkzeuge …“. */
  satzLage: () => page.locator('.lv-gd .lv-cn').first().evaluate(satz => {
    const davor = satz.previousElementSibling, st = getComputedStyle(satz);
    return { davorKlasse: davor.className, davorText: davor.textContent, role: satz.hasAttribute('role'), live: satz.hasAttribute('aria-live'),
      unter: satz.getBoundingClientRect().top >= davor.getBoundingClientRect().bottom - 1, position: st.position, order: st.order, float: st.float };
  }),
  farbe: ort => ort.evaluate(el => getComputedStyle(el).color),
  link: name => page.getByRole('link', { name, exact: true }),
  async aufklappen(nr) {
    await page.locator(`#lv-s${nr} > details > summary`).click();
    await expect(page.locator(`#lv-s${nr} > details`)).toHaveAttribute('open', '');
  },
  async filter(name) {
    await page.locator(`.lv-filt input[data-filter="${{ Nachrichten: 'n', Werkzeuge: 'w', 'nur Fehler': 'f' }[name]}"]`).click();
  },
  sichtbareMarker: () => page.locator(`${INSEL} > li.lv-cm:visible`),
  reviewTitel: () => page.locator('.rv-commit h2'),
  linkMarker: () => page.locator(`${INSEL} > li.lv-cm > a`),
  /** Alle Textteile der Marker-Zeilen (Wort, Hash, Titel, Satz). */
  markerTexte: () => page.locator(`${INSEL} > li.lv-cm :is(.k, .mono, .ti, .n)`),
  zielflaechen: () => page.locator(`${INSEL} > li.lv-cm > a`).evaluateAll(as => as.map(a => a.getBoundingClientRect().height)),
  ziel: () => page.evaluate(() => { const p = document.createElement('i'); p.style.blockSize = 'var(--kd-ziel)'; p.style.display = 'block'; document.body.appendChild(p); const h = p.getBoundingClientRect().height; p.remove(); return h; }),
  titelStil: () => page.locator(`${INSEL} > li.lv-cm .ti`).first().evaluate(t => { const st = getComputedStyle(t); return { umbruch: st.whiteSpace, kuerzung: st.textOverflow }; }),
  quer: () => page.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth),
  /** Je Link-Marker: Oberkante des Symbols minus Oberkante der ersten Zeile des Links (Textzeilen des Links, die oberste). */
  symbolZuErsterLinkzeile: () => page.locator(`${INSEL} > li.lv-cm:not(.text)`).evaluateAll(lis => lis.map(li => {
    const r = document.createRange();
    r.selectNodeContents(li.querySelector('a'));
    const zeilen = [...r.getClientRects()].filter(q => q.width > 0 && q.height > 0);
    return li.querySelector('.ic').getBoundingClientRect().top - Math.min(...zeilen.map(q => q.top));
  })),
  zeitachse: () => page.locator('.lv-za').evaluate(el => el.outerHTML),
  async reviewSchliessen() {
    await page.locator('#rv-rueckweg').click();
  },
});

/** Die Adresse der Review-Seite eines Commits der Karte (`reviewAdresseBilden` mit basis `board`, slug `fabrik`, #1). */
const reviewAdresse = hash => `#/board/fabrik/aufgabe/1/review?commit=${encodeURIComponent(`kd:${hash}`)}`;
const kurz = hash => hash.slice(0, 7);

test.describe('R00251 Laufansicht: Commit-Marker', () => {
  let k, s, repo;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    repo = arbeitsRepository();
    const verweise = ['C1', 'C2', 'C3', 'C5a', 'C5b', 'C6'].map(n => `kd:${repo.nachher[n]}`);
    k = await kanbanStarten(ausgangslage(repo.r, verweise));
    s = sprache(page, k);
    await lv.hochladen(k.adresse, 1, T17_KENNUNG, 'Entwicklung', lv.gz(T17.map(lv.zeile).join('')));
    await lv.hochladen(k.adresse, 1, ZWEITER_LAUF, 'Entwicklung', lv.gz(ZWEITER.map(lv.zeile).join('')));
  });
  test.afterEach(async () => {
    await k.stoppen();
    fs.rmSync(repo.basis, { recursive: true, force: true });
  });

  /* ── B1326: Marker-Zeile, Link nur aus der Karte, Text-Fassung, Rückweg ── */

  /** Die sechs Marker von T17 nach R00251 AK 1, mit den Hashes der Karte nach dem Rebase. */
  const sechsMarker = n => [
    { nach: 'lv-s2', text: `Commit ${kurz(n.C1)} [R00999] B0001: Zähler zuerst`, link: reviewAdresse(n.C1) },
    { nach: 'lv-s6', text: `Commit ${kurz(n.C2)} [R00999] B0002: Zähler zeichnen`, link: reviewAdresse(n.C2) },
    { nach: 'lv-s6', text: `Commit ${kurz(n.C3)} [R00999] B0003: Grenze prüfen`, link: reviewAdresse(n.C3) },
    { nach: 'lv-s8', text: 'Commit e5f6a7b [DOC] Anforderung angelegt Commit nicht an der Karte', link: null },
    { nach: 'lv-s12', text: `Commit ${kurz(n.C5a)} [R00999] B0004: Nacharbeit`, link: reviewAdresse(n.C5a) },
    { nach: 'lv-s14', text: `Commit ${kurz(n.C5b)} [R00999] B0004: Nacharbeit`, link: reviewAdresse(n.C5b) },
  ];

  test('AK 1 · AK 3 · US-1: sechs Marker unmittelbar nach ihrer Schrittzeile, Links mit den Hashes nach dem Rebase, auch aufgeklappt und bei jedem Filter', async () => {
    await s.oeffnen();
    await s.gelesen();
    expect(await s.marker()).toEqual(sechsMarker(repo.nachher));
    expect(JSON.stringify(await s.marker())).not.toContain(kurz(repo.vorher.C1));
    await s.aufklappen(6);
    expect(await s.marker(), 'aufgeklappt: Marker nach der Zeile, nicht in ihr').toEqual(sechsMarker(repo.nachher));
    for (const name of ['Nachrichten', 'Werkzeuge', 'nur Fehler']) {
      await s.filter(name);
      await expect(s.sichtbareMarker(), `Filter ${name}`).toHaveCount(6);
      await s.filter(name);
    }
    await s.filter('Nachrichten');
    await s.filter('Werkzeuge');
    await expect(s.sichtbareMarker(), 'nichts gewählt').toHaveCount(6);
  });

  test('AK 4 · US-2: Link auf „Ein Commit“ mit dem Verweis der Karte — Name mit dem Wort „Commit“, Linksklick hin, „Schließen“ zurück, Strg-Klick neue Registerkarte', async ({ page, context }) => {
    const c2 = repo.nachher.C2;
    await s.oeffnen();
    await s.gelesen();
    const link = s.link(`Commit ${kurz(c2)} [R00999] B0002: Zähler zeichnen`);
    await expect(link).toHaveAttribute('href', reviewAdresse(c2));
    expect(await link.evaluate(a => a.textContent.replace(/\s+/g, ' ').trim())).toBe(`Commit ${kurz(c2)} [R00999] B0002: Zähler zeichnen`);
    const laenge = await page.evaluate(() => history.length);
    const [neu] = await Promise.all([context.waitForEvent('page'), link.click({ modifiers: ['Control'] })]);
    await neu.waitForLoadState();
    expect(neu.url()).toBe(k.adresse + reviewAdresse(c2));
    await neu.close();
    expect(page.url()).toBe(k.adresse + adresse(T17_KENNUNG));
    await link.click();
    await expect(s.reviewTitel()).toContainText('Zähler zeichnen');
    expect(page.url()).toBe(k.adresse + reviewAdresse(c2));
    expect(await page.evaluate(() => history.length)).toBe(laenge + 1);
    await s.reviewSchliessen();
    await s.gelesen();
    expect(page.url()).toBe(k.adresse + adresse(T17_KENNUNG));
    expect(await s.marker()).toEqual(sechsMarker(repo.nachher));
  });

  test('AK 4: aus „Läufe“ → Lauf → Commit → „Schließen“ → Zurück des Browsers: das Fenster zeigt wieder „Läufe“, nicht „Commits“', async ({ page }) => {
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1`);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await reiter(page, 'Läufe');
    await page.locator(`#fenster a.lf-an[data-arg="${T17_KENNUNG}"]`).click();
    await s.gelesen();
    await s.link(`Commit ${kurz(repo.nachher.C2)} [R00999] B0002: Zähler zeichnen`).click();
    await expect(s.reviewTitel()).toContainText('Zähler zeichnen');
    await s.reviewSchliessen();
    await s.gelesen();
    await page.goBack();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator('#laeufe-kopf')).toBeVisible();
  });

  test('AK 5 · US-3: Text-Marker ohne Link; ohne Repository steht nur er, ohne Fehlerbild', async ({ page }) => {
    await s.oeffnen();
    await s.gelesen();
    const text = page.locator(`${INSEL} > li.lv-cm.text`);
    await expect(text).toHaveCount(1);
    await expect(text.locator('a')).toHaveCount(0);
    fs.renameSync(repo.r, repo.r + '-weg');
    await s.oeffnen();
    await s.gelesen();
    expect(await s.marker()).toEqual([sechsMarker(repo.nachher)[3]]);
    await expect(s.fehlerbild()).toHaveCount(0);
    await expect(s.satzImKopf()).toHaveCount(0);
  });

  test('AK 6 · US-5: Commits mit 500 — nur der Text-Marker zu C4', async ({ page }) => {
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"kaputt"}' }));
    await s.oeffnen();
    await s.gelesen();
    expect(await s.marker()).toEqual([sechsMarker(repo.nachher)[3]]);
  });

  /* ── B1328: Zielflächen, Kontrast, 320 px, Zeitachse byte-gleich ── */

  test('AK 8 · AK 11: 1280 px hell und dunkel — Zielfläche ≥ --kd-ziel, Text ≥ 4,5 : 1, Titel kürzt mit „…“, kein Querscrollen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await s.oeffnen();
    await s.gelesen();
    const ziel = await s.ziel();
    for (const h of await s.zielflaechen()) expect(h).toBeGreaterThanOrEqual(ziel);
    expect(await s.titelStil()).toEqual({ umbruch: 'nowrap', kuerzung: 'ellipsis' });
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      for (const teil of await s.markerTexte().all()) expect(await kontrastAm(teil), `${name}: ${await teil.textContent()}`).toBeGreaterThanOrEqual(4.5);
    }
    // R00251 AK 11 (Zeitachse byte-gleich wie vor der Karte) ist mit R00268 FA 8 überholt: ein Lauf mit Commits trägt Striche
    // (Probe in r00268-laufansicht-zeitachse-striche.spec.js AK 8); byte-gleich gilt nur für einen Lauf ohne Strich.
    expect(await s.zeitachse()).toContain('lv-ck');
    expect(await s.quer()).toBe(false);
  });

  test.describe('320 px, grober Zeiger', () => {
    test.use({ viewport: { width: 320, height: 800 }, isMobile: true, hasTouch: true });

    test('AK 8: jeder Link-Marker mindestens --kd-ziel hoch, Titel bricht um, kein Querscrollen, hell und dunkel ≥ 4,5 : 1', async ({ page }) => {
      await s.oeffnen();
      await s.gelesen();
      const ziel = await s.ziel();
      expect(ziel).toBe(48);
      const hoehen = await s.zielflaechen();
      expect(hoehen.length).toBe(5);
      for (const h of hoehen) expect(h).toBeGreaterThanOrEqual(ziel);
      expect((await s.titelStil()).umbruch).toBe('normal');
      expect(await s.quer()).toBe(false);
      for (const name of ['light', 'dark']) {
        await thema(page, name);
        for (const teil of await s.markerTexte().all()) expect(await kontrastAm(teil), `${name}: ${await teil.textContent()}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  });

  for (const breite of [375, 320]) {
    test.describe(`${breite} px, grober Zeiger (Nacharbeit 1 Punkt 7, UX S1)`, () => {
      test.use({ viewport: { width: breite, height: 800 }, isMobile: true, hasTouch: true });

      test('UX S1: das Symbol steht in der Zeile mit „Commit“ — Oberkante höchstens 8 px neben der ersten Linkzeile, Zielfläche bleibt', async ({ page }) => {
        await s.oeffnen();
        await s.gelesen();
        const abstaende = await s.symbolZuErsterLinkzeile();
        expect(abstaende.length).toBe(5);
        console.log(`Beobachtung ${breite} px: Symbol minus erste Linkzeile ${abstaende.map(d => d.toFixed(1)).join(', ')} px`);
        for (const d of abstaende) expect(Math.abs(d), `Symbol ${d} px neben der ersten Linkzeile`).toBeLessThanOrEqual(8);
        for (const h of await s.zielflaechen()) expect(h).toBeGreaterThanOrEqual(await s.ziel());
        expect(await s.quer()).toBe(false);
      });
    });
  }

  /* ── B1329: Sicherheit im echten Programm ── */

  test('AK 9 · US-6: fremder Text bleibt Text — kein alert, kein fremdes Element, jedes href aus dem Verweis der Karte, keine Anfrage mit Transkripttext', async ({ page }) => {
    const BOESE = '"><img src=x onerror=alert(1)>';
    const KARTENTITEL = 'Karte <b>x</b> mit Titel';
    fs.writeFileSync(path.join(repo.r, 'sicher.txt'), 'x\n');
    git(repo.r, { GIT_AUTHOR_DATE: '2026-11-22T11:10:05+01:00', GIT_COMMITTER_DATE: '2026-11-22T11:10:05+01:00' }, 'add', '-A');
    git(repo.r, { GIT_AUTHOR_DATE: '2026-11-22T11:10:05+01:00', GIT_COMMITTER_DATE: '2026-11-22T11:10:05+01:00' }, 'commit', '-q', '-m', KARTENTITEL);
    const hash = git(repo.r, {}, 'rev-parse', 'HEAD');
    const antwort = await fetch(`${k.adresse}api/aufgaben/1/commits`, { method: 'POST', headers: { 'X-KanbanD-Wer': lv.AGENT, 'Content-Type': 'application/json' }, body: JSON.stringify({ commits: [`kd:${hash}`] }) });
    expect(antwort.status).toBe(200);
    const kennung = 'sicherheit@2026-11-22T11:10+01:00';
    const titelFremd = `Titel ${BOESE} javascript:alert(1) \u202E umgekehrt`;
    const lauf = [
      { zeit: '2026-11-22T11:10:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: 'a', text: JSON.stringify({ command: `git commit -q -m "${titelFremd}" && git log --oneline -1 # ${BOESE}` }) },
      { zeit: '2026-11-22T11:10:01+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', zu: 'a', text: `e5f6a7b ${titelFremd}\nABC1234X ${titelFremd}\n${BOESE}` },
      { zeit: '2026-11-22T11:10:04+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: 'b', text: JSON.stringify({ command: `git commit -q -m "${KARTENTITEL}" # javascript:alert(1) ${BOESE}` }) },
      { zeit: '2026-11-22T11:10:06+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', zu: 'b', text: `abc1234 ${KARTENTITEL}\n${BOESE}` },
    ];
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(lauf.map(lv.zeile).join('')));
    let alerts = 0;
    page.on('dialog', d => { alerts++; d.dismiss().catch(() => { }); });
    const anfragen = [];
    page.on('request', r => anfragen.push(r.url()));
    await s.oeffnen(kennung);
    await s.gelesen();
    const marker = await s.marker();
    expect(marker.map(m => m.link), 'Belegzeile ohne Hex-Wort: kein Marker (PO Z. 713)').toEqual([null, reviewAdresse(hash)]);
    expect(marker[0].text).toMatch(/^Commit e5f6a7b Titel "><img src=x onerror=alert\(1\)> javascript:alert\(1\) .* umgekehrt Commit nicht an der Karte$/);
    expect(marker[1].text).toBe(`Commit ${kurz(hash)} ${KARTENTITEL}`);
    const fremd = await page.locator(`${INSEL} > li.lv-cm`).evaluateAll(lis => lis.flatMap(li => [...li.querySelectorAll('*')].map(e => e.tagName.toLowerCase())).filter(t => !['span', 'svg', 'circle', 'path', 'a'].includes(t)));
    expect(fremd).toEqual([]);
    await expect(page.locator(`${INSEL} img, ${INSEL} b`)).toHaveCount(0);
    const attribute = await page.locator(`${INSEL} > li.lv-cm`).evaluateAll(lis => lis.flatMap(li => [li, ...li.querySelectorAll('*')].flatMap(e => [...e.attributes].filter(a => a.name === 'href' || a.name === 'title' || a.name.startsWith('data-')).map(a => a.value))));
    for (const wert of attribute) expect(wert).not.toMatch(/javascript|e5f6a7b|ABC1234X|img|Titel/);
    for (const url of anfragen) expect(url).not.toMatch(/javascript|e5f6a7b|ABC1234X|img|Titel|umgekehrt/);
    await expect(page.locator(`${INSEL} > li.lv-cm.text .mk-bidi`).first()).toBeVisible();
    expect(alerts).toBe(0);
  });

  /* ── B1325: zweite Anfrage, Frist, Abbruch, Satz im Kopf ── */

  test('AK 6 · US-5: GET …/commits mit 500 — der Lauf steht, gedämpft „Commits der Karte nicht lesbar“ unter der Aufteilung, kein Fehlerbild', async ({ page }) => {
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"fehler":"kaputt"}' }));
    await s.oeffnen();
    await s.gelesen();
    await expect(s.satzImKopf()).toHaveText([NICHT_LESBAR]);
    expect(await s.farbe(s.satzImKopf())).toBe(await s.token('--kd-muted'));
    await expect(s.fehlerbild()).toHaveCount(0);
    for (const breite of [320, 1280]) {
      await page.setViewportSize({ width: breite, height: 800 });
      await expect(s.satzImKopf()).toBeVisible();
      // der Wechsel über 641 px zeichnet die Seite neu (R00243 FA 4): gemessen wird am Satz nach dem Neuzeichnen, nie am abgelösten
      await expect.poll(() => s.satzLage(), `${breite} px`).toMatchObject({ davorKlasse: 'auf', role: false, live: false, unter: true, position: 'static', order: '0', float: 'none' });
      expect((await s.satzLage()).davorText).toMatch(/^Werkzeuge /);
    }
  });

  test('Nacharbeit 1 Punkt 2: über der Grenze der Vergleiche steht „Commits nur teilweise zugeordnet — der Lauf ist zu groß.“, genau an der Grenze nicht', async ({ page }) => {
    const { COMMIT_GRENZEN } = require('../../web/lauf-commits.js');
    const commits = Array.from({ length: COMMIT_GRENZEN.commits }, (_, i) => {
      const hash = (i + 1).toString(16).padStart(40, '0');
      return { verweis: `kd:${hash}`, hash, zustand: 'auf_zweig', titel: `Titel ${i}`, autordatum: Date.parse('2026-11-22T11:20:00+01:00') / 1000 };
    });
    await page.route(url => istCommits(url.href), route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ commits }) }));
    const lauf = schritte => Array.from({ length: schritte }, (_, i) => [
      { zeit: '2026-11-22T11:20:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', id: `a${i}`, text: JSON.stringify({ command: 'git commit -q -m x' }) },
      { zeit: '2026-11-22T11:20:00+01:00', art: 'werkzeugergebnis', wer: 'werkzeug', zu: `a${i}`, text: '' },
    ]).flat();
    const genau = COMMIT_GRENZEN.vergleiche / COMMIT_GRENZEN.commits;
    for (const [kennung, schritte, saetze] of [['grenze@2026-11-22T11:20+01:00', genau, []], ['darueber@2026-11-22T11:20+01:00', genau + 1, [TEILWEISE]]]) {
      await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(lauf(schritte).map(lv.zeile).join('')));
      await s.oeffnen(kennung);
      await s.gelesen();
      await expect(s.satzImKopf(), `${schritte} Schritte × ${COMMIT_GRENZEN.commits} Commits`).toHaveText(saetze);
    }
    expect(await s.farbe(s.satzImKopf())).toBe(await s.token('--kd-muted'));
    const lage = await s.satzLage();
    expect(lage).toMatchObject({ davorKlasse: 'auf', role: false, live: false });
  });

  test('AK 6 · US-5: GET …/commits antwortet erst nach der Frist — der Lauf steht nach 2 s mit dem Satz, die späte Antwort ändert nichts', async ({ page }) => {
    let freigeben, angefragt = null;
    const gehalten = new Promise(r => { freigeben = r; });
    await page.route(url => istCommits(url.href), async route => {
      angefragt = Date.now();
      await gehalten;
      await route.continue().catch(() => { });
    });
    await s.oeffnen();
    await s.gelesen();
    const gezeichnet = Date.now();
    expect(angefragt).not.toBeNull();
    expect(gezeichnet - angefragt, 'gezeichnet erst mit Ablauf der Frist').toBeGreaterThanOrEqual(1900);
    await expect(s.satzImKopf()).toHaveText([NICHT_LESBAR]);
    const vorher = await s.insel().evaluate(el => el.outerHTML);
    freigeben();
    await page.evaluate(() => new Promise(r => setTimeout(r, 500)));
    await expect(s.satzImKopf()).toHaveText([NICHT_LESBAR]);
    expect(await s.insel().evaluate(el => el.outerHTML)).toBe(vorher);
  });

  test('AK 6: GET …/commits antwortet nach 0,5 s — kein Satz im Kopf', async ({ page }) => {
    await page.route(url => istCommits(url.href), async route => {
      await new Promise(r => setTimeout(r, 500));
      await route.continue();
    });
    await s.oeffnen();
    await s.gelesen();
    await expect(s.satzImKopf()).toHaveCount(0);
    expect(await s.marker()).toEqual(sechsMarker(repo.nachher));
  });

  test('AK 6: Wechsel der Kennung bricht Transkript und Commits ab, vom alten Lauf wird nichts gezeichnet', async ({ page }) => {
    const wartend = [];
    let ersteCommits = true;
    await page.route(url => istTranskript(url.href, T17_KENNUNG), route => wartend.push(route));
    await page.route(url => istCommits(url.href), route => {
      if (!ersteCommits) return route.continue();
      ersteCommits = false;
      wartend.push(route);
    });
    const abgebrochen = [
      page.waitForEvent('requestfailed', r => istTranskript(r.url(), T17_KENNUNG)),
      page.waitForEvent('requestfailed', r => istCommits(r.url())),
    ];
    await s.oeffnen();
    await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
    await expect.poll(() => wartend.length).toBe(2);
    await page.evaluate(ziel => { location.hash = ziel; }, adresse(ZWEITER_LAUF));
    await Promise.all(abgebrochen);
    await s.gelesen();
    for (const route of wartend) await route.continue().catch(() => { });
    await page.evaluate(() => new Promise(r => setTimeout(r, 300)));
    await expect(s.insel()).toContainText('Zweiter Lauf ohne Commits.');
    await expect(s.insel()).not.toContainText('Zähler');
    await expect(page.locator(`${INSEL} > li.lv-cm`)).toHaveCount(0);
  });
});
