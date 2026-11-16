// E2E R00165 Teil C (I0155, AK 9 und 10, US-3): Bericht und Ansicht „Kosten“ zeigen angefallene Kosten —
// Kosteneinträge und alte Posten zählen, reine Schätzungen nicht. Vorgabe: Dokumentation/Wireframes/D0006.dc.html
// (#kosten-angefallen) und D0003.dc.html (#kosten-eintraege).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen, thema, reiter } = require('./hilfen');

const NBSP = '\u00a0';
const ALLE = 'alle Spalten, auch archivierte';
const OHNE_DATUM = 'ohne Datum / ohne Rolle / ohne Spalte';
const API_HINWEIS = 'Kosteneinträge legt ein Agent über die API an (POST /api/aufgaben/{nr}/kosteneintraege).';

/* ── Treiber: Bestand über Dateien, Einträge über die Route ── */
const ALTE_POSTEN = 'cost:\n  currency: USD\n  items:\n    - {text: Planung, min: 0.10, max: 0.20}\n    - {text: Bau, amount: 0.30}\n';
const SCHAETZUNG = 'cost:\n  currency: USD\n  amount: 1.63\n';
const aufgabeMd = (nr, kopf = '') => `---\nid: ${nr}\ntitle: Aufgabe ${nr}\n${kopf}---\n`;
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
const boardMd = spalten => '# fabrik\n\n' + Object.entries(spalten).map(([name, nummern]) => `## ${name}\n\n${nummern.map(n => `- #${n}\n`).join('')}`).join('\n');

/** Rechenbeispiel der Anforderung: #1 in „Entwicklung“ (bekommt die Einträge), #2 in „Fertig“ mit alten Posten 0,40–0,50 USD,
    #3 in „Eingang“ nur mit der Schätzung 1,63 USD, #4 in „Eingang“ ohne Kosten. `kosten` überschreibt den Kopf je Nummer. */
function bestand(spalten = { Eingang: [3, 4], Detailplanung: [], Entwicklung: [1], Fertig: [2] }, kosten = {}) {
  const koepfe = { 2: ALTE_POSTEN, 3: SCHAETZUNG, ...kosten };
  const nummern = Object.values(spalten).flat();
  return { 'boards/fabrik.md': boardMd(spalten), ...Object.fromEntries(nummern.map(nr => [datei(nr), aufgabeMd(nr, koepfe[nr] || '')])) };
}
const LAUF_1034 = { at: '2026-11-13 10:34+01:00', role: 'entwickler', column: 'Entwicklung', amount: 3.46, currency: 'USD', tokens: 81234 };
const LAUF_1102 = { at: '2026-11-13 11:02+01:00', role: 'entwickler', column: 'Entwicklung', amount: 1.20, currency: 'USD' };
const LAUF_PLANER = { at: '2026-11-12 16:48+01:00', role: 'planer', column: 'Detailplanung', amount: 0.52, currency: 'USD', tokens: 12000 };

test.describe('R00165 Bericht und Ansicht „Kosten“: angefallene Kosten', () => {
  let k, anfrage;
  test.afterEach(() => k.stoppen());

  async function eintragen(nr, ...eintraege) {
    for (const eintrag of eintraege) {
      const antwort = await anfrage.post(`${k.adresse}api/aufgaben/${nr}/kosteneintraege`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: eintrag });
      expect(antwort.status(), JSON.stringify(eintrag)).toBe(200);
    }
  }
  /** Startet kanbanD mit dem Bestand, legt die Einträge an und öffnet das Board „fabrik“. */
  async function starten(page, dateien, eintraegeJeNummer = { 1: [LAUF_1034, LAUF_1102] }) {
    k = await kanbanStarten(einrichten(dateien));
    anfrage = page.request;
    for (const [nr, eintraege] of Object.entries(eintraegeJeNummer)) await eintragen(nr, ...eintraege);
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
  }
  async function berichtOeffnen(page) {
    await page.locator('#t-ber').click();
    await page.getByRole('menuitem', { name: /^Kosten/ }).click();
    await expect(page.locator('#kosten')).toBeVisible();
  }
  const gruppe = (page, waehrung) => page.getByRole('group', { name: `Angefallene Kosten in ${waehrung}` });
  const zeilen = ort => ort.locator('.kost-zeile');
  /** Schaltet einen Spaltenfilter und wartet, bis der Knopf den neuen Zustand zeigt und der Stand gezeichnet ist (ADR-0026 Regel 3). */
  async function spalteSchalten(page, name) {
    const knopf = page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name, exact: true });
    const vorher = await knopf.getAttribute('aria-pressed');
    await knopf.click();
    await expect(knopf).not.toHaveAttribute('aria-pressed', vorher);
    await bereit(page);
  }
  const schaetzzeile = page => page.locator('#kosten .kost-schaetz');
  const bild = async (ort, name) => { if (process.env.KD_BILDER) await ort.screenshot({ path: path.join(process.env.KD_BILDER, name) }); };

  /* ── Bericht (AK 9) ── */
  test('US-3/AK 9: Rechenbeispiel — Einträge 4,66 $, alte Posten 0,40–0,50 $, Summe 5,06–5,16 $ · 2 von 4; die Schätzung zählt nicht und wird genannt', async ({ page }) => {
    await starten(page, bestand());
    await expect(page.locator('.ka', { hasText: 'Aufgabe 3' }).locator('.preis')).toContainText(`≈ 1,63${NBSP}$`);
    await page.locator('#t-ber').click();
    const eintrag = page.getByRole('menu', { name: 'Berichte' }).getByRole('menuitem', { name: /^Kosten/ });
    await expect(eintrag.locator('small')).toHaveText('Angefallene API-Kosten je Währung – alle Spalten, auch archivierte Aufgaben.');
    await eintrag.click();
    await expect(page.locator('#main .leiste').first()).toHaveText('Kosten · angefallene API-Kosten · liest nur');
    await expect(page.locator('#kosten .kost-gruppe')).toHaveCount(1);
    await expect(zeilen(gruppe(page, 'USD'))).toHaveText([
      `Einträge 4,66${NBSP}$`,
      `${OHNE_DATUM} 0,40–0,50${NBSP}$`,
      `Summe 5,06–5,16${NBSP}$ · 2 von 4 Aufgaben mit angefallenen Kosten, ${ALLE}`,
    ]);
    await expect(schaetzzeile(page)).toHaveText('1 Aufgabe nur mit Schätzung · nicht gezählt');
    await expect(page.locator('#kosten')).not.toContainText('≈');
    await expect(page.locator('#main')).not.toContainText(/geschätzt|Etikett/i);
    await expect(page.locator('#kosten button, #kosten input')).toHaveCount(0);
  });

  test('Zeichnung Bild 1: drei Einträge 5,18 $ · Summe 5,58–5,68 $ · 2 von 3; ein neuer Eintrag zählt ohne Neuladen; Beträge rechtsbündig', async ({ page }) => {
    await starten(page, bestand({ Eingang: [3], Detailplanung: [], Entwicklung: [1], Fertig: [2] }), { 1: [LAUF_1034, LAUF_1102] });
    await berichtOeffnen(page);
    await expect(zeilen(gruppe(page, 'USD')).first()).toHaveText(`Einträge 4,66${NBSP}$`);
    await eintragen(1, LAUF_PLANER);
    await expect(zeilen(gruppe(page, 'USD'))).toHaveText([
      `Einträge 5,18${NBSP}$`,
      `${OHNE_DATUM} 0,40–0,50${NBSP}$`,
      `Summe 5,58–5,68${NBSP}$ · 2 von 3 Aufgaben mit angefallenen Kosten, ${ALLE}`,
    ]);
    const rechteKanten = await gruppe(page, 'USD').locator('.kost-betrag').evaluateAll(betraege => betraege.map(b => Math.round(b.getBoundingClientRect().right)));
    expect(new Set(rechteKanten).size, `rechte Kanten der Beträge ${rechteKanten}`).toBe(1);
    await bild(page.locator('#main'), 'bericht-kosten-hell.png');
    await thema(page, 'dark');
    await bild(page.locator('#main'), 'bericht-kosten-dunkel.png');
  });

  test('Zeichnung Bild 3 und 5: je Währung eine Gruppe, USD zuerst, nur die Zeilen, die etwas tragen; der Spaltenfilter wirkt auf Einträge, Posten und Schätzungen gleich', async ({ page }) => {
    const eur = { ...LAUF_1034, amount: 25.55, currency: 'EUR', tokens: undefined };
    await starten(page, bestand({ Eingang: [3, 4], Detailplanung: [], Entwicklung: [1, 7], Fertig: [2] }), { 1: [LAUF_1034, LAUF_1102], 7: [eur] });
    await berichtOeffnen(page);
    expect(await page.locator('#kosten .kost-gruppe').evaluateAll(gruppen => gruppen.map(g => g.getAttribute('aria-label')))).toEqual(['Angefallene Kosten in USD', 'Angefallene Kosten in EUR']);
    await expect(page.locator('#kosten .kost-zeile')).toHaveText([
      `Einträge 4,66${NBSP}$`,
      `${OHNE_DATUM} 0,40–0,50${NBSP}$`,
      `Summe 5,06–5,16${NBSP}$ · 2 von 5 Aufgaben mit angefallenen Kosten, ${ALLE}`,
      `Einträge 25,55${NBSP}€`,
      `Summe 25,55${NBSP}€ · 1 von 5 Aufgaben mit angefallenen Kosten, ${ALLE}`,
    ]);
    await expect(zeilen(gruppe(page, 'EUR'))).toHaveCount(2);
    await expect(schaetzzeile(page)).toHaveCount(1);
    await filterOeffnen(page);
    await spalteSchalten(page, 'Fertig');
    await expect(page.locator('#kosten .kost-zeile')).toHaveText([
      `Einträge 4,66${NBSP}$`,
      `Summe 4,66${NBSP}$ · 1 von 4 Aufgaben mit angefallenen Kosten, nach Filter, auch archivierte`,
      `Einträge 25,55${NBSP}€`,
      `Summe 25,55${NBSP}€ · 1 von 4 Aufgaben mit angefallenen Kosten, nach Filter, auch archivierte`,
    ]);
    await expect(schaetzzeile(page)).toHaveText('1 Aufgabe nur mit Schätzung · nicht gezählt');
    await spalteSchalten(page, 'Eingang');
    await expect(schaetzzeile(page), 'die Schätzung von #3 liegt in der ausgeschlossenen Spalte').toHaveCount(0);
    await expect(page.locator('#kosten .kost-gesamt').first()).toContainText('1 von 2 Aufgaben');
  });

  test('Zeichnung Bild 7: nur Schätzungen — Leerzustand, darunter „2 Aufgaben nur mit Schätzung · nicht gezählt“, dann der Weg über die API', async ({ page }) => {
    await starten(page, bestand(undefined, { 2: 'cost:\n  currency: EUR\n  min: 1.00\n  max: 2.00\n' }), {});
    await berichtOeffnen(page);
    await expect(page.locator('#kosten .kost-leer p')).toHaveText([
      `Keine Aufgabe mit angefallenen Kosten · 0 von 4 Aufgaben, ${ALLE}`,
      '2 Aufgaben nur mit Schätzung · nicht gezählt',
      API_HINWEIS,
      'API für Agenten',
    ]);
    await expect(page.locator('#kosten .kost-gruppe')).toHaveCount(0);
  });

  test('Zeichnung Bild 8: bei 375 px wird die Gruppe Fließtext, der Betrag bricht nicht um, nichts scrollt waagrecht', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    const eur = { ...LAUF_1034, amount: 25.55, currency: 'EUR', tokens: undefined };
    await starten(page, bestand({ Eingang: [3, 4], Detailplanung: [], Entwicklung: [1, 7], Fertig: [2] }), { 1: [LAUF_1034, LAUF_1102], 7: [eur] });
    await page.goto(k.adresse + '#/berichte/kosten');
    await expect(page.locator('#kosten .kost-gesamt')).toHaveCount(2);
    expect(await gruppe(page, 'USD').evaluate(g => getComputedStyle(g).display)).toBe('block');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const zeilenhoehen = await page.locator('#kosten .kost-betrag').evaluateAll(betraege => betraege.map(b => b.getClientRects().length));
    expect(zeilenhoehen, 'jeder Betrag steht in einer Zeile').toEqual([1, 1, 1, 1, 1]);
  });

  /* ── Ansicht „Kosten“ im Aufgabenfenster (AK 10) ── */
  const EINTRAG_ALTE_SPALTE = 'cost-entries:\n  - {at: 2026-11-10 09:15+01:00, role: reviewer, column: Vorprüfung, amount: 0.75, currency: USD}\n';
  const kostenpanel = page => page.locator('#fenster .mod-body[data-ansicht="kosten"]');
  const eintragstabelle = page => kostenpanel(page).locator('.ko-eintraege table');
  /** Öffnet das Aufgabenfenster über die Karte; die Browser-Uhr steht fest auf dem 16.11.2026, 12:00 Uhr. */
  async function fensterOeffnen(page, nr) {
    await page.locator('.ka', { hasText: `Aufgabe ${nr}` }).click();
    await expect(page.locator('#fenster')).toBeVisible();
  }
  async function fensterSchliessen(page) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#fenster')).toHaveCount(0);
  }
  const ansichtsNamen = async page => {
    await page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]').click();
    return page.locator('#fenster [role="menu"][data-art="ansicht"] [role="menuitemradio"] .fm-text').allTextContents();
  };
  const zeilentexte = tabelle => tabelle.locator('tbody tr, tfoot tr').evaluateAll(trs => trs.map(tr => [...tr.children].filter(z => getComputedStyle(z).display !== 'none').map(z => z.textContent).join(' · ')));
  test.beforeEach(async ({ page }) => { await page.clock.setFixedTime(new Date('2026-11-16T12:00:00+01:00')); });

  test('US-3/AK 10: die Ansicht „Kosten“ von #1 zeigt beide Einträge mit Zeitpunkt, Rolle, Spalte, Betrag und die Summe 4,66 $ — ohne Preisetikett, nur lesend', async ({ page }) => {
    await starten(page, bestand());
    await fensterOeffnen(page, 1);
    expect(await ansichtsNamen(page)).toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Kosten', 'Verlauf']);
    await reiter(page, 'Kosten');
    const panel = kostenpanel(page);
    await expect(panel.locator('.ko-panel > *').first()).toHaveText('Keine Schätzung an dieser Aufgabe.');
    await expect(panel.locator('table')).toHaveCount(1);
    const tabelle = eintragstabelle(page);
    await expect(tabelle.locator('caption')).toHaveText('Angefallene API-Kosten');
    await expect(panel.getByRole('group', { name: 'Angefallene API-Kosten' })).toBeVisible();
    await expect(tabelle.locator('thead th[scope="col"]')).toHaveText(['Zeitpunkt', 'Rolle', 'Spalte', 'Tokens', 'Betrag']);
    expect(await zeilentexte(tabelle)).toEqual([
      `13.11.2026 11:02 · entwickler · Entwicklung · — · 1,20${NBSP}$`,
      `13.11.2026 10:34 · entwickler · Entwicklung · 81.234 · 3,46${NBSP}$`,
      `Summe · 81.234 · 4,66${NBSP}$`,
    ]);
    await expect(tabelle.locator('tbody th[scope="row"]')).toHaveCount(2);
    await expect(panel.locator('.ko-panel > *').last()).toHaveText('liest nur · gesetzt über die API');
    await expect(panel.locator('button, input, textarea, select, [contenteditable]')).toHaveCount(0);
    const ausrichtung = await tabelle.locator('tbody td.r, tfoot td.r').evaluateAll(zellen => zellen.map(z => getComputedStyle(z).textAlign));
    expect(new Set(ausrichtung)).toEqual(new Set(['right']));
    await fensterSchliessen(page);
    await fensterOeffnen(page, 4);
    expect(await ansichtsNamen(page), '#4 trägt weder Etikett noch Einträge').toEqual(['Inhalt', 'Zeiten', 'Details', 'Datei', 'Verlauf']);
  });

  test('Zeichnung Bild 1 und 3: Schätzung bzw. alte Posten bleiben in ihrer Tabelle, die Zählzeile sagt, was im Bericht zählt; neueste Einträge oben', async ({ page }) => {
    const schaetzung = 'cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n  basis: Schätzung planer\n';
    await starten(page, bestand(undefined, { 1: schaetzung }), { 1: [LAUF_PLANER, LAUF_1034, LAUF_1102], 2: [{ ...LAUF_1034, column: 'Fertig' }] });
    await fensterOeffnen(page, 1);
    await reiter(page, 'Kosten');
    const panel = kostenpanel(page);
    expect(await panel.locator('.ko-panel > *').evaluateAll(teile => teile.map(t => t.querySelector('caption')?.textContent || t.textContent))).toEqual([
      'Geschätzte API-Kosten (USD)',
      'Basis: Schätzung planer',
      'Schätzung · zählt im Bericht „Kosten“ nicht',
      'Angefallene API-Kosten',
      'liest nur · gesetzt über die API',
    ]);
    expect(await zeilentexte(eintragstabelle(page))).toEqual([
      `13.11.2026 11:02 · entwickler · Entwicklung · — · 1,20${NBSP}$`,
      `13.11.2026 10:34 · entwickler · Entwicklung · 81.234 · 3,46${NBSP}$`,
      `12.11.2026 16:48 · planer · Detailplanung · 12.000 · 0,52${NBSP}$`,
      `Summe · 93.234 · 5,18${NBSP}$`,
    ]);
    await bild(page.locator('#fenster'), 'ansicht-kosten-hell.png');
    await thema(page, 'dark');
    await bild(page.locator('#fenster'), 'ansicht-kosten-dunkel.png');
    await thema(page, 'light');
    await fensterSchliessen(page);
    await fensterOeffnen(page, 2);
    await reiter(page, 'Kosten');
    expect(await panel.locator('.ko-panel > *').evaluateAll(teile => teile.map(t => t.querySelector('caption')?.textContent || t.textContent))).toEqual([
      'Geschätzte API-Kosten (USD)',
      'Posten ohne Datum / ohne Rolle / ohne Spalte · zählen im Bericht „Kosten“ als angefallen',
      'Angefallene API-Kosten',
      'liest nur · gesetzt über die API',
    ]);
    expect(await zeilentexte(panel.locator('table').first())).toEqual([`Planung · 0,10${NBSP}$ · 0,20${NBSP}$`, `Bau · 0,30${NBSP}$ · 0,30${NBSP}$`, `Summe · 0,40${NBSP}$ · 0,50${NBSP}$`]);
    expect(await zeilentexte(eintragstabelle(page))).toEqual([`13.11.2026 10:34 · entwickler · Fertig · 81.234 · 3,46${NBSP}$`, `Summe · 81.234 · 3,46${NBSP}$`]);
    await fensterSchliessen(page);
    await fensterOeffnen(page, 3);
    await reiter(page, 'Kosten');
    await expect(panel.locator('.ko-zaehlt')).toHaveText('Schätzung · zählt im Bericht „Kosten“ nicht');
    await expect(panel.locator('table')).toHaveCount(1);
  });

  test('Zeichnung Bild 4 und 5: eine verschwundene Spalte behält ihren Namen ohne Marke; ohne Tokens fehlt die Spalte; zwei Währungen → zwei Summenzeilen, USD zuerst', async ({ page }) => {
    const eur = { ...LAUF_PLANER, role: 'architekt', amount: 25.55, currency: 'EUR' };
    await starten(page, bestand(undefined, { 4: EINTRAG_ALTE_SPALTE }), { 1: [LAUF_1034, eur, LAUF_PLANER] });
    await fensterOeffnen(page, 4);
    await reiter(page, 'Kosten');
    await expect(eintragstabelle(page).locator('thead th')).toHaveText(['Zeitpunkt', 'Rolle', 'Spalte', 'Betrag']);
    expect(await zeilentexte(eintragstabelle(page))).toEqual([`10.11.2026 09:15 · reviewer · Vorprüfung · 0,75${NBSP}$`, `Summe · 0,75${NBSP}$`]);
    const spaltenzelle = eintragstabelle(page).locator('tbody td.t').nth(1);
    expect(await spaltenzelle.evaluate(z => [z.getAttribute('title'), z.className, z.children.length])).toEqual([null, 't', 0]);
    await fensterSchliessen(page);
    await fensterOeffnen(page, 1);
    await reiter(page, 'Kosten');
    expect(await zeilentexte(eintragstabelle(page))).toEqual([
      `13.11.2026 10:34 · entwickler · Entwicklung · 81.234 · 3,46${NBSP}$`,
      `12.11.2026 16:48 · architekt · Detailplanung · 12.000 · 25,55${NBSP}€`,
      `12.11.2026 16:48 · planer · Detailplanung · 12.000 · 0,52${NBSP}$`,
      `Summe · 105.234 · 3,98${NBSP}$`,
      `Summe ·  · 25,55${NBSP}€`,
    ]);
  });

  test('Zeichnung Bild 6: bei 375 px fallen die Tokens weg, der Betrag bleibt in einer Zeile, die Seite scrollt nicht waagrecht', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await starten(page, bestand(), { 1: [LAUF_PLANER, LAUF_1034, LAUF_1102] });
    await fensterOeffnen(page, 1);
    await reiter(page, 'Kosten');
    await expect(eintragstabelle(page).locator('thead th:visible')).toHaveText(['Zeitpunkt', 'Rolle', 'Spalte', 'Betrag']);
    expect((await zeilentexte(eintragstabelle(page))).at(-1)).toBe(`Summe · 5,18${NBSP}$`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const betragszeilen = await eintragstabelle(page).locator('td.r:not(.tk)').evaluateAll(zellen => zellen.map(z => getComputedStyle(z).whiteSpace));
    expect(new Set(betragszeilen)).toEqual(new Set(['nowrap']));
  });
});
