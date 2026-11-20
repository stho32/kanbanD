/* kanbanD — Review-Seite eines Commits (R00207, ADR-0033): reine Rechnung, im Browser und in Node (Unit-Tests) nutzbar wie commits.js.
   Fremder Text geht hier unverändert durch; maskiert wird erst beim Zeichnen (esc). */
(function (ziel) {
  'use strict';

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

  const BIDI = /[‪-‮⁦-⁩]/;
  const STEUER = /[\u0000-\u0008\u000A-\u001F\u007F-\u009F]/;
  const code = z => 'U+' + z.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
  /** Bildzeichen der Steuerzeichen: U+2400 + Code für 0–31, ␡ für DEL; C1-Zeichen haben keins und stehen nur mit Code. */
  const bildzeichen = z => {
    const c = z.codePointAt(0);
    if (c < 0x20) return String.fromCodePoint(0x2400 + c) + ' ';
    if (c === 0x7F) return '␡ ';
    return '';
  };

  /** Fremder Text → Teile; Unsichtbares wird sichtbar, nie entfernt (ADR-0033 Punkt 8, „Trojan Source“): Bidi-Steuerzeichen als
      Marke `⟨U+202E⟩`, Steuerzeichen außer Tab als Bildzeichen mit Code, ein `\r` am Ende als `␍`. */
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
    // die Summe zählt auch die Datei, die nicht mehr passt — so passt danach keine weitere
    let summe = 0, erste = true;
    return dateien.map(d => {
      if (d.status === 'D' || dateiZustand(d, hinweise) !== 'patch') return false;
      summe += patchZeilen(d.patch).length;
      const offen = erste || summe <= BUDGET_ZEILEN;
      erste = false;
      return offen;
    });
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

  Object.assign(ziel, { folge, patchZeilen, sichtbarTeile, dateiZustand, aufklappPlan, bloecke, fehlerArt, zuordnen, BUDGET_ZEILEN, BLOCK_ZEILEN });
})(typeof module !== 'undefined' ? module.exports : window);
