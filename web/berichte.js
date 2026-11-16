/* kanbanD — Berichte: Zeitraum, Filter und Rechnungen über Bewegungen; rein, im Browser und in Node nutzbar. */
(function (ziel) {
  const { datumAusMs, datumLang, achsenMarke, seitText } = typeof module !== 'undefined' ? require('./kultur.js') : window;
  const TAG = 864e5;

  /* ── Zeitraum und Filter (R00043) ── */
  const ZEITRAEUME = [['heute', 'heute'], ['gestern', 'gestern'], ['woche', 'diese Woche'], ['vorwoche', 'letzte Woche'], ['monat', 'dieser Monat'], ['vormonat', 'letzter Monat'], ['30', 'letzte 30 Tage'], ['90', 'letzte 90 Tage'], ['jahr', 'dieses Jahr'], ['alles', 'alles'], ['eigen', 'eigener Zeitraum']];
  const FILTER_LEER = { zeitraum: 'alles', von: '', bis: '', ohneFarben: [], ohneSpalten: [], personen: [], labels: [], messbasisTage: 90 };

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

  /** Grenzen mit „Rechnen ab“ (R00081): ohne gewählten Zeitraum beginnt die Rechnung am Projektstart. */
  function grenzenAb(f, jetzt, start) {
    const g = zeitraumGrenzen(f, jetzt);
    if (start && f.zeitraum === 'alles') g.von = isoTag(start);
    return g;
  }

  /** Anzahl wirkender Filter (für die Leiste). */
  const filterAnzahl = f => (f.zeitraum !== 'alles' ? 1 : 0) + f.ohneFarben.length + f.ohneSpalten.length + f.personen.length + f.labels.length;
  /** Was die Leiste dieses Berichts als aktiv zählt: den Zeitraum nur, wo sie ihn zeigt (`filterAnzahl` des Berichts). */
  const leistenAnzahl = (f, teile) => filterAnzahl(teile.zeitraum ? f : { ...f, zeitraum: 'alles' });

  /** Was die Filterleiste je Bericht zeigt — die eine Quelle für die Leiste und für „Zurücksetzen“. */
  const BERICHTSLEISTEN = {
    stundenzettel: {},
    zeiten: { zeitraum: true, personen: 'zeit' },
    burndown: { start: true, zeitraum: true, spalten: true, personen: 'zustaendig' },
    fluss: { start: true, zeitraumBleibt: true, spalten: true, personen: 'zustaendig' },
    durchlaufzeit: { start: true, zeitraum: true, personen: 'zustaendig' },
    durchsatz: { start: true, zeitraumBleibt: true, spalten: true, personen: 'zustaendig' },
    wieLangeNoch: { start: true, messbasis: true, spalten: true, personen: 'zustaendig' },
    fieber: { start: true, messbasis: true, spalten: true, personen: 'zustaendig' },
    kosten: { spalten: true, personen: 'zustaendig', zeitraumGiltNicht: true },
    bestand: { spalten: true, personen: 'zustaendig', zeitraumGiltNicht: true },
  };

  /** Hinweis an „Zurücksetzen“ (R00105 US-25, PO Z. 118): nennt von Messbasis und „Rechnen ab“ nur, was die Leiste zeigt. */
  function zuruecksetzenHinweis(teile) {
    const text = 'die gezählten Filter aufheben';
    if (teile.messbasis && teile.start) return `${text} — Messbasis und „Rechnen ab“ bleiben`;
    if (teile.zeitraumBleibt && teile.start) return `${text} — Zeitraum und „Rechnen ab“ bleiben`;
    if (teile.start) return `${text} — „Rechnen ab“ bleibt`;
    return text;
  }

  /** „Zurücksetzen“ (R00105 US-19, PO Z. 106/116): hebt Klassen, Spalten, Zuständige und Labels auf, den Zeitraum nur,
   *  wenn die Leiste ihn zeigt. Messbasis und „Rechnen ab“ sind Einstellungen der Rechnung und bleiben immer. */
  function filterZuruecksetzen(f, teile) {
    const aufgehoben = { ...f, ohneFarben: [], ohneSpalten: [], personen: [], labels: [] };
    if (!teile.zeitraum) return aufgehoben;
    return { ...aufgehoben, zeitraum: 'alles', von: '', bis: '' };
  }

  /** Gespeicherten Filter lesen: unbekannte Felder verwerfen, fehlende ergänzen. */
  function filterAus(text) {
    let x = {};
    try { x = JSON.parse(text || '{}') || {}; } catch (_) { x = {}; }
    const f = { ...FILTER_LEER };
    for (const k of Object.keys(FILTER_LEER)) if (x[k] != null && typeof x[k] === typeof FILTER_LEER[k] && Array.isArray(x[k]) === Array.isArray(FILTER_LEER[k])) f[k] = x[k];
    if (!(Number.isInteger(f.messbasisTage) && f.messbasisTage >= 1)) f.messbasisTage = FILTER_LEER.messbasisTage;
    if (!ZEITRAEUME.some(([k]) => k === f.zeitraum)) f.zeitraum = 'alles';
    return f;
  }

  /* ── Bewegungen (R00042) ── */
  const zeitMs = z => { const [d, t] = z.split(' '); const [j, m, tg] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(j, m - 1, tg, h, mi).getTime(); };

  /** Spalte einer Aufgabe zum Zeitpunkt t (null = nicht auf dem Board). Ein Wechsel darf seinen Zeitpunkt schon gerechnet
      mitbringen (`ms`, siehe `wechselInMs`) — dann liest die Schleife je Tag kein Datum mehr. */
  function spalteAm(wechsel, t) {
    let s = null;
    for (const w of wechsel) { if ((w.ms ?? zeitMs(w.zeitpunkt)) > t) break; s = w.spalte; }
    return s;
  }

  /* ── Bestand (R00152, ADR-0027): die eine Regel „zählt am Tag“ für Burndown, Kumulativen Fluss und „Wie lange noch“ ── */
  const NICHT_DA = Object.freeze({ art: 'nichtDa', spalte: null, erledigt: false });
  /** Zustand einer Aufgabe zum Zeitpunkt t — { art, spalte, erledigt }:
      `nichtDa`  in keiner Spalte (nie auf dem Board, vom Board genommen, endgültig gelöscht);
      `entfernt` verworfen: Archivtag (`archiviert`, JJJJ-MM-TT, gilt ab 0 Uhr) erreicht und die Spalte liegt nicht in `erledigtSpalten`;
      `da`       sonst, `erledigt` genau dann, wenn die Spalte in `erledigtSpalten` liegt — archiviert in einer Erledigt-Spalte bleibt erledigt.
      Nur „da“ zählt zum Bestand (offen, Umfang, gesamt, Bänder). Filter (Spalten, Farbe, Person, Label, `reporting`) wirken außerhalb. */
  function bestandAm(wechsel, archiviert, t, erledigtSpalten) {
    const spalte = spalteAm(wechsel, t);
    if (spalte == null) return NICHT_DA;
    const erledigt = erledigtSpalten.includes(spalte);
    // der Archivtag wird nur gelesen, wo er entscheidet: erledigte archivierte Aufgaben (die Masse im Archiv) kosten kein Datum
    if (archiviert && !erledigt && t >= isoTag(archiviert)) return { art: 'entfernt', spalte, erledigt: false };
    return { art: 'da', spalte, erledigt };
  }
  /** Was „erledigt“ heißt: heute die Abschlussspalte (die letzte Spalte) des Boards. */
  const erledigtSpalten = bew => bew.spalten.slice(-1);
  /** Die Wechsel einer Aufgabe mit gerechnetem Zeitpunkt — einmal je Aufgabe, nicht je Tag (Lastprofil, ADR-0027). */
  const wechselInMs = wechsel => wechsel.map(w => ({ ms: zeitMs(w.zeitpunkt), spalte: w.spalte }));
  /** Bestand der Aufgaben eines Boards: zu einer Aufgabe (Eintrag aus bew.aufgaben) die Funktion `t → Zustand` (`bestandAm`).
      Der Archivtag kommt aus der Aufgabenliste des Clients (`aufgabeZu`; ohne Datei kein Archivtag), „erledigt“ aus dem Board;
      beides und die Zeitpunkte der Wechsel werden je Aufgabe einmal gelesen. */
  function bestandLeser(bew, aufgabeZu) {
    const erledigt = erledigtSpalten(bew);
    return a => {
      const x = aufgabeZu(a.nummer), archiviert = x && x.archiviert, wechsel = wechselInMs(a.wechsel);
      return t => bestandAm(wechsel, archiviert, t, erledigt);
    };
  }
  /** Die Aufgabenliste mit Gedächtnis: je Nummer wird `aufgabeZu` einmal gefragt — die Liste des Clients sucht linear, und
      ein Bericht fragt je Aufgabe mehrfach (Filter, Archivtag). */
  function einmalJeAufgabe(aufgabeZu) {
    const antworten = new Map();
    return nr => { if (!antworten.has(nr)) antworten.set(nr, aufgabeZu(nr)); return antworten.get(nr); };
  }
  /** Zählt dieser Zustand zum Bestand des Berichts? „Da“ und nicht in einer ausgeschlossenen Spalte. */
  const imBestand = (f, zustand) => zustand.art === 'da' && !f.ohneSpalten.includes(zustand.spalte);

  /** Eintritt in die heutige Spalte (R00126, ADR-0019 N5): der letzte Wechsel mit einer Spalte bis `t` — Schwester von `spalteAm`,
      liefert statt des Spaltennamens den `zeitpunkt`. `null`, wenn die Aufgabe nie auf dem Board war oder zuletzt davon genommen wurde. */
  function eintrittAm(wechsel, t) {
    let spalte = null, zeitpunkt = null;
    for (const w of wechsel || []) { if (zeitMs(w.zeitpunkt) > t) break; spalte = w.spalte; zeitpunkt = w.zeitpunkt; }
    if (spalte == null) return null;
    return zeitpunkt;
  }

  /** Alter in der heutigen Spalte (R00126 FA 5/6, ADR-0019 N5): Kurzform und Vollform aus **einer** Dauer — `null` ohne Eintritt.
      Die Dauer bildet `seitText` (ADR-0013), es entsteht keine zweite „seit …“-Regel. */
  function alterText(wechsel, spalte, jetzt) {
    const eintritt = eintrittAm(wechsel, jetzt);
    if (eintritt == null || !spalte) return null;
    const wort = seitText(jetzt - zeitMs(eintritt));
    return { kurz: wort, voll: `${wort} in ${spalte}` };
  }

  /* ── Zählen in Berichten je Aufgabe (R00060) ── */
  /** Zählt die Aufgabe (Eintrag aus bew.aufgaben) im Bericht `burndown` oder `forecast`? Nur `false` nimmt sie aus. */
  const zaehltImBericht = (a, bericht) => !(a.reporting && a.reporting[bericht] === false);
  /** Aufgaben, die jetzt zum Bestand gehören (da, in einer gezählten Spalte) und zum Filter passen, aber per `reporting`
      ausgenommen sind — eine verworfene Aufgabe steht hier nicht (R00152). */
  function ausgenommen(bew, bericht, f, aufgabeZu, jetzt) {
    const bestand = bestandLeser(bew, aufgabeZu);
    return bew.aufgaben.filter(a => !zaehltImBericht(a, bericht) && aufgabePasst(f, aufgabeZu(a.nummer)) && imBestand(f, bestand(a)(jetzt))).length;
  }

  /* ── Burndown (R00044) ── */
  /** Je Tag im Zeitraum: offen (im Bestand und nicht erledigt) und Umfang (im Bestand), Stand am Tagesende, heute jetzt; ab `start`. */
  function burndown(bew, f, aufgabeListe, jetzt, start = null) {
    const g = grenzenAb(f, jetzt, start), aufgabeZu = einmalJeAufgabe(aufgabeListe), bestand = bestandLeser(bew, aufgabeZu);
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return [];
    const gezaehlt = bew.aufgaben.filter(a => zaehltImBericht(a, 'burndown') && aufgabePasst(f, aufgabeZu(a.nummer))).map(bestand);
    const tage = [];
    for (let t = Math.max(tag(erste), tag(g.von)); t < Math.min(g.bis, tag(jetzt, 1)); t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      let offen = 0, umfang = 0;
      for (const zustandAm of gezaehlt) {
        const zustand = zustandAm(ende);
        if (!imBestand(f, zustand)) continue;
        umfang++;
        if (!zustand.erledigt) offen++;
      }
      const d = new Date(t), p = n => String(n).padStart(2, '0');
      tage.push({ datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, offen, umfang });
    }
    return tage;
  }

  /* ── Kumulativer Fluss (R00121) ── */
  /** Je Tag im Zeitraum die gestapelten Bänder je Spalte (Stand am Tagesende, heute jetzt; ab `start`)
      mit `gesamt` (Summe der Bänder) und `offen` (im Bestand und nicht erledigt).
      Zählt wie der Burndown: Bänder, `gesamt` und `offen` aus dem Bestand (`bestandAm`), `angekommen` und `fertig` aus dem
      ersten Erreichen (sinken nicht); `reporting.burndown` und der Berichtsfilter schränken ein, ausgeschlossene
      Spalten tragen kein Band. Die Bänder stehen in Board-Reihenfolge; `spalten` sind die Board-Spalten. */
  function fluss(bew, f, aufgabeListe, jetzt, start = null) {
    const spalten = bew.spalten, aufgabeZu = einmalJeAufgabe(aufgabeListe);
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return { spalten, tage: [] };
    const g = grenzenAb(f, jetzt, start), abschluss = spalten[spalten.length - 1], bestand = bestandLeser(bew, aufgabeZu);
    // je Aufgabe einmal: der Bestand über die Zeit, die Ankunft und das Erreichen der Abschlussspalte — nicht je Tag neu.
    const erstesMal = (a, trifft) => { const w = a.wechsel.find(trifft); return w ? zeitMs(w.zeitpunkt) : Infinity; };
    const beitraege = bew.aufgaben
      .filter(a => zaehltImBericht(a, 'burndown') && aufgabePasst(f, aufgabeZu(a.nummer)))
      .map(a => ({ zustandAm: bestand(a), ankunft: erstesMal(a, w => w.spalte != null), fertig: erstesMal(a, w => w.spalte === abschluss) }));
    const tage = [];
    for (let t = Math.max(tag(erste), tag(g.von)); t < Math.min(g.bis, tag(jetzt, 1)); t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      const jeSpalte = Object.fromEntries(spalten.map(s => [s, 0]));
      let gesamt = 0, offen = 0, angekommen = 0, fertig = 0;
      for (const b of beitraege) {
        const zustand = b.zustandAm(ende);
        if (imBestand(f, zustand)) {
          jeSpalte[zustand.spalte]++;
          gesamt++;
          if (!zustand.erledigt) offen++;
        }
        // „angekommen“ und „fertig“ steigen monoton: eine spätere Abnahme senkt sie nicht
        if (b.ankunft <= ende) angekommen++;
        if (b.fertig <= ende) fertig++;
      }
      const d = new Date(t), p = n => String(n).padStart(2, '0');
      tage.push({ datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, jeSpalte, gesamt, offen, angekommen, fertig });
    }
    return { spalten, tage };
  }

  /** Tageswerte eines Bandes (Spaltenname) oder eines Randes (`gesamt`, `offen`, `angekommen`, `fertig`). */
  function flussRand(tage, schluessel) {
    return tage.map(t => t.jeSpalte && schluessel in t.jeSpalte ? t.jeSpalte[schluessel] : t[schluessel]);
  }
  /** Tooltiptext eines Tages: „04.11.2026 · Eingang 1 · … · offen 2 · gesamt 4 · angekommen 4 · fertig 2“. */
  function flussName(datum, stand, spalten) {
    return [datumLang(datum), ...spalten.map(s => `${s} ${stand.jeSpalte[s] || 0}`), `offen ${stand.offen}`, `gesamt ${stand.gesamt}`, `angekommen ${stand.angekommen}`, `fertig ${stand.fertig}`].join(' · ');
  }
  /** Höchster Wert der Bänder und der beiden kumulierten Ränder über alle Tage — die y-Achse reicht bis dahin. */
  const flussMax = tage => Math.max(1, ...tage.map(x => Math.max(x.gesamt, x.angekommen, x.fertig)));

  /* ── Durchsatz je Zeitraum (R00122) ── */
  /** Auflösungen des Durchsatzes in Anzeigereihenfolge: Schlüssel und Einheitenwort; Standard ist die Woche. */
  const DURCHSATZ_EINHEITEN = [['tag', 'je Tag'], ['woche', 'je Woche'], ['monat', 'je Monat']];
  const DURCHSATZ_STANDARD = 'woche';
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

  /** Montag der Woche, in der `ms` liegt (Mo–So, wie `wochenbeginn`, web/zeiten.js:39). */
  const montag = ms => { const d = new Date(tag(ms)); return tag(ms, -((d.getDay() + 6) % 7)); };
  const monatsbeginn = ms => { const d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
  /** Beginn der Kalenderperiode, in der `ms` liegt. */
  const periodeStart = (ms, einheit) => einheit === 'woche' ? montag(ms) : einheit === 'monat' ? monatsbeginn(ms) : tag(ms);
  /** Beginn der nächsten Kalenderperiode. */
  const periodeEnde = (ms, einheit) => einheit === 'woche' ? tag(ms, 7)
    : einheit === 'monat' ? new Date(new Date(ms).getFullYear(), new Date(ms).getMonth() + 1, 1).getTime() : tag(ms, 1);

  /** ISO-Kalenderwoche (Mo–So) des Tages: { jahr, woche }. */
  function isoWoche(ms) {
    const d = new Date(ms), donnerstag = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    donnerstag.setDate(donnerstag.getDate() + 3 - ((donnerstag.getDay() + 6) % 7));
    const jahr = donnerstag.getFullYear(), erster = new Date(jahr, 0, 4);
    erster.setDate(erster.getDate() + 3 - ((erster.getDay() + 6) % 7));
    return { jahr, woche: 1 + Math.round((donnerstag - erster) / (7 * TAG)) };
  }

  /** Ziel des Durchsatzes: die Abschlussspalte (Index und Name) oder bei gebundenem Board die letzte Phase samt Stufe. */
  function durchsatzZiel(bew, phasen) {
    if (phasen && phasen.folge && phasen.folge.length) {
      const stufen = phasenStufen(phasen, bew.spalten), letzte = stufen[stufen.length - 1];
      return { art: 'phase', name: letzte.phase, i: -1, stufe: letzte };
    }
    const i = bew.spalten.length - 1;
    return { art: 'spalte', name: bew.spalten[i], i, stufe: null };
  }

  /** Die Spalten, die das Ziel ausmachen: seine Spalte oder alle Spalten der letzten Phase (samt Abschlussspalte). */
  function zielSpalten(bew, ziel) {
    if (ziel.art === 'spalte') return [ziel.name];
    const letzte = bew.spalten[bew.spalten.length - 1];
    return bew.spalten.filter(s => s === letzte || bew.phasen.spaltenphasen[s] === ziel.name);
  }

  /** Ankunft einer Aufgabe im Ziel: erstes Erreichen der Zielspalte bzw. erstes Durchlaufen der letzten Phase. */
  const ankunftIm = (a, bew, ziel) => ziel.art === 'phase' ? ersterDurchlauf(a, ziel.stufe) : erreicht(a.wechsel, bew.spalten, ziel.i);

  /** Datumsbereich einer Periode: `TT.MM.–TT.MM.JJJJ` (gleicher Monat) bzw. `TT.MM.JJJJ–TT.MM.JJJJ`. */
  function periodeSpanne(von, bis) {
    const a = new Date(von), b = new Date(bis - 1);
    if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) return `${String(a.getDate()).padStart(2, '0')}.–${datumAusMs(bis - 1)}`;
    return `${datumAusMs(von)}–${datumAusMs(bis - 1)}`;
  }
  /** Kurzname einer Periode: `KW45 02.–08.11.2026`, `04.11.2026`, `November 2026` (Tabelle und Zugänglichkeit). */
  function durchsatzName(p, einheit) {
    if (einheit === 'tag') return datumAusMs(p.von);
    if (einheit === 'woche') return `KW${isoWoche(p.von).woche} ${periodeSpanne(p.von, p.bis)}`;
    const d = new Date(p.von);
    return `${MONATE[d.getMonth()]} ${d.getFullYear()}`;
  }
  /** Tooltiptext einer Periode: `Woche 09.–15.11.2026`, `04.11.2026`, `November 2026`. */
  function durchsatzTip(p, einheit) {
    if (einheit === 'woche') return `Woche ${periodeSpanne(p.von, p.bis)}`;
    return durchsatzName(p, einheit);
  }
  /** Achsenmarke einer Periode, zweizeilig: { oben, unten } (`04.11.`/`2026`, `KW45`/`2026`, `November 2026`/„“). */
  function durchsatzMarke(p, einheit) {
    if (einheit === 'tag') { const [oben, unten] = achsenMarke(p.von); return { oben, unten }; }
    if (einheit === 'woche') { const w = isoWoche(p.von); return { oben: `KW${w.woche}`, unten: String(w.jahr) }; }
    return { oben: durchsatzName(p, einheit), unten: '' };
  }
  /** Indizes der Tagesmarken der x-Achse in Burndown und Kumulativem Fluss; der letzte Tag ist immer dabei. */
  function xMarken(anzahl) {
    return [...Array(anzahl).keys()].filter(i => anzahl <= 8 || i % Math.ceil(anzahl / 8) === 0 || i === anzahl - 1);
  }
  /** Indizes der Periodenmarken der x-Achse: **garantiert höchstens acht** (Schritt ceil((n−1)/7) statt i % ceil(n/8),
      das neun liefern kann), die letzte Periode ist immer dabei (M8/S2). */
  function durchsatzMarken(anzahl) {
    if (anzahl <= 1) return anzahl === 1 ? [0] : [];
    const schritt = Math.max(1, Math.ceil((anzahl - 1) / 7));
    return [...Array(anzahl).keys()].filter(i => i % schritt === 0 || i === anzahl - 1);
  }

  /** Durchsatz je Kalenderperiode (R00122): je Aufgabe das erste Erreichen des Ziels (Abschlussspalte bzw. letzte
      Phase) zählen. `einheit` ist 'tag' | 'woche' | 'monat' (Standard Woche); Perioden sind Kalenderfenster über
      [von, bis) des Filters — „Rechnen ab“ schneidet den Anfang, die Messbasis wirkt nicht, die angebrochene letzte
      Periode zählt bis heute. `reporting.forecast: false` nimmt aus (zählt in `ausgenommen`); ist das Ziel ganz
      ausgeschlossen, gibt es keine Aussage (`zielAusgeschlossen`, keine Perioden). Ø = Gesamt ÷ dargestellte Perioden. */
  function durchsatz(bew, f, aufgabeZu, jetzt, start = null, einheit = DURCHSATZ_STANDARD) {
    const ziel = durchsatzZiel(bew, bew.phasen);
    const leer = { einheit, perioden: [], gesamt: 0, durchschnitt: null, ausgenommen: 0, zielAusgeschlossen: false, ziel };
    if (!bew.spalten.length) return leer;
    if (zielSpalten(bew, ziel).every(s => f.ohneSpalten.includes(s))) return { ...leer, zielAusgeschlossen: true };
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return leer;
    const g = grenzenAb(f, jetzt, start);
    const von = Math.max(tag(erste), g.von), bis = Math.min(g.bis, tag(jetzt, 1));
    if (!(bis > von)) return leer;
    const perioden = [];
    for (let p = periodeStart(von, einheit); p < bis; p = periodeEnde(p, einheit)) perioden.push({ von: p, bis: periodeEnde(p, einheit), anzahl: 0 });
    let gesamt = 0, ausgenommen = 0;
    for (const a of bew.aufgaben) {
      const t = ankunftIm(a, bew, ziel);
      if (t == null || t < von || t >= bis || !aufgabePasst(f, aufgabeZu(a.nummer))) continue;
      if (!zaehltImBericht(a, 'forecast')) { ausgenommen++; continue; }
      const p = perioden.find(x => t >= x.von && t < x.bis);
      if (p) { p.anzahl++; gesamt++; }
    }
    return { einheit, perioden, gesamt, durchschnitt: perioden.length ? gesamt / perioden.length : null, ausgenommen, zielAusgeschlossen: false, ziel };
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

  /** Je Aufgabe Eintritt in „von“, Ankunft in „bis“ (im Zeitraum, ab `start`) und Tage; dazu Kennzahlen. */
  function durchlaufzeiten(bew, f, aufgabeZu, jetzt, von, bis, start = null) {
    const iv = Math.max(0, bew.spalten.indexOf(von)), ib = bew.spalten.indexOf(bis) < 0 ? bew.spalten.length - 1 : bew.spalten.indexOf(bis);
    const leer = { liste: [], anzahl: 0, mittel: null, median: null, p85: null, gueltig: iv < ib };
    if (iv >= ib) return leer;
    const g = grenzenAb(f, jetzt, start);
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
      Messbasis (R00083): die letzten `f.messbasisTage` Tage bis `jetzt`, gleitend — frühestens ab `start` („Rechnen ab“)
      und frühestens am Tag der ersten Aufgabe auf dem Board; der Kalenderzeitraum des Filters wirkt hier nicht.
      Der Verlauf beginnt mit der ersten Aufgabe, frühestens bei `start`.
      `nurLetzter` rechnet nur den letzten Block und keinen Verlauf — für das Fever Chart, das jeden Tag einzeln rechnet;
      `block` (R00079) statt des letzten nur den Block mit diesem Schlüssel (gibt es ihn nicht, den letzten). */
  function prognose(bew, f, aufgabeZu, jetzt, phasen, optionen = {}) {
    // Gemerkt nach Inhalt — Bewegungen, was der Filter an den Aufgaben liest, Filter, Optionen, Tag: Neuzeichnen ohne neue
    // Daten rechnet nicht neu; die Monte-Carlo-Ziehungen kosten auf großen Boards Sekunden. Nach Inhalt, nicht nach Objekt,
    // weil jedes Live-Ereignis die Bewegungen neu lädt, auch wenn sich nichts geändert hat.
    const merkmale = bew.aufgaben.map(a => { const x = aufgabeZu(a.nummer); return x ? [x.klasse, x.zustaendige, x.labels, x.archiviert] : null; });
    const schluessel = JSON.stringify([bew.spalten, bew.aufgaben, merkmale, phasen || null, f, optionen.start || null, !!optionen.nurLetzter, optionen.block || null, tag(jetzt)]);
    if (!gemerkt.has(schluessel)) {
      gemerkt.set(schluessel, prognoseRechnen(bew, f, aufgabeZu, jetzt, phasen, optionen));
      if (gemerkt.size > 64) gemerkt.delete(gemerkt.keys().next().value);
    }
    return gemerkt.get(schluessel);
  }
  const gemerkt = new Map();
  function prognoseRechnen(bew, f, aufgabeListe, jetzt, phasen, { start = null, nurLetzter = false, block = null } = {}) {
    if (block) nurLetzter = true;
    const aufgabeZu = einmalJeAufgabe(aufgabeListe);
    const heute = tag(jetzt), morgen = tag(jetzt, 1);
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    const ab = Math.max(start ? isoTag(start) : 0, erste === Infinity ? 0 : tag(erste));
    const fenster = Math.max(tag(heute, 1 - (f.messbasisTage || FILTER_LEER.messbasisTage)), ab);
    const spalten = bew.spalten.filter(s => !f.ohneSpalten.includes(s));
    // je Aufgabe einmal: der Bestand über die Zeit (verworfen heißt dort „entfernt“ — ab dem Archivtag kein Umfang mehr)
    const bestand = bestandLeser(bew, aufgabeZu);
    const passend = bew.aufgaben.filter(a => aufgabePasst(f, aufgabeZu(a.nummer))).map(a => ({ a, zustandAm: bestand(a) }));
    // reporting.forecast: false (R00060) nimmt die Aufgabe ganz aus der Prognose, zusätzlich zum Filter
    const gezaehlt = passend.filter(x => zaehltImBericht(x.a, 'forecast')), nichtGezaehlt = passend.filter(x => !zaehltImBericht(x.a, 'forecast'));
    const inSpalten = zustand => spalten.includes(zustand.spalte);
    const imUmfang = zustand => zustand.art === 'da' && inSpalten(zustand);
    /** Die gezählten Aufgaben, die zum Zeitpunkt t zum Umfang gehören, mit ihrer Spalte. */
    const daAm = t => gezaehlt.map(x => ({ a: x.a, zustand: x.zustandAm(t) })).filter(x => imUmfang(x.zustand)).map(x => ({ a: x.a, s: x.zustand.spalte }));
    const jetztDa = daAm(jetzt);
    const umfang = jetztDa.length;
    let vorige = null;
    const alle = prognoseStufen(bew, spalten, phasen), gewaehlt = alle.filter(st => st.schluessel === block);
    const stufen = gewaehlt.length ? gewaehlt : nurLetzter ? alle.slice(-1) : alle;
    const bloecke = stufen.map(st => {
      const dabei = jetztDa.filter(x => !st.entfaellt(x.a));
      const offen = dabei.filter(x => !st.durch(x.a, x.s)).length;
      const daten = dabei.map(x => ersterDurchlauf(x.a, st)).filter(d => d != null && d >= fenster && d <= jetzt);
      const ph = { schluessel: st.schluessel, titel: st.titel, nenner: dabei.length, erreicht: dabei.length - offen, offen, laeufe: daten.length, zeilen: null, reihe7: [], reihe5: [], durchsatz: null };
      if (st.spalte) ph.spalte = st.spalte; else ph.phase = st.phase;
      if (daten.length) {
        Object.assign(ph, tagesreihen(daten, fenster, morgen));
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
    // Verlauf je Tag ab der ersten Aufgabe, frühestens ab Rechnen ab: Umfang und noch nicht erreicht je Block, Stand am Tagesende
    const tage = [];
    if (erste !== Infinity && !nurLetzter) for (let t = ab; t < morgen; t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      const da = daAm(ende);
      tage.push({ t, umfang: da.length, offen: Object.fromEntries(stufen.map(st => [st.schluessel, da.filter(x => !st.entfaellt(x.a) && !st.durch(x.a, x.s)).length])) });
    }
    const verworfen = gezaehlt.map(x => x.zustandAm(jetzt)).filter(zustand => zustand.art === 'entfernt' && inSpalten(zustand)).length;
    const weg = nichtGezaehlt.filter(x => imUmfang(x.zustandAm(jetzt))).length;
    return { umfang, heute, phasen: bloecke, tage, verworfen, ausgenommen: weg, gezaehlt: jetztDa.map(x => x.a.nummer), nachPhasen: !!phasen };
  }

  /** Blöcke für das Diagramm von „Wie lange noch“: die drei rechten mit Prognose — sonst zeigt es keinen Fächer, sobald
      die rechten Blöcke ungemessen sind; ohne jede Prognose die drei rechten. Dazu die ungemessenen rechts davon. */
  function diagrammBloecke(bloecke) {
    const gemessen = bloecke.filter(b => b.zeilen);
    const gezeigt = (gemessen.length ? gemessen : bloecke).slice(-3);
    const ab = gezeigt.length ? bloecke.indexOf(gezeigt[0]) : bloecke.length;
    return { gezeigt, ohnePrognose: bloecke.slice(ab).filter(b => !b.zeilen && b.offen && !gezeigt.includes(b)) };
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
    // der Kalenderzeitraum wirkt seit R00083 nicht mehr auf die Prognose, also auch nicht auf den Schlüssel
    for (const k of Object.keys(FILTER_LEER)) if (!['zeitraum', 'von', 'bis'].includes(k)) filter[k] = Array.isArray(f[k]) ? [...f[k]].sort() : f[k];
    return JSON.stringify(ziel ? { v: 2, start, filter, ziel } : { v: 2, start, filter });
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
      // Abstand zum Planende in Tagen der Einheit (R00082): negativ = vor Plan, Puffer gewonnen
      const abstand = dauerIn(e.woche, e.start, ende) - plan.arbeit, b = 100 * abstand / plan.puffer;
      punkte.push({ datum: t.datum, p, b, abstand, ende, erledigt: t.erledigt, umfang: t.umfang, zone: fieberZone(p, b, e.gelb, e.rot) });
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
  /** Tag in ms → `TT.MM.JJJJ`; die Form gehört dem Kulturmodul (R00109). */
  const vollDatum = ms => datumAusMs(ms);

  /* ── Termine (R00047) ── */
  /** Chance einer Spalte, einen Termin (JJJJ-MM-TT) zu halten: vorbei, erreicht, ungemessen oder p7/p5 in [0, 1]. */
  function terminChance(ph, datum, heute) {
    const ziel = isoTag(datum);
    if (ziel < tag(heute)) return { art: 'vorbei' };
    if (!ph.offen) return { art: 'erreicht' };
    if (!ph.erg7) return { art: 'ungemessen' };
    return { art: 'chance', p7: anteilBis(ph.erg7, Math.round((ziel - tag(heute)) / TAG)), p5: anteilBis(ph.erg5, werktageBis(heute, ziel)) };
  }

  /* ── Bestand nach Labels (R00100) ── */
  /** Natürliche Ordnung: Ziffernfolgen als Zahl (304 vor 1000), sonst deutsch ohne Groß/Klein. */
  const NATUERLICH = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
  const nachNummer = aufgaben => [...aufgaben].sort((x, y) => x.nummer - y.nummer);

  /** Offen heißt: auf dem Board, nicht archiviert und nicht in der letzten Spalte (Abschlussspalte); nach Nummer. */
  function offeneAufgaben(aufgaben, board, filter = FILTER_LEER) {
    const offen = new Set(board.spalten.slice(0, -1).filter(s => !filter.ohneSpalten.includes(s.name)).flatMap(s => s.aufgaben));
    return nachNummer(aufgaben.filter(a => offen.has(a.nummer) && !a.archiviert && aufgabePasst(filter, a)));
  }

  /** Präfix und Wert eines Labels, getrennt am ersten Doppelpunkt; ohne Doppelpunkt oder mit leerem Präfix null. */
  function labelTeile(label) {
    const i = label.indexOf(':');
    if (i < 1) return null;
    return { praefix: label.slice(0, i), wert: label.slice(i + 1) };
  }

  /** Präfixe einer Aufgabe: kleingeschrieben → Schreibweise ihres ersten Labels. */
  function praefixeDerAufgabe(a) {
    const je = new Map();
    for (const t of a.labels.map(labelTeile).filter(Boolean)) {
      const schluessel = t.praefix.toLowerCase();
      if (!je.has(schluessel)) je.set(schluessel, t.praefix);
    }
    return je;
  }

  /** Präfixe der offenen Aufgaben mit Häufigkeit (Aufgaben mit mindestens einem Label davon), ohne Groß/Klein
      zusammengefasst und in der Schreibweise der kleinsten Nummer; häufigster zuerst, bei Gleichstand alphabetisch. */
  function praefixe(offene) {
    const je = new Map();
    for (const a of nachNummer(offene)) {
      for (const [schluessel, praefix] of praefixeDerAufgabe(a)) {
        if (!je.has(schluessel)) je.set(schluessel, { praefix, schluessel, anzahl: 0 });
        je.get(schluessel).anzahl++;
      }
    }
    return [...je.values()].sort((x, y) => y.anzahl - x.anzahl || NATUERLICH.compare(x.schluessel, y.schluessel));
  }

  /** Ohne gespeicherte Einstellung: die zwei häufigsten Präfixe, der häufigste als Zeilen; unter zwei Präfixen null. */
  function vorschlag(praefixListe) {
    if (praefixListe.length < 2) return null;
    return { zeilen: praefixListe[0].praefix, spalten: praefixListe[1].praefix };
  }

  /** Schlüssel der Achsenposition „(ohne …)“: Aufgaben ohne Label des Präfixes. */
  const OHNE = Symbol('ohne');

  /** Werte einer Aufgabe zu einem Präfix, beides ohne Groß/Klein: kleingeschrieben → Schreibweise; ohne Wert nur OHNE. */
  function werteDerAufgabe(a, praefix) {
    const gesucht = praefix.toLowerCase(), je = new Map();
    for (const t of a.labels.map(labelTeile).filter(Boolean)) {
      const schluessel = t.wert.toLowerCase();
      if (t.praefix.toLowerCase() === gesucht && !je.has(schluessel)) je.set(schluessel, t.wert);
    }
    if (!je.size) je.set(OHNE, `(ohne ${praefix})`);
    return je;
  }

  /** Eine Achse: die Werte in natürlicher Ordnung in der Schreibweise der ersten Aufgabe (der kleinsten Nummer),
      dahinter immer „(ohne …)“. */
  function achse(werteJeAufgabe, praefix) {
    const je = new Map();
    for (const [schluessel, wert] of werteJeAufgabe.flatMap(w => [...w])) {
      if (schluessel !== OHNE && !je.has(schluessel)) je.set(schluessel, wert);
    }
    const werte = [...je].sort(([x], [y]) => NATUERLICH.compare(x, y)).map(([schluessel, wert]) => ({ wert, schluessel, ohne: false }));
    return [...werte, { wert: `(ohne ${praefix})`, schluessel: OHNE, ohne: true }];
  }

  /** Rang einer Klasse: Reihenfolge unter `classes`, eine unbekannte danach, ohne Klasse (`''`) zuletzt. */
  function dringlichkeitsRang(klasse, reihenfolge) {
    if (klasse === '') return reihenfolge.length + 1;
    const i = reihenfolge.indexOf(klasse);
    if (i < 0) return reihenfolge.length;
    return i;
  }

  /** Die dringendste der Klassen einer Zelle; eine Zelle ohne Aufgaben hat keine (null). */
  function dringendste(klassenDerZelle, reihenfolge) {
    let beste = null;
    for (const k of klassenDerZelle) {
      if (beste === null || dringlichkeitsRang(k, reihenfolge) < dringlichkeitsRang(beste, reihenfolge)) beste = k;
    }
    return beste;
  }

  /** Eine Zelle aus ihren Aufgaben: Zahl, Nummern, Anzahl je Klasse (`''` = ohne Klasse), dringendste Klasse. */
  function zelleAus(aufgabenDerZelle, reihenfolge) {
    const jeKlasse = {};
    for (const a of aufgabenDerZelle) jeKlasse[a.klasse || ''] = (jeKlasse[a.klasse || ''] || 0) + 1;
    return { zahl: aufgabenDerZelle.length, nummern: aufgabenDerZelle.map(a => a.nummer), jeKlasse, dringendste: dringendste(Object.keys(jeKlasse), reihenfolge) };
  }

  const positionen = (werte, achsenwerte) => [...werte.keys()].map(s => achsenwerte.findIndex(x => x.schluessel === s));

  /** Bestand nach Labels: offene Aufgaben je Paar aus Zeilen- und Spaltenwert. Eine Aufgabe mit mehreren Werten
      zählt in jeder ihrer Zellen; die Summen je Zeile, je Spalte und gesamt zählen jede Aufgabe einmal. */
  function bestandNachLabels(aufgaben, board, reihenfolge, zeilenpraefix, spaltenpraefix, filter = FILTER_LEER) {
    const offene = offeneAufgaben(aufgaben, board, filter);
    const zw = offene.map(a => werteDerAufgabe(a, zeilenpraefix)), sw = offene.map(a => werteDerAufgabe(a, spaltenpraefix));
    const zeilen = achse(zw, zeilenpraefix), spalten = achse(sw, spaltenpraefix);
    const sammel = zeilen.map(() => spalten.map(() => []));
    const summen = { zeilen: zeilen.map(() => 0), spalten: spalten.map(() => 0), gesamt: offene.length };
    offene.forEach((a, k) => {
      const zi = positionen(zw[k], zeilen), si = positionen(sw[k], spalten);
      for (const i of zi) summen.zeilen[i]++;
      for (const j of si) summen.spalten[j]++;
      for (const i of zi) for (const j of si) sammel[i][j].push(a);
    });
    return { zeilen, spalten, zellen: sammel.map(z => z.map(liste => zelleAus(liste, reihenfolge))), summen };
  }

  /** Kopf einer Achsenposition im Namen: `repo:shop`, bei „(ohne …)“ nur dieser Text. */
  function achsenKopf(achsenwert, praefix) {
    if (achsenwert.ohne) return achsenwert.wert;
    return `${praefix}:${achsenwert.wert}`;
  }

  /** Klassen einer Zelle in der Reihenfolge der Dringlichkeit mit Bezeichnung, unbekannte mit Schlüssel, ohne Klasse am Ende. */
  function klassenTeile(jeKlasse, klassen) {
    const bekannt = klassen.filter(k => jeKlasse[k.schluessel]).map(k => `${k.bezeichnung} ${jeKlasse[k.schluessel]}`);
    const unbekannt = Object.keys(jeKlasse).filter(k => k !== '' && !klassen.some(x => x.schluessel === k)).map(k => `${k} ${jeKlasse[k]}`);
    const ohne = Object.keys(jeKlasse).filter(k => k === '').map(k => `ohne Klasse ${jeKlasse[k]}`);
    return [...bekannt, ...unbekannt, ...ohne];
  }

  /** Name einer Summe: Zeile, Spalte oder gesamt (beide null); nie klickbar. */
  function summenName(kopf, zahl) {
    return `Summe ${kopf}: ${zahl} offen · nicht klickbar`;
  }

  /** Tooltip und zugänglicher Name einer Stelle der Tabelle `{zeile, spalte, zelle}`; Zeile oder Spalte null heißt Summe. */
  function zellName(stelle, achsen, klassen) {
    const { zeile, spalte, zelle } = stelle;
    if (!zeile && !spalte) return summenName('gesamt', zelle.zahl);
    if (!spalte) return summenName(achsenKopf(zeile, achsen.zeilen), zelle.zahl);
    if (!zeile) return summenName(achsenKopf(spalte, achsen.spalten), zelle.zahl);
    const kopf = `${achsenKopf(zeile, achsen.zeilen)} × ${achsenKopf(spalte, achsen.spalten)}`;
    if (!zelle.zahl) return `${kopf}: keine offen`;
    let schluss = 'ohne Abschlussspalte, ohne Filter der Berichte';
    if (zielfilter(stelle, achsen) === null) schluss = 'nicht klickbar';
    return `${kopf}: ${zelle.zahl} offen — ${[...klassenTeile(zelle.jeKlasse, klassen), schluss].join(' · ')}`;
  }

  const gleicherPraefix = (a, b) => a.toLowerCase() === b.toLowerCase();

  /** Neue Achsen nach einer Wahl im Feld „zeilen“ oder „spalten“ oder nach „tauschen“: steht der gewählte Präfix
      im anderen Feld, tauschen beide; ändert die Wahl nichts, null (kein PUT). Präfixe ohne Groß/Klein. */
  function achsenNachWahl(einstellung, feld, praefix) {
    const getauscht = { zeilen: einstellung.spalten, spalten: einstellung.zeilen };
    if (feld === 'tauschen') return getauscht;
    const anderes = { zeilen: 'spalten', spalten: 'zeilen' }[feld];
    if (gleicherPraefix(praefix, einstellung[feld])) return null;
    if (gleicherPraefix(praefix, einstellung[anderes])) return getauscht;
    return { ...einstellung, [feld]: praefix };
  }

  /** Ein Wort `label:<präfix>:<wert>` für den Board-Filter, mit Leerzeichen in Anführungszeichen (filterWoerter);
      ein Label mit Leerzeichen und Anführungszeichen lässt sich nicht als Wort schreiben (null). */
  function labelWort(label) {
    if (!/\s/.test(label)) return `label:${label}`;
    if (label.includes('"')) return null;
    return `label:"${label}"`;
  }

  /** Board-Filter einer Zelle: genau ihr Label-Paar, ohne die Filter der Berichte; nur für eine Zelle mit Zahl,
      nicht für „(ohne …)“ und Summen (null). */
  function zielfilter({ zeile, spalte, zelle }, achsen) {
    if (!zeile || !spalte || zeile.ohne || spalte.ohne || !zelle.zahl) return null;
    const woerter = [labelWort(`${achsen.zeilen}:${zeile.wert}`), labelWort(`${achsen.spalten}:${spalte.wert}`)];
    if (woerter.includes(null)) return null;
    return woerter.join(' ');
  }

  /* ── Datums-Trenner in den Spalten (R00124) ── */
  /** Der Ankunftstag einer Aufgabe in einer Spalte: der letzte Wechsel in diese Spalte, sonst der Tag ihres ersten Erscheinens. */
  function ankunftsTag(wechsel, spalte) {
    if (!wechsel || !wechsel.length) return null;
    let letzter = null;
    for (const w of wechsel) if (w.spalte === spalte) letzter = w.zeitpunkt;
    return (letzter || wechsel[0].zeitpunkt).slice(0, 10);
  }

  /** Beschriftung eines Datums-Trenners (R00124): „Heute“, „Gestern“ oder `dd.MM.yyyy` (ADR-0013). „Gestern“ ist der
      Kalendertag vor `heute` — über `tag` gerechnet, nicht über feste 24 Stunden (sonst an den Umstellungstagen ein Tag daneben). */
  function trennerText(datum, heute) {
    if (datum === heute) return 'Heute';
    const gesternTag = new Date(tag(isoTag(heute), -1));
    const gestern = `${gesternTag.getFullYear()}-${String(gesternTag.getMonth() + 1).padStart(2, '0')}-${String(gesternTag.getDate()).padStart(2, '0')}`;
    if (datum === gestern) return 'Gestern';
    return datumLang(datum);
  }

  /** Je sichtbarer Aufgabe der Text des Datums-Trenners **vor** ihr (R00124); `null`, wo keine Tagesgrenze ist.
      `reihe` ist die gezeichnete Reihenfolge der sichtbaren Karten; im Archiv leer. */
  function datumsTrenner(spalte, reihe, bewegungen, heute, archiv) {
    const texte = new Map();
    if (archiv) return texte;
    const je = new Map(((bewegungen && bewegungen.aufgaben) || []).map(a => [a.nummer, a.wechsel]));
    let vorigerTag = null;
    for (const nr of reihe) {
      const tag = ankunftsTag(je.get(nr), spalte);
      if (tag && tag !== vorigerTag) texte.set(nr, trennerText(tag, heute));
      else texte.set(nr, null);
      if (tag) vorigerTag = tag;
    }
    return texte;
  }

  Object.assign(ziel, { bestandAm, erledigtSpalten, fluss, flussRand, flussName, flussMax, durchsatz, durchsatzZiel, durchsatzName, durchsatzTip, durchsatzMarke, durchsatzMarken, xMarken, DURCHSATZ_EINHEITEN, DURCHSATZ_STANDARD, diagrammBloecke, grenzenAb, ersterTag, fieberAusduennen, fieberBloecke, fieberSchluessel, fieberTag, fehlendeTage, dauerIn, pufferVorschlag, fieberZone, fieberPlan, fieberPunkte, tagAnPosition, vollDatum, zaehltImBericht, ausgenommen, phasenRang, phasenStufen, ersterDurchlauf, terminChance, anteilBis, werktageBis, prognose, simuliere, tagesreihen, werktagDatum, PERZENTILE, MIN_LAEUFE, durchlaufzeiten, perzentil, spalteAm, eintrittAm, alterText, datumsTrenner, trennerText, ankunftsTag, burndown, ZEITRAEUME, FILTER_LEER, zeitraumGrenzen, aufgabePasst, zeitenGefiltert, filterAnzahl, leistenAnzahl, filterZuruecksetzen, zuruecksetzenHinweis, BERICHTSLEISTEN, filterAus, isoTag, offeneAufgaben, praefixe, vorschlag, bestandNachLabels, dringendste, zellName, achsenNachWahl, zielfilter });
})(typeof module !== 'undefined' ? module.exports : window);
