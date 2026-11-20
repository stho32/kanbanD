// E2E R00196 (I0186, US-1..US-5, AK 1–8): die Karte im Board zeigt neben dem Preisetikett die Summe der angefallenen
// Kosten je Währung, gekennzeichnet mit „Ist“, vor „Σ“. Vorgabe: Dokumentation/Wireframes/D0002.dc.html (#angefallene-kosten).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, bereit, breiteSetzen, thema, kontrastAm } = require('./hilfen');

const NBSP = ' ';

/* ── Treiber: Bestand über Dateien, Kosteneinträge über die Route, gelesen wird die Kartenzeile ── */
const ALTE_POSTEN = 'cost:\n  currency: USD\n  items:\n    - {text: Planung, min: 0.10, max: 0.20}\n    - {text: Bau, amount: 0.30}\n';
const schaetzung = betrag => `cost:\n  currency: USD\n  amount: ${betrag}\n`;
const ZEIT_46 = '```kanbanD-time\n2026-10-18 09:00 · 2026-10-18 09:46 · st\n```\n';
const aufgabeMd = (nr, kopf = '', rumpf = '') => `---\nid: ${nr}\ntitle: Aufgabe ${nr}\n${kopf}---\n${rumpf}`;
const datei = nr => `aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`;
/** Ein Kosteneintrag vom 13.11.; die Kennung ist Zeitpunkt und Rolle — je Aufgabe braucht jeder Eintrag seine eigene Minute. */
const eintrag = (amount, currency = 'USD', uhrzeit = '10:34') => ({ at: `2026-11-13 ${uhrzeit}+01:00`, role: 'entwickler', column: 'Entwicklung', amount, currency });

/** Ausgangslage der Anforderung: #1 nur Kosteneinträge, #2 alte Posten, #3 nur Schätzung, #4 nichts, #5 Schätzung,
    Einträge in zwei Währungen und 46 Minuten gebuchte Zeit. */
const AUSGANGSLAGE = {
  dateien: {
    'boards/fabrik.md': '# fabrik\n\n## Eingang\n\n- #3\n- #4\n- #5\n\n## Entwicklung\n\n- #1\n\n## Fertig\n\n- #2\n',
    [datei(1)]: aufgabeMd(1),
    [datei(2)]: aufgabeMd(2, ALTE_POSTEN),
    [datei(3)]: aufgabeMd(3, schaetzung('1.63')),
    [datei(4)]: aufgabeMd(4),
    [datei(5)]: aufgabeMd(5, schaetzung('2.00'), ZEIT_46),
  },
  eintraege: { 1: [eintrag(3.46), eintrag(1.20, 'USD', '11:02')], 5: [eintrag(2.00, 'EUR'), eintrag(1.00, 'USD', '10:35'), eintrag(0.50, 'USD', '10:36')] },
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
/** Was ein Sehender liest: Text in Kästen größer als 1 × 1 px — der versteckte Name ist auf 1 px abgeschnitten. */
const gesehen = ort => ort.evaluate(el => {
  const texte = [], knoten = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (knoten.nextNode()) {
    const kasten = knoten.currentNode.parentElement.getBoundingClientRect();
    if (kasten.width > 1 && kasten.height > 1) texte.push(knoten.currentNode.textContent);
  }
  return texte.join(' ').replace(/\s+/g, ' ').trim();
});

test.describe('R00196 Angefallene Kosten auf der Karte im Board', () => {
  let k, anfrage;
  test.afterEach(() => k.stoppen());

  async function buchen(nr, ...eintraege) {
    for (const e of eintraege) {
      const antwort = await anfrage.post(`${k.adresse}api/aufgaben/${nr}/kosteneintraege`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: e });
      expect(antwort.status(), JSON.stringify(e)).toBe(200);
    }
  }
  /** Startet kanbanD mit dem Bestand, bucht die Einträge und öffnet das Board „fabrik“. */
  async function boardMit(page, { dateien, eintraege = {} }, kopf = '') {
    k = await kanbanStarten(einrichten(kopf ? { ...dateien, 'kanbanD.md': kopf } : dateien));
    anfrage = page.request;
    for (const [nr, liste] of Object.entries(eintraege)) await buchen(nr, ...liste);
    await alsPerson(page, 'st');
    await boardZeigen(page);
  }
  async function boardZeigen(page) {
    await page.goto(k.adresse + '#/board/fabrik');
    await bereit(page, page.locator('.bahn').first());
  }
  const karte = (page, nr) => page.locator(`.ka[data-id="${nr}"]`);
  const zeile = (page, nr) => karte(page, nr).locator('.r3');
  const preis = (page, nr) => zeile(page, nr).locator('.preis');
  const angefallen = (page, nr) => zeile(page, nr).locator('.rechts > .angefallen');
  /** Die Kostengruppen der Kartenzeile, wie ein Sehender sie liest: Preisetikett, angefallene Kosten und Σ in der Folge der Zeile. */
  const kosten = async (page, nr) => {
    const gruppen = await zeile(page, nr).locator('.rechts > .preis, .rechts > .angefallen, .rechts > .sum').all();
    return (await Promise.all(gruppen.map(gesehen))).join(' ');
  };
  const ist = (page, nr) => angefallen(page, nr).locator('> [aria-hidden="true"]');

  /* ── US-1 (AK 1, AK 2) ── */
  test('US-1 (AK 1, AK 2; R00198 AK 2): #1 zeigt „Ist 4,66 $“ ohne „≈“ und ohne Preisetikett; #2 nur „Ist 0,40–0,50 $“, nach der Buchung von 4,66 $ über die API ohne Neuladen „Ist 5,06–5,16 $“', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    await expect(ist(page, 1)).toHaveText('Ist 4,66 $');
    await expect(preis(page, 1)).toHaveCount(0);
    expect(await kosten(page, 1)).toBe('Ist 4,66 $');
    expect(await kosten(page, 2), 'R00198: „Ist“ verdrängt das Etikett').toBe('Ist 0,40–0,50 $');
    await page.evaluate(() => { window.r00196SeiteSteht = true; });
    await buchen(2, eintrag(4.66, 'USD', '12:00'));
    await expect(ist(page, 2)).toHaveText('Ist 5,06–5,16 $');
    expect(await kosten(page, 2), 'R00198: „Ist“ verdrängt das Etikett').toBe('Ist 5,06–5,16 $');
    expect(await vorgelesen(angefallen(page, 2))).toBe(`Angefallene Kosten: 5,06 bis 5,16${NBSP}$`);
    expect(await page.evaluate(() => window.r00196SeiteSteht), 'die Seite wurde nicht neu geladen').toBe(true);
  });

  /* ── US-2 (AK 4, AK 7) ── */
  test('US-2 (AK 4; R00198 AK 4): #5 zeigt in dieser Reihenfolge „Ist 1,50 $ ·“, „2,00 €“, „Σ 0:46“, kein „≈ 2,00 $“ — USD vor EUR, kein Komma zwischen den Gruppen, „Ist“ genau einmal', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    expect(await kosten(page, 5)).toBe('Ist 1,50 $ · 2,00 € Σ 0:46');
    await expect(ist(page, 5).locator('.ag-b')).toHaveText(['Ist 1,50 $ ·', '2,00 €']);
    await expect(ist(page, 5).locator('.ag-k')).toHaveText(['Ist']);
    const folge = await zeile(page, 5).locator('.rechts > *').evaluateAll(alle => alle.map(e => e.className).filter(c => ['preis', 'angefallen', 'sum'].includes(c)));
    expect(folge).toEqual(['angefallen', 'sum']);
    await expect(preis(page, 5), 'R00198: kein Etikett neben „Ist“').toHaveCount(0);
  });

  /** Kein Betrag bricht in sich um, keine Zeile beginnt mit dem Trenner, nichts scrollt quer, nichts ragt aus der Karte. */
  async function umbruchPruefen(page, nr, lage) {
    const mass = await zeile(page, nr).evaluate(el => {
      const ka = el.closest('.ka'), rand = ka.getBoundingClientRect();
      const einheiten = [...el.querySelectorAll('.ag-b')].map(b => {
        const r = b.getBoundingClientRect();
        return { text: b.textContent, hoehe: r.height, schrift: parseFloat(getComputedStyle(b).fontSize), links: r.left, rechts: r.right, oben: Math.round(r.top) };
      });
      return { einheiten, karteLinks: rand.left, karteRechts: rand.right, karteQuer: ka.scrollWidth - ka.clientWidth, seiteQuer: document.documentElement.scrollWidth - innerWidth };
    });
    for (const e of mass.einheiten) {
      expect(e.hoehe, `${lage}: „${e.text}“ steht in einer Zeile`).toBeLessThan(e.schrift * 1.9);
      expect(e.links, `${lage}: „${e.text}“ ragt links nicht aus der Karte`).toBeGreaterThanOrEqual(mass.karteLinks);
      expect(e.rechts, `${lage}: „${e.text}“ ragt rechts nicht aus der Karte`).toBeLessThanOrEqual(mass.karteRechts);
    }
    expect(mass.karteQuer, `${lage}: die Karte scrollt nicht quer`).toBeLessThanOrEqual(0);
    expect(mass.seiteQuer, `${lage}: die Seite scrollt nicht quer`).toBeLessThanOrEqual(0);
    return mass.einheiten;
  }

  test('US-2 (AK 7): bei 320, 375, 414 und 1280 px zeigt #5 alle drei Beträge und „Σ 0:46“, kein Betrag ist von seinem Währungszeichen getrennt, nichts scrollt quer', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    for (const breite of [320, 375, 414, 1280]) {
      await breiteSetzen(page, breite, 800);
      await expect(ist(page, 5), `bei ${breite} px`).toBeVisible();
      expect(await kosten(page, 5), `Zeile bei ${breite} px`).toBe('Ist 1,50 $ · 2,00 € Σ 0:46');
      await expect(zeile(page, 5).locator('.sum')).toBeVisible();
      const einheiten = await umbruchPruefen(page, 5, `${breite} px`);
      expect(einheiten.map(e => e.text.replace(/\s+/g, ' '))).toEqual(['Ist 1,50 $ ·', '2,00 €']);
      await expect(preis(page, 5), `kein Etikett bei ${breite} px (R00198)`).toHaveCount(0);
    }
  });

  test('US-2 (AK 7, Randfall der Zeichnung): vier Währungen mit Spanne, ☑ und Fälligkeit bei 320 px — umgebrochen wird nur zwischen den Beträgen, „·“ bleibt am vorderen Betrag, „Ist“ am ersten', async ({ page }) => {
    const voll = aufgabeMd(5, 'due: 2026-11-20\ncost:\n  currency: CHF\n  items:\n    - {text: Bau, min: 0.40, max: 0.50}\n', '- [x] eins\n- [ ] zwei\n' + ZEIT_46);
    await boardMit(page, { dateien: { ...AUSGANGSLAGE.dateien, [datei(5)]: voll }, eintraege: { 5: [eintrag(2.00, 'GBP'), eintrag(2.00, 'EUR', '10:35'), eintrag(1.50, 'USD', '10:36')] } });
    await breiteSetzen(page, 320, 800);
    await expect(ist(page, 5).locator('.ag-b')).toHaveText(['Ist 1,50 $ ·', '0,40–0,50 CHF ·', '2,00 € ·', '2,00 £']);
    expect(await vorgelesen(angefallen(page, 5))).toBe(`Angefallene Kosten: 1,50${NBSP}$, 0,40 bis 0,50${NBSP}CHF, 2,00${NBSP}€, 2,00${NBSP}£`);
    const einheiten = await umbruchPruefen(page, 5, '320 px, vier Währungen');
    expect(new Set(einheiten.map(e => e.oben)).size, 'die Gruppe bricht zwischen den Beträgen um').toBeGreaterThan(1);
    await expect(zeile(page, 5).locator('.sum')).toBeVisible();
    await expect(zeile(page, 5).locator('.tk')).toBeVisible();
    await expect(zeile(page, 5).locator('.due')).toBeVisible();
  });

  /* ── US-3 (AK 3) ── */
  test('US-3 (AK 3): #3 zeigt nur „≈ 1,63 $“, #4 keinen Betrag — kein „Ist“, kein „0,00 $“, kein leeres Element', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    await expect(ist(page, 1), 'das Board ist mit angefallenen Kosten gezeichnet').toHaveText('Ist 4,66 $');
    expect(await kosten(page, 3)).toBe('≈ 1,63 $');
    await expect(angefallen(page, 3)).toHaveCount(0);
    expect(await kosten(page, 4)).toBe('');
    await expect(karte(page, 4).locator('.angefallen, .preis, .ag-b, .ag-k')).toHaveCount(0);
    await expect(karte(page, 4)).not.toContainText(/0,00|Ist/);
  });

  /* ── US-4 (AK 5) ── */
  test('US-4 (AK 5): vorgelesen wird „Angefallene Kosten: …“ an #1, #2 und #5 als versteckter Text — sichtbarer Teil aria-hidden, kein aria-label, Hinweis ohne Betrag; das Preisetikett behält seinen Namen, kein Betrag wird doppelt vorgelesen', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    const namen = { 1: `Angefallene Kosten: 4,66${NBSP}$`, 2: `Angefallene Kosten: 0,40 bis 0,50${NBSP}$`, 5: `Angefallene Kosten: 1,50${NBSP}$, 2,00${NBSP}€` };
    for (const [nr, name] of Object.entries(namen)) {
      expect(await vorgelesen(angefallen(page, nr)), `#${nr}`).toBe(name);
      await expect(angefallen(page, nr).locator('> .vh')).toHaveText(name);
      await expect(angefallen(page, nr).locator('> *')).toHaveCount(2);
      await expect(angefallen(page, nr)).toHaveAttribute('title', 'angefallene Kosten');
      for (const attribut of ['aria-label', 'role', 'tabindex']) expect(await angefallen(page, nr).getAttribute(attribut), `#${nr} ${attribut}`).toBeNull();
    }
    const sichtbar = await gesehen(karte(page, 1));
    expect(sichtbar).toContain('4,66 $');
    expect(sichtbar).not.toMatch(/angefallene kosten/i);
    await expect(preis(page, 2), 'R00198: kein Etikett an #2').toHaveCount(0);
    await expect(preis(page, 5), 'R00198: kein Etikett an #5').toHaveCount(0);
    const zeileFuenf = await vorgelesen(zeile(page, 5));
    expect(zeileFuenf.split('1,50').length - 1, `„1,50“ einmal in „${zeileFuenf}“`).toBe(1);
    expect(zeileFuenf).not.toContain('Ist');
    const baum = await karte(page, 5).ariaSnapshot();
    expect(baum, 'Zugänglichkeitsbaum der Karte #5').toMatch(/Angefallene Kosten: 1,50\s\$, 2,00\s€/);
    expect(baum).not.toMatch(/Ist|·/);
  });

  /* ── US-5 (AK 6) ── */
  test('US-5 (AK 6): der ungefilterte Bericht nennt „6,56–6,66 $“ und „2,00 €“ — mit dem Zeitraum 14.11.–14.11. im Bericht zeigen die Karten weiter 4,66 $, 0,40–0,50 $, 1,50 $ und 2,00 €', async ({ page }) => {
    await boardMit(page, AUSGANGSLAGE);
    const betraege = async () => (await page.locator('.ka .angefallen .ag-b').allTextContents()).map(t => t.replace(/\s+/g, ' ').replace(/^Ist | ·$/g, ''));
    const aufDenKarten = ['0,40–0,50 $', '1,50 $', '2,00 €', '4,66 $'];
    expect((await betraege()).sort()).toEqual(aufDenKarten);
    await page.goto(k.adresse + '#/berichte/kosten');
    await bereit(page, '#kosten');
    const summe = waehrung => page.getByRole('group', { name: `Angefallene Kosten in ${waehrung}` }).locator('.kost-gesamt .kost-betrag');
    await expect(summe('USD')).toHaveText('6,56–6,66 $');
    await expect(summe('EUR')).toHaveText('2,00 €');
    const feld = name => page.getByRole('group', { name: 'Zeitraum und Spaltenabschnitt' }).getByLabel(name, { exact: true });
    const waehlen = async aktion => {
      const antwortAuf = pfad => page.waitForResponse(antwort => antwort.request().method() === 'GET' && new URL(antwort.url()).pathname === pfad);
      const nachgeladen = Promise.all(['/api/aufgaben', '/api/boards'].map(antwortAuf));
      await aktion();
      await Promise.all((await nachgeladen).map(antwort => antwort.finished()));
      await bereit(page, '#kosten');
    };
    await waehlen(() => feld('Zeitraum').selectOption('eigen'));
    await waehlen(() => feld('Zeitraum von').fill('2026-11-14'));
    await waehlen(() => feld('Zeitraum bis').fill('2026-11-14'));
    await expect(feld('Zeitraum bis')).toHaveValue('2026-11-14');
    await expect(page.locator('#kosten'), 'im Zeitraum liegt kein Eintrag').not.toContainText('4,66');
    await boardZeigen(page);
    await expect(ist(page, 1)).toHaveText('Ist 4,66 $');
    expect((await betraege()).sort()).toEqual(aufDenKarten);
  });

  /* ── AK 8 ── */
  test('AK 8 (R00198 AK 3): ohne angefallene Kosten bleibt das Komma „≈ 2,00 $, Σ 0:46“ — mit dem ersten Kosteneintrag steht nur „Ist 1,00 $ Σ 0:46“, das Etikett ist weg', async ({ page }) => {
    await boardMit(page, { dateien: { ...AUSGANGSLAGE.dateien, [datei(1)]: aufgabeMd(1, schaetzung('2.00'), ZEIT_46) } });
    expect(await kosten(page, 1)).toBe('≈ 2,00 $, Σ 0:46');
    await expect(angefallen(page, 1)).toHaveCount(0);
    await buchen(1, eintrag(1.00, 'USD', '12:00'));
    await expect(ist(page, 1)).toHaveText('Ist 1,00 $');
    expect(await kosten(page, 1)).toBe('Ist 1,00 $ Σ 0:46');
  });

  test('AK 8: die Anzeige schreibt nichts — keine Aufgabendatei ändert sich, kein Commit entsteht; eine defekte Karte zeigt keinen Betrag', async ({ page }) => {
    const defekt = '---\nid: 6\n<<<<<<< HEAD\ntitle: sechs\n=======\ntitle: sechs anders\n>>>>>>> zweig\ncost:\n  currency: USD\n  items:\n    - {text: Bau, amount: 0.30}\n---\n';
    const dateien = { ...AUSGANGSLAGE.dateien, 'boards/fabrik.md': AUSGANGSLAGE.dateien['boards/fabrik.md'].replace('- #5\n', '- #5\n- #6\n'), 'aufgaben/0006-sechs.md': defekt };
    k = await kanbanStarten(einrichten(dateien));
    anfrage = page.request;
    for (const [nr, liste] of Object.entries(AUSGANGSLAGE.eintraege)) await buchen(nr, ...liste);
    const lesen = () => ({ kopf: k.git('rev-parse', 'HEAD'), offen: k.git('status', '--porcelain'), aufgaben: [1, 2, 3, 4, 5].map(nr => k.lies(datei(nr))) });
    const vorher = lesen();
    await alsPerson(page, 'st');
    await boardZeigen(page);
    await expect(ist(page, 5)).toHaveText('Ist 1,50 $ · 2,00 €');
    await angefallen(page, 5).hover();
    await breiteSetzen(page, 320, 800);
    await expect(ist(page, 2)).toHaveText('Ist 0,40–0,50 $');
    const kaputt = page.locator('.ka.defekt[data-id="6"]');
    await expect(kaputt).toContainText('Datei defekt');
    await expect(kaputt.locator('.angefallen, .preis')).toHaveCount(0);
    await expect(kaputt).not.toContainText(/0,30|Ist/);
    expect(lesen()).toEqual(vorher);
  });

  /* ── AK 7: Kontrast ── */
  test('AK 7: Kontrast der angefallenen Kosten samt „Ist“ je Klasse, auf eigener Klassenfarbe und auf der ausgewählten Karte in Hell und Dunkel mindestens 4,5:1', async ({ page }) => {
    const farben = ['yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'magenta', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal', 'green', 'lime', 'grey', '#2a9d8f', '#ffffff', '#000000', '#f5e6a0'];
    const klassen = farben.map((f, i) => `  k${i}: {label: K${i}, color: "${f}"}`).join('\n');
    const kopf = `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses:\n${klassen}\n---\n`;
    const ohneKlasse = farben.length + 1, eigeneFarbe = farben.indexOf('#2a9d8f') + 1;
    const dateien = { 'boards/fabrik.md': `# fabrik\n\n## Eingang\n\n${farben.map((_, i) => `- #${i + 1}`).join('\n')}\n- #${ohneKlasse}\n` };
    farben.forEach((_, i) => { dateien[datei(i + 1)] = aufgabeMd(i + 1, `class: k${i}\n${ALTE_POSTEN}`); });
    dateien[datei(ohneKlasse)] = aufgabeMd(ohneKlasse, ALTE_POSTEN);
    await boardMit(page, { dateien }, kopf);
    await expect(page.locator('.ka .angefallen')).toHaveCount(farben.length + 1);
    const schlechteste = async auswahl => {
      const werte = [];
      for (const ort of await page.locator(`${auswahl} .angefallen .ag-b, ${auswahl} .angefallen .ag-k`).all()) {
        werte.push({ karte: await ort.evaluate(e => e.closest('.ka').dataset.id), teil: await ort.evaluate(e => e.className), wert: await kontrastAm(ort) });
      }
      expect(werte.length, `Messstellen unter ${auswahl}`).toBeGreaterThan(0);
      return werte.sort((x, y) => x.wert - y.wert)[0];
    };
    const messen = async (auswahl, lage) => {
      for (const name of ['light', 'dark']) {
        await thema(page, name);
        const s = await schlechteste(auswahl);
        expect(s.wert, `${lage}, ${name}: Karte #${s.karte} (${s.teil})`).toBeGreaterThanOrEqual(4.5);
      }
    };
    await messen('.ka', 'nicht ausgewählt');
    await karte(page, eigeneFarbe).click({ modifiers: ['ControlOrMeta'] });
    await karte(page, ohneKlasse).click({ modifiers: ['ControlOrMeta'] });
    await expect(page.locator('.ka.gewaehlt')).toHaveCount(2);
    await messen('.ka.gewaehlt', 'ausgewählt');
  });
});
