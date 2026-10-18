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

  /** Je Spalte (außer der ersten gezählten): erreicht, offen, Tagesreihe, Perzentile; dazu der Verlauf je Tag. */
  function prognose(bew, f, aufgabeZu, jetzt) {
    const heute = tag(jetzt), morgen = tag(jetzt, 1), g = zeitraumGrenzen(f, jetzt);
    const spalten = bew.spalten.filter(s => !f.ohneSpalten.includes(s));
    const idx = s => bew.spalten.indexOf(s);
    const passt = a => aufgabePasst(f, aufgabeZu(a.nummer));
    // archiviert außerhalb der Abschlussspalte heißt verworfen: ab dem Archivtag kein Umfang mehr
    const letzte = bew.spalten[bew.spalten.length - 1];
    const zaehlt = (a, s, t) => { const x = aufgabeZu(a.nummer); return s != null && spalten.includes(s) && !(x && x.archiviert && s !== letzte && t >= isoTag(x.archiviert)); };
    const jetztDa = bew.aufgaben.filter(passt).map(a => ({ a, s: spalteAm(a.wechsel, jetzt) })).filter(x => zaehlt(x.a, x.s, jetzt));
    const umfang = jetztDa.length;
    let vorige = null;
    const phasen = spalten.slice(1).map(spalte => {
      const i = idx(spalte);
      const offen = jetztDa.filter(x => idx(x.s) < i).length;
      const daten = jetztDa.map(x => erreicht(x.a.wechsel, bew.spalten, i)).filter(d => d != null && d >= g.von && d < Math.min(g.bis, morgen));
      const ph = { spalte, erreicht: umfang - offen, offen, laeufe: daten.length, zeilen: null, reihe7: [], reihe5: [], durchsatz: null };
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
      // nie früher als die Spalte links davon: deren Datum als Untergrenze nennen, nicht verrechnen
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
    // Verlauf je Tag im Zeitraum: Umfang und noch nicht erreicht je Spalte, Stand am Tagesende
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    const tage = [];
    if (erste !== Infinity) for (let t = Math.max(tag(erste), tag(g.von)); t < morgen; t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      const da = bew.aufgaben.filter(passt).map(a => ({ a, s: spalteAm(a.wechsel, ende) })).filter(x => zaehlt(x.a, x.s, ende)).map(x => x.s);
      tage.push({ t, umfang: da.length, offen: Object.fromEntries(phasen.map(ph => [ph.spalte, da.filter(s => idx(s) < idx(ph.spalte)).length])) });
    }
    const verworfen = bew.aufgaben.filter(a => { const s = spalteAm(a.wechsel, jetzt), x = aufgabeZu(a.nummer); return passt(a) && s != null && spalten.includes(s) && !zaehlt(a, s, jetzt) && x; }).length;
    return { umfang, heute, phasen, tage, verworfen, gezaehlt: jetztDa.map(x => x.a.nummer) };
  }

  /* ── Termine (R00047) ── */
  /** Chance einer Spalte, einen Termin (JJJJ-MM-TT) zu halten: vorbei, erreicht, ungemessen oder p7/p5 in [0, 1]. */
  function terminChance(ph, datum, heute) {
    const ziel = isoTag(datum);
    if (ziel < tag(heute)) return { art: 'vorbei' };
    if (!ph.offen) return { art: 'erreicht' };
    if (!ph.erg7) return { art: 'ungemessen' };
    return { art: 'chance', p7: anteilBis(ph.erg7, Math.round((ziel - tag(heute)) / TAG)), p5: anteilBis(ph.erg5, werktageBis(heute, ziel)) };
  }

  Object.assign(ziel, { terminChance, anteilBis, werktageBis, prognose, simuliere, tagesreihen, werktagDatum, PERZENTILE, MIN_LAEUFE, durchlaufzeiten, perzentil, spalteAm, burndown, ZEITRAEUME, FILTER_LEER, zeitraumGrenzen, aufgabePasst, zeitenGefiltert, filterAnzahl, filterAus, isoTag });
})(typeof module !== 'undefined' ? module.exports : window);
