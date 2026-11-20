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
  for (let i = 1; i <= 4; i++) fs.writeFileSync(path.join(r, `budget-${i}.txt`), zeilen(2499, `b${i}`));
  fs.writeFileSync(path.join(r, 'budget-5.txt'), 'b5 1\n');
  h.e = commitAlles(r, tag, 'Budget anlegen');
  h.e0 = commitAlles(r, '2026-04-01T10:00:00+00:00', 'leerer Commit', '--allow-empty');
  gitAls(r, ADA, tag, 'branch', 'karte/8', h.e0);
}

/** F (#9) und F2 (#10): 25 Dateien zu 202.019 Byte Patch (R00206 AK 8: 20 mit patch, 5 nachladen) und eine Datei mit 3.001 Zeilen (gross). */
function nachladeCommit(r, h) {
  const tag = '2026-04-02T09:00:00+00:00';
  gitAls(r, ADA, tag, 'checkout', '-q', '--detach', h.k2);
  const inhalt = ('a'.repeat(99) + '\n').repeat(2000);
  for (let i = 1; i <= 25; i++) fs.writeFileSync(path.join(r, `f${String(i).padStart(2, '0')}.txt`), inhalt);
  fs.writeFileSync(path.join(r, 'gross.txt'), zeilen(3001, 'g'));
  h.f = commitAlles(r, tag, '25 Dateien und eine große');
  gitAls(r, ADA, tag, 'branch', 'karte/9', h.f);
  // F2 (#10, Nacharbeit 1): Geschwister von F mit denselben Pfaden und Größen, anderem Inhalt — dieselben Dateien laden nach
  const tag2 = '2026-04-02T10:00:00+00:00';
  gitAls(r, ADA, tag2, 'checkout', '-q', '--detach', h.k2);
  const anders = ('b'.repeat(99) + '\n').repeat(2000);
  for (let i = 1; i <= 25; i++) fs.writeFileSync(path.join(r, `f${String(i).padStart(2, '0')}.txt`), anders);
  fs.writeFileSync(path.join(r, 'gross.txt'), zeilen(3001, 'h'));
  h.f2 = commitAlles(r, tag2, '25 Dateien mit anderem Inhalt');
  gitAls(r, ADA, tag2, 'branch', 'karte/10', h.f2);
}

/** D (#7): drei Hunks mit \r\n, U+2028 und ohne Zeilenende; neu, gelöscht, umbenannt (100 %), Modus, binär, Latin-1, Bidi und
 *  ESC, fremder Text in Pfad, Zeile und Titel, eine Zeile aus 200.000 Zeichen, 3.001 Zeilen, ein Pfad über 4.096 Byte (Plumbing),
 *  ein Pfad aus 200 Zeichen; Titel aus 300 Zeichen auf einem Zweig mit 60 Zeichen. Zuletzt gebaut: der lange Pfad steht nur im Index. */
function merkmalCommit(r, h) {
  const vor = '2026-04-03T09:00:00+00:00', tag = '2026-04-03T10:00:00+00:00';
  gitAls(r, ADA, vor, 'checkout', '-q', '--detach', h.k2);
  fs.writeFileSync(path.join(r, 'text.txt'), zeilen(40, 'zeile'));
  fs.writeFileSync(path.join(r, 'weg.txt'), 'weg 1\n');
  fs.writeFileSync(path.join(r, 'alt-name.txt'), zeilen(5, 'umbenannt'));
  fs.writeFileSync(path.join(r, 'skript.sh'), 'echo hallo\n');
  fs.writeFileSync(path.join(r, 'latin.txt'), 'a\n');
  commitAlles(r, vor, 'Vorgänger von D');
  const text = zeilen(40, 'zeile').split('\n');
  text[1] = 'zeile 2 neu\r';
  text[19] = 'zeile 20   mit Trenner';
  text[37] = 'zeile 38 neu';
  fs.writeFileSync(path.join(r, 'text.txt'), text.slice(0, 40).join('\n'));
  fs.writeFileSync(path.join(r, 'neu.txt'), 'neu 1\n');
  fs.rmSync(path.join(r, 'weg.txt'));
  fs.renameSync(path.join(r, 'alt-name.txt'), path.join(r, 'neu-name.txt'));
  fs.chmodSync(path.join(r, 'skript.sh'), 0o755);
  fs.writeFileSync(path.join(r, 'bild.bin'), Buffer.from([0, 1, 2, 0, 255, 0]));
  fs.writeFileSync(path.join(r, 'latin.txt'), Buffer.from([0x61, 0x0a, 0x62, 0xe4, 0x0a]));
  fs.writeFileSync(path.join(r, 'bidi-‮datei.txt'), 'a‮b\u001Bc\td\n');
  fs.writeFileSync(path.join(r, `${BOESE}.txt`), `${BOESE}\n`);
  fs.writeFileSync(path.join(r, 'lang.txt'), 'L'.repeat(200000) + '\n');
  fs.writeFileSync(path.join(r, 'gross.txt'), zeilen(3001, 'g'));
  fs.writeFileSync(path.join(r, 'p'.repeat(196) + '.txt'), 'p\n');
  gitAls(r, ADA, tag, 'add', '-A');
  const blob = execFileSync('git', ['-C', r, 'hash-object', '-w', '--stdin'], { input: 'tief\n', encoding: 'utf8' }).trim();
  const tief = Array.from({ length: 21 }, (_, i) => `t${i}`.padEnd(200, 't')).join('/') + '/x.txt';
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

module.exports = { reviewRepository, reviewVorbereiten, BOESE, ZWEIG_60 };
