// R00210 B1044: das Zeichnen der Seite „Alle Änderungen“ als reine Funktion (HTML-Text) — ohne Browser. Fremder Text nur über
// `esc`/`sichtbarHtml`, Kennungen eindeutig über Abschnitte, Folge-Dateien ohne Statuswort, Wortlaute aus R00210 FA 4–7.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const g = require('../../web/gesamt.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BOESE = '<img src=x onerror=window.pwn=1> "x"';
const hash = c => c.repeat(40);
const v = c => `kd:${hash(c)}`;
const ctx = { esc, adresse: verweis => `#/aufgaben/aufgabe/2/review?commit=${encodeURIComponent(verweis)}`, titelVon: () => null };
const commit = (c, titel) => ({ verweis: v(c), anwendung: 'kd', hash: hash(c), titel, autor: 'sh', datum: '2026-11-20T10:00:00+01:00', plus: 1, minus: 1, dateien: 1 });
const schritt = (c, zusatz = {}) => ({ commit: v(c), alt: 'a.txt', neu: 'a.txt', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-x\n+y\n', ...zusatz });
const folgeA = { pfad: 'a.txt', plus: 2, minus: 2, binaer: false, schritte: [schritt('a'), schritt('b')] };
const nettoK = { neu: 'k.txt', alt: null, status: 'A', plus: 3, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -0,0 +1,3 @@\n+1\n+2\n+3\n' };
const antwort2 = { anwendung: 'kd', commits: [commit('a', 'K1'), commit('b', BOESE)], dateien: [folgeA, nettoK], hinweise: [{ art: 'fremd_dazwischen', commits: 1, dateien: 1 }] };
const offen = n => Array.from({ length: n }, () => ({ offen: true, laden: null, fehler: null }));
const da = (antwort, kuerzel = antwort.anwendung) => ({ status: 'da', kuerzel, antwort, staende: offen(antwort.dateien.length) });
const ohneTags = html => html.replace(/<[^>]*>/g, '');
const ids = html => [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);

test('Abschnitt #2: „Anwendung kd“ mit „2 Commits · 2 Dateien“; Folge-Datei mit „Folge · 2 Commits“ und +2 −2, ohne Statuswort im Kopf', () => {
  const html = g.abschnittHtml(da(antwort2), 0, ctx);
  assert.match(ohneTags(html), /Anwendung kd 2 Commits · 2 Dateien/);
  const kopf = /<button[^>]*id="rv-dk0-0"[^>]*>(.*?)<\/button>/.exec(html)[1];
  assert.match(ohneTags(kopf), /^a\.txtFolge · 2 Commits\+2 −2$/);
  assert.doesNotMatch(kopf, /geändert|neu|class="st st-mod"/);
  assert.match(html, /aria-label="a\.txt, Folge · 2 Commits, \+2 −2, aufgeklappt"/);
});

test('Folge-Datei aufgeklappt: Satz zur Folge, je Schritt ein Kopf als Verweis mit Name nach FA 13, darunter der Code des Schritts', () => {
  const html = g.abschnittHtml(da(antwort2), 0, ctx);
  assert.match(html, /Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert\./);
  assert.match(html, new RegExp(`<a class="fs-l" href="#/aufgaben/aufgabe/2/review\\?commit=kd%3A${hash('a')}" data-act="review-commit" data-arg="${v('a')}" aria-label="Commit kd:aaaaaaa, K1, geändert, \\+1 −1">`));
  assert.strictEqual((html.match(/class="df-sc"/g) || []).length, 3, 'zwei Schritte und k.txt mit Code');
  assert.match(html, /id="rv-d0-0-0"/);
  assert.match(html, /id="rv-d0-0-1"/);
});

test('Kennungen eindeutig über zwei Abschnitte (rv-d<a>-<i>, data-arg „<a>:<i>“)', () => {
  const html = g.gesamtInselHtml(11, [da(antwort2), da({ ...antwort2, anwendung: 'wb' })], ctx);
  const alle = ids(html);
  assert.deepStrictEqual(alle.filter((x, k) => alle.indexOf(x) !== k), []);
  assert.match(html, /data-arg="1:1"/);
  assert.match(html, /data-insel="11:alle"/);
});

test('fremder Text: Titel mit <img …> nur maskiert; der Verweis eines unlesbaren Eintrags als Marke ⟨U+202E⟩, nie das Zeichen selbst', () => {
  const u = { art: 'ausgelassen', verweis: 'kd:ab\u202Ecd<b>', zustand: 'unlesbar' };
  const html = g.gesamtInselHtml(12, [da({ ...antwort2, hinweise: [...antwort2.hinweise, u] })], ctx);
  assert.doesNotMatch(html, /<img|cd<b>|\u202E/);
  assert.match(html, /cd&lt;b&gt;/);
  assert.match(html, /⟨U\+202E⟩/);
  assert.strictEqual((html.match(/Eintrag nicht lesbar/g) || []).length, 1);
});

test('Commit-Liste: einbezogene als Verweis, verwaist und Merge als sichtbares „nicht einbezogen: …“; Hinweise mit „einzeln ansehen“', () => {
  const antwort = { ...antwort2, hinweise: [{ art: 'merge_ausgelassen', verweis: v('c') }, { art: 'verwaist', verweis: v('d') }, { art: 'ausgelassen', verweis: v('f'), zustand: 'fehlt' }] };
  const html = g.abschnittHtml(da(antwort), 0, ctx);
  const text = ohneTags(html);
  assert.match(text, /nicht einbezogen: Merge/);
  assert.match(text, /nicht einbezogen: verwaist/);
  assert.match(text, /kd:ccccccc ist ein Merge und in diesem Gesamtbild ausgelassen\.einzeln ansehen/);
  assert.match(text, /kd:ddddddd ist verwaist: Kein Zweig führt zu ihm, darum zählt er hier nicht mit\.einzeln ansehen/);
  assert.match(text, /kd:fffffff nicht mehr im Repository/);
  assert.doesNotMatch(html, /class="vh"[^>]*>(nicht einbezogen|lädt|wartet)/);
});

test('Keine Änderungen (commits: []): „Keine Änderungen zu zeigen.“ und der zweite Satz nach den Hinweisen', () => {
  const html = g.abschnittHtml(da({ anwendung: 'kd', commits: [], dateien: [], hinweise: [{ art: 'verwaist', verweis: v('n') }] }), 0, ctx);
  assert.match(ohneTags(html), /Keine Änderungen zu zeigen\. Kein Commit dieser Anwendung ist in das Gesamtbild einbezogen\. Die Commits lassen sich einzeln ansehen\./);
});

test('ganz_als_folge: Grund über den Dateien, Satz an der Datei ohne „Fremde Commits haben …“', () => {
  const html = g.abschnittHtml(da({ ...antwort2, dateien: [folgeA], hinweise: [{ art: 'ganz_als_folge', grund: 'nicht_linear' }] }), 0, ctx);
  assert.match(ohneTags(html), /Die Commits der Aufgabe folgen nicht auf einem Zweig aufeinander\. Darum steht jede Datei/);
  assert.match(html, /Diese Datei steht als Folge der Schritte der Aufgabe\./);
});

test('zu_gross_zum_anzeigen an der Folge-Datei: nur Zahlen, Schrittköpfe bleiben Verweise, kein Knopf, kein Code', () => {
  const groß = { ...folgeA, schritte: folgeA.schritte.map(s => ({ ...s, gross: true, patch: undefined })) };
  const html = g.abschnittHtml(da({ ...antwort2, dateien: [groß], hinweise: [{ art: 'zu_gross_zum_anzeigen', datei: 'a.txt' }] }), 0, ctx);
  assert.match(html, /Zu groß zum Anzeigen\. Es stehen nur die Zahlen: \+2 −2\. Jeder Schritt lässt sich über seinen Kopf einzeln ansehen\./);
  assert.strictEqual((html.match(/class="fs-l" href=/g) || []).length, 2);
  assert.doesNotMatch(html, /<button[^>]*data-act="review-nachladen"/);
});

test('Abschnitt lädt / wartet: Zustandswort und Satz sichtbar; Fehler: Antwortbudget amber, Zeitgrenze und Netz rot, alle mit role=alert', () => {
  const laedt = g.abschnittHtml({ status: 'laedt', kuerzel: 'wb' }, 1, ctx), wartet = g.abschnittHtml({ status: 'wartet', kuerzel: 'xx', wartetAuf: 'wb' }, 2, ctx);
  assert.match(ohneTags(laedt), /Anwendung wb lädt …Lädt die Änderungen der Anwendung wb …/);
  assert.match(ohneTags(wartet), /Anwendung xx wartetWartet, bis die Anwendung wb geladen ist …/);
  assert.doesNotMatch(laedt + wartet, /class="vh"/, 'Zustandswörter sind sichtbarer Text, nie .vh');
  const fehler = f => g.abschnittHtml({ status: 'fehler', kuerzel: 'wb', fehler: f }, 1, ctx);
  const budget = fehler({ art: 'antwortbudget', status: 503, fehler: 'Antwortbudget erschöpft' });
  assert.match(budget, /class="df-hin warn rv-abs-f" role="alert"/);
  assert.match(ohneTags(budget), /Server ausgelastet \(Antwortbudget\)\. Die Änderungen der Anwendung wb wurden nicht gelesen\. Es wird nicht von selbst wiederholt\./);
  const zeit = fehler({ art: 'zeitgrenze', status: 503, fehler: 'Zeitgrenze überschritten' });
  assert.match(zeit, /class="df-hin fehl rv-abs-f" role="alert"/);
  assert.match(ohneTags(zeit), /Die Änderungen der Anwendung wb ließen sich nicht lesen: Zeitgrenze überschritten \(503\)\./);
  assert.match(ohneTags(fehler({ art: 'anderer', status: 0, fehler: 'x' })), /ließen sich nicht lesen: keine Verbindung zum Programm\.Erneut/);
  assert.match(budget, /data-act="review-abschnitt-erneut" data-arg="1"/);
});

test('Umschalter: zwei Verweise, der gezeigte mit aria-current; ohne Ziel „Ein Commit“ ohne href, ohne role, ohne tabindex', () => {
  const mit = g.umschalterHtml({ ansicht: 'alle', alleHref: '#/a/review', commitHref: '#/a/review?commit=kd%3A1', commitZiel: 'kd:1' }, esc);
  assert.match(mit, /<a href="#\/a\/review" id="rv-u-alle" data-act="review-alle-zeigen" aria-current="page">Alle Änderungen<\/a>/);
  assert.match(mit, /<a href="#\/a\/review\?commit=kd%3A1" id="rv-u-commit" data-act="review-umschalten" data-arg="kd:1">Ein Commit<\/a>/);
  const ohne = g.umschalterHtml({ ansicht: 'alle', alleHref: '#/a/review', commitHref: null }, esc);
  assert.match(ohne, /<span class="umsch-aus" id="rv-u-commit">Ein Commit<\/span>/);
  assert.doesNotMatch(ohne, /role=|tabindex|href="[^"]*commit/);
});

test('Summe der Leiste: über geladene Abschnitte, „· Anwendung wb lädt noch …“ solange einer lädt', () => {
  const html = g.summeHtml([da(antwort2), { status: 'laedt', kuerzel: 'wb' }, { status: 'wartet', kuerzel: 'xx' }], esc);
  assert.strictEqual(ohneTags(html), '2 Dateien · +5 −2 · Anwendung wb lädt noch …');
});

test('seitenweite Einträge: „Anwendung unbekannt“ mit dem Hinweis der Liste, das Kürzel aus dem Verweis', () => {
  const html = g.seitenHinweiseHtml([{ verweis: 'xy:' + hash('a'), zustand: 'anwendung_unbekannt' }], esc);
  assert.match(ohneTags(html), /^xy:aaaaaaa Anwendung unbekannt Anwendung „xy“ ist unter Einrichten nicht eingetragen\.$/);
});
