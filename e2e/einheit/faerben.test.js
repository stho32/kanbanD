// R00217 Syntaxfarben der Review-Seite (ADR-0040): Sprache nach Endung, Grenze je Datei (web/diff.js) — ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const { spracheZuPfad, faerbbar, GRENZE_PATCH, GRENZE_ZEILE } = require('../../web/diff.js');

/* ── B1107 Sprache nach Endung (ADR-0037 Punkt 3) ── */

test('spracheZuPfad: jede Endung der Tabelle ergibt ihre Grammatik', () => {
  const tabelle = {
    rs: 'rust', js: 'javascript', mjs: 'javascript', cjs: 'javascript', json: 'json', css: 'css', html: 'markup', htm: 'markup',
    xml: 'markup', svg: 'markup', md: 'markdown', py: 'python', sh: 'bash', bash: 'bash', yml: 'yaml', yaml: 'yaml', sql: 'sql',
    cs: 'csharp', toml: 'toml', php: 'php', diff: 'diff', patch: 'diff',
  };
  for (const [endung, sprache] of Object.entries(tabelle)) assert.strictEqual(spracheZuPfad(`ordner/datei.${endung}`), sprache, endung);
});

test('spracheZuPfad: Groß- und Kleinschreibung egal, letzte Endung zählt, nur der Name der Datei', () => {
  assert.strictEqual(spracheZuPfad('SRC/GROSS.RS'), 'rust');
  assert.strictEqual(spracheZuPfad('a.test.rs'), 'rust');
  assert.strictEqual(spracheZuPfad('x.rs/README'), null);
  assert.strictEqual(spracheZuPfad('Makefile'), null);
  assert.strictEqual(spracheZuPfad('notiz.unbekannt'), null);
  assert.strictEqual(spracheZuPfad('Typ.TS'), null);
  assert.strictEqual(spracheZuPfad('konstruktor.rs.orig'), null);
  assert.strictEqual(spracheZuPfad('toString'), null, 'kein Eintrag aus dem Prototyp');
  assert.strictEqual(spracheZuPfad('a.constructor'), null, 'kein Eintrag aus dem Prototyp');
});

/* ── B1107 Grenze je Datei (ADR-0037 Punkt 7, R00217 FA 4) ── */

/** Ein Patch aus genau `laenge` Zeichen: Kopf und Zeilen zu höchstens 1.000 Zeichen mit Vorzeichen. */
function patchMit(laenge) {
  const kopf = '@@ -0,0 +1,300 @@';
  const zeilen = [kopf];
  let n = kopf.length;
  while (n < laenge) {
    const rest = laenge - n - 1;
    const z = '+' + 'a'.repeat(Math.min(999, rest - 1));
    zeilen.push(z);
    n += 1 + z.length;
  }
  const p = zeilen.join('\n');
  assert.strictEqual(p.length, laenge);
  return p;
}

test('faerbbar: 262.144 Zeichen ja, 262.145 nein (≤, nicht <)', () => {
  assert.strictEqual(GRENZE_PATCH, 262144);
  assert.strictEqual(faerbbar(patchMit(262144)), true);
  assert.strictEqual(faerbbar(patchMit(262145)), false);
  assert.strictEqual(faerbbar(patchMit(262144) + '\n'), false, 'auch das abschließende \\n zählt zur Länge des Patches');
});

test('faerbbar: Zeile mit Vorzeichen 1.000 ja, 1.001 nein; das \\n zählt nicht', () => {
  assert.strictEqual(GRENZE_ZEILE, 1000);
  assert.strictEqual(faerbbar(`@@ -0,0 +1,2 @@\n+${'a'.repeat(999)}\n+fn g() {}\n`), true);
  assert.strictEqual(faerbbar(`@@ -0,0 +1,2 @@\n+${'a'.repeat(1000)}\n+fn h() {}\n`), false);
  assert.strictEqual(faerbbar(` ${'a'.repeat(999)}\n-${'b'.repeat(999)}`), true, 'Kontext und entfernt mit Vorzeichen');
  assert.strictEqual(faerbbar(`-${'b'.repeat(1000)}`), false);
});

test('faerbbar: gezählt in UTF-16-Einheiten — 500 × 😀 mit Vorzeichen sind 1.001', () => {
  assert.strictEqual(faerbbar('+' + '😀'.repeat(499) + 'a'), true, '1 + 998 + 1 = 1.000');
  assert.strictEqual(faerbbar('+' + '😀'.repeat(500)), false);
});
