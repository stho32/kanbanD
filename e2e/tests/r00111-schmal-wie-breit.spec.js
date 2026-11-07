// R00111 AK 8–10: jedes Fenster ist schmal so bedienbar wie breit (Fitness-Funktion ADR-0015, Karte #74)
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson } = require('./hilfen');
const { fensterDerAnwendung } = require('./ansichten');

const BREIT = { viewport: { width: 1280, height: 800 } };
const SCHMAL_UND_ZWISCHEN = [{ width: 414, height: 896 }, { width: 641, height: 896 }, { width: 768, height: 1024 }, { width: 844, height: 390 }];

const SPANNE = 'cost:\n  currency: USD\n  min: 0.60\n  max: 1.60\n  basis: Schätzung planer\n';
const KONFLIKT = '---\nid: 4\n<<<<<<< HEAD\ntitle: Kaputt\n=======\ntitle: Kaputt anders\n>>>>>>> zweig\n---\n';
const BESTAND = {
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\norigins:\n  - I0001\n---\nText der Aufgabe\n\n- [ ] erster Schritt\n',
  'aufgaben/0002-kosten-pruefen.md': `---\nid: 2\ntitle: Kosten prüfen\n${SPANNE}---\n`,
  'aufgaben/0003-altlast.md': '---\nid: 3\ntitle: Altlast\narchived: 2026-10-01\n---\n',
  'aufgaben/0004-kaputt.md': KONFLIKT,
};

/**
 * Bedienelemente, die schmal fehlen dürfen. Je Eintrag Selektor, Fenster (Anfang des Fensternamens), Grund (AK 10) und die
 * Breite, bis zu der er gilt (darüber ist das Element wie jedes andere zu sehen).
 * Die Probe schlägt Alarm, wenn ein Eintrag breit fehlt oder schmal sichtbar wird — dann ist er zu streichen.
 */
const AUSNAHMEN = [
  { selektor: '#vsc', fenster: 'Aufgabenfenster', grund: 'öffnet die Datei, deren Pfad (.mod-kopf .pfad) schmal ebenfalls fehlt (R00077)', bis: 640 },
];

const BEDIENELEMENTE = 'button, select, textarea, input:not([type=hidden]), a[href], [role=button], [role=checkbox], [role=radio], [role=menuitem], [role=tab], [role=switch]';
const MELDUNGSTRAEGER = '[role=alert], [role=status], [aria-live]';

let k;
test.afterEach(async () => { if (k) await k.stoppen(); k = null; });

/**
 * Misst ein Fenster: je sichtbarem Bedienelement und Meldungsträger ein Schlüssel (id, aria-label, title, Platzhalter oder Text),
 * dazu die Meldungsträger ohne Client-Rects und die getroffenen Ausnahmen mit ihrer Sichtbarkeit.
 * Sichtbar heißt: Client-Rects, nicht `visibility:hidden`, und von keinem Vorfahren mit `overflow` hidden/clip abgeschnitten;
 * ein Vorfahr, der scrollt, schneidet nicht ab, weil man das Element dorthin scrollen kann.
 */
function fensterMessen(fenster, ausnahmen) {
  return fenster.evaluate((dialog, { bedien, melder, ausnahmen }) => {
    const schneidet = w => w === 'hidden' || w === 'clip';
    const sichtbar = el => {
      const r = el.getBoundingClientRect();
      if (!el.getClientRects().length || r.width * r.height === 0 || getComputedStyle(el).visibility === 'hidden') return false;
      for (let v = el.parentElement; v && v !== document.body; v = v.parentElement) {
        const s = getComputedStyle(v), b = v.getBoundingClientRect();
        if (schneidet(s.overflowX) && (r.left < b.left - 0.5 || r.right > b.right + 0.5)) return false;
        if (schneidet(s.overflowY) && (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5)) return false;
        if (v === dialog) break;
      }
      return true;
    };
    const schluessel = el => el.id ? '#' + el.id : el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || el.textContent.trim().replace(/\s+/g, ' ') || el.tagName;
    const alle = [...dialog.querySelectorAll(bedien + ', ' + melder)];
    return {
      sichtbar: alle.filter(sichtbar).filter(el => !ausnahmen.some(sel => el.matches(sel))).map(schluessel),
      melderOhneRects: [...dialog.querySelectorAll(melder)].filter(el => !el.getClientRects().length).map(schluessel),
      ausnahmen: ausnahmen.map(sel => ({ selektor: sel, da: !!dialog.querySelector(sel), sichtbar: [...dialog.querySelectorAll(sel)].some(sichtbar) })),
    };
  }, { bedien: BEDIENELEMENTE, melder: MELDUNGSTRAEGER, ausnahmen: ausnahmen.map(a => a.selektor) });
}

/** Schlüssel, die breit öfter vorkommen als schmal (Mengen mit Vielfachheit). */
function fehlende(breit, schmal) {
  const rest = [...schmal];
  return breit.filter(s => { const i = rest.indexOf(s); if (i < 0) return true; rest.splice(i, 1); return false; });
}

/** Alarme der Ausnahmeliste (AK 10): breit nicht da oder schmal sichtbar. */
function alarme(breit, schmal, liste) {
  return liste.flatMap((e, i) => [
    ...(breit.ausnahmen[i].sichtbar ? [] : [`${e.selektor}: breit nicht sichtbar — Eintrag aus AUSNAHMEN streichen`]),
    ...(schmal.ausnahmen[i].sichtbar ? [`${e.selektor}: schmal sichtbar — Eintrag aus AUSNAHMEN streichen`] : []),
  ]);
}

async function seiteOeffnen(context) {
  const page = await context.newPage();
  await alsPerson(page, 'st');
  await page.goto(k.adresse + '#/board/entwicklung');
  await expect(page.locator('.ka[data-id="1"]')).toHaveCount(1);
  return page;
}

test('Abgleich: Fehlende zählen mit Vielfachheit, Ausnahmen schlagen bei breit fehlend und schmal sichtbar Alarm', () => {
  expect(fehlende(['a', 'b', 'b', 'c'], ['b', 'c', 'x'])).toEqual(['a', 'b']);
  expect(fehlende(['a'], ['a', 'a'])).toEqual([]);
  const liste = [{ selektor: '#vsc' }];
  const mit = (da, sichtbar) => ({ ausnahmen: [{ selektor: '#vsc', da, sichtbar }] });
  expect(alarme(mit(true, true), mit(true, false), liste)).toEqual([]);
  expect(alarme(mit(false, false), mit(true, false), liste)).toHaveLength(1);
  expect(alarme(mit(true, true), mit(true, true), liste)).toHaveLength(1);
  expect(AUSNAHMEN.every(a => a.selektor && a.fenster && a.grund && a.bis), 'jeder Eintrag nennt Selektor, Fenster, Grund und Breite').toBe(true);
  expect(AUSNAHMEN.map(a => a.selektor), 'heute genau ein Eintrag (AK 8)').toEqual(['#vsc']);
});

for (const { fenster: name, oeffnen } of fensterDerAnwendung()) {
  for (const viewport of SCHMAL_UND_ZWISCHEN) {
    test(`${name}: bei ${viewport.width} × ${viewport.height} mit Touch ist alles sichtbar, was bei 1280 px sichtbar ist`, async ({ browser }) => {
      k = await kanbanStarten(einrichten(BESTAND));
      const liste = AUSNAHMEN.filter(a => name.startsWith(a.fenster) && viewport.width <= a.bis);
      const breitKontext = await browser.newContext(BREIT);
      const schmalKontext = await browser.newContext({ viewport, isMobile: true, hasTouch: true });
      try {
        const breit = await fensterMessen(await oeffnen(await seiteOeffnen(breitKontext)), liste);
        const schmal = await fensterMessen(await oeffnen(await seiteOeffnen(schmalKontext)), liste);
        expect(breit.sichtbar.length, 'breit gibt es Bedienelemente').toBeGreaterThan(0);
        expect(fehlende(breit.sichtbar, schmal.sichtbar), 'schmal fehlt').toEqual([]);
        expect(schmal.melderOhneRects, 'Meldungsträger ohne Client-Rects').toEqual([]);
        expect(alarme(breit, schmal, liste)).toEqual([]);
      } finally {
        await breitKontext.close();
        await schmalKontext.close();
      }
    });
  }
}
