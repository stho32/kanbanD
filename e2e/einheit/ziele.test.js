// Reine Probe der Zielgröße (R00108, ADR-0012 Regel 1 und 7): node --test
// Liest die Stylesheets als Text, ohne Browser: das Maß steht genau einmal je Zeiger an einem Ort.
"use strict";
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const WEB = path.resolve(__dirname, '../../web');
const TOKENS = 'kd-tokens.css';
const lies = datei => fs.readFileSync(path.join(WEB, datei), 'utf8');

/** Deklarationen samt umschließender @-Regeln: [{ name, wert, touch }]. */
function deklarationen(css) {
  const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const stapel = [];
  const gefunden = [];
  let anfang = 0;
  for (let i = 0; i < ohneKommentare.length; i++) {
    const zeichen = ohneKommentare[i];
    if (zeichen === '{') {
      stapel.push(ohneKommentare.slice(anfang, i).trim());
      anfang = i + 1;
    } else if (zeichen === '}' || zeichen === ';') {
      const teil = ohneKommentare.slice(anfang, i);
      const doppelpunkt = teil.indexOf(':');
      if (doppelpunkt > 0) {
        const touch = stapel.some(kopf => /^@media\b/.test(kopf) && /pointer\s*:\s*coarse/.test(kopf));
        gefunden.push({ name: teil.slice(0, doppelpunkt).trim(), wert: teil.slice(doppelpunkt + 1).trim(), touch });
      }
      if (zeichen === '}') stapel.pop();
      anfang = i + 1;
    }
  }
  return gefunden;
}

/** Fehler des Tokens --kd-ziel: genau einmal je Zeiger, fein 24px, Touch 48px. */
function zielFehler(css) {
  const ziele = deklarationen(css).filter(d => d.name === '--kd-ziel');
  const fein = ziele.filter(d => !d.touch);
  const touch = ziele.filter(d => d.touch);
  const fehler = [];
  if (fein.length !== 1) fehler.push(`fein ${fein.length}-mal statt einmal`);
  if (touch.length !== 1) fehler.push(`Touch ${touch.length}-mal statt einmal`);
  if (fein.length === 1 && fein[0].wert !== '24px') fehler.push(`fein ${fein[0].wert} statt 24px`);
  if (touch.length === 1 && touch[0].wert !== '48px') fehler.push(`Touch ${touch[0].wert} statt 48px`);
  return fehler;
}

const MINDESTMASS = /^min-(width|height|block-size|inline-size)$/;

/** Mindestgrößen mit Zahlenwert innerhalb von @media (pointer:coarse): [„name:wert“]. */
function touchZahlen(css) {
  return deklarationen(css)
    .filter(d => d.touch && MINDESTMASS.test(d.name) && /\d/.test(d.wert.replace(/var\([^)]*\)/g, '')))
    .map(d => `${d.name}:${d.wert}`);
}

const mitWert = (css, alt, neu) => {
  const ersetzt = css.replace(alt, neu);
  assert.notStrictEqual(ersetzt, css, `Mutante ${neu} nicht eingesetzt`);
  return ersetzt;
};
const FEIN = /(--kd-ziel\s*:\s*)24px/;
const TOUCH = /(--kd-ziel\s*:\s*)48px/;

test('--kd-ziel fein genau 24', () => {
  assert.deepStrictEqual(zielFehler(lies(TOKENS)), []);
});

test('--kd-ziel: Mutanten fein 23 und 44 fallen durch', () => {
  for (const mutante of ['23px', '44px']) {
    assert.deepStrictEqual(zielFehler(mitWert(lies(TOKENS), FEIN, `$1${mutante}`)), [`fein ${mutante} statt 24px`]);
  }
});

test('--kd-ziel: Mutanten Touch 47 und 43 fallen durch', () => {
  for (const mutante of ['47px', '43px']) {
    assert.deepStrictEqual(zielFehler(mitWert(lies(TOKENS), TOUCH, `$1${mutante}`)), [`Touch ${mutante} statt 48px`]);
  }
});

test('--kd-ziel steht in keinem anderen Stylesheet', () => {
  const andere = fs.readdirSync(WEB).filter(d => d.endsWith('.css') && d !== TOKENS);
  for (const datei of andere) {
    assert.deepStrictEqual(deklarationen(lies(datei)).filter(d => d.name === '--kd-ziel'), [], datei);
  }
});

test('zielFehler: fehlender Touch-Block und doppelte Angabe fallen auf', () => {
  assert.deepStrictEqual(zielFehler(':root{--kd-ziel:24px}'), ['Touch 0-mal statt einmal']);
  assert.deepStrictEqual(zielFehler(':root{--kd-ziel:24px}.x{--kd-ziel:24px}@media (pointer:coarse){:root{--kd-ziel:48px}}'), ['fein 2-mal statt einmal']);
});

test('Wächter erkennt Mindestgrößen mit Zahl unter pointer:coarse, nicht das Token und nichts außerhalb', () => {
  const css = '.a{min-width:32px}@media (max-width:640px) and (pointer: coarse){.b{min-height:44px;min-block-size:var(--kd-ziel)}.c{height:30px}}';
  assert.deepStrictEqual(touchZahlen(css), ['min-height:44px']);
});

const TOUCH_LISTE = () => fs.readdirSync(WEB)
  .filter(d => d.endsWith('.css') && d !== TOKENS)
  .flatMap(datei => touchZahlen(lies(datei)).map(fund => `${datei} ${fund}`));

test('Wächter: kein Stylesheet außer kd-tokens.css nennt unter pointer:coarse eine Mindestgröße in Zahlen', { todo: 'Touch-Liste aufgelöst (B0404)' }, () => {
  assert.deepStrictEqual(TOUCH_LISTE(), []);
});

test('Alarm: die Touch-Liste besteht noch — fällt dieser Test, ist B0404 erledigt und das todo oben zu entfernen', () => {
  assert.ok(TOUCH_LISTE().length > 0);
});
