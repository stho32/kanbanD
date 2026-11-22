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
