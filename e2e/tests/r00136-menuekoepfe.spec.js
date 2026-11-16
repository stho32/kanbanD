// R00136 Menüköpfe in role=menu ohne Überschrift (ADR-0018 Regel 2, WAI-ARIA 1.2): kein [role=menu] führt ein h1–h6,
// die vier Köpfe (SEITE, MEHR, „#n AUF BOARD LEGEN", STATUS <Knoten>) sind klassen-gestaltete Nicht-Überschrift-Elemente.
// Die berechneten Werte der vier Köpfe wurden vor dem Bau an main gemessen (2026-11-12, 1280 × 800, helles Thema).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit, breiteSetzen } = require('./hilfen');
const { zeile, wbsText, arbeitsRepository, mitRegister } = require('./wbs-hilfen');

// Berechnete Werte der vier Menüköpfe vor dem Bau (Muster R00113 NFA 1): Schrift, Laufweite, Farbe, Höhe, Innenabstand,
// Grund und untere Linie. Sie müssen nach dem Tag-Wechsel gleich bleiben (NFA 1, US-3).
const KOPF_WERTE = {
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.55px',
  color: 'oklch(0.48 0.018 255)',
  height: 28,
  padding: '0px 12px 0px 12px',
  background: 'oklch(0.94 0.007 250)',
  borderBottom: '1px solid oklch(0.87 0.01 250)',
};

const WBS = wbsText([
  zeile('A0001', 'Application', '—', 'kanbanD', 'gelb'),
  zeile('D0001', 'Dialog', 'A0001', 'Board', 'gelb'),
  zeile('I0001', 'Interaction', 'D0001', 'Ansehen', 'gelb', { fertig: 'US-1' }),
  zeile('B0001', 'Bubble', 'I0001', 'Board lesen', 'gruen', { ea: 'Datei → Board', aufwand: '0,5-1' }),
  zeile('B0002', 'Bubble', 'I0001', 'Board zeigen', 'rot', { ea: 'Board → HTML', aufwand: '1-2' }),
]);

const DATEIEN = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-eins.md': '---\nid: 1\ntitle: eins\n---\n',
  'aufgaben/0004-vier.md': '---\nid: 4\ntitle: vier ohne Board\n---\n',
};

/** Jedes Menü der Anwendung: zugänglicher Name (US-2), Öffner, Menü und — bei den vier Köpfen — der Kopftext. */
const MENUES = [
  { name: 'Seite', kopf: 'SEITE', breite: 560, adresse: '#/board/entwicklung', bereit: '.bahn', ort: '#t-seite', menue: '#pop[aria-label="Seite"]' },
  { name: 'Mehr', kopf: 'MEHR', breite: 1280, adresse: '#/board/entwicklung', bereit: '.bahn', ort: '#t-mehr', menue: '#pop[aria-label="Mehr"]' },
  { name: 'Berichte', breite: 1280, adresse: '#/board/entwicklung', bereit: '.bahn', ort: '#t-ber', menue: '#pop[aria-label="Berichte"]' },
  { name: '#1 eins', breite: 1280, adresse: '#/board/entwicklung', bereit: '.bahn', ort: '.ka[data-id="1"]', menue: '#kmenue[role="menu"]', rechtsklick: true },
  { name: '#4 auf Board legen', kopf: '#4 AUF BOARD LEGEN', breite: 1280, adresse: '#/aufgaben', bereit: '.ziele', ort: '#leg-4', menue: '#pop[aria-label="#4 auf Board legen"]' },
  { name: 'Status von B0002', kopf: 'STATUS B0002', mono: 'B0002', breite: 1280, adresse: '#/wbs/kd', bereit: '.wbs-titel', ort: '#wbs-st-B0002', menue: '#pop[aria-label="Status von B0002"]' },
];

/** Öffnet das Menü aus MENUES; wartet, bis die Sicht und das Menü gezeichnet sind. */
async function menueOeffnen(page, k, m) {
  await breiteSetzen(page, m.breite, 800);
  await page.goto(k.adresse + m.adresse);
  await liveBereit(page);
  await page.locator('#main ' + m.bereit).first().waitFor();
  const ort = page.locator(m.ort);
  if (m.rechtsklick) await ort.click({ button: 'right' }); else await ort.click();
  const menue = page.locator(m.menue);
  await menue.waitFor();
  return menue;
}

/** Überschriften in einem role=menu der offenen Seite — die Probe aus AK 1, wörtlich. */
async function ueberschriftenInMenues(page) {
  return page.evaluate(() => [...document.querySelectorAll('[role="menu"] :is(h1,h2,h3,h4,h5,h6,[role=heading])')]
    .map(h => ({ menue: h.closest('[role="menu"]').getAttribute('aria-label'), tag: h.tagName })));
}

/** Öffnet jedes Menü, führt `besuch` aus und gibt die gesammelten Ergebnisse zurück; schließt danach mit Escape. */
async function jeMenue(page, k, besuch) {
  const ergebnisse = [];
  for (const m of MENUES) {
    await menueOeffnen(page, k, m);
    ergebnisse.push(await besuch(m));
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  }
  return ergebnisse;
}

let laufende = [];
async function starten(page) {
  const arbeit = arbeitsRepository(WBS);
  laufende.push(() => arbeit.aufraeumen());
  const k = await kanbanStarten(mitRegister(arbeit, DATEIEN));
  laufende.push(() => k.stoppen());
  await alsPerson(page, 'st');
  return k;
}

test.afterEach(async () => {
  for (const aufraeumen of laufende.reverse()) await aufraeumen();
  laufende = [];
});

test.describe('R00136 Menüköpfe in role=menu ohne Überschrift', () => {
  test.describe.configure({ timeout: 120000 });

  test('US-1: kein Menü führt eine Überschrift', async ({ page }) => {
    const k = await starten(page);
    const treffer = [];
    await jeMenue(page, k, async m => { treffer.push(...await ueberschriftenInMenues(page)); });
    expect(treffer, 'Überschriften in role=menu').toEqual([]);
  });

  test('US-2: Name und Kopftext bleiben', async ({ page }) => {
    const k = await starten(page);
    const verstoesse = [];
    await jeMenue(page, k, async m => {
      const menue = page.locator(m.menue);
      const anzahl = await page.getByRole('menu', { name: m.name, exact: true }).count();
      if (anzahl !== 1) verstoesse.push(`${m.name}: ${anzahl} × role=menu mit diesem Namen`);
      if (m.kopf) {
        const koepfe = await menue.locator('.pop-kopf').all();
        const text = koepfe.length ? await koepfe[0].textContent() : '';
        if (text.replace(/\s+/g, ' ').trim() !== m.kopf) verstoesse.push(`${m.name}: Kopftext „${text.trim()}“ statt „${m.kopf}“`);
      }
      if (m.mono) {
        const mono = await menue.locator('.pop-kopf .mono').count();
        if (mono !== 1) verstoesse.push(`${m.name}: span.mono im Kopf fehlt`);
      }
    });
    expect(verstoesse).toEqual([]);
  });

  test('US-3: die vier Köpfe sehen aus wie vorher', async ({ page }) => {
    const k = await starten(page);
    const verstoesse = [];
    await jeMenue(page, k, async m => {
      if (!m.kopf) return;
      const ist = await page.evaluate(sel => {
        const e = document.querySelector(sel);
        if (!e) return null;
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return {
          fontSize: s.fontSize, fontWeight: s.fontWeight, letterSpacing: s.letterSpacing, color: s.color,
          height: Math.round(r.height * 100) / 100,
          padding: [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].join(' '),
          background: s.backgroundColor, borderBottom: `${s.borderBottomWidth} ${s.borderBottomStyle} ${s.borderBottomColor}`,
        };
      }, m.menue + ' .pop-kopf');
      if (!ist) { verstoesse.push(`${m.name}: kein .pop-kopf im Menü`); return; }
      for (const [name, wert] of Object.entries(KOPF_WERTE)) {
        if (ist[name] !== wert) verstoesse.push(`${m.name}: ${name} ${ist[name]} statt ${wert}`);
      }
    });
    expect(verstoesse).toEqual([]);
  });

  test('AK 4: „h4 zurück ins Menü“ macht die Probe rot und nennt das Menü', async ({ page }) => {
    let mutanteGriff = false;
    await page.route('**/ansicht.js', async route => {
      const antwort = await route.fetch();
      const text = await antwort.text();
      const mutiert = text.replace('<div class="pop-kopf">SEITE</div>', '<h4>SEITE</h4>');
      mutanteGriff = mutiert !== text;
      await route.fulfill({ response: antwort, body: mutiert });
    });
    const k = await starten(page);
    const menue = await menueOeffnen(page, k, MENUES[0]);
    await expect(menue).toBeVisible();
    expect(mutanteGriff, 'Mutante „h4 zurück ins Menü“ greift').toBe(true);
    expect(await ueberschriftenInMenues(page)).toEqual([{ menue: 'Seite', tag: 'H4' }]);
  });
});
