// R00249 „Nebeneinander“ (Karte #260, ADR-0042 N6): Gegenüberstellung der Zeilen (B1306), Zustand des Schalters (B1307) — rein, ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const u = require('../../web/review-uebersicht.js');
const d = require('../../web/diff.js');

const kopf = t => ({ art: 'kopf', text: t || '@@ -1 +1 @@' });
const kontext = t => ({ art: 'kontext', text: t });
const minus = t => ({ art: 'minus', text: t });
const plus = t => ({ art: 'plus', text: t });
const hinweis = () => ({ art: 'hinweis', text: '\\ No newline at end of file' });
/** Die Tabellenzeilen als Text: „l|r“ mit den Texten der Zeilen, „-“ für leer; Kopf „@@“, Hinweis „\l|\r“. */
const lesbar = (zeilen, tabelle) => tabelle.map(t => {
  const seite = z => (z === null ? '-' : zeilen[z].art === 'hinweis' ? '\\' : zeilen[z].text);
  if (t.art === 'kopf') return `@@${t.z}`;
  return `${seite(t.links)}|${seite(t.rechts)}`;
});

/* ── B1306 Gegenüberstellung (FA 2, ADR-0042 N6.4) ── */

test('gegenueberstellen: Lauf 1 gegen 1 steht in einer Zeile, i-te gegen i-te (AK 2 a)', () => {
  const zeilen = [kopf(), minus('let a = 1;'), plus('let a = 2;')];
  const t = u.gegenueberstellen(zeilen);
  assert.deepStrictEqual(t, [{ art: 'kopf', z: 0 }, { art: 'zeile', links: 1, rechts: 2 }]);
});

test('gegenueberstellen: 2 gelöschte gegen 3 hinzugefügte ergeben 3 Zeilen, der Überhang steht gegenüber leer (AK 2 b, m1)', () => {
  const zeilen = [minus('p = 10;'), minus('q = 20;'), plus('p = 11;'), plus('q = 21;'), plus('r = 31;')];
  assert.deepStrictEqual(lesbar(zeilen, u.gegenueberstellen(zeilen)), ['p = 10;|p = 11;', 'q = 20;|q = 21;', '-|r = 31;']);
});

test('gegenueberstellen: 3 gelöschte gegen 2 hinzugefügte ergeben 3 Zeilen, rechts leer am Ende', () => {
  const zeilen = [minus('a1'), minus('a2'), minus('a3'), plus('b1'), plus('b2')];
  assert.deepStrictEqual(lesbar(zeilen, u.gegenueberstellen(zeilen)), ['a1|b1', 'a2|b2', 'a3|-']);
});

test('gegenueberstellen: nur gelöscht steht links, nur hinzugefügt rechts; Kontext in beiden Spalten mit demselben Index (AK 2 c, d, m2)', () => {
  const zeilen = [kontext('k1'), plus('z = 0;'), kontext('k2'), minus('y = 0;'), kontext('k3')];
  const t = u.gegenueberstellen(zeilen);
  assert.deepStrictEqual(lesbar(zeilen, t), ['k1|k1', '-|z = 0;', 'k2|k2', 'y = 0;|-', 'k3|k3']);
  assert.deepStrictEqual(t[0], { art: 'zeile', links: 0, rechts: 0 });
});

test('gegenueberstellen: ein hinzugefügter Lauf vor einem gelöschten wird nicht gepaart (nur gelöscht → hinzugefügt ist ein Lauf)', () => {
  const zeilen = [plus('n1'), minus('a1')];
  assert.deepStrictEqual(lesbar(zeilen, u.gegenueberstellen(zeilen)), ['-|n1', 'a1|-']);
});

test('gegenueberstellen: Hunk (b) mit drei Kontextzeilen davor und danach hat 9 Tabellenzeilen und einen Kopf (bei „aus“ 11 und ein Kopf)', () => {
  const zeilen = [kopf(), kontext('c1'), kontext('c2'), kontext('c3'), minus('p = 10;'), minus('q = 20;'), plus('p = 11;'), plus('q = 21;'), plus('r = 31;'), kontext('c4'), kontext('c5'), kontext('c6')];
  const t = u.gegenueberstellen(zeilen);
  assert.strictEqual(t.filter(x => x.art === 'kopf').length, 1);
  assert.strictEqual(t.filter(x => x.art === 'zeile').length, 9);
  assert.strictEqual(zeilen.length - 1, 11);
});

test('gegenueberstellen: ein Kopf trennt Läufe; Kopf steht als eigene Zeile', () => {
  const zeilen = [minus('a'), kopf('@@ -9 +9 @@'), plus('b')];
  assert.deepStrictEqual(lesbar(zeilen, u.gegenueberstellen(zeilen)), ['a|-', '@@1', '-|b']);
});

test('gegenueberstellen: „Zeilenende am Dateiende unverändert fehlend“ (-x \\ +x \\) ist eine Zeile mit einer Hinweiszeile in beiden Spalten (ende.rs, m15)', () => {
  const zeilen = [minus('x'), hinweis(), plus('y'), hinweis()];
  const t = u.gegenueberstellen(zeilen);
  assert.deepStrictEqual(t, [{ art: 'zeile', links: 0, rechts: 2 }, { art: 'hinweis', links: 1, rechts: 3 }]);
});

test('gegenueberstellen: „Zeilenende ergänzt“ (-x \\ +x) ist eine Zeile und eine Hinweiszeile nur links (enden.rs)', () => {
  const zeilen = [minus('x'), hinweis(), plus('x')];
  assert.deepStrictEqual(u.gegenueberstellen(zeilen), [{ art: 'zeile', links: 0, rechts: 2 }, { art: 'hinweis', links: 1, rechts: null }]);
});

test('gegenueberstellen: „Zeilenende entfernt“ (-x +x \\) hat den Hinweis nur rechts', () => {
  const zeilen = [minus('x'), plus('x'), hinweis()];
  assert.deepStrictEqual(u.gegenueberstellen(zeilen), [{ art: 'zeile', links: 0, rechts: 1 }, { art: 'hinweis', links: null, rechts: 2 }]);
});

test('gegenueberstellen: der Hinweis einer Kontextzeile steht in beiden Spalten mit demselben Index', () => {
  const zeilen = [minus('a'), plus('b'), kontext('ende'), hinweis()];
  assert.deepStrictEqual(u.gegenueberstellen(zeilen).slice(1), [{ art: 'zeile', links: 2, rechts: 2 }, { art: 'hinweis', links: 3, rechts: 3 }]);
});

test('gegenueberstellen: Inkauf N6.4 — 1 gelöschte mit Hinweis gegen 3 hinzugefügte: Zeile 1, Hinweis, Zeilen 2 und 3', () => {
  const zeilen = [minus('x'), hinweis(), plus('a'), plus('b'), plus('c')];
  assert.deepStrictEqual(lesbar(zeilen, u.gegenueberstellen(zeilen)), ['x|a', '\\|-', '-|b', '-|c']);
});

test('gegenueberstellen: jede Zeile der Liste steht genau einmal (Kontext zweimal mit demselben Index), Reihenfolge der Indizes bleibt je Seite', () => {
  const zeilen = [kopf(), kontext('a'), minus('b'), minus('c'), plus('d'), kontext('e'), plus('f'), minus('g'), hinweis(), plus('h'), hinweis()];
  const t = u.gegenueberstellen(zeilen);
  const gesehen = [];
  for (const x of t) {
    if (x.art === 'kopf') gesehen.push(x.z);
    else for (const z of new Set([x.links, x.rechts])) if (z !== null) gesehen.push(z);
  }
  assert.deepStrictEqual([...gesehen].sort((a, b) => a - b), zeilen.map((_, i) => i));
  const links = t.filter(x => x.art === 'zeile' && x.links !== null).map(x => x.links);
  assert.deepStrictEqual(links, [...links].sort((a, b) => a - b));
});

test('gegenueberstellen: jede Wortmarke steht mit ihrem Gegenstück in derselben Tabellenzeile (ADR-0042 N6.4, erster Satz von B1306)', () => {
  const zeilen = [kopf(), kontext('k'), minus('let a = 1;'), plus('let a = 2;'), minus('p = 10;'), minus('q = 20;'), plus('p = 11;'), plus('q = 21;'), kontext('k2'), minus('x = 1;'), minus('y = 1;'), plus('x = 2;'), plus('y = 2;')];
  const marken = u.wortMarken(zeilen);
  const t = u.gegenueberstellen(zeilen);
  for (let i = 0; i < zeilen.length; i++) {
    if (!marken[i]) continue;
    const zeile = t.find(x => x.art === 'zeile' && (x.links === i || x.rechts === i));
    assert.ok(zeile.links !== null && zeile.rechts !== null && marken[zeile.links] && marken[zeile.rechts], `Zeile ${i}`);
  }
});

test('gegenueberstellen: ein Lauf über die Blockgrenze (Index 500) bleibt gepaart — die Gegenüberstellung läuft über die ganze Liste (AK 8, m13)', () => {
  const zeilen = [kopf()];
  for (let i = 1; i <= 248; i++) zeilen.push(kontext(`c${i}`), plus(`n${i}`));
  zeilen.push(kontext('c249'), minus('d1 = 1;'), minus('d2 = 1;'), minus('d3 = 1;'), plus('d1 = 2;'), plus('d2 = 2;'), plus('d3 = 2;'), kontext('z'));
  assert.strictEqual(zeilen[500].text, 'd3 = 1;', 'die Grenze liegt zwischen der zweiten und dritten gelöschten Zeile');
  const t = u.gegenueberstellen(zeilen);
  const paare = t.filter(x => x.art === 'zeile' && x.links !== null && x.rechts !== null && x.links !== x.rechts).map(x => `${zeilen[x.links].text}|${zeilen[x.rechts].text}`);
  assert.deepStrictEqual(paare, ['d1 = 1;|d1 = 2;', 'd2 = 1;|d2 = 2;', 'd3 = 1;|d3 = 2;']);
});

test('gegenueberstellen: 2.500 gelöschte gegen 2.500 hinzugefügte ergeben 2.500 Tabellenzeilen (AK 8)', () => {
  const zeilen = [kopf()];
  for (let i = 0; i < 2500; i++) zeilen.push(minus(`a${i}`));
  for (let i = 0; i < 2500; i++) zeilen.push(plus(`b${i}`));
  assert.strictEqual(u.gegenueberstellen(zeilen).filter(x => x.art === 'zeile').length, 2500);
  assert.strictEqual(d.patchZeilen('@@ -1 +1 @@\n-a\n+b\n').length, 3, 'das Budget zählt weiter die Zeilen der Liste');
});

/* ── B1307 Zustand des Schalters (FA 6, ADR-0042 N6.6): dieselbe Funktion für beide Schalter ── */

/** Ein Speicher mit der Schnittstelle von `localStorage`; `wirft` nennt die Aufrufe, die scheitern. */
function speicher(werte = {}, wirft = []) {
  return {
    werte,
    getItem(k) { if (wirft.includes('get')) throw new Error('gesperrt'); return k in werte ? werte[k] : null; },
    setItem(k, v) { if (wirft.includes('set')) throw new Error('voll'); werte[k] = String(v); },
  };
}

test('schalterLesen: unter kanbanD.nebeneinander ist nur „1“ an; fehlend, „0“, Unsinn aus; getrennt von kanbanD.umbrechen (m6)', () => {
  assert.strictEqual(u.NEBENEINANDER_SCHLUESSEL, 'kanbanD.nebeneinander');
  assert.strictEqual(u.schalterLesen(speicher({ 'kanbanD.nebeneinander': '1' }), u.NEBENEINANDER_SCHLUESSEL), true);
  for (const wert of ['0', 'ja', 'true', '', ' 1']) assert.strictEqual(u.schalterLesen(speicher({ 'kanbanD.nebeneinander': wert }), u.NEBENEINANDER_SCHLUESSEL), false, JSON.stringify(wert));
  assert.strictEqual(u.schalterLesen(speicher({}), u.NEBENEINANDER_SCHLUESSEL), false, 'fehlend: Voreinstellung aus');
  assert.strictEqual(u.schalterLesen(speicher({ 'kanbanD.umbrechen': '1' }), u.NEBENEINANDER_SCHLUESSEL), false, 'Umbrechen schaltet Nebeneinander nicht');
  assert.strictEqual(u.umbrechenLesen(speicher({ 'kanbanD.nebeneinander': '1' })), false, 'und umgekehrt');
});

test('schalterSchreiben: „1“/„0“ unter dem Schlüssel, danach liest schalterLesen dasselbe (m6)', () => {
  const s = speicher();
  assert.deepStrictEqual(u.schalterSchreiben(s, u.NEBENEINANDER_SCHLUESSEL, true), { fehler: false });
  assert.deepStrictEqual(s.werte, { 'kanbanD.nebeneinander': '1' });
  assert.strictEqual(u.schalterLesen(s, u.NEBENEINANDER_SCHLUESSEL), true);
  u.schalterSchreiben(s, u.NEBENEINANDER_SCHLUESSEL, false);
  assert.deepStrictEqual(s.werte, { 'kanbanD.nebeneinander': '0' });
});

test('schalterLesen/-Schreiben: ein werfender oder fehlender Speicher wirft nie nach außen (m7)', () => {
  assert.strictEqual(u.schalterLesen(speicher({ 'kanbanD.nebeneinander': '1' }, ['get']), u.NEBENEINANDER_SCHLUESSEL), false);
  assert.strictEqual(u.schalterLesen(null, u.NEBENEINANDER_SCHLUESSEL), false);
  assert.deepStrictEqual(u.schalterSchreiben(speicher({}, ['set']), u.NEBENEINANDER_SCHLUESSEL, true), { fehler: true });
  assert.deepStrictEqual(u.schalterSchreiben(undefined, u.NEBENEINANDER_SCHLUESSEL, true), { fehler: true });
});

test('nebeneinanderSchalterHtml: label.ru-sch mit input[checkbox][role=switch], „Nebeneinander“, eigene Kennung; checked nur bei an (FA 1, m9)', () => {
  const aus = u.nebeneinanderSchalterHtml(false), an = u.nebeneinanderSchalterHtml(true);
  assert.match(aus, /^<label class="ru-sch"><input type="checkbox" role="switch" id="rv-nb" data-nebeneinander>Nebeneinander<\/label>$/);
  assert.ok(/ checked>/.test(an) && !/checked/.test(aus));
  assert.ok(!u.umbrechenSchalterHtml(false).includes('rv-nb'));
});

/* ── B1308 Zeichnen der Tabelle (FA 2–4, 9): vier Spalten, leere Zellen, Lesetexte, Sprung, Marke ── */

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Die Tabellenzeilen `<tr …>…</tr>` des gezeichneten Bereichs (ohne Kopf `thead`). */
const zeilenVon = html => (html.split('</thead>').slice(1).join('').match(/<tr[^>]*>.*?<\/tr>/g) || []);
/** Die Zellen einer Tabellenzeile als `{klasse, attribute, inhalt}`. */
const zellenVon = tr => Array.from(tr.matchAll(/<td([^>]*)>(.*?)<\/td>/g), m => ({ attribute: m[1], klasse: (m[1].match(/class="([^"]*)"/) || [])[1] || '', inhalt: m[2] }));
const text = html => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const K_LAUF_A = '@@ -1,3 +1,3 @@\n vor\n-let a = 1;\n+let a = 2;\n nach\n';
const SPRUNG = 'vscode://file/w/src/n.rs';

test('codeHtml nebeneinander: jede Tabellenzeile hat vier Zellen — Nummer alt, Code alt, Nummer neu, Code neu; ohne Spalte „+/−“ (AK 2, FA 3)', () => {
  const html = d.codeHtml(K_LAUF_A, 'src/n.rs', esc, null, true);
  const zeilen = zeilenVon(html).filter(tr => !tr.startsWith('<tr class="hk"'));
  assert.strictEqual(zeilen.length, 3);
  for (const tr of zeilen) assert.deepStrictEqual(zellenVon(tr).map(z => z.klasse.split(' ')[0]), ['n', 'c', 'n', 'c'], tr);
  assert.ok(!/class="m"/.test(html) && !/>[+−]</.test(html), 'Zeichen + und − entfallen');
  const paar = zellenVon(zeilen[1]);
  assert.strictEqual(text(paar[0].inhalt), '2');
  assert.strictEqual(text(paar[1].inhalt), 'entfernt: let a = 1;');
  assert.strictEqual(text(paar[2].inhalt), '2');
  assert.strictEqual(text(paar[3].inhalt), 'hinzugefügt: let a = 2;');
  assert.match(paar[1].klasse, /\bdel\b/);
  assert.match(paar[3].klasse, /\badd\b/);
});

test('codeHtml nebeneinander: die Kontextzeile steht links und rechts mit beiden Nummern und demselben data-z; die rechte Code-Zelle ist aria-hidden (FA 3, m2, m16)', () => {
  const [kontext] = zeilenVon(d.codeHtml(K_LAUF_A, 'src/n.rs', esc, null, true)).filter(tr => !tr.startsWith('<tr class="hk"'));
  const z = zellenVon(kontext);
  assert.deepStrictEqual(z.map(x => text(x.inhalt)), ['1', 'vor', '1', 'vor']);
  assert.match(z[1].attribute, /data-z="1"/);
  assert.match(z[3].attribute, /data-z="1"/);
  assert.ok(!/aria-hidden/.test(z[1].attribute), 'links lesbar');
  assert.match(z[3].attribute, /aria-hidden="true"/);
});

test('codeHtml nebeneinander: die leere Seite hat Nummer- und Code-Zelle ohne Text, ohne Nummer, ohne data-z, aria-hidden, Klasse lz (AK 2 c, d, m3)', () => {
  const patch = '@@ -1,2 +1,2 @@\n k\n+z = 0;\n-y = 0;\n';
  const zeilen = zeilenVon(d.codeHtml(patch, 'src/n.rs', esc, null, true)).filter(tr => !tr.startsWith('<tr class="hk"'));
  const nurNeu = zellenVon(zeilen[1]), nurAlt = zellenVon(zeilen[2]);
  for (const leer of [nurNeu[0], nurNeu[1], nurAlt[2], nurAlt[3]]) {
    assert.strictEqual(leer.inhalt, '');
    assert.match(leer.klasse, /\blz\b/);
    assert.match(leer.attribute, /aria-hidden="true"/);
    assert.ok(!/data-z/.test(leer.attribute));
  }
  assert.strictEqual(text(nurNeu[3].inhalt), 'hinzugefügt: z = 0;');
  assert.strictEqual(text(nurAlt[1].inhalt), 'entfernt: y = 0;');
});

test('codeHtml nebeneinander: der Hunk-Kopf steht über allen vier Spalten mit data-z; der Kopf thead nennt „alte Fassung“ und „neue Fassung“ (FA 2)', () => {
  const html = d.codeHtml(K_LAUF_A, 'src/n.rs', esc, null, true);
  assert.match(html, /<tr class="hk"><td colspan="4" data-z="0">@@ -1,3 \+1,3 @@<\/td><\/tr>/);
  assert.match(html, /<thead><tr><th scope="col" colspan="2">alte Fassung<\/th><th scope="col" colspan="2">neue Fassung<\/th><\/tr><\/thead>/);
  assert.match(html, /<table class="dz ru-nb"/);
});

test('codeHtml nebeneinander: nur die Nummer der neuen Seite springt (ru-nk, Tooltip), die alte nie (FA 9, m12)', () => {
  const [kontext, paar] = zeilenVon(d.codeHtml(K_LAUF_A, 'src/n.rs', esc, SPRUNG, true)).filter(tr => !tr.startsWith('<tr class="hk"'));
  for (const tr of [kontext, paar]) {
    const z = zellenVon(tr);
    assert.ok(!/ru-nk|title=/.test(z[0].attribute), `alt springt nicht: ${z[0].attribute}`);
    assert.match(z[2].klasse, /\bru-nk\b/);
    assert.match(z[2].attribute, /title="In VS Code an Zeile \d+ öffnen"/);
  }
  assert.match(d.codeHtml(K_LAUF_A, 'src/n.rs', esc, SPRUNG, true), /data-vsc="vscode:\/\/file\/w\/src\/n\.rs"/);
  assert.ok(!/ru-nk/.test(d.codeHtml(K_LAUF_A, 'src/n.rs', esc, null, true)), 'ohne Sprung springt nichts');
});

test('codeHtml nebeneinander: die Wortmarke steht links „1“ und rechts „2“, gleich wie bei „aus“ (FA 4, AK 3, m4)', () => {
  const marken = html => Array.from(html.matchAll(/<mark class="wm">(.*?)<\/mark>/g), m => m[1]);
  assert.deepStrictEqual(marken(d.codeHtml(K_LAUF_A, 'src/n.rs', esc, null, true)), ['1', '2']);
  assert.deepStrictEqual(marken(d.codeHtml(K_LAUF_A, 'src/n.rs', esc, null, false)), ['1', '2']);
  const ungleich = '@@ -1,2 +1,3 @@\n-p = 10;\n-q = 20;\n+p = 11;\n+q = 21;\n+r = 31;\n';
  assert.deepStrictEqual(marken(d.codeHtml(ungleich, 'src/n.rs', esc, null, true)), [], 'ungleich lange Läufe ohne Marke');
});

test('codeHtml nebeneinander: Hinweis bei „-x \\ +x \\“ ist eine Hinweiszeile tr.nn mit „beide Fassungen: “ links, rechts aria-hidden (AK 2 ende.rs, m15)', () => {
  const patch = '@@ -1 +1 @@\n-x\n\\ No newline at end of file\n+y\n\\ No newline at end of file\n';
  const zeilen = zeilenVon(d.codeHtml(patch, 'src/ende.rs', esc, null, true)).filter(tr => !tr.startsWith('<tr class="hk"'));
  assert.strictEqual(zeilen.length, 2, 'eine Tabellenzeile und eine Hinweiszeile, nicht drei');
  assert.ok(zeilen[1].startsWith('<tr class="nn">'));
  const z = zellenVon(zeilen[1]);
  assert.match(z[0].attribute, /aria-hidden="true"/);
  assert.match(z[2].attribute, /aria-hidden="true"/);
  assert.strictEqual(text(z[1].inhalt), 'beide Fassungen: \\ No newline at end of file');
  assert.match(z[1].attribute, /data-z="2"/);
  assert.strictEqual(text(z[3].inhalt), '\\ No newline at end of file');
  assert.match(z[3].attribute, /aria-hidden="true"/);
  assert.match(z[3].attribute, /data-z="4"/);
});

test('codeHtml nebeneinander: Hinweis bei „-x \\ +x“ steht nur links mit „alte Fassung: “, rechts leer; bei „-x +x \\“ nur rechts mit „neue Fassung: “ (AK 2 enden.rs)', () => {
  const links = zeilenVon(d.codeHtml('@@ -1 +1 @@\n-x\n\\ No newline at end of file\n+x\n', 'src/enden.rs', esc, null, true)).filter(tr => tr.startsWith('<tr class="nn">'));
  assert.strictEqual(links.length, 1);
  const l = zellenVon(links[0]);
  assert.strictEqual(text(l[1].inhalt), 'alte Fassung: \\ No newline at end of file');
  assert.ok(l[3].inhalt === '' && /\blz\b/.test(l[3].klasse));
  const rechts = zellenVon(zeilenVon(d.codeHtml('@@ -1 +1 @@\n-x\n+x\n\\ No newline at end of file\n', 'src/enden.rs', esc, null, true)).find(tr => tr.startsWith('<tr class="nn">')));
  assert.ok(rechts[1].inhalt === '' && /\blz\b/.test(rechts[1].klasse));
  assert.strictEqual(text(rechts[3].inhalt), 'neue Fassung: \\ No newline at end of file');
  assert.ok(!/aria-hidden/.test(rechts[3].attribute));
});

test('codeHtml nebeneinander: fremder Text bleibt Text (FA Sicherheit) — Tags in einer Zeile werden maskiert', () => {
  const html = d.codeHtml('@@ -1 +1 @@\n-<img src=x onerror=alert(1)>\n+<b>neu</b>\n', 'a.txt', esc, null, true);
  assert.ok(!/<img|<b>/.test(html));
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

/* ── B1309 Einbau: data-z in beiden Darstellungen, Blöcke zu 500 Tabellenzeilen, --bb, der Schalter erreicht beide Ansichten ── */

test('codeHtml aus: jede Code-Zelle und der Hunk-Kopf tragen den Index der Zeile der Liste als data-z (FA 2, ADR-0042 N6.1)', () => {
  const html = d.codeHtml('@@ -1,2 +1,2 @@\n k\n-x\n\\ No newline at end of file\n+y\n', 'src/n.rs', esc);
  assert.match(html, /<tr class="hk"><td colspan="4" data-z="0">/);
  const z = Array.from(html.matchAll(/<td class="c" data-z="(\d+)">/g), m => Number(m[1]));
  assert.deepStrictEqual(z, [1, 2, 3, 4]);
  assert.ok(!/ru-nb/.test(html), 'aus: der heutige Zeichenweg');
});

test('codeHtml nebeneinander: Blöcke zu 500 Tabellenzeilen, Schätzung n × 18 je Block; 2.500 gegen 2.500 sind 2.501 Tabellenzeilen mit Kopf (FA 8, AK 8)', () => {
  const patch = '@@ -1,2500 +1,2500 @@\n' + Array.from({ length: 2500 }, (_, i) => `-a${i}\n`).join('') + Array.from({ length: 2500 }, (_, i) => `+b${i}\n`).join('');
  const html = d.codeHtml(patch, 'src/g.rs', esc, null, true);
  const bloecke = Array.from(html.matchAll(/<div class="dz-b" style="--bb:\d+px;contain-intrinsic-block-size:auto (\d+)px">(.*?)<\/table><\/div>/g), m => [Number(m[1]), (m[2].split('</thead>')[1].match(/<tr/g) || []).length]);
  assert.deepStrictEqual(bloecke.map(b => b[1]), [500, 500, 500, 500, 500, 1]);
  assert.ok(bloecke.every(([hoehe, n]) => hoehe === n * 18), JSON.stringify(bloecke));
});

test('codeHtml nebeneinander: --bb ist 2 × die längste Zeile beider Seiten × 8 + 140; ein längerer Hunk-Kopf gilt mit seiner Länge (FA 8)', () => {
  const bb = html => Number(html.match(/--bb:(\d+)px/)[1]);
  const patch = `@@ -1 +1 @@\n-${'a'.repeat(10)}\n+${'b'.repeat(40)}\n`;
  assert.strictEqual(bb(d.codeHtml(patch, 'x.txt', esc, null, true)), 2 * 40 * 8 + 140);
  assert.strictEqual(bb(d.codeHtml(`@@ -1 +1 @@\n-${'a'.repeat(40)}\n+b\n`, 'x.txt', esc, null, true)), 2 * 40 * 8 + 140, 'links die längste');
  const kopf = `@@ -1 +1 @@ ${'f'.repeat(200)}`;
  assert.strictEqual(bb(d.codeHtml(`${kopf}\n-a\n+b\n`, 'x.txt', esc, null, true)), kopf.length * 8 + 140);
  assert.strictEqual(bb(d.codeHtml(patch, 'x.txt', esc)), 40 * 8 + 140, 'aus unverändert');
});

test('dateiHtml: „nebeneinander“ aus der Quelle zeichnet die Datei nebeneinander; ohne bleibt sie untereinander (FA 5, Ein Commit)', () => {
  const datei = { neu: 'src/n.rs', alt: 'src/n.rs', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: K_LAUF_A };
  const stand = { offen: true, laden: null, fehler: null };
  const quelle = { nr: 9, commit: 'kd:abc', wurzel: '/w' };
  assert.match(d.dateiHtml(datei, 0, stand, [], esc, { id: 0, arg: 0, quelle: { ...quelle, nebeneinander: true } }), /class="dz ru-nb"/);
  assert.ok(!/ru-nb/.test(d.dateiHtml(datei, 0, stand, [], esc, { id: 0, arg: 0, quelle })));
});

test('Alle Änderungen: ctx.nebeneinander zeichnet Netto-Dateien und Schritte einer Folge nebeneinander (FA 5, AK 8, m8)', () => {
  const g = require('../../web/gesamt.js');
  const schritt = c => ({ commit: `kd:${c.repeat(40)}`, alt: 'a.rs', neu: 'a.rs', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-x\n+y\n' });
  const netto = { neu: 'k.rs', alt: 'k.rs', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: K_LAUF_A };
  const folge = { pfad: 'a.rs', plus: 2, minus: 2, binaer: false, schritte: [schritt('a'), schritt('b')] };
  const antwort = { anwendung: 'kd', wurzel: '/w', commits: [], dateien: [netto, folge], hinweise: [] };
  const ab = { status: 'da', kuerzel: 'kd', antwort, staende: [{ offen: true, laden: null, fehler: null }, { offen: true, laden: null, fehler: null }], gruppen: { code: true, test: true, doku: true } };
  const ctx = { esc, nr: 9, adresse: v => `#${v}`, titelVon: () => null };
  const tabellen = html => (html.match(/<table class="dz[^"]*"/g) || []);
  const an = g.abschnittHtml(ab, 0, { ...ctx, nebeneinander: true });
  assert.deepStrictEqual(tabellen(an), ['<table class="dz ru-nb"', '<table class="dz ru-nb"', '<table class="dz ru-nb"']);
  assert.deepStrictEqual(tabellen(g.abschnittHtml(ab, 0, ctx)), ['<table class="dz"', '<table class="dz"', '<table class="dz"']);
  assert.match(g.abschnittDateiHtml(ab, 0, 0, { ...ctx, nebeneinander: true }), /class="dz ru-nb"/);
});

/* ── B1312 Tempo: das Umschalten setzt die Blöcke in mehreren Aufgaben zusammen (AK 9, ADR-0042 N6.5) ── */

test('codeBereicheTeilen: je Code-Bereich der Anfangstag und die Blöcke einzeln; zusammengesetzt wieder genau der Bereich (auch mit fremdem Text)', () => {
  const patch = '@@ -1,600 +1,600 @@\n' + Array.from({ length: 600 }, (_, i) => `-</table></div><div class="dz-b" ${i}\n`).join('') + Array.from({ length: 600 }, (_, i) => `+b${i}\n`).join('');
  for (const nebeneinander of [false, true]) {
    const html = d.codeHtml(patch, 'src/<b>.rs', esc, SPRUNG, nebeneinander);
    const teile = d.codeBereicheTeilen(`<section>${html}<p>x</p>${html}</section>`);
    assert.strictEqual(teile.length, 2);
    assert.match(teile[0].kopf, /^<div class="df-sc" [^]*>$/);
    assert.strictEqual(teile[0].bloecke.length, nebeneinander ? 2 : 3);
    assert.ok(teile[0].bloecke.every(b => b.startsWith('<div class="dz-b"') && b.endsWith('</table></div>')));
    assert.strictEqual(teile[0].kopf + teile[0].bloecke.join('') + '</div>', html);
  }
  assert.deepStrictEqual(d.codeBereicheTeilen('<section><p>ohne Code</p></section>'), []);
});
