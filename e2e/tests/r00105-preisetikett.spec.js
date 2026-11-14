// R00105 Preisetikett je Aufgabe — Reiterleiste des Aufgabenfensters per Tastatur (US-15, F0043)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, breiteSetzen, kontrastAm } = require('./hilfen');

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

  test('US-15: das Ansichtsmenü nennt die Ansichten in Reihenfolge (ohne „Anhänge“) und die gewählte als aria-checked', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]').click();
    const menue = page.locator('#fenster [role="menu"][data-art="ansicht"]');
    const namen = await menue.getByRole('menuitemradio').evaluateAll(alle => alle.map(e => e.querySelector('.fm-text').textContent));
    expect(namen).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
    await expect(menue.getByRole('menuitemradio', { checked: true })).toHaveText('✓Inhalt');
    await expect(menue.getByRole('menuitemradio', { name: 'Datei', exact: true })).toHaveAttribute('aria-checked', 'false');
  });

  test('US-15: Pfeile, Pos1, Ende und Enter führen und wählen im Ansichtsmenü', async ({ page }) => {
    await oeffnen(page);
    await page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]').click();
    const menue = page.locator('#fenster [role="menu"][data-art="ansicht"]');
    const eintrag = name => menue.getByRole('menuitemradio', { name, exact: true });
    await expect(eintrag('Inhalt')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(eintrag('Zeiten')).toBeFocused();
    await page.keyboard.press('End');
    await expect(eintrag('Verlauf')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(eintrag('Inhalt')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(eintrag('Datei')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dateitext')).toContainText('title: vier');
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]')).toHaveAttribute('aria-label', 'Ansicht: Datei');
  });

  test('US-15 Gegenbeispiel: → im Titelfeld bewegt nur die Schreibmarke, d wechselt weiter', async ({ page }) => {
    await oeffnen(page);
    await page.getByLabel('Titel bearbeiten', { exact: true }).click(); // R00116: Bearbeitungszustand öffnen
    const titel = page.getByLabel('Titel', { exact: true });
    await titel.focus();
    await titel.evaluate(el => el.setSelectionRange(0, 0));
    await page.keyboard.press('ArrowRight');
    await expect(titel).toBeFocused();
    expect(await titel.evaluate(el => el.selectionStart)).toBe(1);
    const ausloeser = page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]');
    await expect(ausloeser).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    await titel.blur();
    await page.locator('.mod-kopf .pfad').click();
    await page.keyboard.press('d');
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(ausloeser).toHaveAttribute('aria-label', 'Ansicht: Datei');
    await page.keyboard.press('d');
    await expect(ausloeser).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
  });

  test('US-15: die Kürzelhilfe des Fensters nennt keinen Reiter-Wechsel mehr', async ({ page }) => {
    await oeffnen(page);
    await page.locator('.mod-kopf .pfad').click();
    await page.keyboard.press('?');
    const hilfe = page.getByRole('dialog', { name: 'Tastaturkürzel' });
    await expect(hilfe).not.toContainText('Reiter wechseln');
    await expect(hilfe).not.toContainText('←');
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
    expect(await vorgelesen(etikett)).toBe(`Preisetikett: geschätzt 0,60 bis 1,60${NBSP}$, API-Kosten`);
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
    expect(await vorgelesen(zwei)).toBe(`Preisetikett: geschätzt 1,63${NBSP}$, API-Kosten`);
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
      await breiteSetzen(page, breite, 800);
      await expect.poll(async () => (await r3.innerText()).replace(/\s+/g, ' '), `Zeile bei ${breite} px`).toContain('≈ 1,10 $, Σ 0:46');
      const zeilen = await r3.locator('.preis [aria-hidden="true"]').evaluate(el => el.getClientRects().length);
      expect(zeilen, `Betrag und Komma in einer Zeile bei ${breite} px`).toBe(1);
      const zeilenanfang = await r3.evaluate(el => el.innerText.split('\n').some(z => z.trim().startsWith(',')));
      expect(zeilenanfang, `keine Zeile beginnt mit „,“ bei ${breite} px`).toBe(false);
      expect(await vorgelesen(r3.locator('.preis'))).toBe(`Preisetikett: geschätzt 0,60 bis 1,60${NBSP}$, API-Kosten`);
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
    const schlechteste = async () => {
      const etiketten = page.locator('.ka .preis');
      const werte = [];
      for (let i = 0; i < await etiketten.count(); i++) {
        const etikett = etiketten.nth(i);
        werte.push({ karte: await etikett.evaluate(e => e.closest('.ka').dataset.id), wert: await kontrastAm(etikett) });
      }
      return werte.sort((x, y) => x.wert - y.wert)[0];
    };
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
const EIN_VOKAL = 'KSTXQZRTPLKMNBVCXZWQRAPLKMNBVCXZWQRTPLKM'; // 40 Zeichen, genau eine Vokalgruppe: keine Silbengrenze
const MIT_EIN_VOKAL = POSITIONEN.replace('  basis:', `    - text: ${EIN_VOKAL}\n      amount: 0.05\n  basis:`);

/** Zeilen eines Zeilenkopfs im Layout: Positionen, vor denen eine neue Zeile beginnt (über Range je Zeichen).
 *  Auflösen und Messen in einem einzigen evaluate, damit kein Neuzeichnen dazwischen den Knoten löst; alle Textknoten
 *  per TreeWalker, auch die im span.ganz. Zeile je Zeichen aus dem letzten Kasten: am Trennstrich trägt das Zeichen
 *  danach auch den Kasten des Strichs am Zeilenende. */
const umbrueche = (page, name) => page.evaluate(gesucht => {
  const zelle = [...document.querySelectorAll('#fenster .mod-body[data-ansicht="kosten"] th[scope="row"]')].find(th => th.textContent.trim() === gesucht);
  if (!zelle) throw new Error(`kein Zeilenkopf „${gesucht}“`);
  const gaenger = document.createTreeWalker(zelle, NodeFilter.SHOW_TEXT), oben = [];
  for (let knoten = gaenger.nextNode(); knoten; knoten = gaenger.nextNode()) {
    for (let i = 0; i < knoten.length; i++) {
      if (/\s/.test(knoten.data[i])) continue;
      const r = document.createRange(); r.setStart(knoten, i); r.setEnd(knoten, i + 1);
      const kaesten = [...r.getClientRects()];
      if (!kaesten.length) throw new Error(`„${gesucht}“ Zeichen ${oben.length} hat keinen Kasten — Knoten gelöst oder nicht gezeichnet`);
      oben.push(Math.round(kaesten[kaesten.length - 1].top));
    }
  }
  if (oben.length !== gesucht.length) throw new Error(`„${gesucht}“: ${oben.length} statt ${gesucht.length} Zeichen gemessen`);
  return oben.map((y, i) => (i > 0 && y > oben[i - 1] ? i : -1)).filter(i => i > 0);
}, name);

/** Reiter „Kosten“ zeigen und warten, bis die Schriften für die neue Tabelle geladen sind. */
async function kostenZeigen(page, dialog) {
  await dialog.locator('[data-act="fenster-menue"][data-arg="ansicht"]').click();
  await page.locator('#fenster [role="menu"][data-art="ansicht"]').getByRole('menuitemradio', { name: 'Kosten', exact: true }).click();
  await expect(page.locator('#fenster .mod-body[data-ansicht="kosten"] table')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

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

  const AUSLOESER = '#fenster [data-act="fenster-menue"][data-arg="ansicht"]';
  const ansichtsMenue = page => page.locator('#fenster [role="menu"][data-art="ansicht"]');
  const ansicht = async (page, name) => {
    if (await ansichtsMenue(page).count() === 0) await page.locator(AUSLOESER).click();
    await ansichtsMenue(page).getByRole('menuitemradio', { name, exact: true }).click();
  };
  const ansichtsNamen = async page => {
    await page.locator(AUSLOESER).click();
    const namen = await ansichtsMenue(page).locator('.fm-text').allInnerTexts();
    await page.keyboard.press('Escape');
    return namen;
  };
  const panel = (page, schluessel) => page.locator(`#fenster .mod-body[data-ansicht="${schluessel}"]`);

  test('US-3: Tabelle mit Beschriftung, Spalten- und Zeilenköpfen, Summe und Basis, nur lesend', async ({ page }) => {
    const dialog = await fenster(page, 1);
    const datei = k.lies('aufgaben/0001-eins.md'), commits = k.git('rev-list', '--count', 'HEAD');
    expect(await ansichtsNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']);
    await ansicht(page, 'Kosten');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Kosten');
    const kosten = panel(page, 'kosten');
    await expect(kosten).toHaveAttribute('role', 'group');
    await expect(kosten).toHaveAttribute('aria-label', 'Ansicht: Kosten');
    const tabelle = kosten.locator('table');
    await expect(tabelle.locator('caption')).toHaveText('Geschätzte API-Kosten (USD)');
    await expect(tabelle.locator('th[scope="col"]')).toHaveText(['Position', 'Tokens', 'niedrig', 'hoch']);
    await expect(tabelle.locator('th[scope="row"]')).toHaveText(['Planung', 'Bau', 'Gemeinkostenanteil', 'Summe']);
    expect(await zeilen(kosten)).toEqual(['Planung · 12.000 · 0,10 $ · 0,20 $', 'Bau · — · 0,20 $ · 0,40 $', 'Gemeinkostenanteil · — · 0,30 $ · 0,30 $', 'Summe · 12.000 · 0,60 $ · 0,90 $']);
    await expect(kosten.locator('.ko-basis')).toContainText('Schätzung planer');
    expect((await kosten.innerText()).match(/geschätzte API-Kosten/gi)).toHaveLength(1);
    await expect(kosten.locator('input, textarea, select, [contenteditable]')).toHaveCount(0);
    const rechts = await tabelle.locator('td').evaluateAll(tds => tds.map(td => getComputedStyle(td).textAlign));
    expect(new Set(rechts)).toEqual(new Set(['right']));
    expect(k.lies('aufgaben/0001-eins.md')).toBe(datei);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  });

  test('US-4: ohne Positionen eine Zeile „Gesamt“ ohne Spalte Tokens, Betrag in beiden Spalten, Euro', async ({ page }) => {
    const dialog = await fenster(page, 1, SPANNE);
    const commits = k.git('rev-list', '--count', 'HEAD');
    await ansicht(page, 'Kosten');
    const kosten = panel(page, 'kosten');
    await expect(kosten.locator('th[scope="col"]')).toHaveText(['Position', 'niedrig', 'hoch']);
    expect(await zeilen(kosten)).toEqual(['Gesamt · 0,60 $ · 1,60 $']);
    await expect(kosten.locator('th[scope="row"]')).toHaveText(['Gesamt']);
    await page.keyboard.press('Escape');
    await page.locator('.ka[data-id="2"]').click();
    await ansicht(page, 'Kosten');
    expect(await zeilen(panel(page, 'kosten'))).toEqual(['Gesamt · 1,63 $ · 1,63 $']);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
    await k.stoppen();
    const euro = await fenster(page, 1, 'cost:\n  currency: EUR\n  amount: 25.55\n');
    await page.locator(AUSLOESER).click();
    await ansichtsMenue(page).getByRole('menuitemradio', { name: 'Kosten', exact: true }).click();
    await expect(panel(page, 'kosten').locator('caption')).toHaveText('Geschätzte API-Kosten (EUR)');
    expect(await zeilen(panel(page, 'kosten'))).toEqual(['Gesamt · 25,55 € · 25,55 €']);
  });

  test('US-5: ohne Etikett führt das Menü kein „Kosten“', async ({ page }) => {
    await fenster(page, 4);
    expect(await ansichtsNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
    await expect(page.getByText('Kein Preisetikett')).toHaveCount(0);
  });

  test('US-15: das Menü führt per Tastatur (Pfeile, Pos1, Ende, Enter), d wechselt Inhalt ↔ Datei', async ({ page }) => {
    await fenster(page, 1, SPANNE);
    await page.locator(AUSLOESER).click();
    const eintrag = name => ansichtsMenue(page).getByRole('menuitemradio', { name, exact: true });
    await expect(eintrag('Inhalt')).toBeFocused();
    await page.keyboard.press('End');
    await expect(eintrag('Verlauf')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(eintrag('Inhalt')).toBeFocused();
    for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
    await expect(eintrag('Kosten')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Kosten');
    await expect(panel(page, 'kosten').locator('table')).toBeVisible();
    await page.keyboard.press('d');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Datei');
    await expect(page.locator('#dateitext')).toBeVisible();
    await expect(page.locator(AUSLOESER)).toBeFocused();
  });

  test('Nacharbeit S1: d lässt den Fokus am Auslöser, dessen Name die neue Ansicht sagt', async ({ page }) => {
    await fenster(page, 1, SPANNE);
    await ansicht(page, 'Kosten');
    for (const ziel of ['Datei', 'Inhalt']) {
      await page.keyboard.press('d');
      await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', `Ansicht: ${ziel}`);
      await expect(page.locator(AUSLOESER)).toBeFocused();
    }
  });

  test('Nacharbeit S1 Gegenbeispiel: d mit Fokus außerhalb führt ihn an den Auslöser (R00145 FA 8)', async ({ page }) => {
    const dialog = await fenster(page, 1, SPANNE);
    await dialog.getByRole('button', { name: 'Schließen' }).focus();
    await page.keyboard.press('d');
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Datei');
    await expect(page.locator(AUSLOESER)).toBeFocused();
  });

  test('US-16: eine andere Aufgabe öffnen zeigt bei fehlendem Etikett „Inhalt“; die Ansicht fällt auf „Inhalt“', async ({ page }) => {
    await fenster(page, 1);
    await ansicht(page, 'Kosten');
    await page.keyboard.press('Escape');
    await page.locator('.ka[data-id="4"]').click();
    const vier = page.getByRole('dialog', { name: 'Aufgabe #4' });
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt');
    expect(await ansichtsNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
    await expect(vier).toBeVisible();
    await expect(panel(page, 'inhalt')).toBeVisible();
  });

  test('US-16: Live-Ereignis nimmt das Etikett — Menü zu, Ansicht „Inhalt“, Fokus am Auslöser (1 s)', async ({ page }) => {
    await fenster(page, 1);
    await liveBereit(page);
    await ansicht(page, 'Kosten');
    await page.locator(AUSLOESER).click();
    expect((await page.request.patch(`${k.adresse}api/aufgaben/1`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: null } })).ok()).toBe(true);
    await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt', { timeout: 1000 });
    await expect(page.locator('#fenster [role="menu"]')).toHaveCount(0);
    await expect(page.locator(AUSLOESER)).toBeFocused({ timeout: 1000 });
    expect(await ansichtsNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
  });

  for (const [ort, vorbereiten, ziel] of [
    ['Schließen-Knopf', async (page, d) => { await ansicht(page, 'Kosten'); await d.getByRole('button', { name: 'Schließen' }).focus(); }, d => d.getByRole('button', { name: 'Schließen' })],
    ['Titelfeld', async (page, d) => { await d.getByRole('button', { name: 'Titel bearbeiten' }).click(); await d.getByRole('textbox', { name: 'Titel' }).click(); }, d => d.getByRole('textbox', { name: 'Titel' })],
  ]) {
    test(`US-16: Live-Ereignis nimmt das Etikett, Fokus im ${ort} bleibt dort`, async ({ page }) => {
      const dialog = await fenster(page, 1);
      await liveBereit(page);
      await vorbereiten(page, dialog);
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
      await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', 'Ansicht: Inhalt', { timeout: 1000 });
      await expect(panel(page, 'inhalt')).toBeVisible();
      await expect(ziel(dialog)).toBeFocused();
      expect(await auswahl(), 'Schreibmarke unverändert').toEqual(vorher);
    });
  }

  test('US-17: Kopf bei 320, 375 und 414 px in Hell und Dunkel einzeilig und ohne waagrechtes Scrollen', async ({ page }) => {
    await fenster(page, 1, `class: feature\n${SPANNE}`);
    await expect(page.locator('#fenster .mod-kopf .cls')).toHaveText('Funktion');
    for (const breite of [320, 375, 414]) {
      for (const thema of ['light', 'dark']) {
        await page.setViewportSize({ width: breite, height: 700 });
        await page.evaluate(t => { document.documentElement.dataset.theme = t; }, thema);
        if (!await page.locator('#fenster').count()) await page.locator('.ka[data-id="1"]').click();
        const kopf = page.locator('#fenster .mod-kopf');
        const masse = await kopf.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, h: el.clientHeight, ziel: parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--kd-ziel')) || 0 }));
        expect(masse.sw, `${breite} px ${thema}`).toBeLessThanOrEqual(masse.cw);
        expect(masse.h, `${breite} px ${thema}: einzeilig`).toBeLessThanOrEqual(Math.max(36, masse.ziel) + 2);
        for (const ziel of [page.locator(AUSLOESER), page.locator('#fenster [data-act="fenster-menue"][data-arg="aktionen"]'), page.getByRole('button', { name: 'Schließen' })]) {
          const box = await ziel.boundingBox();
          expect(box.x, `${breite} px ${thema}`).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width, `${breite} px ${thema}`).toBeLessThanOrEqual(breite);
        }
        for (const n of ['Kosten', 'Datei', 'Inhalt']) {
          await ansicht(page, n);
          await expect(page.locator(AUSLOESER)).toHaveAttribute('aria-label', `Ansicht: ${n}`);
        }
        await page.getByRole('button', { name: 'Schließen' }).click();
        await expect(page.locator('#fenster')).toHaveCount(0);
      }
    }
  });

  test('US-22: Positionsnamen trennen nur nach Silben und nur, wo die Zelle zu schmal ist; bei 1280 px gar nicht', async ({ page }) => {
    await breiteSetzen(page, 320, 700);
    const dialog = await fenster(page, 1, MIT_KOMPOSITUM);
    await kostenZeigen(page, dialog);
    const koepfe = panel(page, 'kosten').locator('th[scope="row"]');
    const stile = await koepfe.evaluateAll(ths => ths.map(th => { const s = getComputedStyle(th); return [s.hyphens, s.overflowWrap, s.wordBreak, th.closest('[lang]').getAttribute('lang')].join(' '); }));
    expect(new Set(stile)).toEqual(new Set(['auto normal normal de']));
    for (const [wort, silben] of [['Gemeinkostenanteil', [2, 6, 9, 12, 14]], [KOMPOSITUM, [2, 6, 9, 12, 14, 19, 21, 25]]]) {
      for (const i of await umbrueche(page, wort)) expect(silben, `Umbruch nach „${wort.slice(0, i)}“`).toContain(i);
    }
    expect((await umbrueche(page, KOMPOSITUM)).length, 'zu schmal für das ganze Wort').toBeGreaterThan(0);
    const masse = await panel(page, 'kosten').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(masse.sw).toBeLessThanOrEqual(masse.cw);
    await breiteSetzen(page, 1280, 800);
    expect(await umbrueche(page, 'Gemeinkostenanteil')).toEqual([]);
    expect(await umbrueche(page, KOMPOSITUM)).toEqual([]);
  });

  test('Nacharbeit S5: ein Wort mit genau einer Vokalgruppe (40 Zeichen) hat keine Silbengrenze und bleibt ganz', async ({ page }) => {
    expect(EIN_VOKAL).toHaveLength(40);
    await breiteSetzen(page, 320, 700);
    const dialog = await fenster(page, 1, MIT_EIN_VOKAL);
    await kostenZeigen(page, dialog);
    await expect(panel(page, 'kosten').locator('th[scope="row"] span.ganz', { hasText: EIN_VOKAL })).toHaveText(EIN_VOKAL);
    expect(await umbrueche(page, EIN_VOKAL)).toEqual([]);
  });

  test('US-23: Wort ohne Silbengrenze bleibt ganz, die Tabelle scrollt quer im Panel per Tastatur', async ({ page }) => {
    await breiteSetzen(page, 320, 700);
    const dialog = await fenster(page, 1, MIT_LANG);
    await kostenZeigen(page, dialog);
    expect(await umbrueche(page, LANG)).toEqual([]);
    const stile = await panel(page, 'kosten').locator('th[scope="row"]').evaluateAll(ths => ths.map(th => getComputedStyle(th).overflowWrap + ' ' + getComputedStyle(th).wordBreak));
    expect(new Set(stile)).toEqual(new Set(['normal normal']));
    const scroll = panel(page, 'kosten').locator('.ko-scroll');
    const vorher = await scroll.evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth, links: el.scrollLeft }));
    expect(vorher.sw).toBeGreaterThan(vorher.cw);
    await page.getByRole('button', { name: 'Schließen' }).focus();
    await page.keyboard.press('Tab');
    await expect(scroll).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => scroll.evaluate(el => el.scrollLeft)).toBeGreaterThan(vorher.links);
    const kopf = await page.locator('#fenster .mod-kopf').evaluate(el => ({ sw: el.scrollWidth, cw: el.clientWidth }));
    expect(kopf.sw).toBeLessThanOrEqual(kopf.cw);
    for (const ziel of [page.locator(AUSLOESER), page.locator('#fenster [data-act="fenster-menue"][data-arg="aktionen"]'), page.getByRole('button', { name: 'Schließen' })]) {
      const box = await ziel.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(320);
    }
    const seite = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(seite.sw).toBeLessThanOrEqual(seite.cw);
  });
});
