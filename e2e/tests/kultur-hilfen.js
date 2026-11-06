// Kulturproben (R00109, ADR-0013 Regel 5): ISO-Daten und Feldbeschriftungen im echten Browser.
"use strict";

/** Das Datumsmuster der Datei; deutsche Formen (28.10.2026, 28.10.) und Kennungen (R00108) passen nicht. */
const ISO = /\d{4}-\d{2}-\d{2}/;

/**
 * Läuft im Browser: sammelt sichtbare Textknoten, title und aria-label mit ISO-Datum.
 * Ausgenommen nach ADR-0013 Regel 3: Reiter „Datei“ (#dateitext) und die YAML-Vorschauen (pre.yaml), weil dort die Datei
 * selbst steht; der Wert des Datumsfelds ist kein Textknoten und wird nie gelesen. Der Schlüssel als Mono-Hilfstext
 * braucht keine Ausnahme — kein Schlüssel passt auf das Muster.
 */
function imBrowserSuchen({ ansicht, muster }) {
  const iso = new RegExp(muster);
  const AUSGENOMMEN = '#dateitext, pre.yaml';
  const beschreiben = el => el.localName + (el.id ? '#' + el.id : '') + [...el.classList].map(k => '.' + k).join('');
  const sichtbar = el => !el.closest(AUSGENOMMEN) && el.checkVisibility({ visibilityProperty: true });
  const funde = [];
  const melden = (ort, el, text) => funde.push({ ansicht, ort, element: beschreiben(el), text: text.trim() });

  const gang = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let knoten = gang.nextNode(); knoten; knoten = gang.nextNode()) {
    if (!iso.test(knoten.textContent)) continue;
    const el = knoten.parentElement;
    // Der Tooltip eines Diagramms ist ein svg-title: er gilt, wenn sein Träger sichtbar ist
    const svgTitel = el.localName === 'title' && el.namespaceURI === 'http://www.w3.org/2000/svg';
    if (svgTitel && sichtbar(el.parentElement)) melden('title', el.parentElement, knoten.textContent);
    if (!svgTitel && sichtbar(el)) melden('Text', el, knoten.textContent);
  }
  for (const el of document.body.querySelectorAll('[title], [aria-label]')) {
    if (!sichtbar(el)) continue;
    for (const ort of ['title', 'aria-label']) {
      const wert = el.getAttribute(ort);
      if (wert && iso.test(wert)) melden(ort, el, wert);
    }
  }
  return funde;
}

/** Fundstellen [{ansicht, ort (Text, title, aria-label), element, text}] der ISO-Form auf der Seite. */
async function isoFundstellen(page, ansicht) {
  return page.evaluate(imBrowserSuchen, { ansicht, muster: ISO.source });
}

/**
 * Läuft im Browser: je Zeile `.k` (Beschriftung) + folgendes `.w` (Feld) eines `.felder`-Rasters im Fenster.
 * Der Name ist eine Näherung der zugänglichen Namensberechnung, die für kanbanDs Felder reicht:
 * aria-labelledby, aria-label, label for, umschließendes label. Eine Knopfgruppe braucht role=group mit Namen.
 */
function imBrowserBeschriften(fenster, { schluessel }) {
  const text = el => el.textContent.replace(/\s+/g, ' ').trim();
  function name(feld) {
    const verweis = feld.getAttribute('aria-labelledby');
    if (verweis) return verweis.split(/\s+/).map(id => document.getElementById(id)).filter(Boolean).map(text).join(' ');
    if (feld.hasAttribute('aria-label')) return feld.getAttribute('aria-label');
    const label = (feld.id && document.querySelector(`label[for="${CSS.escape(feld.id)}"]`)) || feld.closest('label');
    if (label) return text(label);
    return '';
  }
  const enthaeltWort = (satz, wort) => satz.split(' ').includes(wort);
  return [...fenster.querySelectorAll('.felder > .k')].map(k => {
    const beschriftung = text(k);
    const zelle = k.nextElementSibling;
    const verstoesse = [];
    const istSchluessel = schluessel.includes(beschriftung);
    if (istSchluessel) verstoesse.push(`Beschriftung ist der Schlüssel ${beschriftung}`);
    const enthalten = schluessel.find(s => !istSchluessel && enthaeltWort(beschriftung, s));
    if (enthalten) verstoesse.push(`Beschriftung enthält den Schlüssel ${enthalten}`);
    const gruppe = zelle && zelle.matches('[role=group]') ? zelle : zelle && zelle.querySelector('[role=group], [role=radiogroup]');
    const feld = gruppe || (zelle && zelle.querySelector('select, textarea, input:not([type=hidden])'));
    const knopfgruppe = !feld && zelle && zelle.querySelectorAll('button').length > 1;
    if (knopfgruppe) verstoesse.push('Knopfgruppe ohne Gruppennamen');
    if (!feld) return { beschriftung, name: null, verstoesse };
    const n = name(feld);
    if (!n.toLowerCase().includes(beschriftung.toLowerCase())) verstoesse.push(`Name „${n}“ enthält die Beschriftung nicht`);
    return { beschriftung, name: n, verstoesse };
  });
}

/** Je Feld des Fensters {beschriftung, name, verstoesse}; FELDER liefert die Schlüssel, die keine Beschriftung sein dürfen. */
async function beschriftungenPruefen(fenster, felder) {
  return fenster.evaluate(imBrowserBeschriften, { schluessel: Object.keys(felder) });
}

module.exports = { ISO, isoFundstellen, beschriftungenPruefen };
