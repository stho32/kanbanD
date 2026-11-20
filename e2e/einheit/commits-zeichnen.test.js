// R00205 B1006: das Zeichnen der Commit-Liste als reine Funktion (HTML-Text) — ohne Browser. Fremder Text geht nur über `esc`,
// Zustandswörter stehen sichtbar (nicht in .vh), Zweigklappe mit aria-expanded, kein Verweis und kein Knopf „Alle Änderungen ansehen“.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { commitsListeHtml, commitsKopfHtml, commitsFussHtml, commitsAnsichtHtml, ZUSTANDSWOERTER } = require('../../web/commits.js');

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const K3 = 'c0ffee0123456789abcdef0123456789abcdef01';
const auf = (z = {}) => ({ verweis: `kd:${K3}`, anwendung: 'kd', hash: K3, zustand: 'auf_zweig', zweige: ['main'], entfernte_zweige: ['o/main'], titel: 'c.txt anlegen', autor: 'Ada Autorin', datum: '2026-03-01T10:00:00+01:00', plus: 3, minus: 0, dateien: 1, ...z });
const verwaist = { verweis: 'kd:bbb', anwendung: 'kd', hash: 'b'.repeat(40), zustand: 'verwaist', titel: 'v.txt anlegen', autor: 'Ada Autorin', datum: '2026-03-03T09:00:00+00:00', plus: 1, minus: 0, dateien: 1 };
const fehlt = { verweis: 'kd:ccc', anwendung: 'kd', hash: 'c'.repeat(40), zustand: 'fehlt' };
const repoWeg = { verweis: 'xx:ddd', anwendung: 'xx', hash: 'd'.repeat(40), zustand: 'repository_fehlt', grund: 'kein Git-Repository: /x/y' };
const unbekannt = { verweis: 'xy:eee', anwendung: 'xy', hash: 'e'.repeat(40), zustand: 'anwendung_unbekannt' };
const unlesbar = { verweis: 'kd:3f2a9c1;rm -rf x', zustand: 'unlesbar', grund: 'Verweis ungültig' };
const liste = (e, klappen = new Set()) => commitsListeHtml(e, klappen, esc);
const zeilen = html => html.split('<tr').slice(1);

test('Tabelle: sechs Spaltenüberschriften mit scope=col, der Rahmen ist eine fokussierbare Gruppe mit Namen', () => {
  const html = liste([auf()]);
  for (const name of ['Commit', 'Titel', 'Autor', 'Datum', '+ / −', 'Zustand']) assert.match(html, new RegExp(`<th scope="col"[^>]*>${name.replace('+', '\\+')}</th>`), name);
  assert.match(html, /<div class="cl-rahmen" tabindex="0" role="group" aria-label="Commits dieser Aufgabe, ältester zuerst">/);
});

test('Zeile: Kurz-Hash als Zeilenüberschrift (scope=row) mit dem vollen Verweis im title, Titel, Autor, Datum mit title, +/− mit Lesetext', () => {
  const html = liste([auf()]);
  assert.match(html, new RegExp(`<th scope="row" class="cl-c-hash"><span class="cl-hash" title="kd:${K3}">kd:c0ffee0</span></th>`));
  assert.match(html, />c\.txt anlegen</);
  assert.match(html, />Ada Autorin</);
  assert.match(html, /<span title="2026-03-01T10:00:00\+01:00">01\.03\.2026 10:00<\/span>/);
  assert.match(html, /<span class="cl-pl">\+3<\/span> <span class="cl-mi">−0<\/span><span class="vh"> Zeilen<\/span>/);
});

test('kein Verweis, kein Knopf „Alle Änderungen ansehen“: in B1 gibt es weder href noch ein Ziel an Hash oder Zeile (das kommt mit B2)', () => {
  const html = liste([auf(), verwaist, fehlt, repoWeg, unbekannt, unlesbar]);
  assert.doesNotMatch(html, /href=/);
  assert.doesNotMatch(html, /<a[\s>]/);
  assert.doesNotMatch(html, /Alle Änderungen/);
  assert.doesNotMatch(html, /data-act="[^"]*(ansehen|oeffnen)/);
});

test('Zustandswörter stehen sichtbar: in der Marke .cl-zs mit Symbol davor, nie innerhalb von .vh; paarweise verschieden', () => {
  const html = liste([verwaist, fehlt, repoWeg, unbekannt, unlesbar]);
  for (const wort of Object.values(ZUSTANDSWOERTER)) {
    assert.match(html, new RegExp(`<span class="cl-zs cl-(?:warn|fehl)"><svg[^>]*aria-hidden="true">.*?</svg>${wort}</span>`), wort);
    assert.doesNotMatch(html, new RegExp(`class="vh"[^>]*>[^<]*${wort}`), `${wort} nicht in .vh`);
  }
  assert.strictEqual(new Set(Object.values(ZUSTANDSWOERTER)).size, 5);
});

test('Hinweiszeilen der fünf Zustände stehen unter der Marke; „Anwendung unbekannt“ mit und ohne Kürzel', () => {
  const html = liste([verwaist, fehlt, repoWeg, unbekannt, unlesbar, { ...unbekannt, anwendung: '' }]);
  for (const satz of [
    'Der Commit ist noch da, aber kein Zweig führt zu ihm — meist nach einem Rebase.',
    'Das Repository kennt diesen Commit nicht mehr.',
    'kein Git-Repository: /x/y',
    'Anwendung „xy“ ist unter Einrichten nicht eingetragen.',
    'Verweis ungültig',
    'Der Verweis nennt keine Anwendung, und es ist keine Standardanwendung eingerichtet.',
  ]) assert.ok(html.includes(`<p class="cl-zh">${satz}</p>`), satz);
});

test('ohne Metadaten steht „—“ (aria-hidden) mit verstecktem „keine Angabe“ in Titel, Autor, Datum und +/−; bei „auf keinem Zweig“ stehen die Daten', () => {
  const [, fehltZeile] = zeilen(liste([fehlt]));
  assert.strictEqual((fehltZeile.match(/<span aria-hidden="true">—<\/span><span class="vh">keine Angabe<\/span>/g) || []).length, 4);
  const [, verwaistZeile] = zeilen(liste([verwaist]));
  assert.doesNotMatch(verwaistZeile, /keine Angabe/);
  assert.match(verwaistZeile, /v\.txt anlegen/);
  assert.match(verwaistZeile, /\+1<\/span> <span class="cl-mi">−0/);
});

test('der Kurz-Hash einer unlesbaren Zeile steht wörtlich da (kein Hash → Verweis), als Text, umbrechbar', () => {
  const html = liste([unlesbar]);
  assert.match(html, /<span class="cl-hash cl-roh" title="kd:3f2a9c1;rm -rf x">kd:3f2a9c1;rm -rf x<\/span>/);
});

test('fremder Text bleibt Text: Titel, Autor, Zweigname und grund werden maskiert, Anführungszeichen brechen kein title-Attribut', () => {
  const boese = auf({ titel: '<img src=x onerror=window.pwn=1> "x" \\ y', autor: 'Mallory <b>fett</b>', zweige: ['a"><i>z'], entfernte_zweige: [] });
  const html = liste([boese, { ...repoWeg, grund: '<script>alert(1)</script>' }]);
  assert.doesNotMatch(html, /<img|<b>|<i>|<script/);
  assert.ok(html.includes('&lt;img src=x onerror=window.pwn=1&gt; &quot;x&quot; \\ y'));
  assert.ok(html.includes('Mallory &lt;b&gt;fett&lt;/b&gt;'));
  assert.ok(html.includes('title="a&quot;&gt;&lt;i&gt;z"'), 'der Zweigname steht maskiert im title');
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  // jede Attributliste ist wohlgeformt: nach dem Ende eines Attributwerts folgt Leerraum, „>“ oder „/“
  for (const m of html.matchAll(/<[a-z][^>]*>/g)) assert.match(m[0].replace(/"[^"]*"/g, 'Q'), /^<[a-z0-9]+(?: [A-Za-z-]+(?:=Q)?)*\s*\/?>$/, m[0]);
});

test('Marke „gekürzt“ nur bei 501 Zeichen mit „…“, als sichtbarer Text mit title (nicht in .vh)', () => {
  const lang = liste([auf({ titel: 'a'.repeat(500) + '…' })]);
  assert.match(lang, /<span class="cl-kurz" title="Der Titel ist bei 500 Zeichen gekürzt; vollständig steht er im Repository\.">gekürzt<\/span>/);
  assert.doesNotMatch(liste([auf({ titel: 'a'.repeat(499) + '…' })]), /gekürzt/);
  assert.strictEqual(liste([auf({ titel: 'a'.repeat(500) + '…' })]).includes('a'.repeat(500) + '…'), true, 'der Titel steht ganz da');
});

test('Zweige: bis zu drei Namen, entfernte gestrichelt mit Lesetext „(entfernt)“, bei drei kein Knopf, bei vier „+1 weitere“', () => {
  const drei = liste([auf({ zweige: ['main', 'b'], entfernte_zweige: ['o/main'] })]);
  assert.match(drei, /<span class="cl-br cl-fern" title="o\/main"><svg[^>]*>.*?<\/svg><span>o\/main<\/span><span class="vh"> \(entfernt\)<\/span><\/span>/);
  assert.match(drei, /<span class="vh">auf Zweigen: <\/span>/);
  assert.doesNotMatch(drei, /cl-mehr/);
  const vier = liste([auf({ zweige: ['a', 'b', 'c', 'd'], entfernte_zweige: [] })]);
  assert.match(vier, /<button type="button" class="cl-mehr" data-act="commits-klappe" data-arg="0" aria-expanded="false" aria-controls="cl-zw-0" aria-label="1 weiteren Zweig zeigen">/);
  assert.match(vier, /\+1 weitere<\/button>/);
});

test('Zweigklappe: zu → aria-expanded=false, „zeigen“, keine Zusatzzeile; auf → true, „verbergen“, LOKALE/ENTFERNTE ZWEIGE n und der Satz zum Rest', () => {
  const lokal = Array.from({ length: 10 }, (_, i) => `z${i + 1}`), fern = Array.from({ length: 10 }, (_, i) => `o/e${i + 1}`);
  const z = auf({ zweige: lokal, entfernte_zweige: fern, zweige_weitere: 3 });
  const zu = liste([z]);
  assert.match(zu, /aria-expanded="false"[^>]*aria-label="20 weitere Zweige zeigen"/);
  assert.match(zu, />\+20 weitere</);
  assert.doesNotMatch(zu, /<tr class="cl-zw"|LOKALE ZWEIGE/);
  const offen = liste([z], new Set([0]));
  assert.match(offen, /aria-expanded="true"[^>]*aria-label="20 weitere Zweige verbergen"/);
  assert.match(offen, /<tr class="cl-zw" id="cl-zw-0">/);
  assert.match(offen, /LOKALE ZWEIGE 10/);
  assert.match(offen, /ENTFERNTE ZWEIGE 10/);
  assert.match(offen, /und 3 weitere Zweige, hier nicht aufgeführt/);
  for (const n of [...lokal, ...fern]) assert.ok(offen.includes(`<span>${n}</span>`), n);
});

test('Zweigklappe: ohne lokale Zweige keine Überschrift „LOKALE ZWEIGE“; ohne Rest kein Satz; die Klappe gilt je Zeile', () => {
  const nurFern = auf({ zweige: [], entfernte_zweige: ['o/x', 'o/y', 'o/z', 'o/w'] });
  const offen = liste([auf(), nurFern], new Set([1]));
  assert.doesNotMatch(offen, /LOKALE ZWEIGE/);
  assert.match(offen, /ENTFERNTE ZWEIGE 4/);
  assert.doesNotMatch(offen, /hier nicht aufgeführt/);
  assert.match(offen, /id="cl-zw-1"/);
  assert.doesNotMatch(offen, /id="cl-zw-0"/);
});

test('Kopf: „COMMITS“ mit der Zahl, im Laden ohne Zahl, dazu der Hinweis „an dieser Aufgabe hinterlegt · ältester zuerst“', () => {
  assert.match(commitsKopfHtml(5), /<h3>COMMITS <span class="mono">5<\/span><\/h3>/);
  assert.match(commitsKopfHtml(null), /<h3>COMMITS <\/h3>/);
  assert.match(commitsKopfHtml(0), /<h3>COMMITS <span class="mono">0<\/span><\/h3>/);
  assert.match(commitsKopfHtml(5), /<span class="cl-hin">an dieser Aufgabe hinterlegt · ältester zuerst<\/span>/);
});

test('Fuß: „liest nur · gelesen aus dem Repository der Anwendung“, „Stand“ nur nach einer Antwort, „Neu lesen“ mit aria-disabled beim Laden', () => {
  const ohne = commitsFussHtml({ stand: null, laedt: false });
  assert.match(ohne, /liest nur · gelesen aus dem Repository der Anwendung<\/span>/);
  assert.doesNotMatch(ohne, /Stand/);
  const mit = commitsFussHtml({ stand: '21:20:07', laedt: false });
  assert.match(mit, /liest nur · gelesen aus dem Repository der Anwendung · Stand 21:20:07<\/span>/);
  assert.match(mit, /<button type="button" class="cl-textknopf" id="commits-neu" data-act="commits-lesen"[^>]*>.*Neu lesen<\/button>/);
  assert.doesNotMatch(mit, /aria-disabled/);
  assert.match(commitsFussHtml({ stand: null, laedt: true }), /id="commits-neu"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(commitsFussHtml({ stand: null, laedt: true }), /data-act/, 'beim Lesen ohne Auslöser: sperrenMarkieren nähme aria-disabled sonst wieder weg, ein zweiter Klick tut nichts');
  assert.doesNotMatch(commitsFussHtml({ stand: null, laedt: true }), /\sdisabled[\s>=]/, 'aria-disabled statt disabled: der Fokus bleibt');
});

test('die Reihenfolge der Antwort bleibt: die Oberfläche sortiert nicht', () => {
  const html = liste([verwaist, auf(), fehlt]);
  assert.ok(html.indexOf('v.txt anlegen') < html.indexOf('c.txt anlegen'));
  assert.ok(html.indexOf('c.txt anlegen') < html.indexOf('kd:cccccc'));
  assert.doesNotMatch(html, /sortier|filter|Dateien/i);
});

/* ── Zustände der Ansicht (B1007): Laden, Liste, Fehler, leer — der Statusbereich steht in jedem Zustand genau einmal ── */
const laedt = { status: 'laedt', stand: null };
const gelesen = (eintraege, stand = '21:20:07') => ({ status: 'liste', eintraege, stand, klappen: new Set() });
const fehler = (status, text, stand = null) => ({ status: 'fehler', fehler: { status, fehler: text }, stand });
const ansicht = c => commitsAnsichtHtml(c, esc);
const alle = [laedt, gelesen([auf(), verwaist]), gelesen([]), fehler(503, 'x'), fehler(0, 'Keine Verbindung')];

test('der Statusbereich steht in jedem Zustand genau einmal, mit role=status und derselben Kennung', () => {
  for (const c of alle) {
    const html = ansicht(c);
    assert.strictEqual((html.match(/role="status"/g) || []).length, 1, c.status);
    assert.strictEqual((html.match(/id="commits-status"/g) || []).length, 1, c.status);
    assert.match(html, /<div [^>]*id="commits-status" role="status">/, 'immer ein div, damit der Knoten bei Zustandswechsel derselbe bleiben kann');
  }
});

test('Laden: Hinweis „Liest die Commits aus dem Repository …“ sichtbar im Statusbereich, Kopf ohne Zahl, keine Zeilen, „Neu lesen“ aria-disabled, kein Stand', () => {
  const html = ansicht(laedt);
  assert.match(html, /<div class="cl-laedt" id="commits-status" role="status">Liest die Commits aus dem Repository …<\/div>/);
  assert.match(html, /<h3>COMMITS <\/h3>/);
  assert.doesNotMatch(html, /<tr|<table/);
  assert.match(html, /id="commits-neu"[^>]*aria-disabled="true"/);
  assert.doesNotMatch(html, /Stand/);
});

test('Liste: der Statusbereich ist versteckt (.vh) und sagt „5 Commits gelesen“, Kopf mit Zahl, Fuß mit Stand', () => {
  const html = ansicht(gelesen([auf(), verwaist, fehlt, repoWeg, unlesbar]));
  assert.match(html, /<div class="vh" id="commits-status" role="status">5 Commits gelesen<\/div>/);
  assert.match(html, /<h3>COMMITS <span class="mono">5<\/span><\/h3>/);
  assert.match(html, /Stand 21:20:07/);
  assert.doesNotMatch(html, /aria-disabled/);
  assert.strictEqual((html.match(/<tr class="cl-z/g) || []).length, 5);
});

test('Fehler: der Statusbereich trägt die sichtbare Meldung (503 mit dem Wortlaut des PO), dazu „Erneut versuchen“, keine Zeilen, keine Zahl', () => {
  const html = ansicht(fehler(503, 'Git in einem Arbeits-Repository antwortete nicht innerhalb von 10 s — keine Liste'));
  assert.match(html, /<div class="cl-meldtext" id="commits-status" role="status">Die Commits ließen sich nicht lesen: Das Repository antwortete nicht innerhalb von 10 Sekunden \(503\)\.<\/div>/);
  assert.match(html, /<button type="button" class="cl-knopf" id="commits-erneut" data-act="commits-lesen">Erneut versuchen<\/button>/);
  assert.doesNotMatch(html, /<tr|<table|class="mono"/);
  assert.match(html, /id="commits-neu"/, '„Neu lesen“ steht auch im Fehler, der Fokus braucht sein Ziel');
});

test('Fehler: der Text der Antwort wird maskiert (fremder Text, ADR-0030)', () => {
  const html = ansicht(fehler(500, '<img src=x onerror=1>'));
  assert.doesNotMatch(html, /<img/);
  assert.ok(html.includes('&lt;img src=x onerror=1&gt; (500)'));
});

test('leer: „An dieser Aufgabe sind keine Commits hinterlegt.“ mit dem Satz zur API, ohne Zahl; der Statusbereich sagt „Keine Commits gelesen“', () => {
  const html = ansicht(gelesen([]));
  assert.match(html, /<div class="cl-leer">An dieser Aufgabe sind keine Commits hinterlegt\.<br><span>Ein Agent hinterlegt sie über die API \(<span class="mono">POST \/api\/aufgaben\/\{nr\}\/commits<\/span>\); siehe Endpunktliste unter <a href="\/api" target="_blank" rel="noopener">\/api<\/a>\.<\/span><\/div>/);
  assert.doesNotMatch(html, /<h3>COMMITS <span/);
  assert.match(html, /id="commits-status" role="status">Keine Commits gelesen</);
  assert.doesNotMatch(html, /<table/);
});

test('die Ansicht trägt das Gerüst .mod-main.cl-panel; Kopf vor Inhalt vor Fuß in jedem Zustand', () => {
  for (const c of alle) {
    const html = ansicht(c);
    assert.match(html, /^<div class="mod-main cl-panel">/);
    assert.ok(html.indexOf('cl-kopf') < html.indexOf('commits-status') && html.indexOf('commits-status') < html.indexOf('cl-fuss'), c.status);
  }
});

test('Zweigklappe: bei n = 1 „1 weiteren Zweig zeigen/verbergen“ (aria-label), ab n = 2 „n weitere Zweige“', () => {
  const vier = auf({ zweige: ['a', 'b', 'c', 'd'], entfernte_zweige: [] });
  assert.match(liste([vier]), /aria-label="1 weiteren Zweig zeigen"/);
  assert.match(liste([vier], new Set([0])), /aria-label="1 weiteren Zweig verbergen"/);
  const fuenf = auf({ zweige: ['a', 'b', 'c', 'd', 'e'], entfernte_zweige: [] });
  assert.match(liste([fuenf]), /aria-label="2 weitere Zweige zeigen"/);
  assert.match(liste([fuenf], new Set([0])), /aria-label="2 weitere Zweige verbergen"/);
});

test('Zweigklappe: genau ein nicht aufgeführter Zweig → „und 1 weiterer Zweig, hier nicht aufgeführt“ in der aufgeklappten Zeile', () => {
  const offen = liste([auf({ zweige: ['a', 'b', 'c'], zweige_weitere: 1 })], new Set([0]));
  assert.match(offen, /und 1 weiterer Zweig, hier nicht aufgeführt/);
});

test('fremder Text am Hash: Kurzform und voller Verweis einer unlesbaren Zeile werden maskiert (Text und title-Attribut)', () => {
  const boese = { verweis: 'kd:<img src=x onerror=1>" onmouseover="x', zustand: 'unlesbar', hash: null, grund: 'Verweis ungültig' };
  const html = liste([boese]);
  assert.doesNotMatch(html, /<img/);
  assert.doesNotMatch(html, /" onmouseover="/);
  assert.match(html, /<span class="cl-hash cl-roh" title="kd:&lt;img src=x onerror=1&gt;&quot; onmouseover=&quot;x">kd:&lt;img src=x onerror=1&gt;&quot; onmouseover=&quot;x<\/span>/);
});

test('Bidi-Steuerzeichen im Zweignamen erscheinen nicht in der gezeichneten Zeile (kein RLO, das den Namen umkehrt)', () => {
  const html = liste([auf({ zweige: ['fix-\u202Egpj.exe'] })]);
  assert.doesNotMatch(html, /[\u202A-\u202E\u2066-\u2069]/);
  assert.match(html, /<span>fix-gpj\.exe<\/span>/);
});
