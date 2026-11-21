// R00205 B1005: Zeilenwerte der Ansicht „Commits“ — reine Rechnung aus web/commits.js, ohne Browser.
// Die Zone ist Europe/Berlin wie im Browser der E2E-Proben (R00084): das Datum steht in Ortszeit.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { zeilenwerte, kurzform, titelGekuerzt, zahlenText, zweigmarken, zustandsmarke, fehlerText, gelesenText, ZUSTANDSWOERTER } = require('../../web/commits.js');

const K = 'a41e0c5b3c7d9e8f00112233445566778899aabb';
const auf = (zusatz = {}) => ({ verweis: `kd:${K}`, anwendung: 'kd', hash: K, zustand: 'auf_zweig', zweige: ['main'], titel: 'c.txt anlegen', autor: 'Ada Autorin', datum: '2026-03-01T10:00:00+01:00', plus: 3, minus: 0, dateien: 1, ...zusatz });

test('kurzform: Kürzel und die ersten 7 Zeichen des Hashs; ohne Kürzel nur die 7 Zeichen; ohne Hash der Verweis wörtlich', () => {
  assert.strictEqual(kurzform(auf()), 'kd:a41e0c5');
  assert.strictEqual(kurzform(auf({ anwendung: '' })), 'a41e0c5');
  assert.strictEqual(kurzform(auf({ anwendung: undefined })), 'a41e0c5');
  const unlesbar = { verweis: 'kd:3f2a9c1;rm -rf x', zustand: 'unlesbar', grund: 'x' };
  assert.strictEqual(kurzform(unlesbar), 'kd:3f2a9c1;rm -rf x');
});

test('kurzform Grenze: ein Hash mit 64 Zeichen (SHA-256) wird auf 7 gekürzt, ein kürzerer Hash bleibt, wie er ist', () => {
  assert.strictEqual(kurzform(auf({ hash: 'f'.repeat(64) })), 'kd:fffffff');
  assert.strictEqual(kurzform(auf({ hash: 'abc' })), 'kd:abc');
});

test('titelGekuerzt: genau 501 Zeichen und am Ende „…“; 500 mit „…“ und jede andere Länge nicht', () => {
  assert.strictEqual(titelGekuerzt({ titel: 'a'.repeat(500) + '…' }), true);
  assert.strictEqual(titelGekuerzt({ titel: 'a'.repeat(499) + '…' }), false, '500 Zeichen, selbst auf „…“ endend');
  assert.strictEqual(titelGekuerzt({ titel: 'a'.repeat(501) }), false, '501 Zeichen ohne „…“');
  assert.strictEqual(titelGekuerzt({ titel: 'a'.repeat(500) + '…x' }), false, '502 Zeichen');
  assert.strictEqual(titelGekuerzt({ titel: 'a'.repeat(601) }), false);
  assert.strictEqual(titelGekuerzt({}), false, 'ohne Titel');
});

test('titelGekuerzt zählt Codepunkte, nicht UTF-16-Einheiten: 499 a + Emoji + „…“ sind 501 Zeichen (502 Einheiten)', () => {
  const titel = 'a'.repeat(499) + '\u{1F600}' + '…';
  assert.strictEqual(titel.length, 502);
  assert.strictEqual(titelGekuerzt({ titel }), true);
  assert.strictEqual(titelGekuerzt({ titel: 'a'.repeat(499) + '\u{1F600}' }), false, '500 Zeichen, Emoji an Stelle 500, ohne „…“');
});

test('zahlenText: Tausenderpunkt, +/− und das Minus-Zeichen U+2212', () => {
  assert.strictEqual(zahlenText(auf({ plus: 592, minus: 0 })), '+592 −0');
  assert.strictEqual(zahlenText(auf({ plus: 1204, minus: 87 })), '+1.204 −87');
  assert.strictEqual(zahlenText(auf({ plus: 1204567, minus: 987654 })), '+1.204.567 −987.654');
  assert.strictEqual(zahlenText(auf({ plus: 999, minus: 1000 })), '+999 −1.000');
});

test('zeilenwerte: Datum in Ortszeit TT.MM.JJJJ HH:MM, title ist das Datum wörtlich', () => {
  const z = zeilenwerte(auf());
  assert.strictEqual(z.datum, '01.03.2026 10:00');
  assert.strictEqual(z.datumTitel, '2026-03-01T10:00:00+01:00');
  assert.strictEqual(zeilenwerte(auf({ datum: '2026-02-01T09:00:00+00:00' })).datum, '01.02.2026 10:00', 'UTC → Berlin');
  assert.strictEqual(zeilenwerte(auf({ datum: '2026-07-01T09:00:00+00:00' })).datum, '01.07.2026 11:00', 'Sommerzeit');
});

test('zeilenwerte: ein Eintrag mit auf_zweig zeigt Titel, Autor, Zahlen, ohne Zustandswort', () => {
  const z = zeilenwerte(auf());
  assert.deepStrictEqual(
    { kurz: z.kurz, titel: z.titel, autor: z.autor, zahlen: z.zahlen, marke: z.zustand, ohneMetadaten: z.ohneMetadaten, gekuerzt: z.gekuerzt, verweis: z.verweis },
    { kurz: 'kd:a41e0c5', titel: 'c.txt anlegen', autor: 'Ada Autorin', zahlen: '+3 −0', marke: null, ohneMetadaten: false, gekuerzt: false, verweis: `kd:${K}` });
});

test('zustandsmarke: die fünf Wörter und Hinweise der Tabelle (FA 5), paarweise verschieden', () => {
  const verwaist = zustandsmarke({ zustand: 'verwaist' });
  assert.deepStrictEqual([verwaist.wort, verwaist.hinweis], ['auf keinem Zweig', 'Der Commit ist noch da, aber kein Zweig führt zu ihm — meist nach einem Rebase.']);
  const fehlt = zustandsmarke({ zustand: 'fehlt' });
  assert.deepStrictEqual([fehlt.wort, fehlt.hinweis], ['nicht mehr im Repository', 'Das Repository kennt diesen Commit nicht mehr.']);
  const repo = zustandsmarke({ zustand: 'repository_fehlt', grund: 'Ordner fehlt: /x' });
  assert.deepStrictEqual([repo.wort, repo.hinweis], ['Repository nicht erreichbar', 'Ordner fehlt: /x']);
  const unlesbar = zustandsmarke({ zustand: 'unlesbar', grund: 'Verweis ungültig' });
  assert.deepStrictEqual([unlesbar.wort, unlesbar.hinweis], ['Eintrag nicht lesbar', 'Verweis ungültig']);
  const woerter = ['verwaist', 'fehlt', 'repository_fehlt', 'anwendung_unbekannt', 'unlesbar'].map(z => zustandsmarke({ zustand: z, anwendung: 'xy' }).wort);
  assert.strictEqual(new Set(woerter).size, 5);
  assert.deepStrictEqual(woerter, Object.values(ZUSTANDSWOERTER));
  assert.strictEqual(zustandsmarke({ zustand: 'auf_zweig' }), null, 'auf_zweig hat kein Wort, sondern die Zweige');
});

test('zustandsmarke „Anwendung unbekannt“: mit Kürzel der Satz mit „xy“, ohne Kürzel (fehlend oder leer) der Satz ohne Anwendung', () => {
  assert.strictEqual(zustandsmarke({ zustand: 'anwendung_unbekannt', anwendung: 'xy' }).hinweis, 'Anwendung „xy“ ist unter Einrichten nicht eingetragen.');
  const ohne = 'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.';
  assert.strictEqual(zustandsmarke({ zustand: 'anwendung_unbekannt', anwendung: '' }).hinweis, ohne);
  assert.strictEqual(zustandsmarke({ zustand: 'anwendung_unbekannt' }).hinweis, ohne);
});

test('zustandsmarke trägt Symbol und Ton je Zustand — nie allein Farbe', () => {
  for (const zustand of ['verwaist', 'fehlt', 'repository_fehlt', 'anwendung_unbekannt', 'unlesbar']) {
    const m = zustandsmarke({ zustand, grund: 'g' });
    assert.ok(m.symbol && m.wort, zustand);
    assert.ok(['warn', 'fehl'].includes(m.ton), zustand);
  }
  assert.strictEqual(zustandsmarke({ zustand: 'verwaist' }).ton, 'warn');
  assert.strictEqual(zustandsmarke({ zustand: 'fehlt' }).ton, 'fehl');
});

test('zeilenwerte: ohne Metadaten (fehlt, unlesbar, repository_fehlt, anwendung_unbekannt) — nur verwaist und auf_zweig haben Titel, Autor, Datum, Zahlen', () => {
  for (const zustand of ['fehlt', 'unlesbar', 'repository_fehlt', 'anwendung_unbekannt']) {
    assert.strictEqual(zeilenwerte({ verweis: 'kd:abc', zustand, grund: 'g' }).ohneMetadaten, true, zustand);
  }
  const v = zeilenwerte(auf({ zustand: 'verwaist', zweige: undefined }));
  assert.strictEqual(v.ohneMetadaten, false);
  assert.strictEqual(v.titel, 'c.txt anlegen');
  assert.strictEqual(v.zustand.wort, 'auf keinem Zweig');
});

test('zeilenwerte: der Titel kommt unverändert (nichts wird gekürzt) und die Marke „gekürzt“ folgt der 501er-Regel', () => {
  const lang = 'a'.repeat(500) + '…';
  const z = zeilenwerte(auf({ titel: lang }));
  assert.strictEqual(z.titel, lang);
  assert.strictEqual(z.gekuerzt, true);
  assert.strictEqual(zeilenwerte(auf({ titel: 'a'.repeat(500) })).gekuerzt, false);
});

test('zweigmarken: bis zu drei Namen (lokale zuerst, dann entfernte), kein Knopf bei drei, „+1 weitere“ bei vier', () => {
  const drei = zweigmarken(auf({ zweige: ['a', 'b'], entfernte_zweige: ['o/a'] }));
  assert.deepStrictEqual(drei.sichtbar, [{ name: 'a', entfernt: false }, { name: 'b', entfernt: false }, { name: 'o/a', entfernt: true }]);
  assert.strictEqual(drei.weitere, 0);
  const vier = zweigmarken(auf({ zweige: ['a', 'b', 'c'], entfernte_zweige: ['o/a'] }));
  assert.strictEqual(vier.sichtbar.length, 3);
  assert.deepStrictEqual(vier.sichtbar.map(z => z.name), ['a', 'b', 'c'], 'lokale zuerst');
  assert.strictEqual(vier.weitere, 1);
});

test('zweigmarken: 10 + 10 + 3 nicht aufgeführte → „+20 weitere“, die Listen der Klappe und der Satz zum Rest', () => {
  const lokal = Array.from({ length: 10 }, (_, i) => `z${i + 1}`), fern = Array.from({ length: 10 }, (_, i) => `o/e${i + 1}`);
  const z = zweigmarken(auf({ zweige: lokal, entfernte_zweige: fern, zweige_weitere: 3 }));
  assert.strictEqual(z.weitere, 20);
  assert.deepStrictEqual(z.sichtbar.map(m => m.name), ['z1', 'z2', 'z3']);
  assert.deepStrictEqual([z.lokal.length, z.entfernt.length, z.nichtAufgefuehrt], [10, 10, 3]);
  assert.strictEqual(z.satzRest, 'und 3 weitere Zweige, hier nicht aufgeführt');
});

test('zweigmarken: nur entfernte Zweige (R1 auf o/x) — keine lokale Liste; „zweige_weitere“ fehlt = 0; ohne Zweige keine Marken', () => {
  const r1 = zweigmarken(auf({ zweige: [], entfernte_zweige: ['o/x'] }));
  assert.deepStrictEqual(r1.sichtbar, [{ name: 'o/x', entfernt: true }]);
  assert.strictEqual(r1.lokal.length, 0);
  assert.strictEqual(r1.satzRest, null);
  const leer = zweigmarken({ zustand: 'verwaist' });
  assert.deepStrictEqual([leer.sichtbar, leer.weitere], [[], 0]);
});

test('zweigmarken: nur „zweige_weitere“ ohne Namen zählt mit (Summe aller drei Angaben)', () => {
  const z = zweigmarken(auf({ zweige: ['a'], zweige_weitere: 5 }));
  assert.strictEqual(z.weitere, 3, '1 + 5 − 3');
});

test('fehlerText: 503 der Zeitgrenze hat den festen Wortlaut des PO, sonst der fehler der Antwort, ohne Verbindung „keine Verbindung zum Programm“', () => {
  const zeit = 'Git in einem Arbeits-Repository antwortete nicht innerhalb von 10 s — keine Liste';
  const wortlaut = 'Die Commits ließen sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden (503).';
  assert.strictEqual(fehlerText({ status: 503, fehler: zeit }), wortlaut);
  assert.strictEqual(fehlerText({ status: 503, fehler: '' }), wortlaut, 'ohne Text bleibt es beim Wortlaut des PO');
  assert.strictEqual(fehlerText({ status: 423, fehler: 'Die Aufgabendatei ist defekt' }), 'Die Commits ließen sich nicht lesen: Die Aufgabendatei ist defekt (423).');
  assert.strictEqual(fehlerText({ status: 500, fehler: '' }), 'Die Commits ließen sich nicht lesen: unbekannter Fehler (500).');
});

test('fehlerText: ein 503 aus anderem Grund (zu viel Ausgabe) nennt seinen fehler, nicht die 10 Sekunden', () => {
  for (const fehler of ['die Zweigliste eines Arbeits-Repositorys hat mehr als 5000 Zeilen — keine Liste', 'Git im Repository „kd“ lieferte mehr als 5000 Zeilen — abgebrochen']) {
    const text = fehlerText({ status: 503, fehler });
    assert.strictEqual(text, `Die Commits ließen sich nicht lesen: ${fehler} (503).`);
    assert.doesNotMatch(text, /10 Sekunden/);
  }
});

test('fehlerText: ohne Verbindung (Status 0) steht „keine Verbindung zum Programm“ mit dem Status, wie AK 7 es verlangt', () => {
  assert.strictEqual(fehlerText({ status: 0, fehler: 'Keine Verbindung zum Server — nichts geändert.' }), 'Die Commits ließen sich nicht lesen: keine Verbindung zum Programm (0).');
});

test('gelesenText: „5 Commits gelesen“, Einzahl und leer', () => {
  assert.strictEqual(gelesenText(5), '5 Commits gelesen');
  assert.strictEqual(gelesenText(1), '1 Commit gelesen');
  assert.strictEqual(gelesenText(0), 'Keine Commits gelesen');
});

test('zeilenwerte reicht fremden Text unverändert durch — Maskieren ist Sache des Zeichnens (esc), nicht der Rechnung', () => {
  const z = zeilenwerte(auf({ titel: '<img src=x onerror=window.pwn=1> "x" \\ y', autor: 'Mallory <b>fett</b>', zweige: ['a"><i>z'] }));
  assert.strictEqual(z.titel, '<img src=x onerror=window.pwn=1> "x" \\ y');
  assert.strictEqual(z.autor, 'Mallory <b>fett</b>');
  assert.strictEqual(z.zweige.sichtbar[0].name, 'a"><i>z');
});

test('zweigmarken: bei genau einem nicht aufgeführten Zweig „und 1 weiterer Zweig, hier nicht aufgeführt“, ab zwei „n weitere Zweige“', () => {
  assert.strictEqual(zweigmarken(auf({ zweige: ['a'], zweige_weitere: 1 })).satzRest, 'und 1 weiterer Zweig, hier nicht aufgeführt');
  assert.strictEqual(zweigmarken(auf({ zweige: ['a'], zweige_weitere: 2 })).satzRest, 'und 2 weitere Zweige, hier nicht aufgeführt');
  assert.strictEqual(zweigmarken(auf({ zweige: ['a'], zweige_weitere: 0 })).satzRest, null);
});

test('Bidi-Steuerzeichen U+202A–202E und U+2066–2069 verschwinden aus Titel, Autor, Zweig, Verweis und grund; Umlaute und Emoji bleiben', () => {
  const rlo = '\u202E', lri = '\u2066', pdi = '\u2069';
  const w = zeilenwerte(auf({ titel: `a${rlo}b${lri}c${pdi}ä😀`, autor: `x${rlo}y`, zweige: [`fix-${rlo}gpj.exe`], entfernte_zweige: [`o/${lri}z`] }));
  assert.strictEqual(w.titel, 'abcä😀');
  assert.strictEqual(w.autor, 'xy');
  assert.deepStrictEqual(w.zweige.sichtbar.map(z => z.name), ['fix-gpj.exe', 'o/z']);
  assert.strictEqual(zeilenwerte({ verweis: `kd:${rlo}x`, zustand: 'unlesbar', grund: `g${rlo}h` }).kurz, 'kd:x');
  assert.strictEqual(zustandsmarke({ zustand: 'repository_fehlt', grund: `g${rlo}h` }).hinweis, 'gh');
  assert.strictEqual(fehlerText({ status: 423, fehler: `f${rlo}g` }), 'Die Commits ließen sich nicht lesen: fg (423).');
});

test('zahlenText: eine Zahl als Zeichenkette wird wie eine Zahl gesetzt, ein Zahlenwert ohne Nachkomma bleibt', () => {
  assert.strictEqual(zahlenText({ plus: '1204567', minus: 7 }), '+1.204.567 −7');
});

/* ── R00224 B1168: Satz und Hinweiszeile je Zustand einer 404 (PO Z. 506–508), roh ── */

test('zustandSatz: Satz, Hinweiszeile, Symbol und Ton je Zustand wörtlich nach PO Z. 506–508', () => {
  const { zustandSatz } = require('../../web/commits.js');
  assert.deepStrictEqual(zustandSatz('repository_fehlt', 'wb', 'Ordner fehlt: /x/wb'), { satz: 'Das Repository der Anwendung wb ist nicht erreichbar.', hinweis: 'Ordner fehlt: /x/wb', symbol: 'ordner-offen', ton: 'fehl' });
  assert.deepStrictEqual(zustandSatz('fehlt', 'kd', 'egal'), { satz: 'Das Repository der Anwendung kd kennt diesen Commit nicht mehr.', hinweis: '', symbol: 'fehlt', ton: 'fehl' });
  assert.deepStrictEqual(zustandSatz('anwendung_unbekannt', 'xy', 'egal'), { satz: 'Die Anwendung xy ist unter Einrichten nicht eingetragen.', hinweis: '', symbol: 'frage', ton: 'warn' });
  assert.deepStrictEqual(zustandSatz('anwendung_unbekannt', '', undefined), { satz: 'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.', hinweis: '', symbol: 'frage', ton: 'warn' });
  assert.deepStrictEqual(zustandSatz('unlesbar', 'kd', 'Kurz-Hash mehrdeutig'), { satz: 'Der Eintrag an der Aufgabe ist nicht lesbar.', hinweis: 'Kurz-Hash mehrdeutig', symbol: 'achtung', ton: 'fehl' });
});

test('zustandSatz: leeres Kürzel ist die Standardanwendung, nie „Anwendung “ ohne Namen; ohne grund leere Hinweiszeile', () => {
  const { zustandSatz } = require('../../web/commits.js');
  assert.strictEqual(zustandSatz('repository_fehlt', '', null).satz, 'Das Repository der Standardanwendung ist nicht erreichbar.');
  assert.strictEqual(zustandSatz('fehlt', undefined, null).satz, 'Das Repository der Standardanwendung kennt diesen Commit nicht mehr.');
  assert.strictEqual(zustandSatz('repository_fehlt', 'wb', undefined).hinweis, '');
  assert.strictEqual(zustandSatz('unlesbar', 'wb', '').hinweis, '');
});

test('zustandSatz: grund und Kürzel ohne Bidi-Steuerzeichen, sonst unverändert (maskiert wird beim Zeichnen); unbekannter Zustand und auf_zweig → null', () => {
  const { zustandSatz } = require('../../web/commits.js');
  const s = zustandSatz('repository_fehlt', 'w‮b', 'Ordner fehlt: /x/<img src=x>‮gpj.exe⁦⁩‪');
  assert.strictEqual(s.hinweis, 'Ordner fehlt: /x/<img src=x>gpj.exe');
  assert.strictEqual(s.satz, 'Das Repository der Anwendung wb ist nicht erreichbar.');
  for (const z of ['neu_art', 'auf_zweig', 'verwaist', undefined]) assert.strictEqual(zustandSatz(z, 'kd', 'g'), null, String(z));
});

test('zustandsSymbol: dasselbe SVG wie die Marke der Liste, für jeden Zustand mit Satz ohne „undefined“', () => {
  const { zustandsSymbol, zustandsmarke } = require('../../web/commits.js');
  for (const z of ['repository_fehlt', 'fehlt', 'anwendung_unbekannt', 'unlesbar']) {
    const svg = zustandsSymbol(zustandsmarke({ zustand: z, anwendung: 'kd' }).symbol);
    assert.ok(svg.startsWith('<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><') && !svg.includes('undefined'), z);
  }
});

test('anwendungName steht in commits.js und ist dieselbe Funktion wie in diff.js (ein Wörterbuch)', () => {
  const c = require('../../web/commits.js'), d = require('../../web/diff.js');
  assert.strictEqual(c.anwendungName('wb'), 'Anwendung wb');
  assert.strictEqual(c.anwendungName(''), 'Standardanwendung');
  assert.strictEqual(d.anwendungName, c.anwendungName);
});
