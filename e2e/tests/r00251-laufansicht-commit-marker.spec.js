// R00251 Laufansicht — Commits des Laufs als Marker an ihrer Stelle, Link ins Diff (Karte #269, I0241, ADR-0041 N7), Ausbaustufe 1,
// im echten Programm gegen echtes Git. Ausgangslage: Arbeits-Repository R mit C1–C6 (Autordatum aus T17) auf `karte/1`, danach auf einen
// neuen Stand von `main` rebasiert (neue Hashes, gleiches Autordatum); Aufgabe #1 trägt die rebasierten Verweise, T17 liegt über die API
// an #1. Testfälle in Fachwörtern; Selektoren nur in der Sprache. Gehaltene Antworten statt Schlafzeiten.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { kanbanStarten, alsPerson, mutanteEinsetzen } = require('./hilfen');
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
});

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
      const lage = await s.satzLage();
      expect(lage, `${breite} px`).toMatchObject({ davorKlasse: 'auf', role: false, live: false, unter: true, position: 'static', order: '0', float: 'none' });
      expect(lage.davorText).toMatch(/^Werkzeuge /);
    }
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
