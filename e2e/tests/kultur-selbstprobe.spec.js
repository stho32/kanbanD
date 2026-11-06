// R00109 Selbstproben der Kulturproben (ADR-0013 Regel 5, AK 7): künstliche Seiten ohne kanbanD, jede Regel positiv und negativ.
const { test, expect } = require('@playwright/test');
const { isoFundstellen } = require('./kultur-hilfen');

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
