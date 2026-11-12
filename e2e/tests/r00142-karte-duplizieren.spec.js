// R00142 Karte duplizieren aus dem Kartenmenü (I0130, F0114): Lage, Kopie, Hinweis mit rückgängig, Fehler, Fokus, Breiten
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'kanbanD.md': '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  feature: {label: Funktion, color: green}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: Kasse, wbs: "", requirements: ""}\n---\n',
  'boards/entwicklung.md': '# Entwicklung\n\n## Eingang\n\n## In Arbeit\n\n- [#1](../aufgaben/0001-rechnung-pruefen.md)\n\n## Fertig\n',
  'aufgaben/0001-rechnung-pruefen.md': '---\nid: 1\ntitle: Rechnung prüfen\nclass: feature\nassignees: [st]\nlabels: [doku]\ndue: 2026-11-20\norigins: [kd:I0005]\n---\nDie Rechnung gegen die Bestellung prüfen.\n- [x] Positionen vergleichen\n- [ ] Summe nachrechnen\n',
};

const hinweis = page => page.locator('.toast[role="status"]');
const kartenIn = (page, spalte) => page.locator(`.bahn[data-col="${spalte}"] .ka .id`);

test.describe('R00142', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(DATEIEN));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
  });
  test.afterEach(() => k.stoppen());

  test('US-9: „Duplizieren“ steht in eigener Gruppe nach „Auf Board legen“, vor „Verweis kopieren“ (#124)', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await expect(page.getByRole('menu', { name: '#1 Rechnung prüfen' })).toBeVisible();
    const folge = await page.locator('#kmenue > *').evaluateAll(es => es.filter(e => e.matches('.km-e, .km-tr')).map(e => e.matches('.km-tr') ? '|' : e.textContent.trim()));
    const stelle = text => folge.findIndex(t => t.startsWith(text));
    const [auf, dup, kopieren, archivieren] = ['Auf Board legen', 'Duplizieren', 'Verweis kopieren', 'Archivieren'].map(stelle);
    expect(dup).toBeGreaterThan(auf);
    expect(dup).toBeLessThan(kopieren);
    expect(kopieren).toBeLessThan(archivieren);
    // eigene Gruppe: je ein Trenner davor und danach, also auch einer zwischen „Duplizieren“ und „Archivieren“
    expect(folge[dup - 1]).toBe('|');
    expect(folge.slice(dup + 1, kopieren)).toContain('|');
    expect(folge.filter((t, i) => i > dup && i <= archivieren && t === '|').length).toBeGreaterThanOrEqual(1);
    // kein destruktiver Eintrag
    const eintrag = page.locator('#kmenue .km-e', { hasText: 'Duplizieren' });
    await expect(eintrag).not.toHaveClass(/km-warn/);
  });

  test('US-1: Kartenmenü „Duplizieren“ → #2 unten in derselben Spalte, Hinweis wörtlich, ein Commit (#124)', async ({ page }) => {
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.locator('#kmenue .km-e', { hasText: 'Duplizieren' }).click();
    await expect(kartenIn(page, 'In Arbeit')).toHaveText(['#1', '#2']);
    await expect(hinweis(page).locator('.txt')).toHaveText('#2 „Rechnung prüfen (Kopie)“ angelegt');
    expect(k.lies('aufgaben/0002-rechnung-pruefen-kopie.md')).toContain('title: Rechnung prüfen (Kopie)');
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher + 1);
    await expect(hinweis(page).locator('[data-act="rueckgaengig"]')).toBeVisible();
    // die Kopie trägt die Felder der Quelle, aber keinen Schlüssel
    const kopie = k.lies('aufgaben/0002-rechnung-pruefen-kopie.md');
    for (const zeile of ['class: feature', 'assignees: [st]', 'labels: [doku]', 'due: 2026-11-20', 'origins: [kd:I0005]', '- [ ] Positionen vergleichen', '- [ ] Summe nachrechnen']) {
      expect(kopie).toContain(zeile);
    }
    expect(kopie).not.toContain('key:');
  });

  test('US-7: „rückgängig“ archiviert die Kopie (#124)', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.locator('#kmenue .km-e', { hasText: 'Duplizieren' }).click();
    await expect(kartenIn(page, 'In Arbeit')).toHaveText(['#1', '#2']);
    await hinweis(page).locator('[data-act="rueckgaengig"]').click();
    await expect(kartenIn(page, 'In Arbeit')).toHaveText(['#1']);
    expect(k.lies('aufgaben/0002-rechnung-pruefen-kopie.md')).toContain('archived:');
  });

  test('US-7: Strg+Z archiviert die Kopie, solange der Hinweis steht (#124)', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.locator('#kmenue .km-e', { hasText: 'Duplizieren' }).click();
    await expect(kartenIn(page, 'In Arbeit')).toHaveText(['#1', '#2']);
    await page.keyboard.press('Control+z');
    await expect(kartenIn(page, 'In Arbeit')).toHaveText(['#1']);
    expect(k.lies('aufgaben/0002-rechnung-pruefen-kopie.md')).toContain('archived:');
  });

  test('US-8: Tastaturweg, Fehler als Live-Region role=status, nichts geändert (#124)', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Shift+F10');
    await expect(page.getByRole('menu', { name: '#1 Rechnung prüfen' })).toBeVisible();
    for (let i = 0; i < 30; i++) {
      if ((await page.locator('#kmenue .km-e.an').textContent()).startsWith('Duplizieren')) break;
      await page.keyboard.press('ArrowDown');
    }
    await expect(page.locator('#kmenue .km-e.an')).toContainText('Duplizieren');
    const vorher = +k.git('rev-list', '--count', 'HEAD');
    await page.route('**/api/aufgaben/1/duplizieren', route => route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ fehler: 'Grenze erreicht', spalte: 'In Arbeit', grenze: 1, anzahl: 1 }) }));
    await page.keyboard.press('Enter');
    await expect(hinweis(page)).toBeVisible();
    await expect(hinweis(page)).toContainText('Grenze erreicht');
    await expect(hinweis(page)).not.toContainText('angelegt');
    await expect(page.locator('.ka[data-id="2"]')).toHaveCount(0);
    expect(+k.git('rev-list', '--count', 'HEAD')).toBe(vorher);
    // Netzfehler: ebenso als Live-Region, keine Erfolgsmeldung
    await page.unroute('**/api/aufgaben/1/duplizieren');
    await page.route('**/api/aufgaben/1/duplizieren', route => route.abort());
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.locator('#kmenue .km-e', { hasText: 'Duplizieren' }).click();
    await expect(hinweis(page)).toBeVisible();
    await expect(hinweis(page)).toContainText('Keine Verbindung zum Server — nichts geändert.');
    await expect(hinweis(page)).not.toContainText('Failed to fetch');
    await expect(hinweis(page)).not.toContainText('angelegt');
    await expect(page.locator('.ka[data-id="2"]')).toHaveCount(0);
  });

  test('US-10: der Fokus steht nach dem Duplizieren auf der Quellkarte (#124)', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.locator('#kmenue .km-e', { hasText: 'Duplizieren' }).click();
    await expect(kartenIn(page, 'In Arbeit')).toHaveText(['#1', '#2']);
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(false);
  });
});

test.describe('R00142 schmale Breiten (#124)', () => {
  for (const breite of [320, 375, 414]) {
    test(`US-11: Eintrag und Hinweis ohne Querscrollen bei ${breite} px`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 700 });
      const k = await kanbanStarten(einrichten(DATEIEN));
      try {
        await alsPerson(page, 'st');
        await page.goto(k.adresse);
        await liveBereit(page);
        const ohneQuerscrollen = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        await page.locator('.ka[data-id="1"]').click({ button: 'right' });
        await expect(page.locator('#kmenue .km-e', { hasText: 'Duplizieren' })).toBeVisible();
        expect(await ohneQuerscrollen()).toBe(true);
        await page.locator('#kmenue .km-e', { hasText: 'Duplizieren' }).click();
        await expect(hinweis(page).locator('.txt')).toHaveText('#2 „Rechnung prüfen (Kopie)“ angelegt');
        expect(await ohneQuerscrollen()).toBe(true);
        const knopf = hinweis(page).locator('[data-act="rueckgaengig"]');
        await expect(knopf).toBeVisible();
        const [rechts, innen] = await knopf.evaluate(e => [e.getBoundingClientRect().right, innerWidth]);
        expect(rechts).toBeLessThanOrEqual(innen);
      } finally {
        await k.stoppen();
      }
    });
  }
});
