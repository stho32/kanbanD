// R00144 Aufgabenfenster-Kopf: Aktionen im Menü, Endgültig löschen nur im Menü, Blättern entfällt (Karte #144, I0131).
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
assignees: [st]
---
Eine Beschreibung.

- [ ] Zeile beim Start schreiben
`;

const AUFGABE_2 = '---\nid: 2\ntitle: zwei\n---\nZweite Aufgabe\n';

const GRUND = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Fabrik\n\n## Eingang\n\n- [#1]\n- #2\n\n## In Arbeit\n\n## Fertig\n\n',
  'aufgaben/0001-telemetrie.md': AUFGABE_1,
  'aufgaben/0002-zwei.md': AUFGABE_2,
};

const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
const AKTIONEN = '#fenster [data-act="fenster-menue"][data-arg="aktionen"]';
const MENUE = '#fenster [role="menu"]';
const SCHLIESSEN = '#fenster [data-act="schliessen"]';

test.describe('R00144 Kopf und Aktionsmenü', () => {
  let k;
  test.beforeEach(async ({ page }) => { await mutanteEinsetzen(page); k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page, nr = 1) {
    await page.goto(k.adresse);
    await page.locator(`.ka[data-id="${nr}"] .id`).click();
    await expect(page.getByRole('dialog', { name: `Aufgabe #${nr}` })).toBeVisible();
  }
  async function menueOeffnen(page) { await page.locator(AKTIONEN).click(); await page.locator(MENUE).waitFor(); }

  /* ── US-1: Kopf mit vier Zielen, kein Blättern, kein beschrifteter Lösch-Auslöser ── */

  test('US-1: Kopf rechts Ansicht, ↗, ⋮, ✕ — 8 px Lücken, kein Trenner, kein Zähler, kein ↑ ↓', async ({ page }) => {
    await oeffnen(page);
    const rechts = page.locator('#fenster .mod-kopf .rechts');
    const kinder = await rechts.evaluate(el => [...el.children].map(e => e.id === 'vsc' ? 'vsc' : e.matches('[data-act="schliessen"]') ? 'schliessen' : e.querySelector('[data-act="fenster-menue"][data-arg="ansicht"]') ? 'ansicht' : e.querySelector('[data-act="fenster-menue"][data-arg="aktionen"]') ? 'aktionen' : e.className));
    expect(kinder).toEqual(['ansicht', 'vsc', 'aktionen', 'schliessen']);
    const luecken = await rechts.evaluate(el => getComputedStyle(el).columnGap);
    expect(luecken).toBe('8px');
    await expect(page.locator('#fenster .mod-kopf .el-trenner')).toHaveCount(0);
    await expect(page.locator('#fenster .mod-kopf .nav')).toHaveCount(0);
    await expect(page.locator('#fenster .mod-kopf [data-act="blaettern"]')).toHaveCount(0);
    await expect(page.locator('#fenster .mod-kopf .el-ausloeser')).toHaveCount(0);
    await expect(page.locator('#fenster .mod-kopf')).not.toContainText('Endgültig löschen');
    await expect(page.locator('#fenster .mod-kopf')).not.toContainText('Archivieren');
    // der ⋮-Auslöser
    const drei = page.locator(AKTIONEN);
    await expect(drei).toHaveAttribute('aria-haspopup', 'menu');
    await expect(drei).toHaveAttribute('aria-expanded', 'false');
    await expect(drei).toHaveAttribute('aria-label', 'Weitere Aktionen für Aufgabe #1');
    await expect(drei).toHaveAttribute('title', 'Weitere Aktionen');
    await expect(drei).not.toContainText(/\S/);
    // Ziele in max(--kd-row, --kd-ziel)
    for (const sel of [AUSLOESER, AKTIONEN, SCHLIESSEN]) {
      const b = await page.locator(sel).boundingBox();
      const m = await page.evaluate(() => {
        const px = w => parseFloat(w) || 0;
        const s = getComputedStyle(document.documentElement);
        return Math.max(px(s.getPropertyValue('--kd-row')), px(s.getPropertyValue('--kd-ziel')));
      });
      expect(Math.min(b.height, b.width), `${sel}: Zielgröße`).toBeGreaterThanOrEqual(Math.min(m, 24) - 0.5);
    }
  });

  test('US-1: der frei gewordene Platz gehört dem Pfad, der Fuß nennt nur „Esc schließen“', async ({ page }) => {
    await oeffnen(page);
    const fuss = page.locator('#fenster .mod-fuss');
    await expect(fuss).toContainText('Esc');
    await expect(fuss).toContainText('schließen');
    await expect(fuss).not.toContainText('Karte wechseln');
    await expect(fuss.locator('kbd')).toHaveCount(1);
    const pfad = await page.locator('#fenster .mod-kopf .pfad').boundingBox();
    const gruppe = await page.locator('#fenster .mod-kopf .rechts').boundingBox();
    expect(Math.abs((pfad.x + pfad.width) - gruppe.x)).toBeLessThanOrEqual(9);
  });

  /* ── US-2: das ⋮-Menü ── */

  test('US-2: Menü mit genau zwei Einträgen, Ikonspalte, genau ein Trenner, kein Titel, Startfokus „Archivieren“', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    const menue = page.locator(MENUE);
    await expect(menue).toHaveAttribute('aria-label', 'Weitere Aktionen für Aufgabe #1');
    const eintraege = menue.getByRole('menuitem');
    await expect(eintraege).toHaveText(['Archivieren', 'Endgültig löschen']);
    await expect(menue.locator('[role="separator"]')).toHaveCount(1);
    // der Trenner steht zwischen den beiden Einträgen, nicht davor
    const reihenfolge = await menue.evaluate(el => [...el.children].map(e => e.getAttribute('role') || e.className));
    expect(reihenfolge[0]).toBe('menuitem');
    expect(reihenfolge.filter(r => r === 'separator')).toHaveLength(1);
    expect(reihenfolge.indexOf('separator')).toBe(1);
    expect(await eintraege.last().getAttribute('class')).toContain('warn');
    await expect(menue.locator('.km-titel, h1, h2, h3, h4, h5, h6')).toHaveCount(0);
    await expect(menue.locator('kbd, .km-k')).toHaveCount(0);
    // Ikonspalte 16 px, danach 8 px; alle Texte an derselben Kante
    const kanten = await eintraege.evaluateAll(alle => alle.map(e => ({ ikon: e.querySelector('.fm-ikon').getBoundingClientRect().width, text: e.querySelector('.fm-text').getBoundingClientRect().x })));
    for (const k of kanten) expect(Math.round(k.ikon)).toBe(16);
    expect(Math.abs(kanten[0].text - kanten[1].text)).toBeLessThanOrEqual(1);
    await expect(eintraege.first()).toBeFocused();
    await expect(page.locator(AKTIONEN)).toHaveAttribute('aria-expanded', 'true');
    const hoehe = await eintraege.first().evaluate(e => e.getBoundingClientRect().height);
    expect(Math.round(hoehe)).toBeGreaterThanOrEqual(28);
  });

  test('US-2: Kontrast des fokussierten Gefahreintrags ≥ 4,5:1 in Hell und Dunkel; Text auf der Akzentfläche', async ({ page }) => {
    await oeffnen(page);
    for (const name of ['light', 'dark']) {
      await thema(page, name);
      await menueOeffnen(page);
      const gefahr = page.locator(`${MENUE} [role="menuitem"]`, { hasText: 'Endgültig löschen' });
      await gefahr.focus();
      const farben = await gefahr.evaluate(e => ({ hintergrund: getComputedStyle(e).backgroundColor, text: getComputedStyle(e).color }));
      const akzent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kd-accent').trim());
      expect(farben.hintergrund, `${name}: fokussierter Eintrag steht auf der Akzentfläche`).not.toBe('rgba(0, 0, 0, 0)');
      expect(farben.hintergrund, `${name}: Fläche ist die Akzentfläche (${akzent})`).toBe(await page.evaluate(a => { const p = document.createElement('div'); p.style.background = a; document.body.append(p); const f = getComputedStyle(p).backgroundColor; p.remove(); return f; }, akzent));
      const wert = await kontrastAm(gefahr);
      expect(wert, `${name}: Kontrast ${wert.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      await page.keyboard.press('Escape');
    }
  });

  test('US-3: ⋮ öffnet und schließt (zweiter Klick), aria-expanded folgt, nichts geschrieben', async ({ page }) => {
    const commitsVor = +k.git('rev-list', '--count', 'HEAD');
    await oeffnen(page);
    await menueOeffnen(page);
    await page.locator(AKTIONEN).click();
    await expect(page.locator(MENUE)).toHaveCount(0);
    await expect(page.locator(AKTIONEN)).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(commitsVor);
  });

  test('US-3: „Archivieren“ nimmt #1 vom Board (ein Commit), Menü zu, Fokus am ⋮ (Fenster bleibt mit Archivleiste)', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await page.locator(MENUE).getByRole('menuitem', { name: 'Archivieren' }).click();
    await expect(page.locator(MENUE)).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(0);
    expect(k.git('log', '-1', '--pretty=%s')).toBe('#1 archiviert');
    // R00144 AK: der Fokus steht wieder am ⋮, das Fenster zeigt die Archivleiste; nie BODY
    await expect(page.locator('#fenster .archbar')).toContainText('Archiviert am');
    await expect(page.locator(AKTIONEN)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });

  test('US-3: archivierte Aufgabe — „Zurückholen“ mit Symbol, holt zurück (ein Commit); Archivleiste gleich benannt', async ({ page }) => {
    await page.request.post(k.adresse + 'api/aufgaben/1/archivieren', { headers: { 'X-KanbanD-Wer': 'st' } });
    await page.goto(k.adresse);
    await page.locator('[data-act="archiv-an"]').click();
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await menueOeffnen(page);
    const zurueck = page.locator(MENUE).getByRole('menuitem', { name: 'Zurückholen' });
    await expect(zurueck).toHaveCount(1);
    await expect(zurueck.locator('.fm-ikon svg')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('#fenster .archbar .lnk')).toHaveText('Zurückholen');
    await menueOeffnen(page);
    await page.locator(MENUE).getByRole('menuitem', { name: 'Zurückholen' }).click();
    await expect.poll(() => k.git('log', '-1', '--pretty=%s')).toBe('#1 zurückgeholt');
    await expect.poll(() => k.lies('aufgaben/0001-telemetrie.md')).not.toContain('archived:');
    await expect(page.locator(AKTIONEN)).toBeFocused();
  });

  test('US-5: „Endgültig löschen“ öffnet die Rückfrage; Abbrechen gibt den Fokus an den ⋮-Auslöser', async ({ page }) => {
    await oeffnen(page);
    const commitsVor = +k.git('rev-list', '--count', 'HEAD');
    await menueOeffnen(page);
    await page.locator(MENUE).getByRole('menuitem', { name: 'Endgültig löschen' }).click();
    await expect(page.locator(MENUE)).toHaveCount(0);
    const frage = page.getByRole('alertdialog', { name: /#1 Telemetrie der Agentenläufe bündeln endgültig löschen/ });
    await expect(frage).toBeVisible();
    await expect(frage).toHaveAttribute('aria-modal', 'true');
    await expect(frage.getByRole('button')).toHaveCount(2);
    await expect(frage.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await frage.getByRole('button', { name: 'Abbrechen' }).click();
    await expect(frage).toHaveCount(0);
    await expect(page.locator(AKTIONEN)).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(commitsVor);
  });

  test('US-5: Bestätigen löscht #1 (ein Commit), das Fenster schließt, Fokus nicht auf BODY', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await page.locator(MENUE).getByRole('menuitem', { name: 'Endgültig löschen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'endgültig löschen' }).click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(0);
    expect(k.git('log', '-1', '--pretty=%s')).toBe('#1 gelöscht');
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });

  /* ── Blättern entfällt ── */

  test('US-6: ↑ und ↓ wechseln die Aufgabe nicht mehr; eine andere Aufgabe öffnet nur ein Klick', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster .mod-kopf .pfad').click();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await page.keyboard.press('ArrowUp');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.locator('.ka[data-id="2"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
  });

  test('US-6: Kürzelhilfe ohne „↑ ↓“ und ohne „← →“; der Fuß nennt nur Esc', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster .mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe).not.toContainText('vorige / nächste Karte');
    await expect(hilfe).not.toContainText('Reiter wechseln');
    await expect(hilfe).not.toContainText('↑');
    await expect(hilfe).not.toContainText('←');
    await expect(page.locator('#fenster .mod-fuss')).not.toContainText('Karte wechseln');
  });

  /* ── Tastatur, Fokus, Live ── */

  test('Tastatur: ↓/↑/Pos1/Ende im Menü, Esc schließt nur das Menü, zweites Esc das Fenster', async ({ page }) => {
    await oeffnen(page);
    await menueOeffnen(page);
    await expect(page.locator(MENUE).getByRole('menuitem', { name: 'Archivieren' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(MENUE).getByRole('menuitem', { name: 'Endgültig löschen' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(page.locator(MENUE).getByRole('menuitem', { name: 'Archivieren' })).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.locator(MENUE).getByRole('menuitem', { name: 'Endgültig löschen' })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator(MENUE).getByRole('menuitem', { name: 'Archivieren' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator(MENUE)).toHaveCount(0);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator(AKTIONEN)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toHaveCount(0);
  });

  test('Kürzel-Sperre: a, t und d wirken im offenen Menü nicht', async ({ page }) => {
    await oeffnen(page);
    const commitsVor = +k.git('rev-list', '--count', 'HEAD');
    await menueOeffnen(page);
    await page.keyboard.press('a');
    await page.keyboard.press('t');
    await page.keyboard.press('d');
    await expect(page.locator(MENUE)).toHaveCount(1);
    await expect.poll(() => +k.git('rev-list', '--count', 'HEAD')).toBe(commitsVor);
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
  });

  test('Live: offenes Menü bleibt offen, Fokus bleibt auf demselben Eintrag, Einträge folgen dem Stand', async ({ page }) => {
    await oeffnen(page);
    await liveBereit(page);
    await menueOeffnen(page);
    const gefahr = page.locator(MENUE).getByRole('menuitem', { name: 'Endgültig löschen' });
    await gefahr.focus();
    expect((await page.request.patch(k.adresse + 'api/aufgaben/2', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'zwei neu' } })).ok()).toBe(true);
    await expect(page.locator(MENUE)).toHaveCount(1, { timeout: 1000 });
    await expect(gefahr).toBeFocused();
  });
});

/* ── Schmale Breiten: einzeilig, drei Ziele, Menü im Bild ── */

test.describe('R00144 schmale Breiten', () => {
  let k;
  test.beforeEach(async ({ page }) => { await mutanteEinsetzen(page); k = await kanbanStarten(einrichten(GRUND)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

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
        oberkanten: Object.values(ziele).map(e => e.getBoundingClientRect().top),
        kopfQuer: { sw: kopf.scrollWidth, cw: kopf.clientWidth },
        seiteQuer: { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth },
      };
    });
  }

  test('US-7: 320/375/414 px hell und dunkel einzeilig, drei Ziele gleiche Oberkante, ↗ versteckt', async ({ page }) => {
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
        expect(Math.max(...m.oberkanten) - Math.min(...m.oberkanten), `${breite} px ${name}: gleiche Oberkante (±1)`).toBeLessThanOrEqual(1);
        expect(m.kopfQuer.sw).toBeLessThanOrEqual(m.kopfQuer.cw);
        expect(m.seiteQuer.sw).toBeLessThanOrEqual(m.seiteQuer.cw);
        await expect(page.locator('#fenster #vsc')).toBeHidden();
        for (const sel of [AUSLOESER, AKTIONEN, SCHLIESSEN]) {
          const b = await page.locator(sel).boundingBox();
          expect(b.x, `${breite} px ${name}: ${sel} links im Bild`).toBeGreaterThanOrEqual(0);
          expect(b.x + b.width, `${breite} px ${name}: ${sel} rechts im Bild`).toBeLessThanOrEqual(breite);
        }
      }
    }
  });

  test('US-7: das Menü liegt ganz im Bild und „Endgültig löschen“ bricht nicht ab; kein Querscrollen', async ({ page }) => {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    for (const breite of [320, 375, 414]) {
      await page.setViewportSize({ width: breite, height: 700 });
      await page.locator(AKTIONEN).click();
      const box = await page.locator(MENUE).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(breite);
      expect(box.y + box.height).toBeLessThanOrEqual(700);
      const gefahr = page.locator(`${MENUE} [role="menuitem"]`, { hasText: 'Endgültig löschen' });
      const text = await gefahr.evaluate(e => ({ sw: e.scrollWidth, cw: e.clientWidth, text: e.innerText }));
      expect(text.text).toBe('Endgültig löschen');
      expect(text.sw).toBeLessThanOrEqual(text.cw);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => document.documentElement.clientWidth));
      await page.keyboard.press('Escape');
    }
  });

  test('US-7: ab 641 px ist ↗ sichtbar', async ({ page }) => {
    await page.setViewportSize({ width: 641, height: 800 });
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"] .id').click();
    await expect(page.locator('#fenster #vsc')).toBeVisible();
  });
});
