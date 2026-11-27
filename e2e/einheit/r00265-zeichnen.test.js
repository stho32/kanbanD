// R00265 B1441: den Hinweis „Seit dem Haken verändert“ zeichnen (R00265 FA 2, 4; ADR-0042 N8.4 Punkt 6) — das Zeichnen als reine
// Funktion (HTML-Text), ohne Browser. In „Alle Änderungen“ trägt eine `geändert`-Datei ihn an zwei Stellen: als gewöhnlicher Text
// (Span) hinter dem Pfad im Zeilen-Knopf der Dateiliste und am Dateikopf neben „Gesehen“ per `aria-describedby`; in „Ein Commit“ nie.
const test = require('node:test');
const assert = require('node:assert');
const d = require('../../web/diff.js');
const g = require('../../web/gesamt.js');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HINWEIS = 'Seit dem Haken verändert';
const datei = (zusatz = {}) => ({ neu: 'src/a.rs', alt: 'src/a.rs', status: 'M', plus: 1, minus: 1, binaer: false, gross: false, nachladen: false, nicht_utf8: false, patch: '@@ -1 +1 @@\n-a\n+b\n', ...zusatz });
const stand = (zusatz = {}) => ({ offen: true, laden: null, fehler: null, gesehen: false, geaendert: false, pfadOk: false, pfadFeld: null, ...zusatz });

test('Dateikopf geändert: Hinweis als Span neben „Gesehen“, Kästchen per aria-describedby verbunden, sichtbarer Text = Tooltip', () => {
  const html = d.dateiHtml(datei(), 0, stand({ geaendert: true }), [], esc, { id: '2-3', arg: '2:3', quelle: { nr: 1, anwendung: 'kd', wurzel: '/r' } });
  assert.ok(html.includes(`<input type="checkbox" class="ru-ges-k" id="rv-gs2-3" data-act="review-gesehen" data-arg="2:3" aria-label="Gesehen: src/a.rs" aria-describedby="rv-hg2-3">Gesehen</label><span class="ru-hg" id="rv-hg2-3" title="${HINWEIS}">${HINWEIS}</span>`), html.slice(0, 900));
});

test('ohne geändert kein Hinweis und kein aria-describedby am Kästchen', () => {
  for (const s of [stand({ gesehen: true }), stand()]) {
    const html = d.dateiHtml(datei(), 0, s, [], esc, { id: '2-3', arg: '2:3', quelle: { nr: 1, anwendung: 'kd', wurzel: '/r' } });
    assert.ok(!html.includes('ru-hg'), html.slice(0, 400));
    assert.ok(!html.includes('aria-describedby'), html.slice(0, 400));
  }
});

test('Dateiliste geändert: Hinweis im Zeilen-Knopf direkt hinter dem Pfad, im selben button (der Name enthält ihn von selbst)', () => {
  const html = d.gruppierteListeHtml([datei()], () => ({ arg: 0, pfad: 'src/a.rs', wort: 'geändert', gesehen: false, geaendert: true }), esc);
  const knopf = /<button type="button" class="dn-e"[^>]*>(.*?)<\/button>/.exec(html)[1];
  assert.ok(knopf.includes(`<span class="p"><span class="d"`), knopf);
  assert.ok(knopf.includes(`<b>a.rs</b> <span class="ru-hg" title="${HINWEIS}">${HINWEIS}</span></span>`), 'Hinweis im Pfad-Span des Knopfs');
  assert.ok(knopf.endsWith('</span>'), 'kein Element nach dem Span, der Name speist sich aus dem Knopfinhalt');
});

test('Dateiliste ohne geändert: kein Hinweis; eine gesehene Zeile trägt weiter nur den Haken', () => {
  const ohne = d.gruppierteListeHtml([datei()], () => ({ arg: 0, pfad: 'src/a.rs', wort: 'geändert', gesehen: false }), esc);
  assert.ok(!ohne.includes('ru-hg'));
  const gesehen = d.gruppierteListeHtml([datei()], () => ({ arg: 0, pfad: 'src/a.rs', wort: 'geändert', gesehen: true }), esc);
  assert.ok(gesehen.includes('<span class="vh">gesehen</span>'));
  assert.ok(!gesehen.includes('ru-hg'));
});

test('„Ein Commit“ setzt nie einen Hinweis, auch wenn die Datei geändert wäre (FA 4)', () => {
  const html = d.dateilisteHtml([datei()], esc, [stand({ geaendert: true })]);
  assert.ok(!html.includes('ru-hg'), html);
  const kopf = d.dateiHtml(datei(), 0, stand({ gesehen: true }), [], esc, { id: 0, arg: 0, quelle: null });
  assert.ok(!kopf.includes('ru-hg'));
});

test('Alle Änderungen: Dateiliste des Abschnitts nimmt den Zustand aus den Ständen', () => {
  const antwort = { anwendung: 'kd', dateien: [datei()], commits: [], hinweise: [] };
  const ab = { status: 'da', kuerzel: 'kd', antwort, staende: [stand({ geaendert: true })] };
  const mitHinweis = g.abschnittListeHtml(ab, 0, esc);
  assert.ok(mitHinweis.includes(`<span class="ru-hg" title="${HINWEIS}">${HINWEIS}</span>`), mitHinweis);
  const ohne = g.abschnittListeHtml({ ...ab, staende: [stand()] }, 0, esc);
  assert.ok(!ohne.includes('ru-hg'));
});

test('Alle Änderungen: der Abschnitt zeichnet den Kopfs-Hinweis am Kästchen, ältere Ansichten ohne Zustand nicht', () => {
  const antwort = { anwendung: 'kd', commits: [{ verweis: 'kd:a', anwendung: 'kd', hash: 'a'.repeat(40), titel: 'K1', autor: 'sh', datum: '2026-11-20T10:00:00+01:00', plus: 1, minus: 1, dateien: 1 }], dateien: [datei()], hinweise: [], wurzel: '/r' };
  const ctx = { esc, nr: 3, adresse: () => '#', titelVon: () => null };
  const ab = { status: 'da', kuerzel: 'kd', antwort, staende: [stand({ geaendert: true })], gruppen: { code: true, test: true, doku: false } };
  const html = g.abschnittHtml(ab, 0, ctx);
  assert.ok(html.includes(`aria-label="Gesehen: src/a.rs" aria-describedby="rv-hg0-0">Gesehen</label><span class="ru-hg" id="rv-hg0-0" title="${HINWEIS}">${HINWEIS}</span>`), html.slice(0, 1200));
  const ohne = g.abschnittHtml({ ...ab, staende: [stand()] }, 0, ctx);
  assert.ok(!ohne.includes('ru-hg'));
});
