// Ausgangslage von R00218 (Nachfolger eines verwaisten Commits): ein Arbeits-Repository R mit echtem Git (Rebase, Cherry-pick, Squash,
// Merge, leerer Commit, Binärdatei) und vier Aufgaben; Mensch `sh`, Agent `entw1`. Gebaut wird mit Git im Test, wie R00205.
"use strict";
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { gitAls, basisAnlegen } = require('./commits-hilfen');

const ADA = 'Ada Autorin';

/** Git in R mit festem Commit-Datum; das Autordatum bleibt bei Rebase und Cherry-pick das des Originals. */
function gitUm(r, datum, ...args) {
  return execFileSync('git', ['-C', r, '-c', `user.name=${ADA}`, '-c', 'user.email=ada@example.org', ...args], { encoding: 'utf8', env: { ...process.env, GIT_COMMITTER_DATE: datum } }).trim();
}

/** R mit M0, M1, K → K' (Rebase), G, C → C1/C2, S1–S3 → S (Squash), Mg (Merge), E (leer), B → B3, B2. Liefert die Hashes. */
function nachfolgerRepository(basis) {
  const r = path.join(basis, 'R');
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/app.md'), '# App\n');
  const schreib = (datei, inhalt) => fs.writeFileSync(path.join(r, datei), inhalt);
  const git = (...args) => execFileSync('git', ['-C', r, ...args], { encoding: 'utf8' }).trim();
  const commit = (datum, nachricht) => {
    gitAls(r, ADA, datum, 'add', '-A');
    gitAls(r, ADA, datum, 'commit', '-q', '--allow-empty', '-m', nachricht);
    return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
  };
  gitAls(r, ADA, '2026-05-01T09:00:00+00:00', 'init', '-q', '-b', 'main');
  schreib('a.dat', 'eins\nzwei\ndrei\n'); schreib('b.dat', 'Hallo\n'); schreib('bild.png', Buffer.from('\x89PNG\0alt\0', 'binary'));
  const m0 = commit('2026-05-01T09:00:00+00:00', 'Grundstand');
  git('checkout', '-q', '-b', 'karte/1');
  schreib('a.dat', 'eins\nZWEI\ndrei\n');
  const k = commit('2026-05-02T09:00:00+00:00', 'Zeile zwei ändern');
  git('checkout', '-q', 'main');
  schreib('c.dat', 'drei\n');
  const m1 = commit('2026-05-03T09:00:00+00:00', 'Drittes anlegen');
  git('checkout', '-q', 'karte/1');
  gitUm(r, '2026-05-04T09:00:00+00:00', 'rebase', '-q', 'main');
  const k2 = git('rev-parse', 'HEAD');
  git('checkout', '-q', 'main'); git('merge', '-q', '--ff-only', 'karte/1'); git('branch', '-q', '-D', 'karte/1');
  git('checkout', '-q', '-b', 'fremd', m1);
  schreib('a.dat', 'eins\nzwei anders\ndrei\n');
  const g = commit('2026-05-05T09:00:00+00:00', 'Zeile zwei anders ändern');
  git('checkout', '-q', '--detach', m1);
  schreib('b.dat', 'Servus\n');
  const c = commit('2026-05-06T09:00:00+00:00', 'Gruß ändern');
  git('checkout', '-q', '-b', 'x', m1); gitUm(r, '2026-05-08T09:00:00+00:00', 'cherry-pick', c);
  const c1 = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', 'y', m0); gitUm(r, '2026-05-07T09:00:00+00:00', 'cherry-pick', c);
  const c2 = git('rev-parse', 'HEAD');
  git('checkout', '-q', '-b', 'karte/3', 'main');
  const s = ['eins\n', 'eins\nzwei\n', 'eins\nzwei\ndrei\n'].map((inhalt, i) => { schreib('s.dat', inhalt); return commit(`2026-05-09T09:0${i}:00+00:00`, `Schritt ${i + 1}`); });
  git('checkout', '-q', 'main');
  gitAls(r, ADA, '2026-05-10T09:00:00+00:00', 'merge', '-q', '--squash', 'karte/3');
  commit('2026-05-10T09:00:00+00:00', 'Schritte zusammen');
  git('branch', '-q', '-D', 'karte/3');
  git('checkout', '-q', '-b', 'seite', 'main');
  schreib('d.dat', 'd\n');
  commit('2026-05-11T09:00:00+00:00', 'Seitenarbeit');
  git('checkout', '-q', '-b', 'karte/4', 'main');
  gitAls(r, ADA, '2026-05-11T10:00:00+00:00', 'merge', '-q', '--no-ff', '-m', 'Seitenarbeit zusammenführen', 'seite');
  const mg = git('rev-parse', 'HEAD');
  git('checkout', '-q', '--detach', 'main'); git('branch', '-q', '-D', 'karte/4', 'seite');
  const e = commit('2026-05-12T09:00:00+00:00', 'Nichts ändern');
  git('checkout', '-q', '--detach', m0);
  schreib('bild.png', Buffer.from('\x89PNG\0X\0', 'binary'));
  const b = commit('2026-05-13T09:00:00+00:00', 'Bild tauschen');
  git('checkout', '-q', '-b', 'z', m0);
  schreib('bild.png', Buffer.from('\x89PNG\0Y\0', 'binary'));
  const b2 = commit('2026-05-14T09:00:00+00:00', 'Bild anders tauschen');
  git('checkout', '-q', '-b', 'w', m1); gitUm(r, '2026-05-15T09:00:00+00:00', 'cherry-pick', b);
  const b3 = git('rev-parse', 'HEAD');
  git('checkout', '-q', 'main');
  return { r, m0, m1, k, k2, g, c, c1, c2, s1: s[0], mg, e, b, b2, b3 };
}

/** `vorbereiten` für `kanbanStarten`: Register `kd` → R, #1 `kd:K`, `kd:M1` · #2 `kd:C` · #3 `kd:K`, `kd:K'` · #4 `kd:S1`, `kd:Mg`, `kd:E`, `kd:B`. */
function nachfolgerVorbereiten(rep) {
  const kopf = `---\npeople:\n  sh: {name: Stefan, kind: human}\n  entw1: {name: Entwickler, kind: agent}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: KD, wbs: ${rep.r}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const kd = h => `kd:${h}`;
  const karten = { 1: [kd(rep.k), kd(rep.m1)], 2: [kd(rep.c)], 3: [kd(rep.k), kd(rep.k2)], 4: [kd(rep.s1), kd(rep.mg), kd(rep.e), kd(rep.b)] };
  return ordner => {
    fs.mkdirSync(path.join(ordner, 'aufgaben'), { recursive: true });
    fs.mkdirSync(path.join(ordner, 'boards'), { recursive: true });
    fs.writeFileSync(path.join(ordner, 'kanbanD.md'), kopf);
    for (const [nr, verweise] of Object.entries(karten)) {
      fs.writeFileSync(path.join(ordner, `aufgaben/000${nr}-karte-${nr}.md`), `---\nid: ${nr}\ntitle: Karte ${nr}\ncommits:\n${verweise.map(v => `  - ${v}\n`).join('')}---\n`);
    }
    fs.writeFileSync(path.join(ordner, 'boards/fabrik.md'), `# Fabrik\n\n## Entwicklung\n\n${Object.keys(karten).map(nr => `- #${nr}`).join('\n')}\n`);
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

let geteilt = null;
/** Ein Repository je Prozess für Proben, die R nur lesen; wer R verändert, baut sein eigenes mit `nachfolgerRepository(basisAnlegen())`. */
function geteiltesNachfolgerRepository() {
  if (!geteilt) {
    const basis = basisAnlegen();
    geteilt = { basis, rep: nachfolgerRepository(basis) };
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return geteilt;
}

module.exports = { nachfolgerRepository, nachfolgerVorbereiten, geteiltesNachfolgerRepository };
