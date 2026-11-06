// Messhelfer der Zielgröße (R00108, ADR-0012 Regel 6): Trefferfläche je Bedienziel im echten Browser.
// Eigene Datei statt hilfen.js, solange karte/9 dort den Kontrast-Helfer ergänzt.
"use strict";

const MASS = { fein: 24, touch: 44 };

/**
 * Läuft im Browser: misst jedes Bedienziel und liefert die Verstöße.
 * Trefferfläche = Rechteck des Elements vereinigt mit dem seines ::after (Trefferhof);
 * ob sie trifft, prüft document.elementFromPoint an den vier Kantenmitten (1 px innen).
 * Bei feinem Zeiger gilt die Kreis-Ausnahme aus WCAG 2.5.8, bei Touch nicht.
 */
function imBrowserMessen({ mass, kreisAusnahme, ansicht }) {
  const ZIELE = 'button, select, input:not([type=hidden]), a.btn, [role=button], [role=checkbox], [role=radio], [role=menuitem], [role=tab], [role=switch], a[href]';
  const oberste = [...document.querySelectorAll('[role=dialog], [role=menu], #pop')].filter(e => !e.closest('[inert]')).at(-1);

  function istLinkAllein(el) {
    const eltern = el.parentElement;
    return eltern && eltern.textContent.trim() === el.textContent.trim();
  }
  function istZiel(el) {
    if (el.matches('a[href]') && !el.matches('a.btn, [role]') && !istLinkAllein(el)) return false;
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
    if (nach.content === 'none' || nach.position !== 'absolute') return null;
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
  function messen(el) {
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    const flaeche = vereinigt(r, hofRechteck(el, r));
    const breite = Math.round((flaeche.right - flaeche.left) * 10) / 10;
    const hoehe = Math.round((flaeche.bottom - flaeche.top) * 10) / 10;
    const mitte = { x: (flaeche.left + flaeche.right) / 2, y: (flaeche.top + flaeche.bottom) / 2 };
    return { el, flaeche, breite, hoehe, mitte, trifft: trifftUeberall(el, flaeche) };
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

  const gemessen = [...document.querySelectorAll(ZIELE)].filter(istZiel).map(messen);
  const zuKlein = gemessen.filter(m => m.breite < mass || m.hoehe < mass);
  const verstoesse = gemessen.filter(m => !m.trifft || (zuKlein.includes(m) && !(kreisAusnahme && kreisFrei(m, gemessen, zuKlein))));
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
  return page.evaluate(imBrowserMessen, { mass: MASS[zeiger], kreisAusnahme: zeiger === 'fein' && !ohneKreis, ansicht });
}

/** Verstöße der Titelprobe: Punkte des Kartentitels, die nicht das Öffnen der Karte treffen. */
function titelPruefen(page, ansicht) {
  return page.evaluate(imBrowserTitelPruefen, { ansicht });
}

module.exports = { zieleMessen, titelPruefen, MASS };
