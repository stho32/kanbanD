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
