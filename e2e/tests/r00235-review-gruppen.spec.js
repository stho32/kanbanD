// R00235 Review-Seite — Dateien nach Art gruppiert, Code zuerst (Karte #252, I0225, Scheibe S1 von ADR-0042): AK 1–9 und US-1..US-7
// im echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`uebersichtRepository`: K-Art, K-Rand, K-Budget, K-Doku in kd,
// Aufgabe #3 in kd und wb). Lage nur mit getBoundingClientRect, Warten nur auf sichtbare Signale.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen, kontrastFarben } = require('./hilfen');
const { breiteMessen } = require('./ziele-hilfen');
const { uebersichtRepository, uebersichtVorbereiten } = require('./review-hilfen');

/* ── Treiber: Adressen und Teile der Seite; nur hier stehen Selektoren ── */
const adresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review${commit ? `?commit=${encodeURIComponent(`kd:${commit}`)}` : ''}`;
const L = 44;
const leer = s => s.replace(/\s+/g, ' ').trim();

function seite(page) {
  const gruppenkopf = (art, a = null) => page.locator(a === null ? `#rv-gk-${art}` : `#rv-gk${a}-${art}`);
  const datei = (pfad, wurzel = '#rv-insel') => page.locator(`${wurzel} section.df`).filter({ has: page.locator('.df-k .p', { hasText: new RegExp(`^${pfad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
  const zeile = (pfad, wurzel = '#review') => page.locator(`${wurzel} .dn-e`).filter({ has: page.locator('.p', { hasText: new RegExp(`^${pfad.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) });
  return {
    gruppenkoepfe: async (wurzel = '#rv-insel') => (await page.locator(`${wurzel} .rv-gk`).allTextContents()).map(leer),
    listenkoepfe: async (wurzel = '#review') => (await page.locator(`${wurzel} .rv-gl`).allTextContents()).map(leer),
    pfadeIn: async wurzel => page.locator(`${wurzel} .df-k .p`).allTextContents(),
    listenpfade: async (wurzel = '#review') => page.locator(`${wurzel} .dn-e .p`).allTextContents(),
    gruppenkopf, datei, zeile,
    offen: async pfad => (await datei(pfad).locator('.df-k').getAttribute('aria-expanded')) === 'true',
    alleKnopf: () => page.locator('#rv-alle'),
    aufklapper: () => page.locator('#rv-auf'),
  };
}

/** Wartet, bis die Seite eines Commits steht: die Gruppenköpfe sind gezeichnet. */
async function commitOeffnen(page, k, nr, commit) {
  await page.goto(adresse(k, nr, commit));
  await page.locator('#rv-insel .rv-gk').first().waitFor();
}

/** Lage des Fokusrings eines Kopfs gegen den Scroll-Behälter `.rv` (PO Z. 552 (c)). */
const ringLage = kopf => kopf.evaluate(e => {
  const s = getComputedStyle(e), rv = document.getElementById('review').getBoundingClientRect(), r = e.getBoundingClientRect();
  const ring = Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset));
  return { fokus: document.activeElement === e, stil: s.outlineStyle, ringOben: r.top - ring, rvOben: rv.top, rvUnten: rv.bottom, oben: r.top };
});

/** Folge der Überschriften im Dokument: keine steigt um mehr als eine Ebene tiefer als die vorige. */
const ueberschriftenSprung = page => page.evaluate(() => {
  const stufen = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].map(h => +h.tagName[1]);
  return stufen.flatMap((s, i) => (i > 0 && s > stufen[i - 1] + 1 ? [`${stufen[i - 1]} → ${s}`] : []));
});

test.describe('R00235 Review-Seite nach Art gruppiert', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k, h;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    h = uebersichtRepository();
    k = await kanbanStarten(uebersichtVorbereiten(h));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1 Code zuerst (US-1) ── */

  test('AK 1/US-1: K-Art — Code, Tests, Doku und Planung in dieser Reihenfolge im Hauptteil und in der Dateiliste, mit Zahlen', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const erwartet = ['Code 1 Datei · +2 −3', 'Tests 4 Dateien · +297 −3', 'Doku und Planung 3 Dateien · +3 −0'];
    expect(await s.gruppenkoepfe()).toEqual(erwartet);
    expect(await s.listenkoepfe()).toEqual(erwartet);
    expect(await s.pfadeIn('#rv-gc-code')).toEqual(['web/kd-app.css']);
    expect(await s.pfadeIn('#rv-gc-test')).toEqual(['e2e/einheit/kontrast.test.js', 'e2e/einheit/sperrform.test.js', 'e2e/tests/r00219-ansicht.spec.js', 'e2e/tests/r00229-sperrform.spec.js']);
    expect(await s.listenpfade()).toEqual(['web/kd-app.css', 'e2e/einheit/kontrast.test.js', 'e2e/einheit/sperrform.test.js', 'e2e/tests/r00219-ansicht.spec.js', 'e2e/tests/r00229-sperrform.spec.js', 'Anforderungen/R00001.md', 'Dokumentation/Gelerntes.md', 'Schaetzungen/S00001.md']);
    expect(await s.offen('web/kd-app.css')).toBe(true);
    await expect(s.datei('web/kd-app.css').locator('table.dz')).toBeVisible();
  });

  /* ── AK 2 Doku zu, Liste vollständig ── */

  test('AK 2: Doku eingeklappt ohne Code, Liste mit allen 8 Dateien; Klick öffnet die Gruppe mit offenen Dateien, ein zweiter schließt', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const doku = s.gruppenkopf('doku');
    await expect(doku).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#rv-gc-doku')).toBeHidden();
    expect(await page.locator('#rv-gc-doku table.dz').count()).toBe(0);
    await expect(page.locator('#review .dn-e')).toHaveCount(8);
    for (const pfad of ['Anforderungen/R00001.md', 'Dokumentation/Gelerntes.md', 'Schaetzungen/S00001.md']) await expect(s.zeile(pfad).locator('.z')).toHaveText('+1 −0');
    await doku.click();
    await expect(doku).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rv-gc-doku .df-k[aria-expanded="true"]')).toHaveCount(3);
    await expect(page.locator('#rv-gc-doku table.dz')).toHaveCount(3);
    await doku.click();
    await expect(doku).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#rv-gc-doku')).toBeHidden();
  });

  test('AK 2: Gruppenkopf per Tastatur — aria-expanded, aria-controls auf den Bereich, der Fokus bleibt auf dem Kopf; Name und Höhe', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const doku = s.gruppenkopf('doku');
    await expect(doku).toHaveAccessibleName(/^Doku und Planung.*3 Dateien/);
    expect((await doku.boundingBox()).height).toBeGreaterThanOrEqual(24);
    await doku.focus();
    await page.keyboard.press('Enter');
    await expect(doku).toHaveAttribute('aria-expanded', 'true');
    const nachEnter = await page.evaluate(() => ({ id: document.activeElement.id, bereich: Boolean(document.getElementById(document.activeElement.getAttribute('aria-controls'))) }));
    expect(nachEnter).toEqual({ id: 'rv-gk-doku', bereich: true });
    await page.keyboard.press(' ');
    await expect(doku).toHaveAttribute('aria-expanded', 'false');
    expect(await page.evaluate(() => document.activeElement.id)).toBe('rv-gk-doku');
    expect(await doku.evaluate(e => e.parentElement.tagName)).toBe('H2');
    expect(await page.locator('#rv-insel .df-h').evaluateAll(l => [...new Set(l.map(e => e.tagName))])).toEqual(['H3']);
    expect(await ueberschriftenSprung(page)).toEqual([]);
  });

  test('AK 2: „Alle einklappen“ schließt nur Dateien, „Alle aufklappen“ öffnet auch die Gruppen; Blättern beginnt wie Laden', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await expect(s.alleKnopf()).toHaveText('Alle einklappen');
    await s.alleKnopf().click();
    await expect(s.alleKnopf()).toHaveText('Alle aufklappen');
    await expect(page.locator('#rv-insel .df-k[aria-expanded="true"]')).toHaveCount(0);
    await expect(s.gruppenkopf('code')).toHaveAttribute('aria-expanded', 'true');
    await expect(s.gruppenkopf('test')).toHaveAttribute('aria-expanded', 'true');
    await expect(s.datei('web/kd-app.css').locator('.df-k')).toBeVisible();
    await s.alleKnopf().click();
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#rv-insel .df-k[aria-expanded="true"]')).toHaveCount(8);
    // Blättern zu K-Doku und zurück: die Doku ist wieder zu
    await page.locator('#rv-vor').click();
    await expect(page.locator('#rv-pos')).toHaveText('2 von 2');
    await page.locator('#rv-zurueck').click();
    await expect(page.locator('#rv-pos')).toHaveText('1 von 2');
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'false');
  });

  test('AK 2: „Alle aufklappen“ lässt die großen neuen Dateien zu (K-Rand)', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 2, h.kRand);
    await s.alleKnopf().click();
    await expect(s.alleKnopf()).toHaveText('Alle aufklappen');
    await s.alleKnopf().click();
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'true');
    await expect(s.datei('tests/fixtures/genau-500.json').locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
    for (const pfad of ['tests/fixtures/genau-501.json', 'src/grosse-antwort.json', 'Dokumentation/neu.md']) await expect(s.datei(pfad).locator('.df-k'), pfad).toHaveAttribute('aria-expanded', 'false');
  });

  test('AK 2/US-7 Leerfall K-Doku: nur „Doku und Planung“ mit „2 Dateien · +2 −0“, eingeklappt, beide in der Liste, keine Fehlermeldung', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.kDoku);
    expect(await s.gruppenkoepfe()).toEqual(['Doku und Planung 2 Dateien · +2 −0']);
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'false');
    expect(await s.listenpfade()).toEqual(['Dokumentation/x.md', 'README.md']);
    expect(await page.locator('#review [role="alert"], #review .rv-meld').count()).toBe(0);
  });

  /* ── AK 3 Klick in der Dateiliste (US-2) ── */

  test('AK 3/US-2: die Wahl von Dokumentation/Gelerntes.md öffnet Gruppe und Datei, Fokus auf den Kopf, Fokusring ganz in .rv', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    await breiteSetzen(page, 1280, 500);
    await s.zeile('Dokumentation/Gelerntes.md').focus();
    await page.keyboard.press('Enter');
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'true');
    const kopf = s.datei('Dokumentation/Gelerntes.md').locator('.df-k');
    await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    await expect(kopf).toBeFocused();
    const lage = await ringLage(kopf);
    expect(lage.stil).not.toBe('none');
    expect(lage.ringOben).toBeGreaterThanOrEqual(lage.rvOben);
    expect(lage.oben).toBeLessThan(lage.rvUnten);
  });

  test('AK 3: die Wahl von src/grosse-antwort.json in K-Rand öffnet die eingeklappte große neue Datei', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 2, h.kRand);
    await s.zeile('src/grosse-antwort.json').click();
    const kopf = s.datei('src/grosse-antwort.json').locator('.df-k');
    await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    await expect(kopf).toBeFocused();
    await expect(s.datei('src/grosse-antwort.json').locator('tr.add')).toHaveCount(1240);
  });

  /* ── AK 4 Test-Hinweise (US-3) ── */

  test('AK 4/US-3: K-Art — „bestehender Test geändert“ an kontrast.test.js und r00219 in Liste und Kopf, sonst nirgends', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    for (const pfad of ['e2e/einheit/kontrast.test.js', 'e2e/tests/r00219-ansicht.spec.js']) {
      await expect(s.zeile(pfad).locator('.rv-th'), pfad).toHaveText('bestehender Test geändert');
      await expect(s.datei(pfad).locator('.df-k .rv-th'), pfad).toHaveText('bestehender Test geändert');
    }
    const orte = await page.locator('.rv-th').evaluateAll(l => l.map(e => Boolean(e.closest('.dn-e, .df-k'))));
    expect(orte).toEqual([true, true, true, true]);
    const im = await page.evaluate(() => (document.body.textContent.match(/bestehender Test geändert|Test gelöscht/g) || []).length);
    expect(im).toBe(4);
    for (const pfad of ['e2e/einheit/sperrform.test.js', 'e2e/tests/r00229-sperrform.spec.js', 'web/kd-app.css']) await expect(s.zeile(pfad).locator('.rv-th'), pfad).toHaveCount(0);
  });

  test('AK 4/US-3: K-Rand — „Test gelöscht“, umbenannter Test „bestehender Test geändert“, tests/nur-neu.rs (−0) ohne Hinweis', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 2, h.kRand);
    await expect(s.zeile('e2e/tests/r00150-alte-leiste.spec.js').locator('.rv-th')).toHaveText('Test gelöscht');
    await expect(s.datei('e2e/tests/r00150-alte-leiste.spec.js').locator('.df-k .rv-th')).toHaveText('Test gelöscht');
    await expect(s.zeile('e2e/einheit/sperrform-alt.test.js').locator('.rv-th')).toHaveText('bestehender Test geändert');
    await expect(s.zeile('tests/nur-neu.rs').locator('.rv-th')).toHaveCount(0);
    await expect(s.datei('tests/nur-neu.rs').locator('.rv-th')).toHaveCount(0);
  });

  /* ── AK 5 Große neue Datei (US-4) ── */

  test('AK 5/US-4: K-Rand — 500 offen, 501 und 1.240 zu mit Satz und Knopf, M +600 offen; der Knopf zeigt 501 Zeilen ohne Anfrage', async ({ page }) => {
    const s = seite(page);
    const nachgeladen = [];
    page.on('request', r => { if (r.url().includes('datei=')) nachgeladen.push(r.url()); });
    await commitOeffnen(page, k, 2, h.kRand);
    expect(await s.offen('tests/fixtures/genau-500.json')).toBe(true);
    expect(await s.offen('src/lang.rs')).toBe(true);
    const g501 = s.datei('tests/fixtures/genau-501.json');
    expect(await s.offen('tests/fixtures/genau-501.json')).toBe(false);
    await expect(g501.locator('.df-zu p')).toHaveText('Neue Datei mit 501 Zeilen, beginnt eingeklappt.');
    await expect(g501.locator('.df-zu button')).toHaveText('Änderungen anzeigen');
    await expect(g501.locator('.df-k .z')).toHaveText('+501 −0');
    await expect(s.datei('src/grosse-antwort.json').locator('.df-zu p')).toHaveText('Neue Datei mit 1.240 Zeilen, beginnt eingeklappt.');
    await g501.locator('.df-zu button').click();
    await expect(g501.locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
    await expect(g501.locator('tr.add')).toHaveCount(501);
    await expect(g501.locator('.df-zu')).toHaveCount(0);
    expect(nachgeladen).toEqual([]);
  });

  test('AK 5: zwei Wege, ein Ergebnis — Kopf und Knopf öffnen gleich, Zuklappen bringt Satz und Knopf zurück; der Knopf ist per Tab erreichbar', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 2, h.kRand);
    const g501 = s.datei('tests/fixtures/genau-501.json');
    await g501.locator('.df-k').focus();
    // R00236: zwischen Klappknopf und Satz stehen Pfad, VS Code und Patch
    for (let n = 0; n < 4; n++) await page.keyboard.press('Tab');
    await expect(g501.locator('.df-zu button')).toBeFocused();
    await g501.locator('.df-k').click();
    await expect(g501.locator('.df-k')).toHaveAttribute('aria-expanded', 'true');
    await expect(g501.locator('tr.add')).toHaveCount(501);
    await expect(g501.locator('.df-zu')).toHaveCount(0);
    await g501.locator('.df-k').click();
    await expect(g501.locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    await expect(g501.locator('.df-zu p')).toHaveText('Neue Datei mit 501 Zeilen, beginnt eingeklappt.');
    await expect(g501.locator('.df-zu button')).toBeVisible();
  });

  test('AK 5: ein Satz je Grund — tests/g.rs (wegen des Budgets zu) mit „Der Patch ist groß …“; Dokumentation/neu.md bleibt in der offenen Doku zu', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 4, h.kBudget);
    const g = s.datei('tests/g.rs');
    await expect(g.locator('.df-zu p')).toHaveText('Der Patch ist groß (2.500 Zeilen) und wird erst auf Wunsch geladen.');
    await expect(g.locator('.df-zu button')).toHaveText('Änderungen anzeigen');
    await expect(g).not.toContainText('Neue Datei');
    await commitOeffnen(page, k, 2, h.kRand);
    await s.gruppenkopf('doku').click();
    await expect(s.gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'true');
    await expect(s.datei('Dokumentation/neu.md').locator('.df-k')).toHaveAttribute('aria-expanded', 'false');
    await expect(s.datei('Dokumentation/neu.md').locator('.df-zu p')).toHaveText('Neue Datei mit 600 Zeilen, beginnt eingeklappt.');
  });

  /* ── AK 6 Zeichenbudget nach Gruppen (US-5) ── */

  test('AK 6/US-5: K-Budget — b, e, f, c offen; d, g, a zu', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 4, h.kBudget);
    const stand = {};
    for (const pfad of ['src/b.rs', 'src/d.rs', 'src/e.rs', 'src/f.rs', 'tests/c.rs', 'tests/g.rs', 'Dokumentation/a.md']) stand[pfad] = await s.offen(pfad);
    expect(stand).toEqual({ 'src/b.rs': true, 'src/d.rs': false, 'src/e.rs': true, 'src/f.rs': true, 'tests/c.rs': true, 'tests/g.rs': false, 'Dokumentation/a.md': false });
  });

  /* ── AK 7 Größenbalken ── */

  test('AK 7: K-Art — Balken je Gruppe auf ±1 px, jede Zahl über 0 mindestens 1 px, keine 0 als Teil; aria-hidden', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const teile = async pfad => s.zeile(pfad).locator('.rv-gb').evaluate(b => ({
      versteckt: b.getAttribute('aria-hidden'),
      plus: b.querySelector('.rv-gb-p') ? b.querySelector('.rv-gb-p').getBoundingClientRect().width : 0,
      minus: b.querySelector('.rv-gb-m') ? b.querySelector('.rv-gb-m').getBoundingClientRect().width : 0,
      mTeil: Boolean(b.querySelector('.rv-gb-m')),
    }));
    const css = await teile('web/kd-app.css');
    expect(css.versteckt).toBe('true');
    expect(Math.abs(css.plus - 2 / 5 * L)).toBeLessThanOrEqual(1);
    expect(Math.abs(css.minus - 3 / 5 * L)).toBeLessThanOrEqual(1);
    expect(Math.abs(css.plus + css.minus - L)).toBeLessThanOrEqual(1);
    expect(Math.abs((await teile('e2e/tests/r00229-sperrform.spec.js')).plus - L)).toBeLessThanOrEqual(1);
    expect(Math.abs((await teile('e2e/einheit/sperrform.test.js')).plus - 143 / 150 * L)).toBeLessThanOrEqual(1);
    const kontrast = await teile('e2e/einheit/kontrast.test.js');
    expect(kontrast.plus).toBeGreaterThanOrEqual(1);
    expect(kontrast.minus).toBeGreaterThanOrEqual(1);
    for (const pfad of ['Anforderungen/R00001.md', 'Dokumentation/Gelerntes.md', 'Schaetzungen/S00001.md']) {
      const doku = await teile(pfad);
      expect(Math.abs(doku.plus - L), pfad).toBeLessThanOrEqual(1);
      expect(doku.mTeil, pfad).toBe(false);
    }
  });

  /* ── AK 8 Alle Änderungen gruppiert ── */

  test('AK 8: Aufgabe #3 — kd mit Code, Tests, Doku zu; wb mit Code und Doku zu, ohne Tests; Liste je Abschnitt; Wahl von docs/b.md', async ({ page }) => {
    const s = seite(page);
    await page.goto(adresse(k, 3, null));
    await page.locator('#rv-a1 .rv-gk').first().waitFor();
    expect((await s.gruppenkoepfe('#rv-a0 .rv-abs-haupt')).map(t => t.split(' ')[0])).toEqual(['Code', 'Tests', 'Doku']);
    expect((await s.gruppenkoepfe('#rv-a1 .rv-abs-haupt')).map(t => t.split(' ')[0])).toEqual(['Code', 'Doku']);
    await expect(s.gruppenkopf('doku', 0)).toHaveAttribute('aria-expanded', 'false');
    await expect(s.gruppenkopf('doku', 1)).toHaveAttribute('aria-expanded', 'false');
    expect(await s.pfadeIn('#rv-gc0-code')).toEqual(['src/a.rs']);
    expect(await s.pfadeIn('#rv-gc0-test')).toEqual(['tests/a_test.rs']);
    expect(await s.pfadeIn('#rv-gc1-code')).toEqual(['b.js']);
    expect(await s.listenpfade('#rv-a0')).toEqual(['src/a.rs', 'tests/a_test.rs', 'README.md']);
    expect(await s.listenpfade('#rv-a1')).toEqual(['b.js', 'docs/b.md']);
    expect(await s.gruppenkopf('doku', 1).evaluate(e => e.parentElement.tagName)).toBe('H3');
    expect(await page.locator('#rv-insel .df-h').evaluateAll(l => [...new Set(l.map(e => e.tagName))])).toEqual(['H4']);
    expect(await ueberschriftenSprung(page)).toEqual([]);
    await s.zeile('docs/b.md', '#rv-a1').focus();
    await page.keyboard.press('Enter');
    await expect(s.gruppenkopf('doku', 1)).toHaveAttribute('aria-expanded', 'true');
    const kopf = s.datei('docs/b.md', '#rv-a1').locator('.df-k');
    await expect(kopf).toHaveAttribute('aria-expanded', 'true');
    await expect(kopf).toBeFocused();
    const lage = await ringLage(kopf);
    expect(lage.ringOben).toBeGreaterThanOrEqual(lage.rvOben);
    await expect(s.gruppenkopf('doku', 0)).toHaveAttribute('aria-expanded', 'false');
  });

  test('AK 8: ein Abschnitt, der wartet oder fehlschlug, zeigt keine Gruppen; der geöffnete Gruppenstand in kd bleibt über 503 und „Erneut versuchen“', async ({ page }) => {
    const s = seite(page);
    let frei;
    const tor = new Promise(r => { frei = r; });
    const muster = u => u.pathname === '/api/aufgaben/3/diff' && u.searchParams.get('anwendung') === 'wb';
    await page.route(muster, async route => { await tor; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ fehler: 'Zeitgrenze' }) }); });
    await page.goto(adresse(k, 3, null));
    await s.gruppenkopf('doku', 0).waitFor();
    await expect(page.locator('#rv-a1')).toContainText(/Lädt die Änderungen|Wartet/);
    expect(await page.locator('#rv-a1 .rv-gk').count()).toBe(0);
    await s.gruppenkopf('doku', 0).click();
    await expect(s.gruppenkopf('doku', 0)).toHaveAttribute('aria-expanded', 'true');
    frei();
    await expect(page.locator('#rv-a1 [data-act="review-abschnitt-erneut"]')).toBeVisible();
    expect(await page.locator('#rv-a1 .rv-gk').count()).toBe(0);
    await expect(s.gruppenkopf('doku', 0)).toHaveAttribute('aria-expanded', 'true');
    await page.unroute(muster);
    await page.locator('#rv-a1 [data-act="review-abschnitt-erneut"]').click();
    await expect(s.gruppenkopf('code', 1)).toBeVisible();
    await expect(s.gruppenkopf('doku', 0)).toHaveAttribute('aria-expanded', 'true');
  });

  /* ── AK 9 Breite, Themen, Kontrast, Aufklapper (US-6) ── */

  /** Alle Teile, die ganz in der Breite liegen müssen: rechte Kante und eigener Inhalt (`scrollWidth ≤ clientWidth`). */
  const teileMessen = page => page.evaluate(() => {
    const breite = document.documentElement.clientWidth;
    const teile = [...document.querySelectorAll('#review .rv-gk, #review .rv-gk *, #review .rv-gl, #review .rv-gl *, #review .dn-e, #review .dn-e *, #review .rv-th, #review .df-zu, #review .df-zu *, #rv-auf, #rv-auf *')]
      .filter(e => e.getClientRects().length > 0);
    return teile.flatMap(e => {
      const r = e.getBoundingClientRect(), name = e.className.baseVal === undefined ? `${e.tagName}.${e.className}` : e.tagName;
      const aus = [];
      if (r.right > breite + 0.5) aus.push(`${name} rechts ${r.right} > ${breite}`);
      if (e.scrollWidth > e.clientWidth && getComputedStyle(e).display !== 'inline') aus.push(`${name} abgeschnitten ${e.scrollWidth} > ${e.clientWidth}`);
      return aus;
    });
  });

  for (const breite of [320, 414, 641, 980, 1280]) {
    test(`AK 9: ${breite} px hell und dunkel, K-Art und K-Rand — kein Querscrollen der Seite, nur .df-sc; alle Teile ganz in der Breite`, async ({ page }) => {
      for (const [nr, commit] of [[1, h.kArt], [2, h.kRand]]) {
        await commitOeffnen(page, k, nr, commit);
        await breiteSetzen(page, breite, 900);
        if (breite < 1100) await seite(page).aufklapper().click();
        await seite(page).gruppenkopf('doku').click();
        await expect(seite(page).gruppenkopf('doku')).toHaveAttribute('aria-expanded', 'true');
        for (const farbe of ['light', 'dark']) {
          await thema(page, farbe);
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${breite} ${farbe} #${nr}`).toBe(true);
          expect(await breiteMessen(page, `R00235 ${breite} ${farbe} #${nr}`)).toEqual([]);
          expect(await teileMessen(page), `${breite} ${farbe} #${nr}`).toEqual([]);
        }
      }
    });
  }

  test('AK 9/US-6: Aufgabe #3 bei 320 px dunkel — Liste hinter „Dateien (5) und Commits“, zu; Code zuerst; kein Querscrollen', async ({ page }) => {
    await breiteSetzen(page, 320, 812);
    await thema(page, 'dark');
    await page.goto(adresse(k, 3, null));
    await page.locator('#rv-a1 .rv-gk').first().waitFor();
    await expect(seite(page).aufklapper()).toHaveText('Dateien (5) und Commits');
    await expect(seite(page).aufklapper()).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#rv-a0 .rv-abs-rail')).toBeHidden();
    expect(await seite(page).gruppenkoepfe('#rv-a0')).toEqual(['Code 1 Datei · +1 −1', 'Tests 1 Datei · +1 −0', 'Doku und Planung 1 Datei · +1 −0']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
    expect(await teileMessen(page)).toEqual([]);
    await seite(page).aufklapper().click();
    await expect(page.locator('#rv-a0 .rv-abs-rail')).toBeVisible();
    await expect(page.locator('#rv-a1 .rv-abs-rail')).toBeVisible();
  });

  for (const breite of [320, 414, 641, 980, 1099]) {
    test(`AK 9 Aufklapper ${breite} px: „Dateien (8) und Commits“ zu beim Öffnen, Kopf der ersten Code-Datei im ersten Bild, Klick zeigt alle Dateien`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, breite, 812);
      for (const [nr, commit] of [[1, h.kArt], [2, h.kRand]]) {
        await commitOeffnen(page, k, nr, commit);
        await expect(s.aufklapper()).toHaveText('Dateien (8) und Commits');
        await expect(s.aufklapper()).toHaveAttribute('aria-expanded', 'false');
        await expect(page.locator('#rv-liste')).toBeHidden();
      }
      await commitOeffnen(page, k, 1, h.kArt);
      const oben = await s.datei('web/kd-app.css').locator('.df-k').evaluate(e => e.getBoundingClientRect().top);
      expect(oben).toBeLessThan(812);
      await s.aufklapper().click();
      await expect(s.aufklapper()).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('#rv-liste .dn-e')).toHaveCount(8);
      await expect(page.locator('#rv-liste .dn-e').last()).toBeVisible();
      if (breite === 414) {
        await s.zeile('Dokumentation/Gelerntes.md').focus();
        await page.keyboard.press('Enter');
        const kopf = s.datei('Dokumentation/Gelerntes.md').locator('.df-k');
        await expect(kopf).toBeFocused();
        const lage = await ringLage(kopf);
        expect(lage.ringOben).toBeGreaterThanOrEqual(lage.rvOben);
      }
    });
  }

  for (const breite of [1100, 1280]) {
    test(`AK 9 ${breite} px: kein Aufklapper, die Dateiliste steht links neben dem Hauptteil`, async ({ page }) => {
      await breiteSetzen(page, breite, 812);
      await commitOeffnen(page, k, 1, h.kArt);
      await expect(seite(page).aufklapper()).toBeHidden();
      const lage = await page.evaluate(() => ({ liste: document.querySelector('#rv-liste').getBoundingClientRect().right, haupt: document.querySelector('.rv-haupt').getBoundingClientRect().left }));
      expect(lage.liste).toBeLessThanOrEqual(lage.haupt);
      await expect(page.locator('#rv-liste .dn-e')).toHaveCount(8);
    });
  }

  test('AK 9: Kontrast der Marke in hell und dunkel, auch bei Hover und Fokus der Zeile; Fokusring des Gruppenkopfs sichtbar', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 1, h.kArt);
    const zeile = s.zeile('e2e/einheit/kontrast.test.js');
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      for (const zustand of ['ruhig', 'hover', 'fokus']) {
        if (zustand === 'hover') await zeile.hover();
        if (zustand === 'fokus') { await page.mouse.move(0, 0); await zeile.focus(); }
        const schrift = (await kontrastMessen(page, ['.dn-e .rv-th'])).map(m => m.wert);
        expect(schrift.length, `${farbe} ${zustand}`).toBeGreaterThan(0);
        for (const wert of schrift) expect(wert, `Schrift ${farbe} ${zustand}`).toBeGreaterThanOrEqual(4.5);
        const farben = await zeile.locator('.rv-th').evaluate(e => {
          let grund = e.parentElement;
          while (grund && ['transparent', 'rgba(0, 0, 0, 0)'].includes(getComputedStyle(grund).backgroundColor)) grund = grund.parentElement;
          return { rand: getComputedStyle(e).borderTopColor, flaeche: getComputedStyle(grund).backgroundColor };
        });
        expect(await kontrastFarben(page, farben.rand, farben.flaeche), `Rand ${farbe} ${zustand}`).toBeGreaterThanOrEqual(3);
      }
    }
    await s.gruppenkopf('doku').focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const ring = await s.gruppenkopf('doku').evaluate(e => ({ fokus: document.activeElement === e, stil: getComputedStyle(e).outlineStyle, breite: parseFloat(getComputedStyle(e).outlineWidth) }));
    expect(ring.fokus).toBe(true);
    expect(ring.stil).not.toBe('none');
    expect(ring.breite).toBeGreaterThanOrEqual(2);
  });

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true });
    test('AK 9: bei 320 px und grobem Zeiger ist jede Zeile der Dateiliste und jeder Gruppenkopf mindestens 44 px hoch', async ({ page }) => {
      const s = seite(page);
      await commitOeffnen(page, k, 1, h.kArt);
      await s.aufklapper().click();
      await expect(page.locator('#rv-liste .dn-e').first()).toBeVisible();
      const flach = await page.locator('#review .dn-e, #review .rv-gk').evaluateAll(l => l.map(e => [e.textContent, Math.round(e.getBoundingClientRect().height)]).filter(([, hoehe]) => hoehe < 44));
      expect(flach).toEqual([]);
    });
  });
});
