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

test('fehlerText: 503 hat den festen Wortlaut des PO, sonst der fehler der Antwort, ohne Verbindung „keine Verbindung zum Programm“', () => {
  assert.strictEqual(fehlerText({ status: 503, fehler: 'egal' }), 'Die Commits ließen sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden (503).');
  assert.strictEqual(fehlerText({ status: 423, fehler: 'Die Aufgabendatei ist defekt' }), 'Die Commits ließen sich nicht lesen: Die Aufgabendatei ist defekt (423).');
  assert.strictEqual(fehlerText({ status: 0, fehler: 'Keine Verbindung zum Server — nichts geändert.' }), 'Die Commits ließen sich nicht lesen: keine Verbindung zum Programm (0).');
  assert.strictEqual(fehlerText({ status: 500, fehler: '' }), 'Die Commits ließen sich nicht lesen: unbekannter Fehler (500).');
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
