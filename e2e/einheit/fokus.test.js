// Unit-Tests der Fokusführung über Ebenen (R00106, ADR-0010): node --test
const test = require('node:test');
const assert = require('node:assert');
const { ebenen, fallenSchritt, fokusZiel, fensterRand } = require('../../web/fokus.js');

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

test('fokusZiel: ohne Ebene führt fokusKarte bzw. fokusZeile', () => {
  assert.deepStrictEqual(fokusZiel({ fuehrung: '.ka[data-id="2"]' }), ['.ka[data-id="2"]']);
  assert.deepStrictEqual(fokusZiel({}), []);
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
const ERLAUBT = new Set(['fokusSetzen', 'fokusVersuchen', 'ersterTabbarer', 'fallenTaste', 'popMenueTaste', 'gewaehltesRadioFokussieren', 'fensterTaste', 'listenTaste', 'brettTaste', 'keydown']);
const ANFANG = /^\s*function (\w+)\(|^document\.addEventListener\('(keydown)'|^(?:document|window)\.addEventListener\('(\w+)'/;

/** Je .focus()-Aufruf in web/*.js: Datei, Zeile und die umgebende Funktion bzw. das Ereignis des Listeners. */
function fokusAufrufe() {
  const funde = [];
  for (const datei of fs.readdirSync(WEB).filter(n => n.endsWith('.js'))) {
    let umgebend = '(oben)';
    fs.readFileSync(path.join(WEB, datei), 'utf8').split('\n').forEach((zeile, i) => {
      const anfang = ANFANG.exec(zeile);
      if (anfang) umgebend = anfang[1] || anfang[2] || anfang[3];
      if (zeile.includes('.focus(')) funde.push({ ort: `${datei}:${i + 1}`, umgebend, zeile });
    });
  }
  return funde;
}

test('Fokusaufrufe: .focus() nur in Sicherer, Kleber und Tastenzweigen', () => {
  const fremd = fokusAufrufe().filter(f => !ERLAUBT.has(f.umgebend));
  assert.deepStrictEqual(fremd.map(f => `${f.ort} in ${f.umgebend}`), []);
});

test('Fokusaufrufe: kein .focus() direkt nach render() — das Ziel geht über S.ui.fokus in die Rangfolge', () => {
  const danach = fokusAufrufe().filter(f => /render\(\);[^;]*\.focus\(/.test(f.zeile));
  assert.deepStrictEqual(danach.map(f => f.ort), []);
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
