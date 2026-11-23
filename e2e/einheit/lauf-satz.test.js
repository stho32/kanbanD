// R00240 (Karte #261, C1 „Satz“): reine Bausteine aus web/lauf-satz.js — Shell-Block, Kürzung, Diff, Marke „gekürzt“,
// eingebettete Systemhinweise, Testzeile, Aufruf- und Ergebnis-Satz, Grenzen. Proben aus ADR-0041 N4 „Durchsetzung“ ohne Pfade,
// mit dem Nachtrag 261-architekt-2, dazu die Rechenbeispiele von T13.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const satz = require('../../web/lauf-satz.js');
const { shellUmbruch, kuerzungHtml, editDiff, gekuerztErkennen, groesseDeutsch, systemhinweiseTrennen, systemhinweiseZaehlen, testzeileFinden, aufrufSatz, ergebnisSatz, jsonZeilen, SATZ_GRENZEN } = satz;
const t13 = require('../tests/laufansicht-t13.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ohneTags = html => html.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const zeilen = (n, wort = 'z') => Array.from({ length: n }, (_, i) => `${wort}${i + 1}`);
const alsPre = teile => `<pre>${teile.join('\n')}</pre>`;
/** Inhalt der offenen und der eingeklappten Zeilen eines gekürzten Blocks. */
function teileVon(html) {
  const m = /^<pre>([\s\S]*?)<\/pre>(?:<details class="lv-mehr"><summary>([\s\S]*?)<\/summary><pre>([\s\S]*?)<\/pre><\/details>)?$/.exec(html);
  assert.ok(m, `Form eines gekürzten Blocks: ${html.slice(0, 200)}`);
  return { offen: m[1].split('\n'), knopf: m[2] === undefined ? null : ohneTags(m[2]), rest: m[3] === undefined ? [] : m[3].split('\n') };
}

/* ── shellUmbruch (FA 2, AK 1) ── */

test('shellUmbruch: Nr 2 ergibt die drei Zeilen des Rechenbeispiels, ohne die eingefügten \\n ist es wieder der Befehl', () => {
  const gesetzt = shellUmbruch(t13.BEFEHL_2);
  assert.deepStrictEqual(gesetzt.split('\n'), ['cd /w/demo &&', ' npm test;', ' echo "a && b" | grep \'x;y\' # Ende; z']);
  assert.strictEqual(gesetzt.replace(/\n/g, ''), t13.BEFEHL_2);
});

test('shellUmbruch: a && b; c ergibt drei Zeilen, a || b zwei', () => {
  assert.deepStrictEqual(shellUmbruch('a && b; c').split('\n'), ['a &&', ' b;', ' c']);
  assert.deepStrictEqual(shellUmbruch('a || b').split('\n'), ['a ||', ' b']);
});

test('shellUmbruch: Quoting, $(…), Backticks, \\, ;;, Kommentar und Heredoc bleiben unverändert', () => {
  for (const befehl of ['echo "a && b"', "echo 'x;y'", '$(a; b)', 'echo `a; b`', 'a \\&& b', 'case x in a) ;; esac', 'echo a # b; c', 'cat <<EOF\na; b\nEOF',
    'cat <<EOF\na && b\nEOF && c', 'echo "x \\" ; y"', 'echo $(a "b;c" && d)', 'a & b', 'a | b', 'x=1;']) {
    assert.strictEqual(shellUmbruch(befehl), befehl, befehl);
  }
});

test('shellUmbruch: # mitten im Wort ist kein Kommentar, ein Umbruch steht nie doppelt', () => {
  assert.deepStrictEqual(shellUmbruch('echo a#b; c').split('\n'), ['echo a#b;', ' c']);
  assert.strictEqual(shellUmbruch('a &&\nb'), 'a &&\nb', 'schon ein Umbruch dahinter');
  assert.strictEqual(shellUmbruch('a; # x; y\nb; c'), 'a;\n # x; y\nb;\n c', 'der Kommentar endet an der Zeile');
});

test('shellUmbruch: Nr 4 ergibt zwei Zeilen, Nr 15 bleibt unverändert', () => {
  assert.deepStrictEqual(shellUmbruch(t13.BEFEHL_4).split('\n'), [`echo ${'a'.repeat(250)} &&`, ' cat gross.log']);
  assert.strictEqual(shellUmbruch(t13.BEFEHL_15), t13.BEFEHL_15);
});

test('shellUmbruch: bis 16 KiB umbrochen, ein command mit 16 KiB + 1 Byte ohne eingefügten Umbruch (FA 13, AK 9)', () => {
  const genau = 'a; ' + 'b'.repeat(SATZ_GRENZEN.befehlBytes - 3);
  assert.strictEqual(shellUmbruch(genau).split('\n').length, 2);
  const darueber = genau + 'b';
  assert.strictEqual(shellUmbruch(darueber), darueber);
  const mitUmlaut = 'a; ' + 'ä'.repeat((SATZ_GRENZEN.befehlBytes - 2) / 2);
  assert.strictEqual(shellUmbruch(mitUmlaut), mitUmlaut, 'gezählt in Bytes, nicht in Zeichen');
});

/* ── Kürzung (FA 5, AK 2) ── */

test('Kürzung: 25 Zeilen ergeben 20 offen und „weitere 5 Zeilen“ mit Namen „… des Ergebnisses“, der Rest steht im DOM, nie „…“', () => {
  const html = kuerzungHtml(zeilen(25), 'ergebnis', alsPre);
  const t = teileVon(html);
  assert.deepStrictEqual(t.offen, zeilen(20));
  assert.deepStrictEqual(t.rest, zeilen(25).slice(20));
  assert.strictEqual(t.knopf, 'weitere 5 Zeilen des Ergebnisses');
  assert.match(html, /<summary><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>weitere 5 Zeilen<span class="vh"> des Ergebnisses<\/span><\/summary>/);
  assert.doesNotMatch(html, /aria-expanded/);
  assert.doesNotMatch(html, /…/);
});

test('Kürzung: 21 Zeilen ergeben „1 weitere Zeile“, 20 keinen Knopf, 1.358 „weitere 1.338 Zeilen“, ein Einzeiler mit 500 Zeichen keinen', () => {
  assert.strictEqual(teileVon(kuerzungHtml(zeilen(21), 'aufruf', alsPre)).knopf, '1 weitere Zeile des Aufrufs');
  assert.strictEqual(teileVon(kuerzungHtml(zeilen(21), 'aenderung', alsPre)).knopf, '1 weitere Zeile der Änderung');
  assert.strictEqual(teileVon(kuerzungHtml(zeilen(25), 'aenderung', alsPre)).knopf, 'weitere 5 Zeilen der Änderung');
  assert.strictEqual(kuerzungHtml(zeilen(20), 'ergebnis', alsPre), alsPre(zeilen(20)));
  assert.strictEqual(teileVon(kuerzungHtml(zeilen(1358), 'ergebnis', alsPre)).knopf, 'weitere 1.338 Zeilen des Ergebnisses');
  assert.strictEqual(kuerzungHtml(['x'.repeat(500)], 'ergebnis', alsPre), alsPre(['x'.repeat(500)]));
});

/* ── editDiff (FA 4, AK 4) ── */

test('editDiff: Präfix und Suffix als Kontext — Nr 6 ergibt x · − alt · + neu · y', () => {
  assert.deepStrictEqual(editDiff('x\nalt\ny', 'x\nneu\ny'), [{ art: 'kontext', zeile: 'x' }, { art: 'weg', zeile: 'alt' }, { art: 'neu', zeile: 'neu' }, { art: 'kontext', zeile: 'y' }]);
});

test('editDiff: leeres old_string nur hinzugefügt, gleiche Texte nur Kontext, Präfix und Suffix überlappen nie', () => {
  assert.deepStrictEqual(editDiff('', 'a\nb'), [{ art: 'neu', zeile: 'a' }, { art: 'neu', zeile: 'b' }]);
  assert.deepStrictEqual(editDiff('a\nb', 'a\nb'), [{ art: 'kontext', zeile: 'a' }, { art: 'kontext', zeile: 'b' }]);
  assert.deepStrictEqual(editDiff('a\na', 'a'), [{ art: 'kontext', zeile: 'a' }, { art: 'weg', zeile: 'a' }]);
  assert.deepStrictEqual(editDiff('a', ''), [{ art: 'weg', zeile: 'a' }]);
});

/* ── gekuerztErkennen (FA 8, AK 6) ── */

test('gekuerztErkennen: Nr 5 — Größe deutsch, Pfad, Vorschau', () => {
  assert.deepStrictEqual(gekuerztErkennen(t13.ERGEBNIS_5), { form: true, groesse: '69,9 KB', pfad: '/tmp/demo/tool-results/b1.txt', vorschau: 'Exit code 1\nfehlt: gross.log\n...' });
});

test('gekuerztErkennen: führender Leerraum, MB; fremde Form ohne Größe und Pfad; kein <persisted-output> am Anfang', () => {
  assert.strictEqual(gekuerztErkennen('\n  ' + t13.ERGEBNIS_5.replace('69.9KB', '1.2MB')).groesse, '1,2 MB');
  assert.deepStrictEqual(gekuerztErkennen('<persisted-output>\nirgendwas\n</persisted-output>'), { form: false });
  assert.strictEqual(gekuerztErkennen('x\n' + t13.ERGEBNIS_5), null);
  assert.strictEqual(gekuerztErkennen('Exit code 1'), null);
  assert.strictEqual(groesseDeutsch('1.2MB'), '1,2 MB');
  assert.strictEqual(groesseDeutsch('512B'), '512 B');
});

/* ── systemhinweiseTrennen (FA 10, AK 7; Nachtrag 261-architekt-2) ── */

test('systemhinweiseTrennen: zwei Blöcke am Zeilenanfang mitten im Text werden Hinweise an ihrer Stelle', () => {
  const teile = systemhinweiseTrennen('a\n<system-reminder>\nH1\n</system-reminder>\nb\n<system-reminder>H2</system-reminder>\nc');
  assert.deepStrictEqual(teile, [{ art: 'text', text: 'a' }, { art: 'hinweis', text: '<system-reminder>\nH1\n</system-reminder>' }, { art: 'text', text: 'b' },
    { art: 'hinweis', text: '<system-reminder>H2</system-reminder>' }, { art: 'text', text: 'c' }]);
});

test('systemhinweiseTrennen: Tag mitten in der Zeile und Block ohne Ende bleiben unverändert Text', () => {
  assert.deepStrictEqual(systemhinweiseTrennen('Text mit <system-reminder> mitten</system-reminder>'), [{ art: 'text', text: 'Text mit <system-reminder> mitten</system-reminder>' }]);
  assert.deepStrictEqual(systemhinweiseTrennen('a\n<system-reminder>\nohne Ende'), [{ art: 'text', text: 'a\n<system-reminder>\nohne Ende' }]);
  assert.deepStrictEqual(systemhinweiseTrennen('ohne'), [{ art: 'text', text: 'ohne' }]);
});

test('systemhinweiseTrennen: Nr 11 besteht nur aus einem Hinweis', () => {
  assert.deepStrictEqual(systemhinweiseTrennen('<system-reminder>\nNur Hinweis.\n</system-reminder>'), [{ art: 'hinweis', text: '<system-reminder>\nNur Hinweis.\n</system-reminder>' }]);
});

/* ── testzeileFinden (FA 7, AK 5) ── */

test('testzeileFinden: Formen und Ton', () => {
  assert.deepStrictEqual(testzeileFinden('2448 passed'), { zeile: '2448 passed', fehler: false });
  assert.deepStrictEqual(testzeileFinden(t13.ERGEBNIS_3), { zeile: '1 failed, 3 passed', fehler: true });
  assert.deepStrictEqual(testzeileFinden('test result: FAILED. 3 passed; 1 failed; 0 ignored'), { zeile: 'test result: FAILED. 3 passed; 1 failed; 0 ignored', fehler: true });
  assert.deepStrictEqual(testzeileFinden('test result: ok. 3 passed; 0 failed'), { zeile: 'test result: ok. 3 passed; 0 failed', fehler: false });
  assert.deepStrictEqual(testzeileFinden('# pass 4\n# fail 0'), { zeile: '# fail 0', fehler: false });
  assert.deepStrictEqual(testzeileFinden('# fail 2'), { zeile: '# fail 2', fehler: true });
  assert.deepStrictEqual(testzeileFinden('  6 failed'), { zeile: '  6 failed', fehler: true });
  assert.deepStrictEqual(testzeileFinden('0 failed, 3 passed'), { zeile: '0 failed, 3 passed', fehler: false });
});

test('testzeileFinden: „3 passed“ als erste von 21 Zeilen wird nicht gefunden, die letzte passende gewinnt, Satz ist keine Testzeile', () => {
  assert.strictEqual(testzeileFinden(['3 passed', ...zeilen(20)].join('\n')), null);
  assert.deepStrictEqual(testzeileFinden(['3 passed', ...zeilen(19)].join('\n')), { zeile: '3 passed', fehler: false });
  assert.deepStrictEqual(testzeileFinden('5 passed\n6 passed'), { zeile: '6 passed', fehler: false });
  assert.strictEqual(testzeileFinden('Es sind 3 passed'), null);
});

/* ── JSON (FA 3, AK 3) ── */

test('jsonZeilen: Nr 14 ergibt 11 Zeilen mit zwei Leerzeichen Einzug, Rollen für Schlüssel, Text, Zahl, Schlüsselwort', () => {
  const teile = jsonZeilen(JSON.parse('{"ok":true,"n":3,"liste":[1,null],"text":"a"}'), esc);
  assert.deepStrictEqual(teile.map(ohneTags), ['{', '  "ok": true,', '  "n": 3,', '  "liste": [', '    1,', '    null', '  ],', '  "text": "a"', '}']);
  assert.strictEqual(teile[1], '  <span class="tk-function">&quot;ok&quot;</span>: <span class="tk-keyword">true</span>,');
  assert.strictEqual(teile[2], '  <span class="tk-function">&quot;n&quot;</span>: <span class="tk-number">3</span>,');
  assert.strictEqual(teile[7], '  <span class="tk-function">&quot;text&quot;</span>: <span class="tk-string">&quot;a&quot;</span>');
  assert.deepStrictEqual(jsonZeilen({}, esc), ['{}']);
  assert.deepStrictEqual(jsonZeilen([], esc).map(ohneTags), ['[]']);
});

/* ── Aufruf-Satz (FA 1–4, 13; AK 1, 3, 4, 9) ── */

test('aufrufSatz Bash: Shell-Block nach shellUmbruch, ohne description, timeout als „Schlüssel: Wert“', () => {
  const html = aufrufSatz('Bash', t13.T13[1].text, esc);
  assert.match(html, /^<pre class="lv-sh">cd \/w\/demo &amp;&amp;\n npm test;\n echo &quot;a &amp;&amp; b&quot; \| grep 'x;y' # Ende; z<\/pre><dl class="lv-kv"><dt>timeout:<\/dt><dd>120000<\/dd><\/dl>$/);
  assert.doesNotMatch(html, /Tests fahren/);
});

test('aufrufSatz Bash mit 21 Zeilen: 20 offen bis „l19“, dann „1 weitere Zeile des Aufrufs“', () => {
  const html = aufrufSatz('Bash', t13.T13[14].text, esc);
  assert.match(html, /^<pre class="lv-sh">cat &lt;&lt;EOF &gt; c.txt\nl1\n[\s\S]*\nl19<\/pre><details class="lv-mehr"><summary>[\s\S]*1 weitere Zeile<span class="vh"> des Aufrufs<\/span><\/summary><pre class="lv-sh">EOF<\/pre><\/details>$/);
});

test('aufrufSatz flach: Nr 10 drei Felder in der Reihenfolge des Objekts, Nr 13 „query: stand“; Wert mit \\n als Block unter dem Schlüssel', () => {
  assert.strictEqual(aufrufSatz('Read', t13.T13[9].text, esc), '<dl class="lv-kv"><dt>file_path:</dt><dd>/w/demo/a.md</dd><dt>offset:</dt><dd>10</dd><dt>limit:</dt><dd>2</dd></dl>');
  assert.strictEqual(aufrufSatz('mcp__demo__abfrage', '{"query":"stand"}', esc), '<dl class="lv-kv"><dt>query:</dt><dd>stand</dd></dl>');
  assert.strictEqual(aufrufSatz('Task', '{"prompt":"a\\nb","x":true,"y":null}', esc), '<dl class="lv-kv"><dt class="blk">prompt:</dt><dd class="blk"><pre>a\nb</pre></dd><dt>x:</dt><dd>true</dd><dt>y:</dt><dd>null</dd></dl>');
});

test('aufrufSatz: Wert-Block mit 25 Zeilen gekürzt „weitere 5 Zeilen des Aufrufs“', () => {
  const html = aufrufSatz('Task', JSON.stringify({ prompt: zeilen(25).join('\n') }), esc);
  assert.match(html, /<dd class="blk"><pre>z1\n[\s\S]*z20<\/pre><details class="lv-mehr"><summary>[\s\S]*weitere 5 Zeilen<span class="vh"> des Aufrufs<\/span><\/summary><pre>z21\n[\s\S]*z25<\/pre><\/details><\/dd>/);
});

test('aufrufSatz: verschachtelt und kein Objekt als formatiertes JSON, „kein json“ ergibt null (wie heute)', () => {
  assert.strictEqual(aufrufSatz('X', '{"q":{"a":1}}', esc), '<pre class="lv-json">{\n  <span class="tk-function">&quot;q&quot;</span>: {\n    <span class="tk-function">&quot;a&quot;</span>: <span class="tk-number">1</span>\n  }\n}</pre>');
  assert.match(aufrufSatz('X', '[1,2]', esc), /^<pre class="lv-json">\[\n  <span class="tk-number">1<\/span>,/);
  assert.strictEqual(aufrufSatz('X', 'kein json', esc), null);
});

test('aufrufSatz Edit: file_path, dann Diff mit Kontext, − und + samt Lesetext; replace_all nur bei true', () => {
  const html = aufrufSatz('Edit', t13.T13[5].text, esc);
  assert.strictEqual(html, '<dl class="lv-kv"><dt>file_path:</dt><dd>/w/demo/a.js</dd></dl><div class="lv-dif">'
    + '<div class="ctx"><span class="m" aria-hidden="true"> </span><span class="c">x</span></div>'
    + '<div class="del"><span class="m" aria-hidden="true">−</span><span class="vh">entfernt: </span><span class="c">alt</span></div>'
    + '<div class="add"><span class="m" aria-hidden="true">+</span><span class="vh">hinzugefügt: </span><span class="c">neu</span></div>'
    + '<div class="ctx"><span class="m" aria-hidden="true"> </span><span class="c">y</span></div></div>');
  const mit = aufrufSatz('Edit', JSON.stringify({ file_path: 'a', old_string: 'x', new_string: 'y', replace_all: true }), esc);
  assert.match(mit, /<\/div><\/div><dl class="lv-kv"><dt>replace_all:<\/dt><dd>true<\/dd><\/dl>$/);
  const ohne = aufrufSatz('Edit', JSON.stringify({ file_path: 'a', old_string: 'x', new_string: 'y', replace_all: false }), esc);
  assert.doesNotMatch(ohne, /replace_all/);
});

test('aufrufSatz Write: 25 Zeilen nur „+“, 20 offen bis b20, dann „weitere 5 Zeilen der Änderung“', () => {
  const html = aufrufSatz('Write', t13.T13[7].text, esc);
  const offen = /<div class="lv-dif">([\s\S]*?)<\/div><details/.exec(html)[0];
  assert.strictEqual((offen.match(/class="add"/g) || []).length, 20);
  assert.doesNotMatch(html, /class="(del|ctx)"/);
  assert.match(html, /<span class="c">b20<\/span><\/div><\/div><details class="lv-mehr"><summary>[\s\S]*weitere 5 Zeilen<span class="vh"> der Änderung<\/span>/);
});

test('aufrufSatz Grenzen: 64 KiB + 1 Byte und 2.001 Zeilen ergeben null, genau an der Grenze ein Satz', () => {
  const mitLaenge = n => JSON.stringify({ query: 'q'.repeat(n - 12) });
  assert.strictEqual(mitLaenge(SATZ_GRENZEN.aufrufBytes).length, SATZ_GRENZEN.aufrufBytes);
  assert.notStrictEqual(aufrufSatz('X', mitLaenge(SATZ_GRENZEN.aufrufBytes), esc), null);
  assert.strictEqual(aufrufSatz('X', mitLaenge(SATZ_GRENZEN.aufrufBytes + 1), esc), null);
  const zweitausend = '{\n' + zeilen(1998).map(z => `"${z}":1,`).join('\n') + '\n"e":1}';
  assert.strictEqual(zweitausend.split('\n').length, 2000);
  assert.notStrictEqual(aufrufSatz('X', zweitausend, esc), null);
  assert.strictEqual(aufrufSatz('X', zweitausend.replace('{\n', '{\n\n'), esc), null);
});

test('aufrufSatz Maskieren: <img …> im new_string, <b>k</b> als Schlüssel ergeben kein Element, kein <a', () => {
  const edit = aufrufSatz('Edit', JSON.stringify({ file_path: 'a', old_string: '', new_string: '<img src=x onerror=alert(1)>' }), esc);
  const schluessel = aufrufSatz('X', JSON.stringify({ '<b>k</b>': '<i>v</i>' }), esc);
  for (const html of [edit, schluessel]) {
    assert.doesNotMatch(html, /<(img|b|i|a)[\s>]/);
  }
  assert.match(edit, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(schluessel, /<dt>&lt;b&gt;k&lt;\/b&gt;:<\/dt><dd>&lt;i&gt;v&lt;\/i&gt;<\/dd>/);
});

test('aufrufSatz: zeigt der Satz mehr markierbare Zeichen als der Text trägt (Escape \\u202e), gibt es keinen Satz', () => {
  assert.strictEqual(aufrufSatz('X', '{"q":"\\u202e"}', esc), null);
  assert.notStrictEqual(aufrufSatz('X', '{"q":"‮"}', esc), null);
});

/* ── Ergebnis-Satz (FA 1, 5–10; AK 2, 5–7) ── */

test('ergebnisSatz Nr 3: Testzeile im Fehler-Ton über dem Ergebnis, 20 offen, „weitere 5 Zeilen des Ergebnisses“, Zeile 24 unverändert', () => {
  const e = ergebnisSatz(t13.ERGEBNIS_3, esc);
  assert.match(e.html, /^<p class="lv-tz fehl"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg><span class="vh">Tests fehlgeschlagen: <\/span><span>1 failed, 3 passed<\/span><\/p><pre>Zeile 1\n/);
  assert.match(e.html, /Zeile 20<\/pre><details class="lv-mehr"><summary>[\s\S]*weitere 5 Zeilen<span class="vh"> des Ergebnisses<\/span><\/summary><pre>Zeile 21\nZeile 22\nZeile 23\n1 failed, 3 passed\nEnde<\/pre><\/details>$/);
  assert.strictEqual(e.kurz, null);
  assert.strictEqual(e.fehlerText, t13.ERGEBNIS_3);
});

test('ergebnisSatz: Erfolg-Ton mit „Tests bestanden: “, „# Titel“ ist Text und keine Überschrift', () => {
  assert.match(ergebnisSatz('# fail 0', esc).html, /^<p class="lv-tz ok"><svg[\s\S]*?<\/svg><span class="vh">Tests bestanden: <\/span><span># fail 0<\/span><\/p><pre># fail 0<\/pre>$/);
  assert.strictEqual(ergebnisSatz('# Titel', esc).html, '<pre># Titel</pre>');
});

test('ergebnisSatz Nr 5: Marke wörtlich, Pfad als Text in einem Element, Vorschau gesetzt wie ein Ergebnis, Kurzform, Fehlertext ist die Vorschau', () => {
  const e = ergebnisSatz(t13.ERGEBNIS_5, esc);
  assert.match(e.html, /^<p class="lv-cc"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg><span>Von Claude Code gekürzt \(69,9 KB\): Der Agent sah nur diese Vorschau\. Vollständig: <span class="mono lv-ccpfad">\/tmp\/demo\/tool-results\/b1\.txt<\/span><\/span><\/p><pre>Exit code 1\nfehlt: gross\.log\n\.\.\.<\/pre>$/);
  assert.strictEqual(ohneTags(e.html.split('</p>')[0]), 'Von Claude Code gekürzt (69,9 KB): Der Agent sah nur diese Vorschau. Vollständig: /tmp/demo/tool-results/b1.txt');
  assert.strictEqual(e.kurz, 'gekuerzt');
  assert.strictEqual(e.fehlerText, 'Exit code 1\nfehlt: gross.log\n...');
  assert.doesNotMatch(e.html, /persisted-output/);
});

test('ergebnisSatz: fremde Form von <persisted-output> — Marke ohne Größe und Pfad, darunter der Text', () => {
  const text = '<persisted-output>\nirgendwas\n</persisted-output>';
  const e = ergebnisSatz(text, esc);
  assert.match(e.html, /^<p class="lv-cc"><svg[\s\S]*?<\/svg><span>Von Claude Code gekürzt: Der Agent sah nur diese Vorschau\.<\/span><\/p><pre>&lt;persisted-output&gt;\nirgendwas\n&lt;\/persisted-output&gt;<\/pre>$/);
  assert.strictEqual(e.kurz, 'gekuerzt');
  assert.strictEqual(e.fehlerText, text);
});

test('ergebnisSatz Maskieren: <i> im Pfad von <persisted-output> ergibt kein Element', () => {
  const e = ergebnisSatz(t13.ERGEBNIS_5.replace('/tmp/demo', '/tmp/<i>x</i>'), esc);
  assert.doesNotMatch(e.html, /<i>/);
  assert.match(e.html, /\/tmp\/&lt;i&gt;x&lt;\/i&gt;\/tool-results/);
});

test('ergebnisSatz Nr 7: eingebetteter Systemhinweis zwischen „Datei geändert.“ und „weiter“, eingeklappt mit der Klasse lv-ein', () => {
  const e = ergebnisSatz('Datei geändert.\n<system-reminder>\nNicht vergessen.\n</system-reminder>\nweiter', esc);
  assert.match(e.html, /^<pre>Datei geändert\.<\/pre><details class="lv-e sys lv-ein"><summary><span class="pf">[\s\S]*?<\/span><span class="nm">Systemhinweis<\/span><span class="z1">&lt;system-reminder&gt;<\/span><\/summary><pre>&lt;system-reminder&gt;\nNicht vergessen\.\n&lt;\/system-reminder&gt;<\/pre><\/details><pre>weiter<\/pre>$/);
  assert.strictEqual(e.kurz, null);
  assert.strictEqual(e.hinweise, 1);
});

test('ergebnisSatz Nr 11: nur ein Hinweis — Kurzform „systemhinweis“ und der Satz für den ausgeblendeten Fall', () => {
  const e = ergebnisSatz('<system-reminder>\nNur Hinweis.\n</system-reminder>', esc);
  assert.strictEqual(e.kurz, 'systemhinweis');
  assert.match(e.html, /^<details class="lv-e sys lv-ein">[\s\S]*<\/details><p class="lv-nurh">Nur Systemhinweis, ausgeblendet \(Filter „Systemhinweise“\)\.<\/p>$/);
});

test('ergebnisSatz: "" und " \\n " ergeben gedämpft „Leeres Ergebnis.“', () => {
  for (const text of ['', ' \n ']) assert.strictEqual(ergebnisSatz(text, esc).html, '<p class="lv-gedaempft">Leeres Ergebnis.</p>');
});

test('ergebnisSatz Nr 14: JSON-Objekt als formatiertes JSON in 11 Zeilen, ohne Kürzung', () => {
  const e = ergebnisSatz('{"ok":true,"n":3,"liste":[1,null],"text":"a"}', esc);
  assert.match(e.html, /^<pre class="lv-json">\{\n/);
  assert.strictEqual(ohneTags(e.html).split('\n').length, 9);
  assert.doesNotMatch(e.html, /lv-mehr/);
});

test('ergebnisSatz: Hinweise und Kürzung — ein Hinweis zählt seine Zeilen, die Grenze fällt nach ihm', () => {
  const text = [...zeilen(19), '<system-reminder>', 'h', '</system-reminder>', ...zeilen(3, 'r')].join('\n');
  const e = ergebnisSatz(text, esc);
  assert.match(e.html, /z19<\/pre><details class="lv-e sys lv-ein">[\s\S]*?<\/details><details class="lv-mehr"><summary>[\s\S]*weitere 3 Zeilen<span class="vh"> des Ergebnisses<\/span><\/summary><pre>r1\nr2\nr3<\/pre><\/details>$/);
});

test('Budget: der Satz zählt genau die Zeichen als Marke, die zeichenBuchen (lauf.js) bucht', () => {
  const { zeichenBuchen } = require('../../web/lauf.js');
  const abweichend = [];
  for (let c = 0; c <= 0xffff; c++) {
    const zeichen = String.fromCharCode(c);
    const gebucht = zeichenBuchen(zeichen, { lauf: 10, gebucht: 0 }).gezeigt === 1;
    if (gebucht !== new RegExp(satz.MARKIERBAR_SATZ.source).test(zeichen)) abweichend.push(c.toString(16));
  }
  assert.deepStrictEqual(abweichend, []);
});

test('web/lauf-satz.js überschreibt im Browser keinen Namen eines anderen Moduls und keinen globalen aus ansicht.js und app.js (Lehre #217)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ordner = path.join(__dirname, '../../web');
  const namen = datei => {
    const text = fs.readFileSync(path.join(ordner, datei), 'utf8');
    return [...text.matchAll(/Object\.assign\(ziel, \{([^}]*)\}\);/g)].flatMap(m => m[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean));
  };
  const eigene = namen('lauf-satz.js');
  assert.ok(eigene.includes('aufrufSatz') && eigene.includes('ergebnisSatz'));
  for (const datei of fs.readdirSync(ordner).filter(d => d.endsWith('.js') && d !== 'lauf-satz.js')) assert.deepStrictEqual(namen(datei).filter(n => eigene.includes(n)), [], datei);
  const global = fs.readFileSync(path.join(ordner, 'ansicht.js'), 'utf8') + fs.readFileSync(path.join(ordner, 'app.js'), 'utf8');
  for (const n of eigene) assert.doesNotMatch(global, new RegExp(`^(function|const|let|async function) ${n}\\b`, 'm'), n);
  assert.match(fs.readFileSync(path.join(ordner, 'index.html'), 'utf8'), /<script src="\/web\/lauf-satz\.js"><\/script>\n<script src="\/web\/lauf\.js"><\/script>/, 'vor lauf.js geladen');
});

/* ── Nacharbeit 1 (Code- und Security-Review #261) ── */

/* Muss 1: tief verschachteltes JSON — Abnahme-Probe wörtlich: Lauf aus Nachricht, Aufruf-Text `[`×N`]`×N, Bash `{"command":"ls"}` mit
   Ergebnis `{"a":`×N `1` `}`×N; alle Einträge und „Ende des Transkripts“, der tiefe Wert als `pre` oder gedeckelt, unter ~1 MB je Eintrag. */
const lauf = require('../../web/lauf.js');
const eintrag = (nr, art, wer, text, name = null) => ({ nr, eintrag: { art, wer, text, zeit: null, name } });
const tiefeListe = n => '['.repeat(n) + ']'.repeat(n);
const tiefesObjekt = n => '{"a":'.repeat(n) + '1' + '}'.repeat(n);
const tieferLauf = (aufruf, ergebnis) => [
  eintrag(1, 'nachricht', 'mensch', 'Auftrag'),
  eintrag(2, 'werkzeugaufruf', 'agent', aufruf, 'Bash'),
  eintrag(3, 'werkzeugergebnis', 'werkzeug', 'ok', 'Bash'),
  eintrag(4, 'werkzeugaufruf', 'agent', '{"command":"ls"}', 'Bash'),
  eintrag(5, 'werkzeugergebnis', 'werkzeug', ergebnis, 'Bash'),
  eintrag(6, 'nachricht', 'agent', 'Ergebnis: bestanden'),
];
const eintraegeIn = html => html.split(/(?=<li\b)/).slice(1);

for (const [variante, n, aufruf, ergebnis] of [
  ['Aufruf', 1500, tiefeListe(1500), 'ok'], ['Aufruf', 5000, tiefeListe(5000), 'ok'], ['Aufruf', 30000, tiefeListe(30000), 'ok'],
  ['Ergebnis', 1500, '{"command":"ls"}', tiefesObjekt(1500)], ['Ergebnis', 5000, '{"command":"ls"}', tiefesObjekt(5000)],
  ['Ergebnis', 12000, '{"command":"ls"}', tiefesObjekt(12000)], ['Kontrolle', 20, tiefeListe(20), tiefesObjekt(20)],
]) {
  test(`Muss 1: ${variante} mit Tiefe ${n} — laufAuswerten und laufHtml zeigen alle Einträge und „Ende des Transkripts“, je Eintrag < 1 MB`, () => {
    const zeilenDesLaufs = tieferLauf(aufruf, ergebnis);
    const auswertung = lauf.laufAuswerten(zeilenDesLaufs, false);
    const html = lauf.laufHtml(zeilenDesLaufs, false, esc, auswertung);
    const li = eintraegeIn(html);
    assert.strictEqual(li.length, 5, 'Nachricht, zwei Werkzeugzeilen, Nachricht, Ende');
    assert.match(li[4], /Ende des Transkripts/);
    for (const l of li) assert.ok(l.length < 1000000, `Eintrag mit ${l.length} Zeichen`);
  });
}

test('Muss 1: Tiefe bis 32 als formatiertes JSON, ab 33 der Aufruf als pre (null) und das Ergebnis als Text', () => {
  assert.match(aufrufSatz('X', tiefeListe(32), esc), /^<pre class="lv-json">/);
  assert.strictEqual(aufrufSatz('X', tiefeListe(33), esc), null);
  assert.match(aufrufSatz('X', `{"q":${tiefeListe(31)}}`, esc), /^<pre class="lv-json">/, 'Objekt zählt mit: 1 + 31');
  assert.strictEqual(aufrufSatz('X', `{"q":${tiefeListe(32)}}`, esc), null);
  assert.strictEqual(aufrufSatz('X', `{"q":"${'['.repeat(40)}"}`, esc).includes('<dl class="lv-kv">'), true, 'Klammern im Text zählen nicht');
  assert.strictEqual(aufrufSatz('X', `{"q":"\\"${'['.repeat(40)}"}`, esc).includes('<dl class="lv-kv">'), true, 'auch nach \\" im Text');
  assert.match(ergebnisSatz(tiefesObjekt(32), esc).html, /^<pre class="lv-json">/);
  assert.strictEqual(ergebnisSatz(tiefesObjekt(33), esc).html, `<pre>${esc(tiefesObjekt(33))}</pre>`);
});

test('Muss 1: Tiefe 1500 — aufrufSatz null, ergebnisSatz als Text, systemhinweiseZaehlen wirft nicht', () => {
  assert.strictEqual(aufrufSatz('X', tiefeListe(1500), esc), null);
  assert.strictEqual(ergebnisSatz(tiefesObjekt(1500), esc).html, `<pre>${esc(tiefesObjekt(1500))}</pre>`);
  assert.strictEqual(systemhinweiseZaehlen(tiefesObjekt(1500) + '\n<system-reminder>\nx\n</system-reminder>', true), 1);
});

test('Muss 1: ein JSON-Satz über der Grenze des HTML je Eintrag (flach breit, Tiefe 30) steht als pre bzw. Text', () => {
  const breit = '['.repeat(29) + '[' + Array(20000).fill(1).join(',') + ']' + ']'.repeat(29);
  assert.ok(Buffer.byteLength(breit) < SATZ_GRENZEN.aufrufBytes);
  assert.strictEqual(aufrufSatz('X', breit, esc), null);
  const breitObjekt = `{"l":${breit}}`;
  assert.strictEqual(ergebnisSatz(breitObjekt, esc).html.startsWith('<pre class="lv-json">'), false);
  const knapp = `{"l":[${Array(2000).fill(1).join(',')}]}`;
  assert.match(aufrufSatz('X', knapp, esc), /^<pre class="lv-json">/, 'darunter bleibt der Satz');
});

test('Muss 1: Rückfall — wirft das Setzen einen RangeError, steht der Aufruf als pre (null) und das Ergebnis als Text', () => {
  const wirft = t => {
    if (t === '"a"') throw new RangeError('Maximum call stack size exceeded');
    return esc(t);
  };
  assert.strictEqual(aufrufSatz('X', '{"q":{"a":1}}', wirft), null);
  assert.strictEqual(ergebnisSatz('{"a":{"b":1}}', wirft).html, '<pre>{&quot;a&quot;:{&quot;b&quot;:1}}</pre>');
  assert.throws(() => aufrufSatz('X', '{"q":{"a":1}}', () => { throw new TypeError('anderer Fehler'); }), TypeError, 'nur RangeError ist Rückfall');
});

/* Muss 2: shellUmbruch nie innerhalb von "…" mit $(…), ${…} oder $'…' — Abnahme-Probe a–e wörtlich. */

test('Muss 2: a, b — $(…) in "…" mit Anführungszeichen darin bleibt unverändert', () => {
  for (const befehl of ['echo "$(echo "x;y")"', 'echo "$(sed "s/a/b/;s/c/d/" f)"']) assert.strictEqual(shellUmbruch(befehl), befehl, befehl);
});

test('Muss 2: c — nach dem geschlossenen "$(…)" bricht && um, genau 2 Zeilen', () => {
  const befehl = 'echo "$(git log --format="%h;%s" -1)" && echo ok';
  assert.deepStrictEqual(shellUmbruch(befehl).split('\n'), ['echo "$(git log --format="%h;%s" -1)" &&', ' echo ok']);
});

test('Muss 2: d — ${…} mit ; darin, 2 Zeilen nach „x=a;“', () => {
  assert.deepStrictEqual(shellUmbruch('x=a; echo ${x//;/,}').split('\n'), ['x=a;', ' echo ${x//;/,}']);
});

test("Muss 2: e — $'…' mit \\' darin, 2 Zeilen nach „…more';“", () => {
  const befehl = "echo $'it\\'s; more'; echo ok";
  assert.deepStrictEqual(shellUmbruch(befehl).split('\n'), ["echo $'it\\'s; more';", ' echo ok']);
});

test('Muss 2: Varianten — verschachtelt, Backticks in "…", Klammern in $(…), Kommentar in $(…), unausgeglichen; ohne \\n stets wieder der Befehl', () => {
  for (const befehl of ['echo "${x:-a;b}"', 'echo "`a; b`"', 'echo $(echo $(a; b); c)', 'echo $( (a; b) ; c)', "echo \"$'a;b'\"", 'echo ${a:-"x;y"}',
    'echo $(a # ) ; b\n)', 'a; echo "b; c', 'a; echo $(b; c', 'a; echo ${b', 'x=$(cat <<EOF\na); b\nEOF\n)']) {
    assert.strictEqual(shellUmbruch(befehl), befehl, `unverändert: ${befehl}`);
  }
  assert.deepStrictEqual(shellUmbruch('echo $((1+2)); b').split('\n'), ['echo $((1+2));', ' b']);
  assert.deepStrictEqual(shellUmbruch('echo "$x;$(a)"; b').split('\n'), ['echo "$x;$(a)";', ' b']);
});

/* Muss 3: Testzeile nach PO Z. 619 — R00240 FA 7, AK 5 mit vier Proben wörtlich. */

const tonUndLesetext = text => {
  const m = /^<p class="lv-tz (ok|fehl)">[\s\S]*?<\/svg>([\s\S]*?)<\/p>/.exec(ergebnisSatz(text, esc).html);
  if (m === null) return null;
  return { ton: m[1], lesetext: ohneTags(m[2]) };
};

test('Muss 3: Playwright-Ausgabe mit „1 failed“ vor „2 passed (1.1s)“ ergibt den Fehler-Ton, die Zeile „1 failed“', () => {
  assert.deepStrictEqual(tonUndLesetext('Exit code 1\n\n  1 failed\n    t/a.spec.js:3:1 › b\n  2 passed (1.1s)\n'), { ton: 'fehl', lesetext: 'Tests fehlgeschlagen: 1 failed' });
});

test('Muss 3: „  2 passed (1.1s)“ allein ergibt den Erfolg-Ton', () => {
  assert.deepStrictEqual(tonUndLesetext('  2 passed (1.1s)\n'), { ton: 'ok', lesetext: 'Tests bestanden: 2 passed (1.1s)' });
});

test('Muss 3: „# pass 3⏎# fail 1“ ergibt den Fehler-Ton mit „# fail 1“, „# fail 0⏎# pass 3“ den Erfolg-Ton', () => {
  assert.deepStrictEqual(tonUndLesetext('# pass 3\n# fail 1'), { ton: 'fehl', lesetext: 'Tests fehlgeschlagen: # fail 1' });
  assert.deepStrictEqual(tonUndLesetext('# fail 0\n# pass 3'), { ton: 'ok', lesetext: 'Tests bestanden: # pass 3' });
});

test('Muss 3: die letzte Fehlschlagszeile gewinnt, auch vor späteren Erfolgszeilen; nie zusammengesetzt', () => {
  assert.deepStrictEqual(testzeileFinden('2 failed\n1 failed\n5 passed'), { zeile: '1 failed', fehler: true });
  assert.deepStrictEqual(testzeileFinden('test result: FAILED. 3 passed; 1 failed\n# pass 9'), { zeile: 'test result: FAILED. 3 passed; 1 failed', fehler: true });
  assert.deepStrictEqual(testzeileFinden(['1 failed', ...zeilen(20)].join('\n')), null, 'außerhalb der letzten 20 Zeilen');
});

/* Sollte: Hinweis-Flut — ab mehr als 200 eingebetteten Hinweisen in einem Text bleibt der Text Text. */

test('Sollte Hinweis-Flut: 200 Hinweise werden eingeklappt, 201 bleiben Text, gezählt wie gesetzt', () => {
  const flut = n => 'a' + '\n<system-reminder>x</system-reminder>'.repeat(n);
  assert.strictEqual(systemhinweiseTrennen(flut(200)).filter(t => t.art === 'hinweis').length, 200);
  assert.deepStrictEqual(systemhinweiseTrennen(flut(201)), [{ art: 'text', text: flut(201) }]);
  assert.strictEqual(systemhinweiseZaehlen(flut(201), true), 0);
  assert.strictEqual((ergebnisSatz(flut(201), esc).html.match(/<details class="lv-e/g) || []).length, 0);
});

/* Nacharbeit 2: `;&`, `;;&` sind je ein Operator ohne Umbruch; `case` innerhalb von $(…) oder (…) lässt den Befehl unverändert. */
const { spawnSync } = require('node:child_process');
const hatBash = spawnSync('bash', ['-c', 'true']).status === 0;
const bashAusgabe = befehl => spawnSync('bash', ['-c', befehl], { encoding: 'utf8' });

test('shellUmbruch: ;& und ;;& im case sind ein Operator, kein Umbruch dahinter', () => {
  const durchfall = 'case x in x) echo a;& y) echo b;; esac; echo c';
  assert.deepStrictEqual(shellUmbruch(durchfall).split('\n'), ['case x in x) echo a;& y) echo b;; esac;', ' echo c']);
  const weiter = 'case x in x) echo a;;& x) echo b;; esac; echo c';
  assert.deepStrictEqual(shellUmbruch(weiter).split('\n'), ['case x in x) echo a;;& x) echo b;; esac;', ' echo c']);
});

test('shellUmbruch: case innerhalb von $(…) oder (…) lässt den Befehl unverändert', () => {
  for (const befehl of [
    'echo "$(case x in a) echo "x;y" ;; esac)" ; echo c',
    'echo $(case x in x) echo a;& y) echo b;; esac); echo c',
    '(case x in a) echo a;; esac); echo c',
    'echo $( (case x in a) echo a;; esac) ); echo c',
  ]) assert.strictEqual(shellUmbruch(befehl), befehl, befehl);
  assert.deepStrictEqual(shellUmbruch('echo casement; echo c').split('\n'), ['echo casement;', ' echo c'], 'casement ist nicht das Wort case');
  assert.strictEqual(shellUmbruch('echo $(echo case); echo c'), 'echo $(echo case); echo c', 'im Zweifel unverändert');
});

test('shellUmbruch: Bash-Gegenprobe — ohne die eingefügten \\n läuft der Befehl gleich', { skip: !hatBash && 'bash fehlt' }, () => {
  for (const befehl of [
    'case x in x) echo a;& y) echo b;; esac; echo c',
    'case x in x) echo a;;& x) echo b;; esac; echo c',
    'echo "$(case x in a) echo "x;y" ;; esac)" ; echo c',
    'echo "$(case a in a) echo "x;y" ;; esac)" ; echo c',
  ]) {
    const umbrochen = shellUmbruch(befehl);
    assert.strictEqual(umbrochen.replace(/\n/g, ''), befehl.replace(/\n/g, ''));
    const original = bashAusgabe(befehl), neu = bashAusgabe(umbrochen);
    assert.strictEqual(original.status, 0, `Original läuft: ${befehl} ${original.stderr}`);
    assert.deepStrictEqual({ s: neu.status, o: neu.stdout }, { s: original.status, o: original.stdout }, befehl);
  }
});

/* ── R00244 (Karte #267): fehlgeschlagenes Edit/Write „nicht angewendet“ (AK 7, ADR-0041 N6 Punkt 6) ── */

const t16 = require('../tests/laufansicht-t16.js');
const NICHT_ANGEWENDET = '<p class="lv-na">Nicht angewendet — der Schritt ist fehlgeschlagen.</p>';

test('aufrufSatz Edit mit Fehler: Satz über dem Diff, Klasse nicht-angewendet, Lesetext „vorgesehen …“, + und − bleiben', () => {
  const html = aufrufSatz('Edit', t16.T16[5].text, esc, null, true);
  assert.ok(html.includes(`${NICHT_ANGEWENDET}<div class="lv-dif nicht-angewendet">`), html);
  assert.match(html, /<div class="del"><span class="m" aria-hidden="true">−<\/span><span class="vh">vorgesehen zu entfernen: <\/span><span class="c">alt<\/span><\/div>/);
  assert.match(html, /<div class="add"><span class="m" aria-hidden="true">\+<\/span><span class="vh">vorgesehen hinzuzufügen: <\/span><span class="c">neu<\/span><\/div>/);
  assert.doesNotMatch(html, /hinzugefügt: |"vh">entfernt: /);
});

test('aufrufSatz Write mit Fehler: Satz und gedämpfter Diff; der Satz steht nur einmal, auch über einem gekürzten Diff', () => {
  assert.ok(aufrufSatz('Write', t16.T16[7].text, esc, null, true).includes(`${NICHT_ANGEWENDET}<div class="lv-dif nicht-angewendet"><div class="add">`));
  const lang = aufrufSatz('Write', JSON.stringify({ file_path: 'a', content: zeilen(25).join('\n') }), esc, null, true);
  assert.strictEqual(lang.split('lv-na').length - 1, 1);
  assert.strictEqual(lang.split('lv-dif nicht-angewendet').length - 1, 2, 'offener Teil und Rest hinter „weitere 5 Zeilen“');
});

test('aufrufSatz ohne Fehler: Edit und Write wie bisher, ohne Satz und ohne Klasse; Bash mit Fehler hat keinen Satz', () => {
  for (const [name, text] of [['Edit', t16.T16[10].text], ['Write', t16.T16[7].text]]) {
    const html = aufrufSatz(name, text, esc, null, false);
    assert.strictEqual(html, aufrufSatz(name, text, esc));
    assert.doesNotMatch(html, /lv-na|nicht-angewendet|vorgesehen/);
    assert.match(html, /<span class="vh">hinzugefügt: <\/span>/);
  }
  assert.doesNotMatch(aufrufSatz('Bash', t16.T16[3].text, esc, null, true), /lv-na|nicht-angewendet/);
});

/* ── R00244: Farbfolgen übersetzen, reine Funktion (AK 1–3, ADR-0041 N6 Punkt 1–3, 5 „Durchsetzung“) ── */

const { farbteile, GRUNDSCHRIFT } = satz;
const E = '\u001b';
const teileOhneZustand = text => farbteile(text, GRUNDSCHRIFT).teile;

test('farbteile: „ESC[2m a ESC[22m“ ergibt eine gedämpfte Spanne ohne U+001B; Text ohne ESC bleibt ein Teil in Grundschrift', () => {
  assert.deepStrictEqual(teileOhneZustand(`${E}[2m a ${E}[22m`), [{ text: ' a ', klasse: 'sgr2' }]);
  assert.deepStrictEqual(teileOhneZustand('ok-Zeile ohne Farbe'), [{ text: 'ok-Zeile ohne Farbe', klasse: '' }]);
  assert.deepStrictEqual(teileOhneZustand(''), []);
});

test('farbteile: Rechenbeispiele aus AK 1 — fett unabhängig, zuletzt genannte Farbe gilt, gleicher Zustand öffnet keine Spanne', () => {
  assert.deepStrictEqual(teileOhneZustand(`${E}[1;31mA${E}[22mB`), [{ text: 'A', klasse: 'sgr1 sgr31' }, { text: 'B', klasse: '' }]);
  assert.deepStrictEqual(teileOhneZustand(`${E}[1;2;31;32mx`), [{ text: 'x', klasse: 'sgr1 sgr32' }]);
  assert.deepStrictEqual(teileOhneZustand(`${E}[31mA${E}[31mB`), [{ text: 'AB', klasse: 'sgr31' }]);
  assert.deepStrictEqual(teileOhneZustand(`${E}[31m-    let x=1;${E}[0m`), [{ text: '-    let x=1;', klasse: 'sgr31' }]);
  assert.deepStrictEqual(teileOhneZustand(`${E}[33mg${E}[1mf${E}[mz`), [{ text: 'g', klasse: 'sgr33' }, { text: 'f', klasse: 'sgr1 sgr33' }, { text: 'z', klasse: '' }]);
  assert.deepStrictEqual(teileOhneZustand(`${E}[1mf${E}[0mz${E}[2;mx`), [{ text: 'f', klasse: 'sgr1' }, { text: 'zx', klasse: '' }], '2;leer endet in Grundschrift: keine neue Spanne');
});

test('farbteile: alles andere bleibt im Text (Marke) und ändert den Zustand nicht — 8, 7, 30, 30;40, 38;5;196, 0;8, ESC(B, ESC, ESC[, 5 Teile', () => {
  const gegenproben = [`${E}[8m`, `${E}[7m`, `${E}[30m`, `${E}[30;40m`, `${E}[40m`, `${E}[38;5;196m`, `${E}[0;8m`, `${E}(B`, E, `${E}[`, `${E}[1;1;1;1;1m`, `${E}[2;2;2;2;2m`, `${E}[3m`, `${E}[4m`, `${E}[9m`, `${E}[21m`, `${E}[02m`, `${E}[31;`, `${E}[31M`];
  for (const folge of gegenproben) {
    assert.deepStrictEqual(teileOhneZustand(`${folge}geheim`), [{ text: `${folge}geheim`, klasse: '' }], JSON.stringify(folge));
    assert.deepStrictEqual(teileOhneZustand(`${E}[31mrot${folge}x`), [{ text: `rot${folge}x`, klasse: 'sgr31' }], `im Zustand rot: ${JSON.stringify(folge)}`);
  }
  assert.deepStrictEqual(teileOhneZustand(`${E}[2mgeheim${E}[`), [{ text: `geheim${E}[`, klasse: 'sgr2' }], 'ESC[ am Textende');
});

test('farbteile: Zustand geht über die Zeile hinaus und kommt zurück; eine Folge ohne Text dahinter öffnet keine Spanne', () => {
  const erste = farbteile(`${E}[31mrot über`, GRUNDSCHRIFT);
  assert.deepStrictEqual(farbteile('zwei Zeilen', erste.zustand).teile, [{ text: 'zwei Zeilen', klasse: 'sgr31' }]);
  const nurFolge = farbteile(`${E}[31m${E}[1m`, GRUNDSCHRIFT);
  assert.deepStrictEqual(nurFolge.teile, []);
  assert.deepStrictEqual(farbteile('x', nurFolge.zustand).teile, [{ text: 'x', klasse: 'sgr1 sgr31' }]);
  assert.deepStrictEqual(farbteile('x', GRUNDSCHRIFT).teile, [{ text: 'x', klasse: '' }], 'GRUNDSCHRIFT bleibt unverändert');
});

test('farbteile: über alle Folgen aus erlaubten und fremden Teilen nur die fünf festen Klassen, nie ein Wert aus dem Text', () => {
  const teile = ['', '0', '1', '2', '22', '31', '32', '33', '7', '8', '30', '40', '38', '5', '196', '255', '41', '47', '97', '107', 'x'];
  const erlaubt = new Set(['', 'sgr1', 'sgr2', 'sgr31', 'sgr32', 'sgr33', 'sgr1 sgr2', 'sgr1 sgr31', 'sgr1 sgr32', 'sgr1 sgr33']);
  let zufall = 7;
  const naechstes = n => { zufall = (zufall * 1103515245 + 12345) % 2147483648; return zufall % n; };
  for (let i = 0; i < 20000; i++) {
    const folge = Array.from({ length: 1 + naechstes(5) }, () => teile[naechstes(teile.length)]).join(';');
    const ergebnis = farbteile(`a${E}[${folge}mb`, GRUNDSCHRIFT);
    for (const t of ergebnis.teile) {
      assert.ok(erlaubt.has(t.klasse), `${folge} → ${t.klasse}`);
      assert.deepStrictEqual(Object.keys(t), ['text', 'klasse']);
    }
    const unerlaubt = folge.split(';').length > 4 || folge.split(';').some(p => !['', '0', '1', '2', '22', '31', '32', '33'].includes(p));
    if (unerlaubt) assert.ok(ergebnis.teile.map(t => t.text).join('').includes(`${E}[${folge}m`), `bleibt Marke: ${folge}`);
  }
});

/* ── R00244: Vorgriff an drei Orten und Grenze der Spannen (AK 4, 5, ADR-0041 N6 Punkt 4) ── */

const { sichtbarTeile } = require('../../web/diff.js');
const { farbenErlaubt } = satz;
/** Marken, die `sichtbarTeile` (diff.js) im übersetzten Ergebnis sieht: je Zeile die Teile ohne die erlaubten Folgen. */
function markenNachUebersetzung(text) {
  let zustand = GRUNDSCHRIFT, marken = 0;
  for (const z of text.split('\n')) {
    const ergebnis = farbteile(z, zustand);
    zustand = ergebnis.zustand;
    marken += ergebnis.teile.reduce((n, t) => n + sichtbarTeile(t.text).filter(x => x.marke).length, 0);
  }
  return marken;
}
const gebucht = (text, farbig) => require('../../web/lauf.js').zeichenBuchen(text, { lauf: 10000, gebucht: 0 }, farbig).gezeigt;

test('Vorgriff: ein Ergebnis mit 252 erlaubten ESC bucht 0, mit 252 unerlaubten 252; ohne Übersetzung (Aufruf, Nachricht) beide 252', () => {
  const erlaubt = `${E}[2mx${E}[22m`.repeat(126), unerlaubt = `${E}[8mx${E}(B`.repeat(126);
  assert.strictEqual(gebucht(erlaubt, true), 0);
  assert.strictEqual(gebucht(unerlaubt, true), 252);
  assert.strictEqual(gebucht(erlaubt, false), 252);
  assert.strictEqual(gebucht(unerlaubt, false), 252);
});

test('Vorgriff gleich an drei Orten: je Zeichen U+0000–U+FFFF mit erlaubter und unerlaubter Folge dahinter bucht zeichenBuchen, was die Übersetzung mit sichtbarTeile als Marke zeigt', () => {
  const abweichend = [];
  for (let c = 0; c <= 0xffff; c++) {
    if (c === 0x0a) continue;
    for (const folge of [`${E}[2m`, `${E}[8m`, `${E}[1;31m`, `${E}[1;1;1;1;1m`]) {
      const text = String.fromCharCode(c) + folge + 'x';
      if (gebucht(text, true) !== markenNachUebersetzung(text)) abweichend.push(`${c.toString(16)} ${JSON.stringify(folge)}`);
    }
  }
  assert.deepStrictEqual(abweichend, []);
});

test('farbenErlaubt: höchstens 2.000 Spannen je Ergebnis — 2.000 ja, 2.001 nein; 1.200 gedämpfte ja; 3.000 rote nein; 3 MiB ESC[31m ohne Text ja, rasch', () => {
  assert.strictEqual(SATZ_GRENZEN.farben, 2000);
  assert.strictEqual(farbenErlaubt(`${E}[31mx${E}[0m `.repeat(2000)), true);
  assert.strictEqual(farbenErlaubt(`${E}[31mx${E}[0m `.repeat(2001)), false);
  assert.strictEqual(farbenErlaubt(`${E}[2mx${E}[22m`.repeat(1200)), true);
  assert.strictEqual(farbenErlaubt(`${E}[31mx${E}[0m`.repeat(3000)), false);
  assert.strictEqual(farbenErlaubt(`${E}[31mrot über\n`.repeat(2001)), false, 'eine Spanne je Zeile');
  assert.strictEqual(farbenErlaubt('ohne Folge'), true);
  const beginn = Date.now();
  assert.strictEqual(farbenErlaubt(`${E}[31m`.repeat(3 * 1048576 / 5)), true);
  assert.ok(Date.now() - beginn < 2000, `${Date.now() - beginn} ms`);
});

/* ── R00244: Übersetzung im Ergebnis-Satz (AK 1–5, ADR-0041 N6 Punkt 1–5) ── */

const { sichtbarHtml } = require('../../web/diff.js');
const sichtbar = t => sichtbarHtml(t, esc);
const spannen = html => [...html.matchAll(/<span class="(sgr[^"]*)">([^<]*)<\/span>/g)].map(m => [m[1], m[2]]);
const markenIm = html => (html.match(/class="mk-z/g) || []).length;

test('ergebnisSatz Nr 3 (Call log): zwei gedämpfte Spannen, ESC(B bleibt eine Marke, ESC[m übersetzt; kein U+001B im HTML', () => {
  const html = ergebnisSatz(t16.ERGEBNIS_3, sichtbar).html;
  assert.deepStrictEqual(spannen(html), [['sgr2', "  - waiting for getByRole('button', { name: 'Speichern' })"], ['sgr2', '  - locator resolved to &lt;button&gt;']]);
  assert.strictEqual(markenIm(html), 1);
  assert.ok(!html.includes(E));
  assert.match(html, /^<pre>Exit code 1\n### Error: locator\.click: Timeout 5000ms exceeded\.\nCall log:\n<span class="sgr2">/);
  assert.match(html, /<\/span>\(B <\/pre>$/, 'ESC[m dahinter ist übersetzt und nicht vorhanden');
});

test('ergebnisSatz Nr 5 (rustfmt): rot und grün je bis ESC[0m, 0 Marken; Nr 14: 4 Marken, 0 Spannen, Text lesbar', () => {
  const fmt = ergebnisSatz(t16.ERGEBNIS_5, sichtbar).html;
  assert.deepStrictEqual(spannen(fmt), [['sgr31', '-    let x=1;'], ['sgr32', '+    let x = 1;']]);
  assert.strictEqual(markenIm(fmt), 0);
  assert.match(fmt, /\nok-Zeile ohne Farbe<\/pre>$/);
  const verboten = ergebnisSatz(t16.ERGEBNIS_14, sichtbar).html;
  assert.deepStrictEqual(spannen(verboten), []);
  assert.strictEqual(markenIm(verboten), 4);
  assert.strictEqual(ohneTags(verboten).replace(/␛ U\+001B/g, ''), '[8mgeheim [7mumgekehrt [30;40mschwarz [38;5;196mrot');
});

test('ergebnisSatz: Zustand über Zeilen, Hinweise und die Kürzung hinweg; erste Zeile des Hinweises und Testzeile ohne Spanne', () => {
  assert.deepStrictEqual(spannen(ergebnisSatz(`${E}[31mrot\nüber zwei${E}[0m\nGrund`, sichtbar).html), [['sgr31', 'rot'], ['sgr31', 'über zwei']]);
  const lang = ergebnisSatz(`${E}[32m` + zeilen(25).join('\n'), sichtbar).html;
  assert.strictEqual(spannen(lang).length, 25, 'auch hinter „weitere 5 Zeilen“ grün');
  const mitHinweis = ergebnisSatz(`a${E}[2m\n<system-reminder>\n${E}[31mh\n</system-reminder>\nb`, sichtbar).html;
  assert.deepStrictEqual(spannen(mitHinweis), [['sgr2', '&lt;system-reminder&gt;'], ['sgr31', 'h'], ['sgr31', '&lt;/system-reminder&gt;'], ['sgr31', 'b']]);
  assert.match(mitHinweis, /<span class="z1">&lt;system-reminder&gt;<\/span>/);
  const test = ergebnisSatz(`${E}[31mx${E}[0m\ntest result: ok. 3 passed; 0 failed; ${E}[2m0 ignored`, sichtbar).html;
  assert.match(test, /<p class="lv-tz ok">[\s\S]*<span>test result: ok\. 3 passed; 0 failed; 0 ignored<\/span><\/p>/);
  assert.ok(!test.includes(E));
});

test('ergebnisSatz: jedes Ergebnis beginnt in Grundschrift; JSON-Ergebnis und leeres Ergebnis ohne Übersetzung', () => {
  ergebnisSatz(`${E}[31moffen`, sichtbar);
  assert.deepStrictEqual(spannen(ergebnisSatz('danach', sichtbar).html), []);
  assert.strictEqual(ergebnisSatz(`${E}[31m${E}[0m`, sichtbar).html, '<pre></pre>');
  const json = ergebnisSatz('{"a":"\\u001b[31mx"}', sichtbar).html;
  assert.deepStrictEqual(spannen(json), []);
  assert.strictEqual(ergebnisSatz(' \n ', sichtbar).html, '<p class="lv-gedaempft">Leeres Ergebnis.</p>');
});

test('ergebnisSatz: über 2.000 Spannen steht das Ergebnis ganz ohne Übersetzung, jedes ESC eine Marke; 1.200 gedämpfte ohne Marke', () => {
  const flut = ergebnisSatz(`${E}[31mx${E}[0m`.repeat(3000), sichtbar).html;
  assert.deepStrictEqual(spannen(flut), []);
  assert.strictEqual(markenIm(flut), 6000);
  const gedaempft = ergebnisSatz(`${E}[2mx${E}[22m`.repeat(1200), sichtbar).html;
  assert.strictEqual(spannen(gedaempft).length, 1200);
  assert.strictEqual(markenIm(gedaempft), 0);
});

test('Gleichheit an drei Orten: je Zeichen U+0000–U+FFFF mit Folge dahinter zeigt der Satz genau so viele Marken, wie zeichenBuchen bucht', () => {
  const abweichend = [];
  for (let c = 0; c <= 0xffff; c++) {
    if (c === 0x0a) continue;
    for (const folge of [`${E}[2m`, `${E}[8m`]) {
      const text = String.fromCharCode(c) + folge + 'x';
      const satzZeigt = markenIm(ergebnisSatz(text, sichtbar).html);
      if (satzZeigt !== gebucht(text, true) || satzZeigt !== markenNachUebersetzung(text)) abweichend.push(`${c.toString(16)} ${JSON.stringify(folge)}`);
    }
  }
  assert.deepStrictEqual(abweichend, []);
});

/* Die Erwartungen in r00244-ergebnis-ohne-esc.json hat ergebnisSatz am Stand vor R00244 (Karte #267, Commit „B1275“) gesetzt. */
test('ergebnisSatz ohne ESC ist byte-gleich zum Stand vor R00244 (T13, T16 ohne Folgen, Hinweise, gekürzt, JSON, Bidi)', () => {
  const vorher = require('./r00244-ergebnis-ohne-esc.json');
  assert.ok(vorher.length >= 10);
  for (const { text, html } of vorher) assert.strictEqual(ergebnisSatz(text, sichtbar).html, html, text.slice(0, 60));
});
