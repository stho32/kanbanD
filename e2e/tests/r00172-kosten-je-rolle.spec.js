// E2E R00172 (I0162): Bericht „Kosten“ — „Kosten je Rolle“ aufklappen bis zur Aufgabe und ihren Einträgen, am
// Beispielboard der Anforderung mit fester Browser-Uhr (16.11.2026) und fester Zeitzone (+01:00, playwright.config.js).
// Vorgabe: Dokumentation/Wireframes/D0006.dc.html (#kosten-je-rolle).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen } = require('./hilfen');
const BEISPIEL = require('./r00171-beispielboard');

const NBSP = ' ';
const usd = betrag => `${betrag}${NBSP}$`;
const TITEL_1 = BEISPIEL.AUFGABEN[0].titel, TITEL_2 = BEISPIEL.AUFGABEN[1].titel, TITEL_3 = BEISPIEL.AUFGABEN[2].titel;
const FALL_1_ROLLEN = [`architekt ${usd('0,54')}`, `entwickler ${usd('3,46')}`, `planer ${usd('1,00')}`];
const OHNE_BEREICHE_ROLLEN = [`architekt ${usd('0,54')}`, `entwickler ${usd('9,46')}`, `planer ${usd('1,00')}`];
const zusammen = betrag => `Rollen zusammen ${usd(betrag)} · gleich „Einträge“`;
const OHNE_ROLLE_AUSSEN = `ohne Rolle ${usd('5,00')} · nicht in der Summe`;
const OHNE_ROLLE_ZAEHLT = `ohne Rolle ${usd('5,00')} · zählt in der Summe mit`;

/* ── Treiber: Bestand über Dateien (wie R00171), Bedienung über Bereichszeile und Klappen ── */
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
/** Rolle und Spalte sind fremder Text: als YAML-Zeichenkette in Anführungszeichen, damit auch `"`, `<` und `/` ankommen. */
const eintragMd = e => `  - {at: ${e.at}, role: ${JSON.stringify(e.role)}, column: ${JSON.stringify(e.column)}, amount: ${e.amount.toFixed(2)}, currency: ${e.currency}}\n`;
function aufgabeMd(a, titel = a.titel, eintraege = a.eintraege) {
  let kopf = '';
  if (eintraege.length) kopf += `cost-entries:\n${eintraege.map(eintragMd).join('')}`;
  if (a.archiviert) kopf += `archived: ${a.archiviert}\n`;
  if (a.altePosten) kopf += `cost:\n  currency: USD\n  items:\n    - {text: Bau, amount: ${a.altePosten.toFixed(2)}}\n`;
  return `---\nid: ${a.nummer}\ntitle: ${JSON.stringify(titel)}\n${kopf}---\n`;
}
const boardMd = name => `# ${name}\n\n` + BEISPIEL.SPALTEN.map(spalte => `## ${spalte}\n\n${BEISPIEL.AUFGABEN.filter(a => a.spalte === spalte).map(a => `- #${a.nummer}\n`).join('')}`).join('\n');
/** Das Beispielboard als Dateien; `titel` und `eintraege` überschreiben je Nummer, `boards` nennt weitere Boards mit
    denselben Aufgaben. */
function bestand({ titel = {}, eintraege = {}, boards = [] } = {}) {
  const boardDateien = Object.fromEntries(['fabrik', ...boards].map(name => [`boards/${name}.md`, boardMd(name)]));
  return { ...boardDateien, ...Object.fromEntries(BEISPIEL.AUFGABEN.map(a => [datei(a.nummer), aufgabeMd(a, titel[a.nummer], eintraege[a.nummer])])) };
}

test.describe('R00172 Bericht „Kosten“: Kosten je Rolle aufklappen', () => {
  let k;
  test.afterEach(() => k.stoppen());

  /** Öffnet den Bericht „Kosten“ des Boards; das Board zuerst, sonst nähme der Bericht das voreingestellte. */
  async function berichtDesBoards(page, board) {
    await page.goto(k.adresse + `#/board/${board}`);
    await bereit(page, page.locator('.bahn').first());
    await page.goto(k.adresse + '#/berichte/kosten');
    await bereit(page, '#kosten');
  }
  async function berichtOeffnen(page, dateien = bestand()) {
    k = await kanbanStarten(einrichten(dateien));
    await page.clock.setFixedTime(new Date(BEISPIEL.HEUTE));
    await alsPerson(page, 'st');
    await berichtDesBoards(page, 'fabrik');
  }
  const bereich = page => page.getByRole('group', { name: 'Zeitraum und Spaltenabschnitt' });
  const feld = (page, name) => bereich(page).getByLabel(name, { exact: true });
  const zeilen = page => page.getByRole('group', { name: 'Angefallene Kosten in USD' }).locator('.kost-zeile');
  /** Eine Wahl in der Bereichszeile ist erst durch, wenn sie gespeichert, das Nachladen danach übernommen und gezeichnet
      ist (ADR-0026 Regel 3) — bis dahin ersetzt ein Neuzeichnen jede Klappe. */
  async function waehlen(page, aktion) {
    const antwortAuf = pfad => page.waitForResponse(antwort => antwort.request().method() === 'GET' && new URL(antwort.url()).pathname === pfad);
    const nachgeladen = Promise.all(['/api/aufgaben', '/api/herkunft', '/api/boards'].map(antwortAuf));
    await aktion();
    await Promise.all((await nachgeladen).map(antwort => antwort.finished()));
    await bereit(page, '#kosten');
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
  }
  /** Fall 1 der Anforderung: Zeitraum 12.11.–13.11., Abschnitt „Entwicklung“–„Abnahme“. */
  async function fallEinsWaehlen(page) {
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('eigen'));
    await waehlen(page, () => feld(page, 'Zeitraum von').fill('2026-11-12'));
    await waehlen(page, () => feld(page, 'Zeitraum bis').fill('2026-11-13'));
    await waehlen(page, () => feld(page, 'Spalte von').selectOption({ label: 'Entwicklung' }));
    await waehlen(page, () => feld(page, 'Spalte bis').selectOption({ label: 'Abnahme' }));
  }
  const zuruecksetzen = page => waehlen(page, () => page.getByRole('button', { name: 'Zeitraum und Spaltenabschnitt zurücksetzen' }).click());
  const gruppe = (page, waehrung = 'USD') => page.locator(`details.kost-rollen[data-kr="${waehrung}"]`);
  const kopf = klappe => klappe.locator(':scope > summary');
  const rollen = (page, waehrung = 'USD') => gruppe(page, waehrung).locator('details.kost-rolle');
  const rolle = (page, name) => rollen(page).filter({ has: page.locator(':scope > summary').getByText(name, { exact: true }) });
  const aufgabenzeilen = klappe => klappe.locator('.kost-rzeile');
  const eintragszeilen = klappe => klappe.locator('.kost-reintr li');
  const offen = klappe => klappe.evaluate(e => e.open);
  /** Klappt auf oder zu und wartet, bis die Seite es sich gemerkt hat (`toggle` kommt nach dem Klick). */
  async function klappen(klappe) {
    const vorher = await offen(klappe);
    await kopf(klappe).click();
    await expect.poll(() => offen(klappe)).toBe(!vorher);
    await klappe.page().evaluate(() => new Promise(fertig => setTimeout(fertig, 0)));
  }
  const bild = async (page, name) => { if (process.env.KD_BILDER) await page.screenshot({ path: path.join(process.env.KD_BILDER, name), fullPage: true }); };

  test('US-1 (AK 1, AK 3, AK 8): Fall 1 — „Kosten je Rolle“ ist zugeklappt; aufgeklappt stehen architekt 0,54 $, entwickler 3,46 $, planer 1,00 $, zusammen 5,00 $ wie die Summe; abgesetzt „ohne Rolle“ 5,00 $ „nicht in der Summe“', async ({ page }) => {
    await berichtOeffnen(page);
    await fallEinsWaehlen(page);
    await expect(zeilen(page).nth(1)).toContainText(`Summe ${usd('5,00')}`);
    await expect(gruppe(page)).toHaveCount(1);
    await expect(kopf(gruppe(page))).toHaveText('Kosten je Rolle');
    await expect(kopf(gruppe(page))).toBeVisible();
    expect(await offen(gruppe(page)), 'Anfangszustand: zugeklappt').toBe(false);
    await expect(rollen(page).first()).toBeHidden();
    expect(await gruppe(page).evaluate(e => e === e.parentElement.lastElementChild && e.parentElement.className), 'letztes Kind von .kost-summen').toBe('kost-summen');

    await klappen(gruppe(page));
    await expect(rollen(page).locator(':scope > summary')).toHaveText(FALL_1_ROLLEN);
    expect(await rollen(page).evaluateAll(alle => alle.map(e => [e.dataset.kr, e.open]))).toEqual([['USD/architekt', false], ['USD/entwickler', false], ['USD/planer', false]]);
    await expect(gruppe(page).locator('.kost-rsumme')).toHaveText(zusammen('5,00'));
    await expect(gruppe(page).locator('.kost-ohne-rolle')).toHaveText(OHNE_ROLLE_AUSSEN);
    await expect(gruppe(page).locator('.kost-ohne-rolle')).toHaveClass('kost-ohne-rolle kost-aussen');
    await expect(page.locator('#kosten')).not.toContainText(/Karte/);
  });

  test('US-2 (AK 2, AK 5): „entwickler“ aufgeklappt zeigt #1 mit 3,46 $ und eingerückt den Eintrag 13.11. 10:34 · „Entwicklung“ · 3,46 $; planer #1 mit 1,00 $, architekt #2 mit 0,54 $; „entwickler“ bleibt offen, wenn eine Aufgabe des Boards verschoben wird', async ({ page }) => {
    await berichtOeffnen(page);
    await fallEinsWaehlen(page);
    await klappen(gruppe(page));
    await klappen(rolle(page, 'entwickler'));
    await expect(aufgabenzeilen(rolle(page, 'entwickler'))).toHaveText([`#1 ${TITEL_1} ${usd('3,46')}`]);
    await expect(eintragszeilen(rolle(page, 'entwickler'))).toHaveText([`13.11.2026 10:34 · Entwicklung ${usd('3,46')}`]);
    await expect(rolle(page, 'entwickler').getByRole('list', { name: 'Aufgaben der Rolle entwickler' })).toBeVisible();
    await expect(rolle(page, 'entwickler').locator('details')).toHaveCount(0);
    await bild(page, 'r00172-kosten-je-rolle-breit.png');

    const vorher = await page.evaluate(() => window.kdTest.renders());
    const bewegt = await page.request.post(k.adresse + 'api/boards/fabrik/bewegen', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { nummer: 2, spalte: 'Abnahme' } });
    expect(bewegt.ok(), await bewegt.text()).toBe(true);
    await expect(page.getByRole('table', { name: 'Aufgaben mit Einträgen im gewählten Bereich' }).locator('tbody tr .kost-kz')).toHaveText(['erledigt', 'erledigt']);
    expect(await page.evaluate(() => window.kdTest.renders()), 'das Live-Ereignis hat neu gezeichnet').toBeGreaterThan(vorher);
    await bereit(page, '#kosten');
    expect(await offen(gruppe(page))).toBe(true);
    expect(await offen(rolle(page, 'entwickler'))).toBe(true);
    await expect(eintragszeilen(rolle(page, 'entwickler'))).toHaveText([`13.11.2026 10:34 · Entwicklung ${usd('3,46')}`]);

    await klappen(rolle(page, 'planer'));
    await expect(aufgabenzeilen(rolle(page, 'planer'))).toHaveText([`#1 ${TITEL_1} ${usd('1,00')}`]);
    await expect(eintragszeilen(rolle(page, 'planer'))).toHaveText([`12.11.2026 09:00 · Entwicklung ${usd('1,00')}`]);
    await klappen(rolle(page, 'architekt'));
    await expect(aufgabenzeilen(rolle(page, 'architekt'))).toHaveText([`#2 ${TITEL_2} ${usd('0,54')}`]);
  });

  test('US-3 (AK 4, AK 5): „Zurücksetzen“ — architekt 0,54 $, entwickler 9,46 $, planer 1,00 $, zusammen „Einträge“ 11,00 $; „entwickler“ ist weiter offen und zeigt #1 mit 5,46 $ und #3 mit 4,00 $; „ohne Rolle“ 5,00 $ zählt mit, Summe 16,00 $', async ({ page }) => {
    await berichtOeffnen(page);
    await fallEinsWaehlen(page);
    await klappen(gruppe(page));
    await klappen(rolle(page, 'entwickler'));
    await expect(rollen(page).locator(':scope > summary')).toHaveText(FALL_1_ROLLEN);

    await zuruecksetzen(page);
    await expect(rollen(page).locator(':scope > summary')).toHaveText(OHNE_BEREICHE_ROLLEN);
    await expect(gruppe(page).locator('.kost-rsumme')).toHaveText(zusammen('11,00'));
    await expect(zeilen(page).first()).toHaveText(`Einträge ${usd('11,00')}`);
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.open))).toEqual([false, true, false]);
    await expect(aufgabenzeilen(rolle(page, 'entwickler'))).toHaveText([`#1 ${TITEL_1} ${usd('5,46')}`, `#3 ${TITEL_3} ${usd('4,00')}`]);
    await expect(eintragszeilen(rolle(page, 'entwickler'))).toHaveText([`13.11.2026 10:34 · Entwicklung ${usd('3,46')}`, `14.11.2026 15:00 · Abnahme ${usd('2,00')}`, `05.11.2026 08:00 · Entwicklung ${usd('4,00')}`]);
    await expect(gruppe(page).locator('.kost-ohne-rolle')).toHaveText(OHNE_ROLLE_ZAEHLT);
    await expect(gruppe(page).locator('.kost-ohne-rolle')).toHaveClass('kost-ohne-rolle');
    await expect(zeilen(page).nth(2)).toContainText(`Summe ${usd('16,00')}`);
  });

  test('AK 5 (Zeichnung): fällt eine offene Rolle aus dem Bereich, fehlt sie nur — kommt sie wieder, ist sie wieder offen; zugeklappt bleibt zugeklappt', async ({ page }) => {
    await berichtOeffnen(page);
    await klappen(gruppe(page));
    await klappen(rolle(page, 'planer'));
    await klappen(rolle(page, 'architekt'));
    await klappen(rolle(page, 'architekt'));
    await waehlen(page, () => feld(page, 'Spalte von').selectOption({ label: 'Abnahme' }));
    await expect(rollen(page).locator(':scope > summary')).toHaveText([`entwickler ${usd('2,00')}`]);
    expect(await offen(gruppe(page))).toBe(true);
    await waehlen(page, () => feld(page, 'Spalte von').selectOption({ label: 'alle' }));
    await expect(rollen(page).locator(':scope > summary')).toHaveText(OHNE_BEREICHE_ROLLEN);
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.open))).toEqual([false, false, true]);
    await klappen(gruppe(page));
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('eigen'));
    expect(await offen(gruppe(page)), 'die zugeklappte Gruppe bleibt zu').toBe(false);
  });

  test('AK 6: Tab erreicht „Kosten je Rolle“ und jede Rolle in Lesefolge; Enter und Leertaste öffnen und schließen', async ({ page }) => {
    await berichtOeffnen(page);
    await feld(page, 'Spalte bis').focus();
    await page.keyboard.press('Tab');
    await expect(kopf(gruppe(page))).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => offen(gruppe(page))).toBe(true);
    await page.keyboard.press('Tab');
    await expect(kopf(rolle(page, 'architekt'))).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(() => offen(rolle(page, 'architekt'))).toBe(true);
    await expect(aufgabenzeilen(rolle(page, 'architekt'))).toHaveText([`#2 ${TITEL_2} ${usd('0,54')}`]);
    await page.keyboard.press('Tab');
    await expect(kopf(rolle(page, 'entwickler'))).toBeFocused();
    await page.keyboard.press('Enter');
    await expect.poll(() => offen(rolle(page, 'entwickler'))).toBe(true);
    await page.keyboard.press('Space');
    await expect.poll(() => offen(rolle(page, 'entwickler'))).toBe(false);
    await page.keyboard.press('Tab');
    await expect(kopf(rolle(page, 'planer'))).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    await expect.poll(() => offen(rolle(page, 'architekt'))).toBe(false);
    await page.keyboard.press('Shift+Tab');
    await expect(kopf(gruppe(page))).toBeFocused();
    await page.keyboard.press('Space');
    await expect.poll(() => offen(gruppe(page))).toBe(false);
  });

  test('AK 7: bei 375 px scrollt nichts waagrecht; jede Klappe ist mindestens 48 px hoch, der lange Titel bricht um, Rolle und Betrag bleiben lesbar', async ({ page }) => {
    await berichtOeffnen(page);
    await fallEinsWaehlen(page);
    await klappen(gruppe(page));
    await klappen(rolle(page, 'architekt'));
    await breiteSetzen(page, 375, 1400);
    await expect(kopf(rolle(page, 'architekt'))).toBeVisible();
    expect(await offen(rolle(page, 'architekt')), 'offen auch nach dem Wechsel der Breite').toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const masse = await gruppe(page).evaluate(e => {
      const rahmen = knoten => { const r = knoten.getBoundingClientRect(); return { links: r.left, rechts: r.right, hoehe: r.height }; };
      return {
        koepfe: [...e.querySelectorAll('summary')].map(rahmen),
        betraege: [...e.querySelectorAll('.r')].map(rahmen),
        namen: [...e.querySelectorAll('summary .kost-rname')].map(rahmen),
        titel: rahmen(e.querySelector('.kost-raufg .tt')),
      };
    });
    expect(masse.koepfe).toHaveLength(4);
    for (const kopfzeile of masse.koepfe) expect(kopfzeile.hoehe).toBeGreaterThanOrEqual(48);
    expect(masse.betraege.length).toBeGreaterThanOrEqual(7);
    for (const betrag of masse.betraege) {
      expect(betrag.rechts, 'Betrag im Bild').toBeLessThanOrEqual(375);
      expect(betrag.hoehe, 'Betrag bricht nie').toBeLessThan(24);
    }
    for (const name of masse.namen) expect(name.links).toBeGreaterThanOrEqual(0);
    expect(masse.titel.hoehe, 'der lange Titel von #2 bricht um').toBeGreaterThan(24);
    await expect(kopf(rolle(page, 'entwickler'))).toHaveText(`entwickler ${usd('3,46')}`);
    await bild(page, 'r00172-kosten-je-rolle-375.png');
  });

  test('Schaden d: Rollenname, Aufgabentitel und Spaltenname sind fremder Text — `"`, `<`, `/` und Leerzeichen stehen als Text da, erzeugen kein Element, und jede Rolle klappt für sich, auch über das Neuzeichnen', async ({ page }) => {
    const ROLLEN = ['a', 'a b', 'a/b', 'x "y" <b>z</b>'];
    const fremd = ROLLEN.map((role, stelle) => BEISPIEL.eintrag(`13 1${stelle}:00`, 'Re<i>view</i> "1"', 0.01 * 2 ** stelle, { role }));
    const fehler = [];
    page.on('pageerror', f => fehler.push(String(f)));
    await berichtOeffnen(page, bestand({ titel: { 1: 'Angebot <img src=x onerror="document.title=1"> & "Co"' }, eintraege: { 1: fremd, 2: [], 3: [] } }));
    await klappen(gruppe(page));
    await expect(rollen(page).locator(':scope > summary .kost-rname')).toHaveText(ROLLEN);
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.dataset.kr))).toEqual(ROLLEN.map(name => `USD/${name}`));
    await expect(page.locator('#kosten').locator('img, i, b:not(.kost-wort)')).toHaveCount(0);

    await klappen(rollen(page).nth(3));
    await klappen(rollen(page).nth(2));
    await expect(aufgabenzeilen(rollen(page).nth(3))).toHaveText([`#1 Angebot <img src=x onerror="document.title=1"> & "Co" ${usd('0,08')}`]);
    await expect(eintragszeilen(rollen(page).nth(3))).toHaveText([`13.11.2026 13:00 · Re<i>view</i> "1" ${usd('0,08')}`]);
    await expect(rollen(page).nth(3).getByRole('list', { name: 'Aufgaben der Rolle x "y" <b>z</b>' })).toBeVisible();
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('eigen'));
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.open)), 'nur „a/b“ und die Rolle mit Sonderzeichen sind offen — „a“ und „a b“ nicht').toEqual([false, false, true, true]);
    await klappen(rollen(page).nth(2));
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('alles'));
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.open))).toEqual([false, false, false, true]);
    await expect(page.locator('#kosten').locator('img, i, b:not(.kost-wort)')).toHaveCount(0);
    expect(await page.title()).not.toBe('1');
    expect(fehler).toEqual([]);
  });

  test('Schaden e: der Klappzustand gilt je Board — auf einem zweiten Board mit denselben Rollen ist alles zugeklappt, zurück auf dem ersten wieder offen; gespeichert wird nichts', async ({ page }) => {
    await berichtOeffnen(page, bestand({ boards: ['zweit'] }));
    await klappen(gruppe(page));
    await klappen(rolle(page, 'entwickler'));
    const ordnerVorher = k.git('status', '--short');

    await berichtDesBoards(page, 'zweit');
    await expect(rollen(page)).toHaveCount(3);
    expect(await offen(gruppe(page)), 'zweites Board: Gruppe zu').toBe(false);
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.open))).toEqual([false, false, false]);
    await klappen(gruppe(page));
    await klappen(rolle(page, 'planer'));

    await berichtDesBoards(page, 'fabrik');
    expect(await offen(gruppe(page))).toBe(true);
    expect(await rollen(page).evaluateAll(alle => alle.map(e => e.open)), 'erstes Board: entwickler offen, planer nicht').toEqual([false, true, false]);
    expect(await page.evaluate(() => Object.keys(localStorage).filter(schluessel => /kost|roll/i.test(schluessel))), 'kein Schlüssel im Browser-Speicher').toEqual([]);
    expect(k.git('status', '--short'), 'nichts im Ordner geändert').toBe(ordnerVorher);
  });

  test('Mehrere Währungen (Zeichnung, nicht gezeichnet): je Währung eine eigene Gruppe am Ende, „Kosten je Rolle · EUR“, und jede klappt für sich', async ({ page }) => {
    const euro = { ...BEISPIEL.eintrag('13 12:00', 'Abnahme', 25.55), currency: 'EUR' };
    await berichtOeffnen(page, bestand({ eintraege: { 3: [...BEISPIEL.AUFGABEN[2].eintraege, euro] } }));
    await expect(page.locator('details.kost-rollen > summary')).toHaveText(['Kosten je Rolle · USD', 'Kosten je Rolle · EUR']);
    expect(await page.locator('.kost-summen').evaluate(e => [...e.children].slice(-2).map(kind => kind.id))).toEqual(['kost-rollen-USD', 'kost-rollen-EUR']);
    await klappen(gruppe(page, 'EUR'));
    await klappen(rollen(page, 'EUR').first());
    await expect(rollen(page, 'EUR').locator(':scope > summary')).toHaveText([`entwickler 25,55${NBSP}€`]);
    await expect(gruppe(page, 'EUR').locator('.kost-rsumme')).toHaveText(`Rollen zusammen 25,55${NBSP}€ · gleich „Einträge“`);
    await expect(gruppe(page, 'EUR').locator('.kost-ohne-rolle')).toHaveCount(0);
    await expect(gruppe(page, 'USD').locator('.kost-ohne-rolle')).toBeAttached();
    expect(await offen(gruppe(page, 'USD')), 'USD bleibt zu').toBe(false);
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('eigen'));
    expect([await offen(gruppe(page, 'USD')), await offen(gruppe(page, 'EUR')), await offen(rollen(page, 'EUR').first())]).toEqual([false, true, true]);
  });
});
