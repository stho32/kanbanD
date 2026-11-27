// R00245 Review-Seite — Commit-Leiste und verdichteter Commit-Kopf (Karte #256, I0235, Scheibe S2 von ADR-0042): AK 1–10 und
// US-1..US-7 im echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`leisteRepository`: K-Leiste, K-Rand, 30 Commits in kd,
// W1 in wb). Gehaltene Antworten über ein Promise, keine Schlafzeiten; Lage nur mit getBoundingClientRect; Verneinungen nach einem Signal.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, liveBereit, reiter, mutanteEinsetzen, breiteSetzen, thema, kontrastMessen, kontrastFarben, ansagenZaehlen } = require('./hilfen');
const { leisteRepository, leisteVorbereiten, BOESE, LANGER_TITEL, BIDI_ZWEIG } = require('./review-hilfen');

/* ── Treiber: Adressen und Teile der Seite; nur hier stehen Selektoren ── */
const kurz = (hash, k = 'kd') => `${k}:${hash.slice(0, 7)}`;
const adresse = (k, nr, commit = null, kuerzel = 'kd') => `${k.adresse}#/aufgaben/aufgabe/${nr}/review${commit ? `?commit=${encodeURIComponent(`${kuerzel}:${commit}`)}` : ''}`;
const leer = s => s.replace(/\s+/g, ' ').trim();
const istListe = (url, nr) => url.pathname === `/api/aufgaben/${nr}/commits`;

function seite(page) {
  const leiste = page.getByRole('navigation', { name: 'Ansicht der Review-Seite', exact: true });
  const eintraege = leiste.locator('li > a');
  return {
    leiste,
    eintraege,
    alle: () => eintraege.first(),
    /** Eintrag des Commits `hash` (über seinen Verweis). */
    eintrag: (hash, k = 'kd') => leiste.locator(`li > a[data-arg="${k}:${hash}"]`),
    /** Je Eintrag Zeile 1 und Zeile 2 als Text, mit „ · “ verbunden. */
    texte: async () => (await eintraege.evaluateAll(as => as.map(a => [...a.querySelectorAll(':scope > .z1, :scope > .z2')].map(z => z.textContent).join(' · ')))).map(leer),
    gezeigt: async () => eintraege.evaluateAll(as => as.flatMap((a, i) => (a.getAttribute('aria-current') === 'page' ? [i] : []))),
    // R00266: „Zum Code“ ist das erste Element des angehefteten Kopfs, nicht mehr der Commit-Leiste
    zumCode: () => page.locator('#rv-zc'),
    blaettern: () => page.getByRole('navigation', { name: 'Commits der Aufgabe, ältester zuerst' }),
    kopf: () => page.locator('.rv-commit'),
    ueberschrift: () => page.locator('.rv-commit h2'),
    kopfChips: () => page.locator('.rv-commit .rv-chips li'),
    zweige: () => page.locator('.rv-commit .rv-zweige'),
    mehr: () => page.locator('.rv-commit .rv-zweige button'),
    pos: () => page.locator('#rv-pos'),
  };
}

/** Öffnet die Seite eines Commits und wartet, bis die Leiste mit Zahlen und der Kopf stehen. */
async function commitOeffnen(page, k, nr, hash, kuerzel = 'kd') {
  await page.goto(adresse(k, nr, hash, kuerzel));
  await page.locator('.rv-commit h2').waitFor();
  await page.locator('#rv-u-alle[aria-label]').waitFor();
}

/** Öffnet „Alle Änderungen“ und wartet auf die Leiste mit Zahlen. */
async function alleOeffnen(page, k, nr) {
  await page.goto(adresse(k, nr));
  await page.locator('#rv-u-alle[aria-label]').waitFor();
}

/** Öffnet die Review-Seite von `hash` aus der Liste „Commits“ der Aufgabe (Marke „aus der Liste geöffnet“). */
async function ausDerListe(page, k, nr, hash) {
  await page.goto(`${k.adresse}#/board/entwicklung/aufgabe/${nr}`);
  await liveBereit(page);
  await reiter(page, 'Commits');
  await page.locator(`#fenster a.cl-hash[data-arg="kd:${hash}"]`).click();
  await page.locator('.rv-commit h2').waitFor();
}

/** Hält die Antworten auf `…/commits` an, bis `frei(i, wert)` die i-te freigibt (`{status}` ersetzt, sonst echt). */
async function listeHalten(page, nr) {
  const tore = [];
  await page.route(url => istListe(url, nr), async route => {
    let frei; const tor = new Promise(r => { frei = r; });
    tore.push(frei);
    const wert = await tor;
    if (wert && wert.status) return route.fulfill({ status: wert.status, contentType: 'application/json', body: JSON.stringify({ fehler: 'Das Repository antwortete nicht innerhalb von 10 s' }) }).catch(() => {});
    return route.continue().catch(() => {});
  });
  return { frei: (i, wert) => tore[i](wert), angehalten: () => tore.length };
}

/** Zählt die GET-Anfragen an `…/commits` der Aufgabe `nr`. */
function listeZaehlen(page, nr) {
  const z = { n: 0 };
  page.on('request', r => { if (r.method() === 'GET' && istListe(new URL(r.url()), nr)) z.n++; });
  return z;
}

/** Rollstand und Lage: Leiste, Fenster, Behälter der Seite. */
const rollen = page => page.evaluate(() => ({ leiste: document.getElementById('rv-ls').scrollTop, seite: document.getElementById('review').scrollTop, fenster: window.scrollY }));

/** Liegt das um den Fokusring erweiterte Rechteck von `el` ganz im Rechteck der Leiste und des Fensters? */
const ringInnen = el => el.evaluate(e => {
  const s = getComputedStyle(e), r = e.getBoundingClientRect(), l = document.getElementById('rv-ls').getBoundingClientRect();
  const ring = Math.max(0, parseFloat(s.outlineWidth) + parseFloat(s.outlineOffset));
  const aussen = { oben: r.top - ring, unten: r.bottom + ring, links: r.left - ring, rechts: r.right + ring };
  const tol = 0.5;
  return aussen.oben >= l.top - tol && aussen.unten <= l.bottom + tol && aussen.links >= l.left - tol && aussen.rechts <= l.right + tol
    && aussen.oben >= -tol && aussen.links >= -tol && aussen.unten <= innerHeight + tol && aussen.rechts <= innerWidth + tol;
});

/** Liegt `el` ganz im sichtbaren Teil der Leiste? */
const ganzSichtbar = el => el.evaluate(e => {
  const r = e.getBoundingClientRect(), l = document.getElementById('rv-ls');
  const b = l.getBoundingClientRect();
  return r.top >= b.top + l.clientTop - 0.5 && r.bottom <= b.top + l.clientTop + l.clientHeight + 0.5;
});

/** Die Lage der Kopf-Überschrift: umgebrochen (mehr als eine Zeile) und in die Breite passend (AK 8). */
const kopfLage = s => s.ueberschrift().evaluate(e => ({
  zeilen: e.getClientRects().length > 1 || e.getBoundingClientRect().height > parseFloat(getComputedStyle(e).lineHeight) * 1.5,
  passt: e.scrollWidth <= e.clientWidth,
}));

test.describe('R00245 Commit-Leiste und verdichteter Commit-Kopf', () => {
  test.use({ viewport: { width: 1280, height: 900 } });
  let k, h;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    h = leisteRepository();
    k = await kanbanStarten(leisteVorbereiten(h));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1 Leiste statt Umschalter, Zahlen (US-1) ── */

  test('AK 1/US-1: K-Leiste, C2 gezeigt — „Alle Änderungen · 3 Commits · +318 −20“, C1, C2, C3; nur C2 gezeigt; kein Umschalter', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c2);
    expect(await s.texte()).toEqual([
      'Alle Änderungen · 3 Commits · +318 −20',
      `R00229B1187Sperrform je Komponente · ${kurz(h.c1)} · 22.11. 03:19 · +302 −7`,
      `R00229B1188Mutanten m1–m7 getötet, R00229 Erledigt, WBS und Ist-Zeiten · ${kurz(h.c2)} · 22.11. 03:31 · +14 −12`,
      `DOCR00229 AK 5: Fokusring je Ansicht · ${kurz(h.c3)} · 22.11. 04:34 · +2 −1`,
    ]);
    expect(await s.gezeigt()).toEqual([2]);
    await expect(s.leiste.locator('ul > li')).toHaveCount(4);
    await expect(page.locator('#rv-u-commit')).toHaveCount(0);
    await expect(page.locator('.umsch')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Ein Commit', exact: true })).toHaveCount(0);
    // Namen: Wörter statt Zeichen, der sichtbare Text als Teilstring (WCAG 2.5.3)
    await expect(s.alle()).toHaveAttribute('aria-label', 'Alle Änderungen, 3 Commits, 318 Zeilen hinzugefügt, 20 entfernt');
    const name = await s.eintrag(h.c2).getAttribute('aria-label');
    expect(name).toBe(`Commit ${kurz(h.c2)}, [R00229] B1188: Mutanten m1–m7 getötet, R00229 Erledigt, WBS und Ist-Zeiten, 22.11. 03:31, 14 Zeilen hinzugefügt, 12 entfernt`);
    for (const a of await s.eintraege.all()) {
      const n = await a.getAttribute('aria-label');
      for (const teil of await a.locator('.t, .mono, .rv-zeit').allTextContents()) expect(n, `Name enthält „${teil}“`).toContain(teil);
    }
    // die beiden Navigationen tragen verschiedene Namen
    await expect(s.blaettern()).toHaveCount(1);
  });

  test('AK 1: Aufgabe #6 mit nur C10 — „1 Commit · +1.240 −0“', async ({ page }) => {
    await alleOeffnen(page, k, 6);
    expect((await seite(page).texte())[0]).toBe('Alle Änderungen · 1 Commit · +1.240 −0');
    await expect(seite(page).alle()).toHaveAttribute('aria-label', 'Alle Änderungen, 1 Commit, 1.240 Zeilen hinzugefügt, 0 entfernt');
    await expect(seite(page).alle()).toHaveAttribute('aria-current', 'page');
  });

  /* ── AK 2 Eintrag und Chips (US-2) ── */

  test('AK 2/US-2: C1 mit den Chips R00229 und B1187, C3 mit DOC; Titel einzeilig, `title` mit dem ganzen Titel', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c1);
    const c1 = s.eintrag(h.c1), c3 = s.eintrag(h.c3);
    expect(await c1.locator('.rv-chip').allTextContents()).toEqual(['R00229', 'B1187']);
    await expect(c1.locator('.t')).toHaveText('Sperrform je Komponente');
    await expect(c1.locator('.mono')).toHaveText(kurz(h.c1));
    await expect(c1.locator('.rv-zeit')).toHaveText('22.11. 03:19');
    await expect(c1.locator('.z2')).toContainText('+302 −7');
    await expect(c1).toHaveAttribute('title', '[R00229] B1187: Sperrform je Komponente');
    expect(await c3.locator('.rv-chip').allTextContents()).toEqual(['DOC']);
    await expect(c3.locator('.t')).toHaveText('R00229 AK 5: Fokusring je Ansicht');
    const zeilen = await c1.locator('.t').evaluate(e => ({ umbruch: getComputedStyle(e).whiteSpace, rechtecke: e.getClientRects().length }));
    expect(zeilen).toEqual({ umbruch: 'nowrap', rechtecke: 1 });
  });

  /* ── AK 3 Wahl, Blättern, Tastatur (US-1) ── */

  test('AK 3/US-1: aus der Liste C2, Klick auf C3 — C3 gezeigt, Fokus auf C3, Verlauf ersetzt, „←“ in die Liste, keine neue Anfrage', async ({ page }) => {
    const s = seite(page);
    const anfragen = listeZaehlen(page, 5);
    await ausDerListe(page, k, 5, h.c2);
    await expect(s.eintrag(h.c2)).toHaveAttribute('aria-current', 'page');
    const laenge = await page.evaluate(() => history.length);
    const listeVorher = anfragen.n;
    await s.eintrag(h.c3).click();
    await expect(s.pos()).toHaveText('3 von 3');
    expect(await s.gezeigt()).toEqual([3]);
    await expect(s.eintrag(h.c3)).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(laenge);
    expect(decodeURIComponent(page.url())).toContain(`review?commit=kd:${h.c3}`);
    expect(anfragen.n - listeVorher, 'die Liste wird nicht neu gelesen').toBe(0);
    // „Zurück“ zieht aria-current mit
    await page.locator('#rv-zurueck').click();
    await expect(s.pos()).toHaveText('2 von 3');
    expect(await s.gezeigt()).toEqual([2]);
    // „Alle Änderungen“: Ansicht der Aufgabe, aria-current und Fokus am ersten Eintrag
    await s.alle().click();
    await expect(page.locator('#rv-a0')).toBeVisible();
    expect(await s.gezeigt()).toEqual([0]);
    await expect(s.alle()).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(laenge);
    await page.locator('#rv-rueckweg').click();
    await expect(page.getByRole('dialog', { name: 'Aufgabe #5' })).toBeVisible();
  });

  test('AK 3: Strg-Klick öffnet C3 in einem neuen Tab, die Seite bleibt bei C2', async ({ page, context }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c2);
    const neu = context.waitForEvent('page');
    await s.eintrag(h.c3).click({ modifiers: ['ControlOrMeta'] });
    const tab = await neu;
    await tab.waitForLoadState();
    expect(decodeURIComponent(tab.url())).toContain(`review?commit=kd:${h.c3}`);
    await tab.close();
    await expect(s.pos()).toHaveText('2 von 3');
    expect(await s.gezeigt()).toEqual([2]);
  });

  test('AK 3: Tab-Folge — Rückweg, die Einträge der Leiste, Zurück, Vor, Alle einklappen; Enter wählt', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c2);
    await page.locator('#rv-rueckweg').focus();
    const folge = [];
    for (let i = 0; i < 9; i++) {
      await page.keyboard.press('Tab');
      folge.push(await page.evaluate(() => document.activeElement.id));
    }
    // R00266: der angeheftete Kopf steht vor der Commit-Leiste
    expect(folge).toEqual(['rv-alle', 'rv-umbr', 'rv-nb', 'rv-u-alle', 'rv-l1', 'rv-l2', 'rv-l3', 'rv-zurueck', 'rv-vor']);
    await s.eintrag(h.c1).focus();
    await page.keyboard.press('Enter');
    await expect(s.pos()).toHaveText('1 von 3');
    await expect(s.eintrag(h.c1)).toBeFocused();
  });

  test('AK 3: Klick auf den gezeigten Eintrag bewirkt nichts — kein Verlaufseintrag, keine neue Zeichnung, Rollstand und Fokus bleiben', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c2);
    await s.eintrag(h.c2).focus();
    const laenge = await page.evaluate(() => history.length);
    const vorher = await rollen(page);
    // Marke am Knoten: eine neue Zeichnung ersetzte ihn
    await s.eintrag(h.c2).evaluate(e => { e.dataset.probe = 'alt'; });
    await s.eintrag(h.c2).click();
    await page.keyboard.press('Enter');
    await expect(s.eintrag(h.c2)).toBeFocused();
    await expect(s.eintrag(h.c2)).toHaveAttribute('data-probe', 'alt');
    expect(await page.evaluate(() => history.length)).toBe(laenge);
    expect(await rollen(page)).toEqual(vorher);
    // ebenso „Alle Änderungen“, wenn sie gezeigt ist
    await s.alle().click();
    await expect(page.locator('#rv-a0')).toBeVisible();
    await s.alle().evaluate(e => { e.dataset.probe = 'alt'; });
    await s.alle().click();
    await expect(s.alle()).toHaveAttribute('data-probe', 'alt');
    await expect(s.alle()).toBeFocused();
  });

  test('AK 3: nach der Wahl eines anderen Eintrags genau ein role=status „Commit 3 von 3: kd:<kurz>“, kein zweiter', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c2);
    const ansagen = await ansagenZaehlen(page);
    await ansagen.beginnen();
    await s.eintrag(h.c3).click();
    await expect(s.pos()).toHaveText('3 von 3');
    const satz = `Commit 3 von 3: ${kurz(h.c3)}`;
    await expect(page.locator('[role="status"]', { hasText: satz })).toHaveCount(1);
    await expect(page.locator('[role="status"]', { hasText: satz })).toHaveText(satz);
    const gesagt = (await ansagen.eintraege()).map(e => e.text).filter(t => !/^Liest den Diff/.test(t));
    expect(gesagt).toEqual([satz]);
  });

  test('AK 3: „Zum Code“ — 30 Commits: erster Tab-Halt, nur bei Fokus sichtbar, setzt den Fokus auf den Anfang der Dateien; 7 Commits kein Verweis, 8 Commits Verweis', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 11, h.dreissig[0]);
    await expect(s.eintraege).toHaveCount(31);
    const zc = s.zumCode();
    await expect(zc).toHaveCount(1);
    expect(await zc.evaluate(e => e.getBoundingClientRect().width * e.getBoundingClientRect().height)).toBeLessThanOrEqual(1);
    await page.locator('#rv-rueckweg').focus();
    await page.keyboard.press('Tab');
    await expect(zc).toBeFocused();
    expect(await zc.evaluate(e => e.getBoundingClientRect().width > 1 && e.getBoundingClientRect().height > 1)).toBe(true);
    await page.keyboard.press('Enter');
    const ziel = await page.evaluate(() => ({ id: document.activeElement.id, imCode: Boolean(document.activeElement.closest('#rv-insel')), imKopf: Boolean(document.activeElement.closest('.rv-commit')) }));
    // die Dateien der 30 Commits sind Doku (`.txt`): der Anfang der Dateien ist der Kopf der Gruppe „Doku und Planung“
    expect(ziel).toEqual({ id: 'rv-gk-doku', imCode: true, imKopf: false });
    for (const [nr, anzahl, da] of [[12, 8, 0], [13, 9, 1]]) {
      await commitOeffnen(page, k, nr, h.dreissig[0]);
      await expect(s.eintraege).toHaveCount(anzahl);
      await expect(s.zumCode()).toHaveCount(da);
    }
  });

  /* ── AK 4 Kopf mit Chips (US-3) ── */

  test('AK 4/US-3: C1 — Kopf mit kd:<kurz>, Kennungen R00229 und B1187 als Liste, Überschrift ohne Chips; C4 und C6 ohne Chips', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c1);
    await expect(s.kopf().locator('.z1 > .mono')).toHaveText(kurz(h.c1));
    expect(await s.kopfChips().allTextContents()).toEqual(['R00229', 'B1187']);
    await expect(s.kopf().locator('.z1 .vh').first()).toHaveText('Kennungen:');
    await expect(s.ueberschrift()).toHaveText('Sperrform je Komponente');
    await expect(s.kopf().locator('p.m')).toContainText('Ada Autorin · 22.11.2026 03:19');
    await expect(s.kopf().locator('p.m')).toContainText('+302 −7 · 1 Datei');
    for (const [hash, titel] of [[h.c4, 'Ohne Form'], [h.c6, '[R00229]'], [h.c5, '[Factory] director: Text']]) {
      await commitOeffnen(page, k, 10, hash);
      await expect(s.ueberschrift()).toHaveText(titel);
      await expect(s.kopfChips()).toHaveCount(0);
    }
  });

  test('AK 4: ein Chip über 16 Zeichen ist im Kopf gekürzt, der volle Text steht im title', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 9, h.c3a);
    // der Titel aus nur einer Kennung hat keinen Rest: unverändert ohne Chips
    await expect(s.ueberschrift()).toHaveText('[' + 'A'.repeat(40) + ']');
    await expect(s.kopfChips()).toHaveCount(0);
    await commitOeffnen(page, k, 9, h.c1);
    await expect(s.kopfChips()).toHaveCount(2);
  });

  /* ── AK 5 Zweige verdichtet (US-4) ── */

  test('AK 5/US-4: C1 „auf main“ mit „+5 Zweige“ — Klick öffnet die Liste, Fokus bleibt, zweiter Klick schließt, Wechsel beginnt zu', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 5, h.c1);
    await expect(s.zweige()).toContainText('auf main');
    const mehr = s.mehr();
    await expect(mehr).toHaveText('+5 Zweige');
    await expect(mehr).toHaveAttribute('aria-expanded', 'false');
    await expect(s.zweige().locator('.rv-br').first()).toBeHidden();
    await mehr.click();
    await expect(mehr).toHaveAttribute('aria-expanded', 'true');
    await expect(mehr).toBeFocused();
    expect(await s.zweige().locator('.rv-br').allTextContents()).toEqual(['karte/247', 'karte/a', 'karte/b', 'karte/c', 'karte/d', 'main']);
    await expect(s.zweige().locator('.rv-br').first()).toBeVisible();
    await mehr.click();
    await expect(mehr).toHaveAttribute('aria-expanded', 'false');
    await mehr.click();
    await expect(mehr).toHaveAttribute('aria-expanded', 'true');
    await s.eintrag(h.c3).click();
    await expect(s.pos()).toHaveText('3 von 3');
    await expect(s.mehr()).toHaveText('+1 Zweig');
    await expect(s.mehr()).toHaveAttribute('aria-expanded', 'false');
    await s.eintrag(h.c1).click();
    await expect(s.pos()).toHaveText('1 von 3');
    await expect(s.mehr()).toHaveAttribute('aria-expanded', 'false');
  });

  test('AK 5: C3 „+1 Zweig“, C2 die heutige Liste, C4 ohne Knopf, C8 „auf master“, C9 „+11 Zweige“, V „auf keinem Zweig“, main nicht genannt → Liste', async ({ page }) => {
    const s = seite(page);
    const zweigtext = async () => leer(await s.zweige().evaluate(e => [...e.childNodes].filter(n => !(n.nodeType === 1 && (n.hidden || n.tagName === 'BUTTON'))).map(n => n.textContent).join(' ')));
    await commitOeffnen(page, k, 5, h.c3);
    expect(await zweigtext()).toBe('auf main');
    await expect(s.mehr()).toHaveText('+1 Zweig');
    await commitOeffnen(page, k, 5, h.c2);
    await expect(s.mehr()).toHaveCount(0);
    expect(await zweigtext()).toBe('auf Zweigen: karte/247 origin/karte/247');
    await expect(s.zweige()).not.toContainText('auf main');
    const faelle = [[h.c4, 'auf main', null], [h.c8, 'auf master', '+1 Zweig'], [h.c9, 'auf main', '+11 Zweige']];
    for (const [hash, text, knopf] of faelle) {
      await commitOeffnen(page, k, 10, hash);
      expect(await zweigtext(), text).toBe(text);
      if (knopf) await expect(s.mehr()).toHaveText(knopf);
      else await expect(s.mehr()).toHaveCount(0);
    }
    await commitOeffnen(page, k, 10, h.a12);
    await expect(s.mehr()).toHaveCount(0);
    expect(await zweigtext()).toBe('auf Zweigen: a01 a02 a03 a04 a05 a06 a07 a08 a09 a10 +3');
    await commitOeffnen(page, k, 7, h.v);
    await expect(s.zweige()).toHaveText('auf keinem Zweig');
    await expect(s.mehr()).toHaveCount(0);
    await expect(page.locator('.rv-commit .rv-band')).toContainText('Dieser Commit ist verwaist');
  });

  /* ── AK 6 Ränder der Leiste (US-7) ── */

  test('AK 6/US-7: Aufgabe #7 — V „auf keinem Zweig“ in der Leiste, „2 Commits · +316 −19“, kein Eintrag für fehlt; die Wahl von V zeigt das Band', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 7, h.c1);
    const texte = await s.texte();
    expect(texte[0]).toBe('Alle Änderungen · 2 Commits · +316 −19');
    expect(texte).toHaveLength(4);
    expect(texte[3]).toBe(`R00229B1189verwaist · ${kurz(h.v)} · auf keinem Zweig · 22.11. 03:40 · +1 −0`);
    const v = s.eintrag(h.v);
    expect(await v.getAttribute('aria-label')).toMatch(/, auf keinem Zweig, zählt nicht in den Zahlen von Alle Änderungen$/);
    await v.click();
    await expect(page.locator('.rv-commit .rv-band')).toContainText('Dieser Commit ist verwaist');
    expect(await s.gezeigt()).toEqual([3]);
  });

  test('AK 6/US-7: Liste gehalten — nur „Alle Änderungen“ mit „Commits werden gelesen …“, aria-busy, ohne aria-current; 503 → „Commits nicht gelesen“; Erneut versuchen', async ({ page }) => {
    const s = seite(page);
    const tor = await listeHalten(page, 5);
    await page.goto(adresse(k, 5, h.c2));
    await expect.poll(() => tor.angehalten()).toBe(1);
    await expect(s.eintraege).toHaveCount(1);
    expect(await s.texte()).toEqual(['Alle Änderungen · Commits werden gelesen …']);
    await expect(s.leiste).toHaveAttribute('aria-busy', 'true');
    await expect(s.alle()).not.toHaveAttribute('aria-current', 'page');
    tor.frei(0, { status: 503 });
    await expect(page.getByRole('button', { name: 'Erneut versuchen' })).toBeVisible();
    expect(await s.texte()).toEqual(['Alle Änderungen · Commits nicht gelesen']);
    await expect(s.alle()).not.toHaveAttribute('aria-current', 'page');
    await expect(s.eintraege).toHaveCount(1);
    await page.getByRole('button', { name: 'Erneut versuchen' }).click();
    await expect.poll(() => tor.angehalten()).toBe(2);
    tor.frei(1);
    await expect(s.eintraege).toHaveCount(4);
    await expect(s.leiste).not.toHaveAttribute('aria-busy', 'true');
    expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
    expect(await s.gezeigt()).toEqual([2]);
  });

  test('AK 6: Aufgabe ohne Commit mit Diff — nur „Alle Änderungen“ ohne Zahlen, „Keine Änderungen zu zeigen.“; fremde Adresse ohne aria-current', async ({ page }) => {
    const s = seite(page);
    await page.goto(adresse(k, 14));
    await expect(page.getByText('Keine Änderungen zu zeigen.')).toBeVisible();
    await expect(s.eintraege).toHaveCount(1);
    expect(await s.texte()).toEqual(['Alle Änderungen']);
    // Adresse mit einem Commit außerhalb der Folge (R00207 Rand b): die Liste nennt C3 nicht
    await page.route(url => istListe(url, 5), async route => {
      const echt = await route.fetch();
      const json = await echt.json();
      json.commits = json.commits.filter(e => e.hash !== h.c3);
      await route.fulfill({ response: echt, body: JSON.stringify(json) });
    });
    await page.goto(adresse(k, 5, h.c3));
    await expect(page.locator('.rv-randb')).toBeVisible();
    await expect(s.eintraege).toHaveCount(3);
    expect(await s.gezeigt()).toEqual([]);
  });

  /* ── AK 7 Alle Änderungen, mehrere Anwendungen (US-5) ── */

  test('AK 7/US-5: Aufgabe #8 — kd und wb in der Reihenfolge der Liste, „Alle Änderungen“ gezeigt, Seitenleiste bleibt; W1 zeigt „Ein Commit“ von wb', async ({ page }) => {
    const s = seite(page);
    await alleOeffnen(page, k, 8);
    expect(await s.eintraege.locator('.mono').allTextContents()).toEqual([kurz(h.dreissig[0]), kurz(h.w1, 'wb'), kurz(h.dreissig[1])]);
    expect(await s.gezeigt()).toEqual([0]);
    await expect(page.locator('#rv-a0 .rv-cv').first()).toBeAttached();
    await expect(page.locator('#rv-a1 .rv-cv').first()).toBeAttached();
    await s.eintrag(h.w1, 'wb').click();
    await expect(s.pos()).toHaveText('2 von 3');
    await expect(s.kopf().locator('.z1 > .mono')).toHaveText(kurz(h.w1, 'wb'));
    expect(await s.gezeigt()).toEqual([2]);
  });

  /* ── AK 8 Breite, Themen, Ziele (US-6) ── */

  /** Teile der Leiste und des Kopfs, die nicht in ihre Breite passen. */
  const breiteFehler = page => page.evaluate(() => {
    const breite = document.documentElement.clientWidth, cl = document.getElementById('rv-ls').getBoundingClientRect();
    const aus = [];
    if (document.documentElement.scrollWidth > breite) aus.push(`Seite ${document.documentElement.scrollWidth} > ${breite}`);
    for (const e of document.querySelectorAll('#rv-ls, .rv-commit, .rv-commit .z1')) if (e.scrollWidth > e.clientWidth) aus.push(`${e.className} ${e.scrollWidth} > ${e.clientWidth}`);
    for (const e of document.querySelectorAll('#rv-ls li > a, #rv-ls .rv-chip')) if (e.getBoundingClientRect().right > cl.right + 0.5) aus.push(`${e.className} rechts`);
    return aus;
  });

  for (const breite of [320, 414, 599, 600, 980, 1280]) {
    test(`AK 8: ${breite} px hell und dunkel — kein Querscrollen; ${breite < 600 ? 'untereinander in voller Breite, Titel gekürzt, Überschrift bricht um' : 'nebeneinander, kein Eintrag breiter als die Leiste'}`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, breite, 900);
      for (const hash of [h.c2lang, h.c3a]) {
        await commitOeffnen(page, k, 9, hash);
        for (const farbe of ['light', 'dark']) {
          await thema(page, farbe);
          expect(await breiteFehler(page), `${breite} ${farbe}`).toEqual([]);
        }
      }
      const lage = await s.leiste.evaluate(l => {
        const b = l.querySelector('ul').getBoundingClientRect();
        return [...l.querySelectorAll('li > a')].map(a => { const r = a.getBoundingClientRect(); return { top: Math.round(r.top), left: r.left, breite: r.width, voll: b.width }; });
      });
      if (breite < 600) {
        const tops = lage.map(x => x.top);
        expect(new Set(tops).size, 'jeder Eintrag in eigener Zeile').toBe(lage.length);
        for (const x of lage) expect(Math.abs(x.breite - x.voll)).toBeLessThanOrEqual(1);
        const titel = s.eintrag(h.c2lang).locator('.t');
        expect(await titel.evaluate(e => ({ gekuerzt: e.scrollWidth > e.clientWidth, art: getComputedStyle(e).textOverflow }))).toEqual({ gekuerzt: true, art: 'ellipsis' });
        await commitOeffnen(page, k, 9, h.c2lang);
        // Die Hash-Adresse ist dieselbe Seite: `commitOeffnen` kehrt zurück, solange der Anker des vorigen Commits sichtbar ist,
        // sonst misst der Fall dessen einzeilige Überschrift (R00262). Erst messen, wenn der neue Kopf gezeichnet und umgebrochen ist.
        await expect.poll(() => kopfLage(s), { message: 'der neue Commit-Kopf ist gezeichnet und umgebrochen' }).toEqual({ zeilen: true, passt: true });
        const kopf = await kopfLage(s);
        expect(kopf).toEqual({ zeilen: true, passt: true });
      } else {
        for (const x of lage) expect(x.breite).toBeLessThanOrEqual(lage[0].voll + 0.5);
        if (breite === 980) {
          const c1 = await s.eintrag(h.c1).evaluate(e => Math.round(e.getBoundingClientRect().top));
          const c2 = await s.eintrag(h.c2lang).evaluate(e => Math.round(e.getBoundingClientRect().top));
          expect(c1).toBe(c2);
        }
      }
    });
  }

  test('AK 8: Kennung des Titels in C3 auf 16 Zeichen gekürzt (15 und „…“) — in einem Titel mit Rest', async ({ page }) => {
    // C3a besteht nur aus der Kennung und hat keine Chips; die Kürzung zeigt ein Chip mit Rest (per page.route)
    await page.route(url => istListe(url, 9), async route => {
      const echt = await route.fetch();
      const json = await echt.json();
      json.commits.forEach(e => { if (e.hash === h.c3a) e.titel = `[${'A'.repeat(40)}] Rest`; });
      await route.fulfill({ response: echt, body: JSON.stringify(json) });
    });
    await commitOeffnen(page, k, 9, h.c1);
    const chip = seite(page).eintrag(h.c3a).locator('.rv-chip');
    await expect(chip).toHaveText('A'.repeat(15) + '…');
    expect((await chip.textContent()).length).toBe(16);
    await expect(chip).toHaveAttribute('title', 'A'.repeat(40));
  });

  for (const [b, hoehe] of [[320, 568], [1280, 720]]) {
    test(`AK 8: 30 Commits bei ${b} x ${hoehe} — Leiste ≤ 40 % der Höhe und rollt; Wahl des 25. per Tastatur: Ring in der Leiste, Seite rollt nicht, kein Rücksprung`, async ({ page }) => {
      const s = seite(page);
      await breiteSetzen(page, b, hoehe);
      await commitOeffnen(page, k, 11, h.dreissig[0]);
      const masse = await s.leiste.evaluate(l => ({ hoehe: l.getBoundingClientRect().height, innen: innerHeight, rollt: l.scrollHeight > l.clientHeight }));
      expect(masse.hoehe).toBeLessThanOrEqual(0.4 * masse.innen + 1);
      expect(masse.rollt).toBe(true);
      const vorher = await rollen(page);
      const e25 = s.eintrag(h.dreissig[24]);
      await s.eintrag(h.dreissig[0]).focus();
      for (let i = 1; i < 25; i++) await page.keyboard.press('Tab');
      await expect(e25).toBeFocused();
      expect(await ringInnen(e25), 'Fokusring ganz in der Leiste').toBe(true);
      expect((await rollen(page)).fenster).toBe(vorher.fenster);
      await page.keyboard.press('Enter');
      await expect(s.pos()).toHaveText('25 von 30');
      await expect(s.eintrag(h.dreissig[24])).toBeFocused();
      expect(await ganzSichtbar(s.eintrag(h.dreissig[24])), 'kein Rücksprung').toBe(true);
      const nachher = await rollen(page);
      expect(nachher.leiste).toBeGreaterThan(0);
      expect(nachher.fenster).toBe(vorher.fenster);
      // Klick auf den gezeigten Eintrag ändert den Rollstand nicht
      await s.eintrag(h.dreissig[24]).click();
      expect(await rollen(page)).toEqual(nachher);
    });
  }

  test('AK 8: Neuzeichnen hält den Rollstand, ein gezeigter Eintrag unten wird beim Öffnen in den Blick gerollt', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 1280, 720);
    await commitOeffnen(page, k, 11, h.dreissig[29]);
    expect(await ganzSichtbar(s.eintrag(h.dreissig[29]))).toBe(true);
    expect((await rollen(page)).seite).toBe(0);
    await thema(page, 'dark');
    expect(await ganzSichtbar(s.eintrag(h.dreissig[29]))).toBe(true);
    await s.alle().click();
    await expect(page.locator('#rv-a0')).toBeVisible();
    expect((await rollen(page)).leiste).toBe(0);
  });

  test.describe('grober Zeiger', () => {
    test.use({ hasTouch: true, isMobile: true, viewport: { width: 640, height: 360 } });
    test('AK 8: 640 x 360 — Leiste ≤ 144 px und bricht in Zeilen um; jeder Eintrag ≥ 44 px', async ({ page }) => {
      const s = seite(page);
      await commitOeffnen(page, k, 11, h.dreissig[0]);
      const m = await s.leiste.evaluate(l => ({ hoehe: l.getBoundingClientRect().height, tops: new Set([...l.querySelectorAll('li > a')].map(a => Math.round(a.getBoundingClientRect().top))).size, klein: [...l.querySelectorAll('li > a')].filter(a => a.getBoundingClientRect().height < 44).length }));
      expect(m.hoehe).toBeLessThanOrEqual(144);
      expect(m.tops).toBeGreaterThan(1);
      expect(m.klein).toBe(0);
    });
  });

  test('AK 8: feiner Zeiger — jeder Eintrag ≥ 24 px hoch', async ({ page }) => {
    await commitOeffnen(page, k, 5, h.c1);
    const klein = await seite(page).eintraege.evaluateAll(as => as.filter(a => a.getBoundingClientRect().height < 24).length);
    expect(klein).toBe(0);
  });

  /* ── AK 9 Rand, Kontrast, Fokus ── */

  for (const farbe of ['light', 'dark']) {
    test(`AK 9: ${farbe} — Rand --kd-muted ≥ 3:1, gewählt mit --kd-accent-weak und 3 px --kd-accent, Text und Chips ≥ 4,5:1 in allen Zuständen, Ring sichtbar`, async ({ page }) => {
      const s = seite(page);
      await commitOeffnen(page, k, 5, h.c2);
      await thema(page, farbe);
      const stil = await page.evaluate(() => {
        const probe = wert => { const p = document.createElement('i'); p.style.color = wert; document.body.append(p); const c = getComputedStyle(p).color; p.remove(); return c; };
        const nicht = document.querySelector('#rv-ls li > a:not([aria-current])'), gew = document.querySelector('#rv-ls li > a[aria-current]');
        const sn = getComputedStyle(nicht), sg = getComputedStyle(gew);
        return {
          rand: sn.borderTopColor, muted: probe('var(--kd-muted)'), surface: probe('var(--kd-surface)'), accent: probe('var(--kd-accent)'), weak: probe('var(--kd-accent-weak)'),
          gewFlaeche: sg.backgroundColor, gewSchatten: sg.boxShadow, nichtSchatten: sn.boxShadow,
        };
      });
      expect(stil.rand).toBe(stil.muted);
      expect(await kontrastFarben(page, stil.muted, stil.surface)).toBeGreaterThanOrEqual(3);
      expect(stil.gewFlaeche).toBe(stil.weak);
      expect(stil.gewSchatten).toContain(stil.accent);
      expect(stil.gewSchatten).toMatch(/inset 0px -3px 0px|0px -3px 0px 0px inset/);
      expect(stil.nichtSchatten).not.toMatch(/-3px/);
      expect(await kontrastFarben(page, stil.accent, stil.surface)).toBeGreaterThanOrEqual(3);
      const fehler = [];
      const textPruefen = async wo => { for (const m of await kontrastMessen(page, ['#rv-ls'])) if (m.wert < 4.5) fehler.push(`${wo}: ${m.element} „${String(m.text).slice(0, 30)}“ ${m.wert.toFixed(2)}`); };
      await textPruefen('Ruhe');
      await s.eintrag(h.c1).hover();
      await textPruefen('Hover');
      const vorHover = await s.eintrag(h.c2).evaluate(e => getComputedStyle(e).backgroundColor);
      await s.eintrag(h.c2).hover();
      await textPruefen('gewählt + Hover');
      expect(await s.eintrag(h.c2).evaluate(e => getComputedStyle(e).backgroundColor)).toBe(vorHover);
      await page.mouse.move(0, 0);
      await s.eintrag(h.c3).focus();
      await textPruefen('Fokus');
      expect(fehler).toEqual([]);
      for (const e of [s.alle(), s.eintrag(h.c3)]) {
        await e.focus();
        expect(await e.evaluate(x => getComputedStyle(x).outlineStyle)).not.toBe('none');
        expect(await ringInnen(e)).toBe(true);
      }
    });
  }

  /* ── AK 10 Fremder Text ── */

  test('AK 10: C7 — Titel und Zweigname zeichengleich als Text bzw. mit Marke, kein img, window.pwn nicht gesetzt, kein Chip', async ({ page }) => {
    const s = seite(page);
    await commitOeffnen(page, k, 10, h.c7);
    const c7 = s.eintrag(h.c7);
    await expect(c7.locator('.t')).toHaveText(BOESE);
    await expect(c7).toHaveAttribute('title', BOESE);
    await expect(c7.locator('.rv-chip')).toHaveCount(0);
    await expect(s.ueberschrift()).toHaveText(BOESE);
    await expect(page.locator('#review img')).toHaveCount(0);
    expect(await page.evaluate(() => window.pwn)).toBeUndefined();
    await expect(s.zweige().locator('.mk-bidi')).toHaveCount(1);
    expect(await s.zweige().locator('.rv-br').first().textContent()).toBe(BIDI_ZWEIG.replace('\u202e', '⟨U+202E⟩'));
    expect(LANGER_TITEL.length).toBe(120);
  });
});
