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
/**
 * Erlaubte Übernahmen je Funktion und Ziel: eine zusätzliche Übernahme in einer erlaubten Funktion ist ebenso ein Befund.
 * `offen`/`offenDefekt` in act sind Navigation (der Wert kommt vom Klick: Öffnen, Blättern, Defekt öffnen), keine Antwort.
 */
const ERLAUBT = new Map([
  ['laden', new Map([['Object.assign(S)', 1]])],
  ['dateiLaden', new Map([['ui.datei', 1]])],
  ['defektLaden', new Map([['ui.offen', 1], ['ui.offenDefekt', 1], ['ui.defektDatei', 1]])],
  ['act', new Map([['ui.offen', 2], ['ui.offenDefekt', 1]])],
]);
/** Ladefunktionen: hier steht jede Übernahme textlich hinter einem Aufruf der Prüfung. */
const GEPRUEFT = ['laden', 'dateiLaden', 'defektLaden'];
const ANFANG = /^\s*(?:async )?function (\w+)\(|^(?:document|window)\.addEventListener\('(\w+)'|^(?:const|let|var) (\w+) = (?:async )?(?:\([^)]*\)|\w+) =>/;
/** Eine andere Zeile auf oberster Ebene beendet die umgebende Funktion — außer schließende Klammer, Kommentar und Fortsetzung. */
const OBERSTE_EBENE = /^(?![\s}/*)\]]|$)/;
/** Namen, unter denen eine Datei S.ui führt (`const u = S.ui`). */
const uiAliase = text => [...text.matchAll(/(?:const|let|var|,)\s*(\w+)\s*=\s*S\.ui\b(?!\.)/g)].map(m => m[1]);
/**
 * Übernahme einer Antwort: Zuweisung an S.aufgaben, S.board, S.zustand oder an datei, defektDatei, offen, offenDefekt von S.ui
 * (auch über einen Alias) mit anderem Wert als null oder [] — und jedes Object.assign(S, …) bzw. Object.assign(S.ui, …), denn
 * welche Felder das Objekt trägt, sieht man der Zeile nicht an. Liefert je Treffer das Ziel, z. B. `ui.datei`.
 */
function uebernahmen(zeile, aliase) {
  const ui = ['S\\.ui', ...aliase.map(a => '\\b' + a)].join('|');
  const muster = new RegExp(`\\bS\\.(aufgaben|board|zustand)\\s*=(?!=)(?!\\s*(?:null\\b|\\[\\]))|(?:${ui})\\.(datei|defektDatei|offenDefekt|offen)\\s*=(?!=)(?!\\s*(?:null\\b|\\[\\]))|Object\\.assign\\((S\\.ui|S|${aliase.join('|') || '(?!)'})\\s*,`, 'g');
  return [...zeile.matchAll(muster)].map(m => m[1] || (m[2] ? 'ui.' + m[2] : `Object.assign(${m[3] === 'S' ? 'S' : 'S.ui'})`));
}
/** Aufruf der Prüfung in einer Zeile: `uebernehmen(` oder `aktuell()` — die Definition `const aktuell = () => …` ist keiner. */
const PRUEFAUFRUF = zeile => zeile.includes('aktuell()') || (zeile.includes('uebernehmen(') && !/\b(?:const|let|var)\s+aktuell\s*=/.test(zeile));

/** Quelltexte von web/*.js als { datei, text }. */
const webQuellen = () => fs.readdirSync(WEB).filter(n => n.endsWith('.js')).map(datei => ({ datei, text: fs.readFileSync(path.join(WEB, datei), 'utf8') }));

/** Zeilen je Datei mit ihrer umgebenden Funktion bzw. dem Ereignis des Listeners. */
function zeilenMitFunktion(quellen) {
  const zeilen = [];
  for (const { datei, text } of quellen) {
    let umgebend = '(oben)';
    const aliase = uiAliase(text);
    text.split('\n').forEach((zeile, i) => {
      const anfang = ANFANG.exec(zeile);
      if (anfang) umgebend = anfang[1] || anfang[2] || anfang[3];
      else if (OBERSTE_EBENE.test(zeile)) umgebend = '(oben)';
      zeilen.push({ ort: `${datei}:${i + 1}`, umgebend, zeile, ziele: uebernahmen(zeile, aliase) });
    });
  }
  return zeilen;
}

/** Übernahmen außerhalb der erlaubten Funktionen und Ziele und jede über der erlaubten Anzahl, als „Datei:Zeile in Funktion“. */
function fremdeUebernahmen(quellen = webQuellen()) {
  const gezaehlt = new Map();
  const funde = zeilenMitFunktion(quellen).flatMap(z => z.ziele.map(ziel => ({ ...z, ziel })));
  return funde.filter(f => {
    const schluessel = f.umgebend + ' ' + f.ziel;
    gezaehlt.set(schluessel, (gezaehlt.get(schluessel) || 0) + 1);
    return gezaehlt.get(schluessel) > ((ERLAUBT.get(f.umgebend) || new Map()).get(f.ziel) || 0);
  }).map(f => `${f.ort} in ${f.umgebend}`);
}

/** Ladefunktionen, deren Rumpf uebernehmen( nicht aufruft. */
function ungepruefteUebernahmen(quellen = webQuellen()) {
  const zeilen = zeilenMitFunktion(quellen);
  return GEPRUEFT.filter(name => !zeilen.some(z => z.umgebend === name && z.zeile.includes('uebernehmen(')));
}

/** Übernahmen in den Ladefunktionen, vor denen im Rumpf noch kein Aufruf der Prüfung steht, als „Datei:Zeile in Funktion“. */
function uebernahmenVorDerPruefung(quellen = webQuellen()) {
  const funde = [];
  let funktion = null, geprueft = false;
  for (const z of zeilenMitFunktion(quellen)) {
    if (z.umgebend !== funktion) { funktion = z.umgebend; geprueft = false; }
    if (!GEPRUEFT.includes(funktion)) continue;
    if (z.ziele.length && !geprueft) funde.push(`${z.ort} in ${funktion}`);
    if (PRUEFAUFRUF(z.zeile)) geprueft = true;
  }
  return funde;
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
  const text = 'function schliessen() {\n  const u = S.ui;\n  S.ui.datei = null; S.ui.defektDatei = null; u.offen = null; S.ui.offenDefekt = null;\n  S.aufgaben = []; u.datei = null;\n}\n';
  assert.deepStrictEqual(fremdeUebernahmen([{ datei: 'x.js', text }]), []);
});

test('Wächter: in den Ladefunktionen steht jede Übernahme hinter einem Aufruf der Prüfung', () => {
  assert.deepStrictEqual(uebernahmenVorDerPruefung(), []);
});

test('Wächter erkennt eine Übernahme über den Alias u = S.ui und nennt Datei, Zeile und Funktion', () => {
  const quellen = appMit("        u.datei = await api('GET','/api/aufgaben/1');\n", "case 'tab':");
  const zeile = quellen[0].text.split('\n').findIndex(z => z.includes("u.datei = await api('GET'")) + 1;
  assert.deepStrictEqual(fremdeUebernahmen(quellen), [`app.js:${zeile} in act`]);
});

test('Wächter erkennt Object.assign(S.ui, …) und offen/offenDefekt mit einem Wert als Übernahme', () => {
  const text = 'async function sichtFolgen() {\n  const u = S.ui;\n  Object.assign(S.ui, { datei });\n  Object.assign(u, x);\n  u.offen = nummer;\n  S.ui.offenDefekt = 3;\n}\n';
  assert.deepStrictEqual(fremdeUebernahmen([{ datei: 'x.js', text }]), ['x.js:3 in sichtFolgen', 'x.js:4 in sichtFolgen', 'x.js:5 in sichtFolgen', 'x.js:6 in sichtFolgen']);
});

test('Wächter erkennt eine Übernahme in dateiLaden vor dem ersten Aufruf der Prüfung', () => {
  const text = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
  const anfang = text.indexOf('async function dateiLaden(');
  const ende = text.indexOf('\n}\n', anfang);
  const ohne = text.slice(0, anfang) + text.slice(anfang, ende).replace('    if (!aktuell()) return;\n', '') + text.slice(ende);
  const zeile = ohne.split('\n').findIndex(z => z.includes('S.ui.datei = datei;')) + 1;
  assert.deepStrictEqual(uebernahmenVorDerPruefung([{ datei: 'app.js', text: ohne }]), [`app.js:${zeile} in dateiLaden`]);
});
