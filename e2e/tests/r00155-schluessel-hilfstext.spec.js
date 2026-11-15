// R00155 Mitglied #87 (Karte #54, I0142 B0729): „Schlüssel“, „Signale“ und „Zählt in Berichten“ nennen in den Details den
// Schlüssel der Datei — `key`, `signals`, `reporting` — als Mono-Hilfstext in eigenem Element unter der Beschriftung
// (Muster aus R00109, ADR-0013 N1). Kriterien 87-1 bis 87-5; US-8.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, reiter, thema, breiteSetzen, mutanteEinsetzen } = require('./hilfen');

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  bot: {name: Bot, kind: agent}
classes: {}
signals:
  mail: {label: Neue E-Mail, color: blue}
---
`;
const GRUND = {
  'kanbanD.md': EINSTELLUNGEN,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## Erledigt\n',
};
/** Die drei Felder dieser Karte: Beschriftung → Schlüssel der Datei (Betreiber 2026-11-13: nur diese drei). */
const DREI = [['Schlüssel', 'key'], ['Signale', 'signals'], ['Zählt in Berichten', 'reporting']];

/** Je Feldzeile der Details: Beschriftung, Schlüssel-Element (Text, Schrift, Farbe, ob es in `.k` steht), Zeilenhöhe, Überlauf. */
const zeilenMessen = fenster => fenster.evaluate(wurzel => [...wurzel.querySelectorAll('.felder-details > .k, .felder-details > .kb')].map(kopf => {
  const beschriftung = kopf.matches('.k') ? kopf : kopf.querySelector(':scope > .k');
  const sl = kopf.querySelector(':scope > .sl');
  const stil = sl && getComputedStyle(sl);
  const wert = kopf.nextElementSibling;
  return {
    beschriftung: beschriftung.textContent.trim(),
    schluessel: sl && { text: sl.textContent.trim(), familie: stil.fontFamily, groesse: stil.fontSize, hoehe: stil.lineHeight, farbe: stil.color, inK: sl.closest('.k') !== null },
    zeilenhoehe: kopf.getBoundingClientRect().height,
    ueberlauf: Math.max(kopf.scrollWidth - kopf.clientWidth, wert.scrollWidth - wert.clientWidth),
  };
}));
const tokenFarbe = (page, token) => page.evaluate(w => {
  const p = document.createElement('p'); p.style.color = `var(${w})`; document.body.append(p);
  const c = getComputedStyle(p).color; p.remove(); return c;
}, token);

test.describe('R00155 #87: Schlüssel als Hilfstext für drei Felder', () => {
  let k;
  test.afterEach(() => k?.stoppen());

  /** Grundbestand 87-1: Aufgabe über die API mit `key: ticket-17` angelegt, ein Signal eingerichtet; Details geöffnet. */
  async function details(page, breite) {
    k = await kanbanStarten(einrichten(GRUND));
    await mutanteEinsetzen(page);
    await alsPerson(page, 'st');
    const angelegt = await page.request.post(k.adresse + 'api/aufgaben', { headers: { 'X-KanbanD-Wer': 'bot' }, data: { titel: 'Ticket übernehmen', board: 'entwicklung', key: 'ticket-17' } });
    expect(angelegt.status(), await angelegt.text()).toBe(201);
    expect(k.lies('aufgaben/0001-ticket-uebernehmen.md')).toContain('key: ticket-17');
    await page.goto(k.adresse + '#/board/entwicklung');
    if (breite) await breiteSetzen(page, breite);
    await page.locator('.ka[data-id="1"]').click();
    const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
    await expect(fenster).toBeVisible();
    await reiter(page, 'Details');
    await expect(fenster.locator('#schluessel')).toHaveText('ticket-17');
    return fenster;
  }

  test('87-1/US-8: unter „Schlüssel“ steht key, unter „Signale“ signals, unter „Zählt in Berichten“ reporting — eigenes Element außerhalb der Beschriftung, Mono 10,5/14 in --kd-muted', async ({ page }) => {
    const fenster = await details(page);
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      const muted = await tokenFarbe(page, '--kd-muted');
      const zeilen = await zeilenMessen(fenster);
      for (const [beschriftung, schluessel] of DREI) {
        const zeile = zeilen.find(z => z.beschriftung === beschriftung);
        expect(zeile, `${t}: Zeile „${beschriftung}“ (87-2: Beschriftung unverändert)`).toBeTruthy();
        expect(zeile.schluessel, `${t} „${beschriftung}“: Hilfstext in eigenem Element`).not.toBeNull();
        expect(zeile.schluessel.text, `${t} „${beschriftung}“`).toBe(schluessel);
        expect(zeile.schluessel.inK, `${t} „${beschriftung}“: der Schlüssel steht nicht in der Beschriftung`).toBe(false);
        expect(zeile.schluessel.familie, `${t} „${beschriftung}“: Plex Mono`).toContain('IBM Plex Mono');
        expect(zeile.schluessel.groesse, `${t} „${beschriftung}“: 10,5 px`).toBe('10.5px');
        expect(zeile.schluessel.hoehe, `${t} „${beschriftung}“: 14 px`).toBe('14px');
        expect(zeile.schluessel.farbe, `${t} „${beschriftung}“: --kd-muted`).toBe(muted);
      }
    }
  });

  test('87-2: die Gruppen heißen weiter „Signale“ und „Zählt in Berichten“ — der Schlüssel ist nicht Teil des Namens', async ({ page }) => {
    const fenster = await details(page);
    await expect(fenster.getByRole('group', { name: 'Signale', exact: true })).toHaveCount(1);
    await expect(fenster.getByRole('group', { name: 'Zählt in Berichten', exact: true })).toHaveCount(1);
    await expect(fenster.locator('#signale')).toHaveAttribute('aria-label', 'Signale');
    await expect(fenster.locator('#zaehlung')).toHaveAttribute('aria-label', 'Zählt in Berichten');
    // der Wert des Fremdschlüssels bleibt, was er war
    await expect(fenster.locator('#schluessel')).toHaveText('ticket-17');
  });

  test('87-3/US-8: bei 320 px scrollt in den Details nichts quer (Fenster und jede Feldzeile), hell und dunkel; die drei Zeilen sind mindestens 38 px hoch', async ({ page }) => {
    const fenster = await details(page, 320);
    for (const t of ['light', 'dark']) {
      await thema(page, t);
      await expect(fenster.locator('.felder-details .sl', { hasText: /^reporting$/ })).toBeVisible();
      const quer = await page.evaluate(() => {
        const ueber = el => el.scrollWidth - el.clientWidth;
        return { seite: ueber(document.documentElement), fenster: ueber(document.querySelector('#fenster')), inhalt: ueber(document.querySelector('#fenster .mod-body')) };
      });
      expect(quer, `${t}: nichts scrollt quer`).toEqual({ seite: 0, fenster: 0, inhalt: 0 });
      const zeilen = await zeilenMessen(fenster);
      expect(zeilen.filter(z => z.ueberlauf > 0).map(z => z.beschriftung), `${t}: Feldzeilen mit Überlauf`).toEqual([]);
      for (const [beschriftung] of DREI) {
        const zeile = zeilen.find(z => z.beschriftung === beschriftung);
        expect(zeile.zeilenhoehe, `${t} „${beschriftung}“: mindestens 38 px wie die übrigen Zeilen mit Schlüssel`).toBeGreaterThanOrEqual(38);
      }
    }
  });

  test('87-5: keine der drei Beschriftungen steht mehr als nacktes .k in den Details — alle drei zeichnen über die eine Beschriftungsfunktion', async ({ page }) => {
    const fenster = await details(page);
    for (const [beschriftung, schluessel] of DREI) {
      await expect(fenster.locator('.felder-details > .k', { hasText: beschriftung }), `nackt: ${beschriftung}`).toHaveCount(0);
      const rahmen = fenster.locator('.felder-details > .kb', { has: page.locator(':scope > .k', { hasText: new RegExp(`^${beschriftung}$`) }) });
      await expect(rahmen, beschriftung).toHaveCount(1);
      await expect(rahmen.locator(':scope > .sl'), beschriftung).toHaveText(schluessel);
    }
  });
});
