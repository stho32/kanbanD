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

// R00221 Nachtrag (#251): Aufruf und Ergebnis sind eine Zeile an der Stelle des Aufrufs, mit Befehl, Kürzel und Dauer statt Uhrzeit.
test('AK 6: Datei G — Nachricht offen mit fett, Aufruf und Ergebnis als eine Zeile eingeklappt, Fehlereintrag an seiner Stelle, Ende', () => {
  const html = laufHtml(G, false, esc);
  assert.match(html, /^<ol class="lv-l" id="lv-insel" data-ohne-rollstand aria-label="Einträge des Transkripts der Reihe nach">/);
  const [n1, w2, f4, n6, ende] = eintraegeVon(html);
  assert.strictEqual(eintraegeVon(html).length, 5);
  assert.match(n1, /<b>entwickler<\/b><span>Agent<\/span><span class="mono">10:00:41<\/span>/);
  assert.match(n1, /<strong>die Anforderung<\/strong>/);
  assert.doesNotMatch(n1, /<details/);
  assert.match(w2, /<details class="lv-s ohne-ab"><summary>/);
  assert.match(w2, /<span class="nm">Read<\/span><span class="bf">Anforderungen\/R00219.md<\/span><span class="eg">---<\/span><span class="du"><span>1 s<\/span>/, 'Dauer aus 10:00:42+01:00 bis 09:00:43Z');
  assert.strictEqual(ohneTags(f4), 'Zeile 4 des Transkripts ist nicht lesbar.');
  assert.match(w2, /<span class="k">Aufruf<\/span><pre>Anforderungen\/R00219.md<\/pre><span class="k">Ergebnis<\/span><pre>---\nid: R00219\nstatus: Neu<\/pre>/, 'aufgeklappt beide Texte in Mono, kein Markdown');
  // R00234 FA 9: die erste Nachricht von mensch ist der Auftrag und steht eingeklappt
  assert.match(n6, /<details class="lv-e"><summary>[\s\S]*<span class="nm">Auftrag<\/span><span class="z1">Passt\.<\/span><\/summary>/);
  assert.doesNotMatch(n6, /class="zt"/, 'zeit in anderer Form entfällt');
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
  const kuerzelText = /<span class="eg">([^<]*)<\/span>/.exec(html)[1];
  assert.strictEqual(kuerzelText, 'a'.repeat(200) + '…');
  assert.match(html, new RegExp(`<pre>${lang}\nzweite</pre>`));
  const kurz = /<span class="bf">([^<]*)<\/span>/.exec(laufHtml([e(1, 'werkzeugaufruf', 'agent', 'b'.repeat(200), {})], false, esc))[1];
  assert.strictEqual(kurz, 'b'.repeat(200), 'genau 200 ohne „…“');
  const ohneName = laufHtml([e(1, 'werkzeugaufruf', 'agent', 'x')], false, esc);
  assert.match(ohneName, /<span class="nm"><\/span>/, 'ohne name kein Name');
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
  assert.ok(html.indexOf('Bash') < html.indexOf('hs</span>'), 'Bash vor hs');
  const summary = html.split('<summary>')[1].split('</summary>')[0];
  // eingeklappt steht die Marke als Text, das Markenelement trägt der aufgeklappte Text (Budget, PO Z. 493)
  assert.match(summary, /<span class="bf">echo &lt;img src=x onerror=window.pwn=3&gt;⟨U\+202E⟩abc<\/span>/);
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
  assert.match(html, /<span class="k">Ergebnis<\/span>/);
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
  const elfter = eintraegeVon(elf)[10];
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

// R00234 B1209: Kopf mit Gesamtdauer und Kennzahlen (FA 3, FA 4; AK 1–3 Node) — aus der Auswertung und dem Kosteneintrag der
// Karte; „–“ ist aria-hidden und trägt daneben einen Lesetext der Klasse vh, nie ein aria-label.
const { laufKopfHtml, laufAuswerten } = require('../../web/lauf.js');
const { T1_ZEILEN } = require('../tests/laufansicht-t1.js');
const KOSTEN = { amount: 1.79, currency: 'USD' };
/** Sichtbarer Text (ohne vh) und vorgelesener Text (ohne aria-hidden) eines Ausschnitts. */
const sichtbar = html => ohneTags(html.replace(/<span class="vh">[^<]*<\/span>/g, ''));
const vorgelesen = html => ohneTags(html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, ''));
const gesamtdauer = html => /<div class="lv-gd">([\s\S]*?)<\/div>/.exec(html)[1];
const kennzahlen = html => [...html.matchAll(/<dt>([^<]*)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map(m => [m[1], sichtbar(m[2]), vorgelesen(m[2])].map(t => t.replace(/\u00a0/g, ' ')));
const t1 = laufAuswerten(T1_ZEILEN, false);

test('AK 1, AK 3: Kopf von T1 — Gesamtdauer mit Aufteilung, Ergebnis, Werkzeugaufrufe, Fehler erkannt, Commits, Kosten', () => {
  const html = laufKopfHtml({ zustand: 'eintraege', auswertung: t1, kosten: KOSTEN }, esc);
  const gd = [...gesamtdauer(html).matchAll(/<span class="[^"]*">([^<]*)<\/span>/g)].map(m => m[1]);
  assert.deepStrictEqual(gd, ['Gesamtdauer', '2 min 30 s', 'Werkzeuge 13 s · Denken 1 min 11 s · Warten 1 min 6 s']);
  assert.deepStrictEqual(kennzahlen(html).map(k => [k[0], k[1]]), [['Ergebnis', 'bestanden'], ['Werkzeugaufrufe', '6'], ['Fehler erkannt', '2'], ['Commits', '1'], ['Kosten', '1,79 $']]);
  assert.doesNotMatch(html, /Betrag/);
  assert.doesNotMatch(html, /aria-label/);
});

test('FA 3: ein Teil mit 0 ms entfällt; an der Grenze „mindestens“ und der Satz zur Grenze; weniger als zwei Zeiten „Dauer unbekannt“', () => {
  const nurZwei = { ...t1, warten: 0, gesamt: 84000 };
  assert.match(laufKopfHtml({ zustand: 'eintraege', auswertung: nurZwei, kosten: null }, esc), /<span class="auf">Werkzeuge 13 s · Denken 1 min 11 s<\/span>/);
  const grenze = laufKopfHtml({ zustand: 'eintraege', auswertung: { ...t1, grenze: true }, kosten: null }, esc);
  assert.deepStrictEqual([...gesamtdauer(grenze).matchAll(/<span class="[^"]*">([^<]*)<\/span>/g)].map(m => m[1]),
    ['Gesamtdauer', 'mindestens 2 min 30 s', 'gerechnet bis zur Grenze des Transkripts', 'Werkzeuge 13 s · Denken 1 min 11 s · Warten 1 min 6 s']);
  const unbekannt = laufKopfHtml({ zustand: 'eintraege', auswertung: { ...t1, bekannt: false }, kosten: null }, esc);
  assert.deepStrictEqual([...gesamtdauer(unbekannt).matchAll(/<span class="[^"]*">([^<]*)<\/span>/g)].map(m => m[1]), ['Gesamtdauer', 'Dauer unbekannt', 'Weniger als zwei Einträge tragen eine Zeit.']);
});

test('AK 3: T4 ohne Bericht und ohne Kosten — „–“ mit Lesetext „kein Bericht erkannt“ bzw. „kein Kosteneintrag“', () => {
  const ohne = { ...t1, bericht: null, kennzahlen: { werkzeugaufrufe: 1, fehler: 0 } };
  const k = kennzahlen(laufKopfHtml({ zustand: 'eintraege', auswertung: ohne, kosten: null }, esc));
  assert.deepStrictEqual(k, [['Ergebnis', '–', 'kein Bericht erkannt'], ['Werkzeugaufrufe', '1', '1'], ['Fehler erkannt', '0', '0'], ['Commits', '–', 'kein Bericht erkannt'], ['Kosten', '–', 'kein Kosteneintrag']]);
});

test('AK 2, AK 3: ohne gelesene Einträge „–“ mit „wird gelesen“ bzw. „nicht verfügbar“; Kosten bleiben aus der Karte', () => {
  for (const [zustand, lesetext] of [['liest', 'wird gelesen'], ['ohne', 'nicht verfügbar']]) {
    const html = laufKopfHtml({ zustand, auswertung: null, kosten: { amount: 0.42, currency: 'USD' } }, esc);
    assert.deepStrictEqual([sichtbar(gesamtdauer(html)), vorgelesen(gesamtdauer(html))], ['Gesamtdauer–', `Gesamtdauer${lesetext}`], zustand);
    assert.deepStrictEqual(kennzahlen(html), [...['Ergebnis', 'Werkzeugaufrufe', 'Fehler erkannt', 'Commits'].map(n => [n, '–', lesetext]), ['Kosten', '0,42 $', '0,42 $']], zustand);
    assert.doesNotMatch(html, /aria-label/);
  }
});

test('FA 4: Ergebnis befund und blockiert tragen ihre Form; Commits ohne Zeile „Commits:“ ist „–“ mit „nicht verfügbar“', () => {
  const html = ergebnis => laufKopfHtml({ zustand: 'eintraege', auswertung: { ...t1, bericht: { nr: 1, text: '', ergebnis, commits: null } }, kosten: null }, esc);
  assert.match(html('befund'), /<span class="erg warn">[\s\S]*befund<\/span>/);
  assert.match(html('blockiert'), /<span class="erg fehl">[\s\S]*blockiert<\/span>/);
  assert.deepStrictEqual(kennzahlen(html('befund'))[3], ['Commits', '–', 'nicht verfügbar']);
});

// R00234 B1210: Bericht zuerst, gepaarte Werkzeugzeilen, Denk- und Wartezeilen, Auftrag und Systemhinweise eingeklappt (FA 5–9;
// AK 4–8 Node). Die Zeilen tragen `id="lv-s<Nr>"` und `tabindex="-1"` als Sprungziele.
const { laufBerichtHtml } = require('../../web/lauf.js');
const t1Html = laufHtml(T1_ZEILEN, false, esc, t1);
const t1Li = eintraegeVon(t1Html);
const liVon = id => t1Li.find(li => li.startsWith(`<li id="${id}"`));
/** Vorgelesener Text einer summary: ohne aria-hidden-Teile, mit vh-Text. */
const summaryName = li => vorgelesen(/<summary>([\s\S]*?)<\/summary>/.exec(li)[1]).replace(/ /g, ' ');

test('AK 7: T1 hat 14 Listeneinträge vor dem Schluss — 10 Zeilen und 4 Denk- und Wartezeilen, je ein li mit Sprungziel', () => {
  const ids = t1Li.slice(0, -1).map(li => /^<li id="([^"]+)" tabindex="-1"/.exec(li)[1]);
  assert.deepStrictEqual(ids, ['lv-s1', 'lv-s2', 'lv-s3-vor', 'lv-s3', 'lv-s5', 'lv-s7-vor', 'lv-s7', 'lv-s8', 'lv-s11', 'lv-s13-vor', 'lv-s13', 'lv-s14', 'lv-s15-vor', 'lv-s15']);
  assert.strictEqual(ohneTags(t1Li[14]), 'Ende des Transkripts');
});

test('AK 7: Denk- und Wartezeilen lesen sich mit ihrem Text; Marke, Linie und Balken sind aria-hidden', () => {
  const texte = ['lv-s3-vor', 'lv-s7-vor', 'lv-s13-vor', 'lv-s15-vor'].map(id => vorgelesen(liVon(id)));
  assert.deepStrictEqual(texte, ['21 s denkt', '5 s denkt', '1 min 5 s wartet', '38 s denkt']);
  assert.match(liVon('lv-s13-vor'), /class="lv-d t"/);
  assert.match(liVon('lv-s3-vor'), /class="lv-d d"/);
  assert.doesNotMatch(liVon('lv-s3-vor').slice(0, 40), /aria-hidden/, 'das li selbst ist nicht verborgen');
});

test('AK 5: Nr 3 mit Nr 4 eine Zeile — Bash, Befehl in Festbreite, Absicht, Kürzel, 4 s, Balken 6 %; Nr 4 keine eigene Zeile', () => {
  const z = liVon('lv-s3');
  assert.match(z, /<span class="nm">Bash<\/span><span class="bf">ls Anforderungen \| tail -2<\/span><span class="ab">Nächste freie Nummer<\/span><span class="eg">R00228-wackler-unter-last.md<\/span>/);
  assert.match(z, /<span class="du"><span>4 s<\/span><i class="w" style="width:6%" aria-hidden="true"><\/i><\/span>/);
  assert.strictEqual(liVon('lv-s4'), undefined);
  assert.match(z, /<span class="k">Aufruf<\/span><pre>\{&quot;command&quot;:&quot;ls Anforderungen \| tail -2&quot;,&quot;description&quot;:&quot;Nächste freie Nummer&quot;\}<\/pre><span class="k">Ergebnis<\/span><pre>R00228-wackler-unter-last.md\nR00229-frei.md<\/pre>/);
});

test('AK 5: Nr 5 ohne Absicht ohne Platzhalter; Nr 7 und 8 parallel mit 2 s und 3 s (Balken 5 %); Nr 11 und 15 „–“ ohne Balken', () => {
  assert.doesNotMatch(liVon('lv-s5'), /class="ab"/);
  assert.match(liVon('lv-s5'), /class="lv-s fehl ohne-ab"/);
  for (const [id, dauer] of [['lv-s7', '2 s'], ['lv-s8', '3 s']]) {
    assert.match(liVon(id), /<span class="nm">Read<span class="par">parallel<\/span><\/span>/);
    assert.match(liVon(id), new RegExp(`<span class="du"><span>${dauer}</span>`));
  }
  assert.match(liVon('lv-s8'), /style="width:5%"/);
  assert.match(liVon('lv-s11'), /<span class="du"><span class="lv-leerwert" aria-hidden="true">–<\/span><span class="vh">Dauer unbekannt<\/span><\/span>/);
  assert.match(liVon('lv-s15'), /<span class="du"><span class="lv-leerwert" aria-hidden="true">–<\/span><span class="vh">kein Ergebnis<\/span><\/span>/);
  assert.doesNotMatch(liVon('lv-s11') + liVon('lv-s15'), /<i class="w"/);
  const allein = eintraegeVon(laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', 'ok')], false, esc))[0];
  assert.match(allein, /<span class="vh">kein Aufruf<\/span>/);
});

test('AK 6: Fehlerzeilen Nr 5 und Nr 8 rot mit Warnzeichen aria-hidden und Lesetext „Fehler: “ vor dem Kürzel; Nr 3 und Nr 11 nicht', () => {
  assert.strictEqual(summaryName(liVon('lv-s5')), 'Bashgrep -n kd-muted web/laeufe.jsFehler: Exit code 11 s');
  assert.strictEqual(summaryName(liVon('lv-s8')), 'Readparallelb.mdFehler: &lt;tool_use_error&gt;File does not exist.&lt;/tool_use_error&gt;3 s');
  for (const id of ['lv-s5', 'lv-s8']) {
    assert.match(liVon(id), /<details class="lv-s fehl/);
    assert.match(liVon(id), /<span class="eg"><svg class="i" viewBox="0 0 24 24" aria-hidden="true">[\s\S]*?<\/svg><span class="vh">Fehler: <\/span>/);
  }
  for (const id of ['lv-s3', 'lv-s11']) {
    assert.doesNotMatch(summaryName(liVon(id)), /Fehler/);
    assert.doesNotMatch(liVon(id), /lv-s fehl/);
  }
});

test('AK 8: Auftrag und Systemhinweis eingeklappt an ihrer Stelle, Nr 13 offen', () => {
  assert.match(liVon('lv-s1'), /^<li id="lv-s1" tabindex="-1"><details class="lv-e"><summary>[\s\S]*<span class="nm">Auftrag<\/span><span class="z1">Projekt: kanbanD · Karte: #247<\/span><span class="zt">23:30:00<\/span><\/summary>/);
  assert.match(liVon('lv-s2'), /<details class="lv-e sys"><summary>[\s\S]*<span class="nm">Systemhinweis<\/span>/);
  assert.match(liVon('lv-s2'), /&lt;system-reminder&gt;Lies zuerst/);
  assert.doesNotMatch(liVon('lv-s13'), /<details/);
  assert.match(liVon('lv-s13'), /Bitte weiter\./);
});

test('AK 4: der Bericht steht außerhalb der Liste — Karte mit Überschrift und Text aus Nr 15; ohne Bericht die gedämpfte Zeile', () => {
  const b = laufBerichtHtml(t1, esc);
  assert.match(b, /^<article class="lv-ber bestanden" aria-labelledby="lv-ber-t"><h2 id="lv-ber-t">Bericht<\/h2><div class="lv-text">/);
  assert.match(b, /R00229 angelegt\./);
  assert.match(b, /Commits: f9e808a6/);
  assert.doesNotMatch(t1Html, /lv-ber/);
  assert.doesNotMatch(liVon('lv-s15'), /lv-ber/);
  assert.strictEqual(ohneTags(laufBerichtHtml({ ...t1, bericht: null }, esc)), 'Kein Bericht erkannt: Keine Nachricht des Agenten enthält eine Zeile „Ergebnis:“.');
  assert.match(laufBerichtHtml({ ...t1, bericht: null }, esc), /^<p class="lv-ohne-ber">/);
  const fremd = laufBerichtHtml({ ...t1, bericht: { nr: 1, text: '<script>x</script>‮\nErgebnis: befund', ergebnis: 'befund', commits: null } }, esc);
  assert.doesNotMatch(fremd, /<script|‮/);
  assert.match(fremd, /class="lv-ber befund"/);
});

test('FA 6: ohne Dauer („Dauer unbekannt“) gibt es keinen Balken, und die Zeilen zeigen „–“', () => {
  const zeilen = [e(1, 'werkzeugaufruf', 'agent', '2026-11-21T23:40:00+01:00', '{"command":"true"}', { name: 'Bash' }), e(2, 'werkzeugergebnis', 'werkzeug', 'Exit code 0')];
  const html = laufHtml(zeilen, false, esc);
  assert.doesNotMatch(html, /<i class="w"/);
  assert.match(html, /<span class="vh">Dauer unbekannt<\/span>/);
});

// R00234 B1211: „Längste Schritte“ als Knöpfe mit data-act, die zur Zeile springen — nie ein Verweis auf den Hash (ADR-0029).
const { laufTopHtml } = require('../../web/lauf.js');

test('AK 9: Längste Schritte von T1 — drei Knöpfe der Reihe nach, je mit Ziel lv-s…, ohne href; ohne Dauer keine Liste', () => {
  const html = laufTopHtml(t1, esc);
  assert.match(html, /^<section class="lv-gl" aria-labelledby="lv-top-t"><h2 id="lv-top-t">Längste Schritte<\/h2><ol class="lv-top">/);
  const knoepfe = [...html.matchAll(/<button type="button" id="(lv-top-\d)" data-act="lauf-springe" data-arg="([^"]+)"><span class="was">([^<]*)<\/span><span class="d">([^<]*)<\/span><\/button>/g)].map(m => m.slice(1));
  assert.deepStrictEqual(knoepfe, [
    ['lv-top-1', 'lv-s13-vor', 'wartet · vor Nachricht von Mensch', '1 min 5 s'],
    ['lv-top-2', 'lv-s15-vor', 'denkt · vor SubagentHandback R00229 angelegt.', '38 s'],
    ['lv-top-3', 'lv-s3-vor', 'denkt · vor Bash ls Anforderungen | tail -2', '21 s'],
  ]);
  assert.doesNotMatch(html, /href/);
  assert.strictEqual(laufTopHtml({ ...t1, top3: [] }, esc), '');
  const schritt = laufTopHtml({ ...t1, top3: [{ art: 'werkzeug', nr: 7, schritt: true, dauer: 2500, was: 'Read <a.md>' }] }, esc);
  assert.match(schritt, /data-arg="lv-s7"><span class="was">Read &lt;a.md&gt;<\/span><span class="d">2 s<\/span>/);
});
