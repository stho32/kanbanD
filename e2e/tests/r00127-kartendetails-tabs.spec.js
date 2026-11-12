// R00127 Kartendetails mit mehreren Reitern (Karte #104, I0115) — US-1..US-7 im echten Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

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

const REITER_OHNE_KOSTEN = ['Inhalt', 'Zeiten', 'Anhänge', 'Details', 'Datei', 'Verlauf'];
const REITER_MIT_KOSTEN = ['Inhalt', 'Zeiten', 'Anhänge', 'Details', 'Datei', 'Kosten', 'Verlauf'];

test.describe('R00127 Kartendetails mit mehreren Reitern', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  const leiste = page => page.getByRole('tablist', { name: 'Ansicht der Aufgabe' });
  async function reiter(page, name) { await leiste(page).getByRole('tab', { name }).click(); }

  /* ── US-1/US-5/US-7: Reiter, Reihenfolge, genau ein Panel ── */

  test('US-1: Reiterliste in Reihenfolge, Inhalt gewählt, genau ein tabpanel (M1)', async ({ page }) => {
    await oeffnen(page);
    await expect(leiste(page).getByRole('tab')).toHaveText(REITER_OHNE_KOSTEN);
    const inhalt = leiste(page).getByRole('tab', { name: 'Inhalt' });
    await expect(inhalt).toHaveAttribute('aria-selected', 'true');
    await expect(inhalt).toHaveAttribute('tabindex', '0');
    for (const n of REITER_OHNE_KOSTEN.slice(1)) await expect(leiste(page).getByRole('tab', { name: n })).toHaveAttribute('tabindex', '-1');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.locator('#reiterpanel-inhalt')).toHaveAttribute('role', 'tabpanel');
  });

  test('US-1/M1: nur der gewählte Reiter löst auf ein gezeichnetes Panel auf, die übrigen ohne Panel', async ({ page }) => {
    await oeffnen(page);
    const kontrolliert = async name => {
      const tab = leiste(page).getByRole('tab', { name });
      const id = await tab.getAttribute('aria-controls');
      await expect(page.locator('#' + id)).toHaveCount(1);
      await expect(page.locator('#' + id)).toHaveAttribute('role', 'tabpanel');
      expect(id).toBe('reiterpanel-' + ({ 'Inhalt': 'inhalt', 'Zeiten': 'zeiten', 'Anhänge': 'anhaenge', 'Details': 'details', 'Datei': 'datei', 'Kosten': 'kosten', 'Verlauf': 'verlauf' }[name]));
    };
    await kontrolliert('Inhalt');
    for (const n of REITER_OHNE_KOSTEN.slice(1)) {
      const id = await leiste(page).getByRole('tab', { name: n }).getAttribute('aria-controls');
      await expect(page.locator('#' + id)).toHaveCount(0);
    }
    await reiter(page, 'Details');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await kontrolliert('Details');
    const inhaltId = await leiste(page).getByRole('tab', { name: 'Inhalt' }).getAttribute('aria-controls');
    await expect(page.locator('#' + inhaltId)).toHaveCount(0);
  });

  test('US-1: mit Preisetikett steht „Kosten“ direkt hinter „Datei“', async ({ page }) => {
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } });
    await oeffnen(page);
    await expect(leiste(page).getByRole('tab')).toHaveText(REITER_MIT_KOSTEN);
    await reiter(page, 'Kosten');
    await expect(page.locator('#reiterpanel-kosten table')).toBeVisible();
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('US-5: → zweimal führt auf Anhänge, nur dieser Reiter hat tabindex 0; d wechselt Datei↔Inhalt', async ({ page }) => {
    await oeffnen(page);
    const inhalt = leiste(page).getByRole('tab', { name: 'Inhalt' });
    await inhalt.focus();
    await page.keyboard.press('ArrowRight');
    await expect(leiste(page).getByRole('tab', { name: 'Zeiten' })).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(leiste(page).getByRole('tab', { name: 'Anhänge' })).toBeFocused();
    await expect(leiste(page).getByRole('tab', { name: 'Anhänge' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reiterpanel-anhaenge')).toBeVisible();
    await page.keyboard.press('ArrowRight');
    await expect(leiste(page).getByRole('tab', { name: 'Details' })).toBeFocused();
    const tabindizes = () => leiste(page).getByRole('tab').evaluateAll(t => t.map(x => x.getAttribute('tabindex')));
    expect((await tabindizes()).filter(t => t === '0')).toHaveLength(1);
    await page.keyboard.press('d');
    await expect(leiste(page).getByRole('tab', { name: 'Datei' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('d');
    await expect(leiste(page).getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
  });

  test('US-5: Pos1 und Ende erreichen ersten und letzten Reiter', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    await page.keyboard.press('Home');
    await expect(leiste(page).getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(leiste(page).getByRole('tab', { name: 'Verlauf' })).toHaveAttribute('aria-selected', 'true');
  });

  test('US-7: gemerkter, unbekannter Reiter fällt generisch auf „Inhalt“ (S3)', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Details');
    // Ein künftiger Reiter, den die Liste heute nicht führt: die generische Bedingung tab ∉ reiterSchluessel(a)
    await page.evaluate(() => { S.ui.tab = 'kuenftig'; render(); });
    await expect(leiste(page).getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
    await expect(leiste(page).getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('tabindex', '0');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
    await expect(page.locator('#reiterpanel-inhalt')).toBeVisible();
  });

  test('US-7: Live-Ereignis nimmt das Etikett, der gemerkte Reiter „Kosten“ fällt auf „Inhalt“', async ({ page }) => {
    await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.63 } } });
    await oeffnen(page);
    await liveBereit(page);
    await reiter(page, 'Kosten');
    await leiste(page).getByRole('tab', { name: 'Kosten' }).focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: null } })).ok()).toBe(true);
    await expect(leiste(page).getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  /* ── US-1/B0586: „Inhalt“ bleibt schlank ── */

  test('US-1/S2: „Inhalt“ zeigt Titel, Beschreibung, Teilaufgaben, Kommentare, Durchläufe — sonst nichts', async ({ page }) => {
    await oeffnen(page);
    const inhalt = page.locator('#reiterpanel-inhalt');
    await expect(inhalt.locator('.titel')).toHaveText('Telemetrie der Agentenläufe bündeln');
    await expect(inhalt.locator('h3', { hasText: 'BESCHREIBUNG' })).toBeVisible();
    await expect(inhalt.locator('h3', { hasText: 'TEILAUFGABEN' })).toBeVisible();
    await expect(inhalt.locator('h3', { hasText: 'KOMMENTARE' })).toBeVisible();
    await expect(inhalt.locator('#durchlaeufe')).toBeVisible();
    await expect(inhalt.locator('.zt')).toHaveCount(0);
    await expect(inhalt.locator('h3', { hasText: 'LÄUFT GERADE' })).toHaveCount(0);
    await expect(inhalt.locator('#anhaenge')).toHaveCount(0);
    await expect(inhalt.locator('.felder')).toHaveCount(0);
    await expect(inhalt.getByLabel('Spalte')).toHaveCount(0);
    await expect(inhalt.getByLabel('Klasse')).toHaveCount(0);
  });

  /* ── US-2/B0583: Zeiten und Timer ── */

  test('US-2: „Zeiten“ zeigt Läuft gerade und die Zeiten-Tabelle; Stopp stoppt den Timer (ein Commit)', async ({ page }) => {
    const commitsVor = +k.git('rev-list', '--count', 'HEAD');
    await oeffnen(page);
    await expect(page.locator('#reiterpanel-inhalt .zt')).toHaveCount(0);
    await reiter(page, 'Zeiten');
    const zeiten = page.locator('#reiterpanel-zeiten');
    await expect(zeiten.locator('h3', { hasText: 'LÄUFT GERADE' })).toBeVisible();
    await expect(zeiten.getByLabel('Timer von Stefan stoppen')).toBeVisible();
    await expect(zeiten.locator('.zt')).toContainText('07:35–08:29');
    await expect(zeiten.locator('.zt tr')).toHaveCount(2);
    await zeiten.getByLabel('Timer von Stefan stoppen').click();
    await expect.poll(() => k.lies('aufgaben/0001-telemetrie.md')).not.toContain('10:11 · ... · st');
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(commitsVor + 1);
    await reiter(page, 'Inhalt');
    await expect(page.locator('#reiterpanel-inhalt .zt')).toHaveCount(0);
  });

  /* ── US-3/B0584: Anhänge ── */

  test('US-3: „Anhänge“ zeigt den Anhang mit Größe und ✕; Hochladen und Entfernen wie heute', async ({ page }) => {
    await oeffnen(page);
    const anhaenge = page.locator('#reiterpanel-anhaenge');
    await expect(page.locator('#reiterpanel-inhalt #anhaenge')).toHaveCount(0);
    await reiter(page, 'Anhänge');
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
    const details = page.locator('#reiterpanel-details');
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
    await page.locator('#reiterpanel-details').getByLabel('Spalte').selectOption('Fertig');
    await expect.poll(() => k.lies('boards/entwicklung.md')).toMatch(/## Fertig\n\n- \[#1\]/);
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(1, 'die Karte bleibt sichtbar (in der letzten Spalte)');
  });

  test('US-4: ohne gesetzten Schlüssel fehlt die Zeile „Schlüssel“', async ({ page }) => {
    await oeffnen(page, 2);
    await reiter(page, 'Details');
    await expect(page.locator('#reiterpanel-details .k', { hasText: /^Schlüssel$/ })).toHaveCount(0);
    await expect(page.locator('#schluessel')).toHaveCount(0);
    await expect(page.locator('#reiterpanel-details .felder')).toBeVisible();
  });

  test('US-4/Live: Änderung am Titel lässt Reiter „Details“ und den Fokus im Feld „Labels“ stehen', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await reiter(page, 'Details');
    const labels = page.locator('#reiterpanel-details').getByLabel('Labels');
    await labels.focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/1', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'Telemetrie gebündelt' } })).ok()).toBe(true);
    await expect(page.locator('#reiterpanel-details .titel, #reiterpanel-details [aria-label="Titel"]')).toHaveCount(0, 'Details zeichnet keinen Titel');
    await expect(leiste(page).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true', { timeout: 1000 });
    await expect(labels).toBeFocused();
  });

  /* ── Kein Abschnitt doppelt (Gegenbeispiel) ── */

  test('Gegenbeispiel: die Zeiten-Tabelle und die Felder stehen in keinem Reiter außer „Zeiten“ bzw. „Details“', async ({ page }) => {
    await oeffnen(page);
    for (const name of REITER_OHNE_KOSTEN) {
      await reiter(page, name);
      const panel = page.locator(`#reiterpanel-${{ 'Inhalt': 'inhalt', 'Zeiten': 'zeiten', 'Anhänge': 'anhaenge', 'Details': 'details', 'Datei': 'datei', 'Verlauf': 'verlauf' }[name]}`);
      if (name === 'Zeiten') { await expect(panel.locator('.zt')).toHaveCount(1); continue; }
      await expect(panel.locator('.zt')).toHaveCount(0, `keine Zeiten-Tabelle in „${name}“`);
      if (name === 'Details') { await expect(panel.locator('.felder')).toHaveCount(1); continue; }
      await expect(panel.locator('.felder')).toHaveCount(0, `keine Felder in „${name}“`);
    }
  });

  test('US-6: „Verlauf“ bleibt unverändert (Tabelle neueste oben); „Datei“ zeigt die Datei', async ({ page }) => {
    await oeffnen(page);
    await reiter(page, 'Datei');
    await expect(page.locator('#dateitext')).toContainText('title: Telemetrie');
    await reiter(page, 'Verlauf');
    await expect(page.locator('#reiterpanel-verlauf')).toBeVisible();
  });

  test('Kürzelhilfe nennt weiter „Reiter wechseln (Fokus auf einem Reiter)“', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster .mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe.locator('tr', { hasText: 'Reiter wechseln (Fokus auf einem Reiter)' })).toContainText('Reiter wechseln (Fokus auf einem Reiter)');
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

  test('US-6: bei 320/375/414 px bricht die Reiterleiste um, nichts scrollt quer, jeder Reiter ist bedienbar (hell und dunkel)', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    for (const breite of [320, 375, 414]) {
      for (const thema of ['light', 'dark']) {
        await page.setViewportSize({ width: breite, height: 700 });
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
        const kopf = await page.locator('#fenster .mod-kopf').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
        expect(kopf.sw, `${breite} px ${thema}: Kopf scrollt nicht quer`).toBeLessThanOrEqual(kopf.cw);
        const seite = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(seite.sw, `${breite} px ${thema}: die Seite scrollt nicht quer`).toBeLessThanOrEqual(seite.cw);
        for (const n of REITER_MIT_KOSTEN) {
          const tab = page.getByRole('tab', { name: n });
          const box = await tab.boundingBox();
          expect(box, `${breite} px ${thema}: Reiter „${n}“ hat eine Box`).toBeTruthy();
          expect(box.x, `${breite} px ${thema}: „${n}“ links im Bild`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${breite} px ${thema}: „${n}“ rechts im Bild`).toBeLessThanOrEqual(breite);
        }
        await page.getByRole('tab', { name: 'Details' }).click();
        await expect(page.locator('#reiterpanel-details')).toBeVisible();
        await page.getByRole('tab', { name: 'Inhalt' }).click();
        await expect(page.locator('#reiterpanel-inhalt')).toBeVisible();
      }
    }
  });

  test('US-6: bei feinem Zeiger misst jeder Reiter ≥ 24 × 24 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    for (const n of REITER_MIT_KOSTEN) {
      const tab = page.getByRole('tab', { name: n });
      await expect(tab).toBeVisible();
      await expect.poll(async () => { const b = await tab.boundingBox(); return b ? Math.round(Math.min(b.width, b.height)) : 0; }, { message: `${n}: ≥ 24 × 24` }).toBeGreaterThanOrEqual(24);
    }
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

  test('US-6: bei pointer:coarse misst jeder Reiter ≥ 44 × 44 px (ADR-0012)', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    for (const n of REITER_MIT_KOSTEN) {
      const tab = page.getByRole('tab', { name: n });
      await expect(tab).toBeVisible();
      await expect.poll(async () => { const b = await tab.boundingBox(); return b ? Math.round(Math.min(b.width, b.height)) : 0; }, { message: `${n}: ≥ 44 × 44` }).toBeGreaterThanOrEqual(44);
    }
  });
});
