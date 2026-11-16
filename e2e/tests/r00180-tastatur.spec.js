// R00180 Tastatur: jedes Bedienelement erreichen und auslösen (Karte #141, ADR-0010 N10).
// Bedient wird in jeder Probe nur mit Tab, Enter, Leertaste und Esc.
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, bereit } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository } = require('./wbs-hilfen');
const { ansichtenDerAnwendung } = require('./ansichten');

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'rot'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'rot', { fertig: 'alle Interactions gruen' }),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'rot', { fertig: 'US-1' }),
]);
const einstellungen = arbeit => `---
people:
  st: {name: Stefan, kind: human}
  mi: {name: Mia, kind: human}
classes:
  bug: {label: Fehler, color: red}
signals:
  mail: {label: Neue E-Mail, color: blue}
sources:
  wbs: ""
  requirements: ""
  applications:
    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}
---
`;
const zweistellig = zahl => String(zahl).padStart(2, '0');
/** Zeitpunkt am heutigen Tag: gebuchte Zeit liegt damit immer in der Woche, die der Stundenzettel zeigt. */
const heuteUm = (stunde, minute) => {
  const jetzt = new Date();
  return `${jetzt.getFullYear()}-${zweistellig(jetzt.getMonth() + 1)}-${zweistellig(jetzt.getDate())} ${zweistellig(stunde)}:${zweistellig(minute)}`;
};
const vorTagen = tage => new Date(Date.now() - tage * 864e5).toISOString();
const AUFGABE = `---\nid: 1\ntitle: Bericht prüfen\nclass: bug\n---\n- [ ] Daten holen\n- [ ] **fett** prüfen\n\n\`\`\`kanbanD-time\n${heuteUm(0, 1)} · ${heuteUm(0, 31)} · st\n\`\`\`\n`;
const BOARD_KOPF = '# Entwicklung\n\n## Zu erledigen\n\n';

/** Legt den Stand des Boards mit einem Commit zum Zeitpunkt `datum` ab — daraus rechnet die Durchlaufzeit. */
function boardAm(ordner, datum, board) {
  fs.writeFileSync(ordner + '/boards/entwicklung.md', board);
  execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
}

/** Ausgangslage der Anforderung: #1 mit Zeit in dieser Woche, zwei Teilaufgaben und einem Weg von „Zu erledigen“ nach „Erledigt“. */
function ausgangslage(arbeit) {
  return async ordner => {
    einrichten({ 'kanbanD.md': einstellungen(arbeit), 'aufgaben/0001-bericht-pruefen.md': AUFGABE })(ordner);
    boardAm(ordner, vorTagen(3), `${BOARD_KOPF}- #1\n\n## In Arbeit\n\n## Erledigt\n`);
    boardAm(ordner, vorTagen(2), `${BOARD_KOPF}## In Arbeit\n\n## Erledigt\n\n- #1\n`);
  };
}

let k, arbeit;
test.beforeEach(async ({ page }) => {
  arbeit = arbeitsRepository(WBS);
  k = await kanbanStarten(ausgangslage(arbeit));
  await alsPerson(page, 'st');
});
test.afterEach(async () => {
  if (k) await k.stoppen();
  if (arbeit) arbeit.aufraeumen();
  k = null; arbeit = null;
});

/* ── Testsprache: was der Mensch an der Tastatur tut und sieht ── */

/** Geht mit Tab vorwärts, bis `ziel` den Fokus trägt; nicht erreichbar heißt: der Tab-Halt fehlt. */
async function mitTabAuf(page, ziel, hoechstens = 150) {
  await expect(ziel).toBeVisible();
  for (let schritt = 0; schritt < hoechstens; schritt++) {
    await page.keyboard.press('Tab');
    if (await ziel.evaluate(element => element === document.activeElement)) return;
  }
  throw new Error(`mit ${hoechstens} Tab-Schritten nicht erreicht: ${ziel}`);
}

const TASTE = { Enter: 'Enter', Leertaste: 'Space' };
const aufgabenfenster = page => page.getByRole('dialog', { name: 'Aufgabe #1' });

/** Öffnet das Aufgabenfenster von #1 vom Board aus mit Tab und Enter. */
async function fensterPerTastaturOeffnen(page) {
  await page.goto(k.adresse + '#/board/entwicklung');
  await bereit(page, '.ka[data-id="1"]');
  await mitTabAuf(page, page.locator('.ka[data-id="1"]'));
  await page.keyboard.press('Enter');
  await expect(aufgabenfenster(page)).toBeVisible();
  return aufgabenfenster(page);
}

/** Der gezeichnete Ring eines Elements — der Fokus muss ihn ändern, sonst sieht ihn niemand. */
const ring = element => element.evaluate(e => { const stil = getComputedStyle(e); return `${stil.outlineStyle} ${stil.outlineWidth} ${stil.outlineColor} ${stil.outlineOffset}`; });

/** Abstand der Zeile zum oberen Fensterrand: bleibt er gleich, ist die Seite nicht gerollt. */
const lageImFenster = zeileImBericht => zeileImBericht.evaluate(element => Math.round(element.getBoundingClientRect().top));

/* ── AK 1 / US-1: Aufgabe aus dem Bericht öffnen ── */

const BERICHTE = [
  { name: 'Stundenzettel', adresse: '#/berichte/stundenzettel', tabelle: '#stundenzettel' },
  { name: 'Zeiten nach Aufgabe und Person', adresse: '#/berichte/kreuz', tabelle: '#kreuz' },
  { name: 'Durchlaufzeit', adresse: '#/berichte/durchlauf', tabelle: '#durchlauf' },
];

for (const bericht of BERICHTE) {
  test(`AK 1 / US-1: ${bericht.name} — die Zeile von #1 öffnet mit Enter und mit Leertaste, nach Esc steht der Fokus wieder auf ihr`, async ({ page }) => {
    // Niedriges Fenster: der Bericht ist höher als der Schirm, eine nicht abgefangene Leertaste würde rollen
    await page.setViewportSize({ width: 1100, height: 240 });
    await page.goto(k.adresse + bericht.adresse);
    const zeileVonEins = page.locator(`${bericht.tabelle} tbody tr`).filter({ hasText: 'Bericht prüfen' });
    await bereit(page, zeileVonEins);
    await mitTabAuf(page, zeileVonEins);
    await expect(zeileVonEins).toHaveCSS('outline-style', 'solid');
    await expect(zeileVonEins).toHaveCSS('outline-width', '2px');

    for (const taste of Object.keys(TASTE)) {
      const lageVorher = await lageImFenster(zeileVonEins);
      await page.keyboard.press(TASTE[taste]);
      await expect(aufgabenfenster(page), `${taste} öffnet das Aufgabenfenster`).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(aufgabenfenster(page)).toBeHidden();
      await expect(zeileVonEins, `nach Esc (geöffnet mit ${taste}) steht der Fokus auf der Zeile`).toBeFocused();
      await expect.poll(() => lageImFenster(zeileVonEins), `${taste} rollt die Seite nicht`).toBe(lageVorher);
    }
  });
}

/* ── AK 2 und AK 3 / US-2: Teilaufgabe abhaken und beim Namen hören ── */

test('AK 2 / US-2: Leertaste auf dem Kästchen hakt ab und nimmt zurück, der Fokus bleibt auf dem Kästchen', async ({ page }) => {
  const fenster = await fensterPerTastaturOeffnen(page);
  const zaehler = fenster.locator('.abs h3', { hasText: 'TEILAUFGABEN' }).locator('.mono');
  const kaestchen = fenster.getByRole('checkbox', { name: 'Daten holen', exact: true });
  const datei = () => k.lies('aufgaben/0001-bericht-pruefen.md');
  await expect(zaehler).toHaveText('0/2');

  await mitTabAuf(page, kaestchen);
  await page.keyboard.press('Space');
  await expect(zaehler).toHaveText('1/2');
  await expect(kaestchen).toHaveAttribute('aria-checked', 'true');
  await expect.poll(datei).toContain('- [x] Daten holen');
  await expect(kaestchen, 'der Fokus steht nach dem Abhaken weiter auf demselben Kästchen').toBeFocused();

  await page.keyboard.press('Space');
  await expect(zaehler).toHaveText('0/2');
  await expect.poll(datei).toContain('- [ ] Daten holen');
  await expect(kaestchen).toBeFocused();
});

test('AK 3 / US-2: Kästchen und ✕ der zweiten Teilaufgabe heißen „fett prüfen“ ohne Sternchen', async ({ page }) => {
  test.fail(true, 'erwartet rot: die Namen entstehen mit B0882');
  const fenster = await fensterPerTastaturOeffnen(page);
  const kaestchen = fenster.locator('.chk').nth(1).getByRole('checkbox');
  const entfernen = fenster.locator('.chk').nth(1).locator('[data-act="teil-weg"]');
  await expect(kaestchen).toHaveAccessibleName('fett prüfen');
  await expect(entfernen).toHaveAccessibleName('Teilaufgabe fett prüfen entfernen');
});

/* ── AK 4 / US-3: Farbe wählen ── */

const FARBWAEHLER = [
  { name: 'Klasse', kuerzel: 'k', vorher: 'red', vorschau: farbe => new RegExp(`bug:[^\\n]*color: ${farbe}`) },
  { name: 'Signal', kuerzel: 's', vorher: 'blue', vorschau: farbe => new RegExp(`mail:[^\\n]*color: ${farbe}`) },
];

for (const waehler of FARBWAEHLER) {
  test(`AK 4 / US-3: Farbfeld ${waehler.name} — Enter und Leertaste öffnen die Palette und wählen eine Farbe`, async ({ page }) => {
    await page.goto(k.adresse + '#/einrichten');
    const farbfeld = page.locator(`[data-act="${waehler.kuerzel}-pal"][data-arg="0"]`);
    const farbe = name => page.locator(`[data-act="${waehler.kuerzel}-farbe"][data-arg="0|${name}"]`);
    const gewaehlt = page.locator('.pal .nm');
    const vorschau = page.locator('#einr-vorschau');
    await bereit(page, farbfeld);
    const zeichnungVorher = await farbfeld.getAttribute('style');

    await mitTabAuf(page, farbfeld);
    await page.keyboard.press('Space');
    await expect(gewaehlt, 'Leertaste öffnet die Palette').toHaveText(`gewählt: ${waehler.vorher}`);
    await page.keyboard.press('Space');
    await expect(gewaehlt, 'Leertaste schließt sie wieder').toHaveCount(0);
    await expect(farbfeld).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(gewaehlt, 'Enter öffnet die Palette').toHaveText(`gewählt: ${waehler.vorher}`);
    const ringDesOffenenFeldsImFokus = await ring(farbfeld);

    await mitTabAuf(page, farbe('teal'));
    expect(await ring(farbfeld), 'am offenen Farbfeld ist der Fokus zu sehen').not.toBe(ringDesOffenenFeldsImFokus);
    await page.keyboard.press('Enter');
    await expect(gewaehlt, 'Enter wählt die Farbe').toHaveText('gewählt: teal');
    await expect(vorschau).toHaveText(waehler.vorschau('teal'));
    await expect(farbe('teal'), 'der Fokus bleibt auf der gewählten Farbe').toBeFocused();
    const ringDerGewaehltenFarbeImFokus = await ring(farbe('teal'));

    await mitTabAuf(page, farbe('green'));
    expect(await ring(farbe('teal')), 'an der gewählten Farbe ist der Fokus zu sehen').not.toBe(ringDerGewaehltenFarbeImFokus);
    await page.keyboard.press('Space');
    await expect(gewaehlt, 'Leertaste wählt die Farbe').toHaveText('gewählt: green');
    await expect(vorschau).toHaveText(waehler.vorschau('green'));
    await expect(farbfeld, 'das Farbfeld zeigt die neue Farbe').not.toHaveAttribute('style', zeichnungVorher);
  });
}

/* ── AK 5 / US-3: Leertaste am Titel ── */

test('AK 5 / US-3: Leertaste auf dem Titel öffnet die Bearbeitung; in Eingabefeldern schreibt sie ein Leerzeichen', async ({ page }) => {
  const fenster = await fensterPerTastaturOeffnen(page);
  await mitTabAuf(page, fenster.locator('.titel-lesen'));
  await page.keyboard.press('Space');
  const titelfeld = fenster.getByLabel('Titel', { exact: true });
  await expect(titelfeld).toBeFocused();

  await page.keyboard.press('End');
  await page.keyboard.press('Space');
  await page.keyboard.type('gründlich');
  await expect(titelfeld).toHaveValue('Bericht prüfen gründlich');

  const neueTeilaufgabe = fenster.getByLabel('Neue Teilaufgabe');
  await mitTabAuf(page, neueTeilaufgabe);
  await page.keyboard.type('Zahlen');
  await page.keyboard.press('Space');
  await page.keyboard.type('lesen');
  await expect(neueTeilaufgabe).toHaveValue('Zahlen lesen');
  await expect(neueTeilaufgabe, 'die Leertaste löst im Feld nichts aus').toBeFocused();
});

/* ── AK 6: Sammelprobe über alle Ansichten ── */

/** Läuft im Browser: sichtbare Elemente mit Rolle button oder checkbox und Tabellenzeilen mit data-act, die keinen Tab-Halt tragen. */
function ohneTabHalt() {
  const auslösbar = [...document.querySelectorAll('[role=button], [role=checkbox], tr[data-act]')];
  const namen = auslösbar
    .filter(element => element.checkVisibility() && element.tabIndex < 0)
    .map(element => `${element.tagName.toLowerCase()}[data-act=${element.dataset.act}]`);
  return [...new Set(namen)];
}

test('AK 6: in jeder Ansicht hat jedes Element mit Rolle button oder checkbox und jede Zeile mit data-act einen Tab-Halt', async ({ page }) => {
  const funde = [];
  const ansichtPruefen = async ansicht => {
    for (const fund of await page.evaluate(ohneTabHalt)) funde.push(`${ansicht}: ${fund}`);
  };

  for (const { ansicht, adresse } of ansichtenDerAnwendung({ board: 'entwicklung', wbs: 'kd' })) {
    await page.goto(k.adresse + adresse);
    await bereit(page, '#main > *');
    if (ansicht === 'Einrichten') {
      await page.locator('[data-act="k-pal"][data-arg="0"]').click();
      await page.locator('[data-act="s-pal"][data-arg="0"]').click();
      await expect(page.locator('.pal')).toHaveCount(2);
    }
    await ansichtPruefen(ansicht);
  }

  await page.goto(k.adresse + '#/board/entwicklung');
  await bereit(page, '.ka[data-id="1"]');
  await page.locator('.ka[data-id="1"] .t').click();
  await expect(aufgabenfenster(page)).toBeVisible();
  await ansichtPruefen('Aufgabenfenster');

  expect(funde).toEqual([]);
});
