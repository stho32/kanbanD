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
  gitAls(r, ADA, datum, 'commit', '-q', '--allow-empty', '-m', titel);
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

/* ── Ausgangslage von R00245 (Commit-Leiste und verdichteter Commit-Kopf): `kd` mit K-Leiste, K-Rand, 30 Commits, `wb` mit W1 ── */

/** Ein Commit auf `eltern` (losgelöst ausgecheckt), Dateien wie `aenderungsCommit`; Datum mit `+01:00`. */
function leisteCommit(r, eltern, titel, datum, aenderungen) {
  gitAls(r, ADA, datum, 'checkout', '-q', '--detach', eltern);
  for (const [pfad, inhalt] of Object.entries(aenderungen)) fs.writeFileSync(path.join(r, pfad), inhalt);
  gitAls(r, ADA, datum, 'add', '-A');
  gitAls(r, ADA, datum, 'commit', '-q', '--allow-empty', '-m', titel);
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

/** Ein Merge-Commit (nicht an einer Aufgabe) mit den Eltern `eltern`: hält Commits auf einem Zweig, ohne sie zu Vorfahren zu machen. */
function zusammen(r, eltern) {
  return gitAls(r, ADA, '2026-11-22T06:00:00+01:00', 'commit-tree', `${eltern[0]}^{tree}`, ...eltern.flatMap(e => ['-p', e]), '-m', 'zusammen');
}

const LANGER_TITEL = '[R00229] B1188: ' + 'Mutanten getötet und Zeilen gezählt, '.repeat(3).slice(0, 104);
const KENNUNG_40 = '[' + 'A'.repeat(40) + ']';
const BIDI_ZWEIG = 'bidi-‮-zweig';

/** Jeder Commit hängt an B0, damit „+<k> Zweige“ nur die Zweige zählt, die ihn wirklich enthalten (Merges halten ihn auf `main`). */
function leisteBauen(basis) {
  const r = path.join(basis, 'KD'), s = path.join(basis, 'WB');
  for (const ort of [r, s]) {
    fs.mkdirSync(path.join(ort, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(ort, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(ort, ADA, '2026-11-20T08:00:00+01:00', 'init', '-q', '-b', 'main');
  }
  const h = { r, s };
  fs.writeFileSync(path.join(r, 'c1.txt'), reihe(7, 'alt c1'));
  fs.writeFileSync(path.join(r, 'c2.txt'), reihe(12, 'alt c2'));
  fs.writeFileSync(path.join(r, 'c3.txt'), reihe(1, 'alt c3'));
  gitAls(r, ADA, '2026-11-20T09:00:00+01:00', 'add', '-A');
  gitAls(r, ADA, '2026-11-20T09:00:00+01:00', 'commit', '-q', '-m', 'B0 Vorgänger');
  const b0 = h.b0 = gitAls(r, ADA, '2026-11-20T09:00:00+01:00', 'rev-parse', 'HEAD');
  const c = (titel, datum, aenderungen) => leisteCommit(r, b0, titel, `2026-11-22T${datum}:00+01:00`, aenderungen);
  h.c1 = c('[R00229] B1187: Sperrform je Komponente', '03:19', { 'c1.txt': reihe(302, 'neu c1') });
  h.c2 = c('[R00229] B1188: Mutanten m1–m7 getötet, R00229 Erledigt, WBS und Ist-Zeiten', '03:31', { 'c2.txt': reihe(14, 'neu c2') });
  h.c3 = c('[DOC] R00229 AK 5: Fokusring je Ansicht', '04:34', { 'c3.txt': reihe(2, 'neu c3') });
  h.c2lang = c(LANGER_TITEL, '03:32', { 'c2.txt': reihe(14, 'lang c2') });
  h.c3a = c(KENNUNG_40, '04:35', { 'c3.txt': reihe(2, 'a c3') });
  h.c4 = c('Ohne Form', '05:01', { 'c4.txt': 'c4\n' });
  h.c5 = c('[Factory] director: Text', '05:02', { 'c5.txt': 'c5\n' });
  h.c6 = c('[R00229]', '05:03', { 'c6.txt': 'c6\n' });
  h.c7 = c(BOESE, '05:04', { 'c7.txt': 'c7\n' });
  h.c8 = c('[R00230] B1200: nur auf master', '05:05', { 'c8.txt': 'c8\n' });
  h.c9 = c('[R00231] B1201: viele Zweige', '05:06', { 'c9.txt': 'c9\n' });
  h.c10 = c('[R00232] B1202: tausend', '05:07', { 'c10.txt': reihe(1240, 'tausend') });
  h.v = c('[R00229] B1189: verwaist', '03:40', { 'v.txt': 'v\n' });
  h.a12 = c('[R00233] B1203: main nicht genannt', '05:08', { 'a12.txt': 'a12\n' });
  // 30 Commits in einer Kette (C1' bis C30'), je eine neue Datei
  h.dreissig = [];
  let spitze = b0;
  for (let i = 1; i <= 30; i++) {
    spitze = leisteCommit(r, spitze, `[R00245] B${1300 + i}: Schritt ${i}`, `2026-11-21T10:${String(i).padStart(2, '0')}:00+01:00`, { [`d${i}.txt`]: `d${i}\n` });
    h.dreissig.push(spitze);
  }
  const zweig = (name, ziel) => gitAls(r, ADA, '2026-11-22T06:00:00+01:00', 'branch', '-f', name, ziel);
  zweig('main', zusammen(r, [h.c1, h.c3, h.c4, h.c5, h.c6, h.c9, h.a12]));
  zweig('karte/247', zusammen(r, [h.c1, h.c2]));
  for (const z of ['a', 'b', 'c', 'd']) zweig(`karte/${z}`, h.c1);
  gitAls(r, ADA, '2026-11-22T06:00:00+01:00', 'update-ref', 'refs/remotes/origin/main', h.c3);
  gitAls(r, ADA, '2026-11-22T06:00:00+01:00', 'update-ref', 'refs/remotes/origin/karte/247', h.c2);
  zweig('karte/lang', zusammen(r, [h.c2lang, h.c3a]));
  zweig(BIDI_ZWEIG, h.c7);
  zweig('master', h.c8);
  zweig('x', h.c8);
  for (let i = 1; i <= 11; i++) zweig(`zz${String(i).padStart(2, '0')}`, h.c9);
  for (let i = 1; i <= 12; i++) zweig(`a${String(i).padStart(2, '0')}`, h.a12);
  zweig('c10', h.c10);
  zweig('karte/dreissig', spitze);
  // V ist verwaist: sein Zweig ist gelöscht, das Objekt bleibt
  zweig('weg', h.v);
  gitAls(r, ADA, '2026-11-22T06:00:00+01:00', 'branch', '-D', 'weg');
  gitAls(r, ADA, '2026-11-22T06:00:00+01:00', 'checkout', '-q', 'main');
  fs.writeFileSync(path.join(s, 'w.txt'), 'w\n');
  gitAls(s, ADA, '2026-11-20T09:00:00+01:00', 'add', '-A');
  gitAls(s, ADA, '2026-11-20T09:00:00+01:00', 'commit', '-q', '-m', 'W0 Vorgänger');
  h.w1 = aenderungsCommitAm(s, '[R00245] B1290: Werkbank', '2026-11-21T10:01:30+01:00', { 'w.txt': 'w\nneu\n' });
  return h;
}

/** Wie `aenderungsCommit`, mit festem Datum. */
function aenderungsCommitAm(r, titel, datum, aenderungen) {
  for (const [pfad, inhalt] of Object.entries(aenderungen)) fs.writeFileSync(path.join(r, pfad), inhalt);
  gitAls(r, ADA, datum, 'add', '-A');
  gitAls(r, ADA, datum, 'commit', '-q', '-m', titel);
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

let leiste = null;
/** Ein Satz Repositories je Prozess, am Prozessende entfernt (kanbanD liest sie nur). */
function leisteRepository() {
  if (!leiste) {
    const basis = basisAnlegen();
    leiste = leisteBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return leiste;
}

/** Ein Verweis ohne Commit-Objekt (Zustand `fehlt`). */
const FEHLT = 'kd:' + 'd'.repeat(40);

/** Aufgaben: #5 K-Leiste, #6 C10, #7 C1, C2, V und ein fehlender Verweis, #8 C1', C2' in kd und W1 in wb, #9 C1, C2-lang, C3-AAAA,
    #10 C4–C9 und A12, #11 30 Commits, #12 sieben, #13 acht, #14 nur fehlend. Register `kd`, `wb`. */
function leisteVorbereiten(h) {
  const kd = x => `kd:${x}`;
  const aufgaben = {
    5: [kd(h.c1), kd(h.c2), kd(h.c3)], 6: [kd(h.c10)], 7: [kd(h.c1), kd(h.c2), kd(h.v), FEHLT],
    8: [kd(h.dreissig[0]), `wb:${h.w1}`, kd(h.dreissig[1])], 9: [kd(h.c1), kd(h.c2lang), kd(h.c3a)],
    10: [kd(h.c4), kd(h.c5), kd(h.c6), kd(h.c7), kd(h.c8), kd(h.c9), kd(h.a12)],
    11: h.dreissig.map(kd), 12: h.dreissig.slice(0, 7).map(kd), 13: h.dreissig.slice(0, 8).map(kd), 14: [FEHLT],
  };
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${h.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    wb: {name: WB, wbs: ${h.s}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
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

/* ── Ausgangslage von R00266 (angehefteter Kopf): K-N mit langer Zeile (407 Zeichen, wie R00248 K-Lang) in `kd`, sieben Schritte
   davor; Aufgabe #9 trägt neun Einträge, damit „Zum Code“ erscheint (LEISTE_OHNE_SPRUNG = 8) ── */

/** `kd`: B0 mit den alten Fassungen, sieben kleine Schritte S1–S7, dann K-N (lange Zeile in src/l.rs, dazu src/a.rs über 250
    Zeilen und die kurze Datei src/z.rs); `wb`: W0 und W1 für einen Nachbarzustand. */
function kopfBauen(basis) {
  const r = path.join(basis, 'KD'), s = path.join(basis, 'WB');
  for (const ort of [r, s]) {
    fs.mkdirSync(path.join(ort, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(ort, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(ort, ADA, '2026-08-01T08:00:00+00:00', 'init', '-q', '-b', 'main');
  }
  const h = { r, s };
  aenderungsCommit(r, 'N0 Vorgänger', { 'src/a.rs': reihe(250, 'a alt'), 'src/l.rs': '// l alt\n', 'src/z.rs': 'z alt\n' });
  h.schritte = [];
  for (let i = 1; i <= 7; i++) h.schritte.push(aenderungsCommit(r, `S${i} Schritt ${i}`, { [`src/s${i}.rs`]: `fn s${i}() {}\n` }));
  h.n = aenderungsCommit(r, 'K-N lange Zeile', { 'src/a.rs': reihe(250, 'a neu'), 'src/l.rs': `${UM_A}\n`, 'src/z.rs': 'z neu\n' });
  h.leer = aenderungsCommit(r, 'N-Leer ohne Dateien', {});
  aenderungsCommit(s, 'W0 Vorgänger', { 'docs/n.md': '# n\n\nEnde\n' });
  h.w1 = aenderungsCommit(s, 'W1', { 'docs/n.md': '# n\n\nlet a = 2;\n\nEnde\n' });
  return h;
}

let kopfGeteilt = null;
/** Ein Satz Repositories je Prozess für R00266, am Prozessende entfernt. */
function kopfRepository() {
  if (!kopfGeteilt) {
    const basis = basisAnlegen();
    kopfGeteilt = kopfBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return kopfGeteilt;
}

/** Aufgaben: #9 K-N mit den sieben Schritten und W1 (neun Einträge), #10 K-N allein (zwei Einträge). Register `kd`, `wb`. */
function kopfVorbereiten(h) {
  return aufgabenVorbereiten(h, { 9: [...h.schritte.map(x => `kd:${x}`), `kd:${h.n}`, `wb:${h.w1}`], 10: [`kd:${h.n}`], 11: [`kd:${h.leer}`] });
}

/* ── Ausgangslage von R00246 (Gesehen): eigene Repositories nach R00235, dazu K3b (src/a.rs +1 Zeile, Kind von K3), KG (eine geänderte
   Datei über 3.000 Zeilen, `gross`), K5 (fünf Dateien in `kd`, darunter src/a.rs), W5 (drei Dateien in `wb`, darunter src/a.rs) und ein
   leerer Commit ── */

function gesehenBauen(basis) {
  const h = uebersichtBauen(basis);
  h.k3b = aenderungsCommit(h.r, 'K3b', { 'src/a.rs': 'fn a() { neu() }\nfn b() {}\n' });
  h.k3c = aenderungsCommit(h.r, 'K3c', {
    'src/a.rs': 'fn a() { neu() }\nfn b() {}\nfn c() {}\n', 'tests/a_test.rs': 'fn t() {}\nfn u() {}\n', 'README.md': '# kd\nneu\nauch\nnoch\n',
  });
  aenderungsCommit(h.r, 'G0 Vorgänger', { 'src/riesig.rs': '' });
  h.kg = aenderungsCommit(h.r, 'KG', { 'src/riesig.rs': reihe(3001, 'riesig') });
  h.k5 = aenderungsCommit(h.r, 'K5', { 'src/a.rs': 'fn a() { k5() }\n', ...Object.fromEntries([1, 2, 3, 4].map(i => [`src/k5-${i}.rs`, `fn k${i}() {}\n`])) });
  h.leer = aenderungsCommit(h.r, 'Leer', {});
  const tief = ['a', 'b', 'c'].map(z => z.repeat(100)).join('/') + '/lang.rs';
  h.k30 = aenderungsCommit(h.r, 'K30', { [tief]: 'fn lang() {}\n', ...Object.fromEntries(Array.from({ length: 29 }, (_, i) => [`src/k30/datei-${i + 1}.rs`, `fn d${i}() {}\n`])) });
  h.k30Lang = tief;
  h.w5 = aenderungsCommit(h.s, 'W5', { 'src/a.rs': 'fn wb() {}\n', 'w5-1.js': 'w1();\n', 'w5-2.js': 'w2();\n' });
  return h;
}

let gesehenGeteilt = null;
/** Ein Satz Repositories je Prozess für R00246, getrennt von dem der Übersicht; am Prozessende entfernt. */
function gesehenRepository() {
  if (!gesehenGeteilt) {
    const basis = basisAnlegen();
    gesehenGeteilt = gesehenBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return gesehenGeteilt;
}

/** Aufgaben: #1 K-Art und K-Doku, #2 K-Rand, #3 K3 und W3, #4 K-Budget, #6 KG, #7 K5 und W5, #8 leer, #9 K30 (30 Dateien, ein Pfad über 300 Zeichen), #201 K-Art; zwei Boards `entwicklung`
    und `zweites` mit denselben Aufgaben. */
function gesehenVorbereiten(h) {
  const aufgaben = { 1: [`kd:${h.kArt}`, `kd:${h.kDoku}`], 2: [`kd:${h.kRand}`], 3: [`kd:${h.k3}`, `wb:${h.w3}`], 4: [`kd:${h.kBudget}`], 6: [`kd:${h.kg}`], 7: [`kd:${h.k5}`, `wb:${h.w5}`], 8: [`kd:${h.leer}`], 9: [`kd:${h.k30}`], 201: [`kd:${h.kArt}`] };
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${h.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    wb: {name: WB, wbs: ${h.s}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
  const liste = Object.keys(aufgaben).map(n => `- #${n}`).join('\n');
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${liste}\n\n## Erledigt\n`;
  dateien['boards/zweites.md'] = `# Zweites\n\n## Zu erledigen\n\n${liste}\n\n## Erledigt\n`;
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

/* ── Ausgangslage von R00247 (Wortmarke): K-Wort, K-Rand, Farben und Breite in W1, K-Block in W2, Last in WL und WLF (`kd`), K-Zwei mit W3
   (`wb`). Jeder Fall steht durch eine eigene unveränderte Zeile von den anderen getrennt ── */

/** Fälle → [alter Inhalt, neuer Inhalt]; je Fall `[alte Zeilen, neue Zeilen]`, dazwischen je eine eindeutige Trennzeile. */
function faelleDatei(faelle, name) {
  const alt = [], neu = [];
  faelle.forEach(([a, n], i) => {
    alt.push(`// ${name} trenner ${i}`, ...a);
    neu.push(`// ${name} trenner ${i}`, ...n);
  });
  alt.push(`// ${name} ende`);
  neu.push(`// ${name} ende`);
  return [alt.join('\n') + '\n', neu.join('\n') + '\n'];
}

const WM_ZEILE_1000 = ende => '//' + 'a'.repeat(997) + ende;
/** Fall (a) auf 120 Zeichen verlängert, die Änderung ab Spalte 60 in einem Wort aus 50 Zeichen, das ganz markiert wird und bei 320 px
    über einen Umbruch läuft (AK 8). */
const WM_BREIT = ziffer => ('// ' + 'wort '.repeat(11) + 'a ' + 'b'.repeat(25) + ziffer + 'b'.repeat(24) + ' ' + 'wort '.repeat(12)).slice(0, 120);

const WM_FAELLE = {
  wort: {
    a: [['let a = 1;'], ['let a = 2;']],
    b: [['fn alt_name(x) {}'], ['fn alt_namen(x) {}']],
    c: [['a = 1'], ['a = 2']],
    d: [['a=1;'], ['a=2;']],
    e: [['a = 1; b = 2;'], ['a = 9; b = 8;']],
    f: [['let s = "alt";'], ['let s = "neu";']],
    g: [['p = 10;', 'q = 20;'], ['p = 11;', 'q = 21;', 'r = 31;']],
    h: [[], ['neu_nur = 1;']],
    i: [['x = 1;', 'mitte();'], ['mitte();', 'x = 2;']],
    p: [['foo(1, 2)'], ['foo(1, 3, 2)']],
  },
  rand: {
    j: [['let s = "😀";'], ['let s = "😁";']],
    k: [['v = "1‮2"'], ['v = "3‮4"']],
    l: [['let t = "a‮b";'], ['let t = "a‮c";']],
    m: [['let h = "<img src=x onerror=window.pwn=1>";'], ['let h = "<img src=y onerror=window.pwn=1>";']],
    n: [[WM_ZEILE_1000('1')], [WM_ZEILE_1000('2')]],
    o: [['a' + WM_ZEILE_1000('1')], ['a' + WM_ZEILE_1000('2')]],
  },
  /** Je Syntaxfarbe eine Zeile, deren Marke diese Farbe trägt (AK 7); Zahl und Zeichenkette stehen in K-Wort (a) und (f). */
  farben: {
    keyword: [['    if a { b() }'], ['    while a { b() }']],
    type: [['    let v: Alt = w;'], ['    let v: Neu = w;']],
    function: [['    rechne_alt(1);'], ['    rechne_neu(1);']],
    macro: [['    println!("x");'], ['    eprintln!("x");']],
    comment: [['let a = 1; // alt'], ['let a = 1; // neu']],
    number: [['let a = 1;'], ['let a = 2;']],
    string: [['let s = "alt";'], ['let s = "neu";']],
  },
};

/** K-Block: ein Hunk, in dem die Blockgrenze (Index 500 der Zeilenliste) zwischen der zweiten und dritten gelöschten Zeile liegt:
    Kopf (0), 248 × (Kontext, hinzugefügt) (1–496), Kontext (497), gelöscht 498–500, hinzugefügt 501–503. */
function blockDatei() {
  const alt = [], neu = [];
  for (let i = 1; i <= 249; i++) { alt.push(`c${i}`); neu.push(`c${i}`); if (i < 249) neu.push(`n${i}`); }
  alt.push('d1 = 1;', 'd2 = 1;', 'd3 = 1;', 'z');
  neu.push('d1 = 2;', 'd2 = 2;', 'd3 = 2;', 'z');
  return [alt.join('\n') + '\n', neu.join('\n') + '\n'];
}

/** Last: `n` Zeilen ganz ersetzt, ein Lauf zu `n` gelöschten und `n` hinzugefügten Zeilen gleicher Länge. */
function lastDatei(n, zeile) {
  const alle = ziffer => Array.from({ length: n }, (_, i) => zeile(i, ziffer)).join('\n') + '\n';
  return [alle('1'), alle('2')];
}
const LAST_80 = (i, ziffer) => `let zeile_${String(i).padStart(5, '0')} = "${'w'.repeat(48)}"; // wert ${ziffer}`;
const LAST_KURZ = (i, ziffer) => `let k${i} = ${ziffer};`;

function wortmarkeBauen(basis) {
  const r = path.join(basis, 'KD'), s = path.join(basis, 'WB');
  for (const ort of [r, s]) {
    fs.mkdirSync(path.join(ort, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(ort, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(ort, ADA, '2026-06-01T08:00:00+00:00', 'init', '-q', '-b', 'main');
  }
  const wort = faelleDatei(Object.values(WM_FAELLE.wort), 'wort');
  const rand = faelleDatei(Object.values(WM_FAELLE.rand), 'rand');
  const farben = faelleDatei(Object.values(WM_FAELLE.farben), 'farben');
  const ohne = faelleDatei([WM_FAELLE.wort.f, WM_FAELLE.wort.a], 'ohne');
  const breit = faelleDatei([[[WM_BREIT('1')], [WM_BREIT('2')]]], 'breit');
  const block = blockDatei(), last = lastDatei(5000, LAST_80), kurz = lastDatei(5000, LAST_KURZ);
  const h = { r, s };
  aenderungsCommit(r, 'W0 Vorgänger', { 'src/w.rs': wort[0], 'src/r.rs': rand[0], 'src/farben.rs': farben[0], 'w.xyz': ohne[0], 'src/breit.rs': breit[0], 'src/g.rs': block[0], 'src/last.rs': last[0], 'src/kurz.rs': kurz[0] });
  h.w1 = aenderungsCommit(r, 'W1 Wortmarke', { 'src/w.rs': wort[1], 'src/r.rs': rand[1], 'src/farben.rs': farben[1], 'w.xyz': ohne[1], 'src/breit.rs': breit[1] });
  h.w2 = aenderungsCommit(r, 'W2 Blockgrenze', { 'src/g.rs': block[1] });
  h.wl = aenderungsCommit(r, 'WL Last mit 80 Zeichen', { 'src/last.rs': last[1] });
  h.wlf = aenderungsCommit(r, 'WLF Last gefärbt', { 'src/kurz.rs': kurz[1] });
  aenderungsCommit(s, 'W3 Vorgänger', { 'docs/n.md': '# n\n\nlet a = 1;\n\nEnde\n' });
  h.w3 = aenderungsCommit(s, 'W3', { 'docs/n.md': '# n\n\nlet a = 2;\n\nEnde\n' });
  return h;
}

let wortmarkeGeteilt = null;
/** Ein Satz Repositories je Prozess für R00247, am Prozessende entfernt. */
function wortmarkeRepository() {
  if (!wortmarkeGeteilt) {
    const basis = basisAnlegen();
    wortmarkeGeteilt = wortmarkeBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return wortmarkeGeteilt;
}

/** Aufgaben: #9 W1 und W3 (K-Zwei), #10 W2 (K-Block), #11 WL, #12 WLF; Register `kd`, `wb`. */
function wortmarkeVorbereiten(h) {
  const aufgaben = { 9: [`kd:${h.w1}`, `wb:${h.w3}`], 10: [`kd:${h.w2}`], 11: [`kd:${h.wl}`], 12: [`kd:${h.wlf}`] };
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${h.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    wb: {name: WB, wbs: ${h.s}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${Object.keys(aufgaben).map(n => `- #${n}`).join('\n')}\n\n## Erledigt\n`;
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

/* ── Ausgangslage von R00248 (Umbrechen): U1 in `kd` mit K-Lang (a), (b) je 30-mal und (c) in src/u.rs und K-Kurz in src/kurz.rs, U2 in `wb`
   (K-Zwei, Fall (a) in docs/u.md), U3 in `kd` (K-Last: src/gross.rs mit 5.000 gelöschten und 5.000 hinzugefügten Zeilen zu etwa 200 Zeichen) ── */

/** Fall (a): Kommentar mit Leerzeichen, 407 Zeichen. Fall (b): ein Wort ohne Leerzeichen, 411 Zeichen. */
const UM_A = '// ' + 'wort '.repeat(80) + 'ende';
const UM_B = 'let u = "' + 'x'.repeat(400) + '";';
/** Funktionszeile, die git im Hunk-Kopf des Falls (c) auf 80 Zeichen kürzt (90 Zeichen, in Spalte 0 beginnend). */
const UM_FN = 'fn ' + 'funktion_mit_einem_sehr_langen_namen_'.repeat(3).slice(0, 87);

/** src/u.rs als [alt, neu]: (a) und (b) je 30-mal in einem Hunk, durch eine unveränderte Zeile getrennt; danach mehr als sechs
    unveränderte Zeilen, die Funktionszeile und Fall (c) als eigener Hunk. */
function umbrechenU() {
  const alt = [], neu = [];
  for (let i = 0; i < 30; i++) {
    alt.push(`// u trenner a${i}`); neu.push(`// u trenner a${i}`, UM_A);
    alt.push(`// u trenner b${i}`); neu.push(`// u trenner b${i}`, UM_B);
  }
  const beide = z => { alt.push(z); neu.push(z); };
  for (let i = 1; i <= 8; i++) beide(`// u fuellung ${i}`);
  beide(UM_FN);
  for (let i = 1; i <= 5; i++) beide(`    // u vor c ${i}`);
  alt.push('    zaehler = 1;'); neu.push('    zaehler = 2;');
  for (let i = 1; i <= 4; i++) beide(`    // u nach c ${i}`);
  beide('// u ende');
  return [alt.join('\n') + '\n', neu.join('\n') + '\n'];
}

const UM_LAST = (i, ziffer) => `// z${String(i).padStart(5, '0')} ${ziffer} ${'wort '.repeat(37)}`;

function umbrechenBauen(basis) {
  const r = path.join(basis, 'KD'), s = path.join(basis, 'WB');
  for (const ort of [r, s]) {
    fs.mkdirSync(path.join(ort, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(ort, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(ort, ADA, '2026-06-01T08:00:00+00:00', 'init', '-q', '-b', 'main');
  }
  const u = umbrechenU();
  const kurz = ziffer => ['// k anfang', '// k 2', '// k 3', '// k 4', `let a = ${ziffer};`, '// k 5', '// k 6', '// k 7', '// k ende'].join('\n') + '\n';
  const last = lastDatei(5000, UM_LAST);
  const breit = faelleDatei([[[WM_BREIT('1')], [WM_BREIT('2')]]], 'breit');
  const h = { r, s };
  aenderungsCommit(r, 'U0 Vorgänger', { 'src/u.rs': u[0], 'src/kurz.rs': kurz(1), 'src/gross.rs': last[0], 'src/breit.rs': breit[0] });
  h.u1 = aenderungsCommit(r, 'U1 Lange Zeilen', { 'src/u.rs': u[1], 'src/kurz.rs': kurz(2), 'src/breit.rs': breit[1] });
  h.u3 = aenderungsCommit(r, 'U3 Last', { 'src/gross.rs': last[1] });
  h.leer = aenderungsCommit(r, 'U4 ohne Dateien', {});
  aenderungsCommit(s, 'U2 Vorgänger', { 'docs/u.md': '# u\n\nEnde\n' });
  h.u2 = aenderungsCommit(s, 'U2', { 'docs/u.md': `# u\n\n${UM_A}\n\nEnde\n` });
  return h;
}

let umbrechenGeteilt = null;
/** Ein Satz Repositories je Prozess für R00248, am Prozessende entfernt. */
function umbrechenRepository() {
  if (!umbrechenGeteilt) {
    const basis = basisAnlegen();
    umbrechenGeteilt = umbrechenBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return umbrechenGeteilt;
}

/** Aufgaben: #9 U1 und U2 (K-Lang, K-Kurz, K-Zwei), #10 U3 (K-Last), #11 U4 ohne Dateien; Register `kd`, `wb`. */
function umbrechenVorbereiten(h) {
  return aufgabenVorbereiten(h, { 9: [`kd:${h.u1}`, `wb:${h.u2}`], 10: [`kd:${h.u3}`], 11: [`kd:${h.leer}`] });
}

/** Board mit den Aufgaben `aufgaben` (Nummer → Verweise) und dem Register `kd`, `wb` über die Repositories `h.r`, `h.s`. */
function aufgabenVorbereiten(h, aufgaben) {
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${h.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    wb: {name: WB, wbs: ${h.s}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const [nr, verweise] of Object.entries(aufgaben)) dateien[`aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${Object.keys(aufgaben).map(n => `- #${n}`).join('\n')}\n\n## Erledigt\n`;
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


/* ── Ausgangslage von R00249 (Nebeneinander): N1 in `kd` mit K-Lauf (src/n.rs, Fall (a) auch in src/n.xyz ohne Farbe), K-Datei (neu, weg,
   ende, enden) und K-Lang (src/l.rs);
   N2 K-Block (src/g.rs), N4 K-Last (src/gross.rs), N5 ohne Dateien; N3 in `wb` (K-Zwei, Fall (a) in docs/n.md) ── */

/** src/n.rs als [alt, neu]: die Fälle (a)–(d), je durch acht unveränderte Zeilen getrennt, damit jeder Fall ein eigener Hunk ist. */
function nebeneinanderN() {
  const alt = [], neu = [];
  const fuellung = name => { for (let i = 1; i <= 8; i++) { alt.push(`// n ${name} ${i}`); neu.push(`// n ${name} ${i}`); } };
  fuellung('anfang');
  alt.push('let a = 1;'); neu.push('let a = 2;');
  fuellung('nach a');
  alt.push('p = 10;', 'q = 20;'); neu.push('p = 11;', 'q = 21;', 'r = 31;');
  fuellung('nach b');
  neu.push('z = 0;');
  fuellung('nach c');
  alt.push('y = 0;');
  fuellung('ende');
  return [alt.join('\n') + '\n', neu.join('\n') + '\n'];
}

/** src/l.rs: (a) `// kurz` gegen UM_A (407 Zeichen), (b) `let u = "";` gegen UM_B (411 Zeichen ohne Leerzeichen), getrennt. */
function nebeneinanderL() {
  const alt = ['// l anfang', '// kurz'], neu = ['// l anfang', UM_A];
  for (let i = 1; i <= 8; i++) { alt.push(`// l mitte ${i}`); neu.push(`// l mitte ${i}`); }
  alt.push('let u = "";', '// l ende'); neu.push(UM_B, '// l ende');
  return [alt.join('\n') + '\n', neu.join('\n') + '\n'];
}

function nebeneinanderBauen(basis) {
  const r = path.join(basis, 'KD'), s = path.join(basis, 'WB');
  for (const ort of [r, s]) {
    fs.mkdirSync(path.join(ort, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(ort, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(ort, ADA, '2026-06-01T08:00:00+00:00', 'init', '-q', '-b', 'main');
  }
  const n = nebeneinanderN(), l = nebeneinanderL(), block = blockDatei(), last = lastDatei(5000, UM_LAST);
  const h = { r, s };
  aenderungsCommit(r, 'N0 Vorgänger', { 'src/n.xyz': '// x\nlet a = 1;\n// y\n', 'src/n.rs': n[0], 'src/weg.rs': 'w1\nw2\nw3\n', 'src/ende.rs': 'e\nx = 1;', 'src/enden.rs': 'e\nx', 'src/l.rs': l[0], 'src/g.rs': block[0], 'src/gross.rs': last[0] });
  h.n1 = aenderungsCommit(r, 'N1 Nebeneinander', { 'src/n.xyz': '// x\nlet a = 2;\n// y\n', 'src/n.rs': n[1], 'src/neu.rs': 'n1\nn2\nn3\nn4\n', 'src/weg.rs': null, 'src/ende.rs': 'e\nx = 2;', 'src/enden.rs': 'e\nx\n', 'src/l.rs': l[1] });
  h.n2 = aenderungsCommit(r, 'N2 Blockgrenze', { 'src/g.rs': block[1] });
  h.n4 = aenderungsCommit(r, 'N4 Last', { 'src/gross.rs': last[1] });
  h.leer = aenderungsCommit(r, 'N5 ohne Dateien', {});
  aenderungsCommit(s, 'N3 Vorgänger', { 'docs/n.md': '# n\n\nlet a = 1;\n\nEnde\n' });
  h.n3 = aenderungsCommit(s, 'N3', { 'docs/n.md': '# n\n\nlet a = 2;\n\nEnde\n' });
  return h;
}

let nebeneinanderGeteilt = null;
/** Ein Satz Repositories je Prozess für R00249, am Prozessende entfernt. */
function nebeneinanderRepository() {
  if (!nebeneinanderGeteilt) {
    const basis = basisAnlegen();
    nebeneinanderGeteilt = nebeneinanderBauen(basis);
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return nebeneinanderGeteilt;
}

/** Aufgaben: #9 N1 und N3 (K-Lauf, K-Datei, K-Lang, K-Zwei), #10 N2 (K-Block), #11 N4 (K-Last), #12 N5 ohne Dateien; Register `kd`, `wb`. */
function nebeneinanderVorbereiten(h) {
  return aufgabenVorbereiten(h, { 9: [`kd:${h.n1}`, `wb:${h.n3}`], 10: [`kd:${h.n2}`], 11: [`kd:${h.n4}`], 12: [`kd:${h.leer}`] });
}

module.exports = { kopfRepository, kopfVorbereiten, nebeneinanderRepository, nebeneinanderVorbereiten, umbrechenRepository, umbrechenVorbereiten, UM_A, UM_B, UM_FN, wortmarkeRepository, wortmarkeVorbereiten, WM_FAELLE, WM_BREIT, gesehenRepository, gesehenVorbereiten, reviewRepository, reviewVorbereiten, uebersichtRepository, uebersichtVorbereiten, pfadRepository, pfadVorbereiten, leisteRepository, leisteVorbereiten, BOESE, ZWEIG_60, LANGER_TITEL, KENNUNG_40, BIDI_ZWEIG, FEHLT };
