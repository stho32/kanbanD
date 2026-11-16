// Strukturprüfung jeder Ausgabe des Markdowns (ADR-0030 Punkte 2 und 3): nur Marken der festen Liste, an `a` genau
// `href`, `target`, `rel` in fester Form, an `th` und `td` höchstens eine der drei festen Klassen der Ausrichtung, die Hülle
// der Tabelle nur in ihrer einen festen Form. Fängt die Klasse „eine spätere Ersetzungsstufe trifft die Marke einer früheren“.
// Seit R00178 dazu die Schachtelung: jede Marke schließt, was sie geöffnet hat; `li` steht nur in `ul`/`ol`, eine Liste nur
// ganz außen oder direkt in einem `li`, `hr` nur ganz außen und ohne Attribut.
const assert = require('node:assert');

const LINK = /<a href="[^"<>]*" target="_blank" rel="noopener">/g;
const FESTE_MARKEN = /<\/?(?:p|h[2-6]|ul|ol|li|blockquote|pre|code|strong|em|del|a|thead|tbody|tr|th|td)>|<br>|<hr>/g;
/** Hülle und Tabelle gibt es nur als Paar; `tabindex`, `role` und `aria-label` setzt der Renderer, nie der Text (R00176). */
const TABELLE_AUF = /<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table>/g;
const TABELLE_ZU = /<\/table><\/div>/g;
const ZELLE_AUF = /<t[hd](?: class="ta-[lcr]")?>/g;
/** Der eine Aufbau einer Tabelle: Kopf mit einer Zeile, höchstens ein Rumpf; in einer Zelle steht nie eine Marke der Tabelle. */
const TABELLEN_MARKE = /<\/?(?:div|table|thead|tbody|tr|th|td)\b/;
const INHALT = '(?:(?!<\\/?(?:div|table|thead|tbody|tr|th|td)\\b)[^])*?';
const KLASSE = '(?: class="ta-[lcr]")?';
const TABELLE = new RegExp(`<div class="md-tab" tabindex="0" role="group" aria-label="Tabelle"><table><thead><tr>(?:<th${KLASSE}>${INHALT}</th>)+</tr></thead>(?:<tbody>(?:<tr>(?:<td${KLASSE}>${INHALT}</td>)+</tr>)+</tbody>)?</table></div>`, 'g');
const kurz = text => JSON.stringify(text.length > 160 ? text.slice(0, 160) + '…' : text);
const zahl = (text, muster) => (text.match(muster) || []).length;

/** Wirft, wenn `html` etwas anderes enthält als maskierten Text und Marken der festen Liste. */
function pruefeStruktur(html, eingabe = '') {
  const ohneMarken = html.replace(LINK, '').replace(TABELLE_AUF, '').replace(TABELLE_ZU, '').replace(ZELLE_AUF, '').replace(FESTE_MARKEN, '');
  const fremd = /[<>"]/.exec(ohneMarken);
  assert.ok(!fremd, `STRUKTUR: fremde Marke oder offenes Attribut bei ${kurz(ohneMarken.slice(Math.max(0, (fremd || {}).index - 40)))} — Ausgabe ${kurz(html)} aus ${kurz(eingabe)}`);
  assert.ok(!/<a>/.test(html), `STRUKTUR: Link ohne Adresse in ${kurz(html)}`);
  assert.strictEqual(zahl(html, /<a\b/g), zahl(html, /<\/a>/g), `STRUKTUR: öffnende und schließende Link-Marken ungleich in ${kurz(html)} aus ${kurz(eingabe)}`);
  assert.strictEqual(zahl(html, TABELLE_AUF), zahl(html, TABELLE_ZU), `STRUKTUR: öffnende und schließende Tabellen-Hüllen ungleich in ${kurz(html)} aus ${kurz(eingabe)}`);
  assert.strictEqual(zahl(html, ZELLE_AUF), zahl(html, /<\/t[hd]>/g), `STRUKTUR: öffnende und schließende Zellen ungleich in ${kurz(html)} aus ${kurz(eingabe)}`);
  pruefeTabellen(html, eingabe);
  pruefeSchachtelung(html, eingabe);
}

/** Jede Marke schließt in umgekehrter Reihenfolge des Öffnens; Listen und Trennlinie stehen nur, wo die Grammatik sie erlaubt. */
function pruefeSchachtelung(html, eingabe) {
  const LISTE = ['ul', 'ol'];
  const offen = [];
  const ort = () => `in ${kurz(html)} aus ${kurz(eingabe)}`;
  for (const [marke, schliesst, name] of html.matchAll(/<(\/?)([a-z][a-z0-9]*)\b[^>]*>/g)) {
    const aussen = offen[offen.length - 1];
    if (name === 'br') continue;
    if (name === 'hr') { assert.ok(marke === '<hr>' && !aussen, `STRUKTUR: Trennlinie mit Attribut oder nicht ganz außen (in ${aussen}) ${ort()}`); continue; }
    if (schliesst) { assert.strictEqual(offen.pop(), name, `STRUKTUR: ${marke} schließt nicht, was zuletzt geöffnet wurde, ${ort()}`); continue; }
    if (LISTE.includes(name)) assert.ok(!aussen || aussen === 'li', `STRUKTUR: Liste in ${aussen} statt ganz außen oder in einem Listenpunkt ${ort()}`);
    if (name === 'li') assert.ok(LISTE.includes(aussen), `STRUKTUR: Listenpunkt in ${aussen || 'keiner Liste'} ${ort()}`);
    offen.push(name);
  }
  assert.deepStrictEqual(offen, [], `STRUKTUR: nicht geschlossene Marken ${ort()}`);
}

/** Jede Tabelle steht in ihrer festen Form, jede Zeile hat so viele Zellen wie der Kopf und je Spalte dieselbe Klasse. */
function pruefeTabellen(html, eingabe) {
  const tabellen = html.match(TABELLE) || [];
  assert.ok(!TABELLEN_MARKE.test(html.replace(TABELLE, '')), `STRUKTUR: Marke einer Tabelle außerhalb der festen Form in ${kurz(html)} aus ${kurz(eingabe)}`);
  for (const tabelle of tabellen) {
    const zeilen = tabelle.match(/<tr>[^]*?<\/tr>/g).map(zeile => zeile.match(ZELLE_AUF));
    for (const zellen of zeilen) assert.deepStrictEqual(zellen.map(z => z.slice(3)), zeilen[0].map(z => z.slice(3)), `STRUKTUR: Zeile mit anderen Spalten als der Kopf in ${kurz(tabelle)} aus ${kurz(eingabe)}`);
  }
}

/** Die Marken einer einzelnen Zeile (`markdownInline`, ADR-0030 Punkt 7): Link, Code, fett, kursiv, durchgestrichen — nie ein Block. */
const INLINE_MARKEN = /<\/?(?:code|strong|em|del)>|<\/a>/g;

/** Wirft, wenn die Ausgabe einer Zeile etwas anderes enthält als maskierten Text und die Marken einer Zeile. */
function pruefeInlineStruktur(html, eingabe = '') {
  pruefeStruktur(html, eingabe);
  const ohneMarken = html.replace(LINK, '').replace(INLINE_MARKEN, '');
  assert.ok(!ohneMarken.includes('<'), `STRUKTUR: Block-Marke in der Ausgabe einer Zeile bei ${kurz(ohneMarken.slice(Math.max(0, ohneMarken.indexOf('<') - 40)))} — Ausgabe ${kurz(html)} aus ${kurz(eingabe)}`);
}

const ERLAUBTE_PROTOKOLLE = ['http:', 'https:', 'mailto:', 'vscode:'];

/** Liest den Wert eines Attributs, wie es der Browser täte: Entitäten werden aufgelöst. */
function attributwert(roh) {
  const BENANNT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', Tab: '\t', NewLine: '\n' };
  return roh.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi, (alles, hex, dezimal, name) => {
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    if (dezimal) return String.fromCodePoint(parseInt(dezimal, 10));
    if (name in BENANNT) return BENANNT[name];
    return alles;
  });
}

/** Die Adressen aller Links der Ausgabe; jede Link-Marke trägt genau `href`, `target` und `rel`. */
function linkAdressen(html) {
  const marken = html.match(/<a\b(?:[^>"]|"[^"]*")*>/g) || [];
  return marken.map(marke => {
    const m = /^<a href="([^"]*)" target="_blank" rel="noopener">$/.exec(marke);
    assert.ok(m, `Link-Marke mit fremdem Aufbau: ${JSON.stringify(marke.slice(0, 120))}`);
    return attributwert(m[1]);
  });
}

module.exports = { pruefeStruktur, pruefeInlineStruktur, linkAdressen, ERLAUBTE_PROTOKOLLE };
