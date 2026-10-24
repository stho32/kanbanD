/* kanbanD — Berichte: Zeitraum, Filter und Rechnungen über Bewegungen; rein, im Browser und in Node nutzbar. */
(function (ziel) {
  const TAG = 864e5;

  /* ── Zeitraum und Filter (R00043) ── */
  const ZEITRAEUME = [['heute', 'heute'], ['gestern', 'gestern'], ['woche', 'diese Woche'], ['vorwoche', 'letzte Woche'], ['monat', 'dieser Monat'], ['vormonat', 'letzter Monat'], ['30', 'letzte 30 Tage'], ['90', 'letzte 90 Tage'], ['jahr', 'dieses Jahr'], ['alles', 'alles'], ['eigen', 'eigener Zeitraum']];
  const FILTER_LEER = { zeitraum: 'alles', von: '', bis: '', ohneFarben: [], ohneSpalten: [], personen: [], labels: [] };

  const tag = (ms, n = 0) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d.getTime(); };
  const isoTag = s => { const [j, m, t] = s.split('-').map(Number); return new Date(j, m - 1, t).getTime(); };

  /** Grenzen [von, bis) in ms; „alles“ ist unbeschränkt (von 0, bis Infinity). */
  function zeitraumGrenzen(f, jetzt) {
    const heute = tag(jetzt), morgen = tag(jetzt, 1), wtag = (new Date(heute).getDay() + 6) % 7;
    const monat = (n) => { const d = new Date(heute); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); };
    switch (f.zeitraum) {
      case 'heute': return { von: heute, bis: morgen };
      case 'gestern': return { von: tag(jetzt, -1), bis: heute };
      case 'woche': return { von: tag(jetzt, -wtag), bis: tag(jetzt, 7 - wtag) };
      case 'vorwoche': return { von: tag(jetzt, -wtag - 7), bis: tag(jetzt, -wtag) };
      case 'monat': return { von: monat(0), bis: monat(1) };
      case 'vormonat': return { von: monat(-1), bis: monat(0) };
      case '30': return { von: tag(jetzt, -29), bis: morgen };
      case '90': return { von: tag(jetzt, -89), bis: morgen };
      case 'jahr': return { von: new Date(new Date(heute).getFullYear(), 0, 1).getTime(), bis: new Date(new Date(heute).getFullYear() + 1, 0, 1).getTime() };
      case 'eigen': return { von: f.von ? isoTag(f.von) : 0, bis: f.bis ? isoTag(f.bis) + TAG : Infinity };
      default: return { von: 0, bis: Infinity };
    }
  }

  /** Farbe, Personen (zuständig), Labels; eine Aufgabe ohne Datei hat keine Klasse, Person und Labels. */
  function aufgabePasst(f, a) {
    const klasse = (a && a.klasse) || '';
    if (f.ohneFarben.includes(klasse)) return false;
    if (f.personen.length && !(a && a.zustaendige.some(p => f.personen.includes(p)))) return false;
    if (f.labels.length && !(a && a.labels.some(l => f.labels.includes(l)))) return false;
    return true;
  }

  /** Für Zeitberichte: Aufgaben nach Farbe und Label, Zeiten nach Person. */
  function zeitenGefiltert(aufgaben, f) {
    const ohnePerson = { ...f, personen: [] };
    return aufgaben.filter(a => aufgabePasst(ohnePerson, a))
      .map(a => f.personen.length ? { ...a, zeiten: a.zeiten.filter(z => f.personen.includes(z.wer)) } : a);
  }

  /** Anzahl wirkender Filter (für die Leiste). */
  const filterAnzahl = f => (f.zeitraum !== 'alles' ? 1 : 0) + f.ohneFarben.length + f.ohneSpalten.length + f.personen.length + f.labels.length;

  /** Gespeicherten Filter lesen: unbekannte Felder verwerfen, fehlende ergänzen. */
  function filterAus(text) {
    let x = {};
    try { x = JSON.parse(text || '{}') || {}; } catch (_) { x = {}; }
    const f = { ...FILTER_LEER };
    for (const k of Object.keys(FILTER_LEER)) if (x[k] != null && typeof x[k] === typeof FILTER_LEER[k] && Array.isArray(x[k]) === Array.isArray(FILTER_LEER[k])) f[k] = x[k];
    if (!ZEITRAEUME.some(([k]) => k === f.zeitraum)) f.zeitraum = 'alles';
    return f;
  }

  /* ── Bewegungen (R00042) ── */
  const zeitMs = z => { const [d, t] = z.split(' '); const [j, m, tg] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(j, m - 1, tg, h, mi).getTime(); };

  /** Spalte einer Aufgabe zum Zeitpunkt t (null = nicht auf dem Board). */
  function spalteAm(wechsel, t) {
    let s = null;
    for (const w of wechsel) { if (zeitMs(w.zeitpunkt) > t) break; s = w.spalte; }
    return s;
  }

  /** Zählt eine Aufgabe in dieser Spalte? Filter nach Spalte, Farbe, Person, Label. */
  const zaehltMit = (f, aufgabeZu) => (nr, spalte) => spalte != null && !f.ohneSpalten.includes(spalte) && aufgabePasst(f, aufgabeZu(nr));

  /* ── Zählen in Berichten je Aufgabe (R00060) ── */
  /** Zählt die Aufgabe (Eintrag aus bew.aufgaben) im Bericht `burndown` oder `forecast`? Nur `false` nimmt sie aus. */
  const zaehltImBericht = (a, bericht) => !(a.reporting && a.reporting[bericht] === false);
  /** Aufgaben, die jetzt in einer gezählten Spalte liegen und zum Filter passen, aber per `reporting` ausgenommen sind. */
  function ausgenommen(bew, bericht, f, aufgabeZu, jetzt) {
    const zaehlt = zaehltMit(f, aufgabeZu);
    return bew.aufgaben.filter(a => !zaehltImBericht(a, bericht) && zaehlt(a.nummer, spalteAm(a.wechsel, jetzt))).length;
  }

  /* ── Burndown (R00044) ── */
  /** Je Tag im Zeitraum: offen (nicht in der Abschlussspalte) und Umfang, Stand am Tagesende, heute jetzt. */
  function burndown(bew, f, aufgabeZu, jetzt) {
    const g = zeitraumGrenzen(f, jetzt), zaehlt = zaehltMit(f, aufgabeZu);
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return [];
    const abschluss = bew.spalten[bew.spalten.length - 1];
    const tage = [];
    for (let t = Math.max(tag(erste), tag(g.von)); t < Math.min(g.bis, tag(jetzt, 1)); t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      let offen = 0, umfang = 0;
      for (const a of bew.aufgaben) {
        if (!zaehltImBericht(a, 'burndown')) continue;
        const s = spalteAm(a.wechsel, ende);
        if (!zaehlt(a.nummer, s)) continue;
        umfang++;
        if (s !== abschluss) offen++;
      }
      const d = new Date(t), p = n => String(n).padStart(2, '0');
      tage.push({ datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, offen, umfang });
    }
    return tage;
  }

  /* ── Durchlaufzeit (R00045) ── */
  /** Erstes Erreichen der Spalte mit Index ≥ i (dort oder rechts davon), in ms; null = nie. */
  function erreicht(wechsel, spalten, i) {
    const w = wechsel.find(x => x.spalte != null && spalten.indexOf(x.spalte) >= i);
    return w ? zeitMs(w.zeitpunkt) : null;
  }
  const runden1 = x => Math.round(x * 10) / 10;
  /** Perzentil nach Nearest-Rank über sortierte Werte. */
  const perzentil = (sortiert, p) => sortiert.length ? sortiert[Math.max(0, Math.ceil(p / 100 * sortiert.length) - 1)] : null;

  /** Je Aufgabe Eintritt in „von“, Ankunft in „bis“ (im Zeitraum) und Tage; dazu Kennzahlen. */
  function durchlaufzeiten(bew, f, aufgabeZu, jetzt, von, bis) {
    const iv = Math.max(0, bew.spalten.indexOf(von)), ib = bew.spalten.indexOf(bis) < 0 ? bew.spalten.length - 1 : bew.spalten.indexOf(bis);
    const leer = { liste: [], anzahl: 0, mittel: null, median: null, p85: null, gueltig: iv < ib };
    if (iv >= ib) return leer;
    const g = zeitraumGrenzen(f, jetzt);
    const liste = bew.aufgaben.map(a => {
      const e = erreicht(a.wechsel, bew.spalten, iv), z = erreicht(a.wechsel, bew.spalten, ib);
      return e != null && z != null && z >= e ? { nummer: a.nummer, eintritt: e, ankunft: z, tage: runden1((z - e) / TAG) } : null;
    }).filter(x => x && x.ankunft >= g.von && x.ankunft < g.bis && aufgabePasst(f, aufgabeZu(x.nummer)))
      .sort((x, y) => y.ankunft - x.ankunft || x.nummer - y.nummer);
    const w = liste.map(x => x.tage).sort((x, y) => x - y);
    if (!w.length) return leer;
    const m = w.length / 2;
    return { liste, anzahl: w.length, gueltig: true, mittel: runden1(w.reduce((s, x) => s + x, 0) / w.length), median: runden1(w.length % 2 ? w[Math.floor(m)] : (w[m - 1] + w[m]) / 2), p85: perzentil(w, 85) };
  }

  /* ── Phasen als Spalten (R00058) ── */
  /** Rang einer Spalte in der Phasenfolge: Stelle ihrer Phase, die Abschlussspalte hinter allen, ungebundene −1. */
  function phasenRang(phasen, spalten) {
    const letzte = spalten[spalten.length - 1], stelle = Object.fromEntries(phasen.folge.map((p, k) => [p.name, k]));
    return s => s === letzte ? phasen.folge.length : (stelle[phasen.spaltenphasen[s]] ?? -1);
  }
  /** Phase k ist durchlaufen ab einem Rang über dieser Schwelle; „gleich wie“ nimmt die der genannten Phase,
      „eingebettet in“ bei passendem Label die der Vorphase. */
  function phasenSchwelle(folge, k, labels) {
    const p = folge[k], j = p.gleich ? folge.findIndex(q => q.name === p.gleich) : -1;
    if (j >= 0 && j < k) return phasenSchwelle(folge, j, labels);
    if (k > 0 && p.eingebettet && labels.includes(p.eingebettet)) return phasenSchwelle(folge, k - 1, labels);
    return k;
  }
  /** Je Phase: durch(aufgabe, spalte) und entfaellt(aufgabe); `aufgabe` ist ein Eintrag aus bew.aufgaben. */
  function phasenStufen(phasen, spalten) {
    const rang = phasenRang(phasen, spalten);
    return phasen.folge.map((p, k) => ({
      phase: p.name,
      durch: (a, s) => s != null && rang(s) > phasenSchwelle(phasen.folge, k, a.labels || []),
      entfaellt: a => (a.uebersprungen || []).includes(p.name),
    }));
  }
  /** Erstes Durchlaufen einer Stufe in ms; null = nie. */
  function ersterDurchlauf(a, stufe) {
    const w = a.wechsel.find(x => stufe.durch(a, x.spalte));
    return w ? zeitMs(w.zeitpunkt) : null;
  }

  /* ── Wie lange noch (R00046): Monte Carlo über den Durchsatz je Spalte ── */
  const PERZENTILE = [50, 70, 85, 95], ZIEHUNGEN = 10000, MIN_LAEUFE = 3, MAX_TAGE = 3650;

  /** Reproduzierbarer Zufall (mulberry32). */
  function zufall(saat) {
    let a = saat >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /** Tage bis `rest` erreicht ist, je Ziehung mit Zurücklegen aus der Tagesreihe; aufsteigend sortiert. */
  function ziehen(reihe, rest, ziehungen = ZIEHUNGEN) {
    if (!reihe.some(x => x > 0)) return null;
    const z = zufall(20260906), erg = [];
    for (let i = 0; i < ziehungen; i++) {
      let tage = 0, fertig = 0;
      while (fertig < rest && tage < MAX_TAGE) { fertig += reihe[Math.floor(z() * reihe.length)]; tage++; }
      erg.push(tage);
    }
    return erg.sort((x, y) => x - y);
  }
  const perzentileAus = erg => Object.fromEntries(PERZENTILE.map(p => [p, erg[Math.ceil(p / 100 * erg.length) - 1]]));
  /** Perzentile über die Ziehungen. */
  function simuliere(reihe, rest, ziehungen = ZIEHUNGEN) {
    const erg = ziehen(reihe, rest, ziehungen);
    return erg && perzentileAus(erg);
  }
  /** Anteil der Ziehungen, die nach höchstens `tage` fertig sind (Ziehungen sortiert). */
  function anteilBis(erg, tage) {
    let lo = 0, hi = erg.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (erg[m] <= tage) lo = m + 1; else hi = m; }
    return lo / erg.length;
  }

  const werktag = ms => { const w = new Date(ms).getDay(); return w !== 0 && w !== 6; };
  /** Werktage nach `start` bis einschließlich `ziel`. */
  function werktageBis(start, ziel) {
    let n = 0;
    for (let d = tag(start, 1); d <= tag(ziel); d = tag(d, 1)) if (werktag(d)) n++;
    return n;
  }
  /** Datum n Werktage nach `start` (n = 0 → start). */
  function werktagDatum(start, n) {
    let d = tag(start), k = 0;
    while (k < n) { d = tag(d, 1); if (werktag(d)) k++; }
    return d;
  }

  /** Ankünfte je Kalendertag [von, bis) und je Werktag (Wochenende zählt zum nächsten Werktag). */
  function tagesreihen(daten, von, bis) {
    const reihe7 = [];
    for (let t = von; t < bis; t = tag(t, 1)) reihe7.push(daten.filter(d => d >= t && d < tag(t, 1)).length);
    const reihe5 = [];
    let uebertrag = 0;
    reihe7.forEach((n, i) => { if (werktag(tag(von, i))) { reihe5.push(n + uebertrag); uebertrag = 0; } else uebertrag += n; });
    if (uebertrag) { if (reihe5.length) reihe5[reihe5.length - 1] += uebertrag; else reihe5.push(uebertrag); }
    return { reihe7, reihe5 };
  }

  /** Was die Prognose je Block zählt: ohne Phasen je Spalte (außer der ersten gezählten) „erreicht = dort oder rechts davon“,
      mit Phasen je Phase „durchlaufen“ (R00058). */
  function prognoseStufen(bew, spalten, phasen) {
    if (phasen) return phasenStufen(phasen, bew.spalten).map(s => ({ ...s, schluessel: s.phase, titel: s.phase + ' durchlaufen' }));
    const idx = s => bew.spalten.indexOf(s);
    return spalten.slice(1).map(spalte => ({ spalte, schluessel: spalte, titel: `Spalte „${spalte}“`, durch: (a, s) => s != null && idx(s) >= idx(spalte), entfaellt: () => false }));
  }

  /** Je Block: Nenner, erreicht, offen, Tagesreihe, Perzentile; dazu der Verlauf je Tag. Offen zählt nach dem aktuellen Stand,
      der Durchsatz nach dem ersten Erreichen. `phasen` aus bew.phasen; ohne sie je Spalte wie in R00046.
      `start` (R00078): ohne gewählten Zeitraum misst die Prognose ab dem Projektstart, und der Verlauf beginnt dort.
      `nurLetzter` rechnet nur den letzten Block und keinen Verlauf — für das Fever Chart, das jeden Tag einzeln rechnet;
      `block` (R00079) statt des letzten nur den Block mit diesem Schlüssel (gibt es ihn nicht, den letzten). */
  function prognose(bew, f, aufgabeZu, jetzt, phasen, { start = null, nurLetzter = false, block = null } = {}) {
    if (block) nurLetzter = true;
    const heute = tag(jetzt), morgen = tag(jetzt, 1), g = zeitraumGrenzen(f, jetzt);
    if (start && f.zeitraum === 'alles') g.von = isoTag(start);
    const spalten = bew.spalten.filter(s => !f.ohneSpalten.includes(s));
    const imFilter = a => aufgabePasst(f, aufgabeZu(a.nummer));
    // reporting.forecast: false (R00060) nimmt die Aufgabe ganz aus der Prognose, zusätzlich zum Filter
    const passt = a => imFilter(a) && zaehltImBericht(a, 'forecast');
    // archiviert außerhalb der Abschlussspalte heißt verworfen: ab dem Archivtag kein Umfang mehr
    const letzte = bew.spalten[bew.spalten.length - 1];
    const zaehlt = (a, s, t) => { const x = aufgabeZu(a.nummer); return s != null && spalten.includes(s) && !(x && x.archiviert && s !== letzte && t >= isoTag(x.archiviert)); };
    const jetztDa = bew.aufgaben.filter(passt).map(a => ({ a, s: spalteAm(a.wechsel, jetzt) })).filter(x => zaehlt(x.a, x.s, jetzt));
    const umfang = jetztDa.length;
    let vorige = null;
    const alle = prognoseStufen(bew, spalten, phasen), gewaehlt = alle.filter(st => st.schluessel === block);
    const stufen = gewaehlt.length ? gewaehlt : nurLetzter ? alle.slice(-1) : alle;
    const bloecke = stufen.map(st => {
      const dabei = jetztDa.filter(x => !st.entfaellt(x.a));
      const offen = dabei.filter(x => !st.durch(x.a, x.s)).length;
      const daten = dabei.map(x => ersterDurchlauf(x.a, st)).filter(d => d != null && d >= g.von && d < Math.min(g.bis, morgen));
      const ph = { schluessel: st.schluessel, titel: st.titel, nenner: dabei.length, erreicht: dabei.length - offen, offen, laeufe: daten.length, zeilen: null, reihe7: [], reihe5: [], durchsatz: null };
      if (st.spalte) ph.spalte = st.spalte; else ph.phase = st.phase;
      if (daten.length) {
        const von = g.von > 0 ? tag(g.von) : tag(Math.min(...daten));
        Object.assign(ph, tagesreihen(daten, von, Math.min(tag(g.bis === Infinity ? morgen : g.bis), morgen)));
        ph.durchsatz = ph.reihe7.length ? daten.length / ph.reihe7.length : null;
      }
      if (ph.laeufe >= MIN_LAEUFE && offen > 0) {
        const e7 = ziehen(ph.reihe7, offen), e5 = ziehen(ph.reihe5, offen);
        if (e7 && e5) {
          const p7 = perzentileAus(e7), p5 = perzentileAus(e5);
          ph.zeilen = PERZENTILE.map(p => ({ p, kalendertage: p7[p], datum7: tag(heute, p7[p]), arbeitstage: p5[p], datum5: werktagDatum(heute, p5[p]) }));
          Object.assign(ph, { erg7: e7, erg5: e5 });
        }
      }
      // nie früher als der Block davor (Spalte links, Vorphase): dessen Datum als Untergrenze nennen, nicht verrechnen
      if (ph.zeilen && vorige && vorige.zeilen) ph.zeilen.forEach((z, k) => {
        const v = vorige.zeilen[k];
        for (const n of ['7', '5']) {
          const schranke = Math.max(v['datum' + n], v['untergrenze' + n] || 0);
          if (schranke > z['datum' + n]) z['untergrenze' + n] = schranke;
        }
      });
      vorige = ph;
      return ph;
    });
    // Verlauf je Tag im Zeitraum: Umfang und noch nicht erreicht je Block, Stand am Tagesende
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    const tage = [];
    if (erste !== Infinity && !nurLetzter) for (let t = Math.max(tag(erste), tag(g.von)); t < morgen; t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      const da = bew.aufgaben.filter(passt).map(a => ({ a, s: spalteAm(a.wechsel, ende) })).filter(x => zaehlt(x.a, x.s, ende));
      tage.push({ t, umfang: da.length, offen: Object.fromEntries(stufen.map(st => [st.schluessel, da.filter(x => !st.entfaellt(x.a) && !st.durch(x.a, x.s)).length])) });
    }
    const verworfen = bew.aufgaben.filter(a => { const s = spalteAm(a.wechsel, jetzt), x = aufgabeZu(a.nummer); return passt(a) && s != null && spalten.includes(s) && !zaehlt(a, s, jetzt) && x; }).length;
    const weg = bew.aufgaben.filter(a => imFilter(a) && !zaehltImBericht(a, 'forecast') && zaehlt(a, spalteAm(a.wechsel, jetzt), jetzt)).length;
    return { umfang, heute, phasen: bloecke, tage, verworfen, ausgenommen: weg, gezaehlt: jetztDa.map(x => x.a.nummer), nachPhasen: !!phasen };
  }

  /* ── Projekt-Fever-Chart (R00078) ── */
  const isoD = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
  /** Tag der ersten Bewegung auf dem Board (JJJJ-MM-TT) — der Projektstart, solange keiner eingestellt ist; null ohne Bewegung. */
  function ersterTag(bew) {
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    return erste === Infinity ? null : isoD(erste);
  }
  /** Die Blöcke aus „Wie lange noch“ unter dem Filter, von links nach rechts — zur Wahl der Zielspalte (R00079). */
  const fieberBloecke = (bew, f, phasen) => prognoseStufen(bew, bew.spalten.filter(s => !f.ohneSpalten.includes(s)), phasen).map(st => ({ schluessel: st.schluessel, titel: st.titel }));
  /** Schlüssel des Caches: Projektstart, Berichtsfilter (Listen sortiert, damit dieselbe Auswahl denselben Schlüssel gibt)
      und eine gewählte Zielspalte — ohne sie gilt der Schlüssel aus R00078 weiter. */
  function fieberSchluessel(start, f, ziel = null) {
    const filter = {};
    for (const k of Object.keys(FILTER_LEER)) filter[k] = Array.isArray(f[k]) ? [...f[k]].sort() : f[k];
    if (filter.zeitraum !== 'eigen') { filter.von = ''; filter.bis = ''; }
    return JSON.stringify(ziel ? { v: 1, start, filter, ziel } : { v: 1, start, filter });
  }
  /** Ein Tag des Fever Charts aus der Sicht seines Tagesendes: erledigt und Umfang des letzten Blocks, prognostiziertes Ende
      je Perzentil in 7- und 5-Tage-Woche (null = keine Aussage); nichts offen → Ende ist der Tag selbst. Ohne Umfang ein
      leerer Tag — auch er kommt in den Cache, damit er nicht jedes Mal neu gerechnet wird. */
  function fieberTag(bew, f, aufgabeZu, datum, phasen, start, block = null) {
    const t = isoTag(datum), p = prognose(bew, f, aufgabeZu, tag(t, 1) - 1, phasen, { start, nurLetzter: true, block });
    const b = p.phasen[0], leer = [null, null, null, null];
    if (!b || !b.nenner) return { datum, erledigt: 0, umfang: 0, ende7: leer, ende5: leer };
    const ende = n => PERZENTILE.map(q => !b.offen ? datum : b.zeilen ? isoD(b.zeilen.find(z => z.p === q)['datum' + n]) : null);
    return { datum, erledigt: b.erreicht, umfang: b.nenner, ende7: ende(7), ende5: ende(5) };
  }
  /** Tage vom Start bis gestern, die im Cache fehlen; in der Arbeitstage-Einheit zählen auch Wochenenden (der Cache hält beide). */
  function fehlendeTage(start, vorhanden, jetzt) {
    const da = new Set(vorhanden), fehlt = [];
    for (let t = isoTag(start); t < tag(jetzt); t = tag(t, 1)) if (!da.has(isoD(t))) fehlt.push(isoD(t));
    return fehlt;
  }
  /** Tage nach `a` bis einschließlich `b` in der Einheit: 5 = Arbeitstage, 7 = Kalendertage; negativ, wenn `b` vor `a` liegt. */
  function dauerIn(woche, a, b) {
    const x = isoTag(a), y = isoTag(b);
    if (woche === 7) return Math.round((y - x) / TAG);
    return y >= x ? werktageBis(x, y) : -werktageBis(y, x);
  }
  /** Puffervorschlag: 1/3 der Gesamtdauer — die CCPM-Regel „Puffer = 50 % der Kette“ (Kette 2/3, Puffer 1/3); mindestens 1. */
  const pufferVorschlag = gesamt => Math.max(1, Math.round(gesamt / 3));
  /** Zone eines Punkts; Grenzen als Verbrauch in % bei 0 und bei 100 % Fortschritt, gerade dazwischen. */
  function fieberZone(p, b, gelb, rot) {
    const grenze = ([a, z]) => a + (z - a) * p / 100;
    if (b > 100) return 'schwarz';
    if (b >= grenze(rot)) return 'rot';
    if (b >= grenze(gelb)) return 'gelb';
    return 'gruen';
  }
  /** Gesamtdauer, Arbeitsbereich und Planende aus Start, Zieltermin und Puffer; null, wenn etwas fehlt oder nicht passt. */
  function fieberPlan({ start, ziel, puffer, woche }) {
    if (!start || !ziel || !puffer) return null;
    const gesamt = dauerIn(woche, start, ziel);
    if (gesamt <= puffer) return { gesamt, fehler: gesamt <= 0 ? 'Der Zieltermin liegt nicht nach dem Projektstart' : `Der Puffer (${puffer}) ist nicht kürzer als die Gesamtdauer (${gesamt})` };
    const arbeit = gesamt - puffer;
    return { gesamt, arbeit, puffer, planende: woche === 7 ? isoD(tag(isoTag(start), arbeit)) : isoD(werktagDatum(isoTag(start), arbeit)) };
  }
  /** Die Punkte der Bahn aus den Tagen (Cache und frisch gerechnet): Fortschritt p, Verbrauch b, Ende, Zone.
      Ohne Prognose kein Punkt; in der Arbeitstage-Einheit nur Werktage; nach dem ersten Tag mit 100 % keine weiteren,
      solange es bei 100 % bleibt. */
  function fieberPunkte(tage, e) {
    const plan = fieberPlan(e);
    if (!plan || plan.fehler) return [];
    const k = PERZENTILE.indexOf(e.perzentil), punkte = [];
    let fertig = false;
    for (const t of [...tage].sort((x, y) => x.datum < y.datum ? -1 : 1)) {
      const ende = (e.woche === 7 ? t.ende7 : t.ende5)[k];
      if (!ende || !t.umfang || t.datum < e.start) continue;
      if (e.woche === 5 && !werktag(isoTag(t.datum))) continue;
      const p = 100 * t.erledigt / t.umfang;
      if (p === 100 && fertig) continue;
      fertig = p === 100;
      const b = 100 * (dauerIn(e.woche, e.start, ende) - plan.arbeit) / plan.puffer;
      punkte.push({ datum: t.datum, p, b, ende, erledigt: t.erledigt, umfang: t.umfang, zone: fieberZone(p, b, e.gelb, e.rot) });
    }
    return punkte;
  }

  /** Auflösung (R00080): vom letzten Punkt rückwärts je `schritt` Kalendertage ein Stichtag; hat er keinen Punkt
      (Wochenende, keine Prognose), gilt der letzte Punkt davor. Der letzte Stand bleibt immer. */
  function fieberAusduennen(punkte, schritt) {
    if (schritt <= 1 || !punkte.length) return punkte;
    const raus = [];
    let i = punkte.length - 1;
    while (i >= 0) {
      raus.unshift(punkte[i]);
      const stichtag = isoD(tag(isoTag(punkte[i].datum), -schritt));
      while (i >= 0 && punkte[i].datum > stichtag) i--;
    }
    return raus;
  }

  /* ── Diagramme (R00073) ── */
  /** Tag (lokale Mitternacht) unter der x-Position einer Zeichenfläche `{ l, breite, t0, t1, stetig }`; außerhalb null.
      Eine Tagesachse (Punkte je Tag) rundet auf den nächsten Tag, eine stetige Achse (Zeitpunkte) nimmt den Tag des Zeitpunkts. */
  function tagAnPosition(x, { l, breite, t0, t1, stetig }) {
    if (x < l || x > l + breite) return null;
    if (t1 <= t0) return tag(t0);
    return tag(t0 + (x - l) / breite * (t1 - t0) + (stetig ? 0 : TAG / 2));
  }
  const vollDatum = ms => { const d = new Date(ms), p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`; };

  /* ── Termine (R00047) ── */
  /** Chance einer Spalte, einen Termin (JJJJ-MM-TT) zu halten: vorbei, erreicht, ungemessen oder p7/p5 in [0, 1]. */
  function terminChance(ph, datum, heute) {
    const ziel = isoTag(datum);
    if (ziel < tag(heute)) return { art: 'vorbei' };
    if (!ph.offen) return { art: 'erreicht' };
    if (!ph.erg7) return { art: 'ungemessen' };
    return { art: 'chance', p7: anteilBis(ph.erg7, Math.round((ziel - tag(heute)) / TAG)), p5: anteilBis(ph.erg5, werktageBis(heute, ziel)) };
  }

  Object.assign(ziel, { ersterTag, fieberAusduennen, fieberBloecke, fieberSchluessel, fieberTag, fehlendeTage, dauerIn, pufferVorschlag, fieberZone, fieberPlan, fieberPunkte, tagAnPosition, vollDatum, zaehltImBericht, ausgenommen, phasenRang, phasenStufen, ersterDurchlauf, terminChance, anteilBis, werktageBis, prognose, simuliere, tagesreihen, werktagDatum, PERZENTILE, MIN_LAEUFE, durchlaufzeiten, perzentil, spalteAm, burndown, ZEITRAEUME, FILTER_LEER, zeitraumGrenzen, aufgabePasst, zeitenGefiltert, filterAnzahl, filterAus, isoTag });
})(typeof module !== 'undefined' ? module.exports : window);
