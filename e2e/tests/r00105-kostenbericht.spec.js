// E2E R00105 Kostenbericht (I0094): Summe niedrig–hoch je Währung über alle Spalten und das Archiv, nur lesend
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen } = require('./hilfen');

const NBSP = ' ';
const SPANNE = 'cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n';
const BETRAG = 'cost:\n  currency: USD\n  amount: 1.63\n';
const aufgabeMd = (nr, titel, kopf = '') => `---\nid: ${nr}\ntitle: ${titel}\n${kopf}---\n`;
const boardMd = (spalten, kopf = '') => kopf + '# fabrik\n\n' + Object.entries(spalten).map(([name, nrn]) => `## ${name}\n\n${nrn.map(n => `- #${n}\n`).join('')}`).join('\n');

/** Grundbestand aus R00105: #1 Eingang 0,60–1,60 USD, #2 In Arbeit 1,63 USD, #3 Fertig und #4 Eingang ohne Etikett. */
function grundbestand(extra = {}, spalten = {}, kopf = '') {
  const pruefung = spalten.Prüfung ? { Prüfung: spalten.Prüfung } : {};
  return {
    'boards/fabrik.md': boardMd({ Eingang: [1, 4, ...(spalten.Eingang || [])], 'In Arbeit': [2], Fertig: [3, ...(spalten.Fertig || [])], ...pruefung }, kopf),
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
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /^Kosten/ }).click();
    await expect(page.locator('#kosten')).toBeVisible();
  }

  test('US-9: Menüeintrag in BESTAND, Route, Kopfleiste, Summe ohne ≈, Fenstertitel, live nach PATCH', async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
    await page.locator('#t-ber').click();
    const menue = page.getByRole('menu', { name: 'Berichte' });
    const gruppen = await menue.evaluate(m => [...m.children].map(e => (e.classList.contains('k') ? `[${e.textContent}]` : e.querySelector('b').textContent)));
    // AK R00105: „hinter „Bestand nach Labels“, falls R00100 gebaut ist, sonst als einziger Eintrag“ — R00100 ist gebaut.
    expect(gruppen.slice(gruppen.indexOf('[BESTAND]'), gruppen.indexOf('[AUSLEITEN]'))).toEqual(['[BESTAND]', 'Bestand nach Labels', 'Kosten']);
    const eintrag = menue.getByRole('menuitem', { name: /^Kosten/ });
    await expect(eintrag.locator('small')).toHaveText('Geschätzte API-Kosten je Währung – alle Spalten, auch archivierte Aufgaben.');
    await expect(eintrag.locator('svg.i')).toHaveCount(1);
    await expect(eintrag).toHaveAttribute('href', '#/berichte/kosten');
    await eintrag.click();
    await expect(page).toHaveURL(/#\/berichte\/kosten$/);
    await expect(page).toHaveTitle('Berichte · Kosten — kanbanD');
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
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
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

  /* ── B0374: Filterleiste ohne Zeitraum, Leerzustände mit „Zurücksetzen“ ── */
  const ALLE = 'alle Spalten, auch archivierte', NACH = 'nach Filter, auch archivierte';
  const summe = (betrag, n, m, umfang) => `Summe ${betrag}${NBSP}$ · ${n} von ${m} Aufgaben mit Etikett, ${umfang}`;
  const LETZTE_WOCHE = '---\nstart: 2026-10-01\nreport-filter: {period: vorwoche, window-days: 30}\n---\n';
  const spalte = (page, name) => page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name, exact: true });
  /**
   * Schaltet einen Spaltenfilter und wartet, bis der Knopf den neuen Zustand zeigt und der geladene Stand gezeichnet ist (ADR-0026 Regel 3).
   * `filterSchalten` aus hilfen.js taugt hier nicht: es wartet auf das Nachladen von `/api/berichte/bewegungen`, und das lädt der Kostenbericht nie.
   */
  async function spalteSchalten(page, name) {
    const knopf = spalte(page, name);
    const vorher = await knopf.getAttribute('aria-pressed');
    await knopf.click();
    await expect(knopf).not.toHaveAttribute('aria-pressed', vorher);
    await bereit(page);
  }
  const reset = page => page.locator('#kosten').getByRole('button', { name: /Zurücksetzen/ });
  const ganzImBild = async (ort, breite) => {
    const r = await ort.evaluate(e => ({ links: e.getBoundingClientRect().left, rechts: e.getBoundingClientRect().right, scroll: e.scrollWidth - e.clientWidth }));
    expect(r.links, 'links im Bild').toBeGreaterThanOrEqual(0);
    expect(r.rechts, 'rechts im Bild').toBeLessThanOrEqual(breite);
    expect(r.scroll, 'nichts abgeschnitten').toBeLessThanOrEqual(0);
  };
  const pruefsumme = text => crypto.createHash('sha256').update(text).digest('hex');
  async function kostenOeffnen(page, dateien) {
    k = await kanbanStarten(einrichten(dateien));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
    await page.goto(k.adresse + '#/berichte/kosten');
    await expect(page.locator('#kosten')).toBeVisible();
  }

  test('US-12: die Filterleiste verkleinert m; ganz leer nach Filter → Satz und „Zurücksetzen“ ohne Zahl', async ({ page }) => {
    await kostenOeffnen(page, grundbestand());
    await filterOeffnen(page);
    await spalteSchalten(page, 'Fertig');
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 3, NACH)]);
    await spalteSchalten(page, 'Fertig');
    await spalteSchalten(page, 'Eingang');
    await expect(zeilen(page)).toHaveText([summe('1,63', 1, 2, NACH)]);
    await spalteSchalten(page, 'Fertig');
    await spalteSchalten(page, 'In Arbeit');
    await expect(page.locator('#kosten .kost-satz')).toHaveText('Keine Aufgaben, die zu den Filtern der Berichte passen.');
    await expect(page.locator('#kosten .kost-hinweis')).toHaveCount(0);
    await expect(reset(page)).toHaveText('Zurücksetzen');
    await reset(page).click();
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 4, ALLE)]);
    await expect(reset(page)).toHaveCount(0);
  });

  test('Nacharbeit S2: nach „Zurücksetzen“ im Leerzustand steht der Fokus auf der Zusammenfassung der Filterleiste', async ({ page }) => {
    await kostenOeffnen(page, grundbestand());
    await filterOeffnen(page);
    for (const name of ['Eingang', 'In Arbeit', 'Fertig']) await spalteSchalten(page, name);
    await expect(reset(page)).toHaveText('Zurücksetzen');
    await reset(page).click();
    await expect(reset(page)).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => document.activeElement.matches('.bf-zusammen'))).toBe(true);
  });

  for (const route of ['prognose', 'verlauf']) {
    test(`Nacharbeit S2: nach „Zurücksetzen“ in #/berichte/${route} steht der Fokus auf der Zusammenfassung`, async ({ page }) => {
      await kostenOeffnen(page, grundbestand({}, {}, '---\nstart: 2026-10-01\nreport-filter: {exclude-classes: [bug]}\n---\n'));
      await page.goto(k.adresse + '#/berichte/' + route);
      await expect(page.locator('.bf-zusammen')).toContainText('1 aktiv');
      await filterOeffnen(page);
      await page.locator('.bf-fuss .bf-leeren').click();
      await expect(page.locator('.bf-zusammen')).toContainText('Filter · keine');
      await expect.poll(() => page.evaluate(() => document.activeElement.matches('.bf-zusammen'))).toBe(true);
    });
  }

  test('Nacharbeit S6: „Zurücksetzen“ in „Wie lange noch“ hebt die Klasse auf, Messbasis 30 T bleibt (PO Z. 116)', async ({ page }) => {
    await kostenOeffnen(page, grundbestand({}, {}, '---\nstart: 2026-10-01\nreport-filter: {exclude-classes: [bug], window-days: 30}\n---\n'));
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('.bf-zusammen')).toContainText('1 aktiv');
    await expect(page.locator('.bf-zusammen')).toContainText('Messbasis 30 T');
    await filterOeffnen(page);
    await expect(page.locator('.bf-fuss .bf-leeren')).toHaveAttribute('data-arg', 'wieLangeNoch');
    await expect(page.locator('.bf-fuss .bf-leeren'), 'US-25: der Hinweis nennt Messbasis und „Rechnen ab“').toHaveAttribute('title', 'die gezählten Filter aufheben — Messbasis und „Rechnen ab“ bleiben');
    await page.locator('.bf-fuss .bf-leeren').click();
    await expect(page.locator('.bf-zusammen')).toContainText('Filter · keine');
    await expect(page.locator('.bf-zusammen')).toContainText('Messbasis 30 T');
    await expect(page.getByLabel('Messbasis in Tagen')).toHaveValue('30');
    await expect.poll(() => k.lies('boards/fabrik.md')).not.toContain('exclude-classes');
    expect(k.lies('boards/fabrik.md')).toContain('window-days: 30');
    await page.reload();
    await expect(page.locator('.bf-zusammen')).toContainText('Messbasis 30 T');
  });

  test('US-25: der Hinweis an „Zurücksetzen“ nennt nur, was die Leiste zeigt — Kosten ohne, Burndown mit „Rechnen ab“ (PO Z. 118)', async ({ page }) => {
    await kostenOeffnen(page, grundbestand({}, {}, '---\nstart: 2026-10-01\nreport-filter: {exclude-classes: [drift], window-days: 30}\n---\n'));
    const knopf = page.locator('.bf-fuss .bf-leeren');
    await filterOeffnen(page);
    await expect(knopf).toHaveAttribute('title', 'die gezählten Filter aufheben');
    expect(await knopf.getAttribute('title'), 'Gegenbeispiel Kosten').not.toMatch(/Messbasis|Rechnen ab/);
    await page.goto(k.adresse + '#/berichte/verlauf');
    await filterOeffnen(page);
    await expect(knopf).toHaveAttribute('title', 'die gezählten Filter aufheben — „Rechnen ab“ bleibt');
  });

  test('US-13: gespeicherter Zeitraum gilt hier nicht, zählt nicht, die Board-Datei bleibt byte-gleich, das Burndown behält ihn', async ({ page }) => {
    k = await kanbanStarten(einrichten(grundbestand({}, {}, LETZTE_WOCHE)));
    const vorher = pruefsumme(k.lies('boards/fabrik.md'));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
    await page.goto(k.adresse + '#/berichte/kosten');
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 4, ALLE)]);
    await expect(page.locator('.bf-zusammen')).toHaveText('Filter · keine · Zeitraum gilt hier nicht');
    await filterOeffnen(page);
    await expect(page.locator('.bfilter .bf-k')).toHaveText(['Farben', 'Spalten', 'Zuständig']);
    await page.goto(k.adresse + '#/berichte/verlauf');
    await expect(page.getByLabel('Zeitraum', { exact: true })).toHaveValue('vorwoche');
    expect(pruefsumme(k.lies('boards/fabrik.md'))).toBe(vorher);
  });

  test('US-18: der Umfangstext folgt dem Filter, nie „alle Spalten“ bei aktivem Filter', async ({ page }) => {
    await kostenOeffnen(page, { ...grundbestand({ 'aufgaben/0009-neun.md': aufgabeMd(9, 'neun') }, { Prüfung: [9] }) });
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 5, ALLE)]);
    await page.goto(k.adresse + '#/berichte/verlauf');
    await filterOeffnen(page);
    await page.getByLabel('Zeitraum', { exact: true }).selectOption('vorwoche');
    await expect(page.locator('.bf-zusammen')).toContainText('1 aktiv');
    await page.goto(k.adresse + '#/berichte/kosten');
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 5, ALLE)]);
    await spalteSchalten(page, 'Fertig');
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 4, NACH)]);
    await spalteSchalten(page, 'Eingang');
    await expect(zeilen(page)).toHaveText([summe('1,63', 1, 2, NACH)]);
    await spalteSchalten(page, 'In Arbeit');
    await expect(page.locator('#kosten .kost-satz')).toHaveText(`Keine Aufgabe mit Preisetikett · 0 von 1 Aufgabe, ${NACH}`);
    await expect(page.locator('#kosten .kost-hinweis').first()).toContainText('Preisetiketten setzt ein Agent über die API');
    await expect(reset(page)).toHaveText('Zurücksetzen');
    await expect(page.locator('#kosten')).not.toContainText('alle Spalten');
  });

  test('US-24 Grenzwert: bei m = 1 „Aufgabe“, bei m = 2 „Aufgaben“; „von 1 Aufgaben“ steht nirgends (PO Z. 117)', async ({ page }) => {
    await kostenOeffnen(page, grundbestand());
    await filterOeffnen(page);
    const nieMehrzahlNachEins = async () => expect(await page.locator('#kosten').innerText()).not.toMatch(/von 1 Aufgaben/);
    await spalteSchalten(page, 'Eingang');
    await spalteSchalten(page, 'Fertig');
    await expect(zeilen(page)).toHaveText([`Summe 1,63${NBSP}$ · 1 von 1 Aufgabe mit Etikett, ${NACH}`]);
    await nieMehrzahlNachEins();
    await spalteSchalten(page, 'Fertig');
    await spalteSchalten(page, 'In Arbeit');
    await expect(page.locator('#kosten .kost-satz')).toHaveText(`Keine Aufgabe mit Preisetikett · 0 von 1 Aufgabe, ${NACH}`);
    await expect(page.locator('#kosten .kost-satz')).toHaveText(/0 von 1 Aufgabe, nach Filter/);
    await nieMehrzahlNachEins();
    await spalteSchalten(page, 'In Arbeit');
    await expect(zeilen(page)).toHaveText([`Summe 1,63${NBSP}$ · 1 von 2 Aufgaben mit Etikett, ${NACH}`]);
    await nieMehrzahlNachEins();
  });

  test('US-19: Zurücksetzen im Leerzustand ohne Etikett hebt Spalten auf, Zeitraum, Messbasis und „Rechnen ab“ bleiben', async ({ page }) => {
    await kostenOeffnen(page, grundbestand({}, {}, LETZTE_WOCHE));
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 4, ALLE)]);
    await expect(page.getByRole('button', { name: /Zurücksetzen/ })).toHaveCount(0);
    await filterOeffnen(page);
    await spalteSchalten(page, 'Eingang');
    await spalteSchalten(page, 'In Arbeit');
    await expect(page.locator('#kosten .kost-satz')).toHaveText(`Keine Aufgabe mit Preisetikett · 0 von 1 Aufgabe, ${NACH}`);
    await expect(page.locator('#kosten').getByRole('link', { name: 'API für Agenten' })).toBeVisible();
    await expect(reset(page)).toHaveText('Zurücksetzen');
    await reset(page).click();
    await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 4, ALLE)]);
    await expect(page.getByRole('button', { name: /Zurücksetzen/ })).toHaveCount(0);
    await expect.poll(() => k.lies('boards/fabrik.md')).not.toContain('exclude-columns');
    const datei = k.lies('boards/fabrik.md');
    expect(datei).toContain('period: vorwoche');
    expect(datei).toContain('window-days: 30');
    expect(datei).toContain('\nstart: 2026-10-01\n');
    await page.goto(k.adresse + '#/berichte/verlauf');
    await expect(page.getByLabel('Zeitraum', { exact: true })).toHaveValue('vorwoche');
    await page.goto(k.adresse + '#/berichte/prognose');
    await expect(page.locator('.bf-zusammen')).toContainText('Messbasis 30 T');
  });

  test('US-19 Gegenbeispiel: im Leerzustand ohne Etikett ist ein gespeicherter Zeitraum allein kein Filter — kein „Zurücksetzen“', async ({ page }) => {
    await kostenOeffnen(page, { ...grundbestand({}, {}, LETZTE_WOCHE), 'aufgaben/0001-eins.md': aufgabeMd(1, 'eins'), 'aufgaben/0002-zwei.md': aufgabeMd(2, 'zwei') });
    await expect(page.locator('#kosten .kost-satz')).toHaveText(`Keine Aufgabe mit Preisetikett · 0 von 4 Aufgaben, ${ALLE}`);
    await expect(page.getByRole('button', { name: /Zurücksetzen/ })).toHaveCount(0);
  });

  for (const breite of [320, 375, 414]) {
    test(`US-20: bei ${breite} px scrollt die Seite in keinem Zustand waagrecht, „Zurücksetzen“ ist ganz sichtbar`, async ({ page }) => {
      await page.setViewportSize({ width: breite, height: 700 });
      await kostenOeffnen(page, grundbestand({ 'aufgaben/0007-sieben.md': aufgabeMd(7, 'sieben', 'cost:\n  currency: EUR\n  amount: 25.55\n') }, { Eingang: [7] }));
      const ohneWaagrecht = async zustand => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), zustand).toBeLessThanOrEqual(0);
      await ohneWaagrecht('Summen');
      await filterOeffnen(page);
      await ohneWaagrecht('Filterleiste offen');
      await page.locator('.bf-zusammen').click();
      await ohneWaagrecht('Filterleiste zu');
      await filterOeffnen(page);
      await spalteSchalten(page, 'Fertig');
      await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 4, NACH), `Summe 25,55${NBSP}€ · 1 von 4 Aufgaben mit Etikett, ${NACH}`]);
      for (const z of await zeilen(page).all()) await ganzImBild(z, breite);
      await ohneWaagrecht('Summen nach Filter');
      await spalteSchalten(page, 'Eingang');
      await spalteSchalten(page, 'In Arbeit');
      await expect(page.locator('#kosten .kost-satz')).toHaveText('Keine Aufgaben, die zu den Filtern der Berichte passen.');
      await ohneWaagrecht('Leer nach Filter');
      await ganzImBild(page.locator('#kosten .kost-satz'), breite);
      await ganzImBild(reset(page), breite);
      await reset(page).click();
      await expect(zeilen(page)).toHaveText([summe('2,23–3,23', 2, 5, ALLE), `Summe 25,55${NBSP}€ · 1 von 5 Aufgaben mit Etikett, ${ALLE}`]);
      await ohneWaagrecht('nach Zurücksetzen');
    });
  }

  test('US-20: Leerzustand ohne Etikett bei 320 px ohne waagrechtes Scrollen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await kostenOeffnen(page, { ...grundbestand(), 'aufgaben/0001-eins.md': aufgabeMd(1, 'eins'), 'aufgaben/0002-zwei.md': aufgabeMd(2, 'zwei') });
    for (const p of await page.locator('#kosten .kost-leer p').all()) await ganzImBild(p, 320);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});
