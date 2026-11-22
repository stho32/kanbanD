// Ausgangslage von R00207 (Review-Seite eines Commits): das Arbeits-Repository R von R00204/R00205 ohne die Breitendaten, dazu
// Commit D (#7, alle Merkmale), E und der leere E0 (#8, Budget), F (#9, Nachladen). Gebaut wird mit echtem Git im Test.
"use strict";
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { arbeitsRepositoryBauen, basisAnlegen, gitAls, aufgabeDatei, EINSTELLUNGEN_KOPF } = require('./commits-hilfen');

const ADA = 'Ada Autorin';
const BOESE = '<img src=x onerror=window.pwn=1> "x"';
const ZWEIG_60 = 'review/' + 'z'.repeat(53);

function commitAlles(r, datum, nachricht, ...extra) {
  gitAls(r, ADA, datum, 'add', '-A');
  gitAls(r, ADA, datum, 'commit', '-q', ...extra, '-m', nachricht);
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

const zeilen = (n, kopf) => Array.from({ length: n }, (_, i) => `${kopf} ${i + 1}\n`).join('');

/** E und E0 (#8): vier neue Dateien zu 2.499 Zeilen (je 2.500 gezeichnete Zeilen mit dem Hunk-Kopf), die fünfte mit einer Zeile; E0 leer. */
function budgetCommits(r, h) {
  const tag = '2026-04-01T09:00:00+00:00';
  gitAls(r, ADA, tag, 'checkout', '-q', '--detach', h.k2);
  // leere Vorgänger: E ändert sie (M) und zeichnet dieselben Zeilen wie neue Dateien; neue über 500 Zeilen begännen seit R00235 FA 6 zu
  for (let i = 1; i <= 4; i++) fs.writeFileSync(path.join(r, `budget-${i}.dat`), '');
  commitAlles(r, tag, 'Budget vorbereiten');
  for (let i = 1; i <= 4; i++) fs.writeFileSync(path.join(r, `budget-${i}.dat`), zeilen(2499, `b${i}`));
  fs.writeFileSync(path.join(r, 'budget-5.dat'), 'b5 1\n');
  h.e = commitAlles(r, tag, 'Budget anlegen');
  h.e0 = commitAlles(r, '2026-04-01T10:00:00+00:00', 'leerer Commit', '--allow-empty');
  gitAls(r, ADA, tag, 'branch', 'karte/8', h.e0);
}

/** F (#9) und F2 (#10): 25 Dateien zu 202.019 Byte Patch (R00206 AK 8: 20 mit patch, 5 nachladen) und eine Datei mit 3.001 Zeilen (gross). */
function nachladeCommit(r, h) {
  const tag = '2026-04-02T09:00:00+00:00';
  gitAls(r, ADA, tag, 'checkout', '-q', '--detach', h.k2);
  // leere Vorgänger wie in budgetCommits: F und F2 ändern die 25 Dateien (M), statt sie neu anzulegen (R00235 FA 6)
  for (let i = 1; i <= 25; i++) fs.writeFileSync(path.join(r, `f${String(i).padStart(2, '0')}.dat`), '');
  const vorF = commitAlles(r, tag, '25 leere Dateien');
  const inhalt = ('a'.repeat(99) + '\n').repeat(2000);
  for (let i = 1; i <= 25; i++) fs.writeFileSync(path.join(r, `f${String(i).padStart(2, '0')}.dat`), inhalt);
  fs.writeFileSync(path.join(r, 'gross.dat'), zeilen(3001, 'g'));
  h.f = commitAlles(r, tag, '25 Dateien und eine große');
  gitAls(r, ADA, tag, 'branch', 'karte/9', h.f);
  // F2 (#10, Nacharbeit 1): Geschwister von F mit denselben Pfaden und Größen, anderem Inhalt — dieselben Dateien laden nach
  const tag2 = '2026-04-02T10:00:00+00:00';
  gitAls(r, ADA, tag2, 'checkout', '-q', '--detach', vorF);
  const anders = ('b'.repeat(99) + '\n').repeat(2000);
  for (let i = 1; i <= 25; i++) fs.writeFileSync(path.join(r, `f${String(i).padStart(2, '0')}.dat`), anders);
  fs.writeFileSync(path.join(r, 'gross.dat'), zeilen(3001, 'h'));
  h.f2 = commitAlles(r, tag2, '25 Dateien mit anderem Inhalt');
  gitAls(r, ADA, tag2, 'branch', 'karte/10', h.f2);
}

/** D (#7): drei Hunks mit \r\n, U+2028 und ohne Zeilenende; neu, gelöscht, umbenannt (100 %), Modus, binär, Latin-1, Bidi und
 *  ESC, fremder Text in Pfad, Zeile und Titel, eine Zeile aus 200.000 Zeichen, 3.001 Zeilen, ein Pfad über 4.096 Byte (Plumbing),
 *  ein Pfad aus 200 Zeichen; Titel aus 300 Zeichen auf einem Zweig mit 60 Zeichen. Zuletzt gebaut: der lange Pfad steht nur im Index. */
function merkmalCommit(r, h) {
  const vor = '2026-04-03T09:00:00+00:00', tag = '2026-04-03T10:00:00+00:00';
  gitAls(r, ADA, vor, 'checkout', '-q', '--detach', h.k2);
  fs.writeFileSync(path.join(r, 'text.dat'), zeilen(40, 'zeile'));
  fs.writeFileSync(path.join(r, 'weg.dat'), 'weg 1\n');
  fs.writeFileSync(path.join(r, 'alt-name.dat'), zeilen(5, 'umbenannt'));
  fs.writeFileSync(path.join(r, 'skript.sh'), 'echo hallo\n');
  fs.writeFileSync(path.join(r, 'latin.dat'), 'a\n');
  commitAlles(r, vor, 'Vorgänger von D');
  const text = zeilen(40, 'zeile').split('\n');
  text[1] = 'zeile 2 neu\r';
  text[19] = 'zeile 20   mit Trenner';
  text[37] = 'zeile 38 neu';
  fs.writeFileSync(path.join(r, 'text.dat'), text.slice(0, 40).join('\n'));
  fs.writeFileSync(path.join(r, 'neu.dat'), 'neu 1\n');
  fs.rmSync(path.join(r, 'weg.dat'));
  fs.renameSync(path.join(r, 'alt-name.dat'), path.join(r, 'neu-name.dat'));
  fs.chmodSync(path.join(r, 'skript.sh'), 0o755);
  fs.writeFileSync(path.join(r, 'bild.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
  fs.writeFileSync(path.join(r, 'latin.dat'), Buffer.from([0x61, 0x0a, 0x62, 0xe4, 0x0a]));
  fs.writeFileSync(path.join(r, 'bidi-‮datei.dat'), 'a‮b\u001Bc\td\n');
  fs.writeFileSync(path.join(r, `${BOESE}.dat`), `${BOESE}\n`);
  fs.writeFileSync(path.join(r, 'lang.dat'), 'L'.repeat(200000) + '\n');
  fs.writeFileSync(path.join(r, 'gross.dat'), zeilen(3001, 'g'));
  fs.writeFileSync(path.join(r, 'p'.repeat(196) + '.dat'), 'p\n');
  gitAls(r, ADA, tag, 'add', '-A');
  const blob = execFileSync('git', ['-C', r, 'hash-object', '-w', '--stdin'], { input: 'tief\n', encoding: 'utf8' }).trim();
  const tief = Array.from({ length: 21 }, (_, i) => `t${i}`.padEnd(200, 't')).join('/') + '/x.dat';
  gitAls(r, ADA, tag, 'update-index', '--add', '--cacheinfo', `100644,${blob},${tief}`);
  const titel = (`Merkmale ${BOESE} ` + 'w'.repeat(300)).slice(0, 300);
  // der lange Pfad steht nur im Index: Git warnt beim Prüfen des Arbeitsbaums, das ist hier gewollt und wird nicht gezeigt
  execFileSync('git', ['-C', r, '-c', `user.name=${ADA}`, '-c', 'user.email=ada@example.org', 'commit', '-q', '-m', titel], { env: { ...process.env, GIT_AUTHOR_DATE: tag, GIT_COMMITTER_DATE: tag }, stdio: ['ignore', 'ignore', 'ignore'] });
  h.d = gitAls(r, ADA, tag, 'rev-parse', 'HEAD');
  h.dTitel = titel;
  h.tief = tief;
  gitAls(r, ADA, tag, 'branch', ZWEIG_60, h.d);
}

/** Das Repository der Probe: R00204/R00205 ohne Breitendaten, dazu D, E, E0, F. */
function reviewRepositoryBauen(basis) {
  const h = arbeitsRepositoryBauen(basis, { breiten: false });
  budgetCommits(h.r, h);
  nachladeCommit(h.r, h);
  merkmalCommit(h.r, h);
  return h;
}

let geteilt = null;
/** Ein Repository je Prozess, am Prozessende entfernt (kanbanD liest R nur). */
function reviewRepository() {
  if (!geteilt) {
    const basis = basisAnlegen();
    geteilt = { basis, rep: reviewRepositoryBauen(basis) };
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return geteilt;
}

/** Die Aufgaben der Probe (R00207 „Ausgangslage“): #1 wie R00205, #6 Rand c, #7 Merkmale, #8 Budget, #9 Nachladen, #10 F und F2; Register `kd` → R. */
function reviewVorbereiten(rep, { titel = {} } = {}) {
  const kd = x => `kd:${x}`;
  const aufgaben = {
    1: [kd(rep.k3), kd(rep.w1), kd(rep.v1), kd(rep.v2), kd(rep.r1)],
    6: [kd(rep.v2), `xy:${rep.k1}`],
    7: [kd(rep.d)],
    8: [kd(rep.e), kd(rep.e0)],
    9: [kd(rep.f)],
    10: [kd(rep.f), kd(rep.f2)],
  };
  const register = EINSTELLUNGEN_KOPF + `    kd: {name: KD, wbs: ${rep.r}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`] = aufgabeDatei(nr, titel[nr] || `Aufgabe ${nr}`, verweise);
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${Object.keys(aufgaben).map(n => `- #${n}`).join('\n')}\n\n## In Arbeit\n\n## Erledigt\n`;
  return ordner => {
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

/* ── Ausgangslage von R00235 (Übersicht der Review-Seite): K-Art, K-Rand, K-Budget, K-Doku in `kd`, Aufgabe #3 in `kd` und `wb` ── */

const reihe = (n, kopf) => Array.from({ length: n }, (_, i) => `${kopf} ${i + 1}\n`).join('');
let uhr = 0;
/** Schreibt `aenderungen` (Pfad → Inhalt, null löscht, [alt, neu] benennt um) und committet; liefert den Hash. */
function aenderungsCommit(r, titel, aenderungen) {
  uhr++;
  const datum = `2026-06-01T${String(8 + uhr).padStart(2, '0')}:00:00+00:00`;
  for (const [pfad, inhalt] of Object.entries(aenderungen)) {
    const ort = path.join(r, pfad);
    if (inhalt === null) { fs.rmSync(ort); continue; }
    if (Array.isArray(inhalt)) { fs.mkdirSync(path.dirname(path.join(r, inhalt[0])), { recursive: true }); fs.renameSync(ort, path.join(r, inhalt[0])); fs.writeFileSync(path.join(r, inhalt[0]), inhalt[1]); continue; }
    fs.mkdirSync(path.dirname(ort), { recursive: true });
    fs.writeFileSync(ort, inhalt);
  }
  gitAls(r, ADA, datum, 'add', '-A');
  gitAls(r, ADA, datum, 'commit', '-q', '-m', titel);
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

const ersetzt = (text, von, bis, neu) => { const z = text.split('\n'); z.splice(von, bis - von, ...neu); return z.join('\n'); };

/** `kd`: Vorgänger B0 mit allen alten Fassungen, darauf K-Art, K-Rand, K-Budget, K-Doku und K3 (Aufgabe #3); `wb`: W0, W3. */
function uebersichtBauen(basis) {
  const r = path.join(basis, 'KD'), s = path.join(basis, 'WB');
  for (const ort of [r, s]) {
    fs.mkdirSync(path.join(ort, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(ort, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(ort, ADA, '2026-06-01T08:00:00+00:00', 'init', '-q', '-b', 'main');
  }
  const alt = {
    kontrast: reihe(6, 'kontrast'), r00219: reihe(8, 'ansicht'), css: reihe(8, '.c'), sperre: reihe(20, 'sperre'),
  };
  const h = { r, s };
  h.b0 = aenderungsCommit(r, 'B0 Vorgänger', {
    'Anforderungen/R00001.md': '# R00001\n', 'Dokumentation/Gelerntes.md': '# Gelerntes\n', 'Schaetzungen/S00001.md': '# S00001\n',
    'e2e/einheit/kontrast.test.js': alt.kontrast, 'e2e/tests/r00219-ansicht.spec.js': alt.r00219, 'web/kd-app.css': alt.css,
    'e2e/tests/r00150-alte-leiste.spec.js': reihe(118, 'leiste'), 'e2e/einheit/sperre.test.js': alt.sperre, 'tests/nur-neu.rs': reihe(3, 'nur'),
    'src/lang.rs': 'fn lang() {}\n',
    'Dokumentation/a.md': '', 'src/b.rs': '', 'src/e.rs': '', 'src/f.rs': '', 'tests/c.rs': '', 'tests/g.rs': '',
    'Dokumentation/x.md': '# x\n', 'README.md': '# kd\n', 'src/a.rs': 'fn a() {}\n',
  });
  h.kArt = aenderungsCommit(r, '[R00229] B1187: Sperrform der Leseknöpfe', {
    'Anforderungen/R00001.md': '# R00001\nneu\n', 'Dokumentation/Gelerntes.md': '# Gelerntes\nneu\n', 'Schaetzungen/S00001.md': '# S00001\nneu\n',
    'e2e/einheit/kontrast.test.js': ersetzt(alt.kontrast, 2, 3, ['kontrast neu a', 'kontrast neu b']),
    'e2e/einheit/sperrform.test.js': reihe(143, 'sperrform'),
    'e2e/tests/r00219-ansicht.spec.js': ersetzt(alt.r00219, 3, 5, ['ansicht neu a', 'ansicht neu b']),
    'e2e/tests/r00229-sperrform.spec.js': reihe(150, 'r00229'),
    'web/kd-app.css': ersetzt(alt.css, 3, 6, ['.neu a', '.neu b']),
  });
  h.kRand = aenderungsCommit(r, 'K-Rand', {
    'e2e/tests/r00150-alte-leiste.spec.js': null,
    'e2e/einheit/sperre.test.js': ['e2e/einheit/sperrform-alt.test.js', ersetzt(alt.sperre, 10, 12, ['sperre neu a', 'sperre neu b', 'sperre neu c'])],
    'tests/nur-neu.rs': reihe(3, 'nur') + reihe(4, 'dazu'),
    'tests/fixtures/genau-500.json': reihe(500, 'g500'), 'tests/fixtures/genau-501.json': reihe(501, 'g501'),
    'src/grosse-antwort.json': reihe(1240, 'antwort'), 'src/lang.rs': 'fn lang() {}\n' + reihe(600, '// lang'),
    'Dokumentation/neu.md': reihe(600, 'neu'),
  });
  h.kBudget = aenderungsCommit(r, 'K-Budget', {
    'Dokumentation/a.md': reihe(2499, 'a'), 'src/b.rs': reihe(2499, 'b'), 'src/d.rs': reihe(600, 'd'), 'src/e.rs': reihe(2499, 'e'),
    'src/f.rs': reihe(2499, 'f'), 'tests/c.rs': reihe(2499, 'c'), 'tests/g.rs': reihe(2500, 'g'),
  });
  h.kDoku = aenderungsCommit(r, 'K-Doku', { 'Dokumentation/x.md': '# x\nneu\n', 'README.md': '# kd\nneu\n' });
  h.k3 = aenderungsCommit(r, 'K3', { 'src/a.rs': 'fn a() { neu() }\n', 'tests/a_test.rs': 'fn t() {}\n', 'README.md': '# kd\nneu\nauch\n' });
  aenderungsCommit(s, 'W0 Vorgänger', { 'b.js': 'b();\n' });
  h.w3 = aenderungsCommit(s, 'W3', { 'b.js': 'b(1);\n', 'docs/b.md': '# b\n' });
  return h;
}

let uebersicht = null;
/** Ein Satz Repositories je Prozess, am Prozessende entfernt. */
function uebersichtRepository() {
  if (!uebersicht) {
    const basis = basisAnlegen();
    uebersicht = uebersichtBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return uebersicht;
}

/** Aufgaben: #1 K-Art und K-Doku (Blättern), #2 K-Rand, #3 K3 und W3, #4 K-Budget, #5 K-Doku; Register `kd`, `wb`. */
function uebersichtVorbereiten(h) {
  const aufgaben = { 1: [`kd:${h.kArt}`, `kd:${h.kDoku}`], 2: [`kd:${h.kRand}`], 3: [`kd:${h.k3}`, `wb:${h.w3}`], 4: [`kd:${h.kBudget}`], 5: [`kd:${h.kDoku}`] };
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${h.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    wb: {name: WB, wbs: ${h.s}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/000${nr}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${Object.keys(aufgaben).map(n => `- #${n}`).join('\n')}\n\n## In Arbeit\n\n## Erledigt\n`;
  return ordner => {
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

/* ── Ausgangslage von R00236 (Pfad, VS Code, Patch je Datei): W = „<tmp>/R x“, im Register als Unterordner W/plan; V für `wb` ── */

/** Ein Commit in `r` mit festem Datum je Aufruf; `aenderungen` wie `aenderungsCommit` (Pfad → Inhalt, null löscht, [neu, Inhalt] benennt um). */
function pfadCommit(r, titel, datum, aenderungen, nachAdd = null) {
  for (const [pfad, inhalt] of Object.entries(aenderungen)) {
    const ort = path.join(r, pfad);
    if (inhalt === null) { fs.rmSync(ort); continue; }
    if (Array.isArray(inhalt)) { fs.renameSync(ort, path.join(r, inhalt[0])); continue; }
    fs.mkdirSync(path.dirname(ort), { recursive: true });
    fs.writeFileSync(ort, inhalt);
  }
  gitAls(r, ADA, datum, 'add', '-A');
  if (nachAdd) nachAdd();
  // der lange Pfad steht nur im Index: Git warnt beim Prüfen des Arbeitsbaums, das ist hier gewollt
  execFileSync('git', ['-C', r, '-c', `user.name=${ADA}`, '-c', 'user.email=ada@example.org', 'commit', '-q', '-m', titel], { env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum }, stdio: ['ignore', 'ignore', 'ignore'] });
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

const nummeriert = (n, kopf) => Array.from({ length: n }, (_, i) => `${kopf} ${i + 1}\n`).join('');
const zeileErsetzt = (text, nummer, neu) => text.split('\n').map((z, i) => (i === nummer - 1 ? neu : z)).join('\n');

/** `kd` (W): B0, Aufgabe #4 (K4a, fremder Commit F, K4b), dann K-Pfad, K-Gross und zuletzt K-Lang (der lange Pfad nur im Index);
    `wb` (V): V0 und B4. */
function pfadBauen(basis) {
  const w = path.join(basis, 'R x'), v = path.join(basis, 'V');
  fs.mkdirSync(path.join(w, 'plan'), { recursive: true });
  fs.writeFileSync(path.join(w, 'plan/wbs.md'), '# Plan\n');
  fs.mkdirSync(v, { recursive: true });
  for (const ort of [w, v]) gitAls(ort, ADA, '2026-07-01T08:00:00+00:00', 'init', '-q', '-b', 'main');
  const h = { w, v };
  const a = nummeriert(20, 'a'), nurWeg = nummeriert(23, 'w'), f = nummeriert(40, 'f'), g = nummeriert(10, 'g');
  h.b0 = pfadCommit(w, 'B0 Vorgänger', '2026-07-01T09:00:00+00:00', {
    'src/a.rs': a, 'src/nur-weg.rs': nurWeg, 'alt.rs': nummeriert(5, 'umbenannt'), 'weg.rs': nummeriert(3, 'weg'), 'src/gross.rs': 'alt\n',
    'src/f.rs': f, 'src/g.rs': g,
  });
  h.k4a = pfadCommit(w, 'K4a', '2026-07-01T10:00:00+00:00', { 'src/f.rs': zeileErsetzt(f, 2, 'f 2 karte'), 'src/g.rs': zeileErsetzt(g, 2, 'g 2 karte') });
  const fFremd = zeileErsetzt(zeileErsetzt(f, 2, 'f 2 karte'), 10, 'f 10 fremd');
  h.fremd = pfadCommit(w, 'fremd', '2026-07-01T11:00:00+00:00', { 'src/f.rs': fFremd, 'src/g.rs': zeileErsetzt(zeileErsetzt(g, 2, 'g 2 karte'), 5, 'g 5 fremd') });
  h.k4b = pfadCommit(w, 'K4b', '2026-07-01T12:00:00+00:00', { 'src/f.rs': zeileErsetzt(fFremd, 31, 'f 31 karte'), 'src/g.rs': null });
  h.kPfad = pfadCommit(w, 'K-Pfad', '2026-07-02T09:00:00+00:00', {
    'src/a.rs': zeileErsetzt(a, 13, 'a 13 neu'),
    'src/nur-weg.rs': nummeriert(22, 'w'),
    'a/b?c#d%e:12.rs': 'eins\nzwei\n',
    'alt.rs': ['neu.rs'],
    'bild.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 0, 255, 0]),
    'weg.rs': null,
    'bidi-‮datei.dat': 'b\n',
    'ä.rs': 'ä\n',
  });
  h.kGross = pfadCommit(w, 'K-Gross', '2026-07-02T10:00:00+00:00', { 'src/gross.rs': nummeriert(3001, 'gross') });
  h.lang = Array.from({ length: 21 }, (_, i) => `l${i}`.padEnd(200, 'l')).join('/') + '/x.rs';
  h.kLang = pfadCommit(w, 'K-Lang', '2026-07-02T11:00:00+00:00', {}, () => {
    const blob = execFileSync('git', ['-C', w, 'hash-object', '-w', '--stdin'], { input: 'lang\n', encoding: 'utf8' }).trim();
    gitAls(w, ADA, '2026-07-02T11:00:00+00:00', 'update-index', '--add', '--cacheinfo', `100644,${blob},${h.lang}`);
  });
  pfadCommit(v, 'V0', '2026-07-01T09:00:00+00:00', { 'b.js': nummeriert(10, 'b') });
  h.b4 = pfadCommit(v, 'B4', '2026-07-01T13:00:00+00:00', { 'b.js': zeileErsetzt(nummeriert(10, 'b'), 5, 'b 5 neu') });
  return h;
}

let pfade = null;
/** Ein Satz Repositories je Prozess, am Prozessende entfernt (kanbanD liest sie nur). */
function pfadRepository() {
  if (!pfade) {
    const basis = basisAnlegen();
    pfade = pfadBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return pfade;
}

/** Aufgaben: #1 K-Pfad, K-Gross, K-Lang; #4 K4a, K4b in `kd` und B4 in `wb`. Register `kd` → W/plan, `wb` → V. */
function pfadVorbereiten(h) {
  const aufgaben = { 1: [`kd:${h.kPfad}`, `kd:${h.kGross}`, `kd:${h.kLang}`], 4: [`kd:${h.k4a}`, `kd:${h.k4b}`, `wb:${h.b4}`] };
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, repository: ${JSON.stringify(path.join(h.w, 'plan'))}}\n`
    + `    wb: {name: WB, repository: ${JSON.stringify(h.v)}}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/000${nr}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${Object.keys(aufgaben).map(n => `- #${n}`).join('\n')}\n\n## In Arbeit\n\n## Erledigt\n`;
  return ordner => {
    for (const [rel, inhalt] of Object.entries(dateien)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

module.exports = { reviewRepository, reviewVorbereiten, uebersichtRepository, uebersichtVorbereiten, pfadRepository, pfadVorbereiten, BOESE, ZWEIG_60 };
