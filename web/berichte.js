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

  Object.assign(ziel, { spalteAm, burndown, ZEITRAEUME, FILTER_LEER, zeitraumGrenzen, aufgabePasst, zeitenGefiltert, filterAnzahl, filterAus, isoTag });
})(typeof module !== 'undefined' ? module.exports : window);
