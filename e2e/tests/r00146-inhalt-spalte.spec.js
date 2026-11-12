// R00146 Inhalt: schmale rechte Spalte (Karte #146, I0133) — US-1..US-8 im echten Programm.
// Rechts im Inhalt stehen Spalte, Klasse, Labels und Fällig bearbeitbar (dieselben `data-af`-Schlüssel wie „Details“,
// ein Zeichner, ein Commit je Änderung) und die gewählten Zuständigen nur lesend. „Details“ bleibt vollständig.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, reiter, thema, kontrastMessen, kontrastFarben } = require('./hilfen');

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
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse + '#/board/fabrik');
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
    expect(paare.map(p => p.text).slice(0, 4)).toEqual(['Spalte', 'Klasse', 'Labels', 'Fällig']);
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
    expect(await spalte(page).locator('.kb .k').allInnerTexts()).toEqual(['Spalte', 'Klasse', 'Labels', 'Fällig']);
  });

});
