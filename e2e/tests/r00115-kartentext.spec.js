// R00115 Kartentext lesbar setzen (Karte #16) — Abnahme-Proben US-1 bis US-4 (ADR-0019 Nachtrag N4, M3 `label-small` 11 px).
// Die Probe des Titels teilt Wortgrenzen per Range auf: ein Wort über zwei Zeilen ist mitten gebrochen (AK 1).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, thema, mutanteEinsetzen, filterOeffnen } = require('./hilfen');
const { breiteMessen } = require('./ziele-hilfen');

test.beforeEach(async ({ context }) => { await mutanteEinsetzen(context); });

/* Die Datei kennt nur Minuten: `vor` legt einen Beginn in Ortszeit vor jetzt, wie die Fixtures der Nachbartests. */
const vor = minuten => {
  const d = new Date(Date.now() - minuten * 6e4), p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const KOPF = `---
people:
  st: {name: Stefan, kind: human}
  cl: {name: Claude, kind: agent}
classes:
  bug: {label: Fehler, color: red}
signals:
  mail: {label: Neue E-Mail, color: blue}
sources:
  wbs: ""
  requirements: ""
---
`;
const BOARD = '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n';
const karte = (nr, titel, extra = '', zeiten = []) => `---\nid: ${nr}\ntitle: ${JSON.stringify(titel)}\n${extra}---\n${zeiten.length ? '```kanbanD-time\n' + zeiten.join('\n') + '\n```\n' : ''}`;

/** #1 mit langem Titel, Klasse, Label, Zuständigen, Herkunft, Signal und **zwei** laufenden Timern — Platznot in der
 *  Kopfzeile (der 2×-Chip drückt den Titel unter die Breite seines längsten Wortes). */
const GRUNDBESTAND = {
  'kanbanD.md': KOPF,
  'boards/entwicklung.md': BOARD,
  'aufgaben/0001-eins.md': karte(1, 'Volltextsuche über alle Boards und Aufgaben',
    'class: bug\nassignees: [st, cl]\nlabels: [ux]\norigins: [R00014]\nsignals: [mail]\n', [vor(1) + ' · ... · st', vor(2) + ' · ... · cl']),
  'aufgaben/0002-zwei.md': karte(2, 'Ölwechsel & <Prüfung>', 'class: bug\n'),
};

/** Wörter des Titels von Karte #1, die über mehr als eine Zeile laufen (leer heißt: keine Zeile endet mitten in einem Wort). */
const mittenWoerter = page => page.evaluate(() => {
  const titel = document.querySelector('.ka[data-id="1"] .r0 .t');
  const knoten = [...titel.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
  const brueche = [];
  for (const wort of knoten.data.split(/\s+/).filter(Boolean)) {
    const start = knoten.data.indexOf(wort);
    const range = document.createRange();
    range.setStart(knoten, start);
    range.setEnd(knoten, start + wort.length);
    if (range.getClientRects().length > 1) brueche.push(wort);
  }
  return brueche;
});

/** Zeilen des Titels (getClientRects über den Inhalt) und ob alle ganz im Kartenrechteck liegen — nichts abgeschnitten. */
const titelZeilen = page => page.evaluate(() => {
  const ka = document.querySelector('.ka[data-id="1"]');
  const titel = ka.querySelector('.r0 .t');
  const range = document.createRange();
  range.selectNodeContents(titel);
  const zeilen = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
  const k = ka.getBoundingClientRect();
  return {
    zeilen: zeilen.length,
    abgeschnitten: getComputedStyle(titel).textOverflow !== 'clip' || getComputedStyle(titel).overflow !== 'visible',
    imKartenrechteck: zeilen.every(r => r.left >= k.left - 0.5 && r.right <= k.right + 0.5 && r.bottom <= k.bottom + 0.5),
  };
});

/** Kopfzeile einer Karte: Titelbreite, Lage des Chips, einzeilig ohne Platznot, Karte in der Spalte, Querscrollen. */
const kopfMessen = (page, nummer) => page.evaluate(nr => {
  const ka = document.querySelector(`.ka[data-id="${nr}"]`);
  ka.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  const r0 = ka.querySelector('.r0'), titel = r0.querySelector('.t'), chip = r0.querySelector('.lauf');
  const spalte = ka.closest('.flaeche');
  const r = el => el.getBoundingClientRect();
  // einzeilig: die Kopfzeile ist nur eine Textzeile hoch (Signal 18 px); umgebrochen trägt sie Titel- und Chip-Zeile
  const kinder = [...r0.children].filter(c => r(c).height > 0);
  return {
    titelBreite: Math.round(r(titel).width * 10) / 10,
    chipEigeneZeile: chip ? r(chip).top >= r(titel).bottom - 1 : null,
    chipImKartenrechteck: chip ? r(chip).right <= r(ka).right + 0.5 && r(chip).bottom <= r(ka).bottom + 0.5 : null,
    einzeilig: kinder.length > 0 && r(r0).height < 30,
    karteInDerSpalte: r(ka).right <= r(spalte).right + 0.5,
    spalteScrolltQuer: spalte.scrollWidth - spalte.clientWidth,
  };
}, nummer);

/** Sichtbarer Text in `.ka` unter 11 px (leer heißt: Grenze gehalten); `.vh` (ADR-0018) ist nie sichtbar und zählt nicht. */
const kleinschriften = page => page.evaluate(() => {
  const klein = [];
  for (const ka of document.querySelectorAll('.ka')) {
    for (const e of [ka, ...ka.querySelectorAll('*')]) {
      if (e.closest('.vh')) continue;
      const direkt = [...e.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim());
      if (!direkt || !e.getClientRects().length) continue;
      const st = getComputedStyle(e);
      if (st.visibility !== 'visible' || st.display === 'none') continue;
      const px = parseFloat(st.fontSize);
      if (px < 11) klein.push({ element: e.localName + [...e.classList].map(c => '.' + c).join(''), text: e.textContent.trim().slice(0, 30), px });
    }
  }
  return klein;
});

/** Berechnete Schriftgrößen einer Selektorliste; je Stelle muss mindestens ein sichtbares Element da sein (sonst wäre die Probe leer bestanden). */
const schriften = (page, selektor) => page.evaluate(sel => {
  const sichtbar = [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility === 'visible');
  return { zahl: sichtbar.length, px: sichtbar.map(e => parseFloat(getComputedStyle(e).fontSize)) };
}, selektor);

test.describe('R00115', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.afterEach(() => k.stoppen());

  test('US-1: keine Zeile des Titels endet mitten in einem Wort (AK 1, Karte #16 wörtlich)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await expect(page.locator('.ka[data-id="1"] .lauf')).toBeVisible();
    expect(await mittenWoerter(page), 'kein Wort des Titels über zwei Zeilen').toEqual([]);
    const z = await titelZeilen(page);
    expect(z.zeilen, 'der Titel hat sichtbare Zeilen').toBeGreaterThan(0);
    expect(z.abgeschnitten, 'kein Auslassungszeichen, nichts abgeschnitten').toBe(false);
    expect(z.imKartenrechteck, 'jede Zeile ganz im Kartenrechteck').toBe(true);
  });

  test('US-2: bei Platznot steht der Chip in einer eigenen Zeile, ohne Platznot bleibt es einzeilig (AK 3)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    for (const [breite, hoehe] of [[1280, 800], [414, 844], [320, 640]]) {
      await page.setViewportSize({ width: breite, height: hoehe });
      await page.locator('.ka[data-id="1"] .lauf').waitFor();
      // Platznot: Überschreitet Titel nebst Nummer, Signalen und Chip die Zeile, weicht der Chip in die eigene
      // Zeile (N4 Regel 1); reicht der Platz für alle Mindestbreiten, bleibt der Chip in der Zeile und der
      // Titel bricht zwischen den Wörtern (break-word). Beides bleibt in der Karte und in der Spalte.
      const eins = await kopfMessen(page, 1);
      expect(eins.titelBreite, `${breite} px: Titel behält 90 px`).toBeGreaterThanOrEqual(90);
      expect(eins.chipImKartenrechteck, `${breite} px: Chip im Kartenrechteck`).toBe(true);
      expect(eins.karteInDerSpalte, `${breite} px: Karte in der Spalte`).toBe(true);
      expect(eins.spalteScrolltQuer, `${breite} px: Spalte scrollt nicht quer`).toBeLessThanOrEqual(0);
      expect(await breiteMessen(page, `Board ${breite}`), `${breite} px: kein Rahmen scrollt quer`).toEqual([]);
      // bei Platznot (Titel nebst Nummer, Signalen und laufendem Timer passt nicht in eine Zeile) weicht der
      // Chip in die eigene Zeile unter den Titel — bei allen drei Breiten besteht sie (2×-Chip, N4 Regel 1)
      expect(eins.chipEigeneZeile, `${breite} px: Platznot — Chip in eigener Zeile unter dem Titel`).toBe(true);
      // ohne Platznot (#2: Titel passt nebst Nummer in eine Zeile) bleibt die Kopfzeile einzeilig — Früh-Indikator
      const zwei = await kopfMessen(page, 2);
      expect(zwei.einzeilig, `${breite} px: Kopfzeile ohne Platznot bleibt einzeilig`).toBe(true);
      expect(zwei.titelBreite, `${breite} px: auch der kurze Titel hält 90 px`).toBeGreaterThanOrEqual(90);
      // in Bearbeitung hält der Umbenennen-Titel mindestens 90 px (bei 1280; im Schmalen bricht die Kopfzeile um)
      if (breite === 1280) {
        await page.locator('.ka[data-id="1"] .t').dblclick();
        const breiteUmbenennen = await page.evaluate(() => Math.round(document.querySelector('.ka[data-id="1"] .r0 .umbenennen').getBoundingClientRect().width * 10) / 10);
        expect(breiteUmbenennen, 'Umbenennen hält 90 px').toBeGreaterThanOrEqual(90);
        await page.keyboard.press('Escape');
      }
    }
  });

  test('US-3: kein sichtbarer Kartentext unter 11 px, in Hell und Dunkel (AK 2)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    // die Karte trägt alles, was klein sein könnte: eigene und fremde Initialen, Label, Herkunft, laufende Timer
    await expect(page.locator('.ka[data-id="1"] .avs .pk')).toHaveCount(2);
    await expect(page.locator('.ka[data-id="1"] .lbl')).toHaveText('ux');
    await expect(page.locator('.ka[data-id="1"] .org')).toHaveText('R00014');
    for (const theme of ['light', 'dark']) {
      await thema(page, theme);
      expect(await kleinschriften(page), `${theme}: keine Schrift unter 11 px in .ka`).toEqual([]);
    }
  });

  test('US-3: die vier Kleintexte außerhalb der Karte halten 11 px (AK 5)', async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await page.locator('.ka[data-id="1"]').waitFor();
    // Datum-Pfeil der Kopfzeilen-Navigation (steht neben „Berichte“)
    const dd = await schriften(page, '.kz-nav a .dd');
    expect(dd.zahl, 'der Pfeil der Navigation ist da').toBeGreaterThan(0);
    for (const p of dd.px) expect(p, 'Navigation ≥ 11 px').toBeGreaterThanOrEqual(11);
    // Initialen im Ich-bin-Knopf der Kopfzeile
    const ich = await schriften(page, '.kz-btn .pk');
    expect(ich.zahl, 'der Ich-bin-Knopf trägt Initialen').toBeGreaterThan(0);
    for (const p of ich.px) expect(p, 'Ich-bin-Knopf ≥ 11 px').toBeGreaterThanOrEqual(11);
    // Schnelleingabe: Vorschau unter „Neue Aufgabe“ mit @st
    await page.keyboard.press('n');
    await expect(page.getByRole('dialog', { name: 'Neue Aufgabe' })).toBeVisible();
    await page.locator('#neu-titel').fill('@st hallo');
    const schnell = await schriften(page, '.schnell .pk');
    expect(schnell.zahl, 'die Schnelleingabe trägt Initialen').toBeGreaterThan(0);
    for (const p of schnell.px) expect(p, 'Schnelleingabe ≥ 11 px').toBeGreaterThanOrEqual(11);
    await page.keyboard.press('Escape');
    // Beschriftungsfilter der Berichte: Personen-Chips (Kreuztabelle „Zeiten“, Filterbox öffnen wie in r00114)
    await page.goto(k.adresse + '#/berichte/kreuz');
    await filterOeffnen(page);
    const bf = await schriften(page, '.bf-chip .pk');
    expect(bf.zahl, 'der Berichtsfilter trägt Personen-Chips').toBeGreaterThan(0);
    for (const p of bf.px) expect(p, 'Berichtsfilter ≥ 11 px').toBeGreaterThanOrEqual(11);
  });

  test('US-4: ein langes Einzelwort bricht innerhalb und bleibt in der Karte (AK 4)', async ({ page }) => {
    const bestand = {
      ...GRUNDBESTAND,
      'aufgaben/0002-zwei.md': karte(2, 'Donaudampfschifffahrtskapitänsanwärterunterricht'),
    };
    k = await kanbanStarten(einrichten(bestand));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    for (const [breite, hoehe] of [[1280, 800], [414, 844], [320, 640]]) {
      await page.setViewportSize({ width: breite, height: hoehe });
      // die Kopfzeile rechnet ihre Stufe beim Resize erst mit dem Neuzeichnen um — warten, bis die Seite passt
      await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth + 1, undefined, { timeout: 5000 }).catch(() => {});
      await page.locator('.ka[data-id="2"]').waitFor();
      const m = await page.evaluate(() => {
        const ka = document.querySelector('.ka[data-id="2"]');
        ka.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const titel = ka.querySelector('.r0 .t');
        const range = document.createRange();
        range.selectNodeContents(titel);
        const zeilen = [...range.getClientRects()].filter(r => r.width > 1 && r.height > 1);
        const k = ka.getBoundingClientRect(), spalte = ka.closest('.flaeche');
        return {
          zeilen: zeilen.length,
          imKartenrechteck: zeilen.every(r => r.left >= k.left - 0.5 && r.right <= k.right + 0.5 && r.bottom <= k.bottom + 0.5),
          karteInDerSpalte: k.right <= spalte.getBoundingClientRect().right + 0.5,
        };
      });
      // das Wort bricht nur, wo es die Zeile übersteigt (bei 1280 und 320 px); überall bleibt es in der Karte
      expect(m.zeilen, `${breite} px: der Titel hat sichtbare Zeilen`).toBeGreaterThan(0);
      if (m.zeilen > 1) {
        expect(m.imKartenrechteck, `${breite} px: jede Zeile bleibt im Kartenrechteck`).toBe(true);
      }
      expect(m.karteInDerSpalte, `${breite} px: Karte bleibt in der Spalte`).toBe(true);
      expect(await breiteMessen(page, `Einzelwort ${breite}`), `${breite} px: kein Rahmen scrollt quer`).toEqual([]);
      // bei 1280 px (Spalte 272 px) übersteigt das Wort die Zeile: es bricht innerhalb (break-word, AK 4)
      if (breite === 1280) {
        expect(m.zeilen, '1280 px: das Wort übersteigt die Zeile und bricht innerhalb').toBeGreaterThan(1);
      }
    }
  });
});