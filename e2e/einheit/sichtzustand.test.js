// Unit-Tests der Schlüsselregel des Sichtzustands (R00103, ADR-0007, node --test)
const test = require('node:test');
const assert = require('node:assert');
const { schluessel } = require('../../web/sichtzustand.js');

/** Zählt Treffer eines Selektors im Bereich aus einer festen Tabelle; was nicht drinsteht, kommt einmal vor. */
const bereichMit = anzahlJeSelektor => selektor => {
  if (selektor in anzahlJeSelektor) return anzahlJeSelektor[selektor];
  return 1;
};
const element = ({ id = '', daten = {}, klassen = [], href = null }) => ({ id, daten, klassen, href });

test('id ist der Schlüssel', () => {
  assert.strictEqual(schluessel(element({ id: 'km-inp', klassen: ['inp'] }), bereichMit({})), '[id="km-inp"]');
});

test('data-halt ist der Schlüssel, wenn keine id da ist', () => {
  assert.strictEqual(schluessel(element({ daten: { halt: 'leiste' }, klassen: ['mod-side'] }), bereichMit({})), '[data-halt="leiste"]');
});

test('Feldschlüssel samt Wert, in der Reihenfolge af, nf, wf, wn, tf', () => {
  assert.strictEqual(schluessel(element({ daten: { af: 'titel' }, klassen: ['titel'] }), bereichMit({})), '[data-af="titel"]');
  assert.strictEqual(schluessel(element({ daten: { nf: 'board' } }), bereichMit({})), '[data-nf="board"]');
  assert.strictEqual(schluessel(element({ daten: { wf: 'aktion' } }), bereichMit({})), '[data-wf="aktion"]');
  assert.strictEqual(schluessel(element({ daten: { wn: 'ebene' } }), bereichMit({})), '[data-wn="ebene"]');
  assert.strictEqual(schluessel(element({ daten: { tf: 'name' } }), bereichMit({})), '[data-tf="name"]');
  assert.strictEqual(schluessel(element({ daten: { tf: 'name', af: 'labels' } }), bereichMit({})), '[data-af="labels"]', 'af vor tf');
});

test('Feldschlüssel der Berichte, des Fieber-Charts und der Einrichtung: fb, bf, dl, ef, sf, fr', () => {
  assert.strictEqual(schluessel(element({ daten: { fb: 'puffer' }, klassen: ['mini-inp', 'fb-zahl'] }), bereichMit({ '.mini-inp': 7, '.fb-zahl': 5 })), '[data-fb="puffer"]');
  assert.strictEqual(schluessel(element({ daten: { bf: 'von' }, klassen: ['mini-inp'] }), bereichMit({ '.mini-inp': 7 })), '[data-bf="von"]');
  assert.strictEqual(schluessel(element({ daten: { dl: 'dlSpalte' }, klassen: ['mini-inp'] }), bereichMit({ '.mini-inp': 7 })), '[data-dl="dlSpalte"]');
  assert.strictEqual(schluessel(element({ daten: { fr: 'name' }, klassen: ['mini-inp', 'full'] }), bereichMit({ '.mini-inp': 6, '.full': 5 })), '[data-fr="name"]');
});

test('Feldschlüssel einer Listenzeile tragen ihre Zeile: data-i gehört zum Schlüssel', () => {
  const bereich = bereichMit({ '[data-ef="pname"]': 3, '[data-sf="name"]': 4, '.inp': 9 });
  assert.strictEqual(schluessel(element({ daten: { ef: 'pname', i: '1' }, klassen: ['inp'] }), bereich), '[data-ef="pname"][data-i="1"]');
  assert.strictEqual(schluessel(element({ daten: { sf: 'name', i: '2' }, klassen: ['inp'] }), bereich), '[data-sf="name"][data-i="2"]');
  assert.strictEqual(schluessel(element({ daten: { ef: 'wbs' }, klassen: ['mini-inp'] }), bereichMit({ '.mini-inp': 4 })), '[data-ef="wbs"]', 'ohne Zeile der Feldschlüssel allein');
});

test('Aktion mit Argument, sonst Aktion allein', () => {
  assert.strictEqual(schluessel(element({ daten: { act: 'blaettern', arg: '1' }, klassen: ['btn'] }), bereichMit({ '.btn': 5 })), '[data-act="blaettern"][data-arg="1"]');
  assert.strictEqual(schluessel(element({ daten: { act: 'schliessen' }, klassen: ['btn'] }), bereichMit({ '.btn': 5 })), '[data-act="schliessen"]');
});

test('Zerstörender Knopf hält über data-halt, nie über die Stelle (R00138 AK 5, ADR-0007 N3 Regel 4)', () => {
  // eindeutiger Inhalt: der data-halt ist der Schlüssel
  assert.strictEqual(schluessel(element({ daten: { halt: 'teil-weg:zwei', act: 'teil-weg', arg: '1' } }), bereichMit({})), '[data-halt="teil-weg:zwei"]');
  // doppelter Inhalt: der Sicherer hält nichts — nicht die Stelle ([data-act][data-arg]) und nicht die Klasse
  const doppelt = bereichMit({ '[data-halt="teil-weg:zwei"]': 2 });
  assert.strictEqual(schluessel(element({ daten: { halt: 'teil-weg:zwei', act: 'teil-weg', arg: '1' } }), doppelt), '');
  assert.strictEqual(schluessel(element({ daten: { halt: 'teil-weg:zwei', act: 'teil-weg', arg: '1' }, klassen: ['x'] }), doppelt), '');
});

test('eine im Bereich eindeutige Klasse, die erste eindeutige gewinnt', () => {
  assert.strictEqual(schluessel(element({ klassen: ['mod-main'] }), bereichMit({})), '.mod-main');
  assert.strictEqual(schluessel(element({ klassen: ['flaeche', 'wbs-tabelle'] }), bereichMit({ '.flaeche': 3 })), '.wbs-tabelle');
});

test('Vorrang: id vor data-halt vor Feld vor Aktion vor Klasse', () => {
  const alles = { id: 'x', daten: { halt: 'h', af: 'titel', act: 'a', arg: '1' }, klassen: ['k'] };
  assert.strictEqual(schluessel(element(alles), bereichMit({})), '[id="x"]');
  assert.strictEqual(schluessel(element({ ...alles, id: '' }), bereichMit({})), '[data-halt="h"]');
  assert.strictEqual(schluessel(element({ ...alles, id: '', daten: { af: 'titel', act: 'a', arg: '1' } }), bereichMit({})), '[data-af="titel"]');
  assert.strictEqual(schluessel(element({ ...alles, id: '', daten: { act: 'a', arg: '1' } }), bereichMit({})), '[data-act="a"][data-arg="1"]');
});

test('Fehlfall: zwei Flächen derselben Klasse ohne weiteren Schlüssel haben keinen', () => {
  const zwei = bereichMit({ '.flaeche': 2 });
  assert.strictEqual(schluessel(element({ klassen: ['flaeche'] }), zwei), '');
  assert.strictEqual(schluessel(element({}), bereichMit({})), '', 'ohne alles kein Schlüssel');
});

test('Fehlfall: data-halt an der einen, nur die Klasse an der anderen — data-halt ist Schlüssel, die andere hat keinen', () => {
  const bereich = bereichMit({ '.flaeche': 2 });
  assert.strictEqual(schluessel(element({ daten: { halt: 'x' }, klassen: ['flaeche'] }), bereich), '[data-halt="x"]');
  assert.strictEqual(schluessel(element({ klassen: ['flaeche'] }), bereich), '');
});

test('ein mehrdeutiger Schlüssel fällt auf den nächsten zurück', () => {
  const bereich = bereichMit({ '[data-act="zustaendig"][data-arg="st"]': 2 });
  assert.strictEqual(schluessel(element({ daten: { act: 'zustaendig', arg: 'st' }, klassen: ['as', 'leiste-st'] }), bereich), '.as', 'die Aktion kommt zweimal vor');
});

test('Werte mit Anführungszeichen und Rückstrich bleiben ein gültiger Selektor', () => {
  assert.strictEqual(schluessel(element({ daten: { act: 'bewegen', arg: '{"nummer":1}' } }), bereichMit({})), '[data-act="bewegen"][data-arg="{\\"nummer\\":1}"]');
  assert.strictEqual(schluessel(element({ id: 'a\\b' }), bereichMit({})), '[id="a\\\\b"]');
  assert.strictEqual(schluessel(element({ daten: { halt: 'zwei\nzeilen' } }), bereichMit({})), '[data-halt="zwei\\a zeilen"]');
});

test('Klassen, die kein einfacher Selektor sind, zählen nicht als Schlüssel', () => {
  assert.strictEqual(schluessel(element({ klassen: ['w-1/2', 'bahn'] }), bereichMit({})), '.bahn');
  assert.strictEqual(schluessel(element({ klassen: ['3spaltig'] }), bereichMit({})), '');
});

test('href ist der Schlüssel eines Links ohne id, data-halt, Feld und Aktion — vor der Klasse', () => {
  const navigation = bereichMit({ '.an': 1 });
  assert.strictEqual(schluessel(element({ href: '#/personen', klassen: ['an'] }), navigation), '[href="#/personen"]', 'eindeutig: href vor der Klasse');
  assert.strictEqual(schluessel(element({ href: '/api/berichte/zeiten.csv' }), bereichMit({})), '[href="/api/berichte/zeiten.csv"]');
  assert.strictEqual(schluessel(element({ href: '#', daten: { act: 'pop', arg: 'ber' } }), bereichMit({})), '[data-act="pop"][data-arg="ber"]', 'Aktion vor href');
});

test('Fehlfall: ein mehrdeutiges href fällt auf die Klasse zurück; ohne href und ohne Klasse kein Schlüssel', () => {
  const zweiGleiche = bereichMit({ '[href="#"]': 2, '.kz-wbs': 1 });
  assert.strictEqual(schluessel(element({ href: '#', klassen: ['kz-wbs'] }), zweiGleiche), '.kz-wbs');
  assert.strictEqual(schluessel(element({ href: '#' }), zweiGleiche), '');
  assert.strictEqual(schluessel(element({ href: null }), bereichMit({})), '', 'fehlendes href ist kein Schlüssel');
  assert.strictEqual(schluessel(element({ href: '' }), bereichMit({})), '', 'leeres href ist kein Schlüssel');
});
