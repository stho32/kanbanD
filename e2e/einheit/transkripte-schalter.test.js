// R00220 B1136: Wahl und Wirkung je Board und die Sätze an der Zeile — reine Rechnung aus web/transkripte-schalter.js.
const test = require('node:test');
const assert = require('node:assert');
const { schalterWahl, schalterWirkung, schalterRumpf, schalterErfolgsSatz, schalterFehlerSatz, schalterWirkungText } = require('../../web/transkripte-schalter.js');

test('Vorgabe des Ordners: fehlt der Schlüssel, ist „aus“ gewählt', () => {
  assert.strictEqual(schalterWahl(null, null), 'aus');
  assert.strictEqual(schalterWahl(null, false), 'aus');
  assert.strictEqual(schalterWahl(null, true), 'an');
});

test('Board: alle neun Paare aus Vorgabe und Board-Wert ergeben Wahl und Wirkung', () => {
  const erwartet = [
    // [vorgabe, board, wahl, wirkung]
    [null, null, 'vorgabe', false], [null, true, 'an', true], [null, false, 'aus', false],
    [false, null, 'vorgabe', false], [false, true, 'an', true], [false, false, 'aus', false],
    [true, null, 'vorgabe', true], [true, true, 'an', true], [true, false, 'aus', false],
  ];
  for (const [vorgabe, board, wahl, wirkung] of erwartet) {
    assert.deepStrictEqual([schalterWahl('zweit', board), schalterWirkung(vorgabe, board)], [wahl, wirkung], `Vorgabe ${vorgabe}, Board ${board}`);
  }
});

test('Wirkung als Wort (Wortlaut 22)', () => {
  assert.strictEqual(schalterWirkungText(true), 'erfasst');
  assert.strictEqual(schalterWirkungText(false), 'erfasst nicht');
});

test('Rumpf des PUT je Wahl: „wie Vorgabe“ ist null, an der Vorgabe gibt es kein null', () => {
  assert.deepStrictEqual(['vorgabe', 'an', 'aus'].map(w => schalterRumpf('zweit', w)), [{ erfassen: null }, { erfassen: true }, { erfassen: false }]);
  assert.deepStrictEqual(['an', 'aus'].map(w => schalterRumpf(null, w)), [{ erfassen: true }, { erfassen: false }]);
  assert.throws(() => schalterRumpf(null, 'vorgabe'));
});

test('Erfolgssatz nach der wirksamen Lage (Wortlaut 23), am Board und an der Vorgabe', () => {
  assert.strictEqual(schalterErfolgsSatz('zweit', true), 'Auf „zweit“ werden jetzt Transkripte erfasst.');
  assert.strictEqual(schalterErfolgsSatz('zweit', false), 'Auf „zweit“ werden keine Transkripte mehr erfasst.');
  assert.strictEqual(schalterErfolgsSatz(null, true), 'Für Boards ohne eigenen Wert werden jetzt Transkripte erfasst.');
  assert.strictEqual(schalterErfolgsSatz(null, false), 'Für Boards ohne eigenen Wert werden keine Transkripte mehr erfasst.');
});

test('Fremder Boardname: Bidi-Steuerzeichen fallen weg', () => {
  assert.strictEqual(schalterErfolgsSatz('a‮b⁦c', true), 'Auf „abc“ werden jetzt Transkripte erfasst.');
});

test('Fehlersatz (Wortlaut 24): mit Status und Meldung der Antwort, ohne Verbindung eigener Satz', () => {
  assert.strictEqual(schalterFehlerSatz({ status: 503, fehler: 'Git ist beschäftigt' }), 'Der Schalter ließ sich nicht umstellen: Git ist beschäftigt (503).');
  assert.strictEqual(schalterFehlerSatz({ status: 403, fehler: 'Den Schalter „Transkripte erfassen“ stellen nur Menschen um' }), 'Der Schalter ließ sich nicht umstellen: Den Schalter „Transkripte erfassen“ stellen nur Menschen um (403).');
  assert.strictEqual(schalterFehlerSatz({ status: 0, fehler: 'egal' }), 'Der Schalter ließ sich nicht umstellen: keine Verbindung zum Programm.');
  assert.strictEqual(schalterFehlerSatz({ status: 500, fehler: '' }), 'Der Schalter ließ sich nicht umstellen: unbekannter Fehler (500).');
});
