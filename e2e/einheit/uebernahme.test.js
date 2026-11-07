// Unit-Tests der Prüfung „nur die neueste Antwort wird übernommen“ (node --test), R00110 / ADR-0014 Regeln 2–4
const test = require('node:test');
const assert = require('node:assert');
const { uebernehmen } = require('../../web/uebernahme.js');

test('eine ältere Antwort als die zuletzt übernommene wird verworfen', () => {
  assert.strictEqual(uebernehmen({ start: 3, zuletzt: 5, marke: 0, schlangeOffen: 0 }), false);
});

test('eine neuere Antwort bei leerer Schlange wird übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 6, zuletzt: 5, marke: 0, schlangeOffen: 0 }), true);
});

test('solange die Warteschlange offen ist, wird nichts übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 6, zuletzt: 5, marke: 0, schlangeOffen: 1 }), false);
});

test('eine Antwort, die vor der Marke der Warteschlange gestartet ist, wird verworfen', () => {
  assert.strictEqual(uebernehmen({ start: 4, zuletzt: 2, marke: 4, schlangeOffen: 0 }), false, 'gleich der Marke');
  assert.strictEqual(uebernehmen({ start: 3, zuletzt: 2, marke: 4, schlangeOffen: 0 }), false, 'vor der Marke');
});

test('eine Antwort nach der Marke wird übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 5, zuletzt: 2, marke: 4, schlangeOffen: 0 }), true);
});

test('dieselbe Nummer wird nicht zweimal übernommen', () => {
  assert.strictEqual(uebernehmen({ start: 5, zuletzt: 5, marke: 0, schlangeOffen: 0 }), false);
});

// Wächter der Übernahmestellen (B0445, PO-Entscheidung Z. 151): eine Antwort landet nur in laden, dateiLaden und defektLaden im Zustand,
// und jede dieser Funktionen fragt uebernehmen(). Ein direktes `S.aufgaben = await api(…)` anderswo umginge ADR-0014 still.
const fs = require('node:fs');
const path = require('node:path');
const WEB = path.join(__dirname, '../../web');
/** Erlaubte Anzahl Übernahmen je Funktion: eine zusätzliche Übernahme in einer erlaubten Funktion ist ebenso ein Befund. */
const ERLAUBT = new Map([['laden', 1], ['dateiLaden', 1], ['defektLaden', 1]]);
const ANFANG = /^\s*(?:async )?function (\w+)\(|^(?:document|window)\.addEventListener\('(\w+)'|^(?:const|let|var) (\w+) = (?:async )?(?:\([^)]*\)|\w+) =>/;
/** Eine andere Zeile auf oberster Ebene beendet die umgebende Funktion — außer schließende Klammer, Kommentar und Fortsetzung. */
const OBERSTE_EBENE = /^(?![\s}/*)\]]|$)/;
/**
 * Übernahme einer Antwort: Zuweisung an eines der fünf Felder mit anderem Wert als null oder [] — und jedes Object.assign(S, …),
 * denn welche Felder das Objekt trägt, sieht man der Zeile nicht an.
 */
const UEBERNAHME = /S\.(?:aufgaben|board|zustand|ui\.datei|ui\.defektDatei)\s*=(?!=)(?!\s*(?:null\b|\[\]))|Object\.assign\(S,/g;

/** Quelltexte von web/*.js als { datei, text }. */
const webQuellen = () => fs.readdirSync(WEB).filter(n => n.endsWith('.js')).map(datei => ({ datei, text: fs.readFileSync(path.join(WEB, datei), 'utf8') }));

/** Zeilen je Datei mit ihrer umgebenden Funktion bzw. dem Ereignis des Listeners. */
function zeilenMitFunktion(quellen) {
  const zeilen = [];
  for (const { datei, text } of quellen) {
    let umgebend = '(oben)';
    text.split('\n').forEach((zeile, i) => {
      const anfang = ANFANG.exec(zeile);
      if (anfang) umgebend = anfang[1] || anfang[2] || anfang[3];
      else if (OBERSTE_EBENE.test(zeile)) umgebend = '(oben)';
      zeilen.push({ ort: `${datei}:${i + 1}`, umgebend, zeile });
    });
  }
  return zeilen;
}

/** Übernahmen außerhalb der erlaubten Funktionen und jede über der erlaubten Anzahl ihrer Funktion, als „Datei:Zeile in Funktion“. */
function fremdeUebernahmen(quellen = webQuellen()) {
  const gezaehlt = new Map();
  const funde = zeilenMitFunktion(quellen).flatMap(z => [...z.zeile.matchAll(UEBERNAHME)].map(() => z));
  return funde.filter(f => {
    gezaehlt.set(f.umgebend, (gezaehlt.get(f.umgebend) || 0) + 1);
    return gezaehlt.get(f.umgebend) > (ERLAUBT.get(f.umgebend) || 0);
  }).map(f => `${f.ort} in ${f.umgebend}`);
}

/** Erlaubte Funktionen, deren Rumpf uebernehmen( nicht aufruft. */
function ungepruefteUebernahmen(quellen = webQuellen()) {
  const zeilen = zeilenMitFunktion(quellen);
  return [...ERLAUBT.keys()].filter(name => !zeilen.some(z => z.umgebend === name && z.zeile.includes('uebernehmen(')));
}

/** web/app.js mit `einschub` hinter der Zeile, die `nach` enthält. */
function appMit(einschub, nach) {
  const text = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
  const stelle = text.indexOf('\n', text.indexOf(nach)) + 1;
  assert.ok(text.includes(nach), nach);
  return [{ datei: 'app.js', text: text.slice(0, stelle) + einschub + text.slice(stelle) }];
}

test('Wächter: eine Antwort wird nur in laden, dateiLaden und defektLaden übernommen, je einmal', () => {
  assert.deepStrictEqual(fremdeUebernahmen(), []);
});

test('Wächter: jede erlaubte Übernahmestelle fragt uebernehmen()', () => {
  assert.deepStrictEqual(ungepruefteUebernahmen(), []);
});

test('Wächter erkennt eine direkte Übernahme in einer anderen Funktion und nennt Datei, Zeile und Funktion', () => {
  const quellen = appMit("  S.aufgaben = (await api('GET', '/api/aufgaben')).aufgaben;\n", 'async function sichtFolgen(');
  const zeile = quellen[0].text.split('\n').findIndex(z => z.includes("S.aufgaben = (await api('GET'")) + 1;
  assert.deepStrictEqual(fremdeUebernahmen(quellen), [`app.js:${zeile} in sichtFolgen`]);
});

test('Wächter erkennt eine zweite Übernahme in einer erlaubten Funktion', () => {
  const quellen = appMit("  S.board = sicht.haupt.board;\n", 'async function laden(');
  assert.deepStrictEqual(fremdeUebernahmen(quellen).map(f => f.replace(/:\d+/, '')), ['app.js in laden']);
});

test('Wächter erkennt dateiLaden ohne den Aufruf von uebernehmen()', () => {
  const text = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
  const anfang = text.indexOf('async function dateiLaden(');
  const ende = text.indexOf('\n}\n', anfang);
  const ohne = text.slice(0, anfang) + text.slice(anfang, ende).replace(/uebernehmen\(/g, 'immerJa(') + text.slice(ende);
  assert.deepStrictEqual(ungepruefteUebernahmen([{ datei: 'app.js', text: ohne }]), ['dateiLaden']);
});

test('Wächter: Rücksetzen auf null oder [] ist keine Übernahme', () => {
  const quellen = [{ datei: 'x.js', text: 'function schliessen() {\n  S.ui.datei = null; S.ui.defektDatei = null;\n  S.aufgaben = [];\n}\n' }];
  assert.deepStrictEqual(fremdeUebernahmen(quellen), []);
});
