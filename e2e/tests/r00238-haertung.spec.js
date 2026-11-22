// R00238 Härtung aus dem Code-Review von #263 (Sollte, mitgenommen in #253): der Anlass in „Teuerste Schritte“ erbt kein Polster vom
// globalen `.nach`, und eine Eingabe des Menschen (Rad, Taste) beendet das Nachführen nach einem Sprung (ADR-0041 N1 „Nach dem Bau“).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, alsPerson, mutanteEinsetzen, breiteSetzen } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T8 } = require('./laufansicht-t8');

const T8_KENNUNG = 'entwickler@2026-11-22T10:00+01:00';
const LANG = 'entwickler@2026-11-22T07:42+01:00';
const zeile = o => JSON.stringify(o) + '\n';
/** 360 Bash-Zeilen mit Absicht wie in R00234 „langer Lauf“; die längsten Schritte liegen bei Eintrag 120, 240 und 350. */
function langText() {
  const lang = { 120: 40, 240: 30, 350: 20 };
  let t = Date.parse('2026-11-22T07:42:00+01:00');
  const zeit = () => new Date(t).toISOString().replace('Z', '+00:00');
  const zeilen = [];
  for (let k = 1; k <= 360; k++) {
    zeilen.push(zeile({ zeit: zeit(), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: `cargo test teil_${k}`, description: `Teil ${k} der Suite fahren und nur die Zusammenfassung lesen, damit der Kontext knapp bleibt` }) }));
    t += (lang[k] || 1) * 1000;
    zeilen.push(zeile({ zeit: zeit(), art: 'werkzeugergebnis', wer: 'werkzeug', text: `test result: ok. ${k} passed` }));
    t += 1000;
  }
  return zeilen.join('');
}

test.describe('R00238 Härtung (#263 Code-Review, Sollte)', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  const oeffnen = async (page, kennung) => {
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(kennung)}`);
    await expect(page.locator('#lv-status')).toHaveText(/^(Ende des Transkripts|Grenze erreicht.*)$/);
  };

  test('„Teuerste Schritte“: der Anlass „nach …“ trägt kein Polster aus dem globalen .nach', async ({ page }) => {
    await lv.hochladen(k.adresse, 1, T8_KENNUNG, 'Entwicklung', lv.gz(T8.map(zeile).join('')));
    await oeffnen(page, T8_KENNUNG);
    const polster = await page.locator('#lauf .lv-teu .nach').evaluateAll(ns => ns.map(n => getComputedStyle(n).padding));
    expect(polster.length).toBeGreaterThan(0);
    expect(polster.every(p => p === '0px')).toBe(true);
  });

  /** Lage der Zielzeile: steht sie im Fenster unter dem Seitenkopf? */
  const imBlick = (page, id) => page.evaluate(ziel => {
    const kopf = document.querySelector('#kopf header').getBoundingClientRect().bottom, z = document.getElementById(ziel).getBoundingClientRect();
    return z.top >= kopf - 1 && z.top < innerHeight;
  }, id);

  for (const eingabe of ['Rad', 'Taste']) {
    test(`Nachführen: eine Eingabe (${eingabe}) direkt nach dem Sprung beendet es — die Seite bleibt, wohin der Mensch sie gerollt hat`, async ({ page }) => {
      await lv.hochladen(k.adresse, 1, LANG, 'Entwicklung', lv.gz(langText()));
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await breiteSetzen(page, 1280);
      await oeffnen(page, LANG);
      await page.locator('#lv-top-1').click();
      await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-s239');
      await expect.poll(() => imBlick(page, 'lv-s239')).toBe(true);
      // sofort danach, solange das Nachführen noch läuft (etwa 2 s): der Mensch rollt nach oben
      if (eingabe === 'Rad') {
        await page.mouse.move(640, 500);
        await page.mouse.wheel(0, -100000);
      } else {
        await page.keyboard.press('Home');
      }
      await expect.poll(() => page.locator('#lauf').evaluate(s => s.scrollTop), 'die Eingabe rollt nach oben').toBeLessThan(200);
      for (const warten of [500, 1500]) {
        await page.waitForTimeout(warten);
        expect(await imBlick(page, 'lv-s239'), `${warten} ms danach`).toBe(false);
        expect(await page.locator('#lauf').evaluate(s => s.scrollTop)).toBeLessThan(200);
      }
    });
  }
});
