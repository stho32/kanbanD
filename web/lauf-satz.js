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

  /* ── JSON (N4 Punkt 2, ADR-0037 Rollen): aus dem Ergebnis von JSON.parse, zwei Leerzeichen Einzug ── */

  /** Ein Wert → Zeilen (HTML) mit den Rollen `tk-function` (Schlüssel), `tk-string`, `tk-number` und `tk-keyword`. */
  function jsonZeilen(wert, zeile) {
    const zeilen = [];
    jsonWert(wert, { einzug: '', vorne: '', hinten: '' }, zeilen, zeile);
    return zeilen;
  }

  function jsonWert(wert, ort, zeilen, zeile) {
    if (Array.isArray(wert)) {
      jsonListe(wert.map(w => ['', w]), ['[', ']'], ort, zeilen, zeile);
      return;
    }
    if (istObjekt(wert)) {
      const felder = Object.entries(wert).map(([k, w]) => [`<span class="tk-function">${zeile(JSON.stringify(k))}</span>: `, w]);
      jsonListe(felder, ['{', '}'], ort, zeilen, zeile);
      return;
    }
    zeilen.push(`${ort.einzug}${ort.vorne}${jsonSkalar(wert, zeile)}${ort.hinten}`);
  }

  function jsonListe(eintraege, [auf, zu], ort, zeilen, zeile) {
    if (!eintraege.length) {
      zeilen.push(`${ort.einzug}${ort.vorne}${auf}${zu}${ort.hinten}`);
      return;
    }
    zeilen.push(`${ort.einzug}${ort.vorne}${auf}`);
    eintraege.forEach(([vorne, w], i) => {
      let hinten = ',';
      if (i === eintraege.length - 1) hinten = '';
      jsonWert(w, { einzug: ort.einzug + '  ', vorne, hinten }, zeilen, zeile);
    });
    zeilen.push(`${ort.einzug}${zu}${ort.hinten}`);
  }

  const JSON_ROLLE = { string: 'tk-string', number: 'tk-number' };
  function jsonSkalar(wert, zeile) {
    const rolle = JSON_ROLLE[typeof wert] || 'tk-keyword';
    return `<span class="${rolle}">${zeile(JSON.stringify(wert))}</span>`;
  }

  function jsonBlock(wert, zeile, block) {
    return kuerzungHtml(jsonZeilen(wert, zeile), block, preHuelle(' class="lv-json"'));
  }

  /** `{wert}` aus JSON.parse oder null, wenn der Text kein JSON ist. */
  function jsonLesen(text) {
    try {
      return { wert: JSON.parse(text) };
    } catch (_) {
      return null;
    }
  }

  const istObjekt = w => typeof w === 'object' && w !== null && !Array.isArray(w);
  const istFlach = o => Object.values(o).every(w => w === null || typeof w !== 'object');

  /** Innerhalb der Grenzen für „Schlüssel: Wert“, JSON-Satz und Diff: höchstens 64 KiB und 2.000 Zeilen. */
  function satzErlaubt(text) {
    if (bytesUeber(text, SATZ_GRENZEN.aufrufBytes)) return false;
    let zeilen = 1;
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
      zeilen++;
      if (zeilen > SATZ_GRENZEN.aufrufZeilen) return false;
    }
    return true;
  }

  /* ── Aufruf (N4 Punkt 2, FA 1–4, 13) ── */

  /** Text eines Aufrufs → HTML des Inhalts im Block „Aufruf“, oder null für „wie heute als `pre`“: über den Grenzen, kein JSON, oder ein
      Satz, der mehr markierbare Zeichen zeigte, als im Text stehen und gebucht sind (etwa ein Escape `‮`). */
  function aufrufSatz(name, text, zeile) {
    if (!satzErlaubt(text)) return null;
    const gelesen = jsonLesen(text);
    if (gelesen === null) return null;
    const zaehler = markenZaehler(zeile);
    const html = aufrufInhalt(name, gelesen.wert, zaehler.zeile);
    if (zaehler.gezeigt() > markenIn(text)) return null;
    return html;
  }

  function aufrufInhalt(name, wert, zeile) {
    if (!istObjekt(wert)) return jsonBlock(wert, zeile, 'aufruf');
    if (name === 'Bash' && typeof wert.command === 'string') return shellHtml(wert, zeile);
    if (name === 'Edit' && typeof wert.old_string === 'string' && typeof wert.new_string === 'string') return editHtml(wert, zeile);
    if (name === 'Write' && typeof wert.content === 'string') return writeHtml(wert, zeile);
    if (!istFlach(wert)) return jsonBlock(wert, zeile, 'aufruf');
    return felderHtml(Object.entries(wert), zeile);
  }

  /** Bash: `command` als Shell-Block, `description` entfällt (sie steht als Absicht in der Zusammenfassung), der Rest als Felder. */
  function shellHtml(wert, zeile) {
    const befehl = kuerzungHtml(textZeilen(shellUmbruch(wert.command)).map(zeile), 'aufruf', preHuelle(' class="lv-sh"'));
    const weitere = Object.entries(wert).filter(([k]) => k !== 'command' && k !== 'description');
    return befehl + felderHtml(weitere, zeile);
  }

  /** Edit: Felder außer den Texten, darunter der Diff, `replace_all` nur bei `true` als Feld unter dem Diff. */
  function editHtml(wert, zeile) {
    const ohneDiff = Object.entries(wert).filter(([k]) => !['old_string', 'new_string', 'replace_all'].includes(k));
    let alleErsetzen = '';
    if (wert.replace_all === true) alleErsetzen = felderHtml([['replace_all', true]], zeile);
    return felderHtml(ohneDiff, zeile) + diffHtml(editDiff(wert.old_string, wert.new_string), zeile) + alleErsetzen;
  }

  /** Write: Felder außer `content`, darunter `content` ganz als hinzugefügt. */
  function writeHtml(wert, zeile) {
    const ohneInhalt = Object.entries(wert).filter(([k]) => k !== 'content');
    return felderHtml(ohneInhalt, zeile) + diffHtml(editDiff('', wert.content), zeile);
  }

  /** Felder als „Schlüssel: Wert“ in der Reihenfolge des Objekts; ohne Felder nichts. */
  function felderHtml(felder, zeile) {
    if (!felder.length) return '';
    return `<dl class="lv-kv">${felder.map(([schluessel, wert]) => feldHtml(zeile(schluessel), wert, zeile)).join('')}</dl>`;
  }

  /** Ein Text mit `\n` steht als Block unter seinem Schlüssel, ein verschachtelter Wert als JSON-Block, alles andere daneben. */
  function feldHtml(schluessel, wert, zeile) {
    if (typeof wert === 'string' && wert.includes('\n')) return `<dt class="blk">${schluessel}:</dt><dd class="blk">${kuerzungHtml(textZeilen(wert).map(zeile), 'aufruf', preHuelle(''))}</dd>`;
    if (wert !== null && typeof wert === 'object') return `<dt class="blk">${schluessel}:</dt><dd class="blk">${jsonBlock(wert, zeile, 'aufruf')}</dd>`;
    if (typeof wert === 'string') return `<dt>${schluessel}:</dt><dd>${zeile(wert)}</dd>`;
    return `<dt>${schluessel}:</dt><dd>${zeile(JSON.stringify(wert))}</dd>`;
  }

  /* ── Diff (N4 Punkt 2, FA 4): Präfix und Suffix als Kontext, kein LCS ── */

  /** `alt`, `neu` → Zeilen `{art: 'kontext'|'weg'|'neu', zeile}`; ein leerer Text hat keine Zeilen, Präfix und Suffix überlappen nie. */
  function editDiff(alt, neu) {
    const a = diffZeilen(alt), b = diffZeilen(neu);
    let vorne = 0;
    while (vorne < a.length && vorne < b.length && a[vorne] === b[vorne]) vorne++;
    let hinten = 0;
    while (hinten < a.length - vorne && hinten < b.length - vorne && a[a.length - 1 - hinten] === b[b.length - 1 - hinten]) hinten++;
    const als = art => z => ({ art, zeile: z });
    return [
      ...a.slice(0, vorne).map(als('kontext')),
      ...a.slice(vorne, a.length - hinten).map(als('weg')),
      ...b.slice(vorne, b.length - hinten).map(als('neu')),
      ...a.slice(a.length - hinten).map(als('kontext')),
    ];
  }

  function diffZeilen(text) {
    if (text === '') return [];
    return text.split('\n');
  }

  const DIFF_FORM = {
    kontext: { klasse: 'ctx', marke: ' ', lesetext: '' },
    weg: { klasse: 'del', marke: '−', lesetext: '<span class="vh">entfernt: </span>' },
    neu: { klasse: 'add', marke: '+', lesetext: '<span class="vh">hinzugefügt: </span>' },
  };

  /** Diff-Zeilen wie auf der Review-Seite, ohne Syntaxfarben und Zeilennummern, gekürzt als „… der Änderung“. */
  function diffHtml(diff, zeile) {
    const zeilen = diff.map(({ art, zeile: z }) => {
      const form = DIFF_FORM[art];
      return `<div class="${form.klasse}"><span class="m" aria-hidden="true">${form.marke}</span>${form.lesetext}<span class="c">${zeile(z)}</span></div>`;
    });
    return kuerzungHtml(zeilen, 'aenderung', teile => `<div class="lv-dif">${teile.join('')}</div>`);
  }

  /* ── Budget der Marken: ein Satz zeigt nie mehr markierbare Zeichen, als `zeichenBuchen` (lauf.js) im Text gebucht hat ── */

  /** Was `zeichenBuchen` als Marke zählt (MARKIERBAR in lauf.js); ein Node-Test hält beide gleich. */
  const MARKIERBAR = new RegExp('[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\u0000-\u0008\u000B-\u001F\u007F-\u009F\u00AD\u200B-\u200D\u2028\u2029\u2060\uFEFF]', 'g');

  function markenIn(text) {
    const treffer = text.match(MARKIERBAR);
    if (treffer === null) return 0;
    return treffer.length;
  }

  /** `zeile` mit Zähler der markierbaren Zeichen, die der Satz zeigt. */
  function markenZaehler(zeile) {
    let gezeigt = 0;
    return {
      zeile: t => { gezeigt += markenIn(t); return zeile(t); },
      gezeigt: () => gezeigt,
    };
  }

  Object.assign(ziel, { SATZ_GRENZEN, shellUmbruch, kuerzungHtml, jsonZeilen, aufrufSatz, editDiff, MARKIERBAR_SATZ: MARKIERBAR });
})(typeof module !== 'undefined' ? module.exports : window);
