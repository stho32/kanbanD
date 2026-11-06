// R00109 Selbstproben der Kulturproben (ADR-0013 Regel 5, AK 7): künstliche Seiten ohne kanbanD, jede Regel positiv und negativ.
const { test, expect } = require('@playwright/test');
const { isoFundstellen, beschriftungenPruefen } = require('./kultur-hilfen');
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

  test('Grenze: die heutige Kurzform „10-28 14:05“ passt nicht — sie fangen US-2 und US-3', async ({ page }) => {
    expect(await funde(page, '<p>10-28 14:05</p>')).toEqual([]);
  });
});

test.describe('Selbstproben der Beschriftungsprobe', () => {
  const zeile = (beschriftung, feld) => `<span class="k">${beschriftung}</span><span class="w">${feld}</span>`;
  const pruefen = async (page, ...zeilen) => {
    await page.setContent(`<div role="dialog" aria-label="probe"><div class="felder">${zeilen.join('')}</div></div>`);
    return beschriftungenPruefen(page.getByRole('dialog'), FELDER);
  };
  const verstoesse = felder => felder.flatMap(f => f.verstoesse.map(v => `${f.beschriftung}: ${v}`));

  test('„Spalte“ mit Feldnamen „Spalte“ besteht und meldet Beschriftung und Namen', async ({ page }) => {
    expect(await pruefen(page, zeile('Spalte', '<select aria-label="Spalte"></select>')))
      .toEqual([{ beschriftung: 'Spalte', name: 'Spalte', verstoesse: [] }]);
  });

  test('Beschriftung exakt ein Schlüssel fällt, Groß/klein beachtet: „column“ und „labels“ fallen, „Labels“ besteht', async ({ page }) => {
    expect(verstoesse(await pruefen(page, zeile('column', '<select aria-label="column"></select>'))))
      .toEqual(['column: Beschriftung ist der Schlüssel column']);
    expect(verstoesse(await pruefen(page, zeile('labels', '<input aria-label="labels">'))))
      .toEqual(['labels: Beschriftung ist der Schlüssel labels']);
    expect(verstoesse(await pruefen(page, zeile('Labels', '<input aria-label="Labels der neuen Aufgabe">')))).toEqual([]);
  });

  test('„Spalte column“ in einem Element fällt (Regel 4); der Schlüssel als eigenes Element daneben besteht', async ({ page }) => {
    expect(verstoesse(await pruefen(page, zeile('Spalte column', '<select aria-label="Spalte"></select>'))))
      .toEqual(['Spalte column: Beschriftung enthält den Schlüssel column', 'Spalte column: Name „Spalte“ enthält die Beschriftung nicht']);
    expect(verstoesse(await pruefen(page, zeile('Spalte column', '<select aria-label="Spalte column"></select>'))))
      .toEqual(['Spalte column: Beschriftung enthält den Schlüssel column']);
    expect(verstoesse(await pruefen(page, zeile('Spalte', '<span class="mono">column</span><select aria-label="Spalte"></select>')))).toEqual([]);
  });

  test('der Name muss die Beschriftung enthalten: „Neue Herkunft“ besteht, „origins“ fällt; label for und aria-labelledby zählen', async ({ page }) => {
    expect(verstoesse(await pruefen(page, zeile('Herkunft', '<input aria-label="Neue Herkunft">')))).toEqual([]);
    expect(verstoesse(await pruefen(page, zeile('Herkunft', '<input aria-label="origins">'))))
      .toEqual(['Herkunft: Name „origins“ enthält die Beschriftung nicht']);
    expect(verstoesse(await pruefen(page, '<label class="k" for="f">Fällig</label><span class="w"><input id="f" type="date"></span>'))).toEqual([]);
    expect(verstoesse(await pruefen(page, '<span class="k" id="b">Klasse</span><span class="w"><select aria-labelledby="b"></select></span>'))).toEqual([]);
    expect(verstoesse(await pruefen(page, zeile('Fällig', '<input type="date">'))))
      .toEqual(['Fällig: Name „“ enthält die Beschriftung nicht']);
  });

  test('Knopfgruppe: ohne Gruppennamen fällt, als Gruppe „Zuständig“ besteht', async ({ page }) => {
    const knoepfe = '<button>Stefan</button><button>Claude</button>';
    expect(verstoesse(await pruefen(page, zeile('Zuständig', knoepfe))))
      .toEqual(['Zuständig: Knopfgruppe ohne Gruppennamen']);
    expect(verstoesse(await pruefen(page, zeile('Zuständig', `<span role="group" aria-label="Zuständig">${knoepfe}</span>`)))).toEqual([]);
  });

  test('eine reine Anzeige ohne Feld hat keinen Namen und besteht, wenn ihre Beschriftung deutsch ist', async ({ page }) => {
    expect(await pruefen(page, zeile('wartet auf', '<a href="#">#2</a>'), zeile('reservation', '<span>Claude</span>')))
      .toEqual([{ beschriftung: 'wartet auf', name: null, verstoesse: [] },
        { beschriftung: 'reservation', name: null, verstoesse: ['Beschriftung ist der Schlüssel reservation'] }]);
  });
});
