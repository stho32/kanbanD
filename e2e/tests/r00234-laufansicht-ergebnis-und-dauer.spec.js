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
const TOP = '#lauf .lv-top button';

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
      expect(await kennzahlen(page)).toEqual([['Ergebnis', '–'], ['Werkzeugaufrufe', '–'], ['Fehler erkannt', '–'], ['Commits', '–'], ['Kosten', kosten]]);
      expect(await gesamtSichtbar(page)).toBe('Gesamtdauer –');
      const lesetext = fall === 'T1 gehalten' ? 'wird gelesen' : 'nicht verfügbar';
      const snapshot = await page.locator(KOPF).ariaSnapshot();
      expect(snapshot).not.toContain('–');
      for (const name of ['Gesamtdauer', 'Ergebnis', 'Werkzeugaufrufe', 'Fehler erkannt', 'Commits']) expect(snapshot).toMatch(new RegExp(`${name}[\\s\\S]*?${lesetext}`, 'i'));
      expect(snapshot.split(lesetext).length - 1).toBe(5);
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
    expect(await kennzahlen(page)).toEqual([['Ergebnis', 'bestanden'], ['Werkzeugaufrufe', '6'], ['Fehler erkannt', '2'], ['Commits', '1'], ['Kosten', '1,79 $']]);
    await expect(page.locator('#lauf .lv-leiste')).not.toContainText('BETRAG');
    await laufOeffnen(page, T.T4);
    await gelesen(page);
    expect(await kennzahlen(page)).toEqual([['Ergebnis', '–'], ['Werkzeugaufrufe', '1'], ['Fehler erkannt', '0'], ['Commits', '–'], ['Kosten', '–']]);
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
});
