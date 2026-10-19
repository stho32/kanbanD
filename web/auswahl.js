/* kanbanD — Mehrfachauswahl auf dem Board (R00065): reine Funktionen, im Browser und in Node nutzbar.
   Spalten: [{name, karten: [Nummern]}] in Board-Reihenfolge. */
(function (ziel) {
  /** Alle Karten Spalte für Spalte, darin von oben nach unten. */
  function lesereihenfolge(spalten) {
    return spalten.flatMap(s => s.karten);
  }

  /** Karten vom Anker bis zur Karte in Lesereihenfolge; ohne sichtbaren Anker nur die Karte. */
  function reihe(spalten, anker, nr) {
    const folge = lesereihenfolge(spalten), i = folge.indexOf(anker), j = folge.indexOf(nr);
    if (i < 0 || j < 0) return [nr];
    return folge.slice(Math.min(i, j), Math.max(i, j) + 1);
  }

  function umschalten(auswahl, nr) {
    return auswahl.includes(nr) ? auswahl.filter(n => n !== nr) : [...auswahl, nr];
  }

  /** Ziele für `POST …/bewegen-mehrere` an `index` der Spalte (gezählt ohne die bewegten) und die Ziele zurück an die alten Plätze. */
  function mehrfachZiele(spalten, nummern, spalte, index) {
    const geordnet = lesereihenfolge(spalten).filter(n => nummern.includes(n));
    const ziele = geordnet.map((nummer, i) => ({ nummer, spalte, index: index + i }));
    const zurueck = geordnet.map(nummer => { const s = spalten.find(x => x.karten.includes(nummer)); return { nummer, spalte: s.name, index: s.karten.indexOf(nummer) }; })
      .sort((a, b) => a.index - b.index);
    return { ziele, zurueck };
  }

  /** Was der Server mit den Zielen macht: alle heraus, dann der Reihe nach einsetzen. */
  function spaltenNach(spalten, ziele) {
    const weg = ziele.map(z => z.nummer);
    const neu = spalten.map(s => ({ ...s, karten: s.karten.filter(n => !weg.includes(n)) }));
    for (const z of ziele) {
      const s = neu.find(x => x.name === z.spalte);
      s.karten.splice(Math.min(z.index, s.karten.length), 0, z.nummer);
    }
    return neu;
  }

  /** Anfangszustand des Dialogs „Zuständige zuweisen“ je Person: 'an' auf allen Karten, 'gemischt' auf einigen, sonst 'aus'. */
  function zuweisenStart(aufgaben, personen) {
    const wahl = {};
    for (const p of personen) {
      const n = aufgaben.filter(a => a.zustaendige.includes(p.kuerzel)).length;
      if (!p.aktiv && !n) continue;
      wahl[p.kuerzel] = n === aufgaben.length ? 'an' : n ? 'gemischt' : 'aus';
    }
    return wahl;
  }

  /** Ein Klick: gemischt → an → aus → an … */
  function zuweisenWeiter(zustand) {
    return zustand === 'an' ? 'aus' : 'an';
  }

  /** Zuständige einer Karte nach dem Dialog: bisherige in ihrer Reihenfolge, neue in Personenfolge dahinter. */
  function zustaendigeNach(zustaendige, wahl, personen) {
    const bleiben = zustaendige.filter(k => wahl[k] !== 'aus');
    return [...bleiben, ...personen.map(p => p.kuerzel).filter(k => wahl[k] === 'an' && !bleiben.includes(k))];
  }

  Object.assign(ziel, { lesereihenfolge, reihe, umschalten, mehrfachZiele, spaltenNach, zuweisenStart, zuweisenWeiter, zustaendigeNach });
})(typeof module !== 'undefined' ? module.exports : window);
