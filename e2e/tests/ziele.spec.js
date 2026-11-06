// R00108 Zielgrößen 24 px bei feinem Zeiger, 44 px bei Touch (ADR-0012 Regel 6): Messprobe über die Ansichten.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');

// Der Browser rechnet in Europe/Berlin (playwright.config.js) — die Fälligkeit ebenso.
const tag = n => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() + n * 864e5));
const ALS_ST = { headers: { 'X-KanbanD-Wer': 'st' } };

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'rot', { fertig: 'US-1' }),
]);
const einstellungen = arbeit => `---
people:
  st: {name: Stefan, kind: human}
  mi: {name: Mia, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
  feature: {label: Funktion, color: green}
signals:
  mail: {label: Neue E-Mail, color: blue}
sources:
  wbs: ""
  requirements: ""
  applications:
    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}
---
`;
const ZEIT = '```kanbanD-time\n2026-10-17 09:00 · 2026-10-17 11:00 · st\n```\n';
const grundbestand = arbeit => ({
  'kanbanD.md': einstellungen(arbeit),
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n\n## In Arbeit\n\n- [#3](../aufgaben/0003-drei.md)\n\n## Erledigt\n\n- [#4](../aufgaben/0004-vier.md)\n',
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nclass: bug\nassignees: [st]\ndue: ${tag(-1)}\n---\n- [x] a\n- [ ] b\n- [ ] c\n\n${ZEIT}`,
  'aufgaben/0001-eins/notiz.txt': 'Anhang',
  'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: zwei\nclass: feature\nassignees: [cl]\nsignals: [mail]\n---\n${ZEIT}`,
  'aufgaben/0002-zwei/protokoll.txt': 'Anhang',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\nassignees: [mi]\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\narchived: 2026-10-01\n---\n',
});

let k, arbeit;
const starten = async page => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(einrichten(grundbestand(arbeit)));
  expect((await page.request.post(`${k.adresse}api/aufgaben/3/timer/start`, ALS_ST)).ok()).toBe(true);
  await alsPerson(page, 'st');
};
test.afterEach(async () => {
  if (k) await k.stoppen();
  if (arbeit) arbeit.aufraeumen();
  k = null; arbeit = null;
});

/** Öffnet das Aufgabenfenster einer Karte des Boards. */
async function fensterOeffnen(page, nummer) {
  await page.goto(k.adresse + '#/board/entwicklung');
  await page.locator(`.ka[data-id="${nummer}"] .t`).click();
  await page.getByRole('dialog', { name: `Aufgabe #${nummer}` }).waitFor();
}

test.describe('Touch, 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('Löschknöpfe neben Teilaufgaben, Zeiten und Anhängen sind ohne Hover sichtbar', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
    const knoepfe = fenster.locator('.chk .x, .zt .btn-sym, .anh-z .x');
    await expect(knoepfe.first()).toBeAttached();
    const art = await knoepfe.evaluateAll(liste => liste.map(e => e.closest('.chk, .zt, .anh-z').className.split(' ')[0]));
    expect(new Set(art)).toEqual(new Set(['chk', 'zt', 'anh-z']));
    const deckkraft = await knoepfe.evaluateAll(liste => liste.map(e => getComputedStyle(e).opacity));
    expect(deckkraft.every(wert => wert === '1'), deckkraft.join(' ')).toBe(true);
  });
});

test.describe('Teilaufgabe auf der Karte: Text gehört zum Ziel', () => {
  test.describe('Touch', () => {
    test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

    test('Tipp auf den Text „b“ von #1 → Datei - [x] b, Karte zeigt „c“, kein Fenster', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      const eins = page.locator('.ka[data-id="1"]');
      await eins.locator('.naechste').getByText('b', { exact: true }).tap();
      await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
      await expect(eins.locator('.naechste')).toHaveText('c');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });

    test('Tipp auf den Titel von #1 öffnet weiterhin das Fenster', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await page.locator('.ka[data-id="1"] .t').tap();
      await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
      expect(k.lies('aufgaben/0001-eins.md')).toContain('- [ ] b');
    });
  });

  // Der Tipp oben bestand schon vor dem Umbau: Chromium lenkt einen Tipp auf ein nahes Ziel um (Touch Adjustment).
  // Der Mausklick auf denselben Text wird nicht umgelenkt und zeigt, ob der Text selbst zum Ziel gehört.
  test('Klick mit der Maus auf den Text „b“ von #1 → Datei - [x] b, Karte zeigt „c“, kein Fenster', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    const eins = page.locator('.ka[data-id="1"]');
    await eins.locator('.naechste').getByText('b', { exact: true }).click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
    await expect(eins.locator('.naechste')).toHaveText('c');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('ein Tab-Halt: Kästchen und Text sind ein Element role=checkbox, Schrift und Farbe wie der Kartentext', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    const naechste = page.locator('.ka[data-id="1"] .naechste');
    const halte = naechste.locator('button, a[href], input, select, [tabindex]:not([tabindex="-1"])');
    await expect(halte).toHaveCount(1);
    await expect(halte).toHaveAttribute('role', 'checkbox');
    await expect(halte).toHaveAttribute('aria-checked', 'false');
    await expect(halte).toHaveAccessibleName('b abhaken');
    await expect(halte).toHaveText('b');
    const stil = loc => loc.evaluate(e => { const s = getComputedStyle(e); return [s.fontFamily, s.fontSize, s.fontWeight, s.color, s.textAlign]; });
    const [ziel, umgebung] = await Promise.all([stil(halte), stil(naechste)]);
    expect(ziel).toEqual(umgebung.slice(0, 4).concat(['start']));
  });

  test('Leertaste hakt ab und setzt den Fokus auf die nächste offene Teilaufgabe, danach auf die Karte', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/board/entwicklung');
    await page.getByRole('checkbox', { name: 'b abhaken' }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('checkbox', { name: 'c abhaken' })).toBeFocused();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] b');
    await page.keyboard.press('Enter');
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('- [x] c');
  });
});

test.describe('Basisregel: Bedienelemente mindestens --kd-ziel', () => {
  test('Aufgabenliste mit Maus: der Titel-Link von #1, allein in seiner Zelle, mindestens 24 × 24', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    const box = await page.locator('td.tt a[data-arg="1"]').boundingBox();
    expect(box.width, 'Breite').toBeGreaterThanOrEqual(24);
    expect(box.height, 'Höhe').toBeGreaterThanOrEqual(24);
  });

  test('Einrichten mit Maus: jedes Farbfeld der offenen Palette mindestens 24 × 24', async ({ page }) => {
    await starten(page);
    await page.goto(k.adresse + '#/einrichten');
    await page.getByRole('button', { name: 'Farbe bug' }).click();
    const felder = await page.locator('.pal .g [role=button]').evaluateAll(l => l.map(e => e.getBoundingClientRect()).map(r => [r.width, r.height]));
    expect(felder.length).toBe(await page.locator('.pal .g [role=button]').count());
    expect(felder.filter(([b, h]) => b < 24 || h < 24)).toEqual([]);
  });

  test.describe('Touch, 320 px', () => {
    test.use({ viewport: { width: 320, height: 640 }, isMobile: true, hasTouch: true });

    test('die Palette bricht um: jedes Feld mindestens 44, keins ragt über den Rand, keins überlappt ein anderes', async ({ page }) => {
      await starten(page);
      await page.goto(k.adresse + '#/einrichten');
      await page.getByRole('button', { name: 'Farbe bug' }).tap();
      const felder = await page.locator('.pal .g [role=button]').evaluateAll(l => l.map(e => e.getBoundingClientRect().toJSON()));
      expect(felder.length).toBeGreaterThan(0);
      expect(felder.filter(r => r.width < 44 || r.height < 44).length, 'kleiner als 44').toBe(0);
      expect(felder.filter(r => r.right > 320).length, 'über den Rand').toBe(0);
      const ueberlappt = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
      expect(felder.filter((a, i) => felder.some((b, j) => i !== j && ueberlappt(a, b))).length, 'überlappend').toBe(0);
    });
  });
});

