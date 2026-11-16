// R00146 Inhalt: schmale rechte Spalte (Karte #146, I0133) — US-1..US-8 im echten Programm.
// Rechts im Inhalt stehen Spalte, Klasse, Labels und Fällig bearbeitbar (dieselben `data-af`-Schlüssel wie „Details“,
// ein Zeichner, ein Commit je Änderung) und die gewählten Zuständigen nur lesend. „Details“ bleibt vollständig.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, reiter, thema, kontrastMessen, kontrastFarben, mutanteEinsetzen, breiteSetzen } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  pl: {name: Paula, kind: human}
  ag: {name: Agent, kind: agent}
classes:
  bug: {label: Fehler, color: red}
  feature: {label: Funktion, color: green}
---
`;

// „Fertig“ gehört dem Menschen (403 für einen Agenten); Boardtitel „fabrik“ steht so im Commit.
const BOARD = `---
column-owner:
  Fertig: human
---

# fabrik

## Eingang

- #1
- #3

## In Arbeit

## Fertig
`;

// Grundbestand: #1 ohne Klasse (der AK wählt „bug“ und erwartet dafür einen Commit), mit Labels, Fälligkeit,
// Zuständigen st und ag, Teilaufgabe, Kommentar, Durchlauf und Anhang; #2 ohne Board; #3 defekte Datei.
const AUFGABE_1 = `---
id: 1
title: Telemetrie der Agentenläufe bündeln
key: shop/nc-304/lodash
assignees: [st, ag]
labels: [ui, daten]
due: 2026-12-24
estimate: 2
---
Eine Beschreibung in Markdown.

- [ ] Zeile beim Start schreiben

\`\`\`kanbanD-comments
2026-11-12 09:11 · ag · Ein Kommentar zum Vorgang.
\`\`\`

\`\`\`kanbanD-runs
2026-11-12 08:00 · Entwicklung · bestanden · ag · 1:43 · Gate grün
\`\`\`
`;
const AUFGABE_2 = '---\nid: 2\ntitle: zwei\n---\nOhne Board\n';
const AUFGABE_3 = '---\nid: 3\n<<<<<<< HEAD\ntitle: defekt\n=======\ntitle: anders\n>>>>>>> zweig\n---\n';

const GRUND = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/fabrik.md': BOARD,
  'aufgaben/0001-telemetrie.md': AUFGABE_1,
  'aufgaben/0001-telemetrie/protokoll.txt': Buffer.from('Inhalt des Protokolls'),
  'aufgaben/0002-zwei.md': AUFGABE_2,
  'aufgaben/0003-defekt.md': AUFGABE_3,
};

/** Ein defektes Board (423): der Inhalt lässt sich nur noch über die Aufgabenliste öffnen. */
const BOARD_KAPUTT = '# fabrik\n- #1\n## Eingang\n';

const FELDER = ['spalte', 'klasse', 'labels', 'faellig'];

test.describe('R00146 Inhalt — schmale rechte Spalte', () => {
  let k;
  test.beforeEach(async ({ page }) => { await mutanteEinsetzen(page); k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse + '#/board/fabrik');
    if (await page.locator('#fenster').count()) await page.keyboard.press('Escape');
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  const spalte = page => page.locator('#inhalt-spalte');
  const feld = (page, name) => page.locator(`#inhalt-spalte [data-af="${name}"]`);
  const fokusFeld = page => page.evaluate(() => (document.activeElement.dataset || {}).af || document.activeElement.id || document.activeElement.tagName);

  /** Maße der Spalte, ihres Nachbarn und beider Scrollbereiche. */
  const masse = page => page.evaluate(() => {
    const r = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, breite: b.width, hoehe: b.height, unten: b.bottom, rechts: b.right }; };
    const s = document.querySelector('#inhalt-spalte'), m = document.querySelector('#fenster .mod-main'), b = document.querySelector('#fenster .mod-body'), f = document.querySelector('#fenster');
    return {
      spalte: r(s), main: r(m), body: r(b),
      spalteScroll: [s.scrollWidth, s.clientWidth],
      bodyScroll: [b.scrollWidth, b.clientWidth],
      fensterScroll: [f.scrollWidth, f.clientWidth],
      seite: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
      order: getComputedStyle(s).order,
    };
  });

  /* ── US-1: die Spalte steht rechts im Inhalt (B0675) ── */

  test('US-1: 200 px rechts, Gruppe „Angaben zur Aufgabe“, vier Felder in Reihenfolge, Beschriftung über dem Wert', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await oeffnen(page);
    const s = spalte(page);
    await expect(s).toHaveCount(1);
    await expect(s).toHaveAttribute('role', 'group');
    await expect(s).toHaveAttribute('aria-label', 'Angaben zur Aufgabe');
    await expect(s.locator('h1, h2, h3, h4, h5, h6')).toHaveCount(0);

    // die vier Felder in dieser Reihenfolge, je einmal, mit den Schlüsseln aus „Details“; die Schnellknöpfe fehlen
    expect(await s.locator('[data-af]').evaluateAll(alle => alle.map(e => e.dataset.af))).toEqual(FELDER);
    await expect(s.locator('select[data-af="spalte"]')).toHaveCount(1);
    await expect(s.locator('select.klwahl[data-af="klasse"]')).toHaveCount(1);
    await expect(s.locator('input.mini-inp.full[data-af="labels"]')).toHaveCount(1);
    await expect(s.locator('input[type="date"][data-af="faellig"]')).toHaveCount(1);
    await expect(s.locator('[data-act]')).toHaveCount(0);

    // Beschriftung über dem Wert: jede `.kb` endet über dem Beginn ihres `.w`
    const paare = await s.locator('.felder > .kb').evaluateAll(kbs => kbs.map(kb => {
      const w = kb.nextElementSibling.getBoundingClientRect(), b = kb.getBoundingClientRect();
      return { text: kb.querySelector('.k').textContent, ueber: b.bottom <= w.top + 0.5 };
    }));
    expect(paare.map(p => p.text)).toEqual(['Spalte', 'Klasse', 'Labels', 'Fällig', 'Zuständig']);
    expect(paare.filter(p => !p.ueber), 'Beschriftung über dem Wert').toEqual([]);

    // links steht der Inhalt unverändert
    const main = page.locator('#fenster .mod-main');
    await expect(main.locator('.titel')).toHaveText('Telemetrie der Agentenläufe bündeln');
    for (const titel of ['BESCHREIBUNG', 'TEILAUFGABEN', 'ANHÄNGE', 'KOMMENTARE', 'DURCHLÄUFE']) {
      await expect(main.locator('h3', { hasText: titel })).toBeVisible();
    }

    // 200 px breit, rechts neben dem Inhalt
    const m = await masse(page);
    expect(Math.abs(m.spalte.breite - 200), `Spalte ${m.spalte.breite} px`).toBeLessThanOrEqual(1);
    expect(m.spalte.x).toBeGreaterThanOrEqual(m.main.rechts - 0.5);
    // DOM: Inhalt → Spalte → Fuß
    expect(await page.evaluate(() => document.querySelector('#fenster .mod-main').compareDocumentPosition(document.querySelector('#inhalt-spalte')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
    expect(await page.evaluate(() => document.querySelector('#inhalt-spalte').compareDocumentPosition(document.querySelector('#fenster .mod-fuss')) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  });

  test('US-4: ein Zeichner — dieselbe Feldzeile in „Details“ und in der Spalte; jedes Feld genau einmal', async ({ page }) => {
    await oeffnen(page);
    const zeile = async name => page.locator(`#fenster [data-af="${name}"]`).evaluate(e => ({
      tag: e.tagName, klasse: e.className, typ: e.type || '', aria: e.getAttribute('aria-label'), platzhalter: e.getAttribute('placeholder') || '',
      schrift: getComputedStyle(e.closest('.felder')).getPropertyValue('--kd-font'),
    }));
    const inhalt = {};
    for (const name of FELDER) {
      inhalt[name] = await zeile(name);
      // genau einmal im gezeichneten Bereich
      await expect(page.locator(`#fenster [data-af="${name}"]`)).toHaveCount(1);
    }
    await expect(page.locator('#fenster [data-af="labels"]')).toHaveCount(1);
    await reiter(page, 'Details');
    for (const name of FELDER) {
      expect(await zeile(name), `${name}: dieselbe Feldzeile wie in der Spalte`).toEqual(inhalt[name]);
      await expect(page.locator(`#fenster [data-af="${name}"]`)).toHaveCount(1);
    }
    // „Details“ bleibt vollständig: die Restfelder stehen weiter dort, nicht in der Spalte
    for (const text of ['Schlüssel', 'Herkunft', 'Zuständig', 'Geschätzt']) {
      await expect(page.locator('#fenster .mod-main .k', { hasText: text }).first(), text).toBeVisible();
    }
    // die Schnellknöpfe am Fällig-Feld bleiben in „Details“
    await expect(page.locator('#fenster .mod-main [data-act="faellig"]')).toHaveCount(4);
    await reiter(page, 'Inhalt');
    expect(await spalte(page).locator('.kb .k').allInnerTexts()).toEqual(['Spalte', 'Klasse', 'Labels', 'Fällig', 'Zuständig']);
  });

  test('US-4: der Schlüssel .sl trägt in der Spalte denselben --kd-bg-Streifen wie in „Details“', async ({ page }) => {
    await oeffnen(page);
    const grund = ort => page.locator(ort).first().evaluate(e => getComputedStyle(e).backgroundColor);
    const spalteGrund = await grund('#inhalt-spalte .sl');
    expect(spalteGrund, 'Schlüssel in der Spalte nicht transparent').not.toBe('rgba(0, 0, 0, 0)');
    await reiter(page, 'Details');
    expect(await grund('#fenster .mod-main .sl'), 'derselbe Streifen wie in „Details“').toBe(spalteGrund);
  });

  /* ── US-2: die vier Felder ändern und sofort committen (B0676) ── */

  test('US-2: Klasse, Labels, Fällig setzen und leeren — je genau ein Commit', async ({ page }) => {
    await oeffnen(page);
    const anzahl = () => Number(k.git('rev-list', '--count', 'HEAD'));
    const datei = () => k.lies('aufgaben/0001-telemetrie.md');

    let vorher = anzahl();
    await feld(page, 'klasse').selectOption('bug');
    await expect.poll(datei).toContain('class: bug');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Klasse');
    expect(anzahl() - vorher, 'genau ein Commit').toBe(1);

    vorher = anzahl();
    await feld(page, 'labels').fill('ui, daten, board');
    await page.locator('#fenster .mod-main .titel').click();
    await expect.poll(datei).toContain('labels: [ui, daten, board]');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Labels');
    expect(anzahl() - vorher).toBe(1);

    vorher = anzahl();
    await feld(page, 'faellig').fill('2026-12-31');
    await page.locator('#fenster .mod-main .titel').click();
    await expect.poll(datei).toContain('due: 2026-12-31');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Fälligkeit');
    expect(anzahl() - vorher).toBe(1);

    vorher = anzahl();
    await feld(page, 'faellig').fill('');
    await page.locator('#fenster .mod-main .titel').click();
    await expect.poll(datei).not.toContain('due:');
    expect(anzahl() - vorher, 'Leeren ist ein eigener Commit').toBe(1);
  });

  test('US-2: Spalte ändern — die Karte wandert, ein Commit, das Feld zeigt die neue Spalte', async ({ page }) => {
    await oeffnen(page);
    const vorher = Number(k.git('rev-list', '--count', 'HEAD'));
    await feld(page, 'spalte').selectOption('In Arbeit');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .ka[data-id="1"]')).toBeVisible();
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 nach „In Arbeit“ (fabrik)');
    expect(Number(k.git('rev-list', '--count', 'HEAD')) - vorher).toBe(1);
    await expect(feld(page, 'spalte')).toHaveValue('In Arbeit');
  });

  test('US-2: derselbe Wert erzeugt keinen Commit', async ({ page }) => {
    await oeffnen(page);
    const stand = k.git('log', '-1', '--format=%H');
    await feld(page, 'labels').fill('ui, daten ');
    // Auf die Antwort warten statt auf eine Frist: der PATCH geht immer, der Server verwirft den gleichen Wert.
    const [antwort] = await Promise.all([
      page.waitForResponse(r => r.request().method() === 'PATCH' && new URL(r.url()).pathname === '/api/aufgaben/1'),
      page.locator('#fenster .mod-main .titel').click(),
    ]);
    expect(antwort.ok(), 'die Antwort ist da').toBe(true);
    expect(k.git('log', '-1', '--format=%H')).toBe(stand);
  });

  test('US-2: nach eigener Änderung bleibt der Fokus im Feld, nie auf BODY — dasselbe Feld bei Spalte/Klasse/Fällig', async ({ page }) => {
    await oeffnen(page);
    // Auswahl und Datumsfeld melden ihre Änderung im Feld: der Fokus bleibt dort
    await feld(page, 'klasse').focus();
    await feld(page, 'klasse').selectOption('bug');
    await expect.poll(() => fokusFeld(page)).toBe('klasse');
    await expect(feld(page, 'klasse')).toHaveValue('bug');

    await feld(page, 'faellig').fill('2027-01-02');
    await expect.poll(() => fokusFeld(page)).toBe('faellig');
    await expect(feld(page, 'faellig')).toHaveValue('2027-01-02');

    // Ein Textfeld meldet die Änderung beim Verlassen: der Fokus bleibt beim Feld, in das der Mensch gegangen ist
    await feld(page, 'labels').fill('ui, board');
    await page.keyboard.press('Tab');
    await expect.poll(() => fokusFeld(page)).toBe('faellig');
    await expect(feld(page, 'labels')).toHaveValue('ui, board');

    await feld(page, 'spalte').focus();
    await feld(page, 'spalte').selectOption('In Arbeit');
    await expect.poll(() => fokusFeld(page)).toBe('spalte');
    expect(await fokusFeld(page)).not.toBe('BODY');
  });

  test('US-5: der Fokus im Feld Labels übersteht ein Live-Ereignis an #2; halb Getipptes wird nicht committet', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await feld(page, 'labels').click();
    await feld(page, 'labels').type('board');
    const antwort = await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'ag' }, data: { titel: 'Telemetrie gebündelt' } });
    expect(antwort.ok()).toBe(true);
    await expect(page.locator('.ka[data-id="1"] .t')).toHaveText('Telemetrie gebündelt');
    expect(await fokusFeld(page)).toBe('labels');
    await expect.poll(() => k.git('log', '-1', '--format=%s')).toBe('#1 geändert: Titel');
    expect(k.lies('aufgaben/0001-telemetrie.md')).toContain('labels: [ui, daten]');
  });

  test('US-5: nur angesehen — Aufgabendatei und git log bleiben unverändert', async ({ page }) => {
    const datei = k.lies('aufgaben/0001-telemetrie.md');
    const stand = k.git('log', '-1', '--format=%H');
    await oeffnen(page);
    await expect(spalte(page)).toBeVisible();
    await page.keyboard.press('Escape');
    expect(k.lies('aufgaben/0001-telemetrie.md')).toBe(datei);
    expect(k.git('log', '-1', '--format=%H')).toBe(stand);
  });

  /* ── US-3: die Zuständigen nur lesen (B0677/B0678) ── */

  test('US-3: Zuständig nennt nur die gewählten, Initiale aria-hidden, kein Bedienelement, Gruppe „Zuständig“', async ({ page }) => {
    await oeffnen(page);
    const zeile = page.locator('#inhalt-spalte [role="group"][aria-label="Zuständig"]');
    await expect(zeile).toHaveCount(1);
    expect((await zeile.innerText()).replace(/\s+/g, ' ').trim()).toBe('ST Stefan · AG Agent');
    await expect(zeile).not.toContainText('Paula');
    await expect(zeile.locator('button, input, select, [data-act], [aria-pressed], [tabindex]')).toHaveCount(0);
    // Kein Chip: auch die nicht-interaktiven Chip-Klassen dürfen hier nicht erscheinen (R00146 FA 3).
    await expect(zeile.locator('.ochip, .lbl')).toHaveCount(0);
    await expect(zeile.locator('[aria-hidden="true"]')).toHaveCount(3); // zwei Initialen, ein Trenner
  });

  test('US-3: Zuständige ändern sich allein in „Details“; der Rückwechsel zeigt den neuen Stand', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    await page.locator('#fenster .mod-main [data-act="zustaendig"][data-arg="pl"]').click();
    await expect.poll(() => k.lies('aufgaben/0001-telemetrie.md')).toContain('assignees: [st, ag, pl]');
    await reiter(page, 'Inhalt');
    await expect(page.locator('#inhalt-spalte [role="group"][aria-label="Zuständig"]')).toContainText('Paula');
  });

  test('US-3: Leerfall — Aufgabe ohne Board und ohne Zuständige zeigt „niemand“ ohne Bedienelement', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="2"] a').click();
    const s = spalte(page);
    await expect(s).toBeVisible();
    await expect(s.locator('[role="group"][aria-label="Zuständig"]')).toHaveText('niemand');
    await expect(s.locator('[role="group"][aria-label="Zuständig"] button, [role="group"][aria-label="Zuständig"] input, [role="group"][aria-label="Zuständig"] [tabindex]')).toHaveCount(0);
    await expect(s.locator('[data-af="spalte"]')).toHaveCount(0);
    await expect(s).toContainText('nicht auf diesem Board');
    await expect(s.locator('[data-af="klasse"]')).toHaveValue('');
    await expect(s.locator('[data-af="labels"]')).toHaveValue('');
    await expect(s.locator('[data-af="labels"]')).toHaveAttribute('placeholder', 'ui, daten');
    await expect(s.locator('[data-af="faellig"]')).toHaveValue('');
  });

  /* ── Fehler und Grenzen ── */

  test('423 Board: nur „Spalte“ degradiert, die übrigen Felder bleiben bedienbar', async ({ page }) => {
    await k.stoppen().catch(() => {});
    k = await kanbanStarten(einrichten({ ...GRUND, 'boards/fabrik.md': BOARD_KAPUTT }));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="1"] a').click();
    const s = spalte(page);
    await expect(s).toContainText('nicht auf diesem Board');
    await expect(s.locator('[data-af="spalte"]')).toHaveCount(0);
    await expect(s.locator('[data-af="klasse"]')).toBeEditable();
    await expect(s.locator('[data-af="labels"]')).toBeEditable();
    await expect(s.locator('[data-af="faellig"]')).toBeEditable();
  });

  test('423 Board unter Live: fällt das Feld „Spalte“ weg, steht der Fokus auf #inhalt-spalte, nie auf BODY', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await feld(page, 'spalte').focus();
    k.schreib('boards/fabrik.md', BOARD_KAPUTT);
    await expect(spalte(page)).toContainText('nicht auf diesem Board');
    await expect.poll(() => fokusFeld(page)).toBe('inhalt-spalte');
  });

  // Die 403 der Menschen-Spalte kommt aus dem Server (R00097); die Oberfläche verlangt für „bewegen“ eine Menschen-Identität,
  // deshalb stellt die Probe die Ablehnung an der Naht (Muster kontrast.spec.js, 409). Geprüft wird der Fehlerpfad der Spalte:
  // Meldung im Fuß, gespeicherter Wert im Feld, kein Commit, keine eigene Live-Region.
  test('403: die Ablehnung steht im Fuß, das Feld zeigt wieder den gespeicherten Wert', async ({ page }) => {
    await oeffnen(page);
    const stand = k.git('log', '-1', '--format=%H');
    await page.route('**/api/boards/fabrik/bewegen', route => route.request().method() === 'POST'
      ? route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ fehler: 'Spalte „Fertig“ gehört dem Menschen', spalte: 'Fertig', nummer: 1 }) })
      : route.continue());
    await feld(page, 'spalte').selectOption('Fertig');
    await expect(page.locator('#fenster .mod-fuss [role="alert"]')).toContainText('gehört dem Menschen');
    await expect(feld(page, 'spalte')).toHaveValue('Eingang');
    expect(k.git('log', '-1', '--format=%H')).toBe(stand);
    await expect(page.locator('#inhalt-spalte [role="alert"]')).toHaveCount(0);
    await expect(page.locator('#inhalt-spalte [aria-live]')).toHaveCount(0);
  });

  test('423 Aufgabendatei: die Defektfläche ersetzt das Fenster, keine Spalte mit Eingabefeldern', async ({ page }) => {
    await page.goto(k.adresse + '#/board/fabrik');
    await page.locator('.ka.defekt[data-id="3"]').click();
    await expect(page.getByRole('dialog', { name: 'Defekte Datei #3' })).toBeVisible();
    await expect(page.locator('#inhalt-spalte')).toHaveCount(0);
    await expect(page.locator('#fenster')).toHaveCount(0);
  });

  /* ── US-6: schmale Breiten, Höhe, Reihenfolge (B0679/B0680) ── */

  test('US-6: bei 641 px rechts und 200 ± 1; bei 640 px unter dem Inhalt, volle Fensterbreite', async ({ page }) => {
    await page.setViewportSize({ width: 641, height: 896 });
    await oeffnen(page);
    let m = await masse(page);
    expect(Math.abs(m.spalte.breite - 200), `641 px: Spalte ${m.spalte.breite}`).toBeLessThanOrEqual(1);
    expect(m.spalte.x, 'rechts neben dem Inhalt').toBeGreaterThanOrEqual(m.main.rechts - 0.5);
    expect(m.order).toBe('0');

    await breiteSetzen(page, 640, 896);
    await expect.poll(async () => (await masse(page)).spalte.hoehe).toBeGreaterThan(0);
    m = await masse(page);
    expect(m.spalte.y, '640 px: unter dem Inhalt').toBeGreaterThanOrEqual(m.main.unten - 0.5);
    expect(Math.abs(m.spalte.breite - m.body.breite), 'volle Fensterbreite').toBeLessThanOrEqual(1);
    expect(m.order).toBe('0');
  });

  for (const breite of [320, 375, 414, 640, 641]) {
    test(`US-6: ${breite} px, hell und dunkel — kein Querscrollen, nichts abgeschnitten`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 844 });
      await oeffnen(page);
      for (const themaName of ['light', 'dark']) {
        await thema(page, themaName);
        const m = await masse(page);
        expect(m.seite[0], `${breite}/${themaName}: Seite`).toBeLessThanOrEqual(m.seite[1]);
        expect(m.fensterScroll[0], `${breite}/${themaName}: Fenster`).toBeLessThanOrEqual(m.fensterScroll[1]);
        expect(m.bodyScroll[0], `${breite}/${themaName}: Körper`).toBeLessThanOrEqual(m.bodyScroll[1]);
        // jede Feldzeile ist bedienbar und zeigt ihren Wert ganz
        for (const name of FELDER) {
          await feld(page, name).scrollIntoViewIfNeeded();
          const ganz = await feld(page, name).evaluate(e => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().width > 0);
          expect(ganz, `${breite}/${themaName}: ${name} ganz`).toBe(true);
        }
      }
    });
  }

  test('US-6: kurzes Fenster 844 × 390 und 740 × 360 (Touch) — Spalte 200/176, fünf Zeilen erreichbar, Ziele 48 px', async ({ browser }) => {
    for (const [breite, hoehe] of [[844, 390], [740, 360]]) {
      const kontext = await browser.newContext({ viewport: { width: breite, height: hoehe }, isMobile: true, hasTouch: true });
      try {
        const page = await kontext.newPage();
        await alsPerson(page, 'st');
        await oeffnen(page);
        const s = spalte(page);
        const m = await masse(page);
        expect(Math.abs(m.spalte.breite - 200), `${breite}: Spur ${m.spalte.breite}`).toBeLessThanOrEqual(1);
        expect(await s.locator('.w').count(), `${breite}: fünf Zeilen`).toBe(5);
        // 176 px Wertfläche (200 − 2 × 12 px Innenabstand)
        const flaeche = await s.locator('.w').first().boundingBox();
        expect(Math.abs(flaeche.width - 176), `${breite}: Wertfläche ${flaeche.width}`).toBeLessThanOrEqual(1);
        // jede der fünf Zeilen ist erreichbar, ganz im Rahmen und nicht abgeschnitten
        for (const wert of await s.locator('.w').all()) {
          await wert.scrollIntoViewIfNeeded();
          const drin = await wert.evaluate(e => {
            const r = e.getBoundingClientRect(), rahmen = document.querySelector('#inhalt-spalte').getBoundingClientRect();
            return r.top >= rahmen.top - 0.5 && r.bottom <= rahmen.bottom + 0.5 && r.width > 0 && e.scrollWidth <= e.clientWidth + 1;
          });
          expect(drin, `${breite}: Zeile ganz im Rahmen`).toBe(true);
        }
        // Ziele bei Touch 48 px (Haus; ADR-0012: ≥ 44)
        for (const name of FELDER) {
          const ziel = await feld(page, name).boundingBox();
          expect(Math.abs(ziel.height - 48), `${breite}: ${name} ${ziel.height} px`).toBeLessThanOrEqual(0.5);
        }
      } finally {
        await kontext.close();
      }
    }
  });

  test('US-6: DOM-Reihenfolge und Tab — DURCHLÄUFE → Spalte → Klasse → Labels → Fällig, kein order', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await oeffnen(page);
    await page.locator('#durchlaeufe').getByRole('group', { name: 'Durchläufe der Aufgabe #1' }).focus();
    const folge = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); folge.push(await fokusFeld(page)); }
    expect(folge).toEqual(['spalte', 'klasse', 'labels', 'faellig']);
    expect((await masse(page)).order).toBe('0');
  });

  test('US-6: Kontrast aller Spaltentexte ≥ 4,5:1 in beiden Themen, Fokusring ≥ 3:1', async ({ page }) => {
    await oeffnen(page);
    for (const themaName of ['light', 'dark']) {
      await thema(page, themaName);
      const verstoesse = (await kontrastMessen(page, ['#inhalt-spalte'])).filter(m => m.wert < 4.5);
      expect(verstoesse, `${themaName}: ${JSON.stringify(verstoesse)}`).toEqual([]);
      const ring = await page.locator('#inhalt-spalte [data-af="klasse"]').evaluate(e => {
        e.focus();
        const s = getComputedStyle(e);
        return { farbe: s.outlineColor, breite: s.outlineWidth, abstand: s.outlineOffset, grund: getComputedStyle(document.querySelector('#inhalt-spalte')).backgroundColor };
      });
      expect(ring.breite).toBe('2px');
      expect(ring.abstand).toBe('-1px');
      expect(await kontrastFarben(page, ring.farbe, ring.grund), `${themaName}: Fokusring`).toBeGreaterThanOrEqual(3);
    }
  });

  test('US-6: „niemand“, „nicht auf diesem Board“ und der Labels-Platzhalter halten ≥ 4,5:1 in beiden Themen', async ({ page }) => {
    // #2 hat weder Board noch Zuständige und ein leeres Labels-Feld: alle drei Sondertexte stehen zusammen.
    await page.goto(k.adresse + '#/aufgaben');
    await page.locator('tr[data-zeile="2"] a').click();
    const s = spalte(page);
    await expect(s).toContainText('nicht auf diesem Board');
    await expect(s.locator('[role="group"][aria-label="Zuständig"]')).toHaveText('niemand');
    for (const themaName of ['light', 'dark']) {
      await thema(page, themaName);
      const messungen = await kontrastMessen(page, ['#inhalt-spalte']);
      const texte = messungen.map(m => m.text);
      expect(texte, `${themaName}: „niemand“ gemessen`).toContain('niemand');
      expect(texte, `${themaName}: „nicht auf diesem Board“ gemessen`).toContain('nicht auf diesem Board');
      expect(messungen.filter(m => m.element.endsWith('::placeholder')).map(m => m.text), `${themaName}: Platzhalter gemessen`).toContain('ui, daten');
      const verstoesse = messungen.filter(m => m.wert < 4.5);
      expect(verstoesse, `${themaName}: ${JSON.stringify(verstoesse)}`).toEqual([]);
    }
  });

  test('US-6: die DURCHLÄUFE-Tabelle scrollt in sich — das Fenster scrollt bei 320/375/414/640 nicht quer', async ({ page }) => {
    for (const breite of [320, 375, 414, 640]) {
      await breiteSetzen(page, breite, 844);
      await oeffnen(page);
      const rahmen = page.locator('#durchlaeufe').getByRole('group', { name: 'Durchläufe der Aufgabe #1' });
      await expect(rahmen, `${breite} px`).toHaveCount(1);
      await expect(rahmen).toHaveAttribute('tabindex', '0');
      await rahmen.focus();
      await expect(rahmen).toBeFocused();
      const m = await masse(page);
      expect(m.fensterScroll[0], `${breite} px: Fenster`).toBeLessThanOrEqual(m.fensterScroll[1]);
      expect(m.seite[0], `${breite} px: Seite`).toBeLessThanOrEqual(m.seite[1]);
    }
  });

  /* ── US-8: der Rückgängig-Hinweis verdeckt keine Feldzeile ── */

  for (const [breite, hoehe] of [[1280, 800], [414, 800], [320, 800], [844, 390]]) {
    test(`US-8: Rückgängig-Hinweis verdeckt keine Zeile der Spalte (${breite} × ${hoehe})`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: hoehe });
      await oeffnen(page);
      await page.locator('#anhaenge [data-act="anhang-weg"]').click();
      await expect(page.locator('.toast[role="status"]')).toBeVisible();
      await feld(page, 'faellig').focus();
      // Mit dem Fokus im letzten Feld muss dieses über dem Hinweis stehen (scroll-padding der Spalte)
      const fokusFrei = await feld(page, 'faellig').evaluate(e => {
        const r = e.getBoundingClientRect(), h = document.querySelector('.toast[role="status"]').getBoundingClientRect();
        return r.bottom <= h.top + 0.5;
      });
      expect(fokusFrei, 'das fokussierte Feld steht über dem Hinweis').toBe(true);
      const verdeckt = await page.evaluate(() => {
        const hinweis = document.querySelector('.toast[role="status"]').getBoundingClientRect();
        return [...document.querySelectorAll('#inhalt-spalte .w')].map(w => {
          w.scrollIntoView({ block: 'nearest' });
          const r = w.getBoundingClientRect();
          const ueberlappt = Math.min(r.right, hinweis.right) - Math.max(r.left, hinweis.left) > 0.5 && Math.min(r.bottom, hinweis.bottom) - Math.max(r.top, hinweis.top) > 0.5;
          const treffer = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { text: w.textContent.trim().slice(0, 20), ueberlappt, getroffen: Boolean(treffer && w.contains(treffer)) };
        });
      });
      expect(verdeckt.filter(z => z.ueberlappt || !z.getroffen), JSON.stringify(verdeckt)).toEqual([]);
    });
  }
});
