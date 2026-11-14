// Unit-Tests der Warteschlange eigener Änderungen (node --test), R00147 AK 10–12 / ADR-0025 Regel 3:
// das Kettenende ist in jedem Fall erfüllt, der Zähler geht in jedem Fall herunter, je Fehlschlag genau eine Meldung.
const test = require('node:test');
const assert = require('node:assert');
const { warteschlangeFuehren } = require('../../web/warteschlange.js');

/** Eine Kette mit Zählern; `laden` und die Anfragen kommen aus dem Test. */
function ketteMit({ laden } = {}) {
  const meldungen = [], gespeichert = [], vorLaden = [], gelaufen = [];
  const kette = warteschlangeFuehren({
    laden,
    melden: (art, fehler) => meldungen.push({ art, fehler }),
    gespeichert: (ergebnis, ausloeser) => gespeichert.push({ ergebnis, ausloeser }),
    vorLaden: ausloeser => vorLaden.push(ausloeser),
  });
  return {
    kette, meldungen, gespeichert, vorLaden, gelaufen,
    // `verhalten` läuft, wenn die eigene Anfrage an der Reihe ist; `gelaufen` merkt die Reihenfolge
    einreihen: (verhalten = () => { }, ausloeser) => kette.einreihen(() => {
      const n = gelaufen.length;
      gelaufen.push(n);
      return verhalten(n);
    }, ausloeser),
  };
}

test('AK 10: ein geworfenes Laden lässt die nächste eigene Anfrage laufen und endet erfüllt', async () => {
  let ladungen = 0;
  const k = ketteMit({ laden: async () => { ladungen++; if (ladungen === 1) throw new Error('weg'); } });
  await assert.doesNotReject(k.einreihen(), 'die Kette muss erfüllt enden');
  assert.strictEqual(k.kette.offen(), 0, 'der Zähler endet nach dem Fehlschlag bei 0');
  assert.deepStrictEqual(k.meldungen.map(m => m.art), ['laden'], 'genau eine Nachlade-Meldung');
  // die nächste eigene Anfrage läuft, obwohl das vorige Nachladen geworfen hat
  await assert.doesNotReject(k.einreihen(), 'auch die zweite Kette endet erfüllt');
  assert.deepStrictEqual(k.gelaufen, [0, 1], 'beide Anfragen sind gelaufen');
  assert.strictEqual(ladungen, 2, 'je leer gewordener Kette einmal laden');
  assert.deepStrictEqual(k.meldungen.map(m => m.art), ['laden'], 'kein zweiter Fehlschlag, keine zweite Meldung');
});

test('AK 11: gelingt das Nachladen, laufen die Anfragen in Reihenfolge und es wird einmal geladen', async () => {
  const reihenfolge = [];
  const k = ketteMit({ laden: async () => { reihenfolge.push('laden'); } });
  const a = k.einreihen(async () => { reihenfolge.push('a'); });
  const b = k.einreihen(async () => { reihenfolge.push('b'); });
  await Promise.all([a, b]);
  assert.deepStrictEqual(reihenfolge, ['a', 'b', 'laden']);
  assert.deepStrictEqual(k.vorLaden, [undefined], 'die Marke wird vor dem Laden gesetzt, einmal');
  assert.strictEqual(k.meldungen.length, 0);
  assert.strictEqual(k.gespeichert.length, 2, 'jede angenommene Änderung setzt die Speicherzeit');
});

test('AK 12: der Zähler geht auch herunter, wenn das Nachladen wirft', async () => {
  const k = ketteMit({ laden: async () => { throw new Error('weg'); } });
  await assert.doesNotReject(k.einreihen());
  assert.strictEqual(k.kette.offen(), 0);
});

test('AK 8: scheitern eigene Anfrage und Nachladen, gibt es genau eine Meldung — die eigene', async () => {
  const fehler = new Error('Keine Verbindung zum Server — nichts geändert.');
  const k = ketteMit({ laden: async () => { throw new Error('Ansicht weg'); } });
  await assert.doesNotReject(k.einreihen(async () => { throw fehler; }));
  assert.strictEqual(k.meldungen.length, 1, 'genau eine Meldung je Fehlschlag');
  assert.strictEqual(k.meldungen[0].art, 'anfrage');
  assert.strictEqual(k.meldungen[0].fehler, fehler, 'sie nennt die gescheiterte eigene Anfrage');
  assert.strictEqual(k.kette.offen(), 0);
});

test('eine gescheiterte eigene Anfrage blockiert die folgende nicht und meldet sie einzeln', async () => {
  const k = ketteMit({ laden: async () => { } });
  await assert.doesNotReject(k.einreihen(async () => { throw new Error('erste'); }));
  await assert.doesNotReject(k.einreihen(async () => { }));
  assert.deepStrictEqual(k.gelaufen, [0, 1]);
  assert.deepStrictEqual(k.meldungen.map(m => m.art), ['anfrage']);
  assert.strictEqual(k.gespeichert.length, 1, 'nur die angenommene Änderung setzt die Speicherzeit');
});

test('der Auslöser wird an die Meldung durchgereicht', async () => {
  const meldungen = [];
  const kette = warteschlangeFuehren({
    laden: async () => { throw new Error('weg'); },
    melden: (art, fehler, ausloeser) => meldungen.push({ art, ausloeser }),
  });
  await assert.doesNotReject(kette.einreihen(() => { }, 'fenster'));
  assert.deepStrictEqual(meldungen, [{ art: 'laden', ausloeser: 'fenster' }]);
});
test('R00148: `nachAnfrage` läuft, sobald die Anfrage beantwortet ist — vor dem Nachladen, auch bei einem Fehlschlag', async () => {
  const reihe = [];
  const kette = warteschlangeFuehren({
    laden: async () => { reihe.push('laden'); },
    melden: () => { },
  });
  await kette.einreihen(async () => { reihe.push('anfrage'); }, 'board', () => reihe.push('antwort'));
  assert.deepStrictEqual(reihe, ['anfrage', 'antwort', 'laden']);
  const mitFehler = [];
  const zweite = warteschlangeFuehren({ laden: async () => { mitFehler.push('laden'); }, melden: () => { } });
  await assert.doesNotReject(zweite.einreihen(async () => { mitFehler.push('anfrage'); throw new Error('weg'); }, 'board', () => mitFehler.push('antwort')));
  assert.deepStrictEqual(mitFehler, ['anfrage', 'antwort', 'laden'], 'die Sperre endet auch bei einem Fehlschlag mit der Antwort');
});

test('R00148 S1: wirft der Haken `nachAnfrage`, bleibt die Kette offen — beide Anfragen laufen, einmal geladen, offen 0', async () => {
  const reihe = [], konsole = [];
  const vorher = console.error;
  console.error = (...teile) => konsole.push(teile.join(' '));
  try {
    const kette = warteschlangeFuehren({ laden: async () => { reihe.push('laden'); }, melden: () => { } });
    const erste = kette.einreihen(async () => { reihe.push('a1'); }, 'board', () => { throw new Error('Haken kaputt'); });
    const zweite = kette.einreihen(async () => { reihe.push('a2'); }, 'board');
    await assert.doesNotReject(erste);
    await assert.doesNotReject(zweite);
    assert.deepStrictEqual(reihe, ['a1', 'a2', 'laden']);
    assert.strictEqual(kette.offen(), 0);
    assert.strictEqual(konsole.length, 1, 'der Fehler des Hakens bleibt sichtbar');
  } finally { console.error = vorher; }
});
