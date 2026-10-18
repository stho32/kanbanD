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

  /** Rang je Spaltenname wie der Server (`rang` in src/pruefungen.rs): mit Phasen `phasenRang`, sonst der Spaltenindex. */
  function spaltenRang(board) {
    const namen = board.spalten.map(s => s.name);
    if (!board.phasen) return s => namen.indexOf(s);
    const spaltenphasen = Object.fromEntries(board.spalten.filter(s => s.phase).map(s => [s.name, s.phase]));
    const { phasenRang } = typeof module !== 'undefined' ? require('./berichte.js') : window;
    return phasenRang({ folge: board.phasen.folge, spaltenphasen }, namen);
  }

  /** Der Katalog wie in src/pruefungen.rs; `wbsJe` = {kürzel: WBS-Sicht | null}, fehlt eine, ist sie nicht erreichbar. */
  const PRUEFUNGEN = {
    'wbs-effects-green': (a, wbsJe) => {
      const offen = [];
      for (const w of a.wirkungen || []) {
        if (!['create', 'rework'].includes(w.action) || !w.node) continue;
        const s = `${w.application}:${w.node}`, sicht = wbsJe[w.application], k = sicht && sicht.knoten.find(x => x.id === w.node);
        if (offen.some(o => o.s === s) || (k && k.gerechnet === 'gruen')) continue;
        offen.push({ s, d: !sicht ? `${s} WBS nicht erreichbar` : !k ? `${s} Knoten fehlt` : `${s} ${k.gerechnet}` });
      }
      return offen.length ? { pruefung: 'wbs-effects-green', text: 'Achtung! Es sind nicht alle abhängigen WBS-Einträge grün.', knoten: offen.map(o => o.s), details: offen.map(o => o.d) } : null;
    },
  };

  /** Nicht erfüllte Prüfungen der Spalten links der Karte — sie tragen das rote Ausrufezeichen (gerechnet, nicht gespeichert). */
  function kartenPruefungen(board, a, wbsJe) {
    const hier = board.spalten.find(s => s.aufgaben.includes(a.nummer));
    if (!hier) return [];
    const rang = spaltenRang(board), r = rang(hier.name);
    const namen = [...new Set(board.spalten.filter(s => rang(s.name) < r).flatMap(s => s.pruefungen || []))].filter(n => PRUEFUNGEN[n]);
    return namen.map(n => PRUEFUNGEN[n](a, wbsJe)).filter(Boolean);
  }

  /** Anwendungen, deren WBS das Board für die Prüfungen braucht: Ziele von create/rework der Karten darauf, nur wenn eine Spalte prüft. */
  function pruefWbsAnwendungen(board, aufgaben) {
    if (!board || !board.spalten.some(s => (s.pruefungen || []).length)) return [];
    const nummern = new Set(board.spalten.flatMap(s => s.aufgaben));
    const k = aufgaben.filter(a => nummern.has(a.nummer)).flatMap(a => (a.wirkungen || []).filter(w => ['create', 'rework'].includes(w.action)).map(w => w.application));
    return [...new Set(k)];
  }

  Object.assign(ziel, { kartenPruefungen, pruefWbsAnwendungen, warnungsKnoten, WIRKUNG, wirkungEingabe, wirkungenJeKnoten, wirkungChip, wbsZiel, nachfahren, wbsZeilenMenue, kindEbenen, STATUS_WAHL, statusSetzbar, prozente, standText, gebundeneAnwendungen, zaehlt, tiefen, mitKindern, anzeigename, anforderungsIds, klappbar, zugeklappt, ausgeblendet });
})(typeof module !== 'undefined' ? module.exports : window);
