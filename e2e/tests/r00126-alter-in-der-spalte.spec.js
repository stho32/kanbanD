// R00126 Alter einer Karte in ihrer Spalte auf der Karte zeigen (Karte #30, I0118, ADR-0019 N5)
// Das Alter ist eine Aussage der Anzeige: der Browser rechnet den Spalteneintritt aus GET /api/berichte/bewegungen (spalteAm-Schwester),
// die Dauer formt web/kultur.js seitText. Kein Bestandsfeld, kein Schreibweg, kein zweiter Zeitgeber.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, liveBereit, bereit, thema, kontrastAm, farbPixel } = require('./hilfen');
const { breiteMessen } = require('./ziele-hilfen');

const p = n => String(n).padStart(2, '0');
/** Ein Zeitpunkt `n` Tage vor jetzt in Ortszeit, minuten-genau — wie die Commit-Zeit (Muster r00114 `vor`). */
const vorTage = n => { const d = new Date(Date.now() - n * 864e5); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
/** Ein Tag `n` Tage in der Zukunft, `JJJJ-MM-TT` (Fälligkeit). */
const inTagen = n => { const d = new Date(Date.now() + n * 864e5); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

const KOPF = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
  eigen: {label: Eigen, color: '#ffd9a0'}
sources:
  wbs: ""
  requirements: ""
---
`;
const boardText = (eingang, arbeit, fertig) => `# fabrik\n\n## Eingang\n\n${eingang.map(n => `- #${n}\n`).join('')}\n## In Arbeit\n\n${arbeit.map(n => `- #${n}\n`).join('')}\n## Fertig\n\n${fertig.map(n => `- #${n}\n`).join('')}\n`;
const karte = (nr, titel, extra = '', zeiten = []) => `---\nid: ${nr}\ntitle: ${titel}\n${extra}---\n${zeiten.length ? `\`\`\`kanbanD-time\n${zeiten.join('\n')}\n\`\`\`\n` : ''}`;

/** Ordner mit Git und gesetzten Commit-Zeiten (Muster r00124): `schreib` legt Dateien, `commit` committet sie zum Zeitpunkt. */
function ordnerMitGit(ordner, dateien, staende) {
  fs.mkdirSync(path.join(ordner, 'boards'), { recursive: true });
  fs.mkdirSync(path.join(ordner, 'aufgaben'), { recursive: true });
  fs.writeFileSync(path.join(ordner, 'kanbanD.md'), KOPF);
  for (const [rel, inhalt] of Object.entries(dateien)) fs.writeFileSync(path.join(ordner, rel), inhalt);
  spawnSync('git', ['-C', ordner, 'init', '-q'], { encoding: 'utf8' });
  const commit = (zeitpunkt, nachricht) => {
    spawnSync('git', ['-C', ordner, 'add', '-A'], { encoding: 'utf8' });
    const datum = `${zeitpunkt.replace(' ', 'T')}:00`;
    const r = spawnSync('git', ['-C', ordner, 'commit', '-q', '-m', nachricht], {
      encoding: 'utf8',
      env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum, GIT_AUTHOR_NAME: 'st', GIT_AUTHOR_EMAIL: 'st@kanbanD', GIT_COMMITTER_NAME: 'st', GIT_COMMITTER_EMAIL: 'st@kanbanD' },
    });
    if (r.status !== 0) throw new Error(`Commit ${nachricht}: ${r.stderr}`);
  };
  // Der Grundstein liegt deutlich vor allen Bewegungen — sonst sortierte er (echte Commit-Zeit) ans Ende
  commit('2020-01-01 09:00', 'eingerichtet');
  for (const [zeitpunkt, eingang, arbeit, fertig, nachricht] of staende) {
    fs.writeFileSync(path.join(ordner, 'boards/fabrik.md'), boardText(eingang, arbeit, fertig));
    commit(zeitpunkt, nachricht);
  }
}

/** Grundbestand (AK R00126): #1 seit 6 Tagen in „In Arbeit“, #2 heute in „Fertig“, #3 seit 41 Tagen in „Eingang“,
    #4 gestern vom Board genommen, #5 über Umwege zuletzt vor 38 Tagen in „In Arbeit“ (US-2). */
function grundbestand(ordner) {
  const dateien = {};
  for (const [nr, titel] of [[1, 'eins'], [2, 'zwei'], [3, 'drei'], [4, 'vier'], [5, 'fünf']]) dateien[`aufgaben/000${nr}-${titel}.md`] = karte(nr, titel);
  ordnerMitGit(ordner, dateien, [
    [vorTage(41), [1, 2, 3, 4], [], [], '#1-#4 in Eingang'],
    [vorTage(40), [1, 2, 3, 4], [5], [], '#5 in In Arbeit'],
    [vorTage(39), [1, 2, 3, 4], [], [5], '#5 nach Fertig'],
    [vorTage(38), [1, 2, 3, 4], [5], [], '#5 zurück nach In Arbeit'],
    [vorTage(6), [2, 3, 4], [5, 1], [], '#1 nach In Arbeit'],
    [vorTage(3), [2, 3], [5, 1], [], '#4 vom Board genommen'],
    [vorTage(0), [3], [5, 1], [2], '#2 nach Fertig'],
  ]);
}

/** #1 trägt die ganze unterste Zeile (Laufchip vergessen, Σ, Fälligkeit, Preisetikett, Labels) auf eigener Klassenfarbe und ein Alter;
    #2 ist die schlichte Karte der Palette. (UX-Vorprüfung #30 M2) */
function vollBestand(ordner) {
  const dateien = {
    'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nclass: eigen\nassignees: [st, cl]\nlabels: [ux, ausgesprochen-langes-label]\ndue: ${inTagen(5)}\ncost:\n  currency: EUR\n  amount: 12.34\n---\n- [x] a\n- [ ] b\n\`\`\`kanbanD-time\n${vorTage(7)} · ... · st\n2026-01-02 09:00 · 2026-01-02 09:46 · cl\n\`\`\`\n`,
    'aufgaben/0002-zwei.md': karte(2, 'zwei', `class: bug\nassignees: [cl]\nlabels: [ux]\ndue: ${inTagen(7)}\n`),
  };
  ordnerMitGit(ordner, dateien, [[vorTage(6), [1], [2], [], 'Stand']]);
}

/** Die Kurzform einer Karte im DOM: Ort, Form, Text und ihr Platz in `.r3 .rechts`. */
const seitForm = (page, nummer) => page.evaluate(nr => {
  const ka = document.querySelector(`.ka[data-id="${nr}"]`);
  const seit = ka.querySelector('.r3 .seit');
  const st = getComputedStyle(seit), r3 = getComputedStyle(ka.querySelector('.r3'));
  const kinder = [...seit.parentElement.children].map(el => el.className);
  const stellen = name => kinder.map((k, i) => k.split(' ').includes(name) ? i : -1).filter(i => i >= 0)[0];
  return {
    text: seit.textContent,
    elternKlasse: seit.parentElement.className,
    stelleSeit: stellen('seit'),
    stelleSumme: stellen('sum'),
    stelleZaehler: stellen('tk'),
    px: parseFloat(st.fontSize),
    mono: /Plex Mono/.test(st.fontFamily),
    farbe: st.color,
    r3Farbe: r3.color,
    rahmen: st.borderStyle,
    grund: st.backgroundColor,
    weisserRaum: st.whiteSpace,
    tabindex: seit.getAttribute('tabindex'),
    rolle: seit.getAttribute('role'),
    ariaHidden: seit.getAttribute('aria-hidden'),
    vhKinder: seit.querySelectorAll('.vh').length,
  };
}, nummer);

const seit = (page, nummer) => page.locator(`.ka[data-id="${nummer}"] .r3 .seit`);
const name = (page, nummer) => page.locator(`.ka[data-id="${nummer}"]`).getAttribute('aria-label');
/** Die Zahl der Vorkommen von „seit“ in einem Text — die Vollform steht genau einmal (FA 8). */
const seitZahl = text => (text.match(/seit /g) || []).length;

test.describe('R00126 Grundbestand', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(grundbestand); await alsPerson(page, 'st'); await page.goto(k.adresse + '#/board/fabrik'); await liveBereit(page); });
  test.afterEach(() => k.stoppen());

  test('US-1/AK 1: #1 zeigt „seit 6 Tagen“, #3 „seit 41 Tagen“, die Kurzform an fester Stelle in Form von Σ', async ({ page }) => {
    await expect(seit(page, 1)).toHaveText('seit 6 Tagen');
    await expect(seit(page, 3)).toHaveText('seit 41 Tagen');
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('aria-label', '#1 eins, seit 6 Tagen in In Arbeit');
    await expect(page.locator('.ka[data-id="3"]')).toHaveAttribute('aria-label', '#3 drei, seit 41 Tagen in Eingang');
    expect(seitZahl(await name(page, 1)), 'die Vollform genau einmal').toBe(1);
    const f = await seitForm(page, 1);
    expect(f.elternKlasse).toBe('rechts');
    if (f.stelleSumme >= 0) expect(f.stelleSeit, 'hinter der Zeitsumme Σ').toBe(f.stelleSumme + 1);
    if (f.stelleZaehler >= 0) expect(f.stelleSeit, 'vor dem Teilaufgaben-Zähler ☑').toBeLessThan(f.stelleZaehler);
    expect(f.px).toBe(11);
    expect(f.mono, 'IBM Plex Mono').toBe(true);
    expect(f.farbe).toBe(f.r3Farbe, 'Farbe wie Σ/die Zeile (--kd-muted)');
    expect(f.rahmen).toBe('none');
    expect(f.grund).toBe('rgba(0, 0, 0, 0)');
    expect(f.weisserRaum).toBe('nowrap');
    expect(f.tabindex).toBeNull();
    expect(f.rolle).toBeNull();
    expect(f.ariaHidden).toBe('true');
    expect(f.vhKinder, 'kein .vh-Doppeltext').toBe(0);
  });

  test('US-2/AK 2: der letzte Eintritt zählt — #5 „seit 38 Tagen“, nicht 40', async ({ page }) => {
    await expect(seit(page, 5)).toHaveText('seit 38 Tagen');
    await expect(page.locator('.ka[data-id="5"]')).toHaveAttribute('aria-label', '#5 fünf, seit 38 Tagen in In Arbeit');
    expect(await seit(page, 5).innerText()).not.toContain('40');
  });

  test('US-4/AK 6: neutral — #2 (0 Stunden) und #3 (41 Tage) tragen dieselbe Form und Farbe, keine Warnrolle', async ({ page }) => {
    await expect(seit(page, 2)).toHaveText('seit 0 Stunden');
    await expect(page.locator('.ka[data-id="2"]')).toHaveAttribute('aria-label', '#2 zwei, seit 0 Stunden in Fertig');
    const [zwei, drei] = await Promise.all([2, 3].map(n => page.locator(`.ka[data-id="${n}"] .r3 .seit`).evaluate(el => ({ farbe: getComputedStyle(el).color, klassen: [...el.classList], warn: el.closest('.warn, [class*="warn"]') !== null }))));
    expect(zwei.farbe).toBe(drei.farbe);
    expect(zwei.klassen).toEqual(['seit']);
    expect(drei.klassen).toEqual(['seit']);
    expect(drei.warn, 'keine Warnfläche').toBe(false);
    expect(await seit(page, 3).innerText()).not.toMatch(/[!⚠]/);
  });

  test('AK 4: die Abschlussspalte zählt — #2 trägt in „Fertig“ ein Alter', async ({ page }) => {
    await expect(page.locator('.bahn[data-col="Fertig"] .ka[data-id="2"] .r3 .seit')).toHaveText('seit 0 Stunden');
  });

  test('AK 5: ohne Eintritt kein Alter — #4 ist vom Board genommen und trägt keine Kurzform', async ({ page }) => {
    await expect(page.locator('.ka[data-id="4"]')).toHaveCount(0);
    // nur Karten mit Eintritt zeigen ein Alter: Eingang #3, In Arbeit #5/#1, Fertig #2
    await expect(page.locator('.ka')).toHaveCount(4);
    await expect(page.locator('.ka .r3 .seit')).toHaveCount(4);
  });

  test('AK 9: Belegung und Berichte unberührt — die Spaltenköpfe zählen die sichtbaren Karten', async ({ page }) => {
    await expect(page.locator('.bahn[data-col="Eingang"] .bahn-kopf .n')).toHaveText('1');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf .n')).toHaveText('2');
    await expect(page.locator('.bahn[data-col="Fertig"] .bahn-kopf .n')).toHaveText('1');
  });

  test('US-6: das Alter folgt einer Bewegung live nach', async ({ page }) => {
    await expect(seit(page, 3)).toHaveText('seit 41 Tagen');
    expect((await page.request.post(`${k.adresse}api/boards/fabrik/bewegen`, { headers: { 'X-KanbanD-Wer': 'st' }, data: { nummer: 3, spalte: 'In Arbeit' } })).ok()).toBe(true);
    await expect(seit(page, 3)).toHaveText('seit 0 Stunden');
    await expect(page.locator('.ka[data-id="3"]')).toHaveAttribute('aria-label', '#3 drei, seit 0 Stunden in In Arbeit');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf .n')).toHaveText('3');
  });

  test('US-5/AK 7: nur gelesen, kein zweiter Takt — 60 s Zusehen ohne Commit, ohne zusätzliches renders()', async ({ page }) => {
    // Die 60 s laufen auf gestellter Uhr: unter Last kann der Tab den Herzschlag nicht verspätet sehen und der Wächter (40 s stille Leitung,
    // web/app.js liveWaechter) nicht neu verbinden und zeichnen. Der Server meldet sich real alle 15 s — hier alle 10 s (kdTest.herzschlag).
    await page.clock.install();
    await page.reload();
    await bereit(page, page.locator('.ka[data-id="1"]'));
    const datei = k.lies('boards/fabrik.md');
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    const vorherRenders = await page.evaluate(() => window.kdTest.renders());
    for (let n = 0; n < 6; n++) {
      await page.clock.runFor(10000);
      await page.evaluate(() => window.kdTest.herzschlag());
    }
    expect(k.lies('boards/fabrik.md')).toBe(datei);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher);
    expect(await page.evaluate(() => window.kdTest.renders()), 'kein Neuzeichnen ohne Ereignis').toBe(vorherRenders);
    await expect(seit(page, 1)).toHaveText('seit 6 Tagen');
  });
});

test.describe('R00126 volle unterste Zeile, 320/375/414 px, hell und dunkel', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(vollBestand); await alsPerson(page, 'st'); await page.goto(k.adresse + '#/board/fabrik'); await liveBereit(page); });
  test.afterEach(() => k.stoppen());

  test('US-7/AK 8: kein Querscrollen, Karte in der Spalte, Titel ≥ 90 px, Kurzform hinter Σ', async ({ page }) => {
    const eins = page.locator('.ka[data-id="1"]');
    // die volle unterste Zeile ist da: Laufchip, Σ, Fälligkeit, Preisetikett, Labels und das Alter
    await expect(eins.locator('.r0 .lauf.vergessen')).toBeVisible();
    await expect(eins.locator('.r3 .sum')).toBeVisible();
    await expect(eins.locator('.r3 .due')).toBeVisible();
    await expect(eins.locator('.r3 .preis')).toBeVisible();
    await expect(eins.locator('.lbl')).toHaveCount(2);
    await expect(eins.locator('.r3 .seit')).toBeVisible();
    // Ort und Reihenfolge in der untersten Zeile (FA 7): Preisetikett, Σ, Kurzform, ☑-Zähler in dieser Folge
    const f = await seitForm(page, 1);
    expect(f.elternKlasse).toBe('rechts');
    expect(f.stelleSeit, 'hinter der Zeitsumme Σ').toBe(f.stelleSumme + 1);
    expect(f.stelleSeit, 'vor dem Teilaufgaben-Zähler ☑').toBeLessThan(f.stelleZaehler);
    expect(f.px).toBe(11);
    expect(f.mono, 'IBM Plex Mono').toBe(true);
    expect(f.weisserRaum).toBe('nowrap');
    expect(f.tabindex).toBeNull();
    expect(f.rolle).toBeNull();
    expect(f.ariaHidden).toBe('true');
    for (const breite of [320, 375, 414]) {
      await page.setViewportSize({ width: breite, height: 800 });
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, undefined, { timeout: 5000 }).catch(() => {});
      for (const themenName of ['light', 'dark']) {
        await thema(page, themenName);
        const m = await page.evaluate(() => {
          const ka = document.querySelector('.ka[data-id="1"]');
          ka.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          const seit = ka.querySelector('.r3 .seit'), sum = ka.querySelector('.r3 .sum'), titel = ka.querySelector('.r0 .t'), spalte = ka.closest('.flaeche');
          const r = el => el.getBoundingClientRect();
          const rechts = ka.querySelector('.r3 .rechts');
          return {
            quer: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            karteInSpalte: r(ka).right <= r(spalte).right + 0.5,
            titelBreite: Math.round(r(titel).width * 10) / 10,
            seitInRechts: seit.parentElement.classList.contains('rechts'),
            seitNachSum: (seit.compareDocumentPosition(sum) & Node.DOCUMENT_POSITION_PRECEDING) !== 0,
            seitSichtbar: seit.getClientRects().length > 0,
            untersteZeileImKartenrechteck: [...rechts.children].every(k => r(k).right <= r(ka).right + 0.5),
          };
        });
        expect(m.quer, `${breite} ${themenName}: Querscrollen`).toBeLessThanOrEqual(0);
        expect(m.karteInSpalte, `${breite} ${themenName}: Karte im Spaltenrechteck`).toBe(true);
        expect(m.untersteZeileImKartenrechteck, `${breite} ${themenName}: unterste Zeile im Kartenrechteck`).toBe(true);
        expect(m.titelBreite, `${breite} ${themenName}: Titel ≥ 90 px`).toBeGreaterThanOrEqual(90);
        expect(m.seitInRechts, `${breite} ${themenName}: Kurzform in .r3 .rechts`).toBe(true);
        expect(m.seitNachSum, `${breite} ${themenName}: Kurzform hinter Σ`).toBe(true);
        expect(m.seitSichtbar, `${breite} ${themenName}: Kurzform sichtbar`).toBe(true);
        expect(await breiteMessen(page, `Board ${breite} ${themenName}`), `${breite} ${themenName}: kein Rahmen scrollt quer`).toEqual([]);
      }
    }
  });

  test('NFA/ADR-0011: die Kurzform auf eigener Klassenfarbe trägt --kd-text und hält 4,5:1, beide Themen', async ({ page }) => {
    const eigen = page.locator('.ka[data-eigen][data-id="1"]');
    await expect(eigen).toHaveCount(1);
    await expect(eigen.locator('.r3 .seit')).toHaveText('seit 6 Tagen');
    for (const themenName of ['light', 'dark']) {
      await thema(page, themenName);
      const kdText = await farbPixel(page, await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--kd-text)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }));
      const ort = eigen.locator('.r3 .seit');
      expect(await kontrastAm(ort), `${themenName}: Kontrast`).toBeGreaterThanOrEqual(4.5);
      const farbe = await ort.evaluate(el => getComputedStyle(el).color);
      expect(await farbPixel(page, farbe), `${themenName}: Schriftfarbe ist --kd-text`).toEqual(kdText);
    }
  });

  test('FA 8: Timer-Zusatz und Alter stehen beide im Namen, der Timer zuerst', async ({ page }) => {
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('aria-label', '#1 eins, Eigen, Timer läuft seit 7 Tagen, seit 6 Tagen in Eingang');
    expect(seitZahl(await name(page, 1)), 'Timer-Satz und Alter, genau einmal jedes').toBe(2);
    await expect(page.locator('.ka[data-id="1"] .r0 .lauf.vergessen'), 'zweimal „seit …“ geduldet (Chip oben, Text unten)').toHaveText('seit 7 Tagen');
  });
});
