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
  // R00240: der Aufruf steht im eigenen Block „Aufruf“ (kein JSON: wie heute als pre), das Ergebnis darunter in „Ergebnis“
  assert.match(w2, /<div class="lv-auf"><span class="k">Aufruf<\/span><pre>Anforderungen\/R00219.md<\/pre><\/div><div class="lv-erg"><span class="k">Ergebnis<\/span><pre>---\nid: R00219\nstatus: Neu<\/pre><\/div>/, 'aufgeklappt beide Texte in Mono, kein Markdown');
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
  // R00240 FA 11: das „…“ von kanbanD steht in einem eigenen Element
  const kuerzelText = /<span class="eg">([^<]*)<span class="lv-ell"[^>]*><span aria-hidden="true">…<\/span>/.exec(html)[1];
  assert.strictEqual(kuerzelText, 'a'.repeat(200));
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
  assert.deepStrictEqual(kennzahlen(html).map(k => [k[0], k[1]]), [['Ergebnis', 'bestanden'], ['Werkzeugaufrufe', '6'], ['Fehler erkannt', '2'], ['Commits', '1'], ['Kosten', '1,79 $'], ['Tokens', '–']], 'R00238: Tokens dahinter');
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
  assert.deepStrictEqual(k, [['Ergebnis', '–', 'kein Bericht erkannt'], ['Werkzeugaufrufe', '1', '1'], ['Fehler erkannt', '0', '0'], ['Commits', '–', 'kein Bericht erkannt'], ['Kosten', '–', 'kein Kosteneintrag'], ['Tokens', '–', 'Tokens unbekannt']], 'R00238: Tokens dahinter');
});

test('AK 2, AK 3: ohne gelesene Einträge „–“ mit „wird gelesen“ bzw. „nicht verfügbar“; Kosten bleiben aus der Karte', () => {
  for (const [zustand, lesetext] of [['liest', 'wird gelesen'], ['ohne', 'nicht verfügbar']]) {
    const html = laufKopfHtml({ zustand, auswertung: null, kosten: { amount: 0.42, currency: 'USD' } }, esc);
    assert.deepStrictEqual([sichtbar(gesamtdauer(html)), vorgelesen(gesamtdauer(html))], ['Gesamtdauer–', `Gesamtdauer${lesetext}`], zustand);
    const tokensLesetext = zustand === 'liest' ? 'wird gelesen' : 'Tokens unbekannt';
    assert.deepStrictEqual(kennzahlen(html), [...['Ergebnis', 'Werkzeugaufrufe', 'Fehler erkannt', 'Commits'].map(n => [n, '–', lesetext]), ['Kosten', '0,42 $', '0,42 $'], ['Tokens', '–', tokensLesetext]], `${zustand} (R00238: Tokens dahinter)`);
    assert.doesNotMatch(html, /aria-label/);
  }
});

test('FA 4: Ergebnis befund und blockiert tragen ihre Form; Commits ohne Zeile „Commits:“ ist „–“ mit „nicht verfügbar“', () => {
  const html = ergebnis => laufKopfHtml({ zustand: 'eintraege', auswertung: { ...t1, bericht: { nr: 1, text: '', ergebnis, commits: null } }, kosten: null }, esc);
  assert.match(html('befund'), /<span class="erg warn">[\s\S]*befund<\/span>/);
  assert.match(html('blockiert'), /<span class="erg fehl">[\s\S]*blockiert<\/span>/);
  assert.deepStrictEqual(kennzahlen(html('befund'))[3], ['Commits', '–', 'nicht verfügbar']);
});

/* ── R00238 B1240: Kennzahl „Tokens“ rechts neben „Kosten“ (FA 4; ADR-0041 N3 Punkt 2, Variante K1) ── */

const { T8 } = require('../tests/laufansicht-t8');
const T8_ZEILEN = T8.map((o, i) => ({ nr: i + 1, eintrag: require('../../web/lauf.js').eintragPruefen(JSON.parse(JSON.stringify(o))) }));
const t8 = laufAuswerten(T8_ZEILEN, false);
/** Die Kennzahl „Tokens“: [Wert sichtbar, Wert vorgelesen, Zeilen darunter]. */
function tokensFeld(html) {
  const div = /<div class="([^"]*)"><dt>Tokens<\/dt><dd>([\s\S]*?)<\/dd><\/div>/.exec(html);
  const wert = /<span class="tw">([\s\S]*?)<\/span>(?=<span class="auf">|$)/.exec(div[2])[1];
  const auf = [...div[2].matchAll(/<span class="auf">([^<]*)<\/span>/g)].map(m => m[1]);
  return { klasse: div[1], sichtbar: sichtbar(wert), vorgelesen: vorgelesen(wert), auf };
}

test('R00238 AK 3: T8 ohne Kosteneintrag — „Tokens“ als letzte Kennzahl rechts neben „Kosten“, „239 Tsd.“ vorgelesen „239 Tausend“, darunter „aus dem Transkript gezählt“', () => {
  const html = laufKopfHtml({ zustand: 'eintraege', auswertung: t8, kosten: null }, esc);
  assert.deepStrictEqual(kennzahlen(html).map(k => k[0]).slice(-2), ['Kosten', 'Tokens']);
  assert.deepStrictEqual(tokensFeld(html), { klasse: '', sichtbar: '239 Tsd.', vorgelesen: '239 Tausend', auf: ['aus dem Transkript gezählt'] });
  assert.doesNotMatch(html, /aria-label/);
});

test('R00238 AK 3: ein Kosteneintrag mit tokens geht vor dem Transkript, ohne Satz — auch beim Lesen und wenn das Transkript fehlt', () => {
  const kosten = { amount: 0.95, currency: 'USD', tokens: 1234567 };
  for (const [zustand, auswertung] of [['eintraege', t8], ['liest', null], ['ohne', null]]) {
    assert.deepStrictEqual(tokensFeld(laufKopfHtml({ zustand, auswertung, kosten }, esc)), { klasse: '', sichtbar: '1,2 Mio.', vorgelesen: '1,2 Millionen', auf: [] }, zustand);
  }
  assert.deepStrictEqual(tokensFeld(laufKopfHtml({ zustand: 'ohne', auswertung: null, kosten: { amount: 0.42, currency: 'USD', tokens: 52000 } }, esc)).sichtbar, '52 Tsd.');
  assert.deepStrictEqual(tokensFeld(laufKopfHtml({ zustand: 'eintraege', auswertung: t8, kosten: { amount: 0.42, currency: 'USD', tokens: 0 } }, esc)).sichtbar, '0', '0 gebuchte Tokens sind ein Wert');
});

test('R00238 AK 3: Kosteneintrag ohne tokens oder mit falschem Wert — Summe aus dem Transkript mit Satz; an der Grenze „mindestens“', () => {
  for (const tokens of [null, undefined, -5, 1.5, '7', 2 ** 53]) {
    const html = laufKopfHtml({ zustand: 'eintraege', auswertung: t8, kosten: { amount: 0.95, currency: 'USD', tokens } }, esc);
    assert.deepStrictEqual(tokensFeld(html).sichtbar, '239 Tsd.', String(tokens));
  }
  const grenze = laufKopfHtml({ zustand: 'eintraege', auswertung: { ...t8, grenze: true }, kosten: null }, esc);
  assert.deepStrictEqual(tokensFeld(grenze), { klasse: '', sichtbar: 'mindestens 239 Tsd.', vorgelesen: 'mindestens 239 Tausend', auf: ['aus dem Transkript gezählt bis zur Grenze des Transkripts'] });
});

test('R00238 AK 3: ohne beides „–“ mit „Tokens unbekannt“, beim Lesen „wird gelesen“ — das Zeichen aria-hidden, kein aria-label', () => {
  const faelle = [['eintraege', t1, KOSTEN, 'Tokens unbekannt'], ['liest', null, null, 'wird gelesen'], ['liest', null, KOSTEN, 'wird gelesen'], ['ohne', null, KOSTEN, 'Tokens unbekannt']];
  for (const [zustand, auswertung, kosten, lesetext] of faelle) {
    const html = laufKopfHtml({ zustand, auswertung, kosten }, esc);
    assert.deepStrictEqual(tokensFeld(html), { klasse: 'ohne', sichtbar: '–', vorgelesen: lesetext, auf: [] }, zustand);
    assert.match(html, /<dt>Tokens<\/dt><dd><span class="tw"><span class="lv-leerwert" aria-hidden="true">–<\/span><span class="vh">/);
    assert.doesNotMatch(html, /aria-label/);
  }
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
  // R00240: Bash als Shell-Block ohne description im Block „Aufruf“, das Ergebnis darunter
  assert.match(z, /<div class="lv-auf"><span class="k">Aufruf<\/span><pre class="lv-sh">ls Anforderungen \| tail -2<\/pre><\/div><div class="lv-erg"><span class="k">Ergebnis<\/span><pre>R00228-wackler-unter-last.md\nR00229-frei.md<\/pre><\/div>/);
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
  // R00238: hinter der Dauer liest sich die Token-Angabe (ohne tokens im Transkript „Tokens unbekannt“)
  assert.strictEqual(summaryName(liVon('lv-s5')), 'Bashgrep -n kd-muted web/laeufe.jsFehler: Exit code 11 sTokens unbekannt');
  assert.strictEqual(summaryName(liVon('lv-s8')), 'Readparallelb.mdFehler: &lt;tool_use_error&gt;File does not exist.&lt;/tool_use_error&gt;3 sTokens unbekannt');
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

/* ── R00238 B1241: Token-Angabe je Zeile, vier Werte aufgeklappt und unter der Nachricht (FA 6, FA 7; N3 Punkt 3, N3.1) ── */

const t8Li = eintraegeVon(laufHtml(T8_ZEILEN, false, esc, t8));
const t8Von = id => t8Li.find(li => li.startsWith(`<li id="${id}"`));
const angabeVon = li => (/<span class="tk">([\s\S]*?)<\/span>(?=<\/div>|<\/summary>)/.exec(li) || [null, null])[1];

test('R00238 AK 4: T8 — neue Tokens an den Trägern 2, 5, 7, 12; gekürzt mit Lesefassung, 451 nur einmal', () => {
  assert.deepStrictEqual(['lv-s2', 'lv-s5', 'lv-s7', 'lv-s12'].map(id => [sichtbar(angabeVon(t8Von(id))), vorgelesen(angabeVon(t8Von(id)))]), [
    ['18 Tsd. neue Tokens', '18 Tausend neue Tokens'], ['35 Tsd. neue Tokens', '35 Tausend neue Tokens'], ['451 neue Tokens', '451 neue Tokens'], ['61 Tsd. neue Tokens', '61 Tausend neue Tokens']]);
  assert.match(t8Von('lv-s2'), /<div class="lv-wer"><span>Agent<\/span><span class="mono">10:00:05<\/span><span class="tk">/, 'an der Nachricht rechts in der Kopfzeile');
});

test('R00238 AK 4: T8 — Nr 3 verweist auf die Antwort darüber, Nr 9 „Tokens unbekannt“; Nr 1, 11, Wartezeile und Ergebnisse ohne Angabe', () => {
  assert.deepStrictEqual([sichtbar(angabeVon(t8Von('lv-s3'))), vorgelesen(angabeVon(t8Von('lv-s3')))], ['–', 'Tokens in der Antwort darüber gezählt']);
  assert.deepStrictEqual([sichtbar(angabeVon(t8Von('lv-s9'))), vorgelesen(angabeVon(t8Von('lv-s9')))], ['–', 'Tokens unbekannt']);
  for (const id of ['lv-s1', 'lv-s11', 'lv-s11-vor']) assert.doesNotMatch(t8Von(id), /class="tk"/, id);
  assert.strictEqual(t8Li.filter(li => li.includes('class="tk"')).length, 6, 'genau die sechs Zeilen von agent');
  assert.doesNotMatch(t8Li.join(''), /aria-label/);
});

test('R00238 AK 4: in der Werkzeugzeile steht die Angabe nach der Dauer (DOM wie bei 641–980 px untereinander)', () => {
  assert.match(t8Von('lv-s5'), /<span class="du"><span>1 s<\/span>[\s\S]*?<\/span><span class="tk">[\s\S]*?<\/span><\/summary>/);
});

test('R00238 AK 4: aufgeklappt vor „Aufruf“ die Überschrift „Tokens“ mit den vier Werten voll, nur am Träger', () => {
  const ganz = /<div class="lv-s-ganz">([\s\S]*?)<\/div>/.exec(t8Von('lv-s5'))[1];
  assert.match(ganz, /^<span class="k">Tokens<\/span><p class="lv-tk4">[\s\S]*?<\/p><div class="lv-auf"><span class="k">Aufruf<\/span>/, 'R00240: Aufruf im eigenen Block');
  const werte = /<p class="lv-tk4">([\s\S]*?)<\/p>/.exec(ganz)[1];
  assert.strictEqual(sichtbar(werte), 'Eingabe 1 · Cache-Schreiben 34.800 · Ausgabe 300 · Cache-Lesen 18.000');
  assert.strictEqual(vorgelesen(werte), 'Eingabe 1, Cache-Schreiben 34.800, Ausgabe 300, Cache-Lesen 18.000');
  for (const id of ['lv-s3', 'lv-s9']) assert.doesNotMatch(t8Von(id), /lv-tk4/, id);
});

test('R00238 AK 5: unter einer Nachricht von agent mit tokens immer die Zeile „Tokens“ mit vier Werten, außerhalb jeder Klappe', () => {
  const zeile = li => /<p class="lv-tokens">([\s\S]*?)<\/p>/.exec(li);
  assert.strictEqual(sichtbar(zeile(t8Von('lv-s2'))[1]), 'Tokens Eingabe 3 · Cache-Schreiben 18.000 · Ausgabe 120 · Cache-Lesen 0');
  assert.strictEqual(vorgelesen(zeile(t8Von('lv-s2'))[1]), 'Tokens Eingabe 3, Cache-Schreiben 18.000, Ausgabe 120, Cache-Lesen 0');
  assert.strictEqual(sichtbar(zeile(t8Von('lv-s12'))[1]), 'Tokens Eingabe 2 · Cache-Schreiben 60.000 · Ausgabe 1.500 · Cache-Lesen 53.200');
  assert.match(t8Von('lv-s2'), /<div class="lv-text">[\s\S]*<\/div><p class="lv-tokens">/, 'unter dem Text');
  assert.doesNotMatch(t8Von('lv-s2'), /<details/, 'ohne Aufklappen');
  for (const id of ['lv-s1', 'lv-s11', 'lv-s5', 'lv-s7']) assert.doesNotMatch(t8Von(id), /lv-tokens/, id);
  const zweite = eintraegeVon(laufHtml([e(1, 'nachricht', 'agent', 'a', { tokens: { ein: 1, aus: 0, cache_lesen: 0, cache_schreiben: 0 } }), e(2, 'nachricht', 'agent', 'b', { tokens: null })], false, esc));
  assert.match(zweite[0], /lv-tokens/);
  assert.doesNotMatch(zweite[1], /lv-tokens/, 'eine Nachricht ohne eigenes tokens als zweite in einer Antwort');
  assert.strictEqual(vorgelesen(angabeVon(zweite[1])), 'Tokens in der Antwort darüber gezählt');
});

test('R00238 AK 4 · US-5: T1 ohne tokens — jede Zeile von agent „–“ mit „Tokens unbekannt“, sonst keine Angabe, keine Zeile „Tokens“', () => {
  const mitAngabe = t1Li.filter(li => li.includes('class="tk"')).map(li => /^<li id="([^"]+)"/.exec(li)[1]);
  assert.deepStrictEqual(mitAngabe, ['lv-s3', 'lv-s5', 'lv-s7', 'lv-s8', 'lv-s11', 'lv-s14', 'lv-s15']);
  for (const id of mitAngabe) assert.deepStrictEqual([sichtbar(angabeVon(liVon(id))), vorgelesen(angabeVon(liVon(id)))], ['–', 'Tokens unbekannt'], id);
  assert.doesNotMatch(t1Html, /lv-tokens|lv-tk4/);
});

/* ── R00238 B1242: „Teuerste Schritte“ aus derselben Listenfunktion wie „Längste Schritte“ (FA 8; N3 Punkte 4, 6) ── */

const ERKLAERSATZ = 'Gezählt sind die neuen Tokens je Antwort: Eingabe, Cache-Schreiben und Ausgabe. Den schon vorhandenen Kontext (Cache-Lesen) trägt jede Antwort, er zählt hier nicht.';
const teuerKnoepfe = html => [...html.matchAll(/<button type="button" id="(lv-teu-\d)" data-act="lauf-springe" data-arg="([^"]+)" aria-labelledby="([^"]+)">([\s\S]*?)<\/button>/g)].map(m => {
  const name = new RegExp(`<span class="vh" id="${m[3]}">([^<]*)</span>`).exec(m[4]);
  const inhalt = m[4].replace(/<span class="vh" id="[^"]+">[^<]*<\/span>$/, '');
  const teil = muster => { const t = muster.exec(inhalt); return t ? sichtbar(t[1]) : null; };
  return { id: m[1], ziel: m[2], name: name && name[1], was: teil(/<span class="was">([^<]*)<\/span>/), nach: teil(/<span class="nach">([^<]*)<\/span>/), wert: teil(/<span class="d">([\s\S]*)<\/span>$/) };
});

test('R00238 AK 6, AK 8: T8 — „Teuerste Schritte“ unter „Längste Schritte“ im selben Abschnitt, mit Erklärsatz und aria-describedby', () => {
  const html = laufTopHtml(t8, esc);
  assert.match(html, /^<section class="lv-gl" aria-labelledby="lv-top-t lv-teu-t"><h2 id="lv-top-t">Längste Schritte<\/h2><ol class="lv-top">[\s\S]*?<\/ol><h2 id="lv-teu-t">Teuerste Schritte<\/h2>/);
  assert.ok(html.includes(`<p class="lv-erkl" id="lv-teu-erkl">${ERKLAERSATZ}</p><ol class="lv-teu" aria-describedby="lv-teu-erkl">`));
  assert.match(html, /<\/ol><\/section>$/);
});

test('R00238 AK 6, AK 8: T8 — drei Knöpfe zur Trägerzeile, Beschriftung, „nach …“, Wert; zugänglicher Name mit Kommata und Lesefassung', () => {
  assert.deepStrictEqual(teuerKnoepfe(laufTopHtml(t8, esc)), [
    { id: 'lv-teu-1', ziel: 'lv-s12', name: 'Nachricht von Agent, 61 Tausend neue Tokens, nach 5 min 17 s Warten', was: 'Nachricht von Agent', nach: 'nach 5 min 17 s Warten', wert: '61 Tsd. neue Tokens' },
    { id: 'lv-teu-2', ziel: 'lv-s5', name: 'Bash grep -n tokens web/lauf.js, 35 Tausend neue Tokens, nach Read regeln.md', was: 'Bash grep -n tokens web/lauf.js', nach: 'nach Read regeln.md', wert: '35 Tsd. neue Tokens' },
    { id: 'lv-teu-3', ziel: 'lv-s2', name: 'Read regeln.md, 18 Tausend neue Tokens', was: 'Read regeln.md', nach: null, wert: '18 Tsd. neue Tokens' },
  ]);
  assert.doesNotMatch(laufTopHtml(t8, esc), /href|aria-label=/);
});

test('R00238 FA 8: ohne tokens keine Liste (T1 unverändert); ohne Dauer nur „Teuerste Schritte“; fremder Text maskiert; Einzahl', () => {
  assert.doesNotMatch(laufTopHtml(t1, esc), /lv-teu|Teuerste/);
  const nurTeuer = laufTopHtml({ ...t8, top3: [] }, esc);
  assert.match(nurTeuer, /^<section class="lv-gl" aria-labelledby="lv-teu-t"><h2 id="lv-teu-t">Teuerste Schritte<\/h2>/);
  assert.doesNotMatch(nurTeuer, /lv-top/);
  assert.strictEqual(laufTopHtml({ ...t8, top3: [], teuer3: [] }, esc), '');
  const fremd = teuerKnoepfe(laufTopHtml({ ...t8, top3: [], teuer3: [{ nr: 4, neu: 1, was: 'Read <b>x</b>', nach: 'nach Bash <i>' }] }, esc));
  assert.deepStrictEqual(fremd, [{ id: 'lv-teu-1', ziel: 'lv-s4', name: 'Read &lt;b&gt;x&lt;/b&gt;, 1 neues Token, nach Bash &lt;i&gt;', was: 'Read &lt;b&gt;x&lt;/b&gt;', nach: 'nach Bash &lt;i&gt;', wert: '1 neues Token' }]);
});

/* ── R00240 (Karte #261, C1 „Satz“): der gesetzte Schritt an T13 — Aufruf abgesetzt, Ergebnis darunter, Zusammenfassung ── */

const lauf240 = require('../../web/lauf.js');
const t13 = require('../tests/laufansicht-t13.js');
const t13Zeilen = (liste = t13.T13) => liste.map((eintrag, i) => ({ nr: i + 1, eintrag: lauf240.eintragPruefen(eintrag) }));
const zeileVon = (html, nr) => eintraegeVon(html).find(li => li.startsWith(`<li id="lv-s${nr}"`));
const lesbar = html => ohneTags(html).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

test('R00240 AK 1: Nr 2 — Block „Aufruf“ mit dem Wort als erstem Kind, Shell-Block, timeout, darunter „Ergebnis“ mit der Testzeile', () => {
  const li = zeileVon(laufHtml(t13Zeilen(), false, esc), 2);
  // R00242: /w/demo ist die Wurzel „Projekt“ aus Nr 1 und steht im Befehl als Marke ‹demo› mit dem vollen Pfad im title
  const marke = '<span class="lv-pfadt" title="/w/demo"><span class="lv-mk" data-marke="‹demo›"><span class="vh">/w/demo</span></span></span>';
  assert.ok(li.includes(`<div class="lv-s-ganz"><div class="lv-auf"><span class="k">Aufruf</span><pre class="lv-sh">cd ${marke} &amp;&amp;\n npm test;\n echo`), li);
  assert.match(li, /<dl class="lv-kv"><dt>timeout:<\/dt><dd>120000<\/dd><\/dl><\/div><div class="lv-erg"><span class="k">Ergebnis<\/span><p class="lv-tz fehl">/);
  assert.doesNotMatch(/<div class="lv-auf">[\s\S]*?<\/div><div class="lv-erg">/.exec(li)[0], /Tests fahren/);
});

test('R00240 AK 1: ohne Ergebnis gedämpft „Kein Ergebnis im Transkript.“, Ergebnis "" und " \\n " je „Leeres Ergebnis.“', () => {
  const aufruf = e(1, 'werkzeugaufruf', 'agent', '{"command":"ls"}', { name: 'Bash' });
  assert.match(laufHtml([aufruf], false, esc), /<\/div><p class="lv-gedaempft">Kein Ergebnis im Transkript\.<\/p><\/div><\/details>/);
  for (const text of ['', ' \n ']) {
    const html = laufHtml([aufruf, e(2, 'werkzeugergebnis', 'werkzeug', text)], false, esc);
    assert.match(html, /<div class="lv-erg"><span class="k">Ergebnis<\/span><p class="lv-gedaempft">Leeres Ergebnis\.<\/p><\/div>/, JSON.stringify(text));
  }
  assert.doesNotMatch(laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', 'x')], false, esc), /lv-auf|Kein Ergebnis/, 'ein Ergebnis ohne Aufruf hat keinen Block „Aufruf“');
});

test('R00240 AK 9: Rückfall auf pre über 64 KiB, über 2.000 Zeilen und über dem Zeichenbudget — erstes Kind ist „Aufruf“, kein <a', () => {
  const gross = JSON.stringify({ query: 'q'.repeat(65536) });
  const lang = '{\n' + Array.from({ length: 2000 }, (_, i) => `"k${i}":1,`).join('\n') + '\n"e":1}';
  const budget = JSON.stringify({ query: '‮'.repeat(1001) });
  for (const text of [gross, lang, budget]) {
    const html = laufHtml([e(1, 'werkzeugaufruf', 'agent', text, { name: 'X' })], false, esc);
    assert.match(html, /<div class="lv-auf"><span class="k">Aufruf<\/span><pre>/, text.slice(0, 30));
    assert.doesNotMatch(html, /lv-kv|lv-json/);
  }
  // R00242: Pfade in Nachrichten und im Pfadfeld sind Links nach VS Code; ein anderer Link entsteht weiter nicht
  const links = laufHtml(t13Zeilen(), false, esc).match(/<a[\s>][^>]*>/g);
  assert.ok(links.length > 0);
  for (const a of links) assert.match(a, /^<a class="lv-pfad" href="vscode:\/\/file\//, a);
});

test('R00240 AK 6, AK 9: Nr 5 — Zusammenfassung „Von Claude Code gekürzt“ mit Symbol ohne Größe, nirgends <persisted-output>, Fehlerform, Kopf 1 Fehler', () => {
  const a = lauf240.laufAuswerten(t13Zeilen(), false);
  const li = zeileVon(laufHtml(t13Zeilen(), false, esc, a), 4);
  const summary = /<summary>[\s\S]*?<\/summary>/.exec(li)[0];
  assert.match(summary, /<span class="eg"><svg[\s\S]*?<\/svg><span class="vh">Fehler: <\/span><span class="lv-cck"><svg[^>]*aria-hidden="true"[\s\S]*?<\/svg>Von Claude Code gekürzt<\/span><\/span>/);
  assert.doesNotMatch(summary, /69,9/);
  assert.doesNotMatch(li, /persisted-output/);
  assert.match(li, /class="lv-s fehl/);
  assert.strictEqual(a.kennzahlen.fehler, 1);
  assert.strictEqual(lauf240.fehlerErkennen(t13.ERGEBNIS_5), true);
  assert.strictEqual(lauf240.fehlerErkennen(t13.ERGEBNIS_5.replace('Exit code 1', 'Exit code 0')), false);
});

test('R00240 AK 8: Nr 4 — der Befehl endet nach 200 Zeichen auf ein eigenes „…“ mit Tooltip und Lesetext; ein „…“ im Text bleibt Text', () => {
  const li = zeileVon(laufHtml(t13Zeilen(), false, esc), 4);
  const ell = '<span class="lv-ell" title="Von kanbanD gekürzt, vollständig im aufgeklappten Schritt"><span aria-hidden="true">…</span><span class="vh">Von kanbanD gekürzt, vollständig im aufgeklappten Schritt</span></span>';
  assert.ok(li.includes(`<span class="bf">echo ${'a'.repeat(195)}${ell}</span>`), 'Befehl mit dem „…“ von kanbanD');
  const imText = laufHtml([e(1, 'werkzeugaufruf', 'agent', '{"command":"echo …"}', { name: 'Bash' })], false, esc);
  assert.match(imText, /<span class="bf">echo …<\/span>/);
  const ersteZeile = laufHtml([e(1, 'werkzeugergebnis', 'werkzeug', 'r'.repeat(250))], false, esc);
  assert.ok(ersteZeile.includes(`<span class="eg">${'r'.repeat(200)}${ell}</span>`), 'erste Zeile des Ergebnisses');
});

test('R00240 AK 7: Nr 10 — Zusammenfassung gedämpft „Systemhinweis“; Nr 12 trägt den Hinweis eingebettet in der Nachricht', () => {
  const html = laufHtml(t13Zeilen(), false, esc);
  assert.match(/<summary>[\s\S]*?<\/summary>/.exec(zeileVon(html, 10))[0], /<span class="eg"><span class="lv-syseg">Systemhinweis<\/span><\/span>/);
  const n12 = zeileVon(html, 12);
  assert.match(n12, /<p>Bitte weiter\.<\/p>[\s\S]*<details class="lv-e sys lv-ein"><summary>[\s\S]*Systemhinweis[\s\S]*<pre>&lt;system-reminder&gt;\nTodo-Liste leer\.\n&lt;\/system-reminder&gt;<\/pre><\/details>/);
  assert.match(zeileVon(html, 6), /<pre>Datei geändert\.<\/pre><details class="lv-e sys lv-ein">/);
});

test('R00240 FA 10 Ansage: nach „Systemhinweise“ die eingebetteten in den sichtbaren Zeilen; e = 1 Einzahl, e = 0 und andere Kästchen ohne Zusatz', () => {
  const arten = lauf240.laufAuswerten(t13Zeilen(), false).zeilenArten;
  const f = (n, w, h, nurF) => ({ n, w, h, f: nurF });
  const ein = lauf240.laufAuswerten(t13Zeilen(), false).eingebettet;
  const satzAn = lauf240.laufFilterAnsage(arten, f(true, true, true, false), 'h', ein);
  const satzAus = lauf240.laufFilterAnsage(arten, f(true, true, false, false), 'h', ein);
  assert.strictEqual(satzAn, `${lauf240.laufFilterAnsage(arten, f(true, true, true, false))}`.replace(/\.$/, ', 3 eingebettete Systemhinweise sichtbar.'));
  assert.match(satzAn, /^\d+ von \d+ Einträgen sichtbar, 3 eingebettete Systemhinweise sichtbar\.$/);
  assert.match(satzAus, /^\d+ von \d+ Einträgen sichtbar, 3 eingebettete Systemhinweise ausgeblendet\.$/);
  assert.match(lauf240.laufFilterAnsage(arten, f(false, true, true, false), 'h', ein), /, 2 eingebettete Systemhinweise sichtbar\.$/, 'nur die Werkzeugzeilen Nr 6 und Nr 10');
  assert.match(lauf240.laufFilterAnsage(arten, f(true, false, true, false), 'h', ein), /, 1 eingebetteter Systemhinweis sichtbar\.$/);
  assert.strictEqual(lauf240.laufFilterAnsage(arten, f(true, true, true, false), 'n', ein), lauf240.laufFilterAnsage(arten, f(true, true, true, false)));
  const ohne = lauf240.laufAuswerten(G, false).zeilenArten;
  assert.strictEqual(lauf240.laufFilterAnsage(ohne, f(true, true, true, false), 'h', lauf240.laufAuswerten(G, false).eingebettet), lauf240.laufFilterAnsage(ohne, f(true, true, true, false)));
  assert.strictEqual(lauf240.laufFilterAnsage(arten, f(false, false, true, false), 'h', ein), 'Keine Einträge sichtbar.');
  assert.strictEqual(lauf240.laufAuswerten(t13Zeilen(t13.T13F), false).eingebettet.fehler, 1);
});

test('R00240 AK 8: „Längste Schritte“ mit der Absicht als Titel und dem Befehl gedämpft darunter, ohne Absicht der Befehl allein', () => {
  const a = lauf240.laufAuswerten(t13Zeilen(), false);
  const html = lauf240.laufTopHtml(a, esc);
  const knoepfe = /<ol class="lv-top">([\s\S]*?)<\/ol>/.exec(html)[1].split('</li>').filter(Boolean);
  assert.strictEqual(knoepfe.length, 3);
  assert.match(knoepfe[0], /<span class="was zw"><span class="wt">Tests fahren<\/span><span class="bf2">Bash cd \/w\/demo &amp;&amp; npm test; echo/);
  assert.match(knoepfe[0], /<span class="d">40 s<\/span>/);
  assert.match(knoepfe[1], /<span class="wt">Protokoll lesen<\/span><span class="bf2">Bash echo a+<span class="lv-ell"/);
  assert.match(knoepfe[1], /<span class="d">30 s<\/span>/);
  assert.match(knoepfe[2], /<span class="was">Write \/w\/demo\/b\.txt<\/span><span class="d">20 s<\/span>/);
  assert.doesNotMatch(knoepfe[2], /bf2/);
});

test('R00240 AK 8: „Teuerste Schritte“ beschriftet mit der Absicht und nennt in „nach <Schritt>“ die Absicht des Schritts davor', () => {
  const tk = { ein: 1, aus: 1, cache_lesen: 0, cache_schreiben: 1 };
  const zeilen = [
    e(1, 'werkzeugaufruf', 'agent', '{"command":"ls","description":"Ordner ansehen"}', { name: 'Bash', tokens: tk }),
    e(2, 'werkzeugergebnis', 'werkzeug', 'a'),
    e(3, 'werkzeugaufruf', 'agent', '{"command":"cat a","description":"Datei lesen"}', { name: 'Bash', tokens: { ...tk, aus: 5 } }),
    e(4, 'werkzeugergebnis', 'werkzeug', 'b'),
  ];
  const html = lauf240.laufTopHtml(lauf240.laufAuswerten(zeilen, false), esc);
  const teuer = /<ol class="lv-teu"[^>]*>([\s\S]*?)<\/ol>/.exec(html)[1];
  assert.match(teuer, /<span class="was zw"><span class="wt">Datei lesen<\/span><span class="bf2">Bash cat a<\/span><\/span><span class="nach">nach Ordner ansehen<\/span>/);
  assert.match(teuer, /<span class="vh" id="lv-teu-1-n">Datei lesen, [^<]*, nach Ordner ansehen<\/span>/);
});
