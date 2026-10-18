// Arbeits-Repository einer Anwendung für die WBS-Specs — ein eigenes Git-Repository neben dem kanbanD-Ordner.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { einrichten } = require('./hilfen');

const KOPF = '| ID | Ebene | Eltern | Name | Status | Fertig-Kriterium | Eingabe → Ausgabe | Aufwand | Ausbaustufe | Braucht | Requirement | Notiz | Phase |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|\n';
const zeile = (id, ebene, eltern, name, status, rest = {}) => `| ${id} | ${ebene} | ${eltern} | ${name} | ${status} | ${rest.fertig || ''} | ${rest.ea || ''} | ${rest.aufwand || ''} | ${rest.stufe || ''} | ${rest.braucht || ''} | ${rest.req || ''} | ${rest.notiz || ''} | ${rest.phase || ''} |\n`;
const wbsText = zeilen => '---\napplication: kanbanD\nzuletzt: 2026-01-01\n---\n\n# WBS\n\n' + KOPF + zeilen.join('');

/** Ein Arbeits-Repository mit committeter WBS `text` und Anforderung R00001. */
function arbeitsRepository(text) {
  const r = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-arbeit-')));
  fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
  fs.mkdirSync(path.join(r, 'Anforderungen'));
  fs.writeFileSync(path.join(r, 'Dokumentation/Planung/kanbanD.md'), text);
  fs.writeFileSync(path.join(r, 'Anforderungen/R00001-board.md'), '# R00001: Board\n');
  const git = (...a) => execFileSync('git', ['-C', r, ...a], { encoding: 'utf8' });
  git('init', '-q'); git('add', '-A'); git('-c', 'user.name=KI', '-c', 'user.email=k@k', 'commit', '-q', '-m', 'WBS');
  const wbs = path.join(r, 'Dokumentation/Planung/kanbanD.md');
  return { wurzel: r, wbs, git, lies: () => fs.readFileSync(wbs, 'utf8'), aufraeumen: () => fs.rmSync(r, { recursive: true, force: true }) };
}

/** kanbanD-Ordner mit Stefan (Mensch) und der Anwendung `kd` im Register. */
const mitRegister = arbeit => einrichten({
  'kanbanD.md': `---\npeople:\n  st: {name: Stefan, kind: human}\nclasses: {}\nsources:\n  wbs: ""\n  requirements: ""\n  applications:\n    kd: {name: kanbanD, wbs: "${arbeit.wbs}", requirements: "${arbeit.wurzel}/Anforderungen"}\n---\n`,
});

module.exports = { KOPF, zeile, wbsText, arbeitsRepository, mitRegister };
