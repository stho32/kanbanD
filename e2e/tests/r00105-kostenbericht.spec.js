// E2E R00105 Kostenbericht (I0094): Summe niedrig–hoch je Währung über alle Spalten und das Archiv, nur lesend
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');

const NBSP = ' ';
const SPANNE = 'cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n';
const BETRAG = 'cost:\n  currency: USD\n  amount: 1.63\n';
const aufgabeMd = (nr, titel, kopf = '') => `---\nid: ${nr}\ntitle: ${titel}\n${kopf}---\n`;
const boardMd = spalten => '# fabrik\n\n' + Object.entries(spalten).map(([name, nrn]) => `## ${name}\n\n${nrn.map(n => `- #${n}\n`).join('')}`).join('\n');

/** Grundbestand aus R00105: #1 Eingang 0,60–1,60 USD, #2 In Arbeit 1,63 USD, #3 Fertig und #4 Eingang ohne Etikett. */
function grundbestand(extra = {}, spalten = {}) {
  return {
    'boards/fabrik.md': boardMd({ Eingang: [1, 4, ...(spalten.Eingang || [])], 'In Arbeit': [2], Fertig: [3, ...(spalten.Fertig || [])] }),
    'aufgaben/0001-eins.md': aufgabeMd(1, 'eins', SPANNE),
    'aufgaben/0002-zwei.md': aufgabeMd(2, 'zwei', BETRAG),
    'aufgaben/0003-drei.md': aufgabeMd(3, 'drei'),
    'aufgaben/0004-vier.md': aufgabeMd(4, 'vier'),
    ...extra,
  };
}
/** Bestand aus US-10: #5 archiviert aus Fertig, #6 archiviert aus Eingang (verworfen), #9 auf keinem Board. */
const ARCHIV = {
  'aufgaben/0005-fuenf.md': aufgabeMd(5, 'fünf', 'archived: 2026-10-01\ncost:\n  currency: USD\n  amount: 0.50\n'),
  'aufgaben/0006-sechs.md': aufgabeMd(6, 'sechs', 'archived: 2026-10-01\ncost:\n  currency: USD\n  min: 0.10\n  max: 0.30\n'),
  'aufgaben/0009-ohne-board.md': aufgabeMd(9, 'ohne Board', 'cost:\n  currency: USD\n  amount: 5.00\n'),
};
const ARCHIV_SPALTEN = { Eingang: [6], Fertig: [5] };

const zeilen = page => page.locator('#kosten .kost-zeile');

test.describe('R00105 Kostenbericht', () => {
  let k;
  test.afterEach(() => k.stoppen());

  async function bericht(page, dateien) {
    k = await kanbanStarten(einrichten(dateien));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /^Kosten/ }).click();
    await expect(page.locator('#kosten')).toBeVisible();
  }

  test('US-9: Menüeintrag in BESTAND, Route, Kopfleiste, Summe ohne ≈, Fenstertitel, live nach PATCH', async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.locator('#t-ber').click();
    const menue = page.getByRole('menu', { name: 'Berichte' });
    const gruppen = await menue.evaluate(m => [...m.children].map(e => (e.classList.contains('k') ? `[${e.textContent}]` : e.querySelector('b').textContent)));
    expect(gruppen.slice(gruppen.indexOf('[BESTAND]'), gruppen.indexOf('[AUSLEITEN]'))).toEqual(['[BESTAND]', 'Kosten']);
    const eintrag = menue.getByRole('menuitem', { name: /^Kosten/ });
    await expect(eintrag.locator('small')).toHaveText('Geschätzte API-Kosten je Währung – alle Spalten, auch archivierte Aufgaben.');
    await expect(eintrag.locator('svg.i')).toHaveCount(1);
    await expect(eintrag).toHaveAttribute('href', '#/berichte/kosten');
    await eintrag.click();
    await expect(page).toHaveURL(/#\/berichte\/kosten$/);
    await expect(page).toHaveTitle('Kosten — kanbanD');
    await expect(page.locator('#main .leiste').first()).toHaveText('Kosten · geschätzte API-Kosten · liest nur');
    await expect(zeilen(page)).toHaveText([`Summe 2,23–3,23${NBSP}$ · 2 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte`]);
    await expect(page.locator('#kosten')).not.toContainText('≈');
    const vorher = Number(k.git('rev-list', '--count', 'HEAD'));
    expect((await page.request.patch(`${k.adresse}api/aufgaben/4`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { cost: { currency: 'USD', amount: 1.00 } } })).ok()).toBe(true);
    await expect(zeilen(page)).toHaveText([`Summe 3,23–4,23${NBSP}$ · 3 von 4 Aufgaben mit Etikett, alle Spalten, auch archivierte`], { timeout: 1000 });
    expect(Number(k.git('rev-list', '--count', 'HEAD')), 'nur der Commit des PATCH').toBe(vorher + 1);
  });

  test('US-10: Fertige, archivierte und verworfene Aufgaben zählen mit, eine Aufgabe ohne Board nicht', async ({ page }) => {
    await bericht(page, grundbestand(ARCHIV, ARCHIV_SPALTEN));
    await expect(zeilen(page)).toHaveText([`Summe 2,83–4,03${NBSP}$ · 4 von 6 Aufgaben mit Etikett, alle Spalten, auch archivierte`]);
  });

  test('US-11: je Währung eine Zeile, USD zuerst, dann nach ISO-Code, ohne Umrechnung', async ({ page }) => {
    const mehr = {
      ...ARCHIV,
      'aufgaben/0007-sieben.md': aufgabeMd(7, 'sieben', 'cost:\n  currency: EUR\n  amount: 25.55\n'),
      'aufgaben/0008-acht.md': aufgabeMd(8, 'acht', 'cost:\n  currency: CHF\n  amount: 2.00\n'),
    };
    await bericht(page, grundbestand(mehr, { Eingang: [6, 7, 8], Fertig: [5] }));
    await expect(zeilen(page)).toHaveText([
      `Summe 2,83–4,03${NBSP}$ · 4 von 8 Aufgaben mit Etikett, alle Spalten, auch archivierte`,
      `Summe 2,00${NBSP}CHF · 1 von 8 Aufgaben mit Etikett, alle Spalten, auch archivierte`,
      `Summe 25,55${NBSP}€ · 1 von 8 Aufgaben mit Etikett, alle Spalten, auch archivierte`,
    ]);
  });

  test('US-14: ohne Etikett Leerzustand mit Hinweis und Link auf die API im neuen Tab, ohne Zurücksetzen, ohne Commit', async ({ page, context }) => {
    k = await kanbanStarten(einrichten({ ...grundbestand(), 'aufgaben/0001-eins.md': aufgabeMd(1, 'eins'), 'aufgaben/0002-zwei.md': aufgabeMd(2, 'zwei') }));
    const vorher = k.git('rev-list', '--count', 'HEAD');
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    await liveBereit(page);
    await page.goto(k.adresse + '#/berichte/kosten');
    const leer = page.locator('#kosten .kost-leer');
    await expect(leer.locator('.kost-satz')).toHaveText('Keine Aufgabe mit Preisetikett · 0 von 4 Aufgaben, alle Spalten, auch archivierte');
    await expect(leer.locator('.kost-hinweis').first()).toHaveText('Preisetiketten setzt ein Agent über die API (Feld cost beim Ändern einer Aufgabe).');
    await expect(leer.locator('.kost-hinweis code')).toHaveText('cost');
    await expect(zeilen(page)).toHaveCount(0);
    const link = leer.getByRole('link', { name: 'API für Agenten' });
    await expect(link).toHaveAttribute('href', '/api');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener');
    await expect(page.getByRole('button', { name: /Zurücksetzen/ })).toHaveCount(0);
    const [zweiter] = await Promise.all([context.waitForEvent('page'), link.click()]);
    await zweiter.waitForLoadState();
    expect(new URL(zweiter.url()).pathname).toBe('/api');
    await expect(page).toHaveURL(/#\/berichte\/kosten$/);
    await expect(leer.locator('.kost-satz')).toBeVisible();
    expect(k.git('rev-list', '--count', 'HEAD')).toBe(vorher);
  });

  test('US-14: Board ohne Aufgaben → 0 von 0 mit Hinweis', async ({ page }) => {
    await bericht(page, { 'boards/fabrik.md': boardMd({ Eingang: [], 'In Arbeit': [], Fertig: [] }) });
    await expect(page.locator('#kosten .kost-satz')).toHaveText('Keine Aufgabe mit Preisetikett · 0 von 0 Aufgaben, alle Spalten, auch archivierte');
    await expect(page.locator('#kosten').getByRole('link', { name: 'API für Agenten' })).toBeVisible();
  });
});
