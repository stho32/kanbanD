// R00113 Struktur für Hilfstechnik (ADR-0018): Seitenüberschrift und Landmarks je Route und Zustand, abgeglichen gegen vHaupt().
const fs = require('node:fs');
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, ausMehr } = require('./hilfen');
const {
  grundbestand, arbeitMitEinerPhase, ROUTEN, ZUSTAENDE, APP_JS,
  gezeichnet, seitenueberschriftPruefen, landmarkenPruefen, sichtenVonVHaupt, vollstaendigkeitPruefen,
  ebenenPruefen, GESTALTUNG, gestaltungPruefen,
} = require('./struktur-hilfen');

// Breite der Spalten und der Seite vor dem Bau, „In Arbeit“ zugeklappt: gemessen mit getBoundingClientRect und scrollWidth am Stand
// 9e806a7 (Spalten unverändert seit f719975) über das Messskript der Karte #13 (bahnbreite.js, fotos.js, 2026-11-08). Handy mit Touch.
const SPALTEN_VORHER = [
  { breite: 1280, handy: false, bahnen: [272, 34, 272] },
  { breite: 414, handy: true, bahnen: [386, 49, 386] },
  { breite: 320, handy: true, bahnen: [292, 49, 292] },
];
const [ERSTER_START, EINRICHTUNGSMODUS, DEFEKTES_BOARD] = ZUSTAENDE;
const WBS_SICHT = ROUTEN.find(r => r.ansicht === 'WBS-Sicht');

const spalte = (page, name) => page.locator(`#main section.bahn[data-col="${name}"]`);

/** Verstöße gegen die Struktur je Spalte (AK 4, AK 6, FA 6): die h2 ist erstes Kind der section.bahn, eine zugeklappte Spalte
 *  enthält keine list, eine offene genau eine, und jedes Kind ihrer Fläche ist ein listitem — auch „leer“ und „Archiv“. */
async function spaltenStrukturPruefen(page) {
  const verstoesse = [];
  for (const bahn of await page.locator('#main section.bahn').all()) {
    const name = await bahn.getAttribute('data-col');
    const erstesKind = await bahn.evaluate(b => b.firstElementChild.tagName);
    if (erstesKind !== 'H2') verstoesse.push(`${name}: erstes Kind ${erstesKind} statt H2`);
    const listen = await bahn.getByRole('list').count();
    const zugeklappt = await bahn.evaluate(b => b.classList.contains('zu'));
    if (zugeklappt && listen !== 0) verstoesse.push(`${name}: zugeklappt, aber ${listen} × list`);
    if (!zugeklappt && listen !== 1) verstoesse.push(`${name}: ${listen} × list statt 1`);
    if (!zugeklappt && listen === 1) verstoesse.push(...await eintraegeOhneRolle(bahn.getByRole('list'), name));
  }
  return verstoesse;
}

/** Kinder der Liste, die kein listitem sind, als Verstoß mit ihrer Klasse. */
async function eintraegeOhneRolle(liste, name) {
  const ohneRolle = await liste.evaluate(l => [...l.children].filter(kind => kind.getAttribute('role') !== 'listitem').map(kind => kind.className));
  return ohneRolle.map(klasse => `${name}: .${klasse} ist kein listitem`);
}

/** „Erledigt“ ohne sichtbare Karte, aber mit einer archivierten: die Fläche zeigt „leer“ und den Link „Archiv (1)“ (FA 6). */
const ERLEDIGT_MIT_ARCHIV = {
  'boards/entwicklung.md': '---\ncolumn-phases:\n  In Arbeit: Entwicklung\n---\n\n# Entwicklung\n\n## Zu erledigen\n\n- [#1](../aufgaben/0001-eins.md)\n- [#2](../aufgaben/0002-zwei.md)\n- [#3](../aufgaben/0003-drei.md)\n\n## In Arbeit\n\n- [#4](../aufgaben/0004-vier.md)\n- [#9](../aufgaben/0009-neun.md)\n\n## Erledigt\n\n- [#5](../aufgaben/0005-fuenf.md)\n',
  'aufgaben/0005-fuenf.md': '---\nid: 5\ntitle: fünf\narchived: 2026-10-01\n---\n',
};

/** Mutanten der Spaltenstruktur: je einer bricht eine Regel aus AK 4, AK 6 oder FA 6, die Probe nennt genau den Verstoß. */
const SPALTEN_MUTANTEN = [
  { name: 'zugeklappte Spalte als list', ersetzen: [['class="flaeche zu-streifen"', 'class="flaeche zu-streifen" role="list"']], erwartet: ['In Arbeit: zugeklappt, aber 1 × list'] },
  {
    name: 'h2 hinter dem Kopf',
    ersetzen: [
      ['${vSpaltenUeberschrift(sp)}<div class="bahn-kopf', '<div class="bahn-kopf'],
      ['</div><button class="flaeche zu-streifen"', '</div>${vSpaltenUeberschrift(sp)}<button class="flaeche zu-streifen"'],
      ['</div><div class="flaeche" role="list"', '</div>${vSpaltenUeberschrift(sp)}<div class="flaeche" role="list"'],
    ],
    erwartet: ['Zu erledigen: erstes Kind DIV statt H2', 'In Arbeit: erstes Kind DIV statt H2', 'Erledigt: erstes Kind DIV statt H2'],
  },
  { name: '„leer“ ohne Rolle', ersetzen: [['<div class="leer" role="listitem">${gefiltert', '<div class="leer">${gefiltert']], erwartet: ['Erledigt: .leer ist kein listitem'] },
  { name: '„Archiv“ ohne Rolle', ersetzen: [['<div class="nach" role="listitem">', '<div class="nach">']], erwartet: ['Erledigt: .nach ist kein listitem'] },
];

/** Rückgaben in vHaupt(), die nicht die Form `[if (…) ]return vX();` haben: die Probe kann ihre Sicht nicht lesen und muss das melden. */
const WBS_ZWEIG = "  if (S.ui.view === 'wbs') return vWbs();";
const RUECKGABE_MUTANTEN = [
  { name: 'anderer Rückgabeausdruck', aus: WBS_ZWEIG, ein: "  if (S.ui.view === 'wbs') return vWbs() + vNeueSicht();" },
  { name: 'Ternary', aus: '  return vBoard();\n}', ein: "  return S.ui.view === 'neu' ? vNeueSicht() : vBoard();\n}" },
  { name: 'Aufruf mit Argument', aus: WBS_ZWEIG, ein: "  if (S.ui.view === 'wbs') return vWbs(S.ui);" },
  { name: 'return ohne v-Präfix', aus: WBS_ZWEIG, ein: "  if (S.ui.view === 'wbs') return wbsSicht();" },
];

/** Der Navigationseintrag, der je Route `aria-current="page"` trägt (US-9); `#t-ber` ist der Auslöser des Berichtsmenüs. */
const AKTUELLER_EINTRAG = { Board: 'Board', Aufgabenliste: 'Aufgaben', Personen: 'Personen', Einrichten: 'Einrichten', 'WBS-Sicht': 'WBS' };
const erwarteterEintrag = route => AKTUELLER_EINTRAG[route.ansicht] || '#t-ber Berichte';

/** Verstöße gegen „genau ein Link der Navigation trägt aria-current=page, und zwar der der Route“. */
async function aktuelleSeitePruefen(page, route) {
  const aktuell = await page.locator('nav a[aria-current="page"]').evaluateAll(links => links.map(a => [a.id && '#' + a.id, a.firstChild.textContent.trim()].filter(Boolean).join(' ')));
  const erwartet = erwarteterEintrag(route);
  if (aktuell.length === 1 && aktuell[0] === erwartet) return [];
  return [`${route.ansicht}: aria-current an „${aktuell.join(', ')}“ statt „${erwartet}“`];
}

/** Name der Seite im Seitenknopf und Eintrag des Seitenmenüs, der je Route `aria-current="page"` trägt (US-10). */
function erwarteteSeite(route) {
  const eintrag = AKTUELLER_EINTRAG[route.ansicht];
  if (eintrag) return eintrag;
  return 'Berichte';
}

/** Verstöße gegen „unter 600 px keine navigation, der Seitenknopf nennt die Seite, im Seitenmenü trägt genau ihr Eintrag mit .an aria-current“. */
async function seitenmenuePruefen(page, route) {
  const erwartet = erwarteteSeite(route);
  const verstoesse = [];
  const navigation = await page.getByRole('navigation').count();
  if (navigation !== 0) verstoesse.push(`${route.ansicht}: ${navigation} × navigation bei 560 px`);
  const knopf = page.locator('#t-seite');
  const name = await knopf.getAttribute('aria-label');
  if (name !== `Seite: ${erwartet}`) verstoesse.push(`${route.ansicht}: Seitenknopf „${name}“ statt „Seite: ${erwartet}“`);
  await knopf.click();
  const menue = page.getByRole('menu', { name: 'Seite' });
  await menue.waitFor();
  const aktuell = await menue.locator('[aria-current="page"]').evaluateAll(eintraege => eintraege.map(e => ({ text: e.firstChild.textContent.trim(), an: e.classList.contains('an') })));
  await knopf.click();
  await expect(menue).toHaveCount(0);
  const genauDerEintrag = aktuell.length === 1 && aktuell[0].text === erwartet && aktuell[0].an;
  if (!genauDerEintrag) verstoesse.push(`${route.ansicht}: aria-current im Seitenmenü an „${aktuell.map(e => e.text).join(', ')}“ statt „${erwartet}“`);
  return verstoesse;
}

/** Je Stelle, die aria-current setzt, ein Mutant „Eintrag entfernt“: der Aufruf fällt weg, die Probe der Route muss rot werden. */
const BERICHT = ROUTEN.find(r => r.ansicht === 'Bericht verlauf');
const OHNE_AKTUELL = [
  { eintrag: 'Navigation Board', aus: '${board.attribut}', ansicht: 'Board', breite: 1280 },
  { eintrag: 'Navigation Aufgaben', aus: '${aufgaben.attribut}', ansicht: 'Aufgabenliste', breite: 1280 },
  { eintrag: 'Navigation Personen', aus: '${personen.attribut}', ansicht: 'Personen', breite: 1280 },
  { eintrag: 'Navigation Berichte', aus: '${berichte.attribut}', ansicht: BERICHT.ansicht, breite: 1280 },
  { eintrag: 'Navigation Einrichten', aus: '${einrichten.attribut}', ansicht: 'Einrichten', breite: 1280 },
  { eintrag: 'Navigation WBS', aus: '${wbsLink.attribut}', ansicht: 'WBS-Sicht', breite: 1280 },
  { eintrag: 'Seitenmenü Ziel', aus: '${zielEintrag.attribut}', ansicht: 'Aufgabenliste', breite: 560 },
  { eintrag: 'Seitenmenü WBS', aus: '${wbsEintrag.attribut}', ansicht: 'WBS-Sicht', breite: 560 },
  { eintrag: 'Seitenmenü Berichte', aus: '${berichteEintrag.attribut}', ansicht: BERICHT.ansicht, breite: 560 },
];

let laufende = [];
let seitenfehler = [];
// Wird eine Instanz heruntergefahren, meldet die noch offene Seite die tote Verbindung als
// „Failed to load resource: net::ERR_CONNECTION_REFUSED“ — das gehört zum Abbau der Umgebung, nicht zum Test (Befund #13).
let herunterfahren = false;

/** Die Fehlerliste, die afterEach prüft: alles außer den ausdrücklich erlaubten Mustern. */
function gepruefteFehler() {
  return seitenfehler.filter(f => !erlaubteFehler.some(muster => muster.test(f)));
}

test.beforeEach(() => { herunterfahren = false; });

test.afterEach(async () => {
  const fehler = gepruefteFehler(); // vor dem Abbau lesen: sein Lärm gehört nicht dem Test
  seitenfehler = [];
  erlaubteFehler = [];
  for (const aufraeumen of laufende.reverse()) await aufraeumen();
  laufende = [];
  expect(fehler, 'Konsole und Netz der Seite').toEqual([]);
});

/** Das defekte Board antwortet beim Laden mit 423 (Datei defekt, nur lesbar) — die vorgesehene Antwort, kein Befund. */
let erlaubteFehler = [];
const DEFEKTES_BOARD_LADEN = [/^Netz: 423 .*\/api\/boards\/entwicklung\b/, /^Konsole: Failed to load resource: .* 423 \(Locked\)$/];

/** Ein Fehler in Konsole oder Netz ist ein Befund (Leitfaden JavaScript, E2E); gesammelt je Test, geprüft in afterEach.
 *  Ab dem Herunterfahren einer Instanz zählt nichts mehr: die offene Seite meldet dann nur die tote Verbindung (Befund #13). */
const beobachtet = new WeakSet();
function seiteBeobachten(page) {
  if (beobachtet.has(page)) return;
  beobachtet.add(page);
  const melden = text => { if (!herunterfahren) seitenfehler.push(text); };
  page.on('console', m => { if (m.type() === 'error') melden(`Konsole: ${m.text()}`); });
  page.on('pageerror', e => melden(`Ausnahme: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400) melden(`Netz: ${r.status()} ${r.url()}`); });
}

/** Merkt am Herunterfahren an, dass die offene Seite von nun an nur noch die tote Verbindung meldet (Befund #13). */
function mitAbbau(k) {
  const stoppen = k.stoppen.bind(k);
  k.stoppen = async () => { herunterfahren = true; await stoppen(); };
  return k;
}

/** kanbanD mit dem Grundbestand der User Story; `mehr` überschreibt Dateien. */
async function starten(page, mehr = {}) {
  const arbeit = arbeitMitEinerPhase();
  laufende.push(async () => arbeit.aufraeumen());
  const k = mitAbbau(await kanbanStarten(einrichten({ ...grundbestand(arbeit), ...mehr })));
  laufende.push(() => k.stoppen());
  seiteBeobachten(page);
  await alsPerson(page, 'st');
  return k;
}

/** Öffnet jede Route und jeden Zustand und sammelt die Verstöße von `pruefen(page, eintrag)`. */
async function ueberAlleSeiten(page, pruefen) {
  const verstoesse = [];
  const k = await starten(page);
  for (const route of ROUTEN) {
    await page.goto(k.adresse + route.adresse);
    await gezeichnet(page, route.adresse, route.bereit);
    verstoesse.push(...await pruefen(page, route));
  }
  await page.goto(k.adresse + '#/board/entwicklung');
  await page.locator('.bahn').first().waitFor();
  await ausMehr(page, 'Spalten einrichten');
  await page.locator('.setup').waitFor();
  verstoesse.push(...await pruefen(page, EINRICHTUNGSMODUS));

  const defekt = await starten(page, { 'boards/entwicklung.md': '# Entwicklung\n- #1\n## A\n', 'boards/test.md': '# Test\n\n## Bereit\n' });
  await page.goto(defekt.adresse + '#/board/entwicklung');
  erlaubteFehler.push(...DEFEKTES_BOARD_LADEN);
  await page.locator('.defektflaeche').waitFor();
  verstoesse.push(...await pruefen(page, DEFEKTES_BOARD));

  const leer = mitAbbau(await kanbanStarten());
  laufende.push(() => leer.stoppen());
  await page.goto(leer.adresse);
  await page.locator('.first').waitFor();
  verstoesse.push(...await pruefen(page, ERSTER_START));
  return verstoesse;
}

test.describe('R00113 Struktur für Hilfstechnik', () => {
  test.describe.configure({ timeout: 180000 });

  test('US-1: jede Route hat genau eine Seitenüberschrift', async ({ page }) => {
    expect(await ueberAlleSeiten(page, seitenueberschriftPruefen)).toEqual([]);
  });

  test('US-1: Landmarks je Route und Zustand, ohne navigation bei 560 px', async ({ page }) => {
    expect(await ueberAlleSeiten(page, landmarkenPruefen)).toEqual([]);
    await page.setViewportSize({ width: 560, height: 800 });
    const k = await starten(page);
    await page.goto(k.adresse + '#/aufgaben');
    await gezeichnet(page, '#/aufgaben');
    expect(await landmarkenPruefen(page, { ansicht: 'Aufgabenliste bei 560 px', ohneNavigation: true })).toEqual([]);
  });

  test('US-1: die Probe prüft jede Verzweigung von vHaupt()', () => {
    const quelltext = fs.readFileSync(APP_JS, 'utf8');
    expect(sichtenVonVHaupt(quelltext)).toHaveLength(15);
    expect(vollstaendigkeitPruefen(quelltext, [...ROUTEN, ...ZUSTAENDE])).toEqual([]);
  });

  test('US-2: M1 — eine zweite Überschrift erster Ebene in der WBS-Sicht macht die Probe rot', async ({ page }) => {
    await page.route('**/ansicht.js', async route => {
      const antwort = await route.fetch();
      const text = await antwort.text();
      const mutiert = text.replace('<h2 class="wbs-titel">', '<h1 class="wbs-titel">').replace('${nc}</h2>', '${nc}</h1>');
      expect(mutiert, 'Mutante M1 greift nicht').not.toBe(text);
      await route.fulfill({ response: antwort, body: mutiert });
    });
    const k = await starten(page);
    await page.goto(k.adresse + WBS_SICHT.adresse);
    await gezeichnet(page, WBS_SICHT.adresse, WBS_SICHT.bereit);
    expect(await seitenueberschriftPruefen(page, WBS_SICHT)).toEqual(['2 Überschriften erster Ebene in WBS-Sicht']);
  });

  test('US-2: M2 — eine Verzweigung mehr in vHaupt(), als die Probe prüft, macht die Probe rot', () => {
    const quelltext = fs.readFileSync(APP_JS, 'utf8');
    const mutiert = quelltext.replace("  if (S.ui.view === 'wbs') return vWbs();", "  if (S.ui.view === 'wbs') return vWbs();\n  if (S.ui.view === 'neu') return vNeueSicht();");
    expect(mutiert, 'Mutante M2 greift nicht').not.toBe(quelltext);
    expect(vollstaendigkeitPruefen(mutiert, [...ROUTEN, ...ZUSTAENDE])).toEqual(['Route ohne Prüfung: vNeueSicht() in vHaupt()']);
  });

  for (const mutant of RUECKGABE_MUTANTEN) {
    test(`US-2: Mutante „${mutant.name}“ in vHaupt() macht die Probe rot, mit Zeile`, () => {
      const quelltext = fs.readFileSync(APP_JS, 'utf8');
      const mutiert = quelltext.replace(mutant.aus, mutant.ein);
      expect(mutiert, `Mutante „${mutant.name}“ greift nicht`).not.toBe(quelltext);
      const rueckgabe = mutant.ein.split('\n')[0];
      const zeile = mutiert.split('\n').indexOf(rueckgabe) + 1;
      expect(vollstaendigkeitPruefen(mutiert, [...ROUTEN, ...ZUSTAENDE])).toEqual([`Rückgabe ohne Prüfung: web/app.js:${zeile} „${rueckgabe.trim()}“`]);
    });
  }

  for (const vorher of SPALTEN_VORHER) {
    test.describe(`${vorher.breite} px`, () => {
      test.use({ viewport: { width: vorher.breite, height: 800 }, isMobile: vorher.handy, hasTouch: vorher.handy });

      test(`US-3: jede Spalte ist als Überschrift erreichbar, bei ${vorher.breite} px so breit wie vorher`, async ({ page }) => {
        await page.addInitScript(() => localStorage.setItem('kanbanD.spalten-zu.entwicklung', JSON.stringify(['In Arbeit'])));
        const k = await starten(page);
        await page.goto(k.adresse + '#/board/entwicklung');
        await gezeichnet(page, '#/board/entwicklung', '.bahn.zu');
        const spalten = await page.locator('#main section.bahn').evaluateAll(bahnen => bahnen.map(b => {
          const koepfe = [...b.querySelectorAll('h2')];
          const flaeche = koepfe.map(h => h.getBoundingClientRect()).map(r => r.width * r.height);
          return { koepfe: koepfe.map(h => h.textContent.trim()), sichtbar: flaeche.some(f => f > 1), breite: b.getBoundingClientRect().width };
        }));
        expect(await page.locator('#main h2').count()).toBe(3);
        expect(spalten.map(s => s.koepfe)).toEqual([['Zu erledigen'], ['In Arbeit'], ['Erledigt']]);
        expect(spalten.map(s => s.sichtbar)).toEqual([false, false, false]);
        expect(spalten.map(s => s.breite)).toEqual(vorher.bahnen);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), 'Seite scrollt nicht quer').toBe(vorher.breite);
        expect(await spaltenStrukturPruefen(page), 'h2 erstes Kind, zugeklappte Spalte ohne list').toEqual([]);
        await expect(spalte(page, 'In Arbeit').getByRole('list')).toHaveCount(0);
      });
    });
  }

  test.describe('Abschnitte', () => {
    test('US-4: keine Route und kein Zustand springt eine Überschriftenebene', async ({ page }) => {
      expect(await ueberAlleSeiten(page, ebenenPruefen)).toEqual([]);
    });

    test('US-4: Abschnitte der Berichte, von Einrichten und der Aufgabenliste sind zweite Ebene und sehen aus wie vorher', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const k = await starten(page);
      const verstoesse = [];
      for (const seite of GESTALTUNG.filter(g => g.adresse)) {
        await page.goto(k.adresse + seite.adresse);
        await gezeichnet(page, seite.adresse, seite.kopf);
        verstoesse.push(...await gestaltungPruefen(page, seite));
      }
      await page.goto(k.adresse + '#/board/entwicklung');
      await page.locator('.bahn').first().waitFor();
      await ausMehr(page, 'Spalten einrichten');
      await page.locator('.setup').waitFor();
      verstoesse.push(...await gestaltungPruefen(page, GESTALTUNG.find(g => g.ansicht === 'Einrichtungsmodus')));
      expect(verstoesse).toEqual([]);
    });
  });

  test.describe('Karten', () => {
    /** Zugänglicher Name je Listeneintrag einer Spalte, wie ihn die Hilfstechnik ansagt (leer ohne Namen). */
    const namenDerSpalte = (page, name) => spalte(page, name).getByRole('list').getByRole('listitem')
      .evaluateAll(eintraege => eintraege.map(e => e.getAttribute('aria-label') || ''));
    const NAMEN_ZU_ERLEDIGEN = ['#1 eins, Fehler', '#2 zwei, Funktion', '#3 Ölwechsel & <Prüfung>'];

    test('US-5: Karte #1 wird als „#1 eins, Fehler“ angesagt', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const liste = spalte(page, 'Zu erledigen').getByRole('list');
      await expect(liste).toHaveCount(1);
      const eintraege = liste.getByRole('listitem');
      await expect(eintraege).toHaveCount(3);
      const namen = await namenDerSpalte(page, 'Zu erledigen');
      expect(namen).toEqual(NAMEN_ZU_ERLEDIGEN);
      const eins = liste.getByRole('listitem', { name: '#1 eins, Fehler', exact: true });
      await expect(eins.getByRole('button', { name: /Neue E-Mail/ })).toHaveCount(1);
      await expect(eins.getByRole('link').first()).toHaveAccessibleName(/\S/);
      expect(await eins.ariaSnapshot()).toContain('fällig 28.10.2026');
      expect(namen[0]).not.toMatch(/\d{1,2}\.\d{1,2}\.|bug/);
    });

    test('US-5: „leer“ und „Archiv“ sind Einträge der Liste ihrer Spalte', async ({ page }) => {
      const k = await starten(page, ERLEDIGT_MIT_ARCHIV);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn .nach');
      const eintraege = spalte(page, 'Erledigt').getByRole('list').getByRole('listitem');
      expect(await eintraege.evaluateAll(es => es.map(e => [e.className, e.textContent.trim()]))).toEqual([['leer', 'leer'], ['nach', 'Archiv (1)']]);
      expect(await spaltenStrukturPruefen(page)).toEqual([]);
    });

    for (const mutant of SPALTEN_MUTANTEN) {
      test(`AK 4/AK 6/FA 6: Mutante „${mutant.name}“ macht die Spaltenprobe rot`, async ({ page }) => {
        await page.route('**/ansicht.js', async route => {
          const antwort = await route.fetch();
          const text = await antwort.text();
          let mutiert = text;
          for (const [aus, ein] of mutant.ersetzen) {
            const davor = mutiert;
            mutiert = mutiert.replaceAll(aus, ein);
            expect(mutiert, `Mutante „${mutant.name}“ greift nicht bei „${aus}“`).not.toBe(davor);
          }
          await route.fulfill({ response: antwort, body: mutiert });
        });
        await page.addInitScript(() => localStorage.setItem('kanbanD.spalten-zu.entwicklung', JSON.stringify(['In Arbeit'])));
        const k = await starten(page, ERLEDIGT_MIT_ARCHIV);
        await page.goto(k.adresse + '#/board/entwicklung');
        await gezeichnet(page, '#/board/entwicklung', '.bahn.zu');
        expect(await spaltenStrukturPruefen(page)).toEqual(mutant.erwartet);
      });
    }

    test('US-6: die Auswahl wird mit angesagt, ohne aria-selected', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const eins = page.locator('.ka[data-id="1"]');
      await eins.click({ modifiers: ['ControlOrMeta'] });
      await expect(eins).toHaveClass(/gewaehlt/);
      await expect(eins).toHaveAttribute('aria-label', '#1 eins, Fehler, ausgewählt');
      await expect(page.locator('#main [aria-selected]')).toHaveCount(0);
      await eins.click({ modifiers: ['ControlOrMeta'] });
      await expect(eins).not.toHaveClass(/gewaehlt/);
      await expect(eins).toHaveAttribute('aria-label', '#1 eins, Fehler');
    });

    test('US-7: defekte und fehlende Karten haben einen Namen', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const liste = spalte(page, 'In Arbeit').getByRole('list');
      await expect(liste.getByRole('listitem', { name: '#4 Datei defekt, nur lesbar', exact: true })).toHaveCount(1);
      await expect(liste.getByRole('listitem', { name: '#9 Aufgabe fehlt', exact: true })).toHaveCount(1);
    });

    test('US-8: der Name folgt einer Änderung durch einen Agenten, ohne Neuladen', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await page.evaluate(() => { window.ohneNeuladen = true; });
      const antwort = await page.request.patch(k.adresse + 'api/aufgaben/2', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { titel: 'umbenannt' } });
      expect(antwort.ok()).toBe(true);
      await expect.poll(() => page.evaluate(() => window.kdTest.gezeichnet())).toBe(true);
      const zwei = spalte(page, 'Zu erledigen').getByRole('listitem', { name: '#2 umbenannt, Funktion', exact: true });
      await expect(zwei).toHaveCount(1);
      await expect(zwei.locator('.t')).toHaveText('umbenannt');
      expect(await page.evaluate(() => window.ohneNeuladen)).toBe(true);
    });

    test('US-5: M3 — ohne aria-label an .ka macht die Probe rot', async ({ page }) => {
      await page.route('**/ansicht.js', async route => {
        const antwort = await route.fetch();
        const text = await antwort.text();
        const mutiert = text.replace('role="listitem" aria-label="${esc(kartenName(', 'role="listitem" data-m3="${esc(kartenName(');
        expect(mutiert, 'Mutante M3 greift nicht').not.toBe(text);
        await route.fulfill({ response: antwort, body: mutiert });
      });
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const namen = await namenDerSpalte(page, 'Zu erledigen');
      expect(namen).toEqual(['', '', '']);
      expect(namen).not.toEqual(NAMEN_ZU_ERLEDIGEN);
    });
  });

  test.describe('Aktuelle Seite', () => {
    test('US-9: die Navigation nennt die aktuelle Seite', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      const k = await starten(page);
      const verstoesse = [];
      for (const route of ROUTEN) {
        await page.goto(k.adresse + route.adresse);
        await gezeichnet(page, route.adresse, route.bereit);
        verstoesse.push(...await aktuelleSeitePruefen(page, route));
      }
      expect(verstoesse).toEqual([]);
    });

    test('US-9: M4 — ein zweites aria-current an „Aufgaben“ macht die Probe rot', async ({ page }) => {
      await page.route('**/ansicht.js', async route => {
        const antwort = await route.fetch();
        const text = await antwort.text();
        const mutiert = text.replace('<a href="#/aufgaben" class="', '<a href="#/aufgaben" aria-current="page" class="');
        expect(mutiert, 'Mutante M4 greift nicht').not.toBe(text);
        await route.fulfill({ response: antwort, body: mutiert });
      });
      await page.setViewportSize({ width: 1280, height: 800 });
      const k = await starten(page);
      const board = ROUTEN.find(r => r.ansicht === 'Board');
      await page.goto(k.adresse + board.adresse);
      await gezeichnet(page, board.adresse, board.bereit);
      expect(await aktuelleSeitePruefen(page, board)).toEqual(['Board: aria-current an „Board, Aufgaben“ statt „Board“']);
    });

    test('US-10: schmal nennt das Seitenmenü die aktuelle Seite', async ({ page }) => {
      await page.setViewportSize({ width: 560, height: 800 });
      const k = await starten(page);
      const verstoesse = [];
      for (const route of ROUTEN) {
        await page.goto(k.adresse + route.adresse);
        await gezeichnet(page, route.adresse, route.bereit);
        verstoesse.push(...await seitenmenuePruefen(page, route));
      }
      expect(verstoesse).toEqual([]);
    });

    for (const mutant of OHNE_AKTUELL) {
      test(`US-9/US-10: ohne aria-current an „${mutant.eintrag}“ wird die Probe rot`, async ({ page }) => {
        await page.route('**/ansicht.js', async route => {
          const antwort = await route.fetch();
          const text = await antwort.text();
          const mutiert = text.replace(mutant.aus, '');
          expect(mutiert, `Mutante „${mutant.eintrag}“ greift nicht`).not.toBe(text);
          await route.fulfill({ response: antwort, body: mutiert });
        });
        await page.setViewportSize({ width: mutant.breite, height: 800 });
        const k = await starten(page);
        const ziel = ROUTEN.find(r => r.ansicht === mutant.ansicht);
        await page.goto(k.adresse + ziel.adresse);
        await gezeichnet(page, ziel.adresse, ziel.bereit);
        let verstoesse;
        if (mutant.breite < 600) verstoesse = await seitenmenuePruefen(page, ziel);
        else verstoesse = await aktuelleSeitePruefen(page, ziel);
        expect(verstoesse).toHaveLength(1);
        expect(verstoesse[0]).toContain(`${ziel.ansicht}: aria-current`);
      });
    }
  });

  test.describe('Klappzustand', () => {
    test('US-11: der Klappknopf der Spalte sagt, ob sie offen ist', async ({ page }) => {
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      const zuklappen = page.getByRole('button', { name: 'Zu erledigen zuklappen', expanded: true });
      await expect(zuklappen).toHaveCount(1);
      await zuklappen.click();
      const aufklappen = page.getByRole('button', { name: 'Zu erledigen aufklappen', expanded: false });
      await expect(aufklappen).toHaveCount(1);
      await page.reload();
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await expect(aufklappen).toHaveCount(1);
      await aufklappen.click();
      await expect(zuklappen).toHaveCount(1);
    });
  });

  test.describe('Befund #13: der Seitenfehler-Guard zählt das eigene Herunterfahren nicht', () => {
    /** Wartet, bis die offene Seite die tote Instanz gemeldet hat — erst dann wäre eine gezählte Meldung überhaupt möglich. */
    const bisSeiteTotMeldet = roh => expect.poll(() => roh.some(t => /ERR_CONNECTION_REFUSED/.test(t)), { timeout: 15000 }).toBe(true);

    test('eine gestoppte Instanz mit offener Seite meldet keinen Fehler', async ({ page }) => {
      const roh = [];
      page.on('console', m => { if (m.type() === 'error') roh.push(m.text()); });
      const k = await starten(page);
      await page.goto(k.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await k.stoppen();
      await bisSeiteTotMeldet(roh);
      expect(gepruefteFehler()).toEqual([]);
    });

    test('drei Instanzen in einem Test abgebaut — ihre Meldungen bleiben aus der geprüften Liste', async ({ page }) => {
      const roh = [];
      page.on('console', m => { if (m.type() === 'error') roh.push(m.text()); });
      const haupt = await starten(page);
      const defekt = await starten(page);
      const leer = await starten(page);
      await page.goto(haupt.adresse + '#/board/entwicklung');
      await gezeichnet(page, '#/board/entwicklung', '.bahn');
      await haupt.stoppen();
      await defekt.stoppen();
      await leer.stoppen();
      await bisSeiteTotMeldet(roh);
      expect(gepruefteFehler()).toEqual([]);
    });
  });
});
