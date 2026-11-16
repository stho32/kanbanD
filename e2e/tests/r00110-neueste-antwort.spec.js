// R00110 Fenster zeigt nur den neuesten Stand (Befundkarte #76, ADR-0014): eine ältere Antwort überschreibt nie einen neueren Stand
const { test, expect } = require('@playwright/test');
const { kanbanStarten, einrichten, alsPerson, liveBereit, reiter } = require('./hilfen');

const DATEIEN = {
  'kanbanD.md': '---\npeople:\n  st: {name: Stefan, kind: human}\n  bot: {name: Bot, kind: agent}\n---\n',
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n\n## In Arbeit\n\n## Erledigt\n',
  'aufgaben/0001-abnahme-pruefen.md': '---\nid: 1\ntitle: Abnahme prüfen\n---\n',
  'aufgaben/0002-board-aufraeumen.md': '---\nid: 2\ntitle: Board aufräumen\n---\n',
};
const ALS_BOT = { headers: { 'X-KanbanD-Wer': 'bot' } };
/** Eigene Frist je Warten, unter dem Test-Timeout: bleibt ein Ereignis aus, wird der Test mit Meldung rot und räumt noch auf. */
const FRIST = { timeout: 10000 };

/** Freigaben aller noch gehaltenen Antworten: das Aufräumen gibt sie frei, damit `unrouteAll` nach einem Fehler nicht hängt. */
const offeneFreigaben = [];

/** Ein Versprechen samt seinem Auflöser. */
function versprechen() {
  let aufloesen;
  const zusage = new Promise(ok => { aufloesen = ok; });
  return { zusage, aufloesen };
}

/** Wartet auf `zusage` höchstens FRIST — sonst Fehler mit `was`. */
function abwarten(zusage, was) {
  return Promise.race([zusage, new Promise((_, nein) => setTimeout(() => nein(new Error('ausgeblieben: ' + was)), FRIST.timeout))]);
}

/**
 * Hält die nächste GET-Antwort auf `pfad`, sobald `scharf()` gerufen ist (verzögert antwortender Fake an der Grenze des Browsers):
 * der Server antwortet sofort — der Inhalt ist der Stand von da —, die Seite erhält ihn erst nach `freigeben()` und `verzoegerungMs`.
 */
async function antwortHalten(page, pfad, verzoegerungMs = 0) {
  let scharfGeschaltet = false;
  const angekommen = versprechen(), freigabe = versprechen(), ausgeliefert = versprechen();
  offeneFreigaben.push(freigabe.aufloesen);
  await page.route(url => url.pathname === pfad, async route => {
    if (!scharfGeschaltet || route.request().method() !== 'GET') return route.fallback();
    scharfGeschaltet = false;
    const antwort = await route.fetch();
    angekommen.aufloesen();
    await freigabe.zusage;
    await new Promise(ok => setTimeout(ok, verzoegerungMs));
    await route.fulfill({ response: antwort });
    ausgeliefert.aufloesen();
  });
  return {
    scharf: () => { scharfGeschaltet = true; },
    angekommen: () => abwarten(angekommen.zusage, 'gehaltene Anfrage ' + pfad),
    /** Gibt die gehaltene Antwort frei und wartet, bis der Route-Handler sie ausgeliefert hat. */
    freigeben: () => { freigabe.aufloesen(); return abwarten(ausgeliefert.zusage, 'Auslieferung ' + pfad); },
  };
}

/**
 * Hält ab `scharf()` jede GET-Antwort auf `pfad` — vom Server sofort geholt —, bis `freigeben()` alle ausliefert; danach gehen
 * weitere Anfragen ungehalten durch.
 */
async function alleHalten(page, pfad) {
  let scharfGeschaltet = false, gehalten = 0, ausgeliefert = 0;
  const freigabe = versprechen();
  offeneFreigaben.push(freigabe.aufloesen);
  await page.route(url => url.pathname === pfad, async route => {
    if (!scharfGeschaltet || route.request().method() !== 'GET') return route.fallback();
    gehalten++;
    const antwort = await route.fetch();
    await freigabe.zusage;
    await route.fulfill({ response: antwort });
    ausgeliefert++;
  });
  return {
    scharf: () => { scharfGeschaltet = true; },
    anzahl: () => gehalten,
    /** Gibt alle gehaltenen Antworten frei und wartet, bis jede ausgeliefert ist. */
    freigeben: async () => {
      scharfGeschaltet = false;
      freigabe.aufloesen();
      await expect.poll(() => ausgeliefert, { ...FRIST, message: 'Auslieferung ' + pfad }).toBe(gehalten);
    },
  };
}

/**
 * Zählt in der Seite die Anfragen, deren Antworttext noch nicht gelesen ist: erst danach entscheidet ein Laden über die Übernahme.
 * „Ruhig“ ist die Seite, wenn außer den gehaltenen keine Anfrage mehr offen ist — zwischen dem Lesen der letzten Antwort und dem Zeichnen liegen nur
 * Mikrotasks, die vor dem nächsten `evaluate` laufen — und, nach einem Laden, der zuletzt geladene Stand gezeichnet ist (R00103).
 */
async function anfragenZaehlen(page) {
  await page.addInitScript(() => {
    window.kdOffeneAnfragen = 0;
    const holen = window.fetch.bind(window);
    window.fetch = (...argumente) => {
      window.kdOffeneAnfragen++;
      return holen(...argumente).then(antwort => {
        const lesen = antwort.text.bind(antwort);
        antwort.text = () => lesen().finally(() => { window.kdOffeneAnfragen--; });
        return antwort;
      }, fehler => { window.kdOffeneAnfragen--; throw fehler; });
    };
  });
}
const ruhig = (page, { nachLaden = true, gehalten = 0 } = {}) => expect.poll(() => page.evaluate(
  ({ nachLaden, gehalten }) => window.kdOffeneAnfragen === gehalten && (!nachLaden || window.kdTest.gezeichnet()), { nachLaden, gehalten }),
{ ...FRIST, message: 'Seite kommt nicht zur Ruhe' }).toBe(true);

/** Schreibt über den ganzen Lauf mit: Anzahl Teilaufgaben im Fenster, „nicht live“ und Wegfall von data-live (Live-Auflage, PO Z. 150). */
async function protokollStarten(page) {
  await page.evaluate(() => {
    const p = window.kdProtokoll = { anzahlen: [], nichtLive: false, getrennt: false, dateien: [], anhaenge: [] };
    const notieren = () => {
      p.anzahlen.push(document.querySelectorAll('[role="dialog"] .chk').length);
      if (document.querySelector('.kz-live')) p.nichtLive = true;
      if (document.documentElement.dataset.live !== 'verbunden') p.getrennt = true;
      const kopf = document.querySelector('.mod-kopf .id'), text = document.querySelector('#dateitext');
      if (kopf && text) p.dateien.push({ fenster: kopf.textContent, text: text.textContent });
      const anhaenge = [...document.querySelectorAll('#anhaenge .anh-z a')].map(a => a.textContent);
      if (kopf && anhaenge.length) p.anhaenge.push({ fenster: kopf.textContent, anhaenge });
    };
    new MutationObserver(notieren).observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-live'] });
    notieren();
  });
}
const protokoll = page => page.evaluate(() => window.kdProtokoll);

/** Öffnet die Seite als st und das Fenster von #nummer; die Live-Verbindung steht, der Stand ist gezeichnet. */
async function fensterOeffnen(page, k, nummer) {
  await page.goto(k.adresse);
  await liveBereit(page);
  await page.locator(`.ka[data-id="${nummer}"] .t`).click();
  await expect(page.locator('.mod-kopf .id')).toHaveText('#' + nummer);
  await ruhig(page, { nachLaden: false });
}

async function fremdeAenderung(page, k) {
  const antwort = await page.request.patch(`${k.adresse}api/aufgaben/2`, { ...ALS_BOT, data: { titel: 'Board aufräumen lassen' } });
  expect(antwort.ok()).toBe(true);
}

async function botKommentiert(page, k, nummer, text) {
  const antwort = await page.request.post(`${k.adresse}api/aufgaben/${nummer}/kommentare`, { ...ALS_BOT, data: { text } });
  expect(antwort.ok()).toBe(true);
}

const teilaufgabenTexte = page => page.locator('[role="dialog"] .chk [data-act="teil-bearbeiten"]');
const teilaufgabenKopf = page => page.locator('[role="dialog"] h3', { hasText: 'TEILAUFGABEN' });

/** Zählt die ausgelieferten `GET /api/aufgaben` nach der Antwort auf das Anlegen der Teilaufgabe — die neueren Ladevorgänge. */
function neuereLadevorgaengeZaehlen(page) {
  const zaehler = { nachDemSpeichern: false, ausgeliefert: 0 };
  page.on('response', antwort => {
    const pfad = new URL(antwort.url()).pathname, methode = antwort.request().method();
    if (methode === 'POST' && pfad === '/api/aufgaben/1/teilaufgaben') zaehler.nachDemSpeichern = true;
    else if (methode === 'GET' && pfad === '/api/aufgaben' && zaehler.nachDemSpeichern) zaehler.ausgeliefert++;
  });
  return zaehler;
}

/** „neu“ + Enter im Fenster von #1, bis die Datei die Zeile trägt. */
async function teilaufgabeNeu(page, k) {
  await page.getByLabel('Neue Teilaufgabe').fill('neu');
  await page.getByLabel('Neue Teilaufgabe').press('Enter');
  await expect.poll(() => k.lies('aufgaben/0001-abnahme-pruefen.md'), FRIST).toContain('- [ ] neu\n');
}

/**
 * Herstellung von F1 (Probe E): das Laden aus der fremden Änderung hält seine Liste der Aufgaben; „neu“ + Enter; erst nachdem zwei
 * neuere Ladevorgänge übernommen sind — das der Warteschlange und das aus einem Kommentar von bot an #2 —, kommt die alte Antwort an.
 */
async function alteAntwortNachNeueren(page, k, { verzoegerungMs, aendern }) {
  const liste = await antwortHalten(page, '/api/aufgaben', verzoegerungMs);
  await fensterOeffnen(page, k, 1);
  await expect(teilaufgabenKopf(page)).toHaveText('TEILAUFGABEN 0/0');
  await protokollStarten(page);
  const neuere = neuereLadevorgaengeZaehlen(page);
  liste.scharf();
  await aendern();
  await liste.angekommen();
  await teilaufgabeNeu(page, k);
  await expect.poll(() => neuere.ausgeliefert, { ...FRIST, message: 'das Laden der Warteschlange bleibt aus' }).toBeGreaterThanOrEqual(1);
  await botKommentiert(page, k, 2, 'noch ein Laden');
  await expect.poll(() => neuere.ausgeliefert, { ...FRIST, message: 'das Laden aus dem Kommentar bleibt aus' }).toBeGreaterThanOrEqual(2);
  await ruhig(page, { gehalten: 1 });
  await liste.freigeben();
  await ruhig(page);
}

/** Endbild von F1/F2: Datei, Liste und Kopf zeigen „neu“, die Anzahl fiel nie — auch nach dem Neuladen. */
async function neuBleibtStehen(page, k) {
  expect(k.lies('aufgaben/0001-abnahme-pruefen.md')).toContain('- [ ] neu\n');
  await expect(teilaufgabenTexte(page)).toHaveText(['neu']);
  await expect(teilaufgabenKopf(page)).toHaveText('TEILAUFGABEN 0/1');
  const { anzahlen } = await protokoll(page);
  expect(anzahlen.filter((n, i) => i > 0 && n < anzahlen[i - 1]), 'die Anzahl der Teilaufgaben fällt: ' + anzahlen.join(', ')).toEqual([]);
}

async function gegenprobeNachNeuladen(page) {
  await page.unrouteAll({ behavior: 'wait' });
  await page.reload();
  await liveBereit(page);
  // Seit R00174 trägt die Adresse das offene Fenster: das Neuladen zeigt es wieder, ohne Klick auf die Karte.
  await expect(page.locator('#fenster, #defekt-fenster')).toBeVisible();
  await expect(teilaufgabenTexte(page)).toHaveText(['neu']);
  await expect(teilaufgabenKopf(page)).toHaveText('TEILAUFGABEN 0/1');
}

/**
 * Mutantenprobe (R00110 „Mutanten“): nennt KD_MUTANTE eine JSON-Datei `{ pfad, alt, neu }`, liefert die Seite unter `pfad` die
 * ausgelieferte Datei mit `alt` durch `neu` ersetzt aus. Greift der Ersatz nicht, wirft die Route — der Mutant liegt nie im Repository.
 */
async function mutanteEinsetzen(page) {
  if (!process.env.KD_MUTANTE) return;
  const { pfad, alt, neu } = JSON.parse(require('node:fs').readFileSync(process.env.KD_MUTANTE, 'utf8'));
  await page.route(url => url.pathname === pfad, async route => {
    const antwort = await route.fetch();
    const text = await antwort.text();
    if (!text.includes(alt)) throw new Error(`Mutante greift nicht: ${pfad} enthält ${JSON.stringify(alt)} nicht`);
    await route.fulfill({ response: antwort, body: text.replace(alt, neu) });
  });
}

/** Startet kanbanD mit `dateien`, führt `ablauf` aus und räumt auch nach einem Timeout auf (Server-Stopp im inneren finally). */
async function mitKanban(page, ablauf, dateien = DATEIEN) {
  const k = await kanbanStarten(einrichten(dateien));
  try {
    await alsPerson(page, 'st');
    await mutanteEinsetzen(page);
    await anfragenZaehlen(page);
    await ablauf(k);
  } finally {
    for (const freigeben of offeneFreigaben.splice(0)) freigeben();
    try { await page.unrouteAll({ behavior: 'wait' }); } finally { await k.stoppen(); }
  }
}

for (const verzoegerungMs of [250, 400]) {
  test(`F1: alte Antwort nach neueren, ${verzoegerungMs} ms`, async ({ page }) => {
    await mitKanban(page, async k => {
      await alteAntwortNachNeueren(page, k, { verzoegerungMs, aendern: () => fremdeAenderung(page, k) });
      await neuBleibtStehen(page, k);
      const { nichtLive, getrennt } = await protokoll(page);
      expect({ nichtLive, getrennt }, 'Live-Auflage: „nicht live“ erscheint nie, data-live bleibt').toEqual({ nichtLive: false, getrennt: false });
      await expect(page.locator('.ka[data-id="2"] .t')).toHaveText('Board aufräumen lassen');
      await gegenprobeNachNeuladen(page);
    });
  });
}

test('F1 Regression: 0 ms unter CPU-Drossel 6×', async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await mitKanban(page, async k => {
    await alteAntwortNachNeueren(page, k, { verzoegerungMs: 0, aendern: () => fremdeAenderung(page, k) });
    await neuBleibtStehen(page, k);
    await gegenprobeNachNeuladen(page);
  });
});

/**
 * Herstellung von F2: das Laden aus der Änderung `aendern` hält seine Liste der Aufgaben; „neu“ + Enter; die alte Antwort kommt an,
 * nachdem die Schlange leer ist, aber bevor ihr Laden (Q) und das Echo des eigenen Schreibens (E) übernommen sind.
 */
async function alteAntwortVorDerMarke(page, k, aendern) {
  const liste = await antwortHalten(page, '/api/aufgaben');
  const zustand = await alleHalten(page, '/api/zustand');
  await fensterOeffnen(page, k, 1);
  await protokollStarten(page);
  liste.scharf();
  await aendern();
  await liste.angekommen();
  // das Laden der leer gewordenen Schlange (Q) und das Echo des eigenen Schreibens (E) bleiben vor ihrer Übernahme stehen
  zustand.scharf();
  await teilaufgabeNeu(page, k);
  await expect.poll(() => zustand.anzahl(), { ...FRIST, message: 'das Laden der Warteschlange bleibt aus' }).toBeGreaterThanOrEqual(1);
  await expect(teilaufgabenTexte(page), 'optimistisch eingetragen').toHaveText(['neu']);
  await liste.freigeben();
  await expect.poll(async () => await page.evaluate(() => window.kdOffeneAnfragen) - zustand.anzahl(), { ...FRIST, message: 'die alte Antwort ist nicht verarbeitet' }).toBe(0);
  await expect(teilaufgabenTexte(page), 'die alte Antwort ersetzt die eigene Teilaufgabe nicht').toHaveText(['neu']);
  await zustand.freigeben();
  await ruhig(page);
}

test('F2: alte Antwort kommt zwischen dem Leeren der Schlange und ihrem eigenen Laden an', async ({ page }) => {
  await mitKanban(page, async k => {
    await alteAntwortVorDerMarke(page, k, () => fremdeAenderung(page, k));
    await neuBleibtStehen(page, k);
    await gegenprobeNachNeuladen(page);
  });
});

/** Einträge des Protokolls, in denen das Fenster von `fenster` eine Datei mit `text` zeigte. */
const fremdeDatei = async (page, fenster, text) => (await protokoll(page)).dateien.filter(d => d.fenster === fenster && d.text.includes(text));

/**
 * F3 (Probe F): das Laden aus einem Kommentar an #1 hält die neue Datei von #1, das Blättern zu #2 die Datei von #2. Wird die alte
 * zuerst frei, ist sie neuer als alles, was das Fenster übernommen hat — nur der Vergleich mit der offenen Aufgabe verwirft sie.
 */
test('F3: nach dem Öffnen einer anderen Aufgabe zeigt die Ansicht „Datei“ deren Datei, nie die der vorigen', async ({ page }) => {
  await mitKanban(page, async k => {
    const dateiVonEins = await antwortHalten(page, '/api/aufgaben/1');
    const dateiVonZwei = await antwortHalten(page, '/api/aufgaben/2');
    await fensterOeffnen(page, k, 1);
    await reiter(page, 'Datei');
    await expect(page.locator('#dateitext')).toContainText('Abnahme prüfen');
    await protokollStarten(page);
    dateiVonEins.scharf();
    await botKommentiert(page, k, 1, 'ein Laden');
    await dateiVonEins.angekommen();
    expect(k.lies('aufgaben/0001-abnahme-pruefen.md'), 'die gehaltene Datei von #1 trägt den Kommentar').toContain('ein Laden');
    dateiVonZwei.scharf();
    await page.locator('#fenster [data-act="schliessen"]').click();
    await page.locator('.ka[data-id="2"] .t').click();
    await dateiVonZwei.angekommen();
    await dateiVonEins.freigeben();
    await ruhig(page, { gehalten: 1, nachLaden: false });
    expect(await fremdeDatei(page, '#2', 'ein Laden'), 'das Fenster von #2 zeigte die neue Datei von #1').toEqual([]);
    await dateiVonZwei.freigeben();
    await ruhig(page, { nachLaden: false });
    await expect(page.locator('.mod-kopf .id')).toHaveText('#2');
    await expect(page.locator('#dateitext')).toContainText('Board aufräumen');
    expect(await fremdeDatei(page, '#2', 'ein Laden'), 'das Fenster von #2 zeigte die neue Datei von #1').toEqual([]);
    await page.unrouteAll({ behavior: 'wait' });
    await page.reload();
    await liveBereit(page);
    // Seit R00174 trägt die Adresse das offene Fenster: das Neuladen zeigt es wieder, ohne Klick auf die Karte.
    await expect(page.locator('#fenster, #defekt-fenster')).toBeVisible();
    await reiter(page, 'Datei');
    await expect(page.locator('#dateitext')).toContainText('Board aufräumen');
  });
});

/** Ändert #2 außerhalb von kanbanD in der Datei: nur so kommt das Ereignis als „extern“ an (R00050). */
async function externAendern(k) {
  k.schreib('aufgaben/0002-board-aufraeumen.md', '---\nid: 2\ntitle: Board aufräumen lassen\n---\n');
}

/** Markierung „extern“ an #2, nur dort. */
async function nurZweiExtern(page) {
  await expect(page.locator('.ka[data-id="2"] .t')).toHaveText('Board aufräumen lassen');
  await expect(page.locator('.ka[data-id="2"]')).toHaveClass(/\bfremd\b/);
  await expect(page.locator('.ka[data-id="2"] .ein')).toContainText('extern · aufgaben/0002-board-aufraeumen.md');
  await expect(page.locator('.ka[data-id="1"]'), 'nur die geänderte Datei ist markiert').not.toHaveClass(/\bfremd\b/);
}

/**
 * F4 (Regel 7): wie F1, aber die Änderung kommt von außen; das Laden ihres Ereignisses wird verworfen, nachdem neuere übernommen sind.
 * Die Markierung der fremden Änderung hängt trotzdem an Karte #2 — gesetzt aus dem Stand, der es überholt hat, innerhalb der 10 s, die sie steht.
 */
test('F4: wird das Laden eines Ereignisses von außen nach neueren verworfen, trägt die Karte trotzdem die Markierung „extern“', async ({ page }) => {
  await mitKanban(page, async k => {
    await alteAntwortNachNeueren(page, k, { verzoegerungMs: 250, aendern: () => externAendern(k) });
    await neuBleibtStehen(page, k);
    await nurZweiExtern(page);
  });
});

/** F4, zweiter Weg: verworfen vor der Marke, noch kein neueres übernommen — das Laden der Schlange trägt die Markierung nach. */
test('F4: wird das Laden eines Ereignisses von außen vor der Marke verworfen, markiert das Laden der Schlange die Karte', async ({ page }) => {
  await mitKanban(page, async k => {
    await alteAntwortVorDerMarke(page, k, () => externAendern(k));
    await neuBleibtStehen(page, k);
    await nurZweiExtern(page);
  });
});

/**
 * Hält die nächste Anfrage `methode` auf `pfad`, sobald `scharf()` gerufen ist, bevor sie den Server erreicht: so bleibt eine
 * eigene Änderung in der Warteschlange offen, bis `freigeben()` sie durchlässt.
 */
async function anfrageHalten(page, methode, pfad) {
  let scharfGeschaltet = false;
  const angekommen = versprechen(), freigabe = versprechen(), beantwortet = versprechen();
  offeneFreigaben.push(freigabe.aufloesen);
  await page.route(url => url.pathname === pfad, async route => {
    if (!scharfGeschaltet || route.request().method() !== methode) return route.fallback();
    scharfGeschaltet = false;
    angekommen.aufloesen();
    await freigabe.zusage;
    await route.fallback();
    beantwortet.aufloesen();
  });
  return {
    scharf: () => { scharfGeschaltet = true; },
    angekommen: () => abwarten(angekommen.zusage, `gehaltene Anfrage ${methode} ${pfad}`),
    freigeben: () => { freigabe.aufloesen(); return abwarten(beantwortet.zusage, `Durchlass ${methode} ${pfad}`); },
  };
}

const DEFEKT_PFAD = 'aufgaben/0003-defekt.md';
/** G1: Konfliktmarker; G2: kaputtes YAML — zwei verschiedene Gründe, damit sichtbar ist, welcher Stand übernommen wurde. */
const DEFEKT_G1 = '---\nid: 3\n<<<<<<< HEAD\ntitle: drei\n=======\ntitle: drei anders\n>>>>>>> zweig\n---\n';
const DEFEKT_G2 = '---\nid: 3\ntitle: [kaputt\n---\n';
const REPARIERT = '---\nid: 3\ntitle: drei repariert\n---\n';
const MIT_DEFEKT = {
  ...DATEIEN,
  'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #1\n- #2\n- #3\n\n## In Arbeit\n\n## Erledigt\n',
  [DEFEKT_PFAD]: DEFEKT_G1,
};

/** Öffnet die Seite und das Fenster der defekten #3 mit Grund G1. */
async function defektFensterOeffnen(page, k) {
  await page.goto(k.adresse);
  await liveBereit(page);
  await page.locator('.ka.defekt[data-id="3"]').click();
  await expect(page.locator('#defekttext')).toContainText('<<<<<<< HEAD');
  await ruhig(page, { nachLaden: false });
}

/** Endbild: das Defektfenster von #3 steht und zeigt G2 — nicht das normale Fenster mit leerer Datei. */
async function defektZeigtG2(page) {
  await expect(page.locator('#defekt-fenster')).toBeVisible();
  await expect(page.locator('#defekttext')).toContainText('title: [kaputt');
  await expect(page.locator('#defekt-fenster .warnbar')).not.toContainText('Konflikt');
  await expect(page.locator('#fenster')).toHaveCount(0);
}

async function defektGegenprobe(page) {
  await page.unrouteAll({ behavior: 'wait' });
  await page.reload();
  await liveBereit(page);
  // Seit R00174 trägt die Adresse das offene Fenster: das Neuladen zeigt es wieder, ohne Klick auf die Karte.
  await expect(page.locator('#fenster, #defekt-fenster')).toBeVisible();
  await defektZeigtG2(page);
}

/**
 * N1 (Nacharbeit 1): das Laden A aus der Reparatur liest #3 „repariert“ (200) und wird gehalten; die Datei wird wieder defekt (G2),
 * Laden B liest 423 und übernimmt. Kommt A danach an, ist es älter als das, was das Fenster übernommen hat — es schaltet nicht um.
 */
for (const verzoegerungMs of [0, 250, 400]) {
  test(`N1: eine ältere Antwort „repariert“ schaltet das Defektfenster nicht um, ${verzoegerungMs} ms`, async ({ page }) => {
    await mitKanban(page, async k => {
      const reparatur = await antwortHalten(page, '/api/aufgaben/3', verzoegerungMs);
      await defektFensterOeffnen(page, k);
      reparatur.scharf();
      k.schreib(DEFEKT_PFAD, REPARIERT);
      await reparatur.angekommen();
      k.schreib(DEFEKT_PFAD, DEFEKT_G2);
      await expect(page.locator('#defekttext'), 'Laden B übernimmt G2').toContainText('title: [kaputt');
      await ruhig(page, { gehalten: 1 });
      await reparatur.freigeben();
      await ruhig(page);
      await defektZeigtG2(page);
      await defektGegenprobe(page);
    }, MIT_DEFEKT);
  });
}

/**
 * N1, umgekehrte Reihenfolge: A („repariert“) kommt zuerst an und schaltet um, B (423, G2) ist neuer und kommt danach —
 * B schaltet das Fenster derselben Aufgabe zurück, obwohl es inzwischen im normalen Modus steht (Vergleich mit der offenen Nummer).
 */
test('N1: eine neuere Antwort „defekt“ nach der älteren „repariert“ schaltet zurück auf das Defektfenster', async ({ page }) => {
  await mitKanban(page, async k => {
    // der zuletzt angelegte Halter fängt zuerst: antwortA hält das Laden der Reparatur, antwortB das des neuen Defekts
    const antwortB = await antwortHalten(page, '/api/aufgaben/3');
    const antwortA = await antwortHalten(page, '/api/aufgaben/3');
    await defektFensterOeffnen(page, k);
    antwortA.scharf();
    k.schreib(DEFEKT_PFAD, REPARIERT);
    await antwortA.angekommen();
    antwortB.scharf();
    k.schreib(DEFEKT_PFAD, DEFEKT_G2);
    await antwortB.angekommen();
    await antwortA.freigeben();
    await ruhig(page, { gehalten: 1, nachLaden: false });
    await antwortB.freigeben();
    await ruhig(page);
    await defektZeigtG2(page);
    await defektGegenprobe(page);
  }, MIT_DEFEKT);
});

/**
 * N1 bei offener Schlange: A („repariert“) ist gehalten, ein Abhaken auf dem Board hält die Warteschlange offen, die Datei wird wieder
 * defekt (G2) — das Ereignis lädt nicht, solange die Schlange offen ist. A kommt bei offener Schlange an und wird verworfen;
 * das Laden der leer gewordenen Schlange zeigt G2.
 */
test('N1: bei offener Warteschlange schaltet die Antwort „repariert“ das Defektfenster nicht um', async ({ page }) => {
  await mitKanban(page, async k => {
    const anlegen = await page.request.post(`${k.adresse}api/aufgaben/1/teilaufgaben`, { ...ALS_BOT, data: { text: 'eins' } });
    expect(anlegen.ok()).toBe(true);
    const reparatur = await antwortHalten(page, '/api/aufgaben/3');
    const abhaken = await anfrageHalten(page, 'PATCH', '/api/aufgaben/1/teilaufgaben/0');
    await defektFensterOeffnen(page, k);
    reparatur.scharf();
    k.schreib(DEFEKT_PFAD, REPARIERT);
    await reparatur.angekommen();
    abhaken.scharf();
    // die Karte liegt unter dem Fenster: der Klick geht direkt an den Knopf, wie ihn die Delegation sieht
    await page.locator('.ka[data-id="1"] .naechste-ziel').dispatchEvent('click');
    await abhaken.angekommen();
    k.schreib(DEFEKT_PFAD, DEFEKT_G2);
    await reparatur.freigeben();
    await ruhig(page, { gehalten: 1, nachLaden: false });
    await expect(page.locator('#defekt-fenster'), 'die Antwort „repariert“ bei offener Schlange schaltet nicht um').toBeVisible();
    await abhaken.freigeben();
    await ruhig(page);
    await defektZeigtG2(page);
    await defektGegenprobe(page);
  }, MIT_DEFEKT);
});

/** Einträge des Protokolls, in denen das Fenster von `fenster` den Anhang `name` zeigte. */
const fremderAnhang = async (page, fenster, name) => (await protokoll(page)).anhaenge.filter(a => a.fenster === fenster && a.anhaenge.includes(name));

/**
 * N3: eine eigene Teilaufgabe an #1 hält die Warteschlange offen; der Wechsel zu #2 lädt dessen Datei, die bei offener Schlange
 * verworfen wird. Bis die Schlange leer ist, zeigt das Fenster von #2 nichts von #1 — weder Anhang noch Datei.
 */
const MIT_ANHANG = { ...DATEIEN, 'aufgaben/0001-abnahme-pruefen/protokoll.txt': 'Inhalt des Protokolls' };
const WECHSEL = {
  'schließen und öffnen': async page => {
    await page.locator('#fenster [data-act="schliessen"]').click();
    await page.locator('.ka[data-id="2"] .t').click();
  },
};
for (const [wie, wechseln] of Object.entries(WECHSEL)) {
  test(`N3: nach ${wie} bei offener Warteschlange zeigt #2 weder Anhang noch Datei von #1`, async ({ page }) => {
    await mitKanban(page, async k => {
      const anlegen = await anfrageHalten(page, 'POST', '/api/aufgaben/1/teilaufgaben');
      await fensterOeffnen(page, k, 1);
      await expect(page.getByRole('link', { name: 'protokoll.txt' })).toBeVisible();
      await protokollStarten(page);
      anlegen.scharf();
      await page.getByLabel('Neue Teilaufgabe').fill('neu');
      await page.getByLabel('Neue Teilaufgabe').press('Enter');
      await anlegen.angekommen();
      await wechseln(page);
      await expect(page.locator('.mod-kopf .id')).toHaveText('#2');
      await ruhig(page, { gehalten: 1, nachLaden: false });
      expect(await fremderAnhang(page, '#2', 'protokoll.txt'), 'das Fenster von #2 zeigte den Anhang von #1').toEqual([]);
      await reiter(page, 'Datei');
      expect(await fremdeDatei(page, '#2', 'Abnahme prüfen'), 'das Fenster von #2 zeigte die Datei von #1').toEqual([]);
      await anlegen.freigeben();
      await ruhig(page);
      await expect(page.locator('#dateitext')).toContainText('Board aufräumen');
      await reiter(page, 'Inhalt');
      await expect(page.locator('#fenster #anhaenge .anh-z')).toHaveCount(0);
      expect(await fremderAnhang(page, '#2', 'protokoll.txt'), 'das Fenster von #2 zeigte den Anhang von #1').toEqual([]);
      expect(await fremdeDatei(page, '#2', 'Abnahme prüfen'), 'das Fenster von #2 zeigte die Datei von #1').toEqual([]);
      expect(k.lies('aufgaben/0001-abnahme-pruefen.md'), 'die Teilaufgabe ist gespeichert').toContain('- [ ] neu\n');
      await page.unrouteAll({ behavior: 'wait' });
      await page.reload();
      await liveBereit(page);
      // Seit R00174 trägt die Adresse das offene Fenster: das Neuladen zeigt es wieder, ohne Klick auf die Karte.
      await expect(page.locator('#fenster, #defekt-fenster')).toBeVisible();
      await expect(page.locator('#fenster #anhaenge .anh-z')).toHaveCount(0);
      await reiter(page, 'Datei');
      await expect(page.locator('#dateitext')).toContainText('Board aufräumen');
    }, MIT_ANHANG);
  });
}

/**
 * B4 (Nacharbeit 2): Laden A (älter) liest #3 noch defekt (423 G1) und wird gehalten; die Datei wird repariert, Laden B (neuer) liest
 * 200, schaltet das Fenster in den normalen Modus und wartet auf die Anhänge. Kommt A jetzt an, ist es älter als das Umschalten
 * von B — es schaltet nicht in den veralteten Defektmodus zurück, und B übernimmt danach die reparierte Datei.
 */
for (const verzoegerungMs of [0, 250, 400]) {
  test(`B4: eine ältere Antwort „defekt“ schaltet die neuere Reparatur nicht zurück, ${verzoegerungMs} ms`, async ({ page }) => {
    await mitKanban(page, async k => {
      const antwortA = await antwortHalten(page, '/api/aufgaben/3', verzoegerungMs);
      const anhaengeB = await antwortHalten(page, '/api/aufgaben/3/anhaenge');
      await defektFensterOeffnen(page, k);
      antwortA.scharf();
      k.schreib('aufgaben/0001-abnahme-pruefen.md', '---\nid: 1\ntitle: Abnahme prüfen, geändert\n---\n');
      await antwortA.angekommen();
      anhaengeB.scharf();
      k.schreib(DEFEKT_PFAD, REPARIERT);
      await anhaengeB.angekommen();
      await ruhig(page, { gehalten: 2, nachLaden: false });
      await antwortA.freigeben();
      await ruhig(page, { gehalten: 1, nachLaden: false });
      await anhaengeB.freigeben();
      await ruhig(page);
      await repariertSichtbar(page);
      await page.unrouteAll({ behavior: 'wait' });
      await page.reload();
      await liveBereit(page);
      // Seit R00174 trägt die Adresse das offene Fenster: das Neuladen zeigt es wieder, ohne Klick auf die Karte.
      await expect(page.locator('#fenster, #defekt-fenster')).toBeVisible();
      await repariertSichtbar(page);
    }, MIT_DEFEKT);
  });
}

/** Endbild: das normale Fenster von #3 zeigt die reparierte Datei, kein Defektfenster. */
async function repariertSichtbar(page) {
  await expect(page.locator('#defekt-fenster')).toHaveCount(0);
  await expect(page.locator('.mod-kopf .id')).toHaveText('#3');
  await reiter(page, 'Datei');
  await expect(page.locator('#dateitext')).toContainText('drei repariert');
}
