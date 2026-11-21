// R00109 Datumsangaben und Feldbeschriftungen deutsch (ADR-0013, Aspekt X00004)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, bereit, reiter } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');
const { isoFundstellen, beschriftungenPruefen, ausnahmenAbgleichen } = require('./kultur-hilfen');
const { FELDER } = require('../../web/kultur.js');
const { ansichtenDerAnwendung } = require('./ansichten');

// „Heute“ ist der Tag des Laufs in Europe/Berlin (playwright.config.js); die erwarteten Texte rechnet der Test aus ihm.
const tag = n => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(Date.now() + n * 864e5));
const HEUTE = tag(0);
const JAHR = Number(HEUTE.slice(0, 4));
const VORJAHR_3012 = `${JAHR - 1}-12-30`;
const VORJAHR_1503 = `${JAHR - 1}-03-15`;
const FOLGEJAHR_0101 = `${JAHR + 1}-01-01`;
const lang = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const kurz = iso => iso.startsWith(`${JAHR}-`) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : lang(iso);
const ISO = /\d{4}-\d{2}-\d{2}/;

// Tagesrechnung in UTC, damit die Zeitumstellung keinen Tag verschiebt
const utc = iso => new Date(iso + 'T00:00:00Z');
const plus = (iso, n) => { const d = utc(iso); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const montag = iso => plus(iso, -((utc(iso).getUTCDay() + 6) % 7));
const woche = iso => [0, 1, 2, 3, 4, 5, 6].map(n => plus(montag(iso), n));

/** Hilfstext beider Herkunftsfelder (Aufgabenfenster und „Neue Aufgabe“). */
const HERKUNFT_HILFE = 'WBS-Knoten I0001, Anforderung R00014, mit Kürzel der Anwendung kd:I0001, oder „ohne Herkunft“ · Enter';
const ALS_ST = { headers: { 'X-KanbanD-Wer': 'st' } };
const ALS_CL = { headers: { 'X-KanbanD-Wer': 'cl', 'X-KanbanD-Instanz': 'lauf-1' } };

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0002', 'Interaction', 'D0001', 'Ansehen', 'rot', { fertig: 'US-1' }),
]);
const einstellungen = arbeit => `---
people:
  st: {name: Stefan, kind: human}
  mi: {name: Mia, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
  feature: {label: Funktion, color: green}
sources:
  wbs: ""
  requirements: ""
  applications:
    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}
---
`;
const BOARD = `---
start: ${tag(-14)}
column-phases:
  In Arbeit: Entwicklung
---

# Entwicklung

## Zu erledigen

- #2
- #4
- #5
- #6

## In Arbeit

- #1

## Erledigt

- #3
`;
const karte = (nr, titel, kopf = '', rumpf = '') => `---\nid: ${nr}\ntitle: ${titel}\n${kopf}---\n${rumpf}`;
const EINS_RUMPF = `
\`\`\`kanbanD-comments
2026-10-17 09:00+02:00 · cl · Erster Gedanke
\`\`\`

\`\`\`kanbanD-time
${HEUTE} 09:00 · ${HEUTE} 10:00 · st
${VORJAHR_3012} 09:00 · ${VORJAHR_3012} 10:00 · st
\`\`\`

\`\`\`kanbanD-runs
${HEUTE} 14:05 · Entwicklung · bestanden · st · -
${VORJAHR_3012} 14:05 · Entwicklung · bestanden · st · -
\`\`\`
`;
const grundbestand = arbeit => ({
  'kanbanD.md': einstellungen(arbeit),
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': karte(1, 'eins', `class: bug\nassignees: [st]\ndue: ${HEUTE}\norigins: [I0001, R00014]\nwbs-effects:\n  - {application: kd, action: create, node: I0001, parent: D0001, level: Interaction, name: Eins}\n`, EINS_RUMPF),
  'aufgaben/0002-zwei.md': karte(2, 'zwei', `assignees: [cl]\ndue: ${VORJAHR_1503}\n`),
  'aufgaben/0003-drei.md': karte(3, 'drei', 'archived: 2026-10-01\n'),
  'aufgaben/0004-vier.md': karte(4, 'vier', `due: ${FOLGEJAHR_0101}\n`),
  'aufgaben/0005-fuenf.md': karte(5, 'fünf', 'due: 2026-12-31\n'),
  'aufgaben/0006-sechs.md': karte(6, 'sechs', 'due: 2027-01-01\n'),
});

let k, arbeit;
const starten = async page => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(einrichten(grundbestand(arbeit)));
  expect((await page.request.post(`${k.adresse}api/aufgaben/2/reservierung`, ALS_CL)).ok()).toBe(true);
  await alsPerson(page, 'st');
};
test.afterEach(async () => {
  if (k) await k.stoppen();
  if (arbeit) arbeit.aufraeumen();
  k = null; arbeit = null;
});

const brett = async page => { await page.goto(k.adresse + '#/board/entwicklung'); await page.locator('.ka[data-id="1"]').waitFor(); };
/** Öffnet das Aufgabenfenster einer Karte des Boards. */
async function fensterOeffnen(page, nummer) {
  await brett(page);
  await page.locator(`.ka[data-id="${nummer}"] .t`).click();
  return page.getByRole('dialog', { name: `Aufgabe #${nummer}` });
}
const fenster = page => page.locator('#fenster');
const schliessen = page => page.keyboard.press('Escape');
/** Schließt über ✕: Esc im Feld mit abgelehnter Eingabe verwirft zuerst die Eingabe und lässt das Fenster offen (R00155 54-7). */
const schliessenUeberKnopf = page => fenster(page).getByRole('button', { name: 'Schließen', exact: true }).click();

test.describe('US-1 bis US-5: Datumsangaben', () => {
  test('US-1: Fälligkeit auf der Karte kurz im laufenden Jahr, sonst lang, Name und title mit Jahr', async ({ page }) => {
    await starten(page);
    await brett(page);
    const due = nr => page.locator(`.ka[data-id="${nr}"] .due`);
    await expect(due(1)).toHaveText(kurz(HEUTE));
    await expect(due(1)).toHaveAttribute('title', `fällig ${lang(HEUTE)}`);
    // was ein Screenreader liest: „fällig“ mit Jahr, nicht nur die sichtbare Kurzform
    const vorgelesen = await page.locator('.ka[data-id="1"]').ariaSnapshot();
    expect(vorgelesen).toContain(`fällig ${lang(HEUTE)}`);
    expect(vorgelesen).not.toMatch(new RegExp(kurz(HEUTE).replace(/\./g, '\\.') + '(?!\\d{4})'));
    await expect(due(2)).toHaveText(lang(VORJAHR_1503));
    await expect(page.locator('.ka[data-id="2"] .signal.faellig')).toHaveAttribute('aria-label', `überfällig seit ${lang(VORJAHR_1503)}`);
    await expect(due(4)).toHaveText(lang(FOLGEJAHR_0101));
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('eins due:morgen');
    await expect(page.locator('#neu-vorschau .due')).toHaveText(`fällig ${lang(tag(1))}`);
    const karten = await page.locator('.ka').evaluateAll(l => l.flatMap(e => [e.innerText, ...[...e.querySelectorAll('[title],[aria-label]')].flatMap(x => [x.title, x.getAttribute('aria-label') || ''])]));
    expect(karten.filter(t => ISO.test(t))).toEqual([]);
  });

  test('Fälligkeit, die kein Datum ist, erscheint unverändert und escaped auf der Karte und im Signal „überfällig“ (Code-Review A1)', async ({ page }) => {
    arbeit = arbeitsRepository(WBS);
    const bestand = grundbestand(arbeit);
    bestand['boards/entwicklung.md'] = BOARD.replace('- #6\n', '- #6\n- #7\n- #8\n');
    bestand['aufgaben/0007-sieben.md'] = karte(7, 'sieben', 'due: "<b>x"\n');
    // vor heute im Zeichenvergleich, also „überfällig“; das Anführungszeichen will aus dem Attribut ausbrechen
    bestand['aufgaben/0008-acht.md'] = karte(8, 'acht', `due: '1" data-ausbruch="x'\n`);
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await brett(page);
    const sieben = page.locator('.ka[data-id="7"]');
    await expect(sieben.locator('.due')).toHaveText('<b>x');
    await expect(sieben.locator('.due')).toHaveAttribute('title', 'fällig <b>x');
    expect(await sieben.locator('b').count()).toBe(0);
    expect(await sieben.ariaSnapshot()).toContain('fällig <b>x');
    const signal = page.locator('.ka[data-id="8"] .signal.faellig');
    await expect(signal).toHaveAttribute('aria-label', 'überfällig seit 1" data-ausbruch="x');
    await expect(signal).toHaveAttribute('title', 'überfällig seit 1" data-ausbruch="x');
    await expect(signal).not.toHaveAttribute('data-ausbruch');
  });

  test('US-2: Kommentar, Reservierungen, Archivleiste lang; Reiter Datei und Datumsfeld bleiben ISO', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await expect(fenster(page).locator('.km').first()).toContainText('Claude · 17.10.2026 09:00');
    await reiter(page, 'Details');
    await expect(page.getByLabel('Fälligkeit', { exact: true })).toHaveValue(HEUTE);
    await reiter(page, 'Datei');
    await expect(page.locator('#dateitext')).toContainText(`due: ${HEUTE}`);
    await schliessen(page);
    await fensterOeffnen(page, 2);
    await reiter(page, 'Details');
    await expect(page.locator('#reservierung')).toContainText(/seit \d\d:\d\d ·/);
    await expect(page.locator('#reservierung')).not.toContainText(ISO);
    await schliessen(page);
    await page.locator('#t-board').click();
    await page.locator('#reservierungen-zeigen').click();
    await expect(page.locator('#reservierungen tr[data-reserviert="2"] td').nth(5)).toHaveText(new RegExp(`^${lang(HEUTE).replace(/\./g, '\\.')} \\d\\d:\\d\\d$`));
    await page.keyboard.press('Escape');
    await page.locator('[data-act="archiv-an"]').click();
    await page.locator('.ka[data-id="3"]').click();
    await expect(page.locator('.mod .archbar')).toContainText('Archiviert am 01.10.2026');
  });

  test('US-3: Durchläufe und Zeiten im laufenden Jahr kurz, sonst lang', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await expect(page.locator('#durchlaeufe tbody tr td:first-child')).toHaveText([`${kurz(HEUTE)} 14:05`, `${lang(VORJAHR_3012)} 14:05`]);
    await reiter(page, 'Zeiten');
    await expect(page.locator('table.zt tr[data-zeit] td:first-child')).toHaveText([kurz(HEUTE), lang(VORJAHR_3012)]);
  });

  // Regel 6 (ADR-0026, R00151): Die Uhr des Browsers steht auf einem festen Tag, und Woche, laufendes Jahr und der Weg zur
  // Neujahrswoche rechnen aus genau diesem Tag — Sonntag, Montag und Samstag decken die Wochengrenze an jedem Tag des Laufs.
  // `leiste` und `zurueck` sind die Zusagen aus R00151 AK 1–4; an ihnen wird zuerst die Rechnung der Probe geprüft.
  const GESTELLT = [
    { wochentag: 'Sonntag', datum: '2026-11-15', leiste: '09.11.2026 – 15.11.2026', zurueck: 45 },
    { wochentag: 'Montag', datum: '2026-11-16', leiste: '16.11.2026 – 22.11.2026', zurueck: 46 },
    { wochentag: 'Samstag', datum: '2026-11-21', leiste: '16.11.2026 – 22.11.2026', zurueck: 46 },
  ];
  const leiste = tage => `${lang(tage[0])} – ${lang(tage[6])}`;
  for (const gestellt of GESTELLT) {
    test(`US-4: Personen „zuletzt“ und Wochenleiste lang, Tagesköpfe kurz im laufenden Jahr — Uhr auf ${gestellt.wochentag}, ${lang(gestellt.datum)}`, async ({ page }) => {
      const jahr = gestellt.datum.slice(0, 4);
      const kurzImJahr = iso => iso.startsWith(`${jahr}-`) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.` : lang(iso);
      const tage = woche(gestellt.datum);
      const neujahr = woche(`${jahr}-01-01`);
      const wochenZurueck = (utc(tage[0]) - utc(neujahr[0])) / (7 * 864e5);
      expect([leiste(tage), wochenZurueck, leiste(neujahr)]).toEqual([gestellt.leiste, gestellt.zurueck, '29.12.2025 – 04.01.2026']);
      expect(neujahr.map(kurzImJahr)).toEqual(['29.12.2025', '30.12.2025', '31.12.2025', '01.01.', '02.01.', '03.01.', '04.01.']);

      await starten(page);
      // Stefans letzte Zeit liegt heute; einen Tag später zeigt „zuletzt“ ein Datum statt der Uhrzeit
      await page.clock.install({ time: new Date(Date.now() + 864e5) });
      await page.goto(k.adresse + '#/personen');
      await expect(page.locator('tr[data-person="st"]')).toContainText(`zuletzt ${lang(HEUTE)}`);
      // mittags in Europe/Berlin (im November UTC+1), fern der Tagesgrenze
      await page.clock.setFixedTime(new Date(`${gestellt.datum}T12:00:00+01:00`));
      await page.goto(k.adresse + '#/berichte/stundenzettel');
      await expect(page.locator('#woche')).toHaveText(leiste(tage));
      await expect(page.locator('#stundenzettel thead th .mono')).toHaveText(tage.map(kurzImJahr));
      for (let w = 0; w < wochenZurueck; w++) await page.getByRole('button', { name: 'vorige Woche' }).click();
      await expect(page.locator('#woche')).toHaveText(leiste(neujahr));
      await expect(page.locator('#stundenzettel thead th .mono')).toHaveText(neujahr.map(kurzImJahr));
    });
  }

  test('US-5: Tabellenansichten lang, Achsenmarken TT.MM. über JJJJ, Tooltips mit Wochentag', async ({ page }) => {
    await starten(page);
    await page.request.put(k.adresse + 'api/boards/entwicklung/termine', { ...ALS_ST, data: [{ name: 'Deadline', datum: tag(20), farbe: 'red', ziel: true }] });
    // Kalendertage: in der Einheit Arbeitstage hätte das Fieber an einem Wochenende keinen Punkt und keine Tabelle
    await page.request.put(k.adresse + 'api/boards/entwicklung/fieber', { ...ALS_ST, data: { puffer: 4, zielspalte: 'Entwicklung', woche: 7 } });
    // die Prognose braucht drei erledigte Aufgaben in der Messbasis
    for (const nummer of [4, 5, 6]) await page.request.post(k.adresse + 'api/boards/entwicklung/bewegen', { ...ALS_ST, data: { nummer, spalte: 'Erledigt' } });
    const TAG_LANG = /^\d\d\.\d\d\.\d{4}$/;
    const MIT_WOCHENTAG = /(Mo|Di|Mi|Do|Fr|Sa|So) \d\d\.\d\d\.\d{4}/;
    for (const [bericht, tabelle] of [['verlauf', '.tabellenansicht table'], ['prognose', '.tabellenansicht table'], ['fieber', '#fb-tabelle']]) {
      await page.goto(k.adresse + '#/berichte/' + bericht);
      // erst wenn der Bericht steht (ADR-0026 Regel 3): bis dahin zeigt die Seite noch die Tabelle des vorigen, und der Fever-Chart
      // rechnet und speichert seine Tage — wer ihn vorher verlässt, bekommt das Zeichnen danach in den nächsten Bericht (#179)
      await berichtSteht(page, bericht, BERICHTSTITEL[bericht]);
      await bereit(page, '.tabellenansicht summary');
      await page.locator('.tabellenansicht summary').click();
      const tage = page.locator(`${tabelle} tbody tr td:first-child`);
      await expect.poll(() => tage.count(), bericht).toBeGreaterThan(0);
      await expect.poll(async () => (await tage.allTextContents()).filter(t => !TAG_LANG.test(t)), bericht).toEqual([]);
    }
    for (const [bericht, name, kopf] of [['verlauf', 'Offene Aufgaben je Tag', MIT_WOCHENTAG],
      ['durchlauf', 'Durchlaufzeit je Aufgabe', /Ankunft (Mo|Di|Mi|Do|Fr|Sa|So) \d\d\.\d\d\.\d{4}/],
      ['prognose', 'Noch nicht erreichte Aufgaben', MIT_WOCHENTAG]]) {
      await page.goto(k.adresse + '#/berichte/' + bericht);
      // der Bericht ersetzt das Diagramm des vorigen erst nach dem Rendern
      const svg = page.getByRole('img', { name: new RegExp('^' + name) });
      // eine Marke ist ein text.achse mit zwei Zeilen (tspan, R00073): TT.MM. über JJJJ
      const marke = svg.locator('text.achse', { has: page.locator('tspan', { hasText: /^\d{4}$/ }) }).first();
      await expect(marke.locator('tspan')).toHaveText([/^\d\d\.\d\d\.$/, /^\d{4}$/]);
      // erst wenn der Bericht steht: ein Neuzeichnen nach dem Zeigerzug nähme die Blase mit, und der Zeiger bewegt sich nur einmal (ADR-0026 Regel 3)
      await berichtSteht(page, bericht, BERICHTSTITEL[bericht]);
      await bereit(page, svg);
      const box = await svg.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.locator('#tooltip'), bericht).toContainText(kopf);
      await page.mouse.move(1, 1);
    }
    const TITEL = { stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', durchlauf: 'Durchlaufzeit',
      prognose: 'Wie lange noch', fieber: 'Projekt-Fever-Chart', kosten: 'Kosten', bestand: 'Bestand nach Labels' };
    for (const [bericht, titel] of Object.entries(TITEL)) {
      await page.goto(k.adresse + '#/berichte/' + bericht);
      await berichtSteht(page, bericht, titel);
      // alles Zugeklappte aufklappen, eins nach dem anderen — ein aufgeklapptes fällt aus der Auswahl
      await allesAufklappen(page);
      const texte = await page.locator('main, body').first().evaluate(b => [b.innerText, ...[...b.querySelectorAll('[title],[aria-label]')].flatMap(x => [x.title, x.getAttribute('aria-label') || ''])]);
      expect(texte.filter(t => ISO.test(t)).map(t => t.match(ISO)[0]), bericht).toEqual([]);
    }
  });
});

/**
 * Bekannte ISO-Fundstellen, die (noch) nicht gemeldet werden dürfen — je Eintrag Ansicht, Selektor, Text, Folgekarte, Grund.
 * Leer (FA 19); ein Eintrag schlägt Alarm, sobald seine Fundstelle verschwindet, damit die Liste nur schrumpft.
 */
const AUSNAHMEN = [];

/** Titel der Berichte: erst wenn er steht, hat der Bericht das Bild des vorigen ersetzt. */
const BERICHTSTITEL = { stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', fluss: 'Kumulativer Fluss', durchsatz: 'Durchsatz je Zeitraum', durchlauf: 'Durchlaufzeit',
  prognose: 'Wie lange noch', fieber: 'Projekt-Fever-Chart', kosten: 'Kosten', bestand: 'Bestand nach Labels' };
/**
 * Der Bericht ist fertig gezeichnet: sein Titel steht, und beim Fever-Chart hat der Lauf, der die fehlenden Tage nachrechnet, geendet
 * (`#fieber-lauf` nennt dann den Cache statt „rechnet“) — bis dahin kommen Zeichnungen nach, die aufgeklappte Teile wieder schließen.
 */
async function berichtSteht(page, bericht, titel) {
  await expect(page.locator('.leiste > b').first()).toHaveText(titel);
  if (bericht === 'fieber') await expect(page.locator('#fieber-lauf')).toContainText('aus dem Cache');
}
/**
 * Klappt alles Zugeklappte auf, eins nach dem anderen — ein aufgeklapptes fällt aus der Auswahl. Der Bericht zeichnet noch, während
 * gezählt wird (Fieber: das Diagramm kommt nach der Leiste): eine feste Zahl Klicks liest `zu.count()` mitten im Zeichnen. Darum
 * erst warten, bis der Stand gezeichnet ist, und den ganzen Durchgang wiederholen, solange danach noch etwas zu ist (ADR-0026 Regel 1, 3).
 */
async function allesAufklappen(page) {
  await page.waitForFunction(() => window.kdTest.gezeichnet());
  const zu = page.locator('details:not([open]) > summary');
  await expect(async () => {
    for (let n = 0; n < 50 && await zu.count(); n++) await zu.first().click();
    await expect(zu).toHaveCount(0, { timeout: 1000 });
  }).toPass({ timeout: 15000 });
}
/** Was eine Ansicht der gemeinsamen Liste nach dem Laden noch braucht, bis ihr Inhalt steht. */
function nachDemLaden(ansicht) {
  if (ansicht === 'Board') return page => page.locator('.ka[data-id="1"]').waitFor();
  if (ansicht === 'Personen') return page => page.locator('tr[data-person="st"]').waitFor();
  if (ansicht === 'Aufgabenliste') return page => page.locator('main').getByText('eins').first().waitFor();
  if (ansicht === 'Einrichten') return page => page.locator('pre.yaml').first().waitFor();
  const bericht = ansicht.startsWith('Bericht ') && ansicht.slice(8);
  if (bericht && BERICHTSTITEL[bericht]) return page => berichtSteht(page, bericht, BERICHTSTITEL[bericht]);
  throw new Error(`nachDemLaden kennt „${ansicht}“ nicht — ohne Wartebedingung läse die Probe eine leere Seite`);
}
const menue = id => async page => { await brett(page); await page.locator(id).click(); await page.getByRole('menu').first().waitFor(); };
/** Der Tooltip eines Diagramms erscheint erst unter dem Zeiger (FA 18): einmal über die Mitte der Zeichenfläche. */
const tooltip = (bericht, name) => async page => {
  await page.goto(k.adresse + '#/berichte/' + bericht);
  const svg = page.getByRole('img', { name: new RegExp('^' + name) });
  // erst wenn der Bericht steht: ein Neuzeichnen nach dem Zeigerzug nähme die Blase mit, und der Zeiger bewegt sich nur einmal (ADR-0026 Regel 3)
  await berichtSteht(page, bericht, BERICHTSTITEL[bericht]);
  await bereit(page, svg);
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('#tooltip').waitFor();
};

/**
 * Die Ansichten der Probe (FA 18): jede Ansicht der gemeinsamen Liste (ADR-0012 Regel 6), dazu Karte und Fenster (B0430)
 * und die Zustände, die nur unter einer Handlung erscheinen. `leer` startet in einem leeren Ordner (erster Start).
 */
const ANSICHTEN = [
  ...ansichtenDerAnwendung({ board: 'entwicklung' }).map(({ ansicht, adresse }) => ({
    ansicht,
    oeffnen: async page => { await page.goto(k.adresse + adresse); await liveBereit(page); await nachDemLaden(ansicht)(page); await allesAufklappen(page); },
  })),
  { ansicht: 'Archiv des Boards', oeffnen: async page => { await brett(page); await page.locator('[data-act="archiv-an"]').click(); await page.locator('.ka[data-id="3"]').waitFor(); } },
  { ansicht: 'Aufgabenfenster #1', oeffnen: async page => { await (await fensterOeffnen(page, 1)).locator('.km').first().waitFor(); } },
  { ansicht: 'Aufgabenfenster #3 (archiviert)', oeffnen: async page => { await brett(page); await page.locator('[data-act="archiv-an"]').click(); await page.locator('.ka[data-id="3"]').click(); await page.locator('.mod .archbar').waitFor(); } },
  { ansicht: 'Neue Aufgabe', oeffnen: async page => { await brett(page); await page.keyboard.press('n'); await page.getByRole('dialog', { name: 'Neue Aufgabe' }).waitFor(); } },
  { ansicht: 'API für Agenten', oeffnen: async page => { await page.goto(k.adresse + 'api'); await page.locator('body').getByText('JJJJ-MM-TT').first().waitFor(); } },
  // Das Menü „<Seite> ▾“ gibt es nur in der Stufe compact (unter 600 px, web/kopfzeile.js)
  { ansicht: 'Menü Seite', breite: 560, oeffnen: menue('#t-seite') },
  { ansicht: 'Menü Mehr', oeffnen: menue('#t-mehr') },
  { ansicht: 'Menü Berichte', oeffnen: menue('#t-ber') },
  { ansicht: 'Menü Ich', oeffnen: menue('#t-ich') },
  { ansicht: 'Kontextmenü #1', oeffnen: async page => { await brett(page); await page.locator('.ka[data-id="1"]').click({ button: 'right' }); await page.getByRole('menu').first().waitFor(); } },
  { ansicht: 'Aufgabenreservierungen des Boards', oeffnen: async page => { await brett(page); await page.locator('#t-board').click(); await page.locator('#reservierungen-zeigen').click(); await page.locator('#reservierungen tbody tr').first().waitFor(); } },
  { ansicht: 'Tooltip Burndown', oeffnen: tooltip('verlauf', 'Offene Aufgaben je Tag') },
  { ansicht: 'Tooltip Durchlaufzeit', oeffnen: tooltip('durchlauf', 'Durchlaufzeit je Aufgabe') },
  { ansicht: 'Tooltip Wie lange noch', oeffnen: tooltip('prognose', 'Noch nicht erreichte Aufgaben') },
  { ansicht: 'Erster Start', leer: true, oeffnen: async page => { await page.goto(k.adresse); await page.getByRole('button', { name: 'Einrichten und committen' }).waitFor(); } },
];
/** Die Zustände aus FA 18 und B0430, die die gemeinsame Liste nicht kennt. */
const ZUSTAENDE = ['Archiv des Boards', 'Aufgabenfenster #1', 'Aufgabenfenster #3 (archiviert)', 'Neue Aufgabe', 'API für Agenten', 'Menü Seite', 'Menü Mehr',
  'Menü Berichte', 'Menü Ich', 'Kontextmenü #1', 'Aufgabenreservierungen des Boards', 'Tooltip Burndown', 'Tooltip Durchlaufzeit', 'Tooltip Wie lange noch', 'Erster Start'];

/** Vollständigkeit (FA 18, wie ziele.spec.js): welche verlangte Ansicht fehlt der Probe, welche steht doppelt. */
function vollstaendigkeit(namen, gemeinsam, zustaende) {
  return { fehlend: [...gemeinsam, ...zustaende].filter(name => !namen.includes(name)), doppelt: namen.filter((n, i) => namen.indexOf(n) !== i) };
}

test.describe('US-6: keine ISO-Form in keiner Ansicht', () => {
  test('die Ausnahmeliste ist leer', () => {
    expect(AUSNAHMEN).toEqual([]);
  });
  test('Vollständigkeit: jede Ansicht der gemeinsamen Liste und jeder Zustand steht in der Probe, keiner doppelt', () => {
    const gemeinsam = ansichtenDerAnwendung({ board: 'entwicklung' }).map(a => a.ansicht);
    expect(vollstaendigkeit(ANSICHTEN.map(a => a.ansicht), gemeinsam, ZUSTAENDE)).toEqual({ fehlend: [], doppelt: [] });
  });
  test('jede Ansicht der gemeinsamen Liste hat eine Wartebedingung, eine unbekannte fällt auf', () => {
    for (const { ansicht } of ansichtenDerAnwendung({ board: 'entwicklung' })) expect(typeof nachDemLaden(ansicht), ansicht).toBe('function');
    expect(() => nachDemLaden('Bericht neu')).toThrow('nachDemLaden kennt „Bericht neu“ nicht');
  });
  test('Selbstprobe der Vollständigkeit: eine neue Ansicht der gemeinsamen Liste und eine doppelte fallen auf', () => {
    const gemeinsam = [...ansichtenDerAnwendung({ board: 'entwicklung' }).map(a => a.ansicht), 'Bericht neu'];
    const namen = [...ANSICHTEN.map(a => a.ansicht), 'Menü Ich'];
    expect(vollstaendigkeit(namen, gemeinsam, ZUSTAENDE)).toEqual({ fehlend: ['Bericht neu'], doppelt: ['Menü Ich'] });
  });
  for (const { ansicht, oeffnen, breite, leer } of ANSICHTEN) {
    test(`US-6: ${ansicht} ohne ISO-Form in Text, title und Namen`, async ({ page }) => {
      if (breite) await page.setViewportSize({ width: breite, height: 800 });
      if (leer) { k = await kanbanStarten(); } else await starten(page);
      await oeffnen(page);
      const { offen, alarme } = ausnahmenAbgleichen(await isoFundstellen(page, ansicht), AUSNAHMEN, ansicht);
      expect(alarme).toEqual([]);
      expect(offen).toEqual([]);
    });
  }
});

test.describe('US-7, US-8: Feldbeschriftungen deutsch, Schlüssel als eigener Hilfstext außerhalb von .k (B0436, B0437)', () => {
  const verstoesse = felder => felder.flatMap(f => f.verstoesse.map(v => `${f.beschriftung}: ${v}`));
  const beschriftungen = felder => felder.map(f => f.beschriftung);
  test('US-7: Beschriftungen im Aufgabenfenster und in „Neue Aufgabe“ deutsch, Schlüssel als eigenes Element außerhalb der Beschriftung', async ({ page }) => {
    await starten(page);
    const aufgabe = await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    // erst wenn die Felder stehen, ist die Probe ein Befund und kein zu früher Blick
    await aufgabe.locator('.felder .k').first().waitFor();
    const imFenster = await beschriftungenPruefen(aufgabe, FELDER);
    expect(verstoesse(imFenster)).toEqual([]);
    expect(beschriftungen(imFenster)).toEqual(expect.arrayContaining(['Spalte', 'Klasse', 'Herkunft', 'Zuständig', 'Labels', 'Fällig']));
    await expect(aufgabe.getByRole('group', { name: 'Zuständig', exact: true })).toBeVisible();
    // die vorhandenen Namen bleiben (FA 12)
    for (const name of ['Spalte', 'Klasse', 'Labels', 'Fälligkeit', 'Neue Herkunft']) await expect(aufgabe.getByLabel(name, { exact: true }), name).toHaveCount(1);
    // R00155 #87 (Betreiber 2026-11-13): „Zählt in Berichten“ nennt den Schlüssel reporting — Rahmen .kb statt nacktem .k
    await expect(aufgabe.locator('.felder > .k', { hasText: 'Zählt in Berichten' })).toHaveCount(0);
    await expect(aufgabe.locator('.felder > .kb', { hasText: 'Zählt in Berichten' }).locator('.sl')).toHaveText('reporting');
    await schliessen(page);
    await page.keyboard.press('n');
    const neu = page.getByRole('dialog', { name: 'Neue Aufgabe' });
    await neu.locator('.felder .k').first().waitFor();
    const inNeu = await beschriftungenPruefen(neu, FELDER);
    expect(verstoesse(inNeu)).toEqual([]);
    expect(beschriftungen(inNeu)).toEqual(expect.arrayContaining(['Board', 'Spalte', 'Klasse', 'Herkunft', 'Zuständig', 'Labels', 'Fällig']));
    await expect(neu.getByRole('group', { name: 'Zuständig', exact: true })).toBeVisible();
    for (const name of ['Board', 'Spalte', 'Herkunft der neuen Aufgabe']) await expect(neu.getByLabel(name, { exact: true }), name).toHaveCount(1);
    // das Herkunftsfeld startet weiter leer (WBS-Notiz B0436, Z. 156)
    await expect(neu.getByLabel('Herkunft der neuen Aufgabe', { exact: true })).toHaveValue('');
  });

  test('US-8: Phasen, Reservierung, WBS und Anforderungen deutsch beschriftet, Schlüssel als eigenes Element (Wirkungen entfallen mit R00222)', async ({ page }) => {
    await starten(page);
    const eins = await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    await eins.locator('.felder .k').first().waitFor();
    const inEins = await beschriftungenPruefen(eins, FELDER);
    expect(verstoesse(inEins)).toEqual([]);
    expect(beschriftungen(inEins)).toEqual(expect.arrayContaining(['Phasen']));
    expect(beschriftungen(inEins)).not.toContain('Wirkungen');
    await schliessen(page);
    const zwei = await fensterOeffnen(page, 2);
    await reiter(page, 'Details');
    await zwei.locator('#reservierung').waitFor();
    const inZwei = await beschriftungenPruefen(zwei, FELDER);
    expect(verstoesse(inZwei)).toEqual([]);
    expect(beschriftungen(inZwei)).toContain('Reservierung');
    await schliessen(page);
    await page.goto(k.adresse + '#/einrichten');
    const einrichten = page.locator('.einrichten');
    await einrichten.locator('.felder .k').first().waitFor();
    const inEinrichten = await beschriftungenPruefen(einrichten, FELDER, { namen: false });
    expect(verstoesse(inEinrichten)).toEqual([]);
    expect(beschriftungen(inEinrichten)).toEqual(expect.arrayContaining(['WBS', 'Anforderungen']));
    // die Abschnittsköpfe bleiben beim Hausmuster (ADR-0013 N1 Punkt 3)
    await expect(einrichten.getByRole('heading', { name: 'QUELLEN sources:' })).toBeVisible();
  });

  test('US-8: erster Start in leerer Instanz — Ich, Agenten, Board, Spalten, WBS, Anforderungen mit dem Schlüssel der Datei', async ({ page }) => {
    k = await kanbanStarten();
    await page.goto(k.adresse);
    await page.getByRole('button', { name: 'Einrichten und committen' }).waitFor();
    const start = page.locator('.first-l');
    const felder = await beschriftungenPruefen(start, FELDER, { namen: false });
    expect(verstoesse(felder)).toEqual([]);
    expect(beschriftungen(felder)).toEqual(['Ich', 'Agenten', 'Board', 'Spalten', 'WBS', 'Anforderungen']);
    expect(await start.locator('.felder .sl').allTextContents()).toEqual(['ich', 'agents', 'board', 'spalten', 'wbs', 'requirements']);
    // die Vorschau zeigt weiter die Datei; leere Pfade schreibt sie nicht mehr, repository immer (R00209)
    await expect(page.locator('#vorschau-einstellungen')).toContainText('sources:\n  repository: ""');
  });
});

test.describe('US-9: ohne Herkunft', () => {
  test('US-9: Chip und Hinweis „ohne Herkunft“; Eingabe „ohne Herkunft“ und THIN AIR ersetzen die Herkunft', async ({ page }) => {
    await starten(page);
    await brett(page);
    await expect(page.locator('.ka[data-id="2"] .org')).toHaveText('ohne Herkunft');
    await fensterOeffnen(page, 2);
    await reiter(page, 'Details');
    await expect(fenster(page).locator('.org.leer')).toHaveText('ohne Herkunft');
    await expect(page.getByLabel('Neue Herkunft')).toHaveAttribute('title', /ohne Herkunft/);
    await expect(page.getByLabel('Neue Herkunft')).not.toHaveAttribute('title', /thin air/);
    await schliessen(page);
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    expect(await k.lies('aufgaben/0001-eins.md')).toContain('origins: [I0001, R00014]');
    await page.getByLabel('Neue Herkunft').fill('  Ohne Herkunft ');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('origins: [thin air]');
    await schliessen(page);
    await page.reload();
    await expect(page.locator('.ka[data-id="1"] .org')).toHaveText('ohne Herkunft');
    // „THIN AIR“ bewirkt dasselbe
    await page.request.patch(k.adresse + 'api/aufgaben/1', { ...ALS_ST, data: { herkunft: ['I0001'] } });
    await expect(page.locator('.ka[data-id="1"] .org')).toHaveText('I0001');
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    // je Herkunft gibt es genau einen Entfernen-Knopf
    await expect(fenster(page).getByRole('button', { name: /^Herkunft .* entfernen$/ })).toHaveCount(1);
    await page.getByLabel('Neue Herkunft').fill('THIN AIR');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('origins: [thin air]');
    await schliessen(page);
    // Im Grundbestand hat nur #1 eine Herkunft; der Filter findet #1 und #2 und alle übrigen offenen Karten ohne Herkunft
    await page.getByLabel('Filter').fill('origin:"thin air"');
    const gefunden = page.locator('.ka:visible');
    await expect.poll(() => gefunden.evaluateAll(ks => ks.map(k => k.dataset.id).sort())).toEqual(['1', '2', '4', '5', '6']);
    await expect(gefunden.locator('.org')).toHaveText(Array(5).fill('ohne Herkunft'));
    await page.getByLabel('Filter').fill('origin:I0001');
    await expect(gefunden).toHaveCount(0);
  });

  // Drei Einträge in der Anfrage, zwei in der Datei: würde „ohne Herkunftx“ als „ohne Herkunft“ erkannt, ginge [thin air] an den Server
  test('US-9, Gegenbeispiel: „ohne Herkunftx“ wird nicht als „ohne Herkunft“ erkannt, der Server lehnt es ab, die Datei bleibt [I0001, R00014]', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    const anfrage = page.waitForRequest(r => r.method() === 'PATCH' && r.url().endsWith('/api/aufgaben/1'));
    await page.getByLabel('Neue Herkunft').fill('ohne Herkunftx');
    await page.keyboard.press('Enter');
    expect((await anfrage).postDataJSON().herkunft).toEqual(['I0001', 'R00014', 'ohne Herkunftx']);
    await expect(page.getByText('„OHNE HERKUNFTX“ ist keine Herkunft')).toBeVisible();
    // die abgelehnte Eingabe bleibt im Feld stehen, damit man sie berichtigen kann
    await expect(page.getByLabel('Neue Herkunft')).toHaveValue('ohne Herkunftx');
    expect(await k.lies('aufgaben/0001-eins.md')).toContain('origins: [I0001, R00014]');
  });

  test.describe('US-9, abgelehnte Eingabe: der Entwurf gehört zum offenen Fenster und folgt dem Feld', () => {
    const feld = page => page.getByLabel('Neue Herkunft');
    /** Ausgangslage: „X1“ in #2 abgelehnt, Meldung sichtbar, Eingabe steht im Feld. */
    const ablehnen = async page => {
      await starten(page);
      await fensterOeffnen(page, 2);
      await reiter(page, 'Details');
      await feld(page).fill('X1');
      await page.keyboard.press('Enter');
      await expect(page.locator('.mod-fuss .fehl')).toHaveCount(1);
      await expect(feld(page)).toHaveValue('X1');
    };
    /** Ändert #2 von außen und wartet, bis das Fenster neu gezeichnet ist. */
    const vonAussenAendern = async page => {
      const vorher = await page.evaluate(() => window.kdTest.renders());
      expect((await page.request.patch(k.adresse + 'api/aufgaben/2', { ...ALS_ST, data: { labels: ['live'] } })).ok()).toBe(true);
      await expect.poll(() => page.evaluate(() => window.kdTest.renders())).toBeGreaterThan(vorher);
    };

    test('(a) Schließen (✕) und erneut öffnen: Feld leer, keine Meldung', async ({ page }) => {
      await ablehnen(page);
      await schliessenUeberKnopf(page);
      await page.locator('.ka[data-id="2"] .t').click();
      await reiter(page, 'Details');
      await expect(feld(page)).toHaveValue('');
      await expect(page.locator('.mod-fuss .fehl')).toHaveCount(0);
    });

    test('(b) Feld geleert, Änderung von außen: das Feld bleibt leer', async ({ page }) => {
      await ablehnen(page);
      await feld(page).fill('');
      await feld(page).blur();
      await vonAussenAendern(page);
      await expect(feld(page)).toHaveValue('');
    });

    test('(c) Berichtigung ohne Enter, Änderung von außen: die Berichtigung bleibt stehen', async ({ page }) => {
      await ablehnen(page);
      await feld(page).fill('I0003');
      await feld(page).blur();
      await vonAussenAendern(page);
      await expect(feld(page)).toHaveValue('I0003');
    });

    test('(d) Schließen (✕), eine andere Aufgabe öffnen, Escape, #2 öffnen: Feld leer', async ({ page }) => {
      await ablehnen(page);
      await schliessenUeberKnopf(page);
      await page.locator('.ka[data-id="1"] .t').click();
      await reiter(page, 'Details');
      await expect(feld(page)).toHaveValue('');
      await schliessen(page);
      await page.locator('.ka[data-id="2"] .t').click();
      await reiter(page, 'Details');
      await expect(feld(page)).toHaveValue('');
    });

    test('(e) nach erfolgreichem Speichern ist das Feld leer', async ({ page }) => {
      await ablehnen(page);
      await feld(page).fill('I0003');
      await page.keyboard.press('Enter');
      await expect(page.locator('.mod-fuss .fehl')).toHaveCount(0);
      await expect(page.locator('#fenster .org', { hasText: 'I0003' })).toBeVisible();
      await expect(feld(page)).toHaveValue('');
    });
  });

  test('US-9, Hilfstext: beide Herkunftsfelder nennen „ohne Herkunft“ in Anführungszeichen, nicht thin air', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await reiter(page, 'Details');
    await expect(page.getByLabel('Neue Herkunft')).toHaveAttribute('title', HERKUNFT_HILFE);
    await schliessen(page);
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' }).getByLabel('Herkunft der neuen Aufgabe')).toHaveAttribute('title', HERKUNFT_HILFE);
  });

  test('US-9, Teil „Neue Aufgabe“: „ohne Herkunft“ und THIN AIR legen eine Aufgabe ohne Herkunft an', async ({ page }) => {
    await starten(page);
    await brett(page);
    const alle = async () => (await (await page.request.get(k.adresse + 'api/aufgaben')).json()).aufgaben;
    const anzahl = async () => (await alle()).length;
    const vorher = await anzahl();
    const anlegen = async (titel, herkunft) => {
      await page.keyboard.press('n');
      const dialog = page.getByRole('dialog', { name: 'Neue Aufgabe' });
      await dialog.getByLabel('Titel der neuen Aufgabe').fill(titel);
      await dialog.getByLabel('Herkunft der neuen Aufgabe').fill(herkunft);
      await dialog.getByLabel('Titel der neuen Aufgabe').press('Enter');
      await expect(dialog).toHaveCount(0);
    };
    const datei = async titel => {
      const a = (await alle()).find(x => x.titel === titel);
      expect(a, titel).toBeTruthy();
      return { nummer: a.nummer, text: k.lies('aufgaben/' + a.datei) };
    };
    await anlegen('neu', '  Ohne Herkunft ');
    await expect.poll(anzahl).toBe(vorher + 1);
    const neu = await datei('neu');
    expect(neu.text).toContain('origins: [thin air]');
    await page.reload();
    await expect(page.locator(`.ka[data-id="${neu.nummer}"] .org`)).toHaveText('ohne Herkunft');
    await anlegen('neu2', 'THIN AIR');
    await expect.poll(anzahl).toBe(vorher + 2);
    expect((await datei('neu2')).text).toContain('origins: [thin air]');
    await anlegen('neu3', 'I0001 R00014');
    await expect.poll(anzahl).toBe(vorher + 3);
    expect((await datei('neu3')).text).toContain('origins: [I0001, R00014]');
    await anlegen('x I0001', 'ohne Herkunft');
    await expect.poll(anzahl).toBe(vorher + 4);
    expect((await datei('x')).text).toContain('origins: [I0001]');
  });
});

test.describe('US-10: Jahreswechsel', () => {
  test('US-10: am 31.12.2026 ist 31.12. kurz, am 01.01.2027 lang; Name und title immer mit Jahr', async ({ page }) => {
    await starten(page);
    await page.clock.install({ time: new Date('2026-12-31T12:00:00+01:00') });
    await brett(page);
    const due = nr => page.locator(`.ka[data-id="${nr}"] .due`);
    await expect(due(5)).toHaveText('31.12.');
    await expect(due(6)).toHaveText('01.01.2027');
    const vorgelesen = await page.locator('.ka[data-id="5"]').ariaSnapshot();
    expect(vorgelesen).toContain('fällig 31.12.2026');
    expect(vorgelesen).not.toMatch(/31\.12\.(?!\d{4})/);
    for (const [nr, name] of [[5, 'fällig 31.12.2026'], [6, 'fällig 01.01.2027']]) {
      await expect(due(nr)).toHaveAttribute('title', name);
      expect(await page.locator(`.ka[data-id="${nr}"]`).ariaSnapshot(), `#${nr}`).toContain(name);
    }
    await page.clock.setSystemTime(new Date('2027-01-01T12:00:00+01:00'));
    await page.reload();
    await expect(due(5)).toHaveText('31.12.2026');
    await expect(due(6)).toHaveText('01.01.');
    for (const [nr, name] of [[5, 'fällig 31.12.2026'], [6, 'fällig 01.01.2027']]) {
      await expect(due(nr)).toHaveAttribute('title', name);
      expect(await page.locator(`.ka[data-id="${nr}"]`).ariaSnapshot(), `#${nr}`).toContain(name);
    }
  });
});
