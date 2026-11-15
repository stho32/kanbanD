// Unit-Tests des einen Entwurfs je Aufgabenfenster (R00155 G-1, ADR-0015 N2; node --test): die abgelehnte Eingabe
// `{ nummer, feld, wert }` und der Verweis des Felds auf die Fenstermeldung.
const test = require('node:test');
const assert = require('node:assert');
const { entwurfswert, meldungsverweis, entwurfNachTippen, verwerfung, abgelehntesFeld } = require('../../web/sichtzustand.js');

const VERWEIS = ' aria-invalid="true" aria-describedby="fenster-meldung"';
const verweis = (entwurf, meldung, nummer, feld) => meldungsverweis(entwurf, meldung, nummer, feld, 'fenster-meldung');

test('entwurfswert: die abgelehnte Eingabe gehört zu genau einer Aufgabe und einem Feld', () => {
  const entwurf = { nummer: 1, feld: 'zeit', wert: 'abc' };
  assert.strictEqual(entwurfswert(entwurf, 1, 'zeit'), 'abc');
  assert.strictEqual(entwurfswert(entwurf, 2, 'zeit'), null, 'andere Aufgabe');
  assert.strictEqual(entwurfswert(entwurf, 1, 'herkunft'), null, 'anderes Feld');
  assert.strictEqual(entwurfswert(null, 1, 'zeit'), null, 'kein Entwurf');
});

test('entwurfswert: ein leer abgelehnter Titel ist ein Entwurf — leer ist nicht „keiner“', () => {
  assert.strictEqual(entwurfswert({ nummer: 1, feld: 'titel', wert: '' }, 1, 'titel'), '');
});

test('meldungsverweis: ungültig mit Verweis, solange die Meldung das Feld nennt und der Entwurf zu Aufgabe und Feld gehört', () => {
  assert.strictEqual(verweis({ nummer: 1, feld: 'herkunft', wert: 'X1' }, { text: '„X1“ ist keine Herkunft', feld: 'herkunft' }, 1, 'herkunft'), VERWEIS);
  assert.strictEqual(verweis({ nummer: 1, feld: 'titel', wert: '' }, { text: 'Die Aufgabe braucht einen Titel', feld: 'titel' }, 1, 'titel'), VERWEIS);
});

test('meldungsverweis: kein Verweis ohne Meldung, bei Meldung ohne Feld oder für ein anderes Feld, bei anderer Aufgabe, ohne Entwurf', () => {
  const entwurf = { nummer: 1, feld: 'herkunft', wert: 'X1' };
  assert.strictEqual(verweis(entwurf, { text: null, feld: null }, 1, 'herkunft'), '', 'Meldung gelöscht');
  assert.strictEqual(verweis(entwurf, { text: 'Anhang zu groß', feld: null }, 1, 'herkunft'), '', 'Meldung ohne Feld');
  assert.strictEqual(verweis(entwurf, { text: 'Dauer „abc“', feld: 'zeit' }, 1, 'herkunft'), '', 'Meldung eines anderen Felds');
  assert.strictEqual(verweis(entwurf, { text: '„X1“ ist keine Herkunft', feld: 'herkunft' }, 2, 'herkunft'), '', 'andere Aufgabe offen');
  assert.strictEqual(verweis(entwurf, { text: 'Dauer „abc“', feld: 'zeit' }, 1, 'zeit'), '', 'der eine Entwurf nennt ein anderes Feld');
  assert.strictEqual(verweis(null, { text: '„X1“ ist keine Herkunft', feld: 'herkunft' }, 1, 'herkunft'), '', 'kein Entwurf');
});

test('entwurfNachTippen: Getipptes hält den einen Platz — ohne Entwurf, über dem eigenen Entwurf und über dem einer anderen Aufgabe', () => {
  const getippt = { nummer: 1, feld: 'herkunft', wert: 'I00' };
  assert.deepStrictEqual(entwurfNachTippen(null, 1, 'herkunft', 'I00'), getippt);
  assert.deepStrictEqual(entwurfNachTippen({ nummer: 1, feld: 'herkunft', wert: 'X1' }, 1, 'herkunft', 'I00'), getippt, 'eigene Berichtigung');
  assert.deepStrictEqual(entwurfNachTippen({ nummer: 2, feld: 'zeit', wert: 'abc' }, 1, 'herkunft', 'I00'), getippt, 'Entwurf einer anderen Aufgabe');
});

test('entwurfNachTippen: Getipptes verdrängt nie die Eingabe eines anderen Felds derselben Aufgabe (R00155 G-2)', () => {
  const abgelehnteDauer = { nummer: 1, feld: 'zeit', wert: 'abc' };
  assert.strictEqual(entwurfNachTippen(abgelehnteDauer, 1, 'herkunft', 'I00'), abgelehnteDauer);
  const leererTitel = { nummer: 1, feld: 'titel', wert: '' };
  assert.strictEqual(entwurfNachTippen(leererTitel, 1, 'herkunft', 'I00'), leererTitel, 'leer ist auch eine Eingabe');
});

// Esc-Regel des Aufgabenfensters (R00155 #54, ADR-0010 N9): was das fokussierte Feld zu verwerfen hat
const feld = angaben => ({ af: undefined, id: '', wert: '', gezeichnet: '', imModus: false, haeltEntwurf: false, ...angaben });

test('verwerfung: der Titel im Bearbeiten verlässt den Modus — geändert wie unverändert — und nimmt den gezeichneten Stand an', () => {
  assert.deepStrictEqual(verwerfung(feld({ af: 'titel', wert: 'Abnahme geprüft', gezeichnet: 'Abnahme prüfen', imModus: true })), { wert: 'Abnahme prüfen', verlaesstModus: true, hatEntwurf: true });
  assert.deepStrictEqual(verwerfung(feld({ af: 'titel', wert: 'Abnahme prüfen', gezeichnet: 'Abnahme prüfen', imModus: true })), { wert: 'Abnahme prüfen', verlaesstModus: true, hatEntwurf: false });
});

test('verwerfung: Felder ohne Entwurf haben nichts zu verwerfen — Spalte, Klasse, Fällig', () => {
  for (const af of ['spalte', 'klasse', 'faellig']) assert.strictEqual(verwerfung(feld({ af, wert: 'x', gezeichnet: 'y' })), null, af);
});

test('verwerfung: Labels — geändert geht auf den gezeichneten Stand zurück, der Fokus bleibt; unverändert nichts zu verwerfen', () => {
  assert.deepStrictEqual(verwerfung(feld({ af: 'labels', wert: 'ui, daten, neu', gezeichnet: 'ui, daten' })), { wert: 'ui, daten', verlaesstModus: false, hatEntwurf: true });
  assert.strictEqual(verwerfung(feld({ af: 'labels', wert: 'ui, daten', gezeichnet: 'ui, daten' })), null);
});

test('verwerfung: Felder, die erst mit Enter schreiben — Getipptes und die abgelehnte Eingabe werden geleert; leer nichts zu verwerfen', () => {
  for (const id of ['herkunft-neu', 'teil-neu', 'zeit-neu', 'km-inp']) {
    assert.deepStrictEqual(verwerfung(feld({ id, wert: 'Entwurf' })), { wert: '', verlaesstModus: false, hatEntwurf: true }, id);
    assert.strictEqual(verwerfung(feld({ id, wert: '' })), null, id);
  }
  // die abgelehnte Eingabe ist als Stand gezeichnet — der Stand eines Enter-Felds ist trotzdem leer
  assert.deepStrictEqual(verwerfung(feld({ id: 'zeit-neu', wert: 'abc', gezeichnet: 'abc', haeltEntwurf: true })), { wert: '', verlaesstModus: false, hatEntwurf: true });
  // von Hand geleert, die Meldung steht noch: der Entwurf ist zu räumen
  assert.deepStrictEqual(verwerfung(feld({ id: 'herkunft-neu', wert: '', gezeichnet: 'X1', haeltEntwurf: true })), { wert: '', verlaesstModus: false, hatEntwurf: true });
});

test('verwerfung: andere Eingabefelder des Fensters fallen nicht unter die Regel, auch nicht geändert', () => {
  assert.strictEqual(verwerfung(feld({ id: 'z-beginn', wert: '09:00', gezeichnet: '08:00' })), null);
  assert.strictEqual(verwerfung(feld({ id: 'flt', wert: 'x' })), null);
});

test('verwerfung: Beschreibung mit Text im Bearbeiten verlässt den Modus — geändert wie unverändert (R00155 54B)', () => {
  const zurueckInsLesen = { wert: 'Erster Absatz', verlaesstModus: true };
  assert.deepStrictEqual(verwerfung(feld({ af: 'beschreibung', id: 'beschreibung', wert: 'Erster Absatz und mehr', gezeichnet: 'Erster Absatz', imModus: true })), { ...zurueckInsLesen, hatEntwurf: true });
  assert.deepStrictEqual(verwerfung(feld({ af: 'beschreibung', id: 'beschreibung', wert: 'Erster Absatz', gezeichnet: 'Erster Absatz', imModus: true })), { ...zurueckInsLesen, hatEntwurf: false });
});

test('verwerfung: leere Beschreibung hat keinen Lesezustand — Getipptes wird geleert, der Fokus bleibt; leer nichts zu verwerfen, auch nach der Taste b', () => {
  for (const imModus of [false, true]) {
    assert.deepStrictEqual(verwerfung(feld({ af: 'beschreibung', id: 'beschreibung', wert: 'Notiz', imModus })), { wert: '', verlaesstModus: false, hatEntwurf: true });
    assert.strictEqual(verwerfung(feld({ af: 'beschreibung', id: 'beschreibung', wert: '', imModus })), null);
  }
});

test('verwerfung: der leer abgelehnte Titel ist ein Entwurf, auch wenn Feld und gezeichneter Stand gleich leer sind (R00155 54-12)', () => {
  assert.deepStrictEqual(verwerfung(feld({ af: 'titel', wert: '', gezeichnet: '', imModus: true, haeltEntwurf: true })), { wert: '', verlaesstModus: true, hatEntwurf: true });
});

test('abgelehntesFeld: der eine Entwurf der offenen Aufgabe, solange die Meldung sein Feld nennt (Regel (2) des Knopfs)', () => {
  const dauer = { nummer: 1, feld: 'zeit', wert: 'abc' };
  assert.strictEqual(abgelehntesFeld(dauer, { text: 'Dauer „abc“', feld: 'zeit' }, 1), 'zeit');
  assert.strictEqual(abgelehntesFeld({ nummer: 1, feld: 'titel', wert: '' }, { text: 'Die Aufgabe braucht einen Titel', feld: 'titel' }, 1), 'titel');
});

test('abgelehntesFeld: null ohne Entwurf, bei anderer Aufgabe, ohne Meldung und bei nur Getipptem (die Meldung nennt das Feld nicht)', () => {
  const getippt = { nummer: 1, feld: 'herkunft', wert: 'I00' };
  assert.strictEqual(abgelehntesFeld(null, { text: 'Dauer „abc“', feld: 'zeit' }, 1), null);
  assert.strictEqual(abgelehntesFeld({ nummer: 2, feld: 'zeit', wert: 'abc' }, { text: 'Dauer „abc“', feld: 'zeit' }, 1), null);
  assert.strictEqual(abgelehntesFeld(getippt, { text: null, feld: null }, 1), null);
  assert.strictEqual(abgelehntesFeld(getippt, { text: 'Anhang zu groß', feld: null }, 1), null);
});
