// R00207 B1019: das Zeichnen der Review-Seite als reine Funktion (HTML-Text) — ohne Browser. Fremder Text geht nur über `esc`,
// Unsichtbares wird als Marke sichtbar, Knöpfe tragen `.btn`, Wortlaute aus R00207 FA 2–8.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const BOESE = '<img src=x onerror=window.pwn=1> "x"';
const datei = (zusatz = {}) => ({ neu: 'src/a.txt', alt: 'src/a.txt', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-a\n+b\n', ...zusatz });
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
  assert.ok(html.includes('<div class="df-sc" tabindex="0" role="region" aria-label="Änderungen in src/a.txt">'));
  assert.ok(html.includes('<table class="dz" aria-label="Änderungen in src/a.txt">'));
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
  const zuGross = zeichne({ gross: true, patch: undefined, plus: 1204, minus: 7 }, offen(), [{ art: 'zu_gross_zum_anzeigen', datei: 'src/a.txt' }]);
  assert.ok(ohneTags(zuGross).includes('Zu groß zum Anzeigen. Es stehen nur die Zahlen: +1.204 −7.'));
  assert.ok(!zuGross.includes('<button type="button" class="btn"'), 'kein Knopf');
  assert.ok(ohneTags(zeichne({ binaer: true, patch: undefined })).includes('Binärdatei — der Inhalt wird nicht angezeigt.'));
  assert.ok(ohneTags(zeichne({ patch: undefined, modus_alt: '100644', modus_neu: '100755', plus: 0, minus: 0 })).includes('Dateimodus 100644 → 100755; der Inhalt ist unverändert.'));
  assert.ok(ohneTags(zeichne({ nicht_utf8: true })).includes('Nicht als UTF-8 lesbar — nicht darstellbare Zeichen sind ersatzweise mit � wiedergegeben.'));
  assert.ok(ohneTags(zeichne({ status: 'R', alt: 'alt/b.txt', aehnlichkeit: 100, patch: undefined })).includes('umbenannt ← alt/b.txt · 100 %'));
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

test('Seitenfehler: Antwortbudget nach Text mit Server, sonst 503 Zeitgrenze mit Uhr, 404 mit Zustandswort, anderer mit Status 0', () => {
  const budget = d.diffFehlerHtml({ status: 503, fehler: 'Antwortbudget von 64 MB belegt' }, 'kd:' + 'a'.repeat(40), esc);
  assert.ok(budget.includes('role="alert"') && ohneTags(budget).startsWith('Server ausgelastet (Antwortbudget). Der Diff wurde nicht gelesen, weil der Server gerade zu viele große Antworten ausliefert. Es wird nicht von selbst wiederholt.'));
  const zeit = d.diffFehlerHtml({ status: 503, fehler: 'Git <b>antwortete</b> nicht' }, 'kd:a', esc);
  assert.ok(ohneTags(zeit).startsWith('Zeitgrenze überschritten. Der Diff ließ sich nicht lesen: Git &lt;b&gt;antwortete&lt;/b&gt; nicht (503).'));
  const kein = d.diffFehlerHtml({ status: 404, fehler: 'x', daten: { zustand: 'fehlt' } }, 'kd:' + 'b'.repeat(40), esc);
  assert.ok(kein.includes('role="status"') && ohneTags(kein).startsWith('Zu diesem Verweis gibt es keinen Diff: kd:bbbbbbb ist nicht mehr im Repository.Zur Liste der Commits'));
  const netz = d.diffFehlerHtml({ status: 0, fehler: 'egal' }, 'kd:a', esc);
  assert.ok(netz.includes('role="alert"') && ohneTags(netz).startsWith('Der Diff ließ sich nicht lesen: keine Verbindung zum Programm (0).Erneut versuchenZur Liste der Commits'));
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
  const c = { hash: 'c'.repeat(40), titel: 'v.txt anlegen', autor: 'Ada', datum: '2026-03-03T09:00:00+00:00', plus: 1, minus: 0, dateien: 1 };
  const html = d.commitKopfHtml(c, 'kd', { zustand: 'verwaist' }, esc);
  assert.ok(html.includes('<h2 id="rv-ctitel" tabindex="-1">v.txt anlegen</h2>') && html.includes('auf keinem Zweig'));
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
  assert.strictEqual(lesetext(['main']), 'auf Zweig: ');
  assert.strictEqual(lesetext([], { entfernte_zweige: ['origin/main'] }), 'auf Zweig: ');
  assert.strictEqual(lesetext(['main', 'karte/1']), 'auf Zweigen: ');
  assert.strictEqual(lesetext(['main'], { entfernte_zweige: ['origin/main'] }), 'auf Zweigen: ');
  assert.strictEqual(lesetext(['main'], { zweige_weitere: 1 }), 'auf Zweigen: ');
});
