// R00221 Laufansicht: Transkript eines Agentenlaufs lesen (Karte #210, I0211, Scheibe D2) — AK 3–10 im echten Programm (Chromium).
// Ausgangslage: laufansicht-hilfen.js (Board `fabrik`, #1 mit L1–L9 über die API abgelegt, L3 danach gelöscht).
// Antworten per `page.route` gehalten und über ein Promise freigegeben, keine Schlafzeiten; Verneinungen erst nach einem sichtbaren Signal.
// Defekte gz-Dateien und die Bombe nur hier: Node liest zwei gzip-Glieder, Chromium nicht (ADR-0041).
const { test, expect } = require('@playwright/test');
const { kanbanStarten, liveBereit, reiter, alsPerson, mutanteEinsetzen, breiteSetzen, thema, kontrastVerstoesse, kontrastFarben } = require('./hilfen');
const lv = require('./laufansicht-hilfen');
const { L } = lv;

const SEITE = '#lauf';
const H1 = '#lv-h1';
const RUECKWEG = '#lv-rueckweg';
const STATUS = '#lv-status';
const INSEL = '#lv-insel';
const EINTRAEGE = `${INSEL} > li`;
const ERNEUT = '#lv-erneut';
const MELDUNG = `${SEITE} .lv-ganz`;
const LEISTE = `${SEITE} .lv-leiste`;
const ANSEHEN = '#fenster a.lf-an';
const ANSICHT_LAEUFE = '#fenster .mod-body[aria-label="Ansicht: Läufe"]';
const LIEST = 'Liest das Transkript …';
const ENDE = 'Ende des Transkripts';
const GRENZE = 'Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.';
const FEHLT = 'Das Transkript liegt nicht auf diesem Rechner.';
const ENTPACKEN = 'Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht entpacken.';
const UNBEKANNT = 'Das Transkript ließ sich nicht lesen: An dieser Aufgabe steht kein Lauf mit dieser Kennung.';
const OHNE_VERBINDUNG = 'Das Transkript ließ sich nicht lesen: keine Verbindung zum Programm.';
const FEHLER_503 = 'Das Transkript ließ sich nicht lesen: Antwortbudget erschöpft (503).';
const BREITEN = [320, 414, 640, 641, 768, 980, 1099, 1100, 1280];

const kodiert = kennung => encodeURIComponent(kennung);
const istTranskript = url => new URL(url).pathname.startsWith('/api/aufgaben/1/transkripte/');
const istListe = url => new URL(url).pathname === '/api/aufgaben/1/transkripte';

/** Zählt die GET-Anfragen an `…/transkripte/<kennung>` und an die Liste `…/transkripte`. */
function zaehlen(page) {
  const z = { einzeln: 0, liste: 0 };
  page.on('request', r => {
    if (r.method() !== 'GET') return;
    if (istTranskript(r.url())) z.einzeln++;
    if (istListe(r.url())) z.liste++;
  });
  return z;
}

/** Hält jedes `GET …/transkripte/<kennung>`, bis `freigeben(wie)` es beantwortet: `'weiter'` (Server), `'abbruch'` (keine Verbindung),
 *  `{status, json}` oder `{body}` (200, gz-Bytes). `anzahl()` zählt die gesendeten Anfragen. */
async function halten(page) {
  const wartend = [];
  let anzahl = 0;
  await page.route(url => istTranskript(url.href), async route => {
    if (route.request().method() !== 'GET') return route.continue();
    anzahl++;
    const wie = await new Promise(r => wartend.push(r));
    if (wie === 'weiter') return route.continue();
    if (wie === 'abbruch') return route.abort('connectionrefused');
    if (wie.body) return route.fulfill({ status: 200, contentType: 'application/gzip', body: wie.body });
    return route.fulfill({ status: wie.status, json: wie.json });
  });
  return {
    anzahl: () => anzahl,
    freigeben: async (wie = 'weiter') => {
      await expect.poll(() => wartend.length, 'eine Anfrage ist gehalten').toBeGreaterThan(0);
      wartend.shift()(wie);
    },
  };
}
const B503 = { status: 503, json: { fehler: 'Antwortbudget erschöpft' } };

/** Die Ansage-Zählung (AK 10): Textänderungen in Live-Regionen und deren Inhalt, je Eintrag Rolle und Text. */
async function ansagenZaehlen(page) {
  await page.evaluate(() => {
    window.kdAnsagen = [];
    // ein Wechsel der Adresse lädt die Seite nicht neu: ein Beobachter je Dokument
    if (window.kdBeobachter) return;
    window.kdBeobachter = true;
    const LIVE = '[role=status],[role=alert],[aria-live]';
    // wie R00219 AK 10: ein Bereich, der schon im Dokument stand und nur wieder eingehängt wird, ist keine neue Ansage
    const bekannt = new WeakSet(document.querySelectorAll(LIVE));
    new MutationObserver(eintraege => {
      for (const e of eintraege) {
        const ort = e.target.nodeType === 3 ? e.target.parentElement : e.target;
        const region = ort && ort.closest && ort.closest(LIVE);
        if (region) { window.kdAnsagen.push(`${region.getAttribute('role') || 'live'}: ${region.textContent}`); continue; }
        for (const n of e.addedNodes) {
          if (n.nodeType !== 1) continue;
          for (const neu of [n, ...n.querySelectorAll(LIVE)].filter(x => x.matches(LIVE) && !bekannt.has(x) && x.textContent.trim())) {
            bekannt.add(neu);
            window.kdAnsagen.push(`${neu.getAttribute('role') || 'live'} neu: ${neu.textContent}`);
          }
        }
      }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return {
    leeren: () => page.evaluate(() => { window.kdAnsagen = []; }),
    lesen: async () => { await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); return page.evaluate(() => window.kdAnsagen); },
  };
}

const aktivId = page => page.evaluate(() => (document.activeElement === document.body ? 'body' : document.activeElement.id || document.activeElement.outerHTML.slice(0, 60)));
const gezeichnet = page => page.waitForFunction(() => window.kdTest.gezeichnet());

test.describe('R00221 Laufansicht', () => {
  let k, bytes;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    await alsPerson(page, lv.MENSCH);
    k = await kanbanStarten(lv.ausgangslage());
    bytes = await lv.ablegen(k);
  });
  test.afterEach(() => k.stoppen());

  const adresse = (kennung, roh = null) => `${k.adresse}#/board/fabrik/aufgabe/1/lauf?kennung=${roh === null ? kodiert(kennung) : roh}`;
  // Jede Laufansicht in einem frischen Dokument: ein Wechsel nur des Hashs bliebe dasselbe Dokument, und nach den 16.000 Einträgen
  // der Bombe hängen die Locator-Abfragen von Playwright in diesem Dokument (die Seite selbst antwortet, siehe AK 3).
  async function laufOeffnen(page, kennung, roh = null) {
    if (page.url().startsWith(k.adresse)) await page.goto('about:blank');
    await page.goto(adresse(kennung, roh));
    await expect(page.locator(H1)).toBeVisible();
  }
  async function laeufeOeffnen(page) {
    await page.goto(`${k.adresse}#/board/fabrik/aufgabe/1`);
    await expect(page.getByRole('dialog', { name: 'Aufgabe #1' })).toBeVisible();
    await liveBereit(page);
    await reiter(page, 'Läufe');
    await expect(page.locator(ANSEHEN).first()).toBeVisible();
  }
  const ansehen = (page, kennung) => page.locator(`${ANSEHEN}[data-arg="${kennung}"]`);
  const ergebnisSteht = page => expect(page.locator(STATUS)).not.toHaveText(new RegExp(`^(${LIEST}|)$`));

  /* ── AK 4 Einstieg und Rückweg ── */

  test('AK 4: jede Zeile mit vorhanden trägt genau ein „Ansehen“ als a[href], L3 keines; href von L1 und L4', async ({ page }) => {
    await laeufeOeffnen(page);
    await expect(page.locator(ANSEHEN)).toHaveCount(8);
    for (const kennung of [L.L1, L.L2, L.L4, L.L5, L.L6, L.L7, L.L8, L.L9]) await expect(ansehen(page, kennung)).toHaveCount(1);
    await expect(ansehen(page, L.L3)).toHaveCount(0);
    expect(await ansehen(page, L.L1).getAttribute('href')).toBe('#/board/fabrik/aufgabe/1/lauf?kennung=entwickler%402026-11-20T10%3A00%2B01%3A00');
    expect(await ansehen(page, L.L4).getAttribute('href')).toMatch(/kennung=a%2Fb%20c%25%3F%402026-11-20T13%3A00%2B01%3A00$/);
  });

  // „history.length ist danach so groß wie vor dem Klick“ gilt für den Klick auf den Rückweg: „Ansehen“ legt einen Eintrag an
  // (pushState mit Marke, ADR-0041 Punkt 2), der Rückweg stapelt keinen weiteren, und „Zurück“ im Browser führt nicht in die Laufansicht.
  test('AK 4 · US-1 · US-2: Linksklick auf „Ansehen“ zeigt L1; „‹ #1“ führt zurück zu „Läufe“, history.length wie vor dem Klick, Fokus auf „Ansehen“', async ({ page }) => {
    await laeufeOeffnen(page);
    const amAnfang = await page.evaluate(() => history.length);
    await ansehen(page, L.L1).click();
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await expect(page.locator(H1)).toBeFocused();
    const vorher = await page.evaluate(() => history.length);
    expect(vorher).toBe(amAnfang + 1);
    await page.locator(RUECKWEG).click();
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    await expect(ansehen(page, L.L1)).toBeFocused();
    expect(await page.evaluate(() => history.length)).toBe(vorher);
    expect(await page.evaluate(() => location.hash)).toBe('#/board/fabrik/aufgabe/1');
    await page.goBack();
    await expect.poll(() => page.evaluate(() => location.hash)).not.toMatch(/\/lauf\?/);
  });

  test('AK 4 · US-2: als Lesezeichen geladen führt „‹ #1“ zu „Läufe“, ohne die Seite zu verlassen, und history.length wächst nicht', async ({ page }) => {
    await laufOeffnen(page, L.L1);
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    const vorher = await page.evaluate(() => { window.kdSelbeSeite = 1; return history.length; });
    await page.locator(RUECKWEG).click();
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    await expect(ansehen(page, L.L1)).toBeFocused();
    expect(await page.evaluate(() => [history.length, window.kdSelbeSeite])).toEqual([vorher, 1]);
  });

  test('AK 4: L1 inzwischen gelöscht — der Rückweg setzt den Fokus auf die Überschrift von „Läufe“, nie auf body', async ({ page }) => {
    await laufOeffnen(page, L.L1);
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await liveBereit(page);
    const weg = await fetch(`${k.adresse}api/aufgaben/1/transkripte/${kodiert(L.L1)}`, { method: 'DELETE', headers: { 'X-KanbanD-Wer': lv.AGENT } });
    expect(weg.ok).toBe(true);
    await expect(page.locator(LEISTE)).toHaveCount(0);
    await page.locator(RUECKWEG).click();
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    await expect(page.locator('#laeufe-kopf')).toBeFocused();
  });

  test('AK 4 · US-3: die Adresse von L4 (/, Leerzeichen, %, ?) zeigt seine Leiste und seinen Eintrag', async ({ page }) => {
    await laufOeffnen(page, L.L4);
    await expect(page.locator(LEISTE)).toContainText('ROLLEa/b c%?');
    await expect(page.locator(EINTRAEGE).first()).toContainText('Ein Eintrag von L4.');
    await expect(page.locator(EINTRAEGE)).toHaveCount(2);
  });

  /* ── AK 5 Adresse ohne Treffer ── */

  for (const [name, roh] of [['niemand', 'niemand%402026-11-20T10%3A00%2B01%3A00'], ['101 Zeichen', 'n'.repeat(101)], ['mit %0A', 'nie%0Amand'], ['<script>x</script>', '<script>x</script>']]) {
    test(`AK 5 · US-3: Kennung „${name}“ ohne Treffer — feste Meldung mit „Erneut versuchen“, keine Anfrage, nichts aus der Adresse`, async ({ page }) => {
      const z = zaehlen(page);
      await laufOeffnen(page, null, roh);
      await expect(page.locator(MELDUNG)).toHaveText(UNBEKANNT + 'Erneut versuchen');
      await expect(page.locator(ERNEUT)).toBeVisible();
      expect(z.einzeln).toBe(0);
      expect(await page.locator('body').innerText()).not.toContain('niemand');
      expect(await page.locator('body').innerText()).not.toContain('nnnnnnnnnn');
      await expect(page.locator('#app script')).toHaveCount(0);
      await expect(page.locator(H1)).toBeFocused();
    });
  }

  /* ── AK 6 Seite von L1 ── */

  test('AK 6 · US-1: Kopf, Leiste und Einträge von L1; für die Leiste geht keine Anfrage an die Liste hinaus', async ({ page }) => {
    const z = zaehlen(page);
    await laufOeffnen(page, L.L1);
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await expect(page.locator('#kopf')).toContainText('Lauf');
    await expect(page.locator('#kopf .rv-titel')).toHaveText('entwickler · 20.11.2026 10:00');
    await expect(page.locator('#kopf .rv-liest')).toHaveText('liest nur');
    await expect(page.locator(RUECKWEG)).toHaveText('#1');
    const felder = await page.locator(`${LEISTE} > span`).allInnerTexts();
    // R00221 Nachtrag (#251): die Leiste nennt keinen Betrag mehr, er steht als Kennzahl „Kosten“ im Kopf
    expect(felder.map(f => f.replace(/\s+/g, ''))).toEqual(['ROLLEentwickler', 'ZEITPUNKT20.11.202610:00', 'SPALTEEntwicklungKostengebuchtinReviews', `GRÖSSE${bytes[L.L1]}B`]);
    await expect(page.locator(`${SEITE} .lv-kz > div:has(dt:text-is("Kosten")) dd`)).toHaveText(/1,80\s\$/);
    const e = page.locator(EINTRAEGE);
    await expect(e.nth(0)).toContainText('10:00:41');
    await expect(e.nth(0).locator('strong')).toHaveText('die Anforderung');
    // Zeile 2 und 5 von L1 sind eine Zeile an der Stelle des Aufrufs: Name, Befehl, Kürzel des Ergebnisses, Dauer (10:00:42 → 09:00:43Z)
    await expect(e.nth(1).locator('details')).not.toHaveAttribute('open', '');
    await expect(e.nth(1).locator('summary')).toHaveText(/Read\s*Anforderungen\/R00219\.md\s*---\s*1 s/);
    await expect(e.nth(2)).toHaveText('Zeile 4 des Transkripts ist nicht lesbar.');
    await e.nth(1).locator('summary').click();
    await expect(e.nth(1).locator('pre')).toHaveText(['Anforderungen/R00219.md', '---\nid: R00219\nstatus: Neu']);
    await expect(e.nth(1).locator('.lv-s-ganz .k')).toHaveText(['Aufruf', 'Ergebnis']);
    expect(await e.nth(1).locator('pre').last().evaluate(p => getComputedStyle(p).fontFamily)).toMatch(/mono/i);
    await expect(e.nth(3)).toContainText('Passt.');
    await expect(e.nth(3).locator('.zt')).toHaveCount(0);
    await expect(e.nth(3).locator('.mono')).toHaveCount(0);
    await expect(e.nth(3).locator('b')).toHaveCount(0);
    await expect(e.nth(4)).toHaveText(ENDE);
    expect(await page.locator(SEITE).innerText()).not.toContain('{"art"');
    expect(z.liste).toBe(0);
    expect(z.einzeln).toBe(1);
  });

  test('AK 6: eine Nachricht ohne Zeit und ohne Namen zeigt weder Uhrzeit noch Namen (Agent und Mensch, nicht als Auftrag eingeklappt)', async ({ page }) => {
    const kennung = 'ohneangaben@2026-11-20T20:00+01:00';
    const zeilen = [
      '{"zeit":"2026-11-20T10:00:41+01:00","art":"nachricht","wer":"mensch","text":"Der Auftrag."}',
      '{"art":"nachricht","wer":"agent","text":"Antwort ohne Angaben."}',
      '{"art":"nachricht","wer":"mensch","text":"Rückfrage ohne Angaben."}',
    ].join('\n') + '\n';
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(zeilen));
    await laufOeffnen(page, kennung);
    const e = page.locator(EINTRAEGE);
    await expect(e).toHaveCount(4);
    await expect(e.nth(0).locator('details')).toHaveCount(1);
    for (const i of [1, 2]) {
      await expect(e.nth(i).locator('.lv-text')).toContainText('ohne Angaben.');
      await expect(e.nth(i).locator('.mono')).toHaveCount(0);
      await expect(e.nth(i).locator('b')).toHaveCount(0);
    }
    await expect(e.nth(3)).toHaveText(ENDE);
  });

  test('AK 6: Größe nach groesse aus bytes — 281.600 Byte stehen als „275,0 KB“', async ({ page }) => {
    const kennung = 'gross@2026-11-20T19:00+01:00';
    const daten = Buffer.concat([lv.gz(lv.G), Buffer.alloc(281600 - lv.gz(lv.G).length, 0)]);
    expect((await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', daten)).bytes).toBe(281600);
    await laufOeffnen(page, kennung);
    await expect(page.locator(`${LEISTE} > span`).nth(3)).toHaveText(/GRÖSSE\s*275,0 KB/);
  });

  test('AK 6: solange die Antwort gehalten ist, steht kein Eintrag, nur „Liest das Transkript …“', async ({ page }) => {
    const h = await halten(page);
    await laufOeffnen(page, L.L1);
    await expect(page.locator(STATUS)).toHaveText(LIEST);
    await expect(page.locator(STATUS)).toBeVisible();
    await expect(page.locator(INSEL)).toHaveCount(0);
    await h.freigeben();
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await expect(page.locator(STATUS)).toHaveText(ENDE);
  });

  test('AK 6: erste Zeile aus 250 Zeichen eingeklappt höchstens 200 und „…“, aufgeklappt alle 250', async ({ page }) => {
    const h = await halten(page);
    await laufOeffnen(page, L.L1);
    const lang = 'w'.repeat(250);
    await h.freigeben({ body: lv.gz(lv.zeile({ art: 'werkzeugergebnis', wer: 'werkzeug', name: 'Bash', text: lang + '\nzwei' })) });
    const z1 = page.locator(`${EINTRAEGE} .eg`);
    // R00240 FA 11: das „…“ von kanbanD trägt seinen Lesetext im textContent
    await expect(z1).toHaveText('w'.repeat(200) + '…Von kanbanD gekürzt, vollständig im aufgeklappten Schritt');
    await page.locator(`${EINTRAEGE} summary`).click();
    await expect(page.locator(`${EINTRAEGE} pre`)).toHaveText(lang + '\nzwei');
  });

  test('AK 6: eine gültige gz-Datei ohne Zeile ergibt nur „Ende des Transkripts“, ohne Fehlerbild; Fokus auf „Lauf“', async ({ page }) => {
    const h = await halten(page);
    await laufOeffnen(page, L.L1);
    await h.freigeben({ body: lv.gz('') });
    await expect(page.locator(EINTRAEGE)).toHaveText([ENDE]);
    await expect(page.locator(MELDUNG)).toHaveCount(0);
    await expect(page.locator(H1)).toBeFocused();
  });

  /* ── AK 7 Fehlerbilder ── */

  for (const [lauf, kennung] of [['L5 abgeschnitten', L.L5], ['L6 Prüfsumme', L.L6], ['L7 zwei Glieder', L.L7]]) {
    test(`AK 7 · US-4: ${lauf} — „…lässt sich nicht entpacken.“ mit „Erneut versuchen“, ohne einen Eintrag und ohne Status oder Text des Browsers`, async ({ page }) => {
      await page.addInitScript(() => {
        window.kdEintraegeGesehen = 0;
        new MutationObserver(() => { window.kdEintraegeGesehen = Math.max(window.kdEintraegeGesehen, document.querySelectorAll('#lv-insel > li').length); }).observe(document, { subtree: true, childList: true });
      });
      await laufOeffnen(page, kennung);
      await expect(page.locator(MELDUNG)).toHaveText(ENTPACKEN + 'Erneut versuchen');
      expect(await page.evaluate(() => window.kdEintraegeGesehen)).toBe(0);
      const text = await page.locator(SEITE).innerText();
      expect(text).not.toContain('(200)');
      expect(text).not.toMatch(/truncated|check|junk|TypeError|Error/i);
    });
  }

  test('AK 7 · US-4: L3 (fehlt) zeigt die Erklärung ohne „Erneut versuchen“; Kopf und Leiste stehen', async ({ page }) => {
    await laufOeffnen(page, L.L3);
    await expect(page.locator(`${SEITE} .lv-leer`)).toContainText(FEHLT);
    await expect(page.locator(`${SEITE} .lv-leer`)).toContainText('Transkripte bleiben auf dem Rechner');
    await expect(page.locator(ERNEUT)).toHaveCount(0);
    await expect(page.locator(LEISTE)).toContainText('code-reviewer');
    await expect(page.locator('#kopf .rv-titel')).toHaveText('code-reviewer · 20.11.2026 11:00');
  });

  test('AK 7: 503 zeigt Fehler und Status; abgebrochen „keine Verbindung“; „Erneut versuchen“ liest genau einmal und zeigt bei 200 die Einträge', async ({ page }) => {
    const h = await halten(page);
    await laufOeffnen(page, L.L1);
    await h.freigeben(B503);
    await expect(page.locator(MELDUNG)).toHaveText(FEHLER_503 + 'Erneut versuchen');
    await page.locator(ERNEUT).click();
    await h.freigeben('abbruch');
    await expect(page.locator(MELDUNG)).toHaveText(OHNE_VERBINDUNG + 'Erneut versuchen');
    expect(h.anzahl()).toBe(2);
    await page.locator(ERNEUT).click();
    await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
    // Playwright wartet sonst, bis der Knopf nicht mehr gesperrt ist
    await page.locator(ERNEUT).click({ force: true });
    await h.freigeben();
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    expect(h.anzahl()).toBe(3);
  });

  test('AK 7: gehaltene Antwort von L1, Rückweg gewählt, dann freigegeben — die Seite zeichnet nichts mehr', async ({ page }) => {
    await laeufeOeffnen(page);
    const h = await halten(page);
    await ansehen(page, L.L1).click();
    await expect(page.locator(STATUS)).toHaveText(LIEST);
    await page.locator(RUECKWEG).click();
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    await h.freigeben();
    await page.evaluate(() => new Promise(r => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(r)), 50)));
    await gezeichnet(page);
    await expect(page.locator(INSEL)).toHaveCount(0);
    await expect(page.locator(SEITE)).toHaveCount(0);
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
  });

  /* ── AK 3 Grenze ── */

  test('AK 3 · US-5: L8 (Bombe) zeigt die gelesenen Einträge und Wortlaut 15, kein Fehlerbild; die Antwort wird abgebrochen, der Rückweg reagiert', async ({ page }) => {
    await page.addInitScript(() => {
      window.kdAbbrueche = 0;
      const abbrechen = AbortController.prototype.abort;
      AbortController.prototype.abort = function (...a) { window.kdAbbrueche++; return abbrechen.apply(this, a); };
    });
    test.setTimeout(90000);
    await laufOeffnen(page, L.L8);
    const start = Date.now();
    await expect(page.locator(EINTRAEGE).last()).toHaveText(GRENZE, { timeout: 20000 });
    console.log('L8 bis zum Bild', Date.now() - start, 'ms');
    expect(await page.locator(EINTRAEGE).count()).toBeGreaterThan(1000);
    await expect(page.locator(MELDUNG)).toHaveCount(0);
    await expect(page.locator(STATUS)).toHaveText(GRENZE);
    expect(await page.evaluate(() => window.kdAbbrueche)).toBeGreaterThanOrEqual(1);
    const t0 = Date.now();
    await page.locator(RUECKWEG).click({ timeout: 2000 });
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 2000 }).toBe('#/board/fabrik/aufgabe/1');
    // Freigeben von 16 MiB Text und Knoten kostet den Tab einmal Zeit; gemessen und im Bericht genannt
    await expect.poll(() => page.evaluate(s => Boolean(document.querySelector(s)), ANSICHT_LAEUFE), { timeout: 30000 }).toBe(true);
    console.log('L8 Rückweg bis zum Fenster', Date.now() - t0, 'ms');
  });

  test('AK 3 · US-5: L9 (eine Zeile über 16 MiB) zeigt nur Wortlaut 15, ohne Eintrag und ohne Fehlerbild', async ({ page }) => {
    await laufOeffnen(page, L.L9);
    await expect(page.locator(EINTRAEGE)).toHaveText([GRENZE], { timeout: 20000 });
    await expect(page.locator(MELDUNG)).toHaveCount(0);
  });

  /* ── AK 8 Fremder Text ── */

  test('AK 8 · US-6: L2 — script als Text, kein javascript:-Verweis, kein img, window.pwn bleibt leer, U+202E als Marke', async ({ page }) => {
    await laufOeffnen(page, L.L2);
    await expect(page.locator(EINTRAEGE)).toHaveCount(3);
    await expect(page.locator(EINTRAEGE).first()).toContainText('<script>window.pwn=1</script>');
    await page.locator(`${EINTRAEGE} summary`).click();
    await expect(page.locator(`${EINTRAEGE} pre`)).toBeVisible();
    await expect(page.locator(`${SEITE} a[href^="javascript" i]`)).toHaveCount(0);
    await expect(page.locator(`${SEITE} img, ${SEITE} script`)).toHaveCount(0);
    expect(await page.evaluate(() => window.pwn)).toBeUndefined();
    const textknoten = await page.locator(SEITE).evaluate(el => {
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n, mit = 0;
      while ((n = w.nextNode())) if (n.data.includes('‮')) mit++;
      return mit;
    });
    expect(textknoten).toBe(0);
    const name = page.locator(`${EINTRAEGE} summary .nm`);
    await expect(name.locator('.mk-bidi')).toHaveCount(1);
    expect((await name.innerText()).indexOf('Bash')).toBeLessThan((await name.innerText()).indexOf('hs'));
    // eingeklappt steht die Marke als Text, das Markenelement trägt der aufgeklappte Text (Budget, PO Z. 493)
    await expect(page.locator(`${EINTRAEGE} summary .bf`)).toContainText('⟨U+202E⟩abc');
    await expect(page.locator(`${EINTRAEGE} pre .mk-bidi`)).toHaveCount(1);
  });

  /* ── AK 8 Budget für sichtbar gemachte Zeichen (PO Z. 493), Links nur in Nachrichten (PO Z. 494), FA 8 „verarbeiten“ (PO Z. 495) ── */

  const RLO = '\u202E';
  /** Lauf ablegen: eine Zeile je Eintrag, gz über die API; liefert die Kennung. */
  async function laufAblegen(rolle, stunde, eintraege) {
    const kennung = `${rolle}@2026-11-21T${String(stunde).padStart(2, '0')}:00+01:00`;
    await lv.hochladen(k.adresse, 1, kennung, 'Entwicklung', lv.gz(eintraege.map(lv.zeile).join('')));
    return kennung;
  }
  /** Nach dem Lesen: Marken, Knoten, Zeit bis `setTimeout(0)`, rohe Steuerzeichen in Textknoten, Meldungstext. */
  const seitenMass = page => page.evaluate(async () => {
    const t0 = performance.now();
    await new Promise(r => setTimeout(r, 0));
    const warten = performance.now() - t0;
    const alle = document.createTreeWalker(document, NodeFilter.SHOW_ALL);
    let knoten = 0, roh = 0;
    for (let n = alle.nextNode(); n; n = alle.nextNode()) { knoten++; if (n.nodeType === 3 && /[\u202E\u0001]/.test(n.data)) roh++; }
    return { warten, knoten, roh, marken: document.querySelectorAll('#lauf .mk-z').length, rest: [...document.querySelectorAll('#lauf .mk-rest')].map(e => e.textContent), text: document.getElementById('lauf').innerText.slice(0, 3000) };
  });

  for (const [name, eintrag, rest] of [
    ['A Werkzeugergebnis mit 1.000.000 × U+202E', { art: 'werkzeugergebnis', wer: 'werkzeug', name: 'Bash', text: 'Anfang' + RLO.repeat(1000000) + 'Ende' }, '… und 999.000 weitere Steuerzeichen'],
    ['B Werkzeugergebnis mit 2.700.000 × U+0001 (16 MiB entpackt)', { art: 'werkzeugergebnis', wer: 'werkzeug', name: 'Bash', text: 'Anfang' + '\u0001'.repeat(2700000) + 'Ende' }, '… und 2.699.000 weitere Steuerzeichen'],
    ['C Nachricht mit 262.144 × U+202E im Namen', { art: 'nachricht', wer: 'agent', name: 'Anfang' + RLO.repeat(262144) + 'Ende', text: 'Text' }, '… und 261.144 weitere Steuerzeichen'],
  ]) {
    test(`AK 8 · Security Muss 1: Lauf ${name} — Anfang, höchstens 1.000 Marken, Zusammenfassung, Ende; bedienbar, < 100.000 Knoten`, async ({ page }) => {
      test.setTimeout(90000);
      const kennung = await laufAblegen('budget', 8, [eintrag]);
      await laufOeffnen(page, kennung);
      await expect(page.locator(STATUS)).toHaveText(ENDE, { timeout: 30000 });
      if (eintrag.art !== 'nachricht') await page.locator(`${EINTRAEGE} summary`).first().click();
      const m = await seitenMass(page);
      expect(m.marken).toBeLessThanOrEqual(1000);
      expect(m.marken).toBeGreaterThan(0);
      expect(m.rest).toEqual([rest]);
      expect(m.text).toContain('Anfang');
      expect(await page.locator(SEITE).evaluate((s, r) => s.textContent.includes(r + 'Ende'), rest)).toBe(true);
      console.log('AK 8 Beobachtung', name.slice(0, 1), JSON.stringify({ warten: Math.round(m.warten), knoten: m.knoten, marken: m.marken }));
      expect(m.warten).toBeLessThan(1000);
      expect(m.knoten).toBeLessThan(100000);
      expect(m.roh).toBe(0);
      expect(await page.locator('body').innerText()).not.toMatch(/Invalid string length|undefined/);
    });
  }

  test('AK 8: Kontrollpaar — gleich viel Text aus „a“ steht ganz da, ohne Zusammenfassung', async ({ page }) => {
    const a = 'Anfang' + 'a'.repeat(1000000) + 'Ende';
    const kennung = await laufAblegen('kontrolle', 9, [{ art: 'werkzeugergebnis', wer: 'werkzeug', name: 'Bash', text: a }]);
    await laufOeffnen(page, kennung);
    await expect(page.locator(STATUS)).toHaveText(ENDE);
    expect(await page.locator(`${EINTRAEGE} pre`).evaluate((p, erwartet) => p.textContent === erwartet, a)).toBe(true);
    await expect(page.locator(`${SEITE} .mk-rest`)).toHaveCount(0);
  });

  test('AK 8: Lauf-Budget — bei 11 Werkzeugergebnissen mit je 1.000 × U+202E trägt das elfte nur „… und 1.000 weitere Steuerzeichen“', async ({ page }) => {
    const kennung = await laufAblegen('elf', 10, Array.from({ length: 11 }, () => ({ art: 'werkzeugergebnis', wer: 'werkzeug', name: 'Bash', text: RLO.repeat(1000) })));
    await laufOeffnen(page, kennung);
    await expect(page.locator(STATUS)).toHaveText(ENDE);
    const je = await page.locator(`${EINTRAEGE} pre`).evaluateAll(pres => pres.map(p => [p.querySelectorAll('.mk-z').length, (p.querySelector('.mk-rest') || {}).textContent || '']));
    expect(je.slice(0, 10)).toEqual(Array(10).fill([1000, '']));
    expect(je[10]).toEqual([0, '… und 1.000 weitere Steuerzeichen']);
  });

  test('AK 8 · PO Z. 494: [x](https://example.org) ergibt in einer Nachricht genau ein a mit target=_blank rel=noopener, im Werkzeugtext keins', async ({ page }) => {
    const md = '[x](https://example.org)';
    const kennung = await laufAblegen('links', 11, [{ art: 'nachricht', wer: 'agent', text: md }, { art: 'werkzeugergebnis', wer: 'werkzeug', name: md, text: md }]);
    await laufOeffnen(page, kennung);
    await expect(page.locator(STATUS)).toHaveText(ENDE);
    const nachricht = page.locator(EINTRAEGE).nth(0);
    await expect(nachricht.locator('a')).toHaveCount(1);
    await expect(nachricht.locator('a')).toHaveAttribute('target', '_blank');
    await expect(nachricht.locator('a')).toHaveAttribute('rel', 'noopener');
    await page.locator(`${EINTRAEGE} summary`).click();
    await expect(page.locator(EINTRAEGE).nth(1).locator('a')).toHaveCount(0);
  });

  test('FA 8 (PO Z. 495): eine unerwartete Ausnahme beim Lesen zeigt „…: Die Datei lässt sich nicht verarbeiten.“ mit „Erneut versuchen“, ohne Text des Browsers', async ({ page }) => {
    await page.addInitScript(() => { window.DecompressionStream = class { constructor() { throw new RangeError('Invalid string length'); } }; });
    await laufOeffnen(page, L.L1);
    await expect(page.locator(MELDUNG)).toHaveText('Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht verarbeiten.Erneut versuchen');
    expect(await page.locator('body').innerText()).not.toMatch(/Invalid string length|undefined/);
  });

  // R00221 Nachtrag (#251): die Werkzeugzeile zeigt statt der Uhrzeit die Dauer; geprüft wird deren Feld
  test('UX S1: dunkel, Zeiger über dem ersten summary — die Dauer trägt keinen eigenen Hintergrund', async ({ page }) => {
    await laufOeffnen(page, L.L1);
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await thema(page, 'dark');
    const summary = page.locator(`${EINTRAEGE} summary`).first();
    await summary.hover();
    const r = await summary.evaluate(s => [s.matches(':hover'), getComputedStyle(s.querySelector('.du')).backgroundColor, getComputedStyle(s).backgroundColor]);
    expect(r[0]).toBe(true);
    expect(['rgba(0, 0, 0, 0)', r[2]]).toContain(r[1]);
  });

  /* ── AK 9 Live hält die Einträge ── */

  test('AK 9 · US-7: Kommentar an #1 und Umbenennen von #2 lassen Knoten und Klappen stehen, ohne neues Lesen; ein Kosteneintrag an L2 erscheint live', async ({ page }) => {
    const z = zaehlen(page);
    await laufOeffnen(page, L.L1);
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await liveBereit(page);
    await page.locator(INSEL).evaluate(el => { el.__probe = 1; });
    await page.locator(`${EINTRAEGE} summary`).first().click();
    await lv.kommentieren(k.adresse, 1, 'Ein Kommentar');
    await page.waitForFunction(() => window.kdTest.kommentare(1) === 1 && window.kdTest.gezeichnet());
    const titel = await fetch(`${k.adresse}api/aufgaben/2`, { method: 'PATCH', headers: { 'X-KanbanD-Wer': lv.MENSCH, 'Content-Type': 'application/json' }, body: JSON.stringify({ titel: 'Umbenannt' }) });
    expect(titel.ok).toBe(true);
    await page.waitForFunction(() => window.kdTest.titel(2) === 'Umbenannt' && window.kdTest.gezeichnet());
    expect(await page.locator(INSEL).evaluate(el => el.__probe)).toBe(1);
    await expect(page.locator(`${EINTRAEGE} details`).first()).toHaveAttribute('open', '');
    expect(z.einzeln).toBe(1);
    // die Laufansicht von L2 ist offen; ein Kosteneintrag erscheint in der Leiste ohne Neuladen, die Marke bleibt
    await page.evaluate(h => { location.hash = h; }, `#/board/fabrik/aufgabe/1/lauf?kennung=${kodiert(L.L2)}`);
    await expect(page.locator(EINTRAEGE)).toHaveCount(3);
    await page.locator(INSEL).evaluate(el => { el.__probe = 2; });
    const kosten = page.locator(`${SEITE} .lv-kz > div:has(dt:text-is("Kosten")) dd`);
    await expect(kosten).toHaveText(/^–/);
    await lv.buchen(k.adresse, 1, L.L2, 'Detailplanung', 0.42);
    await expect(kosten).toHaveText(/0,42\s\$/);
    expect(await page.locator(INSEL).evaluate(el => el.__probe)).toBe(2);
    expect(z.einzeln).toBe(2);
  });

  /* ── AK 10 Breite, Ziele, Themen, Tastatur, Fokus, Ansage ── */

  async function breitenMessen(page, wo) {
    const aus = [];
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      for (const b of BREITEN) {
        await breiteSetzen(page, b);
        const r = await page.evaluate(() => {
          const de = document.documentElement, s = document.getElementById('lauf');
          return [de.scrollWidth, de.clientWidth, s ? s.scrollWidth : 0, s ? s.clientWidth : 0];
        });
        if (r[0] > r[1] || r[2] > r[3]) aus.push(`${wo} ${farbe} ${b}: ${r.join(' ')}`);
      }
    }
    return aus;
  }

  test('AK 10 · US-8: Breite — Einträge (Aufruf mit 45.000 Zeichen aufgeklappt), lädt, Grenze, fehlt, Fehler: kein Querscrollen an Dokument und Seite', async ({ page }) => {
    test.setTimeout(120000);
    const h = await halten(page);
    await laufOeffnen(page, L.L1);
    const fehler = [];
    fehler.push(...await breitenMessen(page, 'lädt'));
    await h.freigeben({ body: lv.gz(lv.G + lv.zeile({ art: 'werkzeugaufruf', wer: 'agent', name: 'Bash', text: 'x'.repeat(45000) })) });
    await expect(page.locator(EINTRAEGE)).toHaveCount(6);
    await page.locator(`${EINTRAEGE} summary`).last().click();
    fehler.push(...await breitenMessen(page, 'Einträge'));
    await page.locator(RUECKWEG).click();
    await expect(page.locator(ANSICHT_LAEUFE)).toBeVisible();
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      for (const b of BREITEN) {
        await breiteSetzen(page, b);
        const r = await page.evaluate(() => ['.mod-body', '.lf-panel'].map(sel => { const el = document.querySelector('#fenster ' + sel); return el.scrollWidth <= el.clientWidth ? '' : `${sel} ${el.scrollWidth} > ${el.clientWidth}`; }).filter(Boolean));
        fehler.push(...r.map(x => `Läufe ${farbe} ${b}: ${x}`));
      }
    }
    for (const [kennung, wo] of [[L.L9, 'Grenze'], [L.L3, 'fehlt']]) {
      await page.evaluate(hh => { location.hash = hh; }, `#/board/fabrik/aufgabe/1/lauf?kennung=${kodiert(kennung)}`);
      await h.freigeben();
      await ergebnisSteht(page);
      fehler.push(...await breitenMessen(page, wo));
    }
    await page.evaluate(hh => { location.hash = hh; }, `#/board/fabrik/aufgabe/1/lauf?kennung=${kodiert(L.L5)}`);
    await h.freigeben(B503);
    await expect(page.locator(MELDUNG)).toBeVisible();
    fehler.push(...await breitenMessen(page, 'Fehler'));
    expect(fehler).toEqual([]);
  });

  test('AK 10: Themen — kontrastVerstoesse ohne Befund in Einträgen, Grenze, fehlt und Fehler, hell und dunkel; gesperrter Knopf ≥ 3:1 in --kd-faint', async ({ page }) => {
    const h = await halten(page);
    for (const [kennung, wie] of [[L.L1, 'weiter'], [L.L9, 'weiter'], [L.L3, 'weiter'], [L.L5, B503]]) {
      await laufOeffnen(page, kennung);
      await h.freigeben(wie);
      await ergebnisSteht(page);
      if (kennung === L.L1) await page.locator(`${EINTRAEGE} summary`).first().click();
      for (const farbe of ['light', 'dark']) {
        await thema(page, farbe);
        expect(await kontrastVerstoesse(page, ['#kopf', SEITE]), `${kennung} ${farbe}`).toEqual([]);
      }
    }
    await page.locator(ERNEUT).click();
    await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
    for (const farbe of ['light', 'dark']) {
      await thema(page, farbe);
      const r = await page.locator(ERNEUT).evaluate(e => ({ farbe: getComputedStyle(e).color, grund: getComputedStyle(e).backgroundColor, faint: getComputedStyle(document.documentElement).getPropertyValue('--kd-faint').trim() }));
      const faint = await page.evaluate(f => { const s = document.createElement('span'); s.style.color = f; document.body.append(s); const c = getComputedStyle(s).color; s.remove(); return c; }, r.faint);
      expect(r.farbe, farbe).toBe(faint);
      expect(await kontrastFarben(page, r.farbe, r.grund), farbe).toBeGreaterThanOrEqual(3);
    }
  });

  for (const farbe of ['hell', 'dunkel']) {
    test(`AK 10: ${farbe} — Fokusring an Rückweg, summary, „Erneut versuchen“ (auch gesperrt) und „Ansehen“: solid, ≥ 2 px, ≥ 3:1`, async ({ page }) => {
      const h = await halten(page);
      await laeufeOeffnen(page);
      await thema(page, farbe === 'hell' ? 'light' : 'dark');
      const ring = async (ort, wo) => {
        await expect(ort).toBeFocused();
        const r = await ort.evaluate(e => {
          const st = getComputedStyle(e);
          let grund = parseFloat(st.outlineOffset) < 0 ? e : e.parentElement;
          while (grund && getComputedStyle(grund).backgroundColor === 'rgba(0, 0, 0, 0)') grund = grund.parentElement;
          return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth), farbe: st.outlineColor, flaeche: grund ? getComputedStyle(grund).backgroundColor : '#fff' };
        });
        expect(r.stil, wo).toBe('solid');
        expect(r.breite, wo).toBeGreaterThanOrEqual(2);
        expect(await kontrastFarben(page, r.farbe, r.flaeche), wo).toBeGreaterThanOrEqual(3);
      };
      const perTab = async ort => { for (let i = 0; i < 40 && !(await ort.evaluate(e => e === document.activeElement)); i++) await page.keyboard.press('Tab'); };
      await ansehen(page, L.L1).focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      await ring(ansehen(page, L.L1), 'Ansehen');
      await page.keyboard.press('Enter');
      await expect(page.locator(H1)).toBeFocused();
      await h.freigeben(B503);
      await expect(page.locator(ERNEUT)).toBeVisible();
      await page.locator(H1).focus();
      await page.keyboard.press('Shift+Tab');
      await ring(page.locator(RUECKWEG), 'Rückweg');
      await perTab(page.locator(ERNEUT));
      await ring(page.locator(ERNEUT), 'Erneut versuchen');
      await page.keyboard.press('Enter');
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
      await ring(page.locator(ERNEUT), 'Erneut versuchen gesperrt');
      await h.freigeben();
      await expect(page.locator(EINTRAEGE)).toHaveCount(5);
      await perTab(page.locator(`${EINTRAEGE} summary`).first());
      await ring(page.locator(`${EINTRAEGE} summary`).first(), 'summary');
      const h1Ring = await page.locator(H1).evaluate(e => { e.focus(); const st = getComputedStyle(e); return { stil: st.outlineStyle, breite: parseFloat(st.outlineWidth), farbe: st.outlineColor, flaeche: getComputedStyle(e.closest('header')).backgroundColor }; });
      if (h1Ring.stil !== 'none') {
        expect(h1Ring.breite).toBeGreaterThanOrEqual(2);
        expect(await kontrastFarben(page, h1Ring.farbe, h1Ring.flaeche)).toBeGreaterThanOrEqual(3);
      }
    });
  }

  test('AK 10 · US-8: Tastatur — Tab vom „Lauf“ erreicht den ersten summary; Enter und Leertaste klappen; Enter auf „Ansehen“ setzt den Fokus auf „Lauf“', async ({ page }) => {
    await laeufeOeffnen(page);
    await ansehen(page, L.L1).focus();
    await page.keyboard.press('Enter');
    await expect(page.locator(EINTRAEGE)).toHaveCount(5);
    await expect(page.locator(H1)).toBeFocused();
    expect(await page.evaluate(() => document.querySelector('#lv-h1').getAttribute('tabindex'))).toBe('-1');
    // R00239 FA 11: zuerst das Blättern in der Leiste (L1 hat Nachbarn auf beiden Seiten)
    for (const ziel of ['#lv-vor', '#lv-nach']) {
      await page.keyboard.press('Tab');
      await expect(page.locator(ziel)).toBeFocused();
    }
    // R00234 FA 10: vor den Einträgen steht „Längste Schritte“ (L1 hat genau einen Schritt mit Dauer), danach der erste summary
    await page.keyboard.press('Tab');
    await expect(page.locator('#lauf .lv-top button')).toBeFocused();
    // R00239 FA 8: darunter die vier Kästchen von „Zeigen“
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(page.locator('#lv-f-f')).toBeFocused();
    await page.keyboard.press('Tab');
    const summary = page.locator(`${EINTRAEGE} summary`).first();
    await expect(summary).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator(`${EINTRAEGE} details`).first()).toHaveAttribute('open', '');
    await page.keyboard.press('Space');
    await expect(page.locator(`${EINTRAEGE} details`).first()).not.toHaveAttribute('open', '');
    await page.locator(H1).focus();
    await page.keyboard.press('Shift+Tab');
    await expect(page.locator(RUECKWEG)).toBeFocused();
  });

  test('AK 10: Fokus beim Lesen — der gesperrte Knopf behält den Fokus, ein zweiter Klick liest nicht; danach Knopf oder „Lauf“, nie body', async ({ page }) => {
    const h = await halten(page);
    // je nach einem ersten 503: Ende (L1), Grenze (L8, L9), fehlt (L3), erneuter Fehler (503)
    for (const [kennung, wie, ziel] of [[L.L1, 'weiter', 'lv-h1'], [L.L8, 'weiter', 'lv-h1'], [L.L9, 'weiter', 'lv-h1'], [L.L3, 'weiter', 'lv-h1'], [L.L1, B503, 'lv-erneut']]) {
      await laufOeffnen(page, kennung);
      await h.freigeben(B503);
      await expect(page.locator(ERNEUT)).toBeVisible();
      const vorher = h.anzahl();
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator(ERNEUT).click();
      await expect(page.locator(ERNEUT)).toHaveAttribute('aria-disabled', 'true');
      expect(await aktivId(page)).toBe('lv-erneut');
      await page.locator(ERNEUT).click({ force: true });
      expect(h.anzahl()).toBe(vorher + 1);
      await h.freigeben(wie);
      await expect.poll(() => page.locator(STATUS).textContent()).not.toBe(LIEST);
      await expect.poll(() => aktivId(page), kennung).toBe(ziel);
      expect(await page.evaluate(() => document.getElementById('lauf').scrollTop)).toBe(0);
    }
  });

  test('AK 10 · US-8: genau eine Ansage je Ergebnis im role="status"; ab „Erneut versuchen“ genau zwei; die Meldung trägt keine Live-Rolle', async ({ page }) => {
    const h = await halten(page);
    const fall = async (kennung, wie, satz) => {
      await laufOeffnen(page, kennung);
      await expect(page.locator(STATUS)).toHaveText(LIEST);
      const a = await ansagenZaehlen(page);
      await h.freigeben(wie);
      await expect(page.locator(STATUS)).toHaveText(satz, { timeout: 20000 });
      expect(await a.lesen(), kennung).toEqual([`status: ${satz}`]);
      return a;
    };
    await fall(L.L1, 'weiter', ENDE);
    await fall(L.L8, 'weiter', GRENZE);
    await fall(L.L9, 'weiter', GRENZE);
    await fall(L.L3, 'weiter', FEHLT);
    await fall(L.L5, 'weiter', ENTPACKEN);
    await fall(L.L1, 'abbruch', OHNE_VERBINDUNG);
    const a = await fall(L.L1, B503, FEHLER_503);
    expect(await page.locator(`${STATUS}`).textContent()).toBe(await page.locator(`${MELDUNG} .cl-meldtext`).textContent());
    await expect(page.locator(`${MELDUNG}[role], ${MELDUNG}[aria-live], ${MELDUNG} [role=alert], ${MELDUNG} [aria-live]`)).toHaveCount(0);
    expect(await page.locator(MELDUNG).evaluate(m => Boolean(m.closest('[role=status],[role=alert],[aria-live]')))).toBe(false);
    // zweimal derselbe Fehler: beide Male eine Ansage, ab dem Klick zwei Änderungen
    for (let i = 0; i < 2; i++) {
      await a.leeren();
      await page.locator(ERNEUT).click();
      await expect(page.locator(STATUS)).toHaveText(LIEST);
      await h.freigeben(B503);
      await expect(page.locator(STATUS)).toHaveText(FEHLER_503);
      expect(await a.lesen()).toEqual([`status: ${LIEST}`, `status: ${FEHLER_503}`]);
    }
    // unbekannte Kennung: keine Anfrage, der Statusbereich stand leer im Dokument; „Erneut versuchen“ sagt „Liest …“ und denselben Fehler
    await page.addInitScript(() => {
      window.kdAnsagen = [];
      document.addEventListener('DOMContentLoaded', () => new MutationObserver(eintraege => {
        for (const e of eintraege) {
          const ort = e.target.nodeType === 3 ? e.target.parentElement : e.target;
          const region = ort && ort.closest && ort.closest('[role=status],[role=alert],[aria-live]');
          if (region && region.id === 'lv-status') window.kdAnsagen.push(`status: ${region.textContent}`);
        }
      }).observe(document, { subtree: true, childList: true, characterData: true }));
    });
    await laufOeffnen(page, null, 'niemand%402026-11-20T10%3A00%2B01%3A00');
    await expect(page.locator(STATUS)).toHaveText(UNBEKANNT);
    expect(await page.evaluate(() => window.kdAnsagen.filter(t => t !== 'status: '))).toEqual([`status: ${UNBEKANNT}`]);
    await page.evaluate(() => { window.kdAnsagen = []; });
    await page.locator(ERNEUT).click();
    await expect(page.locator(ERNEUT)).toBeFocused();
    await expect.poll(() => page.evaluate(() => window.kdAnsagen)).toEqual([`status: ${LIEST}`, `status: ${UNBEKANNT}`]);
  });

  test.describe('grober Zeiger', () => {
    test.use({ viewport: { width: 414, height: 900 }, isMobile: true, hasTouch: true });
    test('AK 10: Rückweg, jedes summary, „Erneut versuchen“ und „Ansehen“ sind mindestens 48 × 48 px', async ({ page }) => {
      const h = await halten(page);
      await laeufeOeffnen(page);
      expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
      const mass = ort => ort.evaluate(e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
      for (const m of await page.locator(ANSEHEN).evaluateAll(as => as.map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }))) expect(Math.min(...m)).toBeGreaterThanOrEqual(48);
      await ansehen(page, L.L1).click();
      await h.freigeben(B503);
      await expect(page.locator(ERNEUT)).toBeVisible();
      for (const [ort, wo] of [[page.locator(RUECKWEG), 'Rückweg'], [page.locator(ERNEUT), 'Erneut versuchen']]) expect(Math.min(...await mass(ort)), wo).toBeGreaterThanOrEqual(48);
      await page.locator(ERNEUT).click();
      await h.freigeben();
      await expect(page.locator(EINTRAEGE)).toHaveCount(5);
      for (const m of await page.locator(`${EINTRAEGE} summary`).evaluateAll(s => s.map(e => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }))) expect(Math.min(...m)).toBeGreaterThanOrEqual(48);
    });
  });
});
