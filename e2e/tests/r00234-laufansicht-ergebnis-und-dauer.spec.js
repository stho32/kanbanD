// R00234 Laufansicht — Ergebnis und Dauer eines Laufs auf einen Blick (Karte #251, I0224, Scheibe A) — AK 1–10 im echten Programm.
// Ausgangslage: Board `fabrik` aus laufansicht-hilfen.js; an #1 liegen T1 (laufansicht-t1.js), T3, T4 und T5, über die API abgelegt,
// T5 danach gelöscht. Antworten per `page.route` gehalten und über ein Promise freigegeben; Verneinungen erst nach einem Signal.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { kanbanStarten, alsPerson, mutanteEinsetzen, liveBereit, reiter, breiteSetzen, thema, kontrastVerstoesse } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { T1 } = require('./laufansicht-t1');

const T = {
  T1: 'planer@2026-11-21T23:30+01:00',
  T3: 'entwickler@2026-11-21T08:00+01:00',
  T4: 'architekt@2026-11-21T23:40+01:00',
  T5: 'code-reviewer@2026-11-21T22:00+01:00',
};
const KOPF = '#lauf .lv-aw';
const GESAMT = '#lauf .lv-gd';
const KENNZAHLEN = '#lauf .lv-kz';
const INSEL = '#lv-insel';
const EINTRAEGE = `${INSEL} > li`;
const STATUS = '#lv-status';
const BERICHT = '#lauf .lv-ber';
const OHNE_BERICHT = '#lauf .lv-ohne-ber';
// jeder Eintrag von „Längste Schritte“, gleich welches Element (Mutant m7 macht daraus einen Verweis)
const TOP = '#lauf .lv-top li > :first-child';

const zeile = o => JSON.stringify(o) + '\n';
const t1Text = (aenderung = e => e) => T1.map((e, i) => zeile(aenderung({ ...e }, i + 1))).join('');
const um = (beginnMs, k) => new Date(beginnMs + (k - 1) * 1000).toISOString().replace('Z', '+00:00');
function t3Text() {
  const beginn = Date.parse('2026-11-21T08:00:00+01:00');
  const zeilen = [];
  for (let k = 1; k <= 20000; k++) {
    const aufruf = k % 2 === 1;
    zeilen.push(zeile(aufruf ? { zeit: um(beginn, k), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify({ command: `echo ${k}` }) }
      : { zeit: um(beginn, k), art: 'werkzeugergebnis', wer: 'werkzeug', text: String(k - 1) }));
  }
  zeilen.push(zeile({ zeit: um(beginn, 20001), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' }));
  return zeilen.join('');
}
const T4_TEXT = zeile({ zeit: '2026-11-21T23:40:00+01:00', art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: '{"command":"true"}' })
  + zeile({ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'Exit code 0' })
  + zeile({ zeit: 'gestern', art: 'nachricht', wer: 'agent', text: 'fertig' });

/** T1, T3, T4, T5 an #1 ablegen, Kosten für T1 und T5 buchen, danach die Datei von T5 löschen. */
async function ablegen(k, t1 = t1Text()) {
  await lv.hochladen(k.adresse, 1, T.T1, 'Detailplanung', lv.gz(t1));
  await lv.hochladen(k.adresse, 1, T.T3, 'Entwicklung', lv.gz(t3Text()));
  await lv.hochladen(k.adresse, 1, T.T4, 'Entwicklung', lv.gz(T4_TEXT));
  await lv.hochladen(k.adresse, 1, T.T5, 'Reviews', lv.gz(t1Text()));
  await lv.buchen(k.adresse, 1, T.T1, 'Detailplanung', 1.79);
  await lv.buchen(k.adresse, 1, T.T5, 'Reviews', 0.42);
  const ordner = path.join(k.ordner, 'transkripte/0001');
  fs.rmSync(path.join(ordner, fs.readdirSync(ordner).find(n => n.startsWith('code-reviewer@'))));
}

const istTranskript = url => new URL(url).pathname.startsWith('/api/aufgaben/1/transkripte/');
/** Hält jedes `GET …/transkripte/<kennung>`, bis `freigeben(wie)` es beantwortet: `'weiter'` oder `{status, json}`. */
async function halten(page) {
  const wartend = [];
  await page.route(url => istTranskript(url.href), async route => {
    const wie = await new Promise(r => wartend.push(r));
    if (wie === 'weiter') return route.continue();
    return route.fulfill({ status: wie.status, json: wie.json });
  });
  return {
    freigeben: async (wie = 'weiter') => {
      await expect.poll(() => wartend.length, 'eine Anfrage ist gehalten').toBeGreaterThan(0);
      wartend.shift()(wie);
    },
  };
}
const ohneLeerraum = t => t.replace(/\s+/g, ' ').trim();
/** Kennzahlen als Paare [Name, sichtbarer Wert]. */
const kennzahlen = page => page.locator(`${KENNZAHLEN} > div`).evaluateAll(ds => ds.map(d => {
  const wert = d.querySelector('dd').cloneNode(true);
  wert.querySelectorAll('.vh').forEach(v => v.remove());
  return [d.querySelector('dt').textContent, wert.textContent.replace(/\s+/g, ' ').trim()];
}));
/** Sichtbarer Text der Gesamtdauer: ohne Lesetext (vh), je Teil durch ein Leerzeichen getrennt. */
const gesamtSichtbar = page => page.locator(GESAMT).evaluate(g => [...g.children].filter(c => !c.classList.contains('vh')).map(c => {
  const teil = c.cloneNode(true);
  teil.querySelectorAll('.vh').forEach(v => v.remove());
  return teil.textContent;
}).join(' ').replace(/\s+/g, ' ').trim());

test.describe('R00234 Laufansicht: Ergebnis und Dauer', () => {
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

  /* ── AK 1–3 Kopf und Kennzahlen ── */

  test('AK 1 · US-1: T1 — Gesamtdauer 2 min 30 s mit Werkzeuge 13 s · Denken 1 min 11 s · Warten 1 min 6 s', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    expect(ohneLeerraum(await page.locator(GESAMT).innerText())).toBe('GESAMTDAUER 2 min 30 s Werkzeuge 13 s · Denken 1 min 11 s · Warten 1 min 6 s');
  });

  test('AK 2 · US-4: T3 an der Grenze „mindestens 5 h 33 min“; T4 „Dauer unbekannt“ ohne Aufteilung und ohne „Längste Schritte“', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T3);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    expect(ohneLeerraum(await page.locator(GESAMT).innerText())).toBe('GESAMTDAUER mindestens 5 h 33 min gerechnet bis zur Grenze des Transkripts Werkzeuge 2 h 46 min · Denken 2 h 46 min');
    await laufOeffnen(page, T.T4);
    await gelesen(page);
    expect(ohneLeerraum(await page.locator(GESAMT).innerText())).toBe('GESAMTDAUER Dauer unbekannt Weniger als zwei Einträge tragen eine Zeit.');
    await expect(page.locator('#lauf .lv-top')).toHaveCount(0);
    await expect(page.locator(`${INSEL} .lv-s .du`)).toHaveText([/^–Dauer unbekannt$/]);
    await expect(page.locator(`${INSEL} .du i`)).toHaveCount(0);
  });

  for (const fall of ['T5 fehlt', 'T1 mit 503', 'T1 gehalten']) {
    test(`AK 2, AK 3 · US-5: ${fall} — Gesamtdauer und Kennzahlen „–“, Kosten aus der Karte; vorgelesen ohne „–“ und ohne aria-label`, async ({ page }) => {
      await ablegen(k);
      const gehalten = fall === 'T5 fehlt' ? null : await halten(page);
      await laufOeffnen(page, fall === 'T5 fehlt' ? T.T5 : T.T1);
      if (fall === 'T1 mit 503') await gehalten.freigeben({ status: 503, json: { fehler: 'Antwortbudget erschöpft' } });
      if (fall === 'T1 gehalten') await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
      else await gelesen(page);
      const kosten = fall === 'T5 fehlt' ? '0,42 $' : '1,79 $';
      expect(await kennzahlen(page)).toEqual([['Ergebnis', '–'], ['Werkzeugaufrufe', '–'], ['Fehler erkannt', '–'], ['Commits', '–'], ['Kosten', kosten], ['Tokens', '–']], 'R00238: Tokens dahinter');
      expect(await gesamtSichtbar(page)).toBe('Gesamtdauer –');
      const lesetext = fall === 'T1 gehalten' ? 'wird gelesen' : 'nicht verfügbar';
      const snapshot = await page.locator(KOPF).ariaSnapshot();
      expect(snapshot).not.toContain('–');
      for (const name of ['Gesamtdauer', 'Ergebnis', 'Werkzeugaufrufe', 'Fehler erkannt', 'Commits']) expect(snapshot).toMatch(new RegExp(`${name}[\\s\\S]*?${lesetext}`, 'i'));
      // R00238: beim Lesen sagt auch die Kennzahl „Tokens“ „wird gelesen“, ohne Einträge sonst „Tokens unbekannt“
      expect(snapshot.split(lesetext).length - 1).toBe(fall === 'T1 gehalten' ? 6 : 5);
      expect(snapshot.replace(/ /g, ' ')).toContain(kosten);
      expect(await page.locator(`${KOPF} [aria-label]`).count()).toBe(0);
      if (fall === 'T5 fehlt') await expect(page.locator('#lauf .lv-leer')).toContainText('Das Transkript liegt nicht auf diesem Rechner.');
      if (fall === 'T1 gehalten') await gehalten.freigeben();
    });
  }

  test('AK 3 · US-1: T1 Kennzahlen bestanden, 6, 2, 1, 1,79 $; T4 –, 1, 0, –, – vorgelesen „kein Bericht erkannt“, „kein Kosteneintrag“; kein Betrag in der Leiste, „Läufe“ behält ihn', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    expect(await kennzahlen(page)).toEqual([['Ergebnis', 'bestanden'], ['Werkzeugaufrufe', '6'], ['Fehler erkannt', '2'], ['Commits', '1'], ['Kosten', '1,79 $'], ['Tokens', '–']], 'R00238: Tokens dahinter');
    await expect(page.locator('#lauf .lv-leiste')).not.toContainText('BETRAG');
    await laufOeffnen(page, T.T4);
    await gelesen(page);
    expect(await kennzahlen(page)).toEqual([['Ergebnis', '–'], ['Werkzeugaufrufe', '1'], ['Fehler erkannt', '0'], ['Commits', '–'], ['Kosten', '–'], ['Tokens', '–']], 'R00238: Tokens dahinter');
    await expect(page.locator('#lauf .lv-leiste')).not.toContainText('BETRAG');
    const snapshot = await page.locator(KENNZAHLEN).ariaSnapshot();
    expect(snapshot).not.toContain('–');
    expect(snapshot).toMatch(/Ergebnis[\s\S]*kein Bericht erkannt[\s\S]*Commits[\s\S]*kein Bericht erkannt[\s\S]*Kosten[\s\S]*kein Kosteneintrag/);
    expect(await page.locator(`${KENNZAHLEN} [aria-label]`).count()).toBe(0);
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1`);
    await liveBereit(page);
    await reiter(page, 'Läufe');
    await expect(page.locator(`#fenster tr:has(a.lf-an[data-arg="${T.T1}"]) .lf-be`)).toHaveText(/1,79\s\$/);
  });
  /* ── AK 4–8 Bericht und Einträge ── */

  const zeileVon = (page, nr) => page.locator(`#lv-s${nr}`);
  const summaryVon = (page, nr) => zeileVon(page, nr).locator('summary');

  test('AK 4 · US-1: T1 — Karte „Bericht“ mit dem Text aus Nr 15 vor dem ersten Eintrag, außerhalb der Liste; T3 und T4 gedämpft „Kein Bericht erkannt“', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    const bericht = page.locator(BERICHT);
    await expect(bericht.getByRole('heading', { name: 'Bericht' })).toBeVisible();
    await expect(bericht).toContainText('R00229 angelegt.');
    await expect(bericht).toContainText('Ergebnis: bestanden');
    await expect(bericht).toContainText('Commits: f9e808a6');
    await expect(bericht).not.toContainText('mitten im Satz');
    expect(await page.locator(INSEL).locator('.lv-ber').count()).toBe(0);
    const vorDerListe = await page.evaluate(() => {
      const b = document.querySelector('#lauf .lv-ber'), ol = document.getElementById('lv-insel');
      return !ol.contains(b) && Boolean(b.compareDocumentPosition(ol) & Node.DOCUMENT_POSITION_FOLLOWING) && b.getBoundingClientRect().bottom <= ol.getBoundingClientRect().top;
    });
    expect(vorDerListe).toBe(true);
    for (const kennung of [T.T3, T.T4]) {
      await laufOeffnen(page, kennung);
      await gelesen(page);
      await expect(page.locator(OHNE_BERICHT)).toHaveText('Kein Bericht erkannt: Keine Nachricht des Agenten enthält eine Zeile „Ergebnis:“.');
      await expect(page.locator(BERICHT)).toHaveCount(0);
      // gedämpft: in der Farbe der Beschriftungen (--kd-muted), nicht in der Textfarbe
      expect(await page.locator(OHNE_BERICHT).evaluate(p => getComputedStyle(p).color)).toBe(await page.locator(`${GESAMT} .k`).evaluate(k => getComputedStyle(k).color));
    }
  });

  test('AK 5 · US-2: T1 — Nr 3 mit Nr 4 eine Zeile mit Befehl in Festbreite, Absicht, Kürzel und 4 s; parallel, „–“, Balken; aufgeklappt beide Texte', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    const z3 = summaryVon(page, 3);
    await expect(z3.locator('.nm')).toHaveText('Bash');
    await expect(z3.locator('.bf')).toHaveText('ls Anforderungen | tail -2');
    expect(await z3.locator('.bf').evaluate(b => getComputedStyle(b).fontFamily)).toMatch(/mono/i);
    await expect(z3.locator('.ab')).toHaveText('Nächste freie Nummer');
    expect((await z3.locator('.ab').boundingBox()).y).toBeGreaterThanOrEqual((await z3.locator('.bf').boundingBox()).y + 1);
    await expect(z3.locator('.eg')).toHaveText('R00228-wackler-unter-last.md');
    await expect(z3.locator('.du')).toHaveText('4 s');
    await expect(zeileVon(page, 4)).toHaveCount(0);
    await expect(summaryVon(page, 5).locator('.ab')).toHaveCount(0);
    for (const [nr, dauer] of [[7, '2 s'], [8, '3 s']]) {
      await expect(summaryVon(page, nr).locator('.par')).toHaveText('parallel');
      await expect(summaryVon(page, nr).locator('.du')).toHaveText(dauer);
    }
    for (const nr of [11, 15]) {
      await expect(summaryVon(page, nr).locator('.du')).toHaveText(/–/);
      await expect(summaryVon(page, nr).locator('.du i')).toHaveCount(0);
    }
    const breite = nr => summaryVon(page, nr).locator('.du i').evaluate(i => [i.style.width, i.getAttribute('aria-hidden')]);
    expect(await breite(3)).toEqual(['6%', 'true']);
    expect(await breite(8)).toEqual(['5%', 'true']);
    expect(await summaryVon(page, 3).ariaSnapshot()).not.toMatch(/%/);
    expect(await zeileVon(page, 11).ariaSnapshot()).toContain('Dauer unbekannt');
    expect(await zeileVon(page, 15).ariaSnapshot()).toContain('kein Ergebnis');
    await z3.click();
    const ganz = zeileVon(page, 3).locator('.lv-s-ganz');
    await expect(ganz.locator('pre').nth(0)).toHaveText('{"command":"ls Anforderungen | tail -2","description":"Nächste freie Nummer"}');
    await expect(ganz.locator('pre').nth(1)).toHaveText('R00228-wackler-unter-last.md\nR00229-frei.md');
    await expect(ganz.locator('.k')).toHaveText(['Aufruf', 'Ergebnis']);
  });

  test('AK 5: ein Befehl mit erster Zeile aus 250 Zeichen zeigt 200 davon und „…“', async ({ page }) => {
    await ablegen(k, t1Text((e, nr) => (nr === 3 ? { ...e, text: JSON.stringify({ command: 'x'.repeat(250) + '\nzweite', description: 'lang' }) } : e)));
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    await expect(summaryVon(page, 3).locator('.bf')).toHaveText('x'.repeat(200) + '…');
  });

  test('AK 6 · US-2: Nr 5 und Nr 8 rot mit Warnzeichen und vorgelesen „Fehler: …“; Nr 3 und Nr 11 nicht; Warnzeichen unter forced-colors sichtbar', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    const axName = async nr => {
      const cdp = await page.context().newCDPSession(page);
      const { root } = await cdp.send('DOM.getDocument');
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `#lv-s${nr} > details > summary` });
      const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
      await cdp.detach();
      return nodes[0].name.value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    };
    const name5 = await axName(5);
    expect(name5.startsWith('Bash')).toBe(true);
    expect(name5).toContain('Fehler: Exit code 1');
    expect(name5.endsWith('1 s')).toBe(true);
    const name8 = await axName(8);
    expect(name8).toContain('Fehler: ');
    expect(name8).toContain('File does not exist.');
    for (const nr of [3, 11]) expect(await axName(nr)).not.toContain('Fehler');
    for (const nr of [5, 8]) {
      await expect(zeileVon(page, nr).locator('details')).toHaveClass(/\bfehl\b/);
      await expect(summaryVon(page, nr).locator('.eg svg')).toHaveAttribute('aria-hidden', 'true');
    }
    for (const nr of [3, 11]) await expect(zeileVon(page, nr).locator('details')).not.toHaveClass(/\bfehl\b/);
    await page.emulateMedia({ forcedColors: 'active' });
    const zeichen = await summaryVon(page, 5).locator('.eg svg').evaluate(svg => [getComputedStyle(svg).display, svg.getBoundingClientRect().width]);
    expect(zeichen[0]).not.toBe('none');
    expect(zeichen[1]).toBeGreaterThan(0);
  });

  test('AK 7 · US-2: genau vier Denk- und Wartezeilen in T1, je ein Listeneintrag mit Text; die Liste hat 14 Einträge', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    await expect(page.locator(`${INSEL} > li.lv-d`)).toHaveText(['21 s denkt', '5 s denkt', '1 min 5 s wartet', '38 s denkt']);
    for (const [vor, text] of [[3, '21 s denkt'], [7, '5 s denkt'], [13, '1 min 5 s wartet'], [15, '38 s denkt']]) {
      const naechste = await page.locator(`#lv-s${vor}-vor`).evaluate(li => li.nextElementSibling.id);
      expect(naechste).toBe(`lv-s${vor}`);
      await expect(page.locator(`#lv-s${vor}-vor`)).toHaveText(text);
    }
    for (const nr of [5, 2, 14]) await expect(page.locator(`#lv-s${nr}-vor`)).toHaveCount(0);
    await expect(page.locator(`${INSEL} > li:not(.lv-ende)`)).toHaveCount(14);
    const snapshot = await page.locator(INSEL).ariaSnapshot();
    expect(snapshot.split('- listitem: 21 s denkt').length - 1).toBe(1);
    expect(await page.locator(`${INSEL} > li.lv-d[aria-hidden]`).count()).toBe(0);
  });

  test('AK 8 · US-2: Nr 1 eingeklappt als „Auftrag“, Nr 2 als „Systemhinweis“, aufklappbar; Nr 13 offen', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    for (const [nr, wort] of [[1, 'Auftrag'], [2, 'Systemhinweis']]) {
      const d = zeileVon(page, nr).locator('details');
      await expect(d).not.toHaveAttribute('open', '');
      await expect(d.locator('summary .nm')).toHaveText(wort);
      await d.locator('summary').click();
      await expect(d).toHaveAttribute('open', '');
    }
    await expect(zeileVon(page, 2).locator('.lv-text')).toContainText('<system-reminder>Lies zuerst');
    await expect(zeileVon(page, 13).locator('details')).toHaveCount(0);
    await expect(zeileVon(page, 13)).toContainText('Bitte weiter.');
  });
  /* ── AK 9 Längste Schritte, AK 10 Live ── */

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

  test('AK 9 · US-3: T1 — Längste Schritte 1 min 5 s, 38 s, 21 s mit „wartet · vor …“ und „denkt · vor …“; T3 Zeilen 1, 3, 5 je 1 s', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    await expect(page.locator(TOP)).toHaveText([/^wartet · vor .*1 min 5 s$/, /^denkt · vor .*38 s$/, /^denkt · vor .*21 s$/]);
    expect(await page.locator(TOP).evaluateAll(bs => bs.map(b => b.dataset.arg))).toEqual(['lv-s13-vor', 'lv-s15-vor', 'lv-s3-vor']);
    await expect(page.locator('#lauf .lv-gl h2')).toHaveText('Längste Schritte');
    await laufOeffnen(page, T.T3);
    await expect(page.locator(STATUS)).toHaveText(/^Grenze erreicht/);
    expect(await page.locator(TOP).evaluateAll(bs => bs.map(b => [b.dataset.arg, b.querySelector('.d').textContent]))).toEqual([['lv-s1', '1 s'], ['lv-s3', '1 s'], ['lv-s5', '1 s']]);
  });

  for (const wie of ['Klick', 'Enter', 'Leertaste']) {
    test(`AK 9 · US-3: ${wie} auf den ersten Eintrag — Fokus auf der Wartezeile vor Nr 13 unter dem Seitenkopf bei 320, 641, 1280 px; Adresse, Verlauf und Statusbereich bleiben`, async ({ page }) => {
      await ablegen(k);
      for (const breite of [320, 641, 1280]) {
        await breiteSetzen(page, breite);
        await laufOeffnen(page, T.T1);
        await gelesen(page);
        await ansagenBeobachten(page);
        const vorher = await page.evaluate(() => [location.hash, history.length]);
        const knopf = page.locator(TOP).first();
        if (wie === 'Klick') await knopf.click();
        else { await knopf.focus(); await page.keyboard.press(wie === 'Enter' ? 'Enter' : 'Space'); }
        await expect.poll(() => page.evaluate(() => document.activeElement.id)).toBe('lv-s13-vor');
        await expect.poll(() => page.evaluate(() => {
          const kopf = document.querySelector('#kopf header').getBoundingClientRect().bottom;
          const oben = document.activeElement.getBoundingClientRect().top;
          return kopf <= oben && oben < innerHeight;
        }), `${breite} px`).toBe(true);
        expect(await page.evaluate(() => [location.hash, history.length])).toEqual(vorher);
        expect(await aenderungen(page)).toBe(0);
        if (wie === 'Klick') {
          const ring = await page.evaluate(() => { const st = getComputedStyle(document.activeElement); return [st.outlineStyle, parseFloat(st.outlineWidth)]; });
          expect(ring[0]).not.toBe('none');
          expect(ring[1]).toBeGreaterThanOrEqual(2);
        }
      }
    });
  }

  test('AK 9: unter prefers-reduced-motion springt die Seite ohne Animation — scrollY bzw. scrollTop hat im ersten Bild den Endwert', async ({ page }) => {
    await ablegen(k);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await breiteSetzen(page, 320);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    const ausserhalb = await page.evaluate(() => document.getElementById('lv-s13-vor').getBoundingClientRect().top > innerHeight);
    expect(ausserhalb, 'das Ziel liegt vor dem Sprung außerhalb des Fensters').toBe(true);
    const stand = await page.evaluate(() => new Promise(fertig => {
      const seite = document.getElementById('lauf');
      document.querySelector('#lauf .lv-top li > :first-child').click();
      requestAnimationFrame(() => {
        const erstes = [scrollY, seite.scrollTop];
        setTimeout(() => fertig({ erstes, ende: [scrollY, seite.scrollTop] }), 600);
      });
    }));
    expect(stand.erstes).toEqual(stand.ende);
    expect(stand.ende[0] + stand.ende[1]).toBeGreaterThan(0);
  });

  /* ── AK 9 auf einem langen Lauf (Nacharbeit 2, Befund Entwicklertest US-3): 360 Bash-Zeilen mit Absicht, je etwa 82 px wie im
     echten Lauf; die drei längsten Schritte liegen bei Eintrag 120, 240 und 350. Frische Seite je Sprung, geprüft nach 1 s und 3 s. */
  const LANG = 'entwickler@2026-11-22T07:42+01:00';
  const LANG_ZIELE = ['lv-s239', 'lv-s479', 'lv-s699'];
  function langText() {
    const lang = { 120: 40, 240: 30, 350: 20 };
    let t = Date.parse('2026-11-22T07:42:00+01:00');
    const zeit = () => new Date(t).toISOString().replace('Z', '+00:00');
    const zeilen = [];
    for (let k = 1; k <= 360; k++) {
      const befehl = { command: `cd /home/entwickler/Projekte/.worktrees/kanband/karte-251 && export CARGO_TARGET_DIR=/home/entwickler/.cache/kanband/target-251; nice -n 10 cargo test --quiet -p kanband teil_${k} 2>&1 | tail -n 40`, description: `Teil ${k} der Suite gedrosselt fahren, nur die Zusammenfassung und die Fehler lesen, damit der Kontext knapp bleibt und der Lauf vergleichbar ist` };
      zeilen.push(zeile({ zeit: zeit(), art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: JSON.stringify(befehl) }));
      t += (lang[k] || 1) * 1000;
      zeilen.push(zeile({ zeit: zeit(), art: 'werkzeugergebnis', wer: 'werkzeug', text: `test result: ok. ${k} passed` }));
      t += 1000;
    }
    zeilen.push(zeile({ zeit: zeit(), art: 'nachricht', wer: 'agent', text: 'Ergebnis: bestanden' }));
    return zeilen.join('');
  }
  /** Lage der Zielzeile gegen Seitenkopf und Fenster, dazu der Fokus. */
  const imBlick = (page, ziel) => page.evaluate(id => {
    const kopf = document.querySelector('#kopf header').getBoundingClientRect().bottom;
    const z = document.getElementById(id).getBoundingClientRect();
    return { fokus: document.activeElement.id, obenUnterKopf: z.top >= kopf, untenImFenster: z.bottom <= innerHeight, oben: Math.round(z.top), kopf: Math.round(kopf) };
  }, ziel);
  for (const [i, ziel] of LANG_ZIELE.entries()) {
    for (const wie of ['Klick', 'Enter']) {
      test(`AK 9 · US-3: langer Lauf — ${wie} auf Eintrag ${i + 1} von „Längste Schritte“ holt ${ziel} nach 1 s und 3 s unter den Seitenkopf, Fokus auf der Zeile; Scrollstart 0, 8000, 20000`, async ({ page }) => {
        test.setTimeout(90000);
        await lv.hochladen(k.adresse, 1, LANG, 'Entwicklung', lv.gz(langText()));
        await breiteSetzen(page, 1280);
        for (const start of [0, 8000, 20000]) {
          await laufOeffnen(page, LANG);
          await gelesen(page);
          expect(await page.locator(TOP).evaluateAll(bs => bs.map(b => b.dataset.arg))).toEqual(LANG_ZIELE);
          expect(await page.locator(EINTRAEGE).count(), 'mehr als 300 Einträge').toBeGreaterThan(300);
          const hoehe = await page.locator(`${EINTRAEGE}:nth-child(2)`).evaluate(e => e.getBoundingClientRect().height);
          expect(hoehe, 'Bash-Zeile mit Absicht wie im echten Lauf').toBeGreaterThanOrEqual(75);
          await page.locator('#lauf').evaluate((s, v) => s.scrollTo(0, v), start);
          const knopf = page.locator(TOP).nth(i);
          if (wie === 'Klick') await knopf.click();
          else { await knopf.focus(); await page.keyboard.press('Enter'); }
          for (const [nach, warten] of [['1 s', 1000], ['3 s', 2000]]) {
            await page.waitForTimeout(warten);
            const lage = await imBlick(page, ziel);
            expect(lage, `Scrollstart ${start}, nach ${nach}: ${JSON.stringify(lage)}`).toMatchObject({ fokus: ziel, obenUnterKopf: true, untenImFenster: true });
          }
        }
      });
    }
  }

  test('AK 9 · US-3: langer Lauf unter prefers-reduced-motion — Klick auf Eintrag 2 holt lv-s479 nach 1 s und 3 s unter den Seitenkopf, Fokus auf der Zeile', async ({ page }) => {
    await lv.hochladen(k.adresse, 1, LANG, 'Entwicklung', lv.gz(langText()));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await breiteSetzen(page, 1280);
    await laufOeffnen(page, LANG);
    await gelesen(page);
    await page.locator(TOP).nth(1).click();
    for (const [nach, warten] of [['1 s', 1000], ['3 s', 2000]]) {
      await page.waitForTimeout(warten);
      const lage = await imBlick(page, 'lv-s479');
      expect(lage, `nach ${nach}: ${JSON.stringify(lage)}`).toMatchObject({ fokus: 'lv-s479', obenUnterKopf: true, untenImFenster: true });
    }
  });

  test('AK 10 · US-6: T4 offen — ein Kosteneintrag zeigt „0,51 $“ ohne neues Lesen; Insel und Fokus bleiben, laufAuswerten lief einmal, keine Ansage', async ({ page }) => {
    await ablegen(k);
    let lesen = 0;
    page.on('request', r => { if (r.method() === 'GET' && istTranskript(r.url())) lesen++; });
    await page.goto(`${k.adresse}#/board/fabrik`);
    await liveBereit(page);
    await page.evaluate(() => {
      window.kdAuswertungen = 0;
      const echt = window.laufAuswerten;
      window.laufAuswerten = (...a) => { window.kdAuswertungen++; return echt(...a); };
    });
    await page.evaluate(h => { location.hash = h; }, `#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(T.T4)}`);
    await gelesen(page);
    await expect(page.locator(`${KENNZAHLEN} > div:has(dt:text-is("Kosten")) dd`)).toHaveText(/^–kein Kosteneintrag$/);
    await page.locator(INSEL).evaluate(el => { el.__probe = 1; });
    await summaryVon(page, 1).click();
    await summaryVon(page, 1).focus();
    await ansagenBeobachten(page);
    await lv.buchen(k.adresse, 1, T.T4, 'Entwicklung', 0.51);
    await expect(page.locator(`${KENNZAHLEN} > div:has(dt:text-is("Kosten")) dd`)).toHaveText(/^0,51\s\$$/);
    expect(await page.locator(INSEL).evaluate(el => el.__probe)).toBe(1);
    await expect(zeileVon(page, 1).locator('details')).toHaveAttribute('open', '');
    expect(await page.evaluate(() => window.kdAuswertungen)).toBe(1);
    expect(lesen).toBe(1);
    expect(await aenderungen(page)).toBe(0);
    expect(await page.evaluate(() => document.activeElement.closest('#lv-s1') !== null && document.activeElement.tagName)).toBe('SUMMARY');
  });
  /* ── AK 10 Breite, Themen, Ziele, Ansage ── */

  const BREITEN = [320, 641, 980, 1280];
  /** Überläufe an Dokument, Bildlaufbehälter, jeder Werkzeugzeile und je Befehl und Absicht. */
  const ueberlaeufe = page => page.evaluate(() => {
    const zuBreit = el => el.scrollWidth > el.clientWidth;
    const aus = [];
    if (zuBreit(document.documentElement)) aus.push(`Dokument ${document.documentElement.scrollWidth} > ${document.documentElement.clientWidth}`);
    if (zuBreit(document.getElementById('lauf'))) aus.push('#lauf');
    for (const el of document.querySelectorAll('#lv-insel .lv-s, #lv-insel .lv-s .bf, #lv-insel .lv-s .ab, #lauf .lv-aw, #lauf .lv-kz > div, #lauf .lv-kz dt, #lauf .lv-top button')) {
      if (zuBreit(el)) aus.push(`${el.closest('li[id]') ? el.closest('li[id]').id : ''} ${el.className} ${el.scrollWidth} > ${el.clientWidth}`);
    }
    return aus;
  });

  for (const [variante, aenderung] of [
    ['Befehl aus 45.000 Zeichen', (e, nr) => (nr === 3 ? { ...e, text: JSON.stringify({ command: 'ls ' + 'x '.repeat(22500), description: 'Nächste freie Nummer' }) } : e)],
    ['Befehl und Absicht aus je 200 Zeichen ohne Leerzeichen', (e, nr) => (nr === 3 ? { ...e, text: JSON.stringify({ command: 'p'.repeat(200), description: 'a'.repeat(200) }) } : e)],
  ]) {
    test(`AK 10: Breite — T1 mit ${variante}: kein Querscrollen bei 320, 641, 980, 1280 px, hell und dunkel; umgebrochen, nicht abgeschnitten`, async ({ page }) => {
      await ablegen(k, t1Text(aenderung));
      await laufOeffnen(page, T.T1);
      await gelesen(page);
      await summaryVon(page, 5).click();
      const fehler = [];
      for (const farbe of ['light', 'dark']) {
        await thema(page, farbe);
        for (const b of BREITEN) {
          await breiteSetzen(page, b);
          fehler.push(...(await ueberlaeufe(page)).map(x => `${farbe} ${b}: ${x}`));
          const abgeschnitten = await summaryVon(page, 3).locator('.bf, .ab').evaluateAll(es => es.map(e => getComputedStyle(e).textOverflow).filter(t => t !== 'clip'));
          fehler.push(...abgeschnitten.map(t => `${farbe} ${b}: text-overflow ${t}`));
        }
      }
      expect(fehler).toEqual([]);
      await expect(summaryVon(page, 3).locator('.bf')).toHaveText(variante.startsWith('Befehl aus') ? /…$/ : 'p'.repeat(200));
    });
  }

  test('AK 10: Themen — Text und Kennzahlen ≥ 4,5:1, auch die Fehlerzeile auf ihrer Fläche, hell und dunkel; T1, T4 und T5', async ({ page }) => {
    await ablegen(k);
    for (const kennung of [T.T1, T.T4, T.T5]) {
      await laufOeffnen(page, kennung);
      await gelesen(page);
      if (kennung === T.T1) await summaryVon(page, 5).click();
      for (const farbe of ['light', 'dark']) {
        await thema(page, farbe);
        expect(await kontrastVerstoesse(page, ['#kopf', '#lauf']), `${kennung} ${farbe}`).toEqual([]);
      }
    }
  });

  test('AK 10: Ziele bei feinem Zeiger — Knöpfe von „Längste Schritte“ und jede summary einer Werkzeugzeile ≥ 24 px hoch', async ({ page }) => {
    await ablegen(k);
    await laufOeffnen(page, T.T1);
    await gelesen(page);
    expect(await page.evaluate(() => matchMedia('(pointer: fine)').matches)).toBe(true);
    const hoehen = await page.locator(`${TOP}, ${INSEL} .lv-s > summary`).evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(hoehen.length).toBe(9);
    expect(Math.min(...hoehen)).toBeGreaterThanOrEqual(24);
  });

  test('AK 10: genau eine Ansage je Ergebnis im Statusbereich — beim Lesen und beim Ergebnis, nichts aus Kopf, Kennzahlen und Bericht', async ({ page }) => {
    await ablegen(k);
    await page.addInitScript(() => {
      window.kdAnsagen = [];
      document.addEventListener('DOMContentLoaded', () => new MutationObserver(eintraege => {
        for (const e of eintraege) {
          const ort = e.target.nodeType === 3 ? e.target.parentElement : e.target;
          const region = ort && ort.closest && ort.closest('[role=status],[role=alert],[aria-live]');
          if (region) window.kdAnsagen.push(`${region.id}: ${region.textContent}`);
        }
      }).observe(document, { subtree: true, childList: true, characterData: true }));
    });
    const gehalten = await halten(page);
    await laufOeffnen(page, T.T1);
    await expect(page.locator(STATUS)).toHaveText('Liest das Transkript …');
    await gehalten.freigeben();
    await gelesen(page);
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    // der Ladesatz kommt mit dem Statusbereich selbst ins Dokument; danach ändert sich nur er, genau einmal, und keine andere Region
    expect(await page.evaluate(() => window.kdAnsagen.filter(t => !/: $/.test(t)))).toEqual(['lv-status: Ende des Transkripts']);
  });
});

test.describe('R00234 Laufansicht: Ziele bei grobem Zeiger', () => {
  test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
  });
  test.afterEach(() => k.stoppen());

  test('AK 10: Knöpfe von „Längste Schritte“ und jede summary einer Werkzeugzeile ≥ 48 px hoch', async ({ page }) => {
    await ablegen(k);
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${encodeURIComponent(T.T1)}`);
    await expect(page.locator(STATUS)).toHaveText('Ende des Transkripts');
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const hoehen = await page.locator(`${TOP}, ${INSEL} .lv-s > summary`).evaluateAll(es => es.map(e => e.getBoundingClientRect().height));
    expect(hoehen.length).toBe(9);
    expect(Math.min(...hoehen)).toBeGreaterThanOrEqual(48);
  });
});
