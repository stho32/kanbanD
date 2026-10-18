// Startet kanbanD gegen einen frischen Ordner und räumt danach auf.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROGRAMM = path.resolve(__dirname, '../../target/debug/kanbanD');

async function kanbanStarten(vorbereiten) {
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-e2e-'));
  const ordner = path.join(wurzel, 'kanban');
  if (vorbereiten) await vorbereiten(ordner);
  const kind = spawn(PROGRAMM, [ordner, '--kein-browser', '--host', '127.0.0.1', '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const adresse = await new Promise((ok, fehler) => {
    let puffer = '';
    kind.stdout.on('data', d => { puffer += d; const m = /(http:\/\/\S+)/.exec(puffer); if (m) ok(m[1]); });
    kind.once('exit', c => fehler(new Error('kanbanD beendet mit ' + c)));
  });
  return {
    ordner, adresse,
    git: (...args) => execFileSync('git', ['-C', ordner, ...args], { encoding: 'utf8' }).trim(),
    lies: rel => fs.readFileSync(path.join(ordner, rel), 'utf8'),
    schreib: (rel, inhalt) => { fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true }); fs.writeFileSync(path.join(ordner, rel), inhalt); },
    // Erst auf das Ende des Programms warten — ein laufender Commit schreibt sonst noch in .git.
    stoppen: async () => {
      if (kind.exitCode === null) await new Promise(ok => { kind.once('exit', ok); kind.kill(); });
      fs.rmSync(wurzel, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
    },
  };
}

const EINSTELLUNGEN = `---
people:
  st: {name: Stefan, kind: human}
  mi: {name: Mia, kind: human}
  cl: {name: Claude, kind: agent}
  ab: {name: Anna, kind: human, active: false}
classes:
  bug: {label: Fehler, color: red}
  feature: {label: Funktion, color: green}
sources:
  wbs: plan/wbs.md
  requirements: anf/
---
`;

/** Ein eingerichteter Ordner: Stefan, Mia (Menschen), Claude (Agent), Anna (stillgelegt), Board „Entwicklung“. */
function einrichten(dateien = {}) {
  return ordner => {
    const alle = { 'kanbanD.md': EINSTELLUNGEN, 'boards/entwicklung.md': '# Entwicklung\n\n## Zu erledigen\n\n## In Arbeit\n\n## Erledigt\n', ...dateien };
    for (const [rel, inhalt] of Object.entries(alle)) {
      fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true });
      fs.writeFileSync(path.join(ordner, rel), inhalt);
    }
    execFileSync('git', ['-C', ordner, 'init', '-q']);
    execFileSync('git', ['-C', ordner, 'add', '-A']);
    execFileSync('git', ['-C', ordner, '-c', 'user.name=Vorbereitung', '-c', 'user.email=v@v', 'commit', '-q', '-m', 'eingerichtet']);
  };
}

/** Wählt im Tab die Identität, bevor die Seite lädt. */
async function alsPerson(page, kuerzel) {
  await page.addInitScript(k => sessionStorage.setItem('kanbanD.ich', k), kuerzel);
}

/** Wartet, bis die Seite live verbunden ist — erst dann kommt eine Änderung von außen sicher an (R00050). */
async function liveBereit(page) {
  await page.locator('html[data-live="verbunden"]').waitFor({ state: 'attached' });
}

module.exports = { kanbanStarten, einrichten, alsPerson, liveBereit };
