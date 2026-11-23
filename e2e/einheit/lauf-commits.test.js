// R00251 B1323/B1324: Commit-Marker rein rechnen (ADR-0041 N7 Punkte 2, 3, 8) — Zuordnung über Titel und Autordatum im Fenster des
// Aufrufs, Text-Marker aus der Belegzeile, Grenzen und Zähler der Titelprüfungen. Fälle aus N7 „Durchsetzung“ und T17.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { commitMarker, COMMIT_GRENZEN } = require('../../web/lauf-commits.js');
const { laufAuswerten, eintragPruefen } = require('../../web/lauf.js');
const { T17, T17_COMMITS } = require('../tests/laufansicht-t17.js');

/* ── Treiber: Einträge → Zeilen und Schritte wie in der Laufansicht, Karte aus Commits ── */

function rechnen(eintraege, karte) {
  const zeilen = eintraege.map((o, i) => ({ nr: i + 1, eintrag: eintragPruefen(o) }));
  const { schritte } = laufAuswerten(zeilen, false);
  return commitMarker(zeilen, schritte, karte);
}

const hashVon = (name, nr = 0) => (Buffer.from(`${name}#${nr}`).toString('hex') + '0'.repeat(40)).slice(0, 40);
function karteneintrag(titel, autordatum, { name = titel, zustand = 'auf_zweig', verweis = null } = {}) {
  const hash = hashVon(name);
  return { verweis: verweis === null ? `kd:${hash}` : verweis, hash, zustand, titel, autordatum };
}

/** Die Marker eines Laufs als `{nr: [Titel …]}` — Text-Marker mit „(Text)“ dahinter. */
function uebersicht(ergebnis) {
  const aus = {};
  for (const [nr, liste] of ergebnis.marker) aus[nr] = liste.map(m => (m.art === 'link' ? m.titel : `${m.titel} (Text)`));
  return aus;
}

const T = sekunde => `2026-11-22T11:00:${String(sekunde).padStart(2, '0')}+01:00`;
const EPOCH_11 = Date.parse('2026-11-22T11:00:00+01:00') / 1000;
const aufruf = (zeit, command, name = 'Bash') => ({ zeit, art: 'werkzeugaufruf', wer: 'agent', name, text: JSON.stringify({ command }) });
const ergebnis = (zeit, text = '') => ({ zeit, art: 'werkzeugergebnis', wer: 'werkzeug', text });
const mitKennung = liste => liste.map((e, i) => (e.art === 'werkzeugaufruf' ? { ...e, id: `a${i}` } : e));
/** Aufrufe tragen `id`, Ergebnisse `zu`: [Aufruf-Index, Ergebnis-Eintrag]. */
const paar = (liste, zuordnung) => mitKennung(liste).map((e, i) => (zuordnung[i] === undefined ? e : { ...e, zu: `a${zuordnung[i]}` }));

/* ── T17: die Karte ohne C4, C3 vor C2 in der Reihenfolge der Karte ── */

const T17_KARTE = ['C1', 'C3', 'C2', 'C5a', 'C5b', 'C6'].map(n => T17_COMMITS.find(c => c.name === n)).map(c => karteneintrag(c.titel, c.autordatum, { name: c.name }));

test('AK 1: T17 — Link-Marker an ihrer Stelle, C2 vor C3 nach der Stelle des Titels, ohne Marker bei Tests, --amend, Hook-Abbruch und C6', () => {
  const r = rechnen(T17, T17_KARTE);
  const links = {};
  for (const [nr, liste] of r.marker) {
    const titel = liste.filter(m => m.art === 'link').map(m => m.titel);
    if (titel.length) links[nr] = titel;
  }
  assert.deepStrictEqual(links, {
    2: ['[R00999] B0001: Zähler zuerst'],
    6: ['[R00999] B0002: Zähler zeichnen', '[R00999] B0003: Grenze prüfen'],
    12: ['[R00999] B0004: Nacharbeit'],
    14: ['[R00999] B0004: Nacharbeit'],
  });
  assert.strictEqual(r.marker.get(12)[0].verweis, T17_KARTE[3].verweis, 'C5a zum ersten Schritt mit dem Titel');
  assert.strictEqual(r.marker.get(14)[0].verweis, T17_KARTE[4].verweis, 'C5b zum zweiten (das Fenster trennt sie)');
  assert.strictEqual(r.marker.get(2)[0].kurzhash, T17_KARTE[0].hash.slice(0, 7));
  const alle = [...r.marker.values()].flat().filter(m => m.art === 'link').map(m => m.verweis);
  assert.strictEqual(new Set(alle).size, alle.length, 'kein Commit zweimal');
  assert.ok(!alle.includes(T17_KARTE[5].verweis), 'C6 ohne Aufruf im Lauf');
});

test('AK 1 Rechenbeispiel: Fenster floor(Aufruf) bis floor(Ergebnis) + 1 — eine Sekunde davor und danach nicht', () => {
  const lauf = paar([aufruf('2026-11-22T11:00:10.400+01:00', 'git commit -q -m "Zähler zuerst"'), ergebnis('2026-11-22T11:00:12.900+01:00')], { 1: 0 });
  const mit = s => uebersicht(rechnen(lauf, [karteneintrag('Zähler zuerst', EPOCH_11 + s)]));
  assert.deepStrictEqual(mit(13), { 1: ['Zähler zuerst'] }, 'floor(12,9) + 1 = 13 liegt darin');
  assert.deepStrictEqual(mit(10), { 1: ['Zähler zuerst'] }, 'floor(10,4) = 10 liegt darin');
  assert.deepStrictEqual(mit(14), {}, '14 läge außerhalb');
  assert.deepStrictEqual(mit(9), {}, '9 läge außerhalb');
});

test('AK 1 Rechenbeispiel: Schritt 14/15 → 39 bis 41, C5b (39) liegt darin, 38 nicht', () => {
  const lauf = paar([aufruf('2026-11-22T11:01:39.800+01:00', 'git commit -q -m "Nacharbeit"'), ergebnis('2026-11-22T11:01:40.200+01:00')], { 1: 0 });
  const mit = s => uebersicht(rechnen(lauf, [karteneintrag('Nacharbeit', EPOCH_11 + 60 + s)]));
  assert.deepStrictEqual(mit(39), { 1: ['Nacharbeit'] });
  assert.deepStrictEqual(mit(41), { 1: ['Nacharbeit'] });
  assert.deepStrictEqual(mit(38), {});
  assert.deepStrictEqual(mit(42), {});
});

test('AK 2: zwei überlappende Aufrufe mit je einem Titel — jeder bekommt seinen Commit', () => {
  const lauf = paar([aufruf(T(10), 'git commit -q -m "Erster Titel A"'), aufruf(T(11), 'git commit -q -m "Zweiter Titel B"'), ergebnis(T(14)), ergebnis(T(15))], { 2: 0, 3: 1 });
  const karte = [karteneintrag('Zweiter Titel B', EPOCH_11 + 12), karteneintrag('Erster Titel A', EPOCH_11 + 13)];
  assert.deepStrictEqual(uebersicht(rechnen(lauf, karte)), { 1: ['Erster Titel A'], 2: ['Zweiter Titel B'] });
});

test('AK 2: zwei überlappende Aufrufe ohne Titel-Treffer und zwei Commits im Fenster — kein Marker', () => {
  const lauf = paar([aufruf(T(10), 'git commit -q -F nachricht-a.txt'), aufruf(T(11), 'git commit -q -F nachricht-b.txt'), ergebnis(T(14)), ergebnis(T(15))], { 2: 0, 3: 1 });
  const karte = [karteneintrag('Titel aus Datei A', EPOCH_11 + 12), karteneintrag('Titel aus Datei B', EPOCH_11 + 13)];
  assert.deepStrictEqual(uebersicht(rechnen(lauf, karte)), {});
});

test('AK 2: maskierter Titel (", $, Backtick) — Rückfall nur, wenn allein im Fenster und einziger Schritt mit „commit“', () => {
  for (const titel of ['Feld "x" prüfen', 'Preis $5 zeigen', 'Knopf `ok` setzen']) {
    const maskiert = titel.replace(/(["$`])/g, '\\$1');
    const allein = paar([aufruf(T(10), `git commit -q -m "${maskiert}"`), ergebnis(T(12))], { 1: 0 });
    assert.deepStrictEqual(uebersicht(rechnen(allein, [karteneintrag(titel, EPOCH_11 + 11)])), { 1: [titel] }, titel);
    const zweiCommits = [karteneintrag(titel, EPOCH_11 + 11), karteneintrag('anderer Commit dazu', EPOCH_11 + 12, { name: 'x' })];
    assert.deepStrictEqual(uebersicht(rechnen(allein, zweiCommits)), {}, `${titel}: zwei Commits im Fenster`);
    const zweiSchritte = paar([aufruf(T(10), `git commit -q -m "${maskiert}"`), aufruf(T(11), 'git commit -q --amend --no-edit'), ergebnis(T(12)), ergebnis(T(13))], { 2: 0, 3: 1 });
    assert.deepStrictEqual(uebersicht(rechnen(zweiSchritte, [karteneintrag(titel, EPOCH_11 + 11)])), {}, `${titel}: zwei Schritte mit „commit“ im Fenster`);
    const ohneWort = paar([aufruf(T(10), `git commit -q -m "${maskiert}"`), aufruf(T(11), 'cargo test -q'), ergebnis(T(12)), ergebnis(T(13))], { 2: 0, 3: 1 });
    assert.deepStrictEqual(uebersicht(rechnen(ohneWort, [karteneintrag(titel, EPOCH_11 + 11)])), { 1: [titel] }, `${titel}: der zweite Schritt sagt kein „commit“`);
  }
});

test('AK 2: Rückfall nimmt keinen Commit, der per Titel schon einem anderen Schritt gehört', () => {
  const lauf = paar([aufruf(T(10), 'echo "Gemeinsamer Titel" > nachricht && git ci -F nachricht'), ergebnis(T(12)), aufruf(T(12.5), 'git commit -q -F datei'), ergebnis(T(14))], { 1: 0, 3: 2 });
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Gemeinsamer Titel', EPOCH_11 + 13)])), { 1: ['Gemeinsamer Titel'] }, 'Schritt 3 ist der einzige mit „commit“, der Commit gehört aber per Titel Schritt 1');
});

test('AK 2: ein Commit gehört höchstens einem Schritt — bei zwei Titel-Treffern der frühere', () => {
  const lauf = paar([aufruf(T(10), 'git commit -q -m "Doppelt im Fenster"'), ergebnis(T(12)), aufruf(T(13), 'git commit -q -m "Doppelt im Fenster"'), ergebnis(T(14))], { 1: 0, 3: 2 });
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Doppelt im Fenster', EPOCH_11 + 13)])), { 1: ['Doppelt im Fenster'] });
});

test('AK 2: Schritt ohne name, Nicht-Bash-Schritt und Eintrag ohne zeit ergeben keinen Marker', () => {
  const karte = [karteneintrag('Titel im Befehl', EPOCH_11 + 11)];
  const ohneName = paar([{ ...aufruf(T(10), 'git commit -q -m "Titel im Befehl"'), name: undefined }, ergebnis(T(12))], { 1: 0 });
  delete ohneName[0].name;
  assert.deepStrictEqual(uebersicht(rechnen(ohneName, karte)), {});
  assert.deepStrictEqual(uebersicht(rechnen(paar([aufruf(T(10), 'git commit -q -m "Titel im Befehl"', 'Edit'), ergebnis(T(12))], { 1: 0 }), karte)), {});
  const ohneZeitAufruf = paar([{ ...aufruf(T(10), 'git commit -q -m "Titel im Befehl"'), zeit: undefined }, ergebnis(T(12))], { 1: 0 });
  delete ohneZeitAufruf[0].zeit;
  assert.deepStrictEqual(uebersicht(rechnen(ohneZeitAufruf, karte)), {});
  const ohneZeitErgebnis = paar([aufruf(T(10), 'git commit -q -m "Titel im Befehl"'), { ...ergebnis(T(12)), zeit: 'gestern' }], { 1: 0 });
  assert.deepStrictEqual(uebersicht(rechnen(ohneZeitErgebnis, karte)), {});
});

test('AK 2: Aufruf ohne Ergebnis hat das Fenster bis zur nächsten zeit (wie ein Ergebnis zu dieser Zeit)', () => {
  const lauf = [aufruf(T(10), 'git commit -q -m "Ohne Ergebnis im Lauf"'), { zeit: T(20), art: 'nachricht', wer: 'agent', text: 'weiter' }];
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Ohne Ergebnis im Lauf', EPOCH_11 + 20)])), { 1: ['Ohne Ergebnis im Lauf'] });
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Ohne Ergebnis im Lauf', EPOCH_11 + 21)])), { 1: ['Ohne Ergebnis im Lauf'] }, 'die nächste Zeit steht für die des Ergebnisses: floor + 1');
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Ohne Ergebnis im Lauf', EPOCH_11 + 22)])), {});
  const amEnde = [aufruf(T(10), 'git commit -q -m "Ohne Ergebnis im Lauf"')];
  assert.deepStrictEqual(uebersicht(rechnen(amEnde, [karteneintrag('Ohne Ergebnis im Lauf', EPOCH_11 + 10)])), {}, 'ohne spätere Zeit kein Fenster');
});

test('Titel-Treffer: die ersten 60 Zeichen roh; Reihenfolge der Karte bei gleicher Sekunde ohne Titelstelle', () => {
  const lang = 'L'.repeat(60) + ' danach anders';
  const lauf = paar([aufruf(T(10), `git commit -q -m "${'L'.repeat(60)} gekürzt im Befehl"`), ergebnis(T(12))], { 1: 0 });
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag(lang, EPOCH_11 + 11)])), { 1: [lang] });
  const kurz = paar([aufruf(T(10), `git commit -q -m "${'L'.repeat(59)}"`), aufruf(T(10), 'git commit -q -m "zweiter Schritt"'), ergebnis(T(12)), ergebnis(T(12))], { 2: 0, 3: 1 });
  assert.deepStrictEqual(uebersicht(rechnen(kurz, [karteneintrag(lang, EPOCH_11 + 11)])), {}, '59 Zeichen reichen nicht, Rückfall nicht eindeutig');
});

test('Zustände: fehlt, repository_fehlt, anwendung_unbekannt, unlesbar und Verweise außerhalb von VERWEIS_FORM werden nie zugeordnet', () => {
  const lauf = paar([aufruf(T(10), 'git commit -q -m "Titel im Befehl"'), ergebnis(T(12))], { 1: 0 });
  for (const zustand of ['fehlt', 'repository_fehlt', 'anwendung_unbekannt', 'unlesbar']) {
    assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Titel im Befehl', EPOCH_11 + 11, { zustand })])), {}, zustand);
  }
  assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Titel im Befehl', EPOCH_11 + 11, { zustand: 'verwaist' })])), { 1: ['Titel im Befehl'] });
  for (const verweis of ['kd:../x', 'kd:abc 1234', 'javascript:alert(1)', 'kd:abcdef']) {
    assert.deepStrictEqual(uebersicht(rechnen(lauf, [karteneintrag('Titel im Befehl', EPOCH_11 + 11, { verweis })])), {}, verweis);
  }
  const ohneAutordatum = [{ ...karteneintrag('Titel im Befehl', EPOCH_11 + 11), autordatum: '1795341611' }];
  assert.deepStrictEqual(uebersicht(rechnen(lauf, ohneAutordatum)), {}, 'Autordatum nur als ganze Zahl');
});

/* ── AK 10: Zähler der Titelprüfungen ── */

test('AK 10 Rechenbeispiel: 3 Schritte mit 0, 1, 2 Commits im Fenster → 3 Titelprüfungen', () => {
  const lauf = paar([aufruf(T(0), 'git commit -q -m "a"'), ergebnis(T(1)), aufruf(T(10), 'git commit -q -m "b"'), ergebnis(T(11)), aufruf(T(20), 'git commit -q -m "c"'), ergebnis(T(21))], { 1: 0, 3: 2, 5: 4 });
  const karte = [karteneintrag('x1', EPOCH_11 + 11), karteneintrag('x2', EPOCH_11 + 21), karteneintrag('x3', EPOCH_11 + 22), karteneintrag('x4', EPOCH_11 + 40)];
  assert.strictEqual(rechnen(lauf, karte).titelpruefungen, 3);
});

test('AK 10: 5.000 Bash-Schritte × 500 Commits, je Schritt höchstens 2 im Fenster → Prüfungen ≤ Paare ≤ 10.000; Befehl über 64 KiB nicht durchsucht', () => {
  const lauf = [];
  for (let i = 0; i < 5000; i++) {
    const beginn = new Date((EPOCH_11 + i * 10) * 1000).toISOString();
    const ende = new Date((EPOCH_11 + i * 10 + 2) * 1000).toISOString();
    lauf.push(aufruf(beginn, `git commit -q -m "Schritt ${i}"`), ergebnis(ende));
  }
  const karte = [];
  for (let k = 0; k < 250; k++) {
    karte.push(karteneintrag(`Schritt ${k * 20}`, EPOCH_11 + k * 200 + 1, { name: `k${k}` }));
    karte.push(karteneintrag(`fremder Titel ${k}`, EPOCH_11 + k * 200 + 2, { name: `f${k}` }));
  }
  const start = process.hrtime.bigint();
  const r = rechnen(paar(lauf, Object.fromEntries(lauf.map((e, i) => [i, i - 1]).filter(([i]) => i % 2 === 1))), karte);
  const dauerMs = Number(process.hrtime.bigint() - start) / 1e6;
  assert.strictEqual(r.titelpruefungen, 500, 'genau die 500 Paare (Schritt, Commit im Fenster), nie 5.000 × 500');
  assert.strictEqual([...r.marker.values()].flat().length, 250);
  console.log(`Beobachtung: 5.000 Schritte × 500 Commits samt Auswertung in ${dauerMs.toFixed(1)} ms`);
  const riesig = paar([aufruf(T(10), `git commit -q -m "Titel im Befehl" ${'x'.repeat(COMMIT_GRENZEN.befehl)}`), ergebnis(T(12))], { 1: 0 });
  const r2 = rechnen(riesig, [karteneintrag('Titel im Befehl', EPOCH_11 + 11)]);
  assert.deepStrictEqual([r2.titelpruefungen, uebersicht(r2)], [0, {}]);
});

/* ── B1324: Text-Marker aus der Belegzeile (N7 Punkt 3) und Grenze der Marker (N7 Punkt 8) ── */

test('AK 5: T17 — Schritt 8/9 bekommt den Text-Marker „e5f6a7b [DOC] Anforderung angelegt“, sonst keiner', () => {
  const r = rechnen(T17, T17_KARTE);
  assert.deepStrictEqual(r.marker.get(8), [{ art: 'text', kurzhash: 'e5f6a7b', titel: '[DOC] Anforderung angelegt' }]);
  assert.deepStrictEqual(Object.keys(uebersicht(r)), ['2', '6', '8', '12', '14']);
});

test('AK 5/AK 6: ohne Commits der Karte (Fehler, Frist, Repository fehlt) steht nur der Text-Marker zu C4', () => {
  for (const karte of [null, [], T17_KARTE.map(e => ({ verweis: e.verweis, hash: e.hash, zustand: 'repository_fehlt' }))]) {
    assert.deepStrictEqual(uebersicht(rechnen(T17, karte)), { 8: ['[DOC] Anforderung angelegt (Text)'] }, JSON.stringify(karte && karte[0]));
  }
});

test('AK 5: Belegzeile [zweig hash] titel und hash titel; Titel unter 12 Zeichen oder nicht im Befehl ergibt keinen Marker', () => {
  const schritt = (befehl, text) => paar([aufruf(T(10), befehl), ergebnis(T(12), text)], { 1: 0 });
  const mit = (befehl, text) => rechnen(schritt(befehl, text), []).marker.get(1);
  assert.deepStrictEqual(mit('git commit -m "Zähler zeichnen jetzt"', '[karte/7 3f2a9c1] Zähler zeichnen jetzt\n 1 file changed'), [{ art: 'text', kurzhash: '3f2a9c1', titel: 'Zähler zeichnen jetzt' }]);
  assert.deepStrictEqual(mit('git commit -m "Zähler zeichnen jetzt"', '[main (root-commit) 3f2a9c1e0b7d] Zähler zeichnen jetzt'), [{ art: 'text', kurzhash: '3f2a9c1', titel: 'Zähler zeichnen jetzt' }]);
  assert.deepStrictEqual(mit('git commit -qm "Zähler zeichnen jetzt" && git log --oneline -1', '3f2a9c1e Zähler zeichnen jetzt'), [{ art: 'text', kurzhash: '3f2a9c1', titel: 'Zähler zeichnen jetzt' }]);
  assert.strictEqual(mit('git commit -qm "kurz" && git log --oneline -1', 'abc1234 kurz'), undefined, 'Titel unter 12 Zeichen');
  assert.strictEqual(mit('git commit -qm "B0001: anders" && git log --oneline -1', 'abc1234 B0001: ganz etwas anderes'), undefined, 'Titel nicht im Befehl');
  assert.strictEqual(mit('cat log.txt # Zähler zeichnen jetzt', 'abc1234 Zähler zeichnen jetzt'), undefined, 'nur Bash-Aufrufe mit „commit“ im Befehl');
});

test('AK 9: Hash der Belegzeile nur bei ^[0-9a-f]{7,40}$ — Großbuchstaben, Nicht-Hex und < ergeben einen Text-Marker ohne Hash', () => {
  const befehl = 'git commit -q -m "[DOC] Anforderung angelegt" && git log --oneline -1';
  for (const zeile of ['ABC1234X [DOC] Anforderung angelegt', 'ABC1234 [DOC] Anforderung angelegt', 'abc<123 [DOC] Anforderung angelegt', '[main ABC1234X] [DOC] Anforderung angelegt']) {
    const r = rechnen(paar([aufruf(T(10), befehl), ergebnis(T(12), zeile)], { 1: 0 }), []);
    assert.deepStrictEqual(r.marker.get(1), [{ art: 'text', kurzhash: null, titel: '[DOC] Anforderung angelegt' }], zeile);
  }
});

test('AK 9: ein Schritt mit Commit der Karte bekommt keinen Text-Marker; Hash und Titel kommen aus der Karte, nie aus dem Transkript', () => {
  const befehl = 'git commit -q -m "[R00999] B0002: Zähler zeichnen" && git log --oneline -1';
  const lauf = paar([aufruf(T(10), befehl), ergebnis(T(12), 'e5f6a7b [R00999] B0002: Zähler zeichnen')], { 1: 0 });
  const karte = [karteneintrag('[R00999] B0002: Zähler zeichnen', EPOCH_11 + 11, { name: 'C2' })];
  assert.deepStrictEqual(rechnen(lauf, karte).marker.get(1), [{ art: 'link', verweis: karte[0].verweis, kurzhash: karte[0].hash.slice(0, 7), titel: karte[0].titel }]);
});

/** Lauf mit `anzahl` Commit-Schritten: die ersten `text` mit Belegzeile, die übrigen mit je einem Commit der Karte im Fenster. */
function grosserLauf(anzahl, text) {
  const lauf = [], karte = [];
  for (let i = 0; i < anzahl; i++) {
    const titel = `Commit Nummer ${String(i).padStart(4, '0')}`;
    const beginn = EPOCH_11 + i * 10;
    lauf.push(aufruf(new Date(beginn * 1000).toISOString(), `git commit -q -m "${titel}" && git log --oneline -1`));
    lauf.push(ergebnis(new Date((beginn + 2) * 1000).toISOString(), i < text ? `abc1234 ${titel}` : ''));
    if (i >= text) karte.push(karteneintrag(titel, beginn + 1, { name: `g${i}` }));
  }
  return rechnen(paar(lauf, Object.fromEntries(lauf.map((e, i) => [i, i - 1]).filter(([i]) => i % 2 === 1))), karte);
}

test('AK 10: 1.200 zuordenbare Commit-Schritte (500 der Karte, 700 Belegzeilen) → genau 1.000 Marker, die ersten des Laufs, und der Satz', () => {
  const r = grosserLauf(1200, 700);
  const alle = [...r.marker.entries()].flatMap(([nr, liste]) => liste.map(m => ({ nr, art: m.art })));
  assert.strictEqual(alle.length, COMMIT_GRENZEN.marker);
  assert.deepStrictEqual([alle.filter(m => m.art === 'text').length, alle.filter(m => m.art === 'link').length], [700, 300]);
  assert.strictEqual(alle[999].nr, 999 * 2 + 1, 'der 1.000. Commit-Schritt ist der letzte mit Marker');
  assert.strictEqual(r.mehrAlsGrenze, true);
  const genau = grosserLauf(1000, 500);
  assert.deepStrictEqual([[...genau.marker.values()].flat().length, genau.mehrAlsGrenze], [1000, false], 'genau 1.000: kein Satz');
});

test('Grenze: höchstens 500 Commits der Karte werden gelesen', () => {
  const lauf = paar([aufruf(T(10), 'git commit -q -m "Der fünfhundertunderste"'), ergebnis(T(12))], { 1: 0 });
  const karte = Array.from({ length: 500 }, (_, i) => karteneintrag(`fremd ${i}`, EPOCH_11 - 1000, { name: `f${i}` }));
  karte.push(karteneintrag('Der fünfhundertunderste', EPOCH_11 + 11));
  assert.deepStrictEqual(uebersicht(rechnen(lauf, karte)), {});
  assert.deepStrictEqual(uebersicht(rechnen(lauf, karte.slice(1))), { 1: ['Der fünfhundertunderste'] });
});

/* ── B1325: Satz im Kopf (FA 5, FA 9; PO Z. 660, 690) ── */

test('AK 6/AK 10: Satz im Kopf unmittelbar nach „Werkzeuge … · Denken …“ in der Kachel Gesamtdauer, gedämpft, ohne role und aria-live', () => {
  const { laufKopfHtml } = require('../../web/lauf.js');
  const zeilen = T17.map((o, i) => ({ nr: i + 1, eintrag: eintragPruefen(o) }));
  const auswertung = laufAuswerten(zeilen, false);
  const esc = t => String(t);
  const kopf = commits => laufKopfHtml({ zustand: 'eintraege', auswertung, kosten: null, commits }, esc);
  const kachel = html => /<div class="lv-gd">(.*?)<\/div>/.exec(html)[1];
  const ohne = kachel(kopf({ nichtLesbar: false, mehrAlsGrenze: false }));
  assert.strictEqual(kachel(kopf(undefined)), ohne, 'ohne Angabe wie ohne Satz');
  assert.ok(!ohne.includes('lv-cn'));
  const NICHT_LESBAR = '<span class="lv-cn">Commits der Karte nicht lesbar</span>';
  const GRENZE = '<span class="lv-cn">Mehr als 1.000 Commits im Lauf, markiert sind die ersten 1.000.</span>';
  assert.strictEqual(kachel(kopf({ nichtLesbar: true, mehrAlsGrenze: false })), ohne + NICHT_LESBAR);
  assert.strictEqual(kachel(kopf({ nichtLesbar: false, mehrAlsGrenze: true })), ohne + GRENZE);
  assert.strictEqual(kachel(kopf({ nichtLesbar: true, mehrAlsGrenze: true })), ohne + NICHT_LESBAR + GRENZE, 'beide, je eine Zeile, erst nicht lesbar');
  assert.ok(/<span class="auf">Werkzeuge [^<]*<\/span>$/.test(ohne), ohne);
  assert.ok(!/role=|aria-live/.test(kachel(kopf({ nichtLesbar: true, mehrAlsGrenze: true }))));
});

test('web/lauf-commits.js überschreibt im Browser keinen Namen eines anderen Moduls und keinen globalen aus ansicht.js und app.js (Lehre #217)', () => {
  const fs = require('node:fs'), path = require('node:path');
  const ordner = path.join(__dirname, '../../web');
  const namen = datei => [...fs.readFileSync(path.join(ordner, datei), 'utf8').matchAll(/Object\.assign\(ziel, \{([^}]*)\}\);/g)]
    .flatMap(m => m[1].split(',').map(n => n.trim().split(':')[0].trim()).filter(Boolean));
  const eigene = namen('lauf-commits.js');
  assert.deepStrictEqual(eigene, ['commitMarker', 'COMMIT_GRENZEN']);
  for (const datei of fs.readdirSync(ordner).filter(d => d.endsWith('.js') && d !== 'lauf-commits.js')) assert.deepStrictEqual(namen(datei).filter(n => eigene.includes(n)), [], datei);
  const global = fs.readFileSync(path.join(ordner, 'ansicht.js'), 'utf8') + fs.readFileSync(path.join(ordner, 'app.js'), 'utf8');
  for (const n of eigene) assert.doesNotMatch(global, new RegExp(`^(function|const|let|async function) ${n}\\b`, 'm'), n);
  assert.match(fs.readFileSync(path.join(ordner, 'index.html'), 'utf8'), /<script src="\/web\/lauf-commits\.js"><\/script>\n<script src="\/web\/lauf-satz\.js"><\/script>\n<script src="\/web\/lauf\.js"><\/script>/, 'vor app.js geladen');
});
