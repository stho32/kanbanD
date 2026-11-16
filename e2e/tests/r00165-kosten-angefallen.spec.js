// E2E R00165 Teil C (I0155, AK 9 und 10, US-3): Bericht und Ansicht „Kosten“ zeigen angefallene Kosten —
// Kosteneinträge und alte Posten zählen, reine Schätzungen nicht. Vorgabe: Dokumentation/Wireframes/D0006.dc.html
// (#kosten-angefallen) und D0003.dc.html (#kosten-eintraege).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, filterOeffnen, thema } = require('./hilfen');

const NBSP = ' ';
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
  const spalte = (page, name) => page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name, exact: true });
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
    await spalte(page, 'Fertig').click();
    await expect(page.locator('#kosten .kost-zeile')).toHaveText([
      `Einträge 4,66${NBSP}$`,
      `Summe 4,66${NBSP}$ · 1 von 4 Aufgaben mit angefallenen Kosten, nach Filter, auch archivierte`,
      `Einträge 25,55${NBSP}€`,
      `Summe 25,55${NBSP}€ · 1 von 4 Aufgaben mit angefallenen Kosten, nach Filter, auch archivierte`,
    ]);
    await expect(schaetzzeile(page)).toHaveText('1 Aufgabe nur mit Schätzung · nicht gezählt');
    await spalte(page, 'Eingang').click();
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
});
