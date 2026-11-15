// R00109 Selbstproben der Kulturproben (ADR-0013 Regel 5, AK 7): künstliche Seiten ohne kanbanD, jede Regel positiv und negativ.
const { test, expect } = require('@playwright/test');
const { isoFundstellen, beschriftungenPruefen, ausnahmenAbgleichen } = require('./kultur-hilfen');
const { FELDER } = require('../../web/kultur.js');

const funde = async (page, html) => {
  await page.setContent(html);
  return isoFundstellen(page, 'probe');
};
const orte = liste => liste.map(f => `${f.ort}: ${f.text}`);

test.describe('Selbstproben der ISO-Probe', () => {
  for (const text of ['2026-10-28', 'fällig 2026-10-28', '2026-10-28 14:05']) {
    test(`„${text}“ fällt im Text, im title und im aria-label`, async ({ page }) => {
      expect(orte(await funde(page, `<p>${text}</p>`))).toEqual([`Text: ${text}`]);
      expect(orte(await funde(page, `<span title="${text}">x</span>`))).toEqual([`title: ${text}`]);
      expect(orte(await funde(page, `<button aria-label="${text}">x</button>`))).toEqual([`aria-label: ${text}`]);
    });
  }

  test('ein Fund nennt Ansicht, Element und Text', async ({ page }) => {
    expect(await funde(page, '<div id="brett"><span class="due">2026-10-28</span></div>'))
      .toEqual([{ ansicht: 'probe', ort: 'Text', element: 'span.due', text: '2026-10-28' }]);
  });

  test('deutsche Formen, Kennungen und das Formatmuster bestehen', async ({ page }) => {
    for (const text of ['28.10.2026', '28.10.', 'R00108', 'kd:I0001', 'JJJJ-MM-TT', '28.10. 14:05']) {
      expect(await funde(page, `<p title="${text}" aria-label="${text}">${text}</p>`), text).toEqual([]);
    }
  });

  test('der Tooltip eines Diagramms (svg title) zählt als title', async ({ page }) => {
    expect(orte(await funde(page, '<svg width="40" height="20"><rect width="40" height="20"><title>2026-10-28 · 3 offen</title></rect></svg>')))
      .toEqual(['title: 2026-10-28 · 3 offen']);
  });

  test('Ausnahmen nach Regel 3: Reiter „Datei“, YAML-Vorschau, Wert des Datumsfelds — derselbe Text daneben fällt', async ({ page }) => {
    const html = '<pre id="dateitext">due: 2026-10-28</pre><pre class="yaml">start: 2026-10-01</pre>'
      + '<input type="date" value="2026-10-28" aria-label="Fälligkeit"><span>2026-10-29</span>';
    expect(orte(await funde(page, html))).toEqual(['Text: 2026-10-29']);
  });

  test('Unsichtbares zählt nicht, sichtbar Gewordenes schon', async ({ page }) => {
    const html = '<div id="m" hidden><span title="2026-10-28">2026-10-28</span></div>';
    expect(await funde(page, html)).toEqual([]);
    await page.locator('#m').evaluate(e => { e.hidden = false; });
    expect(orte(await isoFundstellen(page, 'probe'))).toEqual(['Text: 2026-10-28', 'title: 2026-10-28']);
  });

  test('Grenze: die heutige Kurzform „10-28 14:05“ passt nicht — US-2 und US-3 fangen sie', async ({ page }) => {
    expect(await funde(page, '<p>10-28 14:05</p>')).toEqual([]);
  });
});

test.describe('Selbstproben der Beschriftungsprobe', () => {
  // Zeile ohne Schlüssel: nur die Beschriftung; Zeile mit Schlüssel: Rahmen .kb, darin .k und darunter .sl (ADR-0013 N1)
  const zeile = (beschriftung, feld) => `<span class="k">${beschriftung}</span><span class="w">${feld}</span>`;
  const rahmen = (innen, feld) => `<span class="kb">${innen}</span><span class="w">${feld}</span>`;
  const mitSchluessel = (beschriftung, schluessel, feld) => rahmen(`<span class="k">${beschriftung}</span><span class="sl">${schluessel}</span>`, feld);
  const pruefen = async (page, ...zeilen) => {
    await page.setContent(`<div role="dialog" aria-label="probe"><div class="felder">${zeilen.join('')}</div></div>`);
    return beschriftungenPruefen(page.getByRole('dialog'), FELDER);
  };
  const verstoesse = felder => felder.flatMap(f => f.verstoesse.map(v => `${f.beschriftung}: ${v}`));
  const SPALTE = '<select aria-label="Spalte"></select>';

  test('(a) Rahmen mit „Spalte“ und darunter column, Feldname „Spalte“: besteht und meldet Beschriftung und Namen', async ({ page }) => {
    expect(await pruefen(page, mitSchluessel('Spalte', 'column', SPALTE)))
      .toEqual([{ beschriftung: 'Spalte', name: 'Spalte', verstoesse: [] }]);
  });

  test('(b) der Schlüssel im Element der Beschriftung fällt (Regel 4), auch als eigenes Kindelement von .k', async ({ page }) => {
    expect(verstoesse(await pruefen(page, rahmen('<span class="k">Spalte <span class="sl">column</span></span>', '<select aria-label="Spalte column"></select>'))))
      .toEqual(['Spalte column: Beschriftung enthält den Schlüssel column']);
    expect(verstoesse(await pruefen(page, zeile('Spalte column', SPALTE))))
      .toEqual(['Spalte column: Beschriftung enthält den Schlüssel column', 'Spalte column: Name „Spalte“ enthält die Beschriftung nicht']);
  });

  test('(c) ohne Schlüssel unter der Beschriftung fällt — als Rahmen ohne .sl, als nackte .k und mit dem Schlüssel erst in der Feldzelle', async ({ page }) => {
    const FEHLT = ['Spalte: Schlüssel column fehlt unter der Beschriftung'];
    expect(verstoesse(await pruefen(page, rahmen('<span class="k">Spalte</span>', SPALTE)))).toEqual(FEHLT);
    expect(verstoesse(await pruefen(page, zeile('Spalte', SPALTE)))).toEqual(FEHLT);
    expect(verstoesse(await pruefen(page, zeile('Spalte', `<span class="mono">column</span>${SPALTE}`)))).toEqual(FEHLT);
  });

  test('(d) ein falscher Schlüssel unter der Beschriftung fällt; „Anforderungen“ verlangt requirements', async ({ page }) => {
    expect(verstoesse(await pruefen(page, mitSchluessel('Spalte', 'class', SPALTE))))
      .toEqual(['Spalte: Schlüssel column fehlt unter der Beschriftung']);
    expect(verstoesse(await pruefen(page, mitSchluessel('Anforderungen', 'anforderungen', '<input aria-label="Anforderungen">'))))
      .toEqual(['Anforderungen: Schlüssel requirements fehlt unter der Beschriftung']);
    expect(verstoesse(await pruefen(page, mitSchluessel('Anforderungen', 'requirements', '<input aria-label="Anforderungen">')))).toEqual([]);
  });

  test('(e) ein Fenster ohne Feldzeile fällt — eine leere Liste wäre kein Beleg', async ({ page }) => {
    expect(verstoesse(await pruefen(page))).toEqual([': keine Feldzeile im Fenster']);
    await page.setContent('<div role="dialog" aria-label="probe"><p>nichts</p></div>');
    expect(verstoesse(await beschriftungenPruefen(page.getByRole('dialog'), FELDER))).toEqual([': keine Feldzeile im Fenster']);
  });

  test('(f) eine Zeile ohne Schlüssel bleibt einzeilig und besteht: „Ebene“, „wartet auf“; die Schlüsselform „reservation“ fällt (R00155 #87: „Signale“ trägt jetzt den Schlüssel signals)', async ({ page }) => {
    expect(await pruefen(page, zeile('Ebene', '<button aria-pressed="false" aria-label="Ebene Dialog">Dialog</button>'), zeile('wartet auf', '<a href="#">#2</a>'), zeile('reservation', '<span>Claude</span>')))
      .toEqual([{ beschriftung: 'Ebene', name: null, verstoesse: [] }, { beschriftung: 'wartet auf', name: null, verstoesse: [] },
        { beschriftung: 'reservation', name: null, verstoesse: ['Beschriftung ist der Schlüssel reservation'] }]);
  });

  test('(g) Knopfgruppe: ohne Gruppennamen fällt, als Gruppe „Zuständig“ besteht', async ({ page }) => {
    const knoepfe = '<button>Stefan</button><button>Claude</button>';
    expect(verstoesse(await pruefen(page, mitSchluessel('Zuständig', 'assignees', knoepfe))))
      .toEqual(['Zuständig: Knopfgruppe ohne Gruppennamen']);
    // wie im Aufgabenfenster: die Feldzelle selbst ist die Gruppe
    const kopf = '<span class="kb"><span class="k">Zuständig</span><span class="sl">assignees</span></span>';
    expect(verstoesse(await pruefen(page, `${kopf}<span class="w wrap" role="group" aria-label="Zuständig">${knoepfe}</span>`))).toEqual([]);
    expect(verstoesse(await pruefen(page, mitSchluessel('Zuständig', 'assignees', `<span role="group" aria-label="Zuständig">${knoepfe}</span>`)))).toEqual([]);
  });

  test('Beschriftung exakt ein Schlüssel fällt, Groß-/Kleinschreibung beachtet: „column“ und „labels“ fallen, „Labels“ besteht', async ({ page }) => {
    expect(verstoesse(await pruefen(page, zeile('column', '<select aria-label="column"></select>'))))
      .toEqual(['column: Beschriftung ist der Schlüssel column']);
    expect(verstoesse(await pruefen(page, zeile('labels', '<input aria-label="labels">'))))
      .toEqual(['labels: Beschriftung ist der Schlüssel labels']);
    expect(verstoesse(await pruefen(page, mitSchluessel('Labels', 'labels', '<input aria-label="Labels der neuen Aufgabe">')))).toEqual([]);
  });

  test('der Name muss die Beschriftung enthalten: „Neue Herkunft“ besteht, „origins“ fällt; label for und aria-labelledby zählen', async ({ page }) => {
    expect(verstoesse(await pruefen(page, mitSchluessel('Herkunft', 'origins', '<input aria-label="Neue Herkunft">')))).toEqual([]);
    expect(verstoesse(await pruefen(page, mitSchluessel('Herkunft', 'origins', '<input aria-label="origins">'))))
      .toEqual(['Herkunft: Name „origins“ enthält die Beschriftung nicht']);
    expect(verstoesse(await pruefen(page, '<span class="kb"><label class="k" for="f">Fällig</label><span class="sl">due</span></span><span class="w"><input id="f" type="date"></span>'))).toEqual([]);
    expect(verstoesse(await pruefen(page, '<span class="kb"><span class="k" id="b">Klasse</span><span class="sl">class</span></span><span class="w"><select aria-labelledby="b"></select></span>'))).toEqual([]);
    expect(verstoesse(await pruefen(page, mitSchluessel('Fällig', 'due', '<input type="date">'))))
      .toEqual(['Fällig: Name „“ enthält die Beschriftung nicht']);
  });

  test('ohne Namensprüfung (Einrichten, erster Start) zählen nur Beschriftung und Schlüssel', async ({ page }) => {
    await page.setContent(`<div role="dialog" aria-label="probe"><div class="felder">${mitSchluessel('Ich', 'ich', '<input aria-label="Kürzel">')}${zeile('Board', '<input aria-label="Board">')}</div></div>`);
    expect(verstoesse(await beschriftungenPruefen(page.getByRole('dialog'), FELDER, { namen: false })))
      .toEqual(['Board: Schlüssel board fehlt unter der Beschriftung']);
  });

  test('ein eingebettetes Formular mit eigenem Raster (neue Wirkung) ist keine Zeile des äußeren Rasters', async ({ page }) => {
    const form = `<div class="wirkung-form" role="group" aria-label="Neue Wirkung"><div class="felder">${zeile('Aktion', '<select aria-label="Aktion"></select>')}</div></div>`;
    expect((await pruefen(page, mitSchluessel('Spalte', 'column', SPALTE), form)).map(f => f.beschriftung)).toEqual(['Spalte', 'Aktion']);
  });
});


test.describe('Selbstprobe der Ausnahmeliste (FA 19)', () => {
  const fund = (element, text) => ({ ansicht: 'X', ort: 'Text', element, text });
  const liste = [{ ansicht: 'X', selektor: 'span.due', text: '2026-10-28', karte: '#99', grund: 'Probe' }];

  test('gelistete Fundstelle besteht, ungelistete bleibt offen, eine Ausnahme ohne Fundstelle schlägt Alarm', () => {
    expect(ausnahmenAbgleichen([fund('span.due', '2026-10-28')], liste, 'X')).toEqual({ offen: [], alarme: [] });
    expect(ausnahmenAbgleichen([fund('span.due', '2026-10-28'), fund('td', '2026-10-01')], liste, 'X').offen).toEqual([fund('td', '2026-10-01')]);
    expect(ausnahmenAbgleichen([], liste, 'X').alarme).toEqual(['span.due „2026-10-28“ in X: Fundstelle verschwunden — Eintrag aus AUSNAHMEN streichen (#99)']);
    expect(ausnahmenAbgleichen([fund('span.due', '2026-10-29')], liste, 'X').alarme).toHaveLength(1);
    expect(ausnahmenAbgleichen([], liste, 'Y')).toEqual({ offen: [], alarme: [] });
  });
});
