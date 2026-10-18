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

  /** Dialog und Interaction mit Kindern sind klappbar. */
  const klappbar = (k, eltern) => eltern.has(k.id) && (k.ebene === 'Dialog' || k.ebene === 'Interaction');

  /** Zugeklappte Knoten: gewählt in `klapp` ({id: offen?}), sonst ist nur der aktive Ast offen (`pfad`). */
  function zugeklappt(knoten, klapp, pfad) {
    const eltern = mitKindern(knoten, false);
    return new Set(knoten.filter(k => klappbar(k, eltern) && !(k.id in klapp ? klapp[k.id] : pfad.includes(k.id))).map(k => k.id));
  }

  /** Knoten, über denen ein zugeklappter liegt — sie werden ausgeblendet; der zugeklappte selbst bleibt sichtbar. */
  function ausgeblendet(knoten, zu) {
    const nach = new Map(knoten.map(k => [k.id, k]));
    const weg = new Set();
    for (const k of knoten) {
      const gesehen = new Set([k.id]);
      for (let e = nach.get(k.eltern); e && !gesehen.has(e.id); e = nach.get(e.eltern)) {
        gesehen.add(e.id);
        if (zu.has(e.id)) { weg.add(k.id); break; }
      }
    }
    return weg;
  }

  /** Anteile in ganzen Prozent nach größtem Rest — die drei ergeben zusammen 100 (ohne Slices 0). */
  function prozente(stand) {
    const teile = ['gruen', 'gelb', 'rot'];
    if (!stand.slices) return { gruen: 0, gelb: 0, rot: 0 };
    const roh = teile.map(t => stand[t] * 100 / stand.slices);
    const ganz = roh.map(Math.floor);
    const fehlt = 100 - ganz.reduce((a, b) => a + b, 0);
    teile.map((_, i) => i).sort((a, b) => (roh[b] - ganz[b]) - (roh[a] - ganz[a])).slice(0, fehlt).forEach(i => { ganz[i]++; });
    return Object.fromEntries(teile.map((t, i) => [t, ganz[i]]));
  }

  /** Die Zeile des Kopfs: `50 % funktional · 25 % in Bearbeitung · 25 % offen`. */
  function standText(stand) {
    const p = prozente(stand);
    return `${p.gruen} % funktional · ${p.gelb} % in Bearbeitung · ${p.rot} % offen`;
  }

  Object.assign(ziel, { prozente, standText, gebundeneAnwendungen, zaehlt, tiefen, mitKindern, anzeigename, anforderungsIds, klappbar, zugeklappt, ausgeblendet });
})(typeof module !== 'undefined' ? module.exports : window);
