/* kanbanD — Zeitrechnung: reine Funktionen, im Browser und in Node (Unit-Tests) nutzbar. */
(function (ziel) {
  const zeitMs = z => { const [d, t] = z.split(' '); const [j, m, tg] = d.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(j, m - 1, tg, h, mi).getTime(); };
  const tagesbeginn = jetzt => { const d = new Date(jetzt); d.setHours(0, 0, 0, 0); return d.getTime(); };
  const wochenbeginn = jetzt => { const t = new Date(tagesbeginn(jetzt)); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return t.getTime(); };

  /** Millisekunden eines Eintrags im Zeitraum [von, bis); laufende Einträge enden jetzt. */
  function anteil(z, von, bis, jetzt) {
    const b = zeitMs(z.beginn), e = z.ende ? zeitMs(z.ende) : jetzt;
    return Math.max(0, Math.min(e, bis) - Math.max(b, von));
  }

  /** Je Person: laufende Einträge, Summen heute/Woche, heutige Abschnitte, offene und begonnene Aufgaben, Gruppe. */
  function personenZeilen(aufgaben, personen, board, jetzt) {
    const t0 = tagesbeginn(jetzt), w0 = wochenbeginn(jetzt), morgen = t0 + 864e5;
    const spalten = board ? board.spalten : [];
    const ort = nr => spalten.findIndex(sp => sp.aufgaben.includes(nr));
    return personen.map(p => {
      const eintraege = aufgaben.flatMap(a => a.zeiten.filter(z => z.wer === p.kuerzel).map(z => ({ a, z })));
      const heute = eintraege.reduce((s, x) => s + anteil(x.z, t0, morgen, jetzt), 0);
      const woche = eintraege.reduce((s, x) => s + anteil(x.z, w0, morgen, jetzt), 0);
      const laeuft = eintraege.filter(x => !x.z.ende);
      const abschnitte = eintraege.filter(x => anteil(x.z, t0, morgen, jetzt) > 0)
        .map(x => ({ nummer: x.a.nummer, von: Math.max(zeitMs(x.z.beginn), t0), bis: x.z.ende ? Math.min(zeitMs(x.z.ende), morgen) : jetzt, laeuft: !x.z.ende }));
      const offen = aufgaben.filter(a => !a.archiviert && a.zustaendige.includes(p.kuerzel) && ort(a.nummer) >= 0 && ort(a.nummer) < spalten.length - 1);
      const begonnen = offen.filter(a => ort(a.nummer) > 0);
      const zuletzt = Math.max(0, ...eintraege.map(x => x.z.ende ? zeitMs(x.z.ende) : jetzt));
      return { person: p, laeuft, heute, woche, abschnitte, offen: offen.length, begonnen: begonnen.length, zuletzt, gruppe: laeuft.length ? 0 : heute > 0 ? 1 : 2 };
    });
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

  Object.assign(ziel, { zeitMs, tagesbeginn, wochenbeginn, anteil, personenZeilen, stundenzettel, kreuztabelle });
})(typeof module !== 'undefined' ? module.exports : window);
