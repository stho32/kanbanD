// R00131 Langer Schlüssel bricht in der Seitenleiste um (Karte #46, ADR-0012/0015 N1/0019 N4) — Abnahme-Proben US-1 bis US-4.
// Der Fremdschlüssel steht als Textkind im Flex-Rahmen .felder .w (#schluessel); sein anonymes Flex-Element trägt die
// Mindestbreite des längsten Wortes. Ohne Umbruch wächst der Wert über die Grid-Spur, und .mod-side scrollt quer.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter } = require('./hilfen');
const { breiteMessen } = require('./ziele-hilfen');

const SCHLUESSEL = 'K'.repeat(200); // 200 Zeichen ohne Leerzeichen — ein einziges Wort
const TITEL_EINS = 'Volltextsuche über alle Boards und Aufgaben';

const KOPF = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
sources:
  wbs: ""
  requirements: ""
---
`;
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n';
const karte = (nr, titel, key) => `---\nid: ${nr}\ntitle: ${JSON.stringify(titel)}\n${key ? `key: ${key}\n` : ''}---\n`;

/** Grundbestand der User Story: Board „Entwicklung“, #1 mit dem 200-Zeichen-Schlüssel, #2 ohne. */
const GRUNDBESTAND = {
  'kanbanD.md': KOPF,
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': karte(1, TITEL_EINS, SCHLUESSEL),
  'aufgaben/0002-zwei.md': karte(2, 'Ölwechsel & <Prüfung>'),
};

/** Öffnet das Aufgabenfenster über die Tastatur: Karte fokussieren, Enter (Muster r00116). */
async function fensterOeffnen(page, nummer) {
  await page.locator(`.ka[data-id="${nummer}"]`).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#over [role="dialog"]')).toHaveCount(1);
}

/**
 * Der Schlüssel (`.felder .w#schluessel`) und der Rahmen: Anzahl Zeilen der Textzeilen (getClientRects),
 * ob jede Zeile im Rechteck der Feldtabelle bleibt (nichts abgeschnitten), Querscrollen von Wertspalte,
 * Seitenleiste, Fensterkörper und Seite.
 */
const wertMessen = page => page.evaluate(() => {
  const s = document.querySelector('#schluessel');
  if (!s) return null;
  const felder = s.closest('.felder');
  const side = s.closest('#reiterpanel-details');
  const koerper = s.closest('.mod-body');
  const range = document.createRange();
  range.selectNodeContents(s);
  const zeilen = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
  const rF = felder.getBoundingClientRect(), rSide = side.getBoundingClientRect();
  const textRechts = zeilen.length ? Math.max(...zeilen.map(r => r.right)) : 0;
  const st = getComputedStyle(s);
  return {
    text: s.textContent,
    laenge: s.textContent.length,
    zeilen: zeilen.length,
    wQuer: s.scrollWidth - s.clientWidth,
    sideQuer: side.scrollWidth - side.clientWidth,
    koerperQuer: koerper ? koerper.scrollWidth - koerper.clientWidth : 0,
    seiteQuer: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    imRahmen: zeilen.every(r => r.left >= rF.left - 0.5 && r.right <= rF.right + 0.5 && r.bottom <= rF.bottom + 0.5),
    rechtsImFelder: textRechts <= rF.right + 0.5,
    rechtsImSide: textRechts <= rSide.right + 0.5,
    abgeschnitten: st.textOverflow !== 'clip' || st.overflow !== 'visible' || st.whiteSpace === 'nowrap',
    schrift: st.fontSize,
  };
});

test.describe('R00131', () => {
  test.use({ viewport: { width: 1400, height: 800 } });
  let k;
  test.afterEach(() => k && k.stoppen());

  test('US-1: der Schlüssel bricht um, kein Querscrollen, Rechteck im Rahmen (AK 1, Karte #46 wörtlich)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.setViewportSize({ width: 1400, height: 800 });
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const m = await wertMessen(page);
    expect(m.laenge, 'der ganze Schlüssel steht im Wert (keine Kürzung)').toBe(200);
    expect(m.zeilen, '1400 px: der Schlüssel bricht über mehrere Zeilen um').toBeGreaterThan(1);
    expect(m.sideQuer, '1400 px: die Seitenleiste scrollt nicht quer').toBeLessThanOrEqual(1);
    expect(m.wQuer, '1400 px: die Wertspalte läuft nicht über').toBeLessThanOrEqual(1);
    expect(m.rechtsImFelder, '1400 px: die rechte Kante des Schlüssels liegt im .felder-Rahmen').toBe(true);
    expect(m.rechtsImSide, '1400 px: die rechte Kante des Schlüssels liegt im .mod-side-Rahmen').toBe(true);
    expect(m.imRahmen, '1400 px: jede Zeile des Schlüssels bleibt im Rechteck der Feldzeile').toBe(true);
    expect(m.abgeschnitten, '1400 px: kein Auslassungszeichen, nichts abgeschnitten').toBe(false);
    expect(await breiteMessen(page, 'US-1 1400'), '1400 px: kein Rahmen scrollt quer').toEqual([]);
  });

  test('US-2: der Grenzfall — ein Wort ohne Leerzeichen bricht innerhalb (AK 2)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.setViewportSize({ width: 1400, height: 800 });
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const m = await wertMessen(page);
    expect(m.text, 'der ganze Schlüssel steht, nichts mit Auslassungszeichen gekürzt').toBe(SCHLUESSEL);
    expect(m.zeilen, 'das eine Wort bricht an beliebiger Stelle in mehrere Zeilen').toBeGreaterThan(1);
    expect(m.imRahmen, 'das ganze Wort bleibt im Rechteck der Feldzeile').toBe(true);
    expect(m.abgeschnitten, 'nichts gekürzt, nichts abgeschnitten').toBe(false);
  });

  test('US-3: schmales Layout — 375 und 320 px ohne Querscrollen (AK 3)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    for (const [breite, hoehe] of [[375, 700], [320, 640]]) {
      await page.setViewportSize({ width: breite, height: hoehe });
      await page.locator('.ka[data-id="1"]').waitFor();
      await fensterOeffnen(page, 1);
      await reiter(page, 'Details');
      const m = await wertMessen(page);
      expect(m.laenge, `${breite} px: der ganze Schlüssel steht`).toBe(200);
      expect(m.seiteQuer, `${breite} px: die Seite scrollt nicht quer`).toBeLessThanOrEqual(1);
      expect(m.sideQuer, `${breite} px: die Seitenleiste scrollt nicht quer`).toBeLessThanOrEqual(1);
      expect(m.koerperQuer, `${breite} px: der Fensterkörper scrollt nicht quer`).toBeLessThanOrEqual(1);
      expect(m.imRahmen, `${breite} px: jede Zeile bleibt im Rechteck der Feldzeile`).toBe(true);
      expect(m.abgeschnitten, `${breite} px: nichts abgeschnitten`).toBe(false);
      expect(await breiteMessen(page, `US-3 ${breite}`), `${breite} px: kein Rahmen scrollt quer`).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
    }
  });

  test('US-4: leerer Schlüssel und Nachbarschaft unberührt (AK 4)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.setViewportSize({ width: 1400, height: 800 });
    // #1: Feldzeile „Schlüssel" mit dem Wert, .mono 12 px, der Pfad der Kopfzeile kürzt weiter mit Auslassungszeichen
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    await expect(page.locator('#reiterpanel-details .k', { hasText: /^Schlüssel$/ })).toHaveCount(1);
    const s = page.locator('#schluessel');
    await expect(s).toHaveClass(/mono/);
    expect(await s.evaluate(e => getComputedStyle(e).fontSize), 'der Schlüssel liest als .mono 12 px').toBe('12px');
    const pfad = await page.locator('.mod-kopf .pfad').evaluate(e => {
      const st = getComputedStyle(e);
      return { whiteSpace: st.whiteSpace, textOverflow: st.textOverflow };
    });
    expect(pfad, 'der Pfad der Kopfzeile kürzt weiter mit Auslassungszeichen').toEqual({ whiteSpace: 'nowrap', textOverflow: 'ellipsis' });
    await page.keyboard.press('Escape');
    await expect(page.locator('#over [role="dialog"]')).toHaveCount(0);
    // #2 ohne Schlüssel: die Feldzeile „Schlüssel" fehlt ganz
    await fensterOeffnen(page, 2);
    await reiter(page, 'Details');
    await expect(page.locator('#reiterpanel-details .felder')).toBeVisible();
    await expect(page.locator('#reiterpanel-details .k', { hasText: /^Schlüssel$/ })).toHaveCount(0);
    await expect(page.locator('#schluessel')).toHaveCount(0);
  });
});
