// R00129 Geschätzte Zeit je Karte — Karte (D0002) und Aufgabenfenster (D0003), rein informativ.
// ADR-0023: Anzeige h:mm nur wenn gesetzt; eigenes `<span>` in `.r3 .rechts` unmittelbar nach Σ; Feldzeile nur lesend.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, kontrastAm, thema } = require('./hilfen');

const ZEIT_46 = '```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 09:46 · st\n```\n';
const aufgabeMd = (nr, titel, kopf = '', rumpf = '') => `---\nid: ${nr}\ntitle: ${titel}\n${kopf}---\n${rumpf}`;
const fabrik = (einsKopf = '', einsRumpf = '') => ({
  'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #1\n- #4\n\n## In Arbeit\n\n## Fertig\n',
  'aufgaben/0001-eins.md': aufgabeMd(1, 'eins', einsKopf, einsRumpf),
  'aufgaben/0004-vier.md': aufgabeMd(4, 'vier'),
});

/** Was ein Screenreader am Element liest: Text aller Knoten außerhalb von aria-hidden. */
const vorgelesen = el => el.evaluate(knoten => {
  const texte = [];
  const gehen = k => {
    if (k.nodeType === 3) { texte.push(k.textContent); return; }
    if (k.getAttribute && k.getAttribute('aria-hidden') === 'true') return;
    k.childNodes.forEach(gehen);
  };
  gehen(knoten);
  return texte.join('');
});

test.describe('R00129 Karte', () => {
  let k;
  test.afterEach(() => k.stoppen());

  async function board(page, dateien) {
    k = await kanbanStarten(einrichten(dateien));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await expect(page.locator('.ka[data-id="1"]')).toBeVisible();
  }

  test('US-4: Form, Ort und Name — sichtbar „≈ 2:30“ (aria-hidden) unmittelbar nach Σ, Name „Geschätzt 2:30“, kein Bedienziel, Datei byte-gleich', async ({ page }) => {
    await board(page, fabrik('estimate: 150\n', ZEIT_46));
    const vorher = k.lies('aufgaben/0001-eins.md');
    const karte = page.locator('.ka[data-id="1"]');
    await expect(karte.locator('.r3 .sum')).toHaveText('Σ 0:46');
    const schaetzung = karte.locator('.r3 .schaetzung');
    await expect(schaetzung).toHaveCount(1);
    await expect(schaetzung.locator('[aria-hidden="true"]')).toHaveText('≈ 2:30');
    await expect(schaetzung.locator('.vh')).toHaveText('Geschätzt 2:30');
    expect(await vorgelesen(schaetzung)).toBe('Geschätzt 2:30');
    for (const attribut of ['aria-label', 'tabindex', 'role', 'data-act']) {
      expect(await schaetzung.getAttribute(attribut), attribut).toBeNull();
    }
    // unmittelbar nach dem Element .sum
    expect(await schaetzung.evaluate(el => el.previousElementSibling && el.previousElementSibling.classList.contains('sum'))).toBe(true);
    expect(await karte.locator('.r3 .rechts .sum + .schaetzung').count()).toBe(1);
    // Leerfall: #4 ohne Schätzung trägt kein Element, ihr Markup ist wie heute
    await expect(page.locator('.ka[data-id="4"] .schaetzung')).toHaveCount(0);
    expect(k.lies('aufgaben/0001-eins.md')).toBe(vorher);
  });

  test('US-4/AK Grenzwerte: 5 → ≈ 0:05, 1 → ≈ 0:01, 100000 → ≈ 1666:40 mit dem Namen', async ({ page }) => {
    for (const [minuten, sichtbar] of [[5, '≈ 0:05'], [1, '≈ 0:01'], [100000, '≈ 1666:40']]) {
      await k?.stoppen();
      await board(page, fabrik(`estimate: ${minuten}\n`));
      const schaetzung = page.locator('.ka[data-id="1"] .r3 .schaetzung');
      await expect(schaetzung.locator('[aria-hidden="true"]'), `${minuten}`).toHaveText(sichtbar);
      await expect(schaetzung.locator('.vh')).toHaveText(`Geschätzt ${sichtbar.slice(2)}`);
    }
  });

  test('US-4: kein neues Ziel — das Element ist kein Fokuspunkt und trägt keine Rolle', async ({ page }) => {
    await board(page, fabrik('estimate: 150\n'));
    const schaetzung = page.locator('.ka[data-id="1"] .r3 .schaetzung');
    await page.locator('.ka[data-id="1"]').focus();
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const aufSchaetzung = await page.evaluate(() => document.activeElement?.classList.contains('schaetzung'));
      expect(aufSchaetzung, `Tab ${i}`).toBe(false);
    }
    expect(await schaetzung.evaluate(el => el.getAttribute('tabindex'))).toBeNull();
    expect(await schaetzung.evaluate(el => el.getAttribute('role'))).toBeNull();
    expect(await schaetzung.evaluate(el => el.getAttribute('data-act'))).toBeNull();
  });

  test('US-4: Zusehen zeichnet nicht neu (kein zweiter Takt für die Anzeige)', async ({ page }) => {
    k = await kanbanStarten(einrichten(fabrik('estimate: 150\n', ZEIT_46)), { KANBAND_HERZSCHLAG_MS: '200' });
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await expect(page.locator('.ka[data-id="1"] .r3 .schaetzung')).toBeVisible();
    await page.waitForTimeout(500);
    const vorher = await page.evaluate(() => window.kdTest.renders());
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.kdTest.renders())).toBe(vorher);
  });

  test('Leerfall: ohne Schätzung kein Element, das Markup bleibt wie heute', async ({ page }) => {
    await board(page, fabrik());
    await expect(page.locator('.ka .schaetzung')).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"] .r3 .rechts')).not.toContainText('≈');
  });
});

test.describe('R00129 Aufgabenfenster', () => {
  let k;
  test.afterEach(() => k.stoppen());

  async function fenster(page, einsKopf) {
    k = await kanbanStarten(einrichten(fabrik(einsKopf)));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await page.locator('.ka[data-id="1"]').click();
    const dialog = page.getByRole('dialog', { name: 'Aufgabe #1' });
    await expect(dialog).toBeVisible();
    return dialog;
  }

  test('US-5: Feldzeile nach ADR-0013 N1 — „Geschätzt“ in .k, Schlüssel estimate in .sl außerhalb .k, Wert 2:30 in .w.mono, nur lesend', async ({ page }) => {
    const dialog = await fenster(page, 'estimate: 150\n');
    const datei = k.lies('aufgaben/0001-eins.md'), commits = k.git('rev-list', '--count', 'HEAD');
    const zeile = dialog.locator('.felder .kb', { has: page.locator('.k', { hasText: 'Geschätzt' }) });
    await expect(zeile.locator('.k')).toHaveText('Geschätzt');
    await expect(zeile.locator('.sl')).toHaveText('estimate');
    // der Schlüssel liegt außerhalb von .k
    expect(await zeile.locator('.sl').evaluate(el => el.closest('.k') === null)).toBe(true);
    const wert = zeile.locator('xpath=following-sibling::*[1]');
    await expect(wert).toHaveText('2:30');
    expect(await wert.evaluate(el => el.classList.contains('w') && el.classList.contains('mono')), '.w.mono').toBe(true);
    expect(await wert.locator('input, select, textarea').count()).toBe(0);
    expect(await wert.locator('[data-af], [data-nf]').count()).toBe(0);
    expect(k.lies('aufgaben/0001-eins.md')).toBe(datei);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  });

  test('US-5: ohne Schätzung fehlt die Feldzeile ganz', async ({ page }) => {
    const dialog = await fenster(page, '');
    await expect(dialog.locator('.felder .k', { hasText: 'Geschätzt' })).toHaveCount(0);
  });

  test('US-5 Gegenbeispiel: kein Bericht nennt die geschätzte Zeit; Board- und Aufgabendatei bleiben byte-gleich', async ({ page }) => {
    await fenster(page, 'estimate: 150\n');
    const boardDatei = k.lies('boards/fabrik.md'), aufgabeDatei = k.lies('aufgaben/0001-eins.md'), commits = k.git('rev-list', '--count', 'HEAD');
    await page.keyboard.press('Escape');
    for (const name of ['Burndown', 'Wie lange noch', 'Kosten', 'Zeiten nach Aufgabe und Person']) {
      await page.locator('#t-ber').click();
      await page.getByRole('menuitem', { name: new RegExp('^' + name) }).click();
      await expect(page.locator('.ka')).toHaveCount(0); // die Berichtsansicht hat das Board verlassen
      const text = await page.locator('#main').innerText();
      expect(text, name).not.toContain('Geschätzt');
      expect(text, name).not.toContain('2:30');
    }
    expect(k.lies('boards/fabrik.md')).toBe(boardDatei);
    expect(k.lies('aufgaben/0001-eins.md')).toBe(aufgabeDatei);
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(commits);
  });
});

test.describe('R00129 Breite und Kontrast', () => {
  let k;
  test.afterEach(() => k.stoppen());

  const VOLL = 'cost:\n  currency: USD\n  amount: 1.63\n' + 'estimate: 150\n' + `due: 2026-12-24\norigins: [I0001]\nassignees: [st, cl]\n`;

  test('US-6: die volle untere Zeile bricht um und bleibt in der Spalte, 236 und 272 px, 320/375/414 px', async ({ page }) => {
    k = await kanbanStarten(einrichten(fabrik(VOLL, ZEIT_46)));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    const bahn = page.locator('.bahn').first();
    for (const spaltenbreite of [236, 272]) {
      for (const breite of [320, 375, 414]) {
        await page.setViewportSize({ width: breite, height: 800 });
        await bahn.evaluate((el, w) => el.style.setProperty('--bw', w + 'px'), spaltenbreite);
        await page.evaluate(() => new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f))));
        const masse = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
        expect(masse.sw, `${spaltenbreite}/${breite}: kein Querscrollen`).toBeLessThanOrEqual(masse.cw);
        const karte = await page.locator('.ka[data-id="1"]').evaluate(el => {
          const ka = el.getBoundingClientRect(), flaeche = el.closest('.flaeche').getBoundingClientRect();
          const rechts = el.querySelector('.r3 .rechts');
          return { imRechteck: ka.right <= flaeche.right + 0.5 && ka.left >= flaeche.left - 0.5, rechtsPasst: rechts.scrollWidth <= rechts.clientWidth + 1 };
        });
        expect(karte.imRechteck, `${spaltenbreite}/${breite}: Karte in der Spalte`).toBe(true);
        expect(karte.rechtsPasst, `${spaltenbreite}/${breite}: .rechts ohne Überlauf`).toBe(true);
        await expect(page.locator('.ka[data-id="1"] .r3 .rechts .sum + .schaetzung')).toHaveCount(1);
      }
    }
  });

  test('US-6/AK Kontrast: sichtbarer Wert hell und dunkel ≥ 4,5:1, auf data-eigen --kd-text', async ({ page }) => {
    const kopf = '---\npeople:\n  st: {name: Stefan, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  eigen: {label: Eigen, color: "#f5e6a0"}\n---\n';
    const dateien = { ...fabrik('class: eigen\n' + VOLL, ZEIT_46), 'kanbanD.md': kopf };
    dateien['aufgaben/0004-vier.md'] = aufgabeMd(4, 'vier', 'estimate: 150\n');
    k = await kanbanStarten(einrichten(dateien));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    const eigen = page.locator('.ka[data-id="1"] .r3 .schaetzung [aria-hidden="true"]');
    const normal = page.locator('.ka[data-id="4"] .r3 .schaetzung [aria-hidden="true"]');
    await expect(eigen).toBeVisible();
    await expect(normal).toBeVisible();
    // eigene Klassenfarbe → data-eigen, sichtbarer Wert trägt --kd-text
    await expect(page.locator('.ka[data-id="1"]')).toHaveAttribute('data-eigen', '');
    await expect(page.locator('.ka[data-id="4"]')).not.toHaveAttribute('data-eigen', '');
    const farbe = await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--kd-text)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
    expect(await eigen.evaluate(el => getComputedStyle(el).color)).toBe(farbe);
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      expect(await kontrastAm(normal), `${t} Normalgrund`).toBeGreaterThanOrEqual(4.5);
      expect(await kontrastAm(eigen), `${t} eigene Klassenfarbe`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
