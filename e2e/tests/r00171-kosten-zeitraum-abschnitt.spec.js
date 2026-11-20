// E2E R00171 (I0161): Bericht „Kosten“ mit Zeitraum, Spaltenabschnitt und Aufgabenliste — am Beispielboard mit vier
// Aufgaben der Anforderung, mit fester Browser-Uhr (16.11.2026) und fester Zeitzone (+01:00, playwright.config.js).
// Vorgabe: Dokumentation/Wireframes/D0006.dc.html (#kosten-zeitraum-abschnitt).
const { test, expect } = require('@playwright/test');
const path = require('path');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen } = require('./hilfen');
const BEISPIEL = require('./r00171-beispielboard');

const NBSP = ' ';
const usd = betrag => `${betrag}${NBSP}$`;
const OHNE_DATUM = 'ohne Datum / ohne Rolle / ohne Spalte';
const ALTE_POSTEN_AUSSEN = `${OHNE_DATUM} ${usd('5,00')} · nicht in der Summe – ohne Datum und Spalte keinem Bereich zuzuordnen`;
const FREMDE_SPALTE_AUSSEN = `Spalte nicht auf diesem Board ${usd('0,25')} · nicht in der Summe – Einträge aus einer Spalte, die dieses Board nicht führt`;
const STAND_LETZTE = '„Stand“ ist der von heute · „erledigt“ heißt hier: in „Produktiv“ (letzte Spalte des Boards).';
const STAND_BIS_ABNAHME = '„Stand“ ist der von heute · „erledigt“ heißt hier: in „Abnahme“ oder rechts davon (Bis-Spalte des Abschnitts).';
const GELTUNG = 'Der Zeitraum gilt für alle Berichte dieses Boards, der Spaltenabschnitt nur für die Kosten · beide Grenzen zählen mit';
/** Die Zeilen der Gruppe ohne Bereiche (AK 3) — wie vor der Karte. */
const OHNE_BEREICHE = [`Einträge ${usd('11,00')}`, `${OHNE_DATUM} ${usd('5,00')}`, `Summe ${usd('16,00')} · 4 von 4 Aufgaben mit angefallenen Kosten, alle Spalten, auch archivierte`];
const summeImBereich = (betrag, n) => `Summe ${usd(betrag)} · ${n} von 4 Aufgaben mit angefallenen Kosten im gewählten Bereich, auch archivierte`;

/* ── Treiber: Bestand samt Kosteneinträgen über Dateien (die Route nähme keinen Eintrag an, dessen Spalte das Board nicht
   führt — so einer entsteht erst durch Umbenennen oder Entfernen der Spalte), Bedienung über die Bereichszeile ── */
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
const eintragMd = e => `  - {at: ${e.at}, role: ${e.role}, column: ${e.column}, amount: ${e.amount.toFixed(2)}, currency: ${e.currency}}\n`;
function aufgabeMd(a, titel = a.titel, zusatz = []) {
  let kopf = '';
  const eintraege = [...a.eintraege, ...zusatz];
  if (eintraege.length) kopf += `cost-entries:\n${eintraege.map(eintragMd).join('')}`;
  if (a.archiviert) kopf += `archived: ${a.archiviert}\n`;
  if (a.altePosten) kopf += `cost:\n  currency: USD\n  items:\n    - {text: Bau, amount: ${a.altePosten.toFixed(2)}}\n`;
  return `---\nid: ${a.nummer}\ntitle: ${titel}\n${kopf}---\n`;
}
/** `spalten` nennt die Spalten des Boards; eine umbenannte Spalte trägt als {name, wie} die Aufgaben der Vorlage `wie`. */
const boardMd = (kopf, spalten) => `${kopf}# fabrik\n\n` + spalten.map(sp => {
  const name = sp.name || sp, wie = sp.wie || sp;
  return `## ${name}\n\n${BEISPIEL.AUFGABEN.filter(a => a.spalte === wie).map(a => `- #${a.nummer}\n`).join('')}`;
}).join('\n');
/** Das Beispielboard als Dateien; `kopf` ist der YAML-Kopf der Board-Datei, `titel` überschreibt Titel je Nummer,
    `zusatz` hängt weitere Einträge an eine Aufgabe: {2: [FREMDE_SPALTE]}. */
function bestand({ kopf = '', spalten = BEISPIEL.SPALTEN, titel = {}, zusatz = {} } = {}) {
  return { 'boards/fabrik.md': boardMd(kopf, spalten), ...Object.fromEntries(BEISPIEL.AUFGABEN.map(a => [datei(a.nummer), aufgabeMd(a, titel[a.nummer], zusatz[a.nummer])])) };
}

test.describe('R00171 Bericht „Kosten“: Zeitraum, Spaltenabschnitt und Aufgabenliste', () => {
  let k;
  test.afterEach(() => k.stoppen());

  /** Startet kanbanD mit dem Beispielboard und öffnet den Bericht „Kosten“. */
  async function berichtOeffnen(page, dateien = bestand()) {
    k = await kanbanStarten(einrichten(dateien));
    await page.clock.setFixedTime(new Date(BEISPIEL.HEUTE));
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/board/fabrik');
    // erst wenn das Board steht: ein Bericht ohne Board im Hash nähme sonst das voreingestellte statt „fabrik“
    await bereit(page, page.locator('.bahn').first());
    await page.goto(k.adresse + '#/berichte/kosten');
    await bereit(page, '#kosten');
  }
  const bereich = page => page.getByRole('group', { name: 'Zeitraum und Spaltenabschnitt' });
  const feld = (page, name) => bereich(page).getByLabel(name, { exact: true });
  const zuruecksetzen = page => page.getByRole('button', { name: 'Zeitraum und Spaltenabschnitt zurücksetzen' });
  const gruppe = (page, waehrung = 'USD') => page.getByRole('group', { name: `Angefallene Kosten in ${waehrung}` });
  const zeilen = page => gruppe(page).locator('.kost-zeile');
  const liste = (page, name) => page.getByRole('table', { name });
  const listenzeilen = (page, name) => liste(page, name).locator('tbody tr');
  const staende = (page, name) => listenzeilen(page, name).locator('.kost-kz');
  const standSatz = page => page.locator('#kosten .kost-stand');
  const boardDatei = () => k.lies('boards/fabrik.md');
  /** Eine Wahl in der Bereichszeile ist erst durch, wenn sie gespeichert, das Nachladen danach übernommen und gezeichnet
      ist (ADR-0026 Regel 3) — bis dahin ersetzt ein Neuzeichnen jedes Feld. Der Kostenbericht lädt keine Bewegungen:
      sein Nachladen endet mit den zwei gleichzeitigen Anfragen nach Aufgaben und Boards. */
  async function waehlen(page, aktion) {
    const antwortAuf = pfad => page.waitForResponse(antwort => antwort.request().method() === 'GET' && new URL(antwort.url()).pathname === pfad);
    const nachgeladen = Promise.all(['/api/aufgaben', '/api/boards'].map(antwortAuf));
    await aktion();
    await Promise.all((await nachgeladen).map(antwort => antwort.finished()));
    await bereit(page, '#kosten');
    await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
  }
  async function zeitraumSetzen(page, von, bis) {
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('eigen'));
    await waehlen(page, () => feld(page, 'Zeitraum von').fill(von));
    await waehlen(page, () => feld(page, 'Zeitraum bis').fill(bis));
  }
  /** Wählt eine Spalte des Abschnitts über ihren Namen („alle“ hebt die Grenze auf). */
  const spalteWaehlen = (page, seite, name) => waehlen(page, () => feld(page, `Spalte ${seite}`).selectOption({ label: name }));
  const gewaehlt = (page, seite) => feld(page, `Spalte ${seite}`).locator('option:checked');
  const gesperrt = (page, seite) => feld(page, `Spalte ${seite}`).locator('option:disabled');
  /** AK 1: Zeitraum 12.11.–13.11., Abschnitt „Entwicklung“–„Abnahme“. */
  async function fallEinsWaehlen(page) {
    await zeitraumSetzen(page, '2026-11-12', '2026-11-13');
    await spalteWaehlen(page, 'von', 'Entwicklung');
    await spalteWaehlen(page, 'bis', 'Abnahme');
  }
  const bild = async (page, name) => { if (process.env.KD_BILDER) await page.screenshot({ path: path.join(process.env.KD_BILDER, name), fullPage: true }); };

  /* ── F0136: Zeitraum und Aufgabenliste ── */
  test('AK 3, AK 4: ohne Bereiche „Einträge 11,00 $“, alte Posten 5,00 $, Summe 16,00 $ wie vor der Karte; darunter die Aufgaben #1 6,46 $, #2 0,54 $, #3 4,00 $ — #4 mit alten Posten steht nie in der Liste', async ({ page }) => {
    await berichtOeffnen(page);
    await expect(page.locator('#main .leiste').first()).toHaveText('Kosten · angefallene API-Kosten');
    await expect(page.locator('.bf-zusammen')).toHaveText('Filter · keine');
    await expect(zeilen(page)).toHaveText(OHNE_BEREICHE);
    await expect(page.locator('#kosten .kost-aussen')).toHaveCount(0);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen').locator('.nr')).toHaveText(['#1', '#2', '#3']);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen').locator('.r')).toHaveText([usd('6,46'), usd('0,54'), usd('4,00')]);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen').getByRole('rowheader')).toHaveText(BEISPIEL.AUFGABEN.slice(0, 3).map(a => a.titel));
    await expect(liste(page, 'Aufgaben mit Einträgen').getByRole('columnheader')).toHaveText(['Nr.', 'Aufgabe', 'Betrag', 'Stand']);
    await expect(staende(page, 'Aufgaben mit Einträgen')).toHaveText(['erledigt', 'offen', 'archiviert']);
    await expect(standSatz(page)).toHaveText(STAND_LETZTE);
    await expect(feld(page, 'Zeitraum')).toHaveValue('alles');
    await expect(bereich(page).locator('.muted').last()).toHaveText(GELTUNG);
    await expect(zuruecksetzen(page)).toHaveCount(0);
    expect(boardDatei(), 'der Bericht schreibt nichts, solange nichts gewählt ist').not.toContain('report-filter');
  });

  test('US-1, US-3 (Teil Zeitraum; AK 1, 5, 6): Zeitraum 12.11.–13.11. → Summe 5,00 $, #1 4,46 $ und #2 0,54 $, alte Posten 5,00 $ daneben; gespeichert, nach dem Neuladen dieselbe Wahl; „Zurücksetzen“ zeigt wieder 16,00 $ und räumt die Board-Datei', async ({ page }) => {
    await berichtOeffnen(page);
    await zeitraumSetzen(page, '2026-11-12', '2026-11-13');
    const imZeitraum = async () => {
      await expect(zeilen(page)).toHaveText([`Einträge ${usd('5,00')}`, summeImBereich('5,00', 2), ALTE_POSTEN_AUSSEN]);
      await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.nr')).toHaveText(['#1', '#2']);
      await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.r')).toHaveText([usd('4,46'), usd('0,54')]);
      await expect(feld(page, 'Zeitraum')).toHaveValue('eigen');
      await expect(feld(page, 'Zeitraum von')).toHaveValue('2026-11-12');
      await expect(feld(page, 'Zeitraum bis')).toHaveValue('2026-11-13');
    };
    await imZeitraum();
    expect(boardDatei()).toContain('report-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13');
    await page.reload();
    await bereit(page, '#kosten');
    await imZeitraum();

    await waehlen(page, () => zuruecksetzen(page).click());
    await expect(zeilen(page)).toHaveText(OHNE_BEREICHE);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen').locator('.nr')).toHaveText(['#1', '#2', '#3']);
    await expect(zuruecksetzen(page)).toHaveCount(0);
    await expect(feld(page, 'Zeitraum')).toBeFocused();
    expect(boardDatei()).not.toContain('report-filter');
  });

  test('AK 9: Tagesgrenze beim Betrachter in +01:00 — der Eintrag von 13.11. 23:30 zählt zum 13.11., der von 14.11. 00:10 nicht: Summe 5,10 $', async ({ page }) => {
    await berichtOeffnen(page, bestand({ kopf: '---\nreport-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13}\n---\n', zusatz: { 2: [BEISPIEL.VOR_MITTERNACHT, BEISPIEL.NACH_MITTERNACHT] } }));
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('5,10')}`, summeImBereich('5,10', 2), ALTE_POSTEN_AUSSEN]);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.r')).toHaveText([usd('4,46'), usd('0,64')]);
  });

  test('Folge 1 und Bild 5: ein gespeicherter Zeitraum ohne Einträge wirkt jetzt auch hier — „Im gewählten Bereich sind keine Kosten angefallen“, die alten Posten daneben, keine Liste; ein benannter Zeitraum rechnet von der festen Uhr aus', async ({ page }) => {
    await berichtOeffnen(page, bestand({ kopf: '---\nreport-filter: {period: heute}\n---\n' }));
    await expect(page.locator('#kosten .kost-satz')).toHaveText('Im gewählten Bereich sind keine Kosten angefallen · 0 von 4 Aufgaben, auch archivierte');
    await expect(page.locator('#kosten .kost-hinweis')).toHaveText([ALTE_POSTEN_AUSSEN]);
    await expect(page.locator('#kosten .kost-liste')).toHaveCount(0);
    await expect(page.locator('#kosten .bf-leeren'), 'kein zweiter Knopf im Leerzustand').toHaveCount(0);
    await expect(feld(page, 'Zeitraum von')).toHaveValue('2026-11-16');
    await waehlen(page, () => feld(page, 'Zeitraum').selectOption('vorwoche'));
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('7,00')}`, summeImBereich('7,00', 2), ALTE_POSTEN_AUSSEN]);
  });

  test('Schaden f: ein Aufgabentitel mit HTML-Zeichen steht in der Liste als Text, nicht als Markup', async ({ page }) => {
    const titel = '<img src=x onerror="document.title=\'kaputt\'"> & <b>fett</b>';
    await berichtOeffnen(page, bestand({ titel: { 1: `'${titel.replaceAll("'", "''")}'` } }));
    const kopfzelle = listenzeilen(page, 'Aufgaben mit Einträgen').first().getByRole('rowheader');
    await expect(kopfzelle).toHaveText(titel);
    await expect(kopfzelle).toHaveAttribute('title', titel);
    await expect(page.locator('#kosten .kost-liste img, #kosten .kost-liste b')).toHaveCount(0);
    expect(await page.title()).not.toBe('kaputt');
  });
  /* ── F0137: Spaltenabschnitt samt Speichern ── */
  const ZEITRAUM_UND_ABSCHNITT = 'report-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13, cost-from-column: Entwicklung, cost-to-column: Abnahme}\n';

  test('US-1 (AK 1, AK 5): Zeitraum 12.11.–13.11. und Abschnitt „Entwicklung“–„Abnahme“ → Summe 5,00 $, #1 4,46 $ und #2 0,54 $, #3 fehlt, alte Posten 5,00 $ daneben; die Board-Datei trägt Zeitraum und beide Spalten, nach dem Neuladen dieselbe Wahl und dieselben Zahlen', async ({ page }) => {
    await berichtOeffnen(page);
    await expect(zeilen(page)).toHaveText(OHNE_BEREICHE);
    await expect(gewaehlt(page, 'von')).toHaveText('alle');
    await expect(gewaehlt(page, 'bis')).toHaveText('alle');
    await fallEinsWaehlen(page);
    const fallEins = async () => {
      await expect(zeilen(page)).toHaveText([`Einträge ${usd('5,00')}`, summeImBereich('5,00', 2), ALTE_POSTEN_AUSSEN]);
      await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.nr')).toHaveText(['#1', '#2']);
      await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.r')).toHaveText([usd('4,46'), usd('0,54')]);
      await expect(gewaehlt(page, 'von')).toHaveText('Entwicklung');
      await expect(gewaehlt(page, 'bis')).toHaveText('Abnahme');
      await expect(gesperrt(page, 'von'), 'rechts von „bis“ ist in „von“ nicht wählbar').toHaveText(['Produktiv']);
      await expect(gesperrt(page, 'bis'), 'links von „von“ ist in „bis“ nicht wählbar').toHaveText(['Eingang']);
    };
    await fallEins();
    expect(boardDatei()).toContain(ZEITRAUM_UND_ABSCHNITT);
    await page.reload();
    await bereit(page, '#kosten');
    await fallEins();
    await expect(feld(page, 'Zeitraum von')).toHaveValue('2026-11-12');
    await expect(feld(page, 'Zeitraum bis')).toHaveValue('2026-11-13');
    await expect(feld(page, 'Spalte von').locator('option')).toHaveText(['alle', ...BEISPIEL.SPALTEN]);
  });

  test('US-2 (AK 2): Zeitraum 12.11.–14.11. und Abschnitt „Abnahme“–„Abnahme“ → Summe 2,00 $, allein #1 mit 2,00 $ — ihre Einträge aus „Entwicklung“ zählen nicht', async ({ page }) => {
    await berichtOeffnen(page, bestand({ kopf: '---\nreport-filter: {period: eigen, from: 2026-11-12, to: 2026-11-14}\n---\n' }));
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('7,00')}`, summeImBereich('7,00', 2), ALTE_POSTEN_AUSSEN]);
    await spalteWaehlen(page, 'von', 'Abnahme');
    await spalteWaehlen(page, 'bis', 'Abnahme');
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('2,00')}`, summeImBereich('2,00', 1), ALTE_POSTEN_AUSSEN]);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.nr')).toHaveText(['#1']);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.r')).toHaveText([usd('2,00')]);
    expect(boardDatei()).toContain('report-filter: {period: eigen, from: 2026-11-12, to: 2026-11-14, cost-from-column: Abnahme, cost-to-column: Abnahme}\n');
  });

  test('US-3 (AK 6): „Zurücksetzen“ hebt Zeitraum und Abschnitt auf — wieder „Einträge 11,00 $“ und Summe 16,00 $ mit #1, #2, #3; die Board-Datei trägt keinen der Schlüssel mehr', async ({ page }) => {
    await berichtOeffnen(page, bestand({ kopf: `---\n${ZEITRAUM_UND_ABSCHNITT}---\n` }));
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('5,00')}`, summeImBereich('5,00', 2), ALTE_POSTEN_AUSSEN]);
    await expect(zuruecksetzen(page)).toHaveText('Zurücksetzen');
    await waehlen(page, () => zuruecksetzen(page).click());
    await expect(zeilen(page)).toHaveText(OHNE_BEREICHE);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen').locator('.nr')).toHaveText(['#1', '#2', '#3']);
    await expect(feld(page, 'Zeitraum')).toHaveValue('alles');
    await expect(gewaehlt(page, 'von')).toHaveText('alle');
    await expect(gewaehlt(page, 'bis')).toHaveText('alle');
    await expect(gesperrt(page, 'von')).toHaveCount(0);
    await expect(zuruecksetzen(page)).toHaveCount(0);
    await expect(feld(page, 'Zeitraum')).toBeFocused();
    expect(boardDatei()).not.toMatch(/report-filter|period|cost-from-column|cost-to-column/);
  });

  test('Schaden e: der Abschnitt und die übrigen Schlüssel von report-filter lassen einander stehen — Abschnitt wählen, einen Filter der Box schalten, die Box zurücksetzen, den Bereich zurücksetzen', async ({ page }) => {
    await berichtOeffnen(page, bestand({ kopf: '---\nstart: 2026-11-01\nreport-filter: {labels: [gibtsnicht], window-days: 30}\n---\n' }));
    await spalteWaehlen(page, 'von', 'Abnahme');
    expect(boardDatei()).toContain('report-filter: {labels: [gibtsnicht], window-days: 30, cost-from-column: Abnahme}\n');
    await expect(feld(page, 'Zeitraum'), 'eine Spaltenwahl macht aus dem Zeitraum keinen eigenen').toHaveValue('alles');

    await page.locator('details.bfilter-box summary').click();
    const fehler = page.getByRole('group', { name: 'Berichtsfilter' }).getByRole('button', { name: 'Fehler', exact: true });
    await waehlen(page, () => fehler.click());
    expect(boardDatei()).toContain('report-filter: {exclude-classes: [bug], labels: [gibtsnicht], window-days: 30, cost-from-column: Abnahme}\n');

    await waehlen(page, () => page.locator('.bf-fuss .bf-leeren').click());
    expect(boardDatei(), '„Zurücksetzen n“ der Box hebt nur Farben, Spalten, Zuständige und Labels auf').toContain('report-filter: {window-days: 30, cost-from-column: Abnahme}\n');
    await expect(gewaehlt(page, 'von')).toHaveText('Abnahme');
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('2,00')}`, summeImBereich('2,00', 1), ALTE_POSTEN_AUSSEN]);

    await waehlen(page, () => zuruecksetzen(page).click());
    const datei = boardDatei();
    expect(datei).toContain('report-filter: {window-days: 30}\n');
    expect(datei).toContain('start: 2026-11-01\n');
  });

  test('Schaden f: ein Spaltenname mit Sonderzeichen steht in der Auswahl als Text, wird gespeichert und nach dem Neuladen wieder gewählt — die Board-Datei bleibt lesbar', async ({ page }) => {
    const name = 'Abnahme: "extern" <b>fett</b> & Co';
    await berichtOeffnen(page, bestand({ spalten: ['Eingang', 'Entwicklung', { name, wie: 'Abnahme' }, 'Produktiv'] }));
    await expect(feld(page, 'Spalte bis').locator('option')).toHaveText(['alle', 'Eingang', 'Entwicklung', name, 'Produktiv']);
    await expect(bereich(page).locator('option b')).toHaveCount(0);
    await spalteWaehlen(page, 'bis', name);
    await expect(gewaehlt(page, 'bis')).toHaveText(name);
    expect(boardDatei()).toContain('cost-to-column: "Abnahme: \\"extern\\" <b>fett</b> & Co"}\n');
    await page.reload();
    await bereit(page, '#kosten');
    await expect(gewaehlt(page, 'bis')).toHaveText(name);
    await expect(gesperrt(page, 'von')).toHaveText(['Produktiv']);
    await expect(page.locator('#main .leer'), 'kein Defekt-Hinweis: das Board liest sich').toHaveCount(0);
  });
  /* ── F0138: Kennzeichen, Eimer und Texte ── */
  test('Abnahme-Probe der Karte #165: Fall 1 (12.11.–13.11., „Entwicklung“–„Abnahme“) → Summe 5,00 $, #1 4,46 $ „erledigt“, #2 0,54 $ „offen“, #3 fehlt, #4 unter „ohne …“ 5,00 $ daneben; Fall 2 (12.11.–14.11., „Abnahme“–„Abnahme“) → 2,00 $, nur #1; ohne Bereiche „Einträge 11,00 $“ und Summe 16,00 $', async ({ page }) => {
    const IM_BEREICH = 'Aufgaben mit Einträgen im gewählten Bereich';
    await berichtOeffnen(page);
    await fallEinsWaehlen(page);
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('5,00')}`, summeImBereich('5,00', 2), ALTE_POSTEN_AUSSEN]);
    await expect(listenzeilen(page, IM_BEREICH)).toHaveText([/^#1.*4,46\s\$erledigt$/, /^#2.*0,54\s\$offen$/]);
    await expect(standSatz(page)).toHaveText(STAND_BIS_ABNAHME);
    await bild(page, 'r00171-kosten-breit.png');

    await waehlen(page, () => feld(page, 'Zeitraum bis').fill('2026-11-14'));
    await spalteWaehlen(page, 'von', 'Abnahme');
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('2,00')}`, summeImBereich('2,00', 1), ALTE_POSTEN_AUSSEN]);
    await expect(listenzeilen(page, IM_BEREICH)).toHaveText([/^#1.*2,00\s\$erledigt$/]);

    await waehlen(page, () => zuruecksetzen(page).click());
    await expect(zeilen(page)).toHaveText(OHNE_BEREICHE);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen')).toHaveText([/^#1.*6,46\s\$erledigt$/, /^#2.*0,54\s\$offen$/, /^#3.*4,00\s\$archiviert$/]);
    await expect(standSatz(page)).toHaveText(STAND_LETZTE);
  });

  test('US-4 (AK 7): ein Eintrag aus „Review“, das das Board nicht führt — ohne Abschnitt „Einträge 11,25 $“; in Fall 1 bleibt die Summe 5,00 $, daneben „Spalte nicht auf diesem Board 0,25 $“, vor den alten Posten', async ({ page }) => {
    await berichtOeffnen(page, bestand({ zusatz: { 2: [BEISPIEL.FREMDE_SPALTE] } }));
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('11,25')}`, `${OHNE_DATUM} ${usd('5,00')}`, `Summe ${usd('16,25')} · 4 von 4 Aufgaben mit angefallenen Kosten, alle Spalten, auch archivierte`]);
    await expect(page.locator('#kosten .kost-aussen')).toHaveCount(0);
    await zeitraumSetzen(page, '2026-11-12', '2026-11-13');
    await expect(zeilen(page), 'mit Zeitraum allein zählt er weiter mit').toHaveText([`Einträge ${usd('5,25')}`, summeImBereich('5,25', 2), ALTE_POSTEN_AUSSEN]);
    await spalteWaehlen(page, 'von', 'Entwicklung');
    await spalteWaehlen(page, 'bis', 'Abnahme');
    await expect(zeilen(page)).toHaveText([`Einträge ${usd('5,00')}`, summeImBereich('5,00', 2), FREMDE_SPALTE_AUSSEN, ALTE_POSTEN_AUSSEN]);
    await expect(listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').locator('.r')).toHaveText([usd('4,46'), usd('0,54')]);
  });

  test('AK 8: eine gespeicherte Bis-Spalte „Test“, die das Board nicht führt, steht gewählt am Ende der Auswahl und wird genannt; der Abschnitt gilt als „alle“, die Zahlen sind die ohne Bereiche; „Zurücksetzen“ räumt sie aus der Datei', async ({ page }) => {
    await berichtOeffnen(page, bestand({ kopf: '---\nreport-filter: {cost-to-column: Test}\n---\n' }));
    await expect(gewaehlt(page, 'bis')).toHaveText('„Test“ — gibt es nicht mehr');
    await expect(feld(page, 'Spalte bis').locator('option')).toHaveText(['alle', ...BEISPIEL.SPALTEN, '„Test“ — gibt es nicht mehr']);
    await expect(page.locator('#kost-grenze-weg')).toHaveText('Spalte „Test“ (bis) gibt es nicht mehr — diese Grenze gilt als „alle“.');
    await expect(gesperrt(page, 'von')).toHaveCount(0);
    await expect(zeilen(page)).toHaveText(OHNE_BEREICHE);
    await expect(staende(page, 'Aufgaben mit Einträgen')).toHaveText(['erledigt', 'offen', 'archiviert']);
    await expect(standSatz(page)).toHaveText(STAND_LETZTE);
    await waehlen(page, () => zuruecksetzen(page).click());
    await expect(page.locator('#kost-grenze-weg')).toHaveCount(0);
    await expect(gewaehlt(page, 'bis')).toHaveText('alle');
    expect(boardDatei()).not.toContain('report-filter');
  });

  test('Zeichnung Bild 6: bei 375 px steht die Bereichszeile in einer Spalte, jedes Feld ist 48 px hoch, die Liste bleibt in der Breite und der Titel kürzt — nichts scrollt waagrecht', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 });
    await berichtOeffnen(page, bestand({ kopf: `---\n${ZEITRAUM_UND_ABSCHNITT}---\n`, zusatz: { 2: [BEISPIEL.FREMDE_SPALTE] } }));
    await breiteSetzen(page, 375, 900);
    const tabelle = liste(page, 'Aufgaben mit Einträgen im gewählten Bereich');
    await expect(tabelle).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const hoehen = await bereich(page).locator('select, input, button').evaluateAll(felder => felder.map(f => Math.round(f.getBoundingClientRect().height)));
    expect(hoehen).toEqual([48, 48, 48, 48, 48, 48]);
    const rahmen = await tabelle.boundingBox();
    expect(rahmen.x + rahmen.width).toBeLessThanOrEqual(375);
    const titel = listenzeilen(page, 'Aufgaben mit Einträgen im gewählten Bereich').nth(1).getByRole('rowheader');
    expect(await titel.evaluate(zelle => zelle.scrollWidth > zelle.clientWidth), 'der lange Titel von #2 kürzt mit Auslassungspunkten').toBe(true);
    await expect(titel).toHaveAttribute('title', BEISPIEL.AUFGABEN[1].titel);
    await expect(zeilen(page)).toHaveCount(4);
    await bild(page, 'r00171-kosten-375.png');
  });
});
