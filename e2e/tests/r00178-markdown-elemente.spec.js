// R00178 (Karte #186, I0168): geschachtelte Listen, Trennlinie, _kursiv_, Durchstreichen und #### in der Beschreibung;
// Kommentare werden gerendert wie die Beschreibung. Fremder Text bleibt Text (ADR-0030), das Kommentarfeld reiner Text.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen, reiter } = require('./hilfen');
const { GRUNDBESTAND, ALS_BOT, fensterOeffnen } = require('./r00155-hilfen');

/** Kommentare stehen einzeilig in der Datei, ein Zeilenumbruch als `\n` geschrieben. */
const kommentare = (...texte) => '```kanbanD-comments\n' + texte.map((text, i) => `2026-11-16 09:0${i} · bot · ${text.replace(/\n/g, '\\n')}`).join('\n') + '\n```\n';
const FEINDLICH = '<script>document.title="gekapert"</script> <img src=x onerror="document.title=1"> [Köder](javascript:document.title=%27x%27) _<b onmouseover=x>y</b>_';
const SPALTEN = 8;
const BREITE_TABELLE = `| ${Array.from({ length: SPALTEN }, (leer, i) => `Spalte Nummer ${i + 1}`).join(' | ')} |\n|${'---|'.repeat(SPALTEN)}\n| ${Array.from({ length: SPALTEN }, (leer, i) => `Wert ${i + 1}`).join(' | ')} |`;
const TIEFE_LISTE = Array.from({ length: 10 }, (leer, ebene) => `${'  '.repeat(ebene)}- Ebene ${ebene + 1} mit etwas längerem Text, der bei schmalem Fenster umbricht`).join('\n');
/** Ausgangslage der User Story: #1 mit Beschreibung (US-1) und Kommentaren (US-2, US-3, feindlich), #2 für die Breite, #3 für Gestaltung. */
const BESTAND = {
  ...GRUNDBESTAND,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\n---\n\n- a\n  1. b\n    - c\n\n---\n\n_schräg_ und ~~weg~~ und cost_from_column\n\n'
    + kommentare('siehe https://example.org und **wichtig**', 'Stand:\n- erledigt\n- offen', '__init__.py liegt unter https://x.org/a_b_c', FEINDLICH),
  'aufgaben/0002-zweite-aufgabe.md': `---\nid: 2\ntitle: Zweite Aufgabe\n---\n\n${TIEFE_LISTE}\n\n`
    + kommentare(`Messung:\n\n${BREITE_TABELLE}\n\nDanach:\n- eins\n  - zwei mit \`code\`\n    1. drei`, 'nur eine Zeile'),
  'aufgaben/0003-gestaltung.md': '---\nid: 3\ntitle: Gestaltung\n---\n\nText\n\n### Drei\n\n#### Vier\n\nDarunter ~~alt~~ neu\n\n---\n\nEnde\n',
};
const LESEN = '#fenster .besch-lesen.md-text';
const KOMMENTAR = '#fenster .km .md-text';

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

async function starten(page) {
  k = await kanbanStarten(einrichten(BESTAND));
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await bereit(page, '.ka[data-id="3"]');
}

/** Die linke Kante des Textes eines Listenpunkts: das erste Zeichen seines eigenen Textknotens. */
const linkeKante = punkt => punkt.evaluate(element => {
  const bereich = document.createRange();
  bereich.setStart(element.firstChild, 0);
  bereich.setEnd(element.firstChild, 1);
  return bereich.getBoundingClientRect().left;
});
const stil = (ort, eigenschaft) => ort.evaluate((element, name) => getComputedStyle(element)[name], eigenschaft);

test('US-1, AK 1 Abnahme-Probe der Karte: drei Ebenen eingerückt, Linie, „schräg“ kursiv, „weg“ durchgestrichen, cost_from_column unverändert; im Kommentar Link und „wichtig“ fett', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);
  await expect(page.locator(LESEN).first()).toBeVisible();

  // drei Ebenen: „b“ nummeriert unter „a“, „c“ als Punkt unter „b“ — je Ebene 20 px weiter rechts
  const a = page.locator(`${LESEN} > ul > li`), b = a.locator('> ol > li'), c = b.locator('> ul > li');
  await expect(a).toHaveCount(1);
  await expect(b).toHaveCount(1);
  await expect(c).toHaveText('c');
  const kanten = [await linkeKante(a), await linkeKante(b), await linkeKante(c)];
  expect(kanten[1] - kanten[0]).toBeCloseTo(20, 0);
  expect(kanten[2] - kanten[1]).toBeCloseTo(20, 0);
  expect(await stil(b.locator('..'), 'listStyleType')).toBe('decimal');
  expect(await stil(b.locator('..'), 'marginBottom')).toBe('0px');

  // die Linie ist eine Linie: 1 px hoch, so breit wie der Text, kein „---“ mehr zu lesen
  const linie = page.locator(`${LESEN} > hr`);
  await expect(linie).toHaveCount(1);
  await expect(linie).toBeVisible();
  expect(await linie.evaluate(element => element.getBoundingClientRect().height)).toBe(1);
  expect(await stil(linie, 'borderTopWidth')).toBe('1px');
  expect(await linie.evaluate(element => element.getAttributeNames())).toEqual([]);
  await expect(page.locator(LESEN)).not.toContainText('---');

  const satz = page.locator(`${LESEN} > p`);
  await expect(satz).toHaveText('schräg und weg und cost_from_column');
  await expect(satz.locator('em')).toHaveText('schräg');
  expect(await stil(satz.locator('em'), 'fontStyle')).toBe('italic');
  await expect(satz.locator('del')).toHaveText('weg');
  expect(await stil(satz.locator('del'), 'textDecorationLine')).toBe('line-through');
  expect(await satz.innerHTML()).toBe('<em>schräg</em> und <del>weg</del> und cost_from_column');

  // im Kommentar: die Adresse ein Link in neuem Fenster, „wichtig“ fett
  const erster = page.locator(KOMMENTAR).first();
  const link = erster.getByRole('link', { name: 'https://example.org' });
  await expect(link).toHaveAttribute('href', 'https://example.org');
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener');
  await expect(erster.locator('strong')).toHaveText('wichtig');
  expect(Number(await stil(erster.locator('strong'), 'fontWeight'))).toBeGreaterThanOrEqual(600);
  await expect(erster).toHaveText('siehe https://example.org und wichtig');
  // kein Link in einem Knopf (ADR-0030 Punkt 8)
  await expect(page.locator('#fenster button a, #fenster [role=button] a')).toHaveCount(0);
});

test('US-2, AK 5: der Klick auf die Adresse im Kommentar öffnet ein neues Fenster; ein mehrzeiliger Kommentar zeigt Absatz und Liste', async ({ page, context }) => {
  await context.route('https://example.org/**', route => route.fulfill({ contentType: 'text/html', body: '<title>Ziel</title>' }));
  await starten(page);
  await fensterOeffnen(page, 1);
  await expect(page.locator(KOMMENTAR).first()).toBeVisible();
  const [neu] = await Promise.all([context.waitForEvent('page'), page.locator(KOMMENTAR).first().getByRole('link').click()]);
  await expect.poll(() => neu.url()).toBe('https://example.org/');
  await neu.close();
  await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();

  const zweiter = page.locator(KOMMENTAR).nth(1);
  await expect(zweiter.locator('> p')).toHaveText('Stand:');
  await expect(zweiter.locator('> ul > li')).toHaveText(['erledigt', 'offen']);
  // unter dem Text stehen weiter Person und Zeit
  await expect(page.locator('#fenster .km').nth(1).locator('.mono')).toHaveText('Bot · 16.11.2026 09:01');
});

test('US-3, AK 2: __init__.py bleibt unverändert, die Adresse mit Unterstrichen ein Link mit unverändertem Ziel', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 1);
  await expect(page.locator(KOMMENTAR).first()).toBeVisible();
  const dritter = page.locator(KOMMENTAR).nth(2);
  await expect(dritter).toHaveText('__init__.py liegt unter https://x.org/a_b_c');
  await expect(dritter.locator('strong, em, del')).toHaveCount(0);
  await expect(dritter.getByRole('link')).toHaveAttribute('href', 'https://x.org/a_b_c');
  await expect(dritter.getByRole('link')).toHaveText('https://x.org/a_b_c');
});

test('AK 6: ein feindlicher Kommentar bleibt Text — kein Skript, kein Bild, kein Link, kein fremdes Attribut, der Titel der Seite unverändert', async ({ page }) => {
  let dialoge = 0;
  page.on('dialog', dialog => { dialoge++; dialog.dismiss(); });
  await starten(page);
  const skripteVorher = await page.locator('script').count();
  const titelVorher = await page.title();
  await fensterOeffnen(page, 1);
  await expect(page.locator(KOMMENTAR).first()).toBeVisible();
  const feindlich = page.locator(KOMMENTAR).nth(3);
  await expect(feindlich).toHaveText('<script>document.title="gekapert"</script> <img src=x onerror="document.title=1"> Köder <b onmouseover=x>y</b>');
  await expect(feindlich.locator('em')).toHaveText('<b onmouseover=x>y</b>');
  await expect(page.locator('#fenster script, #fenster img, #fenster .km b')).toHaveCount(0);
  await expect(feindlich.locator('a')).toHaveCount(0);
  expect(await page.locator('script').count()).toBe(skripteVorher);
  // jedes Element aller Kommentare stammt aus der festen Liste und trägt kein Attribut außer denen des Renderers
  const fremd = await page.locator(`${KOMMENTAR} *`).evaluateAll(elemente => elemente
    .filter(e => !['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'DEL', 'CODE', 'A'].includes(e.tagName) || (e.tagName !== 'A' && e.attributes.length) || (e.tagName === 'A' && e.getAttributeNames().join() !== 'href,target,rel'))
    .map(e => e.outerHTML));
  expect(fremd).toEqual([]);
  expect(await page.title()).toBe(titelVorher);
  expect(dialoge).toBe(0);
});

test('Schaden (e): ein neuer Kommentar erscheint nach dem Absenden formatiert; das Feld bleibt reiner Text, Umschalt+Enter gibt eine neue Zeile, Enter sendet', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 3);
  await expect(page.locator('#km-inp').first()).toBeVisible();
  const feld = page.getByLabel('Neuer Kommentar', { exact: true });
  await feld.click();
  await page.keyboard.type('Neu: **fett** und _schräg_');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('- eins');
  await page.keyboard.press('Shift+Enter');
  await page.keyboard.type('  - zwei <script>alert(1)</script>');
  // das Feld ist ein Textfeld mit dem Rohtext, ohne Vorschau und ohne Werkzeugleiste
  await expect(feld).toHaveValue('Neu: **fett** und _schräg_\n- eins\n  - zwei <script>alert(1)</script>');
  expect(await feld.evaluate(element => element.tagName)).toBe('TEXTAREA');
  await expect(page.locator('#fenster .km')).toHaveCount(0);
  await page.keyboard.press('Enter');

  const neu = page.locator(KOMMENTAR);
  await expect(neu).toHaveCount(1);
  await expect(neu.locator('> p')).toHaveText('Neu: fett und schräg');
  await expect(neu.locator('> p strong')).toHaveText('fett');
  await expect(neu.locator('> p em')).toHaveText('schräg');
  await expect(neu.locator('> ul > li > ul > li')).toHaveText('zwei <script>alert(1)</script>');
  await expect(page.locator('#fenster script')).toHaveCount(0);
  await expect(feld).toHaveValue('');
  // in der Datei steht der Rohtext, einzeilig
  await expect.poll(() => k.lies('aufgaben/0003-gestaltung.md')).toContain('· st · Neu: **fett** und _schräg_\\n- eins\\n  - zwei <script>alert(1)</script>\n```');
});

test('Schaden (f): außerhalb des Abschnitts Kommentare bleibt der Kommentar Rohtext — Karte auf dem Board, Ansicht „Datei“, API', async ({ page }) => {
  await starten(page);
  // die Karte auf dem Board zeigt keinen Kommentartext und kein Element aus einem Kommentar
  await expect(page.locator('.ka[data-id="1"]')).not.toContainText('wichtig');
  await expect(page.locator('.ka[data-id="1"] a, .ka[data-id="1"] strong, .ka[data-id="1"] script')).toHaveCount(0);
  const aufgabe = await (await page.request.get(`${k.adresse}api/aufgaben/1`)).json();
  expect(JSON.stringify(aufgabe)).toContain('siehe https://example.org und **wichtig**');
  expect(JSON.stringify(aufgabe)).not.toContain('<strong>');
  await fensterOeffnen(page, 1);
  await expect(page.locator(KOMMENTAR).first()).toBeVisible();
  await reiter(page, 'Datei');
  const datei = page.locator('#dateitext');
  await expect(datei).toContainText('· bot · siehe https://example.org und **wichtig**');
  await expect(datei).toContainText('· bot · Stand:\\n- erledigt\\n- offen');
  await expect(datei).toContainText('_schräg_ und ~~weg~~ und cost_from_column');
  await expect(datei.locator('*')).toHaveCount(0);
});

test('ein Kommentar über die API erscheint im offenen Fenster formatiert', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 3);
  await expect(page.locator('#km-inp').first()).toBeVisible();
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/3/kommentare`, { ...ALS_BOT, data: { text: 'Lauf ~~rot~~ grün\n\n1. bauen\n2. prüfen' } });
  expect(antwort.status(), await antwort.text()).toBeLessThan(300);
  const neu = page.locator(KOMMENTAR);
  await expect(neu.locator('del')).toHaveText('rot');
  await expect(neu.locator('> ol > li')).toHaveText(['bauen', 'prüfen']);
});

test('AK 4 und Gestaltung: #### ist eine Überschrift, nicht kleiner als der Fließtext; Durchgestrichenes gedämpft', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 3);
  await expect(page.locator(LESEN).first()).toBeVisible();
  const vier = page.locator(`${LESEN} > h6`);
  await expect(vier).toHaveText('Vier');
  await expect(page.locator(`${LESEN} > h5`)).toHaveText('Drei');
  const groesse = ort => ort.evaluate(element => parseFloat(getComputedStyle(element).fontSize));
  const fliesstext = await groesse(page.locator(`${LESEN} > p`).first());
  expect(await groesse(vier)).toBeGreaterThanOrEqual(fliesstext);
  expect(await groesse(vier)).toBeLessThanOrEqual(await groesse(page.locator(`${LESEN} > h5`)));
  expect(Number(await stil(vier, 'fontWeight'))).toBeGreaterThanOrEqual(600);
  expect(await stil(vier, 'color')).toBe(await stil(page.locator(`${LESEN} > h5`), 'color'));
  const gestrichen = page.locator(`${LESEN} del`);
  await expect(gestrichen).toHaveText('alt');
  expect(await stil(gestrichen, 'color')).not.toBe(await stil(page.locator(`${LESEN} > p`).first(), 'color'));
  await expect(page.locator(`${LESEN} > hr`)).toBeVisible();
});

test('Gestaltung der Kommentare: ein einzeiliger Kommentar ohne Außenabstand unten, Schrift wie zuvor, Elemente wie in der Beschreibung', async ({ page }) => {
  await starten(page);
  await fensterOeffnen(page, 2);
  await expect(page.locator(KOMMENTAR).first()).toBeVisible();
  const einzeilig = page.locator(KOMMENTAR).nth(1);
  await expect(einzeilig).toHaveText('nur eine Zeile');
  expect(await stil(einzeilig.locator('> p'), 'marginBottom')).toBe('0px');
  expect(await stil(einzeilig.locator('> p'), 'marginTop')).toBe('0px');
  // die gemeinsame Klasse: Code im Kommentar sieht aus wie Code in der Beschreibung
  const code = page.locator(`${KOMMENTAR} code`);
  await expect(code).toHaveText('code');
  expect(await stil(code, 'fontSize')).toBe('12px');
  expect(await stil(page.locator(KOMMENTAR).first().locator('> ul'), 'paddingLeft')).toBe('20px');
});

test('375 px: die tiefe Liste der Beschreibung und der Kommentar mit Tabelle weiten das Fenster nicht — die Tabelle scrollt in ihrer Hülle', async ({ page }) => {
  await starten(page);
  await breiteSetzen(page, 375, 800);
  await fensterOeffnen(page, 2);
  await expect(page.locator(KOMMENTAR).first()).toBeVisible();

  // höchstens acht Ebenen, jede 20 px tiefer; die neunte und zehnte Zeile stehen flach auf der achten
  await expect(page.locator(`${LESEN} ul`)).toHaveCount(8);
  await expect(page.locator(`${LESEN} li`)).toHaveCount(10);
  const kanten = await page.locator(`${LESEN} li`).evaluateAll(punkte => punkte.map(punkt => {
    const bereich = document.createRange();
    bereich.setStart(punkt.firstChild, 0);
    bereich.setEnd(punkt.firstChild, 1);
    return Math.round(bereich.getBoundingClientRect().left);
  }));
  for (let ebene = 1; ebene < 8; ebene++) expect(kanten[ebene] - kanten[ebene - 1], `Ebene ${ebene + 1}`).toBe(20);
  expect(kanten[8]).toBe(kanten[7]);
  expect(kanten[9]).toBe(kanten[7]);
  // jeder Punkt bleibt im Fenster lesbar: rechts nichts abgeschnitten
  expect(await page.locator(`${LESEN} li`).evaluateAll(punkte => punkte.every(punkt => punkt.getBoundingClientRect().right <= innerWidth))).toBe(true);

  const huelle = page.locator(`${KOMMENTAR} .md-tab`);
  await huelle.scrollIntoViewIfNeeded();
  await expect(huelle.locator('th')).toHaveCount(SPALTEN);
  await expect.poll(() => huelle.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(100);
  expect(await huelle.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(KOMMENTAR).first().locator('> ul > li > ul > li > ol > li')).toHaveText('drei');

  // nichts außer der Hülle lässt sich waagrecht schieben
  const verschoben = await huelle.evaluate(element => {
    const namen = [];
    scrollTo(200, 0);
    if (scrollX !== 0) namen.push('Fenster des Browsers');
    for (let vorfahre = element.parentElement; vorfahre; vorfahre = vorfahre.parentElement) {
      vorfahre.scrollLeft = 200;
      if (vorfahre.scrollLeft !== 0) namen.push(vorfahre.id || vorfahre.className || vorfahre.tagName);
    }
    return namen;
  });
  expect(verschoben).toEqual([]);
});
