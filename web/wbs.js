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

  /** Status, die ein Blatt in der Sicht annehmen kann (R00055); alles andere ist Planung. */
  const STATUS_WAHL = ['rot', 'gelb', 'gruen'];

  /** Setzbar ist der Status eines Blatts ohne zählende Kinder, das rot, gelb oder gruen ist — der Rest wird gerechnet oder geplant. */
  const statusSetzbar = (k, mitZaehlendenKindern) => !mitZaehlendenKindern.has(k.id) && STATUS_WAHL.includes(k.status);

  /** Unter welchen Ebenen was hängen darf (Feature darf übersprungen werden) — wie der Server prüft (R00056). */
  const KIND_EBENEN = { Application: ['Dialog'], Dialog: ['Interaction'], Interaction: ['Feature', 'Bubble'], Feature: ['Bubble'], Bubble: [] };
  const kindEbenen = k => k.status === 'verworfen' ? [] : (KIND_EBENEN[k.ebene] || []);

  /** Alle Knoten unter `id` in Tabellenreihenfolge; ein Zyklus bricht ab. */
  function nachfahren(knoten, id) {
    const nach = new Map(knoten.map(k => [k.id, k]));
    return knoten.filter(k => {
      const gesehen = new Set([k.id]);
      for (let e = nach.get(k.eltern); e && !gesehen.has(e.id); e = nach.get(e.eltern)) { if (e.id === id) return true; gesehen.add(e.id); }
      return false;
    });
  }

  /** Menü einer WBS-Zeile: darunter anlegen, verwerfen — die Application und Verworfenes werden nicht verworfen. */
  function wbsZeilenMenue(k) {
    return [
      ...(kindEbenen(k).length ? [{ text: 'Knoten darunter anlegen', act: 'wbs-neu-pop', arg: k.id }] : []),
      ...(k.ebene !== 'Application' && k.status !== 'verworfen' ? [{ text: 'Verwerfen …', act: 'wbs-verwerfen-frage', arg: k.id }] : []),
    ];
  }

  /** Zeichen und Wort je Aktion einer Wirkung (R00057). */
  const WIRKUNG = { create: { zeichen: '+', wort: 'legt an' }, rework: { zeichen: '↻', wort: 'setzt zur Überarbeitung auf rot' }, remove: { zeichen: '−', wort: 'verwirft' } };

  /** Ein Chip je Wirkung: `+ kd:I0048` mit Ziel in der WBS-Sicht (`#/wbs/kd/I0048`). */
  function wirkungChip(w) {
    const a = WIRKUNG[w.action] || { zeichen: '?', wort: w.action };
    const schluessel = w.node ? `${w.application}:${w.node}` : w.application;
    return { text: `${a.zeichen} ${schluessel}`, ziel: `#/wbs/${encodeURIComponent(w.application)}${w.node ? '/' + encodeURIComponent(w.node) : ''}`, titel: `${a.wort}: ${schluessel} — in der WBS-Sicht zeigen`, aktion: w.action };
  }

  /** Der Knoten in `#/wbs/<kürzel>/<id>`, sonst leer. */
  const wbsZiel = hash => decodeURIComponent((/^#\/wbs\/[^/]*\/([^/?#]+)/.exec(hash || '') || [])[1] || '');

  Object.assign(ziel, { WIRKUNG, wirkungChip, wbsZiel, nachfahren, wbsZeilenMenue, kindEbenen, STATUS_WAHL, statusSetzbar, prozente, standText, gebundeneAnwendungen, zaehlt, tiefen, mitKindern, anzeigename, anforderungsIds, klappbar, zugeklappt, ausgeblendet });
})(typeof module !== 'undefined' ? module.exports : window);
