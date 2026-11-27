// R00264 „Ein Commit“: die Seitenmeldung (`role=status`) wird je Ereignis genau einmal angesagt (Karte #254, I0254, ADR-0018 N4 §1–§5) — AK 1–4.
// Im echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (Aufgabe #1 in `kd`); GET …/commits wird gehalten und über ein Promise
// freigegeben, GET …/diff antwortet fest. Gezählt wird mit `ansagenZaehlen` (hilfen.js) ab der ersten Zeichnung; kein Zeitmaß (ADR-0026 N5 Regel 12).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, ansagenZaehlen } = require('./hilfen');
const { istLadesatz } = require('./gesamt-hilfen');
const { reviewRepository, reviewVorbereiten } = require('./review-hilfen');

const GRUND = 'Ordner fehlt: /nirgends/KD';
const reviewAdresse = (k, nr, commit = null) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review${commit == null ? '' : `?commit=${encodeURIComponent(commit)}`}`;
const istListe = (url, nr) => url.pathname === `/api/aufgaben/${nr}/commits`;
const istDiff = (url, nr) => url.pathname === `/api/aufgaben/${nr}/diff`;
const MELDUNG = /^#review div\.rv-meld/;

/* Die Diff-Fehlerarten (R00264 „Ausgangslage“ und AK 2): je fehlerhafte Antwort und der sichtbare Kernsatz der Seitenmeldung. */
const FAELLE = {
  '404 repository_fehlt': { wert: { status: 404, body: { fehler: 'Repository nicht erreichbar', zustand: 'repository_fehlt', grund: GRUND } }, satz: 'Das Repository der Anwendung kd ist nicht erreichbar.' },
  '500': { wert: { status: 500, body: { fehler: 'kaputt' } }, satz: 'Der Diff ließ sich nicht lesen: kaputt (500).' },
  '503 Zeitgrenze': { wert: { status: 503, body: { fehler: 'Git antwortete nicht' } }, satz: 'Zeitgrenze überschritten.' },
  '503 Antwortbudget': { wert: { status: 503, body: { fehler: 'Antwortbudget von 64 MB belegt' } }, satz: 'Server ausgelastet (Antwortbudget).' },
};

/** Hält passende Antworten an, bis `frei(i, wert)` die i-te freigibt; ohne `wert` läuft die echte Antwort durch. */
async function halten(page, muster) {
  const tore = [];
  await page.route(muster, async route => {
    let frei;
    const tor = new Promise(r => { frei = r; });
    tore.push(frei);
    const wert = await tor;
    const still = p => p.catch(() => {});
    if (wert && wert.status) return still(route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify(wert.body || {}) }));
    return still(route.continue());
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

/** Feste Antwort `status` mit `body` für passende Anfragen. */
const fest = (page, muster, status, body) => page.route(muster, route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }));

/** Nimmt die festen Antworten weg; eine eingesetzte Mutante (KD_MUTANTE) bleibt. */
async function routenZuruecksetzen(page) {
  await page.unrouteAll();
  await mutanteEinsetzen(page);
}

/** Zählt im Browser, wie oft ein `.rv-meld`-Knoten (neu) eingehängt wird — die sichtbare Zeichnung der Seitenmeldung; setzt beim Neuladen neu an. */
async function meldungenZaehlen(page) {
  await page.addInitScript(() => {
    window.KD_MELDUNGEN = 0;
    new MutationObserver(ms => {
      for (const m of ms) for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n.matches('.rv-meld') || n.querySelector('.rv-meld'))) { window.KD_MELDUNGEN++; break; }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}
const meldungen = page => page.evaluate(() => window.KD_MELDUNGEN);

/** Ergebnis- bzw. Fehleransagen und Ladesätze getrennt (R00230 „Zählfenster“). */
const einordnen = eintraege => ({ ergebnisse: eintraege.filter(e => !istLadesatz(e)), ladesaetze: eintraege.filter(istLadesatz) });

/** Nur die Ansagen der Seitenmeldung, in Reihenfolge und ohne Wiederholung. */
const meldansagen = ergebnisse => ergebnisse.filter(e => MELDUNG.test(e.ort)).map(e => e.text);

/** Den Live-Knoten merken und prüfen, dass die nächste Zeichnung denselben Knoten zeigt. */
const knotenMerken = page => page.evaluate(() => { window.kdRegion = document.querySelector('#review .rv-meld'); return Boolean(window.kdRegion); });
const knotenGleich = page => page.evaluate(() => document.querySelector('#review .rv-meld') === window.kdRegion);

test.describe('R00264 „Ein Commit“ genau eine Ansage', () => {
  let k, rep;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    rep = reviewRepository().rep;
    k = await kanbanStarten(reviewVorbereiten(rep));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1: der Bug — 404 repository_fehlt, die zweite Zeichnung hängt die Meldung nicht neu ein ── */

  test('AK 1: 404 repository_fehlt über die zweite Zeichnung — derselbe Knoten, keine zweite Ansage', async ({ page }) => {
    await meldungenZaehlen(page);
    const zaehler = await ansagenZaehlen(page);
    const liste = await halten(page, url => istListe(url, 1));
    const f = FAELLE['404 repository_fehlt'];
    await fest(page, url => istDiff(url, 1), f.wert.status, f.wert.body);
    await page.goto(reviewAdresse(k, 1, `kd:${rep.k3}`));
    await expect.poll(() => liste.angehalten()).toBe(1);
    await expect(page.locator('#review .rv-meld')).toContainText(f.satz);
    await expect(page.locator('#rv-meld')).toBeFocused();
    expect(await knotenMerken(page)).toBe(true);
    const vorher = await meldungen(page);
    await zaehler.beginnen();
    liste.frei(0); // die echte Commit-Liste geht durch: die zweite Zeichnung folgt
    await expect.poll(() => meldungen(page)).toBeGreaterThan(vorher);
    await expect(page.locator('#rv-l1')).toBeVisible();
    const { ergebnisse, ladesaetze } = einordnen(await zaehler.eintraege());
    expect(meldansagen(ergebnisse), 'keine zweite Ansage der Seitenmeldung').toEqual([]);
    expect(ladesaetze.length, 'höchstens ein Ladesatz').toBeLessThanOrEqual(1);
    expect(await knotenGleich(page), 'derselbe Meldungsknoten über die zweite Zeichnung').toBe(true);
  });
});
