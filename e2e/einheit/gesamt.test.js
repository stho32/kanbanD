// R00210: reine Rechnung der Seite „Alle Änderungen“ (web/gesamt.js) — Folge-Dateien, Hinweise in Worten, Summen, Ansage.
const test = require('node:test');
const assert = require('node:assert');
const g = require('../../web/gesamt.js');

const hash = c => c.repeat(40);
const v = c => `kd:${hash(c)}`;
const commit = (c, titel) => ({ verweis: v(c), hash: hash(c), titel, autor: 'sh', datum: '2026-11-20T10:00:00+01:00', plus: 1, minus: 1, dateien: 1 });
const schritt = (c, zusatz = {}) => ({ commit: v(c), alt: 'a.dat', neu: 'a.dat', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-x\n+y\n', ...zusatz });
const folgeDatei = (schritte, zusatz = {}) => ({ pfad: 'a.dat', plus: schritte.reduce((n, s) => n + s.plus, 0), minus: schritte.reduce((n, s) => n + s.minus, 0), binaer: false, schritte, ...zusatz });
const netto = (name, zusatz = {}) => ({ neu: name, alt: null, status: 'A', plus: 3, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -0,0 +1,3 @@\n+1\n+2\n+3\n', ...zusatz });

/* ── B1041 Folge-Datei und Schritte ── */

test('folgeWort: „Folge · 1 Commit“ in der Einzahl, „Folge · 2 Commits“ in der Mehrzahl', () => {
  assert.strictEqual(g.folgeWort(1), 'Folge · 1 Commit');
  assert.strictEqual(g.folgeWort(2), 'Folge · 2 Commits');
});

test('istFolge: ein Eintrag mit schritte ist eine Folge-Datei, ein Netto-Eintrag nicht', () => {
  assert.strictEqual(g.istFolge(folgeDatei([schritt('a')])), true);
  assert.strictEqual(g.istFolge(netto('k.dat')), false);
});

test('schrittKoepfe: Titel über commit wörtlich aus commits, Kurzverweis, Statuswort und Zahlen je Schritt, Ziel ist der Verweis', () => {
  const d = folgeDatei([schritt('a'), schritt('b', { status: 'A', plus: 4, minus: 0 })]);
  const koepfe = g.schrittKoepfe(d, [commit('a', 'Erster'), commit('b', 'Zweiter')]);
  assert.deepStrictEqual(koepfe.map(k => [k.kurz, k.titel, k.wort, k.plus, k.minus, k.ziel]), [
    ['kd:aaaaaaa', 'Erster', 'geändert', 1, 1, v('a')],
    ['kd:bbbbbbb', 'Zweiter', 'neu', 4, 0, v('b')],
  ]);
});

test('schrittKoepfe: Schritt ohne passenden Eintrag in commits → neutraler Kopf ohne Titel und ohne Verweis', () => {
  const [kopf] = g.schrittKoepfe(folgeDatei([schritt('c')]), [commit('a', 'Erster')]);
  assert.deepStrictEqual([kopf.kurz, kopf.titel, kopf.ziel], ['kd:ccccccc', null, null]);
});

test('folgeKopf: Summe aus plus/minus der Antwort (nicht aus dem letzten Schritt), kein Statuswort, Wort nach Zahl der Schritte', () => {
  const d = folgeDatei([schritt('a', { status: 'A', plus: 5, minus: 0 }), schritt('b', { plus: 1, minus: 2 })]);
  assert.deepStrictEqual(g.folgeKopf(d), { pfad: 'a.dat', plus: 6, minus: 2, wort: 'Folge · 2 Commits', statuswort: null });
});

/* ── B1041 Hinweise in Worten (R00210 FA 6, PO Z. 437/440/444) ── */

test('fremd_dazwischen in der Einzahl: 1 fremder Commit, 1 Datei', () => {
  const [h] = g.abschnittHinweise([{ art: 'fremd_dazwischen', commits: 1, dateien: 1 }]).saetze;
  assert.strictEqual(h.text, 'Zwischen den Commits der Aufgabe liegt 1 fremder Commit. Er berührt Dateien der Aufgabe; 1 Datei steht deshalb als Folge der Schritte der Aufgabe. Die Änderungen des fremden Commits sind nicht zu sehen.');
});

test('fremd_dazwischen in der Mehrzahl: 3 fremde Commits, 5 Dateien; Tausenderpunkt', () => {
  const [h] = g.abschnittHinweise([{ art: 'fremd_dazwischen', commits: 3, dateien: 5 }]).saetze;
  assert.strictEqual(h.text, 'Zwischen den Commits der Aufgabe liegen 3 fremde Commits. Sie berühren Dateien der Aufgabe; 5 Dateien stehen deshalb als Folge der Schritte der Aufgabe. Die Änderungen fremder Commits sind nicht zu sehen.');
  const [k] = g.abschnittHinweise([{ art: 'fremd_dazwischen', commits: 1200, dateien: 1 }]).saetze;
  assert.match(k.text, /liegen 1\.200 fremde Commits\. Sie berühren .*; 1 Datei steht deshalb/);
});

test('Satz an der Folge-Datei: bei fremd_dazwischen der Satz zu fremden Commits, bei ganz_als_folge der zur ganzen Folge', () => {
  assert.strictEqual(g.abschnittHinweise([{ art: 'fremd_dazwischen', commits: 1, dateien: 1 }]).folgeSatz, 'Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert. Hier stehen die Schritte der Aufgabe nacheinander; Änderungen fremder Commits fehlen.');
  assert.strictEqual(g.abschnittHinweise([{ art: 'ganz_als_folge', grund: 'nicht_linear' }]).folgeSatz, 'Diese Datei steht als Folge der Schritte der Aufgabe. Hier stehen die Schritte nacheinander; Änderungen fremder Commits fehlen.');
});

test('ganz_als_folge: je Grund ein Satz, dazu „… einen zusammengefassten Diff der ganzen Aufgabe gibt es hier nicht.“; Ort über den Dateien', () => {
  const satz = grund => g.abschnittHinweise([{ art: 'ganz_als_folge', grund }]).ganz;
  const rest = ' Darum steht jede Datei als Folge der Schritte der Aufgabe; einen zusammengefassten Diff der ganzen Aufgabe gibt es hier nicht.';
  assert.strictEqual(satz('nicht_linear'), 'Die Commits der Aufgabe folgen nicht auf einem Zweig aufeinander.' + rest);
  assert.strictEqual(satz('fremd_zu_viele'), 'Zwischen den Commits der Aufgabe liegen mehr als 1.000 fremde Commits.' + rest);
  assert.strictEqual(satz('fremd_zu_gross'), 'Die Commits zwischen denen der Aufgabe sind zu umfangreich, um zu erkennen, welche Dateien sie berühren.' + rest);
  assert.strictEqual(g.abschnittHinweise([]).ganz, null);
});

test('verwaist und merge_ausgelassen: Satz hinter dem Kurzverweis, Ziel „einzeln ansehen“ ist der Verweis', () => {
  const { saetze } = g.abschnittHinweise([{ art: 'verwaist', verweis: v('a') }, { art: 'merge_ausgelassen', verweis: v('b') }]);
  assert.deepStrictEqual(saetze.map(s => [s.art, s.kurz, s.text, s.ziel]), [
    ['verwaist', 'kd:aaaaaaa', 'ist verwaist: Kein Zweig führt zu ihm, darum zählt er hier nicht mit.', v('a')],
    ['merge_ausgelassen', 'kd:bbbbbbb', 'ist ein Merge und in diesem Gesamtbild ausgelassen.', v('b')],
  ]);
});

test('ausgelassen: fehlt steht im Abschnitt, unlesbar und anwendung_unbekannt nicht (die stehen einmal je Seite)', () => {
  const h = g.abschnittHinweise([{ art: 'ausgelassen', verweis: v('c'), zustand: 'fehlt' }, { art: 'ausgelassen', verweis: 'xy:' + hash('a'), zustand: 'anwendung_unbekannt' }, { art: 'ausgelassen', verweis: 'kd:ab\u202Ecd', zustand: 'unlesbar' }]);
  assert.deepStrictEqual(h.ausgelassen.map(e => [e.verweis, e.zustand]), [[v('c'), 'fehlt']]);
  assert.deepStrictEqual(h.saetze, []);
});

test('dateien_gekappt: „2.000 von 2.431 Dateien gezeigt …“ mit Verweis auf „Ein Commit“', () => {
  const [h] = g.abschnittHinweise([{ art: 'dateien_gekappt', gezeigt: 2000, gesamt: 2431 }]).saetze;
  assert.strictEqual(h.text, '2.000 von 2.431 Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; sie lassen sich über „Ein Commit“ lesen.');
});

test('unbekannte Art: neutraler Satz mit dem Namen; weitere_anwendungen und zu_gross_zum_anzeigen ohne Satz im Abschnitt', () => {
  const h = g.abschnittHinweise([{ art: 'neu_art' }, { art: 'weitere_anwendungen', anwendungen: ['wb'] }, { art: 'zu_gross_zum_anzeigen', datei: 'a.dat' }]);
  assert.deepStrictEqual(h.saetze.map(s => [s.art, s.text]), [['unbekannt', 'Die Antwort nennt einen Hinweis „neu_art“, den diese Ansicht nicht kennt.']]);
  assert.strictEqual(h.saetze[0].name, 'neu_art');
});

test('weitereAnwendungen: Kürzel aus dem Hinweis in seiner Reihenfolge, ohne Hinweis leer', () => {
  assert.deepStrictEqual(g.weitereAnwendungen([{ art: 'fremd_dazwischen' }, { art: 'weitere_anwendungen', anwendungen: ['wb', 'xx'] }]), ['wb', 'xx']);
  assert.deepStrictEqual(g.weitereAnwendungen([]), []);
});

test('seitenHinweise: unlesbar und anwendung_unbekannt über alle Abschnitte, entdoppelt nach Verweis, in der Reihenfolge des ersten Auftretens', () => {
  const u = { art: 'ausgelassen', verweis: 'kd:ab\u202Ecd', zustand: 'unlesbar' }, x = { art: 'ausgelassen', verweis: 'xy:' + hash('a'), zustand: 'anwendung_unbekannt' };
  const f = { art: 'ausgelassen', verweis: v('c'), zustand: 'fehlt' };
  const seite = g.seitenHinweise([[x, u, f], [u, x], [x]]);
  assert.deepStrictEqual(seite.map(e => [e.verweis, e.zustand]), [[x.verweis, 'anwendung_unbekannt'], [u.verweis, 'unlesbar']]);
});

/* ── B1041 Keine Änderungen (PO Z. 443) ── */

test('leerSatz: mindestens ein verwaist oder merge_ausgelassen (auch gemischt mit fehlt) → „… in das Gesamtbild einbezogen …“', () => {
  const EINBEZOGEN = 'Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen. Die Commits lassen sich einzeln ansehen.';
  const fehlt = { art: 'ausgelassen', verweis: v('c'), zustand: 'fehlt' };
  assert.strictEqual(g.leerSatz([{ art: 'verwaist', verweis: v('a') }]), EINBEZOGEN);
  assert.strictEqual(g.leerSatz([fehlt, { art: 'verwaist', verweis: v('a') }]), EINBEZOGEN);
  assert.strictEqual(g.leerSatz([fehlt, { art: 'merge_ausgelassen', verweis: v('b') }]), EINBEZOGEN);
});

test('leerSatz: nur fehlt oder anwendung_unbekannt → „Zu den Verweisen dieser Anwendung gibt es keinen Diff.“', () => {
  assert.strictEqual(g.leerSatz([{ art: 'ausgelassen', verweis: v('c'), zustand: 'fehlt' }, { art: 'ausgelassen', verweis: 'xy:1234567', zustand: 'anwendung_unbekannt' }]), 'Zu den Verweisen dieser Anwendung gibt es keinen Diff.');
  assert.strictEqual(g.leerSatz([]), 'Zu den Verweisen dieser Anwendung gibt es keinen Diff.');
});

/* ── B1041 Summen und Ansage (R00210 FA 3, 4) ── */

const antwort2 = { anwendung: 'kd', commits: [commit('a', 'K1'), commit('b', 'K2')], dateien: [folgeDatei([schritt('a'), schritt('b')]), netto('k.dat')], hinweise: [{ art: 'fremd_dazwischen', commits: 1, dateien: 1 }] };

test('abschnittSummen: über die geladenen Abschnitte — #2 hat 2 Dateien, +5 −2; ladende und gescheiterte zählen nicht', () => {
  assert.deepStrictEqual(g.abschnittSummen([{ status: 'da', antwort: antwort2 }, { status: 'laedt' }, { status: 'fehler' }]), { dateien: 2, plus: 5, minus: 2 });
  assert.deepStrictEqual(g.abschnittSummen([{ status: 'da', antwort: antwort2 }, { status: 'da', antwort: { ...antwort2, dateien: [netto('x')] } }]), { dateien: 3, plus: 8, minus: 2 });
});

test('ansageText: Zahlen in Worten mit Tausenderpunkt und Einzahl, nie „+“ oder „−“', () => {
  assert.strictEqual(g.ansageText(2, { dateien: 2, plus: 5, minus: 2 }, []), 'Alle Änderungen der Aufgabe #2: 2 Dateien, 5 Zeilen hinzugefügt, 2 entfernt.');
  assert.strictEqual(g.ansageText(219, { dateien: 13, plus: 1059, minus: 25 }, []), 'Alle Änderungen der Aufgabe #219: 13 Dateien, 1.059 Zeilen hinzugefügt, 25 entfernt.');
  assert.strictEqual(g.ansageText(5, { dateien: 1, plus: 1, minus: 1 }, []), 'Alle Änderungen der Aufgabe #5: 1 Datei, 1 Zeile hinzugefügt, 1 entfernt.');
  assert.strictEqual(g.ansageText(5, { dateien: 0, plus: 0, minus: 0 }, []), 'Alle Änderungen der Aufgabe #5: 0 Dateien, 0 Zeilen hinzugefügt, 0 entfernt.');
  assert.doesNotMatch(g.ansageText(219, { dateien: 13, plus: 1059, minus: 25 }, []), /[+−]/);
});

test('ansageText: jeder gescheiterte Abschnitt einmal mit „ohne Anwendung <kürzel>: ließ sich nicht lesen“', () => {
  assert.strictEqual(g.ansageText(11, { dateien: 9, plus: 40, minus: 3 }, ['wb']), 'Alle Änderungen der Aufgabe #11: 9 Dateien, 40 Zeilen hinzugefügt, 3 entfernt, ohne Anwendung wb: ließ sich nicht lesen.');
  assert.strictEqual(g.ansageText(11, { dateien: 9, plus: 40, minus: 3 }, ['wb', 'xx']), 'Alle Änderungen der Aufgabe #11: 9 Dateien, 40 Zeilen hinzugefügt, 3 entfernt, ohne Anwendung wb: ließ sich nicht lesen, ohne Anwendung xx: ließ sich nicht lesen.');
});

/* ── B1042 Aufklapp-Plan seitenweit (R00210 FA 10, AK 5; ADR-0033 N1.4) ── */

const { aufklappPlanSeite, BUDGET_ZEILEN } = require('../../web/diff.js');
// gezeichnete Zeilen nach R00207 FA 6: ein Hunk-Kopf und n − 1 Zeilen ergeben n
const patchMit = n => '@@ -0,0 +1 @@\n' + '+x\n'.repeat(n - 1);
const nettoZeilen = n => netto('n.dat', { patch: patchMit(n) });
const folgeZeilen = (...je) => folgeDatei(je.map((n, k) => (n === null ? schritt(String.fromCharCode(97 + k), { patch: undefined, gross: true }) : schritt(String.fromCharCode(97 + k), { patch: patchMit(n) }))));
const voll = () => ({ rest: BUDGET_ZEILEN, gesperrt: false, erste: true });

test('aufklappPlanSeite (a): kd 4 × 2.250 = 9.000 offen, danach wb mit 1.500 → 10.500 > 10.000 zu; das Budget gilt über beide Abschnitte', () => {
  const kd = aufklappPlanSeite([nettoZeilen(2250), nettoZeilen(2250), nettoZeilen(2250), nettoZeilen(2250)], [], voll());
  assert.deepStrictEqual(kd.offen, [true, true, true, true]);
  assert.strictEqual(kd.stand.rest, 1000);
  const wb = aufklappPlanSeite([nettoZeilen(1500)], [], kd.stand);
  assert.deepStrictEqual(wb.offen, [false]);
  assert.strictEqual(wb.stand.gesperrt, true);
});

test('aufklappPlanSeite (b): 2.000, dann Folge 3 × 2.800 = 8.400 (10.400 > 10.000) ganz zu, danach bleibt auch die Datei zu 100 zu', () => {
  const plan = aufklappPlanSeite([nettoZeilen(2000), folgeZeilen(2800, 2800, 2800), nettoZeilen(100)], [], voll());
  assert.deepStrictEqual(plan.offen, [true, false, false]);
  assert.strictEqual(plan.stand.gesperrt, true);
});

test('aufklappPlanSeite (c): erste Datei der Seite ist eine Folge 4 × 2.800 mit einem Schritt ohne patch — öffnet ganz; danach 100 zu', () => {
  const plan = aufklappPlanSeite([folgeZeilen(2800, 2800, null, 2800, 2800), nettoZeilen(100)], [], voll());
  assert.deepStrictEqual(plan.offen, [true, false]);
});

test('aufklappPlanSeite: „erste Datei immer“ nur für die erste der Seite — ein späterer Abschnitt öffnet seine erste Datei nicht über das Budget', () => {
  const kd = aufklappPlanSeite([nettoZeilen(9500)], [], voll());
  const wb = aufklappPlanSeite([nettoZeilen(600), nettoZeilen(10)], [], kd.stand);
  assert.deepStrictEqual(wb.offen, [false, false]);
});

test('aufklappPlanSeite: Folge ohne Schritt mit patch zählt nicht und sperrt nicht; ein Schritt ohne patch unterbricht nicht', () => {
  const plan = aufklappPlanSeite([folgeZeilen(null, null), nettoZeilen(9000), folgeZeilen(500, null, 400), nettoZeilen(100)], [], voll());
  assert.deepStrictEqual(plan.offen, [false, true, true, true]);
  assert.strictEqual(plan.stand.rest, 0);
});

/* ── B1042 Reihe der Seite (R00210 FA 8; ADR-0033 N1.2) ── */

test('naechsteAnfrage: nichts, solange eine Anfrage läuft — eine laufende wird nie überholt', () => {
  assert.strictEqual(g.naechsteAnfrage({ laufend: { art: 'anwendung' }, wartend: [{ a: 0, i: 1 }], anwendungen: ['xx'] }), null);
});

test('naechsteAnfrage: eine wartende Datei geht vor noch nicht begonnene Anwendungen, danach die Anwendungen in Reihenfolge', () => {
  assert.deepStrictEqual(g.naechsteAnfrage({ laufend: null, wartend: [{ a: 0, i: 1 }, { a: 1, i: 0 }], anwendungen: ['wb', 'xx'] }), { art: 'datei', a: 0, i: 1 });
  assert.deepStrictEqual(g.naechsteAnfrage({ laufend: null, wartend: [], anwendungen: ['wb', 'xx'] }), { art: 'anwendung', kuerzel: 'wb' });
  assert.strictEqual(g.naechsteAnfrage({ laufend: null, wartend: [], anwendungen: [] }), null);
});

/* ── B1042 Zuordnung der Antwort auf datei= (R00210 FA 11; ADR-0033 N1.6) ── */

test('zuordnenGesamt: Folge über pfad und die Position unter gleichnamigen Folge-Einträgen', () => {
  const erste = folgeDatei([schritt('a')]), zweite = folgeDatei([schritt('b'), schritt('c')]);
  const liste = [netto('a.dat'), erste, zweite];
  const antwort = [{ ...erste, plus: 7 }, { ...zweite, plus: 9 }];
  assert.strictEqual(g.zuordnenGesamt(liste, 2, antwort).plus, 9);
  assert.strictEqual(g.zuordnenGesamt(liste, 1, antwort).plus, 7);
});

test('zuordnenGesamt: Netto über zuordnen (status, alt, neu); fehlt der Eintrag in beiden Arten → null', () => {
  const liste = [netto('k.dat'), netto('l.dat')];
  assert.strictEqual(g.zuordnenGesamt(liste, 1, [netto('k.dat', { plus: 1 }), netto('l.dat', { plus: 2 })]).plus, 2);
  assert.strictEqual(g.zuordnenGesamt(liste, 1, [netto('m.dat')]), null);
});

test('zuordnenGesamt: Artwechsel Netto ↔ Folge — die neue Antwort gilt', () => {
  const nettoA = netto('a.dat', { status: 'M', alt: 'a.dat' }), folgeA = folgeDatei([schritt('a'), schritt('b')]);
  assert.strictEqual(g.zuordnenGesamt([nettoA], 0, [folgeA]), folgeA);
  assert.strictEqual(g.zuordnenGesamt([folgeA], 0, [nettoA]), nettoA);
});

/* ── R00224 B1171: erste Antwort 404 mit zustand — Anwendungen und seitenweite Hinweise aus der Liste der Commits ── */

const eintrag = (anwendung, zustand, c = 'a') => ({ verweis: anwendung ? `${anwendung}:${hash(c)}` : hash(c), anwendung, hash: hash(c), zustand });

test('anwendungenAusListe: jedes Kürzel einmal in der Reihenfolge des ersten Auftretens, auch das leere; unlesbar und anwendung_unbekannt zählen nicht', () => {
  const liste = [eintrag('kd', 'auf_zweig', 'a'), eintrag('xx', 'verwaist', 'b'), eintrag('kd', 'fehlt', 'c'), eintrag('xy', 'anwendung_unbekannt', 'd'), { verweis: 'kd:ab‮cd', anwendung: 'kd2', zustand: 'unlesbar' }, eintrag('', 'repository_fehlt', 'e'), eintrag('wb', 'repository_fehlt', 'f'), eintrag('xx', 'auf_zweig', 'g')];
  assert.deepStrictEqual(g.anwendungenAusListe(liste), ['kd', 'xx', '', 'wb']);
  assert.deepStrictEqual(g.anwendungenAusListe([{ verweis: hash('a'), zustand: 'fehlt' }]), ['']);
  assert.deepStrictEqual(g.anwendungenAusListe([]), []);
});

test('listenHinweise: unlesbar und anwendung_unbekannt der Liste als seitenweite Hinweise, entdoppelt mit denen der Antworten', () => {
  const xy = eintrag('xy', 'anwendung_unbekannt', 'd');
  const unlesbar = { verweis: 'kd:ab‮cd', anwendung: 'kd', zustand: 'unlesbar' };
  const vonListe = g.listenHinweise([eintrag('kd', 'auf_zweig'), xy, unlesbar, eintrag('wb', 'repository_fehlt')]);
  assert.deepStrictEqual(g.seitenHinweise([vonListe]), [{ verweis: xy.verweis, zustand: 'anwendung_unbekannt' }, { verweis: unlesbar.verweis, zustand: 'unlesbar' }]);
  const ausAntwort = [{ art: 'ausgelassen', verweis: xy.verweis, zustand: 'anwendung_unbekannt' }];
  assert.strictEqual(g.seitenHinweise([ausAntwort, vonListe]).length, 2);
});
