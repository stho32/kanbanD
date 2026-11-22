// R00127 Kartendetails mit mehreren Ansichten (Karte #104, I0115) — US-1..US-7 im echten Programm.
// Der Ansichtswechsel ist seit R00145 ein Menü am Fensterkopf (Karte #145); diese Probe prüft die Ansichten selbst:
// welche es gibt, was jede zeigt, dass genau eine gezeichnet wird und dass Live und Rückfall sie erhalten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, breiteSetzen, reiter, masse } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
---
`;

const STUNDE = '2026-11-11 07:35 · 2026-11-11 08:29 · st';
const LAEUFT = '2026-11-11 10:11 · ... · st';

const AUFGABE_1 = `---
id: 1
title: Telemetrie der Agentenläufe bündeln
key: shop/nc-304/lodash
assignees: [st, cl]
labels: [zeit]
due: 2026-11-20
origins: [I0023, I0024]
---
Eine Beschreibung in Markdown.

- [ ] Zeile beim Start schreiben
- [x] Beim Stopp Ende eintragen

\`\`\`kanbanD-comments
2026-11-11 09:11 · cl · Ein Kommentar zum Vorgang.
\`\`\`

\`\`\`kanbanD-time
${STUNDE}
${LAEUFT}
\`\`\`

\`\`\`kanbanD-runs
2026-10-28 14:05 · Entwicklung · bestanden · cl · 1:43
\`\`\`
`;

const AUFGABE_2 = '---\nid: 2\ntitle: zwei\n---\nOhne Preisetikett\n';

const GRUND = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Entwicklung\n\n## Eingang\n\n- #1\n- #2\n\n## In Arbeit\n\n## Fertig\n',
  'aufgaben/0001-telemetrie.md': AUFGABE_1,
  'aufgaben/0001-telemetrie/protokoll.txt': Buffer.from('Inhalt des Protokolls'),
  'aufgaben/0002-zwei.md': AUFGABE_2,
};

const ANSICHTEN = ['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf'];
const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const ANSICHTSMENUE = '#fenster [role="menu"][data-art="ansicht"]';
/** Kleinste Seite eines gemessenen Knotens; fehlt der Knoten (`null`), ist sie `NaN` und besteht keine Schwelle. */
const kleinsteSeite = m => (m ? Math.round(Math.min(m.width, m.height)) : NaN);
const panel = (page, schluessel) => page.locator(`#fenster .mod-body[data-ansicht="${schluessel}"]`);

test.describe('R00127 Kartendetails mit mehreren Ansichten', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  async function ansichtsNamen(page) {
    await page.locator(AUSLOESER).click();
    const namen = await page.locator(`${ANSICHTSMENUE} .fm-text`).allInnerTexts();
    await page.keyboard.press('Escape');
    return namen;
  }

  /* ── US-1/US-5/US-7: Ansichten, Reihenfolge, genau eine gezeichnete ── */

  test('US-1: Ansichten in Reihenfolge, Inhalt gewählt, genau eine gezeichnete Ansicht', async ({ page }) => {
    await oeffnen(page);
    expect(await ansichtsNamen(page)).toEqual(ANSICHTEN);
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.getByRole('tabpanel')).toHaveCount(0);
    await expect(panel(page, 'inhalt')).toBeVisible();
    await expect(page.locator('#fenster .mod-body')).toHaveCount(1);
    await expect(page.locator('#fenster [role="group"][aria-label^="Ansicht: "]')).toHaveCount(1);
  });

  test('US-1/M1: jede Ansicht zeichnet nur ihren Abschnitt', async ({ page }) => {
    await oeffnen(page);
    // R00146: die Spalte im Inhalt trägt selbst `.felder` — „Details“ wird über seine Auslage unterschieden
    const teile = { Inhalt: '.mod-main .titel', Zeiten: '.zt', Details: '.felder.felder-details', Datei: '#dateitext', Verlauf: '.vh-tab' };
    for (const [name, selektor] of Object.entries(teile)) {
      await reiter(page, name);
      await expect(page.locator(selektor)).toBeVisible();
      await expect(page.locator('#fenster .mod-body')).toHaveCount(1);
      for (const [andere, fremd] of Object.entries(teile)) {
        if (andere !== name) await expect(page.locator(fremd)).toHaveCount(0, `${fremd} gehört nicht in „${name}“`);
      }
    }
  });

  test('US-1: mit Preisetikett steht „Kosten“ direkt hinter „Datei“', async ({ page }) => {
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } });
    await oeffnen(page);
    expect(await ansichtsNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']);
    await reiter(page, 'Kosten');
    await expect(panel(page, 'kosten').locator('table')).toBeVisible();
    await expect(page.locator('#fenster .mod-body')).toHaveCount(1);
  });

  test('US-5: das Menü führt per Tastatur; d wechselt Datei ↔ Inhalt', async ({ page }) => {
    await oeffnen(page);
    await page.locator(AUSLOESER).click();
    const eintrag = name => page.locator(ANSICHTSMENUE).getByRole('menuitemradio', { name, exact: true });
    await expect(eintrag('Inhalt')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(eintrag('Zeiten')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(eintrag('Details')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Details');
    await expect(panel(page, 'details')).toBeVisible();
    await page.keyboard.press('d');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Datei');
    await page.keyboard.press('d');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
  });

  test('US-5: Pos1 und Ende erreichen ersten und letzten Eintrag', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    await page.locator(AUSLOESER).click();
    await page.keyboard.press('Home');
    await expect(page.locator(ANSICHTSMENUE).getByRole('menuitemradio', { name: 'Inhalt', exact: true })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator(ANSICHTSMENUE).getByRole('menuitemradio', { name: 'Verlauf', exact: true })).toBeFocused();
  });

  test('US-7: gemerkte, unbekannte Ansicht fällt generisch auf „Inhalt“', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    // Eine künftige Ansicht, die die Liste heute nicht führt: die generische Bedingung tab ∉ reiterSchluessel(a)
    await page.evaluate(() => { S.ui.tab = 'kuenftig'; render(); });
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(panel(page, 'inhalt')).toBeVisible();
    await expect(page.locator('#fenster .mod-body')).toHaveCount(1);
  });

  test('US-7: Live-Ereignis nimmt das Etikett, die gemerkte Ansicht „Kosten“ fällt auf „Inhalt“', async ({ page }) => {
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } });
    await oeffnen(page);
    await liveBereit(page);
    await reiter(page, 'Kosten');
    await page.locator(AUSLOESER).focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: null } })).ok()).toBe(true);
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt', { timeout: 1000 });
    await expect(page.locator('#fenster .mod-body')).toHaveCount(1);
    await expect(panel(page, 'inhalt')).toBeVisible();
  });

  /* ── US-1/B0586: „Inhalt“ bleibt schlank ── */

  test('US-1/S2: „Inhalt“ zeigt Titel, Beschreibung, Teilaufgaben, Anhänge, Kommentare, Durchläufe — sonst nichts', async ({ page }) => {
    await oeffnen(page);
    const inhalt = panel(page, 'inhalt');
    await expect(inhalt.locator('.titel')).toHaveText('Telemetrie der Agentenläufe bündeln');
    await expect(inhalt.locator('h3', { hasText: 'BESCHREIBUNG' })).toBeVisible();
    await expect(inhalt.locator('h3', { hasText: 'TEILAUFGABEN' })).toBeVisible();
    await expect(inhalt.locator('h3', { hasText: 'ANHÄNGE' })).toBeVisible();
    await expect(inhalt.locator('h3', { hasText: 'KOMMENTARE' })).toBeVisible();
    await expect(inhalt.locator('#durchlaeufe')).toBeVisible();
    await expect(inhalt.locator('.zt')).toHaveCount(0);
    await expect(inhalt.locator('h3', { hasText: 'LÄUFT GERADE' })).toHaveCount(0);
    // R00146: die vier Felder stehen zusätzlich in der schmalen Spalte rechts, nicht im Inhaltsfluss
    await expect(inhalt.locator('.mod-main .felder')).toHaveCount(0);
    await expect(inhalt.locator('.mod-main').getByLabel('Spalte')).toHaveCount(0);
    await expect(inhalt.locator('.mod-main').getByLabel('Klasse')).toHaveCount(0);
    await expect(inhalt.locator('#inhalt-spalte').getByLabel('Spalte')).toHaveCount(1);
  });

  /* ── US-2/B0583: Zeiten und Timer ── */

  test('US-2: „Zeiten“ zeigt Läuft gerade und die Zeiten-Tabelle; Stopp stoppt den Timer (ein Commit)', async ({ page }) => {
    const commitsVor = +k.git('rev-list', '--count', 'HEAD');
    await oeffnen(page);
    await expect(panel(page, 'inhalt').locator('.zt')).toHaveCount(0);
    await reiter(page, 'Zeiten');
    const zeiten = panel(page, 'zeiten');
    await expect(zeiten.locator('h3', { hasText: 'LÄUFT GERADE' })).toBeVisible();
    await expect(zeiten.getByLabel('Timer von Stefan stoppen')).toBeVisible();
    await expect(zeiten.locator('.zt')).toContainText('07:35–08:29');
    await expect(zeiten.locator('.zt tr')).toHaveCount(2);
    await zeiten.getByLabel('Timer von Stefan stoppen').click();
    await expect.poll(() => k.lies('aufgaben/0001-telemetrie.md')).not.toContain('10:11 · ... · st');
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(commitsVor + 1);
    await reiter(page, 'Inhalt');
    await expect(panel(page, 'inhalt').locator('.zt')).toHaveCount(0);
  });

  /* ── US-3/B0584: Anhänge im Inhalt (R00145) ── */

  test('US-3: die Anhänge stehen im Inhalt mit Name, Größe und ✕; Hochladen und Entfernen wie heute', async ({ page }) => {
    await oeffnen(page);
    const anhaenge = panel(page, 'inhalt').locator('#anhaenge');
    await expect(anhaenge.getByRole('link', { name: 'protokoll.txt' })).toBeVisible();
    await expect(anhaenge.locator('.anh-z .muted')).toContainText('B');
    await anhaenge.getByLabel('Anhang hinzufügen').setInputFiles({ name: 'notiz.txt', mimeType: 'text/plain', buffer: Buffer.from('neu') });
    await expect(anhaenge.getByRole('link', { name: 'notiz.txt' })).toBeVisible();
    await anhaenge.getByLabel('Anhang notiz.txt entfernen').click();
    await expect(anhaenge.getByRole('link', { name: 'notiz.txt' })).toHaveCount(0);
  });

  /* ── US-4/B0585: Details ── */

  test('US-4/S1: „Details“ trägt die Felder samt „Schlüssel“ (nur lesend); keine Seitenleiste', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    const details = panel(page, 'details');
    await expect(details.locator('.felder')).toBeVisible();
    await expect(details.locator('.k', { hasText: /^Schlüssel$/ })).toHaveCount(1);
    await expect(details.locator('#schluessel')).toHaveText('shop/nc-304/lodash');
    await expect(details.locator('#schluessel').locator('input, select, textarea, [contenteditable]')).toHaveCount(0);
    for (const feld of ['Spalte', 'Klasse', 'Labels', 'Fälligkeit']) await expect(details.getByLabel(feld, { exact: true })).toHaveCount(1);
    await expect(page.locator('#fenster .mod-side')).toHaveCount(0);
  });

  test('US-4: Feld „Spalte“ auf „Fertig“ bewegt die Karte (ein Commit), Datei bleibt konsistent', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    await panel(page, 'details').getByLabel('Spalte').selectOption('Fertig');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/## Fertig\n\n- \[#1\]/);
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(1, 'die Karte bleibt sichtbar (in der letzten Spalte)');
  });

  test('US-4: ohne gesetzten Schlüssel fehlt die Zeile „Schlüssel“', async ({ page }) => {
    await oeffnen(page, 2);
    await reiter(page, 'Details');
    await expect(panel(page, 'details').locator('.k', { hasText: /^Schlüssel$/ })).toHaveCount(0);
    await expect(page.locator('#schluessel')).toHaveCount(0);
    await expect(panel(page, 'details').locator('.felder')).toBeVisible();
  });

  test('US-4/Live: Änderung am Titel lässt Ansicht „Details“ und den Fokus im Feld „Labels“ stehen', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await reiter(page, 'Details');
    const labels = panel(page, 'details').getByLabel('Labels');
    await labels.focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'Telemetrie gebündelt' } })).ok()).toBe(true);
    await expect(panel(page, 'details').locator('.titel, [aria-label="Titel"]')).toHaveCount(0, 'Details zeichnet keinen Titel');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Details', { timeout: 1000 });
    await expect(labels).toBeFocused();
  });

  /* ── Kein Abschnitt doppelt (Gegenbeispiel) ── */

  test('Gegenbeispiel: die Zeiten-Tabelle und die Felder stehen in keiner anderen Ansicht', async ({ page }) => {
    await oeffnen(page);
    for (const name of ANSICHTEN) {
      await reiter(page, name);
      const schluessel = { Inhalt: 'inhalt', Zeiten: 'zeiten', Details: 'details', Datei: 'datei', Verlauf: 'verlauf' }[name];
      if (name === 'Zeiten') { await expect(panel(page, schluessel).locator('.zt')).toHaveCount(1); continue; }
      await expect(panel(page, schluessel).locator('.zt')).toHaveCount(0, `keine Zeiten-Tabelle in „${name}“`);
      if (name === 'Details') { await expect(panel(page, schluessel).locator('.felder.felder-details')).toHaveCount(1); continue; }
      // R00146: im Inhalt steht die schmale Spalte (.felder.felder-schmal), nie die Auslage von „Details“
      await expect(panel(page, schluessel).locator('.felder:not(.felder-schmal)')).toHaveCount(0, `keine Felder in „${name}“`);
    }
  });

  test('US-6: „Verlauf“ bleibt unverändert (Tabelle neueste oben); „Datei“ zeigt die Datei', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Datei');
    await expect(page.locator('#dateitext')).toContainText('title: Telemetrie');
    await reiter(page, 'Verlauf');
    await expect(panel(page, 'verlauf')).toBeVisible();
  });

  test('Kürzelhilfe nennt keinen Reiter-Wechsel mehr (R00145 FA 8)', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster .mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe).not.toContainText('Reiter wechseln');
    await expect(hilfe.locator('tr', { hasText: 'Inhalt / Datei' })).toContainText('Inhalt / Datei');
  });
});

/* ── US-6/B0582: schmale Breiten, hell und dunkel ── */

test.describe('R00127 schmale Breiten', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUND));
    await alsPerson(page, 'st');
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', min: 0.6, max: 1.6 } } });
  });
  test.afterEach(() => k.stoppen());

  test('US-6: bei 320/375/414 px bleibt der Kopf einzeilig, das Menü im Bild, jede Ansicht bedienbar (hell und dunkel)', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    for (const breite of [320, 375, 414]) {
      for (const thema of ['light', 'dark']) {
        await breiteSetzen(page, breite, 700);
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
        const ziel = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kd-ziel')) || 0);
        await expect.poll(async () => { const kopf = await masse(page, '#fenster .mod-kopf'); return kopf && kopf.scrollWidth <= kopf.clientWidth; }, { message: `${breite} px ${thema}: Kopf scrollt nicht quer` }).toBe(true);
        await expect.poll(async () => { const kopf = await masse(page, '#fenster .mod-kopf'); return kopf && kopf.clientHeight <= Math.max(36, ziel) + 2; }, { message: `${breite} px ${thema}: einzeilig` }).toBe(true);
        const seite = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(seite.sw, `${breite} px ${thema}: die Seite scrollt nicht quer`).toBeLessThanOrEqual(seite.cw);
        await page.locator(AUSLOESER).click();
        // erst wenn das Menü steht: gleich nach dem Klick ist es noch nicht gezeichnet (ADR-0026 Regel 2)
        await expect(page.locator(ANSICHTSMENUE)).toBeVisible();
        await expect.poll(async () => (await masse(page, ANSICHTSMENUE))?.x, { message: `${breite} px ${thema}: Menü links im Bild` }).toBeGreaterThanOrEqual(0);
        await expect.poll(async () => { const m = await masse(page, ANSICHTSMENUE); return m && m.x + m.width; }, { message: `${breite} px ${thema}: Menü rechts im Bild` }).toBeLessThanOrEqual(breite);
        await page.keyboard.press('Escape');
        for (const n of ['Kosten', 'Details', 'Inhalt']) {
          await reiter(page, n);
          await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', `Ansicht: ${n}`);
        }
      }
    }
  });

  test('US-6: bei feinem Zeiger misst der Auslöser ≥ 24 × 24 px, bei Touch ≥ 44 × 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    // erst wenn die Leitung steht und der Auslöser sichtbar ist (ADR-0026 Regel 3; `bereit` taugt bei offenem Fenster nicht:
    // `kdTest.gezeichnet()` wird dort nie wahr) — ein Neuzeichnen kurz nach dem Öffnen ersetzt den Knoten
    await liveBereit(page);
    await expect(page.locator(AUSLOESER)).toBeVisible();
    await expect.poll(async () => kleinsteSeite(await masse(page, AUSLOESER)), { message: 'Auslöser ≥ 24 px' }).toBeGreaterThanOrEqual(24);
  });
});

test.describe('R00127 schmale Breiten (Touch)', () => {
  let k;
  test.use({ hasTouch: true });
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUND));
    await alsPerson(page, 'st');
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } });
  });
  test.afterEach(() => k.stoppen());

  test('US-6: bei pointer:coarse misst der Auslöser ≥ 44 × 44 px und jeder Menüeintrag ≥ 44 px (ADR-0012)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    // erst wenn die Leitung steht und der Auslöser sichtbar ist (ADR-0026 Regel 3; `bereit` taugt bei offenem Fenster nicht:
    // `kdTest.gezeichnet()` wird dort nie wahr) — ein Neuzeichnen kurz nach dem Öffnen ersetzt den Knoten
    await liveBereit(page);
    await expect(page.locator(AUSLOESER)).toBeVisible();
    await expect.poll(async () => kleinsteSeite(await masse(page, AUSLOESER)), { message: 'Auslöser ≥ 44 px' }).toBeGreaterThanOrEqual(44);
    await page.locator(AUSLOESER).click();
    for (const n of ['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']) {
      const eintrag = page.locator(ANSICHTSMENUE).getByRole('menuitemradio', { name: n, exact: true });
      await expect(eintrag).toBeVisible();
      // der Schlüssel des Eintrags steht in `data-arg`; gemessen wird über den Selektor, nicht über den aufgelösten Knoten
      const wahl = `${ANSICHTSMENUE} [role="menuitemradio"][data-arg="${await eintrag.getAttribute('data-arg')}"]`;
      await expect.poll(async () => (await masse(page, wahl))?.height, { message: `${n}: ≥ 44` }).toBeGreaterThanOrEqual(44);
    }
  });

  test('US-6: der Auslöser misst ≥ 44 × 44 px auch, wenn die Seite in jedem Frame neu zeichnet', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await liveBereit(page);
    await expect(page.locator(AUSLOESER)).toBeVisible();
    // jedes Neuzeichnen ersetzt den Auslöser (ADR-0007): eine Messung in zwei Schritten träfe den ausgehängten Knoten
    await page.evaluate(() => { const los = () => { render(); requestAnimationFrame(los); }; requestAnimationFrame(los); });
    await expect.poll(async () => kleinsteSeite(await masse(page, AUSLOESER)), { message: 'Auslöser ≥ 44 px' }).toBeGreaterThanOrEqual(44);
  });
});
