// R00247 B1296: die Wortmarke in der Codezelle (`zelleHtml`) als HTML-Text, mit und ohne Farbstücke — ohne Browser. Die Marke `wm`
// der Zeile ist `[von, bis)` im Zeilentext; sie liegt außen um die Farbstücke, sichtbar gemachte Zeichen bleiben, fremder Text bleibt Text.
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const textVon = html => html.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const LESEN = '<span class="vh">entfernt: </span>';
const zeile = (text, wm = null) => ({ art: 'minus', alt: 1, neu: null, text, wm });
const KEYWORD = 0, STRING = 1, NUMBER = 3;

test('AK 1 (a): ohne Farbe — `let a = <mark class="wm">1</mark>;` hinter dem Lesetext', () => {
  assert.strictEqual(d.zelleHtml(zeile('let a = 1;', [8, 9]), esc), `${LESEN}let a = <mark class="wm">1</mark>;`);
});

test('AK 1 (c): eine Marke am Zeilenende schließt hinter dem letzten Zeichen', () => {
  assert.strictEqual(d.zelleHtml(zeile('a = 1', [4, 5]), esc), `${LESEN}a = <mark class="wm">1</mark>`);
});

test('ohne Marke (null oder kein Feld) bleibt die Zelle wie vor S5', () => {
  const ohne = d.zelleHtml({ art: 'minus', text: 'let a = 1;' }, esc);
  assert.strictEqual(ohne, `${LESEN}let a = 1;`);
  assert.strictEqual(d.zelleHtml(zeile('let a = 1;', null), esc), ohne);
  const stuecke = [[0, 3, KEYWORD], [8, 9, NUMBER]];
  assert.strictEqual(d.zelleHtml(zeile('let a = 1;', null), esc, stuecke), `${LESEN}<span class="tk-keyword">let</span> a = <span class="tk-number">1</span>;`);
});

test('AK 5 (f): mit Farbe — die Marke liegt außen, das Farbstück `tk-string` wird an von und bis geschnitten', () => {
  const html = d.zelleHtml(zeile('let s = "alt";', [9, 12]), esc, [[0, 3, KEYWORD], [8, 13, STRING]]);
  assert.strictEqual(html, `${LESEN}<span class="tk-keyword">let</span> s = <span class="tk-string">&quot;</span><mark class="wm"><span class="tk-string">alt</span></mark><span class="tk-string">&quot;</span>;`);
});

test('AK 5: Marke über mehrere Farbstücke und Text ohne Farbe — alle Stücke innen, keins überspannt eine Grenze', () => {
  const html = d.zelleHtml(zeile('let a = 1; b = 2;', [8, 16]), esc, [[0, 3, KEYWORD], [8, 9, NUMBER], [15, 16, NUMBER]]);
  assert.strictEqual(html, `${LESEN}<span class="tk-keyword">let</span> a = <mark class="wm"><span class="tk-number">1</span>; b = <span class="tk-number">2</span></mark>;`);
});

test('AK 5: ein Farbstück, das die Marke ganz umschließt, wird dreigeteilt', () => {
  const html = d.zelleHtml(zeile('// alt und mehr', [3, 6]), esc, [[0, 15, 2]]);
  assert.strictEqual(html, `${LESEN}<span class="tk-comment">// </span><mark class="wm"><span class="tk-comment">alt</span></mark><span class="tk-comment"> und mehr</span>`);
});

test('AK 4 (k): das sichtbar gemachte Bidi-Zeichen liegt in der Marke und bleibt als ⟨U+202E⟩ sichtbar', () => {
  const html = d.zelleHtml(zeile('v = "1‮2"', [5, 8]), esc);
  assert.match(html, /^<span class="vh">entfernt: <\/span>v = &quot;<mark class="wm">1<span class="mk-z mk-bidi" role="img" aria-label="sichtbar gemachtes Bidi-Steuerzeichen U\+202E"><svg[^>]*>.*?<\/svg>⟨U\+202E⟩<\/span>2<\/mark>&quot;$/);
  assert.ok(!html.includes('‮'));
});

test('AK 4 (l): das Bidi-Zeichen vor der Marke bleibt außen, die Marke trägt nur „b“ — mit und ohne Farbe', () => {
  for (const stuecke of [null, [[0, 3, KEYWORD], [8, 13, STRING]]]) {
    const html = d.zelleHtml(zeile('let t = "a‮b";', [11, 12]), esc, stuecke);
    const marke = html.match(/<mark class="wm">([\s\S]*?)<\/mark>/g);
    assert.strictEqual(marke.length, 1);
    assert.strictEqual(textVon(marke[0]), 'b');
    assert.ok(!marke[0].includes('mk-z'));
    assert.ok(html.includes('⟨U+202E⟩'));
  }
});

test('AK 4 (j): das Emoji steht ganz in der Marke — kein halbes Ersatzpaar', () => {
  const html = d.zelleHtml(zeile('let s = "😀";', [9, 11]), esc, [[8, 12, STRING]]);
  assert.ok(html.includes('<mark class="wm"><span class="tk-string">😀</span></mark>'), html);
});

test('AK 4 (m): fremdes HTML bleibt maskiert, die Marke trägt nur „x“ — kein Schnitt in einem Entity', () => {
  const text = 'let h = "<img src=x onerror=window.pwn=1>";';
  for (const stuecke of [null, [[8, 42, STRING]]]) {
    const html = d.zelleHtml(zeile(text, [18, 19]), esc, stuecke);
    assert.ok(!/<img/i.test(html));
    assert.ok(!/&(?!lt;|gt;|quot;|amp;|#39;)/.test(html), html);
    assert.strictEqual(textVon(html.match(/<mark class="wm">[\s\S]*?<\/mark>/)[0]), 'x');
    assert.strictEqual(textVon(html), 'entfernt: ' + text);
  }
});

test('AK 4: Text Zeichen für Zeichen gleich dem ohne Marke — viele Lagen der Marke, mit und ohne Farbe', () => {
  const text = 'let s = "a‮b😀<x>" + c;';
  const stuecke = [[0, 3, KEYWORD], [8, 18, STRING]];
  const ohne = [textVon(d.zelleHtml(zeile(text), esc)), textVon(d.zelleHtml(zeile(text), esc, stuecke))];
  for (let von = 0; von < text.length; von++) {
    for (let bis = von + 1; bis <= text.length; bis++) {
      if (/[\uDC00-\uDFFF]/.test(text[von]) || /[\uDC00-\uDFFF]/.test(text[bis] || '')) continue;
      assert.strictEqual(textVon(d.zelleHtml(zeile(text, [von, bis]), esc)), ohne[0], `[${von}, ${bis})`);
      assert.strictEqual(textVon(d.zelleHtml(zeile(text, [von, bis]), esc, stuecke)), ohne[1], `[${von}, ${bis}) farbig`);
      assert.strictEqual((d.zelleHtml(zeile(text, [von, bis]), esc, stuecke).match(/<mark /g) || []).length, 1);
    }
  }
});
