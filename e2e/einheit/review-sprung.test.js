// R00236 B1225: Link nach VS Code, Sprungzeile, Link erlaubt, Patch-Adresse und Dateiname (web/review-uebersicht.js) — rein, ohne Browser.
const test = require('node:test');
const assert = require('node:assert');
const u = require('../../web/review-uebersicht.js');

const datei = (neu, zusatz = {}) => ({ neu, alt: neu, status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, ...zusatz });
const folge = (pfad, schritte) => ({ pfad, plus: 1, minus: 1, binaer: false, schritte });

test('vscodeLink: das Beispiel aus ADR-0042 „Durchsetzung“ — jeder Teil mit encodeURIComponent, / bleibt', () => {
  assert.strictEqual(u.vscodeLink('/w x', 'a/b?c#d%e:12.rs', 7), 'vscode://file/w%20x/a/b%3Fc%23d%25e%3A12.rs:7');
});

test('vscodeLink: ohne Zeile ohne „:<zeile>“; Umlaut, Anführungszeichen und < kodiert', () => {
  assert.strictEqual(u.vscodeLink('/tmp/R x', 'neu.rs', null), 'vscode://file/tmp/R%20x/neu.rs');
  assert.strictEqual(u.vscodeLink('/w', 'ä/"<b>.rs', 3), 'vscode://file/w/%C3%A4/%22%3Cb%3E.rs:3');
});

test('sprungZeile: die erste hinzugefügte Zeile, nicht der Hunkanfang (K-Pfad src/a.rs)', () => {
  const patch = '@@ -10,7 +10,7 @@\n k\n k\n k\n-alt\n+neu\n k\n k\n k\n';
  assert.strictEqual(u.sprungZeile(datei('src/a.rs', { patch }), []), 13);
});

test('sprungZeile: nur entfernt → erste Zeile der neuen Seite im ersten Hunk; Hunk +0,0 → 1', () => {
  assert.strictEqual(u.sprungZeile(datei('src/nur-weg.rs', { patch: '@@ -20,4 +20,3 @@\n k\n k\n-weg\n k\n' }), []), 20);
  assert.strictEqual(u.sprungZeile(datei('leer.rs', { patch: '@@ -1,2 +0,0 @@\n-a\n-b\n' }), []), 1);
});

test('sprungZeile: zwei Hunks — die erste hinzugefügte Zeile im zweiten Hunk, wenn der erste nur entfernt', () => {
  const patch = '@@ -2,2 +2,1 @@\n k\n-x\n@@ -40,2 +39,3 @@\n k\n+n\n k\n';
  assert.strictEqual(u.sprungZeile(datei('z.rs', { patch }), []), 40);
});

test('sprungZeile: ohne Hunk, ohne patch (gross, nachladen) und bei zu_gross_zum_anzeigen null', () => {
  assert.strictEqual(u.sprungZeile(datei('neu.rs', { status: 'R', alt: 'alt.rs', patch: '' }), []), null);
  assert.strictEqual(u.sprungZeile(datei('bild.png', { binaer: true }), []), null);
  assert.strictEqual(u.sprungZeile(datei('src/gross.rs', { gross: true }), []), null);
  assert.strictEqual(u.sprungZeile(datei('n.rs', { nachladen: true }), []), null);
  assert.strictEqual(u.sprungZeile(datei('l.rs', { gross: true }), [{ art: 'zu_gross_zum_anzeigen', datei: 'l.rs' }]), null);
});

test('sprungZeile: Folge-Datei aus dem letzten Schritt; ohne dessen patch null, auch wenn ein früherer einen hat', () => {
  const mit = { status: 'M', plus: 1, minus: 0, binaer: false, gross: false, nachladen: false, patch: '@@ -30,1 +30,2 @@\n k\n+n\n' };
  assert.strictEqual(u.sprungZeile(folge('src/f.rs', [{ ...mit, patch: '@@ -1 +1 @@\n-a\n+b\n' }, mit]), []), 31);
  assert.strictEqual(u.sprungZeile(folge('src/f.rs', [mit, { ...mit, patch: undefined, gross: true }]), []), null);
});

test('linkErlaubt: A, M, R ja; D nein; Bidi oder Steuerzeichen in Pfad oder Wurzel nein; Folge mit letztem Schritt D nein', () => {
  assert.strictEqual(u.linkErlaubt('/w', datei('a.rs', { status: 'A' })), true);
  assert.strictEqual(u.linkErlaubt('/w', datei('a.rs')), true);
  assert.strictEqual(u.linkErlaubt('/w', datei('neu.rs', { status: 'R', alt: 'alt.rs' })), true);
  assert.strictEqual(u.linkErlaubt('/w', datei(null, { status: 'D', alt: 'weg.rs' })), false);
  assert.strictEqual(u.linkErlaubt('/w', datei('bidi-‮datei.dat', { status: 'A' })), false);
  assert.strictEqual(u.linkErlaubt('/w', datei('zeile\nneu.rs', { status: 'A' })), false);
  assert.strictEqual(u.linkErlaubt('/w‮', datei('a.rs')), false);
  assert.strictEqual(u.linkErlaubt('', datei('a.rs')), false);
  const m = { status: 'M', plus: 1, minus: 0 };
  assert.strictEqual(u.linkErlaubt('/w', folge('src/f.rs', [m, m])), true);
  assert.strictEqual(u.linkErlaubt('/w', folge('src/g.rs', [m, m, { status: 'D', plus: 0, minus: 3 }])), false);
});

test('kopierPfad: roh, bei D der alte Pfad, Bidi bleibt', () => {
  assert.strictEqual(u.kopierPfad('/w x', datei('src/a.rs')), '/w x/src/a.rs');
  assert.strictEqual(u.kopierPfad('/w x', datei(null, { status: 'D', alt: 'weg.rs' })), '/w x/weg.rs');
  assert.strictEqual(u.kopierPfad('/w', datei('b-‮d.dat')), '/w/b-‮d.dat');
  assert.strictEqual(u.kopierPfad('/w', folge('src/g.rs', [{ status: 'D' }])), '/w/src/g.rs');
});

test('patchAdresse: Ein Commit mit commit=, Alle Änderungen mit anwendung= ohne commit=, alles kodiert', () => {
  assert.strictEqual(u.patchAdresse(4, { commit: 'kd:ab12' }, 'src/a.rs'), '/api/aufgaben/4/diff?commit=kd%3Aab12&datei=src%2Fa.rs&format=patch');
  assert.strictEqual(u.patchAdresse(4, { anwendung: 'wb' }, 'b.js'), '/api/aufgaben/4/diff?anwendung=wb&datei=b.js&format=patch');
  assert.strictEqual(u.patchAdresse(4, { commit: 'kd:ab12' }, 'a/b?c#d%e:12.rs'), '/api/aufgaben/4/diff?commit=kd%3Aab12&datei=a%2Fb%3Fc%23d%25e%3A12.rs&format=patch');
});

test('patchName: letzter Teil nur aus [A-Za-z0-9._-] → <name>.patch, sonst datei.patch', () => {
  assert.strictEqual(u.patchName('src/a.rs'), 'a.rs.patch');
  assert.strictEqual(u.patchName('web/kd-app.css'), 'kd-app.css.patch');
  assert.strictEqual(u.patchName('ä.rs'), 'datei.patch');
  assert.strictEqual(u.patchName('a/b?c#d%e:12.rs'), 'datei.patch');
  assert.strictEqual(u.patchName('a:b'), 'datei.patch');
});

test('vscodeTitel: mit Zeile „In VS Code an Zeile <z> öffnen“, ohne „In VS Code öffnen“', () => {
  assert.strictEqual(u.vscodeTitel(13), 'In VS Code an Zeile 13 öffnen');
  assert.strictEqual(u.vscodeTitel(null), 'In VS Code öffnen');
});
