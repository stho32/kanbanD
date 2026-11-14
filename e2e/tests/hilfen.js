// Startet kanbanD gegen einen frischen Ordner und räumt danach auf.
//
// Warten (ADR-0026, R00150): Proben warten auf den Zielzustand, nie auf Zeit. Fünf Regeln:
//  1. Nach einer Aktion keine nackte Lesung (`innerText`, `getBoundingClientRect`, `page.evaluate`, `k.lies`, `k.git`):
//     der Zielzustand wird mit einer Locator-Zusicherung oder `await expect.poll(() => …)` geprüft.
//  2. Nach `setViewportSize` erst das Layout stehen lassen: `breiteSetzen(page, breite, hoehe)`, dann messen; ebenso nach dem
//     ersten Sichtbarwerden eines neu geöffneten Elements.
//  3. Vor jeder Messung, Zählung oder dem Renderzähler steht die Ansicht: `await bereit(page, anker)` (live verbunden, Anker
//     der Ansicht sichtbar, `kdTest.gezeichnet()`); `liveBereit` allein bestätigt nur die Leitung, nicht den gezeichneten Stand.
//  4. Nach einem Dateischreiben auf Commit und Zustand warten (`expect.poll(() => k.lies(rel))`, `k.git(…)`); auf ein
//     Live-Ereignis über `bereit`, nie mit `page.waitForTimeout`.
//  5. Eine Frist ist nur für das Ausbleiben eines Ereignisses erlaubt; `waitForTimeout` als Synchronisierung ist untersagt.
//     Wird eine Dauer beobachtet, steht die Messgrundlage erst nach `bereit()`, und die Zeit läuft über `page.clock`.
//     `imFokus` misst nur und ist kein Wartemittel.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROGRAMM = path.resolve(__dirname, '../../target/debug/kanbanD');

// Kein automatisches `git gc` in den Testordnern: es läuft nach einem Commit losgelöst im Hintergrund weiter und
// schreibt noch in .git/objects/pack, während `stoppen` den Ordner löscht (ENOTEMPTY auf der CI). Gilt für kanbanD
// und jeden git-Aufruf der Tests, weil beide die Umgebung dieses Prozesses erben.
Object.assign(process.env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'gc.auto', GIT_CONFIG_VALUE_0: '0' });
// Server in derselben Zone wie der Browser (timezoneId), damit der Versatz neuer Zeitpunkte feststeht (R00084)
process.env.TZ = 'Europe/Berlin';

/** Startet kanbanD und liefert die Adresse aus der Startzeile; `umgebung` ergänzt die Umgebungsvariablen. */
function programmStarten(ordner, port, umgebung) {
  const kind = spawn(PROGRAMM, [ordner, '--kein-browser', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...umgebung } });
  const adresse = new Promise((ok, fehler) => {
    let puffer = '';
    kind.stdout.on('data', d => { puffer += d; const m = /(http:\/\/\S+)/.exec(puffer); if (m) ok(m[1]); });
    kind.once('exit', c => fehler(new Error('kanbanD beendet mit ' + c)));
  });
  return { kind, adresse };
}

async function kanbanStarten(vorbereiten, umgebung = {}) {
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-e2e-'));
  const ordner = path.join(wurzel, 'kanban');
  if (vorbereiten) await vorbereiten(ordner);
  let { kind, adresse } = programmStarten(ordner, 0, umgebung);
  adresse = await adresse;
  const beenden = () => new Promise(ok => { if (kind.exitCode !== null) ok(); else { kind.once('exit', ok); kind.kill(); } });
  return {
    ordner, adresse,
    // Neustart auf demselben Port (R00085): offene Seiten müssen von selbst wieder verbinden
    neuStarten: async () => {
      await beenden();
      const neu = programmStarten(ordner, new URL(adresse).port, umgebung);
      kind = neu.kind;
      await neu.adresse;
    },
    git: (...args) => execFileSync('git', ['-C', ordner, ...args], { encoding: 'utf8' }).trim(),
    lies: rel => fs.readFileSync(path.join(ordner, rel), 'utf8'),
    schreib: (rel, inhalt) => { fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true }); fs.writeFileSync(path.join(ordner, rel), inhalt); },
    // Erst auf das Ende des Programms warten — ein laufender Commit schreibt sonst noch in .git.
    stoppen: async () => {
      await beenden();
      fs.rmSync(wurzel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    },
  };
}

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  mi: {name: Mia, kind: human}
  cl: {name: Claude, kind: agent}
  ab: {name: Anna, kind: human, active: false}
classes:
  bug: {label: Fehler, color: red}
  feature: {label: Funktion, color: green}
sources:
  wbs: plan/wbs.md
  requirements: anf/
---
`;

/** Ein eingerichteter Ordner: Stefan, Mia (Menschen), Claude (Agent), Anna (stillgelegt), Board „Entwicklung“. */
function einrichten(dateien = {}) {
  return ordner => {
    const alle = { 'kanbanD.md': EINSTELLUNGEN, 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n', ...dateien };
    for (const [rel, inhalt] of Object.entries(alle)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

/** Wählt im Tab die Identität, bevor die Seite lädt. */
async function alsPerson(page, kuerzel) {
  await page.addInitScript(k => sessionStorage.setItem('kanbanD.ich', k), kuerzel);
}

/** Wählt im Aufgabenfenster die Ansicht `name` (R00145: ein Menü am Fensterkopf statt der Reiterleiste — der Name des
 *  Helfers stammt aus der Reiterzeit und bleibt die eine Stelle für alle Suiten). */
async function reiter(page, name) {
  const menue = page.locator('#fenster [role="menu"][data-art="ansicht"]');
  if (await menue.count() === 0) await page.locator('#fenster [data-act="fenster-menue"][data-arg="ansicht"]').click();
  await menue.getByRole('menuitemradio', { name, exact: true }).click();
}

/** Wartet, bis die Seite live verbunden ist — erst dann kommt eine Änderung von außen sicher an (R00050). */
async function liveBereit(page) {
  await page.locator('html[data-live="verbunden"]').waitFor({ state: 'attached' });
}

/**
 * Die Ansicht steht (ADR-0026 Regel 3): live verbunden, der Anker der Ansicht sichtbar und der geladene Stand gezeichnet
 * (`kdTest.gezeichnet()`, R00103). `anker` ist ein Locator oder ein Selektor — ein Element, das erst mit dem fertigen Zeichnen entsteht.
 */
async function bereit(page, anker) {
  await liveBereit(page);
  if (anker) await (typeof anker === 'string' ? page.locator(anker).first() : anker).waitFor({ state: 'visible' });
  await page.waitForFunction(() => window.kdTest.gezeichnet());
}

/**
 * Setzt die Fenstergröße und wartet, bis sie im Fenster steht, der resize-Hörer neu gezeichnet und das Layout gerechnet hat
 * (zwei Frames; ADR-0026 Regel 2). Erst danach wird gemessen. Ohne `hoehe` bleibt die Höhe des Fensters.
 */
async function breiteSetzen(page, breite, hoehe = page.viewportSize().height) {
  await page.setViewportSize({ width: breite, height: hoehe });
  await page.waitForFunction(([b, h]) => innerWidth === b && innerHeight === h, [breite, hoehe]);
  await page.evaluate(() => new Promise(fertig => requestAnimationFrame(() => requestAnimationFrame(fertig))));
}

/** Öffnet die zugeklappte Filterbox der Berichte (R00081); offen bleibt sie für den Rest des Tests. */
async function filterOeffnen(page) {
  const box = page.locator('details.bfilter-box');
  // erst wenn die Ansicht steht: ein Neuzeichnen danach nähme dem Knopf „Zurücksetzen“ und dem Zustand der Box den Boden (ADR-0026 Regel 3)
  await bereit(page, box.locator('summary'));
  if (await box.getAttribute('open') === null) await box.locator('summary').click();
  await page.getByRole('group', { name: 'Berichtsfilter' }).waitFor();
}

/** Öffnet das Menü „Mehr“ der Kopfzeile (R00101), falls es zu ist. */
async function mehrOeffnen(page) {
  const menue = page.locator('#pop[aria-label="Mehr"]');
  if (await menue.count() === 0) await page.locator('#t-mehr').click();
  await menue.waitFor();
}

/** Wählt einen Eintrag im Menü „Mehr“ (R00101: früher ein eigener Knopf der Kopfzeile) und schließt das Menü, falls es offen bleibt. */
async function ausMehr(page, eintrag) {
  await mehrOeffnen(page);
  await page.locator('#pop[aria-label="Mehr"] .iz', { hasText: eintrag }).click();
  if (await page.locator('#pop[aria-label="Mehr"]').count()) await page.keyboard.press('Escape');
}

/** Setzt das Thema wie ein Nutzer mit Systemvorgabe und Umschalter: Medienabfrage und `data-theme` (R00070). */
async function thema(page, name) {
  await page.emulateMedia({ colorScheme: name });
  await page.evaluate(t => { document.documentElement.dataset.theme = t; }, name);
}

/*
 * Kontrast nach WCAG im Browser (R00107, Funktionale Anforderung 17). Der eine Ort, an dem Farben über ein 1×1-Canvas
 * in sRGB aufgelöst werden: oklch, color-mix und Transparenz rechnet so der Browser selbst. Gemalt wird wie der Browser
 * komponiert: je Vorfahr eine Ebene aus seinem Hintergrund und der Ebene darin, die mit ihrer `opacity` als Gruppe
 * daraufkommt; ganz unten Weiß. Einmal mit der Schrift (Schriftpixel), einmal ohne (Grund daneben).
 */
function kontrastWerkzeugEinbauen() {
  if (window.kdKontrast) return;
  const neueEbene = () => {
    const leinwand = document.createElement('canvas');
    leinwand.width = leinwand.height = 1;
    return leinwand.getContext('2d', { willReadFrequently: true });
  };
  const ebenen = [neueEbene(), neueEbene()];
  /** Füllt die Ebene mit der Farbe; eine Farbe, die der Browser nicht kennt, ist ein Fehler statt still Schwarz. */
  const fuellen = (ebene, farbe) => {
    ebene.fillStyle = '#000'; ebene.fillStyle = farbe; const nachSchwarz = ebene.fillStyle;
    ebene.fillStyle = '#fff'; ebene.fillStyle = farbe;
    if (nachSchwarz === '#000000' && ebene.fillStyle === '#ffffff') throw new Error(`keine Farbe: ${farbe}`);
    ebene.fillRect(0, 0, 1, 1);
  };
  const pixel = ebene => [...ebene.getImageData(0, 0, 1, 1).data];
  const gemalt = schichten => {
    const ebene = ebenen[0];
    ebene.clearRect(0, 0, 1, 1);
    for (const farbe of schichten) fuellen(ebene, farbe);
    return pixel(ebene);
  };
  const linear = v => { const x = v / 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  const leuchtdichte = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  const verhaeltnis = (a, b) => { const [h, d] = [leuchtdichte(a), leuchtdichte(b)].sort((x, y) => y - x); return (h + 0.05) / (d + 0.05); };
  const opazitaet = e => Number(getComputedStyle(e).opacity);
  /** Das Pixel am Element: seine Ebene (Hintergrund, ggf. Schrift), dann je Vorfahr dessen Hintergrund mit der Ebene darin als Gruppe. */
  const komponiert = (e, schrift) => {
    let [innen, aussen] = ebenen;
    innen.clearRect(0, 0, 1, 1);
    fuellen(innen, getComputedStyle(e).backgroundColor);
    if (schrift) fuellen(innen, schrift);
    let deckung = opazitaet(e);
    for (let x = e.parentElement; x; x = x.parentElement) {
      aussen.clearRect(0, 0, 1, 1);
      fuellen(aussen, getComputedStyle(x).backgroundColor);
      aussen.globalAlpha = deckung; aussen.drawImage(innen.canvas, 0, 0); aussen.globalAlpha = 1;
      [innen, aussen] = [aussen, innen];
      deckung = opazitaet(x);
    }
    aussen.clearRect(0, 0, 1, 1);
    fuellen(aussen, '#fff');
    aussen.globalAlpha = deckung; aussen.drawImage(innen.canvas, 0, 0); aussen.globalAlpha = 1;
    return pixel(aussen);
  };
  const schriftGegenGrund = (e, schrift) => verhaeltnis(komponiert(e, schrift), komponiert(e, null));
  /** Opazität des Elements mal der aller Vorfahren; 0 heißt unsichtbar. */
  const gesamtOpazitaet = e => { let produkt = 1; for (let x = e; x; x = x.parentElement) produkt *= opazitaet(x); return produkt; };
  const eigenerText = e => [...e.childNodes].filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join('').trim();
  const sichtbar = e => e.getClientRects().length > 0 && getComputedStyle(e).visibility === 'visible' && gesamtOpazitaet(e) > 0;
  const inaktiv = e => e.closest('[aria-disabled="true"], :disabled') !== null;
  const beschreibung = e => e.localName + (e.id ? '#' + e.id : '') + [...e.classList].map(k => '.' + k).join('');
  const OHNE_TEXT = ['checkbox', 'radio', 'color', 'range', 'hidden', 'file'];
  /** Je Element die Schrift, die es zeigt: eigener Text, Wert eines Felds oder sein Platzhalter. */
  const schriften = e => {
    const feld = e.matches('input, textarea') && !OHNE_TEXT.includes(e.type);
    if (feld && !e.value && e.placeholder) return [{ text: e.placeholder, farbe: getComputedStyle(e, '::placeholder').color, art: '::placeholder' }];
    if (feld && e.value) return [{ text: e.value, farbe: getComputedStyle(e).color, art: '' }];
    const text = eigenerText(e);
    return text ? [{ text, farbe: getComputedStyle(e).color, art: '' }] : [];
  };
  const messungen = (bereich, e) => schriften(e).map(s => ({ bereich, element: beschreibung(e) + s.art, text: s.text.slice(0, 40), wert: schriftGegenGrund(e, s.farbe) }));
  const fokussierbar = e => e.tabIndex >= 0 && !inaktiv(e);
  /** Bis zum Zeigen oder Fokussieren unsichtbar (`opacity:0`, sichtbar bei `:focus`): gemessen im fokussierten Zustand, danach Fokus zurück. */
  const imFokus = (bereich, e) => {
    const vorher = document.activeElement;
    e.focus({ preventScroll: true });
    const ergebnis = document.activeElement === e && sichtbar(e) ? messungen(bereich, e) : [];
    if (vorher instanceof HTMLElement && vorher !== document.body) vorher.focus({ preventScroll: true }); else e.blur();
    return ergebnis;
  };
  const messen = (bereiche, ohne = []) => bereiche.flatMap(bereich => [...document.querySelectorAll(bereich)]
    .flatMap(wurzel => [wurzel, ...wurzel.querySelectorAll('*')])
    .filter(e => !inaktiv(e) && !ohne.some(sel => e.closest(sel)))
    .flatMap(e => sichtbar(e) ? messungen(bereich, e) : fokussierbar(e) && e.getClientRects().length > 0 ? imFokus(bereich, e) : []));
  window.kdKontrast = { messen, schriftGegenGrund, verhaeltnis: (a, b) => verhaeltnis(gemalt(['#fff', a]), gemalt(['#fff', b])), leuchtdichte: f => leuchtdichte(gemalt(['#fff', f])), pixel: f => gemalt(['#fff', f]) };
}

/**
 * Alle Schriften mit eigenem Text unter den Bereichen: [{bereich, element, text, wert}]; Inaktives zählt nicht, ebenso nichts unter
 * einem Selektor aus `ohne` (ausdrücklich nicht gemessen). `wert` ist ungerundet — gerundet wird nur für die Anzeige, nie vor dem Vergleich mit dem Maß.
 */
async function kontrastMessen(page, bereiche, ohne = []) {
  await page.evaluate(kontrastWerkzeugEinbauen);
  return page.evaluate(([b, o]) => window.kdKontrast.messen(b, o), [bereiche, ohne]);
}

/** Die Messungen unter dem Maß — die Probe meldet alle Verstöße auf einmal statt beim ersten abzubrechen. */
async function kontrastVerstoesse(page, bereiche, mass = 4.5) {
  return (await kontrastMessen(page, bereiche)).filter(m => m.wert < mass);
}

/** Kontrast der Schrift eines Elements gegen seinen ersten deckenden Grund. */
async function kontrastAm(ort) {
  await ort.page().evaluate(kontrastWerkzeugEinbauen);
  return ort.evaluate(e => window.kdKontrast.schriftGegenGrund(e, getComputedStyle(e).color));
}

/** Kontrast zweier CSS-Farben, jede deckend über Weiß gemalt. */
async function kontrastFarben(page, a, b) {
  await page.evaluate(kontrastWerkzeugEinbauen);
  return page.evaluate(([x, y]) => window.kdKontrast.verhaeltnis(x, y), [a, b]);
}

/** Relative Leuchtdichte einer CSS-Farbe nach WCAG (0 schwarz, 1 weiß). */
async function leuchtdichte(page, farbe) {
  await page.evaluate(kontrastWerkzeugEinbauen);
  return page.evaluate(f => window.kdKontrast.leuchtdichte(f), farbe);
}

/** Das Pixel [r, g, b, a] einer CSS-Farbe, deckend über Weiß gemalt: zwei Schreibweisen derselben Farbe ergeben dasselbe Pixel. */
async function farbPixel(page, farbe) {
  await page.evaluate(kontrastWerkzeugEinbauen);
  return page.evaluate(f => window.kdKontrast.pixel(f), farbe);
}

/**
 * Mutantenprobe (Muster aus R00110 „Mutanten“): nennt KD_MUTANTE eine JSON-Datei `{ pfad, alt, neu }`, liefert `ziel` (Seite oder
 * Kontext) die Datei unter `pfad` mit jedem `alt` durch `neu` ersetzt aus. Greift der Ersatz nicht, wirft die Route — der Mutant liegt
 * nie im Repository. Ohne KD_MUTANTE geschieht nichts.
 */
async function mutanteEinsetzen(ziel) {
  if (!process.env.KD_MUTANTE) return;
  const { pfad, alt, neu } = JSON.parse(require('node:fs').readFileSync(process.env.KD_MUTANTE, 'utf8'));
  await ziel.route(url => url.pathname === pfad, async route => {
    const antwort = await route.fetch();
    const text = await antwort.text();
    if (!text.includes(alt)) throw new Error(`Mutante greift nicht: ${pfad} enthält ${JSON.stringify(alt)} nicht`);
    await route.fulfill({ response: antwort, body: text.replaceAll(alt, neu) });
  });
}

module.exports = { mutanteEinsetzen, kanbanStarten, einrichten, alsPerson, reiter, liveBereit, bereit, breiteSetzen, filterOeffnen, mehrOeffnen, ausMehr, thema, kontrastMessen, kontrastVerstoesse, kontrastAm, kontrastFarben, farbPixel, leuchtdichte };
