// R00225 Gesamt-Diff: Folge und „fremde Commits“ nur mit fremdem Commit (Karte #234, I0215) — AK 5 auf der Review-Seite
// „Alle Änderungen“ im echten Programm gegen echtes Git. Ausgangslage nach R00225 (Fälle N, N+F, F) in einem Repository R
// (kd), Fall nach Fall auf main; jeder Fall beginnt mit einem eigenen A0, die Spanne seiner Aufgabe enthält nur ihn.
// Verneinungen erst nach einem sichtbaren Signal (Überschrift des Abschnitts).
"use strict";
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { kanbanStarten, alsPerson, mutanteEinsetzen } = require('./hilfen');
const { basisAnlegen, gitAls, aufgabeDatei, EINSTELLUNGEN_KOPF } = require('./commits-hilfen');

/* ── Testsprache: Ausgangslage ── */
const ADA = 'Ada Autorin';
const X = Array.from({ length: 10 }, (_, i) => `x${i}\n`).join('');
const zeilen = (n, kopf) => Array.from({ length: n }, (_, i) => `${kopf}${i + 1}\n`).join('');
const ersetzt = (text, nr, neu) => text.split('\n').map((z, i) => (i === nr - 1 ? neu : z)).join('\n');

let tag = 0;
/** Schreibt `aenderungen` (Pfad → Inhalt, null löscht Datei oder Verzeichnis; als Objekt oder als Liste von Paaren, wenn ein
 *  Pfad zweimal vorkommt) und committet; liefert den Hash. */
function commit(r, titel, aenderungen) {
  const datum = `2026-06-${String(2 + Math.floor(tag / 20)).padStart(2, '0')}T${String(9 + (tag % 10)).padStart(2, '0')}:${String(tag % 60).padStart(2, '0')}:00+00:00`;
  tag++;
  for (const [pfad, inhalt] of Array.isArray(aenderungen) ? aenderungen : Object.entries(aenderungen)) {
    if (inhalt === null) fs.rmSync(path.join(r, pfad), { recursive: true, force: true });
    else { fs.mkdirSync(path.dirname(path.join(r, pfad)), { recursive: true }); fs.writeFileSync(path.join(r, pfad), inhalt); }
  }
  gitAls(r, ADA, datum, 'add', '-A');
  gitAls(r, ADA, datum, 'commit', '-q', '--allow-empty', '-m', titel);
  return gitAls(r, ADA, datum, 'rev-parse', 'HEAD');
}

/** Fall N (ohne) oder N+F (mit fremdem Commit an `g`): A0 `b`, `d/x`, `g`; K1 macht `d/x` zum Verzeichnis mit `d/x/inner` (Inhalt
 *  von `b`) und ändert `g`; K2 benennt `d/x/inner` in `bb` um und legt `d/x` wie in A0 an. Liefert [K1, K2]. */
function fallN(r, fremd) {
  let g = zeilen(12, 'g');
  commit(r, 'A0 Fall N', { b: X, 'd/x': `${X}y\n`, g, bb: null });
  g = ersetzt(g, 2, 'K1-g');
  const k1 = commit(r, 'K1 Datei wird Verzeichnis', { b: null, 'd/x': null, 'd/x/inner': X, g });
  if (fremd) { g = ersetzt(g, 7, 'FREMD-g'); commit(r, 'F fremd', { g }); }
  const k2 = commit(r, 'K2 Verzeichnis wird Datei', [['d/x', null], ['bb', X], ['d/x', `${X}y\n`]]);
  return [k1, k2];
}

/** Fall F (R00208 #2): K1, F (fremd) und K2 ändern `a.dat`; K1 und K2 ändern `k.dat`. Liefert [K1, K2]. */
function fallF(r) {
  let a = zeilen(12, 'z');
  commit(r, 'A0 Fall F', { 'a.dat': a });
  a = ersetzt(a, 2, 'K1');
  const k1 = commit(r, 'K1 a.dat und k.dat', { 'a.dat': a, 'k.dat': 'k1\nk2\n' });
  a = ersetzt(a, 6, 'FREMD-6');
  commit(r, 'F fremd', { 'a.dat': a, 'f.dat': 'FREMD-f\n' });
  a = ersetzt(a, 11, 'K2');
  const k2 = commit(r, 'K2 a.dat', { 'a.dat': a, 'k.dat': 'k1\nk2\nk3\n' });
  return [k1, k2];
}

let geteilt = null;
/** R mit den Fällen N (#21), N+F (#22) und F (#23), einmal je Prozess. */
function repository() {
  if (!geteilt) {
    const basis = basisAnlegen();
    const r = path.join(basis, 'R');
    fs.mkdirSync(path.join(r, 'Dokumentation/Planung'), { recursive: true });
    fs.writeFileSync(path.join(r, 'Dokumentation/Planung/app.md'), '# App\n');
    gitAls(r, ADA, '2026-06-01T09:00:00+00:00', 'init', '-q', '-b', 'main');
    geteilt = { r, 21: fallN(r, false), 22: fallN(r, true), 23: fallF(r) };
    process.on('exit', () => fs.rmSync(basis, { recursive: true, force: true }));
  }
  return geteilt;
}

function vorbereiten(rep) {
  const register = EINSTELLUNGEN_KOPF + `    kd: {name: KD, wbs: ${rep.r}/Dokumentation/Planung/app.md, requirements: ""}\n---\n`;
  const dateien = { 'kanbanD.md': register };
  for (const nr of [21, 22, 23]) dateien[`aufgaben/${String(nr).padStart(4, '0')}-aufgabe-${nr}.md`] = aufgabeDatei(nr, `Aufgabe ${nr}`, rep[nr].map(h => `kd:${h}`));
  dateien['boards/entwicklung.md'] = '# Entwicklung\n\n## Zu erledigen\n\n- #21\n- #22\n- #23\n\n## In Arbeit\n\n## Erledigt\n';
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

/* ── Treiber ── */
const reviewAdresse = (k, nr) => `${k.adresse}#/aufgaben/aufgabe/${nr}/review`;
const abschnitt = page => page.locator('#rv-a0');
const dateikoepfe = page => page.locator('#rv-a0 .df-k');

const SATZ_FREMD_EINS = 'Zwischen den Commits der Aufgabe liegt 1 fremder Commit. Er berührt Dateien der Aufgabe; 1 Datei steht deshalb als Folge der Schritte der Aufgabe. Die Änderungen des fremden Commits sind nicht zu sehen.';
const FOLGE_SATZ = 'Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert. Hier stehen die Schritte der Aufgabe nacheinander; Änderungen fremder Commits fehlen.';

test.describe('R00225 Alle Änderungen ohne fremden Commit', () => {
  let k;
  test.beforeEach(async ({ page }) => {
    await mutanteEinsetzen(page);
    k = await kanbanStarten(vorbereiten(repository()));
    await alsPerson(page, 'st');
  });
  test.afterEach(() => k.stoppen());

  test('AK 5 Fall N (Abnahme-Probe #234): zwei eigene Commits an d/x ohne fremden Commit — 2 Commits · 2 Dateien, kein d/x, kein Satz über fremde Commits', async ({ page }) => {
    await page.goto(reviewAdresse(k, 21));
    await expect(abschnitt(page).locator('h2')).toHaveText('Anwendung kd 2 Commits · 2 Dateien');
    await expect(dateikoepfe(page)).toHaveCount(2);
    const koepfe = await dateikoepfe(page).allTextContents();
    expect(koepfe.filter(t => t.includes('d/x'))).toEqual([]);
    const text = await page.locator('#review').textContent();
    expect(text).not.toContain('Zwischen den Commits der Aufgabe');
    expect(text).not.toContain('Fremde Commits haben diese Datei');
    expect(text).not.toContain('fremde Commits');
    await expect(page.locator('#rv-a0 .df-folge')).toHaveCount(0);
  });

  test('AK 5 Fall N+F: mit einem fremden Commit dazwischen steht der Satz — „Fremde Commits haben diese Datei …“ genau einmal, an g; d/x steht nicht da', async ({ page }) => {
    await page.goto(reviewAdresse(k, 22));
    await expect(abschnitt(page).locator('h2')).toHaveText('Anwendung kd 2 Commits · 2 Dateien');
    await expect(page.locator('#rv-a0 .rv-hw')).toHaveText(SATZ_FREMD_EINS);
    await expect(page.locator('#rv-a0 .df-folge')).toHaveText([FOLGE_SATZ]);
    const mitSatz = page.locator('#rv-a0 section.df').filter({ has: page.locator('.df-folge') });
    await expect(mitSatz.locator('.df-k')).toHaveText(/^gFolge · 1 Commit/);
    const koepfe = await dateikoepfe(page).allTextContents();
    expect(koepfe.filter(t => t.includes('d/x'))).toEqual([]);
  });

  test('AK 5 Fall F (Gegenprobe): a.dat als Folge mit beiden Sätzen wie in R00210 AK 2 und AK 3', async ({ page }) => {
    await page.goto(reviewAdresse(k, 23));
    await expect(abschnitt(page).locator('h2')).toHaveText('Anwendung kd 2 Commits · 2 Dateien');
    await expect(page.locator('#rv-a0 .rv-hw')).toHaveText(SATZ_FREMD_EINS);
    await expect(page.locator('#rv-dk0-0')).toHaveText('a.datFolge · 2 Commits+2 −2');
    await expect(page.locator('#rv-d0-0 .df-folge')).toHaveText(FOLGE_SATZ);
  });
});
