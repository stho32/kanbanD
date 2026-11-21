/* kanbanD — Review-Seite eines Commits (R00207, ADR-0033): reine Rechnung, im Browser und in Node (Unit-Tests) nutzbar wie commits.js.
   Fremder Text geht hier unverändert durch; maskiert wird erst beim Zeichnen (esc). */
(function (ziel) {
  'use strict';
  const { ZUSTANDSWOERTER, anwendungName, zeilenwerte, datumText, fehlerText: commitsFehlerText } = typeof module !== 'undefined' ? require('./commits.js') : window;

  /** Zustände der Liste, zu denen es einen Diff gibt (ADR-0033 Punkt 2). */
  const MIT_DIFF = ['auf_zweig', 'verwaist'];

  /** Folge der Review-Seite aus der Liste `GET …/commits` und dem vollen Hash der Diff-Antwort (ADR-0033 Punkte 2 und 9):
      gezählt wird über die Einträge mit Diff in der Reihenfolge der Antwort, „i“ nie aus dem Text der Adresse (Rand a).
      Arten: `folge` {i, n, zurueck, vor}, `fremd` (Rand b), `keine` (Rand c), `erster` (Adresse ohne Verweis). */
  function folge(eintraege, vollerHash) {
    const mitDiff = eintraege.filter(e => MIT_DIFF.includes(e.zustand) && e.hash);
    if (!mitDiff.length) return { art: 'keine', eintraege };
    const erster = mitDiff[0].verweis;
    if (!vollerHash) return { art: 'erster', erster };
    const stelle = mitDiff.findIndex(e => e.hash.toLowerCase() === vollerHash.toLowerCase());
    if (stelle < 0) return { art: 'fremd', erster };
    const nachbar = k => (mitDiff[k] ? mitDiff[k].verweis : null);
    return { art: 'folge', i: stelle + 1, n: mitDiff.length, zurueck: nachbar(stelle - 1), vor: nachbar(stelle + 1), erster };
  }


  /* ── Diff rechnen (ADR-0033 Punkte 5–8) ── */

  /** Zeilen, die beim ersten Aufbau höchstens gezeichnet werden (ADR-0033 Punkt 5, gemessen 38 ms gestaffelt). */
  const BUDGET_ZEILEN = 10000;
  /** Zeilen je Block mit `content-visibility: auto`. */
  const BLOCK_ZEILEN = 500;

  const HUNK_KOPF = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

  /** Patch-Text ab der ersten `@@`-Zeile → Zeilen `{art, alt, neu, text}`. Zerlegt nur an `\n` (nicht an `\r`, U+2028, U+0085);
      das abschließende `\n` ergibt keine eigene Zeile. Nummern aus den Hunk-Köpfen; `\ No newline at end of file` ohne Nummer. */
  function patchZeilen(patch) {
    const roh = patch.endsWith('\n') ? patch.slice(0, -1) : patch;
    if (roh === '') return [];
    let alt = 0, neu = 0;
    return roh.split('\n').map(zeile => {
      const kopf = HUNK_KOPF.exec(zeile);
      if (kopf) {
        alt = Number(kopf[1]); neu = Number(kopf[2]);
        // ein leerer Bereich (`-0,0`) beginnt vor der ersten Zeile
        if (alt === 0) alt = 1;
        if (neu === 0) neu = 1;
        return { art: 'kopf', alt: null, neu: null, text: zeile };
      }
      const zeichen = zeile[0], text = zeile.slice(1);
      if (zeichen === '+') return { art: 'plus', alt: null, neu: neu++, text };
      if (zeichen === '-') return { art: 'minus', alt: alt++, neu: null, text };
      if (zeichen === '\\') return { art: 'hinweis', alt: null, neu: null, text: zeile };
      return { art: 'kontext', alt: alt++, neu: neu++, text };
    });
  }

  /* ── Syntaxfarben: Sprache und Grenze (R00217, ADR-0037 Punkte 3 und 7, ADR-0040 Punkt 1) ── */

  /** Höchstens so viele UTF-16-Einheiten hat ein Patch, der gefärbt wird (256 × 1.024, die Grenze der ersten Antwort). */
  const GRENZE_PATCH = 262144;
  /** Höchstens so viele UTF-16-Einheiten hat jede Zeile eines gefärbten Patches, mit Vorzeichen, ohne `\n`. */
  const GRENZE_ZEILE = 1000;

  /** Endung des Dateinamens → Grammatik von Prism (ADR-0037 Punkt 3). */
  const SPRACHEN = new Map(Object.entries({
    rs: 'rust', js: 'javascript', mjs: 'javascript', cjs: 'javascript', json: 'json', css: 'css', html: 'markup', htm: 'markup',
    xml: 'markup', svg: 'markup', md: 'markdown', py: 'python', sh: 'bash', bash: 'bash', yml: 'yaml', yaml: 'yaml', sql: 'sql',
    cs: 'csharp', toml: 'toml', php: 'php', diff: 'diff', patch: 'diff',
  }));

  /** Pfad → Name der Grammatik oder null (ohne Endung, unbekannte Endung); Groß- und Kleinschreibung egal, nur der Dateiname zählt. */
  function spracheZuPfad(pfad) {
    const datei = String(pfad).slice(String(pfad).lastIndexOf('/') + 1);
    const punkt = datei.lastIndexOf('.');
    if (punkt < 0) return null;
    return SPRACHEN.get(datei.slice(punkt + 1).toLowerCase()) ?? null;
  }

  /** Wird ein Patch gefärbt? Nur innerhalb beider Grenzen; darüber geht kein Auftrag an den Worker (R00217 FA 4). */
  function faerbbar(patch) {
    if (patch.length > GRENZE_PATCH) return false;
    return patch.split('\n').every(zeile => zeile.length <= GRENZE_ZEILE);
  }

  /** Richtungsändernde Zeichen: Einbettungen und Isolierungen, dazu LRM, RLM und ALM (Security-Review #209 S1). */
  const BIDI = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
  /** Steuerzeichen außer Tab, dazu Unsichtbares: weiches Trennzeichen, Nullbreiten, Zeilen- und Absatztrenner, Wortverbinder, BOM. */
  const STEUER = /[\u0000-\u0008\u000A-\u001F\u007F-\u009F\u00AD\u200B-\u200D\u2028\u2029\u2060\uFEFF]/;
  const code = z => 'U+' + z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  /** Bildzeichen der Steuerzeichen: U+2400 + Code für 0–31, ␡ für DEL; C1-Zeichen haben keins und stehen nur mit Code. */
  const bildzeichen = z => {
    const c = z.codePointAt(0);
    if (c < 0x20) return String.fromCodePoint(0x2400 + c) + ' ';
    if (c === 0x7F) return '␡ ';
    return '';
  };

  /** Fremder Text → Teile; Unsichtbares wird sichtbar, nie entfernt (ADR-0033 Punkt 8, „Trojan Source“): Bidi-Steuerzeichen als
      Marke `⟨U+202E⟩`, Steuerzeichen außer Tab als Bildzeichen mit Code (ohne Bildzeichen nur der Code), ein `\r` am Ende als `␍`. */
  function sichtbarTeile(text) {
    const teile = [];
    let rest = '';
    const zeichen = Array.from(text);
    zeichen.forEach((z, k) => {
      const bidi = BIDI.test(z), steuer = STEUER.test(z);
      if (!bidi && !steuer) { rest += z; return; }
      if (rest) teile.push({ text: rest });
      rest = '';
      if (bidi) teile.push({ marke: 'bidi', code: code(z), text: `⟨${code(z)}⟩` });
      else if (z === '\r' && k === zeichen.length - 1) teile.push({ marke: 'steuer', code: code(z), text: '␍' });
      else teile.push({ marke: 'steuer', code: code(z), text: bildzeichen(z) + code(z) });
    });
    if (rest) teile.push({ text: rest });
    return teile;
  }

  const name = d => d.neu ?? d.alt;
  const zuGrossGemeldet = (d, hinweise) => hinweise.some(h => h.art === 'zu_gross_zum_anzeigen' && h.datei === name(d));

  /** Zustand einer Datei der Antwort: `zu_gross`, `gross`, `nachladen`, `binaer`, `patch` oder `ohne` (kein Inhalt zu zeigen). */
  function dateiZustand(d, hinweise) {
    if (d.gross && zuGrossGemeldet(d, hinweise)) return 'zu_gross';
    if (d.gross) return 'gross';
    if (d.nachladen) return 'nachladen';
    if (d.binaer) return 'binaer';
    if (typeof d.patch === 'string') return 'patch';
    return 'ohne';
  }

  /** Welche Dateien beim ersten Aufbau offen sind (ADR-0033 Punkt 5): Dateien mit `patch` in Reihenfolge, ganz oder gar nicht,
      solange die gezeichneten Zeilen einschließlich der Datei höchstens das Budget ergeben; die erste mit `patch` immer; nach der
      ersten, die nicht passt, keine mehr. Gelöschte und Dateien ohne `patch` sind zu, zählen nicht und unterbrechen nicht. */
  function aufklappPlan(dateien, hinweise) {
    return aufklappPlanSeite(dateien, hinweise, { rest: BUDGET_ZEILEN, gesperrt: false, erste: true }).offen;
  }

  /** Gezeichnete Zeilen einer Datei, die beim Aufbau öffnen kann; null, wenn sie nicht zählt. Eine Folge-Datei (ADR-0033 N1.4)
      zählt über alle Schritte mit `patch`; ein Schritt ohne `patch` zählt nicht. */
  function planZeilen(d, hinweise) {
    if (Array.isArray(d.schritte)) {
      const mitPatch = d.schritte.filter(s => dateiZustand(s, hinweise) === 'patch');
      if (!mitPatch.length) return null;
      return mitPatch.reduce((n, s) => n + patchZeilen(s.patch).length, 0);
    }
    if (d.status === 'D' || dateiZustand(d, hinweise) !== 'patch') return null;
    return patchZeilen(d.patch).length;
  }

  /** Der Plan über die ganze Seite (ADR-0033 N1.4): `stand` trägt Restbudget, „gesperrt“ (nach der ersten Datei, die nicht passt)
      und „erste“ (die erste Datei der Seite öffnet immer) von Abschnitt zu Abschnitt weiter. Eine Folge-Datei öffnet ganz oder gar nicht. */
  function aufklappPlanSeite(dateien, hinweise, stand) {
    let { rest, gesperrt, erste } = stand;
    const offen = dateien.map(d => {
      const zeilen = planZeilen(d, hinweise);
      if (zeilen === null || gesperrt) return false;
      const passt = erste || zeilen <= rest;
      erste = false;
      if (!passt) { gesperrt = true; return false; }
      rest -= zeilen;
      return true;
    });
    return { offen, stand: { rest, gesperrt, erste } };
  }

  /** Zeilen in Blöcke zu höchstens 500. */
  function bloecke(zeilen) {
    const aus = [];
    for (let k = 0; k < zeilen.length; k += BLOCK_ZEILEN) aus.push(zeilen.slice(k, k + BLOCK_ZEILEN));
    return aus;
  }

  /** Fehlerart aus Status und Text (ADR-0033 Punkt 7): beim Diff `antwortbudget` (503, `fehler` beginnt mit „Antwortbudget“),
      `zeitgrenze` (jeder andere 503), `kein_diff` (404, 400), sonst `anderer` (auch ohne Antwort, Status 0); bei der Liste
      `aufgabe_unbekannt` (404), sonst `anderer`. */
  function fehlerArt({ status, fehler }, quelle) {
    if (quelle === 'commits') return status === 404 ? 'aufgabe_unbekannt' : 'anderer';
    if (status === 503) return typeof fehler === 'string' && fehler.startsWith('Antwortbudget') ? 'antwortbudget' : 'zeitgrenze';
    if (status === 404 || status === 400) return 'kein_diff';
    return 'anderer';
  }

  const gleich = (a, b) => a.status === b.status && a.alt === b.alt && a.neu === b.neu;

  /** Die Datei `i` der Liste in der Antwort auf `datei=` (ADR-0033 Punkt 6): gleicher `status`, `alt`, `neu`, an der Position, die
      ihrer Reihenfolge unter den gleichen der Liste entspricht; null, wenn es sie dort nicht gibt. */
  function zuordnen(dateien, i, antwort) {
    const position = dateien.slice(0, i).filter(d => gleich(d, dateien[i])).length;
    return antwort.filter(d => gleich(d, dateien[i]))[position] || null;
  }

  /* ── Zeichnen (R00207 FA 2–8, 12; Artboard D0009 `#diff-fenster`, `#diff-raender`): HTML-Text aus dem Zustand der Seite.
     Aller fremde Text geht durch `esc` in feste Elemente (ADR-0033 Punkt 8), sichtbar gemachte Zeichen als Marke. ── */

  const tausender = n => String(Number(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const dateienWort = n => (n === 1 ? '1 Datei' : `${tausender(n)} Dateien`);
  const STATUSWORT = { A: ['neu', 'st-neu'], M: ['geändert', 'st-mod'], D: ['gelöscht', 'st-weg'], R: ['umbenannt', 'st-ren'], T: ['Typ geändert', 'st-mod'] };
  const SYMBOLE = {
    auge: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    pfeil: '<path d="M9 5l7 7-7 7"/>',
    server: '<rect x="3" y="4" width="18" height="7"/><rect x="3" y="13" width="18" height="7"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    sanduhr: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
    achtung: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.01"/>',
  };
  const symbol = (name, klasse = '') => `<svg class="i${klasse}" viewBox="0 0 24 24" aria-hidden="true">${SYMBOLE[name]}</svg>`;

  /** Ein Verweis in Kurzform: Kürzel und die ersten 7 Zeichen des Hashs. */
  function kurzVerweis(verweis) {
    const m = /^(?:([a-z0-9]{1,8}):)?([0-9a-fA-F]+)$/.exec(verweis || '');
    if (!m) return verweis || '';
    return (m[1] ? m[1] + ':' : '') + m[2].slice(0, 7);
  }

  /** Fremder Text mit sichtbar gemachten Zeichen; jede Marke ist ein Bild mit Namen, ihr Text bleibt im Dokument. */
  function sichtbarHtml(text, esc) {
    return sichtbarTeile(String(text)).map(t => (t.marke ? markeHtml(t, esc) : esc(t.text))).join('');
  }

  /** Eine Marke als Bild mit Namen. */
  function markeHtml(t, esc) {
    if (t.marke === 'bidi') return `<span class="mk-z mk-bidi" role="img" aria-label="sichtbar gemachtes Bidi-Steuerzeichen ${t.code}">${symbol('auge')}${esc(t.text)}</span>`;
    return `<span class="mk-z mk-st" role="img" aria-label="sichtbar gemachtes Steuerzeichen ${t.code}">${esc(t.text)}</span>`;
  }

  /** Die sieben Rollen der Syntaxfarben (R00217 FA 3); Index wie in `web/faerben.js`. */
  const TK_KLASSEN = ['tk-keyword', 'tk-string', 'tk-comment', 'tk-number', 'tk-function', 'tk-type', 'tk-macro'];

  /** Zeilentext mit Farbstücken `[von, bis, Rolle]` (UTF-16-Versätze im Zeilentext): die Teile aus `sichtbarTeile` bleiben, Text
      ohne Marke wird an den Stückgrenzen in `<span class="tk-…">` geteilt; eine Marke hat Vorrang und bleibt ohne Farbe (ADR-0037
      Punkt 6). Jede Marke steht für genau ein Zeichen des Zeilentexts (alle sichtbar gemachten Zeichen liegen in der BMP). */
  function farbigHtml(text, stuecke, esc) {
    let pos = 0, s = 0;
    return sichtbarTeile(String(text)).map(t => {
      if (t.marke) { pos += 1; return markeHtml(t, esc); }
      const ende = pos + t.text.length;
      let aus = '', bei = pos;
      while (s < stuecke.length && stuecke[s][1] <= bei) s++;
      for (let j = s; j < stuecke.length && stuecke[j][0] < ende; j++) {
        const von = Math.max(stuecke[j][0], bei), bis = Math.min(stuecke[j][1], ende);
        if (von > bei) aus += esc(text.slice(bei, von));
        aus += `<span class="${TK_KLASSEN[stuecke[j][2]]}">${esc(text.slice(von, bis))}</span>`;
        bei = bis;
      }
      if (bei < ende) aus += esc(text.slice(bei, ende));
      pos = ende;
      return aus;
    }).join('');
  }

  /** Fremder Text für ein Attribut (`title`, `aria-label`): die Marken als Text, nie das Zeichen selbst. */
  const sichtbarText = text => sichtbarTeile(String(text)).map(t => t.text).join('');

  /** Pfad mit Ordner (gedämpft) und Name (fett), beide sichtbar gemacht. */
  function pfadHtml(pfad, esc) {
    const schnitt = pfad.lastIndexOf('/') + 1;
    const ordner = pfad.slice(0, schnitt), datei = pfad.slice(schnitt);
    return `${ordner ? `<span class="d">${sichtbarHtml(ordner, esc)}</span>` : ''}<b>${sichtbarHtml(datei, esc)}</b>`;
  }

  const zahlenHtml = d => `<span class="pl">+${tausender(d.plus)}</span> <span class="mi">−${tausender(d.minus)}</span>`;

  /** Was eine Datei an Merkmalen trägt (FA 5): nie still. */
  function merkmalSaetze(d, zustand) {
    const saetze = [];
    if (d.modus_alt && d.modus_neu && d.modus_alt !== d.modus_neu) saetze.push(zustand === 'ohne' ? `Dateimodus ${d.modus_alt} → ${d.modus_neu}; der Inhalt ist unverändert.` : `Dateimodus ${d.modus_alt} → ${d.modus_neu}.`);
    if (d.nicht_utf8) saetze.push('Nicht als UTF-8 lesbar — nicht darstellbare Zeichen sind ersatzweise mit � wiedergegeben.');
    return saetze;
  }

  const LESETEXT = { plus: 'hinzugefügt: ', minus: 'entfernt: ' };
  const ZEICHEN = { plus: '+', minus: '−', kontext: '' };

  /** Inhalt der Codezelle einer Zeile mit Kontext, plus oder minus; mit `stuecke` gefärbt (die Auflage ersetzt nur diesen Inhalt). */
  function zelleHtml(z, esc, stuecke = null) {
    const lesen = LESETEXT[z.art] ? `<span class="vh">${LESETEXT[z.art]}</span>` : '';
    return lesen + (stuecke ? farbigHtml(z.text, stuecke, esc) : sichtbarHtml(z.text, esc));
  }

  function zeileHtml(z, esc) {
    if (z.art === 'kopf') return `<tr class="hk"><td colspan="4">${sichtbarHtml(z.text, esc)}</td></tr>`;
    if (z.art === 'hinweis') return `<tr class="nn"><td class="n" aria-hidden="true"></td><td class="n" aria-hidden="true"></td><td class="m" aria-hidden="true"></td><td class="c">${esc(z.text)}</td></tr>`;
    const klasse = z.art === 'plus' ? 'add' : z.art === 'minus' ? 'del' : 'ctx';
    return `<tr class="${klasse}"><td class="n" aria-hidden="true">${z.alt ?? ''}</td><td class="n" aria-hidden="true">${z.neu ?? ''}</td><td class="m" aria-hidden="true">${ZEICHEN[z.art]}</td><td class="c">${zelleHtml(z, esc)}</td></tr>`;
  }

  /** Geschätzte Breite eines Blocks in px: Chromium misst die Breite eines Elements mit `content-visibility: auto` für die
      Quer-Rolle nach `contain-intrinsic-inline-size`, nicht nach dem Inhalt (geprobt in Chromium aus e2e/node_modules); ohne
      Schätzung schnitte der Block lange Zeilen ab. Großzügig: 8 px je Zeichen (Monospace 12 px, ein Tab 4), dazu die Nummern. */
  function blockBreite(zeilen) {
    const zeichen = z => sichtbarTeile(z.text).reduce((n, t) => n + Array.from(t.text).reduce((m, c) => m + (c === '\t' ? 4 : c.codePointAt(0) > 0x2E7F ? 2 : 1), 0), 0);
    return Math.ceil(Math.max(0, ...zeilen.map(zeichen)) * 8 + 140);
  }

  /** Der Code-Bereich einer offenen Datei: Blöcke zu 500 Zeilen mit `content-visibility: auto` (ADR-0033 Punkt 5), je Block
      eine Tabelle mit dem Namen der Datei; der Bereich ist per Tab erreichbar und scrollt quer. */
  function codeHtml(patch, pfad, esc) {
    const name = `Änderungen in ${esc(sichtbarText(pfad))}`;
    const zeilen = patchZeilen(patch);
    const teile = bloecke(zeilen).map(b => `<div class="dz-b" style="contain-intrinsic-inline-size:${blockBreite(b)}px;contain-intrinsic-block-size:auto ${b.length * 18}px"><table class="dz" aria-label="${name}">${b.map(z => zeileHtml(z, esc)).join('')}</table></div>`);
    return `<div class="df-sc" tabindex="0" role="region" aria-label="${name}"${farbeAttribute(patch, pfad, zeilen)}>${teile.join('')}</div>`;
  }

  /* ── Aufträge der Syntaxfarben (R00217 FA 5–7, ADR-0040 Punkt 5): `codeHtml` zeichnet ungefärbt und legt je färbbarer Datei einen
     Auftrag ab; die Auflage (`web/farbschlange.js`) holt ihn, sobald der Diffbereich im Dokument steht. ── */

  /** Höchstens so viele abgelegte, nie geholte Aufträge bleiben liegen (Zeichnen ohne Einsetzen); der älteste fällt zuerst. */
  const AUFTRAEGE_HOECHSTENS = 500;
  const farbAuftraege = new Map();
  let farbNr = 0;

  /** `data-farbe` am Diffbereich: „laeuft“ mit Auftrag bei bekannter Sprache innerhalb der Grenzen, sonst „nein“ ohne Auftrag. */
  function farbeAttribute(patch, pfad, zeilen) {
    const sprache = spracheZuPfad(pfad);
    if (!sprache || !faerbbar(patch)) return ' data-farbe="nein"';
    farbNr += 1;
    farbAuftraege.set(farbNr, { sprache, zeilen });
    if (farbAuftraege.size > AUFTRAEGE_HOECHSTENS) farbAuftraege.delete(farbAuftraege.keys().next().value);
    return ` data-farbe="laeuft" data-farbe-nr="${farbNr}"`;
  }

  /** Den Auftrag zu `nr` genau einmal holen; null, wenn es ihn nicht (mehr) gibt. */
  function farbAuftragHolen(nr) {
    const auftrag = farbAuftraege.get(nr) || null;
    farbAuftraege.delete(nr);
    return auftrag;
  }

  const knopf = (text, act, arg, id = '') => `<button type="button" class="btn"${id ? ` id="${id}"` : ''} data-act="${act}"${arg == null ? '' : ` data-arg="${arg}"`}>${text}</button>`;

  /** Text und Knopf einer Datei ohne gezeichneten Patch, je Zustand und Ladestand (FA 5, 7, 8). */
  function hinweisHtml(d, i, zustand, stand, esc) {
    if (stand.laden === 'laeuft') return '<p class="df-hin df-laedt" role="status">Lädt die Änderungen …</p>';
    if (stand.laden === 'wartet') return `<p class="df-hin df-wartet" role="status">${symbol('sanduhr')}${wartetText(stand, esc)}</p>`;
    if (stand.laden === 'fehler') return dateiFehlerHtml(stand.fehler, i);
    if (zustand === 'zu_gross') return `<p class="df-hin">Zu groß zum Anzeigen. Es stehen nur die Zahlen: +${tausender(d.plus)} −${tausender(d.minus)}.</p>`;
    if (zustand === 'gross') return `<div class="df-hin"><p>Der Patch ist groß (${tausender(d.plus + d.minus)} Zeilen) und wird erst auf Wunsch geladen.</p>${knopf('Änderungen anzeigen', 'review-nachladen', i)}</div>`;
    if (zustand === 'nachladen') return `<div class="df-hin"><p>Diese Datei war nicht in der ersten Antwort, weil die Antwort zu groß wurde. Sie wird einzeln geladen.</p>${knopf('Nachladen', 'review-nachladen', i)}</div>`;
    if (zustand === 'binaer') return '<p class="df-hin">Binärdatei — der Inhalt wird nicht angezeigt.</p>';
    return '';
  }

  /** Worauf eine wartende Datei wartet: in „Alle Änderungen“ auf eine Anwendung (`wartetAuf`, rohes Kürzel, '' = Standardanwendung;
      null = die andere Datei; ADR-0033 N1.2). Maskiert wird erst hier, beim Einsetzen (R00210 AK 14). */
  function wartetText(stand, esc) {
    if (typeof stand.wartetAuf === 'string') return `Wartet, bis die ${esc(anwendungName(stand.wartetAuf))} geladen ist …`;
    return 'Wartet, bis die andere Datei geladen ist …';
  }

  /** Fehler beim Nachladen an der Datei (FA 8): die Datei bleibt zu, die Seite lesbar; keine Wiederholung ohne Klick. */
  function dateiFehlerHtml(f, i) {
    const erneut = knopf('Erneut versuchen', 'review-nachladen', i);
    if (f.art === 'antwortbudget') return `<div class="df-hin warn" role="status">${symbol('server')}<p><b>Server ausgelastet (Antwortbudget).</b> Die Änderungen dieser Datei wurden nicht geladen. Es wird nicht von selbst wiederholt.</p>${erneut}</div>`;
    if (f.art === 'zeitgrenze') return `<div class="df-hin fehl" role="alert">${symbol('uhr')}<p><b>Zeitgrenze überschritten.</b> Die Änderungen dieser Datei konnten nicht geladen werden (503).</p>${erneut}</div>`;
    return `<div class="df-hin fehl" role="alert">${symbol('achtung')}<p>Die Änderungen dieser Datei ließen sich nicht laden: ${f.text}${statusKlammer(f.status)}.</p>${erneut}</div>`;
  }

  /** „ (<Status>)“ nur, wenn eine Antwort kam; ohne Antwort (Netzabbruch, Status 0) keine Klammer (PO Z. 450). */
  function statusKlammer(status) {
    if (!status) return '';
    return ` (${status})`;
  }

  /** Eine Datei als Abschnitt: Kopf als Knopf mit `aria-expanded`, darunter Merkmale, Hinweis und — offen — der Code. `kennung`
      trägt in „Alle Änderungen“ den Abschnitt mit (`id` „<a>-<i>“, `arg` „<a>:<i>“; ADR-0033 N1.3). */
  function dateiHtml(d, i, stand, hinweise, esc, kennung = { id: i, arg: i }) {
    const { id, arg } = kennung;
    const zustand = dateiZustand(d, hinweise);
    const pfad = d.neu ?? d.alt;
    const [wort, klasse] = STATUSWORT[d.status] || [d.status, 'st-mod'];
    const ren = d.status === 'R' ? `<span class="ren">umbenannt ← ${pfadHtml(d.alt, esc)}${d.aehnlichkeit != null ? ` · ${d.aehnlichkeit} %` : ''}</span>` : '';
    const anzeigen = zustand === 'patch' && !stand.offen ? '<span class="mk">anzeigen</span>' : '';
    const kopf = `<h3 class="df-h"><button type="button" class="df-k" id="rv-dk${id}" data-act="review-klappe" data-arg="${arg}" aria-expanded="${stand.offen}" aria-controls="rv-dc${id}">${symbol('pfeil', ' df-pf')}<span class="st ${klasse}">${esc(wort)}</span><span class="p">${pfadHtml(pfad, esc)}</span>${ren}<span class="z">${zahlenHtml(d)}</span>${anzeigen}</button></h3>`;
    const saetze = merkmalSaetze(d, zustand).map(t => `<p class="df-mm">${esc(t)}</p>`).join('');
    const code = zustand === 'patch' && stand.offen ? codeHtml(d.patch, pfad, esc) : '';
    const inhalt = stand.offen ? saetze + hinweisHtml(d, arg, zustand, stand, esc) + code : '';
    const beschaeftigt = stand.laden === 'laeuft' ? ' aria-busy="true"' : '';
    return `<section class="df" id="rv-d${id}" aria-labelledby="rv-dk${id}"${beschaeftigt}>${kopf}<div class="df-inhalt" id="rv-dc${id}"${stand.offen ? '' : ' hidden'}>${inhalt}</div></section>`;
  }

  /** Die Dateien der Seite: die Insel (ADR-0033 Punkt 4), die beim Neuzeichnen derselbe Knoten bleibt. */
  function inselHtml(schluessel, dateien, staende, hinweise, esc) {
    return `<div class="rv-dateien" id="rv-insel" data-insel="${esc(schluessel)}">${dateien.map((d, i) => dateiHtml(d, i, staende[i], hinweise, esc)).join('')}</div>`;
  }

  /** Dateiliste: je Datei Statuswort, Pfad, Zahlen; ein Eintrag springt zur Datei und klappt sie auf. */
  function dateilisteHtml(dateien, esc) {
    const eintraege = dateien.map((d, i) => {
      const [wort] = STATUSWORT[d.status] || [d.status];
      return `<li><button type="button" class="dn-e" data-act="review-datei" data-arg="${i}"><span class="p">${pfadHtml(d.neu ?? d.alt, esc)}</span><span class="z">${zahlenHtml(d)}</span><span class="s">${esc(wort)}</span></button></li>`;
    }).join('');
    return `<h3 class="rv-ue">DATEIEN <span class="mono">${dateien.length}</span></h3><ul class="dn" aria-label="Dateien">${eintraege}</ul>`;
  }

  const BAND_VERWAIST = 'Dieser Commit ist verwaist: Kein Zweig führt zu ihm. Sein Diff bleibt lesbar. Nach einem Rebase mit ersetzen nachziehen; im Gesamtbild der Aufgabe zählt er nicht mit.';

  /** Zweige des Commit-Kopfs: die Namen der Antwort, sichtbar gemacht statt bereinigt wie in der Liste (Security-Review #209 S2);
      der Lesetext im Numerus der Zahl aller Zweige wie `zustandImNamen` in commits.js. */
  function zweigeHtml(eintrag, esc) {
    const namen = [...(eintrag.zweige || []), ...(eintrag.entfernte_zweige || [])];
    const weitere = eintrag.zweige_weitere || 0;
    const lesetext = namen.length + weitere === 1 ? 'auf Zweig: ' : 'auf Zweigen: ';
    return `<span class="vh">${lesetext}</span>${namen.map(n => `<span class="rv-br">${sichtbarHtml(n, esc)}</span>`).join('')}${weitere ? `<span class="rv-kz">+${weitere}</span>` : ''}`;
  }

  /** Commit-Kopf (FA 5): Kurz-Hash, Zweige oder „auf keinem Zweig“, voller Titel als h2, Autor, Datum, Zeilen und Dateien; fremder
      Text sichtbar gemacht (ADR-0033 Punkt 8). */
  function commitKopfHtml(c, anwendung, eintrag, esc) {
    const kurz = (anwendung ? `${anwendung}:` : '') + c.hash.slice(0, 7);
    let zweige = '';
    if (eintrag && eintrag.zustand === 'verwaist') zweige = '<span class="rv-kz">auf keinem Zweig</span>';
    else if (eintrag && eintrag.zustand === 'auf_zweig') zweige = zweigeHtml(eintrag, esc);
    const band = eintrag && eintrag.zustand === 'verwaist' ? `<p class="rv-band" role="note">${BAND_VERWAIST}</p>` : '';
    return `<section class="rv-commit"><div class="z1"><span class="mono">${esc(kurz)}</span><span class="rv-zweige">${zweige}</span></div><h2 id="rv-ctitel" tabindex="-1">${sichtbarHtml(c.titel, esc)}</h2><p class="m">${sichtbarHtml(c.autor, esc)} · <span title="${esc(sichtbarText(c.datum))}">${sichtbarHtml(datumText(c.datum), esc)}</span> · ${zahlenHtml(c)} · ${dateienWort(c.dateien)}</p>${band}</section>`;
  }

  /** Blättern (FA 3): fehlende Nachbarn hinterlassen leeren Platz, nie einen deaktivierten Knopf. */
  function blaetternHtml(f, kurz, schmal) {
    const seite = (richtung, ziel, k) => {
      if (!ziel) return '<span class="bl-leer"></span>';
      const zurueck = richtung === 'zurueck';
      const name = schmal ? `${zurueck ? 'Voriger' : 'Nächster'} Commit, ${k} von ${f.n}` : `${zurueck ? 'Zurück, voriger' : 'Vor, nächster'} Commit ${k} von ${f.n}`;
      const text = schmal ? '' : `<span class="t">${zurueck ? 'Zurück' : 'Vor'}</span>`;
      const zeichen = `<span class="bl-s" aria-hidden="true">${zurueck ? '‹' : '›'}</span>`;
      return `<button type="button" class="btn bl-k" id="rv-${richtung}" data-act="review-blaettern" data-arg="${richtung}" aria-label="${name}">${zurueck ? zeichen + text : text + zeichen}</button>`;
    };
    return `<nav class="bl" aria-label="Commits der Aufgabe, ältester zuerst">${seite('zurueck', f.zurueck, f.i - 1)}<span class="pos"><b id="rv-pos" aria-live="polite">${f.i} von ${f.n}</b> <span class="mono">${kurz}</span></span>${seite('vor', f.vor, f.i + 1)}</nav>`;
  }

  /** Meldung einer ganzen Seite: die erste Zeile ist die Überschrift mit `tabindex="-1"` (Fokusziel, FA 13). */
  const meldungHtml = ({ ton = '', rolle, zeichen = '', kopf, text = '', rumpf = '', knoepfe = '' }) =>
    `<div class="rv-meld${ton ? ' ' + ton : ''}" role="${rolle}">${zeichen ? symbol(zeichen) : ''}<div class="rv-meldtext"><h2 id="rv-meld" tabindex="-1">${kopf}</h2>${text ? ` <p>${text}</p>` : ''}${rumpf}${knoepfe ? `<p class="rv-knoepfe">${knoepfe}</p>` : ''}</div></div>`;

  const ZUR_LISTE = knopf('Zur Liste der Commits', 'review-liste');

  /** Seitenfehler des Diffs (FA 8): Fehlerart aus Status und Text, nie von selbst wiederholt. */
  function diffFehlerHtml(f, verweis, esc) {
    const art = fehlerArt(f, 'diff');
    const erneut = knopf('Erneut versuchen', 'review-erneut', 'diff', 'rv-erneut');
    if (art === 'antwortbudget') return meldungHtml({ ton: 'warn', rolle: 'alert', zeichen: 'server', kopf: 'Server ausgelastet (Antwortbudget).', text: 'Der Diff wurde nicht gelesen, weil der Server gerade zu viele große Antworten ausliefert. Es wird nicht von selbst wiederholt.', knoepfe: erneut });
    if (art === 'zeitgrenze') return meldungHtml({ ton: 'fehl', rolle: 'alert', zeichen: 'uhr', kopf: 'Zeitgrenze überschritten.', text: `Der Diff ließ sich nicht lesen: ${esc(f.fehler || 'keine Angabe')} (503).`, knoepfe: erneut });
    if (art === 'kein_diff') {
      const wort = f.daten && ZUSTANDSWOERTER[f.daten.zustand];
      const grund = wort ? `${esc(kurzVerweis(verweis))} ist ${wort}.` : `${esc(kurzVerweis(verweis))} — ${esc(f.fehler || 'unbekannter Fehler')}.`;
      return meldungHtml({ rolle: 'status', kopf: `Zu diesem Verweis gibt es keinen Diff: ${grund}`, knoepfe: ZUR_LISTE });
    }
    const grund = f.status === 0 ? 'keine Verbindung zum Programm' : esc(f.fehler || 'unbekannter Fehler');
    return meldungHtml({ ton: 'fehl', rolle: 'alert', zeichen: 'achtung', kopf: `Der Diff ließ sich nicht lesen: ${grund}${statusKlammer(f.status)}.`, knoepfe: erneut + ZUR_LISTE });
  }

  const B1_FEHLERKOPF = 'Die Commits ließen sich nicht lesen: ';
  /** Kopf der Seite, wenn ein Präfix ohne Kürzel ohne die Liste bleibt (Code-Review #209 S1): ohne Liste kein Diff; Grund und
      Status wie in B1 (`fehlerText` aus commits.js), der Anfang wie der Teilfehler aus FA 8. */
  function listeFehlerText(f) {
    return 'Die Liste der Commits ließ sich nicht lesen: ' + commitsFehlerText(f).slice(B1_FEHLERKOPF.length);
  }

  /** Rand (c): keine Einträge mit Diff — Verweis, Zustandswort und Hinweis je Eintrag wie in der Liste. */
  function keineHtml(eintraege, esc) {
    const zeilen = eintraege.map(e => {
      const w = zeilenwerte(e);
      const wort = w.zustand ? w.zustand.wort : '';
      return `<li><span class="mono">${esc(w.kurz)}</span> <b>${esc(wort)}</b>${w.zustand && w.zustand.hinweis ? ` <span class="rv-hin">${esc(w.zustand.hinweis)}</span>` : ''}</li>`;
    }).join('');
    return meldungHtml({ rolle: 'status', kopf: 'Keine Änderungen zu zeigen.', text: 'Zu keinem Commit der Aufgabe gibt es einen Diff:', rumpf: `<ul class="rv-keine">${zeilen}</ul>`, knoepfe: knopf('Zurück zur Liste der Commits', 'review-liste') });
  }

  /** Hinweis über den Dateien bei gekappter Liste (FA 5): die Zahlen nur aus der Antwort. */
  function gekapptHtml(hinweise) {
    const h = hinweise.find(x => x.art === 'dateien_gekappt');
    if (!h) return '';
    return `<p class="rv-gekappt">${tausender(h.gezeigt)} von ${tausender(h.gesamt)} Dateien gezeigt. Die übrigen stehen nicht in dieser Liste; der Commit liegt vollständig im Repository.</p>`;
  }

  /** Rand (b): der Commit der Antwort steht nicht in der Folge. */
  function fremdHtml(kurz, esc) {
    return `<div class="rv-randb" role="status"><p>${esc(kurz)} gehört nicht zu den Commits dieser Aufgabe mit Diff. Gezeigt wird sein Diff, ohne „i von n“.</p>${knopf('Zum ersten Commit', 'review-erster', null, 'rv-erster')}</div>`;
  }

  Object.assign(ziel, { STATUSWORT, anwendungName, sichtbarText, symbol, zahlenHtml, merkmalSaetze, hinweisHtml, codeHtml, kurzVerweis, sichtbarHtml, pfadHtml, dateiHtml, inselHtml, dateilisteHtml, commitKopfHtml, blaetternHtml, meldungHtml, diffFehlerHtml, keineHtml, gekapptHtml, fremdHtml, dateienWort, tausender, knopf, commitsFehlerText, listeFehlerText });

  Object.assign(ziel, { spracheZuPfad, faerbbar, GRENZE_PATCH, GRENZE_ZEILE, zelleHtml, farbAuftragHolen, TK_KLASSEN });

  Object.assign(ziel, { folge, patchZeilen, sichtbarTeile, dateiZustand, aufklappPlan, aufklappPlanSeite, bloecke, fehlerArt, zuordnen, BUDGET_ZEILEN, BLOCK_ZEILEN });
})(typeof module !== 'undefined' ? module.exports : window);
