// Wächter für ADR-0025 Regel 6 (R00148 AK 17, Sollte S4 aus dem Architektur-Review): jede schreibende Anfrage der
// Oberfläche steht lexikalisch im Aufruf der einen Stelle — `durchDieSchlange(…)` oder `warteschlange(…)`. Gezählt
// wird jedes `api(` mit einer anderen Methode als 'GET' (auch mit variabler Methode) und jedes `fetch(` mit `method:`;
// ausgenommen ist nur der Rumpf von `api` selbst, der eine Netzaufruf.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const WEB = path.resolve(__dirname, '../../web');

/** Der Quelltext ohne Inhalt von Zeichenketten, Vorlagen und Kommentaren — Klammern darin zählen nicht mit. */
function codeOhneLiterale(text) {
  // Zeichenketten, Vorlagen und Kommentare werden durch Leerzeichen ersetzt, Zeilen und Stellen bleiben erhalten.
  let aus = '', i = 0;
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (c === '/' && n === '/') { const e = text.indexOf('\n', i); const bis = e < 0 ? text.length : e; aus += ' '.repeat(bis - i); i = bis; continue; }
    if (c === '/' && n === '*') { const bis = text.indexOf('*/', i + 2) + 2; aus += text.slice(i, bis).replace(/[^\n]/g, ' '); i = bis; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === '\\' ? 2 : 1;
      aus += c + text.slice(i + 1, j).replace(/[^\n]/g, ' ') + c; i = j + 1; continue;
    }
    aus += c; i++;
  }
  return aus;
}

/** Bereiche [anfang, ende) der Argumentlisten aller Aufrufe, die `muster` trifft (Klammern ausgezählt). */
function aufrufBereiche(code, muster) {
  const bereiche = [];
  for (const m of code.matchAll(muster)) {
    const anfang = m.index + m[0].length;
    let tiefe = 1, j = anfang;
    while (j < code.length && tiefe > 0) { if (code[j] === '(') tiefe++; else if (code[j] === ')') tiefe--; j++; }
    bereiche.push([anfang, j]);
  }
  return bereiche;
}

/** Rumpf einer Funktionsdeklaration `function name(…) { … }` als Bereich. */
function rumpfBereiche(code, name) {
  const bereiche = [];
  for (const m of code.matchAll(new RegExp(`function ${name}\\(`, 'g'))) {
    const anfang = code.indexOf('{', m.index);
    let tiefe = 1, j = anfang + 1;
    while (j < code.length && tiefe > 0) { if (code[j] === '{') tiefe++; else if (code[j] === '}') tiefe--; j++; }
    bereiche.push([anfang, j]);
  }
  return bereiche;
}

/** Der eine POST, der nicht schreibt — genau dieser Pfad, kein anderer (ADR-0043 N1.4: kein Commit, keine Datei). */
const TROCKENLAUF = "api('POST', '/api/einstellungen/vorschau'";

/** Schreibende Netzaufrufe außerhalb der einen Stelle, als `datei:zeile`. */
function schreibwegeVorbei(quellen) {
  return quellen.flatMap(({ datei, text }) => {
    const code = codeOhneLiterale(text);
    const erlaubt = [...aufrufBereiche(code, /\b(?:durchDieSchlange|warteschlange)\(/g), ...rumpfBereiche(code, 'api')];
    const drin = stelle => erlaubt.some(([a, e]) => stelle >= a && stelle < e);
    const funde = [];
    // api(…) mit einer Methode ungleich 'GET' — der Text der Methode steht im Original, die Stelle im bereinigten Code
    for (const m of code.matchAll(/(?<![\w.])api\(/g)) {
      if (code.slice(Math.max(0, m.index - 9), m.index) === 'function ') continue;
      if (text.startsWith("api('GET'", m.index)) continue;
      // der Trockenlauf der Einstellungen schreibt nichts und darf „Speichern“ nicht aufhalten (R00250, ADR-0043 N1.1/N1.2 Punkt 2)
      if (text.startsWith(TROCKENLAUF, m.index)) continue;
      if (!drin(m.index)) funde.push(m.index);
    }
    for (const m of code.matchAll(/(?<![\w.])fetch\(/g)) {
      const bis = aufrufBereiche(code.slice(m.index), /^fetch\(/g)[0][1];
      if (/method\s*:/.test(text.slice(m.index, m.index + bis)) && !drin(m.index)) funde.push(m.index);
    }
    return funde.map(stelle => `${datei}:${text.slice(0, stelle).split('\n').length}`);
  });
}

const quellenAusWeb = () => fs.readdirSync(WEB).filter(n => n.endsWith('.js')).sort().map(datei => ({ datei, text: fs.readFileSync(path.join(WEB, datei), 'utf8') }));

test('ADR-0025 Regel 6: jede schreibende Anfrage in web/*.js läuft durch durchDieSchlange oder warteschlange', () => {
  assert.deepStrictEqual(schreibwegeVorbei(quellenAusWeb()), []);
});

test('Wächter erkennt einen Schreibaufruf am Schreibweg vorbei — api mit Methode, api mit variabler Methode, fetch mit method', () => {
  const text = [
    "function a() { api('DELETE', '/x'); }",
    "function b(m) { return api(m, '/y'); }",
    "async function c() { await fetch('/z', { method: 'POST' }); }",
    "function d() { return durchDieSchlange(() => api('PUT', '/ok', { t: '(' })); }",
    "function e() { return api('GET', '/lesen'); }",
    "async function f() { await fetch('/lesen'); }",
    "function g() { return api('POST', '/api/einstellungen/vorschau', {}); }",
    "function h() { return api('PUT', '/api/einstellungen/vorschau', {}); }",
    "function i() { return api('POST', '/api/einstellungen', {}); }",
  ].join('\n');
  assert.deepStrictEqual(schreibwegeVorbei([{ datei: 'probe.js', text }]), ['probe.js:1', 'probe.js:2', 'probe.js:8', 'probe.js:9', 'probe.js:3'], 'api-Funde vor fetch-Funden');
});
