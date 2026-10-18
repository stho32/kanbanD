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

  Object.assign(ziel, { zeitMs, tagesbeginn, wochenbeginn, anteil, personenZeilen });
})(typeof module !== 'undefined' ? module.exports : window);
