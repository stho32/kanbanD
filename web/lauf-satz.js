/* kanbanD — Satz der Laufansicht (R00240, ADR-0041 N4): der aufgeklappte Teil eines Schritts. Aufruf als Shell-Block, „Schlüssel:
   Wert“, Diff oder JSON; Ergebnis in Festbreite mit Testzeile, Marke „gekürzt“, eingebetteten Systemhinweisen und Kürzung auf 20 Zeilen.
   Rein, im Browser und in Node wie lauf.js. Jedes Zeichen aus fremdem Text geht über `zeile` (maskiert und sichtbar gemacht). */
(function (ziel) {
  'use strict';

  /** Grenzen je Eintrag (N4 Punkt 7); darüber steht der Aufruf wie heute als `pre`, ein Ergebnis als Text. Nie in der Oberfläche.
      `jsonTiefe` und `satzZeichen` deckeln Stapel und HTML eines JSON-Satzes, `hinweise` die eingebetteten Hinweise je Text, `farben`
      die Spannen der Farbfolgen je Ergebnis (N6 Punkt 4). */
  const SATZ_GRENZEN = Object.freeze({ aufrufBytes: 65536, aufrufZeilen: 2000, befehlBytes: 16384, jsonTiefe: 32, satzZeichen: 524288, hinweise: 200, farben: 2000 });
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

  /** `command` → derselbe Text mit `\n` nach `&&`, `||` und `;` auf oberster Ebene: nie in `'…'`, `$'…'`, `"…"`, `$(…)`, `${…}` oder
      Backticks, auch nicht verschachtelt, nie nach `\`, nie bei `;;`, `;&` und `;;&`, nie hinter einem `#`, das ein Wort beginnt, nie ab dem ersten `<<`,
      nie am Ende oder vor einem `\n`. Bleibt am Ende eine Klammer oder ein Anführungszeichen offen, unverändert — im Zweifel kein Umbruch.
      Über 16 KiB unverändert. Ein Durchlauf. */
  function shellUmbruch(befehl) {
    if (bytesUeber(befehl, SATZ_GRENZEN.befehlBytes)) return befehl;
    const offen = [];
    let aus = '', klammern = 0;
    for (let i = 0; i < befehl.length;) {
      const art = offen[offen.length - 1];
      if (art === undefined && befehl[i] === '(') klammern++;
      if (istCode(art) && befehl.startsWith('<<', i)) return aus + befehl.slice(i);
      let operator = null;
      if (art === undefined) operator = operatorAn(befehl, i);
      if (caseInKlammer(befehl, i, offen, klammern)) return befehl;
      if (operator !== null) {
        aus += operator;
        i += operator.length;
        if (!CASE_ENDEN.includes(operator) && umbruchErlaubt(befehl[i])) aus += '\n';
        continue;
      }
      const laenge = shellStueck(befehl, i, offen);
      if (art === undefined && befehl[i] === ')' && klammern > 0) klammern--;
      aus += befehl.slice(i, i + laenge);
      i += laenge;
    }
    if (offen.length) return befehl;
    return aus;
  }

  /** Was eine offene Art schließt: Anführungszeichen, `$'…'`, `${…}`, `$(…)` und Klammern darin. */
  const SHELL_ENDE = Object.freeze({ "'": "'", "$'": "'", '"': '"', '`': '`', '${': '}', '$(': ')', '(': ')' });
  /** Oberste Ebene, `$(…)` und Klammern darin lesen sich als Befehl: Kommentar und Heredoc gelten dort. */
  const istCode = art => art === undefined || art === '$(' || art === '(';

  /** Länge des Stücks ab `i` — ein Zeichen, ein Escape `\x`, eine Öffnung wie `$(` oder ein Kommentar —, `offen` nachgeführt. */
  function shellStueck(text, i, offen) {
    const art = offen[offen.length - 1], c = text[i];
    if (art === "'") {
      if (c === "'") offen.pop();
      return 1;
    }
    if (c === '\\') return 2;
    if (art !== undefined && c === SHELL_ENDE[art]) {
      offen.pop();
      return 1;
    }
    if (art === "$'" || art === '`') return 1;
    const oeffnung = oeffnungAn(text, i, art);
    if (oeffnung !== null) {
      offen.push(oeffnung);
      return oeffnung.length;
    }
    if (istCode(art) && c === '#' && wortbeginn(text[i - 1])) return kommentarLaenge(text, i);
    return 1;
  }

  /** Was an `i` eine Art öffnet, oder null: in `"…"` nur `$(`, `${` und Backticks, in `${…}` dazu Anführungszeichen, in `$(…)` auch `(`. */
  function oeffnungAn(text, i, art) {
    const zwei = text.slice(i, i + 2);
    if (zwei === '$(' || zwei === '${') return zwei;
    const c = text[i];
    if (c === '`') return c;
    if (art === '"') return null;
    if (zwei === "$'") return zwei;
    if (c === "'" || c === '"') return c;
    if (c === '(' && (art === '$(' || art === '(')) return c;
    return null;
  }

  function kommentarLaenge(text, i) {
    const ende = text.indexOf('\n', i);
    if (ende < 0) return text.length - i;
    return ende - i;
  }

  const wortbeginn = davor => davor === undefined || /[\s;&|()]/.test(davor);
  const umbruchErlaubt = danach => danach !== undefined && danach !== '\n';

  /** Ende eines `case`-Zweigs: danach kein Umbruch, `;&` und `;;&` sind je ein Operator. */
  const CASE_ENDEN = [';;&', ';;', ';&'];

  /** Steht ab `i` das Wort `case` im Code innerhalb von `$(…)` oder `(…)`? Dann bleibt der ganze Befehl unverändert — im Zweifel kein Umbruch. */
  function caseInKlammer(text, i, offen, klammern) {
    if (klammern === 0 && !offen.some(art => art === '$(' || art === '(')) return false;
    if (!istCode(offen[offen.length - 1]) || !text.startsWith('case', i)) return false;
    return wortbeginn(text[i - 1]) && /[\s;&|()]|^$/.test(text[i + 4] ?? '');
  }

  function operatorAn(text, i) {
    const drei = CASE_ENDEN.find(ende => text.startsWith(ende, i));
    if (drei !== undefined) return drei;
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

  /** Innerhalb der Grenzen für „Schlüssel: Wert“, JSON-Satz und Diff: höchstens 64 KiB, 2.000 Zeilen und 32 Ebenen Verschachtelung. */
  function satzErlaubt(text) {
    if (bytesUeber(text, SATZ_GRENZEN.aufrufBytes)) return false;
    if (tiefeUeber(text, SATZ_GRENZEN.jsonTiefe)) return false;
    let zeilen = 1;
    for (let i = text.indexOf('\n'); i >= 0; i = text.indexOf('\n', i + 1)) {
      zeilen++;
      if (zeilen > SATZ_GRENZEN.aufrufZeilen) return false;
    }
    return true;
  }

  /** Mehr als `grenze` offene `[` bzw. `{` außerhalb von JSON-Texten? Ein Durchlauf ohne Rekursion — der Satz selbst rekursiert je Ebene. */
  function tiefeUeber(text, grenze) {
    let tiefe = 0, imText = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (imText) {
        if (c === '\\') i++;
        else if (c === '"') imText = false;
        continue;
      }
      if (c === '"') imText = true;
      else if (c === '[' || c === '{') tiefe++;
      else if (c === ']' || c === '}') tiefe--;
      if (tiefe > grenze) return true;
    }
    return false;
  }

  /** `setzen()` → sein HTML, oder null, wenn es über `satzZeichen` läge oder der Stapel nicht reicht (RangeError): dann der Rückfall. */
  function gedeckelt(setzen) {
    let html;
    try {
      html = setzen();
    } catch (fehler) {
      if (fehler instanceof RangeError) return null;
      throw fehler;
    }
    if (html.length > SATZ_GRENZEN.satzZeichen) return null;
    return html;
  }

  /* ── Aufruf (N4 Punkt 2, FA 1–4, 13) ── */

  /** Text eines Aufrufs → HTML des Inhalts im Block „Aufruf“, oder null für „wie heute als `pre`“: über den Grenzen, kein JSON, oder ein
      Satz, der mehr markierbare Zeichen zeigte, als im Text stehen und gebucht sind (etwa ein Escape `‮`). Mit `pfade = {wurzeln,
      ergebnis}` (R00242 FA 2, 4) ist das Pfadfeld ein Link und Pfade in Befehl und anderen Feldern zeigen Marken; ohne wie bisher. Mit
      `fehler` ist der Schritt fehlgeschlagen: der Diff von Edit und Write steht als „nicht angewendet“ (N6 Punkt 6). */
  function aufrufSatz(name, text, zeile, pfade = null, fehler = false) {
    if (!satzErlaubt(text)) return null;
    const gelesen = jsonLesen(text);
    if (gelesen === null) return null;
    const zaehler = markenZaehler(zeile);
    const html = gedeckelt(() => aufrufInhalt(name, gelesen.wert, aufrufSetzer(name, gelesen.wert, zaehler.zeile, pfade), fehler));
    if (html === null || zaehler.gezeigt() > markenIn(text)) return null;
    return html;
  }

  /** Wie der Aufruf Texte setzt: `zeile` für Schlüssel, JSON und Diff, `text` für Befehl und Texte der Felder, `feld` für den Wert eines
      einzeiligen Felds. Mit Pfaden ist nur das Pfadfeld von Read, Edit, Write und NotebookEdit ein Link (PO Z. 593). */
  function aufrufSetzer(name, wert, zeile, pfade) {
    if (pfade === null) return { zeile, text: zeile, feld: (schluessel, t) => zeile(t) };
    const text = t => markenImText(t, pfade.wurzeln, zeile);
    const sprung = sprungImAufruf(name, wert, pfade.ergebnis);
    const feld = (schluessel, t) => {
      if (schluessel !== PFADFELD[name]) return text(t);
      return pfadLinkHtml(t, sprung, pfade.wurzeln, true, zeile);
    };
    return { zeile, text, feld };
  }

  function aufrufInhalt(name, wert, setzer, fehler) {
    if (!istObjekt(wert)) return jsonBlock(wert, setzer.zeile, 'aufruf');
    if (name === 'Bash' && typeof wert.command === 'string') return shellHtml(wert, setzer);
    if (name === 'Edit' && typeof wert.old_string === 'string' && typeof wert.new_string === 'string') return editHtml(wert, setzer, fehler);
    if (name === 'Write' && typeof wert.content === 'string') return writeHtml(wert, setzer, fehler);
    if (!istFlach(wert)) return jsonBlock(wert, setzer.zeile, 'aufruf');
    return felderHtml(Object.entries(wert), setzer);
  }

  /** Bash: `command` als Shell-Block, `description` entfällt (sie steht als Absicht in der Zusammenfassung), der Rest als Felder. */
  function shellHtml(wert, setzer) {
    const befehl = kuerzungHtml(textZeilen(shellUmbruch(wert.command)).map(setzer.text), 'aufruf', preHuelle(' class="lv-sh"'));
    const weitere = Object.entries(wert).filter(([k]) => k !== 'command' && k !== 'description');
    return befehl + felderHtml(weitere, setzer);
  }

  /** Edit: Felder außer den Texten, darunter der Diff, `replace_all` nur bei `true` als Feld unter dem Diff. */
  function editHtml(wert, setzer, fehler) {
    const ohneDiff = Object.entries(wert).filter(([k]) => !['old_string', 'new_string', 'replace_all'].includes(k));
    let alleErsetzen = '';
    if (wert.replace_all === true) alleErsetzen = felderHtml([['replace_all', true]], setzer);
    return felderHtml(ohneDiff, setzer) + diffHtml(editDiff(wert.old_string, wert.new_string), setzer.zeile, fehler) + alleErsetzen;
  }

  /** Write: Felder außer `content`, darunter `content` ganz als hinzugefügt. */
  function writeHtml(wert, setzer, fehler) {
    const ohneInhalt = Object.entries(wert).filter(([k]) => k !== 'content');
    return felderHtml(ohneInhalt, setzer) + diffHtml(editDiff('', wert.content), setzer.zeile, fehler);
  }

  /** Felder als „Schlüssel: Wert“ in der Reihenfolge des Objekts; ohne Felder nichts. */
  function felderHtml(felder, setzer) {
    if (!felder.length) return '';
    return `<dl class="lv-kv">${felder.map(([schluessel, wert]) => feldHtml(schluessel, wert, setzer)).join('')}</dl>`;
  }

  /** Ein Text mit `\n` steht als Block unter seinem Schlüssel, ein verschachtelter Wert als JSON-Block, alles andere daneben. */
  function feldHtml(schluessel, wert, setzer) {
    const name = setzer.zeile(schluessel);
    if (typeof wert === 'string' && wert.includes('\n')) return `<dt class="blk">${name}:</dt><dd class="blk">${kuerzungHtml(textZeilen(wert).map(setzer.text), 'aufruf', preHuelle(''))}</dd>`;
    if (wert !== null && typeof wert === 'object') return `<dt class="blk">${name}:</dt><dd class="blk">${jsonBlock(wert, setzer.zeile, 'aufruf')}</dd>`;
    if (typeof wert === 'string') return `<dt>${name}:</dt><dd>${setzer.feld(schluessel, wert)}</dd>`;
    return `<dt>${name}:</dt><dd>${setzer.zeile(JSON.stringify(wert))}</dd>`;
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
    kontext: { klasse: 'ctx', marke: ' ', lesetext: '', vorgesehen: '' },
    weg: { klasse: 'del', marke: '−', lesetext: '<span class="vh">entfernt: </span>', vorgesehen: '<span class="vh">vorgesehen zu entfernen: </span>' },
    neu: { klasse: 'add', marke: '+', lesetext: '<span class="vh">hinzugefügt: </span>', vorgesehen: '<span class="vh">vorgesehen hinzuzufügen: </span>' },
  };
  const NICHT_ANGEWENDET = '<p class="lv-na">Nicht angewendet — der Schritt ist fehlgeschlagen.</p>';

  /** Diff-Zeilen wie auf der Review-Seite, ohne Syntaxfarben und Zeilennummern, gekürzt als „… der Änderung“. Ist der Schritt
      fehlgeschlagen, steht der Satz „Nicht angewendet …“ darüber, der Diff gedämpft (`nicht-angewendet`) mit Lesetext „vorgesehen …“. */
  function diffHtml(diff, zeile, fehler) {
    const zeilen = diff.map(({ art, zeile: z }) => {
      const form = DIFF_FORM[art];
      let lesetext = form.lesetext;
      if (fehler) lesetext = form.vorgesehen;
      return `<div class="${form.klasse}"><span class="m" aria-hidden="true">${form.marke}</span>${lesetext}<span class="c">${zeile(z)}</span></div>`;
    });
    if (!fehler) return kuerzungHtml(zeilen, 'aenderung', teile => `<div class="lv-dif">${teile.join('')}</div>`);
    return NICHT_ANGEWENDET + kuerzungHtml(zeilen, 'aenderung', teile => `<div class="lv-dif nicht-angewendet">${teile.join('')}</div>`);
  }

  /* ── Ergebnis (N4 Punkt 3, FA 1, 5–10) ── */

  const LEER = '<p class="lv-gedaempft">Leeres Ergebnis.</p>';
  const NUR_HINWEIS = '<p class="lv-nurh">Nur Systemhinweis, ausgeblendet (Filter „Systemhinweise“).</p>';

  /** Text eines Ergebnisses → `{html, kurz, fehlerText, hinweise}`: `kurz` ist die Kurzform der Zusammenfassung (`gekuerzt`,
      `systemhinweis` oder null), `fehlerText` der Text, an dessen Anfang `fehlerErkennen` prüft, `hinweise` die Zahl der eingebetteten.
      Eine von Claude Code gekürzte Ausgabe trägt die Marke, darunter die Vorschau, gesetzt wie ein Ergebnis. */
  function ergebnisSatz(text, zeile, pfade = null) {
    const gekuerzt = gekuerztErkennen(text);
    if (gekuerzt === null) return { ...ergebnisKoerper(text, zeile), fehlerText: text };
    let inhalt = text;
    if (gekuerzt.form) inhalt = gekuerzt.vorschau;
    const koerper = ergebnisKoerper(inhalt, zeile);
    return { html: markeHtml(gekuerzt, zeile, pfade) + koerper.html, kurz: 'gekuerzt', fehlerText: inhalt, hinweise: koerper.hinweise };
  }

  /** Der Inhalt unter „Ergebnis“: leer, ein JSON-Objekt oder Text mit Testzeile und eingebetteten Hinweisen, gekürzt; nie Markdown. */
  function ergebnisKoerper(text, zeile) {
    if (!text.trim()) return { html: LEER, kurz: null, hinweise: 0 };
    const json = jsonErgebnis(text);
    let jsonHtml = null;
    if (json !== null) jsonHtml = gedeckelt(() => jsonBlock(json, zeile, 'ergebnis'));
    if (jsonHtml !== null) return { html: jsonHtml, kurz: null, hinweise: 0 };
    const teile = systemhinweiseTrennen(text);
    const hinweise = teile.filter(t => t.art === 'hinweis').length;
    const nurHinweise = hinweise > 0 && teile.every(t => t.art === 'hinweis' || !t.text.trim());
    let kurz = null, nachsatz = '';
    if (nurHinweise) {
      kurz = 'systemhinweis';
      nachsatz = NUR_HINWEIS;
    }
    return { html: testzeileHtml(testzeileFinden(text), zeile) + teileHtml(teile, zeile) + nachsatz, kurz, hinweise };
  }

  /** Ein Ergebnis, das ganz ein JSON-Objekt ist, innerhalb der Grenzen, der Deckelung und des Budgets der Marken; sonst null. */
  function jsonErgebnis(text) {
    if (!text.trimStart().startsWith('{') || !satzErlaubt(text)) return null;
    const gelesen = jsonLesen(text);
    if (gelesen === null || !istObjekt(gelesen.wert)) return null;
    const zaehler = markenZaehler(t => t);
    const gesetzt = gedeckelt(() => jsonZeilen(gelesen.wert, zaehler.zeile).join('\n'));
    if (gesetzt === null || zaehler.gezeigt() > markenIn(text)) return null;
    return gelesen.wert;
  }

  /** Text- und Hinweisteile als Posten der Kürzung: je Textzeile einer, je Hinweis einer mit dem Gewicht seiner Zeilen. Offen bleibt,
      was vor der 21. Zeile beginnt; der Rest steht hinter „weitere <n> Zeilen“, n in Zeilen des Texts. */
  function teileHtml(teile, zeile) {
    const posten = teile.flatMap(t => {
      if (t.art === 'hinweis') return [{ hinweis: true, html: systemhinweisHtml(t.text, zeile), zeilen: textZeilen(t.text).length }];
      if (!t.text) return [];
      return textZeilen(t.text).map(z => ({ hinweis: false, html: zeile(z), zeilen: 1 }));
    });
    let gezeigt = 0, schnitt = 0;
    while (schnitt < posten.length && gezeigt < OFFENE_ZEILEN) {
      gezeigt += posten[schnitt].zeilen;
      schnitt++;
    }
    const offen = postenHtml(posten.slice(0, schnitt));
    if (schnitt === posten.length) return offen;
    const rest = posten.slice(schnitt);
    return offen + mehrHtml(rest.reduce((summe, p) => summe + p.zeilen, 0), 'ergebnis', postenHtml(rest));
  }

  /** Folgen von Textzeilen je in ein `pre`, Hinweise dazwischen als eigene Blöcke. */
  function postenHtml(posten) {
    let html = '', zeilen = [];
    for (const p of posten) {
      if (!p.hinweis) {
        zeilen.push(p.html);
        continue;
      }
      if (zeilen.length) html += `<pre>${zeilen.join('\n')}</pre>`;
      zeilen = [];
      html += p.html;
    }
    if (zeilen.length) html += `<pre>${zeilen.join('\n')}</pre>`;
    return html;
  }

  const PFEIL = `<span class="pf">${PFEIL_KLEIN}</span>`;
  const ERSTE_ZEILE_ZEICHEN = 200;

  /** Eingebetteter Systemhinweis (PO Z. 600, 603), eingeklappt wie die Systemhinweis-Zeile: Wort und erste Zeile des Blocks;
      aufgeklappt der Block in Festbreite. Der Filter „Systemhinweise“ blendet ihn über die Klasse `lv-ein` aus. */
  function systemhinweisHtml(text, zeile) {
    const zeilen = textZeilen(text);
    const z1 = Array.from(zeilen[0]).slice(0, ERSTE_ZEILE_ZEICHEN).join('');
    return `<details class="lv-e sys lv-ein"><summary>${PFEIL}<span class="nm">Systemhinweis</span><span class="z1">${zeile(z1)}</span></summary><pre>${zeilen.map(zeile).join('\n')}</pre></details>`;
  }

  /* ── Systemhinweise im Text (N4 Nachtrag 261-architekt-2 Punkt 1, PO Z. 603) ── */

  /** Wie viele eingebettete Hinweise der Satz zeigt, ohne zu setzen: ein Ergebnis wie `ergebnisSatz` (Vorschau einer gekürzten Ausgabe,
      ein JSON-Objekt ohne), eine Nachricht ihren Text. Für die Ansage aus der Auswertung (PO Z. 608). */
  function systemhinweiseZaehlen(text, istErgebnis) {
    if (!text.includes(HINWEIS_AUF)) return 0;
    let inhalt = text;
    let gekuerzt = null;
    if (istErgebnis) gekuerzt = gekuerztErkennen(text);
    if (gekuerzt !== null && gekuerzt.form) inhalt = gekuerzt.vorschau;
    if (istErgebnis && (!inhalt.trim() || jsonErgebnis(inhalt) !== null)) return 0;
    return systemhinweiseTrennen(inhalt).filter(t => t.art === 'hinweis').length;
  }

  const HINWEIS_AUF = '<system-reminder>';
  const HINWEIS_ZU = '</system-reminder>';

  /** Text → Teile `{art: 'text'|'hinweis', text}`: ein Hinweis ist ein vollständiger Block, der am Zeilenanfang mit `<system-reminder>`
      beginnt und mit `</system-reminder>` schließt; der Umbruch davor und danach gehört zur Grenze. Alles andere bleibt Text. Mehr als
      200 Hinweise in einem Text (Flut) lassen ihn ganz Text bleiben. */
  function systemhinweiseTrennen(text) {
    const teile = [];
    let ab = 0, suche = 0, hinweise = 0;
    for (let auf = text.indexOf(HINWEIS_AUF, suche); auf >= 0; auf = text.indexOf(HINWEIS_AUF, suche)) {
      suche = auf + 1;
      if (auf > 0 && text[auf - 1] !== '\n') continue;
      const zu = text.indexOf(HINWEIS_ZU, auf);
      if (zu < 0) break;
      if (auf > ab) teile.push({ art: 'text', text: text.slice(ab, auf - 1) });
      ab = zu + HINWEIS_ZU.length;
      teile.push({ art: 'hinweis', text: text.slice(auf, ab) });
      hinweise++;
      if (hinweise > SATZ_GRENZEN.hinweise) return [{ art: 'text', text }];
      if (text[ab] === '\n') ab++;
      suche = ab;
    }
    if (ab < text.length || !teile.length) teile.push({ art: 'text', text: text.slice(ab) });
    return teile;
  }

  /* ── Testzeile (N4 Punkt 3, FA 7, PO Z. 598, 613) ── */

  const TESTZEILE = [
    { muster: /^test result: (?:ok|FAILED)\. \d+ passed; (\d+) failed/, fehlschlaege: m => Number(m[1]) },
    { muster: /^# fail (\d+)$/, fehlschlaege: m => Number(m[1]) },
    { muster: /^# pass \d+$/, fehlschlaege: () => 0 },
    { muster: /^\d+ (?:passed|failed)\b/, fehlschlaege: m => fehlschlaegeIn(m.input) },
  ];

  function fehlschlaegeIn(zeile) {
    const m = /(\d+) failed/.exec(zeile);
    if (m === null) return 0;
    return Number(m[1]);
  }

  /** Unter den letzten 20 Zeilen alle in einer der Testformen (PO Z. 619): die letzte mit Fehlschlag → `{zeile, fehler: true}`, sonst
      die letzte der Form → `{zeile, fehler: false}`, ohne eine null. */
  function testzeileFinden(text) {
    let letzte = null, letzterFehlschlag = null;
    for (const zeile of textZeilen(text).slice(-OFFENE_ZEILEN)) {
      const fehlschlaege = fehlschlaegeDerTestzeile(zeile.trim());
      if (fehlschlaege === null) continue;
      letzte = zeile;
      if (fehlschlaege > 0) letzterFehlschlag = zeile;
    }
    if (letzterFehlschlag !== null) return { zeile: letzterFehlschlag, fehler: true };
    if (letzte !== null) return { zeile: letzte, fehler: false };
    return null;
  }

  /** Zahl der Fehlschläge einer Zeile in einer der Testformen, null für jede andere Zeile. */
  function fehlschlaegeDerTestzeile(kern) {
    for (const form of TESTZEILE) {
      const m = form.muster.exec(kern);
      if (m !== null) return form.fehlschlaege(m);
    }
    return null;
  }

  const HAKEN = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
  const KREUZ = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  /** Die Testzeile über dem Ergebnis: Ton, Symbol (Schmuck) und unsichtbar das Urteil vor ihrem Text ohne Einzug (PO Z. 613, 619). */
  function testzeileHtml(testzeile, zeile) {
    if (testzeile === null) return '';
    const text = zeile(testzeile.zeile.trim());
    if (testzeile.fehler) return `<p class="lv-tz fehl">${KREUZ}<span class="vh">Tests fehlgeschlagen: </span><span>${text}</span></p>`;
    return `<p class="lv-tz ok">${HAKEN}<span class="vh">Tests bestanden: </span><span>${text}</span></p>`;
  }

  /* ── Von Claude Code gekürzt (N4 Punkt 3, FA 8, PO Z. 594, 604) ── */

  const PERSISTED = /^\s*<persisted-output>\nOutput too large \(([^)\n]+)\)\. Full output saved to: ([^\n]+)\n\nPreview \([^)\n]*\):\n([\s\S]*?)\n?<\/persisted-output>\s*$/;

  /** null ohne `<persisted-output>` am Anfang (nach Leerraum); `{form: false}`, wenn das Innere nicht zur Form passt; sonst Größe
      (deutsch), Pfad und Vorschau. */
  function gekuerztErkennen(text) {
    if (!text.trimStart().startsWith('<persisted-output>')) return null;
    const m = PERSISTED.exec(text);
    if (m === null) return { form: false };
    const groesse = groesseDeutsch(m[1]);
    if (groesse === null) return { form: false };
    return { form: true, groesse, pfad: m[2], vorschau: m[3] };
  }

  /** „69.9KB“ → „69,9 KB“, „1.2MB“ → „1,2 MB“, „512B“ → „512 B“; eine andere Form ergibt null. */
  function groesseDeutsch(groesse) {
    const m = /^(\d+)(?:\.(\d+))?\s?([KMGT]?B)$/.exec(groesse);
    if (m === null) return null;
    let zahl = m[1];
    if (m[2] !== undefined) zahl += `,${m[2]}`;
    return `${zahl} ${m[3]}`;
  }

  const SCHERE = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.1 15.9M14.5 14.5L20 20M8.1 8.1L12 12"/></svg>';

  /** Die Marke über der Vorschau (PO Z. 594); der Pfad steht an genau einer Stelle, mit `pfade` als Link mit Marke (R00242 FA 5). */
  function markeHtml(gekuerzt, zeile, pfade) {
    if (!gekuerzt.form) return `<p class="lv-cc">${SCHERE}<span>Von Claude Code gekürzt: Der Agent sah nur diese Vorschau.</span></p>`;
    let pfad = zeile(gekuerzt.pfad);
    if (pfade !== null) pfad = pfadLinkHtml(gekuerzt.pfad, null, pfade.wurzeln, true, zeile);
    return `<p class="lv-cc">${SCHERE}<span>Von Claude Code gekürzt (${zeile(gekuerzt.groesse)}): Der Agent sah nur diese Vorschau. Vollständig: <span class="mono lv-ccpfad">${pfad}</span></span></p>`;
  }

  /** Kurzform der Zusammenfassung (PO Z. 604): „Von Claude Code gekürzt“ mit Symbol, ohne Größe. */
  const GEKUERZT_KURZ = `<span class="lv-cck">${SCHERE}Von Claude Code gekürzt</span>`;

  /* ── Wurzeln aus dem Auftragskopf (R00242 FA 1, N4 Punkt 6, M1) ── */

  const { sichtbarTeile } = typeof module !== 'undefined' ? require('./diff.js') : window;

  /** Ändert das Sichtbarmachen den Text nicht, trägt er weder Bidi- noch Steuerzeichen. */
  const unveraendertSichtbar = text => sichtbarTeile(String(text)).every(t => !t.marke);

  const WURZEL_SCHLUESSEL = /^\s*(Projekt|Arbeitsort|Ablage):/;
  const ERSTER_ABSOLUTER_PFAD = /(?:^|\s)(\/\S+)/;
  /** Satzzeichen und `/` am Ende gehören nicht zum Pfad. */
  const PFAD_ENDE = /[.,;:)/]+$/;

  /** Text des Auftrags → Wurzeln `[{wurzel, marke, art}]`, die längste zuerst. Nur eine Zeile, die selbst mit `Projekt:`, `Arbeitsort:`
      oder `Ablage:` beginnt, gibt Wurzeln her — sie und die durch `·` getrennten Teile darin, die wieder so beginnen; in einer anderen
      Zeile (etwa `Karte:` mit dem Titel) gilt kein Teil nach `·`. Je Art gilt die erste Wurzel, eine spätere derselben Art entfällt.
      Eine Wurzel mit Bidi- oder Steuerzeichen entfällt. */
  function pfadMarken(auftrag) {
    const wurzeln = [];
    for (const zeile of String(auftrag).split('\n')) {
      if (!WURZEL_SCHLUESSEL.test(zeile)) continue;
      for (const teil of zeile.split('·')) {
        const wurzel = wurzelAus(teil);
        if (wurzel !== null && !wurzeln.some(w => w.art === wurzel.art)) wurzeln.push(wurzel);
      }
    }
    return wurzeln.sort((a, b) => b.wurzel.length - a.wurzel.length);
  }

  function wurzelAus(teil) {
    const schluessel = WURZEL_SCHLUESSEL.exec(teil);
    if (schluessel === null) return null;
    const erster = ERSTER_ABSOLUTER_PFAD.exec(teil.slice(schluessel[0].length));
    if (erster === null) return null;
    const wurzel = erster[1].replace(PFAD_ENDE, '');
    if (!wurzel || !unveraendertSichtbar(wurzel)) return null;
    const art = schluessel[1].toLowerCase();
    return { wurzel, marke: markeFuer(art, wurzel), art };
  }

  /** Wortlaut der Marken (PO Z. 596): ‹<letzter Teil des Projekts>›, ‹Worktree #<n>› bei `karte-<n>` am Ende, sonst ‹Arbeitsort›, ‹Ablage›. */
  function markeFuer(art, wurzel) {
    if (art === 'projekt') return `‹${wurzel.slice(wurzel.lastIndexOf('/') + 1)}›`;
    if (art === 'ablage') return '‹Ablage›';
    const karte = /\/karte-(\d+)$/.exec(wurzel);
    if (karte !== null) return `‹Worktree #${karte[1]}›`;
    return '‹Arbeitsort›';
  }

  /** Pfad → `{marke, wurzel, rest}` der längsten Wurzel, mit der er beginnt — nur an einer Grenze `/` —, oder null. */
  function pfadKurz(pfad, wurzeln) {
    const treffer = wurzeln.find(w => pfad === w.wurzel || pfad.startsWith(`${w.wurzel}/`));
    if (treffer === undefined) return null;
    return { marke: treffer.marke, wurzel: treffer.wurzel, rest: pfad.slice(treffer.wurzel.length) };
  }

  /* ── Pfad als Link und Marke (R00242 FA 2, 6; N4 Punkt 5; R00236 FA 4–6) ── */

  const { vscodeLink } = typeof module !== 'undefined' ? require('./review-uebersicht.js') : window;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /** Ein Pfad trägt Marke oder Link nur, wenn das Sichtbarmachen ihn nicht ändert, kein Teil `..` ist und kein `\` vorkommt (unter
      Windows trennt es wie `/`, `\..\` wäre ein verdecktes `..`) — sonst täuschte das Sichtbare über das Ziel. */
  const pfadSauber = pfad => unveraendertSichtbar(pfad) && !pfad.includes('\\') && !pfad.split('/').includes('..');
  /** Ein Link braucht einen absoluten Pfad aus mindestens zwei Teilen. */
  const linkfaehig = pfad => /^\/[^/]+\/./.test(pfad) && pfadSauber(pfad);

  /** Pfad → HTML: mit `mitLink` ein Link nach VS Code (an `sprung`, wenn es eine Zeile gibt), beginnt er mit einer Wurzel, als Marke
      und Rest; ohne Link trägt die Marke den vollen Pfad als `title`. Ein Pfad mit Bidi- oder Steuerzeichen oder einem Teil `..` steht
      als Text. `zeile` maskiert und macht sichtbar (Inhalt), Attribute maskiert `esc`. */
  function pfadLinkHtml(pfad, sprung, wurzeln, mitLink, zeile) {
    if (!pfadSauber(pfad)) return zeile(pfad);
    const inhalt = pfadInhaltHtml(pfad, wurzeln, zeile);
    if (mitLink && linkfaehig(pfad)) return linkHtml(pfad, sprung, inhalt);
    if (pfadKurz(pfad, wurzeln) === null) return inhalt;
    return `<span class="lv-pfadt" title="${esc(pfad)}">${inhalt}</span>`;
  }

  /** Marke als erzeugter Inhalt aus `data-marke`, der volle Anfang als nicht blockifizierter, unsichtbarer Text darin (FA 2). */
  function pfadInhaltHtml(pfad, wurzeln, zeile) {
    const kurz = pfadKurz(pfad, wurzeln);
    if (kurz === null) return zeile(pfad);
    return `<span class="lv-mk" data-marke="${esc(kurz.marke)}"><span class="vh">${zeile(kurz.wurzel)}</span></span>${zeile(kurz.rest)}`;
  }

  /** Der Link: Ziel nur über `vscodeLink`, `title` und bei einer Zeile der Name `<voller Pfad>:<Zeile>` (PO Z. 620–621). */
  function linkHtml(pfad, sprung, inhalt) {
    let name = pfad, beschriftung = '';
    if (sprung !== null) {
      name = `${pfad}:${sprung}`;
      beschriftung = ` aria-label="${esc(name)}"`;
    }
    const schnitt = pfad.lastIndexOf('/');
    const ziel = vscodeLink(pfad.slice(0, schnitt), pfad.slice(schnitt + 1), sprung);
    return `<a class="lv-pfad" href="${esc(ziel)}" title="${esc(name)}"${beschriftung}>${inhalt}</a>`;
  }

  /* ── Pfade im Aufruf (R00242 FA 2, 4): das Pfadfeld als Link, sonst Marken ohne Link ── */

  /** Das Feld, das ein Link wird, je Werkzeug; jedes andere Feld und `command` werden nie einer. */
  const PFADFELD = { Read: 'file_path', Edit: 'file_path', Write: 'file_path', NotebookEdit: 'notebook_path' };
  /** Eine Zeile in der Form von `cat -n`: Zahl, dann Tabulator oder `→`. */
  const CAT_N = /^\s*(\d+)(?:\t|→)/;

  /** Die Zeile des Links: Read an `offset`, Edit an der ersten Zeile seines Ergebnisses in der Form `cat -n`, sonst null. */
  function sprungImAufruf(name, wert, ergebnis) {
    if (name === 'Read' && Number.isInteger(wert.offset) && wert.offset > 0) return wert.offset;
    if (name !== 'Edit' || typeof ergebnis !== 'string') return null;
    for (const z of ergebnis.split('\n')) {
      const m = CAT_N.exec(z);
      if (m !== null) return Number(m[1]);
    }
    return null;
  }

  /** Ein absoluter Pfad in Befehl oder Feld beginnt nach einem Zeichen, das kein Teil eines Pfads ist, und endet vor Leerraum oder
      einem Zeichen der Shell. */
  const PFAD_IM_BEFEHL = /(?<![\w.~/-])\/[^\s"'`<>|;&()]+/g;

  /** Text → HTML mit Marken an jedem Pfad, der mit einer Wurzel beginnt, ohne Link (Befehl, andere Felder, Zusammenfassung). */
  function markenImText(text, wurzeln, zeile) {
    if (!wurzeln.length) return zeile(text);
    let html = '', ab = 0;
    for (const treffer of text.matchAll(PFAD_IM_BEFEHL)) {
      const pfad = treffer[0].replace(/[.,;:]+$/, '');
      if (pfadKurz(pfad, wurzeln) === null) continue;
      html += zeile(text.slice(ab, treffer.index)) + pfadLinkHtml(pfad, null, wurzeln, false, zeile);
      ab = treffer.index + pfad.length;
    }
    return html + zeile(text.slice(ab));
  }

  /* ── Pfade in Nachrichten (R00242 FA 3): für die Option `pfade` von markdownInline, gesucht im rohen Text ── */

  /** Absolut (`/…`) oder relativ (Teile aus Wortzeichen, `.`, `~`, `@`, `+`, `-` mit mindestens einem `/`, auch mit `:<zeile>`). */
  const PFAD_QUELLE = String.raw`\/[^\s\`<>"'*()\[\]]+|[\w.~@+-]+(?:\/[\w.~@+-]+)+(?::\d+){0,2}`;
  /** Ein Pfad beginnt am Anfang, nach Leerraum oder nach `(`, nie als Adresse eines Markdown-Links `](…)`. */
  const PFAD_IM_TEXT = new RegExp(String.raw`(?<![^\s(])(?<!\]\()(?:${PFAD_QUELLE})`, 'g');
  const PFAD_GANZ = new RegExp(`^(?:${PFAD_QUELLE})$`);

  /** Roher Text → `[{von, bis, html}]` der Pfade, die ein Link werden; in einem Durchlauf. */
  function pfadeFinden(roh, wurzeln, zeile) {
    const funde = [];
    for (const treffer of roh.matchAll(PFAD_IM_TEXT)) {
      const stelle = pfadStelle(treffer[0]);
      const html = stelleHtml(stelle, wurzeln, zeile, inhalt => inhalt);
      if (html !== null) funde.push({ von: treffer.index, bis: treffer.index + stelle.geschrieben.length, html });
    }
    return funde;
  }

  /** Füllt ein Pfad den ganzen Inhalt eines Inline-Codes, steht der Code im Link; sonst null (Code bleibt Code). */
  function pfadImCodeHtml(roh, wurzeln, zeile) {
    if (!PFAD_GANZ.test(roh)) return null;
    const stelle = pfadStelle(roh);
    if (stelle.geschrieben !== roh) return null;
    return stelleHtml(stelle, wurzeln, zeile, inhalt => `<code>${inhalt}</code>`);
  }

  /** Treffer → `{geschrieben, pfad, sprung}`: Satzzeichen und `/` am Ende gehören nicht dazu, `:<zeile>` am Ende ist die Zeile, eine
      Spalte dahinter (`:<zeile>:<spalte>`) fällt aus dem Ziel, steht aber in `geschrieben`. */
  function pfadStelle(treffer) {
    const geschrieben = treffer.replace(PFAD_ENDE, '');
    const mitZeile = /^(.+?):(\d+)(?::\d+)?$/.exec(geschrieben);
    if (mitZeile === null) return { geschrieben, pfad: geschrieben, sprung: null };
    return { geschrieben, pfad: mitZeile[1], sprung: Number(mitZeile[2]) };
  }

  /** Ein relativer Pfad braucht eine Endung und einen ersten Teil, der ein Verzeichnisname sein kann: Wortzeichen, `+`, `-`, höchstens ein
      führender Punkt (`.github`, `.`). `~/…` (Heimat) und `@…` (Paketname) lösen nicht gegen den Arbeitsort auf, `Node.js/Express.js`
      oder `v1.2/x.js` mit Punkt mitten im ersten Teil sind keine Pfade. */
  const relativLinkfaehig = pfad => /\.[A-Za-z]\w*$/.test(pfad) && /^\.?[\w+-]+$|^\.$/.test(pfad.split('/')[0]) && pfadSauber(pfad);

  /** Link einer Stelle oder null: absolut mit Marke, relativ nur mit Endung, gegen die Wurzel „Arbeitsort“ und so, wie geschrieben,
      der volle Anfang davor unsichtbar. Sichtbar steht der Text, wie er geschrieben ist, samt `:<zeile>`. */
  function stelleHtml({ geschrieben, pfad, sprung }, wurzeln, zeile, huelle) {
    if (pfad.startsWith('/')) {
      if (!linkfaehig(pfad)) return null;
      return linkHtml(pfad, sprung, huelle(pfadInhaltHtml(geschrieben, wurzeln, zeile)));
    }
    const arbeitsort = wurzeln.find(w => w.art === 'arbeitsort');
    if (arbeitsort === undefined || !relativLinkfaehig(pfad)) return null;
    const anfang = `<span class="lv-anf"><span class="vh">${zeile(`${arbeitsort.wurzel}/`)}</span></span>`;
    return linkHtml(`${arbeitsort.wurzel}/${pfad}`, sprung, huelle(anfang + zeile(geschrieben)));
  }

  /* ── Farbfolgen im Ergebnis (ADR-0041 N6 Punkt 1–5, PO Z. 625): nur die feste Liste wirkt, und nur über feste Klassen ── */

  /** Eine erlaubte Folge `ESC[<p>(;<p>)*m`: höchstens 4 Teile, jeder leer, 0, 1, 2, 22, 31, 32 oder 33. Jede andere bleibt im Text
      und wird dort Marke — auch alles, was Text verbergen könnte (8, 7, Hintergründe, 256 Farben). */
  const FARBFOLGE = /\u001B\[((?:22|31|32|33|0|1|2)?(?:;(?:22|31|32|33|0|1|2)?){0,3})m/y;
  const GRUNDSCHRIFT = Object.freeze({ fett: false, farbe: null });
  const ZURUECK = ['', '0', '22'];

  /** Text und Zustand am Anfang → `{teile, zustand}`: Teile `{text, klasse}` in Folge, ohne die erlaubten Folgen, und der Zustand am
      Ende. `klasse` ist '' (Grundschrift) oder aus `sgr1` (fett) und einer der vier Farben `sgr2`, `sgr31`, `sgr32`, `sgr33`; eine
      Folge, die die Klasse nicht ändert, öffnet keinen neuen Teil, eine Folge ohne Text dahinter keinen leeren. Ein Durchlauf. */
  function farbteile(text, zustand) {
    const teile = [];
    let jetzt = zustand, stueck = '', ab = 0;
    for (let esc = text.indexOf('\u001B'); esc >= 0; esc = text.indexOf('\u001B', esc + 1)) {
      FARBFOLGE.lastIndex = esc;
      const folge = FARBFOLGE.exec(text);
      if (folge === null) continue;
      stueck += text.slice(ab, esc);
      ab = FARBFOLGE.lastIndex;
      const danach = folgeAnwenden(jetzt, folge[1]);
      if (klasseVon(danach) === klasseVon(jetzt)) continue;
      if (stueck) teile.push({ text: stueck, klasse: klasseVon(jetzt) });
      stueck = '';
      jetzt = danach;
    }
    stueck += text.slice(ab);
    if (stueck) teile.push({ text: stueck, klasse: klasseVon(jetzt) });
    return { teile, zustand: jetzt };
  }

  /** Werden die Farbfolgen eines Ergebnisses übersetzt? Nur, wenn es höchstens 2.000 Spannen trägt, je Zeile gezählt, der Zustand über
      die Zeile hinaus; sonst steht es ganz wie ohne Übersetzung, jedes `ESC` eine Marke im Budget (N6 Punkt 4). */
  function farbenErlaubt(text) {
    if (!text.includes('\u001B')) return true;
    let zustand = GRUNDSCHRIFT, spannen = 0;
    for (const zeile of text.split('\n')) {
      const ergebnis = farbteile(zeile, zustand);
      spannen += ergebnis.teile.filter(t => t.klasse).length;
      if (spannen > SATZ_GRENZEN.farben) return false;
      zustand = ergebnis.zustand;
    }
    return true;
  }

  /** Die Teile einer Folge der Reihe nach: 0, 22 und leer setzen alles zurück, 1 setzt fett, jede Farbe ersetzt die vorige. */
  function folgeAnwenden(zustand, teileDerFolge) {
    let jetzt = zustand;
    for (const teil of teileDerFolge.split(';')) {
      if (ZURUECK.includes(teil)) jetzt = GRUNDSCHRIFT;
      else if (teil === '1') jetzt = { ...jetzt, fett: true };
      else jetzt = { ...jetzt, farbe: teil };
    }
    return jetzt;
  }

  function klasseVon(zustand) {
    const klassen = [];
    if (zustand.fett) klassen.push('sgr1');
    if (zustand.farbe !== null) klassen.push(`sgr${zustand.farbe}`);
    return klassen.join(' ');
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

  Object.assign(ziel, { SATZ_GRENZEN, shellUmbruch, kuerzungHtml, jsonZeilen, aufrufSatz, editDiff, ergebnisSatz, systemhinweiseTrennen, systemhinweiseZaehlen, systemhinweisHtml, testzeileFinden, gekuerztErkennen, groesseDeutsch, GEKUERZT_KURZ, MARKIERBAR_SATZ: MARKIERBAR, farbteile, farbenErlaubt, GRUNDSCHRIFT });
  Object.assign(ziel, { pfadMarken, pfadKurz, pfadLinkHtml, pfadeFinden, pfadImCodeHtml, markenImText });
})(typeof module !== 'undefined' ? module.exports : window);
