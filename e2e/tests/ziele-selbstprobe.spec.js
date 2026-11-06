// R00108 Selbstproben des Messhelfers (ADR-0012 Regel 6): künstliche Seiten ohne kanbanD.
const { test, expect } = require('@playwright/test');
const { zieleMessen, titelPruefen, breiteMessen, zieleImInhalt } = require('./ziele-hilfen');

const STIL = '<style>body{margin:0}button{all:unset;box-sizing:border-box;position:absolute;background:#ccc}</style>';
const knopf = (x, y, groesse, name, stil = '') => `<button aria-label="${name}" style="left:${x}px;top:${y}px;width:${groesse}px;height:${groesse}px;${stil}"></button>`;
const namen = verstoesse => verstoesse.map(v => v.name);

test.describe('Selbstproben, feiner Zeiger', () => {
  test('20 × 20 fällt durch, 24 × 24 besteht (Nachbarn Kante an Kante, die Kreis-Ausnahme greift nicht)', async ({ page }) => {
    await page.setContent(STIL + knopf(100, 100, 20, 'klein') + knopf(120, 100, 24, 'genug'));
    const verstoesse = await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' });
    expect(verstoesse).toEqual([{ ansicht: 'probe', selektor: 'button', name: 'klein', breite: 20, hoehe: 20, mass: 24, trifft: true }]);
  });

  test('Kreis-Ausnahme: zwei 20 × 20 mit Mitten 30 px bestehen, 24 px bestehen (Grenzwert), 20 px fallen', async ({ page }) => {
    await page.setContent(STIL + knopf(100, 100, 20, 'a30') + knopf(130, 100, 20, 'b30'));
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' })).toEqual([]);
    await page.setContent(STIL + knopf(100, 100, 20, 'a24') + knopf(124, 100, 20, 'b24'));
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' })).toEqual([]);
    await page.setContent(STIL + knopf(100, 100, 20, 'a20') + knopf(120, 100, 20, 'b20'));
    expect(namen(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' }))).toEqual(['a20', 'b20']);
  });

  const HOF = '<style>.hof{position:absolute;width:13px;height:13px}.hof::after{content:"";position:absolute;inset:min(0px, (100% - 24px) / 2)}</style>';

  test('ein ::after mit Zeichen (▾) ist kein Hof: gemessen wird nur das Element', async ({ page }) => {
    await page.setContent(STIL + '<style>.dek::after{content:"▾";position:absolute;right:-6px;bottom:-6px}</style>' + knopf(100, 100, 26, 'pfeil', '') .replace('<button', '<button class="dek"'));
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe', ohneKreis: true })).toEqual([]);
  });

  test('13-px-Zeichen mit Hof besteht, derselbe Hof unter overflow:hidden fällt durch', async ({ page }) => {
    await page.setContent(STIL + HOF + '<button class="hof" aria-label="frei" style="left:100px;top:100px"></button>');
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' })).toEqual([]);
    await page.setContent(STIL + HOF + '<div style="position:absolute;left:100px;top:100px;width:13px;height:13px;overflow:hidden"><button class="hof" aria-label="beschnitten" style="left:0;top:0"></button></div>');
    const verstoesse = await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' });
    expect(namen(verstoesse)).toEqual(['beschnitten']);
    expect(verstoesse[0].trifft).toBe(false);
  });

});

// Zielauswahl unter Touch gemessen: dort gibt es keine Kreis-Ausnahme, jedes gezählte kleine Ziel fällt auf.
test.describe('Selbstproben, Zielauswahl', () => {
  test.use({ hasTouch: true });

  test('ein Link allein in einer Zelle zählt, ein Link im Fließtext nicht', async ({ page }) => {
    await page.setContent('<table><tr><td><a href="#1">#1</a></td></tr></table><p>Siehe <a href="#2">zwei</a> im Text.</p>');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['#1']);
  });

  test('ein Link in einer Hervorhebung im Fließtext zählt nicht, ein Link allein in einem Absatz schon', async ({ page }) => {
    await page.setContent('<p>Maschinenlesbar: <b><a href="#1">eins</a></b> und mehr.</p><p><b><a href="#2">zwei</a></b></p>');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['zwei']);
  });

  test('ein Link, neben dem nur Elemente stehen, zählt: Zeile mit Größe und ✕, Zelle mit Etikett, Zeile mit Uhr und Titel', async ({ page }) => {
    await page.setContent('<div style="display:flex;align-items:center;gap:8px"><a href="#1">datei.txt</a><span>12 KB</span><button style="width:44px;height:44px">✕</button></div>'
      + '<table><tr><td><a href="#2">zwei</a> <span style="display:inline-flex">archiviert 2026-10-01</span></td></tr></table>'
      + '<div style="display:flex"><span>0:12</span><a href="#3">#3</a><span>drei</span></div>');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['datei.txt', 'zwei', '#3']);
  });

  test('ein Link in einem Satz zählt nicht, auch nicht neben einem Element im selben Satz', async ({ page }) => {
    await page.setContent('<div>Mehr unter <a href="#1">Hilfe</a> <span>(neu)</span>.</div><span>Siehe <a href="#2">zwei</a></span>');
    expect(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' })).toEqual([]);
  });

  test('ein einzeiliges Textfeld mit 26 px und eine Klickfläche ohne Rolle mit 22 px zählen', async ({ page }) => {
    await page.setContent('<textarea rows="1" aria-label="feld" style="height:26px;width:300px"></textarea>'
      + '<div><span data-act="art" style="display:inline-block;height:22px;width:50px">Agent</span></div>');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['feld', 'Agent']);
  });

  test('ein Label um ein verstecktes Dateifeld zählt, ein Label neben einem sichtbaren Feld nicht', async ({ page }) => {
    await page.setContent('<label style="display:block;height:26px;width:300px">+ Datei wählen<input type="file" hidden></label>'
      + '<label for="n" style="display:block;height:20px">Name</label><input id="n" aria-label="name" style="height:44px;width:200px">');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['+ Datei wählen']);
  });

  test('ein Hintergrund mit data-act über die ganze Fläche besteht, er ist so groß wie das Fenster', async ({ page }) => {
    await page.setContent('<div data-act="schliessen-bg" style="position:fixed;inset:0"></div>');
    expect(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' })).toEqual([]);
  });

  test('unter einem offenen Dialog zählt nur die oberste Ebene', async ({ page }) => {
    await page.setContent(STIL + '<main inert>' + knopf(10, 10, 10, 'darunter') + '</main><div role="dialog">' + knopf(100, 100, 10, 'oben') + '</div>');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['oben']);
  });

  test('bei offenem Menü zählt nur das Menü, auch wenn die Seite darunter nicht inert ist', async ({ page }) => {
    await page.setContent(STIL + '<main>' + knopf(10, 10, 10, 'seite') + '</main><div role="menu">' + knopf(100, 100, 10, 'eintrag') + '</div>');
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['eintrag']);
  });
});

test.describe('Selbstproben, Touch', () => {
  test.use({ hasTouch: true });

  test('Maß 44 ohne Ausnahme: 32 fällt, 44 besteht, Kreis-Ausnahme gilt nicht', async ({ page }) => {
    await page.setContent(STIL + knopf(100, 100, 32, 'kopf32') + knopf(300, 100, 44, 'kopf44') + knopf(100, 300, 20, 'einsam'));
    expect(namen(await zieleMessen(page, { zeiger: 'touch', ansicht: 'probe' }))).toEqual(['kopf32', 'einsam']);
  });
});

test.describe('Selbstprobe Titel', () => {
  const KARTE = '<style>.ka{position:absolute;left:50px;top:50px;width:240px;padding:8px;background:#eee}.t{margin-right:40px}'
    + '.signal{position:absolute;right:8px;top:8px;width:22px;height:22px}.signal::after{content:"";position:absolute;inset:-13px}'
    + '.weit::after{inset:-13px -60px -13px -13px}</style>';
  const karte = signalKlasse => `<div class="ka" data-act="oeffnen" data-id="1"><div class="t">Ein Titel über zwei Zeilen, damit er breit wird</div><button class="signal ${signalKlasse}" data-act="signal-aus" aria-label="Signal"></button></div>`;

  test('jeder Punkt des Titels öffnet die Karte, solange kein Hof darüber liegt', async ({ page }) => {
    await page.setContent(KARTE + karte(''));
    expect(await titelPruefen(page, 'probe')).toEqual([]);
  });

  test('ein Hof, der über den Titel ragt, fällt durch', async ({ page }) => {
    await page.setContent(KARTE.replace('.weit::after{inset:-13px -60px -13px -13px}', '.weit::after{inset:-13px -13px -13px -200px}') + karte('weit'));
    const verstoesse = await titelPruefen(page, 'probe');
    expect(verstoesse.length).toBeGreaterThan(0);
    expect(verstoesse.every(v => v.getroffen === 'signal-aus')).toBe(true);
  });
});

test.describe('Selbstprobe ohne Kreis-Ausnahme', () => {
  test('ohneKreis: ein einsames 20 × 20 fällt auch bei feinem Zeiger durch', async ({ page }) => {
    await page.setContent(STIL + knopf(100, 100, 20, 'einsam'));
    expect(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe' })).toEqual([]);
    expect(namen(await zieleMessen(page, { zeiger: 'fein', ansicht: 'probe', ohneKreis: true }))).toEqual(['einsam']);
  });
});

test.describe('Selbstprobe Breite', () => {
  test.use({ viewport: { width: 320, height: 600 } });
  test('321 px Inhalt bei 320 px fällt durch, 320 px besteht', async ({ page }) => {
    const seite = inhalt => `<style>body{margin:0}</style><main id="main">${inhalt}</main>`;
    await page.setContent(seite('<div style="width:321px;height:10px"></div>'));
    expect((await breiteMessen(page, 'probe')).map(v => v.ort)).toEqual(['Seite', '#main']);
    await page.setContent(seite('<div style="width:320px;height:10px"></div>'));
    expect(await breiteMessen(page, 'probe')).toEqual([]);
  });

  // B0412: ein Bereich unter #main, der quer scrollt, zählt — außer er ist nach F0050 benannt oder trägt eine breite Tabelle
  test('ein quer scrollender Bereich zählt, die Spaltenleiste und ein Bereich mit breiter Tabelle nicht', async ({ page }) => {
    const seite = inhalt => `<style>body{margin:0}</style><main id="main">${inhalt}</main>`;
    const breit = '<div style="width:336px;height:10px"></div>';
    await page.setContent(seite(`<div class="einr breit" style="overflow:auto">${breit}</div>`));
    expect(await breiteMessen(page, 'probe')).toEqual([{ ansicht: 'probe', ort: 'div.einr.breit', breite: 320, scrollWidth: 336, clientWidth: 320 }]);
    await page.setContent(seite(`<div class="bahnen" style="overflow-x:auto">${breit}</div>`));
    expect(await breiteMessen(page, 'probe')).toEqual([]);
    await page.setContent(seite('<div class="body" style="overflow:auto"><table style="width:900px"><tr><td>x</td></tr></table></div>'));
    expect(await breiteMessen(page, 'probe')).toEqual([]);
    await page.setContent(seite(`<div class="body" style="overflow:auto"><table><tr><td>x</td></tr></table>${breit}</div>`));
    expect((await breiteMessen(page, 'probe')).map(v => v.ort)).toEqual(['div.body']);
  });
});

test.describe('Selbstprobe Inhalt', () => {
  test('zieleImInhalt zählt sichtbare Ziele der obersten Ebene, sonst in main; Kopfzeile zählt nicht', async ({ page }) => {
    await page.setContent('<header><button>Kopf</button></header><main id="main"></main>');
    expect(await zieleImInhalt(page)).toBe(0);
    await page.setContent('<header><button>Kopf</button></header><main id="main"><button>a</button><button hidden>b</button><a href="#x">c</a></main>');
    expect(await zieleImInhalt(page)).toBe(2);
    await page.setContent('<main id="main"><button>a</button></main><div role="menu"><button role="menuitem">x</button><button role="menuitem">y</button><button role="menuitem">z</button></div>');
    expect(await zieleImInhalt(page)).toBe(3);
  });
});
