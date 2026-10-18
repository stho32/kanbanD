/* kanbanD — WBS-Sicht: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar.
   Gerechnet wird auf dem Server (src/wbs.rs); hier steht nur, was die Ansicht daraus macht. */
(function (ziel) {
  /** Die Anwendungen, an die ein Board gebunden ist: die genannten, soweit registriert; nennt es keine,
      gilt bei genau einer registrierten Anwendung diese (R00053). `register` = [{kuerzel, name, …}]. */
  function gebundeneAnwendungen(board, register) {
    const genannt = (board && board.anwendungen) || [];
    if (!genannt.length) return register.length === 1 ? [register[0]] : [];
    return genannt.map(k => register.find(a => a.kuerzel === k)).filter(Boolean);
  }

  /** option, ausbau und verworfen zählen weder in Status noch Stand (Skill work-breakdown-structure). */
  const zaehlt = k => !['option', 'ausbau', 'verworfen'].includes(k.status);

  /** Tiefe je Knoten-ID über `eltern`; ein Zyklus bricht ab. */
  function tiefen(knoten) {
    const nach = new Map(knoten.map(k => [k.id, k]));
    const t = {};
    for (const k of knoten) {
      let n = 0;
      const gesehen = new Set([k.id]);
      for (let e = nach.get(k.eltern); e && !gesehen.has(e.id); e = nach.get(e.eltern)) { gesehen.add(e.id); n++; }
      t[k.id] = n;
    }
    return t;
  }

  /** IDs der Knoten mit Kindern; `nurZaehlende` wie die Rechnung des Servers. */
  function mitKindern(knoten, nurZaehlende) {
    return new Set(knoten.filter(k => !nurZaehlende || zaehlt(k)).map(k => k.eltern).filter(Boolean));
  }

  /** Nummer der Ausbaustufe als Namenspräfix: `2 · Blockziffern`. */
  const anzeigename = k => (k.ausbaustufe ? k.ausbaustufe + ' · ' : '') + k.name;

  /** `R00053, R00054` → beide IDs. */
  const anforderungsIds = zelle => (zelle || '').match(/\bR\d{5}\b/g) || [];

  Object.assign(ziel, { gebundeneAnwendungen, zaehlt, tiefen, mitKindern, anzeigename, anforderungsIds });
})(typeof module !== 'undefined' ? module.exports : window);
