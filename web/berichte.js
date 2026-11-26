/* kanbanD — Berichte: Zeitraum, Filter und Rechnungen über Bewegungen; rein, im Browser und in Node nutzbar. */
(function (ziel) {
  const { datumAusMs, datumLang, achsenMarke, seitText } = typeof module !== 'undefined' ? require('./kultur.js') : window;
  const TAG = 864e5;

  /* ── Zeitraum und Filter (R00043) ── */
  const ZEITRAEUME = [['heute', 'heute'], ['gestern', 'gestern'], ['woche', 'diese Woche'], ['vorwoche', 'letzte Woche'], ['monat', 'dieser Monat'], ['vormonat', 'letzter Monat'], ['30', 'letzte 30 Tage'], ['90', 'letzte 90 Tage'], ['jahr', 'dieses Jahr'], ['alles', 'alles'], ['eigen', 'eigener Zeitraum']];
  const FILTER_LEER = { zeitraum: 'alles', von: '', bis: '', ohneFarben: [], ohneSpalten: [], personen: [], labels: [], messbasisTage: 90, kostenVonSpalte: '', kostenBisSpalte: '' };

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
      // der Bis-Tag endet am Beginn des Folgetags, in Kalenderrechnung: am Tag einer Zeitumstellung sind das 23 oder 25 Stunden
      case 'eigen': return { von: f.von ? isoTag(f.von) : 0, bis: f.bis ? tag(isoTag(f.bis), 1) : Infinity };
      default: return { von: 0, bis: Infinity };
    }
  }

  /** Der letzte Tag eines Zeitraums mit der Obergrenze `bis` (Beginn des Folgetags), als Tagesanfang in ms — in
      Kalenderrechnung: „Grenze minus 24 Stunden“ träfe nach einem Tag mit 23 Stunden den Vortag. */
  const letzterTag = bis => tag(bis, -1);

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
    kosten: { spalten: true, personen: 'zustaendig' },
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
  /** Beginn des Archivtags (ms): ab hier gilt `archiviert` — die eine Stelle, die den Archivtag in einen Zeitpunkt übersetzt. */
  const archivBeginn = archiviert => isoTag(archiviert);
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
    if (archiviert && !erledigt && t >= archivBeginn(archiviert)) return { art: 'entfernt', spalte, erledigt: false };
    return { art: 'da', spalte, erledigt };
  }
  /** Was „erledigt“ heißt: heute die Abschlussspalte (die letzte Spalte) des Boards. */
  const erledigtSpalten = bew => bew.spalten.slice(-1);
  /** Die Wechsel einer Aufgabe mit gerechnetem Zeitpunkt — einmal je Aufgabe, nicht je Tag (Lastprofil, ADR-0027). */
  const wechselInMs = wechsel => wechsel.map(w => ({ ms: zeitMs(w.zeitpunkt), spalte: w.spalte }));
  /** Bestand der Aufgaben eines Boards: zu einer Aufgabe (Eintrag aus bew.aufgaben) die Funktion `t → Zustand` (`bestandAm`).
      Der Archivtag kommt aus der Aufgabenliste des Clients (`aufgabeZu`; ohne Datei kein Archivtag), „erledigt“ aus dem Board;
      beides und die Zeitpunkte der Wechsel werden je Aufgabe einmal gelesen. `erledigtBei` (R00166, ADR-0027 N2 Punkt 3) nennt
      je Aufgabe ihre Erledigt-Spalten; ohne es gilt für jede die Abschlussspalte. */
  function bestandLeser(bew, aufgabeZu, erledigtBei = null) {
    const abschluss = erledigtSpalten(bew);
    return a => {
      let erledigt = abschluss;
      if (erledigtBei) erledigt = erledigtBei(a);
      const x = aufgabeZu(a.nummer), archiviert = x && x.archiviert, wechsel = wechselInMs(a.wechsel);
      const zustandAm = t => bestandAm(wechsel, archiviert, t, erledigt);
      zustandAm.folge = () => zustandsfolge(wechsel, archiviert, erledigt);
      return zustandAm;
    };
  }
  /** Erledigt-Spalten je Aufgabe, wenn der Block `schluessel` (eine Spalte, wie in `prognoseStufen`) das Ziel ist: die Spalte
      und alle rechts davon. `null` ohne Block und für einen Block, den das Board nicht hat — dann gilt die Vorgabe von
      `bestandLeser`. */
  function erledigtAb(bew, schluessel) {
    const stufe = prognoseStufen(bew, bew.spalten).find(st => st.schluessel === schluessel);
    if (!stufe) return null;
    return a => bew.spalten.filter(s => stufe.durch(a, s));
  }
  /** Zustandsfolge einer Aufgabe (ADR-0027 N1): je Änderungspunkt — jeder Wechsel und der Beginn des Archivtags — `{ ms, zustand }`
      in zeitlicher Reihenfolge, der Zustand aus `bestandAm`. Wechsel derselben Minute bleiben einzelne Schritte; der Archivtag
      steht vor den Wechseln ab 0 Uhr. `wechsel` trägt `ms` (`wechselInMs`). */
  function zustandsfolge(wechsel, archiviert, erledigt) {
    const nach = w => ({ ms: w.ms, zustand: bestandAm([w], archiviert, w.ms, erledigt) });
    if (!archiviert) return wechsel.map(nach);
    const archivtag = archivBeginn(archiviert), davor = wechsel.filter(w => w.ms < archivtag), danach = wechsel.slice(davor.length);
    const amArchivtag = { ms: archivtag, zustand: bestandAm(davor.slice(-1), archiviert, archivtag, erledigt) };
    return [...davor.map(nach), amArchivtag, ...danach.map(nach)];
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
      ausgenommen sind — eine verworfene Aufgabe steht hier nicht (R00152). Der Burndown reicht seinen `zielblock` durch. */
  function ausgenommen(bew, bericht, f, aufgabeZu, jetzt, zielblock = null) {
    const bestand = bestandLeser(bew, aufgabeZu, erledigtAb(bew, zielblock));
    return bew.aufgaben.filter(a => !zaehltImBericht(a, bericht) && aufgabePasst(f, aufgabeZu(a.nummer)) && imBestand(f, bestand(a)(jetzt))).length;
  }

  /* ── Burndown (R00044) ── */
  /** Offen: im Bestand des Berichts und nicht erledigt. */
  const istOffen = (f, zustand) => imBestand(f, zustand) && !zustand.erledigt;

  /** Je Tag im Zeitraum: offen und Umfang (im Bestand) als Stand am Tagesende, heute jetzt; ab `start`. Dazu die Ereignisse
      des Tages (R00164): `hinzugekommen`, `erledigt`, `entfernt` — an jedem Tag gilt
      offen = offen(Vortag) + hinzugekommen − erledigt − entfernt. `zielblock` (R00166): der Block, ab dem „erledigt“ gilt —
      ohne ihn die Abschlussspalte. `selbstlabels` (R00194): die Labels, die „selbsterzeugt“ heißen — je Tag zählt
      `selbsterzeugt`, wie viele „+“ eine Aufgabe mit einem davon nach ihrem heutigen Stand ist, ohne die Rückläufer. */
  function burndown(bew, f, aufgabeListe, jetzt, start = null, zielblock = null, selbstlabels = []) {
    const g = grenzenAb(f, jetzt, start), aufgabeZu = einmalJeAufgabe(aufgabeListe), bestand = bestandLeser(bew, aufgabeZu, erledigtAb(bew, zielblock));
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return [];
    const aufgaben = bew.aufgaben.filter(a => zaehltImBericht(a, 'burndown') && aufgabePasst(f, aufgabeZu(a.nummer)));
    const gezaehlt = aufgaben.map(bestand);
    const selbsterzeugt = aufgaben.map(a => traegtLabel(aufgabeZu(a.nummer), selbstlabels));
    const ereignisse = ereignisseJeTag(f, gezaehlt, jetzt, i => selbsterzeugt[i]);
    const tage = [];
    for (let t = Math.max(tag(erste), tag(g.von)); t < Math.min(g.bis, tag(jetzt, 1)); t = tag(t, 1)) {
      const ende = Math.min(tag(t, 1) - 1, jetzt);
      let offen = 0, umfang = 0;
      for (const zustandAm of gezaehlt) {
        const zustand = zustandAm(ende);
        if (!imBestand(f, zustand)) continue;
        umfang++;
        if (istOffen(f, zustand)) offen++;
      }
      const d = new Date(t), p = n => String(n).padStart(2, '0');
      tage.push({ datum: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, offen, umfang, ...KEIN_EREIGNIS, ...ereignisse.get(t) });
    }
    return tage;
  }

  /** Band unter den Linien des Burndowns (R00164 AK 7), in Einheiten der Zeichenfläche: Nulllinie, nutzbare Höhe je Richtung. */
  const BURNDOWN_BAND = Object.freeze({ null: 280, hoehe: 30, mindestHoehe: 2, stapelAbstand: 1, schraffurAb: 6 });
  /** Balken je Tag: „+ hinzugekommen“ von der Nulllinie nach oben, „− erledigt“ nach unten, „− entfernt“ darunter gestapelt.
      `skala` = max(1, größtes „+“, größter Abgang eines Tages), 1 Aufgabe = Höhe ÷ Skala; je Größe `{ y, hoehe }`, Höhe 0 = kein
      Rechteck. Breite aus dem Abstand zweier Tage; unter `schraffurAb` trägt „entfernt“ nur die Kontur. */
  function burndownBalken(tage, tagesabstand) {
    const { null: nulllinie, hoehe: bandHoehe, mindestHoehe, stapelAbstand, schraffurAb } = BURNDOWN_BAND;
    const skala = Math.max(1, ...tage.map(x => Math.max(x.hinzugekommen, x.erledigt + x.entfernt)));
    const hoeheVon = anzahl => anzahl > 0 ? Math.max(mindestHoehe, anzahl * bandHoehe / skala) : 0;
    const breite = Math.max(2, Math.min(24, 0.62 * tagesabstand));
    const jeTag = tage.map(x => {
      const plus = hoeheVon(x.hinzugekommen), erledigt = hoeheVon(x.erledigt), entfernt = hoeheVon(x.entfernt);
      const gestapelt = erledigt > 0 && entfernt > 0;
      return {
        hinzugekommen: { y: nulllinie - plus, hoehe: plus },
        erledigt: { y: nulllinie, hoehe: erledigt },
        entfernt: { y: gestapelt ? nulllinie + erledigt + stapelAbstand : nulllinie, hoehe: entfernt },
      };
    });
    return { skala, breite, schraffiert: breite >= schraffurAb, tage: jeTag };
  }

  /** Ein Tag ohne Ereignis. `zurueckgekommen` (R00192) und `selbsterzeugt` (R00194) sind keine weiteren Posten, sondern
      disjunkte Teilmengen von `hinzugekommen` — die Bilanz rechnet ohne sie; der Rest von „+“ ist Neues. */
  const KEIN_EREIGNIS = Object.freeze({ hinzugekommen: 0, erledigt: 0, entfernt: 0, zurueckgekommen: 0, selbsterzeugt: 0 });
  /** Ereignisse bis `jetzt` je Tagesbeginn (ms): die Wechsel von „offen“ entlang der Zustandsfolge jeder gezählten Aufgabe;
      dazu je „+“ seine Herkunft — ein Rückläufer ist `zurueckgekommen` (R00192), sonst ist es `selbsterzeugt` (R00194), wenn
      `istSelbsterzeugt(i)` die i-te gezählte Aufgabe so nennt. */
  function ereignisseJeTag(f, gezaehlt, jetzt, istSelbsterzeugt = () => false) {
    const jeTag = new Map();
    for (const [i, zustandAm] of gezaehlt.entries()) {
      const selbst = istSelbsterzeugt(i);
      let vorher = NICHT_DA;
      for (const { ms, zustand } of zustandAm.folge()) {
        if (ms > jetzt) break;
        const art = ereignisArt(f, vorher, zustand), zurueck = art === 'hinzugekommen' && istRuecklaeufer(f, vorher);
        vorher = zustand;
        if (art == null) continue;
        const t = tag(ms);
        if (!jeTag.has(t)) jeTag.set(t, { ...KEIN_EREIGNIS });
        const tagEreignisse = jeTag.get(t);
        tagEreignisse[art]++;
        if (zurueck) tagEreignisse.zurueckgekommen++;
        else if (art === 'hinzugekommen' && selbst) tagEreignisse.selbsterzeugt++;
      }
    }
    return jeTag;
  }
  /** Einordnung eines Übergangs (ADR-0027 N1 Punkt 2): nicht offen → offen ist `hinzugekommen`; offen → da und erledigt ist
      `erledigt`; offen → alles andere (verworfen, nicht da, ausgeschlossene Spalte) ist `entfernt`; sonst kein Ereignis (`null`). */
  function ereignisArt(f, vorher, nachher) {
    const warOffen = istOffen(f, vorher);
    if (warOffen === istOffen(f, nachher)) return null;
    if (!warOffen) return 'hinzugekommen';
    if (nachher.art === 'da' && nachher.erledigt) return 'erledigt';
    return 'entfernt';
  }
  /** Ist ein „+“ ein Rückläufer (R00192 AK 1)? Ja, wenn die Aufgabe unmittelbar davor erledigt im Bestand war — mit Zielblock
      (R00166) in einer seiner Erledigt-Spalten. Neu angelegt, vom Board genommen und zurück, aus einer ausgeschlossenen Spalte
      eingetreten: nein. */
  const istRuecklaeufer = (f, vorher) => imBestand(f, vorher) && vorher.erledigt;
  /** Trägt die Aufgabe (heutiger Stand, R00081) eines der Labels? Eine Aufgabe ohne Datei trägt keines. */
  const traegtLabel = (a, labels) => !!a && labels.length > 0 && a.labels.some(l => labels.includes(l));

  /* ── Kumulativer Fluss (R00121) ── */
  /** Je Tag im Zeitraum die gestapelten Bänder je Spalte (Stand am Tagesende, heute jetzt; ab `start`)
      mit `gesamt` (Summe der Bänder) und `offen` (im Bestand und nicht erledigt).
      Zählt wie der Burndown: Bänder, `gesamt` und `offen` aus dem Bestand (`bestandAm`), `angekommen` und `fertig` aus dem
      ersten Erreichen (sinken nicht); `reporting.burndown` und der Berichtsfilter schränken ein, ausgeschlossene
      Spalten tragen kein Band. Die Bänder stehen in Board-Reihenfolge; `spalten` sind die Board-Spalten.
      `zielblock` (R00169, ADR-0027 N5 Punkt 2): der Block, ab dem „erledigt“ gilt, wie im Burndown — `offen` zählt bis dorthin,
      `fertig` das erste Erreichen einer seiner Erledigt-Spalten; ohne ihn die Abschlussspalte. `angekommen` liest ihn nicht;
      Bänder und `gesamt` nur in einem Fall: eine im Zielblock archivierte Aufgabe gilt als erledigt statt verworfen und
      bleibt im Bestand — wie im Umfang des Burndowns (R00169 AK 2 vor AK 4). */
  function fluss(bew, f, aufgabeListe, jetzt, start = null, zielblock = null) {
    const spalten = bew.spalten, aufgabeZu = einmalJeAufgabe(aufgabeListe);
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return { spalten, tage: [] };
    const g = grenzenAb(f, jetzt, start), abschluss = erledigtSpalten(bew);
    let erledigtBei = erledigtAb(bew, zielblock);
    if (!erledigtBei) erledigtBei = () => abschluss;
    const bestand = bestandLeser(bew, aufgabeZu, erledigtBei);
    // je Aufgabe einmal: der Bestand über die Zeit, die Ankunft und das Erreichen einer Erledigt-Spalte — nicht je Tag neu.
    const erstesMal = (a, trifft) => { const w = a.wechsel.find(trifft); return w ? zeitMs(w.zeitpunkt) : Infinity; };
    const fertigAb = a => { const erledigt = erledigtBei(a); return erstesMal(a, w => erledigt.includes(w.spalte)); };
    const beitraege = bew.aufgaben
      .filter(a => zaehltImBericht(a, 'burndown') && aufgabePasst(f, aufgabeZu(a.nummer)))
      .map(a => ({ zustandAm: bestand(a), ankunft: erstesMal(a, w => w.spalte != null), fertig: fertigAb(a) }));
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

  /** Ziel des Durchsatzes: die Abschlussspalte (Index und Name). `zielblock` (R00166, ADR-0027 N2 Punkt 6) wählt stattdessen
      diese Spalte; gibt es sie nicht, gilt die Vorgabe. */
  function durchsatzZiel(bew, zielblock = null) {
    const gewaehlt = bew.spalten.indexOf(zielblock);
    let i = bew.spalten.length - 1;
    if (gewaehlt >= 0) i = gewaehlt;
    return { name: bew.spalten[i], i };
  }

  /** Ankunft einer Aufgabe im Ziel: erstes Erreichen der Zielspalte. */
  const ankunftIm = (a, bew, ziel) => erreicht(a.wechsel, bew.spalten, ziel.i);

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
  /** Indizes der x-Marken von Burndown, Kumulativem Fluss und Durchsatz: höchstens acht (Schritt ceil((n−1)/7)),
      die erste und die letzte Stelle sind immer dabei (R00121 schmales Layout, R00122 M8/S2). */
  function xMarken(anzahl) {
    if (anzahl <= 1) return anzahl === 1 ? [0] : [];
    const schritt = Math.max(1, Math.ceil((anzahl - 1) / 7));
    return [...Array(anzahl).keys()].filter(i => i % schritt === 0 || i === anzahl - 1);
  }

  /** Kalendertage zwischen zwei Tagesgrenzen — Datumsteile zählen, nicht 24-Stunden-Blöcke (R00254: Zeitumstellung). */
  const kalendertage = (von, bis) => {
    const a = new Date(von), b = new Date(bis);
    return Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / TAG);
  };

  /** Maße des Balkenpaars „Zugang · Abgang“ einer Periode (R00167, Zeichnung D0006 #durchsatz-von): das Paar nimmt 72 % des
      Platzes, mindestens 4 und höchstens 96; unter 10 hat es keine Lücke; unter 10 Einheiten Balkenbreite ist der hohle
      Zugangsbalken nicht mehr lesbar und wird voll gefüllt. */
  function durchsatzPaar(breite, perioden) {
    const paar = Math.max(4, Math.min(96, breite / perioden * 0.72));
    let luecke = 0;
    if (paar >= 10) luecke = 2;
    const balkenbreite = (paar - luecke) / 2;
    return { paar, luecke, breite: balkenbreite, zugangVoll: balkenbreite < 10 };
  }

  /** Durchsatz je Kalenderperiode (R00122): je Aufgabe das erste Erreichen des Ziels (Abschlussspalte, mit `zielblock`
      der gewählte Block oder rechts davon, R00166) zählen. `einheit` ist 'tag' | 'woche' | 'monat' (Standard Woche); Perioden sind Kalenderfenster über
      [von, bis) des Filters — „Rechnen ab“ schneidet den Anfang, die Messbasis wirkt nicht, die angebrochene letzte
      Periode zählt bis heute. `reporting.forecast: false` nimmt aus (zählt in `ausgenommen`); ist das Ziel ganz
      ausgeschlossen, gibt es keine Aussage (`zielAusgeschlossen`, keine Perioden). Ø = Gesamt ÷ dargestellte Perioden.
      `anzahl`, `gesamt`, `durchschnitt` und `ausgenommen` sind der Abgang. Daneben der Zugang (R00167, ADR-0027 N3 Punkt 5) in
      `zugang` je Periode, `zugangGesamt` und `zugangDurchschnitt`: je Aufgabe einmal, in der Periode, in der sie den Von-Block
      `vonspalte` (Vorgabe: die erste Spalte) oder eine Spalte rechts davon erstmals erreicht — Rückläufer zählen nicht erneut;
      Zeitfenster, Filter und `reporting.forecast` wirken auf beide gleich. Seit R00254 dazu: `tage` (Kalendertage des
      dargestellten Zeitraums), `netto` je Periode (Abgang − Zugang), `nettoGesamt` und die Ø je Kalendertag
      `zugangJeTag`, `abgangJeTag`, `nettoJeTag`; `durchschnitt` und `zugangDurchschnitt` bleiben je Periode (Ø-Linien). */
  function durchsatz(bew, f, aufgabeZu, jetzt, start = null, einheit = DURCHSATZ_STANDARD, zielblock = null, vonspalte = null) {
    const ziel = durchsatzZiel(bew, zielblock);
    const leer = { einheit, perioden: [], gesamt: 0, durchschnitt: null, zugangGesamt: 0, zugangDurchschnitt: null, tage: 0, nettoGesamt: 0, zugangJeTag: null, abgangJeTag: null, nettoJeTag: null, ausgenommen: 0, zielAusgeschlossen: false, ziel };
    if (!bew.spalten.length) return leer;
    if (f.ohneSpalten.includes(ziel.name)) return { ...leer, zielAusgeschlossen: true };
    const erste = Math.min(...bew.aufgaben.map(a => a.wechsel.length ? zeitMs(a.wechsel[0].zeitpunkt) : Infinity));
    if (erste === Infinity) return leer;
    const g = grenzenAb(f, jetzt, start);
    const von = Math.max(tag(erste), g.von), bis = Math.min(g.bis, tag(jetzt, 1));
    if (!(bis > von)) return leer;
    const perioden = [];
    for (let p = periodeStart(von, einheit); p < bis; p = periodeEnde(p, einheit)) perioden.push({ von: p, bis: periodeEnde(p, einheit), anzahl: 0, zugang: 0 });
    /** Die Periode eines Zeitpunkts im Zeitfenster; null = nie erreicht oder außerhalb. */
    const periodeZu = t => t == null || t < von || t >= bis ? null : perioden.find(x => t >= x.von && t < x.bis) || null;
    const zugangAb = vonblock(bew, f, vonspalte).ab;
    let gesamt = 0, zugangGesamt = 0, ausgenommen = 0;
    for (const a of bew.aufgaben) {
      const abgang = periodeZu(ankunftIm(a, bew, ziel)), zugang = periodeZu(erreicht(a.wechsel, bew.spalten, zugangAb));
      if (!abgang && !zugang) continue;
      if (!aufgabePasst(f, aufgabeZu(a.nummer))) continue;
      if (!zaehltImBericht(a, 'forecast')) { if (abgang) ausgenommen++; continue; }
      if (abgang) { abgang.anzahl++; gesamt++; }
      if (zugang) { zugang.zugang++; zugangGesamt++; }
    }
    const je = summe => perioden.length ? summe / perioden.length : null;
    perioden.forEach(p => { p.netto = p.anzahl - p.zugang; });
    const tage = kalendertage(von, bis), nettoGesamt = gesamt - zugangGesamt, jeTag = summe => tage ? summe / tage : null;
    return { einheit, perioden, gesamt, durchschnitt: je(gesamt), zugangGesamt, zugangDurchschnitt: je(zugangGesamt), tage, nettoGesamt, zugangJeTag: jeTag(zugangGesamt), abgangJeTag: jeTag(gesamt), nettoJeTag: jeTag(nettoGesamt), ausgenommen, zielAusgeschlossen: false, ziel };
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

  /** Vorgabe von „von“ und „bis“ der Durchlaufzeit (R00169, ADR-0027 N5 Punkte 3, 4): von der ersten Spalte bis zur Spalte
      des Zielblocks `zielSchluessel` (`gewaehlt` aus `zielblock`). Ohne Zielblock bis zur letzten Spalte. */
  function durchlaufVorgabe(bew, zielSchluessel) {
    const von = bew.spalten[0], letzte = bew.spalten[bew.spalten.length - 1], erledigtBei = erledigtAb(bew, zielSchluessel);
    if (!erledigtBei) return { von, bis: letzte };
    const ersteErledigt = erledigtBei({ labels: [] })[0];
    return { von, bis: ersteErledigt || letzte };
  }

  /** „von“ und „bis“ der Durchlaufzeit: die Vorgabe des Boards, je Feld ersetzt durch die am Gerät gemerkte Wahl `gemerkt`
      (`{ von, bis }`, beide optional), wo sie eine Spalte des Boards nennt. `weichtAb` sagt, ob etwas davon nicht die Vorgabe
      ist — nur dann zeigt der Bericht den Weg zurück. */
  function durchlaufWahl(bew, zielSchluessel, gemerkt) {
    const vorgabe = durchlaufVorgabe(bew, zielSchluessel);
    let von = vorgabe.von, bis = vorgabe.bis;
    if (gemerkt && bew.spalten.includes(gemerkt.von)) von = gemerkt.von;
    if (gemerkt && bew.spalten.includes(gemerkt.bis)) bis = gemerkt.bis;
    const vonWeichtAb = von !== vorgabe.von, bisWeichtAb = bis !== vorgabe.bis;
    return { von, bis, vorgabe, vonWeichtAb, bisWeichtAb, weichtAb: vonWeichtAb || bisWeichtAb };
  }
  /** Was von einer Wahl am Gerät zu merken ist: nur die Felder, die von der Vorgabe abweichen — leer heißt „folgt dem Board“. */
  function durchlaufMerken(vorgabe, von, bis) {
    const gemerkt = {};
    if (von !== vorgabe.von) gemerkt.von = von;
    if (bis !== vorgabe.bis) gemerkt.bis = bis;
    return gemerkt;
  }

  /** Erstes Erreichen eines Blocks in ms; null = nie. */
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

  const SAAT = 20260906, SAAT_ZUGANG = 20261117, SAAT_WEITER = 20261118, MAX_TAGE_ZUGANG = 365;
  const ausReihe = (reihe, z) => reihe[Math.floor(z() * reihe.length)];

  /** Tage bis `rest` erreicht ist, je Ziehung mit Zurücklegen aus der Tagesreihe; aufsteigend sortiert. */
  function ziehen(reihe, rest, ziehungen = ZIEHUNGEN) {
    if (!reihe.some(x => x > 0)) return null;
    const z = zufall(SAAT), erg = [];
    for (let i = 0; i < ziehungen; i++) {
      let tage = 0, fertig = 0;
      while (fertig < rest && tage < MAX_TAGE) { fertig += ausReihe(reihe, z); tage++; }
      erg.push(tage);
    }
    return erg.sort((x, y) => x - y);
  }
  /** Wie `ziehen`, aber je Tag kommt der Zugang hinzu (R00193): Stand = Stand + Zugang − Abgang, nie unter 0, fertig bei 0.
      Je Ziehung dieselben Abgänge wie in `ziehen` (gleicher Strom, gleicher Verbrauch); reichen sie nicht, zieht ein eigener
      Strom weiter, der Zugang kommt aus einem dritten. Daher nie früher als `ziehen`. Kein Ende innerhalb von
      `MAX_TAGE_ZUGANG` Tagen = Infinity; aufsteigend sortiert. */
  function ziehenMitZugang(reihe, zugang, rest, ziehungen = ZIEHUNGEN) {
    if (!reihe.some(x => x > 0)) return null;
    const z = zufall(SAAT), weiter = zufall(SAAT_WEITER), zu = zufall(SAAT_ZUGANG), erg = [];
    const hoechsterAbgang = Math.max(...reihe), abgaenge = new Float64Array(MAX_TAGE_ZUGANG);
    for (let i = 0; i < ziehungen; i++) {
      let tage = 0, fertig = 0;
      while (fertig < rest && tage < MAX_TAGE) {
        const abgang = ausReihe(reihe, z);
        if (tage < MAX_TAGE_ZUGANG) abgaenge[tage] = abgang;
        fertig += abgang; tage++;
      }
      const gezogen = Math.min(tage, MAX_TAGE_ZUGANG);
      let stand = rest, tageMitZugang = 0;
      // endet sicher nicht mehr, wenn der höchste Tagesabgang den Stand in den übrigen Tagen nicht abtragen kann
      while (stand > 0 && stand <= hoechsterAbgang * (MAX_TAGE_ZUGANG - tageMitZugang)) {
        const abgang = tageMitZugang < gezogen ? abgaenge[tageMitZugang] : ausReihe(reihe, weiter);
        stand += ausReihe(zugang, zu) - abgang;
        if (stand < 0) stand = 0;
        tageMitZugang++;
      }
      erg.push(stand > 0 ? Infinity : tageMitZugang);
    }
    return erg.sort((x, y) => x - y);
  }
  const perzentileAus = erg => Object.fromEntries(PERZENTILE.map(p => [p, erg[Math.ceil(p / 100 * erg.length) - 1]]));
  /** Perzentile über die Ziehungen. */
  function simuliere(reihe, rest, ziehungen = ZIEHUNGEN) {
    const erg = ziehen(reihe, rest, ziehungen);
    return erg && perzentileAus(erg);
  }
  /** Perzentile mit Zugang (R00193); `null` im Perzentil = kein Ende innerhalb von 365 Tagen. */
  function simuliereMitZugang(reihe, zugang, rest, ziehungen = ZIEHUNGEN) {
    const erg = ziehenMitZugang(reihe, zugang, rest, ziehungen);
    return erg && Object.fromEntries(Object.entries(perzentileAus(erg)).map(([p, tage]) => [p, endlichOderNull(tage)]));
  }
  const endlichOderNull = tage => isFinite(tage) ? tage : null;
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
    return { reihe7, reihe5: arbeitstagReihe(reihe7, von) };
  }
  /** Die Kalendertagsreihe ab `von` je Werktag: das Wochenende zählt zum nächsten Werktag. */
  function arbeitstagReihe(reihe7, von) {
    const reihe5 = [];
    let uebertrag = 0;
    reihe7.forEach((n, i) => { if (werktag(tag(von, i))) { reihe5.push(n + uebertrag); uebertrag = 0; } else uebertrag += n; });
    if (uebertrag) { if (reihe5.length) reihe5[reihe5.length - 1] += uebertrag; else reihe5.push(uebertrag); }
    return reihe5;
  }

  /** Was die Prognose je Block zählt: je Spalte (außer der ersten gezählten) „erreicht = dort oder rechts davon“. */
  function prognoseStufen(bew, spalten) {
    const idx = s => bew.spalten.indexOf(s);
    return spalten.slice(1).map(spalte => ({ spalte, schluessel: spalte, titel: `Spalte „${spalte}“`, durch: (a, s) => s != null && idx(s) >= idx(spalte), entfaellt: () => false }));
  }

  /** Je Block: Nenner, erreicht, offen, Tagesreihe, Perzentile; dazu der Verlauf je Tag. Offen zählt nach dem aktuellen Stand,
      der Durchsatz nach dem ersten Erreichen, je Spalte wie in R00046.
      Messbasis (R00083): die letzten `f.messbasisTage` Tage bis `jetzt`, gleitend — frühestens ab `start` („Rechnen ab“)
      und frühestens am Tag der ersten Aufgabe auf dem Board; der Kalenderzeitraum des Filters wirkt hier nicht.
      Der Verlauf beginnt mit der ersten Aufgabe, frühestens bei `start`.
      `nurLetzter` rechnet nur den letzten Block und keinen Verlauf — für das Fever Chart, das jeden Tag einzeln rechnet;
      `block` (R00079) statt des letzten nur den Block mit diesem Schlüssel (gibt es ihn nicht, den letzten).
      `zugang` (R00168): je Block mit Prognose die Aufgaben, die in der Messbasis offen wurden, abzüglich der entfernten —
      sonst und mit `nurLetzter` null. */
  function prognose(bew, f, aufgabeZu, jetzt, optionen = {}) {
    // Gemerkt nach Inhalt — Bewegungen, was der Filter an den Aufgaben liest, Filter, Optionen, Tag: Neuzeichnen ohne neue
    // Daten rechnet nicht neu; die Monte-Carlo-Ziehungen kosten auf großen Boards Sekunden. Nach Inhalt, nicht nach Objekt,
    // weil jedes Live-Ereignis die Bewegungen neu lädt, auch wenn sich nichts geändert hat.
    const merkmale = bew.aufgaben.map(a => { const x = aufgabeZu(a.nummer); return x ? [x.klasse, x.zustaendige, x.labels, x.archiviert] : null; });
    const schluessel = JSON.stringify([bew.spalten, bew.aufgaben, merkmale, f, optionen.start || null, !!optionen.nurLetzter, optionen.block || null, tag(jetzt)]);
    if (!gemerkt.has(schluessel)) {
      gemerkt.set(schluessel, prognoseRechnen(bew, f, aufgabeZu, jetzt, optionen));
      if (gemerkt.size > 64) gemerkt.delete(gemerkt.keys().next().value);
    }
    return gemerkt.get(schluessel);
  }
  const gemerkt = new Map();
  function prognoseRechnen(bew, f, aufgabeListe, jetzt, { start = null, nurLetzter = false, block = null } = {}) {
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
    /** Zugang eines Blocks in der Messbasis (R00168, ADR-0027 N4): „hinzugekommen“ minus „entfernt“ mit dem Block als Ziel,
        über die Tage ab `fenster`, nie unter 0; dazu dieselbe Differenz je Tag, je Tag nie unter 0 (R00193), als Reihe je
        Kalender- und Arbeitstag über dieselben Tage wie die Abgangsreihe. */
    const zugangZu = st => {
      const zumBlock = bestandLeser(bew, aufgabeZu, a => bew.spalten.filter(s => st.durch(a, s)));
      const ereignisse = ereignisseJeTag(f, gezaehlt.filter(x => !st.entfaellt(x.a)).map(x => zumBlock(x.a)), jetzt);
      let summe = 0;
      for (const [t, e] of ereignisse) if (t >= fenster) summe += e.hinzugekommen - e.entfernt;
      const reihe7 = [];
      for (let t = fenster; t < morgen; t = tag(t, 1)) {
        const e = ereignisse.get(t) || KEIN_EREIGNIS;
        reihe7.push(Math.max(0, e.hinzugekommen - e.entfernt));
      }
      return { summe: Math.max(0, summe), reihe7, reihe5: arbeitstagReihe(reihe7, fenster) };
    };
    /** Die Zeilen der zweiten Tabelle (R00193); Tage und Datum `null` = kein Ende innerhalb von 365 Tagen. */
    const zeilenMitZugang = (ph, zugang) => {
      const p7 = perzentileAus(ziehenMitZugang(ph.reihe7, zugang.reihe7, ph.offen)), p5 = perzentileAus(ziehenMitZugang(ph.reihe5, zugang.reihe5, ph.offen));
      return PERZENTILE.map(p => {
        const kalendertage = endlichOderNull(p7[p]), arbeitstage = endlichOderNull(p5[p]);
        return { p, kalendertage, datum7: kalendertage === null ? null : tag(heute, kalendertage), arbeitstage, datum5: arbeitstage === null ? null : werktagDatum(heute, arbeitstage) };
      });
    };
    let vorige = null;
    const alle = prognoseStufen(bew, spalten), gewaehlt = alle.filter(st => st.schluessel === block);
    const stufen = gewaehlt.length ? gewaehlt : nurLetzter ? alle.slice(-1) : alle;
    const bloecke = stufen.map(st => {
      const dabei = jetztDa.filter(x => !st.entfaellt(x.a));
      const offen = dabei.filter(x => !st.durch(x.a, x.s)).length;
      const daten = dabei.map(x => ersterDurchlauf(x.a, st)).filter(d => d != null && d >= fenster && d <= jetzt);
      const ph = { schluessel: st.schluessel, titel: st.titel, spalte: st.spalte, nenner: dabei.length, erreicht: dabei.length - offen, offen, laeufe: daten.length, zeilen: null, reihe7: [], reihe5: [], durchsatz: null, zugang: null, mitZugang: null };
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
      // der Zugang gehört zum Bericht, nicht zur Rechnung: das Fever Chart (`nurLetzter`, je Tag ein Aufruf) braucht ihn nicht
      if (ph.zeilen && !nurLetzter) {
        const zugang = zugangZu(st);
        ph.zugang = zugang.summe;
        if (zugang.summe > 0) Object.assign(ph, { mitZugang: zeilenMitZugang(ph, zugang), zugangReihe7: zugang.reihe7, zugangReihe5: zugang.reihe5 });
      }
      // nie früher als der Block davor (Spalte links): dessen Datum als Untergrenze nennen, nicht verrechnen
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
    return { umfang, heute, bloecke, tage, verworfen, ausgenommen: weg, gezaehlt: jetztDa.map(x => x.a.nummer) };
  }

  /** Zugang gegen Abgang eines Blocks mit Prognose (R00168): beide Mittel je Kalendertag der Messbasis — der Abgang ist der
      Durchsatz — und ob der Zugang die Läufe erreicht. Verglichen werden die Summen, nicht die gerundeten Mittel.
      `null` ohne Prognose. */
  function zugangGegenAbgang(block) {
    if (!block.zeilen || block.zugang == null) return null;
    return { zugangJeTag: block.zugang / block.reihe7.length, abgangJeTag: block.durchsatz, keinEndeAbsehbar: block.zugang >= block.laeufe };
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
  const fieberBloecke = (bew, f) => prognoseStufen(bew, bew.spalten.filter(s => !f.ohneSpalten.includes(s))).map(st => ({ schluessel: st.schluessel, titel: st.titel }));
  /** Der Block, der auf dem Board als erledigt zählt (R00166, ADR-0027 N2 Punkt 2) — die eine Auflösung der gespeicherten
      Zielspalte für Fever Chart, Burndown, Durchsatz, Kumulativen Fluss und die Vorgabe „bis“ der Durchlaufzeit: `block` ist
      der gespeicherte Block unter dem Filter (sonst null), `zaehlt` er oder der letzte Block, `verschwunden` der Name einer
      Wahl, die es nicht mehr gibt. `gewaehlt` ist der Schlüssel nur dann, wenn der zählende Block von der Abschlussspalte
      abweicht — dem Ziel, bis zu dem die Berichte ohne Zielblock rechnen; nur dann gibt es `worte` (`zielWorte`), sonst
      bleiben die Texte der Berichte wie ohne Wahl. Eine Wahl, die keine Spalte nennt, gilt als Vorgabe (ADR-0034 N4).
      Schließt der Berichtsfilter die Abschlussspalte aus (R00169, ADR-0027 N5 Punkt 5), zählt
      ohne Wahl der letzte sichtbare Block, als wäre er gewählt: `gewaehlt`, `standard` und `worte` nennen ihn, und
      `ausgeschlossen` nennt die Abschlussspalte — nur, wenn nichts gespeichert ist. `block` bleibt die gespeicherte Wahl. */
  function zielblock(bew, f, zielspalte) {
    const bloecke = fieberBloecke(bew, f), abschluss = durchsatzZiel(bew).name;
    const block = bloecke.find(x => x.schluessel === zielspalte) || null, letzter = bloecke[bloecke.length - 1] || null;
    const zaehlt = block || letzter, abschlussFehlt = letzter !== null && f.ohneSpalten.includes(abschluss);
    let verschwunden = null, gewaehlt = null, worte = null, standard = abschluss, ausgeschlossen = null;
    if (zielspalte && !block) verschwunden = zielspalte;
    if (abschlussFehlt) standard = letzter.schluessel;
    if (abschlussFehlt && !zielspalte) ausgeschlossen = abschluss;
    if (zaehlt && zaehlt.schluessel !== abschluss) { gewaehlt = zaehlt.schluessel; worte = zielWorte(gewaehlt); }
    return { bloecke, block, zaehlt, verschwunden, gewaehlt, standard, worte, ausgeschlossen };
  }
  /** Wie Burndown und Durchsatz einen gewählten Zielblock nennen (Zeichnung D0006 #erledigt-heisst): `lang` im Kopftext und im
      Satz unter der Legende des Burndowns, `kurz` hinter „− erledigt“, `bis` im Durchsatz. */
  function zielWorte(name) {
    const genannt = `„${name}“`, bis = `bis ${genannt}`;
    return { lang: `in ${genannt} oder rechts davon`, kurz: `ab ${genannt}`, bis };
  }
  /** Der Block, ab dem der Durchsatz den Zugang zählt (R00167, ADR-0027 N3 Punkt 4) — die eine Auflösung der gespeicherten
      Von-Spalte, getrennt von `zielblock`: nur der Durchsatz ruft sie. `eintraege` sind die der Auswahl „Zugang ab“: die erste
      Spalte unter dem Filter mit leerem Wert (die Vorgabe), dann die Blöcke von „Erledigt heißt“. `ab` ist der Index der Spalte,
      deren erstes Erreichen zählt, `name` ihr Name. `gewaehlt` ist der Schlüssel nur bei einer Wahl, die von der Vorgabe
      abweicht; `verschwunden` der Name einer Wahl, die es nicht mehr gibt — dann zählt die Vorgabe. `gueltig` ist falsch, wenn
      die Wahl nicht links vom Block `zielSchluessel` liegt. */
  function vonblock(bew, f, vonspalte, zielSchluessel = null) {
    const zielbloecke = fieberBloecke(bew, f);
    const erste = ersterVonBlock(bew, f);
    const bloecke = zielbloecke.map((b, stelle) => vonBlockAus(bew, b, stelle)).filter(b => b.ab >= 0);
    const block = bloecke.find(b => b.schluessel === vonspalte) || null;
    let verschwunden = null, zaehlt = erste, gueltig = true;
    if (vonspalte && !block && vonspalte !== erste.name) verschwunden = vonspalte;
    if (block) {
      const zielStelle = zielbloecke.findIndex(b => b.schluessel === zielSchluessel);
      zaehlt = block;
      gueltig = block.stelle < zielStelle;
    }
    return {
      eintraege: [erste, ...bloecke].map(b => ({ wert: b.schluessel, titel: b.titel })),
      gewaehlt: block && block.schluessel, name: zaehlt.name, ab: zaehlt.ab, verschwunden, gueltig, worte: vonWorte(zaehlt, block !== null),
    };
  }
  /** Die Vorgabe von „Zugang ab“: die erste Spalte des Boards unter dem Berichtsfilter. */
  function ersterVonBlock(bew, f) {
    let ab = bew.spalten.findIndex(s => !f.ohneSpalten.includes(s));
    if (ab < 0) ab = 0;
    const name = bew.spalten[ab] || '';
    return { schluessel: '', name, titel: `Spalte „${name}“`, ab, stelle: -1 };
  }
  /** Ein Block von „Erledigt heißt“ als Von-Block: eine Spalte zählt ab sich selbst. */
  function vonBlockAus(bew, block, stelle) {
    const name = block.schluessel;
    return { schluessel: name, name, titel: block.titel, ab: bew.spalten.indexOf(name), stelle };
  }
  /** Wie der Durchsatz den Von-Block nennt (Zeichnung D0006 #durchsatz-von): `ab` als Zusatz in Kopftext, Kennzahl und Tooltip
      nur bei einer Wahl, `genannt` in Legende und dem Satz darunter immer. */
  function vonWorte(block, gewaehlt) {
    const name = `„${block.name}“`;
    const ab = gewaehlt ? `ab ${name}` : '';
    return { ab, genannt: name };
  }
  /** Schlüssel des Caches: Projektstart, Berichtsfilter (Listen sortiert, damit dieselbe Auswahl denselben Schlüssel gibt)
      und eine gewählte Zielspalte — ohne sie gilt der Schlüssel aus R00078 weiter. */
  function fieberSchluessel(start, f, ziel = null) {
    const filter = {};
    // der Kalenderzeitraum wirkt seit R00083 nicht mehr auf die Prognose, der Spaltenabschnitt der Kosten (R00171) nie —
    // also beide auch nicht auf den Schlüssel
    for (const k of Object.keys(FILTER_LEER)) if (!['zeitraum', 'von', 'bis', 'kostenVonSpalte', 'kostenBisSpalte'].includes(k)) filter[k] = Array.isArray(f[k]) ? [...f[k]].sort() : f[k];
    return JSON.stringify(ziel ? { v: 2, start, filter, ziel } : { v: 2, start, filter });
  }
  /** Ein Tag des Fever Charts aus der Sicht seines Tagesendes: erledigt und Umfang des letzten Blocks, prognostiziertes Ende
      je Perzentil in 7- und 5-Tage-Woche (null = keine Aussage); nichts offen → Ende ist der Tag selbst. Ohne Umfang ein
      leerer Tag — auch er kommt in den Cache, damit er nicht jedes Mal neu gerechnet wird. */
  function fieberTag(bew, f, aufgabeZu, datum, start, block = null) {
    const t = isoTag(datum), p = prognose(bew, f, aufgabeZu, tag(t, 1) - 1, { start, nurLetzter: true, block });
    const b = p.bloecke[0], leer = [null, null, null, null];
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

  Object.assign(ziel, { bestandAm, erledigtSpalten, fluss, flussRand, flussName, flussMax, durchsatz, durchsatzPaar, durchsatzZiel, durchsatzName, durchsatzTip, durchsatzMarke, xMarken, DURCHSATZ_EINHEITEN, DURCHSATZ_STANDARD, diagrammBloecke, zugangGegenAbgang, grenzenAb, letzterTag, ersterTag, fieberAusduennen, fieberBloecke, zielblock, vonblock, fieberSchluessel, fieberTag, fehlendeTage, dauerIn, pufferVorschlag, fieberZone, fieberPlan, fieberPunkte, tagAnPosition, vollDatum, zaehltImBericht, ausgenommen, ersterDurchlauf, terminChance, anteilBis, werktageBis, prognose, simuliere, simuliereMitZugang, tagesreihen, werktagDatum, PERZENTILE, MIN_LAEUFE, durchlaufzeiten, durchlaufVorgabe, durchlaufWahl, durchlaufMerken, perzentil, spalteAm, eintrittAm, alterText, datumsTrenner, trennerText, ankunftsTag, burndown, burndownBalken, BURNDOWN_BAND, ZEITRAEUME, FILTER_LEER, zeitraumGrenzen, aufgabePasst, zeitenGefiltert, filterAnzahl, leistenAnzahl, filterZuruecksetzen, zuruecksetzenHinweis, BERICHTSLEISTEN, filterAus, isoTag, offeneAufgaben, praefixe, vorschlag, bestandNachLabels, dringendste, zellName, achsenNachWahl, zielfilter });
})(typeof module !== 'undefined' ? module.exports : window);
