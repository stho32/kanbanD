// R00105 Preisetikett je Aufgabe — Reiterleiste des Aufgabenfensters per Tastatur (US-15, F0043)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');

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
