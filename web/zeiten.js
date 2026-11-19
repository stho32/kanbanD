/* kanbanD — Zeitrechnung: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  /** Schwelle des vergessenen Timers (R00114, ADR-0019 Regel 1): zehn Stunden Laufzeit. */
  const VERGESSEN_MS = 10 * 3600e3;
  /** Vergessen ist eine Laufzeit ab der Schwelle; ein unbekannter Beginn (null, NaN) zählt nicht als vergessen. */
  function istVergessen(laufzeitMs) {
    return Number.isFinite(laufzeitMs) && laufzeitMs >= VERGESSEN_MS;
  }

  /** Dateiform `JJJJ-MM-TT HH:MM` mit optionalem Versatz `±HH:MM` oder `Z` (R00084): mit Versatz ein eindeutiger Moment, ohne Ortszeit. */
  function zeitMs(z) {
    const [d, t] = z.split(' '), [j, m, tg] = d.split('-').map(Number), [h, mi] = t.slice(0, 5).split(':').map(Number), versatz = t.slice(5);
    if (!versatz) return new Date(j, m - 1, tg, h, mi).getTime();
    const [vh, vm] = versatz === 'Z' ? [0, 0] : versatz.slice(1).split(':').map(Number);
    return Date.UTC(j, m - 1, tg, h, mi) - (versatz[0] === '-' ? -1 : 1) * (vh * 60 + vm) * 6e4;
  }
  /** Zeitpunkt zur Anzeige als `JJJJ-MM-TT HH:MM` in der Ortszeit des Browsers; Altbestand ohne Versatz bleibt, wie er ist. */
  function ortszeit(z) {
    if (z.length <= 16) return z;
    const o = new Date(zeitMs(z)), p = n => String(n).padStart(2, '0');
    return `${o.getFullYear()}-${p(o.getMonth() + 1)}-${p(o.getDate())} ${p(o.getHours())}:${p(o.getMinutes())}`;
  }
  /** Eine Dauer in ms als `h:mm` (R00089) — die eine Zeitform der Karte: gebuchte Zeit (`Σ`) und geschätzte Zeit (R00129). */
  function hm(ms) {
    const minuten = Math.max(0, Math.floor(ms / 6e4));
    return Math.floor(minuten / 60) + ':' + String(minuten % 60).padStart(2, '0');
  }

  /** Gebuchte Zeit in ms (R00089): abgeschlossene Einträge ganz, laufende bis `jetzt`; `beginnVon` liefert den Beginn
      eines laufenden Eintrags (die Oberfläche kennt die Startsekunde genauer als die Datei). */
  function summeMs(zeiten, jetzt, beginnVon = z => zeitMs(z.beginn)) {
    return zeiten.reduce((s, z) => s + Math.max(0, z.ende ? zeitMs(z.ende) - zeitMs(z.beginn) : jetzt - beginnVon(z)), 0);
  }
  /** Summe je Person, größte zuerst: `[{wer, ms}]`. */
  function summeJePerson(zeiten, jetzt, beginnVon) {
    const wer = [...new Set(zeiten.map(z => z.wer))];
    return wer.map(w => ({ wer: w, ms: summeMs(zeiten.filter(z => z.wer === w), jetzt, beginnVon) })).sort((a, b) => b.ms - a.ms);
  }
  /** Millisekunden, die eine Reservierung (R00087) noch hält — 24 h ab `seit`; abgelaufen oder keine: null. */
  function reservierungRest(r, jetzt) {
    const rest = r ? zeitMs(r.seit) + 864e5 - jetzt : 0;
    return rest > 0 ? rest : null;
  }
  const tagesbeginn = jetzt => { const d = new Date(jetzt); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const wochenbeginn = jetzt => { const t = new Date(tagesbeginn(jetzt)); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.getTime(); };
  /** Ende eines Zeitraums nach `tage` Kalendertagen in Ortszeit — an Umstelltagen 23 oder 25 Stunden, nie `+864e5`. */
  const nachTagen = (beginn, tage) => { const d = new Date(beginn); d.setDate(d.getDate() + tage); return d.getTime(); };
  /** 0 Uhr des Folgetags: das Ende des Tages, in dem `zeitpunkt` liegt. */
  const tagesende = zeitpunkt => nachTagen(tagesbeginn(zeitpunkt), 1);
  /** Montag 0 Uhr der Folgewoche: das Ende der Kalenderwoche, in der `zeitpunkt` liegt. */
  const wochenende = zeitpunkt => nachTagen(wochenbeginn(zeitpunkt), 7);

  /** Millisekunden eines Eintrags im Zeitraum [von, bis); laufende Einträge enden jetzt. */
  function anteil(z, von, bis, jetzt) {
    const b = zeitMs(z.beginn), e = z.ende ? zeitMs(z.ende) : jetzt;
    return Math.max(0, Math.min(e, bis) - Math.max(b, von));
  }

  /** Marken der Tagesleiste alle drei Stunden, 0 bis 24 Uhr, auf den echten Ortszeit-Stunden des Tages, in dem `tag` liegt —
      am 25.10. steht 3 Uhr vier Stunden nach 0 Uhr (R00199 Regel 1). */
  function stundenmarken(tag) {
    return [0, 3, 6, 9, 12, 15, 18, 21, 24].map(stunde => { const d = new Date(tagesbeginn(tag)); d.setHours(stunde); return { stunde, zeitpunkt: d.getTime() }; });
  }
  /** Lage eines Zeitpunkts im Tag [t0, t1) in Prozent der Leiste, am Rand gekappt. */
  const lageImTag = (zeitpunkt, t0, t1) => Math.max(0, Math.min(100, (zeitpunkt - t0) / (t1 - t0) * 100));

  /** Je Person für den Tag, in dem `tag` liegt: Summen des Tages und seiner Kalenderwoche, Abschnitte des Tages, laufende
      Einträge, `zuletzt`, Gruppe, offene und begonnene Aufgaben (R00199). Ein Durchlauf über alle Zeiten, jeder Eintrag wird
      höchstens zweimal umgewandelt (`umwandeln`, Zählhaken der Lastprobe). Laufende Einträge zählen bis `jetzt`. */
  function personenZeilen(aufgaben, personen, board, tag, jetzt, umwandeln = zeitMs) {
    const t0 = tagesbeginn(tag), t1 = tagesende(tag), w0 = wochenbeginn(tag), w1 = wochenende(tag);
    const istHeute = t0 === tagesbeginn(jetzt);
    const spalten = board ? board.spalten : [];
    const ort = new Map(spalten.flatMap((sp, i) => sp.aufgaben.map(nr => [nr, i])));
    const jePerson = new Map(personen.map(p => [p.kuerzel, { person: p, laeuft: [], tag: 0, woche: 0, abschnitte: [], offen: 0, begonnen: 0, zuletzt: 0 }]));
    const ueberlappung = (b, e, von, bis) => Math.max(0, Math.min(e, bis) - Math.max(b, von));
    for (const a of aufgaben) {
      for (const z of a.zeiten) {
        const zeile = jePerson.get(z.wer);
        if (!zeile) continue;
        const b = umwandeln(z.beginn), e = z.ende ? umwandeln(z.ende) : jetzt;
        const imTag = ueberlappung(b, e, t0, t1);
        zeile.tag += imTag;
        zeile.woche += ueberlappung(b, e, w0, w1);
        if (imTag > 0) zeile.abschnitte.push({ nummer: a.nummer, von: Math.max(b, t0), bis: Math.min(e, t1), laeuft: !z.ende });
        if (!z.ende) zeile.laeuft.push({ a, z });
        const zaehltAlsZuletzt = istHeute || (z.ende && e >= t0 && e < t1);
        if (zaehltAlsZuletzt) zeile.zuletzt = Math.max(zeile.zuletzt, e);
      }
      const spalte = ort.has(a.nummer) ? ort.get(a.nummer) : -1;
      const offen = !a.archiviert && spalte >= 0 && spalte < spalten.length - 1;
      if (!offen) continue;
      for (const k of a.zustaendige) {
        const zeile = jePerson.get(k);
        if (!zeile) continue;
        zeile.offen++;
        if (spalte > 0) zeile.begonnen++;
      }
    }
    const gruppe = zeile => (istHeute && zeile.laeuft.length ? 0 : zeile.tag > 0 ? 1 : 2);
    return [...jePerson.values()].map(zeile => ({ ...zeile, gruppe: gruppe(zeile) }));
  }

  /** Stundenzettel einer Person: Zeilen je Aufgabe mit Zeit in der Woche, je Tag (Mo–So) in ms. */
  function stundenzettel(aufgaben, wer, w0, jetzt) {
    const tage = [...Array(7)].map((_, i) => { const d = new Date(w0); d.setDate(d.getDate() + i); return d.getTime(); });
    const ende = (() => { const d = new Date(w0); d.setDate(d.getDate() + 7); return d.getTime(); })();
    const grenzen = [...tage, ende];
    const zeilen = aufgaben.map(a => {
      const proTag = tage.map((t, i) => a.zeiten.filter(z => z.wer === wer).reduce((s, z) => s + anteil(z, t, grenzen[i + 1], jetzt), 0));
      return { aufgabe: a, proTag, summe: proTag.reduce((s, x) => s + x, 0) };
    }).filter(z => z.summe > 0);
    const jeTag = tage.map((_, i) => zeilen.reduce((s, z) => s + z.proTag[i], 0));
    return { tage, zeilen, jeTag, summe: jeTag.reduce((s, x) => s + x, 0) };
  }

  /** Kreuztabelle im Zeitraum [von, bis): Zeilen je Aufgabe, Spalten je Person mit Zeit, Summen in beide Richtungen. */
  function kreuztabelle(aufgaben, von, jetzt, bis = Infinity) {
    const wer = [...new Set(aufgaben.flatMap(a => a.zeiten.filter(z => anteil(z, von, bis, jetzt) > 0).map(z => z.wer)))];
    const zeilen = aufgaben.map(a => {
      const jePerson = wer.map(k => a.zeiten.filter(z => z.wer === k).reduce((s, z) => s + anteil(z, von, bis, jetzt), 0));
      return { aufgabe: a, jePerson, summe: jePerson.reduce((s, x) => s + x, 0) };
    }).filter(z => z.summe > 0).sort((x, y) => y.aufgabe.nummer - x.aufgabe.nummer);
    const jeSpalte = wer.map((_, i) => zeilen.reduce((s, z) => s + z.jePerson[i], 0));
    return { personen: wer, zeilen, jeSpalte, summe: jeSpalte.reduce((s, x) => s + x, 0) };
  }

  Object.assign(ziel, { VERGESSEN_MS, istVergessen, zeitMs, ortszeit, hm, reservierungRest, summeMs, summeJePerson, tagesbeginn, tagesende, wochenbeginn, wochenende, anteil, stundenmarken, lageImTag, personenZeilen, stundenzettel, kreuztabelle });
})(typeof module !== 'undefined' ? module.exports : window);
