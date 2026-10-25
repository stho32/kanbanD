// Startet kanbanD gegen einen frischen Ordner und räumt danach auf.
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const PROGRAMM = path.resolve(__dirname, '../../target/debug/kanbanD');

// Kein automatisches `git gc` in den Testordnern: es läuft nach einem Commit losgelöst im Hintergrund weiter und
// schreibt noch in .git/objects/pack, während `stoppen` den Ordner löscht (ENOTEMPTY auf der CI). Gilt für kanbanD
// und jeden git-Aufruf der Tests, weil beide die Umgebung dieses Prozesses erben.
Object.assign(process.env, { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'gc.auto', GIT_CONFIG_VALUE_0: '0' });
// Server in derselben Zone wie der Browser (timezoneId), damit der Versatz neuer Zeitpunkte feststeht (R00084)
process.env.TZ = 'Europe/Berlin';

/** Startet kanbanD und liefert die Adresse aus der Startzeile; `umgebung` ergänzt die Umgebungsvariablen. */
function programmStarten(ordner, port, umgebung) {
  const kind = spawn(PROGRAMM, [ordner, '--kein-browser', '--host', '127.0.0.1', '--port', String(port)], { stdio: ['ignore', 'pipe', 'inherit'], env: { ...process.env, ...umgebung } });
  const adresse = new Promise((ok, fehler) => {
    let puffer = '';
    kind.stdout.on('data', d => { puffer += d; const m = /(http:\/\/\S+)/.exec(puffer); if (m) ok(m[1]); });
    kind.once('exit', c => fehler(new Error('kanbanD beendet mit ' + c)));
  });
  return { kind, adresse };
}

async function kanbanStarten(vorbereiten, umgebung = {}) {
  const wurzel = fs.mkdtempSync(path.join(os.tmpdir(), 'kanband-e2e-'));
  const ordner = path.join(wurzel, 'kanban');
  if (vorbereiten) await vorbereiten(ordner);
  let { kind, adresse } = programmStarten(ordner, 0, umgebung);
  adresse = await adresse;
  const beenden = () => new Promise(ok => { if (kind.exitCode !== null) ok(); else { kind.once('exit', ok); kind.kill(); } });
  return {
    ordner, adresse,
    // Neustart auf demselben Port (R00085): offene Seiten müssen von selbst wieder verbinden
    neuStarten: async () => {
      await beenden();
      const neu = programmStarten(ordner, new URL(adresse).port, umgebung);
      kind = neu.kind;
      await neu.adresse;
    },
    git: (...args) => execFileSync('git', ['-C', ordner, ...args], { encoding: 'utf8' }).trim(),
    lies: rel => fs.readFileSync(path.join(ordner, rel), 'utf8'),
    schreib: (rel, inhalt) => { fs.mkdirSync(path.dirname(path.join(ordner, rel)), { recursive: true }); fs.writeFileSync(path.join(ordner, rel), inhalt); },
    // Erst auf das Ende des Programms warten — ein laufender Commit schreibt sonst noch in .git.
    stoppen: async () => {
      await beenden();
      fs.rmSync(wurzel, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
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

/** Öffnet die zugeklappte Filterbox der Berichte (R00081); offen bleibt sie für den Rest des Tests. */
async function filterOeffnen(page) {
  const box = page.locator('details.bfilter-box');
  if (await box.getAttribute('open') === null) await box.locator('summary').click();
  await page.getByRole('group', { name: 'Berichtsfilter' }).waitFor();
}

module.exports = { kanbanStarten, einrichten, alsPerson, liveBereit, filterOeffnen };
