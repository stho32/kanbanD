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
const GELTUNG = 'Der Zeitraum gilt für alle Berichte dieses Boards, der Spaltenabschnitt nur für die Kosten · beide Grenzen zählen mit';
/** Die Zeilen der Gruppe ohne Bereiche (AK 3) — wie vor der Karte. */
const OHNE_BEREICHE = [`Einträge ${usd('11,00')}`, `${OHNE_DATUM} ${usd('5,00')}`, `Summe ${usd('16,00')} · 4 von 4 Aufgaben mit angefallenen Kosten, alle Spalten, auch archivierte`];
const summeImBereich = (betrag, n) => `Summe ${usd(betrag)} · ${n} von 4 Aufgaben mit angefallenen Kosten im gewählten Bereich, auch archivierte`;

/* ── Treiber: Bestand über Dateien, Einträge über die Route, Bedienung über die Bereichszeile ── */
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
function aufgabeMd(a, titel = a.titel) {
  let kopf = '';
  if (a.archiviert) kopf += `archived: ${a.archiviert}\n`;
  if (a.altePosten) kopf += `cost:\n  currency: USD\n  items:\n    - {text: Bau, amount: ${a.altePosten.toFixed(2)}}\n`;
  return `---\nid: ${a.nummer}\ntitle: ${titel}\n${kopf}---\n`;
}
const boardMd = (kopf, spalten) => `${kopf}# fabrik\n\n` + spalten.map(name => `## ${name}\n\n${BEISPIEL.AUFGABEN.filter(a => a.spalte === name).map(a => `- #${a.nummer}\n`).join('')}`).join('\n');
/** Das Beispielboard als Dateien; `kopf` ist der YAML-Kopf der Board-Datei, `titel` überschreibt Titel je Nummer. */
function bestand({ kopf = '', spalten = BEISPIEL.SPALTEN, titel = {} } = {}) {
  return { 'boards/fabrik.md': boardMd(kopf, spalten), ...Object.fromEntries(BEISPIEL.AUFGABEN.map(a => [datei(a.nummer), aufgabeMd(a, titel[a.nummer])])) };
}

test.describe('R00171 Bericht „Kosten“: Zeitraum, Spaltenabschnitt und Aufgabenliste', () => {
  let k;
  test.afterEach(() => k.stoppen());

  /** Startet kanbanD mit dem Beispielboard, legt die Einträge an (`zusatz` je Nummer dazu) und öffnet den Bericht „Kosten“. */
  async function berichtOeffnen(page, dateien = bestand(), zusatz = {}) {
    k = await kanbanStarten(einrichten(dateien));
    for (const a of BEISPIEL.AUFGABEN) {
      for (const eintrag of [...a.eintraege, ...(zusatz[a.nummer] || [])]) {
        const antwort = await page.request.post(`${k.adresse}api/aufgaben/${a.nummer}/kosteneintraege`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: eintrag });
        expect(antwort.status(), JSON.stringify(eintrag)).toBe(200);
      }
    }
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
  const boardDatei = () => k.lies('boards/fabrik.md');
  /** Eine Wahl in der Bereichszeile ist erst durch, wenn sie gespeichert, das Nachladen danach übernommen und gezeichnet
      ist (ADR-0026 Regel 3) — bis dahin ersetzt ein Neuzeichnen jedes Feld. Der Kostenbericht lädt keine Bewegungen:
      sein Nachladen endet mit den drei gleichzeitigen Anfragen nach Aufgaben, Herkunft und Boards. */
  async function waehlen(page, aktion) {
    const antwortAuf = pfad => page.waitForResponse(antwort => antwort.request().method() === 'GET' && new URL(antwort.url()).pathname === pfad);
    const nachgeladen = Promise.all(['/api/aufgaben', '/api/herkunft', '/api/boards'].map(antwortAuf));
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
    await berichtOeffnen(page, bestand({ kopf: '---\nreport-filter: {period: eigen, from: 2026-11-12, to: 2026-11-13}\n---\n' }), { 2: [BEISPIEL.VOR_MITTERNACHT, BEISPIEL.NACH_MITTERNACHT] });
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
});
