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

/* ── B1108 Tokens je Hunk und Seite (ADR-0037 Punkte 4–5, ADR-0040 Punkt 3), Prism echt ── */

const { patchZeilen } = require('../../web/diff.js');
const { hunkTokens, ROLLEN, prism } = require('../../web/faerben.js');

/** Die Stücke als lesbare Liste: [Zeile, Text des Stücks, Klasse]. */
function stuecke(patch, sprache) {
  const zeilen = patchZeilen(patch);
  const a = hunkTokens(zeilen, prism.languages[sprache]);
  assert.ok(a instanceof Int32Array, 'Antwort ist ein Int32Array');
  assert.strictEqual(a.length % 4, 0, 'Viererpaare');
  const aus = [];
  for (let k = 0; k < a.length; k += 4) aus.push([a[k], zeilen[a[k]].text.slice(a[k + 1], a[k + 2]), ROLLEN[a[k + 3]]]);
  return aus;
}
const rolleVon = (liste, zeile, text) => liste.filter(s => s[0] === zeile && s[1] === text).map(s => s[2]);
const zeilenMit = (liste, klasse) => [...new Set(liste.filter(s => s[2] === klasse).map(s => s[0]))];

test('ROLLEN: die sieben Klassen in fester Reihenfolge', () => {
  assert.deepStrictEqual(ROLLEN, ['tk-keyword', 'tk-string', 'tk-comment', 'tk-number', 'tk-function', 'tk-type', 'tk-macro']);
});

test('hunkTokens: `fn` ist Schlüsselwort, der Blockkommentar über drei Zeilen ist in jeder Zeile ganz Kommentar, der Kopf ohne Stück', () => {
  const s = stuecke('@@ -0,0 +1,4 @@\n+/* Kopf\n+   zweite Zeile\n+*/\n+fn main() {}\n', 'rust');
  assert.deepStrictEqual(rolleVon(s, 4, 'fn'), ['tk-keyword']);
  assert.deepStrictEqual(rolleVon(s, 1, '/* Kopf'), ['tk-comment']);
  assert.deepStrictEqual(rolleVon(s, 2, '   zweite Zeile'), ['tk-comment'], 'die mittlere Zeile ganz');
  assert.deepStrictEqual(rolleVon(s, 3, '*/'), ['tk-comment']);
  assert.deepStrictEqual(s.filter(x => x[0] === 0), [], 'Hunk-Kopf ohne Rolle');
  assert.deepStrictEqual(rolleVon(s, 4, 'main'), ['tk-function']);
});

test('hunkTokens: ein mehrzeiliger String ist in jeder Zeile String', () => {
  const s = stuecke('@@ -0,0 +1,3 @@\n+let s = "eins\n+zwei\n+drei";\n', 'rust');
  assert.deepStrictEqual(zeilenMit(s, 'tk-string'), [1, 2, 3]);
  assert.deepStrictEqual(rolleVon(s, 2, 'zwei'), ['tk-string']);
});

test('hunkTokens: entfernt nimmt die alte Seite, Kontext und hinzugefügt die neue (src/seiten.rs)', () => {
  const s = stuecke('@@ -1,3 +1,3 @@\n let a = 1;\n-/* weg\n+let b = 2;\n */ let c = 3;\n', 'rust');
  assert.deepStrictEqual(rolleVon(s, 2, '/* weg'), ['tk-comment'], 'alte Seite');
  assert.deepStrictEqual(s.filter(x => x[0] === 4 && x[2] === 'tk-comment'), [], '`*/` im Kontext ist auf der neuen Seite kein Kommentar');
  assert.deepStrictEqual(rolleVon(s, 4, 'let'), ['tk-keyword']);
  assert.deepStrictEqual(rolleVon(s, 3, 'let'), ['tk-keyword']);
});

test('hunkTokens: je Hunk — ein offener Kommentar am Ende von Hunk 1 färbt Hunk 2 nicht (src/hunks.rs)', () => {
  const patch = '@@ -1,4 +1,5 @@\n let x1 = 1;\n let x2 = 2;\n+/* offen\n let x3 = 3;\n let x4 = 4;\n@@ -15,3 +16,5 @@\n let x15 = 15;\n+fn b() {}\n+*/\n let x16 = 16;\n';
  const s = stuecke(patch, 'rust');
  assert.deepStrictEqual(rolleVon(s, 8, 'fn'), ['tk-keyword'], 'Hunk 2 beginnt neu');
  // Gegenprobe der Ausgangslage: über beide Hunks gelesen wäre `fn` Kommentar (Mutante „über alle Hunks der Datei“)
  const ueberAlle = stuecke(patch.replace('@@ -15,3 +16,5 @@\n', ''), 'rust');
  assert.deepStrictEqual(rolleVon(ueberAlle, 7, 'fn b() {}'), ['tk-comment']);
});

test('hunkTokens: `\\ No newline at end of file` ohne Stück, die Seite läuft darüber weiter', () => {
  const zeilen = patchZeilen('@@ -1 +1,2 @@\n-/* a\n\\ No newline at end of file\n+/* a\n+b */\n');
  const a = hunkTokens(zeilen, prism.languages.rust);
  const zeilenIdx = [];
  for (let k = 0; k < a.length; k += 4) zeilenIdx.push(a[k]);
  assert.ok(!zeilenIdx.includes(2), 'Hinweiszeile ohne Stück');
  assert.ok(zeilenIdx.includes(3) && zeilenIdx.includes(4), 'die neue Seite ist gefärbt');
});

test('hunkTokens: verschachtelt gilt die innerste Rolle der Tabelle (Schlüsselwort im Template-String)', () => {
  const s = stuecke('@@ -0,0 +1 @@\n+const t = `a${typeof x}b`;\n', 'javascript');
  assert.deepStrictEqual(rolleVon(s, 1, 'typeof'), ['tk-keyword']);
  assert.deepStrictEqual(rolleVon(s, 1, 'a'), ['tk-string']);
});

test('hunkTokens: Rollen nur 0–6, Stücke innerhalb ihrer Zeile, ohne Grammatik leer und ohne Wurf', () => {
  const zeilen = patchZeilen('@@ -0,0 +1,3 @@\n+<a href="x">y</a>\n+<!-- k -->\n+<?xml version="1.0"?>\n');
  const a = hunkTokens(zeilen, prism.languages.markup);
  assert.ok(a.length > 0);
  for (let k = 0; k < a.length; k += 4) {
    assert.ok(a[k + 3] >= 0 && a[k + 3] <= 6, 'Rolle 0–6');
    assert.ok(a[k + 1] >= 0 && a[k + 1] < a[k + 2] && a[k + 2] <= zeilen[a[k]].text.length, 'Stück in der Zeile');
  }
  assert.strictEqual(hunkTokens(zeilen, undefined).length, 0);
});
