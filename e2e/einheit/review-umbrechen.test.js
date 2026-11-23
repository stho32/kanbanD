// R00248 B1301 und B1303: der gemerkte Zustand des Schalters „Umbrechen“ (web/review-uebersicht.js) und die Breite der Blöcke als
// Eigenschaft `--bb` (web/diff.js, ADR-0042 N5.1, N5.2) — rein, ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const u = require('../../web/review-uebersicht.js');
const d = require('../../web/diff.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Ein Speicher mit der Schnittstelle von `localStorage`; `wirft` nennt die Aufrufe, die scheitern. */
function speicher(werte = {}, wirft = []) {
  const aufrufe = [];
  return {
    aufrufe, werte,
    getItem(k) { aufrufe.push(['get', k]); if (wirft.includes('get')) throw new Error('gesperrt'); return k in werte ? werte[k] : null; },
    setItem(k, v) { aufrufe.push(['set', k, v]); if (wirft.includes('set')) throw new Error('voll'); werte[k] = String(v); },
  };
}

test('umbrechenLesen: nur „1“ ist an; fehlend, „0“, Unsinn und leer sind aus (FA 4, Voreinstellung aus)', () => {
  assert.strictEqual(u.UMBRECHEN_SCHLUESSEL, 'kanbanD.umbrechen');
  assert.strictEqual(u.umbrechenLesen(speicher({ 'kanbanD.umbrechen': '1' })), true);
  for (const wert of ['0', 'ja', 'true', '', '11', ' 1', '1\n']) assert.strictEqual(u.umbrechenLesen(speicher({ 'kanbanD.umbrechen': wert })), false, JSON.stringify(wert));
  assert.strictEqual(u.umbrechenLesen(speicher({})), false, 'fehlend');
});

test('umbrechenLesen: wirft der Speicher oder fehlt er, ist es aus — ohne Fehler nach außen (m10)', () => {
  assert.strictEqual(u.umbrechenLesen(speicher({ 'kanbanD.umbrechen': '1' }, ['get'])), false);
  assert.strictEqual(u.umbrechenLesen(null), false);
  assert.strictEqual(u.umbrechenLesen(undefined), false);
});

test('umbrechenSchreiben: „1“ für an, „0“ für aus unter kanbanD.umbrechen; danach liest umbrechenLesen dasselbe (m3)', () => {
  const s = speicher();
  assert.deepStrictEqual(u.umbrechenSchreiben(s, true), { fehler: false });
  assert.deepStrictEqual(s.werte, { 'kanbanD.umbrechen': '1' });
  assert.strictEqual(u.umbrechenLesen(s), true);
  assert.deepStrictEqual(u.umbrechenSchreiben(s, false), { fehler: false });
  assert.deepStrictEqual(s.werte, { 'kanbanD.umbrechen': '0' });
  assert.strictEqual(u.umbrechenLesen(s), false);
});

test('umbrechenSchreiben: ein werfender oder fehlender Speicher wirft nie nach außen, das Ergebnis nennt den Fehler (m10)', () => {
  assert.deepStrictEqual(u.umbrechenSchreiben(speicher({}, ['set']), true), { fehler: true });
  assert.deepStrictEqual(u.umbrechenSchreiben(null, true), { fehler: true });
  assert.deepStrictEqual(u.umbrechenSchreiben(undefined, false), { fehler: true });
});

test('codeHtml: die Breite eines Blocks steht als Eigenschaft --bb im style, ohne contain-intrinsic-inline-size und ohne inline-size (ADR-0042 N5.2)', () => {
  const patch = `@@ -1 +1 @@\n-a\n+${'x'.repeat(400)}\n`;
  const html = d.codeHtml(patch, 'src/a.rs', esc);
  const stil = html.match(/<div class="dz-b" style="([^"]*)"/)[1];
  assert.match(stil, /^--bb:\d+px;contain-intrinsic-block-size:auto 54px$/, stil);
  assert.ok(Number(stil.match(/--bb:(\d+)px/)[1]) >= 400 * 8, 'die Schätzung bleibt großzügig (8 px je Zeichen)');
  assert.ok(!html.includes('contain-intrinsic-inline-size') && !/style="[^"]*inline-size/.test(html), 'die Entscheidung steht in der Stilvorlage, nicht im style');
});

test('umbrechenSchalterHtml: label.ru-sch mit input[checkbox][role=switch], „Umbrechen“; checked nur bei an (FA 1, m9)', () => {
  const aus = u.umbrechenSchalterHtml(false), an = u.umbrechenSchalterHtml(true);
  assert.match(aus, /^<label class="ru-sch"><input type="checkbox" role="switch"[^>]*>Umbrechen<\/label>$/);
  assert.ok(!/checked/.test(aus));
  assert.ok(/ checked>/.test(an));
});
