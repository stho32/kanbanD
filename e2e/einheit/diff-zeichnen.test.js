// R00207 B1019: das Zeichnen der Review-Seite als reine Funktion (HTML-Text) — ohne Browser. Fremder Text geht nur über `esc`,
// Unsichtbares wird als Marke sichtbar, Knöpfe tragen `.btn`, Wortlaute aus R00207 FA 2–8.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BOESE = '<img src=x onerror=window.pwn=1> "x"';
const datei = (zusatz = {}) => ({ neu: 'src/a.dat', alt: 'src/a.dat', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-a\n+b\n', ...zusatz });
const offen = (zusatz = {}) => ({ offen: true, laden: null, ...zusatz });
const zeichne = (z = {}, stand = offen(), hinweise = []) => d.dateiHtml(datei(z), 0, stand, hinweise, esc);
const ohneTags = html => html.replace(/<[^>]*>/g, '');

test('fremder Text in Pfad, Zeile und Titel geht nur maskiert ins HTML — kein <img, kein offenes Attribut', () => {
  const html = zeichne({ neu: `dir/${BOESE}`, alt: `dir/${BOESE}`, patch: `@@ -1 +1 @@\n-a\n+${BOESE}\n` });
  assert.ok(!/<img/i.test(html), html.slice(0, 200));
  assert.ok(html.includes('&lt;img src=x onerror=window.pwn=1&gt; &quot;x&quot;'));
  const kopf = d.commitKopfHtml({ hash: 'a'.repeat(40), titel: BOESE, autor: BOESE, datum: '2026-03-01T10:00:00+01:00', plus: 1, minus: 0, dateien: 1 }, 'kd', null, esc);
  assert.ok(!/<img/i.test(kopf) && kopf.includes('&lt;img'));
  assert.ok(!/<img/i.test(d.dateilisteHtml([datei({ neu: BOESE })], esc)));
});

test('Bidi in Pfad und Zeile: Marke mit Auge, role="img", Name „sichtbar gemachtes Bidi-Steuerzeichen U+202E“, Text ⟨U+202E⟩ bleibt', () => {
  const html = zeichne({ neu: 'x‮yz', patch: '@@ -0,0 +1 @@\n+a‮b\u001Bc\td\r\n' });
  const marken = html.match(/<span class="mk-z mk-bidi" role="img" aria-label="sichtbar gemachtes Bidi-Steuerzeichen U\+202E"><svg[^>]*>.*?<\/svg>⟨U\+202E⟩<\/span>/g) || [];
  assert.strictEqual(marken.length, 2, 'Pfad und Zeile');
  assert.ok(html.includes('role="img" aria-label="sichtbar gemachtes Steuerzeichen U+001B">␛ U+001B</span>'));
  assert.ok(html.includes('>␍</span>'));
  assert.ok(html.includes('c\td'), 'Tab bleibt Tab');
  assert.ok(!html.includes('‮') && !html.includes('\u001B'), 'das rohe Zeichen steht nicht mehr da');
});

test('Datei mit patch offen: Kopf als Knopf mit aria-expanded, Tabelle „Änderungen in <Pfad>“, Lesetext, Zeilennummern und Zeichen aria-hidden', () => {
  const html = zeichne();
  assert.ok(/<h3 class="df-h"><button type="button" class="df-k" id="rv-dk0" data-act="review-klappe" data-arg="0" aria-expanded="true"/.test(html));
  assert.ok(html.includes('<div class="df-sc" tabindex="0" role="region" aria-label="Änderungen in src/a.dat" data-farbe="nein">'));
  assert.ok(html.includes('<table class="dz" aria-label="Änderungen in src/a.dat">'));
  assert.ok(html.includes('<td class="n" aria-hidden="true">1</td><td class="n" aria-hidden="true"></td><td class="m" aria-hidden="true">−</td><td class="c"><span class="vh">entfernt: </span>a</td>'));
  assert.ok(html.includes('<td class="m" aria-hidden="true">+</td><td class="c"><span class="vh">hinzugefügt: </span>b</td>'));
  assert.ok(html.includes('<span class="st st-mod">geändert</span>'));
});

test('Blöcke zu 500 Zeilen mit eigener Tabelle; 501 gezeichnete Zeilen sind zwei Blöcke', () => {
  const html = zeichne({ patch: '@@ -0,0 +1,500 @@\n' + '+x\n'.repeat(500) });
  assert.strictEqual((html.match(/<div class="dz-b"/g) || []).length, 2);
  assert.strictEqual((html.match(/<table class="dz"/g) || []).length, 2);
});

test('zugeklappte Datei mit patch: kein Code, Inhalt hidden, Marke „anzeigen“ im Kopf', () => {
  const html = zeichne({}, offen({ offen: false }));
  assert.ok(html.includes('aria-expanded="false"') && html.includes('<span class="mk">anzeigen</span>'));
  assert.ok(html.includes('id="rv-dc0" hidden></div>'));
  assert.ok(!html.includes('<table'));
});

test('Merkmale nie still: groß mit Zeilen und Knopf, nachladen, zu groß ohne Knopf, binär, Modus, nicht UTF-8, umbenannt', () => {
  const gross = ohneTags(zeichne({ gross: true, patch: undefined, plus: 3001, minus: 0 }));
  assert.ok(gross.includes('Der Patch ist groß (3.001 Zeilen) und wird erst auf Wunsch geladen.Änderungen anzeigen'));
  assert.ok(zeichne({ gross: true, patch: undefined }).includes('<button type="button" class="btn" data-act="review-nachladen" data-arg="0">Änderungen anzeigen</button>'));
  assert.ok(ohneTags(zeichne({ nachladen: true, patch: undefined })).includes('Diese Datei war nicht in der ersten Antwort, weil die Antwort zu groß wurde. Sie wird einzeln geladen.Nachladen'));
  const zuGross = zeichne({ gross: true, patch: undefined, plus: 1204, minus: 7 }, offen(), [{ art: 'zu_gross_zum_anzeigen', datei: 'src/a.dat' }]);
  assert.ok(ohneTags(zuGross).includes('Zu groß zum Anzeigen. Es stehen nur die Zahlen: +1.204 −7.'));
  assert.ok(!zuGross.includes('<button type="button" class="btn"'), 'kein Knopf');
  assert.ok(ohneTags(zeichne({ binaer: true, patch: undefined })).includes('Binärdatei — der Inhalt wird nicht angezeigt.'));
  assert.ok(ohneTags(zeichne({ patch: undefined, modus_alt: '100644', modus_neu: '100755', plus: 0, minus: 0 })).includes('Dateimodus 100644 → 100755; der Inhalt ist unverändert.'));
  assert.ok(ohneTags(zeichne({ nicht_utf8: true })).includes('Nicht als UTF-8 lesbar — nicht darstellbare Zeichen sind ersatzweise mit � wiedergegeben.'));
  assert.ok(ohneTags(zeichne({ status: 'R', alt: 'alt/b.dat', aehnlichkeit: 100, patch: undefined })).includes('umbenannt ← alt/b.dat · 100 %'));
  for (const [s, w] of [['A', 'neu'], ['M', 'geändert'], ['D', 'gelöscht'], ['R', 'umbenannt'], ['T', 'Typ geändert']]) assert.ok(zeichne({ status: s, alt: 'a', neu: 'a' }).includes(`>${w}</span>`), s);
  assert.ok(!/KB|MB/.test(ohneTags(gross + zuGross)));
});

test('Laden an der Datei: „Lädt …“ mit role=status und aria-busy, „Wartet …“ mit Sanduhr und ohne Knopf', () => {
  const laeuft = zeichne({ nachladen: true, patch: undefined }, offen({ laden: 'laeuft' }));
  assert.ok(laeuft.includes('aria-busy="true"') && laeuft.includes('<p class="df-hin df-laedt" role="status">Lädt die Änderungen …</p>'));
  const wartet = zeichne({ nachladen: true, patch: undefined }, offen({ laden: 'wartet' }));
  assert.ok(ohneTags(wartet).includes('Wartet, bis die andere Datei geladen ist …'));
  assert.ok(wartet.includes('role="status"') && !wartet.includes('class="btn"') && !wartet.includes('aria-busy'));
});

test('Fehler an der Datei: Zeitgrenze role=alert, Antwortbudget role=status, je mit „Erneut versuchen“', () => {
  const zeit = zeichne({ nachladen: true, patch: undefined }, offen({ laden: 'fehler', fehler: { art: 'zeitgrenze', status: 503 } }));
  assert.ok(zeit.includes('role="alert"') && ohneTags(zeit).includes('Zeitgrenze überschritten. Die Änderungen dieser Datei konnten nicht geladen werden (503).Erneut versuchen'));
  const budget = zeichne({ nachladen: true, patch: undefined }, offen({ laden: 'fehler', fehler: { art: 'antwortbudget', status: 503 } }));
  assert.ok(budget.includes('role="status"') && ohneTags(budget).includes('Server ausgelastet (Antwortbudget). Die Änderungen dieser Datei wurden nicht geladen. Es wird nicht von selbst wiederholt.Erneut versuchen'));
});

test('Blättern: breit Text im Namen, schmal Symbol mit Namen; am Rand fehlt der Knopf ganz (kein disabled)', () => {
  const mitte = { i: 3, n: 4, zurueck: 'kd:b', vor: 'kd:d' };
  const breit = d.blaetternHtml(mitte, 'kd:ccccccc', false);
  assert.ok(breit.includes('aria-label="Zurück, voriger Commit 2 von 4"') && breit.includes('aria-label="Vor, nächster Commit 4 von 4"'));
  assert.ok(breit.includes('<span class="t">Zurück</span>') && breit.includes('<b id="rv-pos" aria-live="polite">3 von 4</b>'));
  const schmal = d.blaetternHtml(mitte, 'kd:ccccccc', true);
  assert.ok(schmal.includes('aria-label="Voriger Commit, 2 von 4"') && schmal.includes('aria-label="Nächster Commit, 4 von 4"') && !schmal.includes('class="t"'));
  const erster = d.blaetternHtml({ i: 1, n: 4, zurueck: null, vor: 'kd:b' }, 'k', false);
  assert.ok(!erster.includes('id="rv-zurueck"') && erster.includes('id="rv-vor"') && !erster.includes('disabled'));
  assert.ok(!d.blaetternHtml({ i: 4, n: 4, zurueck: 'kd:c', vor: null }, 'k', false).includes('id="rv-vor"'));
});

test('Blättern (R00245 FA 6): nach einer Wahl in der Leiste ist die Stelle still — die Wahl sagt „Commit <i> von <n>“ einmal an', () => {
  const mitte = { i: 3, n: 4, zurueck: 'kd:b', vor: 'kd:d' };
  assert.ok(d.blaetternHtml(mitte, 'k', false, true).includes('<b id="rv-pos">3 von 4</b>'));
  assert.ok(d.blaetternHtml(mitte, 'k', false, false).includes('<b id="rv-pos" aria-live="polite">3 von 4</b>'));
});

test('Seitenfehler: Antwortbudget nach Text mit Server, sonst 503 Zeitgrenze mit Uhr, 404 mit Zustandswort, anderer mit Status 0', () => {
  const budget = d.diffFehlerHtml({ status: 503, fehler: 'Antwortbudget von 64 MB belegt' }, 'kd:' + 'a'.repeat(40), esc);
  assert.ok(budget.includes('role="alert"') && ohneTags(budget).startsWith('Server ausgelastet (Antwortbudget). Der Diff wurde nicht gelesen, weil der Server gerade zu viele große Antworten ausliefert. Es wird nicht von selbst wiederholt.'));
  const zeit = d.diffFehlerHtml({ status: 503, fehler: 'Git <b>antwortete</b> nicht' }, 'kd:a', esc);
  assert.ok(ohneTags(zeit).startsWith('Zeitgrenze überschritten. Der Diff ließ sich nicht lesen: Git &lt;b&gt;antwortete&lt;/b&gt; nicht (503).'));
  const kein = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand: 'fehlt' } }, 'kd:' + 'b'.repeat(40), esc);
  // umgestellt mit R00224 FA 6 (PO Z. 507): Überschrift „Zu <kurz> gibt es keinen Diff.“, darunter der Satz des Zustands
  assert.ok(kein.includes('role="status"') && ohneTags(kein).startsWith('Zu kd:bbbbbbb gibt es keinen Diff.Das Repository der Anwendung kd kennt diesen Commit nicht mehr.Zur Liste der Commits'));
  const netz = d.diffFehlerHtml({ status: 0, fehler: 'egal' }, 'kd:a', esc);
  // umgestellt mit R00210 AK 13 (PO Z. 450): ohne Antwort keine Klammer „(0)“
  assert.ok(netz.includes('role="alert"') && ohneTags(netz).startsWith('Der Diff ließ sich nicht lesen: keine Verbindung zum Programm.Erneut versuchenZur Liste der Commits'));
  assert.ok(ohneTags(d.diffFehlerHtml({ status: 500, fehler: 'kaputt' }, 'kd:a', esc)).startsWith('Der Diff ließ sich nicht lesen: kaputt (500).'));
  for (const html of [budget, zeit, kein, netz]) assert.ok(html.includes('<h2 id="rv-meld" tabindex="-1">'), 'Meldungsüberschrift als Fokusziel');
});

test('Rand (c) nennt je Eintrag Kurzform, Zustandswort und Hinweis; gekappt mit den Zahlen der Antwort; Rand (b) mit „Zum ersten Commit“', () => {
  const keine = ohneTags(d.keineHtml([{ verweis: 'kd:' + 'e'.repeat(40), anwendung: 'kd', zustand: 'fehlt' }, { verweis: 'xy:' + 'a'.repeat(40), anwendung: 'xy', hash: 'a'.repeat(40), zustand: 'anwendung_unbekannt' }], esc));
  assert.ok(keine.startsWith('Keine Änderungen zu zeigen. Zu keinem Commit der Aufgabe gibt es einen Diff:'));
  assert.ok(keine.includes('kd:' + 'e'.repeat(40) + ' nicht mehr im Repository') || keine.includes('nicht mehr im Repository'));
  assert.ok(keine.includes('xy:aaaaaaa Anwendung unbekannt Anwendung „xy“ ist unter Einrichten nicht eingetragen.'));
  assert.ok(keine.endsWith('Zurück zur Liste der Commits'));
  assert.strictEqual(ohneTags(d.gekapptHtml([{ art: 'dateien_gekappt', gezeigt: 2000, gesamt: 2431 }])), '2.000 von 2.431 Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; der Commit liegt vollständig im Repository.');
  assert.strictEqual(d.gekapptHtml([]), '');
  assert.ok(ohneTags(d.fremdHtml('kd:bbbbbbb', esc)).startsWith('kd:bbbbbbb gehört nicht zu den Commits dieser Aufgabe mit Diff. Gezeigt wird sein Diff, ohne „i von n“.Zum ersten Commit'));
});

test('Commit-Kopf: Titel als h2 mit tabindex -1, verwaist mit „auf keinem Zweig“ und Band, Summe „1 Datei“ / „0 Dateien“', () => {
  const c = { hash: 'c'.repeat(40), titel: 'v.dat anlegen', autor: 'Ada', datum: '2026-03-03T09:00:00+00:00', plus: 1, minus: 0, dateien: 1 };
  const html = d.commitKopfHtml(c, 'kd', { zustand: 'verwaist' }, esc);
  assert.ok(html.includes('<h2 id="rv-ctitel" tabindex="-1">v.dat anlegen</h2>') && html.includes('auf keinem Zweig'));
  assert.ok(ohneTags(html).includes('Dieser Commit ist verwaist: Kein Zweig führt zu ihm. Sein Diff bleibt lesbar. Nach einem Rebase mit ersetzen nachziehen; im Gesamtbild der Aufgabe zählt er nicht mit.'));
  assert.ok(ohneTags(html).includes('Ada · 03.03.2026 10:00 · +1 −0 · 1 Datei'));
  assert.strictEqual(d.dateienWort(0), '0 Dateien');
  assert.ok(!d.commitKopfHtml(c, 'kd', { zustand: 'auf_zweig', zweige: ['main'] }, esc).includes('rv-band'));
});

test('Nacharbeit 1 (Code S1): Kopf „Die Liste der Commits ließ sich nicht lesen: <Grund> (<Status>).“ mit dem Grund wie in B1, auch ohne Antwort und bei 503', () => {
  assert.strictEqual(d.listeFehlerText({ status: 500, fehler: 'innen kaputt' }), 'Die Liste der Commits ließ sich nicht lesen: innen kaputt (500).');
  assert.strictEqual(d.listeFehlerText({ status: 0, fehler: 'x' }), 'Die Liste der Commits ließ sich nicht lesen: keine Verbindung zum Programm (0).');
  assert.strictEqual(d.listeFehlerText({ status: 503, fehler: null }), 'Die Liste der Commits ließ sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden (503).');
});

test('Nacharbeit 1 (Security S2): Titel, Autor und Zweige im Commit-Kopf zeigen Bidi als Marke; das title-Attribut trägt die Marke als Text, nie das Zeichen', () => {
  const RLO = '‮';
  const c = { hash: 'c'.repeat(40), titel: `Titel${RLO}fdp.exe`, autor: `Ada${RLO}x`, datum: `2026-03-03T09:00:00+00:00${RLO}`, plus: 1, minus: 0, dateien: 1 };
  const html = d.commitKopfHtml(c, 'kd', { zustand: 'auf_zweig', zweige: [`zweig${RLO}a`] }, esc);
  assert.ok(!html.includes(RLO), 'kein U+202E im HTML');
  const titel = /<h2 id="rv-ctitel" tabindex="-1">(.*?)<\/h2>/.exec(html)[1];
  assert.ok(titel.includes('mk-bidi') && ohneTags(titel) === 'Titel⟨U+202E⟩fdp.exe', titel);
  const autor = /<p class="m">(.*?) · <span title/.exec(html)[1];
  assert.ok(autor.includes('mk-bidi') && ohneTags(autor) === 'Ada⟨U+202E⟩x', autor);
  const zweig = /<span class="rv-br">(.*?)<\/span><\/span>/.exec(html)[1];
  assert.ok(zweig.includes('mk-bidi') && ohneTags(zweig).endsWith('zweig⟨U+202E⟩a'), zweig);
  assert.ok(html.includes('title="2026-03-03T09:00:00+00:00⟨U+202E⟩"'), 'title mit Marke als Text');
  // fremder Text bleibt maskiert
  const boese = d.commitKopfHtml({ ...c, titel: BOESE, autor: BOESE, datum: BOESE }, 'kd', { zustand: 'auf_zweig', zweige: [BOESE] }, esc);
  assert.ok(!boese.includes('<img') && !boese.includes('"x"'));
});

test('Nacharbeit 1 (Rechtschreibung S1): Lesetext „auf Zweig: “ bei genau einem Zweig, „auf Zweigen: “ ab zwei (auch mit nicht aufgeführten)', () => {
  const c = { hash: 'c'.repeat(40), titel: 't', autor: 'a', datum: '2026-03-03T09:00:00+00:00', plus: 1, minus: 0, dateien: 1 };
  const lesetext = (zweige, mehr = {}) => /<span class="vh">(.*?)<\/span>/.exec(d.commitKopfHtml(c, 'kd', { zustand: 'auf_zweig', zweige, ...mehr }, esc))[1];
  // umgestellt mit R00245 (FA 9): mit `main` verdichtet der Kopf zu „auf main“; der Lesetext gilt der Liste ohne `main` und `master`
  assert.strictEqual(lesetext(['karte/9']), 'auf Zweig: ');
  assert.strictEqual(lesetext([], { entfernte_zweige: ['origin/main'] }), 'auf Zweig: ');
  assert.strictEqual(lesetext(['karte/9', 'karte/1']), 'auf Zweigen: ');
  assert.strictEqual(lesetext(['karte/9'], { entfernte_zweige: ['origin/main'] }), 'auf Zweigen: ');
  assert.strictEqual(lesetext(['karte/9'], { zweige_weitere: 1 }), 'auf Zweigen: ');
});

/* ── R00245 B1283: Commit-Kopf verdichtet — Chips, Überschrift ohne Chips, „auf main“ mit „+<k> Zweige“ ── */

const kopfCommit = titel => ({ hash: 'c'.repeat(40), titel, autor: 'Ada', datum: '2026-11-22T03:19:00+01:00', plus: 302, minus: 7, dateien: 1 });
const aufZweig = (zweige, entfernte = [], weitere) => ({ zustand: 'auf_zweig', zweige, entfernte_zweige: entfernte, ...(weitere ? { zweige_weitere: weitere } : {}) });
const C1_ZWEIGE = aufZweig(['karte/247', 'karte/a', 'karte/b', 'karte/c', 'karte/d', 'main']);

test('Commit-Kopf: Kurz-Hash, Kennungen als Liste mit unsichtbarem Vorspann, Überschrift ohne Chips; Autor, Datum, Zeilen und Dateien wie bisher', () => {
  const html = d.commitKopfHtml(kopfCommit('[R00229] B1187: Sperrform je Komponente'), 'kd', C1_ZWEIGE, esc);
  assert.match(html, /<div class="z1"><span class="mono">kd:ccccccc<\/span><span class="vh">Kennungen:<\/span><ul class="rv-chips"><li class="rv-chip">R00229<\/li><li class="rv-chip">B1187<\/li><\/ul><span class="rv-zweige">/);
  assert.match(html, /<h2 id="rv-ctitel" tabindex="-1">Sperrform je Komponente<\/h2>/);
  assert.ok(ohneTags(html).includes('Ada · 22.11.2026 03:19 · +302 −7 · 1 Datei'));
});

test('Commit-Kopf: ohne Form, nur Kennung, [Factory] — Überschrift unverändert, keine Kennungen; Chip über 16 Zeichen gekürzt mit title', () => {
  for (const titel of ['Ohne Form', '[R00229]', '[Factory] director: Text', 'x [R00229] y']) {
    const html = d.commitKopfHtml(kopfCommit(titel), 'kd', null, esc);
    assert.ok(html.includes(`<h2 id="rv-ctitel" tabindex="-1">${esc(titel)}</h2>`), titel);
    assert.doesNotMatch(html, /rv-chip|Kennungen/, titel);
  }
  const lang = d.commitKopfHtml(kopfCommit(`[${'A'.repeat(40)}] Rest`), 'kd', null, esc);
  assert.ok(lang.includes(`<li class="rv-chip" title="${'A'.repeat(40)}">${'A'.repeat(15)}…</li>`));
});

test('Commit-Kopf: C1 „auf main“ mit „+5 Zweige“ zu, die Liste aller Namen dahinter verborgen; offen sichtbar', () => {
  const zu = d.commitKopfHtml(kopfCommit('t'), 'kd', C1_ZWEIGE, esc);
  assert.match(zu, /<span class="rv-zweige"><span class="rv-zw-auf">auf main<\/span><button type="button" class="btn rv-mehr" id="rv-zw-mehr" data-act="review-zweige" aria-expanded="false" aria-controls="rv-zw-liste">\+5 Zweige<\/button><span class="rv-zw-liste" id="rv-zw-liste" hidden><span class="vh">auf Zweigen: <\/span><span class="rv-br">karte\/247<\/span>/);
  const offen = d.commitKopfHtml(kopfCommit('t'), 'kd', C1_ZWEIGE, esc, true);
  assert.match(offen, /aria-expanded="true" aria-controls="rv-zw-liste">\+5 Zweige<\/button><span class="rv-zw-liste" id="rv-zw-liste"><span class="vh">/);
});

test('Commit-Kopf: C3 „+1 Zweig“, C4 ohne Knopf, C8 „auf master“, C9 „+11 Zweige“, ohne main die heutige Liste, verwaist bleibt', () => {
  const kopf = e => d.commitKopfHtml(kopfCommit('t'), 'kd', e, esc);
  assert.match(kopf(aufZweig(['main'], ['origin/main'])), /auf main<\/span><button [^>]*>\+1 Zweig<\/button>/);
  const c4 = kopf(aufZweig(['main']));
  assert.match(c4, /<span class="rv-zweige"><span class="rv-zw-auf">auf main<\/span><\/span>/);
  assert.doesNotMatch(c4, /<button/);
  assert.match(kopf(aufZweig(['master', 'x'])), /auf master<\/span><button [^>]*>\+1 Zweig<\/button>/);
  assert.match(kopf(aufZweig(['master', 'main'])), /auf main<\/span>/);
  assert.match(kopf(aufZweig(['main', ...Array.from({ length: 9 }, (_, i) => `zz0${i + 1}`)], [], 2)), />\+11 Zweige<\/button>/);
  const c2 = kopf(aufZweig(['karte/247'], ['origin/karte/247']));
  assert.doesNotMatch(c2, /auf main|<button|rv-zw-/);
  assert.ok(ohneTags(c2).includes('auf Zweigen: karte/247origin/karte/247'));
  assert.ok(kopf({ zustand: 'verwaist' }).includes('<span class="rv-kz">auf keinem Zweig</span>'));
});

/* ── R00224 B1169: „Ein Commit“ bei 404 mit zustand — Überschrift, Satz, Hinweiszeile als eigene Blöcke ── */

const kopfSatzHin = html => [/<h2 id="rv-meld"[^>]*>([^<]*)<\/h2>/.exec(html), /<p class="rv-satz">([^<]*)<\/p>/.exec(html), /<p class="rv-hin">([^<]*)<\/p>/.exec(html)].map(m => (m ? m[1] : null));

test('R00224: kein_diff mit zustand — Überschrift mit dem angefragten Verweis, Satz, maskierte Hinweiszeile; Ton und Symbol der Liste, Rolle status', () => {
  const { zustandsSymbol } = require('../../web/commits.js');
  const verweis = 'wb:' + 'c'.repeat(40);
  const html = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand: 'repository_fehlt', grund: 'Ordner fehlt: /x/<img src=x onerror=1>\u202Egpj.exe' } }, verweis, esc);
  assert.deepStrictEqual(kopfSatzHin(html), ['Zu wb:ccccccc gibt es keinen Diff.', 'Das Repository der Anwendung wb ist nicht erreichbar.', 'Ordner fehlt: /x/&lt;img src=x onerror=1&gt;gpj.exe']);
  assert.ok(html.startsWith('<div class="rv-meld rv-zeilen fehl" role="status">' + zustandsSymbol('ordner-offen')), html.slice(0, 120));
  assert.ok(!html.includes('<img') && !html.includes('undefined') && html.includes('data-act="review-liste"'));
  for (const [zustand, kuerzel, satz, ton, symbol] of [['fehlt', 'kd', 'Das Repository der Anwendung kd kennt diesen Commit nicht mehr.', 'fehl', 'fehlt'], ['anwendung_unbekannt', 'xy', 'Die Anwendung xy ist unter Einrichten nicht eingetragen.', 'warn', 'frage'], ['unlesbar', 'kd', 'Der Eintrag an der Aufgabe ist nicht lesbar.', 'fehl', 'achtung']]) {
    const h = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand } }, `${kuerzel}:${'d'.repeat(40)}`, esc);
    assert.deepStrictEqual(kopfSatzHin(h), [`Zu ${kuerzel}:ddddddd gibt es keinen Diff.`, satz, null], zustand);
    assert.ok(h.startsWith(`<div class="rv-meld rv-zeilen ${ton}" role="status">${zustandsSymbol(symbol)}`), zustand);
  }
});

test('R00224: Verweis ohne Kürzel nennt die Standardanwendung bzw. „keine Anwendung“; Kürzel im Satz maskiert', () => {
  const ohne = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand: 'repository_fehlt' } }, 'e'.repeat(40), esc);
  assert.deepStrictEqual(kopfSatzHin(ohne), ['Zu eeeeeee gibt es keinen Diff.', 'Das Repository der Standardanwendung ist nicht erreichbar.', null]);
  const unbekannt = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand: 'anwendung_unbekannt' } }, 'e'.repeat(40), esc);
  assert.strictEqual(kopfSatzHin(unbekannt)[1], 'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.');
  const boese = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand: 'fehlt' } }, '<b>:' + 'e'.repeat(40), esc);
  assert.ok(!boese.includes('<b>') && boese.includes('Anwendung &lt;b&gt; kennt'));
});

test('R00224: unbekannter Zustand und 404 ohne zustand — der alte Satz ohne Ton, ohne Symbol und ohne Zeilen-Form', () => {
  for (const daten of [{ zustand: 'neu_art' }, { verweis: 'kd:a' }, null]) {
    const h = d.diffFehlerHtml({ status: 404, fehler: 'x', daten }, 'kd:' + 'a'.repeat(40), esc);
    assert.ok(h.startsWith('<div class="rv-meld" role="status"><div class="rv-meldtext">'), JSON.stringify(daten));
    assert.ok(ohneTags(h).startsWith('Zu diesem Verweis gibt es keinen Diff: kd:aaaaaaa — x.'), JSON.stringify(daten));
  }
});
