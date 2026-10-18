/* kanbanD — Eingaben auswerten: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  /** Eingefügter Text → ein Titel je nicht leerer Zeile, ohne Listenzeichen. */
  function zeilenAusText(text) {
    return (text || '').split(/\r?\n/)
      .map(z => z.trim().replace(/^(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/, '').trim())
      .filter(Boolean);
  }

  const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const plusTage = (heute, n) => { const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + n); return iso(d); };
  function gueltig(j, m, t) { const d = new Date(j, m - 1, t); return d.getFullYear() === j && d.getMonth() === m - 1 && d.getDate() === t ? iso(d) : null; }

  /** `due:`-Wert → JJJJ-MM-TT oder null. */
  function datumLesen(w, heute) {
    const l = w.toLowerCase();
    if (l === 'heute') return plusTage(heute, 0);
    if (l === 'morgen') return plusTage(heute, 1);
    if (l === 'übermorgen' || l === 'uebermorgen') return plusTage(heute, 2);
    let m = /^\+(\d{1,3})$/.exec(l);
    if (m) return plusTage(heute, +m[1]);
    m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(l);
    if (m) return gueltig(+m[1], +m[2], +m[3]);
    m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})?$/.exec(l);
    if (m) return gueltig(m[3] ? +m[3] : heute.getFullYear(), +m[2], +m[1]);
    return null;
  }

  /** Titel mit Kürzeln → Titel und Felder. Unbekanntes bleibt im Titel. */
  function schnelleingabe(text, umfeld, heute) {
    const u = umfeld || {}, h = heute || new Date();
    const personen = (u.personen || []).map(p => p.kuerzel), klassen = (u.klassen || []).map(k => k.schluessel);
    const aus = { titel: '', zustaendige: [], klasse: null, labels: [], faellig: null, herkunft: [] };
    const rest = [];
    for (const wort of (text || '').trim().split(/\s+/).filter(Boolean)) {
      const l = wort.toLowerCase();
      let m;
      if (wort.startsWith('@') && personen.includes(l.slice(1))) { if (!aus.zustaendige.includes(l.slice(1))) aus.zustaendige.push(l.slice(1)); }
      else if ((m = /^class:(.+)$/i.exec(wort)) && klassen.includes(m[1].toLowerCase())) aus.klasse = m[1].toLowerCase();
      else if ((m = /^label:(.+)$/i.exec(wort))) { if (!aus.labels.includes(m[1])) aus.labels.push(m[1]); }
      else if ((m = /^due:(.+)$/i.exec(wort)) && datumLesen(m[1], h)) aus.faellig = datumLesen(m[1], h);
      else if (/^([ADIFB]\d{4}|R\d{5})$/.test(wort)) { if (!aus.herkunft.includes(wort)) aus.herkunft.push(wort); }
      else rest.push(wort);
    }
    aus.titel = rest.join(' ');
    return aus;
  }

  Object.assign(ziel, { zeilenAusText, schnelleingabe, datumLesen });
})(typeof module !== 'undefined' ? module.exports : window);
