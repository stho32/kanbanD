// Ausgangslage von R00205 (Ansicht „Commits“): ein Arbeits-Repository R mit echtem Git, ein Register und fünf Aufgaben,
// die ihre Proben trennen (#1 fünf Verweise, #2 keine, #3 sechs Zustände, #4 Breitendaten, #5 ohne Kürzel).
// Gebaut wird mit Git im Test, nie aus Zwischenspeichern (R00205 „Echtes Git“).
"use strict";
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADA = 'Ada Autorin';
const AUTOR_LANG = 'Maximiliane Alexandrowna von Beispielhausen';
const TITEL_PFAD = '2026-03-04T09:00:00+00:00';

/** Git als `name` (E-Mail `ada@example.org`, damit die Proben „keine Adresse in der Ansicht“ etwas zu finden hätten). */
function gitAls(r, name, datum, ...args) {
  return execFileSync('git', ['-C', r, '-c', `user.name=${name}`, '-c', 'user.email=ada@example.org', ...args], {
    encoding: 'utf8', maxBuffer: 1 << 28,
    env: { ...process.env, GIT_AUTHOR_DATE: datum, GIT_COMMITTER_DATE: datum },
  }).trim();
}

/** Legt `datei` mit `zeilen` Zeilen an (`vorsatz` + Zähler) und committet mit `nachricht`; liefert den Hash. */
function dateiCommit(r, name, datum, datei, zeilen, nachricht, vorsatz = null) {
  const kopf = vorsatz === null ? `${datei} ` : vorsatz;
  let inhalt = '';
  for (let i = 1; i <= zeilen; i++) inhalt += `${kopf}${i}\n`;
  fs.writeFileSync(path.join(r, datei), inhalt);
  gitAls(r, name, datum, 'add', '-A');
  gitAls(r, name, datum, 'commit', '-q', '-m', nachricht);
  return gitAls(r, name, datum, 'rev-parse', 'HEAD');
}

/** Ein Name aus `anfang` und `x` bis zur Länge `laenge`. */
const aufgefuellt = (anfang, laenge) => anfang + 'x'.repeat(laenge - anfang.length);

/** Das Arbeits-Repository R (R00204 „Ausgangslage“): K1–K4 auf main, W1 auf karte/1 im Worktree, V1 verwaist, R1 nur auf o/x,
 *  V2 verwaist und danach gelöscht, `o/main` = K4 mit `o/HEAD`. Dazu die Commits der Breitendaten (#4). */
function arbeitsRepositoryBauen(basis) {
  const r = path.join(basis, 'R'), wt = path.join(basis, 'R-karte-1');
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/app.md'), '# App\n');
  gitAls(r, ADA, '2026-02-01T09:00:00+00:00', 'init', '-q', '-b', 'main');
  for (const [k, v] of [['gc.auto', '0'], ['gc.writeCommitGraph', 'false']]) gitAls(r, ADA, '2026-02-01T09:00:00+00:00', 'config', k, v);
  const h = {};
  h.k1 = dateiCommit(r, ADA, '2026-02-01T09:00:00+00:00', 'a.txt', 2, 'a.txt anlegen');
  h.k2 = dateiCommit(r, ADA, '2026-02-02T09:00:00+00:00', 'a.txt', 3, 'a.txt ändern');
  h.k3 = dateiCommit(r, ADA, '2026-03-01T10:00:00+01:00', 'c.txt', 3, 'c.txt anlegen');
  h.k4 = dateiCommit(r, ADA, '2026-02-20T09:00:00+00:00', 'd.txt', 1, 'd.txt anlegen');
  gitAls(r, ADA, '2026-02-02T09:00:00+00:00', 'worktree', 'add', '-q', '-b', 'karte/1', wt, h.k2);
  h.w1 = dateiCommit(wt, 'Bernd Beispiel', '2026-03-02T09:00:00+00:00', 'b.txt', 1, 'b.txt anlegen');
  gitAls(r, ADA, '2026-03-03T09:00:00+00:00', 'checkout', '-q', '--detach');
  h.v1 = dateiCommit(r, ADA, '2026-03-03T09:00:00+00:00', 'v.txt', 1, 'v.txt anlegen');
  gitAls(r, ADA, '2026-03-03T09:00:00+00:00', 'tag', 'v1');
  gitAls(r, ADA, '2026-03-03T09:00:00+00:00', 'checkout', '-q', '--detach', h.k2);
  h.r1 = dateiCommit(r, ADA, TITEL_PFAD, 'r.txt', 1, 'r.txt anlegen');
  gitAls(r, ADA, TITEL_PFAD, 'update-ref', 'refs/remotes/o/x', h.r1);
  gitAls(r, ADA, '2026-03-05T09:00:00+00:00', 'checkout', '-q', '--detach', 'main');
  h.v2 = dateiCommit(r, ADA, '2026-03-05T09:00:00+00:00', 'w.txt', 1, 'w.txt anlegen');
  breitenCommits(r, h);
  gitAls(r, ADA, '2026-03-05T09:00:00+00:00', 'checkout', '-q', 'main');
  gitAls(r, ADA, '2026-03-05T09:00:00+00:00', 'update-ref', 'refs/remotes/o/main', h.k4);
  gitAls(r, ADA, '2026-03-05T09:00:00+00:00', 'symbolic-ref', 'refs/remotes/o/HEAD', 'refs/remotes/o/main');
  // V2 „gelöscht“: Reflogs leeren, unerreichbare Objekte entfernen
  gitAls(r, ADA, '2026-03-06T09:00:00+00:00', 'reflog', 'expire', '--expire=now', '--all');
  gitAls(r, ADA, '2026-03-06T09:00:00+00:00', 'gc', '-q', '--prune=now');
  return { r, wt, ...h };
}

/** Die Breitendaten (R00205 „Aufgabe #4“): Commit Z mit 600-Zeichen-Titel, 45-Zeichen-Autor, 11 lokalen und 12 entfernten
 *  Zweigen von 60 Zeichen, `+1.204.567 −987.654`; Titel mit 500, 501 und 499 `a` plus Emoji; Rand-Commits mit „…“, Schädlingen. */
function breitenCommits(r, h) {
  const tag = '2026-03-10T09:00:00+00:00';
  // Alle Breitendaten stehen auf Nebenästen ab K2: K3 liegt dann nur auf main und o/main, wie die Ausgangslage von #1 es verlangt
  gitAls(r, ADA, tag, 'checkout', '-q', '--detach', h.k2);
  // Zeilenmassen: der Vorgänger legt 987.654 Zeilen an, Z ersetzt die Datei durch 1.204.567 andere (+1.204.567 −987.654)
  dateiCommit(r, ADA, tag, 'masse-alt.txt', 987654, 'Masse anlegen', 'alt ');
  fs.rmSync(path.join(r, 'masse-alt.txt'));
  const wort = 'W'.repeat(120);
  const titel600 = (`Langer Titel ${wort} ` + 'wort '.repeat(100)).slice(0, 600);
  fs.writeFileSync(path.join(r, 'masse-neu.txt'), Array.from({ length: 1204567 }, (_, i) => `neu ${i + 1}\n`).join(''));
  gitAls(r, AUTOR_LANG, '2026-03-10T10:00:00+00:00', 'add', '-A');
  gitAls(r, AUTOR_LANG, '2026-03-10T10:00:00+00:00', 'commit', '-q', '-m', titel600);
  h.z = gitAls(r, AUTOR_LANG, tag, 'rev-parse', 'HEAD');
  for (let i = 1; i <= 11; i++) gitAls(r, ADA, tag, 'branch', aufgefuellt(`z${String(i).padStart(2, '0')}-`, 60), h.z);
  for (let i = 1; i <= 12; i++) gitAls(r, ADA, tag, 'update-ref', 'refs/remotes/' + aufgefuellt(`o/e${String(i).padStart(2, '0')}-`, 60), h.z);
  const rand = (n, zeit, titel, name = ADA) => {
    const datei = `rand-${n}.txt`;
    gitAls(r, ADA, tag, 'checkout', '-q', '--detach', h.k2);
    return dateiCommit(r, name, `2026-03-11T0${zeit}:00:00+00:00`, datei, 1, titel);
  };
  h.t500 = rand(1, 1, 'a'.repeat(500));
  h.t501 = rand(2, 2, 'a'.repeat(501));
  h.t499 = rand(3, 3, 'a'.repeat(499) + '\u{1F600}');
  h.t500punkte = rand(4, 4, 'a'.repeat(499) + '…');
  h.boese = rand(5, 5, '<img src=x onerror=window.pwn=1> "x" \\ y', 'Mallory <b>fett</b> "q" & x');
  for (const c of [h.t500, h.t501, h.t499, h.t500punkte, h.boese]) gitAls(r, ADA, tag, 'update-ref', 'refs/heads/rand-' + c.slice(0, 7), c);
  gitAls(r, ADA, tag, 'branch', 'a"><i>z', h.boese);
}

const EINSTELLUNGEN_KOPF = '---\npeople:\n  st: {name: Stefan, kind: human}\n  mi: {name: Mia, kind: human}\n  cl: {name: Claude, kind: agent}\nclasses:\n  feature: {label: Funktion, color: green}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n';

/** `grund` von `repository_fehlt` mit genau `laenge` Zeichen: „Ordner fehlt: <Pfad>“, der Pfad wird aufgefüllt. */
function langerOrdner(basis, laenge) {
  const rumpf = 'Ordner fehlt: '.length + basis.length + '/'.length;
  return path.join(basis, 'g'.repeat(laenge - rumpf));
}

/** Eine Zeile `commits:` der Aufgabendatei: jeder Verweis JSON-gequotet (gültiges YAML). */
const commitsYaml = verweise => verweise.length ? 'commits:\n' + verweise.map(v => `  - ${JSON.stringify(v)}\n`).join('') : '';

const aufgabeDatei = (nr, titel, verweise, extra = '') => `---\nid: ${nr}\ntitle: ${titel}\n${commitsYaml(verweise)}${extra}---\n`;

/**
 * Der eingerichtete Ordner für `kanbanStarten`: Register `kd` (R), `xx` (Ordner ohne Git), `lg` (Ordner fehlt, langer Grund);
 * Aufgaben #1–#5. Der Aufrufer baut das Repository vorher mit `arbeitsRepositoryBauen` und gibt dessen Hashes mit.
 */
function ausgangslage(basis, rep, { nur = null } = {}) {
  const keinGit = path.join(basis, 'kein-git');
  fs.mkdirSync(path.join(keinGit, 'Planung'), { recursive: true });
  const lang = langerOrdner(basis, 200);
  const register = EINSTELLUNGEN_KOPF
    + `    kd: {name: KD, wbs: ${rep.r}/Dokumentation/Planung/app.md, requirements: ""}\n`
    + `    xx: {name: XX, wbs: ${keinGit}/Planung/app.md, requirements: ""}\n`
    + `    lg: {name: LG, wbs: ${lang}/app.md, requirements: ""}\n---\n`;
  const kd = h => `kd:${h}`;
  const unlesbar64 = 'kd:' + 'g'.repeat(61);
  const aufgaben = {
    1: [kd(rep.k3), kd(rep.w1), kd(rep.v1), kd(rep.v2), kd(rep.r1)],
    2: [],
    3: [kd(rep.k3), kd(rep.w1), kd(rep.v1), kd(rep.r1), kd(rep.v2), `xx:${rep.k1}`, `xy:${rep.k1}`, 'kd:3f2a9c1;rm -rf x'],
    4: [kd(rep.z), kd(rep.t500), kd(rep.t501), kd(rep.t499), kd(rep.t500punkte), kd(rep.boese), unlesbar64, `lg:${rep.k1}`],
    5: [rep.k1],
  };
  const dateien = { 'kanbanD.md': register };
  const zeilen = [];
  for (const [nr, verweise] of Object.entries(aufgaben)) {
    if (nur && !nur.includes(+nr)) continue;
    const name = `000${nr}-aufgabe-${nr}.md`;
    dateien[`aufgaben/${name}`] = aufgabeDatei(nr, `Aufgabe ${nr}`, verweise);
    zeilen.push(`- #${nr}`);
  }
  dateien['boards/entwicklung.md'] = `# Entwicklung\n\n## Zu erledigen\n\n${zeilen.join('\n')}\n\n## In Arbeit\n\n## Erledigt\n`;
  return { dateien, lang };
}

/** Die vollständige Ausgangslage als `vorbereiten` für `kanbanStarten`: Repository bauen, Dateien schreiben, committen. */
function ausgangslageVorbereiten(rep, basis, optionen) {
  const { dateien } = ausgangslage(basis, rep, optionen);
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

/** Ein Wegwerf-Ordner für das Repository (außerhalb des kanbanD-Ordners), den der Aufrufer am Ende entfernt. */
function basisAnlegen() {
  return fs.realpathSync(fs.mkdtempSync(path.join(require('os').tmpdir(), 'kanband-commits-')));
}

let geteilt = null;
/** Ein Repository je Prozess, am Prozessende entfernt: kanbanD liest R nur, die Proben ohne Schreiben an R teilen es (der Bau
 *  mit 1,2 Mio. Zeilen kostet Sekunden). Wer R verändert, baut sein eigenes. */
function geteiltesRepository() {
  if (!geteilt) {
    const basis = basisAnlegen();
    geteilt = { basis, rep: arbeitsRepositoryBauen(basis) };
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return geteilt;
}

module.exports = { geteiltesRepository, arbeitsRepositoryBauen, ausgangslage, ausgangslageVorbereiten, basisAnlegen, gitAls, aufgabeDatei, AUTOR_LANG };
