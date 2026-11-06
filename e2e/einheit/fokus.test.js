// Unit-Tests der Fokusführung über Ebenen (R00106, ADR-0010): node --test
const test = require('node:test');
const assert = require('node:assert');
const { ebenen, fallenSchritt, fokusZiel, fensterRand, ohneRollen } = require('../../web/fokus.js');

const arten = ui => ebenen(ui).map(ebene => ebene.art);

test('fokusZiel: Aufgabenfenster #1 geschlossen, Sicherer leer → .ka[data-id="1"]', () => {
  const geschlossen = ebenen({ view: 'board', offen: 1 })[0];
  const ziele = fokusZiel({ ausdruecklich: null, gesichert: false, gesichertInOberster: false, geschlossen, geoeffnet: null, oberste: null, fuehrung: null });
  assert.strictEqual(ziele[0], '.ka[data-id="1"]');
});

test('fokusZiel: Fenster aus der Aufgabenliste geschlossen → Zeile der Aufgabe, danach der gemerkte Auslöser', () => {
  const geschlossen = ebenen({ view: 'aufgaben', offen: 3 }, { fenster: '#t-x' })[0];
  const ziele = fokusZiel({ geschlossen });
  assert.deepStrictEqual(ziele, ['tr[data-zeile="3"]', '#t-x']);
});

test('fokusZiel: ein Sicherer-Treffer unter der obersten Ebene wird verworfen', () => {
  const oberste = ebenen({ view: 'board', offen: 1 })[0];
  const ziele = fokusZiel({ gesichert: true, gesichertInOberster: false, oberste });
  assert.ok(!ziele.includes('gesichert'), 'Sicherer verworfen');
  assert.strictEqual(ziele[0], '#fenster', 'stattdessen das Startziel der obersten Ebene');
});

test('fokusZiel: Rangfolge ausdrücklich > Sicherer in oberster > Rückgabe > Start > Führung', () => {
  const fenster = ebenen({ view: 'board', offen: 1 })[0];
  const hilfe = ebenen({ view: 'board', offen: 1, hilfe: true })[1];
  const ziele = fokusZiel({ ausdruecklich: '#neu-titel', gesichert: true, gesichertInOberster: true, geschlossen: hilfe, geoeffnet: fenster, oberste: fenster, fuehrung: '.ka[data-id="2"]' });
  assert.deepStrictEqual(ziele.slice(0, 2), ['#neu-titel', 'gesichert']);
  assert.ok(ziele.indexOf('#fenster') > 1);
  assert.ok(!ziele.includes('.ka[data-id="2"]'), 'Führung über Karten nur, wenn keine Ebene offen ist');
});

test('fokusZiel: ohne Ebene führt fokusKarte bzw. fokusZeile, wenn das Neuzeichnen den Fokus genommen hat', () => {
  assert.deepStrictEqual(fokusZiel({ fuehrung: '.ka[data-id="2"]', vorher: { stand: 'verloren' } }), ['.ka[data-id="2"]']);
  assert.deepStrictEqual(fokusZiel({ fuehrung: 'tr[data-zeile="2"]', vorher: { stand: 'verloren' } }), ['tr[data-zeile="2"]']);
  assert.deepStrictEqual(fokusZiel({}), []);
});

test('fokusZiel: war vor dem Neuzeichnen nichts fokussiert (BODY), führt fokusKarte bzw. fokusZeile nicht — BODY bleibt', () => {
  assert.deepStrictEqual(fokusZiel({ fuehrung: '.ka[data-id="1"]', vorher: { stand: 'nichts' } }), []);
  assert.deepStrictEqual(fokusZiel({ fuehrung: 'tr[data-zeile="1"]', vorher: { stand: 'nichts' } }), []);
  assert.deepStrictEqual(fokusZiel({ fuehrung: '.ka[data-id="1"]' }), [], 'ohne Angabe gilt nichts als verloren');
});

test('fokusZiel: hängt das fokussierte Element nach dem Neuzeichnen noch im Dokument, nimmt die Führung ihm den Fokus nicht', () => {
  assert.deepStrictEqual(fokusZiel({ fuehrung: '.ka[data-id="1"]', vorher: { stand: 'gehalten' } }), []);
});

test('fokusZiel: Rückgabe beim Schließen gilt auch, wenn vorher nichts fokussiert war', () => {
  const geschlossen = ebenen({ view: 'board', offen: 1 })[0];
  assert.deepStrictEqual(fokusZiel({ geschlossen, fuehrung: '.ka[data-id="2"]', vorher: { stand: 'nichts' } }), ['.ka[data-id="1"]']);
});

test('ohneRollen: der Dialog selbst nie; dasselbe Element nur, wenn es vorher außer Sicht lag', () => {
  const karte = '.ka[data-id="1"]';
  assert.strictEqual(ohneRollen('#fenster', { stand: 'nichts' }), true, 'Startziel des Aufgabenfensters');
  assert.strictEqual(ohneRollen(karte, { stand: 'verloren', selektor: karte, sichtbar: false }), true, 'weggescrollt: Halten holt die Karte nicht zurück');
  assert.strictEqual(ohneRollen(karte, { stand: 'verloren', selektor: karte, sichtbar: true }), false, 'im Blick: darf nachrücken, etwa nach dem Verschieben');
  assert.strictEqual(ohneRollen(karte, { stand: 'verloren', selektor: '#fenster', sichtbar: false }), false, 'Rückgabe an den Auslöser darf scrollen');
  assert.strictEqual(ohneRollen(karte, { stand: 'verloren', selektor: '.ka[data-id="2"]', sichtbar: false }), false, 'anderes Ziel als vorher darf scrollen');
  assert.strictEqual(ohneRollen(karte, { stand: 'nichts', selektor: null, sichtbar: false }), false);
});

test('ebenen: Reihenfolge von unten nach oben, Kontextmenü über Pop über Dialogstapel', () => {
  assert.deepStrictEqual(arten({}), []);
  assert.deepStrictEqual(arten({ offen: 1, setup: {} }), [], 'im Einrichten zeigt das Fenster nicht');
  assert.deepStrictEqual(arten({ offen: 1, zuweisen: {}, hilfe: true, pop: 'mehr', menue: {} }), ['fenster', 'zuweisen', 'hilfe', 'pop', 'kmenue']);
  assert.deepStrictEqual(arten({ neu: {}, offenDefekt: 9 }), ['neu', 'defekt']);
});

test('ebenen: Dialoge sind modal, Menüs nicht; Rückgabe aus dem gemerkten Auslöser', () => {
  const liste = ebenen({ offen: 1, view: 'board', pop: 'mehr' }, { pop: '#t-mehr' });
  assert.deepStrictEqual(liste.map(ebene => ebene.modal), [true, false]);
  assert.deepStrictEqual(liste[1].rueckgabe, ['#t-mehr']);
  assert.deepStrictEqual(ebenen({ hilfe: true })[0].rueckgabe, [], 'ohne gemerkten Auslöser keine Rückgabe');
});

test('fallenSchritt: Umlauf an beiden Rändern', () => {
  assert.strictEqual(fallenSchritt(5, 4, false), 0);
  assert.strictEqual(fallenSchritt(5, 0, true), 4);
  assert.strictEqual(fallenSchritt(5, 2, false), 3);
  assert.strictEqual(fallenSchritt(5, 2, true), 1);
  assert.strictEqual(fallenSchritt(5, -1, false), 0, 'Fokus außerhalb der Ebene: vorwärts zum ersten');
  assert.strictEqual(fallenSchritt(5, -1, true), 4, 'Fokus außerhalb der Ebene: rückwärts zum letzten');
  assert.strictEqual(fallenSchritt(0, 0, false), -1, 'nichts Tabbares');
});

test('ebenen: die Hilfe hat nichts Tabbares und startet auf sich selbst', () => {
  assert.strictEqual(ebenen({ hilfe: true })[0].start, '#hilfe');
});

test('ebenen: Kontextmenü startet auf dem aktiven Eintrag, bei offenem Untermenü auf dessen Eintrag', () => {
  assert.strictEqual(ebenen({ menue: { index: 2, unter: null } })[0].start, '#kmenue [data-mp="2"]');
  assert.strictEqual(ebenen({ menue: { index: 4, unter: { von: 4, index: 1 } } })[0].start, '#kmenue [data-mp="4.1"]');
});

// Fokusführung als einziger Ort für Fokus nach dem Neuzeichnen (B0389): .focus() nur im Sicherer, im Kleber und in Tastenzweigen
const fs = require('node:fs');
const path = require('node:path');
const WEB = path.join(__dirname, '../../web');
/** Erlaubte Anzahl .focus()-Aufrufe je Funktion (PO-Entscheidung Z. 109): ein zusätzlicher Aufruf in einer erlaubten Funktion ist ebenso ein Befund. */
const ERLAUBT = new Map([
  ['fokusSetzen', 1], ['fokusVersuchen', 1], ['ersterTabbarer', 1], ['fallenTaste', 1], ['popMenueTaste', 1], ['gewaehltesRadioFokussieren', 1],
  ['fensterTaste', 1], ['listenTaste', 1], ['brettTaste', 1], ['keydown', 1],
]);
const ANFANG = /^\s*function (\w+)\(|^document\.addEventListener\('(keydown)'|^(?:document|window)\.addEventListener\('(\w+)'|^(?:const|let|var) (\w+) = (?:async )?(?:\([^)]*\)|\w+) =>/;
/** Eine andere Zeile auf oberster Ebene beendet die umgebende Funktion — außer schließende Klammer, Kommentar und Fortsetzung. */
const OBERSTE_EBENE = /^(?![\s}/*)\]]|$)/;

/** Quelltexte von web/*.js als { datei, text }. */
const webQuellen = () => fs.readdirSync(WEB).filter(n => n.endsWith('.js')).map(datei => ({ datei, text: fs.readFileSync(path.join(WEB, datei), 'utf8') }));

/** Je .focus()-Aufruf: Datei, Zeile, die umgebende Funktion bzw. das Ereignis des Listeners und die vorige nicht leere Zeile. */
function fokusAufrufe(quellen = webQuellen()) {
  const funde = [];
  for (const { datei, text } of quellen) {
    let umgebend = '(oben)', vorige = '';
    text.split('\n').forEach((zeile, i) => {
      const anfang = ANFANG.exec(zeile);
      if (anfang) umgebend = anfang[1] || anfang[2] || anfang[3] || anfang[4];
      else if (OBERSTE_EBENE.test(zeile)) umgebend = '(oben)';
      if (zeile.includes('.focus(')) funde.push({ ort: `${datei}:${i + 1}`, umgebend, zeile, vorige });
      if (zeile.trim()) vorige = zeile;
    });
  }
  return funde;
}

/** Aufrufe außerhalb der erlaubten Funktionen und jeder Aufruf über der erlaubten Anzahl seiner Funktion. */
function fremdeFokusaufrufe(quellen) {
  const gezaehlt = new Map();
  return fokusAufrufe(quellen).filter(f => {
    gezaehlt.set(f.umgebend, (gezaehlt.get(f.umgebend) || 0) + 1);
    return gezaehlt.get(f.umgebend) > (ERLAUBT.get(f.umgebend) || 0);
  }).map(f => `${f.ort} in ${f.umgebend}`);
}
const RENDER_DANN_FOKUS = /render\(\);[^;]*\.focus\(/;
const fokusNachRender = quellen => fokusAufrufe(quellen).filter(f => RENDER_DANN_FOKUS.test(f.zeile) || /render\(\);\s*$/.test(f.vorige)).map(f => f.ort);

test('Fokusaufrufe: .focus() nur in Sicherer, Kleber und Tastenzweigen', () => {
  assert.deepStrictEqual(fremdeFokusaufrufe(), []);
});

test('Fokusaufrufe: kein .focus() direkt nach render() — das Ziel geht über S.ui.fokus in die Rangfolge', () => {
  assert.deepStrictEqual(fokusNachRender(), []);
});

/** web/app.js mit `einschub` hinter der Zeile, die `nach` enthält bzw. — mit `hinterEnde` — hinter dem Ende jener Funktion. */
function appMit(einschub, nach, hinterEnde = false) {
  const text = fs.readFileSync(path.join(WEB, 'app.js'), 'utf8');
  const anfang = text.indexOf(nach);
  assert.ok(anfang >= 0, nach);
  const stelle = hinterEnde ? text.indexOf('\n}\n', anfang) + 3 : text.indexOf('\n', anfang) + 1;
  return [{ datei: 'app.js', text: text.slice(0, stelle) + einschub + text.slice(stelle) }];
}

test('Wächter erkennt eine Pfeilfunktion auf oberster Ebene mit .focus() hinter einem erlaubten Tastenzweig', () => {
  const quellen = appMit("const springe = () => { $('#neu-titel').focus(); };\n", 'function fensterTaste(e) {', true);
  assert.deepStrictEqual(fremdeFokusaufrufe(quellen).map(f => f.replace(/:\d+/, '')), ['app.js in springe']);
});

test('Wächter erkennt einen zweiten .focus() in brettTaste', () => {
  const quellen = appMit("  $('#flt').focus();\n", 'function brettTaste(e, t) {');
  assert.deepStrictEqual(fremdeFokusaufrufe(quellen).map(f => f.replace(/:\d+/, '')), ['app.js in brettTaste']);
});

test('Wächter erkennt .focus() in der Zeile nach render();', () => {
  const quellen = appMit("  render();\n  $('#neu-titel').focus();\n", 'function fensterTaste(e) {');
  assert.strictEqual(fokusNachRender(quellen).length, 1);
});

test('fensterRand: Tab am letzten Element schließt nach vorn, Umschalt+Tab am ersten zum Auslöser, dazwischen weiter', () => {
  assert.strictEqual(fensterRand(3, 2, false), 'nach-ausloeser');
  assert.strictEqual(fensterRand(3, 0, true), 'ausloeser');
  assert.strictEqual(fensterRand(3, 1, false), 'weiter');
  assert.strictEqual(fensterRand(3, 1, true), 'weiter');
  assert.strictEqual(fensterRand(3, 0, false), 'weiter');
  assert.strictEqual(fensterRand(3, 2, true), 'weiter');
  assert.strictEqual(fensterRand(1, 0, false), 'nach-ausloeser', 'ein Element: Tab schließt');
  assert.strictEqual(fensterRand(0, -1, false), 'nach-ausloeser', 'nichts Tabbares: Tab schließt');
});

test('ebenen: Board-, Lauf- und Defekte-Dateien-Pop sind nicht-modale Fenster ohne eigenes Startziel, die Menüs nicht', () => {
  for (const pop of ['board', 'lauf', 'defekt']) {
    const ebene = ebenen({ pop })[0];
    assert.deepStrictEqual([ebene.modal, ebene.fenster, ebene.start], [false, true, null], pop);
  }
  for (const pop of ['mehr', 'ich', 'seite', 'ber']) assert.strictEqual(ebenen({ pop })[0].fenster, false, pop);
});

test('ebenen: das Ich-Menü startet auf dem gewählten Eintrag, ohne Wahl auf dem ersten wählbaren', () => {
  const ich = ebenen({ pop: 'ich' })[0];
  const ziele = fokusZiel({ geoeffnet: ich, oberste: ich });
  assert.deepStrictEqual(ziele, ['#pop [role="menuitemradio"][aria-checked="true"]', '#pop [role^="menuitem"]:not([aria-disabled="true"])']);
});

// Menüs mit echtem DOM-Fokus (R00106 „Menüs“, ADR-0010): jeder wählbare Eintrag ist per .focus() erreichbar und kein eigener Tab-Halt
/** Je Element mit role="menuitem…" in einem Quelltext: Zeile und der öffnende Tag (bis zum ersten „>“, das kein „=>“ ist). */
function menueEintraege(quelltext) {
  const funde = [];
  const muster = /role="menuitem\w*"/g;
  let treffer;
  while ((treffer = muster.exec(quelltext))) {
    const anfang = quelltext.lastIndexOf('<', treffer.index);
    let ende = quelltext.indexOf('>', treffer.index);
    while (ende > 0 && quelltext[ende - 1] === '=') ende = quelltext.indexOf('>', ende + 1);
    const zeile = quelltext.slice(0, treffer.index).split('\n').length;
    funde.push({ zeile, tag: quelltext.slice(anfang, ende + 1) });
  }
  return funde;
}

/** Ausnahme laut R00106 „Pfeiltasten“: Einträge mit aria-disabled="true" (Ich-Menü „aus“, Agenten) sind nicht wählbar und bekommen keinen Fokus. */
const NICHT_WAEHLBAR = /aria-disabled="true"/;
const EIGENER_FOKUS_OHNE_TAB_HALT = /tabindex="-1"/;

test('Menüs: jeder wählbare menuitem-Eintrag in web/ansicht.js trägt tabindex="-1" (Ausnahme: aria-disabled="true")', () => {
  const quelltext = fs.readFileSync(path.join(WEB, 'ansicht.js'), 'utf8');
  const eintraege = menueEintraege(quelltext);
  assert.ok(eintraege.length >= 10, `zu wenige Einträge gefunden: ${eintraege.length}`);
  const ohne = eintraege.filter(e => !NICHT_WAEHLBAR.test(e.tag) && !EIGENER_FOKUS_OHNE_TAB_HALT.test(e.tag));
  assert.deepStrictEqual(ohne.map(e => `ansicht.js:${e.zeile} ${e.tag.slice(0, 90)}`), []);
});

test('Menüs: die Prüfung erkennt einen Eintrag ohne tabindex und lässt einen nicht wählbaren durch', () => {
  const probe = '<div class="iz" data-act="x" role="menuitem">a</div>\n<div class="iz aus" role="menuitemradio" aria-disabled="true">b</div>\n<button type="button" role="menuitem" tabindex="-1" ${x ? \'a\' : \'\'}>c</button>';
  const ohne = menueEintraege(probe).filter(e => !NICHT_WAEHLBAR.test(e.tag) && !EIGENER_FOKUS_OHNE_TAB_HALT.test(e.tag));
  assert.deepStrictEqual(ohne.map(e => e.zeile), [1]);
});

test('Menüs: jeder role="menu"-Container in web/ansicht.js hat einen zugänglichen Namen (aria-label oder aria-labelledby)', () => {
  const quelltext = fs.readFileSync(path.join(WEB, 'ansicht.js'), 'utf8');
  const menues = [...quelltext.matchAll(/<[a-z]+ [^<>]*role="menu"[^<>]*>/g)].map(t => ({ zeile: quelltext.slice(0, t.index).split('\n').length, tag: t[0] }));
  assert.ok(menues.length >= 7, `zu wenige Menüs gefunden: ${menues.length}`);
  const namenlos = menues.filter(m => !/aria-label(ledby)?="/.test(m.tag));
  assert.deepStrictEqual(namenlos.map(m => `ansicht.js:${m.zeile} ${m.tag.slice(0, 70)}`), []);
});
