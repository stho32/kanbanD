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
    kind.on('exit', c => fehler(new Error('kanbanD beendet mit ' + c)));
  });
  return {
    ordner, adresse,
    git: (...args) => execFileSync('git', ['-C', ordner, ...args], { encoding: 'utf8' }).trim(),
    lies: rel => fs.readFileSync(path.join(ordner, rel), 'utf8'),
    schreib: (rel, inhalt) => { fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true }); fs.writeFileSync(path.join(ordner, rel), inhalt); },
    stoppen: () => { kind.kill(); fs.rmSync(wurzel, { recursive: true, force: true }); },
  };
}

module.exports = { kanbanStarten };
