// R00109 Feldbeschriftung — Härtung #123 (Karte #123, PO-Freigabe Artboard #104): die nackte `.felder .k`-Beschriftung trägt die
// gezeichnete Darstellung — Plex Sans 500, 12/16, --kd-text (D0003 `#beschriftung-schluessel`, `#geschaetzt-im-fenster`;
// R00109 Z. 183). Nicht mehr Mono/--kd-muted. Geprüft im Reiter „Details“ (Zeichnung samt Schlüssel `.sl`), an der Basisregel
// außerhalb dieses Reiters (WBS „Neuer Knoten“) und in „Neue Aufgabe“; dazu die Werte `.w`/`.w.mono` und die Feldzeilen-Abstände.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter, thema, kontrastMessen, kontrastFarben } = require('./hilfen');
const { zeile, arbeitsRepository: repository, mitRegister } = require('./wbs-hilfen');

const THEMEN = ['light', 'dark'];
/** Die Zeichnung (PO #104): Plex Sans, 500, 12/16, --kd-text. Der Schlüssel `.sl` bleibt Mono 10,5/14 --kd-muted. */
const ZEICHNUNG = { familie: 'IBM Plex Sans', gewicht: '500', groesse: '12px', hoehe: '16px' };
/** Die Feldzeilen aus D0003 `#beschriftung-schluessel`: Beschriftungsspalte 84 px, Zeile mit Schlüssel mindestens 38 px. */
const MASSE = { spalte: 84, zeileMitSchluessel: 38 };

const GRUND = {
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n\n## Fertig\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\nkey: shop/nc-304\nestimate: 150\ndue: 2026-11-20\norigins: [I0023]\nassignees: [st, cl]\nlabels: [zeit]\n---\n',
};

const WBS = '---\napplication: kanbanD\n---\n\n# WBS\n\n| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz | Phase |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n'
  + zeile('A0001', 'Application', '—', 'kanbanD', 'gelb', { fertig: 'alle Dialogs gruen' })
  + zeile('D0001', 'Dialog', 'A0001', 'Board', 'gelb', { req: 'R00001' })
  + zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'gruen', { fertig: 'US-1', req: 'R00001' });

/** Die Farbe eines Tokens, wie der Browser sie für `color` auflöst. */
const tokenFarbe = (page, token) => page.evaluate(w => {
  const p = document.createElement('p'); p.style.color = `var(${w})`; document.body.append(p);
  const c = getComputedStyle(p).color; p.remove(); return c;
}, token);

/** Berechnete Schrift und Farbe jeder Beschriftung unter `wurzel`: Text, ob nackt (ohne `.kb`), Familie, Gewicht, Größe, Zeilenhöhe, Farbe. */
const beschriftungen = (page, wurzel) => page.evaluate(sel => [...document.querySelectorAll(sel)].map(el => {
  const s = getComputedStyle(el);
  return { text: el.textContent.trim(), nackt: el.closest('.kb') === null, familie: s.fontFamily, gewicht: s.fontWeight, groesse: s.fontSize, hoehe: s.lineHeight, farbe: s.color };
}), wurzel);

/** Vergleicht jede Messung mit der Zeichnung und meldet den ganzen Befund auf einmal. */
function zeichnungPruefen(zeilen, textfarbe, wo) {
  expect(zeilen.length, `${wo}: Beschriftungen gefunden`).toBeGreaterThan(0);
  for (const z of zeilen) {
    const name = `${wo} „${z.text}“`;
    expect(z.familie, `${name}: Plex Sans`).toContain(ZEICHNUNG.familie);
    expect(z.familie, `${name}: nicht Plex Mono`).not.toContain('Plex Mono');
    expect(z.gewicht, `${name}: 500`).toBe(ZEICHNUNG.gewicht);
    expect(z.groesse, `${name}: 12px`).toBe(ZEICHNUNG.groesse);
    expect(z.hoehe, `${name}: 16px`).toBe(ZEICHNUNG.hoehe);
    expect(z.farbe, `${name}: --kd-text`).toBe(textfarbe);
  }
}

test.describe('R00109/Härtung #123 Feldbeschriftung im Reiter „Details“', () => {
  let k;
  test.afterEach(() => k?.stoppen());

  async function details(page) {
    k = await kanbanStarten(einrichten(GRUND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await page.locator('.ka[data-id="1"]').click();
    const dialog = page.getByRole('dialog', { name: 'Aufgabe #1' });
    await expect(dialog).toBeVisible();
    await reiter(page, 'Details');
    return dialog;
  }

  test('Härtung #123: jede .k-Beschriftung trägt Plex Sans 500 12/16 --kd-text — nackt („Schlüssel“, „Zählt in Berichten“) wie mit Schlüssel, hell und dunkel', async ({ page }) => {
    await details(page);
    for (const t of THEMEN) {
      await thema(page, t);
      const textfarbe = await tokenFarbe(page, '--kd-text');
      const zeilen = await beschriftungen(page, '.felder-details > .k, .felder-details > .kb > .k');
      zeichnungPruefen(zeilen, textfarbe, t);
      // beide Fassungen der Zeichnung sind im Reiter „Details“ vertreten: die nackte Beschriftung und die mit Schlüssel
      const nackt = zeilen.filter(z => z.nackt).map(z => z.text);
      expect(nackt, `${t}: die nackte .k-Beschriftung ist da`).toEqual(expect.arrayContaining(['Schlüssel', 'Zählt in Berichten']));
      expect(zeilen.filter(z => !z.nackt).length, `${t}: Feldzeilen mit Schlüssel`).toBeGreaterThanOrEqual(7);
    }
  });

  test('Härtung #123: der Schlüssel bleibt Hilfstext — Mono 10,5/14 in --kd-muted, außerhalb von .k', async ({ page }) => {
    const dialog = await details(page);
    for (const t of THEMEN) {
      await thema(page, t);
      const muted = await tokenFarbe(page, '--kd-muted');
      const schluessel = await dialog.locator('.felder-details > .kb > .sl').first().evaluate(el => {
        const s = getComputedStyle(el);
        return { text: el.textContent.trim(), familie: s.fontFamily, groesse: s.fontSize, hoehe: s.lineHeight, farbe: s.color, inK: el.closest('.k') !== null };
      });
      expect(schluessel.text, t).toBe('column');
      expect(schluessel.familie, `${t}: Plex Mono`).toContain('IBM Plex Mono');
      expect(schluessel.groesse, `${t}: 10,5 px`).toBe('10.5px');
      expect(schluessel.hoehe, `${t}: 14 px`).toBe('14px');
      expect(schluessel.farbe, `${t}: --kd-muted`).toBe(muted);
      expect(schluessel.inK, `${t}: der Schlüssel steht nie in .k`).toBe(false);
    }
  });

  test('Härtung #123: die Beschriftung hält 4,5:1 auf --kd-surface und --kd-sunken, hell und dunkel', async ({ page }) => {
    await details(page);
    for (const t of THEMEN) {
      await thema(page, t);
      const textfarbe = await tokenFarbe(page, '--kd-text');
      for (const grund of ['--kd-surface', '--kd-sunken']) {
        const grundfarbe = await tokenFarbe(page, grund);
        const wert = await kontrastFarben(page, textfarbe, grundfarbe);
        expect(wert, `${t}: --kd-text auf ${grund} = ${wert.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      }
      // gemessen wird die Schrift am gemalten Grund (dieselbe Probe wie `kontrast.spec`)
      const gemessen = await kontrastMessen(page, ['.felder-details > .k, .felder-details > .kb > .k']);
      expect(gemessen.length, `${t}: Beschriftungen gemessen`).toBeGreaterThanOrEqual(9);
      const verstoesse = gemessen.filter(m => m.wert < 4.5).map(m => `${m.element} „${m.text}“ ${m.wert.toFixed(2)}:1`);
      expect(verstoesse, `${t}: unter 4,5:1`).toEqual([]);
    }
  });

  test('Härtung #123: die Werte (.w, .w.mono) und die Feldzeilen-Abstände bleiben unverändert', async ({ page }) => {
    await details(page);
    const masse = await page.evaluate(() => {
      const felder = document.querySelector('.felder-details');
      const wert = [...felder.querySelectorAll('.w.mono')].find(el => el.textContent.trim() === '2:30');
      const schlicht = felder.querySelector('.w:not(.mono)');
      const mitSchluessel = felder.querySelector('.kb');
      const nackt = [...felder.children].find(el => el.classList.contains('k'));
      const stil = el => { const s = getComputedStyle(el); return { familie: s.fontFamily, groesse: s.fontSize, hoehe: s.lineHeight }; };
      return {
        spalten: getComputedStyle(felder).gridTemplateColumns,
        wMono: wert && stil(wert),
        w: stil(schlicht),
        zeile: mitSchluessel.getBoundingClientRect().height,
        polster: getComputedStyle(mitSchluessel).paddingTop + '/' + getComputedStyle(mitSchluessel).paddingBottom,
        nackt: { hoehe: nackt.getBoundingClientRect().height, min: getComputedStyle(nackt).minHeight },
      };
    });
    // die Spalte der Beschriftung und die Werte bleiben, wie D0003 sie zeichnet
    expect(parseFloat(masse.spalten), 'Beschriftungsspalte 84 px').toBeCloseTo(MASSE.spalte, 0);
    expect(masse.wMono.familie, '.w.mono bleibt Mono').toContain('IBM Plex Mono');
    expect(masse.wMono.groesse, '.w.mono bleibt 12 px').toBe('12px');
    expect(masse.w.familie, '.w bleibt Sans').toContain('IBM Plex Sans');
    expect(masse.zeile, 'Zeile mit Schlüssel mindestens 38 px').toBeGreaterThanOrEqual(MASSE.zeileMitSchluessel);
    expect(masse.polster, '.kb bleibt 4 px oben und unten').toBe('4px/4px');
    expect(masse.nackt.hoehe, 'nackte Zeile bleibt 30 px hoch').toBe(30);
    expect(masse.nackt.min, 'nackte Zeile mindestens 30 px').toBe('30px');
  });
});

test.describe('R00109/Härtung #123 die Basisregel `.felder .k` außerhalb von „Details“', () => {
  let k, arbeit;
  test.afterEach(async () => { await k?.stoppen(); arbeit?.aufraeumen(); });

  test('Härtung #123: nackte Beschriftungen einer Feldzeile außerhalb von „Details“ (WBS „Neuer Knoten“) tragen dieselbe Zeichnung, hell und dunkel', async ({ page }) => {
    arbeit = repository(WBS);
    k = await kanbanStarten(mitRegister(arbeit));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/wbs/kd');
    await expect(page.locator('.wbs-titel')).toBeVisible();
    await page.locator('button.wbs-plus').first().click();
    const pop = page.locator('#pop[role="dialog"]');
    await expect(pop).toBeVisible();
    for (const t of THEMEN) {
      await thema(page, t);
      const textfarbe = await tokenFarbe(page, '--kd-text');
      const zeilen = await beschriftungen(page, '#pop[role="dialog"] .felder > .k');
      expect(zeilen.map(z => z.text), `${t}: nackte Beschriftungen`).toEqual(expect.arrayContaining(['Ebene', 'Name', 'Fertig']));
      zeichnungPruefen(zeilen, textfarbe, `${t} WBS „Neuer Knoten“`);
      const gemessen = await kontrastMessen(page, ['#pop[role="dialog"] .felder']);
      const verstoesse = gemessen.filter(m => m.wert < 4.5).map(m => `${m.element} „${m.text}“ ${m.wert.toFixed(2)}:1`);
      expect(verstoesse, `${t}: unter 4,5:1`).toEqual([]);
    }
  });

  test('Härtung #123: die Feldzeilen des Dialogs „Neue Aufgabe“ behalten die Zeichnung (Schlüssel bleibt Hilfstext)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await page.locator('.ka[data-id="1"]').waitFor();
    await page.keyboard.press('n');
    const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await expect(dialog).toBeVisible();
    for (const t of THEMEN) {
      await thema(page, t);
      const textfarbe = await tokenFarbe(page, '--kd-text');
      const zeilen = await beschriftungen(page, '[role="dialog"][aria-label="Neue Aufgabe"] .felder .kb > .k');
      expect(zeilen.length, `${t}: Feldzeilen mit Schlüssel`).toBeGreaterThanOrEqual(5);
      zeichnungPruefen(zeilen, textfarbe, `${t} „Neue Aufgabe“`);
    }
  });
});
