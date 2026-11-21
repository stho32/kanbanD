// R00107 Farbrollen in Paaren — Abnahme-Probe der Karte #9: jede Schrift in beiden Themen mindestens 4,5:1
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const { kanbanStarten, einrichten, alsPerson, liveBereit, ausMehr, thema, kontrastMessen, kontrastVerstoesse, kontrastAm, kontrastFarben, farbPixel, mutanteEinsetzen } = require('./hilfen');
const { ansichtenDerAnwendung } = require('./ansichten');

const THEMEN = ['light', 'dark'];
const MASS = 4.5;
/** Bekannte Verstöße, die zu einer anderen Karte gehören (nur #50 und #55), je mit Kartennummer: { karte, element, text }. */
const AUSNAHMEN = [];

const gestern = () => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); };
/** Ein Fälligkeitstag n Tage in der Zukunft: nicht heute und nicht morgen, sonst trüge `.due` den Warnzustand (`--kd-warn`) statt der geprüften r3-Schrift. */
const inTagen = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const GRUNDBESTAND = () => ({
  'boards/entwicklung.md': '---\nlimits:\n  In Arbeit: 1\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n- #5\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nclass: bug\nassignees: [st]\ndue: ${gestern()}\n---\n`,
  'aufgaben/0002-zwei.md': '---\nid: 2\ntitle: zwei\nassignees: [cl]\nlabels: [ux, "a:b"]\n---\n```kanbanD-comments\n2026-11-05 09:00 · st · passt\n```\n',
  'aufgaben/0003-drei.md': '---\nid: 3\ntitle: drei\nclass: feature\nassignees: [mi, cl]\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\n---\n',
  'aufgaben/0005-fuenf.md': '---\nid: 5\ntitle: fünf\nclass: bug\nassignees: [st]\n---\n',
});

/** Alle Ansichten der Anwendung aus der gemeinsamen Liste; gemessen wird der ganze `body` samt Kopf mit seinem aktiven Segment. Der Bestand hat keine WBS. */
const ANSICHTEN = ansichtenDerAnwendung({ board: 'entwicklung' });
/**
 * Ausdrücklich nicht gemessen: gedimmte Zustände über `opacity`, die nicht `aria-disabled` sind und unter 4,5 messen — je Eintrag
 * { selektor, ansicht, karte, heute: { light, dark }, grund }. Seit Karte #57 (R00188) leer: die stillgelegte Initiale trägt ein
 * gedämpftes Paar statt Deckkraft. Ein neuer Eintrag braucht eine Karte; der Test „Nicht gemessen“ prüft ihn wie zuvor.
 */
const NICHT_GEMESSEN = [];

/** Wie weit ein nicht gemessener Zustand unter seinen heutigen Wert fallen darf, bevor die Probe ihn meldet. */
const SPIELRAUM = 0.1;

const ausgenommen = v => AUSNAHMEN.some(a => a.element === v.element && a.text === v.text);
/** Messwert mit drei Nachkommastellen und Dezimalkomma, wie in jeder Meldung. */
const komma = wert => wert.toFixed(3).replace('.', ',');
const lesbar = v => `${v.thema} ${v.bereich} ${v.element} „${v.text}“ ${komma(v.wert)}`;

/** Wartet, bis keine CSS-Transition mehr läuft (der Themenwechsel startet Farbübergänge von 0,1 s): gemessen wird der ruhende Zustand; angehaltene laufen nie zu Ende und zählen nicht. */
async function farbuebergaengeAbwarten(page) {
  await page.waitForFunction(() => document.getAnimations().filter(a => a instanceof CSSTransition).every(a => a.playState !== 'running'));
}

/**
 * Wechselt die Ansicht und wartet, bis `#main` neu gezeichnet ist: ein Hashwechsel lädt die Seite nicht neu, bis zum Zeichnen
 * stünde sonst noch die vorige Ansicht im Dokument und würde unter dem Namen der neuen gemessen.
 */
async function ansichtOeffnen(page, adresse) {
  await page.evaluate(() => document.querySelector('#main').firstElementChild?.setAttribute('data-vorige-ansicht', ''));
  await page.goto(adresse);
  await page.waitForFunction(() => !document.querySelector('#main [data-vorige-ansicht]') && document.querySelector('#main').firstElementChild);
  await liveBereit(page);
}

/** Die Farbe eines Tokens oder Ausdrucks, wie der Browser sie für `color` auflöst. */
async function tokenFarbe(page, token) {
  const wert = token.startsWith('--') ? `var(${token})` : token;
  return page.evaluate(w => { const p = document.createElement('p'); p.style.color = w; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; }, wert);
}

/** Das Pixel einer berechneten Farbeigenschaft am Element, über das Canvas. */
async function pixelVon(page, ort, eigenschaft) {
  return farbPixel(page, await ort.evaluate((e, x) => getComputedStyle(e)[x], eigenschaft));
}

/** Misst die Bereiche je Thema, legt alle Messungen ins Testprotokoll und liefert die Verstöße außerhalb der Ausnahmeliste. */
async function verstoesseInBeidenThemen(page, bereiche, vorher = async () => {}, ohne = []) {
  const alle = [];
  for (const t of THEMEN) {
    await thema(page, t);
    await vorher();
    await farbuebergaengeAbwarten(page);
    const messungen = (await kontrastMessen(page, bereiche, ohne)).map(m => ({ thema: t, ...m }));
    await test.info().attach(`Messungen ${t}`, { body: messungen.map(lesbar).join('\n'), contentType: 'text/plain' });
    alle.push(...messungen);
  }
  expect(alle.length, 'die Probe hat Schrift gefunden').toBeGreaterThan(0);
  return alle.filter(m => m.wert < MASS && !ausgenommen(m)).map(lesbar);
}

test.describe('R00107 Kontrast', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(GRUNDBESTAND()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await expect(page.locator('.ka')).toHaveCount(5);
  });
  test.afterEach(() => k.stoppen());

  test('Grenzwert: transparent über Weiß misst 21:1, das heutige faint auf bg 3,29 wird gemeldet', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-weiss" style="background:#fff"><span style="color:#000;background:rgba(0,0,0,0)">schwarz</span></div>' +
      '<div id="probe-faint" style="background:var(--kd-bg)"><span style="color:oklch(0.62 0.014 255)">blass</span></div>'));
    const [weiss] = await kontrastMessen(page, ['#probe-weiss']);
    expect(weiss.wert).toBeCloseTo(21, 1);
    const gemeldet = await kontrastVerstoesse(page, ['#probe-weiss', '#probe-faint']);
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0]).toMatchObject({ bereich: '#probe-faint', element: 'span', text: 'blass' });
    expect(gemeldet[0].wert).toBeCloseTo(3.29, 1);
  });

  test('Grenzwert: knapp unter 4,5 (ungerundet 4,4967) ist ein Verstoß, auch wenn die Anzeige 4,50 ergäbe', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-knapp" style="background:#fff"><span style="color:rgb(117,118,130)">x</span></div>'));
    const gemeldet = await kontrastVerstoesse(page, ['#probe-knapp'], 4.5);
    expect(gemeldet).toHaveLength(1);
    expect(gemeldet[0].wert).toBeGreaterThan(4.49);
    expect(gemeldet[0].wert).toBeLessThan(4.5);
  });

  test('Opazität: die eigene und die der Vorfahren werden mitgemalt, als Gruppe über dem Grund darunter; unsichtbar (0) zählt nicht', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-eigen" style="background:#fff"><span style="color:#000;opacity:.5">eigen</span></div>' +
      '<div id="probe-vorfahr" style="background:#fff"><div style="opacity:.5"><span style="color:#000">vorfahr</span></div></div>' +
      '<div id="probe-gruppe" style="background:#fff"><div style="background:#000;opacity:.5"><span style="color:#fff">gruppe</span></div></div>' +
      '<div id="probe-weg" style="background:#fff"><span style="color:#000;opacity:0">weg</span></div>'));
    // halb deckend gemalt landet je nach 8-Bit-Rundung des Canvas zwischen Grau 126 und 128, also bei 3,95 bis 4,06 statt 21
    const halbGrau = await kontrastFarben(page, 'rgb(127,127,127)', '#fff');
    for (const bereich of ['#probe-eigen', '#probe-vorfahr', '#probe-gruppe']) {
      const [m] = await kontrastMessen(page, [bereich]);
      expect(Math.abs(m.wert - halbGrau), `${bereich} misst ${komma(m.wert)}`).toBeLessThan(0.1);
    }
    expect(await kontrastMessen(page, ['#probe-weg'])).toEqual([]);
  });

  test('Bis zum Zeigen oder Fokussieren unsichtbar (opacity:0, sichtbar bei :focus) wird im fokussierten Zustand gemessen; Fokus wird zurückgegeben', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => {
      document.head.insertAdjacentHTML('beforeend', '<style>#probe-zeile button{opacity:0;color:#bbb;background:none;border:0}#probe-zeile button:focus{opacity:1}</style>');
      document.body.insertAdjacentHTML('beforeend', '<input id="probe-vorher"><div id="probe-zeile" style="background:#fff"><button>×</button><span style="opacity:0">weg</span></div>');
      document.querySelector('#probe-vorher').focus();
    });
    const messungen = await kontrastMessen(page, ['#probe-zeile']);
    expect(messungen.map(m => m.text)).toEqual(['×']);
    expect(messungen[0].wert).toBeLessThan(MASS);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('probe-vorher');
  });

  test('Warten auf ruhenden Zustand: eine angehaltene Transition lässt das Warten nicht hängen', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-angehalten" style="background:var(--kd-surface)"><span style="color:var(--kd-text);transition:color 60s linear">steht</span></div>'));
    // Stil-Flush: der Übergang startet nur, wenn der Ausgangsstil berechnet war (sonst gibt es nichts, wovon er gleiten könnte)
    await page.evaluate(() => getComputedStyle(document.querySelector('#probe-angehalten span')).color);
    await thema(page, 'dark');
    await page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSTransition).forEach(a => a.pause()));
    const beginn = Date.now();
    await farbuebergaengeAbwarten(page);
    expect(Date.now() - beginn).toBeLessThan(2000);
  });

  test('Warten auf ruhenden Zustand: nach dem Themenwechsel läuft ein Farbübergang, gemessen wird erst nach seinem Ende', async ({ page }) => {
    await thema(page, 'light');
    await page.evaluate(() => document.body.insertAdjacentHTML('beforeend',
      '<div id="probe-uebergang" style="background:var(--kd-surface)"><span style="color:var(--kd-text);transition:color 2s linear">gleitet</span></div>'));
    // Stil-Flush: der Übergang startet nur, wenn der Ausgangsstil berechnet war (sonst gibt es nichts, wovon er gleiten könnte)
    await page.evaluate(() => getComputedStyle(document.querySelector('#probe-uebergang span')).color);
    const laufende = () => page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSTransition && a.playState === 'running').length);
    await thema(page, 'dark');
    expect(await laufende()).toBeGreaterThan(0);
    await farbuebergaengeAbwarten(page);
    expect(await laufende()).toBe(0);
    const [m] = await kontrastMessen(page, ['#probe-uebergang']);
    expect(m.wert).toBeGreaterThanOrEqual(MASS);
  });

  test('Ungültige Farbe ist ein Fehler mit dem Wert, nicht still Schwarz', async ({ page }) => {
    await expect(kontrastFarben(page, 'keine-farbe', '#fff')).rejects.toThrow(/keine Farbe: keine-farbe/);
  });

  test('US-1: Board mit Legende und leerer Spalte, beide Themen', async ({ page }) => {
    await expect(page.locator('.bahn[data-col="Erledigt"] .leer')).toHaveText('leer');
    await expect(page.locator('.leg')).toContainText('Klick filtert');
    const verstoesse = await verstoesseInBeidenThemen(page, ['header', '.ka', '.bahn-kopf', '.leg', '.leer']);
    expect(verstoesse).toEqual([]);
  });

  test('US-1: der Erklärtext der Kopfzeichen (.kd-tipp) ist hell und dunkel lesbar (R00119, Nacharbeit O1)', async ({ page }) => {
    const ok = page.locator('.bahn[data-col="Erledigt"] .bahn-kopf .ok');
    const verstoesse = await verstoesseInBeidenThemen(page, ['#kd-tipp'], async () => { await ok.focus(); });
    expect(verstoesse).toEqual([]);
  });

  test('US-1: die Initialen tragen die On-Farbe ihrer Fläche, im Dunkelthema dunkel', async ({ page }) => {
    const farben = () => page.evaluate(() => {
      const probe = wert => { const p = document.createElement('p'); p.style.color = wert; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
      const schrift = sel => getComputedStyle(document.querySelector(sel)).color;
      return { mensch: schrift('.ka .pk-m'), agent: schrift('.ka .pk-a'), onMensch: probe('var(--kd-on-mensch)'), onAgent: probe('var(--kd-on-agent)') };
    });
    for (const t of THEMEN) {
      await thema(page, t);
      const f = await farben();
      expect(f.mensch, t).toBe(f.onMensch);
      expect(f.agent, t).toBe(f.onAgent);
    }
    expect((await farben()).mensch, 'dunkle Schrift auf den Initialen im Dunkelthema').not.toBe('oklch(1 0 0)');
  });

  test('US-2: Spaltenkopf über der Grenze und Warnungs-Toast mit „!“, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').dragTo(page.locator('.bahn[data-col="In Arbeit"] .flaeche'));
    await expect(page.locator('#pruef-warnung')).toContainText('Grenze erreicht');
    await expect(page.locator('.bahn[data-col="In Arbeit"] .bahn-kopf')).toContainText('überschritten');
    const verstoesse = await verstoesseInBeidenThemen(page, ['.bahn-kopf', '.toast']);
    expect(verstoesse).toEqual([]);
    const ausruf = (await kontrastMessen(page, ['#pruef-warnung'])).find(m => m.text === '!');
    expect(ausruf, 'das „!“ wird gemessen').toBeDefined();
  });

  test('US-3: Aufgabenfenster #2 mit Kommentar, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="2"]').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #2' })).toBeVisible();
    await expect(page.locator('.km .mono')).toContainText('Stefan');
    const verstoesse = await verstoesseInBeidenThemen(page, ['[role=dialog]']);
    expect(verstoesse).toEqual([]);
  });

  test('US-4: Modusleiste, beide Themen; Titel, Dateipfad, Untertitel, Verwerfen, Fertig und Ich-Knopf gemessen', async ({ page }) => {
    await ausMehr(page, 'Spalten einrichten');
    await expect(page.locator('header.kz.modus')).toBeVisible();
    expect(await verstoesseInBeidenThemen(page, ['header'])).toEqual([]);
    const texte = (await kontrastMessen(page, ['header'])).map(m => m.text);
    for (const text of ['Spalten einrichten', 'boards/entwicklung.md', 'Verwerfen', 'Fertig', 'Stefan']) expect(texte, text).toContain(text);
    expect(texte.some(t => t.startsWith('schreibt nur die Board-Datei')), 'Untertitel gemessen').toBe(true);
  });

  test('US-4: Modusleiste mit Fehler nach 409, beide Themen', async ({ page }) => {
    await page.route('**/api/boards/entwicklung/spalten', route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ fehler: 'Die Board-Datei wurde inzwischen geändert.' }) })
      : route.continue());
    await ausMehr(page, 'Spalten einrichten');
    await page.getByRole('button', { name: 'Fertig' }).click();
    await expect(page.locator('.fehl-kopf')).toBeVisible();
    expect(await verstoesseInBeidenThemen(page, ['header'])).toEqual([]);
    const fehler = (await kontrastMessen(page, ['header'])).filter(m => m.element.includes('.fehl-kopf'));
    expect(fehler.length, 'die Fehlermeldung wird gemessen').toBe(1);
  });

  test('Paarungen Modusleiste: Fläche --kd-modus; Titel, Board-Name, Dateipfad und Verwerfen --kd-modus-text; Untertitel --kd-muted; Fertig --kd-accent mit --kd-on-accent; über das Canvas, beide Themen', async ({ page }) => {
    await ausMehr(page, 'Spalten einrichten');
    const leiste = page.locator('header.kz.modus');
    await expect(leiste).toBeVisible();
    const fertig = leiste.getByRole('button', { name: 'Fertig' });
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      expect(await pixelVon(page, leiste, 'backgroundColor'), `${t}: Fläche`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-modus')));
      expect(await pixelVon(page, leiste.locator('.kz-modus b'), 'color'), `${t}: Titel`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-modus-text')));
      expect(await pixelVon(page, fertig, 'backgroundColor'), `${t}: Fertig Fläche`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-accent')));
      expect(await pixelVon(page, fertig, 'color'), `${t}: Fertig Schrift`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-on-accent')));
      const schriften = [
        ['Board-Name', leiste.locator('.kz-z1'), '--kd-modus-text'],
        ['Dateipfad', leiste.locator('.kz-z1 .mono'), '--kd-modus-text'],
        ['Verwerfen', leiste.getByRole('button', { name: 'Verwerfen' }), '--kd-modus-text'],
        ['Untertitel', leiste.locator('.kz-modus .muted'), '--kd-muted'],
      ];
      for (const [name, ort, token] of schriften) {
        expect(await pixelVon(page, ort, 'color'), `${t}: ${name}`).toEqual(await farbPixel(page, await tokenFarbe(page, token)));
      }
    }
  });

  test('Unterer Abschluss der Modusleiste: 1 px in --kd-modus-linie, mindestens 3:1 gegen --kd-modus und --kd-sunken, beide Themen; die Kopfzeile ohne Modus hat diese Linie nicht', async ({ page }) => {
    const kopf = page.locator('header.kz');
    const linie = () => kopf.evaluate(e => ({ breite: getComputedStyle(e).borderBottomWidth, farbe: getComputedStyle(e).borderBottomColor }));
    for (const t of THEMEN) {
      await thema(page, t);
      const ohneModus = await linie();
      const hatLinie = ohneModus.breite === '1px' && ohneModus.farbe === await tokenFarbe(page, '--kd-modus-linie');
      expect(hatLinie, `${t}: Kopfzeile ohne Modus ${ohneModus.breite} ${ohneModus.farbe}`).toBe(false);
    }
    await ausMehr(page, 'Spalten einrichten');
    await expect(page.locator('header.kz.modus')).toBeVisible();
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const mitModus = await linie();
      expect(mitModus.breite, t).toBe('1px');
      expect(await farbPixel(page, mitModus.farbe), `${t}: Linie`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-modus-linie')));
      expect(await kontrastFarben(page, mitModus.farbe, await tokenFarbe(page, '--kd-modus')), `${t}: Linie gegen Fläche`).toBeGreaterThanOrEqual(3);
      expect(await kontrastFarben(page, mitModus.farbe, await tokenFarbe(page, '--kd-sunken')), `${t}: Linie gegen den Grund darunter (--kd-sunken)`).toBeGreaterThanOrEqual(3);
    }
  });

  test('Fokusring Modusleiste: Verwerfen per Tastatur fokussiert zeigt 2 px --kd-accent, mindestens 3:1 gegen --kd-modus, beide Themen', async ({ page }) => {
    await ausMehr(page, 'Spalten einrichten');
    const leiste = page.locator('header.kz.modus');
    const verwerfen = leiste.getByRole('button', { name: 'Verwerfen' });
    await leiste.getByRole('button', { name: 'Fertig' }).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(verwerfen).toBeFocused();
    expect(await verwerfen.evaluate(e => e.matches(':focus-visible')), 'Fokus von der Tastatur').toBe(true);
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const ring = await verwerfen.evaluate(e => ({ breite: getComputedStyle(e).outlineWidth, stil: getComputedStyle(e).outlineStyle, farbe: getComputedStyle(e).outlineColor }));
      expect([ring.breite, ring.stil], t).toEqual(['2px', 'solid']);
      expect(await farbPixel(page, ring.farbe), `${t}: Ring`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-accent')));
      const wert = await kontrastFarben(page, ring.farbe, await tokenFarbe(page, '--kd-modus'));
      await test.info().attach(`Fokusring ${t}`, { body: komma(wert), contentType: 'text/plain' });
      expect(wert, `${t}: Ring gegen Fläche`).toBeGreaterThanOrEqual(3);
    }
  });

  test('Modusleiste beim Zeigen: Verwerfen und Ich-Knopf auf der Zustandsebene (8 % --kd-modus-text über --kd-modus), Schrift mindestens 4,5, beide Themen', async ({ page }) => {
    await ausMehr(page, 'Spalten einrichten');
    const leiste = page.locator('header.kz.modus');
    await expect(leiste).toBeVisible();
    const verwerfen = leiste.getByRole('button', { name: 'Verwerfen' });
    const ich = leiste.locator('#t-ich');
    const knoepfe = [{ name: 'Verwerfen', knopf: verwerfen, schrift: verwerfen }, { name: 'Ich-Knopf', knopf: ich, schrift: ich.locator('.ich-name') }];
    for (const t of THEMEN) {
      await thema(page, t);
      const ebene = await farbPixel(page, await tokenFarbe(page, 'color-mix(in oklch, var(--kd-modus-text) 8%, var(--kd-modus))'));
      for (const { name, knopf, schrift } of knoepfe) {
        await knopf.hover();
        await farbuebergaengeAbwarten(page);
        expect(await pixelVon(page, knopf, 'backgroundColor'), `${t}: ${name} Grund`).toEqual(ebene);
        const wert = await kontrastAm(schrift);
        await test.info().attach(`Zeigen ${name} ${t}`, { body: komma(wert), contentType: 'text/plain' });
        expect(wert, `${t}: ${name}`).toBeGreaterThanOrEqual(MASS);
      }
    }
  });

  test('US-5: Toast mit „rückgängig“ nach dem Ziehen, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="2"]').dragTo(page.locator('.bahn[data-col="Erledigt"] .flaeche'));
    const toast = page.locator('.toast');
    await expect(toast).toContainText('#2 nach „Erledigt“');
    await expect(toast.getByRole('button', { name: 'rückgängig' })).toBeVisible();
    const verstoesse = await verstoesseInBeidenThemen(page, ['.toast']);
    expect(verstoesse).toEqual([]);
  });

  test('US-7: im Ich-Menü zählt Inaktives nicht, Stefan und Mia sind lesbar', async ({ page }) => {
    await page.locator('#t-ich').click();
    const menue = page.locator('#pop[data-for="t-ich"]');
    await expect(menue.locator('[aria-disabled="true"]')).toHaveCount(2);
    for (const t of THEMEN) {
      await thema(page, t);
      const messungen = await kontrastMessen(page, ['#pop']);
      const texte = messungen.map(m => m.text);
      expect(texte, t).not.toContain('Claude');
      expect(texte, t).not.toContain('Anna');
      for (const name of ['Stefan', 'Mia']) {
        const m = messungen.find(x => x.text === name);
        expect(m, `${t}: ${name} gemessen`).toBeDefined();
        expect(m.wert, `${t}: ${name}`).toBeGreaterThanOrEqual(MASS);
      }
    }
  });

  test('US-8: Menü „Mehr“, beide Themen; in der Stufe compact mit „Ich bin … Stefan“', async ({ page }) => {
    await page.locator('#t-mehr').click();
    await expect(page.locator('#pop[aria-label="Mehr"]')).toBeVisible();
    expect(await verstoesseInBeidenThemen(page, ['[role=menu]'])).toEqual([]);
    await page.keyboard.press('Escape');
    // „Ich bin …“ steht erst in der Stufe compact im Menü (R00101)
    await page.setViewportSize({ width: 375, height: 800 });
    await page.locator('#t-mehr').click();
    await expect(page.locator('#mehr-ich .muted')).toHaveText('Stefan');
    expect(await verstoesseInBeidenThemen(page, ['[role=menu]'])).toEqual([]);
    const zusatz = (await kontrastMessen(page, ['[role=menu]'])).find(m => m.element === 'span.muted' && m.text === 'Stefan');
    expect(zusatz, 'der Zusatz „Stefan“ wird gemessen').toBeDefined();
  });

  test('US-8: Menü „Berichte“ mit Gruppenköpfen, beide Themen', async ({ page }) => {
    await page.locator('#t-ber').click();
    await expect(page.locator('#pop.menue .k')).toHaveText(['ZEITEN', 'VERLAUF', 'BESTAND', 'AUSLEITEN']);
    const verstoesse = await verstoesseInBeidenThemen(page, ['[role=menu]']);
    expect(verstoesse).toEqual([]);
  });

  test('US-8: Kontextmenü von #1 mit Untermenü Klasse, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="1"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /^Klasse/ }).click();
    await expect(page.locator('.kmenue.unter')).toBeVisible();
    await expect(page.locator('.kmenue.unter .km-aktuell')).toHaveAttribute('aria-disabled', 'true');
    const verstoesse = await verstoesseInBeidenThemen(page, ['[role=menu]']);
    expect(verstoesse).toEqual([]);
    const kuerzel = (await kontrastMessen(page, ['[role=menu]'])).filter(m => m.element.includes('.km-k'));
    expect(kuerzel.length, 'Tastenkürzel werden gemessen').toBeGreaterThan(0);
  });

  test('US-9: Platzhalter im Titelfeld von „Neue Aufgabe“, beide Themen', async ({ page }) => {
    await page.keyboard.press('n');
    const titel = page.locator('.mod.neu .titel');
    await expect(titel).toBeVisible();
    await expect(titel).toHaveValue('');
    const verstoesse = await verstoesseInBeidenThemen(page, ['.mod.neu']);
    expect(verstoesse).toEqual([]);
    const platzhalter = (await kontrastMessen(page, ['.mod.neu'])).filter(m => m.element.endsWith('::placeholder'));
    expect(platzhalter.length, 'der Platzhalter wird gemessen').toBeGreaterThan(0);
  });

  test('US-1 Liste: Zahl im aktiven Segment des Kopfs („alle 5“) ist lesbar, beide Themen', async ({ page }) => {
    await page.goto(k.adresse + '#/aufgaben');
    const zahl = page.locator('.kz .seg span.an span.mono');
    await expect(zahl).toHaveText('5');
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      expect(await kontrastAm(zahl), t).toBeGreaterThanOrEqual(MASS);
    }
  });

  /** Messungen je Thema, nur die Platzhalter eines Felds; `vorher` stellt den Zustand nach dem Themenwechsel her. */
  async function platzhalterInBeidenThemen(page, bereich, id, vorher = async () => {}) {
    const alle = [];
    for (const t of THEMEN) {
      await thema(page, t);
      await vorher();
      await farbuebergaengeAbwarten(page);
      const messungen = (await kontrastMessen(page, [bereich])).filter(m => m.element.startsWith(`input#${id}`) || m.element.startsWith(`textarea#${id}`));
      alle.push(...messungen.filter(m => m.element.endsWith('::placeholder')).map(m => ({ thema: t, ...m })));
    }
    await test.info().attach(`Platzhalter ${id}`, { body: alle.map(lesbar).join('\n'), contentType: 'text/plain' });
    return alle;
  }

  test('Kopf: Platzhalter jedes leeren Felds ungefokussiert und fokussiert (Grund wechselt auf --kd-surface) mindestens 4,5, beide Themen', async ({ page }) => {
    await expect(page.locator('#flt')).toHaveValue('');
    const ids = await page.locator('header input[placeholder]').evaluateAll(liste => liste.map(e => e.id));
    expect(ids, 'das Filterfeld ist dabei').toContain('flt');
    for (const id of ids) {
      const feld = page.locator(`#${id}`);
      const ruhend = await platzhalterInBeidenThemen(page, 'header', id, () => feld.blur());
      const fokussiert = await platzhalterInBeidenThemen(page, 'header', id, () => feld.focus());
      await expect(feld).toBeFocused();
      expect(ruhend.length, `${id} ungefokussiert: je Thema ein Platzhalter`).toBe(2);
      expect(fokussiert.length, `${id} fokussiert: je Thema ein Platzhalter`).toBe(2);
      expect([...ruhend, ...fokussiert].filter(m => m.wert < MASS).map(lesbar), id).toEqual([]);
    }
  });

  test('Platzhalter, den nur die globale Regel ::placeholder färbt: Kommentarfeld im Aufgabenfenster #2, beide Themen', async ({ page }) => {
    await page.locator('.ka[data-id="2"]').click();
    const feld = page.locator('#km-inp');
    await expect(feld).toHaveValue('');
    const eigeneRegel = await page.evaluate(() => [...document.styleSheets].flatMap(b => [...b.cssRules]).filter(r => r.selectorText && r.selectorText.includes('::placeholder') && r.selectorText.trim() !== '::placeholder').some(r => document.querySelector('#km-inp').matches(r.selectorText.replace(/::placeholder/g, ''))));
    expect(eigeneRegel, 'keine eigene Platzhalter-Regel trifft das Feld').toBe(false);
    const messungen = await platzhalterInBeidenThemen(page, '[role=dialog]', 'km-inp');
    expect(messungen.length, 'je Thema ein Platzhalter').toBe(2);
    expect(messungen.filter(m => m.wert < MASS).map(lesbar)).toEqual([]);
  });

  test('Ansichten: jede Ansicht samt Kopf, beide Themen, ohne die ausdrücklich nicht gemessenen Zustände', async ({ page }) => {
    for (const { ansicht, adresse } of ANSICHTEN) {
      await ansichtOeffnen(page, k.adresse + adresse);
      const ohne = NICHT_GEMESSEN.filter(n => n.ansicht === ansicht).map(n => n.selektor);
      const verstoesse = await verstoesseInBeidenThemen(page, ['body'], async () => {}, ohne);
      expect(verstoesse, ansicht).toEqual([]);
    }
  });

  test('Nicht gemessen: leer seit Karte #57 (R00188); ein Eintrag kommt in seiner Ansicht vor und misst je Thema unter 4,5, aber nicht schlechter als heute', async ({ page }) => {
    expect(NICHT_GEMESSEN.map(n => n.selektor), 'seit #57 ist nichts mehr ausgenommen').toEqual([]);
    for (const n of NICHT_GEMESSEN) {
      await ansichtOeffnen(page, k.adresse + ANSICHTEN.find(a => a.ansicht === n.ansicht).adresse);
      const ort = page.locator(n.selektor).first();
      await expect(ort, n.selektor).toBeVisible();
      for (const t of THEMEN) {
        await thema(page, t);
        await farbuebergaengeAbwarten(page);
        const wert = await kontrastAm(ort);
        expect(wert, `${t} ${n.selektor}: ${n.grund}`).toBeLessThan(MASS);
        expect(wert, `${t} ${n.selektor}: nicht schlechter als heute ${komma(n.heute[t])}`).toBeGreaterThanOrEqual(n.heute[t] - SPIELRAUM);
      }
    }
  });

  test('US-9: „Anlegen“ beim Zeigen (accent-hover mit on-accent), beide Themen', async ({ page }) => {
    await page.keyboard.press('n');
    const anlegen = page.locator('.mod.neu .btn-haupt', { hasText: 'Anlegen' });
    await expect(anlegen).toBeVisible();
    for (const t of THEMEN) {
      await thema(page, t);
      await anlegen.hover();
      await farbuebergaengeAbwarten(page);
      const grund = await anlegen.evaluate(e => getComputedStyle(e).backgroundColor);
      const verlangt = await page.evaluate(() => { const p = document.createElement('p'); p.style.color = 'var(--kd-accent-hover)'; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; });
      expect(grund, `${t}: Grund ist accent-hover`).toBe(verlangt);
      expect(await kontrastAm(anlegen), t).toBeGreaterThanOrEqual(MASS);
    }
  });

  test('Ausnahmeliste: leer, jeder Eintrag mit Kartennummer #50 oder #55', () => {
    for (const a of AUSNAHMEN) expect(['#50', '#55']).toContain(a.karte);
    expect(AUSNAHMEN).toEqual([]);
  });
});

/**
 * R00188 57-1/57-2 (Karte #57, ADR-0011 Nachtrag N2): die Initiale einer stillgelegten Person ist lesbar (≥ 4,5:1, gedämpft über
 * einen Farbton, nicht über Deckkraft) und nennt ihren Zustand — auf der Karte, in der Personenliste und in den Einstellungen.
 * Gegenproben: Deckkraft 0,5 zurück → gemeldet; dieselbe Initiale in einer als nicht bedienbar gekennzeichneten Zeile → ungemeldet.
 */
test.describe('R00188 Stillgelegte Person lesbar', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k;
  /** Grundbestand mit #4 für Stefan und die stillgelegte Anna (`ab`). */
  const MIT_STILLGELEGTER = () => ({ ...GRUNDBESTAND(), 'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier\nassignees: [st, ab]\n---\n' });
  test.beforeEach(async ({ page }) => {
    k = await kanbanStarten(einrichten(MIT_STILLGELEGTER()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await expect(page.locator('.ka')).toHaveCount(5);
  });
  test.afterEach(() => k.stoppen());

  /** Die drei Stellen: Adresse, Initiale von Anna, Element, an dem „stillgelegt“ als Text oder Hilfstext stehen muss. */
  const STELLEN = [
    { stelle: 'Karte #4', adresse: '#/board/entwicklung', initiale: '.ka[data-id="4"] .avs .pk-still', zustand: '.ka[data-id="4"] .avs .pk-still' },
    { stelle: 'Personenliste', adresse: '#/personen', stillgelegteZeigen: true, initiale: '.pt tr[data-person="ab"] .pk', zustand: '.pt tr[data-person="ab"]' },
    { stelle: 'Einstellungen', adresse: '#/einrichten', initiale: '.klz.pz[data-person="ab"] .pk', zustand: '.klz.pz[data-person="ab"] .pk' },
  ];
  /** Die Personenliste zeigt Stillgelegte erst nach dem Schalter „stillgelegte zeigen“. */
  const stillgelegteZeigen = async page => {
    await page.locator('[data-act="still-auch"]').click();
    await expect(page.locator('.pt tr[data-person="ab"]')).toHaveCount(1);
  };
  /** Text samt Hilfstexten eines Elements und seiner Nachfahren. */
  const textUndHilfstext = ort => ort.evaluate(e => [e, ...e.querySelectorAll('*')].map(x => `${x.getAttribute('title') || ''} ${x.getAttribute('aria-label') || ''}`).join(' ') + ' ' + e.textContent);

  test('US-1: Initiale von Anna an allen drei Stellen mindestens 4,5 in Hell und Dunkel, ohne Deckkraft, „stillgelegt“ als Text oder Hilfstext', async ({ page }) => {
    for (const s of STELLEN) {
      await ansichtOeffnen(page, k.adresse + s.adresse);
      if (s.stillgelegteZeigen) await stillgelegteZeigen(page);
      const initiale = page.locator(s.initiale);
      await expect(initiale, s.stelle).toHaveCount(1);
      await expect(initiale, `${s.stelle}: gedämpft über den Ton, nicht über Deckkraft`).toHaveCSS('opacity', '1');
      expect(await textUndHilfstext(page.locator(s.zustand)), `${s.stelle}: Zustand genannt`).toContain('stillgelegt');
      for (const t of THEMEN) {
        await thema(page, t);
        await farbuebergaengeAbwarten(page);
        expect(await kontrastAm(initiale), `${t} ${s.stelle}`).toBeGreaterThanOrEqual(MASS);
      }
    }
  });

  test('US-1: die stillgelegte Initiale ist sichtbar zurückhaltender als die aktive von Stefan — andere Fläche, nicht die Rollenfarbe', async ({ page }) => {
    const karte = page.locator('.ka[data-id="4"]');
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const [still, aktiv] = await Promise.all([karte.locator('.pk-still'), karte.locator('.pk:not(.pk-still)')].map(o => o.evaluate(e => getComputedStyle(e).backgroundColor)));
      expect(still, t).not.toBe(aktiv);
      expect(still, t).toBe(await tokenFarbe(page, '--kd-still'));
    }
  });

  test('Gegenprobe: Deckkraft 0,5 an der Initiale wird gemeldet; dieselbe Initiale in einer nicht bedienbaren Zeile mit Grund bleibt ungemeldet', async ({ page }) => {
    await ansichtOeffnen(page, k.adresse + '#/personen');
    await stillgelegteZeigen(page);
    await page.addStyleTag({ content: '.pk-still{opacity:.5}' });
    const zeile = '.pt tr[data-person="ab"]';
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const gemeldet = (await kontrastMessen(page, [zeile])).filter(m => m.wert < MASS && m.element.includes('pk-still'));
      expect(gemeldet.length, `${t}: Deckkraft zurück wird gemeldet`).toBeGreaterThan(0);
    }
    await page.locator(zeile).evaluate(e => { e.setAttribute('aria-disabled', 'true'); e.title = 'stillgelegt'; });
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      expect((await kontrastMessen(page, [zeile])).filter(m => m.element.includes('pk-still')), `${t}: inaktiv mit Grund`).toEqual([]);
    }
  });

  test('57-2: im Dialog „Zuständige“ ist die gesperrte Zeile von Anna als nicht bedienbar gekennzeichnet und nennt den Grund; solange wählbar, ist ihre Initiale lesbar', async ({ page }) => {
    await page.locator('.ka[data-id="4"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /Zuständige zuweisen/ }).click();
    const dialog = page.getByRole('dialog', { name: 'Zuständige für #4' });
    const zeile = dialog.locator('.zw-p.still');
    await expect(zeile.getByRole('checkbox')).toBeEnabled();
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      expect(await kontrastAm(zeile.locator('.pk')), `${t}: wählbar und lesbar`).toBeGreaterThanOrEqual(MASS);
    }
    await zeile.getByRole('checkbox').uncheck();
    await expect(zeile.getByRole('checkbox')).toBeDisabled();
    await expect(zeile).toHaveAttribute('aria-disabled', 'true');
    await expect(zeile).toHaveAttribute('title', /stillgelegt/);
  });
});

/**
 * R00139 (Karte #50, ADR-0011 Nachtrag N1): Text auf einer eigenen Nutzerfarbe trägt `--kd-text`, nicht `--kd-muted` — dieselbe Regel,
 * die das Preisetikett schon trägt. Gemessen wird die Zeile r3 der Karte (Σ-Zeit, Datum, Herkunft), dazu Kartennummer und der Titel
 * einer fertigen Karte: eine eigene Klassenfarbe `#ffffff` gegen ein Gegenstück der Palettenklasse `bug`, beide Themen. Eigene Farben
 * liegen außerhalb der Paartabelle (Regel 7); geprüft wird nur die Schriftfarbe am gezeichneten Element (Weiß 30 % über
 * `--kd-surface` im Dunkelthema: `--kd-muted` 2,571, `--kd-text` 4,677).
 * Seit R00212 (#226) ist die Herkunft Text (`span.org`) ohne Zeige-Zustand: gemessen wird, dass die Maus über ihr nichts ändert
 * (vorher stellte die Ruhe-Regel dieses Blocks `a.org:hover` auf `--kd-text` auf `--kd-accent`, #50n).
 */
test.describe('R00139 Text auf eigener Klassenfarbe', () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  let k;
  /** Grundbestand: #1 mit eigener Klassenfarbe `#ffffff`, 46 Minuten gebucht und auflösbarer Herkunft I0005; #2 als Palettenklasse `bug`
      ohne Herkunft; #3 mit eigener Farbe in „Erledigt“ (fertig); #4 mit eigener Farbe und Herkunft „ohne Herkunft“ (`.org.leer`). */
  const EIGEN = () => ({
    'kanbanD.md': `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses:\n  bug: {label: Fehler, color: red}\n  eigen: {label: Eigen, color: '#ffffff'}\nsources:\n  wbs: plan/wbs.md\n  requirements: anf/\n---\n`,
    'plan/wbs.md': '# WBS\n\n| ID | Ebene | Eltern | Name | Status | Braucht |\n|---|---|---|---|---|---|\n| I0005 | Interaction | D0001 | Anlegen | gruen | |\n',
    'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #4\n\n## In Arbeit\n\n## Erledigt\n\n- #3\n',
    'aufgaben/0001-eins.md': `---\nid: 1\ntitle: eins\nclass: eigen\norigins: [I0005]\ndue: ${inTagen(3)}\n---\n\`\`\`kanbanD-time\n2026-10-17 09:00 · 2026-10-17 09:46 · st\n\`\`\`\n`,
    'aufgaben/0002-zwei.md': `---\nid: 2\ntitle: zwei\nclass: bug\ndue: ${inTagen(3)}\n---\n\`\`\`kanbanD-time\n2026-10-17 09:00 · 2026-10-17 09:46 · st\n\`\`\`\n`,
    'aufgaben/0003-drei.md': `---\nid: 3\ntitle: drei\nclass: eigen\ndue: ${inTagen(3)}\n---\n`,
    'aufgaben/0004-vier.md': `---\nid: 4\ntitle: vier\nclass: eigen\ndue: ${inTagen(3)}\n---\n`,
  });
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(einrichten(EIGEN()));
    await alsPerson(page, 'st');
    await page.goto(k.adresse);
    await liveBereit(page);
    await expect(page.locator('.ka')).toHaveCount(4);
  });
  test.afterEach(() => k.stoppen());

  /** Die gemessenen Elemente der Zeile r3: Σ-Zeit, Datum und Herkunft (Knoten I0005). */
  const r3Texte = karte => [
    ['Σ-Zeit', karte.locator('.r3 .sum')],
    ['Datum', karte.locator('.r3 .due')],
    ['Herkunft', karte.locator('.r3 .org')],
  ];

  /** Misst Σ-Zeit, Datum und Herkunft einer Karte in beiden Themen: Kontrast und berechnete Schriftfarbe als Pixel, dazu der verlangte Token je Thema. */
  async function r3InBeidenThemen(page, karte, token) {
    const gemessen = [];
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const verlangt = await farbPixel(page, await tokenFarbe(page, token));
      for (const [name, ort] of r3Texte(karte)) {
        gemessen.push({ beschriftung: `${t} ${name}`, wert: await kontrastAm(ort), farbe: await pixelVon(page, ort, 'color'), verlangt });
      }
    }
    return gemessen;
  }

  test('US-1/US-2: Σ-Zeit, Datum und Herkunft auf eigener Klassenfarbe #ffffff tragen --kd-text und halten 4,5:1, beide Themen', async ({ page }) => {
    const eigen = page.locator('.ka[data-eigen][data-id="1"]');
    await expect(eigen).toHaveCount(1);
    await expect(eigen.locator('.r3 .sum')).toHaveText('Σ 0:46');
    await expect(eigen.locator('.r3 .org')).toHaveText('I0005');
    const gemessen = await r3InBeidenThemen(page, eigen, '--kd-text');
    // Zuerst der Grund der Nutzerin: mindestens 4,5:1 (WCAG 2.1 SC 1.4.3), heute dunkel 2,571
    for (const m of gemessen) expect(m.wert, `${m.beschriftung}: Kontrast ${komma(m.wert)} auf eigener Klassenfarbe`).toBeGreaterThanOrEqual(MASS);
    // Dann die festgelegte Schriftfarbe auf eigener Farbe (ADR-0011 Nachtrag N1)
    for (const m of gemessen) expect(m.farbe, `${m.beschriftung}: Schriftfarbe ist --kd-text`).toEqual(m.verlangt);
    // Die Herkunft ohne Quelle (`.org.leer`, „ohne Herkunft“) bleibt als eigener Fall gemessen — sie trug vor der Nacharbeit die Probe der Karte.
    const leer = page.locator('.ka[data-eigen][data-id="4"] .r3 .org');
    await expect(leer).toHaveText('ohne Herkunft');
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const wert = await kontrastAm(leer);
      expect(wert, `${t} Herkunft ohne Quelle: Kontrast ${komma(wert)} auf eigener Klassenfarbe`).toBeGreaterThanOrEqual(MASS);
      expect(await pixelVon(page, leer, 'color'), `${t} Herkunft ohne Quelle: Schriftfarbe ist --kd-text`)
        .toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-text')));
    }
  });

  test('Herkunft ist Text ohne Zeige-Zustand: die Maus ändert weder Grund noch Schrift, beide Themen', async ({ page }) => {
    const org = page.locator('.ka[data-eigen][data-id="1"] span.org');
    await expect(org).toHaveCount(1);
    await expect(org).toHaveText('I0005');
    await expect(page.locator('a.org')).toHaveCount(0);
    for (const t of THEMEN) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const messung = async () => ({ grund: await pixelVon(page, org, 'backgroundColor'), schrift: await pixelVon(page, org, 'color'), wert: await kontrastAm(org) });
      const ruhe = await messung();
      expect(ruhe.wert, `${t} Ruhe: Kontrast ${komma(ruhe.wert)} auf eigener Klassenfarbe`).toBeGreaterThanOrEqual(MASS);
      expect(ruhe.schrift, `${t} Ruhe: Schrift ist --kd-text`).toEqual(await farbPixel(page, await tokenFarbe(page, '--kd-text')));
      await org.hover();
      await farbuebergaengeAbwarten(page);
      expect(await messung(), `${t} Zeigen: nichts ändert sich`).toEqual(ruhe);
      await page.mouse.move(0, 0);
    }
  });

  test('Kartennummer und Titel der fertigen Karte auf eigener Farbe tragen --kd-text und halten 4,5:1, beide Themen', async ({ page }) => {
    const orte = [
      ['Kartennummer', page.locator('.ka[data-eigen][data-id="1"] .id')],
      ['Titel der fertigen Karte', page.locator('.ka.fertig[data-eigen] .t')],
    ];
    await expect(orte[0][1]).toHaveText('#1');
    await expect(orte[1][1]).toHaveText('drei');
    // dunkel zuerst: dort liegt der Befund (--kd-muted auf eigener heller Farbe 2,585)
    for (const t of ['dark', 'light']) {
      await thema(page, t);
      await farbuebergaengeAbwarten(page);
      const verlangt = await farbPixel(page, await tokenFarbe(page, '--kd-text'));
      for (const [name, ort] of orte) {
        const wert = await kontrastAm(ort);
        expect(wert, `${t} ${name}: Kontrast ${komma(wert)} auf eigener Klassenfarbe`).toBeGreaterThanOrEqual(MASS);
        expect(await pixelVon(page, ort, 'color'), `${t} ${name}: Schriftfarbe ist --kd-text`).toEqual(verlangt);
      }
    }
  });

  test('Gegenprobe US-3: die Karte der Palettenklasse bug behält --kd-muted, beide Themen', async ({ page }) => {
    const palette = page.locator('.ka[data-id="2"]');
    await expect(palette).toHaveAttribute('data-c', 'bug');
    expect(await palette.getAttribute('data-eigen'), 'die Palettenkarte ist keine eigene Farbe').toBeNull();
    const gemessen = await r3InBeidenThemen(page, palette, '--kd-muted');
    for (const m of gemessen) expect(m.wert, `${m.beschriftung}: Kontrast ${komma(m.wert)}`).toBeGreaterThanOrEqual(MASS);
    for (const m of gemessen) expect(m.farbe, `${m.beschriftung}: Schriftfarbe bleibt --kd-muted`).toEqual(m.verlangt);
    // Kartennummer bleibt in der Palettenfarbe bei der geprüften Schrift (Paar --kd-c-* ↔ --kd-muted); der Titel trägt den geerbten Textton
    const muted = await farbPixel(page, await tokenFarbe(page, '--kd-muted'));
    const text = await farbPixel(page, await tokenFarbe(page, '--kd-text'));
    expect(await pixelVon(page, palette.locator('.id'), 'color'), 'Kartennummer der Palettenkarte bleibt --kd-muted').toEqual(muted);
    expect(await pixelVon(page, palette.locator('.t'), 'color'), 'Titel der Palettenkarte trägt den geerbten Textton').toEqual(text);
  });
});

test.describe('R00107 Wie lange noch', () => {
  let k;
  test.afterEach(() => k.stoppen());

  const vorTagen = n => { const d = new Date(); d.setDate(d.getDate() - n); const p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00:00`; };
  const board = (zu, arbeit, pruefen, fertig) => `# Entwicklung\n\n## Zu erledigen\n\n${zu.map(n => `- #${n}\n`).join('')}\n## In Arbeit\n\n${arbeit.map(n => `- #${n}\n`).join('')}\n## Prüfen\n\n${pruefen.map(n => `- #${n}\n`).join('')}\n## Erledigt\n\n${fertig.map(n => `- #${n}\n`).join('')}`;
  function commitAm(ordner, datum, text) {
    fs.writeFileSync(ordner + '/boards/entwicklung.md', text);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-am', 'stand'], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum } });
  }

  test('dunkel: Blöcke mit 3, 1 und 0 von 3 lesbar, Grund über --anteil statt Farbton', async ({ page }) => {
    k = await kanbanStarten(async ordner => {
      const dateien = {};
      for (let n = 1; n <= 3; n++) dateien[`aufgaben/000${n}-a${n}.md`] = `---\nid: ${n}\ntitle: a${n}\n---\n`;
      einrichten(dateien)(ordner);
      commitAm(ordner, vorTagen(4), board([1, 2, 3], [], [], []));
      commitAm(ordner, vorTagen(3), board([2, 3], [1], [], []));
      commitAm(ordner, vorTagen(2), board([3], [2], [1], []));
      commitAm(ordner, vorTagen(1), board([], [2, 3], [1], []));
    });
    await alsPerson(page, 'st');
    await page.goto(k.adresse + '#/berichte/prognose');
    const block = spalte => page.locator(`.wl-phase[data-spalte="${spalte}"]`);
    await expect(block('In Arbeit')).toContainText('3 VON 3 ERREICHT');
    await expect(block('Prüfen')).toContainText('1 VON 3 ERREICHT');
    await expect(block('Erledigt')).toContainText('0 VON 3 ERREICHT');
    await thema(page, 'dark');
    for (const spalte of ['In Arbeit', 'Prüfen', 'Erledigt']) {
      const stil = await block(spalte).getAttribute('style');
      expect(stil, spalte).toContain('--anteil');
      expect(stil, spalte).not.toContain('--h');
      const sel = `.wl-phase[data-spalte="${spalte}"]`;
      const zuWenig = (await kontrastVerstoesse(page, [sel])).map(m => `${spalte} ${m.element} „${m.text}“ ${komma(m.wert)}`);
      expect(zuWenig).toEqual([]);
    }
  });
});
