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
const schritt = (c, zusatz = {}) => ({ commit: v(c), alt: 'a.dat', neu: 'a.dat', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-x\n+y\n', ...zusatz });
const folgeA = { pfad: 'a.dat', plus: 2, minus: 2, binaer: false, schritte: [schritt('a'), schritt('b')] };
const nettoK = { neu: 'k.dat', alt: null, status: 'A', plus: 3, minus: 0, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -0,0 +1,3 @@\n+1\n+2\n+3\n' };
const antwort2 = { anwendung: 'kd', commits: [commit('a', 'K1'), commit('b', BOESE)], dateien: [folgeA, nettoK], hinweise: [{ art: 'fremd_dazwischen', commits: 1, dateien: 1 }] };
const offen = n => Array.from({ length: n }, () => ({ offen: true, laden: null, fehler: null }));
const da = (antwort, kuerzel = antwort.anwendung) => ({ status: 'da', kuerzel, antwort, staende: offen(antwort.dateien.length), gruppen: { code: true, test: true, doku: false } });
const ohneTags = html => html.replace(/<[^>]*>/g, '');
const ids = html => [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);

test('Abschnitt #2: „Anwendung kd“ mit „2 Commits · 2 Dateien“; Folge-Datei mit „Folge · 2 Commits“ und +2 −2, ohne Statuswort im Kopf', () => {
  const html = g.abschnittHtml(da(antwort2), 0, ctx);
  assert.match(ohneTags(html), /Anwendung kd 2 Commits · 2 Dateien/);
  const kopf = /<button[^>]*id="rv-dk0-0"[^>]*>(.*?)<\/button>/.exec(html)[1];
  assert.match(ohneTags(kopf), /^a\.datFolge · 2 Commits\+2 −2$/);
  assert.doesNotMatch(kopf, /geändert|neu|class="st st-mod"/);
  assert.match(html, /aria-label="a\.dat, Folge · 2 Commits, \+2 −2, aufgeklappt"/);
});

test('Folge-Datei aufgeklappt: Satz zur Folge, je Schritt ein Kopf als Verweis mit Name nach FA 13, darunter der Code des Schritts', () => {
  const html = g.abschnittHtml(da(antwort2), 0, ctx);
  assert.match(html, /Fremde Commits haben diese Datei zwischen den Schritten der Aufgabe geändert\./);
  assert.match(html, new RegExp(`<a class="fs-l" href="#/aufgaben/aufgabe/2/review\\?commit=kd%3A${hash('a')}" data-act="review-commit" data-arg="${v('a')}" aria-label="Commit kd:aaaaaaa, K1, geändert, \\+1 −1">`));
  assert.strictEqual((html.match(/class="df-sc"/g) || []).length, 3, 'zwei Schritte und k.dat mit Code');
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
  const html = g.abschnittHtml(da({ ...antwort2, dateien: [groß], hinweise: [{ art: 'zu_gross_zum_anzeigen', datei: 'a.dat' }] }), 0, ctx);
  assert.match(html, /Zu groß zum Anzeigen\. Es stehen nur die Zahlen: \+2 −2\. Jeder Schritt lässt sich über seinen Kopf einzeln ansehen\./);
  assert.strictEqual((html.match(/class="fs-l" href=/g) || []).length, 2);
  assert.doesNotMatch(html, /<button[^>]*data-act="review-nachladen"/);
});

test('Abschnitt lädt / wartet: Zustandswort und Satz sichtbar; Fehler: Antwortbudget amber, Zeitgrenze und Netz rot, alle ohne Live-Rolle (R00230)', () => {
  const laedt = g.abschnittHtml({ status: 'laedt', kuerzel: 'wb' }, 1, ctx), wartet = g.abschnittHtml({ status: 'wartet', kuerzel: 'xx', wartetAuf: 'wb' }, 2, ctx);
  assert.match(ohneTags(laedt), /Anwendung wb lädt …Lädt die Änderungen der Anwendung wb …/);
  assert.match(ohneTags(wartet), /Anwendung xx wartetWartet, bis die Anwendung wb geladen ist …/);
  assert.doesNotMatch(laedt + wartet, /class="vh"/, 'Zustandswörter sind sichtbarer Text, nie .vh');
  const fehler = f => g.abschnittHtml({ status: 'fehler', kuerzel: 'wb', fehler: f }, 1, ctx);
  const budget = fehler({ art: 'antwortbudget', status: 503, fehler: 'Antwortbudget erschöpft' });
  // umgestellt mit R00230 AK 8: die Meldung trägt keine Live-Rolle mehr, angesagt wird nur in #rv-ansage (ADR-0018 N4)
  assert.match(budget, /class="df-hin warn rv-abs-f">/);
  assert.match(ohneTags(budget), /Server ausgelastet \(Antwortbudget\)\. Die Änderungen der Anwendung wb wurden nicht gelesen\. Es wird nicht von selbst wiederholt\./);
  const zeit = fehler({ art: 'zeitgrenze', status: 503, fehler: 'Zeitgrenze überschritten' });
  assert.match(zeit, /class="df-hin fehl rv-abs-f">/);
  assert.match(ohneTags(zeit), /Die Änderungen der Anwendung wb ließen sich nicht lesen: Zeitgrenze überschritten \(503\)\./);
  assert.match(ohneTags(fehler({ art: 'anderer', status: 0, fehler: 'x' })), /ließen sich nicht lesen: keine Verbindung zum Programm\.Erneut/);
  assert.match(budget, /data-act="review-abschnitt-erneut" data-arg="1"/);
});

test('R00230 AK 2: jede Fehlerform eines Abschnitts (Antwortbudget, 404 repository_fehlt, übrige) ohne role und aria-live', () => {
  const formen = {
    antwortbudget: { art: 'antwortbudget', status: 503, fehler: 'Antwortbudget erschöpft' },
    repositoryFehlt: { art: 'kein_diff', status: 404, fehler: 'x', daten: { zustand: 'repository_fehlt', grund: 'Ordner fehlt: /x' } },
    zeitgrenze: { art: 'zeitgrenze', status: 503, fehler: 'Git antwortete nicht' },
    anderer: { art: 'anderer', status: 500, fehler: 'kaputt' },
    ohneVerbindung: { art: 'anderer', status: 0, fehler: 'x' },
  };
  for (const [name, f] of Object.entries(formen)) {
    const html = g.abschnittHtml({ status: 'fehler', kuerzel: 'wb', fehler: f }, 1, ctx);
    const meldung = /<div class="[^"]*rv-abs-f"[^>]*>/.exec(html);
    assert.ok(meldung, `${name}: .rv-abs-f gezeichnet`);
    assert.doesNotMatch(meldung[0], / role=| aria-live=/, name);
    assert.doesNotMatch(html, / role="(alert|status)"| aria-live=/, `${name}: auch sonst keine Live-Region im Abschnitt`);
  }
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

/* ── Nacharbeit 1 (R00210 AK 12–14) ── */

test('AK 12: Standardanwendung (leeres Kürzel) in allen Sätzen — lädt, wartet, Fehler, Leiste; nie „Anwendung  “', () => {
  const texte = [
    g.abschnittHtml({ status: 'laedt', kuerzel: '' }, 1, ctx),
    g.abschnittHtml({ status: 'wartet', kuerzel: 'xx', wartetAuf: '' }, 2, ctx),
    g.abschnittHtml({ status: 'fehler', kuerzel: '', fehler: { art: 'zeitgrenze', status: 503, fehler: 'Git antwortete nicht' } }, 1, ctx),
    g.abschnittHtml({ status: 'fehler', kuerzel: '', fehler: { art: 'antwortbudget', status: 503, fehler: 'Antwortbudget' } }, 1, ctx),
    g.summeHtml([da(antwort2), { status: 'laedt', kuerzel: '' }], esc),
  ].map(ohneTags);
  assert.match(texte[0], /Lädt die Änderungen der Standardanwendung …/);
  assert.match(texte[1], /Wartet, bis die Standardanwendung geladen ist …/);
  assert.match(texte[2], /Die Änderungen der Standardanwendung ließen sich nicht lesen: Git antwortete nicht \(503\)\./);
  assert.match(texte[3], /Die Änderungen der Standardanwendung wurden nicht gelesen\./);
  assert.match(texte[4], /· Standardanwendung lädt noch …$/);
  for (const t of texte) assert.doesNotMatch(t, /Anwendung {2}|Anwendung  ?…|Anwendung $/);
  const datei = require('../../web/diff.js').dateiHtml({ neu: 'k.dat', status: 'A', plus: 1, minus: 0, nachladen: true }, 0, { offen: true, laden: 'wartet', wartetAuf: '' }, [], esc);
  assert.match(ohneTags(datei), /Wartet, bis die Standardanwendung geladen ist …/);
});

test('AK 12: Ansage „ohne Standardanwendung: ließ sich nicht lesen“', () => {
  assert.strictEqual(g.ansageText(11, { dateien: 1, plus: 1, minus: 0 }, ['']), 'Alle Änderungen der Aufgabe #11: 1 Datei, 1 Zeile hinzugefügt, 0 entfernt, ohne Standardanwendung: ließ sich nicht lesen.');
});

test('AK 13: Netzabbruch ohne „(0)“ an Datei und Seite; mit Antwort bleibt „(503)“', () => {
  const d = require('../../web/diff.js');
  const datei = ohneTags(d.dateiHtml({ neu: 'k.dat', status: 'A', plus: 1, minus: 0, nachladen: true }, 0, { offen: true, laden: 'fehler', fehler: { art: 'anderer', status: 0, text: 'keine Verbindung zum Programm' } }, [], esc));
  assert.match(datei, /ließen sich nicht laden: keine Verbindung zum Programm\.Erneut/);
  assert.doesNotMatch(datei, /\(0\)/);
  const seite = ohneTags(d.diffFehlerHtml({ status: 0, fehler: 'Keine Verbindung' }, null, esc));
  assert.match(seite, /Der Diff ließ sich nicht lesen: keine Verbindung zum Programm\./);
  assert.doesNotMatch(seite, /\(0\)/);
  assert.match(ohneTags(d.diffFehlerHtml({ status: 500, fehler: 'kaputt' }, null, esc)), /kaputt \(500\)\./);
});

test('AK 14: wartetAuf wird nur beim Einsetzen maskiert — „a&b“ steht als a&amp;b, nie doppelt, an Abschnitt und Datei', () => {
  const ab = g.abschnittHtml({ status: 'wartet', kuerzel: 'xx', wartetAuf: 'a&b' }, 2, ctx);
  const datei = require('../../web/diff.js').dateiHtml({ neu: 'k.dat', status: 'A', plus: 1, minus: 0, nachladen: true }, 0, { offen: true, laden: 'wartet', wartetAuf: 'a&b<i>' }, [], esc);
  assert.match(ab, /Anwendung a&amp;b geladen/);
  assert.match(datei, /Anwendung a&amp;b&lt;i&gt; geladen/);
  assert.doesNotMatch(ab + datei, /&amp;amp;|<i>/);
});

test('AK 14: fremder Text an den Rückfall-Senken — Grund, Status von Datei und Schritt, Dateimodus nur maskiert', () => {
  const schrittBoese = { ...schritt('a'), status: BOESE, modus_alt: BOESE, modus_neu: '100755' };
  const antwort = { ...antwort2, dateien: [{ ...folgeA, schritte: [schrittBoese] }, { ...nettoK, status: BOESE, modus_alt: BOESE, modus_neu: '100755' }], hinweise: [{ art: 'ganz_als_folge', grund: BOESE }] };
  const html = g.abschnittHtml(da(antwort), 0, ctx);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /&lt;img src=x onerror=window\.pwn=1&gt;/);
  const b2 = require('../../web/diff.js');
  const netto = b2.dateiHtml({ ...nettoK, status: BOESE, modus_alt: BOESE, modus_neu: '100755' }, 0, { offen: true, laden: null }, [], esc) + b2.dateilisteHtml([{ ...nettoK, status: BOESE }], esc);
  assert.doesNotMatch(netto, /<img/);
});

/* ── R00224 B1170: Abschnitt bei 404 repository_fehlt — Satz und Hinweiszeile untereinander in einem Block ── */

test('R00224: Abschnittsfehler 404 repository_fehlt — Satz, maskierte Hinweiszeile in einem Block, ordner-offen aus commits.js, wie die übrigen ohne Live-Rolle, ohne (404)', () => {
  const { zustandsSymbol } = require('../../web/commits.js');
  const fehler = (f, kuerzel = 'wb') => g.abschnittHtml({ status: 'fehler', kuerzel, fehler: f }, 1, ctx);
  const html = fehler({ art: 'kein_diff', status: 404, fehler: 'Repository nicht erreichbar', daten: { zustand: 'repository_fehlt', grund: 'Ordner fehlt: /x/<img src=x>‮gpj.exe' } });
  const zeit = fehler({ art: 'zeitgrenze', status: 503, fehler: 'Git antwortete nicht' });
  // umgestellt mit R00230 AK 8: „dieselbe Live-Rolle wie die übrigen“ heißt jetzt keine (ADR-0018 N4)
  const rolle = h => /class="df-hin[^"]*rv-abs-f"([^>]*)>/.exec(h)[1];
  assert.strictEqual(rolle(html), rolle(zeit));
  assert.strictEqual(rolle(zeit), '');
  assert.ok(html.includes(`<div class="df-hin fehl rv-abs-f">${zustandsSymbol('ordner-offen')}<div class="df-zeilen"><p class="rv-satz">Das Repository der Anwendung wb ist nicht erreichbar.</p><p class="rv-hin">Ordner fehlt: /x/&lt;img src=x&gt;gpj.exe</p></div>`), html);
  assert.match(html, /data-act="review-abschnitt-erneut" data-arg="1"/);
  assert.doesNotMatch(ohneTags(html), /\(404\)|ließen sich nicht lesen/);
  const ohneGrund = fehler({ art: 'kein_diff', status: 404, fehler: 'x', daten: { zustand: 'repository_fehlt' } }, '');
  assert.ok(ohneGrund.includes('<div class="df-zeilen"><p class="rv-satz">Das Repository der Standardanwendung ist nicht erreichbar.</p></div>') && !ohneGrund.includes('rv-hin'));
});

test('R00224: jeder andere Abschnittsfehler wie R00210 FA 7 — auch 404 mit anderem oder ohne zustand', () => {
  const fehler = f => ohneTags(g.abschnittHtml({ status: 'fehler', kuerzel: 'wb', fehler: f }, 1, ctx));
  assert.match(fehler({ art: 'kein_diff', status: 404, fehler: 'kein Diff', daten: { zustand: 'fehlt' } }), /^Anwendung wbDie Änderungen der Anwendung wb ließen sich nicht lesen: kein Diff \(404\)\./);
  assert.match(fehler({ art: 'kein_diff', status: 404, fehler: 'kein Diff', daten: null }), /ließen sich nicht lesen: kein Diff \(404\)\./);
  assert.match(fehler({ art: 'anderer', status: 500, fehler: 'kaputt', daten: { zustand: 'repository_fehlt' } }), /ließen sich nicht lesen: kaputt \(500\)\./);
});
