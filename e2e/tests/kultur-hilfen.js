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
 * Läuft im Browser: je Zeile eines `.felder`-Rasters im Fenster die Beschriftung `.k` und die folgende Feldzelle.
 * Eine Zeile ist ein direktes Kind des Rasters, das `.k` ist oder `.k` als direktes Kind trägt (Rahmen `.kb`, ADR-0013 N1);
 * ein eingebettetes Raster (neue Wirkung) bringt seine eigenen Zeilen. Ist die Beschriftung eine aus FELDER, muss der Rahmen
 * außerhalb von `.k` ein Element mit genau ihrem Schlüssel tragen; kein Raster mit Zeile ist ein Verstoß.
 * Der Name ist eine Näherung der zugänglichen Namensberechnung, die für kanbanDs Felder reicht:
 * aria-labelledby, aria-label, label for, umschließendes label. Eine Knopfgruppe braucht role=group mit Namen.
 */
function imBrowserBeschriften(fenster, { felder, namen }) {
  const schluessel = Object.keys(felder);
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
  const istZeile = kind => kind.matches('.k') || kind.querySelector(':scope > .k');
  const zeilen = [...fenster.querySelectorAll('.felder')].flatMap(raster => [...raster.children].filter(istZeile));
  if (!zeilen.length) return [{ beschriftung: '', name: null, verstoesse: ['keine Feldzeile im Fenster'] }];

  function schluesselVerstoesse(zeile, beschriftung) {
    const verlangt = schluessel.find(s => felder[s] === beschriftung);
    if (!verlangt) return [];
    const gefunden = [...zeile.querySelectorAll('*')].some(el => !el.closest('.k') && text(el) === verlangt);
    if (gefunden) return [];
    return [`Schlüssel ${verlangt} fehlt unter der Beschriftung`];
  }
  function benanntesFeld(zelle) {
    if (!zelle) return null;
    if (zelle.matches('[role=group]')) return zelle;
    return zelle.querySelector('[role=group], [role=radiogroup]') || zelle.querySelector('select, textarea, input:not([type=hidden])');
  }
  function namensVerstoesse(zelle, beschriftung) {
    const feld = benanntesFeld(zelle);
    const knopfgruppe = !feld && zelle && zelle.querySelectorAll('button').length > 1;
    if (knopfgruppe) return { name: null, verstoesse: ['Knopfgruppe ohne Gruppennamen'] };
    if (!feld) return { name: null, verstoesse: [] };
    const n = name(feld);
    const traegtBeschriftung = n.toLowerCase().includes(beschriftung.toLowerCase());
    if (traegtBeschriftung) return { name: n, verstoesse: [] };
    return { name: n, verstoesse: [`Name „${n}“ enthält die Beschriftung nicht`] };
  }

  return zeilen.map(zeile => {
    const beschriftung = text(zeile.querySelector(':scope > .k') || zeile);
    const verstoesse = [];
    const istSchluessel = schluessel.includes(beschriftung);
    if (istSchluessel) verstoesse.push(`Beschriftung ist der Schlüssel ${beschriftung}`);
    const enthalten = schluessel.find(s => !istSchluessel && enthaeltWort(beschriftung, s));
    if (enthalten) verstoesse.push(`Beschriftung enthält den Schlüssel ${enthalten}`);
    verstoesse.push(...schluesselVerstoesse(zeile, beschriftung));
    if (!namen) return { beschriftung, name: null, verstoesse };
    const benannt = namensVerstoesse(zeile.nextElementSibling, beschriftung);
    return { beschriftung, name: benannt.name, verstoesse: [...verstoesse, ...benannt.verstoesse] };
  });
}

/**
 * Je Feld des Fensters {beschriftung, name, verstoesse}; FELDER liefert die Schlüssel, die keine Beschriftung sein dürfen,
 * und den Schlüssel unter jeder Beschriftung. `namen: false` prüft nur Beschriftung und Schlüssel (Einrichten, erster Start).
 */
async function beschriftungenPruefen(fenster, felder, { namen = true } = {}) {
  return fenster.evaluate(imBrowserBeschriften, { felder, namen });
}

/**
 * Trennt die Fundstellen einer Ansicht in offene (nicht gelistet) und Alarme der Ausnahmeliste (FA 19):
 * ein Eintrag gilt für Fundstellen mit gleichem Element und Text; findet er keine mehr, schlägt er Alarm.
 */
function ausnahmenAbgleichen(funde, liste, ansicht) {
  const gelistet = liste.filter(e => e.ansicht === ansicht);
  const passt = (f, e) => f.element === e.selektor && f.text === e.text;
  const offen = funde.filter(f => !gelistet.some(e => passt(f, e)));
  const alarme = gelistet.filter(e => !funde.some(f => passt(f, e)))
    .map(e => `${e.selektor} „${e.text}“ in ${ansicht}: Fundstelle verschwunden — Eintrag aus AUSNAHMEN streichen (${e.karte})`);
  return { offen, alarme };
}

module.exports = { ISO, isoFundstellen, beschriftungenPruefen, ausnahmenAbgleichen };
