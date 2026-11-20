// Ausgangslage von R00210 (Alle Änderungen der Aufgabe): Repository R (kd) mit A0, K1, F (fremd), K2; L1, L2 (netto); P1/P2
// (nicht linear); N1, MK (Merge), N2, N1' (verwaist); Repository S (wb) mit W1, FS (fremd), W2; Repository T (xx) mit X1.
// Gebaut mit echtem Git im Test, ein Satz je Prozess; kanbanD liest die Repositories nur.
"use strict";
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { basisAnlegen, gitAls, aufgabeDatei, EINSTELLUNGEN_KOPF } = require('./commits-hilfen');

const ADA = 'Ada Autorin';
const zeilen = (n, kopf) => Array.from({ length: n }, (_, i) => `${kopf}${i + 1}\n`).join('');

function repositoryAnlegen(r) {
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/app.md'), '# App\n');
  gitAls(r, ADA, '2026-05-01T09:00:00+00:00', 'init', '-q', '-b', 'main');
  for (const [k, w] of [['gc.auto', '0'], ['gc.writeCommitGraph', 'false']]) gitAls(r, ADA, '2026-05-01T09:00:00+00:00', 'config', k, w);
}

let tag = 0;
/** Schreibt `aenderungen` (Pfad → Inhalt, null löscht) und committet; liefert den Hash. */
function commit(r, titel, aenderungen, ...extra) {
  const datum = `2026-05-${String(2 + Math.floor(tag / 20)).padStart(2, '0')}T${String(9 + (tag % 10)).padStart(2, '0')}:${String(tag % 60).padStart(2, '0')}:00+00:00`;
  tag++;
  for (const [pfad, inhalt] of Object.entries(aenderungen)) {
    if (inhalt === null) fs.rmSync(path.join(r, pfad));
    else { fs.mkdirSync(path.dirname(path.join(r, pfad)), { recursive: true }); fs.writeFileSync(path.join(r, pfad), inhalt); }
  }
  gitAls(r, ADA, datum, 'add', '-A');
  gitAls(r, ADA, datum, 'commit', '-q', '--allow-empty', ...extra, '-m', titel);
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

const ersetzt = (text, nr, neu) => text.split('\n').map((z, i) => (i === nr - 1 ? neu : z)).join('\n');

/** R (kd): A0; K1 ändert Zeile 2 von a.txt und legt k.txt an (3 Zeilen); F (fremd) ändert Zeile 5 von a.txt zu FREMD und f.txt;
 *  K2 ändert Zeile 11 von a.txt. Danach L1, L2 (l.txt), N1, MK (Merge mit y.txt FREMD-Y), N2, N1' (verwaist), P1 und P2 (seite). */
function repositoryR(basis) {
  const r = path.join(basis, 'R');
  repositoryAnlegen(r);
  const h = { r };
  let a = zeilen(20, 'z');
  h.a0 = commit(r, 'A0 anlegen', { 'a.txt': a, 'f.txt': 'f1\n' });
  a = ersetzt(a, 2, 'K1');
  h.k1 = commit(r, 'K1 a.txt und k.txt', { 'a.txt': a, 'k.txt': 'k1\nk2\nk3\n' });
  a = ersetzt(a, 5, 'FREMD');
  h.f = commit(r, 'F fremd', { 'a.txt': a, 'f.txt': 'FREMD f\n' });
  a = ersetzt(a, 11, 'K2');
  h.k2 = commit(r, 'K2 a.txt', { 'a.txt': a });
  h.l1 = commit(r, 'L1 l.txt anlegen', { 'l.txt': 'l1\n' });
  h.l2 = commit(r, 'L2 l.txt ändern', { 'l.txt': 'l1\nl2\n' });
  h.n1 = commit(r, 'N1 n.txt', { 'n.txt': 'n1\n' });
  gitAls(r, ADA, '2026-05-20T09:00:00+00:00', 'checkout', '-q', '-b', 'nebenzweig');
  commit(r, 'Y fremd', { 'y.txt': 'FREMD-Y\n' });
  gitAls(r, ADA, '2026-05-20T09:00:00+00:00', 'checkout', '-q', 'main');
  gitAls(r, ADA, '2026-05-20T10:00:00+00:00', 'merge', '-q', '--no-ff', '-m', 'MK Merge nebenzweig', 'nebenzweig');
  h.mk = gitAls(r, ADA, '2026-05-20T10:00:00+00:00', 'rev-parse', 'HEAD');
  gitAls(r, ADA, '2026-05-20T10:00:00+00:00', 'branch', '-q', '-D', 'nebenzweig');
  h.n2 = commit(r, 'N2 n.txt', { 'n.txt': 'n1\nn2\n' });
  // N1' verwaist: ein Commit, zu dem kein Zweig führt (wie nach einem Rebase)
  h.n1s = commit(r, "N1' verwaist", { 'n.txt': 'n1 alt\n' });
  gitAls(r, ADA, '2026-05-21T09:00:00+00:00', 'reset', '-q', '--hard', h.n2);
  // P1 auf main, P2 auf `seite`, das vor P1 abzweigt und nicht gemergt ist (#7, nicht linear)
  gitAls(r, ADA, '2026-05-21T09:00:00+00:00', 'branch', '-q', 'seite');
  h.p1 = commit(r, 'P1 p.txt', { 'p.txt': 'p1\n' });
  gitAls(r, ADA, '2026-05-21T09:00:00+00:00', 'checkout', '-q', 'seite');
  h.p2 = commit(r, 'P2 q.txt', { 'q.txt': 'q1\n' });
  gitAls(r, ADA, '2026-05-21T09:00:00+00:00', 'checkout', '-q', 'main');
  // V2 „gelöscht“: ein Hash, den das Repository nicht kennt
  h.v2 = 'e'.repeat(40);
  return h;
}

/** S (wb): W1, FS (fremd), W2 an derselben Datei w.txt — w.txt ist eine Folge-Datei; T (xx): X1. */
function repositorienSundT(basis) {
  const s = path.join(basis, 'S'), t = path.join(basis, 'T');
  repositoryAnlegen(s);
  repositoryAnlegen(t);
  let w = zeilen(20, 'w');
  commit(s, 'S0', { 'w.txt': w });
  w = ersetzt(w, 2, 'W1');
  const w1 = commit(s, 'W1 w.txt', { 'w.txt': w, 'README.md': 'wb lies mich\n' });
  w = ersetzt(w, 8, 'FREMD');
  commit(s, 'FS fremd', { 'w.txt': w });
  w = ersetzt(w, 15, 'W2');
  const w2 = commit(s, 'W2 w.txt', { 'w.txt': w });
  const x1 = commit(t, 'X1 x.txt', { 'x.txt': 'x1\n' });
  return { s, t, w1, w2, x1 };
}

let geteilt = null;
/** Die Repositories einmal je Prozess, am Prozessende entfernt. */
function gesamtRepositorien() {
  if (!geteilt) {
    const basis = basisAnlegen();
    geteilt = { ...repositoryR(basis), ...repositorienSundT(basis) };
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return geteilt;
}

const UNLESBAR = 'kd:ab‮cd';

/** Die Aufgaben der Probe (R00210 „Ausgangslage“) und das Register kd → R, wb → S, xx → T. `zusatz` ergänzt Aufgaben. */
function gesamtVorbereiten(rep, zusatz = {}) {
  const kd = x => `kd:${x}`;
  const aufgaben = {
    2: [kd(rep.k1), kd(rep.k2)],
    3: [kd(rep.l1), kd(rep.l2)],
    6: [kd(rep.v2), `xy:${rep.k1}`],
    7: [kd(rep.p1), kd(rep.p2)],
    11: [kd(rep.k1), kd(rep.k2), `wb:${rep.w1}`, `wb:${rep.w2}`, `xx:${rep.x1}`],
    12: [kd(rep.n1), kd(rep.mk), kd(rep.n2), kd(rep.n1s), kd(rep.v2), `xy:${rep.k1}`, UNLESBAR],
    13: [kd(rep.n1s)],
    14: [],
    15: [kd(rep.n1s), kd(rep.v2)],
    ...zusatz,
  };
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${rep.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    wb: {name: WB, wbs: ${rep.s}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    xx: {name: XX, wbs: ${rep.t}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
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

module.exports = { gesamtRepositorien, gesamtVorbereiten, UNLESBAR };
