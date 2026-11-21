// Unit-Tests der Adresse der Ansicht und der geöffneten Aufgabe (node --test), R00174 / ADR-0029
const test = require('node:test');
const assert = require('node:assert');
const { adresseLesen, adresseBilden, linkRueckmeldung } = require('../../web/adresse.js');

test('#/board/entwicklung/aufgabe/7 → Board entwicklung, Nummer 7', () => {
  assert.deepStrictEqual(adresseLesen('#/board/entwicklung/aufgabe/7'), { sicht: 'board', slug: 'entwicklung', nummer: 7 });
  assert.deepStrictEqual(adresseLesen('#/board/zweit/aufgabe/12'), { sicht: 'board', slug: 'zweit', nummer: 12 });
});

test('#/aufgaben/aufgabe/8 → Aufgabenliste, Nummer 8', () => {
  assert.deepStrictEqual(adresseLesen('#/aufgaben/aufgabe/8'), { sicht: 'aufgaben', slug: null, nummer: 8 });
});

test('fremde Zeichen, fehlende, negative und überlange Nummer → keine Nummer, die Sicht bleibt', () => {
  const ohneNummer = [
    '#/board/entwicklung/aufgabe/<img src=x onerror=alert(1)>',
    '#/board/entwicklung/aufgabe/%3Cimg%20src=x%20onerror=alert(1)%3E',
    '#/board/entwicklung/aufgabe/7<script>',
    '#/board/entwicklung/aufgabe/7%3Cscript%3E',
    '#/board/entwicklung/aufgabe/-1',
    '#/board/entwicklung/aufgabe/99999999999999999999',
    '#/board/entwicklung/aufgabe/1234567890',
    '#/board/entwicklung/aufgabe/0',
    '#/board/entwicklung/aufgabe/',
    '#/board/entwicklung/aufgabe',
    '#/board/entwicklung/aufgabe/7/',
    '#/board/entwicklung/aufgabe/7/8',
    '#/board/entwicklung/aufgabe/7?x=1',
    '#/board/entwicklung/aufgabe/ 7',
    '#/board/entwicklung/aufgabe/7e1',
    '#/board/entwicklung/aufgabe/٧',
    '#/board/entwicklung/aufgabe/' + '7'.repeat(5000),
    '#/board/entwicklung/aufgabe/7' + 'x'.repeat(100000),
  ];
  for (const hash of ohneNummer) assert.deepStrictEqual(adresseLesen(hash), { sicht: 'board', slug: 'entwicklung', nummer: null }, hash.slice(0, 80));
  assert.strictEqual(adresseLesen('#/aufgaben/aufgabe/x').nummer, null);
  assert.strictEqual(adresseLesen('#/aufgaben/aufgabe/8/9').nummer, null);
  assert.strictEqual(adresseLesen('#/berichte/kosten/aufgabe/7').nummer, null);
  assert.strictEqual(adresseLesen('#/wbs/kd/aufgabe/7').nummer, null);
  assert.strictEqual(adresseLesen('#/personen/aufgabe/7').nummer, null);
});

test('die größte gelesene Nummer hat neun Ziffern; führende Nullen zählen nicht zum Wert', () => {
  assert.strictEqual(adresseLesen('#/board/entwicklung/aufgabe/999999999').nummer, 999999999);
  assert.strictEqual(adresseLesen('#/board/entwicklung/aufgabe/007').nummer, 7);
});

test('der Slug wird gelesen, wie er dasteht — geprüft wird er erst gegen die bekannten Boards', () => {
  assert.strictEqual(adresseLesen('#/board/<img src=x onerror=alert(1)>/aufgabe/7').slug, '<img src=x onerror=alert(1)>');
  assert.strictEqual(adresseLesen('#/board/<img src=x onerror=alert(1)>/aufgabe/7').nummer, 7);
  assert.strictEqual(adresseLesen('#/board/gibtsnicht/aufgabe/7').slug, 'gibtsnicht');
});

test('alle bisherigen Adressen → Sicht und Slug wie zuvor, nie eine Nummer', () => {
  const bisher = [
    ['', 'board', null],
    ['#', 'board', null],
    ['#/', 'board', null],
    ['#/board/', 'board', null],
    ['#/board/entwicklung', 'board', 'entwicklung'],
    ['#/board/entwicklung/irgendwas', 'board', 'entwicklung'],
    ['#/aufgaben', 'aufgaben', null],
    ['#/personen', 'personen', null],
    ['#/einrichten', 'einrichten', null],
    ['#/berichte/stundenzettel', 'berichte/stundenzettel', null],
    ['#/berichte/kreuz', 'berichte/kreuz', null],
    ['#/berichte/verlauf', 'berichte/verlauf', null],
    ['#/berichte/fluss', 'berichte/fluss', null],
    ['#/berichte/durchsatz', 'berichte/durchsatz', null],
    ['#/berichte/durchlauf', 'berichte/durchlauf', null],
    ['#/berichte/prognose', 'berichte/prognose', null],
    ['#/berichte/fieber', 'berichte/fieber', null],
    ['#/berichte/kosten', 'berichte/kosten', null],
    ['#/berichte/bestand', 'berichte/bestand', null],
    ['#/berichte/gibtsnicht', 'board', null],
    // R00222: die WBS-Sicht gibt es nicht mehr — ihre alte Adresse zeigt wie jede unbekannte das Board
    ['#/wbs/kd', 'board', null],
    ['#/wbs/kd/I0164', 'board', null],
    ['#/unbekannt', 'board', null],
  ];
  for (const [hash, sicht, slug] of bisher) assert.deepStrictEqual(adresseLesen(hash), { sicht, slug, nummer: null }, hash);
});

test('adresseBilden: Board und Aufgabenliste, mit und ohne Nummer; gelesen ergibt sie wieder dasselbe', () => {
  assert.strictEqual(adresseBilden({ sicht: 'board', slug: 'entwicklung', nummer: 7 }), '#/board/entwicklung/aufgabe/7');
  assert.strictEqual(adresseBilden({ sicht: 'board', slug: 'entwicklung', nummer: null }), '#/board/entwicklung');
  assert.strictEqual(adresseBilden({ sicht: 'aufgaben', slug: 'entwicklung', nummer: 8 }), '#/aufgaben/aufgabe/8');
  assert.strictEqual(adresseBilden({ sicht: 'aufgaben', slug: null, nummer: null }), '#/aufgaben');
  for (const ziel of [{ sicht: 'board', slug: 'ueber-groesse-2', nummer: 7 }, { sicht: 'aufgaben', slug: null, nummer: 8 }, { sicht: 'board', slug: 'zweit', nummer: null }]) {
    assert.deepStrictEqual(adresseLesen(adresseBilden(ziel)), ziel);
  }
});

test('Rückmeldung nach „Link kopieren“: kopiert oder verweigert; auf localhost und 127.0.0.1 mit dem Zusatz', () => {
  assert.strictEqual(linkRueckmeldung({ kopiert: true, hostname: 'rechner' }), 'Link kopiert');
  assert.strictEqual(linkRueckmeldung({ kopiert: false, hostname: 'rechner' }), 'Kopieren nicht erlaubt — der Link steht in der Adresszeile');
  assert.strictEqual(linkRueckmeldung({ kopiert: true, hostname: 'localhost' }), 'Link kopiert — gilt nur auf diesem Rechner');
  assert.strictEqual(linkRueckmeldung({ kopiert: true, hostname: '127.0.0.1' }), 'Link kopiert — gilt nur auf diesem Rechner');
  assert.strictEqual(linkRueckmeldung({ kopiert: false, hostname: 'localhost' }), 'Kopieren nicht erlaubt — der Link steht in der Adresszeile — gilt nur auf diesem Rechner');
  assert.strictEqual(linkRueckmeldung({ kopiert: false, hostname: '127.0.0.1' }), 'Kopieren nicht erlaubt — der Link steht in der Adresszeile — gilt nur auf diesem Rechner');
  assert.strictEqual(linkRueckmeldung({ kopiert: true, hostname: '[::1]' }), 'Link kopiert — gilt nur auf diesem Rechner');
  assert.strictEqual(linkRueckmeldung({ kopiert: true, hostname: '192.168.1.20' }), 'Link kopiert');
  assert.strictEqual(linkRueckmeldung({ kopiert: true, hostname: 'localhost.example.org' }), 'Link kopiert');
});

/* ── R00207 B1017: Adresse der Review-Seite (ADR-0033 Punkt 1) ── */
const { reviewAdresseBilden } = require('../../web/adresse.js');
const V1 = '3f2a9c1d00112233445566778899aabbccddeeff';

test('Review-Adresse in Board- und Aufgabenform: Sicht review, Fensternummer null, Verweis URL-dekodiert', () => {
  assert.deepStrictEqual(adresseLesen(`#/board/entwicklung/aufgabe/7/review?commit=kd%3A${V1}`),
    { sicht: 'review', slug: 'entwicklung', nummer: null, review: { basis: 'board', nummer: 7, commit: `kd:${V1}`, ungueltig: false } });
  assert.deepStrictEqual(adresseLesen(`#/aufgaben/aufgabe/1/review?commit=${V1.slice(0, 7)}`),
    { sicht: 'review', slug: null, nummer: null, review: { basis: 'aufgaben', nummer: 1, commit: V1.slice(0, 7), ungueltig: false } });
  assert.strictEqual(adresseLesen(`#/aufgaben/aufgabe/1/review?commit=kd:${V1}`).review.commit, `kd:${V1}`, 'auch unkodiert');
});

test('Review-Adresse ohne commit: kein Verweis, nicht ungültig (zeigt den ersten Commit mit Diff)', () => {
  assert.deepStrictEqual(adresseLesen('#/aufgaben/aufgabe/1/review').review, { basis: 'aufgaben', nummer: 1, commit: null, ungueltig: false });
  assert.deepStrictEqual(adresseLesen('#/board/b/aufgabe/3/review?').review, { basis: 'board', nummer: 3, commit: null, ungueltig: false });
});

test('Form des Verweises: 7 und 64 Hex gültig, 6 und 65 Hex, fremde Zeichen, Kürzel über 8 Zeichen und kaputte Kodierung ungültig', () => {
  const lies = c => adresseLesen('#/aufgaben/aufgabe/1/review?commit=' + c).review;
  assert.strictEqual(lies('a'.repeat(7)).ungueltig, false);
  assert.strictEqual(lies('A'.repeat(64)).ungueltig, false);
  assert.strictEqual(lies('abcdefgh:' + 'a'.repeat(7)).ungueltig, false, 'Kürzel aus 8 Zeichen');
  for (const c of ['a'.repeat(6), 'a'.repeat(65), 'kd:' + 'a'.repeat(6), 'kd:' + 'a'.repeat(65), '<script>alert(1)</script>', '%3Cscript%3E', 'abcdefghi:' + 'a'.repeat(7),
    'KD:' + 'a'.repeat(7), ':' + 'a'.repeat(7), 'g'.repeat(7), 'kd%3A' + 'a'.repeat(7) + '%0A', '%E0%A4%A', 'kd:' + 'a'.repeat(7) + '%20']) {
    const r = lies(c);
    assert.deepStrictEqual([r.commit, r.ungueltig], [null, true], c);
  }
});

test('Review-Adresse: Nummer wie im Fenster (Ziffern, höchstens neun), sonst keine Review-Adresse', () => {
  assert.strictEqual(adresseLesen('#/aufgaben/aufgabe/x/review?commit=' + V1).sicht, 'aufgaben');
  assert.strictEqual(adresseLesen('#/aufgaben/aufgabe/1234567890/review?commit=' + V1).sicht, 'aufgaben');
  assert.strictEqual(adresseLesen('#/aufgaben/aufgabe/1/reviewx').sicht, 'aufgaben');
  assert.strictEqual(adresseLesen('#/berichte/kosten/aufgabe/1/review').sicht, 'berichte/kosten');
});

test('reviewAdresseBilden: beide Formen, Verweis URL-kodiert; gelesen ergibt sie wieder dasselbe', () => {
  assert.strictEqual(reviewAdresseBilden({ basis: 'board', slug: 'entwicklung', nummer: 7, commit: `kd:${V1}` }), `#/board/entwicklung/aufgabe/7/review?commit=kd%3A${V1}`);
  assert.strictEqual(reviewAdresseBilden({ basis: 'aufgaben', slug: 'x', nummer: 1, commit: null }), '#/aufgaben/aufgabe/1/review');
  const ziel = { basis: 'board', slug: 'zweit', nummer: 12, commit: `kd:${V1}` };
  const r = adresseLesen(reviewAdresseBilden(ziel));
  assert.deepStrictEqual([r.slug, r.review.basis, r.review.nummer, r.review.commit], ['zweit', 'board', 12, `kd:${V1}`]);
});

// R00221 B1145 (FA 2, ADR-0041 Punkt 1): Laufadresse lesen und bilden — die Kennung ist nur Suchtext
const { laufAdresseBilden } = require('../../web/adresse.js');
const K1 = 'entwickler@2026-11-20T10:00+01:00', K4 = 'a/b c%?@2026-11-20T13:00+01:00';

test('R00221: Laufadresse in Board- und Aufgabenform → Sicht lauf, Fensternummer null, Kennung dekodiert', () => {
  assert.deepStrictEqual(adresseLesen('#/board/fabrik/aufgabe/1/lauf?kennung=entwickler%402026-11-20T10%3A00%2B01%3A00'),
    { sicht: 'lauf', slug: 'fabrik', nummer: null, lauf: { basis: 'board', nummer: 1, kennung: K1 } });
  assert.deepStrictEqual(adresseLesen('#/aufgaben/aufgabe/12/lauf?kennung=a%2Fb%20c%25%3F%402026-11-20T13%3A00%2B01%3A00'),
    { sicht: 'lauf', slug: null, nummer: null, lauf: { basis: 'aufgaben', nummer: 12, kennung: K4 } });
});

test('R00221: Bilden ist die Umkehrung des Lesens, mit encodeURIComponent (AK 4)', () => {
  assert.strictEqual(laufAdresseBilden({ basis: 'board', slug: 'fabrik', nummer: 1, kennung: K1 }), '#/board/fabrik/aufgabe/1/lauf?kennung=entwickler%402026-11-20T10%3A00%2B01%3A00');
  const l4 = laufAdresseBilden({ basis: 'aufgaben', slug: null, nummer: 1, kennung: K4 });
  assert.ok(l4.endsWith('kennung=a%2Fb%20c%25%3F%402026-11-20T13%3A00%2B01%3A00'), l4);
  for (const k of [K1, K4, 'x&y=z#w@1', 'ü @2']) assert.strictEqual(adresseLesen(laufAdresseBilden({ basis: 'board', slug: 's', nummer: 3, kennung: k })).lauf.kennung, k, k);
});

test('R00221: Kennung über 100 Zeichen, mit Steuerzeichen, fehlend oder leer → null; ein + wird Leerzeichen (Inkauf)', () => {
  const lies = roh => adresseLesen('#/board/fabrik/aufgabe/1/lauf' + roh).lauf;
  assert.strictEqual(lies('?kennung=' + 'a'.repeat(100)).kennung, 'a'.repeat(100));
  assert.strictEqual(lies('?kennung=' + 'a'.repeat(101)).kennung, null);
  assert.strictEqual(lies('?kennung=' + 'ü'.repeat(100)).kennung, 'ü'.repeat(100));
  for (const roh of ['?kennung=a%0Ab', '?kennung=a%00b', '?kennung=a%7Fb', '?kennung=a%C2%85b', '', '?', '?kennung=', '?x=1']) assert.strictEqual(lies(roh).kennung, null, roh);
  assert.strictEqual(lies('?kennung=a+b').kennung, 'a b');
  assert.strictEqual(adresseLesen('#/board/fabrik/aufgabe/0/lauf?kennung=x').sicht, 'board');
  assert.strictEqual(adresseLesen('#/board/fabrik/aufgabe/1/laufx?kennung=x').sicht, 'board');
});
