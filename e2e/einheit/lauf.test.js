// R00221 B1143: Zeilen eines entpackten Transkripts im Strom lesen und prüfen — reine Rechnung aus web/lauf.js (ADR-0041 Punkt 4,
// „Durchsetzung“ Node-Tests; AK 2, AK 3 Node). Der Strom ist eine Folge von Byte-Stücken wie aus DecompressionStream.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { zeilenLesen, eintragPruefen, LAUF_GRENZEN } = require('../../web/lauf.js');

const bytes = text => new TextEncoder().encode(text);
async function* stuecke(...teile) { for (const t of teile) yield t; }
/** Liest alles und liefert `{eintraege: [{nr, eintrag}], grenze}`; der Schluss ist das letzte Ergebnis des Generators. */
async function lesen(strom, grenzen = LAUF_GRENZEN) {
  const eintraege = [];
  let grenze = null;
  for await (const s of zeilenLesen(strom, grenzen)) {
    if ('grenze' in s) grenze = s.grenze;
    else eintraege.push(s);
  }
  return { eintraege, grenze };
}

const G = [
  '{"zeit":"2026-11-20T10:00:41+01:00","art":"nachricht","wer":"agent","name":"entwickler","text":"Ich lese zuerst **die Anforderung**."}',
  '{"zeit":"2026-11-20T10:00:42+01:00","art":"werkzeugaufruf","wer":"agent","name":"Read","text":"Anforderungen/R00219.md"}',
  '   ',
  '{"art":"nachricht"',
  '{"zeit":"2026-11-20T09:00:43Z","art":"werkzeugergebnis","wer":"werkzeug","name":"Read","text":"---\\nid: R00219\\nstatus: Neu"}',
  '{"zeit":"gestern","art":"nachricht","wer":"mensch","text":"Passt."}',
].join('\n') + '\n';

const ERWARTET_G = [
  { nr: 1, eintrag: { art: 'nachricht', wer: 'agent', name: 'entwickler', zeit: '2026-11-20T10:00:41+01:00', text: 'Ich lese zuerst **die Anforderung**.', id: null, zu: null, tokens: null } },
  { nr: 2, eintrag: { art: 'werkzeugaufruf', wer: 'agent', name: 'Read', zeit: '2026-11-20T10:00:42+01:00', text: 'Anforderungen/R00219.md', id: null, zu: null, tokens: null } },
  { nr: 4, eintrag: null },
  { nr: 5, eintrag: { art: 'werkzeugergebnis', wer: 'werkzeug', name: 'Read', zeit: '2026-11-20T09:00:43Z', text: '---\nid: R00219\nstatus: Neu', id: null, zu: null, tokens: null } },
  { nr: 6, eintrag: { art: 'nachricht', wer: 'mensch', name: null, zeit: 'gestern', text: 'Passt.', id: null, zu: null, tokens: null } },
];

test('AK 2: Datei G ergibt fünf Einträge in Reihenfolge, Zeile 3 zählt mit, Zeile 4 defekt', async () => {
  const { eintraege, grenze } = await lesen(stuecke(bytes(G)));
  assert.deepStrictEqual(eintraege, ERWARTET_G);
  assert.strictEqual(grenze, false);
});

test('AK 2: G in Stücken — ein Stück endet auf dem \\n nach Zeile 2, ein anderes teilt ein „ü“ zwischen seinen Bytes', async () => {
  const g = bytes(G.replace('Passt.', 'Passt ü.'));
  const nachZeile2 = G.indexOf('\n', G.indexOf('\n') + 1) + 1;
  const ue = g.indexOf(0xc3);
  assert.ok(ue > nachZeile2 && g[ue + 1] === 0xbc);
  const { eintraege } = await lesen(stuecke(g.subarray(0, nachZeile2), g.subarray(nachZeile2, ue + 1), g.subarray(ue + 1, ue + 2), g.subarray(ue + 2)));
  assert.strictEqual(eintraege.length, 5);
  assert.deepStrictEqual(eintraege.map(e => e.nr), [1, 2, 4, 5, 6]);
  assert.strictEqual(eintraege[4].eintrag.text, 'Passt ü.');
  // jedes Byte einzeln
  const einzeln = await lesen(stuecke(...Array.from(g, b => Uint8Array.of(b))));
  assert.deepStrictEqual(einzeln.eintraege, eintraege);
});

test('AK 2: \\r\\n stört nicht, U+2028 trennt nicht, ein Rest ohne \\n ist die letzte Zeile', async () => {
  const zeile = t => JSON.stringify({ art: 'nachricht', wer: 'agent', text: t });
  const { eintraege, grenze } = await lesen(stuecke(bytes(`${zeile('a')}\r\n${zeile('b c')}\r\n${zeile('d')}`)));
  assert.deepStrictEqual(eintraege.map(e => [e.nr, e.eintrag && e.eintrag.text]), [[1, 'a'], [2, 'b c'], [3, 'd']]);
  assert.strictEqual(grenze, false);
  const roh = await lesen(stuecke(bytes('{"art":"nachricht","wer":"agent","text":"x"} {"art":"nachricht","wer":"agent","text":"y"}\n')));
  assert.deepStrictEqual(roh.eintraege.map(e => e.nr), [1], 'U+2028 roh zwischen zwei Objekten: eine Zeile');
});

test('AK 2: falsche art, fehlendes wer, text als Zahl → je defekt; ein unbekannter Schlüssel nicht', () => {
  const gut = { art: 'nachricht', wer: 'agent', text: 'x' };
  assert.strictEqual(eintragPruefen({ ...gut, art: 'gedanke' }), null);
  assert.strictEqual(eintragPruefen({ art: 'nachricht', text: 'x' }), null);
  assert.strictEqual(eintragPruefen({ ...gut, text: 3 }), null);
  assert.strictEqual(eintragPruefen({ ...gut, wer: 'robot' }), null);
  assert.strictEqual(eintragPruefen({ ...gut, zeit: 5 }), null, 'zeit vorhanden, aber kein Text');
  assert.strictEqual(eintragPruefen({ ...gut, name: null }), null, 'name vorhanden, aber kein Text');
  for (const kein of [null, [], 'nachricht', 7, true]) assert.strictEqual(eintragPruefen(kein), null, JSON.stringify(kein));
  assert.deepStrictEqual(eintragPruefen({ ...gut, tokens: 12, art: 'werkzeugaufruf' }), { art: 'werkzeugaufruf', wer: 'agent', text: 'x', zeit: null, name: null, id: null, zu: null, tokens: null });
  for (const art of ['nachricht', 'werkzeugaufruf', 'werkzeugergebnis']) for (const wer of ['mensch', 'agent', 'werkzeug']) assert.ok(eintragPruefen({ art, wer, text: '' }), `${art}/${wer}`);
});

test('AK 2: eine Zeile, die kein JSON ist, und ein JSON-Wert ohne Objekt sind defekt; Nachbarn bleiben', async () => {
  const z = t => JSON.stringify({ art: 'nachricht', wer: 'agent', text: t });
  const { eintraege } = await lesen(stuecke(bytes([z('1'), z('2'), 'kaputt', '[1]', z('5')].join('\n'))));
  assert.deepStrictEqual(eintraege.map(e => [e.nr, e.eintrag && e.eintrag.text]), [[1, '1'], [2, '2'], [3, null], [4, null], [5, '5']]);
});

/** Eine gültige Zeile aus genau `laenge` Byte samt `\n`, mit `zeichen` gefüllt (ein Byte je Zeichen bei ASCII). */
function zeileMitLaenge(laenge, zeichen = 'a') {
  const leer = JSON.stringify({ art: 'nachricht', wer: 'agent', text: '' }).length + 1;
  return JSON.stringify({ art: 'nachricht', wer: 'agent', text: zeichen.repeat(laenge - leer) }) + '\n';
}

test('AK 3: genau 16.777.216 Byte werden ganz gelesen und enden ohne Grenze; ein Byte mehr ist die Grenze', async () => {
  const MIB = 1024 * 1024;
  assert.strictEqual(LAUF_GRENZEN.bytes, 16 * MIB);
  const zeile = zeileMitLaenge(MIB);
  const genau = bytes(zeile.repeat(16));
  assert.strictEqual(genau.length, 16 * MIB);
  const ganz = await lesen(stuecke(genau.subarray(0, 5 * MIB), genau.subarray(5 * MIB)));
  assert.strictEqual(ganz.grenze, false);
  assert.strictEqual(ganz.eintraege.length, 16);
  assert.ok(ganz.eintraege.every(e => e.eintrag));
  const mehr = await lesen(stuecke(genau, bytes(' ')));
  assert.strictEqual(mehr.grenze, true);
  assert.strictEqual(mehr.eintraege.length, 16, 'die angefangene 17. Zeile entfällt');
});

test('AK 3: die Grenze zählt Bytes vor dem Dekodieren (Mutant „nach dem Dekodieren gezählt“ ist rot)', async () => {
  // je Zeile gut 900 Byte, aber nur gut 500 Zeichen: in Zeichen gezählt läge die vierte Zeile weit unter der Grenze
  const ue = JSON.stringify({ art: 'nachricht', wer: 'agent', text: 'ü'.repeat(470) }) + '\n';
  assert.ok(bytes(ue).length > 900 && ue.length < 520, `${bytes(ue).length} Byte, ${ue.length} Zeichen`);
  const grenzen = { bytes: bytes(ue).length * 3, zeilen: 20000 };
  const r = await lesen(stuecke(bytes(ue.repeat(3) + ue)), grenzen);
  assert.strictEqual(r.grenze, true);
  assert.strictEqual(r.eintraege.length, 3);
  const genau = await lesen(stuecke(bytes(ue.repeat(3))), grenzen);
  assert.strictEqual(genau.grenze, false);
});

test('AK 3: die an der Grenze angefangene Zeile ergibt weder Eintrag noch Fehlereintrag (Mutant „angefangene Zeile als defekt“ ist rot)', async () => {
  const z = JSON.stringify({ art: 'nachricht', wer: 'agent', text: 'x' }) + '\n';
  const grenzen = { bytes: z.length * 2 + 10, zeilen: 20000 };
  const r = await lesen(stuecke(bytes(z.repeat(5))), grenzen);
  assert.strictEqual(r.grenze, true);
  assert.deepStrictEqual(r.eintraege.map(e => [e.nr, Boolean(e.eintrag)]), [[1, true], [2, true]]);
  // erreicht schon die erste Zeile die Grenze, entsteht kein Eintrag
  const erste = await lesen(stuecke(bytes('{"art":"nachricht","wer":"agent","text":"' + 'a'.repeat(200) + '"}\n')), { bytes: 100, zeilen: 20000 });
  assert.deepStrictEqual(erste, { eintraege: [], grenze: true });
});

test('AK 3: 20.000 Zeilen werden ganz gelesen, 20.001 enden an der Grenze', async () => {
  assert.strictEqual(LAUF_GRENZEN.zeilen, 20000);
  const z = '{"art":"nachricht","wer":"agent","text":"x"}\n';
  const genau = await lesen(stuecke(bytes(z.repeat(20000))));
  assert.strictEqual(genau.grenze, false);
  assert.strictEqual(genau.eintraege.length, 20000);
  assert.strictEqual(genau.eintraege[19999].nr, 20000);
  const mehr = await lesen(stuecke(bytes(z.repeat(20001))));
  assert.strictEqual(mehr.grenze, true);
  assert.strictEqual(mehr.eintraege.length, 20000);
  // Leerraumzeilen zählen mit: 19.999 Einträge und eine Leerzeile sind 20.000 Zeilen, die nächste ist die Grenze
  const mitLeer = await lesen(stuecke(bytes(z.repeat(19999) + ' \n' + z)));
  assert.strictEqual(mitLeer.grenze, true);
  assert.strictEqual(mitLeer.eintraege.length, 19999);
  // ohne \n am Ende zählt die 20.000. Zeile ganz
  const ohneSchluss = await lesen(stuecke(bytes(z.repeat(20000).slice(0, -1))));
  assert.deepStrictEqual([ohneSchluss.grenze, ohneSchluss.eintraege.length], [false, 20000]);
});

test('Ungültiges UTF-8 wird U+FFFD und bricht nichts ab; eine gültige Datei ohne Zeile ergibt nur das Ende', async () => {
  const r = await lesen(stuecke(Uint8Array.of(...bytes('{"art":"nachricht","wer":"agent","text":"a'), 0xff, ...bytes('b"}\n'))));
  assert.strictEqual(r.eintraege[0].eintrag.text, 'a�b');
  assert.deepStrictEqual(await lesen(stuecke()), { eintraege: [], grenze: false });
  assert.deepStrictEqual(await lesen(stuecke(bytes('\n\n  \n'))), { eintraege: [], grenze: false });
});

test('Die Grenze bricht den Strom ab: nach ihr wird kein weiteres Stück angefordert', async () => {
  let angefordert = 0;
  async function* endlos() { for (;;) { angefordert++; yield bytes('{"art":"nachricht","wer":"agent","text":"x"}\n'); } }
  const r = await lesen(endlos(), { bytes: 1000000, zeilen: 10 });
  assert.strictEqual(r.grenze, true);
  assert.strictEqual(r.eintraege.length, 10);
  assert.ok(angefordert <= 11, `${angefordert} Stücke angefordert`);
});

/* ── R00238 B1237: `tokens` lesen (ADR-0041 N2 Punkt 1, N3 Punkt 1) ── */

test('R00238 AK 2: tokens an einem Eintrag von agent wird gelesen, ein fehlender Schlüssel zählt 0', () => {
  const aufruf = { art: 'werkzeugaufruf', wer: 'agent', text: 'x' };
  assert.deepStrictEqual(eintragPruefen({ ...aufruf, tokens: { ein: 1, aus: 300, cache_lesen: 18000, cache_schreiben: 34800 } }).tokens,
    { ein: 1, aus: 300, cache_lesen: 18000, cache_schreiben: 34800 });
  assert.deepStrictEqual(eintragPruefen({ ...aufruf, tokens: { aus: 10 } }).tokens, { ein: 0, aus: 10, cache_lesen: 0, cache_schreiben: 0 });
  assert.deepStrictEqual(eintragPruefen({ art: 'nachricht', wer: 'agent', text: 'x', tokens: { ein: 0, aus: 0, cache_lesen: 0, cache_schreiben: 0 } }).tokens,
    { ein: 0, aus: 0, cache_lesen: 0, cache_schreiben: 0 }, 'lauter Nullen sind ein Wert');
  assert.deepStrictEqual(eintragPruefen({ ...aufruf, tokens: { ein: 2 ** 53 - 1, aus: 1.5, x: 4 } }).tokens, { ein: 2 ** 53 - 1, aus: 0, cache_lesen: 0, cache_schreiben: 0 },
    'ein falscher Wert und ein unbekannter Schlüssel fallen weg, der Rest bleibt');
});

test('R00238 AK 2: tokens fällt weg an Ergebnis und mensch, als Zahl, Liste, mit -1, 1.5, 2**53, unbekanntem Schlüssel allein — der Eintrag bleibt lesbar', () => {
  const gueltig = { ein: 1, aus: 2, cache_lesen: 3, cache_schreiben: 4 };
  const faelle = [
    [{ art: 'werkzeugergebnis', wer: 'werkzeug', text: 'x', tokens: gueltig }, 'Ergebnis'],
    [{ art: 'nachricht', wer: 'mensch', text: 'x', tokens: gueltig }, 'mensch'],
  ];
  for (const [o, name] of faelle) assert.strictEqual(eintragPruefen(o).tokens, null, name);
  const agent = { art: 'werkzeugaufruf', wer: 'agent', text: 'x' };
  for (const falsch of [12, [1, 2], 'viel', null, true, { ein: -1 }, { aus: 1.5 }, { cache_lesen: 2 ** 53 }, { ein: '3' }, { ein: NaN }, { ein: Infinity }, { anders: 5 }, {}]) {
    const e = eintragPruefen({ ...agent, tokens: falsch });
    assert.ok(e, `lesbar: ${JSON.stringify(falsch)}`);
    assert.strictEqual(e.text, 'x');
    assert.strictEqual(e.tokens, null, JSON.stringify(falsch));
  }
  assert.strictEqual(eintragPruefen(agent).tokens, null, 'ohne Feld');
  const proto = JSON.parse('{"art":"werkzeugaufruf","wer":"agent","text":"x","tokens":{"__proto__":{"ein":5}}}');
  assert.strictEqual(eintragPruefen(proto).tokens, null, '__proto__ ist ein unbekannter Schlüssel');
});
