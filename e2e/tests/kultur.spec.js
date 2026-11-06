// R00109 Datumsangaben und Feldbeschriftungen deutsch (ADR-0013, Aspekt X00004)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');
const { isoFundstellen, ausnahmenAbgleichen } = require('./kultur-hilfen');
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

test.describe('US-1 bis US-5: Datumsangaben', () => {
  test('US-1: Fälligkeit auf der Karte kurz im laufenden Jahr, sonst lang, Name und title mit Jahr', async ({ page }) => {
    await starten(page);
    await brett(page);
    const due = nr => page.locator(`.ka[data-id="${nr}"] .due`);
    await expect(due(1)).toHaveText(kurz(HEUTE));
    await expect(due(1)).toHaveAttribute('title', `fällig ${lang(HEUTE)}`);
    await expect(due(1)).toHaveAccessibleName(`fällig ${lang(HEUTE)}`);
    await expect(due(2)).toHaveText(lang(VORJAHR_1503));
    await expect(page.locator('.ka[data-id="2"] .signal.faellig')).toHaveAttribute('aria-label', `überfällig seit ${lang(VORJAHR_1503)}`);
    await expect(due(4)).toHaveText(lang(FOLGEJAHR_0101));
    await page.getByRole('button', { name: 'Neue Aufgabe in Zu erledigen' }).click();
    await page.getByLabel('Titel der neuen Aufgabe').fill('eins due:morgen');
    await expect(page.locator('#neu-vorschau .due')).toHaveText(`fällig ${lang(tag(1))}`);
    const karten = await page.locator('.ka').evaluateAll(l => l.flatMap(e => [e.innerText, ...[...e.querySelectorAll('[title],[aria-label]')].flatMap(x => [x.title, x.getAttribute('aria-label') || ''])]));
    expect(karten.filter(t => ISO.test(t))).toEqual([]);
  });

  test('US-2: Kommentar, Reservierungen, Archivleiste lang; Reiter Datei und Datumsfeld bleiben ISO', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    await expect(fenster(page).locator('.km').first()).toContainText('Claude · 17.10.2026 09:00');
    await expect(page.getByLabel('Fälligkeit', { exact: true })).toHaveValue(HEUTE);
    await page.getByRole('tab', { name: 'Datei' }).click();
    await expect(page.locator('#dateitext')).toContainText(`due: ${HEUTE}`);
    await schliessen(page);
    await fensterOeffnen(page, 2);
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
    await expect(page.locator('table.zt tr[data-zeit] td:first-child')).toHaveText([kurz(HEUTE), lang(VORJAHR_3012)]);
  });

  test('US-4: Personen „zuletzt“ und Wochenleiste lang, Tagesköpfe kurz im laufenden Jahr', async ({ page }) => {
    await starten(page);
    // Stefans letzte Zeit liegt heute; einen Tag später zeigt „zuletzt“ ein Datum statt der Uhrzeit
    await page.clock.install({ time: new Date(Date.now() + 864e5) });
    await page.goto(k.adresse + '#/personen');
    await expect(page.locator('tr[data-person="st"]')).toContainText(`zuletzt ${lang(HEUTE)}`);
    await page.clock.setSystemTime(new Date());
    await page.goto(k.adresse + '#/berichte/stundenzettel');
    const tage = woche(tag(1));
    await expect(page.locator('#woche')).toHaveText(`${lang(tage[0])} – ${lang(tage[6])}`);
    await expect(page.locator('#stundenzettel thead th .mono')).toHaveText(tage.map(kurz));
    const neujahr = woche(`${JAHR}-01-01`);
    for (let w = 0; w < (utc(tage[0]) - utc(neujahr[0])) / (7 * 864e5); w++) await page.getByRole('button', { name: 'vorige Woche' }).click();
    await expect(page.locator('#woche')).toHaveText(`${lang(neujahr[0])} – ${lang(neujahr[6])}`);
    await expect(page.locator('#stundenzettel thead th .mono')).toHaveText(neujahr.map(kurz));
  });

  test('US-5: Tabellenansichten lang, Achsenmarken TT.MM. über JJJJ, Tooltips mit Wochentag', async ({ page }) => {
    await starten(page);
    await page.request.put(k.adresse + 'api/boards/entwicklung/termine', { ...ALS_ST, data: [{ name: 'Deadline', datum: tag(20), farbe: 'red', ziel: true }] });
    await page.request.put(k.adresse + 'api/boards/entwicklung/fieber', { ...ALS_ST, data: { puffer: 4, zielspalte: 'Entwicklung' } });
    // die Prognose braucht drei erledigte Aufgaben in der Messbasis
    for (const nummer of [4, 5, 6]) await page.request.post(k.adresse + 'api/boards/entwicklung/bewegen', { ...ALS_ST, data: { nummer, spalte: 'Erledigt' } });
    const TAG_LANG = /^\d\d\.\d\d\.\d{4}$/;
    const MIT_WOCHENTAG = /(Mo|Di|Mi|Do|Fr|Sa|So) \d\d\.\d\d\.\d{4}/;
    for (const [bericht, tabelle] of [['verlauf', '.tabellenansicht table'], ['prognose', '.tabellenansicht table'], ['fieber', '#fb-tabelle']]) {
      await page.goto(k.adresse + '#/berichte/' + bericht);
      await liveBereit(page);
      await page.locator('.tabellenansicht summary').click();
      const tage = await page.locator(`${tabelle} tbody tr td:first-child`).allTextContents();
      expect(tage.length, bericht).toBeGreaterThan(0);
      expect(tage.filter(t => !TAG_LANG.test(t)), bericht).toEqual([]);
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
      const box = await svg.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await expect(page.locator('#tooltip'), bericht).toContainText(kopf);
      await page.mouse.move(1, 1);
    }
    const TITEL = { stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', durchlauf: 'Durchlaufzeit',
      prognose: 'Wie lange noch', fieber: 'Projekt-Fever-Chart', kosten: 'Kosten', bestand: 'Bestand nach Labels' };
    for (const [bericht, titel] of Object.entries(TITEL)) {
      await page.goto(k.adresse + '#/berichte/' + bericht);
      await expect(page.locator('.leiste > b').first()).toHaveText(titel);
      // alles Zugeklappte aufklappen, eins nach dem anderen — ein aufgeklapptes fällt aus der Auswahl
      const zu = page.locator('details:not([open]) > summary');
      for (let n = 0; n < 20 && await zu.count(); n++) await zu.first().click();
      await expect(zu).toHaveCount(0);
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
const BERICHTSTITEL = { stundenzettel: 'Stundenzettel', kreuz: 'Zeiten nach Aufgabe und Person', verlauf: 'Burndown', durchlauf: 'Durchlaufzeit',
  prognose: 'Wie lange noch', fieber: 'Projekt-Fever-Chart', kosten: 'Kosten', bestand: 'Bestand nach Labels' };
/** Klappt alles Zugeklappte auf, eins nach dem anderen — ein aufgeklapptes fällt aus der Auswahl. */
async function allesAufklappen(page) {
  const zu = page.locator('details:not([open]) > summary');
  for (let n = 0; n < 20 && await zu.count(); n++) await zu.first().click();
  await expect(zu).toHaveCount(0);
}
/** Was eine Ansicht der gemeinsamen Liste nach dem Laden noch braucht, bis ihr Inhalt steht. */
function nachDemLaden(ansicht) {
  if (ansicht === 'Board') return page => page.locator('.ka[data-id="1"]').waitFor();
  if (ansicht === 'WBS-Sicht') return page => page.locator('.wbs-tabelle').waitFor();
  if (ansicht === 'Personen') return page => page.locator('tr[data-person="st"]').waitFor();
  if (ansicht === 'Aufgabenliste') return page => page.locator('main').getByText('eins').first().waitFor();
  if (ansicht === 'Einrichten') return page => page.locator('pre.yaml').first().waitFor();
  const bericht = ansicht.startsWith('Bericht ') && ansicht.slice(8);
  if (bericht) return page => expect(page.locator('.leiste > b').first()).toHaveText(BERICHTSTITEL[bericht]);
  return async () => {};
}
const menue = id => async page => { await brett(page); await page.locator(id).click(); await page.getByRole('menu').first().waitFor(); };
/** Der Tooltip eines Diagramms erscheint erst unter dem Zeiger (FA 18): einmal über die Mitte der Zeichenfläche. */
const tooltip = (bericht, name) => async page => {
  await page.goto(k.adresse + '#/berichte/' + bericht);
  const box = await page.getByRole('img', { name: new RegExp('^' + name) }).boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('#tooltip').waitFor();
};

/**
 * Die Ansichten der Probe (FA 18): jede Ansicht der gemeinsamen Liste (ADR-0012 Regel 6), dazu Karte und Fenster (B0430)
 * und die Zustände, die nur unter einer Handlung erscheinen. `leer` startet in einem leeren Ordner (erster Start).
 */
const ANSICHTEN = [
  ...ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' }).map(({ ansicht, adresse }) => ({
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
    const gemeinsam = ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' }).map(a => a.ansicht);
    expect(vollstaendigkeit(ANSICHTEN.map(a => a.ansicht), gemeinsam, ZUSTAENDE)).toEqual({ fehlend: [], doppelt: [] });
  });
  test('Selbstprobe der Vollständigkeit: eine neue Ansicht der gemeinsamen Liste und eine doppelte fallen auf', () => {
    const gemeinsam = [...ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' }).map(a => a.ansicht), 'Bericht neu'];
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

test.describe('US-7, US-8: Feldbeschriftungen (B0436, B0437 warten auf PO Z. 148)', () => {
  test.fail('US-7: Beschriftungen im Aufgabenfenster und in „Neue Aufgabe“ deutsch, Schlüssel als Hilfstext', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    const beschriftungen = () => page.locator('.felder .k').allTextContents();
    const SCHLUESSEL = ['column', 'class', 'origins', 'assignees', 'due', 'thin air'];
    expect((await beschriftungen()).filter(t => SCHLUESSEL.includes(t.trim()))).toEqual([]);
    expect(await beschriftungen()).toEqual(expect.arrayContaining(['Spalte', 'Klasse', 'Herkunft', 'Zuständig', 'Labels', 'Fällig']));
    await expect(page.getByRole('group', { name: 'Zuständig' })).toBeVisible();
    await schliessen(page);
    await page.keyboard.press('n');
    await page.getByRole('dialog', { name: 'Neue Aufgabe' }).waitFor();
    expect((await beschriftungen()).filter(t => SCHLUESSEL.includes(t.trim()))).toEqual([]);
    expect(await beschriftungen()).toEqual(expect.arrayContaining(['Board', 'Spalte', 'Klasse', 'Herkunft', 'Zuständig', 'Labels', 'Fällig']));
  });

  test.fail('US-8: Wirkungen, Phasen, Reservierung, WBS, Anforderungen und erster Start deutsch beschriftet', async ({ page }) => {
    await starten(page);
    await fensterOeffnen(page, 1);
    expect(await page.locator('.felder .k').allTextContents()).toEqual(expect.arrayContaining(['Wirkungen', 'Phasen']));
    await schliessen(page);
    await fensterOeffnen(page, 2);
    expect(await page.locator('.felder .k').allTextContents()).toContain('Reservierung');
    await page.goto(k.adresse + '#/einrichten');
    await expect(page.locator('.k', { hasText: /^WBS$/ }).first()).toBeVisible();
    await expect(page.locator('.k', { hasText: /^Anforderungen$/ }).first()).toBeVisible();
  });
});

test.describe('US-9: ohne Herkunft', () => {
  test.fail('US-9: Chip und Hinweis „ohne Herkunft“; Eingabe „ohne Herkunft“ und THIN AIR ersetzen die Herkunft', async ({ page }) => {
    await starten(page);
    await brett(page);
    await expect(page.locator('.ka[data-id="2"] .org')).toHaveText('ohne Herkunft');
    await fensterOeffnen(page, 2);
    await expect(fenster(page).locator('.org.leer')).toHaveText('ohne Herkunft');
    await expect(page.getByLabel('Neue Herkunft')).toHaveAttribute('title', /ohne Herkunft/);
    await expect(page.getByLabel('Neue Herkunft')).not.toHaveAttribute('title', /thin air/);
    await schliessen(page);
    await fensterOeffnen(page, 1);
    await page.getByLabel('Neue Herkunft').fill('ohne Herkunftx');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('origins: [I0001, R00014, ohne Herkunftx]');
    await page.locator('.ochip', { hasText: 'ohne Herkunftx' }).getByRole('button').click();
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('origins: [I0001, R00014]');
    await page.getByLabel('Neue Herkunft').fill('  Ohne Herkunft ');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('origins: [thin air]');
    await schliessen(page);
    await page.reload();
    await expect(page.locator('.ka[data-id="1"] .org')).toHaveText('ohne Herkunft');
    // „THIN AIR“ bewirkt dasselbe
    await page.request.patch(k.adresse + 'api/aufgaben/1', { ...ALS_ST, data: { herkunft: ['I0001'] } });
    await fensterOeffnen(page, 1);
    await expect(fenster(page).locator('.ochip')).toHaveCount(1);
    await page.getByLabel('Neue Herkunft').fill('THIN AIR');
    await page.keyboard.press('Enter');
    await expect.poll(() => k.lies('aufgaben/0001-eins.md')).toContain('origins: [thin air]');
    await schliessen(page);
    await page.getByLabel('Filter').fill('origin:"thin air"');
    await expect(page.locator('.ka:visible')).toHaveCount(2);
  });

  test.fail('US-9, Teil „Neue Aufgabe“: „ohne Herkunft“ und THIN AIR legen eine Aufgabe ohne Herkunft an', async ({ page }) => {
    await starten(page);
    await brett(page);
    const anzahl = async () => (await (await page.request.get(k.adresse + 'api/aufgaben')).json()).length;
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
      const a = (await (await page.request.get(k.adresse + 'api/aufgaben')).json()).find(x => x.titel === titel);
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
    for (const [nr, name] of [[5, 'fällig 31.12.2026'], [6, 'fällig 01.01.2027']]) {
      await expect(due(nr)).toHaveAttribute('title', name);
      await expect(due(nr)).toHaveAccessibleName(name);
    }
    await page.clock.setSystemTime(new Date('2027-01-01T12:00:00+01:00'));
    await page.reload();
    await expect(due(5)).toHaveText('31.12.2026');
    await expect(due(6)).toHaveText('01.01.');
    for (const [nr, name] of [[5, 'fällig 31.12.2026'], [6, 'fällig 01.01.2027']]) {
      await expect(due(nr)).toHaveAttribute('title', name);
      await expect(due(nr)).toHaveAccessibleName(name);
    }
  });
});
