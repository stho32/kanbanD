// R00221 B1144: Einträge des Transkripts als HTML — reine Funktion aus web/lauf.js, ohne Browser (FA 6, FA 10; AK 6 Teil
// Einträge, AK 8 Node). Nachrichten offen mit Markdown nach dem Sichtbarmachen, Werkzeuge eingeklappt und nie Markdown.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { laufHtml } = require('../../web/lauf.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const e = (nr, art, wer, text, zusatz = {}) => ({ nr, eintrag: { art, wer, text, zeit: null, name: null, ...zusatz } });
const eintraegeVon = html => html.split(/(?=<li\b)/).slice(1).map(li => li.replace(/<\/ol>$/, ''));
const ohneTags = html => html.replace(/<[^>]+>/g, '');

const G = [
  e(1, 'nachricht', 'agent', 'Ich lese zuerst **die Anforderung**.', { name: 'entwickler', zeit: '2026-11-20T10:00:41+01:00' }),
  e(2, 'werkzeugaufruf', 'agent', 'Anforderungen/R00219.md', { name: 'Read', zeit: '2026-11-20T10:00:42+01:00' }),
  { nr: 4, eintrag: null },
  e(5, 'werkzeugergebnis', 'werkzeug', '---\nid: R00219\nstatus: Neu', { name: 'Read', zeit: '2026-11-20T09:00:43Z' }),
  e(6, 'nachricht', 'mensch', 'Passt.', { zeit: 'gestern' }),
];

test('AK 6: Datei G — Nachricht offen mit fett, Aufruf und Ergebnis eingeklappt, Fehlereintrag an seiner Stelle, Ende', () => {
  const html = laufHtml(G, false, esc);
  assert.match(html, /^<ol class="lv-l" id="lv-insel" data-ohne-rollstand aria-label="Einträge des Transkripts der Reihe nach">/);
  const [n1, w2, f4, w5, n6, ende] = eintraegeVon(html);
  assert.strictEqual(eintraegeVon(html).length, 6);
  assert.match(n1, /<b>entwickler<\/b><span>Agent<\/span><span class="mono">10:00:41<\/span>/);
  assert.match(n1, /<strong>die Anforderung<\/strong>/);
  assert.doesNotMatch(n1, /<details/);
  assert.match(w2, /<details class="lv-w"><summary>/);
  assert.match(w2, /<span class="nm">Read<span>Aufruf<\/span><\/span><span class="z1">Anforderungen\/R00219.md<\/span><span class="lv-zt">10:00:42<\/span><\/summary>/);
  assert.strictEqual(ohneTags(f4), 'Zeile 4 des Transkripts ist nicht lesbar.');
  assert.match(w5, /<span class="nm">Read<span>Ergebnis<\/span><\/span><span class="z1">---<\/span><span class="lv-zt">10:00:43<\/span>/, 'Uhrzeit aus 09:00:43Z in Ortszeit');
  assert.match(w5, /<pre>---\nid: R00219\nstatus: Neu<\/pre>/, 'aufgeklappt drei Zeilen in Mono, kein Markdown');
  assert.match(n6, /<span>Mensch<\/span>/);
  assert.doesNotMatch(n6, /class="mono"/, 'zeit in anderer Form entfällt');
  assert.doesNotMatch(n6, /<b>/, 'ohne name kein Name');
  assert.strictEqual(ohneTags(ende), 'Ende des Transkripts');
  assert.doesNotMatch(html, /\{"art"/, 'kein Rohtext');
});

test('FA 6: Uhrzeit nur aus ISO 8601 mit Versatz oder Z, Sekunden erlaubt; jede andere Form entfällt', () => {
  const zeit = z => /<span class="mono">([^<]*)<\/span>/.exec(laufHtml([e(1, 'nachricht', 'agent', 'x', { zeit: z })], false, esc));
  assert.strictEqual(zeit('2026-11-20T10:00+01:00')[1], '10:00:00');
  assert.strictEqual(zeit('2026-11-20T09:00:43.123Z')[1], '10:00:43');
  assert.strictEqual(zeit('2026-07-01T08:00:00Z')[1], '10:00:00', 'Sommerzeit');
  for (const falsch of ['gestern', '2026-11-20T10:00:41', '2026-11-20 10:00:41+01:00', '2026-13-40T10:00:00Z', '', '10:00:41Z']) assert.strictEqual(zeit(falsch), null, falsch);
});

test('AK 6: erste Zeile eines Werkzeugtexts eingeklappt höchstens 200 Zeichen und „…“, aufgeklappt alle', () => {
  const lang = 'a'.repeat(250);
  const html = laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', lang + '\nzweite', { name: 'Bash' })], false, esc);
  const z1 = /<span class="z1">([^<]*)<\/span>/.exec(html)[1];
  assert.strictEqual(z1, 'a'.repeat(200) + '…');
  assert.match(html, new RegExp(`<pre>${lang}\nzweite</pre>`));
  const kurz = /<span class="z1">([^<]*)<\/span>/.exec(laufHtml([e(1, 'werkzeugaufruf', 'agent', 'b'.repeat(200), {})], false, esc))[1];
  assert.strictEqual(kurz, 'b'.repeat(200), 'genau 200 ohne „…“');
  const ohneName = laufHtml([e(1, 'werkzeugaufruf', 'agent', 'x')], false, esc);
  assert.match(ohneName, /<span class="nm"><span>Aufruf<\/span><\/span>/, 'ohne name nur die Art');
});

test('AK 8: fremder Text bleibt Text — script, javascript:-Verweis, img, Bidi-Zeichen als Marke', () => {
  const html = laufHtml([
    e(1, 'nachricht', 'agent', '<script>window.pwn=1</script> [x](javascript:window.pwn=2)', { name: 'planer' }),
    e(2, 'werkzeugaufruf', 'agent', 'echo <img src=x onerror=window.pwn=3>‮abc\nzwei', { name: 'Bash‮hs' }),
  ], false, esc);
  assert.match(html, /&lt;script&gt;window.pwn=1&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /href="javascript/i);
  assert.doesNotMatch(html, /<a\b/);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /‮/, 'U+202E steht nie als Zeichen');
  assert.match(html, /<span class="nm">Bash<span class="mk-z mk-bidi" role="img" aria-label="sichtbar gemachtes Bidi-Steuerzeichen U\+202E">/);
  assert.ok(html.indexOf('Bash') < html.indexOf('hs<span>Aufruf'), 'Bash vor hs');
  const summary = html.split('<summary>')[1].split('</summary>')[0];
  // eingeklappt steht die Marke als Text, das Markenelement trägt der aufgeklappte Text (Budget, PO Z. 493)
  assert.match(summary, /<span class="z1">echo &lt;img src=x onerror=window.pwn=3&gt;⟨U\+202E⟩abc<\/span>/);
  assert.match(html, /<pre>echo &lt;img src=x onerror=window.pwn=3&gt;<span class="mk-z mk-bidi"/);
});

test('FA 10: Bidi- und Steuerzeichen in einer Nachricht werden vor dem Markdown sichtbar, der Name auch', () => {
  const html = laufHtml([e(1, 'nachricht', 'agent', 'a‮b\u0007c\nzweite', { name: 'x⁦y' })], false, esc);
  assert.doesNotMatch(html, /[‮⁦\u0007]/);
  assert.match(html, /⟨U\+202E⟩/);
  assert.match(html, /U\+2066/);
});

test('FA 7: an der Grenze steht Wortlaut 15 statt des Endes; ohne Einträge nur der Schluss', () => {
  const grenze = laufHtml(G.slice(0, 2), true, esc);
  const letzter = eintraegeVon(grenze).pop();
  assert.strictEqual(ohneTags(letzter), 'Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.');
  assert.doesNotMatch(grenze, /Ende des Transkripts/);
  assert.deepStrictEqual(eintraegeVon(laufHtml([], true, esc)).map(ohneTags), ['Grenze erreicht: Der Rest des Transkripts wird nicht angezeigt.']);
  assert.deepStrictEqual(eintraegeVon(laufHtml([], false, esc)).map(ohneTags), ['Ende des Transkripts']);
});

test('Jede Art hat ihr Wort: Agent, Mensch, Werkzeug; Aufruf, Ergebnis', () => {
  const html = laufHtml([e(1, 'nachricht', 'werkzeug', 'x'), e(2, 'werkzeugergebnis', 'agent', 'y')], false, esc);
  assert.match(html, /<span>Werkzeug<\/span>/);
  assert.match(html, /<span>Ergebnis<\/span>/);
});

test('web/lauf.js überschreibt im Browser keinen Namen, den ein anderes Modul auf window legt (Lehre #217)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ordner = path.join(__dirname, '../../web');
  const namen = datei => {
    const text = fs.readFileSync(path.join(ordner, datei), 'utf8');
    return [...text.matchAll(/Object\.assign\(ziel, \{([^}]*)\}\);/g)].flatMap(m => m[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean));
  };
  const eigene = namen('lauf.js');
  assert.ok(eigene.includes('laufHtml') && eigene.includes('zeilenLesen'));
  for (const datei of fs.readdirSync(ordner).filter(d => d.endsWith('.js') && d !== 'lauf.js')) assert.deepStrictEqual(namen(datei).filter(n => eigene.includes(n)), [], datei);
  const global = fs.readFileSync(path.join(ordner, 'ansicht.js'), 'utf8') + fs.readFileSync(path.join(ordner, 'app.js'), 'utf8');
  for (const n of eigene) assert.doesNotMatch(global, new RegExp(`^(function|const|let|async function) ${n}\\b`, 'm'), n);
});

// R00221 Nacharbeit 1 (Security Muss 1, PO Z. 493–495): Budget für sichtbar gemachte Zeichen — 1.000 je Text, 10.000 je Lauf,
// gezählt und gebucht an einer Stelle vor sichtbarHtml/sichtbarText; der Überschuss steht als eine Zusammenfassung.
const { laufFehlerText, laufFehlerArt, zeichenBuchen, ZEICHEN_JE_TEXT, ZEICHEN_JE_LAUF } = require('../../web/lauf.js');
const { sichtbarTeile } = require('../../web/diff.js');
const marken = html => [...html.matchAll(/class="mk-z mk-(bidi|st)"/g)].length;
const RLO = '‮';
const zusammenfassung = html => (/<span class="mk-rest">([^<]*)<\/span>/.exec(html) || [])[1];

test('Budget: die Grenzen sind 1.000 je Text und 10.000 je Lauf', () => {
  assert.deepStrictEqual([ZEICHEN_JE_TEXT, ZEICHEN_JE_LAUF], [1000, 10000]);
});

test('Budget: zeichenBuchen markiert genau die Zeichen, die sichtbarTeile sichtbar macht (außer \\n, das die Zeilen trennt)', () => {
  for (let c = 0; c <= 0xFFFF; c++) {
    if (c >= 0xD800 && c <= 0xDFFF) continue;
    const z = String.fromCharCode(c);
    const markiert = sichtbarTeile('a' + z + 'b').some(t => t.marke);
    const gebucht = zeichenBuchen('a' + z + 'b', { lauf: 10000, gebucht: 0 });
    assert.strictEqual(gebucht.gezeigt, markiert && c !== 10 ? 1 : 0, `U+${c.toString(16)}`);
  }
});

test('AK 8 Lauf A: Werkzeugergebnis mit 1.000.000 × U+202E — Anfang, 1.000 Marken, „… und 999.000 weitere Steuerzeichen“, Ende', () => {
  const html = laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', 'Anfang' + RLO.repeat(1000000) + 'Ende', { name: 'Bash' })], false, esc);
  const pre = /<pre>([\s\S]*)<\/pre>/.exec(html)[1];
  assert.strictEqual(marken(pre), 1000);
  assert.strictEqual(zusammenfassung(pre), '… und 999.000 weitere Steuerzeichen');
  assert.ok(pre.startsWith('Anfang') && pre.endsWith('Ende'));
  assert.doesNotMatch(html, /‮/);
  assert.ok(html.length < 400000, `${html.length} Zeichen HTML`);
});

test('AK 8 Lauf B: 2.700.000 × U+0001 — „… und 2.699.000 weitere Steuerzeichen“; Lauf C: Name mit 262.144 × U+202E', () => {
  const b = laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', 'Anfang' + '\u0001'.repeat(2700000) + 'Ende')], false, esc);
  assert.strictEqual(marken(b), 1000);
  assert.strictEqual(zusammenfassung(b), '… und 2.699.000 weitere Steuerzeichen');
  assert.doesNotMatch(b, /\u0001/);
  const c = laufHtml([e(1, 'nachricht', 'agent', 'Text der Nachricht', { name: 'Anfang' + RLO.repeat(262144) + 'Ende' })], false, esc);
  const name = /<b>([\s\S]*?)<\/b><span>Agent/.exec(c)[1];
  assert.strictEqual(marken(name), 1000);
  assert.strictEqual(zusammenfassung(name), '… und 261.144 weitere Steuerzeichen');
  assert.ok(name.startsWith('Anfang') && name.endsWith('Ende'));
  assert.doesNotMatch(c, /‮/);
});

test('Budget: Einzahl „… und 1 weiteres Steuerzeichen“; 1.000 Zeichen ganz ohne Zusammenfassung; Nachricht als Text', () => {
  const eins = laufHtml([e(1, 'werkzeugaufruf', 'agent', RLO.repeat(1001))], false, esc);
  assert.strictEqual(zusammenfassung(eins), '… und 1 weiteres Steuerzeichen');
  const genau = laufHtml([e(1, 'werkzeugaufruf', 'agent', RLO.repeat(1000))], false, esc);
  assert.strictEqual(zusammenfassung(genau), undefined);
  const n = laufHtml([e(1, 'nachricht', 'agent', 'vor ' + '\u0007'.repeat(1500) + ' nach')], false, esc);
  assert.strictEqual([...n.matchAll(/U\+0007/g)].length, 1000);
  assert.strictEqual(zusammenfassung(n), '… und 500 weitere Steuerzeichen');
  assert.match(n, /vor /);
  assert.match(n, / nach/);
  assert.doesNotMatch(n, /\u0007/);
});

test('Budget: Zähler der Marken über 1, 10 und 30 Texte — höchstens 1.000 je Text, 10.000 je Lauf; das elfte trägt nur die Zusammenfassung', () => {
  for (const [anzahl, erwartet] of [[1, 1000], [10, 10000], [30, 10000]]) {
    const zeilen = Array.from({ length: anzahl }, (_, i) => e(i + 1, 'werkzeugergebnis', 'werkzeug', RLO.repeat(1000)));
    const html = laufHtml(zeilen, false, esc);
    assert.strictEqual(marken(html), erwartet, `${anzahl} Texte`);
  }
  const elf = laufHtml(Array.from({ length: 11 }, (_, i) => e(i + 1, 'werkzeugergebnis', 'werkzeug', RLO.repeat(1000))), false, esc);
  const elfter = elf.split('<li class="lv-e">')[11];
  assert.strictEqual(marken(elfter), 0);
  assert.strictEqual(zusammenfassung(elfter), '… und 1.000 weitere Steuerzeichen');
  // ein neues Zeichnen (anderer Lauf) beginnt mit vollem Budget
  assert.strictEqual(marken(laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', RLO.repeat(1000))], false, esc)), 1000);
});

test('Budget, Kontrollpaar: gleich viel Text aus „a“ steht ganz da', () => {
  const a = 'Anfang' + 'a'.repeat(1000000) + 'Ende';
  const html = laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', a)], false, esc);
  assert.ok(html.includes(`<pre>${a}</pre>`));
  assert.strictEqual(zusammenfassung(html), undefined);
});

test('PO Z. 494: Links nur in Nachrichten — [x](https://example.org) ergibt dort genau ein a mit target=_blank rel=noopener, im Werkzeugtext und Namen keins', () => {
  const md = '[x](https://example.org)';
  const n = laufHtml([e(1, 'nachricht', 'agent', md)], false, esc);
  assert.strictEqual([...n.matchAll(/<a\b/g)].length, 1);
  assert.match(n, /<a [^>]*href="https:\/\/example\.org"[^>]*>/);
  assert.match(n, /target="_blank"/);
  assert.match(n, /rel="noopener"/);
  const w = laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', md, { name: md })], false, esc);
  assert.doesNotMatch(w, /<a\b/);
  const name = laufHtml([e(1, 'nachricht', 'agent', 'x', { name: md })], false, esc);
  assert.strictEqual([...name.matchAll(/<a\b/g)].length, 0);
});

test('FA 8 (PO Z. 495): eine unerwartete Ausnahme heißt „…: Die Datei lässt sich nicht verarbeiten.“, nie Text des Browsers', () => {
  assert.strictEqual(laufFehlerText({ art: 'verarbeiten' }), 'Das Transkript ließ sich nicht lesen: Die Datei lässt sich nicht verarbeiten.');
  for (const g of [new RangeError('Invalid string length'), new TypeError('x is undefined'), Object.assign(new Error('Fehler'), { status: undefined }), 'kaputt', null]) {
    assert.deepStrictEqual(laufFehlerArt(g), { art: 'verarbeiten' }, String(g));
  }
  assert.deepStrictEqual(laufFehlerArt(Object.assign(new Error('Antwortbudget erschöpft'), { status: 503, daten: { fehler: 'Antwortbudget erschöpft' } })), { art: 'server', status: 503, fehler: 'Antwortbudget erschöpft' });
  assert.deepStrictEqual(laufFehlerArt(Object.assign(new Error('weg'), { status: 0 })), { art: 'verbindung' });
  assert.deepStrictEqual(laufFehlerArt(Object.assign(new Error('Frist'), { status: 503, frist: true })), { art: 'verbindung' });
  assert.deepStrictEqual(laufFehlerArt(Object.assign(new Error('e'), { entpacken: true })), { art: 'entpacken' });
  assert.deepStrictEqual(laufFehlerArt(Object.assign(new Error('nicht da'), { status: 404, daten: { zustand: 'fehlt' } })), { art: 'fehlt' });
});
