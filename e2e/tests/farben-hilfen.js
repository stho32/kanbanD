// Ausgangslage von R00217 (Syntaxfarben der Review-Seite): Wegwerf-Repository R mit K1 (#2, Farbe, Grenze, Zeichen), K2 (#3,
// feindlich innerhalb der Grenzen) und K3 (#4, 10.000 Zeilen über „Änderungen anzeigen“). Gebaut wird mit echtem Git im Test.
"use strict";
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { basisAnlegen, gitAls, aufgabeDatei, EINSTELLUNGEN_KOPF } = require('./commits-hilfen');

const ADA = 'Ada Autorin';
const TAG = '2026-05-01T09:00:00+00:00';

function schreiben(r, dateien) {
  for (const [rel, inhalt] of Object.entries(dateien)) {
    fs.mkdirSync(path.dirname(path.join(r, rel)), { recursive: true });
    fs.writeFileSync(path.join(r, rel), inhalt);
  }
}

function commitAlles(r, nachricht) {
  gitAls(r, ADA, TAG, 'add', '-A');
  gitAls(r, ADA, TAG, 'commit', '-q', '-m', nachricht);
  return gitAls(r, ADA, TAG, 'rev-parse', 'HEAD');
}

/** Zeilen aus einem wiederholten Muster, je 999 Zeichen (Patch-Zeile `+` + 999 = 1.000, R00217 „Feindlich“). */
const feindlich = (muster, n) => Array.from({ length: n }, () => muster.repeat(1000).slice(0, 999)).join('\n') + '\n';

const HUNKS_ALT = Array.from({ length: 20 }, (_, i) => `let x${i + 1} = ${i + 1};`);
// Hunk 1 fügt „/* offen“ nach Zeile 2 ein, Hunk 2 „fn b() {}“ und das Kommentarende nach Zeile 17 — dazwischen mehr als
// sechs unveränderte Zeilen.
const HUNKS_NEU = [...HUNKS_ALT.slice(0, 2), '/* offen', ...HUNKS_ALT.slice(2, 17), 'fn b() {}', '*/', ...HUNKS_ALT.slice(17)];
const zeilenText = zeilen => zeilen.join('\n') + '\n';

/** `zeichen.js`: Bidi U+202E, `\r` am Ende, U+2028, Tab und fremdes HTML (R00217 „Ausgangslage“). */
const ZEICHEN_JS = ['let s = "‮abc";', 'let r = 1;\r', 'let u = 1; let v = 2;', '\tlet t = 3;', '<img src=x onerror=window.PWN=1>'].join('\n') + '\n';

function farbenRepositoryBauen(basis) {
  const r = path.join(basis, 'R');
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/app.md'), '# App\n');
  gitAls(r, ADA, TAG, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['gc.auto', '0'], ['gc.writeCommitGraph', 'false']]) gitAls(r, ADA, TAG, 'config', k, v);
  schreiben(r, {
    'src/seiten.rs': 'let a = 1;\n/* weg\n*/ let c = 3;\n',
    'src/hunks.rs': zeilenText(HUNKS_ALT),
    'Makefile': 'x\n', 'notiz.unbekannt': 'x\n', 'Typ.TS': 'x\n', 'SRC/GROSS.RS': 'x\n',
    'alt.py': 'def f(): pass\n',
    'umbenannt.txt': '// u1\n// u2\n// u3\n// u4\nx\n',
  });
  const h = { r };
  h.k0 = commitAlles(r, 'Ausgangsstand');
  fs.rmSync(path.join(r, 'alt.py'));
  fs.rmSync(path.join(r, 'umbenannt.txt'));
  schreiben(r, {
    'src/main.rs': '/* Kopf\n   zweite Zeile\n*/\nfn main() {}\n',
    'src/seiten.rs': 'let a = 1;\nlet b = 2;\n*/ let c = 3;\n',
    'src/hunks.rs': zeilenText(HUNKS_NEU),
    'Makefile': 'fn x() {}\n', 'notiz.unbekannt': 'fn x() {}\n', 'Typ.TS': 'fn x() {}\n', 'SRC/GROSS.RS': 'fn y() {}\n',
    'umbenannt.rs': '// u1\n// u2\n// u3\n// u4\nfn z() {}\n',
    'grenze.rs': 'a'.repeat(999) + '\nfn g() {}\n',
    'drueber.rs': 'a'.repeat(1000) + '\nfn h() {}\n',
    'zeichen.js': ZEICHEN_JS,
  });
  h.k1 = commitAlles(r, 'K1 Farben');
  schreiben(r, {
    'feindlich.md': feindlich('<!-- ', 64),
    'feindlich.html': feindlich('<!-- ', 64),
    'feindlich.js': feindlich('/`"\'/* ', 261),
    'gut.rs': 'fn gut() {}\n',
  });
  h.k2 = commitAlles(r, 'K2 feindlich');
  schreiben(r, { 'lang.rs': 'let a = 1;\n'.repeat(10000) });
  h.k3 = commitAlles(r, 'K3 lang');
  return h;
}

let geteilt = null;
/** Ein Repository je Prozess, am Prozessende entfernt (kanbanD liest R nur). */
function farbenRepository() {
  if (!geteilt) {
    const basis = basisAnlegen();
    geteilt = { basis, rep: farbenRepositoryBauen(basis) };
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return geteilt.rep;
}

/** Die Aufgaben der Probe: #2 mit K1, #3 mit K2, #4 mit K3; Register `kd` → R. Den Kommentar an #2 legt `kommentarAnlegen` über die API an. */
function farbenVorbereiten(rep) {
  const kd = x => `kd:${x}`;
  const register = EINSTELLUNGEN_KOPF + `    kd: {name: KD, wbs: ${rep.r}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = {
    'kanbanD.md': register,
    'aufgaben/0002-aufgabe-2.md': aufgabeDatei(2, 'Farben', [kd(rep.k1)]),
    'aufgaben/0003-aufgabe-3.md': aufgabeDatei(3, 'Feindlich', [kd(rep.k2)]),
    'aufgaben/0004-aufgabe-4.md': aufgabeDatei(4, 'Lang', [kd(rep.k3)]),
    'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n- #2\n- #3\n- #4\n\n## In Arbeit\n\n## Erledigt\n',
  };
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

/** Der Kommentar an #2 mit Markdown-Codeblock ```rust (R00217 „Ausgangslage“), über die API wie ein Agent. */
async function kommentarAnlegen(request, k) {
  const antwort = await request.post(k.adresse + 'api/aufgaben/2/kommentare', { headers: { 'X-KanbanD-Wer': 'cl' }, data: { text: 'Beispiel:\n\n```rust\nfn m() {}\n```\n' } });
  if (!antwort.ok()) throw new Error('Kommentar nicht angelegt: ' + antwort.status());
}

module.exports = { farbenRepository, farbenVorbereiten, kommentarAnlegen, feindlich };
