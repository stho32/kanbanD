// R00247 B1295: Paarung und Wortmarke je Zeile als reine Rechnung (ADR-0042 Punkt 4, W1) — ohne Browser. Zeilen wie aus `patchZeilen`,
// Marken `[von, bis)` in UTF-16-Einheiten des Zeilentexts; Fälle aus R00247 K-Wort und K-Rand.
const test = require('node:test');
const assert = require('node:assert');
const u = require('../../web/review-uebersicht.js');
const d = require('../../web/diff.js');

const minus = text => ({ art: 'minus', text });
const plus = text => ({ art: 'plus', text });
const kontext = text => ({ art: 'kontext', text });
/** Marken eines einzelnen Paars: [gelöscht, hinzugefügt]. */
const paar = (alt, neu) => u.wortMarken([minus(alt), plus(neu)]);

test('AK 1 (a): `let a = 1;` → `let a = 2;` markiert [8, 9) in beiden Zeilen', () => {
  assert.deepStrictEqual(paar('let a = 1;', 'let a = 2;'), [[8, 9], [8, 9]]);
});

test('AK 1 (c): `a = 1` → `a = 2` — Präfix 4 und Suffix 0 erreichen die Schwelle, [4, 5)', () => {
  assert.deepStrictEqual(paar('a = 1', 'a = 2'), [[4, 5], [4, 5]]);
});

test('AK 2 (b): Wortgrenze — `alt_name` → `alt_namen` markiert das ganze Wort, gelöscht [3, 11), hinzugefügt [3, 12)', () => {
  assert.deepStrictEqual(paar('fn alt_name(x) {}', 'fn alt_namen(x) {}'), [[3, 11], [3, 12]]);
});

test('AK 2: Wortgrenze nach rechts — `x = foo1bar;` → `x = foo2bar;` markiert das ganze Wort', () => {
  assert.deepStrictEqual(paar('x = foo1bar;', 'x = foo2bar;'), [[4, 11], [4, 11]]);
});

test('AK 2: Wortzeichen sind Buchstaben jeder Schrift, Ziffern und _ — `ä_ö1` → `ä_ö2` bleibt ein Wort', () => {
  assert.deepStrictEqual(paar('x = ä_ö1;', 'x = ä_ö2;'), [[4, 8], [4, 8]]);
});

test('AK 3 (d): Schwelle — `a=1;` → `a=2;` (Präfix 2 + Suffix 1 = 3 < 4) ohne Marke', () => {
  assert.deepStrictEqual(paar('a=1;', 'a=2;'), [null, null]);
});

test('AK 3 (e): zwei Änderungen in einer Zeile ergeben einen Bereich mit allem dazwischen, [4, 12)', () => {
  assert.deepStrictEqual(paar('a = 1; b = 2;', 'a = 9; b = 8;'), [[4, 12], [4, 12]]);
});

test('AK 3 (g): Läufe ungleicher Länge (2 gelöschte gegen 3 hinzugefügte) ohne Marke', () => {
  const marken = u.wortMarken([minus('p = 10;'), minus('q = 20;'), plus('p = 11;'), plus('q = 21;'), plus('r = 31;')]);
  assert.deepStrictEqual(marken, [null, null, null, null, null]);
});

test('AK 3 (h): eine nur hinzugefügte und eine nur gelöschte Zeile ohne Marke', () => {
  assert.deepStrictEqual(u.wortMarken([kontext('a'), plus('neu_nur = 1;'), kontext('b'), minus('alt_nur = 1;'), kontext('c')]), [null, null, null, null, null]);
});

test('AK 3 (i): eine unveränderte Zeile zwischen gelöscht und hinzugefügt trennt die Läufe', () => {
  assert.deepStrictEqual(u.wortMarken([minus('x = 1;'), kontext('mitte();'), plus('x = 2;')]), [null, null, null]);
});

test('FA 1: ein Hunk-Kopf zwischen gelöscht und hinzugefügt trennt die Läufe', () => {
  assert.deepStrictEqual(u.wortMarken([minus('x = 1;'), { art: 'kopf', text: '@@ -9 +9 @@' }, plus('x = 2;')]), [null, null, null]);
});

test('FA 1: „\\ No newline at end of file“ zwischen den Läufen trennt nicht (letzte Zeile ohne Zeilenende geändert)', () => {
  const hinweis = { art: 'hinweis', text: '\\ No newline at end of file' };
  assert.deepStrictEqual(u.wortMarken([minus('let a = 1;'), hinweis, plus('let a = 2;'), hinweis]), [[8, 9], null, [8, 9], null]);
});

test('AK 3 (p): reine Einfügung — die hinzugefügte Zeile trägt [7, 10) „3, “, die gelöschte keine Marke (Bereich leer)', () => {
  const [alt, neu] = paar('foo(1, 2)', 'foo(1, 3, 2)');
  assert.strictEqual(alt, null);
  assert.deepStrictEqual(neu, [7, 10]);
  assert.strictEqual('foo(1, 3, 2)'.slice(...neu), '3, ');
});

test('FA 2: reine Löschung — die gelöschte Zeile trägt die Marke, die hinzugefügte keine', () => {
  assert.deepStrictEqual(paar('foo(1, 3, 2)', 'foo(1, 2)'), [[7, 10], null]);
});

test('FA 2: gleiche Zeilen (gepaart) tragen keine Marke', () => {
  assert.deepStrictEqual(paar('let a = 1;', 'let a = 1;'), [null, null]);
});

test('FA 2: der Bereich muss kürzer als die Zeile sein — `abcd1` → `abcd2` wird auf das ganze Wort erweitert, also keine Marke', () => {
  assert.deepStrictEqual(paar('abcd1', 'abcd2'), [null, null]);
});

test('FA 2: Präfix und Suffix zählen vor der Erweiterung — `ab xy1z` → `ab xy2z` markiert das Wort [3, 7)', () => {
  assert.deepStrictEqual(paar('ab xy1z', 'ab xy2z'), [[3, 7], [3, 7]]);
});

test('AK 1: im Lauf wird die i-te gelöschte mit der i-ten hinzugefügten gepaart, je Zeile eine Marke', () => {
  const marken = u.wortMarken([kontext('a'), minus('let a = 1;'), minus('let b = 1;'), plus('let a = 2;'), plus('let b = 3;'), kontext('z')]);
  assert.deepStrictEqual(marken, [null, [8, 9], [8, 9], [8, 9], [8, 9], null]);
});

test('AK 1: je Paar eigene Rechnung — Zeile 1 gegen 1, Zeile 2 gegen 2, nicht über Kreuz', () => {
  const marken = u.wortMarken([minus('kurz = 1;'), minus('viel_laenger = 1;'), plus('kurz = 2;'), plus('viel_laenger = 22;')]);
  assert.deepStrictEqual(marken, [[7, 8], [15, 16], [7, 8], [15, 17]]);
});

test('AK 4 (j): Ersatzpaar am Rand wird nicht geteilt — 😀 → 😁 markiert [9, 11)', () => {
  assert.deepStrictEqual(paar('let s = "😀";', 'let s = "😁";'), [[9, 11], [9, 11]]);
});

test('AK 4 (j): Ersatzpaar am Suffix wird nicht geteilt — 😀 vor gleichem Suffix, verschiedene hohe Hälften', () => {
  // U+1F600 = D83D DE00, U+1F900 = D83E DD00 — gleiche Längen, verschiedene Einheiten; und 𝟘 (D835 DFD8) gegen 😘 (D83D DE18)
  const [alt, neu] = paar('let s = "𝟘";', 'let s = "😘";');
  assert.deepStrictEqual([alt, neu], [[9, 11], [9, 11]]);
  const zuIrgendeinemEmoji = 'let s = "x😀";';
  const [a2, n2] = paar(zuIrgendeinemEmoji, 'let s = "y😀";');
  assert.deepStrictEqual([a2, n2], [[9, 10], [9, 10]]);
});

test('AK 4 (j): ein Emoji mit gleicher niedriger Hälfte — die Marke beginnt nie mit einer niedrigen Hälfte', () => {
  // U+1F600 (D83D DE00) gegen U+1FA00 (D83E DE00): gleiche niedrige Hälfte, das Suffix darf sie nicht abspalten
  const [alt, neu] = paar('let s = "\u{1F600}";', 'let s = "\u{1FA00}";');
  assert.deepStrictEqual([alt, neu], [[9, 11], [9, 11]]);
});

test('AK 4 (k), (l): ein Bidi-Zeichen zählt als eine Einheit wie jedes andere Zeichen', () => {
  assert.deepStrictEqual(paar('v = "1‮2"', 'v = "3‮4"'), [[5, 8], [5, 8]]);
  assert.deepStrictEqual(paar('let t = "a‮b";', 'let t = "a‮c";'), [[11, 12], [11, 12]]);
});

test('AK 4 (m): fremdes HTML ist nur Text — markiert wird „x“ bzw. „y“', () => {
  const alt = 'let h = "<img src=x onerror=window.pwn=1>";', neu = 'let h = "<img src=y onerror=window.pwn=1>";';
  const [a, n] = paar(alt, neu);
  assert.deepStrictEqual([alt.slice(...a), neu.slice(...n)], ['x', 'y']);
});

const zeile1000 = ende => '//' + 'a'.repeat(997) + ende;

test('AK 3 (n): Zeilen mit genau 1.000 Zeichen tragen eine Marke über [2, 1000) — 997 × `a` und „1“ bzw. „2“ (GRENZE_ZEILE gilt mit ≤)', () => {
  assert.strictEqual(zeile1000('1').length, d.GRENZE_ZEILE);
  assert.deepStrictEqual(paar(zeile1000('1'), zeile1000('2')), [[2, 1000], [2, 1000]]);
  assert.strictEqual(zeile1000('2').slice(2, 1000), 'a'.repeat(997) + '2');
});

test('AK 3 (o): Zeilen mit 1.001 Zeichen tragen keine Marke, auch wenn nur eine Zeile des Paars zu lang ist', () => {
  assert.deepStrictEqual(paar('a' + zeile1000('1'), 'a' + zeile1000('2')), [null, null]);
  assert.deepStrictEqual(paar(zeile1000('1'), zeile1000('1') + '2'), [null, null]);
  assert.deepStrictEqual(paar(zeile1000('1') + '2', zeile1000('1')), [null, null]);
});

test('AK 9: zwei Zeilen zu je 1.000 Zeichen ergeben höchstens 2.000 Vergleiche (Zähler)', () => {
  for (const [alt, neu] of [[zeile1000('1'), zeile1000('2')], ['b' + 'a'.repeat(999), 'c' + 'a'.repeat(999)], ['a'.repeat(1000), 'a'.repeat(1000)], ['x'.repeat(1000), 'y'.repeat(1000)]]) {
    const zaehler = { vergleiche: 0 };
    u.wortMarke(alt, neu, zaehler);
    assert.ok(zaehler.vergleiche > 0, 'der Zähler zählt');
    assert.ok(zaehler.vergleiche <= 2000, `${zaehler.vergleiche} Vergleiche`);
  }
});

test('AK 9: die Vergleiche wachsen linear mit der Zeilenlänge — doppelte Länge, höchstens doppelt so viele', () => {
  const zaehle = n => { const z = { vergleiche: 0 }; u.wortMarke('a'.repeat(n) + '1', 'a'.repeat(n) + '2', z); return z.vergleiche; };
  assert.ok(zaehle(800) <= 2 * zaehle(400) + 2, `${zaehle(400)} → ${zaehle(800)}`);
});

/** Eine Zeilenliste aus `n` gleich langen Läufen zu je einer gelöschten und einer hinzugefügten Zeile von etwa 80 Zeichen. */
const lastZeilen = n => {
  const zeilen = [];
  for (let i = 0; i < n; i++) {
    const rumpf = `let wert_${String(i).padStart(6, '0')} = berechne(eingabe, ${'x'.repeat(40)}, `;
    zeilen.push(minus(rumpf + '1);'), plus(rumpf + '2);'), kontext('}'));
  }
  return zeilen;
};

test('AK 9: doppelte Zeilenzahl ergibt doppelt so viele Vergleiche, fünffache das Fünffache (linear, keine Rechnung über das Paar hinaus)', () => {
  const vergleiche = n => { const z = { vergleiche: 0 }; u.wortMarken(lastZeilen(n), z); return z.vergleiche; };
  assert.ok(vergleiche(1000) > 0, 'der Zähler zählt');
  assert.strictEqual(vergleiche(10000), 2 * vergleiche(5000));
  assert.strictEqual(vergleiche(5000), 5 * vergleiche(1000));
});

test('AK 9: über eine ganze Zeilenliste zählt die Paarung die Vergleiche aller Paare zusammen', () => {
  const zeilen = [];
  for (let i = 0; i < 100; i++) zeilen.push(minus(`wert_${i} = 1;`));
  for (let i = 0; i < 100; i++) zeilen.push(plus(`wert_${i} = 2;`));
  const zaehler = { vergleiche: 0 };
  const marken = u.wortMarken(zeilen, zaehler);
  assert.ok(marken.every(m => m !== null));
  assert.ok(zaehler.vergleiche <= 200 * 14, `${zaehler.vergleiche} Vergleiche`);
});

test('AK 6: ein Lauf über die Blockgrenze von 500 Zeilen wird wie ohne Grenze gepaart', () => {
  const zeilen = [{ art: 'kopf', text: '@@ -1 +1 @@' }];
  while (zeilen.length < 498) zeilen.push(kontext(`c ${zeilen.length}`));
  zeilen.push(minus('d1 = 1;'), minus('d2 = 1;'), minus('d3 = 1;'), plus('d1 = 2;'), plus('d2 = 2;'), plus('d3 = 2;'));
  assert.strictEqual(zeilen[500].text, 'd3 = 1;', 'die Grenze liegt zwischen der zweiten und dritten gelöschten Zeile');
  const marken = u.wortMarken(zeilen);
  assert.deepStrictEqual(marken.slice(498), [[5, 6], [5, 6], [5, 6], [5, 6], [5, 6], [5, 6]]);
});
