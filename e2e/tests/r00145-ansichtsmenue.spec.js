// R00145 Ansichtswechsel als Menü, Anhänge im Inhalt (Karte #145, I0132) — US-1..US-8 im echten Programm.
// Die Reiterleiste ist ein Menü am Fensterkopf; „Anhänge“ ist keine Ansicht mehr, sondern ein Abschnitt im Inhalt.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, kontrastAm, thema, mutanteEinsetzen } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
---
`;

const AUFGABE_1 = `---
id: 1
title: Telemetrie der Agentenläufe bündeln
key: shop/nc-304/lodash
assignees: [st, cl]
labels: [zeit]
due: 2026-11-20
origins: [I0023]
---
Eine Beschreibung in Markdown.

- [ ] Zeile beim Start schreiben
- [x] Beim Stopp Ende eintragen

\`\`\`kanbanD-comments
2026-11-11 09:11 · cl · Ein Kommentar zum Vorgang.
\`\`\`

\`\`\`kanbanD-time
2026-11-11 07:35 · 2026-11-11 08:29 · st
\`\`\`

\`\`\`kanbanD-runs
2026-10-28 14:05 · Entwicklung · bestanden · cl · 1:43
\`\`\`
`;

const AUFGABE_2 = '---\nid: 2\ntitle: zwei\n---\nOhne Preisetikett\n';

const GRUND = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Fabrik\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n## Fertig\n\n',
  'aufgaben/0001-telemetrie.md': AUFGABE_1,
  'aufgaben/0001-telemetrie/protokoll.txt': Buffer.from('Inhalt des Protokolls'),
  'aufgaben/0002-zwei.md': AUFGABE_2,
};

const ANSICHTEN = ['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf'];

/** Der Ansichts-Auslöser im Fensterkopf (R00145 FA 4/5). */
const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const MENUE = '#fenster [role="menu"]';
const AKTIONEN = '#fenster [data-act="fenster-menue"][data-arg="aktionen"]';

test.describe('R00145 Ansichtsmenü', () => {
  let k;
  test.beforeEach(async ({ page }) => { await mutanteEinsetzen(page); k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  const ausloeser = page => page.locator(AUSLOESER);
  const menue = page => page.locator(MENUE);
  async function menueOeffnen(page) { await ausloeser(page).click(); await menue(page).waitFor(); }

  /* ── US-1: Menü statt Reiterleiste, genau eine gezeichnete Ansicht ── */

  test('US-1: kein tablist/tab/tabpanel, Auslöser nennt „Inhalt“ mit Caret, Panel ist role=group', async ({ page }) => {
    await oeffnen(page);
    await expect(page.locator('#fenster [role="tablist"]')).toHaveCount(0);
    await expect(page.locator('#fenster [role="tab"]')).toHaveCount(0);
    await expect(page.locator('#fenster [role="tabpanel"]')).toHaveCount(0);
    await expect(page.locator('#fenster [aria-selected]')).toHaveCount(0);
    await expect(page.locator('#fenster [aria-current]')).toHaveCount(0);
    const knopf = ausloeser(page);
    await expect(knopf).toHaveAttribute('aria-haspopup', 'menu');
    await expect(knopf).toHaveAttribute('aria-expanded', 'false');
    await expect(knopf).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(knopf).toContainText('Inhalt');
    // der Caret steht in einem span[aria-hidden] und zählt nicht zum sichtbaren Text des Namens
    await expect(knopf.locator('span[aria-hidden="true"]')).toHaveText('▾');
    const panel = page.locator('#fenster .mod-body');
    await expect(panel).toHaveAttribute('role', 'group');
    await expect(panel).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
  });

  test('US-2: Einträge in Reihenfolge, genau eine Markierung mit aria-checked und sichtbarem ✓', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    const eintraege = menue(page).getByRole('menuitemradio');
    await expect(eintraege).toHaveCount(5);
    const namen = await eintraege.evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
    expect(namen).toEqual(ANSICHTEN);
    await expect(menue(page).getByRole('menuitemradio', { checked: true })).toHaveCount(1);
    const gewaehlt = menue(page).getByRole('menuitemradio', { checked: true });
    await expect(gewaehlt.locator('.fm-haken')).toHaveText('✓');
    for (const n of ANSICHTEN.slice(1)) await expect(menue(page).getByRole('menuitemradio', { name: n, exact: true }).locator('.fm-haken')).toHaveText('');
    // alle Texte beginnen an derselben Kante (±1 px): das ✓ steht in einem festen Gutter
    const kanten = await eintraege.evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').getBoundingClientRect().x));
    for (const x of kanten) expect(Math.abs(x - kanten[0])).toBeLessThanOrEqual(1);
    // kein Titel, keine Kürzel
    await expect(menue(page).locator('.km-titel, h1, h2, h3, h4, h5, h6')).toHaveCount(0);
    await expect(menue(page).locator('kbd, .km-k')).toHaveCount(0);
    // Startfokus auf dem gewählten Eintrag
    await expect(gewaehlt).toBeFocused();
  });

  test('US-3: Startfokus folgt der gewählten Ansicht („Zeiten“ → Zeiten, nicht Inhalt)', async ({ page }) => {
    await oeffnen(page);
    await ausloeser(page).click();
    await menue(page).getByRole('menuitemradio', { name: 'Zeiten', exact: true }).click();
    await expect(ausloeser(page)).toBeFocused();
    await menueOeffnen(page);
    await expect(menue(page).getByRole('menuitemradio', { name: 'Zeiten', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await menueOeffnen(page);
    await expect(menue(page).getByRole('menuitemradio', { name: 'Zeiten', exact: true })).toBeFocused();
  });

  test('US-4: mit Preisetikett steht „Kosten“ hinter „Datei“, „Verlauf“ bleibt letzter', async ({ page }) => {
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } })).ok()).toBe(true);
    await oeffnen(page);
    await menueOeffnen(page);
    const namen = await menue(page).getByRole('menuitemradio').evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
    expect(namen).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']);
    await expect(menue(page).getByRole('menuitemradio', { name: 'Kosten', exact: true })).toHaveAttribute('aria-checked', 'false');
  });

  test('US-5: Wahl per Klick und per Enter — Menü zu, Auslöser nennt „Details“, Fokus am Auslöser (nie BODY)', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await menue(page).getByRole('menuitemradio', { name: 'Details', exact: true }).click();
    await expect(menue(page)).toHaveCount(0);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Details');
    await expect(ausloeser(page)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    const details = page.locator('#fenster .mod-body');
    await expect(details).toHaveAttribute('aria-label', 'Ansicht: Details');
    for (const feld of ['Schlüssel', 'Spalte', 'Klasse', 'Herkunft', 'Zuständig', 'Labels', 'Fällig']) {
      await expect(details.locator('.felder').getByText(feld, { exact: true }).first()).toBeVisible();
    }
    // per Enter: zurück auf „Inhalt“
    await menueOeffnen(page);
    await menue(page).getByRole('menuitemradio', { name: 'Inhalt', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(menue(page)).toHaveCount(0);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(ausloeser(page)).toBeFocused();
  });

  test('US-6: höchstens ein Kopf-Menü offen — ⋮ schließt das Ansichtsmenü und umgekehrt', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await page.locator(AKTIONEN).click();
    await expect(page.locator(MENUE)).toHaveCount(1);
    await expect(ausloeser(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator(AKTIONEN)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator(`${MENUE} [role="menuitem"]`).first()).toBeFocused();
    await ausloeser(page).click();
    await expect(page.locator(MENUE)).toHaveCount(1);
    await expect(page.locator(AKTIONEN)).toHaveAttribute('aria-expanded', 'false');
    await expect(ausloeser(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(menue(page).getByRole('menuitemradio', { checked: true })).toBeFocused();
  });

  test('Gegenbeispiel: kein Abschnitt steht in zwei Ansichten zugleich', async ({ page }) => {
    await oeffnen(page);
    const teile = {
      Inhalt: ['#fenster .titel', '#fenster h3:has-text("TEILAUFGABEN")', '#fenster #anhaenge', '#fenster h3:has-text("KOMMENTARE")', '#fenster #durchlaeufe'],
      Zeiten: ['#fenster .zt'],
      Details: ['#fenster .felder'],
      Datei: ['#fenster #dateitext'],
      Verlauf: ['#fenster .vh-tab'],
    };
    for (const [ansicht, selektoren] of Object.entries(teile)) {
      await ausloeser(page).click();
      await menue(page).getByRole('menuitemradio', { name: ansicht, exact: true }).click();
      for (const [andere, fremde] of Object.entries(teile)) {
        if (andere === ansicht) continue;
        for (const sel of fremde) await expect(page.locator(sel)).toHaveCount(0, `${sel} gehört nicht in „${ansicht}“`);
      }
      for (const sel of selektoren) await expect(page.locator(sel)).toHaveCount(1, `${sel} steht in „${ansicht}“`);
    }
  });

  /* ── Anhänge im Inhalt ── */

  test('US-7: ANHÄNGE steht nach TEILAUFGABEN und vor KOMMENTAREN, ohne Dateinamen; ✕ entfernt (ein Commit)', async ({ page }) => {
    await oeffnen(page);
    const reihenfolge = await page.locator('#fenster .mod-main .abs h3').evaluateAll(alle => alle.map(h => h.textContent.trim().split(/\s/)[0]));
    expect(reihenfolge).toEqual(['BESCHREIBUNG', 'TEILAUFGABEN', 'ANHÄNGE', 'KOMMENTARE', 'DURCHLÄUFE']);
    const abschnitt = page.locator('#fenster #anhaenge');
    await expect(abschnitt.locator('h3')).toHaveText('ANHÄNGE 1');
    expect(await abschnitt.locator('h3').innerText()).not.toContain('protokoll');
    await expect(abschnitt.getByRole('link', { name: 'protokoll.txt' })).toBeVisible();
    await expect(abschnitt.locator('.anh-z .muted')).toContainText('B');
    expect((await page.request.get(k.adresse + 'api/aufgaben/1')).ok()).toBe(true);
    const commitsVor = +k.git('rev-list', '--count', 'HEAD');
    await abschnitt.getByLabel('Anhang protokoll.txt entfernen').click();
    await expect(abschnitt.getByRole('link', { name: 'protokoll.txt' })).toHaveCount(0);
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(commitsVor + 1);
  });

  test('Gegenbeispiel: kein Menüeintrag „Anhänge“, Hochladen im Inhalt', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await expect(menue(page).getByRole('menuitemradio', { name: 'Anhänge', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.locator('#fenster #anhaenge').getByLabel('Anhang hinzufügen').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('neu') });
    await expect(page.locator('#fenster #anhaenge').getByRole('link', { name: 'notiz.txt' })).toBeVisible();
  });

  test('Leerfall: ANHÄNGE 0 mit „+ Datei wählen oder hierher ziehen“, kein leerer Kasten', async ({ page }) => {
    await oeffnen(page, 2);
    const abschnitt = page.locator('#fenster #anhaenge');
    await expect(abschnitt.locator('h3')).toHaveText('ANHÄNGE 0');
    await expect(abschnitt).toContainText('+ Datei wählen oder hierher ziehen');
    await expect(abschnitt.getByLabel('Anhang hinzufügen')).toBeAttached();
  });

  test('US-8: Datei-Drop auf die Beschreibung wird abgefangen (preventDefault), location.href bleibt', async ({ page }) => {
    await oeffnen(page);
    const vorher = page.url();
    const ergebnis = await page.evaluate(() => {
      const ziel = document.querySelector('#fenster .besch-lesen');
      const daten = new DataTransfer();
      daten.items.add(new File(['inhalt'], 'abgelegt.txt', { type: 'text/plain' }));
      const dragover = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: daten });
      const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: daten });
      ziel.dispatchEvent(dragover);
      ziel.dispatchEvent(drop);
      return { dragover: dragover.defaultPrevented, drop: drop.defaultPrevented };
    });
    expect(ergebnis.dragover, 'dragover wird abgefangen').toBe(true);
    expect(ergebnis.drop, 'drop wird abgefangen').toBe(true);
    await page.waitForTimeout(300);
    expect(page.url()).toBe(vorher);
  });

  /* ── Rückfall, Live, Fokus ── */

  test('Rückfall: gemerkter Stand „Anhänge“ → Inhalt, Auslöser nennt Inhalt, Anhänge stehen im Inhalt', async ({ page }) => {
    await oeffnen(page);
    await page.evaluate(() => { S.ui.tab = 'anhaenge'; render(); });
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.locator('#fenster #anhaenge')).toBeVisible();
    await expect(menue(page)).toHaveCount(0);
  });

  test('Rückfall live: cost: null in „Kosten“ → Inhalt, Menü zu, Fokus am Auslöser (1 s)', async ({ page }) => {
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } })).ok()).toBe(true);
    await oeffnen(page);
    await liveBereit(page);
    await ausloeser(page).click();
    await menue(page).getByRole('menuitemradio', { name: 'Kosten', exact: true }).click();
    await menueOeffnen(page);
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: null } })).ok()).toBe(true);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt', { timeout: 1000 });
    await expect(menue(page)).toHaveCount(0);
    await expect(ausloeser(page)).toBeFocused();
    await menueOeffnen(page);
    await expect(menue(page).getByRole('menuitemradio', { name: 'Kosten', exact: true })).toHaveCount(0);
  });

  test('Live: „Details“ bleibt gewählt, Fokus bleibt im Feld „Labels“', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await ausloeser(page).click();
    await menue(page).getByRole('menuitemradio', { name: 'Details', exact: true }).click();
    const labels = page.locator('#fenster .mod-body').getByLabel('Labels');
    await labels.focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/2', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'zwei neu' } })).ok()).toBe(true);
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Details', { timeout: 1000 });
    await expect(labels).toBeFocused();
  });

  test('Live bei offenem Menü: Menü bleibt offen, Fokus auf demselben Eintrag', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await menueOeffnen(page);
    const zeiten = menue(page).getByRole('menuitemradio', { name: 'Zeiten', exact: true });
    await zeiten.focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/2', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'zwei neu' } })).ok()).toBe(true);
    await expect(menue(page)).toHaveCount(1, { timeout: 1000 });
    await expect(zeiten).toBeFocused();
  });

  test('Esc schließt nur das Menü, der Fokus geht an den Auslöser', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await page.keyboard.press('Escape');
    await expect(menue(page)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(ausloeser(page)).toBeFocused();
  });

  test('Tastatur: Pfeile/Pos1/Ende/Enter im Menü, Tab schließt zum Auslöser', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await expect(menue(page).getByRole('menuitemradio', { name: 'Inhalt', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(menue(page).getByRole('menuitemradio', { name: 'Zeiten', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(menue(page).getByRole('menuitemradio', { name: 'Verlauf', exact: true })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(menue(page).getByRole('menuitemradio', { name: 'Inhalt', exact: true })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(menue(page).getByRole('menuitemradio', { name: 'Verlauf', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Verlauf');
    await expect(ausloeser(page)).toBeFocused();
    await menueOeffnen(page);
    await page.keyboard.press('Tab');
    await expect(menue(page)).toHaveCount(0);
    await expect(ausloeser(page)).toBeFocused();
  });

  test('`d` wechselt Inhalt ↔ Datei und lässt den Fokus am Auslöser; ← und → wechseln nicht', async ({ page }) => {
    await oeffnen(page);
    await ausloeser(page).focus();
    await page.keyboard.press('d');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Datei');
    await expect(ausloeser(page)).toBeFocused();
    await page.keyboard.press('d');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(ausloeser(page)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await page.keyboard.press('ArrowLeft');
    await expect(ausloeser(page)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
  });

  test('Kürzelhilfe nennt `d` mit „Inhalt / Datei“ und keinen Reiter-Wechsel', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster .mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe.locator('tr', { hasText: 'Inhalt / Datei' })).toContainText('Inhalt / Datei');
    await expect(hilfe).not.toContainText('Reiter wechseln');
    await expect(hilfe).not.toContainText('←');
  });

  test('Dialog „Neue Aufgabe“ hat keine Ansichtsauswahl', async ({ page }) => {
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Neue Aufgabe in Eingang' }).click();
    const neu = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await expect(neu).toBeVisible();
    await expect(neu.locator('[aria-haspopup="menu"][aria-label^="Ansicht:"]')).toHaveCount(0);
    await expect(neu.locator('[role="tablist"], [role="tab"]')).toHaveCount(0);
  });
});

/* ── Schmale Breiten: einzeilig, drei Ziele, Menü im Bild (hell und dunkel) ── */

test.describe('R00145 schmale Breiten', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    k = await kanbanStarten(einrichten(GRUND));
    await alsPerson(page, 'st');
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } })).ok()).toBe(true);
  });
  test.afterEach(() => k.stoppen());

  /** Kopfhöhe und Oberkanten der drei Ziele; --kd-ziel löst der Browser auf. */
  async function kopfMessen(page) {
    return page.evaluate(() => {
      const px = wert => parseFloat(wert) || 0;
      const ziel = px(getComputedStyle(document.documentElement).getPropertyValue('--kd-ziel'));
      const kopf = document.querySelector('#fenster .mod-kopf');
      const ziele = {
        ansicht: document.querySelector('#fenster [data-act="fenster-menue"][data-arg="ansicht"]'),
        aktionen: document.querySelector('#fenster [data-act="fenster-menue"][data-arg="aktionen"]'),
        schliessen: document.querySelector('#fenster [data-act="schliessen"]'),
      };
      return {
        ziel,
        hoehe: kopf.clientHeight,
        oberkanten: Object.fromEntries(Object.entries(ziele).map(([n, e]) => [n, e ? e.getBoundingClientRect().top : null])),
        kopfQuer: { sw: kopf.scrollWidth, cw: kopf.clientWidth },
        seiteQuer: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
      };
    });
  }

  test('US-9: 320/375/414 px hell und dunkel einzeilig, drei Ziele auf einer Oberkante, Menü ganz im Bild', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    for (const breite of [320, 375, 414]) {
      await page.setViewportSize({ width: breite, height: 700 });
      for (const name of ['light', 'dark']) {
        await thema(page, name);
        const m = await kopfMessen(page);
        const grenze = Math.max(36, m.ziel) + 2;
        expect(m.hoehe, `${breite} px ${name}: Kopfhöhe ${m.hoehe} ≤ ${grenze}`).toBeLessThanOrEqual(grenze);
        const kanten = Object.values(m.oberkanten);
        for (const kante of kanten) expect(Math.abs(kante - kanten[0]), `${breite} px ${name}: gleiche Oberkante (±1)`).toBeLessThanOrEqual(1);
        expect(m.kopfQuer.sw, `${breite} px ${name}: Kopf scrollt nicht quer`).toBeLessThanOrEqual(m.kopfQuer.cw);
        expect(m.seiteQuer.sw, `${breite} px ${name}: Seite scrollt nicht quer`).toBeLessThanOrEqual(m.seiteQuer.cw);
        // ↗ ist unter 641 px versteckt
        await expect(page.locator('#fenster #vsc')).toBeHidden();
        // Menü ganz im sichtbaren Bereich
        await page.locator(AUSLOESER).click();
        const box = await page.locator(MENUE).boundingBox();
        expect(box.x, `${breite} px ${name}: Menü links im Bild`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${breite} px ${name}: Menü rechts im Bild`).toBeLessThanOrEqual(breite);
        expect(box.y + box.height, `${breite} px ${name}: Menü unten im Bild`).toBeLessThanOrEqual(700);
        await page.keyboard.press('Escape');
      }
    }
  });

  test('US-9: ab 641 px ist ↗ sichtbar, das Menü endet an der Endkante des Auslösers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.locator('#fenster #vsc')).toBeVisible();
    await page.locator(AUSLOESER).click();
    const menue = await page.locator(MENUE).boundingBox();
    const knopf = await page.locator(AUSLOESER).boundingBox();
    expect(Math.abs((menue.x + menue.width) - (knopf.x + knopf.width)), 'Endkante am Auslöser').toBeLessThanOrEqual(1);
    expect(menue.y).toBeGreaterThanOrEqual(knopf.y);
  });
});
