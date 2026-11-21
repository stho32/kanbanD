/* kanbanD — Syntaxfarben der Review-Seite (R00217, ADR-0040): Prism läuft nur hier, im Dedicated Worker, nie auf der Seite.
   Als Worker antwortet die Datei je Auftrag nur mit Zahlen; unter Node exportiert sie die reinen Funktionen für die Unit-Tests. */
(function () {
  'use strict';
  const imWorker = typeof module === 'undefined' && typeof importScripts === 'function';

  /** Die sieben Rollen in fester Reihenfolge; die Antwort trägt nur ihren Index (ADR-0040 Punkt 3). */
  const ROLLEN = ['tk-keyword', 'tk-string', 'tk-comment', 'tk-number', 'tk-function', 'tk-type', 'tk-macro'];
  /** Prism-`type`/`alias` → Index in ROLLEN (ADR-0037 Punkt 5); alles andere hat keine eigene Rolle. */
  const ROLLE_JE_NAME = new Map([
    ['keyword', 0],
    ['string', 1], ['char', 1], ['template-string', 1], ['regex', 1], ['attr-value', 1], ['url', 1],
    ['comment', 2], ['prolog', 2], ['doctype', 2], ['cdata', 2],
    ['number', 3], ['boolean', 3],
    ['function', 4],
    ['class-name', 5],
    ['macro', 6], ['attr-name', 6],
  ]);
  const KEINE = -1;

  /** Rolle eines Tokens: erst `type`, dann `alias`; ohne eigene Rolle gilt die des umgebenden Tokens (innerste gewinnt). */
  function rolleVon(token, aussen) {
    if (ROLLE_JE_NAME.has(token.type)) return ROLLE_JE_NAME.get(token.type);
    for (const alias of [].concat(token.alias || [])) if (ROLLE_JE_NAME.has(alias)) return ROLLE_JE_NAME.get(alias);
    return aussen;
  }

  /** Eine Seite eines Hunks als ein Text tokenisieren und die Stücke an `\n` auf ihre Zeilen legen. `indizes` sind die Indizes
      der Patch-Zeilen dieser Seite, `nimm[k]` sagt, ob die k-te Zeile ihre Farbe von dieser Seite bekommt. */
  function seiteFaerben(zeilen, indizes, nimm, grammatik, aus) {
    if (!indizes.length) return;
    let k = 0, spalte = 0;
    const ablegen = (text, rolle) => {
      let rest = text;
      for (;;) {
        const umbruch = rest.indexOf('\n');
        const teil = umbruch < 0 ? rest.length : umbruch;
        if (teil && rolle !== KEINE && nimm[k]) aus.push(indizes[k], spalte, spalte + teil, rolle);
        spalte += teil;
        if (umbruch < 0) return;
        k++;
        spalte = 0;
        rest = rest.slice(umbruch + 1);
      }
    };
    const gehen = (strom, aussen) => {
      for (const t of strom) {
        if (typeof t === 'string') { ablegen(t, aussen); continue; }
        const rolle = rolleVon(t, aussen);
        if (typeof t.content === 'string') ablegen(t.content, rolle);
        else gehen(Array.isArray(t.content) ? t.content : [t.content], rolle);
      }
    };
    gehen(prism.tokenize(indizes.map(i => zeilen[i].text).join('\n'), grammatik), KEINE);
  }

  /** Zeilen aus `patchZeilen` + Grammatik → `Int32Array` aus Viererpaaren `[Index der Patch-Zeile, von, bis, Rolle]` in UTF-16-
      Versätzen des Zeilentexts. Je Hunk zwei Seiten: alt = Kontext + entfernt, neu = Kontext + hinzugefügt; entfernte Zeilen nehmen
      die alte Seite, Kontext und hinzugefügte die neue. Kopf und `\ No newline` gehören zu keiner Seite (ADR-0037 Punkt 4). */
  function hunkTokens(zeilen, grammatik) {
    const aus = [];
    if (!grammatik) return new Int32Array(0);
    let hunk = [];
    const hunkFaerben = () => {
      const alt = hunk.filter(i => zeilen[i].art !== 'plus'), neu = hunk.filter(i => zeilen[i].art !== 'minus');
      seiteFaerben(zeilen, alt, alt.map(i => zeilen[i].art === 'minus'), grammatik, aus);
      seiteFaerben(zeilen, neu, neu.map(() => true), grammatik, aus);
      hunk = [];
    };
    zeilen.forEach((z, i) => {
      if (z.art === 'kopf') hunkFaerben();
      else if (z.art !== 'hinweis') hunk.push(i);
    });
    hunkFaerben();
    return Int32Array.from(aus);
  }

  /** Prism im Worker: der eingebaute Nachrichten-Hörer von Prism (JSON rein, `highlight`-HTML raus) wird vor dem Laden abgeschaltet. */
  function prismLaden() {
    if (!imWorker) return require('./vendor/prism.js');
    self.Prism = { disableWorkerMessageHandler: true };
    try {
      importScripts('/web/vendor/prism.js');
      return self.Prism;
    } catch (_) {
      // Ladefehler: der Worker antwortet auf jeden Auftrag mit `fehler`, die Datei bleibt ohne Farbe (ADR-0040 Punkt 4)
      return null;
    }
  }

  const prism = prismLaden();

  /** Ein Auftrag der Seite: `{sprache, zeilen}`. Antwort: das `Int32Array` (übertragen) oder `{fehler}`. Was kein Auftrag ist
      (fremde Nachrichten, etwa JSON-Text), bleibt ohne Antwort. */
  function auftragBeantworten(nachricht) {
    const auftrag = nachricht.data;
    if (!auftrag || typeof auftrag !== 'object' || typeof auftrag.sprache !== 'string' || !Array.isArray(auftrag.zeilen)) return;
    try {
      const grammatik = prism && Object.prototype.hasOwnProperty.call(prism.languages, auftrag.sprache) ? prism.languages[auftrag.sprache] : null;
      if (!grammatik) throw new Error('keine Grammatik');
      const stuecke = hunkTokens(auftrag.zeilen, grammatik);
      self.postMessage(stuecke, [stuecke.buffer]);
    } catch (_) {
      self.postMessage({ fehler: true });
    }
  }

  if (imWorker) self.addEventListener('message', auftragBeantworten);
  else module.exports = { hunkTokens, ROLLEN, prism };
})();
