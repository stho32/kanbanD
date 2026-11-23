// Messhelfer der Zielgröße (R00108, ADR-0012 Regel 6): Trefferfläche je Bedienziel im echten Browser.
// Eigene Datei statt hilfen.js, solange karte/9 dort den Kontrast-Helfer ergänzt.
"use strict";

const MASS = { fein: 24, touch: 44 };

/**
 * Was nach F0050 in sich quer scrollen darf: Spaltenleiste, Legende des Boards und die Tabellenbereiche;
 * eine breite Tabelle in einem anderen Bereich erkennt breiteMessen selbst.
 */
// Abschließende Liste nach F0050 und PO Z. 137: nur diese benannten Rahmen dürfen in sich quer scrollen
const QUER_ERLAUBT = '.bahnen, .leg, .best-scroll, .ko-scroll, .res-rahmen, .wl-scroll, .bericht-rahmen, .cl-rahmen, .df-sc';

/**
 * Läuft im Browser: misst jedes Bedienziel und liefert die Verstöße.
 * Trefferfläche = Rechteck des Elements vereinigt mit dem seines leeren ::after (Trefferhof);
 * ob sie trifft, prüft document.elementFromPoint an den vier Kantenmitten (1 px innen).
 * Bei feinem Zeiger gilt die Kreis-Ausnahme aus WCAG 2.5.8, bei Touch nicht.
 */
/**
 * Was als Bedienziel gemessen wird (ADR-0012 Regel 2): Steuerelemente und Rollen, Textfelder, ein Label, das für
 * sein verstecktes Feld angetippt wird, und jede Klickfläche mit data-act — auch ohne Rolle, auch eine Tabellenzeile
 * und ein Diagrammpunkt (der besteht über ein gleichwertiges Ziel, siehe gleichwertigBesteht).
 */
const ZIELE = 'button, select, input:not([type=hidden]), textarea, a.btn, summary, [role=button], [role=checkbox], [role=radio], [role=menuitem], [role=menuitemradio], [role=menuitemcheckbox], [role=tab], [role=switch], a[href], '
  + 'label:has(> input:is([hidden], [type=file])), [data-act], [data-tip]';

function imBrowserMessen({ mass, kreisAusnahme, ansicht, ZIELE }) {
  const oberste = [...document.querySelectorAll('[role=dialog], [role=menu], #pop')].filter(e => !e.closest('[inert]')).at(-1);

  // Im Satz heißt: in derselben Zeile des Blocks steht Text außerhalb des Links (ADR-0012: nur Links im Fließtext
  // sind ausgenommen). Hervorhebungen (b, span) gehören zum Satz; Elemente mit eigener Box (Etikett, Flex-Nachbar) nicht.
  function istInline(el) {
    return getComputedStyle(el).display === 'inline';
  }
  function satzText(knoten, link) {
    return [...knoten.childNodes].map(kind => {
      if (kind === link) return '';
      if (kind.nodeType === Node.TEXT_NODE) return kind.textContent;
      if (kind.nodeType === Node.ELEMENT_NODE && istInline(kind)) return satzText(kind, link);
      return '';
    }).join('');
  }
  function stehtImSatz(link) {
    let block = link.parentElement;
    while (block && istInline(block)) block = block.parentElement;
    return Boolean(block) && satzText(block, link).trim() !== '';
  }
  function istZiel(el) {
    if (el.matches('a[href]') && !el.matches('a.btn, [role]') && stehtImSatz(el)) return false;
    if (el.closest('[inert]')) return false;
    if (oberste && !oberste.contains(el)) return false;
    if (!el.checkVisibility({ visibilityProperty: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }
  function px(wert) {
    const zahl = parseFloat(wert);
    return Number.isFinite(zahl) ? zahl : null;
  }
  function hofRechteck(el, r) {
    const nach = getComputedStyle(el, '::after');
    // Nur ein leerer, absolut gesetzter ::after ist ein Hof; ein Zeichen wie „▾“ ist Zeichnung
    if (nach.content !== '""' || nach.position !== 'absolute') return null;
    const [oben, rechts, unten, links] = [nach.top, nach.right, nach.bottom, nach.left].map(px);
    if ([oben, rechts, unten, links].includes(null)) return null;
    const rand = getComputedStyle(el);
    const innenLinks = r.left + px(rand.borderLeftWidth);
    const innenOben = r.top + px(rand.borderTopWidth);
    const innenRechts = r.right - px(rand.borderRightWidth);
    const innenUnten = r.bottom - px(rand.borderBottomWidth);
    return { left: innenLinks + links, top: innenOben + oben, right: innenRechts - rechts, bottom: innenUnten - unten };
  }
  function vereinigt(a, b) {
    if (!b) return { left: a.left, top: a.top, right: a.right, bottom: a.bottom };
    return { left: Math.min(a.left, b.left), top: Math.min(a.top, b.top), right: Math.max(a.right, b.right), bottom: Math.max(a.bottom, b.bottom) };
  }
  function trifft(el, x, y) {
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return true;
    const treffer = document.elementFromPoint(x, y);
    return Boolean(treffer) && (el === treffer || el.contains(treffer));
  }
  function trifftUeberall(el, f) {
    const mitteX = (f.left + f.right) / 2, mitteY = (f.top + f.bottom) / 2;
    const punkte = [[mitteX, f.top + 1], [mitteX, f.bottom - 1], [f.left + 1, mitteY], [f.right - 1, mitteY]];
    return punkte.every(([x, y]) => trifft(el, x, y));
  }
  function selektor(el) {
    const id = el.id ? '#' + el.id : '';
    const klassen = [...el.classList].map(k => '.' + k).join('');
    const akt = el.dataset.act ? `[data-act="${el.dataset.act}"]` : '';
    return el.tagName.toLowerCase() + id + klassen + akt;
  }
  function name(el) {
    return (el.getAttribute('aria-label') || el.textContent || el.title || el.value || '').trim().slice(0, 40);
  }
  function messen(feld) {
    // Schalter „Umbrechen“ (R00248, PO Z. 652 und 681): das Feld bleibt der gezeichnete Schalter (40×22 px), die Zielfläche trägt das Label
    const el = feld.matches('label.ru-sch > input') ? feld.closest('label') : feld;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const flaeche = vereinigt(r, hofRechteck(el, r));
    const breite = Math.round((flaeche.right - flaeche.left) * 10) / 10;
    const hoehe = Math.round((flaeche.bottom - flaeche.top) * 10) / 10;
    const mitte = { x: (flaeche.left + flaeche.right) / 2, y: (flaeche.top + flaeche.bottom) / 2 };
    return { el: feld, flaeche, breite, hoehe, mitte, trifft: trifftUeberall(el, flaeche) };
  }
  function abstandZuRechteck(p, f) {
    const dx = Math.max(f.left - p.x, 0, p.x - f.right);
    const dy = Math.max(f.top - p.y, 0, p.y - f.bottom);
    return Math.hypot(dx, dy);
  }
  function kreisFrei(m, alle, klein) {
    const radius = mass / 2;
    const andere = alle.filter(o => o !== m);
    const schneidetZiel = andere.some(o => abstandZuRechteck(m.mitte, o.flaeche) < radius);
    const schneidetKreis = klein.filter(o => o !== m).some(o => Math.hypot(o.mitte.x - m.mitte.x, o.mitte.y - m.mitte.y) < mass);
    return !schneidetZiel && !schneidetKreis;
  }

  // Ausnahme „gleichwertiges Ziel“ (WCAG 2.5.8 Equivalent): ein Diagrammpunkt besteht, wenn dieselbe Ansicht
  // ein gemessenes, bestehendes Ziel mit gleichem data-act und data-arg bietet
  function gleichwertigBesteht(m, bestehend) {
    if (!m.el.matches('circle[data-act]')) return false;
    return bestehend.some(o => o !== m && o.el.dataset.act === m.el.dataset.act && o.el.dataset.arg === m.el.dataset.arg);
  }

  const gemessen = [...document.querySelectorAll(ZIELE)].filter(istZiel).map(messen);
  const zuKlein = gemessen.filter(m => m.breite < mass || m.hoehe < mass);
  const verfehlt = gemessen.filter(m => !m.trifft || (zuKlein.includes(m) && !(kreisAusnahme && kreisFrei(m, gemessen, zuKlein))));
  const bestehend = gemessen.filter(m => !verfehlt.includes(m));
  const verstoesse = verfehlt.filter(m => !gleichwertigBesteht(m, bestehend));
  scrollTo(0, 0);
  return verstoesse.map(m => ({ ansicht, selektor: selektor(m.el), name: name(m.el), breite: m.breite, hoehe: m.hoehe, mass, trifft: m.trifft }));
}

/** Läuft im Browser: je Karte fünf Punkte des Titels .ka .t; jeder muss das Öffnen der Karte treffen. */
function imBrowserTitelPruefen({ ansicht }) {
  const verstoesse = [];
  for (const titel of document.querySelectorAll('.ka .t')) {
    const karte = titel.closest('.ka');
    karte.scrollIntoView({ block: 'center', inline: 'center' });
    const r = titel.getBoundingClientRect();
    const punkte = [[r.left + 2, r.top + 2], [r.right - 2, r.top + 2], [r.left + 2, r.bottom - 2], [r.right - 2, r.bottom - 2], [(r.left + r.right) / 2, (r.top + r.bottom) / 2]];
    for (const [x, y] of punkte) {
      const treffer = document.elementFromPoint(x, y);
      const ziel = treffer && treffer.closest('[data-act]');
      if (ziel !== karte) verstoesse.push({ ansicht, karte: karte.dataset.id, punkt: [Math.round(x), Math.round(y)], getroffen: ziel ? ziel.dataset.act : null });
    }
  }
  scrollTo(0, 0);
  return verstoesse;
}

/**
 * Verstöße der Zielgröße in der offenen Seite; zeiger 'fein' (Maß 24, Kreis-Ausnahme) oder 'touch' (Maß 44).
 * ohneKreis: true misst auch bei feinem Zeiger ohne Kreis-Ausnahme — für Proben, die die Trefferfläche selbst verlangen.
 */
function zieleMessen(page, { zeiger, ansicht, ohneKreis = false }) {
  return page.evaluate(imBrowserMessen, { mass: MASS[zeiger], kreisAusnahme: zeiger === 'fein' && !ohneKreis, ansicht, ZIELE });
}

/** Verstöße der Titelprobe: Punkte des Kartentitels, die nicht das Öffnen der Karte treffen. */
function titelPruefen(page, ansicht) {
  return page.evaluate(imBrowserTitelPruefen, { ansicht });
}

/**
 * Waagrechtes Scrollen: Seite, #main und jeder Bereich unter #main mit overflow-x auto oder scroll
 * höchstens so breit wie sein Fenster. Ausgenommen nur die benannten Rahmen, die nach F0050 in sich quer scrollen
 * dürfen (QUER_ERLAUBT) — eine breite Tabelle allein ist keine Ausnahme.
 */
function breiteMessen(page, ansicht) {
  return page.evaluate(({ ansicht, querErlaubt }) => {
    const main = document.getElementById('main');
    const rollend = main ? [...main.querySelectorAll('*')].filter(el => ['auto', 'scroll'].includes(getComputedStyle(el).overflowX)) : [];
    const bereiche = rollend.filter(el => !el.matches(querErlaubt)).map(el => [el.tagName.toLowerCase() + [...el.classList].map(k => '.' + k).join(''), el]);
    const orte = [['Seite', document.documentElement], ['#main', main], ...bereiche];
    return orte
      .filter(([, el]) => el && el.scrollWidth > el.clientWidth)
      .map(([ort, el]) => ({ ansicht, ort, breite: innerWidth, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
  }, { ansicht, querErlaubt: QUER_ERLAUBT });
}

/** Lage von „…“ im Kopf: rechte Kante von #t-mehr (aufgerundet) und die Breite des Dokuments ohne Bildlaufleiste. */
function kopfLage(page) {
  return page.evaluate(() => ({
    mehrRechts: Math.ceil(document.getElementById('t-mehr').getBoundingClientRect().right),
    klientBreite: document.documentElement.clientWidth,
  }));
}

/**
 * Zahl der sichtbaren Ziele im Inhalt: oberste Ebene (Dialog, Menü), sonst main — die Kopfzeile zählt nicht.
 * Beweist, dass eine Ansicht wirklich geöffnet ist; ohne Ziele wäre „kein Verstoß“ leer bestanden.
 */
function zieleImInhalt(page) {
  return page.evaluate(ziele => {
    const oberste = [...document.querySelectorAll('[role=dialog], [role=menu], #pop')].filter(e => !e.closest('[inert]')).at(-1);
    const inhalt = oberste || document.querySelector('main');
    if (!inhalt) return 0;
    return [...inhalt.querySelectorAll(ziele)].filter(e => e.checkVisibility({ visibilityProperty: true })).length;
  }, ZIELE);
}

/** Überlauf von Dokument, #main und .body: je Ort true, oder „scrollWidth > clientWidth“ als Text. */
const ueberlauf = page => page.evaluate(() => Object.fromEntries([['Seite', document.documentElement], ['#main', document.getElementById('main')], ['.body', document.querySelector('#main .body')]]
  .map(([ort, el]) => [ort, el.scrollWidth <= el.clientWidth || `${el.scrollWidth} > ${el.clientWidth}`])));

/** Drückt Tab, bis der Fokus auf dem Element steht, höchstens 60-mal; liefert die Zahl der Schritte oder 0. */
async function perTabErreicht(page, ziel) {
  for (let schritt = 1; schritt <= 60; schritt++) {
    await page.keyboard.press('Tab');
    if (await ziel.evaluate(el => el === document.activeElement)) return schritt;
  }
  return 0;
}

/** Titelzelle von #5: Text, Ellipse an, steht der Link ganz in der Zelle; dazu die sichtbaren Spaltenköpfe. */
const titelZelle = page => page.evaluate(() => {
  const td = document.querySelector('tr[data-zeile="5"] td.tt'), a = td.querySelector('a'), stil = getComputedStyle(td);
  const zelle = td.getBoundingClientRect(), ganz = [...a.getClientRects()].every(r => r.left >= zelle.left - 0.5 && r.right <= zelle.right + 0.5);
  const spalten = [...document.querySelectorAll('table.liste thead th')].filter(th => th.getBoundingClientRect().width > 0).length;
  return { text: a.textContent, ellipse: stil.textOverflow === 'ellipsis' && stil.overflow !== 'visible', ganz, umbruch: stil.whiteSpace, spalten };
});

module.exports = { zieleMessen, titelPruefen, breiteMessen, kopfLage, zieleImInhalt, ueberlauf, perTabErreicht, titelZelle, MASS };
