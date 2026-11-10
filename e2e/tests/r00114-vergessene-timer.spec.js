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
/** Stellt die Uhr sekundenweise vor, bis der Hinweis steht; liefert die Zahl der Sekunden, 0 wenn keiner kommt. */
async function bisHinweis(page, sekunden) {
  for (let s = 1; s <= sekunden; s++) {
    await page.clock.runFor(1000);
    await page.evaluate(() => window.kdTest.herzschlag());
    if (await page.locator('.toast').count()) return s;
  }
  return 0;
}
/** Uhr stellen und anhalten: erst dann steht die Laufzeit auf die Sekunde fest (`clock.install` läuft sonst weiter). */
const uhrStellen = async (page, zeit) => { await page.clock.install({ time: zeit }); await page.clock.pauseAt(zeit); };
/**
 * Stellt die Uhr um `ms` vor und hält die Live-Verbindung dabei frisch: der Server meldet sich real alle 15 s, der Wächter
 * gibt nach 40 s auf — mit gestellter Uhr käme sonst „Wieder verbunden“ statt der Erinnerung.
 */
async function uhrVor(page, ms) {
  for (let rest = ms; rest > 0; rest -= 30000) {
    await page.clock.runFor(Math.min(30000, rest));
    await page.evaluate(() => window.kdTest.herzschlag());
  }
}

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

/** Dieselbe Lage in Echtzeit — für Proben ohne gestellte Uhr. */
const STEFANS_VERGESSENER = { ...EIN_VERGESSENER, 'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', [`${vor(143 * 60 + 10)} · ... · st`]) };

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
  const commits = () => +k.git('rev-list', '--count', 'HEAD');
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

  test('US-6: der eigene vergessene Timer erinnert einmal, die Aktion öffnet genau den Eintrag', async ({ page }) => {
    const beginn = vor(143 * 60 + 10);
    const bestand = {
      'kanbanD.md': KOPF,
      'boards/entwicklung.md': BOARD,
      'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', [`${beginn} · ... · st`, `${vor(30)} · ... · cl`]),
      'aufgaben/0002-zwei.md': karte(2, 'zwei'),
      'aufgaben/0003-drei.md': karte(3, 'drei'),
      'aufgaben/0004-vier.md': karte(4, 'vier'),
    };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    const hinweis = page.locator('.toast');
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen');
    await expect(hinweis.locator('[data-act="zeit-korrigieren"]')).toHaveText('Zeit korrigieren');
    const vorher = commits();
    await hinweis.locator('[data-act="zeit-korrigieren"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator('.zt tr.edit')).toHaveCount(1);
    await expect(page.locator('#z-beginn')).toBeFocused();
    await expect(page.locator('#z-beginn')).toHaveValue(beginn);
    await page.locator('#z-beginn').fill('2026-11-08 08:00');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('2026-11-08 08:00');
    await expect(page.locator('.mod-fuss .gs')).toContainText('gespeichert');
    expect(commits(), 'genau ein Commit aus der Korrektur').toBe(vorher + 1);
  });

  test('US-7: ist der Eintrag inzwischen fort, öffnet die Aktion nur das Fenster und der Fuß sagt es', async ({ page }) => {
    const bestand = {
      'kanbanD.md': KOPF,
      'boards/entwicklung.md': BOARD,
      'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', [`${vor(143 * 60 + 10)} · ... · st`]),
      'aufgaben/0002-zwei.md': karte(2, 'zwei'),
      'aufgaben/0003-drei.md': karte(3, 'drei'),
      'aufgaben/0004-vier.md': karte(4, 'vier'),
    };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    const seitenfehler = [];
    page.on('pageerror', f => seitenfehler.push(f.message));
    await page.goto(k.adresse);
    const hinweis = page.locator('.toast');
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen');
    // ein Agent stoppt und löscht den Eintrag, während der Hinweis steht
    expect((await page.request.post(`${k.adresse}api/aufgaben/1/timer/stop`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { wer: 'st' } })).ok()).toBe(true);
    const kennung = encodeURIComponent(await page.evaluate(async () => (await (await fetch('/api/aufgaben/1')).json()).zeiten[0].kennung));
    expect((await page.request.delete(`${k.adresse}api/aufgaben/1/zeiten/${kennung}`, { headers: { 'X-KanbanD-Wer': 'cl' } })).ok()).toBe(true);
    const vorher = commits();
    await hinweis.locator('[data-act="zeit-korrigieren"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator('#z-beginn')).toHaveCount(0);
    await expect(page.locator('.mod-fuss .fehl')).toContainText('Der Zeiteintrag ist nicht mehr da.');
    expect(commits()).toBe(vorher);
    expect(seitenfehler).toEqual([]);
  });

  test('US-9: genau ein Hinweis je Übergang, nach dem Ablauf keiner mehr, Zusehen schreibt nichts (AK 10)', async ({ page }) => {
    const bestand = { ...EIN_VERGESSENER, 'aufgaben/0001-eins.md': karte(1, 'eins', 'bug', [`${vor(9 * 60 + 50)} · ... · st`]) };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await page.clock.install();
    await page.goto(k.adresse);
    const chip = page.locator('.ka[data-id="1"] .lauf');
    await expect(chip).not.toHaveClass(/vergessen/);
    const vorher = commits();
    await uhrVor(page, 9 * 60e3);
    await expect(chip, 'neun Minuten später noch unter der Schwelle').not.toHaveClass(/vergessen/);
    const hinweis = page.locator('.toast');
    expect(await bisHinweis(page, 120), 'der Übergang kommt').toBeGreaterThan(0);
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 10 Stunden');
    await uhrVor(page, 5000);
    await expect(hinweis, 'solange er steht, kein zweiter').toHaveCount(1);
    await uhrVor(page, 5000);
    await expect(hinweis, 'nach dem Ablauf kein neuer für denselben Timer').toHaveCount(0);
    expect(commits(), 'Zusehen schreibt nichts').toBe(vorher);
    // gestoppt und ein neuer Lauf über die Schwelle erinnert wieder genau einmal (FA 18)
    expect((await page.request.post(`${k.adresse}api/aufgaben/1/timer/stop`, { data: { wer: 'st' }, headers: { 'X-KanbanD-Wer': 'st' } })).ok()).toBe(true);
    expect((await page.request.post(`${k.adresse}api/aufgaben/1/timer/start`, { headers: { 'X-KanbanD-Wer': 'st' } })).ok()).toBe(true);
    await page.clock.setSystemTime(new Date(Date.now() + 10 * 3600e3 + 60e3));
    await page.evaluate(() => window.kdTest.herzschlag());
    expect(await bisHinweis(page, 120), 'der neue Lauf erinnert wieder').toBeGreaterThan(0);
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 10 Stunden');
  });

  test('US-9: im verborgenen Tab kein Hinweis, beim Sichtbarwerden genau einer, ein frischer Tab erinnert erneut', async ({ page, context }) => {
    k = await kanbanStarten(einrichten(EIN_VERGESSENER));
    await alsPerson(page, 'st');
    // headless führt Chromium jeden Tab als eigenes Fenster: die Sichtbarkeit stellt der Test
    await page.addInitScript(() => {
      let sichtbar = false;
      Object.defineProperty(document, 'visibilityState', { get: () => (sichtbar ? 'visible' : 'hidden'), configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => !sichtbar, configurable: true });
      window.kdTabZeigen = () => { sichtbar = true; document.dispatchEvent(new Event('visibilitychange')); };
    });
    await uhrStellen(page, uhr(23, 40, 0));
    await page.goto(k.adresse);
    // drei Sekunden im verborgenen Tab: ein Hinweis stünde dann noch, er darf gar nicht erst entstehen
    await uhrVor(page, 3000);
    await expect(page.locator('.ka[data-id="1"] .lauf.vergessen'), 'die Markierung entsteht auch im verborgenen Tab').toBeVisible();
    await expect(page.locator('.toast'), 'im verborgenen Tab kein Hinweis').toHaveCount(0);
    await page.evaluate(() => window.kdTabZeigen());
    await page.clock.runFor(1000);
    await expect(page.locator('.toast')).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen');
    // ein frisch geöffneter Tab erinnert denselben Stand erneut (gewollt, ADR-0019); die gestellte Uhr gilt auch ihm
    const frisch = await context.newPage();
    await alsPerson(frisch, 'st');
    await frisch.goto(k.adresse);
    await expect(frisch.locator('.ka[data-id="1"] .lauf.vergessen')).toBeVisible();
    await frisch.clock.runFor(1000);
    await expect(frisch.locator('.toast')).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen');
    await frisch.close();
  });

  test('US-3: ein fremder vergessener Timer wird markiert, aber nicht zur Korrektur angeboten', async ({ page, context }) => {
    const bestand = { ...EIN_VERGESSENER, 'aufgaben/0002-zwei.md': karte(2, 'zwei', 'bug', [`${vor(143 * 60 + 10)} · ... · cl`]) };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="2"] .lauf.vergessen')).toHaveText('seit 6 Tagen');
    const hinweis = page.locator('.toast');
    await expect(hinweis).toContainText('Timer von Claude zu #2 läuft seit 6 Tagen');
    await expect(hinweis.locator('[data-act="zeit-korrigieren"]'), 'fremde Zeit bietet keine Aktion').toHaveCount(0);
    // ohne gewählte Identität bleibt die Markierung, der Hinweis kommt ohne Knopf
    const ohne = await context.newPage();
    await ohne.goto(k.adresse);
    await expect(ohne.locator('.ka[data-id="2"] .lauf.vergessen')).toHaveText('seit 6 Tagen');
    await expect(ohne.locator('.toast').locator('[data-act="zeit-korrigieren"]')).toHaveCount(0);
    await expect(ohne.locator('#z-beginn')).toHaveCount(0);
    await ohne.close();
  });

  test('US-4: ohne gewählte Identität wird erinnert, aber nichts angeboten', async ({ page }) => {
    k = await kanbanStarten(einrichten(STEFANS_VERGESSENER));
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"] .lauf.vergessen')).toHaveText('seit 6 Tagen');
    const hinweis = page.locator('.toast');
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen — wähle „Ich bin …“');
    await expect(hinweis.locator('[data-act="zeit-korrigieren"]')).toHaveCount(0);
    await hinweis.locator('.txt').click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('#z-beginn')).toHaveCount(0);
  });

  test('US-5: die Identitätswahl holt die Erinnerung mit Aktion nach (M4)', async ({ page }) => {
    k = await kanbanStarten(einrichten(STEFANS_VERGESSENER));
    await page.clock.install();
    await page.goto(k.adresse);
    const hinweis = page.locator('.toast');
    await page.clock.runFor(1000);
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen — wähle „Ich bin …“');
    await expect(hinweis.locator('[data-act="zeit-korrigieren"]')).toHaveCount(0);
    await page.locator('#t-ich').click();
    await page.getByRole('menuitemradio', { name: /Stefan/ }).click();
    await page.clock.runFor(1000);
    await expect(page.locator('.toast'), 'ersetzt, nicht verdoppelt').toHaveCount(1);
    await expect(hinweis).toContainText('Timer von Stefan zu #1 läuft seit 6 Tagen');
    await expect(hinweis.locator('[data-act="zeit-korrigieren"]')).toBeVisible();
    await hinweis.locator('[data-act="zeit-korrigieren"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await expect(page.locator('#z-beginn')).toBeFocused();
    await page.clock.runFor(10000);
    await expect(page.locator('.toast'), 'kein zweiter Hinweis für denselben Timer').toHaveCount(0);
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
