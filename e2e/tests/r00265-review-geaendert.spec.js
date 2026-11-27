// R00265 Review-Seite — Hinweis „Seit dem Haken verändert“ (Karte #268, I0255, ADR-0042 N8): AK 2–7 im echten Programm gegen echtes
// Git; hier AK 5 (Breite, Themen, Kontrast, Ansage). Ausgangslage: review-hilfen.js (`gesehenRepository`/`gesehenVorbereiten`;
// Aufgabe #3 = kd:k3 + wb:w3, der Commit K3b ändert `src/a.rs` um eine Zeile). Schichten: Testfälle → Testsprache (`seite`) →
// Treiber (Selektoren, Adressen, Speicher nur hier) → Programm.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen } = require('./hilfen');
const { gesehenRepository, gesehenVorbereiten } = require('./review-hilfen');

const HINWEIS = 'Seit dem Haken verändert';
const SATZ_SPEICHER = 'Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.';
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const ANZ = 5;

/* ── Treiber: Adressen und Selektoren (nur hier) ── */

const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;

function seite(page) {
  const name = pfad => pfad.slice(pfad.lastIndexOf('/') + 1);
  const zeile = (pfad, a = null) => page
    .locator(a === null ? '#review .dn-e' : `#rv-a${a} .dn-e`)
    .filter({ has: page.locator('.p b', { hasText: exakt(name(pfad)) }) });
  const datei = (pfad, a = null) => page
    .locator(a === null ? '#rv-insel section.df' : `#rv-a${a} section.df`)
    .filter({ has: page.locator('.df-k .p', { hasText: exakt(pfad) }) });
  const kaestchen = (pfad, a = null) => datei(pfad, a).locator('input.ru-ges-k');
  return {
    zeile, datei, kaestchen,
    offen: async (pfad, a = null) => (await datei(pfad, a).locator('.df-k').first().getAttribute('aria-expanded')) === 'true',
    gruppenkopf: (art, a = null) => page.locator(a === null ? `#rv-gk-${art}` : `#rv-gk${a}-${art}`),
    zeileHinweis: (pfad, a = null) => zeile(pfad, a).locator('.ru-hg'),
    kopfHinweis: (pfad, a = null) => datei(pfad, a).locator('.ru-hg'),
    zeileText: () => page.locator('#rv-ges-z'),
    ganzeZeile: () => page.locator('#rv-ges-t'),
    live: () => page.locator('#rv-gesehen'),
    speicherSatz: () => page.locator('#rv-gesehen-speicher'),
    kaestchenAlle: () => page.locator('#rv-insel input.ru-ges-k'),
    speicher: () => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(s => s.startsWith('kanbanD.gesehen.')).map(s => [s, localStorage.getItem(s)]))),
  };
}

async function alleOeffnen(page, k, nr) {
  await page.goto(alleAdresse(k, nr));
  await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
}

async function neuLaden(page) {
  await page.reload();
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

/** Hängt Commits über die API an eine Aufgabe (wie ein Agent, der einen Commit hinterlegt). */
async function commitsAnhaengen(page, k, nr, hashes) {
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/${nr}/commits`, { headers: { 'X-KanbanD-Wer': 'cl' }, data: { commits: hashes.map(x => `kd:${x}`) } });
  expect(antwort.ok()).toBe(true);
}

/** Speicher gesperrt: schon der Zugriff auf `localStorage` wirft (privates Fenster, gesperrte Website-Daten). */
function speicherGesperrt() {
  Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('gesperrt', 'SecurityError'); } });
}

/** Öffnet die Dateiliste hinter „Dateien (n) und Commit“, wo das Fenster sie verbirgt (unter 1100 px). */
async function listeOeffnen(page) {
  const knopf = page.locator('#rv-auf');
  if (await knopf.isVisible() && (await knopf.getAttribute('aria-expanded')) !== 'true') await knopf.click();
}

test.describe('R00265 Hinweis „Seit dem Haken verändert“', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k, h, fehler;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    fehler = [];
    page.on('pageerror', f => fehler.push(String(f)));
    page.on('console', m => { if (m.type() === 'error') fehler.push(m.text()); });
    h = gesehenRepository();
    k = await kanbanStarten(gesehenVorbereiten(h));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /** Der Zustand der Probe: Aufgabe #3 in „Alle Änderungen“, src/a.rs abgehakt, K3b geändert, neu geladen. */
  async function geaendertVorbereiten(page) {
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await s.kaestchen('src/a.rs').click();
    await expect(s.zeileText()).toHaveText(`1 von ${ANZ} gesehen`);
    await commitsAnhaengen(page, k, 3, [h.k3b]);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`0 von ${ANZ} gesehen`);
    return s;
  }

  /* ── AK 5 Breite, Themen, Kontrast, Ansage ── */

  for (const themaName of ['light', 'dark']) {
    test(`AK 5 (${themaName}): 320/414/980/1280 px — kein Querscrollen, beide Hinweise ganz in der Breite, Text ≥ 4,5:1`, async ({ page }) => {
      const s = await geaendertVorbereiten(page);
      await thema(page, themaName);
      await expect(s.zeileHinweis('src/a.rs')).toHaveText(HINWEIS);
      await expect(s.kopfHinweis('src/a.rs')).toHaveText(HINWEIS);
      await expect(s.kopfHinweis('src/a.rs')).toHaveAttribute('title', HINWEIS);
      for (const breite of [320, 414, 980, 1280]) {
        await breiteSetzen(page, breite);
        await listeOeffnen(page);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${breite}`).toBe(true);
        for (const [wer, ort] of [['Liste', s.zeileHinweis('src/a.rs')], ['Kopf', s.kopfHinweis('src/a.rs')]]) {
          const lage = await ort.evaluate(e => { const b = e.getBoundingClientRect(); return { links: b.left, rechts: b.right, breite: innerWidth }; });
          expect(lage.links, `${themaName} ${breite} ${wer}`).toBeGreaterThanOrEqual(0);
          expect(lage.rechts, `${themaName} ${breite} ${wer}`).toBeLessThanOrEqual(lage.breite);
        }
      }
      await breiteSetzen(page, 1280);
      const messungen = await kontrastMessen(page, ['.ru-hg']);
      expect(messungen.length).toBeGreaterThan(0);
      for (const m of messungen) expect(m.wert, `${themaName} ${m.element}`).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('AK 5: der Hinweis trägt das Gewand der .mk-Marke (Schrift --kd-muted, Fläche --kd-surface, Rand --kd-line-strong), kein Bedienelement', async ({ page }) => {
    const s = await geaendertVorbereiten(page);
    for (const themaName of ['light', 'dark']) {
      await thema(page, themaName);
      const farben = await page.evaluate(() => {
        const wert = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const probe = (name, eigenschaft) => { const p = document.createElement('span'); p.style[eigenschaft] = wert(name); document.body.append(p); const f = getComputedStyle(p)[eigenschaft]; p.remove(); return f; };
        const st = getComputedStyle(document.querySelector('.ru-hg'));
        return {
          farbe: st.color, grund: st.backgroundColor, rand: st.borderTopColor,
          token: { farbe: probe('--kd-muted', 'color'), grund: probe('--kd-surface', 'backgroundColor'), rand: probe('--kd-line-strong', 'borderTopColor') },
        };
      });
      expect(farben.farbe, themaName).toBe(farben.token.farbe);
      expect(farben.grund, themaName).toBe(farben.token.grund);
      expect(farben.rand, themaName).toBe(farben.token.rand);
    }
    for (const ort of [s.zeileHinweis('src/a.rs'), s.kopfHinweis('src/a.rs')]) {
      expect(await ort.evaluate(e => [e.localName, e.getAttribute('role'), e.getAttribute('tabindex')])).toEqual(['span', null, null]);
    }
  });

  test('AK 5: der Hinweis am Kopf ist per aria-describedby mit „Gesehen“ verbunden; der Hinweis löst keine Ansage aus', async ({ page }) => {
    const s = await geaendertVorbereiten(page);
    const kennung = await s.kaestchen('src/a.rs').getAttribute('aria-describedby');
    expect(kennung).toMatch(/^rv-hg/);
    await expect(page.locator(`#${kennung}`)).toHaveText(HINWEIS);
    await expect(s.kopfHinweis('src/a.rs')).toHaveAttribute('id', kennung);
    await expect(s.live()).toHaveText(`0 von ${ANZ} gesehen`);
    for (const ort of [s.zeileHinweis('src/a.rs'), s.kopfHinweis('src/a.rs')]) {
      expect(await ort.evaluate(e => Boolean(e.closest('[aria-live],[role="status"],[role="alert"]')))).toBe(false);
    }
    expect(fehler).toEqual([]);
  });

  /* ── AK 2 Grundfall, Zähler bleibt wahr (US-1) ── */

  test('AK 2/US-1: ohne Änderung nie ein Hinweis; nach K3b „0 von 5“, Hinweis an Liste und Kopf, erneuter Haken „1 von 5“ und weg', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await expect(s.zeileText()).toHaveText(`0 von ${ANZ} gesehen`);
    await expect(page.locator('.ru-hg')).toHaveCount(0);
    await s.kaestchen('src/a.rs').click();
    await expect(s.zeileText()).toHaveText(`1 von ${ANZ} gesehen`);
    await expect(page.locator('.ru-hg')).toHaveCount(0, 'der aktuelle Fingerabdruck ist gespeichert: kein Hinweis');
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`1 von ${ANZ} gesehen`);
    await expect(page.locator('.ru-hg')).toHaveCount(0);

    await commitsAnhaengen(page, k, 3, [h.k3b]);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`0 von ${ANZ} gesehen`, 'die geänderte Datei zählt nicht mit');
    await expect(s.kaestchen('src/a.rs')).not.toBeChecked();
    expect(await s.offen('src/a.rs'), 'nicht eingeklappt').toBe(true);
    await expect(s.zeileHinweis('src/a.rs'), 'Hinweis in der Dateiliste').toHaveText(HINWEIS);
    await expect(s.kopfHinweis('src/a.rs'), 'Hinweis am Dateikopf').toHaveText(HINWEIS);
    await expect(s.kopfHinweis('src/a.rs')).toHaveAttribute('title', HINWEIS);
    await expect(s.live()).toHaveText(`0 von ${ANZ} gesehen`);

    await s.kaestchen('src/a.rs').click();
    await expect(s.zeileText()).toHaveText(`1 von ${ANZ} gesehen`);
    await expect(page.locator('.ru-hg')).toHaveCount(0, 'erneuter Haken nimmt den Hinweis weg');
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`1 von ${ANZ} gesehen`);
    await expect(page.locator('.ru-hg')).toHaveCount(0);
    expect(fehler).toEqual([]);
  });

  /* ── AK 3 Jede geänderte Datei, Nachbarn und Neuladen (Abtastung) ── */

  test('AK 3/US-2: alle fünf gesehen, K3c ändert drei — jede der drei trägt den Hinweis, die zwei übrigen nicht, „2 von 5“', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await s.gruppenkopf('doku', 0).click();
    await s.gruppenkopf('doku', 1).click();
    for (const [pfad, a] of [['src/a.rs', 0], ['tests/a_test.rs', 0], ['README.md', 0], ['b.js', 1], ['docs/b.md', 1]]) {
      await s.kaestchen(pfad, a).click();
    }
    await expect(s.zeileText()).toHaveText(`5 von ${ANZ} gesehen`);

    await commitsAnhaengen(page, k, 3, [h.k3c]);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`2 von ${ANZ} gesehen`);
    for (const [pfad, a] of [['src/a.rs', 0], ['tests/a_test.rs', 0], ['README.md', 0]]) {
      await expect(s.zeileHinweis(pfad, a), `geändert: ${pfad}`).toHaveText(HINWEIS);
    }
    for (const [pfad, a] of [['b.js', 1], ['docs/b.md', 1]]) {
      await expect(s.zeileHinweis(pfad, a), `unverändert: ${pfad}`).toHaveCount(0);
    }

    // Nachbarübergänge: Neuladen, Klappen, Ansichtswechsel „Ein Commit“ und zurück
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`2 von ${ANZ} gesehen`);
    await expect(s.zeileHinweis('src/a.rs', 0)).toHaveText(HINWEIS);
    await page.locator('#rv-alle').click();
    await page.locator('#rv-alle').click();
    await expect(s.zeileHinweis('src/a.rs', 0)).toHaveText(HINWEIS, 'Klappen nimmt den Hinweis nicht weg');

    await page.locator('#rv-l1').click();
    await page.locator('#rv-insel').waitFor();
    await expect(page.locator('.ru-hg'), 'in „Ein Commit“ nie').toHaveCount(0);
    await page.locator('#rv-u-alle').click();
    await page.locator('#rv-insel .rv-abs .rv-gk').first().waitFor();
    await expect(s.zeileText()).toHaveText(`2 von ${ANZ} gesehen`);
    await expect(s.zeileHinweis('src/a.rs', 0)).toHaveText(HINWEIS);
    expect(fehler).toEqual([]);
  });

  test('AK 3: die gleichnamige Datei einer anderen Anwendung bleibt ohne Haken und ohne Hinweis; Nachladen eines Abschnitts lässt sie unberührt', async ({ page }) => {
    const s = seite(page);
    const wb = url => url.pathname === '/api/aufgaben/7/diff' && url.searchParams.get('anwendung') === 'wb' && !url.searchParams.has('datei');
    await page.route(wb, route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Zeitgrenze' }) }));
    await alleOeffnen(page, k, 7);
    await expect(page.locator('#rv-a1 .rv-abs-f')).toBeVisible();
    await expect(s.zeileText()).toHaveText('0 von 5 gesehen');
    await s.kaestchen('src/a.rs', 0).click();
    await expect(s.ganzeZeile()).toHaveText('1 von 5 gesehen · 1 Abschnitt nicht geladen');

    await page.unroute(wb);
    await page.locator('#rv-a1').getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect(s.ganzeZeile()).toHaveText(`1 von ${8} gesehen`);
    await expect(s.kaestchen('src/a.rs', 0)).toBeChecked();
    await expect(s.kaestchen('src/a.rs', 1), 'gleichnamige Datei der anderen Anwendung').not.toBeChecked();
    await expect(s.zeileHinweis('src/a.rs', 0)).toHaveCount(0);
    await expect(s.zeileHinweis('src/a.rs', 1)).toHaveCount(0);
    expect(fehler.filter(f => !f.includes('503'))).toEqual([]);
  });

  /* ── AK 4 Kein Hinweis ohne Grund (Fehlerpfad, US-3) ── */

  test('AK 4/FA 6: werfender Speicher — keine Datei gilt als geändert, kein Hinweis, kein Fehler in der Konsole', async ({ page }) => {
    await page.addInitScript(speicherGesperrt);
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await s.kaestchen('src/a.rs').click();
    await expect(s.live()).toHaveText(`1 von ${ANZ} gesehen`);
    await expect(s.datei('src/a.rs').locator('.df-inhalt')).toBeHidden();
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);

    await commitsAnhaengen(page, k, 3, [h.k3b]);
    await neuLaden(page);
    await expect(s.zeileText()).toHaveText(`0 von ${ANZ} gesehen`);
    await expect(page.locator('.ru-hg')).toHaveCount(0, 'ohne lesbaren Speicher kein Hinweis');
    await expect(s.speicherSatz()).toHaveText(SATZ_SPEICHER);
    expect(fehler).toEqual([]);
  });

  /* ── AK 6 Zugänglicher Name am Zeilen-Knopf (Muss der UX-Vorprüfung, Probe wörtlich) ── */

  test('AK 6: der zugängliche Name des Zeilen-Knopfs enthält „Seit dem Haken verändert“, der unveränderter Dateien nicht', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 3);
    await expect(s.zeile('src/a.rs')).not.toHaveAccessibleName(/Seit dem Haken verändert/);
    await s.kaestchen('src/a.rs').click();
    await commitsAnhaengen(page, k, 3, [h.k3b]);
    await neuLaden(page);
    await expect(s.zeile('src/a.rs')).toHaveAccessibleName(/Seit dem Haken verändert/);
    for (const [pfad, a] of [['tests/a_test.rs', 0], ['b.js', 1]]) {
      await expect(s.zeile(pfad, a), `offen: ${pfad}`).not.toHaveAccessibleName(/Seit dem Haken verändert/);
    }
    expect(fehler).toEqual([]);
  });

  /* ── AK 3/AK 7 „Änderungen anzeigen“ an einer großen Datei setzt keinen Hinweis ── */

  test('AK 3/AK 7: „Änderungen anzeigen“ an einer großen Datei lässt den Haken und setzt keinen Hinweis', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 2);
    await s.kaestchen('src/grosse-antwort.json').click();
    await s.datei('src/grosse-antwort.json').getByRole('button', { name: 'Änderungen anzeigen' }).click();
    await expect(s.kaestchen('src/grosse-antwort.json')).toBeChecked();
    await expect(s.zeileHinweis('src/grosse-antwort.json')).toHaveCount(0);
    await expect(s.zeileText()).toHaveText(/^1 von \d+ gesehen$/);
    expect(fehler).toEqual([]);
  });
});
