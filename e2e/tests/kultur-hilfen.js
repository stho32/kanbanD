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

module.exports = { ISO, isoFundstellen };
