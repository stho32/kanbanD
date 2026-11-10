// R00114 Vergessene Timer sichtbar machen (Karte #15) — Abnahme-Proben der Karte #15 in US-1 bis US-10.
// Die Markierung ist eine Aussage der Anzeige (ADR-0019): nichts wird geschrieben, nichts kommt aus der API.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, thema, kontrastAm, kontrastFarben } = require('./hilfen');

/* Die Datei kennt nur Minuten: `vor` legt einen Beginn in Ortszeit vor jetzt, wie die Fixtures der Nachbartests. */
const vor = minuten => {
  const d = new Date(Date.now() - minuten * 6e4), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
/** Eine Uhrzeit am festen Probentag — die Grenzproben stellen die Uhr des Browsers auf `page.clock`. */
const uhr = (h, m, s = 0) => new Date(2030, 0, 7, h, m, s);
/** Uhr stellen und anhalten: erst dann steht die Laufzeit auf die Sekunde fest (`clock.install` läuft sonst weiter). */
const uhrStellen = async (page, zeit) => { await page.clock.install({ time: zeit }); await page.clock.pauseAt(zeit); };

const KOPF = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
  mm: {name: Maximiliane Mustermann, kind: human}
classes:
  bug: {label: Fehler, color: red}
sources:
  wbs: ""
  requirements: ""
---
`;
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n## Erledigt\n';
const karte = (nr, titel, klasse, zeiten = []) => `---\nid: ${nr}\ntitle: ${titel}\n${klasse ? `class: ${klasse}\n` : ''}---\n${zeiten.length ? `\`\`\`kanbanD-time\n${zeiten.join('\n')}\n\`\`\`\n` : ''}`;

/** #1 Stefans laufender Eintrag seit 143:10:23 — dieselbe Lage wie auf der Karte #15. */
const EIN_VERGESSENER = {
  'kanbanD.md': KOPF,
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', ['2030-01-02 00:40 · ... · st']),
  'aufgaben/0002-zwei.md': karte(2, 'zwei'),
  'aufgaben/0003-drei.md': karte(3, 'drei'),
  'aufgaben/0004-vier.md': karte(4, 'vier'),
};

/** Vier Karten für die Breitenprobe: eigen, fremd, zwei eigene und fremde, zwei fremde. */
const BREITEN = {
  'kanbanD.md': KOPF,
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', ['2030-01-02 00:40 · ... · st']),
  'aufgaben/0002-zwei.md': karte(2, 'zwei', 'bug', ['2030-01-02 00:40 · ... · cl']),
  'aufgaben/0003-drei.md': karte(3, 'drei', 'bug', ['2030-01-02 00:40 · ... · st', '2030-01-06 23:50 · ... · cl']),
  'aufgaben/0004-vier.md': karte(4, 'vier', 'bug', ['2030-01-02 00:40 · ... · cl', '2030-01-06 23:50 · ... · mm']),
};

/** Maße einer Karte für die Breitenprobe (AK 12): Titelbreite, Chip im Kartenrechteck, Karte in der Spalte. */
const karteMessen = (page, nummer) => page.evaluate(nr => {
  const ka = document.querySelector(`.ka[data-id="${nr}"]`);
  ka.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const chip = ka.querySelector('.lauf'), titel = ka.querySelector('.t'), spalte = ka.closest('.flaeche');
  const r = el => el.getBoundingClientRect();
  return {
    titelBreite: Math.round(r(titel).width * 10) / 10,
    chipImKartenrechteck: r(chip).right <= r(ka).right + 0.5 && r(chip).bottom <= r(ka).bottom + 0.5,
    karteInDerSpalte: r(ka).right <= r(spalte).right + 0.5,
    spalteScrolltQuer: spalte.scrollWidth - spalte.clientWidth,
    ueberlapptTitel: r(chip).left < r(titel).right - 0.5 && r(chip).top < r(titel).bottom - 0.5,
    chipText: chip.textContent.trim(),
  };
}, nummer);

test.describe('R00114', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1: der vergessene eigene Timer trägt an der Karte Klasse und Satz statt der Zahl', async ({ page }) => {
    k = await kanbanStarten(einrichten(EIN_VERGESSENER));
    await alsPerson(page, 'st');
    await uhrStellen(page, uhr(23, 50, 23));
    await page.goto(k.adresse);
    const chip = page.locator('.ka[data-id="1"] .lauf.vergessen');
    await expect(chip).toHaveText('seit 6 Tagen');
    await expect(chip.locator('[data-since]')).toHaveAttribute('data-fmt', 'seit');
    const kopfzeile = await page.locator('.ka[data-id="1"] .r0').innerText();
    expect(kopfzeile, 'die Zahl weicht dem Satz').not.toContain('143:');
    expect(kopfzeile, 'kein Zähler-Präfix auf der Karte').not.toContain('2×');
  });

  test('US-1: der Name des Listeneintrags nennt „Timer läuft seit 6 Tagen“, der Chip ist kein Bedienelement', async ({ page }) => {
    k = await kanbanStarten(einrichten(EIN_VERGESSENER));
    await alsPerson(page, 'st');
    await uhrStellen(page, uhr(23, 50, 23));
    await page.goto(k.adresse);
    const eins = page.locator('.ka[data-id="1"]');
    await expect(page.getByRole('listitem', { name: /Timer läuft seit 6 Tagen/ })).toHaveCount(1);
    await expect(eins).toHaveAttribute('aria-label', '#1 eins, Fehler, Timer läuft seit 6 Tagen');
    await eins.locator('.t').click({ modifiers: ['ControlOrMeta'] });
    await expect(eins).toHaveAttribute('aria-label', '#1 eins, Fehler, Timer läuft seit 6 Tagen, ausgewählt');
    expect(await eins.locator('.lauf').evaluate(chip => [chip.tabIndex, chip.querySelectorAll('a, button, input, [tabindex]').length])).toEqual([-1, 0]);
    await page.locator('.ka[data-id="1"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    const korrigieren = page.getByRole('button', { name: 'Zeit 1 korrigieren' });
    await korrigieren.focus();
    await expect(korrigieren, 'der ✎-Knopf der Zeittabelle bleibt der Tastaturweg').toBeFocused();
  });

  test('US-1: der Titel bleibt lesbar, der Chip liegt im Kartenrechteck — 1280/414/320, ein und zwei Timer', async ({ page }) => {
    k = await kanbanStarten(einrichten(BREITEN));
    await alsPerson(page, 'st');
    await uhrStellen(page, uhr(23, 50, 23));
    await page.goto(k.adresse);
    await expect(page.locator('.ka')).toHaveCount(4);
    for (const [breite, hoehe] of [[1280, 800], [414, 844], [320, 640]]) {
      await page.setViewportSize({ width: breite, height: hoehe });
      for (const nummer of [1, 2, 3, 4]) {
        const m = await karteMessen(page, nummer);
        expect(m.chipText, `${breite} px, #${nummer}: vergessener Chip`).toBe('seit 6 Tagen');
        expect(m.titelBreite, `${breite} px, #${nummer}: Titelbreite`).toBeGreaterThanOrEqual(90);
        expect(m.chipImKartenrechteck, `${breite} px, #${nummer}: Chip im Kartenrechteck`).toBe(true);
        expect(m.karteInDerSpalte, `${breite} px, #${nummer}: Karte in der Spalte`).toBe(true);
        expect(m.spalteScrolltQuer, `${breite} px, #${nummer}: Spalte scrollt quer`).toBeLessThanOrEqual(0);
        expect(m.ueberlapptTitel, `${breite} px, #${nummer}: Chip überlappt den Titel`).toBe(false);
      }
    }
  });

  test('US-1: Schrift und Punkt des vergessenen Chips halten das Maß in Hell und in Dunkel (AK 15)', async ({ page }) => {
    k = await kanbanStarten(einrichten(EIN_VERGESSENER));
    await alsPerson(page, 'st');
    await uhrStellen(page, uhr(23, 50, 23));
    await page.goto(k.adresse);
    const chip = page.locator('.ka[data-id="1"] .lauf.vergessen');
    await expect(chip).toHaveText('seit 6 Tagen');
    for (const theme of ['light', 'dark']) {
      await thema(page, theme);
      expect(await kontrastAm(chip), `${theme}: Schrift`).toBeGreaterThanOrEqual(4.5);
      const [punkt, flaeche] = await chip.evaluate(e => [getComputedStyle(e, '::before').backgroundColor, getComputedStyle(e).backgroundColor]);
      expect(await kontrastFarben(page, punkt, flaeche), `${theme}: Punkt`).toBeGreaterThanOrEqual(3);
    }
  });

  test('US-2: bei 9:59:59 nichts, nach einer Sekunde Klasse und Satz, genau ein Neuzeichnen', async ({ page }) => {
    test.fail(true, '#15: die Kante im Sekundentakt fehlt noch');
    const bestand = { ...EIN_VERGESSENER, 'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', ['2030-01-07 02:00 · ... · st']) };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await uhrStellen(page, uhr(11, 59, 59));
    await page.goto(k.adresse);
    const chip = page.locator('.ka[data-id="1"] .lauf');
    await expect(chip, 'unter der Schwelle die laufende Zahl wie heute').toHaveText('9:59:59');
    await expect(chip).not.toHaveClass(/vergessen/);
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('aria-label', '#1 eins, Fehler');
    const vorher = await page.evaluate(() => window.kdTest.renders());
    await page.clock.runFor(1000);
    await expect(chip).toHaveText('seit 10 Stunden');
    await expect(chip).toHaveClass(/vergessen/);
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('aria-label', '#1 eins, Fehler, Timer läuft seit 10 Stunden');
    expect(await page.evaluate(() => window.kdTest.renders()), 'ein Neuzeichnen an der Kante').toBe(vorher + 1);
    await page.clock.runFor(5000);
    await expect(chip).toHaveText('seit 10 Stunden');
    expect(await page.evaluate(() => window.kdTest.renders()), 'kein Neuzeichnen je Sekunde').toBe(vorher + 1);
  });

  test('US-2: die Dauer im Wort an der Karte — 25 h, 47:59, 30 Tage', async ({ page }) => {
    const bestand = {
      'kanbanD.md': KOPF,
      'boards/entwicklung.md': BOARD,
      'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', [`${vor(25 * 60 + 1)} · ... · st`]),
      'aufgaben/0002-zwei.md': karte(2, 'zwei', 'bug', [`${vor(47 * 60 + 59)} · ... · st`]),
      'aufgaben/0003-drei.md': karte(3, 'drei', 'bug', [`${vor(30 * 24 * 60 + 60)} · ... · st`]),
      'aufgaben/0004-vier.md': karte(4, 'vier', 'bug', [`${vor(48 * 60 + 1)} · ... · st`]),
    };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"] .lauf.vergessen')).toHaveText('seit 1 Tag');
    await expect(page.locator('.ka[data-id="2"] .lauf.vergessen')).toHaveText('seit 47 Stunden');
    await expect(page.locator('.ka[data-id="3"] .lauf.vergessen')).toHaveText('seit 30 Tagen');
    await expect(page.locator('.ka[data-id="4"] .lauf.vergessen')).toHaveText('seit 2 Tagen');
  });

  test('US-2: der Tageswechsel ändert den Satz ohne Neuzeichnen', async ({ page }) => {
    // 6,5 Tage minus 20 s: nach 30 s rundet die Dauer auf sieben Tage
    const bestand = { ...EIN_VERGESSENER, 'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', ['2030-01-01 00:00 · ... · st']) };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await uhrStellen(page, new Date(2030, 0, 7, 11, 59, 40));
    await page.goto(k.adresse);
    const chip = page.locator('.ka[data-id="1"] .lauf.vergessen');
    await expect(chip).toHaveText('seit 6 Tagen');
    await page.clock.runFor(10000);
    const vorher = await page.evaluate(() => window.kdTest.renders());
    await page.clock.runFor(20000);
    await expect(chip).toHaveText('seit 7 Tagen');
    expect(await page.evaluate(() => window.kdTest.renders()), 'kein Neuzeichnen am Tageswechsel').toBe(vorher);
  });
});
