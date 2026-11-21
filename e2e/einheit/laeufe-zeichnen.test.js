// R00219 B1128: das Zeichnen der Ansicht „Läufe“ als reine Funktion (HTML-Text) — ohne Browser. Wortlaute 1–12 (PO Z. 471–474, 480),
// fremder Text nur über `esc` und ohne Bidi-Steuerzeichen, keine Zeile ist ein Ziel, die Tabelle trägt ihre Rollen ausdrücklich.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { laeufeAnsichtHtml, hinweisText, fehlerText } = require('../../web/laeufe.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const t = (kennung, column, zustand = 'vorhanden') => ({ kennung, at: kennung.split('@')[1].replace('T', ' '), role: kennung.split('@')[0], column, bytes: 2048, zustand });
const k = (kennung, column, amount) => ({ at: kennung.split('@')[1].replace('T', ' '), role: kennung.split('@')[0], column, amount, currency: 'USD', kennung });
const L1 = 'planer@2026-11-20T09:00+01:00', L2 = 'entwickler@2026-11-20T10:00+01:00', L3 = 'code-reviewer@2026-11-20T11:00+01:00';
const L4 = 'entwicklertester@2026-11-20T12:00+01:00', L5 = 'architekt@2026-11-20T08:00+01:00';
const TRANSKRIPTE = [t(L1, 'Detailplanung'), t(L2, 'Entwicklung'), t(L3, 'Reviews', 'fehlt'), t(L5, 'Architektur', 'abweichend'), { kennung: null, at: null, role: null, column: null, bytes: null, zustand: 'unlesbar' }];
const KOSTEN = [k(L1, 'Detailplanung', 0.42), k(L2, 'Reviews', 1.8), k(L4, 'Entwicklertest', 0.3), k(L5, 'Architektur', 0.55)];
const antwort = (zusatz = {}) => ({ erfassen: true, boards_aus: [], transkripte: TRANSKRIPTE, ...zusatz });
const liste = (zusatz = {}) => ({ laedt: false, ergebnis: { art: 'liste', antwort: antwort(zusatz), stand: '09:14:07' } });
const fehler = (status, text, laedt = false) => ({ laedt, ergebnis: { art: 'fehler', fehler: { status, fehler: text } } });
const zeilen = html => html.split('</tbody>')[0].split('<tr role="row"').slice(2);
const ohneTags = html => html.replace(/<span class="vh">[^<]*<\/span>/g, '').replace(/<[^>]+>/g, '');
const status = html => /<span class="lf-stand" id="laeufe-status" role="status">([^<]*)<\/span>/.exec(html)[1];

test('#1: sechs Zeilen L4, L3, L2, L1, L5, L6 mit Zeitpunkt, Rolle, Spalte, Betrag und Zustandswort', () => {
  const z = zeilen(laeufeAnsichtHtml(liste(), KOSTEN, esc)).map(ohneTags);
  assert.strictEqual(z.length, 6);
  assert.match(z[0], /^>20\.11\.2026 12:00entwicklertesterEntwicklertest0,30\s\$kein Transkript abgelegt$/);
  assert.match(z[1], /^>20\.11\.2026 11:00code-reviewerReviews—liegt nicht auf diesem Rechner$/);
  assert.match(z[2], /^>20\.11\.2026 10:00entwicklerEntwicklungKosten gebucht in Reviews1,80\s\$$/);
  assert.match(z[3], /^>20\.11\.2026 09:00planerDetailplanung0,42\s\$$/);
  assert.match(z[4], /^>20\.11\.2026 08:00architektArchitektur0,55\s\$Datei weicht vom abgelegten Stand ab$/);
  assert.match(z[5], /^ class="ohnek">————Eintrag nicht lesbar$/);
});

test('vorgelesen: „Transkript vorhanden“ nur als Lesetext, „—“ ist aria-hidden mit dem Wort daneben', () => {
  const z = zeilen(laeufeAnsichtHtml(liste(), KOSTEN, esc));
  for (const i of [2, 3]) assert.match(z[i], /<span class="vh">Transkript vorhanden<\/span>/);
  assert.match(z[1], /<span class="lf-kein" aria-hidden="true">—<\/span><span class="vh">kein Betrag<\/span>/);
  for (const wort of ['kein Zeitpunkt', 'keine Rolle', 'keine Spalte', 'kein Betrag']) assert.match(z[5], new RegExp(`aria-hidden="true">—</span><span class="vh">${wort}</span>`), wort);
  assert.doesNotMatch(z[0], /Transkript vorhanden/);
});

test('Marken: fehlt, abweichend, unlesbar tragen je ein eigenes Symbol; die beiden Wörter ohne Transkript tragen keines', () => {
  const html = laeufeAnsichtHtml(liste(), KOSTEN, esc);
  const pfade = ['fehlt', 'abweichend', 'unlesbar'].map(z => new RegExp(`data-zustand="${z}"><svg[^>]*>(.*?)</svg>`).exec(html)[1]);
  assert.strictEqual(new Set(pfade).size, 3);
  assert.doesNotMatch(zeilen(html)[0], /<svg/);
  assert.doesNotMatch(zeilen(laeufeAnsichtHtml(fehler(503, 'x'), KOSTEN, esc))[0], /<svg/);
});

test('keine Zeile ist ein Ziel: kein a[href], kein data-act in der Tabelle', () => {
  const tabelle = /<table[\s\S]*<\/table>/.exec(laeufeAnsichtHtml(liste(), KOSTEN, esc))[0];
  assert.doesNotMatch(tabelle, /<a\b|data-act|tabindex/);
});

test('Tabelle: Rollen ausdrücklich (table, rowgroup, row, columnheader, rowheader, cell), Name „Läufe dieser Aufgabe, neueste zuerst“', () => {
  const html = laeufeAnsichtHtml(liste(), KOSTEN, esc);
  assert.match(html, /<table class="lf-tab" role="table" aria-label="Läufe dieser Aufgabe, neueste zuerst">/);
  assert.deepStrictEqual([...html.matchAll(/role="columnheader"[^>]*>([^<]+)</g)].map(m => m[1]), ['Zeitpunkt', 'Rolle', 'Spalte', 'Betrag', 'Transkript']);
  assert.strictEqual([...html.matchAll(/role="rowheader"/g)].length, 6);
  assert.strictEqual([...html.matchAll(/role="cell"/g)].length, 24);
});

test('Statusbereich: „6 Läufe · Stand …“, Einzahl „1 Lauf“, Tausenderpunkt; Laden „Liest die Läufe …“; Fehler', () => {
  assert.strictEqual(status(laeufeAnsichtHtml(liste(), KOSTEN, esc)), '6 Läufe · Stand 09:14:07');
  assert.strictEqual(status(laeufeAnsichtHtml(liste({ transkripte: [t(L1, 'X')] }), [], esc)), '1 Lauf · Stand 09:14:07');
  const tausend = Array.from({ length: 1000 }, (_, i) => t(`r${i}@2026-11-20T09:00+01:00`, 'X'));
  assert.strictEqual(status(laeufeAnsichtHtml(liste({ transkripte: tausend }), [], esc)), '1.000 Läufe · Stand 09:14:07');
  assert.strictEqual(status(laeufeAnsichtHtml({ laedt: true, ergebnis: null }, KOSTEN, esc)), 'Liest die Läufe …');
  assert.strictEqual(status(laeufeAnsichtHtml({ ...liste(), laedt: true }, KOSTEN, esc)), 'Liest die Läufe …');
  assert.strictEqual(status(laeufeAnsichtHtml(fehler(503, 'x'), KOSTEN, esc)), 'Die Läufe ließen sich nicht lesen.');
});

test('erstes Öffnen: keine Zeile, keine Meldung, „Neu lesen“ gesperrt ohne Auslöser', () => {
  const html = laeufeAnsichtHtml({ laedt: true, ergebnis: null }, KOSTEN, esc);
  assert.doesNotMatch(html, /<table|cl-meld|cl-leer/);
  assert.match(html, /<button type="button" class="cl-textknopf" id="laeufe-neu" aria-disabled="true">/);
});

test('erneutes Lesen: die alten Zeilen bleiben, „Neu lesen“ gesperrt; danach frei mit data-act', () => {
  const html = laeufeAnsichtHtml({ ...liste(), laedt: true }, KOSTEN, esc);
  assert.strictEqual(zeilen(html).length, 6);
  assert.match(html, /id="laeufe-neu" aria-disabled="true"/);
  assert.match(laeufeAnsichtHtml(liste(), KOSTEN, esc), /id="laeufe-neu" data-act="laeufe-lesen"/);
});

test('leer: Antwort ohne Lauf und ohne Kosteneintrag ergibt den Satz statt einer Tabelle und „0 Läufe“', () => {
  const html = laeufeAnsichtHtml(liste({ transkripte: [] }), [], esc);
  assert.doesNotMatch(html, /<table/);
  assert.match(html, /<div class="cl-leer">An dieser Aufgabe stehen keine Läufe mehr\.<\/div>/);
  assert.strictEqual(status(html), '0 Läufe · Stand 09:14:07');
});

test('Fehler 503: Meldung mit „Erneut versuchen“ ohne Live-Rolle, die vier Kostenzeilen mit Betrag und „Transkript nicht gelesen“', () => {
  const html = laeufeAnsichtHtml(fehler(503, 'Dienst nicht verfügbar'), KOSTEN, esc);
  assert.match(html, /<div class="cl-meld lf-meld"><svg[^>]*>.*?<\/svg><p class="cl-meldtext">Die Läufe ließen sich nicht lesen: Dienst nicht verfügbar \(503\)\.<\/p><button type="button" class="cl-knopf" id="laeufe-erneut" data-act="laeufe-lesen">Erneut versuchen<\/button><\/div>/);
  const z = zeilen(html).map(ohneTags);
  assert.deepStrictEqual(z.map(s => /\d,\d\d\s\$/.exec(s)[0].replace(/\s/, ' ')), ['0,30 $', '1,80 $', '0,42 $', '0,55 $']);
  for (const s of z) assert.match(s, /Transkript nicht gelesen$/);
  assert.doesNotMatch(html, /kein Transkript abgelegt|aria-live|role="alert"/);
  assert.strictEqual([...html.matchAll(/role="status"/g)].length, 1);
});

test('Fehler liest erneut: Meldung und Knopf bleiben, der Knopf gesperrt ohne Auslöser', () => {
  const html = laeufeAnsichtHtml(fehler(503, 'x', true), KOSTEN, esc);
  assert.match(html, /<button type="button" class="cl-knopf" id="laeufe-erneut" aria-disabled="true">Erneut versuchen<\/button>/);
  assert.strictEqual(status(html), 'Liest die Läufe …');
});

test('fehlerText: ohne Verbindung eigener Satz; sonst Text der Antwort und Status, ohne Bidi-Zeichen', () => {
  assert.strictEqual(fehlerText({ status: 0, fehler: 'egal' }), 'Die Läufe ließen sich nicht lesen: keine Verbindung zum Programm.');
  assert.strictEqual(fehlerText({ status: 503, fehler: 'Platte ‮weg' }), 'Die Läufe ließen sich nicht lesen: Platte weg (503).');
});

test('Hinweis bei erfassen: false — ein, zwei, drei Boards in Reihenfolge der Antwort, ohne Komma vor „und“, nichts gekürzt', () => {
  assert.strictEqual(hinweisText(['zweit']), 'Auf „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.');
  assert.strictEqual(hinweisText(['zweit', 'dritt']), 'Auf „zweit“ und „dritt“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.');
  assert.strictEqual(hinweisText(['zweit', 'dritt', 'viert']), 'Auf „zweit“, „dritt“ und „viert“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.');
  assert.strictEqual(hinweisText(['viert', 'zweit']), 'Auf „viert“ und „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.');
  const sechs = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.strictEqual(hinweisText(sechs), 'Auf „a“, „b“, „c“, „d“, „e“ und „f“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript.');
});

test('Hinweis steht als role="note" über der Liste nur bei erfassen: false', () => {
  const html = laeufeAnsichtHtml(liste({ erfassen: false, boards_aus: ['zweit'] }), KOSTEN, esc);
  assert.match(html, /<p class="lf-hw" role="note">Auf „zweit“ werden keine Transkripte erfasst; neue Läufe erscheinen ohne Transkript\.<\/p><div class="lf-rahmen">/);
  assert.doesNotMatch(laeufeAnsichtHtml(liste(), KOSTEN, esc), /role="note"/);
});

test('fremder Text: Rolle, Spalte und Board maskiert, Bidi-Steuerzeichen entfernt', () => {
  const fremd = '<img src=x onerror=window.pwn=1> ‮"x"';
  const html = laeufeAnsichtHtml(liste({ erfassen: false, boards_aus: [`b‮o<b>`], transkripte: [t(L2, 'Entwicklung')] }), [k(L2, fremd, 1), { ...k('x@2026-11-20T09:00+01:00', 'A', 1), role: `<i>‮r` }], esc);
  assert.doesNotMatch(html, /<img|<b>|<i>|‮/);
  assert.match(html, /Kosten gebucht in &lt;img src=x onerror=window\.pwn=1&gt; &quot;x&quot;/);
  assert.match(html, /„bo&lt;b&gt;“/);
  assert.match(html, /&lt;i&gt;r/);
});
