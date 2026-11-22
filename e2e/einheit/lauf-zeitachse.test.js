// R00239 B1245: Zeitachse rechnen — Stücke und Fächer aus der Auswertung (ADR-0041 N1 Punkt 2, „Durchsetzung“: 201 Stücke ergeben
// 200 Fächer). Rechenbeispiele T1 und T10 aus R00239, geprobt gegen das Modell des planers.
process.env.TZ = 'Europe/Berlin';
const test = require('node:test');
const assert = require('node:assert');
const { laufAuswerten } = require('../../web/lauf.js');
const { T1_ZEILEN } = require('../tests/laufansicht-t1.js');

const e = (nr, art, wer, zeit, text = 'x') => ({ nr, eintrag: { art, wer, text, zeit, name: null } });
const um = s => `2026-11-21T08:00:${String(s).padStart(2, '0')}+01:00`;
const ms = zeit => Date.parse(zeit);
const uhr = wert => new Date(wert).toTimeString().slice(0, 8);

/** T10 (R00239 Ausgangslage): Eintrag k mit `zeit` 10:00:00 + (k − 1) s, ungerade ein Aufruf von `agent`, gerade sein Ergebnis. */
function tLauf(anzahl, beginn) {
  const start = Date.parse(beginn);
  return Array.from({ length: anzahl }, (_, i) => {
    const zeit = new Date(start + i * 1000).toISOString();
    return i % 2 === 0 ? e(i + 1, 'werkzeugaufruf', 'agent', zeit, '{"command":"true"}') : e(i + 1, 'werkzeugergebnis', 'werkzeug', zeit, 'ok');
  });
}

test('AK 1 Rechenbeispiel T1: 9 Stücke in dieser Reihenfolge, verschmolzen über 0,5 s und über Nr 11 ohne Zeit', () => {
  const z = laufAuswerten(T1_ZEILEN, false).zeitachse;
  assert.strictEqual(z.erste, ms('2026-11-21T23:30:00+01:00'));
  assert.strictEqual(z.gesamt, 150000);
  assert.deepStrictEqual(z.stuecke.map(s => [s.art, s.dauer, uhr(s.ab)]), [
    ['warten', 1000, '23:30:00'], ['denken', 21000, '23:30:01'], ['werkzeug', 4000, '23:30:22'], ['denken', 4999, '23:30:26'],
    ['werkzeug', 1000, '23:30:30'], ['denken', 5500, '23:30:31'], ['werkzeug', 8000, '23:30:37'], ['warten', 65000, '23:30:45'],
    ['denken', 39501, '23:31:50'],
  ]);
  assert.strictEqual(z.faecher, null);
});

test('AK 1: ein Stück beginnt bei der ersten Zeit plus der Summe der Lücken davor — auch nach einer rückwärts laufenden Zeit', () => {
  const z = laufAuswerten([e(1, 'nachricht', 'agent', um(10)), e(2, 'werkzeugaufruf', 'agent', um(5)), e(3, 'werkzeugergebnis', 'werkzeug', um(9))], false).zeitachse;
  assert.deepStrictEqual(z.stuecke, [{ art: 'werkzeug', ab: ms(um(10)), dauer: 4000 }], 'die negative Lücke ergibt kein Stück, das Stück beginnt bei 08:00:10');
  assert.strictEqual(z.gesamt, 4000);
});

test('AK 1: eine Lücke von 0 ms zwischen zwei Denklücken ergibt ein einziges Denkstück', () => {
  const z = laufAuswerten([e(1, 'nachricht', 'mensch', um(0)), e(2, 'nachricht', 'agent', um(3)), e(3, 'werkzeugergebnis', 'werkzeug', um(3)), e(4, 'nachricht', 'agent', um(7))], false).zeitachse;
  assert.deepStrictEqual(z.stuecke.map(s => [s.art, s.dauer]), [['denken', 7000]]);
});

test('AK 1: benachbarte Lücken gleicher Art verschmelzen, verschiedene Art trennt', () => {
  const z = laufAuswerten([e(1, 'nachricht', 'mensch', um(0)), e(2, 'nachricht', 'mensch', um(2)), e(3, 'nachricht', 'mensch', um(5)), e(4, 'nachricht', 'agent', um(6)), e(5, 'nachricht', 'mensch', um(8))], false).zeitachse;
  assert.deepStrictEqual(z.stuecke.map(s => [s.art, s.dauer, s.ab - ms(um(0))]), [['warten', 5000, 0], ['denken', 1000, 5000], ['warten', 2000, 6000]]);
});

test('AK 2: keine Zeitachse bei „Dauer unbekannt“ und bei einer Gesamtdauer von 0 ms (zwei Einträge mit derselben Zeit)', () => {
  assert.strictEqual(laufAuswerten([e(1, 'nachricht', 'agent', um(1))], false).zeitachse, null);
  assert.strictEqual(laufAuswerten([e(1, 'nachricht', 'agent', um(1)), e(2, 'nachricht', 'mensch', um(1))], false).zeitachse, null);
  assert.strictEqual(laufAuswerten([], false).zeitachse, null);
});

test('AK 3 Rechenbeispiel T10: 201 Stücke ergeben 200 Fächer zu je 1.005 ms, 100 Werkzeuge und 100 Denken', () => {
  const z = laufAuswerten(tLauf(202, '2026-11-22T10:00:00+01:00'), false).zeitachse;
  assert.strictEqual(z.stuecke.length, 201);
  assert.strictEqual(z.faecher.length, 200);
  const erste = ms('2026-11-22T10:00:00+01:00');
  z.faecher.forEach((f, i) => {
    assert.strictEqual(f.ab, erste + 1005 * i, `Anfang von Fach ${i + 1}`);
    assert.strictEqual(f.bis, erste + 1005 * (i + 1), `Ende von Fach ${i + 1}`);
  });
  const fach = i => { const f = z.faecher[i - 1]; return [f.art, uhr(f.ab), uhr(f.bis)]; };
  assert.deepStrictEqual(fach(1), ['werkzeug', '10:00:00', '10:00:01']);
  assert.deepStrictEqual(fach(2), ['denken', '10:00:01', '10:00:02']);
  assert.deepStrictEqual(fach(100), ['denken', '10:01:39', '10:01:40']);
  assert.deepStrictEqual(fach(101), ['denken', '10:01:40', '10:01:41']);
  assert.deepStrictEqual(fach(200), ['werkzeug', '10:03:19', '10:03:21']);
  assert.strictEqual(z.faecher.filter(f => f.art === 'werkzeug').length, 100);
  assert.strictEqual(z.faecher.filter(f => f.art === 'denken').length, 100);
});

test('AK 3: T11 mit genau 200 Stücken hat keine Fächer', () => {
  const z = laufAuswerten(tLauf(201, '2026-11-22T10:30:00+01:00'), false).zeitachse;
  assert.strictEqual(z.stuecke.length, 200);
  assert.strictEqual(z.faecher, null);
});

test('AK 3: benachbarte Fächer derselben Art bleiben getrennt — immer 200', () => {
  const zeilen = [e(1, 'nachricht', 'mensch', um(0))];
  // 201 Stücke: ein langes Warten über fast die ganze Dauer, danach 200 kurze im Wechsel
  let t = Date.parse(um(0)) + 600000;
  zeilen.push(e(2, 'nachricht', 'mensch', new Date(t).toISOString()));
  for (let k = 0; k < 200; k++) { t += 1; zeilen.push(e(k + 3, k % 2 ? 'nachricht' : 'werkzeugergebnis', k % 2 ? 'agent' : 'werkzeug', new Date(t).toISOString())); }
  const z = laufAuswerten(zeilen, false).zeitachse;
  assert.strictEqual(z.stuecke.length, 201);
  assert.strictEqual(z.faecher.length, 200);
  assert.ok(z.faecher.slice(0, 199).every(f => f.art === 'warten'));
});

/** Zwei Arten, die in jedem Fach genau gleich viel Zeit haben: 201 Stücke zu je 1 s im Wechsel ergeben Fächer zu 1.005 ms; mit
    Stücken zu 2 ms in Fächern zu 4 ms teilt sich jedes Fach 2:2. */
function gleichstand(artA, artB) {
  const wer = { werkzeug: ['werkzeugergebnis', 'werkzeug'], denken: ['nachricht', 'agent'], warten: ['nachricht', 'mensch'] };
  const zeilen = [e(1, 'nachricht', 'mensch', new Date(0).toISOString())];
  for (let k = 0; k < 400; k++) {
    const [art, w] = wer[k % 2 ? artB : artA];
    zeilen.push(e(k + 2, art, w, new Date((k + 1) * 2).toISOString()));
  }
  return laufAuswerten(zeilen, false).zeitachse;
}

test('AK 3: Gleichstand im Fach — Werkzeuge vor Denken, Denken vor Warten, Werkzeuge vor Warten', () => {
  for (const [a, b, sieger] of [['werkzeug', 'denken', 'werkzeug'], ['denken', 'werkzeug', 'werkzeug'], ['denken', 'warten', 'denken'], ['warten', 'denken', 'denken'], ['warten', 'werkzeug', 'werkzeug']]) {
    const z = gleichstand(a, b);
    assert.strictEqual(z.stuecke.length, 400, `${a}/${b}`);
    assert.strictEqual(z.faecher.length, 200);
    assert.ok(z.faecher.every(f => f.art === sieger), `${a}/${b} → ${sieger}`);
  }
});

test('AK 3: T3 bis zur Grenze — 19.999 Stücke, 200 Fächer, Fach 1 „Werkzeuge, 08:00:00–08:01:39“', () => {
  const z = laufAuswerten(tLauf(20000, '2026-11-21T08:00:00+01:00'), true).zeitachse;
  assert.strictEqual(z.stuecke.length, 19999);
  assert.strictEqual(z.faecher.length, 200);
  assert.deepStrictEqual([z.faecher[0].art, uhr(z.faecher[0].ab), uhr(z.faecher[0].bis)], ['werkzeug', '08:00:00', '08:01:39']);
});
