// R00236 Review-Seite — Pfad kopieren, in VS Code öffnen und Patch je Datei (Karte #255, I0226, Scheibe S4 von ADR-0042): AK 3–10 und
// US-1..US-6 im echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`pfadRepository`: K-Pfad, K-Gross, K-Lang in `kd` mit
// W = „<tmp>/R x“ als Unterordner W/plan im Register, Aufgabe #4 in `kd` und `wb`). Schichten: Testfälle → Testsprache (`seite`) →
// Treiber (Selektoren, Adressen nur hier) → Programm. Ein `vscode:`-Link wird abgefangen, nie ausgeführt.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema } = require('./hilfen');
const { pfadRepository, pfadVorbereiten } = require('./review-hilfen');

const AGENT = { 'X-KanbanD-Wer': 'cl' };
const BIDI_PFAD = 'bidi-‮datei.dat';
const BIDI_SICHTBAR = 'bidi-⟨U+202E⟩datei.dat';
const kodiert = p => p.split('/').map(encodeURIComponent).join('/');
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

/* ── Treiber ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

/** Fängt jeden Klick auf einen `vscode:`-Link ab, bevor der Browser ihm folgt, und merkt das Ziel. */
function vscodeAbfangen() {
  window.kdVscode = [];
  window.addEventListener('click', ereignis => {
    const link = ereignis.target.closest && ereignis.target.closest('a[href^="vscode:"]');
    if (!link) return;
    ereignis.preventDefault();
    window.kdVscode.push(link.getAttribute('href'));
  }, true);
}

function seite(page) {
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const nummer = (pfad, spalte, z) => datei(pfad).locator(`tr:not(.hk) td.n:nth-child(${spalte})`, { hasText: exakt(String(z)) }).first();
  return {
    datei,
    klappe: pfad => datei(pfad).locator('.df-k'),
    pfad: pfad => datei(pfad).locator('button.ru-pfad'),
    vscode: pfad => datei(pfad).locator('a.ru-vsc'),
    patch: pfad => datei(pfad).locator('a.ru-patch'),
    auflage: pfad => datei(pfad).locator('.ru-ok'),
    feld: pfad => datei(pfad).locator('input.ru-pfin'),
    feldText: pfad => datei(pfad).locator('.ru-pft'),
    nummerNeu: (pfad, z) => nummer(pfad, 2, z),
    nummerAlt: (pfad, z) => nummer(pfad, 1, z),
    codeZeile: (pfad, text) => datei(pfad).locator('tr td.c', { hasText: text }).first(),
    geoeffnet: () => page.evaluate(() => window.kdVscode.slice()),
    zwischenablage: () => page.evaluate(() => navigator.clipboard.readText()),
    alleFelder: () => page.locator('#rv-insel input.ru-pfin'),
  };
}

async function commitOeffnen(page, k, nr, commit) {
  await page.goto(commitAdresse(k, nr, commit));
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

async function alleOeffnen(page, k, nr) {
  await page.goto(alleAdresse(k, nr));
  await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
}

/** Ein Kommentar an der Aufgabe über die API: ein Live-Ereignis, das die Seite neu zeichnet. */
async function liveNeuzeichnen(page, k, nr) {
  const vorher = await page.evaluate(n => window.kdTest.kommentare(n), nr);
  expect((await page.request.post(`${k.adresse}api/aufgaben/${nr}/kommentare`, { headers: AGENT, data: { text: 'live' } })).ok()).toBe(true);
  await expect.poll(() => page.evaluate(n => window.kdTest.kommentare(n), nr)).toBe(vorher + 1);
  await page.waitForFunction(() => window.kdTest.gezeichnet());
}

const rechteck = ort => ort.evaluate(e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const gleichAufHalbenPixel = (a, b) => ['x', 'y', 'w', 'h'].every(s => Math.abs(a[s] - b[s]) <= 0.5);

test.describe('R00236 Pfad, VS Code und Patch je Datei', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k, h, fehler;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(page);
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.addInitScript(vscodeAbfangen);
    fehler = [];
    page.on('pageerror', f => fehler.push(String(f)));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') fehler.push(m.text()); });
    h = pfadRepository();
    k = await kanbanStarten(pfadVorbereiten(h));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 3 Sprungziel des Knopfs (US-1) ── */

  test('AK 3/US-1: K-Pfad — erste hinzugefügte Zeile, ohne Hunk ohne Zeile, Tooltips an Pfad, VS Code und Patch', async ({ page }) => {
    const s = seite(page), w = kodiert(h.w);
    await commitOeffnen(page, k, 1, h.kPfad);
    await expect(s.vscode('src/a.rs')).toHaveAttribute('href', `vscode://file${w}/src/a.rs:13`);
    await expect(s.vscode('src/a.rs')).toHaveAttribute('title', 'In VS Code an Zeile 13 öffnen');
    await expect(s.vscode('src/nur-weg.rs')).toHaveAttribute('href', `vscode://file${w}/src/nur-weg.rs:20`);
    for (const pfad of ['neu.rs', 'bild.png']) {
      await expect(s.vscode(pfad)).toHaveAttribute('href', `vscode://file${w}/${pfad}`);
      await expect(s.vscode(pfad)).toHaveAttribute('title', 'In VS Code öffnen');
    }
    for (const pfad of ['src/a.rs', 'weg.rs', BIDI_SICHTBAR, 'neu.rs']) {
      await expect(s.pfad(pfad)).toHaveAttribute('title', 'Vollständigen Pfad kopieren');
      await expect(s.patch(pfad)).toHaveAttribute('title', 'Patch dieser Datei herunterladen');
    }
    await s.vscode('src/a.rs').click();
    expect(await s.geoeffnet()).toEqual([`vscode://file${w}/src/a.rs:13`]);
  });

  test('AK 3: K-Gross ohne Zeile vor dem Nachladen, danach mit der ersten hinzugefügten Zeile', async ({ page }) => {
    const s = seite(page), w = kodiert(h.w);
    await commitOeffnen(page, k, 1, h.kGross);
    await expect(s.vscode('src/gross.rs')).toHaveAttribute('href', `vscode://file${w}/src/gross.rs`);
    await s.datei('src/gross.rs').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(s.datei('src/gross.rs').locator('table.dz').first()).toBeVisible();
    await expect(s.vscode('src/gross.rs')).toHaveAttribute('href', `vscode://file${w}/src/gross.rs:1`);
    await expect(s.vscode('src/gross.rs')).toHaveAttribute('title', 'In VS Code an Zeile 1 öffnen');
  });

  test('AK 3/US-6: K-Lang (zu groß zum Anzeigen) — VS Code ohne Zeile auf Dauer, auch nach dem Neuzeichnen, kein Patch', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kLang);
    const lang = s.datei(h.lang);
    await expect(lang.locator('a.ru-vsc')).toHaveAttribute('href', `vscode://file${kodiert(h.w)}/${kodiert(h.lang)}`);
    await expect(lang.locator('a.ru-vsc')).toHaveAttribute('title', 'In VS Code öffnen');
    await expect(lang.locator('a.ru-patch')).toHaveCount(0);
    await liveNeuzeichnen(page, k, 1);
    await expect(lang.locator('a.ru-vsc')).toHaveAttribute('href', `vscode://file${kodiert(h.w)}/${kodiert(h.lang)}`);
  });

  test('AK 3/US-5: Aufgabe #4 auf „Alle Änderungen“ — b.js mit der Wurzel von wb, Folge-Datei src/f.rs aus dem letzten Schritt', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 4);
    await expect(s.vscode('b.js')).toHaveAttribute('href', `vscode://file${kodiert(h.v)}/b.js:5`);
    await expect(s.vscode('src/f.rs')).toHaveAttribute('href', `vscode://file${kodiert(h.w)}/src/f.rs:31`);
  });

  /* ── AK 4 Kodierung ── */

  test('AK 4/US-6: a/b?c#d%e:12.rs — jeder Teil kodiert, Zeile 1', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    await expect(s.vscode('a/b?c#d%e:12.rs')).toHaveAttribute('href', `vscode://file${kodiert(h.w)}/a/b%3Fc%23d%25e%3A12.rs:1`);
    expect(kodiert(h.w)).toContain('/R%20x');
  });

  /* ── AK 5 Kein Link, der täuschen könnte (US-6) ── */

  test('AK 5/US-6: weg.rs (D) und die Bidi-Datei ohne VS Code, mit Pfad und Patch; kein Link mit U+202E; Bidi-Nummern springen nicht', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    for (const pfad of ['weg.rs', BIDI_SICHTBAR]) {
      await expect(s.vscode(pfad)).toHaveCount(0);
      await expect(s.pfad(pfad)).toHaveCount(1);
      await expect(s.patch(pfad)).toHaveCount(1);
    }
    const ziele = await page.locator('a[href^="vscode:"]').evaluateAll(l => l.map(a => a.getAttribute('href')));
    expect(ziele.filter(z => z.includes('‮') || z.toUpperCase().includes('%E2%80%AE'))).toEqual([]);
    const bidiNummer = s.nummerNeu(BIDI_SICHTBAR, 1);
    await expect(bidiNummer).not.toHaveAttribute('title', /.*/);
    await bidiNummer.click();
    expect(await s.geoeffnet()).toEqual([]);
  });

  test('AK 5/US-5: Folge-Datei src/g.rs mit letztem Schritt D — kein VS Code, Nummern springen nicht, Pfad und Patch', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 4);
    await expect(s.vscode('src/g.rs')).toHaveCount(0);
    await expect(s.patch('src/g.rs')).toHaveAttribute('href', '/api/aufgaben/4/diff?anwendung=kd&datei=src%2Fg.rs&format=patch');
    if ((await s.klappe('src/g.rs').getAttribute('aria-expanded')) !== 'true') await s.klappe('src/g.rs').click();
    const nummern = s.datei('src/g.rs').locator('tr:not(.hk) td.n:nth-child(2)');
    await expect(nummern.first()).toBeVisible();
    expect(await nummern.evaluateAll(l => l.filter(n => n.title || n.classList.contains('ru-nk')).length)).toBe(0);
    await nummern.first().click();
    expect(await s.geoeffnet()).toEqual([]);
    await s.pfad('src/g.rs').click();
    await expect(s.auflage('src/g.rs')).toHaveText('Pfad kopiert');
    expect(await s.zwischenablage()).toBe(`${h.w}/src/g.rs`);
  });

  /* ── AK 6 Sprung an der Zeilennummer (US-2) ── */

  test('AK 6/US-2: Nummer 13 und 10 der neuen Seite springen, alte Seite und Codetext nicht; Nummern aria-hidden, ein Link je Datei', async ({ page }) => {
    const s = seite(page), w = kodiert(h.w);
    await commitOeffnen(page, k, 1, h.kPfad);
    await expect(s.nummerNeu('src/a.rs', 13)).toHaveAttribute('title', 'In VS Code an Zeile 13 öffnen');
    await s.nummerNeu('src/a.rs', 13).click();
    await s.nummerNeu('src/a.rs', 10).click();
    expect(await s.geoeffnet()).toEqual([`vscode://file${w}/src/a.rs:13`, `vscode://file${w}/src/a.rs:10`]);
    await s.nummerAlt('src/a.rs', 13).click();
    await s.codeZeile('src/a.rs', 'a 13 neu').click();
    await s.codeZeile('src/a.rs', 'a 13 neu').dblclick();
    expect(await s.geoeffnet()).toHaveLength(2);
    expect(await page.locator('#rv-insel td.n').evaluateAll(l => l.every(n => n.getAttribute('aria-hidden') === 'true'))).toBe(true);
    const links = await page.locator('#rv-insel a[href^="vscode:"]').count();
    expect(links).toBe(await page.locator('#rv-insel a.ru-vsc').count());
    expect(links).toBe(6);
  });

  test('AK 6: Auswahl über mehrere Zeilen mit Strg + C legt den Code ohne Nummern ab', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    const von = await s.codeZeile('src/a.rs', 'a 11').boundingBox();
    const bis = await s.codeZeile('src/a.rs', 'a 15').boundingBox();
    await page.mouse.move(von.x + 2, von.y + von.height / 2);
    await page.mouse.down();
    await page.mouse.move(bis.x + bis.width - 2, bis.y + bis.height / 2, { steps: 5 });
    await page.mouse.up();
    await page.keyboard.press('Control+C');
    const text = await s.zwischenablage();
    expect(text).toContain('a 11');
    expect(text).toContain('a 15');
    expect(text.split('\n').filter(z => /^\s*\d+\b/.test(z))).toEqual([]);
    expect(await s.geoeffnet()).toEqual([]);
  });

  /* ── AK 7 Pfad kopieren (US-3) ── */

  test('AK 7/US-3: Pfad in der Zwischenablage, roh; Statusregion vorher leer und derselbe Knoten, Name bleibt, Nachbarn unverschoben', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    const region = s.auflage('src/a.rs');
    await expect(region).toHaveAttribute('role', 'status');
    await expect(region).toHaveText('');
    await region.evaluate(e => { e.kdMarke = 'vorher'; });
    expect(await region.evaluate(e => Boolean(e.closest('button')))).toBe(false);
    const vorher = [await rechteck(s.vscode('src/a.rs')), await rechteck(s.patch('src/a.rs'))];
    await s.pfad('src/a.rs').click();
    await expect(region).toHaveText('Pfad kopiert');
    expect(await region.evaluate(e => e.kdMarke)).toBe('vorher');
    await expect(s.pfad('src/a.rs')).toHaveAccessibleName('Pfad');
    expect(await s.zwischenablage()).toBe(`${h.w}/src/a.rs`);
    const nachher = [await rechteck(s.vscode('src/a.rs')), await rechteck(s.patch('src/a.rs'))];
    expect(vorher.map((r, i) => gleichAufHalbenPixel(r, nachher[i]))).toEqual([true, true]);
    await s.pfad('weg.rs').click();
    expect(await s.zwischenablage()).toBe(`${h.w}/weg.rs`);
    await s.pfad(BIDI_SICHTBAR).click();
    const bidi = await s.zwischenablage();
    expect(bidi).toBe(`${h.w}/${BIDI_PFAD}`);
    expect(bidi.length).toBe(h.w.length + 1 + BIDI_PFAD.length);
    expect(fehler).toEqual([]);
  });

  test('AK 7: die Auflage steht 2 s und ist nach 10 s weg (gestellte Uhr); Klick anderswo und Tab nehmen sie sofort weg', async ({ page }) => {
    const s = seite(page);
    await page.clock.install();
    await commitOeffnen(page, k, 1, h.kPfad);
    await s.pfad('src/a.rs').click();
    await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
    await page.clock.runFor(2000);
    await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
    await page.clock.runFor(8000);
    await expect(s.auflage('src/a.rs')).toHaveText('');
    await s.pfad('src/a.rs').click();
    await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
    await page.locator('#rv-insel .rv-gk').first().evaluate(e => e.closest('.rv-dateien').click());
    await expect(s.auflage('src/a.rs')).toHaveText('');
    await s.pfad('src/a.rs').click();
    await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
    await page.keyboard.press('Tab');
    await expect(s.auflage('src/a.rs')).toHaveText('');
  });

  for (const breite of [320, 414]) {
    test(`AK 7: bei ${breite} px fängt die Auflage keinen Zeiger — der verdeckte Knopf bekommt den Klick`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, breite);
      await commitOeffnen(page, k, 1, h.kPfad);
      await s.pfad('src/a.rs').click();
      await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
      const trifft = await s.auflage('src/a.rs').evaluate(ok => {
        const r = ok.getBoundingClientRect();
        const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { auflage: ok.contains(e), hoehe: r.height };
      });
      expect(trifft.hoehe).toBeGreaterThan(0);
      expect(trifft.auflage).toBe(false);
      // der Knopf unter der Auflage: ein Klick an ihrer Mitte trifft, was darunter liegt, nicht die Auflage
      const mitte = await s.auflage('src/a.rs').evaluate(ok => { const r = ok.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
      const darunter = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e && (e.closest('button, a') || e).className; }, mitte);
      expect(String(darunter)).not.toContain('ru-ok');
    });
  }

  test('AK 7: ein Live-Ereignis in den ersten 2 s lässt Auflage und Fokus auf „Pfad“ stehen', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    await s.pfad('src/a.rs').click();
    await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
    const knopf = await s.pfad('src/a.rs').evaluate(e => { e.kdMarke = 'pfad'; return document.activeElement === e; });
    expect(knopf).toBe(true);
    await liveNeuzeichnen(page, k, 1);
    await expect(s.auflage('src/a.rs')).toHaveText('Pfad kopiert');
    expect(await page.evaluate(() => document.activeElement && document.activeElement.kdMarke)).toBe('pfad');
  });

  /* ── AK 8 Ohne Zwischenablage (US-4) ── */

  test.describe('ohne Zwischenablage', () => {
    test.beforeEach(async ({ page }) => {
      await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true }));
    });

    test('AK 8/US-4: markiertes Feld mit Fokus, Satz daneben, keine Konsole; bleibt 60 s und über ein Neuzeichnen mit Fokus und Markierung', async ({ page }) => {
      const s = seite(page);
      await page.clock.install();
      await commitOeffnen(page, k, 1, h.kPfad);
      await s.pfad('src/a.rs').click();
      const feld = s.feld('src/a.rs'), pfad = `${h.w}/src/a.rs`;
      await expect(feld).toHaveValue(pfad);
      await expect(feld).toBeFocused();
      await expect(feld).toHaveAttribute('readonly', '');
      expect(await feld.evaluate(e => [e.selectionStart, e.selectionEnd])).toEqual([0, pfad.length]);
      await expect(s.feldText('src/a.rs')).toHaveText('Pfad markiert — mit Strg + C kopieren');
      await page.clock.runFor(60000);
      await expect(feld).toHaveValue(pfad);
      await liveNeuzeichnen(page, k, 1);
      await expect(feld).toBeFocused();
      expect(await feld.evaluate(e => [e.selectionStart, e.selectionEnd])).toEqual([0, pfad.length]);
      await page.evaluate(() => document.addEventListener('copy', e => { window.kdKopiert = { ziel: e.target.className, text: e.target.value.slice(e.target.selectionStart, e.target.selectionEnd) }; }, { once: true }));
      await page.keyboard.press('Control+C');
      expect(await page.evaluate(() => window.kdKopiert)).toEqual({ ziel: 'ru-pfin', text: pfad });
      expect(fehler).toEqual([]);
    });

    test('AK 8: Fokus anderswo bleibt beim Neuzeichnen; Pfad an nur-weg versetzt das Feld, Fokusring hell und dunkel, Esc an Pfad zurück', async ({ page }) => {
      const s = seite(page);
      await commitOeffnen(page, k, 1, h.kPfad);
      await s.pfad('src/a.rs').click();
      await expect(s.feld('src/a.rs')).toBeFocused();
      await s.klappe('src/nur-weg.rs').focus();
      await liveNeuzeichnen(page, k, 1);
      await expect(s.feld('src/a.rs')).not.toBeFocused();
      await s.pfad('src/nur-weg.rs').click();
      await expect(s.alleFelder()).toHaveCount(1);
      await expect(s.feld('src/nur-weg.rs')).toHaveValue(`${h.w}/src/nur-weg.rs`);
      for (const name of ['light', 'dark']) {
        await thema(page, name);
        await s.feld('src/nur-weg.rs').focus();
        const ring = await s.feld('src/nur-weg.rs').evaluate(e => { const st = getComputedStyle(e); return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth) }; });
        expect(ring.stil, name).not.toBe('none');
        expect(ring.breite, name).toBeGreaterThanOrEqual(2);
      }
      await page.keyboard.press('Escape');
      await expect(s.alleFelder()).toHaveCount(0);
      await expect(s.pfad('src/nur-weg.rs')).toBeFocused();
      expect(fehler).toEqual([]);
    });

    test('AK 8: nach dem Blättern zu „Alle Änderungen“ und zurück steht kein Feld mehr', async ({ page }) => {
      const s = seite(page);
      await commitOeffnen(page, k, 1, h.kPfad);
      await s.pfad('src/a.rs').click();
      await expect(s.alleFelder()).toHaveCount(1);
      await page.locator('#rv-u-alle').click();
      await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
      await expect(s.alleFelder()).toHaveCount(0);
      // umgestellt mit R00245 (FA 1): zurück über den Eintrag von K-Pfad in der Leiste statt „Ein Commit“
      await page.locator(`#rv-ls li > a[data-arg="kd:${h.kPfad}"]`).click();
      await page.locator('#rv-insel > .rv-gr .rv-gk').first().waitFor();
      await expect(s.alleFelder()).toHaveCount(0);
    });
  });

  test('AK 8: verweigert writeText die Erlaubnis, steht dasselbe Feld', async ({ page }) => {
    const s = seite(page);
    await page.addInitScript(() => { navigator.clipboard.writeText = () => Promise.reject(new DOMException('verweigert', 'NotAllowedError')); });
    await commitOeffnen(page, k, 1, h.kPfad);
    await s.pfad('src/a.rs').click();
    await expect(s.feld('src/a.rs')).toHaveValue(`${h.w}/src/a.rs`);
    await expect(s.feld('src/a.rs')).toBeFocused();
    await expect(s.auflage('src/a.rs')).toHaveText('');
    expect(fehler).toEqual([]);
  });

  /* ── AK 9 Patch je Datei (US-5) ── */

  test('AK 9: Patch an src/a.rs — Adresse, Dateiname, Inhalt bytegleich zur Route; datei.patch bei Sonderzeichen; K-Lang ohne Patch', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    const verweis = encodeURIComponent(`kd:${h.kPfad}`);
    await expect(s.patch('src/a.rs')).toHaveAttribute('href', `/api/aufgaben/1/diff?commit=${verweis}&datei=src%2Fa.rs&format=patch`);
    await expect(s.patch('src/a.rs')).toHaveAttribute('download', 'a.rs.patch');
    const [download] = await Promise.all([page.waitForEvent('download'), s.patch('src/a.rs').click()]);
    expect(download.suggestedFilename()).toBe('a.rs.patch');
    const geladen = require('node:fs').readFileSync(await download.path(), 'utf8');
    const route = await (await page.request.get(`${k.adresse}api/aufgaben/1/diff?commit=${verweis}&datei=src%2Fa.rs&format=patch`)).text();
    expect(geladen).toBe(route);
    expect(geladen.startsWith('diff --git a/src/a.rs b/src/a.rs\n')).toBe(true);
    await expect(s.patch('a/b?c#d%e:12.rs')).toHaveAttribute('href', `/api/aufgaben/1/diff?commit=${verweis}&datei=a%2Fb%3Fc%23d%25e%3A12.rs&format=patch`);
    await expect(s.patch('a/b?c#d%e:12.rs')).toHaveAttribute('download', 'datei.patch');
    await expect(s.patch('ä.rs')).toHaveAttribute('download', 'datei.patch');
    await commitOeffnen(page, k, 1, h.kLang);
    await expect(s.datei(h.lang).locator('a.ru-patch')).toHaveCount(0);
  });

  test('AK 9/US-5: Aufgabe #4 — Patch an b.js im Abschnitt wb mit anwendung=wb ohne commit=, Antwort 200 text/x-diff', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 4);
    const href = '/api/aufgaben/4/diff?anwendung=wb&datei=b.js&format=patch';
    await expect(s.patch('b.js')).toHaveAttribute('href', href);
    await expect(s.patch('b.js')).toHaveAttribute('download', 'b.js.patch');
    const antwort = await page.request.get(k.adresse + href.slice(1));
    expect(antwort.status()).toBe(200);
    expect(antwort.headers()['content-type']).toContain('text/x-diff');
  });

  /* ── AK 10 Beide Ansichten, Breite, Tastatur, Klappzustand ── */

  test('AK 10: Knöpfe in beiden Ansichten auch an eingeklappten Dateien; Tab-Folge je Datei; kein „Gesehen“', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    await expect(s.klappe('weg.rs')).toHaveAttribute('aria-expanded', 'false');
    const folge = async pfad => s.datei(pfad).locator('.ru-k').evaluate(kopf => [...kopf.querySelectorAll('button, a[href], input')].map(e => (e.classList.contains('df-k') ? 'Klappe' : e.textContent.trim())));
    expect(await folge('src/a.rs')).toEqual(['Klappe', 'Pfad', 'VS Code', 'Patch']);
    expect(await folge('weg.rs')).toEqual(['Klappe', 'Pfad', 'Patch']);
    expect(await folge(BIDI_SICHTBAR)).toEqual(['Klappe', 'Pfad', 'Patch']);
    await s.klappe('src/a.rs').focus();
    const getabt = [];
    for (let n = 0; n < 3; n++) {
      await page.keyboard.press('Tab');
      getabt.push(await page.evaluate(() => document.activeElement.textContent.trim()));
    }
    expect(getabt).toEqual(['Pfad', 'VS Code', 'Patch']);
    await expect(page.getByText('Gesehen')).toHaveCount(0);
    await commitOeffnen(page, k, 1, h.kLang);
    expect(await folge(h.lang)).toEqual(['Klappe', 'Pfad', 'VS Code']);
    await alleOeffnen(page, k, 4);
    for (const pfad of ['b.js', 'src/f.rs']) expect(await folge(pfad), pfad).toEqual(['Klappe', 'Pfad', 'VS Code', 'Patch']);
  });

  test('AK 10: ein Klick auf Pfad, VS Code oder Patch lässt den Klappzustand, an einer offenen und einer eingeklappten Datei', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    for (const pfad of ['src/a.rs', 'weg.rs']) {
      const vorher = await s.klappe(pfad).getAttribute('aria-expanded');
      await s.pfad(pfad).click();
      if (await s.vscode(pfad).count()) await s.vscode(pfad).click();
      await Promise.all([page.waitForEvent('download'), s.patch(pfad).click()]);
      await expect(s.klappe(pfad), pfad).toHaveAttribute('aria-expanded', vorher);
    }
  });

  for (const breite of [320, 414, 980, 1280]) {
    test(`AK 10: ${breite} px hell und dunkel — kein Querscrollen auch mit offenem Feld, Knöpfe ganz in der Breite und ≥ 24 px hoch`, async ({ page }) => {
      const s = seite(page);
      await page.addInitScript(() => Object.defineProperty(Navigator.prototype, 'clipboard', { get: () => undefined, configurable: true }));
      await breiteSetzen(page, breite);
      for (const name of ['light', 'dark']) {
        await commitOeffnen(page, k, 1, h.kPfad);
        await thema(page, name);
        await s.pfad('src/a.rs').click();
        await expect(s.feld('src/a.rs')).toBeVisible();
        const mass = await page.evaluate(() => ({
          quer: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          knoepfe: [...document.querySelectorAll('#rv-insel .ru-akt .ru-k1')].map(e => { const r = e.getBoundingClientRect(); return { rechts: r.right, links: r.left, hoehe: r.height }; }),
          breite: document.documentElement.clientWidth,
        }));
        expect(mass.quer, name).toBeLessThanOrEqual(0);
        expect(mass.knoepfe.length).toBeGreaterThan(0);
        expect(mass.knoepfe.filter(r => r.links < 0 || r.rechts > mass.breite || r.hoehe < 24), name).toEqual([]);
      }
    });
  }
});

test.describe('R00236 mit Touch (pointer: coarse)', () => {
  test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
  let k, h;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await page.addInitScript(vscodeAbfangen);
    h = pfadRepository();
    k = await kanbanStarten(pfadVorbereiten(h));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('AK 6/AK 10: Tippen auf die Nummer 13 öffnet den Link; Knöpfe ≥ 44 px hoch', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kPfad);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    await s.nummerNeu('src/a.rs', 13).tap();
    expect(await s.geoeffnet()).toEqual([`vscode://file${kodiert(h.w)}/src/a.rs:13`]);
    const hoehen = await page.locator('#rv-insel .ru-akt .ru-k1').evaluateAll(l => l.map(e => e.getBoundingClientRect().height));
    expect(hoehen.filter(x => x < 44)).toEqual([]);
  });
});
