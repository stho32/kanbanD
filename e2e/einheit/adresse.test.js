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
    ['#/wbs/kd', 'wbs', null],
    ['#/wbs/kd/I0164', 'wbs', null],
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
