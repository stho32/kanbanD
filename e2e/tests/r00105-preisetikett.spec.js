// R00105 Preisetikett je Aufgabe — Reiterleiste des Aufgabenfensters per Tastatur (US-15, F0043)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Eingang\n\n- #4\n\n## In Arbeit\n\n## Fertig\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\nOhne Preisetikett\n',
};

test.describe('R00105', () => {
  let k;
  test.beforeEach(async ({ page }) => { k = await kanbanStarten(einrichten(DATEIEN)); await alsPerson(page, 'st'); });
  test.afterEach(() => k.stoppen());

  async function oeffnen(page) {
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="4"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #4' })).toBeVisible();
  }

  test('Nacharbeit M1: n auf einer Karte öffnet „Neue Aufgabe“ ohne Fehler — der Reiter Kosten gehört nur ins Aufgabenfenster', async ({ page }) => {
    const fehler = [];
    page.on('pageerror', e => fehler.push(e.message));
    await page.goto(k.adresse);
    await liveBereit(page);
    await page.locator('.ka[data-id="4"]').focus();
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeVisible();
    await expect(page.getByLabel('Titel der neuen Aufgabe')).toBeVisible();
    expect(fehler).toEqual([]);
  });

  test('US-15: Reiterleiste ist eine tablist mit roving tabindex', async ({ page }) => {
    await oeffnen(page);
    const leiste = page.getByRole('tablist', { name: 'Ansicht der Aufgabe' });
    await expect(leiste.getByRole('tab')).toHaveCount(2);
    const inhalt = leiste.getByRole('tab', { name: 'Inhalt' }), datei = leiste.getByRole('tab', { name: 'Datei' });
    await expect(inhalt).toHaveAttribute('aria-selected', 'true');
    await expect(datei).toHaveAttribute('aria-selected', 'false');
    await expect(inhalt).toHaveAttribute('tabindex', '0');
    await expect(datei).toHaveAttribute('tabindex', '-1');
    const panel = await inhalt.getAttribute('aria-controls');
    await expect(page.locator(`#${panel}`)).toHaveAttribute('role', 'tabpanel');
    await expect(page.getByRole('tabpanel')).toHaveCount(1);
  });

  test('US-15: Pfeile, Pos1, Ende, Enter und Leertaste auf den Reitern', async ({ page }) => {
    await oeffnen(page);
    const inhalt = page.getByRole('tab', { name: 'Inhalt' }), datei = page.getByRole('tab', { name: 'Datei' });
    await inhalt.focus();
    await page.keyboard.press('ArrowRight');
    await expect(datei).toBeFocused();
    await expect(datei).toHaveAttribute('aria-selected', 'true');
    await expect(datei).toHaveAttribute('tabindex', '0');
    await expect(inhalt).toHaveAttribute('tabindex', '-1');
    await expect(page.locator('#dateitext')).toContainText('title: vier');
    await page.keyboard.press('ArrowRight');
    await expect(inhalt).toBeFocused();
    await expect(inhalt).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByLabel('Titel')).toHaveValue('vier');
    await page.keyboard.press('ArrowLeft');
    await expect(datei).toBeFocused();
    await page.keyboard.press('Home');
    await expect(inhalt).toBeFocused();
    await page.keyboard.press('End');
    await expect(datei).toBeFocused();
    await expect(datei).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(datei).toBeFocused();
    await expect(page.locator('#dateitext')).toBeVisible();
    await page.keyboard.press(' ');
    await expect(datei).toBeFocused();
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #4' })).toBeVisible();
  });

  test('US-15 Gegenbeispiel: → im Titelfeld bewegt nur die Schreibmarke, d wechselt weiter', async ({ page }) => {
    await oeffnen(page);
    const titel = page.getByLabel('Titel');
    await titel.focus();
    await titel.evaluate(el => el.setSelectionRange(0, 0));
    await page.keyboard.press('ArrowRight');
    await expect(titel).toBeFocused();
    expect(await titel.evaluate(el => el.selectionStart)).toBe(1);
    await expect(page.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
    await titel.blur();
    await page.locator('.mod-kopf .pfad').click();
    await page.keyboard.press('d');
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Datei' })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('d');
    await expect(page.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
  });

  test('US-15: Kürzelhilfe des Fensters nennt ← →', async ({ page }) => {
    await oeffnen(page);
    await page.locator('.mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe.locator('tr', { hasText: 'Reiter wechseln (Fokus auf einem Reiter)' })).toContainText('←');
    await expect(hilfe.locator('tr', { hasText: 'Reiter wechseln (Fokus auf einem Reiter)' })).toContainText('→');
  });
});

// R00105 Preisetikett auf der Karte (B0368): Board „fabrik“ mit dem Grundbestand der User Story
const NBSP = '\u00a0';
const SPANNE = 'cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n  basis: Schätzung planer\n';
const BETRAG = 'cost:\n  currency: USD\n  amount: 1.63\n';
const POSITIONEN = 'cost:\n  currency: USD\n  items:\n    - text: Planung\n      min: 0.10\n      max: 0.20\n      tokens: 12000\n    - text: Bau\n      min: 0.20\n      max: 0.40\n    - text: Gemeinkostenanteil\n      amount: 0.30\n  basis: Schätzung planer\n';
const ZEIT_46 = '```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 09:46 · st\n```\n';
const aufgabeMd = (nr, titel, kopf = '', rumpf = '') => `---\nid: ${nr}\ntitle: ${titel}\n${kopf}---\n${rumpf}`;
const fabrik = (eins = SPANNE, zeit = '') => ({
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n- #4\n\n## In Arbeit\n\n- #2\n\n## Fertig\n\n- #3\n',
  'aufgaben/0001-eins.md': aufgabeMd(1, 'eins', eins, zeit),
  'aufgaben/0002-zwei.md': aufgabeMd(2, 'zwei', BETRAG),
  'aufgaben/0003-drei.md': aufgabeMd(3, 'drei'),
  'aufgaben/0004-vier.md': aufgabeMd(4, 'vier'),
});

/** Was ein Screenreader am Etikett liest: Text aller Knoten außerhalb von aria-hidden. */
const vorgelesen = etikett => etikett.evaluate(el => {
  const texte = [];
  const gehen = knoten => {
    if (knoten.nodeType === 3) { texte.push(knoten.textContent); return; }
    if (knoten.getAttribute && knoten.getAttribute('aria-hidden') === 'true') return;
    knoten.childNodes.forEach(gehen);
  };
  gehen(el);
  return texte.join('');
});

test.describe('R00105 Preisetikett auf der Karte', () => {
  let k;
  test.afterEach(() => k.stoppen());

  async function board(page, dateien, kopf = '') {
    k = await kanbanStarten(einrichten(kopf ? { ...dateien, 'kanbanD.md': kopf } : dateien));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await expect(page.locator('.ka[data-id="1"]')).toBeVisible();
  }

  test('US-1: Spanne zeigt die Mitte, Hinweis und Name nennen die Spanne, die Datei bleibt byte-gleich', async ({ page }) => {
    k = await kanbanStarten(einrichten(fabrik()));
    const vorher = k.lies('aufgaben/0001-eins.md');
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    const karte = page.locator('.ka[data-id="1"]'), etikett = karte.locator('.r3 .preis');
    await expect(etikett).toHaveCount(1);
    await expect(etikett.locator('[aria-hidden="true"]')).toHaveText('≈ 1,10 $');
    await expect(etikett).toHaveAttribute('title', `0,60–1,60${NBSP}$ · geschätzte API-Kosten`);
    expect(await vorgelesen(etikett)).toBe(`Preisetikett: geschätzt 0,60 bis 1,60${NBSP}$, geschätzte API-Kosten`);
    expect(await etikett.getAttribute('aria-label')).toBeNull();
    // sichtbar heißt: der Text steht in einem Kasten größer als 1 × 1 px; der versteckte Name ist auf 1 px abgeschnitten
    const sichtbar = await karte.evaluate(el => [...el.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
      .filter(e => { const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; }).map(e => e.textContent).join(' '));
    expect(sichtbar).toContain('≈ 1,10');
    expect(sichtbar).not.toContain('Preisetikett');
    expect(sichtbar).not.toContain('geschätzt');
    await expect(etikett.locator('.vh')).toHaveText(/^Preisetikett: /);
    expect(sichtbar).not.toContain(',' + ' Σ');
    await expect(karte.locator('.sum')).toHaveCount(0);
    await expect(etikett).not.toContainText('≈ 1,10 $,');
    await expect(etikett).not.toHaveClass(/lbl/);
    // sieht aus wie die Zeitsumme: Schrift der .sum, kein Rahmen, kein Grund
    const stil = await etikett.evaluate(el => { const s = getComputedStyle(el); return { schrift: s.fontFamily.replace(/, /g, ','), rahmen: s.borderTopWidth, grund: s.backgroundColor }; });
    const mono = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--kd-mono').trim());
    expect(stil).toEqual({ schrift: mono, rahmen: '0px', grund: 'rgba(0, 0, 0, 0)' });
    await etikett.hover();
    expect(k.lies('aufgaben/0001-eins.md')).toBe(vorher);
  });

  test('US-2: Betrag in Dollar und Euro', async ({ page }) => {
    await board(page, fabrik('cost:\n  currency: EUR\n  amount: 25.55\n'));
    const zwei = page.locator('.ka[data-id="2"] .preis');
    await expect(zwei.locator('[aria-hidden="true"]')).toHaveText('≈ 1,63 $');
    expect(await vorgelesen(zwei)).toBe(`Preisetikett: geschätzt 1,63${NBSP}$, geschätzte API-Kosten`);
    await expect(zwei).toHaveAttribute('title', `1,63${NBSP}$ · geschätzte API-Kosten`);
    await expect(page.locator('.ka[data-id="1"] .preis [aria-hidden="true"]')).toHaveText('≈ 25,55 €');
  });

  test('US-3 und US-5: Positionen zeigen die Mitte der Summe, ohne Etikett keins, Rundung an der Grenze', async ({ page }) => {
    await board(page, fabrik(POSITIONEN));
    await expect(page.locator('.ka[data-id="1"] .preis [aria-hidden="true"]')).toHaveText('≈ 0,75 $');
    await expect(page.locator('.ka[data-id="4"] .preis')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="3"] .preis')).toHaveCount(0);
    await k.stoppen();
    await board(page, fabrik('cost:\n  currency: USD\n  min: 0.60\n  max: 1.61\n'));
    await expect(page.locator('.ka[data-id="1"] .preis [aria-hidden="true"]')).toHaveText('≈ 1,11 $');
  });

  test('US-21: Komma vor Σ hängt am Betrag, bricht nie allein um, ohne Σ kein Komma', async ({ page }) => {
    await board(page, fabrik(SPANNE, ZEIT_46));
    const r3 = page.locator('.ka[data-id="1"] .r3');
    for (const breite of [1280, 320, 375, 414]) {
      await page.setViewportSize({ width: breite, height: 800 });
      expect((await r3.innerText()).replace(/\s+/g, ' ')).toContain('≈ 1,10 $, Σ 0:46');
      const zeilen = await r3.locator('.preis [aria-hidden="true"]').evaluate(el => el.getClientRects().length);
      expect(zeilen, `Betrag und Komma in einer Zeile bei ${breite} px`).toBe(1);
      const zeilenanfang = await r3.evaluate(el => el.innerText.split('\n').some(z => z.trim().startsWith(',')));
      expect(zeilenanfang, `keine Zeile beginnt mit „,“ bei ${breite} px`).toBe(false);
      expect(await vorgelesen(r3.locator('.preis'))).toBe(`Preisetikett: geschätzt 0,60 bis 1,60${NBSP}$, geschätzte API-Kosten`);
    }
    const zwei = page.locator('.ka[data-id="2"] .r3');
    await expect(zwei.locator('.preis [aria-hidden="true"]')).toHaveText('≈ 1,63 $');
    await expect(zwei.locator('.sum')).toHaveCount(0);
    expect(await zwei.innerText()).not.toContain(',' + NBSP);
  });

  test('Kontrast des Etiketts je Klasse in Hell und Dunkel mindestens 4,5:1', async ({ page }) => {
    const farben = ['yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'magenta', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal', 'green', 'lime', 'grey', '#2a9d8f', '#f5e6a0', '#1b1b1b'];
    const klassen = farben.map((f, i) => `  k${i}: {label: K${i}, color: "${f}"}`).join('\n');
    const kopf = `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses:\n${klassen}\n---\n`;
    const dateien = { 'boards/fabrik.md': `# fabrik\n\n## Eingang\n\n${farben.map((_, i) => `- #${i + 1}`).join('\n')}\n- #${farben.length + 1}\n` };
    farben.forEach((_, i) => { dateien[`aufgaben/${String(i + 1).padStart(4, '0')}-k.md`] = aufgabeMd(i + 1, `k${i}`, `class: k${i}\n${SPANNE}`); });
    dateien[`aufgaben/${String(farben.length + 1).padStart(4, '0')}-ohne.md`] = aufgabeMd(farben.length + 1, 'ohne Klasse', SPANNE);
    await board(page, dateien, kopf);
    await expect(page.locator('.ka .preis')).toHaveCount(farben.length + 1);
    const schlechteste = () => page.evaluate(() => {
      const rgb = farbe => { const c = document.createElement('canvas').getContext('2d'); c.fillStyle = farbe; c.fillRect(0, 0, 1, 1); return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const hell = f => { const l = rgb(f).map(v => v / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]; };
      const verh = (a, b) => { const [x, y] = [hell(a), hell(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      return [...document.querySelectorAll('.ka')].filter(ka => ka.querySelector('.preis')).map(ka => ({
        karte: ka.dataset.id, wert: verh(getComputedStyle(ka.querySelector('.preis')).color, getComputedStyle(ka).backgroundColor),
      })).sort((a, b) => a.wert - b.wert)[0];
    });
    for (const thema of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
      const s = await schlechteste();
      expect(s.wert, `${thema}: Karte #${s.karte}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

// R00105 Reiter „Kosten“ im Aufgabenfenster (B0370)
const LANG = 'KSTXQZRTPLKMNBVCXZWQRTPLKMNBVCXZWQRTPLKM';
const KOMPOSITUM = 'Gemeinkostenanteilsberechnung';
const MIT_KOMPOSITUM = POSITIONEN.replace('  basis:', `    - text: ${KOMPOSITUM}\n      amount: 0.05\n  basis:`);
const MIT_LANG = POSITIONEN.replace('  basis:', `    - text: ${LANG}\n      amount: 0.05\n  basis:`);

/** Zeilen eines Textknotens im Layout: Positionen, vor denen eine neue Zeile beginnt (über Range je Zeichen). */
// Zeile je Zeichen aus dem letzten Kasten: am Trennstrich trägt das Zeichen danach auch den Kasten des Strichs am Zeilenende
const umbrueche = zelle => zelle.evaluate(el => {
  const text = el.firstChild, oben = [];
  for (let i = 0; i < text.length; i++) { const r = document.createRange(); r.setStart(text, i); r.setEnd(text, i + 1); const kaesten = [...r.getClientRects()]; oben.push(Math.round(kaesten[kaesten.length - 1].top)); }
  return oben.map((y, i) => (i > 0 && y > oben[i - 1] ? i : -1)).filter(i => i > 0);
});

test.describe('R00105 Reiter Kosten', () => {
  let k;
  test.afterEach(() => k.stoppen());

  async function fenster(page, nr, eins = POSITIONEN) {
    k = await kanbanStarten(einrichten(fabrik(eins)));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await page.locator(`.ka[data-id="${nr}"]`).click();
    const dialog = page.getByRole('dialog', { name: `Aufgabe #${nr}` });
    await expect(dialog).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    return dialog;
  }
  const zeilen = panel => panel.locator('tbody tr, tfoot tr').evaluateAll(trs => trs.map(tr => [...tr.children].map(c => c.textContent.replace(/\s+/g, ' ').trim()).join(' · ')));

  test('US-3: Tabelle mit Beschriftung, Spalten- und Zeilenköpfen, Summe und Basis, nur lesend', async ({ page }) => {
    const dialog = await fenster(page, 1);
    const datei = k.lies('aufgaben/0001-eins.md'), commits = k.git('rev-list', '--count', 'HEAD');
    const leiste = dialog.getByRole('tablist', { name: 'Ansicht der Aufgabe' });
    await expect(leiste.getByRole('tab')).toHaveText(['Inhalt', 'Datei', 'Kosten']);
    await leiste.getByRole('tab', { name: 'Kosten' }).click();
    await expect(leiste.getByRole('tab', { name: 'Kosten' })).toHaveAttribute('aria-selected', 'true');
    const panel = page.locator('#' + await leiste.getByRole('tab', { name: 'Kosten' }).getAttribute('aria-controls'));
    await expect(panel).toHaveAttribute('role', 'tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', 'reiter-kosten');
    const tabelle = panel.locator('table');
    await expect(tabelle.locator('caption')).toHaveText('Geschätzte API-Kosten (USD)');
    await expect(tabelle.locator('th[scope="col"]')).toHaveText(['Position', 'Tokens', 'niedrig', 'hoch']);
    await expect(tabelle.locator('th[scope="row"]')).toHaveText(['Planung', 'Bau', 'Gemeinkostenanteil', 'Summe']);
    expect(await zeilen(panel)).toEqual(['Planung · 12.000 · 0,10 $ · 0,20 $', 'Bau · — · 0,20 $ · 0,40 $', 'Gemeinkostenanteil · — · 0,30 $ · 0,30 $', 'Summe · 12.000 · 0,60 $ · 0,90 $']);
    await expect(panel.locator('.ko-basis')).toContainText('Schätzung planer');
    expect((await panel.innerText()).match(/geschätzte API-Kosten/gi)).toHaveLength(1);
    await expect(panel.locator('input, textarea, select, [contenteditable]')).toHaveCount(0);
    const rechts = await tabelle.locator('td').evaluateAll(tds => tds.map(td => getComputedStyle(td).textAlign));
    expect(new Set(rechts)).toEqual(new Set(['right']));
    expect(k.lies('aufgaben/0001-eins.md')).toBe(datei);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  });

  test('US-4: ohne Positionen eine Zeile „Gesamt“ ohne Spalte Tokens, Betrag in beiden Spalten, Euro', async ({ page }) => {
    const dialog = await fenster(page, 1, SPANNE);
    const commits = k.git('rev-list', '--count', 'HEAD');
    await dialog.getByRole('tab', { name: 'Kosten' }).click();
    const panel = page.locator('#reiterpanel-kosten');
    await expect(panel.locator('th[scope="col"]')).toHaveText(['Position', 'niedrig', 'hoch']);
    expect(await zeilen(panel)).toEqual(['Gesamt · 0,60 $ · 1,60 $']);
    await expect(panel.locator('th[scope="row"]')).toHaveText(['Gesamt']);
    await page.keyboard.press('Escape');
    await page.locator('.ka[data-id="2"]').click();
    await page.getByRole('dialog', { name: 'Aufgabe #2' }).getByRole('tab', { name: 'Kosten' }).click();
    expect(await zeilen(page.locator('#reiterpanel-kosten'))).toEqual(['Gesamt · 1,63 $ · 1,63 $']);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
    await k.stoppen();
    const euro = await fenster(page, 1, 'cost:\n  currency: EUR\n  amount: 25.55\n');
    await euro.getByRole('tab', { name: 'Kosten' }).click();
    await expect(page.locator('#reiterpanel-kosten caption')).toHaveText('Geschätzte API-Kosten (EUR)');
    expect(await zeilen(page.locator('#reiterpanel-kosten'))).toEqual(['Gesamt · 25,55 € · 25,55 €']);
  });

  test('US-5: ohne Etikett genau zwei Reiter', async ({ page }) => {
    const dialog = await fenster(page, 4);
    await expect(dialog.getByRole('tab')).toHaveText(['Inhalt', 'Datei']);
    await expect(dialog.getByText('Kein Preisetikett')).toHaveCount(0);
  });

  test('US-15: drei Reiter per Tastatur mit Umlauf, d führt aus Kosten zu Datei', async ({ page }) => {
    const dialog = await fenster(page, 1, SPANNE);
    const tab = n => dialog.getByRole('tab', { name: n });
    await tab('Inhalt').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(tab('Kosten')).toBeFocused();
    await expect(tab('Kosten')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reiterpanel-kosten table')).toBeVisible();
    const tabindizes = () => dialog.getByRole('tab').evaluateAll(t => t.map(x => x.getAttribute('tabindex')));
    expect(await tabindizes()).toEqual(['-1', '-1', '0']);
    await page.keyboard.press('ArrowRight');
    await expect(tab('Inhalt')).toBeFocused();
    await expect(page.getByLabel('Titel')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(tab('Kosten')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tab('Inhalt')).toBeFocused();
    expect(await tabindizes()).toEqual(['0', '-1', '-1']);
    await page.keyboard.press('End');
    await expect(tab('Kosten')).toBeFocused();
    await expect(tab('Kosten')).toHaveAttribute('aria-selected', 'true');
    await page.locator('.mod-kopf .id').click();
    await page.keyboard.press('d');
    await expect(tab('Datei')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#dateitext')).toBeVisible();
  });

  for (const [start, folge] of [['Kosten', ['datei', 'inhalt']], ['Inhalt', ['datei', 'inhalt']]]) {
    test(`Nacharbeit S1: d mit Fokus auf dem Reiter „${start}“ — der Fokus folgt dem gewählten Reiter`, async ({ page }) => {
      const dialog = await fenster(page, 1, SPANNE);
      await dialog.getByRole('tab', { name: start }).click();
      await expect(dialog.getByRole('tab', { name: start })).toBeFocused();
      for (const ziel of folge) {
        await page.keyboard.press('d');
        await expect(page.locator(`#reiter-${ziel}`)).toHaveAttribute('aria-selected', 'true');
        await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe(`reiter-${ziel}`);
      }
    });
  }

  test('Nacharbeit S1 Gegenbeispiel: d mit Fokus außerhalb der Reiter lässt den Fokus dort', async ({ page }) => {
    const dialog = await fenster(page, 1, SPANNE);
    await dialog.getByRole('button', { name: 'Schließen' }).focus();
    await page.keyboard.press('d');
    await expect(page.locator('#reiter-datei')).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.getByRole('button', { name: 'Schließen' })).toBeFocused();
  });

  test('US-16: ↓ zu einer Aufgabe ohne Etikett zeigt „Inhalt“, zurück zu #1 bleibt „Inhalt“', async ({ page }) => {
    const dialog = await fenster(page, 1);
    await dialog.getByRole('tab', { name: 'Kosten' }).click();
    await expect(dialog.getByRole('tab', { name: 'Kosten' })).toBeFocused();
    await page.keyboard.press('ArrowDown');
    const vier = page.getByRole('dialog', { name: 'Aufgabe #4' });
    await expect(vier.getByRole('tab')).toHaveText(['Inhalt', 'Datei']);
    await expect(vier.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#reiterpanel-inhalt')).toBeVisible();
    await expect(vier.getByRole('tab', { name: 'Inhalt' })).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(dialog.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
  });

  for (const [ort, fokussieren] of [['Reiter „Kosten“', d => d.getByRole('tab', { name: 'Kosten' }).focus()], ['Panel „Kosten“', d => d.locator('#reiterpanel-kosten .ko-scroll').focus()]]) {
    test(`US-16: Live-Ereignis nimmt das Etikett, Fokus auf ${ort} → Fokus auf „Inhalt“ in 1 s`, async ({ page }) => {
      const dialog = await fenster(page, 1);
      await liveBereit(page);
      await dialog.getByRole('tab', { name: 'Kosten' }).click();
      await fokussieren(dialog);
      expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: null } })).ok()).toBe(true);
      await expect(dialog.getByRole('tab')).toHaveText(['Inhalt', 'Datei'], { timeout: 1000 });
      await expect(dialog.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
      await expect(dialog.getByRole('tab', { name: 'Inhalt' })).toBeFocused({ timeout: 1000 });
    });
  }

  for (const [ort, vorbereiten, ziel] of [
    ['Schließen-Knopf im Reiter „Kosten“', async d => { await d.getByRole('tab', { name: 'Kosten' }).click(); await d.getByRole('button', { name: 'Schließen' }).focus(); }, d => d.getByRole('button', { name: 'Schließen' })],
    ['Titelfeld', async d => { await d.getByRole('tab', { name: 'Kosten' }).click(); await d.getByRole('tab', { name: 'Inhalt' }).click(); await d.getByRole('textbox', { name: 'Titel' }).click(); }, d => d.getByRole('textbox', { name: 'Titel' })],
  ]) {
    test(`US-16: Live-Ereignis nimmt das Etikett, Fokus im ${ort} bleibt dort`, async ({ page }) => {
      const dialog = await fenster(page, 1);
      await liveBereit(page);
      await vorbereiten(dialog);
      await expect(ziel(dialog)).toBeFocused();
      const auswahl = () => page.evaluate(() => [document.activeElement.selectionStart, document.activeElement.selectionEnd]);
      const imTitel = ort === 'Titelfeld';
      if (imTitel) {
        await page.keyboard.press('End');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Shift+ArrowLeft');
      }
      const vorher = await auswahl();
      if (imTitel) expect(vorher, 'Schreibmarke mitten im Titel, ein Zeichen markiert').toEqual([2, 3]);
      expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: null } })).ok()).toBe(true);
      await expect(dialog.getByRole('tab')).toHaveText(['Inhalt', 'Datei'], { timeout: 1000 });
      await expect(dialog.getByRole('tab', { name: 'Inhalt' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#reiterpanel-inhalt')).toBeVisible();
      await expect(ziel(dialog)).toBeFocused();
      expect(await auswahl(), 'Schreibmarke unverändert').toEqual(vorher);
    });
  }

  test('US-17: Kopf mit drei Reitern bei 320, 375 und 414 px in Hell und Dunkel ohne waagrechtes Scrollen', async ({ page }) => {
    await fenster(page, 1, `class: feature\n${SPANNE}`);
    await expect(page.locator('#fenster .mod-kopf .cls')).toHaveText('Funktion');
    for (const breite of [320, 375, 414]) {
      for (const thema of ['light', 'dark']) {
        await page.setViewportSize({ width: breite, height: 700 });
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
        if (!await page.locator('#fenster').count()) await page.locator('.ka[data-id="1"]').click();
        const kopf = page.locator('#fenster .mod-kopf');
        const masse = await kopf.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
        expect(masse.sw, `${breite} px ${thema}`).toBeLessThanOrEqual(masse.cw);
        const ziele = [...['Inhalt', 'Datei', 'Kosten'].map(n => page.getByRole('tab', { name: n })), page.getByRole('button', { name: 'Schließen' })];
        for (const ziel of ziele) {
          const box = await ziel.boundingBox();
          expect(box.x, `${breite} px ${thema}`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${breite} px ${thema}`).toBeLessThanOrEqual(breite);
        }
        for (const n of ['Kosten', 'Datei', 'Inhalt']) {
          await page.getByRole('tab', { name: n }).click();
          await expect(page.getByRole('tab', { name: n })).toHaveAttribute('aria-selected', 'true');
        }
        await page.getByRole('button', { name: 'Schließen' }).click();
        await expect(page.locator('#fenster')).toHaveCount(0);
      }
    }
  });

  test('US-22: Positionsnamen trennen nur nach Silben und nur, wo die Zelle zu schmal ist; bei 1280 px gar nicht', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const dialog = await fenster(page, 1, MIT_KOMPOSITUM);
    await dialog.getByRole('tab', { name: 'Kosten' }).click();
    const koepfe = page.locator('#reiterpanel-kosten th[scope="row"]');
    const stile = await koepfe.evaluateAll(ths => ths.map(th => { const s = getComputedStyle(th); return [s.hyphens, s.overflowWrap, s.wordBreak, th.closest('[lang]').getAttribute('lang')].join(' '); }));
    expect(new Set(stile)).toEqual(new Set(['auto normal normal de']));
    for (const [wort, silben] of [['Gemeinkostenanteil', [2, 6, 9, 12, 14]], [KOMPOSITUM, [2, 6, 9, 12, 14, 19, 21, 25]]]) {
      for (const i of await umbrueche(koepfe.filter({ hasText: new RegExp(`^${wort}$`) }))) expect(silben, `Umbruch nach „${wort.slice(0, i)}“`).toContain(i);
    }
    const lang = await umbrueche(koepfe.filter({ hasText: KOMPOSITUM }));
    expect(lang.length, 'zu schmal für das ganze Wort').toBeGreaterThan(0);
    const panel = await page.locator('#reiterpanel-kosten').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(panel.sw).toBeLessThanOrEqual(panel.cw);
    await page.setViewportSize({ width: 1280, height: 800 });
    expect(await umbrueche(koepfe.filter({ hasText: /^Gemeinkostenanteil$/ }))).toEqual([]);
    expect(await umbrueche(koepfe.filter({ hasText: KOMPOSITUM }))).toEqual([]);
  });

  test('US-23: Wort ohne Silbengrenze bleibt ganz, die Tabelle scrollt quer im Panel per Tastatur', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    const dialog = await fenster(page, 1, MIT_LANG);
    await dialog.getByRole('tab', { name: 'Kosten' }).click();
    const lang = page.locator('#reiterpanel-kosten th[scope="row"]', { hasText: LANG });
    expect(await umbrueche(lang)).toEqual([]);
    const stile = await page.locator('#reiterpanel-kosten th[scope="row"]').evaluateAll(ths => ths.map(th => getComputedStyle(th).overflowWrap + ' ' + getComputedStyle(th).wordBreak));
    expect(new Set(stile)).toEqual(new Set(['normal normal']));
    const scroll = page.locator('#reiterpanel-kosten .ko-scroll');
    const vorher = await scroll.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, links: el.scrollLeft }));
    expect(vorher.sw).toBeGreaterThan(vorher.cw);
    await page.getByRole('button', { name: 'Schließen' }).focus();
    await page.keyboard.press('Tab');
    await expect(scroll).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(vorher.links);
    const kopf = await page.locator('#fenster .mod-kopf').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(kopf.sw).toBeLessThanOrEqual(kopf.cw);
    for (const ziel of [...['Inhalt', 'Datei', 'Kosten'].map(n => page.getByRole('tab', { name: n })), page.getByRole('button', { name: 'Schließen' })]) {
      const box = await ziel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    const seite = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(seite.sw).toBeLessThanOrEqual(seite.cw);
  });
});
