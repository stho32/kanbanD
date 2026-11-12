// R00141 Aufgabe endgültig löschen (I0129, #36, ADR-0024); Artboard D0003 #endgueltig-loeschen (PO-freigegeben).
// Der Server-Teil ist in tests/aufgabe_loeschen.rs geprüft; die Rückfrage ist die geteilte alertdialog-Komponente aus R00128.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, thema } = require('./hilfen');

const grundbestand = (zusatz = {}) => ({
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\n---\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\n---\n',
  ...zusatz,
});

const RUMPF1 = 'Aufgabe #1 „eins“ wird endgültig gelöscht: ihre Datei, ihre Zeile in allen Boards und ihre Anhänge verschwinden. Das ist nicht rückgängig zu machen; wiederherstellbar nur über die Git-Geschichte.';

const status = page => page.locator('.toast[role="status"]');
const dialog = page => page.getByRole('alertdialog');
const commits = k => +k.git('rev-list', '--count', 'HEAD');

test.describe('R00141 Aufgabe endgültig löschen', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
  });
  test.afterEach(() => k.stoppen());

  const oeffneMenue = async (page, nr) => {
    await page.locator(`.ka[data-id="${nr}"]`).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Endgültig löschen' }).click();
  };
  const oeffneFenster = async (page, nr) => {
    await page.locator(`.ka[data-id="${nr}"]`).click();
    await expect(page.locator('#fenster')).toBeVisible();
  };
  const bestaetigen = async (page, nr) => {
    await dialog(page).getByRole('button', { name: 'endgültig löschen' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(status(page)).toContainText(`#${nr} endgültig gelöscht`);
  };
  const loeschen = async (page, nr) => {
    await oeffneMenue(page, nr);
    await bestaetigen(page, nr);
  };

  test('US-1/AK9: Rückfrage aus dem Kartenmenü — Wortlaut, Tastatur, ein Commit', async ({ page }) => {
    await oeffneMenue(page, 1);
    const d = dialog(page);
    await expect(d).toHaveAccessibleName('#1 eins endgültig löschen');
    await expect(d).toHaveAttribute('aria-modal', 'true');
    await expect(d.getByRole('button')).toHaveCount(2, 'höchstens zwei Aktionen');
    await expect(d.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    await expect(d).toContainText(RUMPF1);
    // Esc ist Abbrechen: Fokus an den Auslöser, nichts geändert
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('.ka[data-id="1"]')).toBeFocused();
    expect(k.lies('aufgaben/0001-eins.md')).toContain('id: 1');
    // bestätigen: Karte weg, Datei weg, ein Commit
    const vorher = commits(k);
    await loeschen(page, 1);
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(0);
    expect(() => k.lies('aufgaben/0001-eins.md')).toThrow();
    expect(k.lies('boards/entwicklung.md')).not.toContain('#1]');
    expect(commits(k)).toBe(vorher + 1);
  });

  test('US-2/AK9: Abbrechen über den Knopf ändert nichts', async ({ page }) => {
    const vorher = commits(k);
    await oeffneMenue(page, 2);
    await dialog(page).getByRole('button', { name: 'Abbrechen' }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(page.locator('.ka[data-id="2"]')).toBeFocused();
    expect(k.lies('aufgaben/0002-zwei.md')).toContain('id: 2');
    expect(commits(k)).toBe(vorher);
  });

  test('US-3/AK10: Rückfrage aus dem Aufgabenfenster — Fenster schließt, #1 überall weg', async ({ page }) => {
    await oeffneFenster(page, 1);
    // bei 320/375/414 px kein Querscrollen, Startfokus Abbrechen, Esc zurück an den Auslöser (Fenster bleibt offen)
    for (const breite of [320, 375, 414]) {
      await page.setViewportSize({ width: breite, height: 760 });
      await page.locator('#fenster').getByRole('button', { name: 'Endgültig löschen' }).click();
      const d = dialog(page);
      await expect(d.getByRole('button', { name: 'Abbrechen' })).toBeFocused();
      const quer = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(quer, `Querscrollen bei ${breite}px`).toBeLessThanOrEqual(1);
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toHaveCount(0);
      await expect(page.locator('#fenster')).toBeVisible();
      await expect(page.locator('#fenster').getByRole('button', { name: 'Endgültig löschen' })).toBeFocused();
    }
    const vorher = commits(k);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.locator('#fenster').getByRole('button', { name: 'Endgültig löschen' }).click();
    await bestaetigen(page, 1);
    await expect(page.locator('#fenster')).toHaveCount(0, 'das Fenster schließt');
    const rolle = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(rolle).not.toBe('BODY');
    expect(() => k.lies('aufgaben/0001-eins.md')).toThrow();
    expect(commits(k)).toBe(vorher + 1);
  });

  test('US-9/AK12: Fokus nach dem Verschwinden nie BODY (Menü → nächste Karte)', async ({ page }) => {
    await loeschen(page, 1);
    await expect(page.locator('.ka[data-id="2"]')).toBeFocused();
    const rolle = await page.evaluate(() => document.activeElement && document.activeElement.tagName);
    expect(rolle).not.toBe('BODY');
  });

  test('US-10/AK13: kein Undo — kein „rückgängig“, Strg+Z greift nicht', async ({ page }) => {
    await loeschen(page, 1);
    await expect(status(page).getByRole('button', { name: /rückgängig/i })).toHaveCount(0);
    const nachher = commits(k);
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(300);
    await expect(page.locator('.ka[data-id="1"]')).toHaveCount(0, 'Strg+Z holt die Karte nicht zurück');
    expect(commits(k)).toBe(nachher);
    expect(() => k.lies('aufgaben/0001-eins.md')).toThrow();
  });

  test('US-11/AK14: geteilte Komponente, Warn-Absetzung, „Git-Geschichte“', async ({ page }) => {
    // derselbe Dialog wie beim Board (R00128): id al-dialog, role alertdialog, aria-labelledby al-titel
    await oeffneMenue(page, 1);
    const d = dialog(page);
    await expect(d).toHaveAttribute('id', 'al-dialog');
    await expect(d.locator('#al-text')).toContainText('Git-Geschichte');
    await expect(d).not.toContainText('Git-Historie');
    await page.keyboard.press('Escape');
    // der Menüeintrag ist in --kd-warn abgesetzt und ohne Hover erreichbar (auch Touch)
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    const eintrag = page.getByRole('menuitem', { name: 'Endgültig löschen' });
    await expect(eintrag).toBeVisible();
    const farbe = await eintrag.evaluate(el => getComputedStyle(el).color);
    const warn = await page.evaluate(() => { const s = getComputedStyle(document.documentElement).getPropertyValue('--kd-warn').trim(); const d = document.createElement('span'); d.style.color = s; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
    expect(farbe).toBe(warn);
    await expect(page.getByRole('menuitem', { name: 'Umbenennen' })).toHaveCount(1, 'Umbenennen bleibt in der vorderen Gruppe');
  });

  test('US-3/D0003: Kopf-Auslöser beschriftet, per aria-hidden-Trenner abgesetzt, in --kd-warn (1280/414/320, hell/dunkel)', async ({ page }) => {
    // Artboard D0003 #endgueltig-loeschen + PO #36 (Z. 196): beschriftet (Symbol + Text, `.btn`), 1-px-`.el-trenner`
    // vor „Archivieren“ abgesetzt, Warnfarbe `--kd-warn`, Titel nennt die Wirkung.
    await oeffneFenster(page, 1);
    const knopf = page.locator('#fenster [data-act="endgueltig-loeschen"]');
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      const warn = await page.evaluate(() => { const d = document.createElement('span'); d.style.color = 'var(--kd-warn)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c; });
      for (const breite of [1280, 414, 320]) {
        await page.setViewportSize({ width: breite, height: 800 });
        await expect(knopf, `${breite}/${t}: sichtbar`).toBeVisible();
        await expect(knopf, `${breite}/${t}: beschriftet`).toContainText('Endgültig löschen');
        expect(await knopf.evaluate(el => getComputedStyle(el).color), `${breite}/${t}: --kd-warn`).toBe(warn);
        const trenner = await knopf.evaluate(el => { const v = el.previousElementSibling; return v && { klasse: v.classList.contains('el-trenner'), aria: v.getAttribute('aria-hidden'), breite: parseFloat(getComputedStyle(v).width), sichtbar: v.getClientRects().length > 0 }; });
        expect(trenner, `${breite}/${t}: Trenner`).toBeTruthy();
        expect(trenner.klasse && trenner.aria === 'true' && trenner.breite === 1 && trenner.sichtbar, `${breite}/${t}: 1-px-Trenner aria-hidden unmittelbar davor`).toBe(true);
      }
    }
  });
});

test.describe('R00141 Fehlerpfad', () => {
  let k;
  test.afterEach(() => k && k.stoppen());

  test('US-8/AK11: 423 bleibt als role=alert im Dialog, nichts geändert', async ({ page }) => {
    // Agent + defektes Board im Ordner → der Server weist den Agenten mit 423 ab
    k = await kanbanStarten(einrichten(grundbestand({ 'boards/kaputt.md': '---\nstart: kaputt\n---\n\n# Kaputt\n\n## Eingang\n' })));
    await alsPerson(page, 'cl');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
    const vorher = commits(k);
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Endgültig löschen' }).click();
    await dialog(page).getByRole('button', { name: 'endgültig löschen' }).click();
    await expect(dialog(page).getByRole('alert')).toBeVisible();
    await expect(dialog(page)).toContainText('nur lesbar');
    await expect(status(page)).toHaveCount(0, 'keine Erfolgsmeldung vor der Antwort');
    await expect(dialog(page).getByRole('button', { name: 'Abbrechen' })).toBeFocused();
    expect(k.lies('aufgaben/0001-eins.md')).toContain('id: 1');
    expect(commits(k)).toBe(vorher);
  });

  test('US-8/AK11: Netzfehler bleibt als role=alert im Dialog', async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/entwicklung');
    await liveBereit(page);
    const vorher = commits(k);
    await page.route('**/api/aufgaben/1', route => route.abort());
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Endgültig löschen' }).click();
    await dialog(page).getByRole('button', { name: 'endgültig löschen' }).click();
    await expect(dialog(page).getByRole('alert')).toBeVisible();
    await expect(dialog(page).getByRole('alert')).toHaveText('Keine Verbindung zum Server — nichts geändert.');
    await expect(dialog(page)).not.toContainText('Failed to fetch');
    expect(k.lies('aufgaben/0001-eins.md')).toContain('id: 1');
    expect(commits(k)).toBe(vorher);
  });
});
