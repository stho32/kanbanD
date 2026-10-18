/* kanbanD — Filter: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  /** "kopf class:bug origin:\"thin air\" @st #12" → [['', 'kopf'], ['class', 'bug'], ['origin', 'thin air'], ['', '@st'], ['', '#12']] */
  function filterWoerter(text) {
    const w = [];
    (text || '').replace(/(\w+):"([^"]*)"|(\S+)/g, (m, k, v, wort) => {
      if (k) { w.push([k.toLowerCase(), v]); return m; }
      const i = wort.indexOf(':');
      if (i > 0 && !/^[#@]/.test(wort)) w.push([wort.slice(0, i).toLowerCase(), wort.slice(i + 1)]);
      else w.push(['', wort]);
      return m;
    });
    return w;
  }

  /** Gehört `is:archived` zum Filter? */
  const archivGefiltert = text => filterWoerter(text).some(([k, v]) => k === 'is' && v.toLowerCase() === 'archived');

  /** Trifft der Filter die Aufgabe? Alle Wörter müssen passen. */
  function passt(a, text, umfeld) {
    const u = umfeld || {};
    if (u.bereich === 'meine' && !a.zustaendige.includes(u.ich)) return false;
    if (u.bereich === 'agenten' && !a.zustaendige.some(k => (u.personen || []).some(p => p.kuerzel === k && p.art === 'agent'))) return false;
    for (const [k, v] of filterWoerter(text)) {
      const l = v.toLowerCase();
      if (k === '') {
        if (l.startsWith('#')) { if (l.length > 1 && String(a.nummer) !== l.slice(1)) return false; }
        else if (l.startsWith('@')) { if (l.length > 1 && !a.zustaendige.includes(l.slice(1))) return false; }
        else if (!a.titel.toLowerCase().includes(l)) return false;
      } else if (k === 'origin') {
        const o = a.herkunft.length ? a.herkunft : ['thin air'];
        if (l && !o.some(x => x.toLowerCase() === l)) return false;
      } else if (k === 'class') {
        if (l && (l === 'none' ? a.klasse : (a.klasse || '').toLowerCase() !== l)) return false;
      } else if (k === 'label') {
        if (l && !a.labels.some(x => x.toLowerCase() === l)) return false;
      } else if (k === 'is') {
        // is:archived schaltet die Archivansicht; sonst keine Wirkung
      } else if (!a.titel.toLowerCase().includes((k + ':' + v).toLowerCase())) return false;
    }
    return true;
  }

  /** Setzt `class:<schlüssel>` oder entfernt es, wenn genau dieser schon gesetzt ist. */
  function klasseUmschalten(text, schluessel) {
    const jetzt = (filterWoerter(text).find(([k]) => k === 'class') || [])[1];
    const ohne = (text || '').replace(/class:\S+\s*/g, '').trim();
    return jetzt === schluessel ? ohne : (ohne + ' class:' + schluessel).trim();
  }

  Object.assign(ziel, { filterWoerter, passt, archivGefiltert, klasseUmschalten });
})(typeof module !== 'undefined' ? module.exports : window);
