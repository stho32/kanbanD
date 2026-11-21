/* kanbanD — WBS-Sicht: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar.
   Gerechnet wird auf dem Server (src/wbs.rs); hier steht nur, was die Ansicht daraus macht. */
(function (ziel) {
  /** Die Anwendungen, an die ein Board gebunden ist: die genannten, soweit registriert; fehlt `applications`
      (null), gilt bei genau einer registrierten Anwendung diese, `[]` bindet keine (R00062). `register` = [{kuerzel, name, …}]. */
  function gebundeneAnwendungen(board, register) {
    const genannt = board && board.anwendungen;
    if (!Array.isArray(genannt)) return register.length === 1 ? [register[0]] : [];
    return genannt.map(k => register.find(a => a.kuerzel === k)).filter(Boolean);
  }

  /** Bindung im Spalten-Dialog: schaltet `kuerzel` im gerechneten Stand um (fehlt `applications`, der Standard);
      leeres Kürzel = „keine“. Ergebnis ist immer eine ausdrückliche Liste für PUT …/anwendungen (R00062). */
  function bindungUmschalten(anwendungen, kuerzel, register) {
    if (!kuerzel) return [];
    const jetzt = Array.isArray(anwendungen) ? anwendungen : gebundeneAnwendungen({ anwendungen }, register).map(a => a.kuerzel);
    return jetzt.includes(kuerzel) ? jetzt.filter(k => k !== kuerzel) : [...jetzt, kuerzel];
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
  const WIRKUNG = { create: { zeichen: '+', wort: 'anlegen' }, rework: { zeichen: '↻', wort: 'überarbeiten' }, remove: { zeichen: '−', wort: 'verwerfen' } };

  /** Ein Chip je Wirkung: `+ kd:I0048` mit Ziel in der WBS-Sicht (`#/wbs/kd/I0048`). */
  function wirkungChip(w) {
    const a = WIRKUNG[w.action] || { zeichen: '?', wort: w.action };
    const schluessel = w.node ? `${w.application}:${w.node}` : w.application;
    return { text: `${a.zeichen} ${schluessel}`, ziel: `#/wbs/${encodeURIComponent(w.application)}${w.node ? '/' + encodeURIComponent(w.node) : ''}`, titel: `${a.wort}: ${schluessel} — in der WBS-Sicht zeigen`, aktion: w.action };
  }

  /** Im Zielzustand wie der Server (`erfuellt` in src/dienst/wirkungen.rs, R00072): create und rework — der Knoten ist
   *  gerechnet gruen; remove — verworfen oder fehlt; create ohne Knoten nicht. `null`: WBS nicht geladen. */
  function erfuellt(w, sicht) {
    if (!w.node) return false;
    if (!sicht) return null;
    const k = sicht.knoten.find(x => x.id === w.node);
    return w.action === 'remove' ? !k || k.status === 'verworfen' : !!k && k.gerechnet === 'gruen';
  }

  /** Der eine Punkt der Karte (R00072): an, wenn alle Wirkungen im Zielzustand sind, aus bei einer offenen, sonst grau;
   *  je Wirkung eine Zeile für den Tooltip. Ohne Wirkungen null. */
  function wirkungsPunkt(a, wbsJe) {
    const ws = a.wirkungen || [];
    if (!ws.length) return null;
    const zeilen = ws.map(w => {
      const sicht = wbsJe[w.application], e = erfuellt(w, sicht), k = sicht && w.node && sicht.knoten.find(x => x.id === w.node);
      const stand = e == null ? 'WBS nicht geladen' : !w.node ? 'noch nicht angelegt' : w.action === 'remove' ? (e ? 'verworfen' : 'noch aktiv') : !k ? 'Knoten fehlt' : `Knoten ${k.gerechnet}`;
      return { e, text: `${wirkungChip(w).text} ${(WIRKUNG[w.action] || { wort: w.action }).wort} — ${stand}` };
    });
    const stand = zeilen.some(z => z.e === false) ? 'aus' : zeilen.some(z => z.e == null) ? 'grau' : 'an';
    return { stand, zeilen: zeilen.map(z => z.text) };
  }

  /** Anwendungen, auf die Karten des Boards wirken — ihre WBS braucht der Punkt der Karte (R00072). */
  function wirkungsAnwendungen(board, aufgaben) {
    if (!board) return [];
    const nummern = new Set(board.spalten.flatMap(s => s.aufgaben));
    return [...new Set(aufgaben.filter(a => nummern.has(a.nummer)).flatMap(a => (a.wirkungen || []).map(w => w.application)))];
  }

  /** Der Knoten in `#/wbs/<kürzel>/<id>`, sonst leer. */
  const wbsZiel = hash => decodeURIComponent((/^#\/wbs\/[^/]*\/([^/?#]+)/.exec(hash || '') || [])[1] || '');

  /** Was das Formular einer Wirkung an den Server schickt: bei create die Angaben zum neuen Knoten, sonst den Knoten. */
  function wirkungEingabe(f) {
    const t = s => (s || '').trim();
    return f.action === 'create'
      ? { application: f.application, action: 'create', parent: t(f.parent), level: f.level, name: t(f.name), done_criterion: t(f.done_criterion) }
      : { application: f.application, action: f.action, node: t(f.node) };
  }

  /** Je Knoten der Anwendung `kuerzel` die Aufgaben, die auf ihn wirken: [{nummer, titel, aktion, archiviert}], nach Nummer. */
  function wirkungenJeKnoten(aufgaben, kuerzel) {
    const je = {};
    for (const a of [...aufgaben].sort((x, y) => x.nummer - y.nummer)) {
      for (const w of a.wirkungen || []) {
        if (w.application !== kuerzel || !w.node) continue;
        (je[w.node] = je[w.node] || []).push({ nummer: a.nummer, titel: a.titel, aktion: w.action, archiviert: !!a.archiviert });
      }
    }
    return je;
  }

  /* ── Plausibilitätsprüfungen (R00059) ── */
  /** `kd:I0048` → Kürzel und ID; ohne Kürzel die Standardanwendung. */
  const knotenTeile = s => { const i = s.indexOf(':'); return i < 0 ? ['', s] : [s.slice(0, i), s.slice(i + 1)]; };

  /** Die Knoten einer Warnung als Links in die WBS-Sicht, mit dem Grund im Titel. */
  function warnungsKnoten(w) {
    return (w.knoten || []).map((s, i) => {
      const [k, id] = knotenTeile(s), grund = (w.details || [])[i] || s;
      return { text: s, ziel: `#/wbs/${encodeURIComponent(k)}/${encodeURIComponent(id)}`, titel: `${grund} — in der WBS-Sicht zeigen` };
    });
  }

  Object.assign(ziel, { erfuellt, wirkungsPunkt, wirkungsAnwendungen, warnungsKnoten, WIRKUNG, wirkungEingabe, wirkungenJeKnoten, wirkungChip, wbsZiel, nachfahren, wbsZeilenMenue, kindEbenen, STATUS_WAHL, statusSetzbar, prozente, standText, gebundeneAnwendungen, bindungUmschalten, zaehlt, tiefen, mitKindern, anzeigename, anforderungsIds, klappbar, zugeklappt, ausgeblendet });
})(typeof module !== 'undefined' ? module.exports : window);
