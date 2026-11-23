// R00239 B1247, B1248: Filter „Zeigen“ — Art je Zeile, Zahlen aus der Auswertung, Ansage, Kästchen, Sprung in eine verborgene Zeile,
// Lage unter beiden Listen (FA 5–9; AK 4–6 Node). Reine Funktionen aus web/lauf.js.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const lauf = require('../../web/lauf.js');
const { T1_ZEILEN } = require('../tests/laufansicht-t1.js');

const { laufAuswerten, laufHtml, laufTopHtml, laufFilterHtml, laufFilterAnsage, laufSprungFilter, FILTER_VORGABE } = lauf;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const e = (nr, art, wer, text = 'x', zusatz = {}) => ({ nr, eintrag: { art, wer, text, zeit: null, name: null, ...zusatz } });
const zeilenVon = html => html.split(/(?=<li\b)/).slice(1).map(li => li.replace(/<\/ol>$/, ''));
const id = li => /^<li id="([^"]+)"/.exec(li)[1];
const artVon = li => (/^<li [^>]*data-art="(\w)"/.exec(li) || [null, 'n'])[1];

test('FA 5: T1 — 4 Nachrichten, 9 Werkzeuge, 1 Systemhinweis, 2 Fehler aus der Auswertung', () => {
  assert.deepStrictEqual(laufAuswerten(T1_ZEILEN, false).zeilenArten, { n: 4, w: 9, h: 1, fehler: 2 });
});

test('FA 5: T1 — jede Zeile trägt ihre Art; Denk- und Wartezeilen die des Eintrags dahinter; Fehlerzeilen ihre Marke', () => {
  const a = laufAuswerten(T1_ZEILEN, false);
  const zeilen = zeilenVon(laufHtml(T1_ZEILEN, false, esc, a)).filter(li => !li.startsWith('<li class="lv-ende"'));
  assert.strictEqual(zeilen.length, 14);
  const nachArt = art => zeilen.filter(li => artVon(li) === art).map(id);
  assert.deepStrictEqual(nachArt('n'), ['lv-s1', 'lv-s13-vor', 'lv-s13', 'lv-s14']);
  assert.deepStrictEqual(nachArt('h'), ['lv-s2']);
  assert.deepStrictEqual(nachArt('w'), ['lv-s3-vor', 'lv-s3', 'lv-s5', 'lv-s7-vor', 'lv-s7', 'lv-s8', 'lv-s11', 'lv-s15-vor', 'lv-s15']);
  assert.deepStrictEqual(zeilen.filter(li => /^<li [^>]*data-fehler/.test(li)).map(id), ['lv-s5', 'lv-s8']);
  const arten = { n: nachArt('n').length, w: nachArt('w').length, h: nachArt('h').length, fehler: 2 };
  assert.deepStrictEqual(arten, a.zeilenArten, 'die Zahlen der Auswertung zählen dieselben Zeilen wie die Zeichnung');
});

test('FA 5: eine unlesbare Zeile und eine Nachricht von mensch sind Nachrichten; ein Ergebnis ohne Aufruf ein Werkzeug; der Schluss hat keine Art', () => {
  const zeilen = [e(1, 'nachricht', 'mensch', 'Auftrag'), { nr: 2, eintrag: null }, e(3, 'werkzeugergebnis', 'werkzeug', 'Exit code 2'), e(4, 'nachricht', 'mensch', ' <system-reminder>x')];
  const a = laufAuswerten(zeilen, true);
  assert.deepStrictEqual(a.zeilenArten, { n: 2, w: 1, h: 1, fehler: 1 });
  const li = zeilenVon(laufHtml(zeilen, true, esc, a));
  assert.deepStrictEqual(li.map(artVon), ['n', 'n', 'w', 'h', 'n']);
  assert.match(li[4], /^<li class="lv-g meld warn" role="note">/, 'der Satz zur Grenze trägt keine Art');
});

test('FA 6: Ansage „<s> von <g> Einträgen sichtbar.“ aus den Zahlen der Auswertung; Einzahl, nur Fehler ohne Treffer, keine sichtbar', () => {
  const t1 = { n: 4, w: 9, h: 1, fehler: 2 };
  const f = (n, w, h, nurFehler) => ({ n, w, h, f: nurFehler });
  assert.strictEqual(laufFilterAnsage(t1, FILTER_VORGABE), '13 von 14 Einträgen sichtbar.');
  assert.strictEqual(laufFilterAnsage(t1, f(true, true, true, false)), '14 von 14 Einträgen sichtbar.');
  assert.strictEqual(laufFilterAnsage(t1, f(true, false, true, false)), '5 von 14 Einträgen sichtbar.');
  assert.strictEqual(laufFilterAnsage(t1, f(false, false, true, false)), '1 von 14 Einträgen sichtbar.');
  assert.strictEqual(laufFilterAnsage(t1, f(false, false, false, false)), 'Keine Einträge sichtbar.');
  assert.strictEqual(laufFilterAnsage(t1, f(false, false, false, true)), '2 von 14 Einträgen sichtbar.', 'nur Fehler wirkt allein');
  assert.strictEqual(laufFilterAnsage({ n: 0, w: 1, h: 0, fehler: 0 }, f(true, true, false, false)), '1 von 1 Eintrag sichtbar.');
  assert.strictEqual(laufFilterAnsage({ n: 1, w: 1, h: 0, fehler: 0 }, f(true, true, false, true)), 'Keine Fehler erkannt.');
});

test('FA 5: „Zeigen“ mit vier Kästchen, Vorgabe an/an/aus/aus; unter „nur Fehler“ die drei Arten gesperrt mit ihrem Stand, ohne data-act', () => {
  const vorgabe = laufFilterHtml(FILTER_VORGABE);
  assert.match(vorgabe, /^<fieldset class="lv-filt"><legend>Zeigen<\/legend>/);
  const kaestchen = html => [...html.matchAll(/<label>(<input [^>]*>)([^<]+)<\/label>/g)].map(([, input, name]) => ({ name, an: / checked/.test(input), gesperrt: /aria-disabled="true"/.test(input), act: /data-act="lauf-filter"/.test(input) }));
  assert.deepStrictEqual(kaestchen(vorgabe), [
    { name: 'Nachrichten', an: true, gesperrt: false, act: true }, { name: 'Werkzeuge', an: true, gesperrt: false, act: true },
    { name: 'Systemhinweise', an: false, gesperrt: false, act: true }, { name: 'nur Fehler', an: false, gesperrt: false, act: true }]);
  assert.deepStrictEqual(kaestchen(laufFilterHtml({ n: true, w: false, h: true, f: true })), [
    { name: 'Nachrichten', an: true, gesperrt: true, act: false }, { name: 'Werkzeuge', an: false, gesperrt: true, act: false },
    { name: 'Systemhinweise', an: true, gesperrt: true, act: false }, { name: 'nur Fehler', an: true, gesperrt: false, act: true }]);
  assert.doesNotMatch(vorgabe, / disabled/);
});

test('FA 9: Sprung in eine verborgene Zeile schaltet zuerst „nur Fehler“ aus, dann die Art an; eine sichtbare Zeile ändert nichts', () => {
  assert.deepStrictEqual(laufSprungFilter({ n: true, w: false, h: false, f: true }, 'w', false), { n: true, w: true, h: false, f: false });
  assert.deepStrictEqual(laufSprungFilter({ n: true, w: true, h: false, f: true }, 'w', false), { n: true, w: true, h: false, f: false });
  assert.deepStrictEqual(laufSprungFilter({ n: false, w: true, h: false, f: false }, 'n', false), { n: true, w: true, h: false, f: false });
  const fehlerZeileSichtbar = { n: true, w: false, h: false, f: true };
  assert.strictEqual(laufSprungFilter(fehlerZeileSichtbar, 'w', true), fehlerZeileSichtbar, 'Fehlerzeile unter „nur Fehler“ mit „Werkzeuge“ aus');
  assert.strictEqual(laufSprungFilter(FILTER_VORGABE, 'n', false), FILTER_VORGABE);
});

test('FA 8, AK 6 (abgelöst durch R00243 AK 4): ab 641 px steht „Zeigen“ vor „Längste Schritte“ und „Teuerste Schritte“, bis 640 px dahinter; ohne Listen allein', () => {
  const { T8 } = require('../tests/laufansicht-t8.js');
  const zeilen = T8.map((o, i) => ({ nr: i + 1, eintrag: lauf.eintragPruefen(JSON.parse(JSON.stringify(o))) }));
  const a = laufAuswerten(zeilen, false);
  assert.ok(a.top3.length && a.teuer3.length, 'beide Listen');
  const zeigen = laufFilterHtml(FILTER_VORGABE);
  const stelle = (html, s) => html.indexOf(s);
  const breit = laufTopHtml(a, esc, zeigen), ausdruecklichBreit = laufTopHtml(a, esc, zeigen, true);
  assert.strictEqual(breit, ausdruecklichBreit, 'ohne Angabe gilt die Reihenfolge ab 641 px');
  assert.ok(stelle(breit, '<fieldset class="lv-filt">') < stelle(breit, 'Längste Schritte') && stelle(breit, 'Längste Schritte') < stelle(breit, 'Teuerste Schritte'));
  assert.ok(breit.startsWith(`<section class="lv-gl" aria-labelledby="lv-top-t lv-teu-t">${zeigen}`), '„Zeigen“ als erstes Kind des Seitenfelds');
  const schmal = laufTopHtml(a, esc, zeigen, false);
  assert.ok(stelle(schmal, 'Längste Schritte') < stelle(schmal, 'Teuerste Schritte') && stelle(schmal, 'Teuerste Schritte') < stelle(schmal, '<fieldset class="lv-filt">'));
  assert.strictEqual(schmal, laufTopHtml(a, esc).replace(zeigen, '').replace(/<\/section>$/, `${zeigen}</section>`), 'die Listen unverändert, „Zeigen“ dahinter');
  for (const zuerst of [true, false]) assert.strictEqual(laufTopHtml({ ...a, top3: [], teuer3: [] }, esc, zeigen, zuerst), `<section class="lv-gl">${zeigen}</section>`);
});
