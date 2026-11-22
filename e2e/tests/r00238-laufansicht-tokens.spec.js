// R00238 Laufansicht — Tokens je Lauf und je Schritt, teuerste Schritte (Karte #263, I0228) — AK 3–10 und US-1..US-5 im echten Programm.
// Ausgangslage wie R00234: Board `fabrik` aus laufansicht-hilfen.js; an #1 liegen T8 (12 Einträge, vier Antworten mit `tokens`), T9
// (20.001 Zeilen, jeder Aufruf mit `tokens` {aus: 10}), T1/T4/T5 aus R00234 und je nach Test ein Kosteneintrag. Antworten per
// `page.route` gehalten; Verneinungen erst nach einem sichtbaren Signal. Lage nur über getBoundingClientRect (Lehre #232).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, mutanteEinsetzen, liveBereit, breiteSetzen, thema, kontrastVerstoesse } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T1 } = require('./laufansicht-t1');
const { T8 } = require('./laufansicht-t8');

const T = {
  T8: 'planer@2026-11-22T10:00+01:00',
  T9: 'entwickler@2026-11-22T08:00+01:00',
  T1: 'planer@2026-11-21T23:30+01:00',
  T4: 'architekt@2026-11-21T23:40+01:00',
  T5: 'code-reviewer@2026-11-21T22:00+01:00',
  BREIT: 'planer@2026-11-22T12:00+01:00',
};
const KENNZAHLEN = '#lauf .lv-kz';
const TOKENS = `${KENNZAHLEN} > div:has(dt:text-is("Tokens"))`;
const KOSTEN = `${KENNZAHLEN} > div:has(dt:text-is("Kosten"))`;
const INSEL = '#lv-insel';
const STATUS = '#lv-status';
const GLIEDERUNG = '#lauf section.lv-gl';
// jeder Eintrag von „Teuerste Schritte“, gleich welches Element (Mutant m7 macht daraus einen Verweis)
const TEUER = '#lauf .lv-teu li > :first-child';

const zeile = lv.zeile;
const um = uhr => `2026-11-22T${uhr}+01:00`;
const tk = (ein, aus, cache_lesen, cache_schreiben) => ({ ein, aus, cache_lesen, cache_schreiben });
const t8Text = () => T8.map(zeile).join('');

/** T9: T3 aus R00234 (20.001 Zeilen), jeder Aufruf (ungerade Zeile) mit `tokens` {aus: 10}. */
function t9Text() {
  const beginn = Date.parse('2026-11-22T08:00:00+01:00');
  const zeit = k => new Date(beginn + (k - 1) * 1000).toISOString().replace('Z', '+00:00');
  const zeilen = [];
  for (let k = 1; k <= 20000; k++) {
    const aufruf = k % 2 === 1;
    zeilen.push(zeile(aufruf ? { zeit: zeit(k), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: `echo ${k}` }), tokens: { aus: 10 } }
      : { zeit: zeit(k), art: 'werkzeugergebnis', wer: 'werkzeug', text: String(k - 1) }));
  }
  zeilen.push(zeile({ zeit: zeit(20001), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' }));
  return zeilen.join('');
}
const t1Text = () => T1.map(zeile).join('');
const T4_TEXT = zeile({ zeit: '2026-11-21T23:40:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"true"}' })
  + zeile({ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Exit code 0' })
  + zeile({ zeit: 'gestern', art: 'nachricht', wer: 'agent', text: 'fertig' });
/** Eine Zeile mit „999 Tsd. neue Tokens“ und der Dauer „59 min 59 s“ (AK 10), dazu ein langer Pfad als teuerster Schritt. */
const LANGER_PFAD = '/home/entwickler/Projekte/.worktrees/kanband/karte-263/Dokumentation/Architektur/Aspekte/X00001-schreibweg-und-regeln-an-zuegen.md';
const BREIT_TEXT = zeile({ zeit: um('12:00:00'), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"cargo test"}', tokens: tk(0, 999, 0, 999000) })
  + zeile({ zeit: um('12:59:59'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' })
  + zeile({ zeit: um('13:00:01'), art: 'werkzeugaufruf', wer: 'agent', name: 'Read', text: JSON.stringify({ file_path: LANGER_PFAD }), tokens: tk(0, 10, 0, 5) })
  + zeile({ zeit: um('13:00:02'), art: 'werkzeugergebnis', wer: 'werkzeug', text: 'ok' });

/** Legt die genannten Läufe an #1 ab; T5 wird danach gelöscht (`fehlt`) und trägt seinen Kosteneintrag mit `tokens` 52.000. */
async function ablegen(k, ...laeufe) {
  const daten = { T8: t8Text, T9: t9Text, T1: t1Text, T4: () => T4_TEXT, T5: t1Text, BREIT: () => BREIT_TEXT };
  for (const lauf of laeufe) await lv.hochladen(k.adresse, 1, T[lauf], 'Detailplanung', lv.gz(daten[lauf]()));
  if (!laeufe.includes('T5')) return;
  await lv.buchen(k.adresse, 1, T.T5, 'Detailplanung', 0.42, 52000);
  const ordner = path.join(k.ordner, 'transkripte/0001');
  fs.rmSync(path.join(ordner, fs.readdirSync(ordner).find(n => n.startsWith('code-reviewer@'))));
}

const istTranskript = url => new URL(url).pathname.startsWith('/api/aufgaben/1/transkripte/');
/** Hält jedes `GET …/transkripte/<kennung>`, bis `freigeben()` es weiterlaufen lässt. */
async function halten(page) {
  const wartend = [];
  await page.route(url => istTranskript(url.href), async route => {
    await new Promise(r => wartend.push(r));
    return route.continue();
  });
  return {
    freigeben: async () => {
      await expect.poll(() => wartend.length, 'eine Anfrage ist gehalten').toBeGreaterThan(0);
      wartend.shift()();
    },
  };
}
/** Sichtbarer Text eines Elements: ohne Lesetext (vh), Leerraum zusammengefasst. */
const sichtbar = ort => ort.evaluate(el => {
  const kopie = el.cloneNode(true);
  kopie.querySelectorAll('.vh').forEach(v => v.remove());
  return kopie.textContent.replace(/\s+/g, ' ').trim();
});
const alleSichtbar = ort => ort.evaluateAll(els => els.map(el => {
  const kopie = el.cloneNode(true);
  kopie.querySelectorAll('.vh').forEach(v => v.remove());
  return kopie.textContent.replace(/\s+/g, ' ').trim();
}));
const zeileVon = (page, nr) => page.locator(`#lv-s${nr}`);
const angabe = (page, nr) => zeileVon(page, nr).locator('.tk');
const rechteck = (ort) => ort.evaluate(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, height: r.height }; });

test.describe('R00238 Laufansicht: Tokens', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  async function laufOeffnen(page, kennung) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(kennung)}`);
    await expect(page.locator('#lv-h1')).toBeVisible();
  }
  const gelesen = page => expect(page.locator(STATUS)).toHaveText(/^(Ende des Transkripts|Grenze erreicht.*|Das Transkript .*)$/);
  /** Wert und Zeile darunter der Kennzahl „Tokens“, sichtbar. */
  const tokensKopf = async page => ({ wert: await sichtbar(page.locator(`${TOKENS} dd .tw`)), quelle: await alleSichtbar(page.locator(`${TOKENS} dd .auf`)) });

  /* ── AK 3 Kopf ── */

  test('AK 3 · US-1: T8 ohne Kosteneintrag — „Tokens“ rechts neben „Kosten“ mit „239 Tsd.“ und „aus dem Transkript gezählt“, vorgelesen „239 Tausend“', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    const namen = await page.locator(`${KENNZAHLEN} > div dt`).allTextContents();
    expect(namen.slice(-2)).toEqual(['Kosten', 'Tokens']);
    expect(await tokensKopf(page)).toEqual({ wert: '239 Tsd.', quelle: ['aus dem Transkript gezählt'] });
    const kosten = await rechteck(page.locator(KOSTEN)), tokens = await rechteck(page.locator(TOKENS));
    expect(tokens.left).toBeGreaterThanOrEqual(kosten.right - 1);
    const snapshot = await page.locator(KENNZAHLEN).ariaSnapshot();
    expect(snapshot).toContain('239 Tausend');
    expect(snapshot).not.toContain('Tsd.');
    expect(await page.locator(`${KENNZAHLEN} [aria-label]`).count()).toBe(0);
  });

  test('AK 3 · US-1: T8 mit Kosteneintrag 0,95 USD und 1.234.567 Tokens — „1,2 Mio.“ ohne Satz, auch solange das Transkript gehalten wird', async ({ page }) => {
    await ablegen(k, 'T8');
    await lv.buchen(k.adresse, 1, T.T8, 'Detailplanung', 0.95, 1234567);
    const gehalten = await halten(page);
    await laufOeffnen(page, T.T8);
    await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
    expect(await tokensKopf(page)).toEqual({ wert: '1,2 Mio.', quelle: [] });
    await gehalten.freigeben();
    await gelesen(page);
    expect(await tokensKopf(page)).toEqual({ wert: '1,2 Mio.', quelle: [] });
    expect(await page.locator(KENNZAHLEN).ariaSnapshot()).toContain('1,2 Millionen');
  });

  test('AK 3: T8 mit Kosteneintrag ohne tokens — wieder „239 Tsd.“ mit „aus dem Transkript gezählt“', async ({ page }) => {
    await ablegen(k, 'T8');
    await lv.buchen(k.adresse, 1, T.T8, 'Detailplanung', 0.95);
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    await expect(page.locator(`${KOSTEN} dd`)).toHaveText(/^0,95\s\$$/);
    expect(await tokensKopf(page)).toEqual({ wert: '239 Tsd.', quelle: ['aus dem Transkript gezählt'] });
  });

  test('AK 3 · US-1: T9 an der Grenze — „mindestens 100 Tsd.“ mit „aus dem Transkript gezählt bis zur Grenze des Transkripts“', async ({ page }) => {
    await ablegen(k, 'T9');
    await laufOeffnen(page, T.T9);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    expect(await tokensKopf(page)).toEqual({ wert: 'mindestens 100 Tsd.', quelle: ['aus dem Transkript gezählt bis zur Grenze des Transkripts'] });
    expect(await page.locator(KENNZAHLEN).ariaSnapshot()).toContain('mindestens 100 Tausend');
  });

  test('AK 3: T5 (Transkript fehlt, Kosteneintrag mit 52.000) — „52 Tsd.“; T4 ohne beides — „–“, vorgelesen „Tokens unbekannt“', async ({ page }) => {
    await ablegen(k, 'T5', 'T4');
    await laufOeffnen(page, T.T5);
    await expect(page.locator('#lauf .lv-leer')).toContainText('Das Transkript liegt nicht auf diesem Rechner.');
    expect(await tokensKopf(page)).toEqual({ wert: '52 Tsd.', quelle: [] });
    await laufOeffnen(page, T.T4);
    await gelesen(page);
    expect(await tokensKopf(page)).toEqual({ wert: '–', quelle: [] });
    const snapshot = await page.locator(TOKENS).ariaSnapshot();
    expect(snapshot).not.toContain('–');
    // UX K1: die Beschriftung „Tokens“ steht vor dem Lesetext — so liest der echte Snapshot
    expect(snapshot).toBe('- term: Tokens\n- definition: Tokens unbekannt');
    expect(await page.locator(`${TOKENS} [aria-label]`).count()).toBe(0);
  });

  test('AK 3: T8 ohne Kosteneintrag, Antwort gehalten — „–“, vorgelesen „wird gelesen“', async ({ page }) => {
    await ablegen(k, 'T8');
    const gehalten = await halten(page);
    await laufOeffnen(page, T.T8);
    await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
    expect(await tokensKopf(page)).toEqual({ wert: '–', quelle: [] });
    expect(await page.locator(TOKENS).ariaSnapshot()).toBe('- term: Tokens\n- definition: wird gelesen');
    await gehalten.freigeben();
    await gelesen(page);
    expect(await tokensKopf(page)).toEqual({ wert: '239 Tsd.', quelle: ['aus dem Transkript gezählt'] });
  });

  /* ── AK 4, 5 Zeilen ── */

  test('AK 4 · US-3: T8 — neue Tokens an Nr 2, 5, 7, 12; Verweis an Nr 3, „Tokens unbekannt“ an Nr 9; keine Angabe an Nr 1, 11 und der Wartezeile', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    const erwartet = { 2: '18 Tsd. neue Tokens', 5: '35 Tsd. neue Tokens', 7: '451 neue Tokens', 12: '61 Tsd. neue Tokens', 3: '–', 9: '–' };
    for (const [nr, text] of Object.entries(erwartet)) expect(await sichtbar(angabe(page, nr)), `Nr ${nr}`).toBe(text);
    await expect(zeileVon(page, 2).locator('.lv-wer .tk')).toHaveCount(1);
    const fuenf = await zeileVon(page, 5).locator('summary').ariaSnapshot();
    expect(fuenf).toContain('35 Tausend neue Tokens');
    expect(fuenf).not.toContain('Tsd.');
    expect(await angabe(page, 3).ariaSnapshot()).toContain('Tokens in der Antwort darüber gezählt');
    expect(await angabe(page, 9).ariaSnapshot()).toContain('Tokens unbekannt');
    for (const ohne of ['#lv-s1', '#lv-s11', '#lv-s11-vor']) await expect(page.locator(`${ohne} .tk`), ohne).toHaveCount(0);
    await expect(page.locator('#lv-s11-vor')).toContainText('5 min 17 s wartet');
    await zeileVon(page, 5).locator('summary').click();
    await expect(zeileVon(page, 5).locator('.lv-s-ganz .k')).toHaveText(['Tokens', 'Aufruf', 'Ergebnis']);
    expect(await sichtbar(zeileVon(page, 5).locator('.lv-s-ganz .lv-tk4'))).toBe('Eingabe 1 · Cache-Schreiben 34.800 · Ausgabe 300 · Cache-Lesen 18.000');
    for (const nr of [3, 7, 9]) await expect(zeileVon(page, nr).locator('.lv-s-ganz .lv-tk4'), `Nr ${nr}`).toHaveCount(nr === 7 ? 1 : 0);
    expect(await page.locator(`${INSEL} .tk [aria-label]`).count()).toBe(0);
  });

  test('AK 4 · US-5: T1 ohne tokens — jede Zeile von agent „–“ mit „Tokens unbekannt“, keine Liste „Teuerste Schritte“, Kopf „–“', async ({ page }) => {
    await ablegen(k, 'T1');
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    await expect(page.locator('#lauf .lv-top')).toHaveCount(1);
    await expect(page.locator('#lauf .lv-teu')).toHaveCount(0);
    const agentZeilen = ['#lv-s3', '#lv-s5', '#lv-s7', '#lv-s8', '#lv-s11', '#lv-s14', '#lv-s15'];
    for (const z of agentZeilen) {
      expect(await sichtbar(page.locator(`${z} .tk`)), z).toBe('–');
      expect(await page.locator(`${z} .tk`).ariaSnapshot(), z).toContain('Tokens unbekannt');
    }
    await expect(page.locator(`${INSEL} .tk`)).toHaveCount(agentZeilen.length);
    expect(await tokensKopf(page)).toEqual({ wert: '–', quelle: [] });
    expect(await page.locator(TOKENS).ariaSnapshot()).toContain('Tokens unbekannt');
  });

  test('AK 5 · US-3: T8 — unter Nr 2 und Nr 12 ohne Aufklappen „Tokens“ mit den vier Werten, unter dem Text, vorgelesen mit Kommata', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    const unter = nr => zeileVon(page, nr).locator('.lv-tokens');
    expect(await sichtbar(unter(2))).toBe('Tokens Eingabe 3 · Cache-Schreiben 18.000 · Ausgabe 120 · Cache-Lesen 0');
    expect(await sichtbar(unter(12))).toBe('Tokens Eingabe 2 · Cache-Schreiben 60.000 · Ausgabe 1.500 · Cache-Lesen 53.200');
    for (const nr of [2, 12]) {
      const text = await rechteck(zeileVon(page, nr).locator('.lv-text')), linie = await rechteck(unter(nr));
      expect(linie.top, `Nr ${nr}`).toBeGreaterThanOrEqual(text.bottom - 0.5);
      expect(await unter(nr).evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(11);
    }
    expect(await unter(2).ariaSnapshot()).toContain('Tokens Eingabe 3, Cache-Schreiben 18.000, Ausgabe 120, Cache-Lesen 0');
    for (const nr of [1, 11]) await expect(unter(nr)).toHaveCount(0);
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      expect(await kontrastVerstoesse(page, ['#lv-s2 .lv-tokens', '#lv-s12 .lv-tokens']), farbe).toEqual([]);
    }
  });

  /* ── AK 6–8 Teuerste Schritte ── */

  test('AK 6 · US-4: T8 — „Teuerste Schritte“ unter „Längste Schritte“ mit Erklärsatz; 12, 5, 2 mit Anlass; Nr 7 fehlt', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    const satz = 'Gezählt sind die neuen Tokens je Antwort: Eingabe, Cache-Schreiben und Ausgabe. Den schon vorhandenen Kontext (Cache-Lesen) trägt jede Antwort, er zählt hier nicht.';
    await expect(page.locator(`${GLIEDERUNG} h2`)).toHaveText(['Längste Schritte', 'Teuerste Schritte']);
    const oben = await rechteck(page.locator('#lauf .lv-top')), unten = await rechteck(page.locator('#lauf .lv-teu'));
    expect(unten.top).toBeGreaterThanOrEqual(oben.bottom);
    expect(Math.abs(unten.left - oben.left)).toBeLessThan(1);
    expect((await page.locator(GLIEDERUNG).ariaSnapshot()).replace(/\s+/g, ' ')).toContain(satz);
    const beschrieben = await page.evaluate(() => {
      const id = document.querySelector('.lv-teu').getAttribute('aria-describedby');
      const ziel = id && document.getElementById(id);
      return ziel ? [ziel.textContent, ziel.closest('section.lv-gl') !== null] : null;
    });
    expect(beschrieben).toEqual([satz, true]);
    const eintraege = await page.locator(TEUER).evaluateAll(bs => bs.map(b => [...b.querySelectorAll('.was, .nach, .d')].map(t => {
      const kopie = t.cloneNode(true);
      kopie.querySelectorAll('.vh').forEach(v => v.remove());
      return kopie.textContent;
    })));
    expect(eintraege).toEqual([
      ['Nachricht von Agent', 'nach 5 min 17 s Warten', '61 Tsd. neue Tokens'],
      ['Bash grep -n tokens web/lauf.js', 'nach Read regeln.md', '35 Tsd. neue Tokens'],
      ['Read regeln.md', '18 Tsd. neue Tokens'],
    ]);
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      expect(await kontrastVerstoesse(page, ['#lauf .lv-gl']), farbe).toEqual([]);
    }
  });

  test('AK 6: T9 — die Antworten der Zeilen 1, 3 und 5 je „10 neue Tokens“ (Gleichstand, die frühere zuerst)', async ({ page }) => {
    await ablegen(k, 'T9');
    await laufOeffnen(page, T.T9);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    expect(await page.locator(TEUER).evaluateAll(bs => bs.map(b => b.dataset.arg))).toEqual(['lv-s1', 'lv-s3', 'lv-s5']);
    expect(await alleSichtbar(page.locator(`${TEUER} .d`))).toEqual(['10 neue Tokens', '10 neue Tokens', '10 neue Tokens']);
  });

  /** Zählt Änderungen im Statusbereich und in jeder aria-live-Region ab jetzt. */
  const ansagenBeobachten = page => page.evaluate(() => {
    window.kdAenderungen = 0;
    const LIVE = '[role=status],[role=alert],[aria-live]';
    new MutationObserver(eintraege => {
      for (const e of eintraege) {
        const ort = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        if (ort && ort.closest && ort.closest(LIVE)) window.kdAenderungen++;
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  const aenderungen = async page => {
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    return page.evaluate(() => window.kdAenderungen);
  };

  for (const wie of ['Klick', 'Enter', 'Leertaste']) {
    test(`AK 8 · US-4: ${wie} auf „Teuerste Schritte“ — Fokus auf der Trägerzeile unter dem Seitenkopf bei 320, 641, 1280 px; Adresse, Verlauf, Statusbereich bleiben`, async ({ page }) => {
      await ablegen(k, 'T8');
      for (const breite of [320, 641, 1280]) {
        for (const [i, ziel] of [[0, 'lv-s12'], [2, 'lv-s2']]) {
          await breiteSetzen(page, breite);
          await laufOeffnen(page, T.T8);
          await gelesen(page);
          await ansagenBeobachten(page);
          const vorher = await page.evaluate(() => [location.hash, history.length]);
          const knopf = page.locator(TEUER).nth(i);
          if (wie === 'Klick') await knopf.click();
          else { await knopf.focus(); await page.keyboard.press(wie === 'Enter' ? 'Enter' : 'Space'); }
          await expect.poll(() => page.evaluate(() => document.activeElement.id), `${breite} px`).toBe(ziel);
          await expect.poll(() => page.evaluate(() => {
            const kopf = document.querySelector('#kopf header').getBoundingClientRect().bottom;
            const oben = document.activeElement.getBoundingClientRect().top;
            return kopf <= oben && oben < innerHeight;
          }), `${breite} px ${ziel}`).toBe(true);
          expect(await page.evaluate(() => [location.hash, history.length])).toEqual(vorher);
          expect(await aenderungen(page)).toBe(0);
        }
      }
    });
  }

  test('AK 8: Knöpfe lv-teu-1 bis 3 ohne href, mit zugänglichem Namen; lv-top-1 bis 3 genau einmal; Nr 3 verweist auf die Antwort darüber', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    expect(await page.locator(TEUER).evaluateAll(bs => bs.map(b => [b.tagName, b.id, b.hasAttribute('href'), b.dataset.act, b.dataset.arg]))).toEqual([
      ['BUTTON', 'lv-teu-1', false, 'lauf-springe', 'lv-s12'], ['BUTTON', 'lv-teu-2', false, 'lauf-springe', 'lv-s5'], ['BUTTON', 'lv-teu-3', false, 'lauf-springe', 'lv-s2']]);
    for (const i of [1, 2, 3]) expect(await page.locator(`[id="lv-top-${i}"]`).count(), `lv-top-${i}`).toBe(1);
    const snapshot = await page.locator('#lauf .lv-teu').ariaSnapshot();
    expect(snapshot).toContain('button "Nachricht von Agent, 61 Tausend neue Tokens, nach 5 min 17 s Warten"');
    expect(snapshot).toContain('button "Bash grep -n tokens web/lauf.js, 35 Tausend neue Tokens, nach Read regeln.md"');
    expect(snapshot).toContain('button "Read regeln.md, 18 Tausend neue Tokens"');
    expect(await sichtbar(angabe(page, 3))).toBe('–');
    expect(await angabe(page, 3).ariaSnapshot()).toContain('Tokens in der Antwort darüber gezählt');
  });

  /* ── AK 9 Live ── */

  test('AK 9 · US-2: T8 offen — ein gebuchter Kosteneintrag mit tokens zeigt „1,2 Mio.“ und „0,95 $“ ohne neues Lesen; Insel, Klappe, Fokus bleiben', async ({ page }) => {
    await ablegen(k, 'T8');
    let lesen = 0;
    page.on('request', r => { if (r.method() === 'GET' && istTranskript(r.url())) lesen++; });
    await page.goto(`${k.adresse}#/board/fabrik`);
    await liveBereit(page);
    await page.evaluate(() => {
      window.kdAuswertungen = 0;
      const echt = window.laufAuswerten;
      window.laufAuswerten = (...a) => { window.kdAuswertungen++; return echt(...a); };
    });
    await page.evaluate(h => { location.hash = h; }, `#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(T.T8)}`);
    await gelesen(page);
    expect(await tokensKopf(page)).toEqual({ wert: '239 Tsd.', quelle: ['aus dem Transkript gezählt'] });
    await page.locator(INSEL).evaluate(el => { el.__probe = 1; });
    await zeileVon(page, 5).locator('summary').click();
    await zeileVon(page, 5).locator('summary').focus();
    await ansagenBeobachten(page);
    await lv.buchen(k.adresse, 1, T.T8, 'Detailplanung', 0.95, 1234567);
    await expect(page.locator(`${KOSTEN} dd`)).toHaveText(/^0,95\s\$$/);
    expect(await tokensKopf(page)).toEqual({ wert: '1,2 Mio.', quelle: [] });
    expect(await page.locator(INSEL).evaluate(el => el.__probe)).toBe(1);
    await expect(zeileVon(page, 5).locator('details')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => window.kdAuswertungen)).toBe(1);
    expect(lesen).toBe(1);
    expect(await aenderungen(page)).toBe(0);
    expect(await page.evaluate(() => document.activeElement.closest('#lv-s5') !== null && document.activeElement.tagName)).toBe('SUMMARY');
  });

  /* ── AK 10 Breite, Themen, Zugänglichkeit ── */

  /** Überläufe an Dokument, Bildlaufbehälter, jeder Zeile und den Knöpfen der Gliederung. */
  const ueberlaeufe = page => page.evaluate(() => {
    const zuBreit = el => el.scrollWidth > el.clientWidth;
    const aus = [];
    if (zuBreit(document.documentElement)) aus.push(`Dokument ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);
    if (zuBreit(document.getElementById('lauf'))) aus.push('#lauf');
    for (const el of document.querySelectorAll('#lv-insel > li, #lv-insel .lv-s, #lv-insel .lv-n, #lv-insel .tk, #lauf .lv-kz > div, #lauf .lv-gl button')) {
      if (zuBreit(el)) aus.push(`${el.closest('li[id]') ? el.closest('li[id]').id : ''} ${el.className} ${el.scrollWidth} > ${el.clientWidth}`);
    }
    return aus;
  });
  /** Lage der Angabe gegenüber Dauer und Name in der Zeile `nr`. */
  const lage = (page, nr) => page.locator(`#lv-s${nr} summary`).evaluate(s => {
    const r = el => el.getBoundingClientRect();
    const tk = r(s.querySelector('.tk')), du = r(s.querySelector('.du')), nm = r(s.querySelector('.nm'));
    const zeilenhoehe = parseFloat(getComputedStyle(s.querySelector('.tk')).lineHeight) || parseFloat(getComputedStyle(s.querySelector('.tk')).fontSize) * 1.25;
    const ueberlappt = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    return {
      darunter: tk.top >= du.bottom - 0.5,
      linksDaneben: tk.right <= du.left + 0.5 && tk.top < du.bottom && du.top < tk.bottom,
      zwischenNameUndDauer: tk.left >= nm.right - 0.5 && tk.right <= du.left + 0.5 && tk.top < nm.bottom && nm.top < tk.bottom,
      hoeheOk: tk.height <= 2 * zeilenhoehe + 0.5,
      ueberlappung: ueberlappt(tk, du) || ueberlappt(tk, nm) || ueberlappt(nm, du),
    };
  });

  test('AK 10: T8 — kein Querscrollen bei 320, 641, 980, 1280 px, hell und dunkel; Lage der Angabe von Nr 5 je Breite', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    const fehler = [];
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      for (const b of [320, 641, 980, 1280]) {
        await breiteSetzen(page, b);
        fehler.push(...(await ueberlaeufe(page)).map(x => `${farbe} ${b}: ${x}`));
      }
    }
    expect(fehler).toEqual([]);
    for (const b of [641, 980]) {
      await breiteSetzen(page, b);
      expect(await lage(page, 5), `${b} px`).toMatchObject({ darunter: true, ueberlappung: false });
    }
    for (const b of [981, 1100, 1280]) {
      await breiteSetzen(page, b);
      expect(await lage(page, 5), `${b} px`).toMatchObject({ linksDaneben: true, ueberlappung: false });
    }
    await breiteSetzen(page, 320);
    expect(await lage(page, 5), '320 px').toMatchObject({ zwischenNameUndDauer: true, ueberlappung: false });
    // DOM: die Dauer steht vor der Angabe (UX K4)
    expect(await page.locator('#lv-s5 summary').evaluate(s => Boolean(s.querySelector('.du').compareDocumentPosition(s.querySelector('.tk')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  });

  test('AK 10: „999 Tsd. neue Tokens“ mit „59 min 59 s“ bei 981, 1100 und 320 px — kein Querscrollen, höchstens zwei Zeilen, nichts überlappt; langer Pfad im Knopf umbrochen', async ({ page }) => {
    await ablegen(k, 'BREIT');
    await laufOeffnen(page, T.BREIT);
    await gelesen(page);
    expect(await sichtbar(angabe(page, 1))).toBe('999 Tsd. neue Tokens');
    await expect(zeileVon(page, 1).locator('.du')).toContainText('59 min 59 s');
    for (const b of [981, 1100, 320]) {
      await breiteSetzen(page, b);
      expect(await ueberlaeufe(page), `${b} px`).toEqual([]);
      expect(await lage(page, 1), `${b} px`).toMatchObject({ hoeheOk: true, ueberlappung: false });
      const knopf = await page.locator(TEUER).nth(1).evaluate(b => ({ breit: b.scrollWidth <= b.clientWidth, ueberlauf: [...b.querySelectorAll('*')].map(e => getComputedStyle(e).textOverflow).filter(t => t !== 'clip') }));
      expect(knopf, `${b} px`).toEqual({ breit: true, ueberlauf: [] });
      await expect(page.locator(TEUER).nth(1).locator('.was')).toHaveText(`Read ${LANGER_PFAD}`);
    }
  });

  test('AK 10: Kontrast ≥ 4,5:1 hell und dunkel — Angaben, Erklärsatz, „nach …“, Zeile „Tokens“, Kopf; jedes „–“ aria-hidden, kein aria-label', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    await zeileVon(page, 5).locator('summary').click();
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      expect(await kontrastVerstoesse(page, ['#kopf', '#lauf']), farbe).toEqual([]);
    }
    expect(await page.locator(`${INSEL} .tk .lv-leerwert`).evaluateAll(ls => ls.map(l => l.getAttribute('aria-hidden')))).toEqual(['true', 'true']);
    expect(await page.locator(`${INSEL} .tk[aria-label], ${INSEL} .tk [aria-label], ${TOKENS} [aria-label], #lauf .lv-teu [aria-label]`).count()).toBe(0);
  });

  test('AK 10: Ziele bei feinem Zeiger — Knöpfe von „Teuerste Schritte“ ≥ 24 px hoch', async ({ page }) => {
    await ablegen(k, 'T8');
    await laufOeffnen(page, T.T8);
    await gelesen(page);
    expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
    const hoehen = await page.locator(TEUER).evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(hoehen.length).toBe(3);
    expect(Math.min(...hoehen)).toBeGreaterThanOrEqual(24);
  });
});

test.describe('R00238 Laufansicht: Ziele bei grobem Zeiger', () => {
  test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  test('AK 10: Knöpfe von „Teuerste Schritte“ ≥ 48 px hoch', async ({ page }) => {
    await ablegen(k, 'T8');
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(T.T8)}`);
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const hoehen = await page.locator(TEUER).evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(hoehen.length).toBe(3);
    expect(Math.min(...hoehen)).toBeGreaterThanOrEqual(48);
  });
});
