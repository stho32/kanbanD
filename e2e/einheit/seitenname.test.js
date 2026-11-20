// Unit-Tests des Seitennamens und der Seitenüberschrift (node --test), R00113 US-1 / ADR-0018 Regel 2
// R00137: der Fenstertitel stammt aus derselben Namensquelle wie die Seitenüberschrift
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { seitenNameVon, seitenUeberschrift, fenstertitelName, BERICHTSNAMEN } = require('../../web/seitenname.js');

test('Seitenname je Ansicht wie der Seitenknopf', () => {
  assert.strictEqual(seitenNameVon('board'), 'Board');
  assert.strictEqual(seitenNameVon('aufgaben'), 'Aufgaben');
  assert.strictEqual(seitenNameVon('personen'), 'Personen');
  assert.strictEqual(seitenNameVon('berichte/verlauf'), 'Berichte');
  assert.strictEqual(seitenNameVon('wbs'), 'WBS');
  assert.strictEqual(seitenNameVon('einrichten'), 'Einrichten');
});

test('Board mit Boardtitel, ohne Board nur der Seitenname', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'board', boardTitel: 'Entwicklung' }), 'Board · Entwicklung');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'board' }), 'Board');
});

test('Bericht mit dem Namen aus dem Menü Berichte', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/verlauf' }), 'Berichte · Burndown');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/kreuz' }), 'Berichte · Zeiten nach Aufgabe und Person');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/fluss' }), 'Berichte · Kumulativer Fluss');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/durchsatz' }), 'Berichte · Durchsatz');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'berichte/unbekannt' }), 'Berichte');
  assert.strictEqual(Object.keys(BERICHTSNAMEN).length, 10);
});

test('WBS mit dem Namen der Anwendung', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'wbs', anwendung: 'kanbanD' }), 'WBS · kanbanD');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'wbs' }), 'WBS');
});

test('erster Start heißt Einrichten, gleich welche Ansicht', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'board', ersterStart: true }), 'Einrichten');
});

test('übrige Seiten tragen nur ihren Namen', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'aufgaben', boardTitel: 'Entwicklung' }), 'Aufgaben');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'personen' }), 'Personen');
  assert.strictEqual(seitenUeberschrift({ ansicht: 'einrichten' }), 'Einrichten');
});

// ---- R00137: Fenstertitel aus derselben Namensquelle wie die Seitenüberschrift ----

const SEITENNAME = path.join(__dirname, '../../web/seitenname.js');
const APP = path.join(__dirname, '../../web/app.js');
const lies = datei => fs.readFileSync(datei, 'utf8');

/** Lädt ein `web/*.js`-Modul aus seinem Text — die Mutantenprobe braucht es, ohne die Datei anzufassen. */
function ladeModul(quelltext) {
  const exports = {};
  new Function('module', 'window', quelltext)({ exports }, exports);
  return exports;
}

/** Die Routen der Anwendung wie die Verzweigungen von vHaupt() (web/app.js) — Board mit und ohne Titel, WBS ohne Sonderform. */
const ROUTEN = [
  { ansicht: 'board', boardTitel: 'Entwicklung' },
  { ansicht: 'board', boardTitel: '' },
  { ansicht: 'aufgaben' },
  { ansicht: 'personen' },
  { ansicht: 'einrichten' },
  ...Object.keys(BERICHTSNAMEN).map(route => ({ ansicht: `berichte/${route}` })),
  { ansicht: 'wbs', anwendung: 'kanbanD' },
];

/** Je Route muss der Namensteil ohne Zähler gleich `seitenUeberschrift + ' — kanbanD'` sein; gibt die Abweichungen zurück. */
function pruefeRoutenTitel(bibliothek) {
  return ROUTEN.flatMap(seite => {
    const titel = bibliothek.fenstertitelName(seite, {});
    const erwartet = `${bibliothek.seitenUeberschrift(seite)} — kanbanD`;
    return titel === erwartet ? [] : [`${seite.ansicht}: „${titel}" statt „${erwartet}"`];
  });
}

/** Die drei Berichtsnamen im Wortlaut aus dem Menü (R00137 AK 2); die Abweichung nennt die Route. */
const BERICHTSNAMEN_WORTLAUT = {
  kreuz: 'Berichte · Zeiten nach Aufgabe und Person',
  fieber: 'Berichte · Projekt-Fever-Chart',
  bestand: 'Berichte · Bestand nach Labels',
};
function pruefeBerichtsnamen(bibliothek) {
  return Object.entries(BERICHTSNAMEN_WORTLAUT).flatMap(([route, name]) => {
    const titel = bibliothek.fenstertitelName({ ansicht: `berichte/${route}` }, {});
    return titel === `${name} — kanbanD` ? [] : [`berichte/${route}: „${titel}" statt „${name} — kanbanD"`];
  });
}

/** Seiten- und Berichtsnamen, die im Rumpf von fenstertitel() nichts zu suchen haben (R00137 AK 3):
    die Namen aus dem Menü samt den kurzen Namen, die die alte zweite Tabelle führte („Zeiten", „Fluss", „Fever Chart", „Bestand"). */
const NAMENSLITERALE = new Set([...Object.values(BERICHTSNAMEN), 'Zeiten', 'Fluss', 'Fever Chart', 'Bestand', 'Aufgaben', 'Personen', 'Einrichten', 'Board', 'WBS']);

/** Der Rumpf von `fenstertitel()` aus dem Quelltext — bis zur schließenden Klammer in erster Spalte. */
function fenstertitelRumpf(quelltext) {
  const beginn = quelltext.indexOf('function fenstertitel()');
  if (beginn < 0) return null;
  const ende = quelltext.indexOf('\n}\n', beginn);
  return quelltext.slice(beginn, ende < 0 ? undefined : ende);
}

/** Verstöße im Rumpf: fehlender Aufruf der Namensquelle und jedes Namensliteral. */
function pruefeFenstertitelRumpf(quelltext) {
  const rumpf = fenstertitelRumpf(quelltext);
  if (rumpf === null) return ['function fenstertitel() nicht gefunden'];
  const fehler = [];
  if (!rumpf.includes('fenstertitelName(')) fehler.push('fenstertitel() ruft fenstertitelName() nicht');
  for (const name of NAMENSLITERALE) {
    if (rumpf.includes(`'${name}'`)) fehler.push(`Namensliteral „${name}"`);
  }
  return fehler;
}

test('R00137: Routenliste deckt die Berichte aus BERICHTSNAMEN und die übrigen Ansichten', () => {
  const berichtsRouten = ROUTEN.filter(route => route.ansicht.startsWith('berichte/')).map(route => route.ansicht.slice('berichte/'.length));
  assert.deepStrictEqual(berichtsRouten.sort(), Object.keys(BERICHTSNAMEN).sort());
  for (const ansicht of ['board', 'aufgaben', 'personen', 'einrichten', 'wbs']) {
    assert.ok(ROUTEN.some(route => route.ansicht === ansicht), `Route fehlt: ${ansicht}`);
  }
});

test('R00137 AK 1: je Route ist der Namensteil gleich der Seitenüberschrift', () => {
  assert.deepStrictEqual(pruefeRoutenTitel(require('../../web/seitenname.js')), []);
});

test('R00137 AK 2: die drei Berichtsnamen im Wortlaut wie im Menü', () => {
  assert.deepStrictEqual(pruefeBerichtsnamen(require('../../web/seitenname.js')), []);
});

test('R00137 AK 3: der Rumpf von fenstertitel() trägt keinen Seiten- oder Berichtsnamen', () => {
  assert.deepStrictEqual(pruefeFenstertitelRumpf(lies(APP)), []);
});

test('R00137 AK 4: Zähler laufender Timer vorn, Anwendungsname hinten', () => {
  assert.strictEqual(fenstertitelName({ ansicht: 'aufgaben' }, { zaehler: 2 }), '(2 ▶) Aufgaben — kanbanD');
  assert.strictEqual(fenstertitelName({ ansicht: 'board', boardTitel: 'Entwicklung' }, { zaehler: 0 }), 'Board · Entwicklung — kanbanD');
});

test('R00137 AK 5: WBS-Sonderform bei gesetztem Stand und Namen', () => {
  assert.strictEqual(fenstertitelName({ ansicht: 'wbs', anwendung: 'kanbanD' }, { wbsStand: 63, wbsName: 'kanbanD' }), '63 % · WBS · kanbanD — kanbanD');
  assert.strictEqual(fenstertitelName({ ansicht: 'wbs', anwendung: 'kanbanD' }, {}), 'WBS · kanbanD — kanbanD');
});

test('R00137 AK 6: ein abweichender Name in seitenname.js wird rot und nennt die Route', () => {
  const mutiert = lies(SEITENNAME).replace("kreuz: 'Zeiten nach Aufgabe und Person',", "kreuz: 'Zeiten',");
  assert.notStrictEqual(mutiert, lies(SEITENNAME), 'Mutante greift nicht');
  assert.deepStrictEqual(pruefeBerichtsnamen(ladeModul(mutiert)), ['berichte/kreuz: „Berichte · Zeiten — kanbanD" statt „Berichte · Zeiten nach Aufgabe und Person — kanbanD"']);
});

test('R00137 AK 6: eine zweite Namensliste in app.js wird rot', () => {
  const mutiert = lies(APP).replace('function fenstertitel() {', "function fenstertitel() {\n  const seiten = { 'berichte/kreuz': 'Zeiten' };");
  assert.notStrictEqual(mutiert, lies(APP), 'Mutante greift nicht');
  assert.deepStrictEqual(pruefeFenstertitelRumpf(mutiert), ['Namensliteral „Zeiten"']);
});

test('Nacharbeit 1 (UX S3): Review ohne Kurzform heißt „Review #<nr>“, nie „Review #<nr> · “', () => {
  assert.strictEqual(seitenUeberschrift({ ansicht: 'review', review: { nummer: 1, kurz: 'kd:abc1234' } }), 'Review #1 · kd:abc1234');
  for (const kurz of ['', null, undefined]) {
    assert.strictEqual(seitenUeberschrift({ ansicht: 'review', review: { nummer: 6, kurz } }), 'Review #6', String(kurz));
    assert.strictEqual(fenstertitelName({ ansicht: 'review', review: { nummer: 6, kurz } }), 'Review #6 — kanbanD', String(kurz));
  }
});
