// Strukturprüfung jeder Ausgabe des Markdowns (ADR-0030 Punkte 2 und 3): nur Marken der festen Liste, an `a` genau
// `href`, `target`, `rel` in fester Form. Fängt die Klasse „eine spätere Ersetzungsstufe trifft die Marke einer früheren“.
const assert = require('node:assert');

const LINK = /<a href="[^"<>]*" target="_blank" rel="noopener">/g;
const FESTE_MARKEN = /<\/?(?:p|h[2-6]|ul|ol|li|blockquote|pre|code|strong|em|a)>|<br>/g;
const kurz = text => JSON.stringify(text.length > 160 ? text.slice(0, 160) + '…' : text);
const zahl = (text, muster) => (text.match(muster) || []).length;

/** Wirft, wenn `html` etwas anderes enthält als maskierten Text und Marken der festen Liste. */
function pruefeStruktur(html, eingabe = '') {
  const ohneMarken = html.replace(LINK, '').replace(FESTE_MARKEN, '');
  const fremd = /[<>"]/.exec(ohneMarken);
  assert.ok(!fremd, `STRUKTUR: fremde Marke oder offenes Attribut bei ${kurz(ohneMarken.slice(Math.max(0, (fremd || {}).index - 40)))} — Ausgabe ${kurz(html)} aus ${kurz(eingabe)}`);
  assert.ok(!/<a>/.test(html), `STRUKTUR: Link ohne Adresse in ${kurz(html)}`);
  assert.strictEqual(zahl(html, /<a\b/g), zahl(html, /<\/a>/g), `STRUKTUR: öffnende und schließende Link-Marken ungleich in ${kurz(html)} aus ${kurz(eingabe)}`);
}

module.exports = { pruefeStruktur };
