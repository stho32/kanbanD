// Kontrast-Probe der Farbrollen (R00107, ADR-0011): rechnet jedes Paar aus web/kd-tokens.css in beiden Themen nach, ohne Browser: node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const WEB = path.join(__dirname, '../../web');
const lies = datei => fs.readFileSync(path.join(WEB, datei), 'utf8');

/* ── Rechner: oklch → OKLab → lineares sRGB → Gamut-Clip → WCAG-Leuchtdichte (ohne 8-Bit-Rundung; das Canvas im E2E weicht um ±0,03 ab) ── */

/** Relative Leuchtdichte einer Farbe `oklch(L C H)` nach WCAG 2.1; Alpha zählt nicht. */
function leuchtdichte(farbe) {
  const teile = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(farbe);
  if (!teile) throw new Error(`keine oklch-Farbe: ${farbe}`);
  const [hell, buntheit, winkelGrad] = teile.slice(1).map(Number);
  const winkel = winkelGrad * Math.PI / 180;
  const a = buntheit * Math.cos(winkel), b = buntheit * Math.sin(winkel);
  const l = (hell + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (hell - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (hell - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
  const [r, g, bl] = linear.map(kanal => Math.min(1, Math.max(0, kanal)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
}
/** WCAG-Kontrastverhältnis zweier Farben, unabhängig von der Reihenfolge. */
function kontrast(vorne, grund) {
  const [hell, dunkel] = [leuchtdichte(vorne), leuchtdichte(grund)].sort((x, y) => y - x);
  return (hell + 0.05) / (dunkel + 0.05);
}
/** Nur für die Meldung, drei Stellen, damit 4,497 nicht als „4,50 < 4,5“ erscheint; verglichen wird immer ungerundet. */
const zahl = wert => wert.toFixed(3).replace('.', ',');
const mass = wert => String(wert).replace('.', ',');

/* ── Stylesheets lesen: Regeln mit Zeile, Token-Blöcke, var() ── */

const ohneKommentare = text => text.replace(/\/\*[\s\S]*?\*\//g, kommentar => kommentar.replace(/[^\n]/g, ' '));
/** Je innerste Regel { selektor, rumpf, zeile }; Kommentare zeilentreu entfernt, @media-Klammern übersprungen. */
function regeln(text) {
  const rein = ohneKommentare(text);
  return [...rein.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(treffer => ({
    selektor: treffer[1].trim(),
    rumpf: treffer[2],
    zeile: rein.slice(0, treffer.index + treffer[1].length + 1).split('\n').length,
  }));
}
function eigenschaften(rumpf) {
  const paare = rumpf.split(';').map(d => d.trim()).filter(d => d.startsWith('--'));
  return new Map(paare.map(d => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]));
}

const HELL = ':root', DUNKEL_SYSTEM = ':root:not([data-theme="light"])', DUNKEL = ':root[data-theme="dark"]';
const DUNKEL_MEDIA = '@media (prefers-color-scheme:dark)';
/** Blöcke der obersten Ebene als { kopf, rumpf }; der Rumpf eines @media trägt dessen Regeln. */
function obersteBloecke(text) {
  const rein = ohneKommentare(text);
  const bloecke = [];
  let tiefe = 0, kopfAnfang = 0, rumpfAnfang = 0;
  for (let i = 0; i < rein.length; i++) {
    if (rein[i] === '{') {
      if (tiefe === 0) rumpfAnfang = i + 1;
      tiefe++;
    } else if (rein[i] === '}') {
      tiefe--;
      if (tiefe === 0) {
        bloecke.push({ kopf: rein.slice(kopfAnfang, rumpfAnfang - 1).trim(), rumpf: rein.slice(rumpfAnfang, i) });
        kopfAnfang = i + 1;
      }
    }
  }
  return bloecke;
}
/** Die Eigenschaften aller Rümpfe in Reihenfolge zusammengeführt; spätere gewinnen wie in der Kaskade. */
const zusammengefuehrt = ruempfe => new Map(ruempfe.flatMap(rumpf => [...eigenschaften(rumpf)]));
/**
 * Die drei Token-Blöcke von kd-tokens.css als Map Name → Wert: hell jeder :root der obersten Ebene, dunkel genau die beiden Themenblöcke.
 * Ein :root in einem anderen @media (etwa pointer:coarse für --kd-ziel) ist kein Thema und zählt nicht.
 */
function tokenBloecke(text) {
  const oben = obersteBloecke(text);
  const ruempfe = kopf => oben.filter(block => block.kopf === kopf).map(block => block.rumpf);
  const systemRuempfe = ruempfe(DUNKEL_MEDIA).flatMap(rumpf => regeln(rumpf).filter(regel => regel.selektor === DUNKEL_SYSTEM).map(regel => regel.rumpf));
  return { hell: zusammengefuehrt(ruempfe(HELL)), dunkelSystem: zusammengefuehrt(systemRuempfe), dunkel: zusammengefuehrt(ruempfe(DUNKEL)) };
}
/** Token je Thema: hell der Wurzelblock, dunkel der Wurzelblock überschrieben vom erzwungenen Dunkelblock. */
function themen(text) {
  const { hell, dunkel } = tokenBloecke(text);
  return { hell, dunkel: new Map([...hell, ...dunkel]) };
}
/** Wert eines Tokens mit aufgelöstem var(); undefined, wenn es fehlt. */
function aufgeloest(token, werte) {
  const wert = werte.get(token);
  const verweis = wert && /^var\((--[\w-]+)\)$/.exec(wert);
  if (verweis) return aufgeloest(verweis[1], werte);
  return wert;
}

/* ── Paartabelle (R00107 FA 1): Schrift 4,5:1, Linie mit Zustand 3:1 ── */

const SCHRIFT = 4.5, LINIE = 3;
const kd = namen => namen.map(name => `--kd-${name}`);
const KLASSEN = ['yellow', 'amber', 'orange', 'red', 'rose', 'pink', 'magenta', 'violet', 'indigo', 'blue', 'sky', 'cyan', 'teal', 'green', 'lime', 'grey'];
const AMPEL = ['ok', 'warn', 'error', 'neutral'];
const PAARE = [
  { name: 'Neutrale Flächen', flaechen: kd(['bg', 'surface', 'sunken']), vorne: kd(['text', 'muted', 'warn', 'accent-ink', 'link-hover', 'mensch', 'agent-ink']), mass: SCHRIFT },
  { name: 'Akzent-Container', flaechen: kd(['accent-weak']), vorne: kd(['accent-ink', 'text', 'muted', 'warn']), mass: SCHRIFT },
  { name: 'Agent-Container', flaechen: kd(['agent-weak']), vorne: kd(['agent-ink', 'text', 'muted']), mass: SCHRIFT },
  { name: 'Mensch-Container', flaechen: kd(['mensch-weak']), vorne: kd(['text', 'muted']), mass: SCHRIFT },
  { name: 'Füllung Akzent', flaechen: kd(['accent']), vorne: kd(['on-accent']), mass: SCHRIFT },
  { name: 'Füllung Akzent beim Zeigen', flaechen: kd(['accent-hover']), vorne: kd(['on-accent']), mass: SCHRIFT },
  { name: 'Füllung Mensch', flaechen: kd(['mensch']), vorne: kd(['on-mensch']), mass: SCHRIFT },
  { name: 'Füllung Agent', flaechen: kd(['agent']), vorne: kd(['on-agent']), mass: SCHRIFT },
  // R00188 57-1 (ADR-0011 N2): die Initiale einer stillgelegten Person ist gedämpft über einen Farbton, nicht über Deckkraft
  { name: 'Gedämpfte Initiale stillgelegt', flaechen: kd(['still']), vorne: kd(['on-still']), mass: SCHRIFT },
  { name: 'Kopf', flaechen: kd(['head', 'head-line']), vorne: kd(['head-text', 'head-muted', 'head-link']), mass: SCHRIFT },
  { name: 'Modusleiste', flaechen: kd(['modus']), vorne: kd(['modus-text', 'muted', 'warn']), mass: SCHRIFT },
  { name: 'Klassengründe', flaechen: kd(KLASSEN.map(farbe => `c-${farbe}`)), vorne: kd(['text', 'muted', 'warn']), mass: SCHRIFT },
  ...AMPEL.map(status => ({ name: `Statusfarbe ${status}`, flaechen: kd([`status-${status}-bg`]), vorne: kd([`status-${status}-ink`, 'text']), mass: SCHRIFT })),
  { name: 'Diagrammlinien', flaechen: kd(['surface']), vorne: kd(['wl-1', 'wl-2', 'wl-3']), mass: LINIE },
  { name: 'Linie Abschluss Modusleiste', flaechen: kd(['modus', 'sunken']), vorne: kd(['modus-linie']), mass: LINIE },
  { name: 'Linie Fokusring Modusleiste', flaechen: kd(['modus']), vorne: kd(['accent']), mass: LINIE },
  { name: 'Linie Zustand .bf-chip', flaechen: kd(['bg']), vorne: kd(['faint']), mass: LINIE },
  // R00220 (PO Z. 484, Z. 491): Schrift der gesperrten Wahl auf der Fläche und die gewählte gesperrte Fläche mit ihrer Schrift ≥ 3:1
  { name: 'Gesperrte Wahl des Schalters', flaechen: kd(['surface']), vorne: kd(['faint']), mass: LINIE },
  { name: 'Gesperrte gewählte Wahl des Schalters', flaechen: kd(['faint']), vorne: kd(['surface']), mass: LINIE },
  // R00114 (ADR-0019 Regel 6): Fläche und Schrift des vergessenen Laufchips; der Punkt davor trägt die Schriftfarbe
  { name: 'Vergessener Laufchip', flaechen: kd(['fehler-flaeche']), vorne: kd(['fehler-text']), mass: SCHRIFT },
  { name: 'Punkt des vergessenen Laufchips', flaechen: kd(['fehler-flaeche']), vorne: kd(['fehler-text']), mass: LINIE },
];

/** Verstöße eines Paares je Thema, je als Satz `Name: --x auf --y, dunkel 1,33 < 4,5`. */
function verstoesse(paar, werteJeThema) {
  const saetze = [];
  for (const [thema, werte] of Object.entries(werteJeThema)) {
    for (const flaeche of paar.flaechen) {
      for (const vorne of paar.vorne) {
        const fehlend = [vorne, flaeche].filter(token => aufgeloest(token, werte) === undefined);
        if (fehlend.length) { saetze.push(`${paar.name}: ${fehlend.join(', ')} fehlt, ${thema}`); continue; }
        const wert = kontrast(aufgeloest(vorne, werte), aufgeloest(flaeche, werte));
        if (wert < paar.mass) saetze.push(`${paar.name}: ${vorne} auf ${flaeche}, ${thema} ${zahl(wert)} < ${mass(paar.mass)}`);
      }
    }
  }
  return saetze;
}

/** Regeln, deren Schrift ein Paar der Tabelle sein muss; die Fläche steht in der Regel selbst oder kommt vom Eltern-Element. */
const PAARUNGEN = [
  { datei: 'kd-app.css', selektor: '.ausruf', vorne: '--kd-status-error-ink', flaeche: '--kd-status-error-bg', ring: '--kd-status-error' },
  { datei: 'kd-app.css', selektor: '.toast .lnk', vorne: '--kd-head-link', flaeche: '--kd-head' },
  { datei: 'kd-app.css', selektor: '.pk-still', vorne: '--kd-on-still', flaeche: '--kd-still', flaecheImRumpf: true },
  { datei: 'kd-base.css', selektor: '.lauf.vergessen', vorne: '--kd-fehler-text', flaeche: '--kd-fehler-flaeche', flaecheImRumpf: true },
  // Link beim Zeigen (R00145-Nacharbeit): die Regel nimmt den eigenen Token, nicht den rohen Akzent (dunkel 3,41:1).
  { datei: 'kd-base.css', selektor: 'a:hover', vorne: '--kd-link-hover', flaeche: '--kd-surface' },
];
/** Abweichungen einer Regel von ihrer Paarung: falsche Schrift, falsche Fläche, fehlender Ring. */
function paarungsFehler(paarung, text) {
  const regel = regeln(text).find(r => r.selektor === paarung.selektor);
  if (!regel) return [`${paarung.selektor} fehlt`];
  const verlangt = [`color:var(${paarung.vorne})`];
  if (paarung.flaecheImRumpf) verlangt.push(`background:var(${paarung.flaeche})`);
  if (paarung.ring) verlangt.push(`background:var(${paarung.flaeche})`, `box-shadow:0 0 0 1px var(${paarung.ring})`);
  return verlangt.filter(deklaration => !regel.rumpf.split(';').includes(deklaration)).map(deklaration => `${paarung.datei}:${regel.zeile} ${paarung.selektor} ohne ${deklaration}`);
}

/* ── Wächter: Dunkelblöcke, Literale, faint ── */

/** Tokens, die nur in einem Dunkelblock stehen oder dort einen anderen Wert haben. */
function dunkelAbweichungen(text) {
  const { dunkelSystem, dunkel } = tokenBloecke(text);
  const namen = new Set([...dunkelSystem.keys(), ...dunkel.keys()]);
  return [...namen].filter(name => dunkelSystem.get(name) !== dunkel.get(name));
}

/**
 * Farbeigenschaft im Stylesheet, in einem style-Attribut, als SVG-Attribut (`fill="…"`), als JS-Zuweisung (`e.style.color = …`)
 * oder als Schlüssel eines Objekt-Literals (`{ color: … }`); Eingabewerte (value, placeholder) sind Nutzerfarben und zählen nicht.
 */
const FARBEIGENSCHAFT = /(?:^|[\s;{"'`.,(])((?:[\w-]*[Cc]olor[\w-]*|background[\w-]*|border[\w-]*|outline[\w-]*|box-?[Ss]hadow|text-?[Ss]hadow|text-?[Dd]ecoration[\w-]*|column-?[Rr]ule[\w-]*|fill|stroke|--[\w-]+)\s*[:=]\s*['"`]?[^;{}"'`]*)/g;
const SET_PROPERTY = /setProperty\(\s*['"`]([\w-]+)['"`]\s*,\s*([^)]*)\)/g;
const FARBNAMEN = ('aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen').split(' ');
const FARBLITERAL = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|oklch|oklab|lch|lab|hwb|color)\\(|(?<![\\w.-])(?:${FARBNAMEN.join('|')})(?![\\w-])`, 'i');
/**
 * Wert ohne Token-Namen und Bildadressen: `var(--kd-c-red)` nennt ein Token, `url(red.png)` eine Datei, beides keine Farbe.
 * Der Rückfallwert bleibt stehen, auch verschachtelt: `var(--kd-a, var(--kd-b, #fff))` trägt das Literal `#fff`.
 */
const ohneVerweise = wert => wert.replace(/url\([^)]*\)/g, '').replace(/var\(\s*--[\w-]+\s*,?/g, '(');
/** Die Farbdeklarationen einer Zeile, die ein Literal tragen, als `eigenschaft:wert`. */
function literalDeklarationen(zeile) {
  const deklarationen = [
    ...[...zeile.matchAll(FARBEIGENSCHAFT)].map(treffer => treffer[1]),
    ...[...zeile.matchAll(SET_PROPERTY)].map(treffer => `${treffer[1]}:${treffer[2]}`),
  ];
  return deklarationen.filter(deklaration => FARBLITERAL.test(ohneVerweise(deklaration.slice(deklaration.search(/[:=]/) + 1)))).map(deklaration => deklaration.trim());
}
/** Zeilen mit einem Farbliteral in einer Farbeigenschaft, als `datei:zeile`; Kommentare zählen nicht. */
function literalZeilen(datei, text) {
  return ohneKommentare(text).split('\n').flatMap((zeile, i) => literalDeklarationen(zeile).length ? [`${datei}:${i + 1}`] : []);
}
const gepruefteDateien = () => ['kd-app.css', 'kd-base.css', ...fs.readdirSync(WEB).filter(name => name.endsWith('.js')).sort()];

/** Verzierung, Linie oder inaktives Bedienelement (R00107 FA 11) — und die sichtbare Sperrform (R00148 AK 19,
    freigegeben 2026-11-14): der gesperrte Auslöser dämpft Schrift und Symbol auf --kd-faint. */
const FAINT_ERLAUBT = ['.bk-name .bk-klapp', '.iz.aus', '.diagramm .fadenkreuz', '.bf-chip',
  '.btn[data-sperrform]', '.btn[data-sperrform]:hover',
  '.btn-haupt[data-sperrform]', '.btn-haupt[data-sperrform]:hover',
  '.btn-sym[data-sperrform]', '.btn-sym[data-sperrform]:hover',
  '.naechste-ziel[data-sperrform]', '.naechste-ziel[data-sperrform]:hover',
  '.chk.ok i[data-sperrform]',
  '.ochip button[data-sperrform],.ochip button[data-sperrform]:hover',
  // R00220: die gesperrte Gruppe des Schalters „Transkripte erfassen“ (Z. 216, PO Z. 484 und Z. 491)
  '.ts-seg[aria-disabled="true"]>button,.ts-seg[aria-disabled="true"]>button:hover', '.ts-seg[aria-disabled="true"]>button[aria-checked="true"]',
  // gesperrtes „Erneut versuchen“ der Laufansicht in der Sperrform von PO Z. 484 S-A (R00221, PO Z. 491)
  '.cl-textknopf[aria-disabled="true"],.cl-textknopf[aria-disabled="true"]:hover',
  '.cl-knopf[aria-disabled="true"],.cl-knopf[aria-disabled="true"]:hover',
  // R00239: gesperrte Arten-Kästchen unter „nur Fehler“ (PO Z. 588) und das gesperrte Blättern am Rand (FA 11) in der Sperrform von Z. 216/484
  '.lv-filt label:has(>input[aria-disabled="true"])', '.lv-filt input[aria-disabled="true"]',
  '.lv-blatt .btn[aria-disabled="true"],.lv-blatt .btn[aria-disabled="true"]:hover'];
/** Regeln mit --kd-faint außerhalb der Erlaubt-Liste, als `datei:zeile selektor`. */
function faintStellen(datei, text) {
  return regeln(text).filter(regel => regel.rumpf.includes('var(--kd-faint)') && !FAINT_ERLAUBT.includes(regel.selektor)).map(regel => `${datei}:${regel.zeile} ${regel.selektor}`);
}

/* ── Rechner ── */

test('Rechner: Weiß auf Schwarz ist 21,0', () => {
  assert.strictEqual(kontrast('oklch(1 0 0)', 'oklch(0 0 0)').toFixed(1), '21.0');
});

test('Rechner: --kd-accent hell von heute gegen Weiß ist 6,0', () => {
  assert.strictEqual(kontrast('oklch(0.5 0.13 255)', 'oklch(1 0 0)').toFixed(1), '6.0');
});

test('Rechner: var() wird über mehrere Stufen aufgelöst, ein fehlendes Token bleibt undefined', () => {
  const werte = new Map([['--kd-a', 'var(--kd-b)'], ['--kd-b', 'oklch(0.5 0 0)']]);
  assert.strictEqual(aufgeloest('--kd-a', werte), 'oklch(0.5 0 0)');
  assert.strictEqual(aufgeloest('--kd-fehlt', werte), undefined);
});

/* ── Paare ── */

const TOKENS = lies('kd-tokens.css');
for (const paar of PAARE) {
  test(`Paar ${paar.name}: mindestens ${mass(paar.mass)} in Hell und Dunkel`, () => {
    assert.deepStrictEqual(verstoesse(paar, themen(TOKENS)), []);
  });
}

for (const paarung of PAARUNGEN) {
  test(`Paarung ${paarung.selektor}: Schrift ${paarung.vorne} auf ${paarung.flaeche}`, () => {
    assert.deepStrictEqual(paarungsFehler(paarung, lies(paarung.datei)), []);
    const paar = { name: paarung.selektor, flaechen: [paarung.flaeche], vorne: [paarung.vorne], mass: SCHRIFT };
    assert.deepStrictEqual(verstoesse(paar, themen(TOKENS)), []);
  });
}

test('Selbstprobe Paar: --kd-faint auf --kd-bg von heute (3,29) ist als Schrift ein Verstoß', () => {
  const werte = new Map([['--kd-faint', 'oklch(0.62 0.014 255)'], ['--kd-bg', 'oklch(0.965 0.005 250)']]);
  const paar = { name: 'Probe', flaechen: ['--kd-bg'], vorne: ['--kd-faint'], mass: SCHRIFT };
  assert.deepStrictEqual(verstoesse(paar, { hell: werte }), ['Probe: --kd-faint auf --kd-bg, hell 3,288 < 4,5']);
});

test('Selbstprobe Grenze: 4,4979 ist ein Verstoß, 4,5 nicht — verglichen wird ungerundet', () => {
  const werte = new Map([['--kd-knapp', 'oklch(0.5682 0 0)'], ['--kd-weiss', 'oklch(1 0 0)']]);
  const paar = { name: 'Probe', flaechen: ['--kd-weiss'], vorne: ['--kd-knapp'], mass: SCHRIFT };
  assert.deepStrictEqual(verstoesse(paar, { hell: werte }), ['Probe: --kd-knapp auf --kd-weiss, hell 4,498 < 4,5']);
  assert.deepStrictEqual(verstoesse({ ...paar, mass: 4.497 }, { hell: werte }), []);
});

test('Selbstprobe Paar: ein fehlendes Token wird mit Namen und Thema gemeldet', () => {
  const paar = { name: 'Probe', flaechen: ['--kd-bg'], vorne: ['--kd-on-nichts'], mass: SCHRIFT };
  assert.deepStrictEqual(verstoesse(paar, { dunkel: new Map([['--kd-bg', 'oklch(0.2 0 0)']]) }), ['Probe: --kd-on-nichts fehlt, dunkel']);
});

/* ── Initialen ohne Deckkraft (R00188 57-1, ADR-0011 N2 Punkt 1 und 3) ── */

/** Gedämpft über Deckkraft darf eine Initiale nur in einer inaktiven Zeile mit genanntem Grund (aria-disabled, Ich-Menü). */
const DECKKRAFT_ERLAUBT = ['.iz.aus .pk'];
/** Regeln, die eine Initiale (.pk…) treffen und eine Deckkraft setzen, als `datei:zeile selektor`. */
function gedaempfteInitialen(datei, text) {
  return regeln(text)
    .filter(regel => /\.pk(?![\w-]*-0)/.test(regel.selektor) && /(^|;)\s*opacity\s*:/.test(regel.rumpf) && !DECKKRAFT_ERLAUBT.includes(regel.selektor))
    .map(regel => `${datei}:${regel.zeile} ${regel.selektor}`);
}

test('Initialen: keine Deckkraft an einer Initiale außer in der inaktiven Zeile des Ich-Menüs', () => {
  assert.deepStrictEqual(['kd-app.css', 'kd-base.css'].flatMap(datei => gedaempfteInitialen(datei, lies(datei))), []);
});

test('Selbstprobe Initialen: .pk-still{opacity:.5} und .pt tr.ruhe .pk{opacity:.55} werden erkannt, .iz.aus .pk nicht', () => {
  const probe = '.pk-still{opacity:.5}\n.pt tr.ruhe .pk{color:red;opacity:.55}\n.iz.aus .pk{opacity:.6}\n.ruhig{opacity:.55}';
  assert.deepStrictEqual(gedaempfteInitialen('probe', probe), ['probe:1 .pk-still', 'probe:2 .pt tr.ruhe .pk']);
});

test('Selbstprobe gedämpftes Paar: ein hellerer Ton der stillgelegten Initiale wird mit Paarname und Wert gemeldet', () => {
  const paar = PAARE.find(p => p.name === 'Gedämpfte Initiale stillgelegt');
  const werte = new Map([['--kd-still', 'oklch(0.88 0.015 250)'], ['--kd-on-still', 'oklch(0.7 0.02 250)']]);
  const [satz] = verstoesse(paar, { hell: werte });
  assert.match(satz, /^Gedämpfte Initiale stillgelegt: --kd-on-still auf --kd-still, hell \d,\d{3} < 4,5$/);
});

/* ── Block „Wie lange noch“ (FA 13): Grund mischt die Ampel nach dem Anteil ── */

/** color-mix(in oklch, a anteil, b) mit kürzerem Farbtonweg, wie der Browser mischt. */
function mische(a, b, anteil) {
  const [pa, pb] = [a, b].map(farbe => /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(farbe).slice(1).map(Number));
  let differenz = pb[2] - pa[2];
  if (differenz > 180) differenz -= 360;
  if (differenz < -180) differenz += 360;
  const winkel = (pa[2] + (1 - anteil) * differenz + 360) % 360;
  return `oklch(${anteil * pa[0] + (1 - anteil) * pb[0]} ${anteil * pa[1] + (1 - anteil) * pb[1]} ${winkel})`;
}
const ANTEILE = [0, 1 / 3, 0.5, 2 / 3, 1];
/** Verstöße von Schrift (vorne) auf Grund, beide als Mischung ok/error, je Thema und Anteil. */
function blockVerstoesse(vorne, grund) {
  const saetze = [];
  for (const [thema, werte] of Object.entries(themen(TOKENS))) {
    const farbe = (paar, anteil) => typeof paar === 'string' ? aufgeloest(paar, werte) : mische(aufgeloest(paar[0], werte), aufgeloest(paar[1], werte), anteil);
    for (const anteil of ANTEILE) {
      const wert = kontrast(farbe(vorne, anteil), farbe(grund, anteil));
      if (wert < SCHRIFT) saetze.push(`${thema}, Anteil ${zahl(anteil)}: ${zahl(wert)} < 4,5`);
    }
  }
  return saetze;
}
const GRUND = ['--kd-status-ok-bg', '--kd-status-error-bg'];

test('Block von Wie lange noch: --kd-text und --kd-muted auf dem gemischten Grund mindestens 4,5 bei jedem Anteil', () => {
  assert.deepStrictEqual([...blockVerstoesse('--kd-text', GRUND), ...blockVerstoesse('--kd-muted', GRUND)], []);
});

test('Block von Wie lange noch: Abzeichen mit gemischter Ampelschrift auf dem gemischten Grund mindestens 4,5', () => {
  assert.deepStrictEqual(blockVerstoesse(['--kd-status-ok-ink', '--kd-status-error-ink'], GRUND), []);
});

test('Block von Wie lange noch: ansicht.js setzt den Anteil (--anteil), keinen Farbton (--h)', () => {
  const ansicht = lies('ansicht.js');
  assert.match(ansicht, /<section class="wl-block" style="--anteil:\$\{anteil\}"/);
  assert.doesNotMatch(ansicht, /--h:/);
  assert.doesNotMatch(lies('kd-app.css'), /var\(--h\)/);
});

test('Selbstprobe Mischung: Anteil 1 ist die erste Farbe, 0 die zweite, ½ geht den kürzeren Farbtonweg', () => {
  assert.strictEqual(mische('oklch(0.9 0.1 350)', 'oklch(0.5 0.1 10)', 1), 'oklch(0.9 0.1 350)');
  assert.strictEqual(mische('oklch(0.9 0.1 350)', 'oklch(0.5 0.1 10)', 0), 'oklch(0.5 0.1 10)');
  assert.strictEqual(mische('oklch(0.9 0.1 350)', 'oklch(0.5 0.1 10)', 0.5), 'oklch(0.7 0.1 0)');
});

/* ── Modusleiste (FA 7): Akzent-Container mit Linie, Fokusring und Zustandsebene beim Zeigen ── */

/** M3-Zustandsebene: 8 % der Schrift über der Fläche, wie in kd-app.css als color-mix geschrieben. */
const ZUSTANDSEBENE = 'color-mix(in oklch, var(--kd-modus-text) 8%, var(--kd-modus))';
const MODUSLEISTE = [
  { selektor: '.kz.modus', deklarationen: ['background:var(--kd-modus)', 'color:var(--kd-modus-text)', 'border-bottom:1px solid var(--kd-modus-linie)'] },
  { selektor: '.kz.modus .kz-z1', deklarationen: ['border-color:var(--kd-modus-linie)'] },
  { selektor: '.kz.modus .kz-z1 .mono', deklarationen: ['color:var(--kd-modus-text)'] },
  { selektor: '.kz.modus .kz-modus .muted', deklarationen: ['color:var(--kd-muted)'] },
  { selektor: '.kz-modus .kz-btn', deklarationen: ['border-color:var(--kd-modus-linie)', 'color:var(--kd-modus-text)'] },
  { selektor: '.kz-modus .kz-btn:not(.haupt):hover,.kz-modus .kz-btn.auf', deklarationen: [`background:${ZUSTANDSEBENE}`] },
  { selektor: '.kz-modus .kz-btn.haupt', deklarationen: ['background:var(--kd-accent)', 'border-color:var(--kd-accent)', 'color:var(--kd-on-accent)'] },
  { selektor: '.kz-modus .kz-btn:focus-visible', deklarationen: ['outline:2px solid var(--kd-accent)'] },
  { selektor: '.fehl-kopf', deklarationen: ['color:var(--kd-warn)'] },
];
/** Deklarationen der Modusleiste, die in kd-app.css fehlen, als `selektor ohne deklaration`. */
function modusleistenFehler(text) {
  const alle = regeln(text);
  return MODUSLEISTE.flatMap(({ selektor, deklarationen }) => {
    const regel = alle.find(r => r.selektor === selektor);
    if (!regel) return [`${selektor} fehlt`];
    const rumpf = regel.rumpf.split(';').map(d => d.trim());
    return deklarationen.filter(d => !rumpf.includes(d)).map(d => `${selektor} ohne ${d}`);
  });
}

test('Modusleiste: Fläche, Schrift, Linie, Fertig, Fokusring, Fehler und Zeigen über die Tokens in kd-app.css', () => {
  assert.deepStrictEqual(modusleistenFehler(lies('kd-app.css')), []);
});

test('Modusleiste beim Zeigen: --kd-modus-text auf der Zustandsebene mindestens 4,5 in Hell und Dunkel', () => {
  const saetze = Object.entries(themen(TOKENS)).flatMap(([thema, werte]) => {
    const text = aufgeloest('--kd-modus-text', werte);
    const wert = kontrast(text, mische(text, aufgeloest('--kd-modus', werte), 0.08));
    return wert < SCHRIFT ? [`${thema} ${zahl(wert)} < 4,5`] : [];
  });
  assert.deepStrictEqual(saetze, []);
});

test('Selbstprobe Modusleiste: eine Leiste von heute (Fläche accent-ink, Ränder mit Literal) wird je fehlender Deklaration gemeldet', () => {
  const heute = '.kz.modus{background:var(--kd-accent-ink)}\n.kz-modus .kz-btn{border-color:oklch(1 0 0 / .3)}';
  const fehler = modusleistenFehler(heute);
  assert.ok(fehler.includes('.kz.modus ohne background:var(--kd-modus)'), fehler.join('\n'));
  assert.ok(fehler.includes('.kz-modus .kz-btn ohne border-color:var(--kd-modus-linie)'), fehler.join('\n'));
  assert.ok(fehler.includes('.kz-modus .kz-btn:focus-visible fehlt'), fehler.join('\n'));
});

/* ── Dunkelblöcke ── */

/* Der Ausgangsfall (Nacharbeit 1, Befund 1): ein zweiter :root-Block in einem anderen @media ersetzte den hellen Block */
const ZIEL_TOUCH = '\n@media (pointer:coarse){:root{--kd-ziel:48px}}';

test('Selbstprobe Token-Blöcke: ein :root in @media (pointer:coarse) ersetzt den hellen Block nicht', () => {
  const { hell } = tokenBloecke(TOKENS + ZIEL_TOUCH);
  assert.ok(hell.has('--kd-text'), 'hell ohne --kd-text');
  assert.strictEqual(hell.get('--kd-ziel'), '24px');
  const neutral = PAARE.find(paar => paar.name === 'Neutrale Flächen');
  assert.deepStrictEqual(verstoesse(neutral, themen(TOKENS + ZIEL_TOUCH)), []);
});

test('Selbstprobe Token-Blöcke: Dunkelblöcke in einem anderen @media zählen nicht, ein zweiter :root oben wird zusammengeführt', () => {
  const zusatz = '\n@media (pointer:coarse){:root[data-theme="dark"]{--kd-ziel:48px}:root:not([data-theme="light"]){--kd-ziel:48px}}\n:root{--kd-zusatz:oklch(0.5 0 0)}';
  const { hell, dunkelSystem, dunkel } = tokenBloecke(TOKENS + zusatz);
  assert.ok(dunkel.has('--kd-text') && dunkelSystem.has('--kd-text'), 'Dunkelblock ersetzt');
  assert.ok(!dunkel.has('--kd-ziel') && !dunkelSystem.has('--kd-ziel'), 'Dunkelblock aus @media (pointer:coarse) gelesen');
  assert.ok(hell.has('--kd-text') && hell.has('--kd-zusatz'), 'zweiter :root nicht zusammengeführt');
});


test('Dunkelblöcke: @media und [data-theme="dark"] setzen dieselben Tokens mit denselben Werten', () => {
  assert.deepStrictEqual(dunkelAbweichungen(TOKENS), []);
});

test('Selbstprobe Dunkelblock: ein nur im @media-Block geänderter Wert und ein Token nur dort werden mit Namen erkannt', () => {
  const anfang = TOKENS.indexOf(DUNKEL_SYSTEM);
  const mediaBlock = TOKENS.slice(anfang).replace('--kd-warn:oklch(0.72', '--kd-warn:oklch(0.7').replace('color-scheme:dark;', 'color-scheme:dark;--kd-nur-hier:oklch(0.5 0 0);');
  assert.deepStrictEqual(dunkelAbweichungen(TOKENS.slice(0, anfang) + mediaBlock).sort(), ['--kd-nur-hier', '--kd-warn']);
});

/* ── Literale ── */

test('Literale: kein Farbwert außerhalb von kd-tokens.css in kd-app.css, kd-base.css und web/*.js', () => {
  const funde = gepruefteDateien().flatMap(datei => literalZeilen(datei, lies(datei)));
  assert.deepStrictEqual(funde, []);
});

test('Selbstprobe Literal: angehängtes .x{color:#fff} und background:hsl(…) werden mit Datei:Zeile erkannt', () => {
  const app = lies('kd-app.css');
  const letzte = app.split('\n').length;
  const funde = literalZeilen('kd-app.css', `${app}\n.x{color:#fff}\n.y{background:hsl(10 50% 50%)}`);
  assert.deepStrictEqual(funde.slice(-2), [`kd-app.css:${letzte + 1}`, `kd-app.css:${letzte + 2}`]);
});

test('Selbstprobe Literal: Nutzerfarben, Token-Verweise, Mischungen und Kommentare zählen nicht, ein style-Literal schon', () => {
  const probe = [
    '.a{color:var(--kd-text);background:color-mix(in oklch,var(--kd-accent) 30%,transparent)}',
    '/* früher #fff */ .b{border-color:currentColor}',
    '<input value="${esc(sp.farbe || \'#ffffff\')}" placeholder="#b04a8c">',
    '<span style="--sf:${esc(farbe)}">',
    '<span style="color:#123456">',
  ].join('\n');
  assert.deepStrictEqual(literalZeilen('probe', probe), ['probe:5']);
});

test('Selbstprobe Literal: Farbnamen, weitere Farbeigenschaften, JS-Zuweisung, Objekt-Literal, SVG-Attribute und Rückfallwerte in var() werden erkannt', () => {
  // vollständige Mutationsliste aller Runden: wer den Wächter erweitert, sieht hier, ob er Älteres schwächt
  const mutationen = [
    // Bau (B0396)
    '.x{color:#fff}',
    '.y{background:hsl(10 50% 50%)}',
    '<span style="color:#123456">',
    // Nacharbeit 1
    '.a{color:white}',
    '.a{background:black}',
    '.a{text-shadow:0 1px 0 #fff}',
    '.a{caret-color:#fff}',
    '.a{accent-color:#fff}',
    '.a{column-rule:1px solid #fff}',
    '.a{column-rule-color:rgb(0 0 0)}',
    'e.style.color = "#fff";',
    "e.style.backgroundColor = 'white';",
    "e.style.setProperty('color', '#fff');",
    'const stil = { color: "#fff" };',
    "const stil = { backgroundColor: 'black' };",
    '<rect fill="#fff"></rect>',
    '<path stroke="black"></path>',
    // Nacharbeit 2: Literal als Rückfallwert eines Token-Verweises, auch verschachtelt
    '.x{background:var(--kd-c-green-line,#2e7d32)}',
    '.x{color:var(--kd-text,white)}',
    '.x{color:var(--kd-a, var(--kd-b, #fff))}',
    '.x{border:1px solid var(--kd-line, rgb(0 0 0 / .1))}',
  ];
  const funde = literalZeilen('probe', mutationen.join('\n'));
  assert.deepStrictEqual(funde, mutationen.map((_, i) => `probe:${i + 1}`));
});

test('Selbstprobe Literal: Farbnamen in Token-Namen, Schlüsselwörter und Nicht-Farbeigenschaften zählen nicht', () => {
  const probe = [
    '.a{background:var(--kd-c-red);color:currentColor;border:none;fill:none;stroke:transparent}',
    '.a{white-space:nowrap;stroke-width:1.5}',
    'const name = "white";',
    '<path stroke="var(--kd-wl-1)" fill="${farbe}"></path>',
    "e.style.color = '';",
    '.a{color:var(--kd-text, var(--kd-muted))}',
    'const stil = { color: farben.red };',
    '.a{background:url(red.png) no-repeat}',
  ].join('\n');
  assert.deepStrictEqual(literalZeilen('probe', probe), []);
});

/* ── faint ── */

test('faint: --kd-faint nur an den erlaubten Selektoren (Verzierung, inaktives Bedienelement, Sperrform)', () => {
  const funde = ['kd-app.css', 'kd-base.css'].flatMap(datei => faintStellen(datei, lies(datei)));
  assert.deepStrictEqual(funde, []);
});

test('Selbstprobe faint: eine neue Regel mit --kd-faint wird mit Zeile erkannt, eine erlaubte nicht', () => {
  const probe = '.bf-chip{text-decoration-color:var(--kd-faint)}\n@media (x){.neu .k{color:var(--kd-faint)}}';
  assert.deepStrictEqual(faintStellen('probe', probe), ['probe:2 .neu .k']);
});
