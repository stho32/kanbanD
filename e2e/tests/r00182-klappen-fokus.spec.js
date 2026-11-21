// E2E R00182 (I0172, Karte #191): aufgeklappte Abschnitte behalten den Tastaturfokus, wenn die Seite neu zeichnet
// (ADR-0010 N10 Ziffer 1 — jedes per Tab erreichbare Element trägt einen im Bereich eindeutigen Schlüssel).
// Bestand: Beispielboard aus R00171/R00172 (Rollen architekt, entwickler, planer in USD), dazu ein zweites Board.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');
const { ansichtenDerAnwendung } = require('./ansichten');
// Die Berichte aus der einen Liste der Ansichten (ADR-0012 Regel 6), damit die Sammelprobe keinen auslässt
const BERICHTE = ansichtenDerAnwendung({ board: 'fabrik' }).filter(({ ansicht }) => ansicht.startsWith('Bericht ')).map(({ adresse }) => adresse.replace('#/berichte/', ''));
const BEISPIEL = require('./r00171-beispielboard');

/* ── Bestand über Dateien (wie R00172) ── */
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
const eintragMd = e => `  - {at: ${e.at}, role: ${JSON.stringify(e.role)}, column: ${JSON.stringify(e.column)}, amount: ${e.amount.toFixed(2)}, currency: ${e.currency}}\n`;
function aufgabeMd(a) {
  let kopf = '';
  if (a.eintraege.length) kopf += `cost-entries:\n${a.eintraege.map(eintragMd).join('')}`;
  if (a.archiviert) kopf += `archived: ${a.archiviert}\n`;
  return `---\nid: ${a.nummer}\ntitle: ${JSON.stringify(a.titel)}\n${kopf}---\n`;
}
const boardMd = name => `# ${name}\n\n` + BEISPIEL.SPALTEN.map(spalte => `## ${spalte}\n\n${BEISPIEL.AUFGABEN.filter(a => a.spalte === spalte).map(a => `- #${a.nummer}\n`).join('')}`).join('\n');
const BESTAND = {
  'boards/fabrik.md': boardMd('fabrik'),
  'boards/zweites.md': '# zweites\n\n## Eingang\n\n## Fertig\n',
  ...Object.fromEntries(BEISPIEL.AUFGABEN.map(a => [datei(a.nummer), aufgabeMd(a)])),
};
const ALS_AGENT = { headers: { 'X-KanbanD-Wer': 'cl' } };

let k;
let schreibzaehler = 0;
test.beforeEach(async ({ page }) => {
  k = await kanbanStarten(einrichten(BESTAND));
  schreibzaehler = 0;
  await alsPerson(page, 'st');
});
test.afterEach(async () => { await k.stoppen(); });

/** Öffnet einen Bericht des Boards „fabrik“; das Board zuerst, sonst nähme der Bericht das voreingestellte. */
async function berichtOeffnen(page, bericht) {
  await page.goto(k.adresse + '#/board/fabrik');
  await bereit(page, page.locator('.bahn').first());
  await page.goto(k.adresse + '#/berichte/' + bericht);
  await bereit(page, `#main[data-sicht^="berichte/${bericht}/"]`);
}

/** Der fremde Schreibzugriff: ein Agent ändert den Titel von #2; gewartet wird auf das Neuzeichnen, nicht auf die Uhr. */
async function fremderSchreibzugriff(page) {
  const vorher = await page.evaluate(() => window.kdTest.renders());
  schreibzaehler += 1;
  const antwort = await page.request.patch(`${k.adresse}api/aufgaben/2`, { ...ALS_AGENT, data: { titel: `zwei ${schreibzaehler}` } });
  expect(antwort.ok(), await antwort.text()).toBe(true);
  await expect.poll(() => page.evaluate(() => window.kdTest.renders())).toBeGreaterThan(vorher);
  await expect.poll(() => page.evaluate(() => window.kdTest.gezeichnet())).toBe(true);
}

const gruppe = page => page.locator('details.kost-rollen[data-kr="USD"]');
const rolle = (page, name) => page.locator(`details.kost-rolle[data-kr="USD/${name}"]`);
const kopf = klappe => klappe.locator(':scope > summary');
const offen = klappe => klappe.evaluate(e => e.open);

/** Klappt per Tastatur auf oder zu und wartet, bis die Seite es übernommen hat. */
async function klappen(klappe) {
  const vorher = await offen(klappe);
  await kopf(klappe).focus();
  await klappe.page().keyboard.press('Enter');
  await expect.poll(() => offen(klappe)).toBe(!vorher);
  await expect.poll(() => klappe.page().evaluate(() => window.kdTest.gezeichnet())).toBe(true);
}

test('AK 1 (Abnahme-Probe der Karte): Klappe „entwickler“ offen und im Fokus, fremde Titeländerung zeichnet neu → Fokus auf derselben Klappe, weiter offen, Leertaste klappt zu', async ({ page }) => {
  await berichtOeffnen(page, 'kosten');
  await klappen(gruppe(page));
  await klappen(rolle(page, 'entwickler'));
  await kopf(rolle(page, 'entwickler')).focus();

  await fremderSchreibzugriff(page);

  await expect(kopf(rolle(page, 'entwickler'))).toBeFocused();
  expect(await offen(rolle(page, 'entwickler'))).toBe(true);
  await page.keyboard.press('Space');
  await expect.poll(() => offen(rolle(page, 'entwickler'))).toBe(false);
});

test('AK 2: äußere Klappe „Kosten je Rolle“ im Fokus, fremde Titeländerung → Fokus bleibt darauf, offen', async ({ page }) => {
  await berichtOeffnen(page, 'kosten');
  await klappen(gruppe(page));
  await kopf(gruppe(page)).focus();

  await fremderSchreibzugriff(page);

  await expect(kopf(gruppe(page))).toBeFocused();
  expect(await offen(gruppe(page))).toBe(true);
});

test('AK 2: geschlossene Klappe „planer“ im Fokus, fremde Titeländerung → Fokus bleibt, sie bleibt zu, die Leertaste öffnet sie', async ({ page }) => {
  await berichtOeffnen(page, 'kosten');
  await klappen(gruppe(page));
  await kopf(rolle(page, 'planer')).focus();

  await fremderSchreibzugriff(page);

  await expect(kopf(rolle(page, 'planer'))).toBeFocused();
  expect(await offen(rolle(page, 'planer'))).toBe(false);
  await page.keyboard.press('Space');
  await expect.poll(() => offen(rolle(page, 'planer'))).toBe(true);
});

test('AK 2: „Tabellenansicht“ im Burndown im Fokus, fremde Titeländerung → Fokus auf derselben Klappe', async ({ page }) => {
  await berichtOeffnen(page, 'verlauf');
  const tabelle = page.locator('#main details.bd-tabelle > summary');
  await tabelle.focus();
  await expect(tabelle).toBeFocused();

  await fremderSchreibzugriff(page);

  await expect(tabelle).toBeFocused();
});

/* ── AK 3: Sammelprobe — jedes per Tab erreichbare Element in Berichten und Aufgabenfenster hat einen Schlüssel ── */

/** Läuft im Browser: alle Klappen im Bereich auf, damit auch ihr Inhalt erreichbar ist. Liefert die Zahl der geöffneten. */
function klappenAuf(bereichSelektor) {
  const zu = [...document.querySelectorAll(`${bereichSelektor} details:not([open])`)];
  for (const klappe of zu) klappe.open = true;
  return zu.length;
}

/** Läuft im Browser: tabbare, sichtbare Elemente im Bereich ohne Schlüssel (dieselbe Regel wie der Sicherer, web/sichtzustand.js). */
function ohneSchluessel(bereichSelektor) {
  const TABBAR = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]';
  // Karten und Zeilen führt die Tastatur ausdrücklich (fokusKarte, fokusZeile) — sie brauchen keinen Schlüssel
  const GEFUEHRT = '.ka[data-id], tr[data-zeile]';
  const bereich = document.querySelector(bereichSelektor);
  const sichtbar = element => element.getClientRects().length > 0 && element.checkVisibility();
  const menge = [...bereich.querySelectorAll(TABBAR)]
    .filter(element => element.getAttribute('tabindex') !== '-1' && sichtbar(element) && !element.closest('[inert]') && !element.matches(GEFUEHRT));
  const beschreibung = element => ({ id: element.id, daten: { ...element.dataset }, klassen: [...element.classList], href: element.getAttribute('href') });
  const fehlend = menge.filter(element => window.schluessel(beschreibung(element), selektor => bereich.querySelectorAll(selektor).length) === '');
  return { anzahl: menge.length, funde: fehlend.map(element => `${element.tagName.toLowerCase()}${element.className ? '.' + [...element.classList].join('.') : ''} „${element.textContent.trim().slice(0, 40)}“`) };
}

/** Öffnet im Bereich alle Klappen, bis keine mehr zu ist — auch die, die ein Neuzeichnen oder ihr Inhalt nachliefert. */
async function alleKlappenAuf(page, bereichSelektor) {
  await expect.poll(() => page.evaluate(klappenAuf, bereichSelektor)).toBe(0);
}

test('AK 3 Sammelprobe: in jedem Bericht und im Aufgabenfenster hat jedes per Tab erreichbare Element einen Schlüssel', async ({ page }) => {
  test.setTimeout(120000);
  const funde = [];
  let gesamt = 0;
  for (const bericht of BERICHTE) {
    await berichtOeffnen(page, bericht);
    await alleKlappenAuf(page, '#main');
    const { anzahl, funde: hier } = await page.evaluate(ohneSchluessel, '#main');
    gesamt += anzahl;
    funde.push(...hier.map(fund => `Bericht ${bericht}: ${fund}`));
  }

  await page.goto(k.adresse + '#/board/fabrik');
  await bereit(page, '.ka[data-id="1"]');
  await page.locator('.ka[data-id="1"] .t').click();
  const fenster = page.getByRole('dialog', { name: 'Aufgabe #1' });
  await fenster.waitFor();
  const menue = fenster.locator('[role="menu"][data-art="ansicht"]');
  const menueAuf = () => fenster.locator('[data-act="fenster-menue"][data-arg="ansicht"]').click();
  await menueAuf();
  const namen = await menue.locator('[role="menuitemradio"] .fm-text').allTextContents();
  expect(namen.length, 'das Fenster nennt seine Ansichten').toBeGreaterThan(0);
  for (const name of namen) {
    if (await menue.count() === 0) await menueAuf();
    await menue.getByRole('menuitemradio', { name, exact: true }).click();
    await expect(menue).toHaveCount(0);
    await expect(fenster.locator('[data-act="fenster-menue"][data-arg="ansicht"]')).toHaveAttribute('aria-label', `Ansicht: ${name}`);
    await alleKlappenAuf(page, '#over');
    const { anzahl, funde: hier } = await page.evaluate(ohneSchluessel, '#over');
    gesamt += anzahl;
    funde.push(...hier.map(fund => `Aufgabenfenster ${name}: ${fund}`));
  }

  console.log(`Sammelprobe: ${funde.length} von ${gesamt} ohne Schlüssel\n${funde.join('\n')}`);
  expect(gesamt, 'die Menge ist nicht leer').toBeGreaterThan(0);
  expect(funde).toEqual([]);
});

test('US-3 Board-Wechsel: Fokus auf dem Eintrag des zweiten Boards in der Board-Auswahl, Wechsel per Enter → der Fokus liegt nicht auf BODY', async ({ page }) => {
  await page.goto(k.adresse + '#/board/fabrik');
  await bereit(page, page.locator('.bahn').first());
  await page.locator('#t-board').focus();
  await page.keyboard.press('Enter');
  const eintrag = page.locator('#pop [data-act="board-wahl"][data-arg="zweites"]');
  await expect(eintrag).toBeVisible();
  await eintrag.focus();
  await page.keyboard.press('Enter');
  await bereit(page, '#main[data-sicht^="board/zweites/"]');
  await expect(page.locator('#t-board')).toContainText('zweites');
  await expect.poll(() => page.evaluate(() => document.activeElement && document.activeElement.tagName)).not.toBe('BODY');
});
