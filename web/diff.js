/* kanbanD — Review-Seite eines Commits (R00207, ADR-0033): reine Rechnung, im Browser und in Node (Unit-Tests) nutzbar wie commits.js.
   Fremder Text geht hier unverändert durch; maskiert wird erst beim Zeichnen (esc). */
(function (ziel) {
  'use strict';
  const { ZUSTANDSWOERTER, anwendungName, zustandSatz, zustandsSymbol, zeilenwerte, datumText, fehlerText: commitsFehlerText } = typeof module !== 'undefined' ? require('./commits.js') : window;
  const { dateiArt, dateiPfad, dateiGruppen, gruppierteFolge, grosseNeueDatei, testHinweis, groessteSumme, balkenTeile } = typeof module !== 'undefined' ? require('./review-uebersicht.js') : window;
  const { vscodeLink, vscodeTitel, sprungZeile, linkErlaubt, patchAdresse, patchName, mitDiff: mitDiffVon, commitChips, chipText, zweigVerdichtung, zweigeWort, wortMarken } = typeof module !== 'undefined' ? require('./review-uebersicht.js') : window;

  /** Folge der Review-Seite aus der Liste `GET …/commits` und dem vollen Hash der Diff-Antwort (ADR-0033 Punkte 2 und 9):
      gezählt wird über die Einträge mit Diff in der Reihenfolge der Antwort, „i“ nie aus dem Text der Adresse (Rand a).
      Arten: `folge` {i, n, zurueck, vor}, `fremd` (Rand b), `keine` (Rand c), `erster` (Adresse ohne Verweis). */
  function folge(eintraege, vollerHash) {
    const mitDiff = mitDiffVon(eintraege);
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

  /** Welche Dateien beim ersten Aufbau offen sind (ADR-0033 Punkt 5, ADR-0042 Punkt 1): Dateien mit `patch` in der gruppierten Folge
      (Code, Tests, Doku), ganz oder gar nicht, solange die gezeichneten Zeilen einschließlich der Datei höchstens das Budget ergeben;
      die erste, die öffnen darf, immer; nach der ersten, die nicht passt, keine mehr. Gelöschte, Dateien ohne `patch`, Doku und große
      neue Dateien sind zu, zählen nicht und unterbrechen nicht. `offen` und `budgetZu` (zu nur wegen des Budgets) stehen je Index der API. */
  function aufklappPlan(dateien, hinweise) {
    return aufklappPlanSeite(dateien, hinweise, { rest: BUDGET_ZEILEN, gesperrt: false, erste: true }).offen;
  }

  /** Gezeichnete Zeilen einer Datei, die beim Aufbau öffnen kann; null, wenn sie nicht zählt. Eine Folge-Datei (ADR-0033 N1.4)
      zählt über alle Schritte mit `patch`; ein Schritt ohne `patch` zählt nicht. */
  function planZeilen(d, hinweise) {
    if (dateiArt(dateiPfad(d)) === 'doku' || grosseNeueDatei(d)) return null;
    if (Array.isArray(d.schritte)) {
      const mitPatch = d.schritte.filter(s => dateiZustand(s, hinweise) === 'patch');
      if (!mitPatch.length) return null;
      return mitPatch.reduce((n, s) => n + patchZeilen(s.patch).length, 0);
    }
    if (d.status === 'D' || dateiZustand(d, hinweise) !== 'patch') return null;
    return patchZeilen(d.patch).length;
  }

  /** Der Plan über die ganze Seite (ADR-0033 N1.4): `stand` trägt Restbudget, „gesperrt“ (nach der ersten Datei, die nicht passt)
      und „erste“ (die erste Datei der Seite öffnet immer) von Abschnitt zu Abschnitt weiter. Eine Folge-Datei öffnet ganz oder gar nicht.
      Gesehene Dateien (`gesehen` je Index, R00246 FA 5) sind zu, zählen nicht und unterbrechen nicht. */
  function aufklappPlanSeite(dateien, hinweise, stand, gesehen = []) {
    let { rest, gesperrt, erste } = stand;
    const offen = dateien.map(() => false);
    const budgetZu = dateien.map(() => false);
    gruppierteFolge(dateien).forEach(i => {
      if (gesehen[i]) return;
      const zeilen = planZeilen(dateien[i], hinweise);
      if (zeilen === null) return;
      const passt = !gesperrt && (erste || zeilen <= rest);
      erste = false;
      if (!passt) { gesperrt = true; budgetZu[i] = true; return; }
      rest -= zeilen;
      offen[i] = true;
    });
    return { offen, budgetZu, stand: { rest, gesperrt, erste } };
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
    kopieren: '<path d="M9 9h11v11H9z"/><path d="M5 15H4V4h11v1"/>',
    extern: '<path d="M14 4h6v6"/><path d="M10 14L20 4"/><path d="M19 14v6H4V5h6"/>',
    laden: '<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>',
    haken: '<path d="M5 12.5l4.5 4.5L19 7"/>',
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
      Punkt 6). Jede Marke steht für genau ein Zeichen des Zeilentexts (alle sichtbar gemachten Zeichen liegen in der BMP).
      Mit der Wortmarke `wm` = `[von, bis)` (R00247 FA 5, 6) werden Text und Farbstücke zusätzlich an `von` und `bis` geschnitten, und
      `<mark class="wm">` liegt außen um alles dazwischen; geschnitten wird vor dem Maskieren, also nie in einem Entity. */
  function farbigHtml(text, stuecke, esc, wm = null) {
    const grenzen = wm || [];
    const abschnitte = [];
    /** Ein Abschnitt `[von, bis)` ohne Marke als Abschnitte `[von, html]`, an den Grenzen der Wortmarke geteilt. */
    const teilen = (von, bis, huelle) => {
      let bei = von;
      for (const g of grenzen) {
        if (g <= bei || g >= bis) continue;
        abschnitte.push([bei, huelle(esc(text.slice(bei, g)))]);
        bei = g;
      }
      abschnitte.push([bei, huelle(esc(text.slice(bei, bis)))]);
    };
    const ohneFarbe = html => html;
    let pos = 0, s = 0;
    for (const t of sichtbarTeile(String(text))) {
      if (t.marke) { abschnitte.push([pos, markeHtml(t, esc)]); pos += 1; continue; }
      const ende = pos + t.text.length;
      let bei = pos;
      while (s < stuecke.length && stuecke[s][1] <= bei) s++;
      for (let j = s; j < stuecke.length && stuecke[j][0] < ende; j++) {
        const von = Math.max(stuecke[j][0], bei), bis = Math.min(stuecke[j][1], ende);
        if (von > bei) teilen(bei, von, ohneFarbe);
        const klasse = TK_KLASSEN[stuecke[j][2]];
        teilen(von, bis, html => `<span class="${klasse}">${html}</span>`);
        bei = bis;
      }
      if (bei < ende) teilen(bei, ende, ohneFarbe);
      pos = ende;
    }
    if (!wm) return abschnitte.map(st => st[1]).join('');
    return mitWortmarke(abschnitte, wm, pos);
  }

  /** Abschnitte `[von, html]` in Textfolge → HTML mit `<mark class="wm">` vor dem Abschnitt bei `von` und `</mark>` vor dem Abschnitt bei `bis`
      (am Zeilenende nach dem letzten); die Abschnitte sind an beiden Grenzen geschnitten. */
  function mitWortmarke(abschnitte, [von, bis], laenge) {
    let aus = '';
    for (const [bei, html] of abschnitte) {
      if (bei === bis) aus += '</mark>';
      if (bei === von) aus += '<mark class="wm">';
      aus += html;
    }
    if (bis === laenge) aus += '</mark>';
    return aus;
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

  /** Inhalt der Codezelle einer Zeile mit Kontext, plus oder minus; mit `stuecke` gefärbt (die Auflage ersetzt nur diesen Inhalt),
      mit der Wortmarke `z.wm` markiert (R00247) — beides unabhängig voneinander. */
  function zelleHtml(z, esc, stuecke = null) {
    const lesen = LESETEXT[z.art] ? `<span class="vh">${LESETEXT[z.art]}</span>` : '';
    if (!stuecke && !z.wm) return lesen + sichtbarHtml(z.text, esc);
    return lesen + farbigHtml(z.text, stuecke || [], esc, z.wm || null);
  }

  /** `springt`: die Nummern der neuen Seite öffnen VS Code an ihrer Zeile (R00236 FA 7); die Nummern der alten Seite nie. */
  function zeileHtml(z, esc, springt = false) {
    if (z.art === 'kopf') return `<tr class="hk"><td colspan="4">${sichtbarHtml(z.text, esc)}</td></tr>`;
    if (z.art === 'hinweis') return `<tr class="nn"><td class="n" aria-hidden="true"></td><td class="n" aria-hidden="true"></td><td class="m" aria-hidden="true"></td><td class="c">${esc(z.text)}</td></tr>`;
    const klasse = z.art === 'plus' ? 'add' : z.art === 'minus' ? 'del' : 'ctx';
    return `<tr class="${klasse}"><td class="n" aria-hidden="true">${z.alt ?? ''}</td>${nummerNeuHtml(z.neu, springt)}<td class="m" aria-hidden="true">${ZEICHEN[z.art]}</td><td class="c">${zelleHtml(z, esc)}</td></tr>`;
  }

  /** Die Nummer der neuen Seite; springt sie, trägt sie den Tooltip des Sprungs, bleibt aber `aria-hidden` (über die Tastatur führt
      der Knopf „VS Code“, ADR-0042 Punkt 6). */
  function nummerNeuHtml(neu, springt) {
    if (neu === null) return '<td class="n" aria-hidden="true"></td>';
    if (!springt) return `<td class="n" aria-hidden="true">${neu}</td>`;
    return `<td class="n ru-nk" aria-hidden="true" title="${vscodeTitel(neu)}">${neu}</td>`;
  }

  /** Geschätzte Breite eines Blocks in px: Chromium misst die Breite eines Elements mit `content-visibility: auto` für die
      Quer-Rolle nach `contain-intrinsic-inline-size`, nicht nach dem Inhalt (geprobt in Chromium aus e2e/node_modules); ohne
      Schätzung schnitte der Block lange Zeilen ab. Großzügig: 8 px je Zeichen (Monospace 12 px, ein Tab 4), dazu die Nummern. */
  function blockBreite(zeilen) {
    const zeichen = z => sichtbarTeile(z.text).reduce((n, t) => n + Array.from(t.text).reduce((m, c) => m + (c === '\t' ? 4 : c.codePointAt(0) > 0x2E7F ? 2 : 1), 0), 0);
    return Math.ceil(Math.max(0, ...zeilen.map(zeichen)) * 8 + 140);
  }

  /** Der Code-Bereich einer offenen Datei: Blöcke zu 500 Zeilen mit `content-visibility: auto` (ADR-0033 Punkt 5), je Block
      eine Tabelle mit dem Namen der Datei; der Bereich ist per Tab erreichbar und scrollt quer. `sprung` ist der Link nach VS Code
      ohne Zeile (`data-vsc`), an den ein Klick auf eine Nummer der neuen Seite ihre Zeile hängt; ohne ihn springt keine Nummer. */
  function codeHtml(patch, pfad, esc, sprung = null) {
    const name = `Änderungen in ${esc(sichtbarText(pfad))}`;
    const zeilen = mitWortmarken(patchZeilen(patch));
    const springt = Boolean(sprung);
    const teile = bloecke(zeilen).map(b => `<div class="dz-b" style="contain-intrinsic-inline-size:${blockBreite(b)}px;contain-intrinsic-block-size:auto ${b.length * 18}px"><table class="dz" aria-label="${name}">${b.map(z => zeileHtml(z, esc, springt)).join('')}</table></div>`);
    let ziel = '';
    if (springt) ziel = ` data-vsc="${esc(sprung)}"`;
    return `<div class="df-sc" tabindex="0" role="region" aria-label="${name}"${ziel}${farbeAttribute(patch, pfad, zeilen)}>${teile.join('')}</div>`;
  }

  /** Die Zeilen mit ihrer Wortmarke `wm` (R00247 FA 7): gepaart vorab über die ganze Liste, damit ein Lauf über eine Blockgrenze wie
      ohne sie gilt; der Farbauftrag bekommt dieselben Zeilen, die Auflage zeichnet also dieselbe Marke. */
  function mitWortmarken(zeilen) {
    const marken = wortMarken(zeilen);
    return zeilen.map((z, i) => (marken[i] ? { ...z, wm: marken[i] } : z));
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

  /** Eine Datei als Abschnitt: Kopf als Knopf mit `aria-expanded` in einer Überschrift der Stufe `ebene`, darunter Merkmale, Hinweis
      und — offen — der Code; zu der Satz, warum sie zu ist (R00235 FA 6). `kennung` trägt in „Alle Änderungen“ den Abschnitt mit
      (`id` „<a>-<i>“, `arg` „<a>:<i>“; ADR-0033 N1.3). */
  function dateiHtml(d, i, stand, hinweise, esc, kennung = { id: i, arg: i, quelle: null }, ebene = 3) {
    const { id, arg, quelle } = kennung;
    const zustand = dateiZustand(d, hinweise);
    const pfad = d.neu ?? d.alt;
    const [wort, klasse] = STATUSWORT[d.status] || [d.status, 'st-mod'];
    const ren = d.status === 'R' ? `<span class="ren">umbenannt ← ${pfadHtml(d.alt, esc)}${d.aehnlichkeit != null ? ` · ${d.aehnlichkeit} %` : ''}</span>` : '';
    const anzeigen = zustand === 'patch' && !stand.offen ? '<span class="mk">anzeigen</span>' : '';
    const knopf = `<h${ebene} class="df-h"><button type="button" class="df-k" id="rv-dk${id}" data-act="review-klappe" data-arg="${arg}" aria-expanded="${stand.offen}" aria-controls="rv-dc${id}">${symbol('pfeil', ' df-pf')}<span class="st ${klasse}">${esc(wort)}</span><span class="p">${pfadHtml(pfad, esc)}</span>${ren}${testHinweisHtml(d)}<span class="z">${zahlenHtml(d)}</span>${anzeigen}</button></h${ebene}>`;
    const kopf = kopfMitAktionenHtml(knopf, d, kennung, stand, hinweise, esc);
    const saetze = merkmalSaetze(d, zustand).map(t => `<p class="df-mm">${esc(t)}</p>`).join('');
    const code = zustand === 'patch' && stand.offen ? codeHtml(d.patch, pfad, esc, sprungBasis(quelle, d)) : '';
    const inhalt = stand.offen ? saetze + hinweisHtml(d, arg, zustand, stand, esc) + code : '';
    const beschaeftigt = stand.laden === 'laeuft' ? ' aria-busy="true"' : '';
    let warumZu = '';
    if (!stand.offen && zustand === 'patch') warumZu = warumZuHtml(d, id, arg, stand);
    return `<section class="df" id="rv-d${id}" aria-labelledby="rv-dk${id}"${beschaeftigt}>${kopf}${warumZu}<div class="df-inhalt" id="rv-dc${id}"${stand.offen ? '' : ' hidden'}>${inhalt}</div></section>`;
  }

  /* ── Pfad, VS Code und Patch im Kopf jeder Datei (R00236, ADR-0042 Punkte 6 und 7; Artboard D0009 Bild 6) ── */

  /** Der Kopf einer Datei: Klappknopf in der Überschrift, daneben Pfad, VS Code und Patch — in dieser Reihenfolge, auch die Tab-Folge;
      darunter das Feld mit dem Pfad, wenn die Zwischenablage fehlte (FA 9). `kennung.quelle`: `{nr, commit | anwendung, wurzel}`;
      ohne Quelle (Zeichnen ohne Antwort, Unit-Tests der Übersicht) nur der Klappknopf. */
  function kopfMitAktionenHtml(knopf, d, kennung, stand, hinweise, esc) {
    if (!kennung.quelle) return knopf;
    let breit = '';
    if (dateiPfad(d).length > PFAD_NEBEN_KNOEPFEN) breit = ' ru-lang';
    return `<div class="ru-k${breit}">${knopf}${aktionenHtml(d, kennung, stand, hinweise, esc)}</div>${pfadFeldHtml(kennung.id, stand.pfadFeld, esc)}`;
  }

  /** Längere Pfade nehmen die ganze Breite, die Knöpfe stehen darunter: neben ihnen würde ein Kopf mit Tausenden Zeichen so hoch, dass
      er nicht mehr in den Bildschirm passt (R00207 AK 9, Pfad über 4.096 Byte). */
  const PFAD_NEBEN_KNOEPFEN = 300;

  /** „Pfad“ mit seiner Statusregion, die leer schon im Kopf steht (FA 8); „VS Code“ nur, wo der Link nicht täuschen kann (FA 6);
      „Patch“ nicht bei `zu_gross_zum_anzeigen` (FA 10). */
  function aktionenHtml(d, kennung, stand, hinweise, esc) {
    const { id, arg, quelle } = kennung;
    const pfad = dateiPfad(d);
    let bestaetigt = '';
    if (stand.pfadOk) bestaetigt = 'Pfad kopiert';
    const teile = [
      `<button type="button" class="btn ru-k1 ru-pfad" id="rv-pk${id}" data-act="review-pfad" data-arg="${arg}" title="Vollständigen Pfad kopieren">${symbol('kopieren')}Pfad</button>`,
      `<span class="ru-ok" id="rv-ok${id}" role="status">${bestaetigt}</span>`,
    ];
    if (linkErlaubt(quelle.wurzel, d)) {
      const zeile = sprungZeile(d, hinweise);
      teile.push(`<a class="btn ru-k1 ru-vsc" href="${esc(vscodeLink(quelle.wurzel, pfad, zeile))}" title="${vscodeTitel(zeile)}">${symbol('extern')}VS Code</a>`);
    }
    const zuGross = hinweise.some(h => h.art === 'zu_gross_zum_anzeigen' && h.datei === pfad);
    if (!zuGross) teile.push(`<a class="btn ru-k1 ru-patch" href="${esc(patchAdresse(quelle.nr, quelle, pfad))}" download="${esc(patchName(pfad))}" title="Patch dieser Datei herunterladen">${symbol('laden')}Patch</a>`);
    teile.push(gesehenKaestchenHtml(id, arg, pfad, stand.gesehen, esc));
    return `<div class="ru-akt">${teile.join('')}</div>`;
  }

  /** Das Kästchen „Gesehen“ (R00246 FA 1): zuletzt in der Tab-Folge, Name „Gesehen: <voller Pfad>“, sichtbarer Text „Gesehen“. */
  function gesehenKaestchenHtml(id, arg, pfad, gesehen, esc) {
    let haken = '';
    if (gesehen) haken = ' checked';
    return `<label class="ru-ges"><input type="checkbox" class="ru-ges-k" id="rv-gs${id}" data-act="review-gesehen" data-arg="${arg}" aria-label="${esc(`Gesehen: ${sichtbarText(pfad)}`)}"${haken}>Gesehen</label>`;
  }

  /** Das schreibgeschützte Feld mit dem Pfad (FA 9); '' ohne Pfad. */
  function pfadFeldHtml(id, pfad, esc) {
    if (typeof pfad !== 'string') return '';
    return `<div class="ru-pf" id="rv-pf${id}"><input class="ru-pfin" id="rv-pfin${id}" readonly aria-label="Vollständiger Pfad" value="${esc(pfad)}"><span class="ru-pft" role="status">Pfad markiert — mit Strg + C kopieren</span></div>`;
  }

  /** Der Link nach VS Code ohne Zeile, an den die Nummern der neuen Seite ihre Zeile hängen; null, wo es keinen Link gibt. */
  function sprungBasis(quelle, d) {
    if (!quelle || !linkErlaubt(quelle.wurzel, d)) return null;
    return vscodeLink(quelle.wurzel, dateiPfad(d), null);
  }

  /** Hinweis an einem Test (ADR-0042 Punkt 3) als Marke; '' ohne Hinweis. */
  function testHinweisHtml(d) {
    const hinweis = testHinweis(d);
    if (!hinweis) return '';
    return `<span class="rv-th">${hinweis}</span>`;
  }

  /** Satz einer zugeklappten Datei mit `patch`, je Grund einer (PO Z. 551): große neue Datei (FA 6) oder Zeichenbudget; der Knopf
      klappt auf wie der Kopf (PO Z. 553 (a)) und nennt über `aria-describedby` die Datei. Selbst zugeklappt: kein Satz. */
  function warumZuHtml(d, id, arg, stand) {
    let satz = '';
    if (grosseNeueDatei(d)) satz = `Neue Datei mit ${tausender(d.plus)} Zeilen, beginnt eingeklappt.`;
    else if (stand.budgetZu) satz = `Der Patch ist groß (${tausender(d.plus + d.minus)} Zeilen) und wird erst auf Wunsch geladen.`;
    if (!satz) return '';
    return `<div class="df-hin df-zu"><p>${satz}</p><button type="button" class="btn" data-act="review-klappe" data-arg="${arg}" aria-describedby="rv-dk${id}">Änderungen anzeigen</button></div>`;
  }

  /** Die Dateien der Seite: die Insel (ADR-0033 Punkt 4), die beim Neuzeichnen derselbe Knoten bleibt; darin die Gruppen Code, Tests,
      Doku und Planung (R00235 FA 2), offen nach `gruppenOffen` je Art. */
  function inselHtml(schluessel, dateien, staende, hinweise, esc, gruppenOffen, quelle) {
    const gruppen = dateiGruppen(dateien).map(g => commitGruppeHtml(g, dateien, staende, hinweise, esc, gruppenOffen[g.art], quelle));
    return `<div class="rv-dateien" id="rv-insel" data-insel="${esc(schluessel)}">${gruppen.join('')}</div>`;
  }

  /** Eine Gruppe in „Ein Commit“: Kopf `h2`, Dateien `h3` (PO Z. 552 (a)). */
  function commitGruppeHtml(g, dateien, staende, hinweise, esc, offen, quelle) {
    const inhalt = g.indizes.map(i => dateiHtml(dateien[i], i, staende[i], hinweise, esc, { id: i, arg: i, quelle })).join('');
    return gruppeHtml(g, inhalt, offen, { id: `-${g.art}`, arg: g.art }, 2);
  }

  /** Zahlen einer Gruppe: „<n> Dateien · +<a> −<b>“ mit Einzahl und Tausenderpunkt (FA 3). */
  const gruppenZahlenHtml = g => `${dateienWort(g.n)} · ${zahlenHtml(g)}`;

  /** Eine Gruppe als Abschnitt: Überschrift der Stufe `ebene` mit einem Knopf, der die Gruppe auf- und zuklappt (FA 3). */
  function gruppeHtml(g, inhalt, offen, kennung, ebene) {
    const { id, arg } = kennung;
    let verborgen = ' hidden';
    if (offen) verborgen = '';
    const kopf = `<h${ebene} class="rv-gh"><button type="button" class="rv-gk" id="rv-gk${id}" data-act="review-gruppe" data-arg="${arg}" aria-expanded="${offen}" aria-controls="rv-gc${id}">${symbol('pfeil', ' rv-gpf')}<span class="rv-gn">${g.name}</span> <span class="z">${gruppenZahlenHtml(g)}</span></button></h${ebene}>`;
    return `<section class="rv-gr" id="rv-g${id}" aria-labelledby="rv-gk${id}">${kopf}<div class="rv-gc" id="rv-gc${id}"${verborgen}>${inhalt}</div></section>`;
  }

  /** Dateiliste „Ein Commit“: gruppiert wie der Hauptteil; ein Eintrag springt zur Datei und klappt Gruppe und Datei auf. */
  function dateilisteHtml(dateien, esc, staende = []) {
    return gruppierteListeHtml(dateien, (d, i) => ({ arg: i, pfad: d.neu ?? d.alt, wort: (STATUSWORT[d.status] || [d.status])[0], gesehen: Boolean(staende[i] && staende[i].gesehen) }), esc);
  }

  /** Die Dateiliste in Gruppen (R00235 FA 2, 9): je Gruppe ein Kopf mit Zahlen und eine Liste; `eintrag(d, i)` liefert `arg`, `pfad`
      und `wort` der Zeile. */
  function gruppierteListeHtml(dateien, eintrag, esc) {
    const gruppen = dateiGruppen(dateien).map(g => {
      const groesste = groessteSumme(dateien, g.indizes);
      const zeilen = g.indizes.map(i => listenzeileHtml(dateien[i], eintrag(dateien[i], i), groesste, esc)).join('');
      return `<h4 class="rv-gl"><span class="rv-gn">${g.name}</span> <span class="z">${gruppenZahlenHtml(g)}</span></h4><ul class="dn" aria-label="${g.name}">${zeilen}</ul>`;
    });
    return `<h3 class="rv-ue">DATEIEN <span class="mono">${dateien.length}</span></h3>${gruppen.join('')}`;
  }

  /** Eine Zeile der Dateiliste: Platz des Haken-Symbols (R00246 FA 3, leer bei ungesehenen, damit der Pfad an derselben Stelle
      beginnt), Pfad, Größenbalken, Zahlen, darunter Statuswort und Test-Hinweis. */
  function listenzeileHtml(d, { arg, pfad, wort, gesehen }, groesste, esc) {
    let marke = '';
    if (gesehen) marke = `${symbol('haken')}<span class="vh">gesehen</span>`;
    return `<li><button type="button" class="dn-e" data-act="review-datei" data-arg="${arg}"><span class="rv-gm">${marke}</span><span class="p">${pfadHtml(pfad, esc)}</span>${balkenHtml(d, groesste)}<span class="z">${zahlenHtml(d)}</span><span class="s">${esc(wort)}${testHinweisHtml(d)}</span></button></li>`;
  }

  /** Größenbalken (ADR-0042 Punkt 9): je Zahl über 0 ein Teil mit seinem Anteil an der größten Summe der Gruppe; Länge im CSS. */
  function balkenHtml(d, groesste) {
    const anteile = balkenTeile(d, groesste);
    const teil = (klasse, anteil) => {
      if (anteil <= 0) return '';
      return `<i class="${klasse}" style="--anteil:${anteil}"></i>`;
    };
    return `<span class="rv-gb" aria-hidden="true">${teil('rv-gb-p', anteile.plus)}${teil('rv-gb-m', anteile.minus)}</span>`;
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

  /** Ein Chip (R00245 FA 8): höchstens 16 Zeichen, die volle Kennung im `title`, wenn gekürzt; in der Leiste ein `span`, im Kopf ein `li`. */
  function chipHtml(kennung, esc, element = 'span') {
    const text = chipText(kennung);
    let titel = '';
    if (text !== kennung) titel = ` title="${esc(kennung)}"`;
    return `<${element} class="rv-chip"${titel}>${esc(text)}</${element}>`;
  }

  /** Zweige des Kopfs verdichtet (R00245 FA 9): „auf main“ bzw. „auf master“ und ein Knopf „+<k> Zweige“, der die Liste aller Namen
      öffnet; ohne `main` und `master` unter den genannten lokalen Zweigen die Liste aller Namen. */
  function zweigeKopfHtml(eintrag, esc, offen) {
    const v = zweigVerdichtung(eintrag);
    if (!v) return zweigeHtml(eintrag, esc);
    const genannt = `<span class="rv-zw-auf">auf ${v.name}</span>`;
    if (!v.weitere) return genannt;
    const knopf = `<button type="button" class="btn rv-mehr" id="rv-zw-mehr" data-act="review-zweige" aria-expanded="${offen}" aria-controls="rv-zw-liste">${zweigeWort(v.weitere)}</button>`;
    let verborgen = ' hidden';
    if (offen) verborgen = '';
    return `${genannt}${knopf}<span class="rv-zw-liste" id="rv-zw-liste"${verborgen}>${zweigeHtml(eintrag, esc)}</span>`;
  }

  /** Commit-Kopf (FA 5, R00245 FA 9): Kurz-Hash, Kennungen aus dem Titel als Liste, Zweige verdichtet oder „auf keinem Zweig“, der Titel
      ohne Kennungen als h2, Autor, Datum, Zeilen und Dateien; fremder Text sichtbar gemacht (ADR-0033 Punkt 8). `zweigeOffen`: die
      Liste hinter „+<k> Zweige“ ist offen. */
  function commitKopfHtml(c, anwendung, eintrag, esc, zweigeOffen = false) {
    const kurz = (anwendung ? `${anwendung}:` : '') + c.hash.slice(0, 7);
    let zweige = '';
    if (eintrag && eintrag.zustand === 'verwaist') zweige = '<span class="rv-kz">auf keinem Zweig</span>';
    else if (eintrag && eintrag.zustand === 'auf_zweig') zweige = zweigeKopfHtml(eintrag, esc, zweigeOffen);
    const band = eintrag && eintrag.zustand === 'verwaist' ? `<p class="rv-band" role="note">${BAND_VERWAIST}</p>` : '';
    const { chips, rest } = commitChips(c.titel);
    let kennungen = '';
    if (chips.length) kennungen = `<span class="vh">Kennungen:</span><ul class="rv-chips">${chips.map(k => chipHtml(k, esc, 'li')).join('')}</ul>`;
    return `<section class="rv-commit"><div class="z1"><span class="mono">${esc(kurz)}</span>${kennungen}<span class="rv-zweige">${zweige}</span></div><h2 id="rv-ctitel" tabindex="-1">${sichtbarHtml(rest, esc)}</h2><p class="m">${sichtbarHtml(c.autor, esc)} · <span title="${esc(sichtbarText(c.datum))}">${sichtbarHtml(datumText(c.datum), esc)}</span> · ${zahlenHtml(c)} · ${dateienWort(c.dateien)}</p>${band}</section>`;
  }

  /** Blättern (FA 3): fehlende Nachbarn hinterlassen leeren Platz, nie einen deaktivierten Knopf. `still`: die Stelle sagt nichts an,
      weil die Wahl in der Leiste den Wechsel schon ansagt (R00245 FA 6, genau eine Ansage). */
  function blaetternHtml(f, kurz, schmal, still = false) {
    const seite = (richtung, ziel, k) => {
      if (!ziel) return '<span class="bl-leer"></span>';
      const zurueck = richtung === 'zurueck';
      const name = schmal ? `${zurueck ? 'Voriger' : 'Nächster'} Commit, ${k} von ${f.n}` : `${zurueck ? 'Zurück, voriger' : 'Vor, nächster'} Commit ${k} von ${f.n}`;
      const text = schmal ? '' : `<span class="t">${zurueck ? 'Zurück' : 'Vor'}</span>`;
      const zeichen = `<span class="bl-s" aria-hidden="true">${zurueck ? '‹' : '›'}</span>`;
      return `<button type="button" class="btn bl-k" id="rv-${richtung}" data-act="review-blaettern" data-arg="${richtung}" aria-label="${name}">${zurueck ? zeichen + text : text + zeichen}</button>`;
    };
    let ansage = ' aria-live="polite"';
    if (still) ansage = '';
    return `<nav class="bl" aria-label="Commits der Aufgabe, ältester zuerst">${seite('zurueck', f.zurueck, f.i - 1)}<span class="pos"><b id="rv-pos"${ansage}>${f.i} von ${f.n}</b> <span class="mono">${kurz}</span></span>${seite('vor', f.vor, f.i + 1)}</nav>`;
  }

  /** Meldung einer ganzen Seite: die erste Zeile ist die Überschrift mit `tabindex="-1"` (Fokusziel, FA 13). `zeilen` setzt Überschrift
      und Absätze untereinander (R00224 FA 5, 6); `bild` ist ein fertiges Symbol aus commits.js statt eines Namens aus `SYMBOLE`. */
  const meldungHtml = ({ ton = '', rolle, zeichen = '', bild = '', zeilen = false, kopf, text = '', rumpf = '', knoepfe = '' }) =>
    `<div class="rv-meld${zeilen ? ' rv-zeilen' : ''}${ton ? ' ' + ton : ''}" role="${rolle}">${zeichen ? symbol(zeichen) : bild}<div class="rv-meldtext"><h2 id="rv-meld" tabindex="-1">${kopf}</h2>${text ? ` <p>${text}</p>` : ''}${rumpf}${knoepfe ? `<p class="rv-knoepfe">${knoepfe}</p>` : ''}</div></div>`;

  /** Satz und Hinweiszeile eines Zustands als eigene Absätze (R00224 FA 1, 6); ohne Hinweis nur der Satz. Maskiert. */
  const zustandZeilenHtml = (s, esc) => `<p class="rv-satz">${esc(s.satz)}</p>${s.hinweis ? `<p class="rv-hin">${esc(s.hinweis)}</p>` : ''}`;

  /** Kürzel eines Verweises `<kürzel>:<hash>`; ohne Doppelpunkt das leere (Standardanwendung). */
  const kuerzelVon = verweis => {
    const text = verweis || '';
    return text.includes(':') ? text.slice(0, text.lastIndexOf(':')) : '';
  };

  const ZUR_LISTE = knopf('Zur Liste der Commits', 'review-liste');

  /** Seitenfehler des Diffs (FA 8): Fehlerart aus Status und Text, nie von selbst wiederholt. */
  function diffFehlerHtml(f, verweis, esc) {
    const art = fehlerArt(f, 'diff');
    const erneut = knopf('Erneut versuchen', 'review-erneut', 'diff', 'rv-erneut');
    if (art === 'antwortbudget') return meldungHtml({ ton: 'warn', rolle: 'alert', zeichen: 'server', kopf: 'Server ausgelastet (Antwortbudget).', text: 'Der Diff wurde nicht gelesen, weil der Server gerade zu viele große Antworten ausliefert. Es wird nicht von selbst wiederholt.', knoepfe: erneut });
    if (art === 'zeitgrenze') return meldungHtml({ ton: 'fehl', rolle: 'alert', zeichen: 'uhr', kopf: 'Zeitgrenze überschritten.', text: `Der Diff ließ sich nicht lesen: ${esc(f.fehler || 'keine Angabe')} (503).`, knoepfe: erneut });
    const satz = art === 'kein_diff' && f.daten ? zustandSatz(f.daten.zustand, kuerzelVon(verweis), f.daten.grund) : null;
    if (satz) return meldungHtml({ ton: satz.ton, rolle: 'status', bild: zustandsSymbol(satz.symbol), zeilen: true, kopf: `Zu ${esc(kurzVerweis(verweis))} gibt es keinen Diff.`, rumpf: zustandZeilenHtml(satz, esc), knoepfe: ZUR_LISTE });
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

  /** Der Satz, wenn der Browser „Gesehen“ nicht speichern kann (R00246 FA 10, Wortlaut PO Z. 641). */
  const GESEHEN_NICHT_GESPEICHERT = 'Gesehen wird in diesem Browser nicht gespeichert und gilt nur bis zum Neuladen.';

  /** Zeile „<k> von <n> gesehen“ mit Balken (R00246 FA 2, 10): sichtbar ohne Ansage (`aria-hidden`); gelesen wird die Live-Region
      `rv-gesehen`, die schon beim Zeichnen den aktuellen Text trägt und sich danach allein mit einem Haken ändert (`aria-live` setzt
      `gesehenAnsageBehalten` der Oberfläche nach dem Einhängen); `fuer` (Commit
      oder „alle“) hält ihren Knoten beim Zeichnen. Sie steht vor dem Zusatz „nicht geladen“, der so mit „gesehen“ zusammen gelesen
      wird. Ohne Dateien (n = 0) keine Zeile; der Statusknoten des Satzes zum Speicher steht immer, leer bei funktionierendem Speicher. */
  function gesehenZeileHtml({ k, n, fuer, ungeladen, speicherFehlt }, esc) {
    let zeile = '';
    if (n > 0) {
      let rest = '';
      if (ungeladen === 1) rest = '<span class="rv-ges-ng"> · 1 Abschnitt nicht geladen</span>';
      else if (ungeladen > 1) rest = `<span class="rv-ges-ng"> · ${tausender(ungeladen)} Abschnitte nicht geladen</span>`;
      const sichtbar = `<span class="rv-ges-z" id="rv-ges-z" aria-hidden="true"><span id="rv-gesehen-k">${tausender(k)}</span> von ${tausender(n)} gesehen</span>`;
      const balken = `<span class="rv-ges-balken" id="rv-ges-balken" aria-hidden="true"><i style="--anteil:${k / n}"></i></span>`;
      const live = `<span class="vh" id="rv-gesehen" aria-atomic="true" data-fuer="${esc(fuer)}">${esc(gesehenAnsage(k, n))}</span>`;
      zeile = `${live}<span class="rv-ges-t" id="rv-ges-t">${sichtbar}${rest}</span>${balken}`;
    }
    let satz = '';
    if (speicherFehlt) satz = GESEHEN_NICHT_GESPEICHERT;
    return `<div class="rv-ges" id="rv-ges">${zeile}<span class="rv-ges-sp" id="rv-gesehen-speicher" role="status">${satz}</span></div>`;
  }

  /** Lesetext der Live-Region: „<k> von <n> gesehen“. */
  const gesehenAnsage = (k, n) => `${tausender(k)} von ${tausender(n)} gesehen`;

  /** Rand (b): der Commit der Antwort steht nicht in der Folge. */
  function fremdHtml(kurz, esc) {
    return `<div class="rv-randb" role="status"><p>${esc(kurz)} gehört nicht zu den Commits dieser Aufgabe mit Diff. Gezeigt wird sein Diff, ohne „i von n“.</p>${knopf('Zum ersten Commit', 'review-erster', null, 'rv-erster')}</div>`;
  }

  Object.assign(ziel, { kopfMitAktionenHtml, pfadFeldHtml, sprungBasis, gesehenZeileHtml, gesehenAnsage });
  Object.assign(ziel, { STATUSWORT, anwendungName, sichtbarText, symbol, zahlenHtml, merkmalSaetze, hinweisHtml, codeHtml, kurzVerweis, sichtbarHtml, pfadHtml, dateiHtml, inselHtml, commitGruppeHtml, gruppeHtml, gruppierteListeHtml, dateilisteHtml, chipHtml, commitKopfHtml, blaetternHtml, meldungHtml, zustandZeilenHtml, diffFehlerHtml, keineHtml, gekapptHtml, fremdHtml, dateienWort, tausender, knopf, commitsFehlerText, listeFehlerText });

  Object.assign(ziel, { spracheZuPfad, faerbbar, GRENZE_PATCH, GRENZE_ZEILE, zelleHtml, farbAuftragHolen, TK_KLASSEN });

  Object.assign(ziel, { folge, patchZeilen, sichtbarTeile, dateiZustand, aufklappPlan, aufklappPlanSeite, bloecke, fehlerArt, zuordnen, BUDGET_ZEILEN, BLOCK_ZEILEN });
})(typeof module !== 'undefined' ? module.exports : window);
