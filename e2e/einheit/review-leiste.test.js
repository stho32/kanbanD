// R00245 B1280: Chips aus dem Titel, Zweigverdichtung und die Folge der Commit-Leiste (web/review-uebersicht.js) — rein, ohne Browser.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const u = require('../../web/review-uebersicht.js');

/* ── commitChips (FA 8, AK 2) ── */

test('commitChips: [R00229] B1187: Sperrform → R00229, B1187, Rest „Sperrform“', () => {
  assert.deepStrictEqual(u.commitChips('[R00229] B1187: Sperrform'), { chips: ['R00229', 'B1187'], rest: 'Sperrform' });
});

test('commitChips: ein B…: mitten im Rest ist kein Chip', () => {
  assert.deepStrictEqual(u.commitChips('[R00229] Abschluss: B1229, B1230'), { chips: ['R00229'], rest: 'Abschluss: B1229, B1230' });
});

test('commitChips: [DOC] R00229 AK 5: x → DOC, Rest „R00229 AK 5: x“', () => {
  assert.deepStrictEqual(u.commitChips('[DOC] R00229 AK 5: x'), { chips: ['DOC'], rest: 'R00229 AK 5: x' });
});

test('commitChips: Titel ohne die Form erscheinen unverändert ohne Chips', () => {
  for (const titel of ['Ohne Form', '[Factory] director: Text', '[r00229] x', 'B1187: x', 'x [R00229] y', ' [R00229] x', '']) {
    assert.deepStrictEqual(u.commitChips(titel), { chips: [], rest: titel }, titel);
  }
});

test('commitChips: bliebe nichts übrig, erscheint der Titel unverändert ohne Chips', () => {
  assert.deepStrictEqual(u.commitChips('[R00229]'), { chips: [], rest: '[R00229]' });
  assert.deepStrictEqual(u.commitChips('[R00229] B1187:'), { chips: [], rest: '[R00229] B1187:' });
  assert.deepStrictEqual(u.commitChips('[R00229]   '), { chips: [], rest: '[R00229]   ' });
});

test('commitChips: der zweite Chip steht unmittelbar dahinter, nur einer', () => {
  assert.deepStrictEqual(u.commitChips('[R00229]B1187: x'), { chips: ['R00229', 'B1187'], rest: 'x' });
  assert.deepStrictEqual(u.commitChips('[R00229] B1187: B1188: x'), { chips: ['R00229', 'B1187'], rest: 'B1188: x' });
  assert.deepStrictEqual(u.commitChips('[R00229] B: x'), { chips: ['R00229'], rest: 'B: x' });
});

test('chipText: höchstens 16 Zeichen, das „…“ zählt mit', () => {
  assert.strictEqual(u.chipText('R00229'), 'R00229');
  assert.strictEqual(u.chipText('A'.repeat(16)), 'A'.repeat(16));
  assert.strictEqual(u.chipText('A'.repeat(17)), 'A'.repeat(15) + '…');
  assert.strictEqual(u.chipText('A'.repeat(40)), 'A'.repeat(15) + '…');
  assert.strictEqual(u.chipText('A'.repeat(40)).length, 16);
});

/* ── zweigVerdichtung (FA 9, AK 5) ── */

const zweige = (lokal, entfernt = [], weitere) => ({ zustand: 'auf_zweig', zweige: lokal, entfernte_zweige: entfernt, ...(weitere ? { zweige_weitere: weitere } : {}) });

test('zweigVerdichtung: C1 auf main und fünf Kartenzweigen → main, 5', () => {
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(['karte/247', 'karte/a', 'karte/b', 'karte/c', 'karte/d', 'main'])), { name: 'main', weitere: 5 });
});

test('zweigVerdichtung: entfernte Zweige zählen mit (C3: main und origin/main → 1)', () => {
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(['main'], ['origin/main'])), { name: 'main', weitere: 1 });
});

test('zweigVerdichtung: C4 nur main → 0; C2 ohne main → keine Verdichtung', () => {
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(['main'])), { name: 'main', weitere: 0 });
  assert.strictEqual(u.zweigVerdichtung(zweige(['karte/247'], ['origin/karte/247'])), null);
});

test('zweigVerdichtung: master, wenn main fehlt; main vor master', () => {
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(['master', 'x'])), { name: 'master', weitere: 1 });
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(['main', 'master'])), { name: 'main', weitere: 1 });
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(['master', 'main'])), { name: 'main', weitere: 1 });
});

test('zweigVerdichtung: C9 — 10 genannte Namen und weitere: 2 → 11', () => {
  const lokal = ['main', ...Array.from({ length: 9 }, (_, i) => `zz0${i + 1}`)];
  assert.deepStrictEqual(u.zweigVerdichtung(zweige(lokal, [], 2)), { name: 'main', weitere: 11 });
});

test('zweigVerdichtung: main nicht unter den genannten (a01–a10, weitere 3) → keine Verdichtung; entfernte origin/main zählt nicht als main', () => {
  const lokal = Array.from({ length: 10 }, (_, i) => `a${String(i + 1).padStart(2, '0')}`);
  assert.strictEqual(u.zweigVerdichtung(zweige(lokal, [], 3)), null);
  assert.strictEqual(u.zweigVerdichtung(zweige(['x'], ['origin/main'])), null);
  assert.strictEqual(u.zweigVerdichtung({ zustand: 'auf_zweig' }), null);
});

test('zweigeWort: „+1 Zweig“, „+5 Zweige“, Tausenderpunkt', () => {
  assert.strictEqual(u.zweigeWort(1), '+1 Zweig');
  assert.strictEqual(u.zweigeWort(5), '+5 Zweige');
  assert.strictEqual(u.zweigeWort(1200), '+1.200 Zweige');
});

/* ── leistenFolge (FA 2, 3, AK 1, 6) ── */

const eintrag = (hash, zustand, plus, minus, titel = `T ${hash}`, datum = '2026-11-22T03:19:00+01:00', anwendung = 'kd') =>
  ({ verweis: `${anwendung}:${hash}`, anwendung, hash, zustand, titel, datum, plus, minus });
const K_LEISTE = [
  eintrag('a'.repeat(40), 'auf_zweig', 302, 7, '[R00229] B1187: Sperrform je Komponente'),
  eintrag('b'.repeat(40), 'auf_zweig', 14, 12, 'x', '2026-11-22T03:31:00+01:00'),
  eintrag('c'.repeat(40), 'auf_zweig', 2, 1, 'y', '2026-11-22T04:34:00+01:00'),
];

test('leistenFolge: K-Leiste → drei Einträge in der Reihenfolge der Liste, 3 Commits, +318 −20', () => {
  const f = u.leistenFolge(K_LEISTE);
  assert.deepStrictEqual(f.commits.map(c => c.kurz), ['kd:aaaaaaa', 'kd:bbbbbbb', 'kd:ccccccc']);
  assert.deepStrictEqual([f.n, f.plus, f.minus], [3, 318, 20]);
  const c1 = f.commits[0];
  assert.deepStrictEqual({ chips: c1.chips, rest: c1.rest, titel: c1.titel, zeit: c1.zeit, verwaist: c1.verwaist, verweis: c1.verweis },
    { chips: ['R00229', 'B1187'], rest: 'Sperrform je Komponente', titel: '[R00229] B1187: Sperrform je Komponente', zeit: '22.11. 03:19', verwaist: false, verweis: `kd:${'a'.repeat(40)}` });
});

test('leistenFolge: verwaist steht darin, zählt aber nicht; fehlt, unlesbar und ohne Hash stehen nicht darin', () => {
  const f = u.leistenFolge([
    K_LEISTE[0], K_LEISTE[1], eintrag('d'.repeat(40), 'verwaist', 5, 1),
    { verweis: 'kd:' + 'e'.repeat(40), zustand: 'fehlt' }, { verweis: 'kd:zz', zustand: 'unlesbar', grund: 'x' },
    { verweis: 'qq:1234567', zustand: 'anwendung_unbekannt' }, { verweis: 'kd:1234567', zustand: 'repository_fehlt', grund: 'y' },
  ]);
  assert.deepStrictEqual(f.commits.map(c => [c.kurz, c.verwaist]), [['kd:aaaaaaa', false], ['kd:bbbbbbb', false], ['kd:ddddddd', true]]);
  assert.deepStrictEqual([f.n, f.plus, f.minus], [2, 316, 19]);
});

test('leistenFolge: ohne Commit mit Diff → keine Einträge, 0; mehrere Anwendungen mit ihrem Kürzel', () => {
  assert.deepStrictEqual(u.leistenFolge([{ verweis: 'kd:x', zustand: 'fehlt' }]), { commits: [], n: 0, plus: 0, minus: 0 });
  const f = u.leistenFolge([K_LEISTE[0], eintrag('f'.repeat(40), 'auf_zweig', 1, 0, 'w', '2026-11-22T03:20:00+01:00', 'wb')]);
  assert.deepStrictEqual(f.commits.map(c => c.kurz), ['kd:aaaaaaa', 'wb:fffffff']);
});

test('leistenFolge: Kurzform ohne Anwendung nur aus dem Hash', () => {
  const ohne = { verweis: 'a'.repeat(40), hash: 'a'.repeat(40), zustand: 'auf_zweig', titel: 't', datum: '2026-11-22T03:19:00+01:00', plus: 1, minus: 0 };
  assert.strictEqual(u.leistenFolge([ohne]).commits[0].kurz, 'aaaaaaa');
});

test('zeitKurz: „TT.MM. hh:mm“ in Ortszeit; was kein Zeitpunkt ist, bleibt', () => {
  assert.strictEqual(u.zeitKurz('2026-11-22T03:19:00+01:00'), '22.11. 03:19');
  assert.strictEqual(u.zeitKurz('2026-11-22T02:19:00+00:00'), '22.11. 03:19');
  assert.strictEqual(u.zeitKurz('2026-07-01T09:05:00+00:00'), '01.07. 11:05');
  assert.strictEqual(u.zeitKurz('irgendwann'), 'irgendwann');
});

/* ── Namen (FA 3, 12) ── */

test('leistenAlleName: „Alle Änderungen, 3 Commits, 318 Zeilen hinzugefügt, 20 entfernt“; Einzahl und Tausenderpunkt', () => {
  assert.strictEqual(u.leistenAlleName(u.leistenFolge(K_LEISTE)), 'Alle Änderungen, 3 Commits, 318 Zeilen hinzugefügt, 20 entfernt');
  assert.strictEqual(u.leistenAlleName({ n: 1, plus: 1240, minus: 0 }), 'Alle Änderungen, 1 Commit, 1.240 Zeilen hinzugefügt, 0 entfernt');
  assert.strictEqual(u.leistenAlleName({ n: 2, plus: 1, minus: 1 }), 'Alle Änderungen, 2 Commits, 1 Zeile hinzugefügt, 1 entfernt');
});

test('leistenEintragName: „Commit <kurz>, <voller Titel>, <Zeit>, <n> Zeilen hinzugefügt, <m> entfernt“; verwaist mit Zusatz', () => {
  const f = u.leistenFolge([...K_LEISTE.slice(0, 2), eintrag('d'.repeat(40), 'verwaist', 5, 1, 'v')]);
  assert.strictEqual(u.leistenEintragName(f.commits[0]), 'Commit kd:aaaaaaa, [R00229] B1187: Sperrform je Komponente, 22.11. 03:19, 302 Zeilen hinzugefügt, 7 entfernt');
  assert.strictEqual(u.leistenEintragName(f.commits[2]), 'Commit kd:ddddddd, v, 22.11. 03:19, 5 Zeilen hinzugefügt, 1 entfernt, auf keinem Zweig, zählt nicht in den Zahlen von Alle Änderungen');
});

test('commitsWort: „1 Commit“, „3 Commits“, „1.200 Commits“', () => {
  assert.deepStrictEqual([1, 3, 1200, 0].map(u.commitsWort), ['1 Commit', '3 Commits', '1.200 Commits', '0 Commits']);
});

/* ── leistenRollstand (FA 13) ── */

test('leistenRollstand: liegt der Eintrag schon ganz im sichtbaren Teil, bleibt der Stand', () => {
  assert.strictEqual(u.leistenRollstand({ stand: 100, hoehe: 200, oben: 150, unten: 200 }, 4), 100);
  assert.strictEqual(u.leistenRollstand({ stand: 100, hoehe: 200, oben: 104, unten: 296 }, 4), 100);
});

test('leistenRollstand: darüber → oben mit Rand, darunter → unten mit Rand, nie unter 0', () => {
  assert.strictEqual(u.leistenRollstand({ stand: 100, hoehe: 200, oben: 50, unten: 90 }, 4), 46);
  assert.strictEqual(u.leistenRollstand({ stand: 100, hoehe: 200, oben: 103, unten: 150 }, 4), 99);
  assert.strictEqual(u.leistenRollstand({ stand: 100, hoehe: 200, oben: 400, unten: 450 }, 4), 254);
  assert.strictEqual(u.leistenRollstand({ stand: 100, hoehe: 200, oben: 2, unten: 40 }, 4), 0);
});

test('leistenRollstand: höher als der sichtbare Teil → der Anfang des Eintrags zählt', () => {
  assert.strictEqual(u.leistenRollstand({ stand: 0, hoehe: 50, oben: 100, unten: 300 }, 4), 96);
});
