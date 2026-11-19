// E2E R00198 (I0188, US-1..US-5, AK 1–9): auf der Karte im Board steht genau ein Kostenbetrag — „Ist …“ verdrängt das
// Preisetikett „≈ …“, gleich in welcher Währung; nur die Schätzung zeigt das Etikett, ohne beides steht nichts.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen } = require('./hilfen');

const NBSP = '\u00a0';

/* ── Treiber: Bestand über Dateien, Kosteneinträge über die Route, gelesen wird die Kartenzeile ── */
const ALTE_POSTEN = 'cost:\n  currency: USD\n  items:\n    - {text: Planung, min: 0.10, max: 0.20}\n    - {text: Bau, amount: 0.30}\n';
const schaetzung = (betrag, waehrung = 'USD') => `cost:\n  currency: ${waehrung}\n  amount: ${betrag}\n`;
const ZEIT_46 = '```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 09:46 · st\n```\n';
const aufgabeMd = (nr, kopf = '', rumpf = '') => `---\nid: ${nr}\ntitle: Aufgabe ${nr}\n${kopf}---\n${rumpf}`;
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
const eintrag = (amount, currency = 'USD', uhrzeit = '10:34') => ({ at: `2026-11-13 ${uhrzeit}+01:00`, role: 'entwickler', column: 'Entwicklung', amount, currency });

/** Ausgangslage der Anforderung: #1 nur Einträge, #2 alte Posten, #3 nur Schätzung, #4 nichts, #5 Schätzung, Einträge in zwei Währungen und Zeit, #6 Schätzung in USD und angefallen nur EUR. */
const AUSGANGSLAGE = {
  dateien: {
    'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #3\n- #4\n- #5\n- #6\n\n## Entwicklung\n\n- #1\n\n## Fertig\n\n- #2\n',
    [datei(1)]: aufgabeMd(1),
    [datei(2)]: aufgabeMd(2, ALTE_POSTEN),
    [datei(3)]: aufgabeMd(3, schaetzung('1.63')),
    [datei(4)]: aufgabeMd(4),
    [datei(5)]: aufgabeMd(5, schaetzung('2.00'), ZEIT_46),
    [datei(6)]: aufgabeMd(6, schaetzung('3.00')),
  },
  eintraege: { 1: [eintrag(3.46), eintrag(1.20, 'USD', '11:02')], 5: [eintrag(2.00, 'EUR'), eintrag(1.00, 'USD', '10:35'), eintrag(0.50, 'USD', '10:36')], 6: [eintrag(2.00, 'EUR')] },
};

/** Was ein Screenreader liest: Text aller Knoten außerhalb von aria-hidden. */
const vorgelesen = ort => ort.evaluate(el => {
  const texte = [];
  const gehen = knoten => {
    if (knoten.nodeType === 3) { texte.push(knoten.textContent); return; }
    if (knoten.getAttribute && knoten.getAttribute('aria-hidden') === 'true') return;
    knoten.childNodes.forEach(gehen);
  };
  gehen(el);
  return texte.join('');
});
/** Was ein Sehender liest: Text in Kästen größer als 1 × 1 px. */
const gesehen = ort => ort.evaluate(el => {
  const texte = [], knoten = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (knoten.nextNode()) {
    const kasten = knoten.currentNode.parentElement.getBoundingClientRect();
    if (kasten.width > 1 && kasten.height > 1) texte.push(knoten.currentNode.textContent);
  }
  return texte.join(' ').replace(/\s+/g, ' ').trim();
});

test.describe('R00198 Nur ein Kostenbetrag auf der Karte im Board', () => {
  let k, anfrage;
  test.afterEach(() => k.stoppen());

  async function buchen(nr, ...eintraege) {
    for (const e of eintraege) {
      const antwort = await anfrage.post(`${k.adresse}api/aufgaben/${nr}/kosteneintraege`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: e });
      expect(antwort.status(), JSON.stringify(e)).toBe(200);
    }
  }
  async function boardZeigen(page) {
    await page.goto(k.adresse + '#/board/fabrik');
    await bereit(page, page.locator('.bahn').first());
  }
  async function boardMit(page, { dateien, eintraege = {} }) {
    k = await kanbanStarten(einrichten(dateien));
    anfrage = page.request;
    for (const [nr, liste] of Object.entries(eintraege)) await buchen(nr, ...liste);
    await alsPerson(page, 'st');
    await boardZeigen(page);
  }
  const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
  const zeile = (page, nr) => karte(page, nr).locator('.r3');
  const preis = (page, nr) => zeile(page, nr).locator('.preis');
  const angefallen = (page, nr) => zeile(page, nr).locator('.rechts > .angefallen');
  /** Die Kostengruppen der Kartenzeile, wie ein Sehender sie liest. */
  const kosten = async (page, nr) => {
    const gruppen = await zeile(page, nr).locator('.rechts > .preis, .rechts > .angefallen, .rechts > .sum').all();
    return (await Promise.all(gruppen.map(gesehen))).join(' ');
  };

  test('US-1 (AK 1, AK 2): #1 nur „Ist 4,66 $“; #2 mit alten Posten nur „Ist 0,40–0,50 $“, nach der Buchung von 4,66 $ ohne Neuladen „Ist 5,06–5,16 $“ und weiter ohne Etikett', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    expect(await kosten(page, 1)).toBe('Ist 4,66 $');
    await expect(preis(page, 1)).toHaveCount(0);
    expect(await kosten(page, 2)).toBe('Ist 0,40–0,50 $');
    await expect(preis(page, 2)).toHaveCount(0);
    expect(await gesehen(zeile(page, 2))).not.toContain('≈');
    await page.evaluate(() => { window.r00198SeiteSteht = true; });
    await buchen(2, eintrag(4.66, 'USD', '12:00'));
    await expect(angefallen(page, 2).locator('> [aria-hidden="true"]')).toHaveText('Ist 5,06–5,16 $');
    expect(await kosten(page, 2)).toBe('Ist 5,06–5,16 $');
    await expect(preis(page, 2)).toHaveCount(0);
    expect(await page.evaluate(() => window.r00198SeiteSteht), 'die Seite wurde nicht neu geladen').toBe(true);
  });

  test('US-2 (AK 3): #3 zeigt nur „≈ 1,63 $“; nach dem Kosteneintrag 0,10 $ über die API ohne Neuladen nur „Ist 0,10 $“ — das Etikett ist verschwunden', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    expect(await kosten(page, 3)).toBe('≈ 1,63 $');
    await page.evaluate(() => { window.r00198SeiteSteht = true; });
    await buchen(3, eintrag(0.10));
    await expect(angefallen(page, 3).locator('> [aria-hidden="true"]')).toHaveText('Ist 0,10 $');
    await expect(preis(page, 3)).toHaveCount(0);
    expect(await kosten(page, 3)).toBe('Ist 0,10 $');
    expect(await page.evaluate(() => window.r00198SeiteSteht), 'die Seite wurde nicht neu geladen').toBe(true);
  });

  test('US-2 (AK 4, AK 5): #5 „Ist 1,50 $ · 2,00 € Σ 0:46“ ohne „≈ 2,00 $“ und ohne Komma vor Σ; #6 mit Schätzung in USD und angefallen nur EUR zeigt nur „Ist 2,00 €“', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    expect(await kosten(page, 5)).toBe('Ist 1,50 $ · 2,00 € Σ 0:46');
    await expect(preis(page, 5)).toHaveCount(0);
    expect(await kosten(page, 6)).toBe('Ist 2,00 €');
    await expect(preis(page, 6)).toHaveCount(0);
    expect(await gesehen(karte(page, 6))).not.toContain('3,00');
  });

  test('US-3 (AK 6): nur Schätzung zeigt nur das Etikett, Spanne mit Zeit „≈ 1,10 $, Σ 0:46“ (Komma-Regel), ohne beides steht nichts', async ({ page }) => {
    const spanne = 'cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n';
    await boardMit(page, { dateien: { ...AUSGANGSLAGE.dateien, [datei(7)]: aufgabeMd(7, spanne, ZEIT_46), 'boards/fabrik.md': AUSGANGSLAGE.dateien['boards/fabrik.md'].replace('- #6\n', '- #6\n- #7\n') }, eintraege: AUSGANGSLAGE.eintraege });
    expect(await kosten(page, 3)).toBe('≈ 1,63 $');
    await expect(angefallen(page, 3)).toHaveCount(0);
    expect(await kosten(page, 7)).toBe('≈ 1,10 $, Σ 0:46');
    expect(await kosten(page, 4)).toBe('');
    await expect(karte(page, 4).locator('.angefallen, .preis, .ag-b, .ag-k')).toHaveCount(0);
    await expect(karte(page, 4)).not.toContainText(/0,00|Ist/);
  });

  test('US-4 (AK 7): vorgelesen genau ein Betrag — #2 „Angefallene Kosten: 0,40 bis 0,50 $“, #5 „Angefallene Kosten: 1,50 $, 2,00 €“, nirgends „Preisetikett“; an #3 bleibt „Preisetikett: geschätzt 1,63 $, API-Kosten“', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    expect(await vorgelesen(angefallen(page, 2))).toBe(`Angefallene Kosten: 0,40 bis 0,50${NBSP}$`);
    expect(await vorgelesen(angefallen(page, 5))).toBe(`Angefallene Kosten: 1,50${NBSP}$, 2,00${NBSP}€`);
    for (const nr of [2, 5]) expect(await vorgelesen(zeile(page, nr)), `#${nr}`).not.toContain('Preisetikett');
    expect(await vorgelesen(preis(page, 3))).toBe(`Preisetikett: geschätzt 1,63${NBSP}$, API-Kosten`);
  });

  test('US-5 (AK 8): die Schätzung bleibt im Reiter „Kosten“ des Fensters, der ungefilterte Bericht nennt unverändert 6,56–6,66 $ und 4,00 €', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    await expect(preis(page, 5)).toHaveCount(0);
    await karte(page, 5).click();
    const dialog = page.getByRole('dialog', { name: 'Aufgabe #5' });
    await expect(dialog).toBeVisible();
    await dialog.locator('[data-act="fenster-menue"][data-arg="ansicht"]').click();
    await page.locator('#fenster [role="menu"][data-art="ansicht"]').getByRole('menuitemradio', { name: 'Kosten', exact: true }).click();
    const reiter = page.locator('#fenster .mod-body[data-ansicht="kosten"]');
    const geschaetzt = reiter.getByRole('table', { name: 'Geschätzte API-Kosten (USD)' });
    await expect(geschaetzt).toBeVisible();
    await expect(geschaetzt).toContainText(`2,00${NBSP}$`);
    await page.goto(k.adresse + '#/berichte/kosten');
    await bereit(page, '#kosten');
    const summe = waehrung => page.getByRole('group', { name: `Angefallene Kosten in ${waehrung}` }).locator('.kost-gesamt .kost-betrag');
    await expect(summe('USD')).toHaveText('6,56–6,66 $');
    await expect(summe('EUR')).toHaveText('4,00 €');
  });

  test('US-5 (AK 9): die Anzeige schreibt nichts; bei 320 px zeigt #5 „Ist 1,50 $ · 2,00 €“ und „Σ 0:46“ ohne Querscrollen', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    const lesen = () => ({ kopf: k.git('rev-parse', 'HEAD'), offen: k.git('status', '--porcelain'), aufgaben: [1, 2, 3, 4, 5, 6].map(nr => k.lies(datei(nr))) });
    const vorher = lesen();
    await breiteSetzen(page, 320, 800);
    expect(await kosten(page, 5)).toBe('Ist 1,50 $ · 2,00 € Σ 0:46');
    await expect(zeile(page, 5).locator('.sum')).toBeVisible();
    const quer = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(quer).toBeLessThanOrEqual(0);
    expect(lesen()).toEqual(vorher);
  });
});
