// Kontrast-Probe der Farbrollen (R00107, ADR-0011): rechnet jedes Paar aus web/kd-tokens.css in beiden Themen nach, ohne Browser: node --test
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const WEB = path.join(__dirname, '../../web');
const lies = datei => fs.readFileSync(path.join(WEB, datei), 'utf8');

/* ── Rechner: oklch → OKLab → lineares sRGB → Gamut-Clip → WCAG-Leuchtdichte (ohne 8-bit-Rundung; das Canvas im E2E weicht um ±0,03 ab) ── */

/** Relative Leuchtdichte nach WCAG 2.1 einer Farbe `oklch(L C H)`; Alpha zählt nicht. */
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
const zahl = wert => wert.toFixed(2).replace('.', ',');
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
/** Die drei Token-Blöcke von kd-tokens.css als Map Name → Wert. */
function tokenBloecke(text) {
  const bloecke = new Map(regeln(text).map(({ selektor, rumpf }) => [selektor, eigenschaften(rumpf)]));
  return { hell: bloecke.get(HELL), dunkelSystem: bloecke.get(DUNKEL_SYSTEM), dunkel: bloecke.get(DUNKEL) };
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
  { name: 'Neutrale Flächen', flaechen: kd(['bg', 'surface', 'sunken']), vorne: kd(['text', 'muted', 'warn', 'accent-ink', 'mensch', 'agent-ink']), mass: SCHRIFT },
  { name: 'Akzent-Container', flaechen: kd(['accent-weak']), vorne: kd(['accent-ink', 'text', 'muted', 'warn']), mass: SCHRIFT },
  { name: 'Agent-Container', flaechen: kd(['agent-weak']), vorne: kd(['agent-ink', 'text', 'muted']), mass: SCHRIFT },
  { name: 'Mensch-Container', flaechen: kd(['mensch-weak']), vorne: kd(['text', 'muted']), mass: SCHRIFT },
  { name: 'Füllung Akzent', flaechen: kd(['accent']), vorne: kd(['on-accent']), mass: SCHRIFT },
  { name: 'Füllung Mensch', flaechen: kd(['mensch']), vorne: kd(['on-mensch']), mass: SCHRIFT },
  { name: 'Füllung Agent', flaechen: kd(['agent']), vorne: kd(['on-agent']), mass: SCHRIFT },
  { name: 'Kopf', flaechen: kd(['head', 'head-line']), vorne: kd(['head-text', 'head-muted', 'head-link']), mass: SCHRIFT },
  { name: 'Modusleiste', flaechen: kd(['modus']), vorne: kd(['modus-text', 'muted', 'warn']), mass: SCHRIFT },
  { name: 'Klassengründe', flaechen: kd(KLASSEN.map(farbe => `c-${farbe}`)), vorne: kd(['text', 'muted', 'warn']), mass: SCHRIFT },
  ...AMPEL.map(status => ({ name: `WBS-Ampel ${status}`, flaechen: kd([`wbs-${status}-bg`]), vorne: kd([`wbs-${status}-ink`, 'text']), mass: SCHRIFT })),
  { name: 'Linien Diagramm', flaechen: kd(['surface']), vorne: kd(['wl-1', 'wl-2', 'wl-3']), mass: LINIE },
  { name: 'Linie Abschluss Modusleiste', flaechen: kd(['modus', 'sunken']), vorne: kd(['modus-linie']), mass: LINIE },
  { name: 'Linie Fokusring Modusleiste', flaechen: kd(['modus']), vorne: kd(['accent']), mass: LINIE },
  { name: 'Linie Zustand .bf-chip', flaechen: kd(['bg']), vorne: kd(['faint']), mass: LINIE },
];
/** Bubble, die ein heute verfehltes Paar herstellt; bis dahin läuft die Prüfung als todo (erwartet rot). */
const MODUS = 'B0393 Modusleiste als Akzent-Container (wartet auf Freigabe des Zustands an D0002)';
const AUSSTEHEND = {
  'Modusleiste': MODUS, 'Linie Abschluss Modusleiste': MODUS, 'Linie Fokusring Modusleiste': MODUS,
};

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
  { datei: 'kd-app.css', selektor: '.ausruf', vorne: '--kd-wbs-error-ink', flaeche: '--kd-wbs-error-bg', ring: '--kd-wbs-error' },
  { datei: 'kd-app.css', selektor: '.toast .lnk', vorne: '--kd-head-link', flaeche: '--kd-head' },
];
/** Abweichungen einer Regel von ihrer Paarung: falsche Schrift, falsche Fläche, fehlender Ring. */
function paarungsFehler(paarung, text) {
  const regel = regeln(text).find(r => r.selektor === paarung.selektor);
  if (!regel) return [`${paarung.selektor} fehlt`];
  const verlangt = [`color:var(${paarung.vorne})`];
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

/** Farbeigenschaft im Stylesheet oder in einem style-Attribut; Eingabewerte (value, placeholder) sind Nutzerfarben und zählen nicht. */
const FARBEIGENSCHAFT = /(?:^|[\s;{"'`])((?:color|background[\w-]*|border[\w-]*|outline[\w-]*|box-shadow|fill|stroke|text-decoration-color|--[\w-]+)\s*:\s*[^;{}"'`]*)/g;
const FARBLITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lch|lab|hwb)\(/;
/** Zeilen mit einem Farbliteral in einer Farbeigenschaft, als `datei:zeile`; Kommentare zählen nicht. */
function literalZeilen(datei, text) {
  const funde = [];
  ohneKommentare(text).split('\n').forEach((zeile, i) => {
    const mitLiteral = [...zeile.matchAll(FARBEIGENSCHAFT)].some(deklaration => FARBLITERAL.test(deklaration[1]));
    if (mitLiteral) funde.push(`${datei}:${i + 1}`);
  });
  return funde;
}
/** Zeilen, die bis zu ihrer Bubble ein Literal behalten; erkannt am Selektor, nicht an der Zeilennummer. */
const LITERAL_AUSSTEHEND = [
  { selektor: '.kz.modus .kz-z1', bubble: MODUS },
  { selektor: '.kz-modus .kz-btn', bubble: MODUS },
];
function literaleOhneAusstehende(datei, text) {
  const zeilen = text.split('\n');
  const ausstehend = ort => LITERAL_AUSSTEHEND.some(aus => zeilen[Number(ort.split(':')[1]) - 1].includes(aus.selektor));
  return literalZeilen(datei, text).filter(ort => !ausstehend(ort));
}
const gepruefteDateien = () => ['kd-app.css', 'kd-base.css', ...fs.readdirSync(WEB).filter(name => name.endsWith('.js')).sort()];

/** Verzierung, Linie oder inaktives Bedienelement (R00107 FA 11). */
const FAINT_ERLAUBT = ['.bk-name .bk-klapp', '.iz.aus', '.diagramm .fadenkreuz', '.bf-chip', '.wbs-zeile .trenner'];
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
  test(`Paar ${paar.name}: mindestens ${mass(paar.mass)} in hell und dunkel`, { todo: AUSSTEHEND[paar.name] }, () => {
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
  assert.deepStrictEqual(verstoesse(paar, { hell: werte }), ['Probe: --kd-faint auf --kd-bg, hell 3,29 < 4,5']);
});

test('Selbstprobe Paar: ein fehlendes Token wird mit Namen und Thema gemeldet', () => {
  const paar = { name: 'Probe', flaechen: ['--kd-bg'], vorne: ['--kd-on-nichts'], mass: SCHRIFT };
  assert.deepStrictEqual(verstoesse(paar, { dunkel: new Map([['--kd-bg', 'oklch(0.2 0 0)']]) }), ['Probe: --kd-on-nichts fehlt, dunkel']);
});

/* ── Phasenblock „Wie lange noch“ (FA 13): Grund mischt die Ampel nach dem Anteil ── */

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
function phasenVerstoesse(vorne, grund) {
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
const GRUND = ['--kd-wbs-ok-bg', '--kd-wbs-error-bg'];

test('Phasenblock: --kd-text und --kd-muted auf dem gemischten Grund mindestens 4,5 bei jedem Anteil', () => {
  assert.deepStrictEqual([...phasenVerstoesse('--kd-text', GRUND), ...phasenVerstoesse('--kd-muted', GRUND)], []);
});

test('Phasenblock: Abzeichen mit gemischter Ampelschrift auf dem gemischten Grund mindestens 4,5', () => {
  assert.deepStrictEqual(phasenVerstoesse(['--kd-wbs-ok-ink', '--kd-wbs-error-ink'], GRUND), []);
});

test('Phasenblock: ansicht.js setzt den Anteil (--anteil), keinen Farbton (--h)', () => {
  const ansicht = lies('ansicht.js');
  assert.match(ansicht, /<section class="wl-phase" style="--anteil:\$\{anteil\}"/);
  assert.doesNotMatch(ansicht, /--h:/);
  assert.doesNotMatch(lies('kd-app.css'), /var\(--h\)/);
});

test('Selbstprobe Mischung: Anteil 1 ist die erste Farbe, 0 die zweite, ½ geht den kürzeren Farbtonweg', () => {
  assert.strictEqual(mische('oklch(0.9 0.1 350)', 'oklch(0.5 0.1 10)', 1), 'oklch(0.9 0.1 350)');
  assert.strictEqual(mische('oklch(0.9 0.1 350)', 'oklch(0.5 0.1 10)', 0), 'oklch(0.5 0.1 10)');
  assert.strictEqual(mische('oklch(0.9 0.1 350)', 'oklch(0.5 0.1 10)', 0.5), 'oklch(0.7 0.1 0)');
});

/* ── Dunkelblöcke ── */

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
  const funde = gepruefteDateien().flatMap(datei => literaleOhneAusstehende(datei, lies(datei)));
  assert.deepStrictEqual(funde, []);
});

test('Literale Modusleiste: .kz.modus .kz-z1 und .kz-modus .kz-btn ohne Farbliteral', { todo: MODUS }, () => {
  const app = lies('kd-app.css');
  assert.deepStrictEqual(literalZeilen('kd-app.css', app).length, literaleOhneAusstehende('kd-app.css', app).length);
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

/* ── faint ── */

test('faint: --kd-faint nur an den 5 erlaubten Selektoren', () => {
  const funde = ['kd-app.css', 'kd-base.css'].flatMap(datei => faintStellen(datei, lies(datei)));
  assert.deepStrictEqual(funde, []);
});

test('Selbstprobe faint: eine neue Regel mit --kd-faint wird mit Zeile erkannt, eine erlaubte nicht', () => {
  const probe = '.bf-chip{text-decoration-color:var(--kd-faint)}\n@media (x){.neu .k{color:var(--kd-faint)}}';
  assert.deepStrictEqual(faintStellen('probe', probe), ['probe:2 .neu .k']);
});
