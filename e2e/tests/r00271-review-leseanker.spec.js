// R00271 Review-Seite — Leseanker von „Umbrechen“ in der Nummernspalte (Karte #275, I0261, ADR-0042 Nachtrag N10): AK 1–4 und
// US-1..US-4 im echten Programm gegen echtes Git. Ausgangslage: review-hilfen.js (`leseankerRepository`, L1): K-Kurz (`src/kurz.rs`,
// nur kurze Zeilen) und ein zweigeteiltes K-Lang (`src/u.rs`) mit langen Zeilen in einem früheren Block derselben Datei.
// Schichten: Testfälle → Testsprache (`seite`) → Treiber (Selektoren, Messungen nur hier) → Programm.
// AK 4 (Mutant): KD_MUTANTE setzt den Messpunkt wieder in die Mitte der Rolle — AK 1 und AK 2 sterben dann; Vorbild r00248/r00249.
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen } = require('./hilfen');
const { leseankerRepository, leseankerVorbereiten } = require('./review-hilfen');

/* ── Treiber: Adressen, Selektoren, Messungen ── */

const commitAdresse = (k, nr, commit) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review?commit=${encodeURIComponent(`kd:${commit}`)}`;
const alleAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const exakt = text => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
const L = () => leseankerRepository();

function seite(page) {
  const eingabe = page.locator('#rv-umbr');
  const datei = pfad => page.locator('#rv-insel section.df').filter({ has: page.locator('.df-k .p', { hasText: pfad }) });
  const bereich = pfad => datei(pfad).locator('.df-sc');
  /** Die Zeile `art` (add/del) mit genau dem Zeilentext `text` (ohne Lesetext). */
  const zeile = (pfad, art, text) => bereich(pfad).locator(`tr.${art}`).filter({ has: page.locator('td.c', { hasText: exakt(`${art === 'add' ? 'hinzugefügt: ' : 'entfernt: '}${text}`) }) }).first();
  return {
    eingabe, datei, bereich, zeile,
    commitOeffnen: async (k, nr, commit) => {
      await page.goto(commitAdresse(k, nr, commit));
      await page.locator('#rv-insel .rv-gk, #review .rv-leer').first().waitFor();
    },
    alleOeffnen: async (k, nr) => {
      await page.goto(alleAdresse(k, nr));
      await page.locator('#rv-insel section.df').first().waitFor();
    },
  };
}

/** Zwei Bilder abwarten: erst danach ist der gescrollte Block `content-visibility:auto` gerechnet (ADR-0026 Regeln 1–3). */
const zweiBilder = page => page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
/** Rollt `#review` so, dass die Oberkante des Knotens `ziel` px unter der Oberkante der Rolle steht. */
const rollenAuf = (knoten, ziel) => knoten.evaluate((e, z) => { const r = document.getElementById('review'); r.scrollTop += e.getBoundingClientRect().top - r.getBoundingClientRect().top - z; }, ziel);
/** Lage der Tabellenzeile mit `data-z` im n-ten Code-Bereich; null, wenn es sie nicht gibt. */
const lageNachKennung = (page, n, z) => page.evaluate(([n, z]) => {
  const sc = document.querySelectorAll('#review .df-sc')[n];
  const c = sc && sc.querySelector(`[data-z="${z}"]`);
  return c ? c.closest('tr').getBoundingClientRect().top - document.getElementById('review').getBoundingClientRect().top : null;
}, [n, z]);
/** Der Anker, den `reviewLeseZeileMerken()` an der Oberkante von `#review` wählt (ADR-0042 N10); als reine Lesung der Messfunktion. */
const ankerMerken = page => page.evaluate(() => {
  const m = window.reviewLeseZeileMerken() || {};
  const a = m.anker;
  if (!a) return { art: 'kein Anker', tag: null, klasse: null, z: null, id: null };
  return { art: a.tagName, tag: a.tagName, klasse: a.className, z: a.querySelector && a.querySelector('[data-z]') ? a.querySelector('[data-z]').dataset.z : null, id: a.id || null };
});

test.describe('R00271 Review-Seite — Leseanker von „Umbrechen“ in der Nummernspalte', () => {
  let k;
  test.beforeEach(async ({ page, context }) => {
    await mutanteEinsetzen(context);
    k = await kanbanStarten(leseankerVorbereiten(L()));
    await alsPerson(page, 'sh');
  });
  test.afterEach(() => k.stoppen());

  /* ── AK 1 Der Anker ist eine Zeile (Hauptbeleg, US-1) ── */

  test('AK 1: 1280 px — der Leseanker an der Oberkante von #review ist eine Zeile (`tr`), nicht der Dateikopf', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 1280, 800);
    await s.commitOeffnen(k, 9, L().l1);
    const zeile = s.zeile(/\/kurz\.rs$/, 'add', 'let a = 2;');
    await expect(zeile).toBeVisible();
    await rollenAuf(zeile, 0);
    await zweiBilder(page);
    const merk = await ankerMerken(page);
    expect(merk.art, `Anker ist eine Zeile (heute: ${merk.art}.${merk.klasse})`).toBe('TR');
    expect(merk.z, 'die Zeile trägt eine data-z').not.toBeNull();
  });

  /* ── AK 2 Sichtbar bleibt die Lesezeile (US-1/US-2) ── */

  test('AK 2: 980 px — die kurze oberste Zeile bleibt beim Ein- und Ausschalten an ihrer Stelle (≤ 36 px), lange Zeilen darüber', async ({ page }) => {
    const s = seite(page);
    await breiteSetzen(page, 980, 800);
    await s.commitOeffnen(k, 9, L().l1);
    const zeile = s.zeile(/\/u\.rs$/, 'add', '// u 186 b');
    await expect(zeile).toBeAttached();
    const kenn = await zeile.evaluate(tr => { const z = tr.querySelector('[data-z]'); const sc = tr.closest('.df-sc'); return { n: Array.from(document.querySelectorAll('#review .df-sc')).indexOf(sc), z: Number(z.dataset.z) }; });
    expect(await page.evaluate(n => document.querySelectorAll('#review .df-sc')[n].querySelectorAll('.dz-b').length, kenn.n), 'die langen Zeilen stehen in einem früheren Block derselben Datei').toBeGreaterThan(1);
    for (const an of [true, false]) {
      await rollenAuf(zeile, 0);
      await zweiBilder(page);
      const davor = await lageNachKennung(page, kenn.n, kenn.z);
      expect(davor, 'die Lesezeile steht an der Oberkante').toBeGreaterThanOrEqual(-1);
      expect(davor).toBeLessThanOrEqual(36);
      await s.eingabe.evaluate(e => e.click());
      if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
      await zweiBilder(page);
      const danach = await lageNachKennung(page, kenn.n, kenn.z);
      expect(Math.abs(danach - davor), `${an ? 'an' : 'aus'}: davor ${davor} danach ${danach}`).toBeLessThanOrEqual(36);
    }
  });

  /* ── AK 3 Rückfall und Bestand (US-3) ── */

  test('AK 3: keine Zeile an der Oberkante — der Dateikopf bleibt, und in „Alle Änderungen“ greift der Rückfall #rv-a0', async ({ page }) => {
    const s = seite(page);
    await s.commitOeffnen(k, 9, L().l1);
    // (a) der Dateikopf von src/kurz.rs an der Oberkante: der Anker ist der Kopf, keine Zeile
    const kopf = s.datei(/\/kurz\.rs$/).locator('.df-k');
    await rollenAuf(kopf, 2);
    await zweiBilder(page);
    const a = await ankerMerken(page);
    expect(a.klasse, `Anker ist der Dateikopf (heute: ${a.art}.${a.klasse})`).toContain('df-k');
    for (const an of [true, false]) {
      await s.eingabe.evaluate(e => e.click());
      if (an) await expect(s.eingabe).toBeChecked(); else await expect(s.eingabe).not.toBeChecked();
      await zweiBilder(page);
      const oben = await kopf.evaluate(e => e.getBoundingClientRect().top - document.getElementById('review').getBoundingClientRect().top);
      expect(oben, `Rückfall Kopf bei ${an ? 'an' : 'aus'}`).toBeGreaterThanOrEqual(0);
      expect(oben).toBeLessThan(36);
      await rollenAuf(kopf, 2);
    }
    // (b) „Alle Änderungen“ ganz oben: an der Oberkante steht keine Zeile → der erste Abschnitt
    await s.alleOeffnen(k, 9);
    await page.evaluate(() => { document.getElementById('review').scrollTop = 0; });
    await zweiBilder(page);
    const b = await ankerMerken(page);
    expect(b.id, `Rückfall erster Abschnitt (heute: ${b.art}.${b.klasse})`).toBe('rv-a0');
  });
});
