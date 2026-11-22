/* kanbanD — Satz der Laufansicht (R00240, ADR-0041 N4): der aufgeklappte Teil eines Schritts. Aufruf als Shell-Block, „Schlüssel:
   Wert“, Diff oder JSON; Ergebnis in Festbreite mit Testzeile, Marke „gekürzt“, eingebetteten Systemhinweisen und Kürzung auf 20 Zeilen.
   Rein, im Browser und in Node wie lauf.js. Jedes Zeichen aus fremdem Text geht über `zeile` (maskiert und sichtbar gemacht). */
(function (ziel) {
  'use strict';

  /** Grenzen je Eintrag (N4 Punkt 7); darüber steht der Aufruf wie heute als `pre`. Nie in der Oberfläche. */
  const SATZ_GRENZEN = Object.freeze({ aufrufBytes: 65536, aufrufZeilen: 2000, befehlBytes: 16384 });
  const OFFENE_ZEILEN = 20;
  const PFEIL_KLEIN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  const tausender = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

  /** Mehr als `grenze` UTF-8-Bytes? Gezählt nur bis knapp über die Grenze — ein riesiger Text wird nicht ganz durchlaufen. */
  function bytesUeber(text, grenze) {
    if (text.length > grenze) return true;
    let bytes = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text.charCodeAt(i);
      if (c < 0x80) bytes += 1;
      else if (c < 0x800) bytes += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { bytes += 4; i++; } else bytes += 3;
      if (bytes > grenze) return true;
    }
    return false;
  }

  /* ── Shell-Block (N4 Punkt 2): Umbruch nach &&, || und ; auf oberster Ebene, sonst ändert sich kein Zeichen ── */

  /** `command` → derselbe Text mit `\n` nach `&&`, `||` und `;` auf oberster Ebene: nie in `'…'`, `"…"`, `$(…)` oder Backticks, nie
      nach `\`, nie bei `;;`, nie hinter einem `#`, das ein Wort beginnt, nie ab dem ersten `<<`, nie am Ende oder vor einem `\n`.
      Über 16 KiB unverändert. Ein Durchlauf. */
  function shellUmbruch(befehl) {
    if (bytesUeber(befehl, SATZ_GRENZEN.befehlBytes)) return befehl;
    let aus = '', quote = null, tiefe = 0, kommentar = false;
    for (let i = 0; i < befehl.length; i++) {
      const c = befehl[i], naechstes = befehl[i + 1];
      if (kommentar) {
        if (c === '\n') kommentar = false;
        aus += c;
        continue;
      }
      if (c === '\\' && quote !== "'") { aus += befehl.slice(i, i + 2); i++; continue; }
      if (quote !== null) {
        if (c === quote) quote = null;
        aus += c;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { quote = c; aus += c; continue; }
      if (c === '$' && naechstes === '(') { tiefe++; aus += '$('; i++; continue; }
      if (tiefe > 0) {
        if (c === '(') tiefe++;
        if (c === ')') tiefe--;
        aus += c;
        continue;
      }
      if (c === '<' && naechstes === '<') return aus + befehl.slice(i);
      if (c === '#' && wortbeginn(befehl[i - 1])) { kommentar = true; aus += c; continue; }
      const operator = operatorAn(befehl, i);
      if (operator === null) { aus += c; continue; }
      aus += operator;
      i += operator.length - 1;
      if (operator !== ';;' && umbruchErlaubt(befehl[i + 1])) aus += '\n';
    }
    return aus;
  }

  const wortbeginn = davor => davor === undefined || /[\s;&|()]/.test(davor);
  const umbruchErlaubt = danach => danach !== undefined && danach !== '\n';

  function operatorAn(text, i) {
    const zwei = text.slice(i, i + 2);
    if (zwei === '&&' || zwei === '||' || zwei === ';;') return zwei;
    if (text[i] === ';') return ';';
    return null;
  }

  /* ── Kürzung „weitere <n> Zeilen“ (N4 Punkt 3, PO Z. 595, 597, 606) ── */

  const BLOCK_NAME = { ergebnis: 'des Ergebnisses', aufruf: 'des Aufrufs', aenderung: 'der Änderung' };

  /** Zeilen (HTML) eines Blocks → die ersten 20 in `huelle`, der Rest in einem eingebetteten `details`, dessen Knopf „weitere <n>
      Zeilen“ bzw. „1 weitere Zeile“ heißt und im zugänglichen Namen den Block nennt. Der Rest steht im DOM, nie „…“. */
  function kuerzungHtml(zeilen, block, huelle) {
    if (zeilen.length <= OFFENE_ZEILEN) return huelle(zeilen);
    return huelle(zeilen.slice(0, OFFENE_ZEILEN)) + mehrHtml(zeilen.length - OFFENE_ZEILEN, block, huelle(zeilen.slice(OFFENE_ZEILEN)));
  }

  function mehrHtml(rest, block, inhalt) {
    let wort = `weitere ${tausender(rest)} Zeilen`;
    if (rest === 1) wort = '1 weitere Zeile';
    return `<details class="lv-mehr"><summary>${PFEIL_KLEIN}${wort}<span class="vh"> ${BLOCK_NAME[block]}</span></summary>${inhalt}</details>`;
  }

  /** Zeilen eines Texts; ein abschließendes `\n` beginnt keine eigene Zeile. */
  function textZeilen(text) {
    const zeilen = text.split('\n');
    if (zeilen.length > 1 && zeilen[zeilen.length - 1] === '') zeilen.pop();
    return zeilen;
  }

  const preHuelle = klasse => zeilen => `<pre${klasse}>${zeilen.join('\n')}</pre>`;

  Object.assign(ziel, { SATZ_GRENZEN, shellUmbruch, kuerzungHtml });
})(typeof module !== 'undefined' ? module.exports : window);
