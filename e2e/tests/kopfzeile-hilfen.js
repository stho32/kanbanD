// Prüfhelfer für die Kopfzeile (R00101): vermisst die Bedienelemente im Browser und findet Konflikte.
"use strict";

/** Konflikte der Kopfzeile: Überlappung (Schnittfläche > 0), abgeschnitten (nicht ganz im Fenster und im Kopf), verdeckt (elementFromPoint im Mittelpunkt trifft ein anderes Element), Inhalt breiter als das Element, Überlauf einer Zeile. */
function kopfKonflikte(elemente, fenster, kopf) {
  const fensterRahmen = { x: 0, y: 0, breite: fenster.breite, hoehe: fenster.hoehe };
  return [
    ...ueberlappungen(elemente),
    ...elemente.filter(e => !liegtInnen(e, fensterRahmen) || !liegtInnen(e, kopf)).map(e => ({ art: 'abgeschnitten', name: e.name })),
    ...elemente.filter(e => !e.getroffen).map(e => ({ art: 'verdeckt', name: e.name })),
    ...elemente.filter(e => e.inhaltLaeuftUeber).map(e => ({ art: 'Inhalt läuft über', name: e.name })),
    ...kopf.zeilen.filter(z => z.scrollBreite > z.clientBreite).map(z => ({ art: 'Überlauf', name: z.name, um: z.scrollBreite - z.clientBreite })),
  ];
}

function ueberlappungen(elemente) {
  const gefunden = [];
  elemente.forEach((a, i) => elemente.slice(i + 1).forEach(b => {
    const flaeche = schnittflaeche(a, b);
    if (flaeche > 0) gefunden.push({ art: 'überlappt', a: a.name, b: b.name, flaeche });
  }));
  return gefunden;
}

function schnittflaeche(a, b) {
  const breite = Math.min(a.x + a.breite, b.x + b.breite) - Math.max(a.x, b.x);
  const hoehe = Math.min(a.y + a.hoehe, b.y + b.hoehe) - Math.max(a.y, b.y);
  if (breite <= 0 || hoehe <= 0) return 0;
  return breite * hoehe;
}

function liegtInnen(e, rahmen) {
  return e.x >= rahmen.x && e.y >= rahmen.y && e.x + e.breite <= rahmen.x + rahmen.breite && e.y + e.hoehe <= rahmen.y + rahmen.hoehe;
}

/** Läuft im Browser: vermisst jedes Kopfzeilen-Bedienelement (Begriff aus R00101) und jede Zeile von header.kz. */
function vermessen() {
  const kopf = document.querySelector('header.kz');
  const kopfRect = kopf.getBoundingClientRect();
  const bedienelement = 'button, a, input, select, [role="radio"], [role="checkbox"], [data-act]';
  const elemente = [...kopf.querySelectorAll(bedienelement)]
    .map(el => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ el, r }) => r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden')
    .map(({ el, r }) => {
      const treffer = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const name = (el.getAttribute('aria-label') || el.textContent || el.placeholder || el.tagName).trim().replace(/\s+/g, ' ').slice(0, 40);
      const inhaltLaeuftUeber = el.tagName !== 'INPUT' && el.scrollWidth > el.clientWidth + 1;
      return { name, x: r.x, y: r.y, breite: r.width, hoehe: r.height, getroffen: !!treffer && el.contains(treffer), inhaltLaeuftUeber };
    });
  const zeilen = [kopf, ...kopf.querySelectorAll('.kz-reihe')].map((z, i) => ({ name: i ? `Zeile ${i}` : 'Kopfzeile', scrollBreite: z.scrollWidth, clientBreite: z.clientWidth }));
  return { elemente, fenster: { breite: innerWidth, hoehe: innerHeight }, kopf: { x: kopfRect.x, y: kopfRect.y, breite: kopfRect.width, hoehe: kopfRect.height, zeilen } };
}

/** Vermisst die Kopfzeile der Seite und liefert ihre Konflikte samt der Elementnamen. */
async function kopfzeilePruefen(page) {
  const { elemente, fenster, kopf } = await page.evaluate(vermessen);
  return { namen: elemente.map(e => e.name), konflikte: kopfKonflikte(elemente, fenster, kopf) };
}

/** Läuft im Browser: das sichtbare Auswahlzeichen eines Eintrags (R00117, AK 4–6) — Inhalt des ::before (ohne Anführungszeichen),
 *  der sichtbare Text (mit einem aria-verborgenen Zeichenkind) und ob ein solches Zeichenkind vorhanden ist. */
function auswahlzeichenMessen(el) {
  const inhalt = getComputedStyle(el, '::before').content;
  const pseudo = inhalt === 'none' || inhalt === 'normal' ? '' : inhalt.replace(/^["']|["']$/g, '');
  const text = el.textContent;
  const verborgen = [...el.querySelectorAll('[aria-hidden="true"]')].some(s => /[✓☑]/.test(s.textContent));
  return { pseudo, text, verborgen };
}

/** Das Auswahlzeichen eines Eintrags: `pseudo` ist der Inhalt seines ::before, `text` sein eigener Textknoten. */
async function auswahlzeichen(locator) {
  return locator.evaluate(auswahlzeichenMessen);
}

module.exports = { kopfKonflikte, kopfzeilePruefen, auswahlzeichen };
